package il.co.soline.measure.geometry

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * FloorLevelSolverTest — pure-JVM tests for the flatness-survey math.
 * heightZ = d·sinθ (signed: floor below, ceiling above), horizontal projection,
 * signed deviation, and the null-angle 2D fallback.
 */
class FloorLevelSolverTest {

    @Test fun heightZ_isDistanceTimesSinTheta() {
        assertEquals(500.0, FloorLevelSolver.heightZ(1000.0, 30.0), 1e-6)   // sin30 = 0.5
        assertEquals(1000.0, FloorLevelSolver.heightZ(1000.0, 90.0), 1e-6)  // ישר-מעלה
    }

    @Test fun heightZ_floorPointIsNegative() {
        // יורים למטה (θ<0) ⇒ נקודת-רצפה מתחת-למכשיר ⇒ Z<0.
        assertEquals(-500.0, FloorLevelSolver.heightZ(1000.0, -30.0), 1e-6)
    }

    @Test fun heightZ_nullAngleFallsBackToRawDistance() {
        // DISTO דו-ממדי (בלי-זווית) ⇒ נופלים למרחק כפי-שהוא (מסומן למשתמש "ללא זווית").
        assertEquals(1234.0, FloorLevelSolver.heightZ(1234.0, null), 1e-9)
    }

    @Test fun horizontalDist_isAbsDistanceTimesCosTheta() {
        assertEquals(500.0, FloorLevelSolver.horizontalDist(1000.0, 60.0), 1e-6)   // cos60 = 0.5
        // ערך-מוחלט: סימן-הזווית אינו משנה את המרחק-האופקי.
        assertEquals(500.0, FloorLevelSolver.horizontalDist(1000.0, -60.0), 1e-6)
    }

    @Test fun horizontalDist_nullAngleFallsBackToRawDistance() {
        assertEquals(1000.0, FloorLevelSolver.horizontalDist(1000.0, null), 1e-9)
    }

    @Test fun deviation_isSignedDifferenceFromZero() {
        assertEquals(12.0, FloorLevelSolver.deviation(pointZ = -488.0, zeroZ = -500.0), 1e-9)   // גבשושית +
        assertEquals(-12.0, FloorLevelSolver.deviation(pointZ = -512.0, zeroZ = -500.0), 1e-9)  // שקע −
    }
}
