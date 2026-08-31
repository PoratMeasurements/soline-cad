package il.co.soline.measure.update

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import kotlinx.coroutines.launch

/**
 * פאנל עדכון-גרסה (OTA) למסך-ההגדרות — עצמאי (בלי פרמטרים). בודק מניפסט ציבורי, ואם יש
 * גרסה חדשה: מוריד ומפעיל את מתקין-אנדרואיד. בלי מחשב/כבל. (בקשת-הבעלים 2026-08-26.)
 */
@Composable
fun UpdatePanel() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var checking by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("") }
    var available by remember { mutableStateOf<UpdateInfo?>(null) }
    var downloading by remember { mutableStateOf(false) }
    var progress by remember { mutableStateOf(0) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            "גרסה נוכחית: ${UpdateChecker.currentName}",
            fontSize = 13.sp, color = Muted,
        )

        val info = available
        if (info == null) {
            Button(
                onClick = {
                    checking = true; status = ""
                    scope.launch {
                        val latest = UpdateChecker.fetchLatest()
                        checking = false
                        when {
                            latest == null -> status = "לא ניתן לבדוק עדכון כרגע (בדוק חיבור-אינטרנט)."
                            UpdateChecker.isNewer(latest) -> available = latest
                            else -> status = "אתה מעודכן ✓"
                        }
                    }
                },
                enabled = !checking,
                colors = ButtonDefaults.buttonColors(containerColor = Teal, contentColor = Color.White),
            ) { Text(if (checking) "בודק…" else "🔄 בדוק עדכון גרסה", fontWeight = FontWeight.SemiBold) }
        } else {
            Text(
                "גרסה חדשה זמינה: ${info.versionName} (build ${info.versionCode})",
                fontWeight = FontWeight.Bold, color = Teal, fontSize = 15.sp,
            )
            if (info.notes.isNotBlank()) Text(info.notes, fontSize = 12.sp, color = Ink)

            if (downloading) {
                Text("מוריד… $progress%", fontSize = 13.sp, color = Ink, fontWeight = FontWeight.SemiBold)
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            if (!UpdateChecker.canInstall(context)) {
                                status = "אשר \"התקנת אפליקציות לא-ידועות\" ואז נסה שוב."
                                UpdateChecker.promptEnableInstall(context)
                                return@Button
                            }
                            downloading = true; progress = 0; status = ""
                            scope.launch {
                                val apk = UpdateChecker.downloadApk(context, info.apkUrl) { progress = it }
                                downloading = false
                                if (apk != null) UpdateChecker.installApk(context, apk)
                                else status = "ההורדה נכשלה — נסה שוב."
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Orange, contentColor = Color.White),
                    ) { Text("⬇️ הורד והתקן", fontWeight = FontWeight.SemiBold) }
                    OutlinedButton(onClick = { available = null; status = "" }) { Text("בטל") }
                }
            }
        }

        if (status.isNotBlank()) {
            Text(status, fontSize = 12.sp, color = if (status.contains("✓")) OkGreen else BlockRed)
        }
    }
}
