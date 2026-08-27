'use strict';
// Dump block#1 (2D symbol, 168B @0x240d) and block#2 (3D mesh, 210B @0x44ee)
// of the injected socket and locate coordinate fields. Socket plan pos =
// (-18006,-12020). Symbol verts should cluster near it (+/- symbol half-size).
const fs = require('fs');
const PDP = 'G:/My Drive/קבצים ללמידת מכונה/PDP/';
const A = fs.readFileSync(PDP + '2918_Ktchn_TRIO_Nir_DR1.pdp');

function dump(start, len, label) {
  console.log(`\n== ${label} @0x${start.toString(16)} len ${len} ==`);
  for (let r = 0; r < len; r += 16) {
    const hx = [], i16 = [], asc = [];
    for (let c = 0; c < 16 && r + c < len; c++) hx.push(A[start + r + c].toString(16).padStart(2, '0'));
    for (let c = 0; c + 1 < 16 && r + c + 1 < len; c += 2) i16.push(String(A.readInt16LE(start + r + c)).padStart(7));
    for (let c = 0; c < 16 && r + c < len; c++) { const b = A[start + r + c]; asc.push(b >= 32 && b < 127 ? String.fromCharCode(b) : '.'); }
    console.log(`+0x${r.toString(16).padStart(3, '0')} ${hx.join(' ').padEnd(48)} ${asc.join('')}  ${i16.join(' ')}`);
  }
}

// flag any int16 (both alignments) near the socket plan coords
function flag(start, len, label) {
  const TX = -18006, TY = -12020, tol = 120;
  console.log(`\n-- coord-like int16 in ${label} near (${TX},${TY}) tol ${tol} --`);
  for (let p = 0; p + 2 <= len; p++) {
    const v = A.readInt16LE(start + p);
    const nx = Math.abs(v - TX) <= tol, ny = Math.abs(v - TY) <= tol;
    if (nx || ny) console.log(`  +0x${p.toString(16)} = ${v}  ${nx ? 'X~' : ''}${ny ? 'Y~' : ''}`);
  }
  // int32 too
  for (let p = 0; p + 4 <= len; p++) {
    const v = A.readInt32LE(start + p);
    if (Math.abs(v - TX) <= tol || Math.abs(v - TY) <= tol) console.log(`  i32 +0x${p.toString(16)} = ${v}`);
  }
}

dump(0x240d, 168, 'block#1 2D symbol');
flag(0x240d, 168, 'block#1');
dump(0x44ee, 210, 'block#2 3D mesh');
flag(0x44ee, 210, 'block#2');
