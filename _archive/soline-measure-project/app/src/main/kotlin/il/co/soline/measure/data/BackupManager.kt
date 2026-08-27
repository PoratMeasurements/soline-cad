package il.co.soline.measure.data

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileInputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * BackupManager — גיבוי-הכל של Soline Measure אל קובץ ZIP יחיד לשיתוף (Google Drive וכו').
 *
 * המטרה: אף מידע חשוב לא יישאר רק על מכשיר שעלול ללכת לאיבוד. הגיבוי אורז יחד:
 *   • את בסיס-הנתונים של Room ("soline.db" ואת קבצי ה-`-wal` / `-shm` הנלווים אם קיימים).
 *   • את כל קבצי ה-.sol שיוצאו תחת filesDir/exports.
 *
 * הקובץ נכתב אל תיקיית-משנה ממופה ב-FileProvider (`filesDir/exports/backups`) — כי מנשא-הקבצים
 * (authority "il.co.soline.measure.fileprovider") ממפה רק את `exports/` (ראה res/xml/file_paths.xml).
 * לכן cacheDir איננו נגיש לשיתוף, ותיקיית ה-exports היא הבחירה התקינה היחידה.
 *
 * שימוש טיפוסי (מתוך רקע IO ואז שיתוף ב-Main):
 *   val zip = BackupManager.createBackup(context)      // IO
 *   BackupManager.shareBackup(context, zip)            // Main — פותח את גיליון-השיתוף
 */
object BackupManager {

    private const val DB_NAME = "soline.db"
    private const val AUTHORITY = "il.co.soline.measure.fileprovider"

    /** שם קובץ הגיבוי לפי חותמת-זמן, למשל soline-backup-20260818-1432.zip */
    private fun backupFileName(): String {
        val stamp = SimpleDateFormat("yyyyMMdd-HHmm", Locale.US).format(Date())
        return "soline-backup-$stamp.zip"
    }

    /** תיקיית-היעד הממופה ב-FileProvider שבה נשמרים קבצי הגיבוי. */
    private fun backupDir(context: Context): File =
        File(File(context.filesDir, "exports"), "backups").apply { mkdirs() }

    /**
     * בונה קובץ ZIP המכיל את בסיס-הנתונים ואת כל קבצי ה-.sol, ומחזיר את ה-[File].
     *
     * מבנה ה-ZIP:
     *   db/soline.db          (+ soline.db-wal, soline.db-shm אם קיימים)
     *   exports/<name>.sol    (כל קובץ .sol תחת filesDir/exports, למעט תיקיית ה-backups)
     *
     * @throws java.io.IOException אם הכתיבה נכשלה.
     */
    fun createBackup(context: Context): File {
        val outFile = File(backupDir(context), backupFileName())

        ZipOutputStream(outFile.outputStream().buffered()).use { zip ->
            // --- בסיס-הנתונים של Room (העתקת שלושת הקבצים — מספיק לגיבוי) ---
            val dbFile = context.getDatabasePath(DB_NAME)
            for (suffix in listOf("", "-wal", "-shm")) {
                val f = File(dbFile.parentFile, dbFile.name + suffix)
                if (f.exists() && f.isFile) {
                    addFileToZip(zip, f, "db/" + f.name)
                }
            }

            // --- כל קבצי ה-.sol שיוצאו ---
            val exportsDir = File(context.filesDir, "exports")
            if (exportsDir.exists() && exportsDir.isDirectory) {
                exportsDir.listFiles()
                    ?.filter { it.isFile && it.name.endsWith(".sol", ignoreCase = true) }
                    ?.sortedBy { it.name }
                    ?.forEach { sol -> addFileToZip(zip, sol, "exports/" + sol.name) }
            }
        }

        return outFile
    }

    /** מוסיף קובץ בודד אל ה-ZIP תחת [entryName]. */
    private fun addFileToZip(zip: ZipOutputStream, file: File, entryName: String) {
        zip.putNextEntry(ZipEntry(entryName))
        FileInputStream(file).use { input -> input.copyTo(zip) }
        zip.closeEntry()
    }

    /**
     * פותח את גיליון-השיתוף של אנדרואיד עבור קובץ הגיבוי, כדי לשמור אותו ל-Google Drive.
     * חייב לרוץ ב-thread הראשי. משתמש באותו מנגנון שיתוף כמו ייצוא ה-.sol.
     */
    fun shareBackup(context: Context, backup: File) {
        val uri = FileProvider.getUriForFile(context, AUTHORITY, backup)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "application/zip"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(send, "גיבוי Soline — שמור ל-Drive")
            .apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        context.startActivity(chooser)
    }
}
