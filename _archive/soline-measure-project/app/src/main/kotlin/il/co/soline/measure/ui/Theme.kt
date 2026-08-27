package il.co.soline.measure.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// מותג Soline (מהלוגו הרשמי)
val Orange = Color(0xFFF49A1A)
val Teal = Color(0xFF1596A8)
val Cream = Color(0xFFFBF4E6)
val Ink = Color(0xFF2B2B2B)
val Muted = Color(0xFF6B7280)
val BlockRed = Color(0xFFE5484D)
val BlockRedBg = Color(0xFFFDECEC)
val WarnAmber = Color(0xFFC47A04)
val WarnAmberBg = Color(0xFFFDF3E0)
val OkGreen = Color(0xFF12805C)

@Composable
fun SolineTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Orange,
            onPrimary = Color.White,
            secondary = Teal,
            background = Cream,
            surface = Color.White,
            onSurface = Ink,
            onBackground = Ink,
        ),
        content = content,
    )
}
