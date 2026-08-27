#!/usr/bin/env node
/*
 * plan_laundry.js — Soline "Soli" Laundry / Utility Planning Module
 * ------------------------------------------------------------------
 * Turns a room MEASUREMENT (walls + services, from the Soline model) into a
 * carpenter's LAUNDRY / UTILITY PLAN. Appliances are SERVICE-ANCHORED: the
 * washer sits on the measured water+drain point, the dryer on the vent duct
 * (or stacks over the washer). Around them:
 *   - a folding COUNTERTOP on base cabinets (900mm) across the rest of the run,
 *   - UPPER cabinets in the [1500,2100] band,
 *   - a TALL broom/utility cabinet at one end,
 *   - an optional SINK base on a second water+drain point.
 *
 * INPUT CONTRACT: identical to the Soli kitchen module (walls + fixtures);
 * see ../_lib/carpentry_core.js.
 *
 * IP NOTE: Public standards (see STANDARDS.md) + Soline's own logic only.
 *
 * Usage:
 *   node plan_laundry.js <room.ordx|room.json> [--wall N] [--us] [--stacked]
 *        [--sink] [--no-tall] [--out DIR]
 *   node plan_laundry.js            (defaults to the allelem sample)
 * ------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../_lib/carpentry_core.js');

/* ==================================================================
 * 1. CATALOG / STANDARDS (mirrors STANDARDS.md + MODULE_CATALOG.md). mm.
 * ================================================================== */
const APP_W_EU     = 600;    // washer/dryer front width (EU / IL)
const APP_W_US     = 685;    // 27" US front-load
const APP_H        = 850;    // appliance height (fits under a 900 worktop)
const APP_GAP      = 25;     // gap between side-by-side machines (vibration)
const STACK_H      = 1800;   // stacked washer+dryer column height
const REAR_CLEAR   = 150;    // rear clearance for taps / drain hose (>=6")

const WORKTOP_H    = 900;    // folding countertop height (36")
const BASE_DEPTH   = 600;    // base-cabinet / worktop depth (24")
const BASE_WIDTHS  = [900, 800, 600, 500, 450, 400];   // LB folding-base carcasses

const UPPER_BOT    = 1500;   // upper band floor (>=600 above the 900 worktop)
const UPPER_TOP    = 2100;
const UPPER_DEPTH  = 350;
const UPPER_WIDTHS = [800, 600, 500, 450, 400];        // LU wall cabinets

const TALL_W       = 600;    // tall broom / utility cabinet
const TALL_TOP     = 2100;

const SINK_W       = 600;    // sink base (separate water+drain)

const FRONT_CLEAR_MIN = 1065;  // front clearance to load/unload (42"-48")
const MIN_RUN      = 600;
const MIN_FILLER   = 30;

/* ==================================================================
 * 2. WALL SCORING — the wall that carries the laundry services wins:
 *    water + drain (for the washer) score highest; duct + elec add.
 * ================================================================== */
const SVC_SCORE = { water:50, drain:50, duct:20, elec:15, tv:0, data:0, gas:0 };

function baseSpan(analysis){
  const spans = C.bandSpans(analysis, 0, WORKTOP_H, MIN_FILLER);
  let best=null;
  for (const s of spans){ if(!best || (s.b-s.a)>(best.b-best.a)) best=s; }
  return { spans, best };
}
function wallScore(analysis){
  let sc = 0;
  for (const s of analysis.services) sc += (SVC_SCORE[s.kind]||0);
  const { best } = baseSpan(analysis);
  sc += best ? (best.b-best.a)/1000 : 0;   // tie-break by clear length
  return sc;
}

/* Nearest service point of a kind inside [a,b], closest to a target x. */
function nearestSvc(services, kind, a, b, target){
  const pts = services.filter(s=>s.kind===kind && s.x>=a && s.x<=b);
  if (!pts.length) return null;
  pts.sort((p,q)=>Math.abs(p.x-target)-Math.abs(q.x-target));
  return pts[0];
}

/* Room depth = shortest wall perpendicular to the chosen wall (for front clear). */
function roomDepth(room, wall){
  const dx=wall.ex-wall.sx, dy=wall.ey-wall.sy, L=Math.hypot(dx,dy)||1;
  const ux=dx/L, uy=dy/L; let depth=null;
  for (const o of room.walls){
    if (o.num===wall.num) continue;
    const odx=o.ex-o.sx, ody=o.ey-o.sy, oL=Math.hypot(odx,ody)||1;
    const dot=Math.abs((odx/oL)*ux+(ody/oL)*uy);
    if (dot<0.2){ if (depth==null || o.length<depth) depth=o.length; }
  }
  return depth;
}

/* ==================================================================
 * 3. APPLIANCE BLOCK — anchor the washer on water+drain; the dryer
 *    beside it (or stacked). Returns the [a,b] the block occupies.
 * ================================================================== */
function planAppliances(chosen, run, opts, warnings){
  const appW = opts.us ? APP_W_US : APP_W_EU;
  const mid = (run.a+run.b)/2;
  const water = nearestSvc(chosen.services,'water', run.a, run.b, mid);
  const drain = nearestSvc(chosen.services,'drain', run.a, run.b, mid);
  const duct  = nearestSvc(chosen.services,'duct',  run.a, run.b, mid);

  // anchor X: prefer water (washer supply); else drain; else run centre
  const anchorX = water ? water.x : (drain ? drain.x : mid);

  const stacked = !!opts.stacked;
  const blockW = stacked ? appW : (appW*2 + APP_GAP);
  let a = Math.round(anchorX - blockW/2);
  let b = a + blockW;
  if (a < run.a){ a = run.a; b = run.a + blockW; }
  if (b > run.b){ b = run.b; a = run.b - blockW; }

  const machines = [];
  if (stacked){
    machines.push({ code:`LB-APP-${appW}`, w:appW, a, b:a+appW, h:STACK_H,
                    role:'עמודת מכונה+מייבש (מוערם)', z1:STACK_H });
  } else {
    machines.push({ code:`LB-APP-${appW}`, w:appW, a, b:a+appW, h:APP_H,
                    role:'מכונת-כביסה', z1:APP_H });
    machines.push({ code:`LB-APP-${appW}`, w:appW, a:a+appW+APP_GAP, b:b, h:APP_H,
                    role:'מייבש', z1:APP_H, gapBefore:APP_GAP });
  }

  return { a, b, w:blockW, appW, stacked, machines, anchorX,
           svc:{ water, drain, duct } };
}

/* ==================================================================
 * 4. MAIN PLANNER
 * ================================================================== */
function plan(room, opts={}){
  const analyses = room.walls.map(w=>C.analyseWall(w));
  const warnings=[];

  // choose wall: explicit --wall, else the best-scoring service wall
  let chosen;
  if (opts.wall!=null){
    chosen = analyses.find(a=>a.wall.num===opts.wall);
    if(!chosen) warnings.push(`קיר ${opts.wall} לא נמצא — נבחר אוטומטית.`);
  }
  if(!chosen){
    let best=null;
    for (const a of analyses){ const sc=wallScore(a); if(!best || sc>best.sc) best={a,sc}; }
    chosen = best && best.a;
  }
  if(!chosen) return { room, warnings:['לא נמצא קיר מתאים לחדר-כביסה.'], layout:null };

  const { best } = baseSpan(chosen);
  const run = best || { a:0, b:chosen.L };
  const runW = run.b - run.a;
  if (runW < MIN_RUN)
    warnings.push(`הקטע הפנוי הגדול ביותר בקיר ${chosen.wall.num} = ${runW|0}מ"מ < ${MIN_RUN} — צר לחדר-כביסה.`);

  const kinds = new Set(chosen.services.map(s=>s.kind));

  // ---- appliance block (service-anchored) ----
  const app = planAppliances(chosen, run, opts, warnings);

  // ---- optional sink on a SECOND water(+drain) point away from the washer ----
  let sink = null;
  if (opts.sink){
    const w2 = chosen.services.filter(s=>s.kind==='water' && (s.x<app.a-100 || s.x>app.b+100));
    if (w2.length){
      const sx = w2[0].x;
      let sa = Math.round(sx - SINK_W/2), sb = sa + SINK_W;
      if (sa < run.a){ sa=run.a; sb=run.a+SINK_W; }
      if (sb > run.b){ sb=run.b; sa=run.b-SINK_W; }
      // keep the sink outside the appliance block
      if (!(sb>app.a && sa<app.b)){
        sink = { code:`LB-SINK-${SINK_W}`, w:SINK_W, a:sa, b:sb };
      }
    }
    if (!sink) warnings.push('כיור התבקש אך לא נמצאה נקודת-מים פנויה נפרדת מהמכונה — הכיור בוטל; לתאם נקודת מים+ניקוז.');
  }

  // ---- optional tall broom cabinet at whichever run end has room ----
  const blocks = [ [app.a, app.b] ];
  if (sink) blocks.push([sink.a, sink.b]);
  let tall = null;
  const wantTall = !opts.noTall;
  if (wantTall){
    // try the start of the run, then the end
    const leftFree  = Math.min(app.a, sink?sink.a:app.a) - run.a;
    const rightFree = run.b - Math.max(app.b, sink?sink.b:app.b);
    if (leftFree >= TALL_W){
      tall = { code:`LT-${TALL_W}`, w:TALL_W, h:TALL_TOP, a:run.a, b:run.a+TALL_W };
      blocks.push([tall.a, tall.b]);
    } else if (rightFree >= TALL_W){
      tall = { code:`LT-${TALL_W}`, w:TALL_W, h:TALL_TOP, a:run.b-TALL_W, b:run.b };
      blocks.push([tall.a, tall.b]);
    } else {
      warnings.push(`אין מקום לארון-שירות גבוה (${TALL_W}) בקצוות הריצה — בוטל.`);
    }
  }

  // ---- folding countertop base cabinets fill the remaining base gaps ----
  const baseFree = C.subtract(runW, blocks.map(([a,b])=>[a-run.a, b-run.a]), MIN_FILLER);
  const baseGroups = [];
  for (const seg of baseFree){
    const a = run.a + seg.a, b = run.a + seg.b;
    const mods = C.fillSegment(b-a, BASE_WIDTHS, 'LB', { minFiller:MIN_FILLER, fillerPrefix:'LF' });
    C.layFrom(a, mods);
    baseGroups.push({ a, b, mods });
  }

  // ---- upper cabinets in [1500,2100], skipping above a stacked column ----
  const upperSpans = C.bandSpans(chosen, UPPER_BOT, UPPER_TOP, MIN_FILLER);
  const uppers = [];
  for (const s of upperSpans){
    let a = Math.max(s.a, run.a), b = Math.min(s.b, run.b);
    if (b - a < 400) continue;
    // a stacked column reaches 1800 -> no upper directly over it
    if (app.stacked && !(b<=app.a || a>=app.b)){
      // split around the stacked column
      const parts=[];
      if (app.a - a >= 400) parts.push([a, app.a]);
      if (b - app.b >= 400) parts.push([app.b, b]);
      for (const [pa,pb] of parts){
        const mods=C.fillSegment(pb-pa, UPPER_WIDTHS,'LU',{minFiller:MIN_FILLER,fillerPrefix:'LF'});
        C.layFrom(pa,mods); uppers.push({a:pa,b:pb,mods});
      }
      continue;
    }
    const mods = C.fillSegment(b-a, UPPER_WIDTHS, 'LU', { minFiller:MIN_FILLER, fillerPrefix:'LF' });
    C.layFrom(a, mods);
    uppers.push({ a, b, mods });
  }

  // ==================== VALIDATIONS / WARNINGS ====================
  // washer needs water + drain
  if (!kinds.has('water') || !kinds.has('drain')){
    const miss=[]; if(!kinds.has('water')) miss.push('מים'); if(!kinds.has('drain')) miss.push('ניקוז');
    warnings.push(`חסר ${miss.join('+')} בקיר — אין להתקין מכונת-כביסה/כיור עד תיאום אינסטלציה (מים + ניקוז).`);
  }
  // dryer needs a vent duct (unless condensation dryer)
  if (!kinds.has('duct'))
    warnings.push('אין תעלת-אוורור נמדדת — מייבש-פינוי לא יתאוורר; להתקין תעלה או לבחור מייבש-קונדנסציה.');
  // both need power
  if (!kinds.has('elec'))
    warnings.push('אין נקודת-חשמל נמדדת — לתאם הזנת חשמל למכונה/מייבש.');
  // front clearance to load/unload
  const rd = roomDepth(room, chosen.wall);
  if (rd != null){
    const front = rd - BASE_DEPTH;
    if (front < FRONT_CLEAR_MIN)
      warnings.push(`מרווח-חזית לטעינה/פריקה ~${front|0}מ"מ (עומק-חדר ${rd|0}−בסיס ${BASE_DEPTH}) < ${FRONT_CLEAR_MIN} — צפוף לפתיחת-דלת/פריקה.`);
  }
  // rear clearance note
  warnings.push(`מרווח-אחורי ≥${REAR_CLEAR}מ"מ לברזים/צינור-ניקוז מאחורי המכונה (מקטין עומק-שימושי).`);
  // floor drain -> anti-flood pan
  const floorDrain = chosen.services.find(s=>s.kind==='drain' && (s.y||0)<50);
  if (floorDrain)
    warnings.push(`ניקוז-רצפתי @${floorDrain.x|0} — מומלץ מגש אנטי-הצפה תחת המכונה מחובר לניקוז.`);
  // services behind a plain base cabinet (not appliance/sink) become covered
  for (const s of chosen.services){
    if (s.x<run.a || s.x>run.b) continue;
    const atApp  = s.x>=app.a && s.x<=app.b;
    const atSink = sink && s.x>=sink.a && s.x<=sink.b;
    if (!atApp && !atSink && (s.kind==='water'||s.kind==='drain'||s.kind==='gas'))
      warnings.push(`קיר ${chosen.wall.num}: נקודת ${s.kind} @${s.x|0} מאחורי ארון-בסיס רגיל (לא מכשיר/כיור) — מכוסה/לא-מנוצלת; לתאם מיקום.`);
  }
  // openings / beams crossing the base run
  for (const bl of chosen.blockers){
    if (bl.b>run.a && bl.a<run.b)
      warnings.push(`קיר ${chosen.wall.num}: ${bl.kind} @${((bl.a+bl.b)/2)|0} חוצה את קו-הבסיס — הריצה מתקצרת/מתפצלת.`);
  }
  // upper band interruption
  if (!uppers.length)
    warnings.push('אין קטע פנוי ברצועת-העליונות [1500,2100] בריצה — עליונות בוטלו/צומצמו (בדוק חלון/קורה).');

  const layout = {
    wall:chosen.wall, run, runW, worktopH:WORKTOP_H, baseDepth:BASE_DEPTH,
    app, sink, tall, baseGroups, uppers, upperDepth:UPPER_DEPTH,
    us:!!opts.us, stacked:app.stacked, notes:chosen.notes
  };
  return { room, chosen, layout, warnings, opts:{ us:!!opts.us, stacked:app.stacked, sink:!!opts.sink } };
}

/* ==================================================================
 * 5. MODULE (CUT) LIST
 * ================================================================== */
function moduleList(result){
  const L=result.layout; if(!L) return {};
  const arrays=[];
  for (const g of L.baseGroups) arrays.push(g.mods);
  for (const u of L.uppers) arrays.push(u.mods);
  const counts=C.moduleListFrom(arrays);
  for (const m of L.app.machines) counts[m.code]=(counts[m.code]||0)+1;
  if (L.sink) counts[L.sink.code]=(counts[L.sink.code]||0)+1;
  if (L.tall) counts[L.tall.code]=(counts[L.tall.code]||0)+1;
  return counts;
}

/* ==================================================================
 * 6. REPORT (Hebrew)
 * ================================================================== */
function report(result){
  const out=[]; const ly=result.layout;
  out.push(`# תוכנית חדר-כביסה / שירות — ${result.room.name}`);
  out.push('');
  if(!ly){ out.push('לא הופקה תוכנית.'); for(const w of result.warnings) out.push(`   ⚠ ${w}`); return out.join('\n'); }
  out.push(`תקן: ${ly.us?'ארה"ב (27")':'EU/ישראל (600)'} · מכונות ${ly.stacked?'מוערמות':'זו-לצד-זו'} · משטח-קיפול ${ly.worktopH}מ"מ · עומק-בסיס ${ly.baseDepth}מ"מ`);
  out.push(`קיר ${ly.wall.num} (אורך ${ly.wall.length|0}) · ריצת-בסיס ${ly.run.a|0}–${ly.run.b|0} (${ly.runW|0}מ"מ)`);
  out.push('');

  out.push('## פסי-גובה (Bands)');
  out.push(`   בסיס/מכשירים [0–${ly.worktopH}] (משטח-קיפול מעל) · עליונות [${UPPER_BOT}–${UPPER_TOP}] (עומק ${ly.upperDepth}) · ארון-שירות גבוה [0–${TALL_TOP}]`);
  out.push('');

  out.push('## מכשירים (Appliances) — עוגן-שירות');
  const sv=ly.app.svc;
  out.push(`   עוגן X=${ly.app.anchorX|0} (מים ${sv.water?'@'+(sv.water.x|0):'—'} · ניקוז ${sv.drain?'@'+(sv.drain.x|0):'—'} · אוורור ${sv.duct?'@'+(sv.duct.x|0):'—'})`);
  for (const m of ly.app.machines)
    out.push(`   [${m.a|0}–${m.b|0}] ${m.code} (${m.w}מ"מ) — ${m.role}`);
  out.push('');

  if (ly.tall){
    out.push('## ארון-שירות גבוה (Tall / broom)');
    out.push(`   [${ly.tall.a|0}–${ly.tall.b|0}] ${ly.tall.code} (${ly.tall.w}×גובה ${ly.tall.h})`);
    out.push('');
  }
  if (ly.sink){
    out.push('## כיור (Sink)');
    out.push(`   [${ly.sink.a|0}–${ly.sink.b|0}] ${ly.sink.code} (${ly.sink.w}מ"מ) — מים+ניקוז נפרדים`);
    out.push('');
  }

  out.push('## משטח-קיפול על ארונות-בסיס (Folding countertop base)');
  if(!ly.baseGroups.length) out.push('   אין (הריצה נוצלה למכשירים/כיור/ארון-גבוה).');
  for (const g of ly.baseGroups){ out.push(`   קטע [${g.a|0}–${g.b|0}]:`);
    for (const m of g.mods) out.push(`      ${C.seg(m)}${m.filler?' (מילוי)':''}`); }
  out.push('');

  out.push('## ארוניות-עליונות (Upper cabinets)');
  if(!ly.uppers.length) out.push('   אין / חסום.');
  for (const u of ly.uppers){ out.push(`   קטע [${u.a|0}–${u.b|0}]:`);
    for (const m of u.mods) out.push(`      ${C.seg(m)}${m.filler?' (מילוי)':''}`); }
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
 * 7. CLI
 * ================================================================== */
function main(){
  const args=process.argv.slice(2);
  const us=args.includes('--us');
  const stacked=args.includes('--stacked');
  const sink=args.includes('--sink');
  const noTall=args.includes('--no-tall');
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
  const result=plan(room,{wall,us,stacked,sink,noTall});
  const rep=report(result);
  console.log(rep);
  try{
    fs.mkdirSync(outDir,{recursive:true});
    const base=path.basename(file).replace(/\.[^.]+$/,'');
    fs.writeFileSync(path.join(outDir,`${base}_laundry_plan.md`),rep,'utf8');
    fs.writeFileSync(path.join(outDir,`${base}_laundry_plan.json`),
      JSON.stringify({ wall:result.layout&&result.layout.wall.num, run:result.layout&&result.layout.run,
        appliances:result.layout&&result.layout.app, sink:result.layout&&result.layout.sink,
        tall:result.layout&&result.layout.tall, baseGroups:result.layout&&result.layout.baseGroups,
        uppers:result.layout&&result.layout.uppers,
        modules:moduleList(result), warnings:result.warnings },null,2),'utf8');
    console.error(`\n[נשמר] ${outDir}`);
  }catch(e){ console.error('שמירה נכשלה:',e.message); }
}
if (require.main===module) main();
module.exports={ plan, report, moduleList, planAppliances, BASE_WIDTHS, APP_W_EU, APP_W_US };
