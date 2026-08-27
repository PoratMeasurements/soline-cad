package il.co.soline.measure.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        Project::class,
        RoomEntity::class,
        WallEntity::class,
        AccessoryEntity::class,
        CabinetEntity::class,   // גל-חיווט: שכבת-הארונות (תכנון-הנגר)
        Carpenter::class,       // גל-חיווט: הנגר (הלקוח של Soline)
        JobEntity::class,       // גל-חיווט: פתיחת-עבודה עשירה
        LevelPointEntity::class, // סקר-מישוריות רצפה/תקרה
    ],
    version = 3,
    exportSchema = false,
)
abstract class SolineDatabase : RoomDatabase() {
    abstract fun dao(): SolineDao

    companion object {
        /**
         * מיגרציה 1→2: מוסיפה את שכבת-הארונות, הנגרים והעבודות + שדה מסגרת-החזית לקיר.
         * שומרת את כל מדידות-הבדיקה הקיימות של Michael (בלי מחיקה).
         * ה-CREATE TABLE תואמים בדיוק לסכימה ש-Room מצפה לה עבור הישויות.
         */
        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `walls` ADD COLUMN `framePointsJson` TEXT NOT NULL DEFAULT ''")
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `cabinets` (" +
                        "`id` INTEGER NOT NULL, `roomId` INTEGER NOT NULL, `wallId` INTEGER NOT NULL, " +
                        "`kind` TEXT NOT NULL, `name` TEXT NOT NULL, `fromLeft` REAL NOT NULL, " +
                        "`width` REAL NOT NULL, `depth` REAL NOT NULL, `heightFrom` REAL NOT NULL, " +
                        "`heightTo` REAL NOT NULL, `doorType` TEXT NOT NULL, PRIMARY KEY(`id`))"
                )
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `carpenters` (" +
                        "`id` INTEGER NOT NULL, `name` TEXT NOT NULL, `phone` TEXT NOT NULL, " +
                        "`company` TEXT NOT NULL, `email` TEXT NOT NULL, `notes` TEXT NOT NULL, " +
                        "`createdAt` INTEGER NOT NULL, PRIMARY KEY(`id`))"
                )
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `jobs` (" +
                        "`id` INTEGER NOT NULL, `carpenterId` INTEGER NOT NULL, `clientName` TEXT NOT NULL, " +
                        "`clientPhone` TEXT NOT NULL, `clientCompany` TEXT NOT NULL, `contact` TEXT NOT NULL, " +
                        "`email` TEXT NOT NULL, `address1` TEXT NOT NULL, `address2` TEXT NOT NULL, " +
                        "`city` TEXT NOT NULL, `zip` TEXT NOT NULL, `deliveryDifferent` INTEGER NOT NULL, " +
                        "`deliveryAddress` TEXT NOT NULL, `accessNotes` TEXT NOT NULL, `createdAt` INTEGER NOT NULL, " +
                        "PRIMARY KEY(`id`))"
                )
            }
        }

        /** מיגרציה 2→3: מוסיפה את טבלת סקר-המישוריות (רצפה/תקרה). */
        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `level_points` (" +
                        "`id` INTEGER NOT NULL, `roomId` INTEGER NOT NULL, `surface` TEXT NOT NULL, " +
                        "`idx` INTEGER NOT NULL, `x` REAL NOT NULL, `y` REAL NOT NULL, " +
                        "`rawMm` REAL NOT NULL, `deviationMm` REAL NOT NULL, `isZero` INTEGER NOT NULL, " +
                        "PRIMARY KEY(`id`))"
                )
            }
        }

        @Volatile private var INSTANCE: SolineDatabase? = null
        fun get(context: Context): SolineDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    SolineDatabase::class.java,
                    "soline.db",
                )
                    .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                    // רשת-ביטחון: אם אי-פעם יהיה אי-התאמת-סכימה, האפליקציה תיבנה מחדש
                    // ולא תקרוס בהפעלה. במצב-רגיל המיגרציה שומרת את הנתונים.
                    .fallbackToDestructiveMigration()
                    .build().also { INSTANCE = it }
            }
    }
}
