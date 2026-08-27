#!/usr/bin/env node
'use strict';
/*
 * test/regression.js — Soline converter EXPORT REGRESSION HARNESS.
 * =============================================================================
 * מטרה (goal): לרוץ על fixture אחד ולוודא שכל exporter עדיין מפיק פלט תקין —
 * כך ששינוי עתידי לא ישבור בשקט אף פורמט-ייצוא. TEST-ONLY: this file NEVER
 * imports-and-mutates exporter internals; it only calls the PUBLIC exported
 * API of each exporter (exportX / selfTest) exactly as soline_convert.js /
 * the per-file CLIs do.
 *
 * COVERAGE (one fixture -> every export format):
 *   DXF-2D  src/export_dxf2d.js   exportDXF2D + selfTest  (+ R12 contract extras)
 *   DXF-3D  src/export_dxf_pro.js exportDXF3DPro + selfTest(mode:'3d')
 *   DXF-2D-pro (same module)      exportDXF2DPro + selfTest(mode:'2d')
 *   PDP     src/writePdpDR.js     selfTest()  + the two analysis byte-tests
 *   HTML    src/export_html.js    renderHtml  (media-less .sol + media-ful model)
 *   ORDX    src/export_ordx.js    exportORDX round-trip (structural)
 *   ORD     src/export_ord.js     structural check IF present, else skip+note
 *
 * DETERMINISM: no network, no random, no reliance on Date.now (titles that would
 * embed a date are omitted / pinned). Re-running produces the same PASS/FAIL.
 *
 * USAGE:
 *   node test/regression.js            # run all, print summary, exit non-zero on any FAIL
 *   node test/regression.js --verbose  # also print every individual check line
 *
 * EXIT CODE: 0 = every format PASS (or cleanly SKIPPED). Non-zero = >=1 FAIL.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// ---------------------------------------------------------------------------
// tiny result model
// ---------------------------------------------------------------------------
/** one format's outcome: { format, status: 'PASS'|'FAIL'|'SKIP', checks:[{name,ok,msg}], notes:[] } */
const results = [];

function runFormat(format, fn) {
  const rec = { format, status: 'PASS', checks: [], notes: [] };
  const A = {
    // assert: record a check; a false condition flips the whole format to FAIL.
    ok(name, cond, msg) { rec.checks.push({ name, ok: !!cond, msg: msg || '' }); if (!cond) rec.status = 'FAIL'; return !!cond; },
    note(m) { rec.notes.push(m); },
    skip(m) { rec.status = 'SKIP'; rec.notes.push(m); },
  };
  try {
    fn(A);
  } catch (e) {
    rec.status = 'FAIL';
    rec.checks.push({ name: 'threw', ok: false, msg: (e && e.stack) ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e) });
  }
  results.push(rec);
  return rec;
}

// ---------------------------------------------------------------------------
// fixture loading — the SAME path the real exporters consume (readSol -> the
// embedded ORDX -> parsed model; fall back to the native room model).
// ---------------------------------------------------------------------------
const FIX_SOL = path.join(ROOT, '_LATEST', 'allelem_showcase.sol');
const FIX_ORDX = path.join(ROOT, 'analysis', 'out', 'allelem', 'allelem.ordx');

function loadModel() {
  const { readSol } = require(path.join(SRC, 'readSol'));
  const { parseOrdxString, parseOrdxFile } = require(path.join(SRC, 'parseOrdx'));
  let model = null, source = '';
  if (fs.existsSync(FIX_SOL)) {
    const sol = readSol(FIX_SOL);
    model = sol.embeddedOrdx ? parseOrdxString(sol.embeddedOrdx.toString('utf8')) : sol.model;
    if (model) { // additive media/checklist layers, exactly like export_html/export_pdf CLIs
      model.photos = sol.photos || [];
      model.videos = sol.videos || [];
      model.checklist = sol.checklist || null;
      model.projectChecklist = sol.projectChecklist || null;
    }
    source = path.relative(ROOT, FIX_SOL);
  } else if (fs.existsSync(FIX_ORDX)) {
    model = parseOrdxFile(FIX_ORDX);
    source = path.relative(ROOT, FIX_ORDX);
  }
  if (!model) throw new Error('no fixture found: ' + FIX_SOL + ' / ' + FIX_ORDX);
  return { model, source };
}

// A minimal but VALID 1x1 JPEG (base64). Used only to exercise the media path of
// the HTML report; the exporter base64-embeds the buffer as a data: URI (CSP-safe).
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////' +
  '////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAAB' +
  'AAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q==';

// ---------------------------------------------------------------------------
// CSP / external-asset scan for HTML (no http(s):// or protocol-relative refs,
// no external @import / url()). data:, blob:, #fragment and relative are fine.
// ---------------------------------------------------------------------------
function externalRefs(html) {
  const hits = [];
  const push = (re, label) => { for (const m of html.matchAll(re)) hits.push(label + ': ' + m[0].slice(0, 80)); };
  push(/(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+/gi, 'attr');
  push(/url\(\s*["']?(?:https?:)?\/\/[^)]+/gi, 'css-url');
  push(/@import\s+["'](?:https?:)?\/\/[^"']+/gi, 'import');
  push(/<script[^>]+\bsrc\s*=\s*["'](?:https?:)?\/\/[^"']+/gi, 'script-src');
  return hits;
}

// ===========================================================================
// MAIN
// ===========================================================================
const { model, source } = loadModel();
console.log('Soline export regression harness');
console.log('  fixture .............', source);
console.log('  rooms/walls .........', (model.rooms || []).length, '/', ((model.rooms || [])[0] ? (model.rooms[0].walls || []).length : 0));
console.log('');

// ---------------------------------------------------------------------------
// 1) DXF-2D  (src/export_dxf2d.js)
// ---------------------------------------------------------------------------
runFormat('DXF-2D', (A) => {
  const d2 = require(path.join(SRC, 'export_dxf2d'));
  const scene = d2.sceneFromModel(model);
  const dxf = d2.exportDXF2D(scene, { labels: true });
  const t = d2.selfTest(dxf, scene);
  A.ok('exportDXF2D returns a non-empty string', typeof dxf === 'string' && dxf.length > 0, `${dxf && dxf.length} B`);
  A.ok('built-in selfTest.ok', t.ok, t.problems && t.problems.join('; '));
  // --- R12 contract extras (explicitly requested, beyond the built-in selfTest) ---
  A.ok('R12 $ACADVER = AC1009', dxf.includes('AC1009') && !dxf.includes('AC1015'));
  A.ok('$DWGCODEPAGE ansi_1255', dxf.includes('ansi_1255'));
  A.ok('$DIMLFAC header var present', dxf.includes('$DIMLFAC'));
  A.ok('NO DIMSTYLE table (R12 has none)', !dxf.includes('DIMSTYLE'));
  // no R13+-only $DIM* header vars (these break an R12 loader)
  const R13_DIMS = ['$DIMUNIT', '$DIMDEC', '$DIMTDEC', '$DIMTXSTY', '$DIMAUNIT', '$DIMJUST',
    '$DIMSD1', '$DIMSD2', '$DIMTOLJ', '$DIMTZIN', '$DIMALTZ', '$DIMALTTZ', '$DIMFIT',
    '$DIMUPT', '$DIMFRAC', '$DIMLUNIT', '$DIMDSEP', '$DIMATFIT', '$DIMFXL'];
  const leaked = R13_DIMS.filter((v) => dxf.includes(v));
  A.ok('no R13-only $DIM* vars', leaked.length === 0, 'leaked: ' + leaked.join(','));
  A.ok('cp1255-encodable (no char > 255)', t.cp1255Ok);
  A.ok('symbols emitted as BLOCKs + INSERTs', t.blocks > 0 && t.inserts > 0, `blocks=${t.blocks} inserts=${t.inserts}`);
  // unique handles — recount independently of selfTest
  const seen = new Set(); let dup = 0;
  for (const m of dxf.match(/\n\s*5\n([0-9A-Fa-f]+)\n/g) || []) { const v = m.trim().split('\n').pop().toUpperCase(); if (seen.has(v)) dup++; else seen.add(v); }
  A.ok('unique entity handles', dup === 0, `dup=${dup}, handles=${seen.size}`);
  A.note(`LINE/TEXT/SOLID/ARC=${t.lines}/${t.texts}/${t.solids}/${t.arcs}, layers=${t.layers}`);
});

// ---------------------------------------------------------------------------
// 2) DXF-3D + DXF-2D-pro  (src/export_dxf_pro.js)
// ---------------------------------------------------------------------------
runFormat('DXF-3D', (A) => {
  const dp = require(path.join(SRC, 'export_dxf_pro'));
  const scene = dp.sceneFromModel(model);
  // 3D
  const dxf3 = dp.exportDXF3DPro(scene, { labels: false });
  const t3 = dp.selfTest(dxf3, scene, { mode: '3d' });
  A.ok('exportDXF3DPro returns a non-empty string', typeof dxf3 === 'string' && dxf3.length > 0, `${dxf3 && dxf3.length} B`);
  A.ok('3D selfTest.ok', t3.ok, t3.problems && t3.problems.join('; '));
  A.ok('3D ends with EOF', /\n\s*0\nEOF\n?$/.test(dxf3));
  A.ok('3D SECTION/ENDSEC balanced (4)', (dxf3.match(/(?:^|\n)\s*0\nSECTION\n/g) || []).length === 4
    && (dxf3.match(/(?:^|\n)\s*0\nSECTION\n/g) || []).length === (dxf3.match(/\n\s*0\nENDSEC\n/g) || []).length);
  A.ok('3D BLOCK/ENDBLK balanced', (dxf3.match(/\n\s*0\nBLOCK\n/g) || []).length === (dxf3.match(/\n\s*0\nENDBLK\n/g) || []).length);
  A.ok('3D R12 (AC1009, no OBJECTS section)', dxf3.includes('AC1009') && !dxf3.includes('\nOBJECTS\n'));
  A.note(`3DFACE/INSERT/LINE/TEXT=${t3.faces}/${t3.inserts}/${t3.lines}/${t3.texts}, layers=${t3.layers}`);
  // 2D-pro (same module, mode:'2d') — bonus coverage of the paper-plan path.
  const dxf2 = dp.exportDXF2DPro(scene, { labels: true });
  const t2 = dp.selfTest(dxf2, scene, { mode: '2d' });
  A.ok('exportDXF2DPro returns a non-empty string', typeof dxf2 === 'string' && dxf2.length > 0, `${dxf2 && dxf2.length} B`);
  A.ok('2D-pro selfTest.ok', t2.ok, t2.problems && t2.problems.join('; '));
});

// ---------------------------------------------------------------------------
// 3) PDP  (src/writePdpDR.js selfTest + the two analysis byte-tests)
// ---------------------------------------------------------------------------
runFormat('PDP', (A) => {
  const W = require(path.join(SRC, 'writePdpDR'));
  const st = W.selfTest();
  A.ok('writePdpDR.selfTest().ok', st.ok, (st.problems || []).join('; '));
  // The two repeatable byte-tests are self-contained scripts that exit 0 on PASS.
  // They assert: positive world coords, property unit [0x91,0x9c) untouched, terminator
  // untouched, SIZE rule (fixed vs variable), and the ➕ socket-plus emit structure.
  const runScript = (rel) => {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) return { skip: true };
    const r = cp.spawnSync(process.execPath, [p], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  const inj = runScript(path.join('analysis', 'pdp_inject_bytetest.js'));
  if (inj.skip) A.note('pdp_inject_bytetest.js absent — skipped');
  else A.ok('pdp_inject_bytetest.js exit 0 (byte-verify PASS)', inj.code === 0,
    (inj.out.match(/"byteVerify":\s*"[^"]+"/) || [''])[0]);
  const plus = runScript(path.join('analysis', 'pdp_plus_bytetest.js'));
  if (plus.skip) A.note('pdp_plus_bytetest.js absent — skipped');
  else A.ok('pdp_plus_bytetest.js exit 0 (byte-verify PASS)', plus.code === 0,
    (plus.out.match(/"byteVerify":\s*"[^"]+"/) || [''])[0]);
});

// ---------------------------------------------------------------------------
// 4) HTML report  (src/export_html.js) — media-less .sol + a media-ful model.
// ---------------------------------------------------------------------------
runFormat('HTML', (A) => {
  const eh = require(path.join(SRC, 'export_html'));
  // (a) media-less: the showcase fixture carries 0 photos/videos.
  const htmlA = eh.renderHtml(model, { mode: 'interactive' });
  A.ok('media-less: renderHtml returns a string', typeof htmlA === 'string' && htmlA.length > 0, `${htmlA && htmlA.length} B`);
  A.ok('media-less: has <html>', /<html[\s>]/i.test(htmlA));
  A.ok('media-less: RTL (dir="rtl")', /dir\s*=\s*["']?rtl/i.test(htmlA));
  const extA = externalRefs(htmlA);
  A.ok('media-less: no external asset URLs (CSP-safe)', extA.length === 0, extA.slice(0, 3).join(' ; '));

  // (b) media-ful: attach one embedded JPEG photo + one wall — same model shape
  //     readSol produces. Assert the media path renders and stays CSP-safe.
  const mediaModel = Object.assign({}, model, {
    photos: [{
      file: 'photos/test.jpg', name: 'בדיקה', scope: 'wall', wallIdx: 0,
      wallLabel: 'חזית 1', kind: 'context', caption: 'regression', seq: 1,
      buffer: Buffer.from(TINY_JPEG_B64, 'base64'),
    }],
    videos: [], checklist: null, projectChecklist: null,
  });
  const htmlB = eh.renderHtml(mediaModel, { mode: 'interactive' });
  A.ok('media-ful: renderHtml returns a string', typeof htmlB === 'string' && htmlB.length > 0, `${htmlB && htmlB.length} B`);
  A.ok('media-ful: photo embedded as data: URI', htmlB.includes('data:image/jpeg;base64,'));
  A.ok('media-ful: has <html> + RTL', /<html[\s>]/i.test(htmlB) && /dir\s*=\s*["']?rtl/i.test(htmlB));
  const extB = externalRefs(htmlB);
  A.ok('media-ful: no external asset URLs (CSP-safe)', extB.length === 0, extB.slice(0, 3).join(' ; '));
  A.note(`media-ful adds ${(htmlB.length - htmlA.length)} B (gallery + embedded JPEG)`);
});

// ---------------------------------------------------------------------------
// 5) ORDX round-trip  (src/export_ordx.js) — structural, self-contained.
// ---------------------------------------------------------------------------
runFormat('ORDX', (A) => {
  const eo = require(path.join(SRC, 'export_ordx'));
  const { parseOrdxString } = require(path.join(SRC, 'parseOrdx'));
  const xml = eo.exportORDX(model);
  A.ok('exportORDX returns a non-empty string', typeof xml === 'string' && xml.length > 0, `${xml && xml.length} B`);
  A.ok('valid XML prolog', /^\s*<\?xml/.test(xml));
  const re = parseOrdxString(xml);
  A.ok('re-parses without throwing', !!re && Array.isArray(re.rooms));
  A.ok('round-trip preserves rooms count', (re.rooms || []).length === (model.rooms || []).length,
    `${(re.rooms || []).length} vs ${(model.rooms || []).length}`);
  A.ok('round-trip preserves summary (rooms/walls/items)',
    JSON.stringify(re.summary) === JSON.stringify(model.summary), 'summary drift');
});

// ---------------------------------------------------------------------------
// 6) ORD  (src/export_ord.js) — a parallel agent may be adding it. Structural
//    check if present; otherwise SKIP with a logged note (never a FAIL).
// ---------------------------------------------------------------------------
runFormat('ORD', (A) => {
  const ordPath = path.join(SRC, 'export_ord.js');
  if (!fs.existsSync(ordPath)) { A.skip('src/export_ord.js not present yet — nothing to test (parallel work-in-progress).'); return; }
  const mod = require(ordPath);
  // Discover a callable exporter without assuming a fixed name.
  const fnName = ['exportORD', 'exportOrd', 'writeORD', 'buildORD', 'default'].find((k) => typeof mod[k] === 'function')
    || Object.keys(mod).find((k) => typeof mod[k] === 'function');
  if (!fnName) { A.ok('export_ord.js exposes a callable exporter', false, 'no callable export found in module'); return; }
  const out = mod[fnName](model);
  A.ok(`export_ord.${fnName}() returns a non-empty string`, typeof out === 'string' && out.length > 0, `${out && out.length} B`);
  if (typeof out !== 'string') return;
  if (typeof mod.selfTest === 'function') {
    // Prefer the module's own selfTest when it exposes one.
    const t = mod.selfTest(out, model);
    A.ok('export_ord selfTest.ok', t === true || (t && t.ok), (t && t.problems ? t.problems.join('; ') : ''));
    return;
  }
  // No selfTest export -> assert the ORD-Extended v4 structural contract directly
  // (docs/ORDX_SPEC_FROM_WEB.md): [Header] Version=4 Unit=1, the required sections,
  // ASCII-only, CRLF line endings, and one [Walls] row per model wall.
  A.note('export_ord.js has no selfTest export — asserting the ORD v4 structural contract directly.');
  A.ok('[Header] Version=4', /\[Header\][\s\S]*?Version\s*=\s*4/.test(out));
  A.ok('[Header] Unit=1 (metric mm)', /Unit\s*=\s*1/.test(out));
  for (const sec of ['Header', 'Walls', 'Floors']) A.ok(`section [${sec}] present`, out.includes('[' + sec + ']'));
  let asciiOk = true; for (let i = 0; i < out.length; i++) if (out.charCodeAt(i) > 127) { asciiOk = false; break; }
  A.ok('ASCII-only output', asciiOk);
  A.ok('CRLF line endings', out.includes('\r\n'));
  // one [Walls] data row per model wall
  const nWalls = (model.rooms || []).reduce((a, r) => a + (r.walls || []).length, 0);
  const wallsBlock = (out.match(/\[Walls\]\r?\n([\s\S]*?)(?:\r?\n\r?\n|\[)/) || [])[1] || '';
  const nWallRows = wallsBlock.split(/\r?\n/).filter((l) => /^\s*-?\d/.test(l)).length;
  A.ok('[Walls] row per model wall', nWallRows === nWalls, `rows=${nWallRows} walls=${nWalls}`);
});

// ===========================================================================
// SUMMARY
// ===========================================================================
console.log('Per-format result');
console.log('  ' + '-'.repeat(60));
let anyFail = false;
for (const r of results) {
  if (r.status === 'FAIL') anyFail = true;
  const pad = (r.format + ' ').padEnd(10, '.');
  const nPass = r.checks.filter((c) => c.ok).length;
  const nTot = r.checks.length;
  console.log(`  ${pad} ${r.status.padEnd(4)}  (${nPass}/${nTot} checks)`);
  if (VERBOSE || r.status === 'FAIL') {
    for (const c of r.checks) console.log(`        ${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.msg ? '  — ' + c.msg : ''}`);
  }
  for (const n of r.notes) console.log(`        note: ${n}`);
}
console.log('  ' + '-'.repeat(60));
const nPassF = results.filter((r) => r.status === 'PASS').length;
const nSkipF = results.filter((r) => r.status === 'SKIP').length;
const nFailF = results.filter((r) => r.status === 'FAIL').length;
console.log(`  OVERALL: ${nPassF} PASS, ${nSkipF} SKIP, ${nFailF} FAIL`);
console.log('');
if (anyFail) { console.log('REGRESSION: FAIL'); process.exit(1); }
console.log('REGRESSION: PASS');
process.exit(0);
