package com.ibadalrahman.app.data

import android.content.Context

/** Colour palettes offered for home-screen widgets (ARGB without alpha for the background). */
enum class WidgetTheme(
    val background: Int,
    val text: Int,
    val secondary: Int,
    val accent: Int,
    val isLight: Boolean,
) {
    /** Brand deep teal with gold, the default. */
    ANDALUS(0xFF0E4D47.toInt(), 0xFFF5E6C8.toInt(), 0xFFA8DCD4.toInt(), 0xFFE3C35A.toInt(), false),
    NIGHT(0xFF061A18.toInt(), 0xFFFFFFFF.toInt(), 0xFF9FBDB7.toInt(), 0xFFE3C35A.toInt(), false),
    ROYAL(0xFF4B3A7A.toInt(), 0xFFF5E6C8.toInt(), 0xFFD3CAF0.toInt(), 0xFFF1CF63.toInt(), false),
    GLASS(0xFF000000.toInt(), 0xFFFFFFFF.toInt(), 0xFFE6E6E6.toInt(), 0xFF6ED1C5.toInt(), false),
    CREAM(0xFFF5E6C8.toInt(), 0xFF0E4D47.toInt(), 0xFF6B5B3E.toInt(), 0xFF9C7A1C.toInt(), true),
}

/** Per-widget appearance, keyed by appWidgetId; falls back to the app-wide defaults. */
class WidgetPrefs(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("widgets", Context.MODE_PRIVATE)
    private val settings = Settings.get(context)

    fun theme(id: Int): WidgetTheme =
        Settings.enumValue(prefs.getString("theme_$id", null), settings.widgetThemeDefault)

    /** Background opacity 0..100. */
    fun opacity(id: Int): Int = prefs.getInt("opacity_$id", settings.widgetOpacityDefault)

    fun save(id: Int, theme: WidgetTheme, opacity: Int) {
        prefs.edit().putString("theme_$id", theme.name).putInt("opacity_$id", opacity).apply()
    }

    fun delete(id: Int) {
        prefs.edit().remove("theme_$id").remove("opacity_$id").apply()
    }
}
