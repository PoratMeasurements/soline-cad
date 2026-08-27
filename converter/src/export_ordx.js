'use strict';
// ORDX exporter for Soline — the INVERSE of parseOrdx.js.
//
// Two entry points, matching the object-model contract (OBJECT_MODEL.md):
//   * objectToFixture(object, placement) -> an ORDX item descriptor
//     (a single canonical Soline object placed on a wall).
//   * exportORDX(model)                  -> a complete, well-formed ORDX
//     XML string that the existing parseOrdx.js reads back losslessly.
//
// exportORDX accepts the SAME normalized shape parseOrdx.js produces
// (format/unit/job/rooms[].walls[].{fixtures,furnishings}), so a
// parse -> export -> parse round-trip reproduces every object, dimension
// and position. It also accepts a lighter shape (a bare {walls:[...]} or a
// single {room}) for hand-built models.
//
// CLI:
//   node src/export_ordx.js <in.ordx> [out.ordx]   round-trip re-export
//   node src/export_ordx.js --selftest             parse/export/parse check

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// formatting helpers
// ---------------------------------------------------------------------------

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ESC[c]);
}

// Coordinates / wall geometry / decorative Size: corpus uses 6 decimals.
function fmtF(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Number(n).toFixed(6);
}

// Fixture dimensions sit as plain integers in the corpus (e.g. <Width>160</Width>).
function fmtDim(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(6);
}

// A tiny indentation-aware line buffer.
function lineBuf() {
  const lines = [];
  return {
    push(indent, text) { lines.push(' '.repeat(indent) + text); },
    // open/close/leaf convenience for readability
    join() { return lines.join('\n'); },
    lines,
  };
}

function leaf(indent, tag, value) {
  return ' '.repeat(indent) + `<${tag}>${esc(value)}</${tag}>`;
}

// ---------------------------------------------------------------------------
// ORDX element catalog + Class/Type taxonomy
// ---------------------------------------------------------------------------
// Genuine InnoDraw/CV ORDX represents every placed element with a Class + Type
// pair that a downstream tool (Cabinet Vision, Raumplan) uses to pick a library
// item, plus a full attribute set (bilingual name, W/D/H, mount height, catalog).
// The taxonomy below was reverse-engineered from the real ORDX corpus (296 real
// items across kitchen DR files + the mimran sets + the ALL-elements sample):
//
//   Class=Fixture,    Type=Miscellaneous  -> wall electrical/comms/smart devices
//                                             (Socket, Duplex Socket, Switch,
//                                              Junction Box, Power Line, SocketEx)
//   Class=Fixture,    Type=Part           -> plumbing/gas POINTS (Faucet, Gas,
//                                             Water Supply) and drains (Sewage,
//                                             Sewer drainage — these carry Depth)
//   Class=Decorative, Type=Window         -> windows (all glazing)
//   Class=Decorative, Type=EntryDoor      -> doors / doorways / passages / arches
//   Class=Decorative, Type=TWall          -> Beam (structural drop across a wall)
//   Class=Decorative, Type=Part           -> ShutterBox, WindowSill
//   Class=Decorative, Type=Miscellaneous  -> ceiling elements (Can Light, ceiling
//                                             drops, diffusers), Power Box (panel),
//                                             columns, wall segments, misc.
//
// This map is what makes the elements that go INTO the ORDX complete and correct
// instead of a thin "everything is Fixture/Miscellaneous" subset.

// מקור-האמת היחיד לסיווג/מידות: element_catalog (מעוגן ב-249 קבצי-ORDX אמיתיים).
// הממיר מתדרדר בחן לחוקן פנימי אם המודול חסר.
let CATALOG_MOD = null;
try { CATALOG_MOD = require('./element_catalog'); } catch (_) { CATALOG_MOD = null; }

const _norm = (s) => String(s == null ? '' : s).trim().toLowerCase();

// Resolve an element (by name string OR a canonical object) to a fully-populated
// ORDX descriptor part: { name, he, description, class, type, w, d, h, mount,
// measure }. כל השדות נשלפים מ-element_catalog כך שORDX/DXF-2D/DXF-3D עקביים.
// Returns null only when there is truly nothing to work with.
function resolveORDX(nameOrObj) {
  const obj = (nameOrObj && typeof nameOrObj === 'object') ? nameOrObj : null;
  const rawName = obj
    ? (obj.ordx_name || obj.en || obj.name || obj.he || obj.description || '')
    : String(nameOrObj || '');
  if (!rawName && !obj) return null;
  if (!CATALOG_MOD) {
    // fallback שמרני ביותר אם הקטלוג לא נטען.
    return { name: rawName, he: obj && (obj.he || obj.heName) || null,
      description: null, cls: (obj && obj.class) || 'Fixture',
      type: (obj && obj.type) || 'Miscellaneous',
      w: null, d: null, h: null, mount: null, measure: 'direct' };
  }
  const r = CATALOG_MOD.classify(obj || rawName);
  // שם-InnoDraw לפליטה: override מפורש -> שם-הקטלוג.
  const name = (obj && obj.ordx_name) || r.ordxName || rawName;
  return {
    name,
    he: r.he,
    description: (obj && obj.ordx_description) || r.he || null,
    cls: r.ordxClass,
    type: r.ordxType,
    w: r.w, d: r.d, h: r.h,
    mount: r.mount,
    measure: r.measure,          // 'nested' | 'direct' — מוסכמת-מידה מהקורפוס
  };
}

// Build an <Attributes> parameter list from a canonical object's extra fields.
// Genuine ORDX carries such <Parameter> rows (e.g. SLOTDX/SLOTDY for an AC
// ceiling-drop). We surface orientation, mount-status and protrusion the same
// way so InnoDraw ignores what it does not know while nothing is lost silently.
function attributesFromObject(object, placement) {
  const p = placement || {};
  const params = [];
  const push = (nm, ty, val) => {
    if (val == null || val === '') return;
    params.push({ name: nm, type: ty, value: val });
  };
  // הקורפוס נושא אך ורק Parameter/Type = M (0 מופעי S ב-249 קבצים; ראה
  // ORDX_SPEC_VALIDATION.md §2.6/§3). לכן פולטים רק פרמטרים מספריים (M) —
  // מטא-נתונים מחרוזתיים (FACE/STATUS) לא נפלטים כדי לא לזהם את הקובץ בערך
  // שכלי-היעד לא מכיר.
  const rot = p.rotation_deg != null ? p.rotation_deg : object.rotation_deg;
  push('ROTATION', 'M', rot != null && Number.isFinite(Number(rot)) ? fmtF(rot) : null);
  const prot = object.protrusion_mm;
  push('PROTRUSION', 'M', prot != null ? fmtDim(prot) : null);
  // Pass through pre-built slot/extra parameters — אך ורק אלו מסוג M.
  const extra = object.ordx_parameters || object.parameters;
  if (Array.isArray(extra)) {
    for (const q of extra) {
      if (q && q.name != null && (q.type == null || q.type === 'M')) {
        params.push({ name: q.name, type: 'M', value: q.value });
      }
    }
  }
  return params.length ? params : null;
}

// ---------------------------------------------------------------------------
// object -> item descriptor
// ---------------------------------------------------------------------------

// Convert a canonical Soline object + placement into an ORDX item descriptor
// (the same in-memory shape parseOrdx.js yields for a fixture/furnishing).
// The descriptor can be dropped straight into a wall's item list and handed
// to exportORDX.
//
// Dimension sources accepted (first found wins):
//   object.dimensions_mm {W,D,H}  (OBJECT_MODEL contract)
//   object.{width_mm,depth_mm,height_mm}  (elements.json shape)
// ORDX-specific overrides (optional): object.ordx_name / ordx_class /
// ordx_type / ordx_kind / catalog. Position semantics follow the corpus:
// placement.x = distance ALONG the wall, placement.y = height on the wall,
// placement.z = optional out-of-plane offset.
function objectToFixture(object, placement) {
  if (!object) throw new Error('objectToFixture: object is required');
  const p = placement || {};

  // Catalog-resolved ORDX taxonomy + bilingual name + fallback dims.
  const r = resolveORDX(object) || {};

  const dm = object.dimensions_mm || {};
  // Dimension priority: explicit object dims -> catalog dims from the resolver.
  const W = dm.W != null ? dm.W : (object.width_mm != null ? object.width_mm : r.w);
  const D = dm.D != null ? dm.D : (object.depth_mm != null ? object.depth_mm : r.d);
  const H = dm.H != null ? dm.H : (object.height_mm != null ? object.height_mm : r.h);

  const hasSize = [W, D, H].some((v) => v != null);
  // Z (out-of-plane / mount height): explicit placement, else object mount, else
  // the catalog mount height for this element type.
  const z = p.z != null ? p.z
    : (object.mount_height_mm != null ? object.mount_height_mm
      : (r.mount != null ? r.mount : null));

  // Class/Type: explicit override wins, else the resolved genuine taxonomy.
  const cls = object.ordx_class || r.cls || 'Fixture';
  const type = object.ordx_type || r.type || 'Miscellaneous';
  // מוסכמת-מידה (nested/direct) — מהקטלוג, מעוגן בקורפוס.
  const measure = object.ordx_measure || r.measure || 'direct';
  // Decorative openings (window/door) anchor by kind Furnishing in the corpus;
  // Fixtures (sockets/MEP) too. Kind override still honored.
  const kind = object.ordx_kind || (cls === 'Fixture' ? 'fixture' : 'furnishing');

  // Bilingual name: English canonical as Name, Hebrew as Description (falls back
  // to the English description when no Hebrew is available).
  const name = object.ordx_name || r.name || object.en || object.name || '';
  const description = object.ordx_description || r.he || r.description || object.he || '';

  return {
    kind,
    catalog: object.catalog || 'InnoDraw',
    name,
    description,
    class: cls,
    type,
    measure,
    size: hasSize
      ? {
          width: W != null ? W : null,
          height: H != null ? H : null,
          depth: D != null && D !== 0 ? D : null,
        }
      : null,
    position: {
      x: p.x != null ? p.x : null,
      y: p.y != null ? p.y : null,
      z,
    },
    attributes: attributesFromObject(object, p),
  };
}

// ---------------------------------------------------------------------------
// serialization
// ---------------------------------------------------------------------------

// מוסכמת-הקינון נקבעת per-element ע"י הקטלוג (measure), לא לפי סוג בלבד — הקורפוס
// מקנן גם Beam/Power Box/ShutterBox/SocketEx/Cabinet/Air Condition וכו'
// (ראה ORDX_SPEC_VALIDATION.md §2.3). fallback: חלון/דלת/קורה מקוננים.
function isNestedSizeMeasure(measure, type) {
  if (measure === 'nested') return true;
  if (measure === 'direct') return false;
  const t = (type || '').toLowerCase();
  return t === 'window' || t === 'entrydoor' || t === 'door' || t === 'twall';
}

function serializeSize(size, measure, type, ind, out) {
  if (!size) return;
  const { width, height, depth } = size;
  if (isNestedSizeMeasure(measure, type)) {
    out.push(ind, '<Size>');
    if (width != null) out.lines.push(leaf(ind + 1, 'Width', fmtF(width)));
    if (height != null) out.lines.push(leaf(ind + 1, 'Height', fmtF(height)));
    if (depth != null) out.lines.push(leaf(ind + 1, 'Depth', fmtF(depth)));
    out.push(ind, '</Size>');
  } else {
    // Direct children, corpus order: Width, Depth, Height, then empty <Size/>.
    if (width != null) out.lines.push(leaf(ind, 'Width', fmtDim(width)));
    if (depth != null) out.lines.push(leaf(ind, 'Depth', fmtDim(depth)));
    if (height != null) out.lines.push(leaf(ind, 'Height', fmtDim(height)));
    out.push(ind, '<Size>');
    out.push(ind, '</Size>');
  }
}

// Non-destructively complete a placed item before serialization: fill ONLY the
// attributes that are missing (Class, Type, and a Hebrew Description) from the
// catalog taxonomy. Never overrides values already present and never touches
// Size or Position, so a genuine ORDX (which already carries Class/Type/dims)
// re-exports byte-for-byte-equivalently and the verified round-trip is preserved.
function enrichItem(item) {
  if (!item) return item;
  // מוסכמת-המידה (nested/direct) נשלפת תמיד מהקטלוג לפי זהות-האלמנט, גם כשהפריט
  // כבר "שלם" — כדי ש-SocketEx/Power Box/Beam וכו' יקננו כמו בקורפוס. אינה חלק
  // מהשוואת ה-round-trip, ולכן בטוחה לחלוטין.
  if (item.measure == null) {
    const rm = resolveORDX(item.name || item.description);
    if (rm) item.measure = rm.measure;
  }
  const complete = item.class && item.type && item.description;
  // A generic Fixture/Miscellaneous pair is the placeholder default upstream
  // synthesizers stamp on EVERY element. When the catalog confidently classifies
  // the same name as something more specific (Decorative, or a wet/gas Part), the
  // placeholder is upgraded. This is safe for genuine ORDX: every element that is
  // legitimately Fixture/Miscellaneous in the corpus (Socket, Switch, Junction
  // Box, Power Line, SocketEx) also resolves to Fixture/Miscellaneous, so nothing
  // real is reclassified; Decorative/Part items already carry non-default values.
  const isPlaceholder = item.class === 'Fixture' && item.type === 'Miscellaneous';
  if (complete && !isPlaceholder) return item;

  const r = resolveORDX(item.name || item.description);
  if (!r) return item;
  if (!item.class) item.class = r.cls;
  if (!item.type) item.type = r.type;
  if (isPlaceholder && (r.cls !== 'Fixture' || r.type !== 'Miscellaneous')) {
    item.class = r.cls;
    item.type = r.type;
  }
  if (!item.description && r.he) item.description = r.he;
  return item;
}

function serializeAttributes(params, ind, out) {
  if (!params || !params.length) return;
  out.push(ind, '<Attributes>');
  for (const q of params) {
    const parts = [`<Name>${esc(q.name)}</Name>`];
    if (q.type != null) parts.push(`<Type>${esc(q.type)}</Type>`);
    if (q.value != null) parts.push(`<Value>${esc(q.value)}</Value>`);
    out.lines.push(' '.repeat(ind + 1) + `<Parameter>${parts.join('')}</Parameter>`);
  }
  out.push(ind, '</Attributes>');
}

function serializeItem(item, ind, out) {
  enrichItem(item);
  const tag = item.kind === 'fixture' ? 'Fixture' : 'Furnishing';
  out.push(ind, `<${tag}>`);
  if (item.catalog) out.lines.push(leaf(ind + 1, 'Catalog', item.catalog));

  out.push(ind + 1, '<Properties>');
  out.push(ind + 2, '<General>');
  out.lines.push(leaf(ind + 3, 'Name', item.name || ''));
  if (item.description) out.lines.push(leaf(ind + 3, 'Description', item.description));
  if (item.class) out.lines.push(leaf(ind + 3, 'Class', item.class));
  if (item.type) out.lines.push(leaf(ind + 3, 'Type', item.type));
  serializeSize(item.size, item.measure, item.type, ind + 3, out);
  out.push(ind + 2, '</General>');
  // Soline extras (orientation/status/protrusion/slot dims) as genuine-tolerated
  // <Attributes><Parameter> rows. InnoDraw ignores unknown parameters.
  serializeAttributes(item.attributes, ind + 2, out);
  out.push(ind + 1, '</Properties>');

  if (item.position) {
    const { x, y } = item.position;
    // פתחים שקועים (חלון/דלת) יושבים בעובי-הקיר: Z=-100 בקורפוס (כמעט תמיד).
    // מחושב מקומית (ללא מוטציה של המודל) כדי שפתח שנוצר מ-Soline יישב נכון,
    // בלי לפגוע ב-round-trip.
    let z = item.position.z;
    if (z == null && item.class === 'Decorative' && /window|door/i.test(item.type || '')) {
      z = -100;
    }
    out.push(ind + 1, '<Position>');
    if (x != null) out.lines.push(leaf(ind + 2, 'X', fmtF(x)));
    if (y != null) out.lines.push(leaf(ind + 2, 'Y', fmtF(y)));
    if (z != null) out.lines.push(leaf(ind + 2, 'Z', fmtF(z)));
    out.push(ind + 1, '</Position>');
  }

  out.push(ind, `</${tag}>`);
}

function serializeItemGroup(items, containerTag, itemTag, ind, out) {
  if (!items || !items.length) return;
  out.push(ind, `<${containerTag}>`);
  for (const it of items) serializeItem(it, ind + 1, out);
  out.push(ind, `</${containerTag}>`);
}

// ---------------------------------------------------------------------------
// PLANNING (cabinets) -> ORDX. Each cabinet from the .sol planning layer (see
// readSol.js schema) is emitted as a genuine <Furnishing> with Class=Base,
// Type=Standard, Catalog=InnoDraw and a NESTED <Size> (corpus-confirmed for
// base-cabinet furnishings — see element_catalog.js / ORDX_SPEC_VALIDATION.md;
// we deliberately do NOT use <Assembly>). The item is built as the same in-memory
// descriptor a placed furnishing has, so it flows through serializeItem unchanged
// and re-parses losslessly (name kept verbatim, so the summary round-trip holds).
function cabinetToFurnishing(cab) {
  return {
    kind: 'furnishing',
    catalog: 'InnoDraw',
    name: cab.name || 'ארון',
    description: cab.name || '',
    class: 'Base',
    type: 'Standard',
    measure: 'nested',                      // force NESTED <Size> (Width/Height/Depth)
    size: {
      width: cab.width != null ? cab.width : null,
      height: (cab.heightTo != null && cab.heightFrom != null) ? (cab.heightTo - cab.heightFrom) : null,
      depth: cab.depth != null ? cab.depth : null,
    },
    // X = distance along the wall to the cabinet left edge; Y = bottom height.
    position: { x: cab.fromLeft != null ? cab.fromLeft : 0, y: cab.heightFrom != null ? cab.heightFrom : 0, z: null },
    attributes: null,
  };
}

// Group a room's cabinets by the wall they stand against (wallId == wall.number,
// the 0-based wall index). Cabinets with no/unknown wall fall onto the first wall.
function cabinetsByWall(room) {
  const map = new Map();
  const walls = room.walls || [];
  for (const cab of room.cabinets || []) {
    let idx = walls.findIndex((w) => w.number === cab.wallId);
    if (idx < 0) idx = 0;                    // free-standing / unknown -> first wall
    if (!map.has(idx)) map.set(idx, []);
    map.get(idx).push(cabinetToFurnishing(cab));
  }
  return map;
}

function serializeWall(wall, ind, out, extraFurnishings) {
  out.push(ind, '<Wall>');
  if (wall.number != null) out.lines.push(leaf(ind + 1, 'Number', fmtDim(wall.number)));
  if (wall.description) out.lines.push(leaf(ind + 1, 'Description', wall.description));

  const pos = wall.position;
  if (pos) {
    out.push(ind + 1, '<Position>');
    for (const k of ['startX', 'startY', 'angle', 'endX', 'endY']) {
      if (pos[k] != null) {
        const tag = k.charAt(0).toUpperCase() + k.slice(1);
        out.lines.push(leaf(ind + 2, tag, fmtF(pos[k])));
      }
    }
    out.push(ind + 1, '</Position>');
  }

  if (wall.style) {
    out.push(ind + 1, '<Type>');
    out.lines.push(leaf(ind + 2, 'Style', wall.style));
    out.push(ind + 1, '</Type>');
  }

  const dim = wall.dimensions;
  if (dim) {
    // Corpus order; null fields (e.g. Length/Soffit here) are omitted.
    const order = [
      ['length', 'Length'],
      ['height', 'Height'],
      ['soffit', 'Soffit'],
      ['thick', 'Thick'],
      ['vaultHeight', 'VaultHeight'],
    ];
    const present = order.filter(([k]) => dim[k] != null);
    if (present.length) {
      out.push(ind + 1, '<Dimensions>');
      for (const [k, tag] of present) out.lines.push(leaf(ind + 2, tag, fmtF(dim[k])));
      out.push(ind + 1, '</Dimensions>');
    }
  }

  serializeItemGroup(wall.fixtures, 'Fixtures', 'Fixture', ind + 1, out);
  // Wall furnishings PLUS any cabinets that stand against this wall (planning
  // layer). Cabinets never mutate the model — they are merged only for output.
  const furnishings = (extraFurnishings && extraFurnishings.length)
    ? [...(wall.furnishings || []), ...extraFurnishings]
    : wall.furnishings;
  serializeItemGroup(furnishings, 'Furnishings', 'Furnishing', ind + 1, out);

  out.push(ind, '</Wall>');
}

function serializeRoom(room, ind, out) {
  out.push(ind, '<Room>');

  const hasRoomProps = room.name || room.description || room.type;
  if (hasRoomProps) {
    out.push(ind + 1, '<RoomProperties>');
    out.push(ind + 2, '<Room>');
    out.push(ind + 3, '<General>');
    if (room.name) out.lines.push(leaf(ind + 4, 'Name', room.name));
    if (room.description) out.lines.push(leaf(ind + 4, 'Description', room.description));
    if (room.type) out.lines.push(leaf(ind + 4, 'Type', room.type));
    out.push(ind + 3, '</General>');
    out.push(ind + 2, '</Room>');
    out.push(ind + 1, '</RoomProperties>');
  }

  const cabMap = (room.cabinets && room.cabinets.length) ? cabinetsByWall(room) : null;
  out.push(ind + 1, '<Walls>');
  (room.walls || []).forEach((w, wi) => serializeWall(w, ind + 2, out, cabMap ? cabMap.get(wi) : null));
  out.push(ind + 1, '</Walls>');

  out.push(ind, '</Room>');
}

function serializeContact(contact, tag, ind, out) {
  if (!contact) return;
  const fields = [
    ['name', 'Name'], ['address1', 'Address1'], ['address2', 'Address2'],
    ['city', 'City'], ['state', 'State'], ['zip', 'Zip'], ['email', 'Email'],
    ['phone', 'Phone'], ['mobile', 'Mobile'], ['fax', 'Fax'],
    ['contact', 'Contact'], ['comment', 'Comment'],
  ];
  const present = fields.filter(([k]) => contact[k] != null && contact[k] !== '');
  if (!present.length) return;
  out.push(ind, `<${tag}>`);
  for (const [k, t] of present) out.lines.push(leaf(ind + 1, t, contact[k]));
  out.push(ind, `</${tag}>`);
}

// Normalize any accepted input into a {rooms:[...]} list.
function roomsFromModel(model) {
  if (!model) throw new Error('exportORDX: model is required');
  if (Array.isArray(model.rooms)) return model.rooms;
  if (model.room) return [model.room];
  if (Array.isArray(model.walls)) return [{ walls: model.walls }];
  throw new Error('exportORDX: model has no rooms, room, or walls');
}

// Build a complete ORDX XML string from a model.
function exportORDX(model) {
  const rooms = roomsFromModel(model);
  const out = lineBuf();
  const ind = 0;

  out.push(ind, '<?xml version="1.0" encoding="UTF-8"?>');

  const created = model && model.created;
  out.push(ind, created ? `<Job Created="${esc(created)}">` : '<Job>');

  if (model && model.productVersion) {
    out.lines.push(leaf(ind + 1, 'ProductVersion', model.productVersion));
  }

  const unit = (model && model.unit) || 'mm';
  out.lines.push(leaf(ind + 1, 'Unit', unit));

  // Optional Properties/Job/Information block (job name/desc, customer, shipTo).
  const job = (model && model.job) || {};
  const hasJobInfo = job.name || job.description || model.customer || model.shipTo;
  if (hasJobInfo) {
    out.push(ind + 1, '<Properties>');
    out.push(ind + 2, '<Job>');
    out.push(ind + 3, '<Information>');
    if (job.name || job.description) {
      out.push(ind + 4, '<Job>');
      if (job.name) out.lines.push(leaf(ind + 5, 'Name', job.name));
      if (job.description) out.lines.push(leaf(ind + 5, 'Description', job.description));
      out.push(ind + 4, '</Job>');
    }
    serializeContact(model.customer, 'Customer', ind + 4, out);
    serializeContact(model.shipTo, 'ShipTo', ind + 4, out);
    out.push(ind + 3, '</Information>');
    out.push(ind + 2, '</Job>');
    out.push(ind + 1, '</Properties>');
  }

  out.push(ind + 1, '<Rooms>');
  for (const r of rooms) serializeRoom(r, ind + 2, out);
  out.push(ind + 1, '</Rooms>');

  out.push(ind, '</Job>');
  return out.join() + '\n';
}

// Convenience: export straight to a file.
function exportORDXFile(model, outPath) {
  fs.writeFileSync(outPath, exportORDX(model), 'utf8');
  return outPath;
}

module.exports = {
  exportORDX,
  exportORDXFile,
  objectToFixture,
};

// ---------------------------------------------------------------------------
// self-test + CLI
// ---------------------------------------------------------------------------

// Compare two parsed models on everything that matters for a round-trip:
// rooms, walls, wall geometry, and every placed item (name/class/type/size/pos).
function diffModels(a, b) {
  const diffs = [];
  const norm = (m) => ({
    unit: m.unit,
    rooms: (m.rooms || []).map((r) => ({
      name: r.name, type: r.type,
      walls: r.walls.map((w) => ({
        number: w.number,
        description: w.description,
        position: w.position,
        style: w.style,
        dimensions: w.dimensions,
        items: [...w.fixtures, ...w.furnishings].map((it) => ({
          kind: it.kind, name: it.name, class: it.class,
          type: it.type, size: it.size, position: it.position,
        })),
      })),
    })),
  });
  const A = JSON.stringify(norm(a));
  const B = JSON.stringify(norm(b));
  if (A !== B) {
    // Locate first divergence for a helpful message.
    let i = 0;
    while (i < A.length && i < B.length && A[i] === B[i]) i++;
    diffs.push(`models differ at offset ${i}:\n  A: ...${A.slice(Math.max(0, i - 40), i + 40)}...\n  B: ...${B.slice(Math.max(0, i - 40), i + 40)}...`);
  }
  return diffs;
}

function selfTest() {
  const { parseOrdxFile, parseOrdxString } = require('./parseOrdx');
  const sample = 'G:/My Drive/קבצים ללמידת מכונה/ORDX/2918_Ktchn_TRIO_Nir_DR1.ordx';
  const outDir = path.join(__dirname, '..', 'analysis', 'out');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('ORDX exporter self-test');
  console.log('  sample:', sample);

  const modelA = parseOrdxFile(sample);
  const xml = exportORDX(modelA);
  const outPath = path.join(outDir, '2918_reexport.ordx');
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log('  re-exported ->', outPath, `(${xml.length} bytes)`);

  const modelB = parseOrdxString(xml);

  console.log('  original : rooms=%d walls=%d furnishings=%d fixtures=%d',
    modelA.summary.rooms, modelA.summary.walls,
    modelA.summary.furnishings, modelA.summary.fixtures);
  console.log('  reexport : rooms=%d walls=%d furnishings=%d fixtures=%d',
    modelB.summary.rooms, modelB.summary.walls,
    modelB.summary.furnishings, modelB.summary.fixtures);

  const diffs = diffModels(modelA, modelB);
  const countsEqual =
    JSON.stringify(modelA.summary) === JSON.stringify(modelB.summary);

  // objectToFixture smoke check against a canonical element.
  const el = {
    en: 'Duplex Socket', width_mm: 160, depth_mm: 15, height_mm: 80,
    mount_height_mm: 350,
  };
  const fx = objectToFixture(el, { x: 4025, y: 1085 });
  const fxOk = fx.name === 'Duplex Socket' && fx.size.width === 160 &&
    fx.size.height === 80 && fx.size.depth === 15 &&
    fx.position.x === 4025 && fx.position.y === 1085;
  console.log('  objectToFixture:', fxOk ? 'OK' : 'FAILED', JSON.stringify(fx.size), JSON.stringify(fx.position));

  if (diffs.length === 0 && countsEqual && fxOk) {
    console.log('\nROUND-TRIP MATCH: all rooms/walls/objects/dimensions/positions identical.');
    return 0;
  }
  console.log('\nROUND-TRIP MISMATCH');
  for (const d of diffs) console.log('  ' + d);
  if (!countsEqual) console.log('  summary counts differ');
  if (!fxOk) console.log('  objectToFixture mapping wrong');
  return 1;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--selftest' || args[0] === '--self-test') {
    process.exit(selfTest());
  } else {
    const { parseOrdxFile } = require('./parseOrdx');
    const inPath = args[0];
    const outPath = args[1] ||
      path.join(__dirname, '..', 'analysis', 'out',
        path.basename(inPath).replace(/\.ordx$/i, '') + '_reexport.ordx');
    const model = parseOrdxFile(inPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, exportORDX(model), 'utf8');
    console.log('exported', inPath, '->', outPath);
  }
}
