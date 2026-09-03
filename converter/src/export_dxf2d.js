'use strict';
/*
 * Soline — PROFESSIONAL 2D DXF measurement plan (DR1) exporter.
 * =============================================================================
 * Produces a *submittable* top-view measurement drawing (תכנית מדידה) that reads
 * like a professional measurement deliverable, per the drafting conventions in
 * docs/DXF_2D_METHOD.md and validated against our own reference exports (*_DR1.dxf).
 *
 * This is a ground-up rewrite of the old symbol-gallery exporter. It targets the
 * professional plan, not a legend of icons. It is SELF-CONTAINED: it reads only
 * the shared model (parseOrdx) via placement.js + elements.json, and never
 * touches the 3D / ORDX / PDP / HTML exporters.
 *
 * What makes it professional (vs. the old / generic output):
 *   1. Walls as a real, CONTINUOUS POCHÉ body — inner + outer offset faces
 *      (Walls / Ext_Wall) with a solid dark fill between them (Walls_Fill). Shared
 *      corners are MITRED to the intersection of the two offset lines (used by both
 *      walls, so the band is gap-free and never crosses); FREE ends of an open wall
 *      chain (e.g. an alcove) get a flush square cap instead of a half-thickness
 *      stub. See buildWallPoly().
 *   2. A manual DIMENSION engine (the reference deliverables carry NO `DIMENSION`
 *      entities — validated against our own reference exports): every measurement
 *      = 2 extension LINEs + 1 dimension LINE + 2 SOLID arrowheads + 1 TEXT (cm),
 *      aligned + upright, number lifted clearly above the line. Rendered as clean,
 *      NON-OVERLAPPING NESTED chains: element positions nearest the wall, per-wall
 *      lengths (DIM) outside them, the room envelope (Dim_overall) furthest out.
 *   3. Every element drawn with a RECOGNISABLE 2D symbol classified to its true
 *      discipline (socket / square-socket / switch / gas / water / drain / HVAC /
 *      light / data / panel …) on its own coloured layer, each with its Hebrew
 *      NAME label + its "H nn" mount-height annotation.
 *   4. Doors & windows drawn as real opening geometry sized to the true width
 *      (leaf + swing arc for doors; frame + glazing for windows) — no squashed
 *      unit-block arcs.
 *   5. A full semantic LAYER table (correct ACI colours), an ARIAL text STYLE,
 *      an automatic LEGEND (symbol + Hebrew name per discipline present), a
 *      framed TITLE BLOCK (project / client / date / scale / measurer), a NORTH
 *      arrow, a SCALE bar, and a room name + area number (P.n) label.
 *   6. Clean R12 ASCII DXF: full HEADER (computed $EXTMIN/$EXTMAX, $DWGCODEPAGE
 *      ansi_1255, $LTSCALE), VPORT, LTYPEs, per-entity handles, balanced
 *      SECTION/ENDSEC + EOF. Hebrew is emitted as \U+XXXX escapes so the file is
 *      pure 7-bit ASCII on disk yet renders Hebrew through the ARIAL.TTF style.
 *
 * Public API:
 *   exportDXF2D(sceneOrModel, opts) -> DXF string           (primary)
 *   exportDXF2DPro = exportDXF2D                            (drop-in alias)
 *   sceneFromModel(model, opts) -> normalized scene
 *   selfTest(dxf, scene) -> { ok, problems, ... }
 */

const fs = require('fs');
const path = require('path');

// מקור-האמת המשותף לסיווג/סמלים — כדי ש-2D עקבי עם ORDX ו-3D.
let CATALOG_MOD = null;
try { CATALOG_MOD = require('./element_catalog'); } catch (_) { CATALOG_MOD = null; }

// ---------------------------------------------------------------------------
// Soline shared DXF template (layers/style/font/sections). This is the NEW
// Soline layer system — see src/dxf_soline.js. It replaces the legacy layer names
// (Walls / Const_Doors / Dim_* / Text_* …) that some CAD tools expect.
// ---------------------------------------------------------------------------
const T = require('./dxf_soline');
const { g, num, makeHandleGen, heToDxfUnicode, heToCp1255, isHebrew, cm, L, LAYERS, STYLE_NAME, symbolLayer, refineDisciplineLayer, kindLayer, DISC_HE, colorOf, LW_BORDER, layerOut } = T;
// Sheet/region geometry helpers (DXF-entity transform + bbox + paper sizes). This
// module requires export_dxf2d LAZILY (only in its buildSheet/CLI), so requiring it
// here at load time introduces NO cycle. transformEntities lets the main drawing
// translate whole content BLOCKS into non-overlapping REGIONS (owner declutter fix).
const LAYOUT = require('./layout_sheets');
const { transformEntities, bboxOf } = LAYOUT;

// Dimension layer for a placed element: the element discipline's `-DIM` kind layer
// (v7 taxonomy — SOL-CHASHMAL-DIM, SOL-DELET-DIM …). These are PRE-DECLARED in the
// shared LAYER table, so toggling e.g. "SOL-CHASHMAL-DIM" hides just the electrical
// measurements while its symbols stay, and every "*-DIM" toggles all dims together.
// (Replaces v6's per-element SOL-DIM-<DISC>-<n> explosion.) `reg`/`n` are kept in
// the signature for call-site compatibility but no longer used. Returns {layer,color}.
function dimLayerFor(reg, discLayer, n) {   // eslint-disable-line no-unused-vars
  const layer = kindLayer(discLayer || L.MIVNE, 'DIM');
  return { layer, color: colorOf(layer) };
}

// Soline element-symbol language (172 symbols). Replaces the old ~8
// crude glyphs: symbolFor() resolves an item by name/Hebrew/type; toDxf2dGlyph()
// emits the glyph in the GLYPHS/BLOCKS_2D format (wall at Y=0, +Y into room), at
// the item's true width/height. See docs/ELEMENTS_LANGUAGE.md.
const SYM = require('./element_symbols_soline');
// Parametric door/window OPENING schema (docs/OPENING_ELEMENT_SCHEMA.md): derives
// geom/config (frame, openMode, hinge, swing, sill…) from the placed opening, so the
// plan renders each door/window from its fields — not a generic box. Shared with the
// 3D exporter so both agree on the same opening parameters.
const OPEN = require('./opening_schema');
// A few Hebrew synonyms not yet in the library's map, so common elements
// never fall through to the generic glyph.
const SYM_SYNONYM = [[/מתג/, 'switch_single']];
function symKeyFor(it) {
  let k = SYM.resolveKey(it);
  if (!k) { const s = [it.he, it.name, it.heName, it.description].filter(Boolean).join(' '); for (const [re, key] of SYM_SYNONYM) if (re.test(s)) { k = key; break; } }
  return k || 'generic';
}
// The symbol definition + resolved discipline layer for an item, with the item's
// true dimensions applied.
function symInfo(it) {
  const key = symKeyFor(it);
  const base = SYM.SYMBOLS[key];
  const W = Math.max(20, Math.abs(it.width || base.dims.w || 100));
  const H = Math.max(20, Math.abs(it.height || base.dims.h || 100));
  // v7: refine the symbol-library discipline with the element's own text so a
  // drain lands on SOL-NIKUZ (not water) and a fan/diffuser on SOL-IVRUR (not AC).
  const layer = refineDisciplineLayer(symbolLayer(base.discipline), it);
  return { key, base, W, H, layer, generic: key === 'generic' };
}
// Elevation dimensioning splits elements into POINT (dim to centre) vs LARGE /
// opening (corner-distance + full width + full height + sill). Openings, structure
// (column/beam/panel), cabinets, and anything sizeable are "large".
const LARGE_DISC = new Set(['door', 'window', 'opening', 'structure']);
function isLargeElev(info) { return LARGE_DISC.has(info.base.discipline) || info.W >= 600 || info.H >= 900; }

// ---------------------------------------------------------------------------
// Discipline classification. Keyed on the element's own Hebrew/English name +
// class/type + catalogue category. First hit wins; order matters (openings and
// gas before the broad plumbing/electrical rules).
// Returns { disc, glyph, symLayer, dimLayer, hLayer, heCat }.
// ---------------------------------------------------------------------------
const DISCIPLINES = {
  window:     { symLayer: L.PTACHIM,     dimLayer: L.MIDOT_PNIM, hLayer: L.PTACHIM,     heCat: 'חלון' },
  door:       { symLayer: L.PTACHIM,     dimLayer: L.MIDOT_PNIM, hLayer: L.PTACHIM,     heCat: 'דלת / פתח' },
  electrical: { symLayer: L.CHASHMAL,    dimLayer: L.MIDOT_PNIM, hLayer: L.CHASHMAL,    heCat: 'חשמל' },
  plumbing:   { symLayer: L.INSTALATSIA, dimLayer: L.MIDOT_PNIM, hLayer: L.INSTALATSIA, heCat: 'אינסטלציה / מים' },
  gas:        { symLayer: L.GAZ,         dimLayer: L.MIDOT_PNIM, hLayer: L.GAZ,         heCat: 'גז' },
  hvac:       { symLayer: L.MIZUG,       dimLayer: L.MIDOT_PNIM, hLayer: L.MIZUG,       heCat: 'מיזוג / אוורור' },
  lighting:   { symLayer: L.TEURA,       dimLayer: L.MIDOT_PNIM, hLayer: L.TEURA,       heCat: 'תאורה' },
  structural: { symLayer: L.MIVNE,       dimLayer: L.MIDOT_PNIM, hLayer: L.MIVNE,       heCat: 'קונסטרוקציה' },
  misc:       { symLayer: L.MIVNE,       dimLayer: L.MIDOT_PNIM, hLayer: L.MIVNE,       heCat: 'שונות' },
};

// Rules: [disc, glyph, regex]. Tested against "name | category | type".
const CLASSIFY = [
  ['window', 'WINDOW', /חלון|window/i],
  ['door', 'DOOR', /דלת|מעבר|פתח|משקוף|כניס|door|entry|opening|passage/i],
  ['gas', 'GAS', /\bגז\b|גז|gas/i],
  ['hvac', 'HVAC', /מזגן|מיזוג|הנמכת\s*תקרה|אוורור|ונטה|מפוח|מאוורר|מפזר|תריס|hvac|\bac\b|vent|duct|fan|diffuser|condens/i],
  ['lighting', 'LIGHT', /תאור|ספוט|מנור|נורה|פנס|תלוי|פנדנט|אפליק|led|light|lamp|spot|luminaire|sconce|pendant/i],
  ['plumbing', 'DRAIN', /ביוב|ניקוז|נקז|drain|sewage|waste/i],
  ['plumbing', 'WATER', /מים|ברז|תמי|דוד|בוילר|אסלה|כיור|water|faucet|tap|mixer|boiler|toilet|sink|basin/i],
  ['electrical', 'SOCKET_SQ', /שקע\s*מרובע|square\s*socket/i],
  ['electrical', 'SWITCH', /מפסק|dimmer|switch/i],
  ['electrical', 'PANEL', /תשתית|לוח|ארון\s*חשמל|panel|board|distribution|infrastructure/i],
  ['electrical', 'DATA', /תקשורת|רשת|טלפון|נתונים|אינטרקום|ראוטר|טלוויז|data|network|phone|tv|hdmi|intercom|router/i],
  ['electrical', 'SENSOR', /גלאי|חיישן|תרמוסטט|sensor|detector|thermostat/i],
  ['electrical', 'SOCKET', /שקע|חשמל|socket|outlet|power/i],
  ['structural', 'COLUMN', /עמוד|קורה|מקטע|קונסטרוק|בטון|column|beam|pillar|structural/i],
];

// דיסציפלינה + סמל נשלפים מ-element_catalog (מעוגן בקורפוס). נפילה-לאחור לחוקן
// המקומי (CLASSIFY) אם הקטלוג לא נטען או שהאלמנט אינו מזוהה בו.
function classify(item) {
  const r = CATALOG_MOD ? CATALOG_MOD.classify(item) : null;
  // Reference-confirmed catalog classification (or a window/door, which the catalog
  // types reliably) is authoritative. The catalog's CONSERVATIVE fallback, however,
  // over-assigns 'electrical' to any Hebrew name it can't match against an
  // elements.json row — so for those we classify from the element's own name here.
  if (r && (r.corpus || r.disc === 'window' || r.disc === 'door') && DISCIPLINES[r.disc]) {
    const glyph = (r.disc === 'window' || r.disc === 'door') ? 'GENERIC'
      : ((r.sym2d && GLYPHS[r.sym2d]) ? r.sym2d : 'GENERIC');
    return { disc: r.disc, glyph, ...DISCIPLINES[r.disc] };
  }
  const s = [item.name, item.he, item.heName, item.description, item.category, item.class, item.type]
    .filter(Boolean).join(' | ');
  for (const [disc, glyph, re] of CLASSIFY) if (re.test(s)) {
    return { disc, glyph, ...DISCIPLINES[disc] };
  }
  // Fall back to the catalog's conservative disc if it offered a usable one.
  if (r && DISCIPLINES[r.disc]) {
    const glyph = (r.sym2d && GLYPHS[r.sym2d]) ? r.sym2d : 'GENERIC';
    return { disc: r.disc, glyph, ...DISCIPLINES[r.disc] };
  }
  return { disc: 'misc', glyph: 'GENERIC', ...DISCIPLINES.misc };
}

// ---------------------------------------------------------------------------
// 2D symbol glyph library. Block-local mm, insertion point (0,0) sits ON the
// wall line; the symbol reaches into the room along +Y. Built from real LINE
// polylines and true ARCs so it stays crisp; placed via INSERT at UNIFORM scale
// (arcs never squash) and rotated to the wall angle.
//   point-array          -> polyline (LINEs)
//   { arc:[cx,cy,r,a0,a1] } -> ARC
//   { circle:[cx,cy,r] } -> full circle
// ---------------------------------------------------------------------------
const R = 90;   // nominal symbol ring radius (mm on plan)
const GLYPHS = {
  // socket: stem to a ring with a diametric bar (standard outlet symbol)
  SOCKET: () => [[[0, 0], [0, 40]], { circle: [0, 40 + R, R] },
    [[-R, 40 + R], [R, 40 + R]], [[-30, 40 + R - 26], [-30, 40 + R + 26]], [[30, 40 + R - 26], [30, 40 + R + 26]]],
  // square socket: stem to a square with a diagonal
  SOCKET_SQ: () => [[[0, 0], [0, 40]],
    [[-R, 40], [R, 40], [R, 40 + 2 * R], [-R, 40 + 2 * R], [-R, 40]], [[-R, 40], [R, 40 + 2 * R]]],
  // switch: stem to a small ring with a break-out lever
  SWITCH: () => [[[0, 0], [0, 50]], { circle: [0, 50 + 40, 40] }, [[24, 50 + 62], [90, 50 + 150]]],
  // gas: ring with an inner flame chevron
  GAS: () => [[[0, 0], [0, 30]], { circle: [0, 30 + R, R] },
    [[-34, 30 + R - 20], [0, 30 + R + 34], [34, 30 + R - 20]], [[0, 30 + R - 34], [0, 30 + R + 20]]],
  // water point / faucet: ring with an inner cross
  WATER: () => [[[0, 0], [0, 24]], { circle: [0, 24 + R, R] },
    [[-R + 20, 24 + R], [R - 20, 24 + R]], [[0, 24 + R - (R - 20)], [0, 24 + R + (R - 20)]]],
  // drain / sewage: ring with an inner X
  DRAIN: () => [[[0, 0], [0, 20]], { circle: [0, 20 + R, R] },
    [[-60, 20 + R - 60], [60, 20 + R + 60]], [[-60, 20 + R + 60], [60, 20 + R - 60]]],
  // ceiling light: crossed circle
  LIGHT: () => [{ circle: [0, R, R] }, [[-64, R - 64], [64, R + 64]], [[-64, R + 64], [64, R - 64]]],
  // HVAC / ceiling drop with AC: rounded box with fan arcs
  HVAC: () => [[[-120, 20], [120, 20], [120, 20 + 200], [-120, 20 + 200], [-120, 20]],
    { arc: [0, 20 + 100, 70, 200, 340] }, { arc: [0, 20 + 100, 70, 20, 160] }],
  // data / comms: triangle marker on a stem
  DATA: () => [[[0, 0], [0, 40]], [[-R, 40 + 30], [R, 40 + 30], [0, 40 + 30 + 150], [-R, 40 + 30]]],
  // sensor: ring with a dot
  SENSOR: () => [[[0, 0], [0, 30]], { circle: [0, 30 + 70, 70] }, { circle: [0, 30 + 70, 16] }],
  // electrical panel / infrastructure: rectangle with a diagonal
  PANEL: () => [[[-120, 20], [120, 20], [120, 20 + 180], [-120, 20 + 180], [-120, 20]], [[-120, 20], [120, 20 + 180]]],
  // structural column: filled-look hatched square (outline + diagonals)
  COLUMN: () => [[[-100, -100], [100, -100], [100, 100], [-100, 100], [-100, -100]],
    [[-100, -100], [100, 100]], [[-100, 100], [100, -100]]],
  // generic element: small diamond on a stem
  GENERIC: () => [[[0, 0], [0, 30]], [[0, 30], [70, 30 + 70], [0, 30 + 140], [-70, 30 + 70], [0, 30]]],
};
// Legend shows the same glyphs; the swatch is drawn from GLYPHS[glyph].

// ---------------------------------------------------------------------------
// Entity emitters
// ---------------------------------------------------------------------------
// `lw` (optional) = per-entity lineweight override (group 370, 1/100 mm). Used for
// the heavy sheet border + title-block outer frame; otherwise the entity inherits
// its layer's lineweight from the AC1015 LAYER record.
function line(h, layer, x1, y1, x2, y2 /* , lw (R12: no per-entity lineweight) */) {
  return g(0, 'LINE') + g(5, h()) + g(8, layerOut(layer)) +
    g(10, num(x1)) + g(20, num(y1)) + g(30, num(0)) +
    g(11, num(x2)) + g(21, num(y2)) + g(31, num(0));
}
function polyline(h, layer, pts, lw) {
  let s = '';
  for (let i = 0; i + 1 < pts.length; i++) s += line(h, layer, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], lw);
  return s;
}
function arc(h, layer, cx, cy, r, a0, a1) {
  return g(0, 'ARC') + g(5, h()) + g(8, layerOut(layer)) +
    g(10, num(cx)) + g(20, num(cy)) + g(30, num(0)) + g(40, num(r)) + g(50, num(a0)) + g(51, num(a1));
}
// TEXT with optional horizontal justification (72: 0=left,1=center,2=right) and
// vertical (73). When justified, group 11/21 must repeat the alignment point.
function text(h, layer, str, x, y, height, rot, hAlign, vAlign) {
  let s = g(0, 'TEXT') + g(5, h()) + g(8, layerOut(layer)) +
    g(10, num(x)) + g(20, num(y)) + g(30, num(0)) + g(40, num(height)) +
    g(1, heToCp1255(str)) + g(50, num(rot || 0)) + g(7, STYLE_NAME);
  if (hAlign) s += g(72, hAlign);
  if (vAlign) s += g(73, vAlign);
  if (hAlign || vAlign) s += g(11, num(x)) + g(21, num(y)) + g(31, num(0));
  return s;
}
function insert(h, layer, blockName, x, y, rot, sx, sy) {
  return g(0, 'INSERT') + g(5, h()) + g(8, layerOut(layer)) + g(2, blockName) +
    g(10, num(x)) + g(20, num(y)) + g(30, num(0)) +
    g(41, num(sx == null ? 1 : sx)) + g(42, num(sy == null ? 1 : sy)) + g(43, num(1)) + g(50, num(rot || 0));
}
// Filled quad (SOLID) — DXF fills as a bowtie strip, so 3rd/4th vertices swap.
function solid(h, layer, a, b, c, d) {
  const dd = d || c;
  return g(0, 'SOLID') + g(5, h()) + g(8, layerOut(layer)) +
    g(10, num(a[0])) + g(20, num(a[1])) + g(30, num(0)) +
    g(11, num(b[0])) + g(21, num(b[1])) + g(31, num(0)) +
    g(12, num(dd[0])) + g(22, num(dd[1])) + g(32, num(0)) +
    g(13, num(c[0])) + g(23, num(c[1])) + g(33, num(0));
}
// One 2D glyph primitive.
function emitPrim(h, layer, prim) {
  if (Array.isArray(prim)) return polyline(h, layer, prim);
  if (prim.arc) return arc(h, layer, prim.arc[0], prim.arc[1], prim.arc[2], prim.arc[3], prim.arc[4]);
  if (prim.circle) return arc(h, layer, prim.circle[0], prim.circle[1], prim.circle[2], 0, 360);
  return '';
}

// ---------------------------------------------------------------------------
// Manual dimension engine (the reference has no DIMENSION entities).
// Emits: 2 extension LINEs + 1 dimension LINE + 2 SOLID arrows + 1 TEXT(cm).
// p1,p2 = the two measured points; `off` = perpendicular offset of the dim line;
// `side` = +1/-1 which side; value override supported for range labels.
// ---------------------------------------------------------------------------
function arrow(h, layer, tip, dir, nrm, len, wid) {
  len = len || 90; wid = wid || 28;
  const base = [tip[0] - dir[0] * len, tip[1] - dir[1] * len];
  const b1 = [base[0] + nrm[0] * wid, base[1] + nrm[1] * wid];
  const b2 = [base[0] - nrm[0] * wid, base[1] - nrm[1] * wid];
  return solid(h, layer, tip, b1, b2, b2);
}
function dimension(h, layer, p1, p2, opts) {
  opts = opts || {};
  const off = opts.off != null ? opts.off : 350;
  // ברירת-מחדל מתואמת לסגנון-SOLINE: DIMTXT 2.5 × DIMSCALE 50 = 125 מ"מ-מודל (=2.5 מ"מ
  // בהדפסה ב-1:50). הקוראים כבר מעבירים textH=H.dim=125; זו רק רשת-הביטחון לאותו ערך,
  // כדי שהמידות שאנו מרנדרים ידנית יהיו חופפות-חזותית למידה שהבעלים ישרטט בסגנון SOLINE.
  const th = opts.textH != null ? opts.textH : 125;
  const sgn = opts.side === -1 ? -1 : 1;
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  const nx = -uy * sgn, ny = ux * sgn;           // outward normal
  const q1 = [p1[0] + nx * off, p1[1] + ny * off];
  const q2 = [p2[0] + nx * off, p2[1] + ny * off];
  const ext = Math.max(50, th * 0.6);             // extension overshoot past dim line
  const gap = Math.max(40, th * 0.4);             // small gap: object → extension line
  const alen = Math.max(70, th * 1.15), awid = Math.max(18, th * 0.32); // terminators scale w/ text
  let s = '';
  s += line(h, layer, p1[0] + nx * gap, p1[1] + ny * gap, q1[0] + nx * ext, q1[1] + ny * ext);
  s += line(h, layer, p2[0] + nx * gap, p2[1] + ny * gap, q2[0] + nx * ext, q2[1] + ny * ext);
  s += line(h, layer, q1[0], q1[1], q2[0], q2[1]);
  s += arrow(h, layer, q1, [ux, uy], [nx, ny], alen, awid);
  s += arrow(h, layer, q2, [-ux, -uy], [nx, ny], alen, awid);
  let ang = Math.atan2(uy, ux) * 180 / Math.PI;
  if (ang > 90 || ang <= -90) ang += 180;         // keep the number upright
  // number centred and lifted clearly ABOVE the dimension line
  const mid = [(q1[0] + q2[0]) / 2 + nx * th * 0.95, (q1[1] + q2[1]) / 2 + ny * th * 0.95];
  const val = opts.value != null ? opts.value : cm(L);
  s += text(h, layer, val, mid[0], mid[1], th, ang, 1, 2);   // centred, above line
  return s;
}

// ---------------------------------------------------------------------------
// Sections: HEADER / TABLES come from the shared Soline template (dxf_soline.js)
// so 2D and 3D share ONE layer/style/font system. BLOCKS stays local (the 2D
// plan symbol glyphs).
// ---------------------------------------------------------------------------
const headerSection = T.headerSection;
const tablesSection = T.tablesSection;

// Emit ONE toDxf2dGlyph primitive (array=polyline, {circle:[cx,cy,r]},
// {label:[x,y,text,hmm]}), rotated by `rot` deg about (0,0), scaled by `sc`, then
// translated to (ox,oy). Used both to fill a symbol BLOCK (ox=oy=0, sc=1, rot=0)
// and to stamp a symbol directly (elevations / legend).
function emitGlyphPrim(h, layer, prim, ox, oy, sc, rot) {
  sc = sc == null ? 1 : sc; rot = rot || 0;
  const a = rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const Tp = ([x, y]) => [ox + sc * (x * ca - y * sa), oy + sc * (x * sa + y * ca)];
  if (Array.isArray(prim)) return prim.length > 1 ? polyline(h, layer, prim.map(Tp)) : '';
  if (prim.circle) { const [cx, cy, r] = prim.circle; const [wx, wy] = Tp([cx, cy]); return arc(h, layer, wx, wy, Math.abs(r * sc), 0, 360); }
  if (prim.label) { const [lx, ly, txt, hmm] = prim.label; const [wx, wy] = Tp([lx, ly]); return text(h, layer, txt, wx, wy, Math.max(24, Math.abs(hmm * sc)), rot, 1, 2); }
  return '';
}
// BLOCKS section from the resolved element symbols (each block = one glyph already
// baked to its true width/height, so the INSERT is a pure position/rotation).
// גיבוב-מחרוזת דטרמיניסטי (djb2) — לקיצור-שם בטוח-מהתנגשות כשהשם חורג מ-31 תווים.
function hshStr(s) { let hsh = 5381; for (let i = 0; i < s.length; i++) hsh = ((hsh << 5) + hsh + s.charCodeAt(i)) >>> 0; return hsh; }
// שם-בלוק חוקי-R12: רק [A-Za-z0-9_], ≤31 תווים, ללא רווח. בחריגה — משאירים רישא
// קריא + גיבוב קצר, כך ששני שמות-מקור שונים לעולם לא מתמפים לאותו בלוק. אותה
// פונקציה מפיקה את השם גם בהגדרת-הבלוק וגם ב-INSERT, לכן ההגדרה וההפניה תמיד תואמות.
function blkNameSafe(raw) {
  let s = String(raw).replace(/[^A-Za-z0-9_]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
  if (s.length > 31) s = s.slice(0, 26) + '_' + hshStr(raw).toString(36).slice(0, 4);
  return s || 'SS';
}
function symBlockName(key, W, H) { return blkNameSafe('SS_' + key + '_' + Math.round(W) + 'x' + Math.round(H)); }
// סמל-חזית שונה מסמל-התכנית (הוא מוסיף את מלבן ההיטל-החזיתי של האלמנט סביב אותו
// גליף), לכן הוא מקבל בלוק אמיתי משלו, בסיומת _ELV — עדיין בלוק, לא קווים בודדים.
function symElevBlockName(key, W, H) { return blkNameSafe('SS_' + key + '_' + Math.round(W) + 'x' + Math.round(H) + '_ELV'); }
// בונה את רשימת הפרימיטיבים של בלוק-החזית: מלבן ההיקף (מקומי, ראשית בתחתית-מרכז)
// ועל-גביו אותם פרימיטיבי-גליף של הסמל. נצרך פעם-אחת ונרשם ב-symBlocks.
function elevBlockPrims(base, W, H) {
  const rect = [[-W / 2, 0], [W / 2, 0], [W / 2, H], [-W / 2, H], [-W / 2, 0]];
  return [rect, ...(SYM.toDxf2dGlyph(base, { w: W, h: H }) || [])];
}
function blocksSection(symBlocks, h, ctx) {
  let s = g(0, 'SECTION') + g(2, 'BLOCKS');
  s += T.spaceBlocks(h, ctx);                      // mandatory *Model_Space / *Paper_Space (AC1015)
  for (const [name, prims] of symBlocks) {
    s += T.blockBegin(h, ctx, name);
    for (const p of prims) s += emitGlyphPrim(h, '0', p, 0, 0, 1, 0);
    s += T.blockEnd(h, ctx, name);
  }
  return s + g(0, 'ENDSEC');
}

// ---------------------------------------------------------------------------
// Scene normalization (from a parseOrdx model). Coordinates are kept in the
// FLIPPED world frame (worldY = -ordxY), matching placement.js + the reference.
// ---------------------------------------------------------------------------
function isModel(x) { return x && Array.isArray(x.rooms); }

function loadElements() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'elements.json'), 'utf8')); }
  catch { return []; }
}
function elementIndex(elements) {
  const byEn = new Map(), byHe = new Map();
  for (const e of elements) { if (e.en) byEn.set(e.en.toLowerCase(), e); if (e.he) byHe.set(e.he, e); }
  return (name) => byEn.get(String(name || '').toLowerCase()) || byHe.get(name) || null;
}

function isWindow(it) { return /window/i.test(it.type || '') || /חלון|window/i.test(it.name || ''); }
function isDoor(it) {
  return /door|entrydoor/i.test(it.type || '') || /דלת|מעבר|פתח|משקוף|door/i.test(it.name || '');
}

// PLANNING (cabinets): compute the 4 plan corners of a cabinet in the FLIPPED
// world frame (worldY = -ordxY). The cabinet stands against `wall`, its left edge
// `fromLeft` mm along the wall, `width` mm long, protruding `depth` mm INTO the
// room (the side facing the room centroid (cenX,cenY)). Returns { corners:[[x,y]×4],
// cx, cy } (rectangle + centre) or null when the wall has no geometry.
function cabinetPlanCorners(wall, cab, cenX, cenY) {
  const p = wall.position; if (!p) return null;
  const sx = p.startX, sy = -p.startY, ex = p.endX, ey = -p.endY; // flipped frame
  const dx = ex - sx, dy = ey - sy, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  let nx = -uy, ny = ux;                          // wall normal
  const midX = (sx + ex) / 2, midY = (sy + ey) / 2;
  if ((cenX - midX) * nx + (cenY - midY) * ny < 0) { nx = -nx; ny = -ny; } // point into room
  const from = cab.fromLeft || 0, w = cab.width || 600, d = cab.depth || 580;
  const flX = sx + ux * from, flY = sy + uy * from;               // front-left (on wall)
  const frX = sx + ux * (from + w), frY = sy + uy * (from + w);   // front-right
  const corners = [
    [flX, flY], [frX, frY],
    [frX + nx * d, frY + ny * d], [flX + nx * d, flY + ny * d],
  ];
  return { corners, cx: flX + ux * (w / 2) + nx * (d / 2), cy: flY + uy * (w / 2) + ny * (d / 2) };
}

function sceneFromModel(model, opts) {
  opts = opts || {};
  const { placeOnWall } = require('./placement');
  const catByName = elementIndex(opts.elements || loadElements());
  const walls = [], items = [], openings = [], cabinets = [];
  let roomName = null;
  for (const room of model.rooms || []) {
    if (!roomName) roomName = room.name || room.description || null;
    // Room centroid (flipped frame) — used to protrude cabinets into the room.
    const rw = (room.walls || []).filter((w) => w.position);
    let cenX = 0, cenY = 0;
    if (rw.length) {
      for (const w of rw) { cenX += (w.position.startX + w.position.endX) / 2; cenY += -(w.position.startY + w.position.endY) / 2; }
      cenX /= rw.length; cenY /= rw.length;
    }
    for (const cab of room.cabinets || []) {
      const wall = (room.walls || []).find((w) => w.number === cab.wallId) || (room.walls || [])[0];
      if (!wall) continue;
      const geo = cabinetPlanCorners(wall, cab, cenX, cenY);
      if (geo) cabinets.push({ name: cab.name || 'ארון', kind: cab.kind, ...geo });
    }
    for (const wall of room.walls || []) {
      const p = wall.position, dim = wall.dimensions || {};
      if (p) walls.push({
        number: wall.number,
        x1: p.startX, y1: -p.startY, x2: p.endX, y2: -p.endY,      // FLIPPED world frame
        thick: dim.thick || 100, height: dim.height || 2500,
        length: dim.length || Math.hypot(p.endX - p.startX, p.endY - p.startY),
      });
      const all = [...(wall.fixtures || []), ...(wall.furnishings || [])];
      for (const it of all) {
        const pos = placeOnWall(wall, it, 0, 0);   // -> {x, y:-py, orientation} in flipped frame
        if (!pos) continue;
        const sz = it.size || {};
        const meta = catByName(it.name);
        const cr = CATALOG_MOD ? CATALOG_MOD.classify(it) : null;
        // תווית עברית לשרטוט (Israeli deliverable): heName של Soline -> תיאור-עברי
        // -> שם-הקטלוג העברי -> שם אנגלי כמוצא-אחרון.
        const heLabel = it.heName || (isHebrew(it.description) ? it.description : null) ||
          (cr && cr.he) || (meta && meta.he) || it.name;
        const rec = {
          name: it.name,
          he: heLabel,
          category: (meta && meta.category) || it.class || null,
          class: it.class, type: it.type,
          x: pos.x, y: pos.y,                       // already flipped world coords
          wallStartX: p ? p.startX : null, wallStartY: p ? -p.startY : null,
          rotation_deg: pos.orientation / 10,
          width: sz.width != null ? sz.width : (meta && meta.width_mm) || 100,
          depth: sz.depth != null ? sz.depth : (meta && meta.depth_mm) || 60,
          height: sz.height != null ? sz.height : (meta && meta.height_mm) || 80,
          mount: it.position && it.position.y != null ? it.position.y : ((meta && meta.mount_height_mm) || 0),
          wallThick: dim.thick || 100,
        };
        if (isWindow(it) || isDoor(it)) openings.push({ ...rec, kind: isWindow(it) ? 'window' : 'door' });
        else items.push(rec);
      }
    }
  }
  return { walls, items, openings, cabinets, roomName };
}
function normalizeScene(x, opts) {
  if (isModel(x)) return sceneFromModel(x, opts);
  return { walls: x.walls || [], items: x.items || [], openings: x.openings || [], cabinets: x.cabinets || [], roomName: x.roomName || null };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function centroid(walls) {
  let sx = 0, sy = 0, n = 0;
  for (const w of walls) { sx += w.x1 + w.x2; sy += w.y1 + w.y2; n += 2; }
  return n ? [sx / n, sy / n] : [0, 0];
}
function planExtents(walls, items, openings, cabinets) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const acc = (x, y) => { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; };
  for (const w of walls) { const t = (w.thick || 100); acc(w.x1 - t, w.y1 - t); acc(w.x1 + t, w.y1 + t); acc(w.x2 - t, w.y2 - t); acc(w.x2 + t, w.y2 + t); }
  for (const it of [...items, ...openings]) { const r = Math.max(it.width || 0, 200); acc(it.x - r, it.y - r); acc(it.x + r, it.y + r); }
  for (const cab of cabinets || []) for (const [x, y] of cab.corners) acc(x, y);
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 4000; maxY = 3000; }
  return { minX, minY, maxX, maxY };
}

// ---------------------------------------------------------------------------
// Drawing: walls (poché), openings, elements, dimensions, legend, title.
// ---------------------------------------------------------------------------
// Intersection of two infinite lines P+s·d and Q+r·e. null when (near) parallel.
function lineInt(px, py, dx, dy, qx, qy, ex, ey) {
  const den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-9) return null;
  const s = ((qx - px) * ey - (qy - py) * ex) / den;
  return [px + s * dx, py + s * dy];
}

// Build the poché geometry for every wall with MITRED junctions (shared corners
// close with no gap/overlap) and FLUSH caps at free ends.
//
// CLOSURE FIX (owner #2): the MEASURED wall line = the INNER (clear) room face.
// The wall thickness is added ENTIRELY OUTWARD (away from the room), never inward.
// So the inner face sits exactly ON the measured line (offset 0) and the outer face
// is offset by the FULL thickness outward. Result: the clear room reads the measured
// numbers (e.g. 4000×3000) and the outer envelope reads measured + 2·thickness.
// Each wall gets its outer/inner offset faces; where two walls share an endpoint the
// two matching offset lines are intersected to give a single shared corner used by
// BOTH walls, so the band is continuous. `t` = FULL wall thickness.
// Returns [{ oS,oE,iS,iE, freeS,freeE, mid, nx,ny, ux,uy, t, len, w }].
function buildWallPoly(walls, cen) {
  const geo = walls.map((w) => {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    let nx = -uy, ny = ux;                                   // candidate normal
    const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
    if ((mx - cen[0]) * nx + (my - cen[1]) * ny < 0) { nx = -nx; ny = -ny; } // point OUT of room
    return { w, ux, uy, nx, ny, t: (w.thick || 100), len: L, mid: [mx, my] };
  });
  // endpoint adjacency (which other wall shares each endpoint)
  const key = (x, y) => Math.round(x / 4) + '_' + Math.round(y / 4);
  const at = new Map();
  const push = (k, rec) => { if (!at.has(k)) at.set(k, []); at.get(k).push(rec); };
  geo.forEach((g0, i) => { push(key(g0.w.x1, g0.w.y1), { i, end: 'S' }); push(key(g0.w.x2, g0.w.y2), { i, end: 'E' }); });
  const neighbour = (i, end) => {
    const g0 = geo[i];
    const k = end === 'S' ? key(g0.w.x1, g0.w.y1) : key(g0.w.x2, g0.w.y2);
    const list = at.get(k) || [];
    const other = list.find((r) => r.i !== i);
    return other ? other.i : -1;
  };
  // corner point on `side` (+1 outer / -1 inner) at endpoint `end` of wall i.
  const corner = (i, end, side) => {
    const g0 = geo[i];
    const bx = end === 'S' ? g0.w.x1 : g0.w.x2, by = end === 'S' ? g0.w.y1 : g0.w.y2;
    // OUTWARD closure: outer face = +full thickness; inner face = 0 (ON the measured
    // line). The inner corner therefore lands exactly on the measured room vertex.
    const off = side > 0 ? g0.t : 0;
    const ax = bx + g0.nx * off, ay = by + g0.ny * off;     // this wall's offset point
    const j = neighbour(i, end);
    if (j >= 0) {
      const gj = geo[j];
      const jEnd = (key(gj.w.x1, gj.w.y1) === key(bx, by)) ? 'S' : 'E';
      const jbx = jEnd === 'S' ? gj.w.x1 : gj.w.x2, jby = jEnd === 'S' ? gj.w.y1 : gj.w.y2;
      const jax = jbx + gj.nx * off, jay = jby + gj.ny * off; // neighbour's SAME-side offset point
      const p = lineInt(ax, ay, g0.ux, g0.uy, jax, jay, gj.ux, gj.uy);
      if (p) return p;                                       // mitred shared corner
    }
    return [ax, ay];                                         // free end → flush square cap
  };
  return geo.map((g0, i) => ({
    oS: corner(i, 'S', +1), oE: corner(i, 'E', +1),
    iS: corner(i, 'S', -1), iE: corner(i, 'E', -1),
    freeS: neighbour(i, 'S') < 0, freeE: neighbour(i, 'E') < 0,
    nx: g0.nx, ny: g0.ny, mid: g0.mid, ux: g0.ux, uy: g0.uy, t: g0.t, len: g0.len, w: g0.w,
  }));
}

// Stations (distance along the wall from its start) that a door/window opening
// occupies on wall `w`. Each opening carries wallStartX/Y (the wall it belongs to)
// so it is matched to its host wall exactly as drawElementDims matches items.
// Returns MERGED, sorted [s0,s1] ranges clamped to [0,len] — the wall's poché fill
// is VOIDED across these so the opening reads as a real gap (jambs closed below).
function wallOpeningVoids(p, openings) {
  const w = p.w, len = p.len, ux = p.ux, uy = p.uy;
  const raw = [];
  for (const op of openings || []) {
    if (op.wallStartX == null || op.wallStartY == null) continue;
    if (Math.round(op.wallStartX / 4) !== Math.round(w.x1 / 4) ||
        Math.round(op.wallStartY / 4) !== Math.round(w.y1 / 4)) continue;
    const st = (op.x - w.x1) * ux + (op.y - w.y1) * uy;
    const hw = Math.max(20, Math.abs(op.width || 0) / 2);
    const a = Math.max(0, st - hw), b = Math.min(len, st + hw);
    if (b - a > 1) raw.push([a, b]);
  }
  raw.sort((A, B) => A[0] - B[0]);
  const merged = [];
  for (const v of raw) {
    const last = merged[merged.length - 1];
    if (last && v[0] <= last[1] + 1) last[1] = Math.max(last[1], v[1]);
    else merged.push([v[0], v[1]]);
  }
  return merged;
}

function drawWalls(h, walls, cen, openings) {
  const poly = buildWallPoly(walls, cen);
  let s = '';
  for (const p of poly) {
    const w = p.w, len = p.len, t = p.t;
    const ux = p.ux, uy = p.uy, nx = p.nx, ny = p.ny;
    const iSx = p.iS[0], iSy = p.iS[1];                       // inner (measured) start
    const iP = (d) => [iSx + ux * d, iSy + uy * d];           // inner face @ station d
    const oP = (d) => [iSx + ux * d + nx * t, iSy + uy * d + ny * t]; // outer face @ d
    const voids = wallOpeningVoids(p, openings);
    // Filled sub-segments = complement of the voids within [0,len]. With no opening
    // the single segment [0,len] reproduces the old full-wall band exactly.
    const segs = [];
    let cur = 0;
    for (const [a, b] of voids) { if (a > cur + 1) segs.push([cur, a]); cur = Math.max(cur, b); }
    if (cur < len - 1) segs.push([cur, len]);
    for (const [a, b] of segs) {
      // Use the TRUE mitred corners at the wall ends (0/len) so shared corners stay
      // gap-free; interior cut faces are square (perpendicular to the wall axis).
      const oa = a <= 1 ? p.oS : oP(a), ob = b >= len - 1 ? p.oE : oP(b);
      const ia = a <= 1 ? p.iS : iP(a), ib = b >= len - 1 ? p.iE : iP(b);
      s += solid(h, L.KIROT_FILL, oa, ob, ib, ia);            // poché fill (screened)
      s += line(h, L.KIROT, oa[0], oa[1], ob[0], ob[1]);      // outer face segment
      s += line(h, L.KIROT, ia[0], ia[1], ib[0], ib[1]);      // inner face segment
    }
    // jamb reveals: close the wall band across the depth at each opening edge
    for (const [a, b] of voids) {
      s += line(h, L.KIROT, iP(a)[0], iP(a)[1], oP(a)[0], oP(a)[1]);
      s += line(h, L.KIROT, iP(b)[0], iP(b)[1], oP(b)[0], oP(b)[1]);
    }
    // free-end caps — only where the very end is solid (not an opening at the end)
    const startVoid = voids.length && voids[0][0] <= 1;
    const endVoid = voids.length && voids[voids.length - 1][1] >= len - 1;
    if (p.freeS && !startVoid) s += line(h, L.KIROT, p.oS[0], p.oS[1], p.iS[0], p.iS[1]);
    if (p.freeE && !endVoid) s += line(h, L.KIROT, p.oE[0], p.oE[1], p.iE[0], p.iE[1]);
  }
  return s;
}

// INNER (clear) per-wall dimensions: the MEASURED wall run, UNCHANGED by thickness.
// Reads the true clear dimension (e.g. 4000 / 3000). On SOL-MIDOT-PNIM, nested just
// beyond the outer wall face so it never crosses the room.
// DIMENSION LADDER geometry (owner readability rule 2026-08). All plan/elevation dim
// offsets are expressed in PLOT MILLIMETRES so the ladder looks the SAME at every
// scale: 1 plot-mm = dimTextH/2.5 model-mm (dimTextH plots at 2.5 mm). The ladder is
//   L1 ≈ 8 mm off the geometry (element/opening POSITION chain),
//   L2 ≈ 16 mm (per-wall length, jogs only),
//   L3 ≈ 24 mm (overall CLEAR envelope),  each level +8 mm — a clean, constant gap
// that never lets one chain, its text, or the geometry collide with the next.
function plotMM(dimTextH) { return dimTextH / 2.5; }
function dimLevel(maxT, mm, dimTextH) { return maxT + mm * plotMM(dimTextH); }

function drawWallDims(h, walls, cen, dimTextH) {
  const poly = buildWallPoly(walls, cen);
  let maxT = 0; for (const p of poly) if (p.t > maxT) maxT = p.t;
  const off = dimLevel(maxT, 16, dimTextH);   // L2 — per-wall length (jogs only)
  // Inner (measured) envelope extent per axis — a full-span wall equals it and would
  // just duplicate the overall dimension, so such walls are skipped here (owner:
  // "no mental math / no redundant dims"). Jogged walls (partial spans) keep theirs.
  let iA = [Infinity, Infinity], iB = [-Infinity, -Infinity];
  for (const p of poly) for (const q of [[p.w.x1, p.w.y1], [p.w.x2, p.w.y2]]) {
    iA = [Math.min(iA[0], q[0]), Math.min(iA[1], q[1])];
    iB = [Math.max(iB[0], q[0]), Math.max(iB[1], q[1])];
  }
  const spanX = iB[0] - iA[0], spanY = iB[1] - iA[1];
  let s = '';
  for (const p of poly) {
    const w = p.w;
    const len = w.length || p.len;
    const horizontal = Math.abs(p.ux) >= Math.abs(p.uy);
    const axisSpan = horizontal ? spanX : spanY;
    if (Math.abs(len - axisSpan) <= 10) continue;   // full-span → covered by the envelope
    // outward side = +1 if the wall's outward normal points away from centroid
    const side = ((p.mid[0] - cen[0]) * p.nx + (p.mid[1] - cen[1]) * p.ny) >= 0 ? 1 : -1;
    s += dimension(h, L.MIDOT_PNIM, [w.x1, w.y1], [w.x2, w.y2],
      { off, side, textH: dimTextH, value: cm(len) });
  }
  return s;
}

// Element positions as a CONSOLIDATED chain per wall: project every element that
// belongs to a wall onto that wall, then dimension wall-start → e1 → e2 → … → wall-end
// as one running string nested just OUTSIDE the wall face (inside the wall-length
// chain). Replaces the old tangle of per-element diagonal dims.
function drawElementDims(h, walls, items, openings, cen, dimTextH) {
  const poly = buildWallPoly(walls, cen);
  let maxT = 0; for (const p of poly) if (p.t > maxT) maxT = p.t;
  const innerOff = dimLevel(maxT, 8, dimTextH);   // L1 — position chain, closest to the wall
  const th = dimTextH * 0.72;
  const minSeg = dimTextH * 1.2;                  // skip sub-text-width gaps (text would overlap)
  const onWall = (rec, w) => rec.wallStartX != null && rec.wallStartY != null &&
    Math.round(rec.wallStartX / 4) === Math.round(w.x1 / 4) &&
    Math.round(rec.wallStartY / 4) === Math.round(w.y1 / 4);
  let s = '';
  for (const p of poly) {
    const w = p.w;
    const ox = w.x1, oy = w.y1;                              // wall start = station 0
    const clamp = (d) => Math.max(0, Math.min(p.len, d));
    const proj = (rec) => (rec.x - ox) * p.ux + (rec.y - oy) * p.uy;
    const raw = [];
    // element centres…
    for (const it of items) if (onWall(it, w)) raw.push(clamp(proj(it)));
    // …plus BOTH jambs of every door/window on this wall, so the position string
    // reads: start→jamb, opening-width, jamb→next, … as ONE clean chain (replaces
    // the old per-opening offset+width dims that stacked on top of each other).
    for (const op of openings || []) if (onWall(op, w)) {
      const st = proj(op), hw = Math.max(20, Math.abs(op.width || 0) / 2);
      raw.push(clamp(st - hw)); raw.push(clamp(st + hw));
    }
    if (!raw.length) continue;
    const side = ((p.mid[0] - cen[0]) * p.nx + (p.mid[1] - cen[1]) * p.ny) >= 0 ? 1 : -1;
    const stations = raw.sort((a, b) => a - b)
      .filter((v, i, a) => i === 0 || v - a[i - 1] > 30);     // drop near-duplicates
    let prev = 0;
    const pAt = (d) => [ox + p.ux * d, oy + p.uy * d];
    for (const st of stations) {
      if (st - prev > minSeg) s += dimension(h, L.MIDOT_PNIM, pAt(prev), pAt(st), { off: innerOff, side, textH: th });
      prev = st;
    }
    if (p.len - prev > minSeg) s += dimension(h, L.MIDOT_PNIM, pAt(prev), pAt(p.len), { off: innerOff, side, textH: th });
  }
  return s;
}

// Overall (envelope) dimensions.  OWNER RULE (2026-08): the PRIMARY, DEFAULT overall
// dimension is the CLEAR (measured interior) envelope — the value the surveyor
// actually measured and the carpenter builds against (e.g. 400×300 cm) — NOT the
// wall-thickness-inflated outer sum (420×320), which misleads the carpenter. So by
// default ONLY the inner clear envelope is drawn (SOL-MIDOT-PNIM).
//   The outer overall (outer face → outer face = clear + 2·t) is drawn ONLY when
// explicitly requested (opts.outerDims === true) and is then CLEARLY LABELLED with an
// "OA " (Overall) prefix on its own SOL-MIDOT-CHUTS layer, so it can never be mistaken
// for the room's real measured size.
function drawOverallDims(h, walls, cen, dimTextH, opts) {
  opts = opts || {};
  const poly = buildWallPoly(walls, cen);
  let maxT = 0; for (const p of poly) if (p.t > maxT) maxT = p.t;
  // inner (measured / CLEAR) envelope from the measured wall endpoints
  let iA = [Infinity, Infinity], iB = [-Infinity, -Infinity];
  // outer envelope from the outer + inner face corners (outer faces dominate)
  let oA = [Infinity, Infinity], oB = [-Infinity, -Infinity];
  for (const p of poly) {
    for (const q of [[p.w.x1, p.w.y1], [p.w.x2, p.w.y2]]) {
      iA = [Math.min(iA[0], q[0]), Math.min(iA[1], q[1])];
      iB = [Math.max(iB[0], q[0]), Math.max(iB[1], q[1])];
    }
    for (const q of [p.oS, p.oE, p.iS, p.iE]) {
      oA = [Math.min(oA[0], q[0]), Math.min(oA[1], q[1])];
      oB = [Math.max(oB[0], q[0]), Math.max(oB[1], q[1])];
    }
  }
  const inOff = dimLevel(maxT, 24, dimTextH);   // L3 — overall CLEAR envelope
  let s = '';
  // PRIMARY: inner clear envelope (the real measured room size) — always drawn.
  s += dimension(h, L.MIDOT_PNIM, [iA[0], iA[1]], [iB[0], iA[1]], { off: inOff, side: -1, textH: dimTextH });
  s += dimension(h, L.MIDOT_PNIM, [iA[0], iA[1]], [iA[0], iB[1]], { off: inOff, side: 1, textH: dimTextH });
  // OPTIONAL: outer overall envelope, clearly labelled "OA <value>" so it is never
  // read as the measured room dimension. Off by default (owner rule).
  if (opts.outerDims === true) {
    const outOff = dimLevel(maxT, 32, dimTextH);   // L4 — outer overall, only if requested
    s += dimension(h, L.MIDOT_CHUTS, [oA[0], oA[1]], [oB[0], oA[1]], { off: outOff, side: -1, textH: dimTextH, value: 'OA ' + cm(oB[0] - oA[0]) });
    s += dimension(h, L.MIDOT_CHUTS, [oA[0], oA[1]], [oA[0], oB[1]], { off: outOff, side: 1, textH: dimTextH, value: 'OA ' + cm(oB[1] - oA[1]) });
  }
  return s;
}

// A dashed LINE (linetype override group 6=HIDDEN) — pocket/concealed leaves +
// sliding tracks read as hidden runs, per DOORS_WINDOWS_DISPLAY.
function dline(h, layer, x1, y1, x2, y2) {
  return g(0, 'LINE') + g(5, h()) + g(8, layerOut(layer)) + g(6, 'HIDDEN') +
    g(10, num(x1)) + g(20, num(y1)) + g(30, num(0)) +
    g(11, num(x2)) + g(21, num(y2)) + g(31, num(0));
}
// Draw ONE parametric door/window opening on the plan from its derived schema
// fields (frame/משקוף from frameThickness+frameReveal; leaf+swing from openMode/
// hingeSide/swing/leafCount). `mark` = its schedule tag (D#/W#); `dl` = the element-
// coloured dim sub-layer; `dimReg`/`elemN` register that sub-layer. Returns
// { dxf, kinds:[…] } where kinds lists the geometry pieces produced (for reporting).
function drawOpening(h, op, dimTextH, opts) {
  opts = opts || {};
  const d = op.__derived || (op.__derived = OPEN.deriveOpening(op));
  // v7: doors and windows are now SEPARATE disciplines so they toggle apart.
  const layer = d.kind === 'window' ? L.CHALON : L.DELET;   // SOL-CHALON-SYM / SOL-DELET-SYM
  const hidLayer = kindLayer(layer, 'HID');                 // concealed / pocket / track (dashed)
  const produced = [];
  let s = '';
  const a = (op.rotation_deg || 0) * Math.PI / 180;
  const ux = Math.cos(a), uy = Math.sin(a);            // along wall
  let nx = -uy, ny = ux;                               // across wall (nominally into room)
  const c = [op.x, op.y];
  const W = d.geom.width;                              // light opening width (along wall)
  const ft = Math.min(d.geom.frameThickness, W * 0.4); // frame member (reduces the light)
  const hd = Math.max(20, d.geom.frameReveal) / 2;     // half reveal (across the wall)
  const hw = W / 2;
  // point at (along ∈ [-hw,hw], across ∈ [-hd,hd]) from the opening centre.
  const P = (al, ac) => [c[0] + ux * al + nx * ac, c[1] + uy * al + ny * ac];
  // Which across-sign points INTO the room (toward the plan centroid) — so a door
  // leaf swings into the room by default, never out into the wall/exterior. Falls
  // back to +1 when no centroid is supplied.
  const toRoom = (opts.cen && ((opts.cen[0] - c[0]) * nx + (opts.cen[1] - c[1]) * ny) < 0) ? -1 : 1;

  // ---- FRAME / משקוף --------------------------------------------------------
  // Outer reveal rectangle (the opening cut in the wall, spanning the reveal depth).
  const drawFrame = !d.noFrame;
  if (drawFrame) {
    s += polyline(h, layer, [P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd), P(-hw, -hd)]);
    // jamb members: inner edge of each side jamb (both jambs → the door "U"; a
    // window also gets head+sill members below → four-sided frame).
    s += line(h, layer, P(-hw + ft, -hd)[0], P(-hw + ft, -hd)[1], P(-hw + ft, hd)[0], P(-hw + ft, hd)[1]);
    s += line(h, layer, P(hw - ft, -hd)[0], P(hw - ft, -hd)[1], P(hw - ft, hd)[0], P(hw - ft, hd)[1]);
    produced.push('frame(jambs, reveal ' + Math.round(d.geom.frameReveal) + ', profile ' + Math.round(ft) + ')');
  }
  const clearW = drawFrame ? Math.max(1, W - 2 * ft) : W;    // light width between jambs
  const jL = drawFrame ? -hw + ft : -hw, jR = drawFrame ? hw - ft : hw; // clear-opening jambs (along)
  // A real door leaf (דלת) that resolved to a frame-only "passage" still deserves a
  // swing on the plan — a plan without door swings does not read as professional.
  // Upgrade mode → hinged when the element is named as a door AND is not explicitly a
  // framed passage/doorway (מפתח / מעבר / arch / bar), using sensible L-hinge/in-swing
  // defaults. Genuine doorways (מפתח עם משקוף) are left as passages.
  let mode = d.config.openMode;
  if (d.kind === 'door' && mode === 'none') {
    const nm = [op.he, op.name, op.heName, op.description].filter(Boolean).join(' ');
    const passage = /מעבר|מפתח|פתח\b|קשת|\barch\b|\bbar\b|counter|pass/i.test(nm);
    const leafDoor = /דלת|\bdoor\b/i.test(nm);
    if (leafDoor && !passage) mode = 'hinged';
  }

  if (d.kind === 'window') {
    // four-sided frame: head + sill members inset by ft (across), + glazing.
    if (drawFrame) {
      s += line(h, layer, P(jL, -hd + ft)[0], P(jL, -hd + ft)[1], P(jR, -hd + ft)[0], P(jR, -hd + ft)[1]);
      s += line(h, layer, P(jL, hd - ft)[0], P(jL, hd - ft)[1], P(jR, hd - ft)[0], P(jR, hd - ft)[1]);
      produced.push('frame(head+sill)');
    }
    // glazing: a DOUBLE line down the centre of the light (double-glazed / IGU) —
    // the classic four-parallel-line window symbol (reveal edges + two panes).
    const gg = Math.max(8, hd * 0.28);
    s += line(h, layer, P(jL, -gg)[0], P(jL, -gg)[1], P(jR, -gg)[0], P(jR, -gg)[1]);
    s += line(h, layer, P(jL, gg)[0], P(jL, gg)[1], P(jR, gg)[0], P(jR, gg)[1]);
    produced.push('glazing(double)');
    if (mode === 'mamad') {                              // ממ״ד: thick blast frame ring
      s += polyline(h, layer, [P(jL, -hd + ft * 0.4), P(jR, -hd + ft * 0.4), P(jR, hd - ft * 0.4), P(jL, hd - ft * 0.4), P(jL, -hd + ft * 0.4)]);
      produced.push('mamad-blast-frame');
    } else if (mode === 'sliding') {                     // horizontal slide arrows
      s += arrowGlyph(h, layer, P(-hw * 0.4, 0), [ux, uy], [nx, ny], W * 0.06);
      s += arrowGlyph(h, layer, P(hw * 0.4, 0), [-ux, -uy], [nx, ny], W * 0.06);
      produced.push('slide-arrows');
    } else if (mode === 'kip') {                         // tilt+turn: triangle + turn arc
      s += polyline(h, layer, [P(jL, hd - ft), P(0, 0), P(jR, hd - ft)]);
      s += arc(h, layer, P(jL, 0)[0], P(jL, 0)[1], clearW, Math.atan2(uy, ux) * 180 / Math.PI, Math.atan2(ny, nx) * 180 / Math.PI);
      produced.push('kip(tilt+turn)');
    } else if (mode === 'hung') {                        // double-hung: vertical arrow
      s += line(h, layer, P(0, -hd + ft)[0], P(0, -hd + ft)[1], P(0, hd - ft)[0], P(0, hd - ft)[1]);
      s += arrowGlyph(h, layer, P(0, -hd + ft), [-nx, -ny], [ux, uy], W * 0.05);
      s += arrowGlyph(h, layer, P(0, hd - ft), [nx, ny], [ux, uy], W * 0.05);
      produced.push('hung-arrow');
    } else if (mode === 'casement') {                    // casement: single hinge arc
      s += swingArc(h, layer, P(d.config.hingeSide === 'R' ? jR : jL, 0), [ux, uy], [nx, ny], clearW, d.config.hingeSide === 'R');
      produced.push('casement-arc');
    }
  } else {
    // ---- DOOR: leaf + swing ------------------------------------------------
    // threshold line across the light (closed-door sill)
    s += line(h, layer, P(jL, 0)[0], P(jL, 0)[1], P(jR, 0)[0], P(jR, 0)[1]);
    // swing direction (across): default INTO the room (toward centroid); flip only
    // when the element explicitly says it opens out.
    const sIn = d.config.swing !== 'out';
    const acs = (sIn ? 1 : -1) * toRoom;                 // across sign of the open leaf
    if (mode === 'hinged') {
      const rightHinge = d.config.hingeSide === 'R';
      const hx = rightHinge ? jR : jL;                  // hinge jamb (along)
      const hP = P(hx, 0);
      // Leaf drawn as a thin PANEL (shows real leaf thickness) swung 90° open —
      // the professional convention, not a bare centreline. Thickness runs toward
      // the latch jamb; concealed doors keep the leaf dashed on the hidden layer.
      const lt = Math.min(d.geom.leafThickness || 40, clearW * 0.5);
      const tdir = rightHinge ? -1 : 1;
      const panel = [P(hx, 0), P(hx, acs * clearW), P(hx + tdir * lt, acs * clearW), P(hx + tdir * lt, 0), P(hx, 0)];
      if (d.dashed) { for (let i = 1; i < panel.length; i++) s += dline(h, hidLayer, panel[i - 1][0], panel[i - 1][1], panel[i][0], panel[i][1]); }
      else s += polyline(h, layer, panel);
      // ממ״ד: a second inner line reads the heavy steel leaf.
      if (d.mamad) s += line(h, layer, P(hx + tdir * lt * 0.5, 0)[0], P(hx + tdir * lt * 0.5, 0)[1], P(hx + tdir * lt * 0.5, acs * clearW)[0], P(hx + tdir * lt * 0.5, acs * clearW)[1]);
      s += swingArc(h, layer, hP, [rightHinge ? -ux : ux, rightHinge ? -uy : uy], [nx * acs, ny * acs], clearW, false);
      produced.push('hinged-leaf-panel+arc(' + (rightHinge ? 'R' : 'L') + ',' + (sIn ? 'in' : 'out') + (d.dashed ? ',concealed' : '') + (d.mamad ? ',mamad' : '') + ')');
    } else if (mode === 'double') {
      const half = clearW / 2;
      const lt = Math.min(d.geom.leafThickness || 40, half * 0.5);
      // left leaf hinged at jL (thickness toward centre), right leaf hinged at jR —
      // both drawn as thin panels meeting the centre, each with its quarter arc.
      const lP = P(jL, 0), rP = P(jR, 0);
      s += polyline(h, layer, [P(jL, 0), P(jL, acs * half), P(jL + lt, acs * half), P(jL + lt, 0), P(jL, 0)]);
      s += polyline(h, layer, [P(jR, 0), P(jR, acs * half), P(jR - lt, acs * half), P(jR - lt, 0), P(jR, 0)]);
      s += swingArc(h, layer, lP, [ux, uy], [nx * acs, ny * acs], half, false);
      s += swingArc(h, layer, rP, [-ux, -uy], [nx * acs, ny * acs], half, false);
      produced.push('double-leaf-panels+arcs');
    } else if (mode === 'sliding') {
      // leaf offset into the room, a track line, a slide arrow
      const off = ft * 1.2 + 30;
      s += polyline(h, layer, [P(-hw * 0.1, off), P(jR + off, off), P(jR + off, off + 60), P(-hw * 0.1, off + 60), P(-hw * 0.1, off)]);
      s += dline(h, hidLayer, P(-hw, off * 0.6)[0], P(-hw, off * 0.6)[1], P(hw, off * 0.6)[0], P(hw, off * 0.6)[1]);
      s += arrowGlyph(h, layer, P(hw * 0.6, off + 30), [ux, uy], [nx, ny], W * 0.05);
      produced.push('sliding-leaf+track');
    } else if (mode === 'pocket') {
      // leaf retracts (dashed) into a wall pocket beside the opening; slide arrow.
      s += dline(h, hidLayer, P(0, 0)[0], P(0, 0)[1], P(hw, 0)[0], P(hw, 0)[1]);         // exposed half-leaf run
      s += dline(h, hidLayer, P(hw, -hd * 0.5)[0], P(hw, -hd * 0.5)[1], P(hw + clearW, -hd * 0.5)[0], P(hw + clearW, -hd * 0.5)[1]); // pocket in wall
      s += arrowGlyph(h, layer, P(hw * 0.5, 0), [ux, uy], [nx, ny], W * 0.05);
      produced.push('pocket-into-wall(dashed)');
    } else if (mode === 'folding') {
      // accordion zig-zag across the opening
      const n = Math.max(2, d.config.leafCount || 4);
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const al = jL + (jR - jL) * i / n;
        const ac = (i % 2 === 0) ? 0 : acs * clearW * 0.28;
        pts.push(P(al, ac));
      }
      s += polyline(h, layer, pts);
      produced.push('folding-zigzag(' + n + ')');
    } else {
      // mode 'none' (passage / doorway w/o frame / arch): just the light opening,
      // frame optional; nothing else to draw.
      produced.push('passage(no-leaf)');
    }
  }

  // ---- DIMENSIONS ------------------------------------------------------------
  // Opening WIDTH + wall-start OFFSET are NOT dimensioned per-opening here (that
  // stacked several strings on top of each other at the same offset). Instead the
  // plan draws ONE consolidated position chain per wall (drawElementDims, openings
  // mode) whose segments read start→jamb, opening-width, jamb→next, … — the clean
  // professional string. Only the D#/W# mark stays with the opening.
  // ---- MARK (D#/W#) keyed to the spec table ---------------------------------
  if (opts.mark) {
    const mp = P(0, hd + dimTextH * 1.4);
    s += text(h, kindLayer(layer, 'TXT'), opts.mark, mp[0], mp[1], dimTextH * 1.0, 0, 1, 2);
    produced.push('mark ' + opts.mark);
  }
  return { dxf: s, produced };
}
// A small SOLID arrowhead at `tip`, pointing along unit dir, with normal nrm.
function arrowGlyph(h, layer, tip, dir, nrm, len) {
  len = Math.max(40, len || 60); const wid = len * 0.5;
  const base = [tip[0] - dir[0] * len, tip[1] - dir[1] * len];
  const b1 = [base[0] + nrm[0] * wid, base[1] + nrm[1] * wid];
  const b2 = [base[0] - nrm[0] * wid, base[1] - nrm[1] * wid];
  return solid(h, layer, tip, b1, b2, b2);
}
// A quarter swing ARC (the fixed geometry): centre = hinge, radius = leaf length,
// sweeping the 90° from the closed (along `alongDir`) position to the open (along
// `openDir`) position. Emits a real DXF ARC (a0→a1 CCW = the minor quarter).
function swingArc(h, layer, hinge, alongDir, openDir, r, _unused) {
  const ca = Math.atan2(alongDir[1], alongDir[0]) * 180 / Math.PI;   // closed
  const oa = Math.atan2(openDir[1], openDir[0]) * 180 / Math.PI;     // open
  let d = ((oa - ca) % 360 + 360) % 360;                             // CCW ca→oa
  // pick a0,a1 so the CCW sweep is the ~90° quarter (the minor arc).
  const a0 = (d <= 180) ? ca : oa, a1 = (d <= 180) ? oa : ca;
  return arc(h, layer, hinge[0], hinge[1], r, a0, a1);
}

// Draw one placed element on the PLAN as its Soline SYMBOL only (INSERT of the
// per-(type,size) block) on its discipline layer. NO Hebrew text on the drawing:
// all naming lives in the legend (owner fix #2); dimensions live on the elevations.
function drawElement(h, it, dimTextH, opts, symBlocks) {
  const info = symInfo(it);
  const rot = it.rotation_deg || 0;
  const bname = symBlockName(info.key, info.W, info.H);
  if (!symBlocks.has(bname)) symBlocks.set(bname, SYM.toDxf2dGlyph(info.base, { w: info.W, h: info.H }) || []);
  return insert(h, info.layer, bname, it.x, it.y, rot, 1, 1);
}

// Scale denominator (§4): from opts.scale ("1:50" or 50) or opts.title.scale;
// default 50. Drives the scale-aware text heights.
function scaleDenom(opts) {
  const pick = (v) => { if (v == null) return null; const n = parseFloat(String(v).replace(/^\s*1\s*:\s*/, '')); return n > 0 ? n : null; };
  return pick(opts && opts.scale) || pick(opts && opts.title && opts.title.scale) || 50;
}

// Hebrew opening TYPE from the DOORS_WINDOWS_CATALOG vocabulary — classified from
// the opening's own name / description keywords.
function openingTypeHe(op) {
  const s = [op.he, op.name, op.type, op.description].filter(Boolean).join(' ');
  if (op.kind === 'window') {
    if (/הזזה|slid/i.test(s)) return 'חלון הזזה';
    if (/קיפ|tilt.?turn/i.test(s)) return 'חלון קיפ';
    if (/ציר|casement|מדף/i.test(s)) return 'חלון ציר';
    if (/קבוע|fixed/i.test(s)) return 'חלון קבוע';
    if (/פינת|corner/i.test(s)) return 'חלון פינתי';
    return 'חלון';
  }
  if (/הזזה|slid/i.test(s)) return 'דלת הזזה';
  if (/כניס|entr/i.test(s)) return 'דלת כניסה';
  if (/ממ.?ד|mamad|safety/i.test(s)) return 'דלת ממ"ד';
  if (/צרפת|french/i.test(s)) return 'דלת צרפתית';
  if (/כפול|double/i.test(s)) return 'דלת כפולה';
  if (/פנים|interior/i.test(s)) return 'דלת פנים';
  if (/מעבר|doorway|ללא\s*מש/i.test(s)) return 'מעבר';
  return 'דלת ציר';
}
// Hebrew opening TYPE from the resolved symbol key + openMode (used by the spec
// table so its rows describe the ACTUAL rendered type, not just a keyword guess).
const TYPE_HE_BY_KEY = {
  door_hinged_l: 'דלת פנים שמאל', door_hinged_r: 'דלת פנים ימין',
  door_interior_90: 'דלת פנים', door_entrance: 'דלת כניסה', door_concealed: 'דלת נסתרת',
  door_mamad: 'דלת ממ"ד', door_frame: 'מלבן דלת', doorway_frame: 'פתח עם משקוף',
  doorway_noframe: 'פתח ללא משקוף', door_double: 'דלת כפולה', door_sliding: 'דלת הזזה',
  door_pocket: 'דלת כיס', door_folding: 'דלת מתקפלת',
  passage: 'מעבר', arch: 'קשת', half_arch: 'חצי-קשת', lowered_passage: 'מעבר מונמך',
  pass_through: 'פתח שירות', bar_counter: 'דלפק-מעבר',
  window: 'חלון', interior_window: 'חלון פנימי', window_sliding: 'חלון הזזה',
  window_casement: 'חלון ציר', window_tilt: 'חלון נטוי', window_kip: 'חלון קיפ',
  window_hung: 'חלון גיליון', window_mamad: 'חלון ממ"ד', window_storefront: 'ויטרינה',
  window_corner: 'חלון פינתי', window_small: 'חלונית', window_porthole: 'צוהר',
  window_glassblock: 'בלוקי זכוכית',
};
function openingTypeHeFromKey(symKey, mode, kind) {
  return TYPE_HE_BY_KEY[symKey] || (kind === 'window' ? 'חלון' : 'דלת');
}
// Hebrew opening DIRECTION (hinge side + swing) from keywords; '-' when unknown.
function openingDirHe(op) {
  const s = [op.he, op.name, op.type, op.description].filter(Boolean).join(' ');
  const hinge = /שמאל|\bleft\b/i.test(s) ? 'שמאל' : (/ימין|\bright\b/i.test(s) ? 'ימין' : '');
  const swing = /החוצה|\bout\b/i.test(s) ? 'החוצה' : (/פנימה|\bin\b/i.test(s) ? 'פנימה' : '');
  const d = [hinge, swing].filter(Boolean).join(' ');
  return d || '-';
}

// BOM + LEGEND (מקרא וספירת אלמנטים) — the dedicated counted schedule (owner fix
// #2: Hebrew lives here, not on the drawing area). Symbols are grouped BY DISCIPLINE
// with a per-discipline subtotal; each row = real Soline symbol swatch + count +
// Hebrew name. This is the professional automatic BOM (DXF_PRO §6 legend + §9 BOM).
function drawBOM(h, items, openings, x, y, textH, thHead, symBlocks) {
  symBlocks = symBlocks || new Map();
  const groups = new Map();     // discipline -> Map(symKey -> { info, he, count })
  for (const it of [...(items || []), ...(openings || [])]) {
    const info = symInfo(it);
    const disc = info.base.discipline || 'misc';
    if (!groups.has(disc)) groups.set(disc, new Map());
    const m = groups.get(disc);
    const rec = m.get(info.key);
    if (rec) rec.count += 1;
    else m.set(info.key, { info, he: it.he || it.name || info.key, count: 1 });
  }
  if (!groups.size) return { dxf: '', height: 0, width: 0 };
  const rowH = textH * 2.6, w = textH * 22;
  let totalRows = 0;
  for (const m of groups.values()) totalRows += 1 + m.size;      // 1 disc-header + N type rows
  const boxH = rowH * (totalRows + 1.8);
  let s = '';
  s += polyline(h, L.MISGERET, [[x, y], [x + w, y], [x + w, y - boxH], [x, y - boxH], [x, y]]);
  s += line(h, L.MISGERET, x, y - rowH * 1.2, x + w, y - rowH * 1.2);
  s += text(h, L.TEKST, 'מקרא וספירת אלמנטים', x + w - textH * 0.6, y - rowH * 0.72, thHead, 0, 2, 2);
  let ry = y - rowH * 1.75;
  const swatch = textH * 1.7;
  for (const disc of [...groups.keys()].sort()) {
    const m = groups.get(disc);
    let gtot = 0; for (const r of m.values()) gtot += r.count;
    // discipline header (Hebrew name + subtotal), right-aligned
    s += text(h, L.TEKST, (DISC_HE[disc] || disc) + '  (' + gtot + ')', x + w - textH * 0.6, ry, textH * 1.05, 0, 2, 2);
    ry -= rowH;
    for (const r of [...m.values()].sort((a, b) => b.count - a.count)) {
      // סוואטש-המקרא גם הוא INSERT של בלוק-סמל (אותה שפת-בלוקים), כדי שאף פרימיטיב-
      // גליף בודד לא יישאר במרחב-המודל — הפריסה זהה (אותה נקודת-שיבוץ וגאומטריה).
      const sname = symBlockName(r.info.key, swatch, swatch);
      if (!symBlocks.has(sname)) symBlocks.set(sname, SYM.toDxf2dGlyph(r.info.base, { w: swatch, h: swatch }) || []);
      s += insert(h, r.info.layer, sname, x + textH * 2.2, ry - swatch * 0.42, 0, 1, 1);
      s += text(h, L.TEKST, 'x' + r.count, x + textH * 4.6, ry, textH * 0.9, 0, 0, 2);
      s += text(h, L.TEKST, r.he, x + w - textH * 0.6, ry, textH, 0, 2, 2);
      ry -= rowH;
    }
  }
  return { dxf: s, height: boxH, width: w };
}

// WINDOW & DOOR SPECIFICATION TABLE (טבלת מפרט פתחים) — a vendor-facing schedule:
// mark/ID, Hebrew type, width×height, opening direction, count. Identical openings
// (type+size+direction) merge to one row with a running mark (D1.. / W1..) and a
// quantity (DXF_PRO §3 spec tables / DOORS_WINDOWS_CATALOG vocabulary).
function drawSpecTable(h, openings, x, y, textH, thHead) {
  const ops = (openings || []).filter(Boolean);
  if (!ops.length) return { dxf: '', height: 0, width: 0 };
  // Shared mark assignment (same D#/W# the plan stamps on each opening).
  const list = OPEN.assignMarks(ops).rows.map((r) => ({
    kind: r.kind, typ: openingTypeHeFromKey(r.symKey, r.mode, r.kind),
    W: r.W, H: r.H, dir: r.dir, count: r.count, mark: r.mark,
  }));
  const w = textH * 22, rowH = textH * 2.4;
  const boxH = rowH * (list.length + 2.6);
  // right-aligned column right-edges (RTL read order: mark, type, size, dir, qty)
  const cMark = x + w * 0.97, cType = x + w * 0.80, cSize = x + w * 0.55, cDir = x + w * 0.32, cQty = x + w * 0.13;
  let s = '';
  s += polyline(h, L.MISGERET, [[x, y], [x + w, y], [x + w, y - boxH], [x, y - boxH], [x, y]]);
  s += line(h, L.MISGERET, x, y - rowH * 1.2, x + w, y - rowH * 1.2);
  s += text(h, L.TEKST, 'טבלת מפרט פתחים', x + w - textH * 0.6, y - rowH * 0.72, thHead, 0, 2, 2);
  let ry = y - rowH * 1.8;
  const th = textH * 0.9;
  const cell = (t, cx, layer) => text(h, layer || L.TEKST, t, cx, ry, th, 0, 2, 2);
  // header
  s += cell('מס\'', cMark) + cell('סוג', cType) + cell('רוחבxגובה', cSize) + cell('כיוון', cDir) + cell('כמות', cQty);
  s += line(h, L.TEKST, x + textH * 0.4, ry - rowH * 0.55, x + w - textH * 0.4, ry - rowH * 0.55);
  ry -= rowH;
  for (const r of list) {
    s += cell(r.mark, cMark, L.MISGERET);           // mark (ASCII)
    s += cell(r.typ, cType);                         // Hebrew type
    s += cell(r.W + 'x' + r.H, cSize, L.MISGERET);   // size (ASCII)
    s += cell(r.dir, cDir);                          // Hebrew direction
    s += cell('x' + r.count, cQty, L.MISGERET);      // qty (ASCII)
    ry -= rowH;
  }
  return { dxf: s, height: boxH, width: w };
}

// Title block — ASCII labels (owner fix #2: the drawing area stays Hebrew-free; the
// BOM/spec tables carry Hebrew). A framed sheet strip with a heavy outer border,
// a logo strip (Soline wordmark + reference to the official brand PNG), and the full
// professional field set: project / client / address / drawing / scale / date /
// surveyor / checked / drawing number / sheet number / revision (DXF_PRO §6).
function ascii(v) { return String(v == null ? '' : v).replace(/[^\x00-\x7F]+/g, '').trim() || '-'; }
function drawTitleBlock(h, x, y, textH, thTitle, title, roomName) {
  const t = title || {};
  const fields = [
    ['Project', ascii(t.project || roomName)],
    ['Client', ascii(t.client)],
    ['Address', ascii(t.address || t.site)],
    ['Drawing', 'Measurement Plan'],
    ['Scale', ascii(t.scale || '1:50') + '  (mm)'],
    ['Date', ascii(t.date)],
    ['Surveyor', ascii(t.measurer || t.surveyor)],
    ['Checked', ascii(t.checkedBy || t.approver)],
    ['Drawing No', ascii(t.drawingNo || 'M-01')],
    ['Sheet', ascii(t.sheet || '1/1')],
    ['Revision', ascii(t.rev || '0')],
  ];
  const w = textH * 22, rowH = textH * 1.95, logoH = rowH * 2.3;
  const boxH = logoH + rowH * fields.length + rowH * 0.6;
  let s = '';
  // heavy outer frame (per-entity lineweight override)
  s += polyline(h, L.MISGERET, [[x, y], [x + w, y], [x + w, y - boxH], [x, y - boxH], [x, y]], LW_BORDER);
  // logo strip + placeholder logo box + wordmark + brand-file reference note
  s += line(h, L.MISGERET, x, y - logoH, x + w, y - logoH);
  const lb = textH * 4.6;
  s += polyline(h, L.MISGERET, [
    [x + textH * 0.6, y - logoH + textH * 0.5], [x + textH * 0.6 + lb, y - logoH + textH * 0.5],
    [x + textH * 0.6 + lb, y - textH * 0.5], [x + textH * 0.6, y - textH * 0.5], [x + textH * 0.6, y - logoH + textH * 0.5],
  ]);
  s += text(h, L.MISGERET, 'SOLINE', x + textH * 1.2 + lb, y - logoH * 0.44, thTitle, 0, 0, 2);
  s += text(h, L.TEKST, 'brand/soline-logo.png', x + textH * 0.6 + lb * 0.5, y - logoH * 0.82, textH * 0.55, 0, 1, 2);
  // fields (label left, value right)
  let ry = y - logoH - rowH * 0.7;
  for (const [k, v] of fields) {
    s += text(h, L.MISGERET, k + ':', x + textH * 0.6, ry, textH * 0.82, 0, 0, 2);
    s += text(h, L.MISGERET, v, x + w - textH * 0.6, ry, textH * 0.88, 0, 2, 2);
    ry -= rowH;
  }
  return { dxf: s, width: w, height: boxH };
}

// North arrow + a simple graphic scale bar.
function drawNorthAndScale(h, x, y, textH) {
  let s = '';
  const arrowLen = textH * 5;
  s += line(h, L.MISGERET, x, y, x, y + arrowLen);
  s += solid(h, L.MISGERET, [x, y + arrowLen], [x - textH * 0.5, y + arrowLen - textH], [x + textH * 0.5, y + arrowLen - textH]);
  s += text(h, L.MISGERET, 'N', x, y + arrowLen + textH * 0.3, textH * 1.1, 0, 1, 3);
  // scale bar: 1 m segments (1000 mm), 4 segments
  const seg = 1000, n = 4, by = y - textH * 1.5;
  // draw a real 1m/2m bar in plan units (mm) with ticks
  const bx = x - textH * 3;
  s += line(h, L.MISGERET, bx, by, bx + seg * n / 5, by);
  for (let i = 0; i <= n; i++) { const xx = bx + i * (seg / 5); s += line(h, L.MISGERET, xx, by, xx, by - textH * 0.5); }
  s += text(h, L.MISGERET, '0', bx, by - textH * 1.6, textH * 0.7, 0, 1, 0);
  s += text(h, L.MISGERET, (n / 5 * seg / 1000).toFixed(1) + ' m', bx + seg * n / 5, by - textH * 1.6, textH * 0.7, 0, 2, 0);
  return s;
}

// ---------------------------------------------------------------------------
// Wall ELEVATIONS (חזיתות). One front view per wall, laid out in a row: the wall
// as a length×height rectangle and every element as its true-size Soline SYMBOL at
// its real position. Dimensions are STANDALONE (final absolute values, no chain):
//   * point element  -> corner->CENTRE (horizontal) + floor->CENTRE (vertical)
//   * opening/large  -> corner->edge + full width + sill + full height (+ head +
//                       from-ceiling for windows)
// Each element's dim lines go on their OWN sub-layer `SOL-DIM-<DISC>-<n>` coloured
// to the element's discipline, so the carpenter can isolate one element; offsets
// are staggered so all-on stays readable (owner fix #3). NO Hebrew on the drawing
// (owner fix #2) — walls are labelled W1..Wn (ASCII); naming lives in the legend.
// `dimReg` (Map name->color) collects the per-element dim layers for the table.
// Returns { dxf, width, top, bottom }.
// ---------------------------------------------------------------------------
// ---- ONE wall elevation, drawn in a LOCAL frame: floor line on y=0, wall rises to
// +Hw, left jamb at x=0. Dimensions are pushed OFF the geometry into clean ladders so
// nothing stacks on the wall face or on another dim (owner fix #1):
//   * wall LENGTH  — one chain just below the floor (outermost bottom-most)
//   * wall HEIGHT  — one chain just left of the wall
//   * element POSITION (corner→centre/edge) — a stacked ladder further BELOW the floor
//   * element MOUNT height — a stacked ladder further LEFT of the wall
//   * opening WIDTH — above the head; opening HEIGHT/head — a stacked ladder to the RIGHT
// `wallN` sets the W# label. Returns { dxf } with everything in the local frame; the
// caller measures its true bbox and translates it into the elevations band.
function drawOneElevation(h, w, wallN, all, dimTextH, dimReg, symBlocks) {
  symBlocks = symBlocks || new Map();
  const th = dimTextH;
  const PU = plotMM(th);                          // model-mm per 1 plot-mm
  const minSeg = th * 1.2;                         // skip sub-text-width chain gaps
  const wkey = (x, y) => Math.round(x / 4) + '_' + Math.round(y / 4);
  const Lw = w.length || Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1000;
  const Hw = w.height || 2600;
  const dlen = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1;
  const ux = (w.x2 - w.x1) / dlen, uy = (w.y2 - w.y1) / dlen;
  let s = '';
  // wall face rectangle (local: floor y=0, left jamb x=0)
  s += polyline(h, L.KIROT, [[0, 0], [Lw, 0], [Lw, Hw], [0, Hw], [0, 0]]);
  // wall label above the head
  s += text(h, kindLayer(L.KIROT, 'TXT'), 'W' + wallN, Lw / 2, Hw + th * 2.4, th * 1.4, 0, 1, 1);

  // ---- pass 1: draw every element's geometry + collect measured stations/heights ----
  const mine = all.filter((it) => it.wallStartX != null && wkey(it.wallStartX, it.wallStartY) === wkey(w.x1, w.y1));
  const stations = [];         // horizontal POSITION chain stations (point centres + opening jambs)
  const heights = new Map();   // distinct MOUNT height -> discipline dim layer (merge duplicates)
  const opes = [];             // openings for the height ladder
  for (const it of mine) {
    let st = (it.x - w.x1) * ux + (it.y - w.y1) * uy;
    st = Math.max(0, Math.min(Lw, st));
    const info = symInfo(it);
    const large = isLargeElev(info);
    const W = info.W, H = info.H;
    const mount = Math.max(0, Math.min(Hw, it.mount || 0));
    const dl = dimLayerFor(dimReg, info.layer).layer;
    const z0 = large ? mount : Math.max(0, mount - H / 2);
    const cx = st, cz = z0;
    // הסמל בחזית = INSERT של בלוק-חזית בעל-שם (מלבן ההיקף + הגליף), בדיוק כמו
    // התכנית — אובייקט אחד לחיצה, אחיד ובר-ספירה, לא קווים בודדים (תיקון הבעלים).
    const bname = symElevBlockName(info.key, W, H);
    if (!symBlocks.has(bname)) symBlocks.set(bname, elevBlockPrims(info.base, W, H));
    s += insert(h, info.layer, bname, cx, cz, 0, 1, 1);
    if (large) {
      stations.push(st - W / 2, st + W / 2);                 // both jambs feed the chain (opening WIDTH = a segment)
      opes.push({ xl: st - W / 2, xr: st + W / 2, mount, topZ: mount + H, dl });
    } else {
      stations.push(st);                                     // point centre feeds the chain
      const key = Math.round(mount / 5) * 5;                 // merge near-identical heights
      if (mount > minSeg && !heights.has(key)) heights.set(key, dl);
    }
  }

  // ---- HORIZONTAL: one consolidated POSITION CHAIN below the floor (L1), then the
  // wall FULL LENGTH below it (L2). Consecutive segments never overlap; sub-text-width
  // gaps are skipped so no two numbers collide. ----
  const chain = [0, ...stations, Lw].sort((a, b) => a - b)
    .filter((v, i, a) => i === 0 || v - a[i - 1] > 30);
  const off1 = 8 * PU;
  for (let i = 1; i < chain.length; i++) {
    if (chain[i] - chain[i - 1] > minSeg) s += dimension(h, L.MIDOT_PNIM, [chain[i - 1], 0], [chain[i], 0], { off: off1, side: -1, textH: th * 0.78 });
  }
  s += dimension(h, L.MIDOT_PNIM, [0, 0], [Lw, 0], { off: 16 * PU, side: -1, textH: th });   // wall FULL length (measured)

  // ---- VERTICAL (LEFT): a MOUNT-HEIGHT ladder — one vertical dim per DISTINCT height
  // (merged), each on its own left column at a constant +7 mm-plot step, then the wall
  // FULL HEIGHT outermost. Heights read cleanly, none stacking on the wall face. ----
  const hs = [...heights.keys()].sort((a, b) => a - b);
  let colL = 8 * PU;
  for (const m of hs) {
    s += dimension(h, heights.get(m), [-colL, 0], [-colL, m], { off: 0, side: 1, textH: th * 0.74 });
    colL += 7 * PU;
  }
  s += dimension(h, L.MIDOT_PNIM, [-colL, 0], [-colL, Hw], { off: 0, side: 1, textH: th });   // wall FULL height

  // ---- OPENINGS: WIDTH above the head (each opening), HEIGHT + sill in a RIGHT ladder.
  // Width already appears in the position chain too; the above-head width is the clear
  // vendor dimension. Right ladder columns step +7 mm-plot so openings never collide. ----
  let colR = 8 * PU;
  for (const o of opes) {
    s += dimension(h, o.dl, [o.xl, o.topZ], [o.xr, o.topZ], { off: 8 * PU, side: 1, textH: th * 0.76 });   // WIDTH above head
    s += dimension(h, o.dl, [o.xr, o.mount], [o.xr, o.topZ], { off: colR, side: -1, textH: th * 0.76 }); colR += 7 * PU;   // HEIGHT
    if (o.mount > minSeg) { s += dimension(h, o.dl, [o.xr, 0], [o.xr, o.mount], { off: colR, side: -1, textH: th * 0.76 }); colR += 7 * PU; }   // SILL
  }
  return { dxf: s, Lw, Hw };
}

// Legacy row builder (kept for API compatibility): draws every wall elevation in a
// single row starting at (baseX,baseY). The main drawing now composes elevations via
// drawOneElevation + region translation, but external callers may still use this.
function drawElevations(h, scene, dimTextH, baseX, baseY, dimReg, symBlocks) {
  symBlocks = symBlocks || new Map();
  const walls = (scene.walls || []).filter((w) => w.x1 != null);
  const all = [...(scene.items || []), ...(scene.openings || [])];
  const th = dimTextH;
  const gap = Math.max(2400, th * 20);
  let ox = baseX, s = '', top = baseY, bottom = baseY, wallN = 0;
  for (const w of walls) {
    wallN += 1;
    const one = drawOneElevation(h, w, wallN, all, dimTextH, dimReg, symBlocks);
    const placed = transformEntities(one.dxf, 1, 1, ox, baseY);
    s += placed;
    const bb = bboxOf(placed);
    top = Math.max(top, bb.maxY); bottom = Math.min(bottom, bb.minY);
    ox += one.Lw + gap;
  }
  return { dxf: s, width: ox - baseX - gap, top, bottom };
}

// ---------------------------------------------------------------------------
// Text-height hierarchy for a given drawing scale (DXF_PRO §4): modelHeight =
// paperMM × scaleDenom. dims/labels 2.5 mm, room/legend 3.5 mm, title 5.0 mm.
// ---------------------------------------------------------------------------
function textHeights(opts) {
  const scale = scaleDenom(opts);
  return {
    scale,
    dim: Math.max(60, Math.round(2.5 * scale)),
    room: Math.round(3.5 * scale),
    title: Math.round(5.0 * scale),
  };
}

// A fresh drawing context: one handle gen (unique handles across ents + blocks), the
// symbol-block registry and the per-element dim-layer registry.
function newCtx() { return { h: makeHandleGen(0x100), symBlocks: new Map(), dimReg: new Map() }; }

// ---- PLAN content only (walls + openings + items + cabinets + plan dims), in WORLD
// coordinates (centroid frame). Hebrew-free drawing area (owner fix #2).
function planContent(scene, opts, ctx, th) {
  const { h, symBlocks, dimReg } = ctx;
  const walls = scene.walls, items = scene.items, openings = scene.openings;
  const cabinets = scene.cabinets || [];
  const cen = centroid(walls);
  let ents = '';
  ents += drawWalls(h, walls, cen, openings);
  const marks = OPEN.assignMarks(openings);
  const openingReport = [];
  let openN = 0;
  for (const op of openings) {
    openN += 1;
    const r = drawOpening(h, op, th, { mark: marks.markOf(op), dimReg, elemN: 1000 + openN, cen });
    ents += r.dxf;
    openingReport.push({ mark: marks.markOf(op), name: op.he || op.name, produced: r.produced });
  }
  for (const it of items) ents += drawElement(h, it, th, opts, symBlocks);
  for (const cab of cabinets) ents += polyline(h, L.MITBACH, [...cab.corners, cab.corners[0]]);
  ents += drawElementDims(h, walls, [], openings, cen, th);   // opening positions
  ents += drawWallDims(h, walls, cen, th);
  ents += drawOverallDims(h, walls, cen, th, opts);           // clear-only unless opts.outerDims
  ctx.openingReport = openingReport;
  return ents;
}

// ---- ANNOTATION column (title block, spec table, legend/BOM, north+scale) as ONE
// stacked block in a LOCAL frame with its TOP-LEFT at (0,0), growing downward. This
// is the professional side panel (owner fix #2): a clean dedicated column, each
// sub-table framed and spaced by `gap`, NO overlap.
function annotationColumn(scene, opts, ctx, th, roomTextH, titleTextH) {
  const { h, symBlocks } = ctx;
  const openings = scene.openings, items = scene.items;
  const gap = th * 3.0;
  let colY = 0, s = '';
  const tb = drawTitleBlock(h, 0, colY, th, titleTextH, opts.title, scene.roomName);
  s += tb.dxf; colY -= tb.height + gap;
  const spec = drawSpecTable(h, openings, 0, colY, th, roomTextH);
  if (spec.height) { s += spec.dxf; colY -= spec.height + gap; }
  const bom = drawBOM(h, items, openings, 0, colY, th, roomTextH, symBlocks);
  if (bom.height) { s += bom.dxf; colY -= bom.height + gap; }
  s += drawNorthAndScale(h, tb.width * 0.5, colY - th * 2, th);
  return { dxf: s, width: tb.width };
}

// ---- ELEVATIONS band: every wall elevation laid out in a ROW in a LOCAL frame with
// its TOP-LEFT at (0,0). Each elevation is measured (its true bbox incl. dim ladders)
// and translated so a fixed clear `gap` separates neighbours — guaranteeing no
// elevation (or its dims) collides with the next (owner fix #1).
function elevationsBand(scene, opts, ctx, th) {
  const { h, dimReg, symBlocks } = ctx;
  const walls = (scene.walls || []).filter((w) => w.x1 != null);
  const all = [...(scene.items || []), ...(scene.openings || [])];
  const gap = Math.max(2600, th * 22);
  let s = '', cursor = 0, top = 0, bottom = 0, wallN = 0;
  for (const w of walls) {
    wallN += 1;
    const one = drawOneElevation(h, w, wallN, all, th, dimReg, symBlocks);
    const bb = bboxOf(one.dxf);
    // place so this elevation's LEFT edge is at `cursor` and its TOP at y=0.
    const dx = cursor - bb.minX, dy = 0 - bb.maxY;
    s += transformEntities(one.dxf, 1, 1, dx, dy);
    top = 0; bottom = Math.min(bottom, bb.minY + dy);
    cursor += bb.w + gap;
  }
  return { dxf: s, width: Math.max(0, cursor - gap), top, bottom };
}

// ---------------------------------------------------------------------------
// buildContent — produce ONE content region for a print sheet (or for inspection):
//   what = { kind:'plan' } | { kind:'elevation', index:i } | { kind:'main' }
// Returns { ents, symBlocks, extraLayers, bbox, h } — ents in a local/world frame,
// bbox measured, symBlocks + extraLayers for the sheet's tables/blocks. The handle
// gen `h` is returned so the sheet builder can CONTINUE it (keeps handles unique).
// ---------------------------------------------------------------------------
function buildContent(sceneOrModel, opts, what) {
  opts = opts || {}; what = what || { kind: 'plan' };
  const scene = normalizeScene(sceneOrModel, opts);
  const H = textHeights(opts);
  const ctx = newCtx();
  let ents = '';
  if (what.kind === 'elevation') {
    const walls = (scene.walls || []).filter((w) => w.x1 != null);
    const w = walls[what.index || 0];
    const all = [...(scene.items || []), ...(scene.openings || [])];
    const one = drawOneElevation(ctx.h, w, (what.index || 0) + 1, all, H.dim, ctx.dimReg, ctx.symBlocks);
    ents = one.dxf;
  } else if (what.kind === 'main') {
    return buildMain(scene, opts, H);   // returns the same shape
  } else {
    ents = planContent(scene, opts, ctx, H.dim);
  }
  const extraLayers = [...ctx.dimReg.entries()].map(([name, color]) => [name, color, 'CONTINUOUS']);
  return { ents, symBlocks: ctx.symBlocks, extraLayers, bbox: bboxOf(ents), h: ctx.h, openingReport: ctx.openingReport };
}

// ---------------------------------------------------------------------------
// assembleDXF — wrap a run of ENTITIES into a complete R12 (AC1009) file: HEADER,
// TABLES (VPORT/LTYPE/LAYER+extras/STYLE), BLOCKS (symbol glyphs), ENTITIES, EOF.
// `h` MUST be the handle gen that produced `ents` (block glyph handles continue it,
// so every group-5 handle in the file stays unique). Shared by the main drawing and
// every print sheet, so both are byte-for-byte the same R12 contract.
// ---------------------------------------------------------------------------
function assembleDXF(o) {
  const symBlocks = o.symBlocks || new Map();
  const extraLayers = o.extraLayers || [];
  const h = o.h || makeHandleGen(0x100);
  const ext = o.ext || { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  const ctx = {};
  const tbls = tablesSection(ext, extraLayers, [...symBlocks.keys()], h, ctx);
  const blks = blocksSection(symBlocks, h, ctx);
  const objs = T.objectsSection(h, ctx);
  return headerSection(ext, h.peek()) + tbls + blks +
    g(0, 'SECTION') + g(2, 'ENTITIES') + (o.ents || '') + g(0, 'ENDSEC') + objs + g(0, 'EOF');
}

// ---------------------------------------------------------------------------
// buildMain — the DECLUTTERED model-space drawing. Composes three non-overlapping
// REGIONS with fixed margins (owner fix #1):
//     ┌─────────────┬───────────────┐
//     │   PLAN      │  ANNOTATION    │   Band A (top): plan | side column
//     │             │  (title/spec/  │
//     │             │   legend)      │
//     ├─────────────┴───────────────┤
//     │  ELEVATIONS  W1 W2 W3 W4 …   │   Band B (below both): elevations row
//     └─────────────────────────────┘
// Every region is generated in its own local frame, measured, and TRANSLATED into
// place so blocks never collide. Returns { ents, symBlocks, extraLayers, bbox, h }.
// ---------------------------------------------------------------------------
function buildMain(scene, opts, H) {
  H = H || textHeights(opts);
  const th = H.dim;
  const ctx = newCtx();
  const REG = Math.max(2000, th * 16);   // clear gap between regions

  // Build every region in its OWN local frame first, then place — so the column can be
  // right-aligned to the full sheet width (plan left / legend right / elevations band
  // full-width below), a balanced professional master.
  const planEnts = planContent(scene, opts, ctx, th);
  const pb = bboxOf(planEnts);
  const planW = pb.w, planH = pb.h;

  const col = annotationColumn(scene, opts, ctx, th, H.room, H.title);
  const cb = bboxOf(col.dxf);
  const colH = cb.h, colW = cb.w;

  let band = { dxf: '', width: 0 };
  if (opts.elevations !== false) band = elevationsBand(scene, opts, ctx, th);
  const bb = bboxOf(band.dxf);
  const bandW = band.dxf ? bb.w : 0;

  // Sheet content width = widest of (plan + gap + column) and the elevations band.
  const sheetW = Math.max(planW + REG + colW, bandW);

  // PLAN top-left at (0,0); COLUMN top-right (right edge at sheetW); BAND below both.
  const plan = transformEntities(planEnts, 1, 1, -pb.minX, -pb.maxY);
  const column = transformEntities(col.dxf, 1, 1, (sheetW - colW) - cb.minX, 0 - cb.maxY);
  let elevEnts = '';
  if (band.dxf) {
    const bandTopY = -Math.max(planH, colH) - REG;   // strictly below the taller of plan/column
    elevEnts = transformEntities(band.dxf, 1, 1, 0 - bb.minX, bandTopY - bb.maxY);
  }

  let ents = plan + column + elevEnts;

  // SHEET BORDER around the union.
  const all = bboxOf(ents);
  const m = Math.max(900, th * 7);
  const bMinX = all.minX - m, bMaxX = all.maxX + m, bMinY = all.minY - m, bMaxY = all.maxY + m;
  ents += polyline(ctx.h, L.BORDER,
    [[bMinX, bMinY], [bMaxX, bMinY], [bMaxX, bMaxY], [bMinX, bMaxY], [bMinX, bMinY]], LW_BORDER);

  const extraLayers = [...ctx.dimReg.entries()].map(([name, color]) => [name, color, 'CONTINUOUS']);
  const ext = { minX: bMinX - 400, minY: bMinY - 400, maxX: bMaxX + 400, maxY: bMaxY + 400 };
  return { ents, symBlocks: ctx.symBlocks, extraLayers, bbox: bboxOf(ents), h: ctx.h, ext, openingReport: ctx.openingReport };
}

// ---------------------------------------------------------------------------
// Public exporter — the decluttered model-space drawing as a complete R12 file.
// ---------------------------------------------------------------------------
function exportDXF2D(sceneOrModel, opts) {
  opts = opts || {};
  const scene = normalizeScene(sceneOrModel, opts);
  const main = buildMain(scene, opts);
  exportDXF2D._lastOpenings = main.openingReport;   // per-opening geometry report (CLI)
  return assembleDXF({ ents: main.ents, symBlocks: main.symBlocks, extraLayers: main.extraLayers, ext: main.ext, h: main.h });
}
const exportDXF2DPro = exportDXF2D;   // drop-in alias for the converter

// ---------------------------------------------------------------------------
// Self-test — structural + content checks.
// ---------------------------------------------------------------------------
function selfTest(dxf, scene) {
  const problems = [];
  if (typeof dxf !== 'string') return { ok: false, problems: ['dxf not a string'] };
  const count = (re) => (dxf.match(re) || []).length;
  const has = (s) => dxf.includes(s);
  if (!/^\s*0\nSECTION\n/.test(dxf)) problems.push('missing opening SECTION');
  if (!/\n\s*0\nEOF\n?$/.test(dxf)) problems.push('missing EOF');
  // R12 (AC1009): HEADER, TABLES, BLOCKS, ENTITIES — NO OBJECTS section.
  for (const sec of ['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES']) if (!has('\n' + sec + '\n')) problems.push('missing ' + sec);
  for (const v of ['$ACADVER', '$EXTMIN', '$EXTMAX', '$DWGCODEPAGE', '$LTSCALE']) if (!has(v)) problems.push('missing ' + v);
  if (!has('ansi_1255')) problems.push('missing $DWGCODEPAGE ansi_1255');
  if (!has('\nVPORT\n')) problems.push('missing VPORT');
  if (!has('\nHIDDEN\n')) problems.push('missing HIDDEN linetype');
  if (!has('\narial.ttf\n')) problems.push('missing Hebrew TTF style font');
  // Layer NAMES are emitted in Hebrew (CP1255) via layerOut(); check the emitted form.
  for (const lay of [L.KIROT, L.KIROT_FILL, L.PTACHIM, L.CHASHMAL, L.MIDOT_PNIM, L.MIDOT_CHUTS])
    if (!has('\n' + layerOut(lay) + '\n')) problems.push('missing layer ' + lay);
  // R12 layer-name validity (the "won't open in AutoCAD" root cause): NO emitted LAYER
  // symbol name may contain a SPACE or any R12-illegal char. Check the whole taxonomy…
  const badNames = T.invalidLayerNames();
  if (badNames.length) problems.push('R12-invalid layer name(s): ' + badNames.join(', '));
  // …and the actual emitted LAYER table (group 2 of every LAYER record).
  for (const m of dxf.matchAll(/\n\s*0\nLAYER\n\s*2\n([^\n]*)\n/g))
    if (/[ <>/\\":;?*|,=`]/.test(m[1])) problems.push('space/illegal char in LAYER name ' + JSON.stringify(m[1]));
  // ---- R12 contract (calibrated against the DR reference that opens in AutoCAD) --
  // The whole class of "Did not receive PlotStyleName / Invalid or incomplete DXF
  // input" errors came from the AC1015 jump. R12 has NO plot styles, so these must
  // all be ABSENT: version is AC1009, no group-390, no OBJECTS/plot-style dictionary,
  // no $HANDSEED, no embedded group-370 lineweights, no AC1015-only tables.
  // Group CODES appear on even 0-based lines (code,value alternation); a bare
  // `has('\n390\n')` would false-positive on a group-5 handle whose hex VALUE is 390.
  const _lines = dxf.split('\n');
  const hasCode = (c) => { const t = String(c); for (let i = 0; i + 1 < _lines.length; i += 2) if (_lines[i].trim() === t) return true; return false; };
  if (!has('AC1009')) problems.push('not AC1009/R12 ($ACADVER)');
  if (has('AC1015')) problems.push('AC1015 leaked into an R12 file');
  if (hasCode(390)) problems.push('group-390 plot-style pointer present (must be absent in R12)');
  if (has('\nOBJECTS\n')) problems.push('OBJECTS section present (must be absent in R12)');
  if (has('ACAD_PLOTSTYLENAME')) problems.push('plot-style dictionary present (must be absent in R12)');
  if (has('$HANDSEED')) problems.push('$HANDSEED present (must be absent in R12)');
  if (hasCode(370)) problems.push('embedded lineweight (group 370) present (must be absent in R12)');
  // section balance — R12 has exactly 4 sections
  const nSec = count(/(?:^|\n)\s*0\nSECTION\n/g), nEnd = count(/\n\s*0\nENDSEC\n/g);
  if (nSec !== nEnd) problems.push(`SECTION ${nSec} != ENDSEC ${nEnd}`);
  if (nSec !== 4) problems.push(`expected 4 SECTIONs, got ${nSec}`);
  const nBlk = count(/\n\s*0\nBLOCK\n/g), nEndblk = count(/\n\s*0\nENDBLK\n/g);
  if (nBlk !== nEndblk) problems.push(`BLOCK ${nBlk} != ENDBLK ${nEndblk}`);
  // every INSERT references a defined BLOCK (R12 BLOCK header: 0 BLOCK / 8 0 / 2 <name>)
  const defined = new Set((dxf.match(/\n\s*0\nBLOCK\n(?:.*\n)*?\s*2\n([^\n]+)/g) || [])
    .map((m) => m.split('\n').pop().toLowerCase()));
  const inserts = (dxf.match(/\n\s*0\nINSERT\n(?:.*\n)*?\s*2\n([^\n]+)/g) || []);
  for (const ins of inserts) {
    const nm = ins.split('\n').pop().toLowerCase();
    if (!defined.has(nm)) problems.push('INSERT -> undefined BLOCK ' + nm);
  }
  // pairing (group code / value on alternating lines)
  const toks = dxf.split('\n'); const n = toks[toks.length - 1] === '' ? toks.length - 1 : toks.length;
  if (n % 2 !== 0) problems.push('odd token count');
  // Encoding: Hebrew is raw CP1255 single bytes (0x80..0xFF) — valid on disk when
  // written 'latin1'. Only a char code > 255 would be un-encodable.
  let cp1255Ok = true; for (let i = 0; i < dxf.length; i++) if (dxf.charCodeAt(i) > 255) { cp1255Ok = false; break; }
  if (!cp1255Ok) problems.push('char code > 255 present (not cp1255-encodable)');
  // handles on every entity
  const nEnt = count(/\n\s*0\n(LINE|TEXT|SOLID|ARC|INSERT)\n/g), nH = count(/\n\s*5\n/g);
  if (nH < nEnt) problems.push(`handles ${nH} < entities ${nEnt}`);
  // NO duplicate handles (every group-5 value unique across the whole file).
  const seenH = new Set(); let dupH = 0;
  for (const m of dxf.match(/\n\s*5\n([0-9A-Fa-f]+)\n/g) || []) {
    const v = m.trim().split('\n').pop().toUpperCase();
    if (seenH.has(v)) dupH++; else seenH.add(v);
  }
  if (dupH) problems.push(`duplicate handles: ${dupH}`);
  return {
    ok: problems.length === 0, problems, cp1255Ok,
    lines: count(/\n\s*0\nLINE\n/g), texts: count(/\n\s*0\nTEXT\n/g),
    solids: count(/\n\s*0\nSOLID\n/g), arcs: count(/\n\s*0\nARC\n/g),
    inserts: count(/\n\s*0\nINSERT\n/g), blocks: nBlk, layers: count(/\n\s*0\nLAYER\n/g),
  };
}

module.exports = {
  exportDXF2D, exportDXF2DPro, sceneFromModel, normalizeScene, selfTest,
  classify, heToDxfUnicode, LAYERS, GLYPHS, isWindow, isDoor, buildWallPoly,
  // sheet/region API (consumed by src/layout_sheets.js)
  buildContent, assembleDXF, buildMain, drawOneElevation, textHeights,
  symInfo, symBlockName, symElevBlockName,
};

// ---------------------------------------------------------------------------
// CLI:  node src/export_dxf2d.js [file.ordx]
// ---------------------------------------------------------------------------
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const outDir = path.join(root, 'analysis', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const argFile = process.argv[2];

  let scene, source;
  if (argFile && fs.existsSync(argFile)) {
    const { parseOrdxFile } = require('./parseOrdx');
    scene = parseOrdxFile(argFile); source = path.relative(root, argFile);
  } else {
    scene = {
      roomName: 'מטבח דוגמה',
      walls: [
        { x1: 0, y1: 0, x2: 4000, y2: 0, thick: 100, height: 2700, length: 4000 },
        { x1: 4000, y1: 0, x2: 4000, y2: -3000, thick: 100, height: 2700, length: 3000 },
        { x1: 4000, y1: -3000, x2: 0, y2: -3000, thick: 100, height: 2700, length: 4000 },
        { x1: 0, y1: -3000, x2: 0, y2: 0, thick: 100, height: 2700, length: 3000 },
      ],
      items: [
        { name: 'שקע בודד', x: 800, y: -40, rotation_deg: 0, width: 85, mount: 300, wallStartX: 0, wallStartY: 0, wallThick: 100 },
        { name: 'גז', x: 2500, y: -40, rotation_deg: 0, width: 40, mount: 500, wallStartX: 0, wallStartY: 0, wallThick: 100 },
        { name: 'מים', x: 3960, y: -1500, rotation_deg: 90, width: 40, mount: 600, wallStartX: 4000, wallStartY: 0, wallThick: 100 },
      ],
      openings: [
        { name: 'חלון', kind: 'window', x: 2000, y: -40, rotation_deg: 0, width: 1200, wallThick: 100 },
        { name: 'דלת', kind: 'door', x: 1500, y: -2960, rotation_deg: 180, width: 800, wallThick: 100 },
      ],
    };
    source = '(synthetic scene)';
  }
  const dxf = exportDXF2D(scene, { labels: true, title: { project: source, date: new Date().toISOString().slice(0, 10) } });
  const p = path.join(outDir, 'dxf2d_plan.dxf');
  fs.writeFileSync(p, dxf, 'latin1');   // R12 + cp1255 Hebrew bytes -> write 'latin1', never 'ascii'
  const t = selfTest(dxf, scene);
  console.log('Soline DXF-2D professional plan — self-test');
  console.log('  source ..............', source);
  console.log('  output ..............', path.relative(root, p), `(${dxf.length} B)`);
  console.log('  LINE/TEXT/SOLID/ARC .', t.lines, '/', t.texts, '/', t.solids, '/', t.arcs);
  console.log('  INSERT/BLOCK/LAYER ..', t.inserts, '/', t.blocks, '/', t.layers);
  console.log('  cp1255-encodable ....', t.cp1255Ok ? 'OK' : 'FAIL');
  console.log('  self-test ...........', t.ok ? 'PASS' : 'FAIL');
  t.problems.forEach((x) => console.log('     - ' + x));
  if (!t.ok) process.exit(1);
  console.log('  ALL CHECKS PASSED');
}
