package il.co.soline.measure.ui.resize

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.CompositionLocalProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.geometry.Trilateration
import il.co.soline.measure.geometry.Trilateration.Pt
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/* ─────────────────────────────────────────────────────────────────────────────
 * מסך "מדידה מ-Datum / טרילטרציה" — הליבה-המקצועית של InnoDraw
 * (INNODRAW_FEATURES §4 "Resize / Measures" · CVSM §6.4 "משולש-הזהב").
 *
 * במקום לגרור קודקוד, המודד בוחר שיטה, מזין מרחקים-נמדדים (כל שדה יכול ללכוד
 * ישירות מ-ble.lastReading של מד-הלייזר), ורואה את התוצאה — זווית/נקודה/אוריינטציה
 * — מצוירת על קנבס-סקיצה קטן. onResult מקבל סיכום-טקסט להזרקה חזרה לחדר.
 *
 * שלוש שיטות (כולן נשענות על il.co.soline.measure.geometry.Trilateration בלבד):
 *   1. זווית-לפי-מרחקים  (angleByDistances)          — פותר קצה-משולש משני-מרחקים.
 *   2. פינה-לפי-מרחק     (cornerByDistance)          — קצה במרחק לאורך כיוון נתון.
 *   3. קו-לפי-ייחוס      (lineOrientationByReference) — אזימוט משני-היסטים לקו-ייחוס.
 *
 * הרכיב עצמאי: לא נוגע בטיפוסים היציבים אלא קורא אותם (WallEntity לרפרנס-אורכים,
 * ble.lastReading ללכידה, צבעי-המותג). RTL מלא, מטרות-מגע גדולות לשטח.
 * ──────────────────────────────────────────────────────────────────────────── */

/** שיטת-המדידה הנבחרת. */
private enum class Method(val label: String) {
    ANGLE("זווית לפי מרחקים"),
    CORNER("פינה לפי מרחק"),
    LINE("קו לפי ייחוס"),
}

/** תוצאת-חישוב לציור ולסיכום. */
private class Computed(
    val summary: String,          // טקסט-סיכום ל-onResult ולתצוגה
    val segments: List<Pair<Pt, Pt>>, // קטעים לציור
    val points: List<Pt>,         // נקודות-ציון לציור
    val ok: Boolean,              // האם הקלט מספיק לחישוב תקין
)

@Composable
fun DatumMeasureScreen(
    walls: List<WallEntity>,
    onResult: (String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val ble = remember { (context.applicationContext as SolineApp).ble }
    val reading by ble.lastReading.collectAsStateWithLifecycle(null)
    val connected by ble.connected.collectAsStateWithLifecycle(null)

    // המרחק-הזמין-ללכידה מהפריים-האחרון (מ"מ, אם תקין).
    val captureMm: Double? = reading?.distanceMm?.takeIf { it.isFinite() && it > 0.0 }

    var method by remember { mutableStateOf(Method.ANGLE) }

    // שדות-הקלט הגולמיים (טקסט) — עד שלושה בשימוש בכל שיטה, פלוס כיוון לפינה.
    var f1 by remember { mutableStateOf("") } // ANGLE:distAB · CORNER:distance · LINE:refLen
    var f2 by remember { mutableStateOf("") } // ANGLE:tipFromA · CORNER:dirDeg · LINE:d1
    var f3 by remember { mutableStateOf("") } // ANGLE:distToTip · LINE:d2

    // רפרנס-אורך-נוח: אורך-הקיר-הראשון (אם יש) כרמז למילוי קו-בסיס.
    val hintLen = remember(walls) { walls.minByOrNull { it.idx }?.length?.roundToInt() }

    fun p(s: String): Double? = s.trim().replace(',', '.').toDoubleOrNull()

    val computed: Computed = remember(method, f1, f2, f3) { compute(method, p(f1), p(f2), p(f3)) }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Column(
            modifier
                .fillMaxSize()
                .background(Cream)
                .verticalScroll(rememberScrollState()),
        ) {
            // ── כותרת + חזרה + חיווי-לייזר ──────────────────────────────────
            Row(
                Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(
                    onClick = onBack,
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
                ) { Text("→ חזרה", fontSize = 15.sp) }
                Column(Modifier.weight(1f)) {
                    Text("מדידה מ-Datum · טרילטרציה", color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text("קבע גאומטריה ממרחקים נמדדים — לא בגרירה", color = Muted, fontSize = 12.sp)
                }
                LaserBadge(connected != null, captureMm)
            }

            // ── בורר-שיטה ──────────────────────────────────────────────────
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                for (m in Method.entries) {
                    val sel = m == method
                    Button(
                        onClick = { method = m; f1 = ""; f2 = ""; f3 = "" },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (sel) Teal else Color.White,
                            contentColor = if (sel) Color.White else Ink,
                        ),
                        border = if (sel) null else androidx.compose.foundation.BorderStroke(1.dp, Muted.copy(alpha = 0.4f)),
                        contentPadding = PaddingValues(vertical = 12.dp, horizontal = 6.dp),
                        modifier = Modifier.weight(1f),
                    ) { Text(m.label, fontSize = 13.sp, textAlign = TextAlign.Center) }
                }
            }

            // ── שדות-הקלט לפי-שיטה (כל שדה בעל כפתור-לכידה מהלייזר) ─────────
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                when (method) {
                    Method.ANGLE -> {
                        MethodHint(
                            "מדוד קו-בסיס בין שתי פינות-ייחוס, ואת המרחק מכל פינה אל הקצה השלישי. " +
                                "המערכת פותרת את הזווית והנקודה (משולש-הזהב)."
                        )
                        CaptureField("אורך קו-הבסיס (A→B)", f1, { f1 = it }, captureMm, hintLen)
                        CaptureField("מרחק מפינה A אל הקצה", f2, { f2 = it }, captureMm, null)
                        CaptureField("מרחק מפינה B אל הקצה", f3, { f3 = it }, captureMm, null)
                    }
                    Method.CORNER -> {
                        MethodHint(
                            "קבע קצה חדש במרחק נמדד מפינת-ייחוס, לאורך כיוון-קו קבוע (בלי לשנות את כיוון-הקו)."
                        )
                        CaptureField("מרחק מפינת-הייחוס", f1, { f1 = it }, captureMm, hintLen)
                        CaptureField("כיוון הקו (מעלות, 0=מזרח)", f2, { f2 = it }, null, 0)
                    }
                    Method.LINE -> {
                        MethodHint(
                            "מדוד את אורך קו-הייחוס ואת שני ההיסטים הניצבים אליו (בכל קצה). " +
                                "המערכת מחשבת את אזימוט-הקו שלך."
                        )
                        CaptureField("אורך קו-הייחוס", f1, { f1 = it }, captureMm, hintLen)
                        CaptureField("היסט בקצה A (d1)", f2, { f2 = it }, captureMm, null)
                        CaptureField("היסט בקצה B (d2)", f3, { f3 = it }, captureMm, null)
                    }
                }
            }

            // ── קנבס-סקיצה של התוצאה ────────────────────────────────────────
            Text(
                "סקיצת-התוצאה", color = Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth().padding(start = 16.dp, top = 14.dp, bottom = 4.dp),
            )
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(220.dp)
                    .padding(horizontal = 12.dp)
                    .background(Color.White, RoundedCornerShape(12.dp))
                    .border(1.dp, Muted.copy(alpha = 0.25f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                if (!computed.ok) {
                    Text("מלא את שדות-המדידה כדי לראות תוצאה", color = Muted, fontSize = 14.sp, textAlign = TextAlign.Center)
                } else {
                    SketchCanvas(computed)
                }
            }

            // ── תוצאה מילולית + כפתור-החלה ──────────────────────────────────
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp)
                    .background(if (computed.ok) OkGreen.copy(alpha = 0.10f) else Muted.copy(alpha = 0.10f), RoundedCornerShape(12.dp))
                    .padding(14.dp),
            ) {
                Text(
                    if (computed.ok) computed.summary else "אין עדיין תוצאה",
                    color = if (computed.ok) Ink else Muted,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                )
            }

            Button(
                onClick = { onResult(computed.summary) },
                enabled = computed.ok,
                colors = ButtonDefaults.buttonColors(containerColor = Orange, contentColor = Color.White),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                contentPadding = PaddingValues(vertical = 16.dp),
            ) { Text("החל תוצאה על החדר", fontSize = 16.sp, fontWeight = FontWeight.Bold) }

            Spacer(Modifier.height(20.dp))
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// רכיבי-משנה
// ─────────────────────────────────────────────────────────────────────────────

/** תג-חיווי למד-הלייזר: מחובר + הערך-הזמין-ללכידה. */
@Composable
private fun LaserBadge(connected: Boolean, mm: Double?) {
    val (bg, fg, txt) = when {
        !connected -> Triple(Muted.copy(alpha = 0.15f), Muted, "לייזר מנותק")
        mm != null -> Triple(OkGreen.copy(alpha = 0.15f), OkGreen, "📏 ${mm.roundToInt()} מ\"מ")
        else -> Triple(Teal.copy(alpha = 0.15f), Teal, "מחובר — ירֵה")
    }
    Box(
        Modifier.background(bg, RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 7.dp),
    ) { Text(txt, color = fg, fontSize = 12.sp, fontWeight = FontWeight.SemiBold) }
}

/** הסבר-שיטה קצר. */
@Composable
private fun MethodHint(text: String) {
    Text(text, color = Muted, fontSize = 13.sp, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
}

/**
 * שדה-מרחק גדול עם כפתור-לכידה מהלייזר.
 * @param captureMm הערך הזמין ללכידה מ-ble.lastReading (או null אם אין/לא-רלוונטי).
 * @param hint      ערך-רמז אופציונלי (placeholder) — למשל אורך-קיר קיים.
 */
@Composable
private fun CaptureField(
    label: String,
    value: String,
    onValue: (String) -> Unit,
    captureMm: Double?,
    hint: Int?,
) {
    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onValue,
            label = { Text(label, fontSize = 14.sp) },
            placeholder = hint?.let { { Text("$it", color = Muted) } },
            suffix = { Text("מ\"מ", color = Muted) },
            singleLine = true,
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.weight(1f),
        )
        Button(
            onClick = { captureMm?.let { onValue(it.roundToInt().toString()) } },
            enabled = captureMm != null,
            colors = ButtonDefaults.buttonColors(containerColor = Teal, contentColor = Color.White),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 16.dp),
            modifier = Modifier.width(96.dp),
        ) { Text("לכידה", fontSize = 14.sp) }
    }
}

/** מצייר את הקטעים והנקודות של [Computed] על קנבס עם אוטו-פיט. */
@Composable
private fun SketchCanvas(c: Computed) {
    Canvas(Modifier.fillMaxSize().padding(12.dp)) {
        val all = c.points + c.segments.flatMap { listOf(it.first, it.second) }
        if (all.isEmpty()) return@Canvas
        var minX = Double.MAX_VALUE; var minY = Double.MAX_VALUE
        var maxX = -Double.MAX_VALUE; var maxY = -Double.MAX_VALUE
        for (pt in all) {
            minX = min(minX, pt.x); minY = min(minY, pt.y)
            maxX = max(maxX, pt.x); maxY = max(maxY, pt.y)
        }
        val pad = 24f
        val spanX = max(maxX - minX, 1.0)
        val spanY = max(maxY - minY, 1.0)
        val scale = min((size.width - 2 * pad) / spanX, (size.height - 2 * pad) / spanY)
            .let { if (it.isFinite() && it > 0.0) it else 1.0 }
        val cx = (minX + maxX) / 2.0
        val cy = (minY + maxY) / 2.0
        // ‎-y כדי שכיוון-Y המתמטי (מעלה) יצויר כלפי-מעלה על המסך.
        fun sx(pt: Pt) = ((pt.x - cx) * scale + size.width / 2f).toFloat()
        fun sy(pt: Pt) = ((cy - pt.y) * scale + size.height / 2f).toFloat()

        c.segments.forEachIndexed { i, seg ->
            drawLine(
                if (i == 0) Muted else Orange,
                Offset(sx(seg.first), sy(seg.first)),
                Offset(sx(seg.second), sy(seg.second)),
                strokeWidth = if (i == 0) 4f else 6f,
                cap = StrokeCap.Round,
            )
        }
        c.points.forEachIndexed { i, pt ->
            drawCircle(if (i == c.points.lastIndex) Teal else Ink, 8f, Offset(sx(pt), sy(pt)))
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// חישוב (טהור — משתמש רק ב-Trilateration)
// ─────────────────────────────────────────────────────────────────────────────

private fun compute(method: Method, a1: Double?, a2: Double?, a3: Double?): Computed {
    return when (method) {
        Method.ANGLE -> {
            val distAB = a1; val tipFromA = a2; val distToTip = a3
            if (distAB == null || distAB <= 0 || tipFromA == null || tipFromA <= 0 || distToTip == null || distToTip <= 0) {
                empty()
            } else {
                val a = Pt(0.0, 0.0)
                val b = Pt(distAB, 0.0)
                val tip = Trilateration.angleByDistances(a, b, distAB, distToTip, tipFromA)
                val angAtA = Trilateration.angleAtVertex(a, b, tip)
                Computed(
                    summary = "זווית לפי מרחקים: זווית ${fmt(angAtA)}° בפינה A · " +
                        "קצה בנקודה (${tip.x.roundToInt()}, ${tip.y.roundToInt()}) מ\"מ " +
                        "[בסיס ${distAB.roundToInt()} · A→קצה ${tipFromA.roundToInt()} · B→קצה ${distToTip.roundToInt()}]",
                    segments = listOf(a to b, a to tip, b to tip),
                    points = listOf(a, b, tip),
                    ok = true,
                )
            }
        }
        Method.CORNER -> {
            val distance = a1; val dirDeg = a2 ?: 0.0
            if (distance == null || distance <= 0) empty()
            else {
                val from = Pt(0.0, 0.0)
                val dir = Trilateration.unitFromDeg(dirDeg)
                val pt = Trilateration.cornerByDistance(from, dir, distance)
                Computed(
                    summary = "פינה לפי מרחק: ${distance.roundToInt()} מ\"מ בכיוון ${fmt(dirDeg)}° " +
                        "→ נקודה (${pt.x.roundToInt()}, ${pt.y.roundToInt()}) מ\"מ מפינת-הייחוס",
                    segments = listOf(from to pt),
                    points = listOf(from, pt),
                    ok = true,
                )
            }
        }
        Method.LINE -> {
            val refLen = a1; val d1 = a2; val d2 = a3
            if (refLen == null || refLen <= 0 || d1 == null || d2 == null) empty()
            else {
                val refA = Pt(0.0, 0.0)
                val refB = Pt(refLen, 0.0)
                val bearing = Trilateration.lineOrientationByReference(refA, refB, d1, d2)
                // קו-הייחוס (אפור) + הקו-הנמדד (כתום) בהיסט הניצב (נורמל-שמאל של +X = +Y).
                val ourA = Pt(0.0, d1)
                val ourB = Pt(refLen, d2)
                Computed(
                    summary = "קו לפי ייחוס: אזימוט ${fmt(bearing)}° " +
                        "[אורך-ייחוס ${refLen.roundToInt()} · היסטים ${d1.roundToInt()}/${d2.roundToInt()} מ\"מ]",
                    segments = listOf(refA to refB, ourA to ourB),
                    points = listOf(ourA, ourB),
                    ok = true,
                )
            }
        }
    }
}

private fun empty() = Computed("", emptyList(), emptyList(), ok = false)

/** מספר מסודר: שלם אם עגול, אחרת ספרה-אחת. */
private fun fmt(v: Double): String {
    if (!v.isFinite()) return "—"
    val r = (v * 10).roundToInt() / 10.0
    return if (abs(r % 1.0) < 1e-9) r.toInt().toString() else r.toString()
}
