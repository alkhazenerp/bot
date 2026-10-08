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
    NIGHT(0xFF0B1B2B.toInt(), 0xFFFFFFFF.toInt(), 0xFFB8C4D0.toInt(), 0xFFE8C468.toInt(), false),
    EMERALD(0xFF0E3B2E.toInt(), 0xFFFFFFFF.toInt(), 0xFFCFE3D9.toInt(), 0xFFF2D27A.toInt(), false),
    GOLD(0xFF2A1F0B.toInt(), 0xFFFFF6E0.toInt(), 0xFFE3D3A8.toInt(), 0xFFF5C542.toInt(), false),
    GLASS(0xFF000000.toInt(), 0xFFFFFFFF.toInt(), 0xFFE6E6E6.toInt(), 0xFFFFD54F.toInt(), false),
    LIGHT(0xFFFFFFFF.toInt(), 0xFF1B1B1B.toInt(), 0xFF5F6B66.toInt(), 0xFF0F6B4A.toInt(), true),
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
