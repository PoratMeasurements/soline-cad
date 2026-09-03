package il.co.soline.measure.device

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID

/**
 * מנהל בלוטות' עובד למדי-הלייזר של Soline — סריקה → חיבור → קבלת נתונים חיים.
 * מפענח את הפריימים לפי DISTO_PROTOCOL.md (Leica X6 3D במלואו; Bosch GLM 2D best-effort).
 * זהו החיווט האמיתי (GATT) שמשלים את שכבת-ההפשטה LaserDevice.
 *
 * אבחון-לייזר (Diag) — פולט מצב-חי מלא (חיבור · notify · ספירת-פריימים · פריים-גולמי
 * אחרון · Reading-אחרון) כדי שהבעלים יראה בשטח בדיוק מה ה-X6 שולח, גם כשאין חומרה
 * לבדיקה כאן. כל פריים-נכנס נרשם ל-Diag **לפני** סינון-ה-UUID, כך שגם פריים שמגיע
 * על characteristic לא-צפוי נראה (מונע "בלאק-בוקס").
 */
@SuppressLint("MissingPermission")
class LaserBle(private val context: Context) {

    data class Found(val name: String, val address: String, val rssi: Int, val isLaser: Boolean = false)
    data class Reading(
        val label: String,
        val distanceMm: Double?,
        val vAngleDeg: Double?,
        val hex: String,
        val ts: Long,
        val hAngleDeg: Double? = null,   // זווית-אופקית (azimuth) מ-DST 360-X → XYZ מלא
    )

    /** צילום-מצב חי של שכבת-ה-BLE — לפאנל "אבחון-לייזר 🔬" במסך-המכשירים. */
    data class Diag(
        val state: String = "מנותק",
        val deviceName: String? = null,
        val servicesFound: Int = 0,
        val leicaFound: Boolean = false,
        val boschFound: Boolean = false,
        /** characteristics שעליהם הודלק notify/indicate (כתיבת CCCD נשלחה). */
        val subscribedChars: List<String> = emptyList(),
        /** כתיבות-CCCD שהצליחו (notify/indicate פעילים בפועל). */
        val notifyEnabledCount: Int = 0,
        /** סך-כל הפריימים שהתקבלו (מכל characteristic, כולל לא-מזוהים). */
        val frameCount: Int = 0,
        /** פריימים שפוענחו ל-Reading בפועל (מרחק תקין). */
        val parsedCount: Int = 0,
        val lastFrameUuid: String? = null,
        val lastFrameHex: String? = null,
        val lastFrameSize: Int = 0,
        val lastFrameTs: Long = 0L,
        val lastDistanceMm: Double? = null,
        val lastVAngleDeg: Double? = null,
        val lastHAngleDeg: Double? = null,
        /** קריאות-poll של הזווית-האופקית (DST 360-X · 3ab1010f). */
        val hAnglePollCount: Int = 0,
        val hAngleCharFound: Boolean = false,
        /** יומן-פריימים-גולמי אחרון (עד 14) — "010d 20B: 06 F0 …". */
        val recentFrames: List<String> = emptyList(),
    )

    private val _status = MutableStateFlow("מנותק")
    val status: StateFlow<String> = _status
    private val _devices = MutableStateFlow<List<Found>>(emptyList())
    val devices: StateFlow<List<Found>> = _devices
    private val _readings = MutableStateFlow<List<Reading>>(emptyList())
    val readings: StateFlow<List<Reading>> = _readings
    private val _connected = MutableStateFlow<String?>(null)
    val connected: StateFlow<String?> = _connected
    /** המדידה האחרונה — שדה-קלט בפוקוס מזריק ממנה בלחיצת-מכשיר */
    private val _lastReading = MutableStateFlow<Reading?>(null)
    val lastReading: StateFlow<Reading?> = _lastReading
    /** אבחון-לייזר חי — מסך-המכשירים מציג אותו תמיד (לא רק ב-debug). */
    private val _diag = MutableStateFlow(Diag())
    val diag: StateFlow<Diag> = _diag

    private val btManager = context.getSystemService(BluetoothManager::class.java)
    private val adapter get() = btManager?.adapter
    private var gatt: BluetoothGatt? = null
    private var scanning = false
    private var lastCounter = -1
    private var lastD2Mm = -1.0
    /** הזווית-האופקית האחרונה (מעלות) מ-DST 360-X — מצורפת למדידה הבאה. */
    private var lastHAngle: Double? = null
    private var tone: ToneGenerator? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var targetAddress: String? = null
    private var userDisconnect = false
    private var autoJob: Job? = null
    /** לולאת-poll של הזווית-האופקית (DST 360-X · read/poll, לא notify). */
    private var hAngleJob: Job? = null
    private var hAngleChar: BluetoothGattCharacteristic? = null
    /**
     * ה-poll של הזווית-האופקית רץ **רק כשמסך-P2P פעיל**. מחוץ ל-P2P אין צורך באזימוט,
     * וה-poll (שמחזיר אפסים במצב-מרחק) רק מציף את החיבור ומחניק את notify-המרחק.
     * P2PMeasureScreen קורא `setP2pActive(true/false)` בכניסה/יציאה.
     */
    @Volatile private var p2pActive = false

    // op queue — GATT מאפשר פעולה אחת בכל רגע
    private val writeQueue = ArrayDeque<Runnable>()
    private var busy = false

    companion object {
        private fun leica(x: String) = UUID.fromString("3ab1$x-f831-4395-b29d-570977d5bf94")
        val LEICA_MEAS = leica("010d")      // X6: מרחק + זווית אנכית (20B, indicate)
        val LEICA_D2_MEAS = leica("0101")   // DISTO D2: מרחק בלבד (float32 LE מטר, 4B)
        val LEICA_HANGLE = leica("010f")    // זווית אופקית מ-DST360 (read/poll ~150ms)
        val LEICA_DST_CMD = leica("0120")   // פקודת-הפעלת-DST-360 (WRITE) — "raiseEvent 100\r\n" (פרוטוקול Leica DST 360)
        // פקודת-ההפעלה שמפעילה את מצב-ה-P2P של ה-DST 360 (אחרת האזימוט נשאר אפס). פרוטוקול Leica DST 360 — אומת בלכידת-BLE חיה.
        val DST_ACTIVATE_CMD = "raiseEvent 100\r\n".toByteArray(Charsets.US_ASCII)
        val BOSCH_SVC = UUID.fromString("02a6c0d0-0451-4000-b000-fb3210111989")
        val BOSCH_MEAS = UUID.fromString("02a6c0d1-0451-4000-b000-fb3210111989")
        val CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        val ENABLE_NOTIFY = byteArrayOf(0x01, 0x00)
        val ENABLE_INDICATE = byteArrayOf(0x02, 0x00)
        val BOSCH_CMD = byteArrayOf(0xC0.toByte(), 0x55, 0x02, 0x01, 0x00, 0x1A)
        /** מרווח-סקירה של הזווית-האופקית (DST 360-X). */
        private const val HANGLE_POLL_MS = 200L
    }

    /** עדכון בטוח של צילום-האבחון (thread-safe דרך update של StateFlow). */
    private inline fun diag(block: Diag.() -> Diag) { _diag.value = _diag.value.block() }

    /** קיצור UUID לתצוגה — 4 הספרות המזהות (010d) במקום ה-UUID המלא. */
    private fun shortUuid(u: UUID): String {
        val s = u.toString()
        return if (s.startsWith("3ab1")) s.substring(4, 8) else s.substring(0, 8)
    }

    // ── scan ────────────────────────────────────────────────────────────────
    fun startScan() {
        val sc = adapter?.bluetoothLeScanner ?: run { _status.value = "בלוטות' כבוי"; diag { copy(state = "בלוטות' כבוי") }; return }
        if (scanning) return
        _devices.value = emptyList()
        scanning = true
        _status.value = "סורק… (הדלק את מד-הלייזר)"
        diag { copy(state = "סורק…") }
        val settings = android.bluetooth.le.ScanSettings.Builder()
            .setScanMode(android.bluetooth.le.ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()
        sc.startScan(null, settings, scanCb)
    }

    fun stopScan() {
        if (!scanning) return
        scanning = false
        adapter?.bluetoothLeScanner?.stopScan(scanCb)
        if (_connected.value == null) _status.value = "מנותק"
    }

    private val scanCb = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val rec = result.scanRecord
            val uuids = rec?.serviceUuids?.map { it.uuid.toString().lowercase() } ?: emptyList()
            val nm = (result.device.name ?: rec?.deviceName ?: "").lowercase()
            val isLeica = uuids.any { it.contains("f831-4395-b29d-570977d5bf94") } ||
                nm.contains("disto") || nm.contains("leica") || nm.contains("x6") ||
                nm.contains("x4") || nm.contains("x3") || nm.contains("dst") ||
                nm.contains("d2") || nm.contains("d1") || nm.contains("d5") || nm.contains("d8")
            val isBosch = uuids.any { it.contains("fb3210111989") } ||
                nm.contains("glm") || nm.contains("bosch") || nm.contains("blaze")
            val raw = result.device.name ?: rec?.deviceName
            val name = when {
                isLeica -> "📏 " + (raw ?: "Leica DISTO") + " — מד-לייזר"
                isBosch -> "📏 " + (raw ?: "Bosch GLM") + " — מד-לייזר"
                raw != null -> raw
                else -> "(מכשיר ללא שם)"
            }
            val f = Found(name, result.device.address, result.rssi, isLeica || isBosch)
            val cur = _devices.value.filter { it.address != f.address }
            // מד-לייזר תמיד ראשון, אחר-כך לפי עוצמת-אות
            _devices.value = (cur + f).sortedWith(compareByDescending<Found> { it.isLaser }.thenByDescending { it.rssi })
        }
    }

    /** טוען מכשירים מותאמים (bonded) — מד-לייזר שכבר קושר לטאבלט לא תמיד מופיע בסריקה */
    fun loadBonded() {
        val bonded = adapter?.bondedDevices ?: return
        val list = bonded.map { d ->
            val n = d.name ?: "מכשיר מותאם"
            val laser = n.contains("DISTO", true) || n.contains("GLM", true)
            Found(if (laser) "📏 $n — מד-לייזר (מותאם)" else "$n (מותאם)", d.address, 0, laser)
        }
        val cur = _devices.value.filter { f -> list.none { it.address == f.address } }
        _devices.value = (list + cur).sortedWith(compareByDescending<Found> { it.isLaser }.thenByDescending { it.rssi })
    }

    // ── connect ───────────────────────────────────────────────────────────────
    fun connect(address: String) {
        userDisconnect = false
        targetAddress = address
        stopScan()
        doConnect(address)
    }

    private fun doConnect(address: String) {
        val dev: BluetoothDevice = adapter?.getRemoteDevice(address) ?: return
        _status.value = "מתחבר ל-${dev.name ?: address}…"
        diag { copy(state = "מתחבר…", deviceName = dev.name ?: address) }
        lastCounter = -1
        lastD2Mm = -1.0
        // סגירה נקייה של חיבור-קודם (מונע דליפת GATT-clients בניסיונות-חוזרים)
        try { gatt?.close() } catch (_: Exception) {}
        gatt = null
        stopHAnglePoll()
        // TRANSPORT_LE מפורש — מייצב חיבור מול status=133/147 בהתקני-BLE
        gatt = dev.connectGatt(context, false, gattCb, BluetoothDevice.TRANSPORT_LE)
    }

    /** ניתוק יזום ע"י המשתמש — עוצר גם את החיבור-האוטומטי */
    fun disconnect() {
        userDisconnect = true
        targetAddress = null
        autoJob?.cancel()
        stopHAnglePoll()
        try { gatt?.disconnect(); gatt?.close() } catch (_: Exception) {}
        gatt = null
        _connected.value = null
        _status.value = "מנותק"
        lastHAngle = null
        diag { copy(state = "מנותק") }
    }

    /** חיבור-אוטומטי: ניסיון 10ש' כל 30ש', עד 3 דק' — ואז עצירה + התראה (חיסכון בסוללה) */
    private fun startAutoReconnect() {
        if (autoJob?.isActive == true) return
        // הגדרה: אם המשתמש כיבה חיבור-מחדש אוטומטי — לא מנסים שוב (חוסך סוללה)
        if (!il.co.soline.measure.data.Prefs.autoReconnectLaser) { _status.value = "מנותק"; return }
        val addr = targetAddress ?: return
        autoJob = scope.launch {
            val deadline = System.currentTimeMillis() + 3 * 60 * 1000
            while (System.currentTimeMillis() < deadline && targetAddress != null && !userDisconnect) {
                _status.value = "מנסה להתחבר למכשיר…"
                doConnect(addr)
                delay(10_000)
                if (_connected.value != null) return@launch
                try { gatt?.close() } catch (_: Exception) {}
                gatt = null
                _status.value = "ממתין לניסיון הבא (חיסכון בסוללה)…"
                delay(20_000)
            }
            if (_connected.value == null && !userDisconnect) {
                _status.value = "הופסק — ממתין שתחבר את המכשיר ידנית"
                postWaitingNotification()
            }
        }
    }

    private fun postWaitingNotification() {
        try {
            val nm = context.getSystemService(NotificationManager::class.java) ?: return
            val chId = "soline_laser"
            val ch = NotificationChannel(chId, "מד-לייזר", NotificationManager.IMPORTANCE_HIGH)
            nm.createNotificationChannel(ch)
            val n = Notification.Builder(context, chId)
                .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
                .setContentTitle("soline — מד-הלייזר מנותק")
                .setContentText("הפסקתי לנסות להתחבר לחיסכון בסוללה. פתח 'מכשירים' כדי לחבר.")
                .setAutoCancel(true)
                .build()
            nm.notify(1001, n)
        } catch (_: Exception) {}
    }

    private fun enqueue(r: Runnable) {
        writeQueue.addLast(r)
        if (!busy) next()
    }
    private fun next() {
        val r = writeQueue.removeFirstOrNull()
        if (r == null) { busy = false; return }
        busy = true
        r.run()
    }

    @Suppress("DEPRECATION")
    private val gattCb = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, statusCode: Int, newState: Int) {
            log("connState status=$statusCode newState=$newState")
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                autoJob?.cancel()
                _status.value = "מחובר — מגלה שירותים…"
                diag { copy(state = "מחובר — מגלה שירותים…") }
                // עדיפות-חיבור גבוהה (מרווח-חיבור ~7.5ms במקום ~30–50ms כברירת-מחדל) —
                // מקצר משמעותית את זמן-ההגעה של פריים-המדידה מרגע לחיצת-הכפתור במכשיר
                // ועד ההזרקה לשדה. one-shot בזמן-החיבור; לא משפיע על הפענוח/החוזה.
                try { g.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH) } catch (_: Exception) {}
                g.discoverServices()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                _connected.value = null
                stopHAnglePoll()
                diag { copy(state = "מנותק") }
                try { g.close() } catch (_: Exception) {}
                if (!userDisconnect && targetAddress != null) startAutoReconnect()
                else _status.value = "מנותק"
            }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, statusCode: Int) {
            log("servicesDiscovered status=$statusCode: " + g.services.joinToString { it.uuid.toString() })
            val leicaMeas = findChar(g, LEICA_MEAS)
            val leicaD2 = findChar(g, LEICA_D2_MEAS)
            val boschMeas = findChar(g, BOSCH_MEAS)
            hAngleChar = findChar(g, LEICA_HANGLE)
            val dstCmd = findChar(g, LEICA_DST_CMD)   // פקודת-הפעלת-DST-360 (X6+DST)
            log("leicaMeas=${leicaMeas != null} leicaD2=${leicaD2 != null} boschMeas=${boschMeas != null} hAngle=${hAngleChar != null}")
            diag {
                copy(
                    servicesFound = g.services.size,
                    leicaFound = leicaMeas != null || leicaD2 != null,
                    boschFound = boschMeas != null,
                    hAngleCharFound = hAngleChar != null,
                    deviceName = g.device.name ?: g.device.address,
                )
            }
            when {
                leicaMeas != null || leicaD2 != null -> {
                    _connected.value = g.device.name ?: g.device.address
                    _status.value = "מחובר ל-Leica — מפעיל נתונים"
                    diag { copy(state = "מחובר ל-Leica — מפעיל נתונים") }
                    for (s in g.services) for (c in s.characteristics) log("  char ${c.uuid} props=0x%02X".format(c.properties))
                    // מדליקים notify/indicate על כל ה-characteristics כדי ללכוד את ערוץ-המדידה
                    enableAllNotifyIndicate(g)
                    // הפעלת-DST-360 תוכנתית: כתיבת "raiseEvent 100\r\n" ל-3ab10120 מפעילה
                    // את מצב-ה-P2P — אחרת האזימוט נשאר אפס. נשלח אחרי ה-CCCD (התור מסדֵּר).
                    if (dstCmd != null) enqueue {
                        @Suppress("DEPRECATION")
                        run {
                            dstCmd.value = DST_ACTIVATE_CMD
                            val ok = try { g.writeCharacteristic(dstCmd) } catch (_: Exception) { false }
                            log("DST activate write ok=$ok")
                            if (!ok) next()
                        }
                    }
                    // הזווית-האופקית (DST 360-X · 3ab1010f) היא read/poll — לא notify. סוקרים אותה
                    // **רק כשמסך-P2P פעיל** (מחוץ ל-P2P ה-poll מחזיר אפסים, מציף ומחניק את notify-המרחק).
                    if (p2pActive) startHAnglePoll(g)
                }
                boschMeas != null -> {
                    _connected.value = g.device.name ?: g.device.address
                    _status.value = "מחובר ל-Bosch — מפעיל נתונים"
                    diag { copy(state = "מחובר ל-Bosch — מפעיל נתונים") }
                    enableNotify(g, boschMeas, ENABLE_INDICATE)
                    enqueue { // אחרי הפעלת-INDICATION — פקודת-ההפעלה
                        boschMeas.value = BOSCH_CMD
                        g.writeCharacteristic(boschMeas)
                    }
                }
                else -> { _status.value = "מחובר — לא זוהה מד-לייזר מוכר"; diag { copy(state = "מחובר — לא זוהה מד-לייזר מוכר") } }
            }
        }

        override fun onDescriptorWrite(g: BluetoothGatt, d: BluetoothGattDescriptor, statusCode: Int) {
            log("descriptorWrite ${d.uuid} status=$statusCode")
            if (d.uuid == CCCD && statusCode == BluetoothGatt.GATT_SUCCESS) {
                diag { copy(notifyEnabledCount = notifyEnabledCount + 1) }
            }
            next()
        }
        override fun onCharacteristicWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, statusCode: Int) { next() }

        // תשובת-קריאה (poll של הזווית-האופקית · 3ab1010f) — pre-33 מוסר את c.value
        @Suppress("DEPRECATION")
        override fun onCharacteristicRead(g: BluetoothGatt, c: BluetoothGattCharacteristic, statusCode: Int) {
            handleFrame(c.uuid, c.value ?: ByteArray(0))
            next()
        }
        // API 33+
        override fun onCharacteristicRead(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray, statusCode: Int) {
            handleFrame(c.uuid, value)
            next()
        }

        // API 33+
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray) =
            handleFrame(c.uuid, value)
        // pre-33
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic) =
            handleFrame(c.uuid, c.value ?: ByteArray(0))
    }

    private fun findChar(g: BluetoothGatt, uuid: UUID): BluetoothGattCharacteristic? {
        for (s in g.services) for (c in s.characteristics) if (c.uuid == uuid) return c
        return null
    }

    /** מדליק notify/indicate על כל ה-characteristics הלא-סטנדרטיים — לכידת ערוץ-המדידה */
    @Suppress("DEPRECATION")
    private fun enableAllNotifyIndicate(g: BluetoothGatt) {
        val subscribed = ArrayList<String>()
        for (s in g.services) {
            val su = s.uuid.toString()
            if (su.startsWith("00001800") || su.startsWith("00001801") ||
                su.startsWith("0000180a") || su.startsWith("00001812")) continue
            for (c in s.characteristics) {
                val p = c.properties
                val v = when {
                    (p and 0x10) != 0 -> ENABLE_NOTIFY
                    (p and 0x20) != 0 -> ENABLE_INDICATE
                    else -> null
                } ?: continue
                g.setCharacteristicNotification(c, true)
                val cccd = c.getDescriptor(CCCD) ?: continue
                subscribed.add(shortUuid(c.uuid))
                enqueue {
                    cccd.value = v
                    g.writeDescriptor(cccd)
                    log("enable ${c.uuid} cccd=${v.joinToString("") { "%02X".format(it) }}")
                }
            }
        }
        diag { copy(subscribedChars = subscribed) }
    }

    @Suppress("DEPRECATION")
    private fun enableNotify(g: BluetoothGatt, c: BluetoothGattCharacteristic, cccdValue: ByteArray) {
        g.setCharacteristicNotification(c, true)
        val cccd = c.getDescriptor(CCCD) ?: return
        diag { copy(subscribedChars = subscribedChars + shortUuid(c.uuid)) }
        enqueue {
            cccd.value = cccdValue
            g.writeDescriptor(cccd)
        }
    }

    /** מפעיל סקירה-מחזורית של הזווית-האופקית (DST 360-X · read/poll). */
    @Suppress("DEPRECATION")
    private fun startHAnglePoll(g: BluetoothGatt) {
        stopHAnglePoll()
        val c = hAngleChar ?: return           // אין DST 360-X → אין מה לסקור
        hAngleJob = scope.launch {
            // המתנה קצרה לריקון תור-ה-CCCD (מונע התנגשות עם כתיבות-ה-descriptor)
            delay(600)
            while (isActive && _connected.value != null && p2pActive) {
                enqueue {
                    val ok = try { g.readCharacteristic(c) } catch (_: Exception) { false }
                    if (!ok) next()            // כדי שהתור לא-ייתקע אם ה-read נדחה
                }
                delay(HANGLE_POLL_MS)
            }
        }
    }

    private fun stopHAnglePoll() {
        hAngleJob?.cancel()
        hAngleJob = null
    }

    /**
     * מסך-P2P מדליק/מכבה את סקירת-הזווית-האופקית. מחוץ ל-P2P אין poll — כדי לא-להציף את
     * החיבור ולא-להחניק את notify-המרחק (הבאג של "מדדתי ולא-הגיע מרחק"). קריאה אידמפוטנטית.
     */
    fun setP2pActive(active: Boolean) {
        if (p2pActive == active) return
        p2pActive = active
        val g = gatt
        if (active && g != null && hAngleChar != null) startHAnglePoll(g) else stopHAnglePoll()
    }

    private fun handleFrame(uuid: UUID, bytes: ByteArray) {
        val hex = bytes.joinToString(" ") { "%02X".format(it) }
        log("charChanged $uuid (${bytes.size}B): $hex")
        // אבחון: רושמים כל פריים-נכנס **לפני** סינון-ה-UUID — כך גם ערוץ לא-צפוי נראה.
        recordFrame(uuid, bytes, hex)
        // זווית-אופקית מ-DST 360-X: בייטים 0-3 = float32 LE ברדיאנים. נשמרת ומצורפת
        // למדידה הבאה (הפריים מגיע רגע לפני פריים-המרחק). לא פולט Reading בעצמו.
        if (uuid == LEICA_HANGLE) { updateHAngle(bytes); return }
        val reading = when (uuid) {
            LEICA_MEAS -> parseLeica(bytes, hex)
            LEICA_D2_MEAS -> parseLeicaD2(bytes, hex)
            BOSCH_MEAS -> parseBosch(bytes, hex)
            else -> return   // characteristics אחרים שהודלקו — לא ערוץ-מדידה
        } ?: return
        beep()
        _lastReading.value = reading
        _readings.value = (listOf(reading) + _readings.value).take(50)
        diag {
            copy(
                parsedCount = parsedCount + 1,
                lastDistanceMm = reading.distanceMm,
                lastVAngleDeg = reading.vAngleDeg,
                lastHAngleDeg = reading.hAngleDeg ?: lastHAngleDeg,
            )
        }
    }

    /** רישום פריים-גולמי ל-Diag (כל characteristic) — מונע "בלאק-בוקס" של הזרם. */
    private fun recordFrame(uuid: UUID, bytes: ByteArray, hex: String) {
        val tail = shortUuid(uuid)
        val line = "$tail ${bytes.size}B: $hex"
        diag {
            copy(
                frameCount = frameCount + 1,
                lastFrameUuid = tail,
                lastFrameHex = hex,
                lastFrameSize = bytes.size,
                lastFrameTs = now(),
                recentFrames = (listOf(line) + recentFrames).take(14),
            )
        }
    }

    /** פענוח הזווית-האופקית (DST 360-X): בייטים 0-3 = float32 LE ברדיאנים → מעלות. */
    private fun updateHAngle(b: ByteArray) {
        if (b.size < 4) return
        val az = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN).getFloat(0)
        if (az.isFinite()) {
            lastHAngle = Math.toDegrees(az.toDouble())
            diag { copy(hAnglePollCount = hAnglePollCount + 1, lastHAngleDeg = lastHAngle) }
        }
    }

    private fun parseLeica(b: ByteArray, hex: String): Reading? {
        if (b.size < 20) return Reading("Leica (חלקי)", null, null, hex, now())
        val bb = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN)
        val distM = bb.getFloat(0)
        val vAngleRad = bb.getFloat(4)
        val counter = b[18].toInt() and 0xFF   // המונה בבייט 18 (16-17 = 00, 19 = סמן C0)
        if (counter == lastCounter) return null // dedup
        lastCounter = counter
        val distMm = if (distM.isFinite()) (distM * 1000.0) else null
        val vDeg = if (vAngleRad.isFinite()) Math.toDegrees(vAngleRad.toDouble()) else null
        // מצרפים את הזווית-האופקית האחרונה (DST 360-X) → XYZ מלא
        return Reading("Leica DISTO", distMm, vDeg, hex, now(), hAngleDeg = lastHAngle)
    }

    /** Leica DISTO D2 — float32 LE יחיד (מטר) על 3ab10101; 2D, בלי זווית/מונה */
    private fun parseLeicaD2(b: ByteArray, hex: String): Reading? {
        if (b.size < 4) return null
        val m = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN).getFloat(0)
        if (!m.isFinite() || m <= 0f) return null
        val mm = m * 1000.0
        if (kotlin.math.abs(mm - lastD2Mm) < 0.5) return null   // dedup ערך-זהה
        lastD2Mm = mm
        return Reading("Leica D2", mm, null, hex, now())
    }

    private fun parseBosch(b: ByteArray, hex: String): Reading? {
        // מבנה שפוענח חי: C0 55 10 [type] [f] [counter] 00 [float32 LE מטר @7] ...
        if (b.size < 11) return null                       // handshake/heartbeat
        if ((b[3].toInt() and 0xFF) != 0x06) return null   // רק פריים-מדידה (06); 02 = מעקב/סטטוס
        val counter = b[5].toInt() and 0xFF
        if (counter == lastCounter) return null            // dedup
        lastCounter = counter
        val meters = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN).getFloat(7)
        if (!meters.isFinite() || meters <= 0f) return null
        return Reading("Bosch GLM", meters * 1000.0, null, hex, now())
    }

    private fun beep() {
        if (!il.co.soline.measure.data.Prefs.soundOnCapture) return   // הגדרה: סאונד-בקליטה
        try {
            if (tone == null) tone = ToneGenerator(AudioManager.STREAM_MUSIC, 80)
            tone?.startTone(ToneGenerator.TONE_PROP_BEEP, 90)
        } catch (_: Exception) {}
    }

    private fun now() = System.currentTimeMillis()
    private fun log(m: String) = android.util.Log.d("SolineBle", m)

    fun release() {
        disconnect()
        try { tone?.release() } catch (_: Exception) {}
        tone = null
    }
}
