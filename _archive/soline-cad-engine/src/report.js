// ============================================================================
// Soline CAD Engine · PDF report generator (print-ready A4 HTML)
// ----------------------------------------------------------------------------
// Composes the validated model + SVG views into a detailed, print-optimised
// report (open in a browser → Print → Save as PDF). Light theme by design —
// it is a printed measurement document. Hebrew RTL.
// Returns { head, body } so build.js can emit both a standalone file and an
// Artifact-ready (body-only) file.
// ============================================================================

"use strict";

const { planSVG, frontSVG, sideSVG } = require("./views");

function report(model) {
  const m = model.meta;

  const head = `<title>Soline · דו״ח מדידה — ${m.client}</title>
<style>
  :root{ --ink:#0e2136; --ink2:#3d5273; --muted:#6a7a95; --line:#d3dce8; --accent:#0d6fbf;
    --go:#0a9d63; --panel:#fff; --soft:#f2f6fb;
    --mono:ui-monospace,"SF Mono","Consolas",monospace; --sans:ui-sans-serif,system-ui,"Segoe UI","Arial Hebrew",Arial,sans-serif; }
  *{ box-sizing:border-box; }
  body{ margin:0; direction:rtl; background:#e9edf3; color:var(--ink); font-family:var(--sans); line-height:1.6; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page{ width:210mm; min-height:297mm; margin:10mm auto; background:var(--panel); padding:16mm 15mm; box-shadow:0 6px 30px -12px rgba(0,0,0,.3); position:relative; }
  .ltr{ direction:ltr; unicode-bidi:isolate; } .mono{ font-family:var(--mono); font-variant-numeric:tabular-nums; }
  h1,h2,h3{ margin:0; }
  /* title block */
  .tb{ display:flex; align-items:flex-start; gap:14px; border-bottom:2px solid var(--ink); padding-bottom:14px; }
  .tb .mk{ width:42px; height:42px; border-radius:10px; background:var(--accent); color:#fff; display:grid; place-items:center; font-weight:800; font-size:20px; }
  .tb .t h1{ font-size:22px; font-weight:800; letter-spacing:-.01em; }
  .tb .t .s{ color:var(--muted); font-size:13px; font-family:var(--mono); margin-top:2px; }
  .tb .verified{ margin-inline-start:auto; text-align:center; }
  .tb .verified .b{ display:inline-flex; gap:6px; align-items:center; font-family:var(--mono); font-size:12px; color:var(--go); border:1px solid var(--go); background:#eafaf2; border-radius:999px; padding:5px 12px; }
  .meta{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px 18px; margin-top:14px; }
  .meta .k{ font-family:var(--mono); font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
  .meta .v{ font-weight:650; font-size:13.5px; }
  section{ margin-top:22px; }
  .sh{ display:flex; align-items:baseline; gap:10px; border-bottom:1px solid var(--line); padding-bottom:6px; margin-bottom:14px; }
  .sh .n{ font-family:var(--mono); color:var(--accent); font-size:12px; }
  .sh h2{ font-size:16px; font-weight:750; }
  .sh .note{ margin-inline-start:auto; font-size:11.5px; color:var(--muted); }
  .dwgbox{ border:1px solid var(--line); border-radius:10px; padding:10px; background:var(--soft); }
  .dwg{ width:100%; height:auto; display:block; }
  .two{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .cap{ font-size:12px; color:var(--muted); text-align:center; margin-top:6px; }
  /* SVG drawing styles */
  .wall{ fill:#eef3f9; stroke:var(--ink); stroke-width:8; }
  .cut{ fill:#fff; stroke:#c0392b; stroke-width:7; }
  .dim{ stroke:var(--accent); stroke-width:4; } .arr{ fill:var(--accent); }
  .dimt{ fill:var(--accent); font-family:var(--mono); font-weight:700; }
  .lbl{ fill:var(--muted); font-family:var(--sans); } .cutlbl{ fill:#c0392b; font-family:var(--mono); }
  .floor{ stroke:var(--ink); stroke-width:12; } .cab{ fill:#eaeff6; stroke:var(--ink); stroke-width:6; }
  .cabline{ stroke:#9fb0c8; stroke-width:3; } .slab{ fill:#cfe0f2; stroke:var(--accent); stroke-width:6; }
  .splash{ fill:#eaf2fb; stroke:#9fc0e6; stroke-width:3; } .ceil{ stroke:var(--ink); stroke-width:4; stroke-dasharray:34 22; }
  .note{ fill:var(--ink); font-family:var(--sans); }
  /* tables */
  table{ width:100%; border-collapse:collapse; font-size:13px; }
  th,td{ text-align:start; padding:8px 10px; border-bottom:1px solid var(--line); }
  thead th{ font-family:var(--mono); font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); background:var(--soft); }
  td.num{ font-family:var(--mono); text-align:start; }
  td .ok{ color:var(--go); font-family:var(--mono); font-size:11px; }
  /* explanations & photos */
  .exp{ font-size:13.5px; color:var(--ink2); }
  .exp li{ margin:4px 0; }
  .photos{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
  .photo{ border:1px dashed var(--line); border-radius:10px; aspect-ratio:4/3; display:grid; place-items:center; background:var(--soft); color:var(--muted); }
  .photo .g{ font-size:30px; } .photo .c{ font-size:11px; margin-top:4px; }
  .foot{ margin-top:26px; border-top:1px solid var(--line); padding-top:10px; display:flex; justify-content:space-between; font-family:var(--mono); font-size:10.5px; color:var(--muted); }
  @media print{ body{ background:#fff; } .page{ margin:0; box-shadow:none; width:auto; } .page + .page{ page-break-before:always; } }
</style>`;

  const dimsRows = model.measurements
    .map((d) => `<tr><td>${d.label}</td><td class="num">${d.value} מ״מ</td><td class="mono">${d.dev}</td><td><span class="ok">✓ אומת</span></td></tr>`)
    .join("");

  const body = `<div dir="rtl">
  <!-- PAGE 1 -->
  <div class="page">
    <div class="tb">
      <div class="mk">S</div>
      <div class="t"><h1>דו״ח מדידה מאומת</h1><div class="s">Soline · Verified Measurement Report</div></div>
      <div class="verified"><div class="b">✓ מאומת</div></div>
    </div>
    <div class="meta">
      <div><div class="k">לקוח</div><div class="v">${m.client}</div></div>
      <div><div class="k">פרויקט</div><div class="v">${m.project}</div></div>
      <div><div class="k">כתובת</div><div class="v">${m.address}</div></div>
      <div><div class="k">חומר</div><div class="v">${m.material}</div></div>
      <div><div class="k">תאריך</div><div class="v mono">${m.date}</div></div>
      <div><div class="k">רוויזיה</div><div class="v mono">${m.revision}</div></div>
      <div><div class="k">טולרנס</div><div class="v mono">±${m.toleranceMm} מ״מ</div></div>
      <div><div class="k">Checksum</div><div class="v mono">${m.checksum}</div></div>
    </div>

    <section>
      <div class="sh"><span class="n">01</span><h2>מבט על (Plan)</h2><span class="note">קנה מידה יחסי · מ״מ</span></div>
      <div class="dwgbox">${planSVG(model)}</div>
      <div class="cap">מבט-על של המשטחים, פתחי הכיור/כיריים והמידות הראשיות. הפתחים באדום.</div>
    </section>

    <section class="exp">
      <div class="sh"><span class="n">02</span><h2>הסבר</h2></div>
      <ul>
        <li>המשטח הראשי באורך <b>${model.panels[0].rect.w} מ״מ</b> ובעומק <b>${model.panels[0].rect.h} מ״מ</b>, עובי לוח <b>${model.panels[0].thickness} מ״מ</b>.</li>
        <li>פתח הכיור והכיריים מסומנים באדום עם מיקום ומידה מדויקים לחיתוך CNC.</li>
        <li>כל מידה קריטית נמדדה בשני מכשירים בלתי-תלויים (X6 + D2) והסכימו בתוך ±${m.toleranceMm} מ״מ.</li>
      </ul>
    </section>
  </div>

  <!-- PAGE 2 -->
  <div class="page">
    <section>
      <div class="sh"><span class="n">03</span><h2>מבטי חזית וצד (Elevations)</h2></div>
      <div class="two">
        <div><div class="dwgbox">${frontSVG(model)}</div><div class="cap">מבט חזית — גובה ארון, לוח, חיפוי אחורי ומרווח לתקרה (${model.elevation.ceilingClearance} מ״מ)</div></div>
        <div><div class="dwgbox">${sideSVG(model)}</div><div class="cap">מבט צד — עומק המשטח וגובה הארון</div></div>
      </div>
    </section>

    <section>
      <div class="sh"><span class="n">04</span><h2>טבלת מידות מאומתות</h2><span class="note">${model.measurements.length} מידות</span></div>
      <table>
        <thead><tr><th>מידה</th><th>ערך</th><th>מקור</th><th>אימות</th></tr></thead>
        <tbody>${dimsRows}</tbody>
      </table>
    </section>

    <section>
      <div class="sh"><span class="n">05</span><h2>תיעוד מהאתר</h2><span class="note">תמונות</span></div>
      <div class="photos">
        <div class="photo"><div><div class="g">📷</div><div class="c">מבט כללי · מטבח</div></div></div>
        <div class="photo"><div><div class="g">📷</div><div class="c">אזור הכיור</div></div></div>
        <div class="photo"><div><div class="g">📷</div><div class="c">חיבור לקיר</div></div></div>
      </div>
    </section>

    <div class="foot">
      <span class="ltr">SOLINE · CERT SOL-2026-0226-INK</span>
      <span>מודד: ${m.operator} · מכשירים: ${m.devices.join(" + ")} · ניתן לאימות מול Soline</span>
    </div>
  </div>
</div>`;

  return { head, body };
}

module.exports = { report };
