#!/usr/bin/env node
/*
 * plan_entry.js — Soline "Soli" Entry / Mudroom Planning Module
 * ------------------------------------------------------------------
 * Turns a room MEASUREMENT (walls + services, from the Soline model) into
 * a carpenter's ENTRY / MUDROOM PLAN: a run of per-person "lockers" against
 * a wall. Each locker stacks vertically:
 *     BENCH (bottom) + SHOE cubby under it
 *     OPEN HOOK zone above the bench (back panel + hook rail, no carcass)
 *     UPPER cubby / closed cabinet on top
 * plus optional full-height TALL COAT lockers (with a coat rail).
 *
 * A DOOR / opening on the wall SPLITS the run into sections (the entry door
 * must stay clear). Services that fall behind a closed locker are flagged;
 * an electrical point becomes an optional charging-outlet note.
 *
 * INPUT CONTRACT: identical to the Soli kitchen module (walls + fixtures);
 * see ../_lib/carpentry_core.js.
 *
 * IP NOTE: Public standards (see STANDARDS.md) + Soline's own logic only.
 *
 * Usage:
 *   node plan_entry.js <room.ordx|room.json> [--wall N] [--per-person W]
 *                      [--coat-lockers N] [--child-rail] [--out DIR]
 *   node plan_entry.js            (defaults to the allelem sample)
 * ------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../_lib/carpentry_core.js');

/* ==================================================================
 * 1. CATALOG / STANDARDS (mirrors STANDARDS.md + MODULE_CATALOG.md).
 *    All dimensions in mm.
 * ================================================================== */
const BENCH_H       = 450;   // bench seat height (public std 450-485)
const BENCH_H_MAX   = 485;
const BENCH_DEPTH   = 400;   // bench depth (std 380-450)
const LOCKER_DEPTH  = 450;   // pro standard for hanging coats (17" hanger fits)
const LOCKER_DEPTH_MIN = 300;

const OPEN_BOTTOM   = BENCH_H;   // open hook zone starts at the bench top (450)
const UPPER_BOTTOM  = 1800;      // upper cubby underside — set above the adult
                                 // hook rail so coats clear the cabinet
const UNIT_TOP      = 2100;      // top of the locker run

const HOOK_ADULT    = 1700;  // adult hook-rail height (place within 1525-1830)
const HOOK_ADULT_MIN= 1525;
const HOOK_ADULT_MAX= 1830;
const HOOK_CHILD    = 1050;  // optional secondary child rail (std 915-1220)
const HOOK_CHILD_MIN= 915;
const HOOK_CHILD_MAX= 1220;
const HOOK_SPACING  = 280;   // hook pitch (std 250-300)

const PER_PERSON    = 360;   // default per-person locker width (std 300-380)
const PP_MIN        = 300;
const PP_MAX        = 380;
const PP_HARD_MAX   = 450;   // above this a "locker" is really two people

const TALL_COAT_RAIL= 1600;  // coat rail in a full-height coat locker
const SHOE_PITCH    = 180;   // shoe-shelf pitch under the bench (~7")

const MIN_RUN       = 700;   // below this, not worth an entry run
const MIN_FILLER    = 30;

/* ==================================================================
 * 2. WALL SCORING — pick the wall that best hosts an entry run:
 *    the longest clear span up to the unit top wins (a door/opening
 *    overlapping [0,UNIT_TOP] removes its width and splits the run).
 * ================================================================== */
function runSegments(analysis){
  return C.bandSpans(analysis, 0, UNIT_TOP, MIN_FILLER);
}
function bestSpan(analysis){
  let best=null;
  for (const s of runSegments(analysis)){ if(!best || (s.b-s.a)>(best.b-best.a)) best=s; }
  return best;
}

/* ==================================================================
 * 3. LOCKER BUILDER — split one clear segment into per-person lockers.
 *    The first `coatQuota` lockers become full-height TALL COAT lockers;
 *    the rest are BENCH + OPEN-HOOK + UPPER-CUBBY stacks.
 * ================================================================== */
function hooksFor(w){ return Math.max(1, Math.floor((w-40)/HOOK_SPACING)); }

function buildLockers(seg, opts, state){
  const segLen = seg.b - seg.a;
  const per = opts.perPerson || PER_PERSON;
  const N = Math.max(1, Math.round(segLen / per));
  const base = Math.floor(segLen / N);          // integer locker width
  const lockers=[];
  for (let i=0;i<N;i++){
    // last locker absorbs the rounding remainder
    const w = (i===N-1) ? (segLen - base*(N-1)) : base;
    const coat = state.coatLeft > 0;
    if (coat) state.coatLeft--;
    if (coat){
      lockers.push({
        kind:'coat', code:`EL-${w}`, w,
        rail:TALL_COAT_RAIL,
        parts:[{code:`EL-${w}`, w}],
        label:'ארון-מעילים גבוה'
      });
    } else {
      const hooks = hooksFor(w);
      const parts=[
        {code:`ESH-${w}`, w},      // shoe cubby under bench
        {code:`EB-${w}`,  w},      // bench seat
        {code:`EHK-${w}`, w},      // open hook zone (back panel + rail)
        {code:`EU-${w}`,  w}       // upper cubby / cabinet
      ];
      lockers.push({
        kind:'stack', code:`ELK-${w}`, w, hooks,
        railAdult:HOOK_ADULT, railChild: opts.childRail?HOOK_CHILD:null,
        parts, label:'לוקר (ספסל+ווים+תא-עליון)'
      });
    }
  }
  C.layFrom(seg.a, lockers);
  return lockers;
}

/* ==================================================================
 * 4. MAIN PLANNER
 * ================================================================== */
function plan(room, opts={}){
  const analyses = room.walls.map(w=>C.analyseWall(w));
  const warnings=[]; const notes=[];

  // choose wall: explicit --wall, else the one with the largest clear span
  let chosen;
  if (opts.wall!=null){
    chosen = analyses.find(a=>a.wall.num===opts.wall);
    if(!chosen) warnings.push(`קיר ${opts.wall} לא נמצא — נבחר אוטומטית.`);
  }
  if(!chosen){
    let best=null;
    for (const a of analyses){ const b=bestSpan(a);
      if (b && (!best || (b.b-b.a)>(best.span.b-best.span.a))) best={a,span:b}; }
    chosen = best && best.a;
  }
  if(!chosen) return { room, warnings:['לא נמצא קיר מתאים למבואה.'], sections:[] };

  const segments = runSegments(chosen);
  if (segments.length>1)
    notes.push(`פתח/דלת מפצל את הקיר ל-${segments.length} מקטעים — דלת-הכניסה נשמרת פנויה.`);
  if (!segments.length) warnings.push(`קיר ${chosen.wall.num}: אין קטע פנוי בגובה המבואה.`);

  // build lockers section by section; the coat-locker quota spans the whole run
  const state = { coatLeft: opts.coatLockers!=null ? opts.coatLockers : 1 };
  const sections=[];
  for (const seg of segments){
    const segLen = seg.b - seg.a;
    if (segLen < MIN_RUN){
      warnings.push(`קיר ${chosen.wall.num}: מקטע ${seg.a|0}–${seg.b|0} = ${segLen|0}מ"מ < ${MIN_RUN} — צר למבואה.`);
    }
    const lockers = buildLockers(seg, opts, state);
    sections.push({ seg, segLen, lockers });
  }

  // ---- validations / warnings ----
  const per = opts.perPerson || PER_PERSON;
  for (const sec of sections){
    for (const lk of sec.lockers){
      if (lk.w > PP_HARD_MAX)
        warnings.push(`לוקר ${lk.a|0}–${lk.b|0} רוחב ${lk.w} > ${PP_HARD_MAX} — רחב מדי לאדם בודד; לשקול פיצול.`);
      else if (lk.w < PP_MIN)
        warnings.push(`לוקר ${lk.a|0}–${lk.b|0} רוחב ${lk.w} < ${PP_MIN} — צר; מעיל 17" עלול לא להיכנס בנוחות.`);
      else if (lk.w > PP_MAX)
        notes.push(`לוקר ${lk.a|0}–${lk.b|0} רוחב ${lk.w} מעל ${PP_MAX} (רוחב-אדם מומלץ 300–380) — נוח, פחות לוקרים.`);
    }
  }
  // hook-rail height sanity
  if (HOOK_ADULT < HOOK_ADULT_MIN || HOOK_ADULT > HOOK_ADULT_MAX)
    warnings.push(`מוט-ווים למבוגר ${HOOK_ADULT} מחוץ לטווח התקן ${HOOK_ADULT_MIN}–${HOOK_ADULT_MAX}.`);
  else notes.push(`מוט-ווים למבוגר בגובה ${HOOK_ADULT} (תקן ${HOOK_ADULT_MIN}–${HOOK_ADULT_MAX}).`);
  if (opts.childRail){
    if (HOOK_CHILD < HOOK_CHILD_MIN || HOOK_CHILD > HOOK_CHILD_MAX)
      warnings.push(`מוט-ווים לילד ${HOOK_CHILD} מחוץ לטווח ${HOOK_CHILD_MIN}–${HOOK_CHILD_MAX}.`);
    else notes.push(`מוט-ווים משני לילד בגובה ${HOOK_CHILD} (תקן ${HOOK_CHILD_MIN}–${HOOK_CHILD_MAX}).`);
  }
  // bench sanity (fixed to standard, but state it explicitly)
  notes.push(`ספסל: גובה ${BENCH_H} (תקן ${BENCH_H}–${BENCH_H_MAX}), עומק ${BENCH_DEPTH} (תקן 380–450).`);

  // services under / behind the run
  const runA = segments.length? Math.min(...segments.map(s=>s.a)) : 0;
  const runB = segments.length? Math.max(...segments.map(s=>s.b)) : 0;
  for (const s of chosen.services){
    const inRun = s.x>=runA && s.x<=runB;
    if (!inRun) continue;
    if (s.kind==='elec'){
      notes.push(`נקודת חשמל @${s.x|0} — ניתן לשלב שקע-טעינה בתא-העליון/ספסל בסמוך.`);
    } else {
      warnings.push(`קיר ${chosen.wall.num}: נקודת ${s.kind} @${s.x|0} תיפול מאחורי ריצת-המבואה — לא נגישה. להעביר/לנתק לפני התקנה.`);
    }
  }
  // openings crossing the run footprint
  for (const bl of chosen.blockers){
    if (bl.b>runA && bl.a<runB)
      notes.push(`${bl.kind==='door'?'פתח/דלת':bl.kind} @${((bl.a+bl.b)/2)|0} מפצל/מגביל את הריצה — נשמר פנוי.`);
  }
  // headroom above the unit
  const ceil = chosen.H;
  if (ceil - UNIT_TOP >= 150)
    notes.push(`מעל ${UNIT_TOP} ועד התקרה (${ceil|0}) — ${(ceil-UNIT_TOP)|0}מ"מ פנויים לארגז-על אופציונלי.`);

  return { room, chosen, sections, warnings, notes,
           opts:{ perPerson:per, coatLockers: opts.coatLockers!=null?opts.coatLockers:1, childRail:!!opts.childRail },
           run:{a:runA,b:runB, depth:LOCKER_DEPTH} };
}

/* ==================================================================
 * 5. REPORT
 * ================================================================== */
function moduleList(result){
  const counts={};
  for (const sec of result.sections)
    for (const lk of sec.lockers)
      for (const p of lk.parts) counts[p.code]=(counts[p.code]||0)+1;
  return counts;
}

function report(result){
  const L=[];
  L.push(`# תוכנית מבואה / ארון-כניסה — ${result.room.name}`);
  L.push('');
  if (!result.chosen){ for(const w of result.warnings) L.push(`⚠ ${w}`); return L.join('\n'); }
  const o=result.opts;
  L.push(`קיר ${result.chosen.wall.num} (אורך ${result.chosen.wall.length|0}) · עומק לוקר ${result.run.depth}מ"מ · גובה ריצה ${UNIT_TOP}מ"מ`);
  L.push(`רוחב-אדם יעד ${o.perPerson}מ"מ · ארונות-מעילים גבוהים ${o.coatLockers} · מוט-ילד ${o.childRail?'כן':'לא'}`);
  L.push('');
  L.push('## מבנה אנכי (Bands)');
  L.push(`   ספסל [0–${BENCH_H}] (נעליים מתחת) · אזור-ווים פתוח [${OPEN_BOTTOM}–${UPPER_BOTTOM}] · תא-עליון [${UPPER_BOTTOM}–${UNIT_TOP}] · ארון-מעילים גבוה [0–${UNIT_TOP}]`);
  L.push('');
  let sIdx=0;
  for (const sec of result.sections){
    sIdx++;
    if (result.sections.length>1) L.push(`## מקטע ${sIdx}  [${sec.seg.a|0}–${sec.seg.b|0}] (${sec.segLen|0}מ"מ)`);
    else L.push('## לוקרים (Lockers)');
    for (const lk of sec.lockers){
      if (lk.kind==='coat'){
        L.push(`   [${lk.a|0}–${lk.b|0}] ${lk.code} (${lk.w}מ"מ) — ${lk.label} «מוט-מעילים ${lk.rail}»`);
      } else {
        const child = lk.railChild? ` + מוט-ילד ${lk.railChild}`:'';
        L.push(`   [${lk.a|0}–${lk.b|0}] ${lk.code} (${lk.w}מ"מ) — ${lk.label} «${lk.hooks} ווים @${lk.railAdult}${child}»`);
      }
    }
    L.push('');
  }
  L.push('## רשימת מודולים (Cut / Module list)');
  for (const [code,n] of Object.entries(moduleList(result)).sort()) L.push(`   ${n}× ${code}`);
  L.push('');
  if (result.notes.length){
    L.push('## הערות-תכן');
    for (const n of result.notes) L.push(`   • ${n}`);
    L.push('');
  }
  L.push('## אזהרות / קונפליקטים');
  if (!result.warnings.length) L.push('   אין.');
  for (const w of result.warnings) L.push(`   ⚠ ${w}`);
  return L.join('\n');
}

/* ==================================================================
 * 6. CLI
 * ================================================================== */
function main(){
  const args=process.argv.slice(2);
  const wi=args.indexOf('--wall');         const wall = wi>=0? +args[wi+1]:null;
  const pi=args.indexOf('--per-person');   const perPerson = pi>=0? +args[pi+1]:null;
  const ci=args.indexOf('--coat-lockers'); const coatLockers = ci>=0? +args[ci+1]:null;
  const childRail = args.includes('--child-rail');
  const oi=args.indexOf('--out');          const outDir = oi>=0? args[oi+1]: path.join(__dirname,'out');
  const valueFlags=['--wall','--per-person','--coat-lockers','--out'];
  let file=args.find((a,i)=>!a.startsWith('--') && !valueFlags.includes(args[i-1]));
  if(!file){
    const cand=[ path.join(__dirname,'..','..','..','converter','analysis','out','allelem','allelem.ordx'),
                 path.join(__dirname,'sample_room.json') ];
    file=cand.find(f=>fs.existsSync(f));
  }
  if(!file){ console.error('לא נמצא קובץ קלט.'); process.exit(1); }
  const room=C.loadRoom(file);
  const result=plan(room,{wall,perPerson,coatLockers,childRail});
  const rep=report(result);
  console.log(rep);
  try{
    fs.mkdirSync(outDir,{recursive:true});
    const base=path.basename(file).replace(/\.[^.]+$/,'');
    fs.writeFileSync(path.join(outDir,`${base}_entry_plan.md`),rep,'utf8');
    fs.writeFileSync(path.join(outDir,`${base}_entry_plan.json`),
      JSON.stringify({ wall:result.chosen&&result.chosen.wall.num, run:result.run,
        sections:result.sections&&result.sections.map(s=>({seg:s.seg, lockers:s.lockers})),
        modules:moduleList(result), notes:result.notes, warnings:result.warnings },null,2),'utf8');
    console.error(`\n[נשמר] ${outDir}`);
  }catch(e){ console.error('שמירה נכשלה:',e.message); }
}
if (require.main===module) main();
module.exports={ plan, report, moduleList, buildLockers, PER_PERSON };
