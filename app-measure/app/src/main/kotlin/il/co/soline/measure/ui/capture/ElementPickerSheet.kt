package il.co.soline.measure.ui.capture

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.catalog.ElementCatalog
import il.co.soline.measure.catalog.ElementDef
import il.co.soline.measure.catalog.ElementGroup
import il.co.soline.measure.data.CustomElementStore
import il.co.soline.measure.data.RecentElementsStore
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.OrangeBg
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.TealBg

/*
 * בורר-אלמנטים מהיר לשטח (wishlist §1,§5) — "לרוץ על המדידה, לא לחפש דברים".
 * הבורר נפתח ל**מהירות ולא לחיפוש**: בראש רצועת-"מהיר" עם אריחי-ענק בהקשה-אחת
 * (מועדפים ★ + אחרונים + ברירות-מחדל נפוצות). חיפוש והקטלוג-המלא נשארים מתחת,
 * לחיפוש-כוח כשצריך — אבל אינם החיכוך שברירת-המחדל. הקשה-ארוכה על אריח = ★ מועדף.
 */

/** ברירות-המחדל הנפוצות ביותר — תמיד זמינות ברצועת-"מהיר" גם אם עדיין לא נבחרו. */
private val QUICK_DEFAULT_KEYS = listOf(
    "SOCKET_SINGLE",  // שקע בודד
    "SOCKET_MULTI",   // שקע מרובע
    "WATER_PIPE",     // מים
    "GAS_PIPE",       // גז
    "WINDOW",         // חלון
    "OPENING_FRAME",  // מפתח עם משקוף
    "AC_UNIT",        // מזגן
    "FLOOR_DRAIN",    // ניקוז רצפתי
)

/** כמה אריחים להציג ברצועת-"מהיר" (מועדפים + אחרונים + ברירות-מחדל, מסונן-כפילויות). */
private const val QUICK_MAX = 12
private const val TILES_PER_ROW = 4

/**
 * גיליון בחירת-אלמנט. הקשה על אלמנט מפעילה [onPick] וסוגרת את הגיליון.
 * לפני כל [onPick] מסומן שימוש ב-[RecentElementsStore] כדי שהאלמנט יעלה לראש רצועת-"מהיר".
 *
 * @param onPick           נקרא עם ה-ElementDef שנבחר.
 * @param onDismiss        נקרא כשהמשתמש סוגר בלי לבחור.
 * @param onManageLibrary  אופציונלי — אם סופק, מוצג כפתור "ספרייה / שכפול" שמנתב למסך-הספרייה.
 *                         חתימת הפונקציה לא השתנתה, כדי לא לשבור את המשלב.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ElementPickerSheet(
    onPick: (ElementDef) -> Unit,
    onDismiss: () -> Unit,
    onManageLibrary: (() -> Unit)? = null,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var query by remember { mutableStateOf("") }

    // מיזוג: אלמנטים מובנים + אישיים (CustomElementStore) — מקובצים יחד.
    val custom by CustomElementStore.allState
    val recent by RecentElementsStore.recentState
    val favorites by RecentElementsStore.favoritesState

    // בחירה = סמן-שימוש ואז onPick. נקודת-הכניסה היחידה, כדי ש-MRU תמיד מעודכן.
    val pick: (ElementDef) -> Unit = { def ->
        RecentElementsStore.markUsed(def.key)
        onPick(def)
    }

    // מפת-מפתח→ElementDef על-פני המרחב-הממוזג (לפתרון מפתחות-אחרונים/מועדפים במהירות).
    val byKey by remember(custom) {
        derivedStateOf { (ElementCatalog.all + custom).associateBy { it.key } }
    }

    // רצועת-"מהיר": מועדפים תחילה, ואז אחרונים, ואז ברירות-המחדל הנפוצות — ללא כפילויות.
    val quick by remember(custom, recent, favorites) {
        derivedStateOf {
            val order = LinkedHashSet<String>()
            order.addAll(favorites)
            order.addAll(recent)
            order.addAll(QUICK_DEFAULT_KEYS)
            order.mapNotNull { byKey[it] }.take(QUICK_MAX)
        }
    }

    // קטלוג-מלא (מתחת) — מסונן לפי החיפוש בלבד.
    val groups by remember(query, custom) {
        derivedStateOf {
            val q = query.trim()
            ElementCatalog.byGroupWith(custom)
                .map { (group, items) ->
                    group to if (q.isEmpty()) items
                    else items.filter { it.he.contains(q, ignoreCase = true) || it.key.contains(q, ignoreCase = true) }
                }
                .filter { it.second.isNotEmpty() }
        }
    }
    val searching by remember(query) { derivedStateOf { query.trim().isNotEmpty() } }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Cream,
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 24.dp)) {
            // ── כותרת + כפתור-ספרייה בולט ──────────────────────────────────
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("בחר אלמנט", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
                Spacer(Modifier.weight(1f))
                if (onManageLibrary != null) {
                    FilledTonalButton(
                        onClick = onManageLibrary,
                        colors = ButtonDefaults.filledTonalButtonColors(containerColor = TealBg, contentColor = Teal),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                    ) {
                        Text("📋 ספרייה / שכפול", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // ── רצועת-"מהיר" — אריחי-ענק בהקשה-אחת (מוסתרת בזמן חיפוש) ──────
            if (!searching && quick.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("מהיר", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Orange)
                    Spacer(Modifier.width(8.dp))
                    Text("הקשה = בחירה · לחיצה-ארוכה = ★", fontSize = 11.sp, color = Muted)
                }
                Spacer(Modifier.height(8.dp))
                QuickGrid(
                    items = quick,
                    favorites = favorites,
                    onPick = pick,
                    onLongPress = { RecentElementsStore.toggleFavorite(it.key) },
                )
                Spacer(Modifier.height(16.dp))
                HorizontalDivider(color = Muted.copy(alpha = 0.2f))
            }

            // ── חיפוש (משני) ───────────────────────────────────────────────
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("חיפוש בכל הקטלוג…", color = Muted) },
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

            // ── קטלוג-מלא (גלילה) ─────────────────────────────────────────
            if (groups.isEmpty()) {
                Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                    Text("לא נמצאו פריטים", color = Muted, fontSize = 15.sp)
                }
            } else {
                LazyColumn(Modifier.fillMaxWidth().heightIn(max = 440.dp)) {
                    groups.forEach { (group, items) ->
                        item(key = "h_$group") { GroupHeader(group, items.size) }
                        items(items, key = { it.key }) { def ->
                            ElementRow(
                                def = def,
                                isFavorite = favorites.contains(def.key),
                                onClick = { pick(def) },
                                onToggleFavorite = { RecentElementsStore.toggleFavorite(def.key) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/** רשת-אריחים לרצועת-"מהיר": [TILES_PER_ROW] אריחים בשורה, בהקשה-אחת. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun QuickGrid(
    items: List<ElementDef>,
    favorites: Set<String>,
    onPick: (ElementDef) -> Unit,
    onLongPress: (ElementDef) -> Unit,
) {
    Column(Modifier.fillMaxWidth()) {
        items.chunked(TILES_PER_ROW).forEach { rowItems ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                rowItems.forEach { def ->
                    Box(Modifier.weight(1f)) {
                        QuickTile(
                            def = def,
                            isFavorite = favorites.contains(def.key),
                            onClick = { onPick(def) },
                            onLongPress = { onLongPress(def) },
                        )
                    }
                }
                // ריפוד לתאים חסרים בשורה האחרונה, כדי לשמור על רוחב אחיד.
                repeat(TILES_PER_ROW - rowItems.size) { Spacer(Modifier.weight(1f)) }
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

/** אריח-ענק בודד (≥72dp) — אמוג'י + תווית-קצרה. הקשה=בחירה, לחיצה-ארוכה=★. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun QuickTile(
    def: ElementDef,
    isFavorite: Boolean,
    onClick: () -> Unit,
    onLongPress: () -> Unit,
) {
    val isCustom = CustomElementStore.isCustom(def.key)
    Box(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 76.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White)
            .border(
                width = if (isFavorite) 2.dp else 1.dp,
                color = if (isFavorite) Orange else Muted.copy(alpha = 0.25f),
                shape = RoundedCornerShape(14.dp),
            )
            .combinedClickable(onClick = onClick, onLongClick = onLongPress)
            .padding(horizontal = 6.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(emojiFor(def), fontSize = 26.sp)
            Spacer(Modifier.height(4.dp))
            Text(
                def.he,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = Ink,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 14.sp,
            )
        }
        // תגי-פינה: ★ מועדף / • אישי.
        if (isFavorite) {
            Text("★", fontSize = 13.sp, color = Orange, modifier = Modifier.align(Alignment.TopEnd))
        }
        if (isCustom) {
            Box(
                Modifier.align(Alignment.TopStart).size(8.dp).clip(CircleShape).background(OkGreen),
            )
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

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ElementRow(
    def: ElementDef,
    isFavorite: Boolean,
    onClick: () -> Unit,
    onToggleFavorite: () -> Unit,
) {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (isFavorite) OrangeBg else Color.White)
            .combinedClickable(onClick = onClick, onLongClick = onToggleFavorite),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(emojiFor(def), fontSize = 22.sp)
            Spacer(Modifier.width(12.dp))
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
            if (isFavorite) { Text("★", fontSize = 16.sp, color = Orange); Spacer(Modifier.width(6.dp)) }
            if (CustomElementStore.isCustom(def.key)) { Tag("אישי", OkGreen); Spacer(Modifier.width(6.dp)) }
            if (def.round) Tag("עגול", Orange)
        }
    }
}

@Composable
private fun Tag(text: String, color: Color = Orange) {
    Box(
        Modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.15f))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(text, fontSize = 11.sp, color = color, fontWeight = FontWeight.SemiBold)
    }
}

/**
 * אמוג'י-מזהה מהיר לאלמנט — קודם לפי מפתח-מדויק, ואז נפילה-חיננית לפי קבוצה.
 * מטרתו זיהוי-מבט בשטח (חד-ידני, מהיר), לא דיוק-גרפי.
 */
private fun emojiFor(def: ElementDef): String = when (def.key) {
    "SOCKET_SINGLE" -> "🔌"
    "SOCKET_MULTI" -> "🔳"
    "SWITCH" -> "🎛️"
    "ELECTRICAL_WALL", "ELECTRICAL_LINE" -> "⚡"
    "ELECTRIC_APPLIANCE" -> "🔌"
    "CEILING_LIGHT" -> "💡"
    "WATER_PIPE", "WATER_PIPE_ROUND" -> "💧"
    "GAS_PIPE" -> "🔥"
    "FLOOR_DRAIN" -> "🕳️"
    "AC_UNIT", "CEILING_DROP_AC" -> "❄️"
    "REFRIGERATOR", "OK_FRIDGE" -> "🧊"
    "OVEN", "OK_PIZZA_OVEN" -> "🍞"
    "MICROWAVE" -> "🍲"
    "DISHWASHER" -> "🍽️"
    "WATER_BAR" -> "🚰"
    "BATH" -> "🛁"
    "TOILET" -> "🚽"
    "SINK", "OK_SINK" -> "🧼"
    "SHOWER" -> "🚿"
    "WINDOW", "WINDOW_CASEMENT", "WINDOW_KIP", "WINDOW_SLIDING", "WINDOW_HUNG",
    "WINDOW_MAMAD", "WINDOW_KITCHEN", "WINDOW_BATH", "WINDOW_TILT", "VITRINE" -> "🪟"
    "OPENING_FRAME", "PASSAGE",
    "DOOR_IN_LEFT", "DOOR_IN_RIGHT", "DOOR_OUT_LEFT", "DOOR_OUT_RIGHT",
    "DOOR_ENTRANCE", "DOOR_MAMAD", "DOOR_POCKET", "DOOR_SLIDING", "DOOR_PATIO", "DOOR_DOUBLE",
    "OPENING_TO_FLOOR" -> "🚪"
    "AC_INDOOR", "AC_CASSETTE", "AC_CONCEALED", "AC_CONDENSER", "AC_BRACKET",
    "AC_SLEEVE", "AC_WALL_BOX", "CONDENSATE_DRAIN", "AC_DIFFUSER" -> "❄️"
    "MAMAD_AIR_VALVE", "VENT_GRILLE", "WALL_LOUVER", "EXHAUST_FAN", "FRESH_AIR_INTAKE",
    "RANGE_HOOD_DUCT", "DRYER_VENT", "BOILER_FLUE", "CHIMNEY_FLUE", "SERVICE_HATCH", "HRV" -> "🌀"
    "CEILING_DROP" -> "🔻"
    "COLUMN", "COLUMN_ROUND" -> "🏛️"
    "PANEL" -> "🟫"
    "ROUND_OBJECT" -> "⭕"
    "NOTE", "NOTE_FACTORY" -> "📝"
    "OK_GRILL_BUILTIN", "OK_GRILL_CART", "OK_KAMADO", "OK_SMOKER" -> "🍖"
    "OK_FAUCET", "OK_GAS_TAP" -> "🚰"
    "STICHMASS" -> "📐"
    else -> when (def.group) {
        ElementGroup.ELECTRICAL -> "⚡"
        ElementGroup.PLUMBING -> "💧"
        ElementGroup.APPLIANCES -> "🔌"
        ElementGroup.SANITARY -> "🚿"
        ElementGroup.DOORS -> "🚪"
        ElementGroup.WINDOWS -> "🪟"
        ElementGroup.HVAC -> "❄️"
        ElementGroup.OPENINGS -> "🚪"
        ElementGroup.STRUCTURE -> "🧱"
        ElementGroup.OUTDOOR -> "🍖"
        ElementGroup.NOTES -> "📝"
        ElementGroup.MARKING -> "📐"
        else -> "▫️"
    }
}
