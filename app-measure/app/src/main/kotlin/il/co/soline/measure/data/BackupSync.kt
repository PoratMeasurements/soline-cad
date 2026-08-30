package il.co.soline.measure.data

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import il.co.soline.measure.export.SolWriter

/* =========================================================================
 * גיבוי-פרויקט אוטומטי ל-Drive עם מבנה-תיקיות:
 *   [תיקיית-לקוח/מפעל]  ← מ-ClientsStore (או תיקיית-גיבוי כללית כ-fallback)
 *     └── [שם-הפרויקט]/
 *           └── <project>.sol   ← קונטיינר-האב (חדרים + תמונות + הכל בתוכו)
 *
 * ה-‎.sol‎ נכתב דרך repo.exportSol (אותו איסוף-נתונים של הייצוא), לתוך זרם-SAF.
 * שחזור (‎.sol‎ → DB) יגיע בבנייה נפרדת (דורש parser).
 * ========================================================================= */
object BackupSync {

    sealed class Result {
        data class Success(val folderName: String) : Result()
        object NoFolder : Result()
        data class Failed(val message: String) : Result()
    }

    /** מגבה פרויקט ל-Drive. רץ ב-IO (קורא ל-repo.exportSol שהוא suspend). */
    suspend fun backupProject(context: Context, project: Project): Result {
        // יעד: תיקיית-הלקוח (לפי שם-הלקוח במאגר) → אחרת תיקיית-גיבוי כללית.
        val clientFolder = ClientsStore.get(context, project.client)?.folderUri?.takeIf { it.isNotBlank() }
        val rootTreeStr = clientFolder ?: Prefs.backupTreeUri.takeIf { it.isNotBlank() } ?: return Result.NoFolder

        return try {
            val tree = Uri.parse(rootTreeStr)
            val rootDocId = DocumentsContract.getTreeDocumentId(tree)
            val projName = sanitize(project.name).ifBlank { "project" }

            // תיקיית-הפרויקט (יצירה-או-מציאה)
            val projDocId = findOrCreateDir(context, tree, rootDocId, projName)
                ?: return Result.Failed("יצירת תיקיית-פרויקט נכשלה")
            val projDirUri = DocumentsContract.buildDocumentUriUsingTree(tree, projDocId)

            // מוחקים ‎.sol‎ קודם באותו-שם (החלפה, בלי כפילויות), ואז יוצרים חדש
            val solName = SolWriter.fileName(project)
            deleteChildByName(context, tree, projDocId, solName)
            val target = DocumentsContract.createDocument(
                context.contentResolver, projDirUri, "application/octet-stream", solName,
            ) ?: return Result.Failed("יצירת קובץ-הגיבוי נכשלה")

            context.contentResolver.openOutputStream(target)?.use { out ->
                SolineApp.instance.repo.exportSol(project, out)
            } ?: return Result.Failed("פתיחת זרם-הכתיבה נכשלה")

            Result.Success(projName)
        } catch (e: Exception) {
            Result.Failed(e.message ?: "שגיאה לא-ידועה")
        }
    }

    /** מוצא תת-תיקייה בשם-נתון תחת [parentDocId], או יוצר אותה. מחזיר את ה-documentId. */
    private fun findOrCreateDir(context: Context, tree: Uri, parentDocId: String, name: String): String? {
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentDocId)
        context.contentResolver.query(
            childrenUri,
            arrayOf(
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
            ),
            null, null, null,
        )?.use { c ->
            val idI = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
            val nmI = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
            val mtI = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
            while (c.moveToNext()) {
                if (c.getString(nmI) == name && c.getString(mtI) == DocumentsContract.Document.MIME_TYPE_DIR) {
                    return c.getString(idI)
                }
            }
        }
        val parentUri = DocumentsContract.buildDocumentUriUsingTree(tree, parentDocId)
        val created = DocumentsContract.createDocument(
            context.contentResolver, parentUri, DocumentsContract.Document.MIME_TYPE_DIR, name,
        )
        return created?.let { DocumentsContract.getDocumentId(it) }
    }

    /** מוחק קובץ-ילד בשם-נתון (אם קיים) — למניעת כפילויות בהחלפה. */
    private fun deleteChildByName(context: Context, tree: Uri, parentDocId: String, name: String) {
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentDocId)
        context.contentResolver.query(
            childrenUri,
            arrayOf(
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            ),
            null, null, null,
        )?.use { c ->
            val idI = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
            val nmI = c.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
            while (c.moveToNext()) {
                if (c.getString(nmI) == name) {
                    try {
                        DocumentsContract.deleteDocument(
                            context.contentResolver,
                            DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(idI)),
                        )
                    } catch (_: Exception) {}
                }
            }
        }
    }

    /** ניקוי שם-תיקייה: תווים אסורים ל-'_'. */
    private fun sanitize(name: String): String = buildString {
        for (ch in name.trim()) {
            append(if (ch == '/' || ch == '\\' || ch == ':' || ch == '*' || ch == '?' || ch == '"' || ch == '<' || ch == '>' || ch == '|' || ch < ' ') '_' else ch)
        }
    }.trim('.', ' ')
}
