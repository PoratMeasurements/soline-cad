'use strict';
// 2D symbol (icon) scaling for PDP block#1.
// The socket icon is a polygon in a local frame: 4-byte tokens [x int16, y int16],
// with pen-up separators encoded as (x=-1, y=0) = bytes ff ff 00 00. Native bbox
// is 150(X) x 120(Y) == catalog W x H. To make the icon reflect the element's real
// size we scale the vertices per-axis, about the icon centre so the placement point
// stays put.

const NATIVE_W = 150, NATIVE_H = 120; // socket icon native bbox (== catalog W,H)
const SYMBOL_LEN = 168;

function isSep(x, y) { return x === -1 && y === 0; }

// Compute the true vertex bounding box of a symbol block (ignores separators).
function bbox(buf, off, len = SYMBOL_LEN) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let p = 0; p + 4 <= len; p += 4) {
    const x = buf.readInt16LE(off + p), y = buf.readInt16LE(off + p + 2);
    if (isSep(x, y)) continue;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

// Scale a symbol block in place by (sx, sy) about centre (cx, cy).
function scaleSymbol(buf, off, sx, sy, cx = NATIVE_W / 2, cy = NATIVE_H / 2, len = SYMBOL_LEN) {
  for (let p = 0; p + 4 <= len; p += 4) {
    const x = buf.readInt16LE(off + p), y = buf.readInt16LE(off + p + 2);
    if (isSep(x, y)) continue;
    buf.writeInt16LE(Math.round(cx + (x - cx) * sx), off + p);
    buf.writeInt16LE(Math.round(cy + (y - cy) * sy), off + p + 2);
  }
}

// Convenience: scale a socket icon to reflect ORDX Width (along wall) and Height.
// Scale about the origin (0,0) so the icon stays aligned with the element box.
function fitSocketIcon(buf, off, ordxW, ordxH) {
  scaleSymbol(buf, off, ordxW / NATIVE_W, ordxH / NATIVE_H, 0, 0);
}

// ---- symbol GENERATION (Soline's own per-type 2D symbols) ----
// A symbol is a list of polylines; each polyline is [[x,y],...] in mm. Encoded
// as 4-byte vertex tokens [x i16][y i16], each polyline terminated by the
// pen-up separator (x=-1,y=0) = ff ff 00 00. Returns { buf, segments } where
// `segments` = number of polylines (drives the RUN2 segment-count bump).
function generateSymbol(polylines) {
  const toks = [];
  let lineSegments = 0;
  for (const pl of polylines) {
    for (const [x, y] of pl) { const b = Buffer.alloc(4); b.writeInt16LE(Math.round(x), 0); b.writeInt16LE(Math.round(y), 2); toks.push(b); }
    const sep = Buffer.alloc(4); sep.writeInt16LE(-1, 0); sep.writeInt16LE(0, 2); toks.push(sep); // pen-up
    lineSegments += Math.max(0, pl.length - 1); // draw ops in this polyline
  }
  // `segments` = total LINE SEGMENTS (draw ops), the unit the PDP RUN2 counter
  // uses (the donor socket = 14 two-point strokes = 14 segments). Earlier bug:
  // counted polylines, which broke multi-point strokes.
  return { buf: Buffer.concat(toks), segments: lineSegments, strokes: polylines.length };
}

// Fixed-size variant for PDP: block#1's byte length is referenced by offsets in
// the copied topology blocks — changing it triggers error 921. So emit the symbol
// as exactly `strokes` two-point line-segments padded to the donor block length,
// keeping the structure identical to the donor (only vertex positions differ).
// Symbols with more segments than fit need the length-ref crack (see STATUS).
function generateSymbolFixed(polylines, byteLen = 168, padPoint = [0, 0]) {
  const maxStrokes = Math.floor(byteLen / 12); // each 2-pt stroke = 12 bytes
  const segs = [];
  for (const pl of polylines) for (let i = 0; i + 1 < pl.length; i++) segs.push([pl[i], pl[i + 1]]);
  const truncated = segs.length > maxStrokes;
  const use = segs.slice(0, maxStrokes);
  while (use.length < maxStrokes) use.push([padPoint, padPoint]); // zero-length, invisible
  const toks = [];
  for (const [a, b] of use) {
    for (const [x, y] of [a, b]) { const t = Buffer.alloc(4); t.writeInt16LE(Math.round(x), 0); t.writeInt16LE(Math.round(y), 2); toks.push(t); }
    const sep = Buffer.alloc(4); sep.writeInt16LE(-1, 0); sep.writeInt16LE(0, 2); toks.push(sep);
  }
  return { buf: Buffer.concat(toks), segments: maxStrokes, truncated, realSegments: segs.length };
}

// Inverse: parse a symbol block into polylines (splits on the pen-up separator).
function parseSymbol(buf, off = 0, len = buf.length - off) {
  const polylines = [];
  let cur = [];
  for (let p = 0; p + 4 <= len; p += 4) {
    const x = buf.readInt16LE(off + p), y = buf.readInt16LE(off + p + 2);
    if (isSep(x, y)) { if (cur.length) polylines.push(cur); cur = []; }
    else cur.push([x, y]);
  }
  if (cur.length) polylines.push(cur);
  return polylines;
}

module.exports = { scaleSymbol, fitSocketIcon, bbox, generateSymbol, generateSymbolFixed, parseSymbol, NATIVE_W, NATIVE_H, SYMBOL_LEN };
