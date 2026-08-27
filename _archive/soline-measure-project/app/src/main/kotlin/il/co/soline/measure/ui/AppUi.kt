package il.co.soline.measure.ui

import androidx.compose.foundation.background
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
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
import androidx.navigation.compose.rememberNavController
import il.co.soline.measure.data.AccType
import il.co.soline.measure.data.AccessoryEntity
import il.co.soline.measure.data.CabinetEntity
import il.co.soline.measure.data.JobEntity
import il.co.soline.measure.data.LevelSurface
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.fit.FitDelta
import il.co.soline.measure.fit.Severity
import il.co.soline.measure.ui.draw.LiveCadScreen
import il.co.soline.measure.ui.measure.MeasureCaptureScreen
import il.co.soline.measure.ui.view3d.Room3DView
import il.co.soline.measure.ui.cad.CadDimensionEditor
import il.co.soline.measure.ui.elevation.WallElevationUnified
import il.co.soline.measure.ui.home.HomeScreen
import il.co.soline.measure.ui.settings.SettingsScreen
import il.co.soline.measure.ui.shape.WallShapeCapture
import il.co.soline.measure.ui.cabinet.CabinetScreen
import il.co.soline.measure.ui.resize.DatumMeasureScreen
import il.co.soline.measure.ui.semiauto.SemiAutoOutlineScreen
import il.co.soline.measure.ui.verify.VerificationScreen
import il.co.soline.measure.ui.intake.JobIntakeScreen
import il.co.soline.measure.ui.level.LevelSurveyScreen
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
            NavHost(nav, startDestination = "projects") {
                composable("projects") { HomeScreen(nav) }
                composable("devices") { DevicesScreen(nav) }
                composable("settings") { SettingsScreen(onBack = { nav.popBackStack() }) }
                composable("shape/{wid}") { e -> e.longArg("wid")?.let { ShapeHost(nav, it) } }
                composable("rooms/{pid}") { e -> e.longArg("pid")?.let { ProjectRoomsScreen(nav, it) } }
                composable("room/{rid}") { e -> e.longArg("rid")?.let { RoomScreen(nav, it) } }
                composable("draw/{rid}") { e -> e.longArg("rid")?.let { DrawScreenHost(nav, it) } }
                composable("measure/{rid}") { e -> e.longArg("rid")?.let { MeasureHost(nav, it) } }
                composable("view3d/{rid}") { e -> e.longArg("rid")?.let { Room3DHost(nav, it) } }
                composable("cad/{rid}") { e -> e.longArg("rid")?.let { CadHost(nav, it) } }
                composable("elevation/{wid}") { e -> e.longArg("wid")?.let { ElevationHost(nav, it) } }
                composable("wall/{wid}") { e -> e.longArg("wid")?.let { WallScreen(nav, it) } }
                composable("cabinets/{wid}") { e -> e.longArg("wid")?.let { CabinetHost(nav, it) } }
                composable("datum/{rid}") { e -> e.longArg("rid")?.let { DatumHost(nav, it) } }
                composable("semiauto/{rid}") { e -> e.longArg("rid")?.let { SemiAutoHost(nav, it) } }
                composable("verify/{rid}") { e -> e.longArg("rid")?.let { VerifyHost(nav, it) } }
                composable("floor/{rid}") { e -> e.longArg("rid")?.let { LevelHost(nav, it, LevelSurface.FLOOR) } }
                composable("ceiling/{rid}") { e -> e.longArg("rid")?.let { LevelHost(nav, it, LevelSurface.CEILING) } }
                composable("intake") { IntakeHost(nav) }
            }
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

/** שדה מספרי חכם: בפוקוס — **קליטה אחת** מהמדידה הבאה של הלייזר (לא הצפה מרצף-מדידות) */
@Composable
private fun numField(label: String, state: MutableState<String>) {
    val ble = SolineApp.instance.ble
    val last by ble.lastReading.collectAsState()
    var focused by remember { mutableStateOf(false) }
    // קולט רק מדידה שמגיעה *אחרי* הפוקוס, ופעם-אחת בלבד (מונע "השתגעות" משדר-רציף)
    var armedFrom by remember { mutableStateOf(Long.MAX_VALUE) }
    LaunchedEffect(last) {
        val r = last
        if (r?.distanceMm != null && r.ts > armedFrom) {
            armedFrom = Long.MAX_VALUE   // one-shot — עד פוקוס מחדש
            state.value = Math.round(r.distanceMm).toString()
        }
    }
    OutlinedTextField(
        value = state.value, onValueChange = { state.value = it },
        label = { Text(if (focused) "$label  📡 מדוד פעם אחת" else label) }, singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
            .onFocusChanged { fs ->
                focused = fs.isFocused
                armedFrom = if (fs.isFocused) (last?.ts ?: 0L) else Long.MAX_VALUE
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

    Scaffold(containerColor = Cream, floatingActionButton = { AddFab { showAdd = true } }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            BrandHeader("חדרים", onBack = { nav.popBackStack() })
            OutlinedButton(
                onClick = {
                    project?.let { p ->
                        scope.launch {
                            try {
                                val dir = java.io.File(context.filesDir, "exports").apply { mkdirs() }
                                val f = java.io.File(dir, SolWriter.fileName(p))
                                f.outputStream().use { repo.exportSol(p, it) }
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
                },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            ) { Text("⬇  ייצוא לממיר (.sol → ORDX/PDP/DXF)") }
            if (rooms.isEmpty()) EmptyHint("אין חדרים. הקש + כדי להוסיף חדר.")
            else LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {
                items(rooms, key = { it.id }) { r ->
                    ListCard(r.name, "פתח למדידת קירות") { nav.navigate("room/${r.id}") }
                }
            }
        }
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
    var showAdd by remember { mutableStateOf(false) }
    var fit by remember { mutableStateOf<List<FitDelta>?>(null) }

    Scaffold(containerColor = Cream, floatingActionButton = { AddFab { showAdd = true } }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            BrandHeader("קירות החדר", onBack = { nav.popBackStack() })
            Button(
                onClick = { nav.navigate("draw/$roomId") },
                colors = ButtonDefaults.buttonColors(containerColor = Orange),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            ) { Text("🖉  שרטוט חי (CAD)") }
            Spacer(Modifier.height(6.dp))
            Button(
                onClick = { nav.navigate("measure/$roomId") },
                colors = ButtonDefaults.buttonColors(containerColor = Orange),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            ) { Text("📐  מדידה חיה (לייזר → קיר)") }
            Spacer(Modifier.height(6.dp))
            OutlinedButton(
                onClick = { nav.navigate("semiauto/$roomId") },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            ) { Text("✎  שרטוט חצי-אוטומטי (היקף-החדר)") }
            Spacer(Modifier.height(6.dp))
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                OutlinedButton(onClick = { nav.navigate("view3d/$roomId") }, modifier = Modifier.weight(1f)) { Text("🧊 תלת-מימד") }
                Spacer(Modifier.width(8.dp))
                OutlinedButton(onClick = { nav.navigate("cad/$roomId") }, modifier = Modifier.weight(1f)) { Text("✏️ עריכת מידות") }
            }
            Spacer(Modifier.height(6.dp))
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                OutlinedButton(onClick = { nav.navigate("datum/$roomId") }, modifier = Modifier.weight(1f)) { Text("📍 מדידת Datum") }
                Spacer(Modifier.width(8.dp))
                OutlinedButton(onClick = { nav.navigate("verify/$roomId") }, modifier = Modifier.weight(1f)) { Text("✓ אימות לייצוא") }
            }
            Spacer(Modifier.height(6.dp))
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                OutlinedButton(onClick = { nav.navigate("floor/$roomId") }, modifier = Modifier.weight(1f)) { Text("▦ מדידת רצפה") }
                Spacer(Modifier.width(8.dp))
                OutlinedButton(onClick = { nav.navigate("ceiling/$roomId") }, modifier = Modifier.weight(1f)) { Text("▤ מדידת תקרה") }
            }
            Spacer(Modifier.height(6.dp))
            Button(
                onClick = { scope.launch { fit = repo.runFit(roomId) } },
                colors = ButtonDefaults.buttonColors(containerColor = Teal),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            ) { Text("בדיקת התאמה (R4 — בליטה מול עומק)") }

            fit?.let { FitResults(it) }

            if (walls.isEmpty()) EmptyHint("אין קירות. הקש + כדי להוסיף קיר.")
            else LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {
                items(walls, key = { it.id }) { w ->
                    ListCard("קיר ${w.idx + 1}", "אורך ${w.length.toInt()} מ\"מ · גובה ${w.height.toInt()} מ\"מ") {
                        nav.navigate("wall/${w.id}")
                    }
                }
            }
        }
    }
    if (showAdd) {
        val len = remember { mutableStateOf("") }
        val hgt = remember { mutableStateOf(Prefs.defaultWallHeightMm.toInt().toString()) }
        FormDialog("קיר חדש", onDismiss = { showAdd = false }, onConfirm = {
            val l = len.value.toDoubleOrNull(); val h = hgt.value.toDoubleOrNull()
            if (l != null && h != null) { scope.launch { repo.addWall(roomId, l, h) }; showAdd = false }
        }) {
            numField("אורך הקיר (מ\"מ)", len)
            numField("גובה הקיר (מ\"מ)", hgt)
        }
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
                        (if (block) "חסימה" else "אזהרה") + " · ${d.rule} · חריגה ${d.delta} מ\"מ",
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
    )
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
    wall?.let { w ->
        WallElevationUnified(
            wall = w,
            accessories = accs,
            initialFramePoints = parseFramePoints(w.framePointsJson),
            onFramePoints = { pts -> scope.launch { repo.saveWallFramePoints(wallId, framePointsToJson(pts)) } },
            onUpdateAccessory = { a -> scope.launch { repo.updateAccessory(a) } },
            onAddAccessory = { a -> scope.launch { repo.addAccessory(a.copy(wallId = wallId)) } },
            onBack = { nav.popBackStack() },
        )
    }
}

/** מדידת-מסגרת ב-X6 → נשמרת כ-framePointsJson על הקיר (מוזנת לתצוגת-החזית). */
@Composable
fun ShapeHost(nav: NavController, wallId: Long) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    WallShapeCapture(
        onDone = { pts ->
            val fp = pts.map { it.first to it.second }
            scope.launch { repo.saveWallFramePoints(wallId, framePointsToJson(fp)) }
            Toast.makeText(context, "נשמרו ${pts.size} נקודות למסגרת-החזית", Toast.LENGTH_LONG).show()
            nav.popBackStack()
        },
        onBack = { nav.popBackStack() },
    )
}

// ── עזרי-JSON למסגרת-החזית: [[x,y],...] מ"מ ──────────────────────────────────
private fun parseFramePoints(json: String): List<Pair<Double, Double>> {
    if (json.isBlank()) return emptyList()
    return try {
        val arr = org.json.JSONArray(json)
        (0 until arr.length()).map { i ->
            val p = arr.getJSONArray(i)
            p.getDouble(0) to p.getDouble(1)
        }
    } catch (e: Exception) { emptyList() }
}

private fun framePointsToJson(pts: List<Pair<Double, Double>>): String {
    val arr = org.json.JSONArray()
    for (p in pts) arr.put(org.json.JSONArray().put(p.first).put(p.second))
    return arr.toString()
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

// ── מדידת Datum (טרילטרציה) ─────────────────────────────────────────────────
@Composable
fun DatumHost(nav: NavController, roomId: Long) {
    val context = LocalContext.current
    val walls by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    DatumMeasureScreen(
        walls = walls,
        onResult = { msg -> Toast.makeText(context, msg, Toast.LENGTH_LONG).show() },
        onBack = { nav.popBackStack() },
    )
}

// ── שרטוט חצי-אוטומטי (היקף-החדר) ───────────────────────────────────────────
@Composable
fun SemiAutoHost(nav: NavController, roomId: Long) {
    val scope = rememberCoroutineScope()
    SemiAutoOutlineScreen(
        roomId = roomId,
        onDone = { newWalls ->
            scope.launch {
                for (w in newWalls) repo.addWall(roomId, w.length, if (w.height > 0) w.height else Prefs.defaultWallHeightMm, w.angle)
                nav.popBackStack()
            }
        },
        onBack = { nav.popBackStack() },
    )
}

// ── אימות לפני ייצוא (שער-הגשה) ─────────────────────────────────────────────
@Composable
fun VerifyHost(nav: NavController, roomId: Long) {
    val walls by repo.walls(roomId).collectAsStateWithLifecycle(emptyList())
    val room by repo.room(roomId).collectAsStateWithLifecycle(null)
    val accMap = rememberAccessoriesByWall(walls)
    VerificationScreen(
        walls = walls,
        accessoriesByWall = accMap,
        onBack = { nav.popBackStack() },
        onProceed = { room?.let { nav.navigate("rooms/${it.projectId}") } ?: nav.popBackStack() },
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
        onMeasure = { idx, x, y, raw, dev -> scope.launch { repo.addLevelPoint(roomId, surface, idx, x, y, raw, dev) } },
        onClear = { scope.launch { repo.clearLevel(roomId, surface) } },
        onBack = { nav.popBackStack() },
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
                val pid = repo.addProject(job.clientName.ifBlank { "עבודה חדשה" }, job.clientName)
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

    Scaffold(containerColor = Cream, floatingActionButton = { AddFab { showAdd = true } }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            BrandHeader(wall?.let { "קיר ${it.idx + 1} · ${it.length.toInt()}×${it.height.toInt()} מ\"מ" } ?: "קיר", onBack = { nav.popBackStack() })
            Button(
                onClick = { nav.navigate("elevation/$wallId") },
                colors = ButtonDefaults.buttonColors(containerColor = Teal),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
            ) { Text("⬜  מצב-חזית מאוחד (גבהים + מסגרת)") }
            Button(
                onClick = { nav.navigate("shape/$wallId") },
                colors = ButtonDefaults.buttonColors(containerColor = Orange),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 6.dp),
            ) { Text("📐  מדידת חזית (מסגרת נקודות · X6)") }
            Button(
                onClick = { nav.navigate("cabinets/$wallId") },
                colors = ButtonDefaults.buttonColors(containerColor = Ink),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 6.dp),
            ) { Text("🗄️  ארונות (תכנון-הנגר)") }
            if (accs.isEmpty()) EmptyHint("אין בליטות על הקיר. הקש + (שקע/גז/מים/חלון…).")
            else LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp)) {
                items(accs, key = { it.id }) { a ->
                    Card(Modifier.fillMaxWidth().padding(vertical = 5.dp), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(a.name, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                                Text("עומק ${a.depth.toInt()} מ\"מ · מיקום ${a.fromLeft.toInt()} · גובה ${a.fromBottom.toInt()} · רוחב ${a.width.toInt()}", fontSize = 12.sp, color = Muted)
                            }
                            IconButton(onClick = { scope.launch { repo.deleteAccessory(a) } }) { Icon(Icons.Default.Delete, "מחק", tint = BlockRed) }
                        }
                    }
                }
            }
        }
    }
    if (showAdd) AddAccessoryDialog(wallId, onDismiss = { showAdd = false })
}

@Composable
private fun AddAccessoryDialog(wallId: Long, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    var type by remember { mutableStateOf(AccType.SOCKET_SINGLE) }
    var menu by remember { mutableStateOf(false) }
    val depth = remember { mutableStateOf(type.defaultDepth.toInt().toString()) }
    val fromLeft = remember { mutableStateOf("") }
    val width = remember { mutableStateOf("85") }
    val fromBottom = remember { mutableStateOf("300") }
    val height = remember { mutableStateOf("77") }

    FormDialog("בליטה חדשה", onDismiss = onDismiss, onConfirm = {
        val a = AccessoryEntity(
            wallId = wallId, type = type.name, name = type.he,
            depth = depth.value.toDoubleOrNull() ?: 0.0,
            fromLeft = fromLeft.value.toDoubleOrNull() ?: 0.0,
            width = width.value.toDoubleOrNull() ?: 0.0,
            fromBottom = fromBottom.value.toDoubleOrNull() ?: 0.0,
            height = height.value.toDoubleOrNull() ?: 0.0,
        )
        scope.launch { repo.addAccessory(a) }; onDismiss()
    }) {
        Box {
            OutlinedButton(onClick = { menu = true }, modifier = Modifier.fillMaxWidth()) { Text("סוג: ${type.he}") }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                AccType.entries.forEach { t ->
                    DropdownMenuItem(text = { Text(t.he) }, onClick = { type = t; depth.value = t.defaultDepth.toInt().toString(); menu = false })
                }
            }
        }
        numField("עומק-בליטה D (מ\"מ)", depth)
        numField("מיקום משמאל (מ\"מ)", fromLeft)
        numField("רוחב (מ\"מ)", width)
        numField("גובה מהרצפה (מ\"מ)", fromBottom)
        numField("גובה האלמנט (מ\"מ)", height)
    }
}

// ── generic form dialog ───────────────────────────────────────────────────
@Composable
private fun FormDialog(title: String, onDismiss: () -> Unit, onConfirm: () -> Unit, body: @Composable ColumnScope.() -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onConfirm) { Text("שמור", color = Orange, fontWeight = FontWeight.Bold) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) } },
        title = { Text(title, fontWeight = FontWeight.Bold) },
        text = { Column(Modifier.verticalScroll(rememberScrollState())) { body() } },
        containerColor = Color.White,
    )
}
