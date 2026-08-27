'use strict';
// Test whether the MEP dims field (+0xa1/+0xa7 = W,depth,H int16 mm) drives the
// rendered element size. Build on the one_socket_center base (all sockets stacked
// at the target) and rewrite the dims to (a) real ORDX Duplex 160/15/80 and
// (b) an exaggerated 400/50/300 so any resize is obvious. 921-safe (value-only).
const fs = require('fs');
const OUT = 'G:/My Drive/claude/ordx-pdp-converter/analysis/out/';
const SOC = Buffer.from([0xf9, 0xf7, 0xf2]); // שקע
const N = 25, BASE = 0x106, STRIDE = 173;

function setDims(srcPath, dstPath, W, D, H) {
  const buf = Buffer.from(fs.readFileSync(srcPath));
  let n = 0;
  for (let k = 0; k < N; k++) {
    const s = BASE + k * STRIDE;
    if (!buf.subarray(s + 0x31, s + 0x34).equals(SOC)) continue;
    for (const base of [0xa1, 0xa7]) {           // both dim copies
      buf.writeInt16LE(W, s + base);
      buf.writeInt16LE(D, s + base + 2);
      buf.writeInt16LE(H, s + base + 4);
    }
    n++;
  }
  fs.writeFileSync(dstPath, buf);
  console.log(`${dstPath.split('/').pop()}: set ${n} sockets to W=${W} D=${D} H=${H}  (len ${buf.length})`);
}

const src = OUT + '2918_oneSocket_center.pdp';
setDims(src, OUT + '2918_size_real160.pdp', 160, 15, 80);   // real ORDX Duplex
setDims(src, OUT + '2918_size_big400.pdp', 400, 50, 300);   // exaggerated visual test
