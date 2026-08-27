'use strict';
// Quality audit of the exported library: resolution, orientation flag, file size.
const fs = require('fs');
const path = require('path');
const { readExif } = require('./lib/exif');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const L = cfg.libraryPath;

const rows = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.jpe?g$/i.test(e.name)) rows.push(p);
  }
}
walk(L);

const buckets = { rotated: 0, upright: 0, noExif: 0 };
const px = [];
const small = [];
for (const f of rows) {
  const x = readExif(f);
  const st = fs.statSync(f);
  if (!x.ok) buckets.noExif++;
  else if (x.orientation && x.orientation !== 1) buckets.rotated++;
  else buckets.upright++;
  if (st.size < 1024 * 1024) small.push([f, st.size]);
  px.push(st.size);
}

px.sort((a, b) => a - b);
console.log(JSON.stringify({
  files: rows.length,
  withRotationFlag: buckets.rotated,
  uprightOrNoFlag: buckets.upright + buckets.noExif,
  medianKB: Math.round(px[Math.floor(px.length / 2)] / 1024),
  minKB: Math.round(px[0] / 1024),
  under1MB: small.length,
}, null, 2));
