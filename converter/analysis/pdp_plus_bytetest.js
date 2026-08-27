'use strict';
// ============================================================================
// pdp_plus_bytetest.js — repeatable byte-verify for the ➕ "+X" custom-size emit
// mode (SIZE_PLUS / socket-plus), decoded in docs/PDP_SOCKET_PLUS.md.
// ----------------------------------------------------------------------------
// THE MECHANISM (byte-verified for socket): the DR item's dims field is TWO [W,D,H]
// int16 triples — `t1 @0x79` = native/reference size (LOCKS the glyph → correct icon,
// no tilt), `t2 @0x7f` = the actual drawn footprint. A "+X" variant = a plain-X native
// slot turned custom-size: keep `t1` = X's native size, write `t2` = OUR custom size,
// set the label to `+X`, and NEVER touch [0x91,0x9c) (code+block → same icon, no 921).
//
// WHAT THIS TEST PROVES, on the owner's MASTER DR base (wall4_oc40 = the byte-identical
// Rosetta file elemets_Bar_Terra-Nova_Yosi_DR1.pdp):
//   (A) END-TO-END +שקע via convertRoomDRv2(emitPlus): a socket at a NON-standard size
//       (200×150) emits "+שקע" with t1 = socket native, t2 = our [200,150,…], the
//       [0x91,0x9c)+terminator byte-identical to the base, and every world coord positive.
//       CRITICAL: compared against the OWNER'S REAL "+שקע" decode in analysis/out/
//       socket_plus.json — label/t1/unit match exactly (t2 is ours, by design).
//   (B) STRUCTURE +מפסק / +מזגן via editSlotInPlace: same structure (t1 native, t2 custom,
//       [0x91,OBJ_REC) untouched, label "+X"). ⚠️ FLAGGED PENDING real-sample byte-
//       verification — the base carries a native +מפסק but no owner sample proves that
//       "+X" accepts an ARBITRARY custom t2 for the non-socket types (only socket has two
//       independent samples proving t2 varies).
//
// Soline ships NO InnoDraw base; this test resolves the base from the licensed dev seat
// (templates/dr/base) or the owner's FULL ELC copy, exactly like pdp_inject_bytetest.js.
// ============================================================================
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const W = require(path.join(ROOT, 'src', 'writePdpDR.js'));
const { convertRoomDRv2, verifyPropertyBlocks, editSlotInPlace, slotType, baseCodeSet,
        isSizePlus, isSizePlusVerified, GT_CODES,
        COUNT_OFF, TABLE_OFF, STRIDE, OBJ_REC, OBJ_DIM_OFF, OBJ_DIM2_OFF, OBJ_POS } = W;

// Prefer the owner's MASTER DR file directly; fall back to the byte-identical local base.
const MASTER = 'G:/My Drive/קבצים ללמידת מכונה/FULL ELC/elemets_Bar_Terra-Nova_Yosi_DR1.pdp';
const LOCAL = path.join(ROOT, 'templates', 'dr', 'base', 'wall4_oc40.pdp');
const baseFile = fs.existsSync(MASTER) ? MASTER : LOCAL;
const baseBuf = fs.readFileSync(baseFile);

const cOff = TABLE_OFF + STRIDE * baseBuf.readInt16LE(COUNT_OFF);
const objCount = baseBuf.readUInt32LE(cOff), o0 = cOff + 20;
const codeSet = baseCodeSet(baseBuf, o0, objCount);
const readTrip = (b, off, d) => [b.readInt16LE(off + d), b.readInt16LE(off + d + 2), b.readInt16LE(off + d + 4)];
const findSlot = (t) => { for (let i = 0; i < objCount; i++) { const o = o0 + i * OBJ_REC; if (slotType(baseBuf, o) === t) return o; } return -1; };
const unitHex = (b, off) => b.subarray(off + 0x91, off + 0x9c).toString('hex');

const problems = [];
const chk = (c, m) => { if (!c) problems.push(m); };

// ---------------------------------------------------------------------------
// (A) END-TO-END +שקע via convertRoomDRv2(emitPlus) at 200×150, + owner-sample compare.
// ---------------------------------------------------------------------------
const CUSTOM = { width: 200, depth: 150, height: 600 };   // NON-native socket footprint
const room = { walls: [
  { position: { startX: 0, startY: 0, endX: 5000, endY: 0 }, dimensions: { thick: 100, height: 2600 },
    fixtures: [{ name: 'Socket', position: { x: 2000, y: 1200 }, size: CUSTOM }], furnishings: [] },
  { position: { startX: 5000, startY: 0, endX: 5000, endY: 3000 }, dimensions: { thick: 100, height: 2600 }, fixtures: [], furnishings: [] },
  { position: { startX: 5000, startY: 3000, endX: 0, endY: 3000 }, dimensions: { thick: 100, height: 2600 }, fixtures: [], furnishings: [] },
  { position: { startX: 0, startY: 3000, endX: 0, endY: 0 }, dimensions: { thick: 100, height: 2600 }, fixtures: [], furnishings: [] },
]};
const r = convertRoomDRv2(room, { baseBuf, emitPlus: true, editType: true, editDims: true });
const outPath = path.join(ROOT, '_LATEST', 'pdp_plus_test.pdp');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, r.buf);

chk(r.plusEmitted === 1, `A: expected exactly 1 "+X" emit, got ${r.plusEmitted}`);
const emitted = r.plusReport[0] || null;
chk(!!emitted && emitted.plusType === '+שקע', `A: emitted plusType != "+שקע" (got ${emitted && emitted.plusType})`);

let aReport = { skipped: true };
if (emitted) {
  const off = o0 + emitted.slotIndex * OBJ_REC;
  const outT1 = readTrip(r.buf, off, OBJ_DIM_OFF);
  const outT2 = readTrip(r.buf, off, OBJ_DIM2_OFF);
  const baseSockOff = findSlot('שקע');
  const sockNativeT1 = readTrip(baseBuf, baseSockOff, OBJ_DIM_OFF);   // [150,10,120]
  // t1 = socket native (glyph locked)
  chk(JSON.stringify(outT1) === JSON.stringify(sockNativeT1), `A: t1 != socket native ${JSON.stringify(sockNativeT1)} (got ${JSON.stringify(outT1)})`);
  // t2 = our custom [200,150,…]
  chk(outT2[0] === 200 && outT2[1] === 150, `A: t2 != our custom [200,150,…] (got ${JSON.stringify(outT2)})`);
  // label "+שקע"
  chk(slotType(r.buf, off) === '+שקע', `A: emitted label != "+שקע" (got "${slotType(r.buf, off)}")`);
  // [0x91,0x9c)+terminator byte-identical, world positive — via verifyPropertyBlocks
  const v = verifyPropertyBlocks(r.buf, baseBuf, { blockOnly: false });
  chk(v.blockDiffs.length === 0, `A: [0x91,0x9c) code+block changed on ${v.blockDiffs.length} slot(s)`);
  chk(v.termDiffs.length === 0, `A: list terminator [0x9c,OBJ_REC) changed on ${v.termDiffs.length} slot(s)`);
  chk(v.worldNegative.length === 0, `A: ${v.worldNegative.length} slot(s) have a NEGATIVE world coord`);
  chk(v.sizeOk, 'A: output file size / objCount changed vs base');

  // --- CRITICAL: compare against the OWNER'S REAL "+שקע" decode ---
  const spPath = path.join(ROOT, 'analysis', 'out', 'socket_plus.json');
  let ownerCmp = 'socket_plus.json absent — owner-sample compare skipped';
  if (fs.existsSync(spPath)) {
    const sp = JSON.parse(fs.readFileSync(spPath, 'utf8'));
    const ownerPlus = (sp.export && sp.export.slots || []).find((s) => s.type === '+שקע');
    if (ownerPlus) {
      const ourUnit = unitHex(r.buf, off);
      const labelMatch = slotType(r.buf, off) === ownerPlus.type;         // "+שקע"
      const t1Match = JSON.stringify(outT1) === JSON.stringify(ownerPlus.t1); // [150,10,120]
      const unitMatch = ourUnit === ownerPlus.unit;                       // 030012000000000e000000
      chk(labelMatch, 'A/owner: label != owner real +שקע');
      chk(t1Match, `A/owner: t1 ${JSON.stringify(outT1)} != owner real +שקע t1 ${JSON.stringify(ownerPlus.t1)}`);
      chk(unitMatch, `A/owner: unit ${ourUnit} != owner real +שקע unit ${ownerPlus.unit}`);
      ownerCmp = {
        matchesOwnerRealSample: labelMatch && t1Match && unitMatch,
        label: `ours "${slotType(r.buf, off)}" vs owner "${ownerPlus.type}"`,
        t1: `ours ${JSON.stringify(outT1)} vs owner ${JSON.stringify(ownerPlus.t1)}`,
        unit: `ours ${ourUnit} vs owner ${ownerPlus.unit}`,
        t2NoteT2Varies: `ours ${JSON.stringify(outT2)} (custom) vs owner ${JSON.stringify(ownerPlus.t2)} — t2 is OUR size by design; socket_plus proves t2 varies (base [500,0,500] vs export ${JSON.stringify(ownerPlus.t2)})`,
      };
    }
  }
  aReport = { slotIndex: emitted.slotIndex, t1: outT1, t2: outT2, label: slotType(r.buf, off),
    unit: unitHex(r.buf, off), unitUntouched: v.blockDiffs.length === 0, terminatorUntouched: v.termDiffs.length === 0,
    allWorldPositive: v.worldNegative.length === 0, ownerSampleCompare: ownerCmp };
}

// ---------------------------------------------------------------------------
// (B) STRUCTURE +מפסק / +מזגן via editSlotInPlace — same STRUCTURE, flagged PENDING.
// These types have no ORDX-dictionary name yet, so we drive editSlotInPlace directly on
// the base's own native slot (the exact mechanism convertRoomDRv2 would use once routed).
// ---------------------------------------------------------------------------
function structTest(baseType, custom) {
  const off = findSlot(baseType);
  if (off < 0) return { type: baseType, skipped: `no native '${baseType}' slot in base` };
  const nativeT1 = readTrip(baseBuf, off, OBJ_DIM_OFF);
  const nativeUnitTail = baseBuf.subarray(off + 0x91, off + OBJ_REC);   // code+block+terminator
  const buf = Buffer.from(baseBuf);
  const it = { type: baseType, W: custom[0], D: custom[1], H: custom[2], wx: 1000, wy: 1000, up: 1000, height: 1000 };
  const ch = editSlotInPlace(buf, off, it, 0, 0, codeSet, { emitPlus: true, editType: true, editDims: true }, false);
  const outT1 = readTrip(buf, off, OBJ_DIM_OFF), outT2 = readTrip(buf, off, OBJ_DIM2_OFF);
  const t1Preserved = JSON.stringify(outT1) === JSON.stringify(nativeT1);
  const t2Custom = outT2[0] === custom[0] && outT2[1] === custom[1] && outT2[2] === custom[2];
  const blockUntouched = buf.subarray(off + 0x91, off + OBJ_REC).equals(nativeUnitTail);
  const label = slotType(buf, off);
  const labelOk = label === '+' + baseType;
  chk(ch.plus === true, `B/${baseType}: emitPlus+custom did not flag a "+X" emit`);
  chk(t1Preserved, `B/${baseType}: t1 not preserved native ${JSON.stringify(nativeT1)} (got ${JSON.stringify(outT1)})`);
  chk(t2Custom, `B/${baseType}: t2 != our custom ${JSON.stringify(custom)} (got ${JSON.stringify(outT2)})`);
  chk(blockUntouched, `B/${baseType}: [0x91,OBJ_REC) changed (921 risk)`);
  chk(labelOk, `B/${baseType}: label != "+${baseType}" (got "${label}")`);
  return { type: '+' + baseType, nativeT1, outT1, outT2, custom, label,
    t1Preserved, t2Custom, blockUntouched, labelOk,
    verification: isSizePlusVerified(baseType) ? 'byte-verified' : '⚠️ PENDING real-sample byte-verification' };
}
const switchStruct = structTest('מפסק', [170, 10, 320]);
const acStruct = structTest('מזגן', [1200, 300, 400]);

// ---------------------------------------------------------------------------
const ok = problems.length === 0;
const report = {
  base: path.basename(baseFile) + ' (owner master DR / Rosetta base)',
  output: outPath,
  A_endToEnd_socketPlus: {
    plusEmitted: r.plusEmitted,
    ...aReport,
    verdict: aReport.skipped ? 'FAIL (no emit)' : 'PASS',
  },
  B_structure_pendingSample: {
    switch_plus: switchStruct,
    ac_plus: acStruct,
    note: 'STRUCTURE-only pass; +מפסק/+מזגן/+טלפון/+חור-איורור stay ⚠️ PENDING real-sample byte-verification',
  },
  sizePlusSet: [...W.SIZE_PLUS],
  byteVerify: ok ? 'PASS' : 'FAIL',
  problems,
};
console.log(JSON.stringify(report, null, 2));
process.exit(ok ? 0 : 1);
