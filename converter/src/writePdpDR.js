'use strict';
/*
 * writePdpDR.js — ORDX room -> PDP (DR/zero-header int16 format).
 * =============================================================================
 * THE STRATEGY (2026-08-21 — DECISIVE breakthrough, LIVE-confirmed by the owner):
 * ---------------------------------------------------------------------------
 * A KNOWN-LOADABLE real InnoDraw base (`templates/dr/base/wall4_oc17.pdp`) loads
 * CLEAN in the owner's Raumplan — walls, dimensions, and its own items. But that
 * SAME base with its item records REPLACED by (even byte-identical) records
 * harvested from a DIFFERENT corpus file → E4214. Meanwhile mimran5→mimran5
 * (records from the SAME file) loads. CONCLUSION: whole-record REPLACEMENT is the
 * E4214 cause — each 173-B item record carries a file-specific field (an id/version
 * tied to its origin file); swapping in a record from another file creates a
 * cross-file mismatch → E4214.
 *
 * THE FIX — MINIMAL IN-PLACE edits to the loadable base; NEVER swap whole records:
 *   1. Load a KNOWN-LOADABLE real base .pdp (bundled under templates/dr/base/).
 *      Keep header + Section-E body + furniture assembly + 838-B glyph/EOF tail +
 *      EVERY item record's file-specific bytes BYTE-FOR-BYTE.
 *   2. Overwrite ONLY the wall table @0xd4 (int16, stride 14) + wall count @0xd2.
 *   3. For each base item slot we reuse, EDIT IN PLACE only these fields of the
 *      base's OWN record bytes (everything else — the InnoDraw prefix @0x00, the
 *      0x23 field @0x1e, the 0x8f-0x90 field, and any file-specific id/version —
 *      stays byte-for-byte from the base):
 *        - position   @+0x85 / +0x87 / +0x89   (int16 X,Y,Z; Z has -20000 bias)   [always]
 *        - dims        @+0x79 / +0x7f          (two [W,D,H] int16 triples)         [if differs]
 *        - type string @+0x09                  (cp1255, null-term, ≤ 0x1e)         [if differs]
 *        - symbol code @+0x91                  (E4214 selector)                    [if differs]
 *      The symbol code is ONLY ever set to a value the base ALREADY contains among
 *      its own records (harvested at load time). A desired code outside that set is
 *      clamped to the nearest in-base code — so no record can carry a code this base
 *      does not already prove loadable.
 *   4. Slots are assigned to items to MINIMISE the diff: prefer a slot whose type
 *      already equals the item's type (then only position changes), else a slot whose
 *      code already equals the target (only type+pos change), else any slot.
 *   5. Surplus base slots (more slots than items) are LEFT AS-IS — the base's own
 *      item, untouched (owner: neutralising caused 921; keep-as-is is safest).
 *   6. NO append path. Base selection therefore GUARANTEES enough slots up front:
 *      loadBase never returns a base with fewer slots than the room has items when
 *      ANY bundled base (same or higher wall-count) can fit — so items are not dropped.
 *      Only if NO bundled base can hold every item does overflow remain, and then it is
 *      logged with an explicit count (never a silent drop). Appending whole records is
 *      still forbidden (cross-file replacement = E4214).
 *
 * WHY THIS IS DIFFERENT FROM EVERY FAILED ATTEMPT:
 *   Nothing is synthesized and no record is replaced. Every byte the owner's
 *   Raumplan validates (body, assembly, tail, each record's file-specific field) is
 *   the loadable base's own byte. The only changes are geometry (walls, positions,
 *   dims) and a symbol/type re-label constrained to the base's own proven values.
 *   The north star: MINIMAL DIFF from a file that already loads.
 *
 * Wall transform VALIDATED byte-exact on the 9 mimran sets (docs/elc_sets_analysis.md).
 *   wall table @0xd4, int16, stride 14: [x1,y1,x2,y2][thick][height]  (mm, centerline)
 *   transform:  x_pdp = x_ordx + Cx ;  y_pdp = -y_ordx + Cy ;  walls in REVERSE order
 *   Cx,Cy translation-free; auto-centered onto the base's own wall centroid.
 *
 * NOTE: these outputs must be Raumplan-LOAD-TESTED by the owner. The converter can
 * prove structure (real base body preserved, in-base codes only) but only the
 * owner's Raumplan build is the final oracle.
 */

const fs = require('fs');
const path = require('path');
const drBody = require('./dr_body'); // used for REPORTING ONLY (countAssemblies/bodyReport). Never strip.

const COUNT_OFF = 0xd2, TABLE_OFF = 0xd4, STRIDE = 14;
const OBJ_REC = 173;
const OBJ_TYPE_OFF = 0x09;  // cp1255 type string, null-terminated, runs up to the 0x23 field @0x1e
const OBJ_TYPE_END = 0x1e;  // the constant 0x23 field begins here; type string must fit before it
const OBJ_DIM_OFF = 0x79, OBJ_DIM2_OFF = 0x7f;
const OBJ_POS = 0x85;       // X @ +0x85, Y @ +0x87, Z @ +0x89 (int16 local, -20000 bias)
const OBJ_POS_END = 0x8b;   // position triple ends here; 0x8b.. is left untouched (file-specific)
const SYM_OFF = 0x91;       // symbol/class code (E4214 selector)

// ---------------------------------------------------------------------------
// PAIRED (code + property-block) swap — the "correct symbol" mechanism.
// ---------------------------------------------------------------------------
// DECODED 2026-08-22 (byte-verified across mimran-1..9 + the bundled bases):
//   * The symbol is selected by the COUPLED pair {code int16 @0x91 ; 9-byte property
//     block @0x93-0x9b}. This 11-byte unit [0x91,0x9c) is TYPE-CANONICAL: every שקע
//     everywhere is `03 00 12 00 00 00 00 0e 00 00 00`, every צ.חשמל `01 00 00 06 00
//     00 00 1e 00 00 00`, etc. — identical across ALL files and ALL list positions.
//     So copying this unit cross-file is NOT the E4214 cross-file mismatch (that was a
//     WHOLE-record swap; the file-specific id/version lives in 0x00-0x90, which we keep
//     from the base). And because code+block travel together, the property list stays
//     consistent -> no E4048 (which came from editing the code alone).
//   * The bytes at 0x9c.. are a LIST TERMINATOR, POSITION-driven not type-driven: in
//     every corpus file ONLY the LAST record carries the extended `38 00 .. 0e 01`
//     form; all earlier records are `38 0e 00 [extra]`. The base slot's own terminator
//     is therefore ALWAYS preserved by a paired swap (we never write 0x9c.. for the
//     last slot). For a NON-last target sourced from a non-last (`38 0e`) .bin we may
//     additionally carry the type-extra bytes through 0x9f (e.g. door's `08` @0x9f),
//     which reproduces the exact non-last marker form and improves fidelity.
const SYM_BLK_START = 0x91;  // code int16 @0x91-0x92
const SYM_BLK_END   = 0x9c;  // exclusive: [0x91,0x9c) = code(2) + property block(9) = the swap unit
const SYM_EXT_END   = 0xa0;  // exclusive: extend through 0x9f (marker `38 0e 00` + type-extra) — only
                             // for a non-last target from a non-last (`38 0e`) source .bin
const SYM_MARK_OFF  = 0x9d;  // the marker byte: 0x0e on non-last records, 0x00 on the last record

// ---------------------------------------------------------------------------
// GROUND-TRUTH per-type {code + property block} — the Soline↔Raumplan library contract.
// ---------------------------------------------------------------------------
// Decoded byte-for-byte from the owner's multi-format calibration file
// `elemets_Bar_Terra-Nova_Yosi_DR1.pdp` (40 objects, 32 native types — the "Rosetta Stone").
// The 11-byte swap unit is [0x91,0x9c) = code int16 + 9-byte property block; it is TYPE-CANONICAL
// (identical across every instance and every corpus file). Every `templates/dr/items/*.bin` that
// overlaps this file was verified === to the value below (see docs/ELEMENT_LIBRARY_MASTER.md).
// This table is the authoritative reference; the runtime source of the bytes is still the .bin
// (pairedSwap copies from it), and selfTest() hard-guards each .bin against this table.
const GT_CODES = {
  // type            code  block[0x91,0x9c) as hex          catalog dims W/D/H
  'דלת':            { code: 1,  block: '01 00 0a 04 00 00 00 04 00 00 00', dims: [1000, 100, 2000] },
  'חלון':           { code: 5,  block: '05 00 0b 10 00 00 01 1d 00 00 00', dims: [940, 100, 1260] },
  'אדן חלון':       { code: 1,  block: '01 00 00 04 00 00 00 04 00 00 00', dims: [500, 100, 100] },
  'ארגז תריס':      { code: 1,  block: '01 00 00 04 00 00 00 04 00 00 00', dims: [300, 100, 200] },
  'פתח איוורור תקרה':{ code: 1, block: '01 00 00 04 00 00 00 04 00 00 00', dims: [1000, 1000, 20] },
  'רדיאטור':        { code: 11, block: '0b 00 10 16 00 00 00 2c 00 00 00', dims: [1000, 150, 880] },
  'חור איורור':     { code: 12, block: '0c 00 00 00 00 00 00 1d 00 00 00', dims: [500, 10, 500] },
  'מזגן':           { code: 20, block: '14 00 02 2b 00 00 01 33 00 00 00', dims: [1000, 250, 300] },
  'צ.מים':          { code: 1,  block: '01 00 00 06 00 00 00 1e 00 00 00', dims: [20, 50, 20] },
  'מקלחת':          { code: 20, block: '14 00 00 31 00 00 00 2d 00 00 00', dims: [1000, 1100, 2000] },
  'פ.ביוב':         { code: 1,  block: '01 00 00 10 00 00 00 04 00 00 00', dims: [120, 120, 10] },
  'ביוב':           { code: 1,  block: '01 00 00 1e 00 00 00 04 00 00 00', dims: [50, 50, 100] },
  'גז':             { code: 6,  block: '06 00 12 00 00 00 00 1a 00 00 00', dims: [100, 10, 100] },
  'מים משולב':      { code: 15, block: '0f 00 12 00 00 00 00 3c 00 01 00', dims: [200, 10, 205] },
  'ברז':            { code: 5,  block: '05 00 12 00 00 00 00 13 00 00 00', dims: [70, 10, 70] },
  'בידה':           { code: 1,  block: '01 00 00 56 00 00 00 12 00 00 00', dims: [360, 590, 367] },
  'אמבט':           { code: 1,  block: '01 00 01 34 00 00 00 11 00 00 00', dims: [1700, 750, 600] },
  'חור.פ.ממד':      { code: 1,  block: '01 00 00 06 00 00 00 1e 00 00 00', dims: [1000, 200, 1000] },
  'אנטנה':          { code: 3,  block: '03 00 12 00 00 00 00 0d 00 00 00', dims: [80, 10, 80] },
  '+מפסק':          { code: 4,  block: '04 00 12 00 00 00 00 12 00 00 00', dims: [150, 10, 120] },
  'מפסק':           { code: 4,  block: '04 00 12 00 00 00 00 12 00 00 00', dims: [150, 10, 120] },
  '+שקע':           { code: 3,  block: '03 00 12 00 00 00 00 0e 00 00 00', dims: [150, 10, 120] },
  'שקע':            { code: 3,  block: '03 00 12 00 00 00 00 0e 00 00 00', dims: [150, 10, 120] },
  'ק.חשמל':         { code: 3,  block: '03 00 00 04 00 01 00 08 00 01 00', dims: [500, 220, 540] },
  'צ.חשמל':         { code: 1,  block: '01 00 00 06 00 00 00 1e 00 00 00', dims: [14, 100, 14] },
  '+טלפון':         { code: 4,  block: '04 00 12 00 00 00 00 10 00 00 00', dims: [60, 10, 80] },
  'טלפון':          { code: 4,  block: '04 00 12 00 00 00 00 10 00 00 00', dims: [60, 10, 80] },
  'תאורה':          { code: 7,  block: '07 00 00 2b 00 01 00 22 00 01 00', dims: [850, 285, 220] },
  'אינטרקום':       { code: 4,  block: '04 00 00 01 00 00 00 0e 00 00 00', dims: [60, 50, 190] },
  'ק.בקורת':        { code: 2,  block: '02 00 12 00 00 00 00 0c 00 00 00', dims: [100, 10, 100] },
  'עמוד':           { code: 1,  block: '01 00 00 04 00 00 00 04 00 00 00', dims: [1000, 1000, 2600] },
  'עמוד עגול':      { code: 1,  block: '01 00 02 10 00 00 00 09 00 00 00', dims: [200, 200, 2600] },
  // Not present in the Rosetta file (kept from earlier corpus/InnoDraw samples; see master doc):
  'ביוב קיר':       { code: 1,  block: '01 00 00 06 00 00 00 1e 00 00 00', dims: null },
  'תעלה':           { code: 1,  block: '01 00 00 04 00 00 00 04 00 00 00', dims: null },
  'אסלה':           { code: 7,  block: '07 00 00 21 00 00 00 28 00 00 00', dims: null },
};

// ---------------------------------------------------------------------------
// Wall table
// ---------------------------------------------------------------------------
function readWallTable(buf) {
  const n = buf.readInt16LE(COUNT_OFF);
  const w = [];
  for (let i = 0; i < n; i++) {
    const s = TABLE_OFF + i * STRIDE;
    w.push([buf.readInt16LE(s), buf.readInt16LE(s + 2), buf.readInt16LE(s + 4), buf.readInt16LE(s + 6)]);
  }
  return w;
}
function centroid(pts) {
  let x = 0, y = 0, n = 0;
  for (const p of pts) { x += p[0]; y += p[1]; n++; }
  return [x / n, y / n];
}

// Overwrite ONLY the wall table of a REAL base buffer with the room's walls.
// Keeps the wall COUNT = base count (the object-count u32 + Section-E body live at
// cOff = 0xd4 + 14*n; changing n would shift that offset -> corrupt file). When the
// room has fewer walls than the base, surplus slots collapse to a degenerate point.
function writeWallsDR(templateBuf, walls, opts = {}) {
  const buf = Buffer.from(templateBuf);
  const n = buf.readInt16LE(COUNT_OFF);
  if (walls.length > n) {
    throw new Error(`base has ${n} wall slots but room has ${walls.length}; pick a base with >= ${walls.length} walls`);
  }
  const rev = walls.slice().reverse();

  const tmplCentroid = centroid(readWallTable(buf).flatMap((w) => [[w[0], w[1]], [w[2], w[3]]]));
  const ordxPts = rev.flatMap((w) => [[w.position.startX, w.position.startY], [w.position.endX, w.position.endY]]);
  const oc = centroid(ordxPts);
  const Cx = opts.Cx != null ? opts.Cx : Math.round(tmplCentroid[0] - oc[0]);
  const Cy = opts.Cy != null ? opts.Cy : Math.round(tmplCentroid[1] + oc[1]);

  rev.forEach((w, i) => {
    const p = w.position, d = w.dimensions || {};
    const s = TABLE_OFF + i * STRIDE;
    buf.writeInt16LE(Math.round(p.startX + Cx), s);
    buf.writeInt16LE(Math.round(-p.startY + Cy), s + 2);
    buf.writeInt16LE(Math.round(p.endX + Cx), s + 4);
    buf.writeInt16LE(Math.round(-p.endY + Cy), s + 6);
    buf.writeInt16LE(Math.round(d.thick || 100), s + 8);
    buf.writeInt16LE(Math.round(d.height || 2600), s + 10);
  });
  const px = Math.round(oc[0] + Cx), py = Math.round(-oc[1] + Cy);
  for (let i = walls.length; i < n; i++) {
    const s = TABLE_OFF + i * STRIDE;
    buf.writeInt16LE(px, s); buf.writeInt16LE(py, s + 2);
    buf.writeInt16LE(px, s + 4); buf.writeInt16LE(py, s + 6);
    buf.writeInt16LE(0, s + 8);
    buf.writeInt16LE(Math.round((walls[0] && walls[0].dimensions && walls[0].dimensions.height) || 2600), s + 10);
  }
  return { buf, Cx, Cy, paddedWalls: n - walls.length };
}

// ---------------------------------------------------------------------------
// Real-base selection.  templates/dr/base/wall<N>_oc<M>.pdp
// Pick a base that has ENOUGH item slots for the room (never silently drop items):
//   (1) prefer a SAME-wall-count base whose slot count M is the tightest fit >= nItems
//       (fewest surplus slots, no padded walls);
//   (2) if the same-wall base has too few slots (or none exists), fall back to ANY base
//       with >= nWalls walls AND >= nItems slots — fewest padded walls, then tightest fit
//       (e.g. the rich wall4_oc40 / wall8_oc23). Never keep a too-small same-wall base;
//   (3) only if NO base can hold every item, pick the >= nWalls base with the MOST slots
//       (drops the fewest) and let convertRoomDRv2 LOG the unplaced count.
//
// RICH BASE (2026-08-23): templates/dr/base/wall4_oc40.pdp is the owner's multi-format
// calibration file `elemets_Bar_Terra-Nova_Yosi_DR1.pdp` — 4 CLEAN walls (no ghost/degenerate
// walls, unlike wall8_oc23) and 40 native slots spanning 32 distinct element types (socket,
// switch, junction, faucet, gas, light, window, door, power box/line, water line, sewage, floor
// drain, radiator, AC, shower, bath, bidet, antenna/TV, phone, intercom, columns, vents …).
// Because its slots already carry the CORRECT {code+block} for those types, mapping a room's
// items onto its exact-type slots yields the right symbol with ZERO paired-swaps. It is the
// natural pick for a large/diverse room (>25 items on 4 walls). The tightest-fit rule keeps it
// OUT of small-room selection (e.g. a 17-item room still gets wall4_oc17: exact slot count, zero
// surplus). TRADE-OFF: for a small room the rich base leaves many surplus native slots rendering
// as ghost items, so prefer an exact-count base + editSymbol paired-swap (correct symbols, zero
// surplus) unless the room genuinely needs the rich base's native 3D furniture meshes.
// ---------------------------------------------------------------------------
// ===========================================================================
// CUSTOMER-SUPPLIED BASE  (interop compliance — docs/PDP_CUSTOMER_BASE.md,
// docs/INTEROP_COMPLIANCE.md).  Soline ships NO InnoDraw/Raumplan `.pdp` base and
// NO extracted `.bin` element records in the shippable product. The PDP base
// directory is resolved AT CONVERT TIME from the CUSTOMER's own licensed InnoDraw
// install, in strict priority order:
//   (1) env  SOLINE_DR_BASE_DIR
//   (2) soline.config.json  "drBaseDir"  (searched: $SOLINE_CONFIG, then cwd, then
//       the converter root; a relative value is resolved against the config file)
//   (3) DEV-ONLY fallback   <converter>/templates/dr/base   — present only on a
//       licensed developer seat (Michael's) and EXCLUDED from every shipped build
//       (see SHIPPING_MANIFEST.md). Never bundled with the product.
// If NONE resolve, the PDP export FAILS CLEANLY (NO_BASE_MSG) — it never silently
// falls back to shipping a vendor file.
// ===========================================================================
const CONVERTER_ROOT = path.join(__dirname, '..');
const DEV_BASE_DIR   = path.join(CONVERTER_ROOT, 'templates', 'dr', 'base');
const DEV_ITEMS_DIR  = path.join(CONVERTER_ROOT, 'templates', 'dr', 'items');

const NO_BASE_MSG =
  'PDP export needs your InnoDraw base — set SOLINE_DR_BASE_DIR / soline.config.json to your El_Cad base ' +
  '(a directory holding one or more of your own licensed InnoDraw .pdp base files). Soline ships no vendor ' +
  'base; see docs/PDP_CUSTOMER_BASE.md.';

let _cfg; // cached parsed soline.config.json (annotated with __path), or {}
function loadConfig() {
  if (_cfg !== undefined) return _cfg;
  const candidates = [
    process.env.SOLINE_CONFIG,
    path.join(process.cwd(), 'soline.config.json'),
    path.join(CONVERTER_ROOT, 'soline.config.json'),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) { const c = JSON.parse(fs.readFileSync(p, 'utf8')) || {}; c.__path = p; _cfg = c; return _cfg; }
    } catch (e) { /* malformed config: ignore this candidate, fall through */ }
  }
  _cfg = {};
  return _cfg;
}
function dirOk(p) { try { return !!p && fs.statSync(p).isDirectory(); } catch (e) { return false; } }
function resolveConfigDir(field) {
  const cfg = loadConfig();
  if (!cfg[field]) return null;
  const raw = cfg[field];
  const abs = path.isAbsolute(raw) ? raw : path.join(path.dirname(cfg.__path || CONVERTER_ROOT), raw);
  return { raw, dir: abs, source: `config:${cfg.__path}` };
}

// Resolve the customer's PDP base directory. Returns { dir, source } or null (unconfigured).
// Throws only when an EXPLICIT setting points at a path that is not a readable directory.
function resolveBaseDir() {
  const env = process.env.SOLINE_DR_BASE_DIR;
  if (env) {
    if (dirOk(env)) return { dir: env, source: 'env:SOLINE_DR_BASE_DIR' };
    throw new Error(`SOLINE_DR_BASE_DIR is set to "${env}" but that is not a readable directory. ${NO_BASE_MSG}`);
  }
  const cfg = resolveConfigDir('drBaseDir');
  if (cfg) {
    if (dirOk(cfg.dir)) return { dir: cfg.dir, source: cfg.source };
    throw new Error(`soline.config.json "drBaseDir" ("${cfg.raw}") is not a readable directory. ${NO_BASE_MSG}`);
  }
  if (dirOk(DEV_BASE_DIR)) return { dir: DEV_BASE_DIR, source: 'dev-fallback:templates/dr/base' }; // DEV-ONLY, not shipped
  return null;
}
function requireBaseDir() {
  const r = resolveBaseDir();
  if (!r) throw new Error(NO_BASE_MSG);
  return r;
}
// Convenience status for callers (e.g. soline_convert.js) to fail cleanly without a throw.
// ok:true only when a base dir resolves AND it actually holds >=1 usable base .pdp.
function baseStatus() {
  try {
    const r = resolveBaseDir();
    if (!r) return { ok: false, message: NO_BASE_MSG };
    const bases = listBases();
    if (!bases.length) return { ok: false, message: `No InnoDraw base .pdp files found in "${r.dir}". ${NO_BASE_MSG}` };
    return { ok: true, dir: r.dir, source: r.source, count: bases.length };
  } catch (e) { return { ok: false, message: e.message }; }
}

// The DEV-ONLY `.bin` element-record directory (used ONLY by the editSymbol paired-swap
// path). Optional — priority: env SOLINE_DR_ITEMS_DIR -> config.drItemsDir -> dev fallback.
// Returns a dir path or null. In the shippable product this resolves to null and the
// editSymbol path harvests the {code+block} unit from the customer's own base slots instead.
function resolveItemsDir() {
  const env = process.env.SOLINE_DR_ITEMS_DIR;
  if (env) return dirOk(env) ? env : null;
  const cfg = resolveConfigDir('drItemsDir');
  if (cfg) return dirOk(cfg.dir) ? cfg.dir : null;
  if (dirOk(DEV_ITEMS_DIR)) return DEV_ITEMS_DIR; // DEV-ONLY, not shipped
  return null;
}

// Enumerate usable base `.pdp` files in the resolved (customer) base dir. Files named with
// the dev convention `wall<N>_oc<M>.pdp` carry their wall/slot counts in the name; ANY other
// `.pdp` (a customer's own arbitrarily-named base) has its wall + slot counts read from the
// file itself, so a single customer base drops in with no renaming (loadBase then pads walls /
// logs overflow as needed). Returns [] when no base dir is configured/available.
function listBases() {
  const r = resolveBaseDir();
  if (!r) return [];
  let files = [];
  try { files = fs.readdirSync(r.dir); } catch (e) { return []; }
  const out = [];
  for (const f of files) {
    if (!/\.pdp$/i.test(f)) continue;
    const full = path.join(r.dir, f);
    const m = /^wall(\d+)_oc(\d+)\.pdp$/i.exec(f);
    if (m) { out.push({ file: full, name: f, walls: +m[1], oc: +m[2] }); continue; }
    // Customer base with an arbitrary name: read wall + slot counts from the file content.
    try {
      const buf = fs.readFileSync(full);
      if (buf.length < TABLE_OFF + 2) continue;
      const nW = buf.readInt16LE(COUNT_OFF);
      if (nW <= 0 || nW >= 1000) continue;
      const prof = baseSlotProfile(buf);
      out.push({ file: full, name: f, walls: nW, oc: prof.objCount });
    } catch (e) { /* not a readable PDP base — skip */ }
  }
  return out;
}

function loadBase(nWalls, nItems) {
  requireBaseDir(); // throws NO_BASE_MSG when unconfigured — NEVER a bundled/vendor fallback
  const bases = listBases();
  if (!bases.length) {
    const r = resolveBaseDir();
    throw new Error(`No InnoDraw base .pdp files found in "${r ? r.dir : '(unresolved)'}". ${NO_BASE_MSG}`);
  }
  // (1) BEST CASE — a SAME-wall-count base that ALSO has enough item slots. Tightest fit
  //     (smallest oc >= nItems) = fewest surplus slots, no padded walls, no dropped items.
  const sameWall = bases.filter((b) => b.walls === nWalls).sort((a, b) => a.oc - b.oc);
  const sameFit = sameWall.find((b) => b.oc >= nItems);
  if (sameFit) {
    return { buf: fs.readFileSync(sameFit.file), walls: sameFit.walls, oc: sameFit.oc, exactWalls: true, name: sameFit.name, append: false };
  }
  // (2) NEVER DROP TO FIT A TOO-SMALL SAME-WALL BASE. If the same-wall base has too few
  //     slots (or none exists), fall back to ANY base with >= nWalls walls AND enough slots
  //     for every item (e.g. the rich wall4_oc40 / wall8_oc23). Prefer the fewest padded
  //     walls (walls closest to the room's), then the tightest slot fit. A padded surplus
  //     wall is invisible/degenerate — far cheaper than silently dropping items.
  const enough = bases.filter((b) => b.walls >= nWalls && b.oc >= nItems)
    .sort((a, b) => (a.walls - b.walls) || (a.oc - b.oc));
  if (enough.length) {
    const fit = enough[0];
    return { buf: fs.readFileSync(fit.file), walls: fit.walls, oc: fit.oc, exactWalls: fit.walls === nWalls, name: fit.name, append: false };
  }
  // (3) NO base can hold every item. Pick the >= nWalls base with the MOST slots (drops the
  //     fewest items), same wall-count winning ties. append:true signals convertRoomDRv2 to
  //     LOG exactly how many items could not be placed — never a silent drop.
  const canHold = bases.filter((b) => b.walls >= nWalls).sort((a, b) => (b.oc - a.oc) || (a.walls - b.walls));
  if (canHold.length) {
    const fit = canHold[0];
    return { buf: fs.readFileSync(fit.file), walls: fit.walls, oc: fit.oc, exactWalls: fit.walls === nWalls, name: fit.name, append: nItems > fit.oc };
  }
  throw new Error(`no bundled base with >= ${nWalls} walls (have: ${[...new Set(bases.map((b) => b.walls))].sort((a, b) => a - b).join(',')})`);
}

// Read a bundled base's native item slots (type + symbol code) without loading the
// whole PDP machinery — used to score bases for the "richest native coverage" pick.
function baseSlotProfile(buf) {
  const nW = buf.readInt16LE(COUNT_OFF);
  const cOff = TABLE_OFF + STRIDE * nW;
  const objCount = buf.readUInt32LE(cOff);
  const o0 = cOff + 20;
  const slots = [];
  if (objCount < 0 || objCount > 5000 || o0 + objCount * OBJ_REC > buf.length) return { nW, objCount: 0, slots };
  for (let i = 0; i < objCount; i++) {
    const off = o0 + i * OBJ_REC;
    slots.push({ type: slotType(buf, off), code: buf.readUInt8(off + SYM_OFF) });
  }
  return { nW, objCount, slots };
}

// PICK THE RICHEST BASE for a set of items (Fix A). Scores every bundled base that has
// enough wall slots (walls >= room walls) and enough item slots (>= item count) by how
// many items get an EXACT-native-type slot (its rendered symbol is already the item's
// correct symbol), then by how many get a same-CODE-family slot, then preferring the
// FEWEST padded/degenerate walls (walls closest to the room's) and least slot waste.
// Returns { buf, name, walls, oc, exactWalls, append, profile, score } or null.
function pickRichestBase(neededTypeCounts, nWalls, nItems) {
  const bases = listBases();
  let best = null;
  for (const b of bases) {
    if (b.walls < nWalls) continue;                 // room walls must fit
    const buf = fs.readFileSync(b.file);
    const prof = baseSlotProfile(buf);
    if (prof.objCount < nItems) continue;           // need a slot per item (no append)
    // Greedy: consume slots for exact-type first (native correct symbol), then same-CODE
    // family (closest correct-family symbol). Mirrors assignSlots' passes 1 and 2 so the
    // score predicts the actual mapping this base would produce.
    const tp = {}; for (const s of prof.slots) tp[s.type] = (tp[s.type] || 0) + 1;
    const cp = {}; for (const s of prof.slots) cp[s.code] = (cp[s.code] || 0) + 1;
    let exact = 0, family = 0;
    const rem = []; // per non-exact item: the code family it still wants
    for (const [t, n] of Object.entries(neededTypeCounts)) {
      const take = Math.min(n, tp[t] || 0); tp[t] -= take; exact += take;
      const code = neededCodeForType(t);
      for (let k = 0; k < take; k++) if (cp[code] > 0) cp[code]--; // exact slot carries its code
      for (let k = 0; k < n - take; k++) rem.push(code);
    }
    for (const code of rem) if (cp[code] > 0) { cp[code]--; family++; }
    const padded = b.walls - nWalls;
    const score = exact * 1000 + family * 10 - padded * 5 - (prof.objCount - nItems);
    const cand = { buf, name: b.name, walls: b.walls, oc: prof.objCount, exactWalls: b.walls === nWalls, append: false, exact, family, padded, score };
    if (!best || cand.score > best.score) best = cand;
  }
  return best;
}
// PICK A CODE-COVERING BASE for the "correct symbol for EVERY item" (editSymbol) path.
// The 921 driver is code-membership: a swap may only set a code the base natively registers.
// So for full correct-symbol coverage the base's native distinct-code set must be a SUPERSET
// of every item's canonical code. Among bundled bases with enough walls + slots + full code
// coverage, prefer the FEWEST surplus slots (tightest fit), then fewest padded walls.
// Returns { buf, name, walls, oc, missingCodes:[] } (missingCodes non-empty => no full-coverage
// base exists; caller falls back to the richest and some items stay family-fallback).
function pickBaseForSymbols(items, nWalls) {
  const need = new Set();
  const needByCode = {};
  for (const it of items) { const c = gtCodeForType(it.type); if (c != null) { need.add(c); needByCode[c] = (needByCode[c] || 0) + 1; } }
  const nItems = items.length;
  const bases = listBases();
  let best = null, fallback = null;
  for (const b of bases) {
    if (b.walls < nWalls) continue;
    const buf = fs.readFileSync(b.file);
    const prof = baseSlotProfile(buf);
    if (prof.objCount < nItems) continue;
    const codeCount = {}; for (const s of prof.slots) codeCount[s.code] = (codeCount[s.code] || 0) + 1;
    const nativeCodes = new Set(Object.keys(codeCount).map(Number));
    const missing = [...need].filter((c) => !nativeCodes.has(c));
    // enough slots of each needed code to host every item on a same-code slot (so @0x91 never
    // changes — only sub-blocks vary within a registered code)
    let codeCapacityOk = true;
    for (const [c, n] of Object.entries(needByCode)) if ((codeCount[c] || 0) < n) codeCapacityOk = false;
    const surplus = prof.objCount - nItems, padded = b.walls - nWalls;
    const cand = { buf, name: b.name, walls: b.walls, oc: prof.objCount, missingCodes: missing, codeCapacityOk, surplus, padded };
    if (missing.length === 0 && codeCapacityOk) {
      if (!best || cand.surplus < best.surplus || (cand.surplus === best.surplus && cand.padded < best.padded)) best = cand;
    }
    if (!fallback || (prof.slots.length > fallback.oc)) fallback = cand; // richest as last resort
  }
  return best || fallback;
}

// PICK THE BASE for the NATIVE-SYMBOL (postype-clean) path — NO code/block edits at all.
// Scores every bundled base with enough walls + slots by how many items land on a slot whose
// NATIVE 11-byte symbol unit already equals the item's ground-truth unit (block-exact → the
// slot renders the item's CORRECT glyph with only pos/dims/type-string edits, the owner's
// proven-safe class). Tie-break: FEWEST surplus slots (fewer to hide off-plan), then fewest
// padded/degenerate walls (avoid the ghost-wall bases the owner flagged), then least slot waste.
// Returns { buf, name, walls, oc, correct, surplus, padded } or null.
function pickBaseForNativeSymbols(items, nWalls) {
  const nItems = items.length;
  // ground-truth unit demanded per item type, with multiplicity
  const wantBlk = {};
  for (const it of items) { const b = gtBlockForType(it.type); if (b) wantBlk[b] = (wantBlk[b] || 0) + 1; }
  const bases = listBases();
  let best = null;
  for (const b of bases) {
    if (b.walls < nWalls) continue;
    const buf = fs.readFileSync(b.file);
    const prof = baseSlotProfile(buf);
    if (prof.objCount < nItems) continue;             // need a slot per item (no append/drop)
    // available native units in this base
    const have = {};
    for (let i = 0; i < prof.objCount; i++) { const blk = slotBlockHex(buf, TABLE_OFF + STRIDE * prof.nW + 20 + i * OBJ_REC); have[blk] = (have[blk] || 0) + 1; }
    let correct = 0;
    for (const [blk, n] of Object.entries(wantBlk)) correct += Math.min(n, have[blk] || 0);
    const surplus = prof.objCount - nItems, padded = b.walls - nWalls;
    const cand = { buf, name: b.name, walls: b.walls, oc: prof.objCount, correct, surplus, padded };
    if (!best
      || cand.correct > best.correct
      || (cand.correct === best.correct && cand.padded < best.padded)
      || (cand.correct === best.correct && cand.padded === best.padded && cand.surplus < best.surplus)) best = cand;
  }
  return best;
}

// The correct/desired symbol code for a type (from its real .bin @0x91, else the mimran
// safe-codes table). Used only for scoring/reporting — never to WRITE a code.
function neededCodeForType(type) {
  const a = itemActualCode(type);
  if (a != null) return a;
  const d = itemDesiredCode(type);
  return d != null ? d : 1;
}

// ---------------------------------------------------------------------------
// Item dictionary + per-type ground-truth records + symbol-code safety
// ---------------------------------------------------------------------------
let _dict = null;
function itemDict() {
  if (!_dict) _dict = require(path.join(__dirname, '..', 'docs', 'ordx_item_dictionary.json')).elements;
  return _dict;
}
function cp1255(s) {
  return Buffer.from([...s].map((c) => { const v = c.charCodeAt(0); return (v >= 0x05D0 && v <= 0x05EA) ? 0xE0 + (v - 0x05D0) : v; }));
}

const _itemRecs = {};
const _itemRecPaths = {};
// DEV-ONLY: the extracted `.bin` element records are not part of the shippable set.
// Returns a path only when an items dir is configured/available (see resolveItemsDir);
// in the shipped product this returns null and pairedSwap harvests from the base instead.
function itemRecordPath(type) {
  const dir = resolveItemsDir();
  if (!dir) return null;
  return path.join(dir, type.replace(/[\\/]/g, '_') + '.bin');
}
function itemRecord(type) {
  if (type in _itemRecs) return _itemRecs[type];
  const p = itemRecordPath(type);
  _itemRecPaths[type] = p;
  _itemRecs[type] = (p && fs.existsSync(p)) ? fs.readFileSync(p) : null;
  return _itemRecs[type];
}
// The AUTHENTIC per-type symbol code, read from the real .bin record's @0x91 (not the
// clamped safe_symbol_codes value). This is the code the item's CORRECT symbol needs.
function itemActualCode(type) {
  const rec = itemRecord(type);
  return rec && rec.length > SYM_OFF ? rec.readUInt8(SYM_OFF) : null;
}
// The type's CANONICAL symbol code — the value @0x91 that the correct symbol needs.
// Authoritative source is GT_CODES (the shipped Soline↔Raumplan library contract); the
// dev-only .bin @0x91 is a fallback. Used by the 921-driver guard (a swap may only set a
// code the base already registers) and by rich-base selection.
function gtCodeForType(type) {
  if (GT_CODES[type] && typeof GT_CODES[type].code === 'number') return GT_CODES[type].code;
  return itemActualCode(type);
}
// PAIRED SWAP: overwrite ONLY the coupled {code + property block} unit of a base slot
// with the type-canonical unit from that type's real .bin record. Position (0x85-0x8a),
// dims (0x79/0x7f), the type string (0x09), all file-specific bytes (0x00-0x90), and the
// slot's own list terminator (0x9c..) are left exactly as the loadable base had them.
// Returns { changed, code, endOff } or null when no .bin exists for the type.
function pairedSwap(buf, off, type, isLastSlot) {
  const rec = itemRecord(type);
  if (!rec || rec.length < OBJ_REC) return null;
  // Base unit is always the type-canonical code+block [0x91,0x9c). For a non-last target
  // sourced from a non-last (`38 0e`) .bin, extend through 0x9f to carry the exact marker
  // form + any type-extra byte (e.g. door `08`). Never touch 0x9c.. of the LAST slot, and
  // never copy an extended-tail (`38 00`) source's terminator into a non-last slot.
  const end = (!isLastSlot && rec[SYM_MARK_OFF] === 0x0e) ? SYM_EXT_END : SYM_BLK_END;
  let changed = false;
  for (let k = SYM_BLK_START; k < end; k++) {
    if (buf[off + k] !== rec[k]) { buf[off + k] = rec[k]; changed = true; }
  }
  return { changed, code: rec.readUInt8(SYM_OFF), endOff: end, src: itemRecordPath(type) };
}

let _safe = null;
function safeCodes() {
  if (!_safe) {
    try { _safe = require(path.join(__dirname, '..', 'templates', 'dr', 'safe_symbol_codes.json')).codes; }
    catch (e) { _safe = {}; }
  }
  return _safe;
}
// Is (type, symbolCode) a combination proven loadable in the MIMRAN corpus (the set
// the owner confirmed loads clean)? Codes from newer 2xxx kitchens are excluded -> E4214.
function isSafeCode(type, code) {
  const s = safeCodes()[type];
  return Array.isArray(s) && s.includes(code);
}

let _subs = null;
function subMap() {
  if (!_subs) {
    try { _subs = require(path.join(__dirname, '..', 'templates', 'dr', 'safe_substitutions.json')).map || {}; }
    catch (e) { _subs = {}; }
  }
  return _subs;
}

// ---------------------------------------------------------------------------
// Collect ORDX items with world placement + mapped PDP type.
// ---------------------------------------------------------------------------
// ANCHOR / CENTERING — PER ELEMENT TYPE (2026-08-22, corpus-derived byte-exact).
// The APP's OrdxExporter writes each item's Position as `X=fromLeft, Y=fromBottom`
// (the item's lower-LEFT CORNER along/up the wall). Raumplan then stores, in the 173-B
// record @0x85/0x89, ONE of two points depending on the element TYPE — NOT a global rule
// (the earlier blanket "always center" was WRONG for the offset-anchored types, off by
// ~W/2: a gross ≈450-500 mm error on 900 mm doors / 1000 mm windows / channels):
//   * CENTER-anchored types  — the small MEP POINT symbols that carry a DASHED
//     center-dimension line in Raumplan (socket שקע, switch מפסק, junction box ק.בקורת,
//     faucet ברז). Their record stores the CENTER: corner + W/2 along, + H/2 up.
//   * OFFSET-anchored types  — openings, fixtures and line/infra symbols dimensioned to
//     their EDGE (no dashed center-dim): door דלת, window חלון, shutter box ארגז תריס,
//     window sill אדן חלון, safety-room opening חור.פ.ממד, power box ק.חשמל, power line
//     צ.חשמל, channel/structure תעלה, sewage/drain פ.ביוב / ביוב קיר / ביוב, wet fixtures
//     מים משולב / אסלה, water line צ.מים, ceiling light תאורה. Their record stores the raw
//     CORNER (fromLeft, fromBottom) — NO half-dim added.
// Derivation + evidence (which corpus record each verdict came from, dashed-center-dim
// correlation, ambiguous types) live in docs/PDP_ANCHOR_TABLE.md. This is the Soline↔
// Raumplan library anchor contract. Corpus proof (mimran-1..9, own-base rebuild): CENTER
// types stay byte-exact incl. position (66/73, no regression); OFFSET types go from 0/64
// to 21/64 byte-exact — every big opening (door/window/power box/shutter box/channel)
// now reproduces its corpus record to the byte. Default when a type is not listed = OFFSET
// (the safe direction: an unproven type's marker is at worst half its own small footprint
// off, never half a door).
//
// CENTER-anchored element types (record stores corner + W/2, H/2). Everything else = OFFSET
// (record stores the raw corner).
//
// GROUND-TRUTH RESOLUTION (2026-08-23, elemets_Bar_Terra-Nova_Yosi_DR1 — the multi-format
// "Rosetta Stone" the owner supplied: the SAME 40-object room exported to .pdp/.ordx/.dxf/
// .xml/.rpi/.elc). Decoding it and cross-referencing the ORDX corner positions against the
// PDP stored positions on the Z (up-the-wall) axis — which has NO rotation/flip ambiguity —
// gave a byte-clean anchor read per type (docs/ELEMENT_LIBRARY_MASTER.md). It CONFIRMED every
// corpus verdict (socket/switch/junction/faucet = CENTER cen-residual 0; door/window/sill/
// shutterbox/power-box = OFFSET off-residual 0) and RESOLVED the previously-ambiguous types:
//   * גז  (gas, code 6)      -> CENTER  (Z cen-residual 0, exact; a 100×100 point symbol, same
//                                        family as ק.בקורת). This was the anchor table's #1
//                                        calibration candidate — now PROVEN.
//   * אנטנה (TV/antenna, 3), טלפון (phone, 4) -> CENTER (Z cen-residual 0, exact; small MEP
//                                        point symbols, same family as שקע/מפסק).
// Kept OFFSET (ground-truth Z-read): תאורה (light, off-resid ≈0), אינטרקום (intercom), and all
// large fixtures/openings. צ.מים / ביוב lean CENTER by ≤10 mm on 20–50 mm elements (within a
// symbol width — immaterial) and stay OFFSET to match their corpus-proven code-1 sibling צ.חשמל.
// אסלה is absent from this file and remains OFFSET pending its own sample.
const ANCHOR_CENTER = new Set(['שקע', 'מפסק', 'ק.בקורת', 'ברז', 'גז', 'אנטנה', 'טלפון']);
function itemAnchor(type) { return ANCHOR_CENTER.has(type) ? 'center' : 'offset'; }

// ---------------------------------------------------------------------------
// PERPENDICULAR (into-room stand-off) — the 3rd ORDX position axis, corpus-decoded 2026-08-24.
// ---------------------------------------------------------------------------
// The app's OrdxExporter writes each placed item's <Position> as THREE numbers, not two:
//   X = along-wall distance from the wall START corner (mm)   -> the `along` axis
//   Y = height up the wall (mm)                               -> the `up`/Z axis (stored @0x89)
//   Z = PERPENDICULAR distance the item stands off the wall face, INTO the room (mm)
// The previous converter dropped Z entirely, gluing every item to the wall CENTRELINE. That is
// correct for flush wall points (sockets/switches/faucets — Z absent) and for in-plane openings
// (window/door — Z is a small frame-protrusion, NOT a plan inset), but WRONG for the fixtures that
// genuinely stand off the wall: a ceiling light 447-1521 mm into the room, a power box 200 mm proud,
// a power line 800 mm in, a floor drain ~2 m in, the safety-room opening 300 mm proud. Those landed
// on the wall instead of where they were measured.
//
// Ground-truth decode (elemets_Bar_Terra-Nova_Yosi_DR1 Rosetta + mimran-1, own-base rebuild, stored
// X/Y matched to the byte): the GT record's perpendicular offset from the wall line == ORDX `Z`
// exactly for צ.חשמל(Power Line, 800), ק.חשמל(Power Box, 200), חור.פ.ממד(Safety Room, 300),
// פ.ביוב(drain, ~Z); CENTER wall points carry no Z (perp 0); and the in-plane openings below must
// IGNORE Z (their Z=-100 is frame protrusion; GT keeps them on the wall line). Applying `perp = Z`
// along the wall's INWARD normal (toward the room centroid) reproduces those records and moves
// mimran-1's two ceiling lights from ~450/1521 mm wrong (on the wall) to within the light's own
// fixed stand-off of GT. See docs/PDP_ANCHOR_TABLE.md §Perpendicular.
//
// In-plane opening types whose ORDX Z is frame-protrusion, NOT a plan inset — perp forced to 0:
const PERP_INPLANE = new Set(['חלון', 'דלת', 'ארגז תריס', 'אדן חלון']);
function itemUsesPerp(type) { return !PERP_INPLANE.has(type); }

// Centroid of all wall endpoints (the room's interior reference) — used to orient each wall's
// perpendicular so a positive ORDX Z pushes the item INTO the room, for any wall orientation.
function wallsCentroid(walls) {
  let x = 0, y = 0, n = 0;
  for (const w of walls) {
    const p = w.position; if (!p) continue;
    x += p.startX + p.endX; y += p.startY + p.endY; n += 2;
  }
  return n ? [x / n, y / n] : [0, 0];
}

function collectItems(walls) {
  const dict = itemDict();
  const items = [];
  const [ccx, ccy] = wallsCentroid(walls);
  for (const w of walls) {
    const p = w.position, dx = p.endX - p.startX, dy = p.endY - p.startY, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    // Inward normal (unit), oriented toward the room centroid so +perp = into the room.
    let nx = -uy, ny = ux;
    const mx = (p.startX + p.endX) / 2, my = (p.startY + p.endY) / 2;
    if ((ccx - mx) * nx + (ccy - my) * ny < 0) { nx = -nx; ny = -ny; }
    const pushItem = (el) => {
      const type = dict[el.name]; if (!type) return;
      const W = Math.round((el.size && el.size.width) || 100);
      const H = Math.round((el.size && el.size.height) || 100);
      const D = Math.round((el.size && el.size.depth) || 0);
      const alongCorner = (el.position && el.position.x) || 0;   // fromLeft (corner)
      const upCorner = (el.position && el.position.y) || 0;      // fromBottom (corner)
      // Perpendicular stand-off INTO the room. Present only for set-back fixtures; forced to 0 for
      // flush points (Z absent) and for in-plane openings (Z = frame protrusion, not a plan inset).
      const perpRaw = (el.position && el.position.z != null) ? el.position.z : 0;
      const perp = itemUsesPerp(type) ? perpRaw : 0;
      const anchor = itemAnchor(type);                           // per-type: 'center' | 'offset'
      const center = anchor === 'center';
      const along = alongCorner + (center ? W / 2 : 0);          // CENTER -> +W/2 ; OFFSET -> raw corner
      const up = upCorner + (center ? H / 2 : 0);                // CENTER -> +H/2 ; OFFSET -> raw corner
      items.push({ type, name: el.name, anchor,
        wx: p.startX + along * ux + perp * nx,                   // along the wall + perpendicular into room
        wy: p.startY + along * uy + perp * ny,
        height: up, up, W, H, D, alongCorner, upCorner, along, perp });
    };
    for (const fx of (w.fixtures || [])) pushItem(fx);
    for (const fn of (w.furnishings || [])) pushItem(fn);
  }
  return items;
}

// ---------------------------------------------------------------------------
// stampItemRecord — LEGACY (whole-record replacement, the E4214 cause). Kept for
// back-compat with older callers/tests ONLY; the current PDP path never calls it.
// Produces a 173-B record from a corpus blob, stamping the position triple. Do NOT
// use for output — swapping in a foreign record triggers E4214 (see header).
// ---------------------------------------------------------------------------
function stampItemRecord(bin, it, Cx, Cy, opts = {}) {
  const b = Buffer.from(bin);
  b.writeInt16LE(Math.round(it.wx + Cx), OBJ_POS);
  b.writeInt16LE(Math.round(-it.wy + Cy), OBJ_POS + 2);
  b.writeInt16LE(Math.round((it.up != null ? it.up : it.height) - 20000), OBJ_POS + 4);
  for (let k = 0x8b; k <= 0x90; k++) b[k] = 0;
  if (opts.overrideDims) {
    for (const off of [OBJ_DIM_OFF, OBJ_DIM2_OFF]) {
      b.writeInt16LE(it.W, off); b.writeInt16LE(it.D || 10, off + 2); b.writeInt16LE(it.H, off + 4);
    }
  }
  return b;
}

// ---------------------------------------------------------------------------
// גודל-אלמנט: קבוע (native) מול משתנה (שלנו) — הפיצוח של 2026-08-25.
// ---------------------------------------------------------------------------
// אושר ע"י הבעלים בבדיקה חיה ב-Raumplan (docs/PDP_SIZE_CLASSIFICATION.md). ב-Raumplan כל
// אלמנט שייך לאחת משתי משפחות-גודל:
//   🔒 קבוע  — Raumplan מצייר אותו בגודל-ה-native הקבוע שלו. אם נכתוב את המידות שלנו,
//              הגליף יוצא מעוות/מוטה (הבאג שהבעלים ראה: המיקום נכון, האייקון מסובב).
//              → להזריק מיקום בלבד ולשמר את בייטי-הגודל ה-native של הסלוט [0x79,0x85).
//   🎚️ משתנה — Raumplan לוקח את המידות שלנו → לכתוב מיקום + מידות כמו היום.
// ציר-הגודל נפרד לחלוטין מציר-העוגן (ANCHOR_CENTER/OFFSET). הבייטים הנשמרים הם שתי
// שלישיות [W,D,H] int16 @0x79 ו-@0x7f (יחד [0x79,0x85)) — הגדלים ה-native נפוענחו מבסיס-
// האב DR ל-analysis/out/native_fixed_sizes.json.
//
// SIZE_FIXED — סט הטיפוסים 🔒 (גודל-קבוע). כולל את צורות-ה-'+' של GT_CODES כשם-נרדף.
// ⚠️ ק.חשמל (קופסת-חשמל, code 3): מוגדר משתנה 🎚️ לפי הסיווג הנוכחי — אך מסומן לאישור-סופי
// מול הבעלים. אם הבעלים יאשר שהיא קבועה, הוסף כאן 'ק.חשמל' (המתג בשורה-אחת למטה).
const SIZE_FIXED = new Set([
  'שקע', '+שקע',
  'מפסק', '+מפסק',
  'ברז',
  'גז',
  'טלפון', '+טלפון',
  'אנטנה',
  'ק.בקורת',
  'תאורה',
  'מים משולב',
  // 'ק.חשמל',   // ⚠️ מתג-אישור-בעלים: בטל-הערה כדי להפוך את ק.חשמל לגודל-קבוע (ראה הערה מעל)
]);
function isSizeFixed(type) { return SIZE_FIXED.has(type); }

// ---------------------------------------------------------------------------
// ➕ SIZE_PLUS — מנגנון-ה-"+X" (socket-plus): טיפוס-גליף-נעול שנושא מידה-מותאמת שלנו.
// ---------------------------------------------------------------------------
// פוצח בייט-אחר-בייט מ-`sheka+_Bar2_Terra-Nova_Yosi_DR1.pdp` (docs/PDP_SOCKET_PLUS.md,
// analysis/decode_socket_plus.js → analysis/out/socket_plus.json). שדה-המידות ברשומת-173B הוא
// **שתי שלישיות [W,D,H] int16**: `t1 @0x79` = גודל-הרפרנס/native שנועל את הגליף (אייקון-נכון,
// ללא-הטיה), `t2 @0x7f` = ה-footprint המצויר בפועל. "+X" = לקחת סלוט-X רגיל (🔒 native), לשמר את
// `t1` על ה-native של X (הגליף נעול = code של X מצויר נכון), ולכתוב את המידה-המותאמת שלנו ל-`t2`
// בלבד, עם label `+X`. **אין 921** — `[0x91,0x9c)` (code+block) נשאר זהה-בייט לסלוט-X.
//
// הסט "+"-capable (הבעלים אישר שקיימים בספריית-Raumplan). דרגות-הוודאות:
//   • שקע — **מאומת-בייט** מול דגימת-בעלים אמיתית (שני +שקע נבדלים מוכיחים ש-t2 נושא מידה-שלנו
//     משתנה: בסיס t2=[500,0,500] מול ייצוא-בעלים t2=[800,0,600]).
//   • מפסק / טלפון / מזגן / חור איורור — מבנה-ה-t1/t2 **סביר-מאוד-זהה** (הבסיס אף מכיל native
//     +מפסק/+טלפון), אך **טרם-מאומת מול דגימת-בעלים אמיתית** שמוכיחה ש-t2 מקבל מידה שרירותית
//     שלנו. ⚠️ PENDING REAL-SAMPLE BYTE-VERIFICATION — עד שהבעלים ימסור "+X" בגודל לא-סטנדרטי.
// גז — **אין** לו "+" (לא בסט). כל שאר-התשתית נשארת 🔒/🎚️ כרגיל.
const SIZE_PLUS = new Set([
  'שקע',            // ✅ byte-verified מול דגימת-בעלים
  'מפסק',           // ⚠️ pending real-sample byte-verification
  'טלפון',          // ⚠️ pending real-sample byte-verification
  'מזגן',           // ⚠️ pending real-sample byte-verification
  'חור איורור',     // ⚠️ pending real-sample byte-verification (איית-GT: "איורור")
]);
function isSizePlus(type) { return SIZE_PLUS.has(type); }
// האם הטיפוס "+"-capable-מאומת (שקע בלבד היום) — לדיווח/הבחנה בין מוכח-לסביר.
const SIZE_PLUS_VERIFIED = new Set(['שקע']);
function isSizePlusVerified(type) { return SIZE_PLUS_VERIFIED.has(type); }

// ---------------------------------------------------------------------------
// IN-PLACE editing — the breakthrough path. We NEVER build or copy a whole record;
// we mutate ONLY the named fields of a base slot's own bytes, leaving the record's
// file-specific id/version (and everything else) exactly as the loadable base had it.
// ---------------------------------------------------------------------------

// Read a base slot's current type string (cp1255) — for assignment + write-if-different.
function slotType(buf, off) {
  let s = '';
  for (let k = OBJ_TYPE_OFF; k < OBJ_TYPE_END; k++) {
    const c = buf[off + k];
    if (c === 0) break;
    s += (c >= 0xE0 && c <= 0xFA) ? String.fromCharCode(0x05D0 + (c - 0xE0)) : String.fromCharCode(c);
  }
  return s;
}
function slotCode(buf, off) { return buf.readUInt8(off + SYM_OFF); }

// The slot's 11-byte SYMBOL unit [0x91,0x9c) = code(2)+block(9), as a lowercase hex string
// ("01 00 00 04 ..."). This is the TYPE-CANONICAL glyph selector. Two slots with the SAME
// unit render the SAME symbol regardless of their type string — so routing an item to a slot
// whose native unit equals the item's ground-truth unit yields the CORRECT NATIVE symbol with
// ZERO code/block edits (only pos/dims/type-string change → the owner's proven-safe postype class).
function slotBlockHex(buf, off) {
  let s = '';
  for (let k = SYM_BLK_START; k < SYM_BLK_END; k++) { if (s) s += ' '; s += buf[off + k].toString(16).padStart(2, '0'); }
  return s;
}
// The type's ground-truth 11-byte symbol unit (the correct glyph), from GT_CODES. null when
// the type has no ground-truth entry (then no block-exact native slot can be claimed for it).
function gtBlockForType(type) { return GT_CODES[type] ? GT_CODES[type].block : null; }

// The set of symbol codes the base ALREADY contains among its own item records.
// A record's code is only ever set to a member of this set (never an unknown code).
function baseCodeSet(buf, o0, objCount) {
  const s = new Set();
  for (let i = 0; i < objCount; i++) s.add(slotCode(buf, o0 + i * OBJ_REC));
  return s;
}
// Clamp a desired symbol code to the base's own set. Out-of-set codes map to the
// nearest in-base equivalent: 4 (switch) -> a point symbol if present; anything
// unknown -> code 1 (generic infrastructure point) if present, else code 3.
function clampCode(desired, codeSet) {
  if (desired != null && codeSet.has(desired)) return desired;
  if (desired === 4 && codeSet.has(3)) return 3;   // switch -> socket-point symbol
  if (codeSet.has(1)) return 1;                    // generic infra point
  if (codeSet.has(3)) return 3;
  return [...codeSet][0];                           // last resort: any in-base code
}

// Write a cp1255 type string into a base slot IN PLACE, clearing only the old
// string's bytes within [0x09, 0x1e) — never touching the 0x23 field @0x1e onward.
function writeSlotType(buf, off, type) {
  const enc = cp1255(type);
  const room = OBJ_TYPE_END - OBJ_TYPE_OFF - 1; // leave room for a null terminator
  const n = Math.min(enc.length, room);
  for (let k = 0; k < n; k++) buf[off + OBJ_TYPE_OFF + k] = enc[k];
  for (let k = n; k < OBJ_TYPE_END - OBJ_TYPE_OFF; k++) buf[off + OBJ_TYPE_OFF + k] = 0; // clear old tail up to 0x1e
}

// Edit ONE base slot in place for item `it`. Returns which fields were actually
// changed (write-if-different keeps the diff minimal and self-tests byte-exact).
function editSlotInPlace(buf, off, it, Cx, Cy, codeSet, opts = {}, isLastSlot = false) {
  const changed = { pos: true, dims: false, type: false, code: false, symbol: false, native: false, sizeFixed: false, plus: false, swapCode: null, swapSrc: null, symbolBlocked: null };

  // position — ALWAYS written (geometry; proven safe, same class as wall edits).
  buf.writeInt16LE(Math.round(it.wx + Cx), off + OBJ_POS);
  buf.writeInt16LE(Math.round(-it.wy + Cy), off + OBJ_POS + 2);
  buf.writeInt16LE(Math.round((it.up != null ? it.up : it.height) - 20000), off + OBJ_POS + 4);

  // ---------------------------------------------------------------------------
  // dims — עץ-ההחלטה של הגודל: ➕ "+X"  /  🔒 קבוע  /  🎚️ משתנה  (2026-08-25).
  // ---------------------------------------------------------------------------
  // סדר-הקדימות (מדויק, גובר על SIZE_FIXED עבור טיפוסי-SIZE_PLUS):
  //   ➕ "+X"      : isSizePlus(type) && opts.emitPlus && מידה-מותאמת (≠ native-GT)
  //                  → משמרים `t1 @0x79` native (נועל את הגליף), כותבים `t2 @0x7f` = המידה-שלנו
  //                    [W,D,H], וה-label יוצא `+X`. **לא נוגעים ב-[0x91,0x9c)** (code+block זהה →
  //                    אין 921, אותו אייקון). זה בדיוק מה ש-Raumplan עושה ל-+שקע/+מפסק/+טלפון.
  //   🔒 קבוע      : (isSizePlus(type) && opts.emitPlus && מידה=native/חסרה)  ||  isSizeFixed(type)
  //                  → לא כותבים כלום ל-[0x79,0x85); משמרים את בייטי-הגודל ה-native של הסלוט
  //                    → Raumplan מצייר את הגליף בגודלו-הקבוע (אין עיוות/הטיה).
  //   🎚️ משתנה     : כל השאר → write-if-different לשתי השלישיות [W,D,H] (nominal + actual), כמו היום.
  // הערה: emitPlus הוא **opt-in** (ברירת-מחדל כבויה). כשהוא כבוי, טיפוסי-SIZE_PLUS מתנהגים בדיוק
  //       כמו קודם (🔒 אם ב-SIZE_FIXED, אחרת 🎚️) — כך שאף נתיב-המרה קיים לא משתנה. הצורות ➕
  //       מפסק/טלפון/מזגן/חור-איורור מסומנות PENDING עד אימות-בייט מול דגימת-בעלים אמיתית.
  const dVal = it.D != null ? it.D : 10;
  const nativeDims = GT_CODES[it.type] && GT_CODES[it.type].dims;   // גודל-native-GT של הטיפוס
  const hasDims = it.W != null && it.H != null;
  const customSize = hasDims && (!nativeDims || it.W !== nativeDims[0] || dVal !== nativeDims[1] || it.H !== nativeDims[2]);
  const wantPlus = opts.emitPlus === true && isSizePlus(it.type);

  if (wantPlus && customSize) {
    // ➕ "+X": משמרים t1 native (לא כותבים [0x79,0x7f)), כותבים t2 = המידה-המותאמת שלנו.
    const t2 = [it.W, dVal, it.H];
    for (let j = 0; j < 3; j++) {
      if (buf.readInt16LE(off + OBJ_DIM2_OFF + j * 2) !== t2[j]) { buf.writeInt16LE(t2[j], off + OBJ_DIM2_OFF + j * 2); changed.dims = true; }
    }
    changed.plus = true;   // ה-label ייכתב כ-`+X` בבלוק-ה-type למטה
  } else if (isSizeFixed(it.type) || (wantPlus && !customSize)) {
    changed.sizeFixed = true;   // 🔒 בייטי-הגודל [0x79,0x85) נשארים native — לא נגענו בהם
  } else if (opts.editDims !== false && hasDims) {
    const want = [it.W, it.D || 10, it.H];
    for (const dOff of [OBJ_DIM_OFF, OBJ_DIM2_OFF]) {
      for (let j = 0; j < 3; j++) {
        if (buf.readInt16LE(off + dOff + j * 2) !== want[j]) { buf.writeInt16LE(want[j], off + dOff + j * 2); changed.dims = true; }
      }
    }
  }

  // type string — write-if-different. עבור פליטת ➕ "+X" ה-label הוא הצורה `+X` (ליבת-המנגנון:
  // זה מה שגורם ל-Raumplan להציג את הווריאנט-מותאם-הגודל), ונכתב תמיד; אחרת הטיפוס-הרגיל, מגודר
  // ע"י editType.
  const label = changed.plus ? ('+' + it.type) : it.type;
  if ((changed.plus || opts.editType !== false) && label && slotType(buf, off) !== label) {
    writeSlotType(buf, off, label);
    changed.type = true;
  }

  // symbol code — DEFAULT OFF (opt-in via editCode:true). The code @0x91 is COUPLED
  // to the per-class property sub-block @0x92-0x9b (socket/door/window/light each carry
  // a different block, terminated by the constant `38 0e` marker @0x9c). Changing the
  // code without rewriting that block desyncs the property list -> Raumplan E4048
  // ("property got a zero value; property #64, list has 14"). Keeping each slot's own
  // (code, block) pair is self-consistent by construction. When enabled, the code is
  // still CLAMPED to the base's own code set.
  // symbol PAIRED SWAP — the "correct symbol" path (opt-in via editSymbol:true). Copies
  // the type-canonical {code + property block} unit from the item type's real .bin as ONE
  // self-consistent unit (never a bare code -> no E4048), keeping the base's terminator and
  // all file-specific bytes (no cross-file id/version -> no E4214). A slot whose native
  // (code,block) already equals the .bin's is a NATIVE match (no bytes change -> proven-safe
  // pure in-place). Supersedes the legacy clamped editCode path when both are set.
  if (opts.editSymbol === true && it.type) {
    // 921 DRIVER GUARD (decoded 2026-08-24). The ONLY isolated difference between a
    // loadable postype file and a 921 file (both on the same base, Section E byte-
    // identical) is the item-slot symbol CODE @0x91: a slot may only carry a code that
    // the base file ALREADY registers among its own slots (its native distinct-code set).
    // Section E holds NO code/block reference (block-copy / code-sequence / distinct-set
    // scans all negative), and loadable files freely carry MULTIPLE blocks per code
    // (mimran-1 loads with 2 blocks for code1 & code3; the Rosetta file with 8 for code1)
    // — so the BLOCK is free to vary WITHIN a registered code, but introducing a NEW code
    // value is what "reorganizes the list" -> 921 (this is exactly why allelem_master, built
    // on wall4_oc17 which lacks codes 4/6, 921'd when its gas/switch swaps introduced them).
    // Therefore: apply the paired swap ONLY when the type's canonical code is already in the
    // base's native set. Otherwise keep the slot native (correct code-FAMILY fallback) and
    // flag it — the correct symbol for that type is unreachable on this base without a
    // richer base (one that natively registers the code, e.g. wall4_oc40 for gas code 6).
    const wantCode = gtCodeForType(it.type);
    if (wantCode != null && !codeSet.has(wantCode)) {
      changed.symbolBlocked = wantCode;   // correct symbol needs a code this base lacks
    } else {
      const sw = pairedSwap(buf, off, it.type, isLastSlot);
      if (sw) {
        changed.swapCode = sw.code;
        changed.swapSrc = sw.src;
        if (sw.changed) changed.symbol = true; else changed.native = true;
      }
    }
  } else if (opts.editCode === true) {
    const desired = itemDesiredCode(it.type);
    const code = clampCode(desired, codeSet);
    if (code != null && slotCode(buf, off) !== code) { buf.writeUInt8(code, off + SYM_OFF); changed.code = true; }
  }
  return changed;
}

// Desired PDP symbol code for a type, from the mimran-proven table (or null).
function itemDesiredCode(type) {
  const s = safeCodes()[type];
  return Array.isArray(s) && s.length ? s[0] : null;
}

// Assign items to base slots to MINIMISE the diff. Greedy in passes:
//   1) a free slot whose type already equals the item's type (only position changes)
//   1b) [opts.preferBlock] a free slot whose native 11-byte SYMBOL UNIT equals the item's
//       ground-truth unit — a CORRECT NATIVE symbol on a differently-labelled slot (only the
//       type-string is relabelled; the glyph is already right, ZERO code/block edits). This is
//       what maximises symbol-correct placements on a rich base (e.g. צ.מים onto a צ.חשמל slot,
//       תעלה onto a עמוד/אדן-חלון slot — identical code-1 unit → identical glyph).
//   2) a free slot whose code already equals the item's clamped target code (family fallback)
//   3) any remaining free slot (type + code get relabelled)
// Returns [{ itemIndex, slotIndex, matchKind, nativeType, nativeCode }] for the first
// min(items, objCount) items. matchKind 'exact' = type-string already equals (pass 1);
// 'symbol' = block-exact native glyph, relabelled (pass 1b); 'family'/'fallback' as before.
function assignSlots(buf, o0, objCount, items, codeSet, opts = {}) {
  const slots = [];
  for (let i = 0; i < objCount; i++) slots.push({ i, off: o0 + i * OBJ_REC, type: slotType(buf, o0 + i * OBJ_REC), code: slotCode(buf, o0 + i * OBJ_REC), block: slotBlockHex(buf, o0 + i * OBJ_REC), used: false });
  const n = Math.min(items.length, objCount);
  const assign = new Array(n).fill(-1);
  const kind = new Array(n).fill('fallback');       // 'exact' | 'symbol' | 'family' | 'fallback'
  const natType = new Array(n).fill(null);          // the slot's NATIVE type (its rendered symbol)
  const natCode = new Array(n).fill(null);          // the slot's NATIVE symbol code

  const takeBy = (pred) => { const s = slots.find((s) => !s.used && pred(s)); if (s) { s.used = true; return s; } return null; };
  const record = (k, s, kd) => { assign[k] = s.i; kind[k] = kd; natType[k] = s.type; natCode[k] = s.code; };
  // pass 1: exact TYPE match — the slot's native (code + block + string) already IS the
  // item's correct symbol. Pure in-place (pos/dims only), the proven-safe path; zero swaps.
  for (let k = 0; k < n; k++) { const t = items[k].type; const s = takeBy((s) => s.type === t); if (s) record(k, s, 'exact'); }
  // pass 1b: block-exact NATIVE-SYMBOL match (opt-in). Route to a slot whose native symbol unit
  // already equals the item type's ground-truth unit even though the type string differs — the
  // rendered glyph is correct with no code/block edit (only the label is fixed via the safe
  // type-string write). Skipped without opts.preferBlock so existing callers keep prior behaviour.
  if (opts.preferBlock || opts.nativeSymbols) {
    for (let k = 0; k < n; k++) {
      if (assign[k] >= 0) continue;
      const want = gtBlockForType(items[k].type);
      if (!want) continue;
      const s = takeBy((s) => s.block === want);
      if (s) record(k, s, 'symbol');
    }
  }
  // pass 2: native CODE-FAMILY match (the item's real .bin code, unclamped) — the slot
  // renders the CORRECT symbol FAMILY (same class code) though a different member. In the
  // postype path this keeps the slot's native code+block byte-exact -> a sensible, safe
  // fallback symbol that shares the item's class (e.g. תעלה/צ.חשמל -> a code-1 infra slot).
  for (let k = 0; k < n; k++) {
    if (assign[k] >= 0) continue;
    const want = itemActualCode(items[k].type);
    const wantClamped = want != null ? want : clampCode(itemDesiredCode(items[k].type), codeSet);
    const s = takeBy((s) => s.code === wantClamped);
    if (s) record(k, s, 'family');
  }
  // pass 3: any free slot — closest available native symbol (logged as a true fallback).
  for (let k = 0; k < n; k++) { if (assign[k] >= 0) continue; const s = takeBy(() => true); if (s) record(k, s, 'fallback'); }
  const out = [];
  for (let k = 0; k < n; k++) if (assign[k] >= 0) out.push({ itemIndex: k, slotIndex: assign[k], matchKind: kind[k], nativeType: natType[k], nativeCode: natCode[k] });
  return out;
}

// ---------------------------------------------------------------------------
// convertRoomDRv2 — the ONE PDP path. A KNOWN-LOADABLE real base is kept intact;
// ONLY the wall table and (in place) the reused item slots' named fields change.
//
// opts:
//   baseBuf     Buffer   caller-supplied base (else best-fit bundled base)
//   noReverse   bool     keep item order (default: reversed, matching wall reversal)
//   wallsOnly   bool     PROBE: overwrite ONLY the wall table; leave every item slot
//                        byte-for-byte (isolates whether wall edits alone are safe)
//   editType    bool     default ON  — relabel the slot's type string @0x09
//   editDims    bool     default ON  — overwrite the [W,D,H] triples @0x79/0x7f
//   editCode    bool     default OFF — relabel the symbol code @0x91. OFF because the
//                        code is coupled to the per-class property block @0x92-0x9b;
//                        changing it desyncs the property list -> E4048 (owner load-test
//                        2026-08-21). Keep each slot's own code+block (self-consistent).
// ---------------------------------------------------------------------------
function convertRoomDRv2(room, opts = {}) {
  const walls = room.walls;
  const warnings = [];

  // items first (need the count to choose the tightest-fit base)
  const itemsRaw = collectItems(walls);
  const items = opts.noReverse ? itemsRaw : itemsRaw.slice().reverse();

  // choose a REAL base: caller override (opts.baseBuf) else best-fit bundled base.
  let baseInfo = null;
  let template;
  if (opts.baseBuf) {
    template = opts.baseBuf;
  } else if (opts.nativeSymbols === true) {
    // NATIVE-SYMBOL (postype-clean) path: NO code/block edits anywhere. Pick the base that
    // maximises how many items land on a slot whose NATIVE symbol unit is already the item's
    // correct glyph (block-exact), then the fewest surplus slots, then fewest padded walls.
    const pick = pickBaseForNativeSymbols(items, walls.length);
    if (pick) { template = pick.buf; baseInfo = { buf: pick.buf, name: pick.name, walls: pick.walls, oc: pick.oc, exactWalls: pick.walls === walls.length }; }
    else { baseInfo = loadBase(walls.length, items.length); template = baseInfo.buf; }
  } else if (opts.editSymbol === true) {
    // CORRECT-SYMBOL path: pick a base whose NATIVE code set covers every item's canonical
    // code (the 921-driver requirement) with the fewest surplus slots. Falls back to the
    // richest base if no full-coverage base exists (the 921-guard then keeps the uncovered
    // items as correct-family fallback rather than risking a non-native code -> 921).
    const pick = pickBaseForSymbols(items, walls.length);
    if (pick) { template = pick.buf; baseInfo = { buf: pick.buf, name: pick.name, walls: pick.walls, oc: pick.oc, exactWalls: pick.walls === walls.length }; }
    else { baseInfo = loadBase(walls.length, items.length); template = baseInfo.buf; }
  } else {
    baseInfo = loadBase(walls.length, items.length);
    template = baseInfo.buf;
  }

  // (1) wall table @0xd4 — the only geometry region rewritten. Proven byte-exact.
  const { buf, Cx, Cy, paddedWalls } = writeWallsDR(template, walls, opts);

  const nW = buf.readInt16LE(COUNT_OFF);
  const cOff = TABLE_OFF + STRIDE * nW;
  const objCount = buf.readUInt32LE(cOff);
  const o0 = cOff + 20;

  if (paddedWalls > 0) {
    warnings.push(`room has ${walls.length} walls but nearest base has ${nW}; padded ${paddedWalls} surplus wall slot(s) as degenerate (invisible). An exact wall${walls.length} base would be cleaner.`);
  }

  // (2) item slots — EDIT IN PLACE. Never replace a record; keep each record's
  //     file-specific bytes exactly as the loadable base had them. Symbol codes are
  //     only ever set to a value the base already contains (baseCodeSet).
  const codeSet = baseCodeSet(buf, o0, objCount);
  let placed = 0, typeEdits = 0, codeEdits = 0, dimEdits = 0, dropped = 0, leftAsIs = 0, sizeFixedKept = 0;
  let plusEmitted = 0;               // ➕ כמה פריטים נפלטו כ-"+X" (t1 native + t2 מותאם)
  const plusReport = [];             // [{ type, plusType, slotIndex, t2 }]
  let symbolSwaps = 0, nativeSymbols = 0, symbolBlocked = 0;
  const symbolBlockedTypes = [];
  let exactSymbols = 0, familySymbols = 0, fallbackSymbols = 0;
  // NATIVE-SYMBOL (postype-clean) tallies: correctSymbols = items whose assigned slot's native
  // glyph is already the correct symbol (block-exact; zero code/block edits). symbolNativeSymbols
  // = the subset reached by the block-exact relabel pass (pass 1b, different type string).
  let correctSymbols = 0, symbolNativeSymbols = 0;
  const symbolReport = []; // [{ type, slotIndex, code, native, source }]
  const mapReport = [];    // [{ item, itemType, slotIndex, nativeType, nativeCode, matchKind, along, up, X, Y, Z }]

  if (opts.wallsOnly) {
    // PROBE mode: touch NO item slot. Every record stays byte-for-byte.
    leftAsIs = objCount;
    warnings.push('wallsOnly PROBE: item records left byte-for-byte; only the wall table was rewritten.');
  } else {
    const assign = assignSlots(buf, o0, objCount, items, codeSet, opts); // [{itemIndex, slotIndex, matchKind, nativeType, nativeCode}]
    const usedSlot = new Set();
    for (const { itemIndex, slotIndex, matchKind, nativeType, nativeCode } of assign) {
      const it = items[itemIndex];
      const off = o0 + slotIndex * OBJ_REC;
      const isLastSlot = slotIndex === objCount - 1;
      // Whether this slot's NATIVE symbol unit already renders the item's correct glyph
      // (block-exact) — read BEFORE the edit; the postype path never touches [0x91,0x9c), so
      // the output glyph equals the native one. This is the load-safe "correct symbol" count.
      const blockCorrect = gtBlockForType(it.type) != null && slotBlockHex(buf, off) === gtBlockForType(it.type);
      const ch = editSlotInPlace(buf, off, it, Cx, Cy, codeSet, opts, isLastSlot);
      placed++; usedSlot.add(slotIndex);
      if (ch.type) typeEdits++;
      if (ch.code) codeEdits++;
      if (ch.dims) dimEdits++;
      if (ch.sizeFixed) sizeFixedKept++;   // 🔒 טיפוס גודל-קבוע: בייטי-הגודל native נשמרו
      if (ch.plus) {                        // ➕ נפלט כ-"+X": t1 native נשמר, t2 = המידה-שלנו
        plusEmitted++;
        plusReport.push({ type: it.type, plusType: '+' + it.type, slotIndex,
          t2: [buf.readInt16LE(off + OBJ_DIM2_OFF), buf.readInt16LE(off + OBJ_DIM2_OFF + 2), buf.readInt16LE(off + OBJ_DIM2_OFF + 4)] });
      }
      if (blockCorrect) correctSymbols++;
      if (matchKind === 'exact') exactSymbols++; else if (matchKind === 'symbol') symbolNativeSymbols++; else if (matchKind === 'family') familySymbols++; else fallbackSymbols++;
      // Per-item mapping: which NATIVE slot (its rendered symbol) each item landed on, and
      // the centered plan position we wrote. matchKind: exact=native symbol IS the item's
      // type; family=same class code (closest correct-family symbol); fallback=nearest slot.
      mapReport.push({ item: it.name, itemType: it.type, slotIndex, nativeType, nativeCode, matchKind,
        along: Math.round(it.along), up: Math.round(it.up),
        X: buf.readInt16LE(off + OBJ_POS), Y: buf.readInt16LE(off + OBJ_POS + 2), Z: buf.readInt16LE(off + OBJ_POS + 4) });
      if (opts.editSymbol === true && ch.swapCode != null) {
        if (ch.symbol) symbolSwaps++; else nativeSymbols++;
        symbolReport.push({ type: it.type, slotIndex, code: ch.swapCode, native: !!ch.native, source: ch.swapSrc });
      }
      if (opts.editSymbol === true && ch.symbolBlocked != null) {
        symbolBlocked++; symbolBlockedTypes.push({ type: it.type, wantCode: ch.symbolBlocked, slotIndex });
      }
    }
    // surplus slots: unused base slots. Default = LEFT AS-IS (the base's own item,
    // untouched — the safest per the owner's earlier load-test). When opts.collapseSurplus
    // is set (a rich base with many surplus slots would otherwise render 20+ ghost items),
    // relocate each surplus slot's POSITION ONLY to a far off-plan collapse point — a pure
    // geometry edit, the SAME operation class as repositioning a real item or a wall (proven
    // loadable, F2). The code+block+dims and every other byte stay the base's own, so no code
    // is introduced and Section E is still byte-identical (surplus never triggers the 921
    // driver). This keeps the drawing clean without ever touching a risky field.
    // Collapse point. Computed FROM THE ACTUAL room wall extent (robust across any base's
    // coordinate frame). CRITICAL (owner load-test 2026-08-24, decoded): the stored X/Y are an
    // int16 in a −20000-biased WORLD frame (world = stored + 20000). Raumplan rejects a slot
    // whose WORLD coord goes NEGATIVE / off the drawing space — the earlier `min − GAP` push
    // (e.g. −19296 − 12000 = −31296 → world −11296) is exactly what made allelem_clean 921/fail,
    // while allelem_perfect_safe's surplus at stored −12796 (world +7204) LOADED. So we collapse
    // toward the POSITIVE-WORLD side (`max + GAP`, i.e. just beyond the room's far corner) and
    // hard-clamp the WORLD coordinate to stay comfortably positive and in a normal drawing range
    // — never negative, never near the int16 edge. This keeps surplus off-plan AND loadable.
    // An explicit {x,y} (world-frame convenience is the caller's responsibility) still overrides.
    const WORLD_BIAS = 20000;
    const clampI16 = (v) => Math.max(-32000, Math.min(32000, Math.round(v)));
    // clamp a STORED value so its WORLD (stored+bias) stays within [WMIN,WMAX] — positive, off the
    // int16 rails, and within a plausible Raumplan drawing extent (~50 m).
    const WMIN = 1000, WMAX = 50000;
    const clampWorld = (stored) => clampI16(Math.max(WMIN - WORLD_BIAS, Math.min(WMAX - WORLD_BIAS, Math.round(stored))));
    let collapseX = null, collapseY = null;
    if (opts.collapseSurplus) {
      if (opts.collapseSurplus.x != null && opts.collapseSurplus.y != null) {
        collapseX = clampWorld(opts.collapseSurplus.x); collapseY = clampWorld(opts.collapseSurplus.y);
      } else {
        const wt = readWallTable(buf); // uses the freshly written wall table
        const xs = wt.flatMap((w) => [w[0], w[2]]), ys = wt.flatMap((w) => [w[1], w[3]]);
        const GAP = opts.collapseSurplus.gap != null ? opts.collapseSurplus.gap : 8000; // mm clear beyond the room's far corner
        // move toward the positive-world corner so world stays > 0 (proven-loadable direction).
        collapseX = clampWorld(Math.max(...xs) + GAP);
        collapseY = clampWorld(Math.max(...ys) + GAP);
      }
    }
    for (let i = 0; i < objCount; i++) {
      if (usedSlot.has(i)) continue;
      leftAsIs++;
      if (opts.collapseSurplus) {
        const off = o0 + i * OBJ_REC;
        buf.writeInt16LE(collapseX, off + OBJ_POS);      // X — far off-plan (beyond the room's far corner, WORLD-positive)
        buf.writeInt16LE(collapseY, off + OBJ_POS + 2);  // Y
        // Z left as the slot's own mount height; position-only move collapses the ghost off-plan.
      }
    }
    // overflow items (more items than slots): DROPPED — appending = cross-file E4214.
    dropped = Math.max(0, items.length - objCount);
    if (dropped > 0) {
      warnings.push(`room has ${items.length} items but base "${baseInfo ? baseInfo.name : 'caller'}" has only ${objCount} slots; ${dropped} overflow item(s) DROPPED (appending whole records would re-introduce the cross-file E4214). Use a base with >= ${items.length} slots.`);
    }
    if (leftAsIs > 0) {
      warnings.push(opts.collapseSurplus
        ? `${leftAsIs} surplus base slot(s) COLLAPSED off-plan (position-only move; code+block+dims kept native, Section E byte-identical — no 921 path).`
        : `${leftAsIs} surplus base slot(s) left AS-IS (base's own item, untouched) — safest per the owner's load-test (neutralising previously caused 921).`);
    }
    if (symbolBlocked > 0) {
      const list = symbolBlockedTypes.map((s) => `${s.type}(code ${s.wantCode})`).join(', ');
      // STRICT-MEMBERSHIP GUARD (opt-in, task-3 hardening). When the caller demands that EVERY
      // item render its exact symbol, a code-membership violation must FAIL LOUDLY — a clear,
      // actionable error naming the offending types/codes — rather than silently degrading to a
      // family-fallback symbol (which is the correct DEFAULT, but hides the fact that this base
      // cannot host these codes). This is the "refuse, don't silent-921" contract: we never emit a
      // non-native code (that path is unreachable here), and with strictMembership we also refuse to
      // ship a file that quietly lost a correct symbol.
      if (opts.strictMembership) {
        const codes = [...new Set(symbolBlockedTypes.map((s) => s.wantCode))].sort((a, b) => a - b);
        throw new Error(
          `PDP membership violation: base "${baseInfo ? baseInfo.name : 'caller'}" does not natively register symbol code(s) {${codes.join(',')}} required by ${symbolBlocked} item(s): ${list}. ` +
          `The 921-driver forbids introducing a code the base lacks. Supply a DR base whose native code-set includes {${codes.join(',')}} ` +
          `(e.g. the owner's master base drawn per docs/PDP_MASTER_BASE.md), or drop editSymbol/strictMembership to accept correct-FAMILY fallback symbols.`);
      }
      warnings.push(`921-GUARD: ${symbolBlocked} item(s) kept as correct-FAMILY fallback because their canonical symbol code is NOT in this base's native set: ${list}. Use a base that natively registers these codes (e.g. wall4_oc40 for gas code 6) to get their exact symbol.`);
    }
  }

  // (3) BODY POLICY: the base's Section-E body / assembly / 838-B tail are NEVER
  //     touched by this path (only offsets < o0+objCount*173 are written above).
  const assemblies = drBody.countAssemblies(buf);
  if (assemblies < 1) {
    warnings.push('WARNING: base body has 0 furniture assemblies — no real InnoDraw file has 0; this base is suspect.');
  }

  return {
    buf, Cx, Cy,
    base: baseInfo ? { name: baseInfo.name, walls: baseInfo.walls, slots: baseInfo.oc, exactWalls: baseInfo.exactWalls } : { name: 'caller baseBuf', walls: nW, slots: objCount, exactWalls: true },
    itemCount: items.length,
    objCount: buf.readUInt32LE(cOff),
    placedInPlace: placed,
    // in-place edit tallies (replaces the old substituted/neutralised/appended shape)
    typeEdits, codeEdits, dimEdits, leftAsIs, dropped,
    // 🔒 גודל-קבוע: כמה פריטים שמרו את בייטי-הגודל ה-native (לא נכתבו מידות-שלנו)
    sizeFixedKept,
    // ➕ "+X": כמה פריטים נפלטו כווריאנט-מותאם-גודל (t1 native + t2 = המידה-שלנו + label +X)
    plusEmitted, plusReport,
    // paired-swap (correct-symbol) tallies + per-item map (editSymbol path only)
    symbolSwaps, nativeSymbols, symbolBlocked, symbolBlockedTypes, symbolReport,
    // native-slot symbol mapping (postype path): how many items render an exact-native
    // symbol, a same-family symbol, or a nearest fallback — plus the full per-item map.
    exactSymbols, familySymbols, fallbackSymbols, mapReport,
    // NATIVE-SYMBOL clean path: correctSymbols = items rendering their CORRECT glyph on the
    // slot's native (unedited) symbol unit — block-exact, zero code/block edits (postype-safe).
    // symbolNativeSymbols = subset reached by the block-exact relabel pass (pass 1b).
    correctSymbols, symbolNativeSymbols,
    // legacy keys kept for callers that read them (soline_convert reads placed/appended)
    substituted: typeEdits + codeEdits, neutralised: 0, appended: 0,
    assemblies,
    meshBearing: 0,
    bodyPreserved: true,
    body: drBody.bodyReport(buf),
    warnings,
  };
}

function convertRoomDR(room, opts = {}) { return convertRoomDRv2(room, opts); }

// ---------------------------------------------------------------------------
// verifyPropertyBlocks — byte-level proof gate for the injection pipeline (task-3/4).
// ---------------------------------------------------------------------------
// Asserts, slot-by-slot, that an OUTPUT DR buffer never disturbed the 921-sensitive regions of
// its BASE and that every stored world coordinate is positive:
//   (a) each slot's symbol UNIT [0x91,0x9c) — code(2)+property block(9) — is byte-identical to the
//       base slot (the postype/native-symbol contract: NO block edit → no 921). Set opts.blockOnly
//       to check only the 9-byte property block [0x93,0x9c) (allowing a within-membership code swap
//       @0x91, the editSymbol path). Default checks the full unit.
//   (b) the list terminator [0x9c,OBJ_REC) is byte-identical to the base (position-driven; a swap
//       must never touch it).
//   (c) every slot's stored X/Y @0x85/0x87 is in a POSITIVE-WORLD frame (stored + 20000 > 0) — the
//       owner load-test proved world-negative surplus makes Raumplan reject the file.
// Returns { ok, slotCount, blockDiffs:[i…], termDiffs:[i…], worldNegative:[{i,x,y}…], sizeOk }.
function verifyPropertyBlocks(outBuf, baseBuf, opts = {}) {
  const startK = opts.blockOnly ? 0x93 : SYM_BLK_START;   // 0x93 = block only; 0x91 = code+block
  const WORLD_BIAS = 20000;
  const nW = outBuf.readInt16LE(COUNT_OFF);
  const cOff = TABLE_OFF + STRIDE * nW;
  const objCount = outBuf.readUInt32LE(cOff);
  const o0 = cOff + 20;
  const sizeOk = outBuf.length === baseBuf.length && outBuf.readUInt32LE(cOff) === baseBuf.readUInt32LE(cOff);
  const blockDiffs = [], termDiffs = [], worldNegative = [];
  for (let i = 0; i < objCount; i++) {
    const off = o0 + i * OBJ_REC;
    for (let k = startK; k < SYM_BLK_END; k++) { if (outBuf[off + k] !== baseBuf[off + k]) { blockDiffs.push(i); break; } }
    for (let k = SYM_BLK_END; k < OBJ_REC; k++) { if (outBuf[off + k] !== baseBuf[off + k]) { termDiffs.push(i); break; } }
    const x = outBuf.readInt16LE(off + OBJ_POS), y = outBuf.readInt16LE(off + OBJ_POS + 2);
    if (x + WORLD_BIAS <= 0 || y + WORLD_BIAS <= 0) worldNegative.push({ i, x, y, worldX: x + WORLD_BIAS, worldY: y + WORLD_BIAS });
  }
  return { ok: sizeOk && blockDiffs.length === 0 && termDiffs.length === 0 && worldNegative.length === 0,
           slotCount: objCount, blockDiffs, termDiffs, worldNegative, sizeOk };
}

// ---------------------------------------------------------------------------
// selfTest — (1) a general simple room builds on a real base with the body kept
// intact (assemblies >= 1, footer/tail intact, no synthesis); (2) rebuilding
// mimran-5 on its OWN base stays byte-exact-except-position (the known-loadable
// reference). Part (2) auto-skips if the corpus is absent.
// ---------------------------------------------------------------------------
function selfTest() {
  const problems = [];
  const chk = (c, m) => { if (!c) problems.push(m); };

  // (0) LIBRARY-CONTRACT guard: every .bin that has a ground-truth entry must carry EXACTLY the
  // ground-truth {code + property block} [0x91,0x9c). This is the Soline↔Raumplan symbol contract
  // decoded from the Rosetta file; a drifted .bin would emit a wrong symbol via pairedSwap.
  {
    const hx = (b, o, n) => [...b.slice(o, o + n)].map((x) => x.toString(16).padStart(2, '0')).join(' ');
    let checked = 0, bad = [];
    for (const [type, gt] of Object.entries(GT_CODES)) {
      const rec = itemRecord(type);
      if (!rec) continue; // no .bin for this type (reference-only row) — skip
      checked++;
      const block = hx(rec, SYM_BLK_START, 11);
      if (block !== gt.block) bad.push(`${type}: .bin ${block} != GT ${gt.block}`);
    }
    chk(bad.length === 0, `library contract: ${bad.length} .bin(s) drifted from ground-truth code+block: ${bad.join(' ; ')}`);
    // The .bin corpus is DEV-ONLY (not shipped). Only assert full coverage when an items dir
    // is actually available (a licensed dev seat); a shipped/base-only run legitimately has 0.
    if (resolveItemsDir()) chk(checked >= 20, `library contract: only ${checked} .bin(s) checked against ground-truth (expected >=20)`);
  }

  const room = { walls: [
    { position: { startX: 0, startY: 0, endX: 4000, endY: 0 }, dimensions: { thick: 100, height: 2600 },
      fixtures: [0, 1, 2, 3].map((k) => ({ name: 'Socket', position: { x: 500 + k * 1000, y: 1200 }, size: { width: 80, height: 80 } })), furnishings: [] },
    { position: { startX: 4000, startY: 0, endX: 4000, endY: 3000 }, dimensions: { thick: 100, height: 2600 },
      fixtures: [{ name: 'Socket', position: { x: 1000, y: 1200 }, size: { width: 80, height: 80 } }], furnishings: [] },
    { position: { startX: 4000, startY: 3000, endX: 0, endY: 3000 }, dimensions: { thick: 100, height: 2600 }, fixtures: [], furnishings: [] },
  ] };
  const r = convertRoomDRv2(room, {});
  chk(r.itemCount === 5, 'simple: itemCount != 5');
  chk(r.placedInPlace === 5, 'simple: not all 5 items placed in place');
  chk(r.dropped === 0, 'simple: items dropped (base too small?)');
  chk(r.assemblies >= 1, 'simple: base assembly missing (body not preserved / bad base)');
  chk(r.body.footerOk, 'simple: footer 03 00 00 missing');
  chk(r.body.tailHasEofGlyph, 'simple: constant EOF glyph tail missing');
  chk(r.objCount === r.body.objCount, 'simple: objCount mismatch');
  chk(r.objCount === r.base.slots, 'simple: objCount changed vs base (must never resize)');
  // KEY INVARIANT: every item-slot symbol code must stay within the base's OWN code
  // set (never an unknown code -> never E4214). Verify directly on the output bytes.
  {
    const cOff = TABLE_OFF + STRIDE * r.buf.readInt16LE(COUNT_OFF), o0 = cOff + 20;
    const bases = new Set(); for (let i = 0; i < r.objCount; i++) bases.add(r.buf.readUInt8(o0 + i * OBJ_REC + 0x91));
    const allowed = baseCodeSet(loadBase(3, 5).buf, o0, r.objCount);
    let allIn = true; for (const c of bases) if (!allowed.has(c)) allIn = false;
    chk(allIn, `simple: an item-slot carries a symbol code outside the base's own set (E4214 risk): got {${[...bases]}} allowed {${[...allowed]}}`);
  }

  // SYMBOLS-MODE INVARIANTS (editSymbol paired-swap path). A diverse room forces swaps
  // for types the base lacks (מפסק/גז/צ.מים/תעלה...). Verify, byte-for-byte, that:
  //   (a) every edited slot's {code+block} @0x91-0x9b equals SOME real .bin unit — i.e. the
  //       (code,block) pair is internally consistent (never a code without its own block);
  //   (b) the terminator/list-structure @0x9c.. of EVERY slot is byte-identical to the base
  //       (position-driven; a swap must never disturb it);
  //   (c) the Section-E body/assembly/tail is byte-identical to the base.
  {
    const symRoom = { walls: [
      { position: { startX: 0, startY: 0, endX: 5000, endY: 0 }, dimensions: { thick: 100, height: 2600 },
        fixtures: [ { name: 'Socket', position: { x: 400, y: 1200 }, size: { width: 80, height: 80 } },
                    { name: 'Switch', position: { x: 900, y: 1300 }, size: { width: 80, height: 80 } },
                    { name: 'Gas', position: { x: 1400, y: 600 }, size: { width: 80, height: 80 } },
                    { name: 'Water', position: { x: 1900, y: 600 }, size: { width: 80, height: 80 } } ],
        furnishings: [ { name: 'Beam', position: { x: 2400, y: 2400 }, size: { width: 80, height: 80 } },
                       { name: 'Power Line', position: { x: 2900, y: 700 }, size: { width: 80, height: 80 } } ] },
      { position: { startX: 5000, startY: 0, endX: 5000, endY: 3000 }, dimensions: { thick: 100, height: 2600 },
        fixtures: [ { name: 'Can Light', position: { x: 1000, y: 2500 }, size: { width: 80, height: 80 } },
                    { name: 'Passage', position: { x: 2000, y: 0 }, size: { width: 900, height: 2100 } } ], furnishings: [] },
      { position: { startX: 5000, startY: 3000, endX: 0, endY: 3000 }, dimensions: { thick: 100, height: 2600 },
        fixtures: [ { name: 'Passage', position: { x: 1000, y: 0 }, size: { width: 900, height: 2100 } } ], furnishings: [] },
      { position: { startX: 0, startY: 3000, endX: 0, endY: 0 }, dimensions: { thick: 100, height: 2600 }, fixtures: [], furnishings: [] },
    ] };
    const baseBuf = loadBase(4, 8).buf; // wall4_oc17 (mimran-1): native codes {1,3,5,7} — LACKS 4 (מפסק) & 6 (גז)
    const rs = convertRoomDRv2(symRoom, { baseBuf, editSymbol: true, editType: true, editDims: true });
    const cOff = TABLE_OFF + STRIDE * rs.buf.readInt16LE(COUNT_OFF), objCount = rs.buf.readUInt32LE(cOff), o0 = cOff + 20;
    // Every placed item is exactly one of: swapped / native / BLOCKED-by-921-guard.
    chk(rs.symbolSwaps + rs.nativeSymbols + rs.symbolBlocked === rs.placedInPlace, 'symbols: not every placed item accounted for (swap+native+blocked)');
    chk(rs.symbolSwaps > 0, 'symbols: expected at least one paired swap (base lacks מפסק/גז/צ.מים/תעלה)');
    chk(rs.symbolReport.some((s) => s.type === 'דלת' && !s.native), 'symbols: expected a 2nd door to force a paired swap (exercises the type-extra extend path)');
    // 921-GUARD (the decoded driver): on a base missing codes 4 & 6, Gas (code 6) and Switch
    // (code 4) MUST be blocked — never written — so no non-native code enters the file. This is
    // exactly what allelem_master got wrong (it introduced 4 & 6 on this base -> 921).
    chk(rs.symbolBlocked >= 2, `symbols: 921-guard should block >=2 items (Gas code6 + Switch code4) on wall4_oc17; got ${rs.symbolBlocked}`);
    chk(rs.symbolBlockedTypes.some((s) => s.wantCode === 6) && rs.symbolBlockedTypes.some((s) => s.wantCode === 4), 'symbols: 921-guard must block the code-6 (Gas) and code-4 (Switch) items on a base lacking them');
    // The output must NEVER carry a symbol code outside the base's native set (the 921 driver).
    {
      const native = new Set(); for (let i = 0; i < objCount; i++) native.add(baseBuf.readUInt8(o0 + i * OBJ_REC + 0x91));
      let allIn = true, got = new Set(); for (let i = 0; i < objCount; i++) { const c = rs.buf.readUInt8(o0 + i * OBJ_REC + 0x91); got.add(c); if (!native.has(c)) allIn = false; }
      chk(allIn, `symbols: 921-DRIVER VIOLATION — output carries a code outside the base's native set {${[...native]}}: got {${[...got]}}`);
    }
    // Precise per-slot consistency: every slot is EXACTLY one of
    //   (i)   untouched               — [0x91,OBJ) == base
    //   (ii)  block-only swap         — [0x91,0x9c) == a real .bin/base unit,  [0x9c,OBJ) == base
    //   (iii) extended swap (non-last)— [0x91,0xa0) == a real .bin's region,   [0xa0,OBJ) == base
    // i.e. the {code+block} pair is always a REAL InnoDraw unit (internally consistent),
    // and the position-driven list terminator beyond the copied unit stays base-exact.
    const recs = {};
    for (const t of ['שקע','ק.חשמל','תאורה','חלון','דלת','צ.חשמל','פ.ביוב','תעלה','מפסק','גז','צ.מים','מים משולב','ק.בקורת','חור.פ.ממד','ביוב קיר','ברז','אסלה']) {
      const rec = itemRecord(t); if (rec) recs[t] = rec;
    }
    const eqR = (a, b, aOff, bOff, s, e) => { for (let k = s; k < e; k++) if (a[aOff + k] !== b[bOff + k]) return false; return true; };
    let allConsistent = true, badSlot = -1;
    for (let i = 0; i < objCount; i++) {
      const off = o0 + i * OBJ_REC;
      // (i) untouched
      if (eqR(rs.buf, baseBuf, off, off, SYM_BLK_START, OBJ_REC)) continue;
      // (ii) block-only swap to a real unit
      const blockUnitReal = Object.values(recs).some((r) => eqR(rs.buf, r, off, 0, SYM_BLK_START, SYM_BLK_END))
        && eqR(rs.buf, baseBuf, off, off, SYM_BLK_END, OBJ_REC);
      if (blockUnitReal) continue;
      // (iii) extended swap to a real non-last .bin's [0x91,0xa0)
      const extReal = Object.values(recs).some((r) => r[SYM_MARK_OFF] === 0x0e && eqR(rs.buf, r, off, 0, SYM_BLK_START, SYM_EXT_END))
        && eqR(rs.buf, baseBuf, off, off, SYM_EXT_END, OBJ_REC);
      if (extReal) continue;
      allConsistent = false; badSlot = i; break;
    }
    chk(allConsistent, `symbols: slot ${badSlot} is not a consistent real-unit swap (code+block or terminator inconsistent)`);
    // body byte-identical to base
    const dEnd = o0 + objCount * OBJ_REC;
    let bodyOk = rs.buf.length === baseBuf.length;
    for (let k = dEnd; k < baseBuf.length && bodyOk; k++) if (rs.buf[k] !== baseBuf[k]) bodyOk = false;
    chk(bodyOk, 'symbols: Section-E body/tail not byte-identical to base (must be untouched)');
    chk(rs.objCount === baseBuf.readUInt32LE(cOff), 'symbols: objCount changed vs base');
    // header (through the wall count) untouched
    chk(eqR(rs.buf, baseBuf, 0, 0, 0, COUNT_OFF + 2), 'symbols: header/wall-count region altered');

    // RICH-BASE CORRECT-SYMBOL-FOR-ALL invariant (the allelem_perfect path). Auto base
    // selection (no baseBuf) must pick a base whose native code set COVERS every item's
    // canonical code, so the SAME diverse room gets ZERO blocked items, ZERO code-byte
    // @0x91 changes (every item lands on a same-code slot -> only sub-blocks vary within a
    // registered code), ZERO code-membership violations, and a byte-identical Section E.
    // This is the exact property that makes allelem_perfect load where allelem_master 921'd.
    {
      const rr = convertRoomDRv2(symRoom, { editSymbol: true, editType: true, editDims: true });
      const richName = rr.base.name;
      const richBuf = fs.readFileSync(path.join(resolveBaseDir().dir, richName.endsWith('.pdp') ? richName : richName + '.pdp'));
      const rcOff = TABLE_OFF + STRIDE * rr.buf.readInt16LE(COUNT_OFF), rObj = rr.buf.readUInt32LE(rcOff), ro0 = rcOff + 20;
      chk(rr.symbolBlocked === 0, `rich-symbols: expected 0 blocked on a code-covering base (${richName}); got ${rr.symbolBlocked}`);
      const rNative = new Set(); for (let i = 0; i < rObj; i++) rNative.add(richBuf.readUInt8(ro0 + i * OBJ_REC + 0x91));
      let codeChg = 0, viol = 0;
      for (let i = 0; i < rObj; i++) {
        const off = ro0 + i * OBJ_REC;
        if (rr.buf.readUInt16LE(off + 0x91) !== richBuf.readUInt16LE(off + 0x91)) codeChg++;
        if (!rNative.has(rr.buf.readUInt8(off + 0x91))) viol++;
      }
      chk(codeChg === 0, `rich-symbols: ${codeChg} slot(s) changed the code @0x91 vs the code-covering base (should be block-only sub-swaps)`);
      chk(viol === 0, `rich-symbols: ${viol} code-membership violation(s) on the rich base (must be 0)`);
      const rdEnd = ro0 + rObj * OBJ_REC; let rBodyOk = rr.buf.length === richBuf.length;
      for (let k = rdEnd; k < richBuf.length && rBodyOk; k++) if (rr.buf[k] !== richBuf[k]) rBodyOk = false;
      chk(rBodyOk, 'rich-symbols: Section-E body/tail not byte-identical to the rich base');
      // every non-blocked item carries its exact GT (code,block)
      let exact = 0; for (const s of rr.symbolReport) { const off = ro0 + s.slotIndex * OBJ_REC; const blk = [...rr.buf.subarray(off + SYM_BLK_START, off + SYM_BLK_END)].map((x) => x.toString(16).padStart(2, '0')).join(' '); if (GT_CODES[s.type] && blk === GT_CODES[s.type].block) exact++; }
      chk(exact === rr.symbolReport.length, `rich-symbols: only ${exact}/${rr.symbolReport.length} items carry their exact ground-truth code+block on the rich base`);
    }

    // NATIVE-SYMBOL (postype-clean) path invariants — the allelem_clean build. This path makes
    // ZERO code/block edits (owner's decisive 2026-08-24 fact: even a block-only sub-swap within
    // a registered code triggered 921). It routes items to slots whose NATIVE symbol unit already
    // renders the correct glyph (block-exact, pass 1b) and collapses surplus far off-plan. Verify,
    // byte-for-byte, on the same diverse room that:
    //   (a) NOT ONE slot's [0x91,0x9c) code+block differs from the chosen base (postype class);
    //   (b) correctSymbols == exact-type + block-relabel, and the block-relabel pass actually
    //       fired (types that share a unit, e.g. Beam/תעלה onto a structure slot, prove pass 1b);
    //   (c) Section-E body byte-identical; objCount unchanged;
    //   (d) collapseSurplus moves every surplus slot to the far point — none left inside the room.
    {
      // Exercise the REAL default collapse path (gap-based, the one build_allelem_clean uses).
      const COLGAP = { gap: 8000 };
      const rn = convertRoomDRv2(symRoom, { nativeSymbols: true, editType: true, editDims: true, collapseSurplus: COLGAP });
      const nbuf = fs.readFileSync(path.join(resolveBaseDir().dir, rn.base.name.endsWith('.pdp') ? rn.base.name : rn.base.name + '.pdp'));
      const ncOff = TABLE_OFF + STRIDE * rn.buf.readInt16LE(COUNT_OFF), nObj = rn.buf.readUInt32LE(ncOff), no0 = ncOff + 20;
      let cbChg = 0;
      for (let i = 0; i < nObj; i++) { const off = no0 + i * OBJ_REC; for (let k = SYM_BLK_START; k < SYM_BLK_END; k++) if (rn.buf[off + k] !== nbuf[off + k]) { cbChg++; break; } }
      chk(cbChg === 0, `native-symbols: ${cbChg} slot(s) edited the code/block [0x91,0x9c) — must be 0 (postype-class only)`);
      chk(rn.codeEdits === 0, `native-symbols: codeEdits ${rn.codeEdits} must be 0`);
      chk(rn.correctSymbols === rn.exactSymbols + rn.symbolNativeSymbols, 'native-symbols: correctSymbols != exact-type + block-relabel');
      chk(rn.symbolNativeSymbols > 0, 'native-symbols: block-exact relabel pass (1b) never fired — Beam/תעלה should map onto a structure slot');
      const ndEnd = no0 + nObj * OBJ_REC; let nBodyOk = rn.buf.length === nbuf.length;
      for (let k = ndEnd; k < nbuf.length && nBodyOk; k++) if (rn.buf[k] !== nbuf[k]) nBodyOk = false;
      chk(nBodyOk, 'native-symbols: Section-E body/tail not byte-identical to base');
      chk(rn.objCount === nbuf.readUInt32LE(ncOff), 'native-symbols: objCount changed vs base');
      // Recompute the expected collapse point exactly as the writer does (max-corner + gap, then
      // world-clamped) so the test tracks the real code path.
      let wx = [], wy = []; for (let i = 0; i < rn.buf.readInt16LE(COUNT_OFF); i++) { const s = TABLE_OFF + i * STRIDE; wx.push(rn.buf.readInt16LE(s), rn.buf.readInt16LE(s + 4)); wy.push(rn.buf.readInt16LE(s + 2), rn.buf.readInt16LE(s + 6)); }
      const rminX = Math.min(...wx), rmaxX = Math.max(...wx), rminY = Math.min(...wy), rmaxY = Math.max(...wy), M = 3000;
      const cI16 = (v) => Math.max(-32000, Math.min(32000, Math.round(v)));
      const cW = (s) => cI16(Math.max(1000 - 20000, Math.min(50000 - 20000, Math.round(s))));
      const cx = cW(rmaxX + 8000), cy = cW(rmaxY + 8000);
      let ghostsInside = 0, collapsed = 0;
      for (let i = 0; i < nObj; i++) { const off = no0 + i * OBJ_REC, x = rn.buf.readInt16LE(off + OBJ_POS), y = rn.buf.readInt16LE(off + OBJ_POS + 2); if (x === cx && y === cy) { collapsed++; if (x >= rminX - M && x <= rmaxX + M && y >= rminY - M && y <= rmaxY + M) ghostsInside++; } }
      chk(ghostsInside === 0, `native-symbols: ${ghostsInside} collapsed surplus slot(s) still inside/near the room (ghost not killed)`);
      chk(collapsed === rn.leftAsIs, `native-symbols: collapsed ${collapsed} != surplus ${rn.leftAsIs}`);
      // REGRESSION GUARD (owner load-test 2026-08-24): the collapse point's WORLD coord
      // (stored + 20000) MUST stay positive. The earlier build pushed surplus to world −11296
      // (min-corner − gap), which made Raumplan reject the file; world +7204 loaded. Never recur.
      chk(cx + 20000 > 0 && cy + 20000 > 0, `native-symbols: collapse WORLD coord must be positive (got ${cx + 20000},${cy + 20000}) — negative broke the Raumplan load`);
    }
  }

  // ➕ SIZE_PLUS INVARIANTS (the "+X" custom-size emit path). On the master DR base, clone a plain
  // socket slot and emit "+שקע" at a NON-native size via editSlotInPlace(emitPlus). Assert, byte-
  // for-byte: t1 @0x79 stays the socket's native size (glyph locked), t2 @0x7f == our custom value,
  // the label reads "+שקע", and [0x91,OBJ_REC) (code+block+terminator) is byte-identical (no 921).
  // Also assert the ➕ path is DORMANT without emitPlus (a plain socket stays 🔒 native). Auto-skips
  // when the master base is unavailable (shipped/base-less run).
  {
    let baseDir = null; try { const r = resolveBaseDir(); baseDir = r && r.dir; } catch (e) { /* unconfigured */ }
    const masterPath = baseDir && path.join(baseDir, 'wall4_oc40.pdp');
    if (masterPath && fs.existsSync(masterPath)) {
      const master = fs.readFileSync(masterPath);
      const cOff = TABLE_OFF + STRIDE * master.readInt16LE(COUNT_OFF), objCount = master.readUInt32LE(cOff), o0 = cOff + 20;
      const codeSet = baseCodeSet(master, o0, objCount);
      // find a PLAIN socket slot (native glyph, 🔒)
      let sockOff = -1; for (let i = 0; i < objCount; i++) { const o = o0 + i * OBJ_REC; if (slotType(master, o) === 'שקע') { sockOff = o; break; } }
      chk(sockOff >= 0, 'plus: master base has no plain socket slot to clone');
      if (sockOff >= 0) {
        const nativeT1 = master.subarray(sockOff + OBJ_DIM_OFF, sockOff + OBJ_DIM2_OFF); // [0x79,0x7f)
        const nativeUnitTail = master.subarray(sockOff + 0x91, sockOff + OBJ_REC);       // code+block+terminator
        const it = { type: 'שקע', W: 200, D: 150, H: 600, wx: 1000, wy: 1000, up: 1000, height: 1000 };
        // (a) emitPlus ON + custom size → "+שקע"
        const bufPlus = Buffer.from(master);
        const ch = editSlotInPlace(bufPlus, sockOff, it, 0, 0, codeSet, { emitPlus: true, editType: true, editDims: true }, false);
        chk(ch.plus === true, 'plus: emitPlus+custom size did not flag a "+X" emit');
        chk(bufPlus.subarray(sockOff + OBJ_DIM_OFF, sockOff + OBJ_DIM2_OFF).equals(nativeT1), 'plus: t1 @0x79 was NOT preserved native (glyph would tilt)');
        const t2 = [bufPlus.readInt16LE(sockOff + OBJ_DIM2_OFF), bufPlus.readInt16LE(sockOff + OBJ_DIM2_OFF + 2), bufPlus.readInt16LE(sockOff + OBJ_DIM2_OFF + 4)];
        chk(t2[0] === 200 && t2[1] === 150 && t2[2] === 600, `plus: t2 @0x7f != our custom [200,150,600] (got ${JSON.stringify(t2)})`);
        chk(slotType(bufPlus, sockOff) === '+שקע', `plus: label != "+שקע" (got "${slotType(bufPlus, sockOff)}")`);
        chk(bufPlus.subarray(sockOff + 0x91, sockOff + OBJ_REC).equals(nativeUnitTail), 'plus: [0x91,OBJ_REC) code+block+terminator changed (921 risk)');
        // (b) DORMANT without emitPlus → plain socket stays 🔒 native (no dim/label change)
        const bufOff = Buffer.from(master);
        const ch2 = editSlotInPlace(bufOff, sockOff, it, 0, 0, codeSet, { editType: true, editDims: true }, false);
        chk(ch2.plus === false && ch2.sizeFixed === true, 'plus: without emitPlus a socket must stay 🔒 (no "+X")');
        chk(bufOff.subarray(sockOff + OBJ_DIM_OFF, sockOff + 0x85).equals(master.subarray(sockOff + OBJ_DIM_OFF, sockOff + 0x85)), 'plus: 🔒 native size bytes changed when emitPlus was OFF');
      }
    }
  }

  const gtPath = 'G:/My Drive/קבצים ללמידת מכונה/סטים/mimran-5_Room1_Teveth_Roni_DR1.pdp';
  const ordxPath = 'G:/My Drive/קבצים ללמידת מכונה/סטים/mimran-5_Room1_Teveth_Roni_DR1.ordx';
  let byteExact = 'skipped (corpus absent)';
  if (fs.existsSync(gtPath) && fs.existsSync(ordxPath)) {
    const gt = fs.readFileSync(gtPath);
    const { parseOrdxFile } = require(path.join(__dirname, 'parseOrdx'));
    // Pure POSITION rewrite (no type/code/dim edits): rebuilding a file on its own
    // base must differ from GT ONLY in the per-item position triple. This proves the
    // in-place writer corrupts nothing outside the fields it is asked to touch.
    const rm = convertRoomDRv2(parseOrdxFile(ordxPath).rooms[0], { baseBuf: gt, editType: false, editCode: false, editDims: false });
    const nW = rm.buf.readInt16LE(COUNT_OFF);
    let wallsExact = rm.buf.length === gt.length && rm.buf.readInt16LE(COUNT_OFF) === gt.readInt16LE(COUNT_OFF);
    for (let i = 0; i < nW * STRIDE && wallsExact; i++) if (rm.buf[TABLE_OFF + i] !== gt[TABLE_OFF + i]) wallsExact = false;
    chk(wallsExact, 'mimran-5: wall table / size not byte-exact vs GT');
    const cOff = TABLE_OFF + STRIDE * nW, objCount = gt.readUInt32LE(cOff), o0 = cOff + 20;
    let posOnly = 0;
    for (let i = 0; i < objCount; i++) {
      const o = o0 + i * OBJ_REC; let nonPos = 0;
      for (let k = 0; k < OBJ_REC; k++) if (rm.buf[o + k] !== gt[o + k] && !(k >= 0x85 && k < 0x8b)) nonPos++;
      if (nonPos === 0) posOnly++;
    }
    chk(posOnly === objCount, `mimran-5: ${objCount - posOnly}/${objCount} records differ beyond the position triple`);
    // PER-TYPE ANCHOR regression guard (CENTER side). mimran-5's five records are 2 שקע +
    // ברז (all CENTER-anchored) + צ.חשמל + ביוב קיר (OFFSET). Centering the CENTER types on
    // their measured point reproduces InnoDraw's position BYTE-EXACT (Δ=0) for the 2 sockets
    // + faucet. If the CENTER anchor regresses (e.g. reverts to raw corner), this drops < 3.
    let fullyExact = 0;
    for (let i = 0; i < objCount; i++) {
      const o = o0 + i * OBJ_REC; let diff = 0;
      for (let k = 0; k < OBJ_REC; k++) if (rm.buf[o + k] !== gt[o + k]) diff++;
      if (diff === 0) fullyExact++;
    }
    chk(fullyExact >= 3, `mimran-5 (anchor CENTER): only ${fullyExact}/5 records byte-exact incl. position — CENTER anchor regressed (expect >=3: 2 sockets + faucet)`);
    // body must be byte-identical to GT (we never touch it)
    const dEnd = o0 + objCount * OBJ_REC;
    let bodyExact = rm.buf.length === gt.length;
    for (let k = dEnd; k < gt.length && bodyExact; k++) if (rm.buf[k] !== gt[k]) bodyExact = false;
    chk(bodyExact, 'mimran-5: Section-E body not byte-identical to GT (body must be untouched)');
    byteExact = `walls+size exact, ${posOnly}/${objCount} records byte-exact except position, ${fullyExact}/${objCount} byte-exact incl. position (CENTER anchor), body byteExact=${bodyExact}`;
  }

  // PER-TYPE ANCHOR regression guard (OFFSET side). mimran-5 has no big opening, so we also
  // rebuild mimran-1 (a door + a window, both OFFSET-anchored) on its own base. With the raw
  // CORNER anchor for these types the door AND window records reproduce InnoDraw's position
  // BYTE-EXACT (Δ=0). Under the OLD blanket "always center" they were ~W/2 = ~450-500 mm off
  // and NEVER byte-exact — so this assertion is exactly what the blanket fix could not satisfy.
  let offsetExact = 'skipped (corpus absent)';
  const gt1 = 'G:/My Drive/קבצים ללמידת מכונה/סטים/mimran-1_Room1_Teveth_Roni_DR1.pdp';
  const ordx1 = 'G:/My Drive/קבצים ללמידת מכונה/סטים/mimran-1_Room1_Teveth_Roni_DR1.ordx';
  if (fs.existsSync(gt1) && fs.existsSync(ordx1)) {
    const gt = fs.readFileSync(gt1);
    const { parseOrdxFile } = require(path.join(__dirname, 'parseOrdx'));
    const rm = convertRoomDRv2(parseOrdxFile(ordx1).rooms[0], { baseBuf: gt, editType: false, editCode: false, editDims: false });
    const nW = gt.readInt16LE(COUNT_OFF), cOff = TABLE_OFF + STRIDE * nW, objCount = gt.readUInt32LE(cOff), o0 = cOff + 20;
    // count byte-exact records among the OFFSET-anchored opening types (door/window)
    let openExact = 0;
    for (let i = 0; i < objCount; i++) {
      const o = o0 + i * OBJ_REC;
      const t = slotType(gt, o);
      if (t !== 'דלת' && t !== 'חלון') continue;
      let diff = 0; for (let k = 0; k < OBJ_REC; k++) if (rm.buf[o + k] !== gt[o + k]) diff++;
      if (diff === 0) openExact++;
    }
    chk(openExact >= 2, `mimran-1 (anchor OFFSET): only ${openExact} opening record(s) byte-exact incl. position — OFFSET/corner anchor regressed (expect >=2: door + window; blanket-center gives 0)`);
    offsetExact = `${openExact} opening record(s) (door/window) byte-exact incl. position via OFFSET/corner anchor`;
  }

  // PERPENDICULAR placement guard (the 3rd ORDX axis, Z = into-room stand-off). Rebuild the
  // Rosetta calibration room (elemets_Bar_Terra-Nova_Yosi_DR1) on its OWN base and assert that
  // the SET-BACK fixtures reproduce InnoDraw's stored X/Y to the BYTE: ק.חשמל (power box, ORDX
  // Z=200 -> 200 mm proud) and חור.פ.ממד (safety-room opening, Z=300). With the perpendicular
  // dropped (the old bug) these landed on the wall centreline, off by exactly their Z; applying
  // `perp = Z` along the inward normal puts them where they were measured. Auto-skips if absent.
  let perpExact = 'skipped (corpus absent)';
  const gtR = 'G:/My Drive/קבצים ללמידת מכונה/FULL ELC/elemets_Bar_Terra-Nova_Yosi_DR1.pdp';
  const ordxR = 'G:/My Drive/קבצים ללמידת מכונה/FULL ELC/elemets_Bar_Terra-Nova_Yosi_DR1.ordx';
  if (fs.existsSync(gtR) && fs.existsSync(ordxR)) {
    const gt = fs.readFileSync(gtR);
    const { parseOrdxFile } = require(path.join(__dirname, 'parseOrdx'));
    const room = parseOrdxFile(ordxR).rooms.sort((a, b) => b.walls.length - a.walls.length)[0];
    const rm = convertRoomDRv2(room, { baseBuf: gt, editType: false, editCode: false, editDims: false });
    const nW = gt.readInt16LE(COUNT_OFF), cOff = TABLE_OFF + STRIDE * nW, objCount = gt.readUInt32LE(cOff), o0 = cOff + 20;
    // For each perp-bearing type, require at least one output record whose X AND Y equal a GT
    // record of that type exactly (the type is unique or its instances share the wall, so a
    // byte-exact X/Y hit proves the perpendicular was applied on the correct side by the right mm).
    const perpTypes = ['ק.חשמל', 'חור.פ.ממד'];
    const hits = {};
    for (const t of perpTypes) {
      const gtXY = [];
      for (let i = 0; i < objCount; i++) { const o = o0 + i * OBJ_REC; if (slotType(gt, o) === t) gtXY.push([gt.readInt16LE(o + OBJ_POS), gt.readInt16LE(o + OBJ_POS + 2)]); }
      let hit = 0;
      for (let i = 0; i < objCount; i++) {
        const o = o0 + i * OBJ_REC; if (slotType(rm.buf, o) !== t) continue;
        const ox = rm.buf.readInt16LE(o + OBJ_POS), oy = rm.buf.readInt16LE(o + OBJ_POS + 2);
        if (gtXY.some(([gx, gy]) => gx === ox && gy === oy)) hit++;
      }
      hits[t] = hit;
      chk(hit >= 1, `perpendicular: ${t} (ORDX Z stand-off) did not reproduce GT stored X/Y to the byte — perpendicular offset wrong/dropped`);
    }
    perpExact = `perp-bearing types byte-exact X/Y: ${perpTypes.map((t) => `${t}=${hits[t]}`).join(', ')}`;
  }
  return { ok: problems.length === 0, problems, byteExact, offsetExact, perpExact };
}

module.exports = {
  writeWallsDR, convertRoomDR, convertRoomDRv2, verifyPropertyBlocks, stampItemRecord, collectItems, itemAnchor, readWallTable,
  loadBase, listBases, pickRichestBase, pickBaseForSymbols, pickBaseForNativeSymbols, baseSlotProfile, gtCodeForType, gtBlockForType, slotBlockHex, isSafeCode, safeCodes, selfTest,
  // customer-supplied-base resolution (interop compliance)
  resolveBaseDir, resolveItemsDir, requireBaseDir, baseStatus, loadConfig, NO_BASE_MSG,
  ANCHOR_CENTER, GT_CODES,
  SIZE_FIXED, isSizeFixed,
  SIZE_PLUS, isSizePlus, SIZE_PLUS_VERIFIED, isSizePlusVerified,
  // low-level helpers exported so the ➕ byte-test can drive individual slots for types
  // that have no ORDX-dictionary name yet (מזגן / טלפון / חור-איורור).
  editSlotInPlace, slotType, baseCodeSet,
  COUNT_OFF, TABLE_OFF, STRIDE, OBJ_REC, OBJ_DIM_OFF, OBJ_DIM2_OFF, OBJ_POS, OBJ_TYPE_OFF,
};

if (require.main === module) {
  const t = selfTest();
  console.log(JSON.stringify(t, null, 2));
  console.log(t.ok ? 'writePdpDR selfTest: PASS' : 'writePdpDR selfTest: FAIL');
  process.exit(t.ok ? 0 : 1);
}
