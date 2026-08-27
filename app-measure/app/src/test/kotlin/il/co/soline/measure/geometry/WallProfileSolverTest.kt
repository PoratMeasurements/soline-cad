package il.co.soline.measure.geometry

import il.co.soline.measure.geometry.WallBuilder.Pt
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * WallProfileSolverTest — pure-JVM tests for the elevation/belly core.
 * Locks today's fix: BOTTOM datum = floor-referenced (v = height-from-floor,
 * NOT min-sample-subtracted), plus planBelly signed offsets.
 */
class WallProfileSolverTest {

    private fun inPoint(x: Double, y: Double, v: Double) =
        WallProfileSolver.InPoint(plan = Pt(x, y), v = v, manualU = 0.0)

    // ── toElevation: BOTTOM datum is the floor, not the lowest sample ────────

    @Test fun toElevation_bottomDatum_keepsFloorReferencedHeights() {
        // מודד שלא-ירה-ברצפה: הנקודה-הנמוכה-שנדגמה היא v=100 (לא 0). BOTTOM חייב לשמור
        // את הגבהים-מהרצפה כפי-שהם, ולא להסיט כך שהנמוכה הופכת ל-0.
        val pts = listOf(
            inPoint(0.0, 0.0, 100.0),
            inPoint(1000.0, 0.0, 500.0),
            inPoint(2000.0, 0.0, 900.0),
        )
        val out = WallProfileSolver.toElevation(
            pts, WallProfileSolver.ZeroH.LEFT, WallProfileSolver.ZeroV.BOTTOM, WallProfileSolver.Direction.CCW,
        )
        assertEquals(3, out.size)
        assertEquals(100.0, out[0].v, 1e-6)  // לא-הוסט ל-0
        assertEquals(500.0, out[1].v, 1e-6)
        assertEquals(900.0, out[2].v, 1e-6)
        // u נמדד לאורך קו-הבסיס משמאל: 0,1000,2000.
        assertEquals(0.0, out[0].u, 1e-6)
        assertEquals(1000.0, out[1].u, 1e-6)
        assertEquals(2000.0, out[2].u, 1e-6)
    }

    @Test fun toElevation_topDatum_measuresDownFromCeiling() {
        val pts = listOf(
            inPoint(0.0, 0.0, 100.0),
            inPoint(1000.0, 0.0, 500.0),
            inPoint(2000.0, 0.0, 900.0),
        )
        val out = WallProfileSolver.toElevation(
            pts, WallProfileSolver.ZeroH.LEFT, WallProfileSolver.ZeroV.TOP, WallProfileSolver.Direction.CCW,
        )
        // vCeil = 900 ⇒ vv = 900−v.
        assertEquals(800.0, out[0].v, 1e-6)
        assertEquals(400.0, out[1].v, 1e-6)
        assertEquals(0.0, out[2].v, 1e-6)
    }

    @Test fun toElevation_rightZero_reversesHorizontalOrigin() {
        val pts = listOf(
            inPoint(0.0, 0.0, 100.0),
            inPoint(2000.0, 0.0, 100.0),
        )
        val out = WallProfileSolver.toElevation(
            pts, WallProfileSolver.ZeroH.RIGHT, WallProfileSolver.ZeroV.BOTTOM, WallProfileSolver.Direction.CCW,
        )
        // RIGHT ⇒ uMax−u : הנקודה-הימנית הופכת ל-0, השמאלית ל-2000 (לאחר-הזזה).
        assertEquals(2000.0, out[0].u, 1e-6)
        assertEquals(0.0, out[1].u, 1e-6)
    }

    @Test fun toElevation_emptyReturnsEmpty() {
        assertTrue(WallProfileSolver.toElevation(emptyList()).isEmpty())
    }

    // ── silhouetteOrder: sorts elevation profile by u so the outline never crosses ──

    @Test fun silhouetteOrder_sortsByU_keepsPairedVE() {
        // סדר-לכידה לא-מונוטוני ב-u (2000, 0, 1000) → הצללית חייבת לצאת ממוינת 0,1000,2000
        // כשכל v/e נשאר צמוד לנקודתו (מונע מצולע-צללית מצטלב).
        val unsorted = listOf(
            WallProfileSolver.ElevPt(2000.0, 300.0, 5.0),
            WallProfileSolver.ElevPt(0.0, 100.0, -2.0),
            WallProfileSolver.ElevPt(1000.0, 200.0, 1.0),
        )
        val out = WallProfileSolver.silhouetteOrder(unsorted)
        assertEquals(listOf(0.0, 1000.0, 2000.0), out.map { it.u })
        assertEquals(100.0, out[0].v, 1e-9); assertEquals(-2.0, out[0].e, 1e-9)
        assertEquals(200.0, out[1].v, 1e-9)
        assertEquals(300.0, out[2].v, 1e-9); assertEquals(5.0, out[2].e, 1e-9)
    }

    @Test fun segmentSlope_flatIsZero_riseIsPositive() {
        val a = WallProfileSolver.ElevPt(0.0, 0.0, 0.0)
        val flat = WallProfileSolver.ElevPt(1000.0, 0.0, 0.0)
        val up = WallProfileSolver.ElevPt(1000.0, 1000.0, 0.0)
        assertEquals(0.0, WallProfileSolver.segmentSlopeDeg(a, flat), 1e-6)
        assertEquals(45.0, WallProfileSolver.segmentSlopeDeg(a, up), 1e-6)
    }

    // ── fitBaseline ─────────────────────────────────────────────────────────

    @Test fun fitBaseline_orientsAlongScanDirection() {
        val bl = WallProfileSolver.fitBaseline(listOf(Pt(0.0, 0.0), Pt(1000.0, 0.0), Pt(2000.0, 0.0)))
        assertEquals(0.0, bl.anchor.x, 1e-9)
        assertEquals(1.0, bl.tHat.x, 1e-9)   // מכוון מהראשונה אל האחרונה (+X)
        assertEquals(0.0, bl.tHat.y, 1e-9)
    }

    // ── planBelly: signed perpendicular offsets (belly) ─────────────────────

    @Test fun planBelly_inwardBulgeIsPositive() {
        val pts = listOf(Pt(0.0, 0.0), Pt(1000.0, 500.0), Pt(2000.0, 0.0))
        val belly = WallProfileSolver.planBelly(pts)!!
        assertEquals(2000.0, belly.spanMm, 1e-6)             // מוטת-המיתר A→B
        assertEquals(500.0, belly.offsets[1], 1e-6)          // בליטה +500 (לתוך-החדר)
        assertEquals(0.0, belly.offsets[0], 1e-6)
        assertEquals(0.0, belly.offsets[2], 1e-6)
        assertEquals(500.0, belly.maxPosMm, 1e-6)
        assertEquals(0.0, belly.maxNegMm, 1e-6)
        assertTrue(belly.developedMm > belly.spanMm)         // מתאר-אמיתי ארוך-מהמיתר
    }

    @Test fun planBelly_flipReversesOffsetSign() {
        val pts = listOf(Pt(0.0, 0.0), Pt(1000.0, 500.0), Pt(2000.0, 0.0))
        val belly = WallProfileSolver.planBelly(pts, flip = true)!!
        assertEquals(-500.0, belly.offsets[1], 1e-6)
    }

    @Test fun planBelly_needsTwoPoints() {
        assertNull(WallProfileSolver.planBelly(listOf(Pt(0.0, 0.0))))
    }

    @Test fun planBelly_zeroChordReturnsNull() {
        assertNull(WallProfileSolver.planBelly(listOf(Pt(5.0, 5.0), Pt(5.0, 5.0))))
    }
}
