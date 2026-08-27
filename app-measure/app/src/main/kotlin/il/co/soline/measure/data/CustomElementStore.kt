package il.co.soline.measure.data

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import il.co.soline.measure.catalog.ElementDef
import org.json.JSONArray
import org.json.JSONObject

/**
 * CustomElementStore — אחסון האלמנטים שהמשתמש יצר/שכפל (ספריית-האלמנטים האישית).
 *
 * מקבילה ישירה ל-`CatalogVariantManager` של CVSM 5.9.0 (ראה docs/CVSM_5.9_UPDATE.md §2):
 * וריאנטים אישיים הנגזרים מאלמנט-מובנה, נשמרים כרשימת-JSON ב-SharedPreferences (offline-first).
 *
 * דפוס-האחסון זהה ל-[Prefs]: object עם אתחול-עצל דרך `SolineApp.instance`, וכל ערך נחשף כ-[State]
 * מבוסס-`mutableStateOf` כדי שכל Composable שקורא [all]/[allState] יתעדכן (recompose) אוטומטית.
 *
 * אין DB חדש, אין תלות חדשה — סריאליזציה ב-`org.json` המובנה ל-Android.
 */
object CustomElementStore {

    /** קידומת-מפתח לכל אלמנט אישי — מבדילה מובנה (קריאה-בלבד) מאישי (ניתן-לעריכה/מחיקה). */
    const val PREFIX = "CUSTOM_"

    private const val FILE = "soline_custom_elements"
    private const val K_ELEMENTS = "custom_elements"

    private lateinit var sp: SharedPreferences

    // מקור-האמת התגובתי; מסונכרן תמיד עם SharedPreferences.
    private val _all = mutableStateOf<List<ElementDef>>(emptyList())

    /** אתחול — טוען את הרשימה השמורה. בטוח לקריאה חוזרת. */
    fun init(context: Context) {
        if (::sp.isInitialized) return
        sp = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)
        _all.value = readFromPrefs()
    }

    /** אתחול-עצל בטוח — מבטיח ש-SharedPreferences זמין גם ללא קריאת init מפורשת. */
    private fun ensureInit() {
        if (!::sp.isInitialized) init(SolineApp.instance)
    }

    // ---- קריאה תגובתית ----
    /** State לצריכה בתוך Composable (`val custom by CustomElementStore.allState`). */
    val allState: State<List<ElementDef>> get() { ensureInit(); return _all }

    /** קריאה חד-פעמית של כל האלמנטים האישיים. */
    val all: List<ElementDef> get() { ensureInit(); return _all.value }

    /** האם המפתח שייך לאלמנט אישי (ולא מובנה). */
    fun isCustom(key: String): Boolean = key.startsWith(PREFIX)

    /**
     * מפתח-אישי חדש וייחודי. נגזר ממקסימום המונה הקיים (אי-אפשר Date.now) → יציב וייחודי.
     */
    fun newKey(): String {
        ensureInit()
        val maxN = _all.value
            .mapNotNull { it.key.removePrefix(PREFIX).toIntOrNull() }
            .maxOrNull() ?: 0
        return "$PREFIX${maxN + 1}"
    }

    /** הוספת אלמנט אישי חדש. אם המפתח ריק/מתנגש — מוקצה מפתח חדש. */
    fun add(def: ElementDef) {
        ensureInit()
        val key = if (def.key.isBlank() || _all.value.any { it.key == def.key }) newKey() else def.key
        val toAdd = if (key == def.key) def else def.copy(key = key)
        _all.value = _all.value + toAdd
        persist()
    }

    /** עדכון אלמנט אישי קיים (לפי key). אם לא נמצא — נוסף. */
    fun update(def: ElementDef) {
        ensureInit()
        val idx = _all.value.indexOfFirst { it.key == def.key }
        _all.value = if (idx < 0) _all.value + def
        else _all.value.toMutableList().also { it[idx] = def }
        persist()
    }

    /** מחיקת אלמנט אישי לפי key. אלמנטים מובנים אינם מושפעים (אינם באחסון זה). */
    fun remove(key: String) {
        ensureInit()
        _all.value = _all.value.filterNot { it.key == key }
        persist()
    }

    // ---- סריאליזציה (org.json) ----
    private fun persist() {
        val arr = JSONArray()
        _all.value.forEach { d ->
            arr.put(
                JSONObject()
                    .put("key", d.key)
                    .put("he", d.he)
                    .put("group", d.group)
                    .put("defaultDepth", d.defaultDepth)
                    .put("round", d.round)
                    .put("hasDepth", d.hasDepth)
                    .put("ordxClass", d.ordxClass)
                    .put("ordxType", d.ordxType),
            )
        }
        sp.edit().putString(K_ELEMENTS, arr.toString()).apply()
    }

    private fun readFromPrefs(): List<ElementDef> {
        val raw = sp.getString(K_ELEMENTS, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                ElementDef(
                    key = o.getString("key"),
                    he = o.optString("he", ""),
                    group = o.optString("group", ""),
                    defaultDepth = o.optDouble("defaultDepth", 0.0),
                    round = o.optBoolean("round", false),
                    hasDepth = o.optBoolean("hasDepth", true),
                    ordxClass = o.optString("ordxClass", "Fixture"),
                    ordxType = o.optString("ordxType", "Miscellaneous"),
                )
            }
        } catch (_: Exception) {
            emptyList() // "CustomElementStore: failed to read elements" — נכשל בשקט, לא מאבד את האפליקציה
        }
    }
}
