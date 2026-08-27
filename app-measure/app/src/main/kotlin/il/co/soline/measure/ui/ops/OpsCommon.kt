package il.co.soline.measure.ui.ops

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.data.JobStatus
import il.co.soline.measure.ui.Info
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

/*
 * OpsCommon — עזרים משותפים לצד-הניהול (בית-תפעולי · לו"ז · מדידות).
 * תאריך/שעה בעברית, בקטות-זמן (dayBucket), וצ'יפ-סטטוס-עבודה אחיד — כדי
 * ששלושת המסכים ידברו באותה שפה-ויזואלית ולא ישכפלו לוגיקת-תאריכים.
 */

// ── בקטות-זמן ל-scheduledAt (epoch millis; 0 = טרם-תוזמן) ─────────────────────
enum class DayBucket { UNSCHEDULED, OVERDUE, TODAY, UPCOMING }

private val zone: ZoneId get() = ZoneId.systemDefault()

fun localDateOf(millis: Long): LocalDate =
    Instant.ofEpochMilli(millis).atZone(zone).toLocalDate()

fun dayBucketOf(scheduledAt: Long, today: LocalDate = LocalDate.now()): DayBucket = when {
    scheduledAt <= 0L -> DayBucket.UNSCHEDULED
    else -> {
        val d = localDateOf(scheduledAt)
        when {
            d.isEqual(today) -> DayBucket.TODAY
            d.isBefore(today) -> DayBucket.OVERDUE
            else -> DayBucket.UPCOMING
        }
    }
}

fun isToday(scheduledAt: Long, today: LocalDate = LocalDate.now()): Boolean =
    scheduledAt > 0L && localDateOf(scheduledAt).isEqual(today)

// ── תצוגת-תאריך/שעה בעברית ────────────────────────────────────────────────────
private val HE_DAYS = arrayOf(
    "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון",
) // DayOfWeek.value: 1=Mon .. 7=Sun
private val HE_MONTHS = arrayOf(
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
)

/** יום-בשבוע מלא בעברית לתאריך (למשל "יום חמישי · 21 באוגוסט"). */
fun heDateLong(d: LocalDate): String =
    "יום ${HE_DAYS[d.dayOfWeek.value - 1]} · ${d.dayOfMonth} ב${HE_MONTHS[d.monthValue - 1]}"

/** תאריך קצר dd.MM (ריק כשלא-תוזמן). */
fun heDayMonth(millis: Long): String {
    if (millis <= 0L) return ""
    val d = localDateOf(millis)
    return "%02d.%02d".format(d.dayOfMonth, d.monthValue)
}

/** שעה HH:mm (ריק כשלא-תוזמן). */
fun heTime(millis: Long): String {
    if (millis <= 0L) return ""
    val t = LocalDateTime.ofInstant(Instant.ofEpochMilli(millis), zone)
    return "%02d:%02d".format(t.hour, t.minute)
}

/** יום-בשבוע קצר בעברית (למשל "חמישי"); ריק כשלא-תוזמן. */
fun heWeekdayShort(millis: Long): String {
    if (millis <= 0L) return ""
    return HE_DAYS[localDateOf(millis).dayOfWeek.value - 1]
}

// ── צבע-סטטוס אחיד ────────────────────────────────────────────────────────────
fun jobStatusColor(status: String): Color = when (status) {
    JobStatus.SCHEDULED -> Teal
    JobStatus.IN_FIELD -> Orange
    JobStatus.MEASURED -> OkGreen
    JobStatus.REVIEW -> Info
    JobStatus.DONE -> Muted
    else -> Muted
}

/** צ'יפ-סטטוס-עבודה אחיד לשלושת מסכי-הניהול. */
@Composable
fun JobStatusChip(status: String, modifier: Modifier = Modifier) {
    val color = jobStatusColor(status)
    Surface(shape = RoundedCornerShape(50), color = color.copy(alpha = 0.12f), modifier = modifier) {
        Text(
            JobStatus.he(status),
            fontSize = 12.sp, color = color, fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        )
    }
}
