// ============================================================================
// Soline CAD Engine · build runner
// ----------------------------------------------------------------------------
// node build.js  →  writes out/*.dxf (2D + 3D) and the report (standalone +
// artifact form) from the single validated geometry model. Zero dependencies.
// ============================================================================

"use strict";

const fs = require("fs");
const path = require("path");
const { sampleModel } = require("./src/model");
const { build2D, build3D, toDxf } = require("./src/dxf");
const { report } = require("./src/report");

const model = sampleModel();
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });

// --- DXF exports ---
const plan2d = toDxf(build2D(model));
const model3d = toDxf(build3D(model));
fs.writeFileSync(path.join(outDir, "soline-plan-2d.dxf"), plan2d, "utf8");
fs.writeFileSync(path.join(outDir, "soline-model-3d.dxf"), model3d, "utf8");

// --- Report (standalone printable + artifact body-only) ---
const { head, body } = report(model);
const standalone =
  `<!doctype html>\n<html lang="he" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
fs.writeFileSync(path.join(outDir, "soline-report.html"), standalone, "utf8");
fs.writeFileSync(path.join(outDir, "report-artifact.html"), head + "\n" + body, "utf8");

// --- Summary ---
const countEntities = (dxf) => (dxf.match(/^0\nSECTION/gm), (dxf.match(/\n0\n(LINE|CIRCLE|TEXT|POLYLINE|3DFACE)\n/g) || []).length);
console.log("Soline CAD Engine — build complete");
console.log("  out/soline-plan-2d.dxf   ", plan2d.length, "bytes,", countEntities(plan2d), "entities");
console.log("  out/soline-model-3d.dxf  ", model3d.length, "bytes,", countEntities(model3d), "entities");
console.log("  out/soline-report.html   ", standalone.length, "bytes (open → Print → Save as PDF)");
console.log("  out/report-artifact.html ", (head + body).length, "bytes (for preview)");
