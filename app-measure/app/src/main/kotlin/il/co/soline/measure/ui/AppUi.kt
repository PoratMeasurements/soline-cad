package il.co.soline.measure.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.collectAsState
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import il.co.soline.measure.ui.tools.ToolsFab
import il.co.soline.measure.data.AccType
import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.CabinetEntity
import il.co.soline.measure.data.JobEntity
import il.co.soline.measure.data.LevelSurface
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.RoomSurvey
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.geometry.WallHeadProfile
import il.co.soline.measure.fit.FitDelta
import il.co.soline.measure.fit.Severity
import il.co.soline.measure.ui.draw.LiveCadScreen
import il.co.soline.measure.ui.draw.SketchInjectHost
import il.co.soline.measure.ui.measure.MeasureCaptureScreen
import il.co.soline.measure.ui.view3d.Room3DView
import il.co.soline.measure.ui.cad.CadDimensionEditor
import il.co.soline.measure.ui.elevation.WallElevationUnified
import il.co.soline.measure.ui.elevation.AccessoryEditor
import il.co.soline.measure.ui.elevation.laserHeightMm
import il.co.soline.measure.ui.home.HomeScreen
import il.co.soline.measure.ui.settings.SettingsScreen
import il.co.soline.measure.ui.consent.LocationConsentScreen
import il.co.soline.measure.ui.activity.MyActivityScreen
import il.co.soline.measure.ui.shape.WallShapeCapture
import il.co.soline.measure.ui.template.RoomTemplateWizard
import il.co.soline.measure.ui.wallhead.WallHeadStyleScreen
import il.co.soline.measure.ui.cad.symbols.CadSymbolPalette
import il.co.soline.measure.ui.cabinet.CabinetScreen
import il.co.soline.measure.ui.semiauto.SemiAutoOutlineScreen
import il.co.soline.measure.ui.verify.VerificationScreen
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin
import il.co.soline.measure.ui.intake.JobIntakeScreen
import il.co.soline.measure.ui.level.LevelSurveyScreen
import il.co.soline.measure.ui.capture.ElementPickerSheet
import il.co.soline.measure.ui.fields.ElementMeasureFields
import il.co.soline.measure.ui.photo.WallPhotoBar
import il.co.soline.measure.ui.photo.rememberPhotoCapture
import il.co.soline.measure.ui.photo.PhotoRequest
import il.co.soline.measure.ui.fields.OpeningMeasureFields
import il.co.soline.measure.ui.fields.OpeningResult
import il.co.soline.measure.ui.library.ElementLibraryScreen
import il.co.soline.measure.ui.p2p.P2PMeasureScreen
import il.co.soline.measure.ui.schedule.ScheduleScreen
import il.co.soline.measure.ui.measurements.MeasurementsScreen
import il.co.soline.measure.catalog.ElementDef
import android.widget.Toast
import androidx.compose.ui.platform.LocalContext
import il.co.soline.measure.export.SolWriter
import kotlinx.coroutines.launch

private val repo get() = SolineApp.instance.repo

/** קריאת ארגומנט-Long בטוחה מ-route (P0-2: לא קורס על ארגומנט חסר/פגום). */
private fun androidx.navigation.NavBackStackEntry.longArg(key: String): Long? =
    arguments?.getString(key)?.toLongOrNull()

/** מפת-אביזרים-לקיר תגובתית (P1-3): מתעדכנת חיה על כל שינוי-אביזר, לא רק על שינוי-קיר. */
@Composable
private fun rememberAccessoriesByWall(walls: List<WallEntity>): Map<Long, List<AccessoryEntity>> {
    val ids = walls.map { it.id }
    val flow = remember(ids) {
        if (ids.isEmpty()) kotlinx.coroutines.flow.flowOf(emptyList<List<AccessoryEntity>>())
        else kotlinx.coroutines.flow.combine(ids.map { repo.accessories(it) }) { it.toList() }
    }
    val lists by flow.collectAsStateWithLifecycle(emptyList())
    return ids.mapIndexedNotNull { i, id -> lists.getOrNull(i)?.let { id to it } }.toMap()
}

@Composable
fun SolineRoot() {
    SolineTheme {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            val nav = rememberNavController()
            // ה-route הנוכחי + ארגומנטים (לזיהוי "המסך הנוכחי" עבור מדווח-הבאגים)
            val backEntry by nav.currentBackStackEntryAsState()
            val curRoute = backEntry?.destination?.route
            val curArgs = backEntry?.arguments
            val curPid = curArgs?.getString("pid")?.toLongOrNull()
            val curRid = curArgs?.getString("rid")?.toLongOrNull()
            // כל-האפליקציה עטופה ב-Box כדי לארח כפתור-דיווח-צף מעל כל מסך
            Box(Modifier.fillMaxSize()) {
            NavHost(nav, startDestination = "projects") {
                composable("projects") { HomeScreen(nav) }
                composable("devices") { DevicesScreen(nav) }
                composable("settings") {
                    SettingsScreen(
                        onBack = { nav.popBackStack() },
                        onOpenConsent = { nav.navigate("consent") },
                        onOpenMyActivity = { nav.navigate("myactivity") },
                    )
                }
                composable("consent") {
                    LocationConsentScreen(
                        onBack = { nav.popBackStack() },
                        onConsented = { nav.popBackStack() },
                    )
                }
                composable("myactivity") {
                    MyActivityScreen(
                        onBack = { nav.popBackStack() },
                        onManageSharing = { nav.navigate("settings") },
                    )
                }
                composable("shape/{wid}") { e -> e.longArg("wid")?.let { ShapeHost(nav, it) } }
                composable("rooms/{pid}") { e -> e.longArg("pid")?.let { ProjectRoomsScreen(nav, it) } }
                composable("room/{rid}") { e -> e.longArg("rid")?.let { RoomScreen(nav, it) } }
                composable("closeroom/{rid}") { e -> e.longArg("rid")?.let { il.co.soline.measure.ui.checklist.CloseRoomScreen(nav, it) } }
                composable("closeproject/{pid}") { e -> e.longArg("pid")?.let { il.co.soline.measure.ui.checklist.CloseProjectScreen(nav, it) } }
                composable("draw/{rid}") { e -> e.longArg("rid")?.let { DrawScreenHost(nav, it) } }
                composable("sketch/{rid}") { e -> e.longArg("rid")?.let { SketchInjectHost(nav, it) } }
                composable("measure/{rid}") { e -> e.longArg("rid")?.let { MeasureHost(nav, it) } }
                composable("unified/{rid}") { e -> e.longArg("rid")?.let { il.co.soline.measure.ui.unified.UnifiedMeasureHost(nav, it) } }
                composable("measurestart/{rid}") { e -> e.longArg("rid")?.let { MeasureStartHost(nav, it) } }
                composable("view3d/{rid}") { e -> e.longArg("rid")?.let { Room3DHost(nav, it) } }
                composable("cad/{rid}") { e -> e.longArg("rid")?.let { CadHost(nav, it) } }
                composable("elevation/{wid}") { e -> e.longArg("wid")?.let { ElevationHost(nav, it) } }
                composable("wall/{wid}") { e -> e.longArg("wid")?.let { WallScreen(nav, it) } }
                composable("cabinets/{wid}") { e -> e.longArg("wid")?.let { CabinetHost(nav, it) } }
                composable("semiauto/{rid}") { e -> e.longArg("rid")?.let { SemiAutoHost(nav, it) } }
                composable("template/{rid}") { e -> e.longArg("rid")?.let { TemplateHost(nav, it) } }
                composable("wallhead") { WallHeadHost(nav) }
                composable("symbols") { SymbolPaletteHost(nav) }
                composable("wallhead/{wid}") { e -> e.longArg("wid")?.let { WallHeadWallHost(nav, it) } }
                composable("p2p/{rid}") { e -> e.longArg("rid")?.let { P2PHost(nav, it) } }
                composable("verify/{rid}") { e -> e.longArg("rid")?.let { VerifyHost(nav, it) } }
                composable("floor/{rid}") { e -> e.longArg("rid")?.let { LevelHost(nav, it, LevelSurface.FLOOR) } }
                composable("ceiling/{rid}") { e -> e.longArg("rid")?.let { LevelHost(nav, it, LevelSurface.CEILING) } }
                composable("intake") { IntakeHost(nav) }
                composable("library") { ElementLibraryScreen(onBack = { nav.popBackStack() }) }
                // ── צד-הניהול (לו"ז + מדידות) ──
                composable("schedule") { ScheduleScreen(nav) }
                composable("measurements") { MeasurementsScreen(nav) }
                composable("retest") { il.co.soline.measure.ui.retest.RetestScreen(nav) }
                composable("mybugs") { il.co.soline.measure.ui.bug.MyBugsScreen(nav) }
            }
            // משגר-כלים מאוחד — כפתור-אחד שנפתח לאייקונים (🐞 באג · 📡 לייזר · עתידיים)
            ToolsFab(
                currentRoute = curRoute,
                currentProjectId = curPid,
                currentRoomId = curRid,
            )
            } // Box
        }
    }
}

// ── shared ────────────────────────────────────────────────────────────────
@Composable
private fun BrandHeader(subtitle: String, onBack: (() -> Unit)? = null) {
    Column(Modifier.fillMaxWidth().background(Color.White).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (onBack != null) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
                Spacer(Modifier.width(4.dp))
            }
            Column {
                Text("soline", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Orange, lineHeight = 28.sp)
                Text("SMART SPATIAL SOLUTIONS", fontSize = 10.sp, color = Teal, letterSpacing = 2.sp)
            }
        }
        Text(subtitle, fontSize = 14.sp, color = Muted, modifier = Modifier.padding(top = 8.dp, start = if (onBack != null) 52.dp else 0.dp))
    }
}

@Composable
private fun EmptyHint(text: String) {
    Box(Modifier.fillMaxSize().padding(40.dp), contentAlignment = Alignment.Center) {
        Text(text, color = Muted, fontSize = 15.sp)
    }
}

@Composable
private fun ListCard(title: String, subtitle: String, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(title, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Ink)
            Text(subtitle, fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

@Composable
private fun AddFab(onClick: () -> Unit) =
    FloatingActionButton(onClick = onClick, containerColor = Orange, contentColor = Color.White) {
        Icon(Icons.Default.Add, "הוסף")
    }

/**
 * שדה מספרי חכם עם הזרקת-לייזר **דָּרוּך-מתמשך** (re-armable): פוקוס או הקשה על 📡
 * דורכים את השדה; כל ירייה חדשה דורסת את הערך ונשאר-דרוך לירי-חוזר (מדידה-חוזרת),
 * עד הקשה על 📡 לביטול או מעבר-שדה. מתקן קליטה-שנייה שלא-נלכדה בגרסת ה-one-shot.
 * @param laser כאשר false — השדה **אינו** קולט מדידת-לייזר (B1 בביקורת: הזרקת-מרחק
 *        לשדה שאינו-מרחק, כמו מעלות-כניסה, שוגה את הערך). ברירת-מחדל: שדה-מרחק (true).
 */
@Composable
private fun numField(label: String, state: MutableState<String>, laser: Boolean = true) {
    val ble = SolineApp.instance.ble
    val last by ble.lastReading.collectAsState()
    var focused by remember { mutableStateOf(false) }
    // דָּרוּך: כשדרוך, כל ירייה חדשה נלכדת. נשאר-דרוך (לא חד-פעמי) → מדידה-חוזרת חופשית.
    var armed by remember { mutableStateOf(false) }
    var armedFrom by remember { mutableStateOf(Long.MAX_VALUE) }
    LaunchedEffect(last, armed) {
        val r = last
        if (laser && armed && r?.distanceMm != null && r.ts > armedFrom) {
            armedFrom = r.ts             // דורס-וממשיך-דרוך — הירייה-הבאה תדרוס שוב
            state.value = Prefs.toDisplayText(r.distanceMm)   // מזריק ביחידת-התצוגה (מ"מ→ס"מ בעת-הצורך)
        }
    }
    OutlinedTextField(
        value = state.value, onValueChange = { state.value = it },
        label = {
            Text(
                when {
                    laser && armed -> "$label  📡 ממתין לירייה… (הקש לביטול)"
                    laser && focused -> "$label  📡 מדוד (הקש 📡 לדריכה)"
                    else -> label
                }
            )
        }, singleLine = true,
        trailingIcon = if (laser) {
            {
                Text(
                    "📡",
                    fontSize = 22.sp,
                    color = if (armed) Orange else Muted,
                    modifier = Modifier
                        .clickable {
                            if (armed) { armed = false; armedFrom = Long.MAX_VALUE }
                            else { armed = true; armedFrom = last?.ts ?: 0L }
                        }
                        .padding(12.dp),
                )
            }
        } else null,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
            .onFocusChanged { fs ->
                focused = fs.isFocused
                if (laser) {
                    if (fs.isFocused) { armed = true; armedFrom = last?.ts ?: 0L }
                    else { armed = false; armedFrom = Long.MAX_VALUE }
                }
            },
    )
}

// ── projects ────────────────────────────────────────────────────────────────
@Composable
fun ProjectsScreen(nav: NavController) {
    val scope = rememberCoroutineScope()
    val projects by repo.projects().collectAsStateWithLifecycle(emptyList())
    var showAdd by remember { mutableStateOf(false) }

    Scaffold(containerColor = Cream, floatingActionButton = { AddFab { showAdd = true } }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            BrandHeader("פרויקטים")
            OutlinedButton(
                onClick = { nav.navigate("devices") },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            ) { Text("📶  מכשירי מדידה (Bluetooth)") }
            if (projects.isEmpty()) EmptyHint("אין פרויקטים עדיין. הקש + כדי ליצור פרויקט.")
            else LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {
                items(projects, key = { it.id }) { p ->
                    ListCard(p.name, if (p.client.isNotBlank()) "לקוח: ${p.client}" else "ללא לקוח") {
                        nav.navigate("rooms/${p.id}")
                    }
                }
            }
        }
    }
    if (showAdd) {
        val name = remember { mutableStateOf("") }
        val client = remember { mutableStateOf("") }
        FormDialog("פרויקט חדש", onDismiss = { showAdd = false }, onConfirm = {
            if (name.value.isNotBlank()) { scope.launch { repo.addProject(name.value.trim(), client.value.trim()) }; showAdd = false }
        }) {
            OutlinedTextField(name.value, { name.value = it }, label = { Text("שם הפרויקט") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(client.value, { client.value = it }, label = { Text("לקוח (רשות)") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
        }
    }
}

// ── rooms ────────────────────────────────────────────────────────────────
@Composable
fun ProjectRoomsScreen(nav: NavController, projectId: Long) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val rooms by repo.rooms(projectId).collectAsStateWithLifecycle(emptyList())
    val project by repo.project(projectId).collectAsStateWithLifecycle(null)
    var showAdd by remember { mutableStateOf(false) }
    var roomToDelete by remember { mutableStateOf<il.co.soline.measure.data.RoomEntity?>(null) }
    var showDeleteProject by remember { mutableStateOf(false) }
    var showEditProject by remember { mutableStateOf(false) }
    // שער-ייצוא (A8): מס' ממצאי-חסימה שנמצאו לפני-ייצוא (null=לא-נבדק/אין-דיאלוג).
    var exportBlocks by remember { mutableStateOf<Int?>(null) }

    // פעולת-הייצוא בפועל (נקראת ישירות אם נקי, או "ייצא בכל-זאת" מהדיאלוג).
    val runExport: () -> Unit = {
        project?.let { p ->
            scope.launch {
                try {
                    // בניית-ה-ZIP (כולל סטרימינג תמונות/וידאו) כבדה → מריצים על IO, לא על
                    // ה-thread-הראשי (אחרת ANR · קבוצה-E בביקורת). ה-UI (share) נשאר ב-Main.
                    val f = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                        val dir = java.io.File(context.filesDir, "exports").apply { mkdirs() }
                        val file = java.io.File(dir, SolWriter.fileName(p))
                        file.outputStream().use { repo.exportSol(p, it) }
                        file
                    }
                    repo.markProjectExported(p.id)
                    // גיבוי-אוטומטי ל-Drive (תיקיית-הלקוח/גיבוי) — לא-חוסם את ההגשה אם נכשל.
                    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                        il.co.soline.measure.data.BackupSync.backupProject(context, p)
                    }
                    val uri = androidx.core.content.FileProvider.getUriForFile(context, "il.co.soline.measure.fileprovider", f)
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

    Scaffold(containerColor = Cream, floatingActionButton = { AddFab { showAdd = true } }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            BrandHeader("חדרים", onBack = { nav.popBackStack() })
            // סגירה והגשה — פעולה-אחת (בקשת-מודד 204418): שער-חסימות → ייצוא → גיבוי.
            Button(
                onClick = {
                    scope.launch {
                        val blocks = repo.projectBlockingIssues(projectId)
                        if (blocks > 0) exportBlocks = blocks else runExport()
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = OkGreen),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).heightIn(min = 56.dp),
            ) { Text("🔒📤  סגירת פרויקט והגשה", fontWeight = FontWeight.Bold) }
            // עריכת-פרטי-פרויקט (בקשת-מודד 212344, קריטי). כרגע שם+לקוח; כתובת/גישה — המשך.
            OutlinedButton(
                onClick = { showEditProject = true },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            ) { Text("✏️  ערוך פרטי-פרויקט") }
            // גיבוי ידני ל-Drive (תיקיית-הלקוח/גיבוי) — מבנה: [לקוח]/[פרויקט]/<project>.sol
            OutlinedButton(
                onClick = {
                    project?.let { p ->
                        scope.launch {
                            val res = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                                il.co.soline.measure.data.BackupSync.backupProject(context, p)
                            }
                            val msg = when (res) {
                                is il.co.soline.measure.data.BackupSync.Result.Success -> "גובה ל-Drive ✓ (${res.folderName})"
                                is il.co.soline.measure.data.BackupSync.Result.NoFolder -> "אין תיקייה — קשר תיקיית-לקוח/גיבוי בהגדרות"
                                is il.co.soline.measure.data.BackupSync.Result.Failed -> "גיבוי נכשל: ${res.message}"
                            }
                            Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            ) { Text("☁️  גבה ל-Drive עכשיו") }
            if (rooms.isEmpty()) EmptyHint("אין חדרים. הקש + כדי להוסיף חדר.")
            else LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {
                items(rooms, key = { it.id }) { r ->
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                    ) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f).clickable { nav.navigate("room/${r.id}") }.padding(16.dp)) {
                                Text(r.name, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                                Text("פתח למדידת קירות", fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 2.dp))
                            }
                            IconButton(onClick = { roomToDelete = r }, modifier = Modifier.padding(end = 6.dp)) {
                                Icon(Icons.Default.Delete, "מחק חדר", tint = BlockRed)
                            }
                        }
                    }
                }
                // מחיקת-פרויקט — נסתר בתחתית (הנתונים ממילא נשמרים ב-Drive). בקשת-מודד 180924.
                item {
                    TextButton(
                        onClick = { showDeleteProject = true },
                        modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
                    ) { Text("מחיקת פרויקט זה מהמכשיר", fontSize = 12.sp, color = Muted) }
                }
            }
        }
    }
    exportBlocks?.let { n ->
        AlertDialog(
            onDismissRequest = { exportBlocks = null },
            confirmButton = {
                TextButton(onClick = { exportBlocks = null; nav.navigate("verify/${rooms.firstOrNull()?.id ?: return@TextButton}") }) {
                    Text("פתח אימות", color = Teal, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { exportBlocks = null; runExport() }) { Text("ייצא בכל-זאת", color = BlockRed) }
            },
            title = { Text("נמצאו $n ממצאים חוסמים", fontWeight = FontWeight.Bold) },
            text = { Text("בפרויקט יש חדרים/קירות עם מדידה חסרה או מתאר לא-סגור. מומלץ לתקן במסך-האימות לפני שליחה לממיר.", color = Ink) },
            containerColor = Color.White,
        )
    }
    roomToDelete?.let { r ->
        ConfirmDialog(
            title = "מחיקת חדר \"${r.name}\"",
            message = "החדר וכל קירותיו, בליטותיו, ארונותיו ונקודות-המישוריות שלו יימחקו. לא ניתן לבטל.",
            confirmLabel = "מחק",
            onConfirm = { scope.launch { repo.deleteRoom(r.id) }; roomToDelete = null },
            onDismiss = { roomToDelete = null },
        )
    }
    if (showDeleteProject) {
        project?.let { p ->
            ConfirmDialog(
                title = "מחיקת פרויקט \"${p.name}\" מהמכשיר",
                message = "הפרויקט יימחק מהמכשיר. הנתונים נשמרים בגיבוי ב-Drive וניתן לשחזר משם.",
                confirmLabel = "מחק",
                onConfirm = {
                    scope.launch { repo.deleteProject(p) }
                    showDeleteProject = false
                    nav.popBackStack()
                },
                onDismiss = { showDeleteProject = false },
            )
        } ?: run { showDeleteProject = false }
    }
    if (showEditProject) {
        project?.let { p ->
            val nm = remember(p.id) { mutableStateOf(p.name) }
            val cl = remember(p.id) { mutableStateOf(p.client) }
            FormDialog("עריכת פרטי-פרויקט", onDismiss = { showEditProject = false }, onConfirm = {
                scope.launch { repo.updateProject(p.copy(name = nm.value.trim().ifBlank { p.name }, client = cl.value.trim())) }
                showEditProject = false
            }) {
                OutlinedTextField(nm.value, { nm.value = it }, label = { Text("שם הפרויקט / לקוח") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(cl.value, { cl.value = it }, label = { Text("מפעל / לקוח-מזמין") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
                Text("כתובת ודרכי-גישה — עריכה-מלאה בהמשך.", fontSize = 11.sp, color = Muted, modifier = Modifier.padding(top = 6.dp))
            }
        } ?: run { showEditProject = false }
    }
    if (showAdd) {
        val name = remember { mutableStateOf("") }
        FormDialog("חדר חדש", onDismiss = { showAdd = false }, onConfirm = {
            if (name.value.isNotBlank()) { scope.launch { repo.addRoom(projectId, name.value.trim()) }; showAdd = false }
        }) {
            OutlinedTextField(name.value, { name.value = it }, label = { Text("שם החדר (למשל: מטבח)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        }
    }
}

// ── room: walls + fit ─────────────────────────────────────────────────────
@Composable
fun RoomScreen(nav: NavController, roomId: Long) {
    val scope = rememberCoroutineScope()
    val walls by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    val room by repo.room(roomId).collectAsStateWithLifecycle(null)
    var showAdd by remember { mutableStateOf(false) }
    var fit by remember { mutableStateOf<List<FitDelta>?>(null) }
    var wallToDelete by remember { mutableStateOf<WallEntity?>(null) }

    Scaffold(containerColor = Cream, floatingActionButton = { AddFab { showAdd = true } }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState())) {
            BrandHeader("קירות החדר", onBack = { nav.popBackStack() })
            // "פתיחת מדידה" (כניסה/גבהים/שינויים) עברה לתוך מנוע-המדידה (בקשת-מודד 210307).
            // מסך-מדידה אחד: כל שיטות-המדידה בתוכו.
            Button(
                onClick = { nav.navigate("unified/$roomId") },
                colors = ButtonDefaults.buttonColors(containerColor = OkGreen),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).heightIn(min = 64.dp),
            ) { Text("🎛️  מדידת החדר — מסך-אחד לכל-השיטות", fontWeight = FontWeight.Bold, fontSize = 17.sp) }
            Spacer(Modifier.height(10.dp))
            OutlinedButton(
                onClick = { nav.navigate("view3d/$roomId") },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            ) { Text("🧊 תלת-מימד") }
            Spacer(Modifier.height(6.dp))
            OutlinedButton(
                onClick = { nav.navigate("verify/$roomId") },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            ) { Text("✓ אימות לייצוא") }
            Spacer(Modifier.height(6.dp))
            // שער-סגירת-חדר: רשימת-משימות-המדיה (כללי/הסבר/חזיתות/פרטים) + סגירה-קשיחה.
            Button(
                onClick = { nav.navigate("closeroom/$roomId") },
                colors = ButtonDefaults.buttonColors(containerColor = OkGreen),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            ) { Text("🔒  סגירת חדר (רשימת משימות מדיה)") }
            Spacer(Modifier.height(6.dp))
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                OutlinedButton(onClick = { nav.navigate("floor/$roomId") }, modifier = Modifier.weight(1f)) { Text("▦ מדידת רצפה") }
                Spacer(Modifier.width(8.dp))
                OutlinedButton(onClick = { nav.navigate("ceiling/$roomId") }, modifier = Modifier.weight(1f)) { Text("▤ מדידת תקרה") }
            }
            Spacer(Modifier.height(6.dp))
            // "סמלי CAD" הוסרו כפריט-נפרד — הופכים לטיפוסי-אלמנט למדידה שמיוצאים לממיר (בקשת-מודד).

            // "בדיקת התאמה" עברה לשלב הייצוא + הדו"ח-הסופי (מאחדת חשיבת-מודד+נגר) — לא כפתור כאן (בקשת-מודד).

            if (walls.isEmpty()) EmptyHint("אין קירות. הקש + כדי להוסיף קיר.")
            else Column(Modifier.fillMaxWidth().padding(16.dp)) {
                walls.forEach { w ->
                    val headSuffix = if (w.headStyle != "STRAIGHT") " · ראש: ${wallHeadLabel(w.headStyle)}" else ""
                    // שורת-קיר עם עריכה (ניווט) + מחיקת-קיר-בודד ישירה (A1/C1 בביקורת).
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                    ) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Column(
                                Modifier.weight(1f).clickable { nav.navigate("wall/${w.id}") }.padding(16.dp),
                            ) {
                                Text("קיר ${w.idx + 1}", fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                                Text("אורך ${Prefs.lenValue(w.length)} · גובה ${Prefs.formatLen(w.height)}$headSuffix", fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 2.dp))
                            }
                            IconButton(onClick = { wallToDelete = w }, modifier = Modifier.padding(end = 6.dp)) {
                                Icon(Icons.Default.Delete, "מחק קיר", tint = BlockRed)
                            }
                        }
                    }
                }
            }
        }
    }
    if (showAdd) {
        val len = remember { mutableStateOf("") }
        val hgt = remember { mutableStateOf(Prefs.toDisplayText(Prefs.defaultWallHeightMm)) }
        FormDialog("קיר חדש", onDismiss = { showAdd = false }, onConfirm = {
            val l = Prefs.parseToMm(len.value); val h = Prefs.parseToMm(hgt.value)
            if (l != null && h != null) { scope.launch { repo.addWall(roomId, l, h) }; showAdd = false }
        }) {
            numField("אורך הקיר (${Prefs.unitSuffix})", len)
            numField("גובה הקיר (${Prefs.unitSuffix})", hgt)
        }
    }
    wallToDelete?.let { w ->
        ConfirmDialog(
            title = "מחיקת קיר ${w.idx + 1}",
            message = "הקיר, כל הבליטות והארונות שעליו יימחקו. הקירות שאחריו ימוספרו מחדש. לא ניתן לבטל.",
            confirmLabel = "מחק",
            onConfirm = { scope.launch { repo.deleteWall(roomId, w.id) }; wallToDelete = null },
            onDismiss = { wallToDelete = null },
        )
    }
}

/** דיאלוג-אישור-מחיקה כללי (הרסני · דורש אישור מפורש). */
@Composable
private fun ConfirmDialog(
    title: String,
    message: String,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onConfirm) { Text(confirmLabel, color = BlockRed, fontWeight = FontWeight.Bold) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) } },
        title = { Text(title, fontWeight = FontWeight.Bold) },
        text = { Text(message, color = Ink) },
        containerColor = Color.White,
    )
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  MeasurementStartCard — שלב-פתיחת-המדידה: שדות-מודד ברמת-החדר.
 *  · כיוון-הכניסה (שדה-עדיפות) — נדרש בתחילת-המדידה; הדוח מצייר ממנו חץ-כניסה.
 *  · מהלך-גבהים — מספר מדידות-תקרה ברחבי-החדר (הגובה-המחייב = המינימום).
 *  · שינויים-עתידיים — הערות-מודד על שינויי-קירות מתוכננים (פר-קיר/פר-חדר).
 * ───────────────────────────────────────────────────────────────────────────── */
@Composable
private fun MeasurementStartCard(
    room: il.co.soline.measure.data.RoomEntity,
    wallCount: Int,
    onSetEntrance: (bearingDeg: Double, wallIdx: Int, relation: String, vantage: String) -> Unit,
    onSetHeights: (List<Double>) -> Unit,
    onSetChanges: (List<RoomSurvey.FutureChange>) -> Unit,
) {
    var showEntrance by remember { mutableStateOf(false) }
    var showHeights by remember { mutableStateOf(false) }
    var showChanges by remember { mutableStateOf(false) }

    val heights = remember(room.heightSweepMm) { RoomSurvey.parseHeights(room.heightSweepMm) }
    val changes = remember(room.futureChanges) { RoomSurvey.parseFutureChanges(room.futureChanges) }
    val entranceSet = room.entranceBearingDeg >= 0.0 || room.entranceWallIdx >= 0
    // הדגשת-פתיחה: כיוון-כניסה טרם-הוגדר בתחילת-מדידה (עדיין אין קירות).
    val prompt = !entranceSet && wallCount == 0

    Card(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = if (prompt) WarnAmberBg else Color.White),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text("פתיחת מדידה", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Ink)
            Spacer(Modifier.height(8.dp))

            // כיוון-כניסה (עדיפות)
            SurveyRow(
                label = "כיוון כניסה",
                value = entranceSummary(room),
                emphasize = prompt,
                onEdit = { showEntrance = true },
            )
            if (prompt) {
                Text(
                    "הגדר את כיוון-הכניסה של החדר לפני תחילת-המדידה — הדוח יצייר ממנו חץ-כניסה.",
                    fontSize = 12.sp, color = WarnAmber, modifier = Modifier.padding(top = 2.dp, bottom = 4.dp),
                )
            }
            HorizontalDivider(Modifier.padding(vertical = 6.dp), color = Muted.copy(alpha = 0.2f))

            // מהלך-גבהים
            SurveyRow(
                label = "מהלך גבהים",
                value = if (heights.isEmpty()) "לא נמדד" else
                    "מינ' ${Prefs.lenValue(heights.min())} · מקס' ${Prefs.formatLen(heights.max())} (${heights.size})",
                onEdit = { showHeights = true },
            )
            HorizontalDivider(Modifier.padding(vertical = 6.dp), color = Muted.copy(alpha = 0.2f))

            // שינויים-עתידיים
            SurveyRow(
                label = "שינויים עתידיים",
                value = if (changes.isEmpty()) "אין" else "${changes.size} הערות",
                onEdit = { showChanges = true },
            )
        }
    }

    if (showEntrance) EntranceDialog(room, wallCount, onDismiss = { showEntrance = false }, onSave = { b, w, rel, van -> onSetEntrance(b, w, rel, van); showEntrance = false })
    if (showHeights) HeightSweepDialog(heights, onDismiss = { showHeights = false }, onSave = { onSetHeights(it); showHeights = false })
    if (showChanges) FutureChangesDialog(changes, wallCount, onDismiss = { showChanges = false }, onSave = { onSetChanges(it); showChanges = false })
}

private fun entranceSummary(room: il.co.soline.measure.data.RoomEntity): String {
    val hasBearing = room.entranceBearingDeg >= 0.0
    if (!hasBearing && room.entranceWallIdx < 0 &&
        room.entranceRelation.isBlank() && room.entranceVantage.isBlank()
    ) return "לא הוגדר"
    val parts = mutableListOf<String>()
    if (hasBearing) parts += "שעה ${bearingToHour(room.entranceBearingDeg)} (${room.entranceBearingDeg.toInt()}°)"
    if (room.entranceWallIdx >= 0) parts += "קיר ${room.entranceWallIdx + 1}"
    if (room.entranceRelation.isNotBlank()) parts += room.entranceRelation
    return parts.joinToString(" · ").ifBlank { "לא הוגדר" }
}

/**
 * מיפוי חוגת-השעון ↔ bearing (מעלות). 12=0° (מעלה), 3=90°, 6=180°, 9=270°;
 * כל שעה = 30°. שעה h∈[1..12] ⇒ bearing = (h%12)·30.
 */
private fun hourToBearing(hour: Int): Double = ((hour % 12) * 30).toDouble()

/** bearing → שעה (1..12); 0°/360° ⇒ 12. שימושי לתצוגת-סיכום ולמצב-הנבחר בחוגה. */
private fun bearingToHour(deg: Double): Int {
    val norm = ((deg % 360.0) + 360.0) % 360.0
    val h = (Math.round(norm / 30.0).toInt()) % 12
    return if (h == 0) 12 else h
}

/**
 * נקודת-מגע בחוגה → bearing מוצמד לשעה הקרובה (12 מיקומים · צעד-30°).
 * מחזיר null אם המגע קרוב-מדי למרכז (אזור-מת, למניעת-בחירה-מקרית).
 */
private fun dialBearing(p: Offset, w: Int, h: Int): Double? {
    val cx = w / 2f
    val cy = h / 2f
    val dx = (p.x - cx).toDouble()
    val dy = (p.y - cy).toDouble()
    if (hypot(dx, dy) < w * 0.12) return null
    // atan2(dx, -dy): מעלה=0°, ימין=90°, מטה=180°, שמאל=270° (עם-כיוון-השעון).
    val raw = Math.toDegrees(atan2(dx, -dy))
    val norm = (raw + 360.0) % 360.0
    return ((Math.round(norm / 30.0).toInt() * 30) % 360).toDouble()
}

@Composable
private fun SurveyRow(label: String, value: String, emphasize: Boolean = false, onEdit: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(label, fontSize = 13.sp, color = Muted)
            Text(value, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = if (emphasize) WarnAmber else Ink)
        }
        OutlinedButton(onClick = onEdit) { Text(if (value == "לא הוגדר" || value == "לא נמדד" || value == "אין") "הגדר" else "ערוך") }
    }
}

/**
 * דיאלוג כיוון-כניסה (redesign · ללא-מצפן): המודד בוחר את כיוון-חץ-הכניסה בעזרת
 * **חוגת-שעון** ([EntranceDial]) — מקישים/גוררים על שעה והחץ פונה לשם. בנוסף שני
 * שדות-טקסט-חופשי: "היכן הכניסה ביחס לחזית-הראשית" ו"מהיכן אתה מסתכל". שיוך-הקיר
 * האופציונלי נשמר. הערך נשמר ב-[RoomEntity.entranceBearingDeg] הקיים (הדוח מצייר ממנו).
 */
@Composable
private fun EntranceDialog(
    room: il.co.soline.measure.data.RoomEntity,
    wallCount: Int,
    onDismiss: () -> Unit,
    onSave: (bearingDeg: Double, wallIdx: Int, relation: String, vantage: String) -> Unit,
) {
    var bearing by rememberSaveable { mutableStateOf(room.entranceBearingDeg) }
    var wallIdx by rememberSaveable { mutableStateOf(room.entranceWallIdx) }
    var relation by rememberSaveable { mutableStateOf(room.entranceRelation) }
    var vantage by rememberSaveable { mutableStateOf(room.entranceVantage) }
    FormDialog("כיוון כניסה", onDismiss = onDismiss, onConfirm = {
        onSave(bearing, wallIdx, relation.trim(), vantage.trim())
    }) {
        Text(
            "סובב את החץ לכיוון-הכניסה — הקש או גרור על השעה המתאימה (12 = מעלה).",
            fontSize = 13.sp, color = Muted,
        )
        Spacer(Modifier.height(8.dp))
        EntranceDial(bearing = bearing, onBearing = { bearing = it })
        Spacer(Modifier.height(4.dp))
        Text(
            text = if (bearing >= 0.0) "נבחר: שעה ${bearingToHour(bearing)}  ·  ${bearing.toInt()}°" else "טרם-נבחר כיוון",
            fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
            color = if (bearing >= 0.0) Orange else Muted,
            modifier = Modifier.fillMaxWidth(),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        HorizontalDivider(Modifier.padding(vertical = 10.dp), color = Muted.copy(alpha = 0.2f))

        OutlinedTextField(
            value = relation, onValueChange = { relation = it },
            label = { Text("היכן הכניסה ביחס לחזית-הראשית") },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = vantage, onValueChange = { vantage = it },
            label = { Text("מהיכן אתה מסתכל") },
            modifier = Modifier.fillMaxWidth(),
        )

        if (wallCount > 0) {
            Text("שיוך-קיר לכניסה (אופציונלי):", fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 10.dp))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedButton(onClick = { wallIdx = -1 },
                    colors = if (wallIdx < 0) ButtonDefaults.outlinedButtonColors(containerColor = Teal, contentColor = Color.White) else ButtonDefaults.outlinedButtonColors()) { Text("ללא") }
                for (i in 0 until wallCount) {
                    OutlinedButton(onClick = { wallIdx = i },
                        colors = if (wallIdx == i) ButtonDefaults.outlinedButtonColors(containerColor = Teal, contentColor = Color.White) else ButtonDefaults.outlinedButtonColors()) { Text("קיר ${i + 1}") }
                }
            }
        }
    }
}

/**
 * חוגת-שעון לבחירת כיוון-חץ-הכניסה (Compose Canvas). מציגה מעגל עם 12 מיקומי-שעה
 * וחץ מהמרכז; הקשה/גרירה על מיקום מפנה את החץ לשם. מיפוי: 12=0°(מעלה), 3=90°,
 * 6=180°, 9=270° — כל שעה 30° (ראה [hourToBearing]/[dialBearing]). מטרות-מגע גדולות,
 * מצב-נבחר בולט. [bearing]<0 ⇒ טרם-נבחר; [onBearing] מקבל bearing מוצמד-לשעה.
 */
@Composable
private fun EntranceDial(bearing: Double, onBearing: (Double) -> Unit) {
    val selectedHour = if (bearing >= 0.0) bearingToHour(bearing) else -1
    val inkArgb = Ink.toArgb()
    val labelPaint = remember {
        android.graphics.Paint().apply {
            isAntiAlias = true
            textAlign = android.graphics.Paint.Align.CENTER
            textSize = 30f
        }
    }
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Canvas(
            modifier = Modifier
                .size(260.dp)
                .pointerInput(Unit) {
                    detectTapGestures { p -> dialBearing(p, size.width, size.height)?.let(onBearing) }
                }
                .pointerInput(Unit) {
                    detectDragGestures { change, _ ->
                        dialBearing(change.position, size.width, size.height)?.let(onBearing)
                        change.consume()
                    }
                },
        ) {
            val cx = size.width / 2f
            val cy = size.height / 2f
            val r = (minOf(size.width, size.height) / 2f) - 38f
            // מעגל-החוגה
            drawCircle(color = Muted.copy(alpha = 0.25f), radius = r, center = Offset(cx, cy), style = Stroke(width = 3f))
            // חץ-הכניסה (מהמרכז אל מיקום-השעה הנבחר)
            if (selectedHour > 0) {
                val rad = Math.toRadians(hourToBearing(selectedHour))
                val tipX = cx + (r - 30f) * sin(rad).toFloat()
                val tipY = cy - (r - 30f) * cos(rad).toFloat()
                drawLine(Orange, Offset(cx, cy), Offset(tipX, tipY), strokeWidth = 9f, cap = StrokeCap.Round)
                val hLen = 30f
                val left = Math.toRadians(hourToBearing(selectedHour) + 152.0)
                val right = Math.toRadians(hourToBearing(selectedHour) - 152.0)
                drawLine(Orange, Offset(tipX, tipY), Offset(tipX + hLen * sin(left).toFloat(), tipY - hLen * cos(left).toFloat()), strokeWidth = 9f, cap = StrokeCap.Round)
                drawLine(Orange, Offset(tipX, tipY), Offset(tipX + hLen * sin(right).toFloat(), tipY - hLen * cos(right).toFloat()), strokeWidth = 9f, cap = StrokeCap.Round)
            }
            // 12 מיקומי-שעה (מטרות-מגע גדולות) + מספר-השעה
            for (h in 1..12) {
                val rad = Math.toRadians(hourToBearing(h))
                val x = cx + r * sin(rad).toFloat()
                val y = cy - r * cos(rad).toFloat()
                val sel = h == selectedHour
                drawCircle(color = if (sel) Orange else Muted.copy(alpha = 0.15f), radius = 24f, center = Offset(x, y))
                labelPaint.color = if (sel) android.graphics.Color.WHITE else inkArgb
                drawContext.canvas.nativeCanvas.drawText(h.toString(), x, y + 11f, labelPaint)
            }
            // מרכז-החוגה
            drawCircle(color = Ink, radius = 8f, center = Offset(cx, cy))
        }
    }
}

/**
 * דיאלוג מהלך-גבהים: קליטת-לייזר **אוטומטית-רציפה** (כל ירייה מתקבלת ומדלגת לבאה) עם
 * **סינון-חריגה**: מדידה שסוטה >2ס"מ מהחציון נעצרת באדום — המודד מחליט להשאיר/למחוק
 * (מכסה תקלה-טכנית בלקיחת-המידה). הגובה-המחייב = המינימום; הדוח מציג מינ'+מקס'.
 */
@Composable
private fun HeightSweepDialog(current: List<Double>, onDismiss: () -> Unit, onSave: (List<Double>) -> Unit) {
    // שורד-סיבוב (rememberSaveable · P0-2): מסדרן דרך RoomSurvey כמחרוזת-CSV.
    val heightsSaver = Saver<SnapshotStateList<Double>, String>(
        save = { RoomSurvey.heightsToStore(it.toList()) },
        restore = { RoomSurvey.parseHeights(it).toMutableStateList() },
    )
    val list = rememberSaveable(saver = heightsSaver) { current.toMutableStateList() }
    val entry = rememberSaveable { mutableStateOf("") }

    val ble = SolineApp.instance.ble
    val last by ble.lastReading.collectAsState()
    val connected by ble.connected.collectAsState()
    var armed by remember { mutableStateOf(false) }
    var armedFrom by remember { mutableStateOf(Long.MAX_VALUE) }

    val outlierMm = 20.0                                        // סף >2 ס"מ מהחציון
    fun refMm(): Double? = if (list.isEmpty()) null else list.sorted()[list.size / 2]  // חציון-יציב
    fun isOutlier(h: Double): Boolean = refMm()?.let { kotlin.math.abs(h - it) > outlierMm } ?: false

    // קליטה-רציפה **בלי-חסימה** (בקשת-מודד 115901): כל ירייה נקלטת ומדלגת מיד לבאה;
    // חריגות לא-עוצרות את המדידה — הן רק מסומנות באדום, והמודד מוחק/מאשר בסוף.
    LaunchedEffect(last) {
        val r = last; val d = r?.distanceMm
        if (armed && r != null && d != null && d > 0 && r.ts > armedFrom) {
            armedFrom = r.ts                                    // דילוג-אוטומטי לקריאה הבאה
            list.add(d)
        }
    }
    LaunchedEffect(connected) { if (connected == null) { armed = false; armedFrom = Long.MAX_VALUE } }

    FormDialog("מהלך גבהים (תקרה)", onDismiss = { armed = false; onDismiss() }, onConfirm = { onSave(list.toList()) }) {
        // מצב-חיבור + דריכת-קליטה
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                if (connected != null) "מחובר: $connected" else "לייזר לא מחובר",
                fontSize = 12.sp, color = if (connected != null) OkGreen else Muted, modifier = Modifier.weight(1f),
            )
            OutlinedButton(
                onClick = { armed = !armed; armedFrom = last?.ts ?: 0L },
                colors = if (armed) ButtonDefaults.outlinedButtonColors(containerColor = Teal, contentColor = Color.White) else ButtonDefaults.outlinedButtonColors(),
            ) { Text(if (armed) "📡 יורה… (עצור)" else "📡 קלוט גבהים") }
        }
        if (armed) Text("ירֵה שוב-ושוב — כל מדידה נקלטת אוטומטית. חריגות מסומנות אדום; מחק בסוף.", fontSize = 11.sp, color = Teal)

        if (list.isEmpty()) Text("אין מדידות עדיין.", fontSize = 13.sp, color = Muted)
        else {
            val outCount = list.count { isOutlier(it) }
            Text(
                "מינ' ${Prefs.lenValue(list.min())} · מקס' ${Prefs.formatLen(list.max())} · המחייב = ${Prefs.formatLen(list.min())}" +
                    if (outCount > 0) " · ⚠️ $outCount חריגות" else "",
                fontSize = 13.sp, color = if (outCount > 0) BlockRed else Teal, fontWeight = FontWeight.SemiBold,
            )
            list.forEachIndexed { i, h ->
                val out = isOutlier(h)
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        (if (out) "⚠️ " else "") + Prefs.formatLen(h),
                        fontSize = 15.sp, color = if (out) BlockRed else Ink,
                        fontWeight = if (out) FontWeight.Bold else FontWeight.Normal,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = { list.removeAt(i) }) { Icon(Icons.Default.Delete, "מחק", tint = BlockRed) }
                }
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) { numField("גובה חדש (${Prefs.unitSuffix})", entry, laser = false) }
            OutlinedButton(onClick = {
                Prefs.parseToMm(entry.value)?.let { if (it > 0.0) { list.add(it); entry.value = "" } }
            }) { Text("הוסף") }
        }
    }
}

/** דיאלוג שינויים-עתידיים: הערה מקושרת לקיר או לכל-החדר. */
@Composable
private fun FutureChangesDialog(current: List<RoomSurvey.FutureChange>, wallCount: Int, onDismiss: () -> Unit, onSave: (List<RoomSurvey.FutureChange>) -> Unit) {
    // שורד-סיבוב (rememberSaveable · P0-2): מסדרן דרך RoomSurvey למחרוזת-אחסון.
    val changesSaver = Saver<SnapshotStateList<RoomSurvey.FutureChange>, String>(
        save = { RoomSurvey.futureChangesToStore(it.toList()) },
        restore = { RoomSurvey.parseFutureChanges(it).toMutableStateList() },
    )
    val list = rememberSaveable(saver = changesSaver) { current.toMutableStateList() }
    val text = rememberSaveable { mutableStateOf("") }
    var scopeWall by rememberSaveable { mutableStateOf(false) }
    var wallIdx by rememberSaveable { mutableStateOf(if (wallCount > 0) 0 else -1) }
    // מוסיף הערה שהוקלדה ל-list (מקור-אמת יחיד) — כדי ש"הוסף" וגם "שמור" יצרפו אותה.
    fun commitEntry() {
        if (text.value.isNotBlank()) {
            val sc = if (scopeWall && wallCount > 0) "wall" else "room"
            list.add(RoomSurvey.FutureChange(sc, if (sc == "wall") wallIdx else -1, text.value.trim()))
            text.value = ""
        }
    }
    // תיקון-איבוד-נתונים: "שמור" צורב גם טקסט-שהוקלד-ואל-נלחץ-"הוסף".
    FormDialog("שינויים עתידיים", onDismiss = onDismiss, onConfirm = { commitEntry(); onSave(list.toList()) }) {
        list.forEachIndexed { i, c ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(if (c.scope == "wall") "קיר ${c.wallId + 1}" else "כל החדר", fontSize = 12.sp, color = Teal)
                    Text(c.text, fontSize = 14.sp, color = Ink)
                }
                IconButton(onClick = { list.removeAt(i) }) { Icon(Icons.Default.Delete, "מחק", tint = BlockRed) }
            }
            HorizontalDivider(color = Muted.copy(alpha = 0.15f))
        }
        Spacer(Modifier.height(4.dp))
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = { scopeWall = false },
                colors = if (!scopeWall) ButtonDefaults.outlinedButtonColors(containerColor = Teal, contentColor = Color.White) else ButtonDefaults.outlinedButtonColors()) { Text("כל החדר") }
            if (wallCount > 0) for (i in 0 until wallCount) {
                OutlinedButton(onClick = { scopeWall = true; wallIdx = i },
                    colors = if (scopeWall && wallIdx == i) ButtonDefaults.outlinedButtonColors(containerColor = Teal, contentColor = Color.White) else ButtonDefaults.outlinedButtonColors()) { Text("קיר ${i + 1}") }
            }
        }
        OutlinedTextField(text.value, { text.value = it }, label = { Text("תיאור השינוי") }, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        OutlinedButton(onClick = {
            if (text.value.isNotBlank()) {
                val scope = if (scopeWall && wallCount > 0) "wall" else "room"
                list.add(RoomSurvey.FutureChange(scope, if (scope == "wall") wallIdx else -1, text.value.trim()))
                text.value = ""
            }
        }, modifier = Modifier.padding(top = 4.dp)) { Text("הוסף הערה") }
    }
}

@Composable
private fun FitResults(deltas: List<FitDelta>) {
    Column(Modifier.fillMaxWidth().padding(16.dp)) {
        if (deltas.isEmpty()) {
            Text("✓ אין התנגשויות — כל הבליטות מפנות מקום לארונות.", color = OkGreen, fontSize = 15.sp)
            return
        }
        Text("נמצאו ${deltas.size} התנגשויות:", fontWeight = FontWeight.SemiBold, color = Ink)
        Spacer(Modifier.height(6.dp))
        for (d in deltas) {
            val block = d.severity == Severity.BLOCK
            Card(
                Modifier.fillMaxWidth().padding(vertical = 4.dp),
                shape = RoundedCornerShape(10.dp),
                colors = CardDefaults.cardColors(containerColor = if (block) BlockRedBg else WarnAmberBg),
            ) {
                Column(Modifier.padding(12.dp)) {
                    Text(
                        (if (block) "חסימה" else "אזהרה") + " · ${d.rule} · חריגה ${Prefs.formatLen(d.delta.toDouble())}",
                        color = if (block) BlockRed else WarnAmber, fontWeight = FontWeight.Bold, fontSize = 13.sp,
                    )
                    Text(d.message, fontSize = 14.sp, color = Ink, modifier = Modifier.padding(top = 4.dp))
                    Text("→ ${d.suggestion}", fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 2.dp))
                }
            }
        }
    }
}

// ── live CAD draw host ────────────────────────────────────────────────────
@Composable
fun DrawScreenHost(nav: NavController, roomId: Long) {
    val scope = rememberCoroutineScope()
    val walls by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    val accMap = rememberAccessoriesByWall(walls)
    LiveCadScreen(
        walls = walls,
        accessoriesByWall = accMap,
        onAddWall = { len, ang -> scope.launch { repo.addWall(roomId, len, Prefs.defaultWallHeightMm, ang) } },
        onRemoveLastWall = { scope.launch { repo.removeLastWall(roomId) } },
        onUpdateWall = { w -> scope.launch { repo.updateWall(w) } },
        onBack = { nav.popBackStack() },
        onAddArc = { incomingTurn, segs ->
            scope.launch {
                // זווית-הכניסה מוחלת על הקיר-הקודם (משיק), ואז הקטעים מתווספים לפי הסדר.
                if (incomingTurn != 0.0) walls.lastOrNull()?.let { repo.updateWall(it.copy(angle = it.angle + incomingTurn)) }
                for ((len, ang) in segs) repo.addWall(roomId, len, Prefs.defaultWallHeightMm, ang)
            }
        },
    )
}

// פתיחת-מדידה (כיוון-כניסה · גבהים · שינויים-עתידיים) — הועבר מ-RoomScreen למנוע (בקשת-מודד 210307).
@Composable
fun MeasureStartHost(nav: NavController, roomId: Long) {
    val scope = rememberCoroutineScope()
    val room by repo.room(roomId).collectAsStateWithLifecycle(null)
    val walls by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    Scaffold(containerColor = Cream) { pad ->
        Column(Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState())) {
            BrandHeader("פתיחת מדידה", onBack = { nav.popBackStack() })
            room?.let { r ->
                MeasurementStartCard(
                    room = r,
                    wallCount = walls.size,
                    onSetEntrance = { bearing, wallIdx, relation, vantage ->
                        scope.launch {
                            repo.setRoomEntrance(roomId, bearing, wallIdx)
                            repo.setRoomEntranceText(roomId, relation, vantage)
                        }
                    },
                    onSetHeights = { hs -> scope.launch { repo.setRoomHeightSweep(roomId, hs) } },
                    onSetChanges = { ch -> scope.launch { repo.setRoomFutureChanges(roomId, ch) } },
                )
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
fun MeasureHost(nav: NavController, roomId: Long) {
    val scope = rememberCoroutineScope()
    val walls by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    MeasureCaptureScreen(
        walls = walls,
        onAddWall = { len, ang -> scope.launch { repo.addWall(roomId, len, Prefs.defaultWallHeightMm, ang) } },
        onUndo = { scope.launch { repo.removeLastWall(roomId) } },
        onBack = { nav.popBackStack() },
    )
}

@Composable
fun CadHost(nav: NavController, roomId: Long) {
    val scope = rememberCoroutineScope()
    val walls by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    CadDimensionEditor(
        walls = walls,
        onEditWall = { id, len, ang ->
            walls.find { it.id == id }?.let { w -> scope.launch { repo.updateWall(w.copy(length = len, angle = ang)) } }
        },
        onBack = { nav.popBackStack() },
        onEditHeight = { id, ht -> scope.launch { repo.setWallHeight(id, ht) } },
    )
}

@Composable
fun Room3DHost(nav: NavController, roomId: Long) {
    val walls by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    val accMap = rememberAccessoriesByWall(walls)
    Column(Modifier.fillMaxSize().background(Cream)) {
        Row(Modifier.fillMaxWidth().background(Color.White).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { nav.popBackStack() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
            Text("תצוגת תלת-מימד", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink)
        }
        Room3DView(walls, accMap, Modifier.weight(1f).fillMaxWidth())
    }
}

/** מסך-חזית מאוחד: גבהים-על-הקיר + מסגרת-החזית (נקודות X6) יחד. */
@Composable
fun ElevationHost(nav: NavController, wallId: Long) {
    val scope = rememberCoroutineScope()
    val wall by repo.wall(wallId).collectAsStateWithLifecycle(null)
    val accs by repo.accessories(wallId).collectAsStateWithLifecycle(emptyList())
    val cabinets by repo.cabinets(wallId).collectAsStateWithLifecycle(emptyList())
    wall?.let { w ->
        val meta = remember(w.wallProfileJson) { parseWallProfile(w.wallProfileJson) }
        WallElevationUnified(
            wall = w,
            accessories = accs,
            cabinets = cabinets,   // שכבת-תכנון: ארונות מול תשתיות + זיהוי-התנגשויות
            initialFramePoints = parseFramePoints(w.framePointsJson),
            initialZeroCorner = meta.zeroCorner,
            initialDirection = meta.direction,
            initialSoffitHeight = w.soffitHeightMm,
            // שיטה A — מתאר (u,v,e) → framePointsJson; מסגור (פינת-אפס/כיוון) → wallProfileJson
            // (משמרים את נקודות-הבטן/flip של שיטה B).
            onFramePoints = { pts, zeroCorner, direction ->
                scope.launch {
                    repo.saveWallFramePoints(wallId, framePointsToJson(pts))
                    repo.saveWallProfile(wallId, wallProfileToJson(meta.copy(zeroCorner = zeroCorner, direction = direction)))
                }
            },
            onUpdateAccessory = { a -> scope.launch { repo.updateAccessory(a) } },
            onAddAccessory = { a -> scope.launch { repo.addAccessory(a.copy(wallId = wallId)) } },
            onDeleteAccessory = { a -> scope.launch { repo.deleteAccessory(a) } },
            onSoffitHeight = { mm -> scope.launch { repo.setWallSoffit(wallId, mm) } },
            onBack = { nav.popBackStack() },
        )
    }
}

/** שיטה B — לכידת מבט-על (בטן) ב-X6 → נשמרת כ-plan ב-wallProfileJson על הקיר. */
@Composable
fun ShapeHost(nav: NavController, wallId: Long) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val wall by repo.wall(wallId).collectAsStateWithLifecycle(null)
    // טוענים את נקודות-מבט-העל הקיימות (שיטה B) כדי שכניסה-חוזרת תתחיל מהן ולא תדרוס.
    val meta = remember(wall?.wallProfileJson) { parseWallProfile(wall?.wallProfileJson ?: "") }
    // ממתינים לטעינת-הקיר לפני זריעת-הקנבס (אחרת ה-remember ייזרע ריק וישאר ריק).
    if (wall == null) return
    WallShapeCapture(
        initialPoints = meta.plan,
        initialFlip = meta.flip,
        onDone = { pts, flip ->
            scope.launch { repo.saveWallProfile(wallId, wallProfileToJson(meta.copy(flip = flip, plan = pts))) }
            Toast.makeText(context, "נשמרו ${pts.size} נקודות למבט-העל (בטן)", Toast.LENGTH_LONG).show()
            nav.popBackStack()
        },
        onBack = { nav.popBackStack() },
    )
}

// ── עזרי-JSON למתאר-החזית (שיטה A): [[u,v,e],...] מ"מ; 2-איברים [u,v] נשאר תקין ──
private fun parseFramePoints(json: String): List<Triple<Double, Double, Double>> {
    if (json.isBlank()) return emptyList()
    return try {
        val arr = org.json.JSONArray(json)
        (0 until arr.length()).map { i ->
            val p = arr.getJSONArray(i)
            val u = p.getDouble(0); val v = p.getDouble(1)
            val e = if (p.length() >= 3) p.getDouble(2) else 0.0
            Triple(u, v, e)
        }
    } catch (e: Exception) { emptyList() }
}

private fun framePointsToJson(pts: List<Triple<Double, Double, Double>>): String {
    val arr = org.json.JSONArray()
    for (p in pts) arr.put(org.json.JSONArray().put(p.first).put(p.second).put(p.third))
    return arr.toString()
}

// ── עזרי-JSON לפרופיל-הקיר המורחב (שיטה B + מסגור-A) ────────────────────────
// {"zeroCorner","direction","flip","plan":[[x,y],...]} — plan = נקודות-מבט-על לבטן.
private data class WallProfileMeta(
    val zeroCorner: String = "LEFT_BOTTOM",
    val direction: String = "CCW",
    val flip: Boolean = false,
    val plan: List<Pair<Double, Double>> = emptyList(),
)

private fun parseWallProfile(json: String): WallProfileMeta {
    if (json.isBlank()) return WallProfileMeta()
    return try {
        val o = org.json.JSONObject(json)
        val planArr = o.optJSONArray("plan")
        val plan = if (planArr == null) emptyList() else (0 until planArr.length()).map { i ->
            val p = planArr.getJSONArray(i); p.getDouble(0) to p.getDouble(1)
        }
        WallProfileMeta(
            zeroCorner = o.optString("zeroCorner", "LEFT_BOTTOM"),
            direction = o.optString("direction", "CCW"),
            flip = o.optBoolean("flip", false),
            plan = plan,
        )
    } catch (e: Exception) { WallProfileMeta() }
}

private fun wallProfileToJson(meta: WallProfileMeta): String {
    val o = org.json.JSONObject()
    o.put("zeroCorner", meta.zeroCorner)
    o.put("direction", meta.direction)
    o.put("flip", meta.flip)
    val arr = org.json.JSONArray()
    for (p in meta.plan) arr.put(org.json.JSONArray().put(p.first).put(p.second))
    o.put("plan", arr)
    return o.toString()
}

// ── ארונות (תכנון-הנגר) ─────────────────────────────────────────────────────
@Composable
fun CabinetHost(nav: NavController, wallId: Long) {
    val scope = rememberCoroutineScope()
    val wall by repo.wall(wallId).collectAsStateWithLifecycle(null)
    val cabinets by repo.cabinets(wallId).collectAsStateWithLifecycle(emptyList())
    wall?.let { w ->
        CabinetScreen(
            wall = w,
            cabinets = cabinets,
            onAdd = { c -> scope.launch { repo.addCabinet(c.copy(wallId = wallId, roomId = w.roomId)) } },
            onUpdate = { c -> scope.launch { repo.updateCabinet(c) } },
            onDelete = { c -> scope.launch { repo.deleteCabinet(c) } },
            onBack = { nav.popBackStack() },
        )
    }
}

// ── שרטוט חצי-אוטומטי (היקף-החדר) ───────────────────────────────────────────
@Composable
fun SemiAutoHost(nav: NavController, roomId: Long) {
    val scope = rememberCoroutineScope()
    val existing by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    val room by repo.room(roomId).collectAsStateWithLifecycle(null)
    // גובה-החדר האחיד מגיע ממהלך-הגבהים (המחייב = המינימום), לא נשאל שוב בסמיאוטו (121524).
    val defHeight = room?.heightSweepMm?.let { RoomSurvey.parseHeights(it).minOrNull() } ?: Prefs.defaultWallHeightMm
    var pending by remember { mutableStateOf<List<WallEntity>?>(null) }
    SemiAutoOutlineScreen(
        roomId = roomId,
        defaultHeightMm = defHeight,
        onDone = { newWalls ->
            if (existing.isEmpty()) scope.launch { addWizardWalls(roomId, newWalls, replace = false); nav.popBackStack() }
            else pending = newWalls
        },
        onBack = { nav.popBackStack() },
    )
    pending?.let { nw ->
        DuplicateWallsDialog(
            existingCount = existing.size,
            onReplace = { scope.launch { addWizardWalls(roomId, nw, replace = true); pending = null; nav.popBackStack() } },
            onAppend = { scope.launch { addWizardWalls(roomId, nw, replace = false); pending = null; nav.popBackStack() } },
            onCancel = { pending = null },
        )
    }
}

// ── אשף-תבניות-חדר (מלבן/L/U/T/Z + ריבוע-מהיר) ─────────────────────────────
@Composable
fun TemplateHost(nav: NavController, roomId: Long) {
    val scope = rememberCoroutineScope()
    val existing by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    var pending by remember { mutableStateOf<List<WallEntity>?>(null) }
    RoomTemplateWizard(
        defaultHeightMm = Prefs.defaultWallHeightMm,
        onCreate = { newWalls ->
            if (existing.isEmpty()) scope.launch { addWizardWalls(roomId, newWalls, replace = false); nav.popBackStack() }
            else pending = newWalls
        },
        onBack = { nav.popBackStack() },
    )
    pending?.let { nw ->
        DuplicateWallsDialog(
            existingCount = existing.size,
            onReplace = { scope.launch { addWizardWalls(roomId, nw, replace = true); pending = null; nav.popBackStack() } },
            onAppend = { scope.launch { addWizardWalls(roomId, nw, replace = false); pending = null; nav.popBackStack() } },
            onCancel = { pending = null },
        )
    }
}

/** מוסיף קירות-אשף לחדר; replace=true מנקה תחילה את הקירות הקיימים (B4). */
private suspend fun addWizardWalls(roomId: Long, newWalls: List<WallEntity>, replace: Boolean) {
    if (replace) repo.clearRoomWalls(roomId)
    for (w in newWalls) repo.addWall(roomId, w.length, if (w.height > 0) w.height else Prefs.defaultWallHeightMm, w.angle)
}

/**
 * אזהרת-כפילות-קירות (B4): הרצת-אשף על חדר שכבר יש בו קירות מציעה
 * החלפה / הוספה / ביטול — במקום להוסיף בשקט מתאר-כפול.
 */
@Composable
private fun DuplicateWallsDialog(
    existingCount: Int,
    onReplace: () -> Unit,
    onAppend: () -> Unit,
    onCancel: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onCancel,
        confirmButton = { TextButton(onClick = onReplace) { Text("החלף", color = BlockRed, fontWeight = FontWeight.Bold) } },
        dismissButton = { TextButton(onClick = onAppend) { Text("הוסף לקיים", color = Teal, fontWeight = FontWeight.Bold) } },
        title = { Text("בחדר כבר יש $existingCount קירות", fontWeight = FontWeight.Bold) },
        text = { Text("האשף עומד ליצור מתאר חדש. \"החלף\" ימחק את הקירות הקיימים ויצור מחדש; \"הוסף לקיים\" יוסיף על-גבי הקיים (עלול ליצור כפילות).", color = Ink) },
        containerColor = Color.White,
    )
}

// ── סגנון-ראש-קיר (תצוגת-חזית — CVSM #f-wall-topstyle) ─────────────────────
@Composable
fun WallHeadHost(nav: NavController) {
    WallHeadStyleScreen(
        defaultHeightMm = Prefs.defaultWallHeightMm,
        onBack = { nav.popBackStack() },
    )
}

// ── לוח סמלי-CAD (CVSM #f-cad-symbol / #f-elev-cadsymbol) ────────────────────
/**
 * לוח 25 הסמלים המובנים + הסמלים-המותאמים (Room). גל-זה: עיון/יצירה/מחיקה + תצוגה-מקדימה
 * חיה (תוכנית/חזית). הצבת-הסמל על קנבס-השרטוט היא גל-המשך (ראה CVSM_BUILD_TRACKER Follow-up),
 * ולכן בחירת-סמל כאן מאשרת בטוסט בלבד.
 */
@Composable
fun SymbolPaletteHost(nav: NavController) {
    val context = LocalContext.current
    CadSymbolPalette(
        onPick = { def -> Toast.makeText(context, "נבחר סמל: ${def.he}", Toast.LENGTH_SHORT).show() },
        onBack = { nav.popBackStack() },
    )
}

/** תווית-עברית קצרה לסגנון-ראש-הקיר השמור (לכפתורים/כרטיסים). */
private fun wallHeadLabel(style: String?): String =
    runCatching { WallHeadProfile.HeadStyle.valueOf(style ?: "STRAIGHT").he }
        .getOrDefault(WallHeadProfile.HeadStyle.STRAIGHT.he)

/** סגנון-ראש-קיר קשור-לקיר-אמיתי: טוען מהקיר ושומר פר-קיר (מיגרציה 3→4). */
@Composable
fun WallHeadWallHost(nav: NavController, wallId: Long) {
    val scope = rememberCoroutineScope()
    val wall by repo.wall(wallId).collectAsStateWithLifecycle(null)
    val w = wall ?: return
    WallHeadStyleScreen(
        defaultHeightMm = Prefs.defaultWallHeightMm,
        title = "סגנון ראש · קיר ${w.idx + 1}",
        initialStyle = runCatching { WallHeadProfile.HeadStyle.valueOf(w.headStyle) }.getOrDefault(WallHeadProfile.HeadStyle.STRAIGHT),
        initialLengthMm = w.length,
        initialBaseMm = w.height,
        initialRidgeMm = w.headRidgeMm,
        initialPeakMm = w.headPeakMm,
        onSave = { style, ridgeMm, peakMm ->
            scope.launch {
                repo.saveWallHead(wallId, style.name, ridgeMm, peakMm)
                nav.popBackStack()
            }
        },
        onBack = { nav.popBackStack() },
    )
}

// ── מדידת P2P (X6 · בניית-זוויות + חיבור-T) ─────────────────────────────────
@Composable
fun P2PHost(nav: NavController, roomId: Long) {
    val scope = rememberCoroutineScope()
    val existing by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    var pending by remember { mutableStateOf<List<WallEntity>?>(null) }
    P2PMeasureScreen(
        roomId = roomId,
        defaultHeightMm = Prefs.defaultWallHeightMm,
        onDone = { newWalls ->
            if (existing.isEmpty()) scope.launch { addWizardWalls(roomId, newWalls, replace = false); nav.popBackStack() }
            else pending = newWalls
        },
        onBack = { nav.popBackStack() },
    )
    pending?.let { nw ->
        DuplicateWallsDialog(
            existingCount = existing.size,
            onReplace = { scope.launch { addWizardWalls(roomId, nw, replace = true); pending = null; nav.popBackStack() } },
            onAppend = { scope.launch { addWizardWalls(roomId, nw, replace = false); pending = null; nav.popBackStack() } },
            onCancel = { pending = null },
        )
    }
}

/** כל קירות-הפרויקט (איחוד flows של כל חדריו) — לאימות בהיקף-הייצוא (A8). */
@Composable
private fun rememberProjectWalls(roomIds: List<Long>): List<WallEntity> {
    val flow = remember(roomIds) {
        if (roomIds.isEmpty()) kotlinx.coroutines.flow.flowOf(emptyList<WallEntity>())
        else kotlinx.coroutines.flow.combine(roomIds.map { repo.walls(it) }) { arr -> arr.toList().flatten() }
    }
    val walls by flow.collectAsStateWithLifecycle(emptyList())
    return walls
}

// ── אימות לפני ייצוא (שער-הגשה) ─────────────────────────────────────────────
// A8: האימות רץ על **כל חדרי-הפרויקט** (בדיוק מה ש-exportSol אורז), לא על חדר-בודד.
@Composable
fun VerifyHost(nav: NavController, roomId: Long) {
    val room by repo.room(roomId).collectAsStateWithLifecycle(null)
    val pid = room?.projectId
    val rooms by remember(pid) {
        pid?.let { repo.rooms(it) } ?: kotlinx.coroutines.flow.flowOf(emptyList())
    }.collectAsStateWithLifecycle(emptyList())
    val roomIds = rooms.map { it.id }
    val walls = rememberProjectWalls(roomIds)
    val accMap = rememberAccessoriesByWall(walls)
    VerificationScreen(
        walls = walls,
        accessoriesByWall = accMap,
        onBack = { nav.popBackStack() },
        onProceed = { pid?.let { nav.navigate("rooms/$it") } ?: nav.popBackStack() },
        rooms = rooms,
    )
}

// ── סקר-מישוריות (רצפה/תקרה) ────────────────────────────────────────────────
@Composable
fun LevelHost(nav: NavController, roomId: Long, surface: String) {
    val scope = rememberCoroutineScope()
    val walls by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    val points by repo.levelPoints(roomId, surface).collectAsStateWithLifecycle(emptyList())
    LevelSurveyScreen(
        surface = surface,
        walls = walls,
        points = points,
        onSetZero = { raw -> scope.launch { repo.setLevelZero(roomId, surface, raw) } },
        onMeasure = { idx, x, y, raw, dev, noAngle -> scope.launch { repo.addLevelPoint(roomId, surface, idx, x, y, raw, dev, noAngle) } },
        onClear = { scope.launch { repo.clearLevel(roomId, surface) } },
        onBack = { nav.popBackStack() },
        onDeletePoint = { id -> scope.launch { repo.deleteLevelPoint(id) } },
    )
}

// ── פתיחת-עבודה עשירה (נגר → לקוח → דרכי-גישה → שרטוט) ──────────────────────
@Composable
fun IntakeHost(nav: NavController) {
    val scope = rememberCoroutineScope()
    JobIntakeScreen(
        onSave = { job ->
            scope.launch {
                repo.addJob(job)
                // שם-הפרויקט = שם-לקוח-הקצה (= שם-התיקייה); client = המפעל-המזמין (לזיהוי תיקיית-הגיבוי).
                val pid = repo.addProject(job.clientName.ifBlank { "עבודה חדשה" }, job.clientCompany)
                nav.navigate("rooms/$pid") { popUpTo("projects") }
            }
        },
        onBack = { nav.popBackStack() },
    )
}

// ── wall: accessories ─────────────────────────────────────────────────────
@Composable
fun WallScreen(nav: NavController, wallId: Long) {
    val scope = rememberCoroutineScope()
    val wall by repo.wall(wallId).collectAsStateWithLifecycle(null)
    val accs by repo.accessories(wallId).collectAsStateWithLifecycle(emptyList())
    var showAdd by remember { mutableStateOf(false) }
    // עריכת-בליטה בהקשה על השורה (A4/C1) — משתמש בעורך-האביזר של מסך-החזית.
    var editing by remember { mutableStateOf<AccessoryEntity?>(null) }
    val liveMm by SolineApp.instance.ble.lastReading.collectAsState()
    // צילום-מוצמד-לאלמנט (§4): טריגר-מצלמה משותף לעורך-האביזר (scope="element").
    val elementCapture = rememberPhotoCapture()

    Scaffold(containerColor = Cream, floatingActionButton = { AddFab { showAdd = true } }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            BrandHeader(wall?.let { "קיר ${it.idx + 1} · ${Prefs.lenValue(it.length)}×${Prefs.formatLen(it.height)}" } ?: "קיר", onBack = { nav.popBackStack() })
            Button(
                onClick = { nav.navigate("elevation/$wallId") },
                colors = ButtonDefaults.buttonColors(containerColor = Teal),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
            ) { Text("⬜  מצב-חזית מאוחד (גבהים + מסגרת)") }
            Button(
                onClick = { nav.navigate("shape/$wallId") },
                colors = ButtonDefaults.buttonColors(containerColor = Orange),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 6.dp),
            ) { Text("📐  מדידת מבט-על · בטן (undulation · X6)") }
            Button(
                onClick = { nav.navigate("cabinets/$wallId") },
                colors = ButtonDefaults.buttonColors(containerColor = Ink),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 6.dp),
            ) { Text("🗄️  ארונות (תכנון-הנגר)") }
            OutlinedButton(
                onClick = { nav.navigate("wallhead/$wallId") },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 6.dp),
            ) { Text("⌂  סגנון ראש קיר · ${wallHeadLabel(wall?.headStyle)}") }
            // 📷 צילום-חזית פר-קיר + רצועת-ממוזערות (פיצ'ר-תמונות · §1/§3).
            wall?.let { w -> WallPhotoBar(roomId = w.roomId, wallId = w.id, wallIdx = w.idx) }
            if (accs.isEmpty()) EmptyHint("אין בליטות על הקיר. הקש + (שקע/גז/מים/חלון…).")
            else LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {
                items(accs, key = { it.id }) { a ->
                    Card(Modifier.fillMaxWidth().padding(vertical = 5.dp), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            // הקשה על השורה פותחת עריכה (A4) — במקום הצפוי, לא רק בחזית.
                            Column(Modifier.weight(1f).clickable { editing = a }.padding(16.dp)) {
                                Text(a.name, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                                Text("עומק ${Prefs.formatLen(a.depth)} · מיקום ${Prefs.lenValue(a.fromLeft)} · גובה ${Prefs.lenValue(a.fromBottom)} · רוחב ${Prefs.lenValue(a.width)}", fontSize = 12.sp, color = Muted)
                                if (a.notes.isNotBlank()) Text("📝 ${a.notes}", fontSize = 12.sp, color = Teal, fontWeight = FontWeight.Medium)
                            }
                            IconButton(onClick = { editing = a }) { Text("✎", fontSize = 18.sp) }
                            IconButton(onClick = { scope.launch { repo.addAccessory(a.copy(id = 0, fromLeft = a.fromLeft + a.width + 50)) } }) { Text("📋", fontSize = 18.sp) }
                            IconButton(onClick = { scope.launch { repo.deleteAccessory(a) } }) { Icon(Icons.Default.Delete, "מחק", tint = BlockRed) }
                        }
                    }
                }
            }
        }
    }
    // הוספת-אלמנט: תחילה בורר-הקטלוג המלא (CVSM), ואז מידות מותאמות לאלמנט שנבחר
    var chosen by remember { mutableStateOf<ElementDef?>(null) }
    if (showAdd) {
        ElementPickerSheet(
            onPick = { def -> chosen = def; showAdd = false },
            onDismiss = { showAdd = false },
            onManageLibrary = { showAdd = false; nav.navigate("library") },
        )
    }
    chosen?.let { def ->
        AddAccessoryDialog(wallId, wall?.length ?: 0.0, def, onDismiss = { chosen = null })
    }
    editing?.let { a ->
        // צילום-מוצמד-לאלמנט זמין רק לאביזר-שמור (id>0) שיש-לו הקשר-קיר לשם-הקובץ.
        val canCapture = a.id > 0 && wall != null
        AccessoryEditor(
            title = "עריכת ${a.name}",
            initial = a,
            liveMm = liveMm?.distanceMm,
            liveHeightMm = laserHeightMm(liveMm?.distanceMm, liveMm?.vAngleDeg),
            confirmLabel = "שמור",
            onConfirm = { updated -> scope.launch { repo.updateAccessory(updated) }; editing = null },
            onDismiss = { editing = null },
            onCapturePhoto = if (canCapture) {
                {
                    val w = wall!!
                    elementCapture(
                        PhotoRequest(
                            roomId = w.roomId, wallId = w.id, wallIdx = w.idx,
                            scope = "element", elementId = a.id, kind = "detail",
                        ),
                    )
                }
            } else null,
        )
    }
}

@Composable
private fun AddAccessoryDialog(wallId: Long, wallLengthMm: Double, def: ElementDef, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    val spec = def.opening
    if (spec != null) {
        // ── פתח פרמטרי (דלת/חלון/מיזוג-איוורור): טופס ממולא בברירת-מחדל-יצרן ──
        var res by remember { mutableStateOf<OpeningResult?>(null) }
        var notes by remember { mutableStateOf("") } // הערת-מודד פר-אלמנט (§10)
        // שער-הזנה (קבוצה-D): רוחב/גובה>0, ההיסט הוזן-בפועל, ו-fromLeft לא-שלילי.
        val r0 = res
        val openingValid = r0 != null && r0.width > 0.0 && r0.height > 0.0 && r0.offsetProvided && r0.fromLeft >= 0.0
        FormDialog(def.he, onDismiss = onDismiss, confirmEnabled = openingValid, onConfirm = {
            val r = res
            if (r != null && openingValid) {
                val a = AccessoryEntity(
                    wallId = wallId, type = def.key, name = def.he,
                    depth = r.depth, fromLeft = r.fromLeft, width = r.width,
                    fromBottom = r.fromBottom, height = r.height,
                    openingKind = r.openingKind, sillHeight = r.sillHeight,
                    wallThickness = r.wallThickness, frameThickness = r.frameThickness,
                    frameReveal = r.frameReveal, leafThickness = r.leafThickness,
                    openMode = r.openMode, hingeSide = r.hingeSide, swing = r.swing,
                    leafCount = r.leafCount, glazing = r.glazing, fromCorner = r.fromCorner,
                    measured = r.measured, notes = notes.trim(),
                )
                scope.launch { repo.addAccessory(a) }
            }
            onDismiss()
        }) {
            Text("${def.he} · ${def.group}", fontSize = 13.sp, color = Teal, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 4.dp))
            OpeningMeasureFields(
                spec = spec,
                hasDepth = def.hasDepth,
                defaultDepth = def.defaultDepth,
                onValues = { res = it },
            )
            OutlinedTextField(
                notes, { notes = it }, label = { Text("📝 הערה לאלמנט (חופשי)") },
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            )
            if (!openingValid) Text(
                "יש להזין מיקום (היסט), רוחב וגובה תקינים (גדולים מ-0) לפני שמירה.",
                color = BlockRed, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp),
            )
        }
        return
    }

    // ── אלמנט-רגיל: fl, w, fb, h, d — משדות-המדידה (מרכז / היסטים-מפינות) ──
    var vals by remember { mutableStateOf(doubleArrayOf(0.0, 0.0, 0.0, 0.0, 0.0)) }
    var measured by remember { mutableStateOf(false) }
    var notes by remember { mutableStateOf("") } // הערת-מודד פר-אלמנט (§10)
    // שער-הזנה (קבוצה-D): רוחב/גובה>0 ו-fromLeft לא-שלילי (מצב-מרכז יכול לגזור שלילי).
    val elementValid = vals[1] > 0.0 && vals[3] > 0.0 && vals[0] >= 0.0

    FormDialog(def.he, onDismiss = onDismiss, confirmEnabled = elementValid, onConfirm = {
        if (!elementValid) return@FormDialog
        val a = AccessoryEntity(
            wallId = wallId, type = def.key, name = def.he,
            depth = vals[4], fromLeft = vals[0], width = vals[1], fromBottom = vals[2], height = vals[3],
            measured = measured, notes = notes.trim(),
        )
        scope.launch { repo.addAccessory(a) }; onDismiss()
    }) {
        Text("${def.he} · ${def.group}", fontSize = 13.sp, color = Teal, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 4.dp))
        ElementMeasureFields(
            wallLengthMm = wallLengthMm,
            hasDepth = def.hasDepth,
            round = def.round,
            defaultDepth = def.defaultDepth,
            onValues = { fl, w, fb, h, d, m -> vals = doubleArrayOf(fl, w, fb, h, d); measured = m },
        )
        OutlinedTextField(
            notes, { notes = it }, label = { Text("📝 הערה לאלמנט (חופשי)") },
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
        )
        if (!elementValid) Text(
            "יש להזין רוחב וגובה תקינים (גדולים מ-0) ומיקום לא-שלילי לפני שמירה.",
            color = BlockRed, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp),
        )
    }
}

// ── generic form dialog ───────────────────────────────────────────────────
@Composable
private fun FormDialog(title: String, onDismiss: () -> Unit, onConfirm: () -> Unit, confirmEnabled: Boolean = true, body: @Composable ColumnScope.() -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        // שער-הזנה (קבוצה-D): "שמור" כבוי עד שהמידות תקינות (רוחב/גובה>0, מיקום לא-שלילי).
        confirmButton = { TextButton(onClick = onConfirm, enabled = confirmEnabled) { Text("שמור", color = if (confirmEnabled) Orange else Muted, fontWeight = FontWeight.Bold) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) } },
        title = { Text(title, fontWeight = FontWeight.Bold) },
        text = { Column(Modifier.verticalScroll(rememberScrollState())) { body() } },
        containerColor = Color.White,
        // טופס-הזנה: לא-נסגר בהקשה-מחוץ (מונע איבוד-קלט בטעות · P0-2). Back עדיין סוגר.
        properties = DialogProperties(dismissOnClickOutside = false),
    )
}
