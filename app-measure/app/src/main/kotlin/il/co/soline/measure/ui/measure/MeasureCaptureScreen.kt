package il.co.soline.measure.ui.measure

import android.graphics.Paint
import android.media.AudioManager
import android.media.ToneGenerator
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.device.LaserBle
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
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/* ─────────────────────────────────────────────────────────────────────────────
 *  MeasureCaptureScreen — מסך-לכידת-המדידה החי (MICHAEL_WISHLIST §1 + §2).
 *
 *  זרימת-מדידה חכמה, mode-less: המודד לוחץ על מד-הלייזר בשטח → הקריאה החיה
 *  ("מדידה חיה") מופיעה גדולה בתחתית → לחיצה אחת על "➕ הוסף קיר" לוקחת את
 *  אורך-המדידה האחרון + הזווית-הנבחרת (90°/45°/מותאם) ומוסיפה קיר — והחדר
 *  נשרטט חי על הקנבס דמוי-CAD מעל. "לא לתקתק יותר מפעם אחת לפעולה."
 *
 *  ביטול-נקודה חי ("↩︎ בטל נקודה") מסיר את הקיר האחרון באמצע סריקת-חדר.
 *  בקרה-עצמית: שורת-חיווי עם מספר-הקירות ומצב-הסגירה (checklist מהיר, §1).
 *
 *  מקור-האורך נקרא פנימית מ-ble.lastReading (סינגלטון-האפליקציה) — פריים חדש
 *  (ts חדש) הופך לאורך-הקיר-הממתין. הגאומטריה כולה מ-WallBuilder.layout
 *  (מקור-אמת יחיד); הקנבס נשלט ע"י פרמטר walls ולכן גדל מיד עם כל הוספה.
 *  קובץ עצמאי: כל טיפוסי-העזר מוגדרים מקומית.
 * ───────────────────────────────────────────────────────────────────────────── */

/** נקודת-מסך (פיקסלים). */
private data class Px(val x: Float, val y: Float)

private enum class AngleMode { DEG90, DEG45, CUSTOM }

/**
 * מסך-לכידת-מדידה חי, mode-less, one-tap-per-action.
 *
 * @param walls     קירות החדר (מסודרים לפי idx); מזין את הקנבס — שינוי מצייר מחדש מיד.
 * @param onAddWall הוספת-קיר חי: (אורך במ"מ = מדידת-הלייזר האחרונה, זווית-פנייה במעלות).
 *                  על ה-host להתמיד ב-repo כדי שהרשימה תזרום בחזרה ותצייר את החדר הגדל.
 * @param onUndo    ביטול-נקודה חי: הסרת הקיר האחרון (§1 "חזרה-אחורה / ביטול-נקודה").
 * @param onBack    חזרה למסך-הקודם.
 */
@Composable
fun MeasureCaptureScreen(
    walls: List<WallEntity>,
    onAddWall: (lengthMm: Double, angleDeg: Double) -> Unit,
    onUndo: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // מד-הלייזר ברמת-האפליקציה — לא מתנתק ביציאה מהמסך (אותו סינגלטון כמו DevicesScreen)
    val ble = remember { SolineApp.instance.ble }

    val reading by ble.lastReading.collectAsStateWithLifecycle(null)
    val status by ble.status.collectAsStateWithLifecycle("")
    val connected by ble.connected.collectAsStateWithLifecycle(null)

    // סאונד-חיווי בלכידת-קיר בטאבלט (§7) — נפרד מהביפ של המכשיר עצמו
    val tone = remember { runCatching { ToneGenerator(AudioManager.STREAM_MUSIC, 90) }.getOrNull() }
    DisposableEffect(Unit) { onDispose { runCatching { tone?.release() } } }

    // pan + zoom (transform ידני מעל האוטו-פיט) — שורד-סיבוב (rememberSaveable · P3-1)
    var userScale by rememberSaveable { mutableStateOf(1f) }
    var panX by rememberSaveable { mutableStateOf(0f) }
    var panY by rememberSaveable { mutableStateOf(0f) }

    // זווית-הפנייה הנבחרת לקיר-הבא — ברירת-המחדל לפי הגדרת נעילת-זווית 90° (Prefs.angleLockDefault)
    var angleMode by rememberSaveable { mutableStateOf(if (Prefs.angleLockDefault) AngleMode.DEG90 else AngleMode.CUSTOM) }
    var customTxt by rememberSaveable { mutableStateOf("90") }
    val chosenAngle: Double? = when (angleMode) {
        AngleMode.DEG90 -> 90.0
        AngleMode.DEG45 -> 45.0
        AngleMode.CUSTOM -> customTxt.toDoubleOrNull()
    }

    // אורך-הקיר-הממתין: פריים-לייזר חדש (ts חדש) עם מרחק תקין הופך לאורך-הבא.
    // שורד-סיבוב (rememberSaveable · P3-1) — לא מאבד את המדידה-שנורתה.
    var pendingLenMm by rememberSaveable { mutableStateOf<Double?>(null) }
    var lastTs by rememberSaveable { mutableStateOf(0L) }
    LaunchedEffect(reading?.ts) {
        val r = reading
        val d = r?.distanceMm
        if (r != null && r.ts != lastTs && d != null && d > 0.0) {
            lastTs = r.ts
            pendingLenMm = d
        }
    }

    val ordered = remember(walls) { walls.sortedBy { it.idx } }
    val pts = remember(ordered) { WallBuilder.layout(ordered) }
    val closed = remember(pts) { WallBuilder.isClosed(pts) }
    val gap = remember(pts) { WallBuilder.closingGap(pts) }
    // כיוון הקיר-הבא: סכום זוויות-הפנייה של הקירות הקיימים (התחלה +X)
    val nextHeadingRad = remember(ordered) { ordered.sumOf { Math.toRadians(it.angle) } }

    // תצוגה-מקדימה (ghost) של הקיר הממתין — מראה את החדר "גדל" עוד לפני הלחיצה
    val previewEnd: WallBuilder.Pt? = pendingLenMm?.let { len ->
        val start = pts.lastOrNull() ?: WallBuilder.Pt(0.0, 0.0)
        WallBuilder.Pt(start.x + len * cos(nextHeadingRad), start.y + len * sin(nextHeadingRad))
    }
    // נקודות לחישוב-הפיט: הקירות שנקבעו, ובהיעדרם — קטע-התצוגה-המקדימה
    val fitPts: List<WallBuilder.Pt> = when {
        pts.size >= 2 -> pts
        previewEnd != null -> listOf(pts.lastOrNull() ?: WallBuilder.Pt(0.0, 0.0), previewEnd)
        else -> emptyList()
    }

    val canAdd = pendingLenMm != null && pendingLenMm!! > 0.0 && chosenAngle != null

    Column(modifier.fillMaxSize().background(Cream)) {

        // ── סרגל-עליון: חזרה + מותג + מצב-סגירה ─────────────────────────────
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
            Spacer(Modifier.width(4.dp))
            Column(Modifier.weight(1f)) {
                Text("soline", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Orange, lineHeight = 24.sp)
                Text("מדידה חיה · לחיצה אחת לקיר", fontSize = 12.sp, color = Teal)
            }
            ClosureBadge(closed, gap)
        }

        // ── הקנבס החי (מלא-מסך, pan+zoom) ────────────────────────────────
        Box(
            Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(8.dp)
                .background(Cream, RoundedCornerShape(12.dp))
                .border(1.dp, Muted.copy(alpha = 0.25f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            val dimPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Teal.toArgb(); textAlign = Paint.Align.CENTER } }
            val idxPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Muted.toArgb(); textAlign = Paint.Align.CENTER } }
            val anglePaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Orange.toArgb(); textAlign = Paint.Align.CENTER } }

            if (fitPts.size < 2) {
                Text(
                    "לחץ על מד-הלייזר בשטח — המדידה תופיע למטה,\nולחיצה אחת על \"➕ הוסף קיר\" תתחיל לשרטט את החדר.",
                    color = Muted, fontSize = 15.sp, textAlign = TextAlign.Center,
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
                    // אוטו-פיט: מרכז ה-bbox וסקאלה שממלאת עם שוליים (מחושב מחדש כל פריים → נשאר ממורכז תוך גדילה)
                    val margin = 64.dp.toPx()
                    val (cx, cy, baseScale) = fit(fitPts, size.width, size.height, margin)
                    val eff = baseScale * userScale

                    fun toScreen(p: WallBuilder.Pt) = Px(
                        ((p.x - cx) * eff + size.width / 2f + panX).toFloat(),
                        ((p.y - cy) * eff + size.height / 2f + panY).toFloat(),
                    )

                    // רשת עולם-מיושרת (נגררת/מתקרבת עם התוכן)
                    drawWorldGrid(toScreen(WallBuilder.Pt(0.0, 0.0)), 500.0 * eff)

                    // קירות שנקבעו — קווים עבים
                    val strokeW = 5.dp.toPx()
                    for (i in ordered.indices) {
                        val a = toScreen(pts[i])
                        val b = toScreen(pts[i + 1])
                        drawLine(Ink, Offset(a.x, a.y), Offset(b.x, b.y), strokeWidth = strokeW, cap = StrokeCap.Round)
                    }
                    for (v in pts) {
                        val s = toScreen(v)
                        drawCircle(Orange, 5.dp.toPx(), Offset(s.x, s.y))
                    }

                    // תצוגה-מקדימה (ghost) של הקיר הממתין — קו-מקווקו כתום
                    if (previewEnd != null) {
                        val start = toScreen(pts.lastOrNull() ?: WallBuilder.Pt(0.0, 0.0))
                        val end = toScreen(previewEnd)
                        drawLine(
                            Orange, Offset(start.x, start.y), Offset(end.x, end.y),
                            strokeWidth = 4.dp.toPx(), cap = StrokeCap.Round,
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(14f, 10f), 0f),
                        )
                        drawCircle(Orange, 6.dp.toPx(), Offset(end.x, end.y), style = Stroke(width = 2.dp.toPx()))
                        dimPaint.textSize = 14.dp.toPx()
                        drawContext.canvas.nativeCanvas.drawText(
                            Prefs.formatLen(pendingLenMm!!),
                            (start.x + end.x) / 2f, (start.y + end.y) / 2f - 8.dp.toPx(), anglePaint.apply { textSize = 14.dp.toPx() },
                        )
                    }

                    // מידות-אורך בעברית במרכז-הקיר, מוסטות החוצה
                    dimPaint.textSize = 13.dp.toPx()
                    idxPaint.textSize = 10.dp.toPx()
                    for (i in ordered.indices) {
                        val w = ordered[i]
                        val hRad = segHeading(pts[i], pts[i + 1])
                        val midX = (pts[i].x + pts[i + 1].x) / 2.0
                        val midY = (pts[i].y + pts[i + 1].y) / 2.0
                        val m = toScreen(WallBuilder.Pt(midX, midY))
                        val (nx, ny) = outwardNormal(hRad)
                        val off = 18.dp.toPx()
                        drawContext.canvas.nativeCanvas.apply {
                            drawText(Prefs.formatLen(w.length), m.x + nx * off, m.y + ny * off + 4.dp.toPx(), dimPaint)
                            drawText("קיר ${w.idx + 1}", m.x - nx * off, m.y - ny * off, idxPaint)
                        }
                    }

                    // זוויות בקודקודים-הפנימיים (כולל 45°)
                    anglePaint.textSize = 12.dp.toPx()
                    for (i in ordered.indices) {
                        if (i == ordered.lastIndex) continue
                        val v = toScreen(pts[i + 1])
                        drawContext.canvas.nativeCanvas.drawText(
                            "${trimAngle(ordered[i].angle)}°", v.x, v.y - 9.dp.toPx(), anglePaint,
                        )
                    }
                }

                if (userScale != 1f || panX != 0f || panY != 0f) {
                    Box(Modifier.align(Alignment.BottomStart).padding(10.dp)) {
                        SmallPill("איפוס תצוגה") { userScale = 1f; panX = 0f; panY = 0f }
                    }
                }
            }
        }

        // ── לוח-הלכידה החי (readout ענק + זווית + כפתורים) ───────────────
        CaptureBar(
            distanceMm = reading?.distanceMm,
            pendingLenMm = pendingLenMm,
            connected = connected,
            status = status,
            wallCount = ordered.size,
            closed = closed,
            gapMm = gap,
            angleMode = angleMode,
            onAngleMode = { angleMode = it },
            customTxt = customTxt,
            onCustomTxt = { customTxt = it },
            canAdd = canAdd,
            onAdd = {
                val len = pendingLenMm
                val ang = chosenAngle
                if (len != null && ang != null) {
                    onAddWall(len, ang)
                    runCatching { tone?.startTone(ToneGenerator.TONE_PROP_ACK, 120) }
                    pendingLenMm = null // מוכן לקיר-הבא — one-tap-per-action
                }
            },
            canUndo = ordered.isNotEmpty(),
            onUndo = onUndo,
        )
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  לוח-הלכידה: readout-ענק חי, מצב-חיבור, זווית-פנייה, ובקרה-עצמית.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun CaptureBar(
    distanceMm: Double?,
    pendingLenMm: Double?,
    connected: String?,
    status: String,
    wallCount: Int,
    closed: Boolean,
    gapMm: Double,
    angleMode: AngleMode,
    onAngleMode: (AngleMode) -> Unit,
    customTxt: String,
    onCustomTxt: (String) -> Unit,
    canAdd: Boolean,
    onAdd: () -> Unit,
    canUndo: Boolean,
    onUndo: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 10.dp)) {

        // בקרה-עצמית (§1): מספר-קירות + מצב-סגירה
        val checkTxt = buildString {
            append("בקרה: ")
            append(if (wallCount == 0) "אין קירות עדיין" else "$wallCount קירות")
            append(" · ")
            append(if (closed) "מתאר סגור ✓" else "פתוח — פער ${Prefs.formatLen(gapMm)}")
        }
        Text(checkTxt, fontSize = 12.sp, color = if (closed) OkGreen else Muted, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(6.dp))

        // readout ענק חי + מצב-חיבור
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                val shown = pendingLenMm ?: distanceMm
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        if (shown != null) Prefs.lenValue(shown) else "– – –",
                        fontSize = 46.sp, fontWeight = FontWeight.Bold,
                        color = if (pendingLenMm != null) Orange else Ink, lineHeight = 48.sp,
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(Prefs.unitSuffix, fontSize = 18.sp, color = Muted, modifier = Modifier.padding(bottom = 6.dp))
                }
                val label = if (pendingLenMm != null) "אורך הקיר הבא (מדידה חיה)" else "מדידה חיה — לחץ על המכשיר"
                Text(label, fontSize = 12.sp, color = Teal)
            }
            ConnBadge(connected, status)
        }
        Spacer(Modifier.height(8.dp))

        // זווית-הפנייה לקיר-הבא (90° / 45° / מותאם)
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("זווית:", fontSize = 13.sp, color = Ink, fontWeight = FontWeight.SemiBold)
            AngleChip("90°", angleMode == AngleMode.DEG90) { onAngleMode(AngleMode.DEG90) }
            AngleChip("45°", angleMode == AngleMode.DEG45) { onAngleMode(AngleMode.DEG45) }
            AngleChip("מותאם", angleMode == AngleMode.CUSTOM) { onAngleMode(AngleMode.CUSTOM) }
            if (angleMode == AngleMode.CUSTOM) {
                OutlinedTextField(
                    value = customTxt,
                    onValueChange = onCustomTxt,
                    label = { Text("מעלות") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.widthIn(min = 110.dp).width(130.dp),
                )
            }
        }
        Spacer(Modifier.height(10.dp))

        // כפתורים גדולים לשדה: הוסף-קיר + בטל-נקודה
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BigButton(
                label = "➕ הוסף קיר",
                container = Orange,
                enabled = canAdd,
                modifier = Modifier.weight(2f),
                onClick = onAdd,
            )
            BigButton(
                label = "↩︎ בטל נקודה",
                container = BlockRed,
                enabled = canUndo,
                modifier = Modifier.weight(1f),
                onClick = onUndo,
            )
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
            .heightIn(min = 60.dp)
            .background(bg, RoundedCornerShape(14.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 16.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = fg, fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) }
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
private fun AngleChip(label: String, on: Boolean, onClick: () -> Unit) {
    val bg = if (on) Orange else Color.White
    val fg = if (on) Color.White else Ink
    Box(
        Modifier
            .background(bg, RoundedCornerShape(10.dp))
            .border(1.dp, if (on) Orange else Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) { Text(label, color = fg, fontSize = 14.sp, fontWeight = FontWeight.Bold) }
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

/** נורמל "החוצה" לקיר (ימין-לכיוון-ההליכה) להסטת תוויות. */
private fun outwardNormal(headingRad: Double): Pair<Float, Float> =
    sin(headingRad).toFloat() to (-cos(headingRad)).toFloat()

/** מספר-זווית מסודר: שלם אם עגול, אחרת ספרה-אחת. */
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
