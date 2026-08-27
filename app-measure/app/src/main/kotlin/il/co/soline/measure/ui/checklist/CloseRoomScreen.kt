package il.co.soline.measure.ui.checklist

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import android.widget.Toast
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import il.co.soline.measure.data.ProjectChecklist
import il.co.soline.measure.data.RoomChecklist
import il.co.soline.measure.data.RoomEntity
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.export.SolWriter
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.components.BigActionButton
import il.co.soline.measure.ui.components.BrandHeader
import il.co.soline.measure.ui.components.SolineButton
import il.co.soline.measure.ui.components.SolineCard
import il.co.soline.measure.ui.photo.PhotoRequest
import il.co.soline.measure.ui.photo.rememberPhotoCapture
import il.co.soline.measure.ui.video.VideoRequest
import il.co.soline.measure.ui.video.VideoReviewBar
import il.co.soline.measure.ui.video.rememberVideoCapture
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/* ─────────────────────────────────────────────────────────────────────────────
 *  CloseRoomScreen / CloseProjectScreen — שערי-סגירת-מדיה (PHOTO_FEATURE_DESIGN §5.3).
 *
 *  שער-קשיח-עם-מוצא: לא-ניתן לסגור עד שכל-קטגוריות-החובה בוצעו — אבל כל-שורה ניתנת
 *  ל"דלג עם-סיבה" (טקסט-חופשי) כדי לא-לתקוע מודד-בשטח. הספירות נגזרות-אוטומטית.
 * ───────────────────────────────────────────────────────────────────────────── */

private val repo get() = SolineApp.instance.repo

// ── סגירת-חדר ────────────────────────────────────────────────────────────────
@Composable
fun CloseRoomScreen(nav: NavController, roomId: Long) {
    val scope = rememberCoroutineScope()
    val room by repo.room(roomId).collectAsStateWithLifecycle(null)
    val walls by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    val photos by repo.photosInRoom(roomId).collectAsStateWithLifecycle(emptyList())
    val videos by repo.videosInRoom(roomId).collectAsStateWithLifecycle(emptyList())
    val photoCapture = rememberPhotoCapture()
    val videoCapture = rememberVideoCapture()
    var skipDialog by remember { mutableStateOf<RoomChecklist.Category?>(null) }

    val r = room
    val skips = RoomChecklist.parseSkips(r?.mediaSkips ?: "")
    val statuses = RoomChecklist.statuses(walls, photos, videos, skips)
    val gateOpen = RoomChecklist.gateOpen(statuses)
    val requiredTotal = statuses.count { it.category.required }
    val requiredDone = statuses.count { it.category.required && it.done }
    val closed = (r?.closedAt ?: 0) > 0

    // לכידה פר-קטגוריה. elevation → הקיר-הראשון שחסר-לו תמונת-חזית.
    fun capturePhoto(cat: RoomChecklist.Category) {
        if (cat.key == "elevation") {
            val target = walls.firstOrNull { w -> photos.none { it.wallId == w.id && (it.kind == "elevation" || it.kind == "context") } }
                ?: walls.firstOrNull() ?: return
            photoCapture(PhotoRequest(roomId, target.id, target.idx, "wall", null, "elevation"))
        } else {
            photoCapture(PhotoRequest(roomId, null, 0, "room", null, cat.key))
        }
    }
    fun captureVideo(cat: RoomChecklist.Category) =
        videoCapture(VideoRequest(roomId, null, 0, "room", null, cat.key))

    Column(Modifier.fillMaxSize().background(Cream)) {
        BrandHeader("סגירת חדר · ${r?.name ?: ""}", onBack = { nav.popBackStack() }, container = Teal, contentColor = Color.White)
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
            // פס-התקדמות (חובה בלבד)
            ProgressBlock(requiredDone, requiredTotal, gateOpen)
            Spacer(Modifier.height(12.dp))
            for (s in statuses) {
                ChecklistRow(
                    title = s.category.label,
                    required = s.category.required,
                    satisfied = s.satisfiedCount,
                    requiredCount = s.requiredCount,
                    done = s.done,
                    skippedReason = s.skippedReason,
                    showPhoto = s.category.capture != RoomChecklist.Capture.VIDEO,
                    showVideo = s.category.capture != RoomChecklist.Capture.PHOTO,
                    onPhoto = { capturePhoto(s.category) },
                    onVideo = { captureVideo(s.category) },
                    onSkip = { skipDialog = s.category },
                )
                Spacer(Modifier.height(8.dp))
            }
            // סקירת-סרטוני-החדר (קבוצה-D · וידאו לא-עוד write-only): צפייה/מחיקה/החלפה.
            if (videos.isNotEmpty()) {
                VideoReviewBar(videos)
                Spacer(Modifier.height(8.dp))
            }
            Spacer(Modifier.height(8.dp))
            if (closed) {
                Text("✓ החדר סומן כסגור", color = OkGreen, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(Modifier.height(8.dp))
                BigActionButton("פתח חדר מחדש", { scope.launch { repo.reopenRoom(roomId) } }, modifier = Modifier.fillMaxWidth(), container = Muted)
            } else {
                val label = if (gateOpen) "🔒  סגור חדר" else "השלם את משימות-החובה כדי לסגור"
                BigActionButton(label, { scope.launch { repo.closeRoom(roomId); nav.popBackStack() } }, modifier = Modifier.fillMaxWidth(), container = if (gateOpen) OkGreen else Muted, enabled = gateOpen)
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    skipDialog?.let { cat ->
        SkipDialog(
            title = cat.label,
            initial = skips[cat.key] ?: "",
            onSave = { reason -> scope.launch { repo.setRoomCategorySkip(roomId, cat.key, reason) }; skipDialog = null },
            onClear = { scope.launch { repo.setRoomCategorySkip(roomId, cat.key, null) }; skipDialog = null },
            onDismiss = { skipDialog = null },
        )
    }
}

// ── סגירת-פרויקט ─────────────────────────────────────────────────────────────
@Composable
fun CloseProjectScreen(nav: NavController, projectId: Long) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val project by repo.project(projectId).collectAsStateWithLifecycle(null)
    val rooms by repo.rooms(projectId).collectAsStateWithLifecycle(emptyList())
    val projPhotos by repo.projectPhotos(projectId).collectAsStateWithLifecycle(emptyList())
    val projVideos by repo.projectVideos(projectId).collectAsStateWithLifecycle(emptyList())
    val photoCapture = rememberPhotoCapture()
    val videoCapture = rememberVideoCapture()

    // חדרים-שטרם-הושלמו (שער-החדר עדיין-סגור) — לרשימת-"נותרו" עם מעבר-מהיר לכל closeroom.
    var incomplete by remember { mutableStateOf<List<RoomEntity>>(emptyList()) }
    // מחשב-מחדש בכל-שינוי בחדרים/מדיה (תלות ב-rooms מספיקה כטריגר-רענון גס).
    LaunchedEffect(rooms, projPhotos, projVideos) { incomplete = repo.incompleteRooms(projectId) }
    val allRoomsComplete = rooms.isNotEmpty() && incomplete.isEmpty()

    val accStatuses = ProjectChecklist.accessStatuses(projPhotos, projVideos)
    val explainer = ProjectChecklist.explainerStatus(projVideos)
    val gate = ProjectChecklist.gateOpen(accStatuses, explainer, allRoomsComplete)
    // סה"כ-משימות-הפרויקט: שתי-הגישות + הסבר (אחד-או-יותר) — כולן חובה לשער.
    val projDone = accStatuses.count { it.done } + if (explainer.done) 1 else 0
    val projTotal = accStatuses.size + 1
    val closed = (project?.closedAt ?: 0L) > 0L

    // ── ייצוא-ה-.sol בפועל (מקביל ל-runExport ב-ProjectRoomsScreen): בנייה על IO ואז שיתוף.
    val runExport: () -> Unit = {
        project?.let { p ->
            scope.launch {
                try {
                    val f = withContext(Dispatchers.IO) {
                        val dir = java.io.File(context.filesDir, "exports").apply { mkdirs() }
                        val file = java.io.File(dir, SolWriter.fileName(p))
                        file.outputStream().use { repo.exportSol(p, it) }
                        file
                    }
                    repo.markProjectExported(p.id)
                    val uri = FileProvider.getUriForFile(context, "il.co.soline.measure.fileprovider", f)
                    val send = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                        type = "application/octet-stream"
                        putExtra(android.content.Intent.EXTRA_STREAM, uri)
                        addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    context.startActivity(android.content.Intent.createChooser(send, "ייצוא .sol לממיר"))
                } catch (e: Exception) {
                    Toast.makeText(context, "שגיאת ייצוא: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    Column(Modifier.fillMaxSize().background(Cream)) {
        BrandHeader("סגירת פרויקט · ${project?.name ?: ""}", onBack = { nav.popBackStack() }, container = Teal, contentColor = Color.White)
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
            ProgressBlock(projDone, projTotal, gate, label = "מדיית-פרויקט")
            Spacer(Modifier.height(12.dp))
            for (s in accStatuses) {
                ChecklistRow(
                    title = s.item.label,
                    required = true,
                    satisfied = s.count,
                    requiredCount = 1,
                    done = s.done,
                    skippedReason = null,
                    showPhoto = true,
                    showVideo = true,
                    onPhoto = { photoCapture(PhotoRequest(0, null, 0, "project", null, "access", projectId = projectId, phase = s.item.phase)) },
                    onVideo = { videoCapture(VideoRequest(0, null, 0, "project", null, "access", projectId = projectId, phase = s.item.phase)) },
                    onSkip = null,
                )
                Spacer(Modifier.height(8.dp))
            }
            // סרטון-הסבר על-העבודה — ברמת-הפרויקט, אחד-או-יותר (בלי-שלב). כפתור-הצילום
            // ניתן-ללחיצה חוזרת כדי להוסיף עוד-סרטונים; requiredCount=1 (שער נפתח ב-count≥1).
            ChecklistRow(
                title = ProjectChecklist.EXPLAINER_LABEL,
                required = true,
                satisfied = explainer.count,
                requiredCount = 1,
                done = explainer.done,
                skippedReason = null,
                showPhoto = false,
                showVideo = true,
                onPhoto = {},
                onVideo = { videoCapture(VideoRequest(0, null, 0, "project", null, ProjectChecklist.EXPLAINER_KIND, projectId = projectId, phase = "")) },
                onSkip = null,
            )
            Spacer(Modifier.height(8.dp))
            // סקירת-סרטוני-הפרויקט (גישה/הסבר) — צפייה/מחיקה/החלפה (קבוצה-D).
            if (projVideos.isNotEmpty()) {
                VideoReviewBar(projVideos)
                Spacer(Modifier.height(8.dp))
            }
            // סיכום-החדרים — תווית מותנית + רשימת-החדרים-שנותרו עם מעבר-מהיר (קבוצה-D · תיקון-5).
            SolineCard {
                Column(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (allRoomsComplete) "✓" else "✗", color = if (allRoomsComplete) OkGreen else BlockRed, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                if (allRoomsComplete) "כל החדרים הושלמו" else "לא כל החדרים הושלמו · ${incomplete.size} נותרו",
                                color = Ink, fontWeight = FontWeight.SemiBold, fontSize = 15.sp,
                            )
                            Text("${rooms.size} חדרים בפרויקט", color = Muted, fontSize = 12.sp)
                        }
                    }
                    // רשימת-החדרים-שטרם-הושלמו — הקשה מנווטת ישירות לשער-סגירת-אותו-חדר.
                    if (incomplete.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        for (r in incomplete) {
                            Row(
                                Modifier.fillMaxWidth().clickable { nav.navigate("closeroom/${r.id}") }.padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text("↺", color = Orange, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                Spacer(Modifier.width(8.dp))
                                Text(r.name, color = Ink, fontSize = 14.sp, modifier = Modifier.weight(1f))
                                Text("סגור חדר ›", color = Teal, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
            // ── כפתור-הסגירה: לא-עוד no-op (תיקון-1). סוגר-בפועל (repo.closeProject) ומציע ייצוא. ──
            if (closed) {
                Text("✓ הפרויקט סגור — מוכן לייצוא", color = OkGreen, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Spacer(Modifier.height(10.dp))
                BigActionButton("⬇  ייצא .sol לממיר", { runExport() }, modifier = Modifier.fillMaxWidth(), container = Teal)
                Spacer(Modifier.height(8.dp))
                BigActionButton("פתח פרויקט מחדש", { scope.launch { repo.reopenProject(projectId) } }, modifier = Modifier.fillMaxWidth(), container = Muted)
            } else {
                val label = if (gate) "🔒  סגור פרויקט" else "השלם גישה + הסבר + כל-החדרים כדי לסגור"
                BigActionButton(
                    label,
                    {
                        scope.launch {
                            repo.closeProject(projectId)
                            Toast.makeText(context, "הפרויקט נסגר — אפשר לייצא .sol לממיר", Toast.LENGTH_LONG).show()
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    container = if (gate) OkGreen else Muted,
                    enabled = gate,
                )
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

// ── רכיבים-משותפים ────────────────────────────────────────────────────────────

@Composable
private fun ProgressBlock(done: Int, total: Int, open: Boolean, label: String = "משימות-חובה") {
    val frac = if (total <= 0) 0f else done.toFloat() / total
    Column {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, color = Ink, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text("$done/$total", color = if (open) OkGreen else Orange, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        }
        Spacer(Modifier.height(6.dp))
        LinearProgressIndicator(
            progress = { frac },
            modifier = Modifier.fillMaxWidth().height(8.dp),
            color = if (open) OkGreen else Orange,
            trackColor = Muted.copy(alpha = 0.2f),
        )
    }
}

@Composable
private fun ChecklistRow(
    title: String,
    required: Boolean,
    satisfied: Int,
    requiredCount: Int,
    done: Boolean,
    skippedReason: String?,
    showPhoto: Boolean,
    showVideo: Boolean,
    onPhoto: () -> Unit,
    onVideo: () -> Unit,
    onSkip: (() -> Unit)?,
) {
    SolineCard {
        Column(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(if (done) "✓" else "✗", color = if (done) OkGreen else BlockRed, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Row {
                        Text(title, color = Ink, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                        if (!required) { Spacer(Modifier.width(6.dp)); Text("(מומלץ)", color = Muted, fontSize = 12.sp) }
                    }
                    Text("$satisfied/$requiredCount", color = Muted, fontSize = 12.sp)
                    skippedReason?.let { Text("דולג: $it", color = Orange, fontSize = 12.sp) }
                }
            }
            Spacer(Modifier.height(8.dp))
            // צילום/סרטון בשורה אחת; "דלג" בשורה נפרדת (יעד-מגע ≥52dp, לא-צפוף בכפפות).
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (showPhoto) SolineButton("📷 צלם", onPhoto, modifier = Modifier.weight(1f), accent = Orange)
                if (showVideo) SolineButton("🎥 סרטון", onVideo, modifier = Modifier.weight(1f), accent = Teal)
            }
            if (onSkip != null) {
                Spacer(Modifier.height(8.dp))
                SolineButton("דלג", onSkip, modifier = Modifier.fillMaxWidth(), accent = Muted)
            }
        }
    }
}

@Composable
private fun SkipDialog(
    title: String,
    initial: String,
    onSave: (String) -> Unit,
    onClear: () -> Unit,
    onDismiss: () -> Unit,
) {
    var reason by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = { if (reason.isNotBlank()) onSave(reason) }) {
                Text("שמור דילוג", color = Orange, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onClear) { Text("בטל דילוג", color = Muted) }
        },
        title = { Text("דלג עם סיבה · $title", fontWeight = FontWeight.Bold, color = Ink, fontSize = 15.sp) },
        text = {
            OutlinedTextField(
                value = reason, onValueChange = { reason = it },
                label = { Text("סיבה (חובה כדי לדלג)") }, singleLine = false,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        containerColor = Color.White,
    )
}
