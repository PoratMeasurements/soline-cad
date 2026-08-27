package il.co.soline.measure.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * מנוע-המדדים-התפעולי הנסתר (Ops-Metrics · צד-המשרד בלבד)
 * ─────────────────────────────────────────────────────────────────────────────
 * טבלאות-Room אלה מזינות את מנוע-ה-GPS/מדדים הרץ-ברקע. הן **אינן** מוצגות
 * למודד בשום מסך — הנתונים נועדו לצד-הניהול/המשרד (יוצגו בדשבורד-התפעולי בעתיד).
 * additive בלבד; מיגרציה 6→7 יוצרת אותן בלי לגעת בנתונים קיימים.
 *
 * שרשרת-הזרימה:
 *   LocationManager → [LocationSampleEntity] (דגימות-גלם) → MetricsComputer →
 *   [WorkMetricEntity] (רול-אפ יומי) + job_events (הגעה/עזיבה) → OfficeSync →
 *   [OfficeSyncEntity] (תור-שידור-מקומי, ממתין ל-back-office).
 */

/**
 * דגימת-מיקום גולמית (מקור-האמת). נכתבת כל ~20–30ש' בזמן-העבודה.
 * שדות מינימליים כדי לשמור על סוללה/מקום; המחשוב נגזר מהן ב-[il.co.soline.measure.ops.metrics.MetricsComputer].
 */
@Entity(
    tableName = "location_samples",
    indices = [Index(value = ["dayEpoch"]), Index(value = ["ts"])],
)
data class LocationSampleEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /** תחילת-היום המקומי (epoch millis, חצות) — מפתח-קיבוץ לרול-אפ יומי. */
    val dayEpoch: Long,
    val ts: Long,            // חותמת-זמן הדגימה (epoch millis)
    val lat: Double,
    val lng: Double,
    val accuracyM: Float,    // דיוק אופקי משוער (מ') — לסינון-רעש
    val speedMps: Float,     // מהירות מדווחת (מ'/ש'); 0 אם לא-זמין
    /** העבודה-הפעילה בזמן-הדגימה (0 = לא-משויך). */
    val jobId: Long = 0,
    /** נגזר: האם המודד היה בתנועה (נסיעה) בזמן-הדגימה. */
    val moving: Boolean = false,
)

/**
 * רול-אפ-יומי (מדד-עבודה מחושב) — שורה אחת ליום. זהו התוצר שהמשרד קורא:
 * זמן-עבודה-כולל, נסיעה מול מדידה, ק"מ. ה-upsert דורס את השורה בכל חישוב-מחדש.
 */
@Entity(tableName = "work_metrics")
data class WorkMetricEntity(
    /** תחילת-היום המקומי (epoch millis) — משמש כמפתח-יחיד ליום. */
    @PrimaryKey val dayEpoch: Long,
    val firstActivityTs: Long = 0, // תחילת-יום-העבודה בפועל (דגימה ראשונה)
    val lastActivityTs: Long = 0,  // סוף-יום-העבודה בפועל (דגימה אחרונה)
    val totalWorkMin: Double = 0.0, // זמן-עבודה-יומי כולל (דק')
    val travelMin: Double = 0.0,    // זמן-נסיעה (בתנועה) (דק')
    val measureMin: Double = 0.0,   // זמן-מדידה (נייח-באתר) (דק')
    val km: Double = 0.0,           // ק"מ מצטבר ליום (Haversine מסונן)
    val sampleCount: Int = 0,       // מס' דגימות ששוקללו
    val updatedAt: Long = 0,        // חישוב-אחרון (epoch millis)
    val syncedAt: Long = 0,         // שודר-למשרד (0 = ממתין); לצד-ה-OfficeSync
)

/**
 * תור-שידור-למשרד (seam ל-back-office עתידי). כרגע אין endpoint — נשמר מקומית
 * ו-[il.co.soline.measure.ops.metrics.OfficeSync] יזרים אותו כשיהיה שרת.
 */
@Entity(tableName = "office_sync_queue", indices = [Index(value = ["sent"])])
data class OfficeSyncEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val kind: String,          // "work_metric" | "location_batch" | "job_event"
    val refKey: String = "",   // מפתח-ישות (למשל dayEpoch) לצורך de-dup
    val payloadJson: String,   // המטען כ-JSON (נייטרלי ל-endpoint)
    val createdAt: Long = System.currentTimeMillis(),
    val sent: Boolean = false, // האם שודר בהצלחה
    val sentAt: Long = 0,
)
