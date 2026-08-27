package il.co.soline.measure.fit

import kotlin.math.abs
import kotlin.math.roundToInt

/*
 * Soline — הרחבת מנוע-ההתאמה (kitchen_layout_fitting §4).
 * חוקים טהורים R1 / R2 / R3 / R5 / R9 — משלימים את R4 שכבר חי ב-FitEngine.kt.
 * כל המידות במילימטרים (עקבי עם FitEngine). Severity/FitDelta/FitConfig מיובאים כמות-שהם.
 *
 * הערת-מודל: חלק מהחוקים דורשים קלט שמודל-הנתונים הנוכחי (Cabinet/Protrusion/Wall)
 * עדיין לא נושא — קיר-כפונקציה-של-גובה, אזורי-הנמכה, מפלס-רצפה (§4 פריטים 1/4).
 * לכן מוגדרות כאן מחלקות-קלט מקומיות מינימליות, כל אחת עם ההנחה שלה מתועדת.
 * הן זמניות עד שמודל-הליבה יורחב (החלטה #12 — "הקיר אינו קו, הוא פרופיל").
 */

/** ספי-בדיקה להרחבה (במ"מ / מעלות). ברירות-מחדל שמרניות משטח. */
data class RulesExtraConfig(
    val rowToleranceMm: Double = 5.0,        // R1 — פער/עודף מתחת לזה = "נכנס בול"
    val rowFillerMaxMm: Double = 100.0,      // R1 — מעל מילואה כזו (§3.3) עדיף פתרון אחר
    val plumbToleranceMm: Double = 5.0,      // R2 — הפרש-רוחב בין גבהים מתחת לזה = אנך
    val plumbBlockMm: Double = 20.0,         // R2 — מעל זה החריגה חוסמת
    val angleToleranceDeg: Double = 1.0,     // R3 — סטייה מ-90° מתחת לזה = זניחה
    val angleBlockDeg: Double = 3.0,         // R3 — מעל זה הפינה חוסמת
    val ceilingClearMm: Double = 0.0,        // R5 — מרווח-בטיחות נדרש מתחת להנמכה
    val floorToleranceMm: Double = 5.0,      // R9 — הפרש-מפלס מתחת לזה = מפלס אחיד
    val floorBlockMm: Double = 30.0,         // R9 — מעל זה נדרשת התאמת רגלי-פילוס משמעותית
)

private fun round1(v: Double): Double = (v * 10.0).roundToInt() / 10.0
private fun overlap1D(aStart: Double, aEnd: Double, bStart: Double, bEnd: Double): Double =
    minOf(aEnd, bEnd) - maxOf(aStart, bStart) // > 0 = חופפים

/* ---------- R1: שורה לא נכנסת ---------- */

/** מרווח מתוכנן בין ארונות בשורה (מרווח-הצללה/חלוקה, §3.3) — נספר לרוחב-השורה. */
data class RowGap(val widthMm: Double)

/**
 * R1 — שורת-ארונות מול אורך-קיר-נמדד.
 * טריגר: Σ(רוחבי-ארונות) + Σ(מרווחים) ≠ אורך-הקיר ±tol.
 * חוסר (השורה ארוכה מהקיר) = BLOCK; עודף (נשאר פער) = WARN עם הצעת מילואה.
 * הנחה: כל הארונות שייכים לאותו קיר; wallLengthMm הוא האורך שנמדד בשטח.
 */
fun ruleR1(
    wallId: String,
    wallLengthMm: Double,
    cabinets: List<Cabinet>,
    gaps: List<RowGap> = emptyList(),
    cfg: RulesExtraConfig = RulesExtraConfig(),
): List<FitDelta> {
    val row = cabinets.filter { it.wallId == wallId }
    if (row.isEmpty()) return emptyList()
    val sumCab = row.sumOf { it.width }
    val sumGap = gaps.sumOf { it.widthMm }
    val need = sumCab + sumGap
    val delta = need - wallLengthMm            // חיובי = חוסר (לא נכנס); שלילי = עודף
    if (abs(delta) <= cfg.rowToleranceMm) return emptyList()
    val anchor = row.first().id
    return if (delta > 0) {
        val d = round1(delta)
        listOf(
            FitDelta(
                rule = "R1",
                severity = Severity.BLOCK,
                cabinetId = anchor,
                protrusionId = null,
                delta = d,
                message = "השורה בקיר \"$wallId\" ארוכה מהמידה שנמדדה ב-$d מ\"מ — הארונות לא נכנסים",
                suggestion = "לצמצם/להחליף מודול (למשל 80→70) או להזיז מכשיר",
            )
        )
    } else {
        val gap = round1(-delta)
        val over = gap > cfg.rowFillerMaxMm
        listOf(
            FitDelta(
                rule = "R1",
                severity = if (over) Severity.WARN else Severity.INFO,
                cabinetId = anchor,
                protrusionId = null,
                delta = gap,
                message = "נשאר פער של $gap מ\"מ בין השורה לקיר \"$wallId\"",
                suggestion = if (over)
                    "פער גדול ($gap מ\"מ > ${cfg.rowFillerMaxMm.toInt()}) — לשקול מודול נוסף במקום מילואה בלבד"
                else
                    "להשלים במילואה/פילר ברוחב $gap מ\"מ",
            )
        )
    }
}

/* ---------- R2: קיר לא-אנך ---------- */

/**
 * פרופיל-רוחב אנכי של קיר (§4 פריט 1) — רוחב שנמדד בשני גבהים.
 * הנחה: מודל הליבה עדיין סקלרי (WallEntity.length); כאן מדמים "רוחב@גובה".
 */
data class WallPlumbProfile(
    val wallId: String,
    val widthAtBottomMm: Double, // רוחב בגובה-תחתון (סמוך לרצפה)
    val widthAtTopMm: Double,    // רוחב בגובה-עליון (סמוך לתקרה/הנמכה)
    val bottomHeightMm: Double = 100.0,
    val topHeightMm: Double = 2200.0,
)

/**
 * R2 — קיר לא-אנך.
 * טריגר: |רוחב@עליון − רוחב@תחתון| > tol → פער משתנה לאורך גב-הארון.
 */
fun ruleR2(profile: WallPlumbProfile, cfg: RulesExtraConfig = RulesExtraConfig()): List<FitDelta> {
    val diff = abs(profile.widthAtTopMm - profile.widthAtBottomMm)
    if (diff <= cfg.plumbToleranceMm) return emptyList()
    val d = round1(diff)
    val block = diff >= cfg.plumbBlockMm
    val narrowTop = profile.widthAtTopMm < profile.widthAtBottomMm
    return listOf(
        FitDelta(
            rule = "R2",
            severity = if (block) Severity.BLOCK else Severity.WARN,
            cabinetId = "wall:${profile.wallId}",
            protrusionId = null,
            delta = d,
            message = "קיר \"${profile.wallId}\" לא-אנך — פער משתנה עד $d מ\"מ " +
                "(${if (narrowTop) "צר בראש" else "צר בבסיס"})",
            suggestion = if (block)
                "פער גדול — לשקול קיר-גבס יישור; אחרת מילואה מדורגת לאורך הגובה"
            else
                "לספוג במילואה/פילר בקצה השורה",
        )
    )
}

/* ---------- R3: זווית-פינה סוטה ---------- */

/**
 * פינה בין שני קירות שנושאים יחידות-נגרות.
 * angleDeg = הזווית הפנימית שנמדדה (ORDX field Angle). unitsA/unitsB = מס' יחידות בכל צלע.
 */
data class CornerJoin(
    val id: String,
    val angleDeg: Double,
    val unitsA: Int = 1,
    val unitsB: Int = 1,
)

/**
 * R3 — זווית-פינה סוטה מ-90°.
 * טריגר: Angle ≠ 90°±tol בפינה עם ≥2 יחידות (הפינה מכפילה את השגיאה, §1.3).
 * זווית < 90 = חפיפה בין היחידות (BLOCK בגדול); > 90 = פער.
 */
fun ruleR3(corner: CornerJoin, cfg: RulesExtraConfig = RulesExtraConfig()): List<FitDelta> {
    val dev = corner.angleDeg - 90.0
    if (abs(dev) <= cfg.angleToleranceDeg) return emptyList()
    if (corner.unitsA + corner.unitsB < 2) return emptyList() // פינה בלי 2 יחידות — לא רלוונטי
    val block = abs(dev) >= cfg.angleBlockDeg
    val overlap = dev < 0
    val d = round1(abs(dev))
    return listOf(
        FitDelta(
            rule = "R3",
            severity = if (block) Severity.BLOCK else Severity.WARN,
            cabinetId = "corner:${corner.id}",
            protrusionId = null,
            delta = d,
            message = "פינה \"${corner.id}\" בזווית ${round1(corner.angleDeg)}° — " +
                (if (overlap) "חפיפה" else "פער") + " בין שתי היחידות",
            suggestion = if (overlap)
                "לנסר/לקצר יחידת-פינה כדי למנוע חפיפה"
            else
                "מילואה/מרווח-הצללה בפינה לספיגת הפער",
        )
    )
}

/* ---------- R5: חריגת-הנמכה ---------- */

/**
 * אזור-הנמכת-תקרה (§4 פריט 4) — גבס/מיזוג/ארגז-תריס שיורד מהתקרה.
 * fromLeft/width = ההיטל האופקי של ההנמכה על הקיר; dropBottomMm = גובה תחתית-ההנמכה מהרצפה.
 * הנחה: מיוצג כאזור, לא כתקרה-אחידה — כי הגובה לא-אחיד לאורך הקיר (§3.6).
 */
data class CeilingDropZone(
    val id: String,
    val wallId: String,
    val fromLeft: Double,
    val width: Double,
    val dropBottomMm: Double, // גובה תחתית-ההנמכה מהרצפה
)

/**
 * R5 — ארון-גבוה חורג את ההנמכה.
 * טריגר: heightTo של ארון tall > dropBottom באזור שחופף לו אופקית.
 */
fun ruleR5(
    cabinets: List<Cabinet>,
    drops: List<CeilingDropZone>,
    cfg: RulesExtraConfig = RulesExtraConfig(),
): List<FitDelta> {
    val out = mutableListOf<FitDelta>()
    for (cab in cabinets) {
        if (cab.kind != "tall") continue // רק ארונות-גבוהים/עמודות מגיעים לתקרה
        val cabL = cab.fromLeft; val cabR = cab.fromLeft + cab.width
        for (z in drops) {
            if (z.wallId != cab.wallId) continue
            if (overlap1D(cabL, cabR, z.fromLeft, z.fromLeft + z.width) <= 0) continue
            val over = cab.heightTo - (z.dropBottomMm - cfg.ceilingClearMm)
            if (over <= 0) continue
            val d = round1(over)
            out.add(
                FitDelta(
                    rule = "R5",
                    severity = Severity.BLOCK,
                    cabinetId = cab.id,
                    protrusionId = null,
                    delta = d,
                    message = "הארון \"${cab.name}\" חורג את הנמכת-התקרה \"${z.id}\" ב-$d מ\"מ",
                    suggestion = "לקצר את הארון או לבצע פינוי מקומי סביב ההנמכה/ארגז-התריס",
                )
            )
        }
    }
    return out
}

/* ---------- R9: מפלס-רצפה ---------- */

/**
 * פרופיל-מפלס-רצפה לאורך קיר (§4 פריט 1) — גובה-רצפה בשני קצוות.
 * הנחה: המודל עדיין לא נושא מפלס-רצפה; ערכים במ"מ יחסית לנקודת-אפס של החדר.
 */
data class FloorLevelProfile(
    val wallId: String,
    val levelLeftMm: Double,
    val levelRightMm: Double,
)

/**
 * R9 — רצפה לא-מפלסת.
 * טריגר: |מפלס-שמאל − מפלס-ימין| > tol → הצוקל נבלע / נדרשות רגלי-פילוס.
 */
fun ruleR9(profile: FloorLevelProfile, cfg: RulesExtraConfig = RulesExtraConfig()): List<FitDelta> {
    val diff = abs(profile.levelLeftMm - profile.levelRightMm)
    if (diff <= cfg.floorToleranceMm) return emptyList()
    val d = round1(diff)
    val block = diff >= cfg.floorBlockMm
    return listOf(
        FitDelta(
            rule = "R9",
            severity = if (block) Severity.WARN else Severity.INFO,
            cabinetId = "wall:${profile.wallId}",
            protrusionId = null,
            delta = d,
            message = "רצפה לא-מפלסת לאורך קיר \"${profile.wallId}\" — הפרש $d מ\"מ בין הקצוות",
            suggestion = if (block)
                "התאמת רגלי-פילוס + חיתוך צוקל בהתאמה; לשמור מידת-גובה לא-סופית עד ריצוף"
            else
                "רגלי-פילוס יספגו את ההפרש",
        )
    )
}
