package il.co.soline.measure.ops.metrics

import il.co.soline.measure.data.LocationSampleEntity
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * MetricsComputer — מנוע-החישוב הטהור (ללא Android/DB) של המדדים-התפעוליים.
 * מקבל דגימות-מיקום גולמיות של יום אחד ומחזיר רול-אפ: זמן-עבודה-כולל,
 * זמן-נסיעה מול זמן-מדידה, וק"מ. וגם מזהה "ביקורים" (שהייה-נייחת באתר) לצורך
 * אירועי הגעה/עזיבה. הכול ניתן-לבדיקה בנפרד ומהווה מקור-אמת גם לצד-המשרד.
 *
 * הגדרות (מכוילות לשמירת-סוללה + סינון-רעש-GPS):
 *  · דגימה נספרת רק אם accuracy סביר (≤ [MAX_ACCURACY_M]).
 *  · מקטע בין שתי דגימות מסומן "בתנועה" אם המהירות (מדווחת או נגזרת) מעל
 *    [MOVING_SPEED_MPS]. אחרת — "נייח" (מדידה-באתר).
 *  · ק"מ מצטבר רק על מקטעים שאינם רעש: מרחק ≥ [MIN_STEP_M] ומהירות ≤ [MAX_SANE_MPS]
 *    (קפיצת-GPS לא-הגיונית נזרקת).
 *  · פער-זמן גדול מ-[MAX_GAP_MS] בין דגימות (מסך-כבוי/ללא-קליטה) לא נספר
 *    כזמן-עבודה — כדי לא לנפח את היום.
 */
object MetricsComputer {

    // ── סף-כיול ────────────────────────────────────────────────────────────────
    const val MAX_ACCURACY_M = 50f          // דגימה גרועה מזה — נזרקת
    const val MIN_STEP_M = 8.0              // מתחת לזה = רעש-GPS נייח (לא ק"מ)
    const val MOVING_SPEED_MPS = 1.6        // ~5.8 קמ"ש: מעל = נסיעה
    const val MAX_SANE_MPS = 60.0           // ~216 קמ"ש: קפיצה מעל = glitch → נזרק
    const val MAX_GAP_MS = 6 * 60_000L      // פער > 6 דק' = לא-זמן-עבודה רציף
    const val VISIT_MIN_DWELL_MS = 4 * 60_000L // שהייה-נייחת ≥ 4 דק' = "ביקור" באתר
    const val VISIT_RADIUS_M = 60.0         // רדיוס-אשכול לביקור (קלסטרינג)

    data class Rollup(
        val firstTs: Long,
        val lastTs: Long,
        val totalWorkMin: Double,
        val travelMin: Double,
        val measureMin: Double,
        val km: Double,
        val sampleCount: Int,
    )

    /** ביקור-באתר: מקטע-שהייה-נייחת (בסיס לאירועי הגעה/עזיבה + זמן-על-אתר). */
    data class Visit(
        val jobId: Long,
        val arrivalTs: Long,
        val departureTs: Long,
        val lat: Double,
        val lng: Double,
    ) {
        val onSiteMin: Double get() = (departureTs - arrivalTs) / 60_000.0
    }

    /** Haversine — מרחק במטרים בין שתי נקודות (lat/lng במעלות). */
    fun haversineM(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val r = 6_371_000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
            sin(dLng / 2) * sin(dLng / 2)
        return r * (2 * atan2(sqrt(a), sqrt(1 - a)))
    }

    /**
     * קובע אם דגימה בודדת מייצגת תנועה (למילוי שדה [LocationSampleEntity.moving]
     * בזמן-אמת, כשיש רק את הדגימה הקודמת). נגזר ממהירות-מדווחת אם קיימת, אחרת
     * ממרחק/זמן מהדגימה הקודמת.
     */
    fun isMoving(prev: LocationSampleEntity?, lat: Double, lng: Double, ts: Long, speedMps: Float): Boolean {
        if (speedMps > 0f) return speedMps >= MOVING_SPEED_MPS
        if (prev == null) return false
        val dtSec = (ts - prev.ts) / 1000.0
        if (dtSec <= 0.0) return false
        val dist = haversineM(prev.lat, prev.lng, lat, lng)
        if (dist < MIN_STEP_M) return false
        val v = dist / dtSec
        return v in MOVING_SPEED_MPS..MAX_SANE_MPS
    }

    /**
     * רול-אפ-יומי מתוך דגימות-גלם ממוינות-לפי-זמן. מקור-האמת לצד-המשרד:
     * ניתן להריץ מחדש בכל עת ולקבל את אותה תוצאה (דטרמיניסטי).
     */
    fun rollup(samplesSorted: List<LocationSampleEntity>): Rollup {
        val s = samplesSorted.filter { it.accuracyM <= MAX_ACCURACY_M || it.accuracyM <= 0f }
        if (s.isEmpty()) return Rollup(0, 0, 0.0, 0.0, 0.0, 0.0, samplesSorted.size)
        if (s.size == 1) return Rollup(s[0].ts, s[0].ts, 0.0, 0.0, 0.0, 0.0, 1)

        var travelMs = 0.0
        var measureMs = 0.0
        var km = 0.0
        for (i in 1 until s.size) {
            val a = s[i - 1]
            val b = s[i]
            val dtMs = (b.ts - a.ts).toDouble()
            if (dtMs <= 0.0 || dtMs > MAX_GAP_MS) continue // פער = לא-זמן-עבודה רציף
            val dist = haversineM(a.lat, a.lng, b.lat, b.lng)
            val vMps = dist / (dtMs / 1000.0)
            val moving = vMps in MOVING_SPEED_MPS..MAX_SANE_MPS
            if (moving) travelMs += dtMs else measureMs += dtMs
            // ק"מ: רק מקטע-תנועה הגיוני שאינו רעש-נייח
            if (dist >= MIN_STEP_M && vMps <= MAX_SANE_MPS) km += dist / 1000.0
        }
        val totalMin = (s.last().ts - s.first().ts) / 60_000.0
        return Rollup(
            firstTs = s.first().ts,
            lastTs = s.last().ts,
            totalWorkMin = max(0.0, totalMin),
            travelMin = travelMs / 60_000.0,
            measureMin = measureMs / 60_000.0,
            km = km,
            sampleCount = s.size,
        )
    }

    /**
     * מזהה ביקורים (שהיות-נייחות מאושכלות) מתוך דגימות-יום — בסיס לאירועי
     * הגעה/עזיבה + זמן-על-אתר פר-עבודה. אשכול חמדני: כל עוד הדגימות בתוך
     * [VISIT_RADIUS_M] מנקודת-הבסיס — אותו ביקור; יציאה מהרדיוס סוגרת ביקור.
     * ביקור נספר רק אם שהה ≥ [VISIT_MIN_DWELL_MS].
     */
    fun visits(samplesSorted: List<LocationSampleEntity>): List<Visit> {
        val s = samplesSorted.filter { it.accuracyM <= MAX_ACCURACY_M || it.accuracyM <= 0f }
        if (s.size < 2) return emptyList()
        val out = ArrayList<Visit>()
        var baseLat = s[0].lat
        var baseLng = s[0].lng
        var startTs = s[0].ts
        var lastInTs = s[0].ts
        var jobId = s[0].jobId
        for (i in 1 until s.size) {
            val p = s[i]
            val d = haversineM(baseLat, baseLng, p.lat, p.lng)
            val gap = p.ts - lastInTs
            if (d <= VISIT_RADIUS_M && gap <= MAX_GAP_MS) {
                lastInTs = p.ts
                if (p.jobId != 0L) jobId = p.jobId
            } else {
                if (lastInTs - startTs >= VISIT_MIN_DWELL_MS) {
                    out.add(Visit(jobId, startTs, lastInTs, baseLat, baseLng))
                }
                baseLat = p.lat; baseLng = p.lng; startTs = p.ts; lastInTs = p.ts; jobId = p.jobId
            }
        }
        if (lastInTs - startTs >= VISIT_MIN_DWELL_MS) {
            out.add(Visit(jobId, startTs, lastInTs, baseLat, baseLng))
        }
        return out
    }

    /** חצות-מקומי (epoch millis) של רגע נתון — מפתח-היום לרול-אפ. */
    fun dayEpochOf(ts: Long, zone: java.time.ZoneId = java.time.ZoneId.systemDefault()): Long =
        java.time.Instant.ofEpochMilli(ts).atZone(zone).toLocalDate()
            .atStartOfDay(zone).toInstant().toEpochMilli()
}
