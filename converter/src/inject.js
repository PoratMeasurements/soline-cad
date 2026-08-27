'use strict';
const { scaleSymbol, generateSymbol, NATIVE_W, NATIVE_H } = require('./symbol');
// Parametric single-item injector (proven recipe: 7 blocks + count + segment bumps;
// topology handles proven non-critical by the VnoTopo Raumplan-load test).
//
// The 7 blocks + bump layout below are the SOCKET template, extracted from the
// 2918 golden pair (donor = DR1, base = DR2). To generalise to other item types,
// extract the same layout per type. For now this drives the parametric-placement
// end-to-end test: inject a socket at an arbitrary plan (x,y,orientation).

// Socket template as it sits in DR1 (donor): [donorOffset, length] for the 7 blocks.
const SOCKET_BLOCKS = [
  [0x514, 173],   // block#0 MEP record  (position/orientation live here)
  [0x240d, 168],  // block#1 2D symbol   (position-free template)
  [0x44ee, 210],  // block#2 3D mesh
  [0x68ff, 256],  // block#3 index/topology
  [0x96c0, 291],  // block#4 transform/index
  [0xecc1, 795],  // block#5 big topology
  [0x13085, 3],   // block#6 index tail
];
// Where each block is inserted in the DR2 base (donorOffset - cumulativeInsertedBefore).
function insertPoints() {
  let cum = 0;
  return SOCKET_BLOCKS.map(([off, len]) => { const at = off - cum; cum += len; return { pos: at, off, len }; });
}
// Load-critical global bumps (positions in the DR2 base). Values taken from DR1.
const BUMPS = [
  { pos: 0x11a, kind: 'count' },     // item count  (int8 here; +1)
  { pos: 0x1566, kind: 'segments' }, // 2D-segment counter (+ item's segment count)
];

// MEP field offsets (relative to block#0 start).
//   +0x04 is the MOUNT HEIGHT field: height_mm = value + HEIGHT_BIAS (corr 1.000
//   across 11 sockets/4 walls in 2918). NOT a position anchor.
//   +0xa1/+0xa7 = element SIZE [W, depth, H] int16 mm (two copies). PROVEN to
//   drive the element's real size in Raumplan (the 2D icon stays fixed — a
//   separate 2D-symbol scale is needed only for types shown to-scale in plan).
const MEP = { X: 0x00, Y: 0x02, HEIGHT: 0x04, ORIENT: 0x0a, DIMS: 0xa1, DIMS2: 0xa7 };
const HEIGHT_BIAS = 19960; // 2918 vertical datum; value = height_mm - HEIGHT_BIAS

// Write element dimensions (mm) into both MEP dim slots.
function writeDims(mep, W, D, H) {
  for (const base of [MEP.DIMS, MEP.DIMS2]) {
    if (W != null) mep.writeInt16LE(Math.round(W), base);
    if (D != null) mep.writeInt16LE(Math.round(D), base + 2);
    if (H != null) mep.writeInt16LE(Math.round(H), base + 4);
  }
}

// Inject a socket into `base` (the DR2-layout buffer) using `donor` (DR1) blocks,
// placing it at plan {x, y, orientation}. Returns the new buffer.
function injectSocket(base, donor, place, opts = {}) {
  const segCount = opts.segments != null ? opts.segments : 14; // socket 2D symbol = 14 segments
  const ins = insertPoints();

  // Build the (patched) MEP block copy.
  const mep = Buffer.from(donor.subarray(0x514, 0x514 + 173));
  mep.writeInt16LE(place.x, MEP.X);
  mep.writeInt16LE(place.y, MEP.Y);
  mep.writeInt16LE(place.orientation, MEP.ORIENT);
  if (place.height != null) mep.writeInt16LE(place.height - HEIGHT_BIAS, MEP.HEIGHT); // mount height
  // Element size straight from ORDX <Width>/<Depth>/<Height> (authoritative size).
  if (place.width != null || place.depth != null || place.dimHeight != null)
    writeDims(mep, place.width, place.depth, place.dimHeight);

  // Ordered ops over base: insertions (block bytes) + bumps.
  const ops = [];
  ins.forEach((b, i) => {
    const bytes = i === 0 ? mep : donor.subarray(b.off, b.off + b.len);
    ops.push({ kind: 'ins', pos: b.pos, bytes });
  });
  ops.push({ kind: 'bump', pos: 0x11a, delta: 1, width: 1 });      // item count +1
  ops.push({ kind: 'bump', pos: 0x1566, delta: segCount, width: 2 }); // segment count += segCount
  ops.sort((a, b) => a.pos - b.pos || (a.kind === 'bump' ? -1 : 1));

  const out = []; let bp = 0;
  for (const op of ops) {
    if (op.pos > bp) { out.push(base.subarray(bp, op.pos)); bp = op.pos; }
    if (op.kind === 'ins') { out.push(Buffer.from(op.bytes)); }
    else { // bump: read current value from base, write incremented, consume width bytes
      const cur = op.width === 1 ? base.readUInt8(op.pos) : base.readUInt16LE(op.pos);
      const nb = Buffer.alloc(op.width);
      if (op.width === 1) nb.writeUInt8((cur + op.delta) & 0xff, 0);
      else nb.writeUInt16LE((cur + op.delta) & 0xffff, 0);
      out.push(nb); bp += op.width;
    }
  }
  out.push(base.subarray(bp));
  return Buffer.concat(out);
}

// Build one patched MEP block for a placement (position/height/orientation/size).
function buildMep(donor, place) {
  const mep = Buffer.from(donor.subarray(0x514, 0x514 + 173));
  mep.writeInt16LE(place.x, MEP.X);
  mep.writeInt16LE(place.y, MEP.Y);
  mep.writeInt16LE(place.orientation, MEP.ORIENT);
  if (place.height != null) mep.writeInt16LE(place.height - HEIGHT_BIAS, MEP.HEIGHT);
  if (place.width != null || place.depth != null || place.dimHeight != null)
    writeDims(mep, place.width, place.depth, place.dimHeight);
  return mep;
}

// Inject MANY sockets in one pass. Each of the 7 arrays receives K consecutive
// blocks at the golden socket's slot, keeping cross-array ordinal parallelism.
// Bumps: item count += K, segment count += 14*K. Returns the new buffer.
function injectSockets(base, donor, placements, opts = {}) {
  const seg = opts.segments != null ? opts.segments : 14;
  const K = placements.length;
  const ins = insertPoints();
  const ops = [];
  ins.forEach((b, i) => {
    // K blocks at this array slot; block#0 (MEP) is patched per placement,
    // block#1 (2D icon) is scaled per placement to the element's ORDX size.
    const blocks = placements.map((p) => {
      if (i === 0) return buildMep(donor, p);
      if (i === 1 && opts.scaleIcon !== false && p.width != null) {
        const sym = Buffer.from(donor.subarray(b.off, b.off + b.len));
        // UNIFORM scale (preserve aspect ratio) to fit the element WIDTH, about
        // the origin so it aligns to the box corner like the native symbol does.
        // Uniform avoids the squish of per-axis scaling; interim until per-type
        // symbols land.
        const s = p.width / NATIVE_W;
        scaleSymbol(sym, 0, s, s, 0, 0);
        return sym;
      }
      return donor.subarray(b.off, b.off + b.len);
    });
    ops.push({ kind: 'ins', pos: b.pos, bytes: Buffer.concat(blocks.map(Buffer.from)) });
  });
  ops.push({ kind: 'bump', pos: 0x11a, delta: K, width: 1 });
  ops.push({ kind: 'bump', pos: 0x1566, delta: seg * K, width: 2 });
  ops.sort((a, b) => a.pos - b.pos || (a.kind === 'bump' ? -1 : 1));

  const out = []; let bp = 0;
  for (const op of ops) {
    if (op.pos > bp) { out.push(base.subarray(bp, op.pos)); bp = op.pos; }
    if (op.kind === 'ins') out.push(Buffer.from(op.bytes));
    else {
      const cur = op.width === 1 ? base.readUInt8(op.pos) : base.readUInt16LE(op.pos);
      const nb = Buffer.alloc(op.width);
      if (op.width === 1) nb.writeUInt8((cur + op.delta) & 0xff, 0); else nb.writeUInt16LE((cur + op.delta) & 0xffff, 0);
      out.push(nb); bp += op.width;
    }
  }
  out.push(base.subarray(bp));
  return Buffer.concat(out);
}

// Inject N items, GENERATING each item's 2D symbol (block#1) from its own
// polyline definition (Soline's per-type designed symbols), so every element
// shows the right symbol at its own size — no copy of the donor icon, no scale.
// items: [{ place:{x,y,orientation,height,width,depth,dimHeight}, symbol?:{polylines} }]
// A per-item symbol also sets that item's segment count (RUN2) from its polyline count.
function injectItems(base, donor, items) {
  const K = items.length;
  const ins = insertPoints();
  // Per-item block#1 (symbol) + segment count.
  const sym = items.map((it) => {
    if (it.symbol && it.symbol.polylines && it.symbol.polylines.length) {
      const g = generateSymbol(it.symbol.polylines);
      return { buf: g.buf, seg: g.segments };
    }
    return { buf: Buffer.from(donor.subarray(0x240d, 0x240d + 168)), seg: 14 }; // fallback: donor socket icon
  });
  const totalSeg = sym.reduce((s, x) => s + x.seg, 0);

  const ops = [];
  ins.forEach((b, i) => {
    const blocks = items.map((it, idx) => {
      if (i === 0) return buildMep(donor, it.place);
      if (i === 1) return sym[idx].buf;
      return donor.subarray(b.off, b.off + b.len);
    });
    ops.push({ kind: 'ins', pos: b.pos, bytes: Buffer.concat(blocks.map(Buffer.from)) });
  });
  ops.push({ kind: 'bump', pos: 0x11a, delta: K, width: 1 });
  ops.push({ kind: 'bump', pos: 0x1566, delta: totalSeg, width: 2 });
  ops.sort((a, b) => a.pos - b.pos || (a.kind === 'bump' ? -1 : 1));

  const out = []; let bp = 0;
  for (const op of ops) {
    if (op.pos > bp) { out.push(base.subarray(bp, op.pos)); bp = op.pos; }
    if (op.kind === 'ins') out.push(Buffer.from(op.bytes));
    else {
      const cur = op.width === 1 ? base.readUInt8(op.pos) : base.readUInt16LE(op.pos);
      const nb = Buffer.alloc(op.width);
      if (op.width === 1) nb.writeUInt8((cur + op.delta) & 0xff, 0); else nb.writeUInt16LE((cur + op.delta) & 0xffff, 0);
      out.push(nb); bp += op.width;
    }
  }
  out.push(base.subarray(bp));
  return { buf: Buffer.concat(out), segments: totalSeg };
}

module.exports = { injectSocket, injectSockets, injectItems, buildMep, writeDims, SOCKET_BLOCKS, MEP, HEIGHT_BIAS };
