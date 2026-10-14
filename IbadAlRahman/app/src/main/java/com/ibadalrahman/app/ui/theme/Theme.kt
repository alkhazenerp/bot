package com.ibadalrahman.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import com.ibadalrahman.app.R
import com.ibadalrahman.app.data.ThemeMode

// Andalusian identity palette.
val Teal = Color(0xFF0E4D47)
val Gold = Color(0xFFD4AF37)
val Turquoise = Color(0xFF6ED1C5)
val Royal = Color(0xFF4B3A7A)
val Cream = Color(0xFFF5E6C8)

val GoldLight = Color(0xFFF1CF63)
val GoldDeep = Color(0xFFA9801C)
val TealDeep = Color(0xFF082E2B)
val TealNight = Color(0xFF061A18)

// Kept for existing call sites.
val EmeraldDark = Teal
val Night = TealNight

/** Metallic gold used for the wordmark, dividers and highlights. */
val GoldGradient = Brush.verticalGradient(listOf(Color(0xFFFFF1B8), GoldLight, Gold, GoldDeep))

val Tajawal = FontFamily(
    Font(R.font.tajawal_regular, FontWeight.Normal),
    Font(R.font.tajawal_medium, FontWeight.Medium),
    Font(R.font.tajawal_bold, FontWeight.Bold),
    Font(R.font.tajawal_extrabold, FontWeight.ExtraBold),
)

/** Ruqaa calligraphy for the wordmark and Hijri dates. */
val Ruqaa = FontFamily(Font(R.font.aref_ruqaa_bold, FontWeight.Bold))

/** Ornate Nastaliq calligraphy for the dedication. */
val Nastaliq = FontFamily(Font(R.font.noto_nastaliq_urdu, FontWeight.Normal))

/** Extra brand colours that Material's scheme has no slot for. */
data class BrandColors(
    val gold: Color,
    val onGold: Color,
    val pattern: Color,
    val heroTop: Color,
    val heroBottom: Color,
    val isDark: Boolean,
)

val LocalBrand = staticCompositionLocalOf {
    BrandColors(Gold, Color(0xFF2A2000), Gold.copy(alpha = 0.12f), Teal, TealDeep, isDark = true)
}

private val DarkColors = darkColorScheme(
    primary = GoldLight,
    onPrimary = Color(0xFF2A2000),
    primaryContainer = Teal,
    onPrimaryContainer = Color(0xFFCFF5EF),
    secondary = Turquoise,
    onSecondary = Color(0xFF00332E),
    secondaryContainer = Color(0xFF134F49),
    onSecondaryContainer = Color(0xFFBFF3EC),
    tertiary = Color(0xFFB7A6EC),
    onTertiary = Color(0xFF1E1440),
    tertiaryContainer = Royal,
    onTertiaryContainer = Color(0xFFE8E0FF),
    background = TealNight,
    onBackground = Color(0xFFF2E9D6),
    surface = Color(0xFF0A2523),
    onSurface = Color(0xFFF2E9D6),
    surfaceVariant = Color(0xFF12403C),
    onSurfaceVariant = Color(0xFFA9C2BC),
    surfaceContainerLowest = Color(0xFF041311),
    surfaceContainerLow = Color(0xFF08201E),
    surfaceContainer = Color(0xFF0D2E2B),
    surfaceContainerHigh = Color(0xFF113834),
    surfaceContainerHighest = Color(0xFF16433E),
    outline = Color(0xFF3B6B65),
    outlineVariant = Color(0xFF1E4A45),
    error = Color(0xFFFFB4AB),
)

private val LightColors = lightColorScheme(
    primary = Teal,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCDEFEA),
    onPrimaryContainer = Teal,
    secondary = GoldDeep,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFF3E2B3),
    onSecondaryContainer = Color(0xFF3F2E00),
    tertiary = Royal,
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFE6E0F5),
    onTertiaryContainer = Color(0xFF221650),
    background = Color(0xFFFBF5E9),
    onBackground = Color(0xFF17302D),
    surface = Color(0xFFFFFBF3),
    onSurface = Color(0xFF17302D),
    surfaceVariant = Color(0xFFF1E6CF),
    onSurfaceVariant = Color(0xFF55625F),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFFAF2E2),
    surfaceContainer = Color(0xFFF6EBD5),
    surfaceContainerHigh = Color(0xFFF1E3C7),
    surfaceContainerHighest = Color(0xFFEBDCBC),
    outline = Color(0xFFD3C29C),
    outlineVariant = Color(0xFFE7D9BA),
)

private val DarkBrand = BrandColors(
    gold = GoldLight,
    onGold = Color(0xFF2A2000),
    pattern = Gold.copy(alpha = 0.10f),
    heroTop = Color(0xFF145C55),
    heroBottom = TealDeep,
    isDark = true,
)

private val LightBrand = BrandColors(
    gold = GoldDeep,
    onGold = Color.White,
    pattern = GoldDeep.copy(alpha = 0.12f),
    heroTop = Color(0xFF15665E),
    heroBottom = Teal,
    isDark = false,
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
        headlineSmall = base.headlineSmall.t().copy(fontWeight = FontWeight.Bold),
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
    val dark = isDark(mode)
    MaterialTheme(
        colorScheme = if (dark) DarkColors else LightColors,
        typography = typography(),
    ) {
        CompositionLocalProvider(
            LocalLayoutDirection provides LayoutDirection.Rtl,
            LocalBrand provides if (dark) DarkBrand else LightBrand,
            content = content,
        )
    }
}
