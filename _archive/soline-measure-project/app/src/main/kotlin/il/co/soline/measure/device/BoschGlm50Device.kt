package il.co.soline.measure.device

import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothProfile
import android.content.Context
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

/*
 * מימוש LaserDevice ל-Bosch GLM 50 C (2D — מרחק בלבד) — פוענח ב-docs/DISTO_PROTOCOL.md.
 * שירות מדידה:  02a6c0d0-0451-4000-b000-fb3210111989
 *   char מדידה:  02a6c0d1-...  (indicate/notify, פריים 20 בייט ; heartbeat = 4 בייט)
 * handshake: (1) connectGatt → discover ; (2) CCCD ENABLE_INDICATION = 02 00 ;
 *            (3) פקודת הפעלה C0 55 02 01 00 1A ; (4) קבלת מדידות ב-onCharacteristicChanged.
 * פורמט פריים → Mode + Value(מ"מ). Mode=BACK = מדידה אמיתית. אין זווית (vAngle=null).
 */
class BoschGlm50Device(
    private val appContext: Context,
    private val bluetoothDevice: BluetoothDevice?,
    private val captureSound: PointCaptureSound = PointCaptureSound.Silent,
) : LaserDevice {

    override val capabilities = DeviceCapabilities(is3D = false, hasAngle = false)

    private val _state = MutableStateFlow<DeviceConnectionState>(DeviceConnectionState.Disconnected)
    override val state: StateFlow<DeviceConnectionState> = _state.asStateFlow()

    private val _measurements = MutableSharedFlow<RawMeasurement>(
        replay = 0,
        extraBufferCapacity = 16,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    override val measurements: Flow<RawMeasurement> = _measurements.asSharedFlow()

    private var gatt: BluetoothGatt? = null

    @Volatile private var captureActive: Boolean = true

    /** מונה מקומי — ל-Bosch אין מונה בפריים, לכן מונים כאן כדי לספק counter עולה. */
    @Volatile private var localCounter: Int = 0

    /** מניעת כפילויות: מרחק אחרון שנפלט (Bosch משדר את אותה מדידה שוב ושוב עד למדידה הבאה). */
    @Volatile private var lastEmittedMm: Double? = null

    private val emittedHistory = ArrayDeque<RawMeasurement>()

    override fun connect() {
        _state.value = DeviceConnectionState.Connecting
        // TODO(GATT): device.connectGatt(appContext, false, gattCallback, TRANSPORT_LE).
        gatt = bluetoothDevice?.connectGatt(appContext, false, gattCallback)
    }

    override fun disconnect() {
        try {
            gatt?.disconnect()
            gatt?.close()
        } finally {
            gatt = null
            lastEmittedMm = null
            emittedHistory.clear()
            _state.value = DeviceConnectionState.Disconnected
        }
    }

    override fun setCaptureActive(active: Boolean) {
        captureActive = active
    }

    override fun undoLastPoint() {
        emittedHistory.removeLastOrNull()
    }

    // ------------------------------------------------------------------
    // GATT callback — שלד + handshake נאמן לפרוטוקול.
    // ------------------------------------------------------------------
    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    // TODO(GATT): g.discoverServices()
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    _state.value = DeviceConnectionState.Disconnected
                }
            }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            // TODO(GATT) — שלב 2 של ה-handshake:
            //  val ch = g.getService(SERVICE).getCharacteristic(CHAR_MEASUREMENT)
            //  g.setCharacteristicNotification(ch, true)
            //  val cccd = ch.getDescriptor(CCCD_UUID)
            //  cccd.value = ENABLE_INDICATION            // 02 00
            //  g.writeDescriptor(cccd)
        }

        override fun onDescriptorWrite(g: BluetoothGatt, descriptor: android.bluetooth.BluetoothGattDescriptor, status: Int) {
            // TODO(GATT) — שלב 3: אחרי הצלחת כתיבת ה-CCCD, שלח את פקודת ההפעלה.
            //  val cmd = g.getService(SERVICE).getCharacteristic(CHAR_MEASUREMENT)
            //  cmd.value = ENABLE_COMMAND                // C0 55 02 01 00 1A
            //  g.writeCharacteristic(cmd)
            _state.value = DeviceConnectionState.Connected()
        }

        @Deprecated("Deprecated in API 33; העדיפו את החתימה עם value: ByteArray כשמכוונים ל-33+")
        override fun onCharacteristicChanged(g: BluetoothGatt, ch: BluetoothGattCharacteristic) {
            val data = ch.value ?: return
            if (ch.uuid == CHAR_MEASUREMENT) parseFrame(data)?.let { emitIfNew(it) }
        }
    }

    // ------------------------------------------------------------------
    // פרסינג — נאמן ל-DISTO_PROTOCOL.md
    // ------------------------------------------------------------------

    /** מצב הפריים כפי שפוענח מהמכשיר. */
    enum class Mode { BACK, MIN_MAX_START, LOCKED, UNKNOWN }

    /** תוצאת פענוח גולמית של פריים Bosch. */
    internal data class BoschFrame(val mode: Mode, val valueMm: Double?)

    /**
     * פענוח פריים Bosch.
     *  פריים 4 בייט = heartbeat/סטטוס → UNKNOWN, value=null.
     *  פריים 20 בייט → Mode + Value(מ"מ, float). BACK = מדידה אמיתית.
     * מחזיר RawMeasurement רק עבור מדידה אמיתית (BACK/LOCKED עם ערך); אחרת null.
     */
    internal fun parseFrame(data: ByteArray): RawMeasurement? {
        val frame = decodeFrame(data)
        val mm = frame.valueMm ?: return null
        if (frame.mode != Mode.BACK && frame.mode != Mode.LOCKED) return null
        if (mm <= 0.0) return null
        return RawMeasurement(
            distanceMm = mm,
            vAngleRad = null,  // Bosch 2D — אין זווית
            hAngleRad = null,
            counter = localCounter, // ממולא ב-emitIfNew
        )
    }

    /** פענוח מבני של הפריים ל-Mode + ערך במ"מ. */
    internal fun decodeFrame(data: ByteArray): BoschFrame {
        // פריים 4-בייט = heartbeat.
        if (data.size < 20) return BoschFrame(Mode.UNKNOWN, null)

        // בייט המצב + ערך float32 LE של המרחק במ"מ. מיפוי המצב לפי הבתים שנצפו בלוג.
        val mode = when (data[0].toInt() and 0xFF) {
            0x00 -> Mode.MIN_MAX_START
            0x01 -> Mode.BACK
            0x02 -> Mode.LOCKED
            else -> Mode.BACK // ברירת מחדל למדידה רגילה
        }
        // הערך במ"מ (float LE). ה-offset המדויק בתוך 20 הבייט — 4 (אחרי כותרת המצב).
        val valueMm = readFloatLe(data, 4).toDouble()
        val safe = if (valueMm.isNaN() || valueMm.isInfinite()) null else valueMm
        return BoschFrame(mode, safe)
    }

    private fun emitIfNew(base: RawMeasurement) {
        if (!captureActive) return
        // Bosch משדר את אותה מדידה חוזרות — פולטים רק כשהערך משתנה.
        if (lastEmittedMm != null && kotlin.math.abs(lastEmittedMm!! - base.distanceMm) < 0.05) return
        lastEmittedMm = base.distanceMm
        val m = base.copy(counter = ++localCounter)
        emittedHistory.addLast(m)
        captureSound.onPointCaptured()
        _measurements.tryEmit(m)
    }

    companion object {
        private const val BOSCH_UUID_TAIL = "-0451-4000-b000-fb3210111989"

        fun boschUuid(short: String): UUID = UUID.fromString("02a6$short$BOSCH_UUID_TAIL")

        /** 02a6c0d0 — שירות המדידה. */
        val SERVICE: UUID = boschUuid("c0d0")
        /** 02a6c0d1 — characteristic המדידה (indicate/notify + פקודות). */
        val CHAR_MEASUREMENT: UUID = boschUuid("c0d1")

        /** CCCD סטנדרטי (0x2902) להפעלת indication. */
        val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

        /** ENABLE_INDICATION שנכתב ל-CCCD. */
        val ENABLE_INDICATION: ByteArray = byteArrayOf(0x02, 0x00)

        /** פקודת ההפעלה שנשלחת אחרי הצלחת ה-CCCD. */
        val ENABLE_COMMAND: ByteArray =
            byteArrayOf(0xC0.toByte(), 0x55, 0x02, 0x01, 0x00, 0x1A)

        private fun readFloatLe(data: ByteArray, offset: Int): Float {
            val bits = (data[offset].toInt() and 0xFF) or
                ((data[offset + 1].toInt() and 0xFF) shl 8) or
                ((data[offset + 2].toInt() and 0xFF) shl 16) or
                ((data[offset + 3].toInt() and 0xFF) shl 24)
            return Float.fromBits(bits)
        }
    }
}
