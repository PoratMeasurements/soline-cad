package il.co.soline.measure.data

import android.app.Application
import il.co.soline.measure.export.OrdxExporter
import il.co.soline.measure.export.SolWriter
import il.co.soline.measure.fit.Cabinet
import il.co.soline.measure.fit.FitDelta
import il.co.soline.measure.fit.FitEngine
import il.co.soline.measure.fit.Protrusion
import il.co.soline.measure.fit.Wall
import kotlinx.coroutines.flow.Flow

/** שכבת-הגישה-לנתונים. עוטפת את ה-DAO + מריצה את מנוע-ההתאמה. */
class Repo(private val dao: SolineDao) {

    fun projects(): Flow<List<Project>> = dao.projects()
    fun project(id: Long): Flow<Project?> = dao.project(id)
    suspend fun addProject(name: String, client: String): Long =
        dao.insertProject(Project(name = name, client = client))
    /**
     * מחיקת-פרויקט עם cascade מלא: כל חדריו, קירותיו, בליטותיו, ארונותיו ונקודות-
     * המישוריות. מנקה ילדים מפורשות (הגנה גם אם אכיפת-FK כבויה) ואז את האב.
     */
    suspend fun deleteProject(p: Project) {
        // אוספים נתיבי-כל-קבצי-המדיה (חדר + פרויקט) לפני-המחיקה — כדי לנקותם מהדיסק;
        // רשומות-ה-DB של מדיית-החדר נמחקות ב-cascade, אך הקבצים-על-הדיסק אינם, ומדיית-
        // הפרויקט (scope="project", roomId=null) אין-לה FK-cascade כלל ולכן דולפת.
        val mediaPaths = ArrayList<String>()
        for (roomId in dao.roomIdsForProject(p.id)) {
            dao.photosInRoomNow(roomId).forEach { mediaPaths.add(it.absPath) }
            dao.videosInRoomNow(roomId).forEach { mediaPaths.add(it.absPath) }
            dao.deleteAccessoriesForRoom(roomId)
            dao.deleteCabinetsForRoom(roomId)
            dao.deleteWallsForRoom(roomId)
            dao.deleteLevelPointsForRoom(roomId)
        }
        // מדיה-ברמת-הפרויקט — מחיקה מפורשת של הרשומות (אין FK-cascade על projectId).
        for (ph in dao.projectPhotosNow(p.id)) { mediaPaths.add(ph.absPath); dao.deletePhoto(ph) }
        for (vd in dao.projectVideosNow(p.id)) { mediaPaths.add(vd.absPath); dao.deleteVideo(vd) }
        dao.deleteProject(p) // מוחק את הפרויקט + cascade לחדריו ולמדיית-החדר
        // ניקוי-קבצים: רק אם אף רשומה-שנותרה אינה מצביעה עוד על אותו קובץ.
        for (path in mediaPaths.distinct()) {
            if (dao.countPhotosByPath(path) == 0 && dao.countVideosByPath(path) == 0) {
                runCatching { java.io.File(path).takeIf { it.exists() }?.delete() }
            }
        }
    }

    /** מדדי-כל-הפרויקטים (חדרים/קירות/בליטות) — מזין את מסך-ניהול-המדידות. */
    fun projectStats(): Flow<List<ProjectStat>> = dao.projectStats()
    /** מסמן שהפרויקט יוצא ל-.sol (מעדכן חיווי "יוצא" בניהול-המדידות). */
    suspend fun markProjectExported(projectId: Long) =
        dao.setProjectExported(projectId, System.currentTimeMillis())

    fun rooms(projectId: Long): Flow<List<RoomEntity>> = dao.rooms(projectId)
    fun room(id: Long): Flow<RoomEntity?> = dao.room(id)
    suspend fun addRoom(projectId: Long, name: String): Long =
        dao.insertRoom(RoomEntity(projectId = projectId, name = name))
    /**
     * מנקה את כל קירות-החדר (ובליטותיהם/ארונותיהם) בלי למחוק את החדר עצמו —
     * לזרימת "החלף" באשפים (B4 בביקורת) כשמריצים אשף על חדר שכבר יש בו קירות.
     */
    suspend fun clearRoomWalls(roomId: Long) {
        dao.deleteAccessoriesForRoom(roomId)
        dao.deleteCabinetsForRoom(roomId)
        dao.deleteWallsForRoom(roomId)
    }

    /** מחיקת-חדר עם cascade: קירותיו, בליטותיו, ארונותיו ונקודות-המישוריות. */
    suspend fun deleteRoom(roomId: Long) {
        dao.deleteAccessoriesForRoom(roomId)
        dao.deleteCabinetsForRoom(roomId)
        dao.deleteWallsForRoom(roomId)
        dao.deleteLevelPointsForRoom(roomId)
        dao.deleteRoomById(roomId)
    }

    /** כיוון-הכניסה של החדר (שדה-עדיפות · נקבע בתחילת-המדידה). */
    suspend fun setRoomEntrance(roomId: Long, bearingDeg: Double, wallIdx: Int) =
        dao.setRoomEntrance(roomId, bearingDeg, wallIdx)
    /** תיאור-כניסה מילולי (יחס-לחזית-הראשית + נקודת-המבט של המודד). תוספתי לחוגת-הכיוון. */
    suspend fun setRoomEntranceText(roomId: Long, relation: String, vantage: String) =
        dao.setRoomEntranceText(roomId, relation, vantage)
    /**
     * מערך גבהי-התקרה (רשימת מ"מ) — נשמר כ-CSV; הגובה-המחייב = המינימום.
     * **מפייס-גבהים** (reconcile): מחיל את הגובה-המחייב **רק על קירות שטרם-נמדדו ידנית**
     * ומסמן להם `heightMeasured` — כך שהגובה שנמדד בפועל מגיע ל-`.sol` (במקום 2700 המדומה),
     * מבלי לדרוס גבהי-קיר פרטניים שהמודד כבר מדד. הגובה-המחייב נשאר ברמת-החדר (heightSweepMm).
     */
    suspend fun setRoomHeightSweep(roomId: Long, values: List<Double>) {
        val stored = RoomSurvey.heightsToStore(values)
        dao.setRoomHeightSweep(roomId, stored)
        // הגובה-המחייב (=מינימום מבין המדידות התקינות) מוחל רק על קירות לא-מדודים.
        RoomSurvey.bindingHeight(RoomSurvey.parseHeights(stored))
            ?.let { binding -> dao.applyRoomHeightToUnmeasured(roomId, binding) }
    }

    /** גובה-קיר בודד שנמדד/נערך ידנית — מסמן heightMeasured=true. */
    suspend fun setWallHeight(wallId: Long, height: Double) = dao.setWallHeight(wallId, height)
    /** הערות-שינויים-עתידיים (פר-קיר / פר-חדר). */
    suspend fun setRoomFutureChanges(roomId: Long, changes: List<RoomSurvey.FutureChange>) =
        dao.setRoomFutureChanges(roomId, RoomSurvey.futureChangesToStore(changes))

    fun walls(roomId: Long): Flow<List<WallEntity>> = dao.walls(roomId)
    fun wall(id: Long): Flow<WallEntity?> = dao.wall(id)
    suspend fun addWall(roomId: Long, length: Double, height: Double): Long {
        val idx = dao.wallCount(roomId)
        // הוספה-ידנית: המודד הקליד את הגובה במפורש ⇒ נחשב "מדוד".
        return dao.insertWall(WallEntity(roomId = roomId, idx = idx, length = length, height = height, heightMeasured = true))
    }
    suspend fun addWall(roomId: Long, length: Double, height: Double, angle: Double): Long {
        val idx = dao.wallCount(roomId)
        return dao.insertWall(WallEntity(roomId = roomId, idx = idx, length = length, height = height, angle = angle))
    }
    /**
     * עדכון-קיר. אם השתנה **אורך-הקיר** (עריכה-ידנית / כלֵי-סגירה+הצמדה) — מיישרים
     * מחדש את אביזריו כך שלא-יחרגו מהאורך-החדש (קיר-שהתקצר משאיר אביזר מחוץ-לקיר,
     * וייצוא-שקט של אלמנט-מחוץ-לקיר). לכל אביזר: היסט-הפינה נחסם ל-[0, אורך−רוחב]
     * (חסימה סימטרית לשתי-הפינות; גדל-אורך ⇒ אין-שינוי). רוחב-הגדול-מהאורך אינו-ניתן
     * לחסימה מלאה ⇒ מעוגן-לפינה ומסומן ע"י שער-האיכות (RoomValidator · ELEMENT_OFF_WALL).
     */
    suspend fun updateWall(w: WallEntity) {
        dao.updateWall(w)
        clampAccessoriesToWall(w.id, w.length)
    }

    /** חוסם את אביזרי-הקיר לתחום-האורך; מעדכן רק את אלה שחרגו (אין-שינוי אם הכל תקין). */
    private suspend fun clampAccessoriesToWall(wallId: Long, wallLength: Double) {
        if (wallLength <= 0.0) return
        for (a in dao.accessoriesNow(wallId)) {
            val maxOffset = (wallLength - a.width).coerceAtLeast(0.0)
            val clamped = a.fromLeft.coerceIn(0.0, maxOffset)
            if (clamped != a.fromLeft) dao.updateAccessory(a.copy(fromLeft = clamped))
        }
    }

    suspend fun removeLastWall(roomId: Long) = dao.deleteLastWall(roomId)

    /**
     * מחיקת קיר-בודד (לא רק האחרון · A1 בביקורת): מנקה בליטות/ארונות של הקיר,
     * מוחק את הקיר, ואז דוחס את ה-idx כדי לשמור רצף 0..n-1 (מונע פערי-אינדקס).
     *
     * בנוסף מסנכרן את ההפניות-לקיר שלא מחוברות ב-FK ולכן היו נשארות תלויות-באוויר
     * (מחיקת-קיר-אמצעי משבשת polyline · ביקורת):
     *  · **זווית-הפנייה** — הקיר-הקודם יורש את סכום-הפניות (קודם→נמחק→הבא) כך שכיוון
     *    הקיר-שאחרי-הנמחק נשמר ו-[WallBuilder.layout] אינו מייצר מתאר-שבור.
     *  · **entranceWallIdx** — אופס אם הכניסה הייתה על הקיר-הנמחק, אחרת מוסט ב-1 אם >נמחק.
     *  · **futureChanges** — הערות-פר-קיר: נמחקות אם הצביעו על הנמחק, אחרת idx מוסט ב-1.
     */
    suspend fun deleteWall(roomId: Long, wallId: Long) {
        val walls = dao.wallsNow(roomId) // ממוין לפי idx (לפני-המחיקה)
        val deleted = walls.firstOrNull { it.id == wallId } ?: return
        val idx = deleted.idx
        val hasNext = walls.any { it.idx == idx + 1 }
        val prev = walls.firstOrNull { it.idx == idx - 1 }

        dao.deleteAccessoriesForWall(wallId)
        dao.deleteCabinetsForWall(wallId)
        dao.deleteWallById(wallId)
        dao.reindexWallsAfter(roomId, idx)

        // זווית-הפנייה: הקיר-הקודם מגשר על-פני הנמחק (רק כשיש קיר-אחריו לשמר את כיוונו).
        if (prev != null && hasNext) {
            dao.updateWall(prev.copy(angle = prev.angle + deleted.angle))
        }

        // סנכרון הפניות-רכות ברמת-החדר (entranceWallIdx + futureChanges).
        val room = dao.roomNow(roomId) ?: return
        if (room.entranceWallIdx >= 0) {
            val newEntrance = when {
                room.entranceWallIdx == idx -> -1
                room.entranceWallIdx > idx -> room.entranceWallIdx - 1
                else -> room.entranceWallIdx
            }
            if (newEntrance != room.entranceWallIdx)
                dao.setRoomEntrance(roomId, room.entranceBearingDeg, newEntrance)
        }
        if (room.futureChanges.isNotBlank()) {
            val changes = RoomSurvey.parseFutureChanges(room.futureChanges)
            val updated = changes.mapNotNull { c ->
                when {
                    c.scope != "wall" -> c
                    c.wallId == idx -> null                          // הצביע על הנמחק → הסרה
                    c.wallId > idx -> c.copy(wallId = c.wallId - 1)  // מוסט למטה
                    else -> c
                }
            }
            if (updated != changes)
                dao.setRoomFutureChanges(roomId, RoomSurvey.futureChangesToStore(updated))
        }
    }

    /** קובע/מנקה את גובה-קו-הסימון (סופיט · הנמכת-תקרה) לקיר; null מסיר את הקו. */
    suspend fun setWallSoffit(wallId: Long, mm: Double?) = dao.setWallSoffitHeight(wallId, mm)

    fun accessories(wallId: Long): Flow<List<AccessoryEntity>> = dao.accessories(wallId)
    suspend fun accessoriesForWall(wallId: Long): List<AccessoryEntity> = dao.accessoriesNow(wallId)
    suspend fun addAccessory(a: AccessoryEntity): Long = dao.insertAccessory(a)
    suspend fun updateAccessory(a: AccessoryEntity) = dao.updateAccessory(a)
    suspend fun deleteAccessory(a: AccessoryEntity) = dao.deleteAccessory(a)

    /** שמירת נקודות מסגרת-החזית (X6) על הקיר */
    suspend fun saveWallFramePoints(wallId: Long, json: String) =
        dao.setWallFramePoints(wallId, json)

    /** שמירת פרופיל-הקיר המורחב (מטא-מסגור + נקודות-בטן · שיטה B). */
    suspend fun saveWallProfile(wallId: Long, json: String) =
        dao.setWallProfile(wallId, json)

    /** שמירת סגנון-ראש-הקיר (CVSM #f-wall-topstyle) פר-קיר. */
    suspend fun saveWallHead(wallId: Long, style: String, ridgeMm: Double, peakMm: Double) =
        dao.setWallHead(wallId, style, ridgeMm, peakMm)

    // ── cabinets (שכבת-תכנון הנגר) ──────────────────────────────────────────
    fun cabinetsInRoom(roomId: Long): Flow<List<CabinetEntity>> = dao.cabinetsInRoom(roomId)
    fun cabinets(wallId: Long): Flow<List<CabinetEntity>> = dao.cabinets(wallId)
    suspend fun addCabinet(c: CabinetEntity): Long = dao.insertCabinet(c)
    suspend fun updateCabinet(c: CabinetEntity) = dao.updateCabinet(c)
    suspend fun deleteCabinet(c: CabinetEntity) = dao.deleteCabinet(c)

    // ── carpenters (הלקוח של Soline) ────────────────────────────────────────
    fun carpenters(): Flow<List<Carpenter>> = dao.carpenters()
    suspend fun carpenter(id: Long): Carpenter? = dao.carpenterNow(id)
    suspend fun addCarpenter(c: Carpenter): Long = dao.insertCarpenter(c)
    suspend fun updateCarpenter(c: Carpenter) = dao.updateCarpenter(c)
    suspend fun deleteCarpenter(c: Carpenter) = dao.deleteCarpenter(c)

    // ── jobs (פתיחת-עבודה) ──────────────────────────────────────────────────
    fun jobs(): Flow<List<JobEntity>> = dao.jobs()
    fun job(id: Long): Flow<JobEntity?> = dao.job(id)
    suspend fun addJob(j: JobEntity): Long = dao.insertJob(j)
    suspend fun updateJob(j: JobEntity) = dao.updateJob(j)
    suspend fun deleteJob(j: JobEntity) = dao.deleteJob(j)

    /** קידום/קביעת-סטטוס-עבודה ממסך-הלו"ז. */
    suspend fun setJobStatus(jobId: Long, status: String) = dao.setJobStatus(jobId, status)
    /** תזמון/דחיית-מועד + משך-מתוכנן ממסך-הלו"ז. */
    suspend fun setJobSchedule(jobId: Long, scheduledAt: Long, durationMin: Int) =
        dao.setJobSchedule(jobId, scheduledAt, durationMin)
    /** שיבוץ-מודד לעבודה. */
    suspend fun setJobAssignee(jobId: Long, assignee: String) = dao.setJobAssignee(jobId, assignee)

    // ── job events (seam למנוע-מדדים/GPS עתידי) ──────────────────────────────
    fun jobEvents(jobId: Long): Flow<List<JobEventEntity>> = dao.jobEvents(jobId)
    suspend fun addJobEvent(e: JobEventEntity): Long = dao.insertJobEvent(e)

    // ── מנוע-מדדים-נסתר (Ops-Metrics · GPS · צד-המשרד בלבד) ────────────────────
    // כל אלה נכתבים ע"י המנוע-הרץ-ברקע; אף מסך-מודד אינו קורא אותם.
    suspend fun addLocationSample(s: LocationSampleEntity): Long = dao.insertLocationSample(s)
    suspend fun samplesForDay(dayEpoch: Long): List<LocationSampleEntity> = dao.samplesForDay(dayEpoch)
    suspend fun pruneSamplesBefore(dayEpoch: Long) = dao.pruneSamplesBefore(dayEpoch)
    /** מחיקה-מלאה של דגימות-המיקום המקומיות (זכות-המחיקה בעת ביטול-הסכמה). */
    suspend fun deleteAllLocationSamples() = dao.deleteAllLocationSamples()
    suspend fun upsertWorkMetric(m: WorkMetricEntity) = dao.upsertWorkMetric(m)
    suspend fun workMetricNow(dayEpoch: Long): WorkMetricEntity? = dao.workMetricNow(dayEpoch)
    /** קריאת-המשרד: זרם המדדים-היומיים (לדשבורד-התפעולי העתידי). */
    fun workMetrics(): Flow<List<WorkMetricEntity>> = dao.workMetrics()
    /** מזהה העבודה-הפעילה-בשטח לשיוך-דגימות (0 אם אין). */
    suspend fun activeInFieldJobId(): Long = dao.activeInFieldJobId() ?: 0L
    suspend fun enqueueOfficeSync(kind: String, refKey: String, payloadJson: String): Long =
        dao.enqueueOfficeSync(OfficeSyncEntity(kind = kind, refKey = refKey, payloadJson = payloadJson))

    // ── level survey (מישוריות רצפה/תקרה) ───────────────────────────────────
    fun levelPoints(roomId: Long, surface: String): Flow<List<LevelPointEntity>> =
        dao.levelPoints(roomId, surface)

    /**
     * קובע נקודת-00 חדשה (מחליף קודמת) עבור משטח בחדר, ו**מחשב-מחדש** את הסטיות
     * של כל הנקודות הקיימות מול ה-0 החדש (A6 בביקורת): rawMm של כל נקודה מחזיק את
     * ה-Z המחושב, לכן deviation = rawMm − zeroZ מיושם על כל הנקודות — כדי שלא יוצגו
     * סטיות מול 0 ישן (חוסר-עקביות שקט).
     */
    suspend fun setLevelZero(roomId: Long, surface: String, rawMm: Double) {
        dao.clearLevelZero(roomId, surface)
        dao.insertLevelPoint(
            LevelPointEntity(roomId = roomId, surface = surface, idx = -1, x = 0.0, y = 0.0, rawMm = rawMm, deviationMm = 0.0, isZero = true)
        )
        // חישוב-מחדש של הסטיות הקיימות מול ה-0 החדש.
        for (p in dao.levelPointsForSurfaceNow(roomId, surface)) {
            if (p.isZero) continue
            dao.updateLevelPointDeviation(p.id, p.rawMm - rawMm)
        }
    }

    /** מחיקת נקודת-מישוריות בודדת (undo/מחיקת-שורה · A5 בביקורת). */
    suspend fun deleteLevelPoint(id: Long) = dao.deleteLevelPoint(id)

    suspend fun addLevelPoint(roomId: Long, surface: String, idx: Int, x: Double, y: Double, rawMm: Double, deviationMm: Double, noAngle: Boolean = false) {
        dao.insertLevelPoint(
            LevelPointEntity(roomId = roomId, surface = surface, idx = idx, x = x, y = y, rawMm = rawMm, deviationMm = deviationMm, noAngle = noAngle)
        )
    }

    suspend fun clearLevel(roomId: Long, surface: String) = dao.clearLevelPoints(roomId, surface)

    // ── photos (תמונות-שדה פר-חזית · פיצ'ר-תמונות) ──────────────────────────
    fun photos(wallId: Long): Flow<List<PhotoEntity>> = dao.photos(wallId)
    fun photosInRoom(roomId: Long): Flow<List<PhotoEntity>> = dao.photosInRoom(roomId)
    fun roomLevelPhotos(roomId: Long): Flow<List<PhotoEntity>> = dao.roomLevelPhotos(roomId)
    suspend fun addPhoto(p: PhotoEntity): Long = dao.insertPhoto(p)
    suspend fun setPhotoCaption(id: Long, caption: String) = dao.setPhotoCaption(id, caption)
    /**
     * מחיקת-תמונה: מסירה את הרשומה **וגם** את קובץ-ה-JPEG המקומי (לא מותיר יתום).
     * מוחק את הקובץ רק אם אף רשומה-אחרת אינה מצביעה עליו (הגנה מפני-מחיקת-קובץ-משותף ·
     * קבוצה-A). עם שמות-דיסק-ייחודיים זה כמעט-תמיד יחיד, אך השמירה כאן חוגרת-כפול.
     */
    suspend fun deletePhoto(p: PhotoEntity) {
        dao.deletePhoto(p)
        if (dao.countPhotosByPath(p.absPath) == 0) {
            runCatching { java.io.File(p.absPath).takeIf { it.exists() }?.delete() }
        }
    }
    /** ה-seq הבא לחזית (מירבי-קיים+1, מתחיל ב-1) — מספור-אוטומטי פר-קיר. */
    suspend fun nextWallPhotoSeq(wallId: Long): Int = (dao.maxWallPhotoSeq(wallId) ?: 0) + 1
    /** ה-seq הבא לתמונות-ברמת-החדר (scope="room"). */
    suspend fun nextRoomPhotoSeq(roomId: Long): Int = (dao.maxRoomPhotoSeq(roomId) ?: 0) + 1

    // ── videos (סרטוני-שדה · רשימת-משימות-מדיה §5.2) ──────────────────────────
    fun videosInRoom(roomId: Long): Flow<List<VideoEntity>> = dao.videosInRoom(roomId)
    fun videos(wallId: Long): Flow<List<VideoEntity>> = dao.videos(wallId)
    suspend fun addVideo(v: VideoEntity): Long = dao.insertVideo(v)
    suspend fun setVideoCaption(id: Long, caption: String) = dao.setVideoCaption(id, caption)
    /**
     * מחיקת-סרטון: מסירה את הרשומה **וגם** את קובץ-ה-mp4 המקומי (לא מותיר יתום).
     * מוחק את הקובץ רק אם אף רשומה-אחרת אינה מצביעה עליו (הגנה מפני-מחיקת-קובץ-משותף).
     */
    suspend fun deleteVideo(v: VideoEntity) {
        dao.deleteVideo(v)
        if (dao.countVideosByPath(v.absPath) == 0) {
            runCatching { java.io.File(v.absPath).takeIf { it.exists() }?.delete() }
        }
    }
    /** ה-seq הבא לקטגוריה בחדר (מירבי-קיים+1, מתחיל ב-1) — מספור-אוטומטי פר-kind. */
    suspend fun nextVideoSeq(roomId: Long, kind: String): Int = (dao.maxVideoSeq(roomId, kind) ?: 0) + 1

    // ── מדיה-ברמת-הפרויקט (גישה-לאתר · פתיחה/סגירה · §5.1 מעודכן) ─────────────
    fun projectPhotos(projectId: Long): Flow<List<PhotoEntity>> = dao.projectPhotos(projectId)
    fun projectVideos(projectId: Long): Flow<List<VideoEntity>> = dao.projectVideos(projectId)
    suspend fun nextProjectPhotoSeq(projectId: Long, phase: String): Int = (dao.maxProjectPhotoSeq(projectId, phase) ?: 0) + 1
    suspend fun nextProjectVideoSeq(projectId: Long, phase: String): Int = (dao.maxProjectVideoSeq(projectId, phase) ?: 0) + 1

    // ── שער-סגירת-חדר (רשימת-משימות-מדיה §5.3) ────────────────────────────────
    /** קובע/מבטל סיבת-דילוג לקטגוריה בודדת (מוצא-השדה "דלג עם-סיבה"). */
    suspend fun setRoomCategorySkip(roomId: Long, category: String, reason: String?) {
        val room = dao.roomNow(roomId) ?: return
        dao.setRoomMediaSkips(roomId, RoomChecklist.withSkip(room.mediaSkips, category, reason))
    }
    /** האם כל-חדרי-הפרויקט במצב "הושלם" (שער-חדר-פתוח או נסגרו-בפועל). ריק ⇒ false. */
    suspend fun allRoomsComplete(projectId: Long): Boolean = incompleteRooms(projectId).let { inc ->
        dao.roomsNow(projectId).isNotEmpty() && inc.isEmpty()
    }

    /**
     * החדרים שטרם-הושלמו בפרויקט (שער-החדר עדיין-סגור) — מזין את רשימת-"נותרו"
     * במסך-סגירת-הפרויקט (מעבר-מהיר לכל `closeroom/{id}`). פרויקט-ריק ⇒ רשימה-ריקה.
     */
    suspend fun incompleteRooms(projectId: Long): List<RoomEntity> {
        val rooms = dao.roomsNow(projectId)
        return rooms.filter { r ->
            val statuses = RoomChecklist.statuses(
                dao.wallsNow(r.id), dao.photosInRoomNow(r.id), dao.videosInRoomNow(r.id),
                RoomChecklist.parseSkips(r.mediaSkips),
            )
            !RoomChecklist.isComplete(r, statuses)
        }
    }

    // ── דוח-מדידה HTML (צפייה-עצמית של המודד) ─────────────────────────────────
    /**
     * צרור-נתונים לדוח-החדר (HTML). קריאה-בלבד מעל-הנתונים-הקיימים — לא-נוגע
     * בנתיב-הייצוא ‎.sol‎. checklist כבר-מחושב (סטטוסי-שלמות) כדי שה-UI רק ירנדר.
     */
    data class RoomReport(
        val project: Project?,
        val room: RoomEntity?,
        val walls: List<WallEntity>,
        val accessories: List<AccessoryEntity>,
        val photos: List<PhotoEntity>,
        val levels: List<LevelPointEntity>,
        val checklist: List<RoomChecklist.Status>,
    )

    /** אוסף את כל נתוני-החדר לדוח-ה-HTML (רץ מחוץ-ל-Main; קריאה-בלבד). */
    suspend fun roomReport(roomId: Long): RoomReport {
        val room = dao.roomNow(roomId)
            ?: return RoomReport(null, null, emptyList(), emptyList(), emptyList(), emptyList(), emptyList())
        val project = dao.projectNow(room.projectId)
        val walls = dao.wallsNow(roomId)
        val accessories = walls.flatMap { dao.accessoriesNow(it.id) }
        val photos = dao.photosInRoomNow(roomId)
        val videos = dao.videosInRoomNow(roomId)
        val levels = dao.levelPointsNow(roomId)
        val checklist = RoomChecklist.statuses(walls, photos, videos, RoomChecklist.parseSkips(room.mediaSkips))
        return RoomReport(project, room, walls, accessories, photos, levels, checklist)
    }

    /** סוגר חדר (מציב חותמת-סגירה). השער נבדק ב-UI לפני-הקריאה. */
    suspend fun closeRoom(roomId: Long, ts: Long = System.currentTimeMillis()) = dao.setRoomClosedAt(roomId, ts)
    /** פותח-מחדש חדר-סגור (מאפס את חותמת-הסגירה). */
    suspend fun reopenRoom(roomId: Long) = dao.setRoomClosedAt(roomId, 0)

    /** סוגר פרויקט (מציב חותמת-סגירה ברמת-הפרויקט). השער נבדק ב-UI לפני-הקריאה. */
    suspend fun closeProject(projectId: Long, ts: Long = System.currentTimeMillis()) = dao.setProjectClosedAt(projectId, ts)
    /** פותח-מחדש פרויקט-סגור (מאפס את חותמת-הסגירה ל-null). */
    suspend fun reopenProject(projectId: Long) = dao.setProjectClosedAt(projectId, null)

    // ── custom CAD symbols (סמלי-CAD מותאמים-אישית · #f-cad-symbol) ───────────
    fun customSymbols(): Flow<List<CustomSymbolEntity>> = dao.customSymbols()
    suspend fun addCustomSymbol(s: CustomSymbolEntity): Long = dao.insertCustomSymbol(s)
    suspend fun updateCustomSymbol(s: CustomSymbolEntity) = dao.updateCustomSymbol(s)
    suspend fun deleteCustomSymbolByKey(key: String) = dao.deleteCustomSymbolByKey(key)

    /** אוסף את כל נתוני-הפרויקט לייצוא */
    private suspend fun gather(projectId: Long): Triple<List<RoomEntity>, Map<Long, List<WallEntity>>, Map<Long, List<AccessoryEntity>>> {
        val rooms = dao.roomsNow(projectId)
        val wallsByRoom = HashMap<Long, List<WallEntity>>()
        val accByWall = HashMap<Long, List<AccessoryEntity>>()
        for (r in rooms) {
            val ws = dao.wallsNow(r.id)
            wallsByRoom[r.id] = ws
            for (w in ws) accByWall[w.id] = dao.accessoriesNow(w.id)
        }
        return Triple(rooms, wallsByRoom, accByWall)
    }

    /**
     * מספר ממצאי-החסימה (BLOCK) של כל חדרי-הפרויקט — שער-הייצוא (A8 בביקורת).
     * נבדק על אותו סט-נתונים ש-exportSol אורז, כדי שהייצוא לא ישלח חדר לא-גמור.
     */
    suspend fun projectBlockingIssues(projectId: Long): Int {
        val rooms = dao.roomsNow(projectId)
        val walls = ArrayList<WallEntity>()
        val accByWall = HashMap<Long, List<AccessoryEntity>>()
        for (r in rooms) {
            val ws = dao.wallsNow(r.id)
            walls.addAll(ws)
            for (w in ws) accByWall[w.id] = dao.accessoriesNow(w.id)
        }
        if (walls.isEmpty()) return 0
        return il.co.soline.measure.fit.RoomValidator
            .validate(walls, accByWall)
            .count { it.severity == il.co.soline.measure.fit.Severity.BLOCK }
    }

    /** ייצוא .sol (מקור-האמת שהממיר צורך) */
    suspend fun exportSol(project: Project, out: java.io.OutputStream) {
        val (rooms, wbr, abw) = gather(project.id)
        // שכבת-תכנון: ארונות לכל חדר → נכתבים ל-.sol (הממיר מייצא אותם לכל הפורמטים)
        val cbr = HashMap<Long, List<CabinetEntity>>()
        // סקר-מישוריות רצפה/תקרה לכל חדר → נכתב ל-.sol (אחרת אבוד לחלוטין)
        val lbr = HashMap<Long, List<LevelPointEntity>>()
        // תמונות-שדה לכל חדר → מוטמעות ב-.sol כ-ZIP-entries בינאריים + מטא ב-annotations
        val pbr = HashMap<Long, List<PhotoEntity>>()
        // סרטוני-שדה לכל חדר → מוטמעים תחת videos/ + מטא ב-annotations.videos[] (§5.2)
        val vbr = HashMap<Long, List<VideoEntity>>()
        for (r in rooms) {
            cbr[r.id] = dao.cabinetsInRoomNow(r.id)
            lbr[r.id] = dao.levelPointsNow(r.id)
            pbr[r.id] = dao.photosInRoomNow(r.id)
            vbr[r.id] = dao.videosInRoomNow(r.id)
        }
        // מדיה-ברמת-הפרויקט (גישה-פתיחה/סגירה) — מוטמעת ומוזנת ל-projectChecklist
        val projPhotos = dao.projectPhotosNow(project.id)
        val projVideos = dao.projectVideosNow(project.id)
        SolWriter.write(project, rooms, wbr, abw, cbr, lbr, out, pbr, vbr, projPhotos, projVideos)
    }

    /** ייצוא ORDX (פורמט-חילוף) — כל החדרים */
    suspend fun exportOrdx(project: Project): String {
        val (rooms, wbr, abw) = gather(project.id)
        return rooms.joinToString("\n\n") { r -> OrdxExporter.toOrdx(r, wbr[r.id] ?: emptyList(), abw) }
    }

    /**
     * בדיקת-התאמה על חדר שלם: מניח שורת ארונות-בסיס (100–850 מ"מ) לאורך כל קיר,
     * ומריץ את R4 מול כל הבליטות. גל-1 — עד שיהיה שכבת-תכנון (design) אמיתית.
     */
    suspend fun runFit(roomId: Long): List<FitDelta> {
        val walls = dao.wallsNow(roomId)
        val fitWalls = ArrayList<Wall>()
        for (w in walls) {
            val prot = dao.accessoriesNow(w.id).map {
                Protrusion(it.id.toString(), it.type, it.name, it.depth, it.fromLeft, it.width, it.fromBottom, it.height)
            }
            fitWalls.add(Wall(w.id.toString(), prot))
        }
        // מעדיפים ארונות-אמת שהמשתמש הזין (מסך-הארונות); רק אם אין — נופלים חזרה
        // לשורת-בסיס מסונתזת לאורך כל קיר (גל-1).
        val dbCabinets = dao.cabinetsInRoomNow(roomId)
        val cabinets: List<Cabinet> = if (dbCabinets.isNotEmpty()) {
            dbCabinets.map { c ->
                Cabinet(
                    id = "cab-${c.id}", kind = CabinetKind.of(c.kind).belt, name = c.name,
                    wallId = c.wallId.toString(), fromLeft = c.fromLeft, width = c.width, depth = c.depth,
                    heightFrom = c.heightFrom, heightTo = c.heightTo,
                )
            }
        } else {
            walls.map { w ->
                Cabinet(
                    id = "cab-${w.id}", kind = "base", name = "ארונות בסיס · קיר ${w.idx + 1}",
                    wallId = w.id.toString(), fromLeft = 0.0, width = w.length, depth = 580.0,
                    heightFrom = 100.0, heightTo = 850.0,
                )
            }
        }
        return FitEngine.evaluate(cabinets, fitWalls)
    }
}

/** Application — מחזיק את ה-repo לכל האפליקציה (offline-first, מקומי). */
class SolineApp : Application() {
    lateinit var repo: Repo
        private set

    /** מד-הלייזר ברמת-האפליקציה — חיבור שורד ניווט/כיבוי-מסך (החלטת Michael) */
    val ble by lazy { il.co.soline.measure.device.LaserBle(this) }

    override fun onCreate() {
        super.onCreate()
        instance = this
        repo = Repo(SolineDatabase.get(this).dao())
    }

    companion object {
        lateinit var instance: SolineApp
            private set
    }
}
