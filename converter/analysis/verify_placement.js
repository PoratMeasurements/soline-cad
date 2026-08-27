'use strict';
// Verify src/placement.js against a golden PDP using optimal 1-to-1 matching
// (greedy on sorted distances) so a claimed partner isn't double-counted.
const fs = require('fs');
const { parseOrdxFile } = require('../src/parseOrdx');
const { placeAll } = require('../src/placement');

const ORDX = 'G:/My Drive/קבצים ללמידת מכונה/ORDX/';
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const base = process.argv[2] || '2918_Ktchn_TRIO_Nir_DR1';
const model = parseOrdxFile(ORDX + base + '.ordx');
const buf = fs.readFileSync(PDP + base + '.pdp');

const offX = -22876, offY = -9480; // 2918 transform

// read PDP MEP records
const MARK = Buffer.from([0xe0, 0xe9, 0xf0, 0xe5, 0xe3, 0xf8, 0xe5]);
const pdp = [];
let p = 0;
while (true) { const i = buf.indexOf(MARK, p); if (i < 0) break; const s = i - 0x28; if (s >= 0) pdp.push({ x: buf.readInt16LE(s), y: buf.readInt16LE(s + 2), o: buf.readInt16LE(s + 0x0a) }); p = i + 1; }

const placed = placeAll(model, offX, offY);

// build all candidate pairs, sort by distance, assign greedily 1-1
const pairs = [];
placed.forEach((q, qi) => pdp.forEach((r, ri) => pairs.push({ qi, ri, d: Math.hypot(q.x - r.x, q.y - r.y) })));
pairs.sort((a, b) => a.d - b.d);
const qUsed = new Set(), rUsed = new Set(), match = {};
for (const pr of pairs) {
  if (qUsed.has(pr.qi) || rUsed.has(pr.ri)) continue;
  qUsed.add(pr.qi); rUsed.add(pr.ri); match[pr.qi] = pr;
}

console.log(`${base}: ORDX placed=${placed.length}  PDP=${pdp.length}`);
console.log('\nname            wall float  predX   predY  code |  dX   dY  dCode  dist');
let exact = 0, near = 0;
placed.forEach((q, qi) => {
  const m = match[qi]; const r = pdp[m.ri];
  const dX = r.x - q.x, dY = r.y - q.y, dC = r.o - q.orientation;
  if (dX === 0 && dY === 0 && dC === 0) exact++;
  else if (m.d <= 15) near++;
  console.log(
    (q.name || '?').padEnd(15), String(q.wall).padStart(3),
    (q.floating ? 'F' : ' ').padStart(4),
    String(q.x).padStart(7), String(q.y).padStart(7), String(q.orientation).padStart(5),
    ' |', String(dX).padStart(4), String(dY).padStart(4), String(dC).padStart(5),
    m.d.toFixed(0).padStart(6), m.d > 15 ? ' <==' : ''
  );
});
console.log(`\nexact (dX=dY=dCode=0): ${exact}/${placed.length}   within 15mm: ${exact + near}/${placed.length}`);
