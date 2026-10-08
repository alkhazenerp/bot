package com.ibadalrahman.app.core

/** A prayer occurrence; [dayOffset] is -1 for yesterday, 0 for today, 1 for tomorrow. */
data class PrayerMoment(val prayer: Prayer, val time: Long, val dayOffset: Int)

data class PrayerStatus(val previous: PrayerMoment, val next: PrayerMoment) {
    fun remainingMillis(now: Long): Long = (next.time - now).coerceAtLeast(0)

    /** Fraction of the interval between the previous and the next prayer that has elapsed. */
    fun progress(now: Long): Float {
        val span = (next.time - previous.time).toDouble()
        if (span <= 0) return 0f
        return ((now - previous.time) / span).coerceIn(0.0, 1.0).toFloat()
    }
}

object PrayerSchedule {
    fun status(
        now: Long,
        yesterday: PrayerTimes,
        today: PrayerTimes,
        tomorrow: PrayerTimes,
        includeSunrise: Boolean,
    ): PrayerStatus {
        val moments = buildList {
            listOf(yesterday, today, tomorrow).forEachIndexed { index, day ->
                day.asList(includeSunrise).forEach { (prayer, time) -> add(PrayerMoment(prayer, time, index - 1)) }
            }
        }
        val nextIndex = moments.indexOfFirst { it.time > now }.let { if (it < 0) moments.lastIndex else it }
        val previousIndex = (nextIndex - 1).coerceAtLeast(0)
        return PrayerStatus(previous = moments[previousIndex], next = moments[nextIndex])
    }
}
