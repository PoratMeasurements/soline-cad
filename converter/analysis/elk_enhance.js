const fs = require('fs');
const items = require('../docs/elkincho_catalog.json');
for (const it of items) {
  const segs = it.code.split('\\');
  const last = segs[segs.length - 1] || '';
  const m = last.match(/^(\d+)([RL])?$/);
  if (m) { it.width_cm = parseInt(m[1], 10); it.hand = m[2] || null; }
  it.series = segs[0] || '';
}
fs.writeFileSync(__dirname + '/../docs/elkincho_catalog.json', JSON.stringify(items, null, 1));
const byCat = {};
items.forEach(i => { (byCat[i.category] = byCat[i.category] || []).push(i); });
let md = '# קטלוג Elkincho (מספריית Raumplan)\n\nחולץ מ-`C:\\Raumplan\\VER32\\KDT\\Elkincho\\*.ini` (פוענח מ-cp1255). ' + items.length + ' אלמנטים.\n\nכל אלמנט = קוד-קטלוג של Raumplan (למשל `B9D\\01\\50R`) + קטגוריה + מידה. הקוד הוא ההפניה שמוזרקת ל-PDP.\n\n';
for (const [cat, list] of Object.entries(byCat)) {
  md += '## ' + cat + ' (' + list.length + ')\n\n| קוד | תת-קטגוריה | שם | רוחב | כיוון |\n|---|---|---|---|---|\n';
  list.forEach(i => md += '| `' + i.code + '` | ' + i.sub + ' | ' + i.name + ' | ' + (i.width_cm ? i.width_cm + ' ס"מ' : '') + ' | ' + (i.hand || '') + ' |\n');
  md += '\n';
}
fs.writeFileSync(__dirname + '/../docs/elkincho_catalog.md', md);
const w = items.filter(i => i.width_cm);
console.log('enhanced: ' + w.length + '/' + items.length + ' with width. widths: ' + [...new Set(w.map(i => i.width_cm))].sort((a, b) => a - b).join(','));
console.log('series: ' + [...new Set(items.map(i => i.series))].join(' '));
console.log('wrote docs/elkincho_catalog.json + docs/elkincho_catalog.md');
