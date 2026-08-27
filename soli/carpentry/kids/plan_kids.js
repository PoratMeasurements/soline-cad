#!/usr/bin/env node
/*
 * plan_kids.js — Soline "Soli" Kids Room / Study-Unit Planning Module
 * ------------------------------------------------------------------
 * Turns a room MEASUREMENT (walls + services, from the Soline model) into
 * a carpenter's COMPOSITE KIDS UNIT along one wall, combining three zones:
 *
 *   [ WARDROBE zone ]  +  [ DESK / study zone ]  +  [ SHELVES / uppers ]
 *
 * Everything is sized for a CHILD and AGE-ADJUSTABLE (kids outgrow a fixed
 * desk height in ~3 years — the 90-90-90 ergonomics rule). A --age flag
 * maps to the worktop height. Anti-tip wall anchoring is MANDATORY.
 *
 * INPUT CONTRACT: identical to the Soli kitchen/wardrobe modules
 * (walls + fixtures); see ../_lib/carpentry_core.js.
 *
 * IP NOTE: Public standards (see STANDARDS.md) + Soline's own logic only.
 *
 * Usage:
 *   node plan_kids.js <room.ordx|room.json> [--age toddler|child|teen]
 *                     [--wall N] [--out DIR]
 *   node plan_kids.js                 (defaults to the allelem sample)
 *   node plan_kids.js --age teen
 * ------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../_lib/carpentry_core.js');

/* ==================================================================
 * 1. CATALOG / STANDARDS (mirrors MODULE_CATALOG.md). Dimensions in mm.
 * ================================================================== */
// Worktop height by age (public ergonomic charts) — ADJUSTABLE recommended.
//   3-6yr  ~600-650 · 6-10yr ~680 · teen 720-760.
const AGE_HEIGHT = { toddler: 620, child: 680, teen: 740 };
const AGE_LABEL  = { toddler: 'פעוט (3–6)', child: 'ילד (6–10)', teen: 'נער/ה (10+)' };

const WARDROBE_H = 2000;   // kids wardrobe height (2000, not the adult 2400)
const BODY_DEPTH = 550;    // kids carcass depth (hangers reach; < adult 600)
const DESK_DEPTH = 500;    // worktop depth (600-650 total incl. monitor)
const KNEE_MIN   = 550;    // minimum open knee clearance under the worktop
const KNEE_GOOD  = 600;    // comfortable seat width (kids desk 600-750)
const RAIL_H     = 1100;   // reachable single-hang rail (range 1000-1200)
const SHELF_LO   = 1150;   // open shelves above the desk start here
const SHELF_HI   = 1900;   // ...and stay within a child's reach
const SHELF_PITCH= 320;    // shelf spacing (~12")
const SAFE_SVC_H = 400;    // services below this = child-safety flag

const TOPBOX_MIN = 150;    // build a top-box only if this much room to ceiling

// Zone target widths (mm). Widths adapt to the available run.
const WARDROBE_ZONE = { min: 900,  target: 1400, max: 1600 };
const DESK_ZONE     = { min: 1000, target: 1100, max: 1300 };
const SHELF_ZONE_MIN= 400;

const BAY_WIDTHS      = [900, 800, 600, 500, 450, 400];  // KB wardrobe bays
const SHELF_WIDTHS    = [800, 600, 500, 400];            // KSH shelf towers
const DRW_W           = 450;   // KI-DRW low-drawer pedestal under the worktop
const MIN_RUN         = 900;   // below this the wall is too small for a unit
const MIN_FILLER      = 30;

// Wardrobe interior kinds (kids): single reachable rail + shelves (no adult double).
const KI = {
  RAIL: { code:'KI-RAIL', label:'מוט-תלייה נגיש', detail:`מוט יחיד @${RAIL_H} + מדף מעל` },
  SHF : { code:'KI-SHF',  label:'מדפים',          detail:`מרווח ~${SHELF_PITCH}` },
  DRW : { code:'KI-DRW',  label:'מגירות',          detail:'בנק מגירות נמוך' }
};
// Wardrobe fit-out rotation (mostly reachable hang, some shelving).
const WMIX = ['RAIL','SHF','RAIL','SHF','DRW'];

/* ==================================================================
 * 2. WALL SCORING — pick the wall that best hosts the composite unit.
 *    The binding constraint is a floor-standing run: doors and full-height
 *    beams split it; a HIGH window (sill ~900) does NOT — a window over the
 *    desk is natural light, not a conflict.
 * ================================================================== */
const FLOOR_BAND = [0, 300];  // what a floor-standing unit occupies at its base

function baseRun(analysis){
  const spans = C.bandSpans(analysis, FLOOR_BAND[0], FLOOR_BAND[1], MIN_FILLER);
  let best = null;
  for (const s of spans){ if (!best || (s.b - s.a) > (best.b - best.a)) best = s; }
  return { spans, best };
}

/* ==================================================================
 * 3. ZONE ALLOCATION — split the run into wardrobe + desk + shelves.
 *    Window-aware: if a window sits in the run, park the DESK under it and
 *    place the wardrobe on the larger clear side. Otherwise lay the zones
 *    sequentially (wardrobe · desk · shelves). Short runs prioritise
 *    wardrobe + desk; shelves are dropped first.
 * ================================================================== */
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function allocateZones(run, windows){
  const runW = run.b - run.a;
  const zones = [];              // {type, a, b, w}
  const notes = [];

  // -- window-aware path -------------------------------------------------
  const winIn = windows
    .map(w => (w.a + w.b) / 2)
    .filter(c => c > run.a && c < run.b);
  if (winIn.length && runW >= WARDROBE_ZONE.min + DESK_ZONE.min){
    const wc = winIn[0];
    let dz = clamp(DESK_ZONE.target, DESK_ZONE.min,
                   Math.min(DESK_ZONE.max, runW - WARDROBE_ZONE.min));
    let ds = clamp(wc - dz/2, run.a, run.b - dz);
    let de = ds + dz;
    let left = ds - run.a, right = run.b - de;
    // wardrobe on the larger clear side (needs its min), shelves on the other
    if (Math.max(left, right) >= WARDROBE_ZONE.min){
      const wOnLeft = left >= right;
      const wSide = wOnLeft ? left : right;
      let wz = clamp(WARDROBE_ZONE.target, WARDROBE_ZONE.min,
                     Math.min(WARDROBE_ZONE.max, wSide));
      if (wOnLeft){
        zones.push({ type:'wardrobe', a: run.a, b: run.a + wz });
        // nudge desk to butt the wardrobe if a gap remains
        ds = Math.max(ds, run.a + wz); de = ds + dz;
        zones.push({ type:'desk', a: ds, b: de });
        if (run.b - de >= SHELF_ZONE_MIN) zones.push({ type:'shelves', a: de, b: run.b });
        else if (run.b - de > 0) zones.push({ type:'filler', a: de, b: run.b });
      } else {
        if (ds - run.a >= SHELF_ZONE_MIN) zones.push({ type:'shelves', a: run.a, b: ds });
        else if (ds - run.a > 0) zones.push({ type:'filler', a: run.a, b: ds });
        zones.push({ type:'desk', a: ds, b: de });
        zones.push({ type:'wardrobe', a: run.b - wz, b: run.b });
        if (de < run.b - wz) zones.splice(zones.length-1, 0, { type:'filler', a: de, b: run.b - wz });
      }
      notes.push(`שולחן-הכתיבה מוקם תחת החלון (@${wc|0}) — אור טבעי.`);
      for (const z of zones) z.w = z.b - z.a;
      return { zones, notes };
    }
  }

  // -- sequential path: wardrobe · desk · shelves ------------------------
  let wz = clamp(WARDROBE_ZONE.target, Math.min(WARDROBE_ZONE.min, runW),
                 Math.min(WARDROBE_ZONE.max, runW));
  // shrink wardrobe so a desk fits, when the run allows both
  if (runW - wz < DESK_ZONE.min && runW >= WARDROBE_ZONE.min + DESK_ZONE.min){
    wz = Math.min(WARDROBE_ZONE.max, runW - DESK_ZONE.min);
  }
  let x = run.a;
  zones.push({ type:'wardrobe', a: x, b: x + wz }); x += wz;
  let rem = run.b - x;
  if (rem >= DESK_ZONE.min){
    const dz = clamp(DESK_ZONE.target, DESK_ZONE.min, Math.min(DESK_ZONE.max, rem));
    zones.push({ type:'desk', a: x, b: x + dz }); x += dz;
    rem = run.b - x;
    if (rem >= SHELF_ZONE_MIN) zones.push({ type:'shelves', a: x, b: run.b });
    else if (rem > 0) zones.push({ type:'filler', a: x, b: run.b });
  } else {
    if (rem >= SHELF_ZONE_MIN){ zones.push({ type:'shelves', a: x, b: run.b }); }
    else if (rem > 0) zones.push({ type:'filler', a: x, b: run.b });
    if (rem >= 0) notes.push('הריצה קצרה — הועדפו ארון + שולחן; אזור-מדפים צומצם/בוטל.');
  }
  for (const z of zones) z.w = z.b - z.a;
  return { zones, notes };
}

/* ==================================================================
 * 4. ZONE BUILD-OUT — fill each zone with Soli modules.
 * ================================================================== */
function buildWardrobe(zone){
  const bays = C.fillSegment(zone.w, BAY_WIDTHS, 'KB', { minFiller:MIN_FILLER, fillerPrefix:'KF' });
  C.layFrom(zone.a, bays);
  let i = 0;
  for (const bay of bays){
    if (bay.filler){ bay.fit = null; continue; }
    const kind = WMIX[i % WMIX.length]; i++;
    const f = KI[kind];
    bay.fit = { kind, code:f.code, label:f.label, detail:f.detail };
  }
  zone.bays = bays;
  return zone;
}

function buildDesk(zone, deskH){
  // worktop across the whole desk zone + one low drawer pedestal + open knee space
  zone.worktop = { code:`KDESK-${Math.round(zone.w)}`, w:Math.round(zone.w), h:deskH, depth:DESK_DEPTH };
  zone.drawer  = { code:'KI-DRW', w:DRW_W, label:'מגירה נמוכה' };
  zone.knee    = Math.round(zone.w - DRW_W);   // open leg space beside the pedestal
  return zone;
}

function buildShelves(zone){
  const towers = C.fillSegment(zone.w, SHELF_WIDTHS, 'KSH', { minFiller:MIN_FILLER, fillerPrefix:'KF' });
  C.layFrom(zone.a, towers);
  const shelvesPer = Math.max(1, Math.floor((SHELF_HI - SHELF_LO) / SHELF_PITCH) + 1);
  for (const t of towers){ if (!t.filler){ t.shelves = shelvesPer; t.band = [SHELF_LO, SHELF_HI]; } }
  zone.towers = towers;
  return zone;
}

/* ==================================================================
 * 5. MAIN PLANNER
 * ================================================================== */
function plan(room, opts={}){
  const age = AGE_HEIGHT[opts.age] ? opts.age : 'child';
  const deskH = AGE_HEIGHT[age];
  const analyses = room.walls.map(w => C.analyseWall(w));
  const warnings = [];

  // choose wall: explicit --wall, else the largest floor-standing run
  let chosen;
  if (opts.wall != null){
    chosen = analyses.find(a => a.wall.num === opts.wall);
    if (!chosen) warnings.push(`קיר ${opts.wall} לא נמצא — נבחר אוטומטית.`);
  }
  if (!chosen){
    let best = null;
    for (const a of analyses){
      const { best:b } = baseRun(a);
      if (b && (!best || (b.b - b.a) > (best.span.b - best.span.a))) best = { a, span:b };
    }
    chosen = best && best.a;
  }
  if (!chosen){ return { room, warnings:['לא נמצא קיר מתאים ליחידת-ילדים.'], layout:null }; }

  const { best } = baseRun(chosen);
  const run = best || { a:0, b:0 };
  const runW = run.b - run.a;
  if (runW < MIN_RUN){
    warnings.push(`הקטע הפנוי הגדול ביותר בקיר ${chosen.wall.num} = ${runW|0}מ"מ < ${MIN_RUN} — צר ליחידה.`);
  }

  // windows (for window-over-desk placement)
  const windows = chosen.blockers.filter(b => b.kind === 'window');
  const { zones, notes:zNotes } = allocateZones(run, windows);

  // build each zone
  let deskZone = null;
  for (const z of zones){
    if (z.type === 'wardrobe') buildWardrobe(z);
    else if (z.type === 'desk'){ buildDesk(z, deskH); deskZone = z; }
    else if (z.type === 'shelves') buildShelves(z);
  }

  // top-box over the wardrobe (full-height zone only)
  const ceil = chosen.H;
  let topbox = null;
  const wZone = zones.find(z => z.type === 'wardrobe');
  if (wZone && ceil - WARDROBE_H >= TOPBOX_MIN){
    topbox = { code:`KU-${Math.round(ceil - WARDROBE_H)}`, h:Math.round(ceil - WARDROBE_H), w:Math.round(wZone.w) };
  }

  /* -------------------- VALIDATIONS / WARNINGS -------------------- */
  // (a) age height used + adjustable
  warnings.push(`גובה-שולחן ${deskH}מ"מ לפי גיל "${AGE_LABEL[age]}" — מומלץ מנגנון גובה מתכוונן (ילדים גדלים; כלל 90-90-90).`);
  // (b) anti-tip anchor — MANDATORY
  warnings.push('חובה: עיגון-קיר נגד-התהפכות (anti-tip) לכל הגופים — בטיחות-ילדים.');
  // (c) rounded edges
  warnings.push('הקצה פינות מעוגלות/רכות; ללא קצוות חדים בהישג-יד הילד.');
  // (d) reachable rail
  warnings.push(`מוט-התלייה בגובה נגיש ${RAIL_H}מ"מ (טווח 1000–1200) — לא הכפול-2075 של המבוגר.`);
  // (e) knee clearance
  if (deskZone){
    if (deskZone.knee < KNEE_MIN)
      warnings.push(`מרווח-ברכיים תחת השולחן ${deskZone.knee}מ"מ < ${KNEE_MIN} — צר; הקטן/הזז את פדסטל-המגירה.`);
    else if (deskZone.knee < KNEE_GOOD)
      warnings.push(`מרווח-ברכיים ${deskZone.knee}מ"מ — תקין (מומלץ ≥${KNEE_GOOD} לישיבה נוחה).`);
  } else {
    warnings.push('לא שולב אזור-שולחן (הריצה צרה מדי) — שקול קיר אחר או ויתור על אזור-מדפים.');
  }
  // (f) services behind the run / low services (child safety)
  for (const s of chosen.services){
    if (s.x >= run.a && s.x <= run.b){
      warnings.push(`קיר ${chosen.wall.num}: נקודת ${s.kind} @${s.x|0} תיפול מאחורי היחידה — לא נגישה; להעביר/לנתק לפני התקנה.`);
    }
    if ((s.y||0) < SAFE_SVC_H && s.x >= run.a && s.x <= run.b){
      warnings.push(`קיר ${chosen.wall.num}: שקע/שירות נמוך ${s.kind} @${s.x|0} בגובה ${s.y|0}מ"מ (<${SAFE_SVC_H}) — בטיחות-ילדים: להגביה/לכסות/להעביר.`);
    }
  }
  // (g) window handling
  for (const w of windows){
    const wc = (w.a + w.b) / 2;
    if (wc < run.a || wc > run.b) continue;
    const inDesk = deskZone && wc >= deskZone.a && wc <= deskZone.b;
    if (inDesk) warnings.push(`חלון @${wc|0} מעל השולחן — אור טבעי (לא קונפליקט).`);
    else if (wZone && wc >= wZone.a && wc <= wZone.b)
      warnings.push(`חלון @${wc|0} נופל באזור-הארון — שקול להחליף מיקום כך שהחלון יהיה מעל השולחן.`);
  }
  // (h) openings / beams crossing the run
  for (const bl of chosen.blockers){
    if (bl.kind === 'window') continue;
    if (bl.b > run.a && bl.a < run.b)
      warnings.push(`קיר ${chosen.wall.num}: ${bl.kind} @${((bl.a+bl.b)/2)|0} חוצה את קו-היחידה — הריצה מתקצרת/מתפצלת.`);
  }
  for (const n of zNotes) warnings.push(n);
  for (const n of chosen.notes) warnings.push(n);

  const layout = { wall:chosen.wall, run, runW, depth:BODY_DEPTH, deskH, age, zones, topbox };
  return { room, chosen, layout, warnings, opts:{ age, deskH } };
}

/* ==================================================================
 * 6. REPORT
 * ================================================================== */
function moduleList(result){
  const counts = {};
  const bump = (code, n=1) => { if (code) counts[code] = (counts[code]||0) + n; };
  for (const z of result.layout.zones){
    if (z.type === 'wardrobe'){
      for (const bay of z.bays){ bump(bay.code); if (bay.fit) bump(bay.fit.code); }
    } else if (z.type === 'desk'){
      bump(z.worktop.code); bump(z.drawer.code);
    } else if (z.type === 'shelves'){
      for (const t of z.towers) bump(t.code);
    } else if (z.type === 'filler'){
      bump(`KF-${Math.round(z.w)}`);
    }
  }
  if (result.layout.topbox) bump(result.layout.topbox.code);
  return counts;
}

const ZONE_HE = { wardrobe:'ארון', desk:'שולחן-כתיבה', shelves:'מדפים', filler:'מילוי' };

function report(result){
  const L = [];
  if (!result.layout){
    L.push(`# תוכנית יחידת-ילדים — ${result.room.name}`, '');
    L.push('## אזהרות'); for (const w of result.warnings) L.push(`   ⚠ ${w}`);
    return L.join('\n');
  }
  const ly = result.layout;
  L.push(`# תוכנית יחידת-ילדים / לימוד — ${result.room.name}`);
  L.push('');
  L.push(`גיל: ${AGE_LABEL[ly.age]} · גובה-שולחן ${ly.deskH}מ"מ (מתכוונן מומלץ) · עומק-גוף ${ly.depth}מ"מ · ארון בגובה ${WARDROBE_H}${ly.topbox?` + ארגז-על ${ly.topbox.h}`:''}`);
  L.push(`קיר ${ly.wall.num} (אורך ${ly.wall.length|0}) · ריצת-יחידה ${ly.run.a|0}–${ly.run.b|0} (${ly.runW|0}מ"מ)`);
  L.push('');
  L.push('## אזורים (Zones)');
  for (const z of ly.zones){
    L.push(`   [${z.a|0}–${z.b|0}] ${ZONE_HE[z.type]||z.type} (${z.w|0}מ"מ)`);
  }
  L.push('');
  // wardrobe detail
  const wz = ly.zones.find(z => z.type === 'wardrobe');
  if (wz){
    L.push('## אזור-ארון — תאים ופנים');
    for (const bay of wz.bays){
      if (bay.filler){ L.push(`   [${bay.a|0}–${bay.b|0}] ${bay.code} (מילוי ${bay.w})`); continue; }
      L.push(`   [${bay.a|0}–${bay.b|0}] ${bay.code} (${bay.w}מ"מ) — ${bay.fit.label} «${bay.fit.detail}»`);
    }
    L.push('');
  }
  // desk detail
  const dz = ly.zones.find(z => z.type === 'desk');
  if (dz){
    L.push('## אזור-שולחן');
    L.push(`   [${dz.a|0}–${dz.b|0}] ${dz.worktop.code} — משטח-עבודה ${dz.worktop.w}×עומק ${dz.worktop.depth}, גובה ${dz.worktop.h}מ"מ`);
    L.push(`   פדסטל: ${dz.drawer.code} (${dz.drawer.label}, רוחב ${dz.drawer.w}) · מרווח-ברכיים פתוח ${dz.knee}מ"מ`);
    L.push('');
  }
  // shelves detail
  const sz = ly.zones.find(z => z.type === 'shelves');
  if (sz){
    L.push('## אזור-מדפים');
    for (const t of sz.towers){
      if (t.filler){ L.push(`   [${t.a|0}–${t.b|0}] ${t.code} (מילוי ${t.w})`); continue; }
      L.push(`   [${t.a|0}–${t.b|0}] ${t.code} (${t.w}מ"מ) — ${t.shelves} מדפים פתוחים בטווח ${t.band[0]}–${t.band[1]}`);
    }
    L.push('');
  }
  if (ly.topbox){
    L.push('## ארגז-על (Upper)');
    L.push(`   ${ly.topbox.code} — גובה ${ly.topbox.h} × רוחב ${ly.topbox.w} (מעל הארון עד התקרה)`);
    L.push('');
  }
  L.push('## רשימת מודולים (Cut / Module list)');
  for (const [code, n] of Object.entries(moduleList(result)).sort()) L.push(`   ${n}× ${code}`);
  L.push('');
  L.push('## אזהרות / בטיחות / קונפליקטים');
  if (!result.warnings.length) L.push('   אין.');
  for (const w of result.warnings) L.push(`   ⚠ ${w}`);
  return L.join('\n');
}

/* ==================================================================
 * 7. CLI
 * ================================================================== */
function main(){
  const args = process.argv.slice(2);
  const ai = args.indexOf('--age');  const age = ai >= 0 ? args[ai+1] : 'child';
  const wi = args.indexOf('--wall'); const wall = wi >= 0 ? +args[wi+1] : null;
  const oi = args.indexOf('--out');  const outDir = oi >= 0 ? args[oi+1] : path.join(__dirname, 'out');
  let file = args.find((a,i) => !a.startsWith('--') && args[i-1] !== '--wall' && args[i-1] !== '--out' && args[i-1] !== '--age');
  if (!file){
    const cand = [ path.join(__dirname, '..','..','..','converter','analysis','out','allelem','allelem.ordx'),
                   path.join(__dirname, 'sample_room.json') ];
    file = cand.find(f => fs.existsSync(f));
  }
  if (!file){ console.error('לא נמצא קובץ קלט.'); process.exit(1); }
  const room = C.loadRoom(file);
  const result = plan(room, { age, wall });
  const rep = report(result);
  console.log(rep);
  try{
    fs.mkdirSync(outDir, { recursive:true });
    const base = path.basename(file).replace(/\.[^.]+$/, '');
    fs.writeFileSync(path.join(outDir, `${base}_kids_plan.md`), rep, 'utf8');
    fs.writeFileSync(path.join(outDir, `${base}_kids_plan.json`),
      JSON.stringify({
        wall: result.layout && result.layout.wall.num,
        age: result.layout && result.layout.age,
        deskHeight: result.layout && result.layout.deskH,
        run: result.layout && result.layout.run,
        zones: result.layout && result.layout.zones,
        modules: result.layout && moduleList(result),
        warnings: result.warnings
      }, null, 2), 'utf8');
    console.error(`\n[נשמר] ${outDir}`);
  }catch(e){ console.error('שמירה נכשלה:', e.message); }
}
if (require.main === module) main();
module.exports = { plan, report, moduleList, AGE_HEIGHT, BAY_WIDTHS };
