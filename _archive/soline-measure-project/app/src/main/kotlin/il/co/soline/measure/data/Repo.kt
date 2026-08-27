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
    suspend fun deleteProject(p: Project) = dao.deleteProject(p)

    fun rooms(projectId: Long): Flow<List<RoomEntity>> = dao.rooms(projectId)
    fun room(id: Long): Flow<RoomEntity?> = dao.room(id)
    suspend fun addRoom(projectId: Long, name: String): Long =
        dao.insertRoom(RoomEntity(projectId = projectId, name = name))

    fun walls(roomId: Long): Flow<List<WallEntity>> = dao.walls(roomId)
    fun wall(id: Long): Flow<WallEntity?> = dao.wall(id)
    suspend fun addWall(roomId: Long, length: Double, height: Double): Long {
        val idx = dao.wallCount(roomId)
        return dao.insertWall(WallEntity(roomId = roomId, idx = idx, length = length, height = height))
    }
    suspend fun addWall(roomId: Long, length: Double, height: Double, angle: Double): Long {
        val idx = dao.wallCount(roomId)
        return dao.insertWall(WallEntity(roomId = roomId, idx = idx, length = length, height = height, angle = angle))
    }
    suspend fun updateWall(w: WallEntity) = dao.updateWall(w)
    suspend fun removeLastWall(roomId: Long) = dao.deleteLastWall(roomId)

    fun accessories(wallId: Long): Flow<List<AccessoryEntity>> = dao.accessories(wallId)
    suspend fun accessoriesForWall(wallId: Long): List<AccessoryEntity> = dao.accessoriesNow(wallId)
    suspend fun addAccessory(a: AccessoryEntity): Long = dao.insertAccessory(a)
    suspend fun updateAccessory(a: AccessoryEntity) = dao.updateAccessory(a)
    suspend fun deleteAccessory(a: AccessoryEntity) = dao.deleteAccessory(a)

    /** שמירת נקודות מסגרת-החזית (X6) על הקיר */
    suspend fun saveWallFramePoints(wallId: Long, json: String) =
        dao.setWallFramePoints(wallId, json)

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

    // ── level survey (מישוריות רצפה/תקרה) ───────────────────────────────────
    fun levelPoints(roomId: Long, surface: String): Flow<List<LevelPointEntity>> =
        dao.levelPoints(roomId, surface)

    /** קובע נקודת-00 חדשה (מחליף קודמת) עבור משטח בחדר. */
    suspend fun setLevelZero(roomId: Long, surface: String, rawMm: Double) {
        dao.clearLevelZero(roomId, surface)
        dao.insertLevelPoint(
            LevelPointEntity(roomId = roomId, surface = surface, idx = -1, x = 0.0, y = 0.0, rawMm = rawMm, deviationMm = 0.0, isZero = true)
        )
    }

    suspend fun addLevelPoint(roomId: Long, surface: String, idx: Int, x: Double, y: Double, rawMm: Double, deviationMm: Double) {
        dao.insertLevelPoint(
            LevelPointEntity(roomId = roomId, surface = surface, idx = idx, x = x, y = y, rawMm = rawMm, deviationMm = deviationMm)
        )
    }

    suspend fun clearLevel(roomId: Long, surface: String) = dao.clearLevelPoints(roomId, surface)

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

    /** ייצוא .sol (מקור-האמת שהממיר צורך) */
    suspend fun exportSol(project: Project, out: java.io.OutputStream) {
        val (rooms, wbr, abw) = gather(project.id)
        SolWriter.write(project, rooms, wbr, abw, out)
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
