'use strict';
// Locate the position fields (X, Y, wall-index) inside the injected socket blocks.
// Strategy:
//   1) Rebuild the DR2->DR1 edit script (same as roundtrip.js) to isolate the
//      inserted socket bytes AND their absolute offset inside DR1.
//   2) Derive the ORDX->PDP coordinate transform (offX, offY) from the walls.
//   3) The added socket is a Duplex Socket at ORDX (1720,1113) -> expected PDP
//      (1720+offX, -1113+offY). Scan every int16 in the inserted region and
//      flag values near those targets.

const fs = require('fs');
const path = require('path');
const { parseOrdxFile } = require('../src/parseOrdx');
const { detectWallGroups } = require('../src/walls');

const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const ORDX = 'G:/My Drive/קבצים ללמידת מכונה/ORDX/';
const A = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR1.pdp'); // 25 items
const B = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR2.pdp'); // 24 items

// ---- 1) edit script, tracking absolute A-offset of each insA block ----
const RES = 16;
let i = 0, j = 0, ops = [], copyRun = 0;
const flush = () => { if (copyRun) { ops.push({ type: 'copyB', n: copyRun }); copyRun = 0; } };
while (i < A.length && j < B.length) {
  if (A[i] === B[j]) { copyRun++; i++; j++; continue; }
  flush();
  let handled = false;
  for (let k = 1; k < 4000 && !handled; k++) {
    let ok = true; for (let t = 0; t < RES; t++) if (A[i + k + t] !== B[j + t]) { ok = false; break; }
    if (ok) { ops.push({ type: 'insA', at: i, bytes: A.subarray(i, i + k) }); i += k; handled = true; }
  }
  if (handled) continue;
  for (let k = 1; k < 4000 && !handled; k++) {
    let ok = true; for (let t = 0; t < RES; t++) if (A[i + k + t] !== B[j + k + t]) { ok = false; break; }
    if (ok) { ops.push({ type: 'subA', at: i, bytes: A.subarray(i, i + k) }); i += k; j += k; handled = true; }
  }
  if (!handled) break;
}
flush();
if (j < B.length) ops.push({ type: 'copyB', n: B.length - j });
if (i < A.length) ops.push({ type: 'insA', at: i, bytes: A.subarray(i) });

const ins = ops.filter(o => o.type === 'insA');
const sub = ops.filter(o => o.type === 'subA');
console.log('inserted blocks:', ins.length, 'total', ins.reduce((s, o) => s + o.bytes.length, 0), 'bytes');
ins.forEach((o, k) => console.log(`  ins#${k} at DR1 0x${o.at.toString(16)} len ${o.bytes.length}`));
console.log('substitutions (index bumps):', sub.length);
sub.forEach((o, k) => console.log(`  sub#${k} at DR1 0x${o.at.toString(16)} len ${o.bytes.length}  ${Buffer.from(o.bytes).toString('hex')}`));

// ---- 2) derive transform from walls ----
const ordxA = parseOrdxFile(ORDX + '2918_Ktchn_TRIO_Nir_DR1.ordx');
const ordxWalls = [];
ordxA.rooms.forEach(r => r.walls.forEach(w => {
  if (w.position) ordxWalls.push({ x1: w.position.startX, y1: w.position.startY, x2: w.position.endX, y2: w.position.endY, thick: w.dimensions && w.dimensions.thick });
}));
const groups = detectWallGroups(A);
console.log('\nwall groups in DR1:', groups.map(g => `${g.format}@0x${g.offset.toString(16)} x${g.count} th${g.thick} ht${g.height}`).join(' | '));
const g = groups.sort((a, b) => b.count - a.count)[0];
const pdpWalls = [];
for (let k = 0; k < g.count; k++) {
  const s = g.offset + k * g.stride;
  if (g.format === 'int32') pdpWalls.push([A.readInt32LE(s), A.readInt32LE(s + 4), A.readInt32LE(s + 8), A.readInt32LE(s + 12)]);
  else pdpWalls.push([A.readInt16LE(s), A.readInt16LE(s + 2), A.readInt16LE(s + 4), A.readInt16LE(s + 6)]);
}
console.log('ORDX walls:', ordxWalls.length, 'PDP walls:', pdpWalls.length);
ordxWalls.forEach((w, k) => console.log(`  ordx#${k}: (${w.x1},${w.y1})->(${w.x2},${w.y2})`));
pdpWalls.forEach((w, k) => console.log(`  pdp #${k}: (${w[0]},${w[1]})->(${w[2]},${w[3]})`));

// Transform derived by matching wall lengths (walls are REORDERED between ORDX & PDP):
//   ordx#0 (3070,3319)->(3070,2540)  ==  pdp#4 (-19806,-12799)->(-19806,-12020)
//   => PDP_x = ORDX_x - 22876 ,  PDP_y = -ORDX_y - 9480
const offX = -22876, offY = -9480;
const T = (x, y) => [Math.round(x + offX), Math.round(-y + offY)];

// The socket is on wall number 2 (ordx#1: (3070,2540)->(7555,2540), horizontal @ y=2540).
// ORDX fixture X=1720 is distance ALONG the wall, Y=1113 is mount height (Z, not plan).
// => plan position candidates along wall 1: start+1720 or end-1720.
const w1 = ordxWalls[1];
const along = 1720;
const candA = T(w1.x1 + along, w1.y1);              // from start
const candB = T(w1.x2 - along, w1.y2);              // from end
const candRaw = T(1720, 1113);                      // if X/Y were literal plan coords
console.log(`\ntransform offX=${offX} offY=${offY}`);
console.log('candidate socket PDP positions:');
console.log('  A (wall1 start +1720):', candA);
console.log('  B (wall1 end   -1720):', candB);
console.log('  raw (literal 1720,1113):', candRaw);

// Dump ALL room-plausible int16 coords in the inserted blocks (both plan ranges).
const XLO = -25000, XHI = -8000; // observed PDP plan coord band
console.log(`\n== all int16 in [${XLO},${XHI}] across inserted blocks ==`);
ins.forEach((o, bk) => {
  const buf = Buffer.from(o.bytes);
  const hits = [];
  for (let p = 0; p + 2 <= buf.length; p += 2) {
    const v = buf.readInt16LE(p);
    if (v >= XLO && v <= XHI) hits.push(`+0x${p.toString(16)}=${v}`);
  }
  console.log(`  block#${bk} (len ${buf.length}) @DR1 0x${o.at.toString(16)}: ${hits.length} hits`);
  if (hits.length) console.log('      ' + hits.join('  '));
});
