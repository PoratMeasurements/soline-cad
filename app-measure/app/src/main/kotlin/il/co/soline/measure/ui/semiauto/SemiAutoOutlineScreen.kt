package il.co.soline.measure.ui.semiauto

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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.CompositionLocalProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import android.graphics.Paint
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.geometry.WallBuilder
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.WarnAmber
import kotlin.math.atan2
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/* ─────────────────────────────────────────────────────────────────────────────
 *  SemiAutoOutlineScreen — מתאר-חצי-אוטומטי + עמדה-חדשה + מיזוג
 *  (מתאר-חצי-אוטומטי, עמדה-חדשה/Relocate, מיזוג, סגירה-אוטומטית, קו-הבא CCW/CW).
 *
 *  זרימת-שדה מהירה בשני-שלבים:
 *   1) שרטוט (SKETCH) — המודד מקיש את צורת-החדר הגסה (רצף-פינות → מתאר סגור
 *      מקורב), ובוחר כיוון CCW/CW. ההקשות קובעות את סדר-הקירות ואת הזוויות
 *      המקורבות (פניות מיושרות ל-90° כשקרוב — "לרוב 90°").
 *   2) מילוי (FILL) — קיר-אחרי-קיר (Next-Line): המודד מכוון את הלייזר ולוחץ
 *      "קלוט"; כל ירי ממלא את אורך-הקיר המדויק מ-ble.lastReading.distanceMm
 *      (ירי-אחד-לקיר, לא הצפה) ומתקדם אוטומטית לקו-הבא.
 *
 *  עמדה-חדשה (New Origin / Relocate) — כפתור לסימון עמדת-מדידה חדשה באמצע
 *  (לחדרים גדולים); הקירות שנמדדים אחריו נמדדים מהעמדה-החדשה, והמתאר נשאר
 *  רציף (WallBuilder משרשר אורכים+זוויות — עצמאי-מיקום).
 *
 *  מיזוג (Combine) — צירוף לכידה-שנייה לראשונה: "צרף לכידה" מקבע את הקירות
 *  הנוכחיים ופותח שרטוט חדש; המתאר המשולב נשרטט חי (committed + current).
 *
 *  בסיום נבנית List<WallEntity> (אורכים-אמיתיים + זוויות-מהשרטוט) ו-onDone.
 *  קובץ עצמאי לחלוטין: כל טיפוסי-העזר והגאומטריה מקומיים; נשען רק על
 *  WallBuilder / WallEntity / LaserBle / צבעי-המותג היציבים.
 * ───────────────────────────────────────────────────────────────────────────── */

/** נקודת-עולם במ"מ (מתאר). */
private data class Pt(val x: Double, val y: Double)

/** נקודת-מסך בפיקסלים. */
private data class SaoPx(val x: Float, val y: Float)

/** שלב-הזרימה: שרטוט-מתאר → מילוי-אורכים. */
private enum class Phase { SKETCH, FILL }

/** מרחק-ברירת-מחדל הנראה על-הבד כשאין עדיין צורה (מ"מ). */
private const val DEFAULT_SPAN_MM = 6000.0

/**
 * מסך המתאר-החצי-אוטומטי: שרטוט-מתאר → מילוי-לייזר → (עמדה-חדשה / מיזוג) → סיום.
 *
 * @param roomId מזהה-החדר שאליו ישויכו הקירות שייבנו.
 * @param onDone נקרא עם רשימת-הקירות שנבנתה (אורכים-אמיתיים + זוויות + גובה).
 * @param onBack חזרה למסך-הקודם בלי לשמור.
 */
@Composable
fun SemiAutoOutlineScreen(
    roomId: Long,
    onDone: (List<WallEntity>) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    // גובה-החדר האחיד (מ"מ) — נקבע ברמת-החדר (מהלך-הגבהים) ותקף לכל-הקירות. בקשת-מודד
    // 121524: לא-מציגים/מבקשים גובה כאן שוב; מקבלים אותו מוכן ומיישמים לכל קיר.
    defaultHeightMm: Double = 2700.0,
) {
    val context = LocalContext.current
    // מד-הלייזר ברמת-האפליקציה — אותו סינגלטון כמו שאר-המסכים (שורד ניווט)
    val ble = remember { (context.applicationContext as SolineApp).ble }

    val reading by ble.lastReading.collectAsStateWithLifecycle(null)
    val status by ble.status.collectAsStateWithLifecycle("")
    val connected by ble.connected.collectAsStateWithLifecycle(null)

    // סאונד-חיווי בלכידה
    val tone = remember { runCatching { ToneGenerator(AudioManager.STREAM_MUSIC, 90) }.getOrNull() }
    DisposableEffect(Unit) { onDispose { runCatching { tone?.release() } } }
    fun ack() = runCatching { tone?.startTone(ToneGenerator.TONE_PROP_ACK, 120) }.let {}

    // ── מצב-הזרימה ───────────────────────────────────────────────────────────
    var phase by remember { mutableStateOf(Phase.SKETCH) }

    // שלב-השרטוט: פינות-מוקשות + כיוון
    var corners by remember { mutableStateOf<List<Pt>>(emptyList()) }
    var directionCcw by remember { mutableStateOf(true) }

    // שלב-המילוי: הקירות שנבנו מהשרטוט (idx/זווית קבועים, אורך מתעדכן בירי)
    var walls by remember { mutableStateOf<List<WallEntity>>(emptyList()) }
    var fillIdx by remember { mutableStateOf(0) }
    var measured by remember { mutableStateOf<Set<Int>>(emptySet()) }

    // מיזוג — קירות מלכידות-קודמות שקובעו
    var committed by remember { mutableStateOf<List<WallEntity>>(emptyList()) }
    // עמדות-מדידה חדשות (New Origin) — אינדקסי-קודקוד בפריסה-המשולבת
    var stations by remember { mutableStateOf<Set<Int>>(emptySet()) }

    // גובה-חדר אחיד (מ"מ) — נכתב לכל הקירות. נקבע ברמת-החדר (מהלך-גבהים), לא כאן (121524).
    val heightMm = defaultHeightMm

    // מרחק-הירי-הממתין: פריים-לייזר חדש (ts) עם מרחק תקין הופך לירי-הבא
    var pendingMm by remember { mutableStateOf<Double?>(null) }
    var lastTs by remember { mutableStateOf(0L) }
    LaunchedEffect(reading?.ts) {
        val r = reading
        val d = r?.distanceMm
        if (r != null && r.ts != lastTs && d != null && d > 0.0) {
            lastTs = r.ts
            pendingMm = d
        }
    }

    // pan + zoom (מעל האוטו-פיט)
    var userScale by remember { mutableStateOf(1f) }
    var panX by remember { mutableStateOf(0f) }
    var panY by remember { mutableStateOf(0f) }
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }

    val n = walls.size

    // ── פעולות ────────────────────────────────────────────────────────────────

    // מעבר שרטוט → מילוי: מקבע את סדר-הקירות והזוויות (מיושרות) מהמתאר
    fun startFill() {
        val w = sketchToWalls(corners, directionCcw, heightMm)
        if (w.size < 3) return
        walls = w
        fillIdx = 0
        measured = emptySet()
        pendingMm = null
        phase = Phase.FILL
    }

    // ירי-אחד-לקיר: ממלא את אורך-הקיר-הנוכחי ומתקדם (Next-Line אוטומטי)
    fun captureWall() {
        if (fillIdx !in walls.indices) return
        val d = pendingMm ?: reading?.distanceMm ?: return
        if (d <= 0.0) return
        walls = walls.toMutableList().also { it[fillIdx] = it[fillIdx].copy(length = d) }
        measured = measured + fillIdx
        pendingMm = null
        fillIdx = (fillIdx + 1).coerceAtMost(walls.size) // == size → הכל נמדד
        ack()
    }

    // מסמן עמדת-מדידה חדשה בקודקוד-הנוכחי (המדידות הבאות ממנה)
    fun newOrigin() {
        if (phase != Phase.FILL) return
        stations = stations + (committed.size + fillIdx)
        pendingMm = null
        ack()
    }

    // מיזוג: מקבע את הקירות-הנוכחיים ופותח לכידה-חדשה שתצורף אחריהם
    fun combine() {
        if (walls.isEmpty()) return
        committed = committed + walls.map { it.copy(height = heightMm) }
        walls = emptyList()
        corners = emptyList()
        fillIdx = 0
        measured = emptySet()
        pendingMm = null
        phase = Phase.SKETCH
    }

    fun finish() {
        val all = (committed + walls).mapIndexed { i, w -> w.copy(idx = i, height = heightMm, roomId = roomId) }
        onDone(all)
    }

    // ── פריסה-משולבת חיה (committed + current) לציור ובקרת-סגירה ────────────────
    val layoutPts: List<Pt> = remember(committed, walls) {
        WallBuilder.layout(committed + walls).map { Pt(it.x, it.y) }
    }
    val wbPts = remember(layoutPts) { layoutPts.map { WallBuilder.Pt(it.x, it.y) } }
    val gapMm = remember(wbPts) { WallBuilder.closingGap(wbPts) }
    val closed = remember(wbPts) { WallBuilder.isClosed(wbPts) }

    // נקודות-הציור לפי-שלב: בשרטוט מציגים את מתאר-הפינות הסגור; במילוי את הפריסה
    val drawPts: List<Pt> = if (phase == Phase.SKETCH) {
        if (corners.size >= 2) corners + corners.first() else corners
    } else layoutPts

    val liveLen = pendingMm ?: reading?.distanceMm

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Column(modifier.fillMaxSize().background(Cream)) {

            // ── סרגל-עליון ─────────────────────────────────────────────────────
            Row(
                Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
                Spacer(Modifier.width(4.dp))
                Column(Modifier.weight(1f)) {
                    Text("soline", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Orange, lineHeight = 24.sp)
                    Text(
                        if (phase == Phase.SKETCH) "מתאר חצי-אוטומטי · שרטוט צורה"
                        else "מתאר חצי-אוטומטי · מילוי בלייזר",
                        fontSize = 12.sp, color = Teal,
                    )
                }
                if (phase == Phase.FILL && n > 0) {
                    ProgressBadge(min(fillIdx + 1, n), n, measured.size)
                } else {
                    CountBadge(corners.size)
                }
            }

            // ── הבד החי ────────────────────────────────────────────────────────
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
                val padPx = with(LocalDensity.current) { 56.dp.toPx() }

                val (cx, cy, baseScale) = fit(drawPts, w, h, padPx)
                val eff = baseScale * userScale

                fun toScreen(p: Pt) = SaoPx(
                    ((p.x - cx) * eff + w / 2f + panX).toFloat(),
                    ((p.y - cy) * eff + h / 2f + panY).toFloat(),
                )

                fun toWorld(sx: Float, sy: Float) = Pt(
                    (sx - w / 2f - panX) / eff + cx,
                    (sy - h / 2f - panY) / eff + cy,
                )

                val dimPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Teal.toArgb(); textAlign = Paint.Align.CENTER } }
                val idxPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Muted.toArgb(); textAlign = Paint.Align.CENTER } }
                val stPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Teal.toArgb(); textAlign = Paint.Align.CENTER } }

                if (phase == Phase.SKETCH && corners.isEmpty()) {
                    Text(
                        "הקש על הבד כדי לשרטט את צורת-החדר הגסה — פינה-אחר-פינה.\nבסוף בחר כיוון (CCW/CW) ולחץ \"התחל מילוי\".",
                        color = Muted, fontSize = 15.sp, textAlign = TextAlign.Center,
                        modifier = Modifier.padding(20.dp),
                    )
                }

                if (w > 0f && h > 0f) {
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
                            // הקשה-להוספת-פינה — רק בשלב-השרטוט
                            .pointerInput(phase, cx, cy, eff, panX, panY) {
                                if (phase == Phase.SKETCH) {
                                    detectTapGestures { off ->
                                        corners = corners + toWorld(off.x, off.y)
                                        ack()
                                    }
                                }
                            },
                    ) {
                        drawWorldGrid(toScreen(Pt(0.0, 0.0)), 500.0 * eff)

                        // קטעי-המתאר
                        val strokeW = 5.dp.toPx()
                        val curBase = committed.size + fillIdx // הקטע הנמדד כעת (בפריסה)
                        for (i in 0 until drawPts.size - 1) {
                            val a = toScreen(drawPts[i])
                            val b = toScreen(drawPts[i + 1])
                            val isCurrent = phase == Phase.FILL && i == curBase && fillIdx < n
                            val col = when {
                                isCurrent -> Orange
                                phase == Phase.SKETCH -> Teal
                                else -> Ink
                            }
                            drawLine(
                                col, Offset(a.x, a.y), Offset(b.x, b.y),
                                strokeWidth = if (isCurrent) strokeW * 1.4f else strokeW, cap = StrokeCap.Round,
                            )
                        }

                        // אורכי-קטע בעברית
                        dimPaint.textSize = 13.dp.toPx()
                        for (i in 0 until drawPts.size - 1) {
                            val len = dist(drawPts[i], drawPts[i + 1])
                            if (len < 1.0) continue
                            val hRad = segHeading(drawPts[i], drawPts[i + 1])
                            val mid = toScreen(Pt((drawPts[i].x + drawPts[i + 1].x) / 2.0, (drawPts[i].y + drawPts[i + 1].y) / 2.0))
                            val (nx, ny) = outwardNormal(hRad)
                            val offPx = 16.dp.toPx()
                            drawContext.canvas.nativeCanvas.drawText(
                                Prefs.formatLen(len), mid.x + nx * offPx, mid.y + ny * offPx + 4.dp.toPx(), dimPaint,
                            )
                        }

                        // קרן-לייזר (ghost) על הקיר-הנוכחי במילוי
                        if (phase == Phase.FILL && fillIdx < n && liveLen != null && liveLen > 0.0 &&
                            curBase + 1 < drawPts.size
                        ) {
                            val s0 = drawPts[curBase]
                            val s1 = drawPts[curBase + 1]
                            val hd = segHeading(s0, s1)
                            val tip = Pt(s0.x + liveLen * kotlin.math.cos(hd), s0.y + liveLen * kotlin.math.sin(hd))
                            val a = toScreen(s0); val b = toScreen(tip)
                            drawLine(
                                Orange, Offset(a.x, a.y), Offset(b.x, b.y),
                                strokeWidth = 3.dp.toPx(), cap = StrokeCap.Round,
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 10f), 0f),
                            )
                            drawCircle(Orange, 6.dp.toPx(), Offset(b.x, b.y), style = Stroke(width = 2.dp.toPx()))
                        }

                        // קודקודים ממוספרים
                        idxPaint.textSize = 11.dp.toPx()
                        val vtxCount = if (phase == Phase.SKETCH) corners.size else drawPts.size
                        for (i in 0 until vtxCount) {
                            val s = toScreen(drawPts[i])
                            drawCircle(Orange, 6.dp.toPx(), Offset(s.x, s.y))
                            drawContext.canvas.nativeCanvas.drawText("${i + 1}", s.x, s.y - 12.dp.toPx(), idxPaint)
                        }

                        // עמדות-מדידה חדשות (New Origin)
                        stPaint.textSize = 11.dp.toPx()
                        for (si in stations) {
                            if (si in drawPts.indices) {
                                val s = toScreen(drawPts[si])
                                drawCircle(Teal, 9.dp.toPx(), Offset(s.x, s.y), style = Stroke(width = 3.dp.toPx()))
                                drawContext.canvas.nativeCanvas.drawText("עמדה", s.x, s.y + 22.dp.toPx(), stPaint)
                            }
                        }
                    }

                    if (userScale != 1f || panX != 0f || panY != 0f) {
                        Box(Modifier.align(Alignment.BottomStart).padding(10.dp)) {
                            SmallPill("איפוס תצוגה") { userScale = 1f; panX = 0f; panY = 0f }
                        }
                    }

                    // תג-סגירה (רק כשיש פריסה אמיתית)
                    if (phase == Phase.FILL && n >= 3) {
                        Box(Modifier.align(Alignment.TopEnd).padding(10.dp)) {
                            ClosureBadge(closed, gapMm)
                        }
                    }
                }
            }

            // ── לוח-הבקרה התחתון ────────────────────────────────────────────────
            ControlPanel(
                phase = phase,
                cornerCount = corners.size,
                directionCcw = directionCcw,
                onDirection = { directionCcw = it },
                onUndoCorner = { if (corners.isNotEmpty()) corners = corners.dropLast(1) },
                onClearCorners = { corners = emptyList() },
                onStartFill = ::startFill,
                wallCount = n,
                fillIdx = fillIdx,
                measuredCount = measured.size,
                liveMm = reading?.distanceMm,
                pendingMm = pendingMm,
                connected = connected,
                status = status,
                onCapture = ::captureWall,
                onPrevWall = { if (fillIdx > 0) fillIdx -= 1 },
                onNextWall = { if (fillIdx < n) fillIdx += 1 },
                onSkip = { if (fillIdx < n) fillIdx += 1 },
                onNewOrigin = ::newOrigin,
                onBackToSketch = { phase = Phase.SKETCH },
                committedCount = committed.size,
                stationCount = stations.size,
                onCombine = ::combine,
                canFinish = committed.isNotEmpty() || walls.isNotEmpty(),
                onFinish = ::finish,
            )
        }
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  לוח-הבקרה — משתנה לפי-שלב.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun ControlPanel(
    phase: Phase,
    cornerCount: Int,
    directionCcw: Boolean,
    onDirection: (Boolean) -> Unit,
    onUndoCorner: () -> Unit,
    onClearCorners: () -> Unit,
    onStartFill: () -> Unit,
    wallCount: Int,
    fillIdx: Int,
    measuredCount: Int,
    liveMm: Double?,
    pendingMm: Double?,
    connected: String?,
    status: String,
    onCapture: () -> Unit,
    onPrevWall: () -> Unit,
    onNextWall: () -> Unit,
    onSkip: () -> Unit,
    onNewOrigin: () -> Unit,
    onBackToSketch: () -> Unit,
    committedCount: Int,
    stationCount: Int,
    onCombine: () -> Unit,
    canFinish: Boolean,
    onFinish: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 10.dp)) {

        // באנר-מיזוג — כמה קירות כבר קובעו
        if (committedCount > 0) {
            Text(
                "מיזוג פעיל · $committedCount קירות מלכידה קודמת קובעו" +
                    (if (stationCount > 0) " · $stationCount עמדות" else ""),
                fontSize = 12.sp, color = Teal, fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(6.dp))
        }

        if (phase == Phase.SKETCH) {
            // ── שלב-השרטוט ────────────────────────────────────────────────────
            Text(
                if (cornerCount == 0) "הקש פינות לשרטוט צורת-החדר"
                else "$cornerCount פינות · המתאר ייסגר אוטומטית לקו-הראשון",
                fontSize = 13.sp, color = if (cornerCount >= 3) OkGreen else Muted, fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(8.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("כיוון:", fontSize = 13.sp, color = Ink, fontWeight = FontWeight.SemiBold)
                ModeChip("↺ נגד-השעון (CCW)", directionCcw) { onDirection(true) }
                ModeChip("↻ עם-השעון (CW)", !directionCcw) { onDirection(false) }
            }
            Spacer(Modifier.height(10.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                BigButton("↩︎ בטל פינה", BlockRed, cornerCount > 0, Modifier.weight(1f), onUndoCorner)
                BigButton("נקה", Muted, cornerCount > 0, Modifier.weight(1f), onClearCorners)
            }
            Spacer(Modifier.height(8.dp))
            BigButton(
                "▶ התחל מילוי בלייזר",
                Orange,
                cornerCount >= 3,
                Modifier.fillMaxWidth(),
                onStartFill,
            )
        } else {
            // ── שלב-המילוי ────────────────────────────────────────────────────
            val done = fillIdx >= wallCount
            Text(
                if (done) "כל $wallCount הקירות נמדדו — אפשר לסיים"
                else "קיר ${min(fillIdx + 1, wallCount)} מתוך $wallCount · נמדדו $measuredCount",
                fontSize = 13.sp, color = if (done) OkGreen else Teal, fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(6.dp))

            // readout-ענק של המרחק החי/הממתין
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    val shown = pendingMm ?: liveMm
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            if (shown != null) Prefs.lenValue(shown) else "– – –",
                            fontSize = 40.sp, fontWeight = FontWeight.Bold,
                            color = if (pendingMm != null) Orange else Ink, lineHeight = 42.sp,
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(Prefs.unitSuffix, fontSize = 18.sp, color = Muted, modifier = Modifier.padding(bottom = 6.dp))
                    }
                    Text(
                        if (pendingMm != null) "אורך-הקיר הבא (מדידה חיה)" else "כוון לייזר לאורך הקיר ולחץ על המכשיר",
                        fontSize = 12.sp, color = Teal,
                    )
                }
                ConnBadge(connected, status)
            }
            Spacer(Modifier.height(10.dp))

            // שורה 1: קלוט-קיר (ירי-אחד) + דלג
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                BigButton(
                    "➕ קלוט קיר ${min(fillIdx + 1, wallCount)}",
                    Orange,
                    !done && (pendingMm != null || (liveMm ?: 0.0) > 0.0),
                    Modifier.weight(2f),
                    onCapture,
                )
                BigButton("⏭ דלג", Muted, !done, Modifier.weight(1f), onSkip)
            }
            Spacer(Modifier.height(8.dp))
            // שורה 2: ניווט-קירות + עמדה-חדשה
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SmallAction("◀ קיר קודם", Teal, fillIdx > 0, onPrevWall)
                SmallAction("קיר הבא ▶", Teal, fillIdx < wallCount, onNextWall)
                SmallAction("📍 עמדה חדשה", Teal, true, onNewOrigin)
                SmallAction("✚ צרף לכידה", Orange, true, onCombine)
                SmallAction("↺ חזרה לשרטוט", Muted, true, onBackToSketch)
            }
            Spacer(Modifier.height(10.dp))
            BigButton(
                "✓ סיום ובניית קירות",
                OkGreen,
                canFinish,
                Modifier.fillMaxWidth(),
                onFinish,
            )
        }

        // מצב-חיבור בתחתית
        Spacer(Modifier.height(8.dp))
        val on = connected != null
        Text(
            buildString {
                append(if (on) "● מחובר" else "○ ")
                append(connected ?: status)
                val d = liveMm
                if (d != null && d > 0.0) append(" · מדידה חיה ${Prefs.formatLen(d)}")
            },
            fontSize = 12.sp, color = if (on) OkGreen else WarnAmber, fontWeight = FontWeight.SemiBold,
        )
    }
}

/* ─── שורת-גובה-חדר ──────────────────────────────────────────────────────────── */
@Composable
private fun HeightRow(heightMm: Double, onHeight: (Double) -> Unit) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("גובה:", fontSize = 13.sp, color = Ink, fontWeight = FontWeight.SemiBold)
        Stepper("−", { onHeight(heightMm - 10) })
        Box(
            Modifier.widthIn(min = 92.dp).background(Cream, RoundedCornerShape(10.dp))
                .border(1.dp, Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                .padding(vertical = 8.dp),
            contentAlignment = Alignment.Center,
        ) { Text(Prefs.formatLen(heightMm), fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Ink) }
        Stepper("+", { onHeight(heightMm + 10) })
        for (hp in listOf(2400.0, 2600.0, 2700.0, 2800.0, 3000.0)) {
            StepChip(Prefs.lenValue(hp), heightMm == hp) { onHeight(hp) }
        }
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
private fun SmallAction(label: String, container: Color, enabled: Boolean, onClick: () -> Unit) {
    val bg = if (enabled) container else Muted.copy(alpha = 0.25f)
    val fg = if (enabled) Color.White else Muted
    Box(
        Modifier
            .heightIn(min = 46.dp)
            .background(bg, RoundedCornerShape(12.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = fg, fontSize = 14.sp, fontWeight = FontWeight.Bold) }
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
    val fg = if (count >= 3) OkGreen else Muted
    Box(
        Modifier
            .background(fg.copy(alpha = 0.14f), RoundedCornerShape(50))
            .border(1.dp, fg.copy(alpha = 0.5f), RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) { Text("$count פינות", color = fg, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun ProgressBadge(cur: Int, total: Int, measured: Int) {
    val fg = if (measured >= total) OkGreen else Orange
    Box(
        Modifier
            .background(fg.copy(alpha = 0.14f), RoundedCornerShape(50))
            .border(1.dp, fg.copy(alpha = 0.5f), RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) { Text("קיר $cur/$total", color = fg, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun ClosureBadge(closed: Boolean, gapMm: Double) {
    val fg = if (closed) OkGreen else WarnAmber
    Box(
        Modifier
            .background(fg.copy(alpha = 0.16f), RoundedCornerShape(12.dp))
            .border(1.dp, fg.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Text(
            if (closed) "● מתאר סגור" else "○ פער ${Prefs.formatLen(gapMm)}",
            color = fg, fontSize = 12.sp, fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun ConnBadge(connected: String?, status: String) {
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

/* ─── גאומטריה (עזרי-קובץ, עצמאיים) ──────────────────────────────────────────── */

/**
 * ממיר מתאר-פינות-מוקש (סגור) לרשימת-קירות: אורכים-מקורבים + זוויות-פנייה
 * (מיושרות ל-90° כשקרוב, "לרוב 90°"). N פינות → N קירות (כולל הקיר-הסוגר).
 * הכיוון [ccw]=false הופך את סדר-המעבר (Next-Line CW).
 */
private fun sketchToWalls(corners: List<Pt>, ccw: Boolean, heightMm: Double): List<WallEntity> {
    val cs = if (ccw) corners else corners.reversed()
    val n = cs.size
    if (n < 3) return emptyList()
    val head = DoubleArray(n) { i ->
        val a = cs[i]; val b = cs[(i + 1) % n]
        atan2(b.y - a.y, b.x - a.x)
    }
    return (0 until n).map { i ->
        val a = cs[i]; val b = cs[(i + 1) % n]
        val len = dist(a, b)
        val rawTurn = normDeg180(Math.toDegrees(head[(i + 1) % n] - head[i]))
        WallEntity(id = 0, roomId = 0L, idx = i, length = len, height = heightMm, angle = snapTurn(rawTurn))
    }
}

/** יישור-פנייה: מצמיד ל-±90°/0/±180 כשקרוב (טולרנס 22°), אחרת מעגל ל-5°. */
private fun snapTurn(deg: Double): Double {
    val tol = 22.0
    for (target in listOf(0.0, 90.0, -90.0, 180.0, -180.0)) {
        if (kotlin.math.abs(deg - target) <= tol) return if (target == -180.0) 180.0 else target
    }
    return (deg / 5.0).roundToInt() * 5.0
}

/** מנרמל מעלות לתחום (-180, 180]. */
private fun normDeg180(deg: Double): Double {
    var d = deg % 360.0
    if (d <= -180.0) d += 360.0
    if (d > 180.0) d -= 360.0
    return d
}

/** מרחק אאוקלידי בין שתי נקודות-עולם (מ"מ). */
private fun dist(a: Pt, b: Pt): Double = hypot(b.x - a.x, b.y - a.y)

/** כיוון-הקטע (רדיאנים) מ-[a] אל [b]. */
private fun segHeading(a: Pt, b: Pt): Double = atan2(b.y - a.y, b.x - a.x)

/** נורמל "החוצה" לקטע (להסטת תוויות). */
private fun outwardNormal(headingRad: Double): Pair<Float, Float> =
    kotlin.math.sin(headingRad).toFloat() to (-kotlin.math.cos(headingRad)).toFloat()

/**
 * מרכז ה-bbox (cx,cy במ"מ) וסקאלת-בסיס שממלאת את הבד עם שוליים [pad].
 * כשאין די-נקודות, נופל לתצוגת-ברירת-מחדל ממורכזת סביב-האפס.
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
private fun DrawScope.drawWorldGrid(origin: SaoPx, stepPx: Double) {
    if (stepPx < 6.0 || !stepPx.isFinite()) return
    val grid = Muted.copy(alpha = 0.15f)
    val step = stepPx.toFloat()
    var x = origin.x - floor(origin.x / step) * step
    while (x <= size.width) {
        drawLine(grid, Offset(x, 0f), Offset(x, size.height), strokeWidth = 1f)
        x += step
    }
    var y = origin.y - floor(origin.y / step) * step
    while (y <= size.height) {
        drawLine(grid, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
        y += step
    }
}
