package il.co.soline.measure.ui.measurements

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
import il.co.soline.measure.data.ProjectStat
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.components.EmptyState
import il.co.soline.measure.ui.components.SectionHeader
import il.co.soline.measure.ui.components.SolineCard
import il.co.soline.measure.ui.ops.heDayMonth
import il.co.soline.measure.ui.schedule.OpsHeader

/*
 * ניהול מדידות (צד-המשרד) — כל הפרויקטים/החדרים שנמדדו, עם סטטוס-מדידה נגזר
 * (ריק / בתהליך / נמדד / יוצא), מונֵי חדרים·קירות·בליטות, ומצב-ייצוא. הקשה
 * פותחת את חדרי-הפרויקט (זרימת-המדידה הקיימת) ואת שער-הייצוא. RTL, טאבלט.
 */

private enum class MStatus(val he: String, val color: Color) {
    EMPTY("ריק", Muted),
    IN_PROGRESS("בתהליך", Orange),
    MEASURED("נמדד", OkGreen),
    EXPORTED("יוצא", Teal),
}

private fun statusOf(p: Project, stat: ProjectStat?): MStatus = when {
    p.lastExportedAt > 0L -> MStatus.EXPORTED
    (stat?.walls ?: 0) > 0 -> MStatus.MEASURED
    (stat?.rooms ?: 0) > 0 -> MStatus.IN_PROGRESS
    else -> MStatus.EMPTY
}

private enum class MFilter { ALL, TODO, MEASURED, EXPORTED }

@Composable
fun MeasurementsScreen(nav: NavController) {
    val repo = SolineApp.instance.repo
    val projects by repo.projects().collectAsStateWithLifecycle(emptyList())
    val stats by repo.projectStats().collectAsStateWithLifecycle(emptyList())
    val statById = remember(stats) { stats.associateBy { it.projectId } }

    var filter by remember { mutableStateOf(MFilter.ALL) }

    val rows = remember(projects, statById, filter) {
        projects.map { it to statById[it.id] }.filter { (p, s) ->
            val st = statusOf(p, s)
            when (filter) {
                MFilter.ALL -> true
                MFilter.TODO -> st == MStatus.EMPTY || st == MStatus.IN_PROGRESS
                MFilter.MEASURED -> st == MStatus.MEASURED
                MFilter.EXPORTED -> st == MStatus.EXPORTED
            }
        }
    }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Scaffold(containerColor = Cream) { pad ->
            Column(Modifier.padding(pad).fillMaxSize()) {
                OpsHeader(title = "ניהול מדידות", subtitle = "כל הפרויקטים והמדידות", onBack = { nav.popBackStack() })

                // סרגל-מדדים עליון (ריכוז-מצב מהיר)
                SummaryBar(projects, statById)

                FilterRow(filter) { filter = it }

                if (rows.isEmpty()) {
                    Box(Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.TopCenter) {
                        EmptyState(
                            emoji = "📐",
                            title = "אין מדידות להצגה",
                            subtitle = "פרויקטים שנמדדים באפליקציה יופיעו כאן עם סטטוס ומצב-ייצוא.",
                        )
                    }
                } else {
                    LazyColumn(
                        Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        item { SectionHeader("פרויקטים", badge = "${rows.size}") }
                        items(rows, key = { it.first.id }) { (p, s) ->
                            ProjectMeasureCard(p, s) { nav.navigate("rooms/${p.id}") }
                        }
                        item { Spacer(Modifier.height(24.dp)) }
                    }
                }
            }
        }
    }
}

// ── סרגל-מדדים ────────────────────────────────────────────────────────────────
@Composable
private fun SummaryBar(projects: List<Project>, statById: Map<Long, ProjectStat>) {
    val measured = projects.count { statusOf(it, statById[it.id]) == MStatus.MEASURED }
    val exported = projects.count { it.lastExportedAt > 0L }
    val todo = projects.count { val st = statusOf(it, statById[it.id]); st == MStatus.EMPTY || st == MStatus.IN_PROGRESS }
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        MiniStat("${projects.size}", "פרויקטים", Ink, Modifier.weight(1f))
        MiniStat("$todo", "בעבודה", Orange, Modifier.weight(1f))
        MiniStat("$measured", "נמדדו", OkGreen, Modifier.weight(1f))
        MiniStat("$exported", "יוצאו", Teal, Modifier.weight(1f))
    }
}

@Composable
private fun MiniStat(value: String, label: String, color: Color, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        color = color.copy(alpha = 0.08f),
    ) {
        Column(Modifier.padding(vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = color)
            Text(label, fontSize = 11.sp, color = Muted)
        }
    }
}

@Composable
private fun FilterRow(current: MFilter, onPick: (MFilter) -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FilterChip(current == MFilter.ALL, { onPick(MFilter.ALL) }, label = { Text("הכל") })
        FilterChip(current == MFilter.TODO, { onPick(MFilter.TODO) }, label = { Text("בעבודה") })
        FilterChip(current == MFilter.MEASURED, { onPick(MFilter.MEASURED) }, label = { Text("נמדדו") })
        FilterChip(current == MFilter.EXPORTED, { onPick(MFilter.EXPORTED) }, label = { Text("יוצאו") })
    }
}

// ── כרטיס-פרויקט ──────────────────────────────────────────────────────────────
@Composable
private fun ProjectMeasureCard(p: Project, s: ProjectStat?, onClick: () -> Unit) {
    val st = statusOf(p, s)
    SolineCard(onClick = onClick) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(st.color.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center,
                ) { Text("📐", fontSize = 20.sp) }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(p.name, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Ink, maxLines = 1)
                    Text(
                        if (p.client.isNotBlank()) "לקוח: ${p.client}" else "ללא לקוח",
                        fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 2.dp), maxLines = 1,
                    )
                }
                StatusChip(st)
            }
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                CountPill("🚪", "${s?.rooms ?: 0}", "חדרים")
                Spacer(Modifier.width(8.dp))
                CountPill("📏", "${s?.walls ?: 0}", "קירות")
                Spacer(Modifier.width(8.dp))
                CountPill("🔌", "${s?.accessories ?: 0}", "בליטות")
                Spacer(Modifier.weight(1f))
                if (p.lastExportedAt > 0L) {
                    Text("⬇ יוצא ${heDayMonth(p.lastExportedAt)}", fontSize = 11.sp, color = Teal, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

@Composable
private fun StatusChip(st: MStatus) {
    Surface(shape = RoundedCornerShape(50), color = st.color.copy(alpha = 0.12f)) {
        Text(
            st.he, fontSize = 12.sp, color = st.color, fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        )
    }
}

@Composable
private fun CountPill(emoji: String, value: String, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(emoji, fontSize = 13.sp)
        Spacer(Modifier.width(4.dp))
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Ink)
        Spacer(Modifier.width(3.dp))
        Text(label, fontSize = 11.sp, color = Muted)
    }
}
