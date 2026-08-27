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
 * שדות-הלקוח/משלוח משקפים את ProjectDetailsForm של CVSM (5.4.0).
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

    // ── פרטי הלקוח-הפרטי (מראה את ProjectDetailsForm של CVSM) ──
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

    val createdAt: Long = System.currentTimeMillis(),
)
