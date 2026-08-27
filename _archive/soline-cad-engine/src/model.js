// ============================================================================
// Soline CAD Engine · Geometry Model
// ----------------------------------------------------------------------------
// A single validated geometry model (mm, integer/fixed) that drives BOTH the
// DXF export (2D + 3D) and the PDF report views (plan / front / side).
// This is the "source of truth"; DXF and report are projections of it (ADR-004).
// All lengths are millimetres.
// ============================================================================

"use strict";

/**
 * @typedef {{x:number,y:number,w:number,h:number}} Rect
 * @typedef {{kind:'rect',name:string,x:number,y:number,w:number,h:number}
 *          |{kind:'circle',name:string,cx:number,cy:number,r:number}} Cutout
 * @typedef {{id:string,name:string,rect:Rect,thickness:number,cutouts:Cutout[]}} Panel
 */

/** A realistic stone-kitchen job (data echoes the real Soline ledger). */
function sampleModel() {
  return {
    meta: {
      project: "משטח שיש · מטבח",
      client: "אושרת ינקו",
      address: "רוטשילד 22, קומה 13",
      date: "2026-02-26",
      revision: 1,
      checksum: "a1f9-4e02-c7",
      vertical: "stone",
      material: "אבן קיסר 4023",
      toleranceMm: 1.5,
      units: "mm",
      operator: "מיכאל",
      devices: ["Leica X6", "Leica D2"],
    },

    // Multiple elements — demonstrates the element engine producing varied parts.
    panels: /** @type {Panel[]} */ ([
      {
        id: "MAIN",
        name: "משטח ראשי",
        rect: { x: 0, y: 0, w: 3620, h: 640 },
        thickness: 20,
        cutouts: [
          { kind: "rect", name: "SINK", x: 1350, y: 150, w: 560, h: 400 },
          { kind: "rect", name: "COOKTOP", x: 2500, y: 90, w: 600, h: 520 },
          { kind: "circle", name: "TAP", cx: 1300, cy: 110, r: 18 },
        ],
      },
      {
        id: "ISLAND",
        name: "אי מרכזי",
        rect: { x: 820, y: 1180, w: 1800, h: 900 },
        thickness: 20,
        cutouts: [
          { kind: "rect", name: "HOB", x: 500, y: 300, w: 700, h: 400 },
        ],
      },
    ]),

    // Front/side elevation context for the MAIN counter.
    elevation: {
      panelId: "MAIN",
      floorZ: 0,
      cabinetHeight: 900, // top of cabinets = underside of slab
      slabThickness: 20,
      backsplashHeight: 600, // above the slab
      ceilingClearance: 2743, // validated floor→ceiling
    },

    // The validated measurement table (feeds the report).
    measurements: [
      { label: "אורך משטח ראשי", value: 3620, dev: "X6+D2", ok: true },
      { label: "עומק משטח ראשי", value: 640, dev: "X6+D2", ok: true },
      { label: "מרווח אנכי (רצפה→תקרה)", value: 2743, dev: "X6+D2", ok: true },
      { label: "רוחב פתח כיור", value: 560, dev: "D2", ok: true },
      { label: "רוחב פתח כיריים", value: 600, dev: "D2", ok: true },
      { label: "אורך אי", value: 1800, dev: "X6+D2", ok: true },
      { label: "עומק אי", value: 900, dev: "X6+D2", ok: true },
      { label: "עובי לוח", value: 20, dev: "Manual", ok: true },
    ],
  };
}

// --- Geometry helpers -------------------------------------------------------

/** Absolute rectangle corners (CCW), plan coordinates. */
function rectCorners(r) {
  return [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x + r.w, r.y + r.h],
    [r.x, r.y + r.h],
  ];
}

/** Bounding box over all panels (for view scaling). */
function modelBounds(model) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of model.panels) {
    minX = Math.min(minX, p.rect.x);
    minY = Math.min(minY, p.rect.y);
    maxX = Math.max(maxX, p.rect.x + p.rect.w);
    maxY = Math.max(maxY, p.rect.y + p.rect.h);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Absolute cutout geometry within its panel. */
function cutoutAbs(panel, c) {
  if (c.kind === "circle") {
    return { kind: "circle", name: c.name, cx: panel.rect.x + c.cx, cy: panel.rect.y + c.cy, r: c.r };
  }
  return {
    kind: "rect", name: c.name,
    x: panel.rect.x + c.x, y: panel.rect.y + c.y, w: c.w, h: c.h,
  };
}

module.exports = { sampleModel, rectCorners, modelBounds, cutoutAbs };
