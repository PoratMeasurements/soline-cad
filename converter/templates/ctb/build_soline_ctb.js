#!/usr/bin/env node
/*
 * build_soline_ctb.js — generate genuinely valid AutoCAD Color-Dependent Plot
 * Style Tables (.ctb) in pure Node (built-in zlib), then SELF-VALIDATE by
 * decompressing + re-parsing the output.
 *
 * Binary format (ezdxf-verified, src/ezdxf/addons/acadctb.py):
 *   bytes 0..47   ASCII "PIAFILEVERSION_2.0,CTBVER1,compress\r\npmzlibcodec" (48 B)
 *   bytes 48..51  uint32 LE  adler32(compressedBody)
 *   bytes 52..55  uint32 LE  length of uncompressed body (incl. trailing NUL)
 *   bytes 56..59  uint32 LE  length of compressedBody
 *   bytes 60..    compressedBody  = zlib.deflate(bodyText + "\x00")
 * ezdxf's reader does exactly: zlib.decompress(content[60:]) — so offset 60
 * (48 header + 12 meta) is the load-bearing invariant.
 *
 * Body text (LF line endings), block order fixed by ezdxf write_content():
 *   header  -> aci_table{} -> plot_style{} -> custom_lineweight_table{}
 * Note the CTB quirk: string values are written as  key="value\n  (the opening
 * double-quote is a TYPE MARKER; there is no closing quote — the value ends at
 * the newline).
 */
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const OUT_DIR = __dirname;

/* ----- ezdxf constants (acadctb.py) ----- */
const OBJECT_COLOR = -1;
const COLOR_RGB = 0xC2;        // true-color RGB color-type byte
const OBJECT_LINETYPE = 31;
const FILL_STYLE_OBJECT = 73;
const END_STYLE_OBJECT = 4;
const JOIN_STYLE_OBJECT = 5;

/* Standard AutoCAD fixed lineweight list — ezdxf DEFAULT_LINE_WEIGHTS.
 * lineweights[0] = 0.00 mm = "use object lineweight" sentinel. */
const LINEWEIGHTS = [
  0.00, 0.05, 0.09, 0.10, 0.13, 0.15, 0.18, 0.20, 0.25, 0.30,
  0.35, 0.40, 0.45, 0.50, 0.53, 0.60, 0.65, 0.70, 0.80, 0.90,
  1.00, 1.06, 1.20, 1.40, 1.58, 2.00, 2.11,
];
function lwIndex(mm) {
  const i = LINEWEIGHTS.findIndex(w => Math.abs(w - mm) < 1e-9);
  if (i < 0) throw new Error('lineweight not in standard table: ' + mm);
  return i;
}
const IDX = {
  OBJECT: 0,
  W013: lwIndex(0.13), W018: lwIndex(0.18), W025: lwIndex(0.25),
  W035: lwIndex(0.35), W050: lwIndex(0.50), W070: lwIndex(0.70),
};

/* Full-coverage default pen for every ACI that is NOT explicitly pinned below.
 * 0.25 mm is the ISO-128 medium ("object") pen and the universal drafting
 * default. A genuine office pen table defines a pen for ALL 255 colors so any
 * drawing — including consultant xrefs, imported blocks, or legacy DXFs with no
 * embedded group-370 width — plots at a predictable weight. Because Soline pins
 * every color its own drawings use, this default only ever affects foreign
 * content, where a deterministic medium pen is the professional behaviour.
 * (Sources: BIMuk / Tri-Service full-255 CTB practice; Land F/X standard CTB.) */
const DEFAULT_PEN = IDX.W025;

/* ----- Soline ACI -> pen (ISO-128-23 + Israeli architect convention) -----
 * The discipline pins below are AUTHORITATIVE (SOL-* layer -> ACI -> ISO weight,
 * per docs/DXF_PRO_STANDARDS.md). Every other ACI resolves to DEFAULT_PEN, so
 * the table gives full 1-255 coverage — no color falls back to "object
 * lineweight". */
const ACI_PEN = {
  1:   IDX.W013, // red      - outer / overall dims (SOL-MIDOT-CHUTS)
  2:   IDX.W025, // yellow   - gas (SOL-GAZ)
  3:   IDX.W013, // green    - inner / clear dims (SOL-MIDOT-PNIM)
  4:   IDX.W025, // cyan     - plumbing (SOL-INSTALATSIA)
  5:   IDX.W025, // blue     - openings: doors/windows (SOL-PTACHIM)
  6:   IDX.W025, // magenta  - electrical (SOL-CHASHMAL)
  7:   IDX.W050, // white/blk- walls, cut outline (SOL-KIROT)  [heaviest object]
  8:   IDX.W013, // dk-grey  - wall pochE / hatch fill (SOL-KIROT-MILUY) [screened]
  9:   IDX.W035, // grey     - structure / columns (SOL-MIVNE)
  30:  IDX.W025, // orange   - lighting (SOL-TEURA)
  42:  IDX.W025, // tan      - furniture / cabinetry (SOL-RIHUT)
  141: IDX.W025, // blue-grey- HVAC / ventilation (SOL-MIZUG)
  150: IDX.W018, // turquoise- text / notes / labels (SOL-TEKST)
  250: IDX.W018, // grey     - title-block fine rules (SOL-MISGERET)
  251: IDX.W013, // grey     - floor slab / tiling (SOL-RITZPA)
  252: IDX.W013, // grey ramp- light construction / setting-out lines [screened]
  253: IDX.W013, // grey ramp- screened background / underlay        [screened]
  254: IDX.W013, // grey ramp- faint xref / trace underlay           [screened]
  255: IDX.W070, // white/blk- section-cut lines / sheet border (heaviest)
};

/* ----- ACI -> screening % (halftone) -----
 * Screening is independent of plot color: screen=50 with color=black yields a
 * 50% grey halftone on paper. Poche and the light end of the 250-255 grey ramp
 * are the designated "tone / reference" band, screened so they read as shading
 * and never compete with real linework. Everything else prints at full 100%.
 * (Sources: Land F/X CTB — screened poche fills 40%; BIMuk — grey pens 250-255
 * screened 50%; Ching, Architectural Graphics — poche as grey tone.) */
const ACI_SCREEN = {
  8:   50,  // wall poche / hatch fill -> mid-grey tone
  252: 50,  // light construction lines
  253: 40,  // screened background
  254: 25,  // faint underlay
};
function screenFor(aci) {
  return Object.prototype.hasOwnProperty.call(ACI_SCREEN, aci) ? ACI_SCREEN[aci] : 100;
}
function penFor(aci) {
  return Object.prototype.hasOwnProperty.call(ACI_PEN, aci) ? ACI_PEN[aci] : DEFAULT_PEN;
}

/* ----- color encoding (ezdxf color2int / mode_color2int) ----- */
function color2int(r, g, b, ct) {
  // -((ct<<24)+(r<<16)+(g<<8)+b) & 0xFFFFFFFF  (use *2^24 to avoid 32-bit sign)
  const inner = ct * 0x1000000 + r * 0x10000 + g * 0x100 + b;
  return ((-inner) >>> 0);            // unsigned 32-bit, matches Python & 0xFFFFFFFF
}
function modeColor2int(r, g, b, ct) {
  // ezdxf: return -color2int(...)  (NOT masked -> negative signed decimal)
  return -color2int(r, g, b, ct);
}
const BLACK = modeColor2int(0, 0, 0, COLOR_RGB); // == -1040187392, _color = _mode_color

/* ----- one plot-style text block (matches PlotStyle.write) ----- */
function styleBlock(index, color, modeColor, colorPolicy, lineweight, screen) {
  let s = '';
  s += ` ${index}{\n`;
  s += `  name="Color_${index + 1}\n`;
  s += `  localized_name="Color_${index + 1}\n`;
  s += `  description="\n`;
  s += `  color=${color}\n`;
  if (color !== OBJECT_COLOR) s += `  mode_color=${modeColor}\n`;
  s += `  color_policy=${colorPolicy}\n`;
  s += `  physical_pen_number=0\n`;
  s += `  virtual_pen_number=0\n`;
  s += `  screen=${screen}\n`;
  s += `  linepattern_size=0.5\n`;
  s += `  linetype=${OBJECT_LINETYPE}\n`;
  s += `  adaptive_linetype=TRUE\n`;
  s += `  lineweight=${lineweight}\n`;
  s += `  fill_style=${FILL_STYLE_OBJECT}\n`;
  s += `  end_style=${END_STYLE_OBJECT}\n`;
  s += `  join_style=${JOIN_STYLE_OBJECT}\n`;
  s += ` }\n`;
  return s;
}

/* ----- full body (matches ColorDependentPlotStyles.write_content) ----- */
function buildBody(description, blackWorkSet) {
  let s = '';
  // header
  s += `description="${description}\n`;
  s += `aci_table_available=TRUE\n`;
  s += `scale_factor=1.0\n`;
  s += `apply_factor=FALSE\n`;
  s += `custom_lineweight_display_units=0\n`;
  // aci_table (255 entries, index 0..254 == ACI 1..255)
  s += `aci_table{\n`;
  for (let i = 0; i < 255; i++) s += ` ${i}="Color_${i + 1}\n`;
  s += `}\n`;
  // plot_style
  s += `plot_style{\n`;
  for (let i = 0; i < 255; i++) {
    const aci = i + 1;
    const lw = penFor(aci);        // full 1-255 coverage (pinned or DEFAULT_PEN)
    const scr = screenFor(aci);    // 100% except poche + light grey ramp
    if (blackWorkSet) {
      // every color prints solid black, dithering OFF (crisp lines)
      s += styleBlock(i, BLACK, BLACK, 0, lw, scr);
    } else {
      // color-presentation: keep object color, dithering OFF, pens by color
      s += styleBlock(i, OBJECT_COLOR, OBJECT_COLOR, 0, lw, scr);
    }
  }
  s += `}\n`;
  // custom_lineweight_table
  s += `custom_lineweight_table{\n`;
  LINEWEIGHTS.forEach((w, idx) => { s += ` ${idx}=${w.toFixed(2)}\n`; });
  s += `}\n`;
  return s;
}

/* ----- adler32 of a Buffer (zlib.adler32 equivalent) ----- */
function adler32(buf) {
  let a = 1, b = 0;
  const MOD = 65521;
  // chunk to keep a,b within safe integer range
  let i = 0;
  while (i < buf.length) {
    let n = Math.min(buf.length - i, 3800);
    while (n-- > 0) { a += buf[i++]; b += a; }
    a %= MOD; b %= MOD;
  }
  return (((b << 16) | a) >>> 0);
}

const MAGIC = 'PIAFILEVERSION_2.0,CTBVER1,compress\r\npmzlibcodec';

/* ----- write a .ctb file ----- */
function writeCtb(filePath, body) {
  const content = body + '\x00';                 // ezdxf appends chr(0)
  const contentBuf = Buffer.from(content, 'latin1');
  const comp = zlib.deflateSync(contentBuf);     // zlib stream (Python zlib.compress)
  const header = Buffer.from(MAGIC, 'latin1');
  if (header.length !== 48) throw new Error('header length != 48: ' + header.length);
  const meta = Buffer.alloc(12);
  meta.writeUInt32LE(adler32(comp), 0);
  meta.writeUInt32LE(contentBuf.length, 4);
  meta.writeUInt32LE(comp.length, 8);
  const out = Buffer.concat([header, meta, comp]);
  fs.writeFileSync(filePath, out);
  return { contentBuf, comp, out };
}

/* ----- SELF-VALIDATION: read back, decompress like ezdxf, re-parse ----- */
function validateCtb(filePath, expectBlack) {
  const raw = fs.readFileSync(filePath);
  const errors = [];
  const ok = (cond, msg) => { if (!cond) errors.push(msg); };

  // 1. header + meta
  ok(raw.slice(0, 48).toString('latin1') === MAGIC, 'bad 48-byte magic header');
  const adlerStored = raw.readUInt32LE(48);
  const lenUncStored = raw.readUInt32LE(52);
  const lenCmpStored = raw.readUInt32LE(56);
  const comp = raw.slice(60);
  ok(comp.length === lenCmpStored, `stored comp len ${lenCmpStored} != actual ${comp.length}`);
  ok(adler32(comp) === adlerStored, 'stored adler32 mismatch');

  // 2. decompress EXACTLY like ezdxf's reader: zlib.decompress(content[60:])
  let text;
  try { text = zlib.inflateSync(comp).toString('latin1'); }
  catch (e) { errors.push('zlib.inflate(content[60:]) failed: ' + e.message); return { errors }; }
  ok(text.length === lenUncStored, `decompressed len ${text.length} != stored ${lenUncStored}`);
  ok(text.charCodeAt(text.length - 1) === 0, 'body does not end with NUL');

  // 3. re-parse the plot styles
  const body = text.slice(0, -1);
  ok(/^description="/.test(body), 'missing description header');
  ok(body.includes('aci_table_available=TRUE'), 'missing aci_table_available');
  ok(/\naci_table\{\n/.test(body), 'missing aci_table block');
  ok(/\nplot_style\{\n/.test(body), 'missing plot_style block');
  ok(/\ncustom_lineweight_table\{\n/.test(body), 'missing lineweight table');

  // parse lineweight table
  const lwm = body.match(/custom_lineweight_table\{\n([\s\S]*?)\n\}/);
  const lwTable = [];
  if (lwm) lwm[1].split('\n').forEach(l => {
    const m = l.match(/^\s*(\d+)=([\d.]+)/); if (m) lwTable[+m[1]] = parseFloat(m[2]);
  });
  ok(lwTable.length === LINEWEIGHTS.length, `lineweight table len ${lwTable.length} != ${LINEWEIGHTS.length}`);
  LINEWEIGHTS.forEach((w, i) => ok(Math.abs(lwTable[i] - w) < 1e-9, `lw[${i}] ${lwTable[i]} != ${w}`));

  // parse each style block
  const psm = body.match(/plot_style\{\n([\s\S]*)\ncustom_lineweight_table/);
  const styleText = psm ? psm[1] : '';
  const blocks = [...styleText.matchAll(/ (\d+)\{\n([\s\S]*?)\n \}/g)];
  ok(blocks.length === 255, `style count ${blocks.length} != 255`);

  const field = (blk, key) => {
    const m = blk.match(new RegExp('\\n  ' + key + '=(-?\\d+)'));
    return m ? parseInt(m[1], 10) : null;
  };
  let checkedPens = 0, checkedScreens = 0, fullCoverage = true, defaultCount = 0;
  for (const [, idxStr, blk] of blocks) {
    const idx = +idxStr, aci = idx + 1;
    const color = field(blk, 'color');
    const lw = field(blk, 'lineweight');
    const scr = field(blk, 'screen');
    if (expectBlack) {
      ok(color === BLACK, `ACI ${aci}: color ${color} != BLACK ${BLACK}`);
      ok(/mode_color=/.test(blk), `ACI ${aci}: black style missing mode_color`);
    } else {
      ok(color === OBJECT_COLOR, `ACI ${aci}: color ${color} != OBJECT_COLOR`);
      ok(!/mode_color=/.test(blk), `ACI ${aci}: object-color style must NOT have mode_color`);
    }
    // full 1-255 coverage: every color carries a real pen (never index 0)
    const expIdx = penFor(aci);
    ok(lw === expIdx, `ACI ${aci}: lineweight idx ${lw} != expected ${expIdx} (${LINEWEIGHTS[expIdx]}mm)`);
    ok(lw !== IDX.OBJECT, `ACI ${aci}: lineweight is index 0 (object) — full coverage broken`);
    if (lw === IDX.OBJECT) fullCoverage = false;
    if (!Object.prototype.hasOwnProperty.call(ACI_PEN, aci)) { ok(lw === DEFAULT_PEN, `ACI ${aci}: unpinned pen ${lw} != DEFAULT_PEN ${DEFAULT_PEN}`); defaultCount++; }
    // screening
    const expScr = screenFor(aci);
    ok(scr === expScr, `ACI ${aci}: screen ${scr} != expected ${expScr}`);
    if (Object.prototype.hasOwnProperty.call(ACI_SCREEN, aci)) checkedScreens++;
    if (ACI_PEN[aci] !== undefined) checkedPens++;
  }
  ok(checkedPens === Object.keys(ACI_PEN).length, `pinned pens verified ${checkedPens} != ${Object.keys(ACI_PEN).length}`);
  ok(checkedScreens === Object.keys(ACI_SCREEN).length, `screened pens verified ${checkedScreens} != ${Object.keys(ACI_SCREEN).length}`);
  ok(fullCoverage, 'full 1-255 coverage assertion failed (some color left at object lineweight)');
  ok(defaultCount === 255 - Object.keys(ACI_PEN).length, `default-pen colors ${defaultCount} != ${255 - Object.keys(ACI_PEN).length}`);

  return { errors, lwTable, styleCount: blocks.length, pinnedPens: checkedPens, screenedPens: checkedScreens, defaultPens: defaultCount };
}

/* ----- run ----- */
function main() {
  const targets = [
    { file: 'SOLINE.ctb',       black: true,
      desc: 'Soline work set - all-black, full 1-255 ISO-128-23 pens (walls .50 struct .35 services .25 text .18 dims/hatch .13, section/border .70, default .25), poche+grey-ramp screened' },
    { file: 'SOLINE-Color.ctb', black: false,
      desc: 'Soline presentation - object colors, full 1-255 ISO-128-23 pens (same hierarchy + screening as SOLINE.ctb)' },
  ];
  let allOk = true;
  for (const t of targets) {
    const fp = path.join(OUT_DIR, t.file);
    const body = buildBody(t.desc, t.black);
    const { out } = writeCtb(fp, body);
    const res = validateCtb(fp, t.black);
    const bad = res.errors.length;
    if (bad) allOk = false;
    console.log(`\n=== ${t.file} (${out.length} bytes) ===`);
    console.log(`  black work set : ${t.black}`);
    console.log(`  styles         : ${res.styleCount}  (full 1-255 coverage)`);
    console.log(`  pinned pens    : ${res.pinnedPens}   default-pen: ${res.defaultPens}   screened: ${res.screenedPens}`);
    console.log(`  validation     : ${bad ? 'FAIL (' + bad + ')' : 'PASS'}`);
    if (bad) res.errors.slice(0, 20).forEach(e => console.log('    - ' + e));
  }
  console.log('\nBLACK color int = ' + BLACK + '  (RGB 0,0,0 type 0x' + COLOR_RGB.toString(16).toUpperCase() + ')');
  console.log('Overall: ' + (allOk ? 'ALL PASS' : 'FAILURES PRESENT'));
  process.exit(allOk ? 0 : 1);
}

if (require.main === module) main();
module.exports = { buildBody, writeCtb, validateCtb, ACI_PEN, LINEWEIGHTS, IDX, BLACK };
