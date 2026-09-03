package il.co.soline.measure.geometry

import il.co.soline.measure.geometry.WallBuilder.Pt
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/**
 * קיר-קשת (Arc wall) — קשת מוגדרת ע"י **3 נקודות** (התחלה, אמצע, סוף) שמהן
 * נגזר המעגל; אין פרמטר-רדיוס/בליטה מפורש.
 *
 * מכיוון שמודל-הקירות של Soline הוא שרשרת-קטעים-ישרים ([WallBuilder]), קשת
 * מיוצגת כ-K קטעים-ישרים קצרים (פוליגוניזציה של הקשת). האובייקט מספק:
 *
 *  1. [circleFrom3Points] / [arcThrough3Points] — הדרך ה"נאמנה" (3 נק'
 *     מוחלטות, לזרימת-לייזר-תלת-ממד עתידית).
 *  2. [arcChain] — בונה-שרשרת לזרימת-ההוספה היחסית של השרטוט-החי: הקשת מוגדרת
 *     ע"י **מיתר** (chord) + **בליטה/שקיעה** (sagitta = גובה-הקשת מעל-המיתר) + צד,
 *     שהם שקולים ל-3 נקודות (שני קצות-המיתר + הקודקוד). מוחזרת [ArcChain] עם
 *     זווית-כניסה (לעדכון הקיר-הקודם, משיק) ורשימת-קטעים להוספה.
 *
 * הערה: קיר-קשת **מסרב לחיבור-T** — הגאומטריה של קשת לא
 * תומכת בהצמדה. הקטעים שנוצרים כאן הם קירות-רגילים לצורך פריסה/ייצוא, אך אין
 * להריץ עליהם חיבור-T אוטומטי.
 *
 * אובייקט Kotlin טהור (בלי Android/Compose).
 */
object ArcWall {

    private const val EPS = 1e-9

    /** מעגל (מרכז + רדיוס), במ"מ. */
    data class Circle(val cx: Double, val cy: Double, val r: Double)

    /** קטע-קשת בשרשרת: אורך + זווית-פנייה אל הקטע-הבא (מוסכמת [WallBuilder]). */
    data class Segment(val lengthMm: Double, val turnToNextDeg: Double)

    /**
     * תוצאת-בניית-קשת לשרשרת.
     * @param incomingTurnDeg זווית-הפנייה שיש להוסיף לקיר-הקודם כדי להיכנס משיקית
     *                        לקשת (0 אם אין קיר-קודם).
     * @param segments        הקטעים-הישרים המרכיבים את הקשת, לפי הסדר.
     */
    data class ArcChain(val incomingTurnDeg: Double, val segments: List<Segment>)

    // ------------------------------------------------------------------
    // הדרך הנאמנה — מעגל/קשת דרך 3 נקודות
    // ------------------------------------------------------------------

    /**
     * מעגל העובר דרך שלוש נקודות. מחזיר null אם הנקודות קוליניאריות (בקירוב).
     */
    fun circleFrom3Points(a: Pt, b: Pt, c: Pt): Circle? {
        val d = 2.0 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
        if (abs(d) < EPS) return null
        val a2 = a.x * a.x + a.y * a.y
        val b2 = b.x * b.x + b.y * b.y
        val c2 = c.x * c.x + c.y * c.y
        val ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d
        val uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d
        return Circle(ux, uy, hypot(a.x - ux, a.y - uy))
    }

    /**
     * מפוליגן קשת שעוברת דרך [a]→[b]→[c] ל-[segments]+1 קודקודים (כולל a ו-c).
     * הכיוון (CW/CCW) והתחום נקבעים כך שהקשת אכן חולפת דרך נקודת-האמצע [b].
     * אם הנקודות קוליניאריות — מוחזר קו-ישר [a,c].
     *
     * @param segments מספר-הקטעים (>=1); נחסם ל-[2,64] בפועל לקשת אמיתית.
     */
    fun arcThrough3Points(a: Pt, b: Pt, c: Pt, segments: Int = 12): List<Pt> {
        val circle = circleFrom3Points(a, b, c) ?: return listOf(a, c)
        val k = segments.coerceIn(1, 64)
        val a0 = atan2(a.y - circle.cy, a.x - circle.cx)
        val a1raw = atan2(c.y - circle.cy, c.x - circle.cx)
        val aMid = atan2(b.y - circle.cy, b.x - circle.cx)

        // בחר את הכיוון (CCW חיובי) שבו a→c עובר דרך b.
        var sweep = a1raw - a0
        // נרמל ל-(-2π, 2π] ואז ודא שהאמצע נמצא בתחום.
        sweep = norm2pi(sweep)
        if (!midInSweep(a0, sweep, aMid)) sweep -= 2.0 * Math.PI // הפוך לכיוון-המשלים

        val out = ArrayList<Pt>(k + 1)
        for (i in 0..k) {
            val ang = a0 + sweep * (i.toDouble() / k)
            out.add(Pt(circle.cx + circle.r * cos(ang), circle.cy + circle.r * sin(ang)))
        }
        return out
    }

    // ------------------------------------------------------------------
    // בונה-שרשרת יחסי — מיתר + בליטה (sagitta) + צד
    // ------------------------------------------------------------------

    /**
     * בונה שרשרת-קטעים לקשת מוגדרת ע"י **מיתר** + **בליטה** + צד.
     *
     * גאומטריה: לקשת עם מיתר c ובליטה h (>0) הרדיוס r = (c²/4 + h²)/(2h),
     * והזווית-המרכזית הכוללת θ = 2·atan2(c/2, r−h) (מטפל גם בקשת-על, h>r).
     * הקשת מחולקת ל-K קטעים שווים: זווית-משנה α = θ/K, אורך-תת-מיתר
     * s = 2r·sin(α/2). לקשת-משיקה בשני-הקצוות: זווית-כניסה/יציאה = α/2,
     * וזוויות-הביניים = α.
     *
     * @param chordMm   אורך-המיתר (מ"מ, > 0).
     * @param sagittaMm בליטת-הקשת מעל-המיתר (מ"מ, > 0).
     * @param ccw       צד-הקשת: true = שמאלה (CCW), false = ימינה (CW).
     * @param segments  מספר-הקטעים (נחסם ל-[2,64]).
     * @return [ArcChain], או null אם הקלט לא-תקין (מיתר/בליטה ≤ 0).
     */
    fun arcChain(chordMm: Double, sagittaMm: Double, ccw: Boolean, segments: Int = 8): ArcChain? {
        if (chordMm <= EPS || sagittaMm <= EPS) return null
        val c = chordMm
        val h = sagittaMm
        val r = (c * c / 4.0 + h * h) / (2.0 * h)
        val theta = 2.0 * atan2(c / 2.0, r - h) // סה"כ-זווית (רדיאנים), חיובי
        val k = segments.coerceIn(2, 64)
        val alpha = theta / k
        val s = 2.0 * r * sin(alpha / 2.0)
        val sign = if (ccw) 1.0 else -1.0

        val incoming = sign * Math.toDegrees(alpha / 2.0)
        val interior = sign * Math.toDegrees(alpha)
        val outgoing = sign * Math.toDegrees(alpha / 2.0)

        val segs = (0 until k).map { j ->
            Segment(lengthMm = s, turnToNextDeg = if (j < k - 1) interior else outgoing)
        }
        return ArcChain(incomingTurnDeg = incoming, segments = segs)
    }

    /** רדיוס-הקשת ממיתר+בליטה (עזר-תצוגה). */
    fun radiusOf(chordMm: Double, sagittaMm: Double): Double {
        if (sagittaMm <= EPS) return Double.POSITIVE_INFINITY
        return (chordMm * chordMm / 4.0 + sagittaMm * sagittaMm) / (2.0 * sagittaMm)
    }

    // ------------------------------------------------------------------
    // עזרי-זווית פנימיים
    // ------------------------------------------------------------------

    /** מנרמל ל-(0, 2π] אם חיובי, לתחום סימטרי — כאן ל-(-2π, 2π] ואז לחיובי-קטן. */
    private fun norm2pi(a: Double): Double {
        var x = a % (2.0 * Math.PI)
        if (x <= 0.0) x += 2.0 * Math.PI
        return x // ב-(0, 2π]
    }

    /** האם זווית-האמצע [mid] נמצאת בתחום [start, start+sweep] (sweep>0)? */
    private fun midInSweep(start: Double, sweep: Double, mid: Double): Boolean {
        var d = (mid - start) % (2.0 * Math.PI)
        if (d < 0.0) d += 2.0 * Math.PI
        return d <= sweep + 1e-9
    }
}
