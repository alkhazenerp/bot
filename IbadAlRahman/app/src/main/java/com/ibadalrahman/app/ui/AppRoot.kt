package com.ibadalrahman.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.ibadalrahman.app.R
import com.ibadalrahman.app.data.Settings
import com.ibadalrahman.app.ui.components.LocalSettingsVersion
import com.ibadalrahman.app.ui.home.HomeScreen
import com.ibadalrahman.app.ui.month.MonthScreen
import com.ibadalrahman.app.ui.onboarding.OnboardingScreen
import com.ibadalrahman.app.ui.qibla.QiblaScreen
import com.ibadalrahman.app.ui.settings.AboutScreen
import com.ibadalrahman.app.ui.settings.AdhanSettingsScreen
import com.ibadalrahman.app.ui.settings.AdjustmentsScreen
import com.ibadalrahman.app.ui.settings.AppearanceScreen
import com.ibadalrahman.app.ui.settings.CalculationScreen
import com.ibadalrahman.app.ui.settings.CityPickerScreen
import com.ibadalrahman.app.ui.settings.LocationScreen
import com.ibadalrahman.app.ui.settings.ReliabilityScreen
import com.ibadalrahman.app.ui.settings.SettingsHub
import com.ibadalrahman.app.ui.settings.StatusBarScreen
import com.ibadalrahman.app.ui.settings.WidgetSettingsScreen
import com.ibadalrahman.app.ui.tasbih.TasbihScreen
import com.ibadalrahman.app.ui.theme.IbadTheme

enum class Tab { HOME, QIBLA, MONTH, TASBIH, SETTINGS }

enum class Route { LOCATION, CITY_PICKER, CALCULATION, ADJUSTMENTS, ADHAN, STATUS_BAR, WIDGETS, APPEARANCE, RELIABILITY, ABOUT }

@Composable
fun AppRoot() {
    val context = LocalContext.current
    val settings = remember { Settings.get(context) }
    val version by settings.version.collectAsState()
    CompositionLocalProvider(LocalSettingsVersion provides version) {
        IbadTheme(settings.themeMode) {
            if (!settings.onboardingDone) OnboardingScreen() else MainScaffold()
        }
    }
}

@Composable
private fun MainScaffold() {
    var tab by rememberSaveable { mutableStateOf(Tab.HOME) }
    val stack = remember { mutableStateListOf<Route>() }
    val navigate: (Route) -> Unit = { stack.add(it) }
    val back: () -> Unit = { if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex) }

    BackHandler(enabled = stack.isNotEmpty()) { back() }
    BackHandler(enabled = stack.isEmpty() && tab != Tab.HOME) { tab = Tab.HOME }

    if (stack.isNotEmpty()) {
        when (stack.last()) {
            Route.LOCATION -> LocationScreen(onBack = back, navigate = navigate)
            Route.CITY_PICKER -> CityPickerScreen(onBack = back, onPicked = back)
            Route.CALCULATION -> CalculationScreen(onBack = back)
            Route.ADJUSTMENTS -> AdjustmentsScreen(onBack = back)
            Route.ADHAN -> AdhanSettingsScreen(onBack = back)
            Route.STATUS_BAR -> StatusBarScreen(onBack = back)
            Route.WIDGETS -> WidgetSettingsScreen(onBack = back)
            Route.APPEARANCE -> AppearanceScreen(onBack = back)
            Route.RELIABILITY -> ReliabilityScreen(onBack = back)
            Route.ABOUT -> AboutScreen(onBack = back)
        }
        return
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                val colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.onPrimary,
                    indicatorColor = MaterialTheme.colorScheme.primary,
                )
                NavigationBarItem(
                    selected = tab == Tab.HOME, onClick = { tab = Tab.HOME }, colors = colors,
                    icon = { Icon(Icons.Filled.Home, contentDescription = null) }, label = { Text("الرئيسية") },
                )
                NavigationBarItem(
                    selected = tab == Tab.QIBLA, onClick = { tab = Tab.QIBLA }, colors = colors,
                    icon = { Icon(painterResource(R.drawable.ic_compass), contentDescription = null, modifier = Modifier.size(24.dp)) },
                    label = { Text("القبلة") },
                )
                NavigationBarItem(
                    selected = tab == Tab.MONTH, onClick = { tab = Tab.MONTH }, colors = colors,
                    icon = { Icon(Icons.Filled.DateRange, contentDescription = null) }, label = { Text("الشهر") },
                )
                NavigationBarItem(
                    selected = tab == Tab.TASBIH, onClick = { tab = Tab.TASBIH }, colors = colors,
                    icon = { Icon(painterResource(R.drawable.ic_tasbih), contentDescription = null, modifier = Modifier.size(24.dp)) },
                    label = { Text("المسبحة") },
                )
                NavigationBarItem(
                    selected = tab == Tab.SETTINGS, onClick = { tab = Tab.SETTINGS }, colors = colors,
                    icon = { Icon(Icons.Filled.Settings, contentDescription = null) }, label = { Text("الإعدادات") },
                )
            }
        },
    ) { padding ->
        val modifier = Modifier.padding(padding)
        when (tab) {
            Tab.HOME -> HomeScreen(modifier, navigate)
            Tab.QIBLA -> QiblaScreen(modifier)
            Tab.MONTH -> MonthScreen(modifier)
            Tab.TASBIH -> TasbihScreen(modifier)
            Tab.SETTINGS -> SettingsHub(modifier, navigate)
        }
    }
}
