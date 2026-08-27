// ============================================================================
// Soline Measurement Engine · Placement → DXF / SVG
// ----------------------------------------------------------------------------
// Turns a built measurement space + a list of placed catalog elements into a
// real, CAD-openable drawing. It resolves every placement to world points,
// asks symbols.js for the 2D primitives that draw each element, adds the room
// outline, and serialises the lot to AutoCAD R12 (AC1009) ASCII DXF. A twin
// SVG serialiser renders the same primitives for quick browser preview.
//
// Primitive format (world mm):
//   {t:'line',   a:[x,y], b:[x,y],        layer}
//   {t:'circle', c:[x,y], r,              layer}
//   {t:'poly',   pts:[[x,y]...], closed,  layer}
//   {t:'text',   at:[x,y], h, s,          layer}
// ============================================================================

"use strict";

const { computeGeometry } = require("./space");
const { resolve } = require("./placement");
// Sibling module written in parallel — contract:
//   SYMBOLS[symbolType](ctx) -> primitive[]   ctx={points,sizeMm,layer,def}
//   DEFAULT_SYMBOL(ctx) -> primitive[]
//   LAYER_COLORS: { [layer]: aciColorNumber }
const { SYMBOLS, DEFAULT_SYMBOL, LAYER_COLORS } = require("./symbols");

// --- Numeric formatting (compact, deterministic) ----------------------------
function fmt(n) {
  if (!isFinite(n)) n = 0;
  // up to 4 decimals, strip trailing zeros; avoid "-0"
  let s = (Math.round(n * 1e4) / 1e4).toFixed(4).replace(/\.?0+$/, "");
  if (s === "-0") s = "0";
  return s;
}

// ============================================================================
// Build primitives: room outline + every resolved placement.
// ============================================================================
function buildPrimitives(space, placements) {
  const geo = computeGeometry(space);
  const primitives = [];
  const issues = [];

  // --- Room outline: one LINE per wall + length text at its midpoint. -------
  for (const wg of geo.wallGeom) {
    primitives.push({ t: "line", a: wg.a, b: wg.b, layer: "WALL" });
    const mid = [(wg.a[0] + wg.b[0]) / 2, (wg.a[1] + wg.b[1]) / 2];
    // nudge the label just off the wall line (perpendicular to its direction)
    const nx = -wg.dir[1], ny = wg.dir[0];
    const off = 90;
    primitives.push({
      t: "text",
      at: [mid[0] + nx * off, mid[1] + ny * off],
      h: 90,
      s: `${wg.id} ${Math.round(wg.length)}`,
      layer: "WALL",
    });
  }

  // --- Placed elements ------------------------------------------------------
  for (const place of placements) {
    const r = resolve(place, geo, space);
    if (r.issues && r.issues.length) issues.push(...r.issues);
    if (!r.points || !r.points.length) continue;
    const def = r.def;
    const sizeMm = (def.dims && (def.dims.diaMm || def.dims.wMm)) || 140;
    const sym = (def.symbol && SYMBOLS[def.symbol]) || DEFAULT_SYMBOL;
    const prims = sym({ points: r.points, sizeMm, layer: def.layer, def });
    if (Array.isArray(prims)) primitives.push(...prims);
  }

  return { geo, primitives, issues };
}

// --- Collect the distinct layers referenced by a primitive list. ------------
function collectLayers(primitives) {
  const set = new Set();
  for (const p of primitives) if (p.layer) set.add(p.layer);
  set.add("WALL");
  return [...set];
}

// ============================================================================
// R12 (AC1009) ASCII DXF writer — compact, inline, zero-dep.
// Group-code convention: every code on its own line, its value on the next.
// ============================================================================
function toDxf(primitives, layers) {
  const out = [];
  const g = (code, val) => { out.push(String(code)); out.push(String(val)); };

  // ---- HEADER ----
  g(0, "SECTION"); g(2, "HEADER");
  g(9, "$ACADVER"); g(1, "AC1009");
  g(9, "$INSUNITS"); g(70, 4); // 4 = millimetres
  g(0, "ENDSEC");

  // ---- TABLES (LAYER table) ----
  g(0, "SECTION"); g(2, "TABLES");
  g(0, "TABLE"); g(2, "LAYER"); g(70, layers.length);
  for (const name of layers) {
    const color = (LAYER_COLORS && LAYER_COLORS[name]) || 7;
    g(0, "LAYER");
    g(2, name);
    g(70, 0);        // flags
    g(62, color);    // ACI colour
    g(6, "CONTINUOUS");
  }
  g(0, "ENDTAB");
  g(0, "ENDSEC");

  // ---- ENTITIES ----
  g(0, "SECTION"); g(2, "ENTITIES");
  for (const p of primitives) {
    const layer = p.layer || "0";
    switch (p.t) {
      case "line":
        g(0, "LINE"); g(8, layer);
        g(10, fmt(p.a[0])); g(20, fmt(p.a[1])); g(30, 0);
        g(11, fmt(p.b[0])); g(21, fmt(p.b[1])); g(31, 0);
        break;
      case "circle":
        g(0, "CIRCLE"); g(8, layer);
        g(10, fmt(p.c[0])); g(20, fmt(p.c[1])); g(30, 0);
        g(40, fmt(p.r));
        break;
      case "poly":
        g(0, "POLYLINE"); g(8, layer);
        g(66, 1);                        // vertices follow
        g(70, p.closed ? 1 : 0);         // 1 = closed
        for (const pt of p.pts) {
          g(0, "VERTEX"); g(8, layer);
          g(10, fmt(pt[0])); g(20, fmt(pt[1])); g(30, 0);
        }
        g(0, "SEQEND"); g(8, layer);
        break;
      case "text":
        g(0, "TEXT"); g(8, layer);
        g(10, fmt(p.at[0])); g(20, fmt(p.at[1])); g(30, 0);
        g(40, fmt(p.h || 100));
        g(1, p.s == null ? "" : String(p.s));
        break;
      default:
        break;
    }
  }
  g(0, "ENDSEC");

  // ---- EOF ----
  g(0, "EOF");
  return out.join("\n") + "\n";
}

// ============================================================================
// Public: space + placements → { dxf, issues, layers }
// ============================================================================
function spaceToDxf(space, placements) {
  const { primitives, issues } = buildPrimitives(space, placements || []);
  const layers = collectLayers(primitives);
  const dxf = toDxf(primitives, layers);
  return { dxf, issues, layers };
}

// ============================================================================
// SVG preview of the SAME primitives (world→SVG, Y flipped, margin).
// ============================================================================
function svgColor(layer) {
  const aci = (LAYER_COLORS && LAYER_COLORS[layer]) || 7;
  return ACI_HEX[aci] || "#222222";
}

// Minimal AutoCAD Color Index → hex map (the low, commonly-used indices).
const ACI_HEX = {
  1: "#ff0000", 2: "#ffff00", 3: "#00ff00", 4: "#00ffff",
  5: "#0000ff", 6: "#ff00ff", 7: "#000000", 8: "#808080", 9: "#c0c0c0",
  30: "#ff7f00", 40: "#ff9955", 50: "#aaaa00", 140: "#0088aa",
  150: "#0055aa", 250: "#333333", 251: "#5b5b5b", 252: "#848484",
};

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function spaceToSvg(space, placements) {
  const { primitives } = buildPrimitives(space, placements || []);

  // Bounding box over everything drawn.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const acc = (x, y) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  for (const p of primitives) {
    if (p.t === "line") { acc(p.a[0], p.a[1]); acc(p.b[0], p.b[1]); }
    else if (p.t === "circle") { acc(p.c[0] - p.r, p.c[1] - p.r); acc(p.c[0] + p.r, p.c[1] + p.r); }
    else if (p.t === "poly") { for (const pt of p.pts) acc(pt[0], pt[1]); }
    else if (p.t === "text") { acc(p.at[0], p.at[1]); }
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 100; maxY = 100; }

  const margin = 200;
  const w = maxX - minX + margin * 2;
  const h = maxY - minY + margin * 2;
  // world (x,y) → svg: translate into positive space, flip Y.
  const X = (x) => fmt(x - minX + margin);
  const Y = (y) => fmt(maxY - y + margin);

  const body = [];
  for (const p of primitives) {
    const stroke = svgColor(p.layer);
    switch (p.t) {
      case "line":
        body.push(`<line x1="${X(p.a[0])}" y1="${Y(p.a[1])}" x2="${X(p.b[0])}" y2="${Y(p.b[1])}" stroke="${stroke}" stroke-width="12" data-layer="${esc(p.layer)}"/>`);
        break;
      case "circle":
        body.push(`<circle cx="${X(p.c[0])}" cy="${Y(p.c[1])}" r="${fmt(p.r)}" fill="none" stroke="${stroke}" stroke-width="12" data-layer="${esc(p.layer)}"/>`);
        break;
      case "poly": {
        const pts = p.pts.map((pt) => `${X(pt[0])},${Y(pt[1])}`).join(" ");
        const tag = p.closed ? "polygon" : "polyline";
        body.push(`<${tag} points="${pts}" fill="none" stroke="${stroke}" stroke-width="12" data-layer="${esc(p.layer)}"/>`);
        break;
      }
      case "text":
        body.push(`<text x="${X(p.at[0])}" y="${Y(p.at[1])}" font-size="${fmt((p.h || 100) * 1.4)}" fill="${stroke}" font-family="monospace" data-layer="${esc(p.layer)}">${esc(p.s)}</text>`);
        break;
      default:
        break;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(w)} ${fmt(h)}" width="${fmt(w / 4)}" height="${fmt(h / 4)}">\n` +
    `<rect x="0" y="0" width="${fmt(w)}" height="${fmt(h)}" fill="#ffffff"/>\n` +
    body.join("\n") + "\n</svg>\n";
}

module.exports = { spaceToDxf, spaceToSvg, buildPrimitives };
