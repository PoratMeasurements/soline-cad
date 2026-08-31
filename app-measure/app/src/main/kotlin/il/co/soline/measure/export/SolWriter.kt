package il.co.soline.measure.export

import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.CabinetEntity
import il.co.soline.measure.data.CabinetKind
import il.co.soline.measure.data.LevelPointEntity
import il.co.soline.measure.data.PhotoEntity
import il.co.soline.measure.data.Project
import il.co.soline.measure.data.ProjectChecklist
import il.co.soline.measure.data.RoomChecklist
import il.co.soline.measure.data.RoomEntity
import il.co.soline.measure.data.RoomSurvey
import il.co.soline.measure.data.VideoEntity
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.geometry.WallBuilder.Pt
import il.co.soline.measure.geometry.WallProfileSolver
import java.io.File
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
     * @param photosByRoom מיפוי roomId → תמונות-שדה; המטא נכתב ל-`annotations.json.photos[]`
     *                    וקבצי-ה-JPEG מוטמעים כ-entries בינאריים תחת `photos/` (ברירת-מחדל
     *                    ריק — תאימות-אחורה למתקשרים שלא מספקים תמונות).
     * @param out         זרם-היעד. **לא נסגר** ע"י מתודה זו — האחריות על המתקשר (SAF/FileOutputStream).
     */
    fun write(
        project: Project,
        rooms: List<RoomEntity>,
        wallsByRoom: Map<Long, List<WallEntity>>,
        accByWall: Map<Long, List<AccessoryEntity>>,
        cabinetsByRoom: Map<Long, List<CabinetEntity>> = emptyMap(),
        levelsByRoom: Map<Long, List<LevelPointEntity>> = emptyMap(),
        out: OutputStream,
        photosByRoom: Map<Long, List<PhotoEntity>> = emptyMap(),
        videosByRoom: Map<Long, List<VideoEntity>> = emptyMap(),
        projectPhotos: List<PhotoEntity> = emptyList(),
        projectVideos: List<VideoEntity> = emptyList(),
    ) {
        // [SEAL] hook-הצפנה עתידי: לפני הבנייה, עטוף כאן את `out` במעטפת-AEAD (v1b) —
        // ראה KDoc של האובייקט. ב-v1a הזרם נכתב כמו-שהוא (plaintext).
        val nowIso = DateTimeFormatter.ISO_INSTANT.format(Instant.now())
        val stamp = project.createdAt // חותמת-זמן דטרמיניסטית ל-entries (round-trip יציב)

        // תמונות-שדה: פותרים נתיבי-entry ייחודיים + מיפוי-wallIdx **לפני-הכתיבה**, כי
        // ה-manifest (ה-entry הראשון) צריך לדעת אם שכבת-photos נוכחת (present).
        // כולל מדיה-ברמת-הפרויקט (גישה-פתיחה/סגירה · roomId=null) בנוסף לתמונות-החדר.
        val photoRecs = resolvePhotoRecords(rooms, wallsByRoom, photosByRoom, projectPhotos)
        val videoRecs = resolveVideoRecords(rooms, wallsByRoom, videosByRoom, projectVideos)
        val hasPhotos = photoRecs.isNotEmpty()
        val hasVideos = videoRecs.isNotEmpty()

        val zip = ZipOutputStream(out)
        try {
            // manifest חייב להיות ה-entry הראשון (זיהוי-קובץ מיידי מרשומת-ה-ZIP).
            putEntry(zip, "manifest.json", buildManifest(project, rooms, nowIso, hasPhotos, hasVideos), stamp)
            putEntry(zip, "meta.json", buildMeta(project, nowIso), stamp)
            for (room in rooms) {
                val walls = wallsByRoom[room.id].orEmpty().sortedBy { it.idx }
                val cabs = cabinetsByRoom[room.id].orEmpty()
                val levels = levelsByRoom[room.id].orEmpty()
                putEntry(zip, "measured/room-${room.id}.json", buildRoom(room, walls, accByWall, cabs, levels), stamp)
            }
            // הערה: לא מטמיעים יותר measured/source.ordx — הנתיב-הנייטיב (room-json) נושא כעת
            // גם את שכבת-התכנון (ארונות), והממיר בונה ORDX מאומת-קורפוס + מרנדר ארונות+צוקל ממנו.
            val checklistJson = buildChecklist(rooms, wallsByRoom, photosByRoom, videosByRoom, projectPhotos, projectVideos)
            putEntry(zip, "annotations.json", buildAnnotations(photoRecs, videoRecs, checklistJson), stamp)
            putEntry(zip, "revisions.json", buildRevisions(nowIso), stamp)
            // הטמעת קבצי-ה-JPEG כ-entries בינאריים תחת photos/ — **סטרימינג** ישיר לתוך ה-ZIP
            // (copyTo) במקום readBytes(), כדי לא-לטעון קובץ-שלם לזיכרון (מונע OOM · קבוצה-E).
            for (rec in photoRecs) {
                val f = File(rec.absPath)
                if (!f.exists()) continue
                putBinaryEntryStreamed(zip, rec.path, f, stamp)
            }
            // הטמעת קבצי-הווידאו תחת videos/ בסטרימינג (וידאו כבד — אזהרת-גודל אם >25MB; עדיין מוטמע).
            for (rec in videoRecs) {
                val f = File(rec.absPath)
                if (!f.exists()) continue
                val len = f.length()
                if (len > 25 * 1024 * 1024) {
                    System.err.println("SolWriter: video ${rec.path} is ${len / (1024 * 1024)}MB — embedded but large.")
                }
                putBinaryEntryStreamed(zip, rec.path, f, stamp)
            }
            zip.finish() // כותב את ה-central-directory בלי לסגור את `out`.
            zip.flush()
        } finally {
            // בכוונה איננו קוראים ל-zip.close() (הוא סוגר את `out`). המתקשר סוגר את הזרם.
        }
    }

    /**
     * רשומת-תמונה פתורה: הישות + אינדקס-הקיר (0-based, null אם תמונת-חדר) + נתיב-ה-entry
     * הייחודי ב-ZIP (=`file` ב-annotations, מקור-האמת). ה-`absPath` נשמר לקריאת-הבייטים.
     */
    private data class PhotoRec(val p: PhotoEntity, val wallIdx: Int?, val path: String, val absPath: String)

    /**
     * ממפה כל [PhotoEntity] ל-[PhotoRec]: פותר את אינדקס-הקיר (0-based, עקבי עם `measured/`),
     * ומחשב נתיב-entry ייחודי תחת `photos/`. שם-הקובץ המוסכם (`חזית-N_NN.jpg`) ממספר פר-חדר,
     * לכן בפרויקט רב-חדרי ייתכן שם-כפול — במקרה-זה מוסיפים סיומת-ביטול-כפילות (`_r{roomId}-{id}`)
     * כדי לא-ליצור entry-כפול ב-ZIP (שם-הבסיס נשמר כ-`name` ב-annotations). מדלגים על תמונות
     * שקובצן חסר (נמחק חיצונית) — לא-מפנים ל-entry שלא-קיים.
     */
    private fun resolvePhotoRecords(
        rooms: List<RoomEntity>,
        wallsByRoom: Map<Long, List<WallEntity>>,
        photosByRoom: Map<Long, List<PhotoEntity>>,
        projectPhotos: List<PhotoEntity> = emptyList(),
    ): List<PhotoRec> {
        if (photosByRoom.isEmpty() && projectPhotos.isEmpty()) return emptyList()
        val wallIdxById = HashMap<Long, Int>()
        for ((_, walls) in wallsByRoom) for (w in walls) wallIdxById[w.id] = w.idx
        val recs = ArrayList<PhotoRec>()
        val used = HashSet<String>()
        // תמונות-חדר/קיר (roomId מלא) ואחריהן מדיה-ברמת-הפרויקט (גישה · roomId=null).
        val flat = rooms.flatMap { photosByRoom[it.id].orEmpty() } + projectPhotos
        for (p in flat) {
            if (!File(p.absPath).exists()) continue
            var path = "photos/${p.fileName}"
            if (!used.add(path)) {
                val dot = p.fileName.lastIndexOf('.')
                val base = if (dot > 0) p.fileName.substring(0, dot) else p.fileName
                val ext = if (dot > 0) p.fileName.substring(dot) else ""
                path = "photos/${base}_p${p.projectId}r${p.roomId ?: 0}-${p.id}$ext"
                used.add(path)
            }
            recs.add(PhotoRec(p, p.wallId?.let { wallIdxById[it] }, path, p.absPath))
        }
        return recs
    }

    /** רשומת-סרטון פתורה — מקבילה ל-[PhotoRec]. */
    private data class VideoRec(val v: VideoEntity, val wallIdx: Int?, val path: String, val absPath: String)

    /** מקביל ל-[resolvePhotoRecords] לסרטונים: entry ייחודי תחת `videos/`. */
    private fun resolveVideoRecords(
        rooms: List<RoomEntity>,
        wallsByRoom: Map<Long, List<WallEntity>>,
        videosByRoom: Map<Long, List<VideoEntity>>,
        projectVideos: List<VideoEntity> = emptyList(),
    ): List<VideoRec> {
        if (videosByRoom.isEmpty() && projectVideos.isEmpty()) return emptyList()
        val wallIdxById = HashMap<Long, Int>()
        for ((_, walls) in wallsByRoom) for (w in walls) wallIdxById[w.id] = w.idx
        val recs = ArrayList<VideoRec>()
        val used = HashSet<String>()
        val flat = rooms.flatMap { videosByRoom[it.id].orEmpty() } + projectVideos
        for (v in flat) {
            if (!File(v.absPath).exists()) continue
            var path = "videos/${v.fileName}"
            if (!used.add(path)) {
                val dot = v.fileName.lastIndexOf('.')
                val base = if (dot > 0) v.fileName.substring(0, dot) else v.fileName
                val ext = if (dot > 0) v.fileName.substring(dot) else ""
                path = "videos/${base}_p${v.projectId}r${v.roomId ?: 0}-${v.id}$ext"
                used.add(path)
            }
            recs.add(VideoRec(v, v.wallId?.let { wallIdxById[it] }, path, v.absPath))
        }
        return recs
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

    private fun buildManifest(project: Project, rooms: List<RoomEntity>, nowIso: String, hasPhotos: Boolean, hasVideos: Boolean): String {
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
        // שכבת-photos: המטא ב-annotations.json, קבצי-ה-JPEG תחת photos/. present רק אם יש-תמונות.
        sb.append(layerLine("photos", hasPhotos, "photos/"))
        // שכבת-videos: המטא ב-annotations.videos[], קבצי-ה-mp4 תחת videos/. present רק אם יש-סרטונים.
        sb.append(layerLine("videos", hasVideos, "videos/"))
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
        cabinets: List<CabinetEntity> = emptyList(),
        levels: List<LevelPointEntity> = emptyList(),
    ): String {
        // מיפוי wallId(DB) → idx(0-based) — הממיר מצפה ל-wallId כאינדקס-הקיר
        val wallIdxById = walls.associate { it.id to it.idx }
        val sb = StringBuilder(2048)
        sb.append("{\n")
        sb.append("  \"id\": ").append(room.id).append(",\n")
        sb.append("  \"projectId\": ").append(room.projectId).append(",\n")
        sb.append("  \"name\": ").append(jstr(room.name)).append(",\n")
        // ── שדות-מודד ברמת-החדר (נקבעים בתחילת-המדידה) ─────────────────────────────
        sb.append(roomSurveyBlock(room))
        sb.append("  \"walls\": [\n")
        walls.forEachIndexed { wi, w ->
            sb.append("    {\n")
            sb.append("      \"id\": ").append(w.id).append(",\n")
            sb.append("      \"roomId\": ").append(w.roomId).append(",\n")
            sb.append("      \"idx\": ").append(w.idx).append(",\n")
            sb.append("      \"length_mm\": ").append(jnum(w.length)).append(",\n")
            sb.append("      \"height_mm\": ").append(jnum(w.height)).append(",\n")
            sb.append("      \"heightMeasured\": ").append(w.heightMeasured).append(",\n")
            // גובה-קו-הסימון / סופיט (הנמכת-תקרה) מהרצפה — הדאטום לתכנון ארונות-עליונים;
            // null ⇒ לא-סומן קו לקיר-הזה (תאימות-אחורה, כמו שאר-השדות האופציונליים).
            sb.append("      \"soffitHeight_mm\": ").append(w.soffitHeightMm?.let { jnum(it) } ?: "null").append(",\n")
            sb.append("      \"angleToNext_deg\": ").append(jnum(w.angle)).append(",\n")
            // סגנון-ראש-הקיר (ישר/משופע/גמלון) — נמדד פר-קיר, חובה לנגר (חיתוך-ראש).
            sb.append("      \"head\": { \"style\": ").append(jstr(w.headStyle))
                .append(", \"ridge_mm\": ").append(jnum(w.headRidgeMm))
                .append(", \"peak_mm\": ").append(jnum(w.headPeakMm)).append(" },\n")
            // מסגרת-החזית (X6) — מערך נקודות [[u,v,e],...] מ"מ; ריק ⇒ [] (תאימות-אחורה).
            sb.append("      \"framePoints\": ").append(w.framePointsJson.ifBlank { "[]" }).append(",\n")
            // בלוקים-עשירים אדיטיביים (שיטות A/B) — אופציונליים, כמו levelPoints/cabinets.
            sb.append(elevationBlock(w))
            sb.append(planBellyBlock(w))
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
                    // §5: דגל "נמדד-מול-ברירת-מחדל-קטלוג" — מקביל ל-heightMeasured לקירות.
                    // מאפשר לנגר/לשער-האיכות להבחין מדידה-אמיתית מניחוש-מידת-יצרן.
                    sb.append("          \"measured\": ").append(a.measured).append(",\n")
                    // §10: הערת-מודד חופשית פר-אלמנט — מה שהמודד רוצה שהנגר/המשרד ידעו.
                    sb.append("          \"notes\": ").append(jstr(a.notes)).append(",\n")
                    // אלמנט-רגיל: height_mm הוא השדה האחרון. פתח (דלת/חלון/מיזוג): מוסיפים
                    // בלוק "opening" פרמטרי (OPENING_ELEMENT_SCHEMA.md) הנושא את מידות-האמת.
                    if (a.openingKind.isEmpty()) {
                        sb.append("          \"height_mm\": ").append(jnum(a.height)).append("\n")
                    } else {
                        sb.append("          \"height_mm\": ").append(jnum(a.height)).append(",\n")
                        sb.append(openingBlock(a, w.idx))
                    }
                    sb.append("        }").append(if (ai < accs.lastIndex) ",\n" else "\n")
                }
                sb.append("      ]\n")
            }
            sb.append("    }").append(if (wi < walls.lastIndex) ",\n" else "\n")
        }
        sb.append("  ]")
        // שכבת-תכנון: ארונות (סכמת-הממיר) — kind=base|wall|tall · wallId=אינדקס-קיר
        if (cabinets.isEmpty()) {
            sb.append(",\n  \"cabinets\": []\n")
        } else {
            sb.append(",\n  \"cabinets\": [\n")
            cabinets.forEachIndexed { ci, c ->
                val belt = CabinetKind.of(c.kind).belt
                val kind = if (belt == "upper") "wall" else belt   // ממפה upper→wall לממיר
                sb.append("    {\n")
                sb.append("      \"roomId\": ").append(c.roomId).append(",\n")
                sb.append("      \"wallId\": ").append(wallIdxById[c.wallId] ?: 0).append(",\n")
                sb.append("      \"kind\": ").append(jstr(kind)).append(",\n")
                sb.append("      \"name\": ").append(jstr(c.name)).append(",\n")
                sb.append("      \"fromLeft\": ").append(jnum(c.fromLeft)).append(",\n")
                sb.append("      \"width\": ").append(jnum(c.width)).append(",\n")
                sb.append("      \"depth\": ").append(jnum(c.depth)).append(",\n")
                sb.append("      \"heightFrom\": ").append(jnum(c.heightFrom)).append(",\n")
                sb.append("      \"heightTo\": ").append(jnum(c.heightTo)).append(",\n")
                sb.append("      \"doorType\": ").append(jstr(c.doorType)).append("\n")
                sb.append("    }").append(if (ci < cabinets.lastIndex) ",\n" else "\n")
            }
            sb.append("  ]\n")
        }
        // שכבת סקר-המישוריות (רצפה/תקרה) — נקודות-סטייה מ-00 (Leica X6). ללא-שכבה-זו
        // הנגר לא מקבל את מפת-השיפועים; חובה שתגיע ל-.sol.
        sb.append(levelPointsBlock(levels))
        sb.append("}\n")
        return sb.toString()
    }

    /**
     * בלוק `levelPoints` — סקר-מישוריות רצפה/תקרה (LevelPointEntity). כל נקודה
     * נושאת surface (FLOOR/CEILING), מיקום (x,y), קריאת-גלם, סטייה-מ-00 (± מ"מ)
     * ודגל isZero (נקודת-ה-datum). מוחזר עם פסיק-מקדים והזחת-2, מסתיים ב-newline.
     */
    private fun levelPointsBlock(levels: List<LevelPointEntity>): String {
        val sb = StringBuilder(256)
        if (levels.isEmpty()) {
            sb.append(",\n  \"levelPoints\": []\n")
            return sb.toString()
        }
        sb.append(",\n  \"levelPoints\": [\n")
        levels.forEachIndexed { i, p ->
            sb.append("    { \"surface\": ").append(jstr(p.surface))
                .append(", \"idx\": ").append(p.idx)
                .append(", \"x_mm\": ").append(jnum(p.x))
                .append(", \"y_mm\": ").append(jnum(p.y))
                .append(", \"raw_mm\": ").append(jnum(p.rawMm))
                .append(", \"deviation_mm\": ").append(jnum(p.deviationMm))
                .append(", \"isZero\": ").append(p.isZero).append(" }")
                .append(if (i < levels.lastIndex) ",\n" else "\n")
        }
        sb.append("  ]\n")
        return sb.toString()
    }

    /**
     * שדות-המודד ברמת-החדר (`entranceDirection` / `heightSweep` / `futureChanges`) —
     * נכתבים ישירות תחת אובייקט-החדר, לפני `walls`, כדי שהממיר/הדוח יצרכו אותם ברמת-החדר.
     *  · **entranceDirection** — כיוון-הכניסה האמיתי (bearing במעלות + wallIdx אופציונלי);
     *    הדוח מצייר ממנו חץ-כניסה. bearing<0 ⇒ `bearingDeg:null`; wallIdx<0 ⇒ `wallIdx:null`.
     *  · **heightSweep** — מערך גבהי-התקרה שנמדדו; `min`/`max` נגזרים, וה-`binding`
     *    (הגובה-המחייב) = המינימום. ריק ⇒ מערך-ריק ו-null-ים.
     *  · **futureChanges** — הערות-שינויי-קירות מתוכננים, כל אחת scope=wall(+wallId)|room.
     * מוחזר עם הזחה של 2 רווחים (בתוך אובייקט-החדר) ומסתיים ב-newline.
     */
    private fun roomSurveyBlock(room: RoomEntity): String {
        val sb = StringBuilder(512)
        // entranceDirection — bearing/wallIdx (חץ-הדוח) + relation/vantage (טקסט-מודד, תוספתי)
        val bearing = if (room.entranceBearingDeg < 0.0) "null" else jnum(room.entranceBearingDeg)
        val entWall = if (room.entranceWallIdx < 0) "null" else room.entranceWallIdx.toString()
        sb.append("  \"entranceDirection\": { \"bearingDeg\": ").append(bearing)
            .append(", \"wallIdx\": ").append(entWall)
            .append(", \"relation\": ").append(jstr(room.entranceRelation))
            .append(", \"vantage\": ").append(jstr(room.entranceVantage))
            .append(" },\n")
        // heightSweep — מערך + מינ'/מקס' + גובה-מחייב (=מינימום)
        val heights = RoomSurvey.parseHeights(room.heightSweepMm)
        val binding = RoomSurvey.bindingHeight(heights)
        sb.append("  \"heightSweep\": { \"values_mm\": [")
        heights.forEachIndexed { i, h -> if (i > 0) sb.append(", "); sb.append(jnum(h)) }
        sb.append("], \"minHeight_mm\": ").append(binding?.let { jnum(it) } ?: "null")
            .append(", \"maxHeight_mm\": ").append(heights.maxOrNull()?.let { jnum(it) } ?: "null")
            .append(", \"bindingHeight_mm\": ").append(binding?.let { jnum(it) } ?: "null")
            .append(" },\n")
        // futureChanges — מערך-אובייקטים
        val changes = RoomSurvey.parseFutureChanges(room.futureChanges)
        if (changes.isEmpty()) {
            sb.append("  \"futureChanges\": [],\n")
        } else {
            sb.append("  \"futureChanges\": [\n")
            changes.forEachIndexed { i, c ->
                val wid = if (c.scope == "wall" && c.wallId >= 0) c.wallId.toString() else "null"
                sb.append("    { \"scope\": ").append(jstr(c.scope))
                    .append(", \"wallId\": ").append(wid)
                    .append(", \"text\": ").append(jstr(c.text)).append(" }")
                    .append(if (i < changes.lastIndex) ",\n" else "\n")
            }
            sb.append("  ],\n")
        }
        return sb.toString()
    }

    /**
     * בלוק-הפתח הפרמטרי (`opening`) בתוך רשומת-אביזר, לפי `OPENING_ELEMENT_SCHEMA.md`.
     * נכתב רק כאשר `openingKind` אינו-ריק. נושא את **מידות-האמת** שהמודד הזין (geom),
     * את התצורה (config) ואת המיקום-על-הקיר (pos). הממיר קורא `rec.opening` (עם fallback).
     * מוחזר עם הזחה של 10 רווחים (בתוך אובייקט-האביזר), ומסתיים ב-newline.
     */
    private fun openingBlock(a: AccessoryEntity, wallIdx: Int): String {
        val sb = StringBuilder(512)
        val sill = if (a.sillHeight < 0.0) "null" else jnum(a.sillHeight)
        sb.append("          \"opening\": {\n")
        sb.append("            \"kind\": ").append(jstr(a.openingKind)).append(",\n")
        sb.append("            \"typeKey\": ").append(jstr(a.type)).append(",\n")
        sb.append("            \"hebrewName\": ").append(jstr(a.name)).append(",\n")
        sb.append("            \"geom\": {\n")
        sb.append("              \"width\": ").append(jnum(a.width)).append(",\n")
        sb.append("              \"height\": ").append(jnum(a.height)).append(",\n")
        sb.append("              \"sillHeight\": ").append(sill).append(",\n")
        sb.append("              \"wallThickness\": ").append(jnum(a.wallThickness)).append(",\n")
        sb.append("              \"frameThickness\": ").append(jnum(a.frameThickness)).append(",\n")
        sb.append("              \"frameReveal\": ").append(jnum(a.frameReveal)).append(",\n")
        sb.append("              \"leafThickness\": ").append(jnum(a.leafThickness)).append("\n")
        sb.append("            },\n")
        sb.append("            \"config\": {\n")
        sb.append("              \"openMode\": ").append(jstr(a.openMode)).append(",\n")
        sb.append("              \"hingeSide\": ").append(jstrOrNull(a.hingeSide)).append(",\n")
        sb.append("              \"swing\": ").append(jstrOrNull(a.swing)).append(",\n")
        sb.append("              \"leafCount\": ").append(a.leafCount).append(",\n")
        sb.append("              \"glazing\": ").append(jstr(a.glazing)).append("\n")
        sb.append("            },\n")
        sb.append("            \"pos\": { \"wallId\": ").append(wallIdx)
            .append(", \"fromCorner\": ").append(jstr(a.fromCorner))
            .append(", \"offset\": ").append(jnum(a.fromLeft)).append(" }\n")
        sb.append("          }\n")
        return sb.toString()
    }

    /** מחרוזת-JSON, או `null` (JSON literal) אם ריקה — עבור hingeSide/swing האופציונליים. */
    private fun jstrOrNull(s: String): String = if (s.isEmpty()) "null" else jstr(s)

    /**
     * בלוק `elevation` (שיטה A) — מתאר-החזית האמיתי `outline:[[u,v],...]` + פס-ההגלייה
     * `undulation:[e,...]` (מ"מ), עם פינת-האפס/כיוון והבליטה-המירבית. נגזר מ-
     * [WallEntity.framePointsJson] ([[u,v,e]]) + [WallEntity.wallProfileJson] (מסגור).
     * ריק ⇒ "" (אין-בלוק; הממיר נופל ל-framePoints). מוחזר עם ",\n" מקדים-לאביזרים.
     */
    private fun elevationBlock(w: WallEntity): String {
        if (w.framePointsJson.isBlank()) return ""
        val arr = try { org.json.JSONArray(w.framePointsJson) } catch (e: Exception) { return "" }
        if (arr.length() == 0) return ""
        val meta = try { if (w.wallProfileJson.isBlank()) null else org.json.JSONObject(w.wallProfileJson) } catch (e: Exception) { null }
        val zc = meta?.optString("zeroCorner", "LEFT_BOTTOM") ?: "LEFT_BOTTOM"
        val dir = meta?.optString("direction", "CCW") ?: "CCW"
        val outline = StringBuilder(); val und = StringBuilder()
        var maxE = 0.0; var minE = 0.0
        // מדלגים על נקודה-פגומה (חסרת u/v) במקום להפיל את כל-הייצוא (קבוצה-E בביקורת);
        // הפסיק-המקדים נגזר מ-`outline.isNotEmpty()` כדי לשמור JSON תקין גם עם דילוגים.
        for (i in 0 until arr.length()) {
            val p = arr.optJSONArray(i) ?: continue
            if (p.length() < 2) continue
            val u = p.optDouble(0, 0.0); val v = p.optDouble(1, 0.0)
            val e = if (p.length() >= 3) p.optDouble(2, 0.0) else 0.0
            if (outline.isNotEmpty()) { outline.append(", "); und.append(", ") }
            outline.append("[").append(jnum(u)).append(", ").append(jnum(v)).append("]")
            und.append(jnum(e))
            if (e > maxE) maxE = e
            if (e < minE) minE = e
        }
        if (outline.isEmpty()) return "" // כל-הנקודות פגומות ⇒ אין-בלוק (הממיר נופל ל-framePoints)
        val sb = StringBuilder(256)
        sb.append("      \"elevation\": {\n")
        sb.append("        \"zeroCorner\": ").append(jstr(zc)).append(",\n")
        sb.append("        \"direction\": ").append(jstr(dir)).append(",\n")
        sb.append("        \"outline\": [").append(outline).append("],\n")
        sb.append("        \"undulation\": [").append(und).append("],\n")
        sb.append("        \"maxBulgeMm\": ").append(jnum(maxE)).append(", \"maxDipMm\": ").append(jnum(minE)).append("\n")
        sb.append("      },\n")
        return sb.toString()
    }

    /**
     * בלוק `planBelly` (שיטה B) — הבטן במבט-על: מיתר A→B, פוליליין-התוכנית, היסטים-
     * ניצבים-מסומנים (`+ = לתוך-החדר`), ומדדי-מוטה/מתאר/בליטות. נגזר מ-
     * [WallEntity.wallProfileJson].plan דרך [WallProfileSolver.planBelly]. ריק ⇒ "".
     */
    private fun planBellyBlock(w: WallEntity): String {
        if (w.wallProfileJson.isBlank()) return ""
        val o = try { org.json.JSONObject(w.wallProfileJson) } catch (e: Exception) { return "" }
        val planArr = o.optJSONArray("plan") ?: return ""
        if (planArr.length() < 2) return ""
        val flip = o.optBoolean("flip", false)
        val pts = ArrayList<Pt>(planArr.length())
        // מדלגים על נקודת-תוכנית פגומה (חסרת x/y) במקום להפיל את כל-הייצוא (קבוצה-E).
        for (i in 0 until planArr.length()) {
            val p = planArr.optJSONArray(i) ?: continue
            if (p.length() < 2) continue
            pts.add(Pt(p.optDouble(0, 0.0), p.optDouble(1, 0.0)))
        }
        if (pts.size < 2) return "" // פחות-מ-2 נקודות תקינות ⇒ אין-בלוק
        val belly = WallProfileSolver.planBelly(pts, flip) ?: return ""
        val ptsS = StringBuilder(); val offS = StringBuilder()
        pts.forEachIndexed { i, p ->
            if (i > 0) { ptsS.append(", "); offS.append(", ") }
            ptsS.append("[").append(jnum(p.x)).append(", ").append(jnum(p.y)).append("]")
            offS.append(jnum(belly.offsets[i]))
        }
        val sb = StringBuilder(256)
        sb.append("      \"planBelly\": {\n")
        sb.append("        \"chord\": [[").append(jnum(belly.chordA.x)).append(", ").append(jnum(belly.chordA.y))
            .append("], [").append(jnum(belly.chordB.x)).append(", ").append(jnum(belly.chordB.y)).append("]],\n")
        sb.append("        \"points\": [").append(ptsS).append("],\n")
        sb.append("        \"offsets\": [").append(offS).append("],\n")
        sb.append("        \"spanMm\": ").append(jnum(belly.spanMm)).append(", \"developedMm\": ").append(jnum(belly.developedMm))
            .append(", \"maxPosMm\": ").append(jnum(belly.maxPosMm)).append(", \"maxNegMm\": ").append(jnum(belly.maxNegMm)).append("\n")
        sb.append("      },\n")
        return sb.toString()
    }

    /**
     * שכבת annotations — `notes` נשארת ריקה (טרם-ממומשת); `photos` מתמלאת ממטא-התמונות
     * (PHOTO_FEATURE_DESIGN §2.3). כל רשומה נושאת: `file` (נתיב-ה-entry ב-ZIP · מקור-האמת),
     * `name` (שם-הבסיס-המוסכם), `scope`, `wallIdx` (0-based · null אם תמונת-חדר), `wallLabel`,
     * `seq`, `elementId`, `caption`, `kind`, `takenAt`, `w`/`h`/`bytes`. הממיר צורך זאת לגלריה.
     */
    private fun buildAnnotations(photos: List<PhotoRec>, videos: List<VideoRec>, checklistJson: String): String {
        val sb = StringBuilder(512 + photos.size * 256 + videos.size * 256)
        sb.append("{\n")
        sb.append("  \"notes\": [],\n")
        // ── photos[] — צורתו נשמרת (§2.3); `phase` נוסף-אדיטיבית למדיה-ברמת-פרויקט. ──
        if (photos.isEmpty()) {
            sb.append("  \"photos\": [],\n")
        } else {
            sb.append("  \"photos\": [\n")
            photos.forEachIndexed { i, rec ->
                val p = rec.p
                val baseName = p.fileName.substringBeforeLast('.', p.fileName)
                val wallIdxJson = rec.wallIdx?.toString() ?: "null"
                val wallLabel = rec.wallIdx?.let { "חזית ${it + 1}" } ?: if (p.scope == "project") "פרויקט" else "חדר"
                val elementJson = p.elementId?.toString() ?: "null"
                sb.append("    {\n")
                sb.append("      \"file\": ").append(jstr(rec.path)).append(",\n")
                sb.append("      \"name\": ").append(jstr(baseName)).append(",\n")
                sb.append("      \"scope\": ").append(jstr(p.scope)).append(",\n")
                sb.append("      \"phase\": ").append(jstrOrNull(p.phase)).append(",\n")
                // roomId/projectId — אדיטיבי (קבוצת-בינוני בביקורת): עוזר לממיר לשייך מדיה
                // לחדר/פרויקט ישירות, בלי-להסתמך רק על wallIdx. null אם מדיית-פרויקט.
                sb.append("      \"roomId\": ").append(p.roomId?.toString() ?: "null").append(",\n")
                sb.append("      \"projectId\": ").append(p.projectId).append(",\n")
                sb.append("      \"wallIdx\": ").append(wallIdxJson).append(",\n")
                sb.append("      \"wallLabel\": ").append(jstr(wallLabel)).append(",\n")
                sb.append("      \"seq\": ").append(p.seq).append(",\n")
                sb.append("      \"elementId\": ").append(elementJson).append(",\n")
                sb.append("      \"caption\": ").append(jstr(p.caption)).append(",\n")
                sb.append("      \"kind\": ").append(jstr(p.kind)).append(",\n")
                sb.append("      \"takenAt\": ").append(jstr(p.takenAt)).append(",\n")
                sb.append("      \"w\": ").append(p.w).append(", \"h\": ").append(p.h)
                    .append(", \"bytes\": ").append(p.bytes).append("\n")
                sb.append("    }").append(if (i < photos.lastIndex) ",\n" else "\n")
            }
            sb.append("  ],\n")
        }
        // ── videos[] — מקביל ל-photos[] (§5.2). ──────────────────────────────────
        if (videos.isEmpty()) {
            sb.append("  \"videos\": [],\n")
        } else {
            sb.append("  \"videos\": [\n")
            videos.forEachIndexed { i, rec ->
                val v = rec.v
                val baseName = v.fileName.substringBeforeLast('.', v.fileName)
                val wallIdxJson = rec.wallIdx?.toString() ?: "null"
                val elementJson = v.elementId?.toString() ?: "null"
                sb.append("    {\n")
                sb.append("      \"file\": ").append(jstr(rec.path)).append(",\n")
                sb.append("      \"name\": ").append(jstr(baseName)).append(",\n")
                sb.append("      \"scope\": ").append(jstr(v.scope)).append(",\n")
                sb.append("      \"phase\": ").append(jstrOrNull(v.phase)).append(",\n")
                // roomId/projectId — אדיטיבי (שיוך-מדיה-לחדר · כמו ב-photos[]).
                sb.append("      \"roomId\": ").append(v.roomId?.toString() ?: "null").append(",\n")
                sb.append("      \"projectId\": ").append(v.projectId).append(",\n")
                sb.append("      \"wallIdx\": ").append(wallIdxJson).append(",\n")
                sb.append("      \"kind\": ").append(jstr(v.kind)).append(",\n")
                sb.append("      \"seq\": ").append(v.seq).append(",\n")
                sb.append("      \"elementId\": ").append(elementJson).append(",\n")
                sb.append("      \"caption\": ").append(jstr(v.caption)).append(",\n")
                sb.append("      \"takenAt\": ").append(jstr(v.takenAt)).append(",\n")
                sb.append("      \"durationSec\": ").append(v.durationSec)
                    .append(", \"bytes\": ").append(v.bytes).append("\n")
                sb.append("    }").append(if (i < videos.lastIndex) ",\n" else "\n")
            }
            sb.append("  ],\n")
        }
        // ── checklist (פר-חדר) + projectChecklist (שער-הפרויקט). ─────────────────
        sb.append(checklistJson)
        sb.append("}\n")
        return sb.toString()
    }

    /**
     * בונה את בלוקי `checklist` (פר-חדר) ו-`projectChecklist` (שער-הפרויקט) עבור
     * annotations. הספירות נגזרות דרך [RoomChecklist]/[ProjectChecklist] — אותה-חוקה
     * שמסך-הסגירה משתמש-בה. הבלוק מסתיים ב-newline (הוא הפריט-האחרון באובייקט).
     */
    private fun buildChecklist(
        rooms: List<RoomEntity>,
        wallsByRoom: Map<Long, List<WallEntity>>,
        photosByRoom: Map<Long, List<PhotoEntity>>,
        videosByRoom: Map<Long, List<VideoEntity>>,
        projectPhotos: List<PhotoEntity>,
        projectVideos: List<VideoEntity>,
    ): String {
        val sb = StringBuilder(512)
        var allRoomsComplete = true
        sb.append("  \"checklist\": {")
        rooms.forEachIndexed { ri, room ->
            val walls = wallsByRoom[room.id].orEmpty()
            val photos = photosByRoom[room.id].orEmpty()
            val videos = videosByRoom[room.id].orEmpty()
            val statuses = RoomChecklist.statuses(walls, photos, videos, RoomChecklist.parseSkips(room.mediaSkips))
            val complete = RoomChecklist.isComplete(room, statuses)
            if (!complete) allRoomsComplete = false
            if (ri > 0) sb.append(",")
            sb.append("\n    ").append(jstr(room.id.toString())).append(": { \"complete\": ").append(complete)
                .append(", \"categories\": {")
            statuses.forEachIndexed { ci, s ->
                if (ci > 0) sb.append(",")
                sb.append("\n      ").append(jstr(s.category.key)).append(": { \"satisfiedCount\": ").append(s.satisfiedCount)
                    .append(", \"requiredCount\": ").append(s.requiredCount)
                    .append(", \"required\": ").append(s.category.required)
                    .append(", \"done\": ").append(s.done)
                    .append(", \"skippedReason\": ").append(s.skippedReason?.let { jstr(it) } ?: "null")
                    .append(" }")
            }
            sb.append("\n    } }")
        }
        sb.append(if (rooms.isEmpty()) "},\n" else "\n  },\n")
        // projectChecklist — גישה-פתיחה/סגירה + סרטון-הסבר (אחד-או-יותר) + כל-החדרים-הושלמו.
        val accStatuses = ProjectChecklist.accessStatuses(projectPhotos, projectVideos)
        val explainer = ProjectChecklist.explainerStatus(projectVideos)
        val projectGate = ProjectChecklist.gateOpen(accStatuses, explainer, allRoomsComplete)
        sb.append("  \"projectChecklist\": { \"complete\": ").append(projectGate)
            .append(", \"allRoomsComplete\": ").append(allRoomsComplete)
            .append(", \"access\": {")
        accStatuses.forEachIndexed { i, s ->
            if (i > 0) sb.append(",")
            sb.append("\n    ").append(jstr(s.item.key)).append(": { \"phase\": ").append(jstr(s.item.phase))
                .append(", \"count\": ").append(s.count)
                .append(", \"done\": ").append(s.done)
                .append(" }")
        }
        sb.append("\n    },")
        // explainer — סרטון-הסבר ברמת-הפרויקט (scope="project", kind="explainer", בלי-שלב);
        // count=מספר-הסרטונים (אחד-או-יותר), done כאשר count≥1. הסרטונים עצמם ב-videos[].
        sb.append(" \"explainer\": { \"count\": ").append(explainer.count)
            .append(", \"done\": ").append(explainer.done)
            .append(" } }\n")
        return sb.toString()
    }

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

    /**
     * כותב entry-בינארי (למשל JPEG של תמונת-שדה) — זהה ל-[putEntry] אך לבייטים-גולמיים,
     * בלי מעבר-דרך-מחרוזת/UTF-8. שומר על אותה חותמת-זמן דטרמיניסטית.
     */
    private fun putBinaryEntry(zip: ZipOutputStream, path: String, bytes: ByteArray, time: Long) {
        val entry = ZipEntry(path)
        entry.time = time
        zip.putNextEntry(entry)
        zip.write(bytes)
        zip.closeEntry()
    }

    /**
     * כותב entry-בינארי בסטרימינג — מזרים את הקובץ ישירות לתוך ה-ZIP (`copyTo`) בלי
     * לטעון אותו כולו לזיכרון (מונע OOM על וידאו/תמונה כבדים · קבוצה-E בביקורת). מדפוס-
     * הסטרימינג של [il.co.soline.measure.data.BackupManager]. שומר על אותה חותמת-זמן.
     */
    private fun putBinaryEntryStreamed(zip: ZipOutputStream, path: String, file: File, time: Long) {
        val entry = ZipEntry(path)
        entry.time = time
        zip.putNextEntry(entry)
        runCatching { java.io.FileInputStream(file).use { it.copyTo(zip) } }
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
