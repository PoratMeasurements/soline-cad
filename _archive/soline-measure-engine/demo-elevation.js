// ============================================================================
// Soline Measurement Engine · Elevation + 3D demo (runnable)
// ----------------------------------------------------------------------------
// Builds the SAME sample room + ~9 placements as demo-dxf.js, then writes:
//   out/space-elevation.dxf   — front elevations, one per wall, in a row
//   out/space-elevation.svg   — same, as an SVG preview
//   out/space-3d.dxf          — walls/floor/ceiling as 3DFACEs + element markers
// and logs entity / issue counts.
// ============================================================================

"use strict";

const fs = require("fs");
const path = require("path");
const E = require("./src/elements");
const { createSpace } = require("./src/space");
const { place } = require("./src/placement");
const { elevationDxf, elevationSvg, dxf3d } = require("./src/elevation");

// --- Build the room (identical to demo-dxf.js) ------------------------------
const H = () => E.meas(2743, { X6: 2743 });
const A90 = () => E.meas(90, { X6: 90 }, { unit: "deg", critical: false });

const space = createSpace({
  project: "חדר לדוגמה · אלֵבַציה", vertical: "generic", operator: "מיכאל", devices: ["X6"],
})
  .startBearing(0)
  .addWall(E.wall("W1", { length: E.meas(3600, { X6: 3600 }), height: H(), cornerAngle: A90() }))
  .addWall(E.wall("W2", { length: E.meas(2400, { X6: 2400 }), height: H(), cornerAngle: A90() }))
  .addWall(E.wall("W3", { length: E.meas(3600, { X6: 3600 }), height: H(), cornerAngle: A90() }))
  .addWall(E.wall("W4", { length: E.meas(2400, { X6: 2400 }), height: H(), cornerAngle: A90() }))
  .build();

const center = [1800, 1200];

// --- Placements (same set as demo-dxf.js) -----------------------------------
const placements = [
  place("elec.outlet.power", { wallId: "W1", offset: 1500, height: 300 }),
  place("elec.switch",       { wallId: "W4", offset: 200,  height: 1300 }),
  place("elec.box.gvis.row", { wallId: "W1", firstOffset: 400, count: 4, spacing: 71, height: 1100 }),
  place("plumb.niple",       { wallId: "W1", offset: 2600, height: 550 }),
  place("win.hinged",        { wallId: "W3", offset: 900,  width: 1200, height: 1400, sill: 900 }),
  place("door.hinged",       { wallId: "W2", offset: 300,  width: 900,  height: 2050 }),
  place("plumb.floordrain",  { centerXY: center }),
  place("light.panel",       { centerXY: [2600, 1200] }),
  place("light.spot.row",    { wallId: "W3", firstOffset: 600, count: 3, spacing: 900, height: 2743 }),
];

const usedIds = placements.map((p) => p.catalogId);

// --- Serialise --------------------------------------------------------------
const { dxf: elevDxf, issues, layers } = elevationDxf(space, placements);
const elevSvg = elevationSvg(space, placements);
const threeD = dxf3d(space, placements);

const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "space-elevation.dxf"), elevDxf, "utf8");
fs.writeFileSync(path.join(outDir, "space-elevation.svg"), elevSvg, "utf8");
fs.writeFileSync(path.join(outDir, "space-3d.dxf"), threeD, "utf8");

// --- Report -----------------------------------------------------------------
const elevEntities = (elevDxf.match(/^(LINE|CIRCLE|POLYLINE|TEXT)$/gm) || []).length;
const faces3d = (threeD.match(/^3DFACE$/gm) || []).length;
const lines3d = (threeD.match(/^LINE$/gm) || []).length;

console.log(`Placements: ${placements.length}  ·  catalog ids: ${usedIds.join(", ")}`);
console.log(`Elevation layers (${layers.length}): ${layers.join(", ")}`);
console.log(`Elevation entities: ${elevEntities}  ·  Issues: ${issues.length}`);
for (const i of issues) console.log(`  ! ${i}`);
console.log(`3D DXF: ${faces3d} 3DFACEs  ·  ${lines3d} marker lines`);
console.log(`Wrote: out/space-elevation.dxf , out/space-elevation.svg , out/space-3d.dxf`);
