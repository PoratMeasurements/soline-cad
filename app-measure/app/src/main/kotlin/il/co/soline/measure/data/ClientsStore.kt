package il.co.soline.measure.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/* =========================================================================
 * מאגר-לקוחות (מפעלים/נגרים מזמינים) — כל לקוח נשמר עם תיקיית-Drive משלו.
 * "הקמת לקוח" = שם + קישור לתיקייה ב-Drive (SAF tree). בפתיחת-פרויקט בוחרים
 * לקוח-קיים והקבצים ילכו לתיקייה שלו. נשמר מקומית (SharedPreferences, JSON).
 * ========================================================================= */

/** לקוח במאגר: שם + URI של תיקיית-Drive שלו (SAF persistable tree). */
data class Client(val name: String, val folderUri: String) {
    val hasFolder: Boolean get() = folderUri.isNotBlank()
}

object ClientsStore {
    private const val FILE = "soline_clients"
    private const val KEY = "clients_json"

    /** כל הלקוחות, ממוינים אלפביתית. */
    fun all(context: Context): List<Client> {
        val sp = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
        val raw = sp.getString(KEY, "[]") ?: "[]"
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).mapNotNull { i ->
                val o = arr.optJSONObject(i) ?: return@mapNotNull null
                val name = o.optString("name")
                if (name.isBlank()) null else Client(name, o.optString("uri"))
            }.sortedBy { it.name.lowercase() }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /** מחזיר לקוח לפי-שם (case-insensitive), או null. */
    fun get(context: Context, name: String): Client? =
        all(context).firstOrNull { it.name.equals(name.trim(), ignoreCase = true) }

    /** מוסיף/מעדכן לקוח (שם + תיקייה). */
    fun upsert(context: Context, name: String, folderUri: String) {
        val n = name.trim()
        if (n.isBlank()) return
        val sp = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
        val list = all(context).filterNot { it.name.equals(n, ignoreCase = true) } + Client(n, folderUri)
        val arr = JSONArray()
        list.forEach { arr.put(JSONObject().put("name", it.name).put("uri", it.folderUri)) }
        sp.edit().putString(KEY, arr.toString()).apply()
    }
}
