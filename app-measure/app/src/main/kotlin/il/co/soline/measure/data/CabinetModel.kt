package il.co.soline.measure.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/* ─────────────────────────────────────────────────────────────────────────────
 *  שכבת-הארונות (Furniture / Cabinets) של Soline Measure — שכבה A (תכנון-הנגר).
 *  זו השכבה שמנוע-ההתאמה (fit) מניח על-גבי המדידה-בשטח (שכבה B: קירות+בליטות)
 *  ומריץ מולה את חוקי R1–R10 (kitchen_layout_fitting §4).
 *
 *  שתי-חגורות-הארונות + עמודה (kitchen_layout_fitting §1.1):
 *    • בסיס  (base)  — עומק ~58 ס"מ, גוף עד ~90 ס"מ (כולל צוקל+שיש).
 *    • עליון (upper) — עומק ~33 ס"מ, תחתית ~150 ס"מ מהרצפה, ראש ~210.
 *    • גבוה  (tall)  — עמודת מקרר/תנור/מזווה, מהרצפה עד ~240 ס"מ.
 *
 *  אלה ישויות חדשות — האינטגרטור מוסיף אותן ל-DB עם מיגרציה. אין לגעת
 *  בישויות הקיימות (Project/RoomEntity/WallEntity/AccessoryEntity).
 * ───────────────────────────────────────────────────────────────────────────── */

@Entity(
    tableName = "cabinets",
    foreignKeys = [
        ForeignKey(
            entity = RoomEntity::class,
            parentColumns = ["id"],
            childColumns = ["roomId"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = WallEntity::class,
            parentColumns = ["id"],
            childColumns = ["wallId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("roomId"), Index("wallId")],
)
data class CabinetEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val roomId: Long,
    val wallId: Long,
    val kind: String,        // שם-קבוע מתוך CabinetKind (BASE_1DOOR / WALL_2DOOR / ...)
    val name: String,        // שם-תצוגה בעברית
    val fromLeft: Double,    // מיקום אופקי משמאל-הקיר (מ"מ)
    val width: Double,       // רוחב-מודול (מ"מ)
    val depth: Double,       // עומק גוף-הארון (מ"מ)
    val heightFrom: Double,  // תחתית גב-הארון מהרצפה (מ"מ)
    val heightTo: Double,    // ראש גב-הארון מהרצפה (מ"מ)
    val doorType: String = "", // single | double | drawers | ...
)

/**
 * שבעת טיפוסי-הארון (InnoDraw §8 — Furniture: CW1D/CW2D/CT1D/CB1D/CB2D…),
 * עם שם עברי, שיוך-חגורה (belt → kind של מנוע-ה-fit: base|upper|tall),
 * ורוחב/עומק/גובה ברירת-מחדל per-belt.
 *
 * @param he               שם-תצוגה בעברית.
 * @param belt             חגורה — ממופה ל-fit-engine Cabinet.kind: "base"|"upper"|"tall".
 * @param defaultDoorType  סוג-חזית ברירת-מחדל (single/double/drawers).
 * @param defaultWidth     רוחב-מודול נפוץ להתחלה (מ"מ).
 * @param defaultDepth     עומק גוף ברירת-מחדל (מ"מ).
 * @param defaultHeightFrom תחתית-גב מהרצפה (מ"מ).
 * @param defaultHeightTo   ראש-גב מהרצפה (מ"מ).
 */
enum class CabinetKind(
    val he: String,
    val belt: String,
    val defaultDoorType: String,
    val defaultWidth: Double,
    val defaultDepth: Double,
    val defaultHeightFrom: Double,
    val defaultHeightTo: Double,
) {
    // ── בסיס (base): heightFrom 100 · heightTo 900 · depth 580 ──
    BASE_1DOOR("ארון בסיס — דלת בודדת", "base", "single", 450.0, 580.0, 100.0, 900.0),
    BASE_2DOOR("ארון בסיס — דלת כפולה", "base", "double", 800.0, 580.0, 100.0, 900.0),
    // ── עליון (upper): heightFrom 1500 · heightTo 2100 · depth 330 ──
    WALL_1DOOR("ארון עליון — דלת בודדת", "upper", "single", 450.0, 330.0, 1500.0, 2100.0),
    WALL_2DOOR("ארון עליון — דלת כפולה", "upper", "double", 800.0, 330.0, 1500.0, 2100.0),
    // ── גבוה / עמודה (tall): heightFrom 100 · heightTo 2400 · depth 580 ──
    TALL("ארון גבוה / מזווה", "tall", "double", 600.0, 580.0, 100.0, 2400.0),
    TOWER("עמודת מכשירים (תנור/מיקרו)", "tall", "single", 600.0, 580.0, 100.0, 2400.0),
    // ── פינה (חגורת-בסיס): ארון-פינה עיוור 68/68 ──
    CORNER("ארון פינה 68/68", "base", "single", 680.0, 580.0, 100.0, 900.0),

    // ── מטבח חוץ (base-only · עומק 600/660 · שיש 920 · צוקל 100) — 13 תוכניות שגב-כרמל/אלקינצו ──
    OK_GRILL_CAB("חוץ · ארון גריל", "base", "door", 1000.0, 660.0, 100.0, 920.0),
    OK_COOKTOP_CAB("חוץ · ארון כירת גז/מבער", "base", "door", 600.0, 600.0, 100.0, 920.0),
    OK_SINK_CAB("חוץ · ארון כיור", "base", "double", 600.0, 600.0, 100.0, 920.0),
    OK_FRIDGE_CAB("חוץ · ארון מקרר", "base", "appliance", 600.0, 600.0, 100.0, 920.0),
    OK_FREEZER_CAB("חוץ · ארון מקפיא", "base", "appliance", 600.0, 600.0, 100.0, 920.0),
    OK_ICEMAKER_CAB("חוץ · ארון מכונת קרח", "base", "appliance", 450.0, 600.0, 100.0, 920.0),
    OK_DRAWERS_CAB("חוץ · ארון מגירות", "base", "drawers", 600.0, 600.0, 100.0, 920.0),
    OK_TRASH_CAB("חוץ · ארון מגירת אשפה", "base", "drawers", 400.0, 600.0, 100.0, 920.0),
    OK_CORNER_CAB("חוץ · ארון פינה 68/68", "base", "single", 680.0, 660.0, 100.0, 920.0),
    OK_PLANTER_CAB("חוץ · ארון עציץ", "base", "open", 400.0, 400.0, 100.0, 600.0),
    OK_FALSEFRONT_CAB("חוץ · ארון-דמה / פאנל שירות", "base", "panel", 300.0, 600.0, 100.0, 920.0);

    companion object {
        fun of(name: String): CabinetKind = entries.firstOrNull { it.name == name } ?: BASE_1DOOR
    }
}

/**
 * קטלוג-הארונות: רוחבי-המודול הסטנדרטיים (מ"מ) — kitchen_layout_fitting §1.2
 * (15/20/30/40/45/50/60/80/90/100/120 ס"מ), ופונקציית-נוחות לבניית CabinetEntity
 * חדש מטיפוס+רוחב עם ברירות-המחדל של החגורה.
 */
object CabinetCatalog {
    /** רוחבי-מודול נפוצים בישראל (מ"מ). דלת-בודדת עד ~450–500; רחב מזה = כפולה/מגירות. */
    val moduleWidths: List<Double> = listOf(
        150.0, 200.0, 300.0, 400.0, 450.0, 500.0, 600.0, 800.0, 900.0, 1000.0, 1200.0,
    )

    /** שבעת-הטיפוסים לבורר-הוספה. */
    val kinds: List<CabinetKind> = CabinetKind.entries.toList()

    /** בונה ארון חדש (id=0) מטיפוס+רוחב+מיקום, עם עומק/גובה ברירת-המחדל של החגורה. */
    fun newCabinet(
        roomId: Long,
        wallId: Long,
        kind: CabinetKind,
        width: Double = kind.defaultWidth,
        fromLeft: Double = 0.0,
    ): CabinetEntity = CabinetEntity(
        id = 0,
        roomId = roomId,
        wallId = wallId,
        kind = kind.name,
        name = kind.he,
        fromLeft = fromLeft,
        width = width,
        depth = kind.defaultDepth,
        heightFrom = kind.defaultHeightFrom,
        heightTo = kind.defaultHeightTo,
        doorType = kind.defaultDoorType,
    )
}
