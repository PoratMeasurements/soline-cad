'use strict';

/**
 * Soline Measurement Engine — DXF symbol / glyph library.
 *
 * Self-contained, zero dependencies. Draws recognisable 2D glyphs for each
 * catalog symbol type, returning neutral primitives in world millimetres (z=0).
 *
 * Primitive shapes (all coordinates in world mm):
 *   {t:'line',   a:[x,y], b:[x,y], layer}
 *   {t:'circle', c:[x,y], r, layer}
 *   {t:'poly',   pts:[[x,y],...], closed:true|false, layer}
 *   {t:'text',   at:[x,y], h, s, layer}
 *
 * Contract: module.exports = { SYMBOLS, DEFAULT_SYMBOL, LAYER_COLORS }.
 */

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function L(a, b, layer) { return { t: 'line', a: a, b: b, layer: layer }; }
function C(c, r, layer) { return { t: 'circle', c: c, r: r, layer: layer }; }
function P(pts, closed, layer) { return { t: 'poly', pts: pts, closed: !!closed, layer: layer }; }
function T(at, h, s, layer) { return { t: 'text', at: at, h: h, s: s, layer: layer }; }

function sz(ctx) {
  var s = (ctx && typeof ctx.sizeMm === 'number' && ctx.sizeMm > 0) ? ctx.sizeMm : 120;
  return s;
}

function pointsOf(ctx) {
  return (ctx && Array.isArray(ctx.points) && ctx.points.length) ? ctx.points : [[0, 0]];
}

// Arc approximated by a polyline of n points, sweeping from a0 to a1 (radians).
function arcPts(cx, cy, r, a0, a1, n) {
  n = n || 10;
  var out = [];
  for (var i = 0; i <= n; i++) {
    var t = a0 + (a1 - a0) * (i / n);
    out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return out;
}

// Full circle approximated as a closed poly (for glyphs that want a poly circle).
function circlePoly(cx, cy, r, n) {
  n = n || 12;
  var out = [];
  for (var i = 0; i < n; i++) {
    var t = (Math.PI * 2) * (i / n);
    out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return out;
}

function unit(a, b) {
  var dx = b[0] - a[0], dy = b[1] - a[1];
  var len = Math.hypot(dx, dy) || 1;
  return { ux: dx / len, uy: dy / len, len: len, nx: -dy / len, ny: dx / len };
}

// Draw the glyph produced by fn(cx, cy, s) at each point of the ctx.
function atEach(ctx, fn) {
  var out = [];
  var pts = pointsOf(ctx);
  var s = sz(ctx);
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i];
    var g = fn(p[0], p[1], s, ctx);
    for (var j = 0; j < g.length; j++) out.push(g[j]);
  }
  return out;
}

// A span symbol needs two endpoints; fall back to a short segment if only one.
function spanEnds(ctx) {
  var pts = pointsOf(ctx);
  var a = pts[0] || [0, 0];
  var b = pts[1];
  if (!b) { var s = sz(ctx); b = [a[0] + s * 4, a[1]]; }
  return [a, b];
}

// ---------------------------------------------------------------------------
// Point / array glyph builders
// ---------------------------------------------------------------------------

// A solid-ish dot: small circle.
function gDot(x, y, s, ctx) {
  return [C([x, y], s * 0.15, ctx.layer)];
}

// A ring / circle.
function gCircle(x, y, s, ctx) {
  return [C([x, y], s * 0.5, ctx.layer)];
}

// A box / square.
function gBox(x, y, s, ctx) {
  var h = s * 0.5;
  return [P([[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]], true, ctx.layer)];
}

// Floorbox: square with an inner square.
function gFloorbox(x, y, s, ctx) {
  var h = s * 0.5, h2 = s * 0.28;
  return [
    P([[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]], true, ctx.layer),
    P([[x - h2, y - h2], [x + h2, y - h2], [x + h2, y + h2], [x - h2, y + h2]], true, ctx.layer)
  ];
}

// Rounded-rectangle poly (corners chamfered by radius rr).
function roundRectPoly(x, y, w, h, rr) {
  rr = Math.min(rr, w, h);
  return [
    [x - w + rr, y - h], [x + w - rr, y - h],
    [x + w, y - h + rr], [x + w, y + h - rr],
    [x + w - rr, y + h], [x - w + rr, y + h],
    [x - w, y + h - rr], [x - w, y - h + rr]
  ];
}

// Ellipse poly (rx, ry) around (x,y).
function ellipsePoly(x, y, rx, ry, n) {
  n = n || 14;
  var out = [];
  for (var i = 0; i < n; i++) {
    var t = (Math.PI * 2) * (i / n);
    out.push([x + rx * Math.cos(t), y + ry * Math.sin(t)]);
  }
  return out;
}

// Outlet (socket): circle with two short parallel prong lines (Schuko feel).
function gOutlet(x, y, s, ctx) {
  var r = s * 0.5;
  return [
    C([x, y], r, ctx.layer),
    L([x - r * 0.35, y - r * 0.45], [x - r * 0.35, y + r * 0.45], ctx.layer),
    L([x + r * 0.35, y - r * 0.45], [x + r * 0.35, y + r * 0.45], ctx.layer)
  ];
}

// Switch: circle with a diagonal lever line to a small dot.
function gSwitch(x, y, s, ctx) {
  var r = s * 0.35;
  var ex = x + r * 1.7, ey = y + r * 1.7;
  return [
    C([x, y], r, ctx.layer),
    L([x, y], [ex, ey], ctx.layer),
    C([ex, ey], s * 0.06, ctx.layer)
  ];
}

// Data / comms outlet: circle with an inner downward triangle (▽).
function gData(x, y, s, ctx) {
  var r = s * 0.5, t = r * 0.62;
  return [
    C([x, y], r, ctx.layer),
    P([[x - t, y + t * 0.7], [x + t, y + t * 0.7], [x, y - t]], true, ctx.layer)
  ];
}

// Spot / downlight: circle with a centre dot.
function gSpot(x, y, s, ctx) {
  var r = s * 0.5;
  return [
    C([x, y], r, ctx.layer),
    C([x, y], s * 0.08, ctx.layer)
  ];
}

// Panel / board: rectangle with a diagonal.
function gPanel(x, y, s, ctx) {
  var w = s * 0.45, h = s * 0.6;
  return [
    P([[x - w, y - h], [x + w, y - h], [x + w, y + h], [x - w, y + h]], true, ctx.layer),
    L([x - w, y - h], [x + w, y + h], ctx.layer)
  ];
}

// Cabinet / enclosure: rectangle with inner shelf lines.
function gCabinet(x, y, s, ctx) {
  var w = s * 0.55, h = s * 0.6;
  return [
    P([[x - w, y - h], [x + w, y - h], [x + w, y + h], [x - w, y + h]], true, ctx.layer),
    L([x - w, y - h * 0.33], [x + w, y - h * 0.33], ctx.layer),
    L([x - w, y + h * 0.33], [x + w, y + h * 0.33], ctx.layer)
  ];
}

// Sensor: circle with two concentric detection arcs.
function gSensor(x, y, s, ctx) {
  var r = s * 0.3;
  return [
    C([x, y], r, ctx.layer),
    P(arcPts(x, y, r * 1.7, -Math.PI / 4, Math.PI / 4, 10), false, ctx.layer),
    P(arcPts(x, y, r * 2.4, -Math.PI / 4, Math.PI / 4, 12), false, ctx.layer)
  ];
}

// Cistern / tank: rounded rectangle.
function gCistern(x, y, s, ctx) {
  var w = s * 0.6, h = s * 0.45;
  return [
    P(roundRectPoly(x, y, w, h, s * 0.18), true, ctx.layer),
    L([x - w * 0.8, y + h * 0.3], [x + w * 0.8, y + h * 0.3], ctx.layer)
  ];
}

// Drain: circle with an X across it (floor drain).
function gDrain(x, y, s, ctx) {
  var r = s * 0.5, d = r * 0.7;
  return [
    C([x, y], r, ctx.layer),
    L([x - d, y - d], [x + d, y + d], ctx.layer),
    L([x - d, y + d], [x + d, y - d], ctx.layer)
  ];
}

// Sink: rounded rectangle + inner oval basin + drain dot.
function gSink(x, y, s, ctx) {
  var w = s * 0.6, h = s * 0.45;
  return [
    P(roundRectPoly(x, y, w, h, s * 0.12), true, ctx.layer),
    P(ellipsePoly(x, y, w * 0.62, h * 0.6, 14), true, ctx.layer),
    C([x, y], s * 0.06, ctx.layer)
  ];
}

// Toilet: tank rectangle behind + oval bowl.
function gToilet(x, y, s, ctx) {
  var out = [];
  // tank
  var tw = s * 0.5, th = s * 0.18;
  out.push(P([[x - tw, y + s * 0.35], [x + tw, y + s * 0.35],
              [x + tw, y + s * 0.35 + th], [x - tw, y + s * 0.35 + th]], true, ctx.layer));
  // oval bowl
  out.push(P(ellipsePoly(x, y + s * 0.1, s * 0.42, s * 0.32, 14), true, ctx.layer));
  return out;
}

// Faucet: small body circle + gooseneck L spout.
function gFaucet(x, y, s, ctx) {
  var r = s * 0.18;
  return [
    C([x, y], r, ctx.layer),
    P([[x, y + r], [x, y + r * 3], [x + r * 2, y + r * 3]], false, ctx.layer)
  ];
}

// Bath: large rounded rectangle tub + inner oval basin + drain.
function gBath(x, y, s, ctx) {
  var w = s * 0.9, h = s * 0.5;
  return [
    P(roundRectPoly(x, y, w, h, s * 0.22), true, ctx.layer),
    P(ellipsePoly(x, y, w * 0.72, h * 0.62, 16), true, ctx.layer),
    C([x + w * 0.55, y], s * 0.06, ctx.layer)
  ];
}

// Valve: two triangles meeting at a point (bowtie) — standard valve glyph.
function gValve(x, y, s, ctx) {
  var w = s * 0.5, h = s * 0.4;
  return [
    P([[x - w, y - h], [x - w, y + h], [x, y]], true, ctx.layer),
    P([[x + w, y - h], [x + w, y + h], [x, y]], true, ctx.layer)
  ];
}

// Niple / nipple (pipe fitting): circle with a centre cross.
function gNiple(x, y, s, ctx) {
  var r = s * 0.28;
  return [
    C([x, y], r, ctx.layer),
    L([x - r, y], [x + r, y], ctx.layer),
    L([x, y - r], [x, y + r], ctx.layer)
  ];
}

// Column: filled-look square (square with inner square), structural.
function gColumn(x, y, s, ctx) {
  var h = s * 0.5, h2 = s * 0.32;
  return [
    P([[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]], true, ctx.layer),
    P([[x - h2, y - h2], [x + h2, y - h2], [x + h2, y + h2], [x - h2, y + h2]], true, ctx.layer)
  ];
}

// Niche (as a point marker fallback): half box open on one side.
function gNichePoint(x, y, s, ctx) {
  var w = s * 0.5, h = s * 0.4;
  return [
    L([x - w, y - h], [x - w, y + h], ctx.layer),
    L([x - w, y + h], [x + w, y + h], ctx.layer),
    L([x - w, y - h], [x + w, y - h], ctx.layer)
  ];
}

// Step (single): a single line with a small direction arrow.
function gStep(x, y, s, ctx) {
  var w = s * 0.5;
  return [
    L([x - w, y], [x + w, y], ctx.layer),
    P([[x + w * 0.6, y + s * 0.12], [x + w, y], [x + w * 0.6, y - s * 0.12]], false, ctx.layer)
  ];
}

// Ceil (ceiling point / access): dashed-looking rectangle (poly of segments).
function gCeil(x, y, s, ctx) {
  var h = s * 0.5, out = [];
  var corners = [[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]];
  for (var e = 0; e < 4; e++) {
    var p0 = corners[e], p1 = corners[(e + 1) % 4];
    var segs = 4;
    for (var d = 0; d < segs; d += 2) {
      var t0 = d / segs, t1 = (d + 1) / segs;
      out.push(L([p0[0] + (p1[0] - p0[0]) * t0, p0[1] + (p1[1] - p0[1]) * t0],
                 [p0[0] + (p1[0] - p0[0]) * t1, p0[1] + (p1[1] - p0[1]) * t1], ctx.layer));
    }
  }
  return out;
}

// HVAC unit: square + inner square + 4 corner slots.
function gHvac(x, y, s, ctx) {
  var w = s * 0.6, w2 = s * 0.4;
  var out = [
    P([[x - w, y - w], [x + w, y - w], [x + w, y + w], [x - w, y + w]], true, ctx.layer),
    P([[x - w2, y - w2], [x + w2, y - w2], [x + w2, y + w2], [x - w2, y + w2]], true, ctx.layer)
  ];
  // 4 corner slots (short ticks from inner square towards outer corners)
  var cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (var i = 0; i < 4; i++) {
    var sx = cs[i][0], sy = cs[i][1];
    out.push(L([x + sx * w2, y + sy * w2], [x + sx * w, y + sy * w], ctx.layer));
  }
  return out;
}

// Hood (kitchen hood): trapezoid.
function gHood(x, y, s, ctx) {
  var w = s * 0.8, wt = s * 0.5, h = s * 0.45;
  return [
    P([[x - w, y - h], [x + w, y - h], [x + wt, y + h], [x - wt, y + h]], true, ctx.layer)
  ];
}

// Stairs (as point marker): a small run of 3 parallel lines with a direction arrow.
function gStairsPoint(x, y, s, ctx) {
  var w = s * 0.6, out = [];
  for (var i = -1; i <= 1; i++) {
    out.push(L([x - w, y + i * s * 0.3], [x + w, y + i * s * 0.3], ctx.layer));
  }
  out.push(L([x, y - s * 0.4], [x, y + s * 0.4], ctx.layer));
  out.push(P([[x - s * 0.12, y + s * 0.25], [x, y + s * 0.4], [x + s * 0.12, y + s * 0.25]], false, ctx.layer));
  return out;
}

// ---------------------------------------------------------------------------
// Span glyph builder: parallel double line along a->b, with end ticks.
// A "spec" object customises the number of parallel lines and gap.
// ---------------------------------------------------------------------------

// Build a short size label from def.dims (never throws; '' if nothing useful).
function dimText(ctx) {
  var d = ctx && ctx.def && ctx.def.dims;
  if (!d || typeof d !== 'object') return '';
  if (d.diaMm != null) return 'O' + d.diaMm;              // O stands in for diameter
  if (d.widthMm != null && d.heightMm != null) return d.widthMm + 'x' + d.heightMm;
  if (d.widthMm != null) return String(d.widthMm);
  if (d.sizeMm != null) return String(d.sizeMm);
  var keys = Object.keys(d);
  for (var i = 0; i < keys.length; i++) {
    if (typeof d[keys[i]] === 'number') return String(d[keys[i]]);
  }
  return '';
}

function spanGlyph(ctx, opt) {
  opt = opt || {};
  var ends = spanEnds(ctx);
  var a = ends[0], b = ends[1];
  var u = unit(a, b);
  var s = sz(ctx);
  var gap = (typeof opt.gap === 'number') ? opt.gap : s * 0.18;
  var nLines = opt.nLines || 2;
  var out = [];

  if (nLines === 1) {
    out.push(L(a, b, ctx.layer));
  } else {
    // symmetric parallel offsets across the width
    var half = (nLines - 1) / 2;
    for (var i = 0; i < nLines; i++) {
      var off = (i - half) * gap;
      var oa = [a[0] + u.nx * off, a[1] + u.ny * off];
      var ob = [b[0] + u.nx * off, b[1] + u.ny * off];
      out.push(L(oa, ob, ctx.layer));
    }
  }

  // End ticks (perpendicular caps) unless suppressed.
  if (opt.ticks !== false) {
    var tk = s * 0.28;
    out.push(L([a[0] + u.nx * tk, a[1] + u.ny * tk], [a[0] - u.nx * tk, a[1] - u.ny * tk], ctx.layer));
    out.push(L([b[0] + u.nx * tk, b[1] + u.ny * tk], [b[0] - u.nx * tk, b[1] - u.ny * tk], ctx.layer));
  }

  // Optional midline dashes-as-ticks (e.g. tray, grille) drawn as short cross bars.
  if (opt.rungs) {
    var n = Math.max(2, Math.floor(u.len / (s * 0.6)));
    var rw = s * 0.2;
    for (var j = 1; j < n; j++) {
      var t = j / n;
      var px = a[0] + u.ux * u.len * t;
      var py = a[1] + u.uy * u.len * t;
      out.push(L([px + u.nx * rw, py + u.ny * rw], [px - u.nx * rw, py - u.ny * rw], ctx.layer));
    }
  }

  // Optional size text at the midpoint (offset just off the span line).
  if (opt.label) {
    var txt = dimText(ctx);
    if (txt) {
      var mx = a[0] + u.ux * u.len * 0.5;
      var my = a[1] + u.uy * u.len * 0.5;
      var off = s * 0.35;
      out.push(T([mx + u.nx * off, my + u.ny * off], s * 0.3, txt, ctx.layer));
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Opening glyph builders: between points[0] and points[1].
// ---------------------------------------------------------------------------

// Door: jamb marks at both ends + a 90° swing arc (poly) + leaf line.
function openingDoor(ctx) {
  var ends = spanEnds(ctx);
  var a = ends[0], b = ends[1];
  var u = unit(a, b);
  var s = sz(ctx);
  var jt = s * 0.2;
  var out = [];
  // jamb ticks
  out.push(L([a[0] + u.nx * jt, a[1] + u.ny * jt], [a[0] - u.nx * jt, a[1] - u.ny * jt], ctx.layer));
  out.push(L([b[0] + u.nx * jt, b[1] + u.ny * jt], [b[0] - u.nx * jt, b[1] - u.ny * jt], ctx.layer));
  // leaf: from a, perpendicular, length = opening width
  var w = u.len;
  var leafEnd = [a[0] + u.nx * w, a[1] + u.ny * w];
  out.push(L(a, leafEnd, ctx.layer));
  // swing arc from b to leafEnd, centre a, radius w
  var a0 = Math.atan2(b[1] - a[1], b[0] - a[0]);
  var a1 = Math.atan2(leafEnd[1] - a[1], leafEnd[0] - a[0]);
  out.push(P(arcPts(a[0], a[1], w, a0, a1, 10), false, ctx.layer));
  return out;
}

// Frame (door/opening frame, no leaf): a thin rectangle spanning the opening.
function openingFrame(ctx) {
  var ends = spanEnds(ctx);
  var a = ends[0], b = ends[1];
  var u = unit(a, b);
  var s = sz(ctx);
  var d = s * 0.18;
  return [
    P([[a[0] + u.nx * d, a[1] + u.ny * d], [b[0] + u.nx * d, b[1] + u.ny * d],
       [b[0] - u.nx * d, b[1] - u.ny * d], [a[0] - u.nx * d, a[1] - u.ny * d]], true, ctx.layer)
  ];
}

// Window: triple parallel line across the opening + jamb ticks.
function openingWindow(ctx) {
  var ends = spanEnds(ctx);
  var a = ends[0], b = ends[1];
  var u = unit(a, b);
  var s = sz(ctx);
  var gap = s * 0.12, jt = s * 0.2;
  var out = [];
  for (var i = -1; i <= 1; i++) {
    var off = i * gap;
    out.push(L([a[0] + u.nx * off, a[1] + u.ny * off],
               [b[0] + u.nx * off, b[1] + u.ny * off], ctx.layer));
  }
  out.push(L([a[0] + u.nx * jt, a[1] + u.ny * jt], [a[0] - u.nx * jt, a[1] - u.ny * jt], ctx.layer));
  out.push(L([b[0] + u.nx * jt, b[1] + u.ny * jt], [b[0] - u.nx * jt, b[1] - u.ny * jt], ctx.layer));
  return out;
}

// Shutter: opening line + a rectangle (box) set above the opening.
function openingShutter(ctx) {
  var ends = spanEnds(ctx);
  var a = ends[0], b = ends[1];
  var u = unit(a, b);
  var s = sz(ctx);
  var depth = s * 0.32;
  var a2 = [a[0] + u.nx * depth, a[1] + u.ny * depth];
  var b2 = [b[0] + u.nx * depth, b[1] + u.ny * depth];
  return [
    L(a, b, ctx.layer),
    P([a, b, b2, a2], true, ctx.layer)
  ];
}

// Sill / ledge: line along the span with small perpendicular "ears" at ends.
function openingSill(ctx) {
  var ends = spanEnds(ctx);
  var a = ends[0], b = ends[1];
  var u = unit(a, b);
  var s = sz(ctx);
  var d = s * 0.18;
  return [
    L(a, b, ctx.layer),
    L([a[0] + u.nx * d, a[1] + u.ny * d], [a[0] - u.nx * d, a[1] - u.ny * d], ctx.layer),
    L([b[0] + u.nx * d, b[1] + u.ny * d], [b[0] - u.nx * d, b[1] - u.ny * d], ctx.layer)
  ];
}

// Wall: single heavy line along the span (double line for thickness) + no ticks.
function spanWall(ctx) {
  return spanGlyph(ctx, { nLines: 2, ticks: false, gap: sz(ctx) * 0.12 });
}

// Niche (as a span/opening): recess rectangle + an inner offset rectangle.
function openingNiche(ctx) {
  var ends = spanEnds(ctx);
  var a = ends[0], b = ends[1];
  var u = unit(a, b);
  var s = sz(ctx);
  var d = s * 0.4;
  var a2 = [a[0] + u.nx * d, a[1] + u.ny * d];
  var b2 = [b[0] + u.nx * d, b[1] + u.ny * d];
  // inner offset rectangle (inset from the opening edges and depth)
  var ia = [a[0] + u.ux * u.len * 0.15 + u.nx * (d * 0.35), a[1] + u.uy * u.len * 0.15 + u.ny * (d * 0.35)];
  var ib = [b[0] - u.ux * u.len * 0.15 + u.nx * (d * 0.35), b[1] - u.uy * u.len * 0.15 + u.ny * (d * 0.35)];
  var ib2 = [ib[0] + u.nx * (d * 0.5), ib[1] + u.ny * (d * 0.5)];
  var ia2 = [ia[0] + u.nx * (d * 0.5), ia[1] + u.ny * (d * 0.5)];
  return [
    P([a, a2, b2, b], false, ctx.layer),
    P([ia, ib, ib2, ia2], true, ctx.layer)
  ];
}

// Stairs (span): a ladder of treads across the run + a direction line.
function spanStairs(ctx) {
  var ends = spanEnds(ctx);
  var a = ends[0], b = ends[1];
  var u = unit(a, b);
  var s = sz(ctx);
  var w = s * 0.5;
  var out = [];
  // side rails
  out.push(L([a[0] + u.nx * w, a[1] + u.ny * w], [b[0] + u.nx * w, b[1] + u.ny * w], ctx.layer));
  out.push(L([a[0] - u.nx * w, a[1] - u.ny * w], [b[0] - u.nx * w, b[1] - u.ny * w], ctx.layer));
  // treads
  var n = Math.max(3, Math.floor(u.len / (s * 0.5)));
  for (var i = 0; i <= n; i++) {
    var t = i / n;
    var px = a[0] + u.ux * u.len * t, py = a[1] + u.uy * u.len * t;
    out.push(L([px + u.nx * w, py + u.ny * w], [px - u.nx * w, py - u.ny * w], ctx.layer));
  }
  return out;
}

// ---------------------------------------------------------------------------
// SYMBOLS map
// ---------------------------------------------------------------------------

var SYMBOLS = {
  // --- generic points ---
  dot: function (ctx) { return atEach(ctx, gDot); },
  circle: function (ctx) { return atEach(ctx, gCircle); },
  box: function (ctx) { return atEach(ctx, gBox); },

  // --- electrical points ---
  floorbox: function (ctx) { return atEach(ctx, gFloorbox); },
  outlet: function (ctx) { return atEach(ctx, gOutlet); },
  switch: function (ctx) { return atEach(ctx, gSwitch); },
  data: function (ctx) { return atEach(ctx, gData); },
  panel: function (ctx) { return atEach(ctx, gPanel); },
  cabinet: function (ctx) { return atEach(ctx, gCabinet); },
  sensor: function (ctx) { return atEach(ctx, gSensor); },

  // --- lighting points ---
  spot: function (ctx) { return atEach(ctx, gSpot); },

  // --- plumbing / sanitary points ---
  niple: function (ctx) { return atEach(ctx, gNiple); },
  cistern: function (ctx) { return atEach(ctx, gCistern); },
  drain: function (ctx) { return atEach(ctx, gDrain); },
  sink: function (ctx) { return atEach(ctx, gSink); },
  toilet: function (ctx) { return atEach(ctx, gToilet); },
  faucet: function (ctx) { return atEach(ctx, gFaucet); },
  bath: function (ctx) { return atEach(ctx, gBath); },
  valve: function (ctx) { return atEach(ctx, gValve); },

  // --- structural / architectural points ---
  column: function (ctx) { return atEach(ctx, gColumn); },
  step: function (ctx) { return atEach(ctx, gStep); },
  ceil: function (ctx) { return atEach(ctx, gCeil); },

  // --- hvac points ---
  hvac: function (ctx) { return atEach(ctx, gHvac); },
  hood: function (ctx) { return atEach(ctx, gHood); },

  // --- span symbols (drawn along points[0] -> points[1]) ---
  conduit: function (ctx) { return spanGlyph(ctx, { nLines: 2, label: true }); },
  pipe: function (ctx) { return spanGlyph(ctx, { nLines: 2, gap: sz(ctx) * 0.22, label: true }); },
  tray: function (ctx) { return spanGlyph(ctx, { nLines: 2, rungs: true, gap: sz(ctx) * 0.3, label: true }); },
  led: function (ctx) { return spanGlyph(ctx, { nLines: 1, rungs: true }); },
  track: function (ctx) { return spanGlyph(ctx, { nLines: 2, rungs: true, gap: sz(ctx) * 0.14 }); },
  channel: function (ctx) { return spanGlyph(ctx, { nLines: 2, rungs: true, gap: sz(ctx) * 0.3 }); },
  duct: function (ctx) { return spanGlyph(ctx, { nLines: 2, gap: sz(ctx) * 0.45, label: true }); },
  grille: function (ctx) { return spanGlyph(ctx, { nLines: 2, rungs: true, gap: sz(ctx) * 0.35 }); },

  // --- opening symbols (drawn between points[0] and points[1]) ---
  door: function (ctx) { return openingDoor(ctx); },
  frame: function (ctx) { return openingFrame(ctx); },
  window: function (ctx) { return openingWindow(ctx); },
  shutter: function (ctx) { return openingShutter(ctx); },
  sill: function (ctx) { return openingSill(ctx); },

  // --- wall / niche / stairs (span-like) ---
  wall: function (ctx) { return spanWall(ctx); },
  niche: function (ctx) { return openingNiche(ctx); },
  stairs: function (ctx) { return spanStairs(ctx); }
};

// ---------------------------------------------------------------------------
// DEFAULT_SYMBOL: small square + text label at each point.
// ---------------------------------------------------------------------------

function DEFAULT_SYMBOL(ctx) {
  var s = sz(ctx);
  var label = (ctx && ctx.def && ctx.def.symbol != null) ? String(ctx.def.symbol) : '?';
  return atEach(ctx, function (x, y, ss, c) {
    var h = ss * 0.4;
    return [
      P([[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]], true, c.layer),
      T([x - h, y + h + ss * 0.1], ss * 0.35, label, c.layer)
    ];
  });
}

// ---------------------------------------------------------------------------
// LAYER_COLORS: layer name -> AutoCAD Color Index (1-255).
//   1 red, 2 yellow, 3 green, 4 cyan, 5 blue, 6 magenta, 7 white/black,
//   8 dark grey, 9 light grey, 30 orange/amber, 40 amber, 140 teal, 250 grey.
// ---------------------------------------------------------------------------

var LAYER_COLORS = {
  // Electrical — yellow family
  'ELEC-CONDUIT': 2,
  'ELEC-TRAY': 2,
  'ELEC-BOX': 2,
  'ELEC-OUTLET': 2,
  'ELEC-SWITCH': 51,
  'ELEC-DATA': 3,
  'ELEC-PANEL': 6,
  'ELEC-CABINET': 6,
  'ELEC-SENSOR': 4,
  'ELEC-FLOORBOX': 2,
  'ELEC': 2,

  // Plumbing — cyan family
  'PLUMB-PIPE': 4,
  'PLUMB-DRAIN': 4,
  'PLUMB-VALVE': 4,
  'PLUMB-NIPLE': 141,
  'PLUMB-CISTERN': 4,
  'PLUMB': 4,

  // Lighting — amber / orange family
  'LIGHT-SPOT': 40,
  'LIGHT-LED': 30,
  'LIGHT-TRACK': 40,
  'LIGHT-PANEL': 40,
  'LIGHT': 40,

  // Walls — white
  'WALL': 7,
  'WALL-INT': 7,
  'WALL-EXT': 8,

  // Doors / windows — green family
  'DOOR': 3,
  'DOORS': 3,
  'DOOR-FRAME': 90,
  'WINDOW': 3,
  'SHUTTER': 90,
  'SILL': 92,
  'FRAME': 90,

  // HVAC — magenta family
  'HVAC': 6,
  'HVAC-DUCT': 6,
  'HVAC-GRILLE': 210,
  'HVAC-HOOD': 200,

  // Sanitary / gas
  'SANITARY': 4,
  'GAS': 1,

  // Architectural features
  'NICHE': 30,
  'STAIRS': 8,
  'COLUMN': 9,
  'LEVEL': 250,

  // Ceiling
  'CEIL': 140,
  'CEIL-GRID': 140,

  // Floor
  'FLOOR': 250,
  'FLOOR-BOX': 2,

  // Generic / fallback
  'GEN': 7,
  'DEFAULT': 7
};

// Resolver: exact match, then prefix family, then DEFAULT.
LAYER_COLORS.resolve = function (layer) {
  if (layer == null) return LAYER_COLORS.DEFAULT;
  if (Object.prototype.hasOwnProperty.call(LAYER_COLORS, layer)) return LAYER_COLORS[layer];
  var up = String(layer).toUpperCase();
  var families = [
    ['ELEC', 2], ['PLUMB', 4], ['LIGHT', 40], ['WALL', 7],
    ['DOOR', 3], ['WINDOW', 3], ['SHUTTER', 90], ['SILL', 92], ['FRAME', 90],
    ['HVAC', 6], ['SANITARY', 4], ['GAS', 1], ['NICHE', 30], ['STAIRS', 8],
    ['CEIL', 140], ['COLUMN', 9], ['LEVEL', 250], ['FLOOR', 250], ['GEN', 7]
  ];
  for (var i = 0; i < families.length; i++) {
    if (up.indexOf(families[i][0]) === 0) return families[i][1];
  }
  return LAYER_COLORS.DEFAULT;
};

module.exports = { SYMBOLS: SYMBOLS, DEFAULT_SYMBOL: DEFAULT_SYMBOL, LAYER_COLORS: LAYER_COLORS };
