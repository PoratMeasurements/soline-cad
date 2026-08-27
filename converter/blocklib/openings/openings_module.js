'use strict';
/*
 * openings_module.js — מודול-הפתחים של Soline (דלתות · חלונות · מיזוג/איוורור)
 * =============================================================================
 * מקור-אמת יחיד להגדרת בלוק-הפתח: גיאומטריית תוכנית (plan) + חזית (elevation) ב-מ״מ
 * אמיתיים, מסגרת/כנף/קשת-פתיחה, מידות-אמת, שכבות SOL-*, נקודת-עיגון, ופרמטרים-לעריכה.
 *
 * גזירת-הרקע (STUDY): הגיאומטריה נבנתה **מקורית ל-Soline** לפי מוסכמת-השרטוט והמידות של
 * טמפלייט "קליל בלגי פלוס" (רשות-שימוש מפורשת של הבעלים) + מסמכי-המפרט הפנימיים
 * (docs/OPENING_ELEMENT_SCHEMA.md, docs/DOORS_WINDOWS_SIZES.md, docs/DXF_PRO_STANDARDS.md).
 * לא הועתקו בלוקים/לינוורק/שמות/שכבות מקובץ-קליל — נלקחו מוסכמה+מידות (עובדות) בלבד.
 *   • קליל מצייר את הפתח כ**חזית-ייצור** (מסגרת+כנפיים+חציצים+זיגוג+ידית+ארגז-תריס),
 *     ביחידות ס״מ, שכבת-0, גופן Arial/romans_s, קנה-מידה 1:50, קווים רציפים (קשתות מלאות).
 *   • פרופורציות שנצפו בטמפלייט: דלת-דו-כנפית ≈180×210 ס״מ, חלון ≈161×210 ס״מ (אימות-מידה בלבד).
 *   • כאן אנו מוסיפים גם את **סמל-התוכנית** (משקוף+כנף+קשת-רבע) שאין בטמפלייט-החזית של קליל,
 *     לפי מוסכמת-תכנית אדריכלית ישראלית (ISO-128), כדי לשרת שרטוט-נגרות מלא (תוכנית+חזית).
 *
 * API:
 *   CATALOG                       -> [ typeDef, ... ]   (כל טיפוסי-הפתח)
 *   byKey(key)                    -> typeDef | null
 *   resolveDims(def, override?)   -> {w,h,d,sill,wallThk,frameThk,leafThk}
 *   planPrimitives(def, dims,cfg) -> [ prim... ]  (מ״מ, מקור בתחתית-מרכז הפתח על פני-הקיר)
 *   elevPrimitives(def, dims,cfg) -> [ prim... ]  (מ״מ, מקור בתחתית-מרכז — סף/רצפה ב-Y=0)
 *   LAYERS                        -> טבלת-שכבות (SOL-*) עם צבע/עובי/מקווקו
 *   svgFor(prims,{pad,bg})        -> string  (תצוגה מקדימה)
 *   manifest()                    -> אובייקט-מניפסט מלא (לכתיבה ל-openings_manifest.json)
 *
 * לשון זכר · יחידות מ״מ · ללא תלויות חיצוניות · תאריך: 2026-08-23.
 */

// ---------------------------------------------------------------------------
// שכבות SOL-* — נגזרות מ-docs/DXF_PRO_STANDARDS.md §1 + blocklib/docs/E_LAYERS.md
// (color=ACI, wt=מ״מ ISO-128, hex=לתצוגה בלבד). המייצא (export_dxf_pro) הוא שממפה
// שכבה→עט לפי CTB; כאן ה-hex משמש רק את התצוגה-המקדימה.
// ---------------------------------------------------------------------------
const LAYERS = {
  'SOL-KIROT':        { aci: 7,   wt: 0.50, hex: '#2b2b2b', role: 'פני-קיר (קו-חתך כבד)' },
  'SOL-KIROT-MILUY':  { aci: 8,   wt: 0.13, hex: '#b9b2a6', role: 'מילוי-קיר (פושה)', dash: true },
  'SOL-PTACHIM':      { aci: 5,   wt: 0.25, hex: '#1f5fa8', role: 'דלתות+חלונות: מסגרת/כנף/זיגוג' },
  'SOL-PTACHIM-DOOR': { aci: 5,   wt: 0.25, hex: '#2f7fd0', role: 'קשת/כנף-פתיחה של דלת' },
  'SOL-MIZUG':        { aci: 141, wt: 0.25, hex: '#2f8f8f', role: 'מיזוג/איוורור' },
  'SOL-INSTALATSIA':  { aci: 4,   wt: 0.25, hex: '#0aa0a0', role: 'אינסטלציה (ניקוז)' },
  'SOL-TEKST':        { aci: 7,   wt: 0.18, hex: '#5a5248', role: 'תוויות/סימון' },
  'SOL-MIDOT-PNIM':   { aci: 3,   wt: 0.13, hex: '#3a7d3a', role: 'מידות-פנים' },
};

// ---------------------------------------------------------------------------
// עוזרי-פרימיטיב (מ״מ). כל פרימיטיב נושא layer; ברירת-מחדל נופלת מ-def.layers.
// ---------------------------------------------------------------------------
const L  = (x1, y1, x2, y2, layer, o) => Object.assign({ t: 'line', x1, y1, x2, y2, layer }, o);
const R  = (x0, y0, x1, y1, layer, o) => Object.assign({ t: 'rect', x0, y0, x1, y1, layer }, o);
const C  = (cx, cy, r, layer, o) => Object.assign({ t: 'circle', cx, cy, r, layer }, o);
// arc: center + radius, זוויות במעלות (0°=+X, נגד-כיוון-השעון), sweep>0.
const A  = (cx, cy, r, a0, a1, layer, o) => Object.assign({ t: 'arc', cx, cy, r, a0, a1, layer }, o);
const P  = (pts, layer, o) => Object.assign({ t: 'poly', pts, layer }, o);
const T  = (cx, cy, text, h, layer, o) => Object.assign({ t: 'label', cx, cy, text, h, layer }, o);
const deg = (d) => d * Math.PI / 180;

// ---------------------------------------------------------------------------
// מידות: ברירת-מחדל של הטיפוס, ניתנות-לדריסה ע"י המודד (geom מהסכמה).
// ---------------------------------------------------------------------------
function resolveDims(def, ov) {
  ov = ov || {};
  const d = def.dims || {};
  return {
    w:        num(ov.width,  d.w),
    h:        num(ov.height, d.h),
    d:        num(ov.depth,  d.d != null ? d.d : (def.kind === 'window' ? 100 : 100)),
    sill:     num(ov.sillHeight, d.sill != null ? d.sill : (def.kind === 'window' ? 900 : 0)),
    wallThk:  num(ov.wallThickness, d.wallThk != null ? d.wallThk : 100),
    frameThk: num(ov.frameThickness, d.frameThk != null ? d.frameThk : (def.mamad ? 80 : (def.kind === 'window' ? 50 : 45))),
    leafThk:  num(ov.leafThickness, d.leafThk != null ? d.leafThk : (def.mamad ? 60 : 40)),
  };
}
function num(v, dflt) { const n = Number(v); return Number.isFinite(n) ? n : dflt; }
function cfgFor(def, ov) {
  ov = ov || {};
  const c = def.config || {};
  return {
    openMode: ov.openMode || c.openMode || (def.kind === 'window' ? 'fixed' : 'hinged'),
    hingeSide: ov.hingeSide || c.hingeSide || null,
    swing:    ov.swing || c.swing || null,
    leafCount: num(ov.leafCount, c.leafCount != null ? c.leafCount : 1),
    glazing:  ov.glazing || c.glazing || (def.kind === 'window' ? 'full' : 'none'),
    shutterBox: ov.shutterBox != null ? ov.shutterBox : !!c.shutterBox,
  };
}

// ===========================================================================
// גיאומטריית-תוכנית (PLAN)
//   מסגרת-מקומית: x∈[0..W], y=0 בפני-הקיר-החיצוניים, y=wallThk בפני-הפנימיים,
//   y>wallThk = לתוך-החדר. עיגון = (W/2, 0). קיר בתחתית, חדר למעלה.
// ===========================================================================
function wallBand(W, dm) {           // רמז-קיר (פושה) קל משני צדי הפתח + פני-קיר
  const over = Math.max(120, W * 0.18);
  return [
    L(-over, 0, 0, 0, 'SOL-KIROT'), L(W, 0, W + over, 0, 'SOL-KIROT'),
    L(-over, dm.wallThk, 0, dm.wallThk, 'SOL-KIROT'), L(W, dm.wallThk, W + over, dm.wallThk, 'SOL-KIROT'),
    L(-over, 0, -over, dm.wallThk, 'SOL-KIROT'), L(W + over, 0, W + over, dm.wallThk, 'SOL-KIROT'),
  ];
}
function doorPlan(def, dm, cfg) {
  const W = dm.w, tw = dm.wallThk, lt = dm.leafThk;
  const L_ = cfg.hingeSide !== 'R';
  const out = wallBand(W, dm);
  // אבני-סף / משקוף בשני קצות-הפתח (פני-הקיר לתוך-הפתח)
  out.push(L(0, 0, 0, tw, 'SOL-PTACHIM'), L(W, 0, W, tw, 'SOL-PTACHIM'));
  const hx = L_ ? 0 : W;                       // ציר
  const leafW = W;                             // אורך-כנף ≈ רוחב-הפתח
  const sIn = (cfg.swing === 'out') ? -1 : 1;  // פנימה=+ (לתוך-החדר), החוצה=-
  const yPivot = sIn > 0 ? tw : 0;             // הכנף יוצאת מפני-הקיר הרלוונטי
  // כנף פתוחה 90° כמלבן-דק
  const dir = L_ ? 1 : -1;
  const x0 = hx, x1 = hx + dir * lt;
  const yTip = yPivot + sIn * leafW;
  out.push(R(Math.min(x0, x1), Math.min(yPivot, yTip), Math.max(x0, x1), Math.max(yPivot, yTip), 'SOL-PTACHIM-DOOR', { leaf: true }));
  // קשת-רבע: מרכז=(hx,yPivot), R=leafW. מקצה-הכנף אל המשקוף-הנגדי.
  let a0, a1;
  if (L_ && sIn > 0) { a0 = 0; a1 = 90; }
  else if (!L_ && sIn > 0) { a0 = 90; a1 = 180; }
  else if (L_ && sIn < 0) { a0 = -90; a1 = 0; }
  else { a0 = 180; a1 = 270; }
  out.push(A(hx, yPivot, leafW, a0, a1, 'SOL-PTACHIM-DOOR'));
  return out;
}
function slidingPlan(def, dm) {
  const W = dm.w, tw = dm.wallThk, mid = tw / 2;
  const out = wallBand(W, dm);
  out.push(L(0, 0, 0, tw, 'SOL-PTACHIM'), L(W, 0, W, tw, 'SOL-PTACHIM'));
  // מסילה + שתי כנפיים חופפות
  out.push(L(0, mid, W, mid, 'SOL-KIROT-MILUY'));
  out.push(R(0.02 * W, mid - 22, 0.54 * W, mid - 6, 'SOL-PTACHIM'));
  out.push(R(0.46 * W, mid + 6, 0.98 * W, mid + 22, 'SOL-PTACHIM', { dash: true }));
  arrow(out, 0.72 * W, mid, 'right', 60, 'SOL-PTACHIM-DOOR');
  return out;
}
function pocketPlan(def, dm) {
  const W = dm.w, tw = dm.wallThk, mid = tw / 2;
  const out = wallBand(W, dm);
  out.push(L(0, 0, 0, tw, 'SOL-PTACHIM'));
  out.push(L(0, mid, W, mid, 'SOL-KIROT-MILUY'));
  out.push(R(0.06 * W, mid - 18, 0.5 * W, mid + 18, 'SOL-PTACHIM'));         // כנף חשופה
  out.push(R(0.5 * W, mid - 18, 0.98 * W, mid + 18, 'SOL-PTACHIM', { dash: true })); // כיס בקיר
  arrow(out, 0.62 * W, mid, 'right', 55, 'SOL-PTACHIM-DOOR');
  return out;
}
function foldingPlan(def, dm) {
  const W = dm.w, tw = dm.wallThk;
  const out = wallBand(W, dm);
  out.push(L(0, 0, 0, tw, 'SOL-PTACHIM'), L(W, 0, W, tw, 'SOL-PTACHIM'));
  const n = 4, seg = W / n, amp = seg * 0.9;
  const pts = [0, tw];
  for (let i = 0; i < n; i++) { pts.push((i + 0.5) * seg, tw + amp * (i % 2 ? -0.15 : 1)); pts.push((i + 1) * seg, tw); }
  out.push(P(pts, 'SOL-PTACHIM-DOOR'));
  return out;
}
function windowPlan(def, dm, cfg) {
  const W = dm.w, tw = dm.wallThk;
  const out = wallBand(W, dm);
  const g = tw * 0.16, mid = tw / 2;
  // מסגרת flush לשתי הפאות + זוג קווי-זיגוג במרכז (סמל-החלון הקלאסי)
  out.push(L(0, 0, 0, tw, 'SOL-PTACHIM'), L(W, 0, W, tw, 'SOL-PTACHIM'));
  out.push(L(0, mid - g, W, mid - g, 'SOL-PTACHIM'), L(0, mid + g, W, mid + g, 'SOL-PTACHIM'));
  if (cfg.openMode === 'sliding') {
    out.push(R(0.02 * W, mid - g, 0.52 * W, mid - 2, 'SOL-PTACHIM'));
    out.push(R(0.48 * W, mid + 2, 0.98 * W, mid + g, 'SOL-PTACHIM', { dash: true }));
    arrow(out, 0.75 * W, mid, 'right', 55, 'SOL-PTACHIM-DOOR');
  } else if (cfg.openMode === 'casement' || cfg.openMode === 'kip') {
    // רמז-סיבוב: קשת-רבע קלה לתוך-החדר מציר-שמאל
    out.push(A(0, tw, W * 0.5, 0, 90, 'SOL-PTACHIM-DOOR', { dash: true }));
  }
  return out;
}
function ventPlan(def, dm) {
  const W = dm.w, tw = dm.wallThk, lay = def.layers.primary;
  const out = wallBand(W, dm);
  const cx = W / 2, cy = tw / 2;
  const gl = def.glyph;
  if (gl === 'round') {
    out.push(C(cx, cy, Math.min(W, tw) * 0.38, lay), C(cx, cy, Math.min(W, tw) * 0.16, lay));
  } else if (gl === 'valve') {          // שסתום-הדף ממ״ד
    out.push(R(0.12 * W, 0.12 * tw, 0.88 * W, 0.88 * tw, lay, { wt: 1.6 }));
    out.push(C(cx, cy, Math.min(W, tw) * 0.3, lay));
    out.push(L(cx - Math.min(W, tw) * 0.22, cy - Math.min(W, tw) * 0.22, cx + Math.min(W, tw) * 0.22, cy + Math.min(W, tw) * 0.22, lay));
  } else if (gl === 'fan') {
    out.push(R(0.14 * W, 0.14 * tw, 0.86 * W, 0.86 * tw, lay), C(cx, cy, Math.min(W, tw) * 0.34, lay), C(cx, cy, 6, lay, { fill: true }));
    for (const a of [45, 135, 225, 315]) out.push(L(cx + 6 * Math.cos(deg(a)), cy + 6 * Math.sin(deg(a)), cx + Math.min(W, tw) * 0.32 * Math.cos(deg(a + 26)), cy + Math.min(W, tw) * 0.32 * Math.sin(deg(a + 26)), lay));
  } else { // grille / louver
    out.push(R(0.1 * W, 0.2 * tw, 0.9 * W, 0.8 * tw, lay));
    const n = 4; for (let i = 1; i <= n; i++) { const y = 0.2 * tw + (0.6 * tw) * i / (n + 1); out.push(L(0.1 * W, y, 0.9 * W, y + (gl === 'louver' ? 0.05 * tw : 0), lay)); }
  }
  return out;
}

// ===========================================================================
// גיאומטריית-חזית (ELEVATION)
//   מסגרת-מקומית: x∈[0..W], y=0 בסף/רצפה, y=H בראש-הפתח. עיגון = (W/2, 0).
//   מוסכמת-קליל: מסגרת חיצונית → מסגרת-כנף פנימית → חלוקת-חציצים → זיגוג →
//   ידית → סמל-כיוון-פתיחה (chevron מקווקו, קודקוד בצד-הציר) → סף/מפתן.
// ===========================================================================
function frameRects(W, H, fr, lay) {
  return [ R(0, 0, W, H, lay, { wt: 1.4 }), R(fr, fr, W - fr, H - fr, lay) ];
}
function glassHatch(x0, y0, x1, y1, lay) {   // רמז-זכוכית: אלכסון קל בפינה
  const dx = (x1 - x0), dy = (y1 - y0), s = Math.min(dx, dy) * 0.5;
  return [ L(x0 + dx * 0.12, y1 - dy * 0.12, x0 + dx * 0.12 + s, y1 - dy * 0.12 - s, lay, { thin: true }),
           L(x0 + dx * 0.24, y1 - dy * 0.12, x0 + dx * 0.24 + s, y1 - dy * 0.12 - s, lay, { thin: true }) ];
}
function chevron(out, x0, x1, y0, y1, apex, lay) {
  // apex: 'L'|'R'|'T'|'B' — קודקוד-הפתיחה (מסמן ציר/כיוון). קווים מקווקווים.
  const opt = { dash: true, thin: true };
  if (apex === 'L') { out.push(L(x1, y0, x0, (y0 + y1) / 2, lay, opt), L(x1, y1, x0, (y0 + y1) / 2, lay, opt)); }
  else if (apex === 'R') { out.push(L(x0, y0, x1, (y0 + y1) / 2, lay, opt), L(x0, y1, x1, (y0 + y1) / 2, lay, opt)); }
  else if (apex === 'T') { out.push(L(x0, y0, (x0 + x1) / 2, y1, lay, opt), L(x1, y0, (x0 + x1) / 2, y1, lay, opt)); }
  else { out.push(L(x0, y1, (x0 + x1) / 2, y0, lay, opt), L(x1, y1, (x0 + x1) / 2, y0, lay, opt)); }
}
function handle(out, x, y, lay) { out.push(C(x, y, 22, lay), L(x, y - 55, x, y + 55, lay, { thin: true })); }

function doorElev(def, dm, cfg) {
  const W = dm.w, H = dm.h, fr = dm.frameThk;
  const lay = 'SOL-PTACHIM';
  const out = frameRects(W, H, fr, lay);
  const leaves = cfg.leafCount || 1;
  const leafW = (W - 2 * fr) / leaves;
  const handleY = Math.min(1050, H * 0.5);
  for (let i = 0; i < leaves; i++) {
    const lx0 = fr + i * leafW, lx1 = lx0 + leafW;
    if (leaves > 1 && i > 0) out.push(L(lx0, fr, lx0, H - fr, lay)); // חציץ בין כנפיים
    // כנף — מלבן פנימי עם רווח-רה-וייל קטן
    const g = 18;
    out.push(R(lx0 + g, fr + g, lx1 - g, H - fr - g, lay, { thin: true }));
    // זיגוג (חלון-ראייה) לדלת מזוגגת
    if (cfg.glazing && cfg.glazing !== 'none') {
      const gy0 = cfg.glazing === 'full' ? fr + 3 * g : H * 0.52;
      const gy1 = H - fr - 3 * g;
      out.push(R(lx0 + 3 * g, gy0, lx1 - 3 * g, gy1, lay, { thin: true }));
      out.push(...glassHatch(lx0 + 3 * g, gy0, lx1 - 3 * g, gy1, lay));
    }
    // ידית
    const hSideRight = (cfg.hingeSide !== 'R');           // ציר-שמאל → ידית-ימין
    const hx = hSideRight ? lx1 - g - 45 : lx0 + g + 45;
    if (leaves === 1) handle(out, hx, handleY, 'SOL-PTACHIM-DOOR');
    // chevron כיוון-פתיחה (קודקוד בצד-הציר)
    const apex = (cfg.hingeSide === 'R') ? 'R' : 'L';
    if (cfg.openMode === 'hinged' || cfg.openMode === 'double')
      chevron(out, lx0 + g, lx1 - g, fr + g, H - fr - g, leaves > 1 ? (i === 0 ? 'L' : 'R') : apex, 'SOL-PTACHIM-DOOR');
  }
  if (cfg.openMode === 'sliding' || cfg.openMode === 'pocket') {
    arrow(out, W * 0.62, H * 0.5, 'right', 90, 'SOL-PTACHIM-DOOR');
    out.push(L(fr, H - fr - 6, W - fr, H - fr - 6, lay, { dash: true }));
  }
  // מפתן / סף
  out.push(L(0, 0, W, 0, def.mamad ? 'SOL-KIROT' : 'SOL-PTACHIM', { wt: 1.5 }));
  if (def.mamad) out.push(T(W / 2, H * 0.5, 'ממ״ד', 130, 'SOL-TEKST'));
  return out;
}
function windowElev(def, dm, cfg) {
  const W = dm.w, H = dm.h, fr = dm.frameThk;
  const lay = 'SOL-PTACHIM';
  const out = [];
  // ארגז-תריס (אופציונלי) מעל הפתח — מוסכמת-קליל
  if (cfg.shutterBox) {
    const bh = Math.max(200, H * 0.14);
    out.push(R(0, H, W, H + bh, lay));
    for (let i = 1; i <= 4; i++) out.push(L(0, H + bh * i / 5, W, H + bh * i / 5, lay, { thin: true }));
  }
  out.push(...frameRects(W, H, fr, lay));
  const cols = Math.max(1, cfg.leafCount || 1);
  const sashW = (W - 2 * fr) / cols;
  for (let i = 0; i < cols; i++) {
    const sx0 = fr + i * sashW, sx1 = sx0 + sashW;
    if (i > 0) out.push(L(sx0, fr, sx0, H - fr, lay));          // חציץ אנכי
    const g = 16;
    out.push(R(sx0 + g, fr + g, sx1 - g, H - fr - g, lay, { thin: true })); // מסגרת-כנף
    out.push(...glassHatch(sx0 + g, fr + g, sx1 - g, H - fr - g, lay));
    // סמל-כיוון-פתיחה
    const apexBy = { casement: (cfg.hingeSide === 'R' ? 'R' : 'L'), kip: (cfg.hingeSide === 'R' ? 'R' : 'L'),
      awning: 'T', tilt: 'T', hopper: 'B' }[cfg.openMode];
    if (apexBy) chevron(out, sx0 + g, sx1 - g, fr + g, H - fr - g, apexBy, 'SOL-PTACHIM-DOOR');
    if (cfg.openMode === 'kip') chevron(out, sx0 + g, sx1 - g, fr + g, H - fr - g, 'T', 'SOL-PTACHIM-DOOR');
    if (cfg.openMode === 'sliding') arrow(out, (sx0 + sx1) / 2, H * 0.5, i ? 'right' : 'left', 70, 'SOL-PTACHIM-DOOR');
    if (cfg.openMode === 'hung') { arrow(out, (sx0 + sx1) / 2, H * 0.66, 'up', 50, 'SOL-PTACHIM-DOOR'); arrow(out, (sx0 + sx1) / 2, H * 0.34, 'down', 50, 'SOL-PTACHIM-DOOR'); }
  }
  if (['casement', 'kip', 'awning', 'hung', 'fixed'].includes(cfg.openMode)) handle(out, W * 0.5, H * 0.5, 'SOL-PTACHIM-DOOR');
  // מסגרת-הדף עבה לחלון-ממ״ד
  if (def.mamad) { out.push(R(-fr * 0.5, -fr * 0.5, W + fr * 0.5, H + fr * 0.5, 'SOL-KIROT', { wt: 1.8 })); out.push(T(W / 2, H * 0.5, 'ממ״ד', 120, 'SOL-TEKST')); }
  // סף (subsill) בולט מתחת
  out.push(L(-fr, 0, W + fr, 0, lay, { wt: 1.5 }));
  return out;
}
function ventElev(def, dm) {
  // חזית-איוורור = מבט-חזית של הסמל (זהה למהות-התוכנית אך במסגרת חזית).
  const W = dm.w, H = dm.h || dm.w, lay = def.layers.primary, gl = def.glyph;
  const out = [];
  const cx = W / 2, cy = H / 2, rr = Math.min(W, H) * 0.4;
  if (gl === 'round') { out.push(C(cx, cy, rr, lay), C(cx, cy, rr * 0.42, lay)); arrow(out, cx, cy + rr * 0.5, 'up', rr * 0.3, lay); }
  else if (gl === 'valve') { out.push(R(0.08 * W, 0.08 * H, 0.92 * W, 0.92 * H, lay, { wt: 1.6 }), C(cx, cy, rr * 0.75, lay), L(cx - rr * 0.5, cy - rr * 0.5, cx + rr * 0.5, cy + rr * 0.5, lay)); }
  else if (gl === 'fan') { out.push(R(0.12 * W, 0.12 * H, 0.88 * W, 0.88 * H, lay), C(cx, cy, rr, lay), C(cx, cy, 6, lay, { fill: true })); for (const a of [45, 135, 225, 315]) out.push(L(cx, cy, cx + rr * 0.9 * Math.cos(deg(a + 26)), cy + rr * 0.9 * Math.sin(deg(a + 26)), lay)); }
  else { out.push(R(0.08 * W, 0.16 * H, 0.92 * W, 0.84 * H, lay)); const n = 5; for (let i = 1; i <= n; i++) { const y = 0.16 * H + 0.68 * H * i / (n + 1); out.push(L(0.08 * W, y, 0.92 * W, y + (gl === 'louver' ? 0.05 * H : 0), lay)); } }
  return out;
}
function arrow(out, x, y, dir, s, lay) {
  const m = { up: [[-0.4, 0.6], [0, 0], [0.4, 0.6]], down: [[-0.4, -0.6], [0, 0], [0.4, -0.6]], left: [[0.6, -0.4], [0, 0], [0.6, 0.4]], right: [[-0.6, -0.4], [0, 0], [-0.6, 0.4]] }[dir];
  const tail = { up: [0, -s], down: [0, s], left: [s, 0], right: [-s, 0] }[dir];
  out.push(L(x + tail[0], y + tail[1], x, y, lay, { thin: true }));
  out.push(P([x + m[0][0] * s, y + m[0][1] * s, x + m[1][0] * s, y + m[1][1] * s, x + m[2][0] * s, y + m[2][1] * s], lay, { thin: true }));
}

// ===========================================================================
// שיגור לפי טיפוס
// ===========================================================================
function planPrimitives(def, dm, cfg) {
  if (def.family === 'vent') return ventPlan(def, dm);
  if (def.kind === 'window') return windowPlan(def, dm, cfg);
  switch (cfg.openMode) {
    case 'sliding': return slidingPlan(def, dm);
    case 'pocket':  return pocketPlan(def, dm);
    case 'folding': return foldingPlan(def, dm);
    default:        return doorPlan(def, dm, cfg);
  }
}
function elevPrimitives(def, dm, cfg) {
  if (def.family === 'vent') return ventElev(def, dm);
  if (def.kind === 'window') return windowElev(def, dm, cfg);
  return doorElev(def, dm, cfg);
}

// ===========================================================================
// הקטלוג — כל טיפוסי-הפתח (key · שם-בלוק · מידות-אמת · פרמטרים · שכבות · עיגון)
//   שמות-בלוק במרחב-השם של Soline: SL_OPN_* (מקורי; אינו שם-קליל).
//   מידות-אמת מ-docs/DOORS_WINDOWS_SIZES.md (עובדות-יצרן/תקן, לא קובץ-קליל).
// ===========================================================================
const DOOR_LAYERS = { primary: 'SOL-PTACHIM', swing: 'SOL-PTACHIM-DOOR', text: 'SOL-TEKST', dim: 'SOL-MIDOT-PNIM' };
const WIN_LAYERS  = { primary: 'SOL-PTACHIM', swing: 'SOL-PTACHIM-DOOR', text: 'SOL-TEKST', dim: 'SOL-MIDOT-PNIM' };
const VENT_LAYERS = { primary: 'SOL-MIZUG', text: 'SOL-TEKST', dim: 'SOL-MIDOT-PNIM' };

// פרמטרים משותפים (החוזה מ-OPENING_ELEMENT_SCHEMA §geom/config)
function doorParams(over) {
  return Object.assign({
    width:   { type: 'number', min: 600, max: 3000, step: 10 },
    height:  { type: 'number', min: 1800, max: 2600, step: 10 },
    wallThickness: { type: 'number', min: 70, max: 400, value: 100 },
    frameThickness:{ type: 'number', min: 30, max: 120, value: 45 },
    leafThickness: { type: 'number', min: 30, max: 80, value: 40 },
    openMode:  { type: 'enum', options: ['hinged', 'sliding', 'folding', 'pocket', 'double', 'fixed'] },
    hingeSide: { type: 'enum', options: ['L', 'R'] },
    swing:     { type: 'enum', options: ['in', 'out'] },
    leafCount: { type: 'integer', min: 1, max: 4, value: 1 },
    glazing:   { type: 'enum', options: ['none', 'partial', 'full'] },
  }, over || {});
}
function winParams(over) {
  return Object.assign({
    width:   { type: 'number', min: 300, max: 3000, step: 10 },
    height:  { type: 'number', min: 300, max: 2600, step: 10 },
    sillHeight: { type: 'number', min: 0, max: 1500, value: 900 },
    wallThickness: { type: 'number', min: 70, max: 400, value: 100 },
    frameThickness:{ type: 'number', min: 40, max: 120, value: 50 },
    openMode:  { type: 'enum', options: ['fixed', 'casement', 'kip', 'awning', 'hopper', 'sliding', 'hung'] },
    hingeSide: { type: 'enum', options: ['L', 'R'] },
    leafCount: { type: 'integer', min: 1, max: 4, value: 1 },
    shutterBox:{ type: 'boolean', value: false },
  }, over || {});
}
function ventParams(round) {
  return round
    ? { diameter: { type: 'number', min: 60, max: 250, step: 5 }, wallThickness: { type: 'number', min: 70, max: 400, value: 200 } }
    : { width: { type: 'number', min: 100, max: 800, step: 10 }, height: { type: 'number', min: 100, max: 800, step: 10 }, wallThickness: { type: 'number', min: 70, max: 400, value: 200 } };
}

function D(kind, family, key, block, he, en, dims, config, extra) {
  return Object.assign({
    kind, family, key, blockName: block, hebrewName: he, englishName: en, dims,
    config: config || {}, mamad: /ממ.?ד/.test(he),
    layers: kind === 'window' ? WIN_LAYERS : (family === 'vent' ? VENT_LAYERS : DOOR_LAYERS),
    insertion: {
      plan:  { anchor: 'opening-centre-outerface', at: [0, 0], rotationRule: 'wall-aligned', wallSide: 'either' },
      elev:  { anchor: 'bottom-centre', at: [0, 0], floorAtY0: true },
    },
    views: family === 'vent' ? ['plan', 'elev'] : ['plan', 'elev'],
  }, extra || {});
}

// שמות מקוריים בלעדית ל-Soline. מפתח (key) = SOL-<FAMILY>-<TYPE>[-<HAND>] ·
// שם-בלוק = SL_OPN_<...>. אין שם/סדרה/מק"ט של יצרן כלשהו בשום מזהה. שמות-יצרן
// מופיעים אך-ורק כהערת-פרובננס עובדתית (provenance) בפרוזה (למשל "מידות תואמות תקן קליל").
const CATALOG = [
  // ---- דלתות (חזית: מסגרת→כנף→חציץ→זיגוג→ידית; תוכנית: משקוף→כנף→קשת-רבע ISO-128) ----
  D('door', 'door', 'SOL-DOOR-HINGED-L', 'SL_OPN_DOOR_HINGED_L', 'דלת-פנים ציר-שמאל', 'Interior door, left hinge',
    { w: 900, h: 2050, d: 100, frameThk: 45, leafThk: 40 }, { openMode: 'hinged', hingeSide: 'L', swing: 'in', leafCount: 1, glazing: 'none' },
    { params: doorParams({ hingeSide: { type: 'enum', options: ['L', 'R'], value: 'L' } }) }),
  D('door', 'door', 'SOL-DOOR-HINGED-R', 'SL_OPN_DOOR_HINGED_R', 'דלת-פנים ציר-ימין', 'Interior door, right hinge',
    { w: 900, h: 2050, d: 100, frameThk: 45, leafThk: 40 }, { openMode: 'hinged', hingeSide: 'R', swing: 'in', leafCount: 1, glazing: 'none' },
    { params: doorParams({ hingeSide: { type: 'enum', options: ['L', 'R'], value: 'R' } }) }),
  D('door', 'door', 'SOL-DOOR-ENTRANCE', 'SL_OPN_DOOR_ENTRANCE', 'דלת-כניסה / פלדלת', 'Entrance / steel security door',
    { w: 1000, h: 2100, d: 120, frameThk: 60, leafThk: 60 }, { openMode: 'hinged', hingeSide: 'R', swing: 'in', leafCount: 1, glazing: 'none' },
    { params: doorParams(), provenance: 'מידות תואמות פתח-בנייה תקני לפלדלת (100×210)' }),
  D('door', 'door', 'SOL-DOOR-DOUBLE', 'SL_OPN_DOOR_DOUBLE', 'דלת דו-כנפית', 'Double-leaf door',
    { w: 1800, h: 2100, d: 100, frameThk: 50, leafThk: 40 }, { openMode: 'double', hingeSide: 'L', swing: 'in', leafCount: 2, glazing: 'partial' },
    { params: doorParams({ leafCount: { type: 'integer', min: 2, max: 2, value: 2 } }), provenance: 'מידות תואמות דלת דו-כנפית ~180×210 ס״מ' }),
  D('door', 'door', 'SOL-DOOR-SLIDING', 'SL_OPN_DOOR_SLIDING', 'דלת-הזזה / מרפסת', 'Sliding / patio door',
    { w: 1800, h: 2100, d: 120, frameThk: 55, leafThk: 40 }, { openMode: 'sliding', leafCount: 2, glazing: 'full' },
    { params: doorParams({ openMode: { type: 'enum', options: ['sliding'], value: 'sliding' } }) }),
  D('door', 'door', 'SOL-DOOR-POCKET', 'SL_OPN_DOOR_POCKET', 'דלת-כיס', 'Pocket door',
    { w: 900, h: 2100, d: 100, frameThk: 45, leafThk: 40 }, { openMode: 'pocket', leafCount: 1, glazing: 'none' },
    { params: doorParams({ openMode: { type: 'enum', options: ['pocket'], value: 'pocket' } }) }),
  D('door', 'door', 'SOL-DOOR-FOLDING', 'SL_OPN_DOOR_FOLDING', 'דלת מתקפלת (אקורדיון)', 'Folding / accordion door',
    { w: 900, h: 2050, d: 100, frameThk: 45, leafThk: 30 }, { openMode: 'folding', leafCount: 4, glazing: 'none' },
    { params: doorParams({ openMode: { type: 'enum', options: ['folding'], value: 'folding' }, leafCount: { type: 'integer', min: 2, max: 6, value: 4 } }) }),
  D('door', 'door', 'SOL-DOOR-MAMAD', 'SL_OPN_DOOR_MAMAD', 'דלת ממ״ד (הדף)', 'Blast (protected-space) door',
    { w: 800, h: 2000, d: 200, frameThk: 80, leafThk: 60 }, { openMode: 'hinged', hingeSide: 'R', swing: 'out', leafCount: 1, glazing: 'none' },
    { params: doorParams(), provenance: 'תקן פיקוד-העורף (פתח-מגורים 80×200)' }),
  D('door', 'door', 'SOL-DOOR-CONCEALED-L', 'SL_OPN_DOOR_CONCEALED_L', 'דלת נסתרת (חלקה)', 'Concealed / flush door',
    { w: 800, h: 2100, d: 100, frameThk: 40, leafThk: 40 }, { openMode: 'hinged', hingeSide: 'L', swing: 'in', leafCount: 1, glazing: 'none' },
    { params: doorParams(), dashArc: true }),

  // ---- חלונות (חזית: מסגרת→חציץ→זיגוג→סמל-כיוון→ארגז-תריס; תוכנית: סמל 4-קווי) ----
  D('window', 'window', 'SOL-WIN-FIXED', 'SL_OPN_WIN_FIXED', 'חלון קבוע (כללי)', 'Fixed window',
    { w: 1200, h: 1200, d: 100, frameThk: 50, sill: 900 }, { openMode: 'fixed', leafCount: 2, glazing: 'full' },
    { params: winParams() }),
  D('window', 'window', 'SOL-WIN-CASEMENT-L', 'SL_OPN_WIN_CASEMENT_L', 'חלון-ציר', 'Casement window',
    { w: 800, h: 1200, d: 100, frameThk: 50, sill: 900 }, { openMode: 'casement', hingeSide: 'L', leafCount: 1, glazing: 'full' },
    { params: winParams(), provenance: 'מידות תואמות כנף-ציר תקנית (~80×120–140)' }),
  D('window', 'window', 'SOL-WIN-TILTTURN-L', 'SL_OPN_WIN_TILTTURN_L', 'חלון קיפ (דריי-קיפ)', 'Tilt-turn window',
    { w: 800, h: 1400, d: 100, frameThk: 50, sill: 900 }, { openMode: 'kip', hingeSide: 'L', leafCount: 1, glazing: 'full' },
    { params: winParams(), provenance: 'מידות תואמות כנף דריי-קיפ תקנית (~80×140)' }),
  D('window', 'window', 'SOL-WIN-AWNING', 'SL_OPN_WIN_AWNING', 'חלון-מדף עליון', 'Awning / top-hung window',
    { w: 800, h: 600, d: 100, frameThk: 50, sill: 1400 }, { openMode: 'awning', leafCount: 1, glazing: 'full' },
    { params: winParams() }),
  D('window', 'window', 'SOL-WIN-SLIDING', 'SL_OPN_WIN_SLIDING', 'חלון-הזזה', 'Sliding window',
    { w: 1500, h: 1200, d: 100, frameThk: 50, sill: 900 }, { openMode: 'sliding', leafCount: 2, glazing: 'full' },
    { params: winParams(), provenance: 'מידות תואמות חלון-הזזה 2-כנפי נפוץ (~150×120)' }),
  D('window', 'window', 'SOL-WIN-HUNG', 'SL_OPN_WIN_HUNG', 'חלון גיליון', 'Double-hung window',
    { w: 900, h: 1400, d: 100, frameThk: 50, sill: 900 }, { openMode: 'hung', leafCount: 1, glazing: 'full' },
    { params: winParams() }),
  D('window', 'window', 'SOL-WIN-MAMAD', 'SL_OPN_WIN_MAMAD', 'חלון ממ״ד (הדף)', 'Blast (protected-space) window',
    { w: 1000, h: 1000, d: 300, frameThk: 80, sill: 900 }, { openMode: 'casement', hingeSide: 'L', leafCount: 1, glazing: 'full' },
    { params: winParams(), provenance: 'תקן פיקוד-העורף / ת״י (פתח 100×100)' }),
  D('window', 'window', 'SOL-WIN-STOREFRONT', 'SL_OPN_WIN_STOREFRONT', 'ויטרינה / חלון-ראווה', 'Storefront / display window',
    { w: 2000, h: 2400, d: 120, frameThk: 60, sill: 0 }, { openMode: 'fixed', leafCount: 3, glazing: 'full' },
    { params: winParams() }),
  D('window', 'window', 'SOL-WIN-SMALL', 'SL_OPN_WIN_SMALL', 'חלונית / צוהר', 'Small window / vent light',
    { w: 500, h: 500, d: 100, frameThk: 40, sill: 1500 }, { openMode: 'awning', leafCount: 1, glazing: 'full' },
    { params: winParams() }),

  // ---- מיזוג / איוורור (סמלי-Soline מקוריים; ללא מקור-יצרן כלשהו) -------------
  D('vent', 'vent', 'SOL-VENT-MAMAD-VALVE', 'SL_OPN_VENT_MAMAD_VALVE', 'פתח-אוויר ממ״ד + שסתום-הדף', 'MAMAD air valve (blast damper)',
    { w: 250, h: 250, d: 300 }, {}, { glyph: 'valve', params: ventParams(false), provenance: 'ת״י 4910 (חובה בכל ממ״ד)' }),
  D('vent', 'vent', 'SOL-VENT-GRILLE', 'SL_OPN_VENT_GRILLE', 'שבכת-איוורור', 'Ventilation grille',
    { w: 200, h: 200, d: 60 }, {}, { glyph: 'grille', params: ventParams(false) }),
  D('vent', 'vent', 'SOL-VENT-LOUVER', 'SL_OPN_VENT_LOUVER', 'תריס-איוורור חיצוני (ז׳לוזי)', 'External wall louver',
    { w: 300, h: 300, d: 60 }, {}, { glyph: 'louver', params: ventParams(false) }),
  D('vent', 'vent', 'SOL-VENT-EXHAUST-FAN', 'SL_OPN_VENT_EXHAUST_FAN', 'מאוורר-יניקה (ונטה)', 'Exhaust fan',
    { w: 250, h: 250, d: 150 }, {}, { glyph: 'fan', params: ventParams(false) }),
  D('vent', 'vent', 'SOL-VENT-HOOD-DUCT', 'SL_OPN_VENT_HOOD_DUCT', 'תעלת-מנדף (קולט-אדים)', 'Range-hood duct',
    { w: 150, h: 150, d: 300 }, {}, { glyph: 'round', params: ventParams(true) }),
  D('vent', 'vent', 'SOL-VENT-DRYER', 'SL_OPN_VENT_DRYER', 'פתח מייבש-כביסה', 'Dryer vent',
    { w: 110, h: 110, d: 300 }, {}, { glyph: 'round', params: ventParams(true) }),
  D('vent', 'vent', 'SOL-VENT-BOILER-FLUE', 'SL_OPN_VENT_BOILER_FLUE', 'ארובת-דוד / מפלט-בעירה', 'Boiler flue',
    { w: 130, h: 130, d: 300 }, {}, { glyph: 'round', params: ventParams(true) }),
  D('vent', 'vent', 'SOL-VENT-CHIMNEY-FLUE', 'SL_OPN_VENT_CHIMNEY_FLUE', 'ארובה / מפלט-עשן (קמין)', 'Chimney flue',
    { w: 200, h: 200, d: 300 }, {}, { glyph: 'round', params: ventParams(true) }),
  D('vent', 'vent', 'SOL-VENT-FRESH-AIR', 'SL_OPN_VENT_FRESH_AIR', 'פתח אוויר-צח / מסנן', 'Fresh-air intake',
    { w: 200, h: 200, d: 150 }, {}, { glyph: 'grille', params: ventParams(false) }),
  D('vent', 'vent', 'SOL-VENT-AC-SLEEVE', 'SL_OPN_VENT_AC_SLEEVE', 'שרוול-מזגן / מעבר-צנרת', 'AC sleeve / pipe pass-through',
    { w: 110, h: 110, d: 300 }, {}, { glyph: 'round', params: ventParams(true) }),
];

function byKey(k) { return CATALOG.find((d) => d.key === k) || null; }

// ---------------------------------------------------------------------------
// bbox + מפמ״ר (manifest) — לתיעוד ולתצוגה
// ---------------------------------------------------------------------------
function bboxOf(prims) {
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  const acc = (x, y) => { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; };
  for (const p of prims) {
    if (p.t === 'line') { acc(p.x1, p.y1); acc(p.x2, p.y2); }
    else if (p.t === 'rect') { acc(p.x0, p.y0); acc(p.x1, p.y1); }
    else if (p.t === 'circle') { acc(p.cx - p.r, p.cy - p.r); acc(p.cx + p.r, p.cy + p.r); }
    else if (p.t === 'arc') {
      let a0 = p.a0, a1 = p.a1; if (a1 < a0) { const tmp = a0; a0 = a1; a1 = tmp; }
      acc(p.cx + p.r * Math.cos(deg(p.a0)), p.cy + p.r * Math.sin(deg(p.a0)));
      acc(p.cx + p.r * Math.cos(deg(p.a1)), p.cy + p.r * Math.sin(deg(p.a1)));
      for (let k = -360; k <= 720; k += 90) if (k > a0 && k < a1) acc(p.cx + p.r * Math.cos(deg(k)), p.cy + p.r * Math.sin(deg(k)));
    }
    else if (p.t === 'poly') { for (let i = 0; i < p.pts.length; i += 2) acc(p.pts[i], p.pts[i + 1]); }
    else if (p.t === 'label') acc(p.cx, p.cy);
  }
  return { mnx, mny, mxx, mxy, w: mxx - mnx, h: mxy - mny };
}

function manifest() {
  return {
    module: 'Soline Openings', version: '0.1.0', date: '2026-08-23', units: 'mm',
    source: 'Klil Belgian-Plus dynamic template (convention+dimensions, explicit owner permission) + Soline internal specs. Original geometry — no Klil linework/blocks/names/layers embedded.',
    layers: LAYERS,
    approval: 'PENDING owner sign-off',
    types: CATALOG.map((def) => {
      const dm = resolveDims(def), cfg = cfgFor(def);
      const plan = planPrimitives(def, dm, cfg), elev = elevPrimitives(def, dm, cfg);
      return {
        key: def.key, blockName: def.blockName, kind: def.kind, family: def.family,
        hebrewName: def.hebrewName, englishName: def.englishName, mamad: !!def.mamad,
        dims: dm, config: cfg, layers: def.layers, insertion: def.insertion, views: def.views,
        params: Object.keys(def.params || {}),
        provenance: def.provenance || null,
        planBbox: bboxOf(plan), elevBbox: bboxOf(elev),
        counts: { plan: plan.length, elev: elev.length },
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// SVG (תצוגה מקדימה) — ממפה מ״מ→px, y מתהפך (מעלה=+). קיר בתחתית בתוכנית.
// ---------------------------------------------------------------------------
function svgFor(prims, opt) {
  opt = opt || {};
  const pad = opt.pad == null ? 90 : opt.pad;
  const b = bboxOf(prims);
  if (!isFinite(b.w) || b.w <= 0) { b.mnx = 0; b.mny = 0; b.w = 100; b.h = 100; }
  const W = b.w + pad * 2, H = b.h + pad * 2;
  const X = (x) => (x - b.mnx + pad).toFixed(1);
  const Y = (y) => (H - (y - b.mny + pad)).toFixed(1);       // flip: +Y up
  const wpx = (p) => {
    const lay = LAYERS[p.layer] || { wt: 0.25 };
    let w = (p.wt ? p.wt : 1) * lay.wt * 3.2;                 // מ״מ-עובי → px
    if (p.thin) w *= 0.6;
    return Math.max(0.6, w).toFixed(2);
  };
  const col = (p) => (LAYERS[p.layer] || { hex: '#333' }).hex;
  const dashOf = (p) => (p.dash || (LAYERS[p.layer] && LAYERS[p.layer].dash)) ? ' stroke-dasharray="7 5"' : '';
  const scale = (b.w + b.h) / 2;                              // לכיול-רדיוס-קשת ב-px
  const parts = [`<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`];
  for (const p of prims) {
    const c = col(p), w = wpx(p), d = dashOf(p);
    if (p.t === 'line') parts.push(`<line x1="${X(p.x1)}" y1="${Y(p.y1)}" x2="${X(p.x2)}" y2="${Y(p.y2)}" stroke="${c}" stroke-width="${w}"${d} stroke-linecap="round"/>`);
    else if (p.t === 'rect') parts.push(`<rect x="${X(Math.min(p.x0, p.x1))}" y="${Y(Math.max(p.y0, p.y1))}" width="${Math.abs(p.x1 - p.x0).toFixed(1)}" height="${Math.abs(p.y1 - p.y0).toFixed(1)}" fill="${p.fill ? c : 'none'}" stroke="${c}" stroke-width="${w}"${d}/>`);
    else if (p.t === 'circle') parts.push(`<circle cx="${X(p.cx)}" cy="${Y(p.cy)}" r="${p.r.toFixed(1)}" fill="${p.fill ? c : 'none'}" stroke="${c}" stroke-width="${w}"${d}/>`);
    else if (p.t === 'arc') parts.push(arcPath(p, X, Y, c, w, d));
    else if (p.t === 'poly') { const pts = []; for (let i = 0; i < p.pts.length; i += 2) pts.push(`${X(p.pts[i])},${Y(p.pts[i + 1])}`); parts.push(`<poly${p.closed ? 'gon' : 'line'} points="${pts.join(' ')}" fill="${p.fill ? c : 'none'}" stroke="${c}" stroke-width="${w}"${d} stroke-linejoin="round"/>`); }
    else if (p.t === 'label') parts.push(`<text x="${X(p.cx)}" y="${Y(p.cy)}" font-size="${(p.h || 120) * 0.9}" fill="${col(p)}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif">${esc(p.text)}</text>`);
  }
  parts.push('</svg>');
  return parts.join('');
}
function arcPath(p, X, Y, c, w, d) {
  const x0 = p.cx + p.r * Math.cos(deg(p.a0)), y0 = p.cy + p.r * Math.sin(deg(p.a0));
  const x1 = p.cx + p.r * Math.cos(deg(p.a1)), y1 = p.cy + p.r * Math.sin(deg(p.a1));
  const large = Math.abs(p.a1 - p.a0) > 180 ? 1 : 0;
  // sweep in SVG (y-flipped): CCW math → clockwise screen → sweep-flag 0
  return `<path d="M ${X(x0)} ${Y(y0)} A ${p.r.toFixed(1)} ${p.r.toFixed(1)} 0 ${large} 0 ${X(x1)} ${Y(y1)}" fill="none" stroke="${c}" stroke-width="${w}"${d}/>`;
}
function esc(s) { return String(s).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }

module.exports = {
  LAYERS, CATALOG, byKey, resolveDims, cfgFor,
  planPrimitives, elevPrimitives, planPrimitives2: planPrimitives,
  svgFor, bboxOf, manifest,
};

// הרצה-ישירה: כתיבת manifest
if (require.main === module) {
  const fs = require('fs'), path = require('path');
  const out = path.join(__dirname, 'openings_manifest.json');
  fs.writeFileSync(out, JSON.stringify(manifest(), null, 2), 'utf8');
  console.log('wrote', out, '·', CATALOG.length, 'opening types');
}
