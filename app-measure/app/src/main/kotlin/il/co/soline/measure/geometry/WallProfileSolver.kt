package il.co.soline.measure.geometry

import il.co.soline.measure.geometry.WallBuilder.Pt
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/**
 * WallProfileSolver — הליבה-הגאומטרית הטהורה (pure-Kotlin, ללא Android/Compose) של
 * שתי שיטות-המדידה מבוססות-הנקודות (ELEVATION_UNDULATION_DESIGN.md):
 *
 *   **שיטה A — חזית עם גאומטריה אמיתית + הגליות (undulations).**
 *     כל ירייה כדורית `(d, φ, θ)` → נקודת-תחנה `(X, Y, Z)`. הנקודות בהיטל-תוכנית
 *     `(X, Y)` מגדירות **קו-בסיס** של הקיר (PCA / total-least-squares); כל נקודה
 *     מתפרקת ל-`u` (מיקום-אופקי לאורך הקיר), `v = Z` (גובה) ו-`e` (סטייה-ניצבת
 *     ממישור-הקיר = ההגלייה). "פינת-האפס" (LEFT/RIGHT × BOTTOM/TOP) והכיוון (CW/CCW)
 *     ממסגרים מחדש את `(u, v)` למתאר-החזית הסופי.
 *
 *   **שיטה B — הגליית-קיר במבט-על (בטן / belly, כמו AutoCAD).**
 *     אותן נקודות במבט-תוכנית; המיתר A→B (ראשונה→אחרונה) הוא הייחוס, וההיסט-הניצב
 *     המסומן של כל נקודה הוא ה"בטן": `+ = בליטה לתוך-החדר`, `− = הרחק מהחדר`.
 *
 * מתועד להישען אך-ורק על [StationSolver.toPlan] + [FloorLevelSolver.heightZ] — אין כאן
 * מתמטיקה-כדורית חדשה. יחידות: מ"מ ומעלות (זהה ל-Reading של LaserBle).
 */
object WallProfileSolver {

    private const val EPS = 1e-9

    /** קצה-אופקי של פינת-האפס. */
    enum class ZeroH { LEFT, RIGHT }

    /** קצה-אנכי של פינת-האפס. */
    enum class ZeroV { BOTTOM, TOP }

    /** כיוון-הליפוף של ציר-ה-u (עם / נגד כיוון-השעון). */
    enum class Direction { CW, CCW }

    // ──────────────────────────────────────────────────────────────────────────
    // ירייה → נקודת-תחנה (X, Y, Z)
    // ──────────────────────────────────────────────────────────────────────────

    /** נקודת-תחנה קרטזית (מ"מ) — היטל-תוכנית `(x, y)` + גובה-מסומן `z`. */
    data class Station3(val x: Double, val y: Double, val z: Double)

    /**
     * ממיר ירייה-כדורית `(d, φ, θ)` לנקודת-תחנה `(X, Y, Z)` — עטיפה דקה מעל
     * [StationSolver.toPlan] (היטל-תוכנית) ו-[FloorLevelSolver.heightZ] (גובה).
     */
    fun shotToStation(distanceMm: Double, hAngleDeg: Double?, vAngleDeg: Double?): Station3 {
        val plan = StationSolver.toPlan(distanceMm, hAngleDeg, vAngleDeg)
        val z = FloorLevelSolver.heightZ(distanceMm, vAngleDeg)
        return Station3(plan.x, plan.y, z)
    }

    // ──────────────────────────────────────────────────────────────────────────
    // קו-בסיס בהיטל-תוכנית (PCA / chord)
    // ──────────────────────────────────────────────────────────────────────────

    /** קו-בסיס של הקיר: עוגן `anchor`, כיוון-יחידה `tHat`, נורמל-פנימי `nHat`. */
    data class Baseline(val anchor: Pt, val tHat: Pt, val nHat: Pt)

    /**
     * **קו-בסיס במיטב-ההתאמה** דרך ענן-הנקודות בהיטל (total-least-squares / PCA של
     * מטריצת-השונות). העוגן הוא הנקודה-הראשונה (רגל-המתאר); כיוון-הבסיס `tHat` הוא
     * הווקטור-העצמי-הראשי, מכוון מהנקודה-הראשונה אל האחרונה כך ש-`u` עולה לאורך-הסריקה;
     * `nHat = rot₊₉₀(tHat)`. עבור שתי-נקודות בלבד זה מתלכד עם המיתר (chord).
     */
    fun fitBaseline(points: List<Pt>): Baseline {
        require(points.size >= 2) { "fitBaseline דורש ≥2 נקודות" }
        val n = points.size
        val cx = points.sumOf { it.x } / n
        val cy = points.sumOf { it.y } / n
        var sxx = 0.0; var syy = 0.0; var sxy = 0.0
        for (p in points) {
            val dx = p.x - cx; val dy = p.y - cy
            sxx += dx * dx; syy += dy * dy; sxy += dx * dy
        }
        // הזווית של הווקטור-העצמי-הראשי של [[sxx,sxy],[sxy,syy]].
        val theta = 0.5 * atan2(2.0 * sxy, sxx - syy)
        var tx = cos(theta); var ty = sin(theta)
        // מכוונים את tHat מהנקודה-הראשונה אל האחרונה (u עולה לאורך-הסריקה).
        val dirx = points.last().x - points.first().x
        val diry = points.last().y - points.first().y
        if (tx * dirx + ty * diry < 0.0) { tx = -tx; ty = -ty }
        return Baseline(anchor = points.first(), tHat = Pt(tx, ty), nHat = Pt(-ty, tx))
    }

    // ──────────────────────────────────────────────────────────────────────────
    // שיטה A — מתאר-חזית (u, v, e)
    // ──────────────────────────────────────────────────────────────────────────

    /** נקודת-קלט לשיטה A. */
    data class InPoint(
        /** היטל-תוכנית `(X, Y)` מ-[shotToStation]; null אם אין זווית-אופקית (X6 חשוף). */
        val plan: Pt?,
        /** גובה `Z = d·sin(θ)` (מ"מ). */
        val v: Double,
        /** מיקום-אופקי ידני (fallback כשאין φ) — מ"מ. */
        val manualU: Double,
        /** הגלייה שמורה (בטעינה-מחדש של מתאר מוכן); מוחלף בחישוב-חי כשיש plan. */
        val storedE: Double = 0.0,
    )

    /** נקודת-מתאר-החזית הסופית: מיקום-אופקי `u`, גובה `v`, הגלייה `e` (מ"מ). */
    data class ElevPt(val u: Double, val v: Double, val e: Double)

    /**
     * **מתאר-החזית** — מפרק כל נקודה ל-`(u, v, e)`, ואז ממסגר-מחדש לפי פינת-האפס
     * והכיוון (§2.2–2.4 במסמך). אם ≥2 נקודות נושאות היטל-תוכנית — מתאימים קו-בסיס
     * ומודדים `u`/`e` ממנו; נקודות-ללא-plan נופלות ל-`manualU`/`storedE` (fallback X6).
     *
     * מיסגור-מחדש: `LEFT → u−u_min`, `RIGHT → u_max−u`; `dir(CCW=+1, CW=−1)`; ואז
     * הזזה כך ש-`min(u')=0`. אנכית: `BOTTOM → v` (v כבר גובה-מהרצפה — ללא-חיסור-דגימה),
     * `TOP → v_ceil−v`.
     */
    fun toElevation(
        pts: List<InPoint>,
        zeroH: ZeroH = ZeroH.LEFT,
        zeroV: ZeroV = ZeroV.BOTTOM,
        dir: Direction = Direction.CCW,
    ): List<ElevPt> {
        if (pts.isEmpty()) return emptyList()
        val planPts = pts.mapNotNull { it.plan }
        val baseline = if (planPts.size >= 2) fitBaseline(planPts) else null

        // u,v,e גולמיים (טרם-מיסגור)
        val raw = pts.map { ip ->
            if (baseline != null && ip.plan != null) {
                val dx = ip.plan.x - baseline.anchor.x
                val dy = ip.plan.y - baseline.anchor.y
                val u = dx * baseline.tHat.x + dy * baseline.tHat.y
                val e = dx * baseline.nHat.x + dy * baseline.nHat.y
                Triple(u, ip.v, e)
            } else {
                Triple(ip.manualU, ip.v, ip.storedE)
            }
        }

        val uMin = raw.minOf { it.first }
        val uMax = raw.maxOf { it.first }
        val vCeil = raw.maxOf { it.second }
        val dirSign = if (dir == Direction.CCW) 1.0 else -1.0

        val framed = raw.map { (u, v, e) ->
            val uh = (if (zeroH == ZeroH.LEFT) u - uMin else uMax - u) * dirSign
            // BOTTOM: v הוא כבר גובה-מהרצפה (d·sin θ, מכשיר-בגובה-הרצפה) — לא מחסירים
            // את הדגימה-הנמוכה-ביותר. אחרת, מודד שלא-ירה-ברצפה היה מסיט את כל-הגבהים
            // (הנקודה-הנמוכה-שנדגמה הפכה ל-0). נקודת-רצפה שנורתה נותנת v≈0 ⇒ זהה לקודם.
            // CEILING: ממשיך למדוד מהקיצון-העליון שנדגם (vCeil − v).
            val vv = if (zeroV == ZeroV.BOTTOM) v else vCeil - v
            ElevPt(uh, vv, e)
        }
        // הזזה כך ש-min(u')=0 (היפוך-הכיוון עלול לייצר שליליים).
        val shift = framed.minOf { it.u }
        return framed.map { it.copy(u = it.u - shift) }
    }

    /** שיפוע-קטע (מעלות) בין שתי נקודות-מתאר עוקבות: `atan2(Δv, Δu)`. */
    fun segmentSlopeDeg(a: ElevPt, b: ElevPt): Double =
        Math.toDegrees(atan2(b.v - a.v, b.u - a.u))

    /**
     * **סדר-הצללית** — ממיין את נקודות-מתאר-החזית לפי `u` עולה, כדי שבניית-הצללית
     * (המצולע מהרצפה→מתאר→רצפה) לא תצטלב על-עצמה. מתאר-החזית נלכד בסדר-הירי (או מסוגר-
     * מחדש בהיפוך-כיוון), ולכן `u` אינו-בהכרח מונוטוני; המתאר הפיזי-האמיתי הוא תמיד
     * שמאל→ימין לאורך-הקיר. מיון-יציב שומר על סדר-הלכידה בין נקודות בעלות אותו-`u`.
     * הערה: זהו **מבט-החזית בלבד**; נתיב-הבטן במבט-על ([planBelly]) נשאר בסדר-המסלול.
     */
    fun silhouetteOrder(pts: List<ElevPt>): List<ElevPt> = pts.sortedBy { it.u }

    // ──────────────────────────────────────────────────────────────────────────
    // שיטה B — בטן במבט-על (belly)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * תוצאת-בטן: מיתר A→B, מיקום-לאורך-המיתר `s`, היסט-ניצב-מסומן `offsets`, מוטת-המיתר,
     * אורך-המתאר-האמיתי, ובליטה-מירבית חיובית/שלילית.
     */
    data class Belly(
        val chordA: Pt,
        val chordB: Pt,
        val s: List<Double>,
        val offsets: List<Double>,
        val spanMm: Double,
        val developedMm: Double,
        val maxPosMm: Double,
        val maxNegMm: Double,
    )

    /**
     * **בטן במבט-על** (§3.2) — המיתר A→B (ראשונה→אחרונה) הוא הייחוס; לכל נקודה
     * `s = (P−A)·t̂` (מיקום-לאורך) ו-`e = (P−A)·n̂` (היסט-ניצב מסומן, `+ = לתוך-החדר`).
     * `flip` הופך את סימן-הנורמל (בורר "הפוך צד" כשאין ידיעת-כיוון-חדר). מחזיר null
     * אם פחות-מ-2 נקודות או מיתר-אפס.
     */
    fun planBelly(points: List<Pt>, flip: Boolean = false): Belly? {
        if (points.size < 2) return null
        val a = points.first(); val b = points.last()
        val len = hypot(b.x - a.x, b.y - a.y)
        if (len < EPS) return null
        val tx = (b.x - a.x) / len; val ty = (b.y - a.y) / len
        var nx = -ty; var ny = tx
        if (flip) { nx = -nx; ny = -ny }
        val s = ArrayList<Double>(points.size)
        val off = ArrayList<Double>(points.size)
        for (p in points) {
            val dx = p.x - a.x; val dy = p.y - a.y
            s.add(dx * tx + dy * ty)
            off.add(dx * nx + dy * ny)
        }
        var dev = 0.0
        for (i in 0 until points.size - 1) {
            dev += hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y)
        }
        return Belly(
            chordA = a, chordB = b, s = s, offsets = off,
            spanMm = len, developedMm = dev,
            maxPosMm = off.maxOrNull() ?: 0.0, maxNegMm = off.minOrNull() ?: 0.0,
        )
    }
}
