'use strict';
// Domain-model extractor for CV ORDX Order XML files.
// Turns the raw XML tree into a normalized JS object that downstream
// converters (ORDX -> PDP / DXF) can consume.

const fs = require('fs');
const { parseXml, child, childrenNamed, textAt, nodeAt } = require('./xml');

function num(s) {
  if (s === '' || s == null) return null;
  const v = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

function parseSize(generalNode) {
  // Two ORDX schemas observed:
  //   * Fixtures (sockets, junction boxes, gas): <Width>/<Depth>/<Height> are
  //     DIRECT children of <General> (the <Size> element is present but empty).
  //   * Decorative (windows/doors): dims nested under <General><Size>.
  // Read direct children first, then fall back to <Size>.
  const size = child(generalNode, 'Size');
  const pick = (tag) => {
    const direct = num(textAt(generalNode, tag));
    if (direct != null) return direct;
    return size ? num(textAt(size, tag)) : null;
  };
  const w = pick('Width'), h = pick('Height'), d = pick('Depth');
  if (w == null && h == null && d == null) return null;
  return { width: w, height: h, depth: d };
}

// A Fixture and a Furnishing share the same inner shape.
function parsePlacedItem(node, kind) {
  const gen = nodeAt(node, 'Properties/General');
  const pos = child(node, 'Position');
  return {
    kind,                                   // 'fixture' | 'furnishing'
    catalog: textAt(node, 'Catalog') || null,
    name: gen ? textAt(gen, 'Name') : '',
    description: gen ? textAt(gen, 'Description') : '',
    class: gen ? textAt(gen, 'Class') || null : null,
    type: gen ? textAt(gen, 'Type') || null : null,
    size: gen ? parseSize(gen) : null,
    position: pos
      // X = along-wall distance from the wall start corner (mm); Y = height up the wall (mm);
      // Z = PERPENDICULAR distance the item stands off the wall INTO the room (mm), present only
      // for fixtures that are set back from the wall face (power box/line, ceiling light, drains,
      // safety-room opening…). Absent (null) for flush wall points (sockets/switches/faucets) and
      // for in-plane openings (window/door). Consumed by writePdpDR.collectItems (perpendicular).
      ? { x: num(textAt(pos, 'X')), y: num(textAt(pos, 'Y')), z: num(textAt(pos, 'Z')) }
      : null,
  };
}

function parseWall(node) {
  const pos = child(node, 'Position');
  const dim = child(node, 'Dimensions');
  const fixturesNode = child(node, 'Fixtures');
  const furnishingsNode = child(node, 'Furnishings');

  return {
    number: num(textAt(node, 'Number')),
    description: textAt(node, 'Description') || null,
    position: pos
      ? {
          startX: num(textAt(pos, 'StartX')),
          startY: num(textAt(pos, 'StartY')),
          angle: num(textAt(pos, 'Angle')),
          endX: num(textAt(pos, 'EndX')),
          endY: num(textAt(pos, 'EndY')),
        }
      : null,
    style: textAt(node, 'Type/Style') || null,
    dimensions: dim
      ? {
          length: num(textAt(dim, 'Length')),
          height: num(textAt(dim, 'Height')),
          soffit: num(textAt(dim, 'Soffit')),
          thick: num(textAt(dim, 'Thick')),
          vaultHeight: num(textAt(dim, 'VaultHeight')),
        }
      : null,
    fixtures: childrenNamed(fixturesNode, 'Fixture').map((f) =>
      parsePlacedItem(f, 'fixture')
    ),
    furnishings: childrenNamed(furnishingsNode, 'Furnishing').map((f) =>
      parsePlacedItem(f, 'furnishing')
    ),
  };
}

// Real floor-geometry layer (CV/InnoDraw export). The room's floor outline lives
// under Room/Floors/Floor/Shape/template/geometry as a chain of <entity type=
// "line2d"> segments, each with a <begin>/<end> point (<x>,<y> in mm, local to the
// template origin). The first entity omits <begin> (it starts at the origin) and
// the last omits <end> (it closes back). We walk the chain into an ordered ring of
// distinct vertices and map each into the SAME plan frame the walls use:
//     planX = Floor.Position.X + localX
//     planY = Floor.Position.Z - localY
// This mapping was verified vertex-exact (0.00 mm) against the wall endpoints of one
// of our reference files. Returns an array of {x,y} (mm, pre-flip ORDX frame) or
// undefined when the source has no floor-shape.
function parseFloorShape(roomNode) {
  const floor = nodeAt(roomNode, 'Floors/Floor');
  if (!floor) return undefined;
  const geom = nodeAt(floor, 'Shape/template/geometry');
  if (!geom) return undefined;
  const entities = childrenNamed(geom, 'entity');
  if (!entities.length) return undefined;

  const pos = child(floor, 'Position');
  const posX = pos ? (num(textAt(pos, 'X')) || 0) : 0;
  const posZ = pos ? (num(textAt(pos, 'Z')) || 0) : 0;
  const readPt = (n) => {
    if (!n) return null;
    const x = num(textAt(n, 'x'));
    const y = num(textAt(n, 'y'));
    if (x == null || y == null) return null;
    return { x: posX + x, y: posZ - y };
  };

  const pts = [];
  const push = (p) => {
    if (!p) return;
    const last = pts[pts.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) <= 0.01) return; // dedup
    pts.push(p);
  };
  for (const e of entities) {
    const b = readPt(child(e, 'begin'));
    const en = readPt(child(e, 'end'));
    // First entity omits <begin>: the ring starts at the template origin (0,0),
    // which maps to (Position.X, Position.Z) in the plan frame.
    if (pts.length === 0 && !b) push({ x: posX, y: posZ });
    push(b);
    push(en);
  }
  // Drop a trailing vertex that merely repeats the start (closed ring).
  if (pts.length > 2) {
    const a = pts[0], z = pts[pts.length - 1];
    if (Math.hypot(a.x - z.x, a.y - z.y) <= 0.01) pts.pop();
  }
  return pts.length >= 3 ? pts : undefined;
}

function parseRoom(node) {
  const gen = nodeAt(node, 'RoomProperties/Room/General');
  const wallsNode = child(node, 'Walls');
  const room = {
    name: gen ? textAt(gen, 'Name') : '',
    description: gen ? textAt(gen, 'Description') : '',
    type: gen ? textAt(gen, 'Type') || null : null,
    walls: childrenNamed(wallsNode, 'Wall').map(parseWall),
  };
  // Optional real floor outline — only surfaced when the source provides it.
  const floorShape = parseFloorShape(node);
  if (floorShape) room.floorShape = floorShape;
  return room;
}

function parseContact(node) {
  if (!node) return null;
  const fields = [
    'Name', 'Address1', 'Address2', 'City', 'State', 'Zip',
    'Email', 'Phone', 'Mobile', 'Fax', 'Contact', 'Comment',
  ];
  const out = {};
  let any = false;
  for (const f of fields) {
    const v = textAt(node, f);
    out[f.charAt(0).toLowerCase() + f.slice(1)] = v || null;
    if (v) any = true;
  }
  return any ? out : null;
}

function parseOrdxString(xml) {
  const root = parseXml(xml);
  const job = child(root, 'Job');
  if (!job) throw new Error('Not an ORDX file: <Job> root not found');

  const info = nodeAt(job, 'Properties/Job/Information');
  const rooms = childrenNamed(child(job, 'Rooms'), 'Room').map(parseRoom);

  const model = {
    format: 'ORDX',
    created: job.attrs.Created || null,
    productVersion: textAt(job, 'ProductVersion') || null,
    unit: textAt(job, 'Unit') || null,
    job: {
      name: info ? textAt(info, 'Job/Name') : '',
      description: info ? textAt(info, 'Job/Description') : '',
    },
    customer: parseContact(nodeAt(info, 'Customer')),
    shipTo: parseContact(nodeAt(info, 'ShipTo')),
    rooms,
  };

  model.summary = summarize(model);
  return model;
}

function parseOrdxFile(path) {
  const xml = fs.readFileSync(path, 'utf8');
  return parseOrdxString(xml);
}

function summarize(model) {
  let walls = 0, fixtures = 0, furnishings = 0;
  const itemCounts = {};
  for (const r of model.rooms) {
    walls += r.walls.length;
    for (const w of r.walls) {
      for (const it of [...w.fixtures, ...w.furnishings]) {
        if (it.kind === 'fixture') fixtures++; else furnishings++;
        const key = `${it.kind}:${it.name || it.description || '?'}`;
        itemCounts[key] = (itemCounts[key] || 0) + 1;
      }
    }
  }
  return {
    rooms: model.rooms.length,
    walls,
    fixtures,
    furnishings,
    itemCounts,
  };
}

module.exports = { parseOrdxString, parseOrdxFile, summarize };
