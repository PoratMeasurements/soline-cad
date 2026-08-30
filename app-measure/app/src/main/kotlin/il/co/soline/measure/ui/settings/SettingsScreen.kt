package il.co.soline.measure.ui.settings

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import android.widget.Toast
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.BuildConfig
import il.co.soline.measure.data.BackupManager
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.ops.metrics.OpsMetricsService
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.components.BrandHeader
import il.co.soline.measure.ui.components.SolineCard
import il.co.soline.measure.update.UpdatePanel
import il.co.soline.measure.ui.bug.BugReportStore
import il.co.soline.measure.ui.bug.SavedBugReport
import il.co.soline.measure.ui.bug.shareAllBugReports
import il.co.soline.measure.ui.bug.shareBugReport
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * SettingsScreen — מסך ההגדרות והעדפות-המשתמש (מודד) של Soline Measure.
 *
 * מחולק למקטעים: פרטי-מודד · מדידה · מכשיר · עבודה.
 * כל שינוי נשמר מיד (live) אל [Prefs], שמעדכן גם את ה-SharedPreferences וגם את ה-State התגובתי.
 * הפריסה כולה RTL בעברית ובצבעי-המותג.
 *
 * @param onBack קריאה חוזרת ליציאה/חזרה (מחווטת לניווט ע"י הקורא).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onOpenConsent: () -> Unit = {},
    onOpenMyActivity: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    // כל המסך RTL
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        // קריאות תגובתיות — כל שינוי ב-Prefs יגרום ל-recompose
        val surveyorName by Prefs.surveyorNameState
        val units by Prefs.unitsState
        val wallHeight by Prefs.defaultWallHeightMmState
        val angleLock by Prefs.angleLockDefaultState
        val sound by Prefs.soundOnCaptureState
        val autoReconnect by Prefs.autoReconnectLaserState
        val keepScreenOn by Prefs.keepScreenOnState
        val jobType by Prefs.defaultJobTypeState
        val consentGiven by Prefs.locConsentGivenState
        val sharingActive by Prefs.locSharingActiveState

        // הקשר וסקופ-קורוטינות עבור פעולת הגיבוי (עבודת-IO ברקע ואז שיתוף)
        val context = LocalContext.current
        val scope = rememberCoroutineScope()

        Scaffold(containerColor = Cream, modifier = modifier) { pad ->
            Column(
                Modifier
                    .padding(pad)
                    .fillMaxSize()
            ) {
                // ---- header (BrandHeader משותף) ----
                BrandHeader("הגדרות", onBack = onBack, subtitle = "העדפות מודד · נשמר אוטומטית")

                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // ---- פרטי מודד ----
                    Section("פרטי מודד") {
                        OutlinedTextField(
                            value = surveyorName,
                            onValueChange = { Prefs.surveyorName = it },
                            label = { Text("שם המודד") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = fieldColors()
                        )
                    }

                    // ---- עדכון גרסה (OTA) ----
                    Section("עדכון גרסה") {
                        UpdatePanel()
                    }

                    // ---- העלאת-באגים אוטומטית ל-Drive ----
                    Section("העלאת-באגים אוטומטית") {
                        BugUploadSection()
                    }

                    // ---- מאגר-לקוחות (בעתיד: אדמין-משרד בלבד) ----
                    Section("מאגר לקוחות") {
                        ClientsSection()
                    }

                    // ---- מדידה ----
                    Section("מדידה") {
                        // יחידות-תצוגה
                        DropdownRow(
                            label = "יחידות תצוגה",
                            selected = units.label,
                            options = Prefs.Units.entries.map { it.label },
                            onSelectIndex = { Prefs.units = Prefs.Units.entries[it] }
                        )
                        SectionDivider()
                        // גובה-קיר ברירת-מחדל
                        OutlinedTextField(
                            value = if (wallHeight == 0.0) "" else Prefs.toDisplayText(wallHeight),
                            onValueChange = { txt ->
                                // הקלט מוזן ביחידת-התצוגה → מומר למ"מ לאחסון.
                                Prefs.parseToMm(txt)?.let { Prefs.defaultWallHeightMm = it }
                                    ?: run { if (txt.isBlank()) Prefs.defaultWallHeightMm = 0.0 }
                            },
                            label = { Text("גובה קיר ברירת-מחדל (${units.label})") },
                            singleLine = true,
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth(),
                            colors = fieldColors()
                        )
                        SectionDivider()
                        // נעילת-זווית 90°
                        SwitchRow(
                            title = "נעילת זווית 90°",
                            subtitle = "בנייה בזוויות ישרות כברירת-מחדל",
                            checked = angleLock,
                            onChange = { Prefs.angleLockDefault = it }
                        )
                        SectionDivider()
                        // סאונד-חיווי בקליטה
                        SwitchRow(
                            title = "סאונד בקליטת נקודה",
                            subtitle = "צליל חיווי כשנקלטת מדידה",
                            checked = sound,
                            onChange = { Prefs.soundOnCapture = it }
                        )
                    }

                    // ---- מכשיר ----
                    Section("מכשיר") {
                        SwitchRow(
                            title = "התחברות-מחדש אוטומטית ללייזר",
                            subtitle = "חיבור מחדש למד-הלייזר כשנמצא",
                            checked = autoReconnect,
                            onChange = { Prefs.autoReconnectLaser = it }
                        )
                        SectionDivider()
                        SwitchRow(
                            title = "השאר מסך דולק",
                            subtitle = "מונע כיבוי-מסך במהלך המדידה",
                            checked = keepScreenOn,
                            onChange = { Prefs.keepScreenOn = it }
                        )
                    }

                    // "סוג עבודה" הוסר לבקשת-המודד (175102) — ברירת-המחדל נשארת פנימית.

                    // ---- שיתוף-מיקום לשיפור-השירות (privacy-by-design) ----
                    Section("שיתוף-מיקום לשיפור-השירות") {
                        // מתג-הפעלה: פעיל רק אם ניתנה הסכמה. אחרת — הפעלה מובילה למסך-ההסכמה.
                        SwitchRow(
                            title = "שיתוף-מיקום פעיל",
                            subtitle = if (consentGiven)
                                "איסוף בזמן-העבודה לייעול-מסלול ותיאום"
                            else
                                "דורש אישור חד-פעמי במסך-ההסכמה",
                            checked = consentGiven && sharingActive,
                            onChange = { want ->
                                if (!consentGiven) {
                                    // אין הסכמה עדיין → מסך-ההסכמה (שם מתבקשת גם ההרשאה).
                                    onOpenConsent()
                                } else if (want) {
                                    Prefs.locSharingActive = true
                                    OpsMetricsService.start(context)
                                } else {
                                    Prefs.locSharingActive = false
                                    OpsMetricsService.stop(context)
                                }
                            }
                        )
                        SectionDivider()
                        // שקיפות: מסך "הפעילות שלי" (הנתונים של המודד עצמו).
                        Row(
                            Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text("הפעילות שלי", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                                Text("מרחק/זמן/מסלול — הנתונים שלך", fontSize = 12.sp, color = Muted)
                            }
                            OutlinedButton(onClick = onOpenMyActivity) { Text("פתח") }
                        }

                        if (consentGiven) {
                            SectionDivider()
                            // ביטול-הסכמה: עוצר-שירות + מוחק-דגימות-מקומיות.
                            Button(
                                onClick = {
                                    scope.launch {
                                        Prefs.revokeLocationConsent()
                                        OpsMetricsService.stop(context)
                                        withContext(Dispatchers.IO) {
                                            SolineApp.instance.repo.deleteAllLocationSamples()
                                        }
                                        Toast.makeText(
                                            context,
                                            "ההסכמה בוטלה — נקודות-המסלול נמחקו מהמכשיר",
                                            Toast.LENGTH_LONG
                                        ).show()
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = BlockRed,
                                    contentColor = Color.White
                                )
                            ) {
                                Text("בטל הסכמה (ומחק נתונים)", fontWeight = FontWeight.SemiBold)
                            }
                            Spacer(Modifier.height(8.dp))
                        }
                        Text(
                            "השיתוף בהסכמתך בלבד וניתן-לכיבוי בכל רגע. ביטול-הסכמה מוחק את " +
                                "נקודות-המסלול השמורות במכשיר." +
                                // תווית-ה"טיוטה" מוצגת רק ב-DEBUG — ב-release נוסח-נקי (תיקון ⚪).
                                if (BuildConfig.DEBUG) " (נוסח-הפרטיות — טיוטה לאישור עו\"ד.)" else "",
                            fontSize = 12.sp,
                            color = Muted
                        )
                    }

                    // ---- גיבוי ושחזור ----
                    Section("גיבוי ושחזור") {
                        Button(
                            onClick = {
                                scope.launch {
                                    try {
                                        // בניית ה-ZIP ברקע (IO), ואז פתיחת גיליון-השיתוף
                                        val zip = withContext(Dispatchers.IO) {
                                            BackupManager.createBackup(context)
                                        }
                                        BackupManager.shareBackup(context, zip)
                                        Toast.makeText(
                                            context,
                                            "הגיבוי נוצר — בחר את Google Drive כדי לשמור",
                                            Toast.LENGTH_LONG
                                        ).show()
                                    } catch (e: Exception) {
                                        Toast.makeText(
                                            context,
                                            "הגיבוי נכשל: ${e.message}",
                                            Toast.LENGTH_LONG
                                        ).show()
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Orange,
                                contentColor = Color.White
                            )
                        ) {
                            Text("גבה הכל ל-Drive (שיתוף)", fontWeight = FontWeight.SemiBold)
                        }
                        Spacer(Modifier.height(10.dp))
                        Text(
                            "מאגד את כל הפרויקטים והמדידות (בסיס-הנתונים וכל קבצי ה-.sol) " +
                                "לקובץ אחד, לשמירה ב-Drive. הפעולה ידנית: האפליקציה אינה מעלה " +
                                "ל-Drive בעצמה — בחר את Google Drive מתוך גיליון-השיתוף שייפתח.",
                            fontSize = 12.sp,
                            color = Muted
                        )
                    }

                    // רשימת-דיווחי-הבאגים הוסרה מההגדרות (175419) — עברה למסך "הבאגים שלי".

                    Spacer(Modifier.height(8.dp))
                }
            }
        }
    }
}

/** מקטע רשימת דיווחי-הבאגים השמורים — שתף-הכל / שתף-בודד / מחק. */
@Composable
private fun BugReportsSection(context: android.content.Context) {
    var refresh by remember { mutableIntStateOf(0) }
    val reports = remember(refresh) { BugReportStore.list(context.filesDir) }

    Section("דיווחי-באגים") {
        if (reports.isEmpty()) {
            Text(
                "אין דיווחים שמורים. לחץ על כפתור ה-🐞 בכל מסך כדי לצלם ולדווח.",
                fontSize = 12.sp, color = Muted,
            )
        } else {
            Button(
                onClick = {
                    shareAllBugReports(context, reports)
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Orange, contentColor = Color.White),
            ) { Text("שתף הכל (${reports.size})", fontWeight = FontWeight.SemiBold) }
            Spacer(Modifier.height(6.dp))
            reports.forEachIndexed { i, r ->
                if (i > 0) SectionDivider()
                BugReportRow(
                    report = r,
                    onShare = { shareBugReport(context, r) },
                    onDelete = {
                        BugReportStore.delete(r)
                        Toast.makeText(context, "הדיווח נמחק", Toast.LENGTH_SHORT).show()
                        refresh++
                    },
                )
            }
        }
    }
}

@Composable
private fun BugReportRow(
    report: SavedBugReport,
    onShare: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(
                report.screen.ifBlank { report.baseName },
                fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ink,
            )
            Text(
                report.createdAt.ifBlank { report.baseName }.replace('T', ' '),
                fontSize = 12.sp, color = Muted,
            )
        }
        TextButton(onClick = onShare) { Text("שתף", color = Teal) }
        TextButton(onClick = onDelete) { Text("מחק", color = BlockRed) }
    }
}

// ---------- רכיבי-עזר ----------

/** כרטיס-מקטע עם כותרת בצבע-המותג. */
@Composable
private fun BugUploadSection() {
    val context = LocalContext.current
    val treeUri by Prefs.bugUploadTreeUriState
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) {
            try {
                context.contentResolver.takePersistableUriPermission(
                    uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
                )
            } catch (_: Exception) {}
            Prefs.bugUploadTreeUri = uri.toString()
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            if (treeUri.isBlank()) "לא נבחרה תיקייה — דיווחי-🐞 נשלחים ידנית."
            else "✓ תיקייה נבחרה — כל דיווח-🐞 עולה אוטומטית ומגיע למיכאל.",
            fontSize = 13.sp, color = if (treeUri.isBlank()) Muted else Teal, fontWeight = FontWeight.SemiBold,
        )
        Text(
            "בחר תיקיית-Drive מסונכרנת — כל דיווח-באג יועלה אליה אוטומטית (בלי שיתוף-ידני).",
            fontSize = 12.sp, color = Muted,
        )
        Button(
            onClick = { picker.launch(null) },
            colors = ButtonDefaults.buttonColors(containerColor = Teal, contentColor = Color.White),
        ) { Text(if (treeUri.isBlank()) "בחר תיקיית-Drive לבאגים" else "שנה תיקייה", fontWeight = FontWeight.SemiBold) }
    }
}

/** מאגר-לקוחות — רשימה + "הקמת לקוח" (שם + קישור לתיקיית-Drive). */
@Composable
private fun ClientsSection() {
    val context = LocalContext.current
    var clients by remember { mutableStateOf(il.co.soline.measure.data.ClientsStore.all(context)) }
    var showAdd by remember { mutableStateOf(false) }
    var dialogName by remember { mutableStateOf("") }
    var dialogUri by remember { mutableStateOf("") }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) {
            try {
                context.contentResolver.takePersistableUriPermission(
                    uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
                )
            } catch (_: Exception) {}
            dialogUri = uri.toString()
        }
    }

    fun openFolder(uriStr: String) {
        try {
            context.startActivity(
                Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(android.net.Uri.parse(uriStr), "vnd.android.document/directory")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                },
            )
        } catch (_: Exception) {
            android.widget.Toast.makeText(context, "לא ניתן לפתוח את התיקייה", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (clients.isEmpty()) {
            Text("אין לקוחות עדיין. הקם לקוח וקשר לו תיקיית-Drive.", fontSize = 12.sp, color = Muted)
        } else {
            clients.forEach { c ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(c.name, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = il.co.soline.measure.ui.Ink)
                        Text(
                            if (c.hasFolder) "✓ תיקייה מקושרת" else "אין תיקייה",
                            fontSize = 11.sp, color = if (c.hasFolder) Teal else Muted,
                        )
                    }
                    if (c.hasFolder) {
                        androidx.compose.material3.TextButton(onClick = { openFolder(c.folderUri) }) {
                            Text("📂 פתח", color = Teal)
                        }
                    }
                }
            }
        }
        Button(
            onClick = { dialogName = ""; dialogUri = ""; showAdd = true },
            colors = ButtonDefaults.buttonColors(containerColor = il.co.soline.measure.ui.Orange, contentColor = Color.White),
        ) { Text("＋ הקמת לקוח", fontWeight = FontWeight.SemiBold) }
    }

    if (showAdd) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showAdd = false },
            confirmButton = {
                androidx.compose.material3.TextButton(
                    onClick = {
                        if (dialogName.isNotBlank()) {
                            il.co.soline.measure.data.ClientsStore.upsert(context, dialogName, dialogUri)
                            clients = il.co.soline.measure.data.ClientsStore.all(context)
                            showAdd = false
                        }
                    },
                    enabled = dialogName.isNotBlank(),
                ) { Text("שמור", color = il.co.soline.measure.ui.Orange, fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { showAdd = false }) { Text("ביטול", color = Muted) }
            },
            title = { Text("הקמת לקוח", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    androidx.compose.material3.OutlinedTextField(
                        value = dialogName, onValueChange = { dialogName = it },
                        label = { Text("שם הלקוח / המפעל") }, singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Button(
                        onClick = { picker.launch(null) },
                        colors = ButtonDefaults.buttonColors(containerColor = Teal, contentColor = Color.White),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            if (dialogUri.isBlank()) "🔗 קשר תיקיית-Drive" else "✓ תיקייה מקושרת — שנה",
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            },
            containerColor = Color.White,
        )
    }
}

@Composable
private fun Section(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column {
        Text(
            title,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = Teal,
            modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
        )
        SolineCard {
            Column(content = content)
        }
    }
}

@Composable
private fun SectionDivider() {
    HorizontalDivider(Modifier.padding(vertical = 12.dp), color = Cream)
}

/** שורת מתג (Switch) עם כותרת ותת-כותרת. */
@Composable
private fun SwitchRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onChange: (Boolean) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ink)
            Text(subtitle, fontSize = 12.sp, color = Muted)
        }
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = Orange,
                uncheckedTrackColor = Cream,
                uncheckedBorderColor = Muted
            )
        )
    }
}

/** שורת בחירה מרשימה נפתחת. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownRow(
    label: String,
    selected: String,
    options: List<String>,
    onSelectIndex: (Int) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = Modifier.fillMaxWidth()
    ) {
        OutlinedTextField(
            value = selected,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { Icon(Icons.Filled.ArrowDropDown, contentDescription = null, tint = Muted) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(MenuAnchorType.PrimaryNotEditable),
            colors = fieldColors()
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEachIndexed { i, opt ->
                DropdownMenuItem(
                    text = { Text(opt, color = Ink) },
                    onClick = {
                        onSelectIndex(i)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Orange,
    unfocusedBorderColor = Muted,
    focusedLabelColor = Teal,
    cursorColor = Orange,
    focusedTextColor = Ink,
    unfocusedTextColor = Ink
)

