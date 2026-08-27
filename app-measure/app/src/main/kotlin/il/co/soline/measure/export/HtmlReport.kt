package il.co.soline.measure.export

import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.LevelPointEntity
import il.co.soline.measure.data.LevelSurface
import il.co.soline.measure.data.PhotoEntity
import il.co.soline.measure.data.Project
import il.co.soline.measure.data.RoomChecklist
import il.co.soline.measure.data.RoomEntity
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.data.leftEdgeMm

/**
 * HtmlReport — דוח-מדידה קריא-לאדם (HTML עצמאי) שהמודד צופה בו כדי לאמת "כנגר"
 * את מה-שמדד לפני ששולח מהשטח. פונקציה טהורה (בלי-Android) → ניתנת-לבדיקת-יחידה.
 *
 * הדוח **עצמאי לחלוטין**: CSS מוטמע, RTL עברית, תמונות מוטמעות כ-base64 (data URI).
 * אין נכסים-חיצוניים (שום http/https) — נפתח בכל דפדפן גם ללא-רשת (offline-first).
 *
 * זהו נתיב-הצפייה-בלבד של המודד — הוא **אינו-נוגע** בנתיב-הייצוא ‎.sol/CAD‎.
 *
 * מקור-התמונות: [imageResolver] מחזיר data-URI (base64) לתמונה, או null אם אין-להטמיע.
 * ההמרה-לביטמפ-מוקטן היא באחריות-הקורא (צד-Android); המחולל רק מטמיע את המחרוזת
 * ומוודא שאין-URL-חיצוני. בבדיקת-היחידה (בלי-Android) ה-resolver מחזיר null → הדוח
 * נבנה ללא-תמונות, נשאר תקין ועצמאי.
 */
object HtmlReport {

    /**
     * בונה דוח-חדר עצמאי (HTML). ששת-הפרמטרים הראשונים הם החוזה-הליבה
     * (room, walls, accessories, photos, levels, checklist); השאר רשות (כותרת/מודד/תמונות).
     */
    fun buildRoomReportHtml(
        room: RoomEntity,
        walls: List<WallEntity>,
        accessories: List<AccessoryEntity>,
        photos: List<PhotoEntity>,
        levels: List<LevelPointEntity>,
        checklist: List<RoomChecklist.Status>,
        project: Project? = null,
        surveyor: String = "",
        generatedAt: Long = System.currentTimeMillis(),
        imageResolver: (PhotoEntity) -> String? = { null },
    ): String {
        val sortedWalls = walls.sortedBy { it.idx }
        val accByWall: Map<Long, List<AccessoryEntity>> = accessories.groupBy { it.wallId }
        val openings = accessories.filter { it.openingKind.isNotBlank() }

        val sb = StringBuilder(8192)
        sb.append("<!DOCTYPE html>\n")
        sb.append("<html lang=\"he\" dir=\"rtl\">\n<head>\n")
        sb.append("<meta charset=\"utf-8\">\n")
        sb.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n")
        sb.append("<title>").append(esc("דוח מדידה — ${room.name}")).append("</title>\n")
        sb.append("<style>\n").append(CSS).append("\n</style>\n")
        sb.append("</head>\n<body>\n")

        // ── כותרת ────────────────────────────────────────────────────────────
        sb.append("<header class=\"hdr\">\n")
        sb.append("<h1>דוח מדידה — ").append(esc(room.name)).append("</h1>\n")
        sb.append("<div class=\"meta\">\n")
        row(sb, "פרויקט", project?.name?.takeIf { it.isNotBlank() } ?: "—")
        row(sb, "לקוח", project?.client?.takeIf { it.isNotBlank() } ?: "—")
        row(sb, "חדר", room.name)
        row(sb, "מודד", surveyor.takeIf { it.isNotBlank() } ?: "—")
        row(sb, "תאריך הדוח", formatDate(generatedAt))
        sb.append("</div>\n</header>\n")

        appendWalls(sb, sortedWalls)
        appendOpenings(sb, openings, sortedWalls)
        appendElements(sb, sortedWalls, accByWall)
        appendLevels(sb, levels)
        appendPhotos(sb, sortedWalls, photos, imageResolver)
        appendCompleteness(sb, checklist)

        sb.append("<footer class=\"ftr\">נוצר באפליקציית Soline Measure · דוח-מדידה לצפייה עצמית (לא-תחליף לייצוא ‎.sol‎).</footer>\n")
        sb.append("</body>\n</html>\n")
        return sb.toString()
    }

    // ── טבלת-קירות ───────────────────────────────────────────────────────────
    private fun appendWalls(sb: StringBuilder, walls: List<WallEntity>) {
        sb.append("<section>\n<h2>קירות</h2>\n")
        if (walls.isEmpty()) { sb.append(EMPTY.format("אין קירות בחדר.")); sb.append("</section>\n"); return }
        sb.append("<table>\n<thead><tr>")
        th(sb, "קיר"); th(sb, "אורך (מ\"מ)"); th(sb, "גובה (מ\"מ)"); th(sb, "מקור-גובה")
        th(sb, "זווית לקיר הבא"); th(sb, "ראש-קיר"); th(sb, "סופיט (מ\"מ)")
        sb.append("</tr></thead>\n<tbody>\n")
        for (w in walls) {
            sb.append("<tr>")
            td(sb, "קיר ${w.idx + 1}")
            td(sb, mm(w.length))
            td(sb, mm(w.height))
            tdFlag(sb, w.heightMeasured, "נמדד", "ברירת-מחדל")
            td(sb, "${mm(w.angle)}°")
            td(sb, headStyleHe(w.headStyle))
            td(sb, w.soffitHeightMm?.let { mm(it) } ?: "—")
            sb.append("</tr>\n")
        }
        sb.append("</tbody>\n</table>\n</section>\n")
    }

    // ── פתחים (דלת/חלון/פתח) — מידות-אמת ───────────────────────────────────────
    private fun appendOpenings(sb: StringBuilder, openings: List<AccessoryEntity>, walls: List<WallEntity>) {
        sb.append("<section>\n<h2>פתחים (דלתות · חלונות · אוורור)</h2>\n")
        if (openings.isEmpty()) { sb.append(EMPTY.format("לא נמדדו פתחים.")); sb.append("</section>\n"); return }
        val wallIdxById = walls.associate { it.id to (it.idx + 1) }
        sb.append("<table>\n<thead><tr>")
        th(sb, "קיר"); th(sb, "סוג"); th(sb, "שם"); th(sb, "רוחב (מ\"מ)"); th(sb, "גובה (מ\"מ)")
        th(sb, "סף (מ\"מ)"); th(sb, "עובי-קיר (מ\"מ)"); th(sb, "עובי-משקוף (מ\"מ)")
        th(sb, "צד-ציר"); th(sb, "פתיחה"); th(sb, "כיוון"); th(sb, "מקור-מידה")
        sb.append("</tr></thead>\n<tbody>\n")
        for (o in openings) {
            sb.append("<tr>")
            td(sb, wallIdxById[o.wallId]?.let { "קיר $it" } ?: "—")
            td(sb, openingKindHe(o.openingKind))
            td(sb, o.name)
            td(sb, mm(o.width))
            td(sb, mm(o.height))
            td(sb, if (o.sillHeight >= 0) mm(o.sillHeight) else "—")
            td(sb, if (o.wallThickness > 0) mm(o.wallThickness) else "—")
            td(sb, if (o.frameThickness > 0) mm(o.frameThickness) else "—")
            td(sb, hingeHe(o.hingeSide))
            td(sb, openModeHe(o.openMode))
            td(sb, swingHe(o.swing))
            tdFlag(sb, o.measured, "נמדד", "ברירת-קטלוג")
            sb.append("</tr>\n")
        }
        sb.append("</tbody>\n</table>\n</section>\n")
    }

    // ── אלמנטים פר-קיר ─────────────────────────────────────────────────────────
    private fun appendElements(
        sb: StringBuilder,
        walls: List<WallEntity>,
        accByWall: Map<Long, List<AccessoryEntity>>,
    ) {
        sb.append("<section>\n<h2>אלמנטים (בליטות · תשתיות)</h2>\n")
        var any = false
        for (w in walls) {
            val elems = accByWall[w.id].orEmpty().filter { it.openingKind.isBlank() }
            if (elems.isEmpty()) continue
            any = true
            sb.append("<h3>קיר ").append(w.idx + 1).append("</h3>\n")
            sb.append("<table>\n<thead><tr>")
            th(sb, "סוג"); th(sb, "שם"); th(sb, "מיקום משמאל (מ\"מ)"); th(sb, "רוחב (מ\"מ)")
            th(sb, "גובה-מהרצפה (מ\"מ)"); th(sb, "גובה (מ\"מ)"); th(sb, "עומק (מ\"מ)"); th(sb, "מקור-מידה")
            sb.append("</tr></thead>\n<tbody>\n")
            for (a in elems) {
                sb.append("<tr>")
                td(sb, accTypeHe(a.type))
                td(sb, a.name)
                td(sb, mm(a.leftEdgeMm(w.length)))
                td(sb, mm(a.width))
                td(sb, mm(a.fromBottom))
                td(sb, mm(a.height))
                td(sb, mm(a.depth))
                tdFlag(sb, a.measured, "נמדד", "ברירת-קטלוג")
                sb.append("</tr>\n")
            }
            sb.append("</tbody>\n</table>\n")
        }
        if (!any) sb.append(EMPTY.format("לא נמדדו אלמנטים."))
        sb.append("</section>\n")
    }

    // ── מפלסים (סטיות רצפה/תקרה) ────────────────────────────────────────────────
    private fun appendLevels(sb: StringBuilder, levels: List<LevelPointEntity>) {
        sb.append("<section>\n<h2>מפלסים (מישוריות)</h2>\n")
        if (levels.isEmpty()) { sb.append(EMPTY.format("לא נמדדו נקודות-מישוריות.")); sb.append("</section>\n"); return }
        sb.append("<table>\n<thead><tr>")
        th(sb, "משטח"); th(sb, "נקודות"); th(sb, "מינ' סטייה (מ\"מ)"); th(sb, "מקס' סטייה (מ\"מ)"); th(sb, "טווח (מ\"מ)")
        sb.append("</tr></thead>\n<tbody>\n")
        for ((surface, he) in listOf(LevelSurface.FLOOR to "רצפה", LevelSurface.CEILING to "תקרה")) {
            val pts = levels.filter { it.surface == surface }
            sb.append("<tr>")
            td(sb, he)
            if (pts.isEmpty()) { td(sb, "0"); td(sb, "—"); td(sb, "—"); td(sb, "—") } else {
                val devs = pts.map { it.deviationMm }
                val mn = devs.min(); val mx = devs.max()
                td(sb, pts.size.toString())
                td(sb, mmSigned(mn)); td(sb, mmSigned(mx)); td(sb, mm(mx - mn))
            }
            sb.append("</tr>\n")
        }
        sb.append("</tbody>\n</table>\n</section>\n")
    }

    // ── תמונות (ממוזערות מוטמעות, מקובצות לפי-חזית) ─────────────────────────────
    private fun appendPhotos(
        sb: StringBuilder,
        walls: List<WallEntity>,
        photos: List<PhotoEntity>,
        imageResolver: (PhotoEntity) -> String?,
    ) {
        sb.append("<section>\n<h2>תמונות</h2>\n")
        if (photos.isEmpty()) { sb.append(EMPTY.format("לא צולמו תמונות.")); sb.append("</section>\n"); return }
        val wallIdxById = walls.associate { it.id to (it.idx + 1) }
        // קיבוץ לפי-חזית: כותרת-קיר לכל תמונות-הקיר, ואז "כלל-החדר" לתמונות ללא-קיר.
        val byWall = photos.groupBy { it.wallId }
        var embedded = false
        // סדר: קירות לפי-idx, ואז שאר (חדר/פרויקט)
        val orderedKeys = walls.map { it.id as Long? } + byWall.keys.filter { it !in walls.map { w -> w.id } }
        for (key in orderedKeys.distinct()) {
            val group = byWall[key].orEmpty()
            if (group.isEmpty()) continue
            val title = key?.let { wallIdxById[it]?.let { n -> "חזית $n" } } ?: "כלל-החדר"
            sb.append("<h3>").append(esc(title)).append("</h3>\n<div class=\"gallery\">\n")
            for (p in group.sortedBy { it.seq }) {
                val data = imageResolver(p)
                sb.append("<figure class=\"thumb\">")
                if (data != null && !data.startsWith("http", ignoreCase = true)) {
                    embedded = true
                    sb.append("<img alt=\"").append(esc(p.caption.ifBlank { p.fileName })).append("\" src=\"").append(data).append("\">")
                } else {
                    sb.append("<div class=\"noimg\">🖼️<br>").append(esc(p.fileName)).append("</div>")
                }
                val cap = buildString {
                    append(photoKindHe(p.kind))
                    if (p.caption.isNotBlank()) append(" · ").append(p.caption)
                }
                sb.append("<figcaption>").append(esc(cap)).append("</figcaption>")
                sb.append("</figure>\n")
            }
            sb.append("</div>\n")
        }
        if (!embedded) {
            sb.append("<p class=\"note\">התמונות רשומות אך אינן מוטמעות בתצוגה זו.</p>\n")
        }
        sb.append("</section>\n")
    }

    // ── סטטוס-שלמות (מ-RoomChecklist) ──────────────────────────────────────────
    private fun appendCompleteness(sb: StringBuilder, checklist: List<RoomChecklist.Status>) {
        sb.append("<section>\n<h2>סטטוס שלמות</h2>\n")
        if (checklist.isEmpty()) { sb.append(EMPTY.format("אין נתוני-שלמות.")); sb.append("</section>\n"); return }
        sb.append("<table>\n<thead><tr>")
        th(sb, "משימה"); th(sb, "חובה"); th(sb, "בוצע / נדרש"); th(sb, "סטטוס")
        sb.append("</tr></thead>\n<tbody>\n")
        for (s in checklist) {
            sb.append("<tr>")
            td(sb, s.category.label)
            td(sb, if (s.category.required) "חובה" else "מומלץ")
            td(sb, "${s.satisfiedCount} / ${s.requiredCount}")
            val statusHtml = when {
                s.skippedReason != null -> "<span class=\"warn\">דולג — ${esc(s.skippedReason)}</span>"
                s.done -> "<span class=\"ok\">✓ בוצע</span>"
                else -> "<span class=\"bad\">✗ חסר</span>"
            }
            sb.append("<td>").append(statusHtml).append("</td>")
            sb.append("</tr>\n")
        }
        sb.append("</tbody>\n</table>\n</section>\n")
    }

    // ── עוזרי-בנייה ─────────────────────────────────────────────────────────────
    private fun row(sb: StringBuilder, k: String, v: String) {
        sb.append("<div class=\"kv\"><span class=\"k\">").append(esc(k)).append("</span>")
            .append("<span class=\"v\">").append(esc(v)).append("</span></div>\n")
    }
    private fun th(sb: StringBuilder, s: String) { sb.append("<th>").append(esc(s)).append("</th>") }
    private fun td(sb: StringBuilder, s: String) { sb.append("<td>").append(esc(s)).append("</td>") }
    private fun tdFlag(sb: StringBuilder, on: Boolean, yes: String, no: String) {
        val cls = if (on) "ok" else "muted"
        sb.append("<td><span class=\"").append(cls).append("\">").append(esc(if (on) yes else no)).append("</span></td>")
    }

    // ── תוויות-עברית ───────────────────────────────────────────────────────────
    private fun headStyleHe(s: String): String = when (s) {
        "STRAIGHT" -> "ישר"
        "SLOPE_LEFT" -> "משופע שמאל"
        "SLOPE_RIGHT" -> "משופע ימין"
        "GABLE" -> "גמלון"
        else -> s
    }
    private fun openingKindHe(k: String): String = when (k) {
        "door" -> "דלת"; "window" -> "חלון"; "vent" -> "פתח אוורור"; "ac" -> "מזגן"; else -> "פתח"
    }
    private fun openModeHe(m: String): String = when (m) {
        "hinged" -> "צירי"; "sliding" -> "הזזה"; "folding" -> "הרמוניקה"; "pocket" -> "נסתר (כיס)"
        "fixed" -> "קבוע"; "kip" -> "נטוי (kip)"; "awning" -> "מוטה"; "hung" -> "גיליוטינה"
        "double" -> "כנף כפולה"; "" -> "—"; else -> m
    }
    private fun hingeHe(v: String): String = when (v) { "L" -> "שמאל"; "R" -> "ימין"; else -> "—" }
    private fun swingHe(v: String): String = when (v) { "in" -> "פנימה"; "out" -> "החוצה"; else -> "—" }
    private fun photoKindHe(k: String): String = when (k) {
        "overview" -> "כללית"; "elevation", "context" -> "חזית"; "detail_tape" -> "פרט (מטר)"
        "far" -> "רחוקה"; "closeup" -> "תקריב"; "ceiling" -> "תקרה"; "floor" -> "רצפה"
        "access" -> "גישה"; "detail" -> "פרט"; else -> k
    }
    private fun accTypeHe(t: String): String = runCatching {
        il.co.soline.measure.data.AccType.of(t).he
    }.getOrDefault(t)

    // ── עיצוב-מספרים/תאריך (בלי-Locale, כמו ProjectSummary) ─────────────────────
    /** מ"מ שלם, מעוגל. */
    private fun mm(v: Double): String = Math.round(v).toString()
    /** מ"מ שלם מסומן (± לסטיות-מפלס). */
    private fun mmSigned(v: Double): String {
        val r = Math.round(v)
        return if (r > 0) "+$r" else r.toString()
    }
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
        return "${pad2(d)}/${pad2(month + 1)}/$year"
    }
    private fun isLeap(y: Int): Boolean = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
    private fun pad2(v: Int): String = if (v < 10) "0$v" else v.toString()

    /** מילוט-HTML — מונע-הזרקה + שובר-מבנה. */
    private fun esc(s: String): String {
        val b = StringBuilder(s.length + 16)
        for (c in s) when (c) {
            '&' -> b.append("&amp;")
            '<' -> b.append("&lt;")
            '>' -> b.append("&gt;")
            '"' -> b.append("&quot;")
            '\'' -> b.append("&#39;")
            else -> b.append(c)
        }
        return b.toString()
    }

    private const val EMPTY = "<p class=\"empty\">%s</p>\n"

    private val CSS = """
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #F5F1E8; color: #2B2B2B;
               margin: 0; padding: 16px; line-height: 1.5; }
        .hdr { background: #FFFFFF; border-radius: 14px; padding: 18px 20px; margin-bottom: 16px;
               box-shadow: 0 1px 4px rgba(0,0,0,.08); }
        h1 { margin: 0 0 12px; font-size: 22px; color: #1F6F6B; }
        h2 { font-size: 18px; color: #1F6F6B; border-bottom: 2px solid #E4B363; padding-bottom: 4px; margin: 20px 0 10px; }
        h3 { font-size: 15px; color: #C57B2E; margin: 14px 0 6px; }
        .meta { display: flex; flex-wrap: wrap; gap: 6px 24px; }
        .kv { display: flex; gap: 8px; }
        .kv .k { color: #7A756B; font-weight: 600; }
        .kv .v { color: #2B2B2B; }
        section { background: #FFFFFF; border-radius: 14px; padding: 12px 16px; margin-bottom: 14px;
                  box-shadow: 0 1px 4px rgba(0,0,0,.06); }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        thead th { background: #1F6F6B; color: #FFF; padding: 8px 10px; text-align: right; font-weight: 600; white-space: nowrap; }
        tbody td { padding: 7px 10px; border-bottom: 1px solid #EEE9DE; text-align: right; }
        tbody tr:nth-child(even) { background: #FAF7F0; }
        .ok { color: #2E7D32; font-weight: 600; }
        .bad { color: #C62828; font-weight: 700; }
        .warn { color: #C57B2E; font-weight: 600; }
        .muted { color: #9A948A; }
        .empty, .note { color: #9A948A; font-style: italic; padding: 6px 2px; }
        .gallery { display: flex; flex-wrap: wrap; gap: 10px; }
        .thumb { margin: 0; width: 150px; background: #FAF7F0; border-radius: 10px; padding: 6px; }
        .thumb img { width: 100%; height: auto; border-radius: 6px; display: block; }
        .thumb .noimg { text-align: center; color: #9A948A; font-size: 12px; padding: 18px 4px; }
        figcaption { font-size: 12px; color: #5A554C; margin-top: 4px; text-align: center; word-break: break-word; }
        .ftr { text-align: center; color: #9A948A; font-size: 12px; margin: 10px 0 4px; }
    """.trimIndent()
}
