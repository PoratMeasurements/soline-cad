'use strict';
/*
 * convertNative.js — ORDX room -> Raumplan-NATIVE PDP (header ffffff7f).
 * =============================================================================
 * This is the format Michael saves from Raumplan and whose items use RAUMPLAN's
 * OWN icons (SUPP_FR), not InnoDraw's. Walls cracked 2026-08-16 (docs/native_wall_
 * reshape.md): the DISPLAY source is the real-wall table @0x1a5.
 *
 * WALL RECIPE (verified: native_dining7 loaded with correct shape + orientation +
 * 90° corners):
 *   base = bundled empty room with the SAME wall count (templates/native/wall{N}.pdp,
 *          drawn + saved in Raumplan by the user).
 *   1. chain the ORDX walls into a connected polyline (start from a free end).
 *   2. reverse the chain order (swap each wall's endpoints) — restores winding after
 *      the Y-flip so faces point in + corners read 90°.
 *   3. translate wall0's start to the origin.
 *   4. Y-FLIP: pdp_y = -(y_ordx) — matches the ORDX drawing orientation.
 *   5. write each wall's int32 x1,y1,x2,y2 at 0x1a5 + 22*i, and height (int32) @+18.
 *   Do NOT touch: the body float records (Step B => "-11 List count out of bounds"),
 *   the wall count @0x14b, the bounding box @0x14d, or the GUID.
 *
 * Items (Raumplan SUPP_FR icons) + texts: added on top of this — see addItems (WIP).
 */

const fs = require('fs');
const path = require('path');

const REAL_WALLS_OFF = 0x1a5, WALL_STRIDE = 22;

function nearPt(a, b, tol = 80) { return Math.hypot(a[0] - b[0], a[1] - b[1]) < tol; }

// Order the room's walls into a connected polyline (start from a free end for open
// rooms). Each element: {x1,y1,x2,y2,ht}. Flips segment direction as needed to chain.
function chainWalls(walls) {
  const segs = walls.map((w) => ({ x1: w.position.startX, y1: w.position.startY,
    x2: w.position.endX, y2: w.position.endY, ht: (w.dimensions && w.dimensions.height) || 2600, ordx: w }));
  const pts = []; segs.forEach((s) => { pts.push([s.x1, s.y1]); pts.push([s.x2, s.y2]); });
  const deg = (p) => pts.filter((q) => nearPt(p, q)).length;
  let start = null;
  for (const s of segs) { if (deg([s.x1, s.y1]) === 1) { start = [s.x1, s.y1]; break; } if (deg([s.x2, s.y2]) === 1) { start = [s.x2, s.y2]; break; } }
  if (!start) start = [segs[0].x1, segs[0].y1];
  const used = new Array(segs.length).fill(false), out = []; let cur = start;
  for (let k = 0; k < segs.length; k++) {
    let f = false;
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue; const s = segs[i];
      if (nearPt(cur, [s.x1, s.y1])) { out.push(s); used[i] = true; cur = [s.x2, s.y2]; f = true; break; }
      if (nearPt(cur, [s.x2, s.y2])) { out.push({ ...s, x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1 }); used[i] = true; cur = [s.x1, s.y1]; f = true; break; }
    }
    if (!f) for (let i = 0; i < segs.length; i++) if (!used[i]) { out.push(segs[i]); used[i] = true; cur = [segs[i].x2, segs[i].y2]; break; }
  }
  return out;
}

function loadBase(nWalls) {
  const p = path.join(__dirname, '..', 'templates', 'native', `wall${nWalls}.pdp`);
  if (!fs.existsSync(p)) throw new Error(`no bundled native base for ${nWalls} walls (templates/native/wall${nWalls}.pdp) — user can draw+save one`);
  return fs.readFileSync(p);
}

// Transform an ORDX-world (x,y) into the reshaped base frame:
//   base_x = x - ox ; base_y = -(y - oy)   (translate wall0-start to origin + Y-flip)
function toBaseFrame(x, y, ox, oy) { return [x - ox, -(y - oy)]; }

// Reshape a room's walls into `buf` (writes @0x1a5) and return the per-wall mapping
// so items can be placed in the SAME frame. Returns { ox, oy, placed[] } where each
// placed = { bx1,by1,bx2,by2 (base frame), ordxWall } (ordxWall carries the fixtures).
function reshapeWalls(buf, walls) {
  let ch = chainWalls(walls);
  ch = ch.slice().reverse().map((w) => ({ ...w, x1: w.x2, y1: w.y2, x2: w.x1, y2: w.y1 })); // winding fix
  const ox = ch[0].x1, oy = ch[0].y1;
  const T = Math.floor;
  const placed = ch.map((w, i) => {
    const s = REAL_WALLS_OFF + i * WALL_STRIDE;
    const [bx1, by1] = toBaseFrame(w.x1, w.y1, ox, oy);
    const [bx2, by2] = toBaseFrame(w.x2, w.y2, ox, oy);
    buf.writeInt32LE(T(bx1), s); buf.writeInt32LE(T(by1), s + 4);
    buf.writeInt32LE(T(bx2), s + 8); buf.writeInt32LE(T(by2), s + 12);
    buf.writeInt32LE(T(w.ht || 2600), s + 18);
    return { bx1, by1, bx2, by2, ordxWall: w.ordx };
  });
  return { ox, oy, placed };
}

// Back-compat: walls-only converter.
function buildRoomNative(room) {
  const buf = Buffer.from(loadBase(room.walls.length));
  reshapeWalls(buf, room.walls);
  return { buf };
}

// ---------------------------------------------------------------------------
// Item placement (CRACKED + live-confirmed, docs/item_position_source.md).
// A Raumplan item is positioned by THREE record int32 fields relative to its
// SUPP_FR marker, which MUST be written consistently or the item detaches/vanishes:
//   +133 = world X, +137 = world Y (on the host wall line), +141 = along-wall mm.
// The host wall + face are inferred from (X,Y). Confirmed: placing sockets at
// along 80cm / 250cm rendered them there with Raumplan's own icon.
//
// This retargets an EXISTING item of the right type in a base that already has it
// (the geometry/icon is Raumplan-authored). It does NOT inject geometry.
// ---------------------------------------------------------------------------
function suppMarkers(buf) {
  const out = []; let i = 0;
  while ((i = buf.indexOf(Buffer.from('SUPP_FR'), i)) !== -1) { out.push(i); i += 1; }
  return out;
}

// Place the item whose SUPP_FR record is at `marker` onto wall {x1,y1,ux,uy}
// (base-frame coords, ux/uy the unit direction) at distance `along` mm from x1,y1.
function placeItem(buf, marker, wall, along) {
  const X = Math.round(wall.x1 + along * wall.ux);
  const Y = Math.round(wall.y1 + along * wall.uy);
  buf.writeInt32LE(X, marker + 133);
  buf.writeInt32LE(Y, marker + 137);
  buf.writeInt32LE(Math.round(along), marker + 141);
  return { X, Y, along };
}

// Park an unused item far off-plan so it does not render (0 size change, no 921).
function parkItem(buf, marker) {
  buf.writeInt32LE(-10000000, marker + 133);
  buf.writeInt32LE(-10000000, marker + 137);
  buf.writeInt32LE(0, marker + 141);
}

// cp1255 decode of an item's name (at marker+9).
function itemName(buf, marker) {
  let s = '';
  for (let k = 9; k < 9 + 24; k++) { const x = buf[marker + k];
    if (x >= 0xE0 && x <= 0xFA) s += String.fromCharCode(0x05D0 + (x - 0xE0));
    else if (x >= 32 && x < 127) s += String.fromCharCode(x); else break; }
  return s.trim();
}

// ORDX fixture/furnishing name -> a keyword to match against base item names.
// (Loose: the base item's Raumplan name should CONTAIN the keyword.)
let _ndict = null;
function nativeDict() {
  if (_ndict) return _ndict;
  try { _ndict = require(path.join(__dirname, '..', 'docs', 'ordx_item_dictionary.json')).elements; }
  catch { _ndict = {}; }
  return _ndict;
}

// ---------------------------------------------------------------------------
// FULL converter: ORDX room -> native PDP with Raumplan-icon items.
// `richBaseBuf` = a Raumplan-saved empty room with the room's wall count AND a
// generous set of placed infra items (so we retarget real Raumplan symbols).
// Walls reshape @0x1a5; each ORDX item retargets a matching-type base item to its
// plan position (+133/+137/+141); unused base items are parked off-plan.
// ---------------------------------------------------------------------------
function convertRoomNativeFull(room, richBaseBuf) {
  const buf = Buffer.from(richBaseBuf);
  const { placed } = reshapeWalls(buf, room.walls);
  const dict = nativeDict();

  // index base items by decoded name
  const markers = suppMarkers(buf).map((m) => ({ m, name: itemName(buf, m), used: false }));
  const findFree = (keyword) => markers.find((it) => !it.used && it.name.includes(keyword));

  const report = { placed: [], missing: [] };
  for (const pw of placed) {
    const w = pw.ordxWall; if (!w) continue;
    const items = [...(w.fixtures || []), ...(w.furnishings || [])];
    // ORDX along is measured from the ORDX wall.start; the reshaped wall may be
    // flipped, so along-from-base-start = (start matches ORDX start ? A : L-A).
    const L = Math.hypot(pw.bx2 - pw.bx1, pw.by2 - pw.by1) || 1;
    const ux = (pw.bx2 - pw.bx1) / L, uy = (pw.by2 - pw.by1) / L;
    // does the reshaped wall start at the ORDX wall.start?  compare in base frame:
    // ORDX start transformed vs pw.(bx1,by1). We approximate along directly from A
    // using the base-frame direction; if reversed, use L-A.
    const startMatchesOrdxStart = true; // reshape keeps ORDX start->end mapping via chain; refine per load-test
    for (const it of items) {
      const keyword = dict[it.name]; if (!keyword) { report.missing.push(it.name); continue; }
      const A0 = (it.position && it.position.x) || 0;
      const A = startMatchesOrdxStart ? A0 : (L - A0);
      const free = findFree(keyword);
      if (!free) { report.missing.push(it.name + '(no base item "' + keyword + '")'); continue; }
      placeItem(buf, free.m, { x1: pw.bx1, y1: pw.by1, ux, uy }, A);
      free.used = true;
      report.placed.push({ name: it.name, type: keyword, along: Math.round(A) });
    }
  }
  // park every base item we didn't use, so only the room's items show
  for (const it of markers) if (!it.used) parkItem(buf, it.m);
  return { buf, report };
}

// ---------------------------------------------------------------------------
// FULL converter v2: ORDX room -> native PDP via SYNTHETIC socket INJECTION.
// Replaces the retarget-an-existing-item step with real geometry injection
// (src/injectNativeItem.js). For each ORDX fixture/furnishing whose dict type is
// a socket ('שקע'), inject a socket at its ORDX along-wall position on the correct
// reshaped wall. Non-socket types are SKIPPED and collected into
// report.unsupportedTypes (block-templates for those come later from a palette).
//
// GENERALIZATION LIMIT (verified 2026-08-17): the same-family injector only has a
// byte-exact differential for the wall3 family, so injection is enabled ONLY for
// 3-wall rooms. For other wall counts the walls still reshape correctly but items
// are deferred (report.unsupportedTypes gains a 'family:<N>walls' note) until a GT
// differential pair (empty wallN + wallN_1socket + wallN_2socket) is saved.
// ---------------------------------------------------------------------------
function convertRoomNativeInjected(room) {
  const inj = require('./injectNativeItem.js');
  const nWalls = room.walls.length;
  let buf = Buffer.from(loadBase(nWalls));
  const { ox, oy, placed } = reshapeWalls(buf, room.walls);
  const dict = nativeDict();

  const report = { nWalls, injected: [], skipped: [], unsupportedTypes: [], notes: [] };
  const SOCKET_TYPE = 'שקע';
  const familyOK = (nWalls === 3); // only wall3 has a byte-exact injection differential
  if (!familyOK) report.notes.push(`no injection differential for ${nWalls}-wall family; items deferred, walls-only emitted`);

  let k = 0; // 0-based index of the next socket to be injected
  for (const pw of placed) {
    const w = pw.ordxWall; if (!w || !w.position) continue;
    const items = [...(w.fixtures || []), ...(w.furnishings || [])];
    // base-frame wall geometry + length
    const L = Math.hypot(pw.bx2 - pw.bx1, pw.by2 - pw.by1) || 1;
    // Does the reshaped base-frame START correspond to the ORDX wall START?
    // Map the ORDX start into the base frame and compare to (bx1,by1).
    const os = toBaseFrame(w.position.startX, w.position.startY, ox, oy);
    const startMatches = Math.hypot(os[0] - pw.bx1, os[1] - pw.by1) < Math.hypot(os[0] - pw.bx2, os[1] - pw.by2);

    for (const it of items) {
      const type = dict[it.name];
      const A0 = (it.position && it.position.x != null) ? it.position.x : 0; // ORDX along from ORDX start
      const along = startMatches ? A0 : (L - A0);                            // along from base-frame start
      if (type !== SOCKET_TYPE) {
        report.skipped.push({ name: it.name, type: type || '(unmapped)', wall: w.number, along: Math.round(along) });
        if (!report.unsupportedTypes.includes(type || it.name)) report.unsupportedTypes.push(type || it.name);
        continue;
      }
      if (!familyOK) {
        report.skipped.push({ name: it.name, type, wall: w.number, along: Math.round(along), reason: `family:${nWalls}walls` });
        if (!report.unsupportedTypes.includes(`socket@${nWalls}walls`)) report.unsupportedTypes.push(`socket@${nWalls}walls`);
        continue;
      }
      if (k >= inj.MAX_FAMILY_SOCKETS) {
        // byte-exact injection differential covers <=2 sockets; defer the rest.
        report.skipped.push({ name: it.name, type, wall: w.number, along: Math.round(along), reason: `cap:max${inj.MAX_FAMILY_SOCKETS}sockets` });
        if (!report.unsupportedTypes.includes(`socket#>${inj.MAX_FAMILY_SOCKETS}`)) report.unsupportedTypes.push(`socket#>${inj.MAX_FAMILY_SOCKETS}`);
        continue;
      }
      // inject one socket, then place it on this base-frame wall at `along`
      buf = inj.injectSocketSameFamily(buf, {});
      const res = inj.placeSocketOnWall(buf, k, { x1: pw.bx1, y1: pw.by1, x2: pw.bx2, y2: pw.by2 }, along, { guid: inj.freshGuid() });
      report.injected.push({ name: it.name, type, wall: w.number, along: res.along, X: res.X, Y: res.Y });
      k++;
    }
  }
  report.socketCount = k;
  return { buf, report };
}

module.exports = { buildRoomNative, convertRoomNativeFull, convertRoomNativeInjected,
  reshapeWalls, chainWalls, suppMarkers, placeItem, parkItem, itemName, REAL_WALLS_OFF };

// CLI: node src/convertNative.js <in.ordx> <roomIndex> <out.pdp>
if (require.main === module) {
  const { parseOrdxFile } = require('./parseOrdx.js');
  const [inp, idx = '0', out] = process.argv.slice(2);
  const room = parseOrdxFile(inp).rooms[+idx];
  const { buf } = buildRoomNative(room);
  fs.writeFileSync(out, buf);
  console.log(`wrote ${out}: "${room.name}" ${room.walls.length} walls`);
}
