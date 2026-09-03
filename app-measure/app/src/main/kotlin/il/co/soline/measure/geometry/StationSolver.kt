package il.co.soline.measure.geometry

import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.geometry.WallBuilder.Pt
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * StationSolver — הליבה-המתמטית של **מדידת-P2P האוטומטית של Leica X6**.
 *
 * זהו האובייקט ה-Kotlin ה**טהור** (בלי Android/Compose) שעומד מאחורי מסך-ה-P2P: הוא
 * מכייל-עמדה, ממיר יריות-P2P לאורכי-קיר, ופותר את **הזווית בין קירות סמוכים גאומטרית**
 * בחוק-הקוסינוסים על אלכסון-הפינה — בלי זווית-אופקית מהמכשיר.
 *
 * ── למה גאומטרי ולא מצפן ──────────────────────────────────────────────────────
 * מד-הלייקה X6 מעביר ב-BLE ([il.co.soline.measure.device.LaserBle.Reading]) **מרחק +
 * זווית-אנכית בלבד** — לא זווית-אופקית אמינה (זו דורשת DST360). לכן אי-אפשר לבנות את
 * כיוון-הקיר ממצפן. במקום זה בונים אותו גאומטרית משלושת-אורכי-המשולש של הפינה
 * (שני הקירות הסמוכים + אלכסון-הפינה, חוק-הקוסינוסים):
 *
 *   שני קירות סמוכים נפגשים בפינה B. מודדים:
 *     a = אורך קיר-1  (A→B)          ← ירית-P2P אופקית
 *     b = אורך קיר-2  (B→C)          ← ירית-P2P אופקית
 *     c = אלכסון-הפינה (A→C)         ← ירית-P2P אלכסונית (קצה-רחוק-אל-קצה-רחוק)
 *   הזווית-הפנימית בפינה B נפתרת בחוק-הקוסינוסים:
 *
 *        cos(B) = (a² + b² − c²) / (2ab)          →   B = acos(...)
 *
 * מכאן זווית-הפנייה של [WallBuilder] (CCW-חיובי, "אחרי הקיר הנוכחי אל הבא"):
 *
 *        turn = ±(180° − B)
 *
 * (זווית-ישרה B=90° ⇒ turn=90°; קו-ישר B=180° ⇒ turn=0° — עקבי עם מלבן-CCW.)
 *
 * ── כיול-עמדה (station calibration) ───────────────────────────────────────────
 * המודד מציב את המכשיר בעמדה אחת וקובע אותה כ**ראשית** (0,0). כל החדר נבנה יחסית
 * לעמדה בהצבה-אחת. ה-[Station] נושא מוצא ואזימוט-ייחוס אופציונלי. **הרחבה עתידית**
 * (מחוץ-לתחום גל-זה): רילוקציה מרובת-עוגנים — 4 עוגני-ייחוס והעברת-הלייזר
 * לפתרון עמדה-חדשה בטרילטרציה. הבסיס לכך כבר קיים ב-
 * [Trilateration.twoCircleIntersection]; StationSolver נשאר עמדה-בודדת ומתועד ככזה.
 *
 * ── חיבור-T וסגירת-היקף ───────────────────────────────────────────────────────
 * לא משוכפל — מנותב אל [WallCloseTools] ([tJoin], [closeOutline], [closingReport]),
 * כדי ש"הקיר-השני יחובר נכון לראשון" ושהמתאר ייסגר לייצוא.
 *
 * כל היחידות מ"מ; זוויות במעלות; מוסכמות זהות ל-[WallBuilder]/[Trilateration].
 */
object StationSolver {

    private const val EPS = 1e-6

    /** מרחק-מינימלי בין פינות סמוכות (מ"מ) — מתחתיו נחשבות **חופפות** ומאוחדות (מונע קיר-אפס). */
    const val MIN_CORNER_SEP_MM = 10.0

    // ──────────────────────────────────────────────────────────────────────────
    // כיול-עמדה (Station calibration)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * עמדת-מדידה מכוילת — נקודת-הייחוס הקבועה של ההצבה.
     *
     * @param origin     מיקום-העמדה במערכת-החדר (ברירת-מחדל הראשית 0,0 — עמדה=ראשית).
     * @param bearingDeg אזימוט-ייחוס אופציונלי לכיוון הקיר-הראשון (מעלות, 0=+X מזרחה).
     *                   משמש רק לתיוג/תצוגה; הגאומטריה אינה תלויה בו (נבנית מאורכים+אלכסונים).
     */
    data class Station(
        val origin: Pt = Pt(0.0, 0.0),
        val bearingDeg: Double = 0.0,
    )

    /**
     * **כייל עמדה** — קובע את מיקום-המכשיר כראשית-החדר. גרסת עמדה-בודדת:
     * העמדה היא נקודה-קבועה, והקירות נמדדים ממנה בהצבה-אחת.
     *
     * @param originX,originY מיקום-העמדה (ברירת-מחדל 0,0).
     * @param bearingDeg      אזימוט-ייחוס אופציונלי לקיר-הראשון.
     */
    fun calibrateStation(originX: Double = 0.0, originY: Double = 0.0, bearingDeg: Double = 0.0): Station =
        Station(Pt(originX, originY), normalizeDeg(bearingDeg))

    // ──────────────────────────────────────────────────────────────────────────
    // P2P → סקלר-מדידה (vertical / horizontal / diagonal)
    // ──────────────────────────────────────────────────────────────────────────

    /** אוריינטציית ירית-P2P — קובעת מה המרחק מייצג (אנכי / אופקי / אלכסוני). */
    enum class Orientation { VERTICAL, HORIZONTAL, DIAGONAL }

    /**
     * ממיר ירית-P2P לערך-המדידה המשמעותי לפי האוריינטציה:
     *  - [Orientation.HORIZONTAL] / [Orientation.DIAGONAL] → **אורך בהיטל-אופקי** (לקיר/אלכסון).
     *  - [Orientation.VERTICAL] → **גובה** (רכיב אנכי).
     *
     * אם זמינה זווית-אנכית ([vAngleDeg]) מהלייקה, מיושם היטל-אמיתי ("היטל
     * אופקי אמיתי", R4): אורך-אופקי = d·cos(tilt), גובה = d·sin(tilt), כאשר tilt הוא
     * הסטייה-מהאופק. **מוסכמת-הזווית תלוית-מכשיר**; בהיעדר [vAngleDeg] (null) מוחזר
     * המרחק-הגולמי כפי-שהוא — התנהגות-ברירת-המחדל הבטוחה (המכשיר כבר חישב P2P).
     *
     * @param distanceMm מרחק-ה-P2P הנמדד (מ"מ).
     * @param vAngleDeg  זווית-אנכית מהלייקה (מעלות), או null אם לא ידועה / לא רלוונטית.
     * @param orientation אוריינטציית-הירייה.
     * @return הערך המשמעותי במ"מ (אורך-אופקי או גובה).
     */
    fun p2pValue(distanceMm: Double, vAngleDeg: Double?, orientation: Orientation): Double {
        val d = abs(distanceMm)
        if (vAngleDeg == null || !vAngleDeg.isFinite()) return d
        val tilt = Math.toRadians(vAngleDeg)
        return when (orientation) {
            Orientation.VERTICAL -> abs(d * sin(tilt))
            Orientation.HORIZONTAL, Orientation.DIAGONAL -> abs(d * cos(tilt))
        }
    }

    /** היטל-אופקי אמיתי של ירייה — אורך-קיר בתוכנית מתוך מרחק+זווית-אנכית. */
    fun horizontalProjection(distanceMm: Double, vAngleDeg: Double?): Double =
        p2pValue(distanceMm, vAngleDeg, Orientation.HORIZONTAL)

    /** רכיב-גובה אנכי של ירייה — גובה-קיר/חדר מתוך ירית-P2P אנכית. */
    fun verticalComponent(distanceMm: Double, vAngleDeg: Double?): Double =
        p2pValue(distanceMm, vAngleDeg, Orientation.VERTICAL)

    // ──────────────────────────────────────────────────────────────────────────
    // P2P אמיתי — ירייה-כדורית (מרחק + hAngle + vAngle) → נקודת-תוכנית 2D
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * ירייה גולמית מתחנת-המדידה — שלישיית קואורדינטות-קוטב-כדוריות מהעמדה:
     * מרחק-אלכסוני + זווית-אופקית (azimuth מ-DST 360-X) + זווית-אנכית (inclination מ-X6).
     * זהו בדיוק מה שתחנה-טוטאלית פולטת לכל נקודה.
     */
    data class Shot(
        /** מרחק-אלכסוני (slant) מהתחנה אל הנקודה, מ"מ. */
        val distanceMm: Double,
        /** זווית-אופקית (azimuth) סביב ציר-Z, מעלות; null אם אין DST 360-X. */
        val hAngleDeg: Double?,
        /** זווית-אנכית (inclination) מהאופק, מעלות; null אם לא ידועה. */
        val vAngleDeg: Double?,
    )

    /**
     * **P2P אמיתי** — ממיר ירייה-כדורית לנקודת-תוכנית 2D יחסית-לתחנה
     * (המרה מלאה של DST 360-X → XYZ). כל פינה שנורית מהתחנה נופלת ישירות למקומה
     * בתוכנית — בלי פתרון-זווית-מאלכסון ובלי מדידות-אלכסון נוספות:
     *
     *     r = d·cos(θ_v)            ← היטל-אופקי אמיתי (מרחק-בתוכנית)
     *     x = r·cos(φ)             ← φ = hAngle azimuth (CCW-חיובי, 0=+X מזרחה)
     *     y = r·sin(φ)
     *
     * מוסכמת-האזימוט (CCW-חיובי) נבחרה כי היא משחזרת מלבן-ידוע נכון (ראו בדיקת-
     * הגאומטריה) — זו התנהגות-ברירת-המחדל ([cwHanded]=false). אם בשטח המתאר יוצא
     * **מראה-הפוך** מול החדר (DST מדווח CW), העבֵר [cwHanded]=true והסימן של φ יתהפך
     * (φ → −φ) — מתג-הכיווניות היחיד, בלי לשבור את המתמטיקה של ברירת-המחדל.
     *
     * בהיעדר [hAngleDeg] (X6 בלי מתאם) הנקודה נופלת על ציר-r בלבד (φ=0) — שיטת-
     * הפינות דורשת DST 360-X; המסך מזהיר כשהזווית-האופקית חסרה.
     *
     * @param distanceMm מרחק-אלכסוני מהתחנה (מ"מ).
     * @param hAngleDeg  זווית-אופקית (azimuth) מהמתאם, או null.
     * @param vAngleDeg  זווית-אנכית (inclination), או null (⇒ 0, נקודה במישור-התחנה).
     * @param cwHanded   כיווניות: false=CCW (ברירת-מחדל, המתמטיקה הקיימת); true=CW ⇒ φ→−φ (מתאר-מראה).
     * @return נקודת-תוכנית 2D (מ"מ) יחסית-לתחנה כראשית.
     */
    fun toPlan(distanceMm: Double, hAngleDeg: Double?, vAngleDeg: Double?, cwHanded: Boolean = false): Pt {
        val d = abs(distanceMm)
        val tilt = if (vAngleDeg != null && vAngleDeg.isFinite()) Math.toRadians(vAngleDeg) else 0.0
        val r = d * cos(tilt)
        var phi = if (hAngleDeg != null && hAngleDeg.isFinite()) Math.toRadians(hAngleDeg) else 0.0
        if (cwHanded) phi = -phi   // כיווניות-CW: מתאר-מראה ← הופכים את סימן-האזימוט
        return Pt(r * cos(phi), r * sin(phi))
    }

    /** נוחות: ממיר [Shot] לנקודת-תוכנית. */
    fun toPlan(shot: Shot, cwHanded: Boolean = false): Pt = toPlan(shot.distanceMm, shot.hAngleDeg, shot.vAngleDeg, cwHanded)

    /**
     * **מיזוג פינות-חופפות** — מסיר פינות סמוכות הקרובות זו-לזו פחות מ-[minSepMm]
     * (ירייה-כפולה / קליק-כפול → קיר-אפס ורעש-זווית). למתאר-סגור, אם הפינה-האחרונה
     * חופפת לראשונה היא מוסרת (הסגירה מטופלת ע"י ה-wrap ב-[cornersToWalls]).
     *
     * @param corners  פינות לפי-סדר-הירייה (נקודות-תוכנית, מ"מ).
     * @param closed   האם המתאר סגור (משפיע על בדיקת אחרונה↔ראשונה).
     * @param minSepMm סף-מרחק-מינימלי; ברירת-מחדל [MIN_CORNER_SEP_MM].
     * @return רשימת-פינות ללא-חפיפות.
     */
    fun dedupeCorners(corners: List<Pt>, closed: Boolean = true, minSepMm: Double = MIN_CORNER_SEP_MM): List<Pt> {
        if (corners.size < 2) return corners
        val out = ArrayList<Pt>(corners.size)
        for (p in corners) {
            val prev = out.lastOrNull()
            if (prev == null || hypot(p.x - prev.x, p.y - prev.y) >= minSepMm) out.add(p)
        }
        if (closed && out.size >= 2) {
            val f = out.first(); val l = out.last()
            if (hypot(l.x - f.x, l.y - f.y) < minSepMm) out.removeAt(out.lastIndex)
        }
        return out
    }

    /**
     * **מרכיב מתאר-קירות מפינות שנורו** — ממיר רשימת-פינות-תוכנית סדורות (פלט
     * [toPlan]) לרשימת-[WallEntity]: אורך-כל-קיר = המרחק בין פינות סמוכות, וזווית-
     * הפנייה השמורה על כל קיר = הפרש-הכיוונים אל הקיר-הבא (מוסכמת [WallBuilder]).
     *
     * מוסכמת [WallEntity.angle]: הזווית על קיר i היא הפנייה *ממנו אל קיר i+1*. עבור
     * מתאר סגור ([closed]=true, ≥3 פינות) הקיר-האחרון סוגר אל הפינה-הראשונה וזוויתו
     * מצביעה בחזרה אל הקיר-הראשון — כך [WallBuilder.layout] משחזר מצולע-סגור.
     *
     * @param corners  פינות-החדר לפי-סדר-הירייה (נקודות-תוכנית יחסית-לתחנה, מ"מ).
     * @param heightMm גובה אחיד לכל הקירות (מ"מ).
     * @param roomId   מזהה-החדר לשיוך.
     * @param closed   האם לסגור את המתאר (פינה-אחרונה→ראשונה). ברירת-מחדל true.
     * @param heightMeasured האם הגובה נמדד בפועל (מסמן את [WallEntity.heightMeasured]).
     * @return קירות מוכנים ל-[WallBuilder.layout], לשמירה ולייצוא.
     */
    fun cornersToWalls(
        corners: List<Pt>,
        heightMm: Double,
        roomId: Long = 0L,
        closed: Boolean = true,
        heightMeasured: Boolean = false,
    ): List<WallEntity> {
        // מיזוג פינות-חופפות (ירייה-כפולה) לפני הבנייה — מונע קיר-אפס וזווית-זבל.
        val pts = dedupeCorners(corners, closed)
        val n = pts.size
        if (n < 2) return emptyList()
        val wrap = closed && n >= 3
        val segCount = if (wrap) n else n - 1
        val headings = DoubleArray(segCount)
        val lengths = DoubleArray(segCount)
        for (i in 0 until segCount) {
            val p = pts[i]; val q = pts[(i + 1) % n]
            headings[i] = atan2(q.y - p.y, q.x - p.x)
            lengths[i] = hypot(q.x - p.x, q.y - p.y)
        }
        return (0 until segCount).map { i ->
            val nextHeading = when {
                i < segCount - 1 -> headings[i + 1]
                wrap -> headings[0]
                else -> headings[i] // מתאר-פתוח: לקיר-האחרון אין פנייה
            }
            val turn = normalizeDeg(Math.toDegrees(nextHeading - headings[i]))
            WallEntity(
                roomId = roomId, idx = i, length = lengths[i], height = heightMm,
                angle = turn, heightMeasured = heightMeasured,
            )
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // פתרון-זווית-פינה גאומטרי (חוק-הקוסינוסים)
    // ──────────────────────────────────────────────────────────────────────────

    /** תוצאת-פתרון-זווית לפינה בין שני קירות סמוכים. */
    data class CornerAngle(
        /** הזווית-הפנימית בפינה (מעלות, 0..180) — cos⁻¹((a²+b²−c²)/2ab). */
        val interiorDeg: Double,
        /** זווית-הפנייה ל-[WallEntity.angle] (CCW-חיובי): ±(180−interior). */
        val turnDeg: Double,
        /** האם שלושת-האורכים מקיימים אי-שוויון-המשולש (מדידה תקינה). */
        val valid: Boolean,
        /** הערת-סטטוס בעברית לתצוגה. */
        val note: String,
    )

    /**
     * **פתרון-פינה מחוק-הקוסינוסים** — הזווית-הפנימית בפינה B משלושת-אורכי-המשולש.
     * זו הליבה של "בניית-הזוויות":
     *
     *     a = אורך קיר-1 (A→B) · b = אורך קיר-2 (B→C) · c = אלכסון-הפינה (A→C)
     *     interior(B) = acos( (a² + b² − c²) / (2·a·b) )
     *
     * חסין-רעש: הארגומנט נחסם ל-[-1,1] (רעש-לייזר קטן לא מפיל את ה-acos). אם האורכים
     * אינם יוצרים משולש (a+b<c וכו') מוחזר [CornerAngle.valid]=false עם קירוב-מיטבי.
     *
     * @param wall1Len   אורך הקיר-הנכנס-לפינה (a), מ"מ.
     * @param wall2Len   אורך הקיר-היוצא-מהפינה (b), מ"מ.
     * @param diagonal   אלכסון-הפינה בין הקצוות-הרחוקים (c), מ"מ.
     * @param ccw        כיוון-בנייה: true=נגד-כיוון-השעון (turn חיובי), false=עם-השעון.
     * @return [CornerAngle] עם הזווית-הפנימית וזווית-הפנייה ל-[WallBuilder].
     */
    fun cornerAngleFromSides(
        wall1Len: Double,
        wall2Len: Double,
        diagonal: Double,
        ccw: Boolean = true,
    ): CornerAngle {
        val a = abs(wall1Len)
        val b = abs(wall2Len)
        val c = abs(diagonal)
        if (a < EPS || b < EPS) {
            return CornerAngle(90.0, sign(ccw) * 90.0, valid = false, note = "אורך-קיר אפס — לא ניתן לפתור זווית")
        }
        val raw = (a * a + b * b - c * c) / (2.0 * a * b)
        val clamped = raw.coerceIn(-1.0, 1.0)
        val interior = Math.toDegrees(acos(clamped))
        // אי-שוויון-המשולש (עם סבולת יחסית לרעש-מדידה).
        val tol = 1e-3 * (a + b + c) + 1.0
        val ok = (a + b + tol >= c) && (a + c + tol >= b) && (b + c + tol >= a)
        val note = when {
            !ok -> "האורכים אינם יוצרים משולש תקין — בדוק את האלכסון (קירוב: ${fmtDeg(interior)}°)"
            abs(interior - 90.0) <= 1.0 -> "זווית ≈ 90° (זווית-ישרה)"
            else -> "זווית-פינה ${fmtDeg(interior)}°"
        }
        return CornerAngle(interior, sign(ccw) * (180.0 - interior), valid = ok, note = note)
    }

    /**
     * זווית-פנייה ל-[WallEntity.angle] מזווית-פנימית ידועה — נתיב "זווית-ישרה 90°"
     * ("קלט זווית ידני") או כל זווית שהוזנה ידנית.
     *
     * @param interiorDeg הזווית-הפנימית הרצויה בפינה (מעלות; 90 = זווית-ישרה).
     * @param ccw         כיוון-הפנייה.
     */
    fun turnFromInterior(interiorDeg: Double, ccw: Boolean = true): Double =
        sign(ccw) * (180.0 - interiorDeg)

    // ──────────────────────────────────────────────────────────────────────────
    // הרכבת-קירות (P2P → List<WallEntity>)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * קלט-קיר-בודד להרכבה. הפינה שלפני הקיר (בינו לקודמו) נפתרת מ-[diagonalToPrev]
     * (חוק-הקוסינוסים), או נלקחת מ-[explicitInteriorDeg] אם ניתנה (למשל "זווית-ישרה 90°").
     */
    data class WallInput(
        /** אורך-הקיר (מ"מ) — ירית-P2P אופקית. */
        val lengthMm: Double,
        /** גובה-הקיר (מ"מ) — ירית-P2P אנכית (0 ⇒ ברירת-מחדל אצל הקורא). */
        val heightMm: Double = 0.0,
        /** אלכסון-הפינה בין קצה-הקיר-הקודם לקצה-קיר-זה (מ"מ) — פותר את הזווית שלפני קיר-זה. */
        val diagonalToPrev: Double? = null,
        /** זווית-פנימית מפורשת בפינה שלפני קיר-זה (מעלות) — גובר על [diagonalToPrev]. */
        val explicitInteriorDeg: Double? = null,
    )

    /**
     * מרכיב רשימת-[WallEntity] מסודרת מקלט-P2P: כל קיר מקבל אורך+גובה, וזווית-הפנייה
     * **על הקיר הקודם** נקבעת מזווית-הפינה שלפני הקיר-הנוכחי (חוק-הקוסינוסים/זווית-מפורשת).
     *
     * מוסכמת [WallEntity.angle]: הזווית שמורה על קיר i היא הפנייה *ממנו אל קיר i+1*.
     * לכן זווית-הפינה שבין קיר i-1 לקיר i נכתבת על **קיר i-1**. הקיר-האחרון מקבל את
     * זווית-ברירת-המחדל שלו (תיסגר מאוחר יותר ב-[closeOutline]/[tJoin]).
     *
     * @param inputs   קירות לפי-סדר-המדידה (הראשון בלי פינה-קודמת).
     * @param roomId   מזהה-החדר לשיוך.
     * @param ccw      כיוון-בנייה (ברירת-מחדל CCW).
     * @return רשימת-קירות מוכנה ל-[WallBuilder.layout] ולשמירה דרך ה-repo.
     */
    fun buildWalls(
        inputs: List<WallInput>,
        roomId: Long = 0L,
        ccw: Boolean = true,
    ): List<WallEntity> {
        if (inputs.isEmpty()) return emptyList()
        val walls = inputs.mapIndexed { i, inp ->
            WallEntity(roomId = roomId, idx = i, length = abs(inp.lengthMm), height = inp.heightMm, angle = 90.0)
        }.toMutableList()

        // זווית-הפינה שלפני קיר i נכתבת על קיר i-1.
        for (i in 1 until inputs.size) {
            val inp = inputs[i]
            val turn = when {
                inp.explicitInteriorDeg != null -> turnFromInterior(inp.explicitInteriorDeg, ccw)
                inp.diagonalToPrev != null ->
                    cornerAngleFromSides(inputs[i - 1].lengthMm, inp.lengthMm, inp.diagonalToPrev, ccw).turnDeg
                else -> sign(ccw) * 90.0 // ברירת-מחדל בטוחה: זווית-ישרה
            }
            walls[i - 1] = walls[i - 1].copy(angle = turn)
        }
        return walls
    }

    /**
     * עדכון זווית-הפינה של קיר-בודד "בזמן-אמת" (לבנייה אינטראקטיבית): קובע את זווית-
     * הפנייה על [prevWall] כך שהפינה בינו ל-[thisLen] תואמת את המדידה.
     *
     * @return [prevWall] עם [WallEntity.angle] מעודכן, ופתרון-הזווית לצד-התצוגה.
     */
    fun solveCornerOnto(
        prevWall: WallEntity,
        thisLen: Double,
        diagonal: Double,
        ccw: Boolean = true,
    ): Pair<WallEntity, CornerAngle> {
        val solve = cornerAngleFromSides(prevWall.length, thisLen, diagonal, ccw)
        return prevWall.copy(angle = solve.turnDeg) to solve
    }

    // ──────────────────────────────────────────────────────────────────────────
    // חיבור-T וסגירת-היקף — ניתוב אל WallCloseTools (בלי שכפול)
    // ──────────────────────────────────────────────────────────────────────────

    /** **חיבור-T** בין קירות סמוכים — מצמיד קצה-קיר אל השכן ("הראשון לא זז"). */
    fun tJoin(walls: List<WallEntity>, tolMm: Double = 50.0): List<WallEntity> =
        WallCloseTools.attachTJoin(walls, tolMm)

    /** **סגירת-היקף אוטומטית** — מאריך/מסובב את הקיר-האחרון עד לראשית. */
    fun closeOutline(walls: List<WallEntity>): List<WallEntity> =
        WallCloseTools.closeAuto(walls)

    /** דיווח-סגירה (פער + המלצה בעברית) לתצוגה בזמן-בנייה. */
    fun closingReport(walls: List<WallEntity>): WallCloseTools.ClosureInfo =
        WallCloseTools.closingReport(walls)

    /** פורס את הקירות ל-polyline של קודקודים ל**תצוגת-התוכנית החיה** (§ live plan). */
    fun layout(walls: List<WallEntity>): List<Pt> = WallBuilder.layout(walls)

    // ──────────────────────────────────────────────────────────────────────────
    // עזרים
    // ──────────────────────────────────────────────────────────────────────────

    /** אורך-אלכסון צפוי לפינה בזווית-פנימית נתונה (בדיקה-הפוכה / רמז-קלט). */
    fun expectedDiagonal(wall1Len: Double, wall2Len: Double, interiorDeg: Double): Double {
        val a = abs(wall1Len); val b = abs(wall2Len)
        val c2 = a * a + b * b - 2.0 * a * b * cos(Math.toRadians(interiorDeg))
        return if (c2 <= 0.0) 0.0 else sqrt(c2)
    }

    private fun sign(ccw: Boolean) = if (ccw) 1.0 else -1.0

    private fun fmtDeg(v: Double): String {
        if (!v.isFinite()) return "—"
        val r = (v * 10).toInt() / 10.0
        return if (abs(r % 1.0) < 1e-9) r.toInt().toString() else r.toString()
    }

    private fun normalizeDeg(deg: Double): Double {
        var d = deg % 360.0
        if (d <= -180.0) d += 360.0
        if (d > 180.0) d -= 360.0
        return d
    }
}
