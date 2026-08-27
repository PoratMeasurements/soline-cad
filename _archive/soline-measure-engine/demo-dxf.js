// ============================================================================
// Soline Measurement Engine · DXF demo (runnable)
// ----------------------------------------------------------------------------
// Builds a simple rectangular room (3600 × 2400, four 90° walls, h 2743),
// places ~9 catalog elements on it (outlets, a chained box row, a niple, a
// window, a door, a floor drain, a ceiling panel, a spot row, a switch), then
// writes out/space-with-elements.dxf and .svg and logs entity/issue counts.
// ============================================================================

"use strict";

const fs = require("fs");
const path = require("path");
const E = require("./src/elements");
const { createSpace } = require("./src/space");
const { place } = require("./src/placement");
const { spaceToDxf, spaceToSvg } = require("./src/place-to-dxf");

// --- Build the room ---------------------------------------------------------
const H = () => E.meas(2743, { X6: 2743 });
const A90 = () => E.meas(90, { X6: 90 }, { unit: "deg", critical: false });

const space = createSpace({
  project: "חדר לדוגמה · DXF", vertical: "generic", operator: "מיכאל", devices: ["X6"],
})
  .startBearing(0)
  .addWall(E.wall("W1", { length: E.meas(3600, { X6: 3600 }), height: H(), cornerAngle: A90() }))
  .addWall(E.wall("W2", { length: E.meas(2400, { X6: 2400 }), height: H(), cornerAngle: A90() }))
  .addWall(E.wall("W3", { length: E.meas(3600, { X6: 3600 }), height: H(), cornerAngle: A90() }))
  .addWall(E.wall("W4", { length: E.meas(2400, { X6: 2400 }), height: H(), cornerAngle: A90() }))
  .build();

const center = [1800, 1200]; // room centre for floor/ceiling elements

// --- Placements (all catalog ids exist in catalog.js) -----------------------
const placements = [
  // point on a wall: offset + height
  place("elec.outlet.power", { wallId: "W1", offset: 1500, height: 300 }),
  place("elec.switch",       { wallId: "W4", offset: 200,  height: 1300 }),
  // array on a wall: firstOffset + count + spacing (+height)
  place("elec.box.gvis.row", { wallId: "W1", firstOffset: 400, count: 4, spacing: 71, height: 1100 }),
  // plumbing point
  place("plumb.niple",       { wallId: "W1", offset: 2600, height: 550 }),
  // opening (window) on a wall: offset + width + height + sill
  place("win.hinged",        { wallId: "W3", offset: 900,  width: 1200, height: 1400, sill: 900 }),
  // opening (door) on a wall
  place("door.hinged",       { wallId: "W2", offset: 300,  width: 900,  height: 2050 }),
  // floor point via centerXY
  place("plumb.floordrain",  { centerXY: center }),
  // ceiling area via centerXY
  place("light.panel",       { centerXY: [2600, 1200] }),
  // ceiling spot row — array resolves along a wall
  place("light.spot.row",    { wallId: "W3", firstOffset: 600, count: 3, spacing: 900, height: 2743 }),
];

const usedIds = placements.map((p) => p.catalogId);

// --- Serialise --------------------------------------------------------------
const { dxf, issues, layers } = spaceToDxf(space, placements);
const svg = spaceToSvg(space, placements);

const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "space-with-elements.dxf"), dxf, "utf8");
fs.writeFileSync(path.join(outDir, "space-with-elements.svg"), svg, "utf8");

// --- Report -----------------------------------------------------------------
const entityCount = (dxf.match(/^(LINE|CIRCLE|POLYLINE|TEXT)$/gm) || []).length;
console.log(`Placements: ${placements.length}  ·  catalog ids: ${usedIds.join(", ")}`);
console.log(`Layers (${layers.length}): ${layers.join(", ")}`);
console.log(`Entities: ${entityCount}  ·  Issues: ${issues.length}`);
for (const i of issues) console.log(`  ! ${i}`);
console.log(`Wrote: out/space-with-elements.dxf , out/space-with-elements.svg`);
