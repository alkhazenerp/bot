package com.ibadalrahman.app.statusbar

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import com.ibadalrahman.app.data.PrayerSnapshot
import com.ibadalrahman.app.data.StatusStyle
import com.ibadalrahman.app.data.StatusTextSize
import com.ibadalrahman.app.util.Format

/**
 * Draws the text that appears next to the clock, the same way network-speed meters do:
 * a white-on-transparent bitmap used as the notification's small icon (the system tints it).
 *
 * The system squeezes the icon into a small square, so the text is fitted to its tight glyph
 * bounds (not the font's ascent/descent) and, for the larger sizes, condensed horizontally so the
 * digits can use almost the full height of the icon, close to the size of the clock digits.
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

    /** Narrowest horizontal scale allowed for each size; narrower glyphs can be drawn taller. */
    private fun minScaleX(size: StatusTextSize): Float = when (size) {
        StatusTextSize.NORMAL -> 1.0f
        StatusTextSize.LARGE -> 0.66f
        StatusTextSize.HUGE -> 0.5f
    }

    fun render(
        lines: Lines,
        textSize: StatusTextSize = StatusTextSize.LARGE,
        size: Int = 192,
        color: Int = Color.WHITE,
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG).apply {
            this.color = color
            textAlign = Paint.Align.LEFT
        }
        val s = size.toFloat()
        val margin = if (textSize == StatusTextSize.NORMAL) s * 0.04f else s * 0.01f
        val minScale = minScaleX(textSize)
        if (lines.secondary == null) {
            paint.typeface = condensedBold
            // Digits have no descenders: let them use most of the height.
            val band = if (textSize == StatusTextSize.NORMAL) 0.62f else 0.80f
            val top = (s - s * band) / 2
            drawFitted(canvas, paint, lines.primary, margin, top, s - margin, top + s * band, minScale)
        } else {
            paint.typeface = condensedBold
            drawFitted(canvas, paint, lines.primary, margin, margin, s - margin, s * 0.60f, minScale)
            paint.typeface = bold
            drawFitted(canvas, paint, lines.secondary, margin, s * 0.68f, s - margin, s - margin, minScale.coerceAtLeast(0.8f))
        }
        return bitmap
    }

    /**
     * Draws [text] so that its tight bounds fill the box [left, top, right, bottom]: as tall as the
     * box allows, condensing horizontally down to [minScaleX] before shrinking the font.
     */
    private fun drawFitted(
        canvas: Canvas,
        paint: Paint,
        text: String,
        left: Float,
        top: Float,
        right: Float,
        bottom: Float,
        minScaleX: Float,
    ) {
        val boxW = right - left
        val boxH = bottom - top
        val bounds = Rect()

        paint.textScaleX = 1f
        paint.textSize = 100f
        paint.getTextBounds(text, 0, text.length, bounds)
        if (bounds.width() <= 0 || bounds.height() <= 0) return

        var textSize = 100f * boxH / bounds.height()
        val naturalWidth = bounds.width() * textSize / 100f
        var scaleX = 1f
        if (naturalWidth > boxW) {
            scaleX = (boxW / naturalWidth).coerceAtLeast(minScaleX)
            if (naturalWidth * scaleX > boxW) textSize *= boxW / (naturalWidth * scaleX)
        }
        paint.textSize = textSize
        paint.textScaleX = scaleX
        paint.getTextBounds(text, 0, text.length, bounds)
        val x = left + (boxW - bounds.width()) / 2f - bounds.left
        val y = top + (boxH - bounds.height()) / 2f - bounds.top
        canvas.drawText(text, x, y, paint)
        paint.textScaleX = 1f
    }
}
