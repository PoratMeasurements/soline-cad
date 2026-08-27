'use strict';
/*
 * ord_selftest.js — structural self-test for the ORD-Extended v4 exporter (src/export_ord.js).
 * =============================================================================
 * Validates the exporter against docs/ORDX_SPEC_FROM_WEB.md on two inputs:
 *   1) _LATEST/allelem_showcase.sol   (the real Soline showcase — all element types)
 *   2) a synthetic 3000x3000 room     (mirrors the spec §6.1 minimal worked example)
 * Asserts: required sections present & in order; Version=4 / Unit=1; wall count matches
 * the model; wall angles computed per the §1.3 convention (end = start + L*(cos,-sin));
 * fixture/appliance enums in range; ASCII-only; empty-model still yields a valid file.
 * Also emits _LATEST/showcase/allelem_showcase.ord.
 *
 * Run:  node analysis/ord_selftest.js
 * Exit: 0 = all asserts pass, 1 = a failure (details printed).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { exportOrd, classify } = require('../src/export_ord');
const { parseOrdxFile } = require('../src/parseOrdx');
const { readSol } = require('../src/readSol');

const ROOT = path.join(__dirname, '..');
let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS  ' + msg); }
  else { console.log('  FAIL  ' + msg); failures++; }
}

// --- load the showcase model (embedded ORDX path, same as soline_convert.loadModel) ---
function loadShowcase() {
  const sol = readSol(path.join(ROOT, '_LATEST', 'allelem_showcase.sol'));
  if (sol.embeddedOrdx) {
    const tmp = path.join(os.tmpdir(), 'ord_selftest_' + Date.now() + '.ordx');
    fs.writeFileSync(tmp, sol.embeddedOrdx);
    const m = parseOrdxFile(tmp);
    try { fs.unlinkSync(tmp); } catch (_) {}
    return m;
  }
  return sol.model;
}

// --- synthetic scene: spec §6.1 shape, a closed 3000x3000 room, mm, in the MODEL frame ---
// Model plan is (X, Y_up); a wall going clockwise-on-page has each end = next start.
function syntheticModel() {
  const H = 2600, T = 100;
  const mk = (n, sx, sy, ex, ey, items) => ({
    number: n,
    position: { startX: sx, startY: sy, endX: ex, endY: ey, angle: null },
    dimensions: { length: Math.hypot(ex - sx, ey - sy), height: H, thick: T },
    fixtures: items || [], furnishings: [],
  });
  return {
    rooms: [{
      name: 'Synthetic 3x3',
      walls: [
        mk(0, 0, 0, 3000, 0, [
          { name: 'Window', class: 'Decorative', kind: 'fixture',
            size: { width: 1200, height: 1000 }, position: { x: 1500, y: 900, z: null } },
          { name: 'Single Socket', class: 'Fixture', kind: 'fixture',
            size: { width: 80, height: 80 }, position: { x: 600, y: 300, z: null } },
        ]),
        mk(1, 3000, 0, 3000, 3000, [
          { name: 'Doorway w/o Frame', class: 'Decorative', kind: 'fixture',
            size: { width: 900, height: 2050 }, position: { x: 1500, y: 0, z: null } },
        ]),
        mk(2, 3000, 3000, 0, 3000, [
          { name: 'Switch', class: 'Fixture', kind: 'fixture',
            size: { width: 80, height: 80 }, position: { x: 1000, y: 1200, z: null } },
        ]),
        mk(3, 0, 3000, 0, 0, [
          { name: 'Faucet', class: 'Fixture', kind: 'fixture',
            size: { width: 60, height: 60 }, position: { x: 1500, y: 1100, z: null } },
        ]),
      ],
    }],
  };
}

// --- shared structural assertions on an ORD string + its model ---
function assertStructure(label, ord, model) {
  console.log('\n[' + label + ']');
  const st = ord.stats || exportOrd._lastStats;

  // ASCII only
  let asciiOk = true, badAt = -1;
  for (let i = 0; i < ord.length; i++) if (ord.charCodeAt(i) > 127) { asciiOk = false; badAt = i; break; }
  ok(asciiOk, 'ASCII-only on the wire' + (asciiOk ? '' : ' (non-ASCII at ' + badAt + ')'));

  // CRLF line endings
  ok(/\r\n/.test(ord), 'CRLF line endings present');

  // Header / Version / Unit
  ok(/^\[Header\]/.test(ord), '[Header] is the first section');
  ok(/(^|\r\n)Version=4(\r\n|$)/.test(ord), 'Version=4');
  ok(/(^|\r\n)Unit=1(\r\n|$)/.test(ord), 'Unit=1 (metric mm)');

  // Section order: Header < Walls < Windows < Doors < Appliances < Fixtures < Floors
  const order = ['Header', 'Walls', 'Windows', 'Doors', 'Appliances', 'Fixtures', 'Floors'];
  const idx = order.map((s) => ord.indexOf('[' + s + ']')).filter((i) => i >= 0);
  const ascending = idx.every((v, i) => i === 0 || v > idx[i - 1]);
  ok(ascending, 'present sections appear in spec order');

  // [Walls] present before any wall-attached section
  const wIdx = ord.indexOf('[Walls]');
  for (const s of ['Windows', 'Doors', 'Appliances', 'Fixtures']) {
    const si = ord.indexOf('[' + s + ']');
    if (si >= 0) ok(wIdx >= 0 && wIdx < si, '[Walls] precedes [' + s + ']');
  }

  // Wall count matches the model
  const modelWalls = (model.rooms || []).reduce((n, r) =>
    n + (r.walls || []).filter((w) => w.position && w.position.startX != null).length, 0);
  const wallBlock = (ord.match(/\[Walls\]\r\n([\s\S]*?)(\r\n\r\n|\r\n$)/) || [, ''])[1];
  const wallLines = wallBlock.split(/\r\n/).filter((l) => l.trim().length);
  ok(wallLines.length === modelWalls, 'wall lines (' + wallLines.length + ') == model walls (' + modelWalls + ')');

  // Each wall line has >=6 numeric fields; angle reproduces the model endpoint (spec §1.3)
  let angleOk = true;
  const flatWalls = [];
  for (const r of (model.rooms || [])) for (const w of (r.walls || [])) {
    if (w.position && w.position.startX != null) flatWalls.push(w);
  }
  wallLines.forEach((line, i) => {
    const f = line.split(',').map(Number);
    if (f.length < 6) { angleOk = false; return; }
    const [X, Z, dir, len] = f;
    const th = dir * Math.PI / 180;
    const ex = X + len * Math.cos(th);
    const ez = Z - len * Math.sin(th);           // end = start + L*(cos, -sin)
    const w = flatWalls[i];
    const mex = w.position.endX, mez = w.position.endY;   // ORD Z := model Y
    if (Math.hypot(ex - mex, ez - mez) > 0.1) angleOk = false;
  });
  ok(angleOk, 'every wall angle reproduces the model endpoint via end=start+L*(cos,-sin)');

  // Enum validity
  const fxOk = Object.keys(st.fixtureTypes || {}).every((t) => +t >= 1 && +t <= 4);
  const apOk = Object.keys(st.applianceTypes || {}).every((t) => +t >= 1 && +t <= 15);
  ok(fxOk, 'all [Fixtures] enums in 1..4  (' + JSON.stringify(st.fixtureTypes) + ')');
  ok(apOk, 'all [Appliances] enums in 1..15 (' + JSON.stringify(st.applianceTypes) + ')');

  // Floors: if emitted, each line has >=3 (X,Z) pairs
  const floorBlock = (ord.match(/\[Floors\]\r\n([\s\S]*?)(\r\n\r\n|\r\n$)/) || [, ''])[1];
  const floorLines = floorBlock.split(/\r\n/).filter((l) => l.trim().length);
  if (floorLines.length) {
    const allTriPlus = floorLines.every((l) => l.split(',').length >= 6 && l.split(',').length % 2 === 0);
    ok(allTriPlus, 'each [Floors] line has >=3 (X,Z) pairs');
  }

  // No forbidden characters in quoted strings (# ? = | ; inside quotes)
  const quoted = ord.match(/"[^"]*"/g) || [];
  const cleanQuotes = quoted.every((s) => !/[#?|;]/.test(s.slice(1, -1)));
  ok(cleanQuotes, 'no forbidden chars (# ? | ;) inside quoted strings');

  console.log('  stats: ' + JSON.stringify({
    walls: st.walls, windows: st.windows, doors: st.doors,
    appliances: st.appliances, fixtures: st.fixtures, floors: st.floors,
    unmapped: st.unmapped.length,
  }));
  if (st.unmapped.length) console.log('  unmapped (no ORD analogue, reported): ' + st.unmapped.join(', '));
  return st;
}

// ================= run =================
console.log('ORD-Extended v4 exporter — self-test');

// 1) Showcase
const showcase = loadShowcase();
const ordShowcase = exportOrd(showcase, { name: 'allelem_showcase' });
assertStructure('showcase: allelem_showcase.sol', ordShowcase, showcase);

// write the deliverable
const outDir = path.join(ROOT, '_LATEST', 'showcase');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'allelem_showcase.ord');
fs.writeFileSync(outPath, ordShowcase, 'ascii');
console.log('  wrote ' + outPath + ' (' + ordShowcase.length + ' bytes)');

// 2) Synthetic scene
const synth = syntheticModel();
const ordSynth = exportOrd(synth, { name: 'Synthetic 3x3' });
const synthStats = assertStructure('synthetic 3000x3000 room', ordSynth, synth);
// synthetic must close the loop into exactly one 4-pair floor polygon
ok(synthStats.floors === 1, 'synthetic room emits one floor polygon');

// 3) Empty-model guard
console.log('\n[empty model]');
const empty = exportOrd({ rooms: [] }, {});
ok(/^\[Header\]/.test(empty) && /Version=4/.test(empty) && /Unit=1/.test(empty),
  'empty model still yields a valid minimal file (Header/Version=4/Unit=1)');
ok(!/\[Walls\]/.test(empty), 'empty model omits [Walls] (nothing to draw)');

// 4) classify() sanity — the four fixture enums + window/door routing
console.log('\n[classify() unit checks]');
ok(classify('Single Socket', 'Fixture').type === 1, 'socket -> Fixture type 1 (Outlet)');
ok(classify('Duplex Switch', 'Fixture').type === 2, 'switch -> Fixture type 2 (Switch)');
ok(classify('Phone', 'Fixture').type === 3, 'phone -> Fixture type 3 (Phone Line)');
ok(classify('Water Supply', 'Fixture').type === 4, 'water -> Fixture type 4 (Pipe Line)');
ok(classify('Window', 'Decorative').sec === 'windows', 'window -> [Windows]');
ok(classify('Doorway w/o Frame', 'Decorative').sec === 'doors', 'doorway -> [Doors]');
ok(classify('כיור', 'Fixture').type === 10, 'sink(HE) -> Appliance type 10');
ok(classify('Beam', 'Decorative').sec === null, 'beam -> unmapped (no ORD analogue)');

console.log('\n' + (failures === 0
  ? 'ALL ORD SELF-TEST ASSERTS PASSED (round-trip load still needs a CV seat)'
  : failures + ' ASSERT(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);
