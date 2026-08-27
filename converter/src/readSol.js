'use strict';
/*
 * readSol.js — a minimal, dependency-free reader for Soline's `.sol` container.
 * =============================================================================
 * `.sol` is Soline's source-of-truth: a ZIP holding one carpentry job's lifecycle
 * (see soline-measure-android SolWriter.kt for the writer, and SOL_FORMAT.md).
 * Layout we consume here (v1a plaintext):
 *   manifest.json                 entry point (format "sol", magic "SOL1")
 *   meta.json                     project identity + client
 *   measured/room-<id>.json       as-built: room -> walls -> accessories (all mm)
 *   measured/source.ordx          (OPTIONAL) the flat ORDX the app measured from
 *
 * Two consumption paths (the converter uses whichever is available):
 *   1) EMBEDDED ORDX  — if `measured/source.ordx` is present, hand it back so the
 *      pipeline runs the proven ORDX parser (full fidelity). PREFERRED.
 *   2) NATIVE ROOMS   — otherwise synthesize the converter's parseOrdx-shaped
 *      model directly from `measured/room-*.json`. BEST-EFFORT geometry: walls are
 *      stored as length+angleToNext (no absolute coords), so we lay them out with a
 *      turtle (start (0,0), heading +X, turn by angleToNext at each corner).
 *
 * No external ZIP dependency: we parse the ZIP End-Of-Central-Directory + central
 * directory ourselves and inflate each entry with Node's built-in zlib.
 */

const fs = require('fs');
const zlib = require('zlib');

// ---------------------------------------------------------------------------
// Minimal ZIP reader (store + deflate). Returns { name -> Buffer } of entries.
// Parses via the central directory so it is robust to data-descriptor writers
// (ZipOutputStream leaves size/crc as 0 in the local header — the CD has them).
// ---------------------------------------------------------------------------
function unzip(buf) {
  const EOCD_SIG = 0x06054b50;
  const CD_SIG = 0x02014b50;
  // Find End Of Central Directory (scan backwards; comment is usually empty).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a ZIP/.sol file (no End-Of-Central-Directory)');
  const cdCount = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // central directory offset

  const entries = {};
  for (let n = 0; n < cdCount; n++) {
    if (buf.readUInt32LE(p) !== CD_SIG) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    // Jump to the local header to find the real data start (its extra field can
    // differ in length from the central-directory copy).
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    let content;
    if (method === 0) content = Buffer.from(raw);              // stored
    else if (method === 8) content = zlib.inflateRawSync(raw); // deflate
    else throw new Error(`unsupported ZIP compression method ${method} for ${name}`);
    entries[name] = content;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ---------------------------------------------------------------------------
// .sol accessory type (AccType enum name, from the measure app) -> converter
// catalog. `key` is an English name resolve()/placement understand; `cls` is the
// ORDX Class that drives the X anchor (Fixture=left-edge, Decorative=centre).
// ---------------------------------------------------------------------------
const SOL_TYPE_MAP = {
  SOCKET_SINGLE:  { key: 'Socket',        cls: 'Fixture' },
  SOCKET_MULTI:   { key: 'Duplex Socket', cls: 'Fixture' },
  WATER_PIPE:     { key: 'Water Supply',  cls: 'Fixture' },
  GAS_PIPE:       { key: 'Gas',           cls: 'Fixture' },
  ELECTRICAL_LINE:{ key: 'Power Line',    cls: 'Fixture' },
  WINDOW:         { key: 'Window',        cls: 'Decorative' },
  DOOR:           { key: 'Doorway w/o Frame', cls: 'Decorative' },
  COLUMN:         { key: 'Beam',          cls: 'Fixture' },
  CEILING_DROP:   { key: 'Beam',          cls: 'Fixture' },
};

const D2R = Math.PI / 180;

// ---------------------------------------------------------------------------
// PLANNING (cabinets) SCHEMA — the source-of-truth the carpentry app writes.
// =============================================================================
// The app writes the kitchen/closet PLANNING (the cabinet run) into the `.sol`
// so it can be carried into every export (ORDX / DXF-2D / DXF-3D / PDF). We read
// it from EITHER of two places (both optional; a walls-only `.sol` has neither):
//
//   1) PER-ROOM   — a `cabinets: [ … ]` array inside `measured/room-<id>.json`
//                   (alongside `walls`). Each cabinet's room is implicit.
//   2) TOP-LEVEL  — a `planning/cabinets.json` (also accepts `planning.json`
//                   or `cabinets.json`) holding either a bare `[ … ]` array or
//                   `{ cabinets:[ … ], materials:{ … } }`. Each cabinet then
//                   carries a `roomId` that matches a room's `id`.
//
// CABINET record (all lengths in MILLIMETRES; the app writer MUST match this):
//   {
//     roomId,       // int  — matches room-<id>.json "id" (top-level form only)
//     wallId,       // int  — the wall this cabinet stands against; matches the
//                   //        wall's 0-based index in the room (== wall.idx ==
//                   //        model wall.number). Omit/-1 for a free-standing run.
//     kind,         // "base" (floor unit) | "wall" (upper) | "tall" (pantry/full)
//     name,         // display name (Hebrew ok), e.g. "ארון תחתון 60"
//     fromLeft,     // mm ALONG the wall, from the wall start vertex, to the
//                   //    cabinet's LEFT edge (same convention as accessories).
//     width,        // mm along the wall (the cabinet's run length)
//     depth,        // mm perpendicular, protruding INTO the room from the wall
//     heightFrom,   // mm — bottom of the carcass above finished floor (base = 0)
//     heightTo,     // mm — top of the carcass above finished floor
//     doorType,     // "hinged" | "drawers" | "sliding" | "none" (label only)
//     material      // OPTIONAL string/key — a surface material (see `materials`)
//   }
//
// Optional `materials` (per-surface finishes, passed through untouched to the
// model as `model.materials`): e.g. { carcass, front, countertop, handle }.
// ---------------------------------------------------------------------------
const CABINET_KINDS = new Set(['base', 'wall', 'tall']);

// Normalize ONE raw cabinet into the strict numeric schema the exporters read.
// Missing fields fall back to sane base-cabinet defaults so a partial record
// never crashes an exporter; `name` is defaulted deterministically so the ORDX
// round-trip summary (see readSol) and the ORDX emitter agree on the same name.
function normalizeCabinet(c) {
  if (!c || typeof c !== 'object') return null;
  const kind = CABINET_KINDS.has(String(c.kind)) ? String(c.kind) : 'base';
  const depthDflt = kind === 'wall' ? 320 : 580;
  const heightToDflt = kind === 'wall' ? 2150 : kind === 'tall' ? 2100 : 900;
  return {
    roomId:     c.roomId != null ? num(c.roomId, null) : null,
    wallId:     c.wallId != null ? num(c.wallId, null) : null,
    kind,
    name:       (c.name != null && String(c.name).trim() !== '') ? String(c.name) : 'ארון',
    fromLeft:   num(c.fromLeft, 0),
    width:      num(c.width, 600),
    depth:      num(c.depth, depthDflt),
    heightFrom: num(c.heightFrom, kind === 'wall' ? 1450 : 0),
    heightTo:   num(c.heightTo, heightToDflt),
    doorType:   c.doorType != null ? String(c.doorType) : null,
    material:   c.material != null ? String(c.material) : null,
  };
}

// Build ONE parseOrdx-shaped room from a measured/room-<id>.json object.
// Walls are placed with a turtle from length + angleToNext (best-effort geometry).
function roomFromJson(rj) {
  let x = 0, y = 0, heading = 0; // heading in radians, start along +X
  const walls = (rj.walls || []).map((w) => {
    const L = num(w.length_mm);
    const sx = x, sy = y;
    const ex = sx + L * Math.cos(heading), ey = sy + L * Math.sin(heading);
    const angDeg = heading / D2R;
    x = ex; y = ey;
    heading += num(w.angleToNext_deg, 90) * D2R; // turn toward the next wall

    const items = (w.accessories || []).map((a) => {
      const m = SOL_TYPE_MAP[a.type] || null;
      const cls = m ? m.cls : 'Fixture';
      const key = m ? m.key : (a.name || a.type || 'Accessory');
      return {
        kind: 'fixture',
        catalog: 'Soline',
        // Use the English catalog key so resolve()/placement/PDP recognize it;
        // keep the Hebrew display name available for exporters that want it.
        name: key,
        heName: a.name || null,
        description: a.name || '',
        class: cls,
        type: m && m.cls === 'Decorative' ? (a.type === 'DOOR' ? 'Door' : 'Window') : 'Miscellaneous',
        size: { width: num(a.width_mm), height: num(a.height_mm), depth: num(a.depth_mm) },
        position: { x: num(a.fromLeft_mm), y: num(a.fromBottom_mm) },
      };
    });

    return {
      number: num(w.idx),
      description: null,
      position: { startX: sx, startY: sy, angle: angDeg, endX: ex, endY: ey },
      style: null,
      dimensions: { length: L, height: num(w.height_mm, 2500), soffit: null, thick: 100, vaultHeight: null },
      fixtures: items,
      furnishings: [],
    };
  });
  const room = { id: rj.id != null ? rj.id : null, name: rj.name || '', description: '', type: null, walls };
  // PER-ROOM planning: a `cabinets` array embedded in the room JSON. Left
  // undefined when absent so a walls-only room is untouched.
  if (Array.isArray(rj.cabinets) && rj.cabinets.length) {
    room.cabinets = rj.cabinets.map(normalizeCabinet).filter(Boolean);
  }
  return room;
}

function num(v, dflt = 0) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : dflt;
}

// ---------------------------------------------------------------------------
// שכבת-תמונות (photos) — קורא את annotations.json → photos[] וממפה כל רשומה
// לבייטי-ה-JPEG החיים כ-ZIP-entry תחת photos/. מקור-האמת של המטא הוא
// annotations.json (חוזה §2.3): { file, name, scope, wallIdx(0-based|null),
// wallLabel, seq, elementId, caption, kind, takenAt, w, h, bytes }.
//   • wallIdx נשמר 0-based ב-JSON (עקבי עם measured/); שם-הקובץ 1-based.
//   • תאימות-לאחור מלאה: אם השכבה נעדרת/ריקה → מחזיר [] ואין שגיאה.
// מחזיר מערך של { ...meta, buffer } כאשר buffer הוא Buffer של ה-JPEG (או null
// אם ה-entry חסר — נרשמת אזהרה אך לא נופלים).
// ---------------------------------------------------------------------------
function readPhotos(entries, manifest, warnings) {
  // רמז מה-manifest (לא-מחייב): layers.photos.present. גם אם false/נעדר —
  // עדיין נבדוק את annotations.json כדי לא לפספס נתונים.
  let ann = null;
  try { if (entries['annotations.json']) ann = JSON.parse(entries['annotations.json'].toString('utf8')); }
  catch (e) { warnings.push('annotations.json parse failed: ' + e.message); }
  const list = ann && Array.isArray(ann.photos) ? ann.photos : [];
  if (!list.length) return [];

  // מיפוי case-insensitive של שמות-entries כדי לעמוד בהבדלי-קידוד/רישיות
  // אפשריים בין annotations.json לבין שמות-ה-ZIP-entry.
  const byLower = {};
  for (const k of Object.keys(entries)) byLower[k.toLowerCase()] = k;

  const photos = [];
  for (const p of list) {
    if (!p || typeof p !== 'object') continue;
    const file = p.file != null ? String(p.file) : '';
    let buffer = null;
    if (file) {
      const key = entries[file] ? file : byLower[file.toLowerCase()];
      if (key && entries[key]) buffer = entries[key];
    }
    if (!buffer) warnings.push(`photos: entry "${file}" missing in ZIP — thumbnail will be skipped`);
    const wallIdxRaw = p.wallIdx;
    const wallIdx = (wallIdxRaw == null) ? null : num(wallIdxRaw, null);
    photos.push({
      file,
      name: p.name != null ? String(p.name) : (file ? file.replace(/^.*\//, '').replace(/\.[^.]*$/, '') : ''),
      scope: p.scope != null ? String(p.scope) : (wallIdx == null ? 'room' : 'wall'),
      phase: p.phase != null ? String(p.phase) : null, // opening|closing (רק ל-scope=project)
      roomId: p.roomId != null ? p.roomId : null,      // אופציונלי — לקיבוץ פר-חדר
      wallIdx,
      wallLabel: p.wallLabel != null ? String(p.wallLabel) : (wallIdx == null ? 'חדר' : ('חזית ' + (wallIdx + 1))),
      seq: p.seq != null ? num(p.seq, null) : null,
      elementId: p.elementId != null ? p.elementId : null,
      caption: p.caption != null ? String(p.caption) : '',
      kind: p.kind != null ? String(p.kind) : 'context',
      takenAt: p.takenAt != null ? String(p.takenAt) : null,
      w: p.w != null ? num(p.w, null) : null,
      h: p.h != null ? num(p.h, null) : null,
      bytes: p.bytes != null ? num(p.bytes, (buffer ? buffer.length : null)) : (buffer ? buffer.length : null),
      buffer, // Buffer של ה-JPEG (או null אם חסר)
    });
  }
  return photos;
}

// ---------------------------------------------------------------------------
// שכבת-וידאו (videos) — קורא annotations.json → videos[] (חוזה §5.2) וממפה כל
// רשומה לבייטי-ה-MP4 החיים כ-ZIP-entry תחת videos/. שדות: { file, name, scope,
// phase, wallIdx, kind, seq, elementId, caption, takenAt, durationSec, bytes }.
// תאימות-לאחור מלאה: שכבה נעדרת/ריקה → [] ללא-שגיאה. מחזיר { ...meta, buffer }.
// ---------------------------------------------------------------------------
function readVideos(entries, manifest, warnings) {
  let ann = null;
  try { if (entries['annotations.json']) ann = JSON.parse(entries['annotations.json'].toString('utf8')); }
  catch (e) { /* כבר-נרשם ב-readPhotos; לא כופלים אזהרה */ }
  const list = ann && Array.isArray(ann.videos) ? ann.videos : [];
  if (!list.length) return [];

  const byLower = {};
  for (const k of Object.keys(entries)) byLower[k.toLowerCase()] = k;

  const videos = [];
  for (const v of list) {
    if (!v || typeof v !== 'object') continue;
    const file = v.file != null ? String(v.file) : '';
    let buffer = null;
    if (file) {
      const key = entries[file] ? file : byLower[file.toLowerCase()];
      if (key && entries[key]) buffer = entries[key];
    }
    if (!buffer) warnings.push(`videos: entry "${file}" missing in ZIP — video will be listed without playback`);
    const wallIdxRaw = v.wallIdx;
    const wallIdx = (wallIdxRaw == null) ? null : num(wallIdxRaw, null);
    videos.push({
      file,
      name: v.name != null ? String(v.name) : (file ? file.replace(/^.*\//, '').replace(/\.[^.]*$/, '') : ''),
      scope: v.scope != null ? String(v.scope) : (wallIdx == null ? 'room' : 'wall'),
      phase: v.phase != null ? String(v.phase) : null,
      roomId: v.roomId != null ? v.roomId : null,
      wallIdx,
      wallLabel: v.wallLabel != null ? String(v.wallLabel) : (wallIdx == null ? 'חדר' : ('חזית ' + (wallIdx + 1))),
      seq: v.seq != null ? num(v.seq, null) : null,
      elementId: v.elementId != null ? v.elementId : null,
      caption: v.caption != null ? String(v.caption) : '',
      kind: v.kind != null ? String(v.kind) : 'explainer',
      takenAt: v.takenAt != null ? String(v.takenAt) : null,
      durationSec: v.durationSec != null ? num(v.durationSec, null) : null,
      bytes: v.bytes != null ? num(v.bytes, (buffer ? buffer.length : null)) : (buffer ? buffer.length : null),
      buffer, // Buffer של ה-MP4 (או null אם חסר)
    });
  }
  return videos;
}

// ---------------------------------------------------------------------------
// רשימות-משימות-המדיה (checklist / projectChecklist) — נקראות כמו-שהן
// מ-annotations.json (חוזה §5.1). מבנה checklist:
//   { "<roomId>": { complete, categories: { <cat>: { satisfiedCount,
//     requiredCount, required, done, skippedReason } } } }
// projectChecklist: { complete, allRoomsComplete, access:{ access_opening:
//   {phase,count,done}, access_closing:{phase,count,done} } }
// תאימות-לאחור מלאה: נעדר → null. אין עיבוד — הדוח מציג את-המבנה כפי-שהוא.
// ---------------------------------------------------------------------------
function readChecklists(entries, warnings) {
  let ann = null;
  try { if (entries['annotations.json']) ann = JSON.parse(entries['annotations.json'].toString('utf8')); }
  catch (e) { /* כבר-נרשם ב-readPhotos */ }
  const checklist = ann && ann.checklist && typeof ann.checklist === 'object' ? ann.checklist : null;
  const projectChecklist = ann && ann.projectChecklist && typeof ann.projectChecklist === 'object' ? ann.projectChecklist : null;
  return { checklist, projectChecklist };
}

// ---------------------------------------------------------------------------
// Public: read a .sol file. Returns:
//   { entries, embeddedOrdx: Buffer|null, model: <parseOrdx-shaped>|null, warnings[] }
// The caller prefers embeddedOrdx (full-fidelity ORDX pipeline) and falls back
// to `model` (native room JSON). We always compute `model` when rooms exist, so
// the caller can pass it straight to the exporters/PDP assembler.
// ---------------------------------------------------------------------------
function readSol(solPath) {
  const buf = fs.readFileSync(solPath);
  const entries = unzip(buf);
  const warnings = [];

  let manifest = null;
  try { if (entries['manifest.json']) manifest = JSON.parse(entries['manifest.json'].toString('utf8')); }
  catch (e) { warnings.push('manifest.json parse failed: ' + e.message); }
  if (manifest && manifest.magic && manifest.magic !== 'SOL1') {
    warnings.push('unexpected .sol magic: ' + manifest.magic);
  }

  let meta = null;
  try { if (entries['meta.json']) meta = JSON.parse(entries['meta.json'].toString('utf8')); }
  catch (e) { warnings.push('meta.json parse failed: ' + e.message); }

  // Embedded ORDX (preferred bridge path).
  const embeddedOrdx = entries['measured/source.ordx'] || null;

  // Native room layer -> model (best-effort geometry).
  const roomNames = Object.keys(entries).filter((k) => /^measured\/room-.*\.json$/i.test(k)).sort();
  let model = null;
  if (roomNames.length) {
    const rooms = [];
    for (const rn of roomNames) {
      try { rooms.push(roomFromJson(JSON.parse(entries[rn].toString('utf8')))); }
      catch (e) { warnings.push(rn + ' parse failed: ' + e.message); }
    }
    if (rooms.length) {
      model = {
        format: 'SOL',
        created: (manifest && manifest.createdAt) || null,
        productVersion: (manifest && manifest.producer) || null,
        unit: (manifest && manifest.units) || 'mm',
        job: { name: (meta && meta.name) || (manifest && manifest.name) || '', description: '' },
        customer: meta && meta.client ? { name: meta.client } : null,
        shipTo: null,
        rooms,
      };

      // TOP-LEVEL planning: planning/cabinets.json | planning.json | cabinets.json.
      // Distribute cabinets to rooms by roomId (or to the only room when single),
      // and surface optional per-surface materials on the model.
      const planKey = ['planning/cabinets.json', 'planning.json', 'cabinets.json']
        .find((k) => entries[k]);
      if (planKey) {
        try {
          const raw = JSON.parse(entries[planKey].toString('utf8'));
          const cabs = (Array.isArray(raw) ? raw : (raw.cabinets || [])).map(normalizeCabinet).filter(Boolean);
          for (const cab of cabs) {
            let room = null;
            if (cab.roomId != null) room = rooms.find((r) => r.id != null && r.id === cab.roomId);
            if (!room && rooms.length === 1) room = rooms[0];
            if (!room) { warnings.push(`planning: cabinet "${cab.name}" has roomId ${cab.roomId} with no matching room — skipped`); continue; }
            (room.cabinets || (room.cabinets = [])).push(cab);
          }
          const mats = (!Array.isArray(raw) && raw.materials) || null;
          if (mats) model.materials = mats;
        } catch (e) { warnings.push(planKey + ' parse failed: ' + e.message); }
      }
      // Materials may also ride on meta.json.
      if (!model.materials && meta && meta.materials) model.materials = meta.materials;

      const { summarize } = require('./parseOrdx');
      model.summary = summarize(model);

      // Cabinets are emitted by export_ordx as <Furnishing> items (Base/Standard),
      // appended to each wall's furnishings (wallId == wall.number, else the first
      // wall). Rebuild the summary here counting them in the EXACT same document
      // order the ORDX emits (wall-major, cabinets after that wall's furnishings),
      // so the converter's parse→export→parse check — which compares the whole
      // summary incl. itemCounts KEY ORDER — stays byte-identical (GREEN).
      const anyCab = rooms.some((r) => (r.cabinets || []).length);
      if (anyCab) {
        let furnishings = model.summary.furnishings;
        const itemCounts = {};
        const bump = (key) => { itemCounts[key] = (itemCounts[key] || 0) + 1; };
        for (const r of rooms) {
          const walls = r.walls || [];
          walls.forEach((w, wi) => {
            for (const it of w.fixtures || []) bump(`fixture:${it.name || it.description || '?'}`);
            for (const it of w.furnishings || []) bump(`furnishing:${it.name || it.description || '?'}`);
            for (const cab of r.cabinets || []) {
              let idx = walls.findIndex((x) => x.number === cab.wallId);
              if (idx < 0) idx = 0;
              if (idx === wi) { furnishings++; bump(`furnishing:${cab.name}`); }
            }
          });
        }
        model.summary.furnishings = furnishings;
        model.summary.itemCounts = itemCounts;
      }
    }
  }

  if (!embeddedOrdx && !model) warnings.push('no measured/source.ordx and no measured/room-*.json — nothing to convert');

  // שכבת-תמונות (additive; ריק אם נעדרת → תאימות-לאחור מלאה). מחשיפים גם
  // ברמת-העליון (photos) וגם על המודל הילידי (model.photos) כדי שהצרכן —
  // בין אם משתמש ב-model הילידי ובין אם ב-ORDX המוטמע — יוכל להגיע לתמונות.
  const photos = readPhotos(entries, manifest, warnings);
  const videos = readVideos(entries, manifest, warnings);
  const { checklist, projectChecklist } = readChecklists(entries, warnings);
  if (model) {
    model.photos = photos;
    model.videos = videos;
    model.checklist = checklist;
    model.projectChecklist = projectChecklist;
  }

  return { entries, manifest, meta, embeddedOrdx, model, photos, videos, checklist, projectChecklist, warnings };
}

module.exports = { readSol, unzip, readPhotos, readVideos, readChecklists, SOL_TYPE_MAP, normalizeCabinet };
