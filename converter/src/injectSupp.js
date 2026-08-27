'use strict';
/*
 * injectSupp.js - inject ONE Raumplan-native SUPP_FR item (socket/switch/tap) into an
 * EMPTY native wall base, so it renders with Raumplan's OWN icon. No hand-drawn base.
 * ==========================================================================================
 * WHY THIS IS HARD (cracked 2026-08-16): a Raumplan item is NOT one record. Adding one socket
 * to the empty base P0 -> P1 costs +14169 B spread over THREE payloads plus small view edits:
 *   A  431 B   SUPP_FR placement record   (inserted right after the wall-header terminator)
 *   B  ~4224 B 2D symbol section          (68 vector primitives; fills the empty symbol layer)
 *   D  ~9529 B 3D scene (6x ZYLINDER)      (inserted right before the GENERAL catalog)
 *   + 4 tiny in-place view subs (auto label, view-extent floats, per-view counters)
 * The A/B/D geometry is POSITION-INDEPENDENT (docs/item_position_source.md): the on-screen
 * position lives ONLY in record A at marker+133/+137/+141. So we splice fixed A/B/D bytes and
 * then write the position.
 *
 * VERIFIED: replaying the P0->P1 splice on P0 reproduces P1 BYTE-FOR-BYTE (see selfTest()).
 * P1 is a known-loadable Raumplan save -> a base of the P0 symbol-layer family is guaranteed
 * to yield a structurally valid one-socket file.
 *
 * BASE REQUIREMENT: the base must be a native (ffffff7f) single-room save of the *P0 family*:
 *   - empty symbol layer marker  05 01 00 00 00              (the B insertion anchor)
 *   - wall-header terminator      64 00 28 0a 00 00          (A goes right after the 1st)
 *   - empty 3D-scene header of 80 3f floats just before ASCII "GENERAL"  (D anchor)
 *   templates/native/wallN.pdp are a DIFFERENT (per-wall-view) family and do NOT carry the
 *   0x0501 symbol layer -> use the experimental path for those and LOAD-TEST (see docs).
 */
const fs = require('fs');
const path = require('path');

const PAIR_DIR = 'G:/My Drive/\u05e7\u05d1\u05e6\u05d9\u05dd \u05dc\u05dc\u05de\u05d9\u05d3\u05ea \u05de\u05db\u05d5\u05e0\u05d4/PDP';
function loadPair() {
  return { P0: fs.readFileSync(path.join(PAIR_DIR, '0.pdp')),
           P1: fs.readFileSync(path.join(PAIR_DIR, '1.pdp')) };
}

// The socket splice, expressed as edits derived from the exact P0->P1 diff.
// Each op: replace `al` bytes of the base at P0-offset `p0` with `bl` bytes taken verbatim from
// P1 at `p1` (al=0 => pure insertion). selfTest() proves replaying these on P0 yields P1 exactly.
//   A : insert 431B at 0x1bb  (right after the wall-header terminator 64 00 28 0a 00 00 @0x1b5)
//   B : 0x612 7B->4155B (empty symbol layer -> 2D vector paths), 0x62c 2B->78B (layer tail)
//   V : 0x659 10B->10B (view-extent floats), 0x824 22B->23B, 0x8c8 28B->17B, 0xace 16B->11B
//       (the 4 small view-record edits: auto label + per-view counters)
//   D : insert 8B at 0xb68 ("ZYLINDER") + 9521B at 0xb72 (3D scene body), just before GENERAL
// (@0x143 extent 0x00->0x64 = zoom-to-fit, cosmetic; file GUID @0x1dc kept - Raumplan ignores it.)
const SPLICE = [
  { p0: 0x143, al: 1,  p1: 0x143,  bl: 1 },    // extent byte 0x00->0x64 (zoom-to-fit; cosmetic)
  { p0: 0x1bb, al: 0,  p1: 0x1bb,  bl: 431 },  // A record (pure insert)
  { p0: 0x1dc, al: 16, p1: 0x38b,  bl: 16 },   // file GUID (Raumplan ignores it; kept for exact repro)
  { p0: 0x207, al: 1,  p1: 0x3b6,  bl: 1 },    // view-state flag (stride 0xcf) - NOT an item flag
  { p0: 0x2d6, al: 1,  p1: 0x485,  bl: 1 },    // view-state flag
  { p0: 0x3a5, al: 1,  p1: 0x554,  bl: 1 },    // view-state flag
  { p0: 0x474, al: 1,  p1: 0x623,  bl: 1 },    // view-state flag
  { p0: 0x543, al: 1,  p1: 0x6f2,  bl: 1 },    // view-state flag
  { p0: 0x612, al: 7,  p1: 0x7c1,  bl: 4155 }, // B 2D symbol
  { p0: 0x62c, al: 2,  p1: 0x180f, bl: 78 },   // B tail
  { p0: 0x659, al: 10, p1: 0x1888, bl: 10 },   // view-extent floats
  { p0: 0x824, al: 22, p1: 0x1a53, bl: 23 },   // view rec / auto label
  { p0: 0x8c8, al: 28, p1: 0x1af8, bl: 17 },   // view rec restructure
  { p0: 0xace, al: 16, p1: 0x1cf3, bl: 11 },   // view rec restructure
  { p0: 0xb68, al: 0,  p1: 0x1d88, bl: 8 },    // D "ZYLINDER"
  { p0: 0xb72, al: 0,  p1: 0x1d9a, bl: 9521 }, // D 3D scene body
];

// SUPP_FR marker offset in the produced file (record A start +34). In P1 the marker is @0x1dd.
const SUPP_MARKER_IN_OUTPUT = 0x1dd;

// Apply the socket splice to a P0-family base buffer. Returns { buf, marker }.
// Canonical use: base = P0 (optionally with walls reshaped in the header - reshape never touches
// any spliced region, which all sit at fixed <=0xb72 offsets in the P0 body).
function injectSocketFamilyP0(base, opts) {
  opts = opts || {};
  const { P1 } = loadPair();
  if (opts.assert !== false) {
    if (base.indexOf(Buffer.from('6400280a0000', 'hex')) !== 0x1b5)
      throw new Error('base is not P0-family: wall terminator not at 0x1b5');
    if (base.indexOf(Buffer.from('0501000000', 'hex')) !== 0x60b)
      throw new Error('base is not P0-family: symbol layer 0501 not at 0x60b');
  }
  const parts = [];
  let cur = 0;
  const ops = SPLICE.slice().sort((a, b) => a.p0 - b.p0);
  for (const op of ops) {
    parts.push(base.slice(cur, op.p0));
    parts.push(P1.slice(op.p1, op.p1 + op.bl));
    cur = op.p0 + op.al;
  }
  parts.push(base.slice(cur));
  return { buf: Buffer.concat(parts), marker: SUPP_MARKER_IN_OUTPUT };
}

// Position writer (docs/item_position_source.md) - the ONLY per-instance placement data.
function setSuppPosition(buf, marker, X, Y, along) {
  buf.writeInt32LE(Math.round(X), marker + 133); // absolute plan X (host-wall + face picker)
  buf.writeInt32LE(Math.round(Y), marker + 137); // absolute plan Y
  buf.writeInt32LE(Math.round(along), marker + 141); // along-wall mm from start (render driver)
  return buf;
}
function placeOnWall(buf, marker, wall, along) {
  const L = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) || 1;
  const ux = (wall.x2 - wall.x1) / L, uy = (wall.y2 - wall.y1) / L;
  const off = wall.off || 0; const nx = -uy, ny = ux; // left normal for the mount offset
  const X = wall.x1 + along * ux + off * nx;
  const Y = wall.y1 + along * uy + off * ny;
  return setSuppPosition(buf, marker, X, Y, along);
}

// reroll the 16-byte per-item GUID at marker+173 so duplicated items are unique.
function rerollGuid(buf, marker) {
  for (let k = 0; k < 16; k++) buf[marker + 173 + k] = Math.floor(Math.random() * 256);
}

// Extract the socket payloads from a P1-shaped source (one item over the P0 base). Provided so
// the same machinery generalises to other item types once a single-item source exists per type.
function extractSuppBlocks(srcP1) {
  return {
    A:     srcP1.slice(0x1bb, 0x1bb + 431),
    B:     srcP1.slice(0x7c1, 0x7c1 + 4155),
    Btail: srcP1.slice(0x180f, 0x180f + 78),
    V:     srcP1.slice(0x1888, 0x1888 + 10),
    S1:    srcP1.slice(0x1a53, 0x1a53 + 23),
    S2:    srcP1.slice(0x1af8, 0x1af8 + 17),
    S3:    srcP1.slice(0x1cf3, 0x1cf3 + 11),
    D1:    srcP1.slice(0x1d88, 0x1d88 + 8),
    D2:    srcP1.slice(0x1d9a, 0x1d9a + 9521),
  };
}

// GENERAL SPEC: injectSupp(baseBuf, srcSuppBlocks, x, y, along)
//   baseBuf : a native empty room of the P0 symbol-layer family (Buffer)
//   x,y,along : target plan position (mm). Pass {wall} to compute X/Y from an along distance.
function injectSupp(baseBuf, srcSuppBlocks, x, y, along, opts) {
  opts = opts || {};
  const { buf, marker } = injectSocketFamilyP0(baseBuf);
  rerollGuid(buf, marker);
  if (opts.wall) placeOnWall(buf, marker, opts.wall, along);
  else setSuppPosition(buf, marker, x, y, along);
  return { buf, marker };
}

// ==========================================================================================
// CROSS-FAMILY native injection (wall3/4/5/6) — the multi-wall bases that are NOT the P0 family.
// ==========================================================================================
// KEY DIAGNOSIS (verified 2026-08-17): the P0 splice inserts A at 0x1bb, which for P0 is the END
// of its 1-wall list but for wallN is the START of wall #1 -> A landed *inside* the wall list and
// shoved walls 1..N-1 past the socket record => Raumplan "3336 List count out of bounds".
// FIX: insert A *after the entire wall list* = (LAST `6400280a0000` terminator) + 6.
//
// What must / must NOT be bumped (proven against P0/P1/P2, all `file@offset`):
//   * wall/geometry count @0x14b: P0=5, P1=5, P2=5  -> UNCHANGED when an item is added.
//     wallN@0x14b = walls+4 (W3=7,W4=8,W5=9,W6=10); LEAVE IT ALONE.
//   * per-view "has-content" flag `67 XX 00 00 00 02`: boolean, NOT a count. P0 empty=0, P1=1,
//     P2 (2 sockets) still =1. wallN already has drawn walls -> all its flags are already 1
//     (W3 has 7 of them, all `67 01…`). So NO flag bump is needed for a wallN base.
//   * 3D primitive count: there is NO external counter. The P0->P1 splice adds 6 ZYLINDER by a
//     PURE insertion before GENERAL with zero count edits (selfTest proves byte-exact). The count
//     is self-contained in the D2 payload. The pre-GENERAL region is byte-identical in P0 & wallN.
//   * the only pre-A P0->P1 change is the cosmetic extent byte @0x143 (0x00->0x64, zoom-to-fit).
// Net: adding one socket to a wallN base = pure insert of A (after wall list) + B (2D symbol,
// before the first view record) + D (3D scene, before GENERAL). No counter needs incrementing.
//
// Anchors are located by byte-search (indexOf of signatures), so the SAME code works for
// wall3/4/5/6 (and any native single-room base of this family), never hardcoded P0 offsets.

const SIG_WALLTERM = '6400280a0000';         // wall-record terminator (one per wall, @rec+16)
const SIG_VIEWREC  = '007f0001000000ffffff'; // per-wall 2D view record (drawing section)
const SIG_GENERAL  = '47454e4552414c';       // "GENERAL" catalog marker
const SIG_SUPP     = '535550505f4652';       // "SUPP_FR"
const SIG_2DANCHOR = 'fffb0002';             // 2D vector primitive (68x inside block B)
const SIG_ZYLINDER = '5a594c494e444552';     // "ZYLINDER" (6x inside block D)

function _h(hex) { return Buffer.from(hex, 'hex'); }

// The socket payloads, taken verbatim from the known-good P1 (one socket over the empty P0).
// B is grabbed as ONE contiguous run (B-body + 19 pad zeros + B-tail) exactly as it sits in P1,
// so it is a self-contained 2D-symbol section. D1/D2 mirror the P0 splice (D1 8B "ZYLINDER",
// D2 9521B scene body) so the pre-GENERAL layout is reproduced 1:1.
function socketBlocks() {
  const { P1 } = loadPair();
  return {
    A:  P1.slice(0x1bb, 0x1bb + 431),  // 431  SUPP_FR placement record (marker at +34)
    B:  P1.slice(0x7c1, 0x185d),       // 4252 contiguous 2D symbol section (68 fffb0002 prims)
    D1: P1.slice(0x1d88, 0x1d88 + 8),  // 8    "ZYLINDER"
    D2: P1.slice(0x1d9a, 0x1d9a + 9521), // 9521 3D scene body
  };
}

// Inject one socket into a NATIVE multi-wall base (wall3/4/5/6 family). Returns {buf,marker,anchors}.
// opts.withLayerHeader: prefix block B with an empty `05 01` symbol-layer header (reconstructs the
//   P0-family local layout `[0501…][B]`; wallN lacks the 0501 marker). Default false (the minimal,
//   single-variable fix over the prior attempt — only A's offset changes).
function injectSocketNativeWallBase(base, opts) {
  opts = opts || {};
  const blk = socketBlocks();

  const lastTerm = base.lastIndexOf(_h(SIG_WALLTERM));
  if (lastTerm < 0) throw new Error('native base: no wall terminator ' + SIG_WALLTERM);
  const aAt = lastTerm + 6;                       // insert A AFTER the whole wall list

  const firstView = base.indexOf(_h(SIG_VIEWREC));
  if (firstView < 0) throw new Error('native base: no view record ' + SIG_VIEWREC);

  const gen = base.indexOf(_h(SIG_GENERAL));
  if (gen < 0) throw new Error('native base: no GENERAL marker');
  const d1At = gen - 90, d2At = gen - 80;         // mirror P0: D1 @GENERAL-90, D2 @GENERAL-80

  const bPayload = opts.withLayerHeader
    ? Buffer.concat([_h('05010000000000'), blk.B]) // empty 0501 layer header + B
    : blk.B;

  const ops = [
    { at: aAt,       bytes: blk.A,   tag: 'A' },
    { at: firstView, bytes: bPayload, tag: 'B' },
    { at: d1At,      bytes: blk.D1,  tag: 'D1' },
    { at: d2At,      bytes: blk.D2,  tag: 'D2' },
  ].sort((x, y) => x.at - y.at);

  const parts = []; let cur = 0;
  for (const op of ops) {
    if (op.at < cur) throw new Error('native inject: overlapping anchor for ' + op.tag + ' @' + op.at);
    parts.push(base.slice(cur, op.at));
    parts.push(op.bytes);
    cur = op.at;
  }
  parts.push(base.slice(cur));
  const buf = Buffer.concat(parts);

  // marker = A-start + 34, shifted by any payload inserted at an offset < aAt (there are none,
  // since the wall list precedes the drawing/3D sections, but compute it generically).
  let shift = 0;
  for (const op of ops) if (op.at < aAt) shift += op.bytes.length;
  const marker = aAt + shift + 34;

  return { buf, marker, anchors: { aAt, firstView, gen, d1At, d2At },
           addedBytes: blk.A.length + bPayload.length + blk.D1.length + blk.D2.length };
}

// Structural self-test for a native cross-family injection: proves no wall record was displaced,
// all sections are present with the right multiplicity, and the size accounting is exact.
function checkNativeInject(base, out, marker) {
  const cnt = (buf, hex) => { const p = _h(hex); let n = 0, i = 0;
    while ((i = buf.indexOf(p, i)) !== -1) { n++; i += 1; } return n; };
  const termOffs = (buf) => { const p = _h(SIG_WALLTERM), o = []; let i = 0;
    while ((i = buf.indexOf(p, i)) !== -1) { o.push(i); i += 1; } return o; };

  const baseTerms = termOffs(base), outTerms = termOffs(out);
  const nWalls = baseTerms.length;
  // every base wall terminator must be at the SAME offset in the output (A went AFTER them):
  const wallsUndisplaced = nWalls === outTerms.length &&
    baseTerms.every((o, k) => outTerms[k] === o);
  // and they must be contiguous at stride 22 (no socket record spliced between walls):
  const contiguous = outTerms.every((o, k) => k === 0 || o - outTerms[k - 1] === 22);

  const checks = {
    sizeExact:        out.length === base.length + socketBlocks().A.length + socketBlocks().B.length
                                     + socketBlocks().D1.length + socketBlocks().D2.length,
    wallsUndisplaced,
    wallsContiguous:  contiguous,
    wallCountByte:    base[0x14b] === out[0x14b],           // 0x14b must NOT change
    suppAdded:        cnt(base, SIG_SUPP) === 0 && cnt(out, SIG_SUPP) === 1,
    supp2dPrims:      cnt(out, SIG_2DANCHOR) === 68,        // block B present (68 vector prims)
    supp3dCylinders:  cnt(out, SIG_ZYLINDER) === 6,         // block D present (6 ZYLINDER)
    generalOnce:      cnt(out, SIG_GENERAL) === 1,
    markerIsSupp:     out.slice(marker, marker + 7).toString('latin1') === 'SUPP_FR',
  };
  checks.ok = Object.values(checks).every((v) => v === true);
  return checks;
}

// Self-test: injectSocketFamilyP0(P0) must equal P1 byte-for-byte.
function selfTest() {
  const { P0, P1 } = loadPair();
  const { buf } = injectSocketFamilyP0(P0);
  const p0Family = { ok: buf.equals(P1), outLen: buf.length, p1Len: P1.length };

  // cross-family structural self-test on the bundled wall3 base
  let crossFamily = { skipped: true };
  try {
    const w3 = fs.readFileSync(path.join(__dirname, '..', 'templates', 'native', 'wall3.pdp'));
    const r = injectSocketNativeWallBase(w3);
    crossFamily = checkNativeInject(w3, r.buf, r.marker);
    crossFamily.marker = '0x' + r.marker.toString(16);
    crossFamily.anchors = Object.fromEntries(
      Object.entries(r.anchors).map(([k, v]) => [k, '0x' + v.toString(16)]));
  } catch (e) { crossFamily = { error: e.message }; }

  return { p0Family, crossFamily };
}

module.exports = { injectSocketFamilyP0, injectSupp, extractSuppBlocks, setSuppPosition,
  placeOnWall, rerollGuid, selfTest, loadPair, SUPP_MARKER_IN_OUTPUT, SPLICE,
  injectSocketNativeWallBase, checkNativeInject, socketBlocks };

if (require.main === module) console.log('selfTest:', JSON.stringify(selfTest(), null, 2));
