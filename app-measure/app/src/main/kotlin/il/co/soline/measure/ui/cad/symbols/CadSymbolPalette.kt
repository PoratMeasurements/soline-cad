package il.co.soline.measure.ui.cad.symbols

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import il.co.soline.measure.catalog.CadSymbolCatalog
import il.co.soline.measure.catalog.CadSymbolCategory
import il.co.soline.measure.catalog.CadSymbolDef
import il.co.soline.measure.catalog.CadSymbolShape
import il.co.soline.measure.catalog.CadSymbolView
import il.co.soline.measure.data.CustomSymbolStore
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.ui.Border
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.OrangeBg
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.TealBg
import kotlinx.coroutines.launch

/*
 * לוח סמלי-CAD (CVSM #f-cad-symbol / #f-elev-cadsymbol) — Soline Measure.
 *
 * המדריך: "בורר דו-שלבי: קטגוריה (מולטימדיה וחשמל / ריהוט / מוצרי חשמל ואינסטלציה /
 * אלמנטים מבניים / הסמלים שלי) ואז הסמל הספציפי, עם תצוגה מקדימה חיה לכל אחד".
 *
 * גל-זה מספק את הלוח + חנות-הסמלים-המותאמים (Room). הצבת-סמל על קנבס-התוכנית/החזית
 * (גרירה/סיבוב/כיתוב) היא גל-המשך — ראה CVSM_BUILD_TRACKER Follow-up.
 */

/** האם התצוגה-המקדימה בבורר מציגה מבט-על או חזית. משותף לכל האריחים. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun CadSymbolPalette(
    onPick: (CadSymbolDef) -> Unit,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val custom by CustomSymbolStore.allAsDefs().collectAsStateWithLifecycle(emptyList())

    var category by remember { mutableStateOf(CadSymbolCategory.MEDIA_ELEC) }
    var view by remember { mutableStateOf(CadSymbolView.PLAN) }
    var showNew by remember { mutableStateOf(false) }
    var toDelete by remember { mutableStateOf<CadSymbolDef?>(null) }

    // קבוצות קיימות (מובנה + מותאם) — קבוצה ריקה מושמטת מהצ'יפים.
    val groups = remember(custom) { CadSymbolCatalog.byCategoryWith(custom) }
    // אם הקטגוריה הנבחרת התרוקנה (נמחק הסמל-האישי האחרון) — חזרה לראשונה.
    LaunchedEffect(groups) { if (groups.none { it.first == category }) category = groups.firstOrNull()?.first ?: CadSymbolCategory.MEDIA_ELEC }
    val symbols = remember(groups, category) { groups.firstOrNull { it.first == category }?.second ?: emptyList() }

    Scaffold(
        containerColor = Cream,
        floatingActionButton = {
            FloatingActionButton(onClick = { showNew = true }, containerColor = Orange, contentColor = Color.White) {
                Icon(Icons.Default.Add, "סמל חדש")
            }
        },
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            // ── כותרת + מתג תוכנית/חזית ────────────────────────────────────
            Row(
                Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
                Column(Modifier.weight(1f)) {
                    Text("סמלי CAD", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink)
                    Text("25 סמלים + הסמלים שלך", fontSize = 12.sp, color = Muted)
                }
                ViewToggle(view) { view = it }
            }

            // ── שלב 1: קטגוריה ─────────────────────────────────────────────
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                groups.forEach { (cat, items) ->
                    CategoryChip(cat, items.size, selected = cat == category) { category = cat }
                }
            }

            // ── שלב 2: סמל ─────────────────────────────────────────────────
            if (symbols.isEmpty()) {
                Box(Modifier.fillMaxSize().padding(40.dp), contentAlignment = Alignment.Center) {
                    Text("אין סמלים בקטגוריה זו. הקש + ליצירת סמל.", color = Muted, fontSize = 15.sp)
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(symbols, key = { it.key }) { def ->
                        SymbolTile(
                            def = def, view = view,
                            onClick = { onPick(def) },
                            onLongClick = { if (!def.builtin) toDelete = def },
                        )
                    }
                }
            }
        }
    }

    if (showNew) {
        NewSymbolDialog(
            existing = CadSymbolCatalog.allWith(custom),
            onDismiss = { showNew = false },
            onCreate = { key, he, shape, wMm, hMm, dMm ->
                scope.launch { CustomSymbolStore.add(key, he, shape, wMm, hMm, dMm) }
                category = CadSymbolCategory.CUSTOM
                showNew = false
            },
        )
    }

    toDelete?.let { def ->
        AlertDialog(
            onDismissRequest = { toDelete = null },
            confirmButton = {
                TextButton(onClick = { scope.launch { CustomSymbolStore.delete(def.key) }; toDelete = null }) {
                    Text("מחק", color = Orange, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = { TextButton(onClick = { toDelete = null }) { Text("ביטול", color = Muted) } },
            title = { Text("מחיקת סמל", fontWeight = FontWeight.Bold) },
            text = { Text("למחוק את הסמל המותאם \"${def.he}\"? הפעולה בלתי-הפיכה.") },
            containerColor = Color.White,
        )
    }
}

@Composable
private fun ViewToggle(view: CadSymbolView, onChange: (CadSymbolView) -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(50)).background(Cream).border(1.dp, Border, RoundedCornerShape(50)),
    ) {
        @Composable
        fun seg(label: String, v: CadSymbolView) {
            val on = view == v
            Box(
                Modifier.clip(RoundedCornerShape(50)).background(if (on) Teal else Color.Transparent)
                    .clickable { onChange(v) }.padding(horizontal = 12.dp, vertical = 6.dp),
            ) { Text(label, fontSize = 12.sp, color = if (on) Color.White else Muted, fontWeight = FontWeight.SemiBold) }
        }
        seg("תוכנית", CadSymbolView.PLAN)
        seg("חזית", CadSymbolView.ELEVATION)
    }
}

@Composable
private fun CategoryChip(cat: String, count: Int, selected: Boolean, onClick: () -> Unit) {
    Box(
        Modifier.clip(RoundedCornerShape(50))
            .background(if (selected) Orange else Color.White)
            .border(1.dp, if (selected) Orange else Border, RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) {
        Text(
            "$cat · $count", fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
            color = if (selected) Color.White else Ink,
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun SymbolTile(def: CadSymbolDef, view: CadSymbolView, onClick: () -> Unit, onLongClick: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White)
            .border(1.dp, if (def.builtin) Border else OkGreen.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
            .combinedClickable(onClick = onClick, onLongClick = onLongClick)
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SymbolPreview(def, view, Ink, Modifier.fillMaxWidth().height(64.dp))
        Spacer(Modifier.height(4.dp))
        Text(def.he, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Ink, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, lineHeight = 14.sp)
        if (!def.builtin) Text("אישי · לחיצה-ארוכה למחיקה", fontSize = 9.sp, color = OkGreen, textAlign = TextAlign.Center)
    }
}

/** דיאלוג "סמל חדש" — צורת-בסיס + תווית + מידות (מדריך §f-cad-symbol · "סמל חדש"). */
@Composable
private fun NewSymbolDialog(
    existing: List<CadSymbolDef>,
    onDismiss: () -> Unit,
    onCreate: (key: String, he: String, shape: CadSymbolShape, wMm: Double, hMm: Double, dMm: Double) -> Unit,
) {
    var he by remember { mutableStateOf("") }
    var shape by remember { mutableStateOf(CadSymbolShape.RECT) }
    var wTxt by remember { mutableStateOf(Prefs.toDisplayText(400.0)) }
    var hTxt by remember { mutableStateOf(Prefs.toDisplayText(400.0)) }
    var dTxt by remember { mutableStateOf(Prefs.toDisplayText(0.0)) }

    val wMm = Prefs.parseToMm(wTxt) ?: 0.0   // קלט ביחידת-התצוגה → מ"מ
    val hMm = Prefs.parseToMm(hTxt) ?: 0.0
    val valid = he.isNotBlank() && wMm > 0 && hMm > 0
    val previewDef = CadSymbolDef("PREVIEW", he.ifBlank { "סמל" }, CadSymbolCategory.CUSTOM, wMm, hMm, shape = shape, builtin = false)

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                enabled = valid,
                onClick = { onCreate(CustomSymbolStore.newKey(existing), he.trim(), shape, wMm, hMm, Prefs.parseToMm(dTxt) ?: 0.0) },
            ) { Text("צור סמל", color = if (valid) Orange else Muted, fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) } },
        title = { Text("סמל חדש", fontWeight = FontWeight.Bold) },
        text = {
            Column {
                // תצוגה-מקדימה חיה (תוכנית + חזית זו-לצד-זו)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    PreviewBox("תוכנית", previewDef, CadSymbolView.PLAN, Modifier.weight(1f))
                    PreviewBox("חזית", previewDef, CadSymbolView.ELEVATION, Modifier.weight(1f))
                }
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(he, { he = it }, label = { Text("תווית (למשל: כספת)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(10.dp))
                Text("צורת-בסיס", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Teal)
                Spacer(Modifier.height(6.dp))
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CadSymbolShape.customChoices.forEach { s ->
                        val on = s == shape
                        Box(
                            Modifier.clip(RoundedCornerShape(50)).background(if (on) TealBg else Color.White)
                                .border(1.dp, if (on) Teal else Border, RoundedCornerShape(50))
                                .clickable { shape = s }.padding(horizontal = 12.dp, vertical = 6.dp),
                        ) { Text(s.he, fontSize = 12.sp, color = if (on) Teal else Ink, fontWeight = FontWeight.SemiBold) }
                    }
                }
                Spacer(Modifier.height(10.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(wTxt, { wTxt = it }, label = { Text("רוחב ${Prefs.unitSuffix}") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
                    OutlinedTextField(hTxt, { hTxt = it }, label = { Text("גובה ${Prefs.unitSuffix}") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
                    OutlinedTextField(dTxt, { dTxt = it }, label = { Text("עומק ${Prefs.unitSuffix}") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
                }
            }
        },
        containerColor = Color.White,
    )
}

@Composable
private fun PreviewBox(label: String, def: CadSymbolDef, view: CadSymbolView, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier.fillMaxWidth().height(70.dp).clip(RoundedCornerShape(10.dp)).background(OrangeBg.copy(alpha = 0.3f))
                .border(1.dp, Border, RoundedCornerShape(10.dp)).padding(6.dp),
            contentAlignment = Alignment.Center,
        ) { SymbolPreview(def, view, Ink, Modifier.fillMaxSize()) }
        Text(label, fontSize = 11.sp, color = Muted, modifier = Modifier.padding(top = 3.dp))
    }
}
