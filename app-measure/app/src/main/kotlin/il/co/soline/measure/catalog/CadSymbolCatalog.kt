package il.co.soline.measure.catalog

/*
 * קטלוג סמלי-CAD של Soline Measure — סמלי-סימון מובנים מקובצים לפי דיסציפלינה
 * (מולטימדיה/חשמל, ריהוט, סניטרי, מבנה), משורטטים לפי מוסכמות-שרטוט מקובלות.
 *
 * הסמלים הם שכבת-סימון (annotation) על-גבי השרטוט — נבדלים מ-AccessoryEntity (בליטה נמדדת)
 * ומ-CabinetEntity (מודול-ריהוט). לכל סמל ציור-תוכנית וציור-חזית (SymbolGlyphs).
 *
 * הקטלוג הזה הוא נתונים-טהורים (אין תלות ב-Compose). הציור הוקצה ל-ui/cad/symbols/SymbolGlyphs.kt.
 * הסמלים המותאמים-אישית נשמרים ב-Room (CustomSymbolStore) ומתמזגים לתצוגה כאן דרך [allWith].
 */

/** חמש קטגוריות הבורר הדו-שלבי. "הסמלים שלי" = מותאמים-אישית. */
object CadSymbolCategory {
    const val MEDIA_ELEC = "מולטימדיה וחשמל"
    const val FURNITURE = "ריהוט"
    const val APPLIANCES = "מוצרי חשמל ואינסטלציה"
    const val STRUCTURAL = "אלמנטים מבניים"
    const val CUSTOM = "הסמלים שלי"

    /** סדר-התצוגה הקבוע בבורר (מותאמים-אישית תמיד אחרונים). */
    val order: List<String> = listOf(MEDIA_ELEC, FURNITURE, APPLIANCES, STRUCTURAL, CUSTOM)
}

/**
 * צורת-בסיס לסמל מותאם-אישית (מדריך §f-cad-symbol · "סמל חדש"):
 * "מלבן / מלבן מעוגל / עיגול / משולש / מעוין".
 * לסמלים מובנים הערך הוא [BUILTIN] — הציור נגזר מהמפתח ולא מצורת-בסיס גנרית.
 */
enum class CadSymbolShape(val he: String) {
    BUILTIN("מובנה"),
    RECT("מלבן"),
    ROUNDED_RECT("מלבן מעוגל"),
    CIRCLE("עיגול"),
    TRIANGLE("משולש"),
    RHOMBUS("מעוין");

    companion object {
        /** צורות-הבסיס הזמינות ליצירת סמל מותאם (בלי [BUILTIN]). */
        val customChoices: List<CadSymbolShape> = listOf(RECT, ROUNDED_RECT, CIRCLE, TRIANGLE, RHOMBUS)
        fun of(name: String?): CadSymbolShape = entries.firstOrNull { it.name == name } ?: RECT
    }
}

/** נקודת-מבט לציור הסמל — התוכנית והחזית מציירות אותו סמל אחרת (מדריך §f-elev-cadsymbol). */
enum class CadSymbolView { PLAN, ELEVATION }

/**
 * הגדרת סמל-CAD אחד.
 *
 * @param key      מזהה יציב. מובנה = שם-קבוע (למשל "SYM_TV"); מותאם = קידומת [CustomSymbolStore.PREFIX].
 * @param he       שם-תצוגה בעברית (הכיתוב-האוטומטי המודפס — מדריך §f-cad-symbol).
 * @param category אחת מ-[CadSymbolCategory].
 * @param widthMm  רוחב ברירת-מחדל בתוכנית (מ"מ).
 * @param heightMm גובה/עומק-בתוכנית ברירת-מחדל (מ"מ) — בחזית משמש כגובה.
 * @param depthMm  עומק-בליטה מהקיר (מ"מ) — 0 לרוב הסמלים (סימון, לא בליטה נמדדת).
 * @param shape    צורת-בסיס. [CadSymbolShape.BUILTIN] לסמלים מובנים.
 * @param builtin  true לסמלי-הספרייה (קריאה-בלבד); false למותאמים-אישית (עריכה/מחיקה).
 */
data class CadSymbolDef(
    val key: String,
    val he: String,
    val category: String,
    val widthMm: Double,
    val heightMm: Double,
    val depthMm: Double = 0.0,
    val shape: CadSymbolShape = CadSymbolShape.BUILTIN,
    val builtin: Boolean = true,
)

/** קטלוג 25 הסמלים המובנים + מיזוג עם המותאמים-אישית. */
object CadSymbolCatalog {

    val all: List<CadSymbolDef> = listOf(
        // ── מולטימדיה וחשמל (8) ───────────────────────────────────────────────
        CadSymbolDef("SYM_TV", "טלוויזיה", CadSymbolCategory.MEDIA_ELEC, 1200.0, 700.0),
        CadSymbolDef("SYM_SPEAKER", "רמקול", CadSymbolCategory.MEDIA_ELEC, 200.0, 300.0),
        CadSymbolDef("SYM_PROJECTOR", "מקרן", CadSymbolCategory.MEDIA_ELEC, 300.0, 200.0),
        CadSymbolDef("SYM_THERMOSTAT", "תרמוסטט", CadSymbolCategory.MEDIA_ELEC, 90.0, 90.0),
        CadSymbolDef("SYM_INTERCOM", "אינטרקום", CadSymbolCategory.MEDIA_ELEC, 120.0, 180.0),
        CadSymbolDef("SYM_SMOKE_DETECTOR", "גלאי עשן", CadSymbolCategory.MEDIA_ELEC, 150.0, 150.0),
        CadSymbolDef("SYM_NETWORK_POINT", "נקודת רשת", CadSymbolCategory.MEDIA_ELEC, 90.0, 90.0),
        CadSymbolDef("SYM_CEILING_FAN", "מאוורר תקרה", CadSymbolCategory.MEDIA_ELEC, 1200.0, 1200.0),

        // ── ריהוט (6) ─────────────────────────────────────────────────────────
        CadSymbolDef("SYM_TABLE", "שולחן", CadSymbolCategory.FURNITURE, 1400.0, 800.0),
        CadSymbolDef("SYM_CHAIR", "כיסא", CadSymbolCategory.FURNITURE, 450.0, 450.0),
        CadSymbolDef("SYM_SOFA", "ספה", CadSymbolCategory.FURNITURE, 2000.0, 900.0),
        CadSymbolDef("SYM_BED", "מיטה", CadSymbolCategory.FURNITURE, 1600.0, 2000.0),
        CadSymbolDef("SYM_DESK", "שולחן עבודה", CadSymbolCategory.FURNITURE, 1200.0, 600.0),
        CadSymbolDef("SYM_WARDROBE", "ארון בגדים", CadSymbolCategory.FURNITURE, 1500.0, 600.0),

        // ── מוצרי חשמל ואינסטלציה (6) ─────────────────────────────────────────
        CadSymbolDef("SYM_WASHER", "מכונת כביסה", CadSymbolCategory.APPLIANCES, 600.0, 850.0),
        CadSymbolDef("SYM_DRYER", "מייבש כביסה", CadSymbolCategory.APPLIANCES, 600.0, 850.0),
        CadSymbolDef("SYM_SHOWER", "מקלחת", CadSymbolCategory.APPLIANCES, 900.0, 900.0),
        CadSymbolDef("SYM_RADIATOR", "רדיאטור", CadSymbolCategory.APPLIANCES, 800.0, 600.0),
        CadSymbolDef("SYM_WATER_HEATER", "דוד מים", CadSymbolCategory.APPLIANCES, 500.0, 500.0),
        CadSymbolDef("SYM_SINK", "כיור", CadSymbolCategory.APPLIANCES, 600.0, 450.0),

        // ── אלמנטים מבניים (5) ────────────────────────────────────────────────
        CadSymbolDef("SYM_COLUMN", "עמוד", CadSymbolCategory.STRUCTURAL, 300.0, 300.0),
        CadSymbolDef("SYM_STAIRS", "מדרגות", CadSymbolCategory.STRUCTURAL, 1000.0, 2400.0),
        CadSymbolDef("SYM_NICHE", "נישה", CadSymbolCategory.STRUCTURAL, 600.0, 400.0),
        CadSymbolDef("SYM_VENT_SHAFT", "פיר אוורור", CadSymbolCategory.STRUCTURAL, 400.0, 400.0),
        CadSymbolDef("SYM_OPENING_MARK", "סימון פתח", CadSymbolCategory.STRUCTURAL, 900.0, 2100.0),
    )

    /** האם המפתח שייך לסמל מובנה של הספרייה. */
    fun isBuiltin(key: String): Boolean = all.any { it.key == key }

    fun of(key: String): CadSymbolDef? = all.firstOrNull { it.key == key }

    // ── תצוגה ממוזגת: מובנה + מותאם-אישית (מ-CustomSymbolStore.allAsDefs) ─────

    /** כל הסמלים — מובנים תחילה ואז המותאמים-אישית. */
    fun allWith(custom: List<CadSymbolDef>): List<CadSymbolDef> = all + custom

    /**
     * מקובץ לפי [CadSymbolCategory.order], כולל המותאמים-אישית בקבוצת "הסמלים שלי".
     * קבוצה ריקה מושמטת (כך שקבוצת-המותאמים לא מוצגת כשאין סמלים אישיים).
     */
    fun byCategoryWith(custom: List<CadSymbolDef>): List<Pair<String, List<CadSymbolDef>>> {
        val merged = all + custom
        return CadSymbolCategory.order
            .map { c -> c to merged.filter { it.category == c } }
            .filter { it.second.isNotEmpty() }
    }

    /** חיפוש במרחב הממוזג (מובנה + מותאם). */
    fun ofWith(key: String, custom: List<CadSymbolDef>): CadSymbolDef? =
        of(key) ?: custom.firstOrNull { it.key == key }
}
