'use strict';
// Parametric fixture placement: ORDX -> PDP MEP-record coordinates.
//
// Solved & validated against the 2918 golden file (18/25 fixtures matched to the
// millimetre; the rest are floating ceiling lights that use absolute room coords).
//
// Placement law for a WALL-MOUNTED fixture (socket, junction box, gas, faucet,
// sewage, window, door):
//   * ORDX <Position><X> is the fixture's LEFT EDGE distance ALONG the wall from
//     the wall start vertex; <Y> is the mount height (Z) and is ignored in plan.
//   * The plan point is the fixture CENTRE on the wall centreline:
//         s        = X + Width/2
//         (px,py)  = wallStart + s * unitAlongWall
//   * Transform to PDP (same offX/offY as the wall converter):
//         PDP_x = px + offX ;  PDP_y = -py + offY      (Y axis negated)
//   * Orientation code (MEP +0x0a) = round(10 * wallAngleDeg) in the PDP frame,
//     i.e. angle of the wall direction AFTER the Y flip, normalised to [0,3600).
//
// The MEP record's plan X,Y live at rel +0x00/+0x02 (int16), orientation at
// +0x0a (int16), type/catalog code at +0x0e (int16, 18 = socket family).

// Fixture classes that are wall-mounted (placed along a wall). Everything else
// (e.g. ceiling "Can Light") is treated as floating and uses absolute room X/Y.
const FLOATING_NAMES = new Set(['Can Light', 'Ceiling Light', 'Spot']);

function isFloating(item) {
  return FLOATING_NAMES.has(item.name) ||
    (item.type && /light/i.test(item.type) && item.class === 'Decorative' && false);
}

// Compute PDP orientation code from a wall's ORDX direction.
function orientationCode(dx, dy) {
  let a = Math.atan2(-dy, dx) * 180 / Math.PI; // -dy: PDP Y is flipped
  if (a < 0) a += 360;
  let code = Math.round(a * 10);
  if (code >= 3600) code -= 3600;
  return code;
}

// Place one wall-mounted item. Returns {x,y,orientation} in PDP int16 mm, or
// null if the wall geometry is degenerate.
function placeOnWall(wall, item, offX, offY) {
  const p = wall.position;
  if (!p) return null;
  const dx = p.endX - p.startX, dy = p.endY - p.startY;
  const L = Math.hypot(dx, dy);
  if (!L) return null;
  const ux = dx / L, uy = dy / L;
  const width = (item.size && item.size.width) || 0;
  // Anchor convention differs by class (validated on 2918):
  //   * Fixture   -> ORDX X is the LEFT EDGE  => centre = X + Width/2
  //   * Decorative (windows/doors) -> ORDX X is already the CENTRE => no offset
  const halfW = item.class === 'Decorative' ? 0 : width / 2;
  const s = (item.position ? item.position.x : 0) + halfW;
  const px = p.startX + s * ux, py = p.startY + s * uy;
  return {
    x: Math.round(px + offX),
    y: Math.round(-py + offY),
    orientation: orientationCode(dx, dy),
  };
}

// Place a floating item using its absolute room X/Y (no wall projection).
function placeFloating(item, offX, offY) {
  if (!item.position) return null;
  return {
    x: Math.round(item.position.x + offX),
    y: Math.round(-item.position.y + offY),
    orientation: 0,
  };
}

// Walk an ORDX model and return a flat list of placement records, one per
// fixture/furnishing, preserving document order (the order PDP stores them in).
function placeAll(model, offX, offY) {
  const out = [];
  for (const room of model.rooms) {
    for (const wall of room.walls) {
      for (const item of [...(wall.fixtures || []), ...(wall.furnishings || [])]) {
        const floating = isFloating(item);
        const pos = floating ? placeFloating(item, offX, offY) : placeOnWall(wall, item, offX, offY);
        if (!pos) continue;
        out.push({
          name: item.name,
          catalog: item.catalog,
          class: item.class,
          type: item.type,
          wall: wall.number,
          width: (item.size && item.size.width) || null,
          depth: (item.size && item.size.depth) || null,
          height: (item.size && item.size.height) || null,
          floating,
          ...pos,
        });
      }
    }
  }
  return out;
}

module.exports = { placeAll, placeOnWall, placeFloating, orientationCode, isFloating };
