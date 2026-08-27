'use strict';
// Soline — ORDX -> PDP converter (standalone; independent of ELC_SND).
// Usage:  node soline.js <in.ordx> [--base <base.pdp>] [--out <out.pdp>]
//
// Pipeline: parse ORDX -> place every supported item parametrically
// (position / orientation / mount-height / size / stretched icon) -> inject the
// item blocks -> fix load-critical counts. Output opens in Raumplan for Windows IV.
//
// NOTE (independence roadmap): today items are injected into a POPULATED base
// (a real PDP whose walls we keep) and only SOCKET-class items are generated.
// The remaining work to make this a from-scratch converter is (a) a walls-only
// base and (b) per-type block generation from the Soline element library
// (elements.json) instead of a donor — all derived from the corpus, no ELC_SND.

const fs = require('fs');
const path = require('path');
const { parseOrdxFile } = require('./src/parseOrdx');
const { assemble } = require('./src/assemble');

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function main() {
  const ordxPath = process.argv[2];
  if (!ordxPath || ordxPath.startsWith('--')) {
    console.error('usage: node soline.js <in.ordx> [--base <base.pdp>] [--donor <donor.pdp>] [--out <out.pdp>] [--offX n] [--offY n]');
    process.exit(1);
  }
  const basePath = arg('--base');
  const donorPath = arg('--donor');
  const outPath = arg('--out', ordxPath.replace(/\.ordx$/i, '') + '.soline.pdp');
  const offX = Number(arg('--offX', -22876));
  const offY = Number(arg('--offY', -9480));
  if (!basePath || !donorPath) {
    console.error('Soline (current build) needs --base <base.pdp> and --donor <donor.pdp>.');
    console.error('These supply the room shell and the item block templates until');
    console.error('from-scratch generation lands. See STATUS.md.');
    process.exit(1);
  }

  const model = parseOrdxFile(ordxPath);
  const base = fs.readFileSync(basePath);
  const donor = fs.readFileSync(donorPath);

  const { buf, placed, report } = assemble({ model, base, donor, offX, offY });
  fs.writeFileSync(outPath, buf);

  console.log(`Soline: ${path.basename(ordxPath)} -> ${path.basename(outPath)}`);
  console.log(`  walls: ${model.summary.walls}  |  items in ORDX: ${model.summary.fixtures + model.summary.furnishings}  |  placed: ${placed}`);
  report.forEach((l) => console.log('   + ' + l));
  console.log(`  wrote ${buf.length} bytes`);
}

main();
