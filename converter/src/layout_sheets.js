'use strict';
/*
 * Soline — PRINT LAYOUT SHEET GENERATOR  (src/layout_sheets.js)
 * =============================================================================
 * Turns the decluttered 2D content (the plan, or ONE wall elevation) into a set of
 * PRINT-READY sheet DXF files — one file per (content × paper-size × orientation) —
 * each authored at TRUE PAPER dimensions (A0 841×1189 … A4 210×297 mm) with the
 * drawing scaled to fill the sheet and a paper-size-appropriate title block.
 *
 * WHY ONE FILE PER SHEET (not named layouts): DXF R12 (AC1009) — the version the
 * owner's AutoCAD 2021 reliably opens — has exactly ONE paper space and no LAYOUT
 * dictionary, so multiple named print layouts are not R12-safe. Instead every sheet
 * is its OWN clean R12 file (e.g. `allelem_W1_A3_landscape.dxf`) that opens on its
 * own and plots 1:1 (1 DXF unit = 1 mm on paper) to the real paper size.
 *
 * UNITS. A sheet file is authored in PAPER MILLIMETRES: the border is the real paper
 * rectangle, so plotting the file 1:1 yields the physical A-size. The drawing content
 * (authored in real-world mm) is inserted scaled by f = 1/scaleDenom, so a 4000 mm
 * wall becomes 4000/50 = 80 paper-mm at 1:50. The chosen scale denominator is the
 * architectural scale printed on the title block (1:20 / 1:50 / 1:100 …).
 *
 * The heavy lifting is a small, EXACT DXF-entity transform (scale about origin +
 * translate) that only rewrites the coordinate/length group codes our primitive set
 * emits (LINE/TEXT/ARC/SOLID/INSERT) — see transformEntities(). It is reused by
 * export_dxf2d.js to translate whole content BLOCKS into non-overlapping regions in
 * the main model-space drawing, and here to scale content onto paper.
 *
 * R12 CONTRACT is preserved end-to-end: AC1009, $DWGCODEPAGE ansi_1255, Hebrew as
 * raw CP1255 bytes (write 'latin1'), space-free ASCII layer symbol names, SOLINE.ctb
 * colour→pen mapping. Every emitted sheet is run through export_dxf2d.selfTest().
 */

const T = require('./dxf_soline');
const { g, num, layerOut, L, heToCp1255, STYLE_NAME } = T;

// ---------------------------------------------------------------------------
// EXACT DXF entity transform.  scale about origin (sx,sy), then translate (dx,dy).
// Operates on a run of ENTITIES (the string a primitive/draw function returns), NOT
// on a whole file. Only the group codes our primitives emit are rewritten:
//   X: 10-18 · Y: 20-28 · Z: 30-38 (scaled, dz=0) · lengths 40 (text h / arc r) and
//   41,42 (INSERT x/y scale factors) scaled by |sx|. Angles (50,51), handles (5),
//   layer (8), text (1), block name (2), style (7), colour (62), flags (70-73) pass
//   through untouched. This is exact for LINE/TEXT/ARC/SOLID/INSERT (our entity set).
// ---------------------------------------------------------------------------
const X_CODES = new Set([10, 11, 12, 13, 14, 15, 16, 17, 18]);
const Y_CODES = new Set([20, 21, 22, 23, 24, 25, 26, 27, 28]);
const Z_CODES = new Set([30, 31, 32, 33, 34, 35, 36, 37, 38]);
const LEN_CODES = new Set([40, 41, 42]);   // text height / arc radius / INSERT scale x,y

function transformEntities(s, sx, sy, dx, dy) {
  if (!s) return '';
  const lines = String(s).split('\n');
  const out = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i], 10);
    let val = lines[i + 1];
    if (X_CODES.has(code)) val = num(sx * parseFloat(val) + dx);
    else if (Y_CODES.has(code)) val = num(sy * parseFloat(val) + dy);
    else if (Z_CODES.has(code)) val = num(sx * parseFloat(val));
    else if (LEN_CODES.has(code)) val = num(Math.abs(sx) * parseFloat(val));
    out.push(lines[i], val);
  }
  return out.join('\n') + '\n';
}

// Translate only (uniform scale 1). Convenience for region composition.
function translateEntities(s, dx, dy) { return transformEntities(s, 1, 1, dx, dy); }

// ---------------------------------------------------------------------------
// Bounding box of a run of entities — min/max over every X/Y coordinate code.
// Returns { minX,minY,maxX,maxY,w,h,empty }.
// ---------------------------------------------------------------------------
function bboxOf(s) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  if (s) {
    const lines = String(s).split('\n');
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const code = parseInt(lines[i], 10);
      if (X_CODES.has(code)) { const v = parseFloat(lines[i + 1]); if (v < minX) minX = v; if (v > maxX) maxX = v; }
      else if (Y_CODES.has(code)) { const v = parseFloat(lines[i + 1]); if (v < minY) minY = v; if (v > maxY) maxY = v; }
    }
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0, empty: true };
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, empty: false };
}

// ---------------------------------------------------------------------------
// PAPER SIZES (ISO 216, mm, PORTRAIT w×h). Landscape swaps w/h.
// ---------------------------------------------------------------------------
const PAPER = {
  A0: { w: 841, h: 1189 },
  A1: { w: 594, h: 841 },
  A2: { w: 420, h: 594 },
  A3: { w: 297, h: 420 },
  A4: { w: 210, h: 297 },
};
const PAPER_SIZES = ['A0', 'A1', 'A2', 'A3', 'A4'];
const ORIENTATIONS = ['landscape', 'portrait'];

function paperDims(size, orientation) {
  const p = PAPER[size];
  if (!p) throw new Error('unknown paper size ' + size);
  return orientation === 'landscape' ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}

// Title-strip height (paper-mm) + base text height (paper-mm) scale with the sheet so
// the block is legible at A0 yet not oversized at A4.
function sheetMetrics(size) {
  const M = {
    A0: { margin: 20, title: 60, base: 5.0, gap: 15 },
    A1: { margin: 15, title: 48, base: 4.0, gap: 12 },
    A2: { margin: 12, title: 40, base: 3.2, gap: 10 },
    A3: { margin: 10, title: 34, base: 2.8, gap: 8 },
    A4: { margin: 8, title: 28, base: 2.5, gap: 6 },
  };
  return M[size] || M.A3;
}

// ---------------------------------------------------------------------------
// SCALE FITTING.  Given the content extent (drawing-mm) and the drawable area on the
// paper (paper-mm), the required scale DENOMINATOR is
//     D_req = max( contentW / drawableW , contentH / drawableH )
// (1 paper-mm shows D drawing-mm, so content fits when D ≥ each ratio). We then SNAP
// UP to the nearest standard architectural scale so the printed ratio is a round
// number the client recognises (1:20 / 1:50 / 1:100 …) and the content still fits
// with the margin. Returns { scaleDenom, f, reqDenom }.  f = 1/scaleDenom.
// ---------------------------------------------------------------------------
const NICE_SCALES = [1, 2, 5, 10, 15, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500, 750, 1000, 1500, 2000];

function fitScale(content, drawable) {
  const cw = Math.max(1, content.w), ch = Math.max(1, content.h);
  const reqDenom = Math.max(cw / Math.max(1, drawable.w), ch / Math.max(1, drawable.h));
  let scaleDenom = NICE_SCALES.find((d) => d >= reqDenom);
  if (scaleDenom == null) scaleDenom = Math.ceil(reqDenom / 1000) * 1000;   // beyond the table
  return { scaleDenom, f: 1 / scaleDenom, reqDenom };
}

// ---------------------------------------------------------------------------
// Minimal sheet-furniture primitives (paper-mm frame). Self-contained so the sheet
// generator does not depend on export_dxf2d's private helpers.
// ---------------------------------------------------------------------------
function sLine(h, layer, x1, y1, x2, y2) {
  return g(0, 'LINE') + g(5, h()) + g(8, layerOut(layer)) +
    g(10, num(x1)) + g(20, num(y1)) + g(30, num(0)) +
    g(11, num(x2)) + g(21, num(y2)) + g(31, num(0));
}
function sRect(h, layer, x, y, w, ht) {
  const p = [[x, y], [x + w, y], [x + w, y + ht], [x, y + ht], [x, y]];
  let s = '';
  for (let i = 0; i + 1 < p.length; i++) s += sLine(h, layer, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]);
  return s;
}
function sText(h, layer, str, x, y, height, hAlign, vAlign) {
  let s = g(0, 'TEXT') + g(5, h()) + g(8, layerOut(layer)) +
    g(10, num(x)) + g(20, num(y)) + g(30, num(0)) + g(40, num(height)) +
    g(1, heToCp1255(str)) + g(50, num(0)) + g(7, STYLE_NAME);
  if (hAlign) s += g(72, hAlign);
  if (vAlign) s += g(73, vAlign);
  if (hAlign || vAlign) s += g(11, num(x)) + g(21, num(y)) + g(31, num(0));
  return s;
}
function ascii(v) { return String(v == null ? '' : v).replace(/[^\x00-\x7F]+/g, '').trim() || '-'; }

// ---------------------------------------------------------------------------
// TITLE BLOCK for a sheet — a strip along the bottom, sized in paper-mm. Left cell
// = SOLINE wordmark + drawing name; right cells = the professional field set
// (project / scale / paper / date / drawing-no / sheet). ASCII labels (the drawing
// area carries the Hebrew; the sheet frame stays language-neutral like the model).
// ---------------------------------------------------------------------------
function drawSheetTitleBlock(h, sheet, title, contentLabel, scaleLabel) {
  const { margin, title: titleH, base } = sheetMetrics(sheet.size);
  const w = sheet.w - 2 * margin;
  const x0 = margin, y0 = margin;                 // strip sits just above the bottom margin
  let s = sRect(h, L.BORDER, x0, y0, w, titleH);
  // logo cell (left)
  const logoW = Math.min(w * 0.28, titleH * 3.2);
  s += sLine(h, L.MISGERET, x0 + logoW, y0, x0 + logoW, y0 + titleH);
  s += sText(h, L.MISGERET, 'SOLINE', x0 + logoW * 0.5, y0 + titleH * 0.62, base * 1.9, 1, 2);
  s += sText(h, L.TEKST, ascii(contentLabel), x0 + logoW * 0.5, y0 + titleH * 0.26, base * 0.9, 1, 2);
  // field grid (right of logo) — two rows × three columns
  const gx = x0 + logoW, gw = w - logoW;
  const t = title || {};
  const cells = [
    ['PROJECT', ascii(t.project)], ['SCALE', scaleLabel], ['PAPER', sheet.size + ' ' + sheet.orientation],
    ['DATE', ascii(t.date)], ['DRAWING No', ascii(t.drawingNo || 'M-01')], ['SHEET', ascii(t.sheet || contentLabel)],
  ];
  const cols = 3, rows = 2, cw = gw / cols, rh = titleH / rows;
  for (let c = 1; c < cols; c++) s += sLine(h, L.MISGERET, gx + c * cw, y0, gx + c * cw, y0 + titleH);
  s += sLine(h, L.MISGERET, gx, y0 + rh, gx + gw, y0 + rh);
  cells.forEach(([k, v], i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const cx = gx + c * cw + base * 0.8;
    const cyTop = y0 + titleH - r * rh;
    s += sText(h, L.TEKST, k, cx, cyTop - rh * 0.30, base * 0.72, 0, 2);
    s += sText(h, L.MISGERET, String(v), cx, cyTop - rh * 0.74, base * 1.05, 0, 2);
  });
  return { dxf: s, height: titleH };
}

// ---------------------------------------------------------------------------
// buildSheet — compose ONE print sheet from prepared content.
//   content = { ents, bbox, symBlocks, extraLayers, h }  (from export_dxf2d.buildContent)
//   opts    = { size, orientation, scaleDenom?, title, contentLabel }
// If scaleDenom is omitted it is auto-fitted. Returns { dxf, scaleDenom, sheet, name }.
// Needs export_dxf2d.assembleDXF for the header/tables/blocks wrapper — required
// LAZILY to avoid a load-time cycle (export_dxf2d requires this module at top).
// ---------------------------------------------------------------------------
function buildSheet(content, opts) {
  opts = opts || {};
  const size = opts.size || 'A3';
  const orientation = opts.orientation === 'portrait' ? 'portrait' : 'landscape';
  const dims = paperDims(size, orientation);
  const sheet = { size, orientation, w: dims.w, h: dims.h };
  const { margin, title: titleH, gap } = sheetMetrics(size);
  const h = content.h;                              // continue the content's handle gen (unique handles)

  // drawable area = paper minus margins, minus the title strip at the bottom.
  const drawable = {
    w: sheet.w - 2 * margin,
    h: sheet.h - 2 * margin - titleH - gap,
    x0: margin,
    y0: margin + titleH + gap,
  };
  const cb = content.bbox;
  const fit = opts.scaleDenom
    ? { scaleDenom: opts.scaleDenom, f: 1 / opts.scaleDenom }
    : fitScale(cb, drawable);
  const f = fit.f;
  const scaleLabel = '1:' + fit.scaleDenom;

  // centre the scaled content inside the drawable area.
  const scaledW = cb.w * f, scaledH = cb.h * f;
  const dx = drawable.x0 + (drawable.w - scaledW) / 2 - cb.minX * f;
  const dy = drawable.y0 + (drawable.h - scaledH) / 2 - cb.minY * f;
  const placed = transformEntities(content.ents, f, f, dx, dy);

  // sheet furniture: outer border (paper edge), inner border (drawable frame), title.
  let ents = '';
  ents += sRect(h, L.BORDER, 0, 0, sheet.w, sheet.h);
  ents += sRect(h, L.MISGERET, margin, margin, sheet.w - 2 * margin, sheet.h - 2 * margin);
  const tb = drawSheetTitleBlock(h, sheet, opts.title, opts.contentLabel || 'DRAWING', scaleLabel);
  ents += tb.dxf;
  ents += placed;

  const ext = { minX: -5, minY: -5, maxX: sheet.w + 5, maxY: sheet.h + 5 };
  const assembleDXF = require('./export_dxf2d').assembleDXF;
  const dxf = assembleDXF({ ents, symBlocks: content.symBlocks, extraLayers: content.extraLayers, ext, h });
  return { dxf, scaleDenom: fit.scaleDenom, scaleLabel, sheet, drawable, f };
}

// ---------------------------------------------------------------------------
// SOLINE AutoCAD SETUP SCRIPT (SOLINE_setup.scr)
// ---------------------------------------------------------------------------
// A plain-text script the owner runs ONCE via AutoCAD's SCRIPT command. It recreates,
// inside his own drawing, the EXACT Soline template his DXF exports use, so a dimension
// he draws BY HAND looks identical to ours:
//   * text style  SOLINE  -> arial.ttf (Hebrew-capable, system font)
//   * every Soline layer   -> same name / ACI colour / linetype as the DXF LAYER table
//   * dimension style SOLINE -> our dim appearance for 1:50: filled arrows, 2.5 mm text,
//       extension/offset, DIMSCALE 50, and (crucially) DIMLFAC 0.1 so a wall measured
//       in mm PRINTS IN CM like our dims (4000 mm -> "400"), with NO wall-thickness
//       inflation — the owner's "real measured, not outer sum" rule applies to his
//       manual dims too because a plain LINEAR dim measures the clear distance he picks.
// `lang` = 'he' (default, names match the Hebrew DXF byte-for-byte, cp1255) or 'en'
// (ASCII underscore names — use if the .scr's Hebrew shows garbled on a non-Hebrew
// Windows locale). Returned string is latin1/cp1255 — WRITE IT 'latin1'.
function buildSetupScr(lang) {
  const useEn = lang === 'en';
  const nameOf = (n) => T.heToCp1255(useEn ? (T.EN_LAYER[n] || n) : (T.HE_LAYER[n] || n));
  const NL = '\r\n';                                  // AutoCAD scripts: CR/LF line = <enter>
  let s = '';
  s += '; ============================================================' + NL;
  s += '; SOLINE AutoCAD setup — run once via  SCRIPT  (Soline template)' + NL;
  s += '; text style + layers + SOLINE dimension style (1:50, cm, mm units)' + NL;
  s += '; ============================================================' + NL;
  // drawing units: metric, mm, decimal, LTSCALE matching the DXF ($LTSCALE 10)
  s += 'MEASUREMENT' + NL + '1' + NL;
  s += 'INSUNITS' + NL + '4' + NL;                    // 4 = millimetres
  s += 'LUNITS' + NL + '2' + NL + 'LUPREC' + NL + '1' + NL;
  s += 'LTSCALE' + NL + '10' + NL;
  // load the two non-continuous linetypes our layers use
  s += '-LINETYPE' + NL + 'L' + NL + 'HIDDEN' + NL + 'acad.lin' + NL + NL;
  s += '-LINETYPE' + NL + 'L' + NL + 'CENTER' + NL + 'acad.lin' + NL + NL;
  // text style SOLINE -> arial.ttf, height 0 (per-text height), width 1, upright
  s += '-STYLE' + NL + 'SOLINE' + NL + 'arial.ttf' + NL + '0' + NL + '1' + NL + '0' + NL + 'N' + NL + 'N' + NL;
  // every Soline layer (name / colour / linetype) — one -LAYER session
  s += '-LAYER' + NL;
  for (const [name, color, ltype] of T.LAYERS) {
    const nm = nameOf(name);
    s += 'M' + NL + nm + NL;                          // make (also creates) the layer
    s += 'C' + NL + String(color) + NL + nm + NL;     // set its colour
    if (ltype && ltype !== 'CONTINUOUS') s += 'L' + NL + ltype + NL + nm + NL;
  }
  s += NL;                                            // exit -LAYER
  // ---- SOLINE dimension style (matches the DXF manual-dim appearance @ 1:50) ----
  const V = [
    ['DIMSCALE', '50'],      // overall annotation scale for 1:50 plotting
    ['DIMTXT', '2.5'],       // text height (paper mm)
    ['DIMASZ', '2.5'],       // arrow size (filled closed arrow = our SOLID arrowhead)
    ['DIMEXE', '1.25'],      // extension line beyond dim line
    ['DIMEXO', '0.9'],       // extension line offset from origin
    ['DIMGAP', '0.9'],       // gap around the dim text
    ['DIMLFAC', '0.1'],      // linear factor mm->cm  (4000 mm shows "400")
    ['DIMDEC', '1'],         // one decimal, like our cm()
    ['DIMZIN', '8'],         // suppress trailing zeros (400.0 -> 400)
    ['DIMTAD', '1'],         // text ABOVE the dim line (our style)
    ['DIMTIH', '0'], ['DIMTOH', '0'],   // text aligned WITH the dim line
    ['DIMSE1', '0'], ['DIMSE2', '0'],   // both extension lines on
    ['DIMCLRD', '256'], ['DIMCLRE', '256'], ['DIMCLRT', '256'],   // ByLayer colours
    ['DIMTXSTY', 'SOLINE'],  // use the Soline arial style
  ];
  for (const [k, v] of V) s += k + NL + v + NL;
  s += '-DIMSTYLE' + NL + 'S' + NL + 'SOLINE' + NL + 'Y' + NL;   // save current vars as style SOLINE
  // draw on the measured (clear) dimensions layer by default
  s += 'CLAYER' + NL + nameOf('SOL-MIDOT-PNIM') + NL;
  s += '; done — SOLINE text/dim styles + layers ready. Plot with SOLINE.ctb.' + NL;
  return s;
}

module.exports = {
  transformEntities, translateEntities, bboxOf,
  PAPER, PAPER_SIZES, ORIENTATIONS, paperDims, sheetMetrics,
  NICE_SCALES, fitScale, buildSheet, drawSheetTitleBlock, buildSetupScr,
};

// ---------------------------------------------------------------------------
// CLI — regenerate the decluttered main drawing + a representative sheet set.
//   node src/layout_sheets.js            (default: allelem room -> _LATEST/)
//   node src/layout_sheets.js <file.ordx> [outDir]
// Set SOLINE_SHEETS_FULL=1 to emit the FULL matrix (plan + every elevation × every
// paper size × both orientations) instead of the representative example set.
// ---------------------------------------------------------------------------
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');
  const EX = require('./export_dxf2d');

  const argFile = process.argv[2];
  const outDir = process.argv[3] || path.join(ROOT, '_LATEST');
  const sheetsDir = path.join(outDir, 'sheets');
  fs.mkdirSync(sheetsDir, { recursive: true });

  // ---- load the scene (allelem room by default) ----
  let scene, source, name;
  const defOrdx = path.join(ROOT, 'analysis', 'out', 'allelem', 'allelem.ordx');
  const src = argFile && fs.existsSync(argFile) ? argFile : defOrdx;
  const { parseOrdxFile } = require('./parseOrdx');
  scene = parseOrdxFile(src);
  source = path.relative(ROOT, src);
  name = 'allelem';
  const title = { project: name, date: new Date().toISOString().slice(0, 10), scale: '1:50', drawingNo: 'M-01' };

  // ---- 1. DECLUTTERED MAIN model-space drawing -> _LATEST/allelem_v14_2d.dxf ----
  const mainDxf = EX.exportDXF2D(scene, { labels: true, title, sheet: true });
  const mainPath = path.join(outDir, 'allelem_v14_2d.dxf');
  fs.writeFileSync(mainPath, mainDxf, 'latin1');
  const mt = EX.selfTest(mainDxf, EX.normalizeScene(scene, {}));
  console.log('MAIN  allelem_v14_2d.dxf  ', mt.ok ? 'selfTest PASS' : 'selfTest FAIL', '(' + mainDxf.length + ' B)');
  if (!mt.ok) mt.problems.forEach((p) => console.log('   - ' + p));

  // ---- 1b. AutoCAD SETUP SCRIPT -> _LATEST/SOLINE_setup.scr (owner's manual-dim template) ----
  const scr = buildSetupScr(process.env.SOLINE_SCR_LANG === 'en' ? 'en' : 'he');
  fs.writeFileSync(path.join(outDir, 'SOLINE_setup.scr'), scr, 'latin1');
  console.log('SETUP SOLINE_setup.scr        ', scr.split('\n').length, 'lines  (' + scr.length + ' B)');

  // ---- 2. PRINT SHEETS ----
  const norm = EX.normalizeScene(scene, {});
  const nWalls = (norm.walls || []).filter((w) => w.x1 != null).length;
  const contents = [{ kind: 'plan', label: 'PLAN' }];
  for (let i = 0; i < nWalls; i++) contents.push({ kind: 'elevation', index: i, label: 'W' + (i + 1) });

  const FULL = process.env.SOLINE_SHEETS_FULL === '1';
  // representative example set (task deliverable): plan @ A2/A3 both orientations,
  // and W1 @ A3/A4 both orientations. FULL = every content × every size × both.
  const plan = ['plan'];
  const jobs = FULL
    ? contents.flatMap((c) => EX_SIZES().flatMap((sz) => ORIENTATIONS.map((o) => ({ c, sz, o }))))
    : [
      { c: contents[0], sz: 'A2', o: 'landscape' }, { c: contents[0], sz: 'A2', o: 'portrait' },
      { c: contents[0], sz: 'A3', o: 'landscape' }, { c: contents[0], sz: 'A3', o: 'portrait' },
      { c: contents[1], sz: 'A3', o: 'landscape' }, { c: contents[1], sz: 'A3', o: 'portrait' },
      { c: contents[1], sz: 'A4', o: 'landscape' }, { c: contents[1], sz: 'A4', o: 'portrait' },
    ];
  function EX_SIZES() { return PAPER_SIZES; }

  let ok = 0, fail = 0;
  for (const { c, sz, o } of jobs) {
    const content = EX.buildContent(scene, { labels: true, title }, c);
    const sheetTitle = Object.assign({}, title, { sheet: c.label });
    const r = buildSheet(content, { size: sz, orientation: o, title: sheetTitle, contentLabel: c.label });
    const fn = `${name}_${c.label}_${sz}_${o}.dxf`;
    fs.writeFileSync(path.join(sheetsDir, fn), r.dxf, 'latin1');
    const st = EX.selfTest(r.dxf, null);
    if (st.ok) ok++; else { fail++; }
    console.log(`  ${st.ok ? 'OK ' : 'BAD'}  ${fn.padEnd(34)} ${r.scaleLabel.padStart(7)}  (${r.dxf.length} B)`);
    if (!st.ok) st.problems.forEach((p) => console.log('        - ' + p));
  }
  console.log(`\nSHEETS: ${ok} ok, ${fail} bad  ->  ${path.relative(ROOT, sheetsDir)}`);
  if (fail || !mt.ok) process.exit(1);
}
