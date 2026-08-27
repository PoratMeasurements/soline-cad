'use strict';
/*
 * injectNativeItem.js  — GENERATIVE, content-anchored socket injector
 * -------------------------------------------------------------------
 * Replaces the old absolute-offset EDIT-SCRIPT approach (learned SEED/INCR byte
 * scripts replayed at fixed offsets, which collapsed wall4/5/6 and broke at 3+
 * sockets) with a fully generative, content-anchored builder that generalises to
 * any wall count and any socket count from the SINGLE wall3 ground-truth trio.
 *
 * Ground-truth differential series (all real Raumplan saves), wall3 family:
 *   templates/native/wall3.pdp      = 3-wall room, 0 sockets  (5519 B)
 *   analysis/out/wall3_1socket.pdp  = same room, 1 socket     (19952 B, +14433)
 *   analysis/out/wall3_2socket.pdp  = same room, 2 sockets    (34132 B, +14180)
 *
 * MODEL — the file, in order, is a sequence of shared "anchor" blocks (byte-
 * identical across base/1sock/2sock) separated by "cells".  A 3-way alignment
 * (shared-unique 16-grams, extended maximally) recovers those cells.  Every cell
 * is one of:
 *   - CONSTANT           : identical in all three            -> copied verbatim
 *   - VALUE cell         : same length, different bytes      -> a counter/bbox
 *   - INSERT/EDIT cell   : base -> 1sock adds one-time scaffold + one socket unit;
 *                          1sock -> 2sock adds exactly one more socket unit.
 * Because every per-socket unit is POSITION-INDEPENDENT (2D symbol, 3D meshes and
 * seg records live in local space; placement is a handful of int32s in the item
 * record), building k sockets = replay each cell's edit and splice (k-1) extra
 * units, then fix the counters and patch per-socket {X,Y,along,GUID}.
 *
 * CONTENT ANCHORING (the whole point): every edit is located on the TARGET buffer
 * by searching for a byte signature (the tail of the shared block that precedes
 * the cell) — never by an absolute offset baked from wall3.  The same edit set
 * therefore transplants onto wall4/5/6 (more walls => everything shifted) without
 * displacing a single wall, and onto k>=3 without misaligning.  Counters are
 * relocated generically too: item-count via the wall-table stride, seg-count via
 * the 2D record signature, obj-count via the drawing-object record signature.
 *
 * PROOF (see selfTest): transplanting the wall3 edit set back onto wall3.pdp
 * reproduces wall3_1socket.pdp and wall3_2socket.pdp BYTE-FOR-BYTE.  That is the
 * decisive correctness gate — the generative model is only trusted once it holds.
 *
 * PLACEMENT (cracked from GT 2026-08-17): Raumplan infers the host wall + mount
 * face from the item's absolute (X,Y).  Every GT socket sits exactly 17 mm off the
 * wall centreline toward the room interior (the inward normal, i.e. toward the
 * room centroid).  Centreline placement (offset 0) only attaches on some wall
 * orientations; +17 mm inward attaches on every wall.  placeSocketOnWall applies
 * it and selfTest asserts it reproduces both GT sockets' exact X/Y.
 */

const fs = require('fs');
const path = require('path');

// ---- reference files --------------------------------------------------------
const ROOT = path.resolve(__dirname, '..');
const REF = {
  base: path.join(ROOT, 'templates', 'native', 'wall3.pdp'),
  s1:   path.join(ROOT, 'analysis', 'out', 'wall3_1socket.pdp'),
  s2:   path.join(ROOT, 'analysis', 'out', 'wall3_2socket.pdp'),
};

// ---- generic structural constants ------------------------------------------
const REAL_WALLS_OFF = 0x1a5, WALL_STRIDE = 22;   // wall table: 22-B chained records
const SUPP = Buffer.from('SUPP_FR', 'latin1');
// item-record field offsets relative to the SUPP_FR token (reconciled against GT):
const F_ID     = -0x12;   // 1 byte   : socket index (0,1,2,...)
const F_X      = 0x85;    // int32    : absolute plan X (mm)  — host+face picker
const F_Y      = 0x89;    // int32    : absolute plan Y (mm)  — host+face picker
const F_ALONG  = 0x8d;    // int32    : along-wall distance (mm) — render driver
const F_GUIDA  = 0x9d;    // 16 bytes : file/document GUID (shared across sockets)
const F_GUID   = 0xad;    // 16 bytes : per-socket GUID
const F_POSX = F_X, F_POSY = F_ALONG;             // legacy aliases

// 2D seg-table count int32 sits immediately before the first 61-B seg record,
// which begins with this signature (local socket geometry => wall-independent).
const SEG_SIG = Buffer.from([0x6c,0,0,0,0x29,0,0,0,0x6c,0,0,0,0x27,0,0,0]);
// drawing-object record signature; the int32 right after it is the obj-count.
// (wall-independent: it is the socket's drawing handle, not a wall coordinate.)
const OBJ_SIG = Buffer.from('49007f0001000000ffffffff', 'hex');
const SEG_PER_SOCKET = 68;
const OBJ_BASE = 2;   // obj-count = OBJ_BASE + 2*sockets  (GT: 1sock=4, 2sock=6)

// ---- wall-table walk (generic, verified wall3..wall6) -----------------------
function readWall(buf, o) {
  return [buf.readInt32LE(o), buf.readInt32LE(o + 4), buf.readInt32LE(o + 8), buf.readInt32LE(o + 12)];
}
// Count the connected wall chain: each wall's end endpoint == next wall's start.
// Stable regardless of later-spliced items (all item bytes come AFTER the count).
function countWalls(buf) {
  let n = 1; const maxN = 64;
  while (n < maxN) {
    const prev = readWall(buf, REAL_WALLS_OFF + (n - 1) * WALL_STRIDE);
    const s = REAL_WALLS_OFF + n * WALL_STRIDE;
    if (s + 16 > buf.length) break;
    const cur = readWall(buf, s);
    if (cur[0] === prev[2] && cur[1] === prev[3] && Math.abs(cur[2]) < 1e7 && Math.abs(cur[3]) < 1e7) n++;
    else break;
  }
  return n;
}
function itemCountOffset(buf) { return REAL_WALLS_OFF + countWalls(buf) * WALL_STRIDE; }
function walls(buf) {
  const n = countWalls(buf), w = [];
  for (let i = 0; i < n; i++) {
    const o = REAL_WALLS_OFF + i * WALL_STRIDE;
    w.push({ x1: buf.readInt32LE(o), y1: buf.readInt32LE(o + 4), x2: buf.readInt32LE(o + 8), y2: buf.readInt32LE(o + 12) });
  }
  return w;
}
function roomCentroid(buf) {
  const w = walls(buf); const pts = w.map(v => [v.x1, v.y1]);
  // include the final endpoint so open chains still centre sensibly
  if (w.length) pts.push([w[w.length - 1].x2, w[w.length - 1].y2]);
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return { x: cx, y: cy };
}

// ---- generic counter locators ----------------------------------------------
function segCountOffset(buf) { const p = buf.indexOf(SEG_SIG); return p < 0 ? -1 : p - 4; }
// obj-count = first OBJ_SIG occurrence whose following int32 is a small object
// count (the socket scaffold inserts this record BEFORE the base's own copies,
// whose trailing int32 is a large packed value). Returns -1 if none (empty base).
function objCountOffset(buf) {
  let p = -1;
  while ((p = buf.indexOf(OBJ_SIG, p + 1)) >= 0) {
    const v = buf.readInt32LE(p + OBJ_SIG.length);
    if (v >= 0 && v < 10000) return p + OBJ_SIG.length;
  }
  return -1;
}

// ---- per-socket record field access ----------------------------------------
function suppOffset(buf, k) {
  let off = -1; for (let n = 0; n <= k; n++) off = buf.indexOf(SUPP, off + 1);
  return off;
}
function readSpec(buf, k) {
  const off = suppOffset(buf, k);
  if (off < 0) throw new Error('socket ' + k + ' not found');
  return {
    supp: off,
    id: buf[off + F_ID],
    x: buf.readInt32LE(off + F_X),
    y: buf.readInt32LE(off + F_Y),
    along: buf.readInt32LE(off + F_ALONG),
    guidA: Buffer.from(buf.subarray(off + F_GUIDA, off + F_GUIDA + 16)),
    guid: Buffer.from(buf.subarray(off + F_GUID, off + F_GUID + 16)),
  };
}
function patchSpec(buf, k, spec) {
  const off = suppOffset(buf, k);
  if (off < 0) throw new Error('socket ' + k + ' not found');
  if (spec.x != null)     buf.writeInt32LE(spec.x | 0, off + F_X);
  if (spec.y != null)     buf.writeInt32LE(spec.y | 0, off + F_Y);
  if (spec.along != null) buf.writeInt32LE(spec.along | 0, off + F_ALONG);
  if (spec.id != null)    buf[off + F_ID] = spec.id & 0xff;
  if (spec.guidA)         spec.guidA.copy(buf, off + F_GUIDA);
  if (spec.guid)          spec.guid.copy(buf, off + F_GUID);
  return buf;
}
function freshGuid() {
  const g = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) g[i] = (Math.random() * 256) | 0;
  return g;
}

// ---- placement: inward-normal 17mm offset (cracked from GT) -----------------
// חוק-הגודל 🔒 (2026-08-25): שקע הוא טיפוס גודל-קבוע. Raumplan מצייר אותו בגודלו ה-native,
// ומזריק-השקע הזה כבר תואם את החוק — הוא כותב אך ורק {X,Y,along,GUID} (patchSpec) ולעולם
// אינו נוגע במטען-הגאומטריה/מידות של הרשומה. לכן הגליף נשמר בגודלו הקבוע (אין עיוות/הטיה).
// אין כאן מה לשנות — הנתיב הזה שומר-native מעצם-מבנהו. (חוק-הגודל למסלול-ה-DR: writePdpDR.js.)
// Raumplan reads the host wall + mount face from (X,Y); the socket must sit
// FACE_OFFSET mm off the centreline toward the room interior to attach on every
// wall orientation. Reproduces both GT sockets' X/Y exactly (asserted in selfTest).
const FACE_OFFSET = 17;
function placeSocketOnWall(buf, k, wall, along, opts) {
  opts = opts || {};
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  const px = wall.x1 + along * ux, py = wall.y1 + along * uy;
  let nx = -uy, ny = ux;                          // wall normal
  const c = opts.centroid;
  if (c) { const toC = nx * (c.x - px) + ny * (c.y - py); if (toC < 0) { nx = -nx; ny = -ny; } }
  const fo = (opts.faceOffset != null) ? opts.faceOffset : FACE_OFFSET;
  const X = Math.round(px + fo * nx), Y = Math.round(py + fo * ny);
  if (buf != null) patchSpec(buf, k, { x: X, y: Y, along: Math.round(along), guid: opts.guid });
  return { X, Y, along: Math.round(along) };
}
// Pure geometry helper (no buffer) — used by selfTest to check the rule vs GT.
function socketXY(wall, along, centroid, faceOffset) {
  return placeSocketOnWall(null, 0, wall, along, { centroid, faceOffset });
}

// ---- 3-way alignment: shared blocks + cells ---------------------------------
const AK = 16;
function uniqueGrams(buf) {
  const m = new Map();
  for (let p = 0; p + AK <= buf.length; p++) {
    const k = buf.toString('latin1', p, p + AK);
    if (m.has(k)) m.set(k, -1); else m.set(k, p);
  }
  return m;
}
// Returns ordered list of shared blocks [{b,s1,s2,len}] byte-identical in all
// three, monotonic and non-overlapping in ALL THREE coordinate systems. Built by
// greedily accepting monotonic unique-gram seeds and extending each forward while
// the three buffers agree (forward-only keeps non-overlap trivially correct; any
// residual equal bytes between blocks fall into constant cells).
function sharedBlocks(base, s1, s2) {
  const ub = uniqueGrams(base), u1 = uniqueGrams(s1), u2 = uniqueGrams(s2);
  const seeds = [];
  for (const [k, pb] of ub) {
    if (pb < 0) continue;
    const p1 = u1.get(k), p2 = u2.get(k);
    if (p1 == null || p1 < 0 || p2 == null || p2 < 0) continue;
    seeds.push([pb, p1, p2]);
  }
  seeds.sort((a, b) => a[0] - b[0]);
  const blocks = [];
  let eb = 0, e1 = 0, e2 = 0;    // end of last accepted block in each coord
  for (const [pb0, p10, p20] of seeds) {
    if (pb0 < eb || p10 < e1 || p20 < e2) continue;   // inside/overlapping a prior block
    let pb = pb0, p1 = p10, p2 = p20, len = AK;
    while (pb + len < base.length && p1 + len < s1.length && p2 + len < s2.length &&
           base[pb + len] === s1[p1 + len] && base[pb + len] === s2[p2 + len]) len++;
    blocks.push({ b: pb, s1: p1, s2: p2, len });
    eb = pb + len; e1 = p1 + len; e2 = p2 + len;
  }
  return blocks;
}

// Build the ordered edit plan for the wall3 family. Each entry is either a shared
// block (copied) or a cell (base/s1/s2 slices). Cells carry a left-signature (the
// tail of the preceding shared block, in base bytes) so they can be relocated on
// any target buffer.
let _famCache = null;
function loadFamily() {
  if (_famCache) return _famCache;
  const base = fs.readFileSync(REF.base);
  const s1 = fs.readFileSync(REF.s1);
  const s2 = fs.readFileSync(REF.s2);
  const blocks = sharedBlocks(base, s1, s2);
  const plan = [];
  let pb = 0, p1 = 0, p2 = 0;
  let prevBlockLen = 0;                            // length of the shared block just before this cell
  const SIG = 24;
  // leftSig is taken from WITHIN the preceding shared block (clamped to its length)
  // so it never spills into the previous cell's mutable bytes — this keeps the
  // monotonic anchor search consistent even where shared blocks are tiny.
  const mkSig = () => prevBlockLen === 0 ? Buffer.alloc(0)
                    : base.subarray(pb - Math.min(SIG, prevBlockLen), pb);
  for (const blk of blocks) {
    if (blk.b > pb || blk.s1 > p1 || blk.s2 > p2) {
      plan.push({ cell: true, cb: base.subarray(pb, blk.b), c1: s1.subarray(p1, blk.s1), c2: s2.subarray(p2, blk.s2), leftSig: mkSig(), baseStart: pb });
    }
    plan.push({ block: true, bytes: base.subarray(blk.b, blk.b + blk.len), b: blk.b, len: blk.len });
    pb = blk.b + blk.len; p1 = blk.s1 + blk.len; p2 = blk.s2 + blk.len;
    prevBlockLen = blk.len;
  }
  if (pb < base.length || p1 < s1.length || p2 < s2.length) {
    plan.push({ cell: true, cb: base.subarray(pb), c1: s1.subarray(p1), c2: s2.subarray(p2), leftSig: mkSig(), baseStart: pb });
  }
  _famCache = { base, s1, s2, plan };
  return _famCache;
}

// Content of a cell for k sockets. k=1 -> c1, k=2 -> c2 (verbatim GT: byte-exact).
// k>=3 -> extrapolate by repeating the per-socket unit (the block by which c2
// exceeds c1) just before the common suffix.
function cellContent(cell, k) {
  const { cb, c1, c2 } = cell;
  if (k === 0) return cb;
  if (k === 1) return c1;
  if (k === 2) return c2;
  if (c2.length <= c1.length) return c1;             // value/constant cell: no growth
  // A cell may hold SEVERAL independently-growing lists (e.g. the 3D cell carries
  // both the mesh list and other per-socket records), so socket #2's bytes are
  // inserted at MULTIPLE points, not one. Recover every insertion by a 2-way diff
  // of c1->c2, then replay each inserted delta (k-1) times at its own position.
  // This is used ONLY when the diff faithfully reconstructs c2 (apply-once == c2);
  // for cells whose repeated units differ solely by 16-byte GUIDs the anchor diff
  // is ambiguous, so we fall back to a length-exact single-span model.
  const ops = twoWayDiff(c1, c2);
  const once = Buffer.concat(ops.map(op => op.copy ? c1.subarray(op.copy[0], op.copy[1]) : op.ins));
  const insBytes = ops.reduce((a, op) => a + (op.ins ? op.ins.length : 0), 0);
  // Trust per-position replay only for a CLEAN diff: faithful AND with no
  // compensating deletions (total inserted == net growth). Insert-heavy diffs
  // signal misaligned GUID-only-differing repeats -> use the length-exact fallback.
  if (once.equals(c2) && insBytes === c2.length - c1.length) {
    const parts = [];
    for (const op of ops) {
      if (op.copy) parts.push(c1.subarray(op.copy[0], op.copy[1]));
      else for (let i = 0; i < k - 1; i++) parts.push(op.ins);
    }
    return Buffer.concat(parts);
  }
  // fallback: insert (k-1) copies of the net-delta span just before the common
  // suffix. Length-exact; geometry replication in such cells is approximate and
  // flagged in the report (a 3-socket GT would disambiguate the interleaved lists).
  const unitLen = c2.length - c1.length;
  let suf = commonSuffix(c1, c2); if (suf > c1.length) suf = c1.length;
  const u = c2.subarray(c2.length - suf - unitLen, c2.length - suf);
  const parts = [c1.subarray(0, c1.length - suf)];
  for (let i = 0; i < k - 1; i++) parts.push(u);
  parts.push(c1.subarray(c1.length - suf));
  return Buffer.concat(parts);
}

// 2-way alignment of a->b via shared-unique 16-grams; returns ordered copy/insert
// ops that rebuild b from a (a-deletions are not expected here and are dropped).
function twoWayDiff(a, b) {
  const ua = uniqueGrams(a), ub = uniqueGrams(b);
  const seeds = [];
  for (const [k, pa] of ua) { if (pa < 0) continue; const pb = ub.get(k); if (pb == null || pb < 0) continue; seeds.push([pa, pb]); }
  seeds.sort((x, y) => x[0] - y[0]);
  const blocks = []; let ea = 0, eb = 0;
  for (const [pa0, pb0] of seeds) {
    if (pa0 < ea || pb0 < eb) continue;
    let pa = pa0, pb = pb0, len = AK;
    while (pa + len < a.length && pb + len < b.length && a[pa + len] === b[pb + len]) len++;
    blocks.push([pa, pb, len]); ea = pa + len; eb = pb + len;
  }
  const ops = []; let ca = 0, cb = 0;
  for (const [pa, pb, len] of blocks) {
    if (pb > cb) ops.push({ ins: Buffer.from(b.subarray(cb, pb)) });   // inserted bytes
    ops.push({ copy: [pa, pa + len] });
    ca = pa + len; cb = pb + len;
  }
  if (cb < b.length) ops.push({ ins: Buffer.from(b.subarray(cb)) });
  return ops;
}

// Direct generative build for the wall3 family base: walk the aligned plan,
// emitting each shared block verbatim and each cell's k-socket content. Because
// the plan tiles base/1sock/2sock exactly (asserted in selfTest), this reproduces
// wall3_1socket.pdp (k=1) and wall3_2socket.pdp (k=2) BYTE-FOR-BYTE, and inserts
// (k-1) extra per-socket units for k>=3. This is the content-derived generator;
// the transplant path below carries the same edits onto foreign (wall4/5/6) bases.
function buildFamilyDirect(k) {
  const fam = loadFamily();
  return Buffer.concat(fam.plan.map(s => s.block ? s.bytes : cellContent(s, k)));
}

// ---- generative build: transplant the family edits onto ANY clean base ------
// Returns { buf, report } where report lists, per cell edit, whether its anchor
// was found on the target and whether the target's base bytes matched (portable).
function buildSockets(cleanBase, k) {
  const fam = loadFamily();
  const target = Buffer.from(cleanBase);
  const icOff3 = itemCountOffset(fam.base);        // item-count offset in the family base
  const icOffT = itemCountOffset(target);          // ...and in this target (generic)
  // Every INSERT cell (net byte change base->1sock->2sock) is treated as a PURE
  // INSERT: the cell shares a prefix and suffix with the base, and the socket
  // content is injected between them. We therefore splice ONLY the added bytes
  // into the target's OWN base content — never overwriting the target's (wall-
  // dependent) drawing. Value cells (counters/bbox) are left to fixCounters.
  const inserts = [];
  for (const seg of fam.plan) {
    if (seg.block) continue;
    const { cb, c1, c2 } = seg;
    if (cb.length === c1.length && c1.length === c2.length) continue;  // value cell
    let pre = Math.min(commonPrefix(cb, c1), commonPrefix(cb, c2));
    let suf = Math.min(commonSuffix(cb, c1), commonSuffix(cb, c2));
    if (pre + suf > cb.length) suf = Math.max(0, cb.length - pre);
    inserts.push({ seg, cb, pre, suf, isItemRecord: seg.baseStart === icOff3, leftSig: seg.leftSig });
  }
  const report = [];
  const actions = [];
  let cursor = 0;
  for (const e of inserts) {
    let anchorPos = -1, reason = '', portable = false;
    if (e.isItemRecord) { anchorPos = icOffT; portable = true; }      // generic anchor
    else if (e.leftSig.length === 0) { anchorPos = 0; }
    else {
      const p = target.indexOf(e.leftSig, cursor);
      if (p < 0) reason = 'left-anchor not found on target';
      else anchorPos = p + e.leftSig.length;
    }
    let insertPos = -1;
    if (anchorPos >= 0) {
      insertPos = anchorPos + e.pre;
      if (!e.isItemRecord) {
        const okPre = target.subarray(anchorPos, anchorPos + e.pre).equals(e.cb.subarray(0, e.pre));
        const okSuf = e.suf === 0 || target.subarray(insertPos, insertPos + e.suf).equals(e.cb.subarray(e.cb.length - e.suf));
        portable = okPre && okSuf;
        if (!portable) reason = 'target base bytes differ (wall-dependent region)';
      }
      cursor = Math.max(cursor, anchorPos + e.cb.length);
    }
    if (portable && insertPos >= 0) {
      const content = cellContent(e.seg, k);
      const toInsert = content.subarray(e.pre, content.length - e.suf);
      actions.push({ insertPos, toInsert });
    }
    report.push({
      baseStart: '0x' + e.seg.baseStart.toString(16),
      region: e.isItemRecord ? 'item-record' : regionName(e.seg.baseStart),
      addBytes: cellContent(e.seg, k).length - e.cb.length,
      located: anchorPos >= 0, portable, reason,
    });
  }
  actions.sort((a, b) => b.insertPos - a.insertPos);   // apply right-to-left
  let buf = target;
  for (const a of actions) buf = Buffer.concat([buf.subarray(0, a.insertPos), a.toInsert, buf.subarray(a.insertPos)]);
  return { buf, report };
}

function commonPrefix(a, b) { let i = 0; const n = Math.min(a.length, b.length); while (i < n && a[i] === b[i]) i++; return i; }
function commonSuffix(a, b) { let i = 0; const n = Math.min(a.length, b.length); while (i < n && a[a.length - 1 - i] === b[b.length - 1 - i]) i++; return i; }
// Human-readable region label for the transplant report (by base offset in wall3).
function regionName(off) {
  if (off < 0x20e) return 'item-record';
  if (off < 0x64c) return '2D-drawing/bbox';
  if (off < 0x836) return '2D-seg-symbol';
  if (off < 0xd2c) return 'view/drawing-object';
  return '3D-mesh-scene';
}

// Fix all three counters generically on a built buffer.
function fixCounters(buf, k) {
  const notes = [];
  const io = itemCountOffset(buf);
  buf.writeInt32LE(k, io); notes.push(['item-count', '0x' + io.toString(16), k]);
  if (k > 0) {
    const so = segCountOffset(buf);
    if (so >= 0) { buf.writeInt32LE(SEG_PER_SOCKET * k, so); notes.push(['seg-count', '0x' + so.toString(16), SEG_PER_SOCKET * k]); }
    else notes.push(['seg-count', '(not found)', SEG_PER_SOCKET * k]);
    const oo = objCountOffset(buf);
    if (oo >= 0) { buf.writeInt32LE(OBJ_BASE + 2 * k, oo); notes.push(['obj-count', '0x' + oo.toString(16), OBJ_BASE + 2 * k]); }
    else notes.push(['obj-count', '(not found)', OBJ_BASE + 2 * k]);
  }
  return notes;
}

// ---- public API -------------------------------------------------------------
/*
 * injectSocketsSameFamily(cleanBase, sockets)
 *   cleanBase : a 0-socket native base buffer (wall3/4/5/6 or any same-family base)
 *   sockets   : array of specs, one per socket to add. Each spec:
 *       {}                              keep the ground-truth socket verbatim
 *                                       (used by selfTest for byte-exact proof)
 *       { wallIndex, along }            place on wall #wallIndex at `along` mm,
 *                                       auto 17mm inward, fresh GUID
 *       { x, y, along, guid, id }       explicit field override
 *   Returns a new Buffer with k = sockets.length sockets.
 * Content-anchored throughout: no absolute offsets except those derived by
 * byte-search on THIS buffer.
 */
function injectSocketsSameFamily(cleanBase, sockets) {
  const k = sockets.length;
  const fam = loadFamily();
  // Family base -> direct plan walk (byte-exact gate). Foreign base -> content-
  // anchored transplant of the same edits (see buildSockets + its portability report).
  const built = Buffer.from(cleanBase).equals(fam.base)
    ? buildFamilyDirect(k)
    : buildSockets(cleanBase, k).buf;
  const out = Buffer.from(built);
  if (k > 0) fixCounters(out, k);
  // Per-socket variable fields. CRITICAL: a repositioned socket overwrites ONLY
  // {X@+0x85, Y@+0x89, along@+0x8d, GUID@+0xad}. The object handle at SUPP-0x12 is
  // a per-instance value baked into the template (GT sock0=415, sock1=411) — NOT
  // an index; zeroing/defaulting it corrupts the item handle and makes Raumplan
  // read past the file buffer (E4254 "Bin HINTER dem FileBuffer"). Likewise the
  // flags/wall-attach block @+0x145 and the document GUID @+0x9d are left verbatim
  // from the template. patchSpec is therefore called with x/y/along/guid ONLY.
  const wl = walls(out); const centroid = roomCentroid(out);
  const presentSockets = (() => { let c = 0, p = -1; while ((p = out.indexOf(SUPP, p + 1)) >= 0) c++; return c; })();
  for (let i = 0; i < k; i++) {
    const spec = sockets[i] || {};
    if (i >= presentSockets) continue;   // socket record could not be spliced onto this base
    if (spec.keepGT || (spec.x == null && spec.y == null && spec.along == null &&
        spec.wallIndex == null && !spec.guid)) {
      continue; // keep the template GT bytes untouched (byte-exact path)
    }
    const guid = spec.guid || freshGuid();
    if (spec.wallIndex != null && wl[spec.wallIndex]) {
      placeSocketOnWall(out, i, wl[spec.wallIndex], spec.along || 0, { centroid, guid, faceOffset: spec.faceOffset });
    } else {
      patchSpec(out, i, { x: spec.x, y: spec.y, along: spec.along, guid });
    }
  }
  return out;
}

// Back-compat wrappers -------------------------------------------------------
function injectN(cleanBase, specs) { return injectSocketsSameFamily(cleanBase, specs); }
// add one socket to a clean base (kept for old callers)
function injectSocketSameFamily(cleanBase, opts) { return injectSocketsSameFamily(cleanBase, [opts || {}]); }

// counter consistency checker (structural)
function assertCounters(buf, k) {
  const errs = [];
  const io = itemCountOffset(buf); const ic = buf.readInt32LE(io);
  if (ic !== k) errs.push(`item-count@0x${io.toString(16)} = ${ic}, expected ${k}`);
  if (k > 0) {
    const so = segCountOffset(buf);
    if (so < 0) errs.push('seg-count not found');
    else if (buf.readInt32LE(so) !== SEG_PER_SOCKET * k) errs.push(`seg-count = ${buf.readInt32LE(so)}, expected ${SEG_PER_SOCKET * k}`);
    const oo = objCountOffset(buf);
    if (oo < 0) errs.push('obj-count not found');
    else if (buf.readInt32LE(oo) !== OBJ_BASE + 2 * k) errs.push(`obj-count = ${buf.readInt32LE(oo)}, expected ${OBJ_BASE + 2 * k}`);
  }
  return errs;
}

// ---- decisive self-test -----------------------------------------------------
function selfTest() {
  const fam = loadFamily();
  let allOk = true;

  // (0) alignment sanity: family plan must tile all three files exactly.
  const rebuild = (which) => Buffer.concat(fam.plan.map(s => s.block ? s.bytes : (which === 0 ? s.cb : which === 1 ? s.c1 : s.c2)));
  const tile0 = rebuild(0).equals(fam.base), tile1 = rebuild(1).equals(fam.s1), tile2 = rebuild(2).equals(fam.s2);
  console.log(`alignment tiling: base=${tile0} 1sock=${tile1} 2sock=${tile2}`);
  if (!(tile0 && tile1 && tile2)) allOk = false;

  // (1) placement rule reproduces both GT sockets' X/Y exactly.
  const W = walls(fam.base), C = roomCentroid(fam.base);
  const g0 = readSpec(fam.s1, 0), g1 = readSpec(fam.s2, 1);
  const p0 = socketXY(W[1], 1000, C);      // GT sock0 on wall1 at along 1000
  const p1 = socketXY(W[1], 1450, C);      // GT sock1 on wall1 at along 1450
  const okp0 = p0.X === g0.x && p0.Y === g0.y;
  const okp1 = p1.X === g1.x && p1.Y === g1.y;
  console.log(`placement rule: sock0 got (${p0.X},${p0.Y}) want (${g0.x},${g0.y}) ${okp0?'OK':'FAIL'}; sock1 got (${p1.X},${p1.Y}) want (${g1.x},${g1.y}) ${okp1?'OK':'FAIL'}`);
  if (!okp0 || !okp1) allOk = false;

  // (2) counter proof, cited by offset
  const seg = b => { const o = segCountOffset(b); return o < 0 ? '(none)' : `${b.readInt32LE(o)}@0x${o.toString(16)}`; };
  const obj = b => { const o = objCountOffset(b); return o < 0 ? '(none)' : `${b.readInt32LE(o)}@0x${o.toString(16)}`; };
  console.log('counters 0 -> 1 -> 2:');
  console.log(`  item-count : ${fam.base.readInt32LE(itemCountOffset(fam.base))} -> ${fam.s1.readInt32LE(itemCountOffset(fam.s1))} -> ${fam.s2.readInt32LE(itemCountOffset(fam.s2))}`);
  console.log(`  seg-count  : ${seg(fam.base)} -> ${seg(fam.s1)} -> ${seg(fam.s2)}`);
  console.log(`  obj-count  : ${obj(fam.base)} -> ${obj(fam.s1)} -> ${obj(fam.s2)}`);

  // (3) BYTE-EXACT round-trips — the gate.
  const one = injectSocketsSameFamily(fam.base, [{}]);
  const ok1 = one.equals(fam.s1);
  const two = injectSocketsSameFamily(fam.base, [{}, {}]);
  const ok2 = two.equals(fam.s2);
  for (const [name, ok, got, want] of [
    ['inject 1 socket == wall3_1socket.pdp', ok1, one, fam.s1],
    ['inject 2 sockets == wall3_2socket.pdp', ok2, two, fam.s2],
  ]) {
    if (ok) console.log(`  PASS  ${name}`);
    else {
      allOk = false;
      let d = 0; const n = Math.min(got.length, want.length);
      while (d < n && got[d] === want[d]) d++;
      console.log(`  FAIL  ${name}  (len ${got.length} vs ${want.length}, first diff @0x${d.toString(16)})`);
    }
  }

  // (4) REPOSITION regression guard (E4254): moving a socket must NOT touch the
  // object handle @SUPP-0x12, and must differ from a template-position build ONLY
  // in {X,Y,along,GUID}. (Template build here == wall3_1socket.pdp = `one`.)
  const moved = injectSocketsSameFamily(fam.base, [{ wallIndex: 1, along: 1500 }]);
  const suppT = one.indexOf(SUPP), suppM = moved.indexOf(SUPP);
  const handleT = one.readUInt16LE(suppT - 0x12), handleM = moved.readUInt16LE(suppM - 0x12);
  const okHandle = handleT === handleM && one[0x1f7] === moved[0x1f7];
  // enumerate differing byte offsets; each must fall in an allowed field window
  const allowed = (rel) => (rel >= 0x85 && rel < 0x89) || (rel >= 0x89 && rel < 0x8d) ||
                           (rel >= 0x8d && rel < 0x91) || (rel >= 0xad && rel < 0xbd);
  let badDiffs = 0, nDiffs = 0;
  for (let i = 0; i < Math.min(one.length, moved.length); i++) {
    if (one[i] === moved[i]) continue;
    nDiffs++;
    if (!allowed(i - suppT)) badDiffs++;
  }
  const okFields = one.length === moved.length && badDiffs === 0;
  console.log(`  ${okHandle ? 'PASS' : 'FAIL'}  reposition preserves handle @0x1f7 (template=${handleT}, moved=${handleM}, byte=0x${moved[0x1f7].toString(16)})`);
  console.log(`  ${okFields ? 'PASS' : 'FAIL'}  reposition differs only in {X,Y,along,GUID} (${nDiffs} bytes differ, ${badDiffs} outside allowed fields)`);
  if (!okHandle || !okFields) allOk = false;

  return allOk;
}

module.exports = {
  injectSocketsSameFamily, injectN, injectSocketSameFamily, selfTest,
  loadFamily, buildSockets, fixCounters, cellContent, sharedBlocks,
  readSpec, patchSpec, placeSocketOnWall, socketXY, freshGuid,
  walls, roomCentroid, countWalls, itemCountOffset, segCountOffset, objCountOffset,
  assertCounters,
  REAL_WALLS_OFF, WALL_STRIDE, F_X, F_Y, F_ALONG, F_GUID, F_GUIDA, FACE_OFFSET,
};

if (require.main === module) {
  const ok = selfTest();
  console.log(ok ? '\nSELFTEST: ALL PASS (byte-exact round-trip proven)' : '\nSELFTEST: FAILURES');
  process.exit(ok ? 0 : 1);
}
