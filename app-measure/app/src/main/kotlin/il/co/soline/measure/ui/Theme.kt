package il.co.soline.measure.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/* =========================================================================
 * מותג Soline — טוקנים גלובליים של עיצוב (design tokens)
 * -------------------------------------------------------------------------
 * כלל ברזל: אין לשנות/למחוק שמות טוקנים קיימים — עשרות מסכים מייבאים אותם
 * לפי שם. מותר לכוונן ערכים (באותה משפחת גוון) ולהוסיף טוקנים חדשים בלבד.
 * ========================================================================= */

// --- זהות המותג (מהלוגו הרשמי) — הגוונים נשמרים ---
val Orange = Color(0xFFF49A1A)   // כתום מותג — צבע ראשי / CTA
val Teal = Color(0xFF1596A8)     // טורקיז מותג — צבע משני
val Cream = Color(0xFFFBF4E6)    // קרם — רקע ראשי חמים
val Ink = Color(0xFF2B2B2B)      // טקסט ראשי
val Muted = Color(0xFF6B7280)    // טקסט משני / רמזים

// --- מצבים (states) — נשמר דפוס ה־*Bg הקיים ---
val BlockRed = Color(0xFFE5484D)
val BlockRedBg = Color(0xFFFDECEC)
val WarnAmber = Color(0xFFC47A04)
val WarnAmberBg = Color(0xFFFDF3E0)
val OkGreen = Color(0xFF12805C)

/* =========================================================================
 * טוקנים חדשים (תוספת בלבד — שום שם קיים לא הוסר/שונה)
 * מסכים יכולים לאמץ אותם בהדרגה כדי לקבל שכבות, גבולות ומצבים עקביים.
 * ========================================================================= */

// --- וריאנטים של הכתום (לטקסט/מסגרת/לחיצה + מיכל בהיר נגיש) ---
val OrangeDark = Color(0xFFC9780A)   // כתום עמוק — טקסט/אייקון על רקע בהיר, מצב לחוץ
val OrangeLight = Color(0xFFF7B24E)  // כתום בהיר — הדגשות עדינות
val OrangeBg = Color(0xFFFDEFD8)     // מיכל/רקע כתום עדין (primaryContainer)
val OnOrangeBg = Color(0xFF7A4A00)   // טקסט נגיש על OrangeBg (ניגודיות ~7:1)

// --- וריאנטים של הטורקיז ---
val TealDark = Color(0xFF0E6E7C)     // טורקיז עמוק — טקסט/אייקון על רקע בהיר
val TealLight = Color(0xFF4FB5C4)    // טורקיז בהיר — הדגשות
val TealBg = Color(0xFFE1F1F3)       // מיכל/רקע טורקיז עדין (secondaryContainer)
val OnTealBg = Color(0xFF07434B)     // טקסט נגיש על TealBg

// --- מצב "תקין" (משלים את דפוס ה־*Bg) + מידע ---
val OkGreenBg = Color(0xFFE3F3EC)    // רקע ירוק עדין — הצלחה/אישור
val Info = Color(0xFF2563A8)         // כחול מידע — הודעות ניטרליות
val InfoBg = Color(0xFFE8F0FA)       // רקע כחול מידע עדין

// --- שכבות משטח, גבולות והבחנה (surface / border / elevation) ---
val Surface = Color(0xFFFFFFFF)       // כרטיסים / משטח מוגבה מעל הקרם
val SurfaceVariant = Color(0xFFF4EEDF) // משטח משני חמים — שכבה בין קרם ללבן
val SurfaceSunken = Color(0xFFF1E9D6)  // אזור "שקוע" — שדות/מגירות
val Border = Color(0xFFE7DFCC)        // גבול עדין חם (1dp) לכרטיסים/שדות
val BorderStrong = Color(0xFFD8CEB6)  // גבול מודגש יותר
val Divider = Color(0xFFEDE6D5)       // קווי הפרדה
val Scrim = Color(0x99000000)         // כיסוי מודאלי מאחורי דיאלוגים/שיטים

// --- וריאנטים של טקסט (היררכיה מדויקת יותר) ---
val InkSoft = Color(0xFF4A4A4A)       // טקסט משני חזק — בין Ink ל־Muted
val OnDark = Color(0xFFFFFFFF)        // טקסט על משטחים כהים/צבעוניים

/* =========================================================================
 * טיפוגרפיה — סולם היררכי אחיד (Material3 roles), ידידותי ל־RTL/עברית.
 * fontFamily ברירת־מחדל (מערכת) מרנדר עברית היטב; letterSpacing מאופס
 * בכותרות כדי לא לפגוע במראה העברי.
 * ========================================================================= */
private val Sans = FontFamily.Default

val SolineTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.Bold,
        fontSize = 40.sp, lineHeight = 48.sp, letterSpacing = 0.sp,
    ),
    displayMedium = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.Bold,
        fontSize = 32.sp, lineHeight = 40.sp, letterSpacing = 0.sp,
    ),
    displaySmall = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.Bold,
        fontSize = 28.sp, lineHeight = 36.sp, letterSpacing = 0.sp,
    ),
    headlineLarge = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.Bold,
        fontSize = 26.sp, lineHeight = 32.sp, letterSpacing = 0.sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.SemiBold,
        fontSize = 22.sp, lineHeight = 28.sp, letterSpacing = 0.sp,
    ),
    headlineSmall = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp, lineHeight = 26.sp, letterSpacing = 0.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp, lineHeight = 24.sp, letterSpacing = 0.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp, lineHeight = 22.sp, letterSpacing = 0.sp,
    ),
    titleSmall = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp, lineHeight = 20.sp, letterSpacing = 0.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.Normal,
        fontSize = 16.sp, lineHeight = 24.sp, letterSpacing = 0.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.Normal,
        fontSize = 14.sp, lineHeight = 20.sp, letterSpacing = 0.sp,
    ),
    bodySmall = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.Normal,
        fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp, lineHeight = 18.sp, letterSpacing = 0.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = Sans, fontWeight = FontWeight.Medium,
        fontSize = 11.sp, lineHeight = 14.sp, letterSpacing = 0.sp,
    ),
)

/* =========================================================================
 * צורות — רדיוסים עקביים. המסכים כיום מפזרים 4/10/12/14/16dp; הסולם הזה
 * מספק ברירת־מחדל אחידה לרכיבי Material (כרטיסים, כפתורים, שדות, שיטים).
 * ========================================================================= */
val SolineShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

/* =========================================================================
 * ערכת הצבעים של Material3 — כל רכיב שקורא MaterialTheme.colorScheme
 * נהנה מהמיפוי המלא הזה (primary=כתום, secondary=טורקיז וכו').
 * ========================================================================= */
private val SolineColorScheme = lightColorScheme(
    primary = Orange,
    onPrimary = OnDark,
    primaryContainer = OrangeBg,
    onPrimaryContainer = OnOrangeBg,

    secondary = Teal,
    onSecondary = OnDark,
    secondaryContainer = TealBg,
    onSecondaryContainer = OnTealBg,

    tertiary = OkGreen,
    onTertiary = OnDark,
    tertiaryContainer = OkGreenBg,
    onTertiaryContainer = Color(0xFF05432F),

    background = Cream,
    onBackground = Ink,

    surface = Surface,
    onSurface = Ink,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = InkSoft,

    outline = Border,
    outlineVariant = Divider,
    scrim = Scrim,

    error = BlockRed,
    onError = OnDark,
    errorContainer = BlockRedBg,
    onErrorContainer = Color(0xFF7A1518),
)

@Composable
fun SolineTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SolineColorScheme,
        typography = SolineTypography,
        shapes = SolineShapes,
        content = content,
    )
}
