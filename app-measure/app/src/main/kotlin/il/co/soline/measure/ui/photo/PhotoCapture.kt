package il.co.soline.measure.ui.photo

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.provider.Settings
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import il.co.soline.measure.data.PhotoEntity
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.components.BigActionButton
import il.co.soline.measure.ui.video.VIDEO_KINDS
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.time.Instant
import java.time.format.DateTimeFormatter

/* ─────────────────────────────────────────────────────────────────────────────
 *  PhotoCapture — צילום-תמונות-שדה פר-חזית (פיצ'ר-תמונות · PHOTO_FEATURE_DESIGN).
 *
 *  זרימה: כפתור "📷 צלם חזית" → הרשאת-CAMERA (בקשת-runtime) → ACTION_IMAGE_CAPTURE
 *  דרך ה-FileProvider הקיים, כותב ל-filesDir/photos/ → בחזרה: נרמול-EXIF, דחיסה
 *  ל-JPEG(~85), קריאת-מידות/גודל, מספור-אוטומטי `seq` פר-קיר, ושמירת [PhotoEntity].
 *  אין-פלטפורמה-חדשה: מיישר-קו עם דפוס-ההרשאות של DevicesScreen ו-FileProvider של הגיבוי.
 * ───────────────────────────────────────────────────────────────────────────── */

/** authority של ה-FileProvider (כבר רשום ב-AndroidManifest). */
private const val FILE_AUTHORITY = "il.co.soline.measure.fileprovider"

/**
 * סוגי-התמונה (kind) + תוויות-עברית — בורר-מהיר בזמן-הצילום. הורחב לקבוצת-§5.1
 * (רשימת-משימות-המדיה): overview/elevation/detail_tape/far/closeup + הקטגוריות-הישנות.
 * `access` נלכד ברמת-הפרויקט (לא-כאן); `explainer` הוא וידאו (ראה VIDEO_KINDS).
 */
val PHOTO_KINDS: List<Pair<String, String>> = listOf(
    "overview" to "כללי",
    "elevation" to "חזית",
    "detail_tape" to "פרט + מטר",
    "far" to "רחוק",
    "closeup" to "תקריב",
    "obstacle" to "מכשול",
    "junction" to "מפגש",
    "ceiling" to "תקרה",
    "floor" to "רצפה",
    "context" to "הקשר",
)

/** תווית-עברית ל-kind (כולל וידאו + ערכים-ישנים; נופל לערך-הגלמי אם לא-מוכר). */
fun kindLabel(kind: String): String =
    (PHOTO_KINDS + VIDEO_KINDS + ("detail" to "תקריב")).firstOrNull { it.first == kind }?.second ?: kind

private val repo get() = SolineApp.instance.repo

/**
 * בקשת-צילום: כל ההקשר לשם-הקובץ ולרשומה. scope="wall" (חזית) · "room" (חדר) ·
 * "element" (מוצמד-לאלמנט · `elementId`). `wallIdx` 0-based (לשם-הקובץ 1-based).
 */
data class PhotoRequest(
    val roomId: Long,
    val wallId: Long?,
    val wallIdx: Int,
    val scope: String,
    val elementId: Long?,
    val kind: String,
    val projectId: Long = 0,   // scope="project" ⇒ מדיה-ברמת-הפרויקט (גישה-לאתר)
    val phase: String = "",    // scope="project" ⇒ opening | closing
)

/**
 * רושם את משגרי-ה-Activity-Result (מצלמה + הרשאה) ומחזיר טריגר-צילום.
 * הקריאה חייבת להיות ברמת-ה-composable (לא בתוך lambda/dialog). הטריגר בטוח-לקריאה
 * חוזרת: כל בקשה נושאת את הקשרה-שלה.
 */
@Composable
fun rememberPhotoCapture(): (PhotoRequest) -> Unit {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pendingReq by remember { mutableStateOf<PhotoRequest?>(null) }
    var pendingFile by remember { mutableStateOf<File?>(null) }
    // שם-התצוגה האנושי (`חזית-N_NN.jpg`) — נשמר ב-`fileName` (חוזה-ה-.sol), בנפרד
    // משם-הקובץ-על-הדיסק שהוא ייחודי (r/w/p-prefixed · מונע דריסה רב-חדרית).
    var pendingDisplayName by remember { mutableStateOf<String?>(null) }
    // מניעת-הרשאה (קבוצה-D · HIGH): במקום זניחה-בשקט → דיאלוג-הסבר + "פתח הגדרות".
    var showPermDenied by remember { mutableStateOf(false) }

    // המצלמה החזירה: אם הצליחה — נרמל/דחוס/מדוד ושמור [PhotoEntity].
    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val file = pendingFile
        val req = pendingReq
        val displayName = pendingDisplayName
        if (success && file != null && req != null) {
            scope.launch {
                val (w, h) = withContext(Dispatchers.IO) { normalizeAndCompress(file) }
                val bytes = file.length()
                val takenAt = DateTimeFormatter.ISO_INSTANT.format(Instant.now())
                repo.addPhoto(
                    PhotoEntity(
                        projectId = req.projectId,
                        roomId = if (req.scope == "project") null else req.roomId,
                        wallId = req.wallId,
                        seq = seqFromName(displayName ?: file.name),
                        scope = req.scope,
                        phase = req.phase,
                        kind = req.kind,
                        elementId = req.elementId,
                        // fileName = שם-התצוגה האנושי (נשמר כפי-שהיה · חוזה-ה-.sol);
                        // absPath = נתיב-הקובץ-הייחודי-על-הדיסק (מקור-האמת למיקום).
                        fileName = displayName ?: file.name,
                        absPath = file.absolutePath,
                        takenAt = takenAt,
                        w = w, h = h, bytes = bytes,
                    ),
                )
            }
        } else if (!success && file != null) {
            // בוטל/נכשל — לא-מותירים קובץ-ריק יתום.
            runCatching { file.delete() }
        }
        pendingFile = null
        pendingReq = null
        pendingDisplayName = null
    }

    // בונה את קובץ-היעד (עם seq-אוטומטי) ומשגר את המצלמה. רץ ב-Main (משגר-Activity).
    fun launchCamera(req: PhotoRequest) {
        scope.launch {
            val seq = when {
                req.scope == "project" -> repo.nextProjectPhotoSeq(req.projectId, req.phase)
                req.scope == "room" || req.wallId == null -> repo.nextRoomPhotoSeq(req.roomId)
                else -> repo.nextWallPhotoSeq(req.wallId)
            }
            // שם-התצוגה האנושי (למשל `חזית-1_01.jpg`) נשמר ב-DB כ-fileName;
            // שם-הקובץ-על-הדיסק מקבל תחילית-ייחודית (חדר/קיר/פרויקט) כדי שתמונת
            // חדר-A לא תדרוס תמונת חדר-B בעלת אותו שם-תצוגה (התנגשות-שמות-מדיה).
            val displayName = photoFileName(req.scope, req.wallIdx, seq, req.kind, req.phase)
            val diskName = uniqueDiskName(req.scope, req.roomId, req.wallId, req.projectId, displayName)
            pendingDisplayName = displayName
            val dir = File(context.filesDir, "photos").apply { mkdirs() }
            val file = File(dir, diskName)
            pendingFile = file
            val uri = FileProvider.getUriForFile(context, FILE_AUTHORITY, file)
            runCatching { takePicture.launch(uri) }
                .onFailure { pendingFile = null; pendingReq = null; pendingDisplayName = null }
        }
    }

    // הרשאת-CAMERA: אם ניתנה → מצלמים; אם נמנעה → דיאלוג-הסבר (לא-זניחה-בשקט).
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

/**
 * רצועת-תמונות פר-חזית: כפתור "📷 צלם חזית", בורר-kind מהיר, ורשימת-ממוזערות
 * (הקשה → כיתוב/מחיקה). משמש בעורך-הקיר. `wallIdx` 0-based (לשם-הקובץ 1-based).
 */
@Composable
fun WallPhotoBar(roomId: Long, wallId: Long, wallIdx: Int, modifier: Modifier = Modifier) {
    val capture = rememberPhotoCapture()
    val photos by repo.photos(wallId).collectAsStateWithLifecycle(emptyList())
    var kind by remember { mutableStateOf("context") }
    PhotoBarBody(
        title = "תמונות · חזית ${wallIdx + 1}",
        photos = photos,
        kind = kind,
        onKind = { kind = it },
        onCapture = {
            capture(PhotoRequest(roomId, wallId, wallIdx, scope = "wall", elementId = null, kind = kind))
        },
        modifier = modifier,
    )
}

/** גוף-הרצועה (מופרד לצורך שימוש-חוזר): כותרת + כפתור-צילום + בורר-kind + ממוזערות. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PhotoBarBody(
    title: String,
    photos: List<PhotoEntity>,
    kind: String,
    onKind: (String) -> Unit,
    onCapture: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var editing by remember { mutableStateOf<PhotoEntity?>(null) }
    Column(modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        Text(title, fontSize = 13.sp, color = Teal, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.padding(top = 2.dp))
        // בורר-kind מהיר (§4) — מסדר את הגלריה בדוח לפי-משמעות. FlowRow (במקום גלילה-אופקית)
        // כדי שכל הקטגוריות (רצפה/תקרה/מפגש…) גלויות ולא-נסתרות מעבר-לקצה (אפורדנס-גילוי · תיקון-4).
        FlowRow(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            for ((key, label) in PHOTO_KINDS) KindChip(label, key == kind) { onKind(key) }
        }
        Spacer(Modifier.padding(top = 4.dp))
        BigActionButton("📷  צלם חזית · ${kindLabel(kind)}", onCapture, modifier = Modifier.fillMaxWidth())
        if (photos.isNotEmpty()) {
            Spacer(Modifier.padding(top = 6.dp))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (p in photos) PhotoThumb(p) { editing = p }
            }
        }
    }
    editing?.let { p ->
        PhotoCaptionDialog(p, onDismiss = { editing = null })
    }
}

/** צ'יפ-בחירת-kind. */
@Composable
private fun KindChip(label: String, on: Boolean, onClick: () -> Unit) {
    val bg = if (on) Teal else Color.White
    val fg = if (on) Color.White else Ink
    Box(
        Modifier.background(bg, RoundedCornerShape(10.dp))
            .border(1.dp, if (on) Teal else Muted.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 7.dp),
    ) { Text(label, color = fg, fontSize = 13.sp, fontWeight = FontWeight.SemiBold) }
}

/** ממוזערת-תמונה (טעינה-עצלה מנתיב-הקובץ, דגומה-ל-~200px). */
@Composable
private fun PhotoThumb(p: PhotoEntity, onClick: () -> Unit) {
    val bmp by produceState<ImageBitmap?>(initialValue = null, p.absPath) {
        value = withContext(Dispatchers.IO) { decodeThumb(p.absPath, 220)?.asImageBitmap() }
    }
    Box(
        Modifier.size(96.dp).background(Muted.copy(alpha = 0.15f), RoundedCornerShape(10.dp))
            .border(1.dp, Muted.copy(alpha = 0.35f), RoundedCornerShape(10.dp)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        val b = bmp
        if (b != null) {
            Image(b, contentDescription = p.fileName, modifier = Modifier.fillMaxWidth().size(96.dp), contentScale = ContentScale.Crop)
        } else {
            Text("📷", fontSize = 22.sp)
        }
        // תג-מספר-עוקב בפינה
        Box(Modifier.align(Alignment.BottomStart).padding(3.dp).background(Ink.copy(alpha = 0.6f), RoundedCornerShape(6.dp)).padding(horizontal = 5.dp, vertical = 1.dp)) {
            Text("${p.seq}", color = Color.White, fontSize = 10.sp)
        }
    }
}

/** דו-שיח כיתוב/מחיקה לתמונה. */
@Composable
private fun PhotoCaptionDialog(p: PhotoEntity, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    var caption by remember { mutableStateOf(p.caption) }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = { scope.launch { repo.setPhotoCaption(p.id, caption) }; onDismiss() }) {
                Text("שמור", color = Orange, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = { scope.launch { repo.deletePhoto(p) }; onDismiss() }) {
                Text("מחק תמונה", color = BlockRed)
            }
        },
        title = { Text(p.fileName, fontWeight = FontWeight.Bold, color = Ink, fontSize = 15.sp) },
        text = {
            Column {
                Text("${kindLabel(p.kind)} · ${p.w}×${p.h} · ${p.bytes / 1024} KB", fontSize = 12.sp, color = Muted)
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

// ── מניעת-הרשאת-מצלמה (משותף לתמונה+וידאו · קבוצה-D) ───────────────────────────

/**
 * דיאלוג-הסבר בעברית כשהרשאת-המצלמה נמנעה — במקום כפתור-מת שנזנח-בשקט. מציע
 * "פתח הגדרות" (למניעה-קבועה) ו"סגור". משותף ל-PhotoCapture ו-VideoCapture.
 */
@Composable
fun CameraPermissionDeniedDialog(onOpenSettings: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = onOpenSettings) { Text("פתח הגדרות", color = Orange, fontWeight = FontWeight.Bold) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("סגור", color = Muted) }
        },
        title = { Text("נדרשת הרשאת-מצלמה", fontWeight = FontWeight.Bold, color = Ink, fontSize = 15.sp) },
        text = {
            Text(
                "כדי לצלם תמונות וסרטונים באתר יש לאשר גישה למצלמה. אם ההרשאה נמנעה לצמיתות, " +
                    "אפשר לאשר אותה ידנית דרך הגדרות-האפליקציה.",
                color = Ink, fontSize = 14.sp,
            )
        },
        containerColor = Color.White,
    )
}

/** פותח את מסך-הגדרות-האפליקציה (למתן-הרשאה ידני לאחר מניעה-קבועה). נכשל-בשקט. */
fun openAppSettings(context: Context) {
    runCatching {
        context.startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }.onFailure {
        Toast.makeText(context, "לא-ניתן לפתוח הגדרות — אשר הרשאת-מצלמה ידנית", Toast.LENGTH_LONG).show()
    }
}

// ── עיבוד-תמונה (עזרים · off-main) ────────────────────────────────────────────

/**
 * שם-קובץ מוסכם (§2.1): `חזית-{idx+1}_{NN}.jpg`; חדר → `חדר_{NN}.jpg`;
 * מדיה-פרויקט (גישה) → `{kindHe}-{phaseHe}_{NN}.jpg` (למשל `גישה-פתיחה_01.jpg`).
 */
private fun photoFileName(scope: String, wallIdx: Int, seq: Int, kind: String, phase: String): String {
    val nn = seq.toString().padStart(2, '0')
    return when (scope) {
        "project" -> "${kindLabel(kind)}-${phaseLabel(phase)}_$nn.jpg"
        "room" -> "חדר_$nn.jpg"
        else -> "חזית-${wallIdx + 1}_$nn.jpg"
    }
}

/**
 * שם-הקובץ-הייחודי-על-הדיסק (תיקון-התנגשות-שמות-מדיה · קבוצה-A בביקורת). שם-התצוגה
 * (`חזית-N_NN.jpg`) מתאפס פר-חדר/קיר/שלב, לכן בפרויקט רב-חדרי הוא מתנגש והתמונה נדרסת
 * בשקט. כאן מוסיפים תחילית-הקשר-ייחודית לפני שם-התצוגה — כך שכל לכידה מקבלת קובץ נפרד:
 *  · project → `p{projectId}_...`   · wall → `r{roomId}w{wallId}_...`   · room → `r{roomId}_...`.
 * שם-התצוגה עצמו (`fileName` ב-DB / `name` ב-.sol) נשמר כפי-שהיה — רק הדיסק ייחודי.
 */
fun uniqueDiskName(scope: String, roomId: Long, wallId: Long?, projectId: Long, displayName: String): String {
    val prefix = when {
        scope == "project" -> "p${projectId}_"
        wallId != null -> "r${roomId}w${wallId}_"
        else -> "r${roomId}_"
    }
    return prefix + displayName
}

/** תווית-עברית לשלב-הפרויקט (opening/closing). */
fun phaseLabel(phase: String): String = when (phase) {
    "opening" -> "פתיחה"
    "closing" -> "סגירה"
    else -> phase
}

/** חילוץ-ה-seq משם-הקובץ (הבלוק האחרון של הספרות אחרי '_'). */
private fun seqFromName(name: String): Int {
    val base = name.substringBeforeLast('.')
    return base.substringAfterLast('_').toIntOrNull() ?: 1
}

/** צלע-מרבית (פיקסלים) לתמונת-שדה — מגבילה את זיכרון-השיא בפענוח+סיבוב. */
private const val MAX_PHOTO_EDGE_PX = 2048

/**
 * נרמול-EXIF (סיבוב/היפוך לפי TAG_ORIENTATION) + דחיסה ל-JPEG(85) **במקום** (overwrite).
 * מחזיר [רוחב, גובה] בפיקסלים לאחר-הנרמול. נכשל-בשקט → [0,0] (הרשומה עדיין נשמרת).
 *
 * **הגנת-זיכרון (קבוצה-E בביקורת):** במקום לפענח את התמונה במלוא-רזולוציית-המצלמה
 * (~48MB) ואז להקצות עותק-מסובב שני (=OOM אחרי-צילום), מפענחים תחילה עם `inSampleSize`
 * שמצמצם את הצלע-הארוכה ל-≤[MAX_PHOTO_EDGE_PX], ומשחררים (`recycle`) את המקור מיד לאחר
 * יצירת-המסובב — כך שאף-פעם לא מוחזקים שני bitmaps מלאים בו-זמנית.
 */
private fun normalizeAndCompress(file: File): IntArray {
    val path = file.absolutePath
    // 1. מודדים מידות בלי-לפענח (inJustDecodeBounds) → בוחרים inSampleSize (חזקות-2).
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    if (bounds.outWidth <= 0) return intArrayOf(0, 0)
    var sample = 1
    val longEdge = maxOf(bounds.outWidth, bounds.outHeight)
    while (longEdge / sample > MAX_PHOTO_EDGE_PX) sample *= 2
    val opts = BitmapFactory.Options().apply { inSampleSize = sample }
    var bmp: Bitmap = BitmapFactory.decodeFile(path, opts) ?: return intArrayOf(0, 0)
    // 2. אוריינטציה מ-EXIF → מטריצת-סיבוב/היפוך.
    val orientation = runCatching {
        ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
    val m = Matrix()
    when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> m.postRotate(90f)
        ExifInterface.ORIENTATION_ROTATE_180 -> m.postRotate(180f)
        ExifInterface.ORIENTATION_ROTATE_270 -> m.postRotate(270f)
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.postScale(-1f, 1f)
        ExifInterface.ORIENTATION_FLIP_VERTICAL -> m.postScale(1f, -1f)
    }
    if (!m.isIdentity) {
        // יוצרים את המסובב, ואז משחררים את המקור מיד (לא מחזיקים שניים במקביל).
        val rotated = runCatching { Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true) }.getOrNull()
        if (rotated != null && rotated !== bmp) {
            bmp.recycle()
            bmp = rotated
        }
    }
    runCatching { FileOutputStream(file).use { bmp.compress(Bitmap.CompressFormat.JPEG, 85, it) } }
    val w = bmp.width; val h = bmp.height
    bmp.recycle()
    return intArrayOf(w, h)
}

/** מפענח ממוזערת דגומה (inSampleSize) עד ~[maxPx] פיקסלים לצלע-הארוכה. */
private fun decodeThumb(path: String, maxPx: Int): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    if (bounds.outWidth <= 0) return null
    var sample = 1
    val longEdge = maxOf(bounds.outWidth, bounds.outHeight)
    while (longEdge / sample > maxPx) sample *= 2
    val opts = BitmapFactory.Options().apply { inSampleSize = sample }
    return BitmapFactory.decodeFile(path, opts)
}
