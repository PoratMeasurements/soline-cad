'use strict';
// Repeatable PDP injection byte-verify test (task-4). Proves the DR injection pipeline injects
// Soline infra items onto the owner's MASTER DR base's native slots WITHOUT touching the
// 921-sensitive symbol unit, keeps every stored world coordinate positive, AND applies the
// SIZE RULE (2026-08-25 breakthrough, docs/PDP_SIZE_CLASSIFICATION.md):
//   🔒 FIXED types (socket/switch/faucet/gas/phone/antenna/junction-box/light/combined-water):
//      inject POSITION ONLY — the native size bytes [0x79,0x85) stay byte-identical to the base
//      slot, so Raumplan draws the glyph at its own fixed size (no distortion/tilt).
//   🎚️ VARIABLE types (door/window/channel/water-line/sewage/...): our [W,D,H] dims are written.
//
// MASTER DR BASE: templates/dr/base/wall4_oc40.pdp — byte-identical to the owner's
// elemets_Bar_Terra-Nova_Yosi_DR1.pdp (zero-header DR export, 4 walls, the rich "Rosetta" base;
// native code-set {1,2,3,4,5,6,7,11,12,15,20} ⊇ {1,2,3,4,5,6,7,15} → all 19 injectable types).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const W = require(path.join(ROOT, 'src', 'writePdpDR.js'));
const { convertRoomDRv2, verifyPropertyBlocks, isSizeFixed,
        COUNT_OFF, TABLE_OFF, STRIDE, OBJ_REC, OBJ_DIM_OFF, OBJ_DIM2_OFF } = W;

// Prefer the owner's MASTER DR file directly; fall back to the byte-identical local base.
const MASTER = 'G:/My Drive/קבצים ללמידת מכונה/FULL ELC/elemets_Bar_Terra-Nova_Yosi_DR1.pdp';
const LOCAL = path.join(ROOT, 'templates', 'dr', 'base', 'wall4_oc40.pdp');
const baseFile = fs.existsSync(MASTER) ? MASTER : LOCAL;
const baseBuf = fs.readFileSync(baseFile);

const fx = (name, x, w) => ({ name, position: { x, y: 1200 }, size: { width: w, height: 80, depth: 10 } });
// Mix of 🔒 FIXED (Socket/Switch/Gas/Faucet/Junction Box/Can Light) and 🎚️ VARIABLE
// (Water=צ.מים / Sewage=ביוב קיר / Passage=דלת / Window=חלון).
const room = { walls: [
  { position: { startX: 0, startY: 0, endX: 5000, endY: 0 }, dimensions: { thick: 100, height: 2600 },
    fixtures: [fx('Socket', 400, 80), fx('Switch', 900, 80), fx('Gas', 1400, 100),
               fx('Faucet', 1900, 70), fx('Junction Box', 2400, 120), fx('Can Light', 3200, 850),
               fx('Water', 3800, 20)], furnishings: [] },
  { position: { startX: 5000, startY: 0, endX: 5000, endY: 3000 }, dimensions: { thick: 100, height: 2600 },
    fixtures: [fx('Sewage', 1000, 50), { name: 'Passage', position: { x: 1800, y: 0 }, size: { width: 900, height: 2100, depth: 100 } }],
    furnishings: [] },
  { position: { startX: 5000, startY: 3000, endX: 0, endY: 3000 }, dimensions: { thick: 100, height: 2600 },
    fixtures: [{ name: 'Window', position: { x: 1000, y: 900 }, size: { width: 1000, height: 1260, depth: 100 } }], furnishings: [] },
  { position: { startX: 0, startY: 3000, endX: 0, endY: 0 }, dimensions: { thick: 100, height: 2600 }, fixtures: [], furnishings: [] },
]};

const r = convertRoomDRv2(room, { baseBuf, nativeSymbols: true, editType: true, editDims: true, collapseSurplus: { gap: 8000 } });
const outPath = path.join(ROOT, '_LATEST', 'tashtiot_inject_test.pdp');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, r.buf);

// ---- byte-level property/terminator/world-positive gate (unchanged) ----------
const v = verifyPropertyBlocks(r.buf, baseBuf, { blockOnly: false });

// ---- SIZE-RULE byte verification (new — task-4) ------------------------------
// For each injected item, read the slot it landed on from mapReport and compare the size field
// [0x79,0x85) (two int16 [W,D,H] triples) in OUTPUT vs BASE:
//   🔒 FIXED    → must be BYTE-IDENTICAL to the base slot (native size preserved; no distortion).
//   🎚️ VARIABLE → dims1 must equal OUR [W, D||10, H] (Raumplan uses our size).
const nW = r.buf.readInt16LE(COUNT_OFF);
const cOff = TABLE_OFF + STRIDE * nW, o0 = cOff + 20;
const readTrip = (b, off, d) => [b.readInt16LE(off + d), b.readInt16LE(off + d + 2), b.readInt16LE(off + d + 4)];
const dimBytesEqual = (a, b, off) => { for (let k = OBJ_DIM_OFF; k < 0x85; k++) if (a[off + k] !== b[off + k]) return false; return true; };

const sizeChecks = [];
let fixedOk = 0, fixedBad = 0, varOk = 0, varBad = 0;
for (const m of r.mapReport) {
  const off = o0 + m.slotIndex * OBJ_REC;
  const fixed = isSizeFixed(m.itemType);
  const outD1 = readTrip(r.buf, off, OBJ_DIM_OFF), baseD1 = readTrip(baseBuf, off, OBJ_DIM_OFF);
  if (fixed) {
    const identical = dimBytesEqual(r.buf, baseBuf, off);
    if (identical) fixedOk++; else fixedBad++;
    sizeChecks.push({ type: m.itemType, klass: '🔒fixed', slot: m.slotIndex, nativeType: m.nativeType,
      outDims: outD1, baseDims: baseD1, sizeBytesIdenticalToBase: identical });
  } else {
    // our written dims: width from the fixture, depth default 10, height 80/opening-height.
    const it = r.mapReport.find((x) => x === m);
    const outD2 = readTrip(r.buf, off, OBJ_DIM2_OFF);
    // A variable item's dims1 should differ from the base native (we wrote ours) unless our size
    // happened to equal native; the meaningful assertion is that dims1==dims2==our value, so both
    // triples carry OUR size. We don't have the raw fx here, so assert dims1===dims2 (both ours)
    // and that it differs from the base native size in at least one component OR equals it — either
    // way it is OUR value. The rich per-value check lives below via the explicit expected table.
    const bothOurs = outD1[0] === outD2[0] && outD1[1] === outD2[1] && outD1[2] === outD2[2];
    if (bothOurs) varOk++; else varBad++;
    sizeChecks.push({ type: m.itemType, klass: '🎚variable', slot: m.slotIndex, nativeType: m.nativeType,
      outDims1: outD1, outDims2: outD2, baseDims: baseD1, bothTriplesEqualOurs: bothOurs,
      changedFromNative: JSON.stringify(outD1) !== JSON.stringify(baseD1) });
  }
}

// Explicit expected-size table for the VARIABLE items (our written dims = [width, depth||10, height]).
const expectedVar = {
  'צ.מים':   [20, 10, 80],     // Water:   width 20, depth 10, height 80
  'ביוב קיר': [50, 10, 80],     // Sewage:  width 50
  'דלת':     [900, 100, 2100], // Passage: width 900, depth 100, height 2100
  'חלון':    [1000, 100, 1260],// Window:  width 1000, depth 100, height 1260
};
let varExactOk = 0, varExactBad = 0;
const varExact = [];
for (const c of sizeChecks) {
  if (c.klass !== '🎚variable') continue;
  const exp = expectedVar[c.type];
  if (!exp) continue;
  const ok = JSON.stringify(c.outDims1) === JSON.stringify(exp) && JSON.stringify(c.outDims2) === JSON.stringify(exp);
  if (ok) varExactOk++; else varExactBad++;
  varExact.push({ type: c.type, expected: exp, gotDims1: c.outDims1, gotDims2: c.outDims2, ok });
}

// strict-membership guard still throws on a thin base (wall4_oc17: lacks codes 4,6).
const strict = (() => {
  try {
    convertRoomDRv2(room, { baseBuf: fs.readFileSync(path.join(ROOT, 'templates', 'dr', 'base', 'wall4_oc17.pdp')),
      editSymbol: true, strictMembership: true });
    return false;
  } catch (e) { return e.message; }
})();

const sizeRuleOk = fixedBad === 0 && varBad === 0 && varExactBad === 0 && fixedOk > 0 && varOk > 0;

const report = {
  output: outPath, base: path.basename(baseFile) + ' (owner master DR / Rosetta base)',
  itemsPlaced: r.placedInPlace, surplusCollapsed: r.leftAsIs, dropped: r.dropped,
  correctSymbols: r.correctSymbols, exact: r.exactSymbols, family: r.familySymbols, fallback: r.fallbackSymbols,
  propertyUnitUntouched: v.blockDiffs.length === 0, terminatorUntouched: v.termDiffs.length === 0,
  allWorldPositive: v.worldNegative.length === 0, sizeUnchanged: v.sizeOk, slots: v.slotCount,
  // SIZE RULE (2026-08-25)
  sizeFixedKept: r.sizeFixedKept,
  fixedSizesByteIdenticalToNative: `${fixedOk}/${fixedOk + fixedBad}`,
  variableItemsGotOurDims: `${varExactOk}/${varExactOk + varExactBad} exact + ${varOk}/${varOk + varBad} both-triples`,
  sizeRuleVerify: sizeRuleOk ? 'PASS' : 'FAIL',
  byteVerify: v.ok ? 'PASS' : 'FAIL', strictGuardThrew: !!strict,
};
console.log(JSON.stringify(report, null, 2));
console.log('\n--- per-item size checks ---');
for (const c of sizeChecks) console.log(JSON.stringify(c));
console.log('\n--- variable exact-dim checks ---');
for (const c of varExact) console.log(JSON.stringify(c));
if (strict) console.log('\nstrict guard msg:', String(strict).slice(0, 180));

process.exit(v.ok && sizeRuleOk && !!strict ? 0 : 1);
