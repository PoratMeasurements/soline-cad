'use strict';
// Convert an ORDX measurement file to a Raumplan PDP using an empty-room
// template (structure-preserving wall patch).
//
//   node convert.js <in.ordx> <empty-template.pdp> [out.pdp]
//
// The template must be an EMPTY room (0 items) saved from Raumplan, with at
// least as many walls as the ORDX. Items are not yet written (see README).

const fs = require('fs');
const path = require('path');
const { parseOrdxFile } = require('./src/parseOrdx');
const { convert } = require('./src/convertGeneral');

function main() {
  const [inOrdx, template, outArg] = process.argv.slice(2);
  if (!inOrdx || !template) {
    console.error('usage: node convert.js <in.ordx> <empty-template.pdp> [out.pdp]');
    process.exit(1);
  }
  const out = outArg || inOrdx.replace(/\.ordx$/i, '') + '.pdp';

  const model = parseOrdxFile(inOrdx);
  const templateBuf = fs.readFileSync(template);
  const { buf, notes, warnings, wallsWritten } = convert(templateBuf, model);

  fs.writeFileSync(out, buf);

  const totalWalls = model.rooms.reduce((n, r) => n + r.walls.length, 0);
  console.log('ORDX     :', inOrdx);
  console.log('  job    :', model.job.name || '(none)', '| rooms', model.rooms.length, '| walls', totalWalls);
  console.log('TEMPLATE :', template, `(${templateBuf.length} bytes)`);
  console.log('OUT      :', path.resolve(out), `(${buf.length} bytes)`);
  console.log('---');
  notes.forEach((n) => console.log(' ·', n));
  if (warnings.length) {
    console.log('--- ⚠ warnings ---');
    warnings.forEach((w) => console.log(' ⚠', w));
  }
}

main();
