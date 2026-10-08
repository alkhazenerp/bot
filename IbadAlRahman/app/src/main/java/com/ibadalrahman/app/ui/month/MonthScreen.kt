package com.ibadalrahman.app.ui.month

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ibadalrahman.app.core.Hijri
import com.ibadalrahman.app.core.Prayer
import com.ibadalrahman.app.data.PrayerRepository
import com.ibadalrahman.app.ui.components.LocalSettingsVersion
import com.ibadalrahman.app.ui.components.settings
import com.ibadalrahman.app.util.Format
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth

@Composable
fun MonthScreen(modifier: Modifier) {
    val context = LocalContext.current
    val s = settings()
    val version = LocalSettingsVersion.current
    val fmt = Format(s)
    val today = remember { LocalDate.now(s.zone()) }
    var monthOffset by rememberSaveable { mutableIntStateOf(0) }
    val month = YearMonth.from(today).plusMonths(monthOffset.toLong())
    val days = remember(month, version) {
        (1..month.lengthOfMonth()).map { d ->
            val date = month.atDay(d)
            date to PrayerRepository.times(context, date)
        }
    }
    val firstHijri = Hijri.of(month.atDay(1), s.hijriAdjustment)
    val lastHijri = Hijri.of(month.atEndOfMonth(), s.hijriAdjustment)
    val listState = rememberLazyListState()
    LaunchedEffect(month) {
        if (month == YearMonth.from(today)) listState.scrollToItem((today.dayOfMonth - 3).coerceAtLeast(0))
    }

    Column(modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { monthOffset-- }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "الشهر السابق") }
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "${Format.gregorianMonths[month.monthValue - 1]} ${fmt.number(month.year)}",
                    style = MaterialTheme.typography.titleLarge,
                )
                val hijriRange = if (firstHijri.month == lastHijri.month) {
                    "${firstHijri.monthName} ${fmt.number(firstHijri.year)} هـ"
                } else {
                    "${firstHijri.monthName} – ${lastHijri.monthName} ${fmt.number(lastHijri.year)} هـ"
                }
                Text(hijriRange, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
            }
            IconButton(onClick = { monthOffset++ }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "الشهر التالي") }
        }

        TableRow(header = true) {
            Cell("اليوم", weight = 1.25f, header = true)
            Prayer.entries.forEach { Cell(Format.prayerShortName(it), header = true) }
        }

        LazyColumn(state = listState, contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            items(days, key = { it.first.toEpochDay() }) { (date, times) ->
                val isToday = date == today
                val friday = date.dayOfWeek == DayOfWeek.FRIDAY
                val hijri = Hijri.of(date, s.hijriAdjustment)
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            when {
                                isToday -> MaterialTheme.colorScheme.primary.copy(alpha = 0.18f)
                                friday -> MaterialTheme.colorScheme.surfaceContainerHigh
                                else -> MaterialTheme.colorScheme.surfaceContainerLow
                            },
                        )
                        .padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1.25f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            "${Format.weekday(date.dayOfWeek).removePrefix("ال")} ${fmt.number(date.dayOfMonth)}",
                            fontSize = 12.sp,
                            fontWeight = if (isToday) FontWeight.Bold else FontWeight.Medium,
                            maxLines = 1,
                        )
                        Text(
                            "${fmt.number(hijri.day)} ${hijri.monthName.split(' ').first()}",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                        )
                    }
                    Prayer.entries.forEach { prayer ->
                        Text(
                            fmt.time(times[prayer], times.zone, withPeriod = false),
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.Center,
                            fontSize = 13.sp,
                            fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TableRow(header: Boolean, content: @Composable RowScope.() -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (header) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

@Composable
private fun RowScope.Cell(text: String, weight: Float = 1f, header: Boolean = false) {
    Text(
        text,
        modifier = Modifier.weight(weight),
        textAlign = TextAlign.Center,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        color = if (header) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
        maxLines = 1,
    )
}
