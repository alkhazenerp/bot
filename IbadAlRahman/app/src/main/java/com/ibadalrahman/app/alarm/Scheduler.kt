package com.ibadalrahman.app.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.ibadalrahman.app.core.Prayer
import com.ibadalrahman.app.data.AlertMode
import com.ibadalrahman.app.data.PrayerRepository
import com.ibadalrahman.app.data.Settings
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalTime

enum class EventType { ADHAN, REMINDER, IQAMA, SILENT_START, SILENT_END, KAHF, REFRESH }

data class PrayerEvent(val time: Long, val type: EventType, val prayer: Prayer? = null, val prayerTime: Long = time)

/**
 * Keeps exactly one alarm armed: the earliest upcoming event. When it fires, every event due
 * at that moment is handled and the next one is armed. A single chain cannot leave stale alarms
 * behind when the location or settings change.
 */
object Scheduler {
    private const val TAG = "Scheduler"
    private const val GRACE_MILLIS = 10 * 60_000L

    fun events(context: Context, from: Long, to: Long): List<PrayerEvent> {
        val s = Settings.get(context)
        val zone = s.zone()
        val startDate = Instant.ofEpochMilli(from).atZone(zone).toLocalDate().minusDays(1)
        val endDate = Instant.ofEpochMilli(to).atZone(zone).toLocalDate()
        val out = ArrayList<PrayerEvent>()
        var date = startDate
        while (!date.isAfter(endDate)) {
            val times = PrayerRepository.times(context, date)
            for (prayer in Prayer.entries) {
                val t = times[prayer]
                out += PrayerEvent(t, EventType.REFRESH, prayer)
                if (s.alertMode(prayer) != AlertMode.SILENT) out += PrayerEvent(t, EventType.ADHAN, prayer)
                if (s.reminderEnabled && s.reminderFor(prayer) && s.reminderMinutes > 0) {
                    out += PrayerEvent(t - s.reminderMinutes * 60_000L, EventType.REMINDER, prayer, t)
                }
                if (prayer.isSalah && s.iqamaEnabled) {
                    out += PrayerEvent(t + s.iqamaMinutes(prayer) * 60_000L, EventType.IQAMA, prayer, t)
                }
                if (prayer.isSalah && s.silentEnabled) {
                    val start = t + s.silentDelayMinutes * 60_000L
                    out += PrayerEvent(start, EventType.SILENT_START, prayer, t)
                    out += PrayerEvent(start + s.silentDurationMinutes * 60_000L, EventType.SILENT_END, prayer, t)
                }
            }
            if (s.kahfReminder && date.dayOfWeek == DayOfWeek.FRIDAY) {
                out += PrayerEvent(date.atTime(LocalTime.of(9, 0)).atZone(zone).toInstant().toEpochMilli(), EventType.KAHF)
            }
            // New day: refresh widgets and the Hijri date.
            out += PrayerEvent(date.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli(), EventType.REFRESH)
            date = date.plusDays(1)
        }
        return out.filter { it.time in from..to }.sortedBy { it.time }
    }

    fun nextEvent(context: Context, now: Long = System.currentTimeMillis()): PrayerEvent? =
        events(context, now + 1, now + 3 * 24 * 3_600_000L).firstOrNull()

    fun scheduleNext(context: Context) {
        val next = nextEvent(context) ?: return
        arm(context, next.time)
    }

    /** Events that should be handled now; [lastHandled] prevents handling the same event twice. */
    fun dueEvents(context: Context, now: Long, lastHandled: Long): List<PrayerEvent> {
        // A marker in the future means the clock was set back; ignore it rather than skip events.
        val last = if (lastHandled > now + 60_000L) 0L else lastHandled
        val from = maxOf(last + 1, now - 6 * 3_600_000L)
        return events(context, from, now + 1_000).filter { event ->
            // Restoring the ringer is always done, however late; sounds are skipped if very late.
            event.type == EventType.SILENT_END || event.type == EventType.REFRESH || now - event.time <= GRACE_MILLIS
        }
    }

    fun canScheduleExact(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return context.getSystemService(AlarmManager::class.java)?.canScheduleExactAlarms() == true
    }

    private fun arm(context: Context, time: Long) {
        val am = context.getSystemService(AlarmManager::class.java) ?: return
        val operation = PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, AlarmReceiver::class.java).setAction(AlarmReceiver.ACTION_EVENT),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        try {
            when {
                canScheduleExact(context) && Settings.get(context).useAlarmClock ->
                    am.setAlarmClock(AlarmManager.AlarmClockInfo(time, Notifications.openAppIntent(context, 1)), operation)

                canScheduleExact(context) ->
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, operation)

                else -> am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, operation)
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "Exact alarm refused, falling back to inexact", e)
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, operation)
        }
    }
}
