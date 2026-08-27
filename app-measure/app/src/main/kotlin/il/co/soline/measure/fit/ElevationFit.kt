package il.co.soline.measure.fit

import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.CabinetEntity
import il.co.soline.measure.data.WallEntity
import kotlin.math.roundToInt

/* ─────────────────────────────────────────────────────────────────────────────
 *  ElevationFit — לוגיקת-ההתנגשות הטהורה של שכבת-התכנון בחזית (Kotlin נטו, ללא
 *  Compose). מקבלת את הקיר, אביזרי-התשתית שנמדדו עליו (שכבה B) ואת הארונות
 *  המתוכננים (שכבה A) — ומחזירה רשימת-התנגשויות, כל אחת עם אזור-לסימון (x,y,w,h
 *  במ"מ, בקואורדינטות-החזית: x מהשמאל, y מהרצפה), חומרה, והודעה עברית קצרה.
 *
 *  זו הבדיקה הדו-ממדית של *פני-הקיר* (רוחב×גובה) — משלימה ל-FitEngine.ruleR4
 *  שבודק עומק-בליטה מול גב-הארון. כאן: האם התשתית מתנגשת בגוף-הארון על-פני-החזית,
 *  והאם הארון בכלל נכנס לשטח.
 *
 *  חוקי-ההתנגשות (MICHAEL: "נזהה בעיות בהתאמת מטבח לשטח"):
 *
 *   HARD (אדום) — צינור/גז/ניקוז-רצפה/חלון/דלת/עמוד/הנמכת-תקרה שמלבן-החזית שלו
 *       חופף לגוף-הארון: הם מתנגשים פיזית. האזור המסומן הוא מלבן-החפיפה.
 *
 *   FIT  (אדום) — הארון לא נכנס לשטח: חורג מימין-הקיר (fromLeft+width > length),
 *       חורג משמאל (fromLeft < 0), גבוה מגובה-הקיר (heightTo > height), או יורד
 *       מתחת-לרצפה (heightFrom < 0). האזור המסומן הוא החלק-החורג.
 *
 *   INFO (ענבר) — שקע/מפסק/קו-חשמל שחופף לגוף-הארון: לרוב מכוון לשבת מאחוריו
 *       (במיוחד מאחורי ארון-בסיס). מוצג לתשומת-לב אך אינו מתריע כחסימה.
 * ───────────────────────────────────────────────────────────────────────────── */

/** חומרת-התנגשות בשכבת-התכנון של החזית. */
enum class ClashSeverity { HARD, FIT, INFO }

/** מלבן בקואורדינטות-החזית: x מהשמאל, y מהרצפה, רוחב/גובה — הכל מ"מ. */
data class ClashRegion(val x: Double, val y: Double, val w: Double, val h: Double)

/** ממצא-התנגשות: אזור-לסימון + חומרה + הודעה עברית קצרה + מזהי-מקור. */
data class ElevationClash(
    val severity: ClashSeverity,
    val region: ClashRegion,
    val message: String,
    val cabinetId: Long,
    val accessoryId: Long? = null,
)

object ElevationFit {

    /** תשתיות שהתנגשות-גוף מולן היא חסימה קשה (HARD) — גופים פיזיים שאסור לחפוף. */
    private val HARD_TYPES = setOf(
        "WATER_PIPE", "GAS_PIPE", "WINDOW", "DOOR", "COLUMN",
        "CEILING_DROP", "FLOOR_DRAIN", "DRAIN",
    )

    /** חשמל — צפוי לשבת מאחורי הארון; חפיפה = INFO בלבד, לא חסימה. */
    private val INFO_TYPES = setOf("SOCKET_SINGLE", "SOCKET_MULTI", "ELECTRICAL_LINE")

    /** חפיפה מתחת לסף זה (מ"מ) נחשבת רעש-מדידה ולא התנגשות אמיתית. */
    private const val MIN_OVERLAP_MM = 5.0

    /** מלבן-עזר פנימי (x מהשמאל, y מהרצפה). */
    private data class Rect(val x: Double, val y: Double, val w: Double, val h: Double)

    /** חפיפת-מלבן-החזית של הארון (הגוף) מול מלבן-האביזר; null אם אין חפיפה. */
    private fun intersect(cab: CabinetEntity, a: AccessoryEntity): Rect? {
        val x1 = maxOf(cab.fromLeft, a.fromLeft)
        val x2 = minOf(cab.fromLeft + cab.width, a.fromLeft + a.width)
        val y1 = maxOf(cab.heightFrom, a.fromBottom)
        val y2 = minOf(cab.heightTo, a.fromBottom + a.height)
        if (x2 <= x1 || y2 <= y1) return null
        return Rect(x1, y1, x2 - x1, y2 - y1)
    }

    /** FIT — הארון חורג מגבולות-הקיר (ימין/שמאל/מעל/מתחת-לרצפה). */
    private fun fitClashes(wall: WallEntity, cab: CabinetEntity): List<ElevationClash> {
        val out = mutableListOf<ElevationClash>()
        val cabL = cab.fromLeft
        val cabR = cab.fromLeft + cab.width
        val cabB = cab.heightFrom
        val cabT = cab.heightTo
        val bodyH = (cabT - cabB).coerceAtLeast(1.0)
        val bodyW = cab.width.coerceAtLeast(1.0)

        // חורג מעבר לקצה-הימני של הקיר
        if (cabR > wall.length + 1.0) {
            val edge = maxOf(cabL, wall.length)
            out += ElevationClash(
                ClashSeverity.FIT,
                ClashRegion(edge, cabB, cabR - edge, bodyH),
                "\"${cab.name}\" חורג ${(cabR - wall.length).roundToInt()} מ\"מ מקצה-הקיר",
                cab.id,
            )
        }
        // חורג אל מעבר לקצה-השמאלי (fromLeft שלילי)
        if (cabL < -1.0) {
            out += ElevationClash(
                ClashSeverity.FIT,
                ClashRegion(cabL, cabB, -cabL, bodyH),
                "\"${cab.name}\" חורג ${(-cabL).roundToInt()} מ\"מ משמאל-הקיר",
                cab.id,
            )
        }
        // גבוה מגובה-הקיר
        if (cabT > wall.height + 1.0) {
            val edge = maxOf(cabB, wall.height)
            out += ElevationClash(
                ClashSeverity.FIT,
                ClashRegion(cabL, edge, bodyW, cabT - edge),
                "\"${cab.name}\" גבוה ${(cabT - wall.height).roundToInt()} מ\"מ מהקיר",
                cab.id,
            )
        }
        // יורד מתחת לרצפה
        if (cabB < -1.0) {
            out += ElevationClash(
                ClashSeverity.FIT,
                ClashRegion(cabL, cabB, bodyW, -cabB),
                "\"${cab.name}\" יורד ${(-cabB).roundToInt()} מ\"מ מתחת-לרצפה",
                cab.id,
            )
        }
        return out
    }

    /**
     * הליבה — מריצה את כל החוקים על כל ארון מול הקיר ואביזריו.
     * @return רשימת-התנגשויות ממוינת: HARD קודם, אחריו FIT, ולבסוף INFO.
     */
    fun evaluate(
        wall: WallEntity,
        accessories: List<AccessoryEntity>,
        cabinets: List<CabinetEntity>,
    ): List<ElevationClash> {
        val out = mutableListOf<ElevationClash>()
        for (cab in cabinets) {
            out += fitClashes(wall, cab)
            for (a in accessories) {
                val r = intersect(cab, a) ?: continue
                if (r.w < MIN_OVERLAP_MM || r.h < MIN_OVERLAP_MM) continue
                val region = ClashRegion(r.x, r.y, r.w, r.h)
                when (a.type) {
                    in INFO_TYPES -> out += ElevationClash(
                        ClashSeverity.INFO, region,
                        "${a.name} מאחורי \"${cab.name}\" — לוודא גישה",
                        cab.id, a.id,
                    )
                    // סוגי-תשתית מוכרים (וכל סוג לא-מוכר) בגוף-הארון = חסימה קשה
                    else -> out += ElevationClash(
                        ClashSeverity.HARD, region,
                        "${a.name} בגוף \"${cab.name}\"",
                        cab.id, a.id,
                    )
                }
            }
        }
        return out.sortedBy { it.severity.ordinal }
    }

    /** שורת-סיכום קומפקטית בעברית: "2 התנגשויות: ..." — למידע-מהיר בלוח-החזית. */
    fun summaryLine(clashes: List<ElevationClash>): String {
        val hard = clashes.count { it.severity == ClashSeverity.HARD }
        val fit = clashes.count { it.severity == ClashSeverity.FIT }
        val info = clashes.count { it.severity == ClashSeverity.INFO }
        val blocking = hard + fit
        if (blocking == 0 && info == 0) return "אין התנגשויות — הארונות נכנסים לשטח"
        val parts = mutableListOf<String>()
        if (hard > 0) parts += "$hard תשתית בגוף-ארון"
        if (fit > 0) parts += "$fit חריגה מהקיר"
        if (info > 0) parts += "$info לתשומת-לב"
        val head = if (blocking > 0) "$blocking התנגשויות" else "$info הערות"
        return "$head: ${parts.joinToString(" · ")}"
    }
}
