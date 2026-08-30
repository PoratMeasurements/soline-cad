package il.co.soline.measure.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface SolineDao {
    // projects
    @Query("SELECT * FROM projects ORDER BY createdAt DESC")
    fun projects(): Flow<List<Project>>

    @Query("SELECT * FROM projects WHERE id = :id")
    fun project(id: Long): Flow<Project?>

    @Query("SELECT * FROM projects WHERE id = :id")
    suspend fun projectNow(id: Long): Project?

    @Insert
    suspend fun insertProject(p: Project): Long

    @Update
    suspend fun updateProject(p: Project)

    @Delete
    suspend fun deleteProject(p: Project)

    // rooms
    @Query("SELECT * FROM rooms WHERE projectId = :projectId ORDER BY id")
    fun rooms(projectId: Long): Flow<List<RoomEntity>>

    @Query("SELECT * FROM rooms WHERE projectId = :projectId ORDER BY id")
    suspend fun roomsNow(projectId: Long): List<RoomEntity>

    @Query("SELECT * FROM rooms WHERE id = :id")
    fun room(id: Long): Flow<RoomEntity?>

    @Query("SELECT * FROM rooms WHERE id = :id")
    suspend fun roomNow(id: Long): RoomEntity?

    @Insert
    suspend fun insertRoom(r: RoomEntity): Long

    /** מחיקת חדר-בודד לפי-מזהה. ילדים (קירות/ארונות/מישוריות) נמחקים ב-cascade/מפורשות ב-Repo. */
    @Query("DELETE FROM rooms WHERE id = :roomId")
    suspend fun deleteRoomById(roomId: Long)

    /** ניקוי-ילדים מפורש — בליטות של כל קירות-החדר. */
    @Query("DELETE FROM accessories WHERE wallId IN (SELECT id FROM walls WHERE roomId = :roomId)")
    suspend fun deleteAccessoriesForRoom(roomId: Long)

    /** ניקוי-ילדים מפורש — כל קירות-החדר. */
    @Query("DELETE FROM walls WHERE roomId = :roomId")
    suspend fun deleteWallsForRoom(roomId: Long)

    /** ניקוי-ילדים מפורש — נקודות-מישוריות של החדר (שני המשטחים). */
    @Query("DELETE FROM level_points WHERE roomId = :roomId")
    suspend fun deleteLevelPointsForRoom(roomId: Long)

    /** מזהי-החדרים של פרויקט (לניקוי-ילדים-מפורש במחיקת-פרויקט). */
    @Query("SELECT id FROM rooms WHERE projectId = :projectId")
    suspend fun roomIdsForProject(projectId: Long): List<Long>

    /** כיוון-הכניסה של החדר (bearing במעלות + שיוך-קיר אופציונלי) — נקבע בתחילת-המדידה. */
    @Query("UPDATE rooms SET entranceBearingDeg = :bearingDeg, entranceWallIdx = :wallIdx WHERE id = :roomId")
    suspend fun setRoomEntrance(roomId: Long, bearingDeg: Double, wallIdx: Int)

    /** תיאור-כניסה מילולי — משלים את חוגת-כיוון-החץ (יחס-לחזית + נקודת-מבט). מיגרציה 18→19. */
    @Query("UPDATE rooms SET entranceRelation = :relation, entranceVantage = :vantage WHERE id = :roomId")
    suspend fun setRoomEntranceText(roomId: Long, relation: String, vantage: String)

    /** מערך גבהי-התקרה (CSV מ"מ) שנמדד ברחבי-החדר בתחילת-המדידה. */
    @Query("UPDATE rooms SET heightSweepMm = :csv WHERE id = :roomId")
    suspend fun setRoomHeightSweep(roomId: Long, csv: String)

    /** הערות-שינויים-עתידיים (מחרוזת-אחסון מסודרנת · [RoomSurvey]). */
    @Query("UPDATE rooms SET futureChanges = :stored WHERE id = :roomId")
    suspend fun setRoomFutureChanges(roomId: Long, stored: String)

    // walls
    @Query("SELECT * FROM walls WHERE roomId = :roomId ORDER BY idx")
    fun walls(roomId: Long): Flow<List<WallEntity>>

    @Query("SELECT * FROM walls WHERE roomId = :roomId ORDER BY idx")
    suspend fun wallsNow(roomId: Long): List<WallEntity>

    @Query("SELECT * FROM walls WHERE id = :id")
    fun wall(id: Long): Flow<WallEntity?>

    @Query("SELECT COUNT(*) FROM walls WHERE roomId = :roomId")
    suspend fun wallCount(roomId: Long): Int

    @Insert
    suspend fun insertWall(w: WallEntity): Long

    @Update
    suspend fun updateWall(w: WallEntity)

    @Query("DELETE FROM walls WHERE id = (SELECT id FROM walls WHERE roomId = :roomId ORDER BY idx DESC LIMIT 1)")
    suspend fun deleteLastWall(roomId: Long)

    /** מחיקת קיר-בודד לפי-מזהה (לא רק האחרון). ילדים נמחקים ב-cascade / מפורשות ב-Repo. */
    @Query("DELETE FROM walls WHERE id = :wallId")
    suspend fun deleteWallById(wallId: Long)

    /** קריאת idx של קיר (לצורך re-index אחרי מחיקת קיר-אמצעי). */
    @Query("SELECT idx FROM walls WHERE id = :wallId")
    suspend fun wallIdx(wallId: Long): Int?

    /** דחיסת ה-idx: כל קיר עם idx גדול מהנמחק יורד ב-1 (שומר רצף 0..n-1). */
    @Query("UPDATE walls SET idx = idx - 1 WHERE roomId = :roomId AND idx > :deletedIdx")
    suspend fun reindexWallsAfter(roomId: Long, deletedIdx: Int)

    @Query("UPDATE walls SET framePointsJson = :json WHERE id = :wallId")
    suspend fun setWallFramePoints(wallId: Long, json: String)

    /** שמירת פרופיל-הקיר המורחב (מטא-מסגור + נקודות-בטן) — מיגרציה 11→12. */
    @Query("UPDATE walls SET wallProfileJson = :json WHERE id = :wallId")
    suspend fun setWallProfile(wallId: Long, json: String)

    /** קובע גובה-מדוד לקיר-בודד (עריכה-ידנית) — מסמן heightMeasured=1. */
    @Query("UPDATE walls SET height = :height, heightMeasured = 1 WHERE id = :wallId")
    suspend fun setWallHeight(wallId: Long, height: Double)

    /**
     * מחיל גובה-מחייב (מהלך-גבהים) **רק על קירות שטרם-נמדדו ידנית** (heightMeasured=0)
     * — מסמן אותם heightMeasured=1. קירות עם גובה-פרטני-שנמדד נשמרים כמות-שהם, כדי
     * שמהלך-הגבהים לא ידרוס מדידות-אמת פר-קיר (הגובה-המחייב נשאר ברמת-החדר ב-heightSweepMm).
     */
    @Query("UPDATE walls SET height = :height, heightMeasured = 1 WHERE roomId = :roomId AND heightMeasured = 0")
    suspend fun applyRoomHeightToUnmeasured(roomId: Long, height: Double)

    /** קובע/מנקה את גובה-הסופית (קו-סימון) לקיר-בודד — null מסיר את הקו. */
    @Query("UPDATE walls SET soffitHeightMm = :mm WHERE id = :wallId")
    suspend fun setWallSoffitHeight(wallId: Long, mm: Double?)

    @Query("UPDATE walls SET headStyle = :style, headRidgeMm = :ridgeMm, headPeakMm = :peakMm WHERE id = :wallId")
    suspend fun setWallHead(wallId: Long, style: String, ridgeMm: Double, peakMm: Double)

    // accessories
    @Query("SELECT * FROM accessories WHERE wallId = :wallId ORDER BY fromLeft")
    fun accessories(wallId: Long): Flow<List<AccessoryEntity>>

    @Query("SELECT * FROM accessories WHERE wallId = :wallId")
    suspend fun accessoriesNow(wallId: Long): List<AccessoryEntity>

    @Insert
    suspend fun insertAccessory(a: AccessoryEntity): Long

    @Update
    suspend fun updateAccessory(a: AccessoryEntity)

    @Delete
    suspend fun deleteAccessory(a: AccessoryEntity)

    /** ניקוי-ילדים מפורש (הגנה גם אם אכיפת-FK כבויה במכשיר) — בליטות של קיר. */
    @Query("DELETE FROM accessories WHERE wallId = :wallId")
    suspend fun deleteAccessoriesForWall(wallId: Long)

    // ── cabinets (שכבת-תכנון הנגר) ──────────────────────────────────────────
    @Query("SELECT * FROM cabinets WHERE roomId = :roomId ORDER BY wallId, fromLeft")
    fun cabinetsInRoom(roomId: Long): Flow<List<CabinetEntity>>

    @Query("SELECT * FROM cabinets WHERE wallId = :wallId ORDER BY fromLeft")
    fun cabinets(wallId: Long): Flow<List<CabinetEntity>>

    @Query("SELECT * FROM cabinets WHERE roomId = :roomId ORDER BY wallId, fromLeft")
    suspend fun cabinetsInRoomNow(roomId: Long): List<CabinetEntity>

    @Insert
    suspend fun insertCabinet(c: CabinetEntity): Long

    @Update
    suspend fun updateCabinet(c: CabinetEntity)

    @Delete
    suspend fun deleteCabinet(c: CabinetEntity)

    /** ניקוי-ילדים מפורש — ארונות של קיר. */
    @Query("DELETE FROM cabinets WHERE wallId = :wallId")
    suspend fun deleteCabinetsForWall(wallId: Long)

    /** ניקוי-ילדים מפורש — ארונות של חדר. */
    @Query("DELETE FROM cabinets WHERE roomId = :roomId")
    suspend fun deleteCabinetsForRoom(roomId: Long)

    // ── carpenters (הלקוח של Soline) ────────────────────────────────────────
    @Query("SELECT * FROM carpenters ORDER BY name")
    fun carpenters(): Flow<List<Carpenter>>

    @Query("SELECT * FROM carpenters WHERE id = :id")
    suspend fun carpenterNow(id: Long): Carpenter?

    @Insert
    suspend fun insertCarpenter(c: Carpenter): Long

    @Update
    suspend fun updateCarpenter(c: Carpenter)

    @Delete
    suspend fun deleteCarpenter(c: Carpenter)

    // ── jobs (פתיחת-עבודה) ──────────────────────────────────────────────────
    @Query("SELECT * FROM jobs ORDER BY createdAt DESC")
    fun jobs(): Flow<List<JobEntity>>

    @Query("SELECT * FROM jobs WHERE carpenterId = :carpenterId ORDER BY createdAt DESC")
    fun jobsForCarpenter(carpenterId: Long): Flow<List<JobEntity>>

    @Query("SELECT * FROM jobs WHERE id = :id")
    fun job(id: Long): Flow<JobEntity?>

    @Insert
    suspend fun insertJob(j: JobEntity): Long

    @Update
    suspend fun updateJob(j: JobEntity)

    @Delete
    suspend fun deleteJob(j: JobEntity)

    /** קידום-סטטוס / שיבוץ מהיר ממסך-הלו"ז (ניהול). */
    @Query("UPDATE jobs SET status = :status WHERE id = :jobId")
    suspend fun setJobStatus(jobId: Long, status: String)

    /** תזמון/דחיית-מועד + משך-מתוכנן ממסך-הלו"ז. */
    @Query("UPDATE jobs SET scheduledAt = :scheduledAt, durationMin = :durationMin WHERE id = :jobId")
    suspend fun setJobSchedule(jobId: Long, scheduledAt: Long, durationMin: Int)

    /** שיבוץ-מודד (ניהול). */
    @Query("UPDATE jobs SET assignee = :assignee WHERE id = :jobId")
    suspend fun setJobAssignee(jobId: Long, assignee: String)

    // ── job events (seam למנוע-מדדים/GPS עתידי · טבלה ריקה כרגע) ───────────────
    @Query("SELECT * FROM job_events WHERE jobId = :jobId ORDER BY ts")
    fun jobEvents(jobId: Long): Flow<List<JobEventEntity>>

    @Insert
    suspend fun insertJobEvent(e: JobEventEntity): Long

    // ── מנוע-מדדים-נסתר · דגימות-מיקום (location_samples · צד-משרד) ─────────────
    @Insert
    suspend fun insertLocationSample(s: LocationSampleEntity): Long

    /** כל דגימות-היום (ממוין לפי-זמן) — קלט ל-MetricsComputer. */
    @Query("SELECT * FROM location_samples WHERE dayEpoch = :dayEpoch ORDER BY ts")
    suspend fun samplesForDay(dayEpoch: Long): List<LocationSampleEntity>

    /** ניקוי-שמירה: מסיר דגימות-גלם ישנות (המדד-המחושב כבר נשמר ב-work_metrics). */
    @Query("DELETE FROM location_samples WHERE dayEpoch < :beforeDayEpoch")
    suspend fun pruneSamplesBefore(beforeDayEpoch: Long)

    /** מחיקה-מלאה של דגימות-הגלם המקומיות — נקרא בעת "בטל הסכמה" (זכות-המחיקה). */
    @Query("DELETE FROM location_samples")
    suspend fun deleteAllLocationSamples()

    // ── מנוע-מדדים-נסתר · רול-אפ-יומי (work_metrics · צד-משרד) ──────────────────
    @androidx.room.Upsert
    suspend fun upsertWorkMetric(m: WorkMetricEntity)

    @Query("SELECT * FROM work_metrics WHERE dayEpoch = :dayEpoch")
    suspend fun workMetricNow(dayEpoch: Long): WorkMetricEntity?

    /** קריאת-המשרד: כל המדדים-היומיים (חדש→ישן) — יוזן לדשבורד-התפעולי. */
    @Query("SELECT * FROM work_metrics ORDER BY dayEpoch DESC")
    fun workMetrics(): Flow<List<WorkMetricEntity>>

    // ── מנוע-מדדים-נסתר · תור-שידור-למשרד (office_sync_queue) ───────────────────
    @Insert
    suspend fun enqueueOfficeSync(e: OfficeSyncEntity): Long

    @Query("SELECT * FROM office_sync_queue WHERE sent = 0 ORDER BY createdAt LIMIT :limit")
    suspend fun pendingOfficeSync(limit: Int): List<OfficeSyncEntity>

    @Query("UPDATE office_sync_queue SET sent = 1, sentAt = :ts WHERE id = :id")
    suspend fun markOfficeSyncSent(id: Long, ts: Long)

    /** העבודה-הפעילה בשטח (לשיוך-דגימות/אירועי-הגעה). null = אין יציאה-פעילה. */
    @Query("SELECT id FROM jobs WHERE status = 'in_field' ORDER BY createdAt DESC LIMIT 1")
    suspend fun activeInFieldJobId(): Long?

    // ── project export tracking (ניהול-מדידות) ───────────────────────────────
    @Query("UPDATE projects SET lastExportedAt = :ts WHERE id = :projectId")
    suspend fun setProjectExported(projectId: Long, ts: Long)

    /** סימון/ביטול סגירת-פרויקט (חותמת epoch; null = פתיחה-מחדש) — שער-סגירת-הפרויקט. */
    @Query("UPDATE projects SET closedAt = :ts WHERE id = :projectId")
    suspend fun setProjectClosedAt(projectId: Long, ts: Long?)

    /**
     * מדדי-פרויקט מצטברים לכל-הפרויקטים בשאילתה-אחת (ריאקטיבי) — מזין את
     * מסך-ניהול-המדידות: מס' חדרים, מס' קירות, ומס' בליטות לכל פרויקט.
     */
    @Query(
        "SELECT p.id AS projectId, " +
            "(SELECT COUNT(*) FROM rooms r WHERE r.projectId = p.id) AS rooms, " +
            "(SELECT COUNT(*) FROM walls w WHERE w.roomId IN (SELECT r2.id FROM rooms r2 WHERE r2.projectId = p.id)) AS walls, " +
            "(SELECT COUNT(*) FROM accessories a WHERE a.wallId IN " +
            "(SELECT w2.id FROM walls w2 WHERE w2.roomId IN (SELECT r3.id FROM rooms r3 WHERE r3.projectId = p.id))) AS accessories " +
            "FROM projects p"
    )
    fun projectStats(): Flow<List<ProjectStat>>

    // ── level points (סקר-מישוריות רצפה/תקרה) ───────────────────────────────
    @Query("SELECT * FROM level_points WHERE roomId = :roomId AND surface = :surface ORDER BY isZero DESC, idx")
    fun levelPoints(roomId: Long, surface: String): Flow<List<LevelPointEntity>>

    /** כל נקודות-המישוריות של החדר (שני המשטחים) — קלט לייצוא-ה-.sol. */
    @Query("SELECT * FROM level_points WHERE roomId = :roomId ORDER BY surface, isZero DESC, idx")
    suspend fun levelPointsNow(roomId: Long): List<LevelPointEntity>

    @Insert
    suspend fun insertLevelPoint(p: LevelPointEntity): Long

    /** נקודות-מישוריות של משטח (לחישוב-מחדש בעת קביעת-0 חדשה). */
    @Query("SELECT * FROM level_points WHERE roomId = :roomId AND surface = :surface")
    suspend fun levelPointsForSurfaceNow(roomId: Long, surface: String): List<LevelPointEntity>

    /** מחיקת נקודת-מישוריות בודדת (undo/מחיקת-שורה · לא רק "אפס הכל"). */
    @Query("DELETE FROM level_points WHERE id = :id")
    suspend fun deleteLevelPoint(id: Long)

    /** עדכון סטיית-נקודה (חישוב-מחדש מול נקודת-0 חדשה: dev = rawMm − zeroZ). */
    @Query("UPDATE level_points SET deviationMm = :deviationMm WHERE id = :id")
    suspend fun updateLevelPointDeviation(id: Long, deviationMm: Double)

    @Query("DELETE FROM level_points WHERE roomId = :roomId AND surface = :surface AND isZero = 1")
    suspend fun clearLevelZero(roomId: Long, surface: String)

    @Query("DELETE FROM level_points WHERE roomId = :roomId AND surface = :surface")
    suspend fun clearLevelPoints(roomId: Long, surface: String)

    // ── photos (תמונות-שדה פר-חזית · פיצ'ר-תמונות) ──────────────────────────
    @Query("SELECT * FROM photos WHERE roomId = :roomId ORDER BY wallId, seq")
    fun photosInRoom(roomId: Long): Flow<List<PhotoEntity>>

    @Query("SELECT * FROM photos WHERE wallId = :wallId ORDER BY seq")
    fun photos(wallId: Long): Flow<List<PhotoEntity>>

    /** תמונות-ברמת-החדר (scope="room" · ללא-שיוך-קיר) — לרצועת-החדר. */
    @Query("SELECT * FROM photos WHERE roomId = :roomId AND wallId IS NULL ORDER BY seq")
    fun roomLevelPhotos(roomId: Long): Flow<List<PhotoEntity>>

    /** כל תמונות-החדר (שני-הסקופים) — קלט לייצוא-ה-.sol. */
    @Query("SELECT * FROM photos WHERE roomId = :roomId ORDER BY wallId, seq")
    suspend fun photosInRoomNow(roomId: Long): List<PhotoEntity>

    @Query("SELECT * FROM photos WHERE wallId = :wallId ORDER BY seq")
    suspend fun photosForWallNow(wallId: Long): List<PhotoEntity>

    /** ה-seq המירבי הקיים לחזית (למספור-אוטומטי פר-קיר). null אם אין. */
    @Query("SELECT MAX(seq) FROM photos WHERE wallId = :wallId")
    suspend fun maxWallPhotoSeq(wallId: Long): Int?

    /** ה-seq המירבי הקיים לתמונות-החדר (scope="room"). null אם אין. */
    @Query("SELECT MAX(seq) FROM photos WHERE roomId = :roomId AND wallId IS NULL")
    suspend fun maxRoomPhotoSeq(roomId: Long): Int?

    @Insert
    suspend fun insertPhoto(p: PhotoEntity): Long

    @Delete
    suspend fun deletePhoto(p: PhotoEntity)

    /** כמה רשומות-תמונה מצביעות על אותו קובץ (הגנה מפני-מחיקת-קובץ-משותף · קבוצה-A). */
    @Query("SELECT COUNT(*) FROM photos WHERE absPath = :absPath")
    suspend fun countPhotosByPath(absPath: String): Int

    /** עדכון-כיתוב לתמונה (הערת-המודד). */
    @Query("UPDATE photos SET caption = :caption WHERE id = :id")
    suspend fun setPhotoCaption(id: Long, caption: String)

    // ── מדיה-ברמת-הפרויקט (גישה-לאתר · scope="project" · §5.1 מעודכן) ─────────
    @Query("SELECT * FROM photos WHERE projectId = :projectId AND scope = 'project' ORDER BY phase, seq")
    fun projectPhotos(projectId: Long): Flow<List<PhotoEntity>>

    @Query("SELECT * FROM photos WHERE projectId = :projectId AND scope = 'project' ORDER BY phase, seq")
    suspend fun projectPhotosNow(projectId: Long): List<PhotoEntity>

    @Query("SELECT MAX(seq) FROM photos WHERE projectId = :projectId AND scope = 'project' AND phase = :phase")
    suspend fun maxProjectPhotoSeq(projectId: Long, phase: String): Int?

    // ── videos (סרטוני-שדה · רשימת-משימות-מדיה §5.2) ──────────────────────────
    @Query("SELECT * FROM videos WHERE roomId = :roomId ORDER BY kind, seq")
    fun videosInRoom(roomId: Long): Flow<List<VideoEntity>>

    @Query("SELECT * FROM videos WHERE wallId = :wallId ORDER BY seq")
    fun videos(wallId: Long): Flow<List<VideoEntity>>

    /** כל סרטוני-החדר — קלט לייצוא-ה-.sol. */
    @Query("SELECT * FROM videos WHERE roomId = :roomId ORDER BY kind, seq")
    suspend fun videosInRoomNow(roomId: Long): List<VideoEntity>

    /** ה-seq המירבי הקיים לקטגוריה בחדר (למספור-אוטומטי פר-kind). null אם אין. */
    @Query("SELECT MAX(seq) FROM videos WHERE roomId = :roomId AND kind = :kind")
    suspend fun maxVideoSeq(roomId: Long, kind: String): Int?

    @Insert
    suspend fun insertVideo(v: VideoEntity): Long

    @Delete
    suspend fun deleteVideo(v: VideoEntity)

    /** כמה רשומות-סרטון מצביעות על אותו קובץ (הגנה מפני-מחיקת-קובץ-משותף · קבוצה-A). */
    @Query("SELECT COUNT(*) FROM videos WHERE absPath = :absPath")
    suspend fun countVideosByPath(absPath: String): Int

    /** עדכון-כיתוב לסרטון (הערת-המודד). */
    @Query("UPDATE videos SET caption = :caption WHERE id = :id")
    suspend fun setVideoCaption(id: Long, caption: String)

    // ── סרטוני-מדיה-ברמת-הפרויקט (גישה-לאתר · scope="project") ────────────────
    @Query("SELECT * FROM videos WHERE projectId = :projectId AND scope = 'project' ORDER BY phase, seq")
    fun projectVideos(projectId: Long): Flow<List<VideoEntity>>

    @Query("SELECT * FROM videos WHERE projectId = :projectId AND scope = 'project' ORDER BY phase, seq")
    suspend fun projectVideosNow(projectId: Long): List<VideoEntity>

    @Query("SELECT MAX(seq) FROM videos WHERE projectId = :projectId AND scope = 'project' AND phase = :phase")
    suspend fun maxProjectVideoSeq(projectId: Long, phase: String): Int?

    // ── שער-סגירת-חדר (רשימת-משימות-מדיה §5.3) ────────────────────────────────
    /** התמדת מפת-הדילוגים (JSON) של רשימת-המדיה לחדר. */
    @Query("UPDATE rooms SET mediaSkips = :json WHERE id = :roomId")
    suspend fun setRoomMediaSkips(roomId: Long, json: String)

    /** סימון/ביטול סגירת-חדר (חותמת epoch; 0 = פתיחה-מחדש). */
    @Query("UPDATE rooms SET closedAt = :ts WHERE id = :roomId")
    suspend fun setRoomClosedAt(roomId: Long, ts: Long)

    // ── custom CAD symbols (סמלי-CAD מותאמים-אישית · #f-cad-symbol) ───────────
    @Query("SELECT * FROM custom_symbols ORDER BY createdAt DESC")
    fun customSymbols(): Flow<List<CustomSymbolEntity>>

    @Insert
    suspend fun insertCustomSymbol(s: CustomSymbolEntity): Long

    @Update
    suspend fun updateCustomSymbol(s: CustomSymbolEntity)

    @Query("DELETE FROM custom_symbols WHERE `key` = :key")
    suspend fun deleteCustomSymbolByKey(key: String)
}
