'use strict';
// ORDX -> PDP writer (template-patch strategy).
//
// Strategy notes (reverse-engineered from matched pair twister-n6+7):
//   * PDP parametric data = int16 LE, millimetres.
//   * Coordinate transform: PDP_x = ORDX_x + offX ; PDP_y = -ORDX_y + offY
//     (Y axis negated). offX/offY are an arbitrary per-file translation.
//   * Wall table: count @WALL_COUNT_OFF, then records of 14 bytes each:
//     [x1,y1,x2,y2,thick,height,pad] at WALL_TABLE_OFF + i*14.
//   * Item records: fixed 173 bytes each at ITEM_TABLE_OFF + i*173;
//     size triple (W,depth,H) int16 at rel offsets 127/129/131.
//
// To keep the byte layout identical to the template (so the file still parses
// and the software regenerates the 3D mesh from the parametric data on load),
// we DO NOT add/remove records. Instead we overwrite the template's wall slots
// with the new walls, collapse any leftover wall slots to zero length, and zero
// every item's size so measurement items vanish.

const TEMPLATE_OFFX = -25692;
const TEMPLATE_OFFY = -14973;

const WALL_COUNT_OFF = 0xd2;
const WALL_TABLE_OFF = 0xd4;
const WALL_REC = 14;
const ITEM_TABLE_OFF = 0x120;
const ITEM_REC = 173;
const ITEM_SIZE_REL = 127; // W@+127, depth@+129, H@+131
const NAME_OFF = 0x15;      // primary job-name field (ASCII)
const NAME_MAX = 12;

function i16(mm) {
  let v = Math.round(mm);
  if (v > 32767) v = 32767;
  if (v < -32768) v = -32768;
  return v;
}

// Read template slot counts so we never write past what exists.
function readCount(buf, off) { return buf.readInt16LE(off); }

function collectWalls(model) {
  const walls = [];
  for (const room of model.rooms) {
    for (const w of room.walls) {
      const p = w.position, d = w.dimensions || {};
      if (!p) continue;
      walls.push({
        x1: p.startX, y1: p.startY, x2: p.endX, y2: p.endY,
        thick: d.thick != null ? d.thick : 100,
        height: d.height != null ? d.height : 2771,
      });
    }
  }
  return walls;
}

// Build a PDP buffer for `model`, patching a copy of `templateBuf`.
// opts: { offX, offY }
function writePdpFromTemplate(templateBuf, model, opts = {}) {
  const buf = Buffer.from(templateBuf); // copy
  const offX = opts.offX != null ? opts.offX : TEMPLATE_OFFX;
  const offY = opts.offY != null ? opts.offY : TEMPLATE_OFFY;

  const tx = (x) => i16(x + offX);
  const ty = (y) => i16(-y + offY);

  const walls = collectWalls(model);
  const wallSlots = readCount(buf, WALL_COUNT_OFF);
  const notes = [];

  if (walls.length > wallSlots) {
    notes.push(`WARNING: ORDX has ${walls.length} walls but template has ${wallSlots} slots; extra walls dropped.`);
  }

  // last vertex, used to collapse leftover wall slots to zero length
  let lastX = 0, lastY = 0;
  for (let i = 0; i < wallSlots; i++) {
    const base = WALL_TABLE_OFF + i * WALL_REC;
    if (i < walls.length) {
      const w = walls[i];
      buf.writeInt16LE(tx(w.x1), base + 0);
      buf.writeInt16LE(ty(w.y1), base + 2);
      buf.writeInt16LE(tx(w.x2), base + 4);
      buf.writeInt16LE(ty(w.y2), base + 6);
      buf.writeInt16LE(i16(w.thick), base + 8);
      buf.writeInt16LE(i16(w.height), base + 10);
      lastX = tx(w.x2); lastY = ty(w.y2);
    } else {
      // degenerate zero-length wall at the last real vertex (invisible)
      buf.writeInt16LE(lastX, base + 0);
      buf.writeInt16LE(lastY, base + 2);
      buf.writeInt16LE(lastX, base + 4);
      buf.writeInt16LE(lastY, base + 6);
      // keep thick/height from template; zero length hides it
    }
  }

  // Optionally set the item-count field to 0 so the loader instantiates no
  // measurement items (layout preserved — records left physically in place).
  const ITEM_COUNT_OFF = 0x10c;
  const templateItemCount = readCount(buf, ITEM_COUNT_OFF);
  if (opts.zeroItemCount) {
    buf.writeInt16LE(0, ITEM_COUNT_OFF);
    notes.push(`item count set 0 (was ${templateItemCount})`);
  }

  // Zero every item's size so measurement fixtures/furnishings vanish,
  // while keeping the 173-byte records in place (layout preserved).
  const itemSlots = templateItemCount;
  let zeroed = 0;
  for (let i = 0; i < itemSlots; i++) {
    const base = ITEM_TABLE_OFF + i * ITEM_REC;
    if (base + ITEM_SIZE_REL + 5 > buf.length) break;
    buf.writeInt16LE(0, base + ITEM_SIZE_REL + 0);
    buf.writeInt16LE(0, base + ITEM_SIZE_REL + 2);
    buf.writeInt16LE(0, base + ITEM_SIZE_REL + 4);
    zeroed++;
  }

  // Patch the primary job-name field in place (fixed width, null padded).
  const name = (model.job && model.job.name) || '';
  const nameBytes = Buffer.from(name, 'latin1').subarray(0, NAME_MAX);
  for (let i = 0; i < NAME_MAX; i++) {
    buf[NAME_OFF + i] = i < nameBytes.length ? nameBytes[i] : 0;
  }

  notes.push(`walls written: ${Math.min(walls.length, wallSlots)} (+${Math.max(0, wallSlots - walls.length)} collapsed)`);
  notes.push(`item sizes zeroed: ${zeroed}`);
  notes.push(`transform: PDP_x = ORDX_x ${offX>=0?'+':''}${offX} ; PDP_y = -ORDX_y ${offY>=0?'+':''}${offY}`);

  // The PDP stream is SEQUENTIAL: the loader reads `itemCount` then expects
  // exactly that many 173-byte records to follow. To end up with fewer items
  // than the template we must physically excise the surplus records and shift
  // the tail up, then set the count to match (Raumplan error 921 otherwise).
  const targetItems = countOrdxItems(model);
  let outBuf = buf;
  if (targetItems < templateItemCount) {
    const keep = Math.max(0, targetItems);
    const cutFrom = ITEM_TABLE_OFF + keep * ITEM_REC;
    const cutTo = ITEM_TABLE_OFF + templateItemCount * ITEM_REC;
    outBuf = Buffer.concat([buf.subarray(0, cutFrom), buf.subarray(cutTo)]);
    outBuf.writeInt16LE(keep, ITEM_COUNT_OFF);
    notes.push(`items removed: ${templateItemCount - keep} records (${cutTo - cutFrom} bytes); itemCount=${keep}; new size ${outBuf.length}`);
  }

  return { buf: outBuf, notes };
}

function countOrdxItems(model) {
  let n = 0;
  for (const r of model.rooms)
    for (const w of r.walls)
      n += (w.fixtures ? w.fixtures.length : 0) + (w.furnishings ? w.furnishings.length : 0);
  return n;
}

module.exports = { writePdpFromTemplate, TEMPLATE_OFFX, TEMPLATE_OFFY };
