package com.ibadalrahman.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.ibadalrahman.app.Refresher
import com.ibadalrahman.app.core.Prayer
import com.ibadalrahman.app.data.Settings
import kotlin.math.cos
import kotlin.math.sin

/** Incremented whenever a preference changes; reading it subscribes a composable to settings. */
val LocalSettingsVersion = compositionLocalOf { 0L }

@Composable
fun settings(): Settings {
    LocalSettingsVersion.current
    return Settings.get(LocalContext.current)
}

/** Returns a callback that pushes the latest settings to alarms, widgets and the status bar. */
@Composable
fun rememberApplySettings(): () -> Unit {
    val context = LocalContext.current
    return { Refresher.refreshAll(context, allowStartService = true) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubPage(title: String, onBack: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}

@Composable
fun SectionCard(title: String? = null, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier) {
        if (title != null) {
            Text(
                title,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(start = 8.dp, bottom = 6.dp),
            )
        }
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(vertical = 4.dp), content = content)
        }
    }
}

@Composable
fun SettingItem(
    title: String,
    subtitle: String? = null,
    icon: ImageVector? = null,
    onClick: (() -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(14.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            if (subtitle != null) {
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (trailing != null) {
            Spacer(Modifier.width(8.dp))
            trailing()
        }
    }
}

@Composable
fun SwitchItem(title: String, subtitle: String? = null, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    SettingItem(
        title = title,
        subtitle = subtitle,
        onClick = { onCheckedChange(!checked) },
        trailing = { Switch(checked = checked, onCheckedChange = onCheckedChange) },
    )
}

@Composable
fun Stepper(value: String, onMinus: () -> Unit, onPlus: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        FilledTonalIconButton(onClick = onMinus, modifier = Modifier.size(36.dp)) {
            Text("−", style = MaterialTheme.typography.titleLarge)
        }
        Text(
            value,
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
            modifier = Modifier.width(56.dp),
        )
        FilledTonalIconButton(onClick = onPlus, modifier = Modifier.size(36.dp)) {
            Icon(Icons.Filled.Add, contentDescription = "زيادة", modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
fun <T> ChoiceDialog(
    title: String,
    options: List<T>,
    selected: T,
    label: (T) -> String,
    description: ((T) -> String?)? = null,
    onSelect: (T) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            LazyColumn(Modifier.heightIn(max = 460.dp)) {
                items(options) { option ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .selectable(selected = option == selected, role = Role.RadioButton) {
                                onSelect(option)
                                onDismiss()
                            }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = option == selected, onClick = null)
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(label(option), style = MaterialTheme.typography.bodyLarge)
                            description?.invoke(option)?.let {
                                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("إغلاق") } },
    )
}

@Composable
fun Banner(text: String, action: String, color: Color, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = color.copy(alpha = 0.14f),
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(8.dp)
                    .background(color, CircleShape),
            )
            Spacer(Modifier.width(10.dp))
            Text(text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            Text(action, style = MaterialTheme.typography.labelLarge, color = color)
        }
    }
}

/** Small pictogram of the sun's position for each prayer. */
@Composable
fun PrayerGlyph(prayer: Prayer, modifier: Modifier = Modifier, tint: Color = MaterialTheme.colorScheme.onSurfaceVariant) {
    Canvas(modifier.size(28.dp)) {
        val w = size.width
        val h = size.height
        val horizon = h * 0.72f
        val sunColor = when (prayer) {
            Prayer.FAJR -> Color(0xFF8FA8FF)
            Prayer.SUNRISE -> Color(0xFFFFA94D)
            Prayer.DHUHR -> Color(0xFFFFD43B)
            Prayer.ASR -> Color(0xFFF2B33D)
            Prayer.MAGHRIB -> Color(0xFFFF7849)
            Prayer.ISHA -> Color(0xFFCFD8FF)
        }
        if (prayer == Prayer.ISHA) {
            drawMoon(Offset(w * 0.45f, h * 0.45f), w * 0.26f, sunColor)
            drawCircle(sunColor, radius = w * 0.045f, center = Offset(w * 0.8f, h * 0.22f))
            return@Canvas
        }
        val (cx, cy) = when (prayer) {
            Prayer.FAJR -> w * 0.5f to horizon + h * 0.08f
            Prayer.SUNRISE -> w * 0.5f to horizon
            Prayer.DHUHR -> w * 0.5f to h * 0.3f
            Prayer.ASR -> w * 0.32f to h * 0.42f
            else -> w * 0.5f to horizon
        }
        val r = w * 0.17f
        if (prayer == Prayer.SUNRISE || prayer == Prayer.DHUHR || prayer == Prayer.ASR) {
            for (i in 0 until 8) {
                val a = Math.toRadians(i * 45.0)
                val start = Offset(cx + (r * 1.45f * cos(a)).toFloat(), cy + (r * 1.45f * sin(a)).toFloat())
                val end = Offset(cx + (r * 1.95f * cos(a)).toFloat(), cy + (r * 1.95f * sin(a)).toFloat())
                if (start.y < horizon) drawLine(sunColor, start, end, strokeWidth = w * 0.05f)
            }
        }
        clipAboveHorizon(horizon) { drawCircle(sunColor, radius = r, center = Offset(cx, cy)) }
        drawLine(tint, Offset(w * 0.08f, horizon), Offset(w * 0.92f, horizon), strokeWidth = w * 0.06f)
    }
}

private fun DrawScope.clipAboveHorizon(horizon: Float, block: DrawScope.() -> Unit) {
    clipRect(0f, 0f, size.width, horizon) { block() }
}

private fun DrawScope.drawMoon(center: Offset, r: Float, color: Color) {
    val outer = Path().apply { addOval(androidx.compose.ui.geometry.Rect(center, r)) }
    val inner = Path().apply { addOval(androidx.compose.ui.geometry.Rect(Offset(center.x + r * 0.45f, center.y - r * 0.3f), r * 0.85f)) }
    val crescent = Path().apply { op(outer, inner, androidx.compose.ui.graphics.PathOperation.Difference) }
    drawPath(crescent, color)
}

/** Mosque skyline used at the bottom of the hero card. */
@Composable
fun MosqueSilhouette(modifier: Modifier = Modifier, color: Color = Color.Black.copy(alpha = 0.28f)) {
    Canvas(modifier) {
        val sx = size.width / 360f
        val sy = size.height / 90f
        fun p(x: Float, y: Float) = Offset(x * sx, y * sy)
        val path = Path().apply {
            moveTo(0f, size.height)
            lineTo(p(0f, 72f).x, p(0f, 72f).y)
            // left minaret
            lineTo(p(52f, 72f).x, p(52f, 72f).y)
            lineTo(p(52f, 22f).x, p(52f, 22f).y)
            lineTo(p(58f, 6f).x, p(58f, 6f).y)
            lineTo(p(64f, 22f).x, p(64f, 22f).y)
            lineTo(p(64f, 72f).x, p(64f, 72f).y)
            // small dome
            lineTo(p(92f, 72f).x, p(92f, 72f).y)
            quadraticTo(p(92f, 50f).x, p(92f, 50f).y, p(110f, 46f).x, p(110f, 46f).y)
            quadraticTo(p(128f, 50f).x, p(128f, 50f).y, p(128f, 72f).x, p(128f, 72f).y)
            // main hall + dome
            lineTo(p(136f, 72f).x, p(136f, 72f).y)
            lineTo(p(136f, 52f).x, p(136f, 52f).y)
            lineTo(p(146f, 52f).x, p(146f, 52f).y)
            cubicTo(p(146f, 26f).x, p(146f, 26f).y, p(170f, 18f).x, p(170f, 18f).y, p(180f, 8f).x, p(180f, 8f).y)
            cubicTo(p(190f, 18f).x, p(190f, 18f).y, p(214f, 26f).x, p(214f, 26f).y, p(214f, 52f).x, p(214f, 52f).y)
            lineTo(p(224f, 52f).x, p(224f, 52f).y)
            lineTo(p(224f, 72f).x, p(224f, 72f).y)
            // small dome
            lineTo(p(232f, 72f).x, p(232f, 72f).y)
            quadraticTo(p(232f, 50f).x, p(232f, 50f).y, p(250f, 46f).x, p(250f, 46f).y)
            quadraticTo(p(268f, 50f).x, p(268f, 50f).y, p(268f, 72f).x, p(268f, 72f).y)
            // right minaret
            lineTo(p(296f, 72f).x, p(296f, 72f).y)
            lineTo(p(296f, 22f).x, p(296f, 22f).y)
            lineTo(p(302f, 6f).x, p(302f, 6f).y)
            lineTo(p(308f, 22f).x, p(308f, 22f).y)
            lineTo(p(308f, 72f).x, p(308f, 72f).y)
            lineTo(size.width, p(360f, 72f).y)
            lineTo(size.width, size.height)
            close()
        }
        drawPath(path, color)
        // crescent on the main dome
        drawMoon(p(180f, 2f), 3.2f * sx, color)
    }
}

@Composable
fun ProgressRing(progress: Float, modifier: Modifier = Modifier, color: Color, track: Color, stroke: Float = 10f) {
    Canvas(modifier) {
        val inset = stroke / 2
        val arcSize = Size(size.width - stroke, size.height - stroke)
        drawArc(track, 0f, 360f, false, Offset(inset, inset), arcSize, style = Stroke(stroke))
        drawArc(
            color, -90f, 360f * progress.coerceIn(0f, 1f), false, Offset(inset, inset), arcSize,
            style = Stroke(stroke, cap = androidx.compose.ui.graphics.StrokeCap.Round),
        )
    }
}

val ContentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
