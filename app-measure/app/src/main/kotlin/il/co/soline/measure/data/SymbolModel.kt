package il.co.soline.measure.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import il.co.soline.measure.catalog.CadSymbolCategory
import il.co.soline.measure.catalog.CadSymbolDef
import il.co.soline.measure.catalog.CadSymbolShape
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/* ─────────────────────────────────────────────────────────────────────────────
 *  סמלי-CAD מותאמים-אישית (CVSM #f-cad-symbol · "סמל חדש") — Soline Measure.
 *
 *  המדריך (cvsm_reference/CVSM_guide_he.html): "כפתור סמל חדש בבורר יוצר סמל מבוסס
 *  צורת בסיס (מלבן / מלבן מעוגל / עיגול / משולש / מעוין) עם תווית קצרה משלכם...
 *  הסמלים המותאמים נשמרים ומוצעים שוב בכל פרויקט."
 *
 *  אחסון Room (offline-first, החלטה #15) — טבלה חדשה `custom_symbols`, נוספת דרך
 *  מיגרציית 4→5 (CREATE TABLE; אפס-מחיקת-נתונים לישויות הקיימות).
 *  זו ישות חדשה — אין לגעת ב-Project/RoomEntity/WallEntity/AccessoryEntity/CabinetEntity.
 * ───────────────────────────────────────────────────────────────────────────── */

@Entity(tableName = "custom_symbols")
data class CustomSymbolEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val key: String,          // מזהה-יציב (קידומת CustomSymbolStore.PREFIX)
    val he: String,           // תווית קצרה (הכיתוב-האוטומטי המודפס)
    val shape: String,        // CadSymbolShape.name — צורת-הבסיס
    val widthMm: Double,      // רוחב ברירת-מחדל (מ"מ)
    val heightMm: Double,     // גובה/עומק-בתוכנית (מ"מ)
    val depthMm: Double = 0.0, // עומק-בליטה (מ"מ) — 0 לרוב הסמלים
    val colorArgb: Long = 0L, // צבע-הסמל (ARGB); 0 = צבע ברירת-המחדל
    val createdAt: Long = System.currentTimeMillis(),
)

/**
 * CustomSymbolStore — הפשטת-גישה לסמלים-המותאמים (Room-backed).
 *
 * מקבילה ל-[CustomElementStore] אך מגובה-Room (לא SharedPreferences), כי לסמל יש
 * יותר שדות-מבנה (צורה/מידות/צבע) והוא חלק מסכימת-הפרויקט הנשמרת. מפריד את המרת
 * ה-Entity↔[CadSymbolDef] וייצור-המפתח מ-[Repo], שנשאר שכבת-ה-DAO הדקה.
 */
object CustomSymbolStore {

    /** קידומת-מפתח לסמל מותאם — מבדילה מובנה (SYM_…) מאישי. */
    const val PREFIX = "CSYM_"

    private val repo get() = SolineApp.instance.repo

    fun isCustom(key: String): Boolean = key.startsWith(PREFIX)

    /** מפתח-אישי חדש וייחודי, נגזר ממקסימום-המונה הקיים (יציב, בלי Date.now). */
    fun newKey(existing: List<CadSymbolDef>): String {
        val maxN = existing
            .filter { isCustom(it.key) }
            .mapNotNull { it.key.removePrefix(PREFIX).toIntOrNull() }
            .maxOrNull() ?: 0
        return "$PREFIX${maxN + 1}"
    }

    // ── קריאה תגובתית (Flow<List<CadSymbolDef>>) ─────────────────────────────
    /** כל הסמלים-המותאמים כ-[CadSymbolDef] (קטגוריה = "הסמלים שלי"), חדש-קודם. */
    fun allAsDefs(): Flow<List<CadSymbolDef>> =
        repo.customSymbols().map { list -> list.map { it.toDef() } }

    // ── כתיבה (suspend, מגובה-Room) ───────────────────────────────────────────
    suspend fun add(
        key: String, he: String, shape: CadSymbolShape,
        widthMm: Double, heightMm: Double, depthMm: Double = 0.0, colorArgb: Long = 0L,
    ): Long = repo.addCustomSymbol(
        CustomSymbolEntity(
            key = key, he = he, shape = shape.name,
            widthMm = widthMm, heightMm = heightMm, depthMm = depthMm, colorArgb = colorArgb,
        )
    )

    suspend fun delete(key: String) = repo.deleteCustomSymbolByKey(key)

    // ── המרות Entity ↔ Def ────────────────────────────────────────────────────
    private fun CustomSymbolEntity.toDef(): CadSymbolDef = CadSymbolDef(
        key = key,
        he = he,
        category = CadSymbolCategory.CUSTOM,
        widthMm = widthMm,
        heightMm = heightMm,
        depthMm = depthMm,
        shape = CadSymbolShape.of(shape),
        builtin = false,
    )
}
