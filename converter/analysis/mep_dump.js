'use strict';
// Full dump of the injected MEP record (block#0, 173B) and the 5 substitution
// contexts, comparing DR1 (25 items) vs DR2 (24 items) byte-for-byte.
const fs = require('fs');
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const A = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR1.pdp');
const B = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR2.pdp');

function dump(buf, start, len, label) {
  console.log(`\n== ${label} @0x${start.toString(16)} len ${len} ==`);
  for (let r = 0; r < len; r += 16) {
    const row = [];
    const i16 = [];
    for (let c = 0; c < 16 && r + c < len; c++) row.push(buf[start + r + c].toString(16).padStart(2, '0'));
    for (let c = 0; c + 1 < 16 && r + c < len; c += 2) i16.push(String(buf.readInt16LE(start + r + c)).padStart(7));
    const asc = [];
    for (let c = 0; c < 16 && r + c < len; c++) { const b = buf[start + r + c]; asc.push(b >= 32 && b < 127 ? String.fromCharCode(b) : '.'); }
    console.log(`+0x${r.toString(16).padStart(3, '0')}  ${row.join(' ').padEnd(48)}  ${asc.join('')}   ${i16.join(' ')}`);
  }
}

dump(A, 0x514, 173, 'MEP record (DR1 block#0)');

// substitution contexts: show a window in both files
const subs = [
  { at: 0x11a, len: 1 },
  { at: 0x1613, len: 1 },
  { at: 0x3c33, len: 3 },
  { at: 0x3d91, len: 3 },
  { at: 0x4651, len: 3 },
];
console.log('\n\n===== SUBSTITUTION CONTEXTS (DR1 vs DR2) =====');
for (const s of subs) {
  const w = 12;
  const st = s.at - 4;
  const a = [], b = [];
  for (let k = 0; k < w; k++) { a.push(A[st + k].toString(16).padStart(2, '0')); b.push(B[st + k].toString(16).padStart(2, '0')); }
  console.log(`\nsub @0x${s.at.toString(16)} len ${s.len}  (window from 0x${st.toString(16)})`);
  console.log('  DR1:', a.join(' '));
  console.log('  DR2:', b.join(' '));
  // int16 interpretation at the changed byte(s)
  console.log(`  DR1 i16@at=${A.readInt16LE(s.at)}  DR2 i16@at=${B.readInt16LE(s.at)}   DR1 byte=${A[s.at]} DR2 byte=${B[s.at]}`);
}
