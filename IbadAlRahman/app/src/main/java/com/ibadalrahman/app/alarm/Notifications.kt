package com.ibadalrahman.app.alarm

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.ibadalrahman.app.MainActivity
import com.ibadalrahman.app.R
import com.ibadalrahman.app.core.Prayer
import com.ibadalrahman.app.data.Settings
import com.ibadalrahman.app.util.Format

object Notifications {
    const val CHANNEL_ADHAN = "adhan"
    const val CHANNEL_PRAYER = "prayer_alert"
    const val CHANNEL_REMINDER = "reminder"
    const val CHANNEL_IQAMA = "iqama"
    const val CHANNEL_STATUS = "status_bar"
    const val CHANNEL_GENERAL = "general"

    const val ID_STATUS = 1001
    const val ID_ADHAN = 1002
    private const val ID_PRAYER_BASE = 2000
    private const val ID_REMINDER_BASE = 3000
    private const val ID_IQAMA_BASE = 4000
    const val ID_KAHF = 5000
    const val ID_SILENT = 5001

    const val DUA_AFTER_ADHAN =
        "اللهم ربَّ هذه الدعوة التامة، والصلاة القائمة، آتِ محمدًا الوسيلة والفضيلة، وابعثه مقامًا محمودًا الذي وعدته."

    fun chimeUri(context: Context): Uri =
        Uri.parse("${ContentResolver.SCHEME_ANDROID_RESOURCE}://${context.packageName}/${R.raw.chime}")

    fun createChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        val notificationAudio = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val adhan = NotificationChannel(CHANNEL_ADHAN, "الأذان", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "إشعار تشغيل الأذان عند دخول وقت الصلاة"
            setSound(null, null) // the audio is played by AdhanService
            enableVibration(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        val prayer = NotificationChannel(CHANNEL_PRAYER, "تنبيه دخول الوقت", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "إشعار بصوت التنبيه عند دخول وقت الصلاة"
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        val reminder = NotificationChannel(CHANNEL_REMINDER, "التذكير قبل الصلاة", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "تذكير قبل دخول وقت الصلاة بالمدة التي تختارها"
            setSound(chimeUri(context), notificationAudio)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        val iqama = NotificationChannel(CHANNEL_IQAMA, "الإقامة", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "تنبيه بموعد إقامة الصلاة"
            setSound(chimeUri(context), notificationAudio)
        }
        val status = NotificationChannel(CHANNEL_STATUS, "العد التنازلي في شريط الحالة", NotificationManager.IMPORTANCE_LOW).apply {
            description = "يعرض الصلاة القادمة والوقت المتبقي بجانب الساعة"
            setShowBadge(false)
            setSound(null, null)
            enableVibration(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        val general = NotificationChannel(CHANNEL_GENERAL, "تذكيرات عامة", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "تذكير سورة الكهف ووضع الصامت أثناء الصلاة"
        }
        nm.createNotificationChannels(listOf(adhan, prayer, reminder, iqama, status, general))
    }

    fun canPost(context: Context): Boolean =
        (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED) &&
            NotificationManagerCompat.from(context).areNotificationsEnabled()

    fun openAppIntent(context: Context, requestCode: Int = 0): PendingIntent = PendingIntent.getActivity(
        context,
        requestCode,
        Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    @SuppressLint("MissingPermission")
    private fun post(context: Context, id: Int, notification: Notification) {
        if (canPost(context)) NotificationManagerCompat.from(context).notify(id, notification)
    }

    private fun base(context: Context, channel: String) = NotificationCompat.Builder(context, channel)
        .setSmallIcon(R.drawable.ic_stat_minaret)
        .setColor(0xFFC9A227.toInt())
        .setContentIntent(openAppIntent(context))
        .setAutoCancel(true)

    /** "It is now time for Dhuhr" with the default notification sound. */
    fun prayerTime(context: Context, prayer: Prayer, time: Long) {
        val s = Settings.get(context)
        val fmt = Format(s)
        val friday = isFriday(s, time)
        val name = Format.prayerName(prayer, friday)
        val title = if (prayer == Prayer.SUNRISE) "طلعت الشمس — انتهى وقت الفجر" else "حان الآن موعد صلاة $name"
        val n = base(context, CHANNEL_PRAYER)
            .setContentTitle(title)
            .setContentText("${s.locationName} • ${fmt.time(time, s.zone())}")
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        post(context, ID_PRAYER_BASE + prayer.ordinal, n)
    }

    fun reminder(context: Context, prayer: Prayer, prayerTime: Long) {
        val s = Settings.get(context)
        val fmt = Format(s)
        val name = Format.prayerName(prayer, isFriday(s, prayerTime))
        val minutesLeft = ((prayerTime - System.currentTimeMillis() + 30_000) / 60_000).toInt().coerceAtLeast(1)
        val text = if (prayer == Prayer.SUNRISE) "يخرج وقت الفجر بعد ${fmt.minutes(minutesLeft)}" else "بقي ${fmt.minutes(minutesLeft)} على أذان $name"
        val n = base(context, CHANNEL_REMINDER)
            .setContentTitle(text)
            .setContentText("${Format.prayerName(prayer, isFriday(s, prayerTime))} ${fmt.time(prayerTime, s.zone())} • ${s.locationName}")
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setTimeoutAfter(minutesLeft * 60_000L + 60_000L)
            .build()
        post(context, ID_REMINDER_BASE + prayer.ordinal, n)
    }

    fun iqama(context: Context, prayer: Prayer) {
        val s = Settings.get(context)
        val name = Format.prayerName(prayer, isFriday(s, System.currentTimeMillis()))
        val n = base(context, CHANNEL_IQAMA)
            .setContentTitle("حان وقت إقامة صلاة $name")
            .setContentText("قد قامت الصلاة")
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setTimeoutAfter(20 * 60_000L)
            .build()
        post(context, ID_IQAMA_BASE + prayer.ordinal, n)
    }

    fun kahf(context: Context) {
        val n = base(context, CHANNEL_GENERAL)
            .setContentTitle("يوم الجمعة المبارك")
            .setContentText("لا تنسَ قراءة سورة الكهف والإكثار من الصلاة على النبي ﷺ")
            .setStyle(
                NotificationCompat.BigTextStyle().bigText(
                    "«من قرأ سورة الكهف في يوم الجمعة أضاء له من النور ما بين الجمعتين». " +
                        "لا تنسَ قراءة سورة الكهف والإكثار من الصلاة على النبي ﷺ.",
                ),
            )
            .build()
        post(context, ID_KAHF, n)
    }

    fun silentActive(context: Context, until: Long) {
        val s = Settings.get(context)
        val restore = PendingIntent.getBroadcast(
            context, 7,
            Intent(context, AlarmReceiver::class.java).setAction(AlarmReceiver.ACTION_RESTORE_RINGER),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val n = base(context, CHANNEL_GENERAL)
            .setContentTitle("تم تفعيل وضع الاهتزاز أثناء الصلاة")
            .setContentText("سيعود الرنين تلقائيًا الساعة ${Format(s).time(until, s.zone())}")
            .setOngoing(true)
            .setAutoCancel(false)
            .setSilent(true)
            .addAction(0, "إعادة الرنين الآن", restore)
            .build()
        post(context, ID_SILENT, n)
    }

    fun cancel(context: Context, id: Int) = NotificationManagerCompat.from(context).cancel(id)

    private fun isFriday(s: Settings, time: Long): Boolean =
        java.time.Instant.ofEpochMilli(time).atZone(s.zone()).dayOfWeek == java.time.DayOfWeek.FRIDAY
}
