const fs = require('fs');
const path = process.argv[2];
const buf = fs.readFileSync(path);
console.log('FILE:', path, 'SIZE:', buf.length, '(0x'+buf.length.toString(16)+')');

// Map zero-runs vs data-runs to understand block layout
const ZTHRESH = 32; // a run of >=32 zeros counts as a gap
let i = 0;
let segments = [];
while (i < buf.length) {
  if (buf[i] === 0) {
    let j = i;
    while (j < buf.length && buf[j] === 0) j++;
    if (j - i >= ZTHRESH) {
      segments.push(['ZERO', i, j, j - i]);
      i = j;
      continue;
    }
  }
  // data run until a long zero gap
  let j = i;
  while (j < buf.length) {
    if (buf[j] === 0) {
      let k = j;
      while (k < buf.length && buf[k] === 0) k++;
      if (k - j >= ZTHRESH) break;
      j = k;
    } else j++;
  }
  segments.push(['DATA', i, j, j - i]);
  i = j;
}
console.log('=== SEGMENT MAP (type start..end len) ===');
for (const [t, s, e, l] of segments) {
  console.log(t.padEnd(5), '0x'+s.toString(16).padStart(6,'0'), '..', '0x'+e.toString(16).padStart(6,'0'), 'len', l, '(0x'+l.toString(16)+')');
}
