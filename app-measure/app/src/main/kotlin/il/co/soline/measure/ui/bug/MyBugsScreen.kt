package il.co.soline.measure.ui.bug

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.navigation.NavController
import il.co.soline.measure.data.BugStage
import il.co.soline.measure.data.BugStatus
import il.co.soline.measure.data.RetestSync
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.components.EmptyState
import il.co.soline.measure.ui.components.SolineCard
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/*
 * "הבאגים שלי" — הצד של המודד לצפייה בבאגים שדיווח + הסטטוס שמיכאל מפרסם.
 * קורא את הדיווחים המקומיים (BugReportStore) ומכסה עליהם סטטוס מ-Drive (bug_status.json).
 * צפייה-בלבד: הכתיבה נעשית דרך 🐞 (דיווח) ודרך "בדיקות פתוחות" (אימות).
 */

private data class MyBug(
    val id: String,
    val createdAt: String,
    val screen: String,
    val notes: String,
    val pngPath: String,
    val status: BugStatus?,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyBugsScreen(nav: NavController) {
    val context = LocalContext.current
    var bugs by remember { mutableStateOf<List<MyBug>?>(null) }
    var refreshKey by remember { mutableStateOf(0) }
    var viewImg by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(refreshKey) {
        bugs = withContext(Dispatchers.IO) {
            val statuses = RetestSync.loadBugStatuses(context)
            BugReportStore.list(context.filesDir).map { sr ->
                val notes = try {
                    if (sr.json.name.endsWith(".json") && sr.json.exists())
                        BugReportBundle.fromJsonString(sr.json.readText(Charsets.UTF_8)).notes
                    else ""
                } catch (_: Exception) { "" }
                MyBug(sr.baseName, sr.createdAt, sr.screen, notes, sr.png.absolutePath, statuses[sr.baseName])
            }
        }
    }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Scaffold(
            containerColor = Cream,
            topBar = {
                TopAppBar(
                    title = { Text("הבאגים שלי", fontWeight = FontWeight.Bold) },
                    navigationIcon = {
                        IconButton(onClick = { nav.popBackStack() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "חזרה")
                        }
                    },
                    actions = {
                        TextButton(onClick = { bugs = null; refreshKey++ }) {
                            Text("רענן ⟳", color = Teal, fontWeight = FontWeight.SemiBold)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.White, titleContentColor = Ink,
                    ),
                )
            },
        ) { pad ->
            val list = bugs
            when {
                list == null -> Box(Modifier.padding(pad).fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Orange)
                }
                list.isEmpty() -> Box(Modifier.padding(pad).fillMaxSize().padding(16.dp)) {
                    EmptyState(
                        emoji = "🐞",
                        title = "עדיין לא דיווחת באגים",
                        subtitle = "כשתלחץ על 🐞 בכל מסך ותשלח דיווח — הוא יופיע כאן עם הסטטוס שלו.",
                    )
                }
                else -> LazyColumn(
                    modifier = Modifier.padding(pad).fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item {
                        Text(
                            "הבאגים שדיווחת והסטטוס שלהם. לכתיבה — 🐞 בכל מסך; לאימות תיקון — 'בדיקות פתוחות'.",
                            fontSize = 13.sp, color = Muted,
                        )
                    }
                    items(list, key = { it.id }) { b ->
                        MyBugCard(b, onView = { viewImg = b.pngPath })
                    }
                    item { Spacer(Modifier.height(24.dp)) }
                }
            }
        }
    }

    // מציג צילום-מסך במסך-מלא
    viewImg?.let { path ->
        ImageDialog(path) { viewImg = null }
    }
}

@Composable
private fun MyBugCard(b: MyBug, onView: () -> Unit) {
    SolineCard {
        Column(Modifier.fillMaxWidth().padding(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    val title = b.notes.lineSequence().firstOrNull()?.takeIf { it.isNotBlank() } ?: "דיווח ${b.screen}"
                    Text(title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Ink, maxLines = 2)
                    Text(
                        listOf(b.screen, dateOf(b)).filter { it.isNotBlank() }.joinToString(" · "),
                        fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 2.dp),
                    )
                }
                StatusBadge(b.status?.status)
            }
            // הערת-מיכאל (אם פורסמה)
            b.status?.note?.takeIf { it.isNotBlank() }?.let { note ->
                Spacer(Modifier.height(8.dp))
                Surface(shape = RoundedCornerShape(10.dp), color = Teal.copy(alpha = 0.08f)) {
                    Text(
                        "מיכאל: $note" + (b.status?.version?.takeIf { it.isNotBlank() }?.let { " (v$it)" } ?: ""),
                        fontSize = 13.sp, color = Ink, modifier = Modifier.padding(10.dp),
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = onView) {
                Text("📷 צפה בצילום-המסך", color = Teal, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun StatusBadge(status: String?) {
    val (label, color) = when (status) {
        BugStage.WORKING -> "בטיפול" to Orange
        BugStage.FIXED -> "תוקן — לאימות" to Teal
        BugStage.CLOSED -> "נסגר ✓" to OkGreen
        BugStage.REOPENED -> "נפתח מחדש" to BlockRed
        else -> "התקבל" to Muted
    }
    Surface(shape = RoundedCornerShape(50), color = color.copy(alpha = 0.14f)) {
        Text(
            label, fontSize = 12.sp, color = color, fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 4.dp),
        )
    }
}

@Composable
private fun ImageDialog(path: String, onClose: () -> Unit) {
    val bmp by produceState<androidx.compose.ui.graphics.ImageBitmap?>(null, path) {
        value = withContext(Dispatchers.IO) {
            try {
                val f = File(path)
                if (f.exists()) BitmapFactory.decodeFile(path)?.asImageBitmap() else null
            } catch (_: Exception) { null }
        }
    }
    Dialog(onDismissRequest = onClose) {
        Surface(shape = RoundedCornerShape(14.dp), color = Color.Black) {
            Column(Modifier.padding(8.dp)) {
                val img = bmp
                if (img != null) {
                    Image(img, contentDescription = "צילום-מסך", modifier = Modifier.fillMaxWidth())
                } else {
                    Box(Modifier.fillMaxWidth().height(180.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Orange)
                    }
                }
                TextButton(onClick = onClose, modifier = Modifier.align(Alignment.End)) {
                    Text("סגור", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

private fun dateOf(b: MyBug): String {
    // createdAt בפורמט yyyy-MM-dd'T'HH:mm:ss → מציג dd/MM HH:mm
    return try {
        val d = b.createdAt.substringBefore("T")
        val t = b.createdAt.substringAfter("T").take(5)
        val parts = d.split("-")
        if (parts.size == 3) "${parts[2]}/${parts[1]} $t" else b.createdAt
    } catch (_: Exception) { b.createdAt }
}
