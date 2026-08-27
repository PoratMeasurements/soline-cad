// ============================================================================
// Soline Measurement Engine · demo
// ----------------------------------------------------------------------------
// Builds a realistic kitchen space element-by-element, runs the control engine,
// and writes a control report (console + HTML). Includes a DELIBERATE surveyor
// error to prove the controls catch it — including the important case where two
// devices AGREE on a wrong number but geometry (closure + diagonal) catches it.
// ============================================================================

"use strict";

const fs = require("fs");
const path = require("path");
const E = require("./src/elements");
const { createSpace } = require("./src/space");
const { runControls } = require("./src/controls");
const { renderSpace } = require("./src/render");

// --- Build a kitchen (3620 × 2400, h 2743). Critical dims cross-validated. ---
function kitchen(w3len = { X6: 3620, D2: 3621 }) {
  const H = () => E.meas(2743, { X6: 2743, D2: 2742 });         // wall height
  // Corner angles are validated GEOMETRICALLY (closure + angle-sum + diagonal),
  // not by device redundancy — so they are not marked critical for cross-val.
  const A = (v) => E.meas(v, { X6: v }, { unit: "deg", critical: false });
  const s = createSpace({
    project: "מטבח · אושרת ינקו", address: "רוטשילד 22", vertical: "kitchen",
    operator: "מיכאל", devices: ["X6", "D2"],
  })
    .startBearing(0)
    .addWall(E.wall("W1", { length: E.meas(3620, { X6: 3620, D2: 3621 }), height: H(), cornerAngle: A(90) }))
    .addWall(E.wall("W2", { length: E.meas(2400, { X6: 2400, D2: 2401 }), height: H(), cornerAngle: A(90) }))
    .addWall(E.wall("W3", { length: E.meas(w3len.X6, w3len), height: H(), cornerAngle: A(90) }))
    .addWall(E.wall("W4", { length: E.meas(2400, { X6: 2400, D2: 2399 }), height: H(), cornerAngle: A(90) }))
    // openings (single-source + fit-checked)
    .addOpening(E.opening("O-WIN", { wallId: "W3", type: "window", offset: E.meas(1000, { D2: 1000 }, { critical: false }), width: E.meas(1200, { D2: 1200 }, { critical: false }), height: E.meas(1400, { D2: 1400 }, { critical: false }), sill: E.meas(900, { D2: 900 }, { critical: false }) }))
    .addOpening(E.opening("O-DOOR", { wallId: "W4", type: "door", offset: E.meas(300, { D2: 300 }, { critical: false }), width: E.meas(900, { D2: 900 }, { critical: false }), height: E.meas(2050, { D2: 2050 }, { critical: false }) }))
    // services on W1 + a switch on W4
    .addService(E.service("S-WATER", { wallId: "W1", type: "water", offset: E.meas(1450, { D2: 1450 }, { critical: false }), height: E.meas(550, { D2: 550 }, { critical: false }) }))
    .addService(E.service("S-DRAIN", { wallId: "W1", type: "drain", offset: E.meas(1500, { D2: 1500 }, { critical: false }), height: E.meas(200, { D2: 200 }, { critical: false }) }))
    .addService(E.service("S-OUTLET", { wallId: "W1", type: "outlet", offset: E.meas(1500, { D2: 1500 }, { critical: false }), height: E.meas(1100, { D2: 1100 }, { critical: false }) }))
    .addService(E.service("S-GAS", { wallId: "W1", type: "gas", offset: E.meas(2600, { D2: 2600 }, { critical: false }), height: E.meas(700, { D2: 700 }, { critical: false }) }))
    .addService(E.service("S-SW", { wallId: "W4", type: "switch", offset: E.meas(150, { D2: 150 }, { critical: false }), height: E.meas(1300, { D2: 1300 }, { critical: false }) }))
    // vertical clearances (X6+D2)
    .addClearance(E.clearance("CL-A", { at: "A", value: E.meas(2743, { X6: 2743, D2: 2744 }) }))
    .addClearance(E.clearance("CL-B", { at: "B", value: E.meas(2741, { X6: 2741, D2: 2742 }) }))
    .addClearance(E.clearance("CL-C", { at: "C", value: E.meas(2744, { X6: 2744, D2: 2743 }) }))
    // diagonals — the independent cross-check of the outline
    .addDiagonal(E.diagonal("D-02", { fromCorner: 0, toCorner: 2, value: E.meas(4345, { X6: 4345, D2: 4344 }) }))
    .addDiagonal(E.diagonal("D-13", { fromCorner: 1, toCorner: 3, value: E.meas(4342, { X6: 4342, D2: 4343 }) }))
    .build();
  return s;
}

const good = kitchen();
const bad = kitchen({ X6: 3560, D2: 3561 }); // surveyor misread W3 by 60mm — both devices "agree"

const rGood = runControls(good);
const rBad = runControls(bad);

// --- Console report ---------------------------------------------------------
function logReport(name, r) {
  console.log(`\n=== ${name} === verdict: ${r.verdict}`);
  console.log(`   closure ${r.geo.closureError.toFixed(1)}mm · area ${(r.geo.area / 1e6).toFixed(2)}m² · angleSum ${r.geo.angleSum}°`);
  for (const c of r.checks.filter((c) => !c.pass)) console.log(`   ${c.severity === "BLOCKER" ? "✗" : "!"} [${c.group}] ${c.msg}`);
  console.log(`   passed ${r.checks.filter((c) => c.pass).length}/${r.checks.length} checks`);
}
logReport("תקין", rGood);
logReport("שגיאה מכוונת (W3 קצר ב-60מ״מ)", rBad);

// --- HTML control report ----------------------------------------------------
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });

function scenarioHTML(title, note, space, r) {
  const rows = r.checks.map((c) =>
    `<div class="chk ${c.pass ? "ok" : c.severity.toLowerCase()}"><span class="mk">${c.pass ? "✓" : c.severity === "BLOCKER" ? "✗" : "!"}</span><span class="g">${c.group}</span><span class="m">${c.msg}</span></div>`
  ).join("");
  const badge = r.verdict === "GO"
    ? `<span class="verdict go">✓ GO — כל הבקרות עברו</span>`
    : `<span class="verdict nogo">✗ NO-GO — ${r.failedBlockers.length} בקרות נכשלו</span>`;
  return `<section class="page">
    <div class="sh"><h2>${title}</h2>${badge}</div>
    <p class="note">${note}</p>
    <div class="dwgbox">${renderSpace(space, r)}</div>
    <div class="stat">מתאר ${r.geo.closureError.toFixed(1)} מ״מ · שטח ${(r.geo.area / 1e6).toFixed(2)} מ״ר · היקף ${Math.round(r.geo.measuredPerimeter)} מ״מ · סכום זוויות ${r.geo.angleSum}°</div>
    <div class="checks">${rows}</div>
  </section>`;
}

const head = `<title>Soline · מנוע המדידה — דו״ח בקרה</title>
<style>
  :root{ --ink:#0e2136; --ink2:#3d5273; --muted:#6a7a95; --line:#d3dce8; --accent:#0d6fbf; --go:#0a9d63; --nogo:#d23a3f; --flag:#c67c10; --soft:#f2f6fb;
    --mono:ui-monospace,"SF Mono","Consolas",monospace; --sans:ui-sans-serif,system-ui,"Segoe UI","Arial Hebrew",Arial,sans-serif; }
  *{box-sizing:border-box}
  body{margin:0;direction:rtl;background:#e9edf3;color:var(--ink);font-family:var(--sans);line-height:1.6}
  .wrap{max-width:900px;margin:0 auto;padding:24px 18px 60px}
  h1{font-size:24px;font-weight:800;margin:0}
  .lead{color:var(--ink2);font-size:14px;margin:8px 0 0;max-width:64ch}
  .page{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;margin-top:20px}
  .sh{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line);padding-bottom:10px}
  .sh h2{font-size:17px;font-weight:750}
  .verdict{margin-inline-start:auto;font-family:var(--mono);font-size:12px;padding:6px 12px;border-radius:999px}
  .verdict.go{color:var(--go);background:#eafaf2;border:1px solid var(--go)}
  .verdict.nogo{color:var(--nogo);background:#fdeeee;border:1px solid var(--nogo)}
  .note{font-size:13px;color:var(--muted);margin:10px 0}
  .dwgbox{border:1px solid var(--line);border-radius:10px;background:var(--soft);padding:10px}
  .space{width:100%;height:auto;display:block}
  .stat{font-family:var(--mono);font-size:12px;color:var(--ink2);margin-top:8px;text-align:center}
  .checks{margin-top:14px;display:grid;gap:6px}
  .chk{display:grid;grid-template-columns:auto auto 1fr;gap:10px;align-items:baseline;font-size:13px;padding:8px 10px;border:1px solid var(--line);border-radius:9px}
  .chk .mk{font-weight:800;width:16px;text-align:center}
  .chk .g{font-family:var(--mono);font-size:10.5px;color:var(--muted);white-space:nowrap}
  .chk.ok{border-color:#cdeadd} .chk.ok .mk{color:var(--go)}
  .chk.blocker{border-color:#f3c9c9;background:#fdf4f4} .chk.blocker .mk{color:var(--nogo)}
  .chk.warning{border-color:#f0dcb8;background:#fdf8ee} .chk.warning .mk{color:var(--flag)}
  /* space SVG styles */
  .room{fill:#eef3f9;stroke:none} .wall{stroke:var(--ink);stroke-width:26;stroke-linecap:square}
  .wdim{fill:var(--accent);font-family:var(--mono);font-weight:700} .wlbl{fill:var(--muted);font-family:var(--mono)}
  .corner{fill:#fff;stroke:var(--ink);stroke-width:8} .clbl{fill:var(--muted);font-family:var(--mono)}
  .diag{stroke:#7a3ec8;stroke-width:6;stroke-dasharray:40 26}
  .op-win{stroke:var(--accent);stroke-width:30} .op-door{stroke:var(--go);stroke-width:30}
  .oplbl{fill:var(--ink);font-family:var(--sans)} .svlbl{fill:var(--ink2);font-family:var(--sans)}
  .gap{stroke:var(--nogo);stroke-width:22;stroke-dasharray:44 24} .gaptxt{fill:var(--nogo);font-family:var(--sans);font-weight:800}
  .legend{margin-top:22px;font-size:12.5px;color:var(--ink2)} .legend b{color:var(--ink)}
</style>`;

const body = `<div dir="rtl"><div class="wrap">
  <h1>מנוע המדידה — דו״ח בקרה</h1>
  <p class="lead">המודד בונה את החלל מאלמנטים (קירות, פינות, פתחים, נקודות שירות, מרווחים, אלכסונים). המנוע בונה את המתאר מהאורכים והזוויות ומריץ בקרות שמונעות טעות לפני שהיא הופכת ללוח חתוך לא נכון.</p>
  ${scenarioHTML("תרחיש 1 · מדידה תקינה", "כל המידות הקריטיות נמדדו בשני מכשירים, המתאר נסגר, האלכסונים תואמים.", good, rGood)}
  ${scenarioHTML("תרחיש 2 · שגיאה מכוונת", "המודד קרא את W3 קצר ב-60 מ״מ — ושני המכשירים 'הסכימו' (כיוון לנקודה שגויה פעמיים). האימות הצולב עובר, אבל סגירת המתאר והאלכסון תופסים את הטעות.", bad, rBad)}
  <div class="legend"><b>הלקח:</b> אימות צולב בין מכשירים לבדו אינו מספיק — הוא לא תופס טעות כיוון שיטתית. הבקרות הגאומטריות (סגירת מתאר, סכום זוויות, אלכסון) הן שכבת ההגנה שתופסת את מה שהמכשירים לא.</div>
</div></div>`;

const standalone = `<!doctype html>\n<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n${head}\n</head><body>\n${body}\n</body></html>\n`;
fs.writeFileSync(path.join(outDir, "control-report.html"), standalone, "utf8");
fs.writeFileSync(path.join(outDir, "control-report-artifact.html"), head + "\n" + body, "utf8");
console.log(`\nHTML: out/control-report.html`);
