package il.co.soline.measure.geometry

import il.co.soline.measure.geometry.WallBuilder.Pt
import kotlin.math.sqrt

/**
 * סגנון-ראש-קיר (Wall head styles) — פורט מ-CVSM ("RoomMeasure"), כרטיס
 * `#f-wall-topstyle` (פאנל-מאפייני-קיר, ניתן-לעריכה גם מכרטיס-החזית `#f-elev-info`).
 *
 * חמשת-הסגנונות של CVSM לקצה-העליון של קיר בתצוגת-חזית:
 *  - ישר (רגיל) — קצה שטוח בגובה-הקיר.
 *  - משופע-שמאל / משופע-ימין — שיפוע-יחיד (רכס בצד אחד).
 *  - גמלון (קתדרלה) — פסגה עם שני-שיפועים.
 *  - קיר שקוף (חצי-אי) — קו-וירטואלי בתוכנית, **אינו נספר כקיר-אמיתי**.
 *
 * הסגנונות המשופעים/גמלון חושפים שני-פרמטרים: **גובה-רכס** (ridgeHeight) ו-
 * **מיקום-פסגה** (peakPosition לאורך-הקיר). האובייקט מחשב את **פרופיל-הקצה-העליון**
 * כ-polyline (x לאורך-הקיר 0..length, y=גובה), לשימוש בתצוגת-החזית/תלת-מימד.
 *
 * אובייקט Kotlin טהור (בלי Android/Compose).
 */
object WallHeadProfile {

    /** סגנון-ראש-הקיר. */
    enum class HeadStyle(val he: String) {
        STRAIGHT("ישר (רגיל)"),
        SLOPE_LEFT("משופע שמאל"),
        SLOPE_RIGHT("משופע ימין"),
        GABLE("גמלון (קתדרלה)"),
        PENINSULA("קיר שקוף (חצי-אי)"),
    }

    /**
     * מפרט-ראש-קיר.
     * @param style         הסגנון.
     * @param baseHeightMm  גובה-הקיר הבסיסי (הצד-הנמוך/השטוח).
     * @param ridgeHeightMm גובה-הרכס/הפסגה (למשופע/גמלון). נחסם ≥ baseHeight.
     * @param peakPosMm     מיקום-הפסגה לאורך-הקיר (לגמלון); מוגבל ל-[0,length].
     */
    data class HeadSpec(
        val style: HeadStyle,
        val baseHeightMm: Double,
        val ridgeHeightMm: Double = baseHeightMm,
        val peakPosMm: Double = 0.0,
    )

    /** האם הסגנון מייצג קיר-אמיתי (חצי-אי = לא נספר). */
    fun isRealWall(style: HeadStyle): Boolean = style != HeadStyle.PENINSULA

    /**
     * פרופיל-הקצה-העליון של הקיר כ-polyline (מ"מ). x גדל משמאל (0) לימין
     * ([lengthMm]); y = גובה-הקצה באותה נקודה.
     *
     * - STRAIGHT / PENINSULA → קו שטוח בגובה-הבסיס.
     * - SLOPE_LEFT → רכס בקצה-שמאל, יורד לבסיס בקצה-ימין.
     * - SLOPE_RIGHT → בסיס בקצה-שמאל, עולה לרכס בקצה-ימין.
     * - GABLE → בסיס בשני-הקצוות, פסגה (רכס) ב-[HeadSpec.peakPosMm].
     */
    fun profile(lengthMm: Double, spec: HeadSpec): List<Pt> {
        val len = lengthMm.coerceAtLeast(1.0)
        val base = spec.baseHeightMm
        val ridge = maxOf(spec.ridgeHeightMm, base)
        return when (spec.style) {
            HeadStyle.STRAIGHT, HeadStyle.PENINSULA ->
                listOf(Pt(0.0, base), Pt(len, base))
            HeadStyle.SLOPE_LEFT ->
                listOf(Pt(0.0, ridge), Pt(len, base))
            HeadStyle.SLOPE_RIGHT ->
                listOf(Pt(0.0, base), Pt(len, ridge))
            HeadStyle.GABLE -> {
                val peak = spec.peakPosMm.coerceIn(0.0, len)
                listOf(Pt(0.0, base), Pt(peak, ridge), Pt(len, base))
            }
        }
    }

    /**
     * שטח-החזית של הקיר (מ"מ²) לפי הפרופיל — עוזר לאומדן-חומר/צביעה.
     * מחושב כאינטגרל-טרפז מתחת ל-polyline (מהרצפה y=0).
     */
    fun frontAreaMm2(lengthMm: Double, spec: HeadSpec): Double {
        val p = profile(lengthMm.coerceAtLeast(1.0), spec)
        var area = 0.0
        for (i in 0 until p.size - 1) {
            val a = p[i]; val b = p[i + 1]
            area += (a.y + b.y) / 2.0 * (b.x - a.x)
        }
        return area
    }

    /** גובה-הקצה בנקודה [x] לאורך-הקיר (אינטרפולציה ליניארית על-הפרופיל). */
    fun heightAt(x: Double, lengthMm: Double, spec: HeadSpec): Double {
        val p = profile(lengthMm.coerceAtLeast(1.0), spec)
        val xx = x.coerceIn(0.0, lengthMm)
        for (i in 0 until p.size - 1) {
            val a = p[i]; val b = p[i + 1]
            if (xx in a.x..b.x && b.x > a.x) {
                val t = (xx - a.x) / (b.x - a.x)
                return a.y + t * (b.y - a.y)
            }
        }
        return p.last().y
    }

    /** אורך-הקצה-המשופע (אלכסון) בין שני קטעי-פרופיל — עזר לחיתוך-לוחות. */
    fun edgeLength(lengthMm: Double, spec: HeadSpec): Double {
        val p = profile(lengthMm.coerceAtLeast(1.0), spec)
        var total = 0.0
        for (i in 0 until p.size - 1) {
            val dx = p[i + 1].x - p[i].x
            val dy = p[i + 1].y - p[i].y
            total += sqrt(dx * dx + dy * dy)
        }
        return total
    }
}
