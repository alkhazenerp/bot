package com.ibadalrahman.app.util

import com.ibadalrahman.app.core.HijriDate
import com.ibadalrahman.app.core.Prayer
import com.ibadalrahman.app.data.Settings
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale

/** Arabic text formatting that honours the user's digit and 12/24-hour preferences. */
class Format(private val arabicDigits: Boolean, private val use24h: Boolean) {

    constructor(settings: Settings) : this(settings.arabicDigits, settings.use24h)

    fun digits(text: String): String {
        if (!arabicDigits) return text
        val sb = StringBuilder(text.length)
        for (ch in text) sb.append(if (ch in '0'..'9') ('٠' + (ch - '0')) else ch)
        return sb.toString()
    }

    fun number(n: Int): String = digits(n.toString())

    /** "3:15 م" or "15:15". */
    fun time(millis: Long, zone: ZoneId, withPeriod: Boolean = true): String {
        val t = Instant.ofEpochMilli(millis).atZone(zone).toLocalTime()
        return if (use24h) {
            digits("%02d:%02d".format(Locale.US, t.hour, t.minute))
        } else {
            val h = if (t.hour % 12 == 0) 12 else t.hour % 12
            val base = digits("%d:%02d".format(Locale.US, h, t.minute))
            if (withPeriod) "$base ${if (t.hour < 12) "ص" else "م"}" else base
        }
    }

    /** Live countdown "1:23:45" / "23:45". */
    fun countdown(millis: Long): String {
        val total = (millis.coerceAtLeast(0) + 999) / 1000
        val h = total / 3600
        val m = (total % 3600) / 60
        val s = total % 60
        return digits(if (h > 0) "%d:%02d:%02d".format(Locale.US, h, m, s) else "%02d:%02d".format(Locale.US, m, s))
    }

    /** Minute-resolution countdown "1:23" (or "45" when under an hour), rounded up. */
    fun countdownShort(millis: Long): String {
        val totalMinutes = ((millis.coerceAtLeast(0) + 59_999) / 60_000)
        val h = totalMinutes / 60
        val m = totalMinutes % 60
        return digits(if (h > 0) "%d:%02d".format(Locale.US, h, m) else "$m")
    }

    /** Spoken-style remaining time, e.g. "ساعة و 5 دقائق". */
    fun remainingWords(millis: Long): String {
        val totalMinutes = ((millis.coerceAtLeast(0) + 59_999) / 60_000).toInt()
        val h = totalMinutes / 60
        val m = totalMinutes % 60
        val parts = buildList {
            if (h > 0) add(hours(h))
            if (m > 0 || h == 0) add(minutes(m))
        }
        return parts.joinToString(" و ")
    }

    fun minutes(m: Int): String = when {
        m == 1 -> "دقيقة"
        m == 2 -> "دقيقتان"
        m in 3..10 -> "${number(m)} دقائق"
        else -> "${number(m)} دقيقة"
    }

    fun hours(h: Int): String = when {
        h == 1 -> "ساعة"
        h == 2 -> "ساعتان"
        h in 3..10 -> "${number(h)} ساعات"
        else -> "${number(h)} ساعة"
    }

    fun hijri(h: HijriDate): String = "${number(h.day)} ${h.monthName} ${number(h.year)} هـ"

    fun gregorian(date: LocalDate, withWeekday: Boolean = true): String {
        val base = "${number(date.dayOfMonth)} ${gregorianMonths[date.monthValue - 1]} ${number(date.year)}"
        return if (withWeekday) "${weekday(date.dayOfWeek)}، $base" else base
    }

    fun signed(minutes: Int): String = when {
        minutes > 0 -> "+" + number(minutes)
        minutes < 0 -> "−" + number(-minutes)
        else -> number(0)
    }

    companion object {
        val gregorianMonths = listOf(
            "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
            "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
        )

        fun weekday(day: DayOfWeek): String = when (day) {
            DayOfWeek.SATURDAY -> "السبت"
            DayOfWeek.SUNDAY -> "الأحد"
            DayOfWeek.MONDAY -> "الاثنين"
            DayOfWeek.TUESDAY -> "الثلاثاء"
            DayOfWeek.WEDNESDAY -> "الأربعاء"
            DayOfWeek.THURSDAY -> "الخميس"
            DayOfWeek.FRIDAY -> "الجمعة"
        }

        /** Full name; Dhuhr becomes Jumu'ah on Fridays. */
        fun prayerName(prayer: Prayer, friday: Boolean = false): String = when (prayer) {
            Prayer.FAJR -> "الفجر"
            Prayer.SUNRISE -> "الشروق"
            Prayer.DHUHR -> if (friday) "الجمعة" else "الظهر"
            Prayer.ASR -> "العصر"
            Prayer.MAGHRIB -> "المغرب"
            Prayer.ISHA -> "العشاء"
        }

        /** Compact name for the status bar icon. */
        fun prayerShortName(prayer: Prayer, friday: Boolean = false): String = when (prayer) {
            Prayer.FAJR -> "فجر"
            Prayer.SUNRISE -> "شروق"
            Prayer.DHUHR -> if (friday) "جمعة" else "ظهر"
            Prayer.ASR -> "عصر"
            Prayer.MAGHRIB -> "مغرب"
            Prayer.ISHA -> "عشاء"
        }
    }
}
