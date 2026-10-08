package com.ibadalrahman.app.core

import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

object Qibla {
    val KAABA = Coordinates(21.4225241, 39.8261818)
    private const val EARTH_RADIUS_KM = 6371.0088

    /** Initial great-circle bearing from [from] to the Kaaba, degrees clockwise from true north. */
    fun bearing(from: Coordinates): Double {
        val phi = from.latitude.toRadians()
        val kaabaPhi = KAABA.latitude.toRadians()
        val deltaLambda = (KAABA.longitude - from.longitude).toRadians()
        val y = sin(deltaLambda)
        val x = cos(phi) * tan(kaabaPhi) - sin(phi) * cos(deltaLambda)
        return normalizeDegrees(atan2(y, x).toDegrees())
    }

    fun distanceKm(from: Coordinates): Double {
        val p1 = from.latitude.toRadians()
        val p2 = KAABA.latitude.toRadians()
        val dp = p2 - p1
        val dl = (KAABA.longitude - from.longitude).toRadians()
        val a = sin(dp / 2) * sin(dp / 2) + cos(p1) * cos(p2) * sin(dl / 2) * sin(dl / 2)
        return 2 * EARTH_RADIUS_KM * asin(sqrt(a))
    }
}
