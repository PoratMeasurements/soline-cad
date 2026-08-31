package il.co.soline.measure.data

import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import il.co.soline.measure.BuildConfig
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/* =========================================================================
 * סנכרון בדיקות-חוזרות דו-כיווני דרך תיקיית-ה-Drive (אותה SAF-tree של הבאגים).
 * -------------------------------------------------------------------------
 * מיכאל → Drive:  קובץ  retest_queue.json  (רשימת-באגים שתוקנו וממתינים לאימות המודד).
 * מודד  → Drive:  קובץ  retest_response_<id>_<stamp>.json  (טוב/לשפר/לשדרג + הערה).
 * מיכאל קורא את התגובות ומעדכן את דו"ח-המודד. אין תלות בחשבון — ה-Drive הוא הצינור.
 * משתמש ב-org.json המובנה (בלי תלות-חדשה) וב-DocumentsContract (כמו העלאת-הבאגים).
 * ========================================================================= */

/** פריט-בדיקה-חוזרת שהמודד מתבקש לאמת. */
data class RetestItem(
    val id: String,
    val title: String,
    val screen: String,
    val fixed: String,
    val version: String,
)

/** קודי-verdict של בדיקה-חוזרת (נכתבים לתגובה). */
object RetestVerdict {
    const val OK = "ok"          // תקין — התיקון עבד → נסגר
    const val FAIL = "fail"      // לא-תקין — עדיין תקול → נפתח-מחדש
    const val IMPROVE = "improve" // לשפר — עובד אך דורש שיפור
    const val UPGRADE = "upgrade" // לשדרג — רעיון-שדרוג מעבר-לתיקון
}

/** סטטוס-באג שמיכאל מפרסם ל-Drive (bug_status.json) → מוצג למודד ב"הבאגים שלי". */
data class BugStatus(val id: String, val status: String, val note: String, val version: String, val serial: Int = 0)

/** קודי-סטטוס-באג. */
object BugStage {
    const val NEW = "new"           // התקבל, ממתין לטריאז'/החלטה
    const val WORKING = "working"   // בטיפול (אושר לתיקון)
    const val FIXED = "fixed"       // תוקן ושוחרר — לאימות המודד
    const val CLOSED = "closed"     // אומת ונסגר
    const val REOPENED = "reopened" // נבדק ועדיין תקול — חזר לטיפול
}

object RetestSync {
    private const val QUEUE_NAME = "retest_queue.json"

    /** קורא את תור-הבדיקות מתיקיית-ה-Drive. ריק אם אין תיקייה/קובץ/שגיאה. רץ ב-IO. */
    fun loadQueue(context: Context): List<RetestItem> {
        val treeStr = Prefs.bugUploadTreeUri
        if (treeStr.isBlank()) return emptyList()
        return try {
            val tree = Uri.parse(treeStr)
            val docId = findChildDocId(context, tree, QUEUE_NAME) ?: return emptyList()
            val fileUri = DocumentsContract.buildDocumentUriUsingTree(tree, docId)
            val text = context.contentResolver.openInputStream(fileUri)
                ?.use { it.readBytes().toString(Charsets.UTF_8) } ?: return emptyList()
            val arr = JSONObject(text).optJSONArray("items") ?: return emptyList()
            val done = respondedSet(context) // סינון מיידי-וקבוע של פריטים שכבר-נענו
            (0 until arr.length()).mapNotNull { i ->
                val o = arr.optJSONObject(i) ?: return@mapNotNull null
                val id = o.optString("id")
                if (id.isBlank()) return@mapNotNull null
                val item = RetestItem(
                    id = id,
                    title = o.optString("title"),
                    screen = o.optString("screen"),
                    fixed = o.optString("fixed"),
                    version = o.optString("version"),
                )
                if (done.contains(respondedKey(item))) null else item
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /** קורא את מפת-סטטוסי-הבאגים (bug_status.json) מ-Drive. ריק אם אין. רץ ב-IO. */
    fun loadBugStatuses(context: Context): Map<String, BugStatus> {
        val treeStr = Prefs.bugUploadTreeUri
        if (treeStr.isBlank()) return emptyMap()
        return try {
            val tree = Uri.parse(treeStr)
            val docId = findChildDocId(context, tree, "bug_status.json") ?: return emptyMap()
            val fileUri = DocumentsContract.buildDocumentUriUsingTree(tree, docId)
            val text = context.contentResolver.openInputStream(fileUri)
                ?.use { it.readBytes().toString(Charsets.UTF_8) } ?: return emptyMap()
            val obj = JSONObject(text).optJSONObject("statuses") ?: return emptyMap()
            val out = HashMap<String, BugStatus>()
            val keys = obj.keys()
            while (keys.hasNext()) {
                val k = keys.next()
                val o = obj.optJSONObject(k) ?: continue
                out[k] = BugStatus(
                    id = k,
                    status = o.optString("status", BugStage.NEW),
                    note = o.optString("note", ""),
                    version = o.optString("version", ""),
                    serial = o.optInt("serial", 0),
                )
            }
            out
        } catch (_: Exception) {
            emptyMap()
        }
    }

    /** כותב תגובת-בדיקה חזרה ל-Drive. מחזיר true בהצלחה. רץ ב-IO. */
    fun writeResponse(context: Context, item: RetestItem, verdict: String, note: String): Boolean {
        val treeStr = Prefs.bugUploadTreeUri
        if (treeStr.isBlank()) return false
        return try {
            val tree = Uri.parse(treeStr)
            val dirUri = DocumentsContract.buildDocumentUriUsingTree(
                tree, DocumentsContract.getTreeDocumentId(tree),
            )
            val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val safeId = item.id.replace(Regex("[^A-Za-z0-9_-]"), "_")
            val name = "retest_response_${safeId}_$stamp.json"
            val json = JSONObject()
                .put("id", item.id)
                .put("title", item.title)
                .put("verdict", verdict)
                .put("note", note)
                .put("surveyor", true)
                .put("at", SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(Date()))
                .put("appVersion", BuildConfig.VERSION_NAME)
                .put("device", "${Build.MANUFACTURER} ${Build.MODEL}")
                .toString()
            val target = DocumentsContract.createDocument(
                context.contentResolver, dirUri, "application/json", name,
            ) ?: return false
            context.contentResolver.openOutputStream(target)
                ?.use { it.write(json.toByteArray(Charsets.UTF_8)) }
            markResponded(context, item) // איפוס-מיידי-וקבוע: לא-יחזור בפתיחה-מחדש
            // בקשת-מודד 212824: verdict "תקין" → ארכוב-מיידי ב"הבאגים שלי" מפעולת-המודד עצמה,
            // בלי להמתין לעדכון-סטטוס מהשרת (bug_status.json). item.id = baseName של הבאג.
            if (verdict == RetestVerdict.OK) markArchivedLocally(context, item.id)
            true
        } catch (_: Exception) {
            false
        }
    }

    /** מוסיף באג לרשימת-הארכיון המקומית של "הבאגים שלי" (SharedPreferences "soline_mybugs"). */
    private fun markArchivedLocally(context: Context, bugId: String) {
        val sp = context.getSharedPreferences("soline_mybugs", Context.MODE_PRIVATE)
        val cur = HashSet(sp.getStringSet("archived", emptySet()) ?: emptySet())
        cur.add(bugId)
        sp.edit().putStringSet("archived", cur).apply()
    }

    // ── רשומת "נענו" קבועה (SharedPreferences) — מפתח id|version כדי שבדיקה-חוזרת אחרי-תיקון תחזור ──
    private fun respondedKey(item: RetestItem) = item.id + "|" + item.version

    private fun respondedSet(context: Context): Set<String> {
        val sp = context.getSharedPreferences("soline_retest", Context.MODE_PRIVATE)
        return sp.getStringSet("responded", emptySet()) ?: emptySet()
    }

    private fun markResponded(context: Context, item: RetestItem) {
        val sp = context.getSharedPreferences("soline_retest", Context.MODE_PRIVATE)
        val cur = HashSet(sp.getStringSet("responded", emptySet()) ?: emptySet())
        cur.add(respondedKey(item))
        sp.edit().putStringSet("responded", cur).apply()
    }

    /** מאתר document-id של קובץ-בשם-נתון בשורש-ה-tree (בלי לרדת לתת-תיקיות). */
    private fun findChildDocId(context: Context, tree: Uri, name: String): String? {
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
            tree, DocumentsContract.getTreeDocumentId(tree),
        )
        context.contentResolver.query(
            childrenUri,
            arrayOf(
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            ),
            null, null, null,
        )?.use { c ->
            val idIdx = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
            val nameIdx = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
            while (c.moveToNext()) {
                if (c.getString(nameIdx) == name) return c.getString(idIdx)
            }
        }
        return null
    }
}
