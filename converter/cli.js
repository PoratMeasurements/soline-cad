'use strict';
// CLI: parse an ORDX file, print a human-readable summary, optionally write JSON.
//
//   node cli.js <file.ordx> [--json [out.json]] [--quiet]
//
// Examples:
//   node cli.js "מטבח קיים.ordx"
//   node cli.js "מטבח קיים.ordx" --json          -> writes <same name>.json
//   node cli.js "מטבח קיים.ordx" --json model.json

const fs = require('fs');
const path = require('path');
const { parseOrdxFile } = require('./src/parseOrdx');

function fmt(n) {
  return n == null ? '—' : (Math.round(n * 1000) / 1000).toString();
}

function printSummary(model) {
  const s = model.summary;
  console.log('════════════════════════════════════════════');
  console.log(` ORDX  ·  ProductVersion ${model.productVersion || '?'}  ·  unit ${model.unit || '?'}`);
  console.log(` Created: ${model.created || '—'}`);
  console.log(` Job:     ${model.job.name || '(ללא שם)'}`);
  if (model.customer && model.customer.name) console.log(` Customer:${model.customer.name}`);
  console.log('────────────────────────────────────────────');
  console.log(` חדרים: ${s.rooms}   קירות: ${s.walls}   אביזרים: ${s.fixtures}   ריהוט/פתחים: ${s.furnishings}`);
  console.log('────────────────────────────────────────────');

  model.rooms.forEach((r, ri) => {
    console.log(`\n▦ חדר ${ri + 1}: "${r.name || '(ללא שם)'}"  (${r.walls.length} קירות)`);
    r.walls.forEach((w) => {
      const p = w.position || {};
      const d = w.dimensions || {};
      const items = [...w.fixtures, ...w.furnishings];
      console.log(
        `   קיר ${String(w.number).padStart(2)} │ ` +
        `(${fmt(p.startX)}, ${fmt(p.startY)}) → (${fmt(p.endX)}, ${fmt(p.endY)})  ` +
        `L=${fmt(d.length)} H=${fmt(d.height)} t=${fmt(d.thick)}` +
        (items.length ? `  ·  ${items.length} פריטים` : '')
      );
      items.forEach((it) => {
        const sz = it.size ? `${fmt(it.size.width)}×${fmt(it.size.height)}${it.size.depth != null ? '×' + fmt(it.size.depth) : ''}` : '—';
        const pos = it.position ? `@(${fmt(it.position.x)}, ${fmt(it.position.y)})` : '';
        console.log(`        · [${it.kind === 'fixture' ? 'אביזר ' : 'ריהוט '}] ${it.name || it.description}  ${sz}  ${pos}  <${it.type || ''}>`);
      });
    });
  });

  console.log('\n──── ספירת פריטים לפי סוג ────');
  for (const [k, v] of Object.entries(s.itemCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(v).padStart(3)} × ${k}`);
  }
  console.log('════════════════════════════════════════════');
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('usage: node cli.js <file.ordx> [--json [out.json]] [--quiet]');
    process.exit(1);
  }
  const file = args[0];
  const wantJson = args.includes('--json');
  const quiet = args.includes('--quiet');

  let jsonOut = null;
  if (wantJson) {
    const idx = args.indexOf('--json');
    const next = args[idx + 1];
    jsonOut = next && !next.startsWith('--')
      ? next
      : file.replace(/\.ordx$/i, '') + '.json';
  }

  const model = parseOrdxFile(file);
  if (!quiet) printSummary(model);

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(model, null, 2), 'utf8');
    console.log(`\n✓ JSON נכתב אל: ${path.resolve(jsonOut)}`);
  }
}

main();
