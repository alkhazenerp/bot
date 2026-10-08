package com.ibadalrahman.app.ui.qibla

import android.content.Context
import android.graphics.Paint
import android.graphics.Typeface
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.view.Surface as ViewSurface
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.res.ResourcesCompat
import com.ibadalrahman.app.R
import com.ibadalrahman.app.core.Qibla
import com.ibadalrahman.app.ui.components.settings
import com.ibadalrahman.app.ui.theme.Gold
import com.ibadalrahman.app.util.Format
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

@Composable
fun QiblaScreen(modifier: Modifier) {
    val context = LocalContext.current
    val s = settings()
    val fmt = Format(s)
    val coordinates = s.coordinates()
    val bearing = remember(coordinates) { Qibla.bearing(coordinates).toFloat() }
    val distance = remember(coordinates) { Qibla.distanceKm(coordinates) }

    var heading by remember { mutableFloatStateOf(0f) }
    var accuracy by remember { mutableIntStateOf(SensorManager.SENSOR_STATUS_ACCURACY_HIGH) }
    var hasSensor by remember { mutableStateOf(true) }

    DisposableEffect(coordinates) {
        val sm = context.getSystemService(SensorManager::class.java)
        val sensor = sm?.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        if (sm == null || sensor == null) {
            hasSensor = false
            return@DisposableEffect onDispose { }
        }
        val declination = GeomagneticField(
            coordinates.latitude.toFloat(), coordinates.longitude.toFloat(), 0f, System.currentTimeMillis(),
        ).declination
        val listener = object : SensorEventListener {
            private val matrix = FloatArray(9)
            private val orientation = FloatArray(3)
            override fun onSensorChanged(event: SensorEvent) {
                SensorManager.getRotationMatrixFromVector(matrix, event.values)
                SensorManager.getOrientation(matrix, orientation)
                val azimuth = Math.toDegrees(orientation[0].toDouble()).toFloat() + declination + displayRotation(context)
                heading = smoothAngle(heading, normalize(azimuth))
            }

            override fun onAccuracyChanged(sensor: Sensor?, value: Int) {
                accuracy = value
            }
        }
        sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_UI)
        onDispose { sm.unregisterListener(listener) }
    }

    val diff = angleDiff(bearing, heading)
    val aligned = hasSensor && abs(diff) < 3f
    val haptic = LocalHapticFeedback.current
    LaunchedEffect(aligned) { if (aligned) haptic.performHapticFeedback(HapticFeedbackType.LongPress) }

    val scheme = MaterialTheme.colorScheme
    val accent = if (aligned) Color(0xFF2ECC71) else Gold
    val kufi = remember { ResourcesCompat.getFont(context, R.font.tajawal_bold) ?: Typeface.DEFAULT_BOLD }

    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("اتجاه القبلة", style = MaterialTheme.typography.headlineSmall)
        Text(
            when {
                !hasSensor -> "لا يحتوي جهازك على حساس بوصلة؛ استخدم الزاوية أدناه مع بوصلة خارجية."
                aligned -> "أنت متجه نحو الكعبة المشرفة ✓"
                diff > 0 -> "استدر يمينًا ${fmt.number(abs(diff).roundToInt())}°"
                else -> "استدر يسارًا ${fmt.number(abs(diff).roundToInt())}°"
            },
            style = MaterialTheme.typography.titleMedium,
            color = if (aligned) accent else scheme.onSurface,
            textAlign = TextAlign.Center,
        )

        Canvas(
            Modifier
                .fillMaxWidth(0.92f)
                .aspectRatio(1f),
        ) {
            val c = Offset(size.width / 2, size.height / 2)
            val r = size.minDimension / 2 * 0.92f
            val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                textAlign = Paint.Align.CENTER
                typeface = kufi
            }

            // Fixed outer glow ring.
            drawCircle(accent.copy(alpha = 0.12f), radius = r * 1.06f, center = c)
            drawCircle(scheme.surfaceContainerHigh, radius = r, center = c)
            drawCircle(accent.copy(alpha = 0.6f), radius = r, center = c, style = Stroke(3.dp.toPx()))

            // The dial turns opposite to the phone's heading so north stays north.
            rotate(-heading, c) {
                for (deg in 0 until 360 step 5) {
                    val major = deg % 30 == 0
                    val a = Math.toRadians(deg.toDouble())
                    val r1 = r * 0.94f
                    val r2 = if (major) r * 0.84f else r * 0.89f
                    drawLine(
                        if (major) scheme.onSurface else scheme.onSurfaceVariant.copy(alpha = 0.6f),
                        Offset(c.x + (r1 * sin(a)).toFloat(), c.y - (r1 * cos(a)).toFloat()),
                        Offset(c.x + (r2 * sin(a)).toFloat(), c.y - (r2 * cos(a)).toFloat()),
                        strokeWidth = if (major) 2.5.dp.toPx() else 1.dp.toPx(),
                    )
                }
                val cardinals = listOf("ش" to 0, "ق" to 90, "ج" to 180, "غ" to 270)
                textPaint.textSize = r * 0.13f
                for ((label, deg) in cardinals) {
                    val a = Math.toRadians(deg.toDouble())
                    val tr = r * 0.70f
                    textPaint.color = if (deg == 0) Color(0xFFE74C3C).toArgb() else scheme.onSurface.toArgb()
                    drawContext.canvas.nativeCanvas.drawText(
                        label,
                        c.x + (tr * sin(a)).toFloat(),
                        c.y - (tr * cos(a)).toFloat() + textPaint.textSize * 0.35f,
                        textPaint,
                    )
                }
                // Qibla marker: a line from the centre and a small Kaaba at the rim.
                val qa = Math.toRadians(bearing.toDouble())
                val tip = Offset(c.x + (r * 0.78f * sin(qa)).toFloat(), c.y - (r * 0.78f * cos(qa)).toFloat())
                drawLine(accent, c, tip, strokeWidth = 4.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round)
                val k = r * 0.11f
                rotate(bearing, tip) {
                    drawRect(Color(0xFF111111), Offset(tip.x - k / 2, tip.y - k / 2), Size(k, k))
                    drawRect(Gold, Offset(tip.x - k / 2, tip.y - k * 0.22f), Size(k, k * 0.14f))
                }
            }

            // Fixed pointer: where the top of the phone is facing.
            val pointer = Path().apply {
                moveTo(c.x, c.y - r * 1.02f)
                lineTo(c.x - r * 0.06f, c.y - r * 0.88f)
                lineTo(c.x + r * 0.06f, c.y - r * 0.88f)
                close()
            }
            drawPath(pointer, accent)
            drawCircle(accent, radius = r * 0.045f, center = c)
        }

        Surface(shape = RoundedCornerShape(18.dp), color = scheme.surfaceContainer, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("زاوية القبلة: ${fmt.number(bearing.roundToInt())}° من الشمال الجغرافي", style = MaterialTheme.typography.bodyLarge)
                Text("المسافة إلى مكة المكرمة: ${fmt.number(distance.roundToInt())} كم", style = MaterialTheme.typography.bodyMedium)
                Text("الموقع: ${s.locationName}", style = MaterialTheme.typography.bodySmall, color = scheme.onSurfaceVariant)
                if (hasSensor && accuracy <= SensorManager.SENSOR_STATUS_ACCURACY_LOW) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "دقة البوصلة منخفضة: حرّك الهاتف في الهواء على شكل الرقم 8 وابتعد عن المعادن والمغانط.",
                        style = MaterialTheme.typography.bodySmall,
                        color = scheme.error,
                    )
                }
                Text(
                    "ضع الهاتف بشكل مستوٍ للحصول على أدق قراءة.",
                    style = MaterialTheme.typography.bodySmall,
                    color = scheme.onSurfaceVariant,
                )
            }
        }
    }
}

private fun displayRotation(context: Context): Float = when (ContextCompat.getDisplayOrDefault(context).rotation) {
    ViewSurface.ROTATION_90 -> 90f
    ViewSurface.ROTATION_180 -> 180f
    ViewSurface.ROTATION_270 -> 270f
    else -> 0f
}

private fun normalize(angle: Float): Float = ((angle % 360f) + 360f) % 360f

/** Signed shortest rotation from [from] to [to], in -180..180. */
private fun angleDiff(to: Float, from: Float): Float = ((to - from + 540f) % 360f) - 180f

private fun smoothAngle(current: Float, target: Float): Float = normalize(current + angleDiff(target, current) * 0.18f)
