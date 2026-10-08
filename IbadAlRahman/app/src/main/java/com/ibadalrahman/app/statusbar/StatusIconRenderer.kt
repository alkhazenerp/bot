package com.ibadalrahman.app.statusbar

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import com.ibadalrahman.app.data.PrayerSnapshot
import com.ibadalrahman.app.data.StatusStyle
import com.ibadalrahman.app.util.Format

/**
 * Draws the text that appears next to the clock, the same way network-speed meters do:
 * a white-on-transparent bitmap used as the notification's small icon (the system tints it).
 */
object StatusIconRenderer {

    private val condensedBold: Typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
    private val bold: Typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)

    data class Lines(val primary: String, val secondary: String?)

    fun lines(style: StatusStyle, snapshot: PrayerSnapshot, fmt: Format): Lines {
        val next = snapshot.status.next
        val remaining = snapshot.status.remainingMillis(snapshot.now)
        val name = Format.prayerShortName(next.prayer, snapshot.nextIsFriday)
        val countdown = fmt.digits(hm(remaining))
        val time = fmt.time(next.time, snapshot.zone, withPeriod = false)
        return when (style) {
            StatusStyle.NAME_COUNTDOWN -> Lines(countdown, name)
            StatusStyle.COUNTDOWN -> Lines(countdown, null)
            StatusStyle.NAME_TIME -> Lines(time, name)
            StatusStyle.TIME -> Lines(time, null)
        }
    }

    /** "h:mm", rounded up to the next minute so it reaches 0:00 exactly at the adhan. */
    fun hm(millis: Long): String {
        val minutes = (millis.coerceAtLeast(0) + 59_999) / 60_000
        return "${minutes / 60}:${(minutes % 60).toString().padStart(2, '0')}"
    }

    fun render(lines: Lines, size: Int = 128, color: Int = Color.WHITE): Bitmap {
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG).apply {
            this.color = color
            textAlign = Paint.Align.CENTER
        }
        val width = size * 0.98f
        if (lines.secondary == null) {
            paint.typeface = condensedBold
            drawFitted(canvas, paint, lines.primary, size / 2f, 0f, size.toFloat(), width, size * 0.80f)
        } else {
            paint.typeface = condensedBold
            drawFitted(canvas, paint, lines.primary, size / 2f, 0f, size * 0.58f, width, size * 0.62f)
            paint.typeface = bold
            drawFitted(canvas, paint, lines.secondary, size / 2f, size * 0.56f, size.toFloat(), width, size * 0.42f)
        }
        return bitmap
    }

    /** Draws [text] centred inside the band [top, bottom], shrinking it until it fits [maxWidth]. */
    private fun drawFitted(
        canvas: Canvas,
        paint: Paint,
        text: String,
        centerX: Float,
        top: Float,
        bottom: Float,
        maxWidth: Float,
        maxTextSize: Float,
    ) {
        paint.textSize = maxTextSize
        val measured = paint.measureText(text)
        if (measured > maxWidth) paint.textSize = maxTextSize * maxWidth / measured
        val fm = paint.fontMetrics
        // Centre the glyphs' visual box (ascent..descent) inside the band.
        val baseline = (top + bottom) / 2f - (fm.ascent + fm.descent) / 2f
        canvas.drawText(text, centerX, baseline, paint)
    }
}
