#!/usr/bin/env node
/*
 * plan_walkin.js — Soline "Soli" Walk-in Closet (חדר ארונות) Planning Module
 * -------------------------------------------------------------------------
 * A walk-in closet is a ROOM lined with full-height wardrobe-style runs on
 * MULTIPLE walls, plus an optional centre ISLAND. Unlike the single-wall
 * wardrobe module, this planner loops over ALL walls: for every wall it
 * computes the largest clear full-height span, fills it with CB carcass bays,
 * and assigns an interior fit-out (double-hang / long-hang / shelves /
 * drawers / shoe). It detects the closet's own DOOR opening and keeps that
 * wall clear, then decides the LAYOUT SHAPE (single / parallel / L / U) from
 * how many walls carry a usable run, checks the walking AISLE between
 * opposing runs, and places a centre ISLAND only if >= aisle is left on all
 * four sides.
 *
 * INPUT CONTRACT: identical to the Soli kitchen/wardrobe modules (walls +
 * fixtures); see ../_lib/carpentry_core.js.
 *
 * IP NOTE: Public standards (see STANDARDS.md) + Soline's own logic only.
 *
 * Usage:
 *   node plan_walkin.js <room.ordx|room.json> [--depth MM] [--no-island]
 *                       [--out DIR]
 *   node plan_walkin.js            (defaults to the allelem sample)
 * -------------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../_lib/carpentry_core.js');

/* ==================================================================
 * 1. CATALOG / STANDARDS (mirrors MODULE_CATALOG.md + STANDARDS.md). mm.
 * ================================================================== */
const UNIT_H       = 2400;   // standard full-height carcass
const RUN_DEPTH    = 610;    // hanging run depth 24" so hangers clear
const TOPBOX_MIN   = 150;    // build an upper (CU) only if this much to ceiling
const BAY_WIDTHS   = [1000, 900, 800, 600, 500, 450, 400];
const MIN_RUN      = 600;    // below this a wall is not worth a run
const MIN_FILLER   = 30;

// Walking aisle between opposing runs (public standards, see STANDARDS.md).
const AISLE_ABS    = 610;    // 24" — absolute min to squeeze past
const AISLE_OK     = 900;    // 36" — practical one-person / wheelchair min
const AISLE_COMF   = 1070;   // 42" — comfortable, a drawer can open

// Centre island.
const ISLAND_H         = 950;   // top 36–40"
const ISLAND_DEPTH_MIN = 600;
const ISLAND_DEPTH_MAX = 900;
const ISLAND_WIDTH_MAX = 1400;
const ISLAND_AISLE     = 900;   // >=36" clear on ALL four sides

// Interior fit-out kinds (shared with the wardrobe module; CI- prefix).
const FITOUT = {
  DBL: { code:'CI-DBL', label:'כפול-תלייה', railTop:2075, railBot:1030 },
  LNG: { code:'CI-LNG', label:'תלייה-ארוכה', rail:1750 },
  SHF: { code:'CI-SHF', label:'מדפים', pitch:320 },
  DRW: { code:'CI-DRW', label:'מגירות', banks:5 },
  SHO: { code:'CI-SHO', label:'נעליים', pitch:180 }
};
const MIX = ['DBL','DBL','LNG','SHF','DBL','DBL','LNG','DRW','SHO'];

/* ==================================================================
 * 2. HELPERS
 * ================================================================== */
// Largest clear full-height span on a wall.
function bestSpan(analysis){
  const spans = C.bandSpans(analysis, 0, UNIT_H, MIN_FILLER);
  let best=null;
  for (const s of spans){ if(!best || (s.b-s.a)>(best.b-best.a)) best=s; }
  return { spans, best };
}

// Does this wall carry the closet's own door opening (a floor doorway)?
function isDoorWall(analysis){
  return analysis.blockers.some(b => b.kind==='door' && b.z0 < 100);
}

// Assign an interior purpose to each carcass bay from the rotating mix.
function fitOut(bays, startIdx){
  let i = startIdx;
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
  return i;
}

// Orientation of a wall: 'H' runs mainly along X, 'V' mainly along Y.
function orient(wall){
  return Math.abs(wall.ex-wall.sx) >= Math.abs(wall.ey-wall.sy) ? 'H' : 'V';
}
// Perpendicular coordinate of a wall (its Y for H walls, X for V walls).
function perp(wall){ return orient(wall)==='H' ? (wall.sy+wall.ey)/2 : (wall.sx+wall.ex)/2; }

/* ==================================================================
 * 3. MAIN PLANNER
 * ================================================================== */
function plan(room, opts={}){
  const depth = opts.depth || RUN_DEPTH;
  const wantIsland = opts.island !== false;
  const analyses = room.walls.map(w => C.analyseWall(w));
  const warnings = [];

  // ---- 3a. per-wall run decision ----
  let mixIdx = 0;
  const walls = analyses.map(a => {
    const { spans, best } = bestSpan(a);
    const door = isDoorWall(a);
    const runW = best ? (best.b - best.a) : 0;
    const rec = { a, num:a.wall.num, spans, best, door, runW, run:null, bays:[], topbox:null };

    if (door){
      rec.status = 'door';   // entry wall — keep clear
      return rec;
    }
    if (runW < MIN_RUN){
      rec.status = 'short';  // no usable run
      return rec;
    }
    // build a full-height run in the largest span
    const bays = C.fillSegment(runW, BAY_WIDTHS, 'CB', { minFiller:MIN_FILLER, fillerPrefix:'CF' });
    C.layFrom(best.a, bays);
    mixIdx = fitOut(bays, mixIdx);
    rec.run = best; rec.bays = bays; rec.status = 'run';

    // upper cabinet (CU) to the ceiling
    const ceil = a.H;
    if (ceil - UNIT_H >= TOPBOX_MIN){
      rec.topbox = { code:`CU-${Math.round(ceil-UNIT_H)}`, h:Math.round(ceil-UNIT_H), w:Math.round(runW) };
    }
    return rec;
  });

  const runWalls = walls.filter(w => w.status==='run');

  // ---- 3b. layout shape ----
  const shape = decideShape(runWalls);

  // ---- 3c. aisle check between opposing runs (per axis) ----
  const aisles = computeAisles(room, walls, depth);

  // ---- 3d. centre island ----
  const interior = interiorClear(room, walls, depth);
  let island = null;
  if (wantIsland){
    const availW = interior.w - 2*ISLAND_AISLE;
    const availD = interior.d - 2*ISLAND_AISLE;
    if (availW >= ISLAND_DEPTH_MIN && availD >= ISLAND_DEPTH_MIN){
      // island long dimension along the wider clear axis
      let iw, idp;
      if (availW >= availD){ iw = Math.min(availW, ISLAND_WIDTH_MAX); idp = Math.min(availD, ISLAND_DEPTH_MAX); }
      else                 { iw = Math.min(availD, ISLAND_WIDTH_MAX); idp = Math.min(availW, ISLAND_DEPTH_MAX); }
      iw = Math.round(iw); idp = Math.round(idp);
      island = { code:`CISL-${iw}x${idp}`, w:iw, d:idp, h:ISLAND_H,
                 fit:{ code:FITOUT.DRW.code, label:'מגירות', detail:`בנקי-מגירות דו-צדדיים, מרום ${ISLAND_H}` } };
    } else {
      warnings.push(`אי-מרכזי לא נכנס: הפנים הפנוי ${interior.w|0}×${interior.d|0}, ואחרי מעבר ${ISLAND_AISLE} מכל צד נשאר ${Math.max(0,availW)|0}×${Math.max(0,availD)|0} < ${ISLAND_DEPTH_MIN}מ"מ אי מינימלי.`);
    }
  }

  // ---- 3e. validations / warnings ----
  for (const w of walls){
    // services falling behind a run become inaccessible
    if (w.status==='run'){
      for (const s of w.a.services){
        if (s.x>=w.run.a && s.x<=w.run.b)
          warnings.push(`קיר ${w.num}: נקודת ${s.kind} @${s.x|0} תיפול מאחורי הריצה — לא נגישה. יש להעביר/לנתק לפני התקנה.`);
      }
      // an opening/obstacle crossing the run
      for (const bl of w.a.blockers){
        if (bl.b>w.run.a && bl.a<w.run.b)
          warnings.push(`קיר ${w.num}: ${bl.kind} @${((bl.a+bl.b)/2)|0} חוצה את קו-הריצה — הריצה מתקצרת/מתפצלת.`);
      }
    }
    if (w.status==='door')
      warnings.push(`קיר ${w.num}: קיר-כניסה (פתח-דלת) — נשאר פנוי לגישה; לא הונחה עליו ריצה.`);
  }
  // aisle warnings
  for (const ax of aisles){
    if (!ax.between) continue;
    if (ax.aisle < AISLE_ABS)
      warnings.push(`מעבר ב${ax.label} = ${ax.aisle|0}מ"מ < ${AISLE_ABS} — חסום, אי-אפשר לעבור. יש לדלל ריצה/עומק.`);
    else if (ax.aisle < AISLE_OK)
      warnings.push(`מעבר ב${ax.label} = ${ax.aisle|0}מ"מ < ${AISLE_OK} — צפוף (מתחת למינימום מעשי לאדם/כיסא-גלגלים).`);
    else if (ax.aisle < AISLE_COMF)
      warnings.push(`מעבר ב${ax.label} = ${ax.aisle|0}מ"מ — עובר אך פחות מ-${AISLE_COMF} הנוח (מגירה+אדם בו-זמנית).`);
  }
  if (island && interior.w - island.w < 2*ISLAND_AISLE - 1)
    warnings.push('האי מותיר פחות מ-900מ"מ מעבר בציר-הרוחב — לצמצם רוחב-אי.');

  const layout = { shape, depth, walls, runWalls:runWalls.map(w=>w.num), aisles, interior, island };
  return { room, layout, warnings };
}

// Shape from how many walls carry a usable run, using geometry for adjacency.
function decideShape(runWalls){
  const n = runWalls.length;
  if (n===0) return { key:'none', label:'אין ריצה (אין קיר מתאים)' };
  if (n===1) return { key:'single', label:'קיר-בודד (Single-wall)' };
  if (n===2){
    const [p,q] = runWalls;
    const opposite = orient(p.a.wall)===orient(q.a.wall);   // same orientation → facing
    return opposite
      ? { key:'parallel', label:'מקבילי (Parallel — שתי ריצות מול זו-זו)' }
      : { key:'L', label:'צורת-L (שני קירות צמודים)' };
  }
  if (n===3) return { key:'U', label:'צורת-U (שלושה קירות; הפתח בקיר הרביעי)' };
  return { key:'perimeter', label:'היקפי (Perimeter — ארבעה קירות)' };
}

// Aisle between the two extreme walls of each orientation group.
function computeAisles(room, walls, depth){
  const groups = { H:[], V:[] };
  for (const w of walls) groups[orient(w.a.wall)].push(w);
  const out = [];
  for (const key of ['H','V']){
    const g = groups[key];
    if (g.length < 2) continue;
    g.sort((x,y)=>perp(x.a.wall)-perp(y.a.wall));
    const lo = g[0], hi = g[g.length-1];
    const gap = perp(hi.a.wall) - perp(lo.a.wall);
    const dLo = lo.status==='run' ? depth : 0;
    const dHi = hi.status==='run' ? depth : 0;
    // H walls sit at different Y → the aisle they leave is measured across Y (the room DEPTH axis)
    const label = key==='H' ? `ציר-העומק (בין קיר ${lo.num}↔${hi.num})`
                            : `ציר-הרוחב (בין קיר ${lo.num}↔${hi.num})`;
    out.push({ label, gap:Math.round(gap), aisle:Math.round(gap-dLo-dHi),
               between:(lo.status==='run'||hi.status==='run') });
  }
  return out;
}

// Clear interior rectangle after subtracting run depths on the bounding walls.
function interiorClear(room, walls, depth){
  const xs=[], ys=[];
  for (const w of walls){ const wl=w.a.wall; xs.push(wl.sx,wl.ex); ys.push(wl.sy,wl.ey); }
  let x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys);
  const V=walls.filter(w=>orient(w.a.wall)==='V'), H=walls.filter(w=>orient(w.a.wall)==='H');
  const runAt=(arr,cmp)=>arr.some(w=>w.status==='run' && cmp(perp(w.a.wall)));
  if (runAt(V,p=>Math.abs(p-x0)<1)) x0+=depth;
  if (runAt(V,p=>Math.abs(p-x1)<1)) x1-=depth;
  if (runAt(H,p=>Math.abs(p-y0)<1)) y0+=depth;
  if (runAt(H,p=>Math.abs(p-y1)<1)) y1-=depth;
  return { w:Math.round(x1-x0), d:Math.round(y1-y0) };
}

/* ==================================================================
 * 4. REPORT
 * ================================================================== */
function moduleList(result){
  const counts={};
  for (const w of result.layout.walls){
    for (const bay of w.bays){
      if(!bay.code) continue;
      counts[bay.code]=(counts[bay.code]||0)+1;
      if (bay.fit) counts[bay.fit.code]=(counts[bay.fit.code]||0)+1;
    }
    if (w.topbox) counts[w.topbox.code]=(counts[w.topbox.code]||0)+1;
  }
  const isl=result.layout.island;
  if (isl){ counts[isl.code]=1; counts[isl.fit.code]=(counts[isl.fit.code]||0)+1; }
  return counts;
}

function report(result){
  const L=[]; const ly=result.layout;
  L.push(`# תוכנית חדר-ארונות — ${result.room.name}`);
  L.push('');
  L.push(`צורת-פריסה: ${ly.shape.label}`);
  L.push(`עומק-ריצה ${ly.depth}מ"מ · גובה גוף ${UNIT_H}מ"מ · ריצות על קירות: ${ly.runWalls.length?ly.runWalls.join(', '):'—'}`);
  L.push('');
  L.push('## ריצות לפי קיר');
  for (const w of ly.walls){
    if (w.status==='run'){
      L.push(`### קיר ${w.num} — ריצה ${w.run.a|0}–${w.run.b|0} (${w.runW|0}מ"מ)${w.topbox?` + ארון-על ${w.topbox.code}`:''}`);
      for (const bay of w.bays){
        if (bay.filler){ L.push(`   [${bay.a|0}–${bay.b|0}] ${bay.code} (מילוי ${bay.w})`); continue; }
        L.push(`   [${bay.a|0}–${bay.b|0}] ${bay.code} (${bay.w}מ"מ) — ${bay.fit?bay.fit.label:''} ${bay.fit?`«${bay.fit.detail}»`:''}`);
      }
    } else if (w.status==='door'){
      L.push(`### קיר ${w.num} — קיר-כניסה (פתח-דלת) — נשאר פנוי`);
    } else {
      L.push(`### קיר ${w.num} — ללא ריצה (קטע-פנוי ${w.runW|0}מ"מ < ${MIN_RUN})`);
    }
  }
  L.push('');
  L.push('## מעברים (Aisle)');
  if (!ly.aisles.length) L.push('   (חדר ללא זוג-קירות מקבילים למדידה)');
  for (const ax of ly.aisles){
    const tag = ax.aisle>=AISLE_COMF?'נוח':ax.aisle>=AISLE_OK?'תקין':ax.aisle>=AISLE_ABS?'צר':'חסום';
    L.push(`   ${ax.label}: מרווח-קירות ${ax.gap} − ריצות → מעבר ${ax.aisle}מ"מ [${tag}]`);
  }
  L.push('');
  L.push('## אי-מרכזי (Island)');
  if (ly.island) L.push(`   ${ly.island.code} — ${ly.island.w}×${ly.island.d}, רום ${ly.island.h} — ${ly.island.fit.label} «${ly.island.fit.detail}»`);
  else           L.push(`   לא הונח (הפנים הפנוי ${ly.interior.w}×${ly.interior.d}מ"מ אינו מותיר ${ISLAND_AISLE} מכל צד + אי ≥${ISLAND_DEPTH_MIN}).`);
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
 * 5. CLI
 * ================================================================== */
function main(){
  const args=process.argv.slice(2);
  const di=args.indexOf('--depth'); const depth= di>=0? +args[di+1]:null;
  const noIsland=args.includes('--no-island');
  const oi=args.indexOf('--out');  const outDir= oi>=0? args[oi+1]: path.join(__dirname,'out');
  let file=args.find((a,i)=>!a.startsWith('--') && args[i-1]!=='--depth' && args[i-1]!=='--out');
  if(!file){
    const cand=[ path.join(__dirname,'..','..','..','converter','analysis','out','allelem','allelem.ordx'),
                 path.join(__dirname,'sample_room.json') ];
    file=cand.find(f=>fs.existsSync(f));
  }
  if(!file){ console.error('לא נמצא קובץ קלט.'); process.exit(1); }
  const room=C.loadRoom(file);
  const result=plan(room,{ depth, island:!noIsland });
  const rep=report(result);
  console.log(rep);
  try{
    fs.mkdirSync(outDir,{recursive:true});
    const base=path.basename(file).replace(/\.[^.]+$/,'');
    fs.writeFileSync(path.join(outDir,`${base}_walkin_plan.md`),rep,'utf8');
    fs.writeFileSync(path.join(outDir,`${base}_walkin_plan.json`),
      JSON.stringify({
        shape:result.layout.shape, depth:result.layout.depth,
        runWalls:result.layout.runWalls,
        walls:result.layout.walls.map(w=>({num:w.num,status:w.status,run:w.run,bays:w.bays,topbox:w.topbox})),
        aisles:result.layout.aisles, interior:result.layout.interior,
        island:result.layout.island, modules:moduleList(result), warnings:result.warnings
      },null,2),'utf8');
    console.error(`\n[נשמר] ${outDir}`);
  }catch(e){ console.error('שמירה נכשלה:',e.message); }
}
if (require.main===module) main();
module.exports={ plan, report, moduleList, decideShape, computeAisles, FITOUT, BAY_WIDTHS };
