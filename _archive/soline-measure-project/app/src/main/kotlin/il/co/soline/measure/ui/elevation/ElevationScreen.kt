package il.co.soline.measure.ui.elevation

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
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
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.WarnAmber
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/* ─────────────────────────────────────────────────────────────────────────────
 *  ElevationScreen — מצב-חזית (front-view / מבט-חזית) לקיר בודד.
 *  זהו הלב של מדידת-מטבחים (CVSM §10, MICHAEL_WISHLIST §1/§3/§5): רואים את
 *  *פני-הקיר* — גובהי שקעים, חלונות, צנרת והנמכות-תקרה — ומודדים אותם.
 *
 *  הקיר משורטט כמלבן-חזית (רוחב = wall.length, גובה = wall.height), אוטו-סקייל
 *  לתוך הקנבס, עם קו-רצפה ותוויות-מידה בעברית (רוחב למטה, גובה בצד). כל אביזר
 *  מצויר כמלבן במיקום (fromLeft, fromBottom) בגודל width×height, עם שם וגובה-
 *  תחתית ("h=<fromBottom> מ\"מ"). הקשה על אביזר פותחת עורך-מימדים; "➕ הוסף
 *  בגובה" מוסיף אביזר חדש בגובה-נבחר.
 *
 *  לכידת-גובה בלייזר (§1/§3): הקריאה החיה מ-ble.lastReading.distanceMm מוצגת
 *  גדולה, וכפתור "קלוט גובה מהלייזר" ממלא את שדה-הגובה (גובה-מהרצפה) — כדי
 *  שגבהים *נמדדים*, לא מוקלדים.
 *
 *  קובץ עצמאי: כל טיפוסי/עזרי-הציור מוגדרים מקומית; נשען רק על הטיפוסים
 *  היציבים (WallEntity, AccessoryEntity, LaserBle, צבעי-המותג).
 * ───────────────────────────────────────────────────────────────────────────── */

/** טרנספורם עולם→מסך למבט-חזית: מ"מ (x מהשמאל, y מהרצפה) → פיקסלים. */
private data class ElevXf(val scale: Float, val left: Float, val bottom: Float) {
    fun sx(xMm: Double) = left + (xMm * scale).toFloat()
    /** yMm = גובה-מהרצפה; רצפה=bottom, המסך יורד → חיסור. */
    fun sy(yMm: Double) = bottom - (yMm * scale).toFloat()
}

/** מחשב אוטו-פיט של מלבן-הקיר (length×height מ"מ) לתוך קנבס w×h עם שוליים pad. */
private fun elevFit(lengthMm: Double, heightMm: Double, w: Float, h: Float, pad: Float): ElevXf {
    val lw = max(lengthMm, 1.0)
    val lh = max(heightMm, 1.0)
    val sx = (w - 2 * pad) / lw
    val sy = (h - 2 * pad) / lh
    val scale = min(sx, sy).let { if (it.isFinite() && it > 0.0) it else 1.0 }.toFloat()
    val drawW = (lw * scale).toFloat()
    val drawH = (lh * scale).toFloat()
    val left = (w - drawW) / 2f
    val bottom = (h + drawH) / 2f
    return ElevXf(scale, left, bottom)
}

/** צבע-מילוי לפי סוג-אביזר (חשמל=כתום, מים/גז=טורקיז, פתחים=אפור, תקרה=ענבר). */
private fun accColor(type: String): Color = when (type) {
    "SOCKET_SINGLE", "SOCKET_MULTI", "ELECTRICAL_LINE" -> Orange
    "WATER_PIPE", "GAS_PIPE" -> Teal
    "WINDOW", "DOOR" -> Muted
    "CEILING_DROP" -> WarnAmber
    else -> Teal
}

private fun Double.mm(): String = roundToInt().toString()

/**
 * מסך-חזית לקיר בודד — צפייה ומדידת גבהים על פני-הקיר.
 *
 * @param wall              הקיר (length=רוחב מ"מ, height=גובה מ"מ).
 * @param accessories       אביזרי-הקיר (מיקום ב-fromLeft/fromBottom, מימד width×height).
 * @param onUpdateAccessory שמירת-עריכה של אביזר קיים (מימדים/גובה) — על ה-host להתמיד ב-repo.
 * @param onAddAccessory    הוספת אביזר חדש (id=0) בגובה-נבחר — על ה-host להתמיד ב-repo.
 * @param onBack            חזרה למסך-הקודם.
 */
@Composable
fun ElevationScreen(
    wall: WallEntity,
    accessories: List<AccessoryEntity>,
    onUpdateAccessory: (AccessoryEntity) -> Unit,
    onAddAccessory: (AccessoryEntity) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // אותו סינגלטון-לייזר כמו שאר-המסכים — לא מתנתק ביציאה (סינגלטון בטוח, בלי cast שביר)
    val ble = remember { SolineApp.instance.ble }
    val reading by ble.lastReading.collectAsStateWithLifecycle(null)
    val liveMm = reading?.distanceMm

    // דיאלוגים: עריכת-אביזר-קיים / הוספת-אביזר
    var editing by remember { mutableStateOf<AccessoryEntity?>(null) }
    var adding by remember { mutableStateOf(false) }

    var boxSize by remember { mutableStateOf(IntSize.Zero) }

    Column(modifier.fillMaxSize().background(Cream)) {

        // ── סרגל-עליון ─────────────────────────────────────────────────────
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
            Spacer(Modifier.width(4.dp))
            Column(Modifier.weight(1f)) {
                Text("soline · חזית קיר", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Orange, lineHeight = 22.sp)
                Text(
                    "רוחב ${wall.length.mm()} · גובה ${wall.height.mm()} מ\"מ · ${accessories.size} אביזרים",
                    fontSize = 12.sp, color = Teal,
                )
            }
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
            // remember חייב להיקרא ללא-תנאי (לפני כל early-return) — אחרת קריסת-slots ב-Compose
            val wallPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Teal.toArgb(); textAlign = Paint.Align.CENTER } }
            val accPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Ink.toArgb(); textAlign = Paint.Align.CENTER } }
            val hPaint = remember { Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Muted.toArgb(); textAlign = Paint.Align.CENTER } }

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
                    .pointerInput(wall.id, accessories) {
                        detectTapGestures { tap ->
                            val w = boxSize.width.toFloat()
                            val h = boxSize.height.toFloat()
                            if (w <= 0f || h <= 0f) return@detectTapGestures
                            val xf = elevFit(wall.length, wall.height, w, h, PAD_PX)
                            // hit-test מהאחרון-שצויר (העליון) לראשון; מרווח-נגיעה מינימלי
                            val hit = accessories.asReversed().firstOrNull { a ->
                                val l = xf.sx(a.fromLeft)
                                val r = xf.sx(a.fromLeft + a.width)
                                val t = xf.sy(a.fromBottom + a.height)
                                val b = xf.sy(a.fromBottom)
                                tap.x >= min(l, r) - TAP_SLOP && tap.x <= max(l, r) + TAP_SLOP &&
                                    tap.y >= t - TAP_SLOP && tap.y <= b + TAP_SLOP
                            }
                            if (hit != null) editing = hit
                        }
                    },
            ) {
                val xf = elevFit(wall.length, wall.height, size.width, size.height, PAD_PX)
                val nc = drawContext.canvas.nativeCanvas

                val topY = xf.sy(wall.height)
                val botY = xf.sy(0.0)
                val leftX = xf.sx(0.0)
                val rightX = xf.sx(wall.length)

                // מלבן-הקיר (פני-החזית)
                drawRect(
                    color = Cream,
                    topLeft = Offset(leftX, topY),
                    size = androidx.compose.ui.geometry.Size(rightX - leftX, botY - topY),
                )
                drawRect(
                    color = Ink,
                    topLeft = Offset(leftX, topY),
                    size = androidx.compose.ui.geometry.Size(rightX - leftX, botY - topY),
                    style = Stroke(width = 3.dp.toPx()),
                )

                // קו-רצפה — עבה, חורג מעט מעבר לקיר
                val floorPad = 18.dp.toPx()
                drawLine(
                    Ink, Offset(leftX - floorPad, botY), Offset(rightX + floorPad, botY),
                    strokeWidth = 5.dp.toPx(), cap = StrokeCap.Round,
                )

                // אביזרים — מלבן במיקום (fromLeft, fromBottom) בגודל width×height
                accPaint.textSize = 11.dp.toPx()
                for (a in accessories) {
                    val l = xf.sx(a.fromLeft)
                    val r = xf.sx(a.fromLeft + a.width)
                    var t = xf.sy(a.fromBottom + a.height)
                    val b = xf.sy(a.fromBottom)
                    // מינימום-נראות לאביזרים קטנים (שקע)
                    var rr = r
                    if (rr - l < MIN_PX) rr = l + MIN_PX
                    if (b - t < MIN_PX) t = b - MIN_PX
                    val col = accColor(a.type)
                    drawRect(col.copy(alpha = 0.22f), Offset(l, t), androidx.compose.ui.geometry.Size(rr - l, b - t))
                    drawRect(col, Offset(l, t), androidx.compose.ui.geometry.Size(rr - l, b - t), style = Stroke(width = 2.dp.toPx()))
                    // קו-מוביל לרצפה (מציג את הגובה ויזואלית)
                    val midX = (l + rr) / 2f
                    drawLine(
                        col.copy(alpha = 0.5f), Offset(midX, b), Offset(midX, botY),
                        strokeWidth = 1.5.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f),
                    )
                    // תוויות: שם + גובה-תחתית
                    nc.drawText(a.name, midX, t - 6.dp.toPx(), accPaint)
                    nc.drawText("h=${a.fromBottom.mm()} מ\"מ", midX, b + 14.dp.toPx(), accPaint)
                }

                // תווית-מידה: רוחב (למטה, מתחת לקו-הרצפה)
                wallPaint.textSize = 13.dp.toPx()
                nc.drawText("${wall.length.mm()} מ\"מ", (leftX + rightX) / 2f, botY + 34.dp.toPx(), wallPaint)

                // תווית-מידה: גובה (בצד-שמאל, מסובבת אנכית)
                hPaint.textSize = 13.dp.toPx()
                val hx = leftX - 16.dp.toPx()
                val hy = (topY + botY) / 2f
                nc.save()
                nc.rotate(-90f, hx, hy)
                nc.drawText("${wall.height.mm()} מ\"מ", hx, hy, hPaint)
                nc.restore()
            }
        }

        // ── לוח-תחתון: קריאת-לייזר חיה + הוספה-בגובה ──────────────────────
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
            }
            Spacer(Modifier.height(10.dp))
            BigButton("➕ הוסף בגובה", Orange, enabled = true, modifier = Modifier.fillMaxWidth()) { adding = true }
        }
    }

    // ── דיאלוג-עריכה (אביזר קיים) ─────────────────────────────────────────
    editing?.let { acc ->
        AccessoryDialog(
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
        AccessoryDialog(
            title = "הוסף אביזר בגובה",
            initial = default,
            liveMm = liveMm,
            confirmLabel = "הוסף",
            onConfirm = { onAddAccessory(it); adding = false },
            onDismiss = { adding = false },
        )
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  AccessoryDialog — עורך-מימדים משותף (הוספה/עריכה) עם לכידת-גובה בלייזר.
 *  שדות: גובה-מהרצפה (fromBottom) · מרחק-משמאל (fromLeft) · רוחב · גובה · עומק.
 *  "קלוט גובה מהלייזר" ממלא את שדה-הגובה-מהרצפה מהקריאה-האחרונה.
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun AccessoryDialog(
    title: String,
    initial: AccessoryEntity,
    liveMm: Double?,
    confirmLabel: String,
    onConfirm: (AccessoryEntity) -> Unit,
    onDismiss: () -> Unit,
) {
    var nameTxt by remember { mutableStateOf(initial.name) }
    var fromBottomTxt by remember { mutableStateOf(initial.fromBottom.mm()) }
    var fromLeftTxt by remember { mutableStateOf(initial.fromLeft.mm()) }
    var widthTxt by remember { mutableStateOf(initial.width.mm()) }
    var heightTxt by remember { mutableStateOf(initial.height.mm()) }
    var depthTxt by remember { mutableStateOf(initial.depth.mm()) }

    fun num(s: String, fallback: Double) = s.trim().toDoubleOrNull() ?: fallback

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                onConfirm(
                    initial.copy(
                        name = nameTxt.ifBlank { initial.name },
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
                // קריאת-לייזר חיה + כפתור-לכידה לשדה-הגובה
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
                    BigButton(
                        "קלוט גובה מהלייזר",
                        Teal,
                        enabled = liveMm != null,
                        modifier = Modifier.width(150.dp),
                    ) { liveMm?.let { fromBottomTxt = it.mm() } }
                }
                Spacer(Modifier.height(10.dp))

                NumField("שם", nameTxt, KeyboardType.Text) { nameTxt = it }
                Spacer(Modifier.height(8.dp))
                NumField("גובה מהרצפה (מ\"מ)", fromBottomTxt, KeyboardType.Number) { fromBottomTxt = it }
                Spacer(Modifier.height(8.dp))
                NumField("מרחק משמאל (מ\"מ)", fromLeftTxt, KeyboardType.Number) { fromLeftTxt = it }
                Spacer(Modifier.height(8.dp))
                NumField("רוחב (מ\"מ)", widthTxt, KeyboardType.Number) { widthTxt = it }
                Spacer(Modifier.height(8.dp))
                NumField("גובה (מ\"מ)", heightTxt, KeyboardType.Number) { heightTxt = it }
                Spacer(Modifier.height(8.dp))
                NumField("עומק-בליטה (מ\"מ)", depthTxt, KeyboardType.Number) { depthTxt = it }
            }
        },
        containerColor = Color.White,
    )
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
            .heightIn(min = 54.dp)
            .background(bg, RoundedCornerShape(14.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = fg, fontSize = 17.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) }
}

// קבועי-ציור (פיקסלים לוגיים; מומרים ב-DrawScope דרך size בלבד כשצריך)
private const val PAD_PX = 90f
private const val MIN_PX = 22f
private const val TAP_SLOP = 24f
