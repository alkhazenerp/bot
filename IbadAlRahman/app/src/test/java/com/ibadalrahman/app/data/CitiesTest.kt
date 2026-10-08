package com.ibadalrahman.app.data

import com.ibadalrahman.app.core.CalculationMethod
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId

class CitiesTest {

    @Test
    fun idsAreUniqueAndDataIsValid() {
        val all = Cities.all
        assertTrue(all.size > 250)
        assertEquals(all.size, all.map { it.id }.toSet().size)
        for (city in all) {
            assertTrue(city.name, city.latitude in -90.0..90.0 && city.longitude in -180.0..180.0)
            assertNotNull(city.name, ZoneId.of(city.zoneId))
        }
    }

    @Test
    fun searchIgnoresHamzaAndTaMarbuta() {
        assertTrue(Cities.search("مكه").any { it.id == "SA:مكة المكرمة" })
        assertTrue(Cities.search("اسطنبول").any { it.name == "إسطنبول" })
        assertTrue(Cities.search("الكويت").isNotEmpty())
        assertEquals(Cities.all.size, Cities.search("  ").size)
    }

    @Test
    fun nearestCity() {
        assertEquals("الرياض", Cities.nearest(24.70, 46.70)?.name)
        assertEquals(null, Cities.nearest(0.0, -30.0)) // middle of the Atlantic
    }

    @Test
    fun defaultLocationMatchesBuiltInCity() {
        val makkah = Cities.byId("SA:مكة المكرمة")
        assertNotNull(makkah)
        assertEquals(CalculationMethod.UMM_AL_QURA, CalculationMethod.forCountry(makkah!!.countryCode))
    }
}
