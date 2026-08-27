'use strict';
// Dump a wide aligned window around each 3-byte index run in BOTH files to
// reveal record framing/stride. A offsets and matching B offsets from index_diff.
const fs = require('fs');
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const A = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR1.pdp');
const B = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR2.pdp');

const spots = [
  { name: 'RUN2', a: 0x1613, b: 0x1566 },
  { name: 'RUN3', a: 0x3c33, b: 0x3ade },
  { name: 'RUN4', a: 0x3d91, b: 0x3c3c },
  { name: 'RUN5', a: 0x4651, b: 0x442a },
];

function row(buf, off) {
  const hx = [], asc = [];
  for (let c = 0; c < 16; c++) { const v = buf[off + c] ?? 0; hx.push(v.toString(16).padStart(2, '0')); asc.push(v >= 32 && v < 127 ? String.fromCharCode(v) : '.'); }
  return `${hx.join(' ')}  ${asc.join('')}`;
}
function dump(buf, center, label) {
  const start = center - 32;
  console.log(`  --- ${label} (window from 0x${start.toString(16)}) ---`);
  for (let r = 0; r < 64; r += 16) {
    const off = start + r;
    const mark = (center >= off && center < off + 16) ? ' <<' : '';
    console.log(`  0x${off.toString(16).padStart(5, '0')}  ${row(buf, off)}${mark}`);
  }
}
for (const s of spots) {
  console.log(`\n===== ${s.name}  A@0x${s.a.toString(16)}  B@0x${s.b.toString(16)} =====`);
  dump(A, s.a, 'DR1 (25 items)');
  dump(B, s.b, 'DR2 (24 items)');
}
