package il.co.soline.measure.ui.elevation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * LaserHeightTest — locks today's fix in the elevation capture helper:
 * `laserHeightMm` returns the vertical component d·sin θ, but returns **null**
 * (never the raw slant distance) when there is no angle or the shot is
 * near-horizontal (vertical component ≤ 1 mm) — so callers blank/disable the
 * ghost height instead of showing a wrong number.
 *
 * Runs under Robolectric only because the helper is defined in a Compose file;
 * the function itself is pure math.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class LaserHeightTest {

    @Test fun verticalShot_returnsFullHeight() {
        val h = laserHeightMm(1000.0, 90.0)
        assertNotNull(h)
        assertEquals(1000.0, h!!, 1e-6)
    }

    @Test fun tiltedShot_returnsVerticalComponent() {
        val h = laserHeightMm(1000.0, 30.0)
        assertNotNull(h)
        assertEquals(500.0, h!!, 1e-6)  // 1000·sin30
    }

    @Test fun horizontalShot_returnsNull() {
        assertNull(laserHeightMm(1000.0, 0.0))       // רכיב-אנכי 0 ⇒ null
        assertNull(laserHeightMm(1000.0, 0.01))      // ≈אופקי (רכיב ≤1 מ"מ) ⇒ null
    }

    @Test fun missingAngle_returnsNull() {
        assertNull(laserHeightMm(1000.0, null))
    }

    @Test fun missingDistance_returnsNull() {
        assertNull(laserHeightMm(null, 45.0))
    }

    @Test fun nonPositiveDistance_returnsNull() {
        assertNull(laserHeightMm(0.0, 45.0))
    }
}
