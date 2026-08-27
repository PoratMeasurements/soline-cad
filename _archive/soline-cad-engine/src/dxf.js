// ============================================================================
// Soline CAD Engine · DXF generator (AutoCAD R12 / AC1009 ASCII)
// ----------------------------------------------------------------------------
// Pure, dependency-free. An element factory emits neutral primitives, and a
// writer serialises them to valid DXF. Produces 2D (plan) and 3D (extruded
// slab mesh) exports. Units = millimetres ($INSUNITS = 4).
//
// DXF text is ASCII-only, so labels here are English/numeric codes (SINK,
// COOKTOP, 3620…). Hebrew explanations live in the PDF report, not the DXF —
// this keeps the CAD file clean and universally importable.
// ============================================================================

"use strict";

const { rectCorners, cutoutAbs } = require("./model");

// --- Layer palette (name -> AutoCAD Color Index) ---------------------------
const LAYERS = {
  COUNTER: 5,   // blue   — panel outlines
  CUTOUT: 1,    // red    — sink/cooktop/tap openings
  DIM: 3,       // green  — dimension lines
  TEXT: 7,      // white/black — labels
  SLAB3D: 8,    // grey   — 3D faces
  EDGE3D: 5,    // blue   — 3D outlines
};

// --- Primitive factory (the "element engine") ------------------------------
const el = {
  polyline: (pts, layer, closed = true, z = 0) => ({ t: "polyline", pts, layer, closed, z }),
  line: (a, b, layer) => ({ t: "line", a, b, layer }), // a,b = [x,y,z]
  circle: (c, r, layer, z = 0) => ({ t: "circle", c, r, layer, z }),
  text: (at, h, s, layer, rot = 0) => ({ t: "text", at, h, s, layer, rot }),
  face: (pts, layer) => ({ t: "face", pts, layer }), // pts = 3 or 4 × [x,y,z]
};

// --- Element helpers: build parts from the model ---------------------------

/** A linear dimension drawn as extension lines + dim line + arrow ticks + text. */
function linearDim(p1, p2, offset, axis, text) {
  const parts = [];
  const isX = axis === "x"; // measuring along X (horizontal), offset in -Y
  const oy = isX ? -offset : 0;
  const ox = isX ? 0 : -offset;
  const a = [p1[0] + ox, p1[1] + oy];
  const b = [p2[0] + ox, p2[1] + oy];
  // extension lines
  parts.push(el.line([p1[0], p1[1], 0], [a[0], a[1], 0], LAYERS.DIM));
  parts.push(el.line([p2[0], p2[1], 0], [b[0], b[1], 0], LAYERS.DIM));
  // dimension line
  parts.push(el.line([a[0], a[1], 0], [b[0], b[1], 0], LAYERS.DIM));
  // arrow ticks (45° slashes)
  const tick = 40;
  parts.push(el.line([a[0] - tick, a[1] - tick, 0], [a[0] + tick, a[1] + tick, 0], LAYERS.DIM));
  parts.push(el.line([b[0] - tick, b[1] - tick, 0], [b[0] + tick, b[1] + tick, 0], LAYERS.DIM));
  // text at mid
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  parts.push(el.text([mid[0] - String(text).length * 22, mid[1] + 20], 60, String(text), LAYERS.TEXT, 0));
  return parts;
}

/** Cutout -> primitives (rect polyline or circle) on a given layer, at height z. */
function cutoutPrims(panel, c, layer, z = 0) {
  const ca = cutoutAbs(panel, c);
  if (ca.kind === "circle") return [el.circle([ca.cx, ca.cy], ca.r, layer, z)];
  const pts = rectCorners(ca);
  const prims = [el.polyline(pts, layer, true, z)];
  prims.push(el.text([ca.x + 8, ca.y + ca.h / 2], 55, ca.name, LAYERS.TEXT));
  return prims;
}

// --- 2D plan (top view) -----------------------------------------------------
function build2D(model) {
  const prims = [];
  for (const p of model.panels) {
    prims.push(el.polyline(rectCorners(p.rect), LAYERS.COUNTER, true, 0));
    prims.push(el.text([p.rect.x + 30, p.rect.y + p.rect.h - 60], 70, p.id, LAYERS.TEXT));
    for (const c of p.cutouts) prims.push(...cutoutPrims(p, c, LAYERS.CUTOUT, 0));
  }
  // overall dimensions on the MAIN panel
  const main = model.panels.find((p) => p.id === "MAIN");
  if (main) {
    const r = main.rect;
    prims.push(...linearDim([r.x, r.y], [r.x + r.w, r.y], 180, "x", r.w));
    prims.push(...linearDim([r.x + r.w, r.y], [r.x + r.w, r.y + r.h], 180, "y", r.h));
    // sink width dim
    const sink = main.cutouts.find((c) => c.name === "SINK");
    if (sink) {
      const sx = r.x + sink.x, sy = r.y + sink.y;
      prims.push(...linearDim([sx, sy + sink.h], [sx + sink.w, sy + sink.h], 90, "x", sink.w));
    }
  }
  return prims;
}

// --- 3D (extruded slab mesh + cutout outlines on top) ----------------------
function build3D(model) {
  const prims = [];
  for (const p of model.panels) {
    const t = p.thickness;
    const [c0, c1, c2, c3] = rectCorners(p.rect);
    const top = (c) => [c[0], c[1], t];
    const bot = (c) => [c[0], c[1], 0];
    // top & bottom faces (single quads for a rectangle)
    prims.push(el.face([top(c0), top(c1), top(c2), top(c3)], LAYERS.SLAB3D));
    prims.push(el.face([bot(c0), bot(c1), bot(c2), bot(c3)], LAYERS.SLAB3D));
    // side walls (4 quads)
    const ring = [c0, c1, c2, c3];
    for (let i = 0; i < 4; i++) {
      const a = ring[i], b = ring[(i + 1) % 4];
      prims.push(el.face([bot(a), bot(b), top(b), top(a)], LAYERS.SLAB3D));
    }
    // edge outlines top & bottom for crisp wireframe
    prims.push(el.polyline(rectCorners(p.rect), LAYERS.EDGE3D, true, t));
    prims.push(el.polyline(rectCorners(p.rect), LAYERS.EDGE3D, true, 0));
    // cutouts marked on the top face
    for (const c of p.cutouts) prims.push(...cutoutPrims(p, c, LAYERS.CUTOUT, t));
  }
  return prims;
}

// --- DXF serialisation ------------------------------------------------------
function g(code, val) { return code + "\n" + val + "\n"; }

function entityToDxf(e) {
  switch (e.t) {
    case "line":
      return g(0, "LINE") + g(8, e.layer) +
        g(10, e.a[0]) + g(20, e.a[1]) + g(30, e.a[2] || 0) +
        g(11, e.b[0]) + g(21, e.b[1]) + g(31, e.b[2] || 0);
    case "circle":
      return g(0, "CIRCLE") + g(8, e.layer) +
        g(10, e.c[0]) + g(20, e.c[1]) + g(30, e.z || 0) + g(40, e.r);
    case "text":
      return g(0, "TEXT") + g(8, e.layer) +
        g(10, e.at[0]) + g(20, e.at[1]) + g(30, 0) + g(40, e.h) +
        g(1, e.s) + g(50, e.rot || 0);
    case "polyline": {
      const flag = e.closed ? 1 : 0;
      let s = g(0, "POLYLINE") + g(8, e.layer) + g(66, 1) + g(70, flag);
      for (const p of e.pts) {
        s += g(0, "VERTEX") + g(8, e.layer) +
          g(10, p[0]) + g(20, p[1]) + g(30, e.z || 0);
      }
      s += g(0, "SEQEND") + g(8, e.layer);
      return s;
    }
    case "face": {
      const p = e.pts;
      const q = p.length === 3 ? [p[0], p[1], p[2], p[2]] : p;
      return g(0, "3DFACE") + g(8, e.layer) +
        g(10, q[0][0]) + g(20, q[0][1]) + g(30, q[0][2]) +
        g(11, q[1][0]) + g(21, q[1][1]) + g(31, q[1][2]) +
        g(12, q[2][0]) + g(22, q[2][1]) + g(32, q[2][2]) +
        g(13, q[3][0]) + g(23, q[3][1]) + g(33, q[3][2]);
    }
    default:
      return "";
  }
}

function layerTable() {
  const names = Object.keys(LAYERS);
  let s = g(0, "TABLE") + g(2, "LAYER") + g(70, names.length);
  for (const n of names) {
    s += g(0, "LAYER") + g(2, n) + g(70, 0) + g(62, LAYERS[n]) + g(6, "CONTINUOUS");
  }
  s += g(0, "ENDTAB");
  return s;
}

/** Serialise a primitive list to a complete DXF document string. */
function toDxf(prims) {
  let out = "";
  // HEADER (units = mm)
  out += g(0, "SECTION") + g(2, "HEADER") + g(9, "$INSUNITS") + g(70, 4) + g(0, "ENDSEC");
  // TABLES (layers)
  out += g(0, "SECTION") + g(2, "TABLES") + layerTable() + g(0, "ENDSEC");
  // ENTITIES
  out += g(0, "SECTION") + g(2, "ENTITIES");
  for (const e of prims) out += entityToDxf(e);
  out += g(0, "ENDSEC");
  out += g(0, "EOF");
  return out;
}

module.exports = { build2D, build3D, toDxf, LAYERS, el, linearDim };
