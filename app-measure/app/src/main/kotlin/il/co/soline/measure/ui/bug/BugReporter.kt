package il.co.soline.measure.ui.bug

import android.graphics.Bitmap
import android.os.Build
import android.widget.Toast
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.BuildConfig
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.laser.formatLaserDiag
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

/* =========================================================================
 * מדווח-הבאגים — כפתור-צף גלובלי + עורך-ההערות
 * -------------------------------------------------------------------------
 * BugReportFab יושב בשורש-האפליקציה (מעל ה-NavHost) כך שהוא מופיע מעל כל
 * מסך ללא-חיווט-פרטני. בלחיצה: מסתיר-את-עצמו לרגע, לוכד צילום-מסך, ופותח את
 * BugEditorOverlay — עורך במסך-מלא להוספת חצים-נגררים ותיבות-טקסט-נערכות +
 * שדה-"הערות", ואז שמירה+שיתוף.
 * ========================================================================= */

/** ממפה route של הניווט לתווית-מסך קריאה בעברית (לשדה screen בדיווח). */
fun screenLabel(route: String?): String {
    if (route.isNullOrBlank()) return "לא-ידוע"
    val base = route.substringBefore("/")
    return when (base) {
        "projects" -> "רשימת-פרויקטים"
        "rooms" -> "חדרי-פרויקט"
        "room" -> "מסך-חדר"
        "devices" -> "מכשירים"
        "settings" -> "הגדרות"
        "consent" -> "הסכמת-מיקום"
        "myactivity" -> "הפעילות-שלי"
        "shape" -> "צורת-קיר"
        "draw" -> "שרטוט-חי"
        "measure" -> "מדידה"
        "view3d" -> "תלת-ממד"
        "cad" -> "CAD"
        "elevation" -> "חזית-קיר"
        "wall" -> "קיר"
        "cabinets" -> "ארונות"
        "semiauto" -> "מתאר-חצי-אוטומטי"
        "template" -> "תבנית-חדר"
        "wallhead" -> "ראש-קיר"
        "symbols" -> "פלטת-סמלים"
        "p2p" -> "מדידת-נקודה-לנקודה"
        "verify" -> "אימות"
        "floor" -> "מפלס-רצפה"
        "ceiling" -> "מפלס-תקרה"
        "intake" -> "קליטת-עבודה"
        "library" -> "ספריית-אלמנטים"
        "schedule" -> "לוח-זמנים"
        "measurements" -> "מדידות"
        "closeroom" -> "סגירת-חדר"
        "closeproject" -> "סגירת-פרויקט"
        else -> route
    }
}

// ── מודלי-הערה פנימיים (מצב-עריכה, קואורדינטות במרחב-התצוגה px) ──
private sealed interface AnnUi { val id: Int }

private class ArrowUi(override val id: Int, tail: Offset, head: Offset) : AnnUi {
    var tail by mutableStateOf(tail)
    var head by mutableStateOf(head)
}

private class TextUi(override val id: Int, pos: Offset, text: String) : AnnUi {
    var pos by mutableStateOf(pos)
    var text by mutableStateOf(text)
}

/**
 * כפתור-הדיווח הצף — נגרר (כדי לא לחסום פקדים) ומופיע מעל-כל-מסך.
 *
 * @param currentRoute ה-route הנוכחי מה-back-stack (לזיהוי "המסך הנוכחי").
 * @param currentProjectId / [currentRoomId] מזהים אם ניתנים-לפתרון מה-route.
 */
@Composable
fun BugReportFab(
    currentRoute: String?,
    currentProjectId: Long? = null,
    currentRoomId: Long? = null,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var captured by remember { mutableStateOf<Bitmap?>(null) }
    var capturing by remember { mutableStateOf(false) }
    // מיקום-הכפתור הנגרר (px), יחסית לפינה התחתונה-התחלתית
    var dragOffset by remember { mutableStateOf(Offset.Zero) }

    Box(Modifier.fillMaxSize()) {
        // הכפתור עצמו — מוסתר בזמן-הלכידה (כדי לא להופיע בצילום) וכשהעורך פתוח
        if (!capturing && captured == null) {
            SmallFloatingActionButton(
                onClick = {
                    val activity = context.findActivity() ?: run {
                        Toast.makeText(context, "לא ניתן ללכוד מסך", Toast.LENGTH_SHORT).show()
                        return@SmallFloatingActionButton
                    }
                    capturing = true
                    scope.launch {
                        // ממתינים 2 פריימים כדי שהכפתור ייעלם מהפריים לפני הלכידה
                        withFrameNanos { }
                        withFrameNanos { }
                        val bmp = withContext(Dispatchers.Main) { captureWindow(activity) }
                        capturing = false
                        if (bmp != null) captured = bmp
                        else Toast.makeText(context, "לכידת-המסך נכשלה", Toast.LENGTH_SHORT).show()
                    }
                },
                containerColor = BlockRed.copy(alpha = 0.82f),
                contentColor = Color.White,
                modifier = modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 12.dp, bottom = 12.dp)
                    .offset { IntOffset(dragOffset.x.roundToInt(), dragOffset.y.roundToInt()) }
                    .pointerInput(Unit) {
                        detectDragGestures { change, delta ->
                            change.consume()
                            dragOffset += delta
                        }
                    },
            ) {
                Text("🐞", fontSize = 20.sp)
            }
        }
    }

    // עורך-ההערות — מסך-מלא מעל הכול
    captured?.let { bmp ->
        BugEditorOverlay(
            bitmap = bmp,
            screen = screenLabel(currentRoute),
            projectId = currentProjectId,
            roomId = currentRoomId,
            onClose = {
                captured = null
                bmp.recycle()
            },
        )
    }
}

/**
 * בקר-דיווח-באג: [start] מפעיל לכידת-מסך→עורך; [startNoteOnly] פותח דיווח **הערה-בלבד**
 * (בלי-צילום — לדיווח מתוך-דיאלוג, שם חלון-הדיאלוג אינו-ניתן-ללכידה · 120539/192750);
 * [busy] אמת בזמן-לכידה/עריכה (להסתיר את המשגר).
 */
class BugReporterController(val start: () -> Unit, val busy: Boolean, val startNoteOnly: () -> Unit = {})

/**
 * מפעיל-דיווח-באג גלובלי (בקשת-מודד 120539 · חוזר 212205). דיאלוגים (AlertDialog) נפתחים
 * ב**חלון-נפרד מעל** משגר-הכלים, כך שה-🐞 בלתי-נגיש כשחלון-אלמנט פתוח. הפתרון: משגר-הכלים
 * מפרסם כאן את פעולת-הלכידה שלו, וכל דיאלוג יכול לקרוא [BugTrigger.start] (אחרי שהוא סוגר
 * את עצמו — כדי שעורך-ההערות, שנמצא בקומפוזיציית-השורש, יופיע מעל במקום מאחורי-הדיאלוג).
 */
object BugTrigger {
    var start: () -> Unit = {}
    // דיווח הערה-בלבד (בלי-צילום) — לשימוש מתוך דיאלוגים (120539/192750).
    var startNoteOnly: () -> Unit = {}
}

/**
 * גרסת-הבקר של דיווח-הבאג — **בלי כפתור-משלה**. מחזיר [BugReporterController] כדי שמשגר-
 * כלים-מאוחד יפעיל את הלכידה; מרנדר את עורך-ההערות בעצמו. שקול-פונקציונלית ל-[BugReportFab].
 */
@Composable
fun rememberBugReporter(
    currentRoute: String?,
    currentProjectId: Long? = null,
    currentRoomId: Long? = null,
): BugReporterController {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var captured by remember { mutableStateOf<Bitmap?>(null) }
    var capturing by remember { mutableStateOf(false) }

    val start: () -> Unit = {
        val activity = context.findActivity()
        if (activity == null) {
            Toast.makeText(context, "לא ניתן ללכוד מסך", Toast.LENGTH_SHORT).show()
        } else {
            capturing = true
            scope.launch {
                // ממתינים 2 פריימים כדי שהמשגר ייעלם מהפריים לפני הלכידה
                withFrameNanos { }
                withFrameNanos { }
                val bmp = withContext(Dispatchers.Main) { captureWindow(activity) }
                capturing = false
                if (bmp != null) captured = bmp
                else Toast.makeText(context, "לכידת-המסך נכשלה", Toast.LENGTH_SHORT).show()
            }
        }
    }

    var noteOnly by remember { mutableStateOf(false) }

    captured?.let { bmp ->
        BugEditorOverlay(
            bitmap = bmp,
            screen = screenLabel(currentRoute),
            projectId = currentProjectId,
            roomId = currentRoomId,
            onClose = { captured = null; bmp.recycle() },
        )
    }
    if (noteOnly) NoteOnlyBugOverlay(
        screen = screenLabel(currentRoute),
        projectId = currentProjectId,
        roomId = currentRoomId,
        onClose = { noteOnly = false },
    )

    return BugReporterController(
        start = start,
        busy = capturing || captured != null || noteOnly,
        startNoteOnly = { noteOnly = true },
    )
}

/**
 * דיווח-באג **הערה-בלבד** (בלי-צילום) — לדיווח מתוך-דיאלוג, שם חלון-הדיאלוג אינו-ניתן
 * ללכידה ב-PixelCopy (120539/192750). דיאלוג פשוט: טקסט-הערה → שמירה. נשמר ומועלה
 * דרך אותו צינור כמו דיווח-רגיל, עם תמונת-מציין קטנה ("ללא צילום").
 */
@Composable
private fun NoteOnlyBugOverlay(
    screen: String,
    projectId: Long?,
    roomId: Long?,
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var notes by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    androidx.compose.material3.AlertDialog(
        onDismissRequest = { if (!saving) onClose() },
        confirmButton = {
            androidx.compose.material3.TextButton(
                enabled = notes.isNotBlank() && !saving,
                onClick = {
                    saving = true
                    scope.launch {
                        withContext(Dispatchers.IO) {
                            val placeholder = Bitmap.createBitmap(160, 90, Bitmap.Config.ARGB_8888).apply { eraseColor(android.graphics.Color.DKGRAY) }
                            persistReport(context, placeholder, IntSize(160, 90), emptyList(), notes, screen, projectId, roomId)
                            placeholder.recycle()
                        }
                        Toast.makeText(context, "הדיווח נשמר ✓", Toast.LENGTH_SHORT).show()
                        onClose()
                    }
                },
            ) { Text(if (saving) "שומר…" else "שלח", color = BlockRed, fontWeight = FontWeight.Bold) }
        },
        dismissButton = { androidx.compose.material3.TextButton(onClick = { if (!saving) onClose() }) { Text("ביטול") } },
        title = { Text("🐞 דיווח באג (הערה)", fontWeight = FontWeight.Bold) },
        text = {
            Column {
                Text("דיווח מתוך חלון — בלי צילום-מסך. תאר את הבעיה:", fontSize = 12.sp)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = notes, onValueChange = { notes = it },
                    label = { Text("מה קרה?") },
                    modifier = Modifier.fillMaxWidth(), minLines = 3,
                )
                Text("מסך: $screen", fontSize = 11.sp, color = Muted, modifier = Modifier.padding(top = 6.dp))
            }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BugEditorOverlay(
    bitmap: Bitmap,
    screen: String,
    projectId: Long?,
    roomId: Long?,
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current

    val annotations = remember { mutableStateListOf<AnnUi>() }
    var notes by remember { mutableStateOf("") }
    // צירוף-נתוני-לייזר כ**מתג** — נצרב בשמירה, בלי לגזול את שדה-ההערות (שנשאר של המודד).
    var attachLaser by remember { mutableStateOf(false) }
    var selectedId by remember { mutableStateOf<Int?>(null) }
    var nextId by remember { mutableStateOf(1) }
    var boxSize by remember { mutableStateOf(IntSize.Zero) }
    var saving by remember { mutableStateOf(false) }

    val handlePx = with(density) { 48.dp.toPx() }
    val halfHandle = handlePx / 2f

    Surface(Modifier.fillMaxSize(), color = Color.Black) {
        Column(Modifier.fillMaxSize()) {

            // ── סרגל-כלים עליון (מטרות-מגע ≥48dp) ──
            Surface(color = Ink) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    ToolBtn("✕", "סגור", Muted) { onClose() }
                    ToolBtn("➡ חץ", "הוסף חץ", Teal, enabled = boxSize.width > 0) {
                        val cx = boxSize.width / 2f
                        val cy = boxSize.height / 2f
                        annotations.add(
                            ArrowUi(nextId, Offset(cx - 120f, cy + 80f), Offset(cx + 80f, cy - 60f))
                        )
                        selectedId = nextId; nextId++
                    }
                    ToolBtn("🅣 טקסט", "הוסף טקסט", Teal, enabled = boxSize.width > 0) {
                        val cx = boxSize.width / 2f
                        val cy = boxSize.height / 2f
                        annotations.add(TextUi(nextId, Offset(cx - 80f, cy - 20f), "טקסט"))
                        selectedId = nextId; nextId++
                    }
                    ToolBtn("↶ בטל", "הסר אחרון", Muted, enabled = annotations.isNotEmpty()) {
                        val last = annotations.lastOrNull()
                        if (last != null) { annotations.remove(last); if (selectedId == last.id) selectedId = null }
                    }
                    ToolBtn("🗑 מחק", "מחק נבחר", BlockRed, enabled = selectedId != null) {
                        annotations.removeAll { it.id == selectedId }; selectedId = null
                    }
                    Spacer(Modifier.weight(1f))
                    Button(
                        onClick = {
                            if (saving) return@Button
                            saving = true
                            val sizeNow = boxSize
                            // נתוני-הלייזר מצורפים רק אם המתג פעיל — ההערות של המודד נשמרות כמות-שהן.
                            val finalNotes = if (attachLaser) {
                                val d = formatLaserDiag(SolineApp.instance.ble.diag.value)
                                if (notes.isBlank()) d else "$notes\n\n$d"
                            } else notes
                            scope.launch {
                                try {
                                    val saved = withContext(Dispatchers.IO) {
                                        persistReport(
                                            context, bitmap, sizeNow, annotations.toList(),
                                            finalNotes, screen, projectId, roomId,
                                        )
                                    }
                                    // תיקייה מוגדרת → ההעלאה כבר-קרתה אוטומטית; אחרת נופלים לשיתוף-ידני.
                                    if (il.co.soline.measure.data.Prefs.bugUploadTreeUri.isBlank()) {
                                        shareBugReport(context, saved)
                                        Toast.makeText(context, "הדיווח נשמר — בחר לאן לשלוח", Toast.LENGTH_LONG).show()
                                    } else {
                                        Toast.makeText(context, "הדיווח הועלה אוטומטית ל-Drive ✓ — הגיע למיכאל", Toast.LENGTH_LONG).show()
                                    }
                                    onClose()
                                } catch (e: Exception) {
                                    saving = false
                                    Toast.makeText(context, "השמירה נכשלה: ${e.message}", Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                        enabled = !saving,
                        colors = ButtonDefaults.buttonColors(containerColor = Orange, contentColor = Color.White),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
                    ) { Text(if (saving) "שומר…" else "שמור ושתף", fontWeight = FontWeight.SemiBold) }
                }
            }

            // ── אזור-הציור: צילום-המסך + שכבת-הערות ──
            Box(
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .onSizeChanged { boxSize = it },
            ) {
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = "צילום-מסך",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.FillBounds,
                )

                // שכבת-החצים (קווים + ראשי-חץ) — מציירת את כל החצים
                Canvas(Modifier.fillMaxSize()) {
                    annotations.filterIsInstance<ArrowUi>().forEach { arw ->
                        val sel = arw.id == selectedId
                        val w = if (sel) 10f else 6f
                        drawLine(
                            color = BlockRed, start = arw.tail, end = arw.head,
                            strokeWidth = w, cap = StrokeCap.Round,
                        )
                        val b = arrowheadBarbs(arw.tail.x, arw.tail.y, arw.head.x, arw.head.y, 46f)
                        drawLine(BlockRed, arw.head, Offset(b[0], b[1]), strokeWidth = w, cap = StrokeCap.Round)
                        drawLine(BlockRed, arw.head, Offset(b[2], b[3]), strokeWidth = w, cap = StrokeCap.Round)
                    }
                }

                // ידיות-גרירה לחצים + תיבות-טקסט
                annotations.forEach { ann ->
                    when (ann) {
                        is ArrowUi -> {
                            DragHandle(ann.tail, halfHandle, "◎") { d ->
                                selectedId = ann.id; ann.tail += d
                            }
                            DragHandle(ann.head, halfHandle, "➤") { d ->
                                selectedId = ann.id; ann.head += d
                            }
                            // ידית-הזזת-כל-החץ (אמצע)
                            val mid = Offset((ann.tail.x + ann.head.x) / 2f, (ann.tail.y + ann.head.y) / 2f)
                            DragHandle(mid, halfHandle, "✥") { d ->
                                selectedId = ann.id; ann.tail += d; ann.head += d
                            }
                        }
                        is TextUi -> {
                            TextAnnotation(
                                ann = ann,
                                selected = ann.id == selectedId,
                                halfHandle = halfHandle,
                                onSelect = { selectedId = ann.id },
                            )
                        }
                    }
                }
            }

            // ── צירוף נתוני-לייזר (תיעוד תקלת-לייזר בהקשר הדיווח) ──
            Surface(color = Ink) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    val connected by SolineApp.instance.ble.connected.collectAsState()
                    TextButton(onClick = { attachLaser = !attachLaser }) {
                        Text(
                            if (attachLaser) "✓ נתוני-לייזר יצורפו" else "📡 צרף נתוני-לייזר",
                            color = if (attachLaser) OkGreen else Teal, fontWeight = FontWeight.Bold,
                        )
                    }
                    Spacer(Modifier.weight(1f))
                    Text(
                        if (connected != null) "מחובר: $connected" else "לייזר לא מחובר",
                        fontSize = 11.sp, color = if (connected != null) OkGreen else Muted,
                    )
                }
            }

            // ── שדה-"הערות" חופשי לתיאור-הכולל ──
            Surface(color = Ink) {
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("הערות (תיאור הבאג) — כולל נתוני-לייזר אם צורפו", color = Muted) },
                    modifier = Modifier.fillMaxWidth().padding(10.dp).heightIn(min = 60.dp),
                    minLines = 2,
                    maxLines = 4,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Orange, unfocusedBorderColor = Muted,
                        focusedTextColor = Color.White, unfocusedTextColor = Color.White,
                        cursorColor = Orange,
                    ),
                )
            }
        }
    }
}

/** כפתור-סרגל קומפקטי (מטרת-מגע גדולה). */
@Composable
private fun ToolBtn(
    label: String,
    desc: String,
    color: Color,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        color = if (enabled) color.copy(alpha = 0.18f) else Color.DarkGray.copy(alpha = 0.3f),
        contentColor = if (enabled) Color.White else Muted,
        shape = RoundedCornerShape(10.dp),
    ) {
        Box(Modifier.heightIn(min = 48.dp).padding(horizontal = 10.dp), contentAlignment = Alignment.Center) {
            Text(label, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

/** ידית-גרירה עגולה (48dp) הממורכזת על נקודה נתונה (px). */
@Composable
private fun DragHandle(
    point: Offset,
    halfHandle: Float,
    glyph: String,
    onDrag: (Offset) -> Unit,
) {
    Box(
        Modifier
            .offset { IntOffset((point.x - halfHandle).roundToInt(), (point.y - halfHandle).roundToInt()) }
            .size(48.dp)
            .background(BlockRed.copy(alpha = 0.32f), CircleShape)
            .pointerInput(Unit) {
                detectDragGestures { change, delta ->
                    change.consume()
                    onDrag(delta)
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Text(glyph, color = Color.White, fontSize = 16.sp)
    }
}

/** תיבת-טקסט נערכת ונגררת (ידית-גרירה נפרדת מהעריכה-האינליין). */
@Composable
private fun TextAnnotation(
    ann: TextUi,
    selected: Boolean,
    halfHandle: Float,
    onSelect: () -> Unit,
) {
    Row(
        Modifier.offset { IntOffset(ann.pos.x.roundToInt(), ann.pos.y.roundToInt()) },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // ידית-הזזה
        Box(
            Modifier
                .size(48.dp)
                .background(BlockRed.copy(alpha = 0.32f), CircleShape)
                .pointerInput(Unit) {
                    detectDragGestures { change, delta ->
                        change.consume()
                        onSelect(); ann.pos += delta
                    }
                },
            contentAlignment = Alignment.Center,
        ) { Text("✥", color = Color.White, fontSize = 16.sp) }

        // שדה-הטקסט האינליין
        BasicTextFieldBox(ann = ann, selected = selected, onSelect = onSelect)
    }
}

@Composable
private fun BasicTextFieldBox(ann: TextUi, selected: Boolean, onSelect: () -> Unit) {
    OutlinedTextField(
        value = ann.text,
        onValueChange = { ann.text = it; onSelect() },
        singleLine = false,
        textStyle = androidx.compose.ui.text.TextStyle(
            color = BlockRed, fontWeight = FontWeight.Bold, fontSize = 16.sp,
        ),
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
        modifier = Modifier.widthIn(min = 120.dp, max = 240.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = Color.White.copy(alpha = 0.9f),
            unfocusedContainerColor = Color.White.copy(alpha = 0.85f),
            focusedBorderColor = if (selected) BlockRed else Orange,
            unfocusedBorderColor = BlockRed.copy(alpha = 0.6f),
            focusedTextColor = BlockRed, unfocusedTextColor = BlockRed,
            cursorColor = BlockRed,
        ),
    )
}

/**
 * ממיר קואורדינטות-תצוגה → פיקסלי-ביטמאפ, צורב-PNG ושומר את חבילת-הדיווח.
 * רץ ב-IO. מחזיר את הרשומה השמורה (לשיתוף מיידי).
 */
private fun persistReport(
    context: android.content.Context,
    bitmap: Bitmap,
    boxSize: IntSize,
    annUi: List<AnnUi>,
    notes: String,
    screen: String,
    projectId: Long?,
    roomId: Long?,
): SavedBugReport {
    // יחס-קנה-מידה בין מרחב-התצוגה (FillBounds) לפיקסלי-הביטמאפ
    val sx = if (boxSize.width > 0) bitmap.width.toFloat() / boxSize.width else 1f
    val sy = if (boxSize.height > 0) bitmap.height.toFloat() / boxSize.height else 1f

    val annotations = annUi.map { a ->
        when (a) {
            is ArrowUi -> BugAnnotation(
                type = BugAnnotation.ARROW,
                tailX = a.tail.x * sx, tailY = a.tail.y * sy,
                headX = a.head.x * sx, headY = a.head.y * sy,
            )
            is TextUi -> BugAnnotation(
                type = BugAnnotation.TEXT,
                // מקזזים את רוחב-ידית-הגרירה (48dp) כך שהטקסט הצרוב מיושר לתצוגה
                x = (a.pos.x + 52f) * sx, y = a.pos.y * sy,
                text = a.text,
            )
            else -> BugAnnotation(BugAnnotation.TEXT)
        }
    }

    val now = Date()
    val base = bugBaseName(now)
    val createdAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(now)
    val bundle = BugReportBundle(
        id = base,
        createdAt = createdAt,
        screen = screen,
        notes = notes,
        annotations = annotations,
        appVersionName = BuildConfig.VERSION_NAME,
        appVersionCode = BuildConfig.VERSION_CODE,
        dbVersion = BUG_DB_VERSION,
        device = BugDevice(model = "${Build.MANUFACTURER} ${Build.MODEL}", android = "Android ${Build.VERSION.RELEASE}"),
        currentProjectId = projectId,
        currentRoomId = roomId,
    )
    val png = renderAnnotatedPng(bitmap, annotations, notes)
    val saved = BugReportStore.save(context.filesDir, base, png, bundle)
    uploadBugToTree(context, saved)   // העלאה-אוטומטית לתיקיית-Drive (אם הוגדרה) → סינרגיה לדו"ח-המודד
    return saved
}

/**
 * מעלה אוטומטית את זוג-קבצי-הדיווח (PNG+JSON) לתיקיית-Drive שהמודד בחר פעם-אחת ([Prefs.bugUploadTreeUri]),
 * דרך SAF (DocumentsContract — בלי תלות חדשה). כשל שקט: הדיווח כבר-נשמר מקומית ונשתף ידנית.
 */
private fun uploadBugToTree(context: android.content.Context, saved: SavedBugReport) {
    val treeStr = il.co.soline.measure.data.Prefs.bugUploadTreeUri
    if (treeStr.isBlank()) return
    try {
        val tree = android.net.Uri.parse(treeStr)
        val dirUri = android.provider.DocumentsContract.buildDocumentUriUsingTree(
            tree, android.provider.DocumentsContract.getTreeDocumentId(tree),
        )
        copyToTree(context, dirUri, "image/png", saved.png)
        copyToTree(context, dirUri, "application/json", saved.json)
    } catch (_: Exception) { /* נשמר מקומית — שיתוף-ידני נשאר גיבוי */ }
}

private fun copyToTree(context: android.content.Context, dirUri: android.net.Uri, mime: String, file: java.io.File) {
    val cr = context.contentResolver
    val target = android.provider.DocumentsContract.createDocument(cr, dirUri, mime, file.name) ?: return
    cr.openOutputStream(target)?.use { out -> file.inputStream().use { it.copyTo(out) } }
}
