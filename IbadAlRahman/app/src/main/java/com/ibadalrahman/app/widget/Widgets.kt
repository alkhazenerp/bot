package com.ibadalrahman.app.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import androidx.core.graphics.ColorUtils
import com.ibadalrahman.app.R
import com.ibadalrahman.app.alarm.Notifications
import com.ibadalrahman.app.alarm.Scheduler
import com.ibadalrahman.app.core.Prayer
import com.ibadalrahman.app.data.PrayerRepository
import com.ibadalrahman.app.data.PrayerSnapshot
import com.ibadalrahman.app.data.Settings
import com.ibadalrahman.app.data.WidgetPrefs
import com.ibadalrahman.app.data.WidgetTheme
import com.ibadalrahman.app.util.Format
import kotlin.math.cos
import kotlin.math.sin

enum class WidgetKind(val layout: Int, val title: String, val description: String) {
    NEXT(R.layout.widget_next, "الصلاة القادمة", "اسم الصلاة القادمة ووقتها مع عدّاد تنازلي"),
    TODAY(R.layout.widget_today, "مواقيت اليوم", "جميع أوقات اليوم مع إبراز الصلاة القادمة"),
    RING(R.layout.widget_ring, "الحلقة", "حلقة تقدّم دائرية بين الصلاتين"),
    STRIP(R.layout.widget_strip, "الشريط", "شريط أفقي نحيف بجميع الأوقات"),
    CLOCK(R.layout.widget_clock, "الساعة", "ساعة كبيرة مع التاريخين والصلاة القادمة"),
    ;

    val providerClass: Class<out AppWidgetProvider>
        get() = when (this) {
            NEXT -> NextPrayerWidget::class.java
            TODAY -> TodayWidget::class.java
            RING -> RingWidget::class.java
            STRIP -> StripWidget::class.java
            CLOCK -> ClockWidget::class.java
        }

    companion object {
        fun forProvider(className: String?): WidgetKind? = entries.firstOrNull { it.providerClass.name == className }
    }
}

abstract class BaseWidgetProvider(private val kind: WidgetKind) : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        WidgetUpdater.update(context, kind, appWidgetIds)
        Scheduler.scheduleNext(context) // keep the refresh chain alive
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, appWidgetId: Int, newOptions: Bundle?) {
        WidgetUpdater.update(context, kind, intArrayOf(appWidgetId))
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val prefs = WidgetPrefs(context)
        appWidgetIds.forEach { prefs.delete(it) }
    }
}

class NextPrayerWidget : BaseWidgetProvider(WidgetKind.NEXT)
class TodayWidget : BaseWidgetProvider(WidgetKind.TODAY)
class RingWidget : BaseWidgetProvider(WidgetKind.RING)
class StripWidget : BaseWidgetProvider(WidgetKind.STRIP)
class ClockWidget : BaseWidgetProvider(WidgetKind.CLOCK)

object WidgetUpdater {

    fun updateAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context) ?: return
        var snapshot: PrayerSnapshot? = null
        for (kind in WidgetKind.entries) {
            val ids = manager.getAppWidgetIds(ComponentName(context, kind.providerClass))
            if (ids.isEmpty()) continue
            val snap = snapshot ?: PrayerRepository.snapshot(context).also { snapshot = it }
            ids.forEach { manager.updateAppWidget(it, WidgetRenderer.render(context, kind, it, snap)) }
        }
    }

    fun update(context: Context, kind: WidgetKind, ids: IntArray) {
        if (ids.isEmpty()) return
        val manager = AppWidgetManager.getInstance(context) ?: return
        val snapshot = PrayerRepository.snapshot(context)
        ids.forEach { manager.updateAppWidget(it, WidgetRenderer.render(context, kind, it, snapshot)) }
    }

    fun hasAnyWidget(context: Context): Boolean {
        val manager = AppWidgetManager.getInstance(context) ?: return false
        return WidgetKind.entries.any { manager.getAppWidgetIds(ComponentName(context, it.providerClass)).isNotEmpty() }
    }
}

object WidgetRenderer {

    private val CELL_IDS = intArrayOf(R.id.w_cell_0, R.id.w_cell_1, R.id.w_cell_2, R.id.w_cell_3, R.id.w_cell_4, R.id.w_cell_5)
    private val NAME_IDS = intArrayOf(R.id.w_name_0, R.id.w_name_1, R.id.w_name_2, R.id.w_name_3, R.id.w_name_4, R.id.w_name_5)
    private val TIME_IDS = intArrayOf(R.id.w_time_0, R.id.w_time_1, R.id.w_time_2, R.id.w_time_3, R.id.w_time_4, R.id.w_time_5)

    fun render(context: Context, kind: WidgetKind, appWidgetId: Int, snapshot: PrayerSnapshot): RemoteViews {
        val prefs = WidgetPrefs(context)
        return render(context, kind, prefs.theme(appWidgetId), prefs.opacity(appWidgetId), snapshot)
    }

    fun render(context: Context, kind: WidgetKind, theme: WidgetTheme, opacity: Int, snapshot: PrayerSnapshot): RemoteViews {
        val s = Settings.get(context)
        val fmt = Format(s)
        val views = RemoteViews(context.packageName, kind.layout)
        val next = snapshot.status.next
        val nextName = Format.prayerName(next.prayer, snapshot.nextIsFriday)
        val remaining = snapshot.status.remainingMillis(snapshot.now)

        // Background colour and transparency.
        views.setInt(R.id.w_bg, "setColorFilter", theme.background)
        views.setInt(R.id.w_bg, "setImageAlpha", (opacity.coerceIn(0, 100) * 255) / 100)
        views.setViewVisibility(R.id.w_border, if (theme == WidgetTheme.GLASS || opacity < 35) View.VISIBLE else View.GONE)
        views.setInt(R.id.w_border, "setColorFilter", ColorUtils.setAlphaComponent(theme.text, 90))
        views.setOnClickPendingIntent(R.id.widget_root, Notifications.openAppIntent(context, 10 + kind.ordinal))

        fun chrono(id: Int) {
            views.setChronometer(id, SystemClock.elapsedRealtime() + remaining, null, true)
            views.setChronometerCountDown(id, true)
            views.setTextColor(id, theme.text)
        }

        when (kind) {
            WidgetKind.NEXT -> {
                views.setTextViewText(R.id.w_name, nextName)
                views.setTextViewText(R.id.w_time, fmt.time(next.time, snapshot.zone))
                views.setTextViewText(R.id.w_date, fmt.hijri(snapshot.hijri))
                views.setTextColor(R.id.w_label, theme.secondary)
                views.setTextColor(R.id.w_name, theme.text)
                views.setTextColor(R.id.w_time, theme.accent)
                views.setTextColor(R.id.w_date, theme.secondary)
                chrono(R.id.w_chrono)
            }

            WidgetKind.TODAY -> {
                views.setTextViewText(R.id.w_location, snapshot.locationName)
                views.setTextViewText(R.id.w_date, "${Format.weekday(snapshot.date.dayOfWeek)} • ${fmt.hijri(snapshot.hijri)}")
                views.setTextViewText(R.id.w_next_label, "$nextName بعد")
                views.setTextColor(R.id.w_location, theme.text)
                views.setTextColor(R.id.w_date, theme.secondary)
                views.setTextColor(R.id.w_next_label, theme.accent)
                chrono(R.id.w_chrono)
                bindCells(views, snapshot, fmt, theme)
            }

            WidgetKind.RING -> {
                views.setTextViewText(R.id.w_name, nextName)
                views.setTextViewText(R.id.w_time, fmt.time(next.time, snapshot.zone))
                views.setTextColor(R.id.w_name, theme.text)
                views.setTextColor(R.id.w_time, theme.accent)
                chrono(R.id.w_chrono)
                views.setImageViewBitmap(R.id.w_ring, ringBitmap(snapshot.status.progress(snapshot.now), theme))
            }

            WidgetKind.STRIP -> bindCells(views, snapshot, fmt, theme)

            WidgetKind.CLOCK -> {
                views.setTextViewText(R.id.w_date, "${fmt.gregorian(snapshot.date)} • ${fmt.hijri(snapshot.hijri)}")
                views.setTextViewText(R.id.w_next, "$nextName ${fmt.time(next.time, snapshot.zone)}")
                views.setTextViewText(R.id.w_location, snapshot.locationName)
                views.setTextColor(R.id.w_clock, theme.text)
                views.setTextColor(R.id.w_date, theme.secondary)
                views.setTextColor(R.id.w_next, theme.accent)
                views.setTextColor(R.id.w_sep, theme.secondary)
                views.setTextColor(R.id.w_location, theme.secondary)
                chrono(R.id.w_chrono)
            }
        }
        return views
    }

    private fun bindCells(views: RemoteViews, snapshot: PrayerSnapshot, fmt: Format, theme: WidgetTheme) {
        val next = snapshot.status.next
        // Before midnight the next prayer may be tomorrow's Fajr: highlight Fajr in today's row then.
        Prayer.entries.forEachIndexed { i, prayer ->
            val highlighted = prayer == next.prayer && (next.dayOffset == 0 || prayer == Prayer.FAJR)
            views.setTextViewText(NAME_IDS[i], Format.prayerName(prayer, snapshot.isFriday))
            views.setTextViewText(TIME_IDS[i], fmt.time(snapshot.today[prayer], snapshot.zone, withPeriod = false))
            views.setTextColor(NAME_IDS[i], if (highlighted) theme.accent else theme.secondary)
            views.setTextColor(TIME_IDS[i], if (highlighted) theme.accent else theme.text)
            val background = when {
                !highlighted -> 0
                theme.isLight -> R.drawable.widget_cell_hl_light
                else -> R.drawable.widget_cell_hl_dark
            }
            views.setInt(CELL_IDS[i], "setBackgroundResource", background)
        }
    }

    fun ringBitmap(progress: Float, theme: WidgetTheme, size: Int = 360): Bitmap {
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val stroke = size * 0.065f
        val inset = stroke * 1.2f
        val rect = RectF(inset, inset, size - inset, size - inset)
        val track = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = stroke
            color = ColorUtils.setAlphaComponent(theme.text, 45)
        }
        canvas.drawArc(rect, 0f, 360f, false, track)

        // Twelve faint ticks, like a clock face.
        val tick = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            strokeWidth = stroke * 0.18f
            color = ColorUtils.setAlphaComponent(theme.text, 70)
            strokeCap = Paint.Cap.ROUND
        }
        val cx = size / 2f
        val r = rect.width() / 2f
        for (i in 0 until 12) {
            val a = Math.toRadians(i * 30.0)
            val r1 = r - stroke * 1.0f
            val r2 = r - stroke * 1.45f
            canvas.drawLine(
                cx + (r1 * sin(a)).toFloat(), cx - (r1 * cos(a)).toFloat(),
                cx + (r2 * sin(a)).toFloat(), cx - (r2 * cos(a)).toFloat(), tick,
            )
        }

        val sweep = 360f * progress.coerceIn(0f, 1f)
        val arc = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = stroke
            strokeCap = Paint.Cap.ROUND
            color = theme.accent
        }
        if (sweep > 0.5f) canvas.drawArc(rect, -90f, sweep, false, arc)

        val angle = Math.toRadians((sweep - 90f).toDouble())
        val dotX = cx + (r * cos(angle)).toFloat()
        val dotY = cx + (r * sin(angle)).toFloat()
        canvas.drawCircle(dotX, dotY, stroke * 0.85f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = theme.accent })
        canvas.drawCircle(dotX, dotY, stroke * 0.38f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE })
        return bitmap
    }
}
