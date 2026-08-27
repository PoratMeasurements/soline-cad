package il.co.soline.measure.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/* סקר-מישוריות (Level Survey) — רצפה ותקרה.
 *
 * הרעיון (Michael): עם ה-Leica X6 מגדירים נקודת "00" (datum), ואז ביחס אליה
 * מודדים רשת-נקודות סמוך לקירות — כל ~60 ס"מ, במרחק-היסט קבוע מהקיר — וכל נקודה
 * מציגה טקסטואלית את הסטייה מ-00 במ"מ (± פלוס/מינוס). בתוכנית-רצפה ובתוכנית-תקרה
 * נפרדות. הערך מתקבל מהמכשיר (מה שהלייקה מציגה) ומוזרק לנקודה.
 *
 * ישות חדשה — offline-first (Room). מוסיפים ל-SolineDatabase עם bump-גרסה. */

/** סוג-המשטח לסקר-מישוריות. */
object LevelSurface {
    const val FLOOR = "FLOOR"     // רצפה
    const val CEILING = "CEILING" // תקרה
}

/**
 * נקודת-מדידה בסקר-מישוריות. `isZero=true` היא נקודת-ה-00 (datum);
 * לשאר הנקודות `deviationMm` = ההפרש (מ"מ, מסומן ±) מקריאת-ה-00.
 */
@Entity(tableName = "level_points")
data class LevelPointEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val roomId: Long,
    val surface: String,       // LevelSurface.FLOOR | CEILING
    val idx: Int,              // סדר ברשת (−1 לנקודת-00)
    val x: Double,             // מיקום בתוכנית (מ"מ)
    val y: Double,             // מיקום בתוכנית (מ"מ)
    val rawMm: Double,         // הקריאה שהתקבלה מהמכשיר
    val deviationMm: Double,   // סטייה מ-00 (± מ"מ)
    val isZero: Boolean = false,
)
