'use strict';
/*
 * Soline — read-only PDP inspector  (readPdp.js)
 * =============================================================================
 * PURPOSE
 *   Read a Raumplan/InnoDraw `.pdp` (proprietary binary) and pull out enough to
 *   DRIVE THE 3D VIEWER: the job identity, the CABINET / primitive inventory
 *   (KORPUS carcasses + catalog codes like DKP60 / DLB60 / TUERE), and — when
 *   the file follows the InnoDraw wall-table template — the wall polyline.
 *
 *   This is the PDP -> scene half of the bidirectional converter. It only READS;
 *   it never writes PDP (that is writePdp.js) and touches no other module.
 *
 * WHAT IS SOLID vs. WHAT IS NOT (honest scope — verified on the TRIO reference set)
 *   SOLID:
 *     - Job name / customer / category strings (ASCII/latin1 runs near the head).
 *     - Primitive & catalog INVENTORY by marker scan: KORPUS (cabinet carcass,
 *       210-byte records), QUADER (box), ZYLINDER (cylinder), FENSTER (window),
 *       and catalog article codes (DKP60 / DLB60 / TUERE##). Counts + byte
 *       offsets + record stride. This reliably answers "how many cabinets and
 *       which catalog modules does this design contain".
 *     - KORPUS record stride = 210 bytes (matches DXF_REFERENCE_STUDY "מש 3D 210B").
 *   NOT YET DECODED (documented, not guessed):
 *     - The exact float32 position + W/D/H of each KORPUS carcass. The 210-byte
 *       record is deeply parametrized (local frame + transform/index tables), so
 *       per-cabinet geometry is inventoried, not decoded. The viewer therefore
 *       reconstructs cabinet volumes from the catalog inventory using standard
 *       module dimensions (see CATALOG below), snapped to the walls.
 *     - Universal wall offsets: the 0xd2/0xd4 int16 table (writePdp.js) is
 *       template-specific and does NOT generalize across the reference set, so wall
 *       reading is best-effort with a validity check; the reliable wall source
 *       for the viewer is the ORDX pipeline (parseOrdx).
 *
 * PUBLIC API
 *   readPdp(buf|path)        -> { file, size, job, inventory, walls, cabinets }
 *   sceneFromPdp(buf|path,o) -> { walls, items, cabinets }   (viewer contract)
 *   CATALOG                  -> catalog-code -> standard module dimensions
 *
 * CLI:  node src/readPdp.js <file.pdp> [--json]
 */

const fs = require('fs');

// ---------------------------------------------------------------------------
// Catalog knowledge — Raumplan/German kitchen module conventions (mm).
// Maps the article codes seen in the reference set to standard carcass dimensions so
// the viewer can render a faithful cabinet VOLUME even before the per-record
// geometry is decoded. Dimensions are catalog-standard, not invented.
//   base  : floor-standing carcass, toe-kick 100 + body 720, worktop ~900
//   wall  : upper cabinet, shallow, mounted high
//   tall  : full-height column (fridge/oven/larder)
// ---------------------------------------------------------------------------
const CATALOG = {
  // code       kind    W    D    H    z0(floor->carcass bottom)
  KORPUS:      { kind:'base', W:600, D:560, H:720, z0:100 }, // generic carcass
  DKP60:       { kind:'base', W:600, D:560, H:720, z0:100 }, // drawer base 60
  DLB60:       { kind:'base', W:600, D:560, H:720, z0:100 }, // base 60
  DUB60:       { kind:'base', W:600, D:560, H:720, z0:100 },
  OST60:       { kind:'wall', W:600, D:320, H:720, z0:1450 },// wall unit
  UST60:       { kind:'base', W:600, D:560, H:720, z0:100 },
  TUERE01X:    { kind:'front', W:600, D:20,  H:720, z0:100 }, // door front
  TUERE05X:    { kind:'front', W:600, D:20,  H:720, z0:100 },
};
function catalogFor(code){
  if (CATALOG[code]) return CATALOG[code];
  const m = /^([A-Z]+)(\d+)?/.exec(code || '');
  const pfx = m ? m[1] : '';
  const w = m && m[2] ? Math.max(150, parseInt(m[2],10) * 10) : 600; // "60" -> 600mm
  // worktop / stone slab (Arbeitsplatte, marble, granite, dekton, quartz)
  if (/^AP|MARMOR|GRANIT|DEKTON|QUARZ|SILESTONE|CAESAR/.test(pfx))
    return { kind:'worktop', W:w, D:620, H:40, z0:900 };
  // door fronts / fillers / handles — not standalone volumes (skip in layout)
  if (/^DOOR|TUERE|FILLER|BLENDE|SOCKEL|GRIFF/.test(pfx))
    return { kind:'front', W:w, D:20, H:720, z0:100 };
  // corner base (Eck) unit
  if (/^IK|ECK|CORNER/.test(pfx)) return { kind:'base', W:900, D:900, H:720, z0:100 };
  // wall / upper units
  if (/^OB|OST|HK|WALL|WAND/.test(pfx)) return { kind:'wall', W:w, D:320, H:720, z0:1450 };
  // tall / larder columns
  if (/^HS|HOCH|TALL|HB/.test(pfx)) return { kind:'tall', W:w, D:560, H:2080, z0:0 };
  // default: base carcass
  return { kind:'base', W:w, D:560, H:720, z0:100 };
}

// ---------------------------------------------------------------------------
// Elkincho catalog (docs/elkincho_catalog.json) — code -> catalog definition.
// The catalog codes (e.g. B9D\01\50R) are the FORMAL articles; PDP files use
// short codes (DKP60, SO60, KP60...). We map by (a) exact/series lookup in the
// catalog, and (b) heuristics on the code (trailing digits = width in cm, the
// category / series -> kind + standard depth/height). Kitchen module conventions
// (mm): base carcass H=720 on a 100 toe-kick (worktop face ~900); wall unit
// D=320 mounted at 1450; tall column H=2080; worktop slab H=40 at 900.
let _elk = null;
function loadElkincho(){
  if (_elk) return _elk;
  try {
    const raw = JSON.parse(fs.readFileSync(require('path').join(__dirname, '..', 'docs', 'elkincho_catalog.json'), 'utf8'));
    const bySeries = new Map(), byCode = new Map();
    for (const e of raw){ if (e.series) bySeries.set(e.series, e); if (e.code) byCode.set(e.code, e); }
    _elk = { list: raw, bySeries, byCode };
  } catch { _elk = { list: [], bySeries: new Map(), byCode: new Map() }; }
  return _elk;
}

// Category (Hebrew) -> kind + standard box (mm). Drives cabinets that resolve
// to a catalog entry.
function kindFromCategory(cat, sub){
  const c = (cat || '') + ' ' + (sub || '');
  if (/עליון/.test(c)) return { kind:'wall',    D:320, H:720,  z0:1450 };
  if (/משטח|דלפק|שייש|שיש/.test(c)) return { kind:'worktop', D:620, H:40, z0:900 };
  if (/מקרר|מקפיא|תנור.*גבוה|עמוד/.test(c)) return { kind:'tall', D:600, H:2080, z0:0 };
  return { kind:'base', D:600, H:720, z0:100 }; // "א.תחתון" and default
}

// Resolve any cabinet code (PDP short code OR catalog code) to a render box.
function resolveCatalog(code){
  const elk = loadElkincho();
  const raw = String(code || '');
  // width in cm: last run of digits in the code
  const wm = raw.match(/(\d{2,3})(?!.*\d)/);
  const widthCm = wm ? parseInt(wm[1], 10) : null;
  // series = leading letters (before first digit or backslash)
  const sm = raw.match(/^([A-Za-z]+\d*)/);
  const series = sm ? sm[1] : raw;

  // (a) exact catalog code, (b) series match
  let hit = elk.byCode.get(raw) || elk.bySeries.get(series) ||
            elk.list.find(e => e.series && series.startsWith(e.series));
  if (hit){
    const k = kindFromCategory(hit.category, hit.sub);
    const W = (hit.width_cm || widthCm || 60) * 10;
    return { kind:k.kind, W, D:k.D, H:k.H, z0:k.z0,
             name: hit.name || hit.sub || series, series, catalogMatched:true };
  }
  // (b) fall back to the short-code heuristics (worktop/front/wall/tall/base)
  const g = catalogFor(raw);           // heuristic base dims
  const W = widthCm ? widthCm * 10 : g.W;
  return { ...g, W, series, name: series, catalogMatched:false };
}

// ---------------------------------------------------------------------------
const PRIMITIVES = ['KORPUS','QUADER','ZYLINDER','WUERFEL','HALBKREIS','FENSTER','ZYL20V','.DURCHBR','Tuergrif','lampensc'];
// Primitive/glyph markers (3D shapes of items) — excluded when hunting for the
// item TYPE token in native files.
const PRIM_SET = new Set(['KORPUS','QUADER','ZYLINDER','WUERFEL','HALBKREIS','HALBKREI','FENSTER','ZYL20V','KUGEL','KEGEL','PYRAMIDE','DKP60','DLB60']);
// catalog article codes look like 2-6 uppercase letters + digits (DKP60, TUERE01X)
const CODE_RE = /\b([A-Z]{2,6}\d{2,3}[A-Z]?)\b/g;

function asBuf(input){
  if (Buffer.isBuffer(input)) return input;
  return fs.readFileSync(input);
}

// All byte offsets of an ASCII marker.
function findAll(buf, marker){
  const nb = Buffer.from(marker, 'latin1');
  const out = []; let i = 0;
  while ((i = buf.indexOf(nb, i)) !== -1){ out.push(i); i += 1; }
  return out;
}

// Printable latin1 runs of length >= min, with offsets.
function asciiRuns(buf, min = 4, limit = Infinity){
  const runs = []; let start = -1;
  for (let i = 0; i < buf.length; i++){
    const c = buf[i];
    if (c >= 32 && c < 127){ if (start < 0) start = i; }
    else { if (start >= 0 && i - start >= min){ runs.push({ off:start, s:buf.toString('latin1', start, i) }); if (runs.length>=limit) return runs; } start = -1; }
  }
  return runs;
}

// ---------------------------------------------------------------------------
// Best-effort wall table (InnoDraw template: count@0xd2, 14B int16 records@0xd4).
// Returns [] and ok:false if the slot does not look like a real wall table.
// ---------------------------------------------------------------------------
function readWallsTemplate(buf){
  const WALL_COUNT_OFF = 0xd2, WALL_TABLE_OFF = 0xd4, WALL_REC = 14;
  if (buf.length < WALL_TABLE_OFF + WALL_REC) return { ok:false, walls:[] };
  const n = buf.readInt16LE(WALL_COUNT_OFF);
  if (n <= 0 || n > 64) return { ok:false, walls:[] };      // sanity gate
  const walls = [];
  for (let i = 0; i < n; i++){
    const o = WALL_TABLE_OFF + i * WALL_REC;
    if (o + 12 > buf.length) break;
    const x1 = buf.readInt16LE(o), y1 = buf.readInt16LE(o+2);
    const x2 = buf.readInt16LE(o+4), y2 = buf.readInt16LE(o+6);
    const thick = buf.readInt16LE(o+8), height = buf.readInt16LE(o+10);
    const len = Math.hypot(x2-x1, y2-y1);
    if (len < 1 || len > 20000) return { ok:false, walls:[] };  // not a wall table
    walls.push({ x1, y1, x2, y2, thick: thick||100, height: height||2500 });
  }
  return { ok: walls.length > 0, walls };
}

// ---------------------------------------------------------------------------
// Format detection + native (Raumplan-for-Windows) reader
// ---------------------------------------------------------------------------
// Native project files start with 0x7fffffff (bytes ff ff ff 7f). The older DR
// measurement exports start with zero bytes. The two encode walls/items very
// differently, so we branch on this.
function isNativePdp(buf){ return buf.length >= 4 && buf.readUInt32LE(0) === 0x7fffffff; }

const { detectWallGroups } = require('./walls');

// Auto-find the (X,Y) int32 position field inside a fixed-stride item record.
// The true position field puts (almost) every fixture INSIDE the room, so we
// score each candidate offset by how many (x,y) fall within the wall bounding
// box (expanded by a margin). This beats a pure-variance test, which can latch
// onto a bounding-box/parameter field.
function findPosOffset(buf, offsets, bbox){
  const N = offsets.length;
  const bx0 = bbox.minX - 800, bx1 = bbox.maxX + 800;
  const by0 = bbox.minY - 800, by1 = bbox.maxY + 800;
  let best = null;
  for (let rel = -8; rel < 240; rel++){
    let inside = 0; const xs = []; let bad = false;
    for (const p of offsets){
      const ox = p + rel;
      if (ox < 0 || ox + 8 > buf.length){ bad = true; break; }
      const x = buf.readInt32LE(ox), y = buf.readInt32LE(ox + 4);
      if (x >= bx0 && x <= bx1 && y >= by0 && y <= by1) inside++;
      xs.push(x);
    }
    if (bad || inside < N) continue;          // EVERY fixture must fall inside the room
    const distinct = new Set(xs).size;
    if (distinct < Math.max(3, N * 0.4)) continue; // real positions differ; skip constants
    const mean = xs.reduce((a,b)=>a+b,0)/xs.length;
    const varc = xs.reduce((a,b)=>a+(b-mean)*(b-mean),0)/xs.length;
    const score = distinct * 1e9 + varc;      // prefer most-distinct, tiebreak by spread
    if (!best || score > best.score) best = { rel, score };
  }
  return best ? best.rel : null;
}

// Read the native project file: walls (int32 tables via walls.js), infrastructure
// fixtures (dominant non-primitive item token), and cabinet catalog codes.
function readNative(buf, file){
  const text = buf.toString('latin1');

  // --- job identity ---
  const clean = asciiRuns(buf, 4, 120).map(r => r.s)
    .filter(s => !/[$?<>*#]/.test(s) && s !== 'General'
                 && !PRIM_SET.has(s) && s.toLowerCase() !== 'supp_fr');
  const named = clean.filter(s => /^[A-Za-z][A-Za-z0-9 ._-]{2,}$/.test(s) || /[֐-׿]/.test(s));
  const job = { name: named[0] || null, hints: clean.slice(0, 6) };

  // --- walls: flatten every detected int32/int16 group (outer + inner sets) ---
  const groups = detectWallGroups(buf);
  const walls = [];
  for (const g of groups){
    for (let i = 0; i < g.count; i++){
      const s = g.offset + i * g.stride;
      const rd = g.format === 'int32'
        ? [buf.readInt32LE(s), buf.readInt32LE(s+4), buf.readInt32LE(s+8), buf.readInt32LE(s+12)]
        : [buf.readInt16LE(s), buf.readInt16LE(s+2), buf.readInt16LE(s+4), buf.readInt16LE(s+6)];
      walls.push({ x1:rd[0], y1:rd[1], x2:rd[2], y2:rd[3], thick:g.thick, height:g.height });
    }
  }
  // de-dup identical wall segments
  const seen = new Set();
  const wallsU = walls.filter(w => { const k = [w.x1,w.y1,w.x2,w.y2].join(','); if (seen.has(k)) return false; seen.add(k); return true; });

  // --- item type tokens (ALLCAPS/underscore), minus primitive glyph names ---
  const tokRe = /\b([A-Z][A-Z0-9_]{3,15})\b/g; const tok = {}; let m;
  while ((m = tokRe.exec(text)) !== null){ const s = m[1];
    if (PRIM_SET.has(s) || /^(SECTION|GENERAL|ENDSEC|SUPP)$/.test(s)) continue;
    tok[s] = (tok[s] || 0) + 1; }
  // the dominant repeated token is the fixture type (e.g. SUPP_FR)
  const fixtureType = Object.entries(tok).filter(([k,v]) => v >= 4)
    .sort((a,b) => b[1]-a[1])[0];

  // --- fixtures: locate all records of the fixture token, auto-find (X,Y) ---
  const items = [];
  let fxOffset = null, fxType = null;
  // wall bounding box guides the position-field search
  let bx0=1/0,bx1=-1/0,by0=1/0,by1=-1/0;
  for (const w of wallsU){ bx0=Math.min(bx0,w.x1,w.x2); bx1=Math.max(bx1,w.x1,w.x2);
    by0=Math.min(by0,w.y1,w.y2); by1=Math.max(by1,w.y1,w.y2); }
  const bbox = Number.isFinite(bx0) ? {minX:bx0,maxX:bx1,minY:by0,maxY:by1} : {minX:-5000,maxX:5000,minY:-5000,maxY:5000};
  if (fixtureType){
    fxType = fixtureType[0];
    const offs = findAll(buf, fxType);
    fxOffset = findPosOffset(buf, offs, bbox);
    if (fxOffset != null){
      for (const p of offs){
        const x = buf.readInt32LE(p + fxOffset), y = buf.readInt32LE(p + fxOffset + 4);
        items.push({ name: fxType, category: 'תשתית', type: fxType,
          x, y, z: 1100, rotation_deg: 0, width: 90, depth: 40, height: 90 });
      }
    }
  }

  // --- cabinets: catalog codes present as placed articles ---
  const codeRe = /\b([A-Z]{2,6}\d{2,3}[A-Z]?)\b/g; const codes = {};
  while ((m = codeRe.exec(text)) !== null){ const c = m[1];
    if (/^(BK|RGB|ZYL)\d/.test(c)) continue; codes[c] = (codes[c]||0)+1; }
  const cabinets = [];
  let idx = 0;
  for (const [code, n] of Object.entries(codes)){
    const r = resolveCatalog(code);
    if (r.kind === 'front') continue;
    // In native files DKP60/DLB60 are the embedded catalog dictionary (count 1);
    // treat a code as placed only when count>1 OR there is real cabinet geometry.
    const placed = n > 1 ? n : 0;
    for (let i = 0; i < placed; i++) cabinets.push({ index: idx++, code, ...r });
  }

  const inventory = { primitives:{}, catalog:codes, korpusStride:null, fixtureType:fxType };
  for (const mk of PRIMITIVES){ const at = findAll(buf, mk); if (at.length) inventory.primitives[mk] = { count:at.length, first:at[0] }; }

  return {
    file, size: buf.length, format:'native', job, inventory,
    fixtureCount: items.length, cabinetCount: cabinets.length,
    walls: wallsU, wallsOk: wallsU.length > 0, items, cabinets,
  };
}

// ---------------------------------------------------------------------------
// Main reader — dispatches on file format.
// ---------------------------------------------------------------------------
function readPdp(input){
  const buf = asBuf(input);
  const file = Buffer.isBuffer(input) ? '(buffer)' : input;
  if (isNativePdp(buf)) return readNative(buf, file);

  // --- job identity: first few ASCII runs, minus the boilerplate "General" ---
  const head = asciiRuns(buf, 3, 40).map(r => r.s)
    .filter(s => s !== 'General' && !/^[$\-0-9?<>.\[\] ]+$/.test(s));
  const job = { name: head[0] || null, hints: head.slice(0, 6) };

  // --- primitive inventory ---
  const inventory = { primitives:{}, catalog:{}, korpusStride:null };
  for (const m of PRIMITIVES){
    const at = findAll(buf, m);
    if (at.length) inventory.primitives[m] = { count: at.length, first: at[0] };
  }
  // KORPUS carcass stride (successive records) — expected 210 bytes.
  const kor = findAll(buf, 'KORPUS');
  if (kor.length >= 2) inventory.korpusStride = kor[1] - kor[0];

  // --- catalog article codes (DKP60 / DLB60 / TUERE##...) ---
  const text = buf.toString('latin1');
  let mm; const codes = {};
  while ((mm = CODE_RE.exec(text)) !== null){
    const code = mm[1];
    // ignore obvious non-catalog tokens (colors, fonts) by requiring a letter+digit shape
    if (/^(BK|RGB|CMYK)\d/.test(code)) continue;
    codes[code] = (codes[code] || 0) + 1;
  }
  inventory.catalog = codes;

  // --- cabinet count: KORPUS carcasses are the placed cabinet bodies ---
  const korCount = inventory.primitives.KORPUS ? inventory.primitives.KORPUS.count : 0;

  // --- best-effort walls ---
  const wt = readWallsTemplate(buf);

  // --- cabinet list: expand each VOLUME catalog code by its observed count
  //     (the design's real bill-of-materials: e.g. 15×SO60, 8×IK363, 11×AP60).
  //     Fronts/fillers/handles are skipped (they clad a carcass, not a volume).
  //     This reflects what the PDP actually contains; exact per-record positions
  //     await decoding of the 210-byte KORPUS records. ---
  const cabinets = [];
  let idx = 0;
  for (const [code, n] of Object.entries(codes)){
    const c = catalogFor(code);
    if (c.kind === 'front') continue;                 // door/filler/handle -> not a volume
    for (let i = 0; i < n; i++) cabinets.push({ index: idx++, code, ...c });
  }
  // If no article codes resolved to volumes, fall back to one box per KORPUS.
  if (!cabinets.length){
    for (let i = 0; i < korCount; i++) cabinets.push({ index:i, code:'KORPUS', ...catalogFor('KORPUS') });
  }

  return {
    file, size: buf.length,
    job,
    inventory,
    cabinetCount: korCount,
    walls: wt.walls, wallsOk: wt.ok,
    cabinets,
  };
}

// ---------------------------------------------------------------------------
// sceneFromPdp — assemble the viewer scene contract from a PDP.
//   walls    : from the template table if valid, else caller-supplied fallback.
//   cabinets : catalog carcasses auto-laid along the longest wall run (standard
//              module dims) until exact per-record positions are decoded.
//   items    : left empty here (MEP fixtures come from the ORDX pipeline, which
//              is the reliable source; the viewer can merge them).
// opts.fallbackWalls: walls[] to use when the PDP wall table is not readable.
// ---------------------------------------------------------------------------
function sceneFromPdp(input, opts = {}){
  const r = readPdp(input);
  const walls = r.wallsOk ? r.walls : (opts.fallbackWalls || []);
  // native files carry real fixture positions; legacy files take fixtures from
  // the caller (ORDX pipeline).
  const items = (r.items && r.items.length) ? r.items : (opts.items || []);
  const cabinets = autoLayoutCabinets(walls, r.cabinets || [], opts);
  return { walls, items, cabinets, _pdp: {
    file: require('path').basename(String(r.file)),
    format: r.format || 'legacy',
    job: r.job.name, cabinetCount: r.cabinetCount,
    fixtureCount: r.fixtureCount != null ? r.fixtureCount : items.length,
    fixtureType: r.inventory.fixtureType || null,
    catalog: r.inventory.catalog, wallsFromPdp: r.wallsOk,
    primitives: Object.fromEntries(Object.entries(r.inventory.primitives).map(([k,v]) => [k, v.count])),
  }};
}

// Lay the catalog carcasses along the walls (flowing wall-to-wall): base + tall
// on the floor, wall units above, worktops as slabs over the base runs. Fronts
// are skipped (they clad a carcass, not a volume). Returns viewer cabinet objects
// {code,kind,x,y,z0,w,d,h,rotation_deg}. Positions are a standard-module layout,
// used until per-KORPUS positions are decoded from the 210-byte records.
function autoLayoutCabinets(walls, cabs, opts = {}){
  if (!walls.length || !cabs.length) return [];
  // wall runs sorted longest-first give a stable primary counter run
  const runs = walls.map(w => {
    const L = Math.hypot(w.x2-w.x1, w.y2-w.y1) || 1;
    return { w, L, ux:(w.x2-w.x1)/L, uy:(w.y2-w.y1)/L, half:(w.thick||100)/2,
             rot: Math.atan2(w.y2-w.y1, w.x2-w.x1)*180/Math.PI };
  }).sort((a,b) => b.L - a.L);

  const floorCabs = cabs.filter(c => c.kind==='base' || c.kind==='tall');
  const wallCabs  = cabs.filter(c => c.kind==='wall');
  const hasWorktop = cabs.some(c => c.kind==='worktop');
  const out = [];
  const margin = 60; // keep off the corners
  const occupied = runs.map(() => margin); // along-cursor per run
  const baseSpan = runs.map(() => ({ start: null, end: 0 })); // base extent per run

  // Flow a list of carcasses across runs, wrapping to the next wall when full.
  function flow(list, depthPref){
    let ri = 0;
    for (const c of list){
      let guard = 0;
      while (ri < runs.length && occupied[ri] + c.W > runs[ri].L - margin && guard++ < runs.length) ri++;
      if (ri >= runs.length) break;
      const r = runs[ri], nx = -r.uy, ny = r.ux;
      const centre = occupied[ri] + c.W/2, depthOff = r.half + c.D/2;
      out.push({ code:c.code, kind:c.kind,
        x: r.w.x1 + r.ux*centre + nx*depthOff, y: r.w.y1 + r.uy*centre + ny*depthOff,
        z0:c.z0, w:c.W, d:c.D, h:c.H, rotation_deg:r.rot });
      if (c.kind !== 'wall'){
        if (baseSpan[ri].start == null) baseSpan[ri].start = occupied[ri];
        baseSpan[ri].end = occupied[ri] + c.W;
      }
      occupied[ri] += c.W;
    }
  }
  flow(floorCabs);
  flow(wallCabs);

  // One continuous worktop slab over the base extent of every run that got base
  // cabinets (standard 620mm deep, top at 900mm).
  if (hasWorktop){
    runs.forEach((r, ri) => {
      const b = baseSpan[ri];
      if (b.start == null) return;
      const span = b.end - b.start;
      if (span < 100) return;
      const nx = -r.uy, ny = r.ux, centre = b.start + span/2, depthOff = r.half + 620/2;
      out.push({ code:'AP', kind:'worktop',
        x: r.w.x1 + r.ux*centre + nx*depthOff, y: r.w.y1 + r.uy*centre + ny*depthOff,
        z0:900, w:span, d:620, h:40, rotation_deg:r.rot });
    });
  }
  return out;
}

module.exports = { readPdp, readNative, isNativePdp, sceneFromPdp, CATALOG,
  catalogFor, resolveCatalog, loadElkincho, autoLayoutCabinets };

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module){
  const f = process.argv[2];
  if (!f){ console.error('usage: node src/readPdp.js <file.pdp> [--json]'); process.exit(2); }
  const r = readPdp(f);
  if (process.argv.includes('--json')){ console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  console.log('PDP inspector —', r.file);
  console.log('  size / format ......', r.size, 'bytes /', r.format || 'legacy');
  console.log('  job ................', r.job.name, '  hints:', r.job.hints.join(' | '));
  if (r.format === 'native')
    console.log('  fixtures (' + (r.inventory.fixtureType||'?') + ') ....', r.fixtureCount);
  console.log('  cabinets ...........', r.cabinetCount, r.inventory.korpusStride ? `(KORPUS stride ${r.inventory.korpusStride}B)` : '');
  console.log('  primitives .........', Object.entries(r.inventory.primitives).map(([k,v])=>`${k}:${v.count}`).join('  ') || '(none)');
  const cat = Object.entries(r.inventory.catalog).sort((a,b)=>b[1]-a[1]).slice(0,10);
  console.log('  catalog codes ......', cat.map(([k,v])=>`${k}×${v}`).join('  ') || '(none)');
  console.log('  walls (template) ...', r.wallsOk ? `${r.walls.length} read` : 'not in template layout (use ORDX for walls)');
}
