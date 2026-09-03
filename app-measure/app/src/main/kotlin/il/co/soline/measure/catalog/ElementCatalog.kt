package il.co.soline.measure.catalog

/* קטלוג-אלמנטים של Soline Measure — קבוצת האלמנטים הנתמכים בייצוא-ORDX. ערכי
 * ה-ORDX (class/type/name) הם מזהי-הממשק שתוכנת-ה-CAD היעד דורשת כדי לבחור את
 * פריט-הספרייה המתאים — לא תוכן-יצירתי; נשמרים באנגלית כפי שהפורמט מחייב.
 * כל אלמנט נשמר כ-AccessoryEntity.type = key, name = he.
 *
 * הקטלוג עצמאי מ-AccType הבסיסי (data/Entities.kt) — הוא מקור-האמת של בורר-האלמנטים. */

/** קבוצות-האלמנטים. */
object ElementGroup {
    const val ELECTRICAL = "חשמל"
    const val PLUMBING = "אינסטלציה"
    const val APPLIANCES = "מוצרי חשמל"
    const val SANITARY = "סניטרי"
    // ── פתחים כפריטים-מדידים ראשונים-במעלה (owner key-point) — שלוש קבוצות ──
    const val DOORS = "דלתות"
    const val WINDOWS = "חלונות"
    const val HVAC = "מיזוג ואיוורור"
    /** תאימות-לאחור: הקבוצה הישנה "פתחים" (כבר לא ממולאת — הוחלפה בשלוש הקבוצות). */
    const val OPENINGS = "פתחים"
    const val STRUCTURE = "מבנה ותקרה"
    const val OUTDOOR = "מטבח חוץ"
    const val NOTES = "הערות"
    const val MARKING = "סימון"

    /** סדר-התצוגה הקבוע של הקבוצות בבורר. */
    val order: List<String> = listOf(ELECTRICAL, PLUMBING, APPLIANCES, SANITARY, DOORS, WINDOWS, HVAC, STRUCTURE, OUTDOOR, NOTES, MARKING)
}

/**
 * מפרט-פתח פרמטרי (חוזה `OPENING_ELEMENT_SCHEMA.md`) — **מידות-יצרן כברירת-מחדל בלבד**.
 * אתר-בנייה אינו סטרילי: מפרט-היצרן ≠ מידת-שטח. לכן כל ערך כאן הוא ברירת-מחדל
 * ממולאת-מראש שהמודד מאמת/דורס במידת-האמת שנמדדה בשטח.
 *
 * יחידות מ"מ. מקור-המידות: `DOORS_WINDOWS_SIZES.md` (פנדור/רב-בריח/קליל/פיקוד-העורף/ת״י).
 */
data class OpeningSpec(
    val kind: String,                 // door | window | vent | ac
    val width: Double,                // רוחב-פתח (מלבן) ברירת-מחדל
    val height: Double,               // גובה-פתח ברירת-מחדל
    val sillHeight: Double? = null,   // חלונות/פתחי-קיר: רצפה→סף. דלת=null
    val wallThickness: Double = 100.0,// עובי-הקיר המארח
    val frameThickness: Double = 40.0,// ⭐ עובי-משקוף (דלת) / מסגרת (חלון) — קלט מפורש
    val frameReveal: Double = 95.0,   // רוחב-חשפה/מלבן (9.5/12/14 ס"מ)
    val leafThickness: Double = 40.0, // עובי-כנף (דלת)
    val openMode: String = "hinged",  // hinged|sliding|folding|pocket|fixed|kip|awning|hung|double
    val hingeSide: String? = null,    // L | R | null
    val swing: String? = null,        // in | out | null
    val leafCount: Int = 1,
    val glazing: String = "none",     // none | partial | full
)

/**
 * הגדרת-אלמנט אחת בקטלוג.
 *
 * @param key         מזהה יציב — נשמר כ-AccessoryEntity.type.
 * @param he          שם-תצוגה בעברית (כפי שב-CVSM).
 * @param group       אחת מקבוצות [ElementGroup].
 * @param defaultDepth עומק-בליטה D ברירת-מחדל (מ"מ) — יסוד R4.
 * @param round       אובייקט עגול (מדידת-רדיוס/קוטר).
 * @param hasDepth    האם לאלמנט יש עומק-בליטה (פתחים/הערות/סימונים = false).
 * @param ordxClass   מחלקת-ORDX (מאומת-קורפוס) — לייצוא נכון.
 * @param ordxType    טיפוס-ORDX (מאומת-קורפוס).
 */
data class ElementDef(
    val key: String,
    val he: String,
    val group: String,
    val defaultDepth: Double,
    val round: Boolean = false,
    val hasDepth: Boolean = true,
    val ordxClass: String = "Fixture",
    val ordxType: String = "Miscellaneous",
    /**
     * שם-ה-ORDX/InnoDraw המאומת-קורפוס (זהות-האלמנט ב-`<Name>`). ריק ⇒ הייצוא נופל
     * לגזירה-דינמית (דלת-ציר) או לשם-העברי [he]. שמור על תאימות-קורפוס עם
     * `converter/src/element_catalog.js`.
     */
    val ordxName: String = "",
    /** מפרט-פתח (דלת/חלון/מיזוג-איוורור) — ≠null ⇒ נפתח טופס-פתח פרמטרי. */
    val opening: OpeningSpec? = null,
    /**
     * מידות-סטנדרט (מ"מ · בקשת-מודד 120826). >0 ⇒ אלמנט **מידות-קבועות**: הרוחב/הגובה
     * ממולאים-מראש בטופס וניתנים-לעריכה (מקרר/תנור/מדיח/שקע… — גודל-מוכר). 0 ⇒ אלמנט
     * **מידות-משתנות**: המודד מזין מאפס (עמוד/פאנל/צינור…). מקביל ל-OpeningSpec לפתחים.
     */
    val defaultWidth: Double = 0.0,
    val defaultHeight: Double = 0.0,
) {
    /** אלמנט "מידות-קבועות" — יש לו גודל-סטנדרט ממולא-מראש (ניתן-לעריכה). */
    val fixedSize: Boolean get() = defaultWidth > 0.0 || defaultHeight > 0.0

    /**
     * שם-ה-ORDX האפקטיבי לפליטה ל-`<Name>` (נקרא ע"י [il.co.soline.measure.export.OrdxExporter]).
     * סדר-העדיפויות: (1) [ordxName] מפורש אם הוגדר; (2) דלת-ציר עם צד-ציר+כיוון —
     * נגזר דינמית "Hinged {Left|Right} {In|Out}"; (3) אחרת השם-העברי [he].
     * כך זהות-הפתח המאומתת-קורפוס נשמרת גם לאחר מעבר-המודל לפתח-פרמטרי (OpeningSpec).
     */
    fun effectiveOrdxName(): String {
        if (ordxName.isNotBlank()) return ordxName
        val op = opening
        if (op != null && ordxType == "EntryDoor" && op.openMode == "hinged" &&
            op.hingeSide != null && op.swing != null
        ) {
            val h = if (op.hingeSide == "L") "Left" else "Right"
            val s = if (op.swing == "in") "In" else "Out"
            return "Hinged $h $s"
        }
        return he
    }
}

// ── בנאי-קיצור לפריטי-פתח (מקצרים את הקטלוג, שומרים על עקביות-ברירות-המחדל) ──────
private fun door(
    key: String, he: String, w: Double, h: Double,
    mode: String = "hinged", hinge: String? = null, swing: String? = null,
    leaf: Int = 1, glazing: String = "none",
    frameTh: Double = 40.0, reveal: Double = 95.0, leafTh: Double = 40.0, wall: Double = 100.0,
    ordxName: String = "",
) = ElementDef(
    key, he, ElementGroup.DOORS, 0.0, hasDepth = false, ordxClass = "Decorative", ordxType = "EntryDoor",
    ordxName = ordxName,
    opening = OpeningSpec("door", w, h, null, wall, frameTh, reveal, leafTh, mode, hinge, swing, leaf, glazing),
)

private fun window(
    key: String, he: String, w: Double, h: Double, sill: Double = 900.0,
    mode: String = "sliding", frameTh: Double = 60.0, reveal: Double = 95.0, wall: Double = 100.0,
    ordxName: String = "Window",
) = ElementDef(
    key, he, ElementGroup.WINDOWS, 0.0, hasDepth = false, ordxClass = "Decorative", ordxType = "Window",
    ordxName = ordxName,
    opening = OpeningSpec("window", w, h, sill, wall, frameTh, reveal, 0.0, mode, null, null, 1, "full"),
)

private fun vent(
    key: String, he: String, w: Double, h: Double, kind: String = "vent",
    round: Boolean = false, depth: Double = 0.0, sill: Double? = null, hasDepth: Boolean = false,
    ordxName: String = "",
) = ElementDef(
    key, he, ElementGroup.HVAC, depth, round = round, hasDepth = hasDepth,
    ordxClass = "Decorative", ordxType = "Miscellaneous", ordxName = ordxName,
    opening = OpeningSpec(kind, w, h, sill, 100.0, 0.0, 0.0, 0.0, "fixed", null, null, 1, "none"),
)

/** הקטלוג המלא — רשימת "אלמנטים למדידה" של CVSM, ממופה ל-ORDX. */
object ElementCatalog {
    val all: List<ElementDef> = listOf(
        // ── חשמל → ORDX Fixture/Miscellaneous ─────────────────────────────
        ElementDef("SOCKET_SINGLE", "שקע בודד", ElementGroup.ELECTRICAL, 6.8, ordxName = "Socket", defaultWidth = 86.0, defaultHeight = 86.0),
        ElementDef("SOCKET_MULTI", "שקע מרובע", ElementGroup.ELECTRICAL, 8.0, ordxName = "Duplex Socket", defaultWidth = 172.0, defaultHeight = 86.0),
        ElementDef("SWITCH", "מתג", ElementGroup.ELECTRICAL, 6.8, ordxName = "Switch", defaultWidth = 86.0, defaultHeight = 86.0),
        ElementDef("ELECTRICAL_WALL", "תשתית חשמל -קיר", ElementGroup.ELECTRICAL, 5.0, ordxName = "Wall Power Line"),
        ElementDef("ELECTRICAL_LINE", "תשתית חשמל", ElementGroup.ELECTRICAL, 5.0, ordxName = "Power Line"),
        ElementDef("ELECTRIC_APPLIANCE", "נקודת מוצר חשמל", ElementGroup.ELECTRICAL, 10.0, ordxName = "Appliance Outlet"),
        ElementDef("CEILING_LIGHT", "מנורת תקרה", ElementGroup.ELECTRICAL, 0.0, hasDepth = false, ordxClass = "Decorative", ordxName = "Can Light"),

        // ── אינסטלציה → ORDX Fixture/Part ─────────────────────────────────
        ElementDef("WATER_PIPE", "מים", ElementGroup.PLUMBING, 30.0, ordxType = "Part", ordxName = "Water Supply"),
        ElementDef("GAS_PIPE", "גז", ElementGroup.PLUMBING, 30.0, ordxType = "Part", ordxName = "Gas"),
        ElementDef("WATER_PIPE_ROUND", "צינור מים עגול", ElementGroup.PLUMBING, 30.0, round = true, ordxType = "Part", ordxName = "Water Supply Round"),
        ElementDef("FLOOR_DRAIN", "ניקוז רצפתי", ElementGroup.PLUMBING, 0.0, round = true, ordxType = "Part", ordxName = "Sewer drainage"),

        // ── מוצרי חשמל → ORDX Appliance/Accessory ─────────────────────────
        ElementDef("AC_UNIT", "מזגן", ElementGroup.APPLIANCES, 180.0, ordxClass = "Accessory", ordxType = "Miscellaneous", ordxName = "Air Condition", defaultWidth = 900.0, defaultHeight = 300.0),
        ElementDef("REFRIGERATOR", "מקרר", ElementGroup.APPLIANCES, 650.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Refrigerator", defaultWidth = 600.0, defaultHeight = 1780.0),
        ElementDef("OVEN", "תנור", ElementGroup.APPLIANCES, 560.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Oven", defaultWidth = 600.0, defaultHeight = 595.0),
        ElementDef("MICROWAVE", "מיקרוגל", ElementGroup.APPLIANCES, 300.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Microwave", defaultWidth = 595.0, defaultHeight = 390.0),
        ElementDef("DISHWASHER", "מדיח", ElementGroup.APPLIANCES, 570.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "DishWasher", defaultWidth = 600.0, defaultHeight = 820.0),
        ElementDef("WATER_BAR", "תמי4", ElementGroup.APPLIANCES, 130.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Water Bar"),

        // ── סניטרי → ORDX Fixture/Part ────────────────────────────────────
        ElementDef("BATH", "אמבטיה", ElementGroup.SANITARY, 700.0, ordxType = "Part"),
        ElementDef("TOILET", "אסלה", ElementGroup.SANITARY, 650.0, ordxType = "Part", ordxName = "Toilet"),
        ElementDef("SINK", "כיור", ElementGroup.SANITARY, 500.0, ordxType = "Part"),
        ElementDef("SHOWER", "מקלחת", ElementGroup.SANITARY, 900.0, ordxType = "Part", ordxName = "Shower"),

        // ── דלתות → ORDX Decorative/EntryDoor · פתח פרמטרי (מידות-יצרן ברירת-מחדל) ──
        door("DOOR_IN_LEFT", "דלת פנימה שמאל", 900.0, 2050.0, hinge = "L", swing = "in"),
        door("DOOR_IN_RIGHT", "דלת פנימה ימין", 900.0, 2050.0, hinge = "R", swing = "in"),
        door("DOOR_OUT_LEFT", "דלת החוצה שמאל", 900.0, 2050.0, hinge = "L", swing = "out"),
        door("DOOR_OUT_RIGHT", "דלת החוצה ימין", 900.0, 2050.0, hinge = "R", swing = "out"),
        door("DOOR_ENTRANCE", "דלת כניסה / פלדלת", 1000.0, 2100.0, hinge = "R", swing = "in", frameTh = 60.0, leafTh = 50.0, ordxName = "Entrance Door"),
        door("DOOR_MAMAD", "דלת ממ\"ד (הדף)", 800.0, 2000.0, hinge = "R", swing = "in", frameTh = 100.0, leafTh = 60.0, ordxName = "Safety Room Entrance"),
        door("DOOR_POCKET", "דלת כיס", 900.0, 2100.0, mode = "pocket", ordxName = "Pocket Door"),
        door("DOOR_SLIDING", "דלת הזזה", 900.0, 2100.0, mode = "sliding", ordxName = "Sliding Door"),
        door("DOOR_PATIO", "דלת מרפסת (הזזה)", 1800.0, 2100.0, mode = "sliding", leaf = 2, glazing = "full", ordxName = "Patio Door"),
        door("DOOR_DOUBLE", "דלת דו-כנפית", 1400.0, 2100.0, mode = "double", leaf = 2, ordxName = "Double Door"),
        door("OPENING_FRAME", "מפתח עם משקוף", 900.0, 2100.0, mode = "fixed", ordxName = "Doorway with Frame"),
        door("PASSAGE", "מעבר", 900.0, 2100.0, mode = "fixed", ordxName = "Passage"),
        door("OPENING_TO_FLOOR", "פתח עד הרצפה", 900.0, 2100.0, mode = "fixed", ordxName = "Opening to Floor"),

        // ── חלונות → ORDX Decorative/Window · פתח פרמטרי (מידות קליל/ת״י ברירת-מחדל) ──
        window("WINDOW", "חלון", 1200.0, 1200.0, ordxName = "Window"),
        window("WINDOW_CASEMENT", "חלון ציר", 800.0, 1200.0, mode = "hinged", ordxName = "Casement Window"),
        window("WINDOW_KIP", "חלון קיפ (דריי-קיפ)", 800.0, 1400.0, mode = "kip", ordxName = "Tilt-Turn Window"),
        window("WINDOW_SLIDING", "חלון הזזה", 1500.0, 1200.0, mode = "sliding", ordxName = "Sliding Window"),
        window("WINDOW_HUNG", "חלון גיליון", 900.0, 1400.0, mode = "hung", ordxName = "Hung Window"),
        window("WINDOW_MAMAD", "חלון ממ\"ד (הדף)", 1000.0, 1000.0, mode = "kip", frameTh = 120.0, ordxName = "Safety Room Window"),
        window("WINDOW_KITCHEN", "חלון מטבח", 1000.0, 800.0, sill = 1050.0, mode = "sliding", ordxName = "Kitchen Window"),
        window("WINDOW_BATH", "חלונית רחצה", 600.0, 600.0, sill = 1300.0, mode = "kip", ordxName = "Bath Window"),
        window("WINDOW_TILT", "חלון מדף (אוונינג)", 800.0, 500.0, sill = 1600.0, mode = "awning", ordxName = "Awning Window"),
        window("VITRINE", "ויטרינה", 2000.0, 2400.0, sill = 0.0, mode = "fixed", ordxName = "Storefront Window"),

        // ── מיזוג ואיוורור → פתחי-קיר/תקרה + יחידות-מזגן (פתח פרמטרי) ──────
        vent("AC_INDOOR", "מזגן עילי (יחידה פנימית)", 900.0, 300.0, kind = "ac", depth = 200.0, sill = 2200.0, hasDepth = true, ordxName = "Air Condition Indoor"),
        vent("AC_CASSETTE", "מזגן קסטה תקרתי", 840.0, 840.0, kind = "ac", depth = 300.0, hasDepth = true, ordxName = "Air Condition Cassette"),
        vent("AC_CONCEALED", "מזגן מיני-מרכזי נסתר", 1200.0, 300.0, kind = "ac", depth = 600.0, hasDepth = true, ordxName = "Air Condition Concealed"),
        vent("AC_CONDENSER", "מעבה (יחידה חיצונית)", 800.0, 550.0, kind = "ac", depth = 300.0, hasDepth = true, ordxName = "Air Condition Condenser"),
        vent("AC_BRACKET", "קונזול-קיר למזגן", 600.0, 400.0, kind = "ac"),
        vent("AC_SLEEVE", "שרוול מעבר-צנרת מזגן", 110.0, 110.0, round = true, depth = 100.0, hasDepth = true),
        vent("AC_WALL_BOX", "נישת-קיר למזגן", 450.0, 450.0, depth = 80.0, hasDepth = true),
        vent("CONDENSATE_DRAIN", "נקודת ניקוז מזגן", 20.0, 20.0, round = true),
        vent("AC_DIFFUSER", "מפזר-תקרה (דיפיוזר)", 600.0, 600.0),
        // ⭐ חובה בכל ממ"ד — ת״י 4910 / פיקוד-העורף
        vent("MAMAD_AIR_VALVE", "פתח-אוויר ממ\"ד + שסתום-הדף", 200.0, 200.0),
        vent("VENT_GRILLE", "שבכת איוורור", 200.0, 200.0),
        vent("WALL_LOUVER", "תריס-איוורור חיצוני (ז'לוזי)", 300.0, 300.0),
        vent("EXHAUST_FAN", "מאוורר-יניקה (ונטה)", 250.0, 250.0),
        vent("FRESH_AIR_INTAKE", "פתח אוויר-צח / מסנן", 200.0, 200.0),
        vent("RANGE_HOOD_DUCT", "תעלת-מנדף (קולט-אדים)", 150.0, 150.0, round = true),
        vent("DRYER_VENT", "פתח מייבש-כביסה", 110.0, 110.0, round = true),
        vent("BOILER_FLUE", "ארובת-דוד גז", 100.0, 100.0, round = true),
        vent("CHIMNEY_FLUE", "ארובת-עשן (קמין)", 180.0, 180.0, round = true),
        vent("SERVICE_HATCH", "פתח-שירות / תקרה-פריקה", 500.0, 500.0),
        vent("HRV", "אוורור מבוקר (HRV/ERV)", 700.0, 400.0, hasDepth = true, depth = 300.0),

        // ── מבנה ותקרה → ORDX Decorative/Miscellaneous ────────────────────
        ElementDef("CEILING_DROP", "הנמכת תקרה", ElementGroup.STRUCTURE, 650.0, ordxClass = "Decorative", ordxType = "Miscellaneous"),
        ElementDef("CEILING_DROP_AC", "הנמכת תקרה עם מזגן", ElementGroup.STRUCTURE, 650.0, ordxClass = "Decorative", ordxType = "Miscellaneous"),
        ElementDef("COLUMN", "עמוד", ElementGroup.STRUCTURE, 200.0, ordxClass = "Decorative", ordxType = "TWall", ordxName = "Pole"),
        ElementDef("COLUMN_ROUND", "עמוד עגול", ElementGroup.STRUCTURE, 200.0, round = true, ordxClass = "Decorative", ordxType = "TWall", ordxName = "RPole"),
        ElementDef("PANEL", "פאנל", ElementGroup.STRUCTURE, 16.0),
        ElementDef("ROUND_OBJECT", "אובייקט עגול", ElementGroup.STRUCTURE, 100.0, round = true),

        // ── הערות ─────────────────────────────────────────────────────────
        ElementDef("NOTE", "הערה", ElementGroup.NOTES, 0.0, hasDepth = false),
        ElementDef("NOTE_FACTORY", "הערה למפעל", ElementGroup.NOTES, 0.0, hasDepth = false),

        // ── מטבח חוץ (13 תוכניות שגב-כרמל/אלקינצו) → מיפוי-ORDX לפי סוג ─────
        ElementDef("OK_GRILL_BUILTIN", "גריל בנוי", ElementGroup.OUTDOOR, 560.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Built-in Grill"),
        ElementDef("OK_GRILL_CART", "גריל חופשי / עגלה", ElementGroup.OUTDOOR, 600.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Grill Cart"),
        ElementDef("OK_KAMADO", "קמאדו / ביצה", ElementGroup.OUTDOOR, 600.0, round = true, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Kamado Grill"),
        ElementDef("OK_PIZZA_OVEN", "טאבון / תנור פיצה", ElementGroup.OUTDOOR, 700.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Pizza Oven"),
        ElementDef("OK_SMOKER", "מעשנת", ElementGroup.OUTDOOR, 700.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Smoker"),
        ElementDef("OK_GAS_COOKTOP", "כירת גז חוץ", ElementGroup.OUTDOOR, 520.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Outdoor Gas Cooktop"),
        ElementDef("OK_SIDE_BURNER", "מבער צד", ElementGroup.OUTDOOR, 520.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Side Burner"),
        ElementDef("OK_WARMING_DRAWER", "מגירת חימום", ElementGroup.OUTDOOR, 560.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Warming Drawer"),
        ElementDef("OK_RANGE_HOOD", "קולט אדים חוץ", ElementGroup.OUTDOOR, 500.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Outdoor Range Hood"),
        ElementDef("OK_FRIDGE", "מקרר חוץ", ElementGroup.OUTDOOR, 600.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Outdoor Refrigerator"),
        ElementDef("OK_FREEZER", "מקפיא", ElementGroup.OUTDOOR, 600.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Freezer"),
        ElementDef("OK_ICE_MAKER", "מכונת קרח / אייס מייקר", ElementGroup.OUTDOOR, 600.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Ice Maker"),
        ElementDef("OK_KEGERATOR", "קגרייטור", ElementGroup.OUTDOOR, 600.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Kegerator"),
        ElementDef("OK_WINE_COOLER", "מצנן יין", ElementGroup.OUTDOOR, 600.0, ordxClass = "Appliance", ordxType = "DishWasher", ordxName = "Wine Cooler"),
        ElementDef("OK_SINK", "כיור חוץ", ElementGroup.OUTDOOR, 450.0, ordxClass = "Fixture", ordxType = "Part", ordxName = "Outdoor Sink"),
        ElementDef("OK_FAUCET", "ברז / ברז נשלף", ElementGroup.OUTDOOR, 250.0, ordxClass = "Fixture", ordxType = "Part", ordxName = "Faucet"),
        ElementDef("OK_GAS_TAP", "ברז גז חיצוני", ElementGroup.OUTDOOR, 60.0, ordxClass = "Fixture", ordxType = "Part", ordxName = "Gas Tap"),
        ElementDef("OK_TRASH_DRAWER", "מגירת אשפה", ElementGroup.OUTDOOR, 560.0),
        ElementDef("OK_STORAGE_DRAWERS", "מגירות אחסון", ElementGroup.OUTDOOR, 560.0),
        ElementDef("OK_PLANTER", "עציץ מובנה", ElementGroup.OUTDOOR, 400.0, ordxClass = "Decorative", ordxType = "Miscellaneous"),
        ElementDef("OK_UMBRELLA_ANCHOR", "עמוד סוכך / עוגן פרגולה", ElementGroup.OUTDOOR, 100.0, round = true, ordxClass = "Decorative", ordxType = "TWall", ordxName = "Pergola Anchor"),
        ElementDef("OK_LIGHTING_BRIDGE", "גשר תאורה", ElementGroup.OUTDOOR, 100.0, ordxClass = "Decorative", ordxType = "Miscellaneous", ordxName = "Lighting"),

        // ── סימון-ייחוס ───────────────────────────────────────────────────
        ElementDef("STICHMASS", "שטיכמוס (סימן ייחוס)", ElementGroup.MARKING, 0.0, hasDepth = false),
        ElementDef("FUTURE_CEILING_LINE", "קו-תקרה עתידי", ElementGroup.MARKING, 0.0, hasDepth = false),
        ElementDef("FUTURE_CEILING", "תקרה עתידית", ElementGroup.MARKING, 0.0, hasDepth = false),
    )

    /** אלמנטים מקובצים, לפי סדר-התצוגה של [ElementGroup.order]. */
    val byGroup: List<Pair<String, List<ElementDef>>> =
        ElementGroup.order.map { g -> g to all.filter { it.group == g } }

    fun of(key: String): ElementDef? = all.firstOrNull { it.key == key }

    // ── תצוגה ממוזגת: מובנה + אישי (CustomElementStore) ──────────────────────
    // מיושר ל-CVSM 5.9: הקטלוג הרשמי + הווריאנטים האישיים באותה רשימה מקובצת.

    /** כל האלמנטים — מובנים תחילה ואז האישיים ([custom] מגיע בד"כ מ-CustomElementStore.all). */
    fun allWith(custom: List<ElementDef>): List<ElementDef> = all + custom

    /**
     * מקובץ לפי [ElementGroup.order], כולל האלמנטים האישיים בקבוצתם.
     * קבוצה שאין בה פריטים (מובנה או אישי) מושמטת.
     */
    fun byGroupWith(custom: List<ElementDef>): List<Pair<String, List<ElementDef>>> {
        val merged = all + custom
        return ElementGroup.order
            .map { g -> g to merged.filter { it.group == g } }
            .filter { it.second.isNotEmpty() }
    }

    /** חיפוש במרחב הממוזג (מובנה + אישי). */
    fun ofWith(key: String, custom: List<ElementDef>): ElementDef? =
        all.firstOrNull { it.key == key } ?: custom.firstOrNull { it.key == key }
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
