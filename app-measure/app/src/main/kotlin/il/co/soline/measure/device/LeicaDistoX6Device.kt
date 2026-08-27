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
 * מימוש LaserDevice ל-Leica DISTO X6 + מתאם DST 360 (3D) — פוענח ב-docs/DISTO_PROTOCOL.md.
 * שירות BLE:  3ab1XXXX-f831-4395-b29d-570977d5bf94
 *   3ab1010d  — מדידה (מרחק + זווית אנכית), 20 בייט, notify, isNew בכל מדידה חדשה
 *   3ab1010f  — זווית אופקית מ-DST 360, 12 בייט, read/poll ~150ms
 * פורמט: float32 Little-Endian. Infinity (00 00 80 7F) → זווית = null. counter+isNew למניעת כפילות.
 */
class LeicaDistoX6Device(
    private val appContext: Context,
    private val bluetoothDevice: BluetoothDevice?,
    private val captureSound: PointCaptureSound = PointCaptureSound.Silent,
) : LaserDevice {

    override val capabilities = DeviceCapabilities(is3D = true, hasAngle = true)

    private val _state = MutableStateFlow<DeviceConnectionState>(DeviceConnectionState.Disconnected)
    override val state: StateFlow<DeviceConnectionState> = _state.asStateFlow()

    private val _measurements = MutableSharedFlow<RawMeasurement>(
        replay = 0,
        extraBufferCapacity = 16,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    override val measurements: Flow<RawMeasurement> = _measurements.asSharedFlow()

    private var gatt: BluetoothGatt? = null

    /** קליטה אקטיבית (auto-capture). כשכבוי — עדיין מחוברים אבל לא פולטים מדידות. */
    @Volatile private var captureActive: Boolean = true

    /** מונה המדידה האחרון שנפלט — למניעת כפילויות (isNew dedup). */
    @Volatile private var lastCounter: Int = -1

    /** הזווית האופקית האחרונה שנקראה מ-3ab1010f (DST 360). null עד לקריאה ראשונה. */
    @Volatile private var lastHAngleRad: Double? = null

    /** היסטוריית מדידות שנפלטו — לתמיכה ב-undo. */
    private val emittedHistory = ArrayDeque<RawMeasurement>()

    override fun connect() {
        _state.value = DeviceConnectionState.Connecting
        // TODO(GATT): לחווט קריאת device.connectGatt(appContext, false, gattCallback, TRANSPORT_LE).
        //  דורש הרשאת BLUETOOTH_CONNECT (Android 12+) — האינטגרטור מוסיף במניפסט.
        gatt = bluetoothDevice?.connectGatt(appContext, false, gattCallback)
    }

    override fun disconnect() {
        try {
            gatt?.disconnect()
            gatt?.close()
        } finally {
            gatt = null
            lastCounter = -1
            lastHAngleRad = null
            emittedHistory.clear()
            _state.value = DeviceConnectionState.Disconnected
        }
    }

    override fun setCaptureActive(active: Boolean) {
        captureActive = active
    }

    override fun undoLastPoint() {
        // מסיר את הנקודה האחרונה שנפלטה; מנוע-החדר במעלה הזרם מבטל את הבנייה עליה.
        emittedHistory.removeLastOrNull()
    }

    // ------------------------------------------------------------------
    // GATT callback — שלד. הפרסינג עצמו (parseMeasurementFrame / parseHorizontalAngle) מלא ונאמן.
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
            // TODO(GATT): לאתר את השירות 3ab1XXXX, להפעיל notify על 3ab1010d
            //  (setCharacteristicNotification + כתיבת CCCD 01 00), ולהתחיל polling של 3ab1010f כל ~150ms.
            _state.value = DeviceConnectionState.Connected()
        }

        @Deprecated("Deprecated in API 33; העדיפו את החתימה עם value: ByteArray כשמכוונים ל-33+")
        override fun onCharacteristicChanged(g: BluetoothGatt, ch: BluetoothGattCharacteristic) {
            val data = ch.value ?: return
            handleCharacteristic(ch.uuid, data)
        }

        override fun onCharacteristicRead(g: BluetoothGatt, ch: BluetoothGattCharacteristic, status: Int) {
            val data = ch.value ?: return
            handleCharacteristic(ch.uuid, data)
        }
    }

    /** ניתוב פריים לפי ה-characteristic. */
    private fun handleCharacteristic(uuid: UUID, data: ByteArray) {
        when (uuid) {
            CHAR_MEASUREMENT -> parseMeasurementFrame(data)?.let { emitIfNew(it) }
            CHAR_HORIZONTAL_ANGLE -> parseHorizontalAngle(data)?.let { lastHAngleRad = it }
        }
    }

    // ------------------------------------------------------------------
    // פרסינג — נאמן ל-DISTO_PROTOCOL.md
    // ------------------------------------------------------------------

    /**
     * פריים מדידה 20 בייט מ-3ab1010d.
     *  0–3  float32 LE  מרחק במטרים
     *  4–7  float32 LE  זווית אנכית ברדיאנים (Infinity → null)
     * 16–19 counter(byte16) + סמן קבוע C0
     * דוגמה: 06 F0 CE 3F  AA F2 C1 3F ... 03 C0 → 1.617m, 86.82°, counter=3.
     */
    internal fun parseMeasurementFrame(data: ByteArray): RawMeasurement? {
        if (data.size < 20) return null

        val distanceMeters = readFloatLe(data, 0)
        if (distanceMeters.isNaN() || distanceMeters.isInfinite()) return null
        val distanceMm = distanceMeters.toDouble() * 1000.0

        val vAngleFloat = readFloatLe(data, 4)
        // Infinity (00 00 80 7F) → ה-DST 360 לא סובב → אין זווית אנכית.
        val vAngleRad: Double? =
            if (vAngleFloat.isInfinite() || vAngleFloat.isNaN()) null else vAngleFloat.toDouble()

        val counter = data[16].toInt() and 0xFF

        return RawMeasurement(
            distanceMm = distanceMm,
            vAngleRad = vAngleRad,
            hAngleRad = lastHAngleRad, // הזווית האופקית האחרונה מה-DST 360
            counter = counter,
        )
    }

    /** זווית אופקית מ-3ab1010f (DST 360), 12 בייט — float32 LE ברדיאנים בתחילת הפריים. */
    internal fun parseHorizontalAngle(data: ByteArray): Double? {
        if (data.size < 4) return null
        val hAngle = readFloatLe(data, 0)
        if (hAngle.isNaN() || hAngle.isInfinite()) return null
        return hAngle.toDouble()
    }

    /** פליטה רק אם המונה השתנה (isNew dedup) והקליטה אקטיבית. */
    private fun emitIfNew(m: RawMeasurement) {
        if (!captureActive) return
        if (m.counter == lastCounter) return
        lastCounter = m.counter
        emittedHistory.addLast(m)
        captureSound.onPointCaptured() // פידבק קולי בכל נקודה חדשה (MICHAEL_WISHLIST §7)
        _measurements.tryEmit(m)
    }

    companion object {
        /** בסיס ה-UUID של Leica DISTO — מחליפים את 4 הספרות (XXXX). */
        private const val LEICA_UUID_TAIL = "-f831-4395-b29d-570977d5bf94"

        fun leicaUuid(short: String): UUID = UUID.fromString("3ab1$short$LEICA_UUID_TAIL")

        /** 3ab1010d — מדידה (מרחק + זווית אנכית). */
        val CHAR_MEASUREMENT: UUID = leicaUuid("010d")
        /** 3ab1010f — זווית אופקית מ-DST 360. */
        val CHAR_HORIZONTAL_ANGLE: UUID = leicaUuid("010f")
        /** בסיס השירות (3ab10100 נצפה כשירות/מצב). */
        val SERVICE: UUID = leicaUuid("0100")

        /** קריאת float32 Little-Endian מ-offset נתון. */
        private fun readFloatLe(data: ByteArray, offset: Int): Float {
            val bits = (data[offset].toInt() and 0xFF) or
                ((data[offset + 1].toInt() and 0xFF) shl 8) or
                ((data[offset + 2].toInt() and 0xFF) shl 16) or
                ((data[offset + 3].toInt() and 0xFF) shl 24)
            return Float.fromBits(bits)
        }
    }
}
