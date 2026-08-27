'use strict';
// Rigorous index-bump finder. Given the 7 known insertion points in DR1, map
// DR1 -> DR2 by skipping the inserted regions, then report EVERY differing byte
// in the aligned regions grouped into runs, with context + int16 interpretation.
const fs = require('fs');
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const A = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR1.pdp'); // 25 items
const B = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR2.pdp'); // 24 items

// inserted [offsetInA, length] (socket's 7 blocks) from socket_fields.js
const INS = [[0x514, 173], [0x240d, 168], [0x44ee, 210], [0x68ff, 256], [0x96c0, 291], [0xecc1, 795], [0x13085, 3]];
const insAt = (a) => INS.find(([o, l]) => a >= o && a < o + l);

// Walk A; b tracks position in B. Inserted A-bytes advance only a.
let a = 0, b = 0;
const diffs = []; // {aOff,bOff,aByte,bByte}
while (a < A.length) {
  const ins = insAt(a);
  if (ins) { a = ins[0] + ins[1]; continue; }   // skip inserted region
  if (b >= B.length) { diffs.push({ aOff: a, bOff: -1, aByte: A[a], bByte: -1 }); a++; continue; }
  if (A[a] !== B[b]) diffs.push({ aOff: a, bOff: b, aByte: A[a], bByte: B[b] });
  a++; b++;
}
console.log(`aligned diffs: ${diffs.length} bytes;  A consumed to ${a}, B consumed to ${b} (B.len=${B.length})`);

// group into runs (contiguous in A)
const runs = [];
for (const d of diffs) {
  const last = runs[runs.length - 1];
  if (last && d.aOff === last.aEnd) { last.aEnd = d.aOff + 1; last.items.push(d); }
  else runs.push({ aStart: d.aOff, aEnd: d.aOff + 1, items: [d] });
}
console.log(`grouped into ${runs.length} runs\n`);

for (const r of runs) {
  const len = r.aEnd - r.aStart, bOff = r.items[0].bOff;
  console.log(`RUN @A 0x${r.aStart.toString(16)}  (B 0x${(bOff<0?-1:bOff).toString(16)})  len ${len}`);
  // show wider window in both files
  const ctx = 6;
  const aw = [], bw = [];
  for (let k = -ctx; k < len + ctx; k++) { aw.push((A[r.aStart + k] ?? 0).toString(16).padStart(2, '0')); }
  for (let k = -ctx; k < len + ctx; k++) { bw.push((B[bOff + k] ?? 0).toString(16).padStart(2, '0')); }
  console.log('  A:', aw.join(' '));
  console.log('  B:', bw.join(' '));
  // int16 at run start (aligned) both files
  if (len >= 2) console.log(`  i16  A@start=${A.readInt16LE(r.aStart)}  B@start=${B.readInt16LE(bOff)}`);
  if (len >= 1) console.log(`  byte A=${A[r.aStart]}  B=${B[bOff]}   (delta ${A[r.aStart] - B[bOff]})`);
  console.log();
}
