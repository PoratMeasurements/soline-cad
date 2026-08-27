#!/usr/bin/env node
/*
 * plan_understairs.js — Soline "Soli" Under-Stairs Storage Planning Module
 * -----------------------------------------------------------------------
 * Turns a room MEASUREMENT (walls + a STAIR descriptor, from the Soline
 * model) into a carpenter's UNDER-STAIRS STORAGE PLAN.
 *
 * CONCEPT: the space under a STRAIGHT staircase is a right-triangle in
 * elevation. The soffit (underside of the stringer) slopes: at along-wall
 * distance x from the LOW end, usable height  h(x) = slope * x , where
 * slope = totalRise / totalRun. Modules are placed as a STEPPED SERIES
 * whose height follows the soffit — a walk-in coat closet at the HIGH end,
 * bays/shelves in the middle, drawers lower, toe pull-outs at the LOW end,
 * and a sealed dead-corner where headroom is unusable.
 *
 * INPUT: prefer a STAIR descriptor — a fixture on a wall whose name/desc
 * contains "stair"/"מדרגות", giving run (fixture.w = total going along the
 * wall) and rise (fixture.h = total rise). Also accepts flags
 *   --run <mm> --rise <mm> [--going <mm>] [--steps <n>] [--descend]
 * If neither a stair fixture nor flags are present, sensible defaults
 * (run 3600, rise 2600) are used and a WARNING is emitted.
 *
 * INPUT CONTRACT: identical to the Soli kitchen module (walls + fixtures);
 * see ../_lib/carpentry_core.js.
 *
 * IP NOTE: Public standards (see STANDARDS.md) + Soline's own logic only.
 *
 * Usage:
 *   node plan_understairs.js <room.ordx|room.json>
 *        [--run N] [--rise N] [--going N] [--steps N] [--descend] [--out DIR]
 *   node plan_understairs.js              (defaults to the stair sample_room)
 * -----------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../_lib/carpentry_core.js');

/* ==================================================================
 * 1. CATALOG + THRESHOLDS (mirror MODULE_CATALOG.md / STANDARDS.md). mm.
 * ================================================================== */
// Headroom thresholds (usable clear height under the soffit) -> module type.
const T = {
  DEAD:   200,   // < 200  : unusable dead corner (sealed / access panel)
  PULL:   400,   // 200-400: toe pull-outs / shoe trays (UPULL)
  DRAW:   900,   // 400-900: drawer banks (UDR)
  SHELF: 1200,   // 900-1200: fixed shelves, too low to hang a garment (USH)
  BAY:   1800    // 1200-1800: bays — hang + shelves (UB) ; >=1800: walk-in (UCL)
};

// Standard carcass widths per module type (descending).
const WIDTHS = {
  UPULL: [600, 500, 450, 400],
  UDR:   [800, 600, 500, 450, 400],
  USH:   [1000, 900, 800, 600, 500, 450, 400],
  UB:    [1000, 900, 800, 600, 500, 450, 400]
};

const MIN_FILLER = 30;
const COAT_RAIL_H = 1600;   // coat rail height inside the walk-in closet
const DOOR_MAX_H  = 2040;   // standard interior door leaf height cap (~80")
const MIN_WALKIN_DOOR = 1800;
const TREAD_GOING_DEFAULT = 250;   // typical tread going if not supplied (side-open drawer depth cap)

// Zones from LOW headroom to HIGH, with the module type each hosts.
const ZONES = [
  { type:'UPULL', from:T.DEAD,  to:T.PULL,  label:'משיכונים/מגש-נעליים (בהזחה)' },
  { type:'UDR',   from:T.PULL,  to:T.DRAW,  label:'בנק-מגירות' },
  { type:'USH',   from:T.DRAW,  to:T.SHELF, label:'מדפים קבועים' },
  { type:'UB',    from:T.SHELF, to:T.BAY,   label:'תאים: תלייה + מדפים' },
  { type:'UCL',   from:T.BAY,   to:Infinity,label:'ארון-מעילים כניסה (walk-in)' }
];

/* ==================================================================
 * 2. STAIR DESCRIPTOR — from a fixture, from flags, or defaults.
 * ================================================================== */
function isStairFixture(fx){
  const s = ((fx.name||'')+' '+(fx.desc||'')).toLowerCase();
  return s.includes('stair') || s.includes('מדרג') || s.includes('מדרגות') || s.includes('staircase');
}

function findStair(room){
  for (const w of room.walls){
    for (const fx of (w.fixtures||[])){
      if (isStairFixture(fx)) return { wall:w, fx };
    }
  }
  return null;
}

/* Build the stair geometry model: {wall, run, rise, slope, a (low-end offset
 * along wall), descend, going, steps, assumed}. */
function stairModel(room, opts){
  const warnings = [];
  let wall=null, run=null, rise=null, a=0, descend=!!opts.descend;
  let going=opts.going||null, steps=opts.steps||null, source='';

  const found = findStair(room);
  if (found){
    wall = found.wall;
    const fx = found.fx;
    run  = opts.run  != null ? opts.run  : (fx.w||0);
    rise = opts.rise != null ? opts.rise : (fx.h||0);
    const half = (fx.w||0)/2;
    a = Math.max(0, fx.x - half);   // low end = fixture's low-x edge (unless --descend)
    source = `תיאור-מדרגות (fixture "${fx.name||fx.desc||'stair'}")`;
  } else if (opts.run != null || opts.rise != null){
    // flags only — place against the longest wall
    wall = room.walls.slice().sort((x,y)=>(y.length||0)-(x.length||0))[0];
    run  = opts.run  != null ? opts.run  : 3600;
    rise = opts.rise != null ? opts.rise : 2600;
    a = 0;
    source = 'דגלי --run/--rise';
  } else {
    // nothing — assume defaults
    wall = room.walls.slice().sort((x,y)=>(y.length||0)-(x.length||0))[0];
    run = 3600; rise = 2600; a = 0;
    warnings.push('לא נמצא תיאור-מדרגות ולא סופקו --run/--rise — נעשה שימוש בברירת-מחדל (מהלך 3600, רום 2600). יש למדוד את גיאומטריית-המדרגות בפועל.');
    source = 'ברירת-מחדל (מונחת)';
  }

  if (!wall){ warnings.push('אין קיר בחדר — לא ניתן למקם אחסון.'); return { warnings }; }

  // clamp run to the wall it sits on
  const wallL = wall.length || run;
  if (run > wallL - a){ run = Math.max(0, wallL - a); }

  if (!(run>0) || !(rise>0)){
    warnings.push('גיאומטריית-מדרגות לא תקינה (מהלך/רום ≤ 0).');
  }
  const slope = run>0 ? rise/run : 0;
  going = going || TREAD_GOING_DEFAULT;

  return { wall, run, rise, slope, a, descend, going, steps, source, warnings };
}

/* ==================================================================
 * 3. SOFFIT GEOMETRY
 * ================================================================== */
const heightAt = (x, slope)=> Math.max(0, slope * x);
const xAtHeight = (h, slope)=> slope>0 ? h/slope : 0;

/* Map a local along-triangle distance (0..run, 0 = LOW end) back to an
 * absolute along-wall position, honouring the stair direction. */
function absAlong(sm, xLocal){
  return sm.descend ? (sm.a + sm.run - xLocal) : (sm.a + xLocal);
}

/* ==================================================================
 * 4. PLACEMENT — build the stepped series zone-by-zone.
 * ================================================================== */
function buildZones(sm){
  const out = [];
  const slope = sm.slope, run = sm.run;

  // dead corner first (low end)
  const xDead = Math.min(run, xAtHeight(T.DEAD, slope));
  if (xDead > 1){
    out.push({ type:'DEAD', x0:0, x1:xDead, hLo:0, hHi:heightAt(xDead,slope), modules:[], label:'פינה-מתה (אטומה / דלת-שירות)' });
  }

  for (const z of ZONES){
    let x0 = xAtHeight(z.from, slope);
    let x1 = z.to===Infinity ? run : xAtHeight(z.to, slope);
    x0 = Math.max(0, Math.min(run, x0));
    x1 = Math.max(0, Math.min(run, x1));
    if (x1 - x0 < 1) continue;   // this zone does not exist for this slope
    const width = x1 - x0;
    const hLo = heightAt(x0, slope), hHi = heightAt(x1, slope);

    const zone = { type:z.type, label:z.label, x0, x1, width, hLo, hHi, modules:[] };

    if (z.type === 'UCL'){
      // Walk-in coat closet: a single volume, door at the TALL face.
      const peak = hHi;                          // height at the high end (entry face)
      const doorH = Math.min(Math.round(peak), DOOR_MAX_H);
      zone.modules.push({
        code:`UCL-${Math.round(width)}`, type:'UCL', w:Math.round(width),
        x0:Math.round(x0), x1:Math.round(x1),
        maxHeight:Math.round(hLo),               // rectangular carcass height at the low edge
        peakHeight:Math.round(peak),
        doorH, railH:COAT_RAIL_H
      });
      zone.doorH = doorH; zone.peak = Math.round(peak);
    } else {
      // Fill the zone width with standard carcasses; each carcass takes a
      // STEPPED height = the soffit at its OWN low edge (follows the slope).
      const mods = C.fillSegment(width, WIDTHS[z.type], z.type, { minFiller:MIN_FILLER, fillerPrefix:'UF' });
      C.layFrom(x0, mods);
      for (const m of mods){
        m.type = m.filler ? 'UF' : z.type;
        m.maxHeight = Math.round(heightAt(m.a, slope));   // stepped, conservative rectangular height
        m.hHi = Math.round(heightAt(m.b, slope));
        m.x0 = Math.round(m.a); m.x1 = Math.round(m.b);
      }
      zone.modules = mods;
    }
    out.push(zone);
  }
  return out;
}

/* ==================================================================
 * 5. MAIN PLANNER
 * ================================================================== */
function plan(room, opts={}){
  const warnings = [];
  const sm = stairModel(room, opts);
  if (sm.warnings) warnings.push(...sm.warnings);
  if (!sm.wall) return { room, warnings, layout:null };

  const analysis = C.analyseWall(sm.wall);
  const zones = buildZones(sm);

  // ---- validations & warnings ----
  // Walk-in door height check.
  const ucl = zones.find(z=>z.type==='UCL');
  if (ucl){
    if (ucl.doorH < MIN_WALKIN_DOOR)
      warnings.push(`ארון-הכניסה: גובה-דלת ${ucl.doorH} < ${MIN_WALKIN_DOOR} — למעשה זהו ארון-נישה (reach-in), לא walk-in.`);
    else
      warnings.push(`ארון-כניסה (walk-in): דלת בגובה ~${ucl.doorH} בקצה-הגבוה + מוט-מעילים ${COAT_RAIL_H}.`);
  } else {
    warnings.push('אין קטע בגובה ≥1800 — אין ארון-כניסה; הקצה-הגבוה מקבל תאי-תלייה (UB).');
  }

  // Dead corner note.
  const dead = zones.find(z=>z.type==='DEAD');
  if (dead){
    warnings.push(`פינה-מתה בקצה-הנמוך [${Math.round(absAlong(sm,dead.x0))}–${Math.round(absAlong(sm,dead.x1))}] (גובה <${T.DEAD}) — לאטום כ-toe-kick או להוסיף דלת-שירות קטנה לגישה.`);
  }

  // Services on the stair wall that fall UNDER / BEHIND the storage run.
  for (const s of analysis.services){
    if (s.x >= sm.a && s.x <= sm.a + sm.run){
      warnings.push(`קיר ${sm.wall.num}: נקודת ${s.kind} @${s.x|0} נופלת מתחת/מאחורי האחסון — לא נגישה. יש להעביר/לנתק לפני התקנה.`);
    }
  }
  // Structural obstacles (beam/pillar/post) within the run — must stay.
  for (const bl of analysis.blockers){
    const mid = (bl.a+bl.b)/2;
    if (mid >= sm.a && mid <= sm.a + sm.run && bl.kind!=='window'){
      warnings.push(`קיר ${sm.wall.num}: ${bl.kind} @${mid|0} בתוך תחום-האחסון — אם מדובר בזקף-מדרגות/עמוד מבני אין להסירו; לתכנן את האחסון סביבו.`);
    }
  }

  // Generic on-site obstruction check (public best-practice: note first).
  warnings.push('בדיקה באתר לפני ייצור: צנרת/ביוב, לוח-חשמל, מונה-גז, עמודים/זקף-מדרגות (stringer) — אלמנט מבני נשאר במקום; אין להסיר.');
  // Drawer depth caveat (side-opening under stairs).
  warnings.push(`עומק מגירה בפתיחה-צדית מוגבל לעומק-שלח (~${sm.going}מ"מ); משיכונים עמוקים ירוצו בניצב לתוך המשולש.`);
  if (sm.descend) warnings.push('כיוון: הקצה-הנמוך בקצה-הגבוה-של-הקיר (--descend).');

  const layout = { wall:sm.wall, stair:sm, zones, analysis, source:sm.source };
  return { room, layout, warnings, sm };
}

/* ==================================================================
 * 6. REPORT
 * ================================================================== */
function moduleList(result){
  const counts={};
  if (!result.layout) return counts;
  for (const z of result.layout.zones)
    for (const m of z.modules){ if(!m.code) continue; counts[m.code]=(counts[m.code]||0)+1; }
  return counts;
}

function report(result){
  const L=[]; const ly=result.layout;
  L.push(`# תוכנית מתחת-למדרגות — ${result.room.name}`);
  L.push('');
  if (!ly){ L.push('לא נבנתה תוכנית.'); L.push(''); L.push('## אזהרות'); for (const w of result.warnings) L.push(`   ⚠ ${w}`); return L.join('\n'); }
  const sm = ly.stair;
  L.push(`מקור-גיאומטריה: ${ly.source}`);
  L.push(`מדרגות ישרות · מהלך(run) ${sm.run|0} · רום(rise) ${sm.rise|0} · שיפוע-סוֹפִיט ${(sm.slope).toFixed(3)} (${(sm.rise/ (sm.run||1) *100)|0}%)`);
  L.push(`קיר ${sm.wall.num} (אורך ${sm.wall.length|0}) · תחום-אחסון לאורך-הקיר ${Math.round(sm.a)}–${Math.round(sm.a+sm.run)} · קצה-נמוך ב-${sm.descend?'קצה-הגבוה-של-הקיר':'קצה-הנמוך-של-הקיר'}`);
  L.push('');
  L.push('## מדרגות המשולש (סדרה מדורגת — מהנמוך לגבוה)');
  L.push('   [x0–x1 לאורך-הקיר]  גובה-סוֹפִיט hLo→hHi  ·  מודול(ים)');
  for (const z of ly.zones){
    const A0 = Math.round(absAlong(sm, z.x0)), A1 = Math.round(absAlong(sm, z.x1));
    const lo=Math.min(A0,A1), hi=Math.max(A0,A1);
    L.push(`   ── ${z.label}  [${lo}–${hi}]  גובה ${Math.round(z.hLo)}→${Math.round(z.hHi)}מ"מ`);
    if (z.type==='DEAD'){ L.push(`        (לא-שמיש — פינה-מתה)`); continue; }
    for (const m of z.modules){
      const tag = m.filler ? `מילוי` :
        (m.type==='UCL' ? `walk-in · דלת ${m.doorH} · מוט-מעילים ${m.railH} · שיא-גובה ${m.peakHeight}` :
         `גובה-שמיש ${m.maxHeight}`);
      L.push(`        ${m.code} (${m.w}מ"מ) — ${tag}`);
    }
  }
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
function numFlag(args, name){ const i=args.indexOf(name); return i>=0 ? +args[i+1] : null; }

function main(){
  const args=process.argv.slice(2);
  const opts = {
    run:   numFlag(args,'--run'),
    rise:  numFlag(args,'--rise'),
    going: numFlag(args,'--going'),
    steps: numFlag(args,'--steps'),
    descend: args.includes('--descend')
  };
  const oi=args.indexOf('--out'); const outDir= oi>=0? args[oi+1]: path.join(__dirname,'out');
  const valueFlags=new Set(['--run','--rise','--going','--steps','--out']);
  let file=args.find((a,i)=>!a.startsWith('--') && !valueFlags.has(args[i-1]));
  if(!file){
    // under-stairs needs a STAIR descriptor: prefer the stair sample_room.
    const cand=[ path.join(__dirname,'sample_room.json'),
                 path.join(__dirname,'..','..','..','converter','analysis','out','allelem','allelem.ordx') ];
    file=cand.find(f=>fs.existsSync(f));
  }
  if(!file){ console.error('לא נמצא קובץ קלט.'); process.exit(1); }
  const room=C.loadRoom(file);
  const result=plan(room,opts);
  const rep=report(result);
  console.log(rep);
  try{
    fs.mkdirSync(outDir,{recursive:true});
    const base=path.basename(file).replace(/\.[^.]+$/,'');
    fs.writeFileSync(path.join(outDir,`${base}_understairs_plan.md`),rep,'utf8');
    fs.writeFileSync(path.join(outDir,`${base}_understairs_plan.json`),
      JSON.stringify({
        wall: result.layout && result.layout.wall.num,
        stair: result.layout && { run:result.sm.run, rise:result.sm.rise, slope:result.sm.slope, source:result.layout.source },
        zones: result.layout && result.layout.zones.map(z=>({
          type:z.type, label:z.label, x0:Math.round(z.x0), x1:Math.round(z.x1),
          hLo:Math.round(z.hLo), hHi:Math.round(z.hHi),
          modules:z.modules.map(m=>({ code:m.code, w:m.w, x0:m.x0, x1:m.x1, maxHeight:m.maxHeight, doorH:m.doorH, railH:m.railH, peakHeight:m.peakHeight }))
        })),
        modules: moduleList(result),
        warnings: result.warnings
      },null,2),'utf8');
    console.error(`\n[נשמר] ${outDir}`);
  }catch(e){ console.error('שמירה נכשלה:',e.message); }
}
if (require.main===module) main();
module.exports={ plan, report, moduleList, buildZones, stairModel, ZONES, T, WIDTHS };
