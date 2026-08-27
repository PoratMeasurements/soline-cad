package il.co.soline.measure.data

import org.json.JSONObject

/* ─────────────────────────────────────────────────────────────────────────────
 *  RoomChecklist — רשימת-משימות-המדיה של המודד + שער-סגירת-חדר.
 *  מקור-האמת של החוקה (PHOTO_FEATURE_DESIGN §5). לוגיקה טהורה (בלי-Android) כדי
 *  שגם מסך-הסגירה (Compose) וגם ה-SolWriter (JVM) יגזרו את אותה-תמונת-מצב.
 *
 *  עיקרון: הספירה (satisfiedCount) **נגזרת-אוטומטית** מ-[PhotoEntity]/[VideoEntity]
 *  לפי-`kind`. מה שנשמר-בפועל בחדר הוא רק סיבות-הדילוג (`mediaSkips`) וחותמת-הסגירה
 *  (`closedAt`). שער-קשיח-עם-מוצא: חדר לא-נסגר עד שכל-קטגוריות-החובה בוצעו — אך כל
 *  קטגוריה ניתנת ל"דלג עם-סיבה" כדי לא-לתקוע מודד-בשטח.
 * ───────────────────────────────────────────────────────────────────────────── */
object RoomChecklist {

    /** מצב-לכידה של שורת-קטגוריה במסך-הסגירה. */
    enum class Capture { PHOTO, VIDEO, BOTH }

    /** הגדרת-קטגוריה סטטית (מפת-המשימות · §5.1). */
    data class Category(
        val key: String,
        val label: String,       // תווית-עברית
        val required: Boolean,   // ✔ חובה-לשער · ○ מומלץ
        val capture: Capture,    // איזה כפתור-לכידה מוצג בשורה
    )

    /**
     * מפת-המשימות פר-חדר (§5.1 מעודכן, תיקון-חוזה-הבעלים). הסדר הוא סדר-התצוגה
     * במסך-סגירת-החדר. שים-לב: **`access` (גישה-לאתר) ו-`explainer` (סרטון-הסבר)
     * אינם-כאן** — שניהם ברמת-הפרויקט, ראה [ProjectChecklist]. `explainer` הועבר
     * לרמת-הפרויקט ומותר לו כמה-סרטונים (אחד-או-יותר, בלי-שלב).
     */
    val CATEGORIES: List<Category> = listOf(
        Category("overview", "תמונות כלליות של החדר", required = true, capture = Capture.PHOTO),
        Category("elevation", "תמונה לכל חזית", required = true, capture = Capture.PHOTO),
        Category("detail_tape", "פרטים מיוחדים עם מטר פתוח", required = true, capture = Capture.PHOTO),
        Category("far", "תמונות רחוקות", required = false, capture = Capture.PHOTO),
        Category("closeup", "תקריבים", required = false, capture = Capture.PHOTO),
    )

    /** תמונות-חזית ותיקות נשמרו עם kind="context"; §5.4 ממפה elevation(=context). */
    private fun isElevationKind(k: String): Boolean = k == "elevation" || k == "context"

    /** הספירה-הנדרשת לקטגוריה, בהתחשב במספר-הקירות (elevation = 1 לכל-קיר). */
    fun requiredCount(key: String, wallCount: Int): Int = when (key) {
        "overview" -> 2
        "elevation" -> maxOf(1, wallCount)
        else -> 1
    }

    /**
     * הספירה-שבוצעה-בפועל, נגזרת מהמדיה. elevation נספר כמספר-הקירות שיש-להם
     * לפחות תמונת-חזית אחת (1 לכל-קיר). access סופר גם תמונות וגם סרטונים.
     */
    fun satisfiedCount(
        key: String,
        walls: List<WallEntity>,
        photos: List<PhotoEntity>,
        videos: List<VideoEntity>,
    ): Int = when (key) {
        "overview" -> photos.count { it.kind == "overview" }
        "elevation" -> walls.count { w -> photos.any { it.wallId == w.id && isElevationKind(it.kind) } }
        "detail_tape" -> photos.count { it.kind == "detail_tape" }
        "far" -> photos.count { it.kind == "far" }
        "closeup" -> photos.count { it.kind == "closeup" }
        else -> 0
    }

    /** תמונת-מצב של שורת-קטגוריה (נגזר + מצב-דילוג). */
    data class Status(
        val category: Category,
        val satisfiedCount: Int,
        val requiredCount: Int,
        val skippedReason: String?,   // null ⇒ לא-דולג
        val done: Boolean,            // בוצע (satisfied≥required) או דולג-עם-סיבה
    )

    /** גוזר את מצב-כל-הקטגוריות עבור חדר נתון. */
    fun statuses(
        walls: List<WallEntity>,
        photos: List<PhotoEntity>,
        videos: List<VideoEntity>,
        skips: Map<String, String>,
    ): List<Status> = CATEGORIES.map { c ->
        val req = requiredCount(c.key, walls.size)
        val sat = satisfiedCount(c.key, walls, photos, videos)
        val reason = skips[c.key]?.takeIf { it.isNotBlank() }
        Status(c, sat, req, reason, done = sat >= req || reason != null)
    }

    /** האם השער-פתוח: כל-קטגוריות-החובה בוצעו-או-דולגו (המומלצות לא-חוסמות). */
    fun gateOpen(statuses: List<Status>): Boolean =
        statuses.filter { it.category.required }.all { it.done }

    /** האם החדר "הושלם" — נסגר-בפועל (closedAt>0) או שהשער-פתוח. */
    fun isComplete(room: RoomEntity, statuses: List<Status>): Boolean =
        room.closedAt > 0 || gateOpen(statuses)

    // ── קידוד/פענוח מפת-הדילוגים (עמודת mediaSkips ב-JSON) ────────────────────────

    /** מפענח את `mediaSkips` (JSON) למפת category→reason. פורמט-שגוי/ריק ⇒ מפה-ריקה. */
    fun parseSkips(json: String): Map<String, String> {
        if (json.isBlank()) return emptyMap()
        return runCatching {
            val o = JSONObject(json)
            val m = HashMap<String, String>()
            for (k in o.keys()) o.optString(k).takeIf { it.isNotBlank() }?.let { m[k] = it }
            m
        }.getOrDefault(emptyMap())
    }

    /** מקודד מפת category→reason ל-JSON יציב (ריק ⇒ ""). */
    fun encodeSkips(skips: Map<String, String>): String {
        val clean = skips.filterValues { it.isNotBlank() }
        if (clean.isEmpty()) return ""
        val o = JSONObject()
        for ((k, v) in clean) o.put(k, v)
        return o.toString()
    }

    /** עדכון/הסרת סיבת-דילוג לקטגוריה בודדת, מחזיר את ה-JSON המעודכן להתמדה. */
    fun withSkip(currentJson: String, category: String, reason: String?): String {
        val m = HashMap(parseSkips(currentJson))
        if (reason.isNullOrBlank()) m.remove(category) else m[category] = reason
        return encodeSkips(m)
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  ProjectChecklist — שער-סגירת-הפרויקט (§5.1 מעודכן, תיקון-חוזה-הבעלים).
 *  מדיה-הגישה-לאתר (איך-מגיעים) נלכדת ברמת-הפרויקט בשני-שלבים: פתיחה + סגירה
 *  (scope="project", kind="access", phase="opening"|"closing"). בנוסף, **סרטון-ההסבר
 *  על-העבודה** (kind="explainer") הועבר לרמת-הפרויקט — בלי-שלב (phase="") ומותר-לו
 *  כמה-סרטונים (אחד-או-יותר). שער-סגירת-הפרויקט נפתח כאשר: (א) גישת-פתיחה בוצעה,
 *  (ב) גישת-סגירה בוצעה, (ג) **לפחות סרטון-הסבר אחד** קיים, **וגם** (ד) כל-חדרי-
 *  הפרויקט במצב "הושלם". תמונות **וגם** סרטונים נספרים לגישה; ההסבר סרטונים בלבד.
 * ───────────────────────────────────────────────────────────────────────────── */
object ProjectChecklist {

    /** שלב-גישה (פתיחה/סגירה) — מפתח, תווית-עברית וערך-ה-phase המאוחסן. */
    data class AccessItem(val key: String, val label: String, val phase: String)

    val ACCESS_ITEMS: List<AccessItem> = listOf(
        AccessItem("access_opening", "גישה לאתר — פתיחת הפרויקט", "opening"),
        AccessItem("access_closing", "גישה לאתר — סגירת הפרויקט", "closing"),
    )

    /** kind-ההסבר ברמת-הפרויקט + תווית-עברית לשורת-מסך-הסגירה. */
    const val EXPLAINER_KIND = "explainer"
    const val EXPLAINER_LABEL = "סרטון הסבר על העבודה"

    /** כמה פריטי-גישה (תמונות+סרטונים) קיימים לשלב נתון. */
    fun accessCount(phase: String, photos: List<PhotoEntity>, videos: List<VideoEntity>): Int =
        photos.count { it.scope == "project" && it.kind == "access" && it.phase == phase } +
            videos.count { it.scope == "project" && it.kind == "access" && it.phase == phase }

    data class AccessStatus(val item: AccessItem, val count: Int, val done: Boolean)

    fun accessStatuses(photos: List<PhotoEntity>, videos: List<VideoEntity>): List<AccessStatus> =
        ACCESS_ITEMS.map { it -> AccessStatus(it, accessCount(it.phase, photos, videos), accessCount(it.phase, photos, videos) >= 1) }

    /**
     * כמה סרטוני-הסבר (scope="project", kind="explainer") קיימים בפרויקט. אין-שלב
     * (phase) — סופרים את-כולם. השער נפתח כבר ב-count≥1, בלי-קאפ-עליון (אחד-או-יותר).
     */
    fun explainerCount(videos: List<VideoEntity>): Int =
        videos.count { it.scope == "project" && it.kind == EXPLAINER_KIND }

    data class ExplainerStatus(val count: Int, val done: Boolean)

    /** תמונת-מצב-ההסבר — done כאשר יש לפחות סרטון-הסבר אחד. */
    fun explainerStatus(videos: List<VideoEntity>): ExplainerStatus =
        explainerCount(videos).let { ExplainerStatus(it, it >= 1) }

    /**
     * האם שער-הפרויקט-פתוח: שתי-הגישות בוצעו, לפחות סרטון-הסבר אחד קיים,
     * וגם כל-החדרים-הושלמו.
     */
    fun gateOpen(
        accessStatuses: List<AccessStatus>,
        explainerStatus: ExplainerStatus,
        allRoomsComplete: Boolean,
    ): Boolean =
        accessStatuses.all { it.done } && explainerStatus.done && allRoomsComplete
}
