package il.co.soline.measure.catalog

/* קטלוג-אלמנטים עשיר של Soline Measure — wishlist §5 ("אלמנטים ואובייקטים").
 *
 * זהו קטלוג עצמאי, עשיר יותר מ-AccType הבסיסי שב-data/Entities.kt:
 *   • אובייקטים עגולים עם מימד-עומק (round=true)
 *   • פאנלים (פאנל)
 *   • סימוני-ייחוס: שטיכמוס (stichmaß) וקו-תקרה עתידי
 *   • כל סוגי-האלמנטים של CVSM, מקובצים לפי תחום.
 *
 * הקטלוג אינו נוגע ב-AccType/AccessoryEntity — הוא standalone.
 * ה-key תוכנן להיות ה-`type` שנשמר ב-AccessoryEntity כשמתמידים בליטה שנבחרה מהקטלוג. */

/** קבוצות-האלמנטים (wishlist §5 — "חלוקת אובייקטים לפי שיטת-מדידה"). */
object ElementGroup {
    const val ELECTRICAL = "חשמל"
    const val PLUMBING = "אינסטלציה"
    const val OPENINGS = "פתחים"
    const val STRUCTURE = "מבנה"
    const val MARKING = "סימון"

    /** סדר-התצוגה הקבוע של הקבוצות בבורר. */
    val order: List<String> = listOf(ELECTRICAL, PLUMBING, OPENINGS, STRUCTURE, MARKING)
}

/**
 * הגדרת-אלמנט אחת בקטלוג.
 *
 * @param key         מזהה יציב (ISO-safe) — נשמר כ-`AccessoryEntity.type`.
 * @param he          שם-תצוגה בעברית.
 * @param group       אחת מקבוצות [ElementGroup].
 * @param defaultDepth עומק-בליטה D ברירת-מחדל (מ"מ) — יסוד R4.
 * @param round       אובייקט עגול (מדידת-רדיוס/קוטר במקום רוחב×גובה). wishlist §5.
 * @param hasDepth    האם לאלמנט יש עומק-בליטה כלל (פתחים/סימונים = false).
 */
data class ElementDef(
    val key: String,
    val he: String,
    val group: String,
    val defaultDepth: Double,
    val round: Boolean = false,
    val hasDepth: Boolean = true,
)

/** הקטלוג המורחב — מקור-האמת היחיד לבורר-האלמנטים בשטח. */
object ElementCatalog {
    val all: List<ElementDef> = listOf(
        // ── חשמל ──────────────────────────────────────────────────────────
        ElementDef("SOCKET_SINGLE", "שקע בודד", ElementGroup.ELECTRICAL, 6.8),
        ElementDef("SOCKET_MULTI", "שקע מרובע", ElementGroup.ELECTRICAL, 8.0),
        ElementDef("SWITCH", "מתג", ElementGroup.ELECTRICAL, 6.8),
        ElementDef("ELECTRICAL_LINE", "תשתית חשמל", ElementGroup.ELECTRICAL, 5.0),
        ElementDef("ELECTRICAL_WALL", "תשתית חשמל - קיר", ElementGroup.ELECTRICAL, 5.0),
        ElementDef("ELECTRIC_APPLIANCE", "נקודת מוצר חשמל", ElementGroup.ELECTRICAL, 10.0),
        ElementDef("CEILING_LIGHT", "מנורת תקרה", ElementGroup.ELECTRICAL, 0.0, hasDepth = false),

        // ── אינסטלציה ────────────────────────────────────────────────────
        ElementDef("WATER_PIPE", "מים", ElementGroup.PLUMBING, 30.0),
        ElementDef("GAS_PIPE", "גז", ElementGroup.PLUMBING, 30.0),
        ElementDef("WATER_PIPE_ROUND", "צינור מים עגול", ElementGroup.PLUMBING, 30.0, round = true),
        ElementDef("FLOOR_DRAIN", "ניקוז רצפתי", ElementGroup.PLUMBING, 0.0, round = true),

        // ── פתחים ─────────────────────────────────────────────────────────
        ElementDef("WINDOW", "חלון", ElementGroup.OPENINGS, 0.0, hasDepth = false),
        ElementDef("DOOR", "דלת", ElementGroup.OPENINGS, 0.0, hasDepth = false),
        ElementDef("OPENING_FRAME", "מפתח עם משקוף", ElementGroup.OPENINGS, 0.0, hasDepth = false),
        // wishlist §5: "מדידת פתחים עם משיכה עד הרצפה" במצבים חסומים
        ElementDef("OPENING_TO_FLOOR", "פתח עד הרצפה", ElementGroup.OPENINGS, 0.0, hasDepth = false),

        // ── מבנה ──────────────────────────────────────────────────────────
        ElementDef("COLUMN", "עמוד", ElementGroup.STRUCTURE, 200.0),
        ElementDef("COLUMN_ROUND", "עמוד עגול", ElementGroup.STRUCTURE, 200.0, round = true),
        ElementDef("CEILING_DROP", "הנמכת תקרה", ElementGroup.STRUCTURE, 650.0),
        ElementDef("CEILING_DROP_AC", "הנמכת תקרה עם מזגן", ElementGroup.STRUCTURE, 650.0),
        // wishlist §5: מדידת פאנלים
        ElementDef("PANEL", "פאנל", ElementGroup.STRUCTURE, 16.0),
        // wishlist §5: רשימת אובייקטים עגולים עם מימד-עומק
        ElementDef("ROUND_OBJECT", "אובייקט עגול", ElementGroup.STRUCTURE, 100.0, round = true),

        // ── סימון ─────────────────────────────────────────────────────────
        // wishlist §5: אלמנט-סימון שטיכמוס (reference/stichmaß)
        ElementDef("STICHMASS", "שטיכמוס (סימן ייחוס)", ElementGroup.MARKING, 0.0, hasDepth = false),
        // wishlist §5: אלמנט-סימון קו-תקרה עתידי
        ElementDef("FUTURE_CEILING_LINE", "קו-תקרה עתידי", ElementGroup.MARKING, 0.0, hasDepth = false),
        ElementDef("FUTURE_CEILING", "תקרה עתידית", ElementGroup.MARKING, 0.0, hasDepth = false),
    )

    /** אלמנטים מקובצים, לפי סדר-התצוגה של [ElementGroup.order]. */
    val byGroup: List<Pair<String, List<ElementDef>>> =
        ElementGroup.order.map { g -> g to all.filter { it.group == g } }

    fun of(key: String): ElementDef? = all.firstOrNull { it.key == key }
}

/**
 * סטטוס-מדידה (wishlist §6 — "סטטוס-שינויים בבנייה ומידות-סופיות").
 * מתעד באיזה שלב-בנייה נמדד האלמנט/הקיר, כדי שהמפעל ידע אם המידה סופית.
 */
enum class MeasureStatus(val he: String) {
    FINAL("מידה סופית"),
    AFTER_FLOORING("אחרי ריצוף"),
    AFTER_GYPSUM("אחרי גבס"),
    AFTER_CLADDING("אחרי חיפוי"),
}

/** ייעוד-הערה — לפי מי שקורא אותה (wishlist §6 — "פילטר-טקסט: מודד / מפעל / תצוגה"). */
enum class NoteRole(val he: String) {
    SURVEYOR("מודד"),
    FACTORY("מפעל"),
    DISPLAY("תצוגה"),
}

/** הערת-שטח בודדת, מתויגת בייעוד. */
data class FieldNote(
    val role: NoteRole,
    val text: String,
)
