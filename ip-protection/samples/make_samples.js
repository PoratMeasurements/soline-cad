'use strict';
/*
 * make_samples.js — synthesize a minimal but valid sample PDF and .sol so the
 * demo can round-trip all four formats offline. (The .dxf and .html samples are
 * produced by the REAL Soline exporters — see samples/*.dxf, *.html.)
 */
const fs = require('fs');
const path = require('path');
const solLib = require('../lib/sol');

// ---- minimal single-page PDF (valid xref + trailer) ----------------------
function makePdf() {
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>';
  const stream = 'BT /F1 18 Tf 72 760 Td (Soline measurement plan - sample) Tj ET';
  objs[4] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let pdf = '%PDF-1.5\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  for (let i = 1; i <= 5; i++) { offsets[i] = Buffer.byteLength(pdf, 'latin1'); pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

// ---- minimal .sol (ZIP with manifest + meta + one room) ------------------
function makeSol() {
  const manifest = { format: 'sol', magic: 'SOL1', name: 'מטבח דירת דוגמה', createdAt: new Date().toISOString(), units: 'mm', producer: 'SolineMeasure' };
  const meta = { name: 'מטבח דירת דוגמה', client: 'לקוח לדוגמה' };
  const room = { id: 1, name: 'מטבח', walls: [{ idx: 0, length_mm: 4000, height_mm: 2600, angleToNext_deg: 90, accessories: [] }] };
  const files = [
    { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') },
    { name: 'meta.json', data: Buffer.from(JSON.stringify(meta, null, 2), 'utf8') },
    { name: 'measured/room-1.json', data: Buffer.from(JSON.stringify(room, null, 2), 'utf8') },
  ];
  return solLib.zip(files, '');
}

if (require.main === module) {
  const dir = __dirname;
  fs.writeFileSync(path.join(dir, 'sample.pdf'), makePdf());
  fs.writeFileSync(path.join(dir, 'sample.sol'), makeSol());
  console.log('wrote sample.pdf and sample.sol');
}
module.exports = { makePdf, makeSol };
