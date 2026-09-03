package il.co.soline.measure.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/* מודל-פתיחת-עבודה עשיר ל-Soline Measure.
 *
 * שרשרת-הזרימה של Michael:
 *   נגר (הלקוח של Soline)  →  פתיחת פרויקט (הלקוח הפרטי של הנגר)  →  דרכי-גישה  →  תחילת שרטוט.
 *
 * ה-Carpenter הוא הלקוח של Soline; כל JobEntity הוא פרויקט שהנגר פותח עבור
 * הלקוח-הפרטי שלו, כולל פרטי-קשר, כתובת, כתובת-משלוח ודרכי-גישה לפני-שרטוט.
 * שדות-הלקוח/משלוח הם טופס-פרטי-הפרויקט (פרטי-קשר, כתובת, כתובת-משלוח).
 *
 * ישויות חדשות — offline-first (Room). האינטגרטור מוסיף אותן ל-SolineDatabase
 * עם bump-גרסה + migration; אין לשנות את הישויות הקיימות. */

/** הנגר — הלקוח של Soline (מי שמזמין את שירות-המדידה). */
@Entity(tableName = "carpenters")
data class Carpenter(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val phone: String = "",
    val company: String = "",
    val email: String = "",
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis(),
)

/** פרויקט/עבודה — נפתח ע"י נגר עבור הלקוח-הפרטי שלו, כולל דרכי-גישה. */
@Entity(tableName = "jobs")
data class JobEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val carpenterId: Long = 0,        // הנגר (הלקוח של Soline) שפתח את הפרויקט

    // ── פרטי הלקוח-הפרטי (טופס-פרטי-הפרויקט) ──
    val clientName: String,           // שם הלקוח-הפרטי של הנגר
    val clientPhone: String = "",     // טלפון / נייד
    val clientCompany: String = "",   // חברה (רשות)
    val contact: String = "",         // איש-קשר באתר
    val email: String = "",

    // ── כתובת ──
    val address1: String = "",
    val address2: String = "",
    val city: String = "",
    val zip: String = "",

    // ── משלוח ──
    val deliveryDifferent: Boolean = false, // כתובת-משלוח שונה מכתובת-הלקוח?
    val deliveryAddress: String = "",       // כתובת-משלוח (כשהיא שונה)

    // ── דרכי-גישה (קומה, מעלית, חניה, הערות) ──
    val accessNotes: String = "",

    // ── ניהול לו"ז (צד-המשרד · מיגרציה 5→6) ─────────────────────────────────
    /** מועד-מתוזמן (epoch millis). 0 = טרם-תוזמן (מופיע בדלי "לתזמון"). */
    val scheduledAt: Long = 0,
    /** סטטוס-העבודה — מפתח מתוך [JobStatus]. ברירת-מחדל: תוזמן. */
    val status: String = JobStatus.SCHEDULED,
    /** המודד המשובץ (שם חופשי — מוכן ל-users אמיתיים בעתיד). */
    val assignee: String = "",
    /** משך-מתוכנן בדקות (0 = לא-הוגדר). */
    val durationMin: Int = 0,

    val createdAt: Long = System.currentTimeMillis(),
)

/**
 * סטטוסי-עבודה לצד-הניהול (לו"ז). המפתחות תואמים ל-`job.stage` ההיסטורי
 * (scheduled/in_field/measured/review) + `done` לסגירה. סדר [flow] = סדר-ההתקדמות
 * התפעולי, לשימוש במעבר-סטטוס מהיר במסך-הלו"ז.
 */
object JobStatus {
    const val SCHEDULED = "scheduled" // תוזמן / בתיאום מועד
    const val IN_FIELD = "in_field"   // יצא לשטח
    const val MEASURED = "measured"   // נמדד
    const val REVIEW = "review"       // בבדיקה
    const val DONE = "done"           // הושלם

    /** סדר-ההתקדמות התפעולי (לכפתור "קדם סטטוס"). */
    val flow = listOf(SCHEDULED, IN_FIELD, MEASURED, REVIEW, DONE)

    /** תווית-עברית קצרה לסטטוס (ברירת-מחדל: המפתח עצמו לערך לא-מוכר). */
    fun he(status: String): String = when (status) {
        SCHEDULED -> "מתוזמן"
        IN_FIELD -> "בשטח"
        MEASURED -> "נמדד"
        REVIEW -> "בבדיקה"
        DONE -> "הושלם"
        else -> status
    }

    /** האם העבודה עדיין "פתוחה" (דורשת פעולה בשטח)? */
    fun isOpen(status: String): Boolean = status == SCHEDULED || status == IN_FIELD

    /** הסטטוס-הבא במחזור-ההתקדמות (מתגלגל חזרה להתחלה מ-DONE). */
    fun next(status: String): String {
        val i = flow.indexOf(status)
        return if (i < 0) SCHEDULED else flow[(i + 1) % flow.size]
    }
}

/**
 * אירוע-תפעולי גולמי (seam) — מקום-נתונים נקי למנוע-המדדים/GPS העתידי
 * (זמן-נסיעה, זמן-מדידה, ק"מ, זמן-עבודה-יומי). כרגע איש אינו כותב לטבלה זו;
 * היא קיימת כדי שהמנוע-הנסתר יזרים אליה בעתיד בלי מיגרציה נוספת.
 * offline-first (Room) — טבלה `job_events`.
 */
@Entity(tableName = "job_events")
data class JobEventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val jobId: Long,
    val type: String,          // travel_start | travel_end | measure_start | measure_end | ...
    val ts: Long = System.currentTimeMillis(),
    val valueNum: Double = 0.0, // ערך-מספרי כללי (ק"מ / דקות / ...)
    val note: String = "",
)
