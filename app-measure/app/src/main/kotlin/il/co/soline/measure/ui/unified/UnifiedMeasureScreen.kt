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
import androidx.compose.foundation.verticalScroll
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
import il.co.soline.measure.data.RoomSurvey
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.canvas.RoomPlanCanvas
import il.co.soline.measure.ui.photo.WallPhotoBar
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/*
 * מנוע-המדידה המאוחד — מסך-מדידה אחד, מסלול-מודד מונחה (Phase-1).
 *
 * עיקרון-הליבה: **מתאר-חדר אחד ומתמשך** (RoomPlanCanvas מציג תמיד את אותם קירות מ-repo);
 * מעבר-תחנה לעולם לא-מחליף את השרטוט. המסך מוביל את המודד לאורך תזרים-השדה שלו
 * ([[soline-field-workflow]]) תחנה-אחר-תחנה — כל תחנה מחברת יכולת-קיימת:
 *   גישה · שיטה · קירות · חזיתות · אלמנטים · תמונות · בדיקה-3D · סגירה.
 * ניווט-ראשי = סרגל-תחנות אופקי (עמיד לאורך ולרוחב, בלי לאבד נתונים). בתחנת-הקירות
 * נוסף סרגל-נייד קטן להחלפת-שיטת-לכידה מהירה (לייזר/מטר · בקשות-מודד 205033/211325).
 */

/** תחנות המסלול המונחה (לפי סדר תזרים-השדה). */
private enum class Station(val glyph: String, val label: String) {
    ACCESS("🚪", "גישה"),
    METHOD("🎯", "שיטה"),
    WALLS("📐", "קירות"),
    ELEV("🖼️", "חזיתות"),
    ELEMENTS("🧩", "אלמנטים"),
    PHOTOS("📷", "תמונות"),
    CHECK3D("🧊", "בדיקה 3D"),
    CLOSE("✅", "סגירה"),
}

/** שיטת-לכידה בתוך-המנוע (תחנת-קירות). שאר-השיטות = ניווט למסך-ייעודי. */
private enum class Capture(val glyph: String, val label: String) {
    LASER("📡", "לייזר"),
    TAPE("✍️", "מטר"),
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

    // בקשת-מודד 210307: פתיחת-המדידה (שיטה/גבהים) היא הדבר-הראשון בפתיחת-חדר.
    var station by remember { mutableStateOf(Station.METHOD) }
    val visited = remember { mutableStateOf(setOf(Station.METHOD)) }
    var capture by remember { mutableStateOf(Capture.LASER) }
    var angle by remember { mutableStateOf(90.0) } // זווית-הפנייה לקיר-הבא
    var tapeText by remember { mutableStateOf("") }
    var railRight by remember { mutableStateOf(false) } // צד-הצמדה של הסרגל (205033)
    var railY by remember { mutableStateOf(0f) }         // גובה-הסרגל (נגרר)
    var railCollapsed by remember { mutableStateOf(false) } // ✕ מכווץ, לא יוצא (211325)
    var boxHpx by remember { mutableStateOf(0) }          // גובה-המסך (px) — לחסימת-גרירה (QA #3)

    fun go(s: Station) { station = s; visited.value = visited.value + s }

    fun addWall(lenMm: Double) {
        if (lenMm <= 0) return
        // הזווית שנבחרה היא הפנייה בין הקיר-הקודם לחדש — נשמרת על הקיר ה*קודם*
        // (מוסכמת WallBuilder). הקיר-הראשון: אין-קודם, הזווית נעדרת ולכן חסרת-משמעות.
        val turnFromPrev = if (walls.isEmpty()) 0.0 else angle
        scope.launch { repo.addWallWithTurn(roomId, lenMm, Prefs.defaultWallHeightMm, turnFromPrev) }
    }

    Box(Modifier.fillMaxSize().background(Cream).onSizeChanged { boxHpx = it.height }) {
        Column(Modifier.fillMaxSize()) {
            // ── סרגל-עליון: יציאה · חדר · תחנה N/8 · חיבור · קריאה-חיה ──
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
                    Text(
                        "תחנה ${station.ordinal + 1}/${Station.entries.size} · ${station.label} · ${walls.size} קירות",
                        fontSize = 11.sp, color = Muted,
                    )
                }
                ConnChip(connected)
                Spacer(Modifier.width(10.dp))
                ReadoutTag(reading?.distanceMm)
            }

            // ── סרגל-התחנות (ניווט-ראשי · עמיד לאורך ולרוחב) ──
            // ✓ מגובה-בנתונים (§4): קירות שנמדדו · חזית שנלכדה · חדר שנסגר. שאר-התחנות = "נצפו".
            val done = buildSet {
                if (walls.isNotEmpty()) add(Station.WALLS)
                if (walls.any { it.framePointsJson.isNotBlank() }) add(Station.ELEV)
                if ((room?.closedAt ?: 0L) != 0L) add(Station.CLOSE)
            }
            StationBar(current = station, visited = visited.value, done = done) { go(it) }

            // ── חיווי גובה-תקרה מין/מקס (D2 · §5) — נראה כשנלכדו גבהים ──
            val heights = room?.heightSweepMm?.let { RoomSurvey.parseHeights(it) } ?: emptyList()
            if (heights.isNotEmpty()) CeilingChip(heights.min(), heights.max())

            // ── קנבס-המתאר המתמשך (תמיד אותו שרטוט) ──
            Box(Modifier.weight(1f).fillMaxWidth()) {
                RoomPlanCanvas(walls = walls, accessoriesByWall = emptyMap(), modifier = Modifier.fillMaxSize())
            }

            // ── פאנל-התחנה-הפעילה (משתנה; המתאר לא) ──
            Surface(color = Color.White) {
                Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    when (station) {
                        Station.ACCESS -> AccessPanel(nav, roomId)
                        Station.METHOD -> MethodPanel(nav, roomId) { capture = it; go(Station.WALLS) }
                        Station.WALLS -> WallsPanel(
                            nav = nav, roomId = roomId, walls = walls, capture = capture,
                            angle = angle, onAngle = { angle = it },
                            tapeText = tapeText, onTape = { tapeText = it },
                            reading = reading?.distanceMm,
                            onAdd = { addWall(it) },
                            onUndo = { scope.launch { repo.removeLastWall(roomId) } },
                        )
                        Station.ELEV -> StationWallPicker(
                            title = "בחר קיר למדידת-חזית (X6 · יריית-נקודות → גאומטריה אמיתית):",
                            walls = walls,
                        ) { wid -> nav.navigate("elevation/$wid") }
                        Station.ELEMENTS -> StationWallPicker(
                            title = "בחר קיר להוספת/עריכת אלמנטים (מרכזים/היסטים + הערות):",
                            walls = walls,
                        ) { wid -> nav.navigate("wall/$wid") }
                        Station.PHOTOS -> PhotosPanel(walls)
                        Station.CHECK3D -> ActionPanel(
                            note = "בדוק את עצמך: כל מה שאתה רואה בעין — קיים בשרטוט?",
                            label = "🧊 פתח תצוגת 3D",
                            color = Teal,
                        ) { nav.navigate("view3d/$roomId") }
                        Station.CLOSE -> ClosePanel(nav, roomId)
                    }

                    // ── ניווט תחנה קודמת/הבאה ──
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        val idx = station.ordinal
                        StepNav("◀ הקודם", enabled = idx > 0) { go(Station.entries[idx - 1]) }
                        Spacer(Modifier.weight(1f))
                        StepNav("הבא ▶", enabled = idx < Station.entries.lastIndex) { go(Station.entries[idx + 1]) }
                    }
                }
            }
        }

        // ── סרגל-שיטה נייד (רק בתחנת-הקירות · נגרר · הצמדה-לצד · ✕ מכווץ) ──
        if (station == Station.WALLS) {
            MovableCaptureRail(
                capture = capture,
                right = railRight,
                offsetY = railY,
                collapsed = railCollapsed,
                onSelect = { capture = it },
                onDragY = { d -> railY = if (boxHpx > 0) (railY + d).coerceIn(-boxHpx / 2f, boxHpx / 2f) else railY + d },
                onSnapSide = { railRight = it },
                onToggleCollapse = { railCollapsed = !railCollapsed },
            )
        }
    }
}

// ── סרגל-התחנות ──────────────────────────────────────────────────────────────

@Composable
private fun StationBar(current: Station, visited: Set<Station>, done: Set<Station>, onPick: (Station) -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(Cream).horizontalScroll(rememberScrollState())
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Station.entries.forEach { s ->
            val on = s == current
            val isDone = s in done
            val seen = !isDone && s in visited && s != current
            Surface(
                onClick = { onPick(s) },
                shape = RoundedCornerShape(999.dp),
                color = if (on) Teal else Color.White,
                border = androidx.compose.foundation.BorderStroke(1.dp, if (on) Teal else Muted.copy(alpha = 0.3f)),
            ) {
                Row(
                    Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text("${s.ordinal + 1}", fontSize = 10.sp, fontWeight = FontWeight.Bold,
                        color = if (on) Color.White.copy(alpha = 0.8f) else Muted)
                    Text(s.glyph, fontSize = 13.sp)
                    Text(s.label, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        color = if (on) Color.White else Ink)
                    if (isDone) Text("✓", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = OkGreen)
                    else if (seen) Text("•", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Muted)
                }
            }
        }
    }
}

// ── פאנלים לפי-תחנה ───────────────────────────────────────────────────────────

@Composable
private fun AccessPanel(nav: NavController, roomId: Long) {
    Text("פרטי-הגישה נלכדו בפתיחת-הפרויקט (מעלית · מנוף · מעברים).", fontSize = 13.sp, color = Ink)
    Text("סקור בעין את דרך-הגישה; אם משהו השתנה — עדכן כאן.", fontSize = 11.sp, color = Muted)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        LinkBtn("✏️ ערוך פרטי-גישה", Teal) { nav.navigate("intake") }
        LinkBtn("⚙️ פרטי-פתיחה", Muted) { nav.navigate("measurestart/$roomId") }
    }
}

@Composable
private fun MethodPanel(nav: NavController, roomId: Long, onPickInEngine: (Capture) -> Unit) {
    Text("הסתכל על החלל ובחר שיטת-מדידה (אפשר לשלב):", fontSize = 13.sp, color = Ink)
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        MethodCard("📡", "לייזר-קטן", "D2/בוש") { onPickInEngine(Capture.LASER) }
        MethodCard("✍️", "מטר", "ידני") { onPickInEngine(Capture.TAPE) }
        MethodCard("🎯", "X6 P2P", "מעמדה") { nav.navigate("p2p/$roomId") }
        MethodCard("⚙️", "מתאר", "חצי-אוטו") { nav.navigate("semiauto/$roomId") }
        MethodCard("✏️", "ציור-באצבע", "→ הזרקה") { nav.navigate("sketch/$roomId") }
        MethodCard("📏", "גבהי-תקרה", "מין/מקס") { nav.navigate("measurestart/$roomId") }
        MethodCard("📐", "מפלס-רצפה", "שיפוע") { nav.navigate("floor/$roomId") }
    }
}

@Composable
private fun WallsPanel(
    nav: NavController,
    roomId: Long,
    walls: List<WallEntity>,
    capture: Capture,
    angle: Double,
    onAngle: (Double) -> Unit,
    tapeText: String,
    onTape: (String) -> Unit,
    reading: Double?,
    onAdd: (Double) -> Unit,
    onUndo: () -> Unit,
) {
    // קישורי-שיטה מתקדמים (מסכים-ייעודיים)
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        LinkBtn("🎯 P2P", Teal) { nav.navigate("p2p/$roomId") }
        LinkBtn("⚙️ מתאר-אוטו", Teal) { nav.navigate("semiauto/$roomId") }
        LinkBtn("✏️ שרטוט-חי", Teal) { nav.navigate("draw/$roomId") }
    }
    AngleChips(angle, walls.isEmpty(), onAngle)
    when (capture) {
        Capture.LASER -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MiniBtn("↩", onUndo)
            Button(
                onClick = { reading?.let { onAdd(it) } },
                enabled = reading?.let { it > 0 } == true,
                colors = ButtonDefaults.buttonColors(containerColor = Orange, contentColor = Color.White),
                modifier = Modifier.weight(1f).heightIn(min = 56.dp),
            ) {
                Text(reading?.let { "➕ הוסף קיר · ${cm(it)} ס\"מ" } ?: "מדוד עם הלייזר…",
                    fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
        Capture.TAPE -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MiniBtn("↩", onUndo)
            OutlinedTextField(
                value = tapeText, onValueChange = onTape,
                label = { Text("אורך (${Prefs.unitSuffix})") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true, modifier = Modifier.weight(1f),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Orange, cursorColor = Orange),
            )
            Button(
                onClick = { Prefs.parseToMm(tapeText)?.let { onAdd(it); onTape("") } },
                enabled = Prefs.parseToMm(tapeText)?.let { it > 0 } == true,
                colors = ButtonDefaults.buttonColors(containerColor = Orange, contentColor = Color.White),
                modifier = Modifier.heightIn(min = 56.dp),
            ) { Text("➕ הוסף", fontWeight = FontWeight.Bold) }
        }
    }
    Text("שיטה: ${capture.label} · בחר זווית-פנייה לקיר-הבא. הסרגל-הנייד מחליף שיטה.",
        fontSize = 11.sp, color = Muted)
}

@Composable
private fun PhotosPanel(walls: List<WallEntity>) {
    Text("צלם את איזור-המדידה — הקשר, פרטים, מכשולים, צמתים:", fontSize = 13.sp, color = Ink)
    if (walls.isEmpty()) {
        Text("אין קירות עדיין — מדוד קודם כדי לצלם חזית-חזית.", fontSize = 12.sp, color = Muted)
        return
    }
    Column(
        Modifier.fillMaxWidth().heightIn(max = 220.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        walls.sortedBy { it.idx }.forEach { w ->
            Text("קיר ${w.idx + 1}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Ink)
            WallPhotoBar(roomId = w.roomId, wallId = w.id, wallIdx = w.idx)
        }
    }
}

@Composable
private fun ClosePanel(nav: NavController, roomId: Long) {
    Text("סיום החדר — אמת שלמות, ואז סגור ועבור לחדר-הבא:", fontSize = 13.sp, color = Ink)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(
            onClick = { nav.navigate("verify/$roomId") },
            colors = ButtonDefaults.buttonColors(containerColor = Teal, contentColor = Color.White),
            modifier = Modifier.weight(1f).heightIn(min = 52.dp),
        ) { Text("✔ אימות-סופי", fontWeight = FontWeight.Bold) }
        Button(
            onClick = { nav.navigate("closeroom/$roomId") },
            colors = ButtonDefaults.buttonColors(containerColor = OkGreen, contentColor = Color.White),
            modifier = Modifier.weight(1f).heightIn(min = 52.dp),
        ) { Text("🔒 סגירת-חדר", fontWeight = FontWeight.Bold) }
    }
}

@Composable
private fun ActionPanel(note: String, label: String, color: Color, onClick: () -> Unit) {
    Text(note, fontSize = 13.sp, color = Ink)
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(containerColor = color, contentColor = Color.White),
        modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
    ) { Text(label, fontWeight = FontWeight.Bold) }
}

@Composable
private fun StationWallPicker(title: String, walls: List<WallEntity>, onPick: (Long) -> Unit) {
    Text(title, fontSize = 13.sp, color = Ink)
    WallChips(walls, onPick)
}

// ── רכיבי-עזר ─────────────────────────────────────────────────────────────────

@Composable
private fun MethodCard(glyph: String, title: String, sub: String, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = RoundedCornerShape(14.dp), color = Teal.copy(alpha = 0.08f),
        border = androidx.compose.foundation.BorderStroke(1.dp, Teal.copy(alpha = 0.3f))) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(glyph, fontSize = 22.sp)
            Text(title, fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = Ink)
            Text(sub, fontSize = 10.sp, color = Muted)
        }
    }
}

@Composable
private fun LinkBtn(label: String, color: Color, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = RoundedCornerShape(999.dp), color = color.copy(alpha = 0.1f)) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = color,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp))
    }
}

@Composable
private fun StepNav(label: String, enabled: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = { if (enabled) onClick() },
        shape = RoundedCornerShape(12.dp),
        color = if (enabled) Cream else Cream.copy(alpha = 0.4f),
        border = androidx.compose.foundation.BorderStroke(1.dp, Muted.copy(alpha = if (enabled) 0.4f else 0.15f)),
    ) {
        Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold,
            color = if (enabled) Ink else Muted.copy(alpha = 0.5f),
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 9.dp))
    }
}

@Composable
private fun CeilingChip(minMm: Double, maxMm: Double) {
    Surface(
        Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 2.dp),
        shape = RoundedCornerShape(10.dp),
        color = Teal.copy(alpha = 0.08f),
    ) {
        Row(
            Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("📏 תקרה", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Teal)
            Text("מקס ${cm(maxMm)} · מין ${cm(minMm)} ס\"מ", fontSize = 11.sp, color = Ink)
            if (maxMm != minMm) Text("שיפוע ${cm(maxMm - minMm)}", fontSize = 11.sp, color = Muted)
            Text("· מחייב = מין", fontSize = 10.sp, color = Muted)
        }
    }
}

@Composable
private fun ConnChip(connected: String?) {
    val on = connected != null
    Surface(shape = RoundedCornerShape(999.dp), color = if (on) OkGreen.copy(alpha = 0.14f) else Muted.copy(alpha = 0.12f)) {
        Text(
            if (on) "🟢 $connected" else "⚪ לא-מחובר",
            fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (on) OkGreen else Muted,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        )
    }
}

@Composable
private fun ReadoutTag(distanceMm: Double?) {
    Surface(shape = RoundedCornerShape(12.dp), color = Orange.copy(alpha = 0.12f), border = androidx.compose.foundation.BorderStroke(1.5.dp, Orange)) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 4.dp), verticalAlignment = Alignment.Bottom) {
            Text(distanceMm?.let { cm(it) } ?: "—", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Orange)
            Text(" ס\"מ", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Orange, modifier = Modifier.padding(bottom = 3.dp))
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
        Text("אין קירות עדיין — מדוד קודם בתחנת 'קירות'.", fontSize = 13.sp, color = Muted)
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

// ── סרגל-שיטה נייד (תחנת-קירות בלבד) ─────────────────────────────────────────

@Composable
private fun androidx.compose.foundation.layout.BoxScope.MovableCaptureRail(
    capture: Capture,
    right: Boolean,
    offsetY: Float,
    collapsed: Boolean,
    onSelect: (Capture) -> Unit,
    onDragY: (Float) -> Unit,
    onSnapSide: (Boolean) -> Unit,
    onToggleCollapse: () -> Unit,
) {
    val align = if (right) Alignment.CenterEnd else Alignment.CenterStart
    if (collapsed) {
        Surface(
            onClick = onToggleCollapse,
            shape = RoundedCornerShape(16.dp),
            color = Teal,
            shadowElevation = 6.dp,
            modifier = Modifier.align(align).padding(horizontal = 4.dp).offset { IntOffset(0, offsetY.roundToInt()) },
        ) {
            Box(Modifier.size(width = 40.dp, height = 48.dp), contentAlignment = Alignment.Center) {
                Text(capture.glyph, fontSize = 18.sp)
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
            Surface(onClick = { onSnapSide(!right) }, shape = RoundedCornerShape(8.dp), color = Cream) {
                Box(Modifier.size(width = 46.dp, height = 18.dp), contentAlignment = Alignment.Center) { Text("⇄", fontSize = 13.sp, color = Muted) }
            }
            Capture.entries.forEach { c -> RailBtn(c.glyph, c.label, c == capture) { onSelect(c) } }
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
