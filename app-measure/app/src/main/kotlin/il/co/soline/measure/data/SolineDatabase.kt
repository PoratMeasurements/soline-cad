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
        CustomSymbolEntity::class, // סמלי-CAD מותאמים-אישית (#f-cad-symbol)
        JobEventEntity::class,   // גל-ניהול: seam למנוע-מדדים/GPS עתידי
        LocationSampleEntity::class, // מנוע-מדדים-נסתר: דגימות-GPS גולמיות (צד-משרד)
        WorkMetricEntity::class,     // מנוע-מדדים-נסתר: רול-אפ-יומי (צד-משרד)
        OfficeSyncEntity::class,     // מנוע-מדדים-נסתר: תור-שידור-למשרד
        PhotoEntity::class,          // פיצ'ר-תמונות: תמונות-שדה פר-חזית
        VideoEntity::class,          // רשימת-משימות-מדיה: סרטוני-שדה (גישה/הסבר)
    ],
    version = 21,
    // ייצוא-סכימה מופעל (המלצת-הביקורת #1 · עמידות): Room פולט JSON-סכימה לכל-גרסה
    // אל `app/schemas/` (מוגדר ב-build.gradle · room.schemaLocation), הנשמר בבקרת-גרסאות.
    // כך אי-התאמת-סכימה עתידית נתפסת בסקירת-diff/בדיקת-מיגרציה במקום לפגוע בשקט
    // ב-fallbackToDestructiveMigration (שגודר ל-DEBUG-בלבד בקבוצה-A).
    exportSchema = true,
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

        /**
         * מיגרציה 3→4: מוסיפה לקיר את שדות סגנון-ראש-הקיר (CVSM #f-wall-topstyle):
         * סגנון (ישר/משופע/גמלון/חצי-אי), גובה-רכס ומיקום-פסגה. ALTER TABLE בלבד —
         * שומרת את כל הקירות והמדידות הקיימות בלי מחיקה.
         */
        private val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `walls` ADD COLUMN `headStyle` TEXT NOT NULL DEFAULT 'STRAIGHT'")
                db.execSQL("ALTER TABLE `walls` ADD COLUMN `headRidgeMm` REAL NOT NULL DEFAULT 0.0")
                db.execSQL("ALTER TABLE `walls` ADD COLUMN `headPeakMm` REAL NOT NULL DEFAULT 0.0")
            }
        }

        /**
         * מיגרציה 4→5: מוסיפה את טבלת סמלי-ה-CAD המותאמים-אישית (CVSM #f-cad-symbol).
         * CREATE TABLE בלבד — אפס-מחיקת-נתונים לישויות הקיימות. ה-CREATE תואם בדיוק
         * לסכימה ש-Room מצפה לה עבור [CustomSymbolEntity].
         */
        private val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `custom_symbols` (" +
                        "`id` INTEGER NOT NULL, `key` TEXT NOT NULL, `he` TEXT NOT NULL, " +
                        "`shape` TEXT NOT NULL, `widthMm` REAL NOT NULL, `heightMm` REAL NOT NULL, " +
                        "`depthMm` REAL NOT NULL, `colorArgb` INTEGER NOT NULL, `createdAt` INTEGER NOT NULL, " +
                        "PRIMARY KEY(`id`))"
                )
            }
        }

        /**
         * מיגרציה 5→6: **צד-הניהול** (לו"ז + מדידות).
         *  · jobs: שדות-תזמון (scheduledAt/status/assignee/durationMin) — ALTER בלבד.
         *  · projects: lastExportedAt — למעקב "יוצא" במסך-ניהול-המדידות.
         *  · job_events: טבלת-seam ריקה למנוע-המדדים/GPS העתידי.
         * אפס-מחיקת-נתונים. ה-CREATE/ALTER תואמים בדיוק לסכימה ש-Room מצפה לה.
         */
        private val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `jobs` ADD COLUMN `scheduledAt` INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE `jobs` ADD COLUMN `status` TEXT NOT NULL DEFAULT 'scheduled'")
                db.execSQL("ALTER TABLE `jobs` ADD COLUMN `assignee` TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE `jobs` ADD COLUMN `durationMin` INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE `projects` ADD COLUMN `lastExportedAt` INTEGER NOT NULL DEFAULT 0")
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `job_events` (" +
                        "`id` INTEGER NOT NULL, `jobId` INTEGER NOT NULL, `type` TEXT NOT NULL, " +
                        "`ts` INTEGER NOT NULL, `valueNum` REAL NOT NULL, `note` TEXT NOT NULL, " +
                        "PRIMARY KEY(`id`))"
                )
            }
        }

        /**
         * מיגרציה 6→7: **מנוע-המדדים-התפעולי הנסתר** (GPS/מדדים · צד-המשרד).
         *  · location_samples: דגימות-מיקום גולמיות (מקור-האמת).
         *  · work_metrics: רול-אפ-יומי מחושב (נסיעה/מדידה/ק"מ/זמן-כולל).
         *  · office_sync_queue: תור-שידור-למשרד (seam ל-back-office עתידי).
         * CREATE TABLE בלבד — אפס-מחיקת-נתונים לישויות הקיימות. ה-CREATE תואמים
         * בדיוק לסכימה ש-Room מצפה לה עבור הישויות ב-OpsMetricsEntities.kt.
         */
        private val MIGRATION_6_7 = object : Migration(6, 7) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `location_samples` (" +
                        "`id` INTEGER NOT NULL, `dayEpoch` INTEGER NOT NULL, `ts` INTEGER NOT NULL, " +
                        "`lat` REAL NOT NULL, `lng` REAL NOT NULL, `accuracyM` REAL NOT NULL, " +
                        "`speedMps` REAL NOT NULL, `jobId` INTEGER NOT NULL, `moving` INTEGER NOT NULL, " +
                        "PRIMARY KEY(`id`))"
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_location_samples_dayEpoch` ON `location_samples` (`dayEpoch`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_location_samples_ts` ON `location_samples` (`ts`)")
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `work_metrics` (" +
                        "`dayEpoch` INTEGER NOT NULL, `firstActivityTs` INTEGER NOT NULL, " +
                        "`lastActivityTs` INTEGER NOT NULL, `totalWorkMin` REAL NOT NULL, " +
                        "`travelMin` REAL NOT NULL, `measureMin` REAL NOT NULL, `km` REAL NOT NULL, " +
                        "`sampleCount` INTEGER NOT NULL, `updatedAt` INTEGER NOT NULL, `syncedAt` INTEGER NOT NULL, " +
                        "PRIMARY KEY(`dayEpoch`))"
                )
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `office_sync_queue` (" +
                        "`id` INTEGER NOT NULL, `kind` TEXT NOT NULL, `refKey` TEXT NOT NULL, " +
                        "`payloadJson` TEXT NOT NULL, `createdAt` INTEGER NOT NULL, `sent` INTEGER NOT NULL, " +
                        "`sentAt` INTEGER NOT NULL, PRIMARY KEY(`id`))"
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_office_sync_queue_sent` ON `office_sync_queue` (`sent`)")
            }
        }

        /**
         * מיגרציה 7→8: **פתחים כפריטים-מדידים** (דלת/חלון/מיזוג-איוורור).
         * מוסיפה לטבלת accessories את שדות-הפתח הפרמטריים (OPENING_ELEMENT_SCHEMA.md):
         * openingKind + גיאומטריה (sill/wall/frame/reveal/leaf) + תצורה (openMode/hinge/
         * swing/leafCount/glazing) + fromCorner. ALTER TABLE בלבד — אפס-מחיקת-נתונים;
         * אביזרים קיימים נשארים לא-פתחים (openingKind='') ולכן ללא-שינוי.
         */
        private val MIGRATION_7_8 = object : Migration(7, 8) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `openingKind` TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `sillHeight` REAL NOT NULL DEFAULT -1.0")
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `wallThickness` REAL NOT NULL DEFAULT 0.0")
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `frameThickness` REAL NOT NULL DEFAULT 0.0")
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `frameReveal` REAL NOT NULL DEFAULT 0.0")
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `leafThickness` REAL NOT NULL DEFAULT 0.0")
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `openMode` TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `hingeSide` TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `swing` TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `leafCount` INTEGER NOT NULL DEFAULT 1")
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `glazing` TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `fromCorner` TEXT NOT NULL DEFAULT 'start'")
            }
        }

        /**
         * מיגרציה 8→9: **שדות-מודד ברמת-החדר** (נקבעים בתחילת-המדידה).
         * מוסיפה לטבלת rooms: כיוון-כניסה (bearing + wallIdx), מערך גבהי-תקרה
         * (heightSweepMm · CSV) והערות-שינויים-עתידיים (futureChanges). ALTER TABLE
         * בלבד — אפס-מחיקת-נתונים; חדרים קיימים מקבלים ברירות-מחדל (-1 / ריק) ולכן
         * מתפרשים כ"לא-הוגדר".
         */
        private val MIGRATION_8_9 = object : Migration(8, 9) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `rooms` ADD COLUMN `entranceBearingDeg` REAL NOT NULL DEFAULT -1.0")
                db.execSQL("ALTER TABLE `rooms` ADD COLUMN `entranceWallIdx` INTEGER NOT NULL DEFAULT -1")
                db.execSQL("ALTER TABLE `rooms` ADD COLUMN `heightSweepMm` TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE `rooms` ADD COLUMN `futureChanges` TEXT NOT NULL DEFAULT ''")
            }
        }

        /**
         * מיגרציה 9→10: **גובה-קיר מדוד vs ברירת-מחדל**. מוסיפה לטבלת walls את
         * `heightMeasured` — דגל המבדיל בין גובה שנמדד-בפועל (מהלך-גבהים / עריכה)
         * לבין ברירת-המחדל 2700 שלא-נגעו-בה. ALTER TABLE בלבד — אפס-מחיקת-נתונים;
         * קירות קיימים מקבלים 0 (=לא-מדוד) ולכן שער-האיכות יתריע עליהם.
         */
        private val MIGRATION_9_10 = object : Migration(9, 10) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `walls` ADD COLUMN `heightMeasured` INTEGER NOT NULL DEFAULT 0")
            }
        }

        /**
         * מיגרציה 10→11: **מפתחות-זרים + מחיקת-cascade** (A2/P2-6 בביקורת). מוסיפה
         * `@ForeignKey(onDelete=CASCADE)` לישויות-הילד (rooms→projects, walls→rooms,
         * accessories→walls, cabinets→rooms+walls, level_points→rooms) + אינדקסים
         * על עמודות-ה-FK — כך שמחיקת אב מסירה אוטומטית את ילדיו ולא נוצרים יתומים.
         *
         * SQLite אינו תומך בהוספת-FK ב-ALTER, לכן זו **בנייה-מחדש בטוחה** (rebuild):
         * לכל טבלה — יוצרים טבלה-חדשה עם ה-FK, מעתיקים רק שורות עם-אב-קיים (מנקה
         * יתומים שכבר קיימים מ-removeLastWall הישן), מוחקים את הישנה ומשנים-שם.
         * הסדר הוא אבות-לפני-ילדים; `defer_foreign_keys` מבטיח בדיקה רק ב-commit.
         * שומרת את כל מדידות-הבדיקה — אפס-מחיקת-נתונים-תקינים.
         */
        private val MIGRATION_10_11 = object : Migration(10, 11) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("PRAGMA defer_foreign_keys = TRUE")

                // ── rooms → projects ──────────────────────────────────────────
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `rooms_new` (" +
                        "`id` INTEGER NOT NULL, `projectId` INTEGER NOT NULL, `name` TEXT NOT NULL, " +
                        "`entranceBearingDeg` REAL NOT NULL DEFAULT -1.0, `entranceWallIdx` INTEGER NOT NULL DEFAULT -1, " +
                        "`heightSweepMm` TEXT NOT NULL DEFAULT '', `futureChanges` TEXT NOT NULL DEFAULT '', " +
                        "PRIMARY KEY(`id`), " +
                        "FOREIGN KEY(`projectId`) REFERENCES `projects`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE)"
                )
                db.execSQL(
                    "INSERT INTO `rooms_new` (`id`,`projectId`,`name`,`entranceBearingDeg`,`entranceWallIdx`,`heightSweepMm`,`futureChanges`) " +
                        "SELECT `id`,`projectId`,`name`,`entranceBearingDeg`,`entranceWallIdx`,`heightSweepMm`,`futureChanges` FROM `rooms` " +
                        "WHERE `projectId` IN (SELECT `id` FROM `projects`)"
                )
                db.execSQL("DROP TABLE `rooms`")
                db.execSQL("ALTER TABLE `rooms_new` RENAME TO `rooms`")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_rooms_projectId` ON `rooms` (`projectId`)")

                // ── walls → rooms ─────────────────────────────────────────────
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `walls_new` (" +
                        "`id` INTEGER NOT NULL, `roomId` INTEGER NOT NULL, `idx` INTEGER NOT NULL, " +
                        "`length` REAL NOT NULL, `height` REAL NOT NULL, `angle` REAL NOT NULL DEFAULT 90.0, " +
                        "`framePointsJson` TEXT NOT NULL DEFAULT '', `headStyle` TEXT NOT NULL DEFAULT 'STRAIGHT', " +
                        "`headRidgeMm` REAL NOT NULL DEFAULT 0.0, `headPeakMm` REAL NOT NULL DEFAULT 0.0, " +
                        "`heightMeasured` INTEGER NOT NULL DEFAULT 0, " +
                        "PRIMARY KEY(`id`), " +
                        "FOREIGN KEY(`roomId`) REFERENCES `rooms`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE)"
                )
                db.execSQL(
                    "INSERT INTO `walls_new` (`id`,`roomId`,`idx`,`length`,`height`,`angle`,`framePointsJson`,`headStyle`,`headRidgeMm`,`headPeakMm`,`heightMeasured`) " +
                        "SELECT `id`,`roomId`,`idx`,`length`,`height`,`angle`,`framePointsJson`,`headStyle`,`headRidgeMm`,`headPeakMm`,`heightMeasured` FROM `walls` " +
                        "WHERE `roomId` IN (SELECT `id` FROM `rooms`)"
                )
                db.execSQL("DROP TABLE `walls`")
                db.execSQL("ALTER TABLE `walls_new` RENAME TO `walls`")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_walls_roomId` ON `walls` (`roomId`)")

                // ── accessories → walls ───────────────────────────────────────
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `accessories_new` (" +
                        "`id` INTEGER NOT NULL, `wallId` INTEGER NOT NULL, `type` TEXT NOT NULL, `name` TEXT NOT NULL, " +
                        "`depth` REAL NOT NULL, `fromLeft` REAL NOT NULL, `width` REAL NOT NULL, `fromBottom` REAL NOT NULL, " +
                        "`height` REAL NOT NULL, `openingKind` TEXT NOT NULL DEFAULT '', `sillHeight` REAL NOT NULL DEFAULT -1.0, " +
                        "`wallThickness` REAL NOT NULL DEFAULT 0.0, `frameThickness` REAL NOT NULL DEFAULT 0.0, " +
                        "`frameReveal` REAL NOT NULL DEFAULT 0.0, `leafThickness` REAL NOT NULL DEFAULT 0.0, " +
                        "`openMode` TEXT NOT NULL DEFAULT '', `hingeSide` TEXT NOT NULL DEFAULT '', `swing` TEXT NOT NULL DEFAULT '', " +
                        "`leafCount` INTEGER NOT NULL DEFAULT 1, `glazing` TEXT NOT NULL DEFAULT '', `fromCorner` TEXT NOT NULL DEFAULT 'start', " +
                        "PRIMARY KEY(`id`), " +
                        "FOREIGN KEY(`wallId`) REFERENCES `walls`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE)"
                )
                db.execSQL(
                    "INSERT INTO `accessories_new` (`id`,`wallId`,`type`,`name`,`depth`,`fromLeft`,`width`,`fromBottom`,`height`,`openingKind`,`sillHeight`,`wallThickness`,`frameThickness`,`frameReveal`,`leafThickness`,`openMode`,`hingeSide`,`swing`,`leafCount`,`glazing`,`fromCorner`) " +
                        "SELECT `id`,`wallId`,`type`,`name`,`depth`,`fromLeft`,`width`,`fromBottom`,`height`,`openingKind`,`sillHeight`,`wallThickness`,`frameThickness`,`frameReveal`,`leafThickness`,`openMode`,`hingeSide`,`swing`,`leafCount`,`glazing`,`fromCorner` FROM `accessories` " +
                        "WHERE `wallId` IN (SELECT `id` FROM `walls`)"
                )
                db.execSQL("DROP TABLE `accessories`")
                db.execSQL("ALTER TABLE `accessories_new` RENAME TO `accessories`")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_accessories_wallId` ON `accessories` (`wallId`)")

                // ── cabinets → rooms + walls ──────────────────────────────────
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `cabinets_new` (" +
                        "`id` INTEGER NOT NULL, `roomId` INTEGER NOT NULL, `wallId` INTEGER NOT NULL, " +
                        "`kind` TEXT NOT NULL, `name` TEXT NOT NULL, `fromLeft` REAL NOT NULL, `width` REAL NOT NULL, " +
                        "`depth` REAL NOT NULL, `heightFrom` REAL NOT NULL, `heightTo` REAL NOT NULL, `doorType` TEXT NOT NULL DEFAULT '', " +
                        "PRIMARY KEY(`id`), " +
                        "FOREIGN KEY(`roomId`) REFERENCES `rooms`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE, " +
                        "FOREIGN KEY(`wallId`) REFERENCES `walls`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE)"
                )
                db.execSQL(
                    "INSERT INTO `cabinets_new` (`id`,`roomId`,`wallId`,`kind`,`name`,`fromLeft`,`width`,`depth`,`heightFrom`,`heightTo`,`doorType`) " +
                        "SELECT `id`,`roomId`,`wallId`,`kind`,`name`,`fromLeft`,`width`,`depth`,`heightFrom`,`heightTo`,`doorType` FROM `cabinets` " +
                        "WHERE `roomId` IN (SELECT `id` FROM `rooms`) AND `wallId` IN (SELECT `id` FROM `walls`)"
                )
                db.execSQL("DROP TABLE `cabinets`")
                db.execSQL("ALTER TABLE `cabinets_new` RENAME TO `cabinets`")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_cabinets_roomId` ON `cabinets` (`roomId`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_cabinets_wallId` ON `cabinets` (`wallId`)")

                // ── level_points → rooms ──────────────────────────────────────
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `level_points_new` (" +
                        "`id` INTEGER NOT NULL, `roomId` INTEGER NOT NULL, `surface` TEXT NOT NULL, `idx` INTEGER NOT NULL, " +
                        "`x` REAL NOT NULL, `y` REAL NOT NULL, `rawMm` REAL NOT NULL, `deviationMm` REAL NOT NULL, `isZero` INTEGER NOT NULL, " +
                        "PRIMARY KEY(`id`), " +
                        "FOREIGN KEY(`roomId`) REFERENCES `rooms`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE)"
                )
                db.execSQL(
                    "INSERT INTO `level_points_new` (`id`,`roomId`,`surface`,`idx`,`x`,`y`,`rawMm`,`deviationMm`,`isZero`) " +
                        "SELECT `id`,`roomId`,`surface`,`idx`,`x`,`y`,`rawMm`,`deviationMm`,`isZero` FROM `level_points` " +
                        "WHERE `roomId` IN (SELECT `id` FROM `rooms`)"
                )
                db.execSQL("DROP TABLE `level_points`")
                db.execSQL("ALTER TABLE `level_points_new` RENAME TO `level_points`")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_level_points_roomId` ON `level_points` (`roomId`)")
            }
        }

        /**
         * מיגרציה 11→12: **פרופיל-קיר מורחב** (שתי שיטות-המדידה מבוססות-הנקודות).
         * מוסיפה לטבלת walls את `wallProfileJson` — נושא מטא-נתוני-מסגור (פינת-אפס/כיוון/
         * flip) ואת נקודות-מבט-העל של שיטת-הבטן (belly). ALTER TABLE בלבד — אפס-מחיקת-
         * נתונים; קירות קיימים מקבלים '' ולכן מתפרשים כברירות-מחדל (LEFT_BOTTOM/CCW, ללא-בטן).
         */
        private val MIGRATION_11_12 = object : Migration(11, 12) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `walls` ADD COLUMN `wallProfileJson` TEXT NOT NULL DEFAULT ''")
            }
        }

        /**
         * מיגרציה 12→13: **פיצ'ר-תמונות** (צילום-שדה פר-חזית). מוסיפה את טבלת
         * `photos` — כל תמונה משויכת לחדר (FK-cascade) ואופציונלית לקיר (FK-cascade,
         * `wallId` nullable ⇒ תמונת-חדר), עם sequence-פר-חזית, scope/kind, שם-קובץ
         * מוסכם, נתיב-מוחלט, מטא-פיקסלים וגודל. CREATE TABLE + אינדקסים בלבד — אפס-
         * מחיקת-נתונים לישויות הקיימות (בדיוק כתבנית של [MIGRATION_10_11] לישויות-הילד).
         */
        private val MIGRATION_12_13 = object : Migration(12, 13) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `photos` (" +
                        "`id` INTEGER NOT NULL, `roomId` INTEGER NOT NULL, `wallId` INTEGER, " +
                        "`seq` INTEGER NOT NULL, `scope` TEXT NOT NULL DEFAULT 'wall', " +
                        "`kind` TEXT NOT NULL DEFAULT 'context', `elementId` INTEGER, " +
                        "`fileName` TEXT NOT NULL, `absPath` TEXT NOT NULL, " +
                        "`caption` TEXT NOT NULL DEFAULT '', `takenAt` TEXT NOT NULL DEFAULT '', " +
                        "`w` INTEGER NOT NULL DEFAULT 0, `h` INTEGER NOT NULL DEFAULT 0, " +
                        "`bytes` INTEGER NOT NULL DEFAULT 0, " +
                        "PRIMARY KEY(`id`), " +
                        "FOREIGN KEY(`roomId`) REFERENCES `rooms`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE, " +
                        "FOREIGN KEY(`wallId`) REFERENCES `walls`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE)"
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_photos_roomId` ON `photos` (`roomId`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_photos_wallId` ON `photos` (`wallId`)")
            }
        }

        /**
         * מיגרציה 13→14: **רשימת-משימות-מדיה + שער-סגירת-חדר/פרויקט** (PHOTO_FEATURE_DESIGN §5).
         *  · rooms: `mediaSkips` (JSON סיבות-דילוג פר-קטגוריה) + `closedAt` (חותמת-סגירה,
         *    0=פתוח) — ALTER בלבד, חדרים קיימים מקבלים ''/0 (=פתוח, ללא-דילוגים).
         *  · photos: **בנייה-מחדש** — `roomId` הופך nullable (מדיה-ברמת-פרויקט: roomId=null),
         *    ומתווספים `projectId` (מולא-אחורה מהחדר) ו-`phase` (opening|closing). מעתיקים רק
         *    שורות עם-חדר-קיים (מנקה-יתומים). ה-FK/אינדקסים על roomId+wallId נשמרים.
         *  · videos: טבלה-חדשה מקבילה-ל-`photos` (סרטוני-שדה: גישה/הסבר) עם projectId+phase,
         *    `roomId` nullable, FK-cascade כפול (חדר+קיר) + אינדקסים — CREATE בלבד.
         * אדיטיבי ולא-הרסני: ‎.sol‎/DB קיימים ממשיכים לעבוד; מסלול-התמונות ללא-שינוי-התנהגותי.
         */
        private val MIGRATION_13_14 = object : Migration(13, 14) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("PRAGMA defer_foreign_keys = TRUE")
                // ── rooms: שדות שער-הסגירה ─────────────────────────────────────
                db.execSQL("ALTER TABLE `rooms` ADD COLUMN `mediaSkips` TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE `rooms` ADD COLUMN `closedAt` INTEGER NOT NULL DEFAULT 0")

                // ── photos: בנייה-מחדש (roomId nullable + projectId + phase) ────
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `photos_new` (" +
                        "`id` INTEGER NOT NULL, `projectId` INTEGER NOT NULL DEFAULT 0, `roomId` INTEGER, `wallId` INTEGER, " +
                        "`seq` INTEGER NOT NULL, `scope` TEXT NOT NULL DEFAULT 'wall', `phase` TEXT NOT NULL DEFAULT '', " +
                        "`kind` TEXT NOT NULL DEFAULT 'context', `elementId` INTEGER, " +
                        "`fileName` TEXT NOT NULL, `absPath` TEXT NOT NULL, " +
                        "`caption` TEXT NOT NULL DEFAULT '', `takenAt` TEXT NOT NULL DEFAULT '', " +
                        "`w` INTEGER NOT NULL DEFAULT 0, `h` INTEGER NOT NULL DEFAULT 0, " +
                        "`bytes` INTEGER NOT NULL DEFAULT 0, " +
                        "PRIMARY KEY(`id`), " +
                        "FOREIGN KEY(`roomId`) REFERENCES `rooms`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE, " +
                        "FOREIGN KEY(`wallId`) REFERENCES `walls`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE)"
                )
                db.execSQL(
                    "INSERT INTO `photos_new` (`id`,`projectId`,`roomId`,`wallId`,`seq`,`scope`,`phase`,`kind`,`elementId`,`fileName`,`absPath`,`caption`,`takenAt`,`w`,`h`,`bytes`) " +
                        "SELECT `id`, COALESCE((SELECT `projectId` FROM `rooms` WHERE `rooms`.`id` = `photos`.`roomId`), 0), " +
                        "`roomId`,`wallId`,`seq`,`scope`,'',`kind`,`elementId`,`fileName`,`absPath`,`caption`,`takenAt`,`w`,`h`,`bytes` FROM `photos` " +
                        "WHERE `roomId` IN (SELECT `id` FROM `rooms`)"
                )
                db.execSQL("DROP TABLE `photos`")
                db.execSQL("ALTER TABLE `photos_new` RENAME TO `photos`")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_photos_roomId` ON `photos` (`roomId`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_photos_wallId` ON `photos` (`wallId`)")

                // ── videos: טבלה-חדשה ─────────────────────────────────────────
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `videos` (" +
                        "`id` INTEGER NOT NULL, `projectId` INTEGER NOT NULL DEFAULT 0, `roomId` INTEGER, `wallId` INTEGER, " +
                        "`seq` INTEGER NOT NULL, `scope` TEXT NOT NULL DEFAULT 'room', `phase` TEXT NOT NULL DEFAULT '', " +
                        "`kind` TEXT NOT NULL DEFAULT 'access', `elementId` INTEGER, " +
                        "`fileName` TEXT NOT NULL, `absPath` TEXT NOT NULL, " +
                        "`caption` TEXT NOT NULL DEFAULT '', `takenAt` TEXT NOT NULL DEFAULT '', " +
                        "`durationSec` INTEGER NOT NULL DEFAULT 0, `bytes` INTEGER NOT NULL DEFAULT 0, " +
                        "PRIMARY KEY(`id`), " +
                        "FOREIGN KEY(`roomId`) REFERENCES `rooms`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE, " +
                        "FOREIGN KEY(`wallId`) REFERENCES `walls`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE)"
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_videos_roomId` ON `videos` (`roomId`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_videos_wallId` ON `videos` (`wallId`)")
            }
        }

        /**
         * מיגרציה 14→15: **אביזר נמדד vs ברירת-מחדל-קטלוג**. מוסיפה לטבלת accessories
         * את `measured` — דגל המבדיל בין מידה שנמדדה-בפועל (עריכת-שדה / הזרקת-לייזר)
         * לבין מידת-היצרן שממולאת-מראש בטופס ולא-נגעו-בה (במקביל ל-`heightMeasured`
         * לקירות · מיגרציה 9→10). ALTER TABLE בלבד — אפס-מחיקת-נתונים; אביזרים
         * קיימים מקבלים 0 (=לא-מדוד), שהיא הבחירה הבטוחה/כנה עבורם.
         */
        private val MIGRATION_14_15 = object : Migration(14, 15) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `measured` INTEGER NOT NULL DEFAULT 0")
            }
        }

        /**
         * 15→16 — סקר-מפלסים: דגל-קבוע `noAngle` על נקודת-מפלס (LevelPointEntity).
         * מסמן קריאה שנקלטה ללא זווית-אנכית (Z בקנה-מידה שגוי), במקום אזכור-זמני
         * (`remember`) שאבד בסיבוב/מות-תהליך. ALTER TABLE בלבד — אפס-מחיקת-נתונים;
         * נקודות קיימות מקבלות 0 (=נקלטו עם-זווית, ההנחה-הבטוחה).
         */
        private val MIGRATION_15_16 = object : Migration(15, 16) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `level_points` ADD COLUMN `noAngle` INTEGER NOT NULL DEFAULT 0")
            }
        }

        /**
         * מיגרציה 16→17: **שער-סגירת-פרויקט** — חותמת-סגירה ברמת-הפרויקט (מקביל
         * ל-`rooms.closedAt` · מיגרציה 13→14). מוסיפה לטבלת projects את `closedAt`
         * (nullable · null=פתוח). ALTER TABLE בלבד — אפס-מחיקת-נתונים; פרויקטים
         * קיימים מקבלים NULL ולכן מתפרשים כ"טרם-נסגרו". ‎.sol‎/DB קיימים ממשיכים לעבוד.
         */
        private val MIGRATION_16_17 = object : Migration(16, 17) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `projects` ADD COLUMN `closedAt` INTEGER")
            }
        }

        /**
         * מיגרציה 17→18: **גובה-סופית פר-קיר** (קו-סימון / הנמכת-תקרה). מוסיפה לטבלת
         * walls את `soffitHeightMm` (nullable · null=לא-סומן) — הדאטום שהנגר צריך
         * לתכנון ארונות-עליונים, שנלכד במסך-החזית ולא-נשמר עד-כה. ALTER TABLE בלבד —
         * אפס-מחיקת-נתונים; קירות קיימים מקבלים NULL ולכן מתפרשים כ"ללא-קו-סימון".
         */
        private val MIGRATION_17_18 = object : Migration(17, 18) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `walls` ADD COLUMN `soffitHeightMm` REAL")
            }
        }

        /**
         * מיגרציה 18→19: **תיאור-כניסה מילולי** — משלים את חוגת-כיוון-החץ (redesign
         * "כיוון כניסה"). מוסיפה לטבלת rooms שני שדות-טקסט-חופשי: `entranceRelation`
         * (היכן הכניסה ביחס לחזית-הראשית) ו-`entranceVantage` (מהיכן אתה מסתכל).
         * ALTER TABLE בלבד — אפס-מחיקת-נתונים; חדרים קיימים מקבלים '' (=לא-הוזן)
         * ושומרים על `entranceBearingDeg`/`entranceWallIdx`, כך שהדוח/הייצוא ממשיכים
         * לעבוד ללא-שינוי. תוספתי ותואם-לאחור.
         */
        private val MIGRATION_18_19 = object : Migration(18, 19) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `rooms` ADD COLUMN `entranceRelation` TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE `rooms` ADD COLUMN `entranceVantage` TEXT NOT NULL DEFAULT ''")
            }
        }

        /**
         * מיגרציה 19→20: **הערת-מודד פר-אלמנט** (תזרים-השדה §10). מוסיפה לטבלת
         * accessories את `notes` (TEXT NOT NULL DEFAULT '') — טקסט-חופשי שהמודד מזין
         * לאלמנט ספציפי (חריגה/דרישה/אזהרה לנגר). ALTER TABLE בלבד — אפס-מחיקת-נתונים;
         * אלמנטים קיימים מקבלים '' (=ללא-הערה). תוספתי ותואם-לאחור.
         */
        private val MIGRATION_19_20 = object : Migration(19, 20) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `accessories` ADD COLUMN `notes` TEXT NOT NULL DEFAULT ''")
            }
        }

        /**
         * מיגרציה 20→21: **קישור פרויקט↔אינטייק** (בקשת-מודד 195918). מוסיפה ל-projects
         * את `jobId` (קישור ל-JobEntity · 0=ללא) לעריכת כל-פרטי-הפרויקט. ALTER בלבד — אפס-מחיקה.
         */
        private val MIGRATION_20_21 = object : Migration(20, 21) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `projects` ADD COLUMN `jobId` INTEGER NOT NULL DEFAULT 0")
            }
        }

        /**
         * כל-המיגרציות בסדר-רץ (1→20). מקור-אמת יחיד: גם [get] רושם אותן וגם בדיקת-
         * המיגרציה (MigrationTest) מריצה אותן כשרשרת. internal בכוונה — נגיש-לבדיקה
         * באותו-מודול בלי לחשוף את פרטי-המיגרציה החוצה. תוספתי-בלבד (אין-שינוי-התנהגות).
         */
        internal val ALL_MIGRATIONS: Array<Migration> = arrayOf(
            MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6,
            MIGRATION_6_7, MIGRATION_7_8, MIGRATION_8_9, MIGRATION_9_10, MIGRATION_10_11,
            MIGRATION_11_12, MIGRATION_12_13, MIGRATION_13_14, MIGRATION_14_15,
            MIGRATION_15_16, MIGRATION_16_17, MIGRATION_17_18, MIGRATION_18_19,
            MIGRATION_19_20, MIGRATION_20_21,
        )

        @Volatile private var INSTANCE: SolineDatabase? = null
        fun get(context: Context): SolineDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    SolineDatabase::class.java,
                    "soline.db",
                )
                    .addMigrations(*ALL_MIGRATIONS)
                    // רשת-ביטחון **בדיבאג-בלבד**: בפיתוח, אי-התאמת-סכימה בונה-מחדש את ה-DB
                    // כדי לא-לחסום איטרציה. ב-release **מסירים** זאת בכוונה (קבוצה-A בביקורת):
                    // מחיקת-כל-נתוני-השדה בשקט חמורה מקריסה-רועשת — עדיף שהמודד ידע ולא-יאבד.
                    .apply { if (il.co.soline.measure.BuildConfig.DEBUG) fallbackToDestructiveMigration() }
                    .build().also { INSTANCE = it }
            }
    }
}
