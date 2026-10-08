package com.ibadalrahman.app

import android.app.Application
import android.content.Context
import com.ibadalrahman.app.alarm.Notifications
import com.ibadalrahman.app.alarm.Scheduler
import com.ibadalrahman.app.statusbar.PrayerTileService
import com.ibadalrahman.app.statusbar.StatusBarService
import com.ibadalrahman.app.widget.WidgetUpdater

class IbadApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifications.createChannels(this)
    }
}

/** Propagates a change in time, location or settings to every surface of the app. */
object Refresher {
    /**
     * @param allowStartService start the status-bar service if it is not running. Only pass true
     * from contexts where Android allows starting foreground services (UI, boot, exact alarms).
     */
    fun refreshAll(context: Context, allowStartService: Boolean) {
        val app = context.applicationContext
        Scheduler.scheduleNext(app)
        StatusBarService.sync(app, allowStartService)
        WidgetUpdater.updateAll(app)
        PrayerTileService.requestUpdate(app)
    }
}
