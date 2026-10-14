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
import java.time.ZoneId

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
    /** A late adhan becomes a plain notification for this long instead of being dropped. */
    private const val LATE_NOTICE_MILLIS = 70 * 60_000L
    private const val DAY_MILLIS = 24 * 3_600_000L

    fun events(context: Context, from: Long, to: Long): List<PrayerEvent> {
        val s = Settings.get(context)
        val zone = s.zone()
        val startDate = Instant.ofEpochMilli(from).atZone(zone).toLocalDate().minusDays(1)
        // One day past the window: a reminder before an early Fajr falls on the previous evening.
        val endDate = Instant.ofEpochMilli(to).atZone(zone).toLocalDate().plusDays(1)
        val out = ArrayList<PrayerEvent>()
        // Whatever the settings say now, a ringer we silenced must be given back.
        if (s.savedRingerMode >= 0 && s.silentUntil > 0) out += PrayerEvent(s.silentUntil, EventType.SILENT_END)
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
        events(context, now + 1, now + 3 * DAY_MILLIS).firstOrNull()

    /**
     * Arms the earliest event not yet handled, even if its time has passed: an alarm that is due but
     * not delivered yet (inexact alarms, Doze) must not be replaced by a later one when the app or a
     * widget re-arms the chain.
     */
    fun scheduleNext(context: Context) {
        val s = Settings.get(context)
        val now = System.currentTimeMillis()
        // First run: nothing from before the install should fire.
        if (s.lastHandledEventAt <= 0L) s.lastHandledEventAt = now
        val zone = s.zone()
        val handled = handledKeys(context, now)
        val next = events(context, windowStart(s.lastHandledEventAt, now), now + 3 * DAY_MILLIS)
            .firstOrNull { isPending(it, zone, handled, now) } ?: return
        arm(context, maxOf(next.time, now))
    }

    /**
     * Events that should be handled now. [lastHandled] bounds the scan, and the per-occurrence keys
     * stop a prayer that moved a little later (manual offset, new location) from sounding twice.
     */
    fun dueEvents(context: Context, now: Long, lastHandled: Long): List<PrayerEvent> {
        val zone = Settings.get(context).zone()
        val handled = handledKeys(context, now)
        return events(context, windowStart(lastHandled, now), now + 1_000).filter { isPending(it, zone, handled, now) }
    }

    /** True when the event is handled after its time, so only a silent notice makes sense. */
    fun isLate(event: PrayerEvent, now: Long): Boolean = now - event.time > GRACE_MILLIS

    private fun windowStart(lastHandled: Long, now: Long): Long {
        // A marker in the future means the clock was set back; ignore it rather than skip events.
        val last = if (lastHandled > now + 60_000L) 0L else lastHandled
        return maxOf(last + 1, now - 6 * 3_600_000L)
    }

    private fun isPending(event: PrayerEvent, zone: ZoneId, handled: Map<String, Long>, now: Long): Boolean {
        val key = eventKey(event, zone)
        if (key != null && key in handled) return false
        val late = now - event.time
        return when (event.type) {
            // Restoring the ringer and refreshing are always done, however late.
            EventType.SILENT_END, EventType.REFRESH -> true
            EventType.ADHAN -> late <= LATE_NOTICE_MILLIS
            // A late reminder is still useful while the prayer has not come yet.
            EventType.REMINDER -> late <= GRACE_MILLIS || now < event.prayerTime
            EventType.KAHF -> late <= 3 * 3_600_000L
            else -> late <= GRACE_MILLIS
        }
    }

    /** Identity of one occurrence (type, prayer, local date); null for idempotent events. */
    fun eventKey(event: PrayerEvent, zone: ZoneId): String? = when (event.type) {
        EventType.REFRESH, EventType.SILENT_END -> null
        else -> "${event.type}:${event.prayer?.name.orEmpty()}:${Instant.ofEpochMilli(event.prayerTime).atZone(zone).toLocalDate()}"
    }

    fun markHandled(context: Context, events: List<PrayerEvent>, now: Long) {
        val s = Settings.get(context)
        val zone = s.zone()
        val map = handledKeys(context, now).toMutableMap()
        events.forEach { e -> eventKey(e, zone)?.let { map[it] = e.time } }
        s.handledEvents = map.entries.joinToString(";") { "${it.key}=${it.value}" }
    }

    /** Handled keys from the last three days. */
    private fun handledKeys(context: Context, now: Long): Map<String, Long> =
        Settings.get(context).handledEvents.split(';').mapNotNull { entry ->
            val i = entry.lastIndexOf('=')
            if (i <= 0) return@mapNotNull null
            val time = entry.substring(i + 1).toLongOrNull() ?: return@mapNotNull null
            if (now - time > 3 * 24 * 3_600_000L) null else entry.substring(0, i) to time
        }.toMap()

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
