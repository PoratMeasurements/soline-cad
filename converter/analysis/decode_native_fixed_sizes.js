'use strict';
// decode_native_fixed_sizes.js — מפענח את בייטי-הגודל ה-native הקבועים לכל טיפוס-אלמנט
// מבסיס-ה-אב DR (elemets_Bar_Terra-Nova_Yosi_DR1.pdp == templates/dr/base/wall4_oc40.pdp).
// לכל טיפוס 🔒 (גודל-קבוע) הוא רושם W/D/H native + טווח-הבייטים המדויק שיש לשמר.
// פלט: analysis/out/native_fixed_sizes.json
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const COUNT_OFF = 0xd2, TABLE_OFF = 0xd4, STRIDE = 14, OBJ_REC = 173;
const OBJ_TYPE_OFF = 0x09, OBJ_TYPE_END = 0x1e;
const OBJ_DIM_OFF = 0x79, OBJ_DIM2_OFF = 0x7f, DIM_END = 0x85; // [0x79,0x85) = שתי שלישיות [W,D,H]
const SYM_OFF = 0x91;

// טוען את בסיס-האב שהבעלים מסר (מפל: master path -> local base).
const MASTER = 'G:/My Drive/קבצים ללמידת מכונה/FULL ELC/elemets_Bar_Terra-Nova_Yosi_DR1.pdp';
const LOCAL = path.join(ROOT, 'templates', 'dr', 'base', 'wall4_oc40.pdp');
const baseFile = fs.existsSync(MASTER) ? MASTER : LOCAL;
const buf = fs.readFileSync(baseFile);

function slotType(b, off) {
  let s = '';
  for (let k = OBJ_TYPE_OFF; k < OBJ_TYPE_END; k++) {
    const c = b[off + k]; if (c === 0) break;
    s += (c >= 0xE0 && c <= 0xFA) ? String.fromCharCode(0x05D0 + (c - 0xE0)) : String.fromCharCode(c);
  }
  return s;
}
function hex(b, s, e) { let o = ''; for (let k = s; k < e; k++) { if (o) o += ' '; o += b[k].toString(16).padStart(2, '0'); } return o; }

const nW = buf.readInt16LE(COUNT_OFF);
const cOff = TABLE_OFF + STRIDE * nW;
const objCount = buf.readUInt32LE(cOff);
const o0 = cOff + 20;

// FIXED (🔒) types per docs/PDP_SIZE_CLASSIFICATION.md
const FIXED = ['שקע','מפסק','ברז','גז','טלפון','אנטנה','ק.בקורת','תאורה','מים משולב'];

const allSlots = [];
for (let i = 0; i < objCount; i++) {
  const off = o0 + i * OBJ_REC;
  const type = slotType(buf, off);
  const d1 = [buf.readInt16LE(off + OBJ_DIM_OFF), buf.readInt16LE(off + OBJ_DIM_OFF + 2), buf.readInt16LE(off + OBJ_DIM_OFF + 4)];
  const d2 = [buf.readInt16LE(off + OBJ_DIM2_OFF), buf.readInt16LE(off + OBJ_DIM2_OFF + 2), buf.readInt16LE(off + OBJ_DIM2_OFF + 4)];
  allSlots.push({ slot: i, type, code: buf.readUInt8(off + SYM_OFF), dims1: d1, dims2: d2,
    dimsHex: hex(buf, off + OBJ_DIM_OFF, DIM_END) });
}

// לכל טיפוס-קבוע: קח את הרשומה ה-native הראשונה של הטיפוס (או מִשְׁפחת-שם המכילה אותו).
const FIXED_SIZE = {};
for (const t of FIXED) {
  // התאמה: שם-סלוט == t, או שם-סלוט מכיל את t (וריאנטים: "שקע כפול", "מים משולב", "נקודת גז"...)
  const match = allSlots.find(s => s.type === t)
             || allSlots.find(s => s.type.includes(t))
             || allSlots.find(s => t.split(' ').every(w => s.type.includes(w)));
  if (match) {
    FIXED_SIZE[t] = {
      nativeType: match.type, slot: match.slot, code: match.code,
      W: match.dims1[0], D: match.dims1[1], H: match.dims1[2],
      dims1: match.dims1, dims2: match.dims2,
      preserveRange: '[0x79,0x85)', dimsHex: match.dimsHex,
    };
  } else {
    FIXED_SIZE[t] = { nativeType: null, note: 'NOT PRESENT in master DR base' };
  }
}

const out = {
  source: baseFile, walls: nW, objCount,
  dimsFieldRange: '[0x79,0x85) = two int16 [W,D,H] triples @0x79 and @0x7f',
  fixedTypes: FIXED,
  FIXED_SIZE,
  allSlots,
};
const outPath = path.join(ROOT, 'analysis', 'out', 'native_fixed_sizes.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('wrote', outPath);
console.log('\n=== FIXED (🔒) native sizes ===');
for (const t of FIXED) {
  const f = FIXED_SIZE[t];
  if (f.nativeType) console.log(`${t.padEnd(12)} <- slot ${f.slot} "${f.nativeType}" code ${f.code}  W/D/H = ${f.W}/${f.D}/${f.H}  dims1=[${f.dims1}] dims2=[${f.dims2}]  ${f.dimsHex}`);
  else console.log(`${t.padEnd(12)} -- ${f.note}`);
}
console.log('\n=== ALL 40 slots (type / code / dims1 / dims2) ===');
for (const s of allSlots) console.log(`slot ${String(s.slot).padStart(2)} code ${String(s.code).padStart(2)} "${s.type}"  d1=[${s.dims1}] d2=[${s.dims2}]`);
