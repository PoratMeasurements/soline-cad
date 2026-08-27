'use strict';
// Full ORDX -> PDP assembler (in progress).
// Pipeline: parse ORDX -> place each item parametrically (position/orientation/
// height/size) -> inject its 7 blocks into a base PDP -> fix counts.
//
// STATUS of the building blocks:
//   * placement (X/Y/orientation/height/size)  -> SOLVED & verified (placement.js)
//   * icon scaling to ORDX size                -> DONE (symbol.js, in injector)
//   * single + multi item injection            -> DONE, structurally verified
//   * per-item-TYPE 7-block templates          -> only SOCKET so far (donor=DR1)
//   * injection into an empty/walls-only base  -> NOT yet (offsets assume an
//     existing item layout); today we inject into a populated base.
//
// So this assembler currently handles SOCKET-class items. Other types plug in
// once their donor template + type code + segment count are catalogued.

const fs = require('fs');
const path = require('path');
const { parseOrdxFile } = require('./parseOrdx');
const { placeOnWall, orientationCode } = require('./placement');
const { injectItems } = require('./inject');

// Optional Soline symbol library (designed per-element). Keyed by ORDX/en name.
function loadSymbols() {
  const p = path.join(__dirname, '..', 'symbols.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// Which ORDX items this assembler can place today.
const SOCKET_NAMES = new Set(['Socket', 'Duplex Socket']);
const SOCKET_SEGMENTS = 14; // socket 2D symbol segment count (drives RUN2 bump)

// Build a full placement record (all MEP-driving fields) for one wall item.
function placeItem(wall, item, offX, offY) {
  const base = placeOnWall(wall, item, offX, offY); // {x,y,orientation} or null
  if (!base) return null;
  const sz = item.size || {};
  return {
    name: item.name,
    ...base,
    height: item.position ? item.position.y : null, // ORDX Y = mount height
    width: sz.width != null ? sz.width : null,
    depth: sz.depth != null ? sz.depth : null,
    dimHeight: sz.height != null ? sz.height : null,
  };
}

// Collect placements for the item classes we can currently assemble.
function collectPlacements(model, offX, offY, accept = (it) => SOCKET_NAMES.has(it.name)) {
  const out = [];
  for (const room of model.rooms)
    for (const wall of room.walls)
      for (const item of [...(wall.fixtures || []), ...(wall.furnishings || [])])
        if (accept(item)) { const p = placeItem(wall, item, offX, offY); if (p) out.push(p); }
  return out;
}

// Assemble: inject all accepted items from `ordxPath` into `base` using `donor`.
function assemble({ ordxPath, model, base, donor, offX, offY }) {
  const m = model || parseOrdxFile(ordxPath);
  const places = collectPlacements(m, offX, offY);
  // Icon policy: DEDICATED SYMBOL PER TYPE (designed by the symbol agent). BUT a
  // custom symbol changes block#1's byte length, and that length is referenced
  // elsewhere -> error 921. So generated symbols are DISABLED until those length
  // refs are cracked; we inject the donor symbol (fixed 168B) which LOADS. This
  // keeps the pipeline valid; the icon fix lands once symbol-array refs are solved.
  const items = places.map((p) => ({ place: p, symbol: null }));
  const { buf } = injectItems(base, donor, items);
  return {
    buf,
    placed: places.length,
    report: places.map((p) => `${p.name} @(${p.x},${p.y}) h=${p.height} size=${p.width}/${p.depth}/${p.dimHeight} orient=${p.orientation}`),
  };
}

module.exports = { assemble, collectPlacements, placeItem, SOCKET_NAMES };
