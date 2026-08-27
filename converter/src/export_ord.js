'use strict';
/*
 * export_ord.js — Soline -> Cabinet Vision "ORD-Extended v4" (ASCII Order Entry).
 * =============================================================================
 * מייצא את מודל-החדר של Soline לפורמט ORD-Extended v4 של Cabinet Vision (Hexagon),
 * כך שהפלט נפתח נייטיבית ב-CV 2020–2025 ללא תלות בקטלוג (מסלול "מדידה בלבד").
 *
 * SPEC SOURCE (single source of truth for this file):
 *   docs/ORDX_SPEC_FROM_WEB.md  — the clean-room, public-web ORD-Extended v4 spec.
 *   Every field/enum/convention below is transcribed from that document. Nothing here
 *   is copied from Soline's proprietary ORDX code — ORD is a clean, independent impl.
 *
 * CONVENTIONS (spec §1):
 *   - [Header] Version=4, Unit=1  => metric, ALL numbers are millimetres.
 *   - Plan coords are (X, Z); height is the separate Y axis.
 *     Soline's model plan is (X, Y_up). We map ORD-Z := model-Y directly (value-for-value):
 *     a viewer drawing ORD with "Z up the page" sees the SAME picture as the model with
 *     "Y up" — handedness preserved, no mirror. Elevation (sill / mount height) = model Y-of-item.
 *   - Wall angle (spec §1.3, SPEC-CONFIRMED against the published example):
 *         end = start + Length * (cos theta, -sin theta)   in (X, Z)
 *     => theta = atan2( -(endZ - startZ), endX - startX )   [0°=+X, 90°=-Z, clockwise plan]
 *   - Walls auto-join at coincident endpoints; we round to 0.001 mm so shared corners match.
 *   - Wall-attached items pick a face with "n" / "n-F" / "n-B"; we emit plain "n" (front) by default.
 *   - ASCII only, CRLF line endings, strings double-quoted, forbidden chars (# ? = | ;) stripped.
 *   - Modify Code "N" (New) on first export (spec §2.4 enum).
 *
 * SPEC-CONFIRMED vs ASSUMED (called out honestly, per the owner's instruction):
 *   [CONFIRMED] section order, field lists/enums, Version/Unit, wall angle formula,
 *               fixture enum 1=Outlet/2=Switch/3=Phone/4=Pipe, floor = >=3 (X,Z) pairs.
 *   [ASSUMED]   Window/Door "Offset from Wall start" is to the NEAR (left) edge, not centre
 *               (spec is silent; the Leica utility captures the bottom-left point, so near-edge
 *               is the better bet). Toggle with opts.openingOffset='center' if a CV seat shows otherwise.
 *   [ASSUMED]   Soline->section/enum mapping for items with no exact ORD analogue (see classify()).
 *   [GATED]     Round-trip fidelity (does CV re-open it exactly?) needs a licensed CV seat — see §8.
 */

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Round to kill float noise so shared wall endpoints are EXACTLY equal (spec §5).
function r3(n) {
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
}

// Format a number: fixed 3-dp, strip trailing zeros -> clean "16700", "900", "2.5".
function fmt(n) {
  const v = r3(n);
  let s = v.toFixed(3);
  s = s.replace(/\.?0+$/, '');
  if (s === '' || s === '-0') s = '0';
  return s;
}

// ASCII-sanitise a string for a quoted ORD field: drop non-ASCII (Hebrew etc.) and the
// characters the docs say break parsing (# ? = | ;) plus the quote char itself.
function ascii(str) {
  let out = '';
  for (const ch of String(str == null ? '' : str)) {
    const c = ch.codePointAt(0);
    if (c > 126 || c < 32) continue;                 // non-printable / non-ASCII
    if ('#?=|;"'.includes(ch)) continue;             // spec-forbidden + quote
    out += ch;
  }
  return out.trim();
}

// Quote a (sanitised) string field.
function q(str) { return '"' + ascii(str) + '"'; }

// ---------------------------------------------------------------------------
// Soline element -> ORD section + enum classifier.
//   Returns one of:
//     { sec:'windows' }
//     { sec:'doors' }
//     { sec:'fixtures',  type: 1|2|3|4, label }         // spec §2.8 enum
//     { sec:'appliances',type: 1..15,  label }          // spec §2.7 enum
//     { sec:null,        label }                          // no ORD analogue -> reported, skipped
// Name-based (works for both English ORDX names and Hebrew catalog names) with the
// class hint ('Fixture' vs 'Decorative') as a tie-breaker. [ASSUMED mapping — §top]
// ---------------------------------------------------------------------------
function classify(name, cls) {
  const n = String(name || '').toLowerCase();

  // --- Architectural openings ------------------------------------------------
  // Windows (a shutter box / window sill is not itself an opening).
  if (/(window|חלון)/.test(n) && !/(shutter|sill)/.test(n)) return { sec: 'windows', label: 'Window' };
  // Doors / doorways / passages / swings / entrances. NB: keep keywords specific so a
  // ceiling "Air Opening" (a vent, not a doorway) is NOT swept in here.
  if (/(doorway|passage|hinged|entrance|threshold|\bdoor\b|מעבר|דלת|כניסה)/.test(n)) {
    return { sec: 'doors', label: 'Door' };
  }

  // --- Appliances (spec §2.7 enum) ------------------------------------------
  if (/(sink|כיור)/.test(n))                 return { sec: 'appliances', type: 10, label: 'Sink' };
  if (/(refriger|fridge|מקרר)/.test(n))      return { sec: 'appliances', type: 1,  label: 'Refrigerator' };
  if (/(hood|קולט)/.test(n))                 return { sec: 'appliances', type: 2,  label: 'Hood' };
  if (/(microwave|מיקרו)/.test(n))           return { sec: 'appliances', type: 3,  label: 'Microwave' };
  if (/(\brange\b|oven|תנור)/.test(n))       return { sec: 'appliances', type: 4,  label: 'Range' };
  if (/(dishwash|מדיח)/.test(n))             return { sec: 'appliances', type: 5,  label: 'Dishwasher' };
  if (/(cook.?top|כיריים)/.test(n))          return { sec: 'appliances', type: 9,  label: 'Cook Top' };
  if (/(washer|כביסה)/.test(n))              return { sec: 'appliances', type: 7,  label: 'Washer' };
  if (/(dryer|מייבש)/.test(n))               return { sec: 'appliances', type: 8,  label: 'Dryer' };

  // --- Fixtures (electrical / plumbing points; spec §2.8 enum 1..4) ----------
  if (/(switch|מפסק)/.test(n))                         return { sec: 'fixtures', type: 2, label: 'Switch' };
  if (/(phone|\btv\b|tele|data|network|multimedia|טלפון|תקשורת|טלוי)/.test(n))
    return { sec: 'fixtures', type: 3, label: 'Phone Line' };
  if (/(water|faucet|sewage|sewer|drain|pipe|plumb|gas|toilet|wc|אסלה|ברז|מים|ניקוז|ביוב|גז|צנרת)/.test(n))
    return { sec: 'fixtures', type: 4, label: 'Pipe Line' };
  // Electrical points (sockets / power boxes / junction / cable nodes / panels).
  if (/(socket|outlet|power|junction|cable|panel|receptacle|שקע|לוח|חשמל)/.test(n))
    return { sec: 'fixtures', type: 1, label: 'Power Outlet' };

  // --- No ORD analogue (beams, columns, AC units, radiators, air openings,
  //     shutter boxes, can lights, …): reported as unmapped, left out of the file. ---
  return { sec: null, label: ascii(name) || 'Item' };
}

// ---------------------------------------------------------------------------
// Geometry: pull a flat, ORD-numbered wall list out of the model. Each entry:
//   { num, X, Z, dir, len, height, thick, items:[modelItem…] }
// Wall numbers are 1-based and sequential across ALL rooms (ORD is single-room;
// we concatenate — see report). Items keep their host wall via that number.
// ---------------------------------------------------------------------------
function collectWalls(model) {
  const walls = [];
  let num = 0;
  for (const room of (model.rooms || [])) {
    for (const w of (room.walls || [])) {
      const p = w.position;
      if (!p || p.startX == null || p.startY == null) continue;
      num += 1;
      const sx = p.startX, sz = p.startY;                 // ORD Z := model Y
      const ex = (p.endX != null) ? p.endX : sx;
      const ez = (p.endY != null) ? p.endY : sz;
      const dx = ex - sx, dz = ez - sz;
      const len = (w.dimensions && w.dimensions.length != null)
        ? w.dimensions.length : Math.hypot(dx, dz);
      const dir = Math.atan2(-dz, dx) * 180 / Math.PI;    // spec §1.3 clockwise convention
      walls.push({
        num,
        X: r3(sx), Z: r3(sz),
        dir: r3(dir), len: r3(len),
        height: r3((w.dimensions && w.dimensions.height) || 2500),
        thick: r3((w.dimensions && w.dimensions.thick) || 100),
        endX: r3(ex), endZ: r3(ez),
        items: [...(w.fixtures || []), ...(w.furnishings || [])],
      });
    }
  }
  return walls;
}

// Along-wall offset of a model item, in ORD "Offset from Wall start" terms.
// Model convention (see planItems in soline_convert.js):
//   - Decorative items (windows/doors/openings): position.x is already the item CENTRE.
//   - Fixture points (sockets/switches/…): position.x is the item's near corner / point.
function alongCentre(it) {
  const px = (it.position && it.position.x != null) ? it.position.x : 0;
  const w = (it.size && it.size.width != null) ? it.size.width : 0;
  return it.class === 'Decorative' ? px : px + w / 2;   // -> the item's CENTRE along the wall
}

// ---------------------------------------------------------------------------
// exportOrd(model, opts) -> ASCII ORD-Extended v4 string.
//   opts.name           job/room name for [Header] Name= (default: first room name)
//   opts.comment        [Header] Comment= (default: "Measure-only export - no catalog")
//   opts.openingOffset  'edge' (default, near-edge) | 'center'  [ASSUMED — see §top]
//   opts.photos         optional [{ wall, offset, dist, path }] -> [Photos] (spec §2.15)
//   opts.eol            line ending (default CRLF '\r\n')
// Returns a valid file even for an empty model (Header only).
// Attaches a non-enumerable `.stats` for the self-test.
// ---------------------------------------------------------------------------
function exportOrd(model, opts) {
  opts = opts || {};
  const EOL = opts.eol || '\r\n';
  const nearEdge = opts.openingOffset !== 'center';   // default: near-edge
  model = model || { rooms: [] };

  const stats = {
    version: 4, unit: 1,
    walls: 0, windows: 0, doors: 0, fixtures: 0, appliances: 0,
    floors: 0, photos: 0, unmapped: [], sections: [],
    fixtureTypes: {}, applianceTypes: {},
  };

  const walls = collectWalls(model);

  // Section buffers -----------------------------------------------------------
  const windows = [];    // W,H,Comment,Wall,Offset,Sill                         (spec §2.5)
  const doors = [];      // W,H,Comment,Wall,Offset                              (spec §2.6)
  const appliances = []; // Type,W,H,D,Comment,Wall,Offset,Dist,,,Pull,ID,Modify (spec §2.7)
  const fixtures = [];   // Wall,Offset,Dist,Outset,Type,Comment,ID,Modify       (spec §2.8)

  for (const w of walls) {
    for (const it of w.items) {
      const c = classify(it.name, it.class);
      // Comment: the item's own name, ASCII-sanitised; if that leaves nothing
      // (Hebrew-only names like כיור/אסלה), fall back to the English section label.
      const cmt = ascii(it.name) || c.label;
      const sz = it.size || {};
      const centre = alongCentre(it);
      const iw = (sz.width != null) ? sz.width : null;
      const ih = (sz.height != null) ? sz.height : null;
      const id = (sz.depth != null) ? sz.depth : null;
      const mount = (it.position && it.position.y != null) ? it.position.y : 0;   // elevation (Y)
      const outset = (it.position && it.position.z != null) ? it.position.z : 0;  // perpendicular pull

      if (c.sec === 'windows') {
        const W = iw != null ? iw : 1000, H = ih != null ? ih : 1000;
        const off = nearEdge ? Math.max(0, centre - W / 2) : centre;
        windows.push([fmt(W), fmt(H), q(cmt), String(w.num), fmt(off), fmt(mount)].join(','));
        stats.windows++;
      } else if (c.sec === 'doors') {
        const W = iw != null ? iw : 900, H = ih != null ? ih : 2050;
        const off = nearEdge ? Math.max(0, centre - W / 2) : centre;
        doors.push([fmt(W), fmt(H), q(cmt), String(w.num), fmt(off)].join(','));
        stats.doors++;
      } else if (c.sec === 'appliances') {
        const W = iw != null ? iw : 600, H = ih != null ? ih : 850, D = id != null ? id : 600;
        const off = nearEdge ? Math.max(0, centre - W / 2) : centre;
        // fields 9,10 (Cabinet Height / Above Floor) apply only to Wall Oven & Fridge Box -> empty.
        appliances.push([
          String(c.type), fmt(W), fmt(H), fmt(D), q(cmt),
          String(w.num), fmt(off), fmt(mount), '', '', fmt(outset), '', 'N',
        ].join(','));
        stats.appliances++;
        stats.applianceTypes[c.type] = (stats.applianceTypes[c.type] || 0) + 1;
      } else if (c.sec === 'fixtures') {
        // Point feature: Wall, Offset(=point along), Dist(=mount Y), Outset, Type, Comment, ID, Modify
        fixtures.push([
          String(w.num), fmt(centre), fmt(mount), fmt(outset),
          String(c.type), q(cmt), '', 'N',
        ].join(','));
        stats.fixtures++;
        stats.fixtureTypes[c.type] = (stats.fixtureTypes[c.type] || 0) + 1;
      } else {
        stats.unmapped.push(ascii(it.name) || '(unnamed)');
      }
    }
  }

  // Floors: one polygon per room. Prefer a real floorShape; else close the wall loop
  // (wall start points, in order). Need >=3 (X,Z) pairs (spec §2.9).
  const floors = [];
  for (const room of (model.rooms || [])) {
    let ring = null;
    if (Array.isArray(room.floorShape) && room.floorShape.length >= 3) {
      ring = room.floorShape.map((p) => [p.x, p.y]);              // {x,y}: y = model Y = ORD Z
    } else {
      const pts = (room.walls || [])
        .map((w) => w.position)
        .filter((p) => p && p.startX != null && p.startY != null)
        .map((p) => [p.startX, p.startY]);
      if (pts.length >= 3) ring = pts;
    }
    if (ring) {
      floors.push(ring.map(([x, z]) => fmt(x) + ',' + fmt(z)).join(','));
    }
  }
  stats.floors = floors.length;

  // Photos (optional, opts-driven only — Soline .sol photos have no CV-readable local path).
  const photos = [];
  for (const ph of (opts.photos || [])) {
    if (!ph || !ph.path) continue;
    photos.push([
      String(ph.wall != null ? ph.wall : 0),
      fmt(ph.offset || 0), fmt(ph.dist || 0),
      q(ph.path), '', 'N',
    ].join(','));
  }
  stats.photos = photos.length;
  stats.walls = walls.length;

  // -------------------------------------------------------------------------
  // Emit sections in spec order: Header, Walls, Windows, Doors, Appliances,
  // Fixtures, Floors, [Photos]. [Walls] MUST precede anything wall-attached (§2 note).
  // -------------------------------------------------------------------------
  const L = [];
  const push = (line) => L.push(line);
  const section = (tag) => { push('[' + tag + ']'); stats.sections.push(tag); };

  const jobName = opts.name || (model.rooms && model.rooms[0] && model.rooms[0].name) ||
    (model.job && model.job.name) || 'Soline Room Export';
  const comment = opts.comment != null ? opts.comment : 'Measure-only export - no catalog';

  section('Header');
  push('Version=4');
  push('Unit=1');
  push('Name=' + q(jobName));
  if (comment) push('Comment=' + q(comment));

  if (walls.length) {
    push('');
    section('Walls');
    for (const w of walls) {
      // 6 core fields + explicit 1-based Wall Number (field 7). Straight, non-radius.
      push([fmt(w.X), fmt(w.Z), fmt(w.dir), fmt(w.len), fmt(w.height), fmt(w.thick), String(w.num)].join(','));
    }
  }

  if (windows.length) { push(''); section('Windows'); windows.forEach(push); }
  if (doors.length)   { push(''); section('Doors');   doors.forEach(push); }
  if (appliances.length) { push(''); section('Appliances'); appliances.forEach(push); }
  if (fixtures.length){ push(''); section('Fixtures'); fixtures.forEach(push); }
  if (floors.length)  { push(''); section('Floors');  floors.forEach(push); }
  if (photos.length)  { push(''); section('Photos');  photos.forEach(push); }

  const text = L.join(EOL) + EOL;

  // Guarantee ASCII on the wire (defensive; every field was already sanitised).
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out += c <= 127 ? text[i] : '';
  }

  // Attach stats for the self-test without polluting the string contract.
  try { Object.defineProperty(out, 'stats', { value: stats, enumerable: false }); } catch (_) { /* primitive string: ignore */ }
  exportOrd._lastStats = stats;
  return out;
}

module.exports = { exportOrd, classify, collectWalls };
