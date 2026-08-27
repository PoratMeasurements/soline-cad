package il.co.soline.measure.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/* מודל-הנתונים של Soline Measure — פרויקט → חדר → קיר → בליטה.
 * offline-first (Room), החלטה #15. גל-1: מבנה בסיסי; יורחב לקיר-כפרופיל (#12). */

@Entity(tableName = "projects")
data class Project(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val client: String = "",
    val createdAt: Long = System.currentTimeMillis(),
)

@Entity(tableName = "rooms")
data class RoomEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val projectId: Long,
    val name: String,
)

@Entity(tableName = "walls")
data class WallEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val roomId: Long,
    val idx: Int,
    val length: Double,   // מ"מ
    val height: Double,   // מ"מ
    val angle: Double = 90.0, // מעלות — זווית לקיר הבא
    val framePointsJson: String = "", // נקודות מסגרת-החזית (X6) כ-JSON: [[x,y],...] מ"מ
)

@Entity(tableName = "accessories")
data class AccessoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val wallId: Long,
    val type: String,     // SOCKET_SINGLE | GAS_PIPE | WATER_PIPE | WINDOW | DOOR | COLUMN | ...
    val name: String,
    val depth: Double,    // D — עומק-בליטה מהקיר (מ"מ)
    val fromLeft: Double, // מיקום אופקי משמאל-הקיר (מ"מ)
    val width: Double,    // מ"מ
    val fromBottom: Double, // גובה תחתית מהרצפה (מ"מ)
    val height: Double,   // מ"מ
)

/** סוגי-בליטה (קטלוג בסיסי — מהאלמנטים שזיהינו באפליקציית-המדידה) */
enum class AccType(val he: String, val defaultDepth: Double) {
    SOCKET_SINGLE("שקע", 6.8),
    SOCKET_MULTI("שקע מרובע", 8.0),
    WATER_PIPE("מים", 30.0),
    GAS_PIPE("גז", 30.0),
    ELECTRICAL_LINE("תשתית חשמל", 5.0),
    WINDOW("חלון", 0.0),
    DOOR("דלת", 0.0),
    COLUMN("עמוד", 200.0),
    CEILING_DROP("הנמכת תקרה", 650.0);

    companion object {
        fun of(name: String): AccType = entries.firstOrNull { it.name == name } ?: SOCKET_SINGLE
    }
}
