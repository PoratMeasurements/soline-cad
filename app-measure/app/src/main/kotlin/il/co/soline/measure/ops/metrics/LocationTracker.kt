package il.co.soline.measure.ops.metrics

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import il.co.soline.measure.data.JobEventEntity
import il.co.soline.measure.data.LocationSampleEntity
import il.co.soline.measure.data.Repo
import il.co.soline.measure.data.WorkMetricEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * LocationTracker — מנוע-האיסוף של שיתוף-המיקום-בהסכמה. אוסף פִיקְסֵי-מיקום
 * בזמן-העבודה, מתמיד דגימות-גלם, מחשב רול-אפ-יומי (נסיעה/מדידה/ק"מ/זמן-כולל)
 * ורושם אירועי הגעה/עזיבה ל-job_events. פועל **אך-ורק** לאחר הסכמה-מפורשת של
 * המודד (ראה השער ב-[start]); התוצר גלוי למודד עצמו במסך "הפעילות שלי" וגם למשרד.
 *
 * מקור-המיקום: framework [LocationManager] בלבד (GPS + רשת). **החלטה מודעת:**
 * FusedLocationProviderClient (play-services-location) לא נכלל כי הספרייה אינה
 * ב-cache-הבנייה הלא-מקוון של הסביבה — הוספתה הייתה מסכנת את הבנייה. התפר נקי:
 * ניתן בעתיד להחליף את [start]/[stop] במימוש-Fused בלי לגעת בחישוב או ב-DB.
 *
 * חסכוני-בסוללה (מתחבר ל-B13): מרווח-דגימה [MIN_INTERVAL_MS] + מסנן-מרחק
 * [MIN_DISTANCE_M]; לא polling אגרסיבי.
 */
class LocationTracker(
    private val context: Context,
    private val repo: Repo,
    private val officeSync: OfficeSync,
    private val scope: CoroutineScope,
) {
    companion object {
        const val MIN_INTERVAL_MS = 20_000L // ~20ש' בין דגימות (חסכוני-סוללה)
        const val MIN_DISTANCE_M = 15f      // מסנן-מרחק: אין תזוזה → אין דגימה
        /**
         * צמצום-נתונים (data minimization): דגימות-הגלם נמחקות אוטומטית אחרי 7 יום.
         * זהו הזמן-המינימלי הדרוש לחישוב מדדי-שבוע/אופטימיזציית-מסלול; המדד-המחושב
         * (work_metrics) נשמר, אך נקודות-המסלול הגולמיות אינן נדרשות מעבר לכך.
         */
        const val SAMPLE_RETENTION_DAYS = 7L
    }

    private val lm: LocationManager? =
        context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager

    // מצב בזיכרון לגזירת-תנועה ולמכונת-מצב הגעה/עזיבה (רץ בת'רד יחיד דרך mutex).
    private val gate = Mutex()
    private var lastSample: LocationSampleEntity? = null
    private var atSite = false
    private var stationarySinceTs = 0L
    private var siteArrivalTs = 0L
    private var siteJobId = 0L

    private val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            scope.launch(Dispatchers.IO) { handleFix(location) }
        }
        // תאימות-אחורה (API 26–29 מגדיר אותן כ-abstract): no-op.
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
    }

    fun hasLocationPermission(): Boolean =
        context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    /**
     * מפעיל את איסוף-המיקום. no-op שקט (מחזיר false) אם אין הרשאה/ספק —
     * האפליקציה ממשיכה כרגיל. מבקש GPS + רשת (הרשת ממלאת בתוך-מבנים/חוסך-סוללה).
     */
    fun start(): Boolean {
        // שער-הסכמה קשיח (privacy-by-design): בלי OPT-IN מפורש — no-op מוחלט,
        // גם אם ההרשאה קיימת. זהו קו-הגנה שני מעבר לבדיקת ה-Service.
        if (!il.co.soline.measure.data.Prefs.locationSharingOn) return false
        val manager = lm ?: return false
        if (!hasLocationPermission()) return false
        return try {
            val providers = buildList {
                if (manager.allProviders.contains(LocationManager.GPS_PROVIDER)) add(LocationManager.GPS_PROVIDER)
                if (manager.allProviders.contains(LocationManager.NETWORK_PROVIDER)) add(LocationManager.NETWORK_PROVIDER)
            }
            if (providers.isEmpty()) return false
            for (p in providers) {
                manager.requestLocationUpdates(p, MIN_INTERVAL_MS, MIN_DISTANCE_M, listener)
            }
            true
        } catch (_: SecurityException) {
            false
        } catch (_: IllegalArgumentException) {
            false
        }
    }

    fun stop() {
        try {
            lm?.removeUpdates(listener)
        } catch (_: SecurityException) {
        }
    }

    /** עיבוד פִיקְס בודד: מתמיד דגימה, מחשב-מחדש רול-אפ, ומזהה הגעה/עזיבה. */
    private suspend fun handleFix(loc: Location) = gate.withLock {
        val now = loc.time.takeIf { it > 0 } ?: System.currentTimeMillis()
        val dayEpoch = MetricsComputer.dayEpochOf(now)
        val jobId = repo.activeInFieldJobId()
        val speed = if (loc.hasSpeed()) loc.speed else 0f
        val moving = MetricsComputer.isMoving(lastSample, loc.latitude, loc.longitude, now, speed)

        val sample = LocationSampleEntity(
            dayEpoch = dayEpoch,
            ts = now,
            lat = loc.latitude,
            lng = loc.longitude,
            accuracyM = if (loc.hasAccuracy()) loc.accuracy else 0f,
            speedMps = speed,
            jobId = jobId,
            moving = moving,
        )
        repo.addLocationSample(sample)
        lastSample = sample

        recomputeDaily(dayEpoch)
        updateVisitState(sample, moving)
    }

    /** רול-אפ-יומי מלא מדגימות-הגלם (דטרמיניסטי) → work_metrics → תור-משרד. */
    private suspend fun recomputeDaily(dayEpoch: Long) {
        val samples = repo.samplesForDay(dayEpoch)
        val r = MetricsComputer.rollup(samples)
        val prev = repo.workMetricNow(dayEpoch)
        val metric = WorkMetricEntity(
            dayEpoch = dayEpoch,
            firstActivityTs = r.firstTs,
            lastActivityTs = r.lastTs,
            totalWorkMin = r.totalWorkMin,
            travelMin = r.travelMin,
            measureMin = r.measureMin,
            km = r.km,
            sampleCount = r.sampleCount,
            updatedAt = System.currentTimeMillis(),
            syncedAt = prev?.syncedAt ?: 0,
        )
        repo.upsertWorkMetric(metric)
        officeSync.pushWorkMetric(metric)

        // ניקוי-שמירה של דגימות-גלם ישנות (המדד כבר נשמר).
        val cutoff = dayEpoch - SAMPLE_RETENTION_DAYS * 24 * 60 * 60 * 1000L
        repo.pruneSamplesBefore(cutoff)
    }

    /**
     * מכונת-מצב הגעה/עזיבה בזמן-אמת → job_events. עוברת ל-AT_SITE כשנצברה
     * שהייה-נייחת ≥ [MetricsComputer.VISIT_MIN_DWELL_MS], וחזרה ל-IDLE כשיוצאים
     * לתנועה — ואז נרשם אירוע-עזיבה עם זמן-על-אתר. כל אירוע נכתב פעם-אחת (על-מעבר).
     */
    private suspend fun updateVisitState(s: LocationSampleEntity, moving: Boolean) {
        if (!moving) {
            if (stationarySinceTs == 0L) {
                stationarySinceTs = s.ts
            }
            val dwell = s.ts - stationarySinceTs
            if (!atSite && dwell >= MetricsComputer.VISIT_MIN_DWELL_MS) {
                atSite = true
                siteArrivalTs = stationarySinceTs
                siteJobId = s.jobId
                repo.addJobEvent(
                    JobEventEntity(
                        jobId = s.jobId,
                        type = "arrival",
                        ts = siteArrivalTs,
                        valueNum = 0.0,
                        note = "auto·gps",
                    )
                )
            }
        } else {
            if (atSite) {
                val onSiteMin = (s.ts - siteArrivalTs) / 60_000.0
                repo.addJobEvent(
                    JobEventEntity(
                        jobId = if (siteJobId != 0L) siteJobId else s.jobId,
                        type = "departure",
                        ts = s.ts,
                        valueNum = onSiteMin, // זמן-על-אתר (דק')
                        note = "auto·gps",
                    )
                )
            }
            atSite = false
            stationarySinceTs = 0L
        }
    }
}
