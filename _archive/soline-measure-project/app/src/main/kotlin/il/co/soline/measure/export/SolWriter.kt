package il.co.soline.measure.export

import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.Project
import il.co.soline.measure.data.RoomEntity
import il.co.soline.measure.data.WallEntity
import java.io.OutputStream
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * SolWriter — כותב את פורמט-האב הקנייני **‎.sol‎** של Soline מתוך מודל-ה-Room החי.
 *
 * ‎.sol‎ הוא מקור-האמת (source-of-truth) של Soline: קונטיינר ZIP המחזיק את כל מחזור-החיים
 * של עבודת-נגרות אחת. הממיר הנפרד (SolReader/converter) הוא זה שהופך ‎.sol‎ → ORDX + PDP +
 * DXF-2D + DXF-3D בהמשך. כאן אנחנו רק **מממשים (materialize)** את ה-‎.sol‎ בצורה נאמנה
 * (lossless) מתוך הישויות שלנו — לא ממירים לשום פורמט זר.
 *
 * מעוגן ב-`docs/SOL_FORMAT.md` (מסמך-האב, 8 שכבות) וב-`docs/build/02-sol-format.md`
 * (תוכנית-הבנייה). מימוש זה הוא **תת-הקבוצה המינימלית-שמישה של v1a** (לא-מוצפן, גלוי):
 *
 * ```
 * project.sol  (ZIP / deflate)
 * ├─ manifest.json            ← נקודת-הכניסה: format "sol", magic "SOL1", schemaVersion,
 * │                             מפת-שכבות (present/entry), createdAt/updatedAt, units=mm
 * ├─ meta.json                ← שכבת meta: זהות-הפרויקט + לקוח + ownership hook
 * ├─ measured/
 * │  └─ room-<id>.json        ← שכבת measured (as-built): חדר → קירות → אביזרים, הכל מ"מ,
 * │                             נאמן-לחלוטין לישויות (כל שדה נשמר, בלי איבוד)
 * ├─ annotations.json         ← שכבת annotations: ריקה ב-v1 (מבנה מוגדר, מתמלא בהמשך)
 * └─ revisions.json           ← שכבת revisions: stub עם רשומת-genesis אחת (DR1)
 * ```
 *
 * שכבות עתידיות — `design` / `fit` / `catalog` / `bom` / `3d` — מסומנות
 * `present:false` ב-manifest ומתמלאות בשלבים מאוחרים; הסכמה forward-compatible מלכתחילה
 * (SOL_FORMAT.md §4), כך שהוספתן לא תשבור reader קיים.
 *
 * **יחידות:** כל הגאומטריה במ"מ (length/height/depth/fromLeft/width/fromBottom); זוויות
 * במעלות (`angle` = הפנייה לקיר-הבא). אין נרמול/עיגול-מוקדם — ‎.sol‎ שומר את מלוא-האמת.
 *
 * **מזהים:** אנחנו מאמצים את ה-id-ים הקיימים של ה-Room כמזהי-‎.sol‎ יציבים (SOL_FORMAT
 * build §4.3) — כדי ש-`fit/`+`design/` העתידיים יוכלו להצביע אליהם בלי remap.
 *
 * **הוק-הצפנה (v1b, עתידי):** מימוש זה כותב **plaintext v1a** (`encryption.scheme:"none"`).
 * כשתידרש הצפנה קשורת-רישיון (SOL_FORMAT.md §5), *אין צורך לגעת בלוגיקה כאן* — עוטפים את
 * ה-`OutputStream` הנכנס במעטפת-הצפנה (AES-256-GCM דרך Tink) לפני ההעברה ל-[write], ומעדכנים
 * את `encryption.scheme` ב-manifest ל-`"envelope-aesgcm"`. נקודת-ההשקה מסומנת למטה ב-[SEAL].
 *
 * הכתיבה כאן היא **single-pass וסטרימבילית**: manifest הוא ה-entry הראשון (לזיהוי-קובץ),
 * ואנו לא סוגרים את ה-`OutputStream` שהמתקשר מסר — רק `finish()`/`flush()` על ה-ZIP.
 */
object SolWriter {

    /** מזהה-הפורמט (task) — נשמר קצר "sol". */
    private const val FORMAT_ID = "sol"

    /** magic-string לזיהוי-קובץ בתוך ה-manifest (SOL_FORMAT.md §3.2). */
    private const val MAGIC = "SOL1"

    /** גרסת-הסכמה הסמנטית (MAJOR.MINOR.PATCH). */
    private const val SCHEMA_VERSION = "1.0.0"

    /** גרסת-ה-reader המינימלית שיודעת לקרוא קובץ זה. */
    private const val MIN_READER_VERSION = "1.0.0"

    /** מזהה-המפיק (producer) לצורכי provenance. */
    private const val PRODUCER = "Soline Measure 1.0.0"

    /** מזהה-הרוויזיה הראשונית שנרשם ב-revisions בעת המימוש הראשון. */
    private const val GENESIS_REVISION = "DR1"

    /** ‎.sol‎ v1a הוא plaintext; ראה [SEAL] ל-hook-ההצפנה העתידי. */
    private const val ENCRYPTION_SCHEME = "none"

    // ---------------------------------------------------------------------------------------
    // API ציבורי
    // ---------------------------------------------------------------------------------------

    /**
     * כותב פרויקט שלם כ-‎.sol‎ (ZIP) אל [out].
     *
     * @param project    הפרויקט (מטא + לקוח).
     * @param rooms       חדרי-הפרויקט (סדר-הכתיבה נשמר).
     * @param wallsByRoom מיפוי roomId → קירות; כל רשימה תמוין לפי `idx`.
     * @param accByWall   מיפוי wallId → אביזרים; נשמרים מקוננים תחת הקיר, נאמן-לחלוטין.
     * @param out         זרם-היעד. **לא נסגר** ע"י מתודה זו — האחריות על המתקשר (SAF/FileOutputStream).
     */
    fun write(
        project: Project,
        rooms: List<RoomEntity>,
        wallsByRoom: Map<Long, List<WallEntity>>,
        accByWall: Map<Long, List<AccessoryEntity>>,
        out: OutputStream,
    ) {
        // [SEAL] hook-הצפנה עתידי: לפני הבנייה, עטוף כאן את `out` במעטפת-AEAD (v1b) —
        // ראה KDoc של האובייקט. ב-v1a הזרם נכתב כמו-שהוא (plaintext).
        val nowIso = DateTimeFormatter.ISO_INSTANT.format(Instant.now())
        val stamp = project.createdAt // חותמת-זמן דטרמיניסטית ל-entries (round-trip יציב)

        val zip = ZipOutputStream(out)
        try {
            // manifest חייב להיות ה-entry הראשון (זיהוי-קובץ מיידי מרשומת-ה-ZIP).
            putEntry(zip, "manifest.json", buildManifest(project, rooms, nowIso), stamp)
            putEntry(zip, "meta.json", buildMeta(project, nowIso), stamp)
            for (room in rooms) {
                val walls = wallsByRoom[room.id].orEmpty().sortedBy { it.idx }
                putEntry(zip, "measured/room-${room.id}.json", buildRoom(room, walls, accByWall), stamp)
            }
            // הטמעת ORDX מלא (measured/source.ordx) — הממיר מעדיף אותו על room-json,
            // כך שהגאומטריה lossless ולא best-effort. לחדר-יחיד (המקרה הנפוץ במדידה).
            if (rooms.size == 1) {
                val r = rooms[0]
                val walls = wallsByRoom[r.id].orEmpty().sortedBy { it.idx }
                try {
                    putEntry(zip, "measured/source.ordx", OrdxExporter.toOrdx(r, walls, accByWall), stamp)
                } catch (_: Exception) { /* ORDX אופציונלי — אם נכשל, הממיר יבנה מ-room-json */ }
            }
            putEntry(zip, "annotations.json", buildAnnotations(), stamp)
            putEntry(zip, "revisions.json", buildRevisions(nowIso), stamp)
            zip.finish() // כותב את ה-central-directory בלי לסגור את `out`.
            zip.flush()
        } finally {
            // בכוונה איננו קוראים ל-zip.close() (הוא סוגר את `out`). המתקשר סוגר את הזרם.
        }
    }

    /**
     * שם-קובץ בטוח ל-‎.sol‎, שומר-עברית: `<name>.sol`.
     * מנקה תווים לא-חוקיים ל-filesystem (`\ / : * ? " < > |` ובקרה) ל-'_', מכווץ רווחים,
     * וגוזר. שומר אותיות-עברית/יוניקוד כמו-שהן. נופל ל-"project" אם השם מתרוקן.
     */
    fun fileName(project: Project): String {
        val base = sanitizeFileName(project.name).ifEmpty { "project" }
        return "$base.sol"
    }

    // ---------------------------------------------------------------------------------------
    // בוני-שכבות (JSON נבנה ידנית — בלי ספריית-JSON)
    // ---------------------------------------------------------------------------------------

    private fun buildManifest(project: Project, rooms: List<RoomEntity>, nowIso: String): String {
        val sb = StringBuilder(1024)
        sb.append("{\n")
        sb.append("  \"format\": ").append(jstr(FORMAT_ID)).append(",\n")
        sb.append("  \"magic\": ").append(jstr(MAGIC)).append(",\n")
        sb.append("  \"schemaVersion\": ").append(jstr(SCHEMA_VERSION)).append(",\n")
        sb.append("  \"minReaderVersion\": ").append(jstr(MIN_READER_VERSION)).append(",\n")
        sb.append("  \"producer\": ").append(jstr(PRODUCER)).append(",\n")
        sb.append("  \"projectId\": ").append(project.id).append(",\n")
        sb.append("  \"units\": ").append(jstr("mm")).append(",\n")
        sb.append("  \"coordinateSystem\": { \"yAxis\": \"up\", \"origin\": \"world\", \"handedness\": \"right\" },\n")
        sb.append("  \"createdAt\": ").append(jstr(nowIso)).append(",\n")
        sb.append("  \"updatedAt\": ").append(jstr(nowIso)).append(",\n")
        sb.append("  \"currentRevision\": ").append(jstr(GENESIS_REVISION)).append(",\n")
        sb.append("  \"encryption\": { \"scheme\": ").append(jstr(ENCRYPTION_SCHEME)).append(" },\n")
        sb.append("  \"layers\": {\n")
        // שכבות-v1 קיימות. sha256 עתידי (null ב-v1a) — ראה KDoc, hook §5.5.
        sb.append(layerLine("meta", true, "meta.json"))
        sb.append(layerLine("measured", true, "measured/"))
        sb.append(layerLine("annotations", true, "annotations.json"))
        sb.append(layerLine("revisions", true, "revisions.json"))
        // שכבות אופציונליות — מבנה מוגדר, טרם ממומשות.
        sb.append(layerLine("design", false, "design/"))
        sb.append(layerLine("fit", false, "fit/"))
        sb.append(layerLine("catalog", false, "catalog/"))
        sb.append(layerLine("bom", false, "bom/"))
        sb.append(layerLine("3d", false, "3d/", last = true))
        sb.append("  },\n")
        // אינדקס-חדרים לתוך שכבת measured (עוזר ל-reader לטעון לפי-דרישה).
        sb.append("  \"rooms\": [")
        rooms.forEachIndexed { i, r ->
            if (i > 0) sb.append(", ")
            sb.append("{ \"id\": ").append(r.id)
                .append(", \"name\": ").append(jstr(r.name))
                .append(", \"entry\": ").append(jstr("measured/room-${r.id}.json"))
                .append(" }")
        }
        sb.append("],\n")
        sb.append("  \"extensions\": {}\n")
        sb.append("}\n")
        return sb.toString()
    }

    private fun layerLine(name: String, present: Boolean, entry: String, last: Boolean = false): String {
        val comma = if (last) "" else ","
        return "    ${jstr(name)}: { \"present\": $present, \"entry\": ${jstr(entry)}, \"sha256\": null }$comma\n"
    }

    private fun buildMeta(project: Project, nowIso: String): String {
        val sb = StringBuilder(512)
        sb.append("{\n")
        sb.append("  \"projectId\": ").append(project.id).append(",\n")
        sb.append("  \"name\": ").append(jstr(project.name)).append(",\n")
        sb.append("  \"client\": ").append(jstr(project.client)).append(",\n")
        sb.append("  \"createdAt\": ").append(project.createdAt).append(",\n")
        sb.append("  \"materializedAt\": ").append(jstr(nowIso)).append(",\n")
        // hook-בעלות (SOL_FORMAT.md §6.4) — ממולא אמיתית כשיהיה שרת-רישוי.
        sb.append("  \"ownership\": { \"tenant\": \"soline\", \"owner\": null, \"license\": null }\n")
        sb.append("}\n")
        return sb.toString()
    }

    private fun buildRoom(
        room: RoomEntity,
        walls: List<WallEntity>,
        accByWall: Map<Long, List<AccessoryEntity>>,
    ): String {
        val sb = StringBuilder(2048)
        sb.append("{\n")
        sb.append("  \"id\": ").append(room.id).append(",\n")
        sb.append("  \"projectId\": ").append(room.projectId).append(",\n")
        sb.append("  \"name\": ").append(jstr(room.name)).append(",\n")
        sb.append("  \"walls\": [\n")
        walls.forEachIndexed { wi, w ->
            sb.append("    {\n")
            sb.append("      \"id\": ").append(w.id).append(",\n")
            sb.append("      \"roomId\": ").append(w.roomId).append(",\n")
            sb.append("      \"idx\": ").append(w.idx).append(",\n")
            sb.append("      \"length_mm\": ").append(jnum(w.length)).append(",\n")
            sb.append("      \"height_mm\": ").append(jnum(w.height)).append(",\n")
            sb.append("      \"angleToNext_deg\": ").append(jnum(w.angle)).append(",\n")
            val accs = accByWall[w.id].orEmpty()
            sb.append("      \"accessories\": [")
            if (accs.isEmpty()) {
                sb.append("]\n")
            } else {
                sb.append("\n")
                accs.forEachIndexed { ai, a ->
                    sb.append("        {\n")
                    sb.append("          \"id\": ").append(a.id).append(",\n")
                    sb.append("          \"wallId\": ").append(a.wallId).append(",\n")
                    sb.append("          \"type\": ").append(jstr(a.type)).append(",\n")
                    sb.append("          \"name\": ").append(jstr(a.name)).append(",\n")
                    sb.append("          \"depth_mm\": ").append(jnum(a.depth)).append(",\n")
                    sb.append("          \"fromLeft_mm\": ").append(jnum(a.fromLeft)).append(",\n")
                    sb.append("          \"width_mm\": ").append(jnum(a.width)).append(",\n")
                    sb.append("          \"fromBottom_mm\": ").append(jnum(a.fromBottom)).append(",\n")
                    sb.append("          \"height_mm\": ").append(jnum(a.height)).append("\n")
                    sb.append("        }").append(if (ai < accs.lastIndex) ",\n" else "\n")
                }
                sb.append("      ]\n")
            }
            sb.append("    }").append(if (wi < walls.lastIndex) ",\n" else "\n")
        }
        sb.append("  ]\n")
        sb.append("}\n")
        return sb.toString()
    }

    /** שכבת annotations — ריקה ב-v1, המבנה מוגדר לצורך תאימות-קדימה. */
    private fun buildAnnotations(): String =
        "{\n  \"notes\": [],\n  \"photos\": []\n}\n"

    /** שכבת revisions — stub עם רשומת-genesis אחת (append-only oplog בהמשך). */
    private fun buildRevisions(nowIso: String): String {
        val sb = StringBuilder(256)
        sb.append("{\n")
        sb.append("  \"history\": [\n")
        sb.append("    { \"rev\": ").append(jstr(GENESIS_REVISION))
            .append(", \"at\": ").append(jstr(nowIso))
            .append(", \"by\": null, \"stage\": \"measured\", \"note\": \"genesis\" }\n")
        sb.append("  ]\n")
        sb.append("}\n")
        return sb.toString()
    }

    // ---------------------------------------------------------------------------------------
    // עזרי-ZIP ו-JSON
    // ---------------------------------------------------------------------------------------

    private fun putEntry(zip: ZipOutputStream, path: String, content: String, time: Long) {
        val entry = ZipEntry(path)
        entry.time = time // דטרמיניסטי — לטובת round-trip/hash יציב
        zip.putNextEntry(entry)
        zip.write(content.toByteArray(Charsets.UTF_8))
        zip.closeEntry()
    }

    /** ערך-מספרי JSON נאמן (round-trippable); non-finite → null (JSON חוקי). */
    private fun jnum(v: Double): String = if (v.isFinite()) v.toString() else "null"

    /** מחרוזת-JSON עם מרכאות ומילוט; שומר יוניקוד (עברית) קריא. */
    private fun jstr(s: String): String {
        val out = StringBuilder(s.length + 2)
        out.append('"')
        for (c in s) {
            when (c) {
                '"' -> out.append("\\\"")
                '\\' -> out.append("\\\\")
                '\b' -> out.append("\\b")
                '\u000C' -> out.append("\\f")
                '\n' -> out.append("\\n")
                '\r' -> out.append("\\r")
                '\t' -> out.append("\\t")
                else -> if (c < ' ') out.append("\\u").append(c.code.toString(16).padStart(4, '0'))
                else out.append(c)
            }
        }
        out.append('"')
        return out.toString()
    }

    /** ניקוי שם-קובץ: תווים אסורים→'_', כיווץ-רווחים, גזירה; שומר-עברית. */
    private fun sanitizeFileName(name: String): String {
        val sb = StringBuilder(name.length)
        for (c in name) {
            when {
                c == '\\' || c == '/' || c == ':' || c == '*' || c == '?' ||
                    c == '"' || c == '<' || c == '>' || c == '|' || c < ' ' -> sb.append('_')
                else -> sb.append(c)
            }
        }
        // כיווץ רצפי-רווח ל-רווח יחיד וגזירה; הסרת נקודות/רווחים בקצוות (Windows).
        return sb.toString()
            .replace(Regex("\\s+"), " ")
            .trim()
            .trim('.', ' ')
    }
}
