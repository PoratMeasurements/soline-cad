package il.co.soline.measure.ui.fields

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.CompositionLocalProvider
import il.co.soline.measure.catalog.OpeningSpec
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.TealBg
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * שדות-מדידה של אלמנט — שתי שיטות-המדידה של CVSM (§8.5–8.7) כרכיב אחד לשימוש-חוזר.
 *
 * שיטה 1 — **מרכז** (from center, `widthInputMode = WIDTH_POSITION` + "מהמרכז"):
 *   מודדים את **מיקום-המרכז** של האלמנט לאורך הקיר + **רוחב** (או קוטר). ברירת-המחדל
 *   לאלמנטים עגולים/קטנים (שקע נמדד מהמרכז). נגזר: fromLeft = מרכז − רוחב/2.
 *
 * שיטה 2 — **היסטים מפינות** (offsets from corners, `widthInputMode = LEFT_RIGHT`):
 *   מודדים מרחק **מהפינה השמאלית** לאלמנט ומרחק **מהאלמנט לפינה הימנית**;
 *   הרוחב **מחושב אוטומטית** = אורך-הקיר − היסט-שמאל − היסט-ימין. ברירת-המחדל
 *   לחלונות/פתחים/אלמנטים גדולים. נגזר: fromLeft = היסט-שמאל.
 *
 * ברירת-מחדל למתג: אלמנט עגול (round) → **מרכז**; אחרת → **היסטים מפינות**.
 *
 * הרכיב עצמאי לחלוטין: מזריק לייזר (קליטה-אחת בפוקוס) מ-`SolineApp.instance.ble.lastReading`,
 * מיישר RTL (עברית, לשון זכר), ומדווח ערכים דרך `onValues` בכל שינוי.
 */
@Composable
fun ElementMeasureFields(
    wallLengthMm: Double,      // לחישוב-רוחב אוטומטי במצב היסטים-מפינות
    hasDepth: Boolean,
    round: Boolean,
    defaultDepth: Double = 0.0, // עומק-בליטה D מברירת-מחדל-הקטלוג — ממולא-מראש (ניתן-לעריכה)
    onValues: (fromLeftMm: Double, widthMm: Double, fromBottomMm: Double, heightMm: Double, depthMm: Double, measured: Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    // ברירת-מחדל: עגול/קטן → מרכז; אחרת → היסטים-מפינות. rememberSaveable ⇒ שורד-סיבוב (P0-2).
    var centerMode by rememberSaveable { mutableStateOf(round) }
    // מצב-מרכז: מאיזה קצה נמדד מיקום-המרכז (בקשת-מודד 120716). true=שמאל (ברירת-מחדל).
    var centerFromLeft by rememberSaveable { mutableStateOf(true) }

    // שדות משותפים לשני המצבים. עומק-הבליטה ממולא-מראש בברירת-המחדל של הקטלוג
    // (מקרר 650, מזגן 180…) — לא ריק — כדי שלא-ייוצא D=0 בשקט (יסוד R4).
    val depth = rememberSaveable { mutableStateOf(if (hasDepth && defaultDepth > 0.0) fmtMm(defaultDepth) else "") }
    val fromBottom = rememberSaveable { mutableStateOf("") }
    val height = rememberSaveable { mutableStateOf("") }

    // מצב "מרכז"
    val centerPos = rememberSaveable { mutableStateOf("") }
    val widthCenter = rememberSaveable { mutableStateOf("") }

    // מצב "היסטים מפינות"
    val offsetLeft = rememberSaveable { mutableStateOf("") }
    val offsetRight = rememberSaveable { mutableStateOf("") }

    // דגל "נמדד-מול-ברירת-מחדל" (§5): נהיה true רק כשהמודד ערך שדה-מידה או שהוזרק
    // לייזר — לא כשעבר-בטאב על ברירת-מחדל ממולאת-מראש. מבדיל מדידה-אמיתית מניחוש-קטלוג.
    var measured by rememberSaveable { mutableStateOf(false) }
    val markMeasured = { measured = true }

    // חישוב-רוחב חי במצב היסטים
    val oL = offsetLeft.value.toMm()
    val oR = offsetRight.value.toMm()
    val computedWidth = max(0.0, wallLengthMm - oL - oR)

    // דיווח ערכים לאב בכל שינוי
    LaunchedEffect(
        centerMode, centerFromLeft, depth.value, fromBottom.value, height.value,
        centerPos.value, widthCenter.value, offsetLeft.value, offsetRight.value, wallLengthMm, measured,
    ) {
        val d = if (hasDepth) depth.value.toMm() else 0.0
        val fb = fromBottom.value.toMm()
        val h = height.value.toMm()
        if (centerMode) {
            val w = widthCenter.value.toMm()
            val raw = centerPos.value.toMm()
            // מיקום-המרכז המוחלט (מהקצה השמאלי) — מתהפך כשמודדים מהקצה הימני.
            val centerAbs = if (centerFromLeft) raw else wallLengthMm - raw
            val fromLeft = centerAbs - w / 2.0
            onValues(fromLeft, w, fb, h, d, measured)
        } else {
            onValues(oL, computedWidth, fb, h, d, measured)
        }
    }

    // ── ולידציה-אינליין (שער-הזנת-אלמנט · קבוצה-D): מציגים אדום רק על שדה שהוזן-אך-שגוי;
    // שדה-ריק אינו-אדום (הכפתור-בשער כבוי + הערת-סיכום מדריכים). fromLeft שלילי (מצב-מרכז) נדחה. ──
    val wVal = if (centerMode) widthCenter.value.toMm() else computedWidth
    val hVal = height.value.toMm()
    val flVal = if (centerMode) {
        val raw = centerPos.value.toMm()
        (if (centerFromLeft) raw else wallLengthMm - raw) - wVal / 2.0
    } else oL
    val widthErr = if (centerMode && widthCenter.value.isNotBlank() && wVal <= 0.0) "רוחב חייב להיות גדול מ-0" else null
    val heightErr = if (height.value.isNotBlank() && hVal <= 0.0) "גובה חייב להיות גדול מ-0" else null
    val centerErr = if (centerMode && centerPos.value.isNotBlank() && widthCenter.value.isNotBlank() && flVal < 0.0)
        "המיקום קטן מדי — הקצה השמאלי יוצא שלילי" else null
    val computedWidthErr = !centerMode && (offsetLeft.value.isNotBlank() || offsetRight.value.isNotBlank()) && computedWidth <= 0.0

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Column(modifier.fillMaxWidth()) {
            ModeToggle(centerMode = centerMode, onSelect = { centerMode = it })

            if (centerMode) {
                // מאיזה קצה נמדד מיקום-המרכז (בקשת-מודד 120716)
                CenterSideToggle(centerFromLeft) { centerFromLeft = it }
                LaserNumField(
                    "מיקום-מרכז (${Prefs.unitSuffix} " + (if (centerFromLeft) "מהקצה השמאלי" else "מהקצה הימני") + ")",
                    centerPos, onEdited = markMeasured, error = centerErr,
                )
                LaserNumField(if (round) "קוטר (${Prefs.unitSuffix})" else "רוחב (${Prefs.unitSuffix})", widthCenter, onEdited = markMeasured, error = widthErr)
            } else {
                LaserNumField("היסט משמאל (${Prefs.unitSuffix})", offsetLeft, onEdited = markMeasured)
                LaserNumField("היסט מימין (${Prefs.unitSuffix})", offsetRight, onEdited = markMeasured)
                Text(
                    if (computedWidthErr) "רוחב מחושב לא-תקין (${Prefs.lenValue(computedWidth)}) — צמצם את ההיסטים"
                    else "רוחב מחושב: ${Prefs.formatLen(computedWidth)}",
                    fontSize = 13.sp,
                    color = if (computedWidthErr) BlockRed else Teal,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 2.dp, bottom = 4.dp),
                )
            }

            if (hasDepth) LaserNumField("עומק-בליטה D (${Prefs.unitSuffix})", depth, onEdited = markMeasured)
            LaserNumField("גובה מהרצפה (${Prefs.unitSuffix})", fromBottom, onEdited = markMeasured)
            LaserNumField("גובה האלמנט (${Prefs.unitSuffix})", height, onEdited = markMeasured, error = heightErr)
        }
    }
}

/** מתג-מקטעים: [ מהקצה השמאלי | מהקצה הימני ] — בסיס-מדידת מיקום-המרכז (120716). */
@Composable
private fun CenterSideToggle(fromLeft: Boolean, onSelect: (Boolean) -> Unit) {
    Surface(shape = RoundedCornerShape(10.dp), color = Cream, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(Modifier.padding(3.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            SegmentCell("מהקצה השמאלי", selected = fromLeft, modifier = Modifier.weight(1f)) { onSelect(true) }
            SegmentCell("מהקצה הימני", selected = !fromLeft, modifier = Modifier.weight(1f)) { onSelect(false) }
        }
    }
}

/** מתג-מקטעים: [ מרכז | היסטים מפינות ] */
@Composable
private fun ModeToggle(centerMode: Boolean, onSelect: (Boolean) -> Unit) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = Cream,
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
    ) {
        Row(Modifier.padding(3.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            SegmentCell("מרכז", selected = centerMode, modifier = Modifier.weight(1f)) { onSelect(true) }
            SegmentCell("היסטים מפינות", selected = !centerMode, modifier = Modifier.weight(1f)) { onSelect(false) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SegmentCell(label: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        color = if (selected) Orange else Color.White,
        modifier = modifier,
    ) {
        Text(
            label,
            fontSize = 14.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            color = if (selected) Color.White else Ink,
            modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
            textAlign = TextAlign.Center,
        )
    }
}

/**
 * שדה מספרי חכם עם הזרקת-לייזר **דָּרוּך-מתמשך** (re-armable):
 *  • פוקוס על השדה או הקשה על 📡 → דורך את השדה ("📡 ממתין לירייה…").
 *  • כל ירייה חדשה (ts > armedFrom) דורסת את הערך — ונשאר-דרוך לירי-חוזר, כך שאם
 *    המודד טעה הוא יכול פשוט לירות שוב והערך יתעדכן, שוב ושוב, עד שהוא מרוצה.
 *  • הקשה נוספת על 📡 מבטלת את הדריכה (או מעבר לשדה-אחר). זה מתקן את הבאג הקריטי
 *    שבו קליטה-שנייה לא-נלכדה: הישן היה חד-פעמי ולא-נדרך-מחדש בלי לעזוב-ולחזור לשדה.
 */
@Composable
private fun LaserNumField(
    label: String,
    state: MutableState<String>,
    laser: Boolean = true,
    // נקרא בכל עריכת-משתמש (הקלדה) או הזרקת-לייזר — מסמן "נמדד" (§5). לא-נקרא במילוי-מראש.
    onEdited: (() -> Unit)? = null,
    // שגיאת-ולידציה אינליין (טקסט-עזר אדום) — null ⇒ תקין. שער-הזנת-האלמנט (קבוצה-D).
    error: String? = null,
) {
    val ble = SolineApp.instance.ble
    val last by ble.lastReading.collectAsState()
    var focused by remember { mutableStateOf(false) }
    // דָּרוּך: כשדרוך, כל ירייה חדשה נלכדת. נשאר-דרוך (לא חד-פעמי) → מדידה-חוזרת חופשית.
    var armed by remember { mutableStateOf(false) }
    var armedFrom by remember { mutableStateOf(Long.MAX_VALUE) }
    LaunchedEffect(last, armed) {
        val r = last
        if (laser && armed && r?.distanceMm != null && r.ts > armedFrom) {
            armedFrom = r.ts             // דורס-וממשיך-דרוך — הירייה-הבאה תדרוס שוב
            state.value = Prefs.toDisplayText(r.distanceMm)   // מזריק ביחידת-התצוגה
            onEdited?.invoke()           // הזרקת-לייזר = מדידה-אמיתית
        }
    }
    OutlinedTextField(
        value = state.value,
        onValueChange = { state.value = it; onEdited?.invoke() },
        label = {
            Text(
                when {
                    laser && armed -> "$label  📡 ממתין לירייה… (הקש לביטול)"
                    laser && focused -> "$label  📡 מדוד (הקש 📡 לדריכה)"
                    else -> label
                }
            )
        },
        singleLine = true,
        isError = error != null,
        supportingText = error?.let { { Text(it, color = BlockRed, fontSize = 12.sp) } },
        trailingIcon = if (laser) {
            {
                Text(
                    "📡",
                    fontSize = 22.sp,
                    color = if (armed) Orange else Muted,
                    modifier = Modifier
                        .clickable {
                            if (armed) { armed = false; armedFrom = Long.MAX_VALUE }
                            else { armed = true; armedFrom = last?.ts ?: 0L }
                        }
                        .padding(12.dp),
                )
            }
        } else null,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
            .onFocusChanged { fs ->
                focused = fs.isFocused
                if (laser) {
                    if (fs.isFocused) { armed = true; armedFrom = last?.ts ?: 0L }
                    else { armed = false; armedFrom = Long.MAX_VALUE }
                }
            },
    )
}

/** מ"מ מטקסט: הטקסט מוזן ביחידת-התצוגה → מומר למ"מ; ריק/לא-תקין → 0.0 */
private fun String.toMm(): Double {
    val v = trim().replace(',', '.').toDoubleOrNull() ?: return 0.0
    return Prefs.toMm(v)
}

// ═══════════════════════════════════════════════════════════════════════════════
//  טופס-פתח פרמטרי (דלת / חלון / מיזוג-איוורור) — OPENING_ELEMENT_SCHEMA.md
//  עיקרון-הבעלים: אתר-בנייה אינו סטרילי — מפרט-היצרן ≠ מידת-שטח. לכן כל שדה
//  ממולא-מראש במידת-היצרן (ברירת-מחדל) אך **ניתן-לעריכה** למידת-האמת שנמדדה.
// ═══════════════════════════════════════════════════════════════════════════════

/** תוצאת-הטופס — כל שדות-הפתח, מוכנים לבניית AccessoryEntity. */
data class OpeningResult(
    val fromLeft: Double, val width: Double, val height: Double,
    val fromBottom: Double, val depth: Double,
    val openingKind: String, val sillHeight: Double, val wallThickness: Double,
    val frameThickness: Double, val frameReveal: Double, val leafThickness: Double,
    val openMode: String, val hingeSide: String, val swing: String,
    val leafCount: Int, val glazing: String, val fromCorner: String,
    // §5: true רק כשהמודד ערך שדה-מידה/הזריק-לייזר (לא במידות-יצרן ממולאות-מראש).
    val measured: Boolean = false,
    // שער-הזנת-פתח (קבוצה-D): true רק כששדה-ההיסט מולא בפועל (blank≠0). מבדיל
    // "מיקום 0 בפינה" מ"טרם-הוזן מיקום" — האב חוסם שמירה עד שההיסט הוזן.
    val offsetProvided: Boolean = false,
)

private val OPEN_MODES = listOf("hinged", "sliding", "folding", "pocket", "fixed", "kip", "awning", "hung", "double")
// מסונן לפי-סוג-האלמנט (בינוני בביקורת): דלת ≠ חלון. מצב-לא-רלוונטי לא-מוצג לבחירה.
private val DOOR_MODES = listOf("hinged", "sliding", "folding", "pocket", "double", "fixed")
private val WINDOW_MODES = listOf("sliding", "hinged", "kip", "awning", "hung", "fixed")
// מצבי-חלון שיש-להם ציר/כיוון-פתיחה (מוטה/נפתח) — מציגים עבורם ציר+כיוון גם לחלון.
private val WINDOW_HINGED_MODES = setOf("hinged", "kip", "awning")
private val HINGE_SIDES = listOf("L", "R", "")
private val SWINGS = listOf("in", "out", "")
private val GLAZINGS = listOf("none", "partial", "full")

/** מ"מ→טקסט-תצוגה קצר לפי יחידת-התצוגה (למילוי-מראש של שדה-קלט). */
private fun fmtMm(v: Double): String = Prefs.lenValue(v)

/**
 * שדות-מדידה של **פתח פרמטרי**. ממולא-מראש מ-[spec] (מידות-יצרן) — המודד דורס
 * במידת-שטח. מדווח את המצב המלא דרך [onValues] בכל שינוי. הזרקת-לייזר בכל שדה מספרי.
 *
 * @param spec     מפרט-ברירת-המחדל מהקטלוג (OpeningSpec).
 * @param hasDepth האם להציג "עומק-בליטה" (יחידות-מזגן).
 */
@Composable
fun OpeningMeasureFields(
    spec: OpeningSpec,
    hasDepth: Boolean,
    defaultDepth: Double = 0.0, // עומק-בליטה D מברירת-מחדל-הקטלוג (יחידות-מזגן) — ממולא-מראש
    onValues: (OpeningResult) -> Unit,
    modifier: Modifier = Modifier,
) {
    val isDoor = spec.kind == "door"
    val isWindow = spec.kind == "window"

    // ── מצבי-השדות, ממולאים-מראש מברירת-המחדל של היצרן. rememberSaveable ⇒ שורד-סיבוב (P0-2) ──
    val offset = rememberSaveable(spec) { mutableStateOf("") }        // pos.offset — נמדד בשטח
    val fromCorner = rememberSaveable(spec) { mutableStateOf("start") }
    val width = rememberSaveable(spec) { mutableStateOf(fmtMm(spec.width)) }
    val height = rememberSaveable(spec) { mutableStateOf(fmtMm(spec.height)) }
    val sill = rememberSaveable(spec) { mutableStateOf(spec.sillHeight?.let { fmtMm(it) } ?: "") }
    val wallTh = rememberSaveable(spec) { mutableStateOf(fmtMm(spec.wallThickness)) }
    val frameTh = rememberSaveable(spec) { mutableStateOf(fmtMm(spec.frameThickness)) }
    val reveal = rememberSaveable(spec) { mutableStateOf(fmtMm(spec.frameReveal)) }
    val leafTh = rememberSaveable(spec) { mutableStateOf(fmtMm(spec.leafThickness)) }
    // עומק-בליטה D ממולא-מראש מברירת-מחדל-הקטלוג (מזגן עילי 200, קסטה 300, נסתר 600…)
    // כדי שלא-ייוצא D=0 בשקט (יסוד R4). ניתן-לעריכה למידת-האמת.
    val depth = rememberSaveable(spec) { mutableStateOf(if (hasDepth && defaultDepth > 0.0) fmtMm(defaultDepth) else "") }
    val openMode = rememberSaveable(spec) { mutableStateOf(spec.openMode) }
    val hinge = rememberSaveable(spec) { mutableStateOf(spec.hingeSide ?: "") }
    val swing = rememberSaveable(spec) { mutableStateOf(spec.swing ?: "") }
    val leafCount = rememberSaveable(spec) { mutableStateOf(spec.leafCount.toString()) }
    val glazing = rememberSaveable(spec) { mutableStateOf(spec.glazing) }

    // דגל "נמדד-מול-ברירת-מחדל" (§5) — נהיה true רק כשהמודד ערך שדה-מידה/הזריק-לייזר.
    var measured by rememberSaveable(spec) { mutableStateOf(false) }
    val markMeasured = { measured = true }

    LaunchedEffect(
        offset.value, fromCorner.value, width.value, height.value, sill.value, wallTh.value,
        frameTh.value, reveal.value, leafTh.value, depth.value, openMode.value, hinge.value,
        swing.value, leafCount.value, glazing.value, measured,
    ) {
        val sillMm = if (isDoor) -1.0 else sill.value.toMm()
        val fromBottom = if (isDoor) 0.0 else sillMm.coerceAtLeast(0.0)
        onValues(
            OpeningResult(
                fromLeft = offset.value.toMm(),
                width = width.value.toMm(),
                height = height.value.toMm(),
                fromBottom = fromBottom,
                depth = if (hasDepth) depth.value.toMm() else 0.0,
                openingKind = spec.kind,
                sillHeight = sillMm,
                wallThickness = wallTh.value.toMm(),
                frameThickness = frameTh.value.toMm(),
                frameReveal = reveal.value.toMm(),
                leafThickness = leafTh.value.toMm(),
                openMode = openMode.value,
                hingeSide = hinge.value,
                swing = swing.value,
                leafCount = leafCount.value.trim().toIntOrNull() ?: 1,
                glazing = glazing.value,
                fromCorner = fromCorner.value,
                measured = measured,
                offsetProvided = offset.value.isNotBlank(),
            )
        )
    }

    // ── ולידציה-אינליין (שער-הזנת-פתח · קבוצה-D) — אדום על שדה שהוזן-אך-שגוי; ההיסט חובה ──
    val wErr = if (width.value.isNotBlank() && width.value.toMm() <= 0.0) "רוחב חייב להיות גדול מ-0" else null
    val hErr = if (height.value.isNotBlank() && height.value.toMm() <= 0.0) "גובה חייב להיות גדול מ-0" else null
    val offErr = if (offset.value.isBlank()) "יש להזין מיקום (היסט)" else if (offset.value.toMm() < 0.0) "ההיסט אינו-יכול להיות שלילי" else null

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Column(modifier.fillMaxWidth()) {
            // באנר-עיקרון: ברירת-מחדל-יצרן vs מידת-שטח
            Surface(shape = RoundedCornerShape(10.dp), color = TealBg, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Text(
                    "המידות ממולאות בברירת-מחדל של היצרן — עדכן למידת-האמת שנמדדה בשטח.",
                    fontSize = 12.sp, color = Teal, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                )
            }

            SectionLabel("מיקום על הקיר")
            CornerToggle(fromCorner.value) { fromCorner.value = it }
            LaserNumField(if (fromCorner.value == "start") "היסט מהפינה השמאלית (${Prefs.unitSuffix})" else "היסט מהפינה הימנית (${Prefs.unitSuffix})", offset, onEdited = markMeasured, error = offErr)

            SectionLabel("גיאומטריה — מידות-אמת")
            LaserNumField("רוחב-פתח (${Prefs.unitSuffix})", width, onEdited = markMeasured, error = wErr)
            LaserNumField("גובה-פתח (${Prefs.unitSuffix})", height, onEdited = markMeasured, error = hErr)
            if (!isDoor) LaserNumField("גובה-סף מהרצפה (${Prefs.unitSuffix})", sill, onEdited = markMeasured)
            LaserNumField("עובי-קיר מארח (${Prefs.unitSuffix})", wallTh, onEdited = markMeasured)
            LaserNumField(if (isWindow) "עובי-מסגרת (${Prefs.unitSuffix})" else "עובי-משקוף (${Prefs.unitSuffix})", frameTh, onEdited = markMeasured)
            if (isDoor || isWindow) LaserNumField("חשפה / מלבן נראה (${Prefs.unitSuffix})", reveal, onEdited = markMeasured)
            if (isDoor) LaserNumField("עובי-כנף (${Prefs.unitSuffix})", leafTh, onEdited = markMeasured)
            if (hasDepth) LaserNumField("עומק-בליטה D (${Prefs.unitSuffix})", depth, onEdited = markMeasured)

            SectionLabel("תצורה")
            // מנגנון-הפתיחה מסונן לסוג: דלת/חלון מקבלים רק את המצבים הרלוונטיים להם.
            val openModes = when { isWindow -> WINDOW_MODES; isDoor -> DOOR_MODES; else -> OPEN_MODES }
            OpeningDropdown("מנגנון-פתיחה", openMode.value, openModes) { openMode.value = it }
            // ציר-ופתיחה: תמיד לדלת; לחלון רק כשמנגנון-הפתיחה נדרש ציר (צירי/מוטה/גמלון).
            val showHinge = isDoor || (isWindow && openMode.value in WINDOW_HINGED_MODES)
            if (showHinge) {
                OpeningDropdown("צד-ציר", hinge.value.ifEmpty { "" }, HINGE_SIDES, labelFor = ::hingeLabel) { hinge.value = it }
                OpeningDropdown("כיוון-פתיחה", swing.value.ifEmpty { "" }, SWINGS, labelFor = ::swingLabel) { swing.value = it }
            }
            // B1: מונה-כנפיים אינו מרחק — מנטרלים הזרקת-לייזר.
            LaserNumField("מספר-כנפיים", leafCount, laser = false)
            OpeningDropdown("זיגוג", glazing.value, GLAZINGS, labelFor = ::glazingLabel) { glazing.value = it }
        }
    }
}

private fun hingeLabel(v: String) = when (v) { "L" -> "שמאל (L)"; "R" -> "ימין (R)"; else -> "ללא" }
private fun swingLabel(v: String) = when (v) { "in" -> "פנימה (in)"; "out" -> "החוצה (out)"; else -> "ללא" }
private fun glazingLabel(v: String) = when (v) { "none" -> "ללא"; "partial" -> "חלקי"; "full" -> "מלא"; else -> v }

@Composable
private fun SectionLabel(text: String) {
    Text(
        text, fontSize = 13.sp, color = Orange, fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(top = 10.dp, bottom = 2.dp),
    )
}

/** מתג [ מהפינה השמאלית | מהפינה הימנית ] לבסיס-המדידה של pos.offset. */
@Composable
private fun CornerToggle(value: String, onSelect: (String) -> Unit) {
    Surface(shape = RoundedCornerShape(10.dp), color = Cream, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(Modifier.padding(3.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            SegmentCell("מהפינה השמאלית", selected = value == "start", modifier = Modifier.weight(1f)) { onSelect("start") }
            SegmentCell("מהפינה הימנית", selected = value == "end", modifier = Modifier.weight(1f)) { onSelect("end") }
        }
    }
}

/** בורר-ערך פשוט (RTL) עם תוויות-עברית אופציונליות. */
@Composable
private fun OpeningDropdown(
    label: String,
    value: String,
    options: List<String>,
    labelFor: (String) -> String = { it },
    onSelect: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(label, fontSize = 12.sp, color = Muted, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(2.dp))
        Box {
            OutlinedButton(
                onClick = { open = true }, modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Ink),
            ) {
                Text(labelFor(value).ifEmpty { "בחר" }, fontSize = 15.sp, modifier = Modifier.weight(1f))
                Text("▾", fontSize = 14.sp, color = Muted)
            }
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                options.forEach { opt ->
                    DropdownMenuItem(text = { Text(labelFor(opt).ifEmpty { "ללא" }, color = Ink) }, onClick = { onSelect(opt); open = false })
                }
            }
        }
    }
}
