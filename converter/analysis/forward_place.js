'use strict';
// Forward-projection test of the placement model:
//   plan point = ORDX_wall_start + (X + Width/2) along wall direction (on centerline)
//   PDP = (plan_x + offX, -plan_y + offY)
// Compare against the 25 MEP records read from the PDP. If errors ~0 => solved.
const fs = require('fs');
const { parseOrdxFile } = require('../src/parseOrdx');
const { detectWallGroups } = require('../src/walls');

const ORDX = 'G:/My Drive/קבצים ללמידת מכונה/ORDX/';
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const model = parseOrdxFile(ORDX + '2918_Ktchn_TRIO_Nir_DR1.ordx');
const buf = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR1.pdp');

// ---- PDP MEP coords ----
const MARK = Buffer.from([0xe0, 0xe9, 0xf0, 0xe5, 0xe3, 0xf8, 0xe5]);
const pdp = [];
let p = 0;
while (true) { const i = buf.indexOf(MARK, p); if (i < 0) break; const s = i - 0x28; if (s >= 0) pdp.push({ x: buf.readInt16LE(s), y: buf.readInt16LE(s + 2), o: buf.readInt16LE(s + 0x0a), off: s }); p = i + 1; }

// ---- transform (derived earlier) ----
const offX = -22876, offY = -9480;
const T = (x, y) => [Math.round(x + offX), Math.round(-y + offY)];

// ---- forward project every ORDX fixture ----
let placed = [];
for (const room of model.rooms) {
  for (const w of room.walls) {
    if (!w.position) continue;
    const { startX, startY, endX, endY } = w.position;
    const dx = endX - startX, dy = endY - startY, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L; // unit along wall
    const items = [...w.fixtures, ...w.furnishings];
    for (const it of items) {
      if (!it.position) continue;
      const W = (it.size && it.size.width) || 0;
      const s = it.position.x + W / 2;             // center along wall
      const px = startX + s * ux, py = startY + s * uy;
      const [PX, PY] = T(px, py);
      const wallAng = (Math.atan2(-dy, dx) * 180 / Math.PI); // PDP y is flipped
      let a = Math.atan2(-dy, dx) * 180 / Math.PI; if (a < 0) a += 360;
      placed.push({ name: it.name, wall: w.number, W, PX, PY, code: Math.round(a * 10) });
    }
  }
}

console.log('ORDX fixtures placed:', placed.length, ' PDP MEP records:', pdp.length);
console.log('\nname            wall  W    predPX  predPY  code | nearestPDP dX dY dCode');
let sumErr = 0, maxErr = 0;
for (const q of placed) {
  let best = null, bd = 1e9;
  for (const r of pdp) { const d = Math.hypot(r.x - q.PX, r.y - q.PY); if (d < bd) { bd = d; best = r; } }
  const dX = best.x - q.PX, dY = best.y - q.PY, dC = best.o - q.code;
  sumErr += bd; maxErr = Math.max(maxErr, bd);
  console.log(
    (q.name || '?').padEnd(15), String(q.wall).padStart(3), String(q.W).padStart(4),
    String(q.PX).padStart(7), String(q.PY).padStart(7), String(q.code).padStart(5),
    ' |', String(dX).padStart(4), String(dY).padStart(4), String(dC).padStart(5),
    bd > 30 ? '  <== far' : ''
  );
}
console.log(`\nmean match dist = ${(sumErr / placed.length).toFixed(1)}mm  max = ${maxErr.toFixed(1)}mm`);
