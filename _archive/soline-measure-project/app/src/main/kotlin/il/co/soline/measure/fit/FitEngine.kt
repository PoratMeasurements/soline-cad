package il.co.soline.measure.fit

/*
 * מנוע ההתאמה של Soline — הבידול (החלטות #11 / #13).
 * מניח את תכנון-הנגר (שכבה A) על המדידה בשטח (שכבה B) ומריץ את חוקי R1–R10
 * (kitchen_layout_fitting §4). גרסה 0.1 — מיושם R4 (בליטה מול עומק).
 * כל המידות במילימטרים. לוגיקה טהורה — בעתיד תעבור למודול core:fit-engine נפרד.
 */

/** בליטה על קיר (שכבה B — נמדד): שקע / גז / מים / עמוד / ארגז-תריס */
data class Protrusion(
    val id: String,
    val type: String,
    val name: String,
    val depth: Double,       // D — עומק-הבליטה מהקיר (מ"מ) — "האויב מס' 1"
    val fromLeft: Double,    // מיקום אופקי משמאל-הקיר
    val width: Double,
    val fromBottom: Double,  // גובה תחתית מהרצפה
    val height: Double,
)

/** ארון (שכבה A — תכנון-הנגר) */
data class Cabinet(
    val id: String,
    val kind: String,        // base | upper | tall
    val name: String,
    val wallId: String,
    val fromLeft: Double,
    val width: Double,
    val depth: Double,
    val heightFrom: Double,  // תחתית גב-הארון מהרצפה
    val heightTo: Double,    // ראש גב-הארון מהרצפה
    val backClearance: Double = 0.0, // מרווח-גב מתוכנן (פינוי-גב/סוקל-נסוג)
)

data class Wall(val id: String, val protrusions: List<Protrusion>)

enum class Severity { BLOCK, WARN, INFO }

/** ממצא של מנוע-ההתאמה */
data class FitDelta(
    val rule: String,
    val severity: Severity,
    val cabinetId: String,
    val protrusionId: String?,
    val delta: Double,       // גודל-החריגה במ"מ (חיובי = בעיה)
    val message: String,
    val suggestion: String,
)

data class FitConfig(
    val minProtrusionDepth: Double = 3.0,  // מתחת לזה — רעש-מדידה
    val backCollisionBlock: Double = 15.0, // מעל זה = חסימה, מתחת = אזהרה
)

object FitEngine {

    private fun overlap1D(aStart: Double, aEnd: Double, bStart: Double, bEnd: Double): Double =
        minOf(aEnd, bEnd) - maxOf(aStart, bStart) // > 0 = חופפים

    /** R4 — התנגשות-בליטה: D > מרווח-גב, בחפיפה אופקית ובטווח-הגובה של הארון */
    fun ruleR4(cabinet: Cabinet, protrusions: List<Protrusion>, cfg: FitConfig): List<FitDelta> {
        val out = mutableListOf<FitDelta>()
        val back = cabinet.backClearance
        val cabL = cabinet.fromLeft; val cabR = cabinet.fromLeft + cabinet.width
        for (p in protrusions) {
            if (p.depth <= cfg.minProtrusionDepth) continue
            val hOv = overlap1D(cabL, cabR, p.fromLeft, p.fromLeft + p.width)
            val vOv = overlap1D(cabinet.heightFrom, cabinet.heightTo, p.fromBottom, p.fromBottom + p.height)
            if (hOv <= 0 || vOv <= 0) continue          // הבליטה לא מאחורי הארון
            val delta = p.depth - back
            if (delta <= 0) continue                     // המרווח-המתוכנן סופג אותה
            val block = delta >= cfg.backCollisionBlock
            val d = Math.round(delta * 10.0) / 10.0
            out.add(
                FitDelta(
                    rule = "R4",
                    severity = if (block) Severity.BLOCK else Severity.WARN,
                    cabinetId = cabinet.id,
                    protrusionId = p.id,
                    delta = d,
                    message = "התנגשות: ${p.name} בולט ${p.depth} מ\"מ אל גב הארון \"${cabinet.name}\" " +
                        "(מרווח-גב ${back.toInt()} מ\"מ) — חורג $d מ\"מ",
                    suggestion = if (block)
                        "פינוי-גב סביב הבליטה / הזזת-התשתית / ביטול — טעון אישור"
                    else
                        "לשקול פינוי-גב קל או מרווח-גב מתוכנן",
                )
            )
        }
        return out
    }

    /** הליבה: תכנון (A) + מדידה (B) → רשימת ממצאים, חסימות קודם */
    fun evaluate(cabinets: List<Cabinet>, walls: List<Wall>, cfg: FitConfig = FitConfig()): List<FitDelta> {
        val byWall = walls.associateBy({ it.id }, { it.protrusions })
        val deltas = mutableListOf<FitDelta>()
        for (cab in cabinets) {
            val prot = byWall[cab.wallId] ?: emptyList()
            deltas.addAll(ruleR4(cab, prot, cfg))
        }
        return deltas.sortedWith(
            compareByDescending<FitDelta> { it.severity == Severity.BLOCK }.thenByDescending { it.delta }
        )
    }
}

/** דמו על נתונים ריאליסטיים — קיר מטבח עם שקע, צינור-גז וברז-מים; ארון בסיס 60 ס"מ */
fun demoFit(): List<FitDelta> {
    val wall = Wall(
        id = "wall-1",
        protrusions = listOf(
            Protrusion("p1", "SOCKET_SINGLE", "שקע", depth = 6.8, fromLeft = 300.0, width = 85.0, fromBottom = 250.0, height = 77.0),
            Protrusion("p2", "GAS_PIPE", "צינור גז", depth = 20.0, fromLeft = 700.0, width = 40.0, fromBottom = 200.0, height = 40.0),
            Protrusion("p3", "WATER_PIPE", "ברז מים", depth = 8.0, fromLeft = 1500.0, width = 40.0, fromBottom = 300.0, height = 40.0),
        )
    )
    // ארון בסיס 60 שמכסה 250–850 מ"מ, רוחב 250..850 — סופג את השקע והגז, לא את הברז
    val cab = Cabinet("c1", "base", "ארון בסיס 60", wallId = "wall-1", fromLeft = 250.0, width = 600.0, depth = 580.0, heightFrom = 100.0, heightTo = 850.0)
    return FitEngine.evaluate(listOf(cab), listOf(wall))
}
