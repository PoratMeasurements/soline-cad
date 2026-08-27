package il.co.soline.measure.ui.video

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.data.VideoEntity
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.photo.CameraPermissionDeniedDialog
import il.co.soline.measure.ui.photo.openAppSettings
import il.co.soline.measure.ui.photo.phaseLabel
import il.co.soline.measure.ui.photo.uniqueDiskName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.time.Instant
import java.time.format.DateTimeFormatter

/* ─────────────────────────────────────────────────────────────────────────────
 *  VideoCapture — צילום-סרטוני-שדה (רשימת-משימות-מדיה · PHOTO_FEATURE_DESIGN §5.2).
 *
 *  מקביל-לחלוטין ל-PhotoCapture: כפתור → הרשאת-CAMERA → ACTION_VIDEO_CAPTURE דרך
 *  ה-FileProvider הקיים (נתיב `videos/`), כותב ל-filesDir/videos/, קורא משך+גודל
 *  (MediaMetadataRetriever) ושומר [VideoEntity]. חוזה-שם: `{kindHe}_{NN}.mp4`.
 *
 *  רזולוציה: מגדירים EXTRA_VIDEO_QUALITY=high + מגבלת-משך (2 דק') לריסון-הגודל.
 *  קאפ-720p אמיתי (transcode) הוא hook-עתידי — ראה [CaptureVideoBounded].
 * ───────────────────────────────────────────────────────────────────────────── */

private const val FILE_AUTHORITY = "il.co.soline.measure.fileprovider"

/** סוגי-הסרטון (kind) + תוויות-עברית — access (גישה) · explainer (הסבר). */
val VIDEO_KINDS: List<Pair<String, String>> = listOf(
    "access" to "גישה",
    "explainer" to "הסבר",
)

private val repo get() = SolineApp.instance.repo

/**
 * בקשת-צילום-וידאו — כל ההקשר לשם-הקובץ ולרשומה. `scope`: room|wall|element|project.
 * `phase` רלוונטי רק ל-scope="project" (opening/closing · גישה-לאתר).
 */
data class VideoRequest(
    val roomId: Long,
    val wallId: Long?,
    val wallIdx: Int,
    val scope: String,
    val elementId: Long?,
    val kind: String,
    val projectId: Long = 0,
    val phase: String = "",
)

/**
 * חוזה-Activity לצילום-וידאו עם מגבלת-משך + איכות-גבוהה. מקביל ל-TakePicture אך
 * מוסיף extras לריסון-הגודל. (קאפ-720p מדויק דורש transcode — hook-עתידי.)
 */
private class CaptureVideoBounded : ActivityResultContract<Uri, Boolean>() {
    override fun createIntent(context: Context, input: Uri): Intent =
        Intent(MediaStore.ACTION_VIDEO_CAPTURE)
            .putExtra(MediaStore.EXTRA_OUTPUT, input)
            .putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 1)   // איכות-גבוהה (רוב-המכשירים ≥720p)
            .putExtra(MediaStore.EXTRA_DURATION_LIMIT, 120) // מגבלת 2 דק' — ריסון-גודל
            .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)

    override fun parseResult(resultCode: Int, intent: Intent?): Boolean = resultCode == Activity.RESULT_OK
}

/**
 * רושם את משגרי-ה-Activity-Result (וידאו + הרשאה) ומחזיר טריגר-צילום.
 * מקביל-לחלוטין ל-rememberPhotoCapture. חייב-להיקרא ברמת-ה-composable.
 */
@Composable
fun rememberVideoCapture(): (VideoRequest) -> Unit {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pendingReq by remember { mutableStateOf<VideoRequest?>(null) }
    var pendingFile by remember { mutableStateOf<File?>(null) }
    // שם-התצוגה האנושי (`{kindHe}_NN.mp4`) — נשמר ב-`fileName` (חוזה-ה-.sol), בנפרד
    // משם-הקובץ-על-הדיסק שהוא ייחודי (r/w/p-prefixed · מונע דריסה רב-חדרית).
    var pendingDisplayName by remember { mutableStateOf<String?>(null) }
    // מניעת-הרשאה (קבוצה-D · HIGH): במקום זניחה-בשקט → דיאלוג-הסבר + "פתח הגדרות".
    var showPermDenied by remember { mutableStateOf(false) }

    val captureVideo = rememberLauncherForActivityResult(CaptureVideoBounded()) { success ->
        val file = pendingFile
        val req = pendingReq
        val displayName = pendingDisplayName
        if (success && file != null && req != null && file.exists() && file.length() > 0) {
            scope.launch {
                val durationSec = withContext(Dispatchers.IO) { readDurationSec(file) }
                val bytes = file.length()
                val takenAt = DateTimeFormatter.ISO_INSTANT.format(Instant.now())
                repo.addVideo(
                    VideoEntity(
                        projectId = req.projectId,
                        roomId = if (req.scope == "project") null else req.roomId,
                        wallId = req.wallId,
                        seq = seqFromName(displayName ?: file.name),
                        scope = req.scope,
                        phase = req.phase,
                        kind = req.kind,
                        elementId = req.elementId,
                        // fileName = שם-התצוגה האנושי; absPath = הקובץ-הייחודי-על-הדיסק.
                        fileName = displayName ?: file.name,
                        absPath = file.absolutePath,
                        takenAt = takenAt,
                        durationSec = durationSec,
                        bytes = bytes,
                    ),
                )
            }
        } else if (!success && file != null) {
            runCatching { file.delete() }
        }
        pendingFile = null
        pendingReq = null
        pendingDisplayName = null
    }

    fun launchCamera(req: VideoRequest) {
        scope.launch {
            val seq =
                if (req.scope == "project") repo.nextProjectVideoSeq(req.projectId, req.phase)
                else repo.nextVideoSeq(req.roomId, req.kind)
            // שם-התצוגה נשמר ב-DB; שם-הדיסק מקבל תחילית-הקשר-ייחודית (מונע דריסה רב-חדרית).
            val displayName = videoFileName(req.scope, req.kind, req.phase, seq)
            val diskName = uniqueDiskName(req.scope, req.roomId, req.wallId, req.projectId, displayName)
            pendingDisplayName = displayName
            val dir = File(context.filesDir, "videos").apply { mkdirs() }
            val file = File(dir, diskName)
            pendingFile = file
            val uri = FileProvider.getUriForFile(context, FILE_AUTHORITY, file)
            runCatching { captureVideo.launch(uri) }
                .onFailure { pendingFile = null; pendingReq = null; pendingDisplayName = null }
        }
    }

    val permLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val req = pendingReq
        pendingReq = null
        if (granted && req != null) launchCamera(req) else if (!granted) showPermDenied = true
    }

    if (showPermDenied) CameraPermissionDeniedDialog(
        onOpenSettings = { showPermDenied = false; openAppSettings(context) },
        onDismiss = { showPermDenied = false },
    )

    return { req ->
        pendingReq = req
        val hasCam = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        if (hasCam) launchCamera(req) else permLauncher.launch(Manifest.permission.CAMERA)
    }
}

// ── סקירת-סרטונים (קבוצה-D · HIGH — וידאו היה write-only) ──────────────────────

/**
 * רצועת-סקירת-סרטונים: ממוזערות (פריים-פוסטר) עם שם-קובץ, משך, ומחיקה — כדי שאפשר
 * לצפות/להחליף take-גרוע (הסרטונים חובה-לשער-הסגירה). מקבילה ל-`WallPhotoBar`/`PhotoThumb`.
 * מיועדת לשילוב בשורות-סגירת-החדר/הפרויקט. ריק ⇒ לא-מציגה דבר.
 */
@Composable
fun VideoReviewBar(videos: List<VideoEntity>, modifier: Modifier = Modifier) {
    if (videos.isEmpty()) return
    var editing by remember { mutableStateOf<VideoEntity?>(null) }
    Column(modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        Text("סרטונים שצולמו · הקש לצפייה/מחיקה", fontSize = 13.sp, color = Teal, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.padding(top = 4.dp))
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (v in videos) VideoThumb(v) { editing = v }
        }
    }
    editing?.let { v -> VideoReviewDialog(v, onDismiss = { editing = null }) }
}

/** ממוזערת-סרטון: פריים-פוסטר (MediaMetadataRetriever) + תג-משך; נופלת ל-🎥 בכשל-פענוח. */
@Composable
private fun VideoThumb(v: VideoEntity, onClick: () -> Unit) {
    val bmp by produceState<ImageBitmap?>(initialValue = null, v.absPath) {
        value = withContext(Dispatchers.IO) { posterFrame(v.absPath, 220)?.asImageBitmap() }
    }
    Box(
        Modifier.size(96.dp).background(Muted.copy(alpha = 0.15f), RoundedCornerShape(10.dp))
            .border(1.dp, Muted.copy(alpha = 0.35f), RoundedCornerShape(10.dp)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        val b = bmp
        if (b != null) {
            Image(b, contentDescription = v.fileName, modifier = Modifier.fillMaxWidth().size(96.dp), contentScale = ContentScale.Crop)
        } else {
            Text("🎥", fontSize = 22.sp)
        }
        // תג-משך בפינה (mm:ss)
        Box(Modifier.align(Alignment.BottomStart).padding(3.dp).background(Ink.copy(alpha = 0.6f), RoundedCornerShape(6.dp)).padding(horizontal = 5.dp, vertical = 1.dp)) {
            Text(fmtDuration(v.durationSec), color = Color.White, fontSize = 10.sp)
        }
    }
}

/** דו-שיח כיתוב/מחיקה לסרטון — מקביל ל-PhotoCaptionDialog. */
@Composable
private fun VideoReviewDialog(v: VideoEntity, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    var caption by remember { mutableStateOf(v.caption) }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = { scope.launch { repo.setVideoCaption(v.id, caption) }; onDismiss() }) {
                Text("שמור", color = Orange, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = { scope.launch { repo.deleteVideo(v) }; onDismiss() }) {
                Text("מחק סרטון", color = BlockRed)
            }
        },
        title = { Text(v.fileName, fontWeight = FontWeight.Bold, color = Ink, fontSize = 15.sp) },
        text = {
            Column {
                Text("${fmtDuration(v.durationSec)} · ${v.bytes / 1024 / 1024} MB", fontSize = 12.sp, color = Muted)
                Spacer(Modifier.padding(top = 6.dp))
                OutlinedTextField(
                    value = caption, onValueChange = { caption = it },
                    label = { Text("כיתוב (הערת-מודד)") }, singleLine = false,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        containerColor = Color.White,
    )
}

/** משך בשניות → "m:ss". */
private fun fmtDuration(sec: Int): String = "${sec / 60}:${(sec % 60).toString().padStart(2, '0')}"

/** פריים-פוסטר דגום (~maxPx) מהשנייה-הראשונה של הסרטון. נכשל-בשקט → null. */
private fun posterFrame(path: String, maxPx: Int): Bitmap? {
    val r = MediaMetadataRetriever()
    return runCatching {
        r.setDataSource(path)
        val frame = r.getFrameAtTime(0) ?: return@runCatching null
        val longEdge = maxOf(frame.width, frame.height)
        if (longEdge <= maxPx) frame else {
            val scale = maxPx.toFloat() / longEdge
            Bitmap.createScaledBitmap(frame, (frame.width * scale).toInt().coerceAtLeast(1), (frame.height * scale).toInt().coerceAtLeast(1), true)
                .also { if (it !== frame) frame.recycle() }
        }
    }.getOrNull().also { runCatching { r.release() } }
}

// ── עזרים ─────────────────────────────────────────────────────────────────────

/**
 * שם-קובץ מוסכם (§5.2): `{kindHe}_{NN}.mp4` (למשל `גישה_01.mp4`, `הסבר_01.mp4`);
 * מדיה-פרויקט עם-שלב (גישה) → `{kindHe}-{phaseHe}_{NN}.mp4` (למשל `גישה-פתיחה_01.mp4`).
 * הסבר-הפרויקט חסר-שלב (phase="") ⇒ נופל לתבנית-הפשוטה `{kindHe}_{NN}.mp4` (`הסבר_01.mp4`).
 */
private fun videoFileName(scope: String, kind: String, phase: String, seq: Int): String {
    val nn = seq.toString().padStart(2, '0')
    val kindHe = VIDEO_KINDS.firstOrNull { it.first == kind }?.second ?: kind
    return if (scope == "project" && phase.isNotBlank()) "$kindHe-${phaseLabel(phase)}_$nn.mp4"
    else "${kindHe}_$nn.mp4"
}

/** חילוץ-ה-seq משם-הקובץ (הבלוק האחרון של הספרות אחרי '_'). */
private fun seqFromName(name: String): Int =
    name.substringBeforeLast('.').substringAfterLast('_').toIntOrNull() ?: 1

/** קורא את משך-הסרטון בשניות (MediaMetadataRetriever). נכשל-בשקט → 0. */
private fun readDurationSec(file: File): Int {
    val r = MediaMetadataRetriever()
    return runCatching {
        r.setDataSource(file.absolutePath)
        val ms = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
        (ms / 1000L).toInt()
    }.getOrDefault(0).also { runCatching { r.release() } }
}
