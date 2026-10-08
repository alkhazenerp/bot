package com.ibadalrahman.app.ui

import com.ibadalrahman.app.core.CalculationMethod
import com.ibadalrahman.app.core.HighLatitudeRule
import com.ibadalrahman.app.core.Madhab
import com.ibadalrahman.app.data.AlertMode
import com.ibadalrahman.app.data.StatusStyle
import com.ibadalrahman.app.data.ThemeMode
import com.ibadalrahman.app.data.WidgetTheme

object Labels {
    fun method(m: CalculationMethod): String = when (m) {
        CalculationMethod.UMM_AL_QURA -> "أم القرى (مكة المكرمة)"
        CalculationMethod.MUSLIM_WORLD_LEAGUE -> "رابطة العالم الإسلامي"
        CalculationMethod.EGYPTIAN -> "الهيئة المصرية العامة للمساحة"
        CalculationMethod.KARACHI -> "جامعة العلوم الإسلامية بكراتشي"
        CalculationMethod.NORTH_AMERICA -> "الجمعية الإسلامية لأمريكا الشمالية"
        CalculationMethod.DUBAI -> "الإمارات (دبي)"
        CalculationMethod.KUWAIT -> "الكويت"
        CalculationMethod.QATAR -> "قطر"
        CalculationMethod.GULF -> "منطقة الخليج"
        CalculationMethod.JORDAN -> "وزارة الأوقاف الأردنية"
        CalculationMethod.ALGERIA -> "الجزائر"
        CalculationMethod.MOROCCO -> "المغرب"
        CalculationMethod.TUNISIA -> "تونس"
        CalculationMethod.TURKEY -> "رئاسة الشؤون الدينية التركية"
        CalculationMethod.SINGAPORE -> "سنغافورة"
        CalculationMethod.MALAYSIA_JAKIM -> "ماليزيا (JAKIM)"
        CalculationMethod.INDONESIA_KEMENAG -> "إندونيسيا (KEMENAG)"
        CalculationMethod.FRANCE_UOIF -> "اتحاد المنظمات الإسلامية في فرنسا"
        CalculationMethod.RUSSIA -> "الإدارة الدينية لمسلمي روسيا"
        CalculationMethod.TEHRAN -> "معهد الجيوفيزياء بطهران"
        CalculationMethod.JAFARI -> "الجعفري (مؤسسة ليفا – قم)"
        CalculationMethod.CUSTOM -> "مخصص (زوايا يدوية)"
    }

    fun methodDetails(m: CalculationMethod): String {
        val p = m.params
        val isha = if (p.ishaIntervalMinutes > 0) "العشاء بعد المغرب ${p.ishaIntervalMinutes} دقيقة" else "العشاء ${p.ishaAngle}°"
        return "الفجر ${p.fajrAngle}° • $isha"
    }

    fun madhab(m: Madhab): String = when (m) {
        Madhab.SHAFI -> "الجمهور (الشافعي والمالكي والحنبلي)"
        Madhab.HANAFI -> "الحنفي"
    }

    fun highLatitude(r: HighLatitudeRule): String = when (r) {
        HighLatitudeRule.MIDDLE_OF_NIGHT -> "منتصف الليل"
        HighLatitudeRule.SEVENTH_OF_NIGHT -> "سُبع الليل"
        HighLatitudeRule.TWILIGHT_ANGLE -> "زاوية الشفق"
    }

    fun alert(a: AlertMode): String = when (a) {
        AlertMode.ADHAN -> "أذان كامل"
        AlertMode.NOTIFICATION -> "إشعار بصوت تنبيه"
        AlertMode.SILENT -> "بدون تنبيه"
    }

    fun statusStyle(s: StatusStyle): String = when (s) {
        StatusStyle.NAME_COUNTDOWN -> "الوقت المتبقي + اسم الصلاة"
        StatusStyle.COUNTDOWN -> "الوقت المتبقي فقط"
        StatusStyle.NAME_TIME -> "وقت الصلاة القادمة + اسمها"
        StatusStyle.TIME -> "وقت الصلاة القادمة فقط"
    }

    fun theme(t: ThemeMode): String = when (t) {
        ThemeMode.SYSTEM -> "حسب النظام"
        ThemeMode.LIGHT -> "فاتح"
        ThemeMode.DARK -> "داكن"
    }

    fun widgetTheme(t: WidgetTheme): String = when (t) {
        WidgetTheme.NIGHT -> "ليلي"
        WidgetTheme.EMERALD -> "زمردي"
        WidgetTheme.GOLD -> "ذهبي"
        WidgetTheme.GLASS -> "زجاجي"
        WidgetTheme.LIGHT -> "فاتح"
    }
}
