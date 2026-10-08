package com.ibadalrahman.app.ui.tasbih

import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ibadalrahman.app.data.Settings
import com.ibadalrahman.app.ui.components.ProgressRing
import com.ibadalrahman.app.ui.theme.EmeraldDark
import com.ibadalrahman.app.ui.theme.Gold
import com.ibadalrahman.app.ui.theme.Ruqaa
import com.ibadalrahman.app.util.Format

private val phrases = listOf(
    "سُبْحَانَ اللَّهِ",
    "الْحَمْدُ لِلَّهِ",
    "اللَّهُ أَكْبَرُ",
    "لَا إِلَٰهَ إِلَّا اللَّهُ",
    "أَسْتَغْفِرُ اللَّهَ",
    "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
    "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ",
    "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
)

private val targets = listOf(33, 99, 100, 0)

@Composable
fun TasbihScreen(modifier: Modifier) {
    val context = LocalContext.current
    val s = remember { Settings.get(context) }
    val fmt = Format(s)
    var count by remember { mutableIntStateOf(s.tasbihCount) }
    var total by remember { mutableLongStateOf(s.tasbihTotal) }
    var phrase by remember { mutableIntStateOf(s.tasbihPhrase.coerceIn(0, phrases.lastIndex)) }
    var target by remember { mutableIntStateOf(s.tasbihTarget) }
    val haptic = LocalHapticFeedback.current
    var pressed by remember { mutableIntStateOf(0) }
    val bump by animateFloatAsState(if (pressed % 2 == 0) 1f else 0.96f, label = "bump")

    fun save() {
        s.tasbihCount = count
        s.tasbihTotal = total
        s.tasbihPhrase = phrase
        s.tasbihTarget = target
    }

    fun tap() {
        count++
        total++
        pressed++
        if (target > 0 && count >= target) {
            vibrate(context, 350)
            count = 0
            phrase = (phrase + 1) % phrases.size
        } else {
            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        }
        save()
    }

    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            phrases.forEachIndexed { i, p ->
                FilterChip(
                    selected = i == phrase,
                    onClick = {
                        phrase = i
                        count = 0
                        save()
                    },
                    label = { Text(p) },
                )
            }
        }

        Text(
            phrases[phrase],
            style = TextStyle(fontFamily = Ruqaa, fontSize = 34.sp, fontWeight = FontWeight.Bold),
            color = MaterialTheme.colorScheme.primary,
            textAlign = TextAlign.Center,
        )

        Box(
            Modifier
                .fillMaxWidth(0.8f)
                .aspectRatio(1f)
                .scale(bump),
            contentAlignment = Alignment.Center,
        ) {
            ProgressRing(
                progress = if (target > 0) count / target.toFloat() else 0f,
                modifier = Modifier.fillMaxSize(),
                color = Gold,
                track = MaterialTheme.colorScheme.outlineVariant,
                stroke = 28f,
            )
            Box(
                Modifier
                    .fillMaxSize(0.84f)
                    .clip(CircleShape)
                    .background(Brush.radialGradient(listOf(Color(0xFF1F7A60), EmeraldDark)))
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { tap() },
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(fmt.number(count), style = TextStyle(fontSize = 72.sp, fontWeight = FontWeight.Bold), color = Color.White)
                    Text(
                        if (target > 0) "من ${fmt.number(target)}" else "بلا حد",
                        style = MaterialTheme.typography.titleMedium,
                        color = Gold,
                    )
                }
            }
        }

        Text("اضغط على الدائرة للتسبيح", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            targets.forEach { t ->
                FilterChip(
                    selected = t == target,
                    onClick = {
                        target = t
                        count = 0
                        save()
                    },
                    label = { Text(if (t == 0) "∞" else fmt.number(t)) },
                )
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("المجموع: ${fmt.number(total.toInt())}", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            OutlinedButton(onClick = {
                count = 0
                save()
            }) {
                Icon(Icons.Filled.Refresh, contentDescription = null)
                Text(" تصفير")
            }
        }
        OutlinedButton(onClick = {
            count = 0
            total = 0
            save()
        }) { Text("تصفير المجموع") }
    }
}

private fun vibrate(context: android.content.Context, millis: Long) {
    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        context.getSystemService(VibratorManager::class.java)?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Vibrator::class.java)
    }
    vibrator?.vibrate(VibrationEffect.createOneShot(millis, VibrationEffect.DEFAULT_AMPLITUDE))
}
