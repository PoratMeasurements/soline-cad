#!/usr/bin/env node
/*
 * plan_vanity.js — Soline "Soli" Bathroom Vanity Planning Module
 * ------------------------------------------------------------------
 * Turns a room MEASUREMENT (walls + services, from the Soline model) into a
 * carpenter's BATHROOM VANITY PLAN. The SINK is SERVICE-ANCHORED: the sink
 * base centres on the measured water+drain point so the tap + P-trap land
 * behind it. Around the sink:
 *   - a continuous COUNTERTOP over the run,
 *   - drawer/door BASE cabinets filling the rest of the [0,base] band,
 *   - a MIRROR / medicine cabinet above the sink,
 *   - an optional TALL linen tower at one end,
 *   - an optional SECOND sink (--double) on a second water point.
 *
 * INPUT CONTRACT: identical to the Soli kitchen module (walls + fixtures);
 * see ../_lib/carpentry_core.js.
 *
 * IP NOTE: Public standards (see STANDARDS.md) + Soline's own logic only.
 *
 * Usage:
 *   node plan_vanity.js <room.ordx|room.json> [--wall N] [--comfort]
 *        [--double] [--tower] [--out DIR]
 *   node plan_vanity.js            (defaults to the allelem sample)
 * ------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../_lib/carpentry_core.js');

/* ==================================================================
 * 1. CATALOG / STANDARDS (mirrors STANDARDS.md + MODULE_CATALOG.md). mm.
 * ================================================================== */
const BASE_H_STD    = 850;   // standard vanity top height (32"-34")
const BASE_H_COMF   = 900;   // comfort height (36")
const BASE_DEPTH    = 550;   // vanity base depth (21"-22")
const TOE_H         = 100;   // kickboard
const TOP_THICK     = 30;    // countertop slab

const SINK_MENU     = [900, 800, 700, 600];   // sink-base width menu (single)
const SINK_MIN      = 600;   // narrowest practical sink base
const BASE_WIDTHS   = [800, 600, 500, 450, 400, 300];   // VB drawer/door carcasses

const MIRROR_BOT    = 1100;  // mirror bottom (above the backsplash)
const MIRROR_TOP    = 1900;  // mirror / medicine-cabinet top
const LIGHT_H       = 2000;  // vanity sconce / mirror-light height (informational)

const TALL_W        = 400;   // linen tower width (300-400)
const TALL_TOP      = 2000;

const FRONT_CLEAR_MIN  = 600;   // clear floor in front of the vanity (21"-30")
const FRONT_CLEAR_GOOD = 750;
const MIN_RUN       = 600;
const MIN_FILLER    = 30;

/* ==================================================================
 * 2. WALL SCORING — the wall carrying water+drain wins.
 * ================================================================== */
const SVC_SCORE = { water:50, drain:50, elec:10, duct:5, gas:0, tv:0, data:0 };

function baseSpan(analysis, baseH){
  const spans = C.bandSpans(analysis, 0, baseH, MIN_FILLER);
  let best=null;
  for (const s of spans){ if(!best || (s.b-s.a)>(best.b-best.a)) best=s; }
  return { spans, best };
}
function wallScore(analysis, baseH){
  let sc=0;
  for (const s of analysis.services) sc += (SVC_SCORE[s.kind]||0);
  const { best } = baseSpan(analysis, baseH);
  sc += best ? (best.b-best.a)/1000 : 0;
  return sc;
}
function nearestSvc(services, kind, a, b, target){
  const pts = services.filter(s=>s.kind===kind && s.x>=a && s.x<=b);
  if (!pts.length) return null;
  pts.sort((p,q)=>Math.abs(p.x-target)-Math.abs(q.x-target));
  return pts[0];
}
function roomDepth(room, wall){
  const dx=wall.ex-wall.sx, dy=wall.ey-wall.sy, L=Math.hypot(dx,dy)||1;
  const ux=dx/L, uy=dy/L; let depth=null;
  for (const o of room.walls){
    if (o.num===wall.num) continue;
    const odx=o.ex-o.sx, ody=o.ey-o.sy, oL=Math.hypot(odx,ody)||1;
    if (Math.abs((odx/oL)*ux+(ody/oL)*uy)<0.2){ if(depth==null||o.length<depth) depth=o.length; }
  }
  return depth;
}

/* Place a sink base of a menu width, centred on x, clamped into [lo,hi]. */
function placeSink(x, lo, hi){
  const avail = hi - lo;
  let w = SINK_MENU.find(m=>m<=avail) ?? SINK_MIN;
  if (w > avail) w = Math.max(0, avail);
  let a = Math.round(x - w/2), b = a + w;
  if (a < lo){ a=lo; b=lo+w; }
  if (b > hi){ b=hi; a=hi-w; }
  return { a, b, w };
}

/* ==================================================================
 * 3. MAIN PLANNER
 * ================================================================== */
function plan(room, opts={}){
  const baseH = opts.comfort ? BASE_H_COMF : BASE_H_STD;
  const analyses = room.walls.map(w=>C.analyseWall(w));
  const warnings=[];

  // choose wall: explicit --wall, else best-scoring water+drain wall
  let chosen;
  if (opts.wall!=null){
    chosen = analyses.find(a=>a.wall.num===opts.wall);
    if(!chosen) warnings.push(`קיר ${opts.wall} לא נמצא — נבחר אוטומטית.`);
  }
  if(!chosen){
    let best=null;
    for (const a of analyses){ const sc=wallScore(a,baseH); if(!best || sc>best.sc) best={a,sc}; }
    chosen = best && best.a;
  }
  if(!chosen) return { room, warnings:['לא נמצא קיר מתאים לארון-אמבטיה.'], layout:null };

  const { best } = baseSpan(chosen, baseH);
  const run = best || { a:0, b:chosen.L };
  const runW = run.b - run.a;
  if (runW < MIN_RUN)
    warnings.push(`הקטע הפנוי הגדול ביותר בקיר ${chosen.wall.num} = ${runW|0}מ"מ < ${MIN_RUN} — צר לארון-אמבטיה.`);

  const kinds = new Set(chosen.services.map(s=>s.kind));
  const mid = (run.a+run.b)/2;

  // ---- optional tall linen tower at one end (reserve first) ----
  let tall=null; let effA=run.a, effB=run.b;
  if (opts.tower && runW - TALL_W >= MIN_RUN){
    tall = { code:`VT-${TALL_W}`, w:TALL_W, h:TALL_TOP, a:run.b-TALL_W, b:run.b };
    effB = run.b - TALL_W;
  } else if (opts.tower){
    warnings.push(`אין מקום למגדל-פשתן (${TALL_W}) לצד הארון — בוטל.`);
  }

  // ---- sink(s): anchor on water(+drain) point(s) ----
  const water = nearestSvc(chosen.services,'water', effA, effB, mid);
  const drain = nearestSvc(chosen.services,'drain', effA, effB, mid);
  const anchorX = water ? water.x : (drain ? drain.x : (effA+effB)/2);
  const sinks=[];
  const s1 = placeSink(anchorX, effA, effB);
  s1.code = `VB-SINK-${s1.w}`; s1.role='כיור';
  sinks.push(s1);

  if (opts.double){
    // second sink on a second water point on the OTHER side of the run centre
    const others = chosen.services.filter(s=>s.kind==='water' && Math.abs(s.x-anchorX)>200 && s.x>=effA && s.x<=effB);
    if (others.length){
      const x2 = others[0].x;
      const half = effA + (effB-effA)/2;
      const lo = x2 < half ? effA : Math.min(s1.b+50, effB);
      const hi = x2 < half ? Math.max(s1.a-50, effA) : effB;
      if (hi-lo >= SINK_MIN){
        const s2 = placeSink(x2, lo, hi);
        if (!(s2.b>s1.a && s2.a<s1.b)){ s2.code=`VB-SINK-${s2.w}`; s2.role='כיור-שני'; sinks.push(s2); }
      }
    }
    if (sinks.length<2) warnings.push('כיור-כפול התבקש אך אין נקודת-מים שנייה פנויה — נבנה כיור בודד; לתאם מים+ניקוז נוספים.');
  }

  // ---- base cabinets fill the rest of the base band ----
  const blocks = sinks.map(s=>[s.a, s.b]);
  if (tall) blocks.push([tall.a, tall.b]);
  const baseFree = C.subtract(runW, blocks.map(([a,b])=>[a-run.a, b-run.a]), MIN_FILLER);
  const baseGroups=[];
  for (const seg of baseFree){
    const a=run.a+seg.a, b=run.a+seg.b;
    const mods=C.fillSegment(b-a, BASE_WIDTHS,'VB',{minFiller:MIN_FILLER,fillerPrefix:'VF'});
    C.layFrom(a,mods); baseGroups.push({a,b,mods});
  }

  // ---- countertop over the base run (excludes the tall tower) ----
  const topA = run.a, topB = tall ? tall.a : run.b;
  const countertop = { code:`VTOP-${Math.round(topB-topA)}`, a:topA, b:topB, w:Math.round(topB-topA), h:baseH, thick:TOP_THICK, depth:BASE_DEPTH };

  // ---- mirror(s) above each sink, band [1100,1900] ----
  const mirrors = sinks.map(s=>({ code:`VMIR-${s.w}`, a:s.a, b:s.b, w:s.w, z0:MIRROR_BOT, z1:MIRROR_TOP }));

  // ==================== VALIDATIONS / WARNINGS ====================
  if (!kinds.has('water') || !kinds.has('drain')){
    const miss=[]; if(!kinds.has('water')) miss.push('מים'); if(!kinds.has('drain')) miss.push('ניקוז');
    warnings.push(`חסר ${miss.join('+')} בקיר — הכיור אינו ניתן-לחיבור עד תיאום אינסטלציה (מים + ניקוז + סיפון).`);
  } else if (water && drain && Math.abs(water.x-drain.x) > 400){
    warnings.push(`נקודת-מים @${water.x|0} ונקודת-ניקוז @${drain.x|0} מרוחקות (${Math.abs(water.x-drain.x)|0}מ"מ) — לוודא שהסיפון והברז נכנסים תחת אותו כיור.`);
  }
  if (!kinds.has('elec'))
    warnings.push('אין נקודת-חשמל נמדדת — לתאם תאורת-מראה/ספוט ושקע-מגן (GFCI) בגובה ~1100–2000.');
  // front clearance
  const rd = roomDepth(room, chosen.wall);
  if (rd != null){
    const front = rd - BASE_DEPTH;
    if (front < FRONT_CLEAR_MIN)
      warnings.push(`מרווח-חזית ~${front|0}מ"מ (עומק-חדר ${rd|0}−בסיס ${BASE_DEPTH}) < ${FRONT_CLEAR_MIN} — צר לעמידה מול הכיור.`);
    else if (front < FRONT_CLEAR_GOOD)
      warnings.push(`מרווח-חזית ~${front|0}מ"מ — תקין (מומלץ ≥${FRONT_CLEAR_GOOD}).`);
  }
  // water/drain behind a PLAIN base (not a sink) is wasted/covered
  for (const s of chosen.services){
    if (s.x<run.a || s.x>run.b) continue;
    const atSink = sinks.some(k=>s.x>=k.a && s.x<=k.b);
    if (!atSink && (s.kind==='water'||s.kind==='drain'))
      warnings.push(`קיר ${chosen.wall.num}: נקודת ${s.kind} @${s.x|0} מאחורי ארון-בסיס רגיל (לא כיור) — מכוסה/לא-מנוצלת; לתאם מיקום כיור/נקודה.`);
  }
  // openings / beams crossing the base run
  for (const bl of chosen.blockers){
    if (bl.b>run.a && bl.a<run.b)
      warnings.push(`קיר ${chosen.wall.num}: ${bl.kind} @${((bl.a+bl.b)/2)|0} חוצה את קו-הבסיס — הריצה מתקצרת/מתפצלת.`);
  }
  // wet-room reminders (always)
  warnings.push('סביבה רטובה: חזית/גוף עמידי-לחות (MDF מצופה/PVC/דיקט-ימי), רגליות-ALU מוגבהות, וסיליקון איטום בין המשטח לקיר.');

  const layout = {
    wall:chosen.wall, run, runW, baseH, baseDepth:BASE_DEPTH, comfort:!!opts.comfort,
    sinks, countertop, baseGroups, mirrors, tall,
    svc:{ water, drain }, notes:chosen.notes
  };
  return { room, chosen, layout, warnings, opts:{ comfort:!!opts.comfort, double:!!opts.double, tower:!!tall } };
}

/* ==================================================================
 * 4. MODULE (CUT) LIST
 * ================================================================== */
function moduleList(result){
  const L=result.layout; if(!L) return {};
  const arrays=[]; for (const g of L.baseGroups) arrays.push(g.mods);
  const counts=C.moduleListFrom(arrays);
  for (const s of L.sinks) counts[s.code]=(counts[s.code]||0)+1;
  for (const m of L.mirrors) counts[m.code]=(counts[m.code]||0)+1;
  counts[L.countertop.code]=(counts[L.countertop.code]||0)+1;
  if (L.tall) counts[L.tall.code]=(counts[L.tall.code]||0)+1;
  return counts;
}

/* ==================================================================
 * 5. REPORT (Hebrew)
 * ================================================================== */
function report(result){
  const out=[]; const ly=result.layout;
  out.push(`# תוכנית ארון-אמבטיה — ${result.room.name}`);
  out.push('');
  if(!ly){ out.push('לא הופקה תוכנית.'); for(const w of result.warnings) out.push(`   ⚠ ${w}`); return out.join('\n'); }
  out.push(`גובה-משטח ${ly.baseH}מ"מ${ly.comfort?' (comfort)':''} · עומק-בסיס ${ly.baseDepth}מ"מ · כיורים ${ly.sinks.length}`);
  out.push(`קיר ${ly.wall.num} (אורך ${ly.wall.length|0}) · ריצת-בסיס ${ly.run.a|0}–${ly.run.b|0} (${ly.runW|0}מ"מ)`);
  out.push('');

  out.push('## פסי-גובה (Bands)');
  out.push(`   בסיס [0–${ly.baseH}] (משטח מעל) · מראה/ארונית-מראה [${MIRROR_BOT}–${MIRROR_TOP}] · מגדל-פשתן [0–${TALL_TOP}]`);
  out.push('');

  out.push('## כיור(ים) — עוגן-שירות');
  out.push(`   מים ${ly.svc.water?'@'+(ly.svc.water.x|0):'—'} · ניקוז ${ly.svc.drain?'@'+(ly.svc.drain.x|0):'—'}`);
  for (const s of ly.sinks) out.push(`   [${s.a|0}–${s.b|0}] ${s.code} (${s.w}מ"מ) — ${s.role}`);
  out.push('');

  out.push('## משטח (Countertop)');
  out.push(`   [${ly.countertop.a|0}–${ly.countertop.b|0}] ${ly.countertop.code} (${ly.countertop.w}×עומק ${ly.countertop.depth}, גובה ${ly.countertop.h})`);
  out.push('');

  if (ly.tall){
    out.push('## מגדל-פשתן (Tall linen tower)');
    out.push(`   [${ly.tall.a|0}–${ly.tall.b|0}] ${ly.tall.code} (${ly.tall.w}×גובה ${ly.tall.h})`);
    out.push('');
  }

  out.push('## ארונות-בסיס (Base cabinets)');
  if(!ly.baseGroups.length) out.push('   אין (הריצה נוצלה לכיור/מגדל).');
  for (const g of ly.baseGroups){ out.push(`   קטע [${g.a|0}–${g.b|0}]:`);
    for (const m of g.mods) out.push(`      ${C.seg(m)}${m.filler?' (מילוי)':''}`); }
  out.push('');

  out.push('## מראה / ארונית-מראה (Mirror)');
  for (const m of ly.mirrors) out.push(`   [${m.a|0}–${m.b|0}] ${m.code} (${m.w}מ"מ) · רצועה ${m.z0}–${m.z1}`);
  out.push('');

  out.push('## רשימת מודולים (Module / Cut list)');
  for (const [code,n] of Object.entries(moduleList(result)).sort()) out.push(`   ${n}× ${code}`);
  out.push('');

  out.push('## אזהרות / קונפליקטים');
  if(!result.warnings.length) out.push('   אין.');
  for (const w of result.warnings) out.push(`   ⚠ ${w}`);
  return out.join('\n');
}

/* ==================================================================
 * 6. CLI
 * ================================================================== */
function main(){
  const args=process.argv.slice(2);
  const comfort=args.includes('--comfort');
  const dbl=args.includes('--double');
  const tower=args.includes('--tower');
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
  const result=plan(room,{wall,comfort,double:dbl,tower});
  const rep=report(result);
  console.log(rep);
  try{
    fs.mkdirSync(outDir,{recursive:true});
    const base=path.basename(file).replace(/\.[^.]+$/,'');
    fs.writeFileSync(path.join(outDir,`${base}_vanity_plan.md`),rep,'utf8');
    fs.writeFileSync(path.join(outDir,`${base}_vanity_plan.json`),
      JSON.stringify({ wall:result.layout&&result.layout.wall.num, run:result.layout&&result.layout.run,
        sinks:result.layout&&result.layout.sinks, countertop:result.layout&&result.layout.countertop,
        baseGroups:result.layout&&result.layout.baseGroups, mirrors:result.layout&&result.layout.mirrors,
        tall:result.layout&&result.layout.tall,
        modules:moduleList(result), warnings:result.warnings },null,2),'utf8');
    console.error(`\n[נשמר] ${outDir}`);
  }catch(e){ console.error('שמירה נכשלה:',e.message); }
}
if (require.main===module) main();
module.exports={ plan, report, moduleList, placeSink, SINK_MENU, BASE_WIDTHS };
