package il.co.soline.measure.ui.template

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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.geometry.RoomTemplates
import il.co.soline.measure.geometry.WallBuilder
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/* ─────────────────────────────────────────────────────────────────────────────
 *  RoomTemplateWizard — אשף-תבניות-החדר (CVSM `#f-plan-wizard` + `#f-plan-box`).
 *
 *  בוחרים צורה (מלבן/L/U/T/Z), ממלאים מידות, ורואים תצוגה-מקדימה חיה של המתאר.
 *  "צור קירות" מייצר את כל הקירות בבת-אחת (כל הפינות 90°, המתאר סגור), בדיוק
 *  כמו "צור קירות" של CVSM. שיקוף (mirror) וקיר-התחלה (סובב) נתמכים.
 * ───────────────────────────────────────────────────────────────────────────── */

private data class Field(val label: String, val key: String, val default: Int)

private fun fieldsFor(t: RoomTemplates.Template): List<Field> = when (t) {
    RoomTemplates.Template.RECTANGLE -> listOf(
        Field("רוחב W (${Prefs.unitSuffix})", "w", 4000),
        Field("עומק H (${Prefs.unitSuffix})", "h", 3000),
    )
    RoomTemplates.Template.L -> listOf(
        Field("רוחב חיצוני W", "w", 4000),
        Field("עומק חיצוני H", "h", 3000),
        Field("רוחב-חתך", "cw", 1500),
        Field("גובה-חתך", "ch", 1200),
    )
    RoomTemplates.Template.U -> listOf(
        Field("רוחב W", "w", 5000),
        Field("עומק H", "h", 3500),
        Field("זרוע שמאל", "a", 1200),
        Field("זרוע ימין", "b", 1200),
        Field("עומק-מגרעת", "d", 2000),
    )
    RoomTemplates.Template.T -> listOf(
        Field("רוחב W", "w", 4500),
        Field("עומק H", "h", 3500),
        Field("רוחב-רגל", "stem", 1600),
        Field("גובה-פס", "bar", 1200),
    )
    RoomTemplates.Template.Z -> listOf(
        Field("רוחב-תחתון w1", "w1", 3000),
        Field("גובה-תחתון h1", "h1", 1800),
        Field("רוחב-עליון w2", "w2", 3000),
        Field("גובה-עליון h2", "h2", 1800),
        Field("היסט מדרגה", "off", 1500),
    )
}

private fun buildVerts(t: RoomTemplates.Template, v: Map<String, Double>): List<WallBuilder.Pt> {
    fun g(k: String, d: Double) = v[k] ?: d
    return when (t) {
        RoomTemplates.Template.RECTANGLE -> RoomTemplates.rectangleVerts(g("w", 4000.0), g("h", 3000.0))
        RoomTemplates.Template.L -> RoomTemplates.lVerts(g("w", 4000.0), g("h", 3000.0), g("cw", 1500.0), g("ch", 1200.0))
        RoomTemplates.Template.U -> RoomTemplates.uVerts(g("w", 5000.0), g("h", 3500.0), g("a", 1200.0), g("b", 1200.0), g("d", 2000.0))
        RoomTemplates.Template.T -> RoomTemplates.tVerts(g("w", 4500.0), g("h", 3500.0), g("stem", 1600.0), g("bar", 1200.0))
        RoomTemplates.Template.Z -> RoomTemplates.zVerts(g("w1", 3000.0), g("h1", 1800.0), g("w2", 3000.0), g("h2", 1800.0), g("off", 1500.0))
    }
}

/**
 * אשף-תבניות-חדר.
 * @param defaultHeightMm גובה-הקירות שיוקצה לכל קיר-שנוצר.
 * @param onCreate        נקרא עם רשימת-הקירות שנוצרו (על ה-host להתמיד ב-repo).
 * @param onBack          חזרה.
 */
@Composable
fun RoomTemplateWizard(
    defaultHeightMm: Double,
    onCreate: (List<WallEntity>) -> Unit,
    onBack: () -> Unit,
) {
    var template by remember { mutableStateOf(RoomTemplates.Template.RECTANGLE) }
    var mirror by remember { mutableStateOf(false) }
    var startWall by remember { mutableStateOf(0) }

    // ערכי-שדות פר-צורה (טקסט חופשי; ברירות-מחדל מ-fieldsFor)
    val values = remember { mutableStateMapOf<String, String>() }
    val fields = fieldsFor(template)
    // ודא ברירות-מחדל לשדות שטרם הוזנו
    fields.forEach { f -> if (values[f.key] == null) values[f.key] = Prefs.toDisplayText(f.default.toDouble()) }

    // הקלט מוזן ביחידת-התצוגה → מומר למ"מ לבניית-הגיאומטריה.
    val parsed: Map<String, Double> = fields.associate { it.key to (Prefs.parseToMm(values[it.key] ?: "") ?: it.default.toDouble()) }
    val verts = remember(template, parsed) { buildVerts(template, parsed) }
    val walls = remember(template, parsed, mirror, startWall) {
        RoomTemplates.fromClosedPolygon(verts, heightMm = defaultHeightMm, mirror = mirror, startWall = startWall)
    }
    val previewPts = remember(walls) { WallBuilder.layout(walls) }

    Column(Modifier.fillMaxSize().background(Cream)) {
        // ── כותרת ─────────────────────────────────────────────────────
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
            Spacer(Modifier.width(4.dp))
            Column {
                Text("אשף תבניות חדר", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Orange)
                Text("מלבן · L · U · T · Z — פינות 90°, נסגר אוטומטית", fontSize = 12.sp, color = Teal)
            }
        }

        // ── בורר-צורה ─────────────────────────────────────────────────
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 8.dp, vertical = 8.dp)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            RoomTemplates.Template.values().forEach { t ->
                ShapeChip(t.he, t == template) { template = t; startWall = 0 }
            }
        }

        // ── תצוגה-מקדימה ─────────────────────────────────────────────
        Box(
            Modifier.fillMaxWidth().height(220.dp).padding(horizontal = 12.dp, vertical = 6.dp)
                .background(Color.White, RoundedCornerShape(12.dp))
                .border(1.dp, Muted.copy(alpha = 0.25f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            if (previewPts.size < 2) {
                Text("מלא מידות תקינות כדי לראות תצוגה.", color = Muted, fontSize = 14.sp)
            } else {
                Canvas(Modifier.fillMaxSize().padding(20.dp)) {
                    val (cx, cy, scale) = fitBox(previewPts, size.width, size.height)
                    fun sp(p: WallBuilder.Pt) = Offset(
                        ((p.x - cx) * scale + size.width / 2f).toFloat(),
                        // הפוך את ציר-Y כדי שהחדר יוצג "כלפי-מעלה" בתצוגה
                        (-(p.y - cy) * scale + size.height / 2f).toFloat(),
                    )
                    for (i in 0 until previewPts.size - 1) {
                        drawLine(Ink, sp(previewPts[i]), sp(previewPts[i + 1]), strokeWidth = 4.dp.toPx(), cap = StrokeCap.Round)
                    }
                    previewPts.forEach { drawCircle(Orange, 3.5.dp.toPx(), sp(it)) }
                }
            }
        }

        // ── מידות + אפשרויות (גלילה) ─────────────────────────────────
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())
                .padding(horizontal = 12.dp),
        ) {
            Text(
                "${walls.size} קירות · היקף ${Prefs.formatLen(perimeter(walls))}",
                fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Teal,
                modifier = Modifier.padding(vertical = 6.dp),
            )
            fields.chunked(2).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { f ->
                        OutlinedTextField(
                            value = values[f.key] ?: "",
                            onValueChange = { values[f.key] = it },
                            label = { Text(f.label, fontSize = 12.sp) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
                Spacer(Modifier.height(6.dp))
            }

            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                ShapeChip(if (mirror) "שיקוף ✓" else "שיקוף", mirror) { mirror = !mirror }
                Spacer(Modifier.width(10.dp))
                Text("קיר-התחלה:", fontSize = 13.sp, color = Ink)
                Spacer(Modifier.width(6.dp))
                StepPill("−") { if (walls.isNotEmpty()) startWall = (startWall - 1 + walls.size) % walls.size }
                Text(" ${startWall + 1} ", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Ink)
                StepPill("+") { if (walls.isNotEmpty()) startWall = (startWall + 1) % walls.size }
            }
            Spacer(Modifier.height(10.dp))
        }

        // ── צור קירות ─────────────────────────────────────────────────
        Button(
            onClick = { if (walls.size >= 3) onCreate(walls) },
            enabled = walls.size >= 3,
            colors = ButtonDefaults.buttonColors(containerColor = OkGreen, contentColor = Color.White),
            modifier = Modifier.fillMaxWidth().padding(12.dp),
        ) { Text("צור קירות", fontWeight = FontWeight.Bold, fontSize = 16.sp) }
    }
}

/* ─── עזרי-UI ───────────────────────────────────────────────────────────────── */

@Composable
private fun ShapeChip(label: String, on: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .background(if (on) Orange else Color.White, RoundedCornerShape(10.dp))
            .border(1.dp, if (on) Orange else Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 9.dp),
    ) { Text(label, color = if (on) Color.White else Ink, fontSize = 13.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) }
}

@Composable
private fun StepPill(label: String, onClick: () -> Unit) {
    Box(
        Modifier
            .background(Color.White, RoundedCornerShape(8.dp))
            .border(1.dp, Muted.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) { Text(label, color = Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold) }
}

private fun perimeter(walls: List<WallEntity>): Double = walls.sumOf { it.length }

/** מרכז-bbox (cx,cy) + סקאלה שממלאת [w]×[h]. */
private fun fitBox(pts: List<WallBuilder.Pt>, w: Float, h: Float): Triple<Double, Double, Double> {
    if (pts.isEmpty()) return Triple(0.0, 0.0, 1.0)
    var minX = Double.MAX_VALUE; var minY = Double.MAX_VALUE
    var maxX = -Double.MAX_VALUE; var maxY = -Double.MAX_VALUE
    for (p in pts) { minX = min(minX, p.x); minY = min(minY, p.y); maxX = max(maxX, p.x); maxY = max(maxY, p.y) }
    val spanX = max(maxX - minX, 1.0); val spanY = max(maxY - minY, 1.0)
    val scale = min(w / spanX, h / spanY).let { if (it.isFinite() && it > 0.0) it else 1.0 }
    return Triple((minX + maxX) / 2.0, (minY + maxY) / 2.0, scale)
}
