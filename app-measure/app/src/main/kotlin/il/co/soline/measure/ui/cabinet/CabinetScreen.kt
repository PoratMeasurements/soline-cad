package il.co.soline.measure.ui.cabinet

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.CompositionLocalProvider
import android.graphics.Paint
import il.co.soline.measure.data.CabinetCatalog
import il.co.soline.measure.data.CabinetEntity
import il.co.soline.measure.data.CabinetKind
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.WarnAmber
import il.co.soline.measure.data.WallEntity
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/* ─────────────────────────────────────────────────────────────────────────────
 *  CabinetScreen — שכבת-הארונות (Furniture) על קיר בודד. זו שכבת-התכנון (A)
 *  שמנוע-ה-fit בודק מול המדידה-בשטח (B). מציירים את חזית-הקיר (כמו Elevation),
 *  ומניחים עליה ארונות כמלבנים לאורך הקיר, לפי (fromLeft, width) וטווח-הגובה
 *  של החגורה (בסיס/עליון/גבוה).
 *
 *  יכולות:
 *    • בורר-הוספה — טיפוס (7 טיפוסים) + רוחב מהקטלוג הסטנדרטי.
 *    • גרירה למיקום — גוררים ארון אופקית ומעדכנים fromLeft (נצמד ל-clamp בקיר).
 *    • הקשה — עורך מידות / מחיקה.
 *    • עצירות-ארון (Cabinet stops) — סימוני-מיקום על הקיר; מוסיפים
 *      עצירה בקצה-הימני של השורה או במרכז-הקיר, גוררים ומוחקים.
 *    • סכום-רץ מול אורך-הקיר — בדיקת R1 ("השורה נכנסת?"): Σרוחבי-ארונות מול
 *      wall.length, עם דלתא בעברית (חוסר/עודף) וצבע (ירוק/ענבר/אדום).
 *
 *  עברית RTL, צבעי-מותג. נשען רק על טיפוסים-יציבים (WallEntity, CabinetEntity,
 *  CabinetKind/CabinetCatalog, צבעי-המותג).
 * ───────────────────────────────────────────────────────────────────────────── */

/** טרנספורם עולם→מסך למבט-חזית: מ"מ (x משמאל, y מהרצפה) → פיקסלים. */
private data class CabXf(val scale: Float, val left: Float, val bottom: Float) {
    fun sx(xMm: Double) = left + (xMm * scale).toFloat()
    fun sy(yMm: Double) = bottom - (yMm * scale).toFloat()
    /** מסך→עולם על ציר-X (לגרירה): פיקסל → מ"מ-משמאל. */
    fun wx(px: Float): Double = ((px - left) / scale).toDouble()
}

private fun cabFit(lengthMm: Double, heightMm: Double, w: Float, h: Float, pad: Float): CabXf {
    val lw = max(lengthMm, 1.0)
    val lh = max(heightMm, 1.0)
    val sx = (w - 2 * pad) / lw
    val sy = (h - 2 * pad) / lh
    val scale = min(sx, sy).let { if (it.isFinite() && it > 0.0) it else 1.0 }.toFloat()
    val drawW = (lw * scale).toFloat()
    val drawH = (lh * scale).toFloat()
    val left = (w - drawW) / 2f
    val bottom = (h + drawH) / 2f
    return CabXf(scale, left, bottom)
}

/** צבע-מילוי לפי חגורה: בסיס=כתום · עליון=טורקיז · גבוה=ענבר. */
private fun beltColor(kind: String): Color = when (CabinetKind.of(kind).belt) {
    "upper" -> Teal
    "tall" -> WarnAmber
    else -> Orange
}

// מעצב-הערך-המשותף לפי יחידת-התצוגה (ערך בלבד, בלי סיומת). האחסון תמיד מ"מ.
private fun Double.mm(): String = Prefs.lenValue(this)

/**
 * מסך שכבת-הארונות לקיר בודד.
 *
 * @param wall      הקיר (length=רוחב מ"מ, height=גובה מ"מ).
 * @param cabinets  ארוני-הקיר (שכבה A). מיקום ב-fromLeft, מידה width×depth, טווח heightFrom..heightTo.
 * @param onAdd     הוספת ארון חדש (id=0) — על ה-host להתמיד ב-repo.
 * @param onUpdate  שמירת-עריכה/מיקום של ארון קיים.
 * @param onDelete  מחיקת ארון.
 * @param onBack    חזרה למסך-הקודם.
 */
@Composable
fun CabinetScreen(
    wall: WallEntity,
    cabinets: List<CabinetEntity>,
    onAdd: (CabinetEntity) -> Unit,
    onUpdate: (CabinetEntity) -> Unit,
    onDelete: (CabinetEntity) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var editing by remember { mutableStateOf<CabinetEntity?>(null) }
    var adding by remember { mutableStateOf(false) }
    var boxSize by remember { mutableStateOf(IntSize.Zero) }

    // עצירות-ארון (Cabinet stops) — סימוני-מיקום על הקיר; מצב-UI מקומי (שכבת-תכנון).
    val stops = remember { mutableStateListOf<Double>() }

    // מצב-גרירה: id הארון הנגרר + fromLeft-הרגעי (מוצג עד שחרור).
    var dragId by remember { mutableStateOf<Long?>(null) }
    var dragFromLeft by remember { mutableStateOf(0.0) }

    // סכום-רץ (R1): Σרוחבי-ארונות מול אורך-הקיר.
    val totalWidth = cabinets.sumOf { it.width }
    val remaining = wall.length - totalWidth   // >0 חוסר (פער) · <0 עודף (חורג)

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Column(modifier.fillMaxSize().background(Cream)) {

            // ── סרגל-עליון ─────────────────────────────────────────────────
            Row(
                Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
                Spacer(Modifier.width(4.dp))
                Column(Modifier.weight(1f)) {
                    Text("soline · ארונות על הקיר", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Orange, lineHeight = 22.sp)
                    Text(
                        "רוחב-קיר ${wall.length.mm()} ${Prefs.unitSuffix} · ${cabinets.size} ארונות · ${stops.size} עצירות",
                        fontSize = 12.sp, color = Teal,
                    )
                }
            }

            // ── פס-סכום (R1: השורה נכנסת?) ────────────────────────────────
            RowFitBar(wallLength = wall.length, totalWidth = totalWidth, remaining = remaining)

            // ── קנבס-החזית + הארונות ──────────────────────────────────────
            Box(
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(10.dp)
                    .background(Color.White, RoundedCornerShape(12.dp))
                    .border(1.dp, Muted.copy(alpha = 0.25f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                val wallPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Teal.toArgb(); textAlign = Paint.Align.CENTER } }
                val cabPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Ink.toArgb(); textAlign = Paint.Align.CENTER } }
                val stopPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = BlockRed.toArgb(); textAlign = Paint.Align.CENTER } }

                if (wall.height <= 0.0 || wall.length <= 0.0) {
                    Text("לקיר אין רוחב/גובה תקינים להצגת חזית.", color = Muted, fontSize = 15.sp, textAlign = TextAlign.Center)
                    return@Box
                }

                Canvas(
                    Modifier
                        .fillMaxSize()
                        .onSizeChanged { boxSize = it }
                        .pointerInput(wall.id, cabinets, stops.size) {
                            detectTapGestures { tap ->
                                val w = boxSize.width.toFloat(); val h = boxSize.height.toFloat()
                                if (w <= 0f || h <= 0f) return@detectTapGestures
                                val xf = cabFit(wall.length, wall.height, w, h, PAD_PX)
                                val hit = cabinets.asReversed().firstOrNull { c -> hitCabinet(c, xf, tap) }
                                if (hit != null) editing = hit
                            }
                        }
                        .pointerInput(wall.id, cabinets) {
                            detectDragGestures(
                                onDragStart = { start ->
                                    val w = boxSize.width.toFloat(); val h = boxSize.height.toFloat()
                                    if (w <= 0f || h <= 0f) return@detectDragGestures
                                    val xf = cabFit(wall.length, wall.height, w, h, PAD_PX)
                                    val hit = cabinets.asReversed().firstOrNull { c -> hitCabinet(c, xf, start) }
                                    if (hit != null) { dragId = hit.id; dragFromLeft = hit.fromLeft }
                                },
                                onDrag = { change, delta ->
                                    change.consume()
                                    val id = dragId ?: return@detectDragGestures
                                    val w = boxSize.width.toFloat(); val h = boxSize.height.toFloat()
                                    val xf = cabFit(wall.length, wall.height, w, h, PAD_PX)
                                    val cab = cabinets.firstOrNull { it.id == id } ?: return@detectDragGestures
                                    val newLeft = dragFromLeft + (delta.x / xf.scale)
                                    dragFromLeft = newLeft.coerceIn(0.0, max(0.0, wall.length - cab.width))
                                },
                                onDragEnd = {
                                    val id = dragId
                                    val cab = cabinets.firstOrNull { it.id == id }
                                    if (cab != null) onUpdate(cab.copy(fromLeft = dragFromLeft))
                                    dragId = null
                                },
                                onDragCancel = { dragId = null },
                            )
                        },
                ) {
                    val xf = cabFit(wall.length, wall.height, size.width, size.height, PAD_PX)
                    val nc = drawContext.canvas.nativeCanvas

                    val topY = xf.sy(wall.height)
                    val botY = xf.sy(0.0)
                    val leftX = xf.sx(0.0)
                    val rightX = xf.sx(wall.length)

                    // מלבן-הקיר (פני-החזית)
                    drawRect(Cream, Offset(leftX, topY), Size(rightX - leftX, botY - topY))
                    drawRect(Ink, Offset(leftX, topY), Size(rightX - leftX, botY - topY), style = Stroke(width = 3.dp.toPx()))

                    // קו-רצפה
                    val floorPad = 18.dp.toPx()
                    drawLine(Ink, Offset(leftX - floorPad, botY), Offset(rightX + floorPad, botY), strokeWidth = 5.dp.toPx(), cap = StrokeCap.Round)

                    // ארונות
                    cabPaint.textSize = 11.dp.toPx()
                    for (c in cabinets) {
                        val fl = if (c.id == dragId) dragFromLeft else c.fromLeft
                        val l = xf.sx(fl)
                        var r = xf.sx(fl + c.width)
                        val t = xf.sy(c.heightTo)
                        val b = xf.sy(c.heightFrom)
                        if (r - l < MIN_PX) r = l + MIN_PX
                        val col = beltColor(c.kind)
                        val active = c.id == dragId
                        drawRect(col.copy(alpha = if (active) 0.35f else 0.20f), Offset(l, t), Size(r - l, b - t))
                        drawRect(col, Offset(l, t), Size(r - l, b - t), style = Stroke(width = if (active) 3.dp.toPx() else 2.dp.toPx()))
                        val midX = (l + r) / 2f
                        val midY = (t + b) / 2f
                        nc.drawText(c.name, midX, midY - 4.dp.toPx(), cabPaint)
                        nc.drawText("${c.width.mm()} ${Prefs.unitSuffix}", midX, midY + 14.dp.toPx(), cabPaint)
                    }

                    // עצירות-ארון (Cabinet stops) — קו-מקווקו אדום מהרצפה לתקרה + דגלון
                    stopPaint.textSize = 11.dp.toPx()
                    for (s in stops) {
                        val x = xf.sx(s.coerceIn(0.0, wall.length))
                        drawLine(
                            BlockRed, Offset(x, topY - 8.dp.toPx()), Offset(x, botY),
                            strokeWidth = 2.dp.toPx(),
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f), 0f),
                        )
                        drawRect(BlockRed, Offset(x - 3.dp.toPx(), topY - 12.dp.toPx()), Size(6.dp.toPx(), 6.dp.toPx()))
                        nc.drawText("⟂ ${s.mm()}", x, topY - 16.dp.toPx(), stopPaint)
                    }

                    // תווית-רוחב הקיר
                    wallPaint.textSize = 13.dp.toPx()
                    nc.drawText("${wall.length.mm()} ${Prefs.unitSuffix}", (leftX + rightX) / 2f, botY + 34.dp.toPx(), wallPaint)
                }
            }

            // ── לוח-תחתון: הוספת-ארון + עצירות ─────────────────────────────
            Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    BigButton("➕ הוסף ארון", Orange, enabled = true, modifier = Modifier.weight(1f)) { adding = true }
                    BigButton("⟂ עצירה בסוף", Teal, enabled = wall.length > 0.0, modifier = Modifier.weight(1f)) {
                        stops.add(totalWidth.coerceIn(0.0, wall.length))
                    }
                }
                if (stops.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    BigButton("נקה עצירות (${stops.size})", Muted, enabled = true, modifier = Modifier.fillMaxWidth()) { stops.clear() }
                }
            }
        }
    }

    // ── דיאלוג-עריכה (ארון קיים) ─────────────────────────────────────────
    editing?.let { cab ->
        CabinetDialog(
            title = "עריכת ${cab.name}",
            initial = cab,
            confirmLabel = "שמור",
            onConfirm = { onUpdate(it); editing = null },
            onDelete = { onDelete(cab); editing = null },
            onDismiss = { editing = null },
        )
    }

    // ── דיאלוג-הוספה (טיפוס + רוחב מהקטלוג) ──────────────────────────────
    if (adding) {
        val default = remember(wall.id) {
            CabinetCatalog.newCabinet(
                roomId = wall.roomId,
                wallId = wall.id,
                kind = CabinetKind.BASE_1DOOR,
                fromLeft = 0.0,
            )
        }
        CabinetDialog(
            title = "הוסף ארון",
            initial = default,
            confirmLabel = "הוסף",
            onConfirm = { onAdd(it); adding = false },
            onDelete = null,
            onDismiss = { adding = false },
        )
    }
}

/** hit-test של ארון מול נקודת-מגע (עם slop). */
private fun hitCabinet(c: CabinetEntity, xf: CabXf, p: Offset): Boolean {
    val l = xf.sx(c.fromLeft)
    val r = xf.sx(c.fromLeft + c.width)
    val t = xf.sy(c.heightTo)
    val b = xf.sy(c.heightFrom)
    return p.x >= min(l, r) - TAP_SLOP && p.x <= max(l, r) + TAP_SLOP &&
        p.y >= t - TAP_SLOP && p.y <= b + TAP_SLOP
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  RowFitBar — פס בדיקת-R1: Σרוחבי-ארונות מול אורך-הקיר.
 *   ירוק = נכנס (±tol) · ענבר = חוסר (פער — מילואה) · אדום = עודף (חורג).
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun RowFitBar(wallLength: Double, totalWidth: Double, remaining: Double) {
    val tol = 20.0 // מ"מ — סף-סובלנות ל"נכנס"
    val col = when {
        remaining < -tol -> BlockRed
        remaining > tol -> WarnAmber
        else -> OkGreen
    }
    val label = when {
        remaining < -tol -> "עודף — חורג ב-${(-remaining).mm()} ${Prefs.unitSuffix} (השורה לא נכנסת)"
        remaining > tol -> "חוסר — פער ${remaining.mm()} ${Prefs.unitSuffix} (נדרשת מילואה/מודול)"
        else -> "נכנס ✓ (פער ${remaining.mm()} ${Prefs.unitSuffix})"
    }
    Column(Modifier.fillMaxWidth().background(col.copy(alpha = 0.10f)).padding(horizontal = 12.dp, vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Σ ${totalWidth.mm()} / ${wallLength.mm()} ${Prefs.unitSuffix}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Ink)
            Spacer(Modifier.weight(1f))
            Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = col)
        }
        Spacer(Modifier.height(6.dp))
        // פס-מילוי ויזואלי (יחס-מילוי מוגבל ל-1 כדי לא לחרוג מהמסך)
        val frac = if (wallLength > 0) (totalWidth / wallLength).coerceIn(0.0, 1.0).toFloat() else 0f
        Box(Modifier.fillMaxWidth().height(8.dp).background(Muted.copy(alpha = 0.20f), RoundedCornerShape(4.dp))) {
            Box(Modifier.fillMaxWidth(frac).height(8.dp).background(col, RoundedCornerShape(4.dp)))
        }
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  CabinetDialog — בורר טיפוס+רוחב ועורך-מידות. משמש להוספה ולעריכה.
 *  טיפוס: 7 צ'יפים (החגורה קובעת עומק/גובה ברירת-מחדל); רוחב: צ'יפים מהקטלוג.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun CabinetDialog(
    title: String,
    initial: CabinetEntity,
    confirmLabel: String,
    onConfirm: (CabinetEntity) -> Unit,
    onDelete: (() -> Unit)?,
    onDismiss: () -> Unit,
) {
    var kind by remember { mutableStateOf(CabinetKind.of(initial.kind)) }
    var nameTxt by remember { mutableStateOf(initial.name) }
    var widthTxt by remember { mutableStateOf(initial.width.mm()) }
    var fromLeftTxt by remember { mutableStateOf(initial.fromLeft.mm()) }
    var depthTxt by remember { mutableStateOf(initial.depth.mm()) }
    var fromTxt by remember { mutableStateOf(initial.heightFrom.mm()) }
    var toTxt by remember { mutableStateOf(initial.heightTo.mm()) }
    // האם המשתמש נגע ידנית בשם/עומק/גבהים — אם לא, בחירת-טיפוס דורסת אותם.
    var nameEdited by remember { mutableStateOf(false) }
    var dimsEdited by remember { mutableStateOf(false) }

    fun num(s: String, fb: Double) = Prefs.parseToMm(s) ?: fb   // קלט ביחידת-התצוגה → מ"מ

    fun pickKind(k: CabinetKind) {
        kind = k
        if (!nameEdited) nameTxt = k.he
        if (!dimsEdited) {
            depthTxt = k.defaultDepth.mm()
            fromTxt = k.defaultHeightFrom.mm()
            toTxt = k.defaultHeightTo.mm()
            widthTxt = k.defaultWidth.mm()
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                onConfirm(
                    initial.copy(
                        kind = kind.name,
                        name = nameTxt.ifBlank { kind.he },
                        width = num(widthTxt, kind.defaultWidth),
                        fromLeft = num(fromLeftTxt, initial.fromLeft),
                        depth = num(depthTxt, kind.defaultDepth),
                        heightFrom = num(fromTxt, kind.defaultHeightFrom),
                        heightTo = num(toTxt, kind.defaultHeightTo),
                        doorType = kind.defaultDoorType,
                    ),
                )
            }) { Text(confirmLabel, color = Orange, fontWeight = FontWeight.Bold) }
        },
        dismissButton = {
            Row {
                if (onDelete != null) {
                    TextButton(onClick = onDelete) { Text("מחק", color = BlockRed) }
                    Spacer(Modifier.width(4.dp))
                }
                TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) }
            }
        },
        title = { Text(title, fontWeight = FontWeight.Bold, color = Ink) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text("טיפוס", fontSize = 12.sp, color = Teal, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(6.dp))
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (k in CabinetCatalog.kinds) {
                        SelChip(text = k.he, selected = k == kind, color = beltColor(k.name)) { pickKind(k) }
                    }
                }
                Spacer(Modifier.height(12.dp))

                Text("רוחב-מודול (${Prefs.unitSuffix})", fontSize = 12.sp, color = Teal, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(6.dp))
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (wmm in CabinetCatalog.moduleWidths) {
                        val selected = Prefs.parseToMm(widthTxt) == wmm
                        SelChip(text = wmm.mm(), selected = selected, color = Orange) { widthTxt = wmm.mm(); dimsEdited = true }
                    }
                }
                Spacer(Modifier.height(12.dp))

                NumField("שם", nameTxt, KeyboardType.Text) { nameTxt = it; nameEdited = true }
                Spacer(Modifier.height(8.dp))
                NumField("רוחב (${Prefs.unitSuffix})", widthTxt, KeyboardType.Number) { widthTxt = it; dimsEdited = true }
                Spacer(Modifier.height(8.dp))
                NumField("מרחק משמאל (${Prefs.unitSuffix})", fromLeftTxt, KeyboardType.Number) { fromLeftTxt = it }
                Spacer(Modifier.height(8.dp))
                NumField("עומק (${Prefs.unitSuffix})", depthTxt, KeyboardType.Number) { depthTxt = it; dimsEdited = true }
                Spacer(Modifier.height(8.dp))
                NumField("גובה תחתית מהרצפה (${Prefs.unitSuffix})", fromTxt, KeyboardType.Number) { fromTxt = it; dimsEdited = true }
                Spacer(Modifier.height(8.dp))
                NumField("גובה ראש מהרצפה (${Prefs.unitSuffix})", toTxt, KeyboardType.Number) { toTxt = it; dimsEdited = true }
            }
        },
        containerColor = Color.White,
    )
}

@Composable
private fun SelChip(text: String, selected: Boolean, color: Color, onClick: () -> Unit) {
    val bg = if (selected) color else color.copy(alpha = 0.12f)
    val fg = if (selected) Color.White else Ink
    Box(
        Modifier
            .background(bg, RoundedCornerShape(10.dp))
            .border(1.dp, color.copy(alpha = if (selected) 1f else 0.4f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) { Text(text, color = fg, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1) }
}

@Composable
private fun NumField(label: String, value: String, kb: KeyboardType, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = kb),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun BigButton(label: String, container: Color, enabled: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val bg = if (enabled) container else Muted.copy(alpha = 0.25f)
    val fg = if (enabled) Color.White else Muted
    Box(
        modifier
            .heightIn(min = 54.dp)
            .background(bg, RoundedCornerShape(14.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = fg, fontSize = 16.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) }
}

// קבועי-ציור
private const val PAD_PX = 90f
private const val MIN_PX = 26f
private const val TAP_SLOP = 24f
