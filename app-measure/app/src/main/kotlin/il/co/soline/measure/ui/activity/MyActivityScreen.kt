package il.co.soline.measure.ui.activity

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import il.co.soline.measure.data.Prefs
import il.co.soline.measure.data.SolineApp
import il.co.soline.measure.data.WorkMetricEntity
import il.co.soline.measure.ops.metrics.MetricsComputer
import il.co.soline.measure.ui.Cream
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.components.BrandHeader
import il.co.soline.measure.ui.components.SolineCard
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * MyActivityScreen — "הפעילות שלי". שקיפות-למודד: המודד רואה את **הנתונים-שלו**
 * (מרחק/זמנים/מסלול היום) — לא רק "צד-המשרד". זה מה שהופך את השיתוף לשיתופי,
 * לא מעקב. הנתונים נקראים מ-work_metrics (אותו מקור-אמת של המשרד).
 */
@Composable
fun MyActivityScreen(
    onBack: () -> Unit,
    onManageSharing: () -> Unit,
    modifier: Modifier = Modifier,
) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        val repo = SolineApp.instance.repo
        val consentGiven by Prefs.locConsentGivenState
        val sharingActive by Prefs.locSharingActiveState

        val metrics by repo.workMetrics().collectAsStateWithLifecycle(emptyList())
        val todayEpoch = remember { MetricsComputer.dayEpochOf(System.currentTimeMillis()) }
        val today = metrics.firstOrNull { it.dayEpoch == todayEpoch }
        val recent = remember(metrics) { metrics.filter { it.dayEpoch != todayEpoch }.take(7) }

        Scaffold(containerColor = Cream, modifier = modifier) { pad ->
            Column(
                Modifier
                    .padding(pad)
                    .fillMaxSize()
            ) {
                BrandHeader("הפעילות שלי", onBack = onBack, subtitle = "הנתונים שלך · היום")

                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // ---- מצב-שיתוף ----
                    StatusBanner(consentGiven = consentGiven, sharingActive = sharingActive, onManage = onManageSharing)

                    if (!consentGiven) {
                        Text(
                            "שיתוף-המיקום כבוי. הפעל אותו כדי לראות כאן את מרחק-הנסיעה, " +
                                "זמני-העבודה והמסלול שלך.",
                            fontSize = 14.sp, color = Muted, lineHeight = 20.sp,
                        )
                    } else {
                        // ---- סיכום-היום ----
                        Text("סיכום היום", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Teal)
                        if (today == null || today.sampleCount == 0) {
                            SolineCard {
                                Text(
                                    "אין עדיין נתונים להיום. הנתונים מצטברים במהלך יום-העבודה " +
                                        "כשהשיתוף פעיל.",
                                    fontSize = 14.sp, color = Muted, lineHeight = 20.sp,
                                )
                            }
                        } else {
                            TodaySummary(today)
                        }

                        // ---- ימים אחרונים ----
                        if (recent.isNotEmpty()) {
                            Spacer(Modifier.height(2.dp))
                            Text("ימים אחרונים", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Teal)
                            for (m in recent) RecentDayRow(m)
                        }
                    }

                    Spacer(Modifier.height(8.dp))
                }
            }
        }
    }
}

@Composable
private fun StatusBanner(consentGiven: Boolean, sharingActive: Boolean, onManage: () -> Unit) {
    val on = consentGiven && sharingActive
    SolineCard(container = if (on) OkGreen.copy(alpha = 0.10f) else Color.White) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    if (on) "שיתוף-מיקום פעיל" else if (consentGiven) "שיתוף מושהה (מתג כבוי)" else "שיתוף כבוי",
                    fontSize = 16.sp, fontWeight = FontWeight.Bold, color = if (on) OkGreen else Ink,
                )
                Text(
                    if (on) "אתה שולט — אפשר לכבות בכל רגע" else "אפשר להפעיל דרך ההגדרות",
                    fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 2.dp),
                )
            }
            OutlinedButton(onClick = onManage) { Text("נהל") }
        }
    }
}

@Composable
private fun TodaySummary(m: WorkMetricEntity) {
    SolineCard {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Metric(value = fmtKm(m.km), label = "מרחק", color = Orange, modifier = Modifier.weight(1f))
                Cell()
                Metric(value = fmtDur(m.totalWorkMin), label = "זמן-עבודה", color = Teal, modifier = Modifier.weight(1f))
                Cell()
                Metric(value = "${m.sampleCount}", label = "נקודות-מסלול", color = Ink, modifier = Modifier.weight(1f))
            }
            HorizontalDivider(Modifier.padding(vertical = 14.dp), color = Cream)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Metric(value = fmtDur(m.travelMin), label = "נסיעה", color = Muted, modifier = Modifier.weight(1f))
                Cell()
                Metric(value = fmtDur(m.measureMin), label = "מדידה", color = Muted, modifier = Modifier.weight(1f))
                Cell()
                Metric(value = fmtSpan(m.firstActivityTs, m.lastActivityTs), label = "מ / עד", color = Muted, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun RecentDayRow(m: WorkMetricEntity) {
    SolineCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(fmtDate(m.dayEpoch), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Ink, modifier = Modifier.weight(1f))
            Text("${fmtKm(m.km)} · ${fmtDur(m.totalWorkMin)}", fontSize = 13.sp, color = Muted)
        }
    }
}

@Composable
private fun Metric(value: String, label: String, color: Color, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = color)
        Text(label, fontSize = 11.sp, color = Muted, modifier = Modifier.padding(top = 2.dp))
    }
}

@Composable
private fun Cell() {
    Box(Modifier.height(32.dp).width(1.dp).background(Cream))
}

// ── עזרי-פורמט ──────────────────────────────────────────────────────────────
private fun fmtKm(km: Double): String =
    if (km < 0.1) "0 ק\"מ" else "%.1f ק\"מ".format(km)

private fun fmtDur(min: Double): String {
    val total = min.toInt().coerceAtLeast(0)
    val h = total / 60
    val m = total % 60
    return if (h > 0) "${h}ש' ${m}ד'" else "${m}ד'"
}

private val TIME_FMT = DateTimeFormatter.ofPattern("HH:mm")
private fun fmtSpan(firstTs: Long, lastTs: Long): String {
    if (firstTs <= 0L || lastTs <= 0L) return "—"
    val z = ZoneId.systemDefault()
    val a = Instant.ofEpochMilli(firstTs).atZone(z).format(TIME_FMT)
    val b = Instant.ofEpochMilli(lastTs).atZone(z).format(TIME_FMT)
    return "$a–$b"
}

private fun fmtDate(dayEpoch: Long): String {
    val d = Instant.ofEpochMilli(dayEpoch).atZone(ZoneId.systemDefault()).toLocalDate()
    return "%02d.%02d".format(d.dayOfMonth, d.monthValue)
}
