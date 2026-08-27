#!/usr/bin/env node
/*
 * plan_office.js — Soline "Soli" Home-Office / Desk Planning Module
 * ------------------------------------------------------------------
 * Turns a room MEASUREMENT (walls + services, from the Soline model) into
 * a carpenter's DESK / WORKSTATION PLAN: a WORKTOP spanning a run at
 * ~740mm, a clear KNEE SPACE (no cabinet) where the user sits, PEDESTAL
 * drawer banks at the ends, an UPPER hutch (open shelves or wall
 * cabinets) above the worktop, an optional TALL cabinet at one end, and
 * a data/power GROMMET in the worktop next to the electrical/LAN point.
 *
 * INPUT CONTRACT: identical to the Soli kitchen/wardrobe modules
 * (walls + fixtures); see ../../_lib/carpentry_core.js.
 *
 * IP NOTE: Public standards (see STANDARDS.md) + Soline's own logic only.
 *
 * Usage:
 *   node plan_office.js <room.ordx|room.json> [--wall N] [--depth MM]
 *        [--uppers-cabinet] [--no-uppers] [--tower] [--out DIR]
 *   node plan_office.js            (defaults to the allelem sample)
 * ------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../_lib/carpentry_core.js');

/* ==================================================================
 * 1. CATALOG (mirrors MODULE_CATALOG.md). Dimensions in mm.
 * ================================================================== */
const WORKTOP_H       = 740;    // desk-surface height (29" — the common default)
const WORKTOP_DEPTH   = 660;    // >=660 (26") to seat a monitor at arm's length
const WORKTOP_JOINT   = 3000;   // above this, supply the worktop in 2 sections
const PED_BAND_TOP     = 720;   // pedestal carcass top (worktop top sits at 740)
const PED_WIDTHS      = [450, 400];   // pedestal drawer-bank widths (400–450)

const KNEE_MIN        = 600;    // clear knee width (24") — hard minimum
const KNEE_TARGET     = 700;    // preferred clear knee width
const KNEE_DEPTH_MIN  = 450;    // clear knee DEPTH (18") — informational

const UPPER_BOTTOM    = 1150;   // hutch / wall-cabinet bottom (~410 above worktop)
const UPPER_TOP       = 2100;   // top of the upper band
const UPPER_WIDTHS    = [800, 600, 450, 400];

const TALL_W          = 600;    // tall end cabinet (tower)
const TALL_TOP        = 2100;

const MIN_RUN         = 900;    // below this a desk run is not worth building
const MIN_FILLER      = 30;

const CHAIR_PULLBACK_MIN = 900; // clear behind the desk to roll back / stand (36")

/* ==================================================================
 * 2. WALL SCORING — pick the wall that best hosts a desk run:
 *    the longest clear span in the WORKTOP band [0,740] wins.
 *    (A window whose sill >= 740 does NOT block the worktop.)
 * ================================================================== */
function bestWorktopSpan(analysis){
  const spans = C.bandSpans(analysis, 0, WORKTOP_H, MIN_FILLER);
  let best = null;
  for (const s of spans){ if (!best || (s.b - s.a) > (best.b - best.a)) best = s; }
  return { spans, best };
}

function hasPowerOrData(analysis){
  return analysis.services.some(s => s.kind === 'elec' || s.kind === 'data' || s.kind === 'tv');
}

/* Room depth = length of the walls perpendicular to the chosen wall
 * (conservative: the shortest such wall). Used for chair pull-back. */
function roomDepth(room, chosen){
  const w = chosen.wall;
  const dx = w.ex - w.sx, dy = w.ey - w.sy, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  let depth = null;
  for (const o of room.walls){
    if (o.num === w.num) continue;
    const odx = o.ex - o.sx, ody = o.ey - o.sy, oL = Math.hypot(odx, ody) || 1;
    const dot = Math.abs((odx / oL) * ux + (ody / oL) * uy);
    if (dot < 0.2){ // ~perpendicular
      if (depth == null || o.length < depth) depth = o.length;
    }
  }
  return depth;
}

/* ==================================================================
 * 3. BASE — worktop + centred knee space + pedestal banks at the ends.
 * ================================================================== */
function planBase(run){
  const W = run.b - run.a;
  let kneeW = Math.min(KNEE_TARGET, W);
  if (kneeW < KNEE_MIN) kneeW = Math.min(KNEE_MIN, W);
  const mid = (run.a + run.b) / 2;
  let kneeA = Math.round(mid - kneeW / 2);
  let kneeB = Math.round(mid + kneeW / 2);
  if (kneeA < run.a){ kneeA = run.a; kneeB = run.a + kneeW; }
  if (kneeB > run.b){ kneeB = run.b; kneeA = run.b - kneeW; }

  const leftLen  = Math.max(0, kneeA - run.a);
  const rightLen = Math.max(0, run.b - kneeB);
  const left  = C.fillSegment(leftLen,  PED_WIDTHS, 'OB', { minFiller:MIN_FILLER, fillerPrefix:'OF' });
  C.layFrom(run.a, left);
  const right = C.fillSegment(rightLen, PED_WIDTHS, 'OB', { minFiller:MIN_FILLER, fillerPrefix:'OF' });
  C.layFrom(kneeB, right);

  const knee = { a:kneeA, b:kneeB, w:kneeB - kneeA };
  return { left, right, knee, pedestals:[...left, ...right] };
}

/* ==================================================================
 * 4. UPPERS — hutch above the worktop (open shelves OSH or cabinets OU).
 *    Only the clear part of the UPPER band that overlaps the run.
 * ================================================================== */
function planUppers(chosen, run, useCabinet){
  const spans = C.bandSpans(chosen, UPPER_BOTTOM, UPPER_TOP, MIN_FILLER);
  const prefix = useCabinet ? 'OU' : 'OSH';
  const out = [];
  for (const s of spans){
    const a = Math.max(s.a, run.a), b = Math.min(s.b, run.b);
    if (b - a < 400) continue; // too narrow for an upper
    const mods = C.fillSegment(b - a, UPPER_WIDTHS, prefix, { minFiller:MIN_FILLER, fillerPrefix:'OF' });
    C.layFrom(a, mods);
    out.push({ a, b, mods });
  }
  return { prefix, groups:out };
}

/* ==================================================================
 * 5. GROMMET — cable cut-out in the worktop, snapped to the nearest
 *    electrical/data point inside the run (else run centre).
 * ================================================================== */
function planGrommet(chosen, run){
  const pts = chosen.services.filter(s => (s.kind==='data' || s.kind==='elec' || s.kind==='tv')
                                           && s.x > run.a && s.x < run.b);
  if (pts.length){
    // prefer a data point (cable management), else the first power point
    const data = pts.find(p => p.kind==='data') || pts[0];
    return { x: Math.round(data.x), snappedTo: data.kind };
  }
  return { x: Math.round((run.a + run.b) / 2), snappedTo: null };
}

/* ==================================================================
 * 6. MAIN PLANNER
 * ================================================================== */
function plan(room, opts={}){
  const useCabinet = !!opts.uppersCabinet;
  const depth = opts.depth || WORKTOP_DEPTH;
  const analyses = room.walls.map(w => C.analyseWall(w));
  const warnings = [];

  // choose wall: explicit --wall, else the largest clear worktop span
  let chosen;
  if (opts.wall != null){
    chosen = analyses.find(a => a.wall.num === opts.wall);
    if (!chosen) warnings.push(`קיר ${opts.wall} לא נמצא — נבחר אוטומטית.`);
  }
  if (!chosen){
    let best = null;
    for (const a of analyses){
      const { best:b } = bestWorktopSpan(a);
      if (b && (!best || (b.b - b.a) > (best.span.b - best.span.a))) best = { a, span:b };
    }
    chosen = best && best.a;
  }
  if (!chosen){ return { room, warnings:['לא נמצא קיר מתאים לשולחן-עבודה.'], layout:null }; }

  let { best } = bestWorktopSpan(chosen);
  if (!best){ return { room, chosen, warnings:['אין קטע פנוי בגובה-משטח בקיר הנבחר.'], layout:null }; }
  let run = { a:best.a, b:best.b };

  // optional tall end cabinet (tower) at the run start
  let tower = null;
  if (opts.tower){
    if ((run.b - run.a) - TALL_W >= MIN_RUN){
      tower = { code:`OT-${TALL_W}`, w:TALL_W, h:TALL_TOP, a:run.a, b:run.a + TALL_W };
      run = { a: run.a + TALL_W, b: run.b };
    } else {
      warnings.push(`ריצה קצרה מדי לארון-צריח (${TALL_W}) לצד השולחן — הצריח בוטל.`);
    }
  }

  const runW = run.b - run.a;
  if (runW < MIN_RUN){
    warnings.push(`הקטע הפנוי בקיר ${chosen.wall.num} = ${runW|0}מ"מ < ${MIN_RUN} — צר לשולחן-עבודה.`);
  }

  const base    = planBase(run);
  const uppers  = opts.noUppers ? { prefix:null, groups:[] } : planUppers(chosen, run, useCabinet);
  const grommet = planGrommet(chosen, run);
  const worktop = {
    code:`ODESK-${runW|0}`, a:run.a, b:run.b, w:runW, depth, h:WORKTOP_H,
    sections: runW > WORKTOP_JOINT ? 2 : 1
  };

  // ---- validations / warnings ----
  // 1. knee space
  if (base.knee.w < KNEE_MIN){
    warnings.push(`מרווח-הברכיים ${base.knee.w|0}מ"מ < ${KNEE_MIN} — צר לישיבה; הרחב את הריצה או הסר בנק-מגירות.`);
  }
  // 2. power + data presence on the wall
  if (!hasPowerOrData(chosen)){
    warnings.push('אין נקודת חשמל/תקשורת על הקיר — לתאם הזנת חשמל + נקודת-רשת (LAN) לעמדת-העבודה.');
  }
  // 3. chair pull-back clearance vs the opposite wall
  const rd = roomDepth(room, chosen);
  if (rd != null){
    const clear = rd - depth;
    if (clear < CHAIR_PULLBACK_MIN){
      warnings.push(`מרווח-נסיגת-כיסא ~${clear|0}מ"מ (עומק-חדר ${rd|0}−משטח ${depth}) < ${CHAIR_PULLBACK_MIN} — צפוף לגלגול-לאחור/קימה.`);
    }
  }
  // 4. worktop supply joint
  if (worktop.sections > 1){
    warnings.push(`משטח ${runW|0}מ"מ > ${WORKTOP_JOINT} — לספק ב-2 מקטעים עם חיבור (ביסקוויט/דאובל).`);
  }
  // 5. openings / obstacles crossing the run
  for (const bl of chosen.blockers){
    if (bl.b > run.a && bl.a < run.b){
      if (bl.kind === 'window' && bl.z0 >= WORKTOP_H){
        chosen.notes.push(`חלון @${((bl.a+bl.b)/2)|0} מעל המשטח — אור-טבעי, לא קונפליקט (הסתת הכוונן/מסך למניעת סנוור).`);
      } else {
        warnings.push(`קיר ${chosen.wall.num}: ${bl.kind} @${((bl.a+bl.b)/2)|0} חוצה את קו-השולחן — הריצה מתפצלת/מתקצרת.`);
      }
    }
  }
  // 6. services that fall behind a pedestal become inaccessible
  for (const s of chosen.services){
    const behindPed = base.pedestals.some(p => !p.filler && s.x > p.a && s.x < p.b);
    if (behindPed && (s.kind==='water' || s.kind==='gas' || s.kind==='drain')){
      warnings.push(`קיר ${chosen.wall.num}: נקודת ${s.kind} @${s.x|0} מאחורי בנק-מגירות — לא נגישה; להעביר/לנתק לפני התקנה.`);
    }
  }

  const layout = { wall:chosen.wall, run, runW, depth, worktop, base, uppers, tower, grommet, notes:chosen.notes };
  return { room, chosen, layout, warnings, opts:{ useCabinet, depth, tower:!!tower } };
}

/* ==================================================================
 * 7. REPORT
 * ================================================================== */
function moduleList(result){
  const ly = result.layout;
  const arrays = [ ly.base.pedestals ];
  for (const g of ly.uppers.groups) arrays.push(g.mods);
  const counts = C.moduleListFrom(arrays);
  counts[ly.worktop.code] = (counts[ly.worktop.code] || 0) + 1;
  if (ly.tower) counts[ly.tower.code] = (counts[ly.tower.code] || 0) + 1;
  return counts;
}

function report(result){
  const L = [];
  const ly = result.layout;
  L.push(`# תוכנית פינת-עבודה / שולחן-כתיבה — ${result.room.name}`);
  L.push('');
  if (!ly){
    L.push('## אזהרות / קונפליקטים');
    for (const w of result.warnings) L.push(`   ⚠ ${w}`);
    return L.join('\n');
  }
  const upKind = result.opts.useCabinet ? 'ארוניות-קיר' : 'מדפים פתוחים (הָצֵץ)';
  L.push(`משטח-עבודה בגובה ${ly.worktop.h}מ"מ · עומק ${ly.depth}מ"מ · עליונים: ${ly.uppers.groups.length? upKind : 'ללא'}${ly.tower? ' · ארון-צריח בקצה':''}`);
  L.push(`קיר ${ly.wall.num} (אורך ${ly.wall.length|0}) · ריצת-שולחן ${ly.run.a|0}–${ly.run.b|0} (${ly.runW|0}מ"מ)${ly.worktop.sections>1?` · ${ly.worktop.sections} מקטעים`:''}`);
  L.push('');

  L.push('## משטח-העבודה (Worktop)');
  L.push(`   [${ly.worktop.a|0}–${ly.worktop.b|0}] ${ly.worktop.code} (${ly.worktop.w|0}×${ly.depth}, גובה ${ly.worktop.h})`);
  L.push(`   פתח-כבלים (grommet) @${ly.grommet.x} ${ly.grommet.snappedTo? `— צמוד לנקודת ${ly.grommet.snappedTo}`:'— במרכז (אין נקודת חשמל/רשת בריצה)'}`);
  L.push('');

  L.push('## מרווח-ברכיים (Knee space)');
  L.push(`   [${ly.base.knee.a|0}–${ly.base.knee.b|0}] פנוי ${ly.base.knee.w|0}מ"מ (ללא ארון) · עומק-פנוי ≥${KNEE_DEPTH_MIN}`);
  L.push('');

  L.push('## בנקי-מגירות (Pedestals) ומילויים');
  const peds = ly.base.pedestals;
  if (!peds.length) L.push('   אין (כל הריצה = מרווח-ברכיים).');
  for (const p of peds){
    if (p.filler) L.push(`   [${p.a|0}–${p.b|0}] ${p.code} (פאנל-רגל/מילוי ${p.w})`);
    else          L.push(`   [${p.a|0}–${p.b|0}] ${p.code} (${p.w}מ"מ) — בנק-מגירות`);
  }
  L.push('');

  if (ly.tower){
    L.push('## ארון-צריח (Tall cabinet)');
    L.push(`   [${ly.tower.a|0}–${ly.tower.b|0}] ${ly.tower.code} (${ly.tower.w}×גובה ${ly.tower.h})`);
    L.push('');
  }

  L.push('## עליונים — הָצֵץ / ארוניות (Uppers)');
  if (!ly.uppers.groups.length) L.push('   ללא / חסום.');
  for (const g of ly.uppers.groups){
    L.push(`   קטע [${g.a|0}–${g.b|0}] (תחתית ${UPPER_BOTTOM}, רום ${UPPER_TOP}):`);
    for (const m of g.mods){
      if (m.filler) L.push(`      [${m.a|0}–${m.b|0}] ${m.code} (מילוי ${m.w})`);
      else          L.push(`      [${m.a|0}–${m.b|0}] ${m.code} (${m.w}מ"מ)`);
    }
  }
  L.push('');

  L.push('## רשימת מודולים (Cut / Module list)');
  for (const [code, n] of Object.entries(moduleList(result)).sort()) L.push(`   ${n}× ${code}`);
  L.push('');

  if (ly.notes && ly.notes.length){
    L.push('## הערות-קיר');
    for (const nt of ly.notes) L.push(`   • ${nt}`);
    L.push('');
  }

  L.push('## אזהרות / קונפליקטים');
  if (!result.warnings.length) L.push('   אין.');
  for (const w of result.warnings) L.push(`   ⚠ ${w}`);
  return L.join('\n');
}

/* ==================================================================
 * 8. CLI
 * ================================================================== */
function main(){
  const args = process.argv.slice(2);
  const uppersCabinet = args.includes('--uppers-cabinet');
  const noUppers = args.includes('--no-uppers');
  const tower = args.includes('--tower');
  const wi = args.indexOf('--wall');  const wall  = wi >= 0 ? +args[wi+1] : null;
  const di = args.indexOf('--depth'); const depth = di >= 0 ? +args[di+1] : null;
  const oi = args.indexOf('--out');   const outDir = oi >= 0 ? args[oi+1] : path.join(__dirname, 'out');
  let file = args.find((a, i) => !a.startsWith('--')
      && args[i-1] !== '--wall' && args[i-1] !== '--out' && args[i-1] !== '--depth');
  if (!file){
    const cand = [ path.join(__dirname, '..', '..', '..', 'converter', 'analysis', 'out', 'allelem', 'allelem.ordx'),
                   path.join(__dirname, 'sample_room.json') ];
    file = cand.find(f => fs.existsSync(f));
  }
  if (!file){ console.error('לא נמצא קובץ קלט.'); process.exit(1); }
  const room = C.loadRoom(file);
  const result = plan(room, { wall, depth, uppersCabinet, noUppers, tower });
  const rep = report(result);
  console.log(rep);
  try{
    fs.mkdirSync(outDir, { recursive:true });
    const base = path.basename(file).replace(/\.[^.]+$/, '');
    fs.writeFileSync(path.join(outDir, `${base}_office_plan.md`), rep, 'utf8');
    fs.writeFileSync(path.join(outDir, `${base}_office_plan.json`),
      JSON.stringify({
        wall: result.layout && result.layout.wall.num,
        run: result.layout && result.layout.run,
        worktop: result.layout && result.layout.worktop,
        knee: result.layout && result.layout.base.knee,
        pedestals: result.layout && result.layout.base.pedestals,
        tower: result.layout && result.layout.tower,
        uppers: result.layout && result.layout.uppers,
        grommet: result.layout && result.layout.grommet,
        modules: result.layout ? moduleList(result) : {},
        warnings: result.warnings
      }, null, 2), 'utf8');
    console.error(`\n[נשמר] ${outDir}`);
  }catch(e){ console.error('שמירה נכשלה:', e.message); }
}
if (require.main === module) main();
module.exports = { plan, report, moduleList, PED_WIDTHS, UPPER_WIDTHS };
