'use strict';
/*
 * Soline — PROFESSIONAL DXF exporter (export_dxf_pro.js)
 * =============================================================================
 * A NEW exporter built to match the quality of professional 3D DXF deliverables
 * (`*_3D.dxf` reference exports). See DXF_REFERENCE_STUDY.md
 * for the format conventions it follows.
 *
 * It is deliberately separate from export_dxf2d.js / export_dxf3d.js (owned by the
 * QA agent) and only READS the existing pipeline modules.
 *
 * What makes it "professional" (vs. the old exporters):
 *   1. Full 37-layer SEMANTIC layer table (Const_Walls, Const_Walls_Ext,
 *      Electrical, Plumbing, Const_Windows, Const_Doors, Dim_*, Text_*, ...) with
 *      the exact colors/linetypes of the reference.
 *   2. Repeated fixtures defined ONCE as a BLOCK (3D 3DFACE geometry, or 2D LINE
 *      geometry) and placed many times via INSERT (position/scale/rotation) — the
 *      reference's core convention. Block geometry sits on layer 0 so the INSERT
 *      layer drives the color.
 *   3. Walls extruded to real 3D prisms of 3DFACE quads on Const_Walls /
 *      Const_Walls_Ext.
 *   4. Complete R12 HEADER ($ACADVER, $INSBASE, computed $EXTMIN/$EXTMAX,
 *      $DWGCODEPAGE=ansi_1255, $LTSCALE, $LIMMIN/$LIMMAX), VPORT, two LTYPEs
 *      (CONTINUOUS + HIDDEN), STYLE STANDARD -> ARIAL.TTF, and per-entity handles.
 *   5. Hebrew via BOTH $DWGCODEPAGE ansi_1255 AND \U+XXXX escapes in TEXT + a
 *      Hebrew-capable TrueType style.
 *
 * Public API:
 *   exportDXF3DPro(sceneOrModel, opts) -> DXF string (3D: wall prisms + fixture blocks)
 *   exportDXF2DPro(sceneOrModel, opts) -> DXF string (plan: wall lines + 2D symbols + labels)
 *   sceneFromModel(parseOrdxModel, opts) -> { walls, items }   (the normalized scene)
 *   selfTest(dxf, scene, opts) -> { ok, ... }
 *
 * Scene contract (also accepted directly):
 *   scene = {
 *     walls: [ { x1,y1,x2,y2, thick, height, exterior } ],   // mm, ORDX frame (pre-flip)
 *     items: [ { name, category, x, y, z, rotation_deg, width, depth, height } ],
 *   }
 * Y is flipped to the reference frame (worldY = -y) on emit, matching placement.js.
 */

const fs = require('fs');
const path = require('path');

// מקור-האמת המשותף — כדי ש-3D עקבי עם ORDX ו-DXF-2D (סיווג/מידות/שכבה/block).
let CATALOG_MOD = null;
try { CATALOG_MOD = require('./element_catalog'); } catch (_) { CATALOG_MOD = null; }

// שמות ה-block-ים התלת-ממדיים התקפים (BLOCKS_3D). כל block אחר (WINDOW1/DOOR1
// או לא-מוכר) מתמפה ל-CONTROLBOX כברירת-מחדל.
const VALID_3D_BLOCKS = new Set(['SOCKET', 'DUPLEXSWITCH', 'SWITCH', 'GAS', 'FAUCET', 'SEWAGE', 'LIGHTING', 'CONTROLBOX']);
function mapBlock(b) { return VALID_3D_BLOCKS.has(b) ? b : 'CONTROLBOX'; }

// ---------------------------------------------------------------------------
// Soline shared DXF template (dxf_soline.js) — the SAME layer/style/font system
// the 2D plan uses, so 2D and 3D share ONE Soline design language. Replaces the
// legacy 37-layer table (Const_Walls / Elem_* / Dim_* …) that some CAD tools expect.
// ---------------------------------------------------------------------------
const T = require('./dxf_soline');
const { g, num, makeHandleGen, heToDxfUnicode, heToCp1255, isHebrew, L, LAYERS, STYLE_NAME, symbolLayer, refineDisciplineLayer, kindLayer, layerOut } = T;

// v7: doors and windows are separate disciplines — pick the opening's SYM layer.
function openingLayer(op, d) {
  const kind = (d && d.kind) || (/window|חלון/i.test(op && (op.name || '') + ' ' + (op && op.layer || '')) ? 'window' : 'door');
  return kind === 'window' ? L.CHALON : L.DELET;
}

// Soline element-symbol language (172 symbols) — same source of truth
// the 2D plan uses. Here it drives (a) the 3D element BODY layer via the symbol's
// discipline, and (b) the 2D-pro plan glyph. See docs/ELEMENTS_LANGUAGE.md.
const SYM = require('./element_symbols_soline');
// Parametric door/window OPENING schema (docs/OPENING_ELEMENT_SCHEMA.md) — shared
// with the 2D exporter so plan + model agree on frame depth / sill / head / mode.
const OPEN = require('./opening_schema');
const SYM_SYNONYM = [[/מתג/, 'switch_single']];
function symKeyFor(it) {
  let k = SYM.resolveKey(it);
  if (!k) { const s = [it.he, it.name, it.heName, it.description].filter(Boolean).join(' '); for (const [re, key] of SYM_SYNONYM) if (re.test(s)) { k = key; break; } }
  return k;
}

// Element category -> Soline body layer (used by elemLayer()); keys are the
// Soline layer names directly so the classifier maps straight onto the template.
const ELEM = {
  ELECTRICAL: L.CHASHMAL, PLUMBING: L.INSTALATSIA, GAS: L.GAZ, HVAC: L.MIZUG,
  LIGHTING: L.TEURA, STRUCT: L.MIVNE, OPENING: L.PTACHIM, MISC: L.MIVNE,
};

// ---------------------------------------------------------------------------
// Fixture -> BLOCK + LAYER routing.
// Block names match the reference set. `resolveBlock` maps an item (by ORDX/en
// name, then by Soline Hebrew category) to one of the reference blocks + the
// semantic layer its INSERT lives on.
// ---------------------------------------------------------------------------
const BLOCK_LAYER = {
  GAS: L.GAZ,
  CONTROLBOX: L.CHASHMAL,
  FAUCET: L.INSTALATSIA,
  LIGHTING: L.TEURA,
  SEWAGE: L.INSTALATSIA,
  SOCKET: L.CHASHMAL,
  SWITCH: L.CHASHMAL,
  DUPLEXSWITCH: L.CHASHMAL,
};

// ORDX/en name -> block. Case-insensitive substring match, first hit wins.
const NAME_BLOCK = [
  [/duplex\s*socket|double\s*socket|\bsocket.*duplex/i, 'DUPLEXSWITCH'],
  [/socket|outlet|power point/i, 'SOCKET'],
  [/switch|dimmer|button/i, 'SWITCH'],
  [/gas/i, 'GAS'],
  [/faucet|tap|water|mixer/i, 'FAUCET'],
  [/sewage|drain|waste/i, 'SEWAGE'],
  [/light|spot|lamp|luminaire|can\s*light/i, 'LIGHTING'],
  [/junction|control|panel|board|controlbox/i, 'CONTROLBOX'],
];

// Soline Hebrew category -> block fallback.
function blockFromCategory(cat) {
  const c = String(cat || '');
  if (/גז/.test(c)) return 'GAS';
  if (/מים|ברז/.test(c)) return 'FAUCET';
  if (/ניקוז|ביוב/.test(c)) return 'SEWAGE';
  if (/תאורה/.test(c)) return 'LIGHTING';
  if (/מפסק/.test(c)) return 'SWITCH';
  if (/שקע/.test(c)) return 'SOCKET';
  if (/לוח|הגנה|צומת|חיבור/.test(c)) return 'CONTROLBOX';
  if (/חשמל/.test(c)) return 'SOCKET';
  if (/אינסטל/.test(c)) return 'FAUCET';
  return 'CONTROLBOX';
}

function resolveBlock(item) {
  if (CATALOG_MOD) {
    const r = CATALOG_MOD.classify(item);
    // Only trust the catalog block when the element is reference-confirmed; its
    // conservative fallback mislabels unmatched Hebrew names (gas/HVAC/water) as
    // electrical -> SOCKET. For those, derive the block from the local discipline.
    if (r && r.corpus && r.block3d) return mapBlock(r.block3d);
  }
  for (const [re, blk] of NAME_BLOCK) if (re.test(item.name || '')) return blk;
  return blockFromLocal(item);
}

// Like resolveBlock, but returns null when nothing clearly matches (instead of the
// CONTROLBOX fallback). Used by the 3D exporter to decide whether to draw the
// recognizable device glyph (INSERT): recognized devices get a glyph AND a
// true-size box; unrecognized items (most real Hebrew-named .sol elements) get the
// box + label only, so we never scatter a misleading generic ControlBox glyph.
function resolveBlockStrict(item) {
  if (CATALOG_MOD) {
    const r = CATALOG_MOD.classify(item);
    // Reference-confirmed elements always get their (validated) glyph.
    if (r && r.corpus) return mapBlock(r.block3d);
  }
  for (const [re, blk] of NAME_BLOCK) if (re.test(item.name || '')) return blk;
  // Otherwise draw a glyph only when the local discipline resolves to a SPECIFIC
  // device (not the generic CONTROLBOX) — the true-size box + label still represent
  // it, so we never scatter a misleading generic ControlBox glyph.
  const blk = blockFromLocal(item);
  return blk !== 'CONTROLBOX' ? blk : null;
}

// ---------------------------------------------------------------------------
// Element -> per-category BODY layer (for the true-size 3D box). Classifies by the
// element's own Hebrew/English name (+ category when present), so it works even
// when the item is NOT in elements.json (real .sol names differ from the catalog).
// First hit wins; order matters (gas before the broad plumbing rule, HVAC before
// the generic "electrical" rule so ceiling-drops-with-AC land on HVAC).
// ---------------------------------------------------------------------------
const ELEM_CAT = [
  [ELEM.LIGHTING, /תאור|ספוט|מנור|נורה|פנס|תלוי|פנדנט|אפליק|\bled\b|light|lamp|spot|luminaire|sconce|pendant/i],
  [ELEM.HVAC, /מזגן|מיזוג|אוורור|ונטה|מפוח|מאוורר|הנמכת\s*תקרה|תריס|מפזר|שבכ|hvac|\bac\b|duct|vent|fan|diffuser|grille|condens/i],
  [ELEM.GAS, /גז|gas/i],
  [ELEM.PLUMBING, /מים|ברז|ביוב|ניקוז|נקז|צנרת|תמי|דוד|בוילר|אסלה|קונדנס|water|faucet|tap|mixer|sewage|drain|waste|pipe|boiler|toilet/i],
  [ELEM.STRUCT, /עמוד|קורה|מקטע|קונסטרוק|בטון|column|beam|pillar|structural|panel/i],
  [ELEM.OPENING, /חלון|דלת|פתח|מעבר|משקוף|window|door|opening|frame/i],
  [ELEM.ELECTRICAL, /שקע|מפסק|חשמל|תקשורת|רשת|טלפון|נתונים|בקר|גלאי|חיישן|תרמוסטט|אינטרקום|ראוטר|רמקול|socket|outlet|switch|dimmer|button|electr|data|network|phone|tv|hdmi|sensor|thermostat|intercom|router|speaker|junction|control|board|distribution/i],
];
// All the strings that identify an element (its ORDX name, Hebrew label, category)
// joined for regex classification. The .sol path names elements in Hebrew and the
// catalog can't match those without an elements.json row, so we must read them here.
function nameCat(item) {
  return [item.name, item.he, item.heName, item.description, item.category].filter(Boolean).join(' ');
}
// Soline body layer -> default 3D device block (for the recognizable glyph/INSERT).
const ELEMLAYER_BLOCK = {
  [ELEM.ELECTRICAL]: 'SOCKET', [ELEM.PLUMBING]: 'FAUCET', [ELEM.GAS]: 'GAS',
  [ELEM.HVAC]: 'CONTROLBOX', [ELEM.LIGHTING]: 'LIGHTING', [ELEM.STRUCT]: 'CONTROLBOX',
  [ELEM.OPENING]: 'CONTROLBOX', [ELEM.MISC]: 'CONTROLBOX',
};
// The catalog's own elem3d layer names (legacy Elem_*) -> Soline body layers.
const ELEM3D_TO_SOLINE = {
  Elem_Electrical: ELEM.ELECTRICAL, Elem_Plumbing: ELEM.PLUMBING, Elem_Gas: ELEM.GAS,
  Elem_HVAC: ELEM.HVAC, Elem_Lighting: ELEM.LIGHTING, Elem_Struct: ELEM.STRUCT,
  Elem_Opening: ELEM.OPENING, Elem_Misc: ELEM.MISC,
};
function mapElem3d(v) { return ELEM3D_TO_SOLINE[v] || (Object.values(ELEM).includes(v) ? v : ELEM.MISC); }
function elemLayer(item) {
  // PRIMARY: the Soline element-symbol library resolves the item's discipline, and
  // we route the 3D body box onto that discipline's SOL-* layer — so the 3D element
  // colours match the 2D plan symbols exactly (owner: "route each symbol onto the
  // SOL-* discipline layer using the symbol's discipline").
  const key = symKeyFor(item);
  if (key && SYM.SYMBOLS[key]) { const lay = symbolLayer(SYM.SYMBOLS[key].discipline); if (lay) return lay; }
  // Fallbacks (catalog reference / local regex) for anything the library can't resolve.
  const r = CATALOG_MOD ? CATALOG_MOD.classify(item) : null;
  if (r && r.corpus && r.elem3d) return mapElem3d(r.elem3d);
  const s = nameCat(item);
  for (const [layer, re] of ELEM_CAT) if (re.test(s)) return layer;
  if (r && r.elem3d) return mapElem3d(r.elem3d);
  return ELEM.MISC;
}
// Pick the 3D device block from the (corrected) local element layer, refining the
// electrical family (switch / duplex / panel) by name.
function blockFromLocal(item) {
  const layer = elemLayer(item);
  if (layer === ELEM.ELECTRICAL) {
    const s = nameCat(item);
    if (/\bswitch\b|dimmer|מפסק/i.test(s)) return 'SWITCH';
    if (/duplex|double|כפול/i.test(s)) return 'DUPLEXSWITCH';
    if (/panel|board|distribution|junction|control|תשתית|לוח|צומת|חיבור/i.test(s)) return 'CONTROLBOX';
    return 'SOCKET';
  }
  return ELEMLAYER_BLOCK[layer] || 'CONTROLBOX';
}

// ---------------------------------------------------------------------------
// BLOCK geometry libraries.
// Block-local coordinates, centred on the block base point (0,0,0). The INSERT
// then positions/rotates/scales. Geometry sits on layer 0 (INSERT layer colors it).
// ---------------------------------------------------------------------------

// A 3D axis-aligned box [x0..x1, y0..y1, z0..z1] -> 6 quads (each [4 pts]).
function box3D(x0, x1, y0, y1, z0, z1) {
  const p = (x, y, z) => [x, y, z];
  return [
    [p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0)], // bottom
    [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)], // top
    [p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)], // front
    [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)], // back
    [p(x0, y0, z0), p(x0, y1, z0), p(x0, y1, z1), p(x0, y0, z1)], // left
    [p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)], // right
  ];
}

// 3D block definitions: each -> array of quad faces (block-local mm). Detailed,
// recognizable 3D solids for each reference block type. Depth (Y) protrudes from
// the wall (Y+), width (X) centred, height (Z) up from the insertion Z.
// Each model is a composite of axis-aligned boxes (6 faces each) forming a
// recognizable 3D device — back box recessed into the wall (Y-), faceplate on
// the wall face (Y+), plus device-specific detail. Face counts are tuned to the
// reference block models (SOCKET 31, SWITCH 30, DUPLEXSWITCH 60, GAS 28,
// FAUCET 40, SEWAGE 40, LIGHTING 20, CONTROLBOX 11) so the overall 3DFACE tally
// (walls + windows + blocks) approaches the reference's 319.
// A single socket assembly (back box + faceplate + cavity + two pin slots): 5
// boxes = 30 faces, centred at X offset `cx`.
function socketAssembly(cx) {
  return [
    ...box3D(cx - 35, cx + 35, -40, 0, 0, 70),   // recessed back box
    ...box3D(cx - 45, cx + 45, 0, 8, -8, 78),    // faceplate on the wall face
    ...box3D(cx - 16, cx + 16, 8, 14, 20, 50),   // socket cavity
    ...box3D(cx - 12, cx - 4, 14, 18, 30, 44),   // pin slot L
    ...box3D(cx + 4, cx + 12, 14, 18, 30, 44),   // pin slot R
  ];
}
const BLOCKS_3D = {
  // one socket assembly  (5 boxes = 30 faces  ≈ ref 31)
  SOCKET: () => socketAssembly(0),
  // two socket assemblies side by side  (10 boxes = 60 faces  = ref 60)
  DUPLEXSWITCH: () => [...socketAssembly(-37), ...socketAssembly(37)],
  // back box + faceplate + rocker + two screws  (5 boxes = 30 faces  = ref 30)
  SWITCH: () => [
    ...box3D(-35, 35, -40, 0, 0, 70),
    ...box3D(-42, 42, 0, 8, -6, 76),
    ...box3D(-24, 24, 8, 16, 12, 58),
    ...box3D(-3, 3, 8, 12, 66, 72),              // top screw
    ...box3D(-3, 3, 8, 12, -2, 4),               // bottom screw
  ],
  // valve body + inlet + outlet + handle stem + knob  (5 boxes = 30 faces ≈ ref 28)
  GAS: () => [
    ...box3D(-30, 30, 0, 30, 0, 60),
    ...box3D(-6, 6, 30, 60, 22, 38),             // inlet pipe
    ...box3D(-6, 6, -25, 0, 22, 38),             // outlet pipe
    ...box3D(-3, 3, 55, 65, 15, 45),             // handle stem
    ...box3D(-14, 14, 60, 72, 22, 38),           // handle knob
  ],
  // base + riser + spout + tip + two handles + aerator  (7 boxes = 42 faces ≈ ref 40)
  FAUCET: () => [
    ...box3D(-25, 25, 0, 25, 0, 30),             // base
    ...box3D(-9, 9, 0, 18, 30, 150),             // riser
    ...box3D(-9, 60, 0, 18, 132, 150),           // spout (horizontal)
    ...box3D(52, 68, 0, 18, 120, 150),           // spout down-turn
    ...box3D(52, 68, 0, 18, 110, 122),           // aerator
    ...box3D(-22, -14, 0, 18, 90, 120),          // handle L
    ...box3D(14, 22, 0, 18, 90, 120),            // handle R
  ],
  // flange + collar + pipe + four bolts  (7 boxes = 42 faces ≈ ref 40)
  SEWAGE: () => [
    ...box3D(-50, 50, 0, 12, -50, 50),           // flange
    ...box3D(-30, 30, 12, 40, -30, 30),          // collar
    ...box3D(-22, 22, 40, 60, -22, 22),          // pipe
    ...box3D(-45, -39, 0, 6, -45, -39),          // bolt
    ...box3D(39, 45, 0, 6, -45, -39),            // bolt
    ...box3D(-45, -39, 0, 6, 39, 45),            // bolt
    ...box3D(39, 45, 0, 6, 39, 45),              // bolt
  ],
  // housing + lens + trim ring + inner lens  (4 boxes = 24 faces ≈ ref 20)
  LIGHTING: () => [
    ...box3D(-60, 60, -30, 0, -60, 60),
    ...box3D(-50, 50, 0, 6, -50, 50),
    ...box3D(-64, 64, -6, 0, -64, 64),
    ...box3D(-30, 30, 2, 8, -30, 30),            // inner lens
  ],
  // enclosure + door  (2 boxes = 12 faces ≈ ref 11)
  CONTROLBOX: () => [
    ...box3D(-100, 100, -40, 0, -150, 150),
    ...box3D(-96, 96, 0, 10, -146, 146),
  ],
};

// 2D block definitions — OPENINGS ONLY. The crude per-device glyphs that used to
// live here (SOCKET/DUPLEXSWITCH/SWITCH/GAS/FAUCET/SEWAGE/LIGHTING/CONTROLBOX) are
// RETIRED (2026-08-25): every element/infrastructure 2D symbol is now drawn from the
// single source of truth `element_symbols_soline.js` via SYM.toDxf2dGlyph(), so each
// device renders as its real professional glyph instead of collapsing onto ~8 boxes.
// What remains are the PARAMETRIC opening unit-cells (WINDOW1/DOOR1): centred on 0,
// span -0.5..0.5, stretched by INSERT scale (41=Width, 42=Thick) to the true opening
// size — a different mechanism from the fixed device symbols, still live. A point-array
// is a polyline (LINEs), { arc:[cx,cy,r,a0,a1] } a real ARC, { circle:[cx,cy,r] } a
// full circle.
const BLOCKS_2D = {
  // Unit-cell opening blocks (centred on 0, span -0.5..0.5 so INSERT scale
  // 41=Width / 42=Thick stretches them to the true opening size — the reference
  // convention). WINDOW1 = frame + glazing bar; DOOR1 = leaf + real swing arc.
  WINDOW1: () => [
    [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5]],
    [[-0.5, 0], [0.5, 0]],
  ],
  DOOR1: () => [
    [[-0.5, -0.5], [-0.5, 0.5]],                 // hinge jamb
    [[-0.5, 0.5], [0.5, 0.5]],                    // open leaf
    { arc: [-0.5, -0.5, 1.0, 0, 90] },            // swing arc (quarter circle)
  ],
};

// The stretched unit-block name for an opening (window vs door).
function openingBlock(op) { return (op.layer === 'Const_Doors') ? 'DOOR1' : 'WINDOW1'; }

// ---------------------------------------------------------------------------
// 2D element SYMBOL routing — the single source of truth (element_symbols_soline).
// Each element/infrastructure item is drawn as its real professional glyph:
// symKeyFor() resolves the Soline symbol key; SYM.toDxf2dGlyph() bakes that symbol
// to block-local mm (wall at Y=0, +Y into the room). One BLOCK per distinct symbol
// key (name SS_<key>); the INSERT places+rotates it and its layer drives the colour.
// Anything the library cannot resolve falls back to the library's own 'generic'
// symbol — never to a crude box. Replaces the retired BLOCKS_2D device glyphs.
// ---------------------------------------------------------------------------
function glyphKey(it) { return symKeyFor(it) || 'generic'; }
function symBlock2DName(key) { return 'SS_' + key; }
function symLayer2D(key) {
  const s = SYM.SYMBOLS[key];
  return (s && symbolLayer(s.discipline)) || L.MIVNE;
}
function symGlyphPrims(key) {
  const sym = SYM.symbolFor(key) || SYM.symbolFor('generic');
  return SYM.toDxf2dGlyph(sym) || [];
}
// Emit ONE toDxf2dGlyph primitive: array = polyline (LINEs); { circle:[cx,cy,r] } =
// full circle (ARC 0..360); { label:[x,y,text,hmm] } = TEXT baked into the block.
function emitSymGlyphPrim(handle, layer, prim) {
  if (Array.isArray(prim)) return prim.length > 1 ? linesFromPolyline(handle, layer, prim) : '';
  if (prim.circle) return arc2D(handle, layer, prim.circle[0], prim.circle[1], Math.abs(prim.circle[2]), 0, 360);
  if (prim.label) { const [lx, ly, txt, hmm] = prim.label; return textEntity(handle, layer, txt, lx, ly, Math.max(24, Math.abs(hmm))); }
  return '';
}
// BLOCKS section for the 2D plan: fixture symbol blocks (from the source of truth,
// keyed by symbol key) + the parametric opening unit-blocks (WINDOW1/DOOR1).
function blocks2DSection(symBlocks, openingUsed, handle, ctx) {
  let s = g(0, 'SECTION') + g(2, 'BLOCKS');
  s += T.spaceBlocks(handle, ctx);
  for (const [name, prims] of symBlocks) {
    s += T.blockBegin(handle, ctx, name);
    for (const p of prims) s += emitSymGlyphPrim(handle, '0', p);
    s += T.blockEnd(handle, ctx, name);
  }
  for (const name of openingUsed) {
    s += T.blockBegin(handle, ctx, name);
    const fn = BLOCKS_2D[name];
    if (fn) for (const prim of fn()) s += emit2DPrim(handle, '0', prim);
    s += T.blockEnd(handle, ctx, name);
  }
  return s + g(0, 'ENDSEC');
}

// ---------------------------------------------------------------------------
// Entity emitters
// ---------------------------------------------------------------------------
// `edge` (optional) = the 3DFACE edge-visibility flag (group 70). The reference
// wall faces in the ENTITIES section carry 70=15 (all four edges visible); the
// block-internal faces carry no 70 at all. Pass 15 for walls, omit for blocks.
function face3D(handle, layer, quad, edge) {
  const [a, b, c, d] = quad;
  let s = g(0, '3DFACE') + g(5, handle()) + g(8, layerOut(layer)) +
    g(10, num(a[0])) + g(20, num(a[1])) + g(30, num(a[2])) +
    g(11, num(b[0])) + g(21, num(b[1])) + g(31, num(b[2])) +
    g(12, num(c[0])) + g(22, num(c[1])) + g(32, num(c[2])) +
    g(13, num(d[0])) + g(23, num(d[1])) + g(33, num(d[2]));
  if (edge != null) s += g(70, edge);
  return s;
}

function line2D(handle, layer, x1, y1, x2, y2, z = 0) {
  return g(0, 'LINE') + g(5, handle()) + g(8, layerOut(layer)) +
    g(10, num(x1)) + g(20, num(y1)) + g(30, num(z)) +
    g(11, num(x2)) + g(21, num(y2)) + g(31, num(z));
}

function linesFromPolyline(handle, layer, pl, z = 0) {
  let s = '';
  for (let i = 0; i + 1 < pl.length; i++) {
    s += line2D(handle, layer, pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1], z);
  }
  return s;
}

// A real DXF ARC (centre cx,cy, radius r, from a0 to a1 deg, CCW). The 2D block
// symbols use true LINE + ARC primitives (like the reference blocks) rather than
// polygonised circles.
function arc2D(handle, layer, cx, cy, r, a0, a1, z = 0) {
  return g(0, 'ARC') + g(5, handle()) + g(8, layerOut(layer)) +
    g(10, num(cx)) + g(20, num(cy)) + g(30, num(z)) +
    g(40, num(r)) + g(50, num(a0)) + g(51, num(a1));
}

// Emit one 2D block primitive: an array of points = polyline (LINEs); an object
// { arc:[cx,cy,r,a0,a1] } = a real ARC; { circle:[cx,cy,r] } = a full ARC 0..360.
function emit2DPrim(handle, layer, prim, z = 0) {
  if (Array.isArray(prim)) return linesFromPolyline(handle, layer, prim, z);
  if (prim.arc) return arc2D(handle, layer, prim.arc[0], prim.arc[1], prim.arc[2], prim.arc[3], prim.arc[4], z);
  if (prim.circle) return arc2D(handle, layer, prim.circle[0], prim.circle[1], prim.circle[2], 0, 360, z);
  return '';
}

function insert(handle, layer, blockName, x, y, z, rot, sx = 1, sy = 1, sz = 1) {
  return g(0, 'INSERT') + g(5, handle()) + g(8, layerOut(layer)) + g(2, blockName) +
    g(10, num(x)) + g(20, num(y)) + g(30, num(z)) +
    g(41, num(sx)) + g(42, num(sy)) + g(43, num(sz)) + g(50, num(rot));
}

function textEntity(handle, layer, str, x, y, h, z = 0, rot = 0) {
  return g(0, 'TEXT') + g(5, handle()) + g(8, layerOut(layer)) +
    g(10, num(x)) + g(20, num(y)) + g(30, num(z)) +
    g(40, num(h)) + g(50, num(rot)) + g(1, heToCp1255(str)) + g(7, STYLE_NAME);
}

// A filled quadrilateral (group SOLID). DXF fills as a "bowtie" strip, so the
// third/fourth vertices are swapped relative to a CCW ring (a,b,c,d) -> 10=a,
// 11=b, 12=d, 13=c. Used for wall poché fill and (as a triangle) arrowheads.
function solid(handle, layer, a, b, c, d) {
  const dd = d || c;
  return g(0, 'SOLID') + g(5, handle()) + g(8, layerOut(layer)) +
    g(10, num(a[0])) + g(20, num(a[1])) + g(30, num(0)) +
    g(11, num(b[0])) + g(21, num(b[1])) + g(31, num(0)) +
    g(12, num(dd[0])) + g(22, num(dd[1])) + g(32, num(0)) +
    g(13, num(c[0])) + g(23, num(c[1])) + g(33, num(0));
}

// mm -> cm string with up to one decimal (e.g. 3609 -> "360.9", 2500 -> "250").
function cm(mm) {
  const v = Math.round((mm / 10) * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// A filled-triangle arrowhead at `tip`, pointing along unit vector `dir`.
function arrow(handle, layer, tip, dir, nrm, len = 90, wid = 30) {
  const base = [tip[0] - dir[0] * len, tip[1] - dir[1] * len];
  const b1 = [base[0] + nrm[0] * wid, base[1] + nrm[1] * wid];
  const b2 = [base[0] - nrm[0] * wid, base[1] - nrm[1] * wid];
  return solid(handle, layer, tip, b1, b2, b2);
}

// The manual dimension engine (the reference has NO DIMENSION entities). Emits
// exactly 5 entities for one linear dimension between p1 and p2:
//   2x LINE (extension) + 1x LINE (dimension) + 2x SOLID (arrows) + 1x TEXT(cm).
// `off` = perpendicular offset of the dimension line (mm); `side` = +1/-1.
function dimension(handle, layer, p1, p2, opts = {}) {
  const off = opts.off != null ? opts.off : 350;
  const th = opts.textH != null ? opts.textH : 100;
  const sgn = opts.side === -1 ? -1 : 1;
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;          // along
  const nx = -uy * sgn, ny = ux * sgn;     // outward normal
  const q1 = [p1[0] + nx * off, p1[1] + ny * off];
  const q2 = [p2[0] + nx * off, p2[1] + ny * off];
  const ext = 60;                          // extension-line overshoot
  const e1 = [q1[0] + nx * ext, q1[1] + ny * ext];
  const e2 = [q2[0] + nx * ext, q2[1] + ny * ext];
  let s = '';
  s += line2D(handle, layer, p1[0], p1[1], e1[0], e1[1]);
  s += line2D(handle, layer, p2[0], p2[1], e2[0], e2[1]);
  s += line2D(handle, layer, q1[0], q1[1], q2[0], q2[1]);
  s += arrow(handle, layer, q1, [ux, uy], [nx, ny]);
  s += arrow(handle, layer, q2, [-ux, -uy], [nx, ny]);
  let ang = Math.atan2(uy, ux) * 180 / Math.PI;
  if (ang > 90 || ang <= -90) ang += 180;  // keep the number upright
  const mid = [(q1[0] + q2[0]) / 2 + nx * th * 0.4, (q1[1] + q2[1]) / 2 + ny * th * 0.4];
  s += textEntity(handle, layer, cm(L), mid[0], mid[1], th, 0, ang);
  return s;
}

// ---------------------------------------------------------------------------
// Sections: HEADER / TABLES come from the shared Soline template (dxf_soline.js)
// so 2D and 3D share ONE layer/style/font system. BLOCKS stays local (the 3D
// device geometry).
// ---------------------------------------------------------------------------
const headerSection = T.headerSection;
const tablesSection = T.tablesSection;

// BLOCKS section: define each block name in `used` from the given library.
// lib3D=true -> 3DFACE geometry; else 2D LINE geometry.
function blocksSection(used, handle, lib3D, ctx) {
  let s = g(0, 'SECTION') + g(2, 'BLOCKS');
  s += T.spaceBlocks(handle, ctx);                 // mandatory *Model_Space / *Paper_Space (AC1015)
  for (const name of used) {
    s += T.blockBegin(handle, ctx, name);
    if (lib3D) {
      const faces = (BLOCKS_3D[name] || BLOCKS_3D.CONTROLBOX)();
      for (const q of faces) s += face3D(handle, '0', q);
    } else {
      // 2D fixtures now route through blocks2DSection (SYM source of truth); this
      // branch only ever sees opening unit-blocks (WINDOW1/DOOR1) from BLOCKS_2D.
      const fn = BLOCKS_2D[name];
      if (fn) for (const prim of fn()) s += emit2DPrim(handle, '0', prim);
    }
    s += T.blockEnd(handle, ctx, name);
  }
  return s + g(0, 'ENDSEC');
}

// ---------------------------------------------------------------------------
// Geometry: wall prism + extents
// ---------------------------------------------------------------------------
// Wall centreline (x1,y1)-(x2,y2), thickness t, height h -> 6 quad faces of a
// vertical prism (Y already flipped by caller). Faces ordered floor->ceiling.
function wallPrism(w, flipY) {
  const fy = (y) => (flipY ? -y : y);
  const x1 = w.x1, y1 = fy(w.y1), x2 = w.x2, y2 = fy(w.y2);
  const h = w.height || 2500, t = (w.thick || 100) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L * t, ny = dx / L * t; // wall-normal offset (half thickness)
  // 4 base corners (CCW around the wall footprint)
  const A = [x1 + nx, y1 + ny], B = [x2 + nx, y2 + ny];
  const C = [x2 - nx, y2 - ny], D = [x1 - nx, y1 - ny];
  const lo = 0, hi = h;
  const P = (p, z) => [p[0], p[1], z];
  return [
    [P(A, lo), P(B, lo), P(C, lo), P(D, lo)], // floor
    [P(A, hi), P(B, hi), P(C, hi), P(D, hi)], // ceiling
    [P(A, lo), P(B, lo), P(B, hi), P(A, hi)], // side 1
    [P(B, lo), P(C, lo), P(C, hi), P(B, hi)], // end
    [P(C, lo), P(D, lo), P(D, hi), P(C, hi)], // side 2
    [P(D, lo), P(A, lo), P(A, hi), P(D, hi)], // end
  ];
}

// OUTWARD wall prism (owner #2 / #3a): the MEASURED wall line = the INNER (clear)
// room face; the FULL thickness is added OUTWARD (away from the room), never inward
// — the 3D twin of the 2D closure fix. `cen` = room centroid (world frame) tells us
// which way is "outward". Ends are extended by the full thickness at both ends so
// the corner squares fill (butt-join); for a closed room every corner closes.
// Returns 6 quad faces of a full-height vertical prism. `flipY` already applied.
function wallPrismOutward(w, flipY, cen) {
  const fy = (y) => (flipY ? -y : y);
  const x1 = w.x1, y1 = fy(w.y1), x2 = w.x2, y2 = fy(w.y2);
  const h = w.height || 2500, thick = (w.thick || 100);
  const dx = x2 - x1, dy = y2 - y1, Ln = Math.hypot(dx, dy) || 1;
  const ux = dx / Ln, uy = dy / Ln;
  let nx = -uy, ny = ux;                                   // candidate normal
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  if (cen && ((mx - cen[0]) * nx + (my - cen[1]) * ny) < 0) { nx = -nx; ny = -ny; } // point OUT of room
  // extend both ends by the full thickness so shared corners overlap and fill
  const sx = x1 - ux * thick, sy = y1 - uy * thick;
  const ex = x2 + ux * thick, ey = y2 + uy * thick;
  const A = [sx, sy], B = [ex, ey];                        // inner edge (on measured line)
  const Ao = [sx + nx * thick, sy + ny * thick], Bo = [ex + nx * thick, ey + ny * thick]; // outer edge
  const lo = 0, hi = h;
  const P = (p, z) => [p[0], p[1], z];
  return [
    [P(A, lo), P(B, lo), P(Bo, lo), P(Ao, lo)], // floor
    [P(A, hi), P(B, hi), P(Bo, hi), P(Ao, hi)], // ceiling
    [P(A, lo), P(B, lo), P(B, hi), P(A, hi)],   // inner face (measured/clear)
    [P(Ao, lo), P(Bo, lo), P(Bo, hi), P(Ao, hi)], // outer face
    [P(A, lo), P(Ao, lo), P(Ao, hi), P(A, hi)], // end S
    [P(B, lo), P(Bo, lo), P(Bo, hi), P(B, hi)], // end E
  ];
}

// ---------------------------------------------------------------------------
// OPENING VOID in the wall prism (owner: "opening void in the wall prism at correct
// sill/head height, plus a frame solid"). Instead of one solid prism, a wall that
// carries openings is emitted as SUB-PRISMS that leave the light opening empty:
//   * solid full-height columns between/around the openings,
//   * a below-sill band and an above-head lintel band across each opening.
// The measured line is the INNER face; the full thickness is added OUTWARD (matching
// wallPrismOutward). Ends extend by the thickness so shared corners fill.
// ---------------------------------------------------------------------------
// 6 quad faces of a sub-box of the wall: along-range [al0,al1] (mm from the wall
// start A), z-range [z0,z1]; inner edge on the centreline, thickness added toward n.
function wallSubBox(x1, y1, ux, uy, nx, ny, thick, al0, al1, z0, z1) {
  const Ai = [x1 + ux * al0, y1 + uy * al0], Bi = [x1 + ux * al1, y1 + uy * al1];
  const Ao = [Ai[0] + nx * thick, Ai[1] + ny * thick], Bo = [Bi[0] + nx * thick, Bi[1] + ny * thick];
  const P = (p, z) => [p[0], p[1], z];
  return [
    [P(Ai, z0), P(Bi, z0), P(Bo, z0), P(Ao, z0)], // floor
    [P(Ai, z1), P(Bi, z1), P(Bo, z1), P(Ao, z1)], // ceiling
    [P(Ai, z0), P(Bi, z0), P(Bi, z1), P(Ai, z1)], // inner face
    [P(Ao, z0), P(Bo, z0), P(Bo, z1), P(Ao, z1)], // outer face
    [P(Ai, z0), P(Ao, z0), P(Ao, z1), P(Ai, z1)], // end a
    [P(Bi, z0), P(Bo, z0), P(Bo, z1), P(Bi, z1)], // end b
  ];
}
function wallOpeningFaces(w, ops, flipY, cen) {
  const fy = (y) => (flipY ? -y : y);
  const x1 = w.x1, y1 = fy(w.y1), x2 = w.x2, y2 = fy(w.y2);
  const H = w.height || 2500, thick = (w.thick || 100);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  let nx = -uy, ny = ux;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  if (cen && ((mx - cen[0]) * nx + (my - cen[1]) * ny) < 0) { nx = -nx; ny = -ny; }
  const segs = [];
  for (const o of ops) {
    const ox = o.x, oy = fy(o.y);
    const st = (ox - x1) * ux + (oy - y1) * uy;
    const ow = o.width || 900;
    const sill = Math.max(0, Math.min(H - 1, o.z || 0));
    const head = Math.max(sill + 1, Math.min(H, (o.z || 0) + (o.height || H)));
    segs.push({ a0: Math.max(0, st - ow / 2), a1: Math.min(len, st + ow / 2), sill, head });
  }
  segs.sort((a, b) => a.a0 - b.a0);
  const faces = [];
  const box = (a0, a1, z0, z1) => { if (a1 - a0 > 1 && z1 - z0 > 1) faces.push(...wallSubBox(x1, y1, ux, uy, nx, ny, thick, a0, a1, z0, z1)); };
  let cursor = -thick;                                   // extend for corner fill
  for (const sg of segs) {
    if (sg.a0 > cursor) box(cursor, sg.a0, 0, H);        // solid column before the opening
    box(sg.a0, sg.a1, 0, sg.sill);                       // below sill
    box(sg.a0, sg.a1, sg.head, H);                       // above head (lintel)
    cursor = Math.max(cursor, sg.a1);
  }
  if (cursor < len + thick) box(cursor, len + thick, 0, H);
  // Never under-produce: a full-height passage that consumes the whole wall would
  // leave 0 faces — fall back to the solid prism so the wall never vanishes.
  return faces.length ? faces : wallPrismOutward(w, flipY, cen);
}
// FRAME solid (משקוף/מסגרת) of depth `frameThickness` around the opening void, in
// the wall plane, from the derived schema. Doors: 2 jambs + head (+ threshold + an
// open leaf slab). Windows: 4-sided frame + a glazing pane. All faces edge-flagged
// by the caller. Coordinates already in the world frame (flip applied here).
function openingFrameFaces(op, d, flipY) {
  const rot = op.rotation_deg || 0;
  const cx = op.x || 0, cy = (flipY ? -1 : 1) * (op.y || 0);
  const W = d.geom.width, hw = W / 2;
  const fr = Math.min(d.geom.frameThickness, W * 0.4, d.geom.height * 0.4); // profile material
  const hRev = Math.max(20, d.geom.frameReveal) / 2;   // half reveal (across the wall)
  const sill = d.geom.sillHeight || 0, head = sill + d.geom.height;
  const faces = [];
  // one frame bar: local along-range [ax0,ax1], z-range [z0,z1], centred across wall.
  const bar = (ax0, ax1, z0, z1) => {
    const cxl = (ax0 + ax1) / 2, hwl = Math.abs(ax1 - ax0) / 2;
    const [rx, ry] = rotZ(cxl, 0, rot);
    faces.push(...boxFacesRot(cx + rx, cy + ry, hwl, hRev, z0, z1, rot));
  };
  if (!d.noFrame) {
    bar(-hw, -hw + fr, sill, head);                    // left jamb
    bar(hw - fr, hw, sill, head);                      // right jamb
    bar(-hw, hw, head - fr, head);                     // head
    if (d.kind === 'window') bar(-hw, hw, sill, sill + fr); // sill (window → four-sided)
    else bar(-hw, hw, sill, sill + Math.min(fr, 30));  // door threshold (thin)
  }
  const clearW = Math.max(1, W - 2 * fr);
  if (d.kind === 'window') {
    // glazing pane recessed inside the frame
    faces.push(...boxFacesRot(cx, cy, clearW / 2, hRev * 0.28, sill + fr, head - fr, rot));
  } else if (d.config.openMode === 'hinged' || d.config.openMode === 'double') {
    // open leaf slab(s) standing 90° into the room (across the wall).
    const acs = (d.config.swing === 'out') ? -1 : 1;
    const leafT = d.geom.leafThickness || 40;
    const mkLeaf = (hingeAlong, leafLen) => {
      // leaf runs across the wall from the hinge; centre it half-way out.
      const [rx, ry] = rotZ(hingeAlong, acs * leafLen / 2, rot);
      // local: thin along wall (leafT), long across wall (leafLen) → swap half-extents
      const localFaces = boxFacesRotLeaf(cx + rx, cy + ry, leafT / 2, leafLen / 2, sill, head, rot);
      faces.push(...localFaces);
    };
    if (d.config.openMode === 'double') { mkLeaf(-hw + fr, clearW / 2); mkLeaf(hw - fr, clearW / 2); }
    else mkLeaf(d.config.hingeSide === 'R' ? hw - fr : -hw + fr, clearW);
  }
  return faces;
}
// Like boxFacesRot but the "long" extent is across the wall (local Y), used for an
// open leaf slab standing perpendicular to the wall.
function boxFacesRotLeaf(cx, cy, hwX, htY, z0, z1, rot) {
  const local = [[-hwX, -htY], [hwX, -htY], [hwX, htY], [-hwX, htY]];
  const [A, Bp, C, D] = local.map(([lx, ly]) => { const [rx, ry] = rotZ(lx, ly, rot); return [cx + rx, cy + ry]; });
  const V = (p, z) => [p[0], p[1], z];
  return [
    [V(A, z0), V(Bp, z0), V(C, z0), V(D, z0)], [V(A, z1), V(Bp, z1), V(C, z1), V(D, z1)],
    [V(A, z0), V(Bp, z0), V(Bp, z1), V(A, z1)], [V(Bp, z0), V(C, z0), V(C, z1), V(Bp, z1)],
    [V(C, z0), V(D, z0), V(D, z1), V(C, z1)], [V(D, z0), V(A, z0), V(A, z1), V(D, z1)],
  ];
}

// ---------------------------------------------------------------------------
// Corner joins. Where two walls share an endpoint, extend each wall's centreline
// at that end by its OWN half-thickness so the prisms overlap in the corner
// square and fill the gap (the standard butt-join fill). Returns shallow copies
// with adjusted x1/y1/x2/y2 — face COUNT per wall is unchanged (still 6).
// ---------------------------------------------------------------------------
function jointExtendedWalls(walls) {
  const tol = 6; // mm — endpoints closer than this are the same corner
  const near = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by) <= tol;
  return walls.map((w, i) => {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const t = (w.thick || 100) / 2;
    let sShared = false, eShared = false;
    for (let j = 0; j < walls.length; j++) {
      if (j === i) continue;
      const o = walls[j];
      if (near(w.x1, w.y1, o.x1, o.y1) || near(w.x1, w.y1, o.x2, o.y2)) sShared = true;
      if (near(w.x2, w.y2, o.x1, o.y1) || near(w.x2, w.y2, o.x2, o.y2)) eShared = true;
    }
    const es = sShared ? t : 0, ee = eShared ? t : 0;
    return {
      ...w,
      x1: w.x1 - ux * es, y1: w.y1 - uy * es,
      x2: w.x2 + ux * ee, y2: w.y2 + uy * ee,
    };
  });
}

// ---------------------------------------------------------------------------
// Floor slab. The room footprint is the closed loop of wall-centreline vertices
// (world frame); for an open wall chain we fall back to the wall bounding
// rectangle so the model still gets a floor plane. The slab is triangulated
// (ear-clipping, handles concave L/U kitchens) into a top surface at z=0, a
// bottom at z=-thk, and a perimeter skirt — a real closed solid, not a sheet.
// ---------------------------------------------------------------------------
function roomFootprint(walls, flipY) {
  const fy = (y) => (flipY ? -y : y);
  const tol = 8;
  const pts = [];
  for (const w of walls || []) { pts.push([w.x1, fy(w.y1)]); pts.push([w.x2, fy(w.y2)]); }
  if (pts.length < 2) return null;
  const loop = [];
  for (const p of pts) {
    const last = loop[loop.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > tol) loop.push(p);
  }
  const closeTol = Math.max(tol, (walls[0] && walls[0].thick) || 100);
  const closed = (walls.length >= 3) && (loop.length >= 3) &&
    Math.hypot(loop[0][0] - loop[loop.length - 1][0], loop[0][1] - loop[loop.length - 1][1]) <= closeTol;
  if (closed) {
    if (loop.length > 1 &&
      Math.hypot(loop[0][0] - loop[loop.length - 1][0], loop[0][1] - loop[loop.length - 1][1]) <= tol) loop.pop();
    return loop.length >= 3 ? loop : null;
  }
  // fallback: wall-footprint bounding rectangle (CCW)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  if (!Number.isFinite(minX) || (maxX - minX) < 1 || (maxY - minY) < 1) return null;
  return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
}

function polySignedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
// Ear-clipping triangulation. Returns triangles as [i,j,k] index triples (CCW).
function triangulatePolygon(poly) {
  const n = poly.length;
  if (n < 3) return [];
  let idx = [...Array(n).keys()];
  if (polySignedArea(poly) < 0) idx.reverse();      // force CCW
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inTri = (p, a, b, c) => {
    const d1 = cross(a, b, p), d2 = cross(b, c, p), d3 = cross(c, a, p);
    const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  };
  const tris = [], V = idx.slice();
  let guard = 0;
  while (V.length > 3 && guard++ < 5000) {
    let clipped = false;
    for (let i = 0; i < V.length; i++) {
      const a = V[(i - 1 + V.length) % V.length], b = V[i], c = V[(i + 1) % V.length];
      const A = poly[a], B = poly[b], C = poly[c];
      if (cross(A, B, C) <= 0) continue;             // reflex/collinear: not an ear
      let bad = false;
      for (const v of V) { if (v === a || v === b || v === c) continue; if (inTri(poly[v], A, B, C)) { bad = true; break; } }
      if (bad) continue;
      tris.push([a, b, c]); V.splice(i, 1); clipped = true; break;
    }
    if (!clipped) break;                             // degenerate: bail out
  }
  if (V.length === 3) tris.push([V[0], V[1], V[2]]);
  return tris;
}
// A closed floor slab: top surface (z=0), bottom (z=-thk), perimeter skirt.
function floorSlabFaces(poly, thk) {
  const tris = triangulatePolygon(poly);
  const faces = [];
  const top = 0, bot = -Math.abs(thk || 40);
  for (const [a, b, c] of tris) {
    faces.push([[poly[a][0], poly[a][1], top], [poly[b][0], poly[b][1], top], [poly[c][0], poly[c][1], top], [poly[c][0], poly[c][1], top]]);
    faces.push([[poly[a][0], poly[a][1], bot], [poly[c][0], poly[c][1], bot], [poly[b][0], poly[b][1], bot], [poly[b][0], poly[b][1], bot]]);
  }
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    faces.push([[p[0], p[1], bot], [q[0], q[1], bot], [q[0], q[1], top], [p[0], p[1], top]]);
  }
  return faces;
}

// ---------------------------------------------------------------------------
// Openings (windows / doors): drawn as real 3DFACE geometry on Const_Windows /
// Const_Doors — matching the reference, which renders 18 window 3DFACEs (not
// blocks). An opening is a box whose length runs ALONG the wall (width), whose
// depth spans the wall thickness, and whose height rises from the sill (z).
// ---------------------------------------------------------------------------
function rotZ(px, py, deg) {
  const a = (deg || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [px * c - py * s, px * s + py * c];
}
// The 6 quad faces of a rotated box: half-width hw (along wall), half-thickness
// ht, from z0 to z1, centred at (cx,cy) and rotated `rot` deg about Z.
function boxFacesRot(cx, cy, hw, ht, z0, z1, rot) {
  const local = [[-hw, -ht], [hw, -ht], [hw, ht], [-hw, ht]];
  const [A, Bp, C, D] = local.map(([lx, ly]) => {
    const [rx, ry] = rotZ(lx, ly, rot); return [cx + rx, cy + ry];
  });
  const V = (p, z) => [p[0], p[1], z];
  return [
    [V(A, z0), V(Bp, z0), V(C, z0), V(D, z0)], // sill
    [V(A, z1), V(Bp, z1), V(C, z1), V(D, z1)], // head
    [V(A, z0), V(Bp, z0), V(Bp, z1), V(A, z1)],
    [V(Bp, z0), V(C, z0), V(C, z1), V(Bp, z1)],
    [V(C, z0), V(D, z0), V(D, z1), V(C, z1)],
    [V(D, z0), V(A, z0), V(A, z1), V(D, z1)],
  ];
}
// Build the quad faces of an opening (already flipped to world frame). Doors are
// a single box (6 faces). Windows get a recessed glazing pane inside the frame
// (2 boxes = 12 faces), mirroring the reference's richer window geometry.
function openingFaces(op, flipY) {
  const w = op.width || 1000, t = op.depth || 100, h = op.height || 1000;
  const z0 = op.z || 0, z1 = z0 + h;
  const cx = op.x || 0, cy = (flipY ? -1 : 1) * (op.y || 0);
  const rot = op.rotation_deg || 0;
  const faces = boxFacesRot(cx, cy, w / 2, t / 2, z0, z1, rot); // frame box
  if (/window|חלון/i.test(op.name || '') || op.layer === 'Const_Windows') {
    const fw = Math.min(80, w * 0.12), fh = Math.min(80, h * 0.12); // frame margin
    faces.push(...boxFacesRot(cx, cy, Math.max(w / 2 - fw, 1), t / 4,
      z0 + fh, z1 - fh, rot));                                     // glazing pane
  }
  return faces;
}
function isWindow(item) { return /window/i.test(item.type || '') || /window|חלון/i.test(item.name || ''); }
function isDoor(item) { return /door/i.test(item.type || '') || /\bdoor\b|דלת/i.test(item.name || ''); }

// Does opening `o` sit on wall `w`? Prefer the stored host-wall endpoints (exact),
// else fall back to a geometric test: the opening centre projects onto the wall
// span and is within ~1.5×thickness of the wall line.
function openingBelongsToWall(o, w, flipY) {
  const r = (v) => Math.round(v / 4);
  if (o.wallX1 != null && w.x1 != null &&
    r(o.wallX1) === r(w.x1) && r(o.wallY1) === r(w.y1) &&
    r(o.wallX2) === r(w.x2) && r(o.wallY2) === r(w.y2)) return true;
  if (o.wallX1 != null) return false;               // stored, but a different wall
  // geometric fallback (synthetic scenes without stored wall coords)
  const fy = (y) => (flipY ? -y : y);
  const x1 = w.x1, y1 = fy(w.y1), x2 = w.x2, y2 = fy(w.y2);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const ox = o.x || 0, oy = fy(o.y || 0);
  const st = (ox - x1) * ux + (oy - y1) * uy;
  const perp = Math.abs((ox - x1) * nx + (oy - y1) * ny);
  return st >= -50 && st <= len + 50 && perp <= (w.thick || 100) * 1.5 + 200;
}

function computeExtents(scene, flipY) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const fy = (y) => (flipY ? -y : y);
  const acc = (x, y) => {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  };
  for (const w of scene.walls || []) {
    const t = (w.thick || 100) / 2;
    acc(w.x1 - t, fy(w.y1) - t); acc(w.x1 + t, fy(w.y1) + t);
    acc(w.x2 - t, fy(w.y2) - t); acc(w.x2 + t, fy(w.y2) + t);
  }
  for (const it of scene.items || []) {
    const r = Math.max(it.width || 0, it.depth || 0, 100);
    acc((it.x || 0) - r, fy(it.y || 0) - r); acc((it.x || 0) + r, fy(it.y || 0) + r);
  }
  for (const op of scene.openings || []) {
    const r = Math.max(op.width || 0, op.depth || 0, 100) / 2 + 50;
    acc((op.x || 0) - r, fy(op.y || 0) - r); acc((op.x || 0) + r, fy(op.y || 0) + r);
  }
  for (const cab of scene.cabinets || []) {
    const r = Math.max(cab.width || 0, cab.depth || 0, 100);
    acc((cab.cx || 0) - r, fy(cab.cy || 0) - r); acc((cab.cx || 0) + r, fy(cab.cy || 0) + r);
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 1000; maxY = 1000; }
  return { minX, minY, maxX, maxY };
}

// ---------------------------------------------------------------------------
// Scene normalization
// ---------------------------------------------------------------------------
function isModel(x) { return x && Array.isArray(x.rooms); }

// Build a normalized scene from a parseOrdx model, using placement.placeOnWall
// for fixture X/Y/orientation and the wall Dimensions for thickness/height.
function sceneFromModel(model, opts = {}) {
  const { placeOnWall } = require('./placement');
  const elements = opts.elements || loadElements();
  const catByName = elementIndex(elements);
  const walls = [], items = [], openings = [], floorShapes = [], cabinets = [];
  for (const room of model.rooms || []) {
    // PLANNING: cabinet run for this room -> pre-flip (ORDX frame) 3D placement.
    // Each cabinet is centred along its wall at fromLeft+width/2, rotated to the
    // wall; the draw step protrudes it into the room and adds kickboard/counter.
    for (const cab of room.cabinets || []) {
      const wall = (room.walls || []).find((w) => w.number === cab.wallId) || (room.walls || [])[0];
      const p = wall && wall.position; if (!p) continue;
      const dx = p.endX - p.startX, dy = p.endY - p.startY, L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;
      const along = (cab.fromLeft || 0) + (cab.width || 600) / 2;
      cabinets.push({
        name: cab.name || 'ארון', kind: cab.kind || 'base',
        cx: p.startX + ux * along, cy: p.startY + uy * along,   // pre-flip centre on wall line
        rotation_deg: Math.atan2(dy, dx) * 180 / Math.PI,
        width: cab.width || 600, depth: cab.depth || 580,
        heightFrom: cab.heightFrom || 0, heightTo: cab.heightTo || 900,
        wallThick: (wall.dimensions && wall.dimensions.thick) || 100,
      });
    }
    // Real floor outline from the ORDX Floors/Floor/Shape layer (parseOrdx surfaces
    // it pre-flip, in the wall plan frame). Preferred over the wall-centreline
    // approximation for the 3D floor slab; absent on most files (fallback kicks in).
    if (Array.isArray(room.floorShape) && room.floorShape.length >= 3) {
      floorShapes.push(room.floorShape.map((p) => ({ x: p.x, y: p.y })));
    }
    for (const wall of room.walls || []) {
      const p = wall.position, dim = wall.dimensions || {};
      const all = [...(wall.fixtures || []), ...(wall.furnishings || [])];
      // A wall carrying a window is an exterior wall (reference convention:
      // windows live on Const_Windows and their host walls on Const_Walls_Ext).
      const hasWindow = all.some(isWindow);
      const wallThick = dim.thick || 100, wallHeight = dim.height || 2500;
      if (p) {
        walls.push({
          x1: p.startX, y1: p.startY, x2: p.endX, y2: p.endY,
          thick: wallThick, height: wallHeight,
          exterior: hasWindow || /ext|exterior|חוץ|חיצ/i.test(wall.description || ''),
        });
      }
      for (const item of all) {
        const pos = placeOnWall(wall, item, 0, 0); // {x, y:-py, orientation} or null
        if (!pos) continue;
        const sz = item.size || {};
        const win = isWindow(item), door = isDoor(item);
        const cr = CATALOG_MOD ? CATALOG_MOD.classify(item) : null;
        const meta = catByName(item.name);
        // תווית עברית לתצוגה בתלת-ממד: heName -> תיאור-עברי -> שם-קטלוג -> אנגלי.
        const heLabel = item.heName || (isHebrew(item.description) ? item.description : null) ||
          (cr && cr.he) || (meta && meta.he) || item.name;
        if (win || door) {
          const oW = sz.width != null ? sz.width : (cr && cr.w != null ? cr.w : 1000);
          const oH = sz.height != null ? sz.height : (cr && cr.h != null ? cr.h : (door ? 2050 : 1200));
          // גובה-אדן: Y ב-ORDX הוא מרכז-הפתח; אדן = מרכז - חצי-גובה (לא שלילי).
          const centerY = (item.position && item.position.y != null) ? item.position.y : (door ? oH / 2 : 1070);
          const sill = door ? 0 : Math.max(0, centerY - oH / 2);
          openings.push({
            layer: win ? 'Const_Windows' : 'Const_Doors',
            name: item.name,
            he: heLabel,
            type: item.type, class: item.class,
            kind: win ? 'window' : 'door',
            x: pos.x, y: -pos.y,                     // pre-flip (ORDX frame)
            z: sill,                                 // sill height (floor-relative)
            mount: (item.position && item.position.y != null) ? item.position.y : null,
            rotation_deg: pos.orientation / 10,
            width: oW,
            height: oH,
            depth: wallThick,                        // span the wall thickness
            wallThick,
            // host-wall endpoints (pre-flip ORDX frame, same frame as x/y) so the
            // 3D wall prism can be carved with the opening void.
            wallX1: p ? p.startX : null, wallY1: p ? p.startY : null,
            wallX2: p ? p.endX : null, wallY2: p ? p.endY : null,
          });
          continue;
        }
        items.push({
          name: item.name,
          he: heLabel,
          category: (meta && meta.category) || (cr && cr.disc) || item.class || null,
          x: pos.x, y: -pos.y,                 // store pre-flip (sceneFromModel returns ORDX frame)
          // Wall-start anchor (pre-flip ORDX frame) — lets the 2D plan draw a
          // position dimension of the fixture's distance along the wall.
          wallStartX: p ? p.startX : null,
          wallStartY: p ? p.startY : null,
          wallThick,                            // host-wall thickness (for 3D face-mount offset)
          z: (item.position ? item.position.y : null) != null
            ? item.position.y
            : (cr && cr.mount != null ? cr.mount : (meta && meta.mount_height_mm) || 0),
          rotation_deg: pos.orientation / 10,  // orientation code is deg*10
          // מידות אמת מהקטלוג (size מפורש -> elements.json -> ברירת-מחדל קורפוס).
          width: sz.width != null ? sz.width : (cr && cr.w != null ? cr.w : (meta && meta.width_mm) || 100),
          depth: sz.depth != null ? sz.depth : (cr && cr.d != null ? cr.d : (meta && meta.depth_mm) || 20),
          height: sz.height != null ? sz.height : (cr && cr.h != null ? cr.h : (meta && meta.height_mm) || 80),
        });
      }
    }
  }
  return { walls, items, openings, floorShapes, cabinets };
}

function normalizeScene(sceneOrModel, opts) {
  if (isModel(sceneOrModel)) return sceneFromModel(sceneOrModel, opts);
  return {
    walls: sceneOrModel.walls || [],
    items: sceneOrModel.items || [],
    openings: sceneOrModel.openings || sceneOrModel.windows || [],
    floorShapes: sceneOrModel.floorShapes || [],
    cabinets: sceneOrModel.cabinets || [],
  };
}

function loadElements() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'elements.json'), 'utf8')); }
  catch { return []; }
}
// Index elements by en/he name -> row (for category + fallback dims).
function elementIndex(elements) {
  const byEn = new Map(), byHe = new Map();
  for (const e of elements) {
    if (e.en) byEn.set(e.en.toLowerCase(), e);
    if (e.he) byHe.set(e.he, e);
  }
  return (name) => byEn.get(String(name || '').toLowerCase()) || byHe.get(name) || null;
}

// ---------------------------------------------------------------------------
// Public exporters
// ---------------------------------------------------------------------------

// 3D: wall prisms (3DFACE) + fixture blocks (3DFACE) placed via INSERT.
function exportDXF3DPro(sceneOrModel, opts = {}) {
  const flipY = opts.flipY !== false;
  const scene = normalizeScene(sceneOrModel, opts);
  const ext = computeExtents(scene, flipY);
  const handle = makeHandleGen(0x1000);

  // Which blocks are actually used.
  const used = new Set();
  for (const it of scene.items) used.add(resolveBlock(it));

  // Element bodies (true-size W×D×H boxes + Hebrew labels) are ON by default — this
  // is what makes the 3D show ELEMENTS, not just walls. Set opts.elementBoxes=false
  // for the old reference-only behavior (a device glyph per fixture, no bodies).
  const elementBoxes = opts.elementBoxes !== false;

  const fy = (y) => (flipY ? -y : y);

  // Room footprint + centroid (world frame): drives the floor slab and tells us
  // which side of each wall is "the room" so element bodies protrude inward.
  const foot = roomFootprint(scene.walls, flipY);
  let ccx = 0, ccy = 0;
  if (foot && foot.length) { for (const p of foot) { ccx += p[0]; ccy += p[1]; } ccx /= foot.length; ccy /= foot.length; }
  const haveCentroid = !!(foot && foot.length >= 3);

  let ents = '';
  // floor slab (room footprint) at z=0 — makes the model read as a real room,
  // not a set of floating wall sticks. On by default; opts.floor=false disables.
  if (opts.floor !== false) {
    // Prefer the REAL floor-geometry polygon(s) from the ORDX Floors/Floor/Shape
    // layer (room.floorShape -> scene.floorShapes) when present — more accurate than
    // the wall-centreline approximation. Fall back to the wall-centreline footprint
    // (foot) when the source carries no floor-shape.
    const realShapes = (scene.floorShapes || [])
      .filter((poly) => Array.isArray(poly) && poly.length >= 3)
      .map((poly) => poly.map((p) => [p.x, fy(p.y)]));
    if (realShapes.length) {
      for (const poly of realShapes)
        for (const q of floorSlabFaces(poly, opts.floorThick || 40)) ents += face3D(handle, L.RITZPA, q, 15);
    } else if (foot) {
      for (const q of floorSlabFaces(foot, opts.floorThick || 40)) ents += face3D(handle, L.RITZPA, q, 15);
    }
  }
  // WALLS (owner #3a): render every wall as a FULL-HEIGHT 3DFACE prism on SOL-KIROT.
  // The measured line is the INNER (clear) face; the full thickness is added OUTWARD
  // (per #2), the 3D twin of the 2D closure fix. `cen` = room centroid so "outward"
  // is unambiguous. Corners overlap (ends extended by the wall thickness) so the box
  // reads as a closed room, not floating sticks.
  const cen = haveCentroid ? [ccx, ccy] : null;
  // Associate each opening with its host wall (stored endpoints first, else a
  // geometric projection) so the wall prism can be carved with the opening void.
  const allOpenings = scene.openings || [];
  const openingsOnWall = (w) => allOpenings.filter((o) => openingBelongsToWall(o, w, flipY));
  for (const w of scene.walls) {
    const mine = openingsOnWall(w);
    const faces = mine.length ? wallOpeningFaces(w, mine, flipY, cen) : wallPrismOutward(w, flipY, cen);
    for (const q of faces) ents += face3D(handle, L.KIROT, q, 15);
  }
  // Measurement NOTE for an element/opening/cabinet (owner #3b): the ONLY text the
  // 3D model emits. Reads a genuine note/comment/remark field — never the element's
  // own name/description (those are NOT notes).
  const noteOf = (x) => {
    if (!x) return null;
    const n = x.note != null ? x.note : (x.comment != null ? x.comment : x.remark);
    const s = n == null ? '' : String(n).trim();
    return s ? s : null;
  };
  // openings (windows/doors): a FRAME SOLID (משקוף/מסגרת) of depth frameThickness
  // around the void, + glazing pane (window) or open leaf slab (door), from the
  // derived schema, on SOL-PTACHIM. NO auto label — only a note if one is present.
  const openingReport3d = [];
  for (const op of allOpenings) {
    const d = op.__derived || (op.__derived = OPEN.deriveOpening(op));
    const opLayer = openingLayer(op, d);              // SOL-CHALON-SYM / SOL-DELET-SYM
    let n = 0;
    for (const q of openingFrameFaces(op, d, flipY)) { ents += face3D(handle, opLayer, q, 15); n++; }
    openingReport3d.push({ name: op.he || op.name, kind: d.kind, mode: d.config.openMode, faces: n });
    const note = noteOf(op);
    if (note) {
      const ow = op.width || 1000, oh = d.geom.height || 1000;
      ents += textEntity(handle, kindLayer(opLayer, 'TXT'), note, (op.x || 0) - ow / 2, fy(op.y || 0),
        Math.max(120, Math.min(220, ow * 0.12)), (d.geom.sillHeight || 0) + oh + 40);
    }
  }
  exportDXF3DPro._lastOpenings = openingReport3d;
  // fixtures / accessories
  for (const it of scene.items) {
    const blk = resolveBlock(it);
    const layer = BLOCK_LAYER[blk] || L.CHASHMAL;
    // Recognizable device glyph (INSERT). Keep it for recognized devices; when
    // element bodies are OFF, keep the old behavior of a glyph for EVERY fixture.
    if (!elementBoxes || resolveBlockStrict(it)) {
      ents += insert(handle, layer, blockName(blk), it.x || 0, fy(it.y || 0), it.z || 0, it.rotation_deg || 0);
    }
    // True-size 3D body: a W(along-wall)×D(across-wall)×H(up) box at the element,
    // rotated to the wall, on its per-category Elem_* layer, + a Hebrew name label.
    if (elementBoxes) {
      const W = Math.max(Math.abs(it.width || 0), 20);
      const D = Math.max(Math.abs(it.depth || 0), 10);
      const H = Math.max(Math.abs(it.height || 0), 20);
      const rot = it.rotation_deg || 0;
      let cx = it.x || 0, cy = fy(it.y || 0);
      // Mount the body ON the wall face and protrude it INTO the room, instead of
      // straddling the centreline half-buried. The wall-normal is rot+90; pick the
      // sign that points at the room centroid; offset back-face to the wall face.
      const rad = (rot + 90) * Math.PI / 180;
      let nx = Math.cos(rad), ny = Math.sin(rad);
      if (haveCentroid && (ccx - cx) * nx + (ccy - cy) * ny < 0) { nx = -nx; ny = -ny; }
      const off = ((it.wallThick || 100) / 2) + D / 2;
      cx += nx * off; cy += ny * off;
      const z0 = it.z || 0, z1 = z0 + H;
      // v7: refine so drains -> SOL-NIKUZ, fans/diffusers -> SOL-IVRUR.
      const bodyLayer = refineDisciplineLayer(elemLayer(it), it);
      for (const q of boxFacesRot(cx, cy, W / 2, D / 2, z0, z1, rot)) {
        ents += face3D(handle, bodyLayer, q, 15);
      }
      // NO auto label (owner #3b): the element is represented by its true-size 3D
      // body + device glyph. Emit text ONLY when the element carries a note.
      const note = noteOf(it);
      if (note) {
        let lang = rot; if (lang > 90 || lang <= -90) lang += 180;
        const ar = rot * Math.PI / 180;
        const th = Math.max(70, Math.min(160, W * 0.5));
        ents += textEntity(handle, kindLayer(bodyLayer, 'TXT'), note,
          cx - Math.cos(ar) * W / 2, cy - Math.sin(ar) * W / 2, th, z1 + 40, lang);
      }
    }
  }

  // PLANNING: cabinet run as true-size 3D carcasses. Base/tall cabinets get a
  // RECESSED KICKBOARD band (~120mm tall, inset ~50mm from the front — the צוקל
  // Michael wants visible); base cabinets also get a COUNTERTOP slab (~920mm).
  // Protrusion into the room mirrors the element-body logic (wall-normal toward
  // the room centroid). Additive: no cabinets -> nothing emitted.
  for (const cab of scene.cabinets || []) {
    const rot = cab.rotation_deg || 0;
    const W = Math.max(Math.abs(cab.width || 0), 20);
    const D = Math.max(Math.abs(cab.depth || 0), 20);
    const z0 = cab.heightFrom || 0, z1 = Math.max(cab.heightTo || 900, z0 + 20);
    let cx = cab.cx || 0, cy = fy(cab.cy || 0);
    const rad = (rot + 90) * Math.PI / 180;
    let nx = Math.cos(rad), ny = Math.sin(rad);
    if (haveCentroid && (ccx - cx) * nx + (ccy - cy) * ny < 0) { nx = -nx; ny = -ny; }
    const off = ((cab.wallThick || 100) / 2) + D / 2;
    cx += nx * off; cy += ny * off;                    // carcass centre in the room
    const hasKick = cab.kind !== 'wall';               // base + tall stand on a צוקל
    const kickH = 120;
    const carcassZ0 = hasKick ? z0 + kickH : z0;       // carcass sits ON the kickboard
    // carcass — kitchen cabinetry on its own discipline (SOL-MITBACH-*).
    for (const q of boxFacesRot(cx, cy, W / 2, D / 2, carcassZ0, z1, rot)) ents += face3D(handle, L.MITBACH, q, 15);
    // recessed kickboard (set back ~50mm from the front, slightly narrower)
    if (hasKick) {
      const kx = cx - nx * 25, ky = cy - ny * 25;      // recede the front by ~50mm
      for (const q of boxFacesRot(kx, ky, (W - 40) / 2, (D - 50) / 2, z0, z0 + kickH, rot)) ents += face3D(handle, L.MITBACH, q, 15);
    }
    // countertop slab on base cabinets (front overhang + a touch on the sides)
    if (cab.kind === 'base') {
      const tx = cx + nx * 15, ty = cy + ny * 15;      // 30mm front overhang
      const topZ0 = Math.max(z1, 900);
      for (const q of boxFacesRot(tx, ty, W / 2 + 5, (D + 40) / 2, topZ0, topZ0 + 40, rot)) ents += face3D(handle, L.MITBACH, q, 15);
    }
    // NO auto label (owner #3b): emit text ONLY when the cabinet carries a note.
    const cnote = noteOf(cab);
    if (cnote) {
      let lang = rot; if (lang > 90 || lang <= -90) lang += 180;
      ents += textEntity(handle, kindLayer(L.MITBACH, 'TXT'), cnote, cx, cy, Math.max(90, Math.min(180, W * 0.4)), z1 + 60, lang);
    }
  }

  const ctx = {};
  const tbls = tablesSection(ext, [], [...used], handle, ctx);
  const blks = blocksSection([...used], handle, true, ctx);
  const objs = T.objectsSection(handle, ctx);
  return headerSection(ext, handle.peek()) + tbls + blks +
    g(0, 'SECTION') + g(2, 'ENTITIES') + ents + g(0, 'ENDSEC') + objs + g(0, 'EOF');
}

// 2D measurement plan (DR1) — the reference conventions from DXF_2D_METHOD.md:
//   * walls   -> poché: double line (Const_Walls + Const_Walls_Ext) + Const_Fill SOLID
//   * each wall length -> a manually-built dimension (5 entities) on Dim_Wall
//   * openings -> stretched-unit INSERT (41=Width, 42=Thick, 50=angle) on their layer
//   * fixtures -> INSERT symbol (fixed scale) + "H nn" height text on {disc}_H
//   * Hebrew   -> lives in the legend (Text_Legend), NOT next to each fixture
function exportDXF2DPro(sceneOrModel, opts = {}) {
  const flipY = opts.flipY !== false;
  const scene = normalizeScene(sceneOrModel, opts);
  const ext = computeExtents(scene, flipY);
  const handle = makeHandleGen(0x1000);
  const fy = (y) => (flipY ? -y : y);

  // Fixture symbol blocks: one per distinct Soline symbol key, baked to its real
  // professional glyph by the source of truth. symBlocks: blockName -> [prims].
  const symBlocks = new Map();
  for (const it of scene.items) {
    const key = glyphKey(it);
    const name = symBlock2DName(key);
    if (!symBlocks.has(name)) symBlocks.set(name, symGlyphPrims(key));
  }
  // Opening unit-blocks (parametric stretch) are the only remaining BLOCKS_2D users.
  const openingUsed = new Set();
  for (const op of scene.openings || []) openingUsed.add(openingBlock(op));

  let ents = '';
  // walls: poché double-line + Const_Fill SOLID + wall-length dimension.
  for (const w of scene.walls) {
    const x1 = w.x1, y1 = fy(w.y1), x2 = w.x2, y2 = fy(w.y2);
    const t = (w.thick || 100) / 2;
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / L * t, ny = (x2 - x1) / L * t;
    const A = [x1 + nx, y1 + ny], B = [x2 + nx, y2 + ny];
    const C = [x2 - nx, y2 - ny], D = [x1 - nx, y1 - ny];
    ents += line2D(handle, L.KIROT, A[0], A[1], B[0], B[1]); // outer face
    ents += line2D(handle, L.KIROT, D[0], D[1], C[0], C[1]);     // inner face
    ents += line2D(handle, L.KIROT, A[0], A[1], D[0], D[1]);     // end caps
    ents += line2D(handle, L.KIROT, B[0], B[1], C[0], C[1]);
    ents += solid(handle, L.KIROT_FILL, A, B, C, D);                   // poché fill
    ents += dimension(handle, L.MIDOT_PNIM, [x1, y1], [x2, y2], { off: 350 + t, side: 1, textH: 120 });
  }
  // openings (windows/doors): stretched-unit INSERT on the opening discipline
  // (v7: SOL-CHALON-SYM for windows, SOL-DELET-SYM for doors).
  for (const op of scene.openings || []) {
    ents += insert(handle, isWindow(op) ? L.CHALON : L.DELET, openingBlock(op),
      op.x || 0, fy(op.y || 0), 0, op.rotation_deg || 0, op.width || 1000, op.depth || 100, 1);
  }
  // fixtures: 2D symbol INSERT (fixed scale) + height annotation on {disc}_H +
  // a position dimension (distance along the wall from the wall start) on
  // {disc}_DIM — the reference adds one position dimension per fixture.
  for (const it of scene.items) {
    const key = glyphKey(it);
    const disc = symLayer2D(key);
    ents += insert(handle, disc, symBlock2DName(key), it.x || 0, fy(it.y || 0), 0, it.rotation_deg || 0);
    if (opts.heights !== false) {
      ents += textEntity(handle, disc, 'H ' + cm(it.z || 0), (it.x || 0) + 70, fy(it.y || 0) + 40, 90);
    }
    // Position dimension: wall-start corner -> fixture centre, measured along
    // the wall, offset to the room side. Only when the wall anchor is known and
    // the fixture is not sitting on the corner itself.
    if (opts.posDims !== false && it.wallStartX != null) {
      const p1 = [it.wallStartX, fy(it.wallStartY)];
      const p2 = [it.x || 0, fy(it.y || 0)];
      if (Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) > 50) {
        ents += dimension(handle, L.MIDOT_PNIM, p1, p2, { off: 200, side: -1, textH: 90 });
      }
    }
  }
  // legend: one clean symbol swatch + Hebrew name per distinct fixture symbol.
  if (opts.legend !== false) {
    const lx = ext.maxX + 600;
    let ly = ext.maxY;
    for (const name of symBlocks.keys()) {
      const key = name.slice(3);                      // strip "SS_"
      const sym = SYM.SYMBOLS[key];
      ents += insert(handle, L.TEKST, name, lx, ly, 0, 0);
      ents += textEntity(handle, L.TEKST, (sym && sym.category) || key, lx + 200, ly - 30, 120);
      ly -= 350;
    }
  }

  const ctx = {};
  const allBlockNames = [...symBlocks.keys(), ...openingUsed];
  const tbls = tablesSection(ext, [], allBlockNames, handle, ctx);
  const blks = blocks2DSection(symBlocks, openingUsed, handle, ctx);
  const objs = T.objectsSection(handle, ctx);
  return headerSection(ext, handle.peek()) + tbls + blks +
    g(0, 'SECTION') + g(2, 'ENTITIES') + ents + g(0, 'ENDSEC') + objs + g(0, 'EOF');
}

// Reference INSERTs use mixed-case block names (Socket, DuplexSwitch, ...). DXF
// block names are case-insensitive; we mixed-case the reference set for fidelity.
// The name an INSERT writes for a fixture block. It MUST be byte-identical to the
// name the BLOCK definition and its BLOCK_RECORD carry (both emit the raw uppercase
// key, because the geometry libraries BLOCKS_3D / BLOCKS_2D are keyed by it). An
// earlier title-case display map ('SOCKET' -> 'Socket') made every fixture INSERT
// depend on AutoCAD's case-insensitive block-name resolution; strict R2000 loaders
// treat a block reference that doesn't resolve as a hard error, so we now emit the
// exact definition name and leave no case gap.
function blockName(blk) { return blk; }

// ---------------------------------------------------------------------------
// DXF re-parsers (for the self-test): pull the block-name (group 2) that follows
// each BLOCK / INSERT marker, tolerating the padded group codes.
// ---------------------------------------------------------------------------
function tokenize(dxf) {
  const raw = dxf.split('\n');
  const toks = [];
  for (let i = 0; i + 1 < raw.length; i += 2) {
    toks.push([raw[i].trim(), raw[i + 1]]);
  }
  return toks;
}
// After a `0 <marker>` pair, return the value of the first following `2 <name>`
// pair before the next `0 ...`. Collect one per marker occurrence.
function namesAfterMarker(dxf, marker) {
  const toks = tokenize(dxf);
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    if (toks[i][0] === '0' && toks[i][1] === marker) {
      for (let j = i + 1; j < toks.length && toks[j][0] !== '0'; j++) {
        if (toks[j][0] === '2') { out.push(toks[j][1]); break; }
      }
    }
  }
  return out;
}
function parseBlockDefNames(dxf) {
  return new Set(namesAfterMarker(dxf, 'BLOCK').map((s) => s.toLowerCase()));
}
function parseInsertBlockNames(dxf) {
  return namesAfterMarker(dxf, 'INSERT');
}

// ---------------------------------------------------------------------------
// Self-test: structural comparison to the reference conventions.
// ---------------------------------------------------------------------------
function selfTest(dxf, scene, opts = {}) {
  const problems = [];
  // Guard: a caller that passes a non-string (undefined DXF) must get a clean
  // failure, not a "Cannot read properties of undefined (reading 'startsWith')".
  if (typeof dxf !== 'string') {
    return { ok: false, problems: ['selfTest: dxf is not a string (' + typeof dxf + ')'],
      layers: 0, inserts: 0, blockDefs: 0, faces: 0, lines: 0, texts: 0, asciiOk: false };
  }
  scene = scene || { walls: [], items: [], openings: [] };
  const count = (re) => (dxf.match(re) || []).length;
  const has = (s) => dxf.includes(s);

  // Section structure
  if (!dxf.startsWith('  0\nSECTION\n')) problems.push('missing opening SECTION');
  if (!/\n\s*0\nEOF\n?$/.test(dxf)) problems.push('missing EOF');
  for (const sec of ['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES'])
    if (!has('\n' + sec + '\n')) problems.push('missing ' + sec + ' section');

  // Header vars present (reference parity)
  for (const v of ['$ACADVER', '$EXTMIN', '$EXTMAX', '$DWGCODEPAGE', '$LTSCALE'])
    if (!has(v)) problems.push('missing header var ' + v);
  if (!has('ansi_1255')) problems.push('missing $DWGCODEPAGE ansi_1255');

  // Tables parity
  if (!has('\nVPORT\n')) problems.push('missing VPORT table');
  if (!has('\nHIDDEN\n')) problems.push('missing HIDDEN linetype');
  if (!has('\narial.ttf\n')) problems.push('missing Hebrew TTF style font');
  const nLayer = count(/\n\s*0\nLAYER\n/g);
  if (nLayer < LAYERS.length) problems.push(`layer count ${nLayer} < ${LAYERS.length}`);
  // Layer NAMES are emitted in Hebrew (CP1255) via layerOut(); check the emitted form.
  for (const lay of [L.KIROT, L.PTACHIM, L.CHASHMAL, L.INSTALATSIA, L.RITZPA])
    if (!has('\n' + layerOut(lay) + '\n')) problems.push('missing semantic layer ' + lay);
  // R12 layer-name validity (the "won't open in AutoCAD" root cause): NO emitted LAYER
  // symbol name may contain a SPACE or any R12-illegal char. Check the whole taxonomy…
  const badNames = T.invalidLayerNames();
  if (badNames.length) problems.push('R12-invalid layer name(s): ' + badNames.join(', '));
  // …and the actual emitted LAYER table (group 2 of every LAYER record).
  for (const m of dxf.matchAll(/\n\s*0\nLAYER\n\s*2\n([^\n]*)\n/g))
    if (/[ <>/\\":;?*|,=`]/.test(m[1])) problems.push('space/illegal char in LAYER name ' + JSON.stringify(m[1]));

  const items = scene.items || [], swalls = scene.walls || [], openings = scene.openings || [];
  const isMode2d = opts.mode === '2d';
  const distinctFixture = new Set(items.map(resolveBlock));                       // 3D device blocks
  const distinctSym2d = new Set(items.map((it) => symBlock2DName(glyphKey(it)))); // 2D SYM symbol blocks
  const distinctOpenUnits = new Set(openings.map(openingBlock));

  // Entity parity. 3D: openings are 3DFACE; fixtures get a device glyph INSERT.
  // With element bodies ON (default), only RECOGNIZED devices get a glyph (the rest
  // are drawn as true-size boxes), so the 3D glyph count = strict-resolved items.
  // 2D: every fixture gets a SYM symbol INSERT + opening stretched-units + one legend
  // swatch per distinct symbol block.
  const elementBoxes = opts.elementBoxes !== false;
  const glyphItems3d = elementBoxes ? items.filter(resolveBlockStrict).length : items.length;
  const nInsert = count(/\n\s*0\nINSERT\n/g);
  const expectInserts = isMode2d
    ? items.length + openings.length + distinctSym2d.size
    : glyphItems3d;
  if (nInsert !== expectInserts)
    problems.push(`INSERT count ${nInsert} != expected ${expectInserts}`);
  const usedBlocks = new Set(isMode2d ? distinctSym2d : distinctFixture);
  if (isMode2d) for (const u of distinctOpenUnits) usedBlocks.add(u);
  // R12 has NO *Model_Space / *Paper_Space block definitions — one BLOCK per used block.
  const nBlockDef = count(/\n\s*0\nBLOCK\n/g);
  if (nBlockDef !== usedBlocks.size)
    problems.push(`BLOCK defs ${nBlockDef} != distinct used ${usedBlocks.size}`);

  // Every INSERT must reference a BLOCK that is actually defined in the BLOCKS
  // section (case-insensitive, like AutoCAD). This is the core reference
  // convention — a dangling INSERT would make the file fail to open cleanly.
  const definedBlocks = parseBlockDefNames(dxf);   // Set of lower-cased names
  const insertNames = parseInsertBlockNames(dxf);  // array of names (2-code)
  for (const nm of insertNames) {
    if (!definedBlocks.has(String(nm).toLowerCase()))
      problems.push(`INSERT -> undefined BLOCK "${nm}"`);
  }
  if (insertNames.length !== nInsert)
    problems.push(`INSERT name parse ${insertNames.length} != INSERT count ${nInsert}`);

  // SECTION/ENDSEC balance + BLOCK/ENDBLK balance.
  const nSection = count(/(?:^|\n)\s*0\nSECTION\n/g), nEndsec = count(/\n\s*0\nENDSEC\n/g);
  if (nSection !== nEndsec) problems.push(`SECTION ${nSection} != ENDSEC ${nEndsec}`);
  if (nSection !== 4) problems.push(`expected 4 SECTIONs (HEADER/TABLES/BLOCKS/ENTITIES), got ${nSection}`);
  // R12 (AC1009) contract — the AC1015 plot-style scaffolding that AutoCAD 2021
  // rejected must all be ABSENT (calibrated against the DR reference DXF).
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
  if (has('\nBLOCK_RECORD\n')) problems.push('BLOCK_RECORD table present (must be absent in R12)');
  const nEndblk = count(/\n\s*0\nENDBLK\n/g);
  if (nBlockDef !== nEndblk) problems.push(`BLOCK ${nBlockDef} != ENDBLK ${nEndblk}`);

  // Wall + opening 3DFACEs in the ENTITIES section carry the reference edge
  // flag (70=15). (Only the 3D exporter emits these; the 2D plan uses LINE, so
  // skip when there are no faces at all.)
  const nFace = count(/\n\s*0\n3DFACE\n/g);
  const entityFaces = (swalls.length * 6) + (openings.length * 6);
  const nEdge15 = count(/\n\s*70\n\s*15\n/g);
  if (nFace > 0 && entityFaces > 0 && nEdge15 < entityFaces)
    problems.push(`3DFACE edge-flag(70=15) ${nEdge15} < entity faces ${entityFaces}`);

  // Handles on every entity (group 5)
  const nEnt = count(/\n\s*0\n(3DFACE|INSERT|LINE|TEXT)\n/g);
  const nHandle = count(/\n\s*5\n/g);
  if (nHandle < nEnt) problems.push(`handles ${nHandle} < entities ${nEnt}`);
  // NO duplicate handles (every group-5 value unique across the whole file).
  const seenH = new Set(); let dupH = 0;
  for (const m of dxf.match(/\n\s*5\n([0-9A-Fa-f]+)\n/g) || []) {
    const v = m.trim().split('\n').pop().toUpperCase();
    if (seenH.has(v)) dupH++; else seenH.add(v);
  }
  if (dupH) problems.push(`duplicate handles: ${dupH}`);

  // Encoding: Hebrew is raw CP1255 single bytes (0x80..0xFF), matching the DR
  // reference; valid on disk when written 'latin1'. Only a char code > 255 is
  // un-encodable.
  let asciiOk = true;
  for (let i = 0; i < dxf.length; i++) if (dxf.charCodeAt(i) > 255) { asciiOk = false; break; }
  if (!asciiOk) problems.push('char code > 255 present (not cp1255-encodable)');

  // group-code pairing
  const toks = dxf.split('\n');
  const n = toks[toks.length - 1] === '' ? toks.length - 1 : toks.length;
  if (n % 2 !== 0) problems.push('odd token count (unpaired group code)');

  return {
    ok: problems.length === 0, problems,
    layers: nLayer, inserts: nInsert, blockDefs: nBlockDef,
    faces: count(/\n\s*0\n3DFACE\n/g), lines: count(/\n\s*0\nLINE\n/g),
    texts: count(/\n\s*0\nTEXT\n/g), asciiOk,
  };
}

module.exports = {
  exportDXF3DPro, exportDXF2DPro, sceneFromModel, normalizeScene, selfTest,
  resolveBlock, blockName, wallPrism, computeExtents, LAYERS, BLOCK_LAYER,
  heToDxfUnicode, openingFaces, isWindow, isDoor,
  jointExtendedWalls, roomFootprint, triangulatePolygon, floorSlabFaces,
};

// ---------------------------------------------------------------------------
// CLI + self-test:  node src/export_dxf_pro.js [file.ordx]
// ---------------------------------------------------------------------------
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const outDir = path.join(root, 'analysis', 'out');
  fs.mkdirSync(outDir, { recursive: true });

  // Prefer a real ORDX (round-tripped export) so the self-test runs on real data.
  let scene, source;
  const argFile = process.argv[2];
  const sample = argFile || firstExisting([
    path.join(outDir, '2918_Ktchn_TRIO_Nir_DR1_out.ordx'),
    path.join(outDir, '2725_Ktchn_TRIO_Nir_DR1_out.ordx'),
  ]);
  if (sample && fs.existsSync(sample)) {
    const { parseOrdxFile } = require('./parseOrdx');
    const model = parseOrdxFile(sample);
    scene = sceneFromModel(model);
    source = path.relative(root, sample);
  } else {
    // Synthetic fallback scene (a 4-wall room + a few fixtures).
    scene = syntheticScene();
    source = '(synthetic scene)';
  }

  const dxf3d = exportDXF3DPro(scene, { labels: false });
  const dxf2d = exportDXF2DPro(scene, { labels: true });
  const p3 = path.join(outDir, 'dxf_pro_3d.dxf');
  const p2 = path.join(outDir, 'dxf_pro_2d.dxf');
  fs.writeFileSync(p3, dxf3d, 'latin1');   // R12 + cp1255 Hebrew bytes -> 'latin1', never 'ascii'
  fs.writeFileSync(p2, dxf2d, 'latin1');

  const t3 = selfTest(dxf3d, scene, { mode: '3d' });
  const t2 = selfTest(dxf2d, scene, { mode: '2d' });

  console.log('Soline PROFESSIONAL DXF exporter — self-test');
  console.log('  source ..............', source);
  console.log('  walls / items / wins.', scene.walls.length, '/', scene.items.length, '/', (scene.openings || []).length);
  console.log('  --- 3D ---');
  console.log('  output ..............', path.relative(root, p3), `(${dxf3d.length} B)`);
  console.log('  layers / blocks .....', t3.layers, '/', t3.blockDefs);
  console.log('  3DFACE / INSERT .....', t3.faces, '/', t3.inserts);
  console.log('  pure 7-bit ASCII ....', t3.asciiOk ? 'OK' : 'FAIL');
  console.log('  self-test ...........', t3.ok ? 'PASS' : 'FAIL');
  t3.problems.forEach((p) => console.log('     - ' + p));
  console.log('  --- 2D ---');
  console.log('  output ..............', path.relative(root, p2), `(${dxf2d.length} B)`);
  console.log('  LINE / INSERT / TEXT ', t2.lines, '/', t2.inserts, '/', t2.texts);
  console.log('  self-test ...........', t2.ok ? 'PASS' : 'FAIL');
  t2.problems.forEach((p) => console.log('     - ' + p));

  if (!t3.ok || !t2.ok) { console.error('SELF-TEST FAILED'); process.exit(1); }
  console.log('  ALL CHECKS PASSED');
}

function firstExisting(list) { for (const p of list) if (fs.existsSync(p)) return p; return null; }

function syntheticScene() {
  return {
    walls: [
      { x1: 0, y1: 0, x2: 4000, y2: 0, thick: 100, height: 2700, exterior: true },
      { x1: 4000, y1: 0, x2: 4000, y2: 3000, thick: 100, height: 2700, exterior: true },
      { x1: 4000, y1: 3000, x2: 0, y2: 3000, thick: 100, height: 2700, exterior: false },
      { x1: 0, y1: 3000, x2: 0, y2: 0, thick: 100, height: 2700, exterior: false },
    ],
    items: [
      { name: 'Socket', category: 'חשמל — שקעים', x: 800, y: 50, z: 350, rotation_deg: 0, width: 80, depth: 15, height: 80 },
      { name: 'Duplex Socket', category: 'חשמל — שקעים', x: 1600, y: 50, z: 350, rotation_deg: 0, width: 160, depth: 15, height: 80 },
      { name: 'Switch', category: 'חשמל — מפסקים', x: 3900, y: 1000, z: 1200, rotation_deg: 90, width: 80, depth: 15, height: 80 },
      { name: 'Faucet', category: 'אינסטלציה — מים', x: 2000, y: 2950, z: 1000, rotation_deg: 180, width: 50, depth: 25, height: 40 },
      { name: 'Gas', category: 'גז', x: 2500, y: 2950, z: 600, rotation_deg: 180, width: 60, depth: 30, height: 60 },
    ],
    openings: [
      { layer: 'Const_Windows', name: 'Window', x: 2000, y: 0, z: 900, rotation_deg: 0, width: 1200, height: 1200, depth: 100 },
    ],
  };
}
