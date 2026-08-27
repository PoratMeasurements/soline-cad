package il.co.soline.measure.ui.intake

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.data.JobEntity
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal

/**
 * מסך-פתיחת-עבודה: הנגר (הלקוח של Soline) פותח פרויקט עבור הלקוח-הפרטי שלו,
 * מזין פרטים + דרכי-גישה, ומתחיל שרטוט.
 *
 * @param onSave        נקרא עם ה-JobEntity המלא כשלוחצים "התחל שרטוט".
 * @param onBack        חזרה.
 * @param carpenterName שם-הנגר להצגה (הלקוח של Soline). לא נשמר ב-JobEntity (רק ה-carpenterId נשמר).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JobIntakeScreen(
    onSave: (JobEntity) -> Unit,
    onBack: () -> Unit,
    carpenterName: String = "",
    modifier: Modifier = Modifier,
) {
    // ── פרטי הלקוח-הפרטי ──
    var clientName by remember { mutableStateOf("") }
    var clientPhone by remember { mutableStateOf("") }
    var clientCompany by remember { mutableStateOf("") }
    var contact by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }

    // ── כתובת ──
    var address1 by remember { mutableStateOf("") }
    var address2 by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var zip by remember { mutableStateOf("") }

    // ── משלוח ──
    var deliveryDifferent by remember { mutableStateOf(false) }
    var deliveryAddress by remember { mutableStateOf("") }

    // ── דרכי-גישה ──
    var accessFloor by remember { mutableStateOf("") }   // קומה
    var accessElevator by remember { mutableStateOf(false) } // מעלית
    var accessParking by remember { mutableStateOf("") }  // חניה
    var accessRemark by remember { mutableStateOf("") }   // הערות-גישה

    // ── "פרטים נוספים" (מתקפל) ──
    var moreExpanded by remember { mutableStateOf(false) }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = Cream,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("פתיחת פרויקט", fontWeight = FontWeight.Bold)
                        val sub = if (carpenterName.isBlank()) "לקוח פרטי חדש"
                        else "עבור לקוח של $carpenterName"
                        Text(sub, fontSize = 12.sp, color = Muted)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "חזרה", tint = Ink)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Cream,
                    titleContentColor = Ink,
                ),
            )
        },
    ) { pad ->
        Column(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // ── פרטי הלקוח-הפרטי ──
            Section("פרטי הלקוח") {
                BigField(clientName, { clientName = it }, "שם הלקוח *")
                BigField(clientPhone, { clientPhone = it }, "טלפון / נייד", KeyboardType.Phone)
                BigField(contact, { contact = it }, "איש-קשר באתר")
                BigField(email, { email = it }, "אימייל", KeyboardType.Email)
            }

            // ── כתובת ──
            Section("כתובת") {
                BigField(address1, { address1 = it }, "כתובת")
                BigField(city, { city = it }, "עיר")
            }

            // ── דרכי-גישה ──
            Section("דרכי-גישה") {
                BigField(accessFloor, { accessFloor = it }, "קומה", KeyboardType.Number)
                ToggleRow("מעלית", accessElevator) { accessElevator = it }
                BigField(accessParking, { accessParking = it }, "חניה")
                BigField(accessRemark, { accessRemark = it }, "הערות-גישה", singleLine = false)
            }

            // ── פרטים נוספים (מתקפל) ──
            CollapsibleSection(
                title = "פרטים נוספים",
                expanded = moreExpanded,
                onToggle = { moreExpanded = !moreExpanded },
            ) {
                BigField(clientCompany, { clientCompany = it }, "חברה")
                BigField(address2, { address2 = it }, "כתובת (שורה 2)")
                BigField(zip, { zip = it }, "מיקוד", KeyboardType.Number)

                Spacer(Modifier.height(4.dp))
                ToggleRow("כתובת-משלוח שונה", deliveryDifferent) { deliveryDifferent = it }
                AnimatedVisibility(visible = deliveryDifferent) {
                    BigField(
                        deliveryAddress, { deliveryAddress = it },
                        "כתובת-משלוח", singleLine = false,
                    )
                }
            }

            // ── פעולה ראשית ──
            PrimaryButton(
                text = "התחל שרטוט",
                enabled = clientName.isNotBlank(),
                onClick = {
                    onSave(
                        JobEntity(
                            clientName = clientName.trim(),
                            clientPhone = clientPhone.trim(),
                            clientCompany = clientCompany.trim(),
                            contact = contact.trim(),
                            email = email.trim(),
                            address1 = address1.trim(),
                            address2 = address2.trim(),
                            city = city.trim(),
                            zip = zip.trim(),
                            deliveryDifferent = deliveryDifferent,
                            deliveryAddress = if (deliveryDifferent) deliveryAddress.trim() else "",
                            accessNotes = buildAccessNotes(
                                floor = accessFloor,
                                elevator = accessElevator,
                                parking = accessParking,
                                remark = accessRemark,
                            ),
                        )
                    )
                },
            )
            Spacer(Modifier.height(24.dp))
        }
    }
}

/** מאחד את שדות-הגישה למחרוזת accessNotes אחת שנשמרת ב-JobEntity. */
private fun buildAccessNotes(
    floor: String,
    elevator: Boolean,
    parking: String,
    remark: String,
): String = buildList {
    if (floor.isNotBlank()) add("קומה: ${floor.trim()}")
    add("מעלית: ${if (elevator) "יש" else "אין"}")
    if (parking.isNotBlank()) add("חניה: ${parking.trim()}")
    if (remark.isNotBlank()) add("הערות: ${remark.trim()}")
}.joinToString(" · ")

// ── רכיבי-עזר ──────────────────────────────────────────────────────────────

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
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggle),
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
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = if (singleLine) 60.dp else 84.dp),
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
        Modifier
            .fillMaxWidth()
            .clickable { onChange(!checked) }
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, fontSize = 16.sp, color = Ink)
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = Teal,
            ),
        )
    }
}

@Composable
private fun PrimaryButton(text: String, enabled: Boolean, onClick: () -> Unit) {
    val bg = if (enabled) Orange else Muted.copy(alpha = 0.4f)
    Box(
        Modifier
            .fillMaxWidth()
            .height(56.dp)
            .background(bg, RoundedCornerShape(14.dp))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
    }
}
