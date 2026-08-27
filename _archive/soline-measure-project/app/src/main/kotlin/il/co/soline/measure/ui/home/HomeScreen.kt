package il.co.soline.measure.ui.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import il.co.soline.measure.data.Project
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/*
 * מסך-הבית של Soline Measure — לוח-בקרה מקצועי למודד-שטח.
 * "עושה סדר" למודד: מכשיר-מדידה כצ'יפ קטן בסרגל-העליון, עבודות-מהמשרד, הפרויקטים שלי,
 * ופעולות-מהירות. RTL עברית, צבעי-מותג. עצמאי לחלוטין — נשען רק על טיפוסים יציבים.
 *
 * המקטע "סידור העבודה שלי מהמשרד" הוא שלד מוכן להזרקת work-orders מהמשרד
 * (WORKFLOW.md · ROLES_PERMISSIONS.md — המתאם משבץ עבודות למודד). כרגע ריק, מבנה מוכן.
 */

/** work-order שהמשרד מזריק למודד. מבנה עתידי — כרגע הרשימה ריקה (empty-state). */
private data class WorkOrder(
    val id: String,
    val title: String,
    val client: String,
    val address: String,
    val stage: String, // job.stage: scheduled / in_field / measured ...
)

/** בשלב הנוכחי אין backend — הרשימה ריקה, אך ה-UI מוכן להזרקה מהמשרד. */
private val officeWorkOrders: List<WorkOrder> = emptyList()

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(nav: NavController, modifier: Modifier = Modifier) {
    val repo = SolineApp.instance.repo
    val ble = SolineApp.instance.ble
    val scope = rememberCoroutineScope()

    val projects by repo.projects().collectAsStateWithLifecycle(emptyList())
    val connected by ble.connected.collectAsState()

    var showAdd by remember { mutableStateOf(false) }
    val today = remember { LocalDate.now() }

    // עצמאי: מבטיח RTL גם אם המסך יוצג מחוץ ל-root
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Scaffold(modifier = modifier, containerColor = Cream) { pad ->
            Column(Modifier.padding(pad).fillMaxSize()) {
                TopBar(
                    connectedName = connected,
                    onDevices = { nav.navigate("devices") },
                    onSettings = { nav.navigate("settings") },
                )
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    item { Greeting(today) }
                    item {
                        QuickActions(
                            onNewJob = { nav.navigate("intake") },
                            onNewProject = { showAdd = true },
                            onDevices = { nav.navigate("devices") },
                        )
                    }

                    item { SectionHeader("סידור העבודה שלי מהמשרד", if (officeWorkOrders.isEmpty()) null else "${officeWorkOrders.size} עבודות") }
                    if (officeWorkOrders.isEmpty()) {
                        item { OfficeEmptyCard() }
                    } else {
                        items(officeWorkOrders, key = { it.id }) { wo -> WorkOrderCard(wo) }
                    }

                    item {
                        SectionHeader("הפרויקטים שלי", if (projects.isEmpty()) null else "${projects.size} פרויקטים")
                    }
                    if (projects.isEmpty()) {
                        item { EmptyProjectsCard(onNewProject = { showAdd = true }) }
                    } else {
                        items(projects, key = { it.id }) { p ->
                            ProjectCard(p) { nav.navigate("rooms/${p.id}") }
                        }
                    }

                    item { Spacer(Modifier.height(24.dp)) }
                }
            }
        }
    }

    if (showAdd) {
        NewProjectDialog(
            onDismiss = { showAdd = false },
            onCreate = { name, client ->
                scope.launch {
                    val id = repo.addProject(name.trim(), client.trim())
                    nav.navigate("rooms/$id")
                }
                showAdd = false
            },
        )
    }
}

// ── סרגל עליון ──────────────────────────────────────────────────────────────
@Composable
private fun TopBar(connectedName: String?, onDevices: () -> Unit, onSettings: () -> Unit) {
    Surface(color = Color.White, shadowElevation = 2.dp) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // מיתוג (בצד-ימין ב-RTL)
            Column(Modifier.weight(1f)) {
                Text("soline", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Orange, lineHeight = 28.sp)
                Text("SMART SPATIAL SOLUTIONS", fontSize = 10.sp, color = Teal, letterSpacing = 2.sp)
            }
            // פעולות קומפקטיות (בצד-שמאל ב-RTL)
            DeviceStatusChip(connectedName, onDevices)
            Spacer(Modifier.width(8.dp))
            IconButton(onClick = onSettings) {
                Icon(Icons.Default.Settings, contentDescription = "הגדרות", tint = Muted)
            }
        }
    }
}

/** צ'יפ קומפקטי לסטטוס-מכשיר: נקודה ירוקה + שם כשמחובר, אפור כשלא. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DeviceStatusChip(connectedName: String?, onClick: () -> Unit) {
    val connected = connectedName != null
    val dot = if (connected) OkGreen else Muted
    val bg = if (connected) OkGreen.copy(alpha = 0.10f) else Color(0xFFF0F0F0)
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(50),
        color = bg,
        border = BorderStroke(1.dp, dot.copy(alpha = 0.35f)),
    ) {
        Row(
            Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("📶", fontSize = 13.sp)
            Spacer(Modifier.width(6.dp))
            Box(Modifier.size(8.dp).clip(CircleShape).background(dot))
            Spacer(Modifier.width(6.dp))
            Text(
                text = connectedName ?: "לא מחובר",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (connected) Ink else Muted,
                maxLines = 1,
            )
        }
    }
}

// ── ברכה + תאריך ────────────────────────────────────────────────────────────
@Composable
private fun Greeting(today: LocalDate) {
    Column(Modifier.padding(top = 4.dp, bottom = 2.dp)) {
        Text("שלום", fontSize = 15.sp, color = Muted)
        Text("סידור העבודה שלך להיום", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Ink)
        Text(hebrewDate(today), fontSize = 13.sp, color = Teal, modifier = Modifier.padding(top = 4.dp))
    }
}

// ── פעולות מהירות ───────────────────────────────────────────────────────────
@Composable
private fun QuickActions(onNewJob: () -> Unit, onNewProject: () -> Unit, onDevices: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(
            onClick = onNewJob,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Orange),
        ) {
            Icon(Icons.Default.Add, contentDescription = null, tint = Color.White)
            Spacer(Modifier.width(8.dp))
            Text("פתיחת עבודה (נגר ← לקוח)", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
        OutlinedButton(
            onClick = onNewProject,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, Orange.copy(alpha = 0.4f)),
        ) { Text("＋  פרויקט מהיר (ללא פרטי-לקוח)", color = Orange, fontWeight = FontWeight.SemiBold) }
        OutlinedButton(
            onClick = onDevices,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, Teal.copy(alpha = 0.4f)),
        ) { Text("📶  מכשירי מדידה", color = Teal, fontWeight = FontWeight.SemiBold) }
    }
}

// ── כותרות מקטע ─────────────────────────────────────────────────────────────
@Composable
private fun SectionHeader(title: String, badge: String?) {
    Row(
        Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.weight(1f))
        if (badge != null) {
            Surface(shape = RoundedCornerShape(50), color = Orange.copy(alpha = 0.12f)) {
                Text(badge, fontSize = 12.sp, color = Orange, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp))
            }
        }
    }
}

// ── עבודות מהמשרד ───────────────────────────────────────────────────────────
@Composable
private fun OfficeEmptyCard() {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Muted.copy(alpha = 0.18f)),
    ) {
        Column(Modifier.fillMaxWidth().padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("📥", fontSize = 30.sp)
            Spacer(Modifier.height(8.dp))
            Text("אין עבודות מהמשרד עדיין", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ink)
            Text(
                "כשהמשרד ישבץ לך עבודה, היא תופיע כאן עם לקוח, כתובת וסטטוס.",
                fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun WorkOrderCard(wo: WorkOrder) {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(wo.title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                Text("לקוח: ${wo.client}", fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 2.dp))
                if (wo.address.isNotBlank()) {
                    Text("📍 ${wo.address}", fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 2.dp))
                }
            }
            StageChip(wo.stage)
        }
    }
}

/** צ'יפ-סטטוס לפי job.stage (WORKFLOW.md). ברירת-מחדל אפורה לשלב לא-מוכר. */
@Composable
private fun StageChip(stage: String) {
    val (label, color) = when (stage) {
        "scheduled" -> "בתיאום מועד" to Teal
        "in_field" -> "יציאה לשטח" to Orange
        "measured" -> "נמדד" to OkGreen
        "review" -> "בבדיקה" to Teal
        else -> stage to Muted
    }
    Surface(shape = RoundedCornerShape(50), color = color.copy(alpha = 0.12f)) {
        Text(label, fontSize = 12.sp, color = color, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
    }
}

// ── פרויקטים ────────────────────────────────────────────────────────────────
@Composable
private fun EmptyProjectsCard(onNewProject: () -> Unit) {
    Card(
        onClick = onNewProject,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Orange.copy(alpha = 0.3f)),
    ) {
        Column(Modifier.fillMaxWidth().padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("אין פרויקטים עדיין", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ink)
            Text("הקש כאן או על \"פרויקט חדש\" כדי להתחיל.", fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

@Composable
private fun ProjectCard(p: Project, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Orange.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) { Text("📐", fontSize = 20.sp) }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(p.name, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                Text(
                    if (p.client.isNotBlank()) "לקוח: ${p.client}" else "ללא לקוח",
                    fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 2.dp),
                )
            }
            Text(shortDate(p.createdAt), fontSize = 12.sp, color = Muted)
        }
    }
}

// ── דיאלוג פרויקט חדש ───────────────────────────────────────────────────────
@Composable
private fun NewProjectDialog(onDismiss: () -> Unit, onCreate: (String, String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var client by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                onClick = { if (name.isNotBlank()) onCreate(name, client) },
                enabled = name.isNotBlank(),
            ) { Text("צור והמשך", color = Orange, fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) } },
        title = { Text("פרויקט חדש", fontWeight = FontWeight.Bold) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                OutlinedTextField(
                    value = name, onValueChange = { name = it },
                    label = { Text("שם הפרויקט") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = client, onValueChange = { client = it },
                    label = { Text("לקוח (רשות)") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
            }
        },
        containerColor = Color.White,
    )
}

// ── תאריך בעברית ────────────────────────────────────────────────────────────
private val HE_DAYS = arrayOf(
    "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת", "יום ראשון",
) // DayOfWeek.value: 1=Mon .. 7=Sun
private val HE_MONTHS = arrayOf(
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
)

private fun hebrewDate(d: LocalDate): String {
    val day = HE_DAYS[d.dayOfWeek.value - 1]
    val month = HE_MONTHS[d.monthValue - 1]
    return "$day · ${d.dayOfMonth} ב$month ${d.year}"
}

private fun shortDate(epochMillis: Long): String {
    val d = Instant.ofEpochMilli(epochMillis).atZone(ZoneId.systemDefault()).toLocalDate()
    return "%02d.%02d.%d".format(d.dayOfMonth, d.monthValue, d.year)
}
