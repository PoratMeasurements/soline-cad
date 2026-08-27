#!/usr/bin/env node
/*
 * plan_media.js — Soline "Soli" TV / Media-Wall Planning Module
 * ------------------------------------------------------------------
 * Turns a room MEASUREMENT (walls + services, from the Soline model) into a
 * carpenter's MEDIA-WALL PLAN centred on the real TV/coax/elec service point:
 *   - a LOW console (lowboy) band along the bottom,
 *   - an OPEN TV recess/niche (M-REC, no door) centred on the service anchor,
 *   - optional TALL flanking cabinets/bookcase at the ends,
 *   - UPPER cabinets flanking the niche + a floating shelf over the TV.
 *
 * The TV recess is a SERVICE ANCHOR: it centres on the measured tv/coax/elec
 * point so the cable pass-through + recessed media box land behind the screen.
 *
 * INPUT CONTRACT: identical to the Soli kitchen module (walls + fixtures);
 * see ../_lib/carpentry_core.js.
 *
 * IP NOTE: Public standards (see STANDARDS.md) + Soline's own logic only.
 *
 * Usage:
 *   node plan_media.js <room.ordx|room.json> [--wall N] [--tv 65]
 *                      [--out DIR]
 *   node plan_media.js            (defaults to the sample / allelem room)
 * ------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../_lib/carpentry_core.js');

/* ==================================================================
 * 1. CATALOG (mirrors MODULE_CATALOG.md). Dimensions in mm.
 * ================================================================== */
const PLAN_H       = 2100;   // media-wall planning height (bands live in [0,2100])
const LOWBOY_TOP   = 520;    // low console top height (public: 450–550)
const LOWBOY_DEPTH = 400;    // console depth (public: 350–450)
const REAR_VENT    = 60;     // rear ventilation clearance behind components (>=50)
const RECESS_GAP   = 90;     // open gap between console top and TV bottom
const UPPER_BOT    = 1450;   // upper band floor (upper cabinets/shelves [1450,2100])
const SHELF_AIR    = 120;    // airflow gap above the TV before a floating shelf

const R_MENU     = [1600, 1400, 1200];   // TV recess (open niche) width menu
const MB_WIDTHS  = [1200, 1000, 900, 800, 600];   // lowboy console carcasses
const MT_WIDTHS  = [900, 800, 600, 500, 450];     // tall flank carcasses
const MU_WIDTHS  = [900, 800, 600, 500, 450];     // upper cabinet carcasses

const FLANK_MIN  = 450;   // below this a side is too narrow for a tall flank
const UPPER_MIN  = 300;   // below this a niche-side gap becomes filler
const MIN_RUN    = 1200;  // below this the wall is too short for a media wall
const MIN_FILLER = 30;

const TV_DEFAULT = 65;    // TV diagonal (inches) if not measured / not passed

// Public: wall-mount outlet / recessed-box centre ~42" (1067) for a 55–65" TV.
const OUTLET_CENTRE = 1067;
// Public: seated eye-level TV centre window.
const EYE_LO = 1000, EYE_HI = 1100;

/* TV physical width/height (mm) for a 16:9 diagonal in inches. */
function tvSize(diagIn){
  const diagMm = diagIn * 25.4;
  const w = Math.round(diagMm * 16 / Math.hypot(16, 9));
  const h = Math.round(w * 9 / 16);
  return { w, h };
}

/* ==================================================================
 * 2. WALL SCORING — pick the wall that best hosts a media wall:
 *    the one carrying the media services (elec, ideally tv/coax + data),
 *    tie-broken by the longest clear full-height span.
 * ================================================================== */
const SVC_SCORE = { tv:100, elec:40, data:10, duct:0, water:-999, drain:-999, gas:-999 };

function fullHeightSpans(analysis){
  return C.bandSpans(analysis, 0, PLAN_H, MIN_FILLER);
}
function bestSpan(analysis){
  let best=null;
  for (const s of fullHeightSpans(analysis)) if(!best || (s.b-s.a)>(best.b-best.a)) best=s;
  return best;
}
function wallScore(analysis){
  let sc = 0;
  const kinds = new Set(analysis.services.map(s=>s.kind));
  for (const k of kinds) sc += (SVC_SCORE[k]||0);
  const b = bestSpan(analysis);
  sc += b ? (b.b-b.a)/1000 : 0;   // tiny tie-break by clear length
  return sc;
}

/* ==================================================================
 * 3. ANCHOR — the X the whole wall centres on. Priority tv/coax > elec >
 *    data; among that kind, the point nearest the free-run centre.
 * ================================================================== */
function pickAnchor(analysis, run){
  const mid = (run.a + run.b) / 2;
  for (const kind of ['tv','elec','data']){
    const pts = analysis.services.filter(s=>s.kind===kind && s.x>=run.a && s.x<=run.b);
    if (pts.length){
      pts.sort((p,q)=>Math.abs(p.x-mid)-Math.abs(q.x-mid));
      return { x: pts[0].x, kind, pt: pts[0] };
    }
  }
  return { x: mid, kind: null, pt: null };   // no service -> geometric centre
}

/* ==================================================================
 * 4. MAIN PLANNER
 * ================================================================== */
function plan(room, opts={}){
  const tvDiag = opts.tv || TV_DEFAULT;
  const tv = tvSize(tvDiag);
  const analyses = room.walls.map(w=>C.analyseWall(w));
  const warnings=[];

  // choose wall: explicit --wall, else the best-scoring media wall
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
  if(!chosen) return { room, warnings:['לא נמצא קיר מתאים לקיר-מזנון.'], layout:null };

  const run = bestSpan(chosen) || { a:0, b:chosen.L };
  const runW = run.b - run.a;
  if (runW < MIN_RUN)
    warnings.push(`הקטע הפנוי הגדול ביותר בקיר ${chosen.wall.num} = ${runW|0}מ"מ < ${MIN_RUN} — צר לקיר-מזנון.`);

  // -- service check --
  const kinds = new Set(chosen.services.map(s=>s.kind));
  if (!kinds.has('elec') && !kinds.has('tv'))
    warnings.push('לא נמצאו תשתיות-מדיה (חשמל/טלוויזיה) בקיר — לתאם חשמלאי לנקודת-שירות לפני ביצוע.');
  if (!kinds.has('tv'))
    warnings.push('אין נקודת TV/קואקס נמדדת — הנישה תמורכז על נקודת-החשמל; לתאם משיכת קואקס/HDMI.');
  if (!kinds.has('data'))
    warnings.push('אין נקודת תקשורת (data) נמדדת — מומלץ RJ45 מאחורי הצג לסטרימינג/גיימינג.');

  // -- anchor + recess --
  const anchor = pickAnchor(chosen, run);
  const desired = tv.w + 150;                       // niche = TV + ~75 each side
  let R = R_MENU.filter(r=>r>=desired).pop() ?? R_MENU[R_MENU.length-1];
  R = R_MENU.slice().reverse().find(r=>r>=desired) ?? R_MENU[R_MENU.length-1];

  // console (lowboy) target: wider than the TV, ~+300 each side, capped to run
  let consoleTarget = Math.min(runW, tv.w + 600);
  consoleTarget = Math.max(consoleTarget, R);       // never narrower than the niche

  // centre the console on the anchor, harvest leftover on each side as flanks
  const halfC = consoleTarget / 2;
  let leftFlankW  = Math.max(0, (anchor.x - halfC) - run.a);
  let rightFlankW = Math.max(0, run.b - (anchor.x + halfC));
  const leftFlank  = leftFlankW  >= FLANK_MIN;
  const rightFlank = rightFlankW >= FLANK_MIN;
  if(!leftFlank)  leftFlankW  = 0;
  if(!rightFlank) rightFlankW = 0;

  const innerA = run.a + leftFlankW;
  const innerB = run.b - rightFlankW;
  const Wi = innerB - innerA;

  // clamp recess to the inner (between-flanks) region, centred on anchor
  if (R > Wi) R = Wi;
  let rL = anchor.x - R/2, rR = anchor.x + R/2;
  if (rL < innerA){ rL = innerA; rR = innerA + R; }
  if (rR > innerB){ rR = innerB; rL = innerB - R; }
  const recess = { a: Math.round(rL), b: Math.round(rR), w: Math.round(R) };

  // -- vertical geometry of the TV --
  const tvBottom = LOWBOY_TOP + RECESS_GAP;
  const tvCentre = tvBottom + tv.h/2;
  const recessTop = Math.round(tvBottom + tv.h + SHELF_AIR);
  const shelfZ = recessTop;                         // floating shelf sits here

  // -- fill the bands with modules --
  // lowboy: continuous console across the inner region [0,LOWBOY_TOP]
  let lowboy = C.fillSegment(Wi, MB_WIDTHS, 'MB', { minFiller:MIN_FILLER, fillerPrefix:'MF' });
  C.layFrom(innerA, lowboy);

  // tall flanks (full height [0,PLAN_H])
  let flanks = [];
  if (leftFlank){ const f=C.fillSegment(leftFlankW, MT_WIDTHS,'MT',{minFiller:MIN_FILLER,fillerPrefix:'MF'});
    C.layFrom(run.a,f); flanks.push({side:'שמאל', mods:f, a:run.a, b:innerA}); }
  if (rightFlank){ const f=C.fillSegment(rightFlankW, MT_WIDTHS,'MT',{minFiller:MIN_FILLER,fillerPrefix:'MF'});
    C.layFrom(innerB,f); flanks.push({side:'ימין', mods:f, a:innerB, b:run.b}); }

  // niche-side upper cabinets (sit on the lowboy, [LOWBOY_TOP..PLAN_H]) flanking the niche
  const uppers=[];
  const gapL = recess.a - innerA, gapR = innerB - recess.b;
  if (gapL >= UPPER_MIN){ const u=C.fillSegment(gapL, MU_WIDTHS,'MU',{minFiller:MIN_FILLER,fillerPrefix:'MF'});
    C.layFrom(innerA,u); uppers.push({side:'שמאל-הנישה', mods:u, a:innerA, b:recess.a}); }
  else if (gapL >= MIN_FILLER){ uppers.push({side:'שמאל-הנישה', mods:[{code:`MF-${Math.round(gapL)}`,w:Math.round(gapL),filler:true,a:innerA,b:recess.a}], a:innerA, b:recess.a}); }
  if (gapR >= UPPER_MIN){ const u=C.fillSegment(gapR, MU_WIDTHS,'MU',{minFiller:MIN_FILLER,fillerPrefix:'MF'});
    C.layFrom(recess.b,u); uppers.push({side:'ימין-הנישה', mods:u, a:recess.b, b:innerB}); }
  else if (gapR >= MIN_FILLER){ uppers.push({side:'ימין-הנישה', mods:[{code:`MF-${Math.round(gapR)}`,w:Math.round(gapR),filler:true,a:recess.b,b:innerB}], a:recess.b, b:innerB}); }

  // floating shelf over the TV
  const shelf = { code:`MSH-${recess.w}`, w:recess.w, a:recess.a, b:recess.b, z:shelfZ };

  // the recess/niche module itself (open, no door)
  const recessMod = { code:`M-REC-${recess.w}`, w:recess.w, a:recess.a, b:recess.b,
                      z0:tvBottom, z1:recessTop, tvBottom, tvCentre:Math.round(tvCentre), tvW:tv.w, tvH:tv.h };

  // ==================== VALIDATIONS / WARNINGS ====================
  // TV centre vs seated eye-level
  if (tvCentre < EYE_LO || tvCentre > EYE_HI)
    warnings.push(`מרכז-הצג המחושב ${Math.round(tvCentre)}מ"מ מחוץ לטווח גובה-עיניים בישיבה (${EYE_LO}–${EYE_HI}) — לשקול התאמת גובה-קונסולה/הרכבה.`);

  // media box / outlet height: measured elec/tv point vs recommended 42" centre
  for (const s of chosen.services){
    if ((s.kind==='elec'||s.kind==='tv'||s.kind==='data') && s.x>=recess.a && s.x<=recess.b){
      if (Math.abs((s.y||0) - OUTLET_CENTRE) > 250)
        warnings.push(`נקודת ${s.kind} @${s.x|0} נמדדה בגובה ${s.y|0}מ"מ — מומלץ קופסת-מדיה שקועה במרכז ~${OUTLET_CENTRE} מאחורי הצג; לתאם העלאה/הוספה.`);
    }
  }

  // services that fall OUTSIDE the recess but inside the run -> behind cabinetry
  for (const s of chosen.services){
    if (s.x>=run.a && s.x<=run.b && !(s.x>=recess.a && s.x<=recess.b))
      warnings.push(`קיר ${chosen.wall.num}: נקודת ${s.kind} @${s.x|0} נופלת מחוץ לנישה (מאחורי קונסולה/ארון) — לא נגישה; למקם מחדש למרכז-הנישה או לנתק.`);
  }
  // services on the wall but outside the whole run
  for (const s of chosen.services){
    if (s.x<run.a || s.x>run.b)
      warnings.push(`קיר ${chosen.wall.num}: נקודת ${s.kind} @${s.x|0} מחוץ לריצת-היחידה — לוודא שאינה נחסמת/מיותרת.`);
  }
  // openings / beams crossing the run
  for (const bl of chosen.blockers){
    if (bl.b>run.a && bl.a<run.b)
      warnings.push(`קיר ${chosen.wall.num}: ${bl.kind} @${((bl.a+bl.b)/2)|0} חוצה את קו-היחידה — הריצה מתקצרת/מתפצלת.`);
  }
  // ventilation + cable pass-through reminders (always)
  warnings.push(`אוורור: להשאיר מרווח אחורי ≥${REAR_VENT}מ"מ מאחורי רכיבים בקונסולה + פתח-אוורור עליון (חום עולה).`);
  const cutX = anchor.pt ? Math.round(anchor.x) : Math.round((recess.a+recess.b)/2);
  warnings.push(`ניהול-כבלים: חיתוך מעבר-כבלים בגב הקונסולה והנישה מיושר ל-X=${cutX} (נקודת-השירות הנמדדת).`);

  // headroom above the plan height to the ceiling
  const head = (chosen.H||2600) - PLAN_H;
  if (head > 0) warnings.push(`מעל היחידה (${PLAN_H}) עד תקרה (${chosen.H|0}) נותרו ${head|0}מ"מ — סגירת-גבס/בלקינג עליון או השארת אוויר לפי עיצוב.`);

  const layout = {
    wall:chosen.wall, run, runW, anchor,
    tv:{diag:tvDiag, w:tv.w, h:tv.h},
    lowboyTop:LOWBOY_TOP, depth:LOWBOY_DEPTH,
    lowboy, flanks, uppers, recess:recessMod, shelf,
    innerA, innerB, notes:chosen.notes
  };
  return { room, chosen, layout, warnings, opts:{tv:tvDiag} };
}

/* ==================================================================
 * 5. MODULE (CUT) LIST
 * ================================================================== */
function moduleList(result){
  const L=result.layout; if(!L) return {};
  const arrays=[ L.lowboy ];
  for (const f of L.flanks) arrays.push(f.mods);
  for (const u of L.uppers) arrays.push(u.mods);
  const counts=C.moduleListFrom(arrays);
  counts[L.recess.code]=(counts[L.recess.code]||0)+1;
  counts[L.shelf.code]=(counts[L.shelf.code]||0)+1;
  return counts;
}

/* ==================================================================
 * 6. REPORT (Hebrew)
 * ================================================================== */
function report(result){
  const out=[]; const ly=result.layout;
  out.push(`# תוכנית קיר-מזנון / יחידת-טלוויזיה — ${result.room.name}`);
  out.push('');
  if(!ly){ out.push('לא הופקה תוכנית.'); for(const w of result.warnings) out.push(`   ⚠ ${w}`); return out.join('\n'); }
  const an = ly.anchor.kind ? `נקודת ${ly.anchor.kind} @${ly.anchor.x|0}` : `מרכז גיאומטרי @${ly.anchor.x|0}`;
  out.push(`קיר ${ly.wall.num} (אורך ${ly.wall.length|0}) · ריצת-יחידה ${ly.run.a|0}–${ly.run.b|0} (${ly.runW|0}מ"מ) · עוגן: ${an}`);
  out.push(`צג ${ly.tv.diag}" (~${ly.tv.w}×${ly.tv.h}) · קונסולה עד ${ly.lowboyTop}מ"מ · עומק ${ly.depth}מ"מ`);
  out.push('');

  out.push('## פסי-גובה (Bands)');
  out.push(`   קונסולה-נמוכה (Lowboy) [0–${ly.lowboyTop}] · נישת-TV פתוחה (M-REC) [${ly.recess.z0|0}–${ly.recess.z1|0}] · אגפים-גבוהים [0–${PLAN_H}] · עליונים [${LOWBOY_TOP}–${PLAN_H}]`);
  out.push('');

  out.push('## אגפים גבוהים (Tall flanks)');
  if(!ly.flanks.length) out.push('   אין (הרוחב נוצל כולו לקונסולה+נישה).');
  for (const f of ly.flanks){ out.push(`   ${f.side} [${f.a|0}–${f.b|0}]:`);
    for (const m of f.mods) out.push(`      ${C.seg(m)}${m.filler?' (מילוי)':''}`); }
  out.push('');

  out.push('## קונסולה-נמוכה (Lowboy console)');
  for (const m of ly.lowboy) out.push(`   ${C.seg(m)}${m.filler?' (מילוי)':''}`);
  out.push('');

  out.push('## נישת-הטלוויזיה (TV recess — פתוחה, ללא דלת)');
  out.push(`   [${ly.recess.a|0}–${ly.recess.b|0}] ${ly.recess.code} (${ly.recess.w}מ"מ) · פתח ${ly.recess.z0|0}–${ly.recess.z1|0}`);
  out.push(`   מרכז-צג בגובה ${ly.recess.tvCentre}מ"מ (יעד ישיבה ${EYE_LO}–${EYE_HI}) · תחתית-צג ${ly.recess.tvBottom|0}`);
  out.push('');

  out.push('## עליונים מסביב לנישה (Upper cabinets)');
  if(!ly.uppers.length) out.push('   אין.');
  for (const u of ly.uppers){ out.push(`   ${u.side} [${u.a|0}–${u.b|0}]:`);
    for (const m of u.mods) out.push(`      ${C.seg(m)}${m.filler?' (מילוי)':''}`); }
  out.push('');

  out.push('## מדף צף מעל הצג (Floating shelf)');
  out.push(`   [${ly.shelf.a|0}–${ly.shelf.b|0}] ${ly.shelf.code} בגובה ${ly.shelf.z|0}מ"מ`);
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
  const wi=args.indexOf('--wall'); const wall= wi>=0? +args[wi+1]:null;
  const ti=args.indexOf('--tv');   const tv  = ti>=0? +args[ti+1]:null;
  const oi=args.indexOf('--out');  const outDir= oi>=0? args[oi+1]: path.join(__dirname,'out');
  let file=args.find((a,i)=>!a.startsWith('--') && args[i-1]!=='--wall' && args[i-1]!=='--tv' && args[i-1]!=='--out');
  if(!file){
    const cand=[ path.join(__dirname,'sample_room.json'),
                 path.join(__dirname,'..','..','..','converter','analysis','out','allelem','allelem.ordx') ];
    file=cand.find(f=>fs.existsSync(f));
  }
  if(!file){ console.error('לא נמצא קובץ קלט.'); process.exit(1); }
  const room=C.loadRoom(file);
  const result=plan(room,{wall,tv});
  const rep=report(result);
  console.log(rep);
  try{
    fs.mkdirSync(outDir,{recursive:true});
    const base=path.basename(file).replace(/\.[^.]+$/,'');
    fs.writeFileSync(path.join(outDir,`${base}_media_plan.md`),rep,'utf8');
    fs.writeFileSync(path.join(outDir,`${base}_media_plan.json`),
      JSON.stringify({ wall:result.layout&&result.layout.wall.num, run:result.layout&&result.layout.run,
        anchor:result.layout&&result.layout.anchor, tv:result.layout&&result.layout.tv,
        recess:result.layout&&result.layout.recess, lowboy:result.layout&&result.layout.lowboy,
        flanks:result.layout&&result.layout.flanks, uppers:result.layout&&result.layout.uppers,
        shelf:result.layout&&result.layout.shelf,
        modules:moduleList(result), warnings:result.warnings },null,2),'utf8');
    console.error(`\n[נשמר] ${outDir}`);
  }catch(e){ console.error('שמירה נכשלה:',e.message); }
}
if (require.main===module) main();
module.exports={ plan, report, moduleList, tvSize, R_MENU, MB_WIDTHS };
