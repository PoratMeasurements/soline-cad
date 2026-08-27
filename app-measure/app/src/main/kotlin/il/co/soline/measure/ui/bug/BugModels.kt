package il.co.soline.measure.ui.bug

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/* =========================================================================
 * מדווח-הבאגים — שכבת-הנתונים (מודלים · סריאליזציה · אחסון-קבצים)
 * -------------------------------------------------------------------------
 * שכבה זו נטולת-Compose ונטולת-View כדי שתהיה ברת-בדיקה ב-JVM (Robolectric,
 * org.json אמיתי). ה"חוזה" מול הבעלים: לכל דיווח נשמרים שני קבצים תחת
 * filesDir/bug_reports/ —
 *   bug_{yyyyMMdd_HHmmss}.png   — צילום-המסך עם ההערות מצוירות עליו
 *   bug_{yyyyMMdd_HHmmss}.json  — מטא-דאטה (השדות למטה, בדיוק כפי שהוגדרו)
 * שמות-הקבצים ומבנה-ה-JSON הם חוזה-קבוע (הבעלים מטמיע לתיקיית-Drive) — אין
 * לשנות שמות-שדות/פורמט-שם-קובץ.
 * ========================================================================= */

/** גרסת-סכימת-ה-DB הנוכחית — נשמרת בכל דיווח (חלק מהחוזה). */
const val BUG_DB_VERSION = 18

/** תיקיית-היעד לכל דיווחי-הבאגים תחת filesDir. */
fun bugReportsDir(filesDir: File): File =
    File(filesDir, "bug_reports").apply { if (!exists()) mkdirs() }

/** שם-בסיס לדיווח לפי חותמת-זמן: bug_yyyyMMdd_HHmmss (ללא סיומת). */
fun bugBaseName(now: Date = Date()): String {
    val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(now)
    return "bug_$stamp"
}

/**
 * הערה בודדת על-גבי צילום-המסך. הקואורדינטות נשמרות **בפיקסלי-הביטמאפ** של
 * צילום-המסך הסופי (לא בקואורדינטות-מסך), כדי שהחוזה יהיה בלתי-תלוי-במכשיר.
 *
 * - [type] = "arrow": משתמש ב-tailX/tailY (זנב) ו-headX/headY (ראש-החץ).
 * - [type] = "text":  משתמש ב-x/y (פינה שמאלית-עליונה של הטקסט) וב-[text].
 */
data class BugAnnotation(
    val type: String,
    val tailX: Float = 0f,
    val tailY: Float = 0f,
    val headX: Float = 0f,
    val headY: Float = 0f,
    val x: Float = 0f,
    val y: Float = 0f,
    val text: String = "",
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("type", type)
        when (type) {
            "arrow" -> {
                put("tailX", tailX.toDouble()); put("tailY", tailY.toDouble())
                put("headX", headX.toDouble()); put("headY", headY.toDouble())
            }
            else -> {
                put("x", x.toDouble()); put("y", y.toDouble()); put("text", text)
            }
        }
    }

    companion object {
        const val ARROW = "arrow"
        const val TEXT = "text"

        fun fromJson(o: JSONObject): BugAnnotation = BugAnnotation(
            type = o.optString("type", TEXT),
            tailX = o.optDouble("tailX", 0.0).toFloat(),
            tailY = o.optDouble("tailY", 0.0).toFloat(),
            headX = o.optDouble("headX", 0.0).toFloat(),
            headY = o.optDouble("headY", 0.0).toFloat(),
            x = o.optDouble("x", 0.0).toFloat(),
            y = o.optDouble("y", 0.0).toFloat(),
            text = o.optString("text", ""),
        )
    }
}

/** מידע-מכשיר קצר לשילוב בדיווח. */
data class BugDevice(val model: String, val android: String) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("model", model); put("android", android)
    }
}

/**
 * חבילת-דיווח מלאה — המטא-דאטה שנשמרת ל-JSON. שמות-השדות הם חוזה.
 */
data class BugReportBundle(
    val id: String,
    val createdAt: String,
    val screen: String,
    val notes: String,
    val annotations: List<BugAnnotation>,
    val appVersionName: String,
    val appVersionCode: Int,
    val dbVersion: Int = BUG_DB_VERSION,
    val device: BugDevice,
    val currentProjectId: Long? = null,
    val currentRoomId: Long? = null,
) {
    /** מחרוזת-JSON יפה (indent=2) לשמירה בקובץ ה-bug_*.json. */
    fun toJsonString(): String = JSONObject().apply {
        put("id", id)
        put("createdAt", createdAt)
        put("screen", screen)
        put("notes", notes)
        put("annotations", JSONArray().also { arr -> annotations.forEach { arr.put(it.toJson()) } })
        put("appVersionName", appVersionName)
        put("appVersionCode", appVersionCode)
        put("dbVersion", dbVersion)
        put("device", device.toJson())
        // currentProjectId/roomId — נכתבים רק אם ניתנים-לפתרון (JSONObject.NULL אחרת)
        put("currentProjectId", currentProjectId ?: JSONObject.NULL)
        put("currentRoomId", currentRoomId ?: JSONObject.NULL)
    }.toString(2)

    companion object {
        fun fromJsonString(json: String): BugReportBundle {
            val o = JSONObject(json)
            val ann = mutableListOf<BugAnnotation>()
            val arr = o.optJSONArray("annotations") ?: JSONArray()
            for (i in 0 until arr.length()) ann.add(BugAnnotation.fromJson(arr.getJSONObject(i)))
            val dev = o.optJSONObject("device")
            return BugReportBundle(
                id = o.optString("id", ""),
                createdAt = o.optString("createdAt", ""),
                screen = o.optString("screen", ""),
                notes = o.optString("notes", ""),
                annotations = ann,
                appVersionName = o.optString("appVersionName", ""),
                appVersionCode = o.optInt("appVersionCode", 0),
                dbVersion = o.optInt("dbVersion", BUG_DB_VERSION),
                device = BugDevice(
                    model = dev?.optString("model", "") ?: "",
                    android = dev?.optString("android", "") ?: "",
                ),
                currentProjectId = o.optLong("currentProjectId").takeIf { !o.isNull("currentProjectId") },
                currentRoomId = o.optLong("currentRoomId").takeIf { !o.isNull("currentRoomId") },
            )
        }
    }
}

/** רשומת-דיווח-שמור (זוג png+json) לתצוגת-הרשימה בהגדרות. */
data class SavedBugReport(
    val baseName: String,
    val png: File,
    val json: File,
    val createdAt: String,
    val screen: String,
) {
    val lastModified: Long get() = png.lastModified()
}

/**
 * אחסון-קבצים לדיווחי-באגים — כתיבה, רשימה ומחיקה. קבצים-בלבד (ללא-DB).
 */
object BugReportStore {

    /** כותב זוג png+json ומחזיר את שם-הבסיס. ה-PNG כבר-מקודד (bytes). */
    fun save(filesDir: File, baseName: String, pngBytes: ByteArray, bundle: BugReportBundle): SavedBugReport {
        val dir = bugReportsDir(filesDir)
        val png = File(dir, "$baseName.png")
        val json = File(dir, "$baseName.json")
        png.writeBytes(pngBytes)
        json.writeText(bundle.toJsonString(), Charsets.UTF_8)
        return SavedBugReport(baseName, png, json, bundle.createdAt, bundle.screen)
    }

    /** מחזיר את כל הדיווחים השמורים, החדשים-ביותר-קודם. סובלני לקבצים-פגומים. */
    fun list(filesDir: File): List<SavedBugReport> {
        val dir = bugReportsDir(filesDir)
        val pngs = dir.listFiles { f -> f.isFile && f.name.startsWith("bug_") && f.name.endsWith(".png") }
            ?: return emptyList()
        return pngs.mapNotNull { png ->
            val base = png.name.removeSuffix(".png")
            val json = File(dir, "$base.json")
            var createdAt = ""
            var screen = ""
            if (json.exists()) {
                try {
                    val b = BugReportBundle.fromJsonString(json.readText(Charsets.UTF_8))
                    createdAt = b.createdAt; screen = b.screen
                } catch (_: Exception) { /* JSON פגום — עדיין מציגים את ה-PNG */ }
            }
            SavedBugReport(base, png, if (json.exists()) json else png, createdAt, screen)
        }.sortedByDescending { it.lastModified }
    }

    /** מוחק דיווח בודד (png+json). */
    fun delete(report: SavedBugReport) {
        report.png.delete()
        report.json.takeIf { it.name.endsWith(".json") && it.exists() }?.delete()
    }
}
