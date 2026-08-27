#!/usr/bin/env node
/*
 * plan_wardrobe.js — Soline "Soli" Wardrobe / Closet Planning Module
 * ------------------------------------------------------------------
 * Turns a room MEASUREMENT (walls + services, from the Soline model) into
 * a carpenter's WARDROBE PLAN: a run of full-height bays against a wall,
 * with a sliding OR hinged door system and an internal fit-out
 * (double-hang / long-hang / shelves / drawers / shoe) per bay.
 *
 * INPUT CONTRACT: identical to the Soli kitchen module (walls + fixtures);
 * see ../_lib/carpentry_core.js.
 *
 * IP NOTE: Public standards (see STANDARDS.md) + Soline's own logic only.
 *
 * Usage:
 *   node plan_wardrobe.js <room.ordx|room.json> [--wall N] [--hinged]
 *                         [--reach-in] [--out DIR]
 *   node plan_wardrobe.js            (defaults to the allelem sample)
 * ------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../_lib/carpentry_core.js');

/* ==================================================================
 * 1. CATALOG (mirrors MODULE_CATALOG.md). Dimensions in mm.
 * ================================================================== */
const BODY_DEPTH_HINGED = 600;   // hinged: hangers need ~600 clear
const BODY_DEPTH_SLIDING = 650;  // sliding: +track/overlap
const BODY_DEPTH_REACHIN = 600;
const UNIT_H = 2400;             // standard carcass height
const TOPBOX_MIN = 150;          // build a top-box only if this much room to ceiling

const BAY_WIDTHS = [1000, 900, 800, 600, 500, 450, 400];   // carcass bays
const HINGE_LEAF_MAX = 600;      // a hinged door leaf should not exceed this
const SLIDE_LEAF = [1200, 1000, 900, 800];                 // sliding leaf menu
const MIN_RUN = 600;             // below this, not worth a wardrobe
const MIN_FILLER = 30;

// Internal fit-out kinds and the rail/shelf geometry each implies.
const FITOUT = {
  DBL: { code:'WI-DBL', label:'כפול-תלייה', railTop:2075, railBot:1030 },   // 81.75" / 40.5"
  LNG: { code:'WI-LNG', label:'תלייה-ארוכה', rail:1750 },                    // coats/dresses
  SHF: { code:'WI-SHF', label:'מדפים', pitch:320 },                          // ~12"
  DRW: { code:'WI-DRW', label:'מגירות', banks:5 },
  SHO: { code:'WI-SHO', label:'נעליים', pitch:180 }                          // ~7"
};
// Default fit-out mix by rotation (roughly 50% double / 25% long / 25% storage).
const MIX = ['DBL','DBL','LNG','SHF','DBL','DBL','LNG','DRW','SHO'];

/* ==================================================================
 * 2. WALL SCORING — pick the wall that best hosts a wardrobe run:
 *    the longest clear full-height span wins.
 * ================================================================== */
function bestFullHeightSpan(analysis){
  const spans = C.bandSpans(analysis, 0, UNIT_H, MIN_FILLER);
  let best=null;
  for (const s of spans){ if(!best || (s.b-s.a)>(best.b-best.a)) best=s; }
  return { spans, best };
}

/* ==================================================================
 * 3. DOOR SYSTEM
 * ================================================================== */
function planSlidingDoors(span){
  const width = span.b - span.a;
  // 2..4 leaves, overlap ~ leaf/... . Choose leaf count so each <= 1200.
  let n = Math.max(2, Math.ceil(width / SLIDE_LEAF[0]));
  const leaf = Math.round(width / n) + 40;   // +overlap allowance
  return { type:'sliding', leaves:n, leafW:leaf, code:`WSL-${leaf}`, note:`${n} כנפות הזזה ~${leaf}מ"מ (חפיפה ~40)` };
}
function planHingedDoors(bays){
  // each bay gets 1 or 2 hinged leaves so no leaf exceeds HINGE_LEAF_MAX
  const doors=[];
  for (const bay of bays){
    if (bay.filler) continue;
    const leaves = bay.w > HINGE_LEAF_MAX ? 2 : 1;
    const leafW = Math.round(bay.w / leaves);
    doors.push({ bay:bay.code, leaves, leafW, code:`WHG-${leafW}`, w:bay.w });
  }
  return { type:'hinged', doors };
}

/* ==================================================================
 * 4. INTERNAL FIT-OUT — assign a purpose to each bay from the mix.
 * ================================================================== */
function fitOut(bays){
  let i=0;
  for (const bay of bays){
    if (bay.filler){ bay.fit=null; continue; }
    const kind = MIX[i % MIX.length]; i++;
    const f = FITOUT[kind];
    bay.fit = { kind, code:f.code, label:f.label };
    if (kind==='DBL') bay.fit.detail = `מוט עליון ${f.railTop} + מוט תחתון ${f.railBot}`;
    if (kind==='LNG') bay.fit.detail = `מוט תלייה ${f.rail}`;
    if (kind==='SHF') bay.fit.detail = `מדפים במרווח ~${f.pitch}`;
    if (kind==='DRW') bay.fit.detail = `${f.banks} מגירות`;
    if (kind==='SHO') bay.fit.detail = `מדפי-נעליים במרווח ~${f.pitch}`;
  }
  return bays;
}

/* ==================================================================
 * 5. MAIN PLANNER
 * ================================================================== */
function plan(room, opts={}){
  const hinged = !!opts.hinged;
  const reachIn = !!opts.reachIn;
  const depth = reachIn ? BODY_DEPTH_REACHIN : (hinged ? BODY_DEPTH_HINGED : BODY_DEPTH_SLIDING);
  const analyses = room.walls.map(w=>C.analyseWall(w));
  const warnings=[];

  // choose wall: explicit --wall, else the one with the largest clear span
  let chosen;
  if (opts.wall!=null){
    chosen = analyses.find(a=>a.wall.num===opts.wall);
    if(!chosen){ warnings.push(`קיר ${opts.wall} לא נמצא — נבחר אוטומטית.`); }
  }
  if(!chosen){
    let best=null;
    for (const a of analyses){ const {best:b}=bestFullHeightSpan(a);
      if (b && (!best || (b.b-b.a)>(best.span.b-best.span.a))) best={a,span:b}; }
    chosen = best && best.a;
  }
  if(!chosen){ return { room, warnings:['לא נמצא קיר מתאים לארון.'], layout:[] }; }

  const { spans, best } = bestFullHeightSpan(chosen);
  if (!best || (best.b-best.a) < MIN_RUN){
    warnings.push(`הקטע הפנוי הגדול ביותר בקיר ${chosen.wall.num} = ${best?(best.b-best.a)|0:0}מ"מ < ${MIN_RUN} — צר לארון.`);
  }
  const run = best || spans[0] || {a:0,b:0};
  const runW = run.b - run.a;

  // carcass bays across the run
  let bays = C.fillSegment(runW, BAY_WIDTHS, 'WB', { minFiller:MIN_FILLER, fillerPrefix:'WF' });
  C.layFrom(run.a, bays);
  fitOut(bays);

  // doors
  const doorSys = hinged ? planHingedDoors(bays) : planSlidingDoors(run);

  // top-box to ceiling
  const ceil = chosen.H;
  let topbox=null;
  if (ceil - UNIT_H >= TOPBOX_MIN){
    topbox = { code:`WTB-${Math.round(ceil-UNIT_H)}`, h:Math.round(ceil-UNIT_H), w:Math.round(runW) };
  }

  // ---- validations ----
  // services that fall behind the run become inaccessible
  for (const s of chosen.services){
    if (s.x>=run.a && s.x<=run.b)
      warnings.push(`קיר ${chosen.wall.num}: נקודת ${s.kind} @${s.x|0} תיפול מאחורי הארון — לא נגישה. יש להעביר/לנתק לפני התקנה.`);
  }
  // openings crossing the run
  for (const bl of chosen.blockers){
    if (bl.b>run.a && bl.a<run.b)
      warnings.push(`קיר ${chosen.wall.num}: ${bl.kind} @${((bl.a+bl.b)/2)|0} חוצה את קו-הארון — הריצה מתקצרת/מתפצלת.`);
  }
  if (hinged){
    warnings.push('דלתות-ציר: לוודא מרווח-פתיחה חופשי לפחות ~600מ"מ מול הארון (רוחב כנף).');
  } else {
    warnings.push('דלתות-הזזה: אין צורך במרווח-פתיחה קדמי; לוודא מסילה עליונה נושאת ותחתונה מיושרת.');
  }
  if (depth>=650) warnings.push('הזזה: עומק גוף 650מ"מ (מסילה+חפיפת-כנפיים) — לוודא שהחדר מכיל.');

  const layout = { wall:chosen.wall, run, runW, depth, bays, doorSys, topbox, notes:chosen.notes };
  return { room, chosen, layout, warnings, opts:{hinged,reachIn,depth} };
}

/* ==================================================================
 * 6. REPORT
 * ================================================================== */
function moduleList(result){
  const L=result.layout;
  const arrays=[ L.bays ];
  if (L.doorSys.type==='hinged') arrays.push(L.doorSys.doors);
  const counts=C.moduleListFrom(arrays);
  if (L.doorSys.type==='sliding') counts[L.doorSys.code]=(counts[L.doorSys.code]||0)+L.doorSys.leaves;
  if (L.topbox) counts[L.topbox.code]=(counts[L.topbox.code]||0)+1;
  for (const bay of L.bays){ if(bay.fit) counts[bay.fit.code]=(counts[bay.fit.code]||0)+1; }
  return counts;
}

function report(result){
  const L=[]; const ly=result.layout;
  L.push(`# תוכנית ארון — ${result.room.name}`);
  L.push('');
  L.push(`מערכת: ${ly.doorSys.type==='sliding'?'הזזה':'פתיחה (ציר)'} · עומק גוף ${ly.depth}מ"מ · גובה ${2400}מ"מ${ly.topbox?` + ארגז-על ${ly.topbox.h}`:''}`);
  L.push(`קיר ${ly.wall.num} (אורך ${ly.wall.length|0}) · ריצת-ארון ${ly.run.a|0}–${ly.run.b|0} (${ly.runW|0}מ"מ)`);
  L.push('');
  L.push('## תאים (Bays) ופנים');
  for (const bay of ly.bays){
    if (bay.filler){ L.push(`   [${bay.a|0}–${bay.b|0}] ${bay.code} (מילוי ${bay.w})`); continue; }
    L.push(`   [${bay.a|0}–${bay.b|0}] ${bay.code} (${bay.w}מ"מ) — ${bay.fit?bay.fit.label:''} ${bay.fit?`«${bay.fit.detail}»`:''}`);
  }
  L.push('');
  L.push('## דלתות');
  if (ly.doorSys.type==='sliding') L.push(`   ${ly.doorSys.note} — קוד ${ly.doorSys.code}`);
  else for (const d of ly.doorSys.doors) L.push(`   ${d.bay}: ${d.leaves}×${d.code} (כנף ${d.leafW})`);
  if (ly.topbox) L.push(`\n## ארגז-על (Top box)\n   ${ly.topbox.code} — גובה ${ly.topbox.h} × רוחב ${ly.topbox.w}`);
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
 * 7. CLI
 * ================================================================== */
function main(){
  const args=process.argv.slice(2);
  const hinged=args.includes('--hinged');
  const reachIn=args.includes('--reach-in');
  const wi=args.indexOf('--wall'); const wall= wi>=0? +args[wi+1]:null;
  const oi=args.indexOf('--out');  const outDir= oi>=0? args[oi+1]: path.join(__dirname,'out');
  let file=args.find((a,i)=>!a.startsWith('--') && args[i-1]!=='--wall' && args[i-1]!=='--out');
  if(!file){
    const cand=[ path.join(__dirname,'..','..','..','converter','analysis','out','allelem','allelem.ordx'),
                 path.join(__dirname,'sample_room.json') ];
    file=cand.find(f=>fs.existsSync(f));
  }
  if(!file){ console.error('לא נמצא קובץ קלט.'); process.exit(1); }
  const room=C.loadRoom(file);
  const result=plan(room,{hinged,reachIn,wall});
  const rep=report(result);
  console.log(rep);
  try{
    fs.mkdirSync(outDir,{recursive:true});
    const base=path.basename(file).replace(/\.[^.]+$/,'');
    fs.writeFileSync(path.join(outDir,`${base}_wardrobe_plan.md`),rep,'utf8');
    fs.writeFileSync(path.join(outDir,`${base}_wardrobe_plan.json`),
      JSON.stringify({ wall:result.layout&&result.layout.wall.num, run:result.layout&&result.layout.run,
        bays:result.layout&&result.layout.bays, doors:result.layout&&result.layout.doorSys,
        modules:moduleList(result), warnings:result.warnings },null,2),'utf8');
    console.error(`\n[נשמר] ${outDir}`);
  }catch(e){ console.error('שמירה נכשלה:',e.message); }
}
if (require.main===module) main();
module.exports={ plan, report, moduleList, FITOUT, BAY_WIDTHS };
