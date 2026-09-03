package il.co.soline.measure.geometry

import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.geometry.WallBuilder.Pt
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot

/**
 * כלי-סגירת-היקף וחיבור-קירות (Wall Attach / Close-Auto) ל-Soline Measure.
 *
 * סוגר את מצולע-הקירות ע"י חיתוך הקטע-הראשון והקטע-האחרון (Close Auto/Manual,
 * Attach / Attach External Walls, Intersection), ומבצע חיבור-T שבו "הקיר השני
 * נחתך/מוארך עד הראשון; הראשון לא זז".
 * בלי סגירת-היקף תקינה, התוכנית לא "נסגרת" נכון בייצוא ל-ORDX/PDP.
 *
 * אובייקט Kotlin **טהור** (בלי Android/Compose). כל החישוב נשען על מוסכמת-הפריסה של
 * [WallBuilder.layout]:
 *  - ההתחלה בראשית (0,0), הכיוון ההתחלתי +X (מזרחה).
 *  - [WallEntity.angle] = זווית-הפנייה (מעלות, CCW חיובי) **אחרי** הקיר הנוכחי אל הבא.
 *  - לרשימת N קירות מתקבלים N+1 קודקודים; במתאר סגור הקודקוד האחרון ≈ הראשון.
 *  - כל היחידות במ"מ.
 *
 * מוסכמת-סגירה חשובה: מכיוון ש-[WallBuilder.layout] **מעגן** את הקיר-הראשון בראשית
 * ובכיוון +X, אנחנו משאירים את הקיר-הראשון (ואת כל הקירות עד הלפני-אחרון) במקומם —
 * זהו העיקרון "הראשון לא זז" — ומאריכים/מסובבים את הקיר-האחרון עד שהוא פוגש שוב את
 * קודקוד-הראשית, שהוא נקודת-החיתוך של הקיר-הראשון והקיר-האחרון. כך [WallBuilder.layout]
 * של הרשימה המוחזרת חוזר בדיוק לראשית = מתאר סגור.
 */
object WallCloseTools {

    private const val EPS = 1e-6

    /** מידע-סגירה לתצוגה/החלטה. [suggestion] בעברית. */
    data class ClosureInfo(
        val closed: Boolean,
        val gapMm: Double,
        val suggestion: String,
    )

    // ------------------------------------------------------------------
    // Close-Auto — סגירה אוטומטית
    // ------------------------------------------------------------------

    /**
     * **Close-Auto** — סוגר את היקף-החדר אוטומטית ע"י חיתוך הקטע-הראשון והאחרון.
     *
     * מאריך את הקיר-הראשון ואת הקיר-האחרון עד שהם נחתכים, ומייצר מצולע-סגור, בעזרת
     * גאומטריית-חיתוך-קווים ([lineIntersect]) על קודקודי [WallBuilder.layout].
     *
     * שני מסלולים:
     *  1. **מסלול-נאמן** ([tryIntersectionClose]) — כשקו-הקיר-הראשון וקו-הקיר-האחרון
     *     נחתכים בנקודה X שהיא הארכה-קדמית תקינה: המצולע מעוגן-מחדש ב-X. הקיר-הראשון
     *     והקיר-האחרון "מוארכים/נגזרים" עד X (אורכיהם מחושבים מחדש), כל הקירות שביניהם
     *     ללא-שינוי, וזווית-הפנייה של הקיר-האחרון מוגדרת ל-[WallBuilder.closingAngleDeg].
     *  2. **מסלול-גיבוי** ([closeToOrigin]) — קווים מקבילים/חיתוך-אחורי/קלט-רועש:
     *     "הראשון לא זז" — כל הקירות עד הלפני-אחרון נשמרים, ואילו אורך הקיר-האחרון
     *     וזווית-הסגירה (הפנייה שמכניסה אליו, השמורה על הקיר הלפני-אחרון) מחושבים מחדש
     *     כך שהקיר-האחרון מכוון בדיוק אל הראשית.
     *
     * בשני המסלולים [WallBuilder.layout] של הרשימה המוחזרת נסגר לראשית (מתאר סגור).
     * חסין לקלט פתוח/מנוון: לפחות 3 קירות דרושים; אחרת הרשימה מוחזרת כמות-שהיא.
     *
     * @param walls קירות מסודרים לפי [WallEntity.idx] (הסדר ברשימה קובע).
     * @return רשימת-קירות חדשה שה-[WallBuilder.layout] שלה נסגר (המקור לא משתנה).
     */
    fun closeAuto(walls: List<WallEntity>): List<WallEntity> {
        if (walls.size < 3) return walls.toList()
        val pts = WallBuilder.layout(walls)
        if (pts.size < 4) return walls.toList()

        val origin = pts.first()
        val p1 = pts[1]
        val n = walls.size
        val pPrev = pts[n - 1]  // קודקוד-הלפני-אחרון = תחילת הקיר-האחרון
        val pLast = pts[n]      // קצה הקיר-האחרון הנוכחי (= pts.last())

        // חיתוך קו-הקיר-הראשון (origin→p1) עם קו-הקיר-האחרון (pPrev→pLast).
        val x = lineIntersect(origin, p1, pPrev, pLast)
        if (x != null) {
            val faithful = tryIntersectionClose(walls, pts, x)
            if (faithful != null) return faithful
        }
        // גיבוי חסין (מקבילים/חיתוך-אחורי/רועש): סגירה אל הראשית.
        return closeToOrigin(walls, pts)
    }

    /**
     * סגירה-נאמנה: מעגן-מחדש את המצולע בנקודת-החיתוך [x] של הקיר-הראשון והאחרון.
     * מחזיר null אם [x] אינו הארכה-קדמית תקינה (חיתוך אחורי, או מעבר ל-p1 שמהפך את
     * כיוון הקיר-הראשון) — כדי לגבות ל-[closeToOrigin].
     */
    private fun tryIntersectionClose(
        walls: List<WallEntity>,
        pts: List<Pt>,
        x: Pt,
    ): List<WallEntity>? {
        val n = walls.size
        val origin = pts.first()
        val p1 = pts[1]
        val pPrev = pts[n - 1]
        val pLast = pts[n]

        // s: מיקום X לאורך קו-הקיר-האחרון (מ-pPrev בכיוון הקיר); חייב s>0 = הארכה-קדמית.
        val s = param(pPrev, pLast, x)
        if (s <= EPS) return null
        // t: מיקום X לאורך קו-הקיר-הראשון; t<|p1| שומר על כיוון +X של הקיר-הראשון.
        val t = param(origin, p1, x)
        val firstLen = dist(x, p1)
        if (firstLen < EPS) return null
        if (t >= dist(origin, p1) - EPS) return null // X מעבר ל-p1 → היפוך-כיוון → גיבוי

        val result = walls.toMutableList()
        result[0] = result[0].copy(length = firstLen)               // הקיר-הראשון עד X
        result[n - 1] = result[n - 1].copy(length = dist(pPrev, x)) // הקיר-האחרון עד X

        val closedPts = WallBuilder.layout(result)
        if (WallBuilder.closingGap(closedPts) > 1.0) return null     // לא נסגר כצפוי → גיבוי
        result[n - 1] = result[n - 1].copy(angle = WallBuilder.closingAngleDeg(closedPts))
        return result
    }

    /**
     * גיבוי: משאיר את הקירות עד הלפני-אחרון ("הראשון לא זז"), ומכוון+מאריך את הקיר-האחרון
     * אל הראשית — אורך הקיר-האחרון וזווית-הפנייה שמכניסה אליו (על הקיר הלפני-אחרון)
     * מחושבים מחדש, וזווית-הפנייה של הקיר-האחרון מוגדרת ל-[WallBuilder.closingAngleDeg].
     */
    private fun closeToOrigin(walls: List<WallEntity>, pts: List<Pt>): List<WallEntity> {
        val n = walls.size
        val origin = pts.first()
        val pPrev = pts[n - 1]
        val newLen = dist(pPrev, origin)
        if (newLen < EPS) return walls.toList() // כבר סגור

        val desiredHeading = atan2(origin.y - pPrev.y, origin.x - pPrev.x)
        val headingIntoLast = walls.take(n - 1).sumOf { Math.toRadians(it.angle) }
        val deltaDeg = normalizeDeg(Math.toDegrees(desiredHeading - headingIntoLast))

        val result = walls.toMutableList()
        result[n - 2] = result[n - 2].copy(angle = result[n - 2].angle + deltaDeg)
        result[n - 1] = result[n - 1].copy(length = newLen)
        val closedPts = WallBuilder.layout(result)
        result[n - 1] = result[n - 1].copy(angle = WallBuilder.closingAngleDeg(closedPts))
        return result
    }

    // ------------------------------------------------------------------
    // דיווח-סגירה
    // ------------------------------------------------------------------

    /**
     * מחשב את מצב-הסגירה של מתאר-הקירות — פער-סגירה, האם סגור, והמלצה בעברית.
     *
     * @param walls קירות מסודרים.
     * @return [ClosureInfo] עם [ClosureInfo.gapMm] (מ"מ), דגל-סגירה והמלצת-פעולה.
     */
    fun closingReport(walls: List<WallEntity>): ClosureInfo {
        if (walls.size < 3) {
            return ClosureInfo(
                closed = false,
                gapMm = 0.0,
                suggestion = "צריך לפחות 3 קירות כדי לסגור היקף.",
            )
        }
        val pts = WallBuilder.layout(walls)
        val gap = WallBuilder.closingGap(pts)
        val closed = WallBuilder.isClosed(pts)
        val suggestion = when {
            closed -> "המתאר סגור ✓ מוכן לייצוא."
            gap <= 200.0 -> "פער-סגירה ${fmtMm(gap)} — לחץ “סגור היקף” לסגירה אוטומטית."
            else -> "פער-סגירה גדול (${fmtMm(gap)}) — בדוק מדידות או הוסף קיר סוגר ידני."
        }
        return ClosureInfo(closed = closed, gapMm = gap, suggestion = suggestion)
    }

    // ------------------------------------------------------------------
    // חיבור-T (Attach / T-Join)
    // ------------------------------------------------------------------

    /**
     * **חיבור-T (T-Join / Attach)** — מצמיד קצה-קיר שכמעט-נוגע אל הקיר הקרוב
     * הלא-סמוך ("Attach"). "הקיר-השני נחתך/מוארך עד הראשון; הראשון לא זז."
     *
     * הפעולה עוטפת את [WallBuilder.snapTJoin] ברמת-הנקודות: פורסת את הקירות ל-polyline,
     * מצמידה את קצוותיו-הפתוחים (הקודקוד-הראשון והאחרון) אל היטל-הניצב על הקטע הקרוב,
     * ואז מתרגמת את הזזת-הקצה חזרה לעריכות [WallEntity].
     *
     * מגבלות (מתועדות במפורש):
     *  - **קצה-אחרון** (הקצה-הפתוח הנפוץ בחיבור-T): מתורגם במלואו — אורך הקיר-האחרון
     *    וזווית-הפנייה שמכניסה אליו (על הקיר הלפני-אחרון) מחושבים מחדש כך שהקצה נוחת
     *    בדיוק על נקודת-ההצמדה.
     *  - **קצה-ראשון**: [WallBuilder.layout] מעגן את הקצה-הראשון בראשית ובכיוון +X, לכן
     *    הזזתו אינה ניתנת-לייצוג מלא במודל-הקירות המעוגן. מתבצע קירוב מיטבי (עדכון אורך
     *    הקיר-הראשון בלבד); אם דרושה הצמדה מדויקת של הקצה-הראשון, מומלץ להפוך את סדר-הקירות
     *    או להשתמש ב-[addClosingWall]. הזזת קצה-ראשון מסומנת אך אינה משנה זוויות.
     *
     * @param walls קירות מסודרים.
     * @param tolMm סבולת-ההצמדה במ"מ (ברירת-מחדל 50).
     * @return רשימת-קירות חדשה עם הקצה המוצמד (המקור לא משתנה).
     */
    fun attachTJoin(walls: List<WallEntity>, tolMm: Double = 50.0): List<WallEntity> {
        if (walls.size < 3) return walls.toList()
        val pts = WallBuilder.layout(walls)
        if (pts.size < 4) return walls.toList()

        val snapped = WallBuilder.snapTJoin(pts, tolMm)
        val n = walls.size
        val result = walls.toMutableList()

        // --- קצה-אחרון: תרגום מלא לעריכות-קיר ---
        val lastTarget = snapped.last()
        if (dist(pts.last(), lastTarget) > EPS) {
            val pPrev = snapped[n - 1] // קודקוד פנימי — לא זז בהצמדת-קצוות
            val newLen = dist(pPrev, lastTarget)
            if (newLen > EPS) {
                val desiredHeading = atan2(lastTarget.y - pPrev.y, lastTarget.x - pPrev.x)
                val headingIntoLast = walls.take(n - 1).sumOf { Math.toRadians(it.angle) }
                val deltaDeg = normalizeDeg(Math.toDegrees(desiredHeading - headingIntoLast))
                result[n - 2] = result[n - 2].copy(angle = result[n - 2].angle + deltaDeg)
                result[n - 1] = result[n - 1].copy(length = newLen)
            }
        }

        // --- קצה-ראשון: קירוב-מיטבי בלבד (ראו מגבלות ב-KDoc) ---
        val firstTarget = snapped.first()
        if (dist(pts.first(), firstTarget) > EPS) {
            val newLen0 = dist(firstTarget, pts[1])
            if (newLen0 > EPS) {
                result[0] = result[0].copy(length = newLen0)
            }
        }

        return result
    }

    // ------------------------------------------------------------------
    // סגירה ידנית — הוספת קיר-סוגר
    // ------------------------------------------------------------------

    /**
     * **סגירה ידנית** ("Close: Manual") — מחזיר קיר **חדש** המחבר את
     * הקודקוד-האחרון חזרה אל הקודקוד-הראשון, כחלופה ל-[closeAuto].
     *
     * אורך הקיר החדש = פער-הסגירה; זווית-הפנייה שלו = הפנייה הסוגרת חזרה אל הקיר-הראשון
     * ([WallBuilder.closingAngleDeg]). ה-idx שלו ממשיך את הרצף, וה-roomId/height נלקחים
     * מהקיר-האחרון הקיים. הקיר מוחזר לצירוף ע"י הקורא (append) ולשמירה דרך ה-repo.
     *
     * הערה: כיוון-הקיר החדש כפי שהוא מצויר נגזר מרצף-הפניות הקיים. הוא נוחת בדיוק על
     * הראשית כאשר הקצה-הפתוח כבר פונה אליה (מתאר כמעט-סגור); אחרת עדיף [closeAuto].
     *
     * @return הקיר-הסוגר החדש, או null אם אין די קירות או שהמתאר כבר סגור.
     */
    fun addClosingWall(walls: List<WallEntity>): WallEntity? {
        if (walls.size < 2) return null
        val pts = WallBuilder.layout(walls)
        if (pts.size < 3) return null

        val origin = pts.first()
        val last = pts.last()
        val gap = dist(last, origin)
        if (gap < EPS) return null // כבר סגור

        // זווית-סגירה: הפנייה מהקטע-האחרון אל הכיוון (last→origin), עבור הקיר-הסוגר.
        val closingPts = pts + origin
        val closeAngle = WallBuilder.closingAngleDeg(closingPts)

        val lastWall = walls.last()
        return WallEntity(
            roomId = lastWall.roomId,
            idx = lastWall.idx + 1,
            length = gap,
            height = lastWall.height,
            angle = closeAngle,
        )
    }

    // ------------------------------------------------------------------
    // עזרי-גאומטריה פנימיים
    // ------------------------------------------------------------------

    private fun dist(a: Pt, b: Pt): Double = hypot(a.x - b.x, a.y - b.y)

    /** מיקום-סקלרי (מרחק-חתום) של הנקודה [p] לאורך הקו [a]→[b], בכיוון-היחידה של הקו. */
    private fun param(a: Pt, b: Pt, p: Pt): Double {
        val dx = b.x - a.x
        val dy = b.y - a.y
        val len = hypot(dx, dy)
        if (len < EPS) return 0.0
        return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len
    }

    /**
     * חיתוך שני קווים אינסופיים (a1→a2) ו-(b1→b2) בשיטת-הדטרמיננטה.
     * מחזיר את נקודת-החיתוך, או null אם הקווים מקבילים/מנוונים.
     */
    private fun lineIntersect(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt? {
        val r_x = a2.x - a1.x
        val r_y = a2.y - a1.y
        val s_x = b2.x - b1.x
        val s_y = b2.y - b1.y
        val denom = r_x * s_y - r_y * s_x
        if (abs(denom) < EPS) return null // מקבילים/קוליניאריים
        val t = ((b1.x - a1.x) * s_y - (b1.y - a1.y) * s_x) / denom
        return Pt(a1.x + t * r_x, a1.y + t * r_y)
    }

    /** מנרמל זווית (מעלות) לתחום (-180, 180]. */
    private fun normalizeDeg(deg: Double): Double {
        var d = deg % 360.0
        if (d <= -180.0) d += 360.0
        if (d > 180.0) d -= 360.0
        return d
    }

    /** עיצוב-מרחק קריא בעברית (מ"מ / מ'). */
    private fun fmtMm(mm: Double): String {
        val a = abs(mm)
        return if (a >= 1000.0) String.format("%.2f מ'", mm / 1000.0)
        else String.format("%.0f מ\"מ", mm)
    }
}
