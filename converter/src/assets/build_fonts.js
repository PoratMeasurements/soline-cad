'use strict';
// Build a self-contained @font-face CSS (base64 woff2) for Heebo + Poppins so the
// Soline report renders identically in HTML and headless-print PDF with no network.
const https = require('https');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { get(r.headers.location).then(res, rej); return; }
      const chunks = []; r.on('data', (c) => chunks.push(c)); r.on('end', () => res(Buffer.concat(chunks)));
    }).on('error', rej);
  });
}

const SPECS = [
  { fam: 'Heebo', url: 'https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&display=swap' },
  { fam: 'Poppins', url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@500;600&display=swap' },
];
// keep only the subsets a Hebrew carpentry report needs (drops cyrillic/greek/vietnamese to save weight)
const KEEP = ['hebrew', 'latin', 'latin-ext'];

(async () => {
  const out = [];
  let total = 0;
  for (const s of SPECS) {
    const css = (await get(s.url)).toString('utf8');
    // each @font-face has a leading "/* subset */" comment
    const blocks = css.split(/\/\*\s*/).slice(1); // ["hebrew */ @font-face{...", ...]
    for (const b of blocks) {
      const subset = (b.match(/^([a-z0-9-]+)\s*\*\//) || [])[1] || '';
      if (!KEEP.includes(subset)) continue;
      const weight = (b.match(/font-weight:\s*(\d+)/) || [])[1] || '400';
      const style = (b.match(/font-style:\s*(\w+)/) || [])[1] || 'normal';
      const ur = (b.match(/unicode-range:\s*([^;]+);/) || [])[1] || '';
      const woff2 = (b.match(/src:\s*url\(([^)]+\.woff2)\)/) || [])[1];
      if (!woff2) continue;
      const buf = await get(woff2);
      total += buf.length;
      const b64 = buf.toString('base64');
      out.push(`@font-face{font-family:'${s.fam}';font-style:${style};font-weight:${weight};font-display:swap;`
        + `src:url(data:font/woff2;base64,${b64}) format('woff2');`
        + (ur ? `unicode-range:${ur};` : '') + `}`);
      console.error('  +', s.fam, weight, subset, (buf.length / 1024).toFixed(1) + 'KB');
    }
  }
  const dest = process.argv[2] || path.join(__dirname, 'fonts_embedded.css');
  fs.writeFileSync(dest, out.join('\n'), 'utf8');
  console.error('WROTE', dest, (fs.statSync(dest).size / 1024).toFixed(0) + 'KB css,', 'raw woff2', (total / 1024).toFixed(0) + 'KB', out.length, 'faces');
})().catch((e) => { console.error('FONT BUILD FAILED:', e.message); process.exit(1); });
