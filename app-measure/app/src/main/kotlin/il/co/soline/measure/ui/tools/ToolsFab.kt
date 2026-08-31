package il.co.soline.measure.ui.tools

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import kotlin.math.roundToInt
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.shape.RoundedCornerShape
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.bug.rememberBugReporter
import il.co.soline.measure.ui.laser.LaserDiagOverlay
import il.co.soline.measure.ui.laser.LaserPanel

/**
 * משגר-כלים מאוחד — כפתור-צף **אחד** (מעל-כל-מסך) שנפתח (speed-dial) לאייקוני-הכלים:
 * 🐞 דיווח-באג · 📡 מד-לייזר · וכל אייקון-עתידי. מחליף את כפתורי-הצף הנפרדים
 * (שכיסו תוכן-לחיץ בשטח). מעוגן בפינה תחתונה-התחלתית; בזמן-לכידת-באג כל המשגר נעלם
 * מהפריים. (בקשת-הבעלים 2026-08-26.)
 *
 * הוספת-כלי בעתיד = שורת-`ToolMini` אחת ב-`fanColumn` + ה-state שלו — בלי כפתור-צף-נוסף.
 */
@Composable
fun ToolsFab(
    currentRoute: String?,
    currentProjectId: Long? = null,
    currentRoomId: Long? = null,
) {
    val bug = rememberBugReporter(currentRoute, currentProjectId, currentRoomId)
    // מפרסמים את פעולת-הלכידה גלובלית כדי שדיאלוגים (מעל המשגר) יוכלו לדווח-באג (120539).
    SideEffect { il.co.soline.measure.ui.bug.BugTrigger.start = bug.start }
    var menuOpen by remember { mutableStateOf(false) }
    var laserOpen by remember { mutableStateOf(false) }
    var diagOpen by remember { mutableStateOf(false) }
    // המשגר נגרר **וחסום-לגבולות-המסך** (בקשת-מודד 205033) — נע בהחלקה עד קצוות-המסך
    // בלי לצאת החוצה ובלי להיצמד-לצד. bottom-start עוגן ⇒ x∈[0,+], y∈[-,0].
    var dragOffset by remember { mutableStateOf(Offset.Zero) }
    var boxSize by remember { mutableStateOf(IntSize.Zero) }
    val margin = 220f // רוחב/גובה משוער של המשגר + שוליים (px) — שומר אותו נגיש
    fun clamp(o: Offset): Offset {
        if (boxSize.width == 0) return o
        val maxX = (boxSize.width - margin).coerceAtLeast(0f)
        val minY = -(boxSize.height - margin).coerceAtLeast(0f)
        return Offset(o.x.coerceIn(0f, maxX), o.y.coerceIn(minY, 0f))
    }

    Box(Modifier.fillMaxSize().onSizeChanged { boxSize = it }) {
        // פאנל-הלייזר (overlay-משלו) — נפתח מאייקון-הלייזר
        LaserPanel(visible = laserOpen, onClose = { laserOpen = false })
        // אבחון-לייזר חי — נפתח מכל-מסך; המודד מצלם ומצרף לדיווח-הבאג
        LaserDiagOverlay(visible = diagOpen, onClose = { diagOpen = false })

        // המשגר עצמו — מוסתר בזמן לכידת/עריכת-באג (כדי לא להופיע בצילום)
        if (!bug.busy) {
            Column(
                Modifier.align(Alignment.BottomStart).padding(start = 12.dp, bottom = 12.dp)
                    .offset { IntOffset(dragOffset.x.roundToInt(), dragOffset.y.roundToInt()) },
                horizontalAlignment = Alignment.Start,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                AnimatedVisibility(
                    visible = menuOpen,
                    enter = fadeIn() + scaleIn(),
                    exit = fadeOut() + scaleOut(),
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        ToolMini("🐞", "דיווח באג", BlockRed) { menuOpen = false; laserOpen = false; diagOpen = false; bug.start() }
                        ToolMini("📡", "מד-לייזר", Teal) { menuOpen = false; diagOpen = false; laserOpen = true }
                        ToolMini("🔬", "אבחון-לייזר", Ink) { menuOpen = false; laserOpen = false; diagOpen = true }
                        // אייקונים-עתידיים נוספים כאן — בלי כפתור-צף חדש.
                    }
                }
                FloatingActionButton(
                    onClick = { menuOpen = !menuOpen },
                    containerColor = Orange,
                    contentColor = Color.White,
                    modifier = Modifier.pointerInput(boxSize) {
                        detectDragGestures { change, delta -> change.consume(); dragOffset = clamp(dragOffset + delta) }
                    },
                ) { Text(if (menuOpen) "✕" else "🛠️", fontSize = 20.sp) }
            }
        }
    }
}

/** פריט-כלי בתפריט-המאוחד: כפתור-קטן צבעוני + תווית לבנה. */
@Composable
private fun ToolMini(emoji: String, label: String, color: Color, onClick: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SmallFloatingActionButton(onClick = onClick, containerColor = color, contentColor = Color.White) {
            Text(emoji, fontSize = 17.sp)
        }
        Surface(shape = RoundedCornerShape(8.dp), color = Color.White, shadowElevation = 3.dp) {
            Text(label, Modifier.padding(horizontal = 10.dp, vertical = 5.dp), fontSize = 12.sp, color = Ink, fontWeight = FontWeight.Medium)
        }
    }
}
