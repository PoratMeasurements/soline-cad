package il.co.soline.measure.ui.cad

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.geometry.WallBuilder
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/* ─────────────────────────────────────────────────────────────────────────────
 * עריכת מידות-CAD על השרטוט (MICHAEL_WISHLIST §2/§3 · CVSM §11 "מידות CAD",
 * §5.2 "עריכת אורך קיר", §5.4 "ערוך זווית / סובב קיר").
 *
 * המודד מקיש ישירות על תווית-מידה (אורך-קיר) או על זווית-פינה בשרטוט-המבט-על,
 * ופותח דיאלוג-מספרי לעריכתה — בדיוק כמו ב-CVSM, שם עורכים מידה בלחיצה עליה.
 * הרכיב עצמאי לחלוטין (עזרי-גאומטריה מקומיים), נשען רק על הטיפוסים היציבים:
 *   WallEntity · WallBuilder.layout/isClosed/closingGap · צבעי-המותג.
 *
 * זרימה: הציור נבנה מ-WallBuilder.layout(walls). כל הקשה עוברת hit-test מול
 * אזור-התווית של כל קיר (אמצע) ומול אזור-הזווית של כל פינה. אישור-דיאלוג קורא
 * onEditWall(wallId, newLengthMm, newAngleDeg) — כאשר עורכים אורך שומרים את
 * הזווית הקיימת של אותו קיר, וכאשר עורכים זווית שומרים את אורכו. ה-walls
 * המעודכן מוחזר מבחוץ, והשרטוט מצייר את עצמו מחדש.
 * ──────────────────────────────────────────────────────────────────────────── */

/** נקודת-מסך (פיקסלים) אחרי טרנספורם. */
private data class Px(val x: Float, val y: Float)

/**
 * אזור-הקשה על השרטוט — מרכז התווית במסך (sx,sy) והנתונים לפתיחת-דיאלוג.
 * [kind]=0 → תווית-אורך של קיר; [kind]=1 → זווית-פינה (השמורה על אותו קיר).
 */
private data class HitRegion(
    val kind: Int,
    val wallId: Long,
    val wallIdx: Int,
    val sx: Float,
    val sy: Float,
)

/** מחזיק אזורי-הקשה, מתעדכן בכל פריים-ציור בלי לגרום ל-recomposition. */
private class HitStore {
    val regions = ArrayList<HitRegion>(32)
    fun clear() = regions.clear()
    fun add(r: HitRegion) = regions.add(r)

    /** מאתר את אזור-ההקשה הקרוב ביותר לנקודה בטווח [radiusPx]. */
    fun nearest(x: Float, y: Float, radiusPx: Float): HitRegion? {
        var best: HitRegion? = null
        var bestD = radiusPx
        for (r in regions) {
            val d = hypot(r.sx - x, r.sy - y)
            if (d <= bestD) { bestD = d; best = r }
        }
        return best
    }
}

/** מה נבחר כרגע (להדגשה) — או כלום. */
private sealed interface Selection {
    data class Length(val wallId: Long) : Selection
    data class Angle(val wallId: Long) : Selection
}

/**
 * עורך מידות-CAD אינטראקטיבי על שרטוט-המבט-על.
 *
 * @param walls      קירות החדר (מסודרים לפי idx; אורך/גובה במ"מ, זווית במעלות לקיר-הבא).
 * @param onEditWall קריאה בעת אישור-עריכה: (wallId, newLengthMm, newAngleDeg).
 *                   בעריכת-אורך מועברת הזווית הקיימת ללא-שינוי, ולהפך.
 * @param onBack     חזרה.
 */
@Composable
fun CadDimensionEditor(
    walls: List<WallEntity>,
    onEditWall: (wallId: Long, newLengthMm: Double, newAngleDeg: Double) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val ordered = remember(walls) { walls.sortedBy { it.idx } }

    // pan/zoom (כמו יתר הקנבסים)
    var userScale by remember { mutableFloatStateOf(1f) }
    var panX by remember { mutableFloatStateOf(0f) }
    var panY by remember { mutableFloatStateOf(0f) }

    var selection by remember { mutableStateOf<Selection?>(null) }
    // דיאלוג-עריכה פעיל: HitRegion שנבחר, או null
    var editing by remember { mutableStateOf<HitRegion?>(null) }

    val hits = remember { HitStore() }

    // גיאומטריה — נקודות עולם (N+1) וחיווי-סגירה
    val pts = remember(ordered) { WallBuilder.layout(ordered) }
    val closed = remember(pts) { WallBuilder.isClosed(pts) }
    val gapMm = remember(pts) { WallBuilder.closingGap(pts) }

    fun openEditor(r: HitRegion) {
        editing = r
        selection = if (r.kind == 0) Selection.Length(r.wallId) else Selection.Angle(r.wallId)
    }

    Column(
        modifier
            .fillMaxSize()
            .background(Cream),
    ) {
        // ── כותרת + חזרה + חיווי-סגירה ─────────────────────────────────
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedButton(
                onClick = onBack,
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
            ) { Text("→ חזרה", fontSize = 15.sp) }

            Spacer(Modifier.width(4.dp))

            Column(Modifier.weight(1f)) {
                Text("עריכת מידות על השרטוט", color = Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                Text(
                    "הקש על מידת-אורך או על זווית כדי לערוך",
                    color = Muted, fontSize = 12.sp,
                )
            }

            ClosureBadge(closed = closed, gapMm = gapMm, wallCount = ordered.size)
        }

        if (ordered.isEmpty()) {
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                Text(
                    "אין קירות להצגה.\nהוסף קיר כדי לערוך מידות על השרטוט.",
                    color = Muted, fontSize = 15.sp, textAlign = TextAlign.Center,
                )
            }
        } else {
            // ── הקנבס (pan+zoom+tap) ───────────────────────────────────
            Box(
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 8.dp)
                    .background(Color.White, RoundedCornerShape(12.dp))
                    .border(1.dp, Muted.copy(alpha = 0.25f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                val dimPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Teal.toArgb(); textAlign = Paint.Align.CENTER } }
                val idxPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Muted.toArgb(); textAlign = Paint.Align.CENTER } }
                val anglePaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Orange.toArgb(); textAlign = Paint.Align.CENTER } }

                Canvas(
                    Modifier
                        .fillMaxSize()
                        .pointerInput(Unit) {
                            detectTransformGestures { _, pan, zoom, _ ->
                                userScale = (userScale * zoom).coerceIn(0.2f, 12f)
                                panX += pan.x
                                panY += pan.y
                            }
                        }
                        .pointerInput(ordered) {
                            detectTapGestures { off ->
                                val hit = hits.nearest(off.x, off.y, radiusPx = 56.dp.toPx())
                                if (hit != null) openEditor(hit)
                                else selection = null
                            }
                        },
                ) {
                    hits.clear()

                    val margin = 64.dp.toPx()
                    val (cx, cy, baseScale) = fitBounds(pts, size.width, size.height, margin)
                    val eff = baseScale * userScale

                    fun toScreen(p: WallBuilder.Pt) = Px(
                        ((p.x - cx) * eff + size.width / 2f + panX).toFloat(),
                        ((p.y - cy) * eff + size.height / 2f + panY).toFloat(),
                    )

                    // קירות — קווים עבים; הקיר-הנבחר מודגש
                    val strokeW = 5.dp.toPx()
                    for (i in ordered.indices) {
                        val w = ordered[i]
                        val a = toScreen(pts[i])
                        val b = toScreen(pts[i + 1])
                        val sel = (selection as? Selection.Length)?.wallId == w.id
                        drawLine(
                            if (sel) Orange else Ink,
                            Offset(a.x, a.y), Offset(b.x, b.y),
                            strokeWidth = if (sel) strokeW * 1.8f else strokeW,
                            cap = StrokeCap.Round,
                        )
                    }
                    // קודקודים; פינה-נבחרת מודגשת
                    for (i in pts.indices) {
                        val s = toScreen(pts[i])
                        // הזווית של פינה i+? נשמרת על הקיר שמסתיים בה: pts[i] הוא סוף קיר (i-1)
                        val cornerWallIdx = i - 1
                        val selCorner = cornerWallIdx in ordered.indices &&
                            (selection as? Selection.Angle)?.wallId == ordered[cornerWallIdx].id
                        drawCircle(
                            if (selCorner) Orange else Orange.copy(alpha = 0.9f),
                            if (selCorner) 9.dp.toPx() else 5.dp.toPx(),
                            Offset(s.x, s.y),
                        )
                    }

                    // מידות-אורך בעברית באמצע-הקיר, מוסטות החוצה — ונרשמות כאזור-הקשה
                    dimPaint.textSize = 14.dp.toPx()
                    idxPaint.textSize = 10.dp.toPx()
                    for (i in ordered.indices) {
                        val w = ordered[i]
                        val hRad = segHeading(pts[i], pts[i + 1])
                        val midX = (pts[i].x + pts[i + 1].x) / 2.0
                        val midY = (pts[i].y + pts[i + 1].y) / 2.0
                        val m = toScreen(WallBuilder.Pt(midX, midY))
                        val (nx, ny) = outwardNormal(hRad)
                        val offPx = 20.dp.toPx()
                        val lx = m.x + nx * offPx
                        val ly = m.y + ny * offPx
                        // רקע-הדגשה קליל לתווית הנבחרת (מטרת-מגע גדולה)
                        if ((selection as? Selection.Length)?.wallId == w.id) {
                            drawCircle(Orange.copy(alpha = 0.14f), 26.dp.toPx(), Offset(lx, ly - 5.dp.toPx()))
                        }
                        drawContext.canvas.nativeCanvas.apply {
                            drawText("${w.length.roundToInt()} מ\"מ", lx, ly + 4.dp.toPx(), dimPaint)
                            drawText("קיר ${w.idx + 1}", m.x - nx * offPx, m.y - ny * offPx, idxPaint)
                        }
                        hits.add(HitRegion(kind = 0, wallId = w.id, wallIdx = w.idx, sx = lx, sy = ly))
                    }

                    // זוויות-פינה: הזווית של קיר i מוצגת בקודקוד שבסופו (pts[i+1]),
                    // ונרשמת כאזור-הקשה. הקיר האחרון אינו יוצר פינה-פנימית.
                    anglePaint.textSize = 13.dp.toPx()
                    for (i in ordered.indices) {
                        if (i == ordered.lastIndex) continue
                        val w = ordered[i]
                        val v = toScreen(pts[i + 1])
                        val ay = v.y - 12.dp.toPx()
                        if ((selection as? Selection.Angle)?.wallId == w.id) {
                            drawCircle(Orange.copy(alpha = 0.14f), 24.dp.toPx(), Offset(v.x, ay - 4.dp.toPx()))
                        }
                        drawContext.canvas.nativeCanvas.drawText(
                            "${trimAngle(w.angle)}°", v.x, ay, anglePaint,
                        )
                        hits.add(HitRegion(kind = 1, wallId = w.id, wallIdx = w.idx, sx = v.x, sy = ay))
                    }
                }

                // רמז-איפוס-תצוגה
                if (userScale != 1f || panX != 0f || panY != 0f) {
                    TextButton(
                        onClick = { userScale = 1f; panX = 0f; panY = 0f },
                        modifier = Modifier.align(Alignment.BottomStart).padding(6.dp),
                    ) { Text("איפוס תצוגה", color = Teal, fontSize = 12.sp) }
                }
            }

            // ── רשימת-קירות (fallback לעריכה גם אם ההקשה עדינה) ────────
            Text(
                "רשימת קירות — עריכה ישירה",
                color = Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth().padding(start = 14.dp, top = 10.dp, bottom = 2.dp),
            )
            LazyColumn(
                Modifier
                    .fillMaxWidth()
                    .heightIn(max = 240.dp)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(ordered, key = { it.id }) { w ->
                    WallRow(
                        wall = w,
                        isLast = w.idx == ordered.last().idx,
                        onEditLength = {
                            openEditor(HitRegion(0, w.id, w.idx, 0f, 0f))
                        },
                        onEditAngle = {
                            openEditor(HitRegion(1, w.id, w.idx, 0f, 0f))
                        },
                    )
                }
                item { Spacer(Modifier.height(8.dp)) }
            }
        }
    }

    // ── דיאלוג-עריכה מספרי ─────────────────────────────────────────────
    val e = editing
    if (e != null) {
        val wall = ordered.firstOrNull { it.id == e.wallId }
        if (wall == null) {
            editing = null
        } else if (e.kind == 0) {
            NumberEditDialog(
                title = "עריכת אורך · קיר ${wall.idx + 1}",
                label = "אורך (מ\"מ)",
                initial = wall.length,
                suffix = "מ\"מ",
                min = 1.0,
                onConfirm = { newLen ->
                    onEditWall(wall.id, newLen, wall.angle) // הזווית ללא-שינוי
                    editing = null
                },
                onDismiss = { editing = null },
            )
        } else {
            NumberEditDialog(
                title = "עריכת זווית · פינה אחרי קיר ${wall.idx + 1}",
                label = "זווית לקיר הבא (מעלות)",
                initial = wall.angle,
                suffix = "°",
                min = -179.0,
                max = 180.0,
                onConfirm = { newAng ->
                    onEditWall(wall.id, wall.length, newAng) // האורך ללא-שינוי
                    editing = null
                },
                onDismiss = { editing = null },
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// רכיבי-משנה
// ─────────────────────────────────────────────────────────────────────────────

/** תג חיווי-סגירת-המתאר (WallBuilder.isClosed / closingGap). */
@Composable
private fun ClosureBadge(closed: Boolean, gapMm: Double, wallCount: Int) {
    val (bg, fg, txt) = when {
        wallCount < 3 -> Triple(Muted.copy(alpha = 0.15f), Muted, "מתאר פתוח")
        closed -> Triple(OkGreen.copy(alpha = 0.15f), OkGreen, "סגור ✓")
        else -> Triple(Orange.copy(alpha = 0.15f), Orange, "פער ${gapMm.roundToInt()} מ\"מ")
    }
    Box(
        Modifier
            .background(bg, RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 7.dp),
    ) { Text(txt, color = fg, fontSize = 12.sp, fontWeight = FontWeight.SemiBold) }
}

/** שורת-קיר ברשימת-ה-fallback: "קיר N · אורך · זווית" + כפתורי-עריכה. */
@Composable
private fun WallRow(
    wall: WallEntity,
    isLast: Boolean,
    onEditLength: () -> Unit,
    onEditAngle: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Color.White, RoundedCornerShape(10.dp))
            .border(1.dp, Muted.copy(alpha = 0.2f), RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            "קיר ${wall.idx + 1}",
            color = Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.width(64.dp),
        )
        Column(Modifier.weight(1f)) {
            Text("אורך: ${wall.length.roundToInt()} מ\"מ", color = Ink, fontSize = 14.sp)
            Text(
                if (isLast) "זווית: — (קיר אחרון)" else "זווית: ${trimAngle(wall.angle)}°",
                color = Muted, fontSize = 13.sp,
            )
        }
        Button(
            onClick = onEditLength,
            colors = ButtonDefaults.buttonColors(containerColor = Teal),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
        ) { Text("אורך", fontSize = 13.sp, color = Color.White) }
        if (!isLast) {
            Button(
                onClick = onEditAngle,
                colors = ButtonDefaults.buttonColors(containerColor = Orange),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
            ) { Text("זווית", fontSize = 13.sp, color = Color.White) }
        }
    }
}

/**
 * דיאלוג-עריכה מספרי כללי (מקלדת-מספרית, מטרות-מגע גדולות).
 * מוגש כ-Box מודאלי עצמאי (בלי תלות ב-AlertDialog של Material3, שנשאר יציב).
 */
@Composable
private fun NumberEditDialog(
    title: String,
    label: String,
    initial: Double,
    suffix: String,
    min: Double = Double.NEGATIVE_INFINITY,
    max: Double = Double.POSITIVE_INFINITY,
    onConfirm: (Double) -> Unit,
    onDismiss: () -> Unit,
) {
    var text by remember { mutableStateOf(fmt(initial)) }
    val parsed = text.trim().replace(',', '.').toDoubleOrNull()
    val valid = parsed != null && parsed in min..max

    // שכבת-רקע חוסמת-הקשות + כרטיס ממורכז
    Box(
        Modifier
            .fillMaxSize()
            .background(Color(0x66000000))
            .pointerInput(Unit) { detectTapGestures { onDismiss() } },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .padding(24.dp)
                .fillMaxWidth()
                .background(Cream, RoundedCornerShape(16.dp))
                .border(1.dp, Muted.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
                // חסימת ה-tap שמאחור מלהגיע לרקע-הסוגר
                .pointerInput(Unit) { detectTapGestures { } }
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(title, color = Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)

            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                label = { Text(label) },
                suffix = { Text(suffix, color = Muted) },
                singleLine = true,
                isError = text.isNotBlank() && !valid,
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                    keyboardType = KeyboardType.Number,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            if (text.isNotBlank() && !valid) {
                Text("ערך לא תקין (טווח מותר: ${fmt(min)}…${fmt(max)})", color = Orange, fontSize = 12.sp)
            }

            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedButton(
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(vertical = 12.dp),
                ) { Text("ביטול", fontSize = 15.sp) }
                Button(
                    onClick = { parsed?.let(onConfirm) },
                    enabled = valid,
                    colors = ButtonDefaults.buttonColors(containerColor = Teal),
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(vertical = 12.dp),
                ) { Text("שמור", fontSize = 15.sp, color = Color.White) }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// עזרי-גיאומטריה ופורמט מקומיים (עצמאיים)
// ─────────────────────────────────────────────────────────────────────────────

/** אוטו-פיט: מרכז ה-bbox (cx,cy) וסקאלת-בסיס שממלאת את הקנבס עם שוליים. */
private fun fitBounds(
    pts: List<WallBuilder.Pt>,
    w: Float,
    h: Float,
    pad: Float,
): Triple<Double, Double, Float> {
    if (pts.isEmpty()) return Triple(0.0, 0.0, 1f)
    var minX = Double.MAX_VALUE; var minY = Double.MAX_VALUE
    var maxX = -Double.MAX_VALUE; var maxY = -Double.MAX_VALUE
    for (p in pts) {
        minX = min(minX, p.x); minY = min(minY, p.y)
        maxX = max(maxX, p.x); maxY = max(maxY, p.y)
    }
    val spanX = max(maxX - minX, 1.0)
    val spanY = max(maxY - minY, 1.0)
    val scale = min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY)
        .let { if (it.isFinite() && it > 0.0) it else 1.0 }
    return Triple((minX + maxX) / 2.0, (minY + maxY) / 2.0, scale.toFloat())
}

/** כיוון-הקטע (רדיאנים) מ-a ל-b. */
private fun segHeading(a: WallBuilder.Pt, b: WallBuilder.Pt): Double =
    atan2(b.y - a.y, b.x - a.x)

/** נורמל "החוצה" לקיר (ימין-לכיוון-ההליכה) להסטת-תוויות. */
private fun outwardNormal(headingRad: Double): Pair<Float, Float> {
    val nx = kotlin.math.sin(headingRad).toFloat()
    val ny = (-kotlin.math.cos(headingRad)).toFloat()
    return nx to ny
}

/** מספר-זווית מסודר: שלם אם עגול, אחרת עד ספרה אחת (45, 91.3). */
private fun trimAngle(deg: Double): String {
    val r = (deg * 10).roundToInt() / 10.0
    return if (abs(r % 1.0) < 1e-9) r.toInt().toString() else r.toString()
}

/** פורמט-מספר להצגה בשדה-קלט: שלם ללא-שבר, אחרת עד ספרה אחת. */
private fun fmt(v: Double): String {
    if (!v.isFinite()) return ""
    val r = (v * 10).roundToInt() / 10.0
    return if (abs(r % 1.0) < 1e-9) r.toInt().toString() else r.toString()
}
