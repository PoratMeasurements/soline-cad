package il.co.soline.measure.ui.draw

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.geometry.ArcWall
import il.co.soline.measure.geometry.WallBuilder
import il.co.soline.measure.geometry.WallCloseTools
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.WarnAmber
import il.co.soline.measure.ui.cad.CadToolbar
import il.co.soline.measure.ui.close.CloseToolsBar
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/* ─────────────────────────────────────────────────────────────────────────────
 *  LiveCadScreen — מסך-השרטוט החי (§3 "תצוגת מבט-על", §2 "שיטת-בניית-הקירות").
 *
 *  לב-האפליקציה: המודד רואה את החדר נשרטט חי על קנבס דמוי-CAD תוך כדי מדידה —
 *  "לרוץ על הקירות עם הטאבלט". קנבס מלא-מסך עם pan+zoom, מידות/זוויות בעברית,
 *  סימון-בליטות עם חיווי-התנגשות, שכבות-תצוגה, וסרגל-בנייה חי בתחתית.
 *
 *  הגאומטריה כולה נגזרת מ-WallBuilder.layout (מקור-אמת יחיד) — הקנבס נשלט ע"י
 *  פרמטר walls, ולכן כל הוספת-קיר (onAddWall שמתמיד ב-repo) מציירת מיד את החדר הגדל.
 *  קובץ עצמאי: כל טיפוסי-העזר מוגדרים מקומית, בלי תלות מעבר לטיפוסים-היציבים.
 *
 *  סביב הקנבס מרכיב זה עוטף שני סרגלי-עריכה מוכנים (בלי לשנות את מוסכמת-הזווית/
 *  ההוספה של הקנבס): CadToolbar (בטל/בצע-שוב + עריכת קו/מידה/זווית) ו-CloseToolsBar
 *  (סגירת-היקף אוטומטית/ידנית).
 * ───────────────────────────────────────────────────────────────────────────── */

/** נקודת-מסך (פיקסלים). */
private data class Px(val x: Float, val y: Float)

/** מצב-דיאלוג פעיל של סרגל-ה-CAD (הוספה/עריכה/קיר-סוגר). */
private sealed interface CadDialog {
    /** הוספת קיר חדש (זהה לכניסת-ההוספה של הקנבס). */
    object Add : CadDialog
    /** קיר-סוגר עם אורך+זווית שחושבו ע"י WallCloseTools — פתוח לאישור/עריכה. */
    data class ClosingPrefill(val length: Double, val angle: Double) : CadDialog
    /** הוספת קיר-קשת (מיתר + בליטה + צד). */
    object Arc : CadDialog
    /** עריכת מידת-האורך של קיר קיים. */
    data class EditDim(val wall: WallEntity) : CadDialog
    /** עריכת זווית-הפנייה של קיר קיים. */
    data class EditAngle(val wall: WallEntity) : CadDialog
}

/**
 * מסך-שרטוט חי (Live CAD) של חדר בודד.
 *
 * @param walls              קירות החדר (מסודרים לפי idx); מזין את הקנבס — שינוי מצייר מחדש מיד.
 * @param accessoriesByWall  בליטות לפי מזהה-קיר (wallId → רשימה).
 * @param onAddWall          הוספת-קיר חי: (אורך במ"מ, זווית-פנייה במעלות). על ה-host להתמיד ב-repo.
 * @param onRemoveLastWall   הסרת הקיר-האחרון (משמש ל"בטל"/"מחק").
 * @param onUpdateWall       עדכון קיר קיים (משמש לעריכת-מידה/זווית).
 * @param onBack             חזרה למסך-הקודם.
 */
@Composable
fun LiveCadScreen(
    walls: List<WallEntity>,
    accessoriesByWall: Map<Long, List<AccessoryEntity>>,
    onAddWall: (lengthMm: Double, angleDeg: Double) -> Unit,
    onRemoveLastWall: () -> Unit,
    onUpdateWall: (WallEntity) -> Unit,
    onBack: () -> Unit,
    onAddArc: (incomingTurnDeg: Double, segments: List<Pair<Double, Double>>) -> Unit = { _, _ -> },
) {
    // שכבות-תצוגה (§3 "שליטה בתצוגה בלייב")
    var showDims by remember { mutableStateOf(true) }
    var showAngles by remember { mutableStateOf(true) }
    var showObjects by remember { mutableStateOf(true) }
    var showGrid by remember { mutableStateOf(true) }

    // pan + zoom (transform ידני מעל האוטו-פיט)
    var userScale by remember { mutableStateOf(1f) }
    var panX by remember { mutableStateOf(0f) }
    var panY by remember { mutableStateOf(0f) }

    // עריכת-CAD: מחסנית-Redo (אורך,זווית שהוסרו ב"בטל"), נעילת-זווית, ודיאלוג פעיל.
    val redoStack = remember { mutableStateListOf<Pair<Double, Double>>() }
    var angleLock by remember { mutableStateOf(true) }
    var dialog by remember { mutableStateOf<CadDialog?>(null) }

    val ordered = remember(walls) { walls.sortedBy { it.idx } }
    val pts = remember(ordered) { WallBuilder.layout(ordered) }
    val closed = remember(pts) { WallBuilder.isClosed(pts) }
    val gap = remember(pts) { WallBuilder.closingGap(pts) }
    val closure = remember(ordered) { WallCloseTools.closingReport(ordered) }

    // כשנעילת-הזווית דלוקה — צמצום זוויות מוקלדות לצעדי 15° (לא נוגע במוסכמת-הקנבס).
    fun snapAngle(a: Double): Double = if (angleLock) (a / 15.0).roundToInt() * 15.0 else a

    // הוספת-קיר ידנית: פותחת "ענף-היסטוריה" חדש ולכן מנקה את מחסנית ה-Redo.
    fun addWallManual(len: Double, ang: Double) {
        redoStack.clear()
        onAddWall(len, ang)
    }

    // בטל: זוכר את (אורך,זווית) של הקיר-האחרון ב-Redo, ואז מסיר אותו.
    fun doUndo() {
        ordered.lastOrNull()?.let { redoStack.add(it.length to it.angle) }
        onRemoveLastWall()
    }

    // בצע-שוב: שולף את הקיר האחרון שבוטל ומוסיף אותו מחדש (בלי לנקות את המחסנית).
    fun doRedo() {
        val restored = redoStack.removeLastOrNull() ?: return
        onAddWall(restored.first, restored.second)
    }

    Column(Modifier.fillMaxSize().background(Cream)) {

        // ── סרגל-עליון: חזרה + מותג + שכבות ─────────────────────────────
        Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
                Spacer(Modifier.width(4.dp))
                Column(Modifier.weight(1f)) {
                    Text("soline", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Orange, lineHeight = 24.sp)
                    Text("שרטוט חי · מבט-על", fontSize = 12.sp, color = Teal)
                }
                ClosureBadge(closed, gap)
            }
            Spacer(Modifier.height(8.dp))
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                LayerChip("מידות", showDims) { showDims = !showDims }
                LayerChip("זוויות", showAngles) { showAngles = !showAngles }
                LayerChip("אובייקטים", showObjects) { showObjects = !showObjects }
                LayerChip("רשת", showGrid) { showGrid = !showGrid }
            }
        }

        // ── סרגל-CAD: בטל/בצע-שוב + כלי-עריכה קבועים (רכיב מוכן) ─────────
        Row(
            Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 8.dp, vertical = 6.dp)
                .horizontalScroll(rememberScrollState()),
        ) {
            CadToolbar(
                canUndo = ordered.isNotEmpty(),
                canRedo = redoStack.isNotEmpty(),
                angleLock = angleLock,
                hasSelection = ordered.isNotEmpty(),
                onUndo = { doUndo() },
                onRedo = { doRedo() },
                onAddLine = { dialog = CadDialog.Add },
                onEditDimension = { ordered.lastOrNull()?.let { dialog = CadDialog.EditDim(it) } },
                onEditAngle = { ordered.lastOrNull()?.let { dialog = CadDialog.EditAngle(it) } },
                onDelete = { doUndo() },
                onFitView = { userScale = 1f; panX = 0f; panY = 0f },
                onToggleAngleLock = { angleLock = !angleLock },
                onClear = { redoStack.clear(); repeat(ordered.size) { onRemoveLastWall() } },
            )
            Spacer(Modifier.width(6.dp))
            Box(
                Modifier
                    .align(Alignment.CenterVertically)
                    .background(Teal.copy(alpha = 0.12f), RoundedCornerShape(12.dp))
                    .border(1.dp, Teal.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                    .clickable { dialog = CadDialog.Arc }
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            ) { Text("⌒ קשת", color = Teal, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
        }

        // ── הקנבס (מלא-מסך, pan+zoom) ────────────────────────────────────
        Box(
            Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(8.dp)
                .background(Cream, RoundedCornerShape(12.dp))
                .border(1.dp, Muted.copy(alpha = 0.25f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            // Paint-ים לעברית (android.graphics.Paint תומך בדו-כיווניות)
            val dimPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Teal.toArgb(); textAlign = Paint.Align.CENTER } }
            val idxPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Muted.toArgb(); textAlign = Paint.Align.CENTER } }
            val anglePaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Orange.toArgb(); textAlign = Paint.Align.CENTER } }
            val objPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Ink.toArgb(); textAlign = Paint.Align.CENTER } }

            if (ordered.isEmpty()) {
                Text(
                    "אין קירות עדיין.\nהוסף קיר ראשון בסרגל למטה — והחדר יתחיל להישרטט חי.",
                    color = Muted, fontSize = 15.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            } else {
                Canvas(
                    Modifier
                        .fillMaxSize()
                        .pointerInput(Unit) {
                            detectTransformGestures { _, pan, zoom, _ ->
                                userScale = (userScale * zoom).coerceIn(0.2f, 12f)
                                panX += pan.x
                                panY += pan.y
                            }
                        },
                ) {
                    // אוטו-פיט: מרכז ה-bbox וסקאלת-בסיס שממלאת עם שוליים (מחושב מחדש כל פריים → החדר נשאר ממורכז תוך כדי גדילה)
                    val margin = 64.dp.toPx()
                    val (cx, cy, baseScale) = fit(pts, size.width, size.height, margin)
                    val eff = baseScale * userScale

                    fun toScreen(p: WallBuilder.Pt) = Px(
                        ((p.x - cx) * eff + size.width / 2f + panX).toFloat(),
                        ((p.y - cy) * eff + size.height / 2f + panY).toFloat(),
                    )

                    // רשת עולם-מיושרת (נגררת/מתקרבת עם התוכן) — §3 "סרגל-תצוגה"
                    if (showGrid) drawWorldGrid(toScreen(WallBuilder.Pt(0.0, 0.0)), 500.0 * eff)

                    // קירות — קווים עבים
                    val strokeW = 5.dp.toPx()
                    for (i in ordered.indices) {
                        val a = toScreen(pts[i])
                        val b = toScreen(pts[i + 1])
                        drawLine(Ink, Offset(a.x, a.y), Offset(b.x, b.y), strokeWidth = strokeW, cap = StrokeCap.Round)
                    }
                    // קודקודים
                    for (v in pts) {
                        val s = toScreen(v)
                        drawCircle(Orange, 5.dp.toPx(), Offset(s.x, s.y))
                    }

                    // מידות-אורך בעברית במרכז-הקיר, מוסטות החוצה
                    if (showDims) {
                        dimPaint.textSize = 13.dp.toPx()
                        idxPaint.textSize = 10.dp.toPx()
                        for (i in ordered.indices) {
                            val w = ordered[i]
                            val hRad = segHeading(pts[i], pts[i + 1])
                            val midX = ((pts[i].x + pts[i + 1].x) / 2.0)
                            val midY = ((pts[i].y + pts[i + 1].y) / 2.0)
                            val m = toScreen(WallBuilder.Pt(midX, midY))
                            val (nx, ny) = outwardNormal(hRad)
                            val off = 18.dp.toPx()
                            drawContext.canvas.nativeCanvas.apply {
                                drawText(Prefs.formatLen(w.length), m.x + nx * off, m.y + ny * off + 4.dp.toPx(), dimPaint)
                                drawText("קיר ${w.idx + 1}", m.x - nx * off, m.y - ny * off, idxPaint)
                            }
                        }
                    }

                    // זוויות בקודקודים (כולל 45°) — §3 "תצוגת-זוויות"
                    if (showAngles) {
                        anglePaint.textSize = 12.dp.toPx()
                        for (i in ordered.indices) {
                            if (i == ordered.lastIndex) continue // אין קודקוד-פנימי אחרי הקיר האחרון
                            val v = toScreen(pts[i + 1])
                            drawContext.canvas.nativeCanvas.drawText(
                                "${trimAngle(ordered[i].angle)}°", v.x, v.y - 9.dp.toPx(), anglePaint,
                            )
                        }
                    }

                    // בליטות (אובייקטים) לאורך הקיר ב-fromLeft; צבע לפי התנגשות (§5 עומק-בליטה, R4)
                    if (showObjects) {
                        objPaint.textSize = 10.dp.toPx()
                        for (i in ordered.indices) {
                            val w = ordered[i]
                            val accs = accessoriesByWall[w.id] ?: continue
                            val hRad = segHeading(pts[i], pts[i + 1])
                            val dirX = cos(hRad); val dirY = sin(hRad)
                            val (nx, ny) = outwardNormal(hRad)
                            for (acc in accs) {
                                val t = acc.fromLeft.coerceIn(0.0, w.length)
                                val base = toScreen(WallBuilder.Pt(pts[i].x + dirX * t, pts[i].y + dirY * t))
                                val collide = acc.depth > 15.0
                                val col = if (collide) BlockRed else WarnAmber
                                val depthPx = max((acc.depth * eff).toFloat(), 10.dp.toPx())
                                val mark = Offset(base.x + nx * depthPx, base.y + ny * depthPx)
                                drawLine(col, Offset(base.x, base.y), mark, strokeWidth = 3.dp.toPx(), cap = StrokeCap.Round)
                                drawCircle(col, 4.5.dp.toPx(), mark)
                                objPaint.color = col.toArgb()
                                drawContext.canvas.nativeCanvas.drawText(
                                    acc.name, mark.x + nx * 13.dp.toPx(), mark.y + ny * 13.dp.toPx() + 3.dp.toPx(), objPaint,
                                )
                            }
                        }
                    }
                }

                // איפוס-תצוגה (pan/zoom) — נוחות-שדה
                if (userScale != 1f || panX != 0f || panY != 0f) {
                    Box(Modifier.align(Alignment.BottomStart).padding(10.dp)) {
                        SmallPill("איפוס תצוגה") { userScale = 1f; panX = 0f; panY = 0f }
                    }
                }
            }
        }

        // ── סרגל-סגירת-היקף (סגירה אוטומטית / קיר-סוגר ידני) ─────────────
        if (ordered.size >= 3) {
            CloseToolsBar(
                closure = closure,
                onCloseAuto = {
                    WallCloseTools.addClosingWall(ordered)?.let { addWallManual(it.length, it.angle) }
                },
                onAddClosingWall = {
                    WallCloseTools.addClosingWall(ordered)?.let {
                        dialog = CadDialog.ClosingPrefill(it.length, it.angle)
                    }
                },
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            )
        }

        // ── סרגל-בנייה חי (הוספת-הקיר-הבא) ──────────────────────────────
        BuildBar(nextIdx = ordered.size + 1, onAddWall = { l, a -> addWallManual(l, a) })
    }

    // ── דיאלוגים של סרגל-ה-CAD ──────────────────────────────────────────
    when (val d = dialog) {
        CadDialog.Add -> AddWallDialog(
            title = "הוסף קיר",
            initialLength = "",
            initialAngle = "90",
            onDismiss = { dialog = null },
            onConfirm = { len, ang -> addWallManual(len, snapAngle(ang)); dialog = null },
        )
        is CadDialog.ClosingPrefill -> AddWallDialog(
            title = "קיר סוגר",
            initialLength = Prefs.toDisplayText(d.length),
            initialAngle = trimAngle(d.angle),
            onDismiss = { dialog = null },
            onConfirm = { len, ang -> addWallManual(len, snapAngle(ang)); dialog = null },
        )
        is CadDialog.EditDim -> EditValueDialog(
            title = "ערוך מידה — קיר ${d.wall.idx + 1}",
            label = "אורך (${Prefs.unitSuffix})",
            initial = Prefs.toDisplayText(d.wall.length),
            onDismiss = { dialog = null },
            onConfirm = { v -> onUpdateWall(d.wall.copy(length = Prefs.toMm(v))); dialog = null },
        )
        is CadDialog.EditAngle -> EditValueDialog(
            title = "ערוך זווית — קיר ${d.wall.idx + 1}",
            label = "זווית-פנייה (מעלות)",
            initial = trimAngle(d.wall.angle),
            onDismiss = { dialog = null },
            onConfirm = { v -> onUpdateWall(d.wall.copy(angle = snapAngle(v))); dialog = null },
        )
        CadDialog.Arc -> ArcDialog(
            onDismiss = { dialog = null },
            onConfirm = { chord, sagitta, ccw, segs ->
                ArcWall.arcChain(chord, sagitta, ccw, segs)?.let { chain ->
                    redoStack.clear()
                    onAddArc(chain.incomingTurnDeg, chain.segments.map { it.lengthMm to it.turnToNextDeg })
                }
                dialog = null
            },
        )
        null -> Unit
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  דיאלוג קיר-קשת — מיתר + בליטה (sagitta) + צד + מספר-קטעים. הקשת מתווספת
 *  כשרשרת-קטעים קצרים (ArcWall.arcChain), משיקה לקיר-הקודם.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun ArcDialog(
    onDismiss: () -> Unit,
    onConfirm: (chordMm: Double, sagittaMm: Double, ccw: Boolean, segments: Int) -> Unit,
) {
    var chordTxt by remember { mutableStateOf("") }
    var sagTxt by remember { mutableStateOf("") }
    var ccw by remember { mutableStateOf(true) }
    var segTxt by remember { mutableStateOf("8") }

    val chord = Prefs.parseToMm(chordTxt)   // קלט ביחידת-התצוגה → מ"מ
    val sag = Prefs.parseToMm(sagTxt)
    val segs = segTxt.toIntOrNull() ?: 8
    val ok = chord != null && chord > 0.0 && sag != null && sag > 0.0
    val radius = if (ok) ArcWall.radiusOf(chord!!, sag!!) else null

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color.White,
        title = { Text("הוסף קיר-קשת", fontWeight = FontWeight.Bold, color = Ink) },
        text = {
            Column {
                OutlinedTextField(
                    value = chordTxt, onValueChange = { chordTxt = it },
                    label = { Text("מיתר — מרחק ישר בין קצוות (${Prefs.unitSuffix})") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = sagTxt, onValueChange = { sagTxt = it },
                    label = { Text("בליטה — גובה-הקשת מעל-המיתר (${Prefs.unitSuffix})") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("צד:", color = Ink, fontSize = 13.sp)
                    Spacer(Modifier.width(8.dp))
                    AngleChip("שמאל ⟲", ccw) { ccw = true }
                    Spacer(Modifier.width(6.dp))
                    AngleChip("ימין ⟳", !ccw) { ccw = false }
                }
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = segTxt, onValueChange = { segTxt = it },
                    label = { Text("מספר-קטעים (2–64)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.width(180.dp),
                )
                if (radius != null && radius.isFinite()) {
                    Spacer(Modifier.height(6.dp))
                    Text("רדיוס מחושב ≈ ${Prefs.formatLen(radius)}", color = Teal, fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { if (ok) onConfirm(chord!!, sag!!, ccw, segs.coerceIn(2, 64)) }, enabled = ok) {
                Text("הוסף קשת", color = Orange, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) } },
    )
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  סרגל-בנייה: אורך + זווית (90°/45°/מותאם) + "הוסף קיר" — one-tap-per-action (§1).
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun BuildBar(nextIdx: Int, onAddWall: (Double, Double) -> Unit) {
    var lengthTxt by remember { mutableStateOf("") }
    // ברירת-מחדל לזווית לפי הגדרת נעילת-זווית 90° (Prefs.angleLockDefault)
    var angleMode by remember { mutableStateOf(if (Prefs.angleLockDefault) AngleMode.DEG90 else AngleMode.CUSTOM) }
    var customTxt by remember { mutableStateOf("90") }

    val chosenAngle: Double? = when (angleMode) {
        AngleMode.DEG90 -> 90.0
        AngleMode.DEG45 -> 45.0
        AngleMode.CUSTOM -> customTxt.toDoubleOrNull()
    }
    val lengthMm = Prefs.parseToMm(lengthTxt)   // קלט ביחידת-התצוגה → מ"מ
    val canAdd = lengthMm != null && lengthMm > 0.0 && chosenAngle != null

    Column(
        Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Text("הוספת קיר $nextIdx", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Ink)
        Spacer(Modifier.height(6.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = lengthTxt,
                onValueChange = { lengthTxt = it },
                label = { Text("אורך (${Prefs.unitSuffix})") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                AngleChip("90°", angleMode == AngleMode.DEG90) { angleMode = AngleMode.DEG90 }
                AngleChip("45°", angleMode == AngleMode.DEG45) { angleMode = AngleMode.DEG45 }
                AngleChip("מותאם", angleMode == AngleMode.CUSTOM) { angleMode = AngleMode.CUSTOM }
            }
        }
        if (angleMode == AngleMode.CUSTOM) {
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(
                value = customTxt,
                onValueChange = { customTxt = it },
                label = { Text("זווית-פנייה (מעלות)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.widthIn(min = 140.dp).width(180.dp),
            )
        }
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = {
                if (canAdd) {
                    onAddWall(lengthMm!!, chosenAngle!!)
                    lengthTxt = "" // מוכן לקיר-הבא, one-tap-per-action
                }
            },
            enabled = canAdd,
            colors = ButtonDefaults.buttonColors(containerColor = Orange, contentColor = Color.White),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("הוסף קיר", fontWeight = FontWeight.Bold) }
    }
}

private enum class AngleMode { DEG90, DEG45, CUSTOM }

/* ─────────────────────────────────────────────────────────────────────────────
 *  דיאלוגים לסרגל-ה-CAD (הוספה / עריכת-ערך יחיד). כל הטקסט בעברית, לשון-זכר.
 * ───────────────────────────────────────────────────────────────────────────── */

/** דיאלוג הוספת-קיר (אורך + זווית-פנייה). משמש גם ל"הוסף קו" וגם ל"קיר סוגר" מוקדם-מילוי. */
@Composable
private fun AddWallDialog(
    title: String,
    initialLength: String,
    initialAngle: String,
    onDismiss: () -> Unit,
    onConfirm: (length: Double, angle: Double) -> Unit,
) {
    var lenTxt by remember { mutableStateOf(initialLength) }
    var angTxt by remember { mutableStateOf(initialAngle) }
    val len = Prefs.parseToMm(lenTxt)   // קלט ביחידת-התצוגה → מ"מ
    val ang = angTxt.toDoubleOrNull()
    val ok = len != null && len > 0.0 && ang != null

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color.White,
        title = { Text(title, fontWeight = FontWeight.Bold, color = Ink) },
        text = {
            Column {
                OutlinedTextField(
                    value = lenTxt,
                    onValueChange = { lenTxt = it },
                    label = { Text("אורך (${Prefs.unitSuffix})") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = angTxt,
                    onValueChange = { angTxt = it },
                    label = { Text("זווית-פנייה (מעלות)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { if (ok) onConfirm(len!!, ang!!) }, enabled = ok) {
                Text("הוסף", color = Orange, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) }
        },
    )
}

/** דיאלוג עריכת-ערך-יחיד (מידה או זווית) של קיר נבחר. */
@Composable
private fun EditValueDialog(
    title: String,
    label: String,
    initial: String,
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit,
) {
    var txt by remember { mutableStateOf(initial) }
    val value = txt.toDoubleOrNull()

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color.White,
        title = { Text(title, fontWeight = FontWeight.Bold, color = Ink) },
        text = {
            OutlinedTextField(
                value = txt,
                onValueChange = { txt = it },
                label = { Text(label) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
        },
        confirmButton = {
            TextButton(onClick = { value?.let(onConfirm) }, enabled = value != null) {
                Text("שמור", color = Orange, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) }
        },
    )
}

/* ─── חיוויים / צ'יפים ──────────────────────────────────────────────────────── */

@Composable
private fun ClosureBadge(closed: Boolean, gapMm: Double) {
    val (bg, fg, txt) = if (closed) {
        Triple(OkGreen.copy(alpha = 0.14f), OkGreen, "✓ סגור")
    } else {
        Triple(WarnAmber.copy(alpha = 0.14f), WarnAmber, "פער ${Prefs.formatLen(gapMm)}")
    }
    Box(
        Modifier
            .background(bg, RoundedCornerShape(50))
            .border(1.dp, fg.copy(alpha = 0.5f), RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) { Text(txt, color = fg, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun LayerChip(label: String, on: Boolean, onClick: () -> Unit) {
    val bg = if (on) Teal else Color.White
    val fg = if (on) Color.White else Muted
    Box(
        Modifier
            .background(bg, RoundedCornerShape(50))
            .border(1.dp, if (on) Teal else Muted.copy(alpha = 0.4f), RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 7.dp)
            .wrapContentHeight(),
    ) { Text((if (on) "● " else "○ ") + label, color = fg, fontSize = 12.sp, fontWeight = FontWeight.SemiBold) }
}

@Composable
private fun AngleChip(label: String, on: Boolean, onClick: () -> Unit) {
    val bg = if (on) Orange else Color.White
    val fg = if (on) Color.White else Ink
    Box(
        Modifier
            .background(bg, RoundedCornerShape(10.dp))
            .border(1.dp, if (on) Orange else Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) { Text(label, color = fg, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun SmallPill(label: String, onClick: () -> Unit) {
    Box(
        Modifier
            .background(Color.White, RoundedCornerShape(50))
            .border(1.dp, Muted.copy(alpha = 0.4f), RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) { Text("⟲ $label", color = Ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold) }
}

/* ─── גאומטריית-מסך (עזרי-קובץ) ─────────────────────────────────────────────── */

/** מרכז ה-bbox (cx,cy במ"מ) וסקאלת-בסיס שממלאת את הקנבס עם שוליים [pad]. */
private fun fit(pts: List<WallBuilder.Pt>, w: Float, h: Float, pad: Float): Triple<Double, Double, Double> {
    if (pts.isEmpty()) return Triple(0.0, 0.0, 1.0)
    var minX = Double.MAX_VALUE; var minY = Double.MAX_VALUE
    var maxX = -Double.MAX_VALUE; var maxY = -Double.MAX_VALUE
    for (p in pts) {
        minX = min(minX, p.x); minY = min(minY, p.y)
        maxX = max(maxX, p.x); maxY = max(maxY, p.y)
    }
    val spanX = max(maxX - minX, 1.0)
    val spanY = max(maxY - minY, 1.0)
    val sx = (w - 2 * pad) / spanX
    val sy = (h - 2 * pad) / spanY
    val scale = min(sx, sy).let { if (it.isFinite() && it > 0.0) it else 1.0 }
    return Triple((minX + maxX) / 2.0, (minY + maxY) / 2.0, scale)
}

/** כיוון-הקטע (רדיאנים) מ-[a] אל [b]. */
private fun segHeading(a: WallBuilder.Pt, b: WallBuilder.Pt): Double = atan2(b.y - a.y, b.x - a.x)

/** נורמל "החוצה" לקיר (ימין-לכיוון-ההליכה) להסטת תוויות/בליטות. */
private fun outwardNormal(headingRad: Double): Pair<Float, Float> =
    sin(headingRad).toFloat() to (-cos(headingRad)).toFloat()

/** מספר-זווית מסודר: שלם אם עגול, אחרת ספרה-אחת (למשל 45, 91.3). */
private fun trimAngle(deg: Double): String {
    val r = (deg * 10).roundToInt() / 10.0
    return if (r % 1.0 == 0.0) r.toInt().toString() else r.toString()
}

/** רשת עולם-מיושרת: קווים בפאזה של [origin] במרווח [stepPx] פיקסלים. */
private fun DrawScope.drawWorldGrid(origin: Px, stepPx: Double) {
    if (stepPx < 6.0 || !stepPx.isFinite()) return
    val grid = Muted.copy(alpha = 0.15f)
    val sw = 1f
    val step = stepPx.toFloat()
    // קווים אנכיים
    var x = origin.x - floor(origin.x / step) * step
    while (x <= size.width) {
        drawLine(grid, Offset(x, 0f), Offset(x, size.height), strokeWidth = sw)
        x += step
    }
    // קווים אופקיים
    var y = origin.y - floor(origin.y / step) * step
    while (y <= size.height) {
        drawLine(grid, Offset(0f, y), Offset(size.width, y), strokeWidth = sw)
        y += step
    }
}
