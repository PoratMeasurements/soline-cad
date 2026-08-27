'use strict';
/*
 * build_symbols_preview.js — מחולל גלריית-הסמלים (symbols_preview.html) של Soline.
 * =============================================================================
 * מרנדר כל 189+ סמלים ישירות מהפרימיטיבים של element_symbols_soline.js ל-SVG inline,
 * מקובצים לפי דיסציפלינה (category), בגודל קריא ועם השם-העברי. זהו "מקור-האמת החזותי"
 * שהבעלים רואה בו את איכות-הגליפים המשודרגת.
 *
 * שפת-הרינדור זהה למוסכמת-הסמל: תיבת-יחידה [0..1], y כלפי-מטה, קיר על הקצה-התחתון (y=1).
 * X=u*100, Y=v*100 (ללא היפוך). קשתות/אליפסות מדוגמות ל-polyline; מילוי→class="fil";
 * עובי-קו = wt*1.7 (בסיס-CSS); dash→stroke-dasharray. תוויות → <text>.
 *
 * השם-העברי + קישור-ה-ORDX (lnk) נקצרים מהגלריה הקיימת (harvest) כדי לשמר זהויות
 * תקינות; סמלים חדשים מקבלים שם מ-NEW_HE. הרצה: node tools/build_symbols_preview.js
 */
const fs = require('fs');
const path = require('path');
const S = require('../src/element_symbols_soline');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'symbols_preview.html');

// --- שמות-עברית לסמלים החדשים (אין להם עדיין רשומת-ORDX) --------------------
const NEW_HE = {
  socket_usb_combo: 'שקע כפול + USB',
  socket_switched: 'שקע ממותג',
  water_mixer: 'מערבל (חם+קר)',
  water_shutoff: 'ברז-ניתוק מים',
};

// --- קציר he/lnk מהגלריה הקיימת (אם קיימת) ----------------------------------
function harvest() {
  const map = {};
  let html = '';
  try { html = fs.readFileSync(OUT, 'utf8'); } catch (e) { return map; }
  for (const f of html.split('<figure')) {
    const km = f.match(/class="key">([a-z0-9_]+)</);
    if (!km) continue;
    const he = (f.match(/class="he">([^<]*)</) || [])[1] || '';
    const lnk = (f.match(/<span class="lnk">([\s\S]*?)<\/span>/) || [])[1] || '';
    map[km[1]] = { he, lnk };
  }
  return map;
}

// --- רינדור פרימיטיב יחיד ל-SVG ----------------------------------------------
function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }
function n2(v) { return +Number(v).toFixed(2); }
function X(u) { return n2(u * 100); }
function Y(v) { return n2(v * 100); }
function swAttr(p) { return p.wt != null ? ` stroke-width="${n2(p.wt * 1.7)}"` : ''; }
function dashAttr(p) { return p.dash ? ' stroke-dasharray="3.2 2.4"' : ''; }

function prim2svg(p) {
  const sw = swAttr(p), dash = dashAttr(p);
  if (p.t === 'line') return `<line x1="${X(p.x1)}" y1="${Y(p.y1)}" x2="${X(p.x2)}" y2="${Y(p.y2)}"${sw}${dash}/>`;
  if (p.t === 'rect') {
    const x = X(p.x0), y = Y(p.y0), w = n2((p.x1 - p.x0) * 100), h = n2((p.y1 - p.y0) * 100);
    const r = p.rad ? ` rx="${n2(p.rad * 100)}" ry="${n2(p.rad * 100)}"` : '';
    const fil = p.fill ? ' class="fil"' : '';
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${r}${sw}${dash}${fil}/>`;
  }
  if (p.t === 'ellipse') {
    const fil = p.fill ? ' class="fil"' : '';
    return `<ellipse cx="${X(p.cx)}" cy="${Y(p.cy)}" rx="${n2(p.r * 100)}" ry="${n2(p.r * 100)}"${sw}${dash}${fil}/>`;
  }
  if (p.t === 'poly') {
    const pts = [];
    for (let i = 0; i + 1 < p.pts.length; i += 2) pts.push(X(p.pts[i]) + ',' + Y(p.pts[i + 1]));
    const tag = (p.closed || p.fill) ? 'polygon' : 'polyline';
    const fil = p.fill ? ' class="fil"' : '';
    return `<${tag} points="${pts.join(' ')}"${sw}${dash}${fil}/>`;
  }
  if (p.t === 'arc') {
    const cx = (p.x0 + p.x1) / 2, cy = (p.y0 + p.y1) / 2, rx = (p.x1 - p.x0) / 2, ry = (p.y1 - p.y0) / 2;
    const steps = Math.max(10, Math.round(Math.abs(p.sweep) / 6)), pts = [];
    for (let i = 0; i <= steps; i++) { const a = (p.a0 + p.sweep * i / steps) * Math.PI / 180; pts.push(X(cx + rx * Math.cos(a)) + ',' + Y(cy + ry * Math.sin(a))); }
    return `<polyline points="${pts.join(' ')}"${sw}${dash}/>`;
  }
  if (p.t === 'label') {
    const fs2 = n2((p.hf || 0.34) * 100), y = n2(p.cy * 100 + fs2 * 0.34);
    const b = p.bold ? ' font-weight="700"' : '';
    return `<text x="${X(p.cx)}" y="${y}" font-size="${fs2}" text-anchor="middle"${b}>${esc(p.text)}</text>`;
  }
  return '';
}

function svgFor(sym) {
  const body = (sym.plan || []).map(prim2svg).join('');
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"><line class="wall" x1="0" y1="100" x2="100" y2="100"/>${body}</svg>`;
}

// --- בניית התאים והמקטעים ----------------------------------------------------
const MAP = harvest();
const keys = S.listSymbols();
const order = [], byCat = new Map();
for (const k of keys) {
  const cat = S.SYMBOLS[k].category;
  if (!byCat.has(cat)) { byCat.set(cat, []); order.push(cat); }
  byCat.get(cat).push(k);
}

let linked = 0;
function cell(k) {
  const sym = S.SYMBOLS[k], m = MAP[k] || {};
  const he = m.he || NEW_HE[k] || k;
  const lnk = m.lnk || '';
  if (lnk) linked++;
  const meta = `${sym.mount} · ${Math.round(sym.dims.w)}×${Math.round(sym.dims.h)} מ״מ`;
  const lnkHtml = lnk ? `\n        <span class="lnk">${lnk}</span>` : '';
  return `<figure class="cell${lnk ? '' : ' isnew'}">
      ${svgFor(sym)}
      <figcaption>
        <span class="he">${esc(he)}</span>
        <span class="key">${k}</span>
        <span class="meta">${esc(meta)}</span>${lnkHtml}
      </figcaption>
    </figure>`;
}

const sections = order.map((cat) => {
  const items = byCat.get(cat);
  return `<section><h2>${esc(cat)}<span class="cnt">${items.length}</span></h2><div class="grid">${items.map(cell).join('\n')}</div></section>`;
}).join('\n');

const total = keys.length;
const newCount = total - linked;

const STYLE = `<style>
  :root{--cream:#f7f2e4;--ink:#1a1712;--line:#141210;--muted:#8a7f6a;--card:#fffef9;--border:#e4dac2;--accent:#7a5c2e;--new:#8a6d33}
  *{box-sizing:border-box}
  body{font-family:"Segoe UI","Assistant",Arial,sans-serif;background:var(--cream);color:var(--ink);margin:0;padding:34px 40px}
  header,main{max-width:1480px;margin:0 auto}
  h1{font-size:27px;margin:0 0 4px;letter-spacing:.2px}
  .sub{color:#5c5443;font-size:13.5px;margin:0 0 4px;line-height:1.55;max-width:1040px}
  .legend{font-size:12px;color:var(--muted);margin-top:6px;border-top:1px dashed var(--border);padding-top:8px}
  .legend b{color:var(--accent)}
  .pill{display:inline-block;background:#ece3cd;border-radius:20px;padding:2px 10px;margin:2px 4px 0 0;font-size:11.5px;color:#5c5443}
  .pill.n{background:#efe6cf;color:var(--new)}
  section{margin:26px 0}
  h2{font-size:16px;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid var(--border);color:var(--accent);
     display:flex;align-items:center;gap:10px;font-weight:700}
  .cnt{font-size:11px;font-weight:700;color:var(--muted);background:#ece3cd;border-radius:20px;padding:2px 9px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:15px}
  .cell{margin:0;border:1px solid var(--border);border-radius:11px;padding:12px 11px 11px;text-align:center;
        background:var(--card);box-shadow:0 1px 3px rgba(120,100,60,.06);display:flex;flex-direction:column;gap:2px}
  .cell.isnew{border-style:dashed;border-color:#d8c7a0;background:#fffdf4}
  svg{width:100%;height:118px;display:block;background:
      linear-gradient(0deg,transparent 96%,#efe7d3 96%) ,linear-gradient(90deg,transparent 96%,#efe7d3 96%);
      background-size:14px 14px;border-radius:7px}
  .wall{stroke:#c2b491;stroke-width:5;stroke-linecap:round}
  svg line,svg polyline,svg polygon,svg ellipse,svg rect{fill:none;stroke:var(--line);stroke-width:1.7;
      stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
  svg .fil{fill:var(--line)}
  svg text{fill:var(--line);stroke:none;font-family:"Segoe UI",Arial,sans-serif}
  figcaption{margin-top:8px;display:flex;flex-direction:column;gap:2px}
  .he{font-size:13px;font-weight:650;line-height:1.25}
  .key{font-size:10.5px;color:var(--accent);direction:ltr;font-family:"Consolas",monospace;opacity:.9}
  .meta{font-size:10px;color:var(--muted);direction:ltr}
  .lnk{font-size:10.5px;color:#4a6b3a;line-height:1.35;margin-top:2px}
  .lnk.new{color:#6b5330}
  .lnk code{background:#eef2e6;border-radius:4px;padding:0 3px;font-size:9.5px;color:#3a5230}
  .lnk.new code{background:#f0e7d2;color:#6b5330}
  .fwd{font-size:9.5px;color:var(--new);font-style:italic;margin-top:1px}
</style>`;

const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Soline — ספריית סמלי-אלמנטים (בלוקים רב-פורמטיים)</title>
${STYLE}</head><body>
<header>
  <h1>ספריית סמלי-אלמנטים — Soline</h1>
  <p class="sub">כל סמל הוא <b>בלוק רב-פורמטי</b>: סמל-DXF-2D + גוף-DXF-3D + זהות-ORDX + מיפוי-PDP + שדות-מודד-לעריכה.
  שפת-סמל מנורמלת [0..1], y כלפי-מטה, קיר על הקצה-התחתון. גאומטריה <b>מקורית ל-Soline</b>, מעוגנת בקונבנציות-תכנית
  ישראליות (IEC 60617 · פנדור/רב-בריח · קליל · תדיראן/אלקטרה · פיקוד-העורף ת״י 4910). לימוד-שיטה בלבד מטמפלייט סיוון — ללא העתקת גאומטריה/בלוק.</p>
  <p class="legend">כל תא: <b>שם עברי</b> · <b>symbol key</b> · תלייה+מידות ·
  <span style="color:#4a6b3a">↔ טיפוס-אלמנט מקושר</span> או <span style="color:var(--new)">↔ אלמנט חדש בתור-app</span>.
  <br><span class="pill">סה״כ סמלים: ${total}</span>
  <span class="pill">מקושר לטיפוס קיים: ${linked}</span>
  <span class="pill n">אלמנט חדש — בתור app: ${newCount}</span></p>
</header>
<main>
${sections}
</main>
</body></html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('wrote', path.relative(ROOT, OUT), '·', (html.length / 1024).toFixed(0) + 'KB ·', total, 'symbols ·', linked, 'linked /', newCount, 'new');
