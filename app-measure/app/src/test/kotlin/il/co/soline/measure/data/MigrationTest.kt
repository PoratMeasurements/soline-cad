package il.co.soline.measure.data

import android.content.Context
import androidx.room.Room
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.SupportSQLiteOpenHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * MigrationTest — מריץ את **שרשרת-המיגרציה האמיתית 1→19** של [SolineDatabase]
 * ([SolineDatabase.ALL_MIGRATIONS]) על SQLite אמיתי (Robolectric · JVM, ללא-מכשיר),
 * ומוודא שהיא רצה-נקי + מייצרת בדיוק את הסכימה ש-Room מצפה-לה בגרסה-19.
 *
 * חשוב-כפליים כי ה-fallbackToDestructiveMigration גודר ל-DEBUG-בלבד (קבוצה-A): אם
 * מיגרציה שבורה, ב-release המשתמש יקבל קריסה (לא מחיקת-נתונים-בשקט) — לכן חייבים
 * לתפוס כאן. הבדיקה מכסה את השרשרת שאנו כתבנו (9→…→17): heightMeasured, FK/cascade,
 * photos, videos, measured, noAngle, closedAt.
 *
 * הגישה: בונים DB-גרסה-1 ב-SQL-גולמי (הטבלאות המקוריות), מריצים את כל-אובייקטי-
 * המיגרציה ברצף, ומשווים טבלאות+עמודות מול DB-Room-טרי שנבנה ישירות בגרסה-17. כך
 * אין-תלות בקבצי-סכימה-ביניים (Room פולט רק את הגרסה-הנוכחית).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MigrationTest {

    private val ctx: Context get() = ApplicationProvider.getApplicationContext()

    /** יוצר את סכימת-גרסה-1 (הטבלאות הבסיסיות שלפני MIGRATION_1_2). */
    private fun createV1(db: SupportSQLiteDatabase) {
        db.execSQL(
            "CREATE TABLE `projects` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "`name` TEXT NOT NULL, `client` TEXT NOT NULL DEFAULT '', `createdAt` INTEGER NOT NULL DEFAULT 0)"
        )
        db.execSQL(
            "CREATE TABLE `rooms` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "`projectId` INTEGER NOT NULL, `name` TEXT NOT NULL)"
        )
        db.execSQL(
            "CREATE TABLE `walls` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `roomId` INTEGER NOT NULL, " +
                "`idx` INTEGER NOT NULL, `length` REAL NOT NULL, `height` REAL NOT NULL, `angle` REAL NOT NULL DEFAULT 90.0)"
        )
        db.execSQL(
            "CREATE TABLE `accessories` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `wallId` INTEGER NOT NULL, " +
                "`type` TEXT NOT NULL, `name` TEXT NOT NULL, `depth` REAL NOT NULL, `fromLeft` REAL NOT NULL, " +
                "`width` REAL NOT NULL, `fromBottom` REAL NOT NULL, `height` REAL NOT NULL)"
        )
    }

    private fun openV1(): Pair<SupportSQLiteOpenHelper, SupportSQLiteDatabase> {
        val cfg = SupportSQLiteOpenHelper.Configuration.builder(ctx)
            .name(null) // in-memory
            .callback(object : SupportSQLiteOpenHelper.Callback(1) {
                override fun onCreate(db: SupportSQLiteDatabase) = createV1(db)
                override fun onUpgrade(db: SupportSQLiteDatabase, oldVersion: Int, newVersion: Int) {}
            })
            .build()
        val helper = FrameworkSQLiteOpenHelperFactory().create(cfg)
        return helper to helper.writableDatabase
    }

    private fun migrateAll(db: SupportSQLiteDatabase) {
        for (m in SolineDatabase.ALL_MIGRATIONS) m.migrate(db)
    }

    private fun columns(db: SupportSQLiteDatabase, table: String): Set<String> {
        val cols = HashSet<String>()
        db.query("PRAGMA table_info(`$table`)").use { c ->
            val nameIdx = c.getColumnIndex("name")
            while (c.moveToNext()) cols.add(c.getString(nameIdx))
        }
        return cols
    }

    private fun appTables(db: SupportSQLiteDatabase): Set<String> {
        val tables = HashSet<String>()
        db.query("SELECT name FROM sqlite_master WHERE type='table'").use { c ->
            while (c.moveToNext()) {
                val n = c.getString(0)
                if (!n.startsWith("sqlite_") && n != "room_master_table" && n != "android_metadata") tables.add(n)
            }
        }
        return tables
    }

    private fun count(db: SupportSQLiteDatabase, table: String): Int =
        db.query("SELECT COUNT(*) FROM `$table`").use { it.moveToFirst(); it.getInt(0) }

    // ── 1. השרשרת רצה-נקי ומוסיפה את העמודות/טבלאות של גל-9→17 ──────────────────

    @Test fun migrations_1_to_19_runCleanlyAndAddRecentChain() {
        val (helper, db) = openV1()
        try {
            migrateAll(db) // אסור-שתיזרק חריגה
            val tables = appTables(db)
            // טבלאות שנוספו לאורך-הדרך.
            listOf(
                "projects", "rooms", "walls", "accessories", "cabinets", "carpenters", "jobs",
                "level_points", "custom_symbols", "job_events", "location_samples", "work_metrics",
                "office_sync_queue", "photos", "videos",
            ).forEach { assertTrue("חסרה טבלה $it", it in tables) }

            // עמודות-הגל שאנו כתבנו (9→17).
            assertTrue("walls.heightMeasured (9→10)", "heightMeasured" in columns(db, "walls"))
            assertTrue("walls.wallProfileJson (11→12)", "wallProfileJson" in columns(db, "walls"))
            assertTrue("walls.soffitHeightMm (17→18)", "soffitHeightMm" in columns(db, "walls"))
            assertTrue("accessories.measured (14→15)", "measured" in columns(db, "accessories"))
            assertTrue("level_points.noAngle (15→16)", "noAngle" in columns(db, "level_points"))
            assertTrue("projects.closedAt (16→17)", "closedAt" in columns(db, "projects"))
            val photoCols = columns(db, "photos")
            assertTrue("photos.projectId (13→14)", "projectId" in photoCols)
            assertTrue("photos.phase (13→14)", "phase" in photoCols)
            assertTrue("rooms.closedAt (13→14)", "closedAt" in columns(db, "rooms"))
            val roomCols = columns(db, "rooms")
            assertTrue("rooms.entranceRelation (18→19)", "entranceRelation" in roomCols)
            assertTrue("rooms.entranceVantage (18→19)", "entranceVantage" in roomCols)
        } finally {
            helper.close()
        }
    }

    // ── 2. הסכימה-המהוגרת = סכימת-Room-הטריה בגרסה-18 (שקילות-מלאה) ──────────────

    @Test fun migratedSchema_matchesFreshV19() {
        val (helper, migrated) = openV1()
        val fresh = Room.inMemoryDatabaseBuilder(ctx, SolineDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        try {
            migrateAll(migrated)
            val freshDb = fresh.openHelper.writableDatabase // מכריח יצירת-סכימה בגרסה-19

            val migTables = appTables(migrated)
            val freshTables = appTables(freshDb)
            assertEquals("מערך-הטבלאות חייב להיות זהה", freshTables, migTables)

            // שקילות-עמודות פר-טבלה (עצמאי-מסדר/טיפוס — משווים שמות בלבד).
            for (t in freshTables) {
                assertEquals("עמודות שונות בטבלה $t", columns(freshDb, t), columns(migrated, t))
            }
        } finally {
            helper.close()
            fresh.close()
        }
    }

    // ── 3. FK-cascade (10→11 · 13→14): מחיקת-אב מסירה את כל-הצאצאים ─────────────

    @Test fun foreignKeyCascade_deletesChildrenWithParent() {
        val (helper, db) = openV1()
        try {
            migrateAll(db)
            db.execSQL("PRAGMA foreign_keys=ON")
            db.execSQL("INSERT INTO `projects` (`id`,`name`,`client`,`createdAt`) VALUES (1,'p','',0)")
            db.execSQL("INSERT INTO `rooms` (`id`,`projectId`,`name`) VALUES (10,1,'r')")
            db.execSQL("INSERT INTO `walls` (`id`,`roomId`,`idx`,`length`,`height`,`angle`) VALUES (100,10,0,4000,2700,90)")
            db.execSQL(
                "INSERT INTO `accessories` (`id`,`wallId`,`type`,`name`,`depth`,`fromLeft`,`width`,`fromBottom`,`height`) " +
                    "VALUES (1000,100,'DOOR','d',0,0,900,0,2100)"
            )
            db.execSQL("INSERT INTO `photos` (`id`,`projectId`,`roomId`,`wallId`,`seq`,`fileName`,`absPath`) VALUES (1,1,10,100,1,'f','p')")

            assertEquals(1, count(db, "rooms"))
            db.execSQL("DELETE FROM `projects` WHERE `id`=1")

            // מחיקת-הפרויקט מפילה-אוטומטית חדר→קיר→אביזר→תמונה (cascade רב-שכבתי).
            assertEquals(0, count(db, "rooms"))
            assertEquals(0, count(db, "walls"))
            assertEquals(0, count(db, "accessories"))
            assertEquals(0, count(db, "photos"))
        } finally {
            helper.close()
        }
    }
}
