package com.ibadalrahman.app.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Address
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.ibadalrahman.app.core.CalculationMethod
import java.util.Locale
import java.util.concurrent.Executors

sealed interface LocationResult {
    data class Success(val name: String, val countryCode: String?) : LocationResult
    data object NoPermission : LocationResult
    data object Disabled : LocationResult
    data object Unavailable : LocationResult
}

/** One-shot location lookup using the platform LocationManager (no Play Services needed). */
object LocationHelper {

    private val executor = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    fun hasPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    /** Locates the device, stores the result in [Settings] and reports back on the main thread. */
    @SuppressLint("MissingPermission")
    fun updateLocation(context: Context, onResult: (LocationResult) -> Unit) {
        val app = context.applicationContext
        if (!hasPermission(app)) return onResult(LocationResult.NoPermission)
        val lm = app.getSystemService(LocationManager::class.java)
        if (lm == null || !LocationManagerCompat.isLocationEnabled(lm)) return onResult(LocationResult.Disabled)

        val providers = buildList {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && lm.hasProvider(LocationManager.FUSED_PROVIDER)) {
                add(LocationManager.FUSED_PROVIDER)
            }
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) add(LocationManager.NETWORK_PROVIDER)
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) add(LocationManager.GPS_PROVIDER)
        }
        val lastKnown = providers.mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
            .maxByOrNull { it.time }
        val fresh = lastKnown?.takeIf { System.currentTimeMillis() - it.time < 15 * 60_000L }
        if (fresh != null) return deliver(app, fresh, onResult)
        if (providers.isEmpty()) {
            return if (lastKnown != null) deliver(app, lastKnown, onResult) else onResult(LocationResult.Unavailable)
        }

        fun attempt(index: Int) {
            if (index >= providers.size) {
                main.post {
                    if (lastKnown != null) deliver(app, lastKnown, onResult) else onResult(LocationResult.Unavailable)
                }
                return
            }
            LocationManagerCompat.getCurrentLocation(lm, providers[index], CancellationSignal(), executor) { location: Location? ->
                if (location != null) main.post { deliver(app, location, onResult) } else attempt(index + 1)
            }
        }
        attempt(0)
    }

    private fun deliver(context: Context, location: Location, onResult: (LocationResult) -> Unit) {
        val lat = location.latitude
        val lng = location.longitude
        reverseGeocode(context, lat, lng) { address ->
            val nearest = Cities.nearest(lat, lng)
            val name = address?.let { it.locality ?: it.subAdminArea ?: it.adminArea }
                ?: nearest?.name
                ?: "%.3f, %.3f".format(Locale.US, lat, lng)
            val country = address?.countryCode ?: nearest?.countryCode
            val settings = Settings.get(context)
            settings.latitude = lat
            settings.longitude = lng
            settings.locationName = name
            settings.countryCode = country.orEmpty()
            settings.cityId = ""
            settings.zoneId = ""
            settings.locationUpdatedAt = System.currentTimeMillis()
            if (settings.methodAuto) settings.method = CalculationMethod.forCountry(country)
            onResult(LocationResult.Success(name, country))
        }
    }

    private fun reverseGeocode(context: Context, lat: Double, lng: Double, done: (Address?) -> Unit) {
        if (!Geocoder.isPresent()) return done(null)
        val geocoder = Geocoder(context, Locale.forLanguageTag("ar"))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            geocoder.getFromLocation(lat, lng, 1, object : Geocoder.GeocodeListener {
                override fun onGeocode(addresses: MutableList<Address>) {
                    main.post { done(addresses.firstOrNull()) }
                }

                override fun onError(errorMessage: String?) {
                    main.post { done(null) }
                }
            })
        } else {
            executor.execute {
                val address = runCatching {
                    @Suppress("DEPRECATION")
                    geocoder.getFromLocation(lat, lng, 1)?.firstOrNull()
                }.getOrNull()
                main.post { done(address) }
            }
        }
    }
}
