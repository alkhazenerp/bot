package com.ibadalrahman.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import com.ibadalrahman.app.R
import com.ibadalrahman.app.data.ThemeMode

val Gold = Color(0xFFE8C468)
val GoldDeep = Color(0xFFC9A227)
val Emerald = Color(0xFF0F6B4A)
val EmeraldDark = Color(0xFF0C4436)
val Night = Color(0xFF07161A)

val Tajawal = FontFamily(
    Font(R.font.tajawal_regular, FontWeight.Normal),
    Font(R.font.tajawal_medium, FontWeight.Medium),
    Font(R.font.tajawal_bold, FontWeight.Bold),
    Font(R.font.tajawal_extrabold, FontWeight.ExtraBold),
)

val Ruqaa = FontFamily(Font(R.font.aref_ruqaa_bold, FontWeight.Bold))

private val DarkColors = darkColorScheme(
    primary = Gold,
    onPrimary = Color(0xFF2A1F00),
    primaryContainer = Color(0xFF3A3010),
    onPrimaryContainer = Color(0xFFFFE7A3),
    secondary = Color(0xFF7FD1B0),
    onSecondary = Color(0xFF00382A),
    secondaryContainer = Color(0xFF15463A),
    onSecondaryContainer = Color(0xFFBFF0DB),
    tertiary = Color(0xFFF2A65A),
    background = Night,
    onBackground = Color(0xFFEAF2EF),
    surface = Color(0xFF0D2228),
    onSurface = Color(0xFFEAF2EF),
    surfaceVariant = Color(0xFF14303A),
    onSurfaceVariant = Color(0xFFB5C7C1),
    surfaceContainer = Color(0xFF102830),
    surfaceContainerHigh = Color(0xFF153139),
    surfaceContainerLow = Color(0xFF0C1F25),
    outline = Color(0xFF3D5A60),
    outlineVariant = Color(0xFF26414A),
    error = Color(0xFFFFB4AB),
)

private val LightColors = lightColorScheme(
    primary = Emerald,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCDEBDD),
    onPrimaryContainer = Color(0xFF00382A),
    secondary = Color(0xFF9C7A1C),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFF6E7B8),
    onSecondaryContainer = Color(0xFF3A2C00),
    tertiary = GoldDeep,
    background = Color(0xFFFBF8F1),
    onBackground = Color(0xFF13201C),
    surface = Color.White,
    onSurface = Color(0xFF13201C),
    surfaceVariant = Color(0xFFEEF3EF),
    onSurfaceVariant = Color(0xFF4D5D57),
    surfaceContainer = Color(0xFFF4F1E8),
    surfaceContainerHigh = Color(0xFFEFEBE0),
    surfaceContainerLow = Color(0xFFF8F5EE),
    outline = Color(0xFFC5D1CC),
    outlineVariant = Color(0xFFDDE5E1),
)

private fun typography(): Typography {
    val base = Typography()
    fun TextStyle.t() = copy(fontFamily = Tajawal)
    return Typography(
        displayLarge = base.displayLarge.t(),
        displayMedium = base.displayMedium.t(),
        displaySmall = base.displaySmall.t(),
        headlineLarge = base.headlineLarge.t(),
        headlineMedium = base.headlineMedium.t(),
        headlineSmall = base.headlineSmall.t(),
        titleLarge = base.titleLarge.t().copy(fontWeight = FontWeight.Bold),
        titleMedium = base.titleMedium.t().copy(fontWeight = FontWeight.Bold),
        titleSmall = base.titleSmall.t().copy(fontWeight = FontWeight.Medium),
        bodyLarge = base.bodyLarge.t(),
        bodyMedium = base.bodyMedium.t(),
        bodySmall = base.bodySmall.t(),
        labelLarge = base.labelLarge.t().copy(fontWeight = FontWeight.Bold),
        labelMedium = base.labelMedium.t(),
        labelSmall = base.labelSmall.t(),
    )
}

@Composable
fun isDark(mode: ThemeMode): Boolean = when (mode) {
    ThemeMode.SYSTEM -> isSystemInDarkTheme()
    ThemeMode.DARK -> true
    ThemeMode.LIGHT -> false
}

/** App theme. The whole UI is Arabic, so layout direction is forced to RTL. */
@Composable
fun IbadTheme(mode: ThemeMode, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isDark(mode)) DarkColors else LightColors,
        typography = typography(),
    ) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl, content = content)
    }
}
