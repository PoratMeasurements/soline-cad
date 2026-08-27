'use strict';
/*
 * export_pdf.js — Soline CARPENTER-GRADE Hebrew (RTL) measurement report.
 * =============================================================================
 * `renderPdf(model, outPath, opts) -> result` builds a print-optimized A4 RTL
 * HTML document (its OWN, self-contained — no dependency on the interactive
 * export) and renders it to a real PDF with a headless Chromium-family browser
 * already on the machine. If none is found it degrades to the .print.html
 * sidecar plus the exact one-liner to finish by hand (never throws).
 *
 * WHY OWN HTML (rewrite 2026-08-21): the owner's complaint is dimension lines
 * and text quality. Those live entirely in the drawing layer, so this module now
 * OWNS the whole print document and ships a true architectural dimension engine:
 *   - extension (witness) lines with a gap off the object + a short overshoot,
 *   - a dimension line at a consistent offset with clean 45° architect ticks,
 *   - the value centered on the line, ALWAYS upright, with a white halo so the
 *     line never crosses the glyphs; numbers kept LTR inside RTL via LRI/PDI,
 *   - nested chains that don't collide: inner per-segment run + an outer overall
 *     bar at a larger offset.
 * Every drawing is inline <svg> vector (real <line>/<path>/<text>) — no raster —
 * so the PDF opens with crisp, selectable geometry (good PDF->DXF-2D source) and
 * `renderPdf` returns vector:true after verifying it.
 *
 * STRUCTURE (spec-aligned, carpenter-first):
 *   1. Cover — job / client / date / status + summary stats.
 *   2. Per-room PLAN page — poché walls, nested dimension chains, numbered
 *      element callouts, legend, scale bar, north arrow, info strip.
 *   3. Per-wall ELEVATION page — elements at real heights, height axis (right),
 *      running position chain + overall bar (bottom).
 *   4. Elements SCHEDULE table (no. / type / wall / position / height / size / note).
 *   5. Walls table (length / height / thickness / angle / closure).
 *
 * Units: all site dimensions are shown in CENTIMETRES (carpenter-native in IL);
 * the source model is in mm. A "כל המידות בס״מ" note appears on every drawing.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

// The read-only Hebrew element catalog (English key + Hebrew name + category).
let ELEMENTS = [];
try { ELEMENTS = require('../elements.json'); } catch (_) { ELEMENTS = []; }
const BY_EN = {}, BY_HE = {};
for (const e of ELEMENTS) { if (e && e.en) BY_EN[e.en] = e; if (e && e.he) BY_HE[e.he] = e; }

// Self-contained webfonts (Heebo body/headings/dims + locked Poppins wordmark) as
// base64 @font-face — so the report renders IDENTICALLY in the browser and in the
// headless-print PDF with NO network (headless Chrome/Edge does not reliably wait
// for late Google-Fonts fetches before printing). Rebuild (needs network) with:
//   node src/assets/build_fonts.js src/assets/fonts_embedded.css
// If the embed is missing we degrade to a Google-Fonts <link> + system fallbacks.
let EMBEDDED_FONTS = '';
try { EMBEDDED_FONTS = fs.readFileSync(path.join(__dirname, 'assets', 'fonts_embedded.css'), 'utf8'); } catch (_) { EMBEDDED_FONTS = ''; }

// -----------------------------------------------------------------------------
// LOCKED WORDMARK (owner decision 2026-08-21): the Soline wordmark is REAL Poppins
// type — NOT a reconstructed stroked-path SVG. "soline" is Poppins SemiBold (600),
// lowercase, brand orange; the tagline is Poppins Medium (500), all-caps, wide
// tracking, brand teal. The 'i' tittle is round natively in Poppins. This font is
// PERMANENTLY LOCKED and hard-coded here — it is deliberately NOT part of the
// swappable FONTS config below, so a future "export options" swap can never
// re-typeset the logo. Poppins is loaded via Google Fonts in the document head.
const WORDMARK_FONT = "'Poppins','Segoe UI',sans-serif"; // locked — do not add to FONTS
const WORDMARK_NAME_COLOR = '#F49A1A';                    // locked brand orange
const WORDMARK_TAG_COLOR  = '#1596A8';                    // locked brand teal
const WORDMARK_TAGLINE    = 'SMART SPATIAL SOLUTIONS';    // locked

// ---------------------------------------------------------------------------
// Brand palette (mirrors ui/Theme.kt / PDF_REPORT_SPEC §11.1).
// ---------------------------------------------------------------------------
const BRAND = {
  orange: '#F49A1A', teal: '#1596A8', tealDark: '#0F6E7C',
  cream: '#FBF4E6', ink: '#2B2B2B', paper: '#FFFFFF',
  muted: '#6B7280', line: '#E4DCCB',
  dim: '#7A6C55',           // dimension line / text — warm slate (owner palette)
  wall: '#3A3A3A',          // poché fill
  floor: '#FCF7EC',
  red: '#E5484D', green: '#12805C', amber: '#C47A04',
};

// -----------------------------------------------------------------------------
// SWAPPABLE EXPORT CONFIG (owner decision 2026-08-21) — a future "export options"
// function can override these WITHOUT ever touching the locked Poppins wordmark
// above. FONTS drives every non-logo run (headings / body / dimensions); all
// default to Heebo (loaded via Google Fonts). colorByDiscipline is the single
// source of truth for element/legend/drawing colours per trade.
const FONTS = {
  heading: 'Heebo',
  body: 'Heebo',
  dim: 'Heebo',
};
const FONT_FALLBACK = '"Segoe UI","Arial Hebrew","Assistant",Arial,sans-serif';
const COLORS = {
  byDiscipline: {
    electrical: '#E8A400', lighting: '#F5C542', water: '#1E78C8', drainage: '#2E9E6B',
    gas: '#D94A28', hvac: '#17A2B8', structure: '#3A3A3A', doors: '#8A5A2B',
    windows: '#5AA9E6', furniture: '#B08968', kitchen: '#127C8C', dims: '#7A6C55',
  },
};
const fontStack = (role) => `"${FONTS[role] || 'Heebo'}",${FONT_FALLBACK}`;

// Map a resolved element (Hebrew name + coarse group) → fine discipline key so the
// colour comes from COLORS.byDiscipline. Splits the coarse "פתחים ומבנה" group into
// doors / windows / structure, and "אינסטלציה" into water / drainage.
function disciplineOf(he, group) {
  const s = String(he || '');
  if (/חלון/.test(s)) return 'windows';
  if (/דלת|מפתח|פתח(?!ל)/.test(s)) return 'doors';
  if (/ניקוז|ביוב|נקז/.test(s)) return 'drainage';
  if (/גז/.test(s)) return 'gas';
  if (group === 'חשמל') return 'electrical';
  if (group === 'תאורה') return 'lighting';
  if (group === 'אינסטלציה') return (/מים|ברז|צינור|דוד|מהמם|חמים|קר/.test(s) ? 'water' : 'water');
  if (group === 'מיזוג/חימום') return 'hvac';
  if (group === 'פתחים ומבנה') return 'structure';
  if (/עמוד|קונס|בטון|פאנל|הנמכ|תקרה|קור(?!ה)/.test(s)) return 'structure';
  return 'furniture';
}
function disciplineColor(he, group) {
  return COLORS.byDiscipline[disciplineOf(he, group)] || null;
}

// Element category → { group (Hebrew), color } for callouts / legend / row tint.
function groupOf(category) {
  const c = String(category || '');
  if (c.startsWith('חשמל')) return { group: 'חשמל', color: BRAND.orange };
  if (c.startsWith('תאורה')) return { group: 'תאורה', color: '#E0A800' };
  if (c.startsWith('אינסטלציה')) return { group: 'אינסטלציה', color: BRAND.teal };
  if (c.startsWith('גז')) return { group: 'גז', color: BRAND.red };
  if (c.startsWith('מיזוג') || c.startsWith('חימום')) return { group: 'מיזוג/חימום', color: '#3E8E9E' };
  if (c.startsWith('תקשורת') || c.startsWith('בית חכם') || c.startsWith('בטיחות')) return { group: 'תקשורת ובקרה', color: '#7E57C2' };
  if (c.startsWith('אדריכלי')) return { group: 'פתחים ומבנה', color: '#5B7A8C' };
  if (c.startsWith('אנרגיה')) return { group: 'אנרגיה', color: '#2E9E6B' };
  return { group: 'אחר', color: BRAND.muted };
}

function isHebrew(s) { return /[֐-׿]/.test(String(s || '')); }

// Keyword fallback categorisation — the catalog only covers a subset of Hebrew
// names, so infer the group from the surveyor's own label when it misses. This
// keeps the plan callouts / legend / schedule colour-coded meaningfully instead
// of everything collapsing to "אחר".
function groupByKeyword(name) {
  const s = String(name || '');
  if (/שקע|מתג|חשמל|תשתית חשמל|נקוד/.test(s)) return groupOf('חשמל');
  if (/מנור|תאור|ספוט|גוף תאור/.test(s)) return groupOf('תאורה');
  if (/מים|צינור|ניקוז|ביוב|אינסטל|ברז|דוד/.test(s)) return groupOf('אינסטלציה');
  if (/גז/.test(s)) return groupOf('גז');
  if (/מזג|מיזוג|חימום|רדיאטור|מפוח/.test(s)) return groupOf('מיזוג');
  if (/תקשור|רשת|טלוו|אנטנה|בקרה|גלאי|אזעק/.test(s)) return groupOf('תקשורת');
  if (/חלון|דלת|מפתח|פתח|עמוד|קור|משקוף|הנמכ|תקרה|פאנל|בטון|קונ/.test(s)) return groupOf('אדריכלי');
  return null;
}

// Resolve one placed item → { he, group, color, category }.
function resolveItem(it) {
  const cand = [it.description, it.name, it.heName];
  let el = null;
  for (const c of cand) { if (c && BY_EN[c]) { el = BY_EN[c]; break; } }
  if (!el) for (const c of cand) { if (c && BY_HE[c]) { el = BY_HE[c]; break; } }
  const he = it.heName || (isHebrew(it.name) ? it.name : null) || (el && el.he) || it.name || it.description || 'אלמנט';
  let category = el ? el.category : null;
  let g = groupOf(category);
  if (g.group === 'אחר') { const kw = groupByKeyword(he) || groupByKeyword(it.name); if (kw) g = kw; }
  // Colour comes from the owner's per-discipline palette (single source of truth);
  // fall back to the coarse group colour if the discipline is unmapped.
  const color = disciplineColor(he, g.group) || g.color;
  return { he, group: g.group, color, category: category || g.group, discipline: disciplineOf(he, g.group) };
}

// ---------------------------------------------------------------------------
// formatting helpers
// ---------------------------------------------------------------------------
const _ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => _ESC[c]); }
// LTR isolate — keeps numbers/units upright & unflipped inside RTL text.
function iso(s) { return '\u2066' + String(s) + '\u2069'; }
// mm → cm string (carpenter-native). Whole cm when clean, else one decimal.
function cm(mm) {
  const v = Number(mm) / 10;
  if (!Number.isFinite(v)) return '';
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
function n1(x) { return Number(x).toFixed(1); }

function wallVec(w) {
  const p = w.position; const dx = p.endX - p.startX, dy = p.endY - p.startY;
  const len = Math.hypot(dx, dy) || 1;
  return { dx, dy, len, ux: dx / len, uy: dy / len };
}
function cornerAngleDeg(a, b) {
  const va = wallVec(a), vb = wallVec(b);
  let ang = Math.atan2(vb.uy, vb.ux) - Math.atan2(va.uy, va.ux);
  let deg = Math.abs(ang * 180 / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return Math.round((180 - deg) * 10) / 10; // interior angle
}
function niceStep(span) {
  const target = span / 5;
  const pow = Math.pow(10, Math.floor(Math.log10(target || 1)));
  const cand = [1, 2, 2.5, 5, 10].map((m) => m * pow);
  return cand.find((c) => c >= target) || cand[cand.length - 1];
}

// ---------------------------------------------------------------------------
// ARCHITECTURAL DIMENSION ENGINE (the heart of the rewrite).
// All coordinates are SVG pixels. A "dim" measures the distance between two
// witness points a,b, drawn on the side given by the outward unit normal n,
// offset `off` px. Produces: witness lines (gap + overshoot), the dimension
// line, 45° architect ticks, and an upright haloed value centered on the line.
// ---------------------------------------------------------------------------
const TICK = 6;      // half-length of the 45° tick
const WGAP = 4;      // gap between object and start of witness line
const WOVER = 7;     // witness overshoot past the dimension line
const SQRT2 = Math.SQRT1_2;

function dimText(mx, my, nx, ny, label, opts) {
  opts = opts || {};
  const to = opts.textGap == null ? 11 : opts.textGap;
  const tx = mx + nx * to, ty = my + ny * to;
  const cls = opts.bold ? 'dim-t dim-b' : 'dim-t';
  return `<text class="${cls}" x="${n1(tx)}" y="${n1(ty)}" text-anchor="middle" dominant-baseline="central">${esc(iso(label))}</text>`;
}

// One measured dimension between witness points a,b, offset along normal n.
function dim(a, b, n, off, label, opts) {
  opts = opts || {};
  const [ax, ay] = a, [bx, by] = b, [nx, ny] = n;
  const Ax = ax + nx * off, Ay = ay + ny * off;   // dim-line endpoint over a
  const Bx = bx + nx * off, By = by + ny * off;   // dim-line endpoint over b
  // direction of the dim line (for tick orientation)
  let dx = Bx - Ax, dy = By - Ay; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  // 45° tick = dim direction rotated 45°
  const tx = (dx - dy) * SQRT2, ty = (dx + dy) * SQRT2;
  const tick = (px, py) => `<line class="dim-l" x1="${n1(px - tx * TICK)}" y1="${n1(py - ty * TICK)}" x2="${n1(px + tx * TICK)}" y2="${n1(py + ty * TICK)}"/>`;
  let s = '';
  if (opts.witness !== false) {
    s += `<line class="dim-w" x1="${n1(ax + nx * WGAP)}" y1="${n1(ay + ny * WGAP)}" x2="${n1(Ax + nx * WOVER)}" y2="${n1(Ay + ny * WOVER)}"/>`;
    s += `<line class="dim-w" x1="${n1(bx + nx * WGAP)}" y1="${n1(by + ny * WGAP)}" x2="${n1(Bx + nx * WOVER)}" y2="${n1(By + ny * WOVER)}"/>`;
  }
  s += `<line class="dim-l" x1="${n1(Ax)}" y1="${n1(Ay)}" x2="${n1(Bx)}" y2="${n1(By)}"/>`;
  s += tick(Ax, Ay) + tick(Bx, By);
  if (label != null && label !== '') s += dimText((Ax + Bx) / 2, (Ay + By) / 2, nx, ny, label, opts);
  return s;
}

// ---------------------------------------------------------------------------
// PER-ROOM element index — one consistent numbering across plan/elevation/tables.
// ---------------------------------------------------------------------------
function indexRoom(room) {
  const walls = (room.walls || []);
  const items = [];
  let idx = 0;
  walls.forEach((w) => {
    const v = w.position ? wallVec(w) : null;
    for (const it of [...(w.fixtures || []), ...(w.furnishings || [])]) {
      idx += 1;
      const r = resolveItem(it);
      const along = it.position && it.position.x != null ? it.position.x : 0;
      const up = it.position && it.position.y != null ? it.position.y : 0;
      items.push({ idx, wall: w, wallNo: w.number, item: it, r, along, up, decorative: it.class === 'Decorative' });
    }
  });
  return { walls, items };
}

// ---------------------------------------------------------------------------
// ENTRANCE DIRECTION (owner decision 2026-08-22) — the top-left orientation
// marker shows the room's REAL ENTRANCE direction (set by the surveyor at the
// start of measurement), NOT north. The app-lane writes a room-level field
// `entranceDirection`; we support two shapes and degrade gracefully:
//   • a numeric BEARING in degrees (0 = up on the plan, clockwise) — or a numeric
//     string, or an object { bearing|deg|degrees|angle|azimuth }.
//   • a WALL reference (the entrance is through that wall) — a number matching a
//     wall's `number`, an object { wall|wallId|wallNumber|wallNo|ref|side }, or a
//     string like "wall:3" / "קיר 3" / "w3". The arrow then points from the room
//     centroid outward through that wall's midpoint.
// When absent we render a NEUTRAL marker (never a fabricated north).
// ---------------------------------------------------------------------------
function resolveEntrance(room) {
  if (!room) return null;
  let ed = room.entranceDirection;
  if (ed == null || ed === '') return null;
  const asBearing = (v) => { const n = Number(v); return Number.isFinite(n) ? { mode: 'bearing', bearing: ((n % 360) + 360) % 360 } : null; };
  if (typeof ed === 'number') return asBearing(ed);
  if (typeof ed === 'string') {
    const s = ed.trim();
    const mWall = s.match(/(?:wall|קיר|w)\s*[:#]?\s*(\d+)/i);
    if (mWall) return { mode: 'wall', wallNo: Number(mWall[1]) };
    if (/^-?\d+(?:\.\d+)?$/.test(s)) return asBearing(s);
    return null;
  }
  if (typeof ed === 'object') {
    const wv = [ed.wall, ed.wallId, ed.wallNumber, ed.wallNo, ed.ref, ed.side].find((v) => v != null && Number.isFinite(Number(v)));
    if (wv != null) return { mode: 'wall', wallNo: Number(wv) };
    const bv = [ed.bearing, ed.deg, ed.degrees, ed.angle, ed.azimuth].find((v) => v != null && Number.isFinite(Number(v)));
    if (bv != null) return asBearing(bv);
  }
  return null;
}
// Short Hebrew description for text contexts (info-strip / vitals flag).
function entranceLabelText(room) {
  const ed = resolveEntrance(room);
  if (!ed) return { text: 'כיוון כניסה — טרם הוגדר', defined: false };
  if (ed.mode === 'wall') return { text: 'כיוון כניסה: דרך קיר ' + ed.wallNo, defined: true };
  return { text: 'כיוון כניסה: ' + Math.round(ed.bearing) + '°', defined: true };
}
// SVG marker (arrow + label) drawn top-left of the plan. `P` maps model→screen.
function entranceMarker(room, P, cx0, cy0) {
  const ed = resolveEntrance(room);
  const bx = 60, by = 60, R = 22;
  // caption centered on a point right of the badge so long RTL labels never clip
  // the left page edge (text-anchor:middle keeps the whole run on-canvas).
  const capX = 112;
  const cap = (txt, undef) => `<text class="ent-lbl${undef ? ' ent-lbl-undef' : ''}" x="${capX}" y="${by + R + 15}" text-anchor="middle">${esc(txt)}</text>`;
  if (!ed) {
    return `<g class="entrance" transform="translate(${bx},${by})">`
      + `<circle r="${R}" fill="#fff" stroke="${BRAND.muted}" stroke-width="1.3" stroke-dasharray="4 3"/>`
      + `<text x="0" y="1" text-anchor="middle" dominant-baseline="central" class="ent-q">?</text>`
      + `</g>` + cap('כיוון כניסה — טרם הוגדר', true);
  }
  let ux, uy, sub = '';
  if (ed.mode === 'wall') {
    const wall = (room.walls || []).find((w) => w.position && w.number === ed.wallNo)
      || (room.walls || []).filter((w) => w.position)[ed.wallNo];
    if (wall && wall.position) {
      const mx = (wall.position.startX + wall.position.endX) / 2, my = (wall.position.startY + wall.position.endY) / 2;
      const [sx, sy] = P(mx, my); const [ccx, ccy] = P(cx0, cy0);
      let dx = sx - ccx, dy = sy - ccy; const L = Math.hypot(dx, dy) || 1; ux = dx / L; uy = dy / L;
      sub = 'דרך קיר ' + ed.wallNo;
    } else { ux = 0; uy = -1; sub = 'דרך קיר ' + ed.wallNo; }
  } else {
    const r = ed.bearing * Math.PI / 180; ux = Math.sin(r); uy = -Math.cos(r);
    sub = Math.round(ed.bearing) + '°';
  }
  // rotate the up-pointing arrow (0,-1) onto (ux,uy): rot = atan2(ux, -uy).
  const rot = Math.atan2(ux, -uy) * 180 / Math.PI;
  const arrow = `<g transform="rotate(${n1(rot)})"><polygon class="ent-ar" points="0,-16 5.5,5 0,0 -5.5,5"/></g>`;
  return `<g class="entrance" transform="translate(${bx},${by})">`
    + `<circle r="${R}" fill="#fff" stroke="${BRAND.teal}" stroke-width="1.6"/>`
    + arrow + `</g>`
    + cap('כיוון כניסה', false)
    + `<text class="ent-sub" x="${capX}" y="${by + R + 30}" text-anchor="middle">${esc(iso(sub))}</text>`;
}

// ---------------------------------------------------------------------------
// PLAN SVG — poché walls, nested dimension chains, numbered callouts, legend,
// scale bar, ENTRANCE-direction marker.
// ---------------------------------------------------------------------------
function planSvg(room, indexed) {
  const VW = 1040, VH = 720, pad = 132;
  const walls = (room.walls || []).filter((w) => w.position);
  if (!walls.length) return { svg: `<div class="empty">אין גאומטריית-קיר לתצוגת תוכנית</div>`, groups: new Map() };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of walls) for (const [x, y] of [[w.position.startX, w.position.startY], [w.position.endX, w.position.endY]]) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY);
  const scale = Math.min((VW - 2 * pad) / spanX, (VH - 2 * pad) / spanY);
  const offX = pad + ((VW - 2 * pad) - spanX * scale) / 2;
  const offY = pad + ((VH - 2 * pad) - spanY * scale) / 2;
  const P = (x, y) => [offX + (x - minX) * scale, VH - offY - (y - minY) * scale]; // flip Y
  const cx0 = walls.reduce((s, w) => s + (w.position.startX + w.position.endX) / 2, 0) / walls.length;
  const cy0 = walls.reduce((s, w) => s + (w.position.startY + w.position.endY) / 2, 0) / walls.length;
  const thickPx = Math.max(7, ((walls[0].dimensions && walls[0].dimensions.thick) || 100) * scale);

  // floor polygon + poché walls (single closed path, mitered corners)
  const ring = walls.map((w) => P(w.position.startX, w.position.startY));
  ring.push(P(walls[walls.length - 1].position.endX, walls[walls.length - 1].position.endY));
  const ptsAttr = ring.map(([x, y]) => `${n1(x)},${n1(y)}`).join(' ');
  let floor = `<polygon class="floor" points="${ptsAttr}"/>`;
  let poche = `<polyline class="wall" points="${ptsAttr}" style="stroke-width:${n1(thickPx)}"/>`;

  // per-wall length dims (outer offset, outward normal) + corner angles
  let dims = '', angles = '';
  const dimOff = thickPx / 2 + 30;
  walls.forEach((w, i) => {
    const v = wallVec(w);
    const a = P(w.position.startX, w.position.startY);
    const b = P(w.position.endX, w.position.endY);
    // outward normal in PIXEL space (perp to a->b), pushed away from centroid
    let pdx = b[0] - a[0], pdy = b[1] - a[1]; const pl = Math.hypot(pdx, pdy) || 1;
    let nx = -pdy / pl, ny = pdx / pl;
    const [mcx, mcy] = P(cx0, cy0);
    const midx = (a[0] + b[0]) / 2, midy = (a[1] + b[1]) / 2;
    if ((nx * (midx - mcx) + ny * (midy - mcy)) < 0) { nx = -nx; ny = -ny; }
    const len = (w.dimensions && w.dimensions.length != null) ? w.dimensions.length : v.len;
    dims += dim(a, b, [nx, ny], dimOff, cm(len), { bold: true });
    // corner interior angle at end vertex (only if not ~90)
    const next = walls[(i + 1) % walls.length];
    if (walls.length > 2 && next) {
      const ang = cornerAngleDeg(w, next);
      if (ang != null && Math.abs(ang - 90) > 0.8) {
        const [ex, ey] = b;
        angles += `<text class="ang" x="${n1(ex - nx * 22)}" y="${n1(ey - ny * 22)}" text-anchor="middle" dominant-baseline="central">${esc(iso(ang + '°'))}</text>`;
      }
    }
  });

  // overall bounding dimensions (outer chain) — width below, height at side.
  // Only when a single wall does NOT already span that axis (else it is an exact
  // duplicate of a wall-length dim, e.g. a plain rectangular room). This gives a
  // clean nested chain on complex rooms and no redundant numbers on simple ones.
  const bl = P(minX, minY), br = P(maxX, minY), tl = P(minX, maxY);
  const outer = thickPx / 2 + 78;
  let maxWallDX = 0, maxWallDY = 0;
  for (const w of walls) {
    maxWallDX = Math.max(maxWallDX, Math.abs(w.position.endX - w.position.startX));
    maxWallDY = Math.max(maxWallDY, Math.abs(w.position.endY - w.position.startY));
  }
  let overall = '';
  if (maxWallDX < spanX * 0.98) overall += dim(br, bl, [0, 1], outer, cm(spanX), { bold: true });
  if (maxWallDY < spanY * 0.98) overall += dim(bl, tl, [-1, 0], outer, cm(spanY), { bold: true });

  // element callouts — colored disc + white number, nudged into the room
  let dots = '';
  const groups = new Map();
  for (const e of indexed.items) {
    if (!e.wall.position) continue;
    const v = wallVec(e.wall);
    const px = e.wall.position.startX + v.ux * e.along;
    const py = e.wall.position.startY + v.uy * e.along;
    // nudge toward centroid so the disc sits off the poché
    let inx = cx0 - px, iny = cy0 - py; const il = Math.hypot(inx, iny) || 1;
    const [dx0, dy0] = P(px + (inx / il) * (thickPx / scale) * 0.9, py + (iny / il) * (thickPx / scale) * 0.9);
    dots += `<g class="cal" data-group="${esc(e.r.group)}"><circle cx="${n1(dx0)}" cy="${n1(dy0)}" r="11" fill="${e.r.color}" stroke="#fff" stroke-width="2"/>`
      + `<text class="caln" x="${n1(dx0)}" y="${n1(dy0 + 0.5)}" text-anchor="middle" dominant-baseline="central">${esc(iso(e.idx))}</text></g>`;
    if (!groups.has(e.r.group)) groups.set(e.r.group, e.r.color);
  }

  // scale bar (accurate regardless of print zoom)
  const barMm = niceStep(spanX) >= 1000 ? 1000 : niceStep(spanX);
  const barPx = barMm * scale;
  const sbx = pad, sby = VH - 30;
  let scaleBar = `<g class="sbar"><line x1="${n1(sbx)}" y1="${sby}" x2="${n1(sbx + barPx)}" y2="${sby}"/>`
    + `<line x1="${n1(sbx)}" y1="${sby - 5}" x2="${n1(sbx)}" y2="${sby + 5}"/>`
    + `<line x1="${n1(sbx + barPx)}" y1="${sby - 5}" x2="${n1(sbx + barPx)}" y2="${sby + 5}"/>`
    + `<rect x="${n1(sbx)}" y="${sby - 5}" width="${n1(barPx / 2)}" height="5" fill="${BRAND.ink}"/>`
    + `<text class="sbar-t" x="${n1(sbx + barPx / 2)}" y="${sby - 10}" text-anchor="middle">${esc(iso(cm(barMm) + ' ס״מ'))}</text></g>`;

  // entrance-direction marker (top-left) — the REAL entrance the surveyor set,
  // NOT north. Graceful neutral marker when the field is absent.
  const north = entranceMarker(room, P, cx0, cy0);

  // units note
  const note = `<text class="units" x="${VW - 20}" y="${VH - 16}" text-anchor="end">כל המידות בס״מ</text>`;

  const svg = `<svg class="plan" viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" role="img">`
    + `<rect class="paper" x="0" y="0" width="${VW}" height="${VH}"/>`
    + `<g class="l-floor">${floor}</g>`
    + `<g class="l-wall">${poche}</g>`
    + `<g class="l-dim">${dims}${overall}${angles}</g>`
    + `<g class="l-cal">${dots}</g>`
    + scaleBar + north + note
    + `</svg>`;
  return { svg, groups };
}

// Classify a placed element: openings/large items are dimensioned by edges
// (near-edge from corner + full width + full height + sill), point items are
// dimensioned to their centre (from corner + height above floor).
function isOpeningElem(e) {
  if (e.decorative) return true; // beams / panels / columns / ceiling-drops
  const sz = e.item.size || {};
  if ((sz.width || 0) >= 400 || (sz.height || 0) >= 400) return true;
  return /חלון|דלת|מפתח|פתח|ארון|עמוד|קור|פאנל|הנמכ|בטון|קונס|מקלח|כיור|תנור|מקרר|מדיח|כביסה/.test(String(e.r.he || ''));
}

// ---------------------------------------------------------------------------
// ELEVATION SVG — one wall as length×height with every element dimensioned
// EXPLICITLY and SEPARATELY (owner rule: zero mental math). Each thing the
// carpenter needs is its own directly-readable dimension line with the final
// number on it — no cumulative/running chains, nothing to add or subtract:
//   • point elements (socket/switch/light/water/gas/drain/junction) → two
//     explicit numbers: distance from the nearest corner to the CENTRE, and
//     height from the FLOOR to the centre.
//   • openings/large (window/door/מפתח/cabinet/column/panel/beam) → distance
//     from the nearest corner to the near edge, full WIDTH, full HEIGHT, sill
//     height from floor; windows also head→ceiling — each on its own line.
//   • the wall → one clear full width + one clear full height.
// ---------------------------------------------------------------------------
function elevationSvg(wall, elems) {
  const VW = 1040;
  const padL = 100, padR = 120, padT = 64;
  const d = wall.dimensions || {};
  const length = d.length || (wall.position ? wallVec(wall).len : 0) || 1000;
  const height = d.height || 2500;
  const sorted = [...elems].sort((a, b) => a.along - b.along);
  const N = sorted.length;

  // position-dimension rows stack below the floor, one explicit row per element.
  const rowBase = 30, rowStep = 24;
  const widthOff = rowBase + N * rowStep + 20;
  const padB = widthOff + 46;

  const availW = VW - padL - padR;
  const scale = Math.min(availW / length, 380 / height);
  const wpx = length * scale, hpx = height * scale;
  const ox = padL + (availW - wpx) / 2;
  const padTop = padT, floorY = padTop + hpx;
  const VH = padTop + hpx + padB;
  const Pe = (x, yb) => [ox + x * scale, floorY - yb * scale];

  // wall face + floor/ceiling emphasis
  let body = `<rect class="wallface" x="${n1(ox)}" y="${n1(padTop)}" width="${n1(wpx)}" height="${n1(hpx)}"/>`;
  body += `<line class="floor" x1="${n1(ox)}" y1="${n1(floorY)}" x2="${n1(ox + wpx)}" y2="${n1(floorY)}"/>`;
  body += `<line class="ceil" x1="${n1(ox)}" y1="${n1(padTop)}" x2="${n1(ox + wpx)}" y2="${n1(padTop)}"/>`;
  body += `<text class="face-t" x="${n1(ox + wpx / 2)}" y="${n1(floorY + 18)}" text-anchor="middle">רצפה</text>`;

  // small helpers built on the shared dim() engine — every call renders ONE
  // explicit dimension line (witness lines + tick + upright haloed value).
  const vdim = (xmm, y0, y1, side, off, label, opts) => dim(Pe(xmm, y0), Pe(xmm, y1), [side, 0], off, label, opts);
  const hdim = (x0, x1, ymm, ud, off, label, opts) => dim(Pe(x0, ymm), Pe(x1, ymm), [0, ud], off, label, opts);

  let els = '', pos = '', edims = '';
  sorted.forEach((e, i) => {
    const sz = e.item.size || {};
    const w = sz.width || 100;
    const h = (e.decorative ? (sz.height || 300) : (sz.height || 100));
    const opening = isOpeningElem(e);
    const leftX = e.decorative ? e.along - w / 2 : e.along;
    const rightX = leftX + w;
    const centerX = leftX + w / 2;
    const base = e.up, top = e.up + h;

    // element rectangle + numbered badge
    const [rx, ry] = Pe(leftX, top);
    const rw = Math.max(16, w * scale), rh = Math.max(16, h * scale);
    const bcx = rx + Math.min(13, rw / 2), bcy = ry + Math.min(13, rh / 2);
    els += `<g class="el" data-group="${esc(e.r.group)}">`
      + `<rect x="${n1(rx)}" y="${n1(ry)}" width="${n1(rw)}" height="${n1(rh)}" fill="${e.r.color}" fill-opacity="0.20" stroke="${e.r.color}" stroke-width="1.6"/>`
      + `<circle cx="${n1(bcx)}" cy="${n1(bcy)}" r="10" fill="${e.r.color}" stroke="#fff" stroke-width="1.6"/>`
      + `<text class="caln" x="${n1(bcx)}" y="${n1(bcy + 0.5)}" text-anchor="middle" dominant-baseline="central">${esc(iso(e.idx))}</text>`
      + `</g>`;

    // (1) horizontal position from NEAREST corner — its own explicit row.
    const rowOff = rowBase + i * rowStep;
    let refX, cornerX, val;
    if (opening) {
      if (centerX <= length / 2) { cornerX = 0; refX = leftX; val = leftX; }
      else { cornerX = length; refX = rightX; val = length - rightX; }
    } else {
      refX = centerX;
      if (centerX <= length / 2) { cornerX = 0; val = centerX; }
      else { cornerX = length; val = length - centerX; }
    }
    val = Math.max(0, val);
    pos += hdim(cornerX, refX, 0, 1, rowOff, cm(val), {});

    // (2) per-element size / height dimensions — all explicit, floor-referenced.
    if (opening) {
      // full WIDTH — above the element if there's headroom, else just inside top
      const roomAbove = (height - top) * scale >= 18;
      edims += hdim(leftX, rightX, top, roomAbove ? -1 : 1, roomAbove ? 11 : 14, cm(w), {});
      // full HEIGHT — at the right edge
      edims += vdim(rightX, base, top, 1, 12, cm(h), {});
      // SILL height from floor — at the left edge (only if raised off the floor)
      if (base > 20) edims += vdim(leftX, 0, base, -1, 12, cm(base), {});
      // window head → ceiling — separate line further out on the right
      if (base > 20 && (height - top) > 20) edims += vdim(rightX, top, height, 1, 34, cm(height - top), {});
    } else {
      // point element — explicit height from floor to CENTRE
      edims += vdim(centerX, 0, base + h / 2, 1, 10, cm(base + h / 2), {});
    }
  });

  // (3) the wall itself — one clear full width, one clear full height.
  let wdims = vdim(0, 0, height, -1, 42, cm(height), { bold: true });        // full height (left)
  wdims += hdim(0, length, 0, 1, widthOff, cm(length), { bold: true });      // full width (bottom)

  if (!N) body += `<text class="empty-el" x="${n1(ox + wpx / 2)}" y="${n1(padTop + hpx / 2)}" text-anchor="middle" dominant-baseline="central">אין אלמנטים על קיר זה</text>`;

  const note = `<text class="units" x="${VW - 20}" y="${VH - 12}" text-anchor="end">כל המידות בס״מ · כל מידה מפורשת (ללא חיבור)</text>`;
  const svg = `<svg class="elev" viewBox="0 0 ${VW} ${n1(VH)}" xmlns="http://www.w3.org/2000/svg" role="img">`
    + `<rect class="paper" x="0" y="0" width="${VW}" height="${n1(VH)}"/>`
    + body + els
    + `<g class="l-dim">${wdims}${pos}${edims}</g>`
    + note
    + `</svg>`;
  return svg;
}

// ===========================================================================
// CARPENTER PLANNING ENGINE (HOME dashboard 2026-08-21)
// ---------------------------------------------------------------------------
// The report's reader is a furniture-manufacturing carpenter (נגר יצרן ריהוט)
// planning each piece against THIS room. He asks, per wall/zone: "what is my
// buildable envelope, and which services / openings constrain what I put here?"
// These helpers derive that brief straight from the .sol room model.
// ===========================================================================

// Footprint of a placed element along the wall (mm). Decorative openings are
// centred on their position (matches the elevation engine); others left-anchored.
function footprint(e) {
  const sz = e.item.size || {};
  const w = sz.width || 100;
  const leftX = e.decorative ? e.along - w / 2 : e.along;
  return { w, leftX, rightX: leftX + w, centerX: leftX + w / 2, up: e.up, h: sz.height || 100 };
}

// Planning role of an element on a wall:
//   window / door  → opening: interrupts a full-height carpentry run (window
//                    still allows a base unit below the sill).
//   column         → solid obstruction: interrupts the run at any height.
//   ceilingDrop    → reduces clear HEIGHT over a span (bulkhead/soffit).
//   service        → socket/switch/water/gas/drain/AC/comms: needs a CUTOUT but
//                    a cabinet can still sit over it (does NOT break the run).
function roleOf(e) {
  const he = String(e.r.he || '');
  const t = String(e.item.type || '');
  if (/חלון/.test(he) || t === 'Window') return 'window';
  if (/דלת|מפתח|פתח(?!ל)/.test(he) || t === 'Door') return 'opening';
  if (/עמוד|קונס|בטון|קור(?!ה)/.test(he)) return 'column';
  if (/הנמכ/.test(he)) return 'ceilingDrop';
  return 'service';
}
const BLOCKS_RUN = { window: true, opening: true, column: true };

// Largest uninterrupted gap on [0,length] given blocker intervals (merged).
function largestClearSpan(length, blockers) {
  const iv = blockers.map((b) => [Math.max(0, Math.min(length, b.l)), Math.max(0, Math.min(length, b.r))])
    .filter(([l, r]) => r > l).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [l, r] of iv) {
    if (merged.length && l <= merged[merged.length - 1][1]) merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r);
    else merged.push([l, r]);
  }
  const gaps = []; let prev = 0;
  for (const [l, r] of merged) { if (l > prev) gaps.push([prev, l]); prev = Math.max(prev, r); }
  if (prev < length) gaps.push([prev, length]);
  if (!merged.length) gaps.push([0, length]);
  let best = { start: 0, end: 0, w: 0 };
  for (const [s, e] of gaps) if (e - s > best.w) best = { start: s, end: e, w: e - s };
  return best;
}

// Full planning analysis of one wall.
function analyzeWall(wall, elems) {
  const d = wall.dimensions || {};
  const length = d.length || (wall.position ? wallVec(wall).len : 0) || 1000;
  const height = d.height || 2500;
  const items = elems.map((e) => { const fp = footprint(e); return { e, ...fp, role: roleOf(e) }; });
  const blockers = items.filter((x) => BLOCKS_RUN[x.role]).map((x) => ({ l: x.leftX, r: x.rightX, role: x.role, x }));
  const services = items.filter((x) => x.role === 'service');
  const openings = items.filter((x) => x.role === 'window' || x.role === 'opening');
  const columns = items.filter((x) => x.role === 'column');
  const drops = items.filter((x) => x.role === 'ceilingDrop');
  const clear = largestClearSpan(length, blockers);
  // lowest clear height under any bulkhead (soffit sits its own height below ceiling)
  let minClearHeight = height;
  for (const dp of drops) minClearHeight = Math.min(minClearHeight, dp.up);
  return { wall, length, height, items, blockers, services, openings, columns, drops, clear, minClearHeight };
}

// Squareness / straightness check — critical for fitted furniture.
function analyzeSquareness(room) {
  const walls = (room.walls || []).filter((w) => w.position);
  const issues = [];
  if (walls.length > 2) {
    for (let i = 0; i < walls.length; i++) {
      const next = walls[(i + 1) % walls.length];
      const ang = cornerAngleDeg(walls[i], next);
      if (ang != null && Math.abs(ang - 90) > 1.0) issues.push({ type: 'corner', wall: next.number, ang });
    }
  }
  if (walls.length === 4) {
    const L = walls.map((w) => (w.dimensions && w.dimensions.length) || wallVec(w).len);
    if (Math.abs(L[0] - L[2]) > 10) issues.push({ type: 'parallel', pair: [walls[0].number, walls[2].number], d: Math.abs(L[0] - L[2]) });
    if (Math.abs(L[1] - L[3]) > 10) issues.push({ type: 'parallel', pair: [walls[1].number, walls[3].number], d: Math.abs(L[1] - L[3]) });
  }
  return { square: issues.length === 0, issues };
}

// Whole-room brief.
function analyzeRoom(room, indexed) {
  const walls = (room.walls || []).filter((w) => w.position);
  const perWall = walls.map((w) => analyzeWall(w, indexed.items.filter((e) => e.wall === w)));
  const ceiling = Math.max(0, ...walls.map((w) => (w.dimensions && w.dimensions.height) || 0)) || 2500;
  let area = 0; const pts = walls.map((w) => [w.position.startX, w.position.startY]);
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; area += x1 * y2 - x2 * y1; }
  area = Math.abs(area) / 2;
  const squareness = analyzeSquareness(room);
  let maxRun = { w: 0, wall: null };
  for (const wa of perWall) if (wa.clear.w > maxRun.w) maxRun = { w: wa.clear.w, wall: wa.wall.number, wa };
  return { room, walls, perWall, ceiling, areaM2: area / 1e6, squareness, maxRun };
}

// Infer carpentry zones from the services present. Kitchen = water+gas; vanity =
// water+drainage (no gas). One generic proposed zone on the single largest clear
// wall (services-only), so we suggest without over-proposing.
function inferZones(ra) {
  const zones = [];
  const plumbingWalls = new Set();
  for (const wa of ra.perWall) {
    const hasWater = wa.services.some((s) => /מים|ברז|צינור|דוד/.test(s.e.r.he));
    const hasGas = wa.services.some((s) => /גז/.test(s.e.r.he));
    const hasDrain = wa.items.some((x) => /ניקוז|ביוב|נקז/.test(x.e.r.he));
    if (hasWater && hasGas) { zones.push({ wa, kind: 'מטבח', conf: 'מזוהה' }); plumbingWalls.add(wa.wall.number); }
    else if (hasWater && hasDrain) { zones.push({ wa, kind: 'ארון אמבטיה / כיור', conf: 'מזוהה' }); plumbingWalls.add(wa.wall.number); }
  }
  // one generic proposed zone on the largest clear wall not already claimed
  const cand = ra.perWall
    .filter((wa) => !plumbingWalls.has(wa.wall.number) && wa.clear.w >= 1800)
    .sort((a, b) => b.clear.w - a.clear.w)[0];
  if (cand) zones.push({ wa: cand, kind: 'אזור נגרות מוצע (יחידת קיר / ארון)', conf: 'מוצע' });
  return zones;
}

// ---------------------------------------------------------------------------
// PER-WALL PLANNING STRIP — a mini elevation of the buildable envelope: the
// clear W×H face, openings/columns hatched as run-breakers (to scale, with sill/
// head), bulkheads as a top band, service points as numbered discs at their real
// height, and the LARGEST CLEAR SPAN marked with a green band + dimension.
// ---------------------------------------------------------------------------
function wallPlanStrip(wa) {
  const VW = 1040, padL = 96, padR = 96, padT = 58, padB = 76;
  const { length, height } = wa;
  const availW = VW - padL - padR;
  const scale = Math.min(availW / length, 288 / height);
  const wpx = length * scale, hpx = height * scale;
  const ox = padL + (availW - wpx) / 2;
  const topY = padT, floorY = topY + hpx;
  const VH = topY + hpx + padB;
  const X = (x) => ox + x * scale;
  const Y = (yb) => floorY - yb * scale;

  // buildable envelope (subtle green wash = "you can build here")
  let body = `<rect class="env" x="${n1(ox)}" y="${n1(topY)}" width="${n1(wpx)}" height="${n1(hpx)}"/>`;
  body += `<line class="floor" x1="${n1(ox)}" y1="${n1(floorY)}" x2="${n1(ox + wpx)}" y2="${n1(floorY)}"/>`;
  body += `<line class="ceil" x1="${n1(ox)}" y1="${n1(topY)}" x2="${n1(ox + wpx)}" y2="${n1(topY)}"/>`;
  body += `<text class="face-t" x="${n1(ox + wpx / 2)}" y="${n1(floorY + 16)}" text-anchor="middle">רצפה</text>`;
  body += `<text class="face-t" x="${n1(ox + wpx / 2)}" y="${n1(topY - 6)}" text-anchor="middle">תקרה</text>`;

  const vdim = (xmm, y0, y1, side, off, label, opts) => dim([X(xmm), Y(y0)], [X(xmm), Y(y1)], [side, 0], off, label, opts);
  const hdim = (x0, x1, ymm, ud, off, label, opts) => dim([X(x0), Y(ymm)], [X(x1), Y(ymm)], [0, ud], off, label, opts);

  // bulkheads / ceiling drops — hatched band hanging from the ceiling
  let drops = '';
  for (const dp of wa.drops) {
    const l = Math.max(0, dp.leftX), r = Math.min(length, dp.rightX);
    const dh = (height - dp.up); // depth of the soffit below ceiling
    const [rx, ry] = [X(l), Y(height)];
    drops += `<rect class="drop" x="${n1(rx)}" y="${n1(ry)}" width="${n1((r - l) * scale)}" height="${n1(dh * scale)}"/>`
      + `<text class="drop-t" x="${n1(X((l + r) / 2))}" y="${n1(Y(height - dh / 2))}" text-anchor="middle" dominant-baseline="central">הנמכה · פנוי ${esc(iso(cm(dp.up)))}</text>`;
  }

  // openings + columns — hatched run-breakers, dimensioned (width, and sill/head for windows)
  let blocks = '';
  for (const b of wa.blockers) {
    const x = b.x; const l = Math.max(0, x.leftX), r = Math.min(length, x.rightX);
    const base = (b.role === 'window') ? x.up : 0;
    const top = (b.role === 'column') ? height : (x.up + x.h);
    const [rx, ry] = [X(l), Y(top)];
    const rw = (r - l) * scale, rh = (top - base) * scale;
    const cls = b.role === 'column' ? 'blk blk-col' : (b.role === 'window' ? 'blk blk-win' : 'blk blk-door');
    const lbl = b.role === 'column' ? 'עמוד' : (b.role === 'window' ? 'חלון' : 'פתח');
    blocks += `<rect class="${cls}" x="${n1(rx)}" y="${n1(ry)}" width="${n1(rw)}" height="${n1(rh)}"/>`
      + `<text class="blk-t" x="${n1(rx + rw / 2)}" y="${n1(ry + rh / 2)}" text-anchor="middle" dominant-baseline="central">${esc(lbl)} ${esc(iso(cm(x.w)))}</text>`;
    // width dim above, and sill height for windows on the left edge
    blocks += hdim(l, r, top, -1, 10, cm(x.w), {});
    if (base > 20) blocks += vdim(l, 0, base, -1, 11, cm(base), {});
  }

  // service discs at real height (numbered) — cutouts, do NOT break the run
  let svc = '';
  for (const s of wa.services) {
    const cxp = X(s.centerX), cyp = Y(s.up);
    svc += `<g class="cal" data-group="${esc(s.e.r.group)}">`
      + `<circle cx="${n1(cxp)}" cy="${n1(cyp)}" r="10" fill="${s.e.r.color}" stroke="#fff" stroke-width="1.6"/>`
      + `<text class="caln" x="${n1(cxp)}" y="${n1(cyp + 0.5)}" text-anchor="middle" dominant-baseline="central">${esc(iso(s.e.idx))}</text></g>`;
  }

  // the buildable envelope dims (bold) — the whole wall face is the neutral
  // planning surface; the carpenter decides what sits where (no inferred "run").
  let dims = vdim(0, 0, height, -1, 40, cm(height), { bold: true });
  dims += hdim(0, length, 0, 1, 44, cm(length), { bold: true });

  const note = `<text class="units" x="${VW - 16}" y="${n1(VH - 10)}" text-anchor="end">מידות בס״מ</text>`;
  return `<svg class="strip" viewBox="0 0 ${VW} ${n1(VH)}" xmlns="http://www.w3.org/2000/svg" role="img">`
    + `<rect class="paper" x="0" y="0" width="${VW}" height="${n1(VH)}"/>`
    + body + drops + blocks + svc
    + `<g class="l-dim">${dims}</g>` + note + `</svg>`;
}

// ---------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------
// Brand mark — locked Poppins wordmark (owner decision). `kind`: 'hdr'
// (page/toolbar header) or 'xl' (cover).
function wordmark(kind) {
  const xl = kind === 'xl';
  return `<span class="wm wm-${xl ? 'xl' : 'hdr'}" role="img" aria-label="soline — smart spatial solutions">`
    + `<span class="wm-name">soline</span>`
    + `<span class="wm-tag">${esc(WORDMARK_TAGLINE)}</span>`
    + `</span>`;
}

function pageWrap(n, total, subtitle, bodyHtml, jobName, id) {
  return `<section class="page"${id ? ` id="${id}"` : ''}>`
    + `<header class="pg-head">${wordmark('hdr')}<span class="pg-sub">${esc(subtitle || '')}</span>`
    + `<span class="pg-job">${esc(jobName || '')}</span></header>`
    + `<div class="pg-body">${bodyHtml}</div>`
    + `<footer class="pg-foot"><span>Soline · דו״ח מדידה</span><span>${esc(iso('עמ׳ ' + n + ' / ' + total))}</span></footer>`
    + `</section>`;
}

function statusOf(model) {
  // "closed" if every room's wall loop returns to its origin.
  const rooms = model.rooms || [];
  let closed = rooms.length > 0;
  for (const r of rooms) {
    const ws = (r.walls || []).filter((w) => w.position);
    if (ws.length < 3) { closed = false; break; }
    const a = ws[0].position, b = ws[ws.length - 1].position;
    if (Math.hypot(b.endX - a.startX, b.endY - a.startY) > 5) { closed = false; break; }
  }
  return closed ? { label: 'סגור ומאומת', color: BRAND.green, bg: '#E7F3EE' }
    : { label: 'טיוטה', color: BRAND.amber, bg: '#FDF3E0' };
}

function coverPage(model, stats, status) {
  const job = (model.job && model.job.name) || 'פרויקט ללא שם';
  const client = (model.customer && model.customer.name) || '—';
  const created = model.created ? String(model.created).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const ver = model.productVersion || 'Soline Measure';
  const rows = [
    ['פרויקט', job],
    ['לקוח', client],
    ['תאריך מדידה', created],
    ['מקור', ver],
    ['יחידות', 'ס״מ (מ״מ במקור)'],
  ];
  const body =
    `<div class="cover">`
    + `<div class="cover-brand">${wordmark('xl')}<div class="cover-tag">מערכת מדידה ותכנון</div></div>`
    + `<div class="cover-title">דו״ח מדידת חדר</div>`
    + `<div class="cover-jobname">${esc(job)}</div>`
    + `<span class="badge" style="color:${status.color};background:${status.bg};border-color:${status.color}">${esc(status.label)}</span>`
    + `<div class="cover-stats">`
    + statTile(stats.rooms, 'חדרים') + statTile(stats.walls, 'קירות')
    + statTile(stats.elements, 'אלמנטים') + statTile(stats.perimeterCm + ' ס״מ', 'היקף')
    + `</div>`
    + `<table class="cover-info"><tbody>`
    + rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join('')
    + `</tbody></table>`
    + `<div class="cover-foot">מסמך זה הופק אוטומטית ממדידת השטח. יש לאמת מידות קריטיות בשטח לפני ייצור.</div>`
    + `</div>`;
  return pageWrap(1, stats.totalPages, 'עמוד שער', body, job, 'p-cover');
}
function statTile(n, l) { return `<div class="tile"><div class="tn">${esc(iso(n))}</div><div class="tl">${esc(l)}</div></div>`; }

// ===========================================================================
// HOME = CARPENTER PLANNING DASHBOARD (replaces the old stats cover as page 1)
// ===========================================================================
function vitalTile(big, label, sub, tone) {
  return `<div class="vtile ${tone || ''}"><div class="vt-n">${esc(iso(big))}</div>`
    + `<div class="vt-l">${esc(label)}</div>${sub ? `<div class="vt-s">${esc(iso(sub))}</div>` : ''}</div>`;
}

// --- space configuration + height sweep + closures (v2 vitals methodology) ---
function spaceConfig(room) {
  const walls = (room.walls || []).filter((w) => w.position);
  const n = walls.length;
  let closed = false;
  if (n >= 3) { const a = walls[0].position, b = walls[n - 1].position; closed = Math.hypot(b.endX - a.startX, b.endY - a.startY) <= 8; }
  const typeName = n === 0 ? 'ללא קירות' : n === 1 ? 'חזית בודדת' : n === 2 ? 'פינה (2 חזיתות)'
    : n === 3 ? 'תצורת-U / נישה (3 חזיתות)' : n === 4 ? 'חדר (4 חזיתות)' : `חדר מרובה-פאות (${n} חזיתות)`;
  return { n, closed, typeName };
}
function heightSweep(room) {
  const hs = (room.walls || []).map((w) => w.dimensions && w.dimensions.height).filter((v) => v != null && v > 0);
  if (!hs.length) return { min: null, max: null, uniform: true };
  const min = Math.min(...hs), max = Math.max(...hs);
  return { min, max, uniform: Math.abs(max - min) < 1 };
}
// closure amount is projected over a reference cabinet depth so it reads as a real
// scribe/closure width the carpenter can plan.
const CLOSURE_DEPTH = 600;
function analyzeClosures(room) {
  const walls = (room.walls || []).filter((w) => w.position);
  const n = walls.length; const sc = spaceConfig(room);
  const cornerCount = sc.closed ? n : Math.max(0, n - 1);
  const list = [];
  for (let i = 0; i < cornerCount; i++) {
    const a = walls[i], b = walls[(i + 1) % n]; if (!b) break;
    const ang = cornerAngleDeg(a, b); if (ang == null) continue;
    const dev = ang - 90;
    const state = Math.abs(dev) < 0.5 ? 'square' : (ang < 90 ? 'converging' : 'diverging');
    const deltaMm = Math.abs(Math.tan(Math.abs(dev) * Math.PI / 180) * CLOSURE_DEPTH);
    list.push({ corner: i + 1, wallA: a.number, wallB: b.number, ang: Math.round(ang * 10) / 10, dev: Math.round(dev * 10) / 10, state, deltaMm });
  }
  return { list, anyDev: list.some((c) => c.state !== 'square') };
}
function closureImplication(c) {
  if (c.state === 'square') return 'ניצבת ~90° — אין צורך בהתאמת-סגירה';
  if (c.state === 'converging') return `נסגרת (${c.ang}°) — הגב צר יותר · רוחב חיצוני > פנימי · להוסיף סרגל-סגירה/שפה בחזית הפתוחה ~${cm(c.deltaMm)} ס״מ (על עומק 60)`;
  return `נפתחת (${c.ang}°) — הפנים רחב יותר · רוחב פנימי > חיצוני ~${cm(c.deltaMm)} ס״מ (על עומק 60)`;
}
function futureChangesList(model, room) {
  const raw = (room && room.futureChanges) || model.futureChanges || [];
  return Array.isArray(raw) ? raw : [];
}
function futureChangesPanel(fc) {
  if (!fc.length) return `<div class="panel"><div class="panel-h">שינויים עתידיים בקירות</div>`
    + `<div class="panel-empty">לא סומנו שינויים עתידיים · <b>שדה app-lane — טרם נמדד</b></div></div>`;
  const rows = fc.map((c) => {
    const scope = c.scope === 'wall' ? ('חזית ' + (c.ref != null ? c.ref : '')) : c.scope === 'room' ? 'כל החדר' : (c.ref || '—');
    return `<li><span class="fc-scope">${esc(scope)}</span> ${esc(c.text || '')}</li>`;
  }).join('');
  return `<div class="panel"><div class="panel-h">שינויים עתידיים בקירות</div><ul class="fc-list">${rows}</ul></div>`;
}

// ===========================================================================
// PAGE 1 — תמצית (VITALS) : new carpenter methodology
// ===========================================================================
function vitalsPage(model, room, indexed, pageNo, total, jobName, status, id) {
  const ra = analyzeRoom(room, indexed);
  const sc = spaceConfig(room);
  const hs = heightSweep(room);
  const cl = analyzeClosures(room);
  const fc = futureChangesList(model, room);
  const conv = cl.list.filter((c) => c.state === 'converging').length;
  const dvg = cl.list.filter((c) => c.state === 'diverging').length;
  const job = (model.job && model.job.name) || '—';
  const client = (model.customer && model.customer.name) || '—';
  const created = model.created ? String(model.created).slice(0, 10) : new Date().toISOString().slice(0, 10);

  const heightBig = hs.min != null ? `${cm(hs.min)} / ${cm(hs.max)} ס״מ` : '—';
  const heightSub = hs.min == null ? 'לא נמדד' : (hs.uniform ? 'גובה אחיד · מסריקת-גבהים' : 'המינ׳ הוא הגובה הקובע · מסריקת-גבהים');
  const areaTile = (sc.closed && sc.n >= 3)
    ? vitalTile(ra.areaM2.toFixed(1) + ' מ״ר', 'שטח כולל', 'פוליגון מוקף (shoelace)', 'accent')
    : vitalTile('—', 'שטח כולל', `מעטפת פתוחה — שטח לא-מוקף (${sc.n} חזיתות נמדדו)`, 'muted');
  const closSub = cl.list.length ? (cl.anyDev ? `${conv} נסגרות · ${dvg} נפתחות` : 'כל הפינות ~90°') : 'אין פינות סגורות';

  const meta = `<div class="info-strip">`
    + `<span><b>פרויקט:</b> ${esc(job)}</span>`
    + `<span><b>לקוח:</b> ${esc(client)}</span>`
    + `<span><b>תאריך:</b> ${esc(iso(created))}</span>`
    + `<span><b>חדר:</b> ${esc(room.name || '—')}</span>`
    + `<span class="badge" style="color:${status.color};background:${status.bg};border-color:${status.color}">${esc(status.label)}</span>`
    + `</div>`;
  const tiles = `<div class="vitals">`
    + vitalTile(heightBig, 'גובה תקרה (מינ׳ / מקס׳)', heightSub, 'accent')
    + vitalTile(sc.typeName, 'תצורת-חלל', `${sc.n} חזיתות · ${sc.closed ? 'סגור' : 'פתוח'}`, 'accent')
    + areaTile
    + vitalTile(cl.anyDev ? 'דרושה סגירה' : 'ניצב', 'סגירות (פינות)', closSub, cl.anyDev ? 'warn' : 'ok')
    + `</div>`;
  const ent = entranceLabelText(room);
  const flags = `<div class="card card-flags"><div class="flags"><span class="drawflag ${sc.closed ? 'df-closed' : 'df-open'}">השרטוט: ${sc.closed ? 'סגור' : 'פתוח'}</span>`
    + `<span class="drawflag df-neutral">${esc(iso(sc.n + ' חזיתות נמדדו'))}</span>`
    + (hs.min != null ? `<span class="drawflag df-neutral">גובה קובע: ${esc(iso(cm(hs.min) + ' ס״מ'))}</span>` : '')
    + `<span class="drawflag ${ent.defined ? 'df-neutral' : 'df-open'}">${esc(ent.text)}</span>`
    + `</div></div>`;
  const body = `<h2 class="sec-h">תמצית תכנון <span class="sec-sub">— ${esc(room.name || 'חדר')}</span></h2>`
    + meta + tiles + flags + futureChangesPanel(fc);
  return pageWrap(pageNo, total, 'תמצית', body, jobName, id);
}

// ===========================================================================
// PAGE 2 — אילוצי תכנון (own page, before drawings)
// ===========================================================================
function constraintsPage(model, room, indexed, pageNo, total, jobName, id) {
  const ra = analyzeRoom(room, indexed);
  const cl = analyzeClosures(room);
  const clRows = cl.list.map((c) => {
    const stateCls = c.state === 'converging' ? 'cs-conv' : c.state === 'diverging' ? 'cs-div' : 'cs-sq';
    const stateLbl = c.state === 'converging' ? 'נסגרת' : c.state === 'diverging' ? 'נפתחת' : 'ניצבת';
    return `<li class="cl ${stateCls}"><span class="cl-c">פינה ${esc(iso(c.corner))} · חזיתות ${esc(iso(c.wallA + '–' + c.wallB))}</span>`
      + `<span class="cl-s">${esc(stateLbl)} ${esc(iso(c.ang + '°'))}</span>`
      + `<span class="cl-i">${esc(closureImplication(c))}</span></li>`;
  }).join('');
  const closuresBlock = `<div class="panel"><div class="panel-h">סגירות פינות — כמה שוליים לתכנן</div>`
    + (cl.list.length ? `<ul class="cl-list">${clRows}</ul>` : `<div class="panel-empty">אין פינות סגורות (מעטפת פתוחה / קיר בודד)</div>`)
    + `<div class="panel-note">נסגרת = הגב צר מהחזית → להוסיף סרגל-סגירה/שפה בחזית הפתוחה · נפתחת = הפנים רחב מהחוץ. הסטייה מחושבת על עומק 60 ס״מ.</div></div>`;
  const items = [];
  for (const wa of ra.perWall) for (const dp of wa.drops) items.push({ tone: 'warn', t: `חזית ${wa.wall.number}: הנמכת-תקרה — גובה פנוי ${cm(dp.up)} ס״מ (במקום ${cm(wa.height)}). להתאים גובה יחידה עליונה.` });
  for (const wa of ra.perWall) for (const c of wa.columns) items.push({ tone: 'warn', t: `חזית ${wa.wall.number}: עמוד/בליטה ${cm(c.w)}×${cm(c.h)} — מפצל את הקיר; לתכנן סביבו.` });
  for (const wa of ra.perWall) for (const o of wa.openings) if (o.role === 'window' && o.up > 200) items.push({ tone: 'info', t: `חזית ${wa.wall.number}: חלון בגובה סף ${cm(o.up)} ס״מ — ניתן יחידת בסיס מתחתיו עד לסף.` });
  const svcCount = ra.perWall.reduce((n, wa) => n + wa.services.length, 0);
  if (svcCount) items.push({ tone: 'info', t: `${svcCount} נקודות-שירות דורשות חיתוכים/מעברים בגב היחידות — ראה עמודי מעטפת-בנייה לכל קיר.` });
  if (!items.length) items.push({ tone: 'ok', t: 'לא זוהו אילוצים פיזיים מיוחדים מעבר לסגירות הפינות.' });
  const physBlock = `<div class="constraints"><div class="cn-h">אילוצים פיזיים</div><ul class="cn-list">`
    + items.map((i) => `<li class="cn cn-${i.tone}"><span class="cn-dot"></span>${esc(i.t)}</li>`).join('') + `</ul></div>`;
  const body = `<h2 class="sec-h">אילוצי תכנון <span class="sec-sub">— ${esc(room.name || 'חדר')}</span></h2>`
    + closuresBlock + physBlock;
  return pageWrap(pageNo, total, 'אילוצי תכנון', body, jobName, id);
}

// ===========================================================================
// §A.4 — מעטפת-בנייה : ONE WALL PER PAGE
// ===========================================================================
function envelopePage(wa, closures, pageNo, total, jobName, roomName, id) {
  const wall = wa.wall; const d = wall.dimensions || {};
  const ang = wall.position ? Math.round(wall.position.angle) : null;
  const cornerNotes = closures.list.filter((c) => c.wallA === wall.number || c.wallB === wall.number)
    .map((c) => `פינה ${c.corner} (עם חזית ${c.wallA === wall.number ? c.wallB : c.wallA}): ${closureImplication(c)}`);
  const svc = wa.services.map((s) => {
    const from = Math.max(0, Math.min(s.centerX, wa.length - s.centerX));
    return `<li><b class="sn" style="background:${s.e.r.color}">${esc(iso(s.e.idx))}</b> ${esc(s.e.r.he)} `
      + `<span class="sm">— מפינה ${esc(iso(cm(from)))} · גובה ${esc(iso(cm(s.up)))} ס״מ</span></li>`;
  }).join('');
  const breaks = [...wa.openings, ...wa.columns].map((b) => {
    const kind = b.role === 'window' ? 'חלון' : (b.role === 'column' ? 'עמוד' : 'פתח');
    const sill = b.role === 'window' && b.up > 20 ? (' · סף ' + cm(b.up)) : '';
    return `${kind} ${cm(b.w)}×${cm(b.h)}${sill}`;
  });
  const info = `<div class="info-strip">`
    + `<span><b>מעטפת בנייה:</b> ${esc(iso(cm(wa.length) + ' × ' + cm(wa.height) + ' ס״מ'))}</span>`
    + `<span><b>עובי:</b> ${esc(iso(cm(d.thick || 0) + ' ס״מ'))}</span>`
    + (ang != null ? `<span><b>זווית:</b> ${esc(iso(ang + '°'))}</span>` : '')
    + (wa.drops.length ? `<span><b>גובה פנוי מתחת להנמכה:</b> ${esc(iso(cm(wa.minClearHeight) + ' ס״מ'))}</span>` : '')
    + `<span><b>נק׳ שירות:</b> ${esc(iso(wa.services.length))}</span>`
    + `</div>`;
  const closNote = cornerNotes.length
    ? `<div class="panel"><div class="panel-h">סגירות בקצוות הקיר</div><ul class="cl-list">`
      + cornerNotes.map((t) => `<li class="cl cs-sq">${esc(t)}</li>`).join('') + `</ul></div>`
    : '';
  const body = `<h2 class="sec-h">מעטפת-בנייה — קיר ${esc(iso(wall.number))} <span class="sec-sub">(${esc(roomName || '')})</span></h2>`
    + info
    + `<div class="draw">${wallPlanStrip(wa)}</div>`
    + (breaks.length ? `<div class="card wc-breaks"><b>הפרעות (שוברות רצף בנייה מלא):</b> ${esc(iso(breaks.join('  ·  ')))}</div>` : `<div class="card wc-nosvc">קיר רציף — ללא חלונות/דלתות/עמודים</div>`)
    + (svc ? `<div class="panel"><div class="panel-h">נקודות-שירות (דורשות חיתוך/מעבר)</div><ul class="wc-svc">${svc}</ul></div>` : `<div class="card wc-nosvc">אין נקודות-שירות על קיר זה</div>`)
    + closNote;
  return pageWrap(pageNo, total, 'מעטפת קיר ' + wall.number, body, jobName, id);
}

// ===========================================================================
// §D — LIVE 3D (interactive in HTML; static isometric SVG in the PDF)
// ===========================================================================
function roomGeometry3D(room, indexed) {
  const walls = (room.walls || []).filter((w) => w.position);
  if (!walls.length) return { faces: [], center: [0, 0, 0], height: 2500 };
  let cx = 0, cy = 0, cn = 0, maxZ = 0;
  for (const w of walls) { cx += (w.position.startX + w.position.endX) / 2; cy += (w.position.startY + w.position.endY) / 2; cn++; maxZ = Math.max(maxZ, (w.dimensions && w.dimensions.height) || 2500); }
  cx /= cn; cy /= cn;
  const faces = [];
  faces.push({ p: walls.map((w) => [w.position.startX, w.position.startY, 0]), c: BRAND.floor, o: 0.92, s: '#d8cfb8' });
  for (const w of walls) {
    const s = w.position, h = (w.dimensions && w.dimensions.height) || 2500;
    faces.push({ p: [[s.startX, s.startY, 0], [s.endX, s.endY, 0], [s.endX, s.endY, h], [s.startX, s.startY, h]], c: '#c9c4b6', o: 0.26, s: '#8f8f8f' });
  }
  for (const e of indexed.items) {
    const w = e.wall; if (!w || !w.position) continue;
    const v = wallVec(w); const fp = footprint(e); const role = roleOf(e);
    const sx = w.position.startX, sy = w.position.startY;
    const lp = [sx + v.ux * fp.leftX, sy + v.uy * fp.leftX];
    const rp = [sx + v.ux * fp.rightX, sy + v.uy * fp.rightX];
    let nx = -v.uy, ny = v.ux; const midx = (lp[0] + rp[0]) / 2, midy = (lp[1] + rp[1]) / 2;
    if (nx * (cx - midx) + ny * (cy - midy) < 0) { nx = -nx; ny = -ny; }
    const H = (w.dimensions && w.dimensions.height) || 2500;
    const eh = (e.item.size && e.item.size.height) || 100;
    const dep = (e.item.size && e.item.size.depth) || 0;
    let base, top, color, op, off;
    if (role === 'window' || role === 'opening') { base = role === 'window' ? fp.up : 0; top = fp.up + eh; color = role === 'window' ? '#5AA9E6' : '#8A5A2B'; op = 0.6; off = -6; }
    else if (role === 'column') { base = 0; top = H; color = BRAND.wall; op = 0.85; off = Math.max(dep, 60); }
    else if (role === 'ceilingDrop') { base = fp.up; top = H; color = BRAND.amber; op = 0.5; off = Math.max(dep, 120); }
    else { base = Math.max(0, fp.up - eh / 2); top = fp.up + eh / 2; color = e.r.color; op = 0.95; off = Math.max(dep, 45); }
    const ox = nx * off, oy = ny * off;
    faces.push({ p: [[lp[0] + ox, lp[1] + oy, base], [rp[0] + ox, rp[1] + oy, base], [rp[0] + ox, rp[1] + oy, top], [lp[0] + ox, lp[1] + oy, top]], c: color, o: op, s: 'rgba(0,0,0,.28)' });
  }
  return { faces, center: [cx, cy, maxZ / 2], height: maxZ };
}
function project3d(p, c, yaw, pitch) {
  const X = p[0] - c[0], Y = p[1] - c[1], Z = p[2] - c[2];
  const X1 = X * Math.cos(yaw) - Y * Math.sin(yaw), Y1 = X * Math.sin(yaw) + Y * Math.cos(yaw);
  const Y2 = Y1 * Math.cos(pitch) - Z * Math.sin(pitch), Z2 = Y1 * Math.sin(pitch) + Z * Math.cos(pitch);
  return { x: X1, y: -Z2, d: Y2 };
}
function iso3dSvg(geo) {
  const VW = 1040, VH = 600, yaw = -0.62, pitch = 1.02, pad = 44;
  const c = geo.center;
  const pf = geo.faces.map((f) => { const pts = f.p.map((p) => project3d(p, c, yaw, pitch)); const d = pts.reduce((a, q) => a + q.d, 0) / pts.length; return { f, pts, d }; });
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const q of pf) for (const p of q.pts) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); }
  const spanx = (maxx - minx) || 1, spany = (maxy - miny) || 1;
  const sc = Math.min((VW - 2 * pad) / spanx, (VH - 2 * pad) / spany);
  const ox = pad + ((VW - 2 * pad) - spanx * sc) / 2 - minx * sc;
  const oy = pad + ((VH - 2 * pad) - spany * sc) / 2 - miny * sc;
  pf.sort((a, b) => a.d - b.d);
  let s = '';
  for (const q of pf) {
    const pts = q.pts.map((p) => `${n1(ox + p.x * sc)},${n1(oy + p.y * sc)}`).join(' ');
    s += `<polygon points="${pts}" fill="${q.f.c}" fill-opacity="${q.f.o}" stroke="${q.f.s || 'rgba(0,0,0,.25)'}" stroke-width="1" stroke-linejoin="round"/>`;
  }
  return `<svg class="iso3d" viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" role="img">`
    + `<rect x="0" y="0" width="${VW}" height="${VH}" fill="#fff"/>${s}`
    + `<text class="units" x="${VW - 16}" y="${VH - 12}" text-anchor="end">מבט תלת-מימד (סטטי) · הגרסה האינטראקטיבית ב-HTML</text></svg>`;
}
function room3dLegend() {
  const items = [['#5AA9E6', 'חלון'], ['#8A5A2B', 'דלת/פתח'], [BRAND.wall, 'עמוד/קיר'], [BRAND.amber, 'הנמכת-תקרה'], [BRAND.orange, 'חשמל'], ['#1E78C8', 'מים']];
  return `<div class="legend"><div class="legend-t">מקרא</div><div class="legend-items">`
    + items.map(([c, l]) => `<span class="lg"><span class="lg-d" style="background:${c}"></span>${esc(l)}</span>`).join('') + `</div></div>`;
}
function room3dPage(room, indexed, pageNo, total, jobName, interactive, id, canvasId) {
  const geo = roomGeometry3D(room, indexed);
  const walls = (room.walls || []).filter((w) => w.position).length;
  const info = `<div class="info-strip"><span><b>מבט:</b> תלת-מימד חי</span>`
    + `<span><b>קירות:</b> ${esc(iso(walls))}</span><span><b>אלמנטים:</b> ${esc(iso(indexed.items.length))}</span>`
    + (interactive ? `<span><b>שליטה:</b> גרור לסיבוב · גלגלת לזום</span>` : `<span>תצוגה סטטית — אינטראקטיבי ב-HTML</span>`)
    + `</div>`;
  const geoJson = JSON.stringify(geo, (k, v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v));
  const draw = interactive
    ? `<div class="draw viz3d"><canvas id="${esc(canvasId)}" class="v3dcanvas"></canvas></div>`
      + `<script>(window.__V3D=window.__V3D||[]).push({id:${JSON.stringify(canvasId)},data:${geoJson}});</script>`
    : `<div class="draw">${iso3dSvg(geo)}</div>`;
  const body = `<h2 class="sec-h">מבט תלת-מימד <span class="sec-sub">— ${esc(room.name || 'חדר')}</span></h2>`
    + info + draw + room3dLegend();
  return pageWrap(pageNo, total, 'תלת-מימד', body, jobName, id);
}
// shared interactive 3D renderer (HTML only) — vanilla canvas orbit, no CDN.
function viz3dScript() {
  return `<script>(function(){
  function render(cv,data){
    var ctx=cv.getContext('2d'),DPR=window.devicePixelRatio||1;
    var yaw=-0.62,pitch=1.02,zoom=1,drag=false,lx=0,ly=0,c=data.center;
    function proj(p){var X=p[0]-c[0],Y=p[1]-c[1],Z=p[2]-c[2];
      var X1=X*Math.cos(yaw)-Y*Math.sin(yaw),Y1=X*Math.sin(yaw)+Y*Math.cos(yaw);
      var Y2=Y1*Math.cos(pitch)-Z*Math.sin(pitch),Z2=Y1*Math.sin(pitch)+Z*Math.cos(pitch);
      return {x:X1,y:-Z2,d:Y2};}
    function draw(){
      var W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);
      var F=data.faces.map(function(f){var pts=f.p.map(proj),d=0;pts.forEach(function(q){d+=q.d;});return {f:f,pts:pts,d:d/pts.length};});
      var mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9;
      F.forEach(function(pf){pf.pts.forEach(function(q){if(q.x<mnx)mnx=q.x;if(q.x>mxx)mxx=q.x;if(q.y<mny)mny=q.y;if(q.y>mxy)mxy=q.y;});});
      var spx=(mxx-mnx)||1,spy=(mxy-mny)||1,pad=24*DPR;
      var sc=Math.min((W-2*pad)/spx,(H-2*pad)/spy)*zoom;
      var ox=(W-spx*sc)/2-mnx*sc,oy=(H-spy*sc)/2-mny*sc;
      F.sort(function(a,b){return a.d-b.d;});
      F.forEach(function(pf){ctx.beginPath();pf.pts.forEach(function(q,i){var X=ox+q.x*sc,Y=oy+q.y*sc;if(i===0)ctx.moveTo(X,Y);else ctx.lineTo(X,Y);});ctx.closePath();
        ctx.globalAlpha=pf.f.o;ctx.fillStyle=pf.f.c;ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=DPR;ctx.strokeStyle=pf.f.s||'rgba(0,0,0,.25)';ctx.stroke();});
    }
    function resize(){var w=cv.clientWidth||600,h=cv.clientHeight||360;cv.width=w*DPR;cv.height=h*DPR;draw();}
    cv.addEventListener('mousedown',function(e){drag=true;lx=e.clientX;ly=e.clientY;});
    window.addEventListener('mouseup',function(){drag=false;});
    window.addEventListener('mousemove',function(e){if(!drag)return;yaw+=(e.clientX-lx)*0.01;pitch+=(e.clientY-ly)*0.01;pitch=Math.max(0.12,Math.min(1.5,pitch));lx=e.clientX;ly=e.clientY;draw();});
    cv.addEventListener('wheel',function(e){e.preventDefault();zoom*=e.deltaY<0?1.1:0.9;zoom=Math.max(0.3,Math.min(4,zoom));draw();},{passive:false});
    cv.addEventListener('touchstart',function(e){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;},{passive:true});
    cv.addEventListener('touchmove',function(e){if(!drag)return;var t=e.touches[0];yaw+=(t.clientX-lx)*0.01;pitch+=(t.clientY-ly)*0.01;pitch=Math.max(0.12,Math.min(1.5,pitch));lx=t.clientX;ly=t.clientY;draw();e.preventDefault();},{passive:false});
    window.addEventListener('touchend',function(){drag=false;});
    window.addEventListener('resize',resize);resize();
  }
  function boot(){(window.__V3D||[]).forEach(function(j){var cv=document.getElementById(j.id);if(cv)render(cv,j.data);});}
  if(document.readyState!=='loading')boot();else document.addEventListener('DOMContentLoaded',boot);
  })();</script>`;
}

// Dedicated OPENINGS SPEC table (doors + windows) — includes the משקוף/מסגרת
// (frame thickness) column per docs/OPENING_ELEMENT_SCHEMA.md (geom.frameThickness),
// falling back gracefully to "—" when the surveyor has not measured it.
function openingsSpecTable(indexed) {
  const isOpening = (e) => {
    const he = String(e.r.he || ''); const t = String(e.item.type || '');
    return t === 'Window' || t === 'Door' || /חלון|דלת|מפתח|פתח(?!ל)/.test(he);
  };
  const rows = indexed.items.filter(isOpening).map((e) => {
    const sz = e.item.size || {};
    const geom = e.item.geom || {};
    const cfg = e.item.config || {};
    const kind = /חלון/.test(e.r.he) || e.item.type === 'Window' ? 'חלון' : 'דלת/פתח';
    const sill = e.up > 20 ? cm(e.up) : '0';
    const frame = geom.frameThickness != null ? cm(geom.frameThickness) : '—';
    const swing = cfg.hingeSide ? (cfg.hingeSide + (cfg.swing ? '/' + cfg.swing : '')) : '—';
    return `<tr data-group="${esc(e.r.group)}">`
      + `<td class="c"><span class="num-chip" style="background:${e.r.color}">${esc(iso(e.idx))}</span></td>`
      + `<td>${esc(e.r.he)}</td>`
      + `<td class="c">${esc(kind)}</td>`
      + `<td class="c">${esc(iso(cm(sz.width || 0) + '×' + cm(sz.height || 0)))}</td>`
      + `<td class="c">${esc(iso(sill))}</td>`
      + `<td class="c">${esc(iso(frame))}</td>`
      + `<td class="c">${esc(iso(swing))}</td>`
      + `<td class="c">${esc(iso(e.wallNo != null ? e.wallNo : '—'))}</td>`
      + `</tr>`;
  }).join('');
  if (!rows) return '';
  return `<h3 class="dsub" style="margin-top:16px">מפרט פתחים <span class="sec-sub">(דלתות וחלונות · מידות בס״מ)</span></h3>`
    + `<div class="card card-table"><table class="sched"><thead><tr>`
    + `<th>מס׳</th><th>פתח</th><th>סוג</th><th>רוחב×גובה</th><th>סף</th><th>משקוף/מסגרת</th><th>כיוון</th><th>קיר</th>`
    + `</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function legendHtml(groups) {
  if (!groups.size) return '';
  let s = `<div class="legend"><div class="legend-t">מקרא קטגוריות</div><div class="legend-items">`;
  for (const [g, c] of groups) s += `<span class="lg"><span class="lg-d" style="background:${c}"></span>${esc(g)}</span>`;
  s += `</div></div>`;
  return s;
}

function planPage(room, indexed, pageNo, total, jobName, id) {
  const { svg, groups } = planSvg(room, indexed);
  const walls = (room.walls || []).filter((w) => w.position);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of walls) for (const [x, y] of [[w.position.startX, w.position.startY], [w.position.endX, w.position.endY]]) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const ent = entranceLabelText(room);
  const info = `<div class="info-strip">`
    + `<span><b>חדר:</b> ${esc(room.name || '—')}</span>`
    + `<span><b>מידות פנים:</b> ${esc(iso(cm(maxX - minX) + ' × ' + cm(maxY - minY) + ' ס״מ'))}</span>`
    + `<span><b>קירות:</b> ${esc(iso(walls.length))}</span>`
    + `<span><b>אלמנטים:</b> ${esc(iso(indexed.items.length))}</span>`
    + `<span class="${ent.defined ? '' : 'is-pending'}">${esc(ent.text)}</span>`
    + `</div>`;
  const body = `<h2 class="sec-h">תוכנית חדר <span class="sec-sub">(מבט־על)</span></h2>`
    + info
    + `<div class="draw">${svg}</div>`
    + legendHtml(groups);
  return pageWrap(pageNo, total, 'תוכנית — ' + (room.name || 'חדר'), body, jobName, id);
}

function elevationPage(wall, elems, wIndex, pageNo, total, jobName, roomName, id, photoStrip) {
  const d = wall.dimensions || {};
  const ang = wall.position ? wall.position.angle : null;
  const meta = `<div class="info-strip">`
    + `<span><b>קיר:</b> ${esc(iso(wIndex))}</span>`
    + `<span><b>אורך:</b> ${esc(iso(cm(d.length || 0) + ' ס״מ'))}</span>`
    + `<span><b>גובה:</b> ${esc(iso(cm(d.height || 0) + ' ס״מ'))}</span>`
    + `<span><b>עובי:</b> ${esc(iso(cm(d.thick || 0) + ' ס״מ'))}</span>`
    + (ang != null ? `<span><b>זווית:</b> ${esc(iso(Math.round(ang) + '°'))}</span>` : '')
    + `<span><b>אלמנטים:</b> ${esc(iso(elems.length))}</span>`
    + `</div>`;
  const body = `<h2 class="sec-h">חזית קיר ${esc(iso(wIndex))} <span class="sec-sub">(${esc(roomName || '')})</span></h2>`
    + meta
    + `<div class="draw">${elevationSvg(wall, elems)}</div>`
    + (photoStrip || '');
  return pageWrap(pageNo, total, 'חזית קיר ' + wIndex, body, jobName, id);
}

function schedulePage(indexed, pageNo, total, jobName) {
  let rows = '';
  for (const e of indexed.items) {
    const sz = e.item.size || {};
    const wall = e.wallNo != null ? e.wallNo : '—';
    rows += `<tr data-group="${esc(e.r.group)}">`
      + `<td class="c"><span class="num-chip" style="background:${e.r.color}">${esc(iso(e.idx))}</span></td>`
      + `<td>${esc(e.r.he)}</td>`
      + `<td class="c"><span class="grp" style="background:${e.r.color}1f;color:${e.r.color}">${esc(e.r.group)}</span></td>`
      + `<td class="c">${esc(iso(wall))}</td>`
      + `<td class="c">${esc(iso(cm(e.along)))}</td>`
      + `<td class="c">${esc(iso(cm(e.up)))}</td>`
      + `<td class="c">${esc(iso(cm(sz.width || 0) + '×' + cm(sz.height || 0)))}</td>`
      + `<td class="c">${esc(iso(cm(sz.depth || 0)))}</td>`
      + `</tr>`;
  }
  if (!rows) rows = `<tr><td colspan="8" class="empty-row">אין אלמנטים</td></tr>`;
  const body = `<h2 class="sec-h">רשימת אלמנטים <span class="sec-sub">(${esc(iso(indexed.items.length))} פריטים · מידות בס״מ)</span></h2>`
    + `<div class="card card-table"><table class="sched"><thead><tr>`
    + `<th>מס׳</th><th>אלמנט</th><th>קטגוריה</th><th>קיר</th><th>מרחק מפינה</th><th>גובה מרצפה</th><th>רוחב×גובה</th><th>עומק</th>`
    + `</tr></thead><tbody>${rows}</tbody></table></div>`
    + openingsSpecTable(indexed);
  return pageWrap(pageNo, total, 'רשימת אלמנטים', body, jobName, 'p-sched');
}

function wallsTablePage(room, pageNo, total, jobName) {
  const walls = (room.walls || []);
  let rows = '';
  walls.forEach((w, i) => {
    const d = w.dimensions || {};
    const ang = w.position ? Math.round(w.position.angle) : '—';
    const next = walls[(i + 1) % walls.length];
    const corner = (walls.length > 2 && next && w.position && next.position) ? cornerAngleDeg(w, next) : null;
    rows += `<tr>`
      + `<td class="c">${esc(iso(w.number != null ? w.number : i))}</td>`
      + `<td class="c">${esc(iso(cm(d.length || 0)))}</td>`
      + `<td class="c">${esc(iso(cm(d.height || 0)))}</td>`
      + `<td class="c">${esc(iso(cm(d.thick || 0)))}</td>`
      + `<td class="c">${esc(iso(ang + '°'))}</td>`
      + `<td class="c">${corner != null ? esc(iso(corner + '°')) : '—'}</td>`
      + `<td class="c">${esc(iso((w.fixtures || []).length + (w.furnishings || []).length))}</td>`
      + `</tr>`;
  });
  const status = statusOf({ rooms: [room] });
  const body = `<h2 class="sec-h">טבלת קירות <span class="sec-sub">(מידות בס״מ)</span></h2>`
    + `<div class="card card-table"><table class="sched"><thead><tr>`
    + `<th>קיר</th><th>אורך</th><th>גובה</th><th>עובי</th><th>זווית</th><th>זווית פינה</th><th>אלמנטים</th>`
    + `</tr></thead><tbody>${rows}</tbody></table></div>`
    + `<div class="card closure">סטטוס סגירת חדר: <span class="badge" style="color:${status.color};background:${status.bg};border-color:${status.color}">${esc(status.label)}</span></div>`;
  return pageWrap(pageNo, total, 'טבלת קירות', body, jobName, 'p-walls');
}

// ---------------------------------------------------------------------------
// Styles — print-first A4 RTL. All colors inline-safe for headless print.
// ---------------------------------------------------------------------------
function styles() {
  return `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:${fontStack('body')};color:${BRAND.ink};background:#d9d9d9;direction:rtl;text-align:right;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1,h2,h3,.sec-h,.dsub{font-family:${fontStack('heading')}}
/* ---- LOCKED Poppins wordmark (owner decision — not swappable) ---- */
.wm{display:inline-flex;flex-direction:column;align-items:center;text-align:center;line-height:1;vertical-align:middle;font-family:${WORDMARK_FONT};white-space:nowrap}
.wm-name{color:${WORDMARK_NAME_COLOR};font-weight:600;text-transform:lowercase;letter-spacing:.01em}
.wm-tag{color:${WORDMARK_TAG_COLOR};font-weight:500;text-transform:uppercase;width:100%}
.wm-hdr .wm-name{font-size:23px}
.wm-hdr .wm-tag{font-size:6px;letter-spacing:.18em;margin-top:2px}
.wm-xl .wm-name{font-size:52px}
.wm-xl .wm-tag{font-size:11px;letter-spacing:.34em;margin-top:5px}
.page{position:relative;width:210mm;min-height:297mm;background:${BRAND.cream};margin:10px auto;padding:14mm 14mm 16mm;box-shadow:0 2px 12px rgba(0,0,0,.18);display:flex;flex-direction:column}
.pg-head{display:flex;align-items:center;gap:12px;border-bottom:2px solid ${BRAND.teal};padding-bottom:8px;margin-bottom:14px}
.pg-sub{color:${BRAND.muted};font-size:12.5px;font-weight:600}
.pg-job{margin-inline-start:auto;color:${BRAND.ink};font-size:12.5px;font-weight:700;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pg-body{flex:1}
.pg-foot{margin-top:14px;padding-top:8px;border-top:1px solid ${BRAND.line};display:flex;justify-content:space-between;color:${BRAND.muted};font-size:11px}
.sec-h{font-size:19px;color:${BRAND.tealDark};margin:0 0 10px;font-weight:800}
.sec-sub{color:${BRAND.muted};font-size:13px;font-weight:600}
/* ---- unified WHITE CARD system (owner decision 2026-08-22) ----
   Every data section on the cream page sits inside a consistent white rounded
   card: same background, border, radius and soft shadow across the whole report.
   .card is the canonical box; the pre-existing card-like blocks below inherit the
   exact same visual treatment so nothing reads as loose text/tables. */
.card{background:${BRAND.paper};border:1px solid ${BRAND.line};border-radius:12px;padding:12px 15px;margin-top:12px}
.card:first-child{margin-top:0}
.card-h{font-size:14px;font-weight:800;color:${BRAND.tealDark};margin-bottom:8px}
.card-table{padding:8px 10px;overflow-x:auto}
.card-flags{margin:12px 0}
.info-strip,.panel,.constraints,.legend,.draw,.vtile,.tile,.wcard,.zcard,.dbrief,.card{box-shadow:0 1px 2px rgba(0,0,0,.045)}
.info-strip{display:flex;flex-wrap:wrap;gap:8px 18px;background:${BRAND.paper};border:1px solid ${BRAND.line};border-radius:12px;padding:10px 15px;margin-bottom:12px;font-size:13px}
.info-strip b{color:${BRAND.tealDark};font-weight:700}
.info-strip .is-pending{color:${BRAND.muted};font-style:italic}
.draw{border:1px solid ${BRAND.line};border-radius:12px;overflow:hidden;background:${BRAND.paper}}
.draw svg{display:block;width:100%;height:auto}

/* ---- drawing element styles ---- */
.paper{fill:#fff}
.floor{fill:${BRAND.floor};stroke:none}
.wall{fill:none;stroke:${BRAND.wall};stroke-linejoin:miter;stroke-linecap:butt}
.wallface{fill:${BRAND.floor};stroke:${BRAND.wall};stroke-width:1.5}
.elev .floor{stroke:${BRAND.wall};stroke-width:3}
.elev .ceil{stroke:${BRAND.wall};stroke-width:1.2;stroke-dasharray:2 4}
.face-t{fill:${BRAND.muted};font-size:12px}
/* dimensions */
.dim-l{stroke:${BRAND.dim};stroke-width:1.1}
.dim-w{stroke:${BRAND.dim};stroke-width:.7;opacity:.85}
.dim-t{fill:${BRAND.dim};font-family:${fontStack('dim')};font-variant-numeric:tabular-nums;font-size:14px;paint-order:stroke;stroke:#fff;stroke-width:3.2px;stroke-linejoin:round;font-weight:600}
.dim-b{font-weight:800;font-size:15px}
.ang{fill:${BRAND.orange};font-size:13px;font-weight:700;paint-order:stroke;stroke:#fff;stroke-width:3px}
.caln{fill:#fff;font-size:12px;font-weight:800}
.units{fill:${BRAND.muted};font-size:11.5px}
.sbar line{stroke:${BRAND.ink};stroke-width:1.4}
.sbar-t{fill:${BRAND.ink};font-size:12px;font-weight:600}
.ent-ar{fill:${BRAND.teal}}
.ent-q{fill:${BRAND.muted};font-size:20px;font-weight:800}
.ent-lbl{fill:${BRAND.tealDark};font-size:12px;font-weight:800;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}
.ent-lbl-undef{fill:${BRAND.muted}}
.ent-sub{fill:${BRAND.muted};font-size:11px;font-weight:700;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}
.el rect{}
.empty-el{fill:${BRAND.muted};font-size:14px}
.empty{color:${BRAND.muted};padding:30px;text-align:center}

/* ---- legend ---- */
.legend{margin-top:12px;border:1px solid ${BRAND.line};border-radius:12px;padding:10px 15px;background:${BRAND.paper}}
.legend-t{font-size:12.5px;color:${BRAND.tealDark};font-weight:800;margin-bottom:6px}
.legend-items{display:flex;flex-wrap:wrap;gap:6px 16px}
.lg{display:inline-flex;align-items:center;gap:6px;font-size:12.5px}
.lg-d{width:12px;height:12px;border-radius:50%;display:inline-block;border:1.5px solid #fff;box-shadow:0 0 0 1px ${BRAND.line}}

/* ---- cover ---- */
.cover{display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:24mm;height:100%}
.cover-brand{margin-bottom:26px}
.cover-brand .wm{font-size:40px}
.cover-tag{color:${BRAND.muted};font-size:14px;font-weight:600;margin-top:4px;letter-spacing:.5px}
.cover-title{font-size:30px;font-weight:800;color:${BRAND.tealDark};margin-top:14px}
.cover-jobname{font-size:20px;color:${BRAND.ink};font-weight:700;margin:8px 0 16px}
.badge{display:inline-block;padding:5px 16px;border-radius:999px;font-size:14px;font-weight:800;border:1.5px solid}
.cover-stats{display:flex;gap:14px;margin:28px 0 6px;flex-wrap:wrap;justify-content:center}
.tile{background:#fff;border:1px solid ${BRAND.line};border-radius:12px;padding:16px 22px;min-width:110px}
.tn{font-size:24px;font-weight:800;color:${BRAND.tealDark}}
.tl{font-size:12.5px;color:${BRAND.muted};margin-top:2px}
.cover-info{margin:26px auto 0;border-collapse:collapse;min-width:60%;font-size:14.5px}
.cover-info td{padding:9px 16px;border-bottom:1px solid ${BRAND.line}}
.cover-info .k{color:${BRAND.muted};font-weight:600;text-align:start;width:40%}
.cover-info .v{font-weight:700;text-align:start}
.cover-foot{margin-top:auto;color:${BRAND.muted};font-size:12px;padding-top:24px;max-width:80%}

/* ---- tables ---- */
.sched{border-collapse:collapse;width:100%;font-size:13px;margin-top:6px}
.sched th,.sched td{padding:8px 10px;border-bottom:1px solid ${BRAND.line};text-align:start}
.sched thead th{background:${BRAND.tealDark};color:#fff;font-weight:700;font-size:12.5px;border-bottom:none}
.sched tbody tr:nth-child(even){background:${BRAND.cream}}
.sched td.c,.sched th{white-space:nowrap}
.sched td.c{text-align:center}
.num-chip{display:inline-block;min-width:22px;padding:2px 7px;border-radius:6px;color:#fff;font-weight:800;font-size:12px}
.grp{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:700;font-size:11.5px}
.empty-row{text-align:center;color:${BRAND.muted};padding:24px}
.closure{margin-top:14px;font-size:14px;font-weight:600}

/* ================= CARPENTER PLANNING DASHBOARD (HOME) ================= */
.dbrief{display:flex;align-items:center;gap:18px;background:#fff;border:1px solid ${BRAND.line};border-radius:12px;padding:14px 18px;margin-bottom:14px}
.db-left{flex:0 0 auto}
.db-mid{flex:1 1 auto;min-width:0}
.db-title{font-size:13px;color:${BRAND.muted};font-weight:700;letter-spacing:.03em}
.db-job{font-size:22px;font-weight:800;color:${BRAND.tealDark};margin:1px 0 3px;line-height:1.15}
.db-meta{font-size:12.5px;color:${BRAND.muted}}
.db-right{flex:0 0 auto}
.rdash{margin-bottom:6px}
.dsub{font-size:15px;color:${BRAND.tealDark};font-weight:800;margin:16px 0 9px;padding-inline-start:10px;border-inline-start:4px solid ${BRAND.orange}}
/* vitals */
.vitals{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:4px}
.vtile{background:#fff;border:1px solid ${BRAND.line};border-radius:12px;padding:13px 15px;border-top:4px solid ${BRAND.line}}
.vtile.accent{border-top-color:${BRAND.teal}}
.vtile.ok{border-top-color:${BRAND.green}}
.vtile.warn{border-top-color:${BRAND.red}}
.vtile.muted{opacity:.9}
.vt-n{font-size:25px;font-weight:800;color:${BRAND.ink};font-variant-numeric:tabular-nums;line-height:1.05}
.vtile.ok .vt-n{color:${BRAND.green}}
.vtile.warn .vt-n{color:${BRAND.red}}
.vt-l{font-size:12.5px;color:${BRAND.tealDark};font-weight:700;margin-top:3px}
.vt-s{font-size:11px;color:${BRAND.muted};margin-top:3px;line-height:1.35}
/* per-wall strip cards */
.wgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.wcard{background:#fff;border:1px solid ${BRAND.line};border-radius:12px;padding:11px 12px;break-inside:avoid}
.wc-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:7px}
.wc-no{font-size:15px;font-weight:800;color:${BRAND.tealDark}}
.wc-env{font-size:12px;color:${BRAND.ink};font-weight:700}
.wc-clear{margin-inline-start:auto;font-size:11.5px;font-weight:700;color:${BRAND.green};background:#E7F3EE;border-radius:999px;padding:2px 10px}
.strip-wrap{background:#fff}
.wc-breaks{font-size:11.5px;color:${BRAND.ink};margin-top:7px}
.wc-breaks b{color:${BRAND.red}}
.wc-svc{list-style:none;margin:7px 0 0;padding:0;display:flex;flex-direction:column;gap:3px}
.wc-svc li{font-size:11.5px;color:${BRAND.ink};display:flex;align-items:center;gap:6px}
.wc-svc .sn{color:#fff;font-size:10px;font-weight:800;min-width:16px;text-align:center;border-radius:5px;padding:0 4px}
.wc-svc .sd{display:none}
.wc-svc .sm{color:${BRAND.muted}}
.wc-nosvc{font-size:11.5px;color:${BRAND.muted};margin-top:7px;font-style:italic}
/* zone cards */
.zgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.zcard{background:#fff;border:1px solid ${BRAND.line};border-radius:12px;padding:12px 14px;break-inside:avoid;border-top:4px solid ${BRAND.orange}}
.zc-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.zc-kind{font-size:16px;font-weight:800;color:${BRAND.tealDark}}
.zc-conf{font-size:10.5px;font-weight:800;border-radius:999px;padding:2px 9px}
.zc-conf.z-id{color:${BRAND.green};background:#E7F3EE}
.zc-conf.z-sug{color:${BRAND.amber};background:#FDF3E0}
.zc-env{display:flex;flex-wrap:wrap;gap:5px 16px;font-size:12.5px;padding:8px 0;border-bottom:1px dashed ${BRAND.line}}
.zc-env b{color:${BRAND.muted};font-weight:700}
.zc-sec{margin-top:8px}
.zc-lbl{font-size:11px;color:${BRAND.muted};font-weight:700;margin-bottom:3px}
.zc-svc{display:flex;flex-direction:column;gap:3px;font-size:12px}
.zsvc{display:flex;align-items:center;gap:6px}
.zsvc .sd{width:10px;height:10px;border-radius:50%;flex:0 0 auto}
.zsvc i{color:${BRAND.muted};font-style:normal;font-size:11px}
.zc-brk{font-size:12px;color:${BRAND.ink}}
.zc-brk i{color:${BRAND.muted}}
/* constraints */
.constraints{margin-top:14px;background:#fff;border:1px solid ${BRAND.line};border-radius:12px;padding:12px 15px}
.cn-h{font-size:14px;font-weight:800;color:${BRAND.tealDark};margin-bottom:8px}
.cn-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.cn{font-size:12.5px;color:${BRAND.ink};display:flex;align-items:flex-start;gap:8px;line-height:1.4}
.cn-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;margin-top:4px;background:${BRAND.muted}}
.cn-crit .cn-dot{background:${BRAND.red}}
.cn-warn .cn-dot{background:${BRAND.amber}}
.cn-ok .cn-dot{background:${BRAND.green}}
.cn-info .cn-dot{background:${BRAND.teal}}
/* strip svg internals */
.strip .env{fill:#F3F8F1;stroke:${BRAND.wall};stroke-width:1.4}
.strip .floor{stroke:${BRAND.wall};stroke-width:2.6}
.strip .ceil{stroke:${BRAND.wall};stroke-width:1;stroke-dasharray:2 4}
.strip .span{fill:${BRAND.green};fill-opacity:.10}
.strip .span-t{fill:${BRAND.green};font-size:11px;font-weight:700}
.strip .drop{fill:${BRAND.amber};fill-opacity:.18;stroke:${BRAND.amber};stroke-width:1;stroke-dasharray:3 3}
.strip .drop-t{fill:${BRAND.amber};font-size:10px;font-weight:700;paint-order:stroke;stroke:#fff;stroke-width:2.4px}
.strip .blk{stroke-width:1.6}
.strip .blk-win{fill:#5AA9E6;fill-opacity:.18;stroke:#5AA9E6}
.strip .blk-door{fill:#8A5A2B;fill-opacity:.16;stroke:#8A5A2B}
.strip .blk-col{fill:${BRAND.wall};fill-opacity:.22;stroke:${BRAND.wall}}
.strip .blk-t{fill:${BRAND.ink};font-size:10.5px;font-weight:700;paint-order:stroke;stroke:#fff;stroke-width:2.6px}
/* ---- v2: flags, panels, closures, 3D ---- */
.flags{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.card-flags .flags{margin:0}
.drawflag{font-size:12.5px;font-weight:800;border-radius:999px;padding:5px 14px;border:1.5px solid}
.df-closed{color:${BRAND.green};background:#E7F3EE;border-color:${BRAND.green}}
.df-open{color:${BRAND.amber};background:#FDF3E0;border-color:${BRAND.amber}}
.df-neutral{color:${BRAND.tealDark};background:#fff;border-color:${BRAND.line}}
.panel{background:#fff;border:1px solid ${BRAND.line};border-radius:12px;padding:12px 15px;margin-top:12px;break-inside:avoid}
.panel-h{font-size:14px;font-weight:800;color:${BRAND.tealDark};margin-bottom:8px}
.panel-empty{font-size:12.5px;color:${BRAND.muted}}
.panel-note{font-size:11.5px;color:${BRAND.muted};margin-top:8px;line-height:1.4;border-top:1px dashed ${BRAND.line};padding-top:7px}
.cl-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.cl{font-size:12.5px;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:7px 10px;border-radius:8px;border-inline-start:4px solid ${BRAND.line};background:${BRAND.cream}}
.cl-c{font-weight:800;color:${BRAND.ink}}
.cl-s{font-weight:800}
.cl-i{color:${BRAND.ink};flex:1 1 100%;line-height:1.4}
.cl.cs-conv{border-inline-start-color:${BRAND.red}}
.cl.cs-conv .cl-s{color:${BRAND.red}}
.cl.cs-div{border-inline-start-color:${BRAND.teal}}
.cl.cs-div .cl-s{color:${BRAND.tealDark}}
.cl.cs-sq{border-inline-start-color:${BRAND.green}}
.cl.cs-sq .cl-s{color:${BRAND.green}}
.fc-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.fc-list li{font-size:12.5px;color:${BRAND.ink};line-height:1.4}
.fc-scope{display:inline-block;background:${BRAND.teal};color:#fff;font-weight:700;font-size:11px;border-radius:6px;padding:1px 8px;margin-inline-end:6px}
.wc-breaks{font-size:12.5px;color:${BRAND.ink};margin-top:10px}
.wc-breaks b{color:${BRAND.red}}
.wc-svc{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:4px}
.wc-svc li{font-size:12.5px;color:${BRAND.ink};display:flex;align-items:center;gap:7px}
.wc-svc .sn{color:#fff;font-size:11px;font-weight:800;min-width:18px;text-align:center;border-radius:6px;padding:1px 5px}
.wc-svc .sm{color:${BRAND.muted}}
.wc-nosvc{font-size:12.5px;color:${BRAND.muted};margin-top:10px;font-style:italic}
.iso3d{display:block;width:100%;height:auto}
.viz3d{position:relative;background:#fff;height:520px;min-height:360px}
.v3dcanvas{display:block;width:100%;height:100%;cursor:grab;touch-action:none}
.v3dcanvas:active{cursor:grabbing}

@page{size:A4;margin:0}
@media print{
  body{background:#fff}
  .toolbar{display:none !important}
  .report{padding:0 !important}
  .page{margin:0;box-shadow:none;width:auto;min-height:auto;height:297mm;page-break-after:always}
  .page#p-home{height:auto;min-height:297mm}
  .page:last-child{page-break-after:auto}
  .wcard,.zcard,.vtile,.constraints{break-inside:avoid}
}
`;
}

// Screen-only chrome for the interactive report (sticky toolbar + filters).
// Print rules above always win via @media print, so the PDF is unaffected.
function screenStyles() {
  return `
body.screen{background:#e9e6df}
.report{padding:14px 0 40px}
.toolbar{position:sticky;top:0;z-index:30;background:#fff;border-bottom:1px solid ${BRAND.line};box-shadow:0 1px 6px rgba(0,0,0,.06)}
.tb-row{max-width:210mm;margin:0 auto;display:flex;align-items:center;gap:14px;padding:9px 14px;flex-wrap:wrap}
.tb-top{border-bottom:1px solid ${BRAND.cream}}
.tb-job{color:${BRAND.muted};font-size:13px;font-weight:700}
.tb-navs{display:flex;gap:4px;margin-inline-start:auto;flex-wrap:wrap}
.tb-nav{color:${BRAND.tealDark};text-decoration:none;font-size:13px;font-weight:600;padding:5px 11px;border-radius:999px}
.tb-nav:hover{background:${BRAND.cream}}
.tb-print{border:1px solid ${BRAND.teal};background:${BRAND.teal};color:#fff;border-radius:999px;padding:7px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
.tb-print:hover{background:${BRAND.tealDark};border-color:${BRAND.tealDark}}
.tb-filter{padding-top:8px;padding-bottom:10px}
.tb-flbl{color:${BRAND.muted};font-size:12.5px;font-weight:700}
.chip{--cc:${BRAND.muted};display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--cc);background:#fff;color:${BRAND.ink};border-radius:999px;padding:5px 13px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;opacity:.45;transition:opacity .12s}
.chip.active{opacity:1}
.chip-d{width:11px;height:11px;border-radius:50%;display:inline-block}
.chip-all{border-color:${BRAND.teal};color:${BRAND.teal}}
.chip-all.active{background:${BRAND.teal};color:#fff}
/* ---- גלריית-תמונות (screen-only) ---- */
.ph-group .card-h,.ph-strip .card-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ph-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:6px}
.ph-grid-strip{grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.ph-tile{margin:0;background:${BRAND.paper};border:1px solid ${BRAND.line};border-radius:10px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.06);display:flex;flex-direction:column}
.ph-btn{padding:0;border:0;background:${BRAND.cream};cursor:zoom-in;display:block;line-height:0}
.ph-img{width:100%;height:130px;object-fit:cover;display:block;transition:opacity .12s}
.ph-btn:hover .ph-img{opacity:.9}
.ph-cap{padding:7px 9px;font-size:12px;color:${BRAND.ink};font-weight:600;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ph-note{color:${BRAND.muted};font-weight:500;font-size:11px;flex-basis:100%}
.ph-kind{background:${BRAND.teal}1f;color:${BRAND.tealDark};border-radius:999px;padding:1px 8px;font-size:10.5px;font-weight:700}
.ph-skip{opacity:.7}
.ph-ph{height:130px;display:flex;align-items:center;justify-content:center;text-align:center;padding:8px;font-size:11px;color:${BRAND.muted};background:${BRAND.cream}}
.ph-warn{background:#FFF7E6;border:1px solid ${BRAND.orange};color:#8a5a00;border-radius:10px;padding:9px 13px;font-size:12.5px;font-weight:600;margin-bottom:12px}
.ph-dl{border:1px solid ${BRAND.teal};background:${BRAND.teal};color:#fff;border-radius:999px;padding:5px 13px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;margin-inline-start:auto}
.ph-dl:hover{background:${BRAND.tealDark};border-color:${BRAND.tealDark}}
.ph-dl-wall{margin-inline-start:auto;font-size:11.5px;padding:4px 11px}
/* lightbox */
.ph-lb{position:fixed;inset:0;z-index:80;background:rgba(20,20,22,.92);display:flex;align-items:center;justify-content:center}
.ph-lb[hidden]{display:none}
.ph-lb-img{max-width:92vw;max-height:82vh;object-fit:contain;border-radius:6px;box-shadow:0 6px 40px rgba(0,0,0,.5)}
.ph-lb-cap{position:absolute;bottom:22px;left:0;right:0;text-align:center;color:#fff;font-size:14px;font-weight:600;padding:0 20px;text-shadow:0 1px 3px rgba(0,0,0,.8)}
.ph-lb-x{position:absolute;top:16px;inset-inline-end:20px;background:rgba(255,255,255,.15);color:#fff;border:0;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer}
.ph-lb-x:hover{background:rgba(255,255,255,.28)}
.ph-lb-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);color:#fff;border:0;width:46px;height:46px;border-radius:50%;font-size:28px;cursor:pointer;line-height:1}
.ph-lb-nav:hover{background:rgba(255,255,255,.28)}
.ph-lb-prev{inset-inline-end:16px}
.ph-lb-next{inset-inline-start:16px}
/* ---- קטגוריות-מדיה + וידאו ---- */
.ph-cat{margin:14px 0 6px}
.ph-cat-h{font-size:15px;font-weight:800;color:${BRAND.tealDark};margin:0 0 8px;padding-bottom:5px;border-bottom:2px solid ${BRAND.teal}33}
.vid-tile .vid-el{width:100%;height:150px;object-fit:cover;background:#000;display:block}
.vid-bar{padding:6px 8px;border-top:1px solid ${BRAND.line};display:flex}
.vid-dl{margin-inline-start:0;font-size:11.5px;padding:4px 11px}
.vid-kind{background:${BRAND.orange}22;color:#8a5a00}
.vid-ph{height:150px;line-height:1.5}
/* ---- באנר-שלמות ---- */
.cmpl-wrap{margin:0 0 16px}
.cmpl-banner{border-radius:12px;padding:14px 18px;margin-bottom:12px;border:1.5px solid}
.cmpl-done{background:#E7F3EE;border-color:${BRAND.green};color:${BRAND.green}}
.cmpl-open{background:#FDF3E0;border-color:${BRAND.amber};color:${BRAND.amber}}
.cmpl-title{font-size:18px;font-weight:800}
.cmpl-sub{font-size:13px;font-weight:600;color:${BRAND.ink};margin-top:2px}
.cmpl-access{margin-top:8px;display:flex;gap:8px;flex-wrap:wrap}
.cmpl-pill{border-radius:999px;padding:3px 11px;font-size:12px;font-weight:700}
.cmpl-pill.ok{background:${BRAND.green}1f;color:${BRAND.green}}
.cmpl-pill.miss{background:${BRAND.red}1f;color:${BRAND.red}}
.cmpl-rooms{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.cmpl-room{background:${BRAND.paper};border:1px solid ${BRAND.line};border-radius:10px;padding:11px 13px}
.cmpl-room-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}
.cmpl-room-name{font-size:14px;font-weight:800;color:${BRAND.ink}}
.cmpl-count{border-radius:999px;padding:2px 10px;font-size:12px;font-weight:800}
.cmpl-count.ok{background:${BRAND.green}1f;color:${BRAND.green}}
.cmpl-count.miss{background:${BRAND.amber}22;color:${BRAND.amber}}
.cmpl-list{margin:4px 0 0;padding-inline-start:2px;list-style:none;font-size:12px;line-height:1.7}
.cmpl-ok li{color:${BRAND.green}}
.cmpl-skip li{color:${BRAND.muted}}
@media(max-width:820px){.page{width:auto;min-height:0}.tb-navs{display:none}}
`;
}

// ---------------------------------------------------------------------------
// §תמונות — גלריית-צילום מקובצת-לפי-חזית (חוזה §2.3). התמונות מגיעות מ-
// model.photos[] (ראה readSol.readPhotos): { file, name, scope, wallIdx(0-based),
// wallLabel, seq, kind, caption, w, h, bytes, buffer }.
//   • כל JPEG מוטמע כ-data-URI (base64) → הדוח עצמאי לחלוטין, ללא-CDN.
//   • שמירת-משקל: תקציב-רך של 12MB (אזהרה) + תקרה-קשה של 20MB (מעבר לה
//     מפסיקים להטמיע כדי לא לנפח את-הקובץ; תמונות-שנחתכו מוצגות כפלייסהולדר
//     ולא נכללות ב-ZIP). אין ספריית-הקטנה חיצונית (dependency-free), לכן
//     ההגנה היא ברמת-התקציב ולא הקטנת-רזולוציה בפועל.
//   • כיתוב = name + תג-kind (מגדר-זכר, עברית). לחיצה → lightbox-זום.
// ---------------------------------------------------------------------------
const PHOTO_EMBED_BUDGET = 12 * 1024 * 1024; // רך — אזהרה בלבד
const PHOTO_EMBED_HARD_CAP = 20 * 1024 * 1024; // קשה — מפסיקים להטמיע תמונות
// וידאו כבד — תקציב נפרד וקטן. מטמיעים רק סרטונים קצרים/קלים כ-data-URI; מעבר
// לתקרה מציגים כרטיס-מידע עם גודל+הערה (הסרטון נשאר במקור-ה-.sol).
const VIDEO_EMBED_PER_CAP = 8 * 1024 * 1024;   // לכל-סרטון
const VIDEO_EMBED_TOTAL_CAP = 40 * 1024 * 1024; // סך-הכל

const PHOTO_KIND_HE = {
  // חוזה-סופי — קבוצת-ה-kind המלאה (§5, מגדר-זכר):
  overview: 'סקירה כללית', access: 'גישה', explainer: 'הסבר',
  elevation: 'חזית', detail_tape: 'פרט עם מטר', far: 'רחוק', closeup: 'תקריב',
  obstacle: 'מכשול', junction: 'מפגש', ceiling: 'תקרה', floor: 'רצפה',
  // תאימות-לאחור לשמות-ישנים:
  context: 'הקשר', detail: 'תקריב', 'scale-ref': 'קנה-מידה',
  'annotation-on-photo': 'סימון',
};
function photoKindHe(k) { return PHOTO_KIND_HE[k] || (k ? String(k) : 'תמונה'); }

// קטגוריות-הגלריה (§5.4) — סדר-הצגה + תווית-עברית. הגלריה מקובצת-לפי-קטגוריה.
const MEDIA_CATEGORIES = [
  ['overview',    'תמונות כלליות'],
  ['elevation',   'חזיתות'],
  ['detail_tape', 'פרטים עם מטר'],
  ['far',         'תמונות רחוקות'],
  ['closeup',     'תקריבים'],
  ['explainer',   'סרטוני הסבר'],
  ['other',       'פרטים נוספים'],
];
const MEDIA_CAT_HE = Object.fromEntries(MEDIA_CATEGORIES);

// ממפה kind+scope של פריט-מדיה לקטגוריית-גלריה. גישה (access/scope=project)
// מטופלת בנפרד ברמת-הפרויקט ולכן לא-מוחזרת כאן.
function mediaCategory(kind) {
  switch (kind) {
    case 'overview': return 'overview';
    case 'elevation': case 'context': return 'elevation';
    case 'detail_tape': case 'detail': return 'detail_tape';
    case 'far': return 'far';
    case 'closeup': return 'closeup';
    case 'explainer': return 'explainer';
    default: return 'other'; // obstacle/junction/ceiling/floor/scale-ref/…
  }
}
function isAccessMedia(m) { return m.scope === 'project' || m.kind === 'access'; }

// מכינה את התמונות להטמעה: מקצה מזהה, מסמנת מה מוטמע לפי-תקציב, ומקבצת
// לפי-חזית (wallIdx). מחזירה { list, groups, embeddedBytes, totalBytes,
// skipped, overBudget } כאשר groups = [{ key, label, wallIdx, photos:[pp] }].
function prepPhotos(photos) {
  const list = [];
  let cum = 0, total = 0, skipped = 0;
  (photos || []).forEach((p, i) => {
    const buf = p.buffer;
    const bytes = buf ? buf.length : (p.bytes || 0);
    total += bytes;
    let embedded = false, b64 = null;
    if (buf && buf.length) {
      if (cum + buf.length <= PHOTO_EMBED_HARD_CAP) { embedded = true; b64 = buf.toString('base64'); cum += buf.length; }
      else skipped++;
    } else { skipped++; }
    list.push({
      id: 'ph' + i, name: p.name || ('תמונה ' + (i + 1)), file: p.file || '',
      scope: p.scope || 'wall', wallIdx: (p.wallIdx == null ? null : p.wallIdx),
      wallLabel: p.wallLabel || (p.wallIdx == null ? 'חדר' : 'חזית ' + (p.wallIdx + 1)),
      kind: p.kind || 'context', caption: p.caption || '', seq: p.seq,
      phase: p.phase || null, roomId: (p.roomId == null ? null : p.roomId),
      category: mediaCategory(p.kind || 'context'), access: isAccessMedia(p),
      w: p.w, h: p.h, bytes, embedded, b64,
      zipName: (p.file ? p.file.replace(/^photos\//i, '') : ((p.name || ('photo_' + (i + 1))) + '.jpg')),
    });
  });
  // קיבוץ לפי-חזית: תמונות-חדר (wallIdx=null / scope=room) בקבוצה נפרדת בסוף.
  const map = new Map();
  for (const pp of list) {
    const key = (pp.wallIdx == null) ? 'room' : ('w' + pp.wallIdx);
    if (!map.has(key)) map.set(key, { key, wallIdx: pp.wallIdx, label: pp.wallLabel, photos: [] });
    map.get(key).photos.push(pp);
  }
  // מיון: חזיתות לפי-אינדקס-עולה, קבוצת-החדר אחרונה.
  const groups = [...map.values()].sort((a, b) => {
    if (a.wallIdx == null) return 1;
    if (b.wallIdx == null) return -1;
    return a.wallIdx - b.wallIdx;
  });
  return { list, groups, embeddedBytes: cum, totalBytes: total, skipped, overBudget: total > PHOTO_EMBED_BUDGET };
}

// מכינה את הסרטונים: מטמיעה כ-data-URI רק סרטונים בתוך-התקציב (per-cap+total);
// סרטון-כבד מסומן notEmbedded עם גודלו (מוצג ככרטיס-הורדה/הערה, לא-data-URI ענק).
// מחזירה { list, embeddedBytes, totalBytes, skipped } — list = [vv].
function prepVideos(videos) {
  const list = [];
  let cum = 0, total = 0, skipped = 0;
  (videos || []).forEach((v, i) => {
    const buf = v.buffer;
    const bytes = buf ? buf.length : (v.bytes || 0);
    total += bytes;
    let embedded = false, b64 = null;
    if (buf && buf.length && buf.length <= VIDEO_EMBED_PER_CAP && cum + buf.length <= VIDEO_EMBED_TOTAL_CAP) {
      embedded = true; b64 = buf.toString('base64'); cum += buf.length;
    } else { skipped++; }
    list.push({
      id: 'vid' + i, name: v.name || ('סרטון ' + (i + 1)), file: v.file || '',
      scope: v.scope || 'room', wallIdx: (v.wallIdx == null ? null : v.wallIdx),
      wallLabel: v.wallLabel || (v.wallIdx == null ? 'חדר' : 'חזית ' + (v.wallIdx + 1)),
      kind: v.kind || 'explainer', caption: v.caption || '', seq: v.seq,
      phase: v.phase || null, roomId: (v.roomId == null ? null : v.roomId),
      category: mediaCategory(v.kind || 'explainer'), access: isAccessMedia(v),
      durationSec: v.durationSec, bytes, embedded, b64,
      dlName: (v.file ? v.file.replace(/^videos\//i, '') : ((v.name || ('video_' + (i + 1))) + '.mp4')),
    });
  });
  return { list, embeddedBytes: cum, totalBytes: total, skipped };
}

function fmtMB(bytes) { return (bytes / (1024 * 1024)).toFixed(1); }
function fmtDur(sec) {
  if (sec == null || !isFinite(sec)) return '';
  const s = Math.round(sec), m = Math.floor(s / 60), r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

// תג-kind צבעוני קטן ליד הכיתוב.
function photoKindBadge(kind) {
  return `<span class="ph-kind">${esc(photoKindHe(kind))}</span>`;
}

// תמונה-ממוזערת אחת. ה-base64 מוטמע ישירות ב-src (data-URI) — כך התמונות
// נראות גם ללא-JS, וה-base64 מופיע פעם-אחת במסמך. ה-lightbox וה-ZIP קוראים
// את ה-src והמטא מתוך ה-DOM (data-*). לחיצה → זום.
function photoThumb(pp) {
  const cap = esc(pp.name) + (pp.caption ? ` — ${esc(pp.caption)}` : '');
  if (!pp.embedded) {
    return `<figure class="ph-tile ph-skip" title="${cap}">`
      + `<div class="ph-ph">התמונה לא הוטמעה (חריגה מתקציב-המשקל)</div>`
      + `<figcaption class="ph-cap">${esc(pp.name)} ${photoKindBadge(pp.kind)}</figcaption></figure>`;
  }
  const wattr = pp.wallIdx == null ? '' : ` data-wall="${esc(String(pp.wallIdx))}"`;
  return `<figure class="ph-tile"${wattr}>`
    + `<button class="ph-btn" data-open aria-label="${cap}">`
    + `<img class="ph-img" src="data:image/jpeg;base64,${pp.b64}" alt="${cap}"`
    + ` data-name="${esc(pp.name)}" data-cap="${esc(pp.caption || '')}"`
    + ` data-kind="${esc(photoKindHe(pp.kind))}" data-zip="${esc(pp.zipName)}"${wattr} loading="lazy"/></button>`
    + `<figcaption class="ph-cap">${esc(pp.name)} ${photoKindBadge(pp.kind)}`
    + (pp.caption ? `<span class="ph-note">${esc(pp.caption)}</span>` : '')
    + `</figcaption></figure>`;
}

// כרטיס-וידאו אחד. סרטון-קל מוטמע כ-<video controls preload="metadata"> עם
// data-URI + כפתור-הורדה. סרטון-כבד (מעבר-לתקציב) מוצג ככרטיס-מידע עם גודלו
// והערה שהוא נשאר במקור-ה-.sol (לא-מטמיעים data-URI ענק בדוח).
function videoTile(vv) {
  const dur = fmtDur(vv.durationSec);
  const meta = `${photoKindHe(vv.kind)}${dur ? ' · ' + esc(iso(dur)) : ''} · ${esc(iso(fmtMB(vv.bytes)))} מ״ב`;
  const cap = `<figcaption class="ph-cap">${esc(vv.name)} <span class="ph-kind vid-kind">${esc(photoKindHe(vv.kind))}</span>`
    + `<span class="ph-note">${meta}</span>`
    + (vv.caption ? `<span class="ph-note">${esc(vv.caption)}</span>` : '')
    + `</figcaption>`;
  if (!vv.embedded) {
    return `<figure class="ph-tile vid-tile vid-skip">`
      + `<div class="ph-ph vid-ph">🎬 הסרטון לא הוטמע בדוח (${esc(iso(fmtMB(vv.bytes)))} מ״ב)<br/>נשמר במקור-ה-.sol</div>`
      + cap + `</figure>`;
  }
  return `<figure class="ph-tile vid-tile">`
    + `<video class="vid-el" controls preload="metadata" playsinline`
    + ` src="data:video/mp4;base64,${vv.b64}" data-name="${esc(vv.name)}" data-dl="${esc(vv.dlName)}"></video>`
    + `<div class="vid-bar"><button class="ph-dl vid-dl" data-dl="${esc(vv.dlName)}">⬇️ הורד סרטון</button></div>`
    + cap + `</figure>`;
}

// מרנדר פריט-מדיה כללי (תמונה או וידאו) לפי item.type.
function mediaTile(item) { return item.type === 'video' ? videoTile(item.m) : photoThumb(item.m); }

// ---------------------------------------------------------------------------
// באנר-שלמות (§5.4) — קורא model.checklist + model.projectChecklist. מציג
// באנר-פרויקט ("מדידה הושלמה" / חוסרים) + פירוט פר-חדר ("X/Y משימות") כולל
// משימות-שבוצעו מול משימות-שדולגו-עם-סיבה. ריק אם אין checklist (תאימות-לאחור).
// ---------------------------------------------------------------------------
const CHK_CAT_HE = {
  overview: 'תמונות כלליות', explainer: 'סרטון הסבר', elevation: 'תמונה לכל חזית',
  detail_tape: 'פרטים עם מטר', far: 'תמונות רחוקות', closeup: 'תקריבים',
};
function chkCatHe(k) { return CHK_CAT_HE[k] || String(k); }

function roomNameOf(model, roomId) {
  const rooms = (model && model.rooms) || [];
  const r = rooms.find((x) => x.id != null && String(x.id) === String(roomId));
  return (r && r.name) || ('חדר ' + roomId);
}

function completionBanner(model) {
  const chk = model && model.checklist;
  const proj = model && model.projectChecklist;
  if (!chk && !proj) return '';

  // באנר-פרויקט ראשי.
  let banner = '';
  if (proj) {
    const done = !!proj.complete;
    const access = proj.access || {};
    const accBits = [];
    for (const [k, he] of [['access_opening', 'גישה — פתיחה'], ['access_closing', 'גישה — סגירה']]) {
      const a = access[k];
      if (a) accBits.push(`<span class="cmpl-pill ${a.done ? 'ok' : 'miss'}">${esc(he)}: ${a.done ? '✓' : '✗'} (${esc(iso(a.count != null ? a.count : 0))})</span>`);
    }
    const roomsOk = proj.allRoomsComplete ? 'כל-החדרים הושלמו' : 'יש-חדרים שטרם-הושלמו';
    banner = `<div class="cmpl-banner ${done ? 'cmpl-done' : 'cmpl-open'}">`
      + `<div class="cmpl-title">${done ? '✓ מדידה הושלמה' : '● מדידה בתהליך'}</div>`
      + `<div class="cmpl-sub">${esc(roomsOk)}</div>`
      + (accBits.length ? `<div class="cmpl-access">${accBits.join('')}</div>` : '')
      + `</div>`;
  }

  // פירוט פר-חדר.
  let roomsHtml = '';
  if (chk && typeof chk === 'object') {
    for (const roomId of Object.keys(chk)) {
      const rc = chk[roomId] || {};
      const cats = rc.categories || {};
      const keys = Object.keys(cats);
      let sat = 0, req = 0;
      const done = [], skipped = [];
      for (const ck of keys) {
        const c = cats[ck] || {};
        if (c.required) req++;
        const ok = !!c.done;
        if (c.required && ok) sat++;
        const label = chkCatHe(ck)
          + (c.satisfiedCount != null && c.requiredCount != null ? ` (${iso(c.satisfiedCount)}/${iso(c.requiredCount)})` : '');
        if (c.skippedReason) skipped.push(`${chkCatHe(ck)} — ${c.skippedReason}`);
        else if (c.required) (ok ? done : skipped).push(label + (ok ? '' : ' — חסר'));
      }
      const complete = !!rc.complete;
      const list = (arr, cls, icon) => arr.length
        ? `<ul class="cmpl-list ${cls}">${arr.map((t) => `<li>${icon} ${esc(t)}</li>`).join('')}</ul>` : '';
      roomsHtml += `<div class="cmpl-room">`
        + `<div class="cmpl-room-h"><span class="cmpl-room-name">${esc(roomNameOf(model, roomId))}</span>`
        + `<span class="cmpl-count ${complete ? 'ok' : 'miss'}">${esc(iso(sat))}/${esc(iso(req))} משימות${complete ? ' ✓' : ''}</span></div>`
        + list(done, 'cmpl-ok', '✓')
        + list(skipped, 'cmpl-skip', '✗')
        + `</div>`;
    }
  }

  return `<div class="cmpl-wrap">${banner}${roomsHtml ? `<div class="cmpl-rooms">${roomsHtml}</div>` : ''}</div>`;
}

// רצועת-תמונות קומפקטית לתחתית עמוד-החזית (ליד השרטוט). ריקה אם אין תמונות.
function wallPhotoStrip(prep, wallNumber) {
  if (!prep || wallNumber == null) return '';
  const g = prep.groups.find((x) => x.wallIdx === wallNumber);
  if (!g || !g.photos.length) return '';
  const thumbs = g.photos.map(photoThumb).join('');
  return `<div class="card ph-strip"><div class="card-h">📷 תמונות חזית זו `
    + `<span class="sec-sub">(${esc(iso(g.photos.length))})</span> `
    + `<button class="ph-dl ph-dl-wall" data-wall="${esc(String(wallNumber))}">⬇️ הורד חזית</button></div>`
    + `<div class="ph-grid ph-grid-strip">${thumbs}</div></div>`;
}

// כרטיס-קבוצה גנרי (כותרת + רשת-תיבות). wallAttr אופציונלי לסינון-הורדה פר-חזית.
function mediaGroupCard(label, count, tilesHtml, wallIdx) {
  const wattr = wallIdx != null ? ` data-wall="${esc(String(wallIdx))}"` : '';
  const dl = wallIdx != null
    ? ` <button class="ph-dl ph-dl-wall" data-wall="${esc(String(wallIdx))}">⬇️ הורד חזית</button>` : '';
  return `<div class="card ph-group"${wattr}>`
    + `<div class="card-h">${esc(label)} <span class="sec-sub">(${esc(iso(count))})</span>${dl}</div>`
    + `<div class="ph-grid">${tilesHtml}</div></div>`;
}

// עמוד-הגלריה המלא — מקובץ-לפי-קטגוריית-משימה (§5.4): באנר-שלמות → גישת-פרויקט
// (פתיחה/סגירה) → פר-חדר: כללי/חזיתות(תת-קיבוץ-לפי-חזית)/פרטים/רחוק/תקריב/הסבר.
// מקבל photos-prep + videos-prep + model (לשמות-חדר ולבאנר). כולל כפתור הורדת-הכל.
function mediaGalleryPage(prep, vprep, model, pageNo, total, jobName, id) {
  const photos = (prep && prep.list) || [];
  const videos = (vprep && vprep.list) || [];
  // פריטי-מדיה מאוחדים (שומרים type כדי לרנדר בהתאם).
  const items = photos.map((m) => ({ type: 'photo', m })).concat(videos.map((m) => ({ type: 'video', m })));

  // 1. באנר-שלמות (אם יש checklist).
  const banner = completionBanner(model);

  // 2. גישת-פרויקט (opening/closing).
  const accessItems = items.filter((it) => it.m.access);
  let accessHtml = '';
  if (accessItems.length) {
    const phases = [['opening', 'פתיחת-פרויקט'], ['closing', 'סגירת-פרויקט'], [null, 'גישה']];
    let inner = '';
    for (const [ph, he] of phases) {
      const grp = accessItems.filter((it) => (it.m.phase || null) === ph);
      if (!grp.length) continue;
      inner += mediaGroupCard(he, grp.length, grp.map(mediaTile).join(''));
    }
    accessHtml = `<div class="ph-cat"><h3 class="ph-cat-h">🚪 גישה לאתר</h3>${inner}</div>`;
  }

  // 3. פר-חדר. מקבצים לפי roomId אם קיים; אחרת דלי-יחיד (המקרה-הנפוץ חד-חדרי).
  const roomItems = items.filter((it) => !it.m.access);
  const byRoom = new Map();
  let anyRoomId = false;
  for (const it of roomItems) {
    const rid = (it.m.roomId == null) ? '' : String(it.m.roomId);
    if (rid) anyRoomId = true;
    if (!byRoom.has(rid)) byRoom.set(rid, []);
    byRoom.get(rid).push(it);
  }
  let roomsHtml = '';
  for (const [rid, its] of byRoom) {
    const roomLabel = (anyRoomId && rid) ? roomNameOf(model, rid) : ((model.rooms && model.rooms[0] && model.rooms[0].name) || 'חדר');
    let inner = '';
    for (const [cat, catHe] of MEDIA_CATEGORIES) {
      const catItems = its.filter((it) => it.m.category === cat);
      if (!catItems.length) continue;
      if (cat === 'elevation') {
        // תת-קיבוץ לפי-חזית.
        const walls = new Map();
        for (const it of catItems) {
          const wk = (it.m.wallIdx == null) ? '' : String(it.m.wallIdx);
          if (!walls.has(wk)) walls.set(wk, []);
          walls.get(wk).push(it);
        }
        const sortedWk = [...walls.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : (+a) - (+b)));
        for (const wk of sortedWk) {
          const grp = walls.get(wk);
          const wIdx = wk === '' ? null : +wk;
          const lbl = wk === '' ? 'חזיתות' : (grp[0].m.wallLabel || ('חזית ' + (wIdx + 1)));
          inner += mediaGroupCard(lbl, grp.length, grp.map(mediaTile).join(''), wIdx);
        }
      } else {
        inner += mediaGroupCard(catHe, catItems.length, catItems.map(mediaTile).join(''));
      }
    }
    if (inner) roomsHtml += `<div class="ph-cat"><h3 class="ph-cat-h">🏠 ${esc(roomLabel)}</h3>${inner}</div>`;
  }

  // 4. אזהרות-משקל (תמונות + וידאו).
  let warn = '';
  if (prep && prep.overBudget) {
    warn += `<div class="ph-warn">שים לב: סך-התמונות ${esc(iso(fmtMB(prep.totalBytes)))} מ״ב`
      + (prep.skipped ? ` — ${esc(iso(prep.skipped))} תמונות לא הוטמעו (חריגה מתקרת-המשקל ${esc(iso(fmtMB(PHOTO_EMBED_HARD_CAP)))} מ״ב).` : ' — הדוח כבד יחסית.')
      + ` לצפייה מלאה ייצא פחות תמונות מהאפליקציה.</div>`;
  }
  if (vprep && vprep.skipped) {
    warn += `<div class="ph-warn">${esc(iso(vprep.skipped))} סרטונים לא הוטמעו בדוח (כבדים מדי) — הם נשמרים במקור-ה-.sol.</div>`;
  }

  const nPh = photos.length, nVid = videos.length;
  const countStr = `${iso(nPh)} תמונות${nVid ? ' · ' + iso(nVid) + ' סרטונים' : ''} · ${iso(fmtMB((prep ? prep.embeddedBytes : 0) + (vprep ? vprep.embeddedBytes : 0)))} מ״ב מוטמעים`;
  const dlAll = nPh ? `<button class="ph-dl ph-dl-all">⬇️ הורד תמונות</button>` : '';
  const head = `<h2 class="sec-h">מדיה <span class="sec-sub">(${esc(countStr)})</span>${dlAll}</h2>`;

  const body = banner + head + warn + accessHtml + roomsHtml;
  return pageWrap(pageNo, total, 'מדיה', body, jobName, id);
}

// מרקאפ ה-lightbox (פעם-אחת למסמך).
function photoLightboxHtml() {
  return `<div class="ph-lb" id="phLightbox" hidden>`
    + `<button class="ph-lb-x" data-lb="close" aria-label="סגור">✕</button>`
    + `<button class="ph-lb-nav ph-lb-prev" data-lb="prev" aria-label="הקודם">‹</button>`
    + `<img class="ph-lb-img" id="phLightboxImg" alt=""/>`
    + `<button class="ph-lb-nav ph-lb-next" data-lb="next" aria-label="הבא">›</button>`
    + `<div class="ph-lb-cap" id="phLightboxCap"></div></div>`;
}

// לוגיקת-ה-lightbox + בונה-ה-ZIP (STORE, dependency-free, CSP-safe). קורא את
// התמונות ישירות מה-DOM (img.ph-img, src=data-URI). ההורדה דרך Blob + <a
// download> — עובד בקובץ-HTML מקומי (לא Artifact-sandbox).
function photoScript() {
  return `<script>(function(){
  var imgs=[].slice.call(document.querySelectorAll('img.ph-img'));if(!imgs.length)return;
  function b64of(img){var s=img.getAttribute('src')||'';var i=s.indexOf(',');return i>=0?s.slice(i+1):'';}
  // ---- lightbox ----
  var cur=-1;
  var lb=document.getElementById('phLightbox');
  var lbImg=document.getElementById('phLightboxImg');
  var lbCap=document.getElementById('phLightboxCap');
  function show(i){if(i<0||i>=imgs.length)return;cur=i;var img=imgs[i];
    lbImg.src=img.getAttribute('src');
    var cap=img.getAttribute('data-cap');
    lbCap.textContent=img.getAttribute('data-name')+(cap?' — '+cap:'')+'  ['+img.getAttribute('data-kind')+']';
    lb.hidden=false;document.body.style.overflow='hidden';}
  function close(){lb.hidden=true;lbImg.src='';document.body.style.overflow='';}
  document.addEventListener('click',function(e){
    var op=e.target.closest?e.target.closest('.ph-btn'):null;
    if(op){var img=op.querySelector('img.ph-img');show(imgs.indexOf(img));return;}
    var lba=e.target.closest?e.target.closest('[data-lb]'):null;
    if(lba){var a=lba.getAttribute('data-lb');
      if(a==='close')close();else if(a==='prev')show((cur-1+imgs.length)%imgs.length);
      else if(a==='next')show((cur+1)%imgs.length);return;}
    if(e.target===lb)close();
  });
  document.addEventListener('keydown',function(e){if(lb.hidden)return;
    if(e.key==='Escape')close();else if(e.key==='ArrowRight')show((cur-1+imgs.length)%imgs.length);
    else if(e.key==='ArrowLeft')show((cur+1)%imgs.length);});
  // ---- CRC32 + מבנה-ZIP (STORE) ----
  var CRC=(function(){var t=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
  function crc32(u8){var c=0xFFFFFFFF;for(var i=0;i<u8.length;i++)c=CRC[(c^u8[i])&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
  function b64ToU8(b64){var bin=atob(b64);var u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;}
  function strU8(s){var u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i)&0xFF;return u;}
  function u16(n){return String.fromCharCode(n&0xFF,(n>>>8)&0xFF);}
  function u32(n){return String.fromCharCode(n&0xFF,(n>>>8)&0xFF,(n>>>16)&0xFF,(n>>>24)&0xFF);}
  function utf8(s){return unescape(encodeURIComponent(s));}
  function buildZip(items){
    var chunks=[],central=[],offset=0;
    items.forEach(function(it){
      var nameB=utf8(it.name);var data=it.data;var crc=crc32(data);var sz=data.length;
      var lh='PK\\x03\\x04'+u16(20)+u16(0x0800)+u16(0)+u16(0)+u16(0)+u32(crc)+u32(sz)+u32(sz)+u16(nameB.length)+u16(0)+nameB;
      chunks.push(strU8(lh));chunks.push(data);
      var cd='PK\\x01\\x02'+u16(20)+u16(20)+u16(0x0800)+u16(0)+u16(0)+u16(0)+u32(crc)+u32(sz)+u32(sz)+u16(nameB.length)+u16(0)+u16(0)+u16(0)+u16(0)+u32(0)+u32(offset)+nameB;
      central.push(cd);offset+=lh.length+sz;
    });
    var cdStr=central.join('');var cdU8=strU8(cdStr);
    var eocd='PK\\x05\\x06'+u16(0)+u16(0)+u16(items.length)+u16(items.length)+u32(cdU8.length)+u32(offset)+u16(0);
    var parts=chunks.concat([cdU8,strU8(eocd)]);
    return new Blob(parts,{type:'application/zip'});
  }
  function collect(filter){
    var seen={},items=[];
    imgs.forEach(function(img){if(filter&&!filter(img))return;var b=b64of(img);if(!b)return;
      var nm=img.getAttribute('data-zip')||(img.getAttribute('data-name')+'.jpg');
      if(seen[nm]){seen[nm]++;nm=nm.replace(/(\\.[^.]*)?$/,'_'+seen[nm]+'$1');}else seen[nm]=1;
      items.push({name:nm,data:b64ToU8(b)});});
    return items;
  }
  function download(blob,fname){var a=document.createElement('a');var url=URL.createObjectURL(blob);
    a.href=url;a.download=fname;document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1500);}
  function zipName(suffix){return 'soline-photos'+(suffix?'-'+suffix:'')+'.zip';}
  document.addEventListener('click',function(e){
    var all=e.target.closest?e.target.closest('.ph-dl-all'):null;
    if(all){var items=collect(null);if(items.length)download(buildZip(items),zipName(''));return;}
    var w=e.target.closest?e.target.closest('.ph-dl-wall'):null;
    if(w){var wi=w.getAttribute('data-wall');
      var items=collect(function(img){return String(img.getAttribute('data-wall'))===String(wi);});
      if(items.length)download(buildZip(items),zipName('wall-'+(parseInt(wi,10)+1)));return;}
  });
})();</script>`;
}

// סקריפט-וידאו עצמאי (נכלל רק כשיש סרטונים) — הורדת-סרטון-בודד מ-data-URI→Blob.
// CSP-safe, ללא-CDN. עובד בקובץ-HTML מקומי (Blob + <a download>).
function videoScript() {
  return `<script>(function(){
  function b64ToU8(b64){var bin=atob(b64);var u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;}
  function download(blob,fname){var a=document.createElement('a');var url=URL.createObjectURL(blob);
    a.href=url;a.download=fname;document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1500);}
  document.addEventListener('click',function(e){
    var vd=e.target.closest?e.target.closest('.vid-dl'):null;if(!vd)return;
    var tile=vd.closest('.vid-tile');var v=tile&&tile.querySelector('video');if(!v)return;
    var src=v.getAttribute('src')||'';var i=src.indexOf(',');
    if(i>=0){var u8=b64ToU8(src.slice(i+1));download(new Blob([u8],{type:'video/mp4'}),vd.getAttribute('data-dl')||'video.mp4');}
  });
})();</script>`;
}

function buildHtml(model, opts) {
  opts = opts || {};
  const interactive = !!opts.interactive;
  const rooms = model.rooms || [];
  const stats = { rooms: rooms.length, walls: 0, elements: 0, perimeterCm: 0 };
  for (const r of rooms) {
    const ws = (r.walls || []);
    stats.walls += ws.length;
    for (const w of ws) {
      stats.elements += (w.fixtures || []).length + (w.furnishings || []).length;
      if (w.dimensions && w.dimensions.length) stats.perimeterCm += w.dimensions.length;
    }
  }
  stats.perimeterCm = cm(stats.perimeterCm);
  const status = statusOf(model);

  // page count (v2 order): per room → vitals + constraints + plan + 3D + N elevations
  // + N envelope pages + schedule + walls table.
  let elevCount = 0;
  for (const r of rooms) elevCount += (r.walls || []).filter((w) => w.position).length;
  stats.totalPages = rooms.length * 4 /*vitals,constraints,plan,3d*/ + elevCount /*elevations*/
    + elevCount /*envelope per wall*/ + rooms.length * 2 /*schedule + walls table*/;

  const jobName = (model.job && model.job.name) || '';
  const groups = new Map(); // union of element groups across the whole model
  const pages = [];
  let pageNo = 0;

  // שכבת-תמונות (additive) — מקובצת-לפי-חזית, מוטמעת כ-data-URI. ריק ⇒ אין
  // גלריה ואין שינוי בשאר-הדוח (תאימות-לאחור מלאה). גלריה מוצגת רק במצב
  // אינטראקטיבי (תלוית-JS; במצב-הדפסה מדלגים כדי לא לפגוע ב-PDF).
  const prep = (interactive && model.photos && model.photos.length) ? prepPhotos(model.photos) : null;
  const vprep = (interactive && model.videos && model.videos.length) ? prepVideos(model.videos) : null;
  const hasPhotos = !!(prep && prep.list.some((p) => p.embedded));
  const hasVideos = !!(vprep && vprep.list.length);
  const hasChecklist = interactive && !!(model.checklist || model.projectChecklist);
  const hasMedia = hasPhotos || hasVideos || hasChecklist;
  if (hasMedia) stats.totalPages += 1; // עמוד-מדיה יחיד (גלריה+באנר-שלמות)
  const TP = stats.totalPages;
  rooms.forEach((room, ri) => {
    const indexed = indexRoom(room);
    for (const e of indexed.items) if (!groups.has(e.r.group)) groups.set(e.r.group, e.r.color);
    const ra = analyzeRoom(room, indexed);
    const closures = analyzeClosures(room);
    // 1. תמצית (vitals)
    pageNo += 1; pages.push(vitalsPage(model, room, indexed, pageNo, TP, jobName, status, ri === 0 ? 'p-home' : null));
    // 2. אילוצי תכנון (own page, before drawings)
    pageNo += 1; pages.push(constraintsPage(model, room, indexed, pageNo, TP, jobName, ri === 0 ? 'p-constr' : null));
    // 3. מבט-על + מבט תלת-מימד + חזיתות
    pageNo += 1; pages.push(planPage(room, indexed, pageNo, TP, jobName, ri === 0 ? 'p-plan' : null));
    pageNo += 1; pages.push(room3dPage(room, indexed, pageNo, TP, jobName, interactive, ri === 0 ? 'p-3d' : null, 'v3d_' + ri));
    const wallsP = (room.walls || []).filter((w) => w.position);
    wallsP.forEach((w, wi) => {
      const elems = indexed.items.filter((e) => e.wall === w);
      pageNo += 1;
      const wNum = w.number != null ? w.number : wi;
      const strip = prep ? wallPhotoStrip(prep, wNum) : '';
      pages.push(elevationPage(w, elems, wNum, pageNo, TP, jobName, room.name, (ri === 0 && wi === 0) ? 'p-elev' : null, strip));
    });
    // 4. מעטפת-בנייה — ONE WALL PER PAGE
    ra.perWall.forEach((wa, wi) => {
      pageNo += 1;
      pages.push(envelopePage(wa, closures, pageNo, TP, jobName, room.name, (ri === 0 && wi === 0) ? 'p-env' : null));
    });
    // 5. טבלאות (end)
    pageNo += 1; pages.push(schedulePage(indexed, pageNo, TP, jobName));
    pageNo += 1; pages.push(wallsTablePage(room, pageNo, TP, jobName));
  });

  // 6. עמוד-מדיה (בסוף; גלריה מקובצת-לפי-קטגוריה + באנר-שלמות). מוצג אם יש
  //    תמונות/סרטונים/רשימת-משימות. ריק לגמרי ⇒ אין עמוד (תאימות-לאחור מלאה).
  if (hasMedia) { pageNo += 1; pages.push(mediaGalleryPage(prep, vprep, model, pageNo, TP, jobName, 'p-photos')); }

  const title = esc((model.job && model.job.name) || 'דו״ח מדידה') + ' — Soline';
  const toolbar = interactive ? toolbarHtml(jobName, groups, hasMedia) : '';
  const photoBits = (hasPhotos ? (photoLightboxHtml() + photoScript()) : '') + (hasVideos ? videoScript() : '');
  const script = interactive ? (filterScript() + viz3dScript() + photoBits) : '';
  const bodyClass = interactive ? ' class="screen"' : '';
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"/>`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"/>`
    + (EMBEDDED_FONTS
      ? `<style>${EMBEDDED_FONTS}</style>`
      : `<link rel="preconnect" href="https://fonts.googleapis.com"/>`
        + `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>`
        + `<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&family=Poppins:wght@500;600&display=swap" rel="stylesheet"/>`)
    + `<title>${title}</title>`
    + `<style>${styles()}${interactive ? screenStyles() : ''}</style></head><body${bodyClass}>`
    + toolbar
    + `<main class="report">${pages.join('\n')}</main>`
    + script
    + `</body></html>`;
}

// Interactive top toolbar — brand, section nav, print, category filter chips.
function toolbarHtml(jobName, groups, hasMedia) {
  const navItems = [['#p-home', 'תמצית'], ['#p-constr', 'אילוצים'], ['#p-plan', 'תוכנית'],
    ['#p-3d', 'תלת-מימד'], ['#p-elev', 'חזיתות'], ['#p-env', 'מעטפות'], ['#p-sched', 'טבלאות']];
  if (hasMedia) navItems.push(['#p-photos', 'מדיה']);
  const nav = navItems.map(([h, t]) => `<a class="tb-nav" href="${h}">${esc(t)}</a>`).join('');
  let chips = `<button class="chip chip-all active" data-group="*">הכל</button>`;
  for (const [g, c] of groups) chips += `<button class="chip active" data-group="${esc(g)}" style="--cc:${c}"><span class="chip-d" style="background:${c}"></span>${esc(g)}</button>`;
  return `<div class="toolbar">`
    + `<div class="tb-row tb-top">${wordmark('hdr')}<span class="tb-job">${esc(jobName)}</span>`
    + `<nav class="tb-navs">${nav}</nav>`
    + `<button class="tb-print" onclick="window.print()">הדפסה / PDF</button></div>`
    + (groups.size ? `<div class="tb-row tb-filter"><span class="tb-flbl">סינון:</span>${chips}</div>` : '')
    + `</div>`;
}

function filterScript() {
  return `<script>(function(){
  var chips=[].slice.call(document.querySelectorAll('.chip'));
  var all=document.querySelector('.chip-all');
  function active(){return chips.filter(function(c){return c!==all&&c.classList.contains('active')}).map(function(c){return c.getAttribute('data-group')});}
  function apply(){
    var on=active();var everyOn=chips.filter(function(c){return c!==all}).length===on.length;
    all.classList.toggle('active',everyOn);
    document.querySelectorAll('[data-group]').forEach(function(el){
      if(el.classList.contains('chip'))return;
      var g=el.getAttribute('data-group');
      el.style.display=(on.indexOf(g)>=0)?'':'none';
    });
  }
  chips.forEach(function(c){c.addEventListener('click',function(){
    if(c===all){var turnOn=!all.classList.contains('active');chips.forEach(function(x){if(x!==all)x.classList.toggle('active',turnOn)});}
    else{c.classList.toggle('active');}
    apply();
  });});
  apply();
})();</script>`;
}

// ---------------------------------------------------------------------------
// headless browser detection + PDF rendering (fail-soft) — unchanged contract.
// ---------------------------------------------------------------------------
function browserCandidates() {
  const c = [];
  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:/Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)';
    const local = process.env['LOCALAPPDATA'] || '';
    c.push(
      path.join(pf86, 'Microsoft/Edge/Application/msedge.exe'),
      path.join(pf, 'Microsoft/Edge/Application/msedge.exe'),
      path.join(pf, 'Google/Chrome/Application/chrome.exe'),
      path.join(pf86, 'Google/Chrome/Application/chrome.exe'),
      local && path.join(local, 'Google/Chrome/Application/chrome.exe'),
    );
  } else if (process.platform === 'darwin') {
    c.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else {
    c.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
      '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/snap/bin/chromium');
  }
  return c.filter(Boolean);
}
function findBrowser() {
  for (const b of browserCandidates()) { try { if (fs.existsSync(b)) return b; } catch (_) {} }
  const names = process.platform === 'win32' ? ['msedge', 'chrome']
    : ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];
  for (const n of names) {
    try {
      const cmd = process.platform === 'win32' ? `where ${n}` : `command -v ${n}`;
      const out = cp.execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split(/\r?\n/)[0];
      if (out) return out;
    } catch (_) {}
  }
  return null;
}
function renderCommand(browser, htmlPath, pdfPath) {
  const b = browser || 'msedge';
  return `"${b}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "file:///${htmlPath.replace(/\\/g, '/')}"`;
}

/**
 * renderPdf(model, outPath, opts) -> { pdfPath, htmlPath, rendered, browser, command, bytes, vector }
 */
function renderPdf(model, outPath, opts) {
  opts = opts || {};
  if (!outPath) throw new Error('renderPdf: outPath (.pdf) is required');
  const pdfPath = /\.pdf$/i.test(outPath) ? outPath : outPath + '.pdf';
  const htmlPath = pdfPath.replace(/\.pdf$/i, '.print.html');

  const html = buildHtml(model);
  // verify: drawings must be inline vector <svg>, never raster.
  const bodyOnly = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  const vector = /<svg[\s>]/.test(bodyOnly) && !/<canvas[\s>]/.test(bodyOnly) && !/<img[\s>]/i.test(bodyOnly);
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  fs.writeFileSync(htmlPath, html, 'utf8');

  const browser = opts.browser || findBrowser();
  const command = renderCommand(browser, htmlPath, pdfPath);
  const result = { pdfPath, htmlPath, rendered: false, browser: browser || null, command, bytes: null, vector };

  if (browser) {
    try {
      const args = ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
        `--print-to-pdf=${pdfPath}`, `file:///${htmlPath.replace(/\\/g, '/')}`];
      cp.execFileSync(browser, args, { stdio: 'ignore', timeout: 60000 });
      if (fs.existsSync(pdfPath)) { result.rendered = true; result.bytes = fs.statSync(pdfPath).size; }
    } catch (e) {
      try {
        const args = ['--headless', '--disable-gpu', '--no-sandbox', `--print-to-pdf=${pdfPath}`,
          `file:///${htmlPath.replace(/\\/g, '/')}`];
        cp.execFileSync(browser, args, { stdio: 'ignore', timeout: 60000 });
        if (fs.existsSync(pdfPath)) { result.rendered = true; result.bytes = fs.statSync(pdfPath).size; }
      } catch (e2) { result.error = String(e2.message || e2); }
    }
  }

  if (opts.keepHtml === false && result.rendered) {
    try { fs.unlinkSync(htmlPath); result.htmlPath = null; } catch (_) {}
  }
  return result;
}

module.exports = {
  renderPdf, findBrowser, renderCommand, buildHtml,
  // shared report engine — reused by export_html.js so the interactive report
  // and the PDF are drawn by ONE code path and can never drift.
  resolveItem, groupOf, planSvg, elevationSvg, indexRoom, styles, BRAND, esc, iso, cm,
};

// CLI: node src/export_pdf.js <in.sol|in.ordx> [out.pdf] [--sign]
if (require.main === module) {
  const argv = process.argv.slice(2);
  const inPath = argv[0];
  if (!inPath) { console.error('usage: node src/export_pdf.js <in.sol|in.ordx> [out.pdf]'); process.exit(2); }
  const outArg = argv.find((a, i) => i > 0 && !a.startsWith('--'));
  let model;
  if (/\.sol$/i.test(inPath)) {
    const { readSol } = require('./readSol');
    const sol = readSol(inPath);
    if (sol.embeddedOrdx) { const { parseOrdxString } = require('./parseOrdx'); model = parseOrdxString(sol.embeddedOrdx.toString('utf8')); }
    else model = sol.model;
    if (model) model.photos = sol.photos || []; // שכבת-תמונות מ-annotations.json
  } else {
    const { parseOrdxFile } = require('./parseOrdx');
    model = parseOrdxFile(inPath);
  }
  const out = outArg || path.join(path.dirname(inPath), path.basename(inPath).replace(/\.(sol|ordx)$/i, '') + '.pdf');
  const r = renderPdf(model, out, {});
  console.log('print HTML :', r.htmlPath);
  if (r.rendered) console.log('PDF written:', r.pdfPath, '(' + r.bytes + ' bytes) via', r.browser);
  else { console.log('PDF not auto-rendered.'); console.log('finish manually:\n  ' + r.command); if (r.error) console.log('  last error:', r.error); }
}
