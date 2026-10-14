package com.ibadalrahman.app.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import androidx.core.graphics.ColorUtils
import com.ibadalrahman.app.R
import com.ibadalrahman.app.data.WidgetTheme
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Decorative layers of the Andalusian widgets: arches, eight-pointed stars, girih lattice and
 * gold hairlines in the brand style. Only the ornament is drawn here; the texts stay live
 * TextViews/Chronometers laid over the bitmap. All sizes are in px, [d] is px per dp.
 *
 * The geometry mirrors the design prototype in art/v2/widgets/widgets.js.
 */
object AndalusArt {

    /** Inner/outer radius of two overlapping squares: the eight-pointed khatam star. */
    private const val KHATAM = 0.7654f

    // ------------------------------------------------------------------------------ colours

    private fun alpha(color: Int, a: Float): Int = ColorUtils.setAlphaComponent(color, (a.coerceIn(0f, 1f) * 255).roundToInt())

    private fun mix(from: Int, to: Int, t: Float): Int = ColorUtils.blendARGB(from, to, t)

    private fun patternAlpha(theme: WidgetTheme): Float = if (theme.isLight) 0.16f else 0.11f

    private fun stroke(color: Int, width: Float) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        this.color = color
        strokeWidth = width
        strokeJoin = Paint.Join.ROUND
    }

    private fun fill(color: Int) = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }

    // ------------------------------------------------------------------------------ geometry

    private fun star16(path: Path, cx: Float, cy: Float, outer: Float, inner: Float, rotation: Double = -PI / 2) {
        for (i in 0 until 16) {
            val a = rotation + PI / 8 * i
            val r = if (i % 2 == 0) outer else inner
            val x = cx + (r * cos(a)).toFloat()
            val y = cy + (r * sin(a)).toFloat()
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close()
    }

    /** Ogee arch, the same curve as archShape() in the app UI. */
    private fun arch(path: Path, x: Float, y: Float, w: Float, h: Float, archHeight: Float, corner: Float) {
        val s = min(archHeight, h * 0.6f)
        val r = min(corner, min(w, h) / 4).coerceAtLeast(0f)
        path.moveTo(x, y + h - r)
        path.lineTo(x, y + s)
        path.cubicTo(x, y + s * 0.35f, x + w * 0.30f, y + s * 0.62f, x + w * 0.44f, y + s * 0.22f)
        path.cubicTo(x + w * 0.475f, y + s * 0.12f, x + w * 0.495f, y + s * 0.04f, x + w * 0.5f, y)
        path.cubicTo(x + w * 0.505f, y + s * 0.04f, x + w * 0.525f, y + s * 0.12f, x + w * 0.56f, y + s * 0.22f)
        path.cubicTo(x + w * 0.70f, y + s * 0.62f, x + w, y + s * 0.35f, x + w, y + s)
        path.lineTo(x + w, y + h - r)
        if (r > 0f) path.quadTo(x + w, y + h, x + w - r, y + h) else path.lineTo(x + w, y + h)
        path.lineTo(x + r, y + h)
        if (r > 0f) path.quadTo(x, y + h, x, y + h - r) else path.lineTo(x, y + h)
        path.close()
    }

    /**
     * Pointed horseshoe arch between [left] and [right], springing at [spring] and open down to
     * [bottom]; [vy] (<= 1) flattens it when the frame is short.
     */
    private fun horseshoe(path: Path, left: Float, right: Float, spring: Float, bottom: Float, vy: Float) {
        val cx = (left + right) / 2
        val rx = (right - left) / 2
        val ry = rx * vy
        val crown = spring - ry * 1.3f
        path.moveTo(left, bottom)
        path.lineTo(left, spring + ry * 0.3f)
        path.cubicTo(left - rx * 0.26f, spring - ry * 0.28f, cx - rx * 0.62f, crown + ry * 0.04f, cx, crown)
        path.cubicTo(cx + rx * 0.62f, crown + ry * 0.04f, right + rx * 0.26f, spring - ry * 0.28f, right, spring + ry * 0.3f)
        path.lineTo(right, bottom)
        path.close()
    }

    /** A band whose two ends close in pointed ogee tips. */
    private fun cartouche(path: Path, x: Float, y: Float, w: Float, h: Float, cap: Float) {
        val m = y + h / 2
        path.moveTo(x + cap, y)
        path.lineTo(x + w - cap, y)
        path.cubicTo(x + w - cap * 0.35f, y, x + w - cap * 0.05f, m - h * 0.22f, x + w, m)
        path.cubicTo(x + w - cap * 0.05f, m + h * 0.22f, x + w - cap * 0.35f, y + h, x + w - cap, y + h)
        path.lineTo(x + cap, y + h)
        path.cubicTo(x + cap * 0.35f, y + h, x + cap * 0.05f, m + h * 0.22f, x, m)
        path.cubicTo(x + cap * 0.05f, m - h * 0.22f, x + cap * 0.35f, y, x + cap, y)
        path.close()
    }

    /** Lattice of eight-pointed stars joined by straight links (GirihPattern in the app UI). */
    private fun girih(canvas: Canvas, w: Float, h: Float, cell: Float, color: Int, lineWidth: Float) {
        val r = cell * 0.42f
        val path = Path()
        var y = 0f
        while (y < h + cell) {
            var x = 0f
            while (x < w + cell) {
                star16(path, x, y, r, r * 0.62f)
                path.moveTo(x + r, y)
                path.lineTo(x + cell - r, y)
                path.moveTo(x, y + r)
                path.lineTo(x, y + cell - r)
                x += cell
            }
            y += cell
        }
        canvas.drawPath(path, stroke(color, lineWidth))
    }

    private fun sparkle(canvas: Canvas, cx: Float, cy: Float, s: Float, color: Int) {
        val k = 0.22f
        val path = Path().apply {
            moveTo(cx, cy - s)
            quadTo(cx + k * s, cy - k * s, cx + s, cy)
            quadTo(cx + k * s, cy + k * s, cx, cy + s)
            quadTo(cx - k * s, cy + k * s, cx - s, cy)
            quadTo(cx - k * s, cy - k * s, cx, cy - s)
            close()
        }
        canvas.drawPath(path, fill(color))
    }

    /** Gold hairlines fading out on both sides of a sparkle. */
    private fun divider(canvas: Canvas, cx: Float, y: Float, half: Float, color: Int, d: Float) {
        for (dir in intArrayOf(-1, 1)) {
            val start = cx + dir * 6 * d
            val end = cx + dir * half
            // Opaque paint: the shader alone carries the colour's alpha (a Paint's alpha multiplies it).
            val paint = stroke(Color.BLACK, 1 * d).apply {
                shader = LinearGradient(cx, y, end, y, color, Color.TRANSPARENT, Shader.TileMode.CLAMP)
            }
            canvas.drawLine(start, y, end, y, paint)
        }
        sparkle(canvas, cx, y, 3.6f * d, color)
    }

    /** Vertical fill: a breath of gold at the top, deepening towards the bottom. */
    private fun verticalFill(theme: WidgetTheme, opacity: Float, h: Float) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        shader = LinearGradient(
            0f, 0f, 0f, h,
            intArrayOf(
                alpha(mix(theme.background, theme.accent, 0.10f), opacity),
                alpha(theme.background, opacity),
                alpha(mix(theme.background, Color.BLACK, if (theme.isLight) 0.04f else 0.18f), opacity),
            ),
            floatArrayOf(0f, 0.55f, 1f),
            Shader.TileMode.CLAMP,
        )
    }

    private fun bitmap(w: Int, h: Int) = Bitmap.createBitmap(w.coerceAtLeast(1), h.coerceAtLeast(1), Bitmap.Config.ARGB_8888)

    // ------------------------------------------------------------------------------ layers

    /** How far the mihrab's apex rises above its shoulders, in the units of [w] and [h]. */
    fun mihrabArchHeight(w: Float, h: Float): Float = min(w * 0.42f, h * 0.40f)

    /** Arch-shaped widget: girih inside, double gold frame, keystone star and a divider. */
    fun mihrab(w: Int, h: Int, d: Float, theme: WidgetTheme, opacity: Float): Bitmap {
        val bmp = bitmap(w, h)
        val canvas = Canvas(bmp)
        val fw = bmp.width.toFloat()
        val fh = bmp.height.toFloat()
        val s = mihrabArchHeight(fw, fh)
        val r = 20 * d
        val outer = Path().also { arch(it, 0f, 0f, fw, fh, s, r) }
        canvas.drawPath(outer, verticalFill(theme, opacity, fh))
        canvas.save()
        canvas.clipPath(outer)
        girih(canvas, fw, fh, 22 * d, alpha(theme.accent, patternAlpha(theme)), 0.8f * d)
        canvas.restore()

        canvas.drawPath(Path().also { arch(it, 0.6f * d, 0.6f * d, fw - 1.2f * d, fh - 1.2f * d, s, r) }, stroke(alpha(theme.accent, 0.55f), 1.2f * d))
        val i1 = 7 * d
        val i2 = 11 * d
        canvas.drawPath(
            Path().also { arch(it, i1, i1, fw - 2 * i1, fh - 2 * i1, s - 5 * d, r - 5 * d) },
            stroke(alpha(theme.accent, 0.92f), 1.4f * d),
        )
        canvas.drawPath(
            Path().also { arch(it, i2, i2, fw - 2 * i2, fh - 2 * i2, s - 8 * d, r - 8 * d) },
            stroke(alpha(theme.accent, 0.45f), 0.8f * d),
        )

        // Keystone star on the apex.
        val keystone = Path().also { star16(it, fw / 2, i1 + 1 * d, 6 * d, 6 * d * KHATAM) }
        canvas.drawPath(keystone, fill(alpha(mix(theme.background, Color.BLACK, 0.1f), max(opacity, 0.9f))))
        canvas.drawPath(keystone, stroke(theme.accent, 1 * d))
        sparkle(canvas, fw / 2, i1 + 1 * d, 2.4f * d, theme.accent)

        if (fh >= 175 * d) divider(canvas, fw / 2, fh - 15 * d, min(52 * d, fw * 0.32f), alpha(theme.accent, 0.75f), d)
        return bmp
    }

    /** Eight-pointed star with a progress ring from the previous prayer to the next. */
    fun star(size: Int, d: Float, theme: WidgetTheme, opacity: Float, progress: Float): Bitmap {
        val bmp = bitmap(size, size)
        val canvas = Canvas(bmp)
        val c = bmp.width / 2f
        val outerR = c - 1 * d
        val outer = Path().also { star16(it, c, c, outerR, outerR * KHATAM) }
        canvas.drawPath(
            outer,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = RadialGradient(
                    c, c * 0.85f, outerR,
                    alpha(mix(theme.background, theme.accent, 0.10f), opacity),
                    alpha(mix(theme.background, Color.BLACK, if (theme.isLight) 0.03f else 0.15f), opacity),
                    Shader.TileMode.CLAMP,
                )
            },
        )
        canvas.save()
        canvas.clipPath(outer)
        girih(canvas, bmp.width.toFloat(), bmp.height.toFloat(), 20 * d, alpha(theme.accent, patternAlpha(theme)), 0.8f * d)
        canvas.restore()

        val rim = outerR - 0.6f * d
        canvas.drawPath(Path().also { star16(it, c, c, rim, rim * KHATAM) }, stroke(alpha(theme.accent, 0.55f), 1.2f * d))
        val innerR = outerR - 7 * d
        canvas.drawPath(Path().also { star16(it, c, c, innerR, innerR * KHATAM) }, stroke(alpha(theme.accent, 0.92f), 1.4f * d))

        // Gold beads on the eight tips.
        val bead = fill(theme.accent)
        for (i in 0 until 8) {
            val a = -PI / 2 + i * PI / 4
            canvas.drawCircle(c + ((outerR - 3.6f * d) * cos(a)).toFloat(), c + ((outerR - 3.6f * d) * sin(a)).toFloat(), 1.4f * d, bead)
        }

        // Progress ring.
        val ringR = outerR * 0.60f
        val ring = RectF(c - ringR, c - ringR, c + ringR, c + ringR)
        val width = 3.4f * d
        canvas.drawArc(ring, 0f, 360f, false, stroke(alpha(theme.text, 0.16f), width))
        val sweep = 360f * progress.coerceIn(0f, 1f)
        if (sweep > 0.5f) {
            canvas.drawArc(ring, -90f, sweep, false, stroke(theme.accent, width).apply { strokeCap = Paint.Cap.ROUND })
        }
        val a = Math.toRadians((sweep - 90f).toDouble())
        val dx = c + (ringR * cos(a)).toFloat()
        val dy = c + (ringR * sin(a)).toFloat()
        canvas.drawCircle(dx, dy, 3.8f * d, fill(theme.accent))
        canvas.drawCircle(dx, dy, 1.6f * d, fill(Color.WHITE))
        return bmp
    }

    /**
     * Arcade of [count] pointed horseshoe arches; bay 0 is the rightmost, like the right-to-left
     * cells laid over it. [highlight] is the bay of the next prayer, or -1.
     */
    fun arcade(w: Int, h: Int, d: Float, theme: WidgetTheme, count: Int, highlight: Int): Bitmap {
        val bmp = bitmap(w, h)
        val canvas = Canvas(bmp)
        val fw = bmp.width.toFloat()
        val fh = bmp.height.toFloat()
        val bay = fw / count
        val col = bay * 0.15f
        val rx = (bay - col) / 2
        val rise = min(rx * 1.3f, fh * 0.40f)
        val vy = rise / (rx * 1.3f)
        val ry = rx * vy
        val spring = max(fh * 0.36f, rise + 6 * d)
        val crown = spring - rise
        fun left(i: Int) = fw - (i + 1) * bay + col / 2
        fun right(i: Int) = fw - i * bay - col / 2

        val openings = List(count) { i -> Path().also { horseshoe(it, left(i), right(i), spring, fh, vy) } }

        // Lattice in the spandrels only.
        val spandrels = Path().apply {
            fillType = Path.FillType.EVEN_ODD
            addRect(0f, 0f, fw, fh, Path.Direction.CW)
            openings.forEach { addPath(it) }
        }
        canvas.save()
        canvas.clipPath(spandrels)
        girih(canvas, fw, fh, 15 * d, alpha(theme.accent, patternAlpha(theme) + 0.03f), 0.7f * d)
        canvas.restore()

        openings.forEachIndexed { i, opening ->
            val on = i == highlight
            val paint = if (on) {
                Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    shader = LinearGradient(
                        0f, 0f, 0f, fh,
                        alpha(theme.accent, if (theme.isLight) 0.30f else 0.34f),
                        alpha(theme.accent, if (theme.isLight) 0.12f else 0.10f),
                        Shader.TileMode.CLAMP,
                    )
                }
            } else {
                fill(alpha(theme.text, if (theme.isLight) 0.05f else 0.045f))
            }
            canvas.drawPath(opening, paint)
            canvas.drawPath(opening, stroke(alpha(theme.accent, if (on) 1f else 0.7f), (if (on) 1.8f else 1.1f) * d))
        }

        // Capitals on the columns, a frieze line above and a base line.
        val capital = fill(alpha(theme.accent, 0.7f))
        for (i in 0..count) {
            val cw = col * if (i == 0 || i == count) 0.9f else 1.6f
            val x = (i * bay - cw / 2).coerceIn(0f, fw - cw)
            val y = spring + ry * 0.3f - 1.2f * d
            canvas.drawRect(x, y, x + cw, y + 2.4f * d, capital)
        }
        val line = fill(alpha(theme.accent, 0.55f))
        canvas.drawRect(0f, 0f, fw, 1 * d, line)
        canvas.drawRect(0f, fh - 1 * d, fw, fh, line)

        if (highlight in 0 until count) {
            val cx = (left(highlight) + right(highlight)) / 2
            canvas.drawPath(Path().also { star16(it, cx, max(4.5f * d, crown - 5.5f * d), 4 * d, 4 * d * KHATAM) }, fill(theme.accent))
        }
        return bmp
    }

    /**
     * Zellige tiles, [cols] x [rows], laid right to left and top to bottom with a 6 dp grout,
     * the same grid as the cells laid over them. [highlight] is the tile of the next prayer.
     */
    fun zellige(w: Int, h: Int, d: Float, theme: WidgetTheme, cols: Int, rows: Int, highlight: Int): Bitmap {
        val bmp = bitmap(w, h)
        val canvas = Canvas(bmp)
        val fw = bmp.width.toFloat()
        val fh = bmp.height.toFloat()
        val gap = 6 * d
        val tw = (fw - (cols - 1) * gap) / cols
        val th = (fh - (rows - 1) * gap) / rows
        val corner = min(9 * d, min(tw, th) / 3)
        for (row in 0 until rows) {
            for (c in 0 until cols) {
                val i = row * cols + c
                val on = i == highlight
                val x = fw - (c + 1) * tw - c * gap
                val y = row * (th + gap)
                val tileRect = RectF(x, y, x + tw, y + th)
                val tile = Path().apply { addRoundRect(tileRect, corner, corner, Path.Direction.CW) }
                canvas.drawPath(tile, fill(if (on) alpha(theme.accent, 0.26f) else alpha(theme.text, 0.05f)))

                canvas.save()
                canvas.clipPath(tile)
                val cx = x + tw / 2
                val cy = y + th / 2
                val r = min(tw, th) * 0.47f
                canvas.drawPath(Path().also { star16(it, cx, cy, r, r * KHATAM) }, stroke(alpha(theme.accent, if (on) 0.55f else 0.24f), 0.9f * d))
                // Interlace: from the star's diagonal tips out to the tile corners.
                val links = Path()
                for (k in 0 until 4) {
                    val a = PI / 4 + k * PI / 2
                    links.moveTo(cx + (r * cos(a)).toFloat(), cy + (r * sin(a)).toFloat())
                    links.lineTo(if (cos(a) > 0) x + tw else x, if (sin(a) > 0) y + th else y)
                }
                canvas.drawPath(links, stroke(alpha(theme.accent, if (on) 0.40f else 0.16f), 0.9f * d))
                canvas.restore()

                canvas.drawPath(tile, stroke(alpha(theme.accent, if (on) 1f else 0.5f), (if (on) 1.6f else 1f) * d))
            }
        }
        return bmp
    }

    /** Horizontal cartouche with the logo in a medallion at its start (right) end. */
    fun cartouche(context: Context, w: Int, h: Int, d: Float, theme: WidgetTheme, opacity: Float): Bitmap {
        val bmp = bitmap(w, h)
        val canvas = Canvas(bmp)
        val fw = bmp.width.toFloat()
        val fh = bmp.height.toFloat()
        val cap = min(fh * 0.34f, 24 * d)
        val outer = Path().also { cartouche(it, 0f, 0f, fw, fh, cap) }
        canvas.drawPath(
            outer,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = LinearGradient(
                    0f, 0f, fw, 0f,
                    intArrayOf(
                        alpha(theme.background, opacity),
                        alpha(mix(theme.background, theme.accent, 0.09f), opacity),
                        alpha(theme.background, opacity),
                    ),
                    floatArrayOf(0f, 0.75f, 1f),
                    Shader.TileMode.CLAMP,
                )
            },
        )
        canvas.save()
        canvas.clipPath(outer)
        girih(canvas, fw, fh, 18 * d, alpha(theme.accent, patternAlpha(theme)), 0.8f * d)
        canvas.restore()

        canvas.drawPath(Path().also { cartouche(it, 0.6f * d, 0.6f * d, fw - 1.2f * d, fh - 1.2f * d, cap) }, stroke(alpha(theme.accent, 0.55f), 1.2f * d))
        val inset = 5 * d
        canvas.drawPath(
            Path().also { cartouche(it, inset, inset, fw - 2 * inset, fh - 2 * inset, (cap - 3 * d).coerceAtLeast(1f)) },
            stroke(alpha(theme.accent, 0.92f), 1.3f * d),
        )

        // Medallion with the logo; always on deep teal so the gold mark reads on every theme.
        val mr = min(MEDALLION_RADIUS_DP * d, fh / 2 - 6 * d)
        val mx = fw - cap - 6 * d - mr
        val my = fh / 2
        val disc = if (theme.isLight) {
            alpha(0xFF0E4D47.toInt(), max(opacity, 0.9f))
        } else {
            alpha(mix(theme.background, Color.BLACK, 0.22f), max(opacity, 0.6f))
        }
        canvas.drawCircle(mx, my, mr, fill(disc))
        canvas.drawCircle(mx, my, mr, stroke(theme.accent, 1.4f * d))
        canvas.drawCircle(mx, my, mr - 3.5f * d, stroke(alpha(theme.accent, 0.5f), 0.8f * d))
        logo(context, (mr * 1.62f).roundToInt())?.let { logo ->
            val ls = mr * 1.62f
            canvas.drawBitmap(logo, null, RectF(mx - ls / 2, my - ls / 2 - 0.5f * d, mx + ls / 2, my + ls / 2 - 0.5f * d), Paint(Paint.FILTER_BITMAP_FLAG))
        }

        // A small star at the far tip.
        canvas.drawPath(Path().also { star16(it, cap * 0.62f + 2 * d, my, 3.6f * d, 3.6f * d * KHATAM) }, fill(alpha(theme.accent, 0.85f)))
        return bmp
    }

    /** Radius of the logo medallion; the cartouche layout reserves room for it at its start. */
    const val MEDALLION_RADIUS_DP = 24f

    @Volatile
    private var logoCache: Pair<Int, Bitmap>? = null

    /** The logo mark decoded close to [size] px (the source is 560 px square). */
    private fun logo(context: Context, size: Int): Bitmap? {
        logoCache?.let { (cached, bmp) -> if (cached == size) return bmp }
        val options = BitmapFactory.Options().apply {
            inSampleSize = Integer.highestOneBit((560 / size.coerceAtLeast(1)).coerceAtLeast(1))
        }
        val bmp = runCatching { BitmapFactory.decodeResource(context.resources, R.drawable.logo_mark, options) }.getOrNull() ?: return null
        logoCache = size to bmp
        return bmp
    }
}
