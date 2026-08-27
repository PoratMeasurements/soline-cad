package il.co.soline.measure.geometry

import il.co.soline.measure.data.WallEntity
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/**
 * מנוע-הגאומטריה לבניית-הקירות (MICHAEL_WISHLIST §2 — "שיטת-בניית-הקירות").
 *
 * אובייקט Kotlin טהור (בלי Android/Compose) שממיר רשימת-קירות מסודרת —
 * כל קיר עם [WallEntity.length] (מ"מ) וזווית-פנייה [WallEntity.angle] (מעלות, לקיר הבא) —
 * ל-polyline של קודקודים ב-2D, ומספק כלים לסגירת-מתאר, זיהוי-סגירה, חיבור-T
 * ובנייה נוחה של חדרי-90°.
 *
 * מוסכמות:
 *  - נקודת-ההתחלה היא הראשית (0,0), והכיוון ההתחלתי הוא +X (מזרחה).
 *  - [WallEntity.angle] היא זווית-הפנייה **אחרי** הקיר הנוכחי אל הקיר הבא,
 *    במעלות, כאשר חיובי = פנייה נגד-כיוון-השעון (CCW, שמאלה). מלבן שנבנה
 *    CCW עם 4 פניות של 90° חוזר לנקודת-ההתחלה ונסגר.
 *  - כל היחידות במ"מ (מ"מ פנימה = כפי ש-[WallEntity] שומר).
 *
 * זהו נקודת-הכניסה היחידה: [WallBuilder].
 */
object WallBuilder {

    /** קודקוד ב-2D במ"מ. */
    data class Pt(val x: Double, val y: Double)

    // ------------------------------------------------------------------
    // פריסה בסיסית (layout)
    // ------------------------------------------------------------------

    /**
     * פורס רשימת-קירות מסודרת ל-polyline של קודקודים.
     *
     * מתחיל בראשית (0,0) בכיוון +X, ומוסיף לכל קיר קודקוד בקצהו. אחרי כל
     * קיר הכיוון מסתובב ב-[WallEntity.angle] מעלות (CCW חיובי) לקראת הקיר הבא.
     * תומך גם ב-90° וגם בזוויות שרירותיות ("בנייה ב-90° או בזוויות", §2).
     *
     * לרשימת N קירות מוחזרים N+1 קודקודים: הראשית ואז קצה כל קיר. במתאר
     * סגור הקודקוד האחרון ≈ הראשון (ראו [isClosed] / [closingGap]).
     *
     * @param walls קירות מסודרים לפי [WallEntity.idx] (הסדר ברשימה הוא הקובע).
     * @return רשימת קודקודים; רשימה ריקה מחזירה רשימה ריקה, וקיר-בודד מחזיר 2 קודקודים.
     */
    fun layout(walls: List<WallEntity>): List<Pt> {
        if (walls.isEmpty()) return emptyList()
        val pts = ArrayList<Pt>(walls.size + 1)
        var x = 0.0
        var y = 0.0
        var headingRad = 0.0 // כיוון התחלתי +X
        pts.add(Pt(0.0, 0.0))
        for (w in walls) {
            x += w.length * cos(headingRad)
            y += w.length * sin(headingRad)
            pts.add(Pt(x, y))
            headingRad += Math.toRadians(w.angle) // פנייה אל הקיר הבא
        }
        return pts
    }

    // ------------------------------------------------------------------
    // סגירת-מתאר (closure)
    // ------------------------------------------------------------------

    /**
     * המרחק (מ"מ) מהקודקוד האחרון לקודקוד הראשון — "פער-הסגירה".
     * מחזיר 0 עבור פחות מ-2 קודקודים.
     */
    fun closingGap(pts: List<Pt>): Double {
        if (pts.size < 2) return 0.0
        return dist(pts.first(), pts.last())
    }

    /**
     * האם ה-polyline חוזר קרוב לנקודת-ההתחלה, כלומר המתאר סגור (§2/§3, החלטת-סגירה).
     *
     * דורש לפחות 3 קירות (4 קודקודים) כדי להיחשב מתאר סגור אמיתי, ופער-סגירה
     * שאינו עולה על [tolMm].
     *
     * @param tolMm סבולת-הסגירה במ"מ (ברירת-מחדל 50 מ"מ — 5 ס"מ בשטח).
     */
    fun isClosed(pts: List<Pt>, tolMm: Double = 50.0): Boolean {
        if (pts.size < 4) return false
        return closingGap(pts) <= tolMm
    }

    /**
     * זווית-הפנייה (מעלות, CCW חיובי) הדרושה בקודקוד האחרון כדי שהקיר-הסוגר
     * (מהקודקוד האחרון חזרה לראשון) ייסגר — עוזר להחליט "איזו זווית תיסגר" (§2).
     *
     * מחושבת כהפרש בין כיוון הקטע-האחרון לבין הכיוון מהקודקוד-האחרון אל
     * הראשון, מנורמל ל-(-180,180].
     *
     * @return הזווית במעלות, או 0.0 אם אין די קודקודים.
     */
    fun closingAngleDeg(pts: List<Pt>): Double {
        if (pts.size < 3) return 0.0
        val a = pts[pts.size - 2]
        val b = pts[pts.size - 1]
        val lastDir = atan2(b.y - a.y, b.x - a.x)
        val closeDir = atan2(pts.first().y - b.y, pts.first().x - b.x)
        return normalizeDeg(Math.toDegrees(closeDir - lastDir))
    }

    // ------------------------------------------------------------------
    // חיבור-T ("לרוץ על הפסים")
    // ------------------------------------------------------------------

    /**
     * מצמיד קצה-קיר שכמעט-נוגע אל הקטע הקרוב אליו — חיבור-T (§2, "חיבור T … לרוץ על הפסים").
     *
     * לכל קודקוד-קצה (הראשון והאחרון, שהם הקצוות ה"פתוחים" של הריצה) נבדק
     * המרחק אל כל קטע לא-סמוך. אם המרחק ≤ [tolMm], הקודקוד מוצמד להיטל-הניצב
     * שלו על אותו קטע, כך שהקצה "רץ על הפסים" של הקיר השני.
     *
     * הפעולה שומרת על אורך הרשימה וסדר הקודקודים; רק מיקום הקצה עשוי לזוז.
     *
     * @param tolMm סבולת-ההצמדה במ"מ (ברירת-מחדל 50).
     * @return רשימה חדשה עם הקצוות המוצמדים (המקורית אינה משתנה).
     */
    fun snapTJoin(pts: List<Pt>, tolMm: Double = 50.0): List<Pt> {
        if (pts.size < 3) return pts.toList()
        val result = pts.toMutableList()
        val endpointIdx = listOf(0, pts.size - 1)
        for (vi in endpointIdx) {
            val v = pts[vi]
            var best: Pt? = null
            var bestDist = tolMm
            for (si in 0 until pts.size - 1) {
                // דלג על קטעים הנוגעים בקודקוד עצמו (סמוכים) כדי לא להצמיד לעצמו
                if (si == vi || si + 1 == vi) continue
                val proj = projectOnSegment(v, pts[si], pts[si + 1])
                val d = dist(v, proj)
                if (d <= bestDist) {
                    bestDist = d
                    best = proj
                }
            }
            if (best != null) result[vi] = best
        }
        return result
    }

    // ------------------------------------------------------------------
    // עומק פנימי / חיצוני (offset)
    // ------------------------------------------------------------------

    /**
     * מזיז את ה-polyline במרחק ניצב אחיד — לייצוג עומק פנימי מול עומק חיצוני (§2).
     *
     * ערך [distMm] חיובי מזיז שמאלה יחסית לכיוון-ההתקדמות (פנים של מתאר-CCW),
     * ושלילי מזיז ימינה (חוץ). כל קודקוד מוזז לפי ממוצע הנורמלים של הקטעים
     * הסמוכים לו — קירוב מעשי ומהיר (מספיק לתצוגה ולחישוב-רוחב-קיר; לא offset
     * גאומטרי מדויק בפינות חדות).
     *
     * @param distMm מרחק ההזזה במ"מ (חיובי=פנימה עבור CCW, שלילי=החוצה).
     */
    fun offset(pts: List<Pt>, distMm: Double): List<Pt> {
        if (pts.size < 2 || distMm == 0.0) return pts.toList()
        val out = ArrayList<Pt>(pts.size)
        for (i in pts.indices) {
            val prev = if (i > 0) pts[i - 1] else null
            val next = if (i < pts.size - 1) pts[i + 1] else null
            // נורמלים (שמאל) של הקטעים הסמוכים
            var nx = 0.0
            var ny = 0.0
            if (prev != null) {
                val (lx, ly) = leftNormal(prev, pts[i]); nx += lx; ny += ly
            }
            if (next != null) {
                val (lx, ly) = leftNormal(pts[i], next); nx += lx; ny += ly
            }
            val len = hypot(nx, ny)
            if (len < 1e-9) {
                out.add(pts[i])
            } else {
                out.add(Pt(pts[i].x + distMm * nx / len, pts[i].y + distMm * ny / len))
            }
        }
        return out
    }

    /**
     * בונה "רצועת-קיר" בעלת עומק — המתאר המקורי ואת עותקו המוזז ב-[depthMm]
     * מוחזרים כזוג (חוץ, פנים). שימושי להצגת עובי-קיר בין עומק-פנימי לחיצוני.
     */
    fun depthBand(pts: List<Pt>, depthMm: Double): Pair<List<Pt>, List<Pt>> =
        pts.toList() to offset(pts, depthMm)

    // ------------------------------------------------------------------
    // בונים נוחים (builders)
    // ------------------------------------------------------------------

    /**
     * בונה חדר של זוויות-ישרות (90°) מתוך רשימת-אורכים — "לרוב 90° + מידות-מינימום" (§2).
     *
     * כל קיר מקבל פנייה של 90° (CCW) אל הבא, כך שסדרת-אורכים תואמת (למשל
     * [a,b,a,b] למלבן) נסגרת למתאר. מתאים לעבודה-הידנית הנפוצה שבה לא לוקחים אלכסון.
     *
     * @param lengths אורכי-הקירות במ"מ, לפי הסדר.
     * @param heightMm גובה אחיד לכל הקירות (ברירת-מחדל 0.0).
     * @param roomId מזהה-החדר לשיוך.
     * @param ccw כיוון-הפנייה: true=נגד-כיוון-השעון (90°), false=עם-כיוון-השעון (-90°).
     */
    fun buildRightAngleRoom(
        lengths: List<Double>,
        heightMm: Double = 0.0,
        roomId: Long = 0L,
        ccw: Boolean = true
    ): List<WallEntity> {
        val turn = if (ccw) 90.0 else -90.0
        return lengths.mapIndexed { i, len ->
            WallEntity(roomId = roomId, idx = i, length = len, height = heightMm, angle = turn)
        }
    }

    /**
     * בונה קירות מתוך אורכים + זוויות-פנייה מפורשות (תמיכה בזוויות שרירותיות, §2).
     *
     * @param lengths אורכי-הקירות במ"מ.
     * @param turnsDeg זווית-פנייה (מעלות, CCW חיובי) אחרי כל קיר; נחתך/מרופד
     *                 לאורך [lengths] (ערך חסר = 90°).
     */
    fun buildFromLengthsAndTurns(
        lengths: List<Double>,
        turnsDeg: List<Double>,
        heightMm: Double = 0.0,
        roomId: Long = 0L
    ): List<WallEntity> = lengths.mapIndexed { i, len ->
        WallEntity(
            roomId = roomId,
            idx = i,
            length = len,
            height = heightMm,
            angle = turnsDeg.getOrElse(i) { 90.0 }
        )
    }

    /**
     * בניית-שני-קירות דו-כיוונית (§2, "בניית 2 הקירות דו-כיוונית").
     *
     * מקבל שני אורכים והזווית ביניהם, ומחזיר זוג-קירות. כאשר [reverse]=true
     * הסדר מתהפך (מתחילים מהקיר השני) — כך אפשר "לרוץ" משני הכיוונים ולהגיע
     * לאותה גאומטריה, לפי נוחות-המודד בשטח.
     *
     * @param first אורך הקיר הראשון במ"מ.
     * @param second אורך הקיר השני במ"מ.
     * @param betweenDeg זווית-הפנייה בין הקירות (מעלות, CCW חיובי; ברירת-מחדל 90°).
     * @param reverse האם לבנות בכיוון ההפוך (second→first).
     */
    fun buildTwoWall(
        first: Double,
        second: Double,
        betweenDeg: Double = 90.0,
        heightMm: Double = 0.0,
        roomId: Long = 0L,
        reverse: Boolean = false
    ): List<WallEntity> {
        val (l0, l1) = if (reverse) second to first else first to second
        return listOf(
            WallEntity(roomId = roomId, idx = 0, length = l0, height = heightMm, angle = betweenDeg),
            WallEntity(roomId = roomId, idx = 1, length = l1, height = heightMm, angle = 0.0)
        )
    }

    // ------------------------------------------------------------------
    // עזרי-גאומטריה פנימיים
    // ------------------------------------------------------------------

    private fun dist(a: Pt, b: Pt): Double = hypot(a.x - b.x, a.y - b.y)

    /** היטל של נקודה [p] על הקטע [a]-[b], חסום לקצוות הקטע. */
    private fun projectOnSegment(p: Pt, a: Pt, b: Pt): Pt {
        val vx = b.x - a.x
        val vy = b.y - a.y
        val len2 = vx * vx + vy * vy
        if (len2 < 1e-12) return a
        var t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2
        if (t < 0.0) t = 0.0 else if (t > 1.0) t = 1.0
        return Pt(a.x + t * vx, a.y + t * vy)
    }

    /** נורמל-שמאל (יחידה) של הקטע [a]→[b]. */
    private fun leftNormal(a: Pt, b: Pt): Pair<Double, Double> {
        val dx = b.x - a.x
        val dy = b.y - a.y
        val len = hypot(dx, dy)
        if (len < 1e-9) return 0.0 to 0.0
        return (-dy / len) to (dx / len)
    }

    /** מנרמל זווית (מעלות) לתחום (-180, 180]. */
    private fun normalizeDeg(deg: Double): Double {
        var d = deg % 360.0
        if (d <= -180.0) d += 360.0
        if (d > 180.0) d -= 360.0
        return d
    }

    /** בדיקת-זווית ישרה (בקירוב) — עזר-נוחות לבקרת-קלט. */
    fun isRightAngle(deg: Double, tolDeg: Double = 1.0): Boolean =
        abs(abs(normalizeDeg(deg)) - 90.0) <= tolDeg
}
