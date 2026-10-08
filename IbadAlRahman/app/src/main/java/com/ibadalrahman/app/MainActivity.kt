package com.ibadalrahman.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.ibadalrahman.app.data.LocationHelper
import com.ibadalrahman.app.data.LocationMode
import com.ibadalrahman.app.data.Settings
import com.ibadalrahman.app.ui.AppRoot

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent { AppRoot() }
    }

    override fun onResume() {
        super.onResume()
        val s = Settings.get(this)
        if (!s.onboardingDone) return
        // Follow the user when travelling: refresh an automatic location older than three hours.
        if (s.locationMode == LocationMode.AUTO && LocationHelper.hasPermission(this) &&
            System.currentTimeMillis() - s.locationUpdatedAt > 3 * 3_600_000L
        ) {
            LocationHelper.updateLocation(this) { Refresher.refreshAll(this, allowStartService = true) }
        }
        Refresher.refreshAll(this, allowStartService = true)
    }
}
