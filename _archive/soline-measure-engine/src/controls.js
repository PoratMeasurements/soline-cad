// ============================================================================
// Soline Measurement Engine · Control Engine ("שלא יטעה")
// ----------------------------------------------------------------------------
// Runs every field measurement + the built geometry through independent checks
// that catch surveyor mistakes BEFORE they become a wrongly-cut panel. Each
// check returns pass/fail with an actionable Hebrew message telling the
// surveyor exactly what to re-measure. Nothing is auto-corrected — the human
// re-measures; the engine only refuses to let a bad space through.
// ============================================================================

"use strict";

const { computeGeometry, pointOnWall, computedDiagonal } = require("./space");

// Default tolerances (kitchen). Swap per vertical (stone = tighter).
const DEFAULT_TOL = {
  crossMm: 3,        // agreement between two devices on a length
  crossDeg: 0.5,     // agreement on an angle
  closureMm: 5,      // outline must return to origin within this
  angleSumDeg: 1.0,  // per-corner slack on the interior-angle-sum law
  diagMm: 5,         // measured vs computed diagonal
  clearanceStepMm: 20, // implausible jump in floor→ceiling between grid points
  minWall: 200, maxWall: 15000,
  minHeight: 2000, maxHeight: 4000,
  minAngle: 30, maxAngle: 330,
};

const CHECK = (id, group, severity, pass, msg) => ({ id, group, severity, pass, msg });
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

function collectMeasurements(space) {
  const out = [];
  space.walls.forEach((w) => {
    out.push({ m: w.length, ctx: `אורך קיר ${w.id}` });
    out.push({ m: w.height, ctx: `גובה קיר ${w.id}` });
    out.push({ m: w.cornerAngle, ctx: `זווית בפינת ${w.id}` });
  });
  space.openings.forEach((o) => {
    out.push({ m: o.offset, ctx: `מיקום ${o.id}` });
    out.push({ m: o.width, ctx: `רוחב ${o.id}` });
    out.push({ m: o.height, ctx: `גובה ${o.id}` });
    if (o.sill) out.push({ m: o.sill, ctx: `סף ${o.id}` });
  });
  space.services.forEach((s) => {
    out.push({ m: s.offset, ctx: `מיקום ${s.id}` });
    out.push({ m: s.height, ctx: `גובה ${s.id}` });
  });
  space.clearances.forEach((c) => out.push({ m: c.value, ctx: `מרווח ${c.id}` }));
  space.diagonals.forEach((d) => out.push({ m: d.value, ctx: `אלכסון ${d.id}` }));
  return out;
}

function runControls(space, tolOverride) {
  const tol = { ...DEFAULT_TOL, ...(tolOverride || {}) };
  const geo = computeGeometry(space);
  const checks = [];
  const n = geo.n;

  // 1) Cross-validation — every critical value needs ≥2 agreeing sources.
  for (const { m, ctx } of collectMeasurements(space)) {
    if (!m.critical) continue;
    const vals = m.sources.map((s) => s.value);
    if (vals.length < 2) {
      checks.push(CHECK("xval", "אימות צולב", "BLOCKER", false,
        `${ctx}: נמדד ממקור אחד בלבד. מדידה קריטית דורשת שני מכשירים (X6+D2).`));
      continue;
    }
    const delta = Math.max(...vals) - Math.min(...vals);
    const limit = m.unit === "deg" ? tol.crossDeg : tol.crossMm;
    checks.push(CHECK("xval", "אימות צולב", "BLOCKER", delta <= limit,
      delta <= limit
        ? `${ctx}: שני המקורות מסכימים (Δ ${round(delta)} ${m.unit === "deg" ? "°" : "מ״מ"}).`
        : `${ctx}: פער ${round(delta)} ${m.unit === "deg" ? "°" : "מ״מ"} בין המכשירים (מותר ${limit}). מדוד שוב.`));
  }

  // 2) Outline closure — the strongest single control.
  checks.push(CHECK("closure", "סגירת מתאר", "BLOCKER", geo.closureError <= tol.closureMm,
    geo.closureError <= tol.closureMm
      ? `המתאר נסגר (פער ${round(geo.closureError)} מ״מ).`
      : `המתאר לא נסגר — פער ${round(geo.closureError)} מ״מ בין הקיר האחרון לנקודת ההתחלה (מותר ${tol.closureMm}). בדוק אורכי קירות וזוויות.`));

  // 3) Interior-angle-sum law: Σ = (n-2)·180.
  const expected = (n - 2) * 180;
  const angErr = Math.abs(geo.angleSum - expected);
  checks.push(CHECK("anglesum", "סכום זוויות", "BLOCKER", angErr <= tol.angleSumDeg * n,
    angErr <= tol.angleSumDeg * n
      ? `סכום הזוויות תקין (${round(geo.angleSum)}° מול ${expected}°).`
      : `סכום הזוויות ${round(geo.angleSum)}° במקום ${expected}° (חריגה ${round(angErr)}°). זווית פינה נמדדה שגוי.`));

  // 4) Diagonal reconciliation — independent cross-check of the outline.
  if (space.diagonals.length === 0) {
    checks.push(CHECK("diag", "אלכסון בקרה", "WARNING", false,
      `לא נמדד אף אלכסון בקרה. מדוד לפחות אלכסון אחד כדי לאמת את צורת החדר.`));
  }
  for (const d of space.diagonals) {
    const computed = computedDiagonal(geo, d.fromCorner, d.toCorner);
    if (computed == null) continue;
    const diff = Math.abs(d.value.value - computed);
    checks.push(CHECK("diag", "אלכסון בקרה", "BLOCKER", diff <= tol.diagMm,
      diff <= tol.diagMm
        ? `אלכסון ${d.id}: נמדד ${round(d.value.value)} מול מחושב ${round(computed)} — תואם.`
        : `אלכסון ${d.id}: נמדד ${round(d.value.value)} אך המתאר מחשב ${round(computed)} (פער ${round(diff)} מ״מ). קיר או זווית שגויים.`));
  }

  // 5) Opening fit — opening must sit within its host wall, no overlaps.
  const byWall = {};
  for (const o of space.openings) {
    const wall = space.walls.find((w) => w.id === o.wallId);
    if (!wall) { checks.push(CHECK("fit", "התאמת פתחים", "BLOCKER", false, `${o.id}: משויך לקיר לא קיים (${o.wallId}).`)); continue; }
    const L = wall.length.value;
    const start = o.offset.value, end = o.offset.value + o.width.value;
    const ok = start >= 0 && end <= L + tol.crossMm;
    checks.push(CHECK("fit", "התאמת פתחים", "BLOCKER", ok,
      ok ? `${o.id}: יושב בתוך קיר ${o.wallId} (${round(start)}–${round(end)} מתוך ${L}).`
        : `${o.id}: חורג מקיר ${o.wallId} — ${round(start)}–${round(end)} מ״מ מול אורך קיר ${L}. בדוק מיקום/רוחב.`));
    (byWall[o.wallId] = byWall[o.wallId] || []).push([start, end, o.id]);
  }
  for (const [wid, segs] of Object.entries(byWall)) {
    segs.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < segs.length; i++) {
      if (segs[i][0] < segs[i - 1][1] - 1) {
        checks.push(CHECK("overlap", "התאמת פתחים", "BLOCKER", false,
          `${segs[i - 1][2]} ו-${segs[i][2]} חופפים על קיר ${wid}. בדוק מיקומים.`));
      }
    }
  }

  // 6) Plausibility — physical sanity on every value.
  for (const w of space.walls) {
    if (w.length.value < tol.minWall || w.length.value > tol.maxWall)
      checks.push(CHECK("plaus", "סבירוּת", "BLOCKER", false, `אורך קיר ${w.id} = ${w.length.value} מ״מ אינו סביר.`));
    if (w.height.value < tol.minHeight || w.height.value > tol.maxHeight)
      checks.push(CHECK("plaus", "סבירוּת", "WARNING", false, `גובה קיר ${w.id} = ${w.height.value} מ״מ חריג — ודא.`));
    if (w.cornerAngle.value < tol.minAngle || w.cornerAngle.value > tol.maxAngle)
      checks.push(CHECK("plaus", "סבירוּת", "BLOCKER", false, `זווית פינת ${w.id} = ${w.cornerAngle.value}° אינה סבירה.`));
  }

  // 7) Clearance consistency — a level ceiling shouldn't jump between points.
  const cl = space.clearances.map((c) => c.value.value);
  for (let i = 1; i < cl.length; i++) {
    if (Math.abs(cl[i] - cl[i - 1]) > tol.clearanceStepMm)
      checks.push(CHECK("clr", "עקביות מרווח", "WARNING", false,
        `קפיצה של ${round(Math.abs(cl[i] - cl[i - 1]))} מ״מ במרווח בין נקודות סמוכות — תקרה לא מפולסת או טעות מדידה.`));
  }

  // 8) Completeness — did the surveyor capture the required set?
  if (n < 3) checks.push(CHECK("comp", "שלמות", "BLOCKER", false, `החדר אינו סגור — נדרשים לפחות 3 קירות.`));
  if (space.clearances.length === 0) checks.push(CHECK("comp", "שלמות", "BLOCKER", false, `לא נמדד אף מרווח אנכי (רצפה→תקרה).`));
  const noHeight = space.walls.filter((w) => !w.height || !w.height.value);
  if (noHeight.length) checks.push(CHECK("comp", "שלמות", "WARNING", false, `חסר גובה בקירות: ${noHeight.map((w) => w.id).join(", ")}.`));

  // --- Verdict ---
  const failedBlockers = checks.filter((c) => !c.pass && c.severity === "BLOCKER");
  const warnings = checks.filter((c) => !c.pass && c.severity === "WARNING");
  const verdict = failedBlockers.length === 0 ? "GO" : "NO_GO";

  return { verdict, geo, checks, failedBlockers, warnings, tol };
}

module.exports = { runControls, DEFAULT_TOL };
