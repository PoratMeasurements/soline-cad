package il.co.soline.measure.ui.consent

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.BuildConfig
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.ops.metrics.LocationTracker
import il.co.soline.measure.ops.metrics.OpsMetricsService
import il.co.soline.measure.ui.Border
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.SurfaceVariant
import il.co.soline.measure.ui.Teal

/**
 * LocationConsentScreen — מסך-ההסכמה לשיתוף-מיקום-בהסכמה (privacy-by-design).
 *
 * מסביר בעברית פשוטה: מה נאסף · למה · מי רואה · לכמה-זמן · ושניתן-לכבות-תמיד.
 * "אני מאשר" → מתעד הסכמה, מבקש הרשאת-מיקום **בהקשר** (רק כאן, לא בהפעלה),
 * ומפעיל את השירות. "לא עכשיו" → יוצא בלי לאסוף דבר.
 *
 * הערה: נוסח-ההסכמה להלן הוא **טיוטה-ראשונית** ומחייב בדיקת עו"ד (ראה // לאישור עו"ד).
 */
@Composable
fun LocationConsentScreen(
    onBack: () -> Unit,
    onConsented: () -> Unit = onBack,
    modifier: Modifier = Modifier,
) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        val context = LocalContext.current

        // בקשת-הרשאה **בהקשר** — נורית רק אחרי "אני מאשר", לא בהפעלת-האפליקציה.
        val permLauncher = rememberLauncherForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) {
            // בכל תוצאה: מנסים להפעיל (השירות/tracker בודקים הסכמה+הרשאה; no-op אם חסר).
            OpsMetricsService.start(context)
            onConsented()
        }

        Scaffold(containerColor = Cream, modifier = modifier) { pad ->
            Column(
                Modifier
                    .padding(pad)
                    .fillMaxSize()
            ) {
                // ---- header ----
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(Color.White)
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "חזרה", tint = Ink)
                    }
                    Column {
                        Text("שיתוף-מיקום בהסכמה", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
                        Text("שקוף · בשליטתך · לכיבוי בכל רגע", fontSize = 12.sp, color = Muted)
                    }
                }

                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        "כדי לשפר את השירות — ייעול-מסלולי-נסיעה, חישוב זמני-עבודה " +
                            "ותיאום טוב יותר מול המשרד — נוכל לשתף את מיקומך בזמן-העבודה. " +
                            "השיתוף הוא בהסכמתך בלבד, ואתה שולט בו לחלוטין.",
                        fontSize = 15.sp, color = Ink, lineHeight = 22.sp,
                    )

                    InfoCard(emoji = "📍", title = "מה נאסף") {
                        Text(
                            "מיקום ה-GPS של המכשיר בזמן-העבודה בלבד (נקודות-מסלול), " +
                                "וממנו מחושבים: מרחק-נסיעה (ק\"מ), זמן-נסיעה מול זמן-מדידה, " +
                                "ושעות-פעילות. לא נאסף תוכן-אישי, לא אנשי-קשר ולא גלישה.",
                            fontSize = 14.sp, color = Ink, lineHeight = 20.sp,
                        )
                    }

                    InfoCard(emoji = "🎯", title = "למה") {
                        Text(
                            "ייעול-מסלולים בין-אתרים, תכנון-לו\"ז מדויק יותר, וחישוב " +
                                "הוגן של זמני-עבודה ונסיעות — לשיפור-השירות והתיאום, לא למעקב-אישי.",
                            fontSize = 14.sp, color = Ink, lineHeight = 20.sp,
                        )
                    }

                    InfoCard(emoji = "👥", title = "מי רואה") {
                        Text(
                            "אתה — במסך \"הפעילות שלי\" (הנתונים שלך גלויים לך), " +
                                "והמשרד/ההנהלה של Soline — לצורך תיאום ותפעול בלבד. " +
                                "המידע אינו משותף עם גורמים חיצוניים.",
                            fontSize = 14.sp, color = Ink, lineHeight = 20.sp,
                        )
                    }

                    InfoCard(emoji = "🗓️", title = "לכמה זמן") {
                        Text(
                            "נקודות-המסלול הגולמיות נמחקות אוטומטית אחרי " +
                                "${LocationTracker.SAMPLE_RETENTION_DAYS} ימים. נשמרים רק המדדים " +
                                "המסכמים (ק\"מ/זמנים ליום) הדרושים לשיפור-השירות.",
                            fontSize = 14.sp, color = Ink, lineHeight = 20.sp,
                        )
                    }

                    InfoCard(emoji = "🔌", title = "כיבוי בכל רגע") {
                        Text(
                            "כשהשיתוף פעיל תופיע התראה קבועה בשורת-ההתראות. אפשר לכבות " +
                                "בכל רגע דרך ההגדרות (מתג + \"בטל הסכמה\"). ביטול-הסכמה גם " +
                                "מוחק את נקודות-המסלול השמורות במכשיר.",
                            fontSize = 14.sp, color = Ink, lineHeight = 20.sp,
                        )
                    }

                    // ── טיוטת-נוסח-משפטי (placeholder) ──
                    // לאישור עו"ד: הנוסח להלן הוא טיוטה-ראשונית בלבד וטרם-נבדק משפטית.
                    // תווית-ה"טיוטה" מוצגת רק ב-DEBUG (BuildConfig) — ב-release המשתמש
                    // רואה נוסח-נקי בלי חשיפת-מצב-פנימי (תיקון קבוצה-D · ⚪ נמוך).
                    Card(
                        Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                        border = BorderStroke(1.dp, Border),
                    ) {
                        Text(
                            "הודעת-פרטיות${if (BuildConfig.DEBUG) " (טיוטה — לאישור עו\"ד)" else ""}: שיתוף-המיקום נאסף על-בסיס " +
                                "הסכמתך-מרצון ולמטרת שיפור-השירות בלבד. הנך זכאי לעיין בנתונים, " +
                                "לבטל את הסכמתך ולמחוק את הנתונים בכל עת, ללא-תנאי. אי-מתן-הסכמה " +
                                "אינו פוגע בהעסקתך או בשימושך באפליקציה.",
                            fontSize = 12.sp, color = Muted, lineHeight = 17.sp,
                            modifier = Modifier.padding(14.dp),
                        )
                    }

                    Spacer(Modifier.height(4.dp))

                    // ---- buttons ----
                    Button(
                        onClick = {
                            // 1) מתעדים הסכמה מפורשת. 2) מבקשים הרשאה בהקשר. 3) מפעילים.
                            Prefs.grantLocationConsent()
                            permLauncher.launch(buildPermissionRequest())
                        },
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = OkGreen, contentColor = Color.White),
                    ) { Text("אני מאשר", fontSize = 17.sp, fontWeight = FontWeight.Bold) }

                    OutlinedButton(
                        onClick = onBack,
                        modifier = Modifier.fillMaxWidth().height(50.dp),
                    ) { Text("לא עכשיו", fontSize = 16.sp, color = Muted) }

                    Spacer(Modifier.height(8.dp))
                }
            }
        }
    }
}

/** בונה את מערך-ההרשאות הנדרש (מיקום + התראות מ-Android 13). */
private fun buildPermissionRequest(): Array<String> = buildList {
    add(Manifest.permission.ACCESS_FINE_LOCATION)
    add(Manifest.permission.ACCESS_COARSE_LOCATION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        add(Manifest.permission.POST_NOTIFICATIONS)
    }
}.toTypedArray()

@Composable
private fun InfoCard(emoji: String, title: String, body: @Composable ColumnScope.() -> Unit) {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(emoji, fontSize = 18.sp)
                Spacer(Modifier.width(8.dp))
                Text(title, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Teal)
            }
            Spacer(Modifier.height(6.dp))
            body()
        }
    }
}
