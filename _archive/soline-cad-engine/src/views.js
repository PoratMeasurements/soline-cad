// ============================================================================
// Soline CAD Engine · View renderer (SVG)
// ----------------------------------------------------------------------------
// Projects the same geometry model into clean, dimensioned SVG views for the
// PDF report: plan (top), front elevation, side elevation. mm coordinates,
// Y-flipped to real-world up. Classes are styled by report.js.
// ============================================================================

"use strict";

const { modelBounds, rectCorners, cutoutAbs } = require("./model");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function poly(points, cls) {
  return `<polygon class="${cls}" points="${points.map((p) => p.join(",")).join(" ")}"/>`;
}
function line(a, b, cls) {
  return `<line class="${cls}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
}
function txt(at, s, cls, size, anchor = "middle") {
  return `<text class="${cls}" x="${at[0]}" y="${at[1]}" font-size="${size}" text-anchor="${anchor}">${esc(s)}</text>`;
}
function arrow(at, dir, size) {
  // small filled triangle tick; dir in radians
  const a = dir, s = size;
  const p1 = [at[0], at[1]];
  const p2 = [at[0] - s * Math.cos(a - 0.4), at[1] - s * Math.sin(a - 0.4)];
  const p3 = [at[0] - s * Math.cos(a + 0.4), at[1] - s * Math.sin(a + 0.4)];
  return `<polygon class="arr" points="${p1.join(",")} ${p2.join(",")} ${p3.join(",")}"/>`;
}

/** Horizontal dimension between mapped x1,x2 at mapped y. Label in mm. */
function dimH(x1, x2, y, valueMm) {
  const s = [];
  s.push(line([x1, y], [x2, y], "dim"));
  s.push(arrow([x1, y], 0, 60), arrow([x2, y], Math.PI, 60));
  s.push(txt([(x1 + x2) / 2, y - 40], `${valueMm} מ״מ`, "dimt", 120));
  return s.join("");
}
/** Vertical dimension between mapped y1,y2 at mapped x. */
function dimV(y1, y2, x, valueMm) {
  const s = [];
  s.push(line([x, y1], [x, y2], "dim"));
  s.push(arrow([x, y1], Math.PI / 2, 60), arrow([x, y2], -Math.PI / 2, 60));
  s.push(`<text class="dimt" x="${x + 40}" y="${(y1 + y2) / 2}" font-size="120" text-anchor="middle" transform="rotate(90 ${x + 40} ${(y1 + y2) / 2})">${valueMm} מ״מ</text>`);
  return s.join("");
}

// --- Plan (top view) --------------------------------------------------------
function planSVG(model) {
  const b = modelBounds(model);
  const M = 650;
  const W = b.w + 2 * M, H = b.h + 2 * M;
  const mp = ([x, y]) => [x - b.minX + M, b.maxY - y + M];
  const s = [];

  for (const p of model.panels) {
    s.push(poly(rectCorners(p.rect).map(mp), "wall"));
    const c = mp([p.rect.x + p.rect.w / 2, p.rect.y + p.rect.h / 2]);
    s.push(txt(c, p.name, "lbl", 130));
    for (const cut of p.cutouts) {
      const ca = cutoutAbs(p, cut);
      if (ca.kind === "circle") {
        const cc = mp([ca.cx, ca.cy]);
        s.push(`<circle class="cut" cx="${cc[0]}" cy="${cc[1]}" r="${ca.r}"/>`);
      } else {
        s.push(poly(rectCorners(ca).map(mp), "cut"));
        s.push(txt(mp([ca.x + ca.w / 2, ca.y + ca.h / 2]), ca.name, "cutlbl", 95));
      }
    }
  }

  // dimensions on MAIN
  const main = model.panels.find((p) => p.id === "MAIN");
  if (main) {
    const r = main.rect;
    const bl = mp([r.x, r.y]), br = mp([r.x + r.w, r.y]);
    s.push(dimH(bl[0], br[0], bl[1] + 320, r.w)); // overall length below
    const tr = mp([r.x + r.w, r.y + r.h]);
    s.push(dimV(br[1], tr[1], br[0] + 320, r.h)); // depth on right
    const sink = main.cutouts.find((c) => c.name === "SINK");
    if (sink) {
      const s1 = mp([r.x + sink.x, r.y + sink.y]);
      const s2 = mp([r.x + sink.x + sink.w, r.y + sink.y]);
      s.push(dimH(s1[0], s2[0], s1[1] + 150, sink.w));
    }
  }
  return svgWrap(W, H, s.join("\n"));
}

// --- Front elevation --------------------------------------------------------
function frontSVG(model) {
  const e = model.elevation;
  const panel = model.panels.find((p) => p.id === e.panelId);
  const width = panel.rect.w;
  const topZ = e.ceilingClearance;
  const M = 700;
  const W = width + 2 * M + 400, H = topZ + 2 * M;
  const mp = ([x, z]) => [x + M, topZ - z + M]; // x along width, z up
  const s = [];

  // floor
  s.push(line(mp([-200, 0]), mp([width + 200, 0]), "floor"));
  // cabinets 0..cabinetHeight
  s.push(poly([mp([0, 0]), mp([width, 0]), mp([width, e.cabinetHeight]), mp([0, e.cabinetHeight])], "cab"));
  // cabinet door divisions
  for (let x = 600; x < width; x += 600) s.push(line(mp([x, 0]), mp([x, e.cabinetHeight]), "cabline"));
  // slab band
  const st = e.cabinetHeight, sb = e.cabinetHeight + e.slabThickness;
  s.push(poly([mp([-30, st]), mp([width + 30, st]), mp([width + 30, sb]), mp([-30, sb])], "slab"));
  // backsplash band
  const bt = sb + e.backsplashHeight;
  s.push(poly([mp([0, sb]), mp([width, sb]), mp([width, bt]), mp([0, bt])], "splash"));
  // ceiling line
  s.push(line(mp([-200, topZ]), mp([width + 200, topZ]), "ceil"));
  s.push(txt(mp([width / 2, topZ + 90]), "תקרה", "lbl", 120));

  // dims: cabinet height (left), backsplash (mid-left), clearance (right)
  s.push(dimV(mp([0, 0])[1], mp([0, e.cabinetHeight])[1], M - 250, e.cabinetHeight));
  s.push(dimV(mp([0, sb])[1], mp([0, bt])[1], M - 120, e.backsplashHeight));
  s.push(dimV(mp([0, 0])[1], mp([0, topZ])[1], M + width + 250, topZ));
  // slab thickness callout
  s.push(txt(mp([width + 260, (st + sb) / 2]), `לוח ${e.slabThickness}`, "note", 100, "start"));
  return svgWrap(W, H, s.join("\n"));
}

// --- Side elevation ---------------------------------------------------------
function sideSVG(model) {
  const e = model.elevation;
  const panel = model.panels.find((p) => p.id === e.panelId);
  const depth = panel.rect.h;
  const topZ = e.cabinetHeight + e.slabThickness + e.backsplashHeight + 200;
  const M = 600;
  const W = depth + 2 * M + 300, H = topZ + 2 * M;
  const mp = ([d, z]) => [d + M, topZ - z + M];
  const s = [];
  s.push(line(mp([-150, 0]), mp([depth + 150, 0]), "floor"));
  // cabinet
  s.push(poly([mp([0, 0]), mp([depth, 0]), mp([depth, e.cabinetHeight]), mp([0, e.cabinetHeight])], "cab"));
  // slab with front overhang
  const st = e.cabinetHeight, sb = st + e.slabThickness;
  s.push(poly([mp([-40, st]), mp([depth, st]), mp([depth, sb]), mp([-40, sb])], "slab"));
  // backsplash at back (depth side)
  const bt = sb + e.backsplashHeight;
  s.push(poly([mp([depth - 30, sb]), mp([depth, sb]), mp([depth, bt]), mp([depth - 30, bt])], "splash"));
  // dims
  s.push(dimH(mp([0, 0])[0], mp([depth, 0])[0], mp([0, 0])[1] + 320, depth));
  s.push(dimV(mp([0, 0])[1], mp([0, e.cabinetHeight])[1], M - 250, e.cabinetHeight));
  s.push(txt(mp([depth + 200, (st + sb) / 2]), `${e.slabThickness}`, "note", 100, "start"));
  return svgWrap(W, H, s.join("\n"));
}

function svgWrap(W, H, body) {
  return `<svg viewBox="0 0 ${Math.round(W)} ${Math.round(H)}" class="dwg" xmlns="http://www.w3.org/2000/svg" role="img">${body}</svg>`;
}

module.exports = { planSVG, frontSVG, sideSVG };
