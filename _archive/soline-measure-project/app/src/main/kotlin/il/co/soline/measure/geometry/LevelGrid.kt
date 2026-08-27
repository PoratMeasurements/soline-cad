package il.co.soline.measure.geometry

import il.co.soline.measure.data.WallEntity
import kotlin.math.hypot

/**
 * מחולל רשת-נקודות לסקר-מישוריות (רצפה/תקרה).
 *
 * לוקח את מתאר-החדר (מ-[WallBuilder.layout]), מזיז אותו פנימה במרחק-היסט קבוע
 * מהקיר, ודוגם עליו נקודה כל [spacingMm] (ברירת-מחדל 600 מ"מ = 60 ס"מ) —
 * "כל 60 ס"מ סמוך לקיר ובמרחק שנגדיר מראש" (Michael).
 */
object LevelGrid {

    /** נקודת-רשת: סדר + מיקום בתוכנית (מ"מ). */
    data class GridPt(val idx: Int, val x: Double, val y: Double)

    /**
     * @param walls     קירות-החדר (מסודרים).
     * @param offsetMm  מרחק-ההיסט פנימה מהקיר (מ"מ) — "במרחק שנגדיר מראש".
     * @param spacingMm מרווח בין נקודות לאורך הקיר (מ"מ, ברירת-מחדל 600).
     */
    fun generate(walls: List<WallEntity>, offsetMm: Double, spacingMm: Double = 600.0): List<GridPt> {
        val outline = WallBuilder.layout(walls)
        if (outline.size < 2 || spacingMm <= 0.0) return emptyList()
        // כיוון-ההזזה: offset חיובי ב-WallBuilder = פנימה עבור מתאר-CCW (שטח חתום חיובי).
        // עבור מתאר-CW נהפוך את הסימן כדי להישאר בתוך החדר.
        val inward = if (signedArea(outline) >= 0.0) offsetMm else -offsetMm
        val ring = WallBuilder.offset(outline, inward)
        return sampleAlong(ring, spacingMm)
    }

    /** דוגם נקודה כל [stepMm] לאורך ה-polyline (כולל נקודת-ההתחלה). */
    private fun sampleAlong(pts: List<WallBuilder.Pt>, stepMm: Double): List<GridPt> {
        val out = ArrayList<GridPt>()
        if (pts.size < 2) return out
        var carry = 0.0   // מרחק שנותר עד הדגימה הבאה
        var idx = 0
        // נקודת-התחלה תמיד נדגמת
        out.add(GridPt(idx++, pts[0].x, pts[0].y))
        for (i in 0 until pts.size - 1) {
            val a = pts[i]
            val b = pts[i + 1]
            val segLen = hypot(b.x - a.x, b.y - a.y)
            if (segLen < 1e-9) continue
            val dx = (b.x - a.x) / segLen
            val dy = (b.y - a.y) / segLen
            var d = stepMm - carry
            while (d <= segLen) {
                out.add(GridPt(idx++, a.x + dx * d, a.y + dy * d))
                d += stepMm
            }
            carry = (carry + segLen) % stepMm
        }
        return out
    }

    /** שטח-חתום של ה-polygon (חיובי = CCW). */
    private fun signedArea(pts: List<WallBuilder.Pt>): Double {
        var s = 0.0
        for (i in 0 until pts.size - 1) {
            s += pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y
        }
        return s / 2.0
    }
}
