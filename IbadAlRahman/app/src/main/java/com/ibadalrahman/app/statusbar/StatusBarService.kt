package com.ibadalrahman.app.statusbar

import android.app.Notification
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.widget.RemoteViews
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.ibadalrahman.app.R
import com.ibadalrahman.app.alarm.Notifications
import com.ibadalrahman.app.core.Prayer
import com.ibadalrahman.app.data.PrayerRepository
import com.ibadalrahman.app.data.PrayerSnapshot
import com.ibadalrahman.app.data.Settings
import com.ibadalrahman.app.util.Format
import com.ibadalrahman.app.widget.WidgetUpdater

/**
 * Keeps an ongoing notification whose small icon is re-drawn every minute with the time left to
 * the next prayer, so it shows up next to the clock like a network-speed indicator.
 */
class StatusBarService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var lastNextPrayerTime = 0L
    private var lastWidgetUpdate = 0L

    private val tick = object : Runnable {
        override fun run() {
            update()
            scheduleTick()
        }
    }

    private val systemReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_SCREEN_OFF -> handler.removeCallbacks(tick)
                else -> {
                    // Screen on, time or zone changed: redraw immediately and re-align the ticker.
                    handler.removeCallbacks(tick)
                    tick.run()
                }
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_USER_PRESENT)
            addAction(Intent.ACTION_TIME_CHANGED)
            addAction(Intent.ACTION_TIMEZONE_CHANGED)
        }
        ContextCompat.registerReceiver(this, systemReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification(PrayerRepository.snapshot(this, includeSunrise = Settings.get(this).statusIncludeSunrise))
        try {
            ServiceCompat.startForeground(
                this,
                Notifications.ID_STATUS,
                notification,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0,
            )
        } catch (e: Exception) {
            Log.w(TAG, "startForeground failed", e)
            stopSelf()
            return START_NOT_STICKY
        }
        handler.removeCallbacks(tick)
        scheduleTick()
        return START_STICKY
    }

    fun refreshNow() {
        handler.removeCallbacks(tick)
        tick.run()
    }

    private fun scheduleTick() {
        val now = System.currentTimeMillis()
        // Wake up just after the next minute boundary, in step with the clock.
        val delay = 60_000L - (now % 60_000L) + 150L
        handler.postDelayed(tick, delay)
    }

    private fun update() {
        val s = Settings.get(this)
        if (!s.statusBarEnabled) {
            stopSelf()
            return
        }
        val snapshot = PrayerRepository.snapshot(this, includeSunrise = s.statusIncludeSunrise)
        getSystemService(NotificationManager::class.java)?.notify(Notifications.ID_STATUS, buildNotification(snapshot))

        // Widgets only change at prayer boundaries, except the progress ring: refresh every 5 minutes.
        val elapsed = SystemClock.elapsedRealtime()
        if (snapshot.status.next.time != lastNextPrayerTime || elapsed - lastWidgetUpdate > 5 * 60_000L) {
            lastNextPrayerTime = snapshot.status.next.time
            lastWidgetUpdate = elapsed
            WidgetUpdater.updateAll(this)
        }
    }

    private fun buildNotification(snapshot: PrayerSnapshot): Notification {
        val s = Settings.get(this)
        val fmt = Format(s)
        val next = snapshot.status.next
        val nextName = Format.prayerName(next.prayer, snapshot.nextIsFriday)
        val remaining = snapshot.status.remainingMillis(snapshot.now)
        val icon = StatusIconRenderer.render(StatusIconRenderer.lines(s.statusStyle, snapshot, fmt))

        val title = "$nextName ${fmt.time(next.time, snapshot.zone)}"
        val subtitle = "متبقي ${fmt.remainingWords(remaining)} • ${snapshot.locationName}"

        val builder = Notification.Builder(this, Notifications.CHANNEL_STATUS)
            .setSmallIcon(Icon.createWithBitmap(icon))
            .setContentTitle(title)
            .setContentText(subtitle)
            .setContentIntent(Notifications.openAppIntent(this, 3))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCategory(Notification.CATEGORY_STATUS)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setColor(0xFFC9A227.toInt())
            .setCustomContentView(collapsedView(snapshot, fmt, title))
            .setCustomBigContentView(expandedView(snapshot, fmt, title))
            .setStyle(Notification.DecoratedCustomViewStyle())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
        }
        return builder.build()
    }

    private fun collapsedView(snapshot: PrayerSnapshot, fmt: Format, title: String): RemoteViews =
        RemoteViews(packageName, R.layout.notification_collapsed).apply { bindHeader(this, snapshot, fmt, title) }

    private fun expandedView(snapshot: PrayerSnapshot, fmt: Format, title: String): RemoteViews =
        RemoteViews(packageName, R.layout.notification_expanded).apply {
            bindHeader(this, snapshot, fmt, title)
            val nextPrayer = snapshot.status.next.prayer
            val nextIsToday = snapshot.status.next.dayOffset == 0
            Prayer.entries.forEachIndexed { i, prayer ->
                val highlighted = prayer == nextPrayer && (nextIsToday || prayer == Prayer.FAJR)
                setTextViewText(NAME_IDS[i], Format.prayerName(prayer, snapshot.isFriday))
                setTextViewText(TIME_IDS[i], fmt.time(snapshot.today[prayer], snapshot.zone, withPeriod = false))
                setInt(CELL_IDS[i], "setBackgroundResource", if (highlighted) R.drawable.notif_cell_highlight else 0)
            }
            setTextViewText(R.id.n_footer, "${fmt.hijri(snapshot.hijri)} • ${fmt.gregorian(snapshot.date, withWeekday = true)}")
        }

    private fun bindHeader(views: RemoteViews, snapshot: PrayerSnapshot, fmt: Format, title: String) {
        val remaining = snapshot.status.remainingMillis(snapshot.now)
        views.setTextViewText(R.id.n_title, title)
        views.setTextViewText(R.id.n_sub, snapshot.locationName)
        views.setChronometer(R.id.n_chrono, SystemClock.elapsedRealtime() + remaining, null, true)
        views.setChronometerCountDown(R.id.n_chrono, true)
        views.setTextViewText(R.id.n_left_label, "متبقي")
    }

    override fun onDestroy() {
        handler.removeCallbacks(tick)
        runCatching { unregisterReceiver(systemReceiver) }
        if (instance === this) instance = null
        super.onDestroy()
    }

    companion object {
        private const val TAG = "StatusBarService"

        @Volatile
        private var instance: StatusBarService? = null

        private val CELL_IDS = intArrayOf(R.id.n_cell_0, R.id.n_cell_1, R.id.n_cell_2, R.id.n_cell_3, R.id.n_cell_4, R.id.n_cell_5)
        private val NAME_IDS = intArrayOf(R.id.n_name_0, R.id.n_name_1, R.id.n_name_2, R.id.n_name_3, R.id.n_name_4, R.id.n_name_5)
        private val TIME_IDS = intArrayOf(R.id.n_time_0, R.id.n_time_1, R.id.n_time_2, R.id.n_time_3, R.id.n_time_4, R.id.n_time_5)

        val isRunning: Boolean get() = instance != null

        /** Starts, refreshes or stops the service to match the current settings. */
        fun sync(context: Context, allowStart: Boolean) {
            val s = Settings.get(context)
            val running = instance
            if (!s.statusBarEnabled || !Notifications.canPost(context)) {
                if (running != null) context.stopService(Intent(context, StatusBarService::class.java))
                return
            }
            if (running != null) {
                running.handler.post { running.refreshNow() }
            } else if (allowStart) {
                try {
                    ContextCompat.startForegroundService(context, Intent(context, StatusBarService::class.java))
                } catch (e: Exception) {
                    Log.w(TAG, "Not allowed to start the status bar service now", e)
                }
            }
        }
    }
}
