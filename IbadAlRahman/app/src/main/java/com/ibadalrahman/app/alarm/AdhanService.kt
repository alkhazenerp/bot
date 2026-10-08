package com.ibadalrahman.app.alarm

import android.annotation.SuppressLint
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.ibadalrahman.app.R
import com.ibadalrahman.app.core.Prayer
import com.ibadalrahman.app.data.Settings
import com.ibadalrahman.app.util.Format
import java.time.DayOfWeek
import java.time.Instant

/** Plays the adhan as a media-playback foreground service so it survives Doze and app death. */
class AdhanService : Service() {

    private var player: MediaPlayer? = null
    private var focusRequest: AudioFocusRequest? = null
    private var screenReceiver: BroadcastReceiver? = null
    private var startedAt = 0L
    private var currentPrayer: Prayer = Prayer.DHUHR
    private var currentTime = 0L
    private var preview = false
    private val handler = Handler(Looper.getMainLooper())
    private val timeout = Runnable { finish(keepNotification = !preview) }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY, ACTION_PREVIEW -> {
                preview = intent.action == ACTION_PREVIEW
                currentPrayer = Settings.enumValue(intent.getStringExtra(EXTRA_PRAYER), Prayer.DHUHR)
                currentTime = intent.getLongExtra(EXTRA_TIME, System.currentTimeMillis())
                ServiceCompat.startForeground(
                    this,
                    Notifications.ID_ADHAN,
                    buildNotification(playing = true),
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK else 0,
                )
                startPlayback(intent.getStringExtra(EXTRA_URI))
            }

            else -> finish(keepNotification = false) // ACTION_STOP (button or swipe)
        }
        return START_NOT_STICKY
    }

    private fun startPlayback(overrideUri: String?) {
        releasePlayer()
        val s = Settings.get(this)
        val uri = overrideUri ?: if (currentPrayer == Prayer.FAJR && s.fajrAdhanUri.isNotBlank()) s.fajrAdhanUri else s.adhanUri
        val attributes = AudioAttributes.Builder()
            .setUsage(if (s.adhanUseAlarmStream) AudioAttributes.USAGE_ALARM else AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()

        val mp = MediaPlayer()
        player = mp
        mp.setAudioAttributes(attributes)
        if (!setSource(mp, uri)) {
            mp.reset()
            mp.setAudioAttributes(attributes)
            if (!setSource(mp, "")) return finish(keepNotification = false)
        }
        val volume = (s.adhanVolume.coerceIn(0, 100) / 100f)
        mp.setVolume(volume, volume)
        mp.setOnCompletionListener { finish(keepNotification = !preview) }
        mp.setOnErrorListener { _, what, extra ->
            Log.w(TAG, "MediaPlayer error $what/$extra")
            finish(keepNotification = !preview)
            true
        }
        mp.setOnPreparedListener {
            requestFocus(attributes)
            it.start()
            startedAt = SystemClock.elapsedRealtime()
        }
        mp.prepareAsync()

        if (s.adhanVibrate && !preview) vibrate()
        if (s.adhanStopOnScreenOff) registerScreenReceiver()
        handler.removeCallbacks(timeout)
        handler.postDelayed(timeout, MAX_DURATION_MS)
    }

    private fun setSource(mp: MediaPlayer, uri: String): Boolean = try {
        if (uri.isNotBlank()) {
            mp.setDataSource(this, Uri.parse(uri))
        } else {
            resources.openRawResourceFd(R.raw.adhan_default).use { afd ->
                mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            }
        }
        true
    } catch (e: Exception) {
        Log.w(TAG, "Cannot open adhan source '$uri'", e)
        false
    }

    private fun requestFocus(attributes: AudioAttributes) {
        val am = getSystemService(AudioManager::class.java) ?: return
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener { change ->
                if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                    finish(keepNotification = !preview)
                }
            }
            .build()
        focusRequest = request
        am.requestAudioFocus(request)
    }

    /** Pressing the power button (screen turning on or off) silences the adhan. */
    private fun registerScreenReceiver() {
        if (screenReceiver != null) return
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (SystemClock.elapsedRealtime() - startedAt > 1_500 && startedAt > 0) {
                    finish(keepNotification = !preview)
                }
            }
        }
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
        }
        ContextCompat.registerReceiver(this, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
        screenReceiver = receiver
    }

    private fun vibrate() {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Vibrator::class.java)
        }
        vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 400, 250, 400, 250, 700), -1))
    }

    private fun buildNotification(playing: Boolean): Notification {
        val s = Settings.get(this)
        val fmt = Format(s)
        val friday = Instant.ofEpochMilli(currentTime).atZone(s.zone()).dayOfWeek == DayOfWeek.FRIDAY
        val name = Format.prayerName(currentPrayer, friday)
        val stop = PendingIntent.getService(
            this, 0, Intent(this, AdhanService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val title = when {
            preview -> "تجربة صوت الأذان"
            playing -> "حان الآن موعد أذان $name"
            else -> "حان وقت صلاة $name"
        }
        val text = "${s.locationName} • ${fmt.time(currentTime, s.zone())}"
        val builder = NotificationCompat.Builder(this, Notifications.CHANNEL_ADHAN)
            .setSmallIcon(R.drawable.ic_stat_minaret)
            .setColor(0xFFC9A227.toInt())
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(Notifications.openAppIntent(this, 2))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSilent(true)
        if (s.adhanShowDua && !preview) {
            builder.setStyle(NotificationCompat.BigTextStyle().bigText("$text\n\nدعاء ما بعد الأذان:\n${Notifications.DUA_AFTER_ADHAN}"))
        }
        if (playing) {
            builder.setOngoing(true)
                .setDeleteIntent(stop)
                .addAction(R.drawable.ic_stop, "إيقاف الأذان", stop)
        } else {
            builder.setAutoCancel(true)
        }
        return builder.build()
    }

    @SuppressLint("MissingPermission")
    private fun finish(keepNotification: Boolean) {
        handler.removeCallbacks(timeout)
        releasePlayer()
        screenReceiver?.let { runCatching { unregisterReceiver(it) } }
        screenReceiver = null
        focusRequest?.let { getSystemService(AudioManager::class.java)?.abandonAudioFocusRequest(it) }
        focusRequest = null
        if (keepNotification && Notifications.canPost(this)) {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH)
            NotificationManagerCompat.from(this).notify(Notifications.ID_ADHAN, buildNotification(playing = false))
        } else {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        }
        stopSelf()
    }

    private fun releasePlayer() {
        player?.let {
            runCatching { if (it.isPlaying) it.stop() }
            it.release()
        }
        player = null
    }

    override fun onDestroy() {
        handler.removeCallbacks(timeout)
        releasePlayer()
        screenReceiver?.let { runCatching { unregisterReceiver(it) } }
        screenReceiver = null
        super.onDestroy()
    }

    companion object {
        private const val TAG = "AdhanService"
        private const val MAX_DURATION_MS = 12 * 60_000L
        const val ACTION_PLAY = "com.ibadalrahman.app.action.PLAY_ADHAN"
        const val ACTION_PREVIEW = "com.ibadalrahman.app.action.PREVIEW_ADHAN"
        const val ACTION_STOP = "com.ibadalrahman.app.action.STOP_ADHAN"
        private const val EXTRA_PRAYER = "prayer"
        private const val EXTRA_TIME = "time"
        private const val EXTRA_URI = "uri"

        /** Returns false when Android refused to start the service (caller falls back to a notification). */
        fun play(context: Context, prayer: Prayer, time: Long): Boolean = start(
            context,
            Intent(context, AdhanService::class.java)
                .setAction(ACTION_PLAY)
                .putExtra(EXTRA_PRAYER, prayer.name)
                .putExtra(EXTRA_TIME, time),
        )

        /** Plays [uri] (or the configured adhan when null) so the user can test the sound. */
        fun preview(context: Context, uri: String?): Boolean = start(
            context,
            Intent(context, AdhanService::class.java)
                .setAction(ACTION_PREVIEW)
                .putExtra(EXTRA_PRAYER, Prayer.DHUHR.name)
                .putExtra(EXTRA_TIME, System.currentTimeMillis())
                .apply { if (uri != null) putExtra(EXTRA_URI, uri) },
        )

        fun stop(context: Context) {
            context.stopService(Intent(context, AdhanService::class.java))
            Notifications.cancel(context, Notifications.ID_ADHAN)
        }

        private fun start(context: Context, intent: Intent): Boolean = try {
            ContextCompat.startForegroundService(context, intent)
            true
        } catch (e: Exception) {
            Log.w(TAG, "Cannot start adhan service", e)
            false
        }
    }
}
