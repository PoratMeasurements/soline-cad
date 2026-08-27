package il.co.soline.measure.ui.shape

import android.graphics.Paint
import android.media.AudioManager
import android.media.ToneGenerator
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.geometry.WallBuilder.Pt as GeoPt
import il.co.soline.measure.geometry.WallProfileSolver
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.WarnAmber
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/* ─────────────────────────────────────────────────────────────────────────────
 *  WallShapeCapture — לכידת-צורת-קיר (CVSM §7.5 "לכידת צורה" / §5.12 קיר-קשת /
 *  §7.8 צורות-קיר-מותאמות; MICHAEL_WISHLIST §2 "לרוץ על הקירות").
 *
 *  המודד לוכד סדרת-נקודות המשרטטת את המתאר האמיתי של קיר לא-ישר (מדורג / קשתי /
 *  מקוטע). שתי שיטות-קלט, mode-less באותו מסך:
 *   (א) לייזר-פולרי — מעמדה-קבועה (0,0); כל ירי נותן מרחק (ble.lastReading) +
 *       זווית-מיסב אופקית שהמודד מזין בסטפר; הנקודה = (מרחק·cosθ, מרחק·sinθ).
 *       הזווית מתקדמת אוטומטית בצעד-קבוע ("סריקה מסתובבת").
 *   (ב) הקשה-ידנית — הקשה על הבד מפילה נקודה במקום הנגוע.
 *
 *  הפוליליין נשרטט חי על Canvas (pan+zoom), קודקודים ממוספרים, אורכי-קטע בעברית,
 *  ומונה-נקודות רץ. "✓ סיום" מחזיר את רשימת-הנקודות (מ"מ) ל-host להתמדה.
 *  קובץ עצמאי לחלוטין: כל טיפוסי-העזר והגאומטריה מוגדרים מקומית.
 * ───────────────────────────────────────────────────────────────────────────── */

/** נקודת-עולם במ"מ (מתאר-הקיר). */
private data class Pt(val x: Double, val y: Double)

/** נקודת-מסך בפיקסלים. */
private data class Px(val x: Float, val y: Float)

/** שיטת-הקלט: ירי-לייזר-פולרי מול הקשה-ידנית על הבד. */
private enum class InputMode { LASER, TAP }

/** מרחק-ברירת-מחדל הנראה על-הבד כשאין עדיין צורה (מ"מ). */
private const val DEFAULT_SPAN_MM = 6000.0

/**
 * לכידת-צורת-קיר: המודד לוכד סדרת-נקודות המתארת את צורת-הקיר האמיתית.
 *
 * @param onDone נקרא עם רשימת-הנקודות (x,y במ"מ) + דגל-הפיכת-צד-הבטן (flip) — פוליליין-התוכנית.
 * @param onBack חזרה למסך-הקודם.
 */
@Composable
fun WallShapeCapture(
    onDone: (points: List<Pair<Double, Double>>, flip: Boolean) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    initialPoints: List<Pair<Double, Double>> = emptyList(),
    initialFlip: Boolean = false,
) {
    // מד-הלייזר ברמת-האפליקציה — אותו סינגלטון כמו שאר-המסכים (לא מתנתק ביציאה)
    val ble = remember { SolineApp.instance.ble }

    val reading by ble.lastReading.collectAsStateWithLifecycle(null)
    val status by ble.status.collectAsStateWithLifecycle("")
    val connected by ble.connected.collectAsStateWithLifecycle(null)

    // סאונד-חיווי בלכידת-נקודה בטאבלט (§7)
    val tone = remember { runCatching { ToneGenerator(AudioManager.STREAM_MUSIC, 90) }.getOrNull() }
    DisposableEffect(Unit) { onDispose { runCatching { tone?.release() } } }

    // הצורה שנלכדת — שורדת-סיבוב/יציאה (rememberSaveable · B2). נזרעת מהמסגרת הקיימת
    // (A7) כדי שכניסה-חוזרת לתיקון-נקודה לא תתחיל מבד-ריק ותדרוס.
    val pointsSaver = remember {
        Saver<List<Pt>, DoubleArray>(
            save = { list -> DoubleArray(list.size * 2).also { arr -> list.forEachIndexed { i, p -> arr[i * 2] = p.x; arr[i * 2 + 1] = p.y } } },
            restore = { arr -> (arr.indices step 2).map { Pt(arr[it], arr[it + 1]) } },
        )
    }
    var points by rememberSaveable(stateSaver = pointsSaver) {
        mutableStateOf(initialPoints.map { Pt(it.first, it.second) })
    }

    // שיטת-קלט
    var mode by rememberSaveable { mutableStateOf(InputMode.LASER) }

    // ── שיטה B (בטן / belly) — שכבת-תצוגה על התוכנית ──────────────────────────
    var bellyOn by rememberSaveable { mutableStateOf(true) }
    var flip by rememberSaveable { mutableStateOf(initialFlip) }
    var exaggeration by rememberSaveable { mutableStateOf(6f) } // ×1..×20 (תצוגה בלבד)
    var selectedIdx by rememberSaveable { mutableStateOf(-1) }  // קודקוד-נבחר (מחיקה)

    // סטפר-מיסב אופקי (מעלות) + צעד-קבוע לסריקה-המסתובבת
    var bearingDeg by rememberSaveable { mutableStateOf(0.0) }
    var stepDeg by rememberSaveable { mutableStateOf(15.0) }

    // מרחק-הירי-הממתין: פריים-לייזר חדש (ts חדש) עם מרחק תקין הופך לירי-הבא
    var pendingDistMm by remember { mutableStateOf<Double?>(null) }
    var lastTs by remember { mutableStateOf(0L) }
    LaunchedEffect(reading?.ts) {
        val r = reading
        val d = r?.distanceMm
        if (r != null && r.ts != lastTs && d != null && d > 0.0) {
            lastTs = r.ts
            pendingDistMm = d
        }
    }

    // pan + zoom (מעל האוטו-פיט)
    var userScale by remember { mutableStateOf(1f) }
    var panX by remember { mutableStateOf(0f) }
    var panY by remember { mutableStateOf(0f) }

    // גודל-הבד בפיקסלים (למען אינברסיית-ההקשה והפיט)
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }

    // אורך-מתאר מצטבר (פוליליין פתוח)
    val totalLenMm = remember(points) { polylineLength(points) }

    // בטן במבט-על (שיטה B) — מיתר A→B + היסטים-ניצבים-מסומנים (WallProfileSolver).
    val belly = remember(points, flip) {
        WallProfileSolver.planBelly(points.map { GeoPt(it.x, it.y) }, flip)
    }

    // מוסיף נקודה מירי-לייזר-פולרי מעמדת-המדידה (0,0)
    fun captureLaserPoint() {
        val d = pendingDistMm ?: reading?.distanceMm ?: return
        if (d <= 0.0) return
        val th = Math.toRadians(bearingDeg)
        points = points + Pt(d * cos(th), d * sin(th))
        pendingDistMm = null
        bearingDeg += stepDeg // התקדמות-מיסב אוטומטית — "סריקה מסתובבת"
        runCatching { tone?.startTone(ToneGenerator.TONE_PROP_ACK, 120) }
    }

    fun undo() {
        if (points.isNotEmpty()) {
            points = points.dropLast(1)
            if (mode == InputMode.LASER) bearingDeg -= stepDeg
            selectedIdx = -1
        }
    }

    fun deleteSelected() {
        val i = selectedIdx
        if (i in points.indices) {
            points = points.filterIndexed { j, _ -> j != i }
            selectedIdx = -1
        }
    }

    val canCapture = mode == InputMode.LASER && (pendingDistMm != null || (reading?.distanceMm ?: 0.0) > 0.0)

    Column(modifier.fillMaxSize().background(Cream)) {

        // ── סרגל-עליון: חזרה + מותג + מונה-נקודות ─────────────────────────────
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
            Spacer(Modifier.width(4.dp))
            Column(Modifier.weight(1f)) {
                Text("soline", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Orange, lineHeight = 24.sp)
                Text("לכידת צורת-קיר · מתאר לא-ישר", fontSize = 12.sp, color = Teal)
            }
            CountBadge(points.size)
        }

        // ── הבד החי (מלא-מסך, pan+zoom, הקשה-להוספה במצב ידני) ───────────────
        Box(
            Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(8.dp)
                .background(Cream, RoundedCornerShape(12.dp))
                .border(1.dp, Muted.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                .onSizeChanged { canvasSize = it },
            contentAlignment = Alignment.Center,
        ) {
            val w = canvasSize.width.toFloat()
            val h = canvasSize.height.toFloat()
            val padPx = with(androidx.compose.ui.platform.LocalDensity.current) { 56.dp.toPx() }

            // אוטו-פיט משותף לבד ולאינברסיית-ההקשה (מקור-אמת יחיד לטרנספורם)
            val (cx, cy, baseScale) = fit(points, w, h, padPx)
            val eff = baseScale * userScale

            fun toScreen(p: Pt) = Px(
                ((p.x - cx) * eff + w / 2f + panX).toFloat(),
                ((p.y - cy) * eff + h / 2f + panY).toFloat(),
            )

            fun toWorld(sx: Float, sy: Float) = Pt(
                (sx - w / 2f - panX) / eff + cx,
                (sy - h / 2f - panY) / eff + cy,
            )

            val dimPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Teal.toArgb(); textAlign = Paint.Align.CENTER } }
            val idxPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Muted.toArgb(); textAlign = Paint.Align.CENTER } }
            val posPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Teal.toArgb(); textAlign = Paint.Align.CENTER } }

            if (points.isEmpty() && mode == InputMode.LASER) {
                Text(
                    "כוון את מד-הלייזר לאורך הקיר, קבע זווית, ולחץ \"➕ קלוט נקודה\".\nכל ירי מוסיף נקודה על מתאר-הקיר; הזווית מתקדמת לבד.",
                    color = Muted, fontSize = 15.sp, textAlign = TextAlign.Center,
                    modifier = Modifier.padding(20.dp),
                )
            } else if (points.isEmpty()) {
                Text(
                    "הקש על הבד כדי להפיל נקודות לאורך צורת-הקיר.",
                    color = Muted, fontSize = 15.sp, textAlign = TextAlign.Center,
                    modifier = Modifier.padding(20.dp),
                )
            }

            if (w > 0f && h > 0f) {
                Canvas(
                    Modifier
                        .fillMaxSize()
                        // pan+zoom תמיד
                        .pointerInput(Unit) {
                            detectTransformGestures { _, pan, zoom, _ ->
                                userScale = (userScale * zoom).coerceIn(0.2f, 12f)
                                panX += pan.x
                                panY += pan.y
                            }
                        }
                        // הקשה: מצב-ידני מוסיף נקודה; מצב-לייזר בוחר קודקוד סמוך (למחיקה).
                        .pointerInput(mode, cx, cy, eff, panX, panY, points) {
                            detectTapGestures { off ->
                                if (mode == InputMode.TAP) {
                                    points = points + toWorld(off.x, off.y)
                                    selectedIdx = -1
                                    runCatching { tone?.startTone(ToneGenerator.TONE_PROP_ACK, 120) }
                                } else {
                                    val idx = points.indexOfFirst { p ->
                                        val s = toScreen(p); hypot(s.x - off.x, s.y - off.y) <= 30f
                                    }
                                    selectedIdx = idx
                                }
                            }
                        },
                ) {
                    // רשת עולם-מיושרת
                    drawWorldGrid(toScreen(Pt(0.0, 0.0)), 500.0 * eff)

                    // עמדת-המדידה (0,0) — סמן במצב-לייזר
                    if (mode == InputMode.LASER) {
                        val o = toScreen(Pt(0.0, 0.0))
                        drawCircle(Teal, 7.dp.toPx(), Offset(o.x, o.y), style = Stroke(width = 2.dp.toPx()))
                        posPaint.textSize = 11.dp.toPx()
                        drawContext.canvas.nativeCanvas.drawText("עמדת מדידה", o.x, o.y + 20.dp.toPx(), posPaint)
                        // קרן-כיוון של המיסב הנוכחי (ghost) עד המרחק-הממתין
                        val liveD = pendingDistMm ?: reading?.distanceMm
                        if (liveD != null && liveD > 0.0) {
                            val th = Math.toRadians(bearingDeg)
                            val tip = toScreen(Pt(liveD * cos(th), liveD * sin(th)))
                            drawLine(
                                Orange, Offset(o.x, o.y), Offset(tip.x, tip.y),
                                strokeWidth = 3.dp.toPx(), cap = StrokeCap.Round,
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 10f), 0f),
                            )
                            drawCircle(Orange, 6.dp.toPx(), Offset(tip.x, tip.y), style = Stroke(width = 2.dp.toPx()))
                        }
                    }

                    // קטעי-הפוליליין
                    val strokeW = 5.dp.toPx()
                    for (i in 0 until points.size - 1) {
                        val a = toScreen(points[i])
                        val b = toScreen(points[i + 1])
                        drawLine(Ink, Offset(a.x, a.y), Offset(b.x, b.y), strokeWidth = strokeW, cap = StrokeCap.Round)
                    }

                    // ── שכבת-בטן (שיטה B): מיתר A→B + היסטים-מסומנים + הגזמת-תצוגה ──
                    val b = belly
                    if (bellyOn && b != null) {
                        val ax = b.chordA.x; val ay = b.chordA.y
                        val len = b.spanMm
                        val tx = (b.chordB.x - ax) / len; val ty = (b.chordB.y - ay) / len
                        var nx = -ty; var ny = tx
                        if (flip) { nx = -nx; ny = -ny }
                        val k = exaggeration.toDouble()
                        // מיתר-הייחוס (אפור, מקווקו)
                        val sa = toScreen(Pt(ax, ay)); val sbp = toScreen(Pt(b.chordB.x, b.chordB.y))
                        drawLine(
                            Muted, Offset(sa.x, sa.y), Offset(sbp.x, sbp.y), strokeWidth = 2.dp.toPx(),
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(14f, 10f), 0f),
                        )
                        // פוליליין-הבטן המוגזם (כתום) + תגי-היסט (± מ"מ)
                        posPaint.textSize = 12.dp.toPx()
                        var prev: Px? = null
                        for (i in points.indices) {
                            val s = b.s[i]; val off = b.offsets[i]
                            val footS = toScreen(Pt(ax + s * tx, ay + s * ty))
                            val exS = toScreen(Pt(ax + s * tx + k * off * nx, ay + s * ty + k * off * ny))
                            drawLine(Teal.copy(alpha = 0.55f), Offset(footS.x, footS.y), Offset(exS.x, exS.y), strokeWidth = 1.5.dp.toPx())
                            prev?.let { drawLine(Orange, Offset(it.x, it.y), Offset(exS.x, exS.y), strokeWidth = 3.dp.toPx(), cap = StrokeCap.Round) }
                            prev = exS
                            if (kotlin.math.abs(off) >= 1.0) {
                                drawContext.canvas.nativeCanvas.drawText(
                                    "${if (off >= 0) "+" else ""}${off.roundToInt()}", exS.x, exS.y - 6.dp.toPx(), posPaint,
                                )
                            }
                        }
                    }

                    // אורכי-קטע בעברית, מוסטים אל מחוץ-לקו
                    dimPaint.textSize = 13.dp.toPx()
                    for (i in 0 until points.size - 1) {
                        val len = dist(points[i], points[i + 1])
                        val hRad = segHeading(points[i], points[i + 1])
                        val mid = toScreen(Pt((points[i].x + points[i + 1].x) / 2.0, (points[i].y + points[i + 1].y) / 2.0))
                        val (nx, ny) = outwardNormal(hRad)
                        val offPx = 16.dp.toPx()
                        drawContext.canvas.nativeCanvas.drawText(
                            "${len.roundToInt()} מ\"מ", mid.x + nx * offPx, mid.y + ny * offPx + 4.dp.toPx(), dimPaint,
                        )
                    }

                    // קודקודים ממוספרים
                    idxPaint.textSize = 11.dp.toPx()
                    for (i in points.indices) {
                        val s = toScreen(points[i])
                        if (i == selectedIdx) drawCircle(BlockRed, 10.dp.toPx(), Offset(s.x, s.y), style = Stroke(width = 2.dp.toPx()))
                        drawCircle(Orange, 6.dp.toPx(), Offset(s.x, s.y))
                        drawContext.canvas.nativeCanvas.drawText("${i + 1}", s.x, s.y - 12.dp.toPx(), idxPaint)
                    }
                }

                if (userScale != 1f || panX != 0f || panY != 0f) {
                    Box(Modifier.align(Alignment.BottomStart).padding(10.dp)) {
                        SmallPill("איפוס תצוגה") { userScale = 1f; panX = 0f; panY = 0f }
                    }
                }
            }
        }

        // ── שכבת-בטן (שיטה B): toggle · הפוך-צד · הגזמת-תצוגה · מחיקת-נבחרת + מדדים ──
        Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("בטן:", fontSize = 13.sp, color = Ink, fontWeight = FontWeight.SemiBold)
                ModeChip(if (bellyOn) "מוצגת" else "מוסתרת", bellyOn) { bellyOn = !bellyOn }
                ModeChip(if (flip) "↔ צד הפוך" else "↔ צד רגיל", flip) { flip = !flip }
                if (selectedIdx >= 0) ModeChip("🗑 מחק נבחרת", false) { deleteSelected() }
            }
            if (belly != null) {
                Spacer(Modifier.height(4.dp))
                Text(
                    "מוטה ${belly.spanMm.roundToInt()} · מתאר ${belly.developedMm.roundToInt()} · " +
                        "בטן +${belly.maxPosMm.roundToInt()} / ${belly.maxNegMm.roundToInt()} מ\"מ",
                    fontSize = 12.sp, color = Teal, fontWeight = FontWeight.SemiBold,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("הגזמה ×${exaggeration.roundToInt()}", fontSize = 12.sp, color = Muted)
                    Slider(
                        value = exaggeration,
                        onValueChange = { exaggeration = it },
                        valueRange = 1f..20f,
                        modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                    )
                }
            } else {
                Text("לכוד ≥2 נקודות כדי לראות את הבטן מול המיתר.", fontSize = 12.sp, color = Muted)
            }
        }

        // ── לוח-הבקרה: שיטה + סטפר-מיסב + כפתורים + מצב-חיבור ─────────────────
        ControlPanel(
            mode = mode,
            onMode = { mode = it },
            bearingDeg = bearingDeg,
            stepDeg = stepDeg,
            onBearing = { bearingDeg = it },
            onStep = { stepDeg = it },
            liveDistMm = reading?.distanceMm,
            pendingDistMm = pendingDistMm,
            pointCount = points.size,
            totalLenMm = totalLenMm,
            connected = connected,
            status = status,
            canCapture = canCapture,
            onCapture = ::captureLaserPoint,
            canUndo = points.isNotEmpty(),
            onUndo = ::undo,
            canFinish = points.size >= 2,
            onFinish = { onDone(points.map { it.x to it.y }, flip) },
            onClear = { points = emptyList(); bearingDeg = 0.0; selectedIdx = -1 },
        )
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  לוח-הבקרה התחתון.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun ControlPanel(
    mode: InputMode,
    onMode: (InputMode) -> Unit,
    bearingDeg: Double,
    stepDeg: Double,
    onBearing: (Double) -> Unit,
    onStep: (Double) -> Unit,
    liveDistMm: Double?,
    pendingDistMm: Double?,
    pointCount: Int,
    totalLenMm: Double,
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

        // בקרה-עצמית: מונה-נקודות + אורך-מתאר
        Text(
            "בקרה: ${if (pointCount == 0) "אין נקודות עדיין" else "$pointCount נקודות"} · אורך-מתאר ${totalLenMm.roundToInt()} מ\"מ",
            fontSize = 12.sp, color = if (pointCount >= 2) OkGreen else Muted, fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(6.dp))

        // בורר-שיטה
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("שיטה:", fontSize = 13.sp, color = Ink, fontWeight = FontWeight.SemiBold)
            ModeChip("📡 לייזר פולרי", mode == InputMode.LASER) { onMode(InputMode.LASER) }
            ModeChip("✍︎ הקשה ידנית", mode == InputMode.TAP) { onMode(InputMode.TAP) }
        }
        Spacer(Modifier.height(8.dp))

        if (mode == InputMode.LASER) {
            // readout-ענק של המרחק החי/הממתין
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    val shown = pendingDistMm ?: liveDistMm
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            if (shown != null) shown.roundToInt().toString() else "– – –",
                            fontSize = 42.sp, fontWeight = FontWeight.Bold,
                            color = if (pendingDistMm != null) Orange else Ink, lineHeight = 44.sp,
                        )
                        Spacer(Modifier.width(6.dp))
                        Text("מ\"מ", fontSize = 18.sp, color = Muted, modifier = Modifier.padding(bottom = 6.dp))
                    }
                    Text(
                        if (pendingDistMm != null) "מרחק-הירי הבא (מדידה חיה)" else "מדידה חיה — לחץ על המכשיר",
                        fontSize = 12.sp, color = Teal,
                    )
                }
                ConnBadge(connected, status)
            }
            Spacer(Modifier.height(8.dp))

            // סטפר-מיסב אופקי + צעד-סריקה (מתקדם אוטומטית בכל ירי)
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("מיסב:", fontSize = 13.sp, color = Ink, fontWeight = FontWeight.SemiBold)
                Stepper("−", { onBearing(bearingDeg - stepDeg) })
                Box(
                    Modifier.widthIn(min = 82.dp).background(Cream, RoundedCornerShape(10.dp))
                        .border(1.dp, Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center,
                ) { Text("${trimNum(normDeg(bearingDeg))}°", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink) }
                Stepper("+", { onBearing(bearingDeg + stepDeg) })
            }
            Spacer(Modifier.height(6.dp))
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("צעד:", fontSize = 13.sp, color = Ink, fontWeight = FontWeight.SemiBold)
                for (s in listOf(5.0, 10.0, 15.0, 30.0, 45.0, 90.0)) {
                    StepChip("${trimNum(s)}°", stepDeg == s) { onStep(s) }
                }
            }
        } else {
            // מצב-ידני — הנחיה + מרחק-חי + חיבור
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "הקש על הבד להוספת נקודה למתאר.",
                    fontSize = 14.sp, color = Ink, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f),
                )
                ConnBadge(connected, status)
            }
        }
        Spacer(Modifier.height(10.dp))

        // כפתורי-פעולה — שורה 1: קלוט-נקודה + בטל-נקודה
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BigButton(
                label = "➕ קלוט נקודה",
                container = Orange,
                enabled = canCapture,
                modifier = Modifier.weight(2f),
                onClick = onCapture,
            )
            BigButton(
                label = "↩︎ בטל נקודה",
                container = BlockRed,
                enabled = canUndo,
                modifier = Modifier.weight(1f),
                onClick = onUndo,
            )
        }
        Spacer(Modifier.height(8.dp))
        // שורה 2: סיום + נקה
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BigButton(
                label = "✓ סיום",
                container = OkGreen,
                enabled = canFinish,
                modifier = Modifier.weight(2f),
                onClick = onFinish,
            )
            BigButton(
                label = "נקה",
                container = Muted,
                enabled = canUndo,
                modifier = Modifier.weight(1f),
                onClick = onClear,
            )
        }

        // מצב-חיבור + מרחק-חי בתחתית
        Spacer(Modifier.height(8.dp))
        val on = connected != null
        Text(
            buildString {
                append(if (on) "● מחובר" else "○ ")
                append(connected ?: status)
                val d = liveDistMm
                if (d != null && d > 0.0) append(" · מדידה חיה ${d.roundToInt()} מ\"מ")
            },
            fontSize = 12.sp, color = if (on) OkGreen else WarnAmber, fontWeight = FontWeight.SemiBold,
        )
    }
}

/* ─── חיוויים / צ'יפים / כפתורים ─────────────────────────────────────────────── */

@Composable
private fun BigButton(
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
            .heightIn(min = 58.dp)
            .background(bg, RoundedCornerShape(14.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 16.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = fg, fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) }
}

@Composable
private fun Stepper(label: String, onClick: () -> Unit) {
    Box(
        Modifier
            .heightIn(min = 44.dp).widthIn(min = 48.dp)
            .background(Teal, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun ModeChip(label: String, on: Boolean, onClick: () -> Unit) {
    val bg = if (on) Teal else Color.White
    val fg = if (on) Color.White else Ink
    Box(
        Modifier
            .background(bg, RoundedCornerShape(10.dp))
            .border(1.dp, if (on) Teal else Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) { Text(label, color = fg, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun StepChip(label: String, on: Boolean, onClick: () -> Unit) {
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
private fun CountBadge(count: Int) {
    val fg = if (count >= 2) OkGreen else Muted
    Box(
        Modifier
            .background(fg.copy(alpha = 0.14f), RoundedCornerShape(50))
            .border(1.dp, fg.copy(alpha = 0.5f), RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) { Text("$count נקודות", color = fg, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun ConnBadge(connected: String?, status: String) {
    val on = connected != null
    val fg = if (on) OkGreen else WarnAmber
    val bg = fg.copy(alpha = 0.14f)
    Box(
        Modifier
            .widthIn(max = 150.dp)
            .background(bg, RoundedCornerShape(12.dp))
            .border(1.dp, fg.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (on) "● מחובר" else "○ מנותק", color = fg, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text(connected ?: status, color = fg, fontSize = 10.sp, textAlign = TextAlign.Center, maxLines = 2)
        }
    }
}

@Composable
private fun SmallPill(label: String, onClick: () -> Unit) {
    Box(
        Modifier
            .background(Color.White, RoundedCornerShape(50))
            .border(1.dp, Muted.copy(alpha = 0.4f), RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .wrapContentHeight(),
    ) { Text("⟲ $label", color = Ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold) }
}

/* ─── גאומטריית-מסך (עזרי-קובץ, עצמאיים) ─────────────────────────────────────── */

/** מרחק אאוקלידי בין שתי נקודות-עולם (מ"מ). */
private fun dist(a: Pt, b: Pt): Double = hypot(b.x - a.x, b.y - a.y)

/** אורך-פוליליין פתוח (סכום-הקטעים). */
private fun polylineLength(pts: List<Pt>): Double {
    var s = 0.0
    for (i in 0 until pts.size - 1) s += dist(pts[i], pts[i + 1])
    return s
}

/** כיוון-הקטע (רדיאנים) מ-[a] אל [b]. */
private fun segHeading(a: Pt, b: Pt): Double = atan2(b.y - a.y, b.x - a.x)

/** נורמל "החוצה" לקטע (להסטת תוויות). */
private fun outwardNormal(headingRad: Double): Pair<Float, Float> =
    sin(headingRad).toFloat() to (-cos(headingRad)).toFloat()

/**
 * מרכז ה-bbox (cx,cy במ"מ) וסקאלת-בסיס שממלאת את הבד עם שוליים [pad].
 * כשאין די-נקודות לתחום, נופל לתצוגת-ברירת-מחדל ממורכזת סביב-האפס.
 */
private fun fit(pts: List<Pt>, w: Float, h: Float, pad: Float): Triple<Double, Double, Double> {
    if (w <= 0f || h <= 0f) return Triple(0.0, 0.0, 1.0)
    val defScale = (min(w, h) - 2 * pad).toDouble().coerceAtLeast(1.0) / DEFAULT_SPAN_MM
    if (pts.size < 2) {
        val c = pts.firstOrNull() ?: Pt(0.0, 0.0)
        return Triple(c.x, c.y, if (defScale.isFinite() && defScale > 0.0) defScale else 1.0)
    }
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
    val scale = min(sx, sy).let { if (it.isFinite() && it > 0.0) it else defScale }
    return Triple((minX + maxX) / 2.0, (minY + maxY) / 2.0, scale)
}

/** רשת עולם-מיושרת: קווים בפאזה של [origin] במרווח [stepPx] פיקסלים. */
private fun DrawScope.drawWorldGrid(origin: Px, stepPx: Double) {
    if (stepPx < 6.0 || !stepPx.isFinite()) return
    val grid = Muted.copy(alpha = 0.15f)
    val sw = 1f
    val step = stepPx.toFloat()
    var x = origin.x - floor(origin.x / step) * step
    while (x <= size.width) {
        drawLine(grid, Offset(x, 0f), Offset(x, size.height), strokeWidth = sw)
        x += step
    }
    var y = origin.y - floor(origin.y / step) * step
    while (y <= size.height) {
        drawLine(grid, Offset(0f, y), Offset(size.width, y), strokeWidth = sw)
        y += step
    }
}

/** מנרמל מעלות לטווח [0,360). */
private fun normDeg(deg: Double): Double = ((deg % 360.0) + 360.0) % 360.0

/** מספר מסודר: שלם אם עגול, אחרת ספרה-אחת. */
private fun trimNum(v: Double): String {
    val r = (v * 10).roundToInt() / 10.0
    return if (r % 1.0 == 0.0) r.toInt().toString() else r.toString()
}
