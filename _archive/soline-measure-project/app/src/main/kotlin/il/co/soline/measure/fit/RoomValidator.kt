package il.co.soline.measure.fit

import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.geometry.WallBuilder
import kotlin.math.roundToInt

/*
 * Soline — שער-איכות חוסם לפני שמירת/ייצוא חדר (החלטות #21 "בקרה-עצמית" ו-#15 offline-first).
 * מבוסס MICHAEL_WISHLIST §1 (סדר-מדידה + בקרה-עצמית), §2 (חיבור-T / auto-connect),
 * §6 (מידות-סופיות / סטטוס). לוגיקה טהורה — נקרא מה-UI לפני מעבר-מסך.
 *
 * החדר תקין רק אם אין ולו ValidationIssue אחת ברמת BLOCK.
 */

/** ממצא של שער-האיכות. code = מזהה-מכונה יציב; message = עברית למודד. */
data class ValidationIssue(
    val severity: Severity,
    val code: String,
    val message: String,
)

/** ספי-בדיקה לשער-האיכות (מ"מ). */
data class RoomValidatorConfig(
    val autoConnectMm: Double = 50.0,   // פער-סגירה מתחת לזה — חיבור-אוטומטי (§2 "לרוץ על הפסים")
    val tJoinMaxMm: Double = 300.0,     // מעל זה — חיבור-T/סגירה ידנית נדרשים, לא ניתן לאחות
    val minWalls: Int = 3,              // מתחת לזה אין מצולע-חדר סגור
    val maxWallLenMm: Double = 30000.0, // קיר ארוך מזה = חשד לטעות-מדידה
)

object RoomValidator {

    /**
     * שער-האיכות החוסם.
     * @param walls כל הקירות (יכולים להשתייך לכמה חדרים — מקובצים לפי roomId).
     * @param accessoriesByWall בליטות לכל קיר לפי wallId.
     *
     * הנחת-מודל: ל-WallEntity אין עדיין שדה "סטטוס-מידה" (final/לא-סופי, §6).
     * לכן מידה חסרה מיוצגת ע"י length<=0 או height<=0 = "לא-נמדד/סטטוס-חסר" → BLOCK.
     */
    fun validate(
        walls: List<WallEntity>,
        accessoriesByWall: Map<Long, List<AccessoryEntity>>,
        cfg: RoomValidatorConfig = RoomValidatorConfig(),
    ): List<ValidationIssue> {
        val out = mutableListOf<ValidationIssue>()
        if (walls.isEmpty()) {
            out.add(ValidationIssue(Severity.BLOCK, "NO_WALLS", "אין קירות בחדר — לא ניתן לשמור"))
            return out
        }
        for ((roomId, roomWalls) in walls.groupBy { it.roomId }) {
            out.addAll(validateRoom(roomId, roomWalls.sortedBy { it.idx }, accessoriesByWall, cfg))
        }
        return out
    }

    private fun validateRoom(
        roomId: Long,
        walls: List<WallEntity>,
        accByWall: Map<Long, List<AccessoryEntity>>,
        cfg: RoomValidatorConfig,
    ): List<ValidationIssue> {
        val out = mutableListOf<ValidationIssue>()

        // --- 1. מידות-קריטיות חסרות + סטטוס-מידה נדרש (§6) ---
        for (w in walls) {
            if (w.length <= 0.0) out.add(
                ValidationIssue(Severity.BLOCK, "MISSING_LENGTH", "קיר #${w.idx}: חסרה מידת-אורך")
            )
            if (w.height <= 0.0) out.add(
                ValidationIssue(Severity.BLOCK, "MISSING_HEIGHT", "קיר #${w.idx}: חסרה מידת-גובה")
            )
            if (w.length > cfg.maxWallLenMm) out.add(
                ValidationIssue(
                    Severity.WARN, "SUSPECT_LENGTH",
                    "קיר #${w.idx}: אורך ${round1(w.length)} מ\"מ — חריג, לוודא שאין טעות-מדידה"
                )
            )
            // סטטוס-מידה: בליטה חייבת רוחב ומיקום כדי להיחשב "נמדדה" (§5 באפליקציה)
            for (a in accByWall[w.id].orEmpty()) {
                if (a.width <= 0.0) out.add(
                    ValidationIssue(
                        Severity.BLOCK, "MISSING_STATUS",
                        "קיר #${w.idx}: לאלמנט \"${a.name}\" אין רוחב — סטטוס-מידה חסר"
                    )
                )
            }
        }

        // --- 2. סגירת-החדר + חיבור-אוטומטי/T (§2) ---
        if (walls.size < cfg.minWalls) {
            out.add(
                ValidationIssue(
                    Severity.BLOCK, "TOO_FEW_WALLS",
                    "בחדר ${walls.size} קירות — דרושים לפחות ${cfg.minWalls} למצולע סגור"
                )
            )
        } else if (walls.all { it.length > 0.0 }) {
            val gap = closureGapMm(walls)
            val g = round1(gap)
            when {
                gap <= cfg.autoConnectMm ->
                    out.add(
                        ValidationIssue(
                            Severity.INFO, "WALL_AUTO_CONNECT",
                            "החדר נסגר (פער $g מ\"מ) — הקצוות אוחו אוטומטית"
                        )
                    )
                gap <= cfg.tJoinMaxMm ->
                    out.add(
                        ValidationIssue(
                            Severity.WARN, "WALL_GAP_TJOIN",
                            "פער-סגירה $g מ\"מ — נדרש חיבור-T או השלמת-קיר ידנית"
                        )
                    )
                else ->
                    out.add(
                        ValidationIssue(
                            Severity.BLOCK, "ROOM_NOT_CLOSED",
                            "החדר אינו סגור — פער $g מ\"מ בין קצות-הקירות"
                        )
                    )
            }
        }
        return out
    }

    /**
     * פער-הסגירה של המצולע: נגזר ממקור-האמת היחיד [WallBuilder.layout] (heading += angle,
     * CCW חיובי — אותה מוסכמה כמו מסכי-הלכידה) כמרחק בין הקודקוד האחרון לראשון.
     */
    private fun closureGapMm(walls: List<WallEntity>): Double =
        WallBuilder.closingGap(WallBuilder.layout(walls))

    private fun round1(v: Double): Double = (v * 10.0).roundToInt() / 10.0
}
