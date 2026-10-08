package com.ibadalrahman.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId

class HijriQiblaScheduleTest {

    @Test
    fun ummAlQuraDates() {
        assertEquals(HijriDate(1447, 9, 1), Hijri.of(LocalDate.of(2026, 2, 18)))
        assertEquals(HijriDate(1447, 10, 1), Hijri.of(LocalDate.of(2026, 3, 20)))
        assertEquals(HijriDate(1446, 9, 1), Hijri.of(LocalDate.of(2025, 3, 1)))
        assertEquals("رمضان", Hijri.of(LocalDate.of(2026, 2, 18)).monthName)
    }

    @Test
    fun hijriAdjustmentShiftsDays() {
        assertEquals(8, Hijri.of(LocalDate.of(2026, 2, 18), adjustDays = -1).month)
        assertEquals(HijriDate(1447, 9, 2), Hijri.of(LocalDate.of(2026, 2, 18), adjustDays = 1))
    }

    @Test
    fun tabularCalendarIsCloseToUmmAlQura() {
        var d = LocalDate.of(2020, 1, 1)
        while (d.year < 2030) {
            val a = Hijri.of(d)
            val b = Hijri.tabular(d)
            val monthsApart = (a.year * 12 + a.month) - (b.year * 12 + b.month)
            assertTrue("$d: $a vs $b", monthsApart in -1..1)
            d = d.plusDays(13)
        }
    }

    @Test
    fun qiblaBearings() {
        assertEquals(118.99, Qibla.bearing(Coordinates(51.5074, -0.1278)), 0.05)
        assertEquals(58.48, Qibla.bearing(Coordinates(40.7128, -74.0060)), 0.05)
        assertEquals(295.15, Qibla.bearing(Coordinates(-6.2088, 106.8456)), 0.05)
        assertEquals(136.14, Qibla.bearing(Coordinates(30.0444, 31.2357)), 0.05)
        assertEquals(1287.0, Qibla.distanceKm(Coordinates(30.0444, 31.2357)), 5.0)
    }

    @Test
    fun nextPrayerAfterIshaIsTomorrowsFajr() {
        val zone = ZoneId.of("Asia/Riyadh")
        val c = Coordinates(24.71, 46.68)
        val p = CalculationParameters(CalculationMethod.UMM_AL_QURA)
        val date = LocalDate.of(2026, 10, 8)
        val y = PrayerCalculator.compute(date.minusDays(1), c, zone, p)
        val t = PrayerCalculator.compute(date, c, zone, p)
        val n = PrayerCalculator.compute(date.plusDays(1), c, zone, p)

        val afterIsha = PrayerSchedule.status(t[Prayer.ISHA] + 60_000, y, t, n, includeSunrise = true)
        assertEquals(Prayer.FAJR, afterIsha.next.prayer)
        assertEquals(1, afterIsha.next.dayOffset)
        assertEquals(Prayer.ISHA, afterIsha.previous.prayer)

        val beforeFajr = PrayerSchedule.status(t[Prayer.FAJR] - 60_000, y, t, n, includeSunrise = false)
        assertEquals(Prayer.FAJR, beforeFajr.next.prayer)
        assertEquals(0, beforeFajr.next.dayOffset)
        assertEquals(-1, beforeFajr.previous.dayOffset)

        val afterFajr = PrayerSchedule.status(t[Prayer.FAJR] + 60_000, y, t, n, includeSunrise = false)
        assertEquals(Prayer.DHUHR, afterFajr.next.prayer)
        val withSunrise = PrayerSchedule.status(t[Prayer.FAJR] + 60_000, y, t, n, includeSunrise = true)
        assertEquals(Prayer.SUNRISE, withSunrise.next.prayer)

        val atDhuhr = PrayerSchedule.status(t[Prayer.DHUHR], y, t, n, includeSunrise = false)
        assertEquals(Prayer.ASR, atDhuhr.next.prayer)
        assertTrue(atDhuhr.progress(t[Prayer.DHUHR]) == 0f)
    }
}
