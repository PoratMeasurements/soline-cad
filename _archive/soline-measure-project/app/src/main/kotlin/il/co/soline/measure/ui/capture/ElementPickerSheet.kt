package il.co.soline.measure.ui.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.catalog.ElementCatalog
import il.co.soline.measure.catalog.ElementDef
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal

/*
 * בורר-אלמנטים מהיר לשטח (wishlist §5) — גיליון-תחתון מקובץ, ניתן-לחיפוש, RTL, צבעי-מותג.
 * "לא רוצה לתקתק יותר מפעם אחת לפעולה" (§1) — המודד מקיש סוג ומיד ממשיך למדוד.
 */

/**
 * גיליון בחירת-אלמנט. הקשה על אלמנט מפעילה [onPick] וסוגרת את הגיליון.
 *
 * @param onPick    נקרא עם ה-ElementDef שנבחר.
 * @param onDismiss נקרא כשהמשתמש סוגר בלי לבחור.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ElementPickerSheet(
    onPick: (ElementDef) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var query by remember { mutableStateOf("") }

    val groups by remember(query) {
        derivedStateOf {
            val q = query.trim()
            ElementCatalog.byGroup
                .map { (group, items) ->
                    group to if (q.isEmpty()) items
                    else items.filter { it.he.contains(q, ignoreCase = true) || it.key.contains(q, ignoreCase = true) }
                }
                .filter { it.second.isNotEmpty() }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Cream,
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 24.dp)) {
            Text("בחר סוג אלמנט", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
            Spacer(Modifier.height(12.dp))

            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("חיפוש פריט…", color = Muted) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "חיפוש", tint = Teal) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Orange,
                    unfocusedBorderColor = Muted,
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                ),
            )
            Spacer(Modifier.height(12.dp))

            if (groups.isEmpty()) {
                Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                    Text("לא נמצאו פריטים", color = Muted, fontSize = 15.sp)
                }
            } else {
                LazyColumn(Modifier.fillMaxWidth().heightIn(max = 520.dp)) {
                    groups.forEach { (group, items) ->
                        item(key = "h_$group") { GroupHeader(group, items.size) }
                        items(items, key = { it.key }) { def ->
                            ElementRow(def) { onPick(def) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun GroupHeader(group: String, count: Int) {
    Row(
        Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 6.dp),
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
private fun ElementRow(def: ElementDef, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(def.he, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                Text(
                    buildString {
                        if (def.hasDepth) append("עומק ${def.defaultDepth.toInt()} מ\"מ") else append("ללא עומק")
                        if (def.round) append(" · עגול")
                    },
                    fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 2.dp),
                )
            }
            if (def.round) Tag("עגול")
        }
    }
}

@Composable
private fun Tag(text: String) {
    Box(
        Modifier.clip(RoundedCornerShape(50)).background(Orange.copy(alpha = 0.15f))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(text, fontSize = 11.sp, color = Orange, fontWeight = FontWeight.SemiBold)
    }
}
