package com.ibadalrahman.app.core

import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin
import kotlin.math.tan

/**
 * Low-precision solar ephemeris (Jean Meeus, "Astronomical Algorithms", ch. 25 and the
 * NOAA equation-of-time formulation). Accurate to a few seconds of time for prayer use.
 */
internal object Astronomy {

    class SolarPosition(
        /** Apparent declination, degrees. */
        val declination: Double,
        /** Equation of time, minutes (apparent - mean solar time). */
        val equationOfTime: Double,
    )

    fun julianDay(year: Int, month: Int, day: Int): Double {
        var y = year
        var m = month
        if (m <= 2) {
            y -= 1
            m += 12
        }
        val a = floor(y / 100.0)
        val b = 2 - a + floor(a / 4.0)
        return floor(365.25 * (y + 4716)) + floor(30.6001 * (m + 1)) + day + b - 1524.5
    }

    fun solarPosition(julianDay: Double): SolarPosition {
        val t = (julianDay - 2451545.0) / 36525.0
        val l0 = normalizeDegrees(280.46646 + t * (36000.76983 + 0.0003032 * t))
        val m = normalizeDegrees(357.52911 + t * (35999.05029 - 0.0001537 * t))
        val e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
        val mr = m.toRadians()
        val center = sin(mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
            sin(2 * mr) * (0.019993 - 0.000101 * t) +
            sin(3 * mr) * 0.000289
        val omega = (125.04 - 1934.136 * t).toRadians()
        val apparentLongitude = (l0 + center - 0.00569 - 0.00478 * sin(omega)).toRadians()
        val meanObliquity = 23.0 + (26.0 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60.0) / 60.0
        val obliquity = (meanObliquity + 0.00256 * cos(omega)).toRadians()

        val declination = asin(sin(obliquity) * sin(apparentLongitude)).toDegrees()

        val y = tan(obliquity / 2).let { it * it }
        val l0r = l0.toRadians()
        val eot = y * sin(2 * l0r) -
            2 * e * sin(mr) +
            4 * e * y * sin(mr) * cos(2 * l0r) -
            0.5 * y * y * sin(4 * l0r) -
            1.25 * e * e * sin(2 * mr)
        return SolarPosition(declination, 4.0 * eot.toDegrees())
    }
}

internal fun Double.toRadians(): Double = Math.toRadians(this)
internal fun Double.toDegrees(): Double = Math.toDegrees(this)

internal fun normalizeDegrees(value: Double): Double {
    val v = value % 360.0
    return if (v < 0) v + 360.0 else v
}
