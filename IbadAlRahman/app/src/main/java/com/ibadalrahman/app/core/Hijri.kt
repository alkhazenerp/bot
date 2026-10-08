package com.ibadalrahman.app.core

import java.time.DateTimeException
import java.time.LocalDate
import java.time.chrono.HijrahDate
import java.time.temporal.ChronoField

data class HijriDate(val year: Int, val month: Int, val day: Int) {
    val monthName: String get() = Hijri.monthNames[(month - 1).coerceIn(0, 11)]
}

object Hijri {
    val monthNames = listOf(
        "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
        "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
    )

    /** Umm Al-Qura date for [date], shifted by [adjustDays] to follow local moon sighting. */
    fun of(date: LocalDate, adjustDays: Int = 0): HijriDate {
        val d = date.plusDays(adjustDays.toLong())
        return try {
            val h = HijrahDate.from(d)
            HijriDate(h.get(ChronoField.YEAR), h.get(ChronoField.MONTH_OF_YEAR), h.get(ChronoField.DAY_OF_MONTH))
        } catch (_: DateTimeException) {
            tabular(d)
        }
    }

    fun isRamadan(date: LocalDate, adjustDays: Int = 0): Boolean = of(date, adjustDays).month == 9

    /** Arithmetical (tabular) Islamic calendar, used outside the Umm Al-Qura table range. */
    internal fun tabular(date: LocalDate): HijriDate {
        val jdn = date.toEpochDay() + 2440588L
        val l0 = jdn - 1948440L + 10632L
        val n = (l0 - 1) / 10631L
        val l1 = l0 - 10631L * n + 354L
        val j = ((10985L - l1) / 5316L) * ((50L * l1) / 17719L) + (l1 / 5670L) * ((43L * l1) / 15238L)
        val l2 = l1 - ((30L - j) / 15L) * ((17719L * j) / 50L) - (j / 16L) * ((15238L * j) / 43L) + 29L
        val month = (24L * l2) / 709L
        val day = l2 - (709L * month) / 24L
        val year = 30L * n + j - 30L
        return HijriDate(year.toInt(), month.toInt(), day.toInt())
    }
}
