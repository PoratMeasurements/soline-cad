package il.co.soline.measure.geometry

import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.geometry.WallBuilder.Pt
import kotlin.math.atan2
import kotlin.math.hypot

/**
 * אשף-תבניות-החדר (Room-template wizard) — פורט מ-CVSM ("RoomMeasure") מדור ג,
 * כרטיסי `#f-plan-wizard` (מלבן/L/U/T/Z) ו-`#f-plan-box` (ריבוע-מהיר).
 *
 * ב-CVSM התבנית נבנית כשרטוט-מודרך: המודד נוגע בקיר ויורה לייזר, והצורה
 * "נסגרת" אוטומטית מהמידות-העצמאיות בזוויות-ישרות מדויקות. באפליקציה (קלט-מספרי)
 * אנחנו חושפים את אותה תוצאה דרך פרמטרים-מספריים לכל צורה — **כל הפינות 90°,
 * והמתאר נסגר תמיד** (בדיוק כמו הערבות-הגאומטרית של CVSM).
 *
 * כל תבנית מתוארת ע"י רשימת-קודקודים ב-CCW (פנים-משמאל), ומומרת ל-[WallEntity]
 * ע"י [fromClosedPolygon] — שמחשב לכל קיר את האורך ואת זווית-הפנייה-לקיר-הבא
 * בדיוק לפי מוסכמת [WallBuilder.layout] (מקור-האמת היחיד). כך המתאר המוחזר
 * תמיד נפרס-מחדש נכון ונסגר לראשית.
 *
 * אובייקט Kotlin טהור (בלי Android/Compose) — ניתן לבדיקת-יחידה.
 */
object RoomTemplates {

    /** סוגי-התבניות (מיושר לבורר-הצורות של CVSM). */
    enum class Template(val he: String) {
        RECTANGLE("מלבן"),
        L("צורת L"),
        U("צורת U"),
        T("צורת T"),
        Z("צורת Z"),
    }

    // ------------------------------------------------------------------
    // ליבה — המרה מקודקודי-מצולע-סגור לרשימת-קירות
    // ------------------------------------------------------------------

    /**
     * ממיר רשימת-קודקודים של מצולע-סגור (CCW) ל-[WallEntity] מסודרים.
     *
     * לכל צלע נשמר האורך וזווית-הפנייה אל הצלע-הבאה (מנורמלת ל-(-180,180]),
     * כך שה-[WallBuilder.layout] של התוצאה נפרס לאותה צורה ונסגר. תמיכה
     * ב-[mirror] (היפוך-כיווניות ל-CW → הצורה משתקפת) וב-[startWall] (בחירת
     * קיר-ההתחלה ע"י הזזת-נקודת-הפתיחה — מקבילה ל"סובב" של CVSM).
     *
     * @param vertices קודקודי-המצולע (CCW), במ"מ. כפילויות עוקבות מנוקות.
     * @param heightMm גובה אחיד לכל הקירות.
     * @param roomId   שיוך-חדר.
     * @param mirror   היפוך-כיווניות (שיקוף הצורה).
     * @param startWall אינדקס-הקיר שיהיה קיר-1 (מודולו מספר-הקירות).
     */
    fun fromClosedPolygon(
        vertices: List<Pt>,
        heightMm: Double = 0.0,
        roomId: Long = 0L,
        mirror: Boolean = false,
        startWall: Int = 0,
    ): List<WallEntity> {
        var pts = dedup(vertices)
        if (pts.size < 3) return emptyList()
        if (mirror) pts = pts.map { Pt(-it.x, it.y) }.asReversed().let { dedup(it) }
        val n = pts.size
        val shift = ((startWall % n) + n) % n
        if (shift != 0) pts = (pts.drop(shift) + pts.take(shift))

        // כיווני-הצלעות
        val heads = DoubleArray(n) { i ->
            val a = pts[i]; val b = pts[(i + 1) % n]
            atan2(b.y - a.y, b.x - a.x)
        }
        return (0 until n).map { i ->
            val a = pts[i]; val b = pts[(i + 1) % n]
            val len = hypot(b.x - a.x, b.y - a.y)
            val turn = normalizeDeg(Math.toDegrees(heads[(i + 1) % n] - heads[i]))
            WallEntity(roomId = roomId, idx = i, length = len, height = heightMm, angle = turn)
        }
    }

    // ------------------------------------------------------------------
    // גנרטורי-הקודקודים לכל צורה (CCW, במ"מ)
    // ------------------------------------------------------------------

    /** מלבן W×H — גם "ריבוע-מהיר" (`#f-plan-box`). */
    fun rectangleVerts(w: Double, h: Double): List<Pt> =
        listOf(Pt(0.0, 0.0), Pt(w, 0.0), Pt(w, h), Pt(0.0, h))

    /**
     * צורת-L: מלבן חיצוני W×H שממנו הוסר מלבן-פינה (חתך) בפינה הימנית-עליונה.
     * @param cutW רוחב-החתך (מ"מ, < W). @param cutH גובה-החתך (מ"מ, < H).
     */
    fun lVerts(w: Double, h: Double, cutW: Double, cutH: Double): List<Pt> {
        val cw = cutW.coerceIn(1.0, w - 1.0)
        val ch = cutH.coerceIn(1.0, h - 1.0)
        return listOf(
            Pt(0.0, 0.0), Pt(w, 0.0), Pt(w, h - ch),
            Pt(w - cw, h - ch), Pt(w - cw, h), Pt(0.0, h),
        )
    }

    /**
     * צורת-U: מלבן חיצוני W×H עם מגרעת מלבנית מהקצה-העליון (פתח כלפי מעלה).
     * @param leftArm  רוחב הזרוע-השמאלית (a). @param rightArm רוחב הזרוע-הימנית (b).
     * @param notchDepth עומק-המגרעת (d, < H). רוחב-המגרעת = W − a − b (חייב > 0).
     */
    fun uVerts(w: Double, h: Double, leftArm: Double, rightArm: Double, notchDepth: Double): List<Pt> {
        val a = leftArm.coerceIn(1.0, w - 2.0)
        val b = rightArm.coerceIn(1.0, w - a - 1.0)
        val d = notchDepth.coerceIn(1.0, h - 1.0)
        return listOf(
            Pt(0.0, 0.0), Pt(w, 0.0), Pt(w, h),
            Pt(w - b, h), Pt(w - b, h - d),
            Pt(a, h - d), Pt(a, h), Pt(0.0, h),
        )
    }

    /**
     * צורת-T: פס-עליון ברוחב-מלא W בגובה [barH], ורגל מרכזית ברוחב [stemW] כלפי מטה.
     */
    fun tVerts(w: Double, h: Double, stemW: Double, barH: Double): List<Pt> {
        val sw = stemW.coerceIn(1.0, w - 1.0)
        val bh = barH.coerceIn(1.0, h - 1.0)
        val sl = (w - sw) / 2.0
        val sr = (w + sw) / 2.0
        return listOf(
            Pt(sl, 0.0), Pt(sr, 0.0), Pt(sr, h - bh),
            Pt(w, h - bh), Pt(w, h), Pt(0.0, h),
            Pt(0.0, h - bh), Pt(sl, h - bh),
        )
    }

    /**
     * צורת-Z: מלבן-תחתון (w1×h1) ומלבן-עליון (w2×h2) מוזז ימינה ב-[offset]
     * (מדרגה). דרוש 0 < offset < w1 ו-offset+w2 > w1.
     */
    fun zVerts(w1: Double, h1: Double, w2: Double, h2: Double, offset: Double): List<Pt> {
        val off = offset.coerceIn(1.0, w1 - 1.0)
        val topRight = (off + w2).coerceAtLeast(w1 + 1.0)
        return listOf(
            Pt(0.0, 0.0), Pt(w1, 0.0), Pt(w1, h1),
            Pt(topRight, h1), Pt(topRight, h1 + h2),
            Pt(off, h1 + h2), Pt(off, h1), Pt(0.0, h1),
        )
    }

    // ------------------------------------------------------------------
    // עזרי-גאומטריה פנימיים
    // ------------------------------------------------------------------

    private fun dedup(v: List<Pt>): List<Pt> {
        if (v.isEmpty()) return v
        val out = ArrayList<Pt>(v.size)
        for (p in v) {
            val last = out.lastOrNull()
            if (last == null || hypot(p.x - last.x, p.y - last.y) > 1e-6) out.add(p)
        }
        // הסר כפילות קצה-אל-קצה (המצולע סגור מרומז)
        if (out.size >= 2 && hypot(out.first().x - out.last().x, out.first().y - out.last().y) <= 1e-6) {
            out.removeAt(out.size - 1)
        }
        return out
    }

    private fun normalizeDeg(deg: Double): Double {
        var d = deg % 360.0
        if (d <= -180.0) d += 360.0
        if (d > 180.0) d -= 360.0
        return d
    }
}
