package il.co.soline.measure.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import il.co.soline.measure.data.JobEntity
import il.co.soline.measure.data.JobStatus
import il.co.soline.measure.data.Project
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.components.BigActionButton
import il.co.soline.measure.ui.components.EmptyState
import il.co.soline.measure.ui.components.SectionHeader
import il.co.soline.measure.ui.components.SolineButton
import il.co.soline.measure.ui.components.SolineButtonStyle
import il.co.soline.measure.ui.components.SolineCard
import il.co.soline.measure.ui.ops.JobStatusChip
import il.co.soline.measure.ui.ops.heTime
import il.co.soline.measure.ui.ops.isToday
import il.co.soline.measure.data.RetestSync
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/*
 * מסך-הבית של Soline Measure — לוח-בקרה תפעולי (ניהול + שטח באותו מסך).
 * למנהל: מדדי-היום (פתוחות/נמדדו/לתזמון), לו"ז-היום, וכניסות-ניהול (לו"ז + מדידות).
 * למודד: סטטוס-לייזר, פתיחת-עבודה, המשך-אחרון, פרויקט-מהיר — כולם נשמרו ונגישים.
 * RTL עברית, צבעי-מותג, יעדי-מגע גדולים — נוח לטאבלט במשרד וגם ביד בשטח.
 * בנוי על ui.components.* + ui.ops.* לשפה-ויזואלית אחת בכל האפליקציה.
 */

@Composable
fun HomeScreen(nav: NavController, modifier: Modifier = Modifier) {
    val repo = SolineApp.instance.repo
    val scope = rememberCoroutineScope()

    val projects by repo.projects().collectAsStateWithLifecycle(emptyList())
    val jobs by repo.jobs().collectAsStateWithLifecycle(emptyList())

    var showAdd by remember { mutableStateOf(false) }
    val today = remember { LocalDate.now() }

    // "המשך עבודה אחרונה" — הפרויקט העדכני ביותר (חזרה-בקליק-אחד אל השטח)
    val lastProject = remember(projects) { projects.maxByOrNull { it.createdAt } }

    // מדדי-היום מתוך העבודות
    val openCount = remember(jobs) { jobs.count { JobStatus.isOpen(it.status) } }
    val measuredCount = remember(jobs) { jobs.count { it.status == JobStatus.MEASURED || it.status == JobStatus.REVIEW || it.status == JobStatus.DONE } }
    val pendingCount = remember(jobs) { jobs.count { it.scheduledAt <= 0L && it.status != JobStatus.DONE } }
    val todayJobs = remember(jobs, today) { jobs.filter { isToday(it.scheduledAt, today) }.sortedBy { it.scheduledAt } }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Scaffold(modifier = modifier, containerColor = Cream) { pad ->
            Column(Modifier.padding(pad).fillMaxSize()) {
                TopBar(
                    onSettings = { nav.navigate("settings") },
                )
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item { Greeting(today) }

                    // מדדי-היום — ריכוז-מצב מיידי למנהל
                    item {
                        StatsRow(
                            open = openCount,
                            measured = measuredCount,
                            pending = pendingCount,
                            onOpenSchedule = { nav.navigate("schedule") },
                        )
                    }

                    // כניסת-ניהול: לו"ז בלבד (המודד ביקש בלי 'ניהול מדידות')
                    item {
                        ManageRow(
                            todayCount = todayJobs.size,
                            onSchedule = { nav.navigate("schedule") },
                        )
                    }

                    // מרכז-הבאגים באפליקציה: בדיקות-פתוחות + הבאגים-שלי
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            RetestEntryCard(Modifier.weight(1f)) { nav.navigate("retest") }
                            ManageCard(
                                emoji = "🐞", title = "הבאגים שלי",
                                subtitle = "דיווחים + סטטוס",
                                accent = Orange, onClick = { nav.navigate("mybugs") },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }

                    // פתיחת-פרויקט מסודרת (בלי 'פעולות מהירות' — פותחים לפי הסכמה המסודרת)
                    item { SectionHeader("פתיחת פרויקט") }
                    item {
                        PrimaryActions(
                            lastProjectName = lastProject?.name,
                            onNewJob = { nav.navigate("intake") },
                            onContinueLast = { lastProject?.let { nav.navigate("rooms/${it.id}") } },
                        )
                    }

                    item { SectionHeader("הפרויקטים האחרונים", badge = if (projects.isEmpty()) null else "${projects.size}") }
                    if (projects.isEmpty()) {
                        item {
                            EmptyState(
                                emoji = "📐",
                                title = "אין פרויקטים עדיין",
                                subtitle = "פתח עבודה חדשה או צור פרויקט מהיר כדי להתחיל למדוד.",
                                actionText = "＋ פרויקט מהיר",
                                onAction = { showAdd = true },
                            )
                        }
                    } else {
                        items(projects.take(5), key = { it.id }) { p ->
                            ProjectCard(p) { nav.navigate("rooms/${p.id}") }
                        }
                        if (projects.size > 5) {
                            item {
                                SolineButton(
                                    text = "לכל המדידות (${projects.size})",
                                    onClick = { nav.navigate("measurements") },
                                    style = SolineButtonStyle.SECONDARY,
                                    accent = Teal,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
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
private fun TopBar(onSettings: () -> Unit) {
    Surface(color = Color.White, shadowElevation = 2.dp) {
        // לוגו ממורכז (בקשת-המודד), גלגל-הגדרות בקצה. חיבור-לייזר עבר לסרגל-הכלים (📡).
        Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
            Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("soline", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Orange, lineHeight = 28.sp)
                Text("SMART SPATIAL SOLUTIONS", fontSize = 10.sp, color = Teal, letterSpacing = 2.sp)
            }
            IconButton(onClick = onSettings, modifier = Modifier.align(Alignment.CenterEnd)) {
                Icon(Icons.Default.Settings, contentDescription = "הגדרות", tint = Muted)
            }
        }
    }
}

// ── ברכה + תאריך ────────────────────────────────────────────────────────────
@Composable
private fun Greeting(today: LocalDate) {
    val name by il.co.soline.measure.data.Prefs.surveyorNameState
    Column(Modifier.padding(top = 4.dp, bottom = 2.dp)) {
        Text(if (name.isBlank()) "שלום" else "שלום, $name", fontSize = 15.sp, color = Muted)
        Text("לוח הבקרה שלך להיום", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Ink)
        Text(hebrewDate(today), fontSize = 13.sp, color = Teal, modifier = Modifier.padding(top = 4.dp))
    }
}

// ── מדדי-היום ────────────────────────────────────────────────────────────────
@Composable
private fun StatsRow(open: Int, measured: Int, pending: Int, onOpenSchedule: () -> Unit) {
    SolineCard(onClick = onOpenSchedule) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            StatCell("$open", "פתוחות", Orange, Modifier.weight(1f))
            CellDivider()
            StatCell("$measured", "נמדדו", OkGreen, Modifier.weight(1f))
            CellDivider()
            StatCell("$pending", "לתזמון", Teal, Modifier.weight(1f))
        }
    }
}

@Composable
private fun StatCell(value: String, label: String, color: Color, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 26.sp, fontWeight = FontWeight.Bold, color = color)
        Text(label, fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 2.dp))
    }
}

@Composable
private fun CellDivider() {
    Box(Modifier.height(36.dp).width(1.dp).background(Muted.copy(alpha = 0.15f)))
}

// ── כניסות-ניהול (לו"ז + מדידות) ──────────────────────────────────────────────
@Composable
private fun ManageRow(
    todayCount: Int,
    onSchedule: () -> Unit,
) {
    ManageCard(
        emoji = "🗓️", title = "ניהול לו\"ז",
        subtitle = if (todayCount > 0) "$todayCount עבודות היום" else "צפייה ותזמון עבודות",
        accent = Teal, onClick = onSchedule, modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun ManageCard(
    emoji: String,
    title: String,
    subtitle: String,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        onClick = onClick,
        modifier = modifier.heightIn(min = 96.dp),
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        border = androidx.compose.foundation.BorderStroke(1.dp, accent.copy(alpha = 0.30f)),
    ) {
        Column(Modifier.padding(14.dp)) {
            Box(
                Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(accent.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) { Text(emoji, fontSize = 20.sp) }
            Spacer(Modifier.height(10.dp))
            Text(title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Ink)
            Text(subtitle, fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

// ── בדיקות-פתוחות (בדיקה-חוזרת דו-כיוונית עם מיכאל) ───────────────────────────
@Composable
private fun RetestEntryCard(modifier: Modifier = Modifier, onClick: () -> Unit) {
    val context = LocalContext.current
    var count by remember { mutableStateOf<Int?>(null) }
    LaunchedEffect(Unit) {
        count = withContext(Dispatchers.IO) { RetestSync.loadQueue(context).size }
    }
    Surface(
        onClick = onClick,
        modifier = modifier.heightIn(min = 96.dp),
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        border = androidx.compose.foundation.BorderStroke(1.dp, Teal.copy(alpha = 0.30f)),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Teal.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center,
                ) { Text("🔁", fontSize = 20.sp) }
                Spacer(Modifier.weight(1f))
                val c = count ?: 0
                if (c > 0) {
                    Surface(shape = RoundedCornerShape(50), color = Orange) {
                        Text(
                            "$c", fontSize = 13.sp, color = Color.White, fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
                        )
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Text("בדיקות פתוחות", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Ink)
            Text(
                when (val c = count) {
                    null -> "בודק…"
                    0 -> "אין ממתינות"
                    else -> "$c לאימות"
                },
                fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

// ── כותרת-מקטע עם קישור ───────────────────────────────────────────────────────
@Composable
private fun SectionHeaderLink(title: String, badge: String?, linkText: String, onLink: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink)
        if (badge != null) {
            Spacer(Modifier.width(8.dp))
            Surface(shape = RoundedCornerShape(50), color = Orange.copy(alpha = 0.12f)) {
                Text(
                    badge, fontSize = 12.sp, color = Orange, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
                )
            }
        }
        Spacer(Modifier.weight(1f))
        TextButton(onClick = onLink, contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)) {
            Text(linkText, fontSize = 13.sp, color = Teal, fontWeight = FontWeight.SemiBold)
        }
    }
}

// ── כרטיס-עבודה-להיום ─────────────────────────────────────────────────────────
@Composable
private fun TodayJobCard(job: JobEntity, onClick: () -> Unit) {
    SolineCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(shape = RoundedCornerShape(12.dp), color = Teal.copy(alpha = 0.10f), modifier = Modifier.width(56.dp)) {
                Column(Modifier.padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(if (job.scheduledAt > 0L) heTime(job.scheduledAt) else "—", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Teal)
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(job.clientName.ifBlank { "עבודה #${job.id}" }, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ink, maxLines = 1)
                val loc = listOf(job.address1, job.city).filter { it.isNotBlank() }.joinToString(", ")
                if (loc.isNotBlank()) {
                    Text("📍 $loc", fontSize = 12.sp, color = Muted, maxLines = 1, modifier = Modifier.padding(top = 2.dp))
                }
            }
            JobStatusChip(job.status)
        }
    }
}

// ── פעולות-שטח ראשיות ───────────────────────────────────────────────────────
@Composable
private fun PrimaryActions(
    lastProjectName: String?,
    onNewJob: () -> Unit,
    onContinueLast: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        BigActionButton(
            text = "פתיחת פרויקט (פרטי-לקוח מלאים)",
            onClick = onNewJob,
            icon = Icons.Default.Add,
            container = Orange,
            modifier = Modifier.fillMaxWidth(),
        )
        if (lastProjectName != null) {
            SolineButton(
                text = "המשך: $lastProjectName",
                onClick = onContinueLast,
                icon = Icons.AutoMirrored.Filled.ArrowForward,
                style = SolineButtonStyle.SECONDARY,
                accent = Teal,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

// ── פרויקטים ────────────────────────────────────────────────────────────────
@Composable
private fun ProjectCard(p: Project, onClick: () -> Unit) {
    SolineCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
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
