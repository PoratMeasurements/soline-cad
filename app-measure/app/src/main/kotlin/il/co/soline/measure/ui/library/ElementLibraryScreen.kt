package il.co.soline.measure.ui.library

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.catalog.ElementCatalog
import il.co.soline.measure.catalog.ElementDef
import il.co.soline.measure.catalog.ElementGroup
import il.co.soline.measure.data.CustomElementStore
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal

/*
 * מסך "ספריית אלמנטים" — מנהל-הקטלוג של Soline (עדיפות-על של Michael).
 * עורך-קטלוג עם ניהול-וריאנטים:
 *   • רשימת כל האלמנטים (מובנה + אישי) מקובצת לפי קטגוריה.
 *   • שכפול (📋) לכל שורה → יוצר עותק אישי ניתן-לעריכה.
 *   • "＋ אלמנט חדש" ו-"צור על בסיס קיים" (בחר בסיס → עורך ממולא-מראש).
 *   • אלמנט מובנה = קריאה-בלבד + שכפיל; אלמנט אישי = עריכה + מחיקה.
 * הכול RTL, עברית לשון-זכר, צבעי-מותג מ-ui.Theme.
 */

/** מצב-טיוטה של העורך. [originalKey]=null → אלמנט חדש/משוכפל (הוספה); אחרת → עדכון אלמנט אישי קיים. */
private data class ElementDraft(
    val originalKey: String?,
    val he: String,
    val group: String,
    val depthText: String,
    val round: Boolean,
    val hasDepth: Boolean,
    val ordxClass: String,
    val ordxType: String,
)

private fun ElementDef.toDraft(originalKey: String?) = ElementDraft(
    originalKey = originalKey,
    he = he,
    group = group,
    depthText = Prefs.toDisplayText(defaultDepth),
    round = round,
    hasDepth = hasDepth,
    ordxClass = ordxClass,
    ordxType = ordxType,
)

private val ORDX_CLASSES = listOf("Fixture", "Decorative", "Appliance", "Accessory")
private val ORDX_TYPES = listOf("Miscellaneous", "Part", "Window", "EntryDoor", "TWall", "DishWasher")

/**
 * מסך ספריית-האלמנטים.
 *
 * @param onBack נקרא בלחיצת "חזרה" (הניווט בידי המשלב — ראה AppUi).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ElementLibraryScreen(onBack: () -> Unit) {
    val custom by CustomElementStore.allState

    var draft by remember { mutableStateOf<ElementDraft?>(null) }   // עורך פתוח כאשר ≠ null
    var showBasePicker by remember { mutableStateOf(false) }        // "צור על בסיס קיים"
    var pendingDelete by remember { mutableStateOf<ElementDef?>(null) }

    val groups = remember(custom) { ElementCatalog.byGroupWith(custom) }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Column(Modifier.fillMaxSize().background(Cream)) {

            // ── סרגל-עליון ──────────────────────────────────────────────
            Row(
                Modifier.fillMaxWidth().background(Teal).padding(horizontal = 12.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onBack) {
                    Text("← חזרה", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.weight(1f))
                Text("ספריית אלמנטים", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold)
            }

            // ── כפתורי-יצירה ────────────────────────────────────────────
            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    onClick = {
                        draft = ElementDraft(
                            originalKey = null, he = "", group = ElementGroup.order.first(),
                            depthText = "0", round = false, hasDepth = true,
                            ordxClass = "Fixture", ordxType = "Miscellaneous",
                        )
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Orange),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("＋ אלמנט חדש", fontSize = 15.sp, fontWeight = FontWeight.Bold) }

                OutlinedButton(
                    onClick = { showBasePicker = true },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Teal),
                ) { Text("צור על בסיס קיים", fontSize = 15.sp, fontWeight = FontWeight.SemiBold) }
            }

            // ── רשימה מקובצת ────────────────────────────────────────────
            LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
                groups.forEach { (group, items) ->
                    item(key = "h_$group") { GroupHeader(group, items.size) }
                    items(items, key = { it.key }) { def ->
                        val isCustom = CustomElementStore.isCustom(def.key)
                        LibraryRow(
                            def = def,
                            isCustom = isCustom,
                            onDuplicate = {
                                // שכפול → עותק אישי ניתן-לעריכה, שם + " (עותק)"
                                draft = def.toDraft(originalKey = null).copy(he = def.he + " (עותק)")
                            },
                            onEdit = { if (isCustom) draft = def.toDraft(originalKey = def.key) },
                            onDelete = { if (isCustom) pendingDelete = def },
                        )
                    }
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }

        // ── עורך-אלמנט ──────────────────────────────────────────────────
        draft?.let { d ->
            ElementEditorSheet(
                draft = d,
                onChange = { draft = it },
                onDismiss = { draft = null },
                onSave = {
                    val depth = Prefs.parseToMm(d.depthText) ?: 0.0   // קלט ביחידת-התצוגה → מ"מ
                    val key = d.originalKey ?: CustomElementStore.newKey()
                    val saved = ElementDef(
                        key = key,
                        he = d.he.ifBlank { "אלמנט אישי" },
                        group = d.group,
                        defaultDepth = if (d.hasDepth) depth else 0.0,
                        round = d.round,
                        hasDepth = d.hasDepth,
                        ordxClass = d.ordxClass.ifBlank { "Fixture" },
                        ordxType = d.ordxType.ifBlank { "Miscellaneous" },
                    )
                    if (d.originalKey == null) CustomElementStore.add(saved)
                    else CustomElementStore.update(saved)
                    draft = null
                },
            )
        }

        // ── בורר-בסיס ל"צור על בסיס קיים" ───────────────────────────────
        if (showBasePicker) {
            BasePickerSheet(
                groups = groups,
                onDismiss = { showBasePicker = false },
                onPick = { base ->
                    showBasePicker = false
                    draft = base.toDraft(originalKey = null).copy(he = base.he + " (מותאם)")
                },
            )
        }

        // ── אישור-מחיקה (אישי בלבד) ─────────────────────────────────────
        pendingDelete?.let { def ->
            AlertDialog(
                onDismissRequest = { pendingDelete = null },
                confirmButton = {
                    TextButton(onClick = { CustomElementStore.remove(def.key); pendingDelete = null }) {
                        Text("מחק", color = Orange, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text("ביטול", color = Muted) } },
                title = { Text("מחיקת אלמנט", color = Ink, fontWeight = FontWeight.Bold) },
                text = { Text("למחוק את \"${def.he}\" מהספרייה האישית?", color = Ink) },
                containerColor = Cream,
            )
        }
    }
}

@Composable
private fun GroupHeader(group: String, count: Int) {
    Row(
        Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(Teal))
        Spacer(Modifier.width(8.dp))
        Text(group, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Teal)
        Spacer(Modifier.width(8.dp))
        Text("($count)", fontSize = 13.sp, color = Muted)
    }
}

@Composable
private fun LibraryRow(
    def: ElementDef,
    isCustom: Boolean,
    onDuplicate: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
            .then(if (isCustom) Modifier.clickable(onClick = onEdit) else Modifier),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(def.he, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                    Spacer(Modifier.width(8.dp))
                    TypeBadge(if (isCustom) "אישי" else "מובנה", if (isCustom) OkGreen else Muted)
                }
                Text(
                    buildString {
                        if (def.hasDepth) append("עומק ${Prefs.formatLen(def.defaultDepth)}") else append("ללא עומק")
                        if (def.round) append(" · עגול")
                        append(" · ${def.ordxClass}/${def.ordxType}")
                    },
                    fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 3.dp),
                )
            }
            // שכפול — זמין לכל שורה (מובנה משוכפל לעותק אישי)
            IconTextButton("📋", onDuplicate)
            if (isCustom) {
                IconTextButton("✏️", onEdit)
                IconTextButton("🗑", onDelete)
            }
        }
    }
}

@Composable
private fun IconTextButton(glyph: String, onClick: () -> Unit) {
    Box(
        Modifier.padding(start = 4.dp).clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick).padding(horizontal = 8.dp, vertical = 6.dp),
    ) { Text(glyph, fontSize = 18.sp) }
}

@Composable
private fun TypeBadge(text: String, color: Color) {
    Box(
        Modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.15f))
            .padding(horizontal = 8.dp, vertical = 2.dp),
    ) { Text(text, fontSize = 11.sp, color = color, fontWeight = FontWeight.SemiBold) }
}

// ─────────────────────────────────────────────────────────────────────────
//  עורך-אלמנט (Sheet)
// ─────────────────────────────────────────────────────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ElementEditorSheet(
    draft: ElementDraft,
    onChange: (ElementDraft) -> Unit,
    onDismiss: () -> Unit,
    onSave: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = Cream) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text(
                    if (draft.originalKey == null) "אלמנט אישי חדש" else "עריכת אלמנט",
                    fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink,
                )

                Field("שם") {
                    OutlinedTextField(
                        value = draft.he, onValueChange = { onChange(draft.copy(he = it)) },
                        placeholder = { Text("שם האלמנט", color = Muted) },
                        singleLine = true, modifier = Modifier.fillMaxWidth(),
                        colors = fieldColors(),
                    )
                }

                Field("קטגוריה") {
                    DropdownField(
                        value = draft.group, options = ElementGroup.order,
                        onSelect = { onChange(draft.copy(group = it)) },
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Column(Modifier.weight(1f)) {
                        Field("עומק ברירת-מחדל (${Prefs.unitSuffix})") {
                            OutlinedTextField(
                                value = draft.depthText,
                                onValueChange = { onChange(draft.copy(depthText = it.filter { c -> c.isDigit() || c == '.' })) },
                                enabled = draft.hasDepth,
                                singleLine = true, modifier = Modifier.fillMaxWidth(),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                colors = fieldColors(),
                            )
                        }
                    }
                    Column {
                        SwitchRow("יש עומק?", draft.hasDepth) { onChange(draft.copy(hasDepth = it)) }
                        SwitchRow("עגול?", draft.round) { onChange(draft.copy(round = it)) }
                    }
                }

                Text("מיפוי ORDX", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Teal)
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Column(Modifier.weight(1f)) {
                        Field("Class") {
                            DropdownField(draft.ordxClass, ORDX_CLASSES) { onChange(draft.copy(ordxClass = it)) }
                        }
                    }
                    Column(Modifier.weight(1f)) {
                        Field("Type") {
                            DropdownField(draft.ordxType, ORDX_TYPES) { onChange(draft.copy(ordxType = it)) }
                        }
                    }
                }

                Spacer(Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(
                        onClick = onSave, modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = OkGreen),
                        shape = RoundedCornerShape(12.dp),
                    ) { Text("שמור", fontSize = 16.sp, fontWeight = FontWeight.Bold) }
                    OutlinedButton(
                        onClick = onDismiss, modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Muted),
                    ) { Text("ביטול", fontSize = 16.sp) }
                }
            }
        }
    }
}

@Composable
private fun Field(label: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, fontSize = 13.sp, color = Muted, fontWeight = FontWeight.SemiBold)
        content()
    }
}

@Composable
private fun SwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 2.dp)) {
        Switch(
            checked = checked, onCheckedChange = onChange,
            colors = SwitchDefaults.colors(checkedTrackColor = Teal, checkedThumbColor = Color.White),
        )
        Spacer(Modifier.width(6.dp))
        Text(label, fontSize = 13.sp, color = Ink)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownField(value: String, options: List<String>, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(
            onClick = { open = true }, modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Ink),
        ) {
            Text(value.ifBlank { "בחר" }, fontSize = 15.sp, modifier = Modifier.weight(1f))
            Text("▾", fontSize = 14.sp, color = Muted)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEach { opt ->
                DropdownMenuItem(
                    text = { Text(opt, color = Ink) },
                    onClick = { onSelect(opt); open = false },
                )
            }
        }
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Orange,
    unfocusedBorderColor = Muted,
    focusedContainerColor = Color.White,
    unfocusedContainerColor = Color.White,
    disabledContainerColor = Cream,
)

// ─────────────────────────────────────────────────────────────────────────
//  בורר-בסיס ("צור על בסיס קיים")
// ─────────────────────────────────────────────────────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BasePickerSheet(
    groups: List<Pair<String, List<ElementDef>>>,
    onDismiss: () -> Unit,
    onPick: (ElementDef) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = Cream) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 24.dp)) {
                Text("בחר אלמנט-בסיס", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
                Spacer(Modifier.height(4.dp))
                Text("הווריאנט החדש יירש את מידותיו ומיפוי-ה-ORDX", fontSize = 13.sp, color = Muted)
                Spacer(Modifier.height(12.dp))
                LazyColumn(Modifier.fillMaxWidth().heightIn(max = 520.dp)) {
                    groups.forEach { (group, items) ->
                        item(key = "bh_$group") { GroupHeader(group, items.size) }
                        items(items, key = { "b_${it.key}" }) { def ->
                            Card(
                                onClick = { onPick(def) },
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                            ) {
                                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text(def.he, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ink, modifier = Modifier.weight(1f))
                                    TypeBadge(if (CustomElementStore.isCustom(def.key)) "אישי" else "מובנה",
                                        if (CustomElementStore.isCustom(def.key)) OkGreen else Muted)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
