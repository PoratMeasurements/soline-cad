'use strict';
// Wall-table detection + writing for PDP templates.
//
// Two PDP wall encodings have been observed (both Raumplan for Windows IV):
//   * int16 : record 14 bytes = [x1,y1,x2,y2 int16 mm][thick i16][height i16]
//             (e.g. the twister-n6+7 project file)
//   * int32 : record 22 bytes = [x1,y1,x2,y2 int32 mm][thick i16][height i16][2b]
//             (e.g. the "בדיקה" empty room saved from a newer/other version)
//
// We auto-detect which one a template uses and where its wall records live by
// scanning for a run of consecutive records whose thickness/height/coordinates
// are all physically plausible. This lets the converter accept ANY empty
// template the user saves, not just a hard-coded offset.

const THICK_MIN = 30, THICK_MAX = 400;      // mm
const HEIGHT_MIN = 1500, HEIGHT_MAX = 4200; // mm
const COORD_MAX = 60000;                    // mm

function plausibleRec32(buf, s) {
  if (s + 20 > buf.length) return false;
  const th = buf.readInt16LE(s + 16), ht = buf.readInt16LE(s + 18);
  if (th < THICK_MIN || th > THICK_MAX) return false;
  if (ht < HEIGHT_MIN || ht > HEIGHT_MAX) return false;
  for (let k = 0; k < 16; k += 4) {
    const c = buf.readInt32LE(s + k);
    if (!Number.isFinite(c) || Math.abs(c) > COORD_MAX) return false;
  }
  return true;
}

function plausibleRec16(buf, s) {
  if (s + 12 > buf.length) return false;
  const th = buf.readInt16LE(s + 8), ht = buf.readInt16LE(s + 10);
  if (th < THICK_MIN || th > THICK_MAX) return false;
  if (ht < HEIGHT_MIN || ht > HEIGHT_MAX) return false;
  for (let k = 0; k < 8; k += 2) {
    const c = buf.readInt16LE(s + k);
    if (Math.abs(c) > COORD_MAX) return false;
  }
  return true;
}

function recTH(buf, s, format) {
  return format === 'int32'
    ? [buf.readInt16LE(s + 16), buf.readInt16LE(s + 18)]
    : [buf.readInt16LE(s + 8), buf.readInt16LE(s + 10)];
}

// Find all maximal runs of `stride`-spaced plausible records that share the
// SAME thickness AND height (i.e. the walls of one room). Returns groups.
function findGroups(buf, stride, plausible, format) {
  const groups = [];
  let i = 0;
  const end = Math.min(buf.length, 0x2000);
  while (i < end) {
    if (!plausible(buf, i)) { i++; continue; }
    const [th0, ht0] = recTH(buf, i, format);
    let n = 0;
    while (plausible(buf, i + n * stride)) {
      const [th, ht] = recTH(buf, i + n * stride, format);
      if (th !== th0 || ht !== ht0) break;
      n++;
    }
    if (n >= 3) {
      groups.push({ format, offset: i, stride, count: n, thick: th0, height: ht0 });
      i += n * stride;
    } else i++;
  }
  return groups;
}

// Detect wall tables. Returns an array of candidate groups (may be empty).
function detectWallGroups(buf) {
  return [
    ...findGroups(buf, 22, plausibleRec32, 'int32'),
    ...findGroups(buf, 14, plausibleRec16, 'int16'),
  ];
}

// Pick the group best matching a desired wall count: exact match first, then
// the smallest group that can hold them, then the largest available.
function pickGroup(groups, wantWalls) {
  if (!groups.length) return null;
  const exact = groups.filter((g) => g.count === wantWalls);
  if (exact.length) return exact[0];
  const bigEnough = groups.filter((g) => g.count >= wantWalls).sort((a, b) => a.count - b.count);
  if (bigEnough.length) return bigEnough[0];
  return groups.slice().sort((a, b) => b.count - a.count)[0];
}

// Back-compat: single best table (largest group).
function detectWalls(buf) {
  const groups = detectWallGroups(buf);
  return groups.length ? groups.slice().sort((a, b) => b.count - a.count)[0] : null;
}

function writeWall(buf, info, i, w, tx, ty) {
  const s = info.offset + i * info.stride;
  if (info.format === 'int32') {
    buf.writeInt32LE(tx(w.x1), s);
    buf.writeInt32LE(ty(w.y1), s + 4);
    buf.writeInt32LE(tx(w.x2), s + 8);
    buf.writeInt32LE(ty(w.y2), s + 12);
    buf.writeInt16LE(Math.round(w.thick), s + 16);
    buf.writeInt16LE(Math.round(w.height), s + 18);
  } else {
    buf.writeInt16LE(tx(w.x1), s);
    buf.writeInt16LE(ty(w.y1), s + 2);
    buf.writeInt16LE(tx(w.x2), s + 4);
    buf.writeInt16LE(ty(w.y2), s + 6);
    buf.writeInt16LE(Math.round(w.thick), s + 8);
    buf.writeInt16LE(Math.round(w.height), s + 10);
  }
}

function collapseWall(buf, info, i, x, y) {
  const s = info.offset + i * info.stride;
  const W = info.format === 'int32' ? buf.writeInt32LE.bind(buf) : buf.writeInt16LE.bind(buf);
  const step = info.format === 'int32' ? 4 : 2;
  W(x, s); W(y, s + step); W(x, s + step * 2); W(y, s + step * 3); // zero-length
}

module.exports = { detectWalls, detectWallGroups, pickGroup, writeWall, collapseWall };
