package com.ibadalrahman.app.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.ibadalrahman.app.data.PrayerRepository
import com.ibadalrahman.app.data.Settings
import com.ibadalrahman.app.data.WidgetPrefs
import com.ibadalrahman.app.data.WidgetTheme
import com.ibadalrahman.app.ui.Labels
import com.ibadalrahman.app.ui.settings.WidgetPreview
import com.ibadalrahman.app.ui.theme.IbadTheme
import com.ibadalrahman.app.util.Format

/** Lets the user choose colours and transparency when adding (or reconfiguring) a widget. */
class WidgetConfigActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val widgetId = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID
        // Default result: cancelled, so backing out of the first configuration removes the widget.
        setResult(Activity.RESULT_CANCELED, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }
        val manager = AppWidgetManager.getInstance(this)
        val kind = WidgetKind.forProvider(manager.getAppWidgetInfo(widgetId)?.provider?.className) ?: WidgetKind.NEXT
        val prefs = WidgetPrefs(this)
        val settings = Settings.get(this)

        setContent {
            IbadTheme(settings.themeMode) {
                var theme by remember { mutableStateOf(prefs.theme(widgetId)) }
                var opacity by remember { mutableFloatStateOf(prefs.opacity(widgetId).toFloat()) }
                val snapshot = remember { PrayerRepository.snapshot(this) }
                val fmt = remember { Format(settings) }

                Column(
                    Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.background)
                        .statusBarsPadding()
                        .navigationBarsPadding()
                        .verticalScroll(rememberScrollState())
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Text("تخصيص ودجت «${kind.title}»", style = MaterialTheme.typography.titleLarge)
                    WidgetPreview(kind, theme, opacity.toInt(), snapshot, fmt)
                    Text("الألوان", style = MaterialTheme.typography.titleMedium)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        WidgetTheme.entries.forEach { t ->
                            FilterChip(
                                selected = t == theme,
                                onClick = { theme = t },
                                label = { Text(Labels.widgetTheme(t)) },
                                leadingIcon = {
                                    Box(
                                        Modifier
                                            .size(14.dp)
                                            .clip(CircleShape)
                                            .background(Color(t.background)),
                                    )
                                },
                            )
                        }
                    }
                    Text("عتامة الخلفية: ${fmt.number(opacity.toInt())}٪", style = MaterialTheme.typography.titleMedium)
                    Slider(value = opacity, onValueChange = { opacity = it }, valueRange = 0f..100f)
                    Text(
                        "صفر = شفاف تمامًا (النص فوق الخلفية مباشرة)، ١٠٠ = خلفية كاملة.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Button(
                        onClick = {
                            prefs.save(widgetId, theme, opacity.toInt())
                            WidgetUpdater.update(this@WidgetConfigActivity, kind, intArrayOf(widgetId))
                            setResult(Activity.RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
                            finish()
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                    ) { Text("حفظ وإضافة") }
                }
            }
        }
    }
}
