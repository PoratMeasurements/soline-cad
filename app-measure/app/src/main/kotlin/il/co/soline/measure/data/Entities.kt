package il.co.soline.measure.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/* מודל-הנתונים של Soline Measure — פרויקט → חדר → קיר → בליטה.
 * offline-first (Room), החלטה #15. גל-1: מבנה בסיסי; יורחב לקיר-כפרופיל (#12). */

@Entity(tableName = "projects")
data class Project(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val client: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    /** מועד-הייצוא האחרון ל-.sol (epoch millis). 0 = טרם-יוצא. מיגרציה 5→6. */
    val lastExportedAt: Long = 0,
    /**
     * חותמת-סגירת-הפרויקט (epoch millis). null = לא-נסגר-עדיין. שער-סגירת-הפרויקט
     * מציב ערך זה רק לאחר שהגישה-לאתר + הסבר + כל-החדרים הושלמו (מקביל ל-[RoomEntity.closedAt]
     * לחדר). nullable ⇒ מיגרציה 16→17 ALTER-בלבד, ללא-דריסת-נתונים קיימים.
     */
    val closedAt: Long? = null,
)

/**
 * מדדי-פרויקט מצטברים (לא-ישות — תוצאת-שאילתה בלבד) למסך-ניהול-המדידות:
 * כמה חדרים/קירות/בליטות נמדדו בפרויקט. מאפשר לגזור סטטוס-מדידה בלי לשמור
 * שדה-סטטוס נוסף על הפרויקט.
 */
data class ProjectStat(
    val projectId: Long,
    val rooms: Int,
    val walls: Int,
    val accessories: Int,
)

@Entity(
    tableName = "rooms",
    foreignKeys = [
        ForeignKey(
            entity = Project::class,
            parentColumns = ["id"],
            childColumns = ["projectId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("projectId")],
)
data class RoomEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val projectId: Long,
    val name: String,
    // ── שדות-מודד ברמת-החדר (נקבעים בתחילת-המדידה) — מיגרציה 8→9 ─────────────────
    /**
     * כיוון-הכניסה האמיתי של החדר — נקבע ע"י המודד בתחילת-המדידה (שדה-עדיפות).
     * Bearing במעלות: 0 = מעלה/צפון-התכנית, עולה עם-כיוון-השעון (0..360). -1 = לא-הוגדר.
     * הדוח מצייר חץ-כניסה מתוך הערך הזה.
     */
    val entranceBearingDeg: Double = -1.0,
    /** חלופה/משלים ל-bearing: הכניסה על קיר-זה (idx של הקיר). -1 = ללא-שיוך-קיר. */
    val entranceWallIdx: Int = -1,
    /**
     * טקסט-חופשי: "היכן הכניסה ביחס לחזית-הראשית" — תיאור-מודד מילולי המשלים את
     * חוגת-כיוון-החץ (מיגרציה 18→19). ריק = לא-הוזן. תוספתי; הדוח/הייצוא ממשיכים
     * להסתמך על [entranceBearingDeg] לחץ-הכניסה.
     */
    val entranceRelation: String = "",
    /**
     * טקסט-חופשי: "מהיכן אתה מסתכל" — נקודת-המבט של המודד בעת קביעת-כיוון-הכניסה
     * (מיגרציה 18→19). ריק = לא-הוזן. תוספתי.
     */
    val entranceVantage: String = "",
    /**
     * מערך גבהי-התקרה שהמודד מדד ברחבי-החדר בתחילת-המדידה (CSV מ"מ, למשל "2650,2700").
     * מאפשר לדוח להציג תקרה מינ' ומקס'; **הגובה-המחייב של החדר = המינימום**.
     */
    val heightSweepMm: String = "",
    /**
     * הערות-מודד על שינויי-קירות מתוכננים. פורמט-אחסון פנימי (מפרידי-בקרה):
     * רשומות מופרדות ב-U+001E, שדות ב-U+001F: `scope␟wallId␟text`.
     * scope = "wall" (עם wallId) | "room" (wallId=-1). ראה [RoomSurvey].
     */
    val futureChanges: String = "",
    // ── רשימת-משימות-מדיה + שער-סגירת-חדר (PHOTO_FEATURE_DESIGN §5) — מיגרציה 13→14 ─
    /**
     * מפת-דילוגים של רשימת-המדיה (שער-סגירת-חדר · §5.3): JSON‏ ‎{category: reason}‎.
     * קטגוריה שלה יש סיבת-דילוג נחשבת "בוצעה" בשער-הסגירה (מוצא-שדה: "דלג עם-סיבה").
     * ריק ⇒ אין-דילוגים. נשמר/נקרא דרך [RoomChecklist.parseSkips]/[RoomChecklist.encodeSkips].
     */
    val mediaSkips: String = "",
    /**
     * חותמת-סגירת-החדר (epoch millis). 0 = לא-נסגר-עדיין. שער-הסגירה מציב ערך זה רק
     * לאחר שכל-קטגוריות-החובה בוצעו-או-דולגו. מיגרציה 13→14.
     */
    val closedAt: Long = 0,
)

@Entity(
    tableName = "walls",
    foreignKeys = [
        ForeignKey(
            entity = RoomEntity::class,
            parentColumns = ["id"],
            childColumns = ["roomId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("roomId")],
)
data class WallEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val roomId: Long,
    val idx: Int,
    val length: Double,   // מ"מ
    val height: Double,   // מ"מ
    val angle: Double = 90.0, // מעלות — זווית לקיר הבא
    // מתאר-החזית (שיטה A) כ-JSON: [[u,v,e],...] מ"מ — u מיקום-אופקי, v גובה, e הגלייה.
    // 2-איברים [u,v] נשאר תקין (legacy → e=0). ראה WallProfileSolver / parseFramePoints.
    val framePointsJson: String = "",
    /**
     * פרופיל-הקיר המורחב (מיגרציה 11→12): מטא-נתוני-מסגור + נקודות-מבט-על לשיטה B (בטן).
     * JSON: {"zeroH","zeroV","dir","flip","plan":[[x,y],...]}. ריק ⇒ ברירות-מחדל.
     * נפרד מ-framePointsJson: הראשון נושא מתאר-חזית (A), זה נושא מבט-על-בטן (B) + מסגור.
     */
    val wallProfileJson: String = "",
    // סגנון-ראש-קיר (CVSM #f-wall-topstyle) — נשמר פר-קיר.
    val headStyle: String = "STRAIGHT", // WallHeadProfile.HeadStyle.name
    val headRidgeMm: Double = 0.0,      // גובה-רכס מוחלט (מ"מ); 0 = שווה-לגובה-הבסיס
    val headPeakMm: Double = 0.0,       // מיקום-פסגה לאורך-הקיר (מ"מ, לגמלון בלבד)
    /**
     * האם מידת-הגובה נמדדה בפועל (מהלך-גבהים / עריכה-ידנית), או שהיא עדיין
     * ברירת-המחדל (Prefs.defaultWallHeightMm=2700). מיגרציה 9→10. מבדיל
     * "לא-נמדד" מ"defaulted" — שער-האיכות לא סופר 2700-שלא-נגעו-בו כ"נמדד".
     */
    val heightMeasured: Boolean = false,
    /**
     * גובה קו-הסימון / סופיט (הנמכת-תקרה) מהרצפה למ"מ — הדאטום שהנגר צריך לתכנון
     * ארונות-עליונים. null = לא-סומן קו-סופיט לקיר-הזה. מיגרציה 17→18 (ALTER-בלבד,
     * nullable ⇒ אפס-דריסת-נתונים). נלכד במסך-החזית (MarkerDialog) ומיוצא ל-.sol.
     */
    val soffitHeightMm: Double? = null,
)

/**
 * מיקום-שמאל אפקטיבי של אלמנט/פתח (מ"מ מהפינה השמאלית של הקיר), בהתחשב
 * בפינת-המדידה [AccessoryEntity.fromCorner]. זהו מקור-האמת היחיד לפריסה בתוך
 * האפליקציה (תוכנית 2D / תלת-מימד) — תואם בדיוק ל-`pos.fromCorner`+`offset`
 * שכותב ה-SolWriter לממיר. מדידה-מהפינה-הימנית (end) ⇒ שמאל = אורך − היסט − רוחב.
 */
fun AccessoryEntity.leftEdgeMm(wallLengthMm: Double): Double =
    if (fromCorner == "end") wallLengthMm - fromLeft - width else fromLeft

@Entity(
    tableName = "accessories",
    foreignKeys = [
        ForeignKey(
            entity = WallEntity::class,
            parentColumns = ["id"],
            childColumns = ["wallId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("wallId")],
)
data class AccessoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val wallId: Long,
    val type: String,     // SOCKET_SINGLE | GAS_PIPE | WATER_PIPE | WINDOW | DOOR | COLUMN | ...
    val name: String,
    val depth: Double,    // D — עומק-בליטה מהקיר (מ"מ)
    val fromLeft: Double, // מיקום אופקי משמאל-הקיר (מ"מ) = pos.offset בסכמת-הפתח
    val width: Double,    // מ"מ = geom.width
    val fromBottom: Double, // גובה תחתית מהרצפה (מ"מ)
    val height: Double,   // מ"מ = geom.height
    // ── שדות-פתח פרמטריים (OPENING_ELEMENT_SCHEMA.md) — מיגרציה 7→8 ─────────────
    // openingKind ריק ⇒ אלמנט רגיל (לא-פתח). אחרת: door | window | vent | ac.
    // כל שדה כאן הוא מידת-אמת שהמודד מזין (ברירת-מחדל-יצרן ממולאת-מראש בטופס).
    val openingKind: String = "",     // "" = לא-פתח
    val sillHeight: Double = -1.0,     // רצפה→סף (חלון/פתח-קיר); -1 = ללא (דלת)
    val wallThickness: Double = 0.0,   // עובי-הקיר המארח
    val frameThickness: Double = 0.0,  // ⭐ עובי-משקוף (דלת) / מסגרת (חלון)
    val frameReveal: Double = 0.0,     // רוחב-חשפה/מלבן
    val leafThickness: Double = 0.0,   // עובי-כנף (דלת)
    val openMode: String = "",         // hinged|sliding|folding|pocket|fixed|kip|awning|hung|double
    val hingeSide: String = "",        // L | R | "" (null)
    val swing: String = "",            // in | out | "" (null)
    val leafCount: Int = 1,
    val glazing: String = "",          // none | partial | full
    val fromCorner: String = "start",  // start | end — מאיזו פינה נמדד ה-offset
    /**
     * האם מידות-האביזר נמדדו בפועל (עריכת-שדה / הזרקת-לייזר), או שהן עדיין
     * ברירת-מחדל-הקטלוג (מידת-יצרן ממולאת-מראש). מיגרציה 14→15. מבדיל
     * "נמדד" מ"ניחוש-קטלוג" — בדיוק כמו [WallEntity.heightMeasured] לקירות:
     * שער-האיכות והנגר יודעים אילו מספרים נמדדו-באמת ואילו הם ברירת-מחדל.
     * false (ברירת-המחדל) = הבחירה הבטוחה/כנה לשורות-קיימות ולאלמנטים-שלא-נגעו-בהם.
     */
    val measured: Boolean = false,
    /**
     * הערת-מודד חופשית פר-אלמנט (תזרים-השדה §10 — "מכניס הערות בהתאם לאלמנט").
     * מה שהמודד רוצה שהנגר/המשרד ידעו על האלמנט הספציפי (חריגה, דרישה, אזהרה).
     * מיגרציה 19→20. '' = ללא-הערה (ברירת-המחדל הבטוחה לשורות-קיימות).
     */
    val notes: String = "",
)

/**
 * תמונת-שדה שהמודד צילם במהלך-המדידה (פיצ'ר-תמונות · PHOTO_FEATURE_DESIGN §2).
 * כל תמונה משויכת לחדר, ואופציונלית לקיר/חזית (scope="wall") — או ברמת-החדר
 * (scope="room", `wallId=null`) או מוצמדת-לאלמנט (scope="element", `elementId` מלא).
 *
 *  · `seq`      — מספר-עוקב **בתוך אותה-חזית** (מתאפס לכל קיר) → שם-הקובץ.
 *  · `kind`     — סוג-התמונה לגלריה: context|detail|obstacle|junction|ceiling|floor|overview.
 *  · `fileName` — שם-הקובץ לפי-החוזה: `חזית-{wallIdx+1}_{NN}.jpg` (חדר → `חדר_{NN}.jpg`).
 *  · `absPath`  — נתיב-מוחלט מקומי (filesDir/photos/…); ה-SolWriter קורא ממנו את הבייטים.
 *  · `w`/`h`    — פיקסלים (לגלריה); `bytes` — גודל-הקובץ.
 *
 * FK-כפול (חדר + קיר) עם מחיקת-cascade ואינדקסים — בדיוק כמו [CabinetEntity]:
 * מחיקת-חדר/קיר מסירה את תמונותיו. `wallId` nullable ⇒ FK מותר-null (SQLite לא-אוכף null).
 *
 * **מדיה-ברמת-הפרויקט (§5.1 מעודכן):** תמונות-גישה-לאתר נלכדות ברמת-הפרויקט —
 * `scope="project"`, `roomId=null`, `projectId` מלא, ו-`phase` = "opening"|"closing"
 * (פתיחת/סגירת-פרויקט). לכן `roomId` **nullable** (מיגרציה 13→14 בנתה-מחדש את הטבלה).
 */
@Entity(
    tableName = "photos",
    foreignKeys = [
        ForeignKey(
            entity = RoomEntity::class,
            parentColumns = ["id"],
            childColumns = ["roomId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = WallEntity::class,
            parentColumns = ["id"],
            childColumns = ["wallId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("roomId"), Index("wallId")],
)
data class PhotoEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val projectId: Long = 0,         // מדיה-פרויקט (scope="project") נושאת אותו; אחרת נגזר-מהחדר
    val roomId: Long? = null,        // null ⇒ מדיה-ברמת-הפרויקט (scope="project")
    val wallId: Long? = null,        // null ⇒ תמונת-חדר (scope="room")
    val seq: Int,                    // מספר-עוקב בתוך-החזית (מתאפס לכל קיר)
    val scope: String = "wall",      // wall | room | element | project
    val phase: String = "",          // scope="project" ⇒ opening | closing (אחרת ריק)
    val kind: String = "context",    // overview|access|elevation|detail_tape|far|closeup|context|…
    val elementId: Long? = null,     // scope="element" ⇒ id-האביזר המקושר
    val fileName: String,            // חזית-{wallIdx+1}_{NN}.jpg
    val absPath: String,             // filesDir/photos/<fileName>
    val caption: String = "",        // הערת-המודד (אופציונלי)
    val takenAt: String = "",        // ISO-8601 (UTC)
    val w: Int = 0,                  // פיקסלים
    val h: Int = 0,                  // פיקסלים
    val bytes: Long = 0,             // גודל-הקובץ
)

/**
 * סרטון-שדה שהמודד צילם במהלך-המדידה (רשימת-משימות-מדיה · PHOTO_FEATURE_DESIGN §5.2).
 * מקביל-לחלוטין ל-[PhotoEntity] — אותו מודל-שיוך (חדר/קיר/אלמנט) ואותו מנגנון-מספור —
 * אך נושא `durationSec` (משך-הסרטון בשניות) במקום מידות-פיקסלים.
 *
 *  · `seq`         — מספר-עוקב **בתוך אותה-קטגוריה בחדר** (למשל `גישה_01`, `הסבר_01`).
 *  · `kind`        — קטגוריית-המשימה: access (גישה) · explainer (הסבר) · או כל-kind אחר.
 *  · `fileName`    — שם-הקובץ לפי-החוזה: `{kindHe}_{NN}.mp4` (למשל `גישה_01.mp4`).
 *  · `absPath`     — נתיב-מוחלט מקומי (filesDir/videos/…); ה-SolWriter קורא ממנו את הבייטים.
 *  · `durationSec` — משך-הסרטון בשניות · `bytes` — גודל-הקובץ (וידאו כבד ⇒ אזהרת-גודל בייצוא).
 *
 * FK-כפול (חדר + קיר) עם מחיקת-cascade ואינדקסים — בדיוק כמו [PhotoEntity].
 */
@Entity(
    tableName = "videos",
    foreignKeys = [
        ForeignKey(
            entity = RoomEntity::class,
            parentColumns = ["id"],
            childColumns = ["roomId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = WallEntity::class,
            parentColumns = ["id"],
            childColumns = ["wallId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("roomId"), Index("wallId")],
)
data class VideoEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val projectId: Long = 0,         // מדיה-פרויקט (scope="project") נושאת אותו; אחרת נגזר-מהחדר
    val roomId: Long? = null,        // null ⇒ מדיה-ברמת-הפרויקט (scope="project")
    val wallId: Long? = null,        // null ⇒ סרטון-חדר (scope="room")
    val seq: Int,                    // מספר-עוקב בתוך-הקטגוריה (מתאפס לכל kind)
    val scope: String = "room",      // room | wall | element | project
    val phase: String = "",          // scope="project" ⇒ opening | closing (אחרת ריק)
    val kind: String = "access",     // access | explainer | ...
    val elementId: Long? = null,     // scope="element" ⇒ id-האביזר המקושר
    val fileName: String,            // {kindHe}_{NN}.mp4
    val absPath: String,             // filesDir/videos/<fileName>
    val caption: String = "",        // הערת-המודד (אופציונלי)
    val takenAt: String = "",        // ISO-8601 (UTC)
    val durationSec: Int = 0,        // משך בשניות
    val bytes: Long = 0,             // גודל-הקובץ
)

/** סוגי-בליטה (קטלוג בסיסי — מהאלמנטים שזיהינו באפליקציית-המדידה) */
enum class AccType(val he: String, val defaultDepth: Double) {
    SOCKET_SINGLE("שקע", 6.8),
    SOCKET_MULTI("שקע מרובע", 8.0),
    WATER_PIPE("מים", 30.0),
    GAS_PIPE("גז", 30.0),
    ELECTRICAL_LINE("תשתית חשמל", 5.0),
    WINDOW("חלון", 0.0),
    DOOR("דלת", 0.0),
    COLUMN("עמוד", 200.0),
    CEILING_DROP("הנמכת תקרה", 650.0);

    companion object {
        fun of(name: String): AccType = entries.firstOrNull { it.name == name } ?: SOCKET_SINGLE
    }
}
