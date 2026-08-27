package il.co.soline.measure.ui.elevation

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import il.co.soline.measure.data.AccType
import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.WarnAmber
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/* ─────────────────────────────────────────────────────────────────────────────
 *  WallElevationUnified — מסך-החזית המאוחד של Soline Measure (InnoDraw "Wall
 *  Front View" / Elevation; INNODRAW_FEATURES §7 שורות 145/152, MICHAEL_WISHLIST
 *  §3/§5). זהו הלב של מדידת-מטבח, וכאן שני הכלים חיים תחת מסך אחד:
 *
 *   (א) מצב **מסגרת** — לוכדים סדרת-נקודות בלייזר (מרחק + זווית-אנכית של ה-X6 →
 *       (מיקום-אופקי, גובה)) או בהקשה-ידנית, המשרטטת את מתאר-פני-הקיר האמיתי:
 *       הנמכות, אלכסונים, גובה משתנה. "סיום" מחזיר את הנקודות ל-host להתמדה.
 *       Michael: "עם ה-X6 אני עושה מסגרת של נקודות, וממנה בונים את החזית → DXF+ORDX".
 *
 *   (ב) מצב **אלמנטים** — מציבים ומודדים אביזרים בגובה על פני-החזית (שקעים, מים,
 *       גז, חלונות, הנמכות). לחיצה על אביזר פותחת עורך-מימדים; "הוסף בגובה" מוסיף
 *       חדש; כפתור "קלוט גובה מהלייזר" ממלא גובה-מהרצפה מ-ble.lastReading בירייה
 *       יחידה (ONE-SHOT בלחיצה — לא מוצף מזרם-לייזר חי). קו-סימון/סופיט (soffit,
 *       הנמכת-תקרה) נמתח לרוחב עם גובהו.
 *
 *  הקנבס משרטט את *פני-הקיר*: אם קיימת מסגרת-לכודה — המתאר האמיתי (מצולע-צללית עם
 *  גובה משתנה); אחרת מלבן-הקיר הפשוט (length×height). קו-רצפה + תוויות-מידה בעברית.
 *  שדות-גדולים ידידותיים-לשטח, RTL, צבעי-המותג.
 *
 *  קובץ עצמאי: כל טיפוסי/עזרי-הציור מקומיים ו-file-private; נשען אך ורק על
 *  הטיפוסים היציבים (WallEntity, AccessoryEntity, AccType, LaserBle, צבעי-המותג).
 * ───────────────────────────────────────────────────────────────────────────── */

/** שני מצבי-המסך: לכידת-מתאר-החזית מול הצבת-אלמנטים-בגובה. */
private enum class ElevMode { FRAME, ELEMENTS }

/** נקודת-מסגרת: (מיקום-אופקי מהשמאל, גובה-מהרצפה) — מ"מ. */
private data class FramePt(val x: Double, val y: Double)

/** טרנספורם עולם→מסך למבט-חזית: מ"מ (x מהשמאל, y מהרצפה) → פיקסלים, ולהיפך. */
private data class UnifiedXf(val scale: Float, val left: Float, val bottom: Float) {
    fun sx(xMm: Double) = left + (xMm * scale).toFloat()
    /** yMm = גובה-מהרצפה; רצפה=bottom, המסך יורד → חיסור. */
    fun sy(yMm: Double) = bottom - (yMm * scale).toFloat()
    fun wx(px: Float): Double = ((px - left) / scale).toDouble()
    fun wy(py: Float): Double = ((bottom - py) / scale).toDouble()
}

/** אוטו-פיט של תיבת-העולם (worldW×worldH מ"מ) לתוך קנבס w×h עם שוליים pad. */
private fun unifiedFit(worldW: Double, worldH: Double, w: Float, h: Float, pad: Float): UnifiedXf {
    val lw = max(worldW, 1.0)
    val lh = max(worldH, 1.0)
    val sx = (w - 2 * pad) / lw
    val sy = (h - 2 * pad) / lh
    val scale = min(sx, sy).let { if (it.isFinite() && it > 0.0) it else 1.0 }.toFloat()
    val drawW = (lw * scale).toFloat()
    val drawH = (lh * scale).toFloat()
    val left = (w - drawW) / 2f
    val bottom = (h + drawH) / 2f
    return UnifiedXf(scale, left, bottom)
}

/** צבע-מילוי לפי סוג-אביזר (חשמל=כתום, מים/גז=טורקיז, פתחים=אפור, תקרה=ענבר). */
private fun accColorU(type: String): Color = when (type) {
    "SOCKET_SINGLE", "SOCKET_MULTI", "ELECTRICAL_LINE" -> Orange
    "WATER_PIPE", "GAS_PIPE" -> Teal
    "WINDOW", "DOOR" -> Muted
    "CEILING_DROP" -> WarnAmber
    else -> Teal
}

/** גובה-נמדד מירית-לייזר: רכיב-אנכי D·sin φ אם יש זווית, אחרת המרחק עצמו (2D). */
private fun laserHeightMm(distMm: Double?, vAngleDeg: Double?): Double? {
    val d = distMm ?: return null
    if (d <= 0.0) return null
    val v = vAngleDeg
    if (v != null) {
        val comp = d * sin(Math.toRadians(v))
        if (comp.isFinite() && comp > 1.0) return comp
    }
    return d
}

private fun Double.mmU(): String = roundToInt().toString()

/**
 * מסך-החזית המאוחד לקיר בודד — לכידת-מתאר-חזית + מדידת-אלמנטים-בגובה.
 *
 * @param wall               הקיר (length=רוחב מ"מ, height=גובה מ"מ).
 * @param accessories        אביזרי-הקיר (מיקום ב-fromLeft/fromBottom, מימד width×height).
 * @param initialFramePoints נקודות-מסגרת קיימות (x,y מ"מ) — מתאר-חזית שכבר נלכד; ריק=אין.
 * @param onFramePoints      נקרא ב"סיום-מסגרת" עם רשימת-הנקודות (x,y מ"מ) — על ה-host להתמיד.
 * @param onUpdateAccessory  שמירת-עריכה של אביזר קיים — על ה-host להתמיד ב-repo.
 * @param onAddAccessory     הוספת אביזר חדש (id=0) בגובה-נבחר — על ה-host להתמיד ב-repo.
 * @param onBack             חזרה למסך-הקודם.
 */
@Composable
fun WallElevationUnified(
    wall: WallEntity,
    accessories: List<AccessoryEntity>,
    initialFramePoints: List<Pair<Double, Double>> = emptyList(),
    onFramePoints: (List<Pair<Double, Double>>) -> Unit,
    onUpdateAccessory: (AccessoryEntity) -> Unit,
    onAddAccessory: (AccessoryEntity) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    // אותו סינגלטון-לייזר כמו שאר-המסכים — לא מתנתק ביציאה
    val ble = remember { (context.applicationContext as SolineApp).ble }
    val reading by ble.lastReading.collectAsStateWithLifecycle(null)
    val connected by ble.connected.collectAsStateWithLifecycle(null)
    val status by ble.status.collectAsStateWithLifecycle("")
    val liveMm = reading?.distanceMm
    val liveVDeg = reading?.vAngleDeg

    var mode by remember { mutableStateOf(ElevMode.ELEMENTS) }

    // ── מצב-מסגרת: עותק-עבודה של הנקודות (מזרעים מ-initialFramePoints) ─────────
    var frame by remember(wall.id) {
        mutableStateOf(initialFramePoints.map { FramePt(it.first, it.second) })
    }
    // סטפר-מיקום-אופקי + צעד, ו"מרחק-ירי-ממתין" (dedup לפי ts כמו בלכידת-הצורה)
    var horizMm by remember(wall.id) { mutableStateOf(0.0) }
    var stepMm by remember { mutableStateOf(200.0) }
    var pendingDistMm by remember { mutableStateOf<Double?>(null) }
    var pendingVDeg by remember { mutableStateOf<Double?>(null) }
    var lastTs by remember { mutableStateOf(0L) }
    LaunchedEffect(reading?.ts) {
        val r = reading
        val d = r?.distanceMm
        if (r != null && r.ts != lastTs && d != null && d > 0.0) {
            lastTs = r.ts
            pendingDistMm = d
            pendingVDeg = r.vAngleDeg
        }
    }

    // ── מצב-אלמנטים: דיאלוגים + קו-סימון (סופיט) ─────────────────────────────
    var editing by remember { mutableStateOf<AccessoryEntity?>(null) }
    var adding by remember { mutableStateOf(false) }
    var markerHeight by remember(wall.id) { mutableStateOf<Double?>(null) }
    var markerDialog by remember { mutableStateOf(false) }

    var boxSize by remember { mutableStateOf(IntSize.Zero) }

    // תיבת-העולם: רוחב/גובה נגזרים מהקיר וגם ממתאר-המסגרת (כדי שהכל ייכנס לקנבס)
    val worldW = remember(wall.length, frame) {
        max(wall.length, (frame.maxOfOrNull { it.x } ?: 0.0)).coerceAtLeast(1.0)
    }
    val worldH = remember(wall.height, frame) {
        max(wall.height, (frame.maxOfOrNull { it.y } ?: 0.0)).coerceAtLeast(1.0)
    }

    Column(modifier.fillMaxSize().background(Cream)) {

        // ── סרגל-עליון: חזרה + מותג + בורר-מצב ──────────────────────────────
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
            Spacer(Modifier.width(4.dp))
            Column(Modifier.weight(1f)) {
                Text("soline · חזית קיר", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Orange, lineHeight = 22.sp)
                Text(
                    "רוחב ${wall.length.mmU()} · גובה ${wall.height.mmU()} מ\"מ · ${accessories.size} אביזרים · ${frame.size} נק' מסגרת",
                    fontSize = 12.sp, color = Teal,
                )
            }
        }

        // בורר-מצב: מסגרת ↔ אלמנטים
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ModeTab("▦ מסגרת", mode == ElevMode.FRAME, Modifier.weight(1f)) { mode = ElevMode.FRAME }
            ModeTab("⊞ אלמנטים", mode == ElevMode.ELEMENTS, Modifier.weight(1f)) { mode = ElevMode.ELEMENTS }
        }

        // ── קנבס-החזית ─────────────────────────────────────────────────────
        Box(
            Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(10.dp)
                .background(Color.White, RoundedCornerShape(12.dp))
                .border(1.dp, Muted.copy(alpha = 0.25f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            // remember ללא-תנאי (לפני כל early-return) — אחרת קריסת-slots ב-Compose
            val wallPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Teal.toArgb(); textAlign = Paint.Align.CENTER } }
            val accPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Ink.toArgb(); textAlign = Paint.Align.CENTER } }
            val hPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Muted.toArgb(); textAlign = Paint.Align.CENTER } }
            val idxPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Orange.toArgb(); textAlign = Paint.Align.CENTER } }
            val markPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = WarnAmber.toArgb(); textAlign = Paint.Align.LEFT } }

            if (wall.height <= 0.0 || wall.length <= 0.0) {
                Text(
                    "לקיר אין רוחב/גובה תקינים להצגת חזית.",
                    color = Muted, fontSize = 15.sp, textAlign = TextAlign.Center,
                )
                return@Box
            }

            Canvas(
                Modifier
                    .fillMaxSize()
                    .onSizeChanged { boxSize = it }
                    // הקשה: במצב-מסגרת מפילה נקודה; במצב-אלמנטים בוחרת אביזר-לעריכה
                    .pointerInput(mode, wall.id, accessories, frame, worldW, worldH) {
                        detectTapGestures { tap ->
                            val w = boxSize.width.toFloat()
                            val h = boxSize.height.toFloat()
                            if (w <= 0f || h <= 0f) return@detectTapGestures
                            val xf = unifiedFit(worldW, worldH, w, h, PAD_PXU)
                            if (mode == ElevMode.FRAME) {
                                val x = xf.wx(tap.x).coerceIn(0.0, worldW)
                                val y = xf.wy(tap.y).coerceIn(0.0, worldH)
                                frame = frame + FramePt(x, y)
                                horizMm = x // המשך-הסטפר מהנקודה שהוקשה
                            } else {
                                val hit = accessories.asReversed().firstOrNull { a ->
                                    val l = xf.sx(a.fromLeft)
                                    val r = xf.sx(a.fromLeft + a.width)
                                    val t = xf.sy(a.fromBottom + a.height)
                                    val b = xf.sy(a.fromBottom)
                                    tap.x >= min(l, r) - TAP_SLOPU && tap.x <= max(l, r) + TAP_SLOPU &&
                                        tap.y >= t - TAP_SLOPU && tap.y <= b + TAP_SLOPU
                                }
                                if (hit != null) editing = hit
                            }
                        }
                    },
            ) {
                val xf = unifiedFit(worldW, worldH, size.width, size.height, PAD_PXU)
                val nc = drawContext.canvas.nativeCanvas

                val botY = xf.sy(0.0)
                val leftX = xf.sx(0.0)
                val rightX = xf.sx(wall.length)

                // ── פני-הקיר: מתאר-מסגרת אמיתי אם קיים, אחרת מלבן פשוט ──────
                if (frame.size >= 2) {
                    // מצולע-צללית: רצפה בנקודה-הראשונה → מתאר-המסגרת → רצפה בנקודה-האחרונה
                    val path = Path().apply {
                        val p0 = frame.first()
                        moveTo(xf.sx(p0.x), botY)
                        for (p in frame) lineTo(xf.sx(p.x), xf.sy(p.y))
                        lineTo(xf.sx(frame.last().x), botY)
                        close()
                    }
                    drawPath(path, Cream)
                    drawPath(path, Ink, style = Stroke(width = 3.dp.toPx()))
                    // קו-המתאר עצמו מודגש (הפוליליין הנלכד)
                    for (i in 0 until frame.size - 1) {
                        val a = frame[i]; val b = frame[i + 1]
                        drawLine(
                            Teal, Offset(xf.sx(a.x), xf.sy(a.y)), Offset(xf.sx(b.x), xf.sy(b.y)),
                            strokeWidth = 4.dp.toPx(), cap = StrokeCap.Round,
                        )
                    }
                } else {
                    val topY = xf.sy(wall.height)
                    drawRect(Cream, Offset(leftX, topY), Size(rightX - leftX, botY - topY))
                    drawRect(Ink, Offset(leftX, topY), Size(rightX - leftX, botY - topY), style = Stroke(width = 3.dp.toPx()))
                }

                // ── קו-רצפה — עבה, חורג מעט מעבר לקיר ──────────────────────
                val floorPad = 18.dp.toPx()
                val floorRight = max(rightX, xf.sx(worldW))
                drawLine(
                    Ink, Offset(leftX - floorPad, botY), Offset(floorRight + floorPad, botY),
                    strokeWidth = 5.dp.toPx(), cap = StrokeCap.Round,
                )

                // ── קודקודי-מסגרת ממוספרים + נקודת-ghost חיה (מצב-מסגרת) ────
                if (mode == ElevMode.FRAME) {
                    idxPaint.textSize = 11.dp.toPx()
                    for (i in frame.indices) {
                        val s = Offset(xf.sx(frame[i].x), xf.sy(frame[i].y))
                        drawCircle(Orange, 6.dp.toPx(), s)
                        nc.drawText("${i + 1}", s.x, s.y - 12.dp.toPx(), idxPaint)
                    }
                    // תצוגה-מקדימה של הנקודה-הבאה (מיקום-אופקי נוכחי × גובה-לייזר)
                    val ghostH = laserHeightMm(pendingDistMm ?: liveMm, pendingVDeg ?: liveVDeg)
                    if (ghostH != null) {
                        val g = Offset(xf.sx(horizMm.coerceIn(0.0, worldW)), xf.sy(ghostH.coerceIn(0.0, worldH)))
                        drawLine(
                            Orange.copy(alpha = 0.6f), Offset(g.x, botY), Offset(g.x, g.y),
                            strokeWidth = 2.dp.toPx(),
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f), 0f),
                        )
                        drawCircle(Orange, 7.dp.toPx(), g, style = Stroke(width = 2.dp.toPx()))
                    }
                }

                // ── אלמנטים (מצב-אלמנטים) ──────────────────────────────────
                if (mode == ElevMode.ELEMENTS) {
                    accPaint.textSize = 11.dp.toPx()
                    for (a in accessories) {
                        val l = xf.sx(a.fromLeft)
                        val r = xf.sx(a.fromLeft + a.width)
                        var t = xf.sy(a.fromBottom + a.height)
                        val b = xf.sy(a.fromBottom)
                        var rr = r
                        if (rr - l < MIN_PXU) rr = l + MIN_PXU
                        if (b - t < MIN_PXU) t = b - MIN_PXU
                        val col = accColorU(a.type)
                        drawRect(col.copy(alpha = 0.22f), Offset(l, t), Size(rr - l, b - t))
                        drawRect(col, Offset(l, t), Size(rr - l, b - t), style = Stroke(width = 2.dp.toPx()))
                        val midX = (l + rr) / 2f
                        drawLine(
                            col.copy(alpha = 0.5f), Offset(midX, b), Offset(midX, botY),
                            strokeWidth = 1.5.dp.toPx(),
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f),
                        )
                        nc.drawText(a.name, midX, t - 6.dp.toPx(), accPaint)
                        nc.drawText("h=${a.fromBottom.mmU()} מ\"מ", midX, b + 14.dp.toPx(), accPaint)
                    }

                    // קו-סימון / סופיט (soffit / הנמכת-תקרה) — קו אופקי לרוחב בגובהו
                    markerHeight?.let { mh ->
                        val my = xf.sy(mh.coerceIn(0.0, worldH))
                        drawLine(
                            WarnAmber, Offset(leftX, my), Offset(floorRight, my),
                            strokeWidth = 3.dp.toPx(), cap = StrokeCap.Round,
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(20f, 12f), 0f),
                        )
                        markPaint.textSize = 12.dp.toPx()
                        nc.drawText("קו-סימון h=${mh.mmU()} מ\"מ", leftX + 6.dp.toPx(), my - 6.dp.toPx(), markPaint)
                    }
                }

                // ── תוויות-מידה: רוחב (למטה) + גובה (בצד-שמאל, מסובבת) ──────
                wallPaint.textSize = 13.dp.toPx()
                nc.drawText("${wall.length.mmU()} מ\"מ", (leftX + rightX) / 2f, botY + 34.dp.toPx(), wallPaint)

                hPaint.textSize = 13.dp.toPx()
                val hx = leftX - 16.dp.toPx()
                val hy = xf.sy(wall.height / 2.0)
                nc.save()
                nc.rotate(-90f, hx, hy)
                nc.drawText("${wall.height.mmU()} מ\"מ", hx, hy, hPaint)
                nc.restore()
            }
        }

        // ── לוח-תחתון: משתנה לפי-מצב ────────────────────────────────────────
        if (mode == ElevMode.FRAME) {
            FramePanel(
                liveDistMm = pendingDistMm ?: liveMm,
                liveVDeg = pendingVDeg ?: liveVDeg,
                pending = pendingDistMm != null,
                horizMm = horizMm,
                stepMm = stepMm,
                onHoriz = { horizMm = it.coerceAtLeast(0.0) },
                onStep = { stepMm = it },
                pointCount = frame.size,
                connected = connected,
                status = status,
                canCapture = (pendingDistMm ?: liveMm)?.let { it > 0.0 } == true,
                onCapture = {
                    val h = laserHeightMm(pendingDistMm ?: liveMm, pendingVDeg ?: liveVDeg)
                    if (h != null) {
                        frame = frame + FramePt(horizMm.coerceAtLeast(0.0), h)
                        horizMm += stepMm // התקדמות-אופקית אוטומטית ("סריקה")
                        pendingDistMm = null
                        pendingVDeg = null
                    }
                },
                canUndo = frame.isNotEmpty(),
                onUndo = {
                    if (frame.isNotEmpty()) {
                        frame = frame.dropLast(1)
                        horizMm = (horizMm - stepMm).coerceAtLeast(0.0)
                    }
                },
                canFinish = frame.size >= 2,
                onFinish = { onFramePoints(frame.map { it.x to it.y }) },
                onClear = { frame = emptyList(); horizMm = 0.0 },
            )
        } else {
            ElementsPanel(
                liveMm = liveMm,
                connected = connected,
                status = status,
                markerSet = markerHeight != null,
                onAdd = { adding = true },
                onMarker = { markerDialog = true },
            )
        }
    }

    // ── דיאלוג-עריכה (אביזר קיים) ─────────────────────────────────────────
    editing?.let { acc ->
        AccessoryEditor(
            title = "עריכת ${acc.name}",
            initial = acc,
            liveMm = liveMm,
            confirmLabel = "שמור",
            onConfirm = { onUpdateAccessory(it); editing = null },
            onDismiss = { editing = null },
        )
    }

    // ── דיאלוג-הוספה (אביזר חדש בגובה-נבחר) ───────────────────────────────
    if (adding) {
        val default = remember(wall.id, liveMm) {
            AccessoryEntity(
                id = 0,
                wallId = wall.id,
                type = AccType.SOCKET_SINGLE.name,
                name = AccType.SOCKET_SINGLE.he,
                depth = AccType.SOCKET_SINGLE.defaultDepth,
                fromLeft = (wall.length / 2.0),
                width = 86.0,
                fromBottom = liveMm ?: 300.0, // גובה-מהרצפה: קריאת-לייזר אחרונה כברירת-מחדל
                height = 86.0,
            )
        }
        AccessoryEditor(
            title = "הוסף אביזר בגובה",
            initial = default,
            liveMm = liveMm,
            confirmLabel = "הוסף",
            onConfirm = { onAddAccessory(it); adding = false },
            onDismiss = { adding = false },
        )
    }

    // ── דיאלוג-קו-סימון (סופיט) ────────────────────────────────────────────
    if (markerDialog) {
        MarkerDialog(
            initial = markerHeight ?: liveMm ?: (wall.height * 0.85),
            liveMm = liveMm,
            hasMarker = markerHeight != null,
            onConfirm = { markerHeight = it; markerDialog = false },
            onRemove = { markerHeight = null; markerDialog = false },
            onDismiss = { markerDialog = false },
        )
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  לוח-מצב-מסגרת: readout-לייזר + סטפר-מיקום-אופקי + כפתורי לכידה/ביטול/סיום.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun FramePanel(
    liveDistMm: Double?,
    liveVDeg: Double?,
    pending: Boolean,
    horizMm: Double,
    stepMm: Double,
    onHoriz: (Double) -> Unit,
    onStep: (Double) -> Unit,
    pointCount: Int,
    connected: String?,
    status: String,
    canCapture: Boolean,
    onCapture: () -> Unit,
    canUndo: Boolean,
    onUndo: () -> Unit,
    canFinish: Boolean,
    onFinish: () -> Unit,
    onClear: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 10.dp)) {

        Text(
            "מסגרת: ${if (pointCount == 0) "אין נקודות עדיין" else "$pointCount נקודות על מתאר-החזית"}",
            fontSize = 12.sp, color = if (pointCount >= 2) OkGreen else Muted, fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(6.dp))

        // readout-ענק: מרחק חי/ממתין + גובה-נגזר
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        liveDistMm?.roundToInt()?.toString() ?: "– – –",
                        fontSize = 40.sp, fontWeight = FontWeight.Bold,
                        color = if (pending) Orange else Ink, lineHeight = 42.sp,
                    )
                    Spacer(Modifier.width(6.dp))
                    Text("מ\"מ", fontSize = 16.sp, color = Muted, modifier = Modifier.padding(bottom = 5.dp))
                }
                val derived = laserHeightMm(liveDistMm, liveVDeg)
                Text(
                    buildString {
                        append(if (pending) "מרחק-הירי הבא" else "מדידה חיה — לחץ על המכשיר")
                        if (liveVDeg != null) append(" · זווית ${liveVDeg.roundToInt()}°")
                        if (derived != null) append(" · גובה≈${derived.roundToInt()} מ\"מ")
                    },
                    fontSize = 12.sp, color = Teal,
                )
            }
            ConnPill(connected, status)
        }
        Spacer(Modifier.height(8.dp))

        // סטפר-מיקום-אופקי (מ"מ מהשמאל) — מתקדם אוטומטית בכל לכידה
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("אופקי:", fontSize = 13.sp, color = Ink, fontWeight = FontWeight.SemiBold)
            StepBtn("−", { onHoriz(horizMm - stepMm) })
            Box(
                Modifier.widthIn(min = 96.dp).background(Cream, RoundedCornerShape(10.dp))
                    .border(1.dp, Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) { Text("${horizMm.roundToInt()} מ\"מ", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Ink) }
            StepBtn("+", { onHoriz(horizMm + stepMm) })
        }
        Spacer(Modifier.height(6.dp))
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("צעד:", fontSize = 13.sp, color = Ink, fontWeight = FontWeight.SemiBold)
            for (s in listOf(50.0, 100.0, 200.0, 300.0, 500.0)) {
                StepChipU("${s.roundToInt()}", stepMm == s) { onStep(s) }
            }
        }
        Spacer(Modifier.height(10.dp))

        // כפתורי-פעולה — שורה 1: קלוט-נקודה + בטל-נקודה
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FieldButton("➕ קלוט נקודה", Orange, canCapture, Modifier.weight(2f), onCapture)
            FieldButton("↩︎ בטל נקודה", BlockRed, canUndo, Modifier.weight(1f), onUndo)
        }
        Spacer(Modifier.height(8.dp))
        // שורה 2: סיום + נקה
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FieldButton("✓ סיום מסגרת", OkGreen, canFinish, Modifier.weight(2f), onFinish)
            FieldButton("נקה", Muted, canUndo, Modifier.weight(1f), onClear)
        }
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  לוח-מצב-אלמנטים: לייזר-חי + הוספה-בגובה + קו-סימון.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun ElementsPanel(
    liveMm: Double?,
    connected: String?,
    status: String,
    markerSet: Boolean,
    onAdd: () -> Unit,
    onMarker: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        liveMm?.roundToInt()?.toString() ?: "– – –",
                        fontSize = 40.sp, fontWeight = FontWeight.Bold, color = Ink, lineHeight = 42.sp,
                    )
                    Spacer(Modifier.width(6.dp))
                    Text("מ\"מ", fontSize = 16.sp, color = Muted, modifier = Modifier.padding(bottom = 5.dp))
                }
                Text("גובה חי מהלייזר — לחץ על המכשיר בשטח", fontSize = 12.sp, color = Teal)
            }
            ConnPill(connected, status)
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FieldButton("➕ הוסף בגובה", Orange, true, Modifier.weight(2f), onAdd)
            FieldButton(if (markerSet) "קו-סימון ✓" else "קו-סימון", WarnAmber, true, Modifier.weight(1f), onMarker)
        }
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  AccessoryEditor — עורך-מימדים משותף (הוספה/עריכה) עם לכידת-גובה-בלייזר.
 *  שדות: סוג · שם · גובה-מהרצפה (fromBottom) · מרחק-משמאל · רוחב · גובה · עומק.
 *  "קלוט גובה מהלייזר" ממלא גובה-מהרצפה מהקריאה-האחרונה — ONE-SHOT בלחיצה.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun AccessoryEditor(
    title: String,
    initial: AccessoryEntity,
    liveMm: Double?,
    confirmLabel: String,
    onConfirm: (AccessoryEntity) -> Unit,
    onDismiss: () -> Unit,
) {
    var typeName by remember { mutableStateOf(initial.type) }
    var nameTxt by remember { mutableStateOf(initial.name) }
    var fromBottomTxt by remember { mutableStateOf(initial.fromBottom.mmU()) }
    var fromLeftTxt by remember { mutableStateOf(initial.fromLeft.mmU()) }
    var widthTxt by remember { mutableStateOf(initial.width.mmU()) }
    var heightTxt by remember { mutableStateOf(initial.height.mmU()) }
    var depthTxt by remember { mutableStateOf(initial.depth.mmU()) }

    fun num(s: String, fallback: Double) = s.trim().toDoubleOrNull() ?: fallback

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                onConfirm(
                    initial.copy(
                        type = typeName,
                        name = nameTxt.ifBlank { AccType.of(typeName).he },
                        fromBottom = num(fromBottomTxt, initial.fromBottom),
                        fromLeft = num(fromLeftTxt, initial.fromLeft),
                        width = num(widthTxt, initial.width),
                        height = num(heightTxt, initial.height),
                        depth = num(depthTxt, initial.depth),
                    ),
                )
            }) { Text(confirmLabel, color = Orange, fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) } },
        title = { Text(title, fontWeight = FontWeight.Bold, color = Ink) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                // לייזר-חי + לכידת-גובה לשדה-הגובה (ONE-SHOT)
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(Cream, RoundedCornerShape(10.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("לייזר חי", fontSize = 11.sp, color = Teal)
                        Text(
                            (liveMm?.roundToInt()?.toString() ?: "– – –") + " מ\"מ",
                            fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink,
                        )
                    }
                    FieldButton(
                        "קלוט גובה מהלייזר", Teal, liveMm != null, Modifier.width(150.dp),
                    ) { liveMm?.let { fromBottomTxt = it.mmU() } }
                }
                Spacer(Modifier.height(10.dp))

                // בורר-סוג (ממלא שם + עומק-ברירת-מחדל)
                Text("סוג", fontSize = 12.sp, color = Muted)
                Spacer(Modifier.height(4.dp))
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (t in AccType.entries) {
                        TypeChipU(t.he, typeName == t.name) {
                            typeName = t.name
                            if (nameTxt.isBlank() || AccType.entries.any { it.he == nameTxt }) nameTxt = t.he
                            if (depthTxt.trim().toDoubleOrNull() == null || depthTxt == "0") depthTxt = t.defaultDepth.mmU()
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))

                NumRow("שם", nameTxt, KeyboardType.Text) { nameTxt = it }
                Spacer(Modifier.height(8.dp))
                NumRow("גובה מהרצפה (מ\"מ)", fromBottomTxt, KeyboardType.Number) { fromBottomTxt = it }
                Spacer(Modifier.height(8.dp))
                NumRow("מרחק משמאל (מ\"מ)", fromLeftTxt, KeyboardType.Number) { fromLeftTxt = it }
                Spacer(Modifier.height(8.dp))
                NumRow("רוחב (מ\"מ)", widthTxt, KeyboardType.Number) { widthTxt = it }
                Spacer(Modifier.height(8.dp))
                NumRow("גובה (מ\"מ)", heightTxt, KeyboardType.Number) { heightTxt = it }
                Spacer(Modifier.height(8.dp))
                NumRow("עומק-בליטה (מ\"מ)", depthTxt, KeyboardType.Number) { depthTxt = it }
            }
        },
        containerColor = Color.White,
    )
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  MarkerDialog — קו-סימון / סופיט (soffit / הנמכת-תקרה): גובהו מהרצפה.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun MarkerDialog(
    initial: Double,
    liveMm: Double?,
    hasMarker: Boolean,
    onConfirm: (Double) -> Unit,
    onRemove: () -> Unit,
    onDismiss: () -> Unit,
) {
    var hTxt by remember { mutableStateOf(initial.mmU()) }
    fun num(s: String, fallback: Double) = s.trim().toDoubleOrNull() ?: fallback

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = { onConfirm(num(hTxt, initial)) }) {
                Text("שמור", color = Orange, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            if (hasMarker) TextButton(onClick = onRemove) { Text("הסר קו", color = BlockRed) }
            else TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) }
        },
        title = { Text("קו-סימון (סופיט / הנמכת-תקרה)", fontWeight = FontWeight.Bold, color = Ink) },
        text = {
            Column {
                Row(
                    Modifier.fillMaxWidth().background(Cream, RoundedCornerShape(10.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("לייזר חי", fontSize = 11.sp, color = Teal)
                        Text((liveMm?.roundToInt()?.toString() ?: "– – –") + " מ\"מ", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink)
                    }
                    FieldButton("קלוט גובה מהלייזר", Teal, liveMm != null, Modifier.width(150.dp)) {
                        liveMm?.let { hTxt = it.mmU() }
                    }
                }
                Spacer(Modifier.height(10.dp))
                NumRow("גובה-קו מהרצפה (מ\"מ)", hTxt, KeyboardType.Number) { hTxt = it }
            }
        },
        containerColor = Color.White,
    )
}

/* ─── רכיבי-UI משותפים (file-private) ────────────────────────────────────────── */

@Composable
private fun NumRow(label: String, value: String, kb: KeyboardType, onChange: (String) -> Unit) {
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
private fun FieldButton(
    label: String,
    container: Color,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val bg = if (enabled) container else Muted.copy(alpha = 0.25f)
    val fg = if (enabled) Color.White else Muted
    Box(
        modifier
            .heightIn(min = 56.dp)
            .background(bg, RoundedCornerShape(14.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 15.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = fg, fontSize = 17.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) }
}

@Composable
private fun ModeTab(label: String, on: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val bg = if (on) Orange else Color.White
    val fg = if (on) Color.White else Ink
    Box(
        modifier
            .heightIn(min = 46.dp)
            .background(bg, RoundedCornerShape(12.dp))
            .border(1.dp, if (on) Orange else Muted.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 11.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = fg, fontSize = 16.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun StepBtn(label: String, onClick: () -> Unit) {
    Box(
        Modifier
            .heightIn(min = 44.dp).widthIn(min = 52.dp)
            .background(Teal, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun StepChipU(label: String, on: Boolean, onClick: () -> Unit) {
    val bg = if (on) Orange else Color.White
    val fg = if (on) Color.White else Ink
    Box(
        Modifier
            .background(bg, RoundedCornerShape(10.dp))
            .border(1.dp, if (on) Orange else Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) { Text(label, color = fg, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun TypeChipU(label: String, on: Boolean, onClick: () -> Unit) {
    val bg = if (on) Teal else Color.White
    val fg = if (on) Color.White else Ink
    Box(
        Modifier
            .background(bg, RoundedCornerShape(10.dp))
            .border(1.dp, if (on) Teal else Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) { Text(label, color = fg, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun ConnPill(connected: String?, status: String) {
    val on = connected != null
    val fg = if (on) OkGreen else WarnAmber
    Box(
        Modifier
            .widthIn(max = 150.dp)
            .background(fg.copy(alpha = 0.14f), RoundedCornerShape(12.dp))
            .border(1.dp, fg.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (on) "● מחובר" else "○ מנותק", color = fg, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text(connected ?: status, color = fg, fontSize = 10.sp, textAlign = TextAlign.Center, maxLines = 2)
        }
    }
}

// קבועי-ציור (פיקסלים לוגיים)
private const val PAD_PXU = 90f
private const val MIN_PXU = 22f
private const val TAP_SLOPU = 24f
