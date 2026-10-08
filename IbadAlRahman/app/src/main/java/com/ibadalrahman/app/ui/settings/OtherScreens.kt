package com.ibadalrahman.app.ui.settings

import android.Manifest
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.ibadalrahman.app.R
import com.ibadalrahman.app.alarm.EventType
import com.ibadalrahman.app.alarm.Scheduler
import com.ibadalrahman.app.core.Prayer
import com.ibadalrahman.app.data.PrayerRepository
import com.ibadalrahman.app.data.PrayerSnapshot
import com.ibadalrahman.app.data.StatusStyle
import com.ibadalrahman.app.data.ThemeMode
import com.ibadalrahman.app.data.WidgetPrefs
import com.ibadalrahman.app.data.WidgetTheme
import com.ibadalrahman.app.statusbar.StatusBarService
import com.ibadalrahman.app.statusbar.StatusIconRenderer
import com.ibadalrahman.app.ui.Labels
import com.ibadalrahman.app.ui.components.LocalSettingsVersion
import com.ibadalrahman.app.ui.components.SectionCard
import com.ibadalrahman.app.ui.components.SettingItem
import com.ibadalrahman.app.ui.components.SubPage
import com.ibadalrahman.app.ui.components.SwitchItem
import com.ibadalrahman.app.ui.components.rememberApplySettings
import com.ibadalrahman.app.ui.components.settings
import com.ibadalrahman.app.ui.theme.Gold
import com.ibadalrahman.app.ui.theme.Ruqaa
import com.ibadalrahman.app.util.Format
import com.ibadalrahman.app.util.Permissions
import com.ibadalrahman.app.widget.WidgetKind
import com.ibadalrahman.app.widget.WidgetUpdater

// ---------------------------------------------------------------------------------- status bar

@Composable
fun StatusBarScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val s = settings()
    val version = LocalSettingsVersion.current
    val apply = rememberApplySettings()
    val fmt = Format(s)
    val snapshot = remember(version) { PrayerRepository.snapshot(context, includeSunrise = s.statusIncludeSunrise) }
    val notificationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { apply() }

    SubPage("شريط الحالة", onBack) {
        StatusBarMock(StatusIconRenderer.lines(s.statusStyle, snapshot, fmt))
        Text(
            "يظهر الوقت المتبقي للصلاة القادمة بجانب الساعة تمامًا مثل عدّاد سرعة الإنترنت، ويتحدّث كل دقيقة. " +
                "اسحب شريط الإشعارات لرؤية جميع أوقات اليوم.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        SectionCard {
            SwitchItem("إظهار العد التنازلي بجانب الساعة", null, s.statusBarEnabled) {
                s.statusBarEnabled = it
                if (it && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !Permissions.notificationsGranted(context)) {
                    notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
                apply()
            }
            SwitchItem("احتساب الشروق", "عرض الوقت المتبقي على الشروق بعد صلاة الفجر", s.statusIncludeSunrise) {
                s.statusIncludeSunrise = it
                apply()
            }
        }
        SectionCard("شكل العرض") {
            StatusStyle.entries.forEach { style ->
                val lines = StatusIconRenderer.lines(style, snapshot, fmt)
                Row(
                    Modifier
                        .fillMaxWidth()
                        .selectable(selected = s.statusStyle == style, role = Role.RadioButton) {
                            s.statusStyle = style
                            apply()
                        }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = s.statusStyle == style, onClick = null)
                    Spacer(Modifier.width(8.dp))
                    Text(Labels.statusStyle(style), style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    StatusIconChip(lines, 40)
                }
            }
        }
        Text(
            "ملاحظة: في بعض الأجهزة (شاومي، هواوي، أوبو) يجب السماح بإظهار أيقونات الإشعارات في شريط الحالة من إعدادات الإشعارات بالنظام.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedButton(onClick = { Permissions.openNotificationSettings(context) }) { Text("إعدادات الإشعارات") }
    }
}

@Composable
private fun StatusIconChip(lines: StatusIconRenderer.Lines, sizeDp: Int) {
    val bitmap = remember(lines) { StatusIconRenderer.render(lines, 128).asImageBitmap() }
    Box(
        Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF111827))
            .padding(6.dp),
    ) {
        Image(bitmap, contentDescription = null, modifier = Modifier.size(sizeDp.dp))
    }
}

/** A fake phone status bar showing exactly what the user will get. */
@Composable
private fun StatusBarMock(lines: StatusIconRenderer.Lines) {
    val bitmap = remember(lines) { StatusIconRenderer.render(lines, 128).asImageBitmap() }
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .background(Brush.horizontalGradient(listOf(Color(0xFF0F172A), Color(0xFF1E293B))))
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("12:30", color = Color.White, style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Medium))
            Spacer(Modifier.width(8.dp))
            Image(bitmap, contentDescription = null, modifier = Modifier.size(26.dp))
            Spacer(Modifier.weight(1f))
            Canvas(Modifier.size(width = 46.dp, height = 14.dp)) {
                // signal bars
                for (i in 0 until 4) {
                    val h = size.height * (0.35f + i * 0.2f)
                    drawRect(Color.White, Offset(i * 5.dp.toPx(), size.height - h), Size(3.dp.toPx(), h))
                }
                // battery
                val bx = 24.dp.toPx()
                drawRoundRect(Color.White, Offset(bx, 1.dp.toPx()), Size(18.dp.toPx(), size.height - 2.dp.toPx()), CornerRadius(3f), style = Stroke(1.5f))
                drawRect(Color.White, Offset(bx + 2.dp.toPx(), 3.dp.toPx()), Size(11.dp.toPx(), size.height - 6.dp.toPx()))
            }
        }
    }
}

// ---------------------------------------------------------------------------------- widgets

@Composable
fun WidgetSettingsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val s = settings()
    val version = LocalSettingsVersion.current
    val fmt = Format(s)
    val snapshot = remember(version) { PrayerRepository.snapshot(context) }
    var opacity by remember { mutableFloatStateOf(s.widgetOpacityDefault.toFloat()) }

    SubPage("الودجت", onBack) {
        SectionCard("المظهر الافتراضي") {
            Row(
                Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                WidgetTheme.entries.forEach { theme ->
                    FilterChip(
                        selected = s.widgetThemeDefault == theme,
                        onClick = { s.widgetThemeDefault = theme },
                        label = { Text(Labels.widgetTheme(theme)) },
                        leadingIcon = {
                            Box(
                                Modifier
                                    .size(14.dp)
                                    .clip(CircleShape)
                                    .background(Color(theme.background)),
                            )
                        },
                    )
                }
            }
            SettingItem("الشفافية", "عتامة الخلفية ${fmt.number(opacity.toInt())}٪")
            Slider(
                value = opacity,
                onValueChange = { opacity = it },
                onValueChangeFinished = { s.widgetOpacityDefault = opacity.toInt() },
                valueRange = 0f..100f,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            TextButton(
                onClick = {
                    val prefs = WidgetPrefs(context)
                    val manager = AppWidgetManager.getInstance(context)
                    WidgetKind.entries.forEach { kind ->
                        manager.getAppWidgetIds(ComponentName(context, kind.providerClass)).forEach {
                            prefs.save(it, s.widgetThemeDefault, opacity.toInt())
                        }
                    }
                    WidgetUpdater.updateAll(context)
                    Toast.makeText(context, "تم تطبيق المظهر على جميع الودجت", Toast.LENGTH_SHORT).show()
                },
                modifier = Modifier.padding(horizontal = 8.dp),
            ) { Text("تطبيق على جميع الودجت الموجودة") }
        }

        WidgetKind.entries.forEach { kind ->
            SectionCard(kind.title) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    WidgetPreview(kind, s.widgetThemeDefault, opacity.toInt(), snapshot, fmt)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(kind.description, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                        Button(onClick = { requestPin(context, kind) }) { Text("إضافة") }
                    }
                }
            }
        }
        Text(
            "يمكنك أيضًا الضغط مطولًا على الشاشة الرئيسية ← الأدوات (Widgets) ← عباد الرحمن. " +
                "ولتغيير شكل ودجت موجود اضغط عليه مطولًا ثم اختر «إعدادات».",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

private fun requestPin(context: android.content.Context, kind: WidgetKind) {
    val manager = AppWidgetManager.getInstance(context)
    if (manager.isRequestPinAppWidgetSupported) {
        manager.requestPinAppWidget(ComponentName(context, kind.providerClass), null, null)
    } else {
        Toast.makeText(context, "اضغط مطولًا على الشاشة الرئيسية ثم اختر الأدوات ← عباد الرحمن", Toast.LENGTH_LONG).show()
    }
}

/** Compose approximation of a widget over a wallpaper, so transparency can be judged. */
@Composable
fun WidgetPreview(kind: WidgetKind, theme: WidgetTheme, opacity: Int, snapshot: PrayerSnapshot, fmt: Format) {
    val text = Color(theme.text)
    val secondary = Color(theme.secondary)
    val accent = Color(theme.accent)
    val next = snapshot.status.next
    val nextName = Format.prayerName(next.prayer, snapshot.nextIsFriday)
    val height = when (kind) {
        WidgetKind.STRIP -> 70.dp
        WidgetKind.NEXT, WidgetKind.RING -> 150.dp
        else -> 140.dp
    }
    Box(
        Modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(18.dp))
            .background(Brush.linearGradient(listOf(Color(0xFF3A6073), Color(0xFF16222A), Color(0xFF7B4397)))),
        contentAlignment = Alignment.Center,
    ) {
        val widgetModifier = when (kind) {
            WidgetKind.NEXT, WidgetKind.RING -> Modifier.size(130.dp)
            WidgetKind.STRIP -> Modifier
                .fillMaxWidth(0.94f)
                .height(52.dp)
            else -> Modifier
                .fillMaxWidth(0.94f)
                .height(120.dp)
        }
        Box(
            widgetModifier
                .clip(RoundedCornerShape(22.dp))
                .background(Color(theme.background).copy(alpha = opacity / 100f)),
            contentAlignment = Alignment.Center,
        ) {
            when (kind) {
                WidgetKind.NEXT -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("الصلاة القادمة", color = secondary, fontSize = 11.sp)
                    Text(nextName, color = text, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Text(fmt.time(next.time, snapshot.zone), color = accent, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text(fmt.countdown(snapshot.status.remainingMillis(snapshot.now)), color = text, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }

                WidgetKind.RING -> {
                    Canvas(Modifier.fillMaxSize().padding(10.dp)) {
                        val stroke = 7.dp.toPx()
                        drawArc(text.copy(alpha = 0.2f), 0f, 360f, false, style = Stroke(stroke))
                        drawArc(accent, -90f, 360f * snapshot.status.progress(snapshot.now), false, style = Stroke(stroke, cap = androidx.compose.ui.graphics.StrokeCap.Round))
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(nextName, color = text, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Text(fmt.time(next.time, snapshot.zone), color = accent, fontSize = 12.sp)
                    }
                }

                WidgetKind.CLOCK -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(fmt.time(snapshot.now, snapshot.zone, withPeriod = false), color = text, fontSize = 38.sp, fontWeight = FontWeight.Bold)
                    Text("${fmt.gregorian(snapshot.date)} • ${fmt.hijri(snapshot.hijri)}", color = secondary, fontSize = 10.sp)
                    Text("$nextName ${fmt.time(next.time, snapshot.zone)}", color = accent, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }

                WidgetKind.TODAY, WidgetKind.STRIP -> Column(Modifier.padding(horizontal = 8.dp)) {
                    if (kind == WidgetKind.TODAY) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(snapshot.locationName, color = text, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            Text("$nextName بعد ${fmt.countdown(snapshot.status.remainingMillis(snapshot.now))}", color = accent, fontSize = 11.sp)
                        }
                        Spacer(Modifier.height(10.dp))
                    }
                    Row {
                        Prayer.entries.forEach { prayer ->
                            val highlighted = prayer == next.prayer
                            Column(
                                Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (highlighted) accent.copy(alpha = 0.2f) else Color.Transparent)
                                    .padding(vertical = 4.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Text(Format.prayerName(prayer), color = if (highlighted) accent else secondary, fontSize = 9.sp, maxLines = 1)
                                Text(
                                    fmt.time(snapshot.today[prayer], snapshot.zone, withPeriod = false),
                                    color = if (highlighted) accent else text,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------------- appearance

@Composable
fun AppearanceScreen(onBack: () -> Unit) {
    val s = settings()
    val apply = rememberApplySettings()
    val fmt = Format(s)
    SubPage("المظهر", onBack) {
        SectionCard("السمة") {
            ThemeMode.entries.forEach { mode ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .selectable(selected = s.themeMode == mode, role = Role.RadioButton) { s.themeMode = mode }
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = s.themeMode == mode, onClick = null)
                    Spacer(Modifier.width(8.dp))
                    Text(Labels.theme(mode), style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
        SectionCard("الأرقام والوقت") {
            SwitchItem("الأرقام العربية المشرقية", "مثال: ${Format(true, s.use24h).number(1447)} بدل 1447", s.arabicDigits) {
                s.arabicDigits = it
                apply()
            }
            SwitchItem("نظام 24 ساعة", "مثال: ${fmt.time(System.currentTimeMillis(), s.zone())}", s.use24h) {
                s.use24h = it
                apply()
            }
        }
    }
}

// ---------------------------------------------------------------------------------- reliability

@Composable
fun ReliabilityScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val s = settings()
    val apply = rememberApplySettings()
    val fmt = Format(s)
    var tick by remember { mutableIntStateOf(0) }
    LifecycleResumeEffect(Unit) {
        tick++
        onPauseOrDispose { }
    }
    val notificationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        tick++
        apply()
    }

    SubPage("ضمان عمل الأذان", onBack) {
        @Suppress("UNUSED_VARIABLE") val refresh = tick
        val ok = "✓ مفعّل"
        val bad = "✗ غير مفعّل — اضغط للتفعيل"
        SectionCard("الأذونات") {
            SettingItem(
                "الإشعارات",
                if (Permissions.notificationsGranted(context)) ok else bad,
                onClick = {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !Permissions.notificationsGranted(context)) {
                        notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else {
                        Permissions.openNotificationSettings(context)
                    }
                },
            )
            SettingItem(
                "المنبهات والتذكيرات الدقيقة",
                if (Permissions.exactAlarmsAllowed(context)) ok else bad,
                onClick = { Permissions.openExactAlarmSettings(context) },
            )
            SettingItem(
                "الاستثناء من توفير البطارية",
                if (Permissions.ignoringBatteryOptimizations(context)) ok else bad,
                onClick = { Permissions.requestIgnoreBatteryOptimizations(context) },
            )
            SettingItem(
                "خدمة شريط الحالة",
                if (StatusBarService.isRunning) "تعمل الآن" else if (s.statusBarEnabled) "متوقفة — افتح التطبيق لتشغيلها" else "معطّلة من الإعدادات",
            )
        }
        val next = remember(tick, LocalSettingsVersion.current) { Scheduler.nextEvent(context) }
        SectionCard("التنبيه التالي المجدول") {
            SettingItem(
                next?.let { eventLabel(it.type, it.prayer) } ?: "لا يوجد",
                next?.let { "${fmt.time(it.time, s.zone())} • ${fmt.gregorian(java.time.Instant.ofEpochMilli(it.time).atZone(s.zone()).toLocalDate(), false)}" },
            )
        }
        SectionCard("نصائح حسب نوع الهاتف") {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("• شاومي/ريدمي: الإعدادات ← التطبيقات ← عباد الرحمن ← التشغيل التلقائي ✓ وتوفير البطارية «بلا قيود».", style = MaterialTheme.typography.bodySmall)
                Text("• هواوي/أونر: إدارة تشغيل التطبيقات ← عباد الرحمن ← إدارة يدوية مع تفعيل جميع الخيارات.", style = MaterialTheme.typography.bodySmall)
                Text("• سامسونج: البطارية ← حدود استخدام الخلفية ← التطبيقات التي لا تدخل في وضع السكون ← أضف عباد الرحمن.", style = MaterialTheme.typography.bodySmall)
                Text("• أوبو/ريلمي/فيفو: السماح بالنشاط في الخلفية والتشغيل التلقائي.", style = MaterialTheme.typography.bodySmall)
            }
        }
        OutlinedButton(onClick = { Permissions.openAppDetails(context) }) { Text("فتح إعدادات التطبيق في النظام") }
    }
}

private fun eventLabel(type: EventType, prayer: Prayer?): String {
    val name = prayer?.let { Format.prayerName(it) }.orEmpty()
    return when (type) {
        EventType.ADHAN -> "أذان $name"
        EventType.REMINDER -> "تذكير قبل $name"
        EventType.IQAMA -> "إقامة $name"
        EventType.SILENT_START -> "بدء الاهتزاز لصلاة $name"
        EventType.SILENT_END -> "انتهاء الاهتزاز"
        EventType.KAHF -> "تذكير سورة الكهف"
        EventType.REFRESH -> if (prayer != null) "تحديث عند $name" else "بداية يوم جديد"
    }
}

// ---------------------------------------------------------------------------------- about

@Composable
fun AboutScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val version = remember {
        runCatching { context.packageManager.getPackageInfo(context.packageName, 0).versionName }.getOrNull() ?: ""
    }
    SubPage("حول التطبيق", onBack) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            AppLogo(Modifier.size(120.dp))
            Text("عباد الرحمن", style = TextStyle(fontFamily = Ruqaa, fontSize = 40.sp), color = Gold)
            Text("الإصدار $version", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(12.dp))
            Text(
                "﴿وَعِبَادُ الرَّحْمَٰنِ الَّذِينَ يَمْشُونَ عَلَى الْأَرْضِ هَوْنًا وَإِذَا خَاطَبَهُمُ الْجَاهِلُونَ قَالُوا سَلَامًا﴾",
                style = TextStyle(fontFamily = Ruqaa, fontSize = 20.sp),
                textAlign = TextAlign.Center,
            )
            Text("سورة الفرقان: ٦٣", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        SectionCard("المزايا") {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf(
                    "حساب فلكي دقيق يعمل دون إنترنت مع ٢٢ طريقة حساب معتمدة",
                    "العد التنازلي للصلاة القادمة بجانب الساعة في شريط الحالة",
                    "أذان من ملف تختاره، وأذان خاص للفجر، وتنبيه قبل الصلاة",
                    "خمسة أشكال للودجت مع التحكم بالشفافية والألوان",
                    "تعديل كل صلاة يدويًا، والإقامة، ووضع الاهتزاز أثناء الصلاة",
                    "القبلة، والتقويم الشهري، والتاريخ الهجري، والمسبحة",
                ).forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium) }
            }
        }
        Text(
            "الخطوط: Tajawal و Aref Ruqaa برخصة SIL Open Font License.\nلا يجمع التطبيق أي بيانات، وكل الحسابات تتم على جهازك.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** The launcher icon's two layers stacked and clipped to a circle. */
@Composable
fun AppLogo(modifier: Modifier = Modifier) {
    Box(modifier.clip(CircleShape)) {
        Image(painterResource(R.mipmap.ic_launcher_background), contentDescription = null, modifier = Modifier.fillMaxSize())
        Image(painterResource(R.mipmap.ic_launcher_foreground), contentDescription = "عباد الرحمن", modifier = Modifier.fillMaxSize())
    }
}
