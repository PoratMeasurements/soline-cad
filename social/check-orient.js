'use strict';
// Compares the Orientation flag of an exported file against its source.
const fs = require('fs');
const path = require('path');
const { readExif } = require('./lib/exif');

const DATA = path.join(__dirname, 'data');
const { stories } = JSON.parse(fs.readFileSync(path.join(DATA, 'stories.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const ids = process.argv.slice(2);
for (const s of stories.filter((x) => ids.includes(x.siteId))) {
  console.log('=== ' + s.siteId + ' ===');
  s.after.slice(0, 3).forEach((src, i) => {
    const o = readExif(src);
    console.log(`  מקור  ${path.basename(src).padEnd(16)} orientation=${o.ok ? o.orientation : 'no-exif'}  ${o.width}x${o.height}`);
  });
}

// And what landed on disk
const L = cfg.libraryPath;
for (const dir of fs.readdirSync(path.join(L, '_לבדיקה'))) {
  if (!ids.some((id) => dir.startsWith(id))) continue;
  const ad = path.join(L, '_לבדיקה', dir, 'אחרי');
  for (const f of fs.readdirSync(ad).slice(0, 3)) {
    const o = readExif(path.join(ad, f));
    console.log(`  יצוא  ${f.padEnd(16)} orientation=${o.ok ? o.orientation : 'no-exif'}`);
  }
}
