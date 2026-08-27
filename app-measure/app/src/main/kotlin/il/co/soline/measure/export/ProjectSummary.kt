package il.co.soline.measure.export

import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.Project
import il.co.soline.measure.data.RoomEntity
import il.co.soline.measure.data.WallEntity

/**
 * ProjectSummary — סיכום-פרויקט בעברית כ-Markdown רגיל (WISHLIST §6:
 * "PDF סיכום-פרויקט מלא: חדרים עם שמות, כולל סטטוס-שינויים בבנייה ומידות-סופיות").
 *
 * מפיק מסמך קריא: כותרת-פרויקט + לקוח, ואז כל חדר עם הקירות שלו (אורך×גובה, זווית)
 * וטבלת-בליטות (שם, סוג, מידות, מיקום). לכל בליטה יש עמודות-placeholder ל"סטטוס-בנייה"
 * ול"מידה-סופית" שהמפעל ממלא ידנית — הגשר להמשך-עריכה של המפעל לפני ייצור.
 *
 * טקסט בלבד; אין תלות ב-Room/מנוע-PDF. שכבת-ה-PDF תרנדר את ה-Markdown הזה.
 */
object ProjectSummary {

    fun toMarkdown(
        project: Project,
        rooms: List<RoomEntity>,
        wallsByRoom: Map<Long, List<WallEntity>>,
        accByWall: Map<Long, List<AccessoryEntity>>,
    ): String {
        val sb = StringBuilder(2048)

        sb.append("# סיכום פרויקט — ").append(project.name).append('\n')
        sb.append('\n')
        sb.append("- **לקוח:** ").append(if (project.client.isBlank()) "—" else project.client).append('\n')
        sb.append("- **תאריך יצירה:** ").append(formatDate(project.createdAt)).append('\n')
        sb.append("- **מספר חדרים:** ").append(rooms.size).append('\n')
        sb.append('\n')
        sb.append("---\n\n")

        if (rooms.isEmpty()) {
            sb.append("_אין חדרים בפרויקט._\n")
            return sb.toString()
        }

        for ((ri, room) in rooms.withIndex()) {
            sb.append("## חדר ").append(ri + 1).append(" — ").append(room.name).append('\n')
            sb.append('\n')

            val walls = wallsByRoom[room.id].orEmpty().sortedBy { it.idx }
            if (walls.isEmpty()) {
                sb.append("_אין קירות בחדר זה._\n\n")
                continue
            }

            for (w in walls) {
                sb.append("### קיר ").append(w.idx + 1).append('\n')
                sb.append('\n')
                sb.append("- אורך: ").append(mm(w.length)).append(" מ\"מ")
                sb.append(" · גובה: ").append(mm(w.height)).append(" מ\"מ")
                sb.append(" · זווית לקיר הבא: ").append(mm(w.angle)).append("°\n")
                sb.append('\n')

                val accs = accByWall[w.id].orEmpty()
                if (accs.isEmpty()) {
                    sb.append("_ללא בליטות._\n\n")
                    continue
                }

                sb.append("| # | אלמנט | סוג | רוחב (מ\"מ) | גובה (מ\"מ) | עומק (מ\"מ) | ")
                sb.append("משמאל (מ\"מ) | מהרצפה (מ\"מ) | סטטוס-בנייה | מידה סופית |\n")
                sb.append("|---|---|---|---|---|---|---|---|---|---|\n")
                for ((ai, a) in accs.withIndex()) {
                    sb.append("| ").append(ai + 1)
                        .append(" | ").append(cell(a.name))
                        .append(" | ").append(cell(a.type))
                        .append(" | ").append(mm(a.width))
                        .append(" | ").append(mm(a.height))
                        .append(" | ").append(mm(a.depth))
                        .append(" | ").append(mm(a.fromLeft))
                        .append(" | ").append(mm(a.fromBottom))
                        .append(" | ").append("☐ ______")   // placeholder: המפעל ממלא
                        .append(" | ").append("______")      // placeholder: מידה-סופית בשטח
                        .append(" |\n")
                }
                sb.append('\n')
            }
        }

        sb.append("---\n\n")
        sb.append("> **הערות מפעל / מידות סופיות:** _מולא ידנית לפני ייצור._\n")
        return sb.toString()
    }

    /** מ"מ ל-3 ספרות עשרוניות, נקודה קבועה (בלי תלות ב-Locale). */
    private fun mm(v: Double): String {
        val neg = v < 0
        val abs = if (neg) -v else v
        val scaled = Math.round(abs * 1000.0)
        val intPart = scaled / 1000
        val frac = (scaled % 1000).toString().padStart(3, '0')
        return (if (neg) "-" else "") + intPart + "." + frac
    }

    /** מילוט תווים ששוברים תא-טבלה ב-Markdown. */
    private fun cell(s: String): String =
        s.replace("\\", "\\\\").replace("|", "\\|").replace("\n", " ")

    /** תאריך UTC פשוט (yyyy-MM-dd) ללא תלות ב-Locale/TimeZone. */
    private fun formatDate(epochMs: Long): String {
        var days = Math.floorDiv(epochMs, 86_400_000L)
        var year = 1970
        while (true) {
            val len = if (isLeap(year)) 366 else 365
            if (days >= len) { days -= len; year++ } else break
        }
        val mLen = intArrayOf(31, if (isLeap(year)) 29 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
        var month = 0
        while (days >= mLen[month]) { days -= mLen[month]; month++ }
        val d = (days + 1).toInt()
        return year.toString() + "-" + pad2(month + 1) + "-" + pad2(d)
    }

    private fun isLeap(y: Int): Boolean = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
    private fun pad2(v: Int): String = if (v < 10) "0$v" else v.toString()
}
