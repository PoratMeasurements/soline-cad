// Minimal DXF sanity validator (no deps): checks section balance, POLYLINE/SEQEND
// pairing, EOF, and counts entities. Not a full parser — a structural smoke test.
"use strict";
const fs = require("fs");
const path = require("path");

function validate(file) {
  const raw = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const pairs = [];
  for (let i = 0; i + 1 < raw.length; i += 2) pairs.push([raw[i].trim(), raw[i + 1]]);
  let sec = 0, endsec = 0, poly = 0, seqend = 0, eof = false;
  const ent = {};
  for (const [code, val] of pairs) {
    if (code === "0") {
      if (val === "SECTION") sec++;
      else if (val === "ENDSEC") endsec++;
      else if (val === "EOF") eof = true;
      else if (val === "POLYLINE") { poly++; ent.POLYLINE = (ent.POLYLINE || 0) + 1; }
      else if (val === "SEQEND") seqend++;
      else if (["LINE", "CIRCLE", "TEXT", "3DFACE", "VERTEX"].includes(val)) ent[val] = (ent[val] || 0) + 1;
    }
  }
  const ok = sec === endsec && poly === seqend && eof && sec >= 3;
  return { file: path.basename(file), ok, sections: sec, endsec, poly, seqend, eof, entities: ent };
}

for (const f of ["out/soline-plan-2d.dxf", "out/soline-model-3d.dxf"]) {
  const r = validate(path.join(__dirname, f));
  console.log((r.ok ? "PASS " : "FAIL ") + r.file, JSON.stringify({ sections: r.sections, endsec: r.endsec, poly: r.poly, seqend: r.seqend, eof: r.eof, entities: r.entities }));
}
