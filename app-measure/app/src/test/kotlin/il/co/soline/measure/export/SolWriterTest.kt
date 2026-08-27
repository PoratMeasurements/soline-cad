package il.co.soline.measure.export

import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.PhotoEntity
import il.co.soline.measure.data.Project
import il.co.soline.measure.data.RoomEntity
import il.co.soline.measure.data.VideoEntity
import il.co.soline.measure.data.WallEntity
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.zip.ZipInputStream

/**
 * SolWriterTest — builds a small in-memory project (room/walls/accessory+opening/
 * photo/video) and asserts [SolWriter.write] produces a valid `.sol` ZIP whose
 * manifest / measured / annotations entries parse as JSON and carry the expected
 * fields (measured flags, photos[]/videos[] with roomId, projectChecklist).
 *
 * Robolectric only for a real org.json parser on the JVM; SolWriter.write itself
 * is plain java.util.zip / java.io.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class SolWriterTest {

    private fun tempMedia(suffix: String): File =
        File.createTempFile("solwriter-test", suffix).apply {
            writeBytes(byteArrayOf(1, 2, 3, 4))
            deleteOnExit()
        }

    private fun writeSampleProject(): Map<String, String> {
        val project = Project(id = 1L, name = "דירת בדיקה", client = "נגר", createdAt = 1_700_000_000_000L)
        val room = RoomEntity(id = 10L, projectId = 1L, name = "מטבח")
        val wall0 = WallEntity(id = 100L, roomId = 10L, idx = 0, length = 4000.0, height = 2700.0, heightMeasured = true)
        val wall1 = WallEntity(id = 101L, roomId = 10L, idx = 1, length = 3000.0, height = 2700.0, heightMeasured = false)
        val door = AccessoryEntity(
            id = 1000L, wallId = 100L, type = "DOOR", name = "דלת",
            depth = 0.0, fromLeft = 500.0, width = 900.0, fromBottom = 0.0, height = 2100.0,
            openingKind = "door", sillHeight = -1.0, wallThickness = 100.0, frameThickness = 40.0,
            openMode = "hinged", hingeSide = "L", swing = "in", leafCount = 1, glazing = "none",
            fromCorner = "start", measured = true,
        )
        val photoFile = tempMedia(".jpg")
        val videoFile = tempMedia(".mp4")
        val photo = PhotoEntity(
            id = 1L, projectId = 1L, roomId = 10L, wallId = 100L, seq = 1,
            scope = "wall", kind = "elevation", fileName = "חזית-1_01.jpg", absPath = photoFile.absolutePath,
            w = 1920, h = 1080, bytes = 4,
        )
        val explainer = VideoEntity(
            id = 1L, projectId = 1L, roomId = null, wallId = null, seq = 1,
            scope = "project", kind = "explainer", fileName = "הסבר_01.mp4", absPath = videoFile.absolutePath,
            durationSec = 30, bytes = 4,
        )

        val out = ByteArrayOutputStream()
        SolWriter.write(
            project = project,
            rooms = listOf(room),
            wallsByRoom = mapOf(10L to listOf(wall0, wall1)),
            accByWall = mapOf(100L to listOf(door)),
            out = out,
            photosByRoom = mapOf(10L to listOf(photo)),
            projectVideos = listOf(explainer),
        )

        // פורקים את ה-ZIP למפת entry→תוכן (טקסט ל-JSON, מדיה נאספת רק כשם-entry).
        val entries = HashMap<String, String>()
        ZipInputStream(ByteArrayInputStream(out.toByteArray())).use { zin ->
            var e = zin.nextEntry
            while (e != null) {
                val bytes = zin.readBytes()
                entries[e.name] = if (e.name.endsWith(".json")) String(bytes, Charsets.UTF_8) else ""
                e = zin.nextEntry
            }
        }
        return entries
    }

    @Test fun write_producesAllExpectedZipEntries() {
        val entries = writeSampleProject()
        assertTrue("manifest חייב להיות present", entries.containsKey("manifest.json"))
        assertTrue(entries.containsKey("meta.json"))
        assertTrue(entries.containsKey("measured/room-10.json"))
        assertTrue(entries.containsKey("annotations.json"))
        assertTrue(entries.containsKey("revisions.json"))
        assertTrue("קובץ-התמונה מוטמע תחת photos/", entries.keys.any { it.startsWith("photos/") })
        assertTrue("קובץ-הווידאו מוטמע תחת videos/", entries.keys.any { it.startsWith("videos/") })
    }

    @Test fun manifest_isValidJsonWithExpectedFields() {
        val m = JSONObject(writeSampleProject().getValue("manifest.json"))
        assertEquals("sol", m.getString("format"))
        assertEquals("SOL1", m.getString("magic"))
        assertEquals("mm", m.getString("units"))
        assertEquals(1L, m.getLong("projectId"))
        val layers = m.getJSONObject("layers")
        assertTrue(layers.getJSONObject("photos").getBoolean("present"))
        assertTrue(layers.getJSONObject("videos").getBoolean("present"))
        assertTrue(layers.getJSONObject("measured").getBoolean("present"))
    }

    @Test fun measuredRoom_carriesWallsAccessoriesAndMeasuredFlags() {
        val r = JSONObject(writeSampleProject().getValue("measured/room-10.json"))
        assertEquals(10L, r.getLong("id"))
        assertEquals(1L, r.getLong("projectId"))
        val walls = r.getJSONArray("walls")
        assertEquals(2, walls.length())
        val w0 = walls.getJSONObject(0)
        assertTrue("heightMeasured צריך להישמר", w0.getBoolean("heightMeasured"))
        assertEquals(4000.0, w0.getDouble("length_mm"), 1e-6)
        val accs = w0.getJSONArray("accessories")
        assertEquals(1, accs.length())
        val a = accs.getJSONObject(0)
        assertTrue("measured צריך להישמר", a.getBoolean("measured"))
        val opening = a.getJSONObject("opening")
        assertEquals("door", opening.getString("kind"))
    }

    @Test fun annotations_carryPhotosVideosAndChecklist() {
        val a = JSONObject(writeSampleProject().getValue("annotations.json"))
        val photos = a.getJSONArray("photos")
        assertEquals(1, photos.length())
        val p0 = photos.getJSONObject(0)
        assertEquals(10L, p0.getLong("roomId"))          // שיוך-חדר נשמר
        assertEquals("wall", p0.getString("scope"))
        assertNotNull(p0.getString("wallLabel"))
        assertTrue(p0.getString("file").startsWith("photos/"))

        val videos = a.getJSONArray("videos")
        assertEquals(1, videos.length())
        val v0 = videos.getJSONObject(0)
        assertEquals("project", v0.getString("scope"))
        assertEquals("explainer", v0.getString("kind"))

        // שערי-הרשימה: checklist (פר-חדר) + projectChecklist (שער-הפרויקט).
        assertTrue(a.has("checklist"))
        val pc = a.getJSONObject("projectChecklist")
        assertTrue(pc.has("allRoomsComplete"))
        assertTrue(pc.has("access"))
        assertTrue(pc.getJSONObject("explainer").getBoolean("done"))  // סרטון-הסבר קיים
    }
}
