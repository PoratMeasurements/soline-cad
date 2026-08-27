#!/usr/bin/env node
/*
 * plan_bookshelf.js — Soline "Soli" Bookshelf / Library Planning Module
 * ---------------------------------------------------------------------
 * Turns a room MEASUREMENT (walls + services, from the Soline model) into
 * a carpenter's OPEN-SHELVING PLAN: a run of vertical bays against a wall,
 * full-height (or to a set height), each bay carrying a computed number of
 * fixed/adjustable shelves.
 *
 * THE DEFINING CONSTRAINT: shelf SPAN vs SAG. A loaded book shelf sags,
 * so the CLEAR SPAN between uprights must never exceed the material limit
 * (MAX_SPAN). We enforce this automatically by choosing bay widths from a
 * menu whose maximum EQUALS MAX_SPAN — so every bay is split by a vertical
 * upright before it can sag. Material sets the limit: melamine 600, plywood
 * 800, solid wood 800.
 *
 * INPUT CONTRACT: identical to the Soli kitchen/wardrobe modules
 * (walls + fixtures); see ../_lib/carpentry_core.js.
 *
 * IP NOTE: Public standards (see STANDARDS.md) + Soline's own logic only.
 *
 * Usage:
 *   node plan_bookshelf.js <room.ordx|room.json>
 *        [--wall N] [--material melamine|ply|solid] [--height MM]
 *        [--low] [--depth MM] [--pitch MM] [--base] [--fixed] [--out DIR]
 *   node plan_bookshelf.js            (defaults to the allelem sample)
 * ---------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../_lib/carpentry_core.js');

/* ==================================================================
 * 1. CATALOG / STANDARDS (mirrors MODULE_CATALOG.md + STANDARDS.md).
 *    All dimensions in mm.
 * ================================================================== */
// Material -> practical sag-safe MAX clear span + bay-width menu (max = span).
// Greedy fill from this menu can NEVER produce a bay wider than the span,
// so an upright is always inserted before a shelf would sag.
const MATERIALS = {
  melamine: { maxSpan:600, label:'מלמין (LPM/סנדוויץ\')', widths:[600,500,450,400,350,300] },
  ply:      { maxSpan:800, label:'דיקט/פלייווד',           widths:[800,700,600,500,450,400] },
  solid:    { maxSpan:800, label:'עץ מלא',                 widths:[800,700,600,500,450,400] }
};

const DEFAULT_HEIGHT = 2400;   // default target height when --height not given
const DEPTH_DEFAULT = 300;     // book depth (10-12" typical)
const DEPTH_MIN = 200, DEPTH_MAX = 350;   // 8-14" range
const PITCH_DEFAULT = 320;     // shelf spacing ~12" (32mm-system holes)
const PITCH_MIN = 200, PITCH_MAX = 380;   // 8-15" range
const BASE_HEIGHT = 800;       // optional closed base cabinet (doors) at bottom
const TOE_HEIGHT = 80;         // kickboard when there is no closed base
const MIN_RUN = 400;           // below this, not worth a bookshelf run
const MIN_FILLER = 30;         // leftover >= this becomes a filler, else scribe
const LOW_MARGIN = 50;         // gap kept below a window sill for --low

const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));

/* ==================================================================
 * 2. SHELF GEOMETRY — how many shelves fit in an open zone of height
 *    openH at spacing `pitch`. compartments = clear openings; internal
 *    shelves sit BETWEEN the fixed top & bottom boards.
 * ================================================================== */
function shelfPlan(openH, pitch){
  const compartments = Math.max(2, Math.round(openH / pitch));
  const shelvesInternal = compartments - 1;          // adjustable boards
  const boards = shelvesInternal + 2;                // + fixed top & bottom
  const clearComp = Math.round(openH / compartments);
  return { compartments, shelvesInternal, boards, clearComp };
}

/* ==================================================================
 * 3. WALL SCORING — pick the wall whose largest clear span in the
 *    vertical band [0,H] is longest.
 * ================================================================== */
function bestSpan(analysis, H){
  const spans = C.bandSpans(analysis, 0, H, MIN_FILLER);
  let best=null;
  for (const s of spans){ if(!best || (s.b-s.a)>(best.b-best.a)) best=s; }
  return { spans, best };
}

/* ==================================================================
 * 4. MAIN PLANNER
 * ================================================================== */
function plan(room, opts={}){
  const mat = MATERIALS[opts.material] || MATERIALS.melamine;
  const matKey = MATERIALS[opts.material] ? opts.material : 'melamine';
  const depth = clamp(opts.depth || DEPTH_DEFAULT, DEPTH_MIN, DEPTH_MAX);
  const pitch = clamp(opts.pitch || PITCH_DEFAULT, PITCH_MIN, PITCH_MAX);
  const adjustable = !opts.fixed;
  let H = opts.height || DEFAULT_HEIGHT;
  const analyses = room.walls.map(w=>C.analyseWall(w));
  const warnings = [];

  // --- choose wall: explicit --wall, else largest full-band clear span ---
  let chosen;
  if (opts.wall!=null){
    chosen = analyses.find(a=>a.wall.num===opts.wall);
    if(!chosen) warnings.push(`קיר ${opts.wall} לא נמצא — נבחר אוטומטית.`);
  }
  if(!chosen){
    let bt=null;
    for (const a of analyses){ const {best}=bestSpan(a,H);
      if (best && (!bt || (best.b-best.a)>(bt.span.b-bt.span.a))) bt={a,span:best}; }
    chosen = bt && bt.a;
  }
  if(!chosen){ return { room, warnings:['לא נמצא קיר מתאים לספרייה.'], layout:null }; }

  // --- --low: cap H below the lowest overlapping window on the chosen wall
  if (opts.low){
    const wins = chosen.blockers.filter(b=>b.kind==='window' && b.z1>0 && b.z0<H);
    if (wins.length){
      const sill = Math.min(...wins.map(w=>w.z0));
      const capped = Math.max(400, Math.round(sill - LOW_MARGIN));
      if (capped < H){
        warnings.push(`--low: גובה הספרייה הונמך ל-${capped}מ"מ (מתחת לסף החלון ${sill|0}) — רצה מתחת לחלון ברוחב מלא.`);
        H = capped;
      }
    } else {
      warnings.push('--low: לא נמצא חלון על הקיר הנבחר להנמכה תחתיו; נשמר הגובה שנקבע.');
    }
  }

  // --- free spans in band [0,H]; primary run = largest, others noted ---
  const { spans, best } = bestSpan(chosen, H);
  if (!best || (best.b-best.a) < MIN_RUN){
    warnings.push(`הקטע הפנוי הגדול ביותר בקיר ${chosen.wall.num} = ${best?(best.b-best.a)|0:0}מ"מ < ${MIN_RUN} — צר לספרייה.`);
  }
  const run = best || spans[0] || {a:0,b:0};
  const runW = run.b - run.a;
  const otherSpans = spans.filter(s=>s!==run && (s.b-s.a)>=MIN_RUN);

  // --- carcass bays across the run (menu max = MAX_SPAN => auto-split) ---
  let bays = C.fillSegment(runW, mat.widths, 'BB', { minFiller:MIN_FILLER, fillerPrefix:'BF' });
  C.layFrom(run.a, bays);

  // --- optional closed base cabinet at the bottom ---
  let base = !!opts.base;
  if (base && H <= BASE_HEIGHT + 200){
    warnings.push('בסיס-סגור בוטל: הגובה נמוך מדי לבסיס 800מ"מ + מדפים פתוחים מעליו.');
    base = false;
  }
  const openBottom = base ? BASE_HEIGHT : TOE_HEIGHT;
  const openH = Math.max(pitch, H - openBottom);
  const sh = shelfPlan(openH, pitch);

  // --- assign shelves (and base cabinet) to every non-filler bay ---
  let totalShelfMm = 0;
  for (const bay of bays){
    if (bay.filler){ bay.shelves=null; continue; }
    bay.shelves = { count:sh.shelvesInternal, boards:sh.boards, compartments:sh.compartments,
                    clearComp:sh.clearComp, adjustable };
    totalShelfMm += sh.boards * bay.w;
    if (base){
      const leaves = bay.w>600 ? 2 : 1;
      bay.base = { code:`BBASE-${bay.w}`, h:BASE_HEIGHT, leaves };
    }
  }
  const totalShelfMetres = +(totalShelfMm/1000).toFixed(2);

  // ================= VALIDATIONS / WARNINGS =================
  // (a) span vs sag — cannot happen via the menu, but guard + report anyway
  const overspan = bays.filter(b=>!b.filler && b.w>mat.maxSpan);
  if (overspan.length){
    for (const b of overspan)
      warnings.push(`תא ${b.code} ברוחב ${b.w} > MAX_SPAN ${mat.maxSpan} (${mat.label}) — צפויה שקיעת-מדף; הוסף אמצע-תמיכה.`);
  } else {
    warnings.push(`כל התאים ≤ ${mat.maxSpan}מ"מ (${mat.label}) → מוטב-שקיעה: אין מדף בטווח-שקיעה.`);
  }
  // (b) anti-tip anchor — always required for tall shelving
  warnings.push('חובה: עיגון-קיר נגד-התהפכות (anti-tip) בכל תא-קצה ובכל ~1000מ"מ — רהיט גבוה.');
  // (c) fixed vs adjustable
  warnings.push(adjustable
    ? 'מדפים מתכווננים (מערכת חורים 32מ"מ) + מדף עליון/תחתון קבועים מבניים.'
    : 'מדפים קבועים (dado/פינים) — אין כוונון גובה; מדף עליון/תחתון קבועים.');
  // (d) depth note for books
  warnings.push(`עומק ${depth}מ"מ${depth<250?' — רדוד לספרים גדולים (רוב הספרים 200-300)':' — מתאים לספרים (250-300)'}.`);
  // (e) services behind the run become inaccessible
  for (const s of chosen.services){
    if (s.x>=run.a && s.x<=run.b)
      warnings.push(`קיר ${chosen.wall.num}: נקודת ${s.kind} @${s.x|0} תיפול מאחורי הספרייה — לא נגישה. להעביר/לנתק לפני התקנה.`);
  }
  // (f) openings/beams crossing the run split it
  for (const bl of chosen.blockers){
    if (bl.b>run.a && bl.a<run.b)
      warnings.push(`קיר ${chosen.wall.num}: ${bl.kind} @${((bl.a+bl.b)/2)|0} חוצה את קו-הספרייה — הריצה מתקצרת/מתפצלת.`);
  }
  // (g) additional runnable segments beside the opening
  if (otherSpans.length){
    warnings.push(`קטעים פנויים נוספים על הקיר (מעבר לפתח): ${otherSpans.map(s=>`${s.a|0}–${s.b|0} (${(s.b-s.a)|0})`).join(', ')} — ניתן להרחיב את הריצה אליהם.`);
  }

  const layout = { wall:chosen.wall, run, runW, depth, H, material:matKey, matLabel:mat.label,
                   maxSpan:mat.maxSpan, pitch, base, openBottom, openH, sh, bays,
                   totalShelfMetres, adjustable, notes:chosen.notes };
  return { room, chosen, layout, warnings,
           opts:{material:matKey, height:H, depth, pitch, base, adjustable, low:!!opts.low} };
}

/* ==================================================================
 * 5. REPORT
 * ================================================================== */
function moduleList(result){
  const L = result.layout;
  const counts = C.moduleListFrom([ L.bays ]);          // BB-* uprights + BF-* fillers
  for (const bay of L.bays){
    if (!bay.shelves) continue;
    const scode = `BSH-${bay.w}`;
    counts[scode] = (counts[scode]||0) + bay.shelves.boards;   // shelf boards
    if (bay.base) counts[bay.base.code] = (counts[bay.base.code]||0) + 1;
  }
  return counts;
}

function report(result){
  const ly = result.layout;
  const L = [];
  if (!ly){
    L.push(`# תוכנית ספרייה — ${result.room.name}`);
    L.push('');
    for (const w of result.warnings) L.push(`   ⚠ ${w}`);
    return L.join('\n');
  }
  L.push(`# תוכנית ספרייה / מדפים — ${result.room.name}`);
  L.push('');
  L.push(`חומר: ${ly.matLabel} · MAX_SPAN ${ly.maxSpan}מ"מ · עומק ${ly.depth}מ"מ · גובה ${ly.H}מ"מ · פסיעת-מדף ~${ly.pitch}מ"מ`);
  L.push(`קיר ${ly.wall.num} (אורך ${ly.wall.length|0}) · ריצת-ספרייה ${ly.run.a|0}–${ly.run.b|0} (${ly.runW|0}מ"מ)`);
  L.push(`${ly.base?`בסיס-סגור ${BASE_HEIGHT}מ"מ בתחתית + `:''}אזור-מדפים פתוח ${ly.openH|0}מ"מ · ${ly.sh.compartments} תאים לתא-אנכי (רום-פנוי ~${ly.sh.clearComp}מ"מ) · מדפים ${ly.adjustable?'מתכווננים':'קבועים'}`);
  L.push('');
  L.push('## תאים אנכיים (Bays) ומדפים');
  for (const bay of ly.bays){
    if (bay.filler){ L.push(`   [${bay.a|0}–${bay.b|0}] ${bay.code} (מילוי ${bay.w})`); continue; }
    const b = bay.shelves;
    L.push(`   [${bay.a|0}–${bay.b|0}] ${bay.code} (${bay.w}מ"מ) — ${b.count} מדפים ${b.adjustable?'מתכווננים':'קבועים'} (${b.boards} לוחות סה"כ, ${b.compartments} תאים)${bay.base?` + בסיס-סגור ${bay.base.code} (${bay.base.leaves} דלת/ות)`:''}`);
  }
  L.push('');
  L.push('## סיכום-כמויות');
  L.push(`   אורך-מדפים כולל: ${ly.totalShelfMetres} מ' (${ly.bays.filter(b=>!b.filler).length} תאים אנכיים)`);
  L.push('');
  L.push('## רשימת מודולים (Cut / Module list)');
  for (const [code,n] of Object.entries(moduleList(result)).sort()) L.push(`   ${n}× ${code}`);
  L.push('');
  L.push('## אזהרות / קונפליקטים');
  if (!result.warnings.length) L.push('   אין.');
  for (const w of result.warnings) L.push(`   ⚠ ${w}`);
  return L.join('\n');
}

/* ==================================================================
 * 6. CLI
 * ================================================================== */
function main(){
  const args = process.argv.slice(2);
  const val = (flag)=>{ const i=args.indexOf(flag); return i>=0? args[i+1] : null; };
  const has = (flag)=>args.includes(flag);

  const opts = {
    wall:     val('--wall')!=null ? +val('--wall') : null,
    material: val('--material'),
    height:   val('--height')!=null ? +val('--height') : null,
    depth:    val('--depth')!=null ? +val('--depth') : null,
    pitch:    val('--pitch')!=null ? +val('--pitch') : null,
    low:      has('--low'),
    base:     has('--base'),
    fixed:    has('--fixed')
  };
  const outDir = val('--out') || path.join(__dirname,'out');

  const valueFlags = new Set(['--wall','--material','--height','--depth','--pitch','--out']);
  let file = args.find((a,i)=>!a.startsWith('--') && !valueFlags.has(args[i-1]));
  if(!file){
    const cand=[ path.join(__dirname,'..','..','..','converter','analysis','out','allelem','allelem.ordx'),
                 path.join(__dirname,'sample_room.json') ];
    file=cand.find(f=>fs.existsSync(f));
  }
  if(!file){ console.error('לא נמצא קובץ קלט.'); process.exit(1); }

  const room = C.loadRoom(file);
  const result = plan(room, opts);
  const rep = report(result);
  console.log(rep);
  try{
    fs.mkdirSync(outDir,{recursive:true});
    const base = path.basename(file).replace(/\.[^.]+$/,'');
    fs.writeFileSync(path.join(outDir,`${base}_bookshelf_plan.md`), rep, 'utf8');
    fs.writeFileSync(path.join(outDir,`${base}_bookshelf_plan.json`),
      JSON.stringify({
        wall: result.layout && result.layout.wall.num,
        material: result.layout && result.layout.material,
        run: result.layout && result.layout.run,
        height: result.layout && result.layout.H,
        maxSpan: result.layout && result.layout.maxSpan,
        bays: result.layout && result.layout.bays,
        totalShelfMetres: result.layout && result.layout.totalShelfMetres,
        modules: result.layout ? moduleList(result) : {},
        warnings: result.warnings
      }, null, 2), 'utf8');
    console.error(`\n[נשמר] ${outDir}`);
  }catch(e){ console.error('שמירה נכשלה:', e.message); }
}
if (require.main===module) main();
module.exports = { plan, report, moduleList, shelfPlan, MATERIALS };
