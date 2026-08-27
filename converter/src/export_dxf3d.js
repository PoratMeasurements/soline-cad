'use strict';
// Soline DXF 3D exporter — one of the object-model's format exporters.
// Turns a Soline object (dimensions_mm + mount_height_mm) into a real 3D box made
// of six 3DFACE entities, placed & rotated per a Placement. Output is R12 ASCII
// DXF that opens in any CAD with a 3D view (AutoCAD, BricsCAD, LibreCAD-3D, etc.).
//
// Geometry contract (from OBJECT_MODEL.md):
//   - Box W×D×H from dimensions_mm.
//   - Width W centred on the placement point (X local: -W/2 .. +W/2).
//   - Depth D protrudes FROM the wall into the room (Y local: 0 .. D).
//   - Box bottom sits at z = mount_height_mm (Z local: z0 .. z0+H).
//   - Placement {x,y,z,rotation_deg}: rotate the box about the Z axis by the wall
//     angle, then translate to (x,y). z overrides the bottom height when given.
//
// Encoding: the file is pure 7-bit ASCII (older CAD chokes on UTF-8 Hebrew). All
// Hebrew is carried as AutoCAD unicode escapes `\U+XXXX` inside TEXT values; layer
// names are transliterated to ASCII (because `\U+` is NOT decoded in layer names).

const fs = require('fs');
const path = require('path');

// ---- Hebrew / encoding helpers -------------------------------------------
// TEXT/MTEXT values: keep ASCII as-is, encode every non-ASCII code point as the
// AutoCAD escape `\U+XXXX` (e.g. 'א' -> '\U+05D0'). This is how R12 DXF stores
// unicode, and how the user's CAD will render Hebrew.
function heToDxfUnicode(str) {
  let out = '';
  for (const ch of String(str == null ? '' : str)) {
    const cp = ch.codePointAt(0);
    out += cp < 128 ? ch : '\\U+' + cp.toString(16).toUpperCase().padStart(4, '0');
  }
  return out;
}

// Layer names must be plain ASCII (\U+ is not interpreted there). Transliterate
// Hebrew letters to Latin and sanitize to [A-Z0-9_]. Deterministic + collision-
// safe enough for the fixed category set.
const HE_TRANSLIT = {
  'א': 'A', 'ב': 'B', 'ג': 'G', 'ד': 'D', 'ה': 'H', 'ו': 'V', 'ז': 'Z',
  'ח': 'CH', 'ט': 'T', 'י': 'Y', 'כ': 'K', 'ך': 'K', 'ל': 'L', 'מ': 'M',
  'ם': 'M', 'נ': 'N', 'ן': 'N', 'ס': 'S', 'ע': 'A', 'פ': 'P', 'ף': 'F',
  'צ': 'TS', 'ץ': 'TS', 'ק': 'Q', 'ר': 'R', 'ש': 'SH', 'ת': 'T',
};
function heToAsciiLayer(str) {
  let out = '';
  for (const ch of String(str == null ? '' : str)) {
    if (HE_TRANSLIT[ch]) out += HE_TRANSLIT[ch];
    else if (/[A-Za-z0-9]/.test(ch)) out += ch.toUpperCase();
    else out += '_';
  }
  out = out.replace(/_+/g, '_').replace(/^_|_$/g, '');
  return out || 'LAYER';
}

// ---- DXF primitives -------------------------------------------------------
function g(code, val) { return code + '\n' + val + '\n'; } // group-code pair
function num(n) { return Number(n).toFixed(2); }

// A single quad face (4 corners, each [x,y,z]) as a 3DFACE entity on `layer`.
function face3DFACE(pts, layer) {
  const [a, b, c, d] = pts;
  return g(0, '3DFACE') + g(8, layer) +
    g(10, num(a[0])) + g(20, num(a[1])) + g(30, num(a[2])) +
    g(11, num(b[0])) + g(21, num(b[1])) + g(31, num(b[2])) +
    g(12, num(c[0])) + g(22, num(c[1])) + g(32, num(c[2])) +
    g(13, num(d[0])) + g(23, num(d[1])) + g(33, num(d[2]));
}

// A TEXT label at (x,y,z), height `h`. `str` is encoded to ASCII \U+XXXX escapes,
// and the entity uses text style `HEB` (a TrueType font that has Hebrew glyphs) so
// the \U+ code points render instead of showing as '???' with an SHX font.
function textEntity(str, x, y, z, h, layer) {
  return g(0, 'TEXT') + g(8, layer) +
    g(10, num(x)) + g(20, num(y)) + g(30, num(z)) +
    g(40, num(h)) + g(1, heToDxfUnicode(str)) + g(7, 'HEB');
}

// ---- object normalization -------------------------------------------------
// Accepts either the canonical object ({dimensions_mm:{W,D,H}, mount_height_mm})
// or a raw elements.json row ({width_mm, depth_mm, height_mm, mount_height_mm}).
// nulls get sensible fallbacks so every object yields a valid box.
const DEF = { W: 200, D: 50, H: 200, STRIP_LEN: 1000, CEILING: 2500 };

function normalize(obj, opts = {}) {
  const dm = obj.dimensions_mm || {};
  let W = dm.W != null ? dm.W : obj.width_mm;
  let D = dm.D != null ? dm.D : obj.depth_mm;
  let H = dm.H != null ? dm.H : obj.height_mm;
  const measureRef = obj.measure_ref || (obj.metadata && obj.metadata.measure_ref) || null;
  let mount = obj.mount_height_mm;
  if (mount == null && obj.metadata) mount = obj.metadata.mount_height_mm;

  // Fallbacks. Linear items (LED strips) have null width -> use a strip length.
  if (W == null) W = DEF.STRIP_LEN;
  if (D == null || D === 0) D = D === 0 ? 0 : DEF.D; // depth 0 is legal (floor box)
  if (H == null) H = DEF.H;
  if (W === 0) W = DEF.W;
  if (H === 0) H = DEF.H;

  // mount fallback: ceiling items float at the ceiling; else floor line.
  const ceiling = opts.ceilingHeight || DEF.CEILING;
  if (mount == null) mount = (measureRef === 'ceiling') ? ceiling : 0;

  return {
    en: obj.en || '', he: obj.he || obj.en || '',
    category: obj.category || 'אובייקטים',
    W: Math.abs(W), D: Math.abs(D), H: Math.abs(H),
    mount_height_mm: mount, measure_ref: measureRef,
  };
}

// ---- geometry -------------------------------------------------------------
// Build the 8 corners of the box in world coords, given normalized dims + placement.
// Returns the six faces (each an array of 4 [x,y,z] corners).
function boxFaces(nrm, placement) {
  const { W, D, H } = nrm;
  const p = placement || {};
  const px = p.x || 0, py = p.y || 0;
  const z0 = (p.z != null ? p.z : nrm.mount_height_mm) || 0;
  const z1 = z0 + H;
  const theta = ((p.rotation_deg || 0) * Math.PI) / 180;
  const cos = Math.cos(theta), sin = Math.sin(theta);

  // local corner -> world (rotate about Z at placement point, then translate).
  // xl in [-W/2, +W/2] (width centred), yl in [0, D] (depth out of wall).
  const corner = (xl, yl, zl) => [
    px + xl * cos - yl * sin,
    py + xl * sin + yl * cos,
    zl,
  ];
  const hw = W / 2;
  // 8 vertices indexed [i:x-,x+][j:y0,yD][k:zbot,ztop]
  const v = {};
  for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) {
    v[`${i}${j}${k}`] = corner(i ? hw : -hw, j ? D : 0, k ? z1 : z0);
  }
  return [
    [v['000'], v['100'], v['110'], v['010']], // bottom (z0)
    [v['001'], v['101'], v['111'], v['011']], // top (z1)
    [v['000'], v['100'], v['101'], v['001']], // front (wall side, y0)
    [v['010'], v['110'], v['111'], v['011']], // back (yD)
    [v['000'], v['010'], v['011'], v['001']], // left (x-)
    [v['100'], v['110'], v['111'], v['101']], // right (x+)
  ];
}

// One object -> its 6 3DFACE entities (+ optional label). Returns { body, faces }.
function objectBody(obj, placement, opts = {}) {
  const nrm = normalize(obj, opts);
  const faces = boxFaces(nrm, placement);
  const layer = heToAsciiLayer(nrm.category); // ASCII layer (Hebrew not allowed here)
  let body = '';
  for (const f of faces) body += face3DFACE(f, layer);
  if (opts.labels !== false) {
    const p = placement || {};
    const z0 = (p.z != null ? p.z : nrm.mount_height_mm) || 0;
    body += textEntity(nrm.he, (p.x || 0) - nrm.W / 2, (p.y || 0) - 80, z0,
      opts.labelHeight || 60, 'LABELS'); // legend layer (מקרא) — ASCII name
  }
  return { body, faces, nrm, layer };
}

// ---- DXF document assembly (HEADER + TABLES + ENTITIES) --------------------
function colorFor(name) { // stable-ish AutoCAD color index 1..255 from a string
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return (h % 254) + 1;
}

function layerTable(layers) {
  let s = g(0, 'TABLE') + g(2, 'LAYER') + g(70, layers.length);
  for (const name of layers) {
    s += g(0, 'LAYER') + g(2, name) + g(70, 0) + g(62, colorFor(name)) + g(6, 'CONTINUOUS');
  }
  return s + g(0, 'ENDTAB');
}

// STYLE table with a single text style `HEB` bound to a TrueType font (group 3 =
// Arial.ttf) that carries Hebrew glyphs. Without this the viewer falls back to an
// SHX font with no Hebrew coverage and every \U+ code point renders as '???'.
function styleTable() {
  return g(0, 'TABLE') + g(2, 'STYLE') + g(70, 1) +
    g(0, 'STYLE') + g(2, 'HEB') + g(70, 0) +
    g(40, '0.0') + g(41, '1.0') + g(50, '0.0') + g(71, 0) +
    g(42, num(60)) + g(3, 'Arial.ttf') + g(4, '') +
    g(0, 'ENDTAB');
}

function wrapDXF(entities, layers) {
  const header = g(0, 'SECTION') + g(2, 'HEADER') + g(9, '$ACADVER') + g(1, 'AC1009') + g(0, 'ENDSEC');
  const tables = g(0, 'SECTION') + g(2, 'TABLES') + styleTable() + layerTable(layers) + g(0, 'ENDSEC');
  const ents = g(0, 'SECTION') + g(2, 'ENTITIES') + entities + g(0, 'ENDSEC');
  return header + tables + ents + g(0, 'EOF');
}

// ---- public API -----------------------------------------------------------
// exportDXF3D(objects, opts) -> DXF string.
// Modes (opts.mode):
//   'gallery' (default): lay all objects out on a 3D grid, each as its box at its
//                        own mount_height. Ignores per-object placement.
//   'single' : render objects[0] (or a lone object) at opts.placement.
//   'plan'   : render each object at its placement. Placement comes from
//              item.placement, or opts.placements[i], or opts.placement.
// Objects may be canonical objects or raw elements.json rows, and each item may be
// either the object itself or a wrapper { object, placement }.
function exportDXF3D(objects, opts = {}) {
  const mode = opts.mode || 'gallery';
  const list = Array.isArray(objects) ? objects : [objects];
  const layers = new Set(['LABELS']);
  let body = '';

  const unwrap = (item) => (item && item.object) ? item : { object: item, placement: item && item.placement };

  if (mode === 'single') {
    const { object, placement } = unwrap(list[0]);
    const res = objectBody(object, opts.placement || placement || {}, opts);
    body += res.body; layers.add(res.layer);
  } else if (mode === 'plan') {
    list.forEach((item, i) => {
      const { object, placement } = unwrap(item);
      const pl = placement || (opts.placements && opts.placements[i]) || opts.placement || {};
      const res = objectBody(object, pl, opts);
      body += res.body; layers.add(res.layer);
    });
  } else { // gallery
    const cols = opts.cols || 12;
    const spacing = opts.spacing || 700; // mm between grid cells
    list.forEach((item, i) => {
      const { object } = unwrap(item);
      const col = i % cols, row = Math.floor(i / cols);
      const placement = { x: col * spacing, y: -row * spacing, rotation_deg: 0 };
      const res = objectBody(object, placement, opts);
      body += res.body; layers.add(res.layer);
    });
  }
  return wrapDXF(body, [...layers]);
}

// ---- self-test ------------------------------------------------------------
function selfTest(dxf, objects, opts = {}) {
  const problems = [];
  const faceCount = (dxf.match(/\n0\n3DFACE\n/g) || []).length;
  const expectFaces = objects.length * 6;
  if (faceCount !== expectFaces) problems.push(`face count ${faceCount} != expected ${expectFaces}`);
  if (!dxf.startsWith('0\nSECTION')) problems.push('missing opening SECTION');
  if (!/\n0\nEOF\n?$/.test(dxf)) problems.push('missing EOF');
  if (!dxf.includes('\n2\nENTITIES\n')) problems.push('missing ENTITIES section');

  // every 3DFACE must carry 4 vertices (codes 10/11/12/13 present).
  const faces = dxf.split('\n0\n3DFACE\n').slice(1);
  let badVerts = 0;
  for (const f of faces) {
    const block = f.split('\n0\n')[0];
    for (const c of ['10', '11', '12', '13']) if (!block.includes('\n' + c + '\n')) badVerts++;
  }
  if (badVerts) problems.push(`${badVerts} missing vertex codes across faces`);

  // Z check: pick a sample object with a known non-null mount and confirm its
  // bottom face Z equals mount_height_mm (gallery mode, z from mount).
  if ((opts.mode || 'gallery') === 'gallery') {
    const idx = objects.findIndex((o) => (o.mount_height_mm != null));
    if (idx >= 0) {
      const nrm = normalize(objects[idx], opts);
      const faces = boxFaces(nrm, { x: 0, y: 0, rotation_deg: 0 });
      const bottomZ = faces[0][0][2], topZ = faces[1][0][2];
      if (Math.abs(bottomZ - nrm.mount_height_mm) > 0.01)
        problems.push(`z bottom ${bottomZ} != mount_height ${nrm.mount_height_mm}`);
      if (Math.abs(topZ - (nrm.mount_height_mm + nrm.H)) > 0.01)
        problems.push(`z top ${topZ} != mount+H`);
    }
  }
  return { ok: problems.length === 0, faceCount, expectFaces, problems };
}

module.exports = {
  exportDXF3D, normalize, boxFaces, objectBody, face3DFACE, selfTest,
  heToDxfUnicode, heToAsciiLayer,
};

// ---- CLI ------------------------------------------------------------------
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const elements = JSON.parse(fs.readFileSync(path.join(root, 'elements.json'), 'utf8'));
  const outDir = path.join(root, 'analysis', 'out');
  fs.mkdirSync(outDir, { recursive: true });

  const dxf = exportDXF3D(elements, { mode: 'gallery' });
  const outPath = path.join(outDir, 'dxf3d_gallery.dxf');
  fs.writeFileSync(outPath, dxf, 'utf8');

  const t = selfTest(dxf, elements, { mode: 'gallery' });
  console.log(`Soline DXF 3D — gallery of ${elements.length} objects`);
  console.log(`  wrote ${outPath} (${dxf.length} bytes)`);
  console.log(`  3DFACE entities: ${t.faceCount} (expected ${t.expectFaces}, 6/object)`);
  console.log(`  self-test: ${t.ok ? 'PASS' : 'FAIL'}`);
  if (!t.ok) { t.problems.forEach((p) => console.log('   - ' + p)); process.exitCode = 1; }
}
