'use strict';
// Find every "FRA-type" index record (tail signature) in DR1 and DR2 and read
// the 3-byte variable field before the tail, to reverse its meaning.
const fs = require('fs');
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const A = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR1.pdp');
const B = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR2.pdp');

// Variable 3 bytes sit immediately before this tail (from index_ctx.js).
const TAIL = Buffer.from([0x09, 0xac, 0x03, 0x59, 0x00, 0xec, 0x04, 0x00, 0x00, 0x0b]);

function scan(buf, label) {
  const rows = [];
  let p = 0;
  while (true) {
    const i = buf.indexOf(TAIL, p); if (i < 0) break;
    const f = i - 3; // 3 variable bytes
    const b0 = buf[f], b1 = buf[f + 1], b2 = buf[f + 2];
    rows.push({ at: f, b0, b1, b2, u24: b0 | (b1 << 8) | (b2 << 16), i16lo: buf.readInt16LE(f), i16hi: buf.readInt16LE(f + 1) });
    p = i + 1;
  }
  console.log(`\n== ${label}: ${rows.length} FRA-type records ==`);
  rows.forEach((r, k) => console.log(
    `  #${k} @0x${r.at.toString(16)}  bytes ${r.b0.toString(16).padStart(2,'0')} ${r.b1.toString(16).padStart(2,'0')} ${r.b2.toString(16).padStart(2,'0')}  u24=${r.u24}  i16lo=${r.i16lo}  i16@+1=${r.i16hi}`));
  return rows;
}
const ra = scan(A, 'DR1 (25 items)');
const rb = scan(B, 'DR2 (24 items)');

// pair up by order and show deltas
console.log('\n== pairwise (DR1 #k vs DR2 #k) ==');
const n = Math.min(ra.length, rb.length);
for (let k = 0; k < n; k++) {
  const a = ra[k], b = rb[k];
  console.log(`  #${k}  DR1 u24=${a.u24} (${a.b0},${a.b1},${a.b2})  DR2 u24=${b.u24} (${b.b0},${b.b1},${b.b2})  d_u24=${a.u24-b.u24}  d_b0=${a.b0-b.b0} d_b1=${a.b1-b.b1} d_b2=${a.b2-b.b2}`);
}
