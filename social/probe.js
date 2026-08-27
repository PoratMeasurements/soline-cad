'use strict';
// Quick sanity probe: how much EXIF / GPS actually exists in each tree?
const fs = require('fs');
const path = require('path');
const { readExif } = require('./lib/exif');

const IMG = new Set(['.jpg', '.jpeg', '.png', '.heic', '.webp']);

function sample(root, limit) {
  const out = [];
  const stack = [root];
  while (stack.length && out.length < limit) {
    const dir = stack.pop();
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (IMG.has(path.extname(e.name).toLowerCase())) {
        out.push(p);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}

for (const root of process.argv.slice(2)) {
  const files = sample(root, 40);
  let gps = 0, dated = 0, thumbs = 0;
  console.log('\n=== ' + root + '  (' + files.length + ' sampled) ===');
  for (const f of files) {
    const x = readExif(f, { thumb: true });
    if (x.ok && x.taken) dated++;
    if (x.ok && x.lat != null) gps++;
    if (x.ok && x.thumb) thumbs++;
  }
  console.log(`dated: ${dated}/${files.length}   gps: ${gps}/${files.length}   thumb: ${thumbs}/${files.length}`);
  for (const f of files.slice(0, 6)) {
    const x = readExif(f);
    console.log('  ', path.basename(f).padEnd(34), '|', x.ok ? `${x.taken || '-'} | ${x.make || '-'} ${x.model || '-'} | ${x.lat ?? '-'},${x.lon ?? '-'}` : 'FAIL ' + x.reason);
  }
}
