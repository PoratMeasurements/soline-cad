'use strict';
// Builds a contact sheet of candidate pairs and serves it, so a whole batch can
// be judged in one look instead of opening 600 files one by one. Uses the EXIF
// thumbnails already embedded in each JPEG — a few KB each, no decoding needed.
//
//   node contact.js [from] [count]     # default 0 24, serves on :8787

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const http = require('http');
const { readExifBuffer } = require('./lib/exif');

const DATA = path.join(__dirname, 'data');
const { stories } = JSON.parse(fs.readFileSync(path.join(DATA, 'stories.json'), 'utf8'));

const FROM = Number(process.argv[2] || 0);
const COUNT = Number(process.argv[3] || 24);
const PER_SIDE = 4;
const VIDEO = /\.(mp4|mov|m4v|avi)$/i;

async function thumb(file) {
  try {
    const fh = await fsp.open(file, 'r');
    const st = await fh.stat();
    const len = Math.min(192 * 1024, st.size);
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, 0);
    await fh.close();
    const x = readExifBuffer(buf, { thumb: true });
    if (x.ok && x.thumb && x.thumb.length > 800) {
      return { data: 'data:image/jpeg;base64,' + x.thumb.toString('base64'), rot: x.orientation || 1 };
    }
  } catch {}
  return null;
}

async function pool(tasks, n) {
  const out = new Array(tasks.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (true) {
      const k = i++;
      if (k >= tasks.length) return;
      out[k] = await tasks[k]();
    }
  }));
  return out;
}

(async () => {
  const batch = stories.slice(FROM, FROM + COUNT);
  const jobs = [];
  const index = [];
  batch.forEach((s, si) => {
    const b = s.before.filter((f) => !VIDEO.test(f)).slice(0, PER_SIDE);
    const a = s.after.filter((f) => !VIDEO.test(f)).slice(0, PER_SIDE);
    b.forEach((f) => { index.push({ si, side: 'b' }); jobs.push(() => thumb(f)); });
    a.forEach((f) => { index.push({ si, side: 'a' }); jobs.push(() => thumb(f)); });
  });

  process.stdout.write(`מחלץ ${jobs.length} תמונות ממוזערות...`);
  const thumbs = await pool(jobs, 32);
  console.log(' בוצע');

  const rows = batch.map(() => ({ b: [], a: [] }));
  index.forEach((ix, k) => { if (thumbs[k]) rows[ix.si][ix.side].push(thumbs[k]); });

  const ROT = { 1: '', 3: 'rotate(180deg)', 6: 'rotate(90deg)', 8: 'rotate(-90deg)' };
  const cell = (t) => t
    ? `<img src="${t.data}" style="transform:${ROT[t.rot] || ''}">`
    : '<div class="x">—</div>';

  // Paginated: a whole batch on one screen is unreadable once it is scaled down,
  // so the reviewer walks it a few pairs at a time via ?p=N.
  const PAGE = 3;
  const page = (p) => {
    const slice = batch.slice(p * PAGE, p * PAGE + PAGE);
    return `<!doctype html><meta charset="utf-8"><title>גיליון מגע ${p}</title>
<style>
 body{background:#111;color:#eee;font:15px system-ui;margin:0;padding:10px;direction:rtl}
 .row{border:1px solid #333;margin-bottom:8px;padding:8px;border-radius:6px}
 h3{margin:0 0 6px;font-size:16px}
 .meta{color:#8a8a8a;font-size:13px;font-weight:400;margin-right:8px}
 .lbl{font-size:13px;color:#bbb;margin:4px 0 2px}
 .strip{display:flex;gap:6px}
 img{width:230px;height:172px;object-fit:cover;background:#000;border-radius:4px}
 .x{width:230px;height:172px;background:#222}
 .b{border-right:4px solid #a05a4a;padding-right:8px}
 .a{border-right:4px solid #4aa070;padding-right:8px;margin-top:6px}
 .pg{color:#666;font-size:13px;margin-bottom:8px}
</style>
<div class="pg">עמוד ${p + 1} מתוך ${Math.ceil(batch.length / PAGE)} — מועמדים ${FROM + p * PAGE + 1}–${FROM + p * PAGE + slice.length}</div>
${slice.map((s, i) => {
  const gi = p * PAGE + i;
  return `<div class="row">
 <h3>${s.siteId}<span class="meta">${s.type === 'cross' ? 'חוצה תיקיות' : 'ביקור חוזר'} · ציון ${s.score} · ${s.beforeDate} ← ${s.gapDays} ימים → ${s.afterDate}</span></h3>
 <div class="b"><div class="lbl">לפני</div><div class="strip">${rows[gi].b.map(cell).join('')}</div></div>
 <div class="a"><div class="lbl">אחרי</div><div class="strip">${rows[gi].a.map(cell).join('')}</div></div>
</div>`;
}).join('\n')}`;
  };

  http.createServer((req, res) => {
    const p = Number(new URL(req.url, 'http://x').searchParams.get('p') || 0);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(p));
  }).listen(8787, () => console.log(`מוגש ב- http://localhost:8787/?p=0   (${Math.ceil(batch.length / PAGE)} עמודים)`));
})();
