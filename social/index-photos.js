'use strict';
// Walks the configured roots, pulls EXIF, and writes data/catalog.json.
//
// Google Drive's virtual filesystem charges a network round trip per file read,
// so this is network-bound rather than CPU-bound: we read one 192KB head per
// file and run many reads concurrently. An existing catalog is reused for files
// whose size+mtime are unchanged, so re-running after a new shoot is cheap.
// Checkpoints every 2000 files, so an interrupted run resumes almost for free.

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { readExifBuffer } = require('./lib/exif');

const ROOT = __dirname;
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const DATA = path.join(ROOT, 'data');
fs.mkdirSync(DATA, { recursive: true });
const OUT = path.join(DATA, 'catalog.json');

const IMG = new Set(cfg.imageExt);
const VID = new Set(cfg.videoExt);
const SKIP = new Set(cfg.skipDirNames);

const HEAD = 192 * 1024;          // enough for EXIF APP1 on iPhone JPEGs
const CONCURRENCY = Number(process.env.CONCURRENCY || 64);

function walk(root) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP.has(e.name)) continue;
        stack.push(p);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (IMG.has(ext) || VID.has(ext)) files.push(p);
      }
    }
  }
  return files;
}

const prev = new Map();
if (fs.existsSync(OUT)) {
  try {
    for (const r of JSON.parse(fs.readFileSync(OUT, 'utf8')).items) prev.set(r.path, r);
  } catch {}
}

async function describe(file, root) {
  let st;
  try { st = await fsp.stat(file); } catch { return null; }

  const cached = prev.get(file);
  if (cached && cached.size === st.size && cached.mtime === st.mtimeMs) return cached;

  const ext = path.extname(file).toLowerCase();
  const isVid = VID.has(ext);
  const rel = path.relative(root.path, file);
  const parts = rel.split(path.sep);

  const rec = {
    path: file,
    side: root.label,
    root: root.path,
    rel,
    name: path.basename(file),
    dir: path.dirname(rel),
    seg: parts.slice(0, -1),   // folder hierarchy — carries client / carpentry-shop names
    kind: isVid ? 'video' : 'image',
    ext,
    size: st.size,
    mtime: st.mtimeMs,
    fileTime: new Date(st.mtimeMs).toISOString().slice(0, 19),
    taken: null,
    exif: false,
    fp: null,
  };

  // One read serves both EXIF parsing and the dedup fingerprint.
  let fh;
  try {
    fh = await fsp.open(file, 'r');
    const len = Math.min(HEAD, st.size);
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, 0);
    rec.fp = st.size + ':' + crypto.createHash('sha1').update(buf.subarray(0, Math.min(65536, len))).digest('hex').slice(0, 16);

    if (!isVid) {
      const x = readExifBuffer(buf);
      if (x.ok) {
        rec.exif = true;
        rec.taken = x.taken;
        rec.lat = x.lat;
        rec.lon = x.lon;
        rec.cam = x.model ? ((x.make || '') + ' ' + x.model).trim() : null;
        rec.w = x.width;
        rec.h = x.height;
      }
    }
  } catch (e) {
    rec.error = e.code || String(e.message || e);
  } finally {
    if (fh) try { await fh.close(); } catch {}
  }
  return rec;
}

function finalize(items) {
  // Mark exact duplicates: first occurrence wins, the rest point at it.
  const byFp = new Map();
  let dups = 0;
  for (const r of items) {
    if (!r.fp) continue;
    const first = byFp.get(r.fp);
    if (first && first !== r.path) { r.dupOf = first; dups++; }
    else { byFp.set(r.fp, r.path); delete r.dupOf; }
  }

  const stats = { generated: new Date().toISOString(), total: items.length, duplicates: dups, unique: items.length - dups, bySide: {} };
  for (const r of items) {
    const s = (stats.bySide[r.side] ||= { total: 0, images: 0, videos: 0, withGps: 0, withDate: 0, dup: 0, noExif: 0 });
    s.total++;
    if (r.kind === 'video') s.videos++; else s.images++;
    if (r.lat != null) s.withGps++;
    if (r.taken) s.withDate++;
    if (r.dupOf) s.dup++;
    if (r.kind === 'image' && !r.exif) s.noExif++;
  }
  return stats;
}

(async () => {
  const t0 = Date.now();
  const jobs = [];
  for (const root of cfg.roots) {
    if (!fs.existsSync(root.path)) { console.error('!! missing root: ' + root.path); continue; }
    process.stdout.write('listing ' + root.path + ' ... ');
    const files = walk(root.path);
    console.log(files.length + ' media files');
    for (const f of files) jobs.push({ file: f, root });
  }

  const items = new Array(jobs.length);
  let done = 0, next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= jobs.length) return;
      items[i] = await describe(jobs[i].file, jobs[i].root);
      done++;
      if (done % 250 === 0) {
        const el = (Date.now() - t0) / 1000;
        const rate = done / el;
        const eta = Math.round((jobs.length - done) / rate);
        process.stdout.write(`\r  ${done}/${jobs.length}  ${rate.toFixed(1)}/s  ETA ${Math.floor(eta / 60)}m${String(eta % 60).padStart(2, '0')}s   `);
      }
      if (done % 2000 === 0) {
        const partial = items.filter(Boolean);
        fs.writeFileSync(OUT, JSON.stringify({ stats: finalize(partial), items: partial }, null, 0));
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write('\r' + ' '.repeat(70) + '\r');

  const clean = items.filter(Boolean);
  const stats = finalize(clean);
  fs.writeFileSync(OUT, JSON.stringify({ stats, items: clean }, null, 0));
  console.log(JSON.stringify(stats, null, 2));
  console.log('\n→ ' + OUT + '   (' + Math.round((Date.now() - t0) / 1000) + 's)');
})();
