package il.co.soline.measure.ui.bug

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.Calendar
import java.util.GregorianCalendar

/**
 * BugReportBundleTest — נועל את **החוזה** של מדווח-הבאגים (הבעלים מטמיע את
 * הקבצים לתיקיית-Drive): פורמט-שם-הקובץ, שמות-שדות-ה-JSON, וסיבוב הלוך-ושוב.
 * רץ עם Robolectric כדי לקבל org.json אמיתי על ה-JVM (כמו MigrationTest).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class BugReportBundleTest {

    @Test fun baseName_matches_contract_format() {
        val cal: Calendar = GregorianCalendar(2026, 7, 26, 9, 5, 3) // 2026-08-26 09:05:03
        val name = bugBaseName(cal.time)
        assertEquals("bug_20260826_090503", name)
    }

    @Test fun bundle_json_has_all_contract_fields() {
        val bundle = sampleBundle()
        val o = JSONObject(bundle.toJsonString())
        // כל שדות-החוזה קיימים בדיוק בשמות שהוגדרו
        for (key in listOf(
            "id", "createdAt", "screen", "notes", "annotations",
            "appVersionName", "appVersionCode", "dbVersion", "device",
            "currentProjectId", "currentRoomId",
        )) assertTrue("חסר שדה $key", o.has(key))

        assertEquals(18, o.getInt("dbVersion"))
        assertEquals("מסך-חדר", o.getString("screen"))
        assertEquals("Pixel 7", o.getJSONObject("device").getString("model"))
        assertEquals(2, o.getJSONArray("annotations").length())
    }

    @Test fun bundle_roundtrip_preserves_data() {
        val original = sampleBundle()
        val restored = BugReportBundle.fromJsonString(original.toJsonString())
        assertEquals(original.id, restored.id)
        assertEquals(original.screen, restored.screen)
        assertEquals(original.notes, restored.notes)
        assertEquals(original.appVersionCode, restored.appVersionCode)
        assertEquals(original.currentProjectId, restored.currentProjectId)
        assertEquals(original.currentRoomId, restored.currentRoomId)
        assertEquals(2, restored.annotations.size)
        val arrow = restored.annotations.first { it.type == BugAnnotation.ARROW }
        assertEquals(10f, arrow.tailX, 0.001f)
        assertEquals(40f, arrow.headY, 0.001f)
        val text = restored.annotations.first { it.type == BugAnnotation.TEXT }
        assertEquals("שבור פה", text.text)
    }

    @Test fun null_ids_serialize_as_json_null() {
        val bundle = sampleBundle().copy(currentProjectId = null, currentRoomId = null)
        val o = JSONObject(bundle.toJsonString())
        assertTrue(o.isNull("currentProjectId"))
        assertTrue(o.isNull("currentRoomId"))
        val restored = BugReportBundle.fromJsonString(bundle.toJsonString())
        assertEquals(null, restored.currentProjectId)
        assertEquals(null, restored.currentRoomId)
    }

    @Test fun arrowhead_barbs_are_behind_the_head() {
        // חץ אופקי ימינה: הזיפים חייבים להיות משמאל לראש (x קטן מ-headX)
        val b = arrowheadBarbs(0f, 0f, 100f, 0f, 20f)
        assertTrue(b[0] < 100f)
        assertTrue(b[2] < 100f)
    }

    private fun sampleBundle() = BugReportBundle(
        id = "bug_20260826_090503",
        createdAt = "2026-08-26T09:05:03",
        screen = "מסך-חדר",
        notes = "כפתור לא-מגיב",
        annotations = listOf(
            BugAnnotation(type = BugAnnotation.ARROW, tailX = 10f, tailY = 20f, headX = 30f, headY = 40f),
            BugAnnotation(type = BugAnnotation.TEXT, x = 5f, y = 6f, text = "שבור פה"),
        ),
        appVersionName = "0.1",
        appVersionCode = 1,
        device = BugDevice(model = "Pixel 7", android = "Android 14"),
        currentProjectId = 42L,
        currentRoomId = 7L,
    )
}
