// ============================================================================
// Soline Measurement Engine · Element Library (v0)
// ----------------------------------------------------------------------------
// The vocabulary the field surveyor (מודד) builds a space from. The measurer
// does NOT place raw points — they place SEMANTIC elements (walls, corners,
// openings, services…), each carrying the values captured in the field, with
// cross-validation sources (X6 / D2 / Manual) baked in.
//
// All lengths in millimetres, angles in degrees. Every critical value should
// carry ≥2 independent sources so the control engine can cross-validate it.
// ============================================================================

"use strict";

/**
 * A field measurement with its independent sources.
 * @param {number} value accepted value (mm, or deg for angles)
 * @param {Object|Array} sources {X6:3620, D2:3621} or [{device,value}]
 * @param {{critical?:boolean, unit?:'mm'|'deg'}} [opts]
 */
function meas(value, sources = {}, opts = {}) {
  const list = Array.isArray(sources)
    ? sources
    : Object.entries(sources).map(([device, value]) => ({ device, value }));
  return { value, sources: list, critical: opts.critical !== false, unit: opts.unit || "mm" };
}

/** Angle measurement (degrees). */
function angle(value, sources = {}) {
  return meas(value, sources, { unit: "deg" });
}

// --- Element factories ------------------------------------------------------

/**
 * A wall segment. Walls are given IN ORDER around the room (CCW). Each wall
 * carries the interior angle at the corner at its END — this is what lets the
 * engine traverse the room and build the outline (see space.js).
 * @param {string} id
 * @param {{length:object, height:object, cornerAngle:object}} p
 */
function wall(id, p) {
  return { kind: "wall", id, length: p.length, height: p.height, cornerAngle: p.cornerAngle };
}

/** Window / door / passage hosted on a wall. offset = from the wall's start corner. */
function opening(id, p) {
  return {
    kind: "opening", id, wallId: p.wallId, type: p.type, // 'window'|'door'|'passage'
    offset: p.offset, width: p.width, height: p.height, sill: p.sill || null,
  };
}

/** A service point on a wall: outlet / water / drain / gas / switch / network. */
function service(id, p) {
  return { kind: "service", id, wallId: p.wallId, type: p.type, offset: p.offset, height: p.height };
}

/** An obstacle inside the room: column / pipe / radiator / niche. */
function obstacle(id, p) {
  return { kind: "obstacle", id, type: p.type, at: p.at, size: p.size };
}

/** A floor→ceiling vertical clearance measured at a grid location (X6+D2 cross-validated). */
function clearance(id, p) {
  return { kind: "clearance", id, at: p.at, value: p.value };
}

/** A directly-measured diagonal (corner→corner) used to CROSS-CHECK the outline. */
function diagonal(id, p) {
  return { kind: "diagonal", id, fromCorner: p.fromCorner, toCorner: p.toCorner, value: p.value };
}

const OPENING_TYPES = { window: "חלון", door: "דלת", passage: "מעבר" };
const SERVICE_TYPES = {
  outlet: "שקע חשמל", water: "נקודת מים", drain: "ניקוז",
  gas: "גז", switch: "מפסק", network: "תקשורת",
};

module.exports = {
  meas, angle, wall, opening, service, obstacle, clearance, diagonal,
  OPENING_TYPES, SERVICE_TYPES,
};
