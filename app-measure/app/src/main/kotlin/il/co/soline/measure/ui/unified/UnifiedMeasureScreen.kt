package il.co.soline.measure.ui.unified

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.canvas.RoomPlanCanvas
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/*
 * מנוע-המדידה המאוחד — מסך-מדידה אחד.
 * עיקרון-הליבה: **מתאר-חדר אחד ומתמשך** (RoomPlanCanvas מציג תמיד את אותם קירות מ-repo).
 * השיטות (לייזר · מטר · P2P · אלמנט · עריכה) רק מזינות/עורכות את אותו מתאר — מעבר-שיטה
 * לעולם לא-מחליף את השרטוט. סרגל-כלים קטן ונייד (המודד בוחר לאיזה צד להצמיד).
 * רספונסיבי: עובד לאורך ולרוחב, בלי לאבד נתונים (הקנבס גמיש, הפאנלים קומפקטיים).
 */

private enum class Mode(val glyph: String, val label: String) {
    LASER("📡", "לייזר"),
    TAPE("✍️", "מטר"),
    P2P("🎯", "P2P"),
    ELEMENT("🚪", "אלמנט"),
}

@Composable
fun UnifiedMeasureHost(nav: NavController, roomId: Long) {
    val scope = rememberCoroutineScope()
    val repo = SolineApp.instance.repo
    val ble = SolineApp.instance.ble
    val walls by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    val room by repo.room(roomId).collectAsStateWithLifecycle(null)
    val reading by ble.lastReading.collectAsStateWithLifecycle(null)
    val connected by ble.connected.collectAsStateWithLifecycle(null)

    var mode by remember { mutableStateOf(Mode.LASER) }
    var angle by remember { mutableStateOf(90.0) } // זווית-הפנייה לקיר-הבא
    var tapeText by remember { mutableStateOf("") }
    var railRight by remember { mutableStateOf(false) } // צד-הצמדה של הסרגל (בקשת-מודד 205033)
    var railY by remember { mutableStateOf(0f) }         // גובה-הסרגל (נגרר)
    var railCollapsed by remember { mutableStateOf(false) } // ✕ מכווץ את הסרגל, לא יוצא (211325)
    var boxHpx by remember { mutableStateOf(0) }          // גובה-המסך (px) — לחסימת-גרירת-הסרגל (QA #3)

    fun addWall(lenMm: Double) {
        if (lenMm <= 0) return
        // הזווית שנבחרה היא הפנייה בין הקיר-הקודם לחדש — נשמרת על הקיר ה*קודם*
        // (מוסכמת WallBuilder). הקיר-הראשון: אין-קודם, הזווית נעדרת ולכן חסרת-משמעות.
        val turnFromPrev = if (walls.isEmpty()) 0.0 else angle
        scope.launch { repo.addWallWithTurn(roomId, lenMm, Prefs.defaultWallHeightMm, turnFromPrev) }
    }

    Box(Modifier.fillMaxSize().background(Cream).onSizeChanged { boxHpx = it.height }) {
        Column(Modifier.fillMaxSize()) {
            // ── סרגל-עליון: חדר · חיבור · קריאה-חיה ──
            Row(
                Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Surface(onClick = { nav.popBackStack() }, shape = RoundedCornerShape(999.dp), color = Cream) {
                    Text("◀ יציאה", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Ink,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp))
                }
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(room?.name ?: "חדר", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Ink)
                    Text("${walls.size} קירות", fontSize = 11.sp, color = Muted)
                }
                Surface(
                    onClick = { nav.navigate("measurestart/$roomId") },
                    shape = RoundedCornerShape(999.dp), color = Teal.copy(alpha = 0.1f),
                ) {
                    Text("⚙️ פתיחה", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Teal,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp))
                }
                Spacer(Modifier.width(8.dp))
                ConnChip(connected)
                Spacer(Modifier.width(12.dp))
                ReadoutTag(reading?.distanceMm)
            }

            // ── קנבס-המתאר המתמשך (תמיד אותו שרטוט) ──
            Box(Modifier.weight(1f).fillMaxWidth()) {
                RoomPlanCanvas(walls = walls, accessoriesByWall = emptyMap(), modifier = Modifier.fillMaxSize())
            }

            // ── פאנל-הכלי-הפעיל (משתנה; המתאר לא) ──
            Surface(color = Color.White) {
                Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    when (mode) {
                        Mode.LASER -> {
                            AngleChips(angle, walls.isEmpty()) { angle = it }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MiniBtn("↩") { scope.launch { repo.removeLastWall(roomId) } }
                                Button(
                                    onClick = { reading?.distanceMm?.let { addWall(it) } },
                                    enabled = reading?.distanceMm?.let { it > 0 } == true,
                                    colors = ButtonDefaults.buttonColors(containerColor = Orange, contentColor = Color.White),
                                    modifier = Modifier.weight(1f).heightIn(min = 56.dp),
                                ) {
                                    Text(
                                        reading?.distanceMm?.let { "➕ הוסף קיר · ${cm(it)} ס\"מ" } ?: "מדוד עם הלייזר…",
                                        fontWeight = FontWeight.Bold, fontSize = 16.sp,
                                    )
                                }
                            }
                            Text("לחצן-המכשיר קולט; בחר זווית-פנייה לקיר-הבא.", fontSize = 11.sp, color = Muted)
                        }
                        Mode.TAPE -> {
                            AngleChips(angle, walls.isEmpty()) { angle = it }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                OutlinedTextField(
                                    value = tapeText, onValueChange = { tapeText = it },
                                    label = { Text("אורך (${Prefs.unitSuffix})") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    singleLine = true, modifier = Modifier.weight(1f),
                                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Orange, cursorColor = Orange),
                                )
                                Button(
                                    onClick = { Prefs.parseToMm(tapeText)?.let { addWall(it); tapeText = "" } },
                                    enabled = Prefs.parseToMm(tapeText)?.let { it > 0 } == true,
                                    colors = ButtonDefaults.buttonColors(containerColor = Orange, contentColor = Color.White),
                                    modifier = Modifier.heightIn(min = 56.dp),
                                ) { Text("➕ הוסף", fontWeight = FontWeight.Bold) }
                            }
                        }
                        Mode.P2P -> {
                            Text("מדידת P2P (חצובה · X6) בונה מתאר-מלא מעמדה-אחת ומוסיפה אותו לשרטוט.", fontSize = 12.sp, color = Muted)
                            Button(
                                onClick = { nav.navigate("p2p/$roomId") },
                                colors = ButtonDefaults.buttonColors(containerColor = Teal, contentColor = Color.White),
                                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                            ) { Text("🎯 פתח מדידת P2P", fontWeight = FontWeight.Bold) }
                        }
                        Mode.ELEMENT -> {
                            Text("בחר קיר להוספת דלת/חלון/פתח/ארון:", fontSize = 12.sp, color = Muted)
                            WallChips(walls) { wid -> nav.navigate("wall/$wid") }
                        }
                    }
                }
            }
        }

        // ── סרגל-כלים קטן ונייד (נגרר · הצמדה לצד · ✕ מכווץ) ──
        MovableRail(
            mode = mode,
            right = railRight,
            offsetY = railY,
            collapsed = railCollapsed,
            onSelect = { mode = it },
            // חוסם את הסרגל לגבולות-המסך — הסרגל מיושר-למרכז, אז ההיסט מוגבל ל-±חצי-גובה
            // (לפחות חצי-סרגל נשאר גלוי; מונע "זריקה" של הסרגל אל מחוץ-למסך · QA #3).
            onDragY = { d -> railY = if (boxHpx > 0) (railY + d).coerceIn(-boxHpx / 2f, boxHpx / 2f) else railY + d },
            onSnapSide = { railRight = it },
            onToggleCollapse = { railCollapsed = !railCollapsed },
        )
    }
}

@Composable
private fun ConnChip(connected: String?) {
    val on = connected != null
    Surface(shape = RoundedCornerShape(999.dp), color = if (on) OkGreen.copy(alpha = 0.14f) else Muted.copy(alpha = 0.12f)) {
        Text(
            if (on) "🟢 $connected" else "⚪ לא-מחובר",
            fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = if (on) OkGreen else Muted,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        )
    }
}

@Composable
private fun ReadoutTag(distanceMm: Double?) {
    Surface(shape = RoundedCornerShape(12.dp), color = Orange.copy(alpha = 0.12f), border = androidx.compose.foundation.BorderStroke(1.5.dp, Orange)) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 4.dp), verticalAlignment = Alignment.Bottom) {
            Text(distanceMm?.let { cm(it) } ?: "—", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Orange)
            Text(" ס\"מ", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Orange, modifier = Modifier.padding(bottom = 3.dp))
        }
    }
}

@Composable
private fun AngleChips(current: Double, isFirst: Boolean, onPick: (Double) -> Unit) {
    if (isFirst) {
        Text("קיר ראשון — הוסף אורך; הזוויות נקבעות מהקיר-השני.", fontSize = 11.sp, color = Muted)
        return
    }
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        AngleChip("↱ ימינה 90°", 90.0, current, onPick)
        AngleChip("↰ שמאלה 90°", -90.0, current, onPick)
        AngleChip("↑ ישר", 0.0, current, onPick)
        AngleChip("45°", 45.0, current, onPick)
        AngleChip("-45°", -45.0, current, onPick)
    }
}

@Composable
private fun AngleChip(label: String, value: Double, current: Double, onPick: (Double) -> Unit) {
    val on = current == value
    Surface(
        onClick = { onPick(value) },
        shape = RoundedCornerShape(999.dp),
        color = if (on) Teal else Teal.copy(alpha = 0.10f),
    ) {
        Text(label, fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = if (on) Color.White else Teal,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp))
    }
}

@Composable
private fun WallChips(walls: List<WallEntity>, onPick: (Long) -> Unit) {
    if (walls.isEmpty()) {
        Text("אין קירות עדיין — מדוד קודם (📡 / ✍️).", fontSize = 13.sp, color = Muted)
        return
    }
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        walls.sortedBy { it.idx }.forEach { w ->
            Surface(onClick = { onPick(w.id) }, shape = RoundedCornerShape(12.dp), color = Orange.copy(alpha = 0.10f)) {
                Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                    Text("קיר ${w.idx + 1}", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Ink)
                    Text(Prefs.lenValue(w.length), fontSize = 11.sp, color = Muted)
                }
            }
        }
    }
}

@Composable
private fun MiniBtn(glyph: String, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = RoundedCornerShape(12.dp), color = Cream, border = androidx.compose.foundation.BorderStroke(1.dp, Muted.copy(alpha = 0.4f))) {
        Box(Modifier.size(56.dp), contentAlignment = Alignment.Center) { Text(glyph, fontSize = 20.sp, color = Ink) }
    }
}

@Composable
private fun androidx.compose.foundation.layout.BoxScope.MovableRail(
    mode: Mode,
    right: Boolean,
    offsetY: Float,
    collapsed: Boolean,
    onSelect: (Mode) -> Unit,
    onDragY: (Float) -> Unit,
    onSnapSide: (Boolean) -> Unit,
    onToggleCollapse: () -> Unit,
) {
    val align = if (right) Alignment.CenterEnd else Alignment.CenterStart
    if (collapsed) {
        // מכווץ — רק ידית-פתיחה קטנה (מציגה את הכלי-הפעיל)
        Surface(
            onClick = onToggleCollapse,
            shape = RoundedCornerShape(16.dp),
            color = Teal,
            shadowElevation = 6.dp,
            modifier = Modifier.align(align).padding(horizontal = 4.dp).offset { IntOffset(0, offsetY.roundToInt()) },
        ) {
            Box(Modifier.size(width = 40.dp, height = 48.dp), contentAlignment = Alignment.Center) {
                Text(mode.glyph, fontSize = 18.sp)
            }
        }
        return
    }
    Surface(
        shape = RoundedCornerShape(22.dp),
        color = Color.White.copy(alpha = 0.94f),
        shadowElevation = 8.dp,
        modifier = Modifier
            .align(align)
            .padding(horizontal = 6.dp)
            .offset { IntOffset(0, offsetY.roundToInt()) }
            .pointerInput(Unit) {
                detectDragGestures(onDrag = { change, drag -> change.consume(); onDragY(drag.y) })
            },
    ) {
        Column(Modifier.padding(vertical = 6.dp, horizontal = 4.dp), verticalArrangement = Arrangement.spacedBy(5.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            // ידית-החלפת-צד (גרירה = הזזה למעלה/מטה)
            Surface(onClick = { onSnapSide(!right) }, shape = RoundedCornerShape(8.dp), color = Cream) {
                Box(Modifier.size(width = 46.dp, height = 18.dp), contentAlignment = Alignment.Center) { Text("⇄", fontSize = 13.sp, color = Muted) }
            }
            Mode.entries.forEach { m -> RailBtn(m.glyph, m.label, m == mode) { onSelect(m) } }
            // ✕ מכווץ את הסרגל (לא יוצא מהמדידה)
            Surface(onClick = onToggleCollapse, shape = RoundedCornerShape(12.dp), color = Cream) {
                Box(Modifier.size(46.dp), contentAlignment = Alignment.Center) { Text("✕", fontSize = 16.sp, color = Muted) }
            }
        }
    }
}

@Composable
private fun RailBtn(glyph: String, label: String, active: Boolean, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = RoundedCornerShape(14.dp), color = if (active) Teal else Color.Transparent, modifier = Modifier.size(46.dp)) {
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(glyph, fontSize = 17.sp)
            Text(label, fontSize = 8.sp, fontWeight = FontWeight.Bold, color = if (active) Color.White else Ink)
        }
    }
}

/** מ"מ → ס"מ עם ספרה-עשרונית (בקשת-מודד 195516). */
private fun cm(mm: Double): String = String.format("%.1f", mm / 10.0)
