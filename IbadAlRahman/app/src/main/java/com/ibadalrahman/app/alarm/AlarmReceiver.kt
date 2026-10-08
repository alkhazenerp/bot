package com.ibadalrahman.app.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.util.Log
import com.ibadalrahman.app.Refresher
import com.ibadalrahman.app.core.Prayer
import com.ibadalrahman.app.data.AlertMode
import com.ibadalrahman.app.data.Settings

class AlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_EVENT -> handleDue(context)
            ACTION_RESTORE_RINGER -> SilentMode.restore(context)
        }
    }

    private fun handleDue(context: Context) {
        val s = Settings.get(context)
        val now = System.currentTimeMillis()
        val due = Scheduler.dueEvents(context, now, s.lastHandledEventAt)
        for (event in due) {
            try {
                handle(context, event)
            } catch (e: Exception) {
                Log.e("AlarmReceiver", "Failed to handle $event", e)
            }
        }
        due.maxOfOrNull { it.time }?.let { s.lastHandledEventAt = it }
        // Exact-alarm delivery allows (re)starting foreground services from the background.
        Refresher.refreshAll(context, allowStartService = true)
    }

    private fun handle(context: Context, event: PrayerEvent) {
        val s = Settings.get(context)
        val prayer = event.prayer
        when (event.type) {
            EventType.ADHAN -> if (prayer != null) {
                when (s.alertMode(prayer)) {
                    AlertMode.ADHAN ->
                        if (prayer == Prayer.SUNRISE || !AdhanService.play(context, prayer, event.time)) {
                            Notifications.prayerTime(context, prayer, event.time)
                        }

                    AlertMode.NOTIFICATION -> Notifications.prayerTime(context, prayer, event.time)
                    AlertMode.SILENT -> Unit
                }
            }

            EventType.REMINDER -> if (prayer != null) Notifications.reminder(context, prayer, event.prayerTime)
            EventType.IQAMA -> if (prayer != null) Notifications.iqama(context, prayer)
            EventType.SILENT_START -> SilentMode.enable(context, event.time + s.silentDurationMinutes * 60_000L)
            EventType.SILENT_END -> SilentMode.restore(context)
            EventType.KAHF -> Notifications.kahf(context)
            EventType.REFRESH -> Unit
        }
    }

    companion object {
        const val ACTION_EVENT = "com.ibadalrahman.app.action.PRAYER_EVENT"
        const val ACTION_RESTORE_RINGER = "com.ibadalrahman.app.action.RESTORE_RINGER"
    }
}

/** Switches the phone to vibrate during prayer and restores the previous ringer mode afterwards. */
object SilentMode {
    fun enable(context: Context, until: Long) {
        val s = Settings.get(context)
        val am = context.getSystemService(AudioManager::class.java) ?: return
        if (am.ringerMode != AudioManager.RINGER_MODE_NORMAL) return // the user already silenced the phone
        try {
            am.ringerMode = AudioManager.RINGER_MODE_VIBRATE
            s.savedRingerMode = AudioManager.RINGER_MODE_NORMAL
            s.silentUntil = until
            Notifications.silentActive(context, until)
        } catch (e: SecurityException) {
            Log.w("SilentMode", "Ringer mode change not permitted", e)
        }
    }

    fun restore(context: Context) {
        val s = Settings.get(context)
        val saved = s.savedRingerMode
        if (saved >= 0) {
            val am = context.getSystemService(AudioManager::class.java)
            try {
                if (am != null && am.ringerMode == AudioManager.RINGER_MODE_VIBRATE) am.ringerMode = saved
            } catch (e: SecurityException) {
                Log.w("SilentMode", "Ringer mode restore not permitted", e)
            }
        }
        s.savedRingerMode = -1
        s.silentUntil = 0L
        Notifications.cancel(context, Notifications.ID_SILENT)
    }
}

/** Re-arms everything after reboot, app update, clock or time-zone changes. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val s = Settings.get(context)
        val now = System.currentTimeMillis()
        if (s.lastHandledEventAt > now) s.lastHandledEventAt = now // the clock was moved backwards
        if (s.savedRingerMode >= 0 && now > s.silentUntil) SilentMode.restore(context)
        Refresher.refreshAll(context, allowStartService = true)
    }
}
