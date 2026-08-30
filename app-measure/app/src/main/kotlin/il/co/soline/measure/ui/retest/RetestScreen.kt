package il.co.soline.measure.ui.retest

import androidx.compose.foundation.background
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.RetestItem
import il.co.soline.measure.data.RetestSync
import il.co.soline.measure.data.RetestVerdict
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.components.EmptyState
import il.co.soline.measure.ui.components.SectionHeader
import il.co.soline.measure.ui.components.SolineCard
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/*
 * מסך "בדיקות פתוחות" — הצד של המודד בזרימת הבדיקה-החוזרת הדו-כיוונית.
 * קורא את retest_queue.json מתיקיית-ה-Drive, ומאפשר למודד לסמן לכל-פריט
 * תקין / לשפר / לשדרג + הערה — שנכתבים חזרה כקובץ-תגובה ל-Drive (→ מיכאל).
 * בלי חשבון, בלי מגבלות-ארטיפקט: ה-Drive הוא צינור-הסנכרון.
 */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RetestScreen(nav: NavController) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var queue by remember { mutableStateOf<List<RetestItem>?>(null) } // null = טוען
    var sentIds by remember { mutableStateOf(setOf<String>()) }
    var refreshKey by remember { mutableStateOf(0) }
    val hasTree = Prefs.bugUploadTreeUri.isNotBlank()

    LaunchedEffect(refreshKey) {
        queue = withContext(Dispatchers.IO) { RetestSync.loadQueue(context) }
    }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Scaffold(
            containerColor = Cream,
            topBar = {
                TopAppBar(
                    title = { Text("בדיקות פתוחות", fontWeight = FontWeight.Bold) },
                    navigationIcon = {
                        IconButton(onClick = { nav.popBackStack() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "חזרה")
                        }
                    },
                    actions = {
                        TextButton(onClick = { queue = null; refreshKey++ }) {
                            Text("רענן ⟳", color = Teal, fontWeight = FontWeight.SemiBold)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.White, titleContentColor = Ink,
                    ),
                )
            },
        ) { pad ->
            val current = queue
            val visible = current?.filterNot { sentIds.contains(it.id) }.orEmpty()
            when {
                current == null -> Box(Modifier.padding(pad).fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Orange)
                }
                !hasTree -> Box(Modifier.padding(pad).fillMaxSize().padding(16.dp)) {
                    EmptyState(
                        emoji = "📂",
                        title = "לא הוגדרה תיקיית-Drive",
                        subtitle = "כדי לקבל בדיקות ולשלוח תגובות — הגדר את תיקיית-הבאגים ב-Drive במסך ההגדרות.",
                        actionText = "פתח הגדרות",
                        onAction = { nav.navigate("settings") },
                    )
                }
                visible.isEmpty() -> Box(Modifier.padding(pad).fillMaxSize().padding(16.dp)) {
                    EmptyState(
                        emoji = "✅",
                        title = "אין בדיקות פתוחות",
                        subtitle = "כשמיכאל יתקן באג וישחרר גרסה — הוא יופיע כאן לאימות. משכת-למטה 'רענן' לבדיקה.",
                    )
                }
                else -> LazyColumn(
                    modifier = Modifier.padding(pad).fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item {
                        SectionHeader(
                            "לאימות המודד",
                            badge = if (visible.isEmpty()) null else "${visible.size}",
                        )
                    }
                    item {
                        Text(
                            "בדוק כל תיקון באפליקציה, וסמן תקין / לשפר / לשדרג + הערה. התגובה נשלחת אוטומטית למיכאל.",
                            fontSize = 13.sp, color = Muted,
                        )
                    }
                    items(visible, key = { it.id }) { it2 ->
                        RetestCard(
                            item = it2,
                            onSend = { verdict, note, onResult ->
                                // כתיבת-התגובה ל-Drive רצה ב-IO; התוצאה חוזרת לכרטיס
                                scope.launch {
                                    val ok = withContext(Dispatchers.IO) {
                                        RetestSync.writeResponse(context, it2, verdict, note)
                                    }
                                    if (ok) sentIds = sentIds + it2.id
                                    onResult(ok)
                                }
                            },
                        )
                    }
                    item { Spacer(Modifier.height(24.dp)) }
                }
            }
        }
    }
}

/** כרטיס פריט-בדיקה: מה-תוקן + verdict + הערה + שליחה. מצב-מקומי לכל-כרטיס. */
@Composable
private fun RetestCard(
    item: RetestItem,
    onSend: (verdict: String, note: String, onResult: (Boolean) -> Unit) -> Unit,
) {
    var verdict by remember { mutableStateOf<String?>(null) }
    var note by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    SolineCard {
        Column(Modifier.fillMaxWidth().padding(2.dp)) {
            // כותרת + מסך
            Text(item.title, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Ink)
            Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                if (item.screen.isNotBlank()) {
                    Chip(item.screen, Teal)
                    Spacer(Modifier.width(6.dp))
                }
                if (item.version.isNotBlank()) Chip("v${item.version}", Muted)
            }
            if (item.fixed.isNotBlank()) {
                Text(
                    "מה תוקן: ${item.fixed}",
                    fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 8.dp),
                )
            }

            // כפתורי-verdict (מטרות-מגע גדולות) — 2 שורות
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                VerdictBtn("תקין ✓", RetestVerdict.OK, verdict, OkGreen, Modifier.weight(1f)) { verdict = it }
                VerdictBtn("לא-תקין ✗", RetestVerdict.FAIL, verdict, BlockRed, Modifier.weight(1f)) { verdict = it }
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                VerdictBtn("לשפר", RetestVerdict.IMPROVE, verdict, Orange, Modifier.weight(1f)) { verdict = it }
                VerdictBtn("לשדרג", RetestVerdict.UPGRADE, verdict, Teal, Modifier.weight(1f)) { verdict = it }
            }

            // הערה
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("הערה (מה נמצא / מה לשפר)", color = Muted) },
                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                minLines = 2,
                maxLines = 4,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Orange, unfocusedBorderColor = Muted.copy(alpha = 0.5f),
                    focusedTextColor = Ink, unfocusedTextColor = Ink, cursorColor = Orange,
                ),
            )

            if (error != null) {
                Text(error!!, fontSize = 12.sp, color = BlockRed, modifier = Modifier.padding(top = 6.dp))
            }

            // שליחה
            Spacer(Modifier.height(10.dp))
            Button(
                onClick = {
                    val v = verdict ?: return@Button
                    if (sending) return@Button
                    sending = true; error = null
                    onSend(v, note.trim()) { ok ->
                        sending = false
                        if (!ok) error = "השליחה נכשלה — בדוק חיבור/תיקיית-Drive ונסה שוב."
                    }
                },
                enabled = verdict != null && !sending,
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Orange, contentColor = Color.White),
            ) {
                Text(
                    if (sending) "שולח…" else "שלח למיכאל",
                    fontSize = 16.sp, fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun VerdictBtn(
    label: String,
    code: String,
    selected: String?,
    color: Color,
    modifier: Modifier = Modifier,
    onPick: (String) -> Unit,
) {
    val on = selected == code
    Surface(
        onClick = { onPick(code) },
        modifier = modifier.heightIn(min = 48.dp),
        shape = RoundedCornerShape(12.dp),
        color = if (on) color else color.copy(alpha = 0.12f),
        contentColor = if (on) Color.White else color,
        border = androidx.compose.foundation.BorderStroke(1.5.dp, color.copy(alpha = if (on) 1f else 0.4f)),
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(label, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun Chip(text: String, color: Color) {
    Surface(shape = RoundedCornerShape(50), color = color.copy(alpha = 0.12f)) {
        Text(
            text, fontSize = 11.sp, color = color, fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 9.dp, vertical = 2.dp),
        )
    }
}
