package il.co.soline.measure.ui.close

import il.co.soline.measure.data.Prefs
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.geometry.WallCloseTools
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal
import il.co.soline.measure.ui.WarnAmber
import il.co.soline.measure.ui.WarnAmberBg
import kotlin.math.abs

/**
 * סרגל-פעולה קומפקטי לסגירת-היקף (Close-Auto / סגירה ידנית).
 *
 * מציג את מצב-הסגירה — סגור ✓ או פער-הסגירה במ"מ/מ' — ולצידו כפתורי-פעולה.
 * מיועד להיפרש בתחתית מסך-הציור ("סגור היקף" מפעיל [WallCloseTools.closeAuto];
 * "קיר סוגר" מפעיל [WallCloseTools.addClosingWall]).
 *
 * @param closure           תוצאת [WallCloseTools.closingReport] הנוכחית.
 * @param onCloseAuto       נקרא בלחיצה על "סגור היקף".
 * @param onAddClosingWall  נקרא בלחיצה על "קיר סוגר".
 * @param modifier          modifier חיצוני.
 */
@Composable
fun CloseToolsBar(
    closure: WallCloseTools.ClosureInfo,
    onCloseAuto: () -> Unit,
    onAddClosingWall: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val statusColor = if (closure.closed) OkGreen else WarnAmber
    val statusText = if (closure.closed) "סגור ✓" else "פער ${fmtMm(closure.gapMm)}"

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // מחוון-מצב
            Box(
                Modifier
                    .background(
                        if (closure.closed) OkGreen.copy(alpha = 0.14f) else WarnAmberBg,
                        RoundedCornerShape(50),
                    )
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            ) {
                Text(statusText, color = statusColor, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.width(4.dp))

            // סגירה אוטומטית (פעולה ראשית)
            Button(
                onClick = onCloseAuto,
                enabled = !closure.closed,
                colors = ButtonDefaults.buttonColors(containerColor = Orange, contentColor = Color.White),
                shape = RoundedCornerShape(10.dp),
            ) {
                Text("סגור היקף", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }

            // סגירה ידנית (חלופה)
            OutlinedButton(
                onClick = onAddClosingWall,
                enabled = !closure.closed,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Teal),
                shape = RoundedCornerShape(10.dp),
            ) {
                Text("קיר סוגר", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }

    // הרמז המילולי מוצג מתחת לסרגל (נגישות/בהירות)
    if (!closure.closed && closure.suggestion.isNotBlank()) {
        Text(
            closure.suggestion,
            color = Ink,
            fontSize = 12.sp,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp),
        )
    }
}

/** עיצוב-מרחק קריא בעברית (מ"מ / מ'). */
private fun fmtMm(mm: Double): String {
    val a = abs(mm)
    return if (a >= 1000.0) String.format("%.2f מ'", mm / 1000.0)
    else Prefs.formatLen(mm)
}
