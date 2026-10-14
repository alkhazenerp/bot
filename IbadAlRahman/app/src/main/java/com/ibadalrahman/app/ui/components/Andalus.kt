package com.ibadalrahman.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.ibadalrahman.app.R
import com.ibadalrahman.app.ui.theme.Cream
import com.ibadalrahman.app.ui.theme.Gold
import com.ibadalrahman.app.ui.theme.GoldGradient
import com.ibadalrahman.app.ui.theme.GoldLight
import com.ibadalrahman.app.ui.theme.LocalBrand
import com.ibadalrahman.app.ui.theme.Nastaliq
import com.ibadalrahman.app.ui.theme.Ruqaa
import com.ibadalrahman.app.ui.theme.Teal
import com.ibadalrahman.app.ui.theme.TealDeep
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Card whose top edge is an Andalusian (ogee) arch rising to a pointed apex.
 * [archHeight] is how far the apex rises above the shoulders.
 */
fun archShape(archHeight: Float, cornerRadius: Float = 0f): Shape = GenericShape { size, _ ->
    val w = size.width
    val h = size.height
    val s = archHeight.coerceAtMost(h * 0.6f)
    val r = cornerRadius.coerceAtMost(minOf(w, h) / 4)
    moveTo(0f, h - r)
    lineTo(0f, s)
    cubicTo(0f, s * 0.35f, w * 0.30f, s * 0.62f, w * 0.44f, s * 0.22f)
    cubicTo(w * 0.475f, s * 0.12f, w * 0.495f, s * 0.04f, w * 0.5f, 0f)
    cubicTo(w * 0.505f, s * 0.04f, w * 0.525f, s * 0.12f, w * 0.56f, s * 0.22f)
    cubicTo(w * 0.70f, s * 0.62f, w, s * 0.35f, w, s)
    lineTo(w, h - r)
    if (r > 0f) quadraticTo(w, h, w - r, h) else lineTo(w, h)
    lineTo(r, h)
    if (r > 0f) quadraticTo(0f, h, 0f, h - r)
    close()
}

/** Faint lattice of eight-pointed stars, the classic Andalusian girih pattern. */
@Composable
fun GirihPattern(modifier: Modifier = Modifier, color: Color = LocalBrand.current.pattern, cell: Dp = 34.dp) {
    Canvas(modifier) {
        val c = cell.toPx()
        val r = c * 0.42f
        val star = Path().apply {
            for (i in 0 until 16) {
                val a = PI / 8 * i - PI / 2
                val rr = if (i % 2 == 0) r else r * 0.62f
                val x = (rr * cos(a)).toFloat()
                val y = (rr * sin(a)).toFloat()
                if (i == 0) moveTo(x, y) else lineTo(x, y)
            }
            close()
            moveTo(r, 0f); lineTo(c - r, 0f)
            moveTo(0f, r); lineTo(0f, c - r)
        }
        val stroke = Stroke(width = 1.dp.toPx())
        var y = 0f
        while (y < size.height + c) {
            var x = 0f
            while (x < size.width + c) {
                translate(x, y) { drawPath(star, color, style = stroke) }
                x += c
            }
            y += c
        }
    }
}

/** Gold hairlines with a four-pointed sparkle in the middle, as under the wordmark. */
@Composable
fun OrnamentDivider(modifier: Modifier = Modifier, lineWidth: Dp = 90.dp, color: Color = LocalBrand.current.gold) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
        Box(
            Modifier
                .width(lineWidth)
                .height(1.5.dp)
                .background(Brush.horizontalGradient(listOf(Color.Transparent, color))),
        )
        SparkleStar(Modifier.padding(horizontal = 8.dp).size(14.dp), color)
        Box(
            Modifier
                .width(lineWidth)
                .height(1.5.dp)
                .background(Brush.horizontalGradient(listOf(color, Color.Transparent))),
        )
    }
}

@Composable
fun SparkleStar(modifier: Modifier = Modifier, color: Color = Gold) {
    Canvas(modifier) {
        val cx = size.width / 2
        val cy = size.height / 2
        val s = minOf(size.width, size.height) / 2
        val k = 0.22f
        val p = Path().apply {
            moveTo(cx, cy - s)
            quadraticTo(cx + k * s, cy - k * s, cx + s, cy)
            quadraticTo(cx + k * s, cy + k * s, cx, cy + s)
            quadraticTo(cx - k * s, cy + k * s, cx - s, cy)
            quadraticTo(cx - k * s, cy - k * s, cx, cy - s)
            close()
        }
        drawPath(p, color)
    }
}

/** Logo mark and gold calligraphic wordmark, as in the brand sheet. */
@Composable
fun BrandHeader(modifier: Modifier = Modifier, logoSize: Dp = 64.dp, wordmarkSize: Int = 34) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Image(
            painterResource(R.drawable.logo_mark),
            contentDescription = null,
            modifier = Modifier.size(width = logoSize * 0.74f, height = logoSize),
        )
        Text(
            "عباد الرحمن",
            style = TextStyle(fontFamily = Ruqaa, fontSize = wordmarkSize.sp, brush = GoldGradient, textAlign = TextAlign.Center),
        )
        OrnamentDivider(lineWidth = 70.dp)
    }
}

/** Arcade of horseshoe arches on slender columns, like a courtyard of the Alhambra. */
@Composable
fun ArcadeSilhouette(modifier: Modifier = Modifier, color: Color = Color.Black.copy(alpha = 0.22f)) {
    Canvas(modifier) {
        val w = size.width
        val h = size.height
        val count = 7
        val bay = w / count
        val column = bay * 0.16f
        val springLine = h * 0.42f
        val path = Path().apply {
            moveTo(0f, h)
            lineTo(0f, 0f)
            lineTo(w, 0f)
            lineTo(w, h)
            close()
            for (i in 0 until count) {
                val left = i * bay + column / 2
                val right = (i + 1) * bay - column / 2
                val cx = (left + right) / 2
                val rx = (right - left) / 2
                // Horseshoe opening: vertical jambs, then an arc that swells past its springing line.
                moveTo(left, h)
                lineTo(left, springLine + rx * 0.35f)
                cubicTo(left - rx * 0.18f, springLine - rx * 0.35f, cx - rx * 0.75f, springLine - rx * 1.25f, cx, springLine - rx * 1.25f)
                cubicTo(cx + rx * 0.75f, springLine - rx * 1.25f, right + rx * 0.18f, springLine - rx * 0.35f, right, springLine + rx * 0.35f)
                lineTo(right, h)
                close()
            }
            fillType = androidx.compose.ui.graphics.PathFillType.EvenOdd
        }
        drawPath(path, color)
    }
}

/** Footer dedication shown at the bottom of the settings page. */
@Composable
fun DedicationFooter(modifier: Modifier = Modifier) {
    val brand = LocalBrand.current
    val shape = remember { archShape(archHeight = 120f, cornerRadius = 48f) }
    val background = if (brand.isDark) {
        Brush.verticalGradient(listOf(Color(0xFF145C55), Teal, TealDeep))
    } else {
        Brush.verticalGradient(listOf(Color(0xFFFFFBF2), Cream))
    }
    Box(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(background)
            .border(1.5.dp, Brush.verticalGradient(listOf(GoldLight, Gold, Color(0xFF8E6510))), shape),
    ) {
        GirihPattern(Modifier.matchParentSize(), color = brand.gold.copy(alpha = if (brand.isDark) 0.10f else 0.14f), cell = 30.dp)
        Column(
            Modifier
                .fillMaxWidth()
                .padding(top = 44.dp, bottom = 22.dp, start = 16.dp, end = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            SparkleStar(Modifier.size(16.dp), brand.gold)
            Text(
                "وقف لوجه الله",
                style = TextStyle(
                    fontFamily = Nastaliq,
                    fontSize = 34.sp,
                    lineHeight = 2.3.em,
                    brush = GoldGradient,
                    textAlign = TextAlign.Center,
                ),
            )
            OrnamentDivider(lineWidth = 80.dp)
            Text(
                "عن روح المرحوم محمد أمين كنج الحلبي",
                style = TextStyle(
                    fontFamily = Nastaliq,
                    fontSize = 18.sp,
                    lineHeight = 2.6.em,
                    color = if (brand.isDark) Cream else Teal,
                    textAlign = TextAlign.Center,
                ),
            )
        }
    }
}
