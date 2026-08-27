'use strict';
/*
 * opening_schema.js — פרמטריזציה של אלמנט-פתח (דלת/חלון) לפי החוזה המשותף
 * =============================================================================
 * מקור-אמת יחיד לגזירת שדות-הסכמה של פתח (`docs/OPENING_ELEMENT_SCHEMA.md`) מתוך
 * רשומת-הפתח המנורמלת שהמייצאים בונים (name/type/class/size/position). כל עוד
 * מסך-הזרקת-המודד (app-lane) אינו כותב עדיין את האובייקט המובנה `opening{geom,
 * config,pos}` ל-.sol, אנו *גוזרים* אותו כאן: סמל→typeKey, מילות-מפתח→כיוון-פתיחה,
 * וברירות-מחדל מ-`docs/DOORS_WINDOWS_SIZES.md` (מידות-יצרנים ישראליים) ממלאות חוסר.
 * כשה-app יתחיל לכתוב את השדות במפורש (rec.opening) — הם מנצחים את הגזירה.
 *
 * שני הצרכנים (export_dxf2d / export_dxf_pro) קוראים מכאן את אותה הגזירה כדי
 * שהתכנית (2D) והתלת-ממד (3D) יסכימו על אותו openMode/hingeSide/swing/מסגרת/מידות.
 *
 * API:
 *   deriveOpening(rec)      -> { kind, symKey, typeKey, geom{...}, config{...} }
 *   assignMarks(openings)   -> { markOf(rec)->'D1'/'W1', rows:[{kind,symKey,W,H,dir,count,mark}] }
 *   openMode/hingeSide/swing helpers are folded into deriveOpening().
 *
 * לשון זכר, יחידות מ״מ. תלוי רק ב-element_symbols_soline (resolveKey).
 */

const SYM = require('./element_symbols_soline');

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// symKey -> { mode, hinge?, leaves? }. openMode vocabulary per the schema:
//   hinged | sliding | folding | pocket | fixed | kip | awning | hung | double | none
const KEY_MODE = {
  door_hinged_l: { mode: 'hinged', hinge: 'L' },
  door_hinged_r: { mode: 'hinged', hinge: 'R' },
  door_interior_90: { mode: 'hinged' },
  door_entrance: { mode: 'hinged' },
  door_concealed: { mode: 'hinged', dashed: true },
  door_mamad: { mode: 'hinged', mamad: true },
  doorway_frame: { mode: 'hinged' },
  doorway_noframe: { mode: 'hinged', noFrame: true },
  door_frame: { mode: 'none' },                    // מלבן-דלת בלבד (משקוף, ללא כנף)
  door_double: { mode: 'double', leaves: 2 },
  door_sliding: { mode: 'sliding' },
  door_pocket: { mode: 'pocket' },
  door_folding: { mode: 'folding', leaves: 4 },
  // מעברים/פתחים ללא כנף
  passage: { mode: 'none' }, arch: { mode: 'none', arch: true },
  half_arch: { mode: 'none', arch: true }, lowered_passage: { mode: 'none' },
  pass_through: { mode: 'none' }, bar_counter: { mode: 'none' },
  // חלונות
  window: { mode: 'fixed' }, interior_window: { mode: 'fixed' },
  window_sliding: { mode: 'sliding' }, window_casement: { mode: 'casement' },
  window_tilt: { mode: 'awning' }, window_kip: { mode: 'kip' },
  window_hung: { mode: 'hung' }, window_mamad: { mode: 'mamad' },
  window_storefront: { mode: 'fixed' }, window_corner: { mode: 'fixed' },
  window_small: { mode: 'fixed' }, window_porthole: { mode: 'fixed' },
  window_glassblock: { mode: 'fixed' }, window_sill: { mode: 'fixed' },
  shutter_box: { mode: 'fixed' },
};

function isWindowKey(k) { return /^window|interior_window|shutter_box/.test(k || ''); }

// The joined text used to sniff hinge side / swing / glazing from the element name.
function nameText(rec) {
  return [rec.he, rec.name, rec.heName, rec.description, rec.type, rec.typeKey].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// deriveOpening — the core. Returns a fully-populated schema-shaped opening.
// Any field already present on rec.opening (future app-lane) overrides the
// derived value.
// ---------------------------------------------------------------------------
function deriveOpening(rec) {
  rec = rec || {};
  const given = rec.opening || {};            // future: explicit schema from the .sol
  const gGeom = given.geom || {};
  const gCfg = given.config || {};

  const symKey = SYM.resolveKey(rec) || (isWindowLike(rec) ? 'window' : 'door_hinged_l');
  const base = SYM.SYMBOLS[symKey] || null;
  const km = KEY_MODE[symKey] || (isWindowKey(symKey) ? { mode: 'fixed' } : { mode: 'hinged' });
  const kind = (rec.kind === 'window' || rec.kind === 'door') ? rec.kind
    : (isWindowKey(symKey) || (base && base.discipline === 'window') ? 'window' : 'door');
  const s = nameText(rec);

  // dimensions (mm). Prefer measured, then the symbol's real-world default.
  const width = num(gGeom.width) || num(rec.width) || (base ? base.dims.w : (kind === 'window' ? 1000 : 900));
  const height = num(gGeom.height) || num(rec.height) || (base ? base.dims.h : (kind === 'window' ? 1200 : 2050));
  const wallThickness = num(gGeom.wallThickness) || num(rec.wallThick) || 100;

  // frameReveal = the reveal seen in the wall plane (חתך-משקוף 9.5/12/14 ס״מ) —
  // spans the wall depth. frameThickness = the profile's own material thickness
  // (עומק-הפרופיל, ~4 ס״מ; ממ״ד עבה יותר). See DOORS_WINDOWS_SIZES §1.1/§1.3.
  const mamad = !!km.mamad || /ממ.?ד|mamad|blast|הדף/i.test(s) || symKey === 'window_mamad';
  const frameReveal = num(gGeom.frameReveal) || clamp(wallThickness, 90, 200);
  const frameThickness = num(gGeom.frameThickness) || (mamad ? 80 : (kind === 'window' ? 50 : 40));
  const leafThickness = num(gGeom.leafThickness) || (mamad ? 60 : 40);

  // sill (windows only): measured position.y is the opening CENTRE height in ORDX;
  // sill = centre - height/2. Doors sit on the floor (sill = 0).
  let sillHeight = 0;
  if (kind === 'window') {
    if (num(gGeom.sillHeight) != null) sillHeight = num(gGeom.sillHeight);
    else if (num(rec.sillHeight) != null) sillHeight = num(rec.sillHeight);
    else if (rec.mount != null && rec.mount > 0) sillHeight = Math.max(0, rec.mount - height / 2);
    else sillHeight = 900;                    // קליל: אדן טיפוסי ~90 ס״מ
  }

  // config
  const mode = gCfg.openMode || km.mode || (kind === 'window' ? 'fixed' : 'hinged');
  // hinge side: explicit config > explicit side word in the name > symbol default > L.
  let hinge = gCfg.hingeSide || null;
  if (!hinge) { if (/שמאל|\bleft\b/i.test(s)) hinge = 'L'; else if (/ימין|\bright\b/i.test(s)) hinge = 'R'; }
  if (!hinge) hinge = km.hinge || null;
  if (!hinge && (mode === 'hinged' || mode === 'casement' || mode === 'double')) hinge = 'L';
  let swing = gCfg.swing || null;
  if (!swing && /החוצה|\bout\b|כלפי חוץ/i.test(s)) swing = 'out';
  else if (!swing && /פנימה|\bin\b|כלפי פנים/i.test(s)) swing = 'in';
  if (!swing && (mode === 'hinged' || mode === 'double' || mode === 'casement')) swing = 'in';
  const leafCount = num(gCfg.leafCount) || km.leaves || 1;
  const glazing = gCfg.glazing || (kind === 'window' ? 'full'
    : (/זכוכית|glass|vision|צוהר/i.test(s) ? 'partial' : 'none'));

  return {
    kind, symKey, typeKey: rec.typeKey || given.typeKey || symKey,
    dashed: !!km.dashed, noFrame: !!km.noFrame, arch: !!km.arch, mamad,
    geom: { width, height, sillHeight, wallThickness, frameThickness, frameReveal, leafThickness },
    config: { openMode: mode, hingeSide: hinge, swing, leafCount, glazing },
  };
}

// Loose window/door sniff used before a symbol resolves.
function isWindowLike(rec) {
  return /window|חלון/i.test((rec.type || '') + ' ' + (rec.name || '') + ' ' + (rec.he || ''));
}

// ---------------------------------------------------------------------------
// assignMarks — the door/window schedule marks (D1.. / W1..) shared by the plan
// labels and the spec table, so a mark on the drawing keys to its schedule row.
// Identical openings (kind + symKey + rounded W×H + direction) share one row/mark.
// ---------------------------------------------------------------------------
function dirTokenOf(d) {
  const hinge = d.config.hingeSide ? (d.config.hingeSide === 'L' ? 'שמאל' : 'ימין') : '';
  const swing = d.config.swing ? (d.config.swing === 'out' ? 'החוצה' : 'פנימה') : '';
  return [hinge, swing].filter(Boolean).join(' ') || '-';
}
function assignMarks(openings) {
  const rows = new Map();      // key -> row
  const derivedByRec = new Map();
  for (const op of (openings || [])) {
    const d = op.__derived || (op.__derived = deriveOpening(op));
    derivedByRec.set(op, d);
    const W = Math.round(d.geom.width), H = Math.round(d.geom.height);
    const dir = dirTokenOf(d);
    const key = d.kind + '|' + d.symKey + '|' + W + 'x' + H + '|' + dir;
    if (rows.has(key)) rows.get(key).count += 1;
    else rows.set(key, { kind: d.kind, symKey: d.symKey, mode: d.config.openMode, W, H, dir, count: 1, key });
  }
  // doors first, then windows; marks per kind by descending count
  const list = [...rows.values()].sort((a, b) =>
    (a.kind === b.kind) ? (b.count - a.count) : (a.kind === 'door' ? -1 : 1));
  let dSeq = 0, wSeq = 0;
  for (const r of list) r.mark = r.kind === 'door' ? ('D' + (++dSeq)) : ('W' + (++wSeq));
  const markByKey = new Map(list.map((r) => [r.key, r.mark]));
  const markOf = (op) => {
    const d = derivedByRec.get(op) || deriveOpening(op);
    const W = Math.round(d.geom.width), H = Math.round(d.geom.height);
    const key = d.kind + '|' + d.symKey + '|' + W + 'x' + H + '|' + dirTokenOf(d);
    return markByKey.get(key) || (d.kind === 'door' ? 'D?' : 'W?');
  };
  return { markOf, rows: list };
}

module.exports = { deriveOpening, assignMarks, dirTokenOf, isWindowKey, KEY_MODE };
