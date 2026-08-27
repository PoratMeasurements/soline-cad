package il.co.soline.measure.ops.metrics

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import il.co.soline.measure.MainActivity
import il.co.soline.measure.R
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.SolineApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

/**
 * OpsMetricsService — Foreground-Service המריץ את [LocationTracker] לאורך יום-העבודה,
 * **רק לאחר הסכמה-מפורשת** של המודד (שיתוף-מיקום-בהסכמה · privacy-by-design).
 *
 * ── חיווי-פעיל-תמידי (transparency) ──────────────────────────────────────────
 * כשהאיסוף פעיל, מוצגת התראה קבועה, גלויה ולא-ניתנת-להסרה:
 * "Soline — שיתוף-מיקום פעיל לשיפור-השירות". הקשה עליה פותחת את האפליקציה
 * (משם המודד מגיע למתג-הכיבוי בהגדרות / למסך "הפעילות שלי"). אין איסוף-נסתר.
 *
 * ── שער-ההסכמה (no collection without opt-in) ─────────────────────────────────
 * לפני כל דבר, השירות בודק את [Prefs.locationSharingOn]. בלי הסכמה+מתג-פעיל —
 * הוא עוצר את עצמו מיד (stopSelf) ואינו נוגע במיקום. גם [LocationTracker.start]
 * בודק שוב (הגנה-כפולה). המערכת אוסרת מעקב-מיקום ללא Foreground-Service+התראה,
 * ולכן ההתראה כאן היא גם דרישת-מערכת וגם עקרון-שקיפות — לטובת המודד.
 */
class OpsMetricsService : Service() {

    private val scope = CoroutineScope(SupervisorJob())
    private var tracker: LocationTracker? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
        // חובת-מערכת: Foreground-Service שהופעל חייב לקרוא startForeground מיד.
        startForegroundCompat()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // שער-הסכמה: בלי OPT-IN מפורש — עצירה-מיידית, אפס-איסוף.
        if (!Prefs.locationSharingOn) {
            stopForegroundCompat()
            stopSelf()
            return START_NOT_STICKY
        }
        // מפעילים את האיסוף פעם-אחת (idempotent — לא מפעילים tracker כפול).
        if (tracker == null) {
            val repo = SolineApp.instance.repo
            tracker = LocationTracker(
                context = applicationContext,
                repo = repo,
                officeSync = LocalQueueOfficeSync(repo),
                scope = scope,
            ).also { it.start() } // no-op שקט אם אין הרשאה/הסכמה — לא מפיל את השירות
        }
        // START_STICKY: המערכת תחזיר את השירות אם ייהרג — רציפות לאורך-היום.
        // (גם בהחזרה, onStartCommand בודק שוב את ההסכמה למעלה.)
        return START_STICKY
    }

    override fun onDestroy() {
        tracker?.stop()
        tracker = null
        scope.cancel()
        super.onDestroy()
    }

    private fun ensureChannel() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val ch = NotificationChannel(
            CHANNEL_ID,
            "שיתוף-מיקום לשיפור-השירות", // שם-ערוץ שקוף — מתאר בדיוק את הפעולה
            NotificationManager.IMPORTANCE_LOW, // גלוי אך שקט (ללא-צליל/רטט)
        ).apply {
            setShowBadge(false)
            description = "מוצג בזמן ששיתוף-המיקום-בהסכמה פעיל"
        }
        nm.createNotificationChannel(ch)
    }

    private fun buildNotification(): Notification {
        // הקשה על ההתראה → פתיחת האפליקציה (משם: הגדרות → מתג-כיבוי / "הפעילות שלי").
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Soline — שיתוף-מיקום פעיל לשיפור-השירות")
            .setContentText("הקש כדי לכבות בכל רגע · ההגדרות")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(open)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun startForegroundCompat() {
        val n = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIF_ID, n)
        }
    }

    @Suppress("DEPRECATION")
    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            stopForeground(true)
        }
    }

    companion object {
        private const val CHANNEL_ID = "soline_location_share"
        private const val NOTIF_ID = 4711

        /**
         * מפעיל את שיתוף-המיקום. **בודק הסכמה** — אם אין OPT-IN, no-op מוחלט
         * (לא מפעיל שירות, לא מבקש הרשאה). נקרא לאחר "אני מאשר" + קבלת-הרשאה.
         */
        fun start(context: Context) {
            if (!Prefs.locationSharingOn) return
            val i = Intent(context, OpsMetricsService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(i)
            } else {
                context.startService(i)
            }
        }

        /** עוצר את השירות (כיבוי-מתג / ביטול-הסכמה). */
        fun stop(context: Context) {
            context.stopService(Intent(context, OpsMetricsService::class.java))
        }
    }
}
