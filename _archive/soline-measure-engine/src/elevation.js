// ============================================================================
// Soline Measurement Engine · Elevations & simple 3D
// ----------------------------------------------------------------------------
// Two extra views of a built measurement space + its placed catalog elements:
//
//   • FRONT ELEVATIONS — for every wall, a front view: the wall rectangle
//     (length × height), a floor line, and each hosted element drawn at its
//     [offsetAlongWall, heightAboveFloor] by asking symbols.js for its glyph
//     (mapped into the elevation plane where x = offset along wall, y = height).
//     Openings are drawn as their real rectangle (offset..offset+width, from the
//     sill up by height). Every element gets a thin height-dimension line to the
//     floor plus its height value. Wall elevations are laid out in a horizontal
//     row, each shifted right by (previous width + gap).
//
//   • SIMPLE 3D — walls extruded to their height as 3DFACE quads, floor+ceiling
//     as triangulated 3DFACEs, and every element as a small 3D cross marker at
//     its world (x, y, z=height).
//
// Zero dependencies. R12 (AC1009) ASCII DXF + a twin SVG for the elevations.
// Primitive format (2D, mm): {t:'line',a,b,layer} · {t:'circle',c,r,layer} ·
//   {t:'poly',pts,closed,layer} · {t:'text',at,h,s,layer}
// ============================================================================

"use strict";

const { computeGeometry, pointOnWall } = require("./space");
const { find } = require("./catalog");
// Sibling module (written in parallel) — contract:
//   SYMBOLS[symbolType](ctx) -> primitive[]   ctx={points,sizeMm,layer,def}
//   DEFAULT_SYMBOL(ctx) -> primitive[]
//   LAYER_COLORS: { [layer]: aciColorNumber }  (may also expose .resolve)
const { SYMBOLS, DEFAULT_SYMBOL, LAYER_COLORS } = require("./symbols");

// Layout + styling constants.
const GAP = 1000;          // mm between adjacent wall elevations
const DIM_LAYER = "DIM";   // height dimension lines + text
const FLOOR_LAYER = "FLOOR";
const DEFAULT_WALL_H = 2400;

// --- Numeric formatting (compact, deterministic) ----------------------------
function fmt(n) {
  if (!isFinite(n)) n = 0;
  let s = (Math.round(n * 1e4) / 1e4).toFixed(4).replace(/\.?0+$/, "");
  if (s === "-0") s = "0";
  return s;
}

// --- Layer → ACI colour (via LAYER_COLORS, fallback 7) ----------------------
function layerColor(name) {
  if (LAYER_COLORS) {
    if (typeof LAYER_COLORS.resolve === "function") {
      const c = LAYER_COLORS.resolve(name);
      if (c) return c;
    }
    if (Object.prototype.hasOwnProperty.call(LAYER_COLORS, name)) return LAYER_COLORS[name] || 7;
  }
  return 7;
}

function wallHeightOf(space, id) {
  const w = space.walls.find((x) => x.id === id);
  return (w && w.height && w.height.value) || DEFAULT_WALL_H;
}

// ============================================================================
// Build the elevation primitives: a horizontal row of per-wall front views.
// Elevation plane coordinates: x = xShift + offsetAlongWall, y = heightAboveFloor.
// ============================================================================
function elevationPrimitives(space, placements) {
  const geo = computeGeometry(space);
  const primitives = [];
  const issues = [];

  const addGlyph = (def, sizeMm, points) => {
    const sym = (def.symbol && SYMBOLS[def.symbol]) || DEFAULT_SYMBOL;
    const g = sym({ points, sizeMm, layer: def.layer, def });
    if (Array.isArray(g)) primitives.push(...g);
  };
  // A thin dimension line down to the floor + the height value text.
  const addHeightDim = (x, z) => {
    primitives.push({ t: "line", a: [x, 0], b: [x, z], layer: DIM_LAYER });
    primitives.push({ t: "text", at: [x + 40, z / 2], h: 90, s: `${Math.round(z)}`, layer: DIM_LAYER });
  };

  let xShift = 0;
  for (const wg of geo.wallGeom) {
    const wallH = wallHeightOf(space, wg.id);
    const wallLen = wg.length;

    // Wall outline rectangle (length × height) + floor line + Hebrew label.
    primitives.push({
      t: "poly",
      pts: [[xShift, 0], [xShift + wallLen, 0], [xShift + wallLen, wallH], [xShift, wallH]],
      closed: true,
      layer: "WALL",
    });
    primitives.push({ t: "line", a: [xShift, 0], b: [xShift + wallLen, 0], layer: FLOOR_LAYER });
    primitives.push({
      t: "text",
      at: [xShift + wallLen / 2, -300],
      h: 120,
      s: `קיר ${wg.id} · ${Math.round(wallLen)}×${Math.round(wallH)}`,
      layer: "WALL",
    });

    // Elements hosted on THIS wall.
    for (const place of placements) {
      if (place.wallId !== wg.id) continue;
      const def = find(place.catalogId);
      if (!def) { issues.push(`אלמנט לא מוכר: ${place.catalogId}`); continue; }
      const sizeMm = (def.dims && (def.dims.diaMm || def.dims.wMm)) || 140;

      switch (def.locateBy) {
        case "point": {
          const z = place.height != null ? place.height : 0;
          addGlyph(def, sizeMm, [[xShift + place.offset, z]]);
          addHeightDim(xShift + place.offset, z);
          break;
        }
        case "array": {
          const z = place.height != null ? place.height : 0;
          const pts = [];
          for (let i = 0; i < place.count; i++) {
            pts.push([xShift + place.firstOffset + i * place.spacing, z]);
          }
          addGlyph(def, sizeMm, pts);
          for (const p of pts) addHeightDim(p[0], z);
          break;
        }
        case "opening": {
          const off = place.offset;
          const w = place.width || 0;
          const sill = place.sill || 0;
          const oh = place.height || 0;
          // The real opening rectangle: offset..offset+width, sill up by height.
          primitives.push({
            t: "poly",
            pts: [
              [xShift + off, sill],
              [xShift + off + w, sill],
              [xShift + off + w, sill + oh],
              [xShift + off, sill + oh],
            ],
            closed: true,
            layer: def.layer,
          });
          addHeightDim(xShift + off, sill); // sill height to the floor
          break;
        }
        case "span": {
          const z = place.height != null ? place.height : 0;
          const s0 = place.startOffset != null ? place.startOffset : 0;
          const s1 = place.endOffset != null ? place.endOffset : s0;
          addGlyph(def, sizeMm, [[xShift + s0, z], [xShift + s1, z]]);
          addHeightDim(xShift + (s0 + s1) / 2, z);
          break;
        }
        default:
          // area (and anything else) has no meaningful along-wall elevation.
          break;
      }
    }

    xShift += wallLen + GAP;
  }

  return { geo, primitives, issues };
}

// ============================================================================
// R12 (AC1009) ASCII DXF writer for 2D primitives (elevation).
// ============================================================================
function collectLayers(primitives, extra) {
  const set = new Set(extra || []);
  for (const p of primitives) if (p.layer) set.add(p.layer);
  return [...set];
}

function toDxf(primitives, layers) {
  const out = [];
  const g = (code, val) => { out.push(String(code)); out.push(String(val)); };

  // HEADER
  g(0, "SECTION"); g(2, "HEADER");
  g(9, "$ACADVER"); g(1, "AC1009");
  g(9, "$INSUNITS"); g(70, 4); // 4 = millimetres
  g(0, "ENDSEC");

  // TABLES (LAYER)
  g(0, "SECTION"); g(2, "TABLES");
  g(0, "TABLE"); g(2, "LAYER"); g(70, layers.length);
  for (const name of layers) {
    g(0, "LAYER");
    g(2, name);
    g(70, 0);
    g(62, layerColor(name));
    g(6, "CONTINUOUS");
  }
  g(0, "ENDTAB");
  g(0, "ENDSEC");

  // ENTITIES
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
        g(66, 1);
        g(70, p.closed ? 1 : 0);
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
  g(0, "EOF");
  return out.join("\n") + "\n";
}

// ============================================================================
// Public: elevation DXF.
// ============================================================================
function elevationDxf(space, placements) {
  const { primitives, issues } = elevationPrimitives(space, placements || []);
  const layers = collectLayers(primitives, ["WALL", FLOOR_LAYER, DIM_LAYER]);
  const dxf = toDxf(primitives, layers);
  return { dxf, issues, layers };
}

// ============================================================================
// SVG preview of the SAME elevation primitives.
// Elevation y is UP → flip Y so larger height renders higher on screen.
// ============================================================================
const ACI_HEX = {
  1: "#ff0000", 2: "#ffff00", 3: "#00ff00", 4: "#00ffff",
  5: "#0000ff", 6: "#ff00ff", 7: "#000000", 8: "#808080", 9: "#c0c0c0",
  30: "#ff7f00", 40: "#ff9955", 50: "#aaaa00", 51: "#bbaa00",
  90: "#008800", 92: "#00aa44", 140: "#0088aa", 141: "#0099bb",
  150: "#0055aa", 200: "#aa00aa", 210: "#cc55cc",
  250: "#333333", 251: "#5b5b5b", 252: "#848484",
};

function svgColor(layer) {
  const aci = layerColor(layer);
  return ACI_HEX[aci] || "#222222";
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function elevationSvg(space, placements) {
  const { primitives } = elevationPrimitives(space, placements || []);

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

  const margin = 300;
  const w = maxX - minX + margin * 2;
  const h = maxY - minY + margin * 2;
  const X = (x) => fmt(x - minX + margin);
  const Y = (y) => fmt(maxY - y + margin); // flip: larger height → higher on screen

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

// ============================================================================
// Simple 3D: walls extruded to their height (3DFACE quads) + floor/ceiling
// (triangulated 3DFACEs) + each element as a small 3D cross marker.
// ============================================================================
function worldMarkers(place, def, geo) {
  const out = [];
  const wall = place.wallId ? geo.wallGeom.find((w) => w.id === place.wallId) : null;
  const on = (off) => pointOnWall(geo, place.wallId, off);

  switch (def.locateBy) {
    case "point":
      if (wall) { const p = on(place.offset); if (p) out.push([p[0], p[1], place.height || 0]); }
      else if (place.centerXY) out.push([place.centerXY[0], place.centerXY[1], place.height || 0]);
      break;
    case "array":
      if (wall) {
        for (let i = 0; i < place.count; i++) {
          const p = on(place.firstOffset + i * place.spacing);
          if (p) out.push([p[0], p[1], place.height || 0]);
        }
      }
      break;
    case "opening":
      if (wall) {
        const c = on(place.offset + (place.width || 0) / 2);
        if (c) out.push([c[0], c[1], (place.sill || 0) + (place.height || 0) / 2]);
      }
      break;
    case "span":
      if (wall) {
        const s0 = place.startOffset != null ? place.startOffset : 0;
        const s1 = place.endOffset != null ? place.endOffset : s0;
        const c = on((s0 + s1) / 2);
        if (c) out.push([c[0], c[1], place.height || 0]);
      } else if (place.startXY && place.endXY) {
        out.push([(place.startXY[0] + place.endXY[0]) / 2, (place.startXY[1] + place.endXY[1]) / 2, place.height || 0]);
      }
      break;
    case "area":
      if (place.centerXY) out.push([place.centerXY[0], place.centerXY[1], place.height || 0]);
      break;
    default:
      break;
  }
  return out;
}

function dxf3d(space, placements) {
  const geo = computeGeometry(space);
  const faces = []; // { layer, pts: [[x,y,z] x3-4] }
  const lines = []; // { layer, a:[x,y,z], b:[x,y,z] }

  // Walls: each extruded to its own height as a vertical quad.
  let maxH = 0;
  for (const wg of geo.wallGeom) {
    const h = wallHeightOf(space, wg.id);
    if (h > maxH) maxH = h;
    faces.push({
      layer: "WALL",
      pts: [
        [wg.a[0], wg.a[1], 0],
        [wg.b[0], wg.b[1], 0],
        [wg.b[0], wg.b[1], h],
        [wg.a[0], wg.a[1], h],
      ],
    });
  }
  if (maxH === 0) maxH = DEFAULT_WALL_H;

  // Floor (z=0) + ceiling (z=maxH): fan-triangulated over the outline vertices.
  const V = geo.verts;
  for (let i = 1; i < V.length - 1; i++) {
    faces.push({ layer: FLOOR_LAYER, pts: [[V[0][0], V[0][1], 0], [V[i][0], V[i][1], 0], [V[i + 1][0], V[i + 1][1], 0]] });
    faces.push({ layer: "CEIL", pts: [[V[0][0], V[0][1], maxH], [V[i][0], V[i][1], maxH], [V[i + 1][0], V[i + 1][1], maxH]] });
  }

  // Each placed element → a small 3D cross marker (~100 mm arms).
  const d = 100;
  for (const place of placements || []) {
    const def = find(place.catalogId);
    if (!def) continue;
    for (const m of worldMarkers(place, def, geo)) {
      lines.push({ layer: def.layer, a: [m[0] - d, m[1], m[2]], b: [m[0] + d, m[1], m[2]] });
      lines.push({ layer: def.layer, a: [m[0], m[1] - d, m[2]], b: [m[0], m[1] + d, m[2]] });
    }
  }

  return toDxf3d(faces, lines);
}

function toDxf3d(faces, lines) {
  const out = [];
  const g = (code, val) => { out.push(String(code)); out.push(String(val)); };

  const layerSet = new Set(["WALL", FLOOR_LAYER, "CEIL"]);
  for (const f of faces) layerSet.add(f.layer);
  for (const l of lines) layerSet.add(l.layer);
  const layers = [...layerSet];

  // HEADER
  g(0, "SECTION"); g(2, "HEADER");
  g(9, "$ACADVER"); g(1, "AC1009");
  g(9, "$INSUNITS"); g(70, 4);
  g(0, "ENDSEC");

  // TABLES (LAYER)
  g(0, "SECTION"); g(2, "TABLES");
  g(0, "TABLE"); g(2, "LAYER"); g(70, layers.length);
  for (const name of layers) {
    g(0, "LAYER"); g(2, name); g(70, 0); g(62, layerColor(name)); g(6, "CONTINUOUS");
  }
  g(0, "ENDTAB");
  g(0, "ENDSEC");

  // ENTITIES
  g(0, "SECTION"); g(2, "ENTITIES");
  for (const f of faces) {
    const p = f.pts;
    const p4 = p[3] || p[2]; // triangle → repeat 3rd corner
    g(0, "3DFACE"); g(8, f.layer);
    g(10, fmt(p[0][0])); g(20, fmt(p[0][1])); g(30, fmt(p[0][2]));
    g(11, fmt(p[1][0])); g(21, fmt(p[1][1])); g(31, fmt(p[1][2]));
    g(12, fmt(p[2][0])); g(22, fmt(p[2][1])); g(32, fmt(p[2][2]));
    g(13, fmt(p4[0])); g(23, fmt(p4[1])); g(33, fmt(p4[2]));
  }
  for (const l of lines) {
    g(0, "LINE"); g(8, l.layer);
    g(10, fmt(l.a[0])); g(20, fmt(l.a[1])); g(30, fmt(l.a[2]));
    g(11, fmt(l.b[0])); g(21, fmt(l.b[1])); g(31, fmt(l.b[2]));
  }
  g(0, "ENDSEC");
  g(0, "EOF");
  return out.join("\n") + "\n";
}

module.exports = { elevationDxf, elevationSvg, dxf3d, elevationPrimitives };
