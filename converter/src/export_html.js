'use strict';
/*
 * export_html.js — Soline interactive Hebrew (RTL) measurement report.
 * =============================================================================
 * REWRITE 2026-08-21 (carpenter-grade, unified engine):
 *   The interactive HTML report and the print/PDF report are now produced by ONE
 *   shared engine in `export_pdf.js` (buildHtml). This module is a thin adapter
 *   that renders the SAME professional document — cover, per-room plan (poché
 *   walls + nested architectural dimension chains + numbered element callouts +
 *   legend + scale bar + north), per-wall elevations (elements at real heights
 *   with sill/head height axis + running position chain), an elements schedule
 *   table and a walls table — with an interactive on-screen shell (sticky
 *   toolbar, section nav, category filter chips, print-to-PDF button).
 *
 *   Because both outputs share the same drawing/dimension code, the HTML report
 *   and the PDF can never drift: fix a dimension once, both improve.
 *
 * API (unchanged, consumed by soline_convert.js):
 *   renderHtml(model, opts) -> string
 *     opts.mode = 'interactive' (default) — sticky toolbar + category filters.
 *     opts.mode = 'print'                 — clean A4 page-break document (no shell).
 */

const path = require('path');
const engine = require('./export_pdf');

function renderHtml(model, opts) {
  opts = opts || {};
  const interactive = opts.mode !== 'print';
  return engine.buildHtml(model, { interactive });
}

module.exports = {
  renderHtml,
  // pass-throughs kept for backward compatibility with any external reuse.
  resolveItem: engine.resolveItem,
  groupOf: engine.groupOf,
  planSvg: engine.planSvg,
  elevationSvg: engine.elevationSvg,
  styles: engine.styles,
  BRAND: engine.BRAND,
};

// CLI: node src/export_html.js <in.sol|in.ordx> [out.html]
if (require.main === module) {
  const fs = require('fs');
  const inPath = process.argv[2];
  if (!inPath) { console.error('usage: node src/export_html.js <in.sol|in.ordx> [out.html]'); process.exit(2); }
  let model;
  if (/\.sol$/i.test(inPath)) {
    const { readSol } = require('./readSol');
    const sol = readSol(inPath);
    if (sol.embeddedOrdx) { const { parseOrdxString } = require('./parseOrdx'); model = parseOrdxString(sol.embeddedOrdx.toString('utf8')); }
    else model = sol.model;
    if (model) { // שכבות-מדיה + רשימות-משימות מ-annotations.json (additive)
      model.photos = sol.photos || [];
      model.videos = sol.videos || [];
      model.checklist = sol.checklist || null;
      model.projectChecklist = sol.projectChecklist || null;
    }

  } else {
    const { parseOrdxFile } = require('./parseOrdx');
    model = parseOrdxFile(inPath);
  }
  const out = process.argv[3] || path.join(path.dirname(inPath), path.basename(inPath).replace(/\.(sol|ordx)$/i, '') + '_report.html');
  fs.writeFileSync(out, renderHtml(model, { mode: 'interactive' }), 'utf8');
  console.log('wrote', out);
}
