package il.co.soline.measure.catalog

/* ספריית-חומרים של Soline Measure — צבעים + טקסטורות לעולם-המטבח (2024–2025).
 *
 * מזינה שני צרכנים:
 *   1. בחירת-גימור בשטח (בורר-חומרים למודד — חזיתות/שיש/קירות/רצפות).
 *   2. מנוע-ההדמיה offline — כל חומר נושא תיאור-טקסטורה פרוצדורלי כדי שהרנדרר
 *      יצייר אותו בלי תמונות (procedural, no photos).
 *
 * הקובץ עצמאי לחלוטין מ-ElementCatalog.kt — שמות ציבוריים ייחודיים
 * (MaterialCatalog / Material / TextureKind / MaterialCategory) שלא מתנגשים.
 *
 * מוסכמות:
 *   colorHex / accentHex — 0xFFRRGGBB (ARGB, אלפא מלא).
 *   scaleMm — גודל-התבנית (גרעין-עץ / רוחב-וריד / מודול-אריח) במ"מ; 0 = לא-רלוונטי.
 *   glossy  — משטח מבריק (ברק-שיש/לכה) מול מט.
 *
 * ערכי-הצבע נבחרו כדי לשקף מוצרים אמיתיים: Calacatta = לבן-חם עם ורידים אפורים,
 * Dekton Kelya = כהה עם ורידי-נחושת, Sensa Black Beauty = שחור-גרניט מנוקד וכו'.
 */

/** משפחות-הטקסטורה שהרנדרר יודע לצייר פרוצדורלית. */
enum class TextureKind {
    SOLID,           // צבע-מלא אחיד (לכה/צבע)
    WOOD,            // גרעין-עץ מכוון (חזיתות/פרקט/פורצלן דמוי-עץ)
    MARBLE_VEIN,     // ורידי-שיש רכים על רקע בהיר/כהה
    GRANITE_SPECKLE, // ניקוד-גרניט צפוף (קוורץ-דמוי-אבן / גרניט-טבעי)
    TERRAZZO,        // שברי-אבן צבעוניים ברקע מלט
    TILE_GRID,       // רשת-אריחים עם פוגות
    CONCRETE,        // בטון/מיקרו-בטון — כתמים רכים לא-מכוונים
    LINEN,           // מרקם-בד עדין (חזית-בד/קיר-טקסטיל)
    METAL_BRUSH,     // מתכת-מוברשת מכוונת (נירוסטה/פליז)
}

/** שמות-הקטגוריות (מקור-האמת לסדר-התצוגה בבורר). */
object MaterialCategory {
    const val FRONTS = "חזיתות"
    const val COUNTERTOP = "שיש ומשטחי-עבודה"
    const val WALLS = "קירות"
    const val FLOORS = "רצפות"
    const val METAL = "מתכת ונירוסטה"

    /** סדר קבוע לבורר-הגימורים. */
    val order: List<String> = listOf(FRONTS, COUNTERTOP, WALLS, FLOORS, METAL)
}

/**
 * הגדרת-חומר אחת.
 *
 * @param key       מזהה יציב (נשמר בבחירת-הגימור של האלמנט/המשטח).
 * @param he        שם-תצוגה בעברית (כולל שם-מוצר אמיתי היכן שרלוונטי).
 * @param category  אחת מ-[MaterialCategory].
 * @param colorHex  צבע-בסיס 0xFFRRGGBB.
 * @param texture   משפחת-הטקסטורה לרנדרר.
 * @param accentHex צבע-משני (ורידים/ניקוד/פוגות); ברירת-מחדל = colorHex.
 * @param scaleMm   גודל-התבנית במ"מ; 0 = לא-רלוונטי.
 * @param glossy    משטח מבריק מול מט.
 */
data class Material(
    val key: String,
    val he: String,
    val category: String,
    val colorHex: Long,
    val texture: TextureKind,
    val accentHex: Long = colorHex,
    val scaleMm: Double = 0.0,
    val glossy: Boolean = false,
)

/** הקטלוג המלא — חומרי-מטבח עדכניים (2024–2025). */
object MaterialCatalog {

    val all: List<Material> = listOf(

        // ══════════════════════════════════════════════════════════════════
        // חזיתות (Cabinet fronts) — לבנים, אפורים, שחור-מט, גווני-2025, דמוי-עץ
        // ══════════════════════════════════════════════════════════════════
        Material("FRONT_WHITE_GLOSS", "לבן מבריק", MaterialCategory.FRONTS, 0xFFF7F6F2, TextureKind.SOLID, glossy = true),
        Material("FRONT_WHITE_MATTE", "לבן מט", MaterialCategory.FRONTS, 0xFFF1EFEA, TextureKind.SOLID),
        Material("FRONT_CREAM", "שמנת (אוף-וויט)", MaterialCategory.FRONTS, 0xFFEDE7D9, TextureKind.SOLID),
        Material("FRONT_LIGHT_GREY", "אפור בהיר", MaterialCategory.FRONTS, 0xFFC9C7C1, TextureKind.SOLID),
        Material("FRONT_MID_GREY", "אפור אמצע", MaterialCategory.FRONTS, 0xFF8E8C87, TextureKind.SOLID),
        Material("FRONT_ANTHRACITE", "אנתרציט", MaterialCategory.FRONTS, 0xFF3C3D3F, TextureKind.SOLID),
        Material("FRONT_BLACK_MATTE", "שחור מט", MaterialCategory.FRONTS, 0xFF1E1E1E, TextureKind.SOLID),
        Material("FRONT_SAGE", "סייג' ירוק", MaterialCategory.FRONTS, 0xFF9CA588, TextureKind.SOLID),
        Material("FRONT_NAVY", "כחול נייבי", MaterialCategory.FRONTS, 0xFF2B3A55, TextureKind.SOLID),
        Material("FRONT_TAUPE", "טאופ / חול", MaterialCategory.FRONTS, 0xFFC3B39B, TextureKind.SOLID),
        Material("FRONT_OLIVE", "ירוק זית", MaterialCategory.FRONTS, 0xFF6B6B47, TextureKind.SOLID),
        Material("FRONT_BURGUNDY", "בורדו", MaterialCategory.FRONTS, 0xFF6E2B34, TextureKind.SOLID),
        Material("FRONT_DUSTY_BLUE", "כחול-אבק", MaterialCategory.FRONTS, 0xFF8394A0, TextureKind.SOLID),
        Material("FRONT_TERRACOTTA", "טרקוטה", MaterialCategory.FRONTS, 0xFFB56A4A, TextureKind.SOLID),
        Material("FRONT_LINEN", "פשתן (חזית-בד)", MaterialCategory.FRONTS, 0xFFD9D0BE, TextureKind.LINEN, accentHex = 0xFFC3B79E, scaleMm = 2.0),
        // דמוי-עץ (WOOD) — מט אלא אם צוין
        Material("FRONT_OAK_NATURAL", "אלון טבעי", MaterialCategory.FRONTS, 0xFFC9A876, TextureKind.WOOD, accentHex = 0xFFA07E4F, scaleMm = 28.0),
        Material("FRONT_OAK_WHITE", "אלון מולבן", MaterialCategory.FRONTS, 0xFFDCCFB8, TextureKind.WOOD, accentHex = 0xFFC0AE93, scaleMm = 28.0),
        Material("FRONT_WALNUT", "אגוז", MaterialCategory.FRONTS, 0xFF6E4A2E, TextureKind.WOOD, accentHex = 0xFF4E3320, scaleMm = 24.0),
        Material("FRONT_GREY_WOOD", "אפור-עץ", MaterialCategory.FRONTS, 0xFF9A928A, TextureKind.WOOD, accentHex = 0xFF7A726A, scaleMm = 26.0),
        Material("FRONT_OAK_GLOSS", "אלון טבעי מבריק", MaterialCategory.FRONTS, 0xFFCBA97A, TextureKind.WOOD, accentHex = 0xFFA07E4F, scaleMm = 28.0, glossy = true),

        // ══════════════════════════════════════════════════════════════════
        // שיש ומשטחי-עבודה (Countertops) — העדיפות. קווי-מוצר אמיתיים.
        // ══════════════════════════════════════════════════════════════════

        // ── Dekton (דקטון · Cosentino) ────────────────────────────────────
        Material("DEKTON_KELYA", "דקטון Kelya", MaterialCategory.COUNTERTOP, 0xFF2E2A28, TextureKind.MARBLE_VEIN, accentHex = 0xFFB08D57, scaleMm = 320.0, glossy = true),
        Material("DEKTON_SIRIUS", "דקטון Sirius", MaterialCategory.COUNTERTOP, 0xFF1C1C1E, TextureKind.CONCRETE, accentHex = 0xFF2C2C2E, scaleMm = 260.0),
        Material("DEKTON_AURA15", "דקטון Aura 15", MaterialCategory.COUNTERTOP, 0xFFF2EFE9, TextureKind.MARBLE_VEIN, accentHex = 0xFF9A9590, scaleMm = 300.0, glossy = true),
        Material("DEKTON_LAURENT", "דקטון Laurent", MaterialCategory.COUNTERTOP, 0xFF231F1D, TextureKind.MARBLE_VEIN, accentHex = 0xFFC9A24B, scaleMm = 300.0, glossy = true),
        Material("DEKTON_BERGEN", "דקטון Bergen", MaterialCategory.COUNTERTOP, 0xFF9D9A94, TextureKind.CONCRETE, accentHex = 0xFF817E78, scaleMm = 280.0),
        Material("DEKTON_KRETA", "דקטון Kreta", MaterialCategory.COUNTERTOP, 0xFF8C8A85, TextureKind.CONCRETE, accentHex = 0xFF6F6D68, scaleMm = 280.0),
        Material("DEKTON_TRILIUM", "דקטון Trilium", MaterialCategory.COUNTERTOP, 0xFF3A3B3D, TextureKind.GRANITE_SPECKLE, accentHex = 0xFF6A6B6D, scaleMm = 3.0),
        Material("DEKTON_DOMOOS", "דקטון Domoos", MaterialCategory.COUNTERTOP, 0xFFA8A6A0, TextureKind.CONCRETE, accentHex = 0xFF8B8983, scaleMm = 280.0),

        // ── Sensa by Cosentino (סנסה · גרניט-טבעי מוגן-כתמים) ──────────────
        Material("SENSA_TAJ_MAHAL", "סנסה Taj Mahal", MaterialCategory.COUNTERTOP, 0xFFE8DFCF, TextureKind.MARBLE_VEIN, accentHex = 0xFFC7B79A, scaleMm = 340.0),
        Material("SENSA_COLONIAL_WHITE", "סנסה Colonial White", MaterialCategory.COUNTERTOP, 0xFFDDD9D0, TextureKind.GRANITE_SPECKLE, accentHex = 0xFF8B6F6A, scaleMm = 4.0),
        Material("SENSA_BLACK_BEAUTY", "סנסה Black Beauty", MaterialCategory.COUNTERTOP, 0xFF201F1D, TextureKind.GRANITE_SPECKLE, accentHex = 0xFF45443F, scaleMm = 3.0, glossy = true),
        Material("SENSA_WHITE_SILK", "סנסה White Silk", MaterialCategory.COUNTERTOP, 0xFFEDE7DA, TextureKind.MARBLE_VEIN, accentHex = 0xFFBFB6A4, scaleMm = 320.0),
        Material("SENSA_ARIEL", "סנסה Ariel", MaterialCategory.COUNTERTOP, 0xFF6E6C68, TextureKind.GRANITE_SPECKLE, accentHex = 0xFF3B3A37, scaleMm = 4.0),
        Material("SENSA_INDIAN_BLACK", "סנסה Indian Black", MaterialCategory.COUNTERTOP, 0xFF2A2926, TextureKind.GRANITE_SPECKLE, accentHex = 0xFF4D4C48, scaleMm = 3.0, glossy = true),

        // ── Caesarstone (קיסר · קוורץ) ────────────────────────────────────
        Material("CAESAR_CALACATTA_NUVO", "קיסר Calacatta Nuvo 5131", MaterialCategory.COUNTERTOP, 0xFFF3EFE8, TextureKind.MARBLE_VEIN, accentHex = 0xFFA9A39A, scaleMm = 360.0, glossy = true),
        Material("CAESAR_VANILLA_NOIR", "קיסר Vanilla Noir 5100", MaterialCategory.COUNTERTOP, 0xFF201E1B, TextureKind.MARBLE_VEIN, accentHex = 0xFFE8E4DA, scaleMm = 340.0, glossy = true),
        Material("CAESAR_LONDON_GREY", "קיסר London Grey 5000", MaterialCategory.COUNTERTOP, 0xFFCFCBC2, TextureKind.MARBLE_VEIN, accentHex = 0xFF9C978E, scaleMm = 320.0),
        Material("CAESAR_FROSTY_CARRINA", "קיסר Frosty Carrina 5141", MaterialCategory.COUNTERTOP, 0xFFEFEDE6, TextureKind.MARBLE_VEIN, accentHex = 0xFFB6B2A9, scaleMm = 300.0, glossy = true),
        Material("CAESAR_CLOUDBURST_CONCRETE", "קיסר Cloudburst Concrete 4011", MaterialCategory.COUNTERTOP, 0xFF8E8B85, TextureKind.CONCRETE, accentHex = 0xFF72706A, scaleMm = 280.0),
        Material("CAESAR_FRESH_CONCRETE", "קיסר Fresh Concrete 4001", MaterialCategory.COUNTERTOP, 0xFFB9B5AD, TextureKind.CONCRETE, accentHex = 0xFF9A968E, scaleMm = 280.0),
        Material("CAESAR_PURE_WHITE", "קיסר Pure White 1141", MaterialCategory.COUNTERTOP, 0xFFF6F5F1, TextureKind.SOLID, glossy = true),
        Material("CAESAR_RAVEN", "קיסר Raven 4120", MaterialCategory.COUNTERTOP, 0xFF35342F, TextureKind.CONCRETE, accentHex = 0xFF4A4944, scaleMm = 260.0),

        // ══════════════════════════════════════════════════════════════════
        // קירות (Walls) — צבע, מיקרו-בטון, חיפוי-אבן, קרמיקה, לבנים
        // ══════════════════════════════════════════════════════════════════
        Material("WALL_WHITE", "לבן קיר", MaterialCategory.WALLS, 0xFFF3F1EC, TextureKind.SOLID),
        Material("WALL_GREIGE", "אפור-בז' חם (Greige)", MaterialCategory.WALLS, 0xFFD8CFC2, TextureKind.SOLID),
        Material("WALL_SAGE", "מרווה קיר", MaterialCategory.WALLS, 0xFFA7AE97, TextureKind.SOLID),
        Material("WALL_TERRACOTTA", "טרקוטה קיר", MaterialCategory.WALLS, 0xFFB56A4A, TextureKind.SOLID),
        Material("WALL_POWDER_BLUE", "כחול-אבקה", MaterialCategory.WALLS, 0xFFB7C4CC, TextureKind.SOLID),
        Material("WALL_CHARCOAL", "פחם (קיר-דגש)", MaterialCategory.WALLS, 0xFF3A3B3D, TextureKind.SOLID),
        Material("WALL_MICROCEMENT", "מיקרו-בטון", MaterialCategory.WALLS, 0xFFB9B4AC, TextureKind.CONCRETE, accentHex = 0xFF9C978E, scaleMm = 400.0),
        Material("WALL_STONE_JERUSALEM", "חיפוי אבן-ירושלים", MaterialCategory.WALLS, 0xFFD8C9AC, TextureKind.GRANITE_SPECKLE, accentHex = 0xFFB6A585, scaleMm = 6.0),
        Material("WALL_SUBWAY_WHITE", "אריח מטרו לבן", MaterialCategory.WALLS, 0xFFF2F0EA, TextureKind.TILE_GRID, accentHex = 0xFFD7D3CA, scaleMm = 75.0, glossy = true),
        Material("WALL_HEX_SAGE", "קרמיקה משושה מרווה", MaterialCategory.WALLS, 0xFFA9B199, TextureKind.TILE_GRID, accentHex = 0xFF8B927D, scaleMm = 100.0),
        Material("WALL_MARBLE_SLAB", "חיפוי דמוי-שיש", MaterialCategory.WALLS, 0xFFECE8DF, TextureKind.MARBLE_VEIN, accentHex = 0xFFB2ACA0, scaleMm = 380.0, glossy = true),
        Material("WALL_BRICK_RED", "לבנים חשופות", MaterialCategory.WALLS, 0xFFA5563F, TextureKind.TILE_GRID, accentHex = 0xFF8A8378, scaleMm = 210.0),
        Material("WALL_BRICK_WHITE", "לבנים לבנות", MaterialCategory.WALLS, 0xFFDAD3C8, TextureKind.TILE_GRID, accentHex = 0xFFBCB4A8, scaleMm = 210.0),

        // ══════════════════════════════════════════════════════════════════
        // רצפות (Floors) — פורצלן דמוי-עץ/אבן/שיש/בטון, טרצו, פרקט, גרניט
        // ══════════════════════════════════════════════════════════════════
        Material("FLOOR_WOOD_PORCELAIN", "פורצלן דמוי-עץ", MaterialCategory.FLOORS, 0xFFB9946A, TextureKind.WOOD, accentHex = 0xFF957143, scaleMm = 200.0),
        Material("FLOOR_OAK_PARQUET", "פרקט אלון", MaterialCategory.FLOORS, 0xFFB07E4E, TextureKind.WOOD, accentHex = 0xFF8A5E33, scaleMm = 190.0, glossy = true),
        Material("FLOOR_STONE_LOOK", "פורצלן דמוי-אבן", MaterialCategory.FLOORS, 0xFFC7C1B4, TextureKind.MARBLE_VEIN, accentHex = 0xFF9E9789, scaleMm = 360.0),
        Material("FLOOR_MARBLE_LOOK", "פורצלן דמוי-שיש", MaterialCategory.FLOORS, 0xFFECE8DF, TextureKind.MARBLE_VEIN, accentHex = 0xFFB2ACA0, scaleMm = 380.0, glossy = true),
        Material("FLOOR_CONCRETE_LOOK", "פורצלן דמוי-בטון", MaterialCategory.FLOORS, 0xFF9C9992, TextureKind.CONCRETE, accentHex = 0xFF817E77, scaleMm = 320.0),
        Material("FLOOR_TERRAZZO_LIGHT", "טרצו בהיר", MaterialCategory.FLOORS, 0xFFE3DED2, TextureKind.TERRAZZO, accentHex = 0xFF8A8478, scaleMm = 14.0),
        Material("FLOOR_TERRAZZO_DARK", "טרצו כהה", MaterialCategory.FLOORS, 0xFF4B4A46, TextureKind.TERRAZZO, accentHex = 0xFFC9C3B6, scaleMm = 14.0),
        Material("FLOOR_GRANITO", "גרניט-פורצלן (Granito)", MaterialCategory.FLOORS, 0xFF8E8A82, TextureKind.GRANITE_SPECKLE, accentHex = 0xFF605D57, scaleMm = 4.0, glossy = true),
        Material("FLOOR_TRAVERTINE", "טרוורטין", MaterialCategory.FLOORS, 0xFFD9C9AE, TextureKind.MARBLE_VEIN, accentHex = 0xFFB6A484, scaleMm = 300.0),
        Material("FLOOR_GREY_WOOD", "פורצלן דמוי-עץ אפור", MaterialCategory.FLOORS, 0xFFA69E93, TextureKind.WOOD, accentHex = 0xFF817A70, scaleMm = 200.0),

        // ══════════════════════════════════════════════════════════════════
        // מתכת ונירוסטה (Metal) — מטבחי-חוץ + דגשים פנימיים
        // ══════════════════════════════════════════════════════════════════
        Material("METAL_STEEL_BRUSHED", "נירוסטה מוברשת", MaterialCategory.METAL, 0xFFB8B8BA, TextureKind.METAL_BRUSH, accentHex = 0xFF9A9A9C, scaleMm = 1.5),
        Material("METAL_STEEL_POLISHED", "נירוסטה מבריקה", MaterialCategory.METAL, 0xFFCED0D2, TextureKind.METAL_BRUSH, accentHex = 0xFFAEB0B2, scaleMm = 1.0, glossy = true),
        Material("METAL_BLACK_ALU", "אלומיניום שחור", MaterialCategory.METAL, 0xFF3A3A3C, TextureKind.METAL_BRUSH, accentHex = 0xFF29292B, scaleMm = 1.5),
        Material("METAL_BRASS_BRUSHED", "פליז מוברש", MaterialCategory.METAL, 0xFFB59A5E, TextureKind.METAL_BRUSH, accentHex = 0xFF917B49, scaleMm = 1.5),
        Material("METAL_COPPER", "נחושת", MaterialCategory.METAL, 0xFFA86B4B, TextureKind.METAL_BRUSH, accentHex = 0xFF854F35, scaleMm = 1.5, glossy = true),
        Material("METAL_GUNMETAL", "גונמטאל (אפור-פחם)", MaterialCategory.METAL, 0xFF54565A, TextureKind.METAL_BRUSH, accentHex = 0xFF3E4044, scaleMm = 1.5),
    )

    /** מקובץ לפי-קטגוריה בסדר-התצוגה של [MaterialCategory.order]. */
    val byCategory: List<Pair<String, List<Material>>> =
        MaterialCategory.order.map { cat -> cat to all.filter { it.category == cat } }

    /** אחזור-חומר לפי-מפתח (null אם לא-קיים). */
    fun of(key: String): Material? = byKey[key]

    private val byKey: Map<String, Material> = all.associateBy { it.key }
}
