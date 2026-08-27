'use strict';
/*
 * build_preview.js — בונה גלריית-אישור (openings_preview.html) ממודול-הפתחים.
 * מרנדר לכל טיפוס: תוכנית (plan) + חזית (elevation) כ-SVG inline, שם עברי/אנגלי,
 * מידות-אמת, פרמטרים, והפניית-קליל/תקן. סגנון Soline cream, RTL. עצמאי לחלוטין.
 */
const fs = require('fs');
const path = require('path');
const M = require('./openings_module');

const GROUPS = [
  { id: 'door', he: 'דלתות', en: 'Doors', note: 'חזית: מסגרת · כנף · חציץ · זיגוג · ידית · סמל-כיוון-פתיחה. תוכנית: משקוף · כנף · קשת-רבע (ISO-128). גיאומטריה ושמות מקוריים ל-Soline; מידות תואמות תקני-שוק (פנדור / רב-בריח / פיקוד-העורף — כעובדה).' },
  { id: 'window', he: 'חלונות', en: 'Windows', note: 'חזית: מסגרת · חציץ · זיגוג · סמל-כיוון-פתיחה · ארגז-תריס. תוכנית: סמל 4-קווי. גיאומטריה ושמות מקוריים ל-Soline; מידות תואמות תקני-שוק ותקן קליל (כעובדה, ללא העתקת בלוק/שם).' },
  { id: 'vent', he: 'מיזוג · איוורור', en: 'Ventilation openings', note: 'סמלי-Soline מקוריים לחלוטין (ללא מקור-יצרן). פתחי-קיר/תקרה תקניים — כולל פתח-אוויר ממ״ד (ת״י 4910, חובה).' },
];

function dimLine(kind, dm) {
  if (kind === 'vent') return `Ø/□ ${Math.round(dm.w)}×${Math.round(dm.h)} · קיר ${Math.round(dm.wallThk)}`;
  const sill = kind === 'window' && dm.sill ? ` · סף ${Math.round(dm.sill)}` : '';
  return `${Math.round(dm.w)}×${Math.round(dm.h)} מ״מ · משקוף ${Math.round(dm.frameThk)} · קיר ${Math.round(dm.wallThk)}${sill}`;
}
function cfgLine(def, cfg) {
  const bits = [];
  if (cfg.openMode) bits.push({ hinged: 'ציר', sliding: 'הזזה', folding: 'מתקפלת', pocket: 'כיס', double: 'דו-כנפית', fixed: 'קבוע', casement: 'ציר', kip: 'קיפ', awning: 'מדף', hopper: 'תחתון', hung: 'גיליון' }[cfg.openMode] || cfg.openMode);
  if (cfg.hingeSide) bits.push(cfg.hingeSide === 'L' ? 'ציר-שמאל' : 'ציר-ימין');
  if (cfg.swing) bits.push(cfg.swing === 'in' ? 'פנימה' : 'החוצה');
  if (cfg.leafCount > 1) bits.push(cfg.leafCount + ' כנפיים');
  if (cfg.glazing && cfg.glazing !== 'none' && def.kind === 'door') bits.push('מזוגגת');
  if (cfg.shutterBox) bits.push('ארגז-תריס');
  return bits.join(' · ');
}

function card(def) {
  const dm = M.resolveDims(def), cfg = M.cfgFor(def);
  const plan = M.svgFor(M.planPrimitives(def, dm, cfg), { pad: 110 });
  const elev = M.svgFor(M.elevPrimitives(def, dm, cfg), { pad: 110 });
  const mamad = def.mamad ? '<span class="pill n">חובה</span>' : '';
  const src = def.provenance ? `<div class="lnk">פרובננס (עובדה): ${esc(def.provenance)}</div>` : '';
  const params = (def.params ? Object.keys(def.params) : []).map((p) => `<span class="pp">${esc(p)}</span>`).join('');
  return `<figure class="cell${def.mamad ? ' isnew' : ''}">
    <div class="hd"><b>${esc(def.hebrewName)}</b>${mamad}</div>
    <div class="views">
      <div class="v"><div class="vt">תוכנית</div>${plan}</div>
      <div class="v"><div class="vt">חזית</div>${elev}</div>
    </div>
    <div class="en">${esc(def.englishName)}</div>
    <div class="key">${esc(def.blockName)}</div>
    <div class="dim">${esc(dimLine(def.kind, dm))}</div>
    <div class="cfg">${esc(cfgLine(def, cfg))}</div>
    ${src}
    <div class="params">${params}</div>
  </figure>`;
}

function section(g) {
  const items = M.CATALOG.filter((d) => d.family === g.id);
  return `<section>
    <h2>${g.he} <span class="cnt">${items.length}</span> <span class="h2en">${g.en}</span></h2>
    <p class="secnote">${esc(g.note)}</p>
    <div class="grid">${items.map(card).join('\n')}</div>
  </section>`;
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }

const mf = M.manifest();
const legend = Object.entries(M.LAYERS).map(([k, v]) =>
  `<span class="pill"><span class="sw" style="background:${v.hex}"></span>${esc(k)} <span class="lw">${v.wt}mm</span></span>`).join(' ');

const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>מודול-פתחים · Soline — לאישור הבעלים</title>
<style>
  :root{--cream:#f7f2e4;--ink:#1a1712;--line:#141210;--muted:#8a7f6a;--card:#fffef9;--border:#e4dac2;--accent:#7a5c2e;--new:#8a6d33}
  *{box-sizing:border-box}
  body{font-family:"Segoe UI","Assistant",Arial,sans-serif;background:var(--cream);color:var(--ink);margin:0;padding:30px 38px 60px}
  h1{font-size:24px;margin:0 0 6px;color:#2a2114}
  .sub{color:#5c5443;font-size:13.5px;margin:0 0 4px;line-height:1.6;max-width:1080px}
  .status{display:inline-block;background:#f5e6c8;border:1px solid #d8c088;color:#7a5c2e;border-radius:20px;padding:4px 14px;font-size:12.5px;font-weight:700;margin:10px 0 4px}
  .legend{font-size:12px;color:var(--muted);margin:12px 0 8px;border-top:1px dashed var(--border);border-bottom:1px dashed var(--border);padding:10px 0;line-height:2}
  .pill{display:inline-block;background:#ece3cd;border-radius:20px;padding:3px 11px;margin:2px 3px;font-size:11.5px;color:#5c5443}
  .pill.n{background:#f2dfb6;color:#8a5a1a;font-weight:700;padding:1px 8px;font-size:10px;margin-inline-start:6px}
  .pill .sw{display:inline-block;width:11px;height:11px;border-radius:3px;vertical-align:-1px;margin-inline-start:5px}
  .pill .lw{color:#9a8f78;font-size:10px}
  h2{font-size:17px;margin:26px 0 6px;padding-bottom:8px;border-bottom:2px solid var(--border);color:var(--accent);display:flex;align-items:center;gap:10px}
  .h2en{font-size:12px;color:var(--muted);font-weight:400;direction:ltr}
  .cnt{font-size:12px;font-weight:700;color:#fff;background:var(--accent);border-radius:20px;padding:2px 10px}
  .secnote{font-size:12.5px;color:#6a6250;margin:0 0 16px;max-width:1080px;line-height:1.6}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
  .cell{margin:0;border:1px solid var(--border);border-radius:12px;padding:13px 13px 12px;background:var(--card);
        box-shadow:0 1px 4px rgba(120,100,60,.07);display:flex;flex-direction:column;gap:3px}
  .cell.isnew{border-color:#e0c98c;background:#fffdf4}
  .hd{font-size:14.5px;color:#2a2114;display:flex;align-items:center;justify-content:space-between}
  .views{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0 4px}
  .v{background:#fbf8ee;border:1px solid #eee3c8;border-radius:8px;padding:4px}
  .vt{font-size:10px;color:var(--muted);text-align:center;margin-bottom:1px}
  svg{width:100%;height:150px;display:block;
      background:linear-gradient(0deg,transparent 96%,#f0e8d4 96%),linear-gradient(90deg,transparent 96%,#f0e8d4 96%);
      background-size:16px 16px;border-radius:6px}
  .en{font-size:11px;color:var(--muted);direction:ltr}
  .key{font-size:10.5px;color:var(--accent);direction:ltr;font-family:"Consolas",monospace;opacity:.92}
  .dim{font-size:12px;color:#3a3427;font-weight:600}
  .cfg{font-size:11.5px;color:#6a6250}
  .lnk{font-size:10.5px;color:#4a6b3a;line-height:1.4;margin-top:1px}
  .params{margin-top:4px;line-height:1.9}
  .pp{display:inline-block;background:#eef2e6;color:#3a5230;border-radius:4px;padding:0 5px;margin:1px 2px;font-size:9.5px;direction:ltr;font-family:"Consolas",monospace}
  footer{margin-top:34px;font-size:11.5px;color:var(--muted);border-top:1px dashed var(--border);padding-top:14px;line-height:1.7;max-width:1080px}
</style></head><body>
  <h1>מודול-הפתחים של Soline — גלריית-אישור</h1>
  <p class="sub">דלתות · חלונות · מיזוג/איוורור. כל טיפוס מוצג ב-<b>תוכנית</b> (מבט-על) ו-<b>חזית</b> (מבט-חזית) עם מידות-האמת, השכבות (SOL-*), והפרמטרים הניתנים-לעריכה. הגיאומטריה <b>מקורית ל-Soline</b>, בנויה לפי מוסכמת-השרטוט והמידות של טמפלייט "קליל בלגי פלוס" (רשות-שימוש מפורשת) ומסמכי-המפרט הפנימיים — <b>ללא</b> העתקת בלוקים/לינוורק/שמות/שכבות מקובץ-קליל.</p>
  <div class="status">◷ ממתין לאישור הבעלים · ${mf.types.length} טיפוסים · יחידות מ״מ</div>
  <div class="legend"><b>שכבות (SOL-*):</b> ${legend}</div>
  ${GROUPS.map(section).join('\n')}
  <footer>
    <b>שמות + קוד:</b> מקוריים בלעדית ל-Soline. אף מזהה (מפתח / שם-בלוק / פרמטר / סמל) אינו מועתק מיצרן כלשהו. שמות-יצרן מופיעים אך-ורק כהערת-פרובננס עובדתית בפרוזה.<br>
    <b>מקורות-מידה (עובדות בלבד, לא קובץ):</b> תקני-שוק לדלתות/חלונות · פיקוד-העורף + ת״י 4910 (ממ״ד) · <code>docs/DOORS_WINDOWS_SIZES.md</code> · <code>docs/OPENING_ELEMENT_SCHEMA.md</code> · <code>docs/DXF_PRO_STANDARDS.md</code>. חקר-המקור המורשה מתועד ב-<code>KLIL_OPENINGS_STUDY.md</code>.<br>
    <b>שלב הבא לאחר אישור:</b> אינטגרציה לממיר (export_dxf2d / export_dxf_pro) דרך opening_schema.js — לא בוצע (בבעלות סוכנים אחרים).
  </footer>
</body></html>`;

const out = path.join(__dirname, 'openings_preview.html');
fs.writeFileSync(out, html, 'utf8');
console.log('wrote', out, '·', (html.length / 1024).toFixed(0) + 'KB ·', mf.types.length, 'types');
