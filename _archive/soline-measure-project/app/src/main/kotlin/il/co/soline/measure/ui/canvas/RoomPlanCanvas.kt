package il.co.soline.measure.ui.canvas

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.geometry.WallBuilder
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.WarnAmber
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/* מבט-על 2D (§3 ברשימת-המשאלות) — קנבס תצוגת-על של החדר.
 * מצייר את הקירות ראש-לזנב כפוליגון, מוסיף מידות/זוויות בעברית,
 * מסמן בליטות לאורך הקיר, ומאפשר הדלקה/כיבוי של שכבות-תצוגה בלייב.
 * המתמטיקה עצמאית (Pt מקומי) — אין תלות חיצונית מעבר לטיפוסים היציבים. */

/** נקודה במישור (מ"מ במרחב-העולם, או פיקסלים אחרי טרנספורם). */
private data class Pt(val x: Float, val y: Float)

/** תוצר בניית הפוליגון: קודקודים (N+1) + כיוון (רדיאנים) לכל קיר. */
private data class Plan(val verts: List<Pt>, val headings: List<Float>)

/**
 * קנבס מבט-על (2D top-view) של חדר בודד.
 *
 * @param walls              קירות החדר (מסודרים לפי idx; אורך/גובה/זווית במ"מ ומעלות).
 * @param accessoriesByWall  בליטות לפי מזהה-קיר (wallId → רשימה).
 */
@Composable
fun RoomPlanCanvas(
    walls: List<WallEntity>,
    accessoriesByWall: Map<Long, List<AccessoryEntity>>,
    modifier: Modifier = Modifier,
) {
    // שכבות-תצוגה (שליטה בלייב — §3 "שליטה בתצוגה")
    var showDims by remember { mutableStateOf(true) }
    var showAngles by remember { mutableStateOf(true) }
    var showObjects by remember { mutableStateOf(true) }
    var showGrid by remember { mutableStateOf(true) }

    val ordered = remember(walls) { walls.sortedBy { it.idx } }

    // איתור "גובה מינוס" (§3) — שיפוע-רצפה / אלמנט מתחת לרצפה
    val negatives = remember(accessoriesByWall) {
        accessoriesByWall.values.flatten().filter { it.fromBottom < 0.0 || it.height < 0.0 }
    }

    Column(modifier) {
        // ── סרגל שכבות ─────────────────────────────────────────────
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LayerToggle("מידות", showDims) { showDims = !showDims }
            LayerToggle("זוויות", showAngles) { showAngles = !showAngles }
            LayerToggle("אובייקטים", showObjects) { showObjects = !showObjects }
            LayerToggle("סרגל", showGrid) { showGrid = !showGrid }
        }

        // ── חיווי גובה-מינוס / שיפוע-רצפה ─────────────────────────
        if (negatives.isNotEmpty()) {
            Text(
                "⚠ גובה מינוס — שיפוע רצפה: " +
                    negatives.joinToString("، ") { "${it.name} (${it.fromBottom.roundToInt()} מ\"מ)" },
                color = WarnAmber,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 2.dp),
            )
        }

        // ── הקנבס ──────────────────────────────────────────────────
        Box(
            Modifier
                .fillMaxSize()
                .padding(8.dp)
                .background(Cream, RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            // ציורי-טקסט (Paint אנדרואיד — תומך בעברית/דו-כיווניות)
            val dimPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Teal.toArgb(); textAlign = Paint.Align.CENTER } }
            val anglePaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Orange.toArgb(); textAlign = Paint.Align.CENTER } }
            val objPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Ink.toArgb(); textAlign = Paint.Align.CENTER } }
            val idxPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Muted.toArgb(); textAlign = Paint.Align.CENTER } }

            if (ordered.isEmpty()) {
                Text("אין קירות להצגה. הוסף קיר כדי לראות את השרטוט נוצר.", color = Muted, fontSize = 14.sp)
                return@Box
            }

            Canvas(Modifier.fillMaxSize()) {
                val plan = buildPlan(ordered)
                val (bcx, bcy, scale) = fit(plan.verts, size.width, size.height, 56.dp.toPx())

                fun toScreen(p: Pt) = Offset(
                    (p.x - bcx) * scale + size.width / 2f,
                    (p.y - bcy) * scale + size.height / 2f,
                )

                // סרגל-רשת (רקע)
                if (showGrid) drawGrid(40.dp.toPx())

                // קירות
                val strokeW = 3.dp.toPx()
                for (i in ordered.indices) {
                    val a = toScreen(plan.verts[i])
                    val b = toScreen(plan.verts[i + 1])
                    drawLine(Ink, a, b, strokeWidth = strokeW, cap = StrokeCap.Round)
                }
                // קודקודים
                for (v in plan.verts) drawCircle(Orange, 4.dp.toPx(), toScreen(v))

                // מידות-אורך (מ"מ) במרכז כל קיר, מוסטות החוצה
                if (showDims) {
                    dimPaint.textSize = 12.dp.toPx()
                    idxPaint.textSize = 10.dp.toPx()
                    for (i in ordered.indices) {
                        val w = ordered[i]
                        val h = plan.headings[i]
                        val mid = Pt(
                            (plan.verts[i].x + plan.verts[i + 1].x) / 2f,
                            (plan.verts[i].y + plan.verts[i + 1].y) / 2f,
                        )
                        val m = toScreen(mid)
                        val (nx, ny) = outwardNormal(h)
                        val off = 16.dp.toPx()
                        drawContext.canvas.nativeCanvas.apply {
                            drawText("${w.length.roundToInt()} מ\"מ", m.x + nx * off, m.y + ny * off + 4.dp.toPx(), dimPaint)
                            drawText("קיר ${w.idx + 1}", m.x - nx * off, m.y - ny * off, idxPaint)
                        }
                    }
                }

                // זוויות בקודקודים הפנימיים (כולל 45°)
                if (showAngles) {
                    anglePaint.textSize = 11.dp.toPx()
                    // הזווית שקיר i "פונה" בה נשמרת על אותו קיר; מוצגת בקודקוד שבסופו.
                    for (i in ordered.indices) {
                        val w = ordered[i]
                        if (i == ordered.lastIndex) continue // אין קודקוד-פנימי אחרי הקיר האחרון
                        val v = toScreen(plan.verts[i + 1])
                        drawContext.canvas.nativeCanvas.drawText(
                            "${trimAngle(w.angle)}°", v.x, v.y - 8.dp.toPx(), anglePaint,
                        )
                    }
                }

                // בליטות (אובייקטים) לאורך הקיר במיקום fromLeft
                if (showObjects) {
                    objPaint.textSize = 10.dp.toPx()
                    for (i in ordered.indices) {
                        val w = ordered[i]
                        val accs = accessoriesByWall[w.id] ?: continue
                        val h = plan.headings[i]
                        val dir = Pt(cos(h), sin(h))
                        val (nx, ny) = outwardNormal(h)
                        for (acc in accs) {
                            val t = acc.fromLeft.toFloat().coerceIn(0f, w.length.toFloat())
                            val base = Pt(plan.verts[i].x + dir.x * t, plan.verts[i].y + dir.y * t)
                            val bs = toScreen(base)
                            // בליטה החוצה, פרופורציונלית לעומק (עם מינימום נראה)
                            val depthPx = max(acc.depth.toFloat() * scale, 8.dp.toPx())
                            val mark = Offset(bs.x + nx * depthPx, bs.y + ny * depthPx)
                            drawLine(Teal, bs, mark, strokeWidth = 2.dp.toPx(), cap = StrokeCap.Round)
                            drawCircle(Teal, 4.dp.toPx(), mark)
                            val lbl = Offset(bs.x + nx * (depthPx + 14.dp.toPx()), bs.y + ny * (depthPx + 14.dp.toPx()) + 3.dp.toPx())
                            drawContext.canvas.nativeCanvas.drawText(
                                "${acc.name} · ${acc.depth.roundToInt()} מ\"מ", lbl.x, lbl.y, objPaint,
                            )
                        }
                    }
                }
            }
        }
    }
}

// ── גיאומטריה ────────────────────────────────────────────────────────────────

/**
 * בונה פוליגון ראש-לזנב דרך מקור-האמת היחיד [WallBuilder.layout] — מוסכמת-הזווית:
 * [WallEntity.angle] = זווית-פנייה (מעלות, CCW חיובי) המתווספת ישירות לכיוון-הראש
 * אחרי כל קיר (heading += angle), בדיוק כמו מסכי-הלכידה. הכיוון לכל קטע נגזר מהקטע
 * עצמו (atan2) כדי להישאר עקבי עם הקודקודים. תומך 90°, 45°, וכל זווית אחרת.
 */
private fun buildPlan(walls: List<WallEntity>): Plan {
    val layout = WallBuilder.layout(walls)
    val verts = layout.map { Pt(it.x.toFloat(), it.y.toFloat()) }
    val headings = ArrayList<Float>(walls.size)
    for (i in walls.indices) {
        val a = layout[i]
        val b = layout[i + 1]
        headings.add(atan2(b.y - a.y, b.x - a.x).toFloat())
    }
    return Plan(verts, headings)
}

/** מרכז ה-bbox (bcx,bcy) וסקאלה שממלאת את הקנבס עם שוליים. */
private fun fit(verts: List<Pt>, w: Float, h: Float, pad: Float): Triple<Float, Float, Float> {
    var minX = Float.MAX_VALUE; var minY = Float.MAX_VALUE
    var maxX = -Float.MAX_VALUE; var maxY = -Float.MAX_VALUE
    for (p in verts) {
        minX = min(minX, p.x); minY = min(minY, p.y)
        maxX = max(maxX, p.x); maxY = max(maxY, p.y)
    }
    val spanX = max(maxX - minX, 1f)
    val spanY = max(maxY - minY, 1f)
    val scale = min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY).let { if (it.isFinite() && it > 0f) it else 1f }
    return Triple((minX + maxX) / 2f, (minY + maxY) / 2f, scale)
}

/** נורמל "החוצה" לקיר (ימין-לכיוון-ההליכה) לצורך הסטת תוויות/בליטות. */
private fun outwardNormal(heading: Float): Pair<Float, Float> = sin(heading) to -cos(heading)

/** מספר-זווית מסודר: שלם אם עגול, אחרת עד ספרה אחת (למשל 45, 91.3). */
private fun trimAngle(deg: Double): String {
    val r = (deg * 10).roundToInt() / 10.0
    return if (r % 1.0 == 0.0) r.toInt().toString() else r.toString()
}

// ── רשת ──────────────────────────────────────────────────────────────────────

private fun DrawScope.drawGrid(step: Float) {
    val grid = Muted.copy(alpha = 0.15f)
    val sw = 1f
    var x = 0f
    while (x <= size.width) {
        drawLine(grid, Offset(x, 0f), Offset(x, size.height), strokeWidth = sw)
        x += step
    }
    var y = 0f
    while (y <= size.height) {
        drawLine(grid, Offset(0f, y), Offset(size.width, y), strokeWidth = sw)
        y += step
    }
}

// ── מתג-שכבה ─────────────────────────────────────────────────────────────────

@Composable
private fun LayerToggle(label: String, on: Boolean, onClick: () -> Unit) {
    val bg = if (on) Teal else Color.White
    val fg = if (on) Color.White else Muted
    Box(
        Modifier
            .background(bg, RoundedCornerShape(50))
            .border(1.dp, if (on) Teal else Muted.copy(alpha = 0.4f), RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .wrapContentHeight(),
    ) {
        Text((if (on) "● " else "○ ") + label, color = fg, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}
