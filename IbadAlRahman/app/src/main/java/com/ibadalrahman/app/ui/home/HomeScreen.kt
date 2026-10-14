package com.ibadalrahman.app.ui.home

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.ibadalrahman.app.R
import com.ibadalrahman.app.core.Prayer
import com.ibadalrahman.app.core.PrayerTimes
import com.ibadalrahman.app.core.Qibla
import com.ibadalrahman.app.data.AlertMode
import com.ibadalrahman.app.data.LocationHelper
import com.ibadalrahman.app.data.LocationMode
import com.ibadalrahman.app.data.PrayerRepository
import com.ibadalrahman.app.data.PrayerSnapshot
import com.ibadalrahman.app.data.Settings
import com.ibadalrahman.app.ui.Labels
import com.ibadalrahman.app.ui.Route
import com.ibadalrahman.app.ui.components.Banner
import com.ibadalrahman.app.ui.components.LocalSettingsVersion
import com.ibadalrahman.app.ui.components.PrayerGlyph
import com.ibadalrahman.app.ui.components.rememberApplySettings
import com.ibadalrahman.app.ui.components.settings
import com.ibadalrahman.app.ui.theme.Gold
import androidx.compose.foundation.border
import androidx.compose.ui.platform.LocalDensity
import com.ibadalrahman.app.ui.components.ArcadeSilhouette
import com.ibadalrahman.app.ui.components.BrandHeader
import com.ibadalrahman.app.ui.components.GirihPattern
import com.ibadalrahman.app.ui.components.SparkleStar
import com.ibadalrahman.app.ui.components.archShape
import com.ibadalrahman.app.ui.theme.Cream
import com.ibadalrahman.app.ui.theme.GoldDeep
import com.ibadalrahman.app.ui.theme.GoldGradient
import com.ibadalrahman.app.ui.theme.GoldLight
import com.ibadalrahman.app.ui.theme.Royal
import com.ibadalrahman.app.ui.theme.Teal
import com.ibadalrahman.app.ui.theme.TealDeep
import com.ibadalrahman.app.ui.theme.Ruqaa
import com.ibadalrahman.app.util.Format
import com.ibadalrahman.app.util.Permissions
import kotlinx.coroutines.delay
import java.time.DayOfWeek

@Composable
fun HomeScreen(modifier: Modifier, navigate: (Route) -> Unit) {
    val context = LocalContext.current
    val s = settings()
    val version = LocalSettingsVersion.current
    val apply = rememberApplySettings()

    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(1_000L - System.currentTimeMillis() % 1_000L)
            now = System.currentTimeMillis()
        }
    }
    val minute = now / 60_000L
    val snapshot = remember(minute, version) { PrayerRepository.snapshot(context, now, includeSunrise = true) }
    val fmt = remember(version) { Format(s) }
    var dayOffset by rememberSaveable { mutableIntStateOf(0) }

    // Permission state is re-read whenever the user comes back from system settings.
    var resumeTick by remember { mutableIntStateOf(0) }
    LifecycleResumeEffect(Unit) {
        resumeTick++
        onPauseOrDispose { }
    }
    val notificationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        resumeTick++
        apply()
    }
    val locationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        if (result.values.any { it }) LocationHelper.updateLocation(context) { apply() }
        resumeTick++
    }

    val shownDate = snapshot.date.plusDays(dayOffset.toLong())
    val shownTimes = remember(shownDate, version) { PrayerRepository.times(context, shownDate) }

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item { BrandHeader(Modifier.fillMaxWidth(), logoSize = 58.dp, wordmarkSize = 30) }
        item { HeroCard(snapshot, now, fmt, onLocationClick = { navigate(Route.LOCATION) }) }

        item {
            key(resumeTick) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (!Permissions.notificationsGranted(context) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        Banner("اسمح بالإشعارات ليعمل الأذان والعدّاد بجانب الساعة", "سماح", MaterialTheme.colorScheme.error) {
                            notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        }
                    }
                    if (!Permissions.exactAlarmsAllowed(context)) {
                        Banner("فعّل «المنبهات والتذكيرات» ليُرفع الأذان في وقته بالضبط", "تفعيل", MaterialTheme.colorScheme.error) {
                            Permissions.openExactAlarmSettings(context)
                        }
                    }
                    if (s.locationMode == LocationMode.AUTO && !LocationHelper.hasPermission(context)) {
                        Banner("اسمح بالوصول إلى الموقع لحساب المواقيت تلقائيًا", "سماح", MaterialTheme.colorScheme.tertiary) {
                            locationLauncher.launch(
                                arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION),
                            )
                        }
                    }
                    if (!s.batteryHintDismissed && !Permissions.ignoringBatteryOptimizations(context)) {
                        DismissibleBanner(
                            "استثنِ التطبيق من توفير البطارية لضمان عدم تأخر الأذان",
                            "استثناء",
                            onClick = { Permissions.requestIgnoreBatteryOptimizations(context) },
                            onDismiss = { s.batteryHintDismissed = true },
                        )
                    }
                    if (!s.adhanHintDismissed && s.adhanUri.isBlank() && Prayer.salawat.any { s.alertMode(it) == AlertMode.ADHAN }) {
                        DismissibleBanner(
                            "اختر ملف الأذان المفضّل لديك من ذاكرة الهاتف",
                            "اختيار",
                            onClick = { navigate(Route.ADHAN) },
                            onDismiss = { s.adhanHintDismissed = true },
                        )
                    }
                }
            }
        }

        item {
            DaySelector(
                label = when (dayOffset) {
                    0 -> "اليوم"
                    1 -> "غدًا"
                    -1 -> "أمس"
                    else -> Format.weekday(shownDate.dayOfWeek)
                },
                date = fmt.gregorian(shownDate, withWeekday = dayOffset == 0 || dayOffset in -1..1),
                hijri = fmt.hijri(com.ibadalrahman.app.core.Hijri.of(shownDate, s.hijriAdjustment)),
                onPrevious = { dayOffset-- },
                onNext = { dayOffset++ },
                onToday = { dayOffset = 0 },
                isToday = dayOffset == 0,
            )
        }

        items(Prayer.entries) { prayer ->
            val isNext = dayOffset == 0 && snapshot.status.next.dayOffset == 0 && snapshot.status.next.prayer == prayer
            val passed = dayOffset < 0 || (dayOffset == 0 && shownTimes[prayer] <= now)
            PrayerRow(
                prayer = prayer,
                times = shownTimes,
                fmt = fmt,
                friday = shownDate.dayOfWeek == DayOfWeek.FRIDAY,
                isNext = isNext,
                passed = passed,
                remaining = if (isNext) snapshot.status.remainingMillis(now) else null,
                mode = s.alertMode(prayer),
                iqamaMinutes = if (s.iqamaEnabled && prayer.isSalah) s.iqamaMinutes(prayer) else null,
                onToggleMode = {
                    val next = when (s.alertMode(prayer)) {
                        AlertMode.ADHAN -> AlertMode.NOTIFICATION
                        AlertMode.NOTIFICATION -> AlertMode.SILENT
                        AlertMode.SILENT -> if (prayer == Prayer.SUNRISE) AlertMode.NOTIFICATION else AlertMode.ADHAN
                    }
                    s.setAlertMode(prayer, next)
                    apply()
                },
            )
        }

        item { ExtrasCard(shownTimes, snapshot, fmt, s) }
        item { Spacer(Modifier.height(8.dp)) }
    }
}

/** A subtle tint over the brand teal that follows the time of day. */
private fun heroTint(previous: Prayer): Color = when (previous) {
    Prayer.FAJR -> Color(0xFF2E4A6B)
    Prayer.SUNRISE, Prayer.DHUHR -> Color(0xFF1E7F78)
    Prayer.ASR -> Color(0xFF6B6330)
    Prayer.MAGHRIB -> Royal
    Prayer.ISHA -> Color(0xFF0B2A33)
}

@Composable
private fun HeroCard(snapshot: PrayerSnapshot, now: Long, fmt: Format, onLocationClick: () -> Unit) {
    val next = snapshot.status.next
    val remaining = snapshot.status.remainingMillis(now)
    val white = Color.White
    val density = LocalDensity.current
    val shape = remember(density) { with(density) { archShape(archHeight = 64.dp.toPx(), cornerRadius = 28.dp.toPx()) } }
    Box(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Brush.verticalGradient(listOf(heroTint(snapshot.status.previous.prayer), Teal, TealDeep)))
            .border(1.5.dp, Brush.verticalGradient(listOf(GoldLight, Gold, GoldDeep)), shape),
    ) {
        GirihPattern(Modifier.matchParentSize(), color = Gold.copy(alpha = 0.09f), cell = 38.dp)
        ArcadeSilhouette(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .height(86.dp),
        )
        Column(
            Modifier
                .fillMaxWidth()
                .padding(start = 20.dp, end = 20.dp, top = 30.dp, bottom = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            SparkleStar(Modifier.size(14.dp), GoldLight)
            Text(
                fmt.hijri(snapshot.hijri),
                style = TextStyle(fontFamily = Ruqaa, fontSize = 25.sp, fontWeight = FontWeight.Bold, brush = GoldGradient),
                modifier = Modifier.padding(top = 4.dp),
            )
            Text(fmt.gregorian(snapshot.date), color = Cream.copy(alpha = 0.85f), style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(14.dp))
            Text("الصلاة القادمة", color = Cream.copy(alpha = 0.8f), style = MaterialTheme.typography.labelLarge)
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    Format.prayerName(next.prayer, snapshot.nextIsFriday),
                    color = white,
                    style = MaterialTheme.typography.displaySmall.copy(fontWeight = FontWeight.ExtraBold),
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    fmt.time(next.time, snapshot.zone),
                    color = GoldLight,
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.padding(bottom = 6.dp),
                )
            }
            Text(
                fmt.countdown(remaining),
                color = white,
                style = TextStyle(
                    fontFamily = FontFamily.Default,
                    fontSize = 46.sp,
                    fontWeight = FontWeight.Bold,
                    fontFeatureSettings = "tnum",
                ),
            )
            Text("متبقي ${fmt.remainingWords(remaining)}", color = Cream.copy(alpha = 0.85f), style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(12.dp))
            LinearProgressIndicator(
                progress = { snapshot.status.progress(now) },
                modifier = Modifier
                    .fillMaxWidth(0.82f)
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = GoldLight,
                trackColor = white.copy(alpha = 0.22f),
            )
            Spacer(Modifier.height(14.dp))
            Row(
                Modifier
                    .clip(RoundedCornerShape(50))
                    .background(Color.Black.copy(alpha = 0.22f))
                    .clickable(onClick = onLocationClick)
                    .padding(horizontal = 14.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.LocationOn, contentDescription = null, tint = GoldLight, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text(snapshot.locationName, color = Cream, style = MaterialTheme.typography.titleSmall, maxLines = 1)
            }
            Spacer(Modifier.height(44.dp))
        }
    }
}

@Composable
private fun DismissibleBanner(text: String, action: String, onClick: () -> Unit, onDismiss: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f)) { Banner(text, action, MaterialTheme.colorScheme.primary, onClick) }
        IconButton(onClick = onDismiss) {
            Icon(Icons.Filled.Close, contentDescription = "إخفاء", tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun DaySelector(
    label: String,
    date: String,
    hijri: String,
    isToday: Boolean,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onToday: () -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        IconButton(onClick = onPrevious) {
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "اليوم السابق")
        }
        Column(
            Modifier
                .weight(1f)
                .clip(RoundedCornerShape(12.dp))
                .clickable(enabled = !isToday, onClick = onToday),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(label, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Text(date, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(hijri, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        IconButton(onClick = onNext) {
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "اليوم التالي")
        }
    }
}

@Composable
private fun PrayerRow(
    prayer: Prayer,
    times: PrayerTimes,
    fmt: Format,
    friday: Boolean,
    isNext: Boolean,
    passed: Boolean,
    remaining: Long?,
    mode: AlertMode,
    iqamaMinutes: Int?,
    onToggleMode: () -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = if (isNext) scheme.primaryContainer else scheme.surfaceContainer,
        border = if (isNext) BorderStroke(1.5.dp, Brush.horizontalGradient(listOf(GoldLight, Gold, GoldDeep))) else null,
        modifier = Modifier
            .fillMaxWidth()
            .alpha(if (passed && !isNext) 0.6f else 1f),
    ) {
        Row(Modifier.padding(start = 14.dp, end = 4.dp, top = 10.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            PrayerGlyph(prayer)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(Format.prayerName(prayer, friday), style = MaterialTheme.typography.titleMedium)
                when {
                    remaining != null -> Text(
                        "بعد ${fmt.countdown(remaining)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = scheme.primary,
                    )

                    iqamaMinutes != null -> Text(
                        "الإقامة ${fmt.time(times[prayer] + iqamaMinutes * 60_000L, times.zone)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = scheme.onSurfaceVariant,
                    )
                }
            }
            Text(
                fmt.time(times[prayer], times.zone),
                style = MaterialTheme.typography.titleLarge,
                color = if (isNext) scheme.onPrimaryContainer else scheme.onSurface,
            )
            IconButton(onClick = onToggleMode) {
                when (mode) {
                    AlertMode.ADHAN -> Icon(painterResource(R.drawable.ic_volume), contentDescription = Labels.alert(mode), tint = scheme.primary, modifier = Modifier.size(22.dp))
                    AlertMode.NOTIFICATION -> Icon(Icons.Filled.Notifications, contentDescription = Labels.alert(mode), tint = scheme.secondary, modifier = Modifier.size(22.dp))
                    AlertMode.SILENT -> Icon(painterResource(R.drawable.ic_bell_off), contentDescription = Labels.alert(mode), tint = scheme.onSurfaceVariant, modifier = Modifier.size(22.dp))
                }
            }
        }
    }
}

@Composable
private fun ExtrasCard(times: PrayerTimes, snapshot: PrayerSnapshot, fmt: Format, s: Settings) {
    val items = listOf(
        "الإمساك" to fmt.time(times.imsak, times.zone),
        "منتصف الليل" to fmt.time(times.middleOfNight, times.zone),
        "الثلث الأخير" to fmt.time(times.lastThird, times.zone),
        "اتجاه القبلة" to "${fmt.number(Qibla.bearing(s.coordinates()).toInt())}°",
    )
    Surface(shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surfaceContainer, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Text("أوقات أخرى", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(8.dp))
            items.chunked(2).forEach { row ->
                Row(Modifier.fillMaxWidth()) {
                    row.forEach { (label, value) ->
                        Column(Modifier.weight(1f).padding(vertical = 6.dp)) {
                            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(value, style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }
            }
            Text(
                "طريقة الحساب: ${Labels.method(s.method)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 6.dp),
            )
            if (snapshot.hijri.month == 9) {
                Text("رمضان كريم 🌙 تقبّل الله صيامكم", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
