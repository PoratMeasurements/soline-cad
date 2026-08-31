package il.co.soline.measure.data

import org.json.JSONObject
import java.io.InputStream
import java.util.zip.ZipInputStream

/**
 * קורא-חבילת-‏.sol‏ (שחזור פרויקט מ-Drive · בקשת-מודד 181005). ההופכי של
 * [il.co.soline.measure.export.SolWriter]: קורא את ה-ZIP, מפענח את meta.json ואת
 * measured/room-*.json, ומחזיר מבנה-נתונים ניטרלי ([SolProject]) שממנו [Repo.importSol]
 * משחזר את הפרויקט ל-DB. משחזר את הליבה: פרויקט · חדרים · קירות (אורך/גובה/זווית/סופיט/
 * framePoints) · אלמנטים (כולל פרמטרי-פתח והערות). שכבות-מדיה (תמונות/וידאו) אינן-משוחזרות
 * (הקבצים נשארים בחבילה) — תוספת-עתידית.
 */
object SolReader {

    data class SolAccessory(
        val type: String, val name: String,
        val depth: Double, val fromLeft: Double, val width: Double,
        val fromBottom: Double, val height: Double,
        val measured: Boolean, val notes: String,
        val openingKind: String, val sillHeight: Double, val wallThickness: Double,
        val frameThickness: Double, val frameReveal: Double, val leafThickness: Double,
        val openMode: String, val hingeSide: String, val swing: String,
        val leafCount: Int, val glazing: String, val fromCorner: String,
    )

    data class SolWall(
        val idx: Int, val length: Double, val height: Double, val angle: Double,
        val heightMeasured: Boolean, val soffitHeightMm: Double?,
        val framePointsJson: String, val accessories: List<SolAccessory>,
    )

    data class SolRoom(val name: String, val heightSweepMm: String, val futureChanges: String, val walls: List<SolWall>)

    data class SolProject(val name: String, val client: String, val rooms: List<SolRoom>)

    /** קורא חבילת-‏.sol‏ מ-[input]. מחזיר null אם אינה-חבילה-תקינה. */
    fun read(input: InputStream): SolProject? {
        val entries = HashMap<String, String>()
        try {
            ZipInputStream(input).use { zip ->
                var e = zip.nextEntry
                while (e != null) {
                    if (!e.isDirectory && e.name.endsWith(".json")) {
                        entries[e.name] = zip.readBytes().toString(Charsets.UTF_8)
                    }
                    zip.closeEntry()
                    e = zip.nextEntry
                }
            }
        } catch (_: Exception) {
            return null
        }
        val metaTxt = entries["meta.json"] ?: return null
        val meta = try { JSONObject(metaTxt) } catch (_: Exception) { return null }
        val name = meta.optString("name", "פרויקט משוחזר")
        val client = meta.optString("client", "")

        val rooms = entries.entries
            .filter { it.key.startsWith("measured/room-") && it.key.endsWith(".json") }
            .sortedBy { it.key }
            .mapNotNull { parseRoom(it.value) }

        return SolProject(name, client, rooms)
    }

    private fun parseRoom(txt: String): SolRoom? {
        val o = try { JSONObject(txt) } catch (_: Exception) { return null }
        val name = o.optString("name", "חדר")
        // שדות-סקר (אופציונליים) — נשמרים כמחרוזות-אחסון של RoomSurvey.
        val survey = o.optJSONObject("survey")
        val heightSweep = survey?.optString("heightSweepMm", "") ?: ""
        val futureChanges = survey?.optString("futureChanges", "") ?: ""
        val wallsArr = o.optJSONArray("walls")
        val walls = ArrayList<SolWall>()
        if (wallsArr != null) {
            for (i in 0 until wallsArr.length()) {
                val w = wallsArr.optJSONObject(i) ?: continue
                walls.add(parseWall(w))
            }
        }
        return SolRoom(name, heightSweep, futureChanges, walls)
    }

    private fun parseWall(w: JSONObject): SolWall {
        val accArr = w.optJSONArray("accessories")
        val accs = ArrayList<SolAccessory>()
        if (accArr != null) {
            for (i in 0 until accArr.length()) {
                val a = accArr.optJSONObject(i) ?: continue
                accs.add(parseAccessory(a))
            }
        }
        val fp = w.optJSONArray("framePoints")?.toString() ?: "[]"
        val soffit = if (w.isNull("soffitHeight_mm")) null else w.optDouble("soffitHeight_mm")
        return SolWall(
            idx = w.optInt("idx", accs.size),
            length = w.optDouble("length_mm", 0.0),
            height = w.optDouble("height_mm", 0.0),
            angle = w.optDouble("angleToNext_deg", 0.0),
            heightMeasured = w.optBoolean("heightMeasured", false),
            soffitHeightMm = soffit,
            framePointsJson = if (fp == "[]") "" else fp,
            accessories = accs,
        )
    }

    private fun parseAccessory(a: JSONObject): SolAccessory {
        // בלוק-פתח פרמטרי (opening) כשקיים — geom/config/pos מקוננים.
        val op = a.optJSONObject("opening")
        val geom = op?.optJSONObject("geom")
        val cfg = op?.optJSONObject("config")
        val pos = op?.optJSONObject("pos")
        return SolAccessory(
            type = a.optString("type", op?.optString("typeKey", "") ?: ""),
            name = a.optString("name", op?.optString("hebrewName", "") ?: ""),
            depth = a.optDouble("depth_mm", 0.0),
            fromLeft = a.optDouble("fromLeft_mm", pos?.optDouble("offset", 0.0) ?: 0.0),
            width = a.optDouble("width_mm", geom?.optDouble("width", 0.0) ?: 0.0),
            fromBottom = a.optDouble("fromBottom_mm", 0.0),
            height = a.optDouble("height_mm", geom?.optDouble("height", 0.0) ?: 0.0),
            measured = a.optBoolean("measured", false),
            notes = a.optString("notes", ""),
            openingKind = op?.optString("kind", "") ?: "",
            sillHeight = geom?.optDouble("sillHeight", -1.0) ?: -1.0,
            wallThickness = geom?.optDouble("wallThickness", 0.0) ?: 0.0,
            frameThickness = geom?.optDouble("frameThickness", 0.0) ?: 0.0,
            frameReveal = geom?.optDouble("frameReveal", 0.0) ?: 0.0,
            leafThickness = geom?.optDouble("leafThickness", 0.0) ?: 0.0,
            openMode = cfg?.optString("openMode", "") ?: "",
            hingeSide = cfg?.optString("hingeSide", "") ?: "",
            swing = cfg?.optString("swing", "") ?: "",
            leafCount = cfg?.optInt("leafCount", 1) ?: 1,
            glazing = cfg?.optString("glazing", "") ?: "",
            fromCorner = pos?.optString("fromCorner", "start") ?: "start",
        )
    }
}
