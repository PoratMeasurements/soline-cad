'use strict';
/*
 * build_allelem_clean.js — regenerate analysis/out/allelem/allelem_clean.pdp (+ _LATEST/).
 * ---------------------------------------------------------------------------
 * The LOADABLE, PROFESSIONAL PDP output for the all-elements calibration room.
 *
 * POLICY (owner's decisive 2026-08-24 load-test facts — respected here):
 *   * NEVER edit the property block [0x91,0x9c). Even block-only sub-swaps WITHIN a
 *     registered code triggered Raumplan 921 (allelem_perfect.pdp). So this build uses
 *     the NATIVE-SYMBOL (postype) class ONLY: pos @0x85/0x87/0x89, dims @0x79/0x7f, and
 *     type-string @0x09. ZERO code/block/Section-E edits.
 *   * Base = the one MAXIMISING correct NATIVE symbols for this item multiset
 *     (pickBaseForNativeSymbols): each item is routed to a slot whose native 11-byte
 *     symbol unit already IS the item's correct glyph (block-exact) — so the right symbol
 *     renders with no risky edit. The 2 items with no free exact-unit slot fall to their
 *     correct code-FAMILY slot (a same-class glyph, still loadable).
 *   * The base's surplus slots are COLLAPSED to a single off-plan point just BEYOND the room's
 *     far corner, on the POSITIVE-WORLD side (world = stored + 20000). The owner load-test proved
 *     surplus at world +7204 LOADS but the earlier world −11296 (large-negative push) FAILED — so
 *     the collapse now moves toward positive world, never negative. Position-only move, the safest
 *     edit class (Section E stays byte-identical); NO ghost/floating element clutters the room.
 *
 * The definitive 17/17-with-zero-ghosts fix is the owner's own MASTER BASE
 * (docs/PDP_MASTER_BASE.md): an exact-count base built in his Raumplan so every item maps
 * 1:1 to a native slot. This output is the best achievable on the existing bundled bases.
 *
 * allelem_postype.pdp is KEPT as the conservative fallback (unchanged).
 */
const fs = require('fs');
const path = require('path');
const w = require('../src/writePdpDR');
const { parseOrdxFile } = require('../src/parseOrdx');

const ORDX = path.join(__dirname, '..', 'analysis', 'out', 'allelem', 'allelem.ordx');
const OUT_DIR = path.join(__dirname, '..', 'analysis', 'out', 'allelem');
const LATEST = path.join(OUT_DIR, '_LATEST');
const TOP_LATEST = path.join(__dirname, '..', '_LATEST'); // top-level deliverable mirror

// Off-plan collapse. gap = mm clear BEYOND the room's far (max-X/max-Y) corner; the converter
// derives the actual point from the written wall extent (robust across any base's coord frame)
// and pushes toward the POSITIVE-WORLD side (world = stored + 20000) with a world-clamp, so
// surplus lands clearly off the drawing yet stays in valid, positive, loadable coordinates —
// the fix for the negative-coord (world −11296) load failure of the previous build.
const COLLAPSE = { gap: 8000 };

function primaryRoom(model) {
  const it = (x) => (x.walls || []).reduce((n, ww) => n + ((ww.fixtures || []).length) + ((ww.furnishings || []).length), 0);
  return model.rooms.filter((r) => r.walls && r.walls.length).sort((a, b) => it(b) - it(a) || b.walls.length - a.walls.length)[0];
}

function build() {
  const model = parseOrdxFile(ORDX);
  const room = primaryRoom(model);
  const r = w.convertRoomDRv2(room, { nativeSymbols: true, editType: true, editDims: true, collapseSurplus: COLLAPSE });
  const outPath = path.join(OUT_DIR, 'allelem_clean.pdp');
  fs.writeFileSync(outPath, r.buf);
  try { fs.writeFileSync(path.join(LATEST, 'allelem_clean.pdp'), r.buf); } catch (e) { /* _LATEST optional */ }
  try { fs.writeFileSync(path.join(TOP_LATEST, 'allelem_clean.pdp'), r.buf); } catch (e) { /* top-level _LATEST optional */ }
  return { r, outPath };
}

if (require.main === module) {
  const { r, outPath } = build();
  console.log('base                 :', r.base.name, `(walls=${r.base.walls}, slots=${r.base.slots})`);
  console.log('items placed         :', r.placedInPlace + '/' + r.itemCount, '(dropped ' + r.dropped + ')');
  console.log('CORRECT NATIVE symbols:', r.correctSymbols + '/' + r.itemCount,
    `(exact-type ${r.exactSymbols} + block-relabel ${r.symbolNativeSymbols}; family-fallback ${r.familySymbols}, fallback ${r.fallbackSymbols})`);
  console.log('edits                : type', r.typeEdits, '| dims', r.dimEdits, '| CODE/BLOCK', r.codeEdits, '(must be 0)');
  console.log('surplus collapsed    :', r.leftAsIs, 'slot(s) ->', JSON.stringify(COLLAPSE));
  console.log('wrote                :', outPath);
}

module.exports = { build, primaryRoom, COLLAPSE };
