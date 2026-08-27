'use strict';
/*
 * Soline — SHARED DXF TEMPLATE  (src/dxf_soline.js)
 * =============================================================================
 * Soline's OWN DXF layer/style/font system — a clean, Hebrew-named scheme that
 * REPLACES the ELCAD-derived layers (Const_Walls / Dim_Wall / Elem_* …) the owner
 * rejected. Used by BOTH exporters (export_dxf2d.js 2D plan, export_dxf_pro.js 3D)
 * so the two deliverables share ONE Soline design language.
 *
 * Design decisions:
 *   - Layer NAMES are a Soline namespace `SOL-*` with romanized-Hebrew tokens
 *     (KIROT=קירות, MIDOT-PNIM=מידות-פנים …). DXF R12 (AC1009) table symbol names
 *     must be pure 7-bit ASCII to open reliably in AutoCAD, so the layer PANEL
 *     shows the ASCII token while the drawing TEXT itself is real Hebrew. The
 *     Hebrew label for each layer is carried alongside (LAYERS[i][3]) for docs /
 *     legends. This matches the long-standing Soline convention (KIROT/GVUL).
 *   - Real Hebrew is emitted ONLY inside TEXT values, as AutoCAD \U+XXXX escapes,
 *     so the file stays pure ASCII on disk yet renders Hebrew through the STYLE.
 *   - STYLE `SOLINE` -> arial.ttf (Hebrew-capable, present on every Windows box),
 *     with $DWGCODEPAGE ansi_1255 in the HEADER.
 *
 * Exports the template primitives + section/table builders so an exporter only has
 * to draw ENTITIES: headerSection(ext) + tablesSection(ext) + <blocks> + entities.
 */

// ---------------------------------------------------------------------------
// Low-level DXF primitives (R12 ASCII, group codes right-justified to width 3).
// ---------------------------------------------------------------------------
function g(code, val) { return String(code).padStart(3) + '\n' + val + '\n'; }
function num(n) {
  const v = Math.round((Number(n) || 0) * 1e4) / 1e4;
  return (Object.is(v, -0) ? 0 : v).toFixed(4);
}
function makeHandleGen(start) {
  let h = start || 0x100;
  const f = () => (h++).toString(16).toUpperCase();
  f.peek = () => h.toString(16).toUpperCase();   // next free handle (for $HANDSEED)
  return f;
}

// Non-ASCII -> AutoCAD unicode escape \U+XXXX. LEGACY (AC1015/R2000 path). Kept for
// callers that still want pure-ASCII output; the R12 exporters now emit real CP1255
// bytes via heToCp1255 below (matching the DR/Raumplan reference DXF, which stores
// Hebrew as raw single-byte cp1255 and NOT as \U+ escapes — plain R12 TEXT does not
// interpret \U+, so the escapes would render literally).
function heToDxfUnicode(str) {
  let out = '';
  for (const ch of String(str == null ? '' : str)) {
    const c = ch.codePointAt(0);
    out += c > 127 ? '\\U+' + c.toString(16).toUpperCase().padStart(4, '0') : ch;
  }
  return out;
}

// Unicode -> Windows-1255 (Hebrew) single byte. Returns a JS string whose char codes
// are the raw cp1255 byte values (0-255), so the file MUST be written 'latin1'/'binary'
// (NOT 'ascii'). This mirrors the ground-truth DR reference (`$DWGCODEPAGE ansi_1255`,
// Hebrew stored as bytes 0xE0..0xFA). R12 (AC1009) reads the codepage directly.
function cp1255Byte(cp) {
  if (cp <= 0x7f) return cp;                                   // ASCII
  if (cp >= 0x05d0 && cp <= 0x05ea) return cp - 0x05d0 + 0xe0; // Hebrew letters א..ת
  if (cp >= 0x05b0 && cp <= 0x05c3 && cp !== 0x05ba) return cp - 0x05b0 + 0xc0; // niqqud
  const extra = {
    0x00b7: 0xb7, 0x2022: 0xb7,                                 // middle dot / bullet -> ·
    0x05be: 0xce, 0x05bf: 0xcf, 0x05c0: 0xd0, 0x05c1: 0xd1, 0x05c2: 0xd2, 0x05c3: 0xd3,
    0x05f0: 0xd4, 0x05f1: 0xd5, 0x05f2: 0xd6, 0x05f3: 0xd7, 0x05f4: 0xd8, // ligatures/geresh
    0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94,
    0x20aa: 0xa4,                                               // ₪ new-shekel sign
    0x00ab: 0xab, 0x00bb: 0xbb, 0x00b0: 0xb0,
  };
  if (cp === 0x00d7) return 0x78; // '×' -> 'x' (undefined in cp1255)
  if (extra[cp] != null) return extra[cp];
  if (cp >= 0xa0 && cp <= 0xff) return cp;                     // Latin-1 low range overlaps 1255
  return 0x3f;                                                 // '?' for anything unmappable
}
function heToCp1255(str) {
  let out = '';
  for (const ch of String(str == null ? '' : str)) out += String.fromCharCode(cp1255Byte(ch.codePointAt(0)));
  return out;
}
function isHebrew(s) { return /[֐-׿]/.test(String(s == null ? '' : s)); }

// mm -> cm string, up to one decimal (3609 -> "360.9", 2500 -> "250").
function cm(mm) {
  const v = Math.round((mm / 10) * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// ---------------------------------------------------------------------------
// The Soline layer scheme. `L` gives every layer a stable constant so the
// exporters never hard-code a string. Each LAYERS row is
//   [ ascii-name, ACI-color, linetype, hebrew-display-name ].
// ---------------------------------------------------------------------------
// ===========================================================================
// SOLINE LAYER TAXONOMY  v7  —  discipline × content-kind
// ===========================================================================
// The v5/v6 scheme gave each discipline ONE flat layer (SOL-KIROT, SOL-CHASHMAL
// …) plus a numbered explosion of SOL-DIM-<DISC>-<n> sub-layers. v7 replaces that
// with a COMPLETE, precisely-scoped matrix so ANY subset of a detail-heavy drawing
// can be isolated by toggling layers:
//
//   layer name = `SOL-<DISC>-<KIND>`
//     <DISC>  romanized-Hebrew discipline token (the long-standing Soline
//             convention the owner asked for: KIROT=קירות, CHASHMAL=חשמל …),
//             split finer than v6:  plumbing -> MAYIM(water)+NIKUZ(drainage),
//             HVAC -> MIZUG(AC)+IVRUR(ventilation), openings -> DELET(doors)+
//             CHALON(windows), furniture -> RIHUT+MITBACH(kitchen).
//     <KIND>  content-kind WITHIN the discipline:
//             SYM element/symbol geometry · DIM dimensions · TXT annotation/text ·
//             HAT hatch/fill · CEN centreline · HID hidden (behind-cut) lines.
//
// e.g.  SOL-CHASHMAL-SYM · SOL-CHASHMAL-DIM · SOL-CHASHMAL-TXT · SOL-CHASHMAL-HID.
// Toggle "SOL-CHASHMAL-*" -> electrical only; toggle every "*-DIM" -> all dims off;
// toggle "SOL-CHASHMAL-DIM" alone -> hide just the electrical measurements.
//
// COLOUR alignment: every KIND of a discipline shares ONE ACI colour (the
// discipline colour) so the CTB agent's color->pen table (templates/ctb) stays
// consistent — a colour still maps 1:1 to a pen. The KIND is expressed by the
// layer NAME + its embedded group-370 lineweight, NOT by colour. Colours reuse the
// CTB-pinned set {1,2,3,4,5,6,7,8,9,30,42,141,150,250,251,255}; the four NEW split
// disciplines (NIKUZ/IVRUR/CHALON/MITBACH) take unpinned ACIs that fall through to
// CTB index 0 = "use object lineweight" — still correct, because our DXF embeds the
// real group-370 weight on every layer. See docs/LAYERS.md for the full contract.
// ---------------------------------------------------------------------------

// Kind -> [ default lineweight (1/100 mm), linetype ]. Discipline SYM overrides the
// weight with its own object weight; the rest of the kinds are shared.
const KIND_DEF = {
  SYM: [25, 'CONTINUOUS'],   // element / symbol body (weight overridden per discipline)
  DIM: [13, 'CONTINUOUS'],   // dimension chains (thin)
  TXT: [18, 'CONTINUOUS'],   // annotation / labels / marks
  HAT: [13, 'CONTINUOUS'],   // hatch / poché fill (thin)
  CEN: [13, 'CENTER'],       // centreline
  HID: [18, 'HIDDEN'],       // hidden / behind-cut edges
};

// Hebrew word for each content-kind, appended to the discipline name to form the
// EMITTED (group-2 / group-8) Hebrew layer name (see HE_LAYER + layerOut below).
// SYM is the discipline's primary layer and carries the bare discipline name
// (קירות, חשמל …); the other kinds append "-<kind>" (a HYPHEN, no spaces) so every
// one of the 71 layers still gets a UNIQUE Hebrew name grouped by discipline.
// SPACES ARE FORBIDDEN in an R12 (AC1009) layer-table symbol name — AutoCAD discards
// a drawing whose LAYER table carries a name containing a space — so the old
// " - "-separated form is replaced by a bare "-". See sanitizeLayerName() below,
// which enforces this (and the rest of the R12-illegal set) on every emitted name.
const KIND_HE = {
  SYM: '',            // primary layer -> bare discipline name
  DIM: 'מידות',       // dimensions
  TXT: 'טקסט',        // text / annotation
  HAT: 'מילוי',       // hatch / poché fill
  CEN: 'ציר',         // centreline
  HID: 'נסתר',        // hidden / behind-cut
};

// One row per discipline:  [ code, hebrew, ACI-color, SYM-lineweight, [kinds…] ].
// The kind list is deliberately scoped — a discipline only declares the kinds it can
// actually carry (electrical has no centreline; a floor slab is just body + tiling).
const DISCIPLINES_DEF = [
  ['KIROT',    'קירות',    7,   50, ['SYM', 'HAT', 'DIM', 'TXT', 'HID', 'CEN']], // walls (cut heaviest)
  ['MIVNE',    'מבנה',     9,   35, ['SYM', 'HAT', 'DIM', 'TXT', 'HID', 'CEN']], // structure / columns / beams
  ['CHASHMAL', 'חשמל',     6,   25, ['SYM', 'DIM', 'TXT', 'HID']],               // electrical + data/comms
  ['TEURA',    'תאורה',    30,  25, ['SYM', 'DIM', 'TXT', 'HID']],               // lighting
  ['MAYIM',    'מים',      4,   25, ['SYM', 'DIM', 'TXT', 'HID', 'CEN']],        // water supply (plumbing)
  ['NIKUZ',    'ניקוז',    140, 25, ['SYM', 'DIM', 'TXT', 'HID', 'CEN']],        // drainage / waste
  ['GAZ',      'גז',       2,   25, ['SYM', 'DIM', 'TXT', 'HID', 'CEN']],        // gas
  ['MIZUG',    'מיזוג',    141, 25, ['SYM', 'DIM', 'TXT', 'HID']],               // HVAC / air-conditioning
  ['IVRUR',    'אוורור',   131, 25, ['SYM', 'DIM', 'TXT', 'HID']],               // ventilation / exhaust
  ['DELET',    'דלתות',    5,   25, ['SYM', 'DIM', 'TXT', 'HID', 'HAT']],        // doors (openings)
  ['CHALON',   'חלונות',   151, 25, ['SYM', 'DIM', 'TXT', 'HID']],               // windows (openings)
  ['RIHUT',    'ריהוט',    42,  25, ['SYM', 'DIM', 'TXT', 'HID']],               // furniture / furnishings
  ['MITBACH',  'מטבח',     52,  25, ['SYM', 'DIM', 'TXT', 'HID']],               // kitchen cabinetry
  ['RITZPA',   'ריצוף',    251, 13, ['SYM', 'HAT']],                             // floor slab + tiling
];

// Global (cross-discipline) dimension layers + the sheet / annotation layers.
// [ full-name, ACI-color, lineweight, linetype, hebrew ].
// The 5th column is the EMITTED Hebrew layer name (clean, " - "-separated — the
// Sivan-template convention), used both for the group-2 table record and every
// entity's group-8 (via HE_LAYER / layerOut below).
// NOTE: the 5th column (emitted Hebrew name) MUST be space-free (R12 rule) — the two
// former two-word names (גבול גיליון / רשת צירים) and the " - "-joined dim names are
// now hyphen-joined. sanitizeLayerName() re-checks every one of these at build time.
const AUX_LAYERS = [
  ['SOL-MIDOT-PNIM',    3,   13, 'CONTINUOUS', 'מידות-פנים'],   // inner / clear architectural dims
  ['SOL-MIDOT-CHUTS',   1,   13, 'CONTINUOUS', 'מידות-חוץ'],    // outer / overall architectural dims
  ['SOL-SHEET-FRAME',   250, 18, 'CONTINUOUS', 'מסגרת'],         // title block, north, scale bar, tags
  ['SOL-SHEET-BORDER',  255, 50, 'CONTINUOUS', 'גבול-גיליון'],  // heavy sheet border / section-cut
  ['SOL-SHEET-LEGEND',  150, 18, 'CONTINUOUS', 'מקרא'],          // legend + BOM + spec tables
  ['SOL-SHEET-GRID',    8,   13, 'CENTER',     'רשת-צירים'],    // column / axis grid (layout agent)
  ['SOL-SHEET-NOTES',   150, 18, 'CONTINUOUS', 'הערות'],         // general notes
  ['SOL-SHEET-REV',     1,   18, 'CONTINUOUS', 'מהדורות'],       // revision markers / clouds
];

// English underscore layer names — the PROVEN R12-safe fallback style, matching the
// known-good reference (Const_Walls / Dim_Markers / Text_Legend …). Guaranteed pure
// 7-bit ASCII so an R12 LAYER table symbol name is unambiguously valid, in case real
// Hebrew CP1255 bytes still trip AutoCAD's R12 symbol-name reader. Selected with
// setLayerLang('en'); the Hebrew set (setLayerLang('he'), the default) is primary.
//   discipline base name (SYM = bare) + "_" + kind  ->  e.g. Electrical_Dim, Walls_Fill.
const DISC_EN = {
  KIROT: 'Walls', MIVNE: 'Structure', CHASHMAL: 'Electrical', TEURA: 'Lighting',
  MAYIM: 'Plumbing', NIKUZ: 'Drainage', GAZ: 'Gas', MIZUG: 'HVAC', IVRUR: 'Ventilation',
  DELET: 'Doors', CHALON: 'Windows', RIHUT: 'Furniture', MITBACH: 'Kitchen', RITZPA: 'Floor',
};
const KIND_EN = { SYM: '', DIM: 'Dim', TXT: 'Text', HAT: 'Fill', CEN: 'Center', HID: 'Hidden' };
const AUX_EN = {
  'SOL-MIDOT-PNIM': 'Dim_Inner', 'SOL-MIDOT-CHUTS': 'Dim_Outer',
  'SOL-SHEET-FRAME': 'Frame', 'SOL-SHEET-BORDER': 'Border', 'SOL-SHEET-LEGEND': 'Legend',
  'SOL-SHEET-GRID': 'Grid', 'SOL-SHEET-NOTES': 'Notes', 'SOL-SHEET-REV': 'Revisions',
};

// R12 (AC1009) layer-table symbol-name rule. A space, or any of < > / \ " : ; ? * | , = `
// makes AutoCAD reject/mangle the drawing. Replace every illegal char with '-', collapse
// runs, trim, and cap at 31 chars. Enforced on EVERY emitted name (Hebrew and English)
// as it is built, so no space can ever reach the LAYER table — the regression's root cause.
const R12_BAD_CHARS = /[ <>/\\":;?*|,=`\t\r\n]/g;
function sanitizeLayerName(s) {
  let out = String(s == null ? '' : s).replace(R12_BAD_CHARS, '-');
  out = out.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  if ([...out].length > 31) out = [...out].slice(0, 31).join('');
  return out || '0';
}

// Hatch colours that deliberately differ from the discipline colour (poché fills
// read as neutral grey, not the discipline hue).
const HAT_COLOR_OVERRIDE = { KIROT: 8, RITZPA: 8 };

// ---------------------------------------------------------------------------
// Build the L constant map, the LAYERS table, the colour map and the lineweight
// map from the definitions above, so the exporters never hard-code a string and a
// single edit to DISCIPLINES_DEF re-flows the whole taxonomy.
// ---------------------------------------------------------------------------
const L = { ZERO: '0' };
const LAYERS = [['0', 7, 'CONTINUOUS', '0']];
const LW = { '0': 25 };
const LAYER_COLOR = { '0': 7 };
const DISC_HE_TOKEN = {};   // discipline code -> hebrew (for legends / grouping)
// STABLE internal ASCII layer name -> EMITTED Hebrew display name. The internal
// `SOL-*` name stays the canonical key everywhere in code (L.*, LAYER_SET, kindLayer,
// TOGGLE_GROUPS globs, exporter routing); only the DXF-emitted string is Hebrew, so a
// single map keeps the LAYER table (group 2) and every entity (group 8) in lock-step
// automatically. See layerOut().
const HE_LAYER = { '0': '0' };
// STABLE internal ASCII layer name -> EMITTED English display name (the R12-safe
// underscore fallback). Parallel to HE_LAYER; selected by setLayerLang('en').
const EN_LAYER = { '0': '0' };

for (const [code, he, color, symLw, kinds] of DISCIPLINES_DEF) {
  DISC_HE_TOKEN[code] = he;
  L[code] = 'SOL-' + code + '-SYM';                 // the discipline's PRIMARY (symbol) layer
  for (const kind of kinds) {
    const name = 'SOL-' + code + '-' + kind;
    const lw = kind === 'SYM' ? symLw : KIND_DEF[kind][0];
    const lt = KIND_DEF[kind][1];
    const col = (kind === 'HAT' && HAT_COLOR_OVERRIDE[code] != null) ? HAT_COLOR_OVERRIDE[code] : color;
    L[code + '_' + kind] = name;                    // e.g. L.CHASHMAL_DIM
    LAYERS.push([name, col, lt, he + ' · ' + kind]);
    LW[name] = lw; LAYER_COLOR[name] = col;
    // Hebrew: hyphen-joined, NO spaces (e.g. חשמל / חשמל-מידות). sanitize is a safety net.
    HE_LAYER[name] = sanitizeLayerName(KIND_HE[kind] ? he + '-' + KIND_HE[kind] : he);
    // English underscore fallback (e.g. Electrical / Electrical_Dim).
    EN_LAYER[name] = sanitizeLayerName(KIND_EN[kind] ? DISC_EN[code] + '_' + KIND_EN[kind] : DISC_EN[code]);
  }
}
for (const [name, color, lw, lt, he] of AUX_LAYERS) {
  LAYERS.push([name, color, lt, he]);
  LW[name] = lw; LAYER_COLOR[name] = color;
  HE_LAYER[name] = sanitizeLayerName(he);
  EN_LAYER[name] = sanitizeLayerName(AUX_EN[name] || name);
}

// ---- convenience aliases (the names the exporters already reference) ----
L.KIROT_FILL = L.KIROT_HAT;               // wall poché SOLID fill
L.MIDOT_PNIM = 'SOL-MIDOT-PNIM';          // inner (clear) dims + element positions
L.MIDOT_CHUTS = 'SOL-MIDOT-CHUTS';        // outer (overall) dims
L.PTACHIM = L.DELET;                       // legacy openings alias -> doors symbol layer
L.INSTALATSIA = L.MAYIM;                   // legacy plumbing alias -> water
L.TEKST = 'SOL-SHEET-LEGEND';             // legend / BOM / notes text
L.MISGERET = 'SOL-SHEET-FRAME';           // frame / title block / north / scale
L.BORDER = 'SOL-SHEET-BORDER';            // heavy sheet border
L.GRID = 'SOL-SHEET-GRID';
L.NOTES = 'SOL-SHEET-NOTES';
L.REV = 'SOL-SHEET-REV';

// Fast lookup of every declared layer name (for kindLayer fall-back).
const LAYER_SET = new Set(LAYERS.map((r) => r[0]));

// Given a discipline SYM (or any kind) layer, return the same discipline's layer
// for `kind`. Falls back to the SYM layer when that discipline does not declare the
// requested kind (e.g. electrical has no CEN). Non-discipline layers pass through.
function kindLayer(name, kind) {
  const m = String(name).match(/^(SOL-[A-Z]+)-(SYM|DIM|TXT|HAT|HID|CEN)$/);
  if (!m) return name;
  const cand = m[1] + '-' + kind;
  if (LAYER_SET.has(cand)) return cand;
  const sym = m[1] + '-SYM';
  return LAYER_SET.has(sym) ? sym : name;
}

// Discipline key -> Soline SYM layer. Shared by both exporters' classifiers so the
// 2D symbol and the 3D body land on the SAME discipline.
const DISC_LAYER = {
  electrical: L.CHASHMAL,
  plumbing: L.MAYIM,
  drainage: L.NIKUZ,
  gas: L.GAZ,
  hvac: L.MIZUG,
  ventilation: L.IVRUR,
  lighting: L.TEURA,
  structural: L.MIVNE,
  window: L.CHALON,
  door: L.DELET,
  kitchen: L.MITBACH,
  furniture: L.RIHUT,
  misc: L.MIVNE,
};

// element_symbols_soline.js discipline vocabulary -> Soline SYM layer. Richer than
// DISC_LAYER above (the symbol library splits electrical into electrical/comms/
// smart/safety/renewable, plumbing into plumbing/drainage, hvac into hvac/thermal).
const SYMBOL_DISC_LAYER = {
  electrical: L.CHASHMAL, comms: L.CHASHMAL, smart: L.CHASHMAL, safety: L.CHASHMAL,
  renewable: L.CHASHMAL, lighting: L.TEURA, plumbing: L.MAYIM, drainage: L.NIKUZ,
  gas: L.GAZ, hvac: L.MIZUG, thermal: L.MIZUG, opening: L.DELET, door: L.DELET,
  window: L.CHALON, structure: L.MIVNE, misc: L.MIVNE,
};
function symbolLayer(disc) { return SYMBOL_DISC_LAYER[disc] || L.MIVNE; }

// Refine a discipline SYM layer using the element's own text, so the two merged
// disciplines the symbol library can't always split get their own layer:
//   water (MAYIM) -> drainage (NIKUZ) for ביוב/ניקוז/drain/waste items,
//   HVAC  (MIZUG) -> ventilation (IVRUR) for אוורור/ונטה/מפוח/fan/diffuser items.
const DRAIN_RE = /ביוב|ניקוז|נקז|צנרת\s*ניקוז|drain|sewage|waste|gully|floor\s*drain/i;
const VENT_RE = /אוורור|ונטה|מפוח|מאוורר|מפזר|שבכ|tosaft|vent|fan|diffuser|grille|exhaust|extract/i;
function refineDisciplineLayer(symLayer, item) {
  const s = [item && item.name, item && item.he, item && item.heName,
    item && item.description, item && item.category, item && item.type].filter(Boolean).join(' ');
  if (symLayer === L.MAYIM && DRAIN_RE.test(s)) return L.NIKUZ;
  if (symLayer === L.MIZUG && VENT_RE.test(s)) return L.IVRUR;
  return symLayer;
}

// Short Hebrew label per symbol discipline (for the 2D legend / grouping).
const DISC_HE = {
  electrical: 'חשמל', comms: 'תקשורת', smart: 'בקרה', safety: 'בטיחות',
  renewable: 'אנרגיה', lighting: 'תאורה', plumbing: 'מים', drainage: 'ניקוז',
  gas: 'גז', hvac: 'מיזוג', thermal: 'חימום', opening: 'פתח',
  door: 'דלת', window: 'חלון', structure: 'מבנה', misc: 'שונות',
};

// ---------------------------------------------------------------------------
// TOGGLE GROUPS — the display-reduction contract for the superposition-HTML
// checkboxes and the layout-splitting agent. Each group is a set of layer-name
// GLOBS ('SOL-CHASHMAL-*') or exact names that toggle together. See docs/LAYERS.md.
// ---------------------------------------------------------------------------
const TOGGLE_GROUPS = {
  // by discipline (all kinds of one trade)
  walls:        ['SOL-KIROT-*'],
  structure:    ['SOL-MIVNE-*'],
  electrical:   ['SOL-CHASHMAL-*'],
  lighting:     ['SOL-TEURA-*'],
  water:        ['SOL-MAYIM-*'],
  drainage:     ['SOL-NIKUZ-*'],
  gas:          ['SOL-GAZ-*'],
  hvac:         ['SOL-MIZUG-*'],
  ventilation:  ['SOL-IVRUR-*'],
  doors:        ['SOL-DELET-*'],
  windows:      ['SOL-CHALON-*'],
  furniture:    ['SOL-RIHUT-*'],
  kitchen:      ['SOL-MITBACH-*'],
  floor:        ['SOL-RITZPA-*'],
  // super-groups
  mep:          ['SOL-CHASHMAL-*', 'SOL-TEURA-*', 'SOL-MAYIM-*', 'SOL-NIKUZ-*',
    'SOL-GAZ-*', 'SOL-MIZUG-*', 'SOL-IVRUR-*'],
  openings:     ['SOL-DELET-*', 'SOL-CHALON-*'],
  // by content-kind (across every discipline)
  allDimensions: ['*-DIM', 'SOL-MIDOT-PNIM', 'SOL-MIDOT-CHUTS'],
  allText:       ['*-TXT', 'SOL-SHEET-LEGEND', 'SOL-SHEET-NOTES'],
  allHatch:      ['*-HAT'],
  allHidden:     ['*-HID'],
  allCentre:     ['*-CEN', 'SOL-SHEET-GRID'],
  // sheet furniture
  sheet:        ['SOL-SHEET-FRAME', 'SOL-SHEET-BORDER', 'SOL-SHEET-GRID', 'SOL-SHEET-REV'],
  annotation:   ['SOL-SHEET-LEGEND', 'SOL-SHEET-NOTES', '*-TXT', '*-DIM',
    'SOL-MIDOT-PNIM', 'SOL-MIDOT-CHUTS'],
};

const STYLE_NAME = 'SOLINE';
const FONT_FILE = 'arial.ttf';   // Hebrew-capable TrueType, universal on Windows

function colorOf(layerName) { return LAYER_COLOR[layerName] != null ? LAYER_COLOR[layerName] : 7; }

// Emitted layer-name LANGUAGE. 'he' (default) emits the space-free Hebrew names as
// CP1255 bytes; 'en' emits the proven R12-safe English underscore names (pure ASCII).
// A build can flip to English before invoking an exporter (setLayerLang('en')) to
// produce the guaranteed-safe fallback deliverable — no exporter code changes, since
// both go through layerOut() below. See DISC_EN / EN_LAYER.
let LAYER_LANG = 'he';
function setLayerLang(lang) { LAYER_LANG = (lang === 'en') ? 'en' : 'he'; return LAYER_LANG; }
function getLayerLang() { return LAYER_LANG; }

// Internal ASCII layer name -> EMITTED layer string, R12-SAFE (no spaces / illegal
// chars — enforced by sanitizeLayerName at build time). Applied at the TWO emission
// boundaries only — the LAYER table record (group 2) and every entity's layer
// reference (group 8) — so the internal name stays the stable key while AutoCAD sees
// the Hebrew (or English) name. Names with no mapping (e.g. "0" or a per-element extra
// layer) are sanitized on the way out too, so a stray space can never reach the table.
// The Hebrew result is CP1255 single bytes (ASCII English passes through heToCp1255
// unchanged), so the file MUST be written 'latin1'. $DWGCODEPAGE ansi_1255 tells
// AutoCAD how to read the Hebrew bytes.
function layerName(name) {
  const map = LAYER_LANG === 'en' ? EN_LAYER : HE_LAYER;
  return map[name] != null ? map[name] : sanitizeLayerName(name);
}
function layerOut(name) { return heToCp1255(layerName(name)); }

// Assert that EVERY emitted name (both languages) is a valid R12 symbol name: no
// space, none of the R12-illegal chars, non-empty, ≤ 31 chars. Returns the list of
// offenders (empty = all valid). Used by both exporters' selfTest.
function invalidLayerNames() {
  const bad = [];
  const check = (lang, map) => {
    for (const key of Object.keys(map)) {
      const nm = map[key];
      if (!nm || R12_BAD_CHARS.test(nm) || [...nm].length > 31) bad.push(lang + ':' + key + '=' + JSON.stringify(nm));
      R12_BAD_CHARS.lastIndex = 0;                 // reset the /g regex between tests
    }
  };
  check('he', HE_LAYER); check('en', EN_LAYER);
  return bad;
}

// ---------------------------------------------------------------------------
// LINEWEIGHTS (DXF group 370, in 1/100 mm) — the ISO-128 hierarchy from
// docs/DXF_PRO_STANDARDS §2. Values are drawn from the fixed DXF lineweight enum
// {0,5,9,13,15,18,20,25,30,35,40,50,…}. Each LAYER record carries its weight, so
// entities inherit the hierarchy (wall cut heaviest, objects medium, annotation
// lightest). Built above from KIND_DEF + each discipline's SYM weight:
//   0.50 mm  SOL-KIROT-SYM, SOL-SHEET-BORDER  (wall cut / sheet border — heaviest)
//   0.35 mm  SOL-MIVNE-SYM                     (columns / structure)
//   0.25 mm  every discipline *-SYM            (openings / objects / MEP)
//   0.18 mm  *-TXT, *-HID, SOL-SHEET-*         (text / hidden / frame lines)
//   0.13 mm  *-DIM, *-HAT, *-CEN, SOL-MIDOT-*  (dims + poché fill + centrelines)
// ---------------------------------------------------------------------------
const LW_DIM = 13;      // fallback for any un-mapped (annotation-weight) layer
const LW_BORDER = 50;   // sheet border / title-block outer frame (per-entity override)
function lwOf(name) { return LW[name] != null ? LW[name] : LW_DIM; }

// ===========================================================================
// Sections: HEADER + TABLES — DXF R12 (AC1009) template.
// ===========================================================================
// CALIBRATED against the ground-truth DR/Raumplan reference export
// (elemets_Bar_Terra-Nova_Yosi_DR1.dxf): that file — which opens cleanly in the
// owner's AutoCAD 2021 — is `$ACADVER AC1009` (R12), `$DWGCODEPAGE ansi_1255`,
// with ZERO group-390 codes, NO OBJECTS section, NO plot-style dictionary, NO
// embedded lineweights (370) and NO BLOCK_RECORD/APPID/DIMSTYLE tables. Its LAYER
// records are the minimal R12 form: `0 LAYER / 2 <name> / 70 <flags> / 62 <color>
// / 6 <linetype>`.
//
// We previously emitted AC1015 (R2000) so we could carry per-layer group-370
// lineweights + the ACAD_PLOTSTYLENAME/390 plot-style contract. AutoCAD 2021
// REJECTED every such file ("Did not receive PlotStyleName ... Invalid or
// incomplete DXF input"), while ezdxf (lenient) accepted them — so the checks never
// caught it. Root cause = the AC1015 jump itself. We now emit R12 to mirror the
// reference exactly. Lineweight is delivered at PLOT time by SOLINE.ctb mapping ACI
// colour -> pen width (the color-dependent-plot-table standard used across Israeli
// practice), which is precisely why the taxonomy keeps its stable ACI colours.
//
// R12 has no mandatory handles or owners in the symbol tables (the reference has
// none). Entity-level group-5 handles are still emitted by the exporters and are
// tolerated by AutoCAD 2021 (the reference itself carries entity handles with no
// $HANDSEED). `h`/`ctx` params are retained for call-site compatibility.
// ---------------------------------------------------------------------------
function headerSection(ext /* , seed (ignored in R12) */) {
  const e = ext || { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  return g(0, 'SECTION') + g(2, 'HEADER') +
    g(9, '$ACADVER') + g(1, 'AC1009') +                 // DXF R12 (matches the DR reference)
    g(9, '$INSBASE') + g(10, num(0)) + g(20, num(0)) + g(30, num(0)) +
    g(9, '$EXTMIN') + g(10, num(e.minX)) + g(20, num(e.minY)) + g(30, num(0)) +
    g(9, '$EXTMAX') + g(10, num(e.maxX)) + g(20, num(e.maxY)) + g(30, num(0)) +
    g(9, '$DWGCODEPAGE') + g(3, 'ansi_1255') +          // Hebrew codepage (R12 reads it directly)
    g(9, '$CLAYER') + g(8, '0') +                        // current layer -> "0" (always defined)
    g(9, '$LTSCALE') + g(40, num(10)) +
    g(9, '$LIMMIN') + g(10, num(0)) + g(20, num(0)) +
    g(9, '$LIMMAX') + g(10, num(2000)) + g(20, num(200)) +
    // יחידות אורך = עשרוני (2), עקבי עם גאומטריה במ"מ. אין להילחם במ"מ — DIMLFAC=0.1
    // הוא זה שממיר את תצוגת-המידה לס"מ (÷10). $MEASUREMENT/$INSUNITS מושמטים בכוונה
    // כדי לשמור על מינימום R12 טהור (גם קובץ-הייחוס אינו נושא אותם).
    g(9, '$LUNITS') + g(70, 2) +
    // ---- משתני-מידות SOLINE (נשאבים ל"מידה טרייה" שהבעלים משרטט) ----------------
    // הנשא הראשי והאמין ביותר ב-R12: משתני-הכותרת $DIM*. יחד עם טבלת-ה-DIMSTYLE
    // למטה, כל מידה חדשה שהבעלים ימדוד בקובץ תצא אוטומטית בס"מ ובגודל/איכות הנכונים,
    // ללא שום כוונון מצדו. הערכים זהים ל-SOLINE_setup.scr העובד.
    g(9, '$DIMSCALE') + g(40, num(50)) +      // קנה-מידה כללי של אלמנטי-המידה (1:50)
    g(9, '$DIMLFAC') + g(40, num(0.1)) +      // ← התיקון: גאומטריה במ"מ → מידה נקראת בס"מ (÷10)
    g(9, '$DIMTXT') + g(40, num(2.5)) +       // גובה טקסט-המידה (מ"מ-נייר; ×DIMSCALE=125 במודל)
    g(9, '$DIMASZ') + g(40, num(2.5)) +       // גודל ראש-החץ
    g(9, '$DIMEXE') + g(40, num(1.25)) +      // חריגת קו-ההוצאה מעבר לקו-המידה
    g(9, '$DIMEXO') + g(40, num(0.625)) +     // מרווח קו-ההוצאה מהאובייקט
    g(9, '$DIMDLI') + g(40, num(7)) +         // מרווח בין קווי-מידה בשרשרת בסיסים
    g(9, '$DIMTAD') + g(70, 1) +              // טקסט מעל קו-המידה
    g(9, '$DIMTIH') + g(70, 0) +              // טקסט פנימי מקביל לקו-המידה
    g(9, '$DIMTOH') + g(70, 0) +              // טקסט חיצוני מקביל לקו-המידה
    g(9, '$DIMZIN') + g(70, 8) +              // דיכוי אפסים נגררים (400.0 → 400)
    // הערה: $DIMGAP/$DIMJUST/$DIMDEC/$DIMTXSTY הוסרו — הם משתני-R13+ ואסורים בכותרת AC1009 (R12);
    // הכללתם עלולה לשבור טעינה. $DIMLFAC (R12-חוקי) הוא שממיר את המידה לס"מ — וזה העיקר.
    g(0, 'ENDSEC');
}

// R12 TABLE header — no handle, no owner, no AcDbSymbolTable subclass marker.
function tableHead(name, count) {
  return g(0, 'TABLE') + g(2, name) + g(70, count);
}

// R12 VPORT *ACTIVE record (no handle / owner / subclass markers).
function vportRecords(ext) {
  const e = ext || { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  const cx = (e.minX + e.maxX) / 2, cy = (e.minY + e.maxY) / 2;
  const hgt = Math.max(1000, (e.maxY - e.minY) * 1.15);
  return g(0, 'VPORT') + g(2, '*ACTIVE') + g(70, 0) +
    g(10, num(0)) + g(20, num(0)) + g(11, num(1)) + g(21, num(1)) +
    g(12, num(cx)) + g(22, num(cy)) + g(13, num(0)) + g(23, num(0)) +
    g(14, num(10)) + g(24, num(10)) + g(15, num(10)) + g(25, num(10)) +
    g(16, num(0)) + g(26, num(0)) + g(36, num(1)) + g(17, num(0)) + g(27, num(0)) + g(37, num(0)) +
    g(40, num(hgt)) + g(41, num(1.6)) + g(42, num(50)) + g(43, num(0)) + g(44, num(0)) +
    g(50, num(0)) + g(51, num(0)) +
    g(71, 0) + g(72, 100) + g(73, 1) + g(74, 1) + g(75, 0) + g(76, 0) + g(77, 0) + g(78, 0);
}

// R12 LTYPE records — the three linetypes our layers reference. The reference DXF
// carries CONTINUOUS + HIDDEN; we add CENTER (used by centreline / axis-grid layers).
// No ByBlock/ByLayer records (implicit in R12).
function ltypeRecords() {
  const lt = (name, desc, dashCount, len, dashes) => {
    let r = g(0, 'LTYPE') + g(2, name) + g(70, 0) + g(3, desc) +
      g(72, 65) + g(73, dashCount) + g(40, num(len));
    for (const d of dashes || []) r += g(49, num(d));
    return r;
  };
  return lt('CONTINUOUS', 'Solid line', 0, 0, []) +
    lt('HIDDEN', 'Hidden __ __ __ __ __ __', 2, 9.525, [6.35, -3.175]) +
    lt('CENTER', 'Center ____ _ ____ _ ____', 4, 50.8, [31.75, -6.35, 6.35, -6.35]);
}

// R12 LAYER record — the exact minimal reference form:
//   0 LAYER / 2 <name> / 70 <flags> / 62 <ACI colour> / 6 <linetype>
// No handle (5), no owner (330), no subclass (100), no lineweight (370), and NO
// group-390 plot-style pointer (R12 has no plot styles — the CTB handles pens).
function layerRecord(name, color, ltype) {
  return g(0, 'LAYER') + g(2, layerOut(name)) + g(70, 0) + g(62, color) + g(6, ltype || 'CONTINUOUS');
}

// R12 STYLE record. Fixed-height 40=0 so each TEXT entity's own height (group 40)
// applies. `font` -> group 3 (TTF/SHX), group 4 = big-font (empty).
function styleRecord(name, font) {
  return g(0, 'STYLE') + g(2, name) + g(70, 0) +
    g(40, num(0)) + g(41, num(1)) + g(50, num(0)) + g(71, 0) + g(42, num(2.5)) +
    g(3, font) + g(4, '');
}

// R12 DIMSTYLE record — סגנון-המידות של SOLINE, אפוי לתוך כל DXF מיוצא. משתמש אך-ורק
// בקבוצות-הקוד החוקיות ל-R12 בטבלת-ה-DIMSTYLE (40=DIMSCALE, 41=DIMASZ, 42=DIMEXO,
// 43=DIMDLI, 44=DIMEXE, 140=DIMTXT, 144=DIMLFAC, 147=DIMGAP, 77=DIMTAD, 73=DIMTIH,
// 74=DIMTOH, 78=DIMZIN, 176/177/178=צבעים). אין קבוצות R2000+ (‏271/272/340 וכו').
// אין ידית (105) — בדיוק כמו שאר הטבלאות בקובץ-הייחוס שנפתח ב-AutoCAD 2021.
// ראשי-חץ מלאים = ברירת-המחדל (DIMBLK ריק, לא נפלט). הערכים זהים למשתני-הכותרת.
function dimstyleRecord(name) {
  return g(0, 'DIMSTYLE') + g(2, name) + g(70, 0) +
    g(40, num(50)) +        // DIMSCALE
    g(41, num(2.5)) +       // DIMASZ  (arrow size)
    g(42, num(0.625)) +     // DIMEXO  (extension-line offset)
    g(43, num(7)) +         // DIMDLI  (baseline spacing)
    g(44, num(1.25)) +      // DIMEXE  (extension-line extension)
    g(140, num(2.5)) +      // DIMTXT  (text height)
    g(144, num(0.1)) +      // DIMLFAC ← the fix: mm geometry reads in cm
    g(147, num(0.625)) +    // DIMGAP
    g(77, 1) +              // DIMTAD  (text above line)
    g(73, 0) +              // DIMTIH
    g(74, 0) +              // DIMTOH
    g(78, 8) +              // DIMZIN  (suppress trailing zeros → whole cm)
    g(176, 0) +             // DIMCLRD (dim line color = BYBLOCK → follows layer/pen)
    g(177, 0) +             // DIMCLRE (extension line color = BYBLOCK)
    g(178, 0);              // DIMCLRT (text color = BYBLOCK)
}

// ---------------------------------------------------------------------------
// tablesSection — DXF R12. Emits only the tables the reference carries: VPORT,
// LTYPE, LAYER, STYLE. `extraLayers` rows are [name,color,linetype?] (per-element
// dim sub-layers). `h`, `blockNames`, `ctx` are accepted for call-site
// compatibility but unused (R12 has no BLOCK_RECORD table / handles in tables).
// ---------------------------------------------------------------------------
function tablesSection(ext, extraLayers, blockNames, h, ctx) {
  extraLayers = extraLayers || [];
  ctx = ctx || {};

  let s = g(0, 'SECTION') + g(2, 'TABLES');

  // VPORT
  s += tableHead('VPORT', 1) + vportRecords(ext) + g(0, 'ENDTAB');

  // LTYPE (CONTINUOUS, HIDDEN, CENTER)
  s += tableHead('LTYPE', 3) + ltypeRecords() + g(0, 'ENDTAB');

  // LAYER — the full Soline taxonomy + any per-element extra dim layers.
  const layerRows = [...LAYERS.map((r) => [r[0], r[1], r[2]]),
    ...extraLayers.map((r) => [r[0], r[1], r[2] || 'CONTINUOUS'])];
  s += tableHead('LAYER', layerRows.length);
  for (const [name, color, ltype] of layerRows) s += layerRecord(name, color, ltype);
  s += g(0, 'ENDTAB');

  // STYLE — the Soline Hebrew style + the AutoCAD-mandatory "Standard" style.
  s += tableHead('STYLE', 2) +
    styleRecord(STYLE_NAME, FONT_FILE) + styleRecord('Standard', 'txt') + g(0, 'ENDTAB');

  // הערה: טבלת-DIMSTYLE הוסרה — היא שברה את טעינת-R12 (קובץ-הייחוס אינו נושא טבלה כזו).
  // ה-cm-baking מושג דרך משתני-הכותרת המספריים $DIM* (headerSection), שהם הנשא הבטוח ב-R12.

  return s + g(0, 'ENDSEC');
}

// R12 needs no *Model_Space / *Paper_Space block definitions (those are an AC1015+
// requirement). Kept as a no-op for call-site compatibility.
function spaceBlocks(/* h, ctx */) { return ''; }

// R12 BLOCK / ENDBLK wrappers for a named user block. Matches the reference form:
//   0 BLOCK / 8 0 / 2 <name> / 70 0 / 10 0 / 20 0 / 30 0 / 3 <name> / 1 ''  … 0 ENDBLK
// No handle (5), no owner (330), no AcDb* subclass markers.
function blockBegin(h, ctx, name) {
  return g(0, 'BLOCK') + g(8, '0') + g(2, name) + g(70, 0) +
    g(10, num(0)) + g(20, num(0)) + g(30, num(0)) + g(3, name) + g(1, '');
}
function blockEnd(/* h, ctx, name */) {
  return g(0, 'ENDBLK') + g(8, '0');
}

// R12 has no OBJECTS section (no named-object dictionary / plot styles). No-op.
function objectsSection(/* h, ctx */) { return ''; }

module.exports = {
  g, num, makeHandleGen, heToDxfUnicode, heToCp1255, isHebrew, cm,
  L, LAYERS, LAYER_SET, DISCIPLINES_DEF, KIND_DEF, KIND_HE, AUX_LAYERS,
  HE_LAYER, EN_LAYER, DISC_EN, KIND_EN, layerOut, layerName,
  sanitizeLayerName, invalidLayerNames, setLayerLang, getLayerLang,
  DISC_LAYER, SYMBOL_DISC_LAYER, symbolLayer, refineDisciplineLayer, kindLayer,
  DISC_HE, DISC_HE_TOKEN, TOGGLE_GROUPS, colorOf, STYLE_NAME, FONT_FILE,
  LW, LW_DIM, LW_BORDER, lwOf,
  headerSection, tablesSection, objectsSection, spaceBlocks, blockBegin, blockEnd,
};
