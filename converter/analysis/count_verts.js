'use strict';
// Parse the socket 2D-symbol polygon (block#1, 168B @0x240d) into vertices and
// pen-up separators, to test whether RUN2's +14 == symbol vertex/segment count.
const fs = require('fs');
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const A = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR1.pdp');
const start = 0x240d, len = 168;

let verts = 0, seps = 0;
const toks = [];
for (let p = 0; p + 4 <= len; p += 4) {
  const x = A.readInt16LE(start + p), y = A.readInt16LE(start + p + 2);
  if (x === -1 && y === 0) { seps++; toks.push('|'); }
  else { verts++; toks.push(`(${x},${y})`); }
}
console.log(`socket 2D symbol: ${verts} vertices, ${seps} pen-up separators, ${verts + seps} total 4B tokens`);
console.log('RUN2 delta was +14. matches:',
  { verts, seps, 'verts+seps': verts + seps, 'verts-seps': verts - seps });
console.log('\ntokens:', toks.join(' '));
