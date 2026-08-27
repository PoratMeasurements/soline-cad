'use strict';
/*
 * tools/build_showcase.js  — DATA build only (no exporter edits).
 * ---------------------------------------------------------------------------
 * Builds _LATEST/allelem_showcase.sol : a realistic 4-wall as-built room that
 * carries EVERY representative element type the Soline pipeline supports, laid
 * out with professional spacing and PROVABLY zero footprint overlap.
 *
 * The .sol matches the app's SolWriter.kt container exactly
 *   (manifest.json + meta.json + measured/room-<id>.json + annotations.json +
 *    revisions.json), PLUS an OPTIONAL measured/source.ordx that readSol.js
 *   explicitly supports and PREFERS (the full-fidelity ORDX path). We embed it
 *   so all 6 exporters see the full element set at full fidelity — the current
 *   app's native-only .sol would otherwise be synthesized through readSol's
 *   9-type SOL_TYPE_MAP (documented limitation, reported to the owner).
 *
 * Non-overlap contract (handles the two anchor conventions the exporters use):
 *   - Fixture  : position.x = LEFT corner; footprint [x, x+W]        (DXF & PDP agree)
 *   - Decorative: DXF treats position.x as CENTRE (along=x);
 *                 PDP treats position.x as LEFT corner (along=x+W/2).
 *     We set position.x = L = cursor + W/2 and RESERVE [cursor, cursor+1.5W]:
 *       DXF centre = L            -> spans [cursor, cursor+W]
 *       PDP centre = L + W/2      -> spans [cursor+W/2, cursor+1.5W]
 *     Union [cursor, cursor+1.5W] fits the reserved slot under BOTH readers.
 *   A GAP is added after every item so neighbours (and their dim ladders) never
 *   touch.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { exportORDX } = require('../src/export_ordx');

const ROOT = path.join(__dirname, '..');
const OUT_SOL = path.join(ROOT, '_LATEST', 'allelem_showcase.sol');

// ---------------------------------------------------------------------------
// Element rows.  name = corpus/InnoDraw <Name> (what the exporters resolve on).
// cls = ORDX Class (drives anchor). W/D/H mm. y = mount height (fromBottom).
// pdp = the Hebrew PDP type this name maps to via docs/ordx_item_dictionary.json
//       ('' = DXF/3D/report only — not one of the 19 injectable PDP types).
// ---------------------------------------------------------------------------
const WALLS = [
  { name: 'חשמל ותקשורת', gap: 900, start: 600, items: [
    { name: 'Single Socket',  he: 'שקע בודד',        cls: 'Fixture',    W: 90,  D: 7,  H: 90,  y: 400,  pdp: 'שקע' },
    { name: 'Duplex Socket',  he: 'שקע כפול',         cls: 'Fixture',    W: 160, D: 8,  H: 90,  y: 400,  pdp: 'שקע' },
    { name: 'SocketEx',       he: 'שקע מוגן מים IP44', cls: 'Fixture',   W: 90,  D: 8,  H: 90,  y: 1100, pdp: 'שקע' },
    { name: 'Switch',         he: 'מתג',              cls: 'Fixture',    W: 90,  D: 7,  H: 90,  y: 1300, pdp: 'מפסק' },
    { name: 'Duplex Switch',  he: 'מתג כפול',         cls: 'Fixture',    W: 150, D: 7,  H: 90,  y: 1300, pdp: 'מפסק' },
    { name: 'Power Line',     he: 'תשתית חשמל',       cls: 'Fixture',    W: 60,  D: 50, H: 60,  y: 300,  pdp: 'צ.חשמל' },
    { name: 'Power Box',      he: 'ארון/נק. מוצר חשמל', cls: 'Decorative', W: 500, D: 220, H: 540, y: 1500, pdp: 'ק.חשמל' },
    { name: 'Junction Box',   he: 'קופסת ביקורת',     cls: 'Fixture',    W: 100, D: 10, H: 100, y: 2200, pdp: 'ק.בקורת' },
    { name: 'Phone',          he: 'נק. טלפון',         cls: 'Fixture',    W: 60,  D: 10, H: 80,  y: 400,  pdp: '' },
    { name: 'TV',             he: 'נק. טלוויזיה',      cls: 'Fixture',    W: 60,  D: 10, H: 80,  y: 400,  pdp: '' },
    { name: 'Can Light',      he: 'מנורת תקרה',        cls: 'Decorative', W: 150, D: 0,  H: 150, y: 2600, pdp: 'תאורה' },
  ]},
  { name: 'אינסטלציה גז וביוב', gap: 950, start: 600, items: [
    { name: 'Water Supply',   he: 'נק. מים',          cls: 'Fixture',  W: 60,  D: 30,  H: 60,  y: 300,  pdp: 'צ.מים' },
    { name: 'Faucet',         he: 'ברז',              cls: 'Fixture',  W: 70,  D: 10,  H: 70,  y: 1000, pdp: 'ברז' },
    { name: 'כיור',           he: 'כיור (מים משולב)',  cls: 'Fixture',  W: 500, D: 500, H: 200, y: 850,  pdp: 'מים משולב' },
    { name: 'Sewer drainage', he: 'ניקוז רצפתי',       cls: 'Fixture',  W: 110, D: 0,   H: 110, y: 0,    pdp: 'פ.ביוב' },
    { name: 'Sewage',         he: 'ביוב קיר',          cls: 'Fixture',  W: 110, D: 50,  H: 110, y: 150,  pdp: 'ביוב קיר' },
    { name: 'Gas',            he: 'נק. גז',            cls: 'Fixture',  W: 60,  D: 30,  H: 60,  y: 700,  pdp: 'גז' },
    { name: 'אסלה',           he: 'אסלה',             cls: 'Fixture',  W: 360, D: 650, H: 400, y: 0,    pdp: 'אסלה' },
  ]},
  { name: 'פתחים דלתות וחלונות', gap: 600, start: 700, items: [
    { name: 'Doorway w/o Frame', he: 'מפתח ללא משקוף', cls: 'Decorative', W: 900,  D: 100, H: 2050, y: 0,    pdp: 'דלת',      op: 'door' },
    { name: 'Doorway with Frame',he: 'מפתח עם משקוף',  cls: 'Decorative', W: 900,  D: 100, H: 2100, y: 0,    pdp: 'דלת',      op: 'door' },
    { name: 'Passage',           he: 'מעבר',           cls: 'Decorative', W: 1100, D: 100, H: 2100, y: 0,    pdp: 'דלת',      op: 'door' },
    { name: 'Hinged Right In',   he: 'דלת ציר ימין פנימה', cls: 'Decorative', W: 900, D: 100, H: 2050, y: 0, pdp: '',         op: 'door' },
    { name: 'Window',            he: 'חלון',           cls: 'Decorative', W: 1200, D: 100, H: 1200, y: 900,  pdp: 'חלון',     op: 'window', anchor: 'win' },
    { name: 'WindowSill',        he: 'אדן חלון',       cls: 'Decorative', W: 1200, D: 60,  H: 100,  y: 800,  pdp: 'אדן חלון', stackOn: 'win' },
    { name: 'ShutterBox',        he: 'ארגז תריס',      cls: 'Decorative', W: 1300, D: 200, H: 300,  y: 2250, pdp: 'ארגז תריס', stackOn: 'win' },
    { name: 'Window',            he: 'חלון גדול',      cls: 'Decorative', W: 1600, D: 100, H: 1400, y: 850,  pdp: 'חלון',     op: 'window' },
    { name: 'Safety Room Entrance', he: 'פתח ממ"ד',    cls: 'Decorative', W: 800,  D: 200, H: 2000, y: 0,    pdp: 'חור.פ.ממד', op: 'door' },
  ]},
  { name: 'מיזוג מבנה ותקרה', gap: 1150, start: 600, items: [
    { name: 'מזגן',              he: 'מזגן עילי',      cls: 'Decorative', W: 1000, D: 250, H: 300, y: 2200, pdp: 'ק.חשמל' },
    { name: 'Air Opening Ceiling', he: 'פתח איוורור תקרה', cls: 'Decorative', W: 500, D: 300, H: 500, y: 2600, pdp: '',     op: 'vent' },
    { name: 'Radiator',          he: 'רדיאטור',        cls: 'Decorative', W: 1000, D: 150, H: 880, y: 150,  pdp: '' },
    { name: 'Beam',              he: 'תעלה/קורה',      cls: 'Decorative', W: 250,  D: 300, H: 400, y: 2200, pdp: 'תעלה' },
    { name: 'עמוד',              he: 'עמוד',           cls: 'Decorative', W: 300,  D: 300, H: 2600, y: 0,   pdp: 'תעלה' },
  ]},
];

// ---------------------------------------------------------------------------
// Layout — set position.x (distance along the wall) and compute needed length.
// ---------------------------------------------------------------------------
function layoutWall(w) {
  let cursor = w.start;
  const anchors = {};
  for (const it of w.items) {
    if (it.stackOn) {                    // window-assembly part: stack at the window's x (no horizontal slot)
      it.x = anchors[it.stackOn];
      continue;
    }
    if (it.cls === 'Decorative') {
      it.x = Math.round(cursor + it.W / 2);
      if (it.anchor) anchors[it.anchor] = it.x;
      cursor = cursor + 1.5 * it.W + w.gap;
    } else {
      it.x = Math.round(cursor);
      if (it.anchor) anchors[it.anchor] = it.x;
      cursor = cursor + it.W + w.gap;
    }
  }
  w.need = Math.round(cursor + w.start); // symmetric end margin
}
WALLS.forEach(layoutWall);

// Rectangle: opposite walls share a length. wall order 0=bottom,1=right,2=top,3=left.
const round = (v, step = 100) => Math.ceil(v / step) * step;
const Lx = round(Math.max(WALLS[0].need, WALLS[2].need));
const Ly = round(Math.max(WALLS[1].need, WALLS[3].need));
const wallLen = [Lx, Ly, Lx, Ly];
const HEIGHT = 2650;

// ---------------------------------------------------------------------------
// Overlap PROOF — assert no two items' worst-case footprints intersect.
// ---------------------------------------------------------------------------
function footprint(it) {
  return it.cls === 'Decorative'
    ? [it.x - it.W / 2, it.x + it.W]        // union of DXF + PDP interpretations
    : [it.x, it.x + it.W];
}
let overlaps = 0;
WALLS.forEach((w, wi) => {
  const fp = w.items.filter((it) => !it.stackOn).map(footprint).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < fp.length; i++) if (fp[i][0] < fp[i - 1][1]) { overlaps++; console.error(`OVERLAP wall${wi}: ${fp[i-1]} vs ${fp[i]}`); }
  const last = Math.max(...w.items.filter((it) => !it.stackOn).map((it) => footprint(it)[1]));
  if (last > wallLen[wi]) { overlaps++; console.error(`OVERFLOW wall${wi}: ${last} > ${wallLen[wi]}`); }
});
if (overlaps) { console.error('FAILED non-overlap proof:', overlaps); process.exit(1); }

// ---------------------------------------------------------------------------
// ORDX model (parseOrdx-shaped) — CCW rectangle turtle.
// ---------------------------------------------------------------------------
function wallGeom() {
  // corners of CCW rectangle
  const pts = [ [0, 0], [Lx, 0], [Lx, Ly], [0, Ly], [0, 0] ];
  const angles = [0, 90, 180, 270];
  return WALLS.map((w, i) => {
    const [sx, sy] = pts[i], [ex, ey] = pts[i + 1];
    return { s: [sx, sy], e: [ex, ey], ang: angles[i] };
  });
}
const GEOM = wallGeom();

function toFixture(it) {
  return {
    kind: 'fixture', catalog: 'Soline', name: it.name, description: it.he,
    class: it.cls, // enrichItem fills Type/measure from the corpus catalog
    size: { width: it.W, height: it.H, depth: it.D || null },
    position: { x: it.x, y: it.y, z: null },
  };
}

function buildModel() {
  const rooms = [{
    id: 1, name: 'חדר תצוגה — כל האלמנטים', description: '', type: null,
    walls: WALLS.map((w, i) => ({
      number: i, description: w.name,
      position: { startX: GEOM[i].s[0], startY: GEOM[i].s[1], angle: GEOM[i].ang, endX: GEOM[i].e[0], endY: GEOM[i].e[1] },
      style: null,
      dimensions: { length: wallLen[i], height: HEIGHT, soffit: null, thick: 100, vaultHeight: null },
      fixtures: w.items.map(toFixture),
      furnishings: [],
    })),
  }];
  return {
    created: new Date().toISOString(), productVersion: 'Soline Measure 1.0.0', unit: 'mm',
    job: { name: 'תצוגת כל-האלמנטים — Soline', description: 'as-built לבדיקת קצה-לקצה של הצנרת' },
    customer: { name: 'Soline' },
    rooms,
  };
}
const model = buildModel();
const ordxXml = exportORDX(model);

// ---------------------------------------------------------------------------
// SolWriter-shaped JSON layers.
// ---------------------------------------------------------------------------
const nowIso = new Date().toISOString();
const stamp = Date.now();

function accType(it) {
  if (it.op === 'door') return 'DOOR';
  if (it.op === 'window') return 'WINDOW';
  if (it.op === 'vent') return 'CEILING_DROP';
  return 'GENERIC';
}
function openingBlock(it, wi) {
  const kind = it.op;
  const sill = (kind === 'window') ? it.y : null;
  return {
    kind, typeKey: accType(it), hebrewName: it.he,
    geom: { width: it.W, height: it.H, sillHeight: sill, wallThickness: 100, frameThickness: 40, frameReveal: 95, leafThickness: 40 },
    config: { openMode: kind === 'door' ? 'hinged' : (kind === 'window' ? 'sliding' : 'fixed'), hingeSide: null, swing: null, leafCount: 1, glazing: kind === 'window' ? 'full' : 'none' },
    pos: { wallId: wi, fromCorner: 'start', offset: it.x },
  };
}

function roomJson() {
  let aid = 100;
  const walls = WALLS.map((w, wi) => ({
    id: wi + 1, roomId: 1, idx: wi, length_mm: wallLen[wi], height_mm: HEIGHT,
    heightMeasured: true, angleToNext_deg: 90,
    head: { style: 'flat', ridge_mm: 0, peak_mm: 0 }, framePoints: [],
    accessories: w.items.map((it) => {
      const a = {
        id: ++aid, wallId: wi, type: accType(it), name: it.he,
        depth_mm: it.D || 0, fromLeft_mm: it.x, width_mm: it.W, fromBottom_mm: it.y, height_mm: it.H,
      };
      if (it.op) a.opening = openingBlock(it, wi);
      return a;
    }),
  }));
  return {
    id: 1, projectId: 1, name: 'חדר תצוגה — כל האלמנטים',
    entranceDirection: { bearingDeg: null, wallIdx: null },
    heightSweep: { values_mm: [HEIGHT], minHeight_mm: HEIGHT, maxHeight_mm: HEIGHT, bindingHeight_mm: HEIGHT },
    futureChanges: [], walls, cabinets: [], levelPoints: [],
  };
}

const manifest = {
  format: 'sol', magic: 'SOL1', schemaVersion: '1.0.0', minReaderVersion: '1.0.0',
  producer: 'Soline Measure 1.0.0', projectId: 1, units: 'mm',
  coordinateSystem: { yAxis: 'up', origin: 'world', handedness: 'right' },
  createdAt: nowIso, updatedAt: nowIso, currentRevision: 'DR1',
  encryption: { scheme: 'none' },
  layers: {
    meta: { present: true, entry: 'meta.json', sha256: null },
    measured: { present: true, entry: 'measured/', sha256: null },
    annotations: { present: true, entry: 'annotations.json', sha256: null },
    revisions: { present: true, entry: 'revisions.json', sha256: null },
    photos: { present: false, entry: 'photos/', sha256: null },
    videos: { present: false, entry: 'videos/', sha256: null },
    design: { present: false, entry: 'design/', sha256: null },
    fit: { present: false, entry: 'fit/', sha256: null },
    catalog: { present: false, entry: 'catalog/', sha256: null },
    bom: { present: false, entry: 'bom/', sha256: null },
    '3d': { present: false, entry: '3d/', sha256: null },
  },
  rooms: [{ id: 1, name: 'חדר תצוגה — כל האלמנטים', entry: 'measured/room-1.json' }],
  extensions: {},
};
const meta = { projectId: 1, name: 'תצוגת כל-האלמנטים — Soline', client: 'Soline', createdAt: stamp, materializedAt: nowIso, ownership: { tenant: 'soline', owner: null, license: null } };
const annotations = { notes: [], photos: [], videos: [], checklist: {}, projectChecklist: { complete: false, allRoomsComplete: false, access: {}, explainer: { count: 0, done: false } } };
const revisions = { history: [{ rev: 'DR1', at: nowIso, by: null, stage: 'measured', note: 'genesis' }] };

// ---------------------------------------------------------------------------
// Minimal ZIP writer (deflate) — central directory the readSol.unzip expects.
// ---------------------------------------------------------------------------
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files) {
  const locals = []; const centrals = []; let off = 0;
  for (const [name, dataRaw] of files) {
    const data = Buffer.isBuffer(dataRaw) ? dataRaw : Buffer.from(dataRaw, 'utf8');
    const comp = zlib.deflateRawSync(data);
    const nm = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nm.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nm, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nm.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(off, 42);
    centrals.push(ch, nm);
    off += lh.length + nm.length + comp.length;
  }
  const cdStart = off;
  let cdLen = 0; for (const b of centrals) cdLen += b.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdLen, 12); eocd.writeUInt32LE(cdStart, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, eocd]);
}

const J = (o) => JSON.stringify(o, null, 2);
const files = [
  ['manifest.json', J(manifest)],
  ['meta.json', J(meta)],
  ['measured/room-1.json', J(roomJson())],
  ['measured/source.ordx', ordxXml],
  ['annotations.json', J(annotations)],
  ['revisions.json', J(revisions)],
];
fs.mkdirSync(path.dirname(OUT_SOL), { recursive: true });
fs.writeFileSync(OUT_SOL, zip(files));

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const totItems = WALLS.reduce((n, w) => n + w.items.length, 0);
const pdpTypes = new Set(); WALLS.forEach((w) => w.items.forEach((it) => it.pdp && pdpTypes.add(it.pdp)));
console.log('room       : 4 walls  Lx=%d Ly=%d  height=%d', Lx, Ly, HEIGHT);
WALLS.forEach((w, i) => console.log('  wall%d %s len=%d items=%d', i, w.name.padEnd(22), wallLen[i], w.items.length));
console.log('items      : %d total', totItems);
console.log('PDP types  : %d/19 distinct -> %s', pdpTypes.size, [...pdpTypes].join(' '));
console.log('overlap    : PROVEN ZERO (worst-case footprints, both anchor readings)');
console.log('wrote      : %s (%d bytes)', OUT_SOL, fs.statSync(OUT_SOL).size);

module.exports = { WALLS, buildModel };
