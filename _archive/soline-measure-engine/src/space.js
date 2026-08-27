// ============================================================================
// Soline Measurement Engine · Space Builder & Geometry
// ----------------------------------------------------------------------------
// Turns the surveyor's elements into a precise, closed measurement space by
// TRAVERSE: starting at an origin and a bearing, each wall is laid down by its
// length, then the heading rotates by the interior angle at the corner. The
// outline must return to the origin — the "closure" — which is the single most
// powerful error check in surveying.
//
// Derived geometry (vertices, closure error, angle sum, area, opening world
// positions, computed diagonals) is what the control engine checks against.
// ============================================================================

"use strict";

const D2R = Math.PI / 180;

/** Fluent builder so composing a space reads like the surveyor's workflow. */
function createSpace(meta) {
  const space = {
    meta: meta || {},
    startBearing: 0,
    walls: [], openings: [], services: [], obstacles: [], clearances: [], diagonals: [],
  };
  return {
    startBearing(b) { space.startBearing = b; return this; },
    addWall(w) { space.walls.push(w); return this; },
    addOpening(o) { space.openings.push(o); return this; },
    addService(s) { space.services.push(s); return this; },
    addObstacle(o) { space.obstacles.push(o); return this; },
    addClearance(c) { space.clearances.push(c); return this; },
    addDiagonal(d) { space.diagonals.push(d); return this; },
    build() { return space; },
  };
}

/** Traverse the walls into vertices + derived geometry. */
function computeGeometry(space) {
  const n = space.walls.length;
  const verts = [[0, 0]];
  let p = [0, 0];
  let bearing = space.startBearing || 0;

  for (let i = 0; i < n; i++) {
    const L = space.walls[i].length.value;
    const r = bearing * D2R;
    p = [p[0] + L * Math.cos(r), p[1] + L * Math.sin(r)];
    if (i < n - 1) verts.push([p[0], p[1]]); // V1 … V(n-1); Vn is the closure point
    bearing += 180 - space.walls[i].cornerAngle.value; // turn left by exterior angle
  }

  const closurePoint = p; // should coincide with V0
  const closureError = Math.hypot(closurePoint[0] - verts[0][0], closurePoint[1] - verts[0][1]);
  const angleSum = space.walls.reduce((s, w) => s + w.cornerAngle.value, 0);
  const measuredPerimeter = space.walls.reduce((s, w) => s + w.length.value, 0);

  // area (shoelace over V0..V(n-1))
  let area = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i], b = verts[(i + 1) % verts.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  area = Math.abs(area) / 2;

  // world position + endpoints of each wall
  const wallGeom = space.walls.map((w, i) => {
    const a = verts[i], b = verts[(i + 1) % verts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const dir = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    return { id: w.id, a, b, dir, length: w.length.value };
  });

  return { n, verts, closurePoint, closureError, angleSum, measuredPerimeter, area, wallGeom };
}

/** Absolute point of an opening/service on its host wall (from geometry). */
function pointOnWall(geo, wallId, offset) {
  const wg = geo.wallGeom.find((w) => w.id === wallId);
  if (!wg) return null;
  return [wg.a[0] + wg.dir[0] * offset, wg.a[1] + wg.dir[1] * offset];
}

/** Computed diagonal length between two corner indices (from the built outline). */
function computedDiagonal(geo, fromCorner, toCorner) {
  const a = geo.verts[fromCorner], b = geo.verts[toCorner];
  if (!a || !b) return null;
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

module.exports = { createSpace, computeGeometry, pointOnWall, computedDiagonal };
