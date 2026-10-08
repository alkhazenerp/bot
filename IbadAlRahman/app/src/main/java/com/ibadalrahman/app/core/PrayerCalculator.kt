package com.ibadalrahman.app.core

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.atan
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.tan

data class Coordinates(val latitude: Double, val longitude: Double)

/** Prayer times of one local day, as epoch milliseconds rounded to the minute. */
class PrayerTimes internal constructor(
    val date: LocalDate,
    val zone: ZoneId,
    private val times: LongArray,
    /** Middle of the night (Maghrib → next Fajr). */
    val middleOfNight: Long,
    /** Start of the last third of the night (Maghrib → next Fajr). */
    val lastThird: Long,
) {
    operator fun get(prayer: Prayer): Long = times[prayer.ordinal]

    fun zoned(prayer: Prayer): ZonedDateTime = Instant.ofEpochMilli(get(prayer)).atZone(zone)

    /** Imsak is conventionally ten minutes before Fajr. */
    val imsak: Long get() = get(Prayer.FAJR) - 10 * MINUTE

    fun asList(includeSunrise: Boolean = true): List<Pair<Prayer, Long>> =
        Prayer.entries.filter { includeSunrise || it.isSalah }.map { it to get(it) }

    companion object {
        const val MINUTE = 60_000L
    }
}

object PrayerCalculator {

    private const val SUNRISE_ALTITUDE = -0.8333
    private const val MAX_POLAR_LATITUDE = 65.0

    fun compute(
        date: LocalDate,
        coordinates: Coordinates,
        zone: ZoneId,
        params: CalculationParameters,
    ): PrayerTimes {
        val raw = computeRaw(date, coordinates, zone, params)
        val next = computeRaw(date.plusDays(1), coordinates, zone, params)

        val maghrib = raw[Prayer.MAGHRIB.ordinal]
        val nextFajr = next[Prayer.FAJR.ordinal]
        val night = nextFajr - maghrib
        return PrayerTimes(
            date = date,
            zone = zone,
            times = raw,
            middleOfNight = roundToMinute(maghrib + night / 2),
            lastThird = roundToMinute(maghrib + night * 2 / 3),
        )
    }

    /** Raw (rounded, adjusted) times indexed by [Prayer.ordinal]. */
    private fun computeRaw(
        date: LocalDate,
        coordinates: Coordinates,
        zone: ZoneId,
        params: CalculationParameters,
    ): LongArray {
        val baseUtcDate = utcAnchorDate(date, coordinates.longitude, zone)
        val baseMillis = baseUtcDate.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        val jd0 = Astronomy.julianDay(baseUtcDate.year, baseUtcDate.monthValue, baseUtcDate.dayOfMonth)

        var lat = coordinates.latitude
        val lng = coordinates.longitude

        var sunrise = timeForAltitude(jd0, lat, lng, { SUNRISE_ALTITUDE }, rising = true)
        var sunset = timeForAltitude(jd0, lat, lng, { SUNRISE_ALTITUDE }, rising = false)
        if (sunrise.isNaN() || sunset.isNaN()) {
            // Midnight sun / polar night: fall back to the nearest latitude where the sun rises and sets.
            lat = lat.coerceIn(-MAX_POLAR_LATITUDE, MAX_POLAR_LATITUDE)
            sunrise = timeForAltitude(jd0, lat, lng, { SUNRISE_ALTITUDE }, rising = true)
            sunset = timeForAltitude(jd0, lat, lng, { SUNRISE_ALTITUDE }, rising = false)
        }
        val dhuhr = transit(jd0, lng)
        val shadow = params.madhab.shadowFactor
        // Asr: shadow = factor × object + the noon shadow, which depends on the declination at transit.
        val noonDeclination = Astronomy.solarPosition(jd0 + dhuhr / 1440.0).declination
        val asrAltitude = atan(1.0 / (shadow + tan(abs(lat - noonDeclination).toRadians()))).toDegrees()
        val asr = timeForAltitude(jd0, lat, lng, { asrAltitude }, rising = false)

        val maghrib = if (params.maghribAngle > 0) {
            timeForAltitude(jd0, lat, lng, { -params.maghribAngle }, rising = false).let {
                if (it.isNaN() || it < sunset) sunset else it
            }
        } else {
            sunset
        }

        val night = sunrise + 1440.0 - sunset

        var fajr = timeForAltitude(jd0, lat, lng, { -params.fajrAngle }, rising = true)
        val safeFajr = sunrise - night * nightPortion(params.highLatitudeRule, params.fajrAngle)
        if (fajr.isNaN() || fajr < safeFajr) fajr = safeFajr

        val isha: Double = if (params.ishaIntervalMinutes > 0) {
            val extra = if (params.ramadanIshaExtraMinutes != 0 && Hijri.isRamadan(date, params.hijriAdjustmentDays)) {
                params.ramadanIshaExtraMinutes
            } else {
                0
            }
            maghrib + params.ishaIntervalMinutes + extra
        } else {
            var t = timeForAltitude(jd0, lat, lng, { -params.ishaAngle }, rising = false)
            val safeIsha = sunset + night * nightPortion(params.highLatitudeRule, params.ishaAngle)
            if (t.isNaN() || t > safeIsha) t = safeIsha
            t
        }

        // Extreme latitudes can push an angle-based Maghrib past the night-portion Isha.
        val safeIshaAfterMaghrib = maxOf(isha, maghrib + 1.0)
        val minutes = doubleArrayOf(fajr, sunrise, dhuhr, asr, maghrib, safeIshaAfterMaghrib)
        return LongArray(Prayer.entries.size) { i ->
            val prayer = Prayer.entries[i]
            val m = minutes[i] + params.totalAdjustment(prayer)
            roundToMinute(baseMillis + (m * 60_000.0).toLong())
        }
    }

    /**
     * The UTC calendar date whose solar transit falls on the requested local [date].
     * Needed for zones whose offset is far from their longitude (e.g. near the date line).
     */
    private fun utcAnchorDate(date: LocalDate, longitude: Double, zone: ZoneId): LocalDate {
        val offsetMinutes = zone.rules.getOffset(date.atTime(12, 0).atZone(zone).toInstant()).totalSeconds / 60.0
        val localTransit = 720.0 - 4.0 * longitude + offsetMinutes
        return when {
            localTransit >= 1440.0 -> date.minusDays(1)
            localTransit < 0.0 -> date.plusDays(1)
            else -> date
        }
    }

    private fun nightPortion(rule: HighLatitudeRule, angle: Double): Double = when (rule) {
        HighLatitudeRule.MIDDLE_OF_NIGHT -> 1.0 / 2.0
        HighLatitudeRule.SEVENTH_OF_NIGHT -> 1.0 / 7.0
        HighLatitudeRule.TWILIGHT_ANGLE -> angle / 60.0
    }

    /** Solar transit in minutes after 00:00 UTC of the anchor day. */
    private fun transit(jd0: Double, longitude: Double): Double {
        var t = 720.0 - 4.0 * longitude
        repeat(3) {
            val sp = Astronomy.solarPosition(jd0 + t / 1440.0)
            t = 720.0 - 4.0 * longitude - sp.equationOfTime
        }
        return t
    }

    /**
     * Minutes after 00:00 UTC when the sun reaches [altitude] (degrees, a function of the
     * declination) before ([rising]) or after transit, or NaN if it never does.
     */
    private fun timeForAltitude(
        jd0: Double,
        latitude: Double,
        longitude: Double,
        altitude: (declination: Double) -> Double,
        rising: Boolean,
    ): Double {
        var t = 720.0 - 4.0 * longitude
        val latR = latitude.toRadians()
        repeat(4) {
            val sp = Astronomy.solarPosition(jd0 + t / 1440.0)
            val noon = 720.0 - 4.0 * longitude - sp.equationOfTime
            val decR = sp.declination.toRadians()
            val cosH = (sin(altitude(sp.declination).toRadians()) - sin(latR) * sin(decR)) / (cos(latR) * cos(decR))
            if (cosH < -1.0 || cosH > 1.0) return Double.NaN
            val hourAngle = acos(cosH).toDegrees()
            t = if (rising) noon - 4.0 * hourAngle else noon + 4.0 * hourAngle
        }
        return t
    }

    private fun roundToMinute(millis: Long): Long = Math.floorDiv(millis + 30_000L, 60_000L) * 60_000L
}
