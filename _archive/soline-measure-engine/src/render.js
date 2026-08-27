// ============================================================================
// Soline Measurement Engine · Space renderer (SVG)
// ----------------------------------------------------------------------------
// Draws the built measurement space top-down so the surveyor can SEE it — a
// control in itself. Shows walls + dimensions, corners, openings (window/door),
// service points (colour-coded), the closure gap (red) if the outline fails,
// and diagonals used for cross-check.
// ============================================================================

"use strict";

const { pointOnWall } = require("./space");
const { SERVICE_TYPES } = require("./elements");

const SVC_COLOR = {
  outlet: "#0d6fbf", water: "#0aa5c8", drain: "#6a7a95",
  gas: "#c67c10", switch: "#7a3ec8", network: "#0a9d63",
};

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

function renderSpace(space, result) {
  const geo = result.geo;
  const pts = geo.verts.concat([geo.closurePoint]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const M = 700;
  const W = (maxX - minX) + 2 * M, H = (maxY - minY) + 2 * M;
  const mp = ([x, y]) => [x - minX + M, maxY - y + M]; // flip Y (up = north)

  const s = [];

  // room fill (V0..Vn-1)
  const ring = geo.verts.map(mp).map((p) => p.join(",")).join(" ");
  s.push(`<polygon class="room" points="${ring}"/>`);

  // walls + length dimensions
  geo.wallGeom.forEach((wg) => {
    const a = mp(wg.a), b = mp(wg.b);
    s.push(`<line class="wall" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    // offset label outward-ish (above the segment)
    s.push(`<text class="wdim" x="${mid[0]}" y="${mid[1] - 22}" text-anchor="middle" font-size="120">${Math.round(wg.length)}</text>`);
    s.push(`<text class="wlbl" x="${a[0]}" y="${a[1]}" font-size="95" dx="18" dy="120">${esc(wg.id)}</text>`);
  });

  // corners
  geo.verts.forEach((v, i) => {
    const p = mp(v);
    s.push(`<circle class="corner" cx="${p[0]}" cy="${p[1]}" r="34"/>`);
    s.push(`<text class="clbl" x="${p[0]}" y="${p[1] + 40}" text-anchor="middle" font-size="90">V${i}</text>`);
  });

  // diagonals (cross-check)
  space.diagonals.forEach((d) => {
    const a = geo.verts[d.fromCorner], b = geo.verts[d.toCorner];
    if (!a || !b) return;
    const pa = mp(a), pb = mp(b);
    s.push(`<line class="diag" x1="${pa[0]}" y1="${pa[1]}" x2="${pb[0]}" y2="${pb[1]}"/>`);
  });

  // openings — thick coloured segment along the wall
  space.openings.forEach((o) => {
    const p1 = pointOnWall(geo, o.wallId, o.offset.value);
    const p2 = pointOnWall(geo, o.wallId, o.offset.value + o.width.value);
    if (!p1 || !p2) return;
    const a = mp(p1), b = mp(p2);
    const cls = o.type === "window" ? "op-win" : "op-door";
    s.push(`<line class="${cls}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    s.push(`<text class="oplbl" x="${mid[0]}" y="${mid[1] - 30}" text-anchor="middle" font-size="90">${o.type === "window" ? "חלון" : o.type === "door" ? "דלת" : "מעבר"} ${Math.round(o.width.value)}</text>`);
  });

  // services — coloured dots
  space.services.forEach((sv) => {
    const p = pointOnWall(geo, sv.wallId, sv.offset.value);
    if (!p) return;
    const m = mp(p);
    s.push(`<circle cx="${m[0]}" cy="${m[1]}" r="42" fill="${SVC_COLOR[sv.type] || "#333"}"/>`);
    s.push(`<text class="svlbl" x="${m[0]}" y="${m[1] - 60}" text-anchor="middle" font-size="80">${esc(SERVICE_TYPES[sv.type] || sv.type)}</text>`);
  });

  // closure gap (if the outline failed to close)
  if (geo.closureError > result.tol.closureMm) {
    const a = mp(geo.verts[0]), b = mp(geo.closurePoint);
    s.push(`<line class="gap" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    s.push(`<text class="gaptxt" x="${mid[0]}" y="${mid[1] - 30}" text-anchor="middle" font-size="130">פער ${Math.round(geo.closureError)} מ״מ</text>`);
  }

  return `<svg viewBox="0 0 ${Math.round(W)} ${Math.round(H)}" class="space" xmlns="http://www.w3.org/2000/svg" role="img">${s.join("")}</svg>`;
}

module.exports = { renderSpace };
