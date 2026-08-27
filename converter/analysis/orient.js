'use strict';
// Test hypothesis: MEP +0x0a == round(10 * wall_direction_angle_deg) (decidegrees).
// For every MEP record, find the nearest wall, compute its angle, and compare.
const fs = require('fs');
const { detectWallGroups } = require('../src/walls');
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const file = process.argv[2] || '2918_Ktchn_TRIO_Nir_DR1.pdp';
const buf = fs.readFileSync(PDP + file);

const MARK = Buffer.from([0xe0, 0xe9, 0xf0, 0xe5, 0xe3, 0xf8, 0xe5]);
const recs = [];
let p = 0;
while (true) { const i = buf.indexOf(MARK, p); if (i < 0) break; if (i - 0x28 >= 0) recs.push(i - 0x28); p = i + 1; }

const g = detectWallGroups(buf).sort((a, b) => b.count - a.count)[0];
const walls = [];
for (let k = 0; k < g.count; k++) {
  const s = g.offset + k * g.stride;
  walls.push([buf.readInt16LE(s), buf.readInt16LE(s + 2), buf.readInt16LE(s + 4), buf.readInt16LE(s + 6)]);
}
function nearest(x, y) {
  let best = -1, bd = 1e9, bt = 0;
  walls.forEach((w, i) => {
    const [x1, y1, x2, y2] = w; const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
    let t = ((x - x1) * dx + (y - y1) * dy) / L2; t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx, py = y1 + t * dy; const d = Math.hypot(x - px, y - py);
    if (d < bd) { bd = d; best = i; bt = t; }
  });
  return { wall: best, dist: Math.round(bd), t: bt };
}
function ang(w) { let a = Math.atan2(w[3] - w[1], w[2] - w[0]) * 180 / Math.PI; if (a < 0) a += 360; return a; }

console.log(`file ${file}`);
console.log('walls angles(deg):', walls.map((w, i) => `w${i}=${ang(w).toFixed(2)}`).join(' '));
console.log('\nrec  X       Y     +0x0a   wall  wallAng  10*ang  code-10ang   t(along)  name');
recs.forEach((s, i) => {
  const x = buf.readInt16LE(s), y = buf.readInt16LE(s + 2), o = buf.readInt16LE(s + 0x0a);
  const nw = nearest(x, y); if (nw.wall < 0) return;
  const a = ang(walls[nw.wall]); const a10 = Math.round(a * 10);
  let nm = ''; for (let k = 0x31; k < 0x45; k++) { const b = buf[s + k]; if (b === 0) break; nm += String.fromCharCode(b); }
  console.log(
    String(i).padStart(3), String(x).padStart(7), String(y).padStart(7),
    String(o).padStart(6), '  w' + nw.wall, a.toFixed(2).padStart(8),
    String(a10).padStart(7), String(o - a10).padStart(9),
    nw.t.toFixed(3).padStart(9), '  ' + nm
  );
});
