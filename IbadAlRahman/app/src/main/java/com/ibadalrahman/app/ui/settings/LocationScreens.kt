package com.ibadalrahman.app.ui.settings

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.ibadalrahman.app.R
import com.ibadalrahman.app.core.CalculationMethod
import com.ibadalrahman.app.data.Cities
import com.ibadalrahman.app.data.City
import com.ibadalrahman.app.data.LocationHelper
import com.ibadalrahman.app.data.LocationMode
import com.ibadalrahman.app.data.LocationResult
import com.ibadalrahman.app.data.Settings
import com.ibadalrahman.app.ui.Labels
import com.ibadalrahman.app.ui.Route
import com.ibadalrahman.app.ui.components.ChoiceDialog
import com.ibadalrahman.app.ui.components.SectionCard
import com.ibadalrahman.app.ui.components.SettingItem
import com.ibadalrahman.app.ui.components.SubPage
import com.ibadalrahman.app.ui.components.rememberApplySettings
import com.ibadalrahman.app.ui.components.settings
import com.ibadalrahman.app.util.Format
import java.time.Instant
import java.time.ZoneId
import java.util.Locale

@Composable
fun SettingsHub(modifier: Modifier, navigate: (Route) -> Unit) {
    val s = settings()
    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("الإعدادات", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(start = 8.dp))
        SectionCard("المواقيت") {
            SettingItem(
                "الموقع والمنطقة",
                "${s.locationName} • ${if (s.locationMode == LocationMode.AUTO) "تلقائي" else "يدوي"}",
                Icons.Filled.LocationOn,
                onClick = { navigate(Route.LOCATION) },
            )
            SettingItem("طريقة الحساب", Labels.method(s.method), Icons.Filled.Build, onClick = { navigate(Route.CALCULATION) })
            SettingItem("تعديل الأوقات يدويًا", "تقديم أو تأخير كل صلاة بالدقائق", Icons.Filled.Edit, onClick = { navigate(Route.ADJUSTMENTS) })
        }
        SectionCard("التنبيهات") {
            SettingItem(
                "الأذان والتنبيهات",
                if (s.adhanName.isNotBlank()) "الأذان: ${s.adhanName}" else "اختيار ملف الأذان، التذكير قبل الصلاة، الإقامة",
                Icons.Filled.Notifications,
                onClick = { navigate(Route.ADHAN) },
            )
            SettingItem(
                "شريط الحالة",
                if (s.statusBarEnabled) "العد التنازلي بجانب الساعة مفعّل" else "متوقف",
                Icons.Filled.Star,
                onClick = { navigate(Route.STATUS_BAR) },
            )
            SettingItem("ضمان عمل الأذان", "الأذونات وتوفير البطارية", Icons.Filled.Lock, onClick = { navigate(Route.RELIABILITY) })
        }
        SectionCard("الشكل") {
            SettingItem("الودجت (أدوات الشاشة الرئيسية)", "خمسة أشكال مع التحكم بالشفافية", Icons.Filled.DateRange, onClick = { navigate(Route.WIDGETS) })
            SettingItem("المظهر", "${Labels.theme(s.themeMode)} • ${if (s.arabicDigits) "أرقام عربية" else "أرقام لاتينية"}", Icons.Filled.Edit, onClick = { navigate(Route.APPEARANCE) })
            SettingItem("حول التطبيق", null, Icons.Filled.Info, onClick = { navigate(Route.ABOUT) })
        }
    }
}

@Composable
fun LocationScreen(onBack: () -> Unit, navigate: (Route) -> Unit) {
    val context = LocalContext.current
    val s = settings()
    val apply = rememberApplySettings()
    val fmt = Format(s)
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var showCoordinates by remember { mutableStateOf(false) }
    var showZones by remember { mutableStateOf(false) }

    fun locate() {
        busy = true
        message = null
        LocationHelper.updateLocation(context) { result ->
            busy = false
            message = when (result) {
                is LocationResult.Success -> "تم تحديد موقعك: ${result.name}"
                LocationResult.NoPermission -> "لم يتم منح إذن الموقع."
                LocationResult.Disabled -> "خدمة الموقع متوقفة في الهاتف، يرجى تفعيلها."
                LocationResult.Unavailable -> "تعذّر تحديد الموقع الآن، حاول مجددًا في مكان مفتوح."
            }
            if (result is LocationResult.Success) {
                s.locationMode = LocationMode.AUTO
                apply()
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        if (result.values.any { it }) locate() else message = "يلزم إذن الموقع للتحديد التلقائي، أو اختر مدينتك يدويًا."
    }

    SubPage("الموقع والمنطقة", onBack) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = s.locationMode == LocationMode.AUTO,
                onClick = {
                    if (LocationHelper.hasPermission(context)) locate()
                    else permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION))
                },
                label = { Text("تلقائي (GPS)") },
                leadingIcon = { Icon(Icons.Filled.LocationOn, contentDescription = null, modifier = Modifier.size(18.dp)) },
            )
            FilterChip(
                selected = s.locationMode == LocationMode.MANUAL,
                onClick = { navigate(Route.CITY_PICKER) },
                label = { Text("يدوي (اختيار مدينة)") },
                leadingIcon = { Icon(Icons.Filled.Place, contentDescription = null, modifier = Modifier.size(18.dp)) },
            )
        }

        SectionCard("الموقع الحالي") {
            SettingItem(
                s.locationName,
                "خط العرض ${"%.4f".format(Locale.US, s.latitude)} • خط الطول ${"%.4f".format(Locale.US, s.longitude)}",
                Icons.Filled.LocationOn,
            )
            SettingItem(
                "المنطقة الزمنية",
                if (s.locationMode == LocationMode.AUTO || s.zoneId.isBlank()) "حسب الجهاز (${ZoneId.systemDefault().id})" else s.zoneId,
                onClick = { showZones = true },
            )
            if (s.locationMode == LocationMode.AUTO && s.locationUpdatedAt > 0) {
                SettingItem(
                    "آخر تحديث",
                    "${fmt.gregorian(Instant.ofEpochMilli(s.locationUpdatedAt).atZone(s.zone()).toLocalDate(), false)} ${fmt.time(s.locationUpdatedAt, s.zone())}",
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Button(
                onClick = {
                    if (LocationHelper.hasPermission(context)) locate()
                    else permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION))
                },
                enabled = !busy,
            ) {
                if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Icon(Icons.Filled.Refresh, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("تحديد موقعي الآن")
            }
            OutlinedButton(onClick = { navigate(Route.CITY_PICKER) }) { Text("اختيار مدينة") }
        }
        OutlinedButton(onClick = { showCoordinates = true }) { Text("إدخال الإحداثيات يدويًا") }
        message?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary) }
        Text(
            "في الوضع التلقائي يتم تحديث الموقع عند فتح التطبيق إذا تغيّر مكانك، لتبقى المواقيت صحيحة أثناء السفر.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }

    if (showCoordinates) {
        CoordinatesDialog(
            onDismiss = { showCoordinates = false },
            onSave = { name, lat, lng ->
                s.locationMode = LocationMode.MANUAL
                s.latitude = lat
                s.longitude = lng
                s.locationName = name
                s.cityId = ""
                val nearest = Cities.nearest(lat, lng, maxKm = 300.0)
                s.countryCode = nearest?.countryCode.orEmpty()
                s.zoneId = nearest?.zoneId ?: ""
                if (s.methodAuto) s.method = CalculationMethod.forCountry(nearest?.countryCode)
                apply()
                showCoordinates = false
            },
        )
    }
    if (showZones) {
        val zones = remember { listOf("") + Cities.all.map { it.zoneId }.distinct().sorted() }
        ChoiceDialog(
            title = "المنطقة الزمنية",
            options = zones,
            selected = if (s.locationMode == LocationMode.AUTO) "" else s.zoneId,
            label = { if (it.isBlank()) "حسب الجهاز" else it },
            onSelect = {
                s.zoneId = it
                if (it.isNotBlank()) s.locationMode = LocationMode.MANUAL
                apply()
            },
            onDismiss = { showZones = false },
        )
    }
}

@Composable
private fun CoordinatesDialog(onDismiss: () -> Unit, onSave: (String, Double, Double) -> Unit) {
    var name by remember { mutableStateOf("") }
    var lat by remember { mutableStateOf("") }
    var lng by remember { mutableStateOf("") }
    val latValue = lat.replace(',', '.').toDoubleOrNull()?.takeIf { it in -90.0..90.0 }
    val lngValue = lng.replace(',', '.').toDoubleOrNull()?.takeIf { it in -180.0..180.0 }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("إدخال الإحداثيات") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("اسم المكان") }, singleLine = true)
                OutlinedTextField(
                    lat, { lat = it }, label = { Text("خط العرض (مثال 21.4225)") }, singleLine = true,
                    isError = lat.isNotEmpty() && latValue == null,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                OutlinedTextField(
                    lng, { lng = it }, label = { Text("خط الطول (مثال 39.8262)") }, singleLine = true,
                    isError = lng.isNotEmpty() && lngValue == null,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = latValue != null && lngValue != null,
                onClick = { onSave(name.ifBlank { "موقع مخصص" }, latValue!!, lngValue!!) },
            ) { Text("حفظ") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } },
    )
}

/** Searchable list of the built-in cities. Used from settings and from onboarding. */
@Composable
fun CityPickerScreen(onBack: () -> Unit, onPicked: () -> Unit) {
    val context = LocalContext.current
    val apply = rememberApplySettings()
    Scaffold(containerColor = MaterialTheme.colorScheme.background) { padding ->
        Column(Modifier.padding(padding)) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 4.dp)) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع") }
                Text("اختيار المدينة", style = MaterialTheme.typography.titleLarge)
            }
            CityList(onSelect = { city ->
                applyCity(Settings.get(context), city)
                apply()
                onPicked()
            })
        }
    }
}

fun applyCity(s: Settings, city: City) {
    s.locationMode = LocationMode.MANUAL
    s.latitude = city.latitude
    s.longitude = city.longitude
    s.locationName = city.name
    s.countryCode = city.countryCode
    s.cityId = city.id
    s.zoneId = city.zoneId
    s.locationUpdatedAt = System.currentTimeMillis()
    if (s.methodAuto) s.method = CalculationMethod.forCountry(city.countryCode)
}

@Composable
fun CityList(onSelect: (City) -> Unit, modifier: Modifier = Modifier) {
    var query by remember { mutableStateOf("") }
    val results = remember(query) { Cities.search(query) }
    val s = settings()
    Column(modifier) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text("ابحث عن مدينة أو دولة…") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
        )
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
            var lastCountry = ""
            results.forEach { city ->
                if (city.country != lastCountry) {
                    lastCountry = city.country
                    item(key = "h_${city.countryCode}") {
                        Text(
                            city.country,
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(start = 20.dp, top = 14.dp, bottom = 4.dp),
                        )
                    }
                }
                item(key = city.id) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(city) }
                            .padding(horizontal = 20.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            painterResource(R.drawable.ic_minaret_gold),
                            contentDescription = null,
                            tint = if (city.id == s.cityId) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(city.name, style = MaterialTheme.typography.bodyLarge)
                            Text(city.zoneId, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        if (city.id == s.cityId) Text("✓", color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
            if (results.isEmpty()) {
                item {
                    Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("لا توجد نتائج", style = MaterialTheme.typography.bodyLarge)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "استخدم التحديد التلقائي أو أدخل الإحداثيات يدويًا من صفحة الموقع.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
