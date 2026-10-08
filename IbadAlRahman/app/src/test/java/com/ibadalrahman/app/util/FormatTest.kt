package com.ibadalrahman.app.util

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneId

class FormatTest {
    private val zone = ZoneId.of("Asia/Riyadh")
    private val afternoon = LocalDateTime.of(2026, 10, 8, 15, 5).atZone(zone).toInstant().toEpochMilli()
    private val morning = LocalDateTime.of(2026, 10, 8, 0, 30).atZone(zone).toInstant().toEpochMilli()

    @Test
    fun twelveAndTwentyFourHour() {
        assertEquals("3:05 م", Format(arabicDigits = false, use24h = false).time(afternoon, zone))
        assertEquals("12:30 ص", Format(arabicDigits = false, use24h = false).time(morning, zone))
        assertEquals("15:05", Format(arabicDigits = false, use24h = true).time(afternoon, zone))
        assertEquals("3:05", Format(arabicDigits = false, use24h = false).time(afternoon, zone, withPeriod = false))
    }

    @Test
    fun arabicIndicDigits() {
        val f = Format(arabicDigits = true, use24h = true)
        assertEquals("١٥:٠٥", f.time(afternoon, zone))
        assertEquals("١٤٤٧", f.number(1447))
    }

    @Test
    fun countdowns() {
        val f = Format(arabicDigits = false, use24h = false)
        assertEquals("1:02:03", f.countdown((3600 + 120 + 3) * 1000L))
        assertEquals("05:00", f.countdown(300_000L))
        assertEquals("1:23", f.countdownShort((83 * 60) * 1000L))
        assertEquals("1", f.countdownShort(1_000L)) // rounds up to the next minute
    }

    @Test
    fun arabicPlurals() {
        val f = Format(arabicDigits = false, use24h = false)
        assertEquals("دقيقة", f.minutes(1))
        assertEquals("دقيقتان", f.minutes(2))
        assertEquals("5 دقائق", f.minutes(5))
        assertEquals("15 دقيقة", f.minutes(15))
        assertEquals("ساعتان و 10 دقائق", f.remainingWords((130 * 60) * 1000L))
    }
}
