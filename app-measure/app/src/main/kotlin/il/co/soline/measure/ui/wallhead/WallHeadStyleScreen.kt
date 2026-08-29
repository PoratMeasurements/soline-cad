package il.co.soline.measure.ui.wallhead

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.geometry.WallBuilder
import il.co.soline.measure.geometry.WallHeadProfile
import il.co.soline.measure.geometry.WallHeadProfile.HeadStyle
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.WarnAmber
import kotlin.math.max
import kotlin.math.roundToInt

/* ─────────────────────────────────────────────────────────────────────────────
 *  WallHeadStyleScreen — סגנון-ראש-קיר (CVSM `#f-wall-topstyle`).
 *
 *  תצוגה-מקדימה של חמשת-סגנונות-הראש (ישר/משופע-שמאל/משופע-ימין/גמלון/חצי-אי)
 *  עם גובה-רכס ומיקום-פסגה, ופרופיל-החזית המחושב מ-WallHeadProfile.
 *
 *  שני-מצבים:
 *   • הדגמה (בלי [onSave]) — כלי-עיון/חישוב חופשי (שטח-חזית + אורך-קצה).
 *   • קשור-לקיר (עם [onSave]) — נטען מהקיר, כפתור-שמירה (✓) שומר פר-קיר דרך
 *     מיגרציית-Room 3→4 (WallEntity.headStyle/headRidgeMm/headPeakMm).
 * ───────────────────────────────────────────────────────────────────────────── */

@Composable
fun WallHeadStyleScreen(
    defaultHeightMm: Double,
    onBack: () -> Unit,
    title: String = "סגנון ראש קיר",
    initialStyle: HeadStyle = HeadStyle.STRAIGHT,
    initialLengthMm: Double? = null,
    initialBaseMm: Double? = null,
    initialRidgeMm: Double = 0.0,
    initialPeakMm: Double = 0.0,
    onSave: ((style: HeadStyle, ridgeMm: Double, peakMm: Double) -> Unit)? = null,
) {
    val startLen = initialLengthMm ?: 4000.0
    val startBase = initialBaseMm ?: defaultHeightMm
    var style by remember { mutableStateOf(initialStyle) }
    var lengthTxt by remember { mutableStateOf(Prefs.toDisplayText(startLen)) }
    var baseTxt by remember { mutableStateOf(Prefs.toDisplayText(startBase)) }
    var ridgeTxt by remember {
        mutableStateOf(Prefs.toDisplayText(if (initialRidgeMm > 0.0) initialRidgeMm else startBase + 800))
    }
    var peakTxt by remember {
        mutableStateOf(Prefs.toDisplayText(if (initialPeakMm > 0.0) initialPeakMm else startLen / 2))
    }

    // הקלט מוזן ביחידת-התצוגה → מומר למ"מ (fallback הוא כבר מ"מ).
    val length = Prefs.parseToMm(lengthTxt) ?: startLen
    val base = Prefs.parseToMm(baseTxt) ?: startBase
    val ridge = Prefs.parseToMm(ridgeTxt) ?: base
    val peak = Prefs.parseToMm(peakTxt) ?: (length / 2)
    val spec = WallHeadProfile.HeadSpec(style, base, ridge, peak)

    val profile = remember(length, spec) { WallHeadProfile.profile(length, spec) }
    val area = remember(length, spec) { WallHeadProfile.frontAreaMm2(length, spec) }
    val edge = remember(length, spec) { WallHeadProfile.edgeLength(length, spec) }
    val usesRidge = style == HeadStyle.SLOPE_LEFT || style == HeadStyle.SLOPE_RIGHT || style == HeadStyle.GABLE
    val usesPeak = style == HeadStyle.GABLE

    Column(Modifier.fillMaxSize().background(Cream)) {
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
            Spacer(Modifier.width(4.dp))
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Orange)
                Text("ישר · משופע · גמלון · חצי-אי — תצוגת-חזית", fontSize = 12.sp, color = Teal)
            }
            if (onSave != null) {
                Box(
                    Modifier
                        .background(Orange, RoundedCornerShape(10.dp))
                        .clickable {
                            val usesRidgeNow = style == HeadStyle.SLOPE_LEFT || style == HeadStyle.SLOPE_RIGHT || style == HeadStyle.GABLE
                            val ridgeOut = if (usesRidgeNow) maxOf(ridge, base) else 0.0
                            val peakOut = if (style == HeadStyle.GABLE) peak.coerceIn(0.0, length) else 0.0
                            onSave(style, ridgeOut, peakOut)
                        }
                        .padding(horizontal = 16.dp, vertical = 9.dp),
                ) { Text("✓ שמור", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold) }
            }
        }

        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 8.dp, vertical = 8.dp)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            HeadStyle.values().forEach { s -> Chip(s.he, s == style) { style = s } }
        }

        // ── תצוגת-חזית ────────────────────────────────────────────────
        Box(
            Modifier.fillMaxWidth().height(240.dp).padding(horizontal = 12.dp, vertical = 6.dp)
                .background(Color.White, RoundedCornerShape(12.dp))
                .border(1.dp, Muted.copy(alpha = 0.25f), RoundedCornerShape(12.dp)),
        ) {
            Canvas(Modifier.fillMaxSize().padding(20.dp)) {
                val maxH = max(profile.maxOf { it.y }, 1.0)
                val sx = (size.width / max(length, 1.0)).toFloat()
                val sy = (size.height / (maxH * 1.15)).toFloat()
                val y0 = size.height // רצפה בתחתית
                fun sp(p: WallBuilder.Pt) = Offset((p.x * sx).toFloat(), y0 - (p.y * sy).toFloat())

                // מילוי גוף-הקיר (חצי-אי = מקווקו-בהיר; אחרת מלא-בהיר)
                val body = Path().apply {
                    moveTo(sp(WallBuilder.Pt(0.0, 0.0)).x, sp(WallBuilder.Pt(0.0, 0.0)).y)
                    profile.forEach { lineTo(sp(it).x, sp(it).y) }
                    lineTo(sp(WallBuilder.Pt(length, 0.0)).x, sp(WallBuilder.Pt(length, 0.0)).y)
                    close()
                }
                val real = WallHeadProfile.isRealWall(style)
                drawPath(body, (if (real) Teal else WarnAmber).copy(alpha = 0.12f))

                // קצה-עליון (פרופיל-הראש)
                for (i in 0 until profile.size - 1) {
                    drawLine(if (real) Ink else WarnAmber, sp(profile[i]), sp(profile[i + 1]), strokeWidth = 4.dp.toPx(), cap = StrokeCap.Round)
                }
                // רצפה
                drawLine(Muted, Offset(0f, y0), Offset(size.width, y0), strokeWidth = 2.dp.toPx())
                // קצוות אנכיים
                drawLine(Ink, sp(WallBuilder.Pt(0.0, 0.0)), sp(profile.first()), strokeWidth = 3.dp.toPx())
                drawLine(Ink, sp(WallBuilder.Pt(length, 0.0)), sp(profile.last()), strokeWidth = 3.dp.toPx())
            }
        }

        // ── מידע מחושב ────────────────────────────────────────────────
        Text(
            "שטח-חזית ${(area / 1_000_000.0).let { (it * 100).roundToInt() / 100.0 }} מ\"ר · אורך-קצה ${Prefs.formatLen(edge)}" +
                if (!WallHeadProfile.isRealWall(style)) " · קיר-שקוף (לא נספר)" else "",
            fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Teal,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
        )

        // ── שדות ──────────────────────────────────────────────────────
        Column(Modifier.padding(horizontal = 12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                num("אורך-קיר (${Prefs.unitSuffix})", lengthTxt, { lengthTxt = it }, Modifier.weight(1f))
                num("גובה-בסיס (${Prefs.unitSuffix})", baseTxt, { baseTxt = it }, Modifier.weight(1f))
            }
            if (usesRidge) {
                Spacer(Modifier.height(6.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    num("גובה-רכס (${Prefs.unitSuffix})", ridgeTxt, { ridgeTxt = it }, Modifier.weight(1f))
                    if (usesPeak) num("מיקום-פסגה (${Prefs.unitSuffix})", peakTxt, { peakTxt = it }, Modifier.weight(1f))
                    else Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun num(label: String, value: String, onChange: (String) -> Unit, modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value, onValueChange = onChange,
        label = { Text(label, fontSize = 12.sp) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = modifier,
    )
}

@Composable
private fun Chip(label: String, on: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .background(if (on) Orange else Color.White, RoundedCornerShape(10.dp))
            .border(1.dp, if (on) Orange else Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 13.dp, vertical = 9.dp),
    ) { Text(label, color = if (on) Color.White else Ink, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
}
