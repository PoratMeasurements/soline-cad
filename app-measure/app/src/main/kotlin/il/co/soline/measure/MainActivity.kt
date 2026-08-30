package il.co.soline.measure

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.ops.metrics.OpsMetricsService
import il.co.soline.measure.ui.SolineRoot

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // המסך דולק בזמן העבודה (מדידה בשטח) — לפי הגדרת המשתמש (Prefs.keepScreenOn)
        if (Prefs.keepScreenOn) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        hideNavBar()
        // שיתוף-מיקום-בהסכמה: **אין הפעלה-אוטומטית**. איסוף-מיקום מתחיל אך-ורק
        // לאחר שהמודד אישר במסך-ההסכמה (LocationConsentScreen). כאן אנו רק מבטיחים
        // רציפות: אם הסכמה כבר-קיימת והמתג פעיל — נחדש את השירות (no-op אחרת).
        if (Prefs.locationSharingOn) {
            OpsMetricsService.start(this)
        }
        setContent { SolineRoot() }
    }

    /**
     * מצב-immersive מלא — מסתיר את **כל** סרגלי-המערכת של הטאבלט (ניווט-תחתון + סטטוס-עליון),
     * לפי בקשת-המודד ("הסרגל של הטאבלט מפריע — תסתיר אלא אם גללתי אותו למטה").
     * הסרגלים חוזרים רגעית רק בהחלקה מקצה-המסך (BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE)
     * ואז נעלמים שוב — כך כל שטח-המסך פנוי לתוכן-האפליקציה.
     */
    private fun hideNavBar() {
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    // מוודא שהסרגל נשאר מוסתר גם אחרי דיאלוג/מקלדת/חזרה-לפוקוס
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideNavBar()
    }
}
