package com.ibadalrahman.app.ui.onboarding

import android.Manifest
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ibadalrahman.app.Refresher
import com.ibadalrahman.app.data.LocationHelper
import com.ibadalrahman.app.data.LocationMode
import com.ibadalrahman.app.data.LocationResult
import com.ibadalrahman.app.data.Settings
import com.ibadalrahman.app.ui.settings.AppLogo
import com.ibadalrahman.app.ui.settings.CityList
import com.ibadalrahman.app.ui.settings.applyCity
import com.ibadalrahman.app.ui.theme.EmeraldDark
import com.ibadalrahman.app.ui.theme.Gold
import com.ibadalrahman.app.ui.theme.Ruqaa
import com.ibadalrahman.app.util.Permissions

/** First-run flow: pick automatic or manual location, then allow notifications. */
@Composable
fun OnboardingScreen() {
    val context = LocalContext.current
    val s = remember { Settings.get(context) }
    var pickingCity by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }

    fun finish() {
        s.onboardingDone = true
        Refresher.refreshAll(context, allowStartService = true)
    }

    val notificationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { finish() }

    fun askNotificationsThenFinish() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !Permissions.notificationsGranted(context)) {
            notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            finish()
        }
    }

    fun locate() {
        busy = true
        LocationHelper.updateLocation(context) { result ->
            busy = false
            if (result is LocationResult.Success) {
                s.locationMode = LocationMode.AUTO
                askNotificationsThenFinish()
            } else {
                message = "تعذّر تحديد الموقع تلقائيًا، يمكنك اختيار مدينتك من القائمة."
                pickingCity = true
            }
        }
    }

    val locationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        if (result.values.any { it }) {
            locate()
        } else {
            message = "لا بأس، اختر مدينتك من القائمة."
            pickingCity = true
        }
    }

    if (pickingCity) {
        BackHandler { pickingCity = false }
        Column(
            Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .statusBarsPadding()
                .navigationBarsPadding(),
        ) {
            Box(Modifier.fillMaxWidth().padding(4.dp)) {
                IconButton(onClick = { pickingCity = false }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع") }
                Text("اختر مدينتك", style = MaterialTheme.typography.titleLarge, modifier = Modifier.align(Alignment.Center))
            }
            message?.let {
                Text(it, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(horizontal = 20.dp))
            }
            CityList(onSelect = { city ->
                applyCity(s, city)
                askNotificationsThenFinish()
            })
        }
        return
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF041915), EmeraldDark, Color(0xFF1F7A60)))),
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Spacer(Modifier.height(24.dp))
            AppLogo(Modifier.size(150.dp))
            Spacer(Modifier.height(12.dp))
            Text("عباد الرحمن", style = TextStyle(fontFamily = Ruqaa, fontSize = 52.sp), color = Gold)
            Text(
                "مواقيت الصلاة والأذان، والعد التنازلي للصلاة القادمة بجانب الساعة",
                color = Color.White.copy(alpha = 0.9f),
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(20.dp))
            Text(
                "﴿وَعِبَادُ الرَّحْمَٰنِ الَّذِينَ يَمْشُونَ عَلَى الْأَرْضِ هَوْنًا﴾",
                style = TextStyle(fontFamily = Ruqaa, fontSize = 22.sp),
                color = Color.White,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(36.dp))
            Text(
                "لنبدأ بتحديد موقعك لحساب المواقيت بدقة",
                color = Color.White,
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = {
                    if (LocationHelper.hasPermission(context)) {
                        locate()
                    } else {
                        locationLauncher.launch(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION))
                    }
                },
                enabled = !busy,
                colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Color(0xFF2A1F00)),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
            ) {
                if (busy) {
                    CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Color(0xFF2A1F00))
                } else {
                    Icon(Icons.Filled.LocationOn, contentDescription = null)
                }
                Spacer(Modifier.width(8.dp))
                Text("تحديد موقعي تلقائيًا")
            }
            Spacer(Modifier.height(10.dp))
            OutlinedButton(
                onClick = { pickingCity = true },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
            ) { Text("اختيار المدينة يدويًا") }
            message?.let {
                Spacer(Modifier.height(10.dp))
                Text(it, color = Gold, textAlign = TextAlign.Center)
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}
