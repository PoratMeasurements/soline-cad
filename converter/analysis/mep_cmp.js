'use strict';
// Compare several MEP records field-by-field (as int16) to see which fields
// vary with position and which track the wall. Records chosen by file offset.
const fs = require('fs');
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const buf = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR1.pdp');
// offsets from mep_scan: sockets on wall3: rec5..8, plus rec9(gz),
// wall2 sockets rec21,22, wall1 rec23.
const recs = {
  'r5_w3_soc': 0x467, 'r6_w3_soc': 0x514, 'r7_w3_soc': 0x5c1, 'r8_w3_soc': 0x66e,
  'r21_w2_soc': 0xf37, 'r22_w2_soc': 0xfe4, 'r23_w1_soc': 0x1091, 'r24_w0_soc': 0x113e,
};
const names = Object.keys(recs);
const N = 173;
// print header
console.log('int16 fields (LE) per record; only offsets where any record is nonzero');
const cols = names.map(n => n.padStart(9));
console.log('off  '.padEnd(6) + cols.join(' '));
for (let o = 0; o + 2 <= N; o += 2) {
  const vals = names.map(n => buf.readInt16LE(recs[n] + o));
  if (vals.every(v => v === 0)) continue;
  console.log('+0x' + o.toString(16).padStart(2, '0') + ' ' + vals.map(v => String(v).padStart(9)).join(' '));
}
// also show the raw byte at odd-critical single-byte fields 0x0a..0x13
console.log('\nsingle bytes +0x08..+0x14:');
for (let o = 0x08; o <= 0x14; o++) {
  const vals = names.map(n => buf[recs[n] + o]);
  console.log('+0x' + o.toString(16) + ' ' + vals.map(v => String(v).padStart(9)).join(' '));
}
