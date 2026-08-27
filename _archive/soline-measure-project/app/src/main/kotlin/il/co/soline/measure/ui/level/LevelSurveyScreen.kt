package il.co.soline.measure.ui.level

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.data.LevelPointEntity
import il.co.soline.measure.data.LevelSurface
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.data.WallEntity
import il.co.soline.measure.ui.BlockRed
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.WarnAmber
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * מסך סקר-מישוריות לרצפה/תקרה — פשוט וקריא.
 *
 * הלייקה X6 מחשבת בעצמה את ההפרש בין הנקודות (פונקציה במכשיר). האפליקציה
 * **לא מחשבת כלום** — היא רק קולטת את הערך שהמכשיר שולח ומציגה אותו קריא ברשימה.
 * כל שורה = נקודה + הערך (מ"מ) כפי שהלייקה הציגה, בצבע לפי גודל-הסטייה.
 */
@Composable
fun LevelSurveyScreen(
    surface: String,
    walls: List<WallEntity>,
    points: List<LevelPointEntity>,
    onSetZero: (rawMm: Double) -> Unit,   // לא בשימוש — הלייקה מחשבת בעצמה
    onMeasure: (idx: Int, x: Double, y: Double, rawMm: Double, deviationMm: Double) -> Unit,
    onClear: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val isFloor = surface == LevelSurface.FLOOR
    val title = if (isFloor) "מדידת רצפה" else "מדידת תקרה"

    val ble = SolineApp.instance.ble
    val last by ble.lastReading.collectAsState()
    val connected by ble.connected.collectAsState()

    val measured = points.filter { !it.isZero }.sortedBy { it.idx }
    val nextIdx = measured.size

    // קליטה חד-פעמית מהקריאה הבאה של המכשיר
    var armed by remember { mutableStateOf(false) }
    var armedFrom by remember { mutableStateOf(Long.MAX_VALUE) }
    LaunchedEffect(last) {
        val r = last
        val raw = r?.distanceMm
        if (armed && r != null && raw != null && r.ts > armedFrom) {
            // הערך נשמר כמו-שהוא (הלייקה כבר חישבה את ההפרש) — אין חישוב שלנו
            onMeasure(nextIdx, 0.0, 0.0, raw, raw)
            armed = false
            armedFrom = Long.MAX_VALUE
        }
    }

    Column(modifier.fillMaxSize().background(Cream)) {
        // ── כותרת ──
        Row(Modifier.fillMaxWidth().background(Color.White).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
                val lastMm = last?.distanceMm
                Text(
                    buildString {
                        append(if (connected != null) "מחובר: $connected" else "מד-לייזר לא מחובר")
                        if (lastMm != null) append(" · קריאה: ${lastMm.roundToInt()} מ\"מ")
                    },
                    fontSize = 12.sp, color = if (connected != null) OkGreen else Muted,
                )
            }
        }

        // ── כפתור מדידה ──
        Button(
            onClick = { armed = true; armedFrom = last?.ts ?: 0L },
            colors = ButtonDefaults.buttonColors(containerColor = if (armed) Teal else Orange),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp).height(60.dp),
        ) {
            Text(
                if (armed) "📡 מדוד עכשיו במכשיר…" else "➕ מדוד נקודה (${nextIdx + 1})",
                fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White,
            )
        }

        // ── רשימת-מדידות גדולה וקריאה ──
        if (measured.isEmpty()) {
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                Text("אין מדידות עדיין.\nהקש \"מדוד נקודה\" וירֵה במכשיר.", color = Muted, fontSize = 16.sp)
            }
        } else {
            LazyColumn(
                Modifier.fillMaxWidth().weight(1f),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                itemsIndexed(measured, key = { _, p -> p.id }) { i, p ->
                    Card(
                        Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                    ) {
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                Modifier.size(40.dp).background(devColor(p.deviationMm).copy(alpha = 0.14f), RoundedCornerShape(10.dp)),
                                contentAlignment = Alignment.Center,
                            ) { Text("${i + 1}", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = devColor(p.deviationMm)) }
                            Spacer(Modifier.width(14.dp))
                            Text("נקודה ${i + 1}", fontSize = 17.sp, color = Ink, modifier = Modifier.weight(1f))
                            Text(
                                "${signed(p.deviationMm)} מ\"מ",
                                fontSize = 26.sp, fontWeight = FontWeight.Bold, color = devColor(p.deviationMm),
                            )
                        }
                    }
                }
            }
        }

        // ── תחתית: מונה + אפס ──
        Row(
            Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("סה\"כ $nextIdx נקודות", fontSize = 14.sp, color = Muted, modifier = Modifier.weight(1f))
            if (measured.isNotEmpty()) {
                TextButton(onClick = onClear) { Text("אפס הכל", color = BlockRed, fontWeight = FontWeight.Bold) }
            }
        }
    }
}

// ── עזרים ────────────────────────────────────────────────────────────────────
private fun signed(mm: Double): String {
    val r = mm.roundToInt()
    return if (r > 0) "+$r" else r.toString()
}

private fun devColor(mm: Double): Color = when {
    abs(mm) <= 3.0 -> OkGreen
    abs(mm) <= 10.0 -> WarnAmber
    else -> BlockRed
}
