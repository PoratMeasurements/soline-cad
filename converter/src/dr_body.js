'use strict';
/*
 * dr_body.js — Section E (the render-cache "body") surgery for DR-format PDP.
 * =============================================================================
 * PURPOSE. A DR .pdp is: [212B header][walls@0xd4][objCount + 173B records][BODY].
 * The BODY (Section E) is a render cache. For our payload it decomposes as
 * (docs/dr_item_record.md §6b, docs/dr_body_construction.md §2):
 *
 *   [dEnd]                 200 × 0x00                       (fixed lead block)
 *   [+200]                 206·(N−1) dimension-chain blocks (index byte 2..N)
 *   [+10]                  geometry header (… e8 03 00 00)
 *   […]                    dimension-line geometry (int16 runs + ff ff sentinels)
 *   […]                    UP_TEXT dimension callouts (Hebrew, cp1255)
 *   [asmStart]             ONE furniture-mesh assembly  ← the 3D model of the room's
 *                          complex fixture (cabinet/faucet). German part tokens:
 *                          Wall(=Wand) Griff Front Korpus QUADER ZYLINDER …
 *                          Preceded by an int16 part-count immediately before the
 *                          first `05 "Wall\0"` token (m4=7, m5=4, differ by the 3
 *                          cabinet-only parts).
 *   [len−838]              CONSTANT 838-byte glyph/EOF tail — dimension-number font
 *                          glyph outlines + the 39-byte EOF glyph + `03 00 00`.
 *                          **Byte-identical in all 9 mimran files** regardless of
 *                          wall count (N=3,4,8) or fixture type — verified
 *                          (scratchpad tailcheck.js): common suffix across all 9 = 838.
 *
 * THE 921 BUG & THE FIX.
 *   Walls render from the wall TABLE @0xd4; items render from their 173-B records
 *   (F2). Neither needs a body mesh. The furniture assembly is therefore the ONLY
 *   fixture-dependent geometry, and it pairs with the roster's complex fixture by
 *   ORDER (there is no count/pointer to it — exhaustively proven, dr_body_construction
 *   §HEADLINE). When the roster is replaced with sockets (no complex fixture), the
 *   template's assembly is ORPHANED → surplus body geometry → Raumplan error 921
 *   "list count out of bounds" (confirmed live on simple_only_DRv2).
 *
 *   Removing the assembly makes the body describe a room with NO 3D fixture — exactly
 *   what a sockets-only InnoDraw room is. Per the §2 asymmetry, a roster with MORE
 *   entries than cached meshes is TOLERATED (objects draw from their records), so a
 *   stripped body (zero meshes) is safe for ANY roster — it can never create a new
 *   orphan. Complex fixtures merely lose their 3D mesh; their 2D plan symbol (from the
 *   173-B record) is unaffected.
 *
 * This module locates and removes that assembly, yielding a clean, mesh-less body.
 * All boundaries are byte-grounded, no magic offsets:
 *   - assembly start  = (first `11 00 00 00 05 "Wall\0"`) − 2  (the int16 part-count)
 *   - assembly end    = len − 838   (start of the constant glyph/EOF tail)
 */

const SECTION_E_TAIL = 838; // constant glyph + EOF tail length, invariant across all DR files
const COUNT_OFF = 0xd2, TABLE_OFF = 0xd4, STRIDE = 14, OBJ_REC = 173;

// `11 00 00 00` + length-prefixed "Wall\0" — the furniture assembly's first sub-part.
const WALL_HDR_PAT = Buffer.from([0x11, 0x00, 0x00, 0x00, 0x05, 0x57, 0x61, 0x6c, 0x6c, 0x00]);

// dEnd = first byte AFTER the 173-B object records (= body start).
function bodyStart(buf) {
  const nW = buf.readInt16LE(COUNT_OFF);
  const cOff = TABLE_OFF + STRIDE * nW;
  const objCount = buf.readUInt32LE(cOff);
  return cOff + 20 + objCount * OBJ_REC;
}

// Locate the (single) furniture-mesh assembly. Returns null when the body already
// has none (already mesh-less). asmStart is the int16 part-count just before the
// `11 00 00 00 05 "Wall"` header; tailStart is the constant 838-byte glyph/EOF tail.
function locateAssembly(buf) {
  const dEnd = bodyStart(buf);
  const hdr = buf.indexOf(WALL_HDR_PAT, dEnd);
  if (hdr < 0) return null;
  const asmStart = hdr - 2;            // int16 part-count precedes the header
  const tailStart = buf.length - SECTION_E_TAIL;
  if (asmStart <= dEnd || asmStart >= tailStart) return null; // sanity: assembly must sit between body-start and the constant tail
  return {
    asmStart,
    tailStart,
    hdrOff: hdr,
    partCount: buf.readInt16LE(asmStart),
    asmLen: tailStart - asmStart,
    dEnd,
  };
}

function hasFurnitureAssembly(buf) {
  return locateAssembly(buf) != null;
}

// Count how many Wall-assembly headers are present (should be 0 or 1).
function countAssemblies(buf) {
  let p = bodyStart(buf), c = 0;
  while (true) { const i = buf.indexOf(WALL_HDR_PAT, p); if (i < 0) break; c++; p = i + 1; }
  return c;
}

// -----------------------------------------------------------------------------
// stripFurnitureAssembly — the core "synthesize a mesh-less Section E" operation.
// Removes [asmStart, tailStart), splicing the dimension skeleton + UP_TEXT directly
// onto the constant glyph/EOF tail. The result has NO orphan furniture assembly:
//   body = 200-zero lead + 206·(N−1) dim-chain + geom header + dim geometry
//          + UP_TEXT + trailing zeros + [constant 838-B glyph/EOF tail]
// Returns { buf, removed, asmStart, tailStart, partCount }.
// If no assembly is present, returns the buffer unchanged (removed:0).
// -----------------------------------------------------------------------------
function stripFurnitureAssembly(buf) {
  const loc = locateAssembly(buf);
  if (!loc) return { buf: Buffer.from(buf), removed: 0, asmStart: null, tailStart: null, partCount: 0 };
  const out = Buffer.concat([buf.subarray(0, loc.asmStart), buf.subarray(loc.tailStart)]);
  return { buf: out, removed: loc.asmLen, asmStart: loc.asmStart, tailStart: loc.tailStart, partCount: loc.partCount };
}

// Alias: given a DR buffer (walls + items + a template's full body), synthesize the
// mesh-less equivalent by stripping the fixture assembly.
function synthMeshlessBody(buf) { return stripFurnitureAssembly(buf); }

// -----------------------------------------------------------------------------
// bodyReport — structural self-consistency snapshot used by the converter's
// self-tests and result.json. Verifies the body's counts agree with the header:
//   nWalls (0xd2)  ·  objCount (Section C)  ·  #173-B records implied by dEnd
//   dimChainBlocks = 206·(N−1) region present  ·  furniture assemblies (want 0 for
//   a mesh-less body)  ·  EOF footer `03 00 00`  ·  constant 838-tail intact.
// -----------------------------------------------------------------------------
function bodyReport(buf) {
  const nW = buf.readInt16LE(COUNT_OFF);
  const cOff = TABLE_OFF + STRIDE * nW;
  const objCount = buf.readUInt32LE(cOff);
  const dEnd = cOff + 20 + objCount * OBJ_REC;
  const bodyLen = buf.length - dEnd;
  const preGeom = 200 + 206 * (nW - 1) + 10; // wall-driven dimension skeleton length
  const assemblies = countAssemblies(buf);
  const footer = buf.subarray(buf.length - 3).toString('hex');
  const tail = buf.subarray(buf.length - SECTION_E_TAIL);
  const eofGlyph = Buffer.from([0x01, 0xfd, 0xff, 0xf3, 0xff, 0xf5, 0xff, 0xef, 0xff, 0xee, 0xff, 0xf1, 0xff]);
  return {
    nWalls: nW,
    objCount,
    dEnd,
    bodyLen,
    preGeomBytes: preGeom,
    bodyHoldsPreGeom: bodyLen >= preGeom + SECTION_E_TAIL,
    dimChainBlocks: nW - 1,
    assemblies,                       // 0 => mesh-less (no orphan)
    meshless: assemblies === 0,
    footerOk: footer === '030000',
    tailHasEofGlyph: tail.indexOf(eofGlyph) >= 0,
    size: buf.length,
  };
}

module.exports = {
  SECTION_E_TAIL,
  bodyStart,
  locateAssembly,
  hasFurnitureAssembly,
  countAssemblies,
  stripFurnitureAssembly,
  synthMeshlessBody,
  bodyReport,
};
