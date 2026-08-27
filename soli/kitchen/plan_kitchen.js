#!/usr/bin/env node
/*
 * plan_kitchen.js  —  Soline "Soli" Kitchen Planning Engine  (v2)
 * ==================================================================
 * Turns a room MEASUREMENT (walls + service points, from the Soline
 * model) into a carpenter-grade KITCHEN PLAN: a cabinet-run layout
 * against the walls (plus islands / peninsulas), with construction
 * parameters, hardware selection, a cut-list and a nesting pass.
 *
 * IP NOTE (חוק ברזל): Soline's own module. Built ENTIRELY from PUBLIC
 * industry standards (Blum / Häfele / GRASS / Hettich / NKBA / IKEA
 * Metod / Nobilia carcass practice / standard sheet-goods) and original
 * logic — see KITCHEN_STANDARDS.md. It does NOT read, copy or derive
 * from any third-party proprietary kitchen module or protected corpus.
 *
 * Self-contained: no external dependencies. Reads an .ordx file
 * (InnoDraw / Soline Measure XML export) or a simple room JSON.
 *
 * Usage:
 *   node plan_kitchen.js <room.ordx|room.json> [--outdoor] [--out DIR]
 *   node plan_kitchen.js            (defaults to the allelem sample)
 *
 * v2 adds: full carcass taxonomy (corners/drawer-banks/appliance
 * housings/open-glass/fillers/panels/valances/toe-kicks), Blum-based
 * hardware (hinges, Legrabox/Tandembox/Movento, Aventos, pull-outs,
 * corner solutions) with the clearances they impose, materials +
 * joinery, a per-module cut-list, a guillotine nesting pass, corner
 * detection, island/peninsula support and much richer warnings.
 * ==================================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* ==================================================================
 * 0. CONSTRUCTION CONSTANTS  (public carcass practice — 18mm system)
 * ================================================================== */
const C = {
  PANEL:        18,     // carcass panel thickness (MFC / MDF), mm
  BACK:         8,      // grooved back panel (or 3–6mm HDF in rebate)
  BACK_INSET:   13,     // back sits 13mm in from rear edge (groove line)
  TOE_H:        100,    // toe-kick (plinth) height  (100–150 adjustable)
  TOE_SETBACK:  50,     // toe recess from door face
  COUNTER_T:    30,     // worktop thickness (20–40 by material)
  COUNTER_H:    900,    // finished worktop height (720 carcass + toe + top)
  REVEAL_TOP:   2,      // reveal at top of front
  GAP_DOOR:     3,      // gap between adjacent doors / drawer fronts
  GAP_EDGE:     2,      // reveal at cabinet ends
  EDGE_FRONT:   2,      // 2mm ABS/PVC edgeband on visible front edges
  EDGE_CARCASS: 1,      // 1mm edgeband on carcass front edges
  SYS32_SETBACK:37,     // System-32 line-bore setback from front, mm
  SYS32_PITCH:  32,     // System-32 hole pitch, mm
  WORKTOP_OVERHANG: 20, // front worktop overhang past door face
};

const COUNTER_H = C.COUNTER_H;

// Carcass body depths / heights (mm)
const DEPTH = { base: 560, wall: 320, tall: 560, island: 700 };
const HEIGHT = { baseCarcass: 720, wall: 720, wallShort: 360, tall: 2100 };

// Standard module widths (industrial modularity)
const BASE_WIDTHS = [1200,1000,900,800,600,500,450,400,300,200,150];
const WALL_WIDTHS = [1000,900,800,600,500,450,400,300];
const TALL_WIDTHS = [600,500,450,400];
const MIN_FILLER = 20, MAX_FILLER = 120;   // scribe/filler range
const CORNER_RESERVE = 900;                // interior-corner allowance

/* ==================================================================
 * 1. HARDWARE LIBRARY  (public Blum / Häfele / GRASS specifications)
 *    Every entry carries the CLEARANCE it imposes on the carcass.
 * ================================================================== */
const HW = {
  // --- Hinges: 35mm cup boring, "System 32" ----------------------
  hinge: {
    cupDia: 35, cupDepth: 12.5,     // 35mm cup, ~11–13mm deep
    boreFromEdge: 5,                // door-edge → cup-centre (3–7mm)
    types: {
      full:  { name:'Clip-top full overlay',  crank:0,  overlay:'full',  angle:110 },
      half:  { name:'Clip-top half overlay',   crank:9,  overlay:'half',  angle:110 },
      inset: { name:'Clip-top inset',          crank:17, overlay:'inset', angle:110 },
      wide:  { name:'Clip-top 155° (corner)',  crank:0,  overlay:'full',  angle:155 },
      blind: { name:'Clip-top blind-corner',   crank:0,  overlay:'full',  angle:95  },
    },
    // hinges per door leaf by leaf height (public rule of thumb)
    perLeaf(h){ return h<=900?2 : h<=1600?3 : h<=2000?4 : 5; },
  },
  // --- Drawer box systems ---------------------------------------
  // Nominal lengths (NL) 270–650; box needs NL <= carcass depth − ~10.
  drawer: {
    NL: [270,300,350,400,450,500,550,600,650],
    // Blum LEGRABOX — premium steel-sided box
    legrabox: {
      name:'LEGRABOX',
      heights:{ N:66, M:90.5, C:177, F:241 },      // side heights (mm)
      load:[40,70],                                 // kg load classes
      sideThk:12.8, minCabW:150,
    },
    // Blum TANDEMBOX antaro — steel-sided box with drawer sides
    tandembox: {
      name:'TANDEMBOX antaro',
      heights:{ N:68, M:83, K:115, D:224 },
      load:[30,50,65], sideThk:13, minCabW:150,
    },
    // Blum MOVENTO — concealed undermount runner (for wood boxes/doors)
    movento: {
      name:'MOVENTO', NL:[250,300,350,400,450,500,550,600,650,700,750,760],
      load:[40,60], full_ext:true,
    },
    // side clearance the runner steals from cabinet internal width
    sideClearance: 13,   // per side (undermount / steel side)
  },
  // --- Lift systems (wall cabinets) — Blum AVENTOS ---------------
  //   ranges are cabinet (carcass) heights, mm (public data).
  aventos: {
    HF: { name:'AVENTOS HF (bi-fold)',   minH:479, maxH:1040, maxW:1800, note:'דלת-דו-חלקית מתקפלת' },
    HS: { name:'AVENTOS HS (up & over)', minH:350, maxH:800,  maxW:1800, note:'דלת מלמעלה-ומעל' },
    HL: { name:'AVENTOS HL (lift up)',   minH:300, maxH:580,  maxW:1800, note:'עולה במקביל לגוף' },
    HK: { name:'AVENTOS HK (stay lift)', minH:200, maxH:600,  maxW:1800, note:'כנף בודדת נעצרת' },
    HKtop:{name:'AVENTOS HK top',        minH:205, maxH:600,  maxW:1800, note:'ללא לוח-צד עליון' },
  },
  // --- Base pull-outs / internal solutions ----------------------
  pullout: {
    larder:  { name:'מזווה-נשלף (larder pull-out)', widths:[300,450,600], depth:500, load:70 },
    base:    { name:'מגירת-נשלף בסיס',              widths:[150,200,300], depth:500 },
    waste:   { name:'פח-מיון נשלף',                 widths:[300,450,600], depth:500 },
    towel:   { name:'מתקן-מגבות נשלף',              widths:[150],         depth:500 },
  },
  // --- Corner solutions (with the clearance each imposes) --------
  corner: {
    lazy:  { name:'קרוסלה (Lazy-Susan)',        minW:900,  door:'bi-fold', access:'מלא',  reserveAdj:600 },
    magic: { name:'Magic-Corner נשלף',           minW:900,  door:'single',  access:'מלא',  reserveAdj:600 },
    lemans:{ name:'LeMans (Kessebohmer-style)',  minW:450,  door:'single',  access:'מלא',  reserveAdj:600 },
    blind: { name:'פינה עיוורת (Blind)',         minW:850,  door:'single',  access:'חלקי', reserveAdj:600 },
    diag:  { name:'ארון-פינה אלכסוני',           minW:900,  door:'single',  access:'מלא',  reserveAdj:0, diagonal:true },
  },
};

/* Choose a drawer system + height stack for a drawer bank. */
function chooseDrawerStack(kind, carcassDepth, cabW, opening){
  const sys = kind==='pot' ? HW.drawer.tandembox : HW.drawer.legrabox;
  const NL = HW.drawer.NL.filter(n=> n <= carcassDepth - 10).pop() || 270;
  // internal width available to the drawer box
  const boxW = cabW - 2*C.PANEL - 2*HW.drawer.sideClearance;
  // stack: a low top drawer + taller drawers below (pot store), or 3 equal
  let fronts;
  if (kind==='pot'){          // deep pot drawers: 1 shallow + 2 deep
    fronts = [ {h:Math.round(opening*0.18), sys:'M'},
               {h:Math.round(opening*0.41), sys:'K'},
               {h:Math.round(opening*0.41), sys:'K'} ];
  } else if (kind==='wide5'){ fronts = new Array(5).fill(0).map(()=>({h:Math.round(opening/5), sys:'M'})); }
  else {                       // standard 3-drawer bank
    fronts = [ {h:Math.round(opening*0.22), sys:'M'},
               {h:Math.round(opening*0.39), sys:'C'},
               {h:Math.round(opening*0.39), sys:'C'} ];
  }
  return { system:sys.name, NL, boxW: Math.max(0,Math.round(boxW)), load: sys.load[sys.load.length-1], fronts };
}

/* Choose an Aventos lift for a wall cabinet of carcass height h, width w. */
function chooseLift(h, w){
  for (const k of ['HK','HL','HS','HF']){
    const a=HW.aventos[k];
    if (h>=a.minH && h<=a.maxH && w<=a.maxW) return { code:k, ...a };
  }
  return null;
}

/* Choose a corner solution given the available corner width. */
function chooseCorner(availW){
  if (availW>=HW.corner.lazy.minW)  return { code:'LAZY',  ...HW.corner.lazy };
  if (availW>=HW.corner.lemans.minW)return { code:'LEMANS',...HW.corner.lemans };
  return { code:'BLIND', ...HW.corner.blind };
}

/* ==================================================================
 * 2. MATERIALS  (sheet goods, edgeband, joinery — public practice)
 * ================================================================== */
const MAT = {
  MFC:  { name:'מלמין (MFC 18mm)',  t:18, sheet:[2800,2070], grain:false, kerf:4 },  // carcass
  MDF:  { name:'MDF צבוע/מצופה 18mm',t:18, sheet:[2800,2070], grain:false, kerf:4 },  // doors
  PLY:  { name:'דיקט (Ply 18mm)',   t:18, sheet:[2440,1220], grain:true,  kerf:4 },
  HDF:  { name:'גב HDF/מלמין 8mm',  t:8,  sheet:[2800,2070], grain:false, kerf:4 },  // backs
  SS316:{ name:'נירוסטה 316',        t:1.5,sheet:[3000,1500], grain:true,  kerf:2 },  // outdoor
};
const JOINERY = {
  dowel:    { name:'יתד עץ 8×35', use:'גוף-לגוף (סטנדרט מפעל)', pitch:'32/64' },
  confirmat:{ name:'בורג קונפירמט 7×50', use:'הרכבה-באתר / חוזק' },
  pocket:   { name:'בורג-כיס (pocket)', use:'שלד-חזית / תיקונים' },
  cam:      { name:'אקסצנטר + פין (cam-lock)', use:'פירוק-והרכבה (RTA)' },
};
const EDGE = { door:2.0, exposed:2.0, carcass:1.0 }; // mm ABS/PVC

/* ==================================================================
 * 3. MODULE CATALOG  (mirrors MODULE_CATALOG.md) — carcass taxonomy
 *    Each family has construction params; SPECIAL = functional units.
 * ================================================================== */
const CATALOG = {
  base:        { code:'SB',     family:'base', depth:DEPTH.base, h:HEIGHT.baseCarcass, hFinished:COUNTER_H, widths:BASE_WIDTHS, front:'door' },
  baseDrawer:  { code:'SB-DWR', family:'base', depth:DEPTH.base, h:HEIGHT.baseCarcass, widths:[300,400,450,500,600,800,900], front:'drawers' },
  baseOpen:    { code:'SB-OPEN',family:'base', depth:DEPTH.base, h:HEIGHT.baseCarcass, widths:[300,400,600], front:'open' },
  sink:        { code:'SB-SINK',family:'base', depth:DEPTH.base, h:HEIGHT.baseCarcass, front:'door' },
  hob:         { code:'SB-HOB', family:'base', depth:DEPTH.base, h:HEIGHT.baseCarcass, front:'drawers' },
  dishwasher:  { code:'SB-DW',  family:'appliance', depth:DEPTH.base, h:HEIGHT.baseCarcass, front:'panel' },
  ovenUnder:   { code:'SB-OVEN',family:'appliance', depth:DEPTH.base, h:HEIGHT.baseCarcass, front:'appliance' },

  wall:        { code:'SW',     family:'wall', depth:DEPTH.wall, h:HEIGHT.wall, widths:WALL_WIDTHS, front:'door' },
  wallGlass:   { code:'SW-GL',  family:'wall', depth:DEPTH.wall, h:HEIGHT.wall, widths:[400,500,600], front:'glass' },
  wallOpen:    { code:'SW-OPEN',family:'wall', depth:DEPTH.wall, h:HEIGHT.wall, widths:[400,600,800], front:'open' },
  wallLift:    { code:'SW-LIFT',family:'wall', depth:DEPTH.wall, h:HEIGHT.wall, widths:[600,800,900,1000], front:'lift' },
  overFridge:  { code:'SW-OF',  family:'wall', depth:DEPTH.tall, h:HEIGHT.wallShort, front:'door' },
  hood:        { code:'SW-HOOD',family:'wall', depth:DEPTH.wall, h:HEIGHT.wall, front:'appliance' },

  tallPantry:  { code:'ST-PAN', family:'tall', depth:DEPTH.tall, h:HEIGHT.tall, widths:TALL_WIDTHS, front:'door' },
  tallLarder:  { code:'ST-LARD',family:'tall', depth:DEPTH.tall, h:HEIGHT.tall, widths:[300,450,600], front:'pullout' },
  tallOven:    { code:'ST-OVEN',family:'tall', depth:DEPTH.tall, h:HEIGHT.tall, widths:[600], front:'appliance' },
  fridge:      { code:'ST-FRIDGE',family:'tall',depth:DEPTH.tall, h:HEIGHT.tall, widths:[600,700,900], front:'panel' },
  tallBroom:   { code:'ST-BROOM',family:'tall', depth:DEPTH.tall, h:HEIGHT.tall, widths:[400,500], front:'door' },

  cornerBase:  { code:'SC-B',   family:'corner', depth:DEPTH.base, h:HEIGHT.baseCarcass },
  cornerWall:  { code:'SC-W',   family:'corner', depth:DEPTH.wall, h:HEIGHT.wall },

  filler:      { code:'SF',     family:'filler', depth:DEPTH.base },
  panelEnd:    { code:'SP-END', family:'panel',  depth:DEPTH.base, front:'panel' },
  panelBack:   { code:'SP-BACK',family:'panel' },
  valance:     { code:'SV',     family:'valance' },   // pelmet / light-rail
  toeKick:     { code:'STK',    family:'toekick', h:C.TOE_H },
};

// Functional appliance/service units + services each requires + clearance
const SPECIAL = {
  SINK:  { code:'SB-SINK',  cat:'sink',      prio:10, widthPref:[900,800], needs:['water','drain'],  front:'door',      clearance:{workL:300,workR:300} },
  HOB:   { code:'SB-HOB',   cat:'hob',       prio:9,  widthPref:[800,600], needs:['gas_or_elec'],     front:'drawers',   clearance:{workL:400,workR:400,noWindowAbove:true} },
  OVEN:  { code:'ST-OVEN',  cat:'ovenUnder', prio:6,  widthPref:[600],     needs:['elec'],            tall:true, front:'appliance', clearance:{landing:400} },
  DW:    { code:'SB-DW',    cat:'dishwasher',prio:4,  widthPref:[600,450], needs:['water','drain','elec'], front:'panel', clearance:{nearSink:true} },
  FRIDGE:{ code:'ST-FRIDGE',cat:'fridge',    prio:7,  widthPref:[700,600], needs:['elec'],            tall:true, front:'panel', clearance:{landing:380,vent:true} },
  HOOD:  { code:'SW-HOOD',  cat:'hood',      prio:8,  widthPref:[900,750,600], needs:['duct','elec'], wall:true, front:'appliance', clearance:{overHob:true} },
  MICRO: { code:'ST-MICRO', cat:'tallOven',  prio:3,  widthPref:[600],     needs:['elec'],            tall:true, front:'appliance' },
};

/* ==================================================================
 * 4. INPUT PARSING  —  .ordx (XML) or .json
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
      // width/height may be a direct <Width> or nested in <Size>
      fx_push(wall, {
        name:(fg(/<Name>([^<]+)<\/Name>/)||'').trim(),
        desc:(fg(/<Description>([^<]*)<\/Description>/)||'').trim(),
        type:(fg(/<Type>([^<]*)<\/Type>/)||'').trim(),
        cls:(fg(/<Class>([^<]*)<\/Class>/)||'').trim(),
        w:+(fg(/<Width>([-\d.]+)<\/Width>/)||0),
        h:+(fg(/<Height>([-\d.]+)<\/Height>/)||0),
        x:+(fg(/<X>([-\d.]+)<\/X>/)||0),
        y:+(fg(/<Y>([-\d.]+)<\/Y>/)||0)
      });
    }
    walls.push(wall);
  }
  return { name:(xml.match(/<Name>([^<]+)<\/Name>/)||[])[1]||'room', walls, islands:[] };
}
function fx_push(wall, fx){ wall.fixtures.push(fx); }

function loadRoom(file){
  const raw = fs.readFileSync(file,'utf8');
  if (file.toLowerCase().endsWith('.json')){ const r=JSON.parse(raw); if(!r.islands) r.islands=[]; return r; }
  return parseOrdx(raw);
}

/* ==================================================================
 * 5. SERVICE / OPENING CLASSIFICATION  (bilingual HE/EN)
 * ================================================================== */
function classify(fx){
  const s = (fx.name+' '+fx.desc+' '+fx.type).toLowerCase();
  const has = (...k)=>k.some(w=>s.includes(w));
  if (has('drain','ניקוז'))                                 return {kind:'drain'};
  if (has('water','מים','צינור מים'))                       return {kind:'water'};
  if (has('gas','גז'))                                      return {kind:'gas'};
  if (has('duct','תעלה','אוורור'))                          return {kind:'duct'};
  if (has('duplex','socket','שקע','power','חשמל','מוצר חשמל','מתג')) return {kind:'elec'};
  if (has('window','חלון'))                                 return {kind:'window', opening:true};
  if (has('door','doorway','entrydoor','דלת','מפתח','משקוף')) return {kind:'door', opening:true};
  if (has('beam','twall','קורה','עמוד','הנמכת'))            return {kind:'beam', obstacle:true};
  if (has('light','מנורה','תקרה'))                          return {kind:'ceiling'};   // ignored (ceiling)
  if (has('פאנל','panel','skirt'))                          return {kind:'panel'};      // baseboard, low
  return {kind:'other'};
}
// Interval on the wall a fixture occupies [x0,x1]; X treated as centre.
function interval(fx){ const half=(fx.w||0)/2; return [fx.x-half, fx.x+half]; }

/* ==================================================================
 * 6. BUILDABLE SPANS PER WALL  (base + upper block maps)
 * ================================================================== */
function analyseWall(wall){
  const L = wall.length;
  const baseBlocked = [], wallBlocked = [], services = [], openings = [], notes = [];
  for (const fx of wall.fixtures){
    const c = classify(fx); fx._c = c;
    const [a,b] = interval(fx);
    if (c.kind==='window'){
      const sill = fx.y;
      wallBlocked.push([a,b]);
      openings.push({kind:'window', a, b, x:fx.x, w:fx.w, sill});
      if (sill < COUNTER_H - 50){
        baseBlocked.push([a,b]);
        notes.push(`חלון @${fx.x|0} (סף ${sill}) חוסם גם ארון תחתון`);
      } else {
        notes.push(`חלון @${fx.x|0} (סף ${sill}) — תחתון מותר מתחת, אין עליון`);
      }
    } else if (c.kind==='door'){
      baseBlocked.push([a,b]); wallBlocked.push([a,b]);
      openings.push({kind:'door', a, b, x:fx.x, w:fx.w});
      notes.push(`פתח/דלת @${fx.x|0} רוחב ${fx.w|0} — אין ארונות`);
    } else if (c.kind==='beam'){
      if (fx.h >= wall.height*0.8 || fx.y < 100){ baseBlocked.push([a,b]); wallBlocked.push([a,b]); }
      else wallBlocked.push([a,b]);
      notes.push(`קורה @${fx.x|0} (${fx.w|0}×${fx.h|0})`);
    } else if (['water','drain','gas','elec','duct'].includes(c.kind)){
      services.push({ kind:c.kind, x:fx.x, y:fx.y, name:fx.name });
    }
  }
  const spans = subtract(L, baseBlocked);
  return { L, spans, baseBlocked, wallBlocked, services, openings, notes };
}
// [0,L] minus intervals -> list of free {a,b}
function subtract(L, blocks){
  const b = blocks.map(([a,b])=>[Math.max(0,a),Math.min(L,b)]).filter(([a,b])=>b>a)
                  .sort((x,y)=>x[0]-y[0]);
  const free=[]; let cur=0;
  for (const [a,e] of b){ if (a>cur) free.push({a:cur,b:a}); cur=Math.max(cur,e); }
  if (cur<L) free.push({a:cur,b:L});
  return free.filter(s=>s.b-s.a>=MIN_FILLER);
}

/* ==================================================================
 * 7. CORNER DETECTION  — where two wall runs meet at ~90°
 * ================================================================== */
function detectCorners(walls){
  const corners=[]; const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<30;
  for (let i=0;i<walls.length;i++){
    const A=walls[i], B=walls[(i+1)%walls.length];
    if (!B) break;
    if (near([A.ex,A.ey],[B.sx,B.sy])){
      // interior corner: end of A meets start of B
      corners.push({ a:A.num, b:B.num, aEnd:true, bStart:true });
    }
  }
  return corners;
}

/* ==================================================================
 * 8. WALL SCORING + SERVICE ANCHORS
 * ================================================================== */
function scoreWall(a){
  const S=a.services, has=k=>S.some(s=>s.kind===k);
  return (has('water')?4:0)+(has('gas')?4:0)+(has('elec')?1:0)+(has('duct')?1:0)
         + a.spans.reduce((t,s)=>t+(s.b-s.a),0)/1000;
}

/* ==================================================================
 * 9. GREEDY FILL of a linear segment with base widths, assigning a
 *    functional ROLE (drawer bank / door / open) per module.
 * ================================================================== */
function fillSegment(len, roleHint){
  const mods=[]; let rem=len;
  for (const w of BASE_WIDTHS){
    while (rem >= w){ mods.push(makeBase(w, roleHint)); rem-=w; }
  }
  if (rem >= MIN_FILLER) mods.push({type:'filler', family:'filler', code:`SF-${Math.round(rem)}`, w:Math.round(rem)});
  else if (rem>0 && mods.length) mods[mods.length-1].scribe=Math.round(rem);
  return mods;
}
function makeBase(w, roleHint){
  // width-based default: narrow → drawers; medium/large → door(s); very wide split earlier
  let role = roleHint || (w<=600 ? 'drawers' : 'door');
  const code = role==='drawers' ? `SB-DWR-${w}` : `SB-${w}`;
  return { type:'base', family:'base', role, code, w };
}

/* Place a fixed-width special module centred on a service X, clamped. */
function placeAnchor(kind, svcX, span){
  const sp = SPECIAL[kind];
  const w = sp.widthPref.find(w=>w<=span.b-span.a) || sp.widthPref[sp.widthPref.length-1];
  let a = svcX - w/2;
  a = Math.max(span.a, Math.min(a, span.b-w));
  return { type:sp.wall?'wall':(sp.tall?'tall':'base'), family:sp.tall?'tall':(sp.wall?'wall':'appliance'),
           special:kind, cat:sp.cat, code:`${sp.code}-${w}`, w, a, b:a+w, needs:sp.needs, front:sp.front, svcX };
}

/* ==================================================================
 * 10. PLAN ONE WALL: corner reserve → anchors → greedy fill
 * ================================================================== */
function planWall(wa, assignedAnchors, cornerPlan){
  const placed=[]; const warnings=[]; const dropped=[];
  const reserves = cornerPlan.filter(cp=>cp.wall===wa.wallNum);
  for (const span of wa.spans){
    // shrink span by any corner reserve overlapping it
    let sa=span.a, sb=span.b;
    for (const r of reserves){
      if (r.side==='start' && r.at<=sa+1 && r.end>sa){ sa=Math.max(sa, r.end); }
      if (r.side==='end' && r.at>=sb-1 && r.start<sb){ sb=Math.min(sb, r.start); }
    }
    if (sb-sa < MIN_FILLER) continue;
    const eff={a:sa,b:sb}, capacity=eff.b-eff.a;

    // anchors that want to sit in this span, by priority
    let anchorsHere = assignedAnchors.filter(an=> an.x>=eff.a && an.x<=eff.b)
                       .sort((p,q)=>(SPECIAL[q.kind].prio||0)-(SPECIAL[p.kind].prio||0));
    // fit check: total anchor width must fit the span; drop lowest-prio until it does
    const wOf = an=>{ const sp=SPECIAL[an.kind]; return sp.widthPref.find(w=>w<=capacity)||sp.widthPref[sp.widthPref.length-1]; };
    while (anchorsHere.length && anchorsHere.reduce((t,an)=>t+wOf(an),0) > capacity){
      const drop=anchorsHere.pop(); dropped.push(drop);
    }
    anchorsHere.sort((p,q)=>p.x-q.x);
    const objs = anchorsHere.map(an=> placeAnchor(an.kind, an.x, eff));
    objs.sort((p,q)=>p.a-q.a);

    // place left→right, clamping so nothing exceeds eff.b (reserve room for the rest)
    let cursor=eff.a; const seq=[];
    for (let i=0;i<objs.length;i++){
      const o=objs[i];
      const restW=objs.slice(i+1).reduce((t,x)=>t+x.w,0);      // width still to place after o
      const latest=eff.b-restW-o.w;                            // latest start that still fits the rest
      let start=Math.max(cursor, Math.min(o.a, latest));
      if (start-cursor >= MIN_FILLER){
        const hint = o.special==='HOB' ? 'drawers' : null;
        for (const m of fillSegment(start-cursor, hint)){ m.a=cursor; m.b=cursor+m.w; seq.push(m); cursor=m.b; }
        start=cursor;
      }
      o.a=start; o.b=start+o.w; seq.push(o); cursor=o.b;
    }
    if (eff.b-cursor >= MIN_FILLER) for (const m of fillSegment(eff.b-cursor)){ m.a=cursor; m.b=cursor+m.w; seq.push(m); cursor=m.b; }
    for (const m of seq) placed.push(m);
    for (const an of anchorsHere){ const i=assignedAnchors.indexOf(an); if(i>=0) assignedAnchors.splice(i,1); }
  }
  return { placed, warnings, dropped };
}

/* Upper (wall) cabinets — includes lift-detection over the hob. */
function planUppers(wa, hobX){
  const free = subtract(wa.L, wa.wallBlocked);
  const uppers=[];
  for (const span of free){
    let cursor=span.a;
    for (const w of WALL_WIDTHS){
      while (span.b-cursor >= w){
        const u={type:'wall', family:'wall', role:'door', code:`SW-${w}`, w, a:cursor, b:cursor+w};
        // long uppers → suggest an Aventos lift instead of side hinge
        if (w>=800){ const lift=chooseLift(HEIGHT.wall, w); if(lift){ u.role='lift'; u.code=`SW-LIFT-${w}`; u.lift=lift; } }
        uppers.push(u); cursor+=w;
      }
    }
  }
  return uppers;
}

/* ==================================================================
 * 11. VALIDATION  —  work triangle + services + clearances
 * ================================================================== */
function worldPoint(wall, xAlong){
  const dx=wall.ex-wall.sx, dy=wall.ey-wall.sy, L=Math.hypot(dx,dy)||1;
  return { X:wall.sx+dx/L*xAlong, Y:wall.sy+dy/L*xAlong };
}
function dist(a,b){ return Math.hypot(a.X-b.X, a.Y-b.Y); }
function validateTriangle(triangle, warnings){
  const legs=[];
  if (triangle.sink && triangle.hob)   legs.push(['כיור→כיריים',dist(triangle.sink,triangle.hob)]);
  if (triangle.hob && triangle.fridge) legs.push(['כיריים→מקרר',dist(triangle.hob,triangle.fridge)]);
  if (triangle.fridge && triangle.sink)legs.push(['מקרר→כיור',dist(triangle.fridge,triangle.sink)]);
  let sum=0;
  for (const [nm,d] of legs){
    sum+=d;
    if (d<1200) warnings.push(`משולש עבודה: צלע ${nm}=${(d/1000).toFixed(2)}מ' קצרה מהמינימום 1.2מ' (NKBA)`);
    if (d>2700) warnings.push(`משולש עבודה: צלע ${nm}=${(d/1000).toFixed(2)}מ' ארוכה מהמומלץ 2.7מ' (NKBA)`);
  }
  if (legs.length===3 && sum>8000) warnings.push(`משולש עבודה: סכום ${(sum/1000).toFixed(2)}מ' > 8מ' (NKBA)`);
  return { legs, sum };
}

/* ==================================================================
 * 12. MATERIALS: explode a module into cut PARTS
 * ================================================================== */
function explode(m){
  const parts=[]; const P=C.PANEL;
  const push=(part,qty,w,h,mat,edges)=>parts.push({module:m.code, part, qty, w:Math.round(w), h:Math.round(h), mat, edges});
  const fam=m.family;
  if (fam==='filler'){ push('פס-מילוי',1, m.w, HEIGHT.baseCarcass, 'MFC','L'); return parts; }
  if (fam==='panel'){ push('לוח-צד/גב חשוף',1, m.w||DEPTH.base, HEIGHT.baseCarcass, 'MFC','LR'); return parts; }
  if (fam==='valance'){ push('כרכוב/מסתור-תאורה',1, m.w||600, 80,'MFC','L'); return parts; }
  if (fam==='toekick'){ push('סוקל',1, m.w||600, C.TOE_H,'MFC','T'); return parts; }

  const depth = m.family==='wall' ? DEPTH.wall : (m.family==='tall' ? DEPTH.tall : DEPTH.base);
  const H     = m.family==='wall' ? HEIGHT.wall : (m.family==='tall' ? HEIGHT.tall : HEIGHT.baseCarcass);
  const w = m.w||600;
  const innerW = w - 2*P;
  // carcass
  push('צד (side)', 2, depth, H, 'MFC','F');                       // 1mm front edge
  push('תחתית/גג (bottom/top)', m.family==='wall'?2:1, innerW, depth, 'MFC','F');
  if (m.family!=='wall') push('משטח-חיזוק (stretcher)', 2, innerW, 100, 'MFC','F');
  push('גב (back)', 1, w-2*C.BACK_INSET, H-2*C.BACK_INSET, 'HDF','-'); // grooved back
  // shelves
  const shelves = m.family==='tall'?4 : (m.family==='wall'?2 : (m.role==='drawers'?0:1));
  if (shelves) push('מדף (shelf)', shelves, innerW, depth-40, 'MFC','F');
  // fronts
  const frontH = H - C.REVEAL_TOP;
  if (m.front==='panel'){                                    // integrated-appliance panel
    push('חזית-חיפוי מכשיר (panel)', 1, w-C.GAP_EDGE, frontH, 'MDF','LRTB');
  } else if (m.role==='drawers' || m.front==='drawers'){
    const stack = chooseDrawerStack(m.special==='HOB'?'pot':(w>=800?'wide5':'std'), depth, w, frontH);
    m._drawers = stack;
    let i=0; for (const f of stack.fronts){ i++; push(`חזית-מגירה ${i} (${f.sys})`, 1, w-C.GAP_EDGE, f.h-C.GAP_DOOR, 'MDF','LRTB'); }
    for (let d=0; d<stack.fronts.length; d++){ push('תחתית-מגירה (drawer bottom)',1, stack.boxW, depth-20,'HDF','-'); }
  } else if (m.front==='glass'){
    push('מסגרת-דלת זכוכית (frame)', w<600?1:2, (w<600?w:w/2)-C.GAP_DOOR, frontH,'MDF','LRTB');
  } else if (m.front==='open'){
    /* open shelving — no door */
  } else if (m.front==='lift'){
    push('חזית-הרמה (lift front)', 1, w-C.GAP_EDGE, frontH,'MDF','LRTB');
  } else if (m.front==='appliance'){
    /* appliance face (hood/oven) — supplied by appliance */
  } else { // door(s)
    const nDoors = w>600?2:1;
    const leafW = nDoors===2 ? (w-C.GAP_DOOR)/2 : (w-C.GAP_EDGE);
    push('דלת (door)', nDoors, leafW, frontH,'MDF','LRTB');
    m._hinges = { perDoor: HW.hinge.perLeaf(frontH), doors:nDoors, type: m.family==='corner'?'blind':'full' };
  }
  return parts;
}

/* Guillotine (shelf) nesting — pack parts per material onto sheets. */
function nest(allParts){
  const byMat={};
  for (const p of allParts){
    for (let q=0;q<p.qty;q++) (byMat[p.mat]=byMat[p.mat]||[]).push({w:p.w,h:p.h,part:p.part});
  }
  const result={};
  for (const [mat, parts] of Object.entries(byMat)){
    const M=MAT[mat]; if(!M){ continue; }
    const [SW,SH]=M.sheet; const kerf=M.kerf; const canRotate=!M.grain;
    // orient each part to fit; sort by height desc (shelf packing)
    const fits=(w,h)=>w<=SW && h<=SH;
    const items = parts.map(p=>{
      let w=p.w,h=p.h;
      // if it doesn't fit as-is but fits rotated (and grain allows), rotate
      if (!fits(w,h) && canRotate && fits(h,w)){ [w,h]=[h,w]; }
      // else, on non-grain sheets, prefer the taller-side-vertical orientation for packing
      else if (canRotate && w>h && fits(h,w)){ [w,h]=[h,w]; }
      return {w,h,part:p.part};
    }).sort((a,b)=>b.h-a.h);
    let sheets=1, usedArea=0, x=0, y=0, rowH=0, oversize=0;
    for (const it of items){
      if (it.w>SW || it.h>SH){ oversize++; usedArea+=it.w*it.h; continue; }
      if (x+it.w+kerf > SW){ x=0; y+=rowH+kerf; rowH=0; }   // new row
      if (y+it.h+kerf > SH){ sheets++; x=0; y=0; rowH=0; }   // new sheet
      x+=it.w+kerf; rowH=Math.max(rowH,it.h); usedArea+=it.w*it.h;
    }
    const capacity = sheets*SW*SH;
    result[mat]={ name:M.name, sheet:`${SW}×${SH}`, sheets, parts:parts.length,
                  util:+(100*usedArea/capacity).toFixed(1), oversize };
  }
  return result;
}

/* ==================================================================
 * 13. MAIN PLANNER
 * ================================================================== */
function plan(room, opts={}){
  const outdoor = !!opts.outdoor;
  const analyses = room.walls.map(w=>{ const a=analyseWall(w); a.wallNum=w.num; return { wall:w, a }; });
  const warnings=[];
  const corners = detectCorners(room.walls);
  const cornerPlan=[];   // {wall, side:'start'|'end', at, start, end, unit}
  const cornerUnits=[];

  // ---- rank walls; assign work-triangle anchors ----
  const ranked=[...analyses].sort((p,q)=>scoreWall(q.a)-scoreWall(p.a));
  const findSvc=(kind)=>{ for (const {wall,a} of ranked){ const s=a.services.find(s=>s.kind===kind); if(s) return {wall,a,s}; } return null; };
  const water=findSvc('water'), drain=findSvc('drain'), gas=findSvc('gas'), elec=findSvc('elec'), duct=findSvc('duct');
  const triangle={}; const anchorByWall=new Map();
  const addAnchor=(wallNum,kind,x)=>{ if(!anchorByWall.has(wallNum)) anchorByWall.set(wallNum,[]); anchorByWall.get(wallNum).push({kind,x}); };

  if (water){ addAnchor(water.wall.num,'SINK',water.s.x); triangle.sink=worldPoint(water.wall,water.s.x);
    if(!drain) warnings.push('נמצאו מים אך לא נמצא ניקוז — ארון-הכיור דורש ניקוז. לתאם אינסטלציה.');
    // dishwasher next to the sink if elec present on same wall
    const e=water.a.services.find(s=>s.kind==='elec');
    if (drain){ addAnchor(water.wall.num,'DW', water.s.x + 600); }
  } else warnings.push('לא נמצאה נקודת מים — לא ניתן למקם כיור. יש לתאם אינסטלציה.');

  if (gas){ addAnchor(gas.wall.num,'HOB',gas.s.x); triangle.hob=worldPoint(gas.wall,gas.s.x);
            addAnchor(gas.wall.num,'HOOD',gas.s.x); }
  else if (elec){ addAnchor(elec.wall.num,'HOB',elec.s.x); triangle.hob=worldPoint(elec.wall,elec.s.x);
                  addAnchor(elec.wall.num,'HOOD',elec.s.x);
                  warnings.push('אין גז — כיריים חשמליות/אינדוקציה (דורש חשמל 3-פאזי ייעודי).'); }
  else warnings.push('אין גז/חשמל ייעודי לכיריים.');

  if (duct && !(gas||elec)) warnings.push('קיימת תעלת-אוורור אך אין עמדת-כיריים תואמת מתחת.');

  // fridge: richest wall that is NOT the sink/hob wall
  const usedWalls=new Set([water&&water.wall.num, gas&&gas.wall.num, elec&&elec.wall.num].filter(x=>x!=null));
  let fridgePlaced=null;
  for (const {wall,a} of ranked){
    if (usedWalls.has(wall.num)) continue;
    if (a.spans.length){ const sp=a.spans[0]; addAnchor(wall.num,'FRIDGE',sp.a+350); fridgePlaced={wall,x:sp.a+350}; break; }
  }
  if (!fridgePlaced){ const w=water||gas||ranked[0];
    if (w){ const sp=w.a.spans[w.a.spans.length-1]; if(sp){ addAnchor(w.wall.num,'FRIDGE',sp.b-350); fridgePlaced={wall:w.wall,x:sp.b-350}; } } }
  if (fridgePlaced) triangle.fridge=worldPoint(fridgePlaced.wall,fridgePlaced.x);

  // ---- resolve corners (yield to work anchors when a wall is full) ----
  // per-wall base-anchor load = sum of preferred widths of non-wall specials
  const anchorLoad={};
  for (const [wn,list] of anchorByWall){
    anchorLoad[wn]=list.filter(an=>SPECIAL[an.kind] && !SPECIAL[an.kind].wall && SPECIAL[an.kind].prio>=6)
      .reduce((t,an)=>t+SPECIAL[an.kind].widthPref[0], 0);
  }
  const committed={};  // corner reserve already committed per wall
  for (const cor of corners){
    const A=analyses.find(x=>x.wall.num===cor.a), B=analyses.find(x=>x.wall.num===cor.b);
    if(!A||!B) continue;
    const aHasEnd = A.a.spans.some(s=>s.b >= A.a.L-50);
    const bHasStart = B.a.spans.some(s=>s.a <= 50);
    if(!aHasEnd || !bHasStart) continue;
    const unit = chooseCorner(CORNER_RESERVE);
    const needB = CORNER_RESERVE, needA = unit.reserveAdj;
    const slackA = A.a.L - (anchorLoad[A.wall.num]||0) - (committed[A.wall.num]||0);
    const slackB = B.a.L - (anchorLoad[B.wall.num]||0) - (committed[B.wall.num]||0);
    if (slackA >= needA && slackB >= needB){
      cornerPlan.push({ wall:B.wall.num, side:'start', at:0, start:0, end:needB, unit });
      cornerPlan.push({ wall:A.wall.num, side:'end', at:A.a.L, start:A.a.L-needA, end:A.a.L,
                        unit:{code:'RETURN', name:'החזרת-פינה (filler/panel)', reserveAdj:needA} });
      cornerUnits.push({ wall:B.wall.num, x:needB/2, unit });
      committed[A.wall.num]=(committed[A.wall.num]||0)+needA;
      committed[B.wall.num]=(committed[B.wall.num]||0)+needB;
      cor._honored=true;
    } else {
      cor._butt=true;
      warnings.push(`פינה בין קיר ${cor.a}↔${cor.b}: הקירות עמוסים — ללא ארון-פינה ייעודי, חיבור-פינה פשוט (butt). ניצול-פינה חלקי.`);
    }
  }

  // ---- lay out each wall ----
  const layout=[];
  const hobWallX = gas ? {wall:gas.wall.num,x:gas.s.x} : (elec?{wall:elec.wall.num,x:elec.s.x}:null);
  for (const {wall,a} of analyses){
    const anchors=(anchorByWall.get(wall.num)||[]).map(x=>({...x}));
    const baseAnchors = anchors.filter(an=>SPECIAL[an.kind] && !SPECIAL[an.kind].wall);
    const { placed, dropped } = planWall(a, baseAnchors, cornerPlan);
    for (const d of (dropped||[])){
      const nm={DW:'מדיח',OVEN:'תנור-בסיס',MICRO:'מיקרו'}[d.kind]||d.kind;
      warnings.push(`קיר ${wall.num}: אין מקום ל${nm} (${SPECIAL[d.kind].code}) — הקיר עמוס. לשקול קיר אחר / הקטנת ${SPECIAL[d.kind].widthPref[0]}מ"מ.`);
    }
    const uppers = planUppers(a, hobWallX && hobWallX.wall===wall.num ? hobWallX.x : null);
    const hood=(anchorByWall.get(wall.num)||[]).find(x=>x.kind==='HOOD');
    // corner units on this wall
    const cu=cornerUnits.filter(c=>c.wall===wall.num);
    for (const c of cu){
      const cd={type:'base', family:'corner', role:'corner', code:`SC-B-${c.unit.code}-${CORNER_RESERVE}`, w:CORNER_RESERVE, a:0, b:CORNER_RESERVE, corner:c.unit};
      placed.unshift(cd);
    }
    // corner-return fillers
    const ret=cornerPlan.filter(cp=>cp.wall===wall.num && cp.unit && cp.unit.code==='RETURN');
    for (const r of ret){ placed.push({type:'filler', family:'panel', role:'return', code:`SP-END-${r.unit.reserveAdj}`, w:r.unit.reserveAdj, a:r.start, b:r.end, note:'החזרת-פינה'}); }

    placed.sort((p,q)=>(p.a??0)-(q.a??0));
    layout.push({ wall, analysis:a, base:placed, uppers, hood, notes:a.notes });
  }

  // ---- islands / peninsulas ----
  const islands=[];
  for (const isl of (room.islands||[])){
    const L=isl.length||2400, run=[];
    let cursor=0; for (const m of fillSegment(L)){ m.a=cursor; m.b=cursor+m.w; run.push(m); cursor=m.b; }
    islands.push({ name:isl.name||'אי', kind:isl.kind||'island', length:L, base:run });
    if (isl.length && isl.length<1200) warnings.push(`אי "${isl.name||''}" קצר (${isl.length}מ"מ) — לשקול חצי-אי או ביטול.`);
  }

  // ---- conflict flags: window/upper, service-in-opening, aisles ----
  for (const {wall, analysis, base} of layout){
    for (const op of analysis.openings){
      if (op.kind==='window') warnings.push(`קיר ${wall.num}: חלון @${op.x|0} — אין ארון עליון בקטע זה (סף ${op.sill}).`);
      for (const s of analysis.services){
        if (s.x>=op.a && s.x<=op.b) warnings.push(`קיר ${wall.num}: נקודת ${s.kind} @${s.x|0} נופלת בתוך ${op.kind==='door'?'פתח':'חלון'} — לא שמישה לארון.`);
      }
    }
    // hob under a window? (fire/NKBA)
    const hob=(anchorByWall.get(wall.num)||[]).find(x=>x.kind==='HOB');
    if (hob){ for (const op of analysis.openings){ if (op.kind==='window' && hob.x>=op.a && hob.x<=op.b)
      warnings.push(`קיר ${wall.num}: כיריים @${hob.x|0} מתחת לחלון — סיכון-בטיחות, לשקול מנדף-דחיסה/הזזה.`); } }
    // oversized filler
    for (const m of base){ if (m.family==='filler' && m.w>MAX_FILLER && m.role!=='return')
      warnings.push(`קיר ${wall.num}: פס-מילוי ${m.w}מ"מ חורג מ-${MAX_FILLER}מ"מ — לשקול הרחבת ארון סמוך.`); }
  }
  // corner notes (honored corners)
  for (const cor of corners){ if (cor._honored)
    warnings.push(`פינה בין קיר ${cor.a}↔${cor.b}: שוריין ${CORNER_RESERVE}מ"מ (${chooseCorner(CORNER_RESERVE).name}) בקיר ${cor.b} + החזרת-פינה בקיר ${cor.a}.`); }

  const tri = validateTriangle(triangle, warnings);

  // ---- outdoor deltas ----
  if (outdoor){
    warnings.push('מטבח-חוץ: לוודא קו-גז עם ברז-ניתוק חירום נגיש + התקנה מורשית.');
    warnings.push('מטבח-חוץ: כל שקע חייב הגנת GFCI ומכסה-בשימוש, ≥12" מעל המשטח.');
    warnings.push('מטבח-חוץ: גופים/משטחים עמידי-מזג — נירוסטה 316 / בטון אטום / HPL; שיפוע-ניקוז + ניקוז-חורף.');
    warnings.push('מטבח-חוץ: ≥15" מרחב-הנחה עמיד-חום בכל צד של הגריל; קירוי/הצללה מומלצים.');
  }

  // ---- materials: cut-list + nesting ----
  const allParts=[];
  for (const w of layout) for (const m of [...w.base, ...w.uppers]) allParts.push(...explode(m));
  for (const isl of islands) for (const m of isl.base) allParts.push(...explode(m));
  const sheets = nest(allParts.map(p=> outdoor && (p.mat==='MFC'||p.mat==='MDF') ? {...p, mat:'SS316'} : p));

  return { room, layout, islands, corners, cornerPlan, triangle, tri, warnings, outdoor, parts:allParts, sheets };
}

/* ==================================================================
 * 14. REPORT / OUTPUT
 * ================================================================== */
function moduleList(result){
  const counts={};
  const add=m=>{ counts[m.code]=(counts[m.code]||0)+1; };
  for (const w of result.layout){ for (const m of [...w.base, ...w.uppers]) add(m); }
  for (const isl of result.islands) for (const m of isl.base) add(m);
  return counts;
}
function fmtMod(m){
  const tag = m.special?`  «${m.special}${m.needs?' → '+m.needs.join('+'):''}»`
            : m.corner?`  «פינה: ${m.corner.name}»`
            : m.role==='drawers'?'  «מגירות»'
            : m.role==='return'?'  «החזרת-פינה»'
            : m.role==='lift'&&m.lift?`  «${m.lift.name}»`:'';
  const a=(m.a??0)|0, b=(m.b??((m.a||0)+m.w))|0;
  return `     [${a}–${b}] ${m.code} (${m.w}מ"מ)${m.scribe?` +סקרייב ${m.scribe}`:''}${tag}`;
}
function report(result){
  const L=[];
  L.push(`# תוכנית מטבח — ${result.room.name}${result.outdoor?'  (מטבח-חוץ)':''}`);
  L.push('');
  L.push(`> מנוע Soli v2 · גוף 18מ"מ · פרזול Blum · ${result.corners.length} פינות זוהו`);
  L.push('');
  for (const w of result.layout){
    L.push(`## קיר ${w.wall.num}  (אורך ${w.wall.length|0} מ"מ)`);
    if (w.analysis.spans.length) L.push(`   קטעים בָּנִיִים: ${w.analysis.spans.map(s=>`${s.a|0}–${s.b|0}`).join(', ')}`);
    L.push('   תחתונים:');
    for (const m of w.base) L.push(fmtMod(m));
    if (w.uppers.length){ L.push('   עליונים:'); L.push('     '+w.uppers.map(u=>u.code).join(' | ')); }
    else L.push('   עליונים: — (אין קטע פנוי / חלון/קורה)');
    if (w.hood) L.push('   מנדף: SW-HOOD מעל הכיריים (דורש תעלה + חשמל)');
    if (w.notes.length) L.push('   הערות: '+w.notes.join(' · '));
    L.push('');
  }
  if (result.islands.length){
    for (const isl of result.islands){
      L.push(`## ${isl.name} (${isl.kind==='peninsula'?'חצי-אי':'אי'} · אורך ${isl.length|0} מ"מ)`);
      for (const m of isl.base) L.push(fmtMod(m));
      L.push('');
    }
  }
  L.push('## משולש עבודה');
  for (const [nm,d] of result.tri.legs) L.push(`   ${nm}: ${(d/1000).toFixed(2)} מ'`);
  if (result.tri.legs.length===3) L.push(`   סכום: ${(result.tri.sum/1000).toFixed(2)} מ'  (יעד < 8 מ')`);
  L.push('');
  L.push('## רשימת מודולים (Module list)');
  const counts=moduleList(result);
  for (const [code,n] of Object.entries(counts).sort()) L.push(`   ${n}× ${code}`);
  L.push('');
  L.push('## חומרים ולוחות (Cut-list / Nesting)');
  L.push(`   סה"כ חלקי-חיתוך: ${result.parts.reduce((t,p)=>t+p.qty,0)}`);
  for (const [mat,s] of Object.entries(result.sheets)){
    L.push(`   ${s.name}: ${s.sheets} לוח(ות) ${s.sheet} · ${s.parts} חלקים · ניצולת ~${s.util}%${s.oversize?` · ${s.oversize} חלקים חורגי-לוח`:''}`);
  }
  L.push(`   פרזול-חיבור: ${JOINERY.dowel.name} (גוף) · ${JOINERY.confirmat.name} (חיזוק) · ${JOINERY.cam.name} (פירוק)`);
  L.push(`   הידוק-קצה: דלתות/חשופים ${EDGE.door}מ"מ ABS · גוף ${EDGE.carcass}מ"מ`);
  L.push('');
  L.push('## אזהרות / קונפליקטים');
  if (!result.warnings.length) L.push('   אין.');
  for (const wn of result.warnings) L.push(`   ⚠ ${wn}`);
  return L.join('\n');
}

/* ==================================================================
 * 15. CLI
 * ================================================================== */
function main(){
  const args=process.argv.slice(2);
  const outdoor=args.includes('--outdoor');
  const outIdx=args.indexOf('--out');
  const outDir=outIdx>=0?args[outIdx+1]:path.join(__dirname,'out');
  let file=args.find(a=>!a.startsWith('--') && a!==outDir);
  if (!file){
    const cand=[
      path.join(__dirname,'..','..','converter','analysis','out','allelem','allelem.ordx'),
      path.join(__dirname,'sample_room.json')
    ];
    file=cand.find(f=>fs.existsSync(f));
  }
  if (!file){ console.error('לא נמצא קובץ קלט.'); process.exit(1); }
  const room=loadRoom(file);
  const result=plan(room,{outdoor});
  const rep=report(result);
  console.log(rep);
  try{
    fs.mkdirSync(outDir,{recursive:true});
    const base=path.basename(file).replace(/\.[^.]+$/,'');
    fs.writeFileSync(path.join(outDir,`${base}_kitchen_plan.md`),rep,'utf8');
    fs.writeFileSync(path.join(outDir,`${base}_kitchen_plan.json`),
      JSON.stringify({triangle:result.triangle,tri:result.tri,warnings:result.warnings,corners:result.corners,
        layout:result.layout.map(w=>({wall:w.wall.num,length:w.wall.length,base:w.base,uppers:w.uppers,hood:!!w.hood})),
        islands:result.islands, modules:moduleList(result), sheets:result.sheets},null,2),'utf8');
    console.error(`\n[נשמר] ${outDir}`);
  }catch(e){ console.error('שמירה נכשלה:',e.message); }
}
if (require.main===module) main();
module.exports={ plan, parseOrdx, loadRoom, analyseWall, detectCorners, explode, nest,
                 report, moduleList, chooseDrawerStack, chooseLift, chooseCorner,
                 CATALOG, SPECIAL, HW, MAT, JOINERY, C };
