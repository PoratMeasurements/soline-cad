package il.co.soline.measure.data

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf

/**
 * RecentElementsStore — זוכר אילו אלמנטים המודד השתמש בהם לאחרונה, כדי שהבורר ייפתח
 * ל**מהירות ולא לחיפוש**. "לרוץ על המדידה, לא לחפש דברים" — האלמנטים הנפוצים תמיד ביד.
 *
 * דפוס-האחסון זהה ל-[Prefs] ול-[CustomElementStore]: object עם אתחול-עצל דרך `SolineApp.instance`,
 * SharedPreferences מקומי (offline-first, בלי DB חדש, בלי תלות חדשה), וכל ערך נחשף כ-[State]
 * מבוסס-`mutableStateOf` כדי שכל Composable שקורא [recentState]/[favoritesState] יתעדכן (recompose)
 * אוטומטית ברגע שהמודד בחר אלמנט או סימן מועדף.
 *
 * שני נתונים נשמרים:
 *   • MRU — רשימת-מפתחות אחרונים-שנבחרו (Most-Recently-Used), החדש בראש, מקסימום [MAX_RECENT].
 *   • favorites — קבוצת-מפתחות שהמודד נעץ ידנית (★), תמיד זמינים בראש הבורר.
 *
 * שימוש:
 *   val recent by RecentElementsStore.recentState          // קריאה תגובתית בתוך Composable
 *   val favs   by RecentElementsStore.favoritesState
 *   RecentElementsStore.markUsed("SOCKET_SINGLE")          // בכל בחירה — לפני onPick
 *   RecentElementsStore.toggleFavorite("WATER_PIPE")       // לחיצה-ארוכה על אריח
 */
object RecentElementsStore {

    private const val FILE = "soline_recent_elements"
    private const val K_RECENT = "recent_keys"       // רשימת-MRU מופרדת ב-'|'
    private const val K_FAVORITES = "favorite_keys"  // קבוצת-מועדפים מופרדת ב-'|'

    /** כמה אלמנטים-אחרונים לזכור (רצועת-"מהיר" מציגה בד"כ ~8; שומרים מעט יותר כרזרבה). */
    const val MAX_RECENT = 12

    private const val SEP = "|"

    private lateinit var sp: SharedPreferences

    // מקור-האמת התגובתי; מסונכרן תמיד עם SharedPreferences.
    private val _recent = mutableStateOf<List<String>>(emptyList())
    private val _favorites = mutableStateOf<Set<String>>(emptySet())

    /** אתחול — טוען את הרשימות השמורות. בטוח לקריאה חוזרת (בד"כ מ-SolineApp.onCreate, או lazy). */
    fun init(context: Context) {
        if (::sp.isInitialized) return
        sp = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)
        _recent.value = decode(sp.getString(K_RECENT, null))
        _favorites.value = decode(sp.getString(K_FAVORITES, null)).toSet()
    }

    /** אתחול-עצל בטוח — מבטיח ש-SharedPreferences זמין גם ללא קריאת init מפורשת. */
    private fun ensureInit() {
        if (!::sp.isInitialized) init(SolineApp.instance)
    }

    // ---- קריאה תגובתית ----
    /** State לצריכה בתוך Composable — מפתחות אחרונים-שנבחרו, החדש בראש. */
    val recentState: State<List<String>> get() { ensureInit(); return _recent }

    /** קריאה חד-פעמית של המפתחות-האחרונים. */
    val recent: List<String> get() { ensureInit(); return _recent.value }

    /** State לצריכה בתוך Composable — קבוצת-המפתחות המועדפים (★). */
    val favoritesState: State<Set<String>> get() { ensureInit(); return _favorites }

    /** קריאה חד-פעמית של המועדפים. */
    val favorites: Set<String> get() { ensureInit(); return _favorites.value }

    /** האם המפתח מסומן כמועדף. */
    fun isFavorite(key: String): Boolean { ensureInit(); return _favorites.value.contains(key) }

    /**
     * מסמן שאלמנט נבחר — מקדם אותו לראש רשימת-ה-MRU (מסיר כפילות, גוזם ל-[MAX_RECENT]).
     * נקרא בכל בחירה, מיד לפני `onPick`.
     */
    fun markUsed(key: String) {
        ensureInit()
        if (key.isBlank()) return
        _recent.value = (listOf(key) + _recent.value.filterNot { it == key }).take(MAX_RECENT)
        sp.edit().putString(K_RECENT, encode(_recent.value)).apply()
    }

    /** נעיצה/שחרור של מועדף (★) — לחיצה-ארוכה על אריח. */
    fun toggleFavorite(key: String) {
        ensureInit()
        if (key.isBlank()) return
        val cur = _favorites.value
        _favorites.value = if (cur.contains(key)) cur - key else cur + key
        sp.edit().putString(K_FAVORITES, encode(_favorites.value)).apply()
    }

    /** מסיר מפתח מכל המבנים — לשימוש כשאלמנט אישי נמחק (מפתח שכבר לא קיים). */
    fun forget(key: String) {
        ensureInit()
        var changed = false
        if (_recent.value.contains(key)) {
            _recent.value = _recent.value.filterNot { it == key }
            sp.edit().putString(K_RECENT, encode(_recent.value)).apply()
            changed = true
        }
        if (_favorites.value.contains(key)) {
            _favorites.value = _favorites.value - key
            sp.edit().putString(K_FAVORITES, encode(_favorites.value)).apply()
            changed = true
        }
        if (!changed) return
    }

    // ---- סריאליזציה פשוטה (מחרוזת מופרדת ב-'|'; המפתחות עצמם לעולם אינם מכילים '|') ----
    private fun encode(keys: Collection<String>): String = keys.joinToString(SEP)

    private fun decode(raw: String?): List<String> =
        raw?.split(SEP)?.filter { it.isNotBlank() } ?: emptyList()
}
