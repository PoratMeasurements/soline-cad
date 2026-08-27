package il.co.soline.measure.device

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

/*
 * שכבת ההפשטה של מכשירי הלייזר — Soline Measure (החלטות #5 / #26 / #27 / #28).
 * חוזה משותף אחד (LaserDevice) עם מימושים לכל מכשיר: Leica DISTO X6 (3D) ו-Bosch GLM 50C (2D).
 * הפרוטוקולים פוענחו מקצה-לקצה (docs/DISTO_PROTOCOL.md) — אין SDK חיצוני, הכול BLE סטנדרטי.
 * כל המרחקים במילימטרים, כל הזוויות ברדיאנים. לוגיקה טהורה מעל android.bluetooth.
 */

/** יכולות המכשיר — מאפשר ל-UI/מנוע להחליט אם אפשר לבנות 3D או רק אורך 2D. */
data class DeviceCapabilities(
    val is3D: Boolean,     // Leica + DST 360 = true ; Bosch = false
    val hasAngle: Boolean, // האם המכשיר משדר זווית אנכית כלשהי
)

/** מדידה גולמית שיצאה מהמכשיר — טרם עיבוד לנקודת-חדר.
 *  vAngleRad = null כאשר ה-DST 360 לא סובב (Infinity בפריים) → מדידת-מרחק בלבד.
 *  hAngleRad = null כשאין מתאם 3D (Bosch), או עד שנקרא ערך מ-3ab1010f. */
data class RawMeasurement(
    val distanceMm: Double,
    val vAngleRad: Double?,
    val hAngleRad: Double?,
    val counter: Int,
)

/** מצב החיבור של המכשיר — StateFlow כדי שה-UI יוכל לצייר סטטוס/סוללה. */
sealed class DeviceConnectionState {
    /** מנותק — לא מחובר ולא מנסה. */
    object Disconnected : DeviceConnectionState()
    /** בתהליך חיבור/גילוי שירותים/handshake. */
    object Connecting : DeviceConnectionState()
    /** מחובר ומוכן למדידה. batteryPercent = null אם המכשיר לא דיווח. */
    data class Connected(val batteryPercent: Int? = null) : DeviceConnectionState()
    /** שגיאה — עם הודעה לתצוגה. */
    data class Error(val message: String, val cause: Throwable? = null) : DeviceConnectionState()
}

/**
 * החוזה המשותף לכל מכשירי הלייזר.
 * מימוש אחד לכל דגם (LeicaDistoX6Device / BoschGlm50Device).
 */
interface LaserDevice {
    /** יכולות סטטיות של הדגם (3D? זווית?). */
    val capabilities: DeviceCapabilities

    /** מצב החיבור — לצפייה מה-UI. */
    val state: StateFlow<DeviceConnectionState>

    /** זרם המדידות הגולמיות. מדידות כפולות (אותו counter) כבר סוננו במימוש. */
    val measurements: Flow<RawMeasurement>

    /** התחל חיבור GATT + handshake. אי-חוסם (משגר קורוטינה/קולבקים). */
    fun connect()

    /** נתק וסגור את ה-GATT ושחרר משאבים. */
    fun disconnect()

    /** הפעל/כבה קליטת מדידות אקטיבית (P2P auto-capture) בלי לנתק. */
    fun setCaptureActive(active: Boolean)

    /** בטל את הנקודה האחרונה שנקלטה (undo-point — MICHAEL_WISHLIST §1). */
    fun undoLastPoint()
}

/**
 * וו לפידבק קולי בעת קליטת נקודה (MICHAEL_WISHLIST §7).
 * המימוש מנגן צליל קצר בכל מדידה חדשה תקפה; ה-UI מזריק מימוש אמיתי (SoundPool/ToneGenerator).
 * ברירת מחדל = שקט, כדי שהמימושים יקומפלו בלי תלות ב-Android UI.
 */
fun interface PointCaptureSound {
    fun onPointCaptured()

    companion object {
        /** אין צליל — ברירת מחדל בטוחה. */
        val Silent: PointCaptureSound = PointCaptureSound { }
    }
}
