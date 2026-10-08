package com.ibadalrahman.app.core

enum class Prayer {
    FAJR, SUNRISE, DHUHR, ASR, MAGHRIB, ISHA;

    /** Sunrise is a time marker, not a prayer with an adhan. */
    val isSalah: Boolean get() = this != SUNRISE

    companion object {
        val salawat = listOf(FAJR, DHUHR, ASR, MAGHRIB, ISHA)
    }
}

/** Shadow factor used for the Asr calculation. */
enum class Madhab(val shadowFactor: Double) {
    /** Shafi'i, Maliki, Hanbali (standard): shadow = object length. */
    SHAFI(1.0),

    /** Hanafi: shadow = twice the object length. */
    HANAFI(2.0),
}

/** How Fajr/Isha are bounded where twilight lasts all night (high latitudes). */
enum class HighLatitudeRule {
    MIDDLE_OF_NIGHT,
    SEVENTH_OF_NIGHT,
    TWILIGHT_ANGLE,
}

class MethodParams(
    val fajrAngle: Double,
    val ishaAngle: Double = 0.0,
    /** When > 0, Isha = Maghrib + this many minutes (angle is ignored). */
    val ishaIntervalMinutes: Int = 0,
    /** When > 0, Maghrib is computed by a depression angle instead of sunset. */
    val maghribAngle: Double = 0.0,
    /** Built-in minute offsets that the authority applies on top of the astronomy. */
    val adjustments: Map<Prayer, Int> = emptyMap(),
)

enum class CalculationMethod(val params: MethodParams) {
    UMM_AL_QURA(MethodParams(fajrAngle = 18.5, ishaIntervalMinutes = 90)),
    MUSLIM_WORLD_LEAGUE(MethodParams(18.0, 17.0, adjustments = mapOf(Prayer.DHUHR to 1))),
    EGYPTIAN(MethodParams(19.5, 17.5, adjustments = mapOf(Prayer.DHUHR to 1))),
    KARACHI(MethodParams(18.0, 18.0, adjustments = mapOf(Prayer.DHUHR to 1))),
    NORTH_AMERICA(MethodParams(15.0, 15.0, adjustments = mapOf(Prayer.DHUHR to 1))),
    DUBAI(
        MethodParams(
            18.2, 18.2,
            adjustments = mapOf(
                Prayer.SUNRISE to -3, Prayer.DHUHR to 3, Prayer.ASR to 3, Prayer.MAGHRIB to 3,
            ),
        ),
    ),
    KUWAIT(MethodParams(18.0, 17.5)),
    QATAR(MethodParams(fajrAngle = 18.0, ishaIntervalMinutes = 90)),
    GULF(MethodParams(fajrAngle = 19.5, ishaIntervalMinutes = 90)),
    JORDAN(MethodParams(18.0, 18.0)),
    ALGERIA(MethodParams(18.0, 17.0)),
    MOROCCO(MethodParams(19.0, 17.0)),
    TUNISIA(MethodParams(18.0, 18.0)),
    TURKEY(
        MethodParams(
            18.0, 17.0,
            adjustments = mapOf(
                Prayer.SUNRISE to -7, Prayer.DHUHR to 5, Prayer.ASR to 4, Prayer.MAGHRIB to 7,
            ),
        ),
    ),
    SINGAPORE(MethodParams(20.0, 18.0, adjustments = mapOf(Prayer.DHUHR to 1))),
    MALAYSIA_JAKIM(MethodParams(20.0, 18.0)),
    INDONESIA_KEMENAG(MethodParams(20.0, 18.0)),
    FRANCE_UOIF(MethodParams(12.0, 12.0)),
    RUSSIA(MethodParams(16.0, 15.0)),
    TEHRAN(MethodParams(17.7, 14.0, maghribAngle = 4.5)),
    JAFARI(MethodParams(16.0, 14.0, maghribAngle = 4.0)),
    CUSTOM(MethodParams(18.0, 17.0)),
    ;

    companion object {
        /** Sensible default authority for an ISO-3166 country code. */
        fun forCountry(countryCode: String?): CalculationMethod = when (countryCode?.uppercase()) {
            "SA" -> UMM_AL_QURA
            "AE" -> DUBAI
            "KW" -> KUWAIT
            "QA" -> QATAR
            "BH", "OM" -> GULF
            "JO" -> JORDAN
            "DZ" -> ALGERIA
            "MA", "EH" -> MOROCCO
            "TN" -> TUNISIA
            "TR" -> TURKEY
            "SG", "BN" -> SINGAPORE
            "MY" -> MALAYSIA_JAKIM
            "ID" -> INDONESIA_KEMENAG
            "IR" -> TEHRAN
            "RU" -> RUSSIA
            "US", "CA" -> NORTH_AMERICA
            "PK", "IN", "BD", "AF" -> KARACHI
            "EG", "SD", "LY", "SY", "LB", "IQ", "PS", "SO", "DJ", "KM", "MR" -> EGYPTIAN
            else -> MUSLIM_WORLD_LEAGUE
        }
    }
}

data class CalculationParameters(
    val method: CalculationMethod = CalculationMethod.MUSLIM_WORLD_LEAGUE,
    val fajrAngle: Double = method.params.fajrAngle,
    val ishaAngle: Double = method.params.ishaAngle,
    val ishaIntervalMinutes: Int = method.params.ishaIntervalMinutes,
    val maghribAngle: Double = method.params.maghribAngle,
    val madhab: Madhab = Madhab.SHAFI,
    val highLatitudeRule: HighLatitudeRule = HighLatitudeRule.MIDDLE_OF_NIGHT,
    val methodAdjustments: Map<Prayer, Int> = method.params.adjustments,
    /** Manual per-prayer corrections chosen by the user (minutes, may be negative). */
    val userAdjustments: Map<Prayer, Int> = emptyMap(),
    /** Extra minutes for interval-based Isha during Ramadan (Umm Al-Qura uses +30). */
    val ramadanIshaExtraMinutes: Int = 0,
    /** Days added to the Hijri calendar to match local moon sighting. */
    val hijriAdjustmentDays: Int = 0,
) {
    fun totalAdjustment(prayer: Prayer): Int =
        (methodAdjustments[prayer] ?: 0) + (userAdjustments[prayer] ?: 0)
}
