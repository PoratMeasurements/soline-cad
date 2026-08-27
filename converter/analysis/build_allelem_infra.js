'use strict';
/*
 * build_allelem_infra.js — analysis/out/allelem/allelem_infra.pdp (+ _LATEST/).
 * ---------------------------------------------------------------------------
 * Job 2 deliverable: build the all-elements calibration room on the OWNER'S OWN
 * Raumplan-drawn base, correct native symbol per item, postype-class edits ONLY
 * (ZERO code/block edits), wall table overwritten to our room, surplus collapsed
 * off-plan on the POSITIVE-WORLD side (the corrected, loadable collapse).
 *
 * WHY the base is wall4_oc40 and NOT תשתיות.pdp — decoded finding (2026-08-24):
 *   analysis/out/תשתיות.pdp is a GENUINE owner InnoDraw file, but it is an ELEMENT
 *   LIBRARY / symbol catalog (family tag "SUPP_FR" — supply infrastructure), NOT a
 *   room drawing:
 *     - header has NO wall count at 0xd2 (all-zero 0x08..0xe8), no wall table;
 *     - it is 22 symbol DEFINITIONS at a strict 431-byte stride (each: family tag,
 *       Hebrew name x2, class byte 0x23, W/D/H dims, 2D symbol geometry, preference
 *       flags), followed by a large geometry body — NOT the DR 173-byte placed-object
 *       records + Section-E dimension body the converter reuses;
 *     - no "אינודרו" vendor string; no DR "03 00 00" footer.
 *   So תשתיות cannot be a drop-in DR ROOM base (overwriting a non-existent wall table /
 *   173-B slots would corrupt it). It DOES prove the owner's native infra symbol set
 *   (socket/switch/combined-water/cold+hot water/gas/antenna/phone/sewage/air-vent),
 *   with dims that match our GT library exactly — that inventory drives the master-base
 *   coverage report. The loadable base used here is wall4_oc40.pdp = the owner's OTHER
 *   real Raumplan export (the Rosetta room, 4 clean walls, 40 native slots, 32 types),
 *   which IS a room and gives every allelem item its correct native Raumplan symbol.
 *
 * Same load-safe policy as build_allelem_clean.js (native-symbol / postype path).
 * allelem_postype.pdp stays as the conservative fallback (unchanged).
 */
const fs = require('fs');
const path = require('path');
const w = require('../src/writePdpDR');
const { parseOrdxFile } = require('../src/parseOrdx');

const ORDX = path.join(__dirname, '..', 'analysis', 'out', 'allelem', 'allelem.ordx');
const OUT_DIR = path.join(__dirname, '..', 'analysis', 'out', 'allelem');
const BASE = path.join(__dirname, '..', 'templates', 'dr', 'base', 'wall4_oc40.pdp'); // owner's real Raumplan room
const COLLAPSE = { gap: 8000 }; // positive-world off-plan collapse (loadable; never negative)

function primaryRoom(model) {
  const it = (x) => (x.walls || []).reduce((n, ww) => n + ((ww.fixtures || []).length) + ((ww.furnishings || []).length), 0);
  return model.rooms.filter((r) => r.walls && r.walls.length).sort((a, b) => it(b) - it(a) || b.walls.length - a.walls.length)[0];
}

function build() {
  const model = parseOrdxFile(ORDX);
  const room = primaryRoom(model);
  const baseBuf = fs.readFileSync(BASE);
  const r = w.convertRoomDRv2(room, { baseBuf, nativeSymbols: true, editType: true, editDims: true, collapseSurplus: COLLAPSE });
  const outPath = path.join(OUT_DIR, 'allelem_infra.pdp');
  fs.writeFileSync(outPath, r.buf);
  return { r, outPath };
}

if (require.main === module) {
  const { r, outPath } = build();
  console.log('base                 : wall4_oc40.pdp (owner Raumplan room; walls=' + r.base.walls + ', slots=' + r.base.slots + ')');
  console.log('items placed         :', r.placedInPlace + '/' + r.itemCount, '(dropped ' + r.dropped + ')');
  console.log('CORRECT NATIVE symbols:', r.correctSymbols + '/' + r.itemCount,
    `(exact-type ${r.exactSymbols} + block-relabel ${r.symbolNativeSymbols}; family-fallback ${r.familySymbols}, fallback ${r.fallbackSymbols})`);
  console.log('edits                : type', r.typeEdits, '| dims', r.dimEdits, '| CODE/BLOCK', r.codeEdits, '(must be 0)');
  console.log('surplus collapsed    :', r.leftAsIs, 'slot(s) ->', JSON.stringify(COLLAPSE));
  console.log('wrote                :', outPath);
}

module.exports = { build, primaryRoom, COLLAPSE };
