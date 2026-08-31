package il.co.soline.measure.ui.draw

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import kotlinx.coroutines.launch
import kotlin.math.atan2
import kotlin.math.hypot

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  SketchInjectScreen — "ציור-באצבע → הזרקת-לייזר" (תזרים-השדה §8).
 *
 *  המודד מצייר את **צורת-החדר** על המסך (הקשה-הקשה = פינות), מקבל מצולע-גס, ואז
 *  **מזריק אורך-D2 אמיתי לכל קטע** (בוחר קיר → יורה לייזר). הזוויות נגזרות
 *  מהסקיצה (מוצמדות ל-0/45/90/135), האורכים מהלייזר — וכך נבנה מתאר-מדויק.
 *
 *  עיקרון: הסקיצה נותנת את ה*צורה* (יחסים/פניות), הלייזר נותן את ה*מידות*. לכן
 *  "בנה קירות" נדרך רק כשכל-קטע קיבל אורך-אמת. הבנייה מכבדת את מוסכמת WallBuilder
 *  (angle = פנייה אל הקיר-הבא), בדיוק כמו המנוע.
 * ─────────────────────────────────────────────────────────────────────────────
 */

private val SNAP_TURNS = doubleArrayOf(0.0, 45.0, 90.0, 135.0, 180.0, -45.0, -90.0, -135.0)

@Composable
fun SketchInjectHost(nav: NavController, roomId: Long) {
    val scope = rememberCoroutineScope()
    val repo = SolineApp.instance.repo
    val ble = SolineApp.instance.ble
    val reading by ble.lastReading.collectAsState()
    val connected by ble.connected.collectAsState(null)

    val existing by repo.walls(roomId).collectAsState(emptyList())
    val pts = remember { mutableStateListOf<Offset>() }
    var closed by remember { mutableStateOf(false) }
    // אורך-אמת (מ"מ) פר-קטע לפי אינדקס-הקטע; חסר = טרם-הוזרק.
    val lens = remember { mutableStateMapOf<Int, Double>() }
    var selEdge by remember { mutableStateOf<Int?>(null) }
    var manual by remember { mutableStateOf("") }
    // ברירת-מחדל: **לא-למחוק** את השרטוט הקיים (בקשת-מודד 192339 — "השרטוט לא נמחק/משתנה").
    // מוסיפים את הסקיצה לקירות-הקיימים; החלפה רק בבחירה מפורשת.
    var replaceExisting by remember { mutableStateOf(false) }

    val n = pts.size
    val edges = if (closed && n >= 3) n else (n - 1).coerceAtLeast(0)
    val allInjected = edges >= 1 && (0 until edges).all { lens[it] != null }

    fun addLen(mm: Double) {
        val e = selEdge ?: return
        if (mm > 0 && e in 0 until edges) lens[e] = mm
    }

    fun build() {
        if (edges < 1 || !allInjected) return
        val dirs = DoubleArray(edges) { i ->
            val a = pts[i]; val b = pts[(i + 1) % n]
            atan2((b.y - a.y).toDouble(), (b.x - a.x).toDouble())
        }
        scope.launch {
            if (replaceExisting) repo.clearRoomWalls(roomId)
            for (i in 0 until edges) {
                val turn = if (i < edges - 1) {
                    snapTurn(Math.toDegrees(normalizeRad(dirs[i + 1] - dirs[i])))
                } else 0.0
                // הוספה לקירות-הקיימים (מוסכמת WallBuilder: angle = פנייה-אל-הבא).
                repo.addWall(roomId, lens.getValue(i), Prefs.defaultWallHeightMm, turn)
            }
            nav.popBackStack()
        }
    }

    Box(Modifier.fillMaxSize().background(Cream)) {
        Column(Modifier.fillMaxSize()) {
            // ── סרגל-עליון ──
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
                    Text("ציור-באצבע → הזרקה", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Ink)
                    Text("$edges קטעים · ${lens.size}/$edges הוזרקו", fontSize = 11.sp, color = Muted)
                }
                ReadTag(reading?.distanceMm, connected != null)
            }

            // ── קנבס-הסקיצה (הקשה = פינה) ──
            Box(Modifier.weight(1f).fillMaxWidth()) {
                SketchCanvas(pts = pts, closed = closed, lens = lens, selEdge = selEdge, n = n, edges = edges,
                    onTap = { pts.add(it); closed = false })
                if (pts.isEmpty()) {
                    Text(
                        "הקש על המסך כדי לסמן את פינות-החדר, פינה-אחר-פינה.",
                        fontSize = 13.sp, color = Muted,
                        modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    )
                }
            }

            // ── רשימת-קטעים (בחר קיר להזרקה) ──
            if (edges >= 1) {
                Row(
                    Modifier.fillMaxWidth().background(Color.White).horizontalScroll(rememberScrollState())
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    for (e in 0 until edges) {
                        val on = selEdge == e
                        val mm = lens[e]
                        Surface(
                            onClick = { selEdge = e },
                            shape = RoundedCornerShape(12.dp),
                            color = if (on) Orange else if (mm != null) OkGreen.copy(alpha = 0.14f) else Cream,
                            border = androidx.compose.foundation.BorderStroke(1.dp, if (on) Orange else Muted.copy(alpha = 0.3f)),
                        ) {
                            Column(Modifier.padding(horizontal = 12.dp, vertical = 7.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("קיר ${e + 1}", fontSize = 12.sp, fontWeight = FontWeight.Bold,
                                    color = if (on) Color.White else Ink)
                                Text(mm?.let { "${cm(it)} ס\"מ" } ?: "—", fontSize = 11.sp,
                                    color = if (on) Color.White else if (mm != null) OkGreen else Muted)
                            }
                        }
                    }
                }
            }

            // ── פאנל-בקרה ──
            Surface(color = Color.White) {
                Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SmallBtn("↩ בטל נקודה", enabled = pts.isNotEmpty()) {
                            if (pts.isNotEmpty()) { pts.removeAt(pts.lastIndex); closed = false; selEdge = null }
                        }
                        SmallBtn(if (closed) "◻ פתח מתאר" else "⬡ סגור מתאר", enabled = n >= 3) { closed = !closed }
                        SmallBtn("🗑 נקה", enabled = pts.isNotEmpty()) { pts.clear(); lens.clear(); selEdge = null; closed = false }
                    }
                    // הזרקה לקטע-הנבחר
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = manual, onValueChange = { manual = it },
                            label = { Text(selEdge?.let { "אורך קיר ${it + 1} (${Prefs.unitSuffix})" } ?: "בחר קיר קודם") },
                            enabled = selEdge != null,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true, modifier = Modifier.weight(1f),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Orange, cursorColor = Orange),
                        )
                        Button(
                            onClick = { Prefs.parseToMm(manual)?.let { addLen(it); manual = "" } },
                            enabled = selEdge != null && Prefs.parseToMm(manual)?.let { it > 0 } == true,
                            colors = ButtonDefaults.buttonColors(containerColor = Ink, contentColor = Color.White),
                            modifier = Modifier.heightIn(min = 56.dp),
                        ) { Text("קבע", fontWeight = FontWeight.Bold) }
                    }
                    Button(
                        onClick = { reading?.distanceMm?.let { addLen(it) } },
                        enabled = selEdge != null && reading?.distanceMm?.let { it > 0 } == true,
                        colors = ButtonDefaults.buttonColors(containerColor = Orange, contentColor = Color.White),
                        modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                    ) {
                        Text(
                            when {
                                selEdge == null -> "בחר קיר, ואז הזרק לייזר"
                                reading?.distanceMm?.let { it > 0 } == true -> "📡 הזרק ${cm(reading!!.distanceMm!!)} ס\"מ לקיר ${selEdge!! + 1}"
                                else -> "מדוד עם הלייזר…"
                            },
                            fontWeight = FontWeight.Bold, fontSize = 15.sp,
                        )
                    }
                    // כשיש כבר קירות — בוחרים אם להוסיף (ברירת-מחדל) או להחליף (192339).
                    if (existing.isNotEmpty()) {
                        SmallBtn(
                            if (replaceExisting) "🗑 מצב: מחליף את ${existing.size} הקירות הקיימים"
                            else "➕ מצב: מוסיף ל-${existing.size} הקירות הקיימים (לא-מוחק)",
                            enabled = true,
                        ) { replaceExisting = !replaceExisting }
                    }
                    Button(
                        onClick = { build() },
                        enabled = allInjected,
                        colors = ButtonDefaults.buttonColors(containerColor = OkGreen, contentColor = Color.White),
                        modifier = Modifier.fillMaxWidth().heightIn(min = 54.dp),
                    ) {
                        Text(if (allInjected) "🏗 בנה קירות מהסקיצה" else "הזרק אורך לכל הקטעים כדי לבנות",
                            fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun SketchCanvas(
    pts: List<Offset>,
    closed: Boolean,
    lens: Map<Int, Double>,
    selEdge: Int?,
    n: Int,
    edges: Int,
    onTap: (Offset) -> Unit,
) {
    val teal = Teal.toArgb()
    Canvas(
        Modifier.fillMaxSize().padding(8.dp)
            .pointerInput(Unit) { detectTapGestures(onTap = { onTap(it) }) },
    ) {
        val lbl = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = teal; textAlign = Paint.Align.CENTER; textSize = 12.dp.toPx() }
        // קטעים
        for (i in 0 until edges) {
            val a = pts[i]; val b = pts[(i + 1) % n]
            drawLine(if (selEdge == i) Orange else Ink, a, b, strokeWidth = 3.dp.toPx(), cap = StrokeCap.Round)
            val mid = Offset((a.x + b.x) / 2f, (a.y + b.y) / 2f)
            val mm = lens[i]
            drawContext.canvas.nativeCanvas.drawText(
                mm?.let { "${cm(it)}" } ?: "קיר ${i + 1}", mid.x, mid.y - 6.dp.toPx(), lbl,
            )
        }
        // פינות
        pts.forEachIndexed { i, p ->
            drawCircle(if (i == 0) OkGreen else Orange, 6.dp.toPx(), p)
        }
    }
}

@Composable
private fun ReadTag(distanceMm: Double?, on: Boolean) {
    Surface(shape = RoundedCornerShape(12.dp), color = Orange.copy(alpha = 0.12f), border = androidx.compose.foundation.BorderStroke(1.5.dp, Orange)) {
        Row(Modifier.padding(horizontal = 10.dp, vertical = 4.dp), verticalAlignment = Alignment.Bottom) {
            Text(if (on) (distanceMm?.let { cm(it) } ?: "—") else "⚪", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Orange)
            Text(" ס\"מ", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Orange, modifier = Modifier.padding(bottom = 2.dp))
        }
    }
}

@Composable
private fun SmallBtn(label: String, enabled: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = { if (enabled) onClick() },
        shape = RoundedCornerShape(10.dp),
        color = if (enabled) Cream else Cream.copy(alpha = 0.4f),
        border = androidx.compose.foundation.BorderStroke(1.dp, Muted.copy(alpha = if (enabled) 0.4f else 0.15f)),
    ) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold,
            color = if (enabled) Ink else Muted.copy(alpha = 0.5f),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
    }
}

// ── גאומטריה ──────────────────────────────────────────────────────────────────

private fun normalizeRad(r: Double): Double {
    var d = r
    while (d <= -Math.PI) d += 2 * Math.PI
    while (d > Math.PI) d -= 2 * Math.PI
    return d
}

/** מצמיד זווית-פנייה לערך-סטנדרטי הקרוב (0/45/90/135/180 · ± ). */
private fun snapTurn(deg: Double): Double {
    var best = SNAP_TURNS[0]; var bestD = Double.MAX_VALUE
    for (t in SNAP_TURNS) {
        val d = kotlin.math.abs(deg - t)
        if (d < bestD) { bestD = d; best = t }
    }
    return best
}

private fun cm(mm: Double): String = String.format("%.1f", mm / 10.0)

@Suppress("unused")
private fun segLen(a: Offset, b: Offset): Float = hypot(b.x - a.x, b.y - a.y)
