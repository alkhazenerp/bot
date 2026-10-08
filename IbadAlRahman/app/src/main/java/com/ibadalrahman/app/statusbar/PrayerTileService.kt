package com.ibadalrahman.app.statusbar

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import com.ibadalrahman.app.MainActivity
import com.ibadalrahman.app.R
import com.ibadalrahman.app.data.PrayerRepository
import com.ibadalrahman.app.data.Settings
import com.ibadalrahman.app.util.Format

/** Quick Settings tile showing the next prayer and the time left. */
class PrayerTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        val tile = qsTile ?: return
        val s = Settings.get(this)
        val fmt = Format(s)
        val snapshot = PrayerRepository.snapshot(this, includeSunrise = s.statusIncludeSunrise)
        val next = snapshot.status.next
        val name = Format.prayerName(next.prayer, snapshot.nextIsFriday)
        tile.label = "$name ${fmt.time(next.time, snapshot.zone)}"
        val remaining = "بعد ${fmt.digits(StatusIconRenderer.hm(snapshot.status.remainingMillis(snapshot.now)))}"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            tile.subtitle = remaining
        } else {
            tile.label = "$name • $remaining"
        }
        tile.icon = Icon.createWithResource(this, R.drawable.ic_stat_minaret)
        tile.state = Tile.STATE_ACTIVE
        tile.updateTile()
    }

    @SuppressLint("StartActivityAndCollapseDeprecated")
    override fun onClick() {
        super.onClick()
        val intent = Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startActivityAndCollapse(
                PendingIntent.getActivity(this, 4, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
            )
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }

    companion object {
        fun requestUpdate(context: Context) {
            runCatching {
                requestListeningState(context, ComponentName(context, PrayerTileService::class.java))
            }
        }
    }
}
