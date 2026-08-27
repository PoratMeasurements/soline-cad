package il.co.soline.measure.ui.cad.symbols

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import il.co.soline.measure.catalog.CadSymbolDef
import il.co.soline.measure.catalog.CadSymbolShape
import il.co.soline.measure.catalog.CadSymbolView

/*
 * SymbolGlyphs — ציור-וקטורי לכל 25 סמלי-ה-CAD המובנים + חמש צורות-הבסיס המותאמות.
 *
 * המדריך (CVSM #f-elev-cadsymbol): "אותה ספריית 25 הסמלים כמו בתוכנית, הפעם עם ציור
 * החזית של כל סמל (למשל טלוויזיה מצוירת עם מסך ומעמד, לא הפרוסה השטוחה של התוכנית)."
 * לכן לכל סמל שתי תצוגות — [CadSymbolView.PLAN] (מבט-על) ו-[CadSymbolView.ELEVATION] (חזית).
 *
 * הציור נעשה בקואורדינטות-מנורמלות 0..1 בתוך תיבת-הסמל (עם ריפוד), כדי להיראות זהה
 * בכל גודל תצוגה-מקדימה. אין תלות במידות-מ"מ — אלה נשמרות ב-[CadSymbolDef] בנפרד.
 */

/** תצוגה-מקדימה חיה של סמל (מבט-על או חזית). */
@Composable
fun SymbolPreview(
    def: CadSymbolDef,
    view: CadSymbolView,
    tint: Color,
    modifier: Modifier = Modifier,
) {
    Canvas(modifier = modifier) { drawSymbol(def, view, tint) }
}

/** נקודת-הכניסה לציור סמל בתוך DrawScope כלשהו (תצוגה-מקדימה או, בהמשך, קנבס-השרטוט). */
fun DrawScope.drawSymbol(def: CadSymbolDef, view: CadSymbolView, color: Color) {
    val g = GlyphCtx(this, color)
    if (!def.builtin) { g.customShape(def.shape, view); return }
    when (def.key) {
        // ── מולטימדיה וחשמל ────────────────────────────────────────────────
        "SYM_TV" -> g.tv(view)
        "SYM_SPEAKER" -> g.speaker(view)
        "SYM_PROJECTOR" -> g.projector(view)
        "SYM_THERMOSTAT" -> g.thermostat()
        "SYM_INTERCOM" -> g.intercom()
        "SYM_SMOKE_DETECTOR" -> g.smokeDetector()
        "SYM_NETWORK_POINT" -> g.networkPoint()
        "SYM_CEILING_FAN" -> g.ceilingFan(view)
        // ── ריהוט ──────────────────────────────────────────────────────────
        "SYM_TABLE" -> g.table(view)
        "SYM_CHAIR" -> g.chair(view)
        "SYM_SOFA" -> g.sofa(view)
        "SYM_BED" -> g.bed(view)
        "SYM_DESK" -> g.desk(view)
        "SYM_WARDROBE" -> g.wardrobe(view)
        // ── מוצרי חשמל ואינסטלציה ──────────────────────────────────────────
        "SYM_WASHER" -> g.washer(view)
        "SYM_DRYER" -> g.dryer(view)
        "SYM_SHOWER" -> g.shower(view)
        "SYM_RADIATOR" -> g.radiator()
        "SYM_WATER_HEATER" -> g.waterHeater(view)
        "SYM_SINK" -> g.sink(view)
        // ── אלמנטים מבניים ────────────────────────────────────────────────
        "SYM_COLUMN" -> g.column(view)
        "SYM_STAIRS" -> g.stairs(view)
        "SYM_NICHE" -> g.niche(view)
        "SYM_VENT_SHAFT" -> g.ventShaft(view)
        "SYM_OPENING_MARK" -> g.openingMark()
        else -> g.customShape(CadSymbolShape.RECT, view)
    }
}

/**
 * הקשר-ציור פנימי — עוטף DrawScope בקואורדינטות-מנורמלות + פרימיטיבים נוחים.
 * כל הקואורדינטות ב-0..1 (0=משמאל/מלמעלה של תיבת-הסמל, אחרי ריפוד).
 */
private class GlyphCtx(private val d: DrawScope, private val c: Color) {
    private val w = d.size.width
    private val h = d.size.height
    private val pad = d.size.minDimension * 0.14f
    private val sw = (d.size.minDimension * 0.045f).coerceAtLeast(2f)

    private fun px(t: Float) = pad + t * (w - 2 * pad)
    private fun py(t: Float) = pad + t * (h - 2 * pad)

    private fun line(x1: Float, y1: Float, x2: Float, y2: Float, weight: Float = 1f) =
        d.drawLine(c, Offset(px(x1), py(y1)), Offset(px(x2), py(y2)), strokeWidth = sw * weight, cap = StrokeCap.Round)

    private fun rect(x1: Float, y1: Float, x2: Float, y2: Float, fill: Boolean = false, weight: Float = 1f) {
        val tl = Offset(px(x1), py(y1)); val sz = Size(px(x2) - px(x1), py(y2) - py(y1))
        if (fill) d.drawRect(c.copy(alpha = 0.22f), tl, sz)
        d.drawRect(c, tl, sz, style = Stroke(width = sw * weight))
    }

    private fun circle(cx: Float, cy: Float, r: Float, fill: Boolean = false, weight: Float = 1f) {
        val center = Offset(px(cx), py(cy)); val rr = r * (minOf(w, h) - 2 * pad)
        if (fill) d.drawCircle(c.copy(alpha = 0.22f), rr, center)
        d.drawCircle(c, rr, center, style = Stroke(width = sw * weight))
    }

    private fun dot(cx: Float, cy: Float, r: Float = 0.05f) =
        d.drawCircle(c, r * (minOf(w, h) - 2 * pad), Offset(px(cx), py(cy)))

    private fun poly(pts: List<Pair<Float, Float>>, close: Boolean = true, fill: Boolean = false) {
        val p = Path()
        pts.forEachIndexed { i, (x, y) -> if (i == 0) p.moveTo(px(x), py(y)) else p.lineTo(px(x), py(y)) }
        if (close) p.close()
        if (fill) d.drawPath(p, c.copy(alpha = 0.22f))
        d.drawPath(p, c, style = Stroke(width = sw))
    }

    private fun floor() = line(-0.05f, 1f, 1.05f, 1f, 1.2f) // קו-רצפה לחזיתות

    // ── מולטימדיה וחשמל ────────────────────────────────────────────────────
    fun tv(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) { rect(0f, 0.42f, 1f, 0.58f, fill = true); line(0.5f, 0.58f, 0.5f, 0.72f) }
        else { rect(0.08f, 0.05f, 0.92f, 0.62f, fill = true); line(0.5f, 0.62f, 0.5f, 0.82f); line(0.32f, 0.82f, 0.68f, 0.82f, 1.2f); floor() }
    }

    fun speaker(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) { rect(0.28f, 0.15f, 0.72f, 0.85f); circle(0.5f, 0.5f, 0.16f) }
        else { rect(0.28f, 0.05f, 0.72f, 0.95f); circle(0.5f, 0.34f, 0.16f); circle(0.5f, 0.7f, 0.09f); floor() }
    }

    fun projector(v: CadSymbolView) {
        rect(0.1f, 0.3f, 0.6f, 0.7f, fill = true)
        circle(0.6f, 0.5f, 0.08f)
        poly(listOf(0.6f to 0.5f, 0.95f to 0.28f, 0.95f to 0.72f), close = false)
        if (v == CadSymbolView.ELEVATION) floor()
    }

    fun thermostat() { rect(0.22f, 0.22f, 0.78f, 0.78f); circle(0.5f, 0.5f, 0.16f); dot(0.5f, 0.5f, 0.035f) }

    fun intercom() {
        rect(0.28f, 0.1f, 0.72f, 0.9f)
        rect(0.36f, 0.18f, 0.64f, 0.5f, fill = true) // מסך
        dot(0.44f, 0.66f, 0.045f); dot(0.56f, 0.66f, 0.045f); dot(0.5f, 0.8f, 0.045f)
    }

    fun smokeDetector() { circle(0.5f, 0.5f, 0.42f); circle(0.5f, 0.5f, 0.24f); dot(0.5f, 0.5f, 0.05f) }

    fun networkPoint() {
        rect(0.2f, 0.2f, 0.8f, 0.8f)
        poly(listOf(0.36f to 0.5f, 0.5f to 0.66f, 0.64f to 0.5f, 0.64f to 0.36f, 0.36f to 0.36f), close = true)
    }

    fun ceilingFan(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) {
            circle(0.5f, 0.5f, 0.1f)
            val blades = listOf(0.5f to 0.05f, 0.95f to 0.5f, 0.5f to 0.95f, 0.05f to 0.5f)
            for (b in blades) line(0.5f, 0.5f, b.first, b.second, 1.2f)
            for (b in blades) circle(b.first, b.second, 0.06f)
        } else {
            line(0.5f, 0.05f, 0.5f, 0.3f, 1.2f) // מוט-תלייה
            circle(0.5f, 0.36f, 0.09f)
            line(0.1f, 0.45f, 0.9f, 0.45f, 1.2f) // להבים לרוחב
            line(0.1f, 0.45f, 0.05f, 0.52f); line(0.9f, 0.45f, 0.95f, 0.52f)
        }
    }

    // ── ריהוט ──────────────────────────────────────────────────────────────
    fun table(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) rect(0.1f, 0.2f, 0.9f, 0.8f, fill = true)
        else { line(0.08f, 0.35f, 0.92f, 0.35f, 1.4f); line(0.2f, 0.35f, 0.2f, 1f); line(0.8f, 0.35f, 0.8f, 1f); floor() }
    }

    fun chair(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) { rect(0.28f, 0.3f, 0.72f, 0.75f, fill = true); line(0.28f, 0.3f, 0.72f, 0.3f, 1.4f) }
        else { line(0.32f, 0.1f, 0.32f, 0.55f, 1.2f); line(0.32f, 0.55f, 0.72f, 0.55f, 1.4f); line(0.36f, 0.55f, 0.36f, 1f); line(0.68f, 0.55f, 0.68f, 1f); floor() }
    }

    fun sofa(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) {
            rect(0.08f, 0.15f, 0.92f, 0.85f)
            rect(0.08f, 0.15f, 0.92f, 0.32f, fill = true) // גב
            line(0.24f, 0.32f, 0.24f, 0.85f); line(0.76f, 0.32f, 0.76f, 0.85f)
        } else {
            rect(0.08f, 0.4f, 0.92f, 0.9f, fill = true)      // מושב
            rect(0.08f, 0.15f, 0.22f, 0.9f)                   // משענת-יד
            rect(0.78f, 0.15f, 0.92f, 0.9f)
            line(0.22f, 0.3f, 0.78f, 0.3f, 1.2f); floor()
        }
    }

    fun bed(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) {
            rect(0.15f, 0.08f, 0.85f, 0.92f)
            rect(0.15f, 0.08f, 0.85f, 0.2f, fill = true) // ראש-מיטה
            rect(0.22f, 0.24f, 0.48f, 0.42f); rect(0.52f, 0.24f, 0.78f, 0.42f) // כריות
        } else {
            rect(0.1f, 0.5f, 0.9f, 0.85f, fill = true) // מזרן
            rect(0.1f, 0.25f, 0.22f, 0.85f)             // ראש-מיטה
            line(0.85f, 0.5f, 0.9f, 0.5f); floor()
        }
    }

    fun desk(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) { rect(0.08f, 0.25f, 0.92f, 0.75f, fill = true); rect(0.62f, 0.3f, 0.88f, 0.7f) }
        else { line(0.08f, 0.35f, 0.92f, 0.35f, 1.4f); rect(0.62f, 0.35f, 0.9f, 1f); line(0.15f, 0.35f, 0.15f, 1f); floor() }
    }

    fun wardrobe(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) { rect(0.15f, 0.35f, 0.85f, 0.65f, fill = true); line(0.5f, 0.35f, 0.5f, 0.65f) }
        else {
            rect(0.18f, 0.06f, 0.82f, 0.98f); line(0.5f, 0.06f, 0.5f, 0.98f)
            dot(0.44f, 0.52f, 0.03f); dot(0.56f, 0.52f, 0.03f); floor()
        }
    }

    // ── מוצרי חשמל ואינסטלציה ───────────────────────────────────────────────
    fun washer(v: CadSymbolView) {
        rect(0.18f, if (v == CadSymbolView.PLAN) 0.18f else 0.08f, 0.82f, if (v == CadSymbolView.PLAN) 0.82f else 0.98f)
        if (v == CadSymbolView.PLAN) circle(0.5f, 0.5f, 0.2f) else { circle(0.5f, 0.58f, 0.22f); line(0.24f, 0.2f, 0.76f, 0.2f); floor() }
    }

    fun dryer(v: CadSymbolView) {
        washer(v)
        // סימון-ייבוש: עיגול-פנימי מקווקו
        val r = 0.12f * (minOf(w, h) - 2 * pad)
        val cy = if (v == CadSymbolView.PLAN) 0.5f else 0.58f
        d.drawCircle(c, r, Offset(px(0.5f), py(cy)), style = Stroke(width = sw, pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 6f), 0f)))
    }

    fun shower(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) { rect(0.12f, 0.12f, 0.88f, 0.88f); line(0.12f, 0.12f, 0.88f, 0.88f); circle(0.72f, 0.72f, 0.07f) }
        else {
            rect(0.12f, 0.06f, 0.88f, 0.98f)
            line(0.5f, 0.06f, 0.5f, 0.22f, 1.2f); circle(0.5f, 0.24f, 0.06f)
            for (i in 0..3) line(0.42f + i * 0.05f, 0.3f, 0.42f + i * 0.05f, 0.5f)
            floor()
        }
    }

    fun radiator() {
        rect(0.1f, 0.28f, 0.9f, 0.72f)
        for (i in 1..6) line(0.1f + i * 0.114f, 0.28f, 0.1f + i * 0.114f, 0.72f)
    }

    fun waterHeater(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) { circle(0.5f, 0.5f, 0.4f); circle(0.5f, 0.5f, 0.1f) }
        else { rect(0.28f, 0.1f, 0.72f, 0.95f); line(0.28f, 0.24f, 0.72f, 0.24f); line(0.5f, 0.95f, 0.5f, 1f); dot(0.5f, 0.6f, 0.04f); floor() }
    }

    fun sink(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) { rect(0.15f, 0.25f, 0.85f, 0.85f); rect(0.24f, 0.4f, 0.76f, 0.78f, fill = true); circle(0.5f, 0.16f, 0.06f); dot(0.5f, 0.6f, 0.035f) }
        else { poly(listOf(0.15f to 0.5f, 0.85f to 0.5f, 0.72f to 0.85f, 0.28f to 0.85f), fill = true); line(0.5f, 0.2f, 0.5f, 0.5f, 1.2f); poly(listOf(0.5f to 0.2f, 0.66f to 0.2f, 0.66f to 0.3f), close = false); floor() }
    }

    // ── אלמנטים מבניים ──────────────────────────────────────────────────────
    fun column(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) { rect(0.25f, 0.25f, 0.75f, 0.75f, fill = true); line(0.25f, 0.25f, 0.75f, 0.75f); line(0.75f, 0.25f, 0.25f, 0.75f) }
        else { rect(0.32f, 0.12f, 0.68f, 0.9f, fill = true); rect(0.24f, 0.02f, 0.76f, 0.12f); rect(0.24f, 0.9f, 0.76f, 1f); floor() }
    }

    fun stairs(v: CadSymbolView) {
        if (v == CadSymbolView.PLAN) {
            rect(0.15f, 0.1f, 0.85f, 0.9f)
            for (i in 1..6) line(0.15f, 0.1f + i * 0.114f, 0.85f, 0.1f + i * 0.114f)
            poly(listOf(0.4f to 0.7f, 0.5f to 0.55f, 0.6f to 0.7f), close = false)
            line(0.5f, 0.55f, 0.5f, 0.85f, 1.2f)
        } else {
            val p = Path(); p.moveTo(px(0.1f), py(1f))
            for (i in 0..4) { p.lineTo(px(0.1f + i * 0.16f), py(0.85f - i * 0.17f)); p.lineTo(px(0.26f + i * 0.16f), py(0.85f - i * 0.17f)) }
            d.drawPath(p, c, style = Stroke(width = sw)); floor()
        }
    }

    fun niche(v: CadSymbolView) {
        rect(0.1f, 0.15f, 0.9f, 0.85f)
        if (v == CadSymbolView.PLAN) rect(0.24f, 0.15f, 0.76f, 0.62f, fill = true)
        else { rect(0.26f, 0.3f, 0.74f, 0.85f, fill = true); floor() }
    }

    fun ventShaft(v: CadSymbolView) {
        rect(0.15f, 0.15f, 0.85f, 0.85f)
        if (v == CadSymbolView.PLAN) { line(0.15f, 0.15f, 0.85f, 0.85f); line(0.85f, 0.15f, 0.15f, 0.85f); circle(0.5f, 0.5f, 0.08f) }
        else { for (i in 1..4) line(0.15f, 0.15f + i * 0.14f, 0.85f, 0.15f + i * 0.14f); floor() }
    }

    fun openingMark() {
        // מלבן-מקווקו עם X — סימון-פתח (זהה בתוכנית ובחזית)
        val stroke = Stroke(width = sw, pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 7f), 0f))
        d.drawRect(c, Offset(px(0.12f), py(0.12f)), Size(px(0.88f) - px(0.12f), py(0.88f) - py(0.12f)), style = stroke)
        line(0.12f, 0.12f, 0.88f, 0.88f); line(0.88f, 0.12f, 0.12f, 0.88f)
    }

    // ── צורות-בסיס לסמל מותאם-אישית ─────────────────────────────────────────
    fun customShape(shape: CadSymbolShape, v: CadSymbolView) {
        when (shape) {
            CadSymbolShape.CIRCLE -> circle(0.5f, 0.5f, 0.4f, fill = true)
            CadSymbolShape.TRIANGLE -> poly(listOf(0.5f to 0.12f, 0.9f to 0.85f, 0.1f to 0.85f), fill = true)
            CadSymbolShape.RHOMBUS -> poly(listOf(0.5f to 0.1f, 0.9f to 0.5f, 0.5f to 0.9f, 0.1f to 0.5f), fill = true)
            CadSymbolShape.ROUNDED_RECT -> {
                d.drawRoundRect(
                    c.copy(alpha = 0.22f), Offset(px(0.12f), py(0.25f)), Size(px(0.88f) - px(0.12f), py(0.75f) - py(0.25f)),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(pad, pad),
                )
                d.drawRoundRect(
                    c, Offset(px(0.12f), py(0.25f)), Size(px(0.88f) - px(0.12f), py(0.75f) - py(0.25f)),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(pad, pad), style = Stroke(width = sw),
                )
            }
            else -> rect(0.12f, 0.25f, 0.88f, 0.75f, fill = true) // RECT / BUILTIN-fallback
        }
        if (v == CadSymbolView.ELEVATION) floor()
    }
}
