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
import android.util.SizeF
import android.util.TypedValue
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
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Widget styles. [widthDp] x [heightDp] is the size used for previews and when the launcher
 * reports none; [panel] means the layout has the w_bg/w_border rounded panel.
 */
enum class WidgetKind(
    val layout: Int,
    val title: String,
    val description: String,
    val widthDp: Float,
    val heightDp: Float,
    val panel: Boolean = true,
    val andalusian: Boolean = false,
) {
    NEXT(R.layout.widget_next, "الصلاة القادمة", "اسم الصلاة القادمة ووقتها مع عدّاد تنازلي", 150f, 150f),
    TODAY(R.layout.widget_today, "مواقيت اليوم", "جميع أوقات اليوم مع إبراز الصلاة القادمة", 330f, 140f),
    RING(R.layout.widget_ring, "الحلقة", "حلقة تقدّم دائرية بين الصلاتين", 150f, 150f),
    STRIP(R.layout.widget_strip, "الشريط", "شريط أفقي نحيف بجميع الأوقات", 330f, 60f),
    CLOCK(R.layout.widget_clock, "الساعة", "ساعة كبيرة مع التاريخين والصلاة القادمة", 330f, 140f),
    MIHRAB(R.layout.widget_mihrab, "المحراب", "قوس أندلسي مزخرف بالصلاة القادمة والعدّاد", 160f, 190f, panel = false, andalusian = true),
    ARCADE(R.layout.widget_arcade, "رواق الحمراء", "أقواس قصر الحمراء تحمل مواقيت اليوم", 330f, 180f, andalusian = true),
    STAR(R.layout.widget_star, "النجمة الثُّمانية", "نجمة أندلسية بحلقة تقدّم حتى الصلاة القادمة", 170f, 170f, panel = false, andalusian = true),
    ZELLIGE(R.layout.widget_zellige, "الزليج", "بلاطات زليج أندلسية بأوقات اليوم", 260f, 180f, andalusian = true),
    CARTOUCHE(R.layout.widget_cartouche, "اللوحة", "لوحة أفقية بشعار المئذنة والهلال والتاريخ الهجري", 330f, 84f, panel = false, andalusian = true),
    ;

    val providerClass: Class<out AppWidgetProvider>
        get() = when (this) {
            NEXT -> NextPrayerWidget::class.java
            TODAY -> TodayWidget::class.java
            RING -> RingWidget::class.java
            STRIP -> StripWidget::class.java
            CLOCK -> ClockWidget::class.java
            MIHRAB -> MihrabWidget::class.java
            ARCADE -> ArcadeWidget::class.java
            STAR -> StarWidget::class.java
            ZELLIGE -> ZelligeWidget::class.java
            CARTOUCHE -> CartoucheWidget::class.java
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
class MihrabWidget : BaseWidgetProvider(WidgetKind.MIHRAB)
class ArcadeWidget : BaseWidgetProvider(WidgetKind.ARCADE)
class StarWidget : BaseWidgetProvider(WidgetKind.STAR)
class ZelligeWidget : BaseWidgetProvider(WidgetKind.ZELLIGE)
class CartoucheWidget : BaseWidgetProvider(WidgetKind.CARTOUCHE)

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

    // Paddings and header heights of the panel layouts (widget_arcade.xml, widget_zellige.xml):
    // the ornament bitmap is drawn for the frame below the header.
    private const val PANEL_PADDING_DP = 10f
    private const val ARCADE_HEADER_DP = 36f
    private const val ZELLIGE_HEADER_DP = 22f

    fun render(context: Context, kind: WidgetKind, appWidgetId: Int, snapshot: PrayerSnapshot): RemoteViews {
        val prefs = WidgetPrefs(context)
        val theme = prefs.theme(appWidgetId)
        val opacity = prefs.opacity(appWidgetId)
        if (!kind.andalusian) return render(context, kind, theme, opacity, snapshot)
        // The ornament is drawn for an exact size, so send one for each orientation and let the
        // launcher pick: portrait is the narrow width x tall height, landscape the reverse.
        val options = runCatching { AppWidgetManager.getInstance(context).getAppWidgetOptions(appWidgetId) }.getOrNull()
        fun dim(key: String, fallback: Float) = options?.getInt(key)?.takeIf { it > 0 }?.toFloat() ?: fallback
        val portrait = SizeF(dim(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, kind.widthDp), dim(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, kind.heightDp))
        val landscape = SizeF(dim(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, kind.widthDp), dim(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, kind.heightDp))
        return RemoteViews(
            render(context, kind, theme, opacity, snapshot, landscape),
            render(context, kind, theme, opacity, snapshot, portrait),
        )
    }

    /**
     * Builds the widget. [size] (dp) is needed by the Andalusian styles to draw their ornament;
     * [preview] leaves out the click action for the in-app previews.
     */
    fun render(
        context: Context,
        kind: WidgetKind,
        theme: WidgetTheme,
        opacity: Int,
        snapshot: PrayerSnapshot,
        size: SizeF? = null,
        preview: Boolean = false,
    ): RemoteViews {
        val s = Settings.get(context)
        val fmt = Format(s)
        val views = RemoteViews(context.packageName, kind.layout)
        val next = snapshot.status.next
        val nextName = Format.prayerName(next.prayer, snapshot.nextIsFriday)
        val remaining = snapshot.status.remainingMillis(snapshot.now)

        if (kind.panel) {
            // Background colour and transparency.
            views.setInt(R.id.w_bg, "setColorFilter", theme.background)
            views.setInt(R.id.w_bg, "setImageAlpha", (opacity.coerceIn(0, 100) * 255) / 100)
            // Thin gold rim, as on the brand tiles (a neutral rim for the glass theme).
            views.setViewVisibility(R.id.w_border, View.VISIBLE)
            views.setInt(
                R.id.w_border,
                "setColorFilter",
                if (theme == WidgetTheme.GLASS) ColorUtils.setAlphaComponent(theme.text, 90) else ColorUtils.setAlphaComponent(theme.accent, 150),
            )
        }
        if (!preview) views.setOnClickPendingIntent(R.id.widget_root, Notifications.openAppIntent(context, 10 + kind.ordinal))

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
                // Follow the app's 12/24-hour choice rather than the system one.
                val clockFormat = if (s.use24h) "HH:mm" else "h:mm"
                views.setCharSequence(R.id.w_clock, "setFormat12Hour", clockFormat)
                views.setCharSequence(R.id.w_clock, "setFormat24Hour", clockFormat)
                views.setTextColor(R.id.w_date, theme.secondary)
                views.setTextColor(R.id.w_next, theme.accent)
                views.setTextColor(R.id.w_sep, theme.secondary)
                views.setTextColor(R.id.w_location, theme.secondary)
                chrono(R.id.w_chrono)
            }

            WidgetKind.MIHRAB -> {
                val box = size ?: SizeF(kind.widthDp, kind.heightDp)
                val (w, h, d) = canvasSize(context, box)
                views.setImageViewBitmap(R.id.w_art, AndalusArt.mihrab(w, h, d, theme, opacity / 100f))
                // Texts start below the arch's shoulders; on short widgets keep only the essentials.
                val density = context.resources.displayMetrics.density
                val compact = box.height < 176f
                val top = AndalusArt.mihrabArchHeight(box.width, box.height) * 0.75f
                views.setViewPadding(
                    R.id.w_content,
                    (16 * density).roundToInt(),
                    (top * density).roundToInt(),
                    (16 * density).roundToInt(),
                    ((if (compact) 8 else 14) * density).roundToInt(),
                )
                views.setViewVisibility(R.id.w_label, if (compact) View.GONE else View.VISIBLE)
                views.setViewVisibility(R.id.w_date, if (compact) View.GONE else View.VISIBLE)
                views.setTextViewTextSize(R.id.w_name, TypedValue.COMPLEX_UNIT_SP, if (box.height < 150f) 22f else 26f)
                views.setTextViewText(R.id.w_name, nextName)
                views.setTextViewText(R.id.w_time, fmt.time(next.time, snapshot.zone))
                views.setTextViewText(R.id.w_date, fmt.hijri(snapshot.hijri))
                views.setTextColor(R.id.w_label, theme.secondary)
                views.setTextColor(R.id.w_name, theme.text)
                views.setTextColor(R.id.w_time, theme.accent)
                views.setTextColor(R.id.w_date, theme.secondary)
                chrono(R.id.w_chrono)
            }

            WidgetKind.STAR -> {
                val box = size ?: SizeF(kind.widthDp, kind.heightDp)
                val side = minOf(box.width, box.height)
                val (px, _, d) = canvasSize(context, SizeF(side, side))
                views.setImageViewBitmap(R.id.w_art, AndalusArt.star(px, d, theme, opacity / 100f, snapshot.status.progress(snapshot.now)))
                // The ring scales with the star, so must the texts inside it.
                val scale = (side / kind.widthDp).coerceIn(0.7f, 1.15f)
                views.setTextViewTextSize(R.id.w_name, TypedValue.COMPLEX_UNIT_SP, 18f * scale)
                views.setTextViewTextSize(R.id.w_time, TypedValue.COMPLEX_UNIT_SP, 12f * scale)
                views.setTextViewTextSize(R.id.w_chrono, TypedValue.COMPLEX_UNIT_SP, 15f * scale)
                views.setTextViewText(R.id.w_name, nextName)
                views.setTextViewText(R.id.w_time, fmt.time(next.time, snapshot.zone))
                views.setTextColor(R.id.w_name, theme.text)
                views.setTextColor(R.id.w_time, theme.accent)
                chrono(R.id.w_chrono)
            }

            WidgetKind.ARCADE -> {
                val box = size ?: SizeF(kind.widthDp, kind.heightDp)
                val frame = SizeF(
                    (box.width - 2 * PANEL_PADDING_DP).coerceAtLeast(60f),
                    (box.height - 2 * PANEL_PADDING_DP - ARCADE_HEADER_DP).coerceAtLeast(30f),
                )
                val (w, h, d) = canvasSize(context, frame)
                views.setImageViewBitmap(R.id.w_art, AndalusArt.arcade(w, h, d, theme, Prayer.entries.size, highlightIndex(snapshot)))
                bindHeader(views, snapshot, fmt, theme, nextName, withDate = true)
                chrono(R.id.w_chrono)
                bindArtCells(views, snapshot, fmt, theme)
            }

            WidgetKind.ZELLIGE -> {
                val box = size ?: SizeF(kind.widthDp, kind.heightDp)
                val frame = SizeF(
                    (box.width - 2 * PANEL_PADDING_DP).coerceAtLeast(60f),
                    (box.height - 2 * PANEL_PADDING_DP - ZELLIGE_HEADER_DP).coerceAtLeast(30f),
                )
                val (w, h, d) = canvasSize(context, frame)
                views.setImageViewBitmap(R.id.w_art, AndalusArt.zellige(w, h, d, theme, 3, 2, highlightIndex(snapshot)))
                bindHeader(views, snapshot, fmt, theme, nextName, withDate = false)
                chrono(R.id.w_chrono)
                bindArtCells(views, snapshot, fmt, theme)
            }

            WidgetKind.CARTOUCHE -> {
                val box = size ?: SizeF(kind.widthDp, kind.heightDp)
                val (w, h, d) = canvasSize(context, box)
                // Below ~300 dp the weekday/date column would squeeze out the prayer time.
                views.setViewVisibility(R.id.w_dates, if (box.width < 300f) View.GONE else View.VISIBLE)
                views.setImageViewBitmap(R.id.w_art, AndalusArt.cartouche(context, w, h, d, theme, opacity / 100f))
                views.setTextViewText(R.id.w_name, nextName)
                views.setTextViewText(R.id.w_time, fmt.time(next.time, snapshot.zone))
                views.setTextViewText(R.id.w_weekday, Format.weekday(snapshot.date.dayOfWeek))
                views.setTextViewText(R.id.w_date, "${fmt.number(snapshot.hijri.day)} ${snapshot.hijri.monthName}")
                views.setTextColor(R.id.w_name, theme.text)
                views.setTextColor(R.id.w_time, theme.accent)
                views.setTextColor(R.id.w_label, theme.secondary)
                views.setTextColor(R.id.w_weekday, theme.secondary)
                views.setTextColor(R.id.w_date, theme.secondary)
                chrono(R.id.w_chrono)
            }
        }
        return views
    }

    /** Bitmap size in px for [dp], and px per dp: sharp, but within the widget memory budget. */
    private fun canvasSize(context: Context, dp: SizeF): Triple<Int, Int, Float> {
        var d = context.resources.displayMetrics.density.coerceIn(1f, 2.5f)
        val pixels = dp.width * d * dp.height * d
        if (pixels > MAX_ART_PIXELS) d *= sqrt(MAX_ART_PIXELS / pixels)
        return Triple((dp.width * d).roundToInt().coerceAtLeast(1), (dp.height * d).roundToInt().coerceAtLeast(1), d)
    }

    /** About 0.8 MB per ornament bitmap; each widget update carries two (both orientations). */
    private const val MAX_ART_PIXELS = 200_000f

    /** Index of the next prayer in today's row, or -1 when it is not today's (after Isha). */
    private fun highlightIndex(snapshot: PrayerSnapshot): Int {
        val next = snapshot.status.next
        // Before midnight the next prayer may be tomorrow's Fajr: highlight Fajr in today's row then.
        return if (next.dayOffset == 0 || next.prayer == Prayer.FAJR) Prayer.entries.indexOf(next.prayer) else -1
    }

    private fun bindHeader(views: RemoteViews, snapshot: PrayerSnapshot, fmt: Format, theme: WidgetTheme, nextName: String, withDate: Boolean) {
        views.setTextViewText(R.id.w_location, snapshot.locationName)
        views.setTextViewText(R.id.w_next_label, "$nextName بعد")
        views.setTextColor(R.id.w_location, theme.text)
        views.setTextColor(R.id.w_next_label, theme.accent)
        if (withDate) {
            views.setTextViewText(R.id.w_date, "${Format.weekday(snapshot.date.dayOfWeek)} • ${fmt.hijri(snapshot.hijri)}")
            views.setTextColor(R.id.w_date, theme.secondary)
        }
    }

    /** Names and times for the arcade and zellige cells; the highlight is part of the ornament. */
    private fun bindArtCells(views: RemoteViews, snapshot: PrayerSnapshot, fmt: Format, theme: WidgetTheme) {
        val highlight = highlightIndex(snapshot)
        Prayer.entries.forEachIndexed { i, prayer ->
            val on = i == highlight
            views.setTextViewText(NAME_IDS[i], Format.prayerName(prayer, snapshot.isFriday))
            views.setTextViewText(TIME_IDS[i], fmt.time(snapshot.today[prayer], snapshot.zone, withPeriod = false))
            views.setTextColor(NAME_IDS[i], if (on) theme.accent else theme.secondary)
            views.setTextColor(TIME_IDS[i], if (on) theme.accent else theme.text)
        }
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
