package il.co.soline.measure.ui.level

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
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
import il.co.soline.measure.geometry.FloorLevelSolver
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
 * מסך סקר-מישוריות לרצפה/תקרה — עם חישוב-גובה אמיתי (FloorLevelSolver).
 *
 * הזרימה (Michael): מתחנה-קבועה (חצובה) מודדים תחילה נקודת-ייחוס "0"; משם כל נקודה
 * מציגה את **הפרש-הגובה האמיתי** מ-0 (מ"מ, מסומן ±) — מחושב מהגאומטריה של הקרן:
 * הרכיב-האנכי Z = d·sin(θ) של המרחק-האלכסוני d והזווית-האנכית θ מה-Leica X6.
 *
 * · אחסון: ב-`rawMm` של כל נקודה נשמר ה-Z המחושב; ב-`deviationMm` הסטייה Z−zeroZ.
 *   נקודת-ה-0 (isZero) מחזיקה את zeroZ ב-`rawMm` שלה.
 * · סימן: deviation>0 = הנקודה גבוהה מ-0 (ברצפה: בליטה); deviation<0 = נמוכה (שקע).
 *   עקבי לרצפה ולתקרה כאחד. פרטים בכותרת FloorLevelSolver.
 * · אם קריאה חסרת-זווית (vAngleDeg=null) — נופלים חזרה למרחק כ-Z, ומסמנים בשורה.
 */
@Composable
fun LevelSurveyScreen(
    surface: String,
    walls: List<WallEntity>,
    points: List<LevelPointEntity>,
    onSetZero: (rawMm: Double) -> Unit,    // שומר את ה-Z המחושב של נקודת-ה-0
    onMeasure: (idx: Int, x: Double, y: Double, rawMm: Double, deviationMm: Double, noAngle: Boolean) -> Unit,
    onClear: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    onDeletePoint: (id: Long) -> Unit = {},  // מחיקת/undo נקודה-בודדת (A5) — לא רק "אפס הכל"
) {
    val isFloor = surface == LevelSurface.FLOOR
    val title = if (isFloor) "מדידת רצפה" else "מדידת תקרה"

    val ble = SolineApp.instance.ble
    val last by ble.lastReading.collectAsState()
    val connected by ble.connected.collectAsState()

    val zeroPoint = points.firstOrNull { it.isZero }
    val zeroZ = zeroPoint?.rawMm
    val hasZero = zeroPoint != null

    val measured = points.filter { !it.isZero }.sortedBy { it.idx }
    // idx-אחסון-יציב = מקסימום-idx-קיים +1 (לא count) — מחיקת-נקודה-אמצעית לא מתנגשת (A-fix).
    val nextIdx = (measured.maxOfOrNull { it.idx } ?: -1) + 1
    val pointCount = measured.size  // מספר-תצוגה בלבד (סדר-רץ), לא מזהה-אחסון

    // הודעת-שדה זמנית (דחיית-ירייה-ללא-זווית / ניתוק-מכשיר). נמחקת בזִיון-הבא.
    var flash by remember { mutableStateOf<String?>(null) }

    // ── קליטה חד-פעמית מהקריאה הבאה של המכשיר ──
    // armMode: null=לא מזוין · "ZERO"=קבע 0 · "POINT"=מדוד נקודה
    var armMode by remember { mutableStateOf<String?>(null) }
    var armedFrom by remember { mutableStateOf(Long.MAX_VALUE) }
    LaunchedEffect(last) {
        val r = last
        val d = r?.distanceMm
        if (armMode != null && r != null && d != null && r.ts > armedFrom) {
            val noAngle = r.vAngleDeg == null
            when (armMode) {
                // נקודת-0 ללא-זווית = datum-זבל שמזהם את **כל** ההפרשים → חוסמים לגמרי.
                "ZERO" -> if (noAngle) {
                    flash = "הירייה נקלטה ללא זווית-אנכית — לא ניתן לקבוע נקודת-0. כוון את המכשיר (זווית) וירֵה שוב."
                } else {
                    flash = null
                    onSetZero(FloorLevelSolver.heightZ(d, r.vAngleDeg))
                }
                "POINT" -> if (zeroZ != null) {
                    val z = FloorLevelSolver.heightZ(d, r.vAngleDeg)
                    val dev = FloorLevelSolver.deviation(z, zeroZ)
                    val h = FloorLevelSolver.horizontalDist(d, r.vAngleDeg)
                    if (noAngle) flash = "נקודה נקלטה ללא זווית-אנכית — הסטייה אינה-אמינה (מסומן בשורה)."
                    else flash = null
                    // הדגל נשמר על הרשומה (שורד-סיבוב) במקום זיכרון-מסך-זמני.
                    onMeasure(nextIdx, h, 0.0, z, dev, noAngle)
                }
            }
            armMode = null
            armedFrom = Long.MAX_VALUE
        }
    }

    // ניתוק-BLE בזמן-זִיון → מבטלים את הזִיון כדי שלא-ייקלט לתא-שגוי אחרי-חיבור-מחדש.
    LaunchedEffect(connected) {
        if (connected == null && armMode != null) {
            armMode = null
            armedFrom = Long.MAX_VALUE
            flash = "מכשיר נותק — ירייה בוטלה"
        }
    }

    Column(modifier.fillMaxSize().background(Cream)) {
        // ── כותרת + דיאגנוסטיקה חיה ──
        Row(Modifier.fillMaxWidth().background(Color.White).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "חזרה", tint = Ink) }
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text(
                    if (connected != null) "מחובר: $connected" else "מד-לייזר לא מחובר",
                    fontSize = 12.sp, color = if (connected != null) OkGreen else Muted,
                )
                // קריאה חיה: מרחק / זווית — כדי לראות את הקלט-הגולמי
                val d = last?.distanceMm
                val v = last?.vAngleDeg
                Text(
                    buildString {
                        append("קריאה: ")
                        append(if (d != null) "${d.roundToInt()} מ\"מ" else "—")
                        append(" / זווית: ")
                        append(if (v != null) "${fmt1(v)}°" else "ללא")
                    },
                    fontSize = 12.sp, color = Muted,
                )
            }
        }

        // ── מצב נקודת-0 ──
        Box(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)
                .background(if (hasZero) OkGreen.copy(alpha = 0.12f) else WarnAmber.copy(alpha = 0.14f), RoundedCornerShape(10.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Text(
                if (hasZero) "✓ נקודת-0 נקבעה (Z = ${zeroZ!!.roundToInt()} מ\"מ). כל נקודה מוצגת כהפרש מ-0."
                else "קבע תחילה נקודת-0 — היא הייחוס לכל ההפרשים.",
                fontSize = 13.sp, color = Ink,
            )
        }

        // ── הודעת-שדה (דחיית-ירייה-ללא-זווית / ניתוק) ──
        flash?.let { msg ->
            Box(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 2.dp)
                    .background(BlockRed.copy(alpha = 0.12f), RoundedCornerShape(10.dp))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            ) { Text("⚠️ $msg", fontSize = 13.sp, color = BlockRed, fontWeight = FontWeight.Medium) }
        }

        // ── כפתורים: קבע 0 · מדוד נקודה ──
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Button(
                onClick = { flash = null; armMode = "ZERO"; armedFrom = last?.ts ?: 0L },
                colors = ButtonDefaults.buttonColors(containerColor = if (armMode == "ZERO") Teal else Ink),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.weight(1f).height(58.dp),
            ) {
                Text(
                    if (armMode == "ZERO") "📡 ירֵה ל-0…" else if (hasZero) "↻ קבע 0 מחדש" else "🎯 קבע 0",
                    fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White,
                )
            }
            Button(
                onClick = { flash = null; armMode = "POINT"; armedFrom = last?.ts ?: 0L },
                enabled = hasZero,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (armMode == "POINT") Teal else Orange,
                    disabledContainerColor = Muted.copy(alpha = 0.4f),
                ),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.weight(1f).height(58.dp),
            ) {
                Text(
                    if (armMode == "POINT") "📡 מדוד עכשיו…" else "➕ מדוד נקודה (${pointCount + 1})",
                    fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White,
                )
            }
        }

        // ── רשימת-מדידות ──
        if (measured.isEmpty()) {
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                Text(
                    if (hasZero) "אין מדידות עדיין.\nהקש \"מדוד נקודה\" וירֵה במכשיר."
                    else "קבע נקודת-0, ואז מדוד נקודות.",
                    color = Muted, fontSize = 16.sp,
                )
            }
        } else {
            LazyColumn(
                Modifier.fillMaxWidth().weight(1f),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                itemsIndexed(measured, key = { _, p -> p.id }) { i, p ->
                    val noAngle = p.noAngle
                    Card(
                        Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                    ) {
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                Modifier.size(40.dp).background(devColor(p.deviationMm).copy(alpha = 0.14f), RoundedCornerShape(10.dp)),
                                contentAlignment = Alignment.Center,
                            ) { Text("${i + 1}", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = devColor(p.deviationMm)) }
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f)) {
                                Text("נקודה ${i + 1}", fontSize = 17.sp, color = Ink)
                                Text(
                                    buildString {
                                        append("Z ${p.rawMm.roundToInt()} מ\"מ")
                                        if (noAngle) append(" · ≈ ללא זווית")
                                    },
                                    fontSize = 12.sp, color = if (noAngle) WarnAmber else Muted,
                                )
                            }
                            Text(
                                "${signed(p.deviationMm)} מ\"מ",
                                fontSize = 26.sp, fontWeight = FontWeight.Bold, color = devColor(p.deviationMm),
                            )
                            // מחיקת-נקודה-בודדת (A5) — נקודה שנורתה בטעות, בלי "אפס הכל".
                            IconButton(onClick = { onDeletePoint(p.id) }) {
                                Icon(Icons.Default.Delete, "מחק נקודה", tint = BlockRed)
                            }
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
            Text("סה\"כ $pointCount נקודות", fontSize = 14.sp, color = Muted, modifier = Modifier.weight(1f))
            if (measured.isNotEmpty()) {
                // בטל-נקודה-אחרונה (A5) — undo נקודתי, לא הרסני כמו "אפס הכל".
                TextButton(onClick = { measured.lastOrNull()?.let { onDeletePoint(it.id) } }) {
                    Text("בטל אחרונה", color = Orange, fontWeight = FontWeight.Bold)
                }
            }
            if (measured.isNotEmpty() || hasZero) {
                TextButton(onClick = { flash = null; onClear() }) {
                    Text("אפס הכל", color = BlockRed, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ── עזרים ────────────────────────────────────────────────────────────────────
private fun signed(mm: Double): String {
    val r = mm.roundToInt()
    return if (r > 0) "+$r" else r.toString()
}

private fun fmt1(v: Double): String {
    val r = (v * 10).roundToInt() / 10.0
    return r.toString()
}

private fun devColor(mm: Double): Color = when {
    abs(mm) <= 3.0 -> OkGreen
    abs(mm) <= 10.0 -> WarnAmber
    else -> BlockRed
}
