package il.co.soline.measure.data

/**
 * RoomSurvey — עזרי-סריאליזציה לשדות-המודד ברמת-החדר (נקבעים בתחילת-המדידה):
 * `heightSweepMm` (מערך-גבהים) ו-`futureChanges` (הערות-שינויים-עתידיים).
 *
 * מקור-אמת יחיד ל-format/parse: גם ה-UI (הזרקת-מודד) וגם ה-[il.co.soline.measure.export.SolWriter]
 * (כתיבת-ה-.sol) עוברים דרך כאן, כדי שהעיגול/הפורמט יהיו זהים בשני-הצדדים. **ללא-תלות**
 * (Pure-Kotlin, בלי `org.json`) — כדי ש-SolWriter יישאר dependency-free ובר-בדיקה ב-JVM.
 */
object RoomSurvey {

    // ── heightSweep: מערך גבהי-תקרה (מ"מ) ──────────────────────────────────────
    /** מפענח CSV ("2650,2700") לרשימת-גבהים חיוביים; מתעלם מערכים לא-תקינים. */
    fun parseHeights(csv: String): List<Double> =
        csv.split(',').mapNotNull { it.trim().toDoubleOrNull() }.filter { it.isFinite() && it > 0.0 }

    /** מסדרן רשימת-גבהים ל-CSV לאחסון (מסנן לא-תקינים). */
    fun heightsToStore(values: List<Double>): String =
        values.filter { it.isFinite() && it > 0.0 }.joinToString(",") { trimNum(it) }

    /** הגובה-המחייב של החדר = המינימום מבין המדידות (null אם אין). */
    fun bindingHeight(values: List<Double>): Double? = values.minOrNull()

    // ── futureChanges: הערות-שינויים-עתידיים ───────────────────────────────────
    /**
     * הערת-שינוי-עתידי אחת. [scope] = "wall" (עם [wallId]) או "room" ([wallId]=-1).
     * [text] = טקסט-חופשי של המודד.
     */
    data class FutureChange(val scope: String, val wallId: Int, val text: String)

    private const val REC = ''  // מפריד-רשומה (record separator)
    private const val UNIT = '' // מפריד-שדה (unit separator)

    /** מפענח את מחרוזת-האחסון לרשימת-הערות (מדלג על רשומות פגומות). */
    fun parseFutureChanges(raw: String): List<FutureChange> {
        if (raw.isBlank()) return emptyList()
        return raw.split(REC).mapNotNull { rec ->
            if (rec.isEmpty()) return@mapNotNull null
            val parts = rec.split(UNIT)
            if (parts.size < 3) return@mapNotNull null
            val scope = parts[0].ifEmpty { "room" }
            val wallId = parts[1].toIntOrNull() ?: -1
            FutureChange(scope = scope, wallId = wallId, text = parts[2])
        }
    }

    /** מסדרן רשימת-הערות למחרוזת-אחסון; מנקה מפרידי-בקרה מהטקסט-החופשי. */
    fun futureChangesToStore(changes: List<FutureChange>): String =
        changes.joinToString(REC.toString()) { c ->
            val safe = c.text.replace(REC, ' ').replace(UNIT, ' ')
            val wall = if (c.scope == "wall") c.wallId else -1
            "${c.scope}$UNIT$wall$UNIT$safe"
        }

    /** ייצוג-מספר קומפקטי: שלם ללא-שבר, אחרת עשרוני נקי. */
    private fun trimNum(v: Double): String =
        if (v % 1.0 == 0.0) v.toLong().toString() else v.toString()
}
