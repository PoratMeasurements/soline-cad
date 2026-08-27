'use strict';
// Produce a clean self-verifiable test: all socket-type items relocated (in-place,
// 921-safe value edits, no count change) onto ONE target point, so the drawing
// shows a single socket at the requested spec.
//   target: 20cm from the LEFT end of the main horizontal wall (ORDX wall 2),
//           height 110cm. Center-convention (state clearly; edge variant = +half W).
const fs = require('fs');
const { orientationCode } = require('../src/placement');
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const OUT = 'G:/My Drive/claude/ordx-pdp-converter/analysis/out/';
const buf = Buffer.from(fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR1.pdp'));

// transform + wall 2
const offX = -22876, offY = -9480;
const W = { x1: 3070, y1: 2540, x2: 7555, y2: 2540 }; // ORDX wall 2 (main horizontal)
const dx = W.x2 - W.x1, dy = W.y2 - W.y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;

const FROM_LEFT_CM = 20, HEIGHT_CM = 110, SOCKET_W = 160;
const CONV = process.argv[2] || 'center'; // 'center' | 'edge'
const along = FROM_LEFT_CM * 10 + (CONV === 'edge' ? SOCKET_W / 2 : 0); // mm, center on the wall
const px = W.x1 + along * ux, py = W.y1 + along * uy;
const T = { x: Math.round(px + offX), y: Math.round(-py + offY), orient: orientationCode(dx, dy), h04: HEIGHT_CM * 10 - 19960 };
console.log(`target: ${FROM_LEFT_CM}cm from left (${CONV}), height ${HEIGHT_CM}cm`);
console.log(`  -> plan along=${along}mm  PDP X=${T.x} Y=${T.y} orient=${T.orient}  +0x04(height)=${T.h04}`);

// MEP array: 25 records, 173 stride from 0x106. Identify sockets by name "שקע"
// (CP1255 f9 f7 f2) at rel +0x31.
const SOC = Buffer.from([0xf9, 0xf7, 0xf2]); // שקע
const N = 25, BASE = 0x106, STRIDE = 173;
let moved = 0;
for (let k = 0; k < N; k++) {
  const s = BASE + k * STRIDE;
  const nameOk = buf.subarray(s + 0x31, s + 0x34).equals(SOC);
  if (!nameOk) continue;
  buf.writeInt16LE(T.x, s + 0x00);
  buf.writeInt16LE(T.y, s + 0x02);
  buf.writeInt16LE(T.h04, s + 0x04);
  buf.writeInt16LE(T.orient, s + 0x0a);
  moved++;
}
console.log(`relocated ${moved} socket records onto the target (all others untouched)`);
const fn = OUT + `2918_oneSocket_${CONV}.pdp`;
fs.writeFileSync(fn, buf);
console.log('wrote', fn, 'len', buf.length, '(== DR1 length, count unchanged => 921-safe)');
