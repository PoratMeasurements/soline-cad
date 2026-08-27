package il.co.soline.measure.ops.metrics

import il.co.soline.measure.data.Repo
import il.co.soline.measure.data.WorkMetricEntity

/**
 * OfficeSync — התפר (seam) לשידור-המדדים-התפעוליים למשרד/הנהלה.
 *
 * כרגע **אין** back-office endpoint. המימוש הפעיל [LocalQueueOfficeSync] רק
 * מכניס-לתור מקומי (office_sync_queue) — כך שכשיהיה שרת, מספיק לספק מימוש חדש
 * של [OfficeSync] (למשל HttpOfficeSync) שמושך מהתור ושולח, בלי לגעת במנוע.
 * המדדים לעולם אינם מוצגים למודד; הם נועדו לצד-המשרד בלבד.
 */
interface OfficeSync {
    /** מזרים רול-אפ-יומי אחד אל המשרד (או לתור, עד שיהיה שרת). */
    suspend fun pushWorkMetric(metric: WorkMetricEntity)

    /**
     * מנסה לרוקן-תור למשרד. no-op עד שיחובר endpoint אמיתי.
     * מחזיר כמה פריטים שודרו (0 = אין endpoint / אין-רשת / אין-ממתינים).
     */
    suspend fun flush(): Int
}

/**
 * מימוש-הביניים: מתמיד לתור-מקומי (offline-first). [flush] הוא no-op מכוון —
 * הפריטים ממתינים בתור עד שיחובר back-office. שכבת-serialization מינימלית
 * (JSON ידני) כדי לא להוסיף תלות חיצונית.
 */
class LocalQueueOfficeSync(private val repo: Repo) : OfficeSync {

    override suspend fun pushWorkMetric(metric: WorkMetricEntity) {
        repo.enqueueOfficeSync(
            kind = "work_metric",
            refKey = metric.dayEpoch.toString(),
            payloadJson = metricJson(metric),
        )
    }

    /**
     * אין-endpoint → אין-שידור. כשיהיה שרת, כאן תיכנס לולאת-משיכה
     * (repo.pendingOfficeSync → POST → repo.markOfficeSyncSent).
     */
    override suspend fun flush(): Int = 0

    private fun metricJson(m: WorkMetricEntity): String = buildString {
        append('{')
        append("\"dayEpoch\":").append(m.dayEpoch).append(',')
        append("\"firstActivityTs\":").append(m.firstActivityTs).append(',')
        append("\"lastActivityTs\":").append(m.lastActivityTs).append(',')
        append("\"totalWorkMin\":").append(m.totalWorkMin).append(',')
        append("\"travelMin\":").append(m.travelMin).append(',')
        append("\"measureMin\":").append(m.measureMin).append(',')
        append("\"km\":").append(m.km).append(',')
        append("\"sampleCount\":").append(m.sampleCount)
        append('}')
    }
}
