#!/usr/bin/env node
/*
 * carpentry_core.js — Soline "Soli" shared carpentry planning engine
 * ------------------------------------------------------------------
 * The geometry + input engine shared by every carpentry planning module
 * (wardrobe, walk-in, vanity, media wall, bookshelf, home office, entry,
 * laundry, kids, under-stairs). Each `plan_<type>.js` requires this file
 * for the MEASUREMENT-MODEL INPUT CONTRACT and the wall/band analysis,
 * then supplies its own MODULE CATALOG and placement logic.
 *
 * INPUT CONTRACT (identical to the Soli kitchen module):
 *   room = { name, walls:[ Wall ] }
 *   Wall = { num, sx,sy,ex,ey, length, height, thick, fixtures:[ Fixture ] }
 *   Fixture = { name, desc, w, h, x, y }
 *      x = position ALONG the wall (treated as CENTRE of the fixture)
 *      y = height above floor (window = sill; floor opening/door = 0)
 *      w,h = fixture width & height (mm)
 *
 * IP NOTE: Built entirely from public industry standards and Soline's own
 * logic. Reads no third-party CAD/module/DWG file. Self-contained: only
 * Node's `fs`/`path`.
 * ------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');

/* ==================================================================
 * 1. INPUT PARSING — .ordx (Soline Measure / InnoDraw XML) or .json
 *    This is the shared, public input contract. Identical shape to the
 *    kitchen module so any room model flows into every carpentry type.
 * ================================================================== */
function parseOrdx(xml){
  const walls = [];
  const blocks = xml.split('<Wall>').slice(1);
  for (const wb of blocks){
    const g = (re)=>{ const m = wb.match(re); return m ? m[1] : null; };
    const num = g(/<Number>(\d+)<\/Number>/);
    if (num === null) continue;
    const wall = {
      num: +num,
      sx:+g(/<StartX>([-\d.]+)<\/StartX>/), sy:+g(/<StartY>([-\d.]+)<\/StartY>/),
      ex:+g(/<EndX>([-\d.]+)<\/EndX>/),     ey:+g(/<EndY>([-\d.]+)<\/EndY>/),
      length:+g(/<Length>([-\d.]+)<\/Length>/),
      height:+(g(/<Height>([-\d.]+)<\/Height>/)||2600),
      thick:+(g(/<Thick>([-\d.]+)<\/Thick>/)||100),
      fixtures:[]
    };
    const fxs = wb.split('<Fixture>').slice(1);
    for (const fx of fxs){
      const fg=(re)=>{ const m=fx.match(re); return m?m[1]:null; };
      wall.fixtures.push({
        name:(fg(/<Name>([^<]+)<\/Name>/)||'').trim(),
        desc:(fg(/<Description>([^<]*)<\/Description>/)||'').trim(),
        w:+(fg(/<Width>([-\d.]+)<\/Width>/)||0),
        h:+(fg(/<Height>([-\d.]+)<\/Height>/)||0),
        x:+(fg(/<X>([-\d.]+)<\/X>/)||0),
        y:+(fg(/<Y>([-\d.]+)<\/Y>/)||0)
      });
    }
    walls.push(wall);
  }
  return { name:(xml.match(/<Name>([^<]+)<\/Name>/)||[])[1]||'room', walls };
}

function loadRoom(file){
  const raw = fs.readFileSync(file,'utf8');
  if (file.toLowerCase().endsWith('.json')) return JSON.parse(raw);
  return parseOrdx(raw);
}

/* ==================================================================
 * 2. FIXTURE CLASSIFICATION — bilingual (HE/EN) keyword match.
 *    Extended beyond the kitchen set to cover every carpentry service:
 *    plumbing, electrical, data/TV, HVAC, plus openings & obstacles.
 * ================================================================== */
function classify(fx){
  const s = (fx.name+' '+fx.desc).toLowerCase();
  const has = (...k)=>k.some(w=>s.includes(w));
  // --- openings & obstacles (block modules) ---
  if (has('window','חלון'))                                    return {kind:'window', opening:true};
  if (has('door','doorway','דלת','מפתח','משקוף','פתח'))         return {kind:'door', opening:true};
  if (has('beam','קורה','pillar','עמוד','הנמכה','column'))       return {kind:'beam', obstacle:true};
  // --- plumbing ---
  if (has('drain','ניקוז','sewer','ביוב'))                      return {kind:'drain', service:true};
  if (has('water supply','צינור מים','water','מים'))            return {kind:'water', service:true};
  // --- gas ---
  if (has('gas','גז'))                                          return {kind:'gas', service:true};
  // --- data / tv / cable ---
  if (has('tv','טלוויז','coax','קואקס','antenna','אנטנה'))       return {kind:'tv', service:true};
  if (has('network','data','lan','ethernet','רשת','תקשורת'))    return {kind:'data', service:true};
  // --- ventilation / duct ---
  if (has('duct','vent','אוורור','תעלה','מפוח','exhaust'))       return {kind:'duct', service:true};
  // --- electrical (broad) ---
  if (has('duplex','socket','שקע','power','חשמל','מוצר חשמל','מתג','outlet')) return {kind:'elec', service:true};
  // --- ignorable / cosmetic ---
  if (has('light','מנורה','תקרה','ceiling'))                    return {kind:'ceiling'};  // ceiling — ignored
  if (has('פאנל','panel','skirt','baseboard'))                  return {kind:'panel'};    // low baseboard
  return {kind:'other'};
}

/* Interval [x0,x1] the fixture occupies ALONG the wall (X = centre). */
function interval(fx){ const half=(fx.w||0)/2; return [fx.x-half, fx.x+half]; }

/* Vertical band [z0,z1] the fixture occupies (mm above floor). */
function vertBand(fx, c, wallH){
  if (c.kind==='door')   return [0, fx.h||wallH];               // floor opening
  if (c.kind==='window') return [fx.y, fx.y+(fx.h||1200)];      // y = sill
  if (c.kind==='beam'){
    // full-height pillar (starts at floor & tall) vs ceiling drop (high up)
    if ((fx.y||0) < 100 && (fx.h||0) >= wallH*0.8) return [0, wallH];
    return [fx.y||0, (fx.y||0)+(fx.h||0)];
  }
  return [fx.y||0, (fx.y||0)+(fx.h||0)];
}

/* ==================================================================
 * 3. WALL ANALYSIS — classify every fixture, collect blockers+services.
 *    A "blocker" is an opening/obstacle with a vertical band; a module
 *    is only blocked when its own band overlaps the blocker's band.
 * ================================================================== */
function analyseWall(wall){
  const L = wall.length, H = wall.height||2600;
  const blockers = [], services = [], notes = [];
  for (const fx of wall.fixtures){
    const c = classify(fx); fx._c = c;
    const [a,b] = interval(fx);
    if (c.opening || c.obstacle){
      const [z0,z1] = vertBand(fx, c, H);
      blockers.push({ a, b, z0, z1, kind:c.kind, fx });
      if (c.kind==='window') notes.push(`חלון @${fx.x|0} (סף ${fx.y|0}, רום ${(fx.y+(fx.h||0))|0})`);
      else if (c.kind==='door') notes.push(`פתח/דלת @${fx.x|0} רוחב ${fx.w|0}`);
      else notes.push(`מכשול @${fx.x|0} (${fx.w|0}×${fx.h|0}, גובה ${fx.y|0})`);
    } else if (c.service){
      services.push({ kind:c.kind, x:fx.x, y:fx.y, name:fx.name, fx });
    }
  }
  return { L, H, blockers, services, notes, wall };
}

/* [0,L] minus a set of [a,b] intervals -> list of free {a,b} (>= minFree). */
function subtract(L, blocks, minFree=30){
  const b = blocks.map(([a,b])=>[Math.max(0,a),Math.min(L,b)]).filter(([a,b])=>b>a)
                  .sort((x,y)=>x[0]-y[0]);
  const free=[]; let cur=0;
  for (const [a,e] of b){ if (a>cur) free.push({a:cur,b:a}); cur=Math.max(cur,e); }
  if (cur<L) free.push({a:cur,b:L});
  return free.filter(s=>s.b-s.a>=minFree);
}

/* Free spans on the wall for a module occupying vertical band [z0,z1].
 * Only blockers whose band overlaps [z0,z1] remove length. */
function bandSpans(analysis, z0, z1, minFree=30){
  const overlapping = analysis.blockers
    .filter(bl => bl.z1 > z0 && bl.z0 < z1)
    .map(bl => [bl.a, bl.b]);
  return subtract(analysis.L, overlapping, minFree);
}

/* ==================================================================
 * 4. GREEDY LINEAR FILL of a segment length with a width menu.
 *    widths: descending list. prefix: module code prefix (e.g. 'WB').
 *    Leftover >= minFiller becomes a filler module; smaller is absorbed
 *    as `scribe` on the previous module.
 * ================================================================== */
function fillSegment(len, widths, prefix, opts={}){
  const minFiller = opts.minFiller ?? 30;
  const fillerPrefix = opts.fillerPrefix ?? (prefix+'F');
  const mods=[]; let rem = len;
  for (const w of widths){
    while (rem >= w){ mods.push({ code:`${prefix}-${w}`, w }); rem -= w; }
  }
  rem = Math.round(rem);
  if (rem >= minFiller) mods.push({ code:`${fillerPrefix}-${rem}`, w:rem, filler:true });
  else if (rem>0 && mods.length) mods[mods.length-1].scribe = rem;
  return mods;
}

/* Lay a filled sequence into absolute positions starting at `start`. */
function layFrom(start, mods){
  let x = start;
  for (const m of mods){ m.a = x; m.b = x + m.w; x = m.b; }
  return mods;
}

/* ==================================================================
 * 5. GEOMETRY — map an along-wall distance to a world (X,Y) point.
 * ================================================================== */
function worldPoint(wall, xAlong){
  const dx=wall.ex-wall.sx, dy=wall.ey-wall.sy, L=Math.hypot(dx,dy)||1;
  return { X:wall.sx+dx/L*xAlong, Y:wall.sy+dy/L*xAlong };
}
function dist(a,b){ return Math.hypot(a.X-b.X, a.Y-b.Y); }

/* ==================================================================
 * 6. REPORT HELPERS — module (cut) list + tiny markdown utilities.
 * ================================================================== */
function moduleListFrom(modArrays){
  const counts={};
  for (const arr of modArrays)
    for (const m of arr){ if(!m||!m.code) continue; counts[m.code]=(counts[m.code]||0)+1; }
  return counts;
}
function mm(v){ return `${Math.round(v)}מ"מ`; }
function seg(m){ return `[${(m.a??0)|0}–${(m.b??0)|0}] ${m.code} (${m.w}מ"מ)`+
  (m.scribe?` +סקרייב ${m.scribe}`:'')+(m.special?`  «${m.special}${m.needs?' → '+m.needs.join('+'):''}»`:''); }

module.exports = {
  parseOrdx, loadRoom,
  classify, interval, vertBand,
  analyseWall, subtract, bandSpans,
  fillSegment, layFrom,
  worldPoint, dist,
  moduleListFrom, mm, seg
};
