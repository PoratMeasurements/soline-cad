package il.co.soline.measure.ui.schedule

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import il.co.soline.measure.data.JobEntity
import il.co.soline.measure.data.JobStatus
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.components.EmptyState
import il.co.soline.measure.ui.components.SectionHeader
import il.co.soline.measure.ui.components.SolineCard
import il.co.soline.measure.ui.ops.DayBucket
import il.co.soline.measure.ui.ops.JobStatusChip
import il.co.soline.measure.ui.ops.dayBucketOf
import il.co.soline.measure.ui.ops.heDayMonth
import il.co.soline.measure.ui.ops.heTime
import il.co.soline.measure.ui.ops.heWeekdayShort
import il.co.soline.measure.ui.ops.jobStatusColor
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

/*
 * ניהול לו"ז (צד-המשרד) — צפייה/ניהול של סידור-העבודה.
 * העבודות (JobEntity) מקובצות לדליים: היום · באיחור · הקרובות · לתזמון · הושלמו.
 * לכל עבודה: לקוח, כתובת, שעה, מודג-משובץ וסטטוס. הקשה → גיליון-ניהול
 * (תזמון/דחייה, שיבוץ-מודד, קידום-סטטוס). RTL עברית, יעדי-מגע גדולים לטאבלט.
 */

@Composable
fun ScheduleScreen(nav: NavController) {
    val repo = SolineApp.instance.repo
    val jobs by repo.jobs().collectAsStateWithLifecycle(emptyList())
    val today = remember { LocalDate.now() }
    var editing by remember { mutableStateOf<JobEntity?>(null) }

    // סינון-סטטוס עליון (הכל / פתוחות / הושלמו) — עזר-מיקוד תפעולי
    var filter by remember { mutableStateOf(ScheduleFilter.ALL) }

    val visible = remember(jobs, filter) {
        when (filter) {
            ScheduleFilter.ALL -> jobs
            ScheduleFilter.OPEN -> jobs.filter { it.status != JobStatus.DONE }
            ScheduleFilter.DONE -> jobs.filter { it.status == JobStatus.DONE }
        }
    }

    // דלי → עבודות (ממויין: מתוזמנות לפי-שעה, לתזמון לפי-חדשות)
    val buckets = remember(visible, today) { bucketize(visible, today) }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Scaffold(containerColor = Cream) { pad ->
            Column(Modifier.padding(pad).fillMaxSize()) {
                OpsHeader(title = "ניהול לו\"ז", subtitle = "סידור-העבודה של הצוות", onBack = { nav.popBackStack() })
                FilterRow(filter) { filter = it }

                if (visible.isEmpty()) {
                    Box(Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.TopCenter) {
                        EmptyState(
                            emoji = "🗓️",
                            title = "אין עבודות בלו\"ז",
                            subtitle = "עבודות נפתחות דרך \"פתיחת עבודה\" ומופיעות כאן לתזמון ולשיבוץ.",
                        )
                    }
                } else {
                    LazyColumn(
                        Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        for (b in BUCKET_ORDER) {
                            val list = buckets[b].orEmpty()
                            if (list.isEmpty()) continue
                            item(key = "hdr-$b") { SectionHeader(bucketTitle(b), badge = "${list.size}") }
                            items(list, key = { it.id }) { job ->
                                JobRow(job, onClick = { editing = job })
                            }
                        }
                        item { Spacer(Modifier.height(24.dp)) }
                    }
                }
            }
        }
    }

    editing?.let { job ->
        JobManageSheet(
            job = job,
            onDismiss = { editing = null },
        )
    }
}

private enum class ScheduleFilter { ALL, OPEN, DONE }

private val BUCKET_ORDER = listOf(
    DayBucket.OVERDUE, DayBucket.TODAY, DayBucket.UPCOMING, DayBucket.UNSCHEDULED,
)

private fun bucketTitle(b: DayBucket): String = when (b) {
    DayBucket.OVERDUE -> "באיחור"
    DayBucket.TODAY -> "היום"
    DayBucket.UPCOMING -> "הקרובות"
    DayBucket.UNSCHEDULED -> "לתזמון"
}

private fun bucketize(jobs: List<JobEntity>, today: LocalDate): Map<DayBucket, List<JobEntity>> {
    val map = jobs.groupBy { dayBucketOf(it.scheduledAt, today) }
    return map.mapValues { (b, list) ->
        if (b == DayBucket.UNSCHEDULED) list.sortedByDescending { it.createdAt }
        else list.sortedBy { it.scheduledAt }
    }
}

// ── שורת-סינון ────────────────────────────────────────────────────────────────
@Composable
private fun FilterRow(current: ScheduleFilter, onPick: (ScheduleFilter) -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FilterChip(current == ScheduleFilter.ALL, { onPick(ScheduleFilter.ALL) }, label = { Text("הכל") })
        FilterChip(current == ScheduleFilter.OPEN, { onPick(ScheduleFilter.OPEN) }, label = { Text("פתוחות") })
        FilterChip(current == ScheduleFilter.DONE, { onPick(ScheduleFilter.DONE) }, label = { Text("הושלמו") })
    }
}

// ── שורת-עבודה ────────────────────────────────────────────────────────────────
@Composable
private fun JobRow(job: JobEntity, onClick: () -> Unit) {
    SolineCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TimeBadge(job.scheduledAt)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(jobTitle(job), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ink, maxLines = 1)
                val loc = jobLocation(job)
                if (loc.isNotBlank()) {
                    Text("📍 $loc", fontSize = 12.sp, color = Muted, maxLines = 1, modifier = Modifier.padding(top = 2.dp))
                }
                Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    JobStatusChip(job.status)
                    if (job.assignee.isNotBlank()) {
                        Spacer(Modifier.width(8.dp))
                        Text("👷 ${job.assignee}", fontSize = 12.sp, color = Teal, fontWeight = FontWeight.Medium)
                    }
                }
            }
        }
    }
}

/** תג-שעה מימין: שעה + יום קצר; או "לתזמון" כשאין מועד. */
@Composable
private fun TimeBadge(scheduledAt: Long) {
    val scheduled = scheduledAt > 0L
    val bg = if (scheduled) Teal.copy(alpha = 0.10f) else Color(0xFFF0F0F0)
    val fg = if (scheduled) Teal else Muted
    Surface(shape = RoundedCornerShape(12.dp), color = bg, modifier = Modifier.width(58.dp)) {
        Column(
            Modifier.padding(vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (scheduled) {
                Text(heTime(scheduledAt), fontSize = 16.sp, fontWeight = FontWeight.Bold, color = fg)
                Text("${heWeekdayShort(scheduledAt)} ${heDayMonth(scheduledAt)}", fontSize = 10.sp, color = Muted, maxLines = 1)
            } else {
                Text("🕗", fontSize = 16.sp)
                Text("לתזמון", fontSize = 10.sp, color = Muted)
            }
        }
    }
}

// ── גיליון-ניהול-עבודה ────────────────────────────────────────────────────────
@Composable
private fun JobManageSheet(job: JobEntity, onDismiss: () -> Unit) {
    val repo = SolineApp.instance.repo
    val scope = rememberCoroutineScope()

    // מצב-עריכה מקומי
    var scheduledAt by remember(job.id) { mutableStateOf(job.scheduledAt) }
    var timeText by remember(job.id) { mutableStateOf(if (job.scheduledAt > 0L) heTime(job.scheduledAt) else "08:00") }
    var assignee by remember(job.id) { mutableStateOf(job.assignee) }
    var status by remember(job.id) { mutableStateOf(job.status) }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                val finalAt = combineDateTime(scheduledAt, timeText)
                scope.launch {
                    repo.setJobSchedule(job.id, finalAt, job.durationMin)
                    repo.setJobAssignee(job.id, assignee.trim())
                    repo.setJobStatus(job.id, status)
                }
                onDismiss()
            }) { Text("שמור", color = Orange, fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) } },
        title = { Text(jobTitle(job), fontWeight = FontWeight.Bold, fontSize = 18.sp) },
        containerColor = Color.White,
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                val loc = jobLocation(job)
                if (loc.isNotBlank()) Text("📍 $loc", fontSize = 13.sp, color = Muted)
                if (job.clientPhone.isNotBlank()) {
                    Text("☎ ${job.clientPhone}", fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 2.dp))
                }

                Spacer(Modifier.height(14.dp))
                Text("מועד", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                Row(
                    Modifier.fillMaxWidth().padding(top = 6.dp).horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    DayChip("היום") { scheduledAt = dayAtDefault(0) }
                    DayChip("מחר") { scheduledAt = dayAtDefault(1) }
                    DayChip("+2") { scheduledAt = dayAtDefault(2) }
                    DayChip("+3") { scheduledAt = dayAtDefault(3) }
                    DayChip("שבוע") { scheduledAt = dayAtDefault(7) }
                    AssistChip(onClick = { scheduledAt = 0L }, label = { Text("נקה") })
                }
                Text(
                    if (scheduledAt > 0L) "נבחר: ${heWeekdayShort(scheduledAt)} ${heDayMonth(scheduledAt)}" else "לא-מתוזמן (יופיע ב\"לתזמון\")",
                    fontSize = 12.sp, color = Teal, modifier = Modifier.padding(top = 6.dp),
                )
                OutlinedTextField(
                    value = timeText, onValueChange = { timeText = it },
                    label = { Text("שעה (HH:mm)") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    enabled = scheduledAt > 0L,
                )

                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = assignee, onValueChange = { assignee = it },
                    label = { Text("מודד משובץ") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                Spacer(Modifier.height(14.dp))
                Text("סטטוס", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                Row(
                    Modifier.fillMaxWidth().padding(top = 6.dp).horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    for (s in JobStatus.flow) {
                        val c = jobStatusColor(s)
                        FilterChip(
                            selected = status == s,
                            onClick = { status = s },
                            label = { Text(JobStatus.he(s)) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = c.copy(alpha = 0.15f),
                                selectedLabelColor = c,
                            ),
                        )
                    }
                }
            }
        },
    )
}

@Composable
private fun DayChip(label: String, onClick: () -> Unit) {
    AssistChip(onClick = onClick, label = { Text(label) })
}

// ── כותרת-ניהול משותפת (סגנון-מותג) ───────────────────────────────────────────
@Composable
fun OpsHeader(title: String, subtitle: String, onBack: (() -> Unit)? = null) {
    Column(Modifier.fillMaxWidth().background(Color.White).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (onBack != null) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
                Spacer(Modifier.width(4.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text(subtitle, fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 2.dp))
            }
            Column(horizontalAlignment = Alignment.End) {
                Text("soline", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Orange, lineHeight = 20.sp)
                Text("ניהול", fontSize = 9.sp, color = Teal, letterSpacing = 2.sp)
            }
        }
    }
}

// ── עזרים ────────────────────────────────────────────────────────────────────
private fun jobTitle(job: JobEntity): String =
    job.clientName.ifBlank { "עבודה #${job.id}" }

private fun jobLocation(job: JobEntity): String =
    listOf(job.address1, job.city).filter { it.isNotBlank() }.joinToString(", ")

/** מועד ברירת-מחדל ליום-מוסט (08:00) — כברירה לפני בחירת-שעה. */
private fun dayAtDefault(offsetDays: Long): Long {
    val d = LocalDate.now().plusDays(offsetDays).atTime(8, 0)
    return d.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
}

/** מחבר את יום-ה-scheduledAt עם שעה שהוקלדה (HH:mm). אם אין יום — נשאר 0. */
private fun combineDateTime(scheduledAt: Long, timeText: String): Long {
    if (scheduledAt <= 0L) return 0L
    val date = java.time.Instant.ofEpochMilli(scheduledAt).atZone(ZoneId.systemDefault()).toLocalDate()
    val time = parseHm(timeText) ?: LocalTime.of(8, 0)
    return LocalDateTime.of(date, time).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
}

private fun parseHm(s: String): LocalTime? {
    val parts = s.trim().split(":")
    if (parts.size != 2) return null
    val h = parts[0].toIntOrNull() ?: return null
    val m = parts[1].toIntOrNull() ?: return null
    if (h !in 0..23 || m !in 0..59) return null
    return LocalTime.of(h, m)
}
