'use strict';
// Enumerate every MEP record in a PDP by finding the "אינודרו" marker (CP1255
// bytes e0 e9 f0 e5 e3 f8 e5) that sits at rel +0x28 of each 173B record.
// For each record read the candidate position (+0x00,+0x02) and candidate
// wall-index (+0x0c), then check which wall line the point lies on.
const fs = require('fs');
const { detectWallGroups } = require('../src/walls');
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const file = process.argv[2] || '2918_Ktchn_TRIO_Nir_DR1.pdp';
const buf = fs.readFileSync(PDP + file);

const MARK = Buffer.from([0xe0, 0xe9, 0xf0, 0xe5, 0xe3, 0xf8, 0xe5]); // אינודרו
const REL = 0x28; // marker offset inside record
const recs = [];
let p = 0;
while (true) {
  const idx = buf.indexOf(MARK, p);
  if (idx < 0) break;
  const start = idx - REL;
  if (start >= 0) recs.push(start);
  p = idx + 1;
}
console.log(`file ${file}: ${recs.length} MEP records`);

// walls
const g = detectWallGroups(buf).sort((a, b) => b.count - a.count)[0];
const walls = [];
for (let k = 0; k < g.count; k++) {
  const s = g.offset + k * g.stride;
  walls.push([buf.readInt16LE(s), buf.readInt16LE(s + 2), buf.readInt16LE(s + 4), buf.readInt16LE(s + 6)]);
}
function nearestWall(x, y) {
  let best = -1, bd = 1e9;
  walls.forEach((w, i) => {
    const [x1, y1, x2, y2] = w;
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
    let t = ((x - x1) * dx + (y - y1) * dy) / L2; t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx, py = y1 + t * dy;
    const d = Math.hypot(x - px, y - py);
    if (d < bd) { bd = d; best = i; }
  });
  return { wall: best, dist: Math.round(bd) };
}

console.log('idx  fileOff   X       Y     +0x0a +0x0c +0x0e  name          nearestWall(dist)');
recs.forEach((s, i) => {
  const x = buf.readInt16LE(s), y = buf.readInt16LE(s + 2);
  const a = buf.readInt16LE(s + 0x0a), c = buf.readInt16LE(s + 0x0c), e = buf.readInt16LE(s + 0x0e);
  // name at +0x31 in CP1255 (read up to 12 bytes till 0)
  let nm = '';
  for (let k = 0x31; k < 0x31 + 14; k++) { const b = buf[s + k]; if (b === 0) break; nm += String.fromCharCode(b); }
  const nw = nearestWall(x, y);
  console.log(
    String(i).padStart(3),
    '0x' + s.toString(16).padStart(6, '0'),
    String(x).padStart(7), String(y).padStart(7),
    String(a).padStart(5), String(c).padStart(5), String(e).padStart(5),
    ' ', nm.padEnd(12), ` w${nw.wall}(${nw.dist})`
  );
});
