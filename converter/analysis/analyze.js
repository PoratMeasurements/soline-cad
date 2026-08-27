const fs = require('fs');
const path = process.argv[2];
const buf = fs.readFileSync(path);
console.log('FILE:', path, 'SIZE:', buf.length);

// Windows-1255 Hebrew decode for a byte
function decodeByte(b) {
  if (b >= 0x20 && b < 0x7f) return String.fromCharCode(b);
  if (b >= 0xe0 && b <= 0xfa) return String.fromCharCode(0x05d0 + (b - 0xe0)); // Hebrew aleph..tav
  return null;
}

// Extract runs of "printable" (ASCII printable OR Hebrew) with min length
const MIN = 3;
let runs = [];
let cur = '';
let start = 0;
for (let i = 0; i <= buf.length; i++) {
  const b = i < buf.length ? buf[i] : -1;
  const ch = b >= 0 ? decodeByte(b) : null;
  if (ch !== null) {
    if (cur === '') start = i;
    cur += ch;
  } else {
    if (cur.length >= MIN) runs.push([start, cur]);
    cur = '';
  }
}
console.log('=== STRINGS (offset hex : text) ===');
for (const [off, s] of runs) {
  console.log('0x' + off.toString(16).padStart(6,'0'), ':', JSON.stringify(s));
}
console.log('TOTAL RUNS:', runs.length);
