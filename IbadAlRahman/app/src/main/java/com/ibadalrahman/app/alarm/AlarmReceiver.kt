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
            ACTION_RESTORE_RINGER -> {
                SilentMode.restore(context, force = true)
                Scheduler.scheduleNext(context)
            }
        }
    }

    private fun handleDue(context: Context) {
        val s = Settings.get(context)
        val now = System.currentTimeMillis()
        val due = Scheduler.dueEvents(context, now, s.lastHandledEventAt)
        for (event in due) {
            try {
                handle(context, event, late = Scheduler.isLate(event, now))
            } catch (e: Exception) {
                Log.e("AlarmReceiver", "Failed to handle $event", e)
            }
        }
        due.maxOfOrNull { it.time }?.let { s.lastHandledEventAt = it }
        Scheduler.markHandled(context, due, now)
        // Safety net: a silent window that is over must never keep the phone on vibrate.
        if (s.savedRingerMode >= 0 && now >= s.silentUntil - 30_000L) SilentMode.restore(context, force = false)
        // Exact-alarm delivery allows (re)starting foreground services from the background.
        Refresher.refreshAll(context, allowStartService = true)
    }

    /** [late]: delivered well after its time (inexact alarm, Doze), so the adhan is not played. */
    private fun handle(context: Context, event: PrayerEvent, late: Boolean) {
        val s = Settings.get(context)
        val prayer = event.prayer
        when (event.type) {
            EventType.ADHAN -> if (prayer != null) {
                when (s.alertMode(prayer)) {
                    AlertMode.ADHAN ->
                        if (late || prayer == Prayer.SUNRISE || !AdhanService.play(context, prayer, event.time)) {
                            Notifications.prayerTime(context, prayer, event.time)
                        }

                    AlertMode.NOTIFICATION -> Notifications.prayerTime(context, prayer, event.time)
                    AlertMode.SILENT -> Unit
                }
            }

            EventType.REMINDER -> if (prayer != null) Notifications.reminder(context, prayer, event.prayerTime)
            EventType.IQAMA -> if (prayer != null) Notifications.iqama(context, prayer)
            EventType.SILENT_START -> SilentMode.enable(context, event.time + s.silentDurationMinutes * 60_000L)
            EventType.SILENT_END -> SilentMode.restore(context, force = false)
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
        if (s.savedRingerMode >= 0) {
            // Already silenced by us (overlapping windows): just extend the window.
            s.silentUntil = maxOf(s.silentUntil, until)
            Notifications.silentActive(context, s.silentUntil)
            return
        }
        val am = context.getSystemService(AudioManager::class.java) ?: return
        if (am.ringerMode != AudioManager.RINGER_MODE_NORMAL) return // the user already silenced the phone
        try {
            am.ringerMode = AudioManager.RINGER_MODE_VIBRATE
            s.savedRingerMode = AudioManager.RINGER_MODE_NORMAL
            s.appliedRingerMode = am.ringerMode // SILENT on devices without a vibrator
            s.silentUntil = until
            Notifications.silentActive(context, until)
        } catch (e: SecurityException) {
            Log.w("SilentMode", "Ringer mode change not permitted", e)
        }
    }

    /**
     * Gives the ringer back. Unless [force]d (user action, feature turned off), nothing happens
     * while a later, overlapping window is still running.
     */
    fun restore(context: Context, force: Boolean) {
        val s = Settings.get(context)
        val saved = s.savedRingerMode
        if (saved < 0) {
            Notifications.cancel(context, Notifications.ID_SILENT)
            return
        }
        if (!force && System.currentTimeMillis() < s.silentUntil - 30_000L) return
        val am = context.getSystemService(AudioManager::class.java)
        val applied = s.appliedRingerMode.takeIf { it >= 0 } ?: AudioManager.RINGER_MODE_VIBRATE
        try {
            // Only undo our own change: if the user picked another mode meanwhile, leave it.
            if (am != null && am.ringerMode == applied) am.ringerMode = saved
        } catch (e: SecurityException) {
            Log.w("SilentMode", "Ringer mode restore not permitted", e)
        }
        s.savedRingerMode = -1
        s.appliedRingerMode = -1
        s.silentUntil = 0L
        Notifications.cancel(context, Notifications.ID_SILENT)
    }
}

/** Re-arms everything after reboot, app update, clock or time-zone changes. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val s = Settings.get(context)
        val now = System.currentTimeMillis()
        // The clock was moved backwards (beyond small network corrections).
        if (s.lastHandledEventAt > now + 60_000L) s.lastHandledEventAt = now
        if (s.savedRingerMode >= 0 && now > s.silentUntil) SilentMode.restore(context, force = true)
        Refresher.refreshAll(context, allowStartService = true)
    }
}
