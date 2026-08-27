package il.co.soline.measure.geometry

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.sqrt

/**
 * StationSolverTest — pure-JVM (no Android) unit tests for the P2P core:
 * polar→plan projection, corner-to-wall closing, corner de-duplication and
 * golden-triangle handedness. Locks the geometry conventions batch-1 relied on.
 */
class StationSolverTest {

    private val eps = 1e-6

    // ── toPlan: polar → plan ────────────────────────────────────────────────

    @Test fun toPlan_flatShot_liesOnXAxis() {
        val p = StationSolver.toPlan(1000.0, 0.0, 0.0)
        assertEquals(1000.0, p.x, 1e-4)
        assertEquals(0.0, p.y, 1e-4)
    }

    @Test fun toPlan_ninetyAzimuth_liesOnYAxis() {
        val p = StationSolver.toPlan(1000.0, 90.0, 0.0)
        assertEquals(0.0, p.x, 1e-4)
        assertEquals(1000.0, p.y, 1e-4)
    }

    @Test fun toPlan_knownRectangleCorner() {
        // ירייה באלכסון 45° במרחק √2·1000 נופלת ל-(1000,1000).
        val p = StationSolver.toPlan(1000.0 * sqrt(2.0), 45.0, 0.0)
        assertEquals(1000.0, p.x, 1e-3)
        assertEquals(1000.0, p.y, 1e-3)
    }

    @Test fun toPlan_verticalAngleProjectsHorizontally() {
        // tilt 60° ⇒ r = d·cos60 = 500.
        val p = StationSolver.toPlan(1000.0, 0.0, 60.0)
        assertEquals(500.0, p.x, 1e-4)
        assertEquals(0.0, p.y, 1e-4)
    }

    @Test fun toPlan_cwHandedFlipsAzimuthSign() {
        val ccw = StationSolver.toPlan(1000.0, 90.0, 0.0, cwHanded = false)
        val cw = StationSolver.toPlan(1000.0, 90.0, 0.0, cwHanded = true)
        assertEquals(1000.0, ccw.y, 1e-4)
        assertEquals(-1000.0, cw.y, 1e-4)  // מתאר-מראה: φ → −φ
    }

    // ── cornersToWalls: closes a rectangle ──────────────────────────────────

    @Test fun cornersToWalls_closesRectangle() {
        val corners = listOf(
            WallBuilder.Pt(0.0, 0.0),
            WallBuilder.Pt(4000.0, 0.0),
            WallBuilder.Pt(4000.0, 3000.0),
            WallBuilder.Pt(0.0, 3000.0),
        )
        val walls = StationSolver.cornersToWalls(corners, heightMm = 2700.0, roomId = 7L, closed = true)
        assertEquals(4, walls.size)
        assertEquals(4000.0, walls[0].length, 1e-3)
        assertEquals(3000.0, walls[1].length, 1e-3)
        assertEquals(4000.0, walls[2].length, 1e-3)
        assertEquals(3000.0, walls[3].length, 1e-3)
        // מלבן-CCW: כל פנייה = +90° (זווית-פנימית 90°), כולל הקיר-האחרון שסוגר לראשית.
        walls.forEach { assertEquals(90.0, it.angle, 1e-3) }
        walls.forEach { assertEquals(7L, it.roomId) }
        assertEquals(2700.0, walls[0].height, 1e-9)
    }

    @Test fun cornersToWalls_openContourHasNMinusOneWalls() {
        val corners = listOf(
            WallBuilder.Pt(0.0, 0.0),
            WallBuilder.Pt(1000.0, 0.0),
            WallBuilder.Pt(1000.0, 1000.0),
        )
        val walls = StationSolver.cornersToWalls(corners, heightMm = 2500.0, closed = false)
        assertEquals(2, walls.size)  // n-1 קירות למתאר-פתוח
    }

    @Test fun cornersToWalls_carriesHeightMeasuredFlag() {
        val corners = listOf(WallBuilder.Pt(0.0, 0.0), WallBuilder.Pt(1000.0, 0.0))
        val walls = StationSolver.cornersToWalls(corners, heightMm = 2700.0, closed = false, heightMeasured = true)
        assertEquals(1, walls.size)
        assertTrue(walls[0].heightMeasured)
    }

    // ── dedupeCorners: merges near-coincident corners ───────────────────────

    @Test fun dedupeCorners_mergesDoubleShot() {
        val corners = listOf(
            WallBuilder.Pt(0.0, 0.0),
            WallBuilder.Pt(1000.0, 0.0),
            WallBuilder.Pt(1002.0, 0.0),   // < MIN_CORNER_SEP_MM (10) מהקודמת ⇒ מוזג
            WallBuilder.Pt(1000.0, 1000.0),
        )
        val out = StationSolver.dedupeCorners(corners, closed = false)
        assertEquals(3, out.size)
    }

    @Test fun dedupeCorners_dropsClosingDuplicate() {
        val corners = listOf(
            WallBuilder.Pt(0.0, 0.0),
            WallBuilder.Pt(1000.0, 0.0),
            WallBuilder.Pt(1000.0, 1000.0),
            WallBuilder.Pt(2.0, 0.0),      // ≈ ראשונה ⇒ מוסרת (סגירה מטופלת ב-wrap)
        )
        val out = StationSolver.dedupeCorners(corners, closed = true)
        assertEquals(3, out.size)
    }

    // ── goldenTriangle: handedness (CW / CCW) ───────────────────────────────

    @Test fun goldenTriangle_rightAngle_ccwPositive_cwNegative() {
        val d = 1000.0 * sqrt(2.0)  // אלכסון של פינה ישרה 1000×1000
        val ccw = StationSolver.goldenTriangleAngle(1000.0, 1000.0, d, ccw = true)
        val cw = StationSolver.goldenTriangleAngle(1000.0, 1000.0, d, ccw = false)
        assertEquals(90.0, ccw.interiorDeg, 1e-3)
        assertEquals(90.0, ccw.turnDeg, 1e-3)   // +(180−90)
        assertEquals(-90.0, cw.turnDeg, 1e-3)   // −(180−90)
        assertTrue(ccw.valid)
    }

    @Test fun goldenTriangle_straightLine_zeroTurn() {
        val c = StationSolver.goldenTriangleAngle(1000.0, 1000.0, 2000.0, ccw = true)
        assertEquals(180.0, c.interiorDeg, 1e-3)
        assertEquals(0.0, c.turnDeg, 1e-3)
    }

    @Test fun goldenTriangle_degenerateLengthsFlaggedInvalid() {
        // אורכים שאינם יוצרים משולש (אלכסון גדול מסכום-הצלעות) ⇒ valid=false.
        val c = StationSolver.goldenTriangleAngle(1000.0, 1000.0, 5000.0, ccw = true)
        assertFalse(c.valid)
    }

    @Test fun expectedDiagonal_roundTripsWithGoldenTriangle() {
        val diag = StationSolver.expectedDiagonal(1200.0, 900.0, interiorDeg = 90.0)
        assertEquals(1500.0, diag, 1e-6)  // 3-4-5 → √(1200²+900²)=1500
        val back = StationSolver.goldenTriangleAngle(1200.0, 900.0, diag, ccw = true)
        assertEquals(90.0, back.interiorDeg, 1e-6)
    }
}
