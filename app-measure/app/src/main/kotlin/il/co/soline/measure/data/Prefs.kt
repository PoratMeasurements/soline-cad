package il.co.soline.measure.data

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf

/**
 * Prefs — מחזיק ההעדפות של המשתמש (מודד) עבור Soline Measure.
 *
 * גישת-האחסון: [SharedPreferences] של אנדרואיד (offline-first, מקומי לגמרי; בלי DataStore, בלי תלות חדשה).
 * גישת-התצוגה: כל ערך נחשף גם כ-[State] מבוסס-`mutableStateOf`, כך שכל Composable שקורא אותו
 * (מסך-ההגדרות עצמו, וגם מסכים אחרים) מתעדכן (recompose) אוטומטית ברגע שהערך משתנה.
 *
 * שימוש:
 *   Prefs.init(context)                       // פעם אחת, ב-SolineApp.onCreate (או lazy דרך ensureInit)
 *   val h = Prefs.defaultWallHeightMm         // קריאה חד-פעמית
 *   val h by Prefs.defaultWallHeightMmState   // קריאה תגובתית בתוך Composable
 *   Prefs.defaultWallHeightMm = 2800.0        // כתיבה — נשמרת מיד לדיסק וגם מרעננת את ה-State
 *
 * הערה על-תפקיד: העדפות אלה מתאימות ל**מודד** (surveyor) — פרטי-מודד, ברירות-מחדל למדידה,
 * התנהגות המכשיר וסוג-העבודה. אין כאן שום הגדרת-מערכת/ניהול (אלה שמורות למנהל בלבד).
 */
object Prefs {

    private const val FILE = "soline_prefs"

    // מפתחות-אחסון (נשמרים יציבים — אל תשנה מחרוזות אלה כדי לא לאבד ערכים קיימים)
    private const val K_SURVEYOR_NAME = "surveyorName"
    private const val K_UNITS = "units"
    private const val K_WALL_HEIGHT = "defaultWallHeightMm"
    private const val K_ANGLE_LOCK = "angleLockDefault"
    private const val K_SOUND = "soundOnCapture"
    private const val K_AUTO_RECONNECT = "autoReconnectLaser"
    private const val K_KEEP_SCREEN_ON = "keepScreenOn"
    private const val K_JOB_TYPE = "defaultJobType"
    // שיתוף-מיקום-בהסכמה (privacy-by-design): הסכמה מפורשת + מתג-הפעלה.
    private const val K_CONSENT_GIVEN = "locConsentGiven"
    private const val K_CONSENT_TS = "locConsentTs"
    private const val K_SHARING_ACTIVE = "locSharingActive"

    private lateinit var sp: SharedPreferences

    /** יחידות-תצוגה (תצוגה בלבד — אינן משנות את יחידות-האחסון הפנימיות, שהן תמיד מ"מ). */
    enum class Units(val label: String) {
        MM("מ\"מ"),
        CM("ס\"מ");

        companion object {
            fun fromName(name: String?): Units =
                entries.firstOrNull { it.name == name } ?: MM
        }
    }

    /** סוגי-עבודה אפשריים כברירת-מחדל (מוצגים כרשימה נפתחת במסך-ההגדרות). */
    val jobTypes = listOf("מטבח", "ארונות", "אמבטיה", "כללי")

    // ---- backing state (מקור-האמת התגובתי; מסונכרן תמיד עם SharedPreferences) ----
    private val _surveyorName = mutableStateOf("")
    private val _units = mutableStateOf(Units.MM)
    private val _defaultWallHeightMm = mutableStateOf(2700.0)
    private val _angleLockDefault = mutableStateOf(true)
    private val _soundOnCapture = mutableStateOf(true)
    private val _autoReconnectLaser = mutableStateOf(true)
    private val _keepScreenOn = mutableStateOf(true)
    private val _defaultJobType = mutableStateOf("כללי")
    private val _locConsentGiven = mutableStateOf(false)
    private val _locConsentTs = mutableStateOf(0L)
    private val _locSharingActive = mutableStateOf(false)

    /**
     * אתחול — טוען את הערכים השמורים אל ה-State. יש לקרוא פעם אחת (בדרך-כלל מ-SolineApp.onCreate).
     * בטוח לקריאה חוזרת. אם לא אותחל במפורש, [ensureInit] יטפל בכך דרך SolineApp.instance.
     */
    fun init(context: Context) {
        if (::sp.isInitialized) return
        sp = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)
        _surveyorName.value = sp.getString(K_SURVEYOR_NAME, "") ?: ""
        _units.value = Units.fromName(sp.getString(K_UNITS, Units.MM.name))
        _defaultWallHeightMm.value = sp.getFloat(K_WALL_HEIGHT, 2700f).toDouble()
        _angleLockDefault.value = sp.getBoolean(K_ANGLE_LOCK, true)
        _soundOnCapture.value = sp.getBoolean(K_SOUND, true)
        _autoReconnectLaser.value = sp.getBoolean(K_AUTO_RECONNECT, true)
        _keepScreenOn.value = sp.getBoolean(K_KEEP_SCREEN_ON, true)
        _defaultJobType.value = sp.getString(K_JOB_TYPE, "כללי") ?: "כללי"
        _locConsentGiven.value = sp.getBoolean(K_CONSENT_GIVEN, false)
        _locConsentTs.value = sp.getLong(K_CONSENT_TS, 0L)
        _locSharingActive.value = sp.getBoolean(K_SHARING_ACTIVE, false)
    }

    /** אתחול-עצל בטוח — מבטיח ש-SharedPreferences זמין גם אם לא נקרא init במפורש. */
    private fun ensureInit() {
        if (!::sp.isInitialized) init(SolineApp.instance)
    }

    // ---- surveyorName: שם-המודד (String) ----
    val surveyorNameState: State<String> get() = _surveyorName
    var surveyorName: String
        get() { ensureInit(); return _surveyorName.value }
        set(v) { ensureInit(); _surveyorName.value = v; sp.edit().putString(K_SURVEYOR_NAME, v).apply() }

    // ---- units: יחידות-תצוגה (enum, תצוגה בלבד) ----
    val unitsState: State<Units> get() = _units
    var units: Units
        get() { ensureInit(); return _units.value }
        set(v) { ensureInit(); _units.value = v; sp.edit().putString(K_UNITS, v.name).apply() }

    // ---- defaultWallHeightMm: גובה-קיר ברירת-מחדל במ"מ (Double, ברירת-מחדל 2700) ----
    val defaultWallHeightMmState: State<Double> get() = _defaultWallHeightMm
    var defaultWallHeightMm: Double
        get() { ensureInit(); return _defaultWallHeightMm.value }
        set(v) { ensureInit(); _defaultWallHeightMm.value = v; sp.edit().putFloat(K_WALL_HEIGHT, v.toFloat()).apply() }

    // ---- angleLockDefault: נעילת-זווית ל-90° כברירת-מחדל (Boolean, ברירת-מחדל true) ----
    val angleLockDefaultState: State<Boolean> get() = _angleLockDefault
    var angleLockDefault: Boolean
        get() { ensureInit(); return _angleLockDefault.value }
        set(v) { ensureInit(); _angleLockDefault.value = v; sp.edit().putBoolean(K_ANGLE_LOCK, v).apply() }

    // ---- soundOnCapture: סאונד-חיווי בקליטת-נקודה (Boolean, ברירת-מחדל true) ----
    val soundOnCaptureState: State<Boolean> get() = _soundOnCapture
    var soundOnCapture: Boolean
        get() { ensureInit(); return _soundOnCapture.value }
        set(v) { ensureInit(); _soundOnCapture.value = v; sp.edit().putBoolean(K_SOUND, v).apply() }

    // ---- autoReconnectLaser: התחברות-מחדש אוטומטית למד-הלייזר (Boolean, ברירת-מחדל true) ----
    val autoReconnectLaserState: State<Boolean> get() = _autoReconnectLaser
    var autoReconnectLaser: Boolean
        get() { ensureInit(); return _autoReconnectLaser.value }
        set(v) { ensureInit(); _autoReconnectLaser.value = v; sp.edit().putBoolean(K_AUTO_RECONNECT, v).apply() }

    // ---- keepScreenOn: שמירת-מסך-דולק במהלך המדידה (Boolean, ברירת-מחדל true) ----
    val keepScreenOnState: State<Boolean> get() = _keepScreenOn
    var keepScreenOn: Boolean
        get() { ensureInit(); return _keepScreenOn.value }
        set(v) { ensureInit(); _keepScreenOn.value = v; sp.edit().putBoolean(K_KEEP_SCREEN_ON, v).apply() }

    // ---- defaultJobType: סוג-עבודה ברירת-מחדל (String מתוך [jobTypes]) ----
    val defaultJobTypeState: State<String> get() = _defaultJobType
    var defaultJobType: String
        get() { ensureInit(); return _defaultJobType.value }
        set(v) { ensureInit(); _defaultJobType.value = v; sp.edit().putString(K_JOB_TYPE, v).apply() }

    /* ─────────────────────────────────────────────────────────────────────────
     * שיתוף-מיקום-בהסכמה (privacy-by-design)
     * ─────────────────────────────────────────────────────────────────────────
     * העיקרון: אין איסוף-מיקום בלי OPT-IN מפורש. שלושת הדגלים הבאים הם השער-
     * היחיד ל-OpsMetricsService/LocationTracker — בלעדיהם המנוע הוא no-op מוחלט
     * (לא נוגע במיקום, לא מבקש הרשאה, לא מפעיל Foreground-Service).
     *
     *  · [locConsentGiven] — המודד אישר במסך-ההסכמה (LocationConsentScreen) לפחות פעם-אחת.
     *  · [locConsentTs]    — חותמת-זמן-ההסכמה (לתיעוד/הצגה למודד).
     *  · [locSharingActive]— מתג ההפעלה בפועל (במסך-ההגדרות): כבוי = אין-איסוף
     *                        אף שההסכמה קיימת. "בטל הסכמה" מאפס את שלושתם.
     *
     * הבדיקה-המחייבת לפני כל איסוף: [locationSharingOn].
     */
    val locConsentGivenState: State<Boolean> get() = _locConsentGiven
    var locConsentGiven: Boolean
        get() { ensureInit(); return _locConsentGiven.value }
        set(v) { ensureInit(); _locConsentGiven.value = v; sp.edit().putBoolean(K_CONSENT_GIVEN, v).apply() }

    val locConsentTsState: State<Long> get() = _locConsentTs
    var locConsentTs: Long
        get() { ensureInit(); return _locConsentTs.value }
        set(v) { ensureInit(); _locConsentTs.value = v; sp.edit().putLong(K_CONSENT_TS, v).apply() }

    val locSharingActiveState: State<Boolean> get() = _locSharingActive
    var locSharingActive: Boolean
        get() { ensureInit(); return _locSharingActive.value }
        set(v) { ensureInit(); _locSharingActive.value = v; sp.edit().putBoolean(K_SHARING_ACTIVE, v).apply() }

    /** השער-היחיד לאיסוף-מיקום: הסכמה-קיימת **וגם** מתג-פעיל. */
    val locationSharingOn: Boolean
        get() { ensureInit(); return _locConsentGiven.value && _locSharingActive.value }

    /**
     * מתעד הסכמה מפורשת (נקרא מ-LocationConsentScreen לאחר "אני מאשר"):
     * מדליק consent + מתג-הפעלה + חותם-זמן. אינו מפעיל את השירות בעצמו —
     * המסך מפעיל אותו לאחר קבלת הרשאת-המיקום.
     */
    fun grantLocationConsent() {
        ensureInit()
        locConsentGiven = true
        locConsentTs = System.currentTimeMillis()
        locSharingActive = true
    }

    /**
     * מבטל הסכמה לחלוטין (נקרא מ"בטל הסכמה" בהגדרות): מכבה את שלושת הדגלים.
     * מחיקת-הדגימות-המקומיות + עצירת-השירות מתבצעות ע"י הקורא (Repo/Service).
     */
    fun revokeLocationConsent() {
        ensureInit()
        locSharingActive = false
        locConsentGiven = false
        locConsentTs = 0L
    }
}
