'use strict';
/*
 * decode_socket_plus.js — פיצוח מנגנון "שקע+" (‎+שקע / SocketEx)
 * =============================================================================
 * מטרה: להוכיח בבייטים במה רשומת "שקע+" שונה מ"שקע" רגיל, ולמה היא מקבלת
 * מידה-מותאמת + אייקון-נכון בו-זמנית.
 *
 * מקורות:
 *   1) קובץ-הבעלים (שני "+שקע" ו-"שקע" זה-לצד-זה):
 *      G:/My Drive/קבצים ללמידת מכונה/PDP/sheka+_Bar2_Terra-Nova_Yosi_DR1.pdp
 *   2) בסיס-האב העשיר (מכיל native +שקע/+מפסק/+טלפון):
 *      templates/dr/base/wall4_oc40.pdp  (= elemets_Bar_Terra-Nova_Yosi_DR1.pdp)
 *
 * מסקנה: "+X" = אותו code + אותה יחידת-11-בייט [0x91,0x9c) כמו "X", עם
 *   t1 (@0x79) נשמר native (נועל את הגליף) ו-t2 (@0x7f) = המידה-המותאמת שלנו.
 *   העריכה נוגעת רק ב-type-string(@0x09) + t2(@0x7f) → אין 921, אין אלמנט-ספרייה חדש.
 */
const fs = require('fs');
const path = require('path');

const OBJ_REC = 173;
const COUNT_OFF = 0xd2, TABLE_OFF = 0xd4, STRIDE = 14, SYM = 0x91;
const heb = 'אבגדהוזחטיךכלםמןנסעףפץצקרשת';

function cp1255(buf, s, n) {
  let o = '';
  for (let i = s; i < s + n && i < buf.length; i++) {
    const c = buf[i];
    if (c >= 0xE0 && c <= 0xFA) o += heb[c - 0xE0];
    else if (c >= 32 && c < 127) o += String.fromCharCode(c);
    else break;
  }
  return o;
}
function slots(buf) {
  const nW = buf.readInt16LE(COUNT_OFF);
  const cOff = TABLE_OFF + STRIDE * nW;
  const objCount = buf.readUInt32LE(cOff);
  const o0 = cOff + 20;
  const out = [];
  for (let i = 0; i < objCount; i++) {
    const off = o0 + i * OBJ_REC;
    out.push({
      i, off,
      type: cp1255(buf, off + 9, 24),
      code: buf.readInt16LE(off + SYM),
      t1: [buf.readInt16LE(off + 0x79), buf.readInt16LE(off + 0x7b), buf.readInt16LE(off + 0x7d)],
      t2: [buf.readInt16LE(off + 0x7f), buf.readInt16LE(off + 0x81), buf.readInt16LE(off + 0x83)],
      unit: buf.slice(off + 0x91, off + 0x9c).toString('hex'),
    });
  }
  return { nW, objCount, o0, out };
}

const EXPORT = 'G:/My Drive/קבצים ללמידת מכונה/PDP/sheka+_Bar2_Terra-Nova_Yosi_DR1.pdp';
const BASE = path.join(__dirname, '..', 'templates', 'dr', 'base', 'wall4_oc40.pdp');

const exp = fs.readFileSync(EXPORT);
const base = fs.readFileSync(BASE);
const es = slots(exp), bs = slots(base);

// --- כל ה-"+" זוגות בבסיס + בקובץ-הייצוא ---
const plusTypes = ['+שקע', '+מפסק', '+טלפון'];
const plainOf = { '+שקע': 'שקע', '+מפסק': 'מפסק', '+טלפון': 'טלפון' };
const report = { export: {}, base: {}, pairs: [], prototype: {} };

report.export.slots = es.out.map(s => ({ type: s.type, code: s.code, t1: s.t1, t2: s.t2, unit: s.unit }));

// --- הוכחת-שונות t2 בין שני דגימי +שקע (בסיס [500,0,500] מול ייצוא) ---
const expPlus = es.out.find(s => s.type === '+שקע');
const basePlus = bs.out.find(s => s.type === '+שקע');
const basePlain = bs.out.find(s => s.type === 'שקע');
report.pairs.push({
  proof: 't2 varies between two +שקע samples while t1+code+unit are locked',
  exportPlus: { t1: expPlus.t1, t2: expPlus.t2, code: expPlus.code, unit: expPlus.unit },
  basePlus: { t1: basePlus.t1, t2: basePlus.t2, code: basePlus.code, unit: basePlus.unit },
  basePlain: { t1: basePlain.t1, t2: basePlain.t2, code: basePlain.code, unit: basePlain.unit },
  t1_locked: JSON.stringify(expPlus.t1) === JSON.stringify(basePlus.t1) &&
             JSON.stringify(basePlus.t1) === JSON.stringify(basePlain.t1),
  t2_varies: JSON.stringify(expPlus.t2) !== JSON.stringify(basePlus.t2),
  code_unit_locked: expPlus.code === basePlain.code && expPlus.unit === basePlain.unit,
});

// --- כל שלושת ה-"+" בבסיס: אותו code/unit/t1 כמו הרגיל, רק t2 שונה ---
for (const pt of plusTypes) {
  const p = bs.out.find(s => s.type === pt);
  const q = bs.out.find(s => s.type === plainOf[pt]);
  if (!p || !q) continue;
  report.base[pt] = {
    plusT1: p.t1, plusT2: p.t2, plainT1: q.t1, plainT2: q.t2,
    sameCode: p.code === q.code, sameUnit: p.unit === q.unit,
    t1EqualsPlainNative: JSON.stringify(p.t1) === JSON.stringify(q.t1),
    plainT1EqualsT2: JSON.stringify(q.t1) === JSON.stringify(q.t2),
  };
}

// --- פרוטוטייפ: לפלוט +שקע מסלוט-שקע ע"י עריכת label+t2 בלבד ---
(function () {
  const sockOff = bs.out.find(s => s.type === 'שקע').off;
  const plusOff = bs.out.find(s => s.type === '+שקע').off;
  const rec = Buffer.from(base.slice(sockOff, sockOff + OBJ_REC));
  // 1) type label "+שקע"
  Buffer.from([0x2b, 0xf9, 0xf7, 0xf2]).copy(rec, 0x09);
  // 2) t2 = מידה-מותאמת (כאן: תואם native +שקע [500,0,500] כדי להשוות לאמת)
  rec.writeInt16LE(500, 0x7f); rec.writeInt16LE(0, 0x81); rec.writeInt16LE(500, 0x83);
  const unitUntouched = rec.slice(0x91, 0x9c).equals(base.slice(sockOff + 0x91, sockOff + 0x9c));
  const t1Preserved = rec.slice(0x79, 0x7f).equals(base.slice(sockOff + 0x79, sockOff + 0x7f));
  const labelMatches = rec.slice(0x09, 0x0d).equals(base.slice(plusOff + 0x09, plusOff + 0x0d));
  const t2Matches = rec.slice(0x7f, 0x85).equals(base.slice(plusOff + 0x7f, plusOff + 0x85));
  const unitMatches = rec.slice(0x91, 0x9c).equals(base.slice(plusOff + 0x91, plusOff + 0x9c));
  const remaining = [];
  for (let i = 0; i < OBJ_REC; i++) if (rec[i] !== base[plusOff + i]) remaining.push('0x' + i.toString(16));
  report.prototype = {
    method: 'copy plain-socket slot; write "+שקע" @0x09 + t2 @0x7f; nothing else',
    unitUntouched, t1Preserved, labelMatches, t2Matches, unitMatches,
    remainingDiffsVsNativePlus: remaining,
    note: 'remaining diffs are only secondary-name-label (0x33+) + position (0x85-0x8a) — placement/label, never [0x91,0x9c)',
  };
})();

const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'socket_plus.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('\nwrote analysis/out/socket_plus.json');
