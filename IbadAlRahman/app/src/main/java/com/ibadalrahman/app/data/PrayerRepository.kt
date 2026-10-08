package com.ibadalrahman.app.data

import android.content.Context
import com.ibadalrahman.app.core.CalculationParameters
import com.ibadalrahman.app.core.Coordinates
import com.ibadalrahman.app.core.Hijri
import com.ibadalrahman.app.core.HijriDate
import com.ibadalrahman.app.core.PrayerCalculator
import com.ibadalrahman.app.core.PrayerSchedule
import com.ibadalrahman.app.core.PrayerStatus
import com.ibadalrahman.app.core.PrayerTimes
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** Everything a screen, widget or notification needs to render "now". */
data class PrayerSnapshot(
    val now: Long,
    val zone: ZoneId,
    val date: LocalDate,
    val yesterday: PrayerTimes,
    val today: PrayerTimes,
    val tomorrow: PrayerTimes,
    val status: PrayerStatus,
    val hijri: HijriDate,
    val locationName: String,
) {
    /** Whether the upcoming prayer falls on a Friday (Dhuhr is then Jumu'ah). */
    val nextIsFriday: Boolean
        get() = date.plusDays(status.next.dayOffset.toLong()).dayOfWeek == DayOfWeek.FRIDAY

    val isFriday: Boolean get() = date.dayOfWeek == DayOfWeek.FRIDAY
}

object PrayerRepository {

    private data class Key(
        val date: LocalDate,
        val coordinates: Coordinates,
        val zone: ZoneId,
        val params: CalculationParameters,
    )

    private val cache = object : LinkedHashMap<Key, PrayerTimes>(16, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<Key, PrayerTimes>?) = size > 64
    }

    fun times(context: Context, date: LocalDate): PrayerTimes {
        val s = Settings.get(context)
        return times(date, s.coordinates(), s.zone(), s.calculationParameters())
    }

    fun times(date: LocalDate, coordinates: Coordinates, zone: ZoneId, params: CalculationParameters): PrayerTimes {
        val key = Key(date, coordinates, zone, params)
        synchronized(cache) { cache[key]?.let { return it } }
        val computed = PrayerCalculator.compute(date, coordinates, zone, params)
        synchronized(cache) { cache[key] = computed }
        return computed
    }

    fun snapshot(
        context: Context,
        now: Long = System.currentTimeMillis(),
        includeSunrise: Boolean = true,
    ): PrayerSnapshot {
        val s = Settings.get(context)
        val zone = s.zone()
        val coordinates = s.coordinates()
        val params = s.calculationParameters()
        val date = Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
        val yesterday = times(date.minusDays(1), coordinates, zone, params)
        val today = times(date, coordinates, zone, params)
        val tomorrow = times(date.plusDays(1), coordinates, zone, params)
        return PrayerSnapshot(
            now = now,
            zone = zone,
            date = date,
            yesterday = yesterday,
            today = today,
            tomorrow = tomorrow,
            status = PrayerSchedule.status(now, yesterday, today, tomorrow, includeSunrise),
            hijri = Hijri.of(date, s.hijriAdjustment),
            locationName = s.locationName,
        )
    }
}
