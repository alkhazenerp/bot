package com.ibadalrahman.app.data

import android.content.Context
import android.content.SharedPreferences
import com.ibadalrahman.app.core.CalculationMethod
import com.ibadalrahman.app.core.CalculationParameters
import com.ibadalrahman.app.core.Coordinates
import com.ibadalrahman.app.core.HighLatitudeRule
import com.ibadalrahman.app.core.Madhab
import com.ibadalrahman.app.core.Prayer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.time.DateTimeException
import java.time.ZoneId
import kotlin.properties.ReadWriteProperty
import kotlin.reflect.KProperty

enum class LocationMode { AUTO, MANUAL }

/** What happens when a prayer time arrives. */
enum class AlertMode { ADHAN, NOTIFICATION, SILENT }

/** What the status-bar icon shows next to the clock. */
enum class StatusStyle { NAME_COUNTDOWN, COUNTDOWN, NAME_TIME, TIME }

enum class ThemeMode { SYSTEM, LIGHT, DARK }

/**
 * All user preferences. Backed by SharedPreferences so that receivers, services and widgets can
 * read them synchronously; [version] lets Compose observe changes.
 */
class Settings private constructor(private val prefs: SharedPreferences) {

    private val _version = MutableStateFlow(0L)
    val version: StateFlow<Long> = _version

    // Held strongly: SharedPreferences only keeps a weak reference to listeners.
    private val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key !in volatileKeys) _version.value = _version.value + 1
    }

    init {
        prefs.registerOnSharedPreferenceChangeListener(listener)
    }

    // ---------------------------------------------------------------- general
    var onboardingDone by bool("onboarding_done", false)
    var themeMode by enum("theme_mode", ThemeMode.SYSTEM)
    var arabicDigits by bool("arabic_digits", false)
    var batteryHintDismissed by bool("battery_hint_dismissed", false)
    var adhanHintDismissed by bool("adhan_hint_dismissed", false)
    var use24h by bool("use_24h", false)

    // ---------------------------------------------------------------- location
    var locationMode by enum("location_mode", LocationMode.MANUAL)
    var latitude by double("latitude", 21.4225)
    var longitude by double("longitude", 39.8262)
    var locationName by string("location_name", "مكة المكرمة")
    var countryCode by string("country_code", "SA")
    var cityId by string("city_id", "SA:مكة المكرمة")
    /** Empty = follow the device time zone. */
    var zoneId by string("zone_id", "Asia/Riyadh")
    var locationUpdatedAt by long("location_updated_at", 0L)

    // ---------------------------------------------------------------- calculation
    var methodAuto by bool("method_auto", true)
    var method by enum("method", CalculationMethod.UMM_AL_QURA)
    var madhab by enum("madhab", Madhab.SHAFI)
    var highLatitudeRule by enum("high_lat_rule", HighLatitudeRule.MIDDLE_OF_NIGHT)
    var customFajrAngle by double("custom_fajr_angle", 18.0)
    var customIshaAngle by double("custom_isha_angle", 17.0)
    var customIshaInterval by int("custom_isha_interval", 0)
    var ramadanIshaExtra by bool("ramadan_isha_extra", true)
    var hijriAdjustment by int("hijri_adjustment", 0)

    fun offset(prayer: Prayer): Int = prefs.getInt("offset_${prayer.name}", 0)
    fun setOffset(prayer: Prayer, minutes: Int) = prefs.edit().putInt("offset_${prayer.name}", minutes).apply()

    // ---------------------------------------------------------------- adhan & alerts
    fun alertMode(prayer: Prayer): AlertMode = enumValue(
        prefs.getString("alert_${prayer.name}", null),
        if (prayer == Prayer.SUNRISE) AlertMode.SILENT else AlertMode.ADHAN,
    )

    fun setAlertMode(prayer: Prayer, mode: AlertMode) = prefs.edit().putString("alert_${prayer.name}", mode.name).apply()

    var adhanUri by string("adhan_uri", "")
    var adhanName by string("adhan_name", "")
    var fajrAdhanUri by string("fajr_adhan_uri", "")
    var fajrAdhanName by string("fajr_adhan_name", "")
    var adhanVolume by int("adhan_volume", 85)
    var adhanUseAlarmStream by bool("adhan_alarm_stream", true)
    var adhanStopOnScreenOff by bool("adhan_stop_screen_off", true)
    var adhanVibrate by bool("adhan_vibrate", true)
    var adhanShowDua by bool("adhan_show_dua", true)
    var useAlarmClock by bool("use_alarm_clock", false)

    var reminderEnabled by bool("reminder_enabled", true)
    var reminderMinutes by int("reminder_minutes", 10)
    fun reminderFor(prayer: Prayer): Boolean = prefs.getBoolean("reminder_${prayer.name}", prayer.isSalah)
    fun setReminderFor(prayer: Prayer, enabled: Boolean) = prefs.edit().putBoolean("reminder_${prayer.name}", enabled).apply()

    var iqamaEnabled by bool("iqama_enabled", false)
    fun iqamaMinutes(prayer: Prayer): Int = prefs.getInt("iqama_${prayer.name}", defaultIqama(prayer))
    fun setIqamaMinutes(prayer: Prayer, minutes: Int) = prefs.edit().putInt("iqama_${prayer.name}", minutes).apply()

    var silentEnabled by bool("silent_enabled", false)
    var silentDelayMinutes by int("silent_delay", 5)
    var silentDurationMinutes by int("silent_duration", 25)
    var kahfReminder by bool("kahf_reminder", true)

    // ---------------------------------------------------------------- status bar & widgets
    var statusBarEnabled by bool("status_bar_enabled", true)
    var statusStyle by enum("status_style", StatusStyle.NAME_COUNTDOWN)
    var statusIncludeSunrise by bool("status_include_sunrise", true)

    var widgetThemeDefault by enum("widget_theme_default", WidgetTheme.NIGHT)
    var widgetOpacityDefault by int("widget_opacity_default", 75)

    // ---------------------------------------------------------------- tasbih
    var tasbihCount by int("tasbih_count", 0)
    var tasbihTarget by int("tasbih_target", 33)
    var tasbihTotal by long("tasbih_total", 0L)
    var tasbihPhrase by int("tasbih_phrase", 0)

    // ---------------------------------------------------------------- internal state (not observed)
    var lastHandledEventAt by long("last_handled_event_at", 0L)
    var savedRingerMode by int("saved_ringer_mode", -1)
    var silentUntil by long("silent_until", 0L)

    // ---------------------------------------------------------------- derived values
    fun coordinates(): Coordinates = Coordinates(latitude, longitude)

    fun zone(): ZoneId {
        val id = zoneId
        if (id.isBlank() || locationMode == LocationMode.AUTO) return ZoneId.systemDefault()
        return try {
            ZoneId.of(id)
        } catch (_: DateTimeException) {
            ZoneId.systemDefault()
        }
    }

    fun calculationParameters(): CalculationParameters {
        val m = method
        val custom = m == CalculationMethod.CUSTOM
        return CalculationParameters(
            method = m,
            fajrAngle = if (custom) customFajrAngle else m.params.fajrAngle,
            ishaAngle = if (custom) customIshaAngle else m.params.ishaAngle,
            ishaIntervalMinutes = if (custom) customIshaInterval else m.params.ishaIntervalMinutes,
            madhab = madhab,
            highLatitudeRule = highLatitudeRule,
            userAdjustments = Prayer.entries.associateWith { offset(it) }.filterValues { it != 0 },
            ramadanIshaExtraMinutes = if (ramadanIshaExtra && m == CalculationMethod.UMM_AL_QURA) 30 else 0,
            hijriAdjustmentDays = hijriAdjustment,
        )
    }

    fun edit(block: SharedPreferences.Editor.() -> Unit) = prefs.edit().apply(block).apply()

    // ---------------------------------------------------------------- delegates
    private fun bool(key: String, def: Boolean) = object : ReadWriteProperty<Any?, Boolean> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = prefs.getBoolean(key, def)
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: Boolean) =
            prefs.edit().putBoolean(key, value).apply()
    }

    private fun int(key: String, def: Int) = object : ReadWriteProperty<Any?, Int> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = prefs.getInt(key, def)
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: Int) =
            prefs.edit().putInt(key, value).apply()
    }

    private fun long(key: String, def: Long) = object : ReadWriteProperty<Any?, Long> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = prefs.getLong(key, def)
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: Long) =
            prefs.edit().putLong(key, value).apply()
    }

    private fun double(key: String, def: Double) = object : ReadWriteProperty<Any?, Double> {
        override fun getValue(thisRef: Any?, property: KProperty<*>): Double =
            if (prefs.contains(key)) Double.fromBits(prefs.getLong(key, 0L)) else def

        override fun setValue(thisRef: Any?, property: KProperty<*>, value: Double) =
            prefs.edit().putLong(key, value.toRawBits()).apply()
    }

    private fun string(key: String, def: String) = object : ReadWriteProperty<Any?, String> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = prefs.getString(key, def) ?: def
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: String) =
            prefs.edit().putString(key, value).apply()
    }

    private inline fun <reified E : Enum<E>> enum(key: String, def: E) = object : ReadWriteProperty<Any?, E> {
        override fun getValue(thisRef: Any?, property: KProperty<*>): E = enumValue(prefs.getString(key, null), def)
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: E) =
            prefs.edit().putString(key, value.name).apply()
    }

    companion object {
        // Written often and never shown reactively: changing them must not recompose the UI.
        private val volatileKeys = setOf(
            "last_handled_event_at", "saved_ringer_mode", "silent_until",
            "tasbih_count", "tasbih_total", "tasbih_phrase", "tasbih_target",
        )

        @Volatile
        private var instance: Settings? = null

        fun get(context: Context): Settings = instance ?: synchronized(this) {
            instance ?: Settings(
                context.applicationContext.getSharedPreferences("settings", Context.MODE_PRIVATE),
            ).also { instance = it }
        }

        fun defaultIqama(prayer: Prayer): Int = when (prayer) {
            Prayer.FAJR -> 25
            Prayer.MAGHRIB -> 10
            else -> 20
        }

        inline fun <reified E : Enum<E>> enumValue(name: String?, def: E): E =
            name?.let { n -> enumValues<E>().firstOrNull { it.name == n } } ?: def
    }
}
