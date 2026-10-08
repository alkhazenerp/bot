package com.ibadalrahman.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Duration
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import kotlin.math.abs

/**
 * Reference values were cross-checked against the open-source "adhan" library
 * (batoulapps) and official timetables; a tolerance of one minute is allowed.
 */
class PrayerCalculatorTest {

    private data class Case(
        val name: String,
        val coordinates: Coordinates,
        val zone: String,
        val date: LocalDate,
        val method: CalculationMethod,
        val expected: List<String>,
    )

    private val cases = listOf(
        Case(
            "Makkah", Coordinates(21.4225, 39.8262), "Asia/Riyadh", LocalDate.of(2026, 3, 1),
            CalculationMethod.UMM_AL_QURA, listOf("05:25", "06:41", "12:33", "15:55", "18:25", "19:55"),
        ),
        Case(
            "Cairo", Coordinates(30.0444, 31.2357), "Africa/Cairo", LocalDate.of(2026, 6, 21),
            CalculationMethod.EGYPTIAN, listOf("04:08", "05:54", "12:58", "16:32", "19:59", "21:33"),
        ),
        Case(
            "Damascus", Coordinates(33.5138, 36.2765), "Asia/Damascus", LocalDate.of(2026, 12, 21),
            CalculationMethod.EGYPTIAN, listOf("05:58", "07:35", "12:34", "15:13", "17:31", "18:57"),
        ),
        Case(
            "Karachi", Coordinates(24.8607, 67.0011), "Asia/Karachi", LocalDate.of(2026, 9, 23),
            CalculationMethod.KARACHI, listOf("05:05", "06:21", "12:25", "15:50", "18:28", "19:43"),
        ),
        Case(
            "New York", Coordinates(40.7128, -74.0060), "America/New_York", LocalDate.of(2026, 4, 10),
            CalculationMethod.NORTH_AMERICA, listOf("05:06", "06:25", "12:58", "16:39", "19:30", "20:49"),
        ),
        Case(
            "Dubai", Coordinates(25.2048, 55.2708), "Asia/Dubai", LocalDate.of(2026, 8, 15),
            CalculationMethod.DUBAI, listOf("04:30", "05:50", "12:26", "15:55", "18:57", "20:16"),
        ),
    )

    @Test
    fun matchesReferenceTimetables() {
        for (case in cases) {
            val times = PrayerCalculator.compute(
                case.date, case.coordinates, ZoneId.of(case.zone), CalculationParameters(method = case.method),
            )
            Prayer.entries.forEachIndexed { i, prayer ->
                val actual = times.zoned(prayer).toLocalTime()
                val expected = LocalTime.parse(case.expected[i])
                val diff = abs(Duration.between(expected, actual).toMinutes())
                assertTrue("${case.name} $prayer expected $expected but was $actual", diff <= 1)
            }
        }
    }

    @Test
    fun timesAreOrderedEverywhereAllYear() {
        val places = listOf(
            Coordinates(21.42, 39.83) to "Asia/Riyadh",
            Coordinates(59.91, 10.75) to "Europe/Oslo",
            Coordinates(64.15, -21.94) to "Atlantic/Reykjavik",
            Coordinates(-33.87, 151.21) to "Australia/Sydney",
            Coordinates(1.87, -157.43) to "Pacific/Kiritimati",
            Coordinates(69.65, 18.96) to "Europe/Oslo", // Tromsø: midnight sun and polar night
        )
        for ((coordinates, zoneId) in places) {
            for (method in CalculationMethod.entries) {
                var date = LocalDate.of(2026, 1, 1)
                while (date.year == 2026) {
                    val t = PrayerCalculator.compute(date, coordinates, ZoneId.of(zoneId), CalculationParameters(method = method))
                    val list = Prayer.entries.map { t[it] }
                    assertTrue("$coordinates $method $date not ordered: ${list.map { t.zoned(Prayer.entries[list.indexOf(it)]) }}",
                        list.zipWithNext().all { (a, b) -> a < b })
                    assertEquals(date, t.zoned(Prayer.DHUHR).toLocalDate())
                    date = date.plusDays(7)
                }
            }
        }
    }

    @Test
    fun hanafiAsrIsLater() {
        val c = Coordinates(31.52, 74.36)
        val zone = ZoneId.of("Asia/Karachi")
        val date = LocalDate.of(2026, 5, 5)
        val shafi = PrayerCalculator.compute(date, c, zone, CalculationParameters(CalculationMethod.KARACHI))
        val hanafi = PrayerCalculator.compute(date, c, zone, CalculationParameters(CalculationMethod.KARACHI, madhab = Madhab.HANAFI))
        assertTrue(hanafi[Prayer.ASR] - shafi[Prayer.ASR] > 30 * 60_000L)
    }

    @Test
    fun userAdjustmentsShiftByExactMinutes() {
        val c = Coordinates(24.71, 46.68)
        val zone = ZoneId.of("Asia/Riyadh")
        val date = LocalDate.of(2026, 7, 7)
        val base = PrayerCalculator.compute(date, c, zone, CalculationParameters(CalculationMethod.UMM_AL_QURA))
        val adjusted = PrayerCalculator.compute(
            date, c, zone,
            CalculationParameters(CalculationMethod.UMM_AL_QURA, userAdjustments = mapOf(Prayer.FAJR to -3, Prayer.ISHA to 15)),
        )
        assertEquals(-3 * 60_000L, adjusted[Prayer.FAJR] - base[Prayer.FAJR])
        assertEquals(15 * 60_000L, adjusted[Prayer.ISHA] - base[Prayer.ISHA])
        assertEquals(base[Prayer.DHUHR], adjusted[Prayer.DHUHR])
    }

    @Test
    fun ummAlQuraRamadanIshaIsTwoHoursAfterMaghrib() {
        val c = Coordinates(21.4225, 39.8262)
        val zone = ZoneId.of("Asia/Riyadh")
        val ramadanDay = LocalDate.of(2026, 3, 1) // 12 Ramadan 1447
        val params = CalculationParameters(CalculationMethod.UMM_AL_QURA, ramadanIshaExtraMinutes = 30)
        val t = PrayerCalculator.compute(ramadanDay, c, zone, params)
        assertEquals(120 * 60_000L, t[Prayer.ISHA] - t[Prayer.MAGHRIB])
        val normal = PrayerCalculator.compute(LocalDate.of(2026, 5, 1), c, zone, params)
        assertEquals(90 * 60_000L, normal[Prayer.ISHA] - normal[Prayer.MAGHRIB])
    }

    @Test
    fun nightMarkersAreBetweenMaghribAndNextFajr() {
        val zone = ZoneId.of("Africa/Cairo")
        val date = LocalDate.of(2026, 10, 8)
        val c = Coordinates(30.0444, 31.2357)
        val today = PrayerCalculator.compute(date, c, zone, CalculationParameters(CalculationMethod.EGYPTIAN))
        val tomorrow = PrayerCalculator.compute(date.plusDays(1), c, zone, CalculationParameters(CalculationMethod.EGYPTIAN))
        assertTrue(today.middleOfNight in today[Prayer.ISHA]..tomorrow[Prayer.FAJR])
        assertTrue(today.lastThird in today.middleOfNight..tomorrow[Prayer.FAJR])
    }
}
