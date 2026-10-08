package com.ibadalrahman.app.ui.settings

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.ibadalrahman.app.R
import com.ibadalrahman.app.alarm.AdhanService
import com.ibadalrahman.app.core.Prayer
import com.ibadalrahman.app.data.AlertMode
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

@Composable
fun AdhanSettingsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val s = settings()
    val apply = rememberApplySettings()
    val fmt = Format(s)
    var modeDialogFor by remember { mutableStateOf<Prayer?>(null) }
    var volume by remember { mutableFloatStateOf(s.adhanVolume.toFloat()) }

    val pickAdhan = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            persist(context, uri)
            s.adhanUri = uri.toString()
            s.adhanName = displayName(context, uri)
        }
    }
    val pickFajr = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            persist(context, uri)
            s.fajrAdhanUri = uri.toString()
            s.fajrAdhanName = displayName(context, uri)
        }
    }

    SubPage("الأذان والتنبيهات", onBack) {
        SectionCard("التنبيه عند دخول الوقت") {
            Prayer.entries.forEach { prayer ->
                SettingItem(
                    Format.prayerName(prayer),
                    Labels.alert(s.alertMode(prayer)),
                    onClick = { modeDialogFor = prayer },
                )
            }
        }

        SectionCard("صوت الأذان") {
            SettingItem(
                "ملف الأذان",
                s.adhanName.ifBlank { "النغمة الافتراضية — اختر ملف أذان من هاتفك" },
                onClick = { pickAdhan.launch(arrayOf("audio/*")) },
                trailing = {
                    Row {
                        IconButton(onClick = { AdhanService.preview(context, s.adhanUri) }) {
                            Icon(Icons.Filled.PlayArrow, contentDescription = "تشغيل")
                        }
                        if (s.adhanUri.isNotBlank()) {
                            IconButton(onClick = { s.adhanUri = ""; s.adhanName = "" }) {
                                Icon(Icons.Filled.Close, contentDescription = "الرجوع للافتراضي")
                            }
                        }
                    }
                },
            )
            SettingItem(
                "أذان الفجر (اختياري)",
                s.fajrAdhanName.ifBlank { "نفس ملف الأذان العام" },
                onClick = { pickFajr.launch(arrayOf("audio/*")) },
                trailing = {
                    Row {
                        IconButton(onClick = { AdhanService.preview(context, s.fajrAdhanUri.ifBlank { s.adhanUri }) }) {
                            Icon(Icons.Filled.PlayArrow, contentDescription = "تشغيل")
                        }
                        if (s.fajrAdhanUri.isNotBlank()) {
                            IconButton(onClick = { s.fajrAdhanUri = ""; s.fajrAdhanName = "" }) {
                                Icon(Icons.Filled.Close, contentDescription = "إزالة")
                            }
                        }
                    }
                },
            )
            SettingItem("مستوى الصوت", "${fmt.number(volume.toInt())}٪")
            Slider(
                value = volume,
                onValueChange = { volume = it },
                onValueChangeFinished = { s.adhanVolume = volume.toInt() },
                valueRange = 10f..100f,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            SwitchItem("التشغيل حتى في الوضع الصامت", "يستخدم مستوى صوت المنبّه", s.adhanUseAlarmStream) { s.adhanUseAlarmStream = it }
            SwitchItem("إيقاف الأذان بزر القفل", "اضغط زر التشغيل/القفل لإسكات الأذان", s.adhanStopOnScreenOff) { s.adhanStopOnScreenOff = it }
            SwitchItem("الاهتزاز مع الأذان", null, s.adhanVibrate) { s.adhanVibrate = it }
            SwitchItem("عرض دعاء ما بعد الأذان", null, s.adhanShowDua) { s.adhanShowDua = it }
            Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { AdhanService.preview(context, null) }) {
                    Icon(painterResource(R.drawable.ic_volume), contentDescription = null, modifier = Modifier.size(18.dp))
                    Text("  تجربة الأذان")
                }
                OutlinedButton(onClick = { AdhanService.stop(context) }) { Text("إيقاف") }
            }
        }

        SectionCard("التذكير قبل الصلاة") {
            SwitchItem("تفعيل التذكير", "إشعار بنغمة لطيفة قبل الأذان", s.reminderEnabled) { s.reminderEnabled = it; apply() }
            if (s.reminderEnabled) {
                SettingItem("قبل الأذان بـ", fmt.minutes(s.reminderMinutes), trailing = {
                    Stepper(fmt.number(s.reminderMinutes), onMinus = {
                        s.reminderMinutes = (s.reminderMinutes - 1).coerceAtLeast(1); apply()
                    }, onPlus = {
                        s.reminderMinutes = (s.reminderMinutes + 1).coerceAtMost(120); apply()
                    })
                })
                Row(
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    listOf(5, 10, 15, 20, 30, 45, 60).forEach { m ->
                        FilterChip(
                            selected = s.reminderMinutes == m,
                            onClick = { s.reminderMinutes = m; apply() },
                            label = { Text(fmt.number(m)) },
                        )
                    }
                }
                Text(
                    "التذكير لـ:",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(start = 16.dp, top = 8.dp),
                )
                Row(
                    Modifier
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Prayer.entries.forEach { prayer ->
                        FilterChip(
                            selected = s.reminderFor(prayer),
                            onClick = { s.setReminderFor(prayer, !s.reminderFor(prayer)); apply() },
                            label = { Text(if (prayer == Prayer.SUNRISE) "قبل الشروق" else Format.prayerName(prayer)) },
                        )
                    }
                }
            }
        }

        SectionCard("الإقامة") {
            SwitchItem("تنبيه الإقامة", "إشعار بعد الأذان بالمدة المحددة لكل صلاة", s.iqamaEnabled) { s.iqamaEnabled = it; apply() }
            if (s.iqamaEnabled) {
                Prayer.salawat.forEach { prayer ->
                    val minutes = s.iqamaMinutes(prayer)
                    SettingItem(Format.prayerName(prayer), "بعد الأذان بـ ${fmt.minutes(minutes)}", trailing = {
                        Stepper(fmt.number(minutes), onMinus = {
                            s.setIqamaMinutes(prayer, (minutes - 1).coerceAtLeast(1)); apply()
                        }, onPlus = {
                            s.setIqamaMinutes(prayer, (minutes + 1).coerceAtMost(60)); apply()
                        })
                    })
                }
            }
        }

        SectionCard("وضع الاهتزاز أثناء الصلاة") {
            SwitchItem(
                "تحويل الهاتف إلى الاهتزاز تلقائيًا",
                "ثم يعود الرنين كما كان بعد انتهاء المدة",
                s.silentEnabled,
            ) { s.silentEnabled = it; apply() }
            if (s.silentEnabled) {
                SettingItem("يبدأ بعد الأذان بـ", fmt.minutes(s.silentDelayMinutes), trailing = {
                    Stepper(fmt.number(s.silentDelayMinutes), onMinus = {
                        s.silentDelayMinutes = (s.silentDelayMinutes - 1).coerceAtLeast(0); apply()
                    }, onPlus = {
                        s.silentDelayMinutes = (s.silentDelayMinutes + 1).coerceAtMost(45); apply()
                    })
                })
                SettingItem("لمدة", fmt.minutes(s.silentDurationMinutes), trailing = {
                    Stepper(fmt.number(s.silentDurationMinutes), onMinus = {
                        s.silentDurationMinutes = (s.silentDurationMinutes - 5).coerceAtLeast(5); apply()
                    }, onPlus = {
                        s.silentDurationMinutes = (s.silentDurationMinutes + 5).coerceAtMost(120); apply()
                    })
                })
            }
        }

        SectionCard("أخرى") {
            SwitchItem("تذكير سورة الكهف يوم الجمعة", "صباح كل جمعة الساعة ٩", s.kahfReminder) { s.kahfReminder = it; apply() }
            SwitchItem(
                "دقة قصوى (منبّه النظام)",
                "يستخدم منبّه النظام لضمان الأذان حتى في وضع توفير الطاقة العميق؛ قد تظهر أيقونة المنبّه في شريط الحالة",
                s.useAlarmClock,
            ) { s.useAlarmClock = it; apply() }
        }
    }

    modeDialogFor?.let { prayer ->
        val options = if (prayer == Prayer.SUNRISE) listOf(AlertMode.NOTIFICATION, AlertMode.SILENT) else AlertMode.entries
        ChoiceDialog(
            title = "عند دخول وقت ${Format.prayerName(prayer)}",
            options = options,
            selected = s.alertMode(prayer),
            label = Labels::alert,
            onSelect = { s.setAlertMode(prayer, it); apply() },
            onDismiss = { modeDialogFor = null },
        )
    }
}

private fun persist(context: Context, uri: Uri) {
    runCatching {
        context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
}

private fun displayName(context: Context, uri: Uri): String {
    val name = runCatching {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    }.getOrNull()
    return name?.substringBeforeLast('.') ?: "ملف صوتي"
}
