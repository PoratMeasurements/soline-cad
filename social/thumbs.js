'use strict';
// Extracts the JPEG thumbnail that iPhones embed in EXIF (~160x120, a few KB)
// so a story can be eyeballed without pulling full-size originals off Drive.
// Falls back to copying the original when no embedded thumbnail exists.
//
//   node thumbs.js story <siteId>...      → data/review/<siteId>/{before,after}_NN.jpg
//   node thumbs.js orphans [limit]        → data/review/_orphans/  (after-photos with no GPS)

const fs = require('fs');
const path = require('path');
const { readExif } = require('./lib/exif');

const DATA = path.join(__dirname, 'data');
const REVIEW = path.join(DATA, 'review');

function emit(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const x = readExif(src, { thumb: true });
  if (x.ok && x.thumb && x.thumb.length > 1000) {
    fs.writeFileSync(dest, x.thumb);
    return 'thumb';
  }
  try {
    fs.copyFileSync(src, dest);
    return 'copy';
  } catch {
    return 'fail';
  }
}

const mode = process.argv[2];

if (mode === 'story') {
  const ids = new Set(process.argv.slice(3));
  const { stories } = JSON.parse(fs.readFileSync(path.join(DATA, 'stories.json'), 'utf8'));
  for (const s of stories.filter((x) => ids.has(x.siteId))) {
    const dir = path.join(REVIEW, s.siteId);
    fs.rmSync(dir, { recursive: true, force: true });
    s.before.forEach((f, i) => emit(f, path.join(dir, `before_${String(i + 1).padStart(2, '0')}${path.extname(f)}`)));
    s.after.filter((f) => !/\.(mp4|mov|m4v|avi)$/i.test(f))
      .forEach((f, i) => emit(f, path.join(dir, `after_${String(i + 1).padStart(2, '0')}${path.extname(f)}`)));
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(s, null, 2));
    console.log(`${s.siteId}  ${s.client || '—'}  →  ${dir}`);
  }
} else if (mode === 'orphans') {
  const limit = Number(process.argv[3] || 60);
  const { items } = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8'));
  const orphans = items.filter((r) => r.side === 'after' && !r.dupOf && r.lat == null && r.kind === 'image');
  const dir = path.join(REVIEW, '_orphans');
  fs.rmSync(dir, { recursive: true, force: true });
  const step = Math.max(1, Math.floor(orphans.length / limit));
  const map = [];
  for (let i = 0, k = 0; i < orphans.length && k < limit; i += step, k++) {
    const r = orphans[i];
    const dest = path.join(dir, r.dir.replace(/[\\/]/g, '_'), String(k).padStart(3, '0') + path.extname(r.name));
    emit(r.path, dest);
    map.push({ thumb: path.relative(DATA, dest), source: r.path });
  }
  fs.writeFileSync(path.join(dir, 'map.json'), JSON.stringify(map, null, 2));
  console.log(`${map.length} orphan samples → ${dir}`);
} else if (mode === 'pairs') {
  // One representative frame per side per story, flat, for a fast triage pass.
  const count = Number(process.argv[3] || 18);
  const { stories } = JSON.parse(fs.readFileSync(path.join(DATA, 'stories.json'), 'utf8'));
  const dir = path.join(REVIEW, '_pairs');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const still = (f) => !/\.(mp4|mov|m4v|avi)$/i.test(f);
  for (const s of stories.slice(0, count)) {
    const b = s.before.filter(still);
    const a = s.after.filter(still);
    if (!b.length || !a.length) continue;
    // Middle of each session — first frames are often a blurry warm-up shot.
    emit(b[Math.floor(b.length / 2)], path.join(dir, `${s.siteId}_1_lifney.jpg`));
    emit(a[Math.floor(a.length / 2)], path.join(dir, `${s.siteId}_2_achrey.jpg`));
    console.log(`${s.siteId}  ${s.beforeDate} → ${s.afterDate}  (${s.gapDays}י)  ${s.shop || '—'}`);
  }
  console.log('→ ' + dir);
} else {
  console.log('usage: node thumbs.js story <siteId>... | orphans [limit] | pairs [count]');
}
