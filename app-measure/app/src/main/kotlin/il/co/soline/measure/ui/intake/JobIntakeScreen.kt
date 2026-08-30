package il.co.soline.measure.ui.intake

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.data.ClientsStore
import il.co.soline.measure.data.JobEntity
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import kotlin.math.roundToInt

/**
 * מסך-פתיחת-פרויקט מסודר — טופס-אינטייק לפי הסכמה של המודד.
 * מפעל-מזמין (מאגר-לקוחות) · לקוח-קצה(=שם-הפרויקט) · כתובת-מובנית · דרכי-גישה (מעלית+מידות-בלייזר) · הערות-מודד.
 * הנתונים נארזים לשדות-JobEntity הקיימים (בלי מיגרציית-DB) ומוצגים בדו"ח.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JobIntakeScreen(
    onSave: (JobEntity) -> Unit,
    onBack: () -> Unit,
    carpenterName: String = "",
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val ble = SolineApp.instance.ble
    val reading by ble.lastReading.collectAsState()
    val knownFactories = remember { ClientsStore.all(context) }

    // ── מפעל-מזמין (לקוח קבוע) ──
    var factory by remember { mutableStateOf("") }
    // ── לקוח-קצה = שם-הפרויקט ──
    var clientName by remember { mutableStateOf("") }
    var contact by remember { mutableStateOf("") }

    // ── כתובת מובנית ──
    var city by remember { mutableStateOf("") }
    var street by remember { mutableStateOf("") }
    var houseNo by remember { mutableStateOf("") }
    var floor by remember { mutableStateOf("") }
    var apt by remember { mutableStateOf("") }
    var entrance by remember { mutableStateOf("") }

    // ── דרכי-גישה ──
    var elevator by remember { mutableStateOf(false) }
    var elevH by remember { mutableStateOf("") }
    var elevW by remember { mutableStateOf("") }
    var elevD by remember { mutableStateOf("") }
    var accessVehicle by remember { mutableStateOf("") } // גישת-רכב/פריקה
    var accessRemark by remember { mutableStateOf("") }

    // ── הערות-מודד (מתקפל) ──
    var surveyorNotes by remember { mutableStateOf("") }
    var moreExpanded by remember { mutableStateOf(false) }

    fun laserCm(): String =
        reading?.distanceMm?.let { (it / 10.0).roundToInt().toString() } ?: ""

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = Cream,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("פתיחת פרויקט", fontWeight = FontWeight.Bold)
                        val sub = if (carpenterName.isBlank()) "טופס פתיחה מסודר"
                        else "עבור $carpenterName"
                        Text(sub, fontSize = 12.sp, color = Muted)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "חזרה", tint = Ink)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Cream, titleContentColor = Ink),
            )
        },
    ) { pad ->
        Column(
            Modifier.padding(pad).fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // ── מפעל-מזמין (מאגר-לקוחות) ──
            Section("מפעל מזמין") {
                BigField(factory, { factory = it }, "שם המפעל / הנגר")
                if (knownFactories.isNotEmpty()) {
                    Text("מהמאגר:", fontSize = 12.sp, color = Muted)
                    Row(
                        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        knownFactories.forEach { c ->
                            Chip(c.name) { factory = c.name }
                        }
                    }
                }
            }

            // ── פרטי הפרויקט (לקוח-קצה) ──
            Section("פרטי הפרויקט") {
                BigField(clientName, { clientName = it }, "שם הלקוח (= שם הפרויקט) *")
                BigField(contact, { contact = it }, "איש-קשר באתר")
            }

            // ── כתובת מובנית ──
            Section("כתובת") {
                BigField(city, { city = it }, "עיר")
                BigField(street, { street = it }, "רחוב")
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.weight(1f)) { BigField(houseNo, { houseNo = it }, "מס' בית", KeyboardType.Number) }
                    Box(Modifier.weight(1f)) { BigField(floor, { floor = it }, "קומה", KeyboardType.Number) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.weight(1f)) { BigField(apt, { apt = it }, "דירה") }
                    Box(Modifier.weight(1f)) { BigField(entrance, { entrance = it }, "כניסה") }
                }
                Text("בבית פרטי — מלא רק מה שרלוונטי.", fontSize = 12.sp, color = Muted)
            }

            // ── דרכי-גישה (למוביל) ──
            Section("דרכי-גישה (למוביל)") {
                ToggleRow("יש מעלית", elevator) { elevator = it }
                AnimatedVisibility(visible = elevator) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("מידות-מעלית (ס\"מ) — הזן ידנית או 📡 מהלייזר:", fontSize = 12.sp, color = Muted)
                        LaserDimRow("גובה", elevH, { elevH = it }) { elevH = laserCm() }
                        LaserDimRow("רוחב", elevW, { elevW = it }) { elevW = laserCm() }
                        LaserDimRow("עומק", elevD, { elevD = it }) { elevD = laserCm() }
                    }
                }
                BigField(accessVehicle, { accessVehicle = it }, "גישת-רכב / פריקה (קרוב? מדרגות?)")
                BigField(accessRemark, { accessRemark = it }, "הערות-גישה", singleLine = false)
            }

            // ── הערות-מודד (מתקפל) ──
            CollapsibleSection("הערות-מודד", moreExpanded, { moreExpanded = !moreExpanded }) {
                Text("כל דבר רלוונטי: משטח לא-ישר, קיר-עקום ידוע, אילוצי-זמן, בעל-בית נוכח…", fontSize = 12.sp, color = Muted)
                BigField(surveyorNotes, { surveyorNotes = it }, "הערות חופשיות", singleLine = false)
            }

            // ── פעולה ראשית ──
            PrimaryButton(
                text = "התחל שרטוט",
                enabled = clientName.isNotBlank(),
                onClick = {
                    // יצירת-לקוח נעשית בהגדרות (מאגר-לקוחות); כאן רק בוחרים.
                    onSave(
                        JobEntity(
                            clientName = clientName.trim(),
                            clientCompany = factory.trim(),
                            contact = contact.trim(),
                            city = city.trim(),
                            address1 = listOf(street.trim(), houseNo.trim()).filter { it.isNotBlank() }.joinToString(" "),
                            address2 = buildList {
                                if (floor.isNotBlank()) add("קומה ${floor.trim()}")
                                if (apt.isNotBlank()) add("דירה ${apt.trim()}")
                                if (entrance.isNotBlank()) add("כניסה ${entrance.trim()}")
                            }.joinToString(" · "),
                            accessNotes = buildAccessNotes(
                                elevator, elevH, elevW, elevD, accessVehicle, accessRemark, surveyorNotes,
                            ),
                        )
                    )
                },
            )
            Spacer(Modifier.height(24.dp))
        }
    }
}

/** מאחד גישה + מעלית + הערות-מודד למחרוזת accessNotes אחת (מוצגת בדו"ח). */
private fun buildAccessNotes(
    elevator: Boolean, h: String, w: String, d: String,
    vehicle: String, remark: String, surveyorNotes: String,
): String = buildList {
    if (elevator) {
        val dims = listOf(h, w, d).map { it.trim() }
        val dimStr = if (dims.any { it.isNotBlank() }) " (ג${dims[0]}×ר${dims[1]}×ע${dims[2]} ס\"מ)" else ""
        add("מעלית: יש$dimStr")
    } else add("מעלית: אין")
    if (vehicle.isNotBlank()) add("גישת-רכב: ${vehicle.trim()}")
    if (remark.isNotBlank()) add("הערות-גישה: ${remark.trim()}")
    if (surveyorNotes.isNotBlank()) add("הערות-מודד: ${surveyorNotes.trim()}")
}.joinToString(" · ")

// ── רכיבי-עזר ──────────────────────────────────────────────────────────────

@Composable
private fun Chip(text: String, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(999.dp),
        color = Teal.copy(alpha = 0.10f),
    ) {
        Text(text, fontSize = 13.sp, color = Teal, fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 6.dp))
    }
}

/** שדה-מידה עם כפתור 📡 שממלא מהלייזר. */
@Composable
private fun LaserDimRow(label: String, value: String, onValue: (String) -> Unit, onLaser: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.weight(1f)) { BigField(value, onValue, label, KeyboardType.Number) }
        Surface(
            onClick = onLaser,
            shape = RoundedCornerShape(12.dp),
            color = OkGreen.copy(alpha = 0.14f),
        ) {
            Box(Modifier.heightIn(min = 56.dp).width(64.dp), contentAlignment = Alignment.Center) {
                Text("📡", fontSize = 22.sp)
            }
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = Teal)
            content()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CollapsibleSection(
    title: String,
    expanded: Boolean,
    onToggle: () -> Unit,
    content: @Composable () -> Unit,
) {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                Modifier.fillMaxWidth().clickable(onClick = onToggle),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(title, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = Teal)
                Icon(
                    if (expanded) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
                    contentDescription = if (expanded) "כווץ" else "הרחב",
                    tint = Muted,
                )
            }
            AnimatedVisibility(visible = expanded) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { content() }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BigField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = singleLine,
        minLines = if (singleLine) 1 else 2,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        textStyle = MaterialTheme.typography.bodyLarge,
        modifier = Modifier.fillMaxWidth().heightIn(min = if (singleLine) 60.dp else 84.dp),
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Orange,
            focusedLabelColor = Orange,
            cursorColor = Orange,
            unfocusedBorderColor = Muted.copy(alpha = 0.4f),
        ),
    )
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable { onChange(!checked) }.padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, fontSize = 16.sp, color = Ink)
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = Teal),
        )
    }
}

@Composable
private fun PrimaryButton(text: String, enabled: Boolean, onClick: () -> Unit) {
    val bg = if (enabled) Orange else Muted.copy(alpha = 0.4f)
    Box(
        Modifier.fillMaxWidth().height(56.dp)
            .background(bg, RoundedCornerShape(14.dp))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
    }
}
