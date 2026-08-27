package il.co.soline.measure.ui.laser

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.device.LaserBle
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.WarnAmber

/**
 * מעצב את צילום-מצב-האבחון של הלייזר לטקסט קומפקטי — לצירוף לדיווח-באג ("תיעוד נתוני-לייזר
 * בהקשר התקלה") וגם לתצוגת-האוברליי. מקור-אמת יחיד כדי שהתיעוד יהיה זהה לתצוגה.
 */
fun formatLaserDiag(d: LaserBle.Diag): String = buildString {
    appendLine("— נתוני-לייזר (אבחון) —")
    appendLine("מצב: ${d.state}")
    d.deviceName?.let { appendLine("מכשיר: $it") }
    appendLine("שירותים: ${d.servicesFound} · Leica=${if (d.leicaFound) "✓" else "✗"} · Bosch=${if (d.boschFound) "✓" else "✗"}")
    appendLine("DST 360-X: ${if (d.hAngleCharFound) "נמצא" else "לא"} · poll ${d.hAnglePollCount}")
    appendLine("notify פעילים (CCCD): ${d.notifyEnabledCount}")
    appendLine("פריימים: ${d.frameCount} · פוענחו ${d.parsedCount}")
    append("מרחק: ${d.lastDistanceMm?.let { "%.1f מ\"מ".format(it) } ?: "—"}")
    append(" · אנכית: ${d.lastVAngleDeg?.let { "%.2f°".format(it) } ?: "—"}")
    appendLine(" · אופקית: ${d.lastHAngleDeg?.let { "%.2f°".format(it) } ?: "—"}")
    d.lastFrameHex?.let { appendLine("פריים אחרון [${d.lastFrameUuid} ${d.lastFrameSize}B]: $it") }
}

/**
 * אוברליי-אבחון-לייזר חי — נפתח ממשגר-הכלים מכל-מסך (לא רק ממסך-המכשירים). מציג את אותם
 * נתונים כמו הפאנל במסך-המכשירים; המודד יכול לצלם-מסך ולצרף לדיווח-הבאג.
 */
@Composable
fun LaserDiagOverlay(visible: Boolean, onClose: () -> Unit) {
    if (!visible) return
    val ble = remember { SolineApp.instance.ble }
    val d by ble.diag.collectAsState()

    Box(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.55f)).clickable(onClick = onClose),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = Color(0xFF12201F),
            modifier = Modifier.fillMaxWidth(0.92f).fillMaxHeight(0.8f).padding(4.dp)
                .clickable(enabled = false) {},
        ) {
            Column(Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val dot = when {
                        d.frameCount > 0 && d.parsedCount > 0 -> OkGreen
                        d.frameCount > 0 -> WarnAmber
                        else -> Color.Gray
                    }
                    Box(Modifier.size(10.dp).background(dot, RoundedCornerShape(5.dp)))
                    Spacer(Modifier.width(8.dp))
                    Text("🔬 אבחון-לייזר", color = Teal, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    Button(onClick = onClose, colors = ButtonDefaults.buttonColors(containerColor = Teal)) { Text("סגור", color = Color.White) }
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    "צלם-מסך כאן ושלח דרך 🐞 כדי לצרף את הנתונים לתקלה.",
                    color = Color(0xFF9FB5AE), fontSize = 12.sp,
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    formatLaserDiag(d),
                    color = Color(0xFFE6EFEC), fontSize = 13.sp, fontFamily = FontFamily.Monospace,
                    lineHeight = 20.sp,
                )
                if (d.recentFrames.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    Text("יומן-פריימים:", color = Color(0xFF9FB5AE), fontSize = 12.sp)
                    Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())) {
                        d.recentFrames.forEach { line ->
                            Text(line, color = Color(0xFFBFD0CB), fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }
                    }
                }
            }
        }
    }
}
