package il.co.soline.measure.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import il.co.soline.measure.ui.Ink
import il.co.soline.measure.ui.Muted
import il.co.soline.measure.ui.OkGreen
import il.co.soline.measure.ui.Orange
import il.co.soline.measure.ui.Teal

/*
 * SolineComponents — ערכת רכיבי-UI אחידה ומלוטשת ל-Soline Measure.
 * RTL עברית · צבעי-מותג (Theme.kt) · רדיוסים אחידים · יעדי-מגע גדולים לשטח.
 * המטרה: להעלות את איכות כל האפליקציה ולהבטיח שפה-ויזואלית אחת בין המסכים.
 * כל הרכיבים עצמאיים ונשענים רק על טוקני-הצבע היציבים של il.co.soline.measure.ui.*.
 */

/** רדיוסים אחידים לכל הרכיבים — כרטיסים/כפתורים/צ'יפים. */
object SolineShape {
    val Card: Dp = 16.dp
    val Button: Dp = 14.dp
    val Pill: Dp = 50.dp
}

/** סגנון-כפתור: ראשי (מלא, כתום) או משני (מתאר). */
enum class SolineButtonStyle { PRIMARY, SECONDARY }

/**
 * כפתור-מותג אחיד. ראשי = מלא בצבע [accent]; משני = מתאר באותו צבע.
 * יעד-מגע ≥52dp, פינות אחידות, טקסט מודגש — מתאים גם לשטח.
 */
@Composable
fun SolineButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: SolineButtonStyle = SolineButtonStyle.PRIMARY,
    icon: ImageVector? = null,
    accent: Color = Orange,
    enabled: Boolean = true,
) {
    val shape = RoundedCornerShape(SolineShape.Button)
    if (style == SolineButtonStyle.PRIMARY) {
        Button(
            onClick = onClick,
            enabled = enabled,
            modifier = modifier.heightIn(min = 52.dp),
            shape = shape,
            colors = ButtonDefaults.buttonColors(containerColor = accent, contentColor = Color.White),
        ) { ButtonContent(text, icon, Color.White) }
    } else {
        OutlinedButton(
            onClick = onClick,
            enabled = enabled,
            modifier = modifier.heightIn(min = 52.dp),
            shape = shape,
            border = BorderStroke(1.dp, accent.copy(alpha = 0.45f)),
        ) { ButtonContent(text, icon, accent) }
    }
}

@Composable
private fun ButtonContent(text: String, icon: ImageVector?, tint: Color) {
    if (icon != null) {
        Icon(icon, contentDescription = null, tint = tint)
        Spacer(Modifier.width(8.dp))
    }
    Text(text, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = tint)
}

/**
 * כפתור-פעולה גדול לשטח: יעד-מגע ≥56dp לעבודה ביד-אחת עם כפפות.
 * צבע-רקע [container] מלא; מתעמעם כשמנוטרל.
 */
@Composable
fun BigActionButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    container: Color = Orange,
    enabled: Boolean = true,
    // fontSize/contentPadding אופציונליים כדי שרכיבים מקומיים (FieldButton, StepBtn)
    // יוכלו להסב אליו בלי לשנות את מראם הצפוף — BigActionButton = מימוש-הכפתור היחיד.
    fontSize: TextUnit = 18.sp,
    contentPadding: PaddingValues = ButtonDefaults.ContentPadding,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.heightIn(min = 56.dp),
        shape = RoundedCornerShape(SolineShape.Button),
        contentPadding = contentPadding,
        colors = ButtonDefaults.buttonColors(
            containerColor = container,
            contentColor = Color.White,
            disabledContainerColor = Muted.copy(alpha = 0.25f),
            disabledContentColor = Muted,
        ),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null)
            Spacer(Modifier.width(10.dp))
        }
        Text(text, fontSize = fontSize, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
    }
}

/**
 * כרטיס-מותג לבן אחיד עם מתאר עדין ופינות מעוגלות. אופציונלי-לחיץ ([onClick]).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SolineCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    border: Boolean = true,
    container: Color = Color.White,
    content: @Composable () -> Unit,
) {
    val shape = RoundedCornerShape(SolineShape.Card)
    val colors = CardDefaults.cardColors(containerColor = container)
    val stroke = if (border) BorderStroke(1.dp, Muted.copy(alpha = 0.14f)) else null
    if (onClick != null) {
        Card(onClick = onClick, modifier = modifier.fillMaxWidth(), shape = shape, colors = colors, border = stroke) {
            Box(Modifier.padding(16.dp)) { content() }
        }
    } else {
        Card(modifier = modifier.fillMaxWidth(), shape = shape, colors = colors, border = stroke) {
            Box(Modifier.padding(16.dp)) { content() }
        }
    }
}

/**
 * כותרת-מקטע אחידה: כותרת מודגשת + תג-ספירה כתום אופציונלי (badge).
 */
@Composable
fun SectionHeader(title: String, modifier: Modifier = Modifier, badge: String? = null) {
    Row(
        modifier.fillMaxWidth().padding(top = 8.dp, bottom = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.weight(1f))
        if (badge != null) {
            Surface(shape = RoundedCornerShape(SolineShape.Pill), color = Orange.copy(alpha = 0.12f)) {
                Text(
                    badge, fontSize = 12.sp, color = Orange, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
                )
            }
        }
    }
}

/**
 * סרגל-עליון אחיד (BrandHeader): כפתור-חזרה RTL-נכון ([Icons.AutoMirrored.Filled.ArrowBack]),
 * כותרת + תת-כותרת אופציונלית, ותוכן-נגרר אופציונלי (למשל חיווי-לייזר). מחליף את
 * ה"‹"/"→ חזרה" המפוזרים ומבטיח אפורדנס-חזרה אחד בכל המסכים.
 *
 * @param container רקע-הסרגל (לבן כברירת-מחדל · אפשר Teal לסרגל-מלא).
 * @param contentColor צבע-האייקון והכותרת (Ink על-לבן · Color.White על-Teal).
 * @param trailing רכיב-נגרר בקצה (חיווי/תג) — אופציונלי.
 */
@Composable
fun BrandHeader(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    container: Color = Color.White,
    contentColor: Color = Ink,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier.fillMaxWidth().background(container).padding(horizontal = 8.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "חזרה", tint = contentColor)
        }
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = contentColor)
            if (subtitle != null) {
                Text(
                    subtitle, fontSize = 12.sp,
                    color = if (contentColor == Ink) Muted else contentColor.copy(alpha = 0.85f),
                )
            }
        }
        if (trailing != null) {
            Spacer(Modifier.width(8.dp))
            trailing()
        }
    }
}

/**
 * מצב-ריק אחיד (empty-state): אייקון-אמוג'י גדול, כותרת, הסבר, וכפתור-פעולה אופציונלי.
 * מוציא את המשתמש מ"מסך ריק" אל הצעד-הבא הברור.
 */
@Composable
fun EmptyState(
    emoji: String,
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
    actionText: String? = null,
    onAction: (() -> Unit)? = null,
) {
    SolineCard(modifier = modifier, onClick = if (actionText == null) onAction else null) {
        Column(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(emoji, fontSize = 30.sp)
            Spacer(Modifier.height(8.dp))
            Text(title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ink, textAlign = TextAlign.Center)
            Text(
                subtitle, fontSize = 12.sp, color = Muted, textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp),
            )
            if (actionText != null && onAction != null) {
                Spacer(Modifier.height(14.dp))
                SolineButton(actionText, onAction, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

/**
 * צ'יפ-נתון קומפקטי: ערך מודגש + תווית קטנה, בצבע [color]. לתצוגת מדדים/סטטוסים.
 */
@Composable
fun StatChip(value: String, label: String, modifier: Modifier = Modifier, color: Color = Teal) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(SolineShape.Button),
        color = color.copy(alpha = 0.10f),
        border = BorderStroke(1.dp, color.copy(alpha = 0.22f)),
    ) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
            Text(value, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = color)
            Text(label, fontSize = 11.sp, color = Muted, modifier = Modifier.padding(top = 1.dp))
        }
    }
}

/**
 * גלולת-סטטוס-לייזר בולטת: נקודה ירוקה + שם-המכשיר כשמחובר, אפורה כשמנותק.
 * לחיצה מובילה למסך-המכשירים. חיווי-שטח קריטי — האם הלייזר מדבר עם האפליקציה.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LaserStatusPill(
    connectedName: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    val connected = connectedName != null
    val dot = if (connected) OkGreen else Muted
    val bg = if (connected) OkGreen.copy(alpha = 0.10f) else Color(0xFFF0F0F0)
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(SolineShape.Pill),
        color = bg,
        border = BorderStroke(1.dp, dot.copy(alpha = 0.35f)),
    ) {
        Row(
            Modifier.padding(horizontal = if (compact) 12.dp else 14.dp, vertical = if (compact) 7.dp else 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("📶", fontSize = if (compact) 13.sp else 15.sp)
            Spacer(Modifier.width(if (compact) 6.dp else 8.dp))
            Box(Modifier.size(if (compact) 8.dp else 9.dp).clip(CircleShape).background(dot))
            Spacer(Modifier.width(if (compact) 6.dp else 8.dp))
            Column {
                if (!compact) {
                    Text(
                        if (connected) "לייזר מחובר" else "לייזר מנותק",
                        fontSize = 11.sp, color = Muted,
                    )
                }
                Text(
                    text = connectedName ?: "הקש לחיבור מכשיר",
                    fontSize = if (compact) 12.sp else 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (connected) Ink else Muted,
                    maxLines = 1,
                )
            }
        }
    }
}
