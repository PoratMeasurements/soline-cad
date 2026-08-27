'use strict';
// Find the height field in the MEP record by correlating every MEP int16 offset
// against the known ORDX mount-height of the matching socket.
const fs = require('fs');
const { parseOrdxFile } = require('../src/parseOrdx');
const { placeAll } = require('../src/placement');
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const ORDX = 'G:/My Drive/קבצים ללמידת מכונה/ORDX/';
const buf = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR1.pdp');
const model = parseOrdxFile(ORDX + '2918_Ktchn_TRIO_Nir_DR1.ordx');
const offX = -22876, offY = -9480;

// PDP MEP records (clean 173 stride from 0x106)
const N = 25, BASE = 0x106, STRIDE = 173;
const recs = [];
for (let k = 0; k < N; k++) { const s = BASE + k * STRIDE; recs.push({ s, x: buf.readInt16LE(s), y: buf.readInt16LE(s + 2) }); }

// ORDX placements carry the height (item.position.y). Recompute with height kept.
const placed = placeAll(model, offX, offY); // has x,y (plan)
// attach ordx height by re-walking (placeAll drops it); rebuild parallel list
const withH = [];
for (const room of model.rooms) for (const w of room.walls) for (const it of [...(w.fixtures||[]), ...(w.furnishings||[])]) {
  withH.push({ name: it.name, h: it.position ? it.position.y : null });
}
placed.forEach((p, i) => p.h = withH[i] && withH[i].h);

// match each placed socket to nearest MEP record
const sockets = placed.filter(p => /socket|שקע/i.test(p.name || ''));
const rows = [];
for (const p of sockets) {
  let best = null, bd = 1e9;
  for (const r of recs) { const d = Math.hypot(r.x - p.x, r.y - p.y); if (d < bd) { bd = d; best = r; } }
  if (bd <= 5) rows.push({ h: p.h, s: best.s, d: bd });
}
console.log(`matched ${rows.length} sockets to MEP records (dist<=5)`);

// for each MEP int16 offset, compute correlation with height h
function corr(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}
const hs = rows.map(r => r.h);
console.log('\noffset  corr    sample values (per socket)');
for (let o = 0; o + 2 <= STRIDE; o++) {
  const vs = rows.map(r => buf.readInt16LE(r.s + o));
  if (vs.every(v => v === vs[0])) continue; // constant -> skip
  const c = corr(vs, hs);
  if (Math.abs(c) > 0.6) console.log(`+0x${o.toString(16).padStart(2,'0')}  ${c.toFixed(3)}   [${vs.join(', ')}]  vs h [${hs.join(', ')}]`);
}
