'use strict';
/*
 * writePdpNative.js — build a Raumplan-native PDP room from ORDX walls.
 * =============================================================================
 * Cracked 2026-08-15 (see docs/PDP_NATIVE_FORMAT.md). Verified: room_4x3_clean.pdp
 * loaded in Raumplan for Windows IV as a clean rectangle (face inward, 90° corners).
 *
 * Approach: reuse the user's empty base `חדר ריק.pdp` (6 wall slots) and overwrite
 * its wall TABLE (@0x1a5) + body records (@0xad0) with the room's walls.
 *   - winding forced to CW (negative shoelace) -> 90° corners + inward face
 *   - body record floats @+16 = [x1,y1,x2,y2] offset by 200mm along RIGHT-normal
 *   - surplus slots collapsed to a zero-length point
 *   - the 16-byte GUID @0x1dc is left as-is (random per-save, not validated)
 *   - NO write at 0x1ad in this base (it is wall0.endX in the 0x1a5 table)
 *
 * LIMIT: base has 6 wall slots -> rooms up to 6 walls. >6 needs slot expansion
 * (find/patch the wall-count field first — still open).
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'analysis', 'out', 'חדר ריק.pdp');
const TABLE_OFF = 0x1a5, TABLE_STRIDE = 22, TABLE_SLOTS = 6;
const REC_OFF = 0xad0, REC_STRIDE = 42;
const COUNT_OFF = 0xac8;   // int32 wall count (8 bytes before the body-record array)
const FACE_OFFSET = 200; // mm, perpendicular face offset seen in every record

// signed area (shoelace). Negative = clockwise in the coordinate convention that
// Raumplan renders with inward faces + 90° interior corners.
function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

// Ordered ring of vertices from a room's walls (assumes walls connect end->start).
function ringFromWalls(walls) {
  return walls.map((w) => {
    const p = w.position;
    return { x1: p.startX, y1: p.startY, x2: p.endX, y2: p.endY };
  });
}

function writeWallRecord(buf, slot, x1, y1, x2, y2, thick, height) {
  // table
  const s = TABLE_OFF + slot * TABLE_STRIDE;
  buf.writeInt32LE(Math.round(x1), s);
  buf.writeInt32LE(Math.round(y1), s + 4);
  buf.writeInt32LE(Math.round(x2), s + 8);
  buf.writeInt32LE(Math.round(y2), s + 12);
  buf.writeInt16LE(Math.round(thick), s + 16);
  buf.writeInt16LE(Math.round(height), s + 18);
  // body record
  const o = REC_OFF + slot * REC_STRIDE;
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  if (L < 1) { // collapsed / surplus slot
    for (let k = 0; k < 4; k++) buf.writeFloatLE(k % 2 ? y1 : x1, o + 16 + k * 4);
    buf.write('0   ', o + 33, 'latin1');
    return;
  }
  const nx = (dy / L) * FACE_OFFSET;   // right-normal * 200  (=> face inward for CW ring)
  const ny = (-dx / L) * FACE_OFFSET;
  buf.writeFloatLE(x1 + nx, o + 16);
  buf.writeFloatLE(y1 + ny, o + 20);
  buf.writeFloatLE(x2 + nx, o + 24);
  buf.writeFloatLE(y2 + ny, o + 28);
  buf.write('    ', o + 33, 'latin1');
  buf.write(String(Math.round(L)), o + 33, 'latin1'); // 4-char left-justified length
}

// Build a PDP buffer for one room's walls. `walls` = ORDX wall objects
// (parseOrdx shape: {position:{startX,startY,endX,endY}, dimensions:{thick,height}}).
function buildRoomPdp(walls, opts = {}) {
  const basePath = opts.base || BASE;
  const buf = Buffer.from(fs.readFileSync(basePath));
  if (walls.length > TABLE_SLOTS) {
    throw new Error(`room has ${walls.length} walls but base has only ${TABLE_SLOTS} slots (slot-expansion not yet implemented)`);
  }
  let ring = ringFromWalls(walls);
  // force clockwise (negative signed area)
  const pts = ring.map((w) => [w.x1, w.y1]);
  if (signedArea(pts) > 0) {
    ring = ring.slice().reverse().map((w) => ({ x1: w.x2, y1: w.y2, x2: w.x1, y2: w.y1 }));
  }
  ring.forEach((w, i) => {
    const d = walls[i].dimensions || {};
    writeWallRecord(buf, i, w.x1, w.y1, w.x2, w.y2, d.thick || 100, d.height || 2600);
  });
  for (let i = ring.length; i < TABLE_SLOTS; i++) writeWallRecord(buf, i, 0, 0, 0, 0, 100, 2600);
  // NOTE: do NOT reduce COUNT_OFF — reducing the native wall count triggers error 921
  // (same count-lock as DR). Surplus slots stay counted (show as extra חזית) unless the
  // base already has the exact wall count. Clean output needs an exact-wall-count base.
  return buf;
}

module.exports = { buildRoomPdp, signedArea, ringFromWalls, TABLE_SLOTS };

// CLI: node src/writePdpNative.js <input.ordx> <roomIndex> <out.pdp>
if (require.main === module) {
  const { parseOrdxFile } = require('./parseOrdx.js');
  const [inp, roomIdx = '0', out] = process.argv.slice(2);
  if (!inp || !out) { console.error('usage: node src/writePdpNative.js <in.ordx> <roomIndex> <out.pdp>'); process.exit(2); }
  const model = parseOrdxFile(inp);
  const room = model.rooms[+roomIdx];
  if (!room) { console.error('no room at index', roomIdx); process.exit(1); }
  const buf = buildRoomPdp(room.walls);
  fs.writeFileSync(out, buf);
  console.log(`wrote ${out}: room "${room.name || roomIdx}" with ${room.walls.length} walls`);
}
