'use strict';
// General ORDX -> PDP conversion via an empty-room template.
//
// Proven-reliable strategy: take a template PDP that already has the right
// STRUCTURE (an empty room = 0 items) and overwrite only wall VALUES. Because
// no object counts change, Raumplan loads the file (error 921 only appears when
// counts change) and regenerates the 3D mesh from the parametric walls.
//
// Supports templates whose wall count >= the ORDX wall count (extra template
// walls are collapsed to zero length and stay invisible).

const { detectWallGroups, pickGroup, writeWall, collapseWall } = require('./walls');

const DEFAULT_OFFX = -25692;
const DEFAULT_OFFY = -14973; // note: PDP_y = -ORDX_y + OFFY (Y axis negated)

function collectWalls(model) {
  const out = [];
  for (const room of model.rooms)
    for (const w of room.walls) {
      const p = w.position, d = w.dimensions || {};
      if (!p) continue;
      out.push({
        x1: p.startX, y1: p.startY, x2: p.endX, y2: p.endY,
        thick: d.thick != null ? d.thick : 100,
        height: d.height != null ? d.height : 2700,
      });
    }
  return out;
}

function countItems(model) {
  let n = 0;
  for (const room of model.rooms)
    for (const w of room.walls)
      n += (w.fixtures ? w.fixtures.length : 0) + (w.furnishings ? w.furnishings.length : 0);
  return n;
}

function convert(templateBuf, model, opts = {}) {
  const buf = Buffer.from(templateBuf);
  const offX = opts.offX != null ? opts.offX : DEFAULT_OFFX;
  const offY = opts.offY != null ? opts.offY : DEFAULT_OFFY;
  const clamp = (v, lim) => Math.max(-lim, Math.min(lim, Math.round(v)));

  const walls0 = collectWalls(model);
  const groups = detectWallGroups(buf);
  const info = pickGroup(groups, walls0.length);
  if (!info) throw new Error('Could not locate a wall table in the template PDP.');

  const lim = info.format === 'int32' ? 0x7fffffff : 32767;
  const tx = (x) => clamp(x + offX, lim);
  const ty = (y) => clamp(-y + offY, lim);

  const walls = walls0;
  const items = countItems(model);
  const notes = [];
  const warnings = [];

  notes.push(`template wall table: ${info.format}, ${info.count} slots @0x${info.offset.toString(16)} (stride ${info.stride})`);

  if (walls.length > info.count) {
    warnings.push(`ORDX has ${walls.length} walls but template has only ${info.count} slots. ` +
      `Save an empty template with at least ${walls.length} walls. Extra walls were dropped.`);
  }
  if (items > 0) {
    warnings.push(`ORDX has ${items} fixture/furnishing item(s). Adding items is not yet supported ` +
      `(changing object counts triggers Raumplan error 921). Only the room shell (walls) was written.`);
  }

  const nWrite = Math.min(walls.length, info.count);
  let lastX = 0, lastY = 0;
  for (let i = 0; i < info.count; i++) {
    if (i < nWrite) {
      const w = walls[i];
      writeWall(buf, info, i, w, tx, ty);
      lastX = tx(w.x2); lastY = ty(w.y2);
    } else {
      collapseWall(buf, info, i, lastX, lastY); // hide surplus template walls
    }
  }

  notes.push(`walls written: ${nWrite}${info.count > nWrite ? ` (+${info.count - nWrite} collapsed)` : ''}`);
  notes.push(`transform: PDP_x = ORDX_x ${offX>=0?'+':''}${offX} ; PDP_y = -ORDX_y ${offY>=0?'+':''}${offY}`);

  return { buf, notes, warnings, info, wallsWritten: nWrite, items };
}

module.exports = { convert, DEFAULT_OFFX, DEFAULT_OFFY };
