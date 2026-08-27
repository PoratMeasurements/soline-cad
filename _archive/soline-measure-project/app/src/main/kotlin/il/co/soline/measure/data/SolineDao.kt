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

    @Insert
    suspend fun insertProject(p: Project): Long

    @Delete
    suspend fun deleteProject(p: Project)

    // rooms
    @Query("SELECT * FROM rooms WHERE projectId = :projectId ORDER BY id")
    fun rooms(projectId: Long): Flow<List<RoomEntity>>

    @Query("SELECT * FROM rooms WHERE projectId = :projectId ORDER BY id")
    suspend fun roomsNow(projectId: Long): List<RoomEntity>

    @Query("SELECT * FROM rooms WHERE id = :id")
    fun room(id: Long): Flow<RoomEntity?>

    @Insert
    suspend fun insertRoom(r: RoomEntity): Long

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

    @Query("UPDATE walls SET framePointsJson = :json WHERE id = :wallId")
    suspend fun setWallFramePoints(wallId: Long, json: String)

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

    // ── level points (סקר-מישוריות רצפה/תקרה) ───────────────────────────────
    @Query("SELECT * FROM level_points WHERE roomId = :roomId AND surface = :surface ORDER BY isZero DESC, idx")
    fun levelPoints(roomId: Long, surface: String): Flow<List<LevelPointEntity>>

    @Insert
    suspend fun insertLevelPoint(p: LevelPointEntity): Long

    @Query("DELETE FROM level_points WHERE roomId = :roomId AND surface = :surface AND isZero = 1")
    suspend fun clearLevelZero(roomId: Long, surface: String)

    @Query("DELETE FROM level_points WHERE roomId = :roomId AND surface = :surface")
    suspend fun clearLevelPoints(roomId: Long, surface: String)
}
