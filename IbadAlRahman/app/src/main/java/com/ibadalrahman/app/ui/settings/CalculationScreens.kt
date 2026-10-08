package com.ibadalrahman.app.ui.settings

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.ibadalrahman.app.core.CalculationMethod
import com.ibadalrahman.app.core.HighLatitudeRule
import com.ibadalrahman.app.core.Madhab
import com.ibadalrahman.app.core.Prayer
import com.ibadalrahman.app.data.PrayerRepository
import com.ibadalrahman.app.ui.Labels
import com.ibadalrahman.app.ui.components.ChoiceDialog
import com.ibadalrahman.app.ui.components.SectionCard
import com.ibadalrahman.app.ui.components.SettingItem
import com.ibadalrahman.app.ui.components.Stepper
import com.ibadalrahman.app.ui.components.SubPage
import com.ibadalrahman.app.ui.components.SwitchItem
import com.ibadalrahman.app.ui.components.rememberApplySettings
import com.ibadalrahman.app.ui.components.settings
import com.ibadalrahman.app.util.Format
import java.time.LocalDate
import java.util.Locale

@Composable
fun CalculationScreen(onBack: () -> Unit) {
    val s = settings()
    val apply = rememberApplySettings()
    val fmt = Format(s)
    var dialog by remember { mutableStateOf<String?>(null) }

    SubPage("طريقة الحساب", onBack) {
        SectionCard("الجهة المعتمدة") {
            SwitchItem(
                "اختيار الطريقة تلقائيًا حسب الدولة",
                "يُختار التقويم الرسمي المعتمد في بلدك",
                s.methodAuto,
            ) {
                s.methodAuto = it
                if (it) s.method = CalculationMethod.forCountry(s.countryCode)
                apply()
            }
            SettingItem("طريقة الحساب", "${Labels.method(s.method)}\n${Labels.methodDetails(s.method)}", onClick = { dialog = "method" })
        }

        if (s.method == CalculationMethod.CUSTOM) {
            SectionCard("الزوايا المخصصة") {
                SettingItem("زاوية الفجر", trailing = {
                    Stepper("${"%.1f".format(Locale.US, s.customFajrAngle)}°", onMinus = {
                        s.customFajrAngle = (s.customFajrAngle - 0.5).coerceAtLeast(10.0); apply()
                    }, onPlus = {
                        s.customFajrAngle = (s.customFajrAngle + 0.5).coerceAtMost(22.0); apply()
                    })
                })
                SettingItem("زاوية العشاء", if (s.customIshaInterval > 0) "غير مستخدمة لأن العشاء بعد المغرب بمدة ثابتة" else null, trailing = {
                    Stepper("${"%.1f".format(Locale.US, s.customIshaAngle)}°", onMinus = {
                        s.customIshaAngle = (s.customIshaAngle - 0.5).coerceAtLeast(10.0); apply()
                    }, onPlus = {
                        s.customIshaAngle = (s.customIshaAngle + 0.5).coerceAtMost(22.0); apply()
                    })
                })
                SettingItem("العشاء بعد المغرب بـ (دقيقة)", "صفر = استخدام الزاوية", trailing = {
                    Stepper(fmt.number(s.customIshaInterval), onMinus = {
                        s.customIshaInterval = (s.customIshaInterval - 5).coerceAtLeast(0); apply()
                    }, onPlus = {
                        s.customIshaInterval = (s.customIshaInterval + 5).coerceAtMost(150); apply()
                    })
                })
            }
        }

        SectionCard("الفقه والمناطق") {
            SettingItem("حساب العصر", Labels.madhab(s.madhab), onClick = { dialog = "madhab" })
            SettingItem("خطوط العرض العليا", Labels.highLatitude(s.highLatitudeRule), onClick = { dialog = "highlat" })
            if (s.method == CalculationMethod.UMM_AL_QURA) {
                SwitchItem(
                    "رمضان: العشاء بعد المغرب بساعتين",
                    "كما في تقويم أم القرى خلال شهر رمضان",
                    s.ramadanIshaExtra,
                ) { s.ramadanIshaExtra = it; apply() }
            }
        }

        SectionCard("التاريخ الهجري") {
            SettingItem(
                "تعديل التاريخ الهجري",
                "اليوم: ${fmt.hijri(com.ibadalrahman.app.core.Hijri.of(LocalDate.now(s.zone()), s.hijriAdjustment))}",
                trailing = {
                    Stepper(fmt.signed(s.hijriAdjustment), onMinus = {
                        s.hijriAdjustment = (s.hijriAdjustment - 1).coerceAtLeast(-2); apply()
                    }, onPlus = {
                        s.hijriAdjustment = (s.hijriAdjustment + 1).coerceAtMost(2); apply()
                    })
                },
            )
        }
    }

    when (dialog) {
        "method" -> ChoiceDialog(
            title = "طريقة الحساب",
            options = CalculationMethod.entries,
            selected = s.method,
            label = Labels::method,
            description = { Labels.methodDetails(it) },
            onSelect = {
                s.method = it
                s.methodAuto = false
                apply()
            },
            onDismiss = { dialog = null },
        )

        "madhab" -> ChoiceDialog(
            title = "حساب العصر",
            options = Madhab.entries,
            selected = s.madhab,
            label = Labels::madhab,
            description = { if (it == Madhab.SHAFI) "ظل الشيء مثله" else "ظل الشيء مثليه" },
            onSelect = { s.madhab = it; apply() },
            onDismiss = { dialog = null },
        )

        "highlat" -> ChoiceDialog(
            title = "خطوط العرض العليا",
            options = HighLatitudeRule.entries,
            selected = s.highLatitudeRule,
            label = Labels::highLatitude,
            description = { "تُستخدم عندما لا يغيب الشفق تمامًا (مثل شمال أوروبا صيفًا)" },
            onSelect = { s.highLatitudeRule = it; apply() },
            onDismiss = { dialog = null },
        )
    }
}

@Composable
fun AdjustmentsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val s = settings()
    val apply = rememberApplySettings()
    val fmt = Format(s)
    val today = LocalDate.now(s.zone())
    val adjusted = PrayerRepository.times(context, today)
    val raw = PrayerRepository.times(
        today, s.coordinates(), s.zone(),
        s.calculationParameters().copy(userAdjustments = emptyMap()),
    )

    SubPage("تعديل الأوقات يدويًا", onBack) {
        Text(
            "إذا كان مسجدك أو التقويم الرسمي في بلدك يختلف ببضع دقائق، قدّم أو أخّر كل صلاة هنا. " +
                "التعديل يُطبَّق على الأذان والتنبيهات والودجت وشريط الحالة.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        SectionCard {
            Prayer.entries.forEach { prayer ->
                val offset = s.offset(prayer)
                SettingItem(
                    Format.prayerName(prayer),
                    "المحسوب ${fmt.time(raw[prayer], raw.zone)} ← المعتمد ${fmt.time(adjusted[prayer], adjusted.zone)}",
                    trailing = {
                        Stepper(fmt.signed(offset), onMinus = {
                            s.setOffset(prayer, (offset - 1).coerceAtLeast(-90)); apply()
                        }, onPlus = {
                            s.setOffset(prayer, (offset + 1).coerceAtMost(90)); apply()
                        })
                    },
                )
            }
        }
        OutlinedButton(onClick = {
            Prayer.entries.forEach { s.setOffset(it, 0) }
            apply()
        }) { Text("إعادة ضبط جميع التعديلات") }
    }
}
