'use strict';
/*
 * watch_convert.js — Soline auto-export watcher.
 * =============================================================================
 * WHAT: watches a Google-Drive folder for new/changed .sol files and, the moment
 *       one settles, automatically runs the existing unified converter — turning
 *       ONE action (the app sharing a .sol into the folder) into all four CAD
 *       formats + the Hebrew report, with zero extra steps.
 *
 *   app shares  <name>.sol  ->  <watched folder>
 *        └─ watcher fires ──▶  <watched folder>/out/
 *                                 <name>.ordx  <name>.pdp
 *                                 <name>_2d.dxf  <name>_3d.dxf
 *                                 <name>_report.html  <name>.pdf
 *
 * HOW: Node built-ins only — a periodic fs.watchFile-style POLLING scan of the
 *      folder (readdir + stat on an interval). NO npm packages (no chokidar).
 *      Polling (not fs.watch) is deliberate on Windows: fs.watch there hits an
 *      uncatchable libuv assertion (nodejs/node#48437) as soon as the converter
 *      writes its own outputs back into the watched folder, and a native assert
 *      cannot be caught — so it would crash the whole watcher. Polling is immune
 *      and is also more reliable with Google-Drive sync, which frequently does
 *      not emit fs.watch events at all.
 *      Each .sol is debounced ~2s and its size must be STABLE before converting,
 *      so a half-synced partial write from Google Drive is never fed to the
 *      converter. Errors are handled per-file: one bad .sol logs a failure line
 *      and the watcher keeps running.
 *
 * RUN:
 *      node watch_convert.js                 (watches the default Drive inbox)
 *      node watch_convert.js --dir "D:\some\folder"
 *      node watch_convert.js --once          (convert everything present, then exit)
 *
 * NOTE: this must run on the PC while Michael works — see docs/AUTO_EXPORT.md.
 */

const fs = require('fs');
const path = require('path');
const { convert } = require('./soline_convert');

// Default watched folder — a sensible Drive path. Created if missing.
const DEFAULT_DIR = 'G:\\My Drive\\Soline-Inbox';

const DEBOUNCE_MS = 2000;   // wait this long after the last event before acting
const SETTLE_MS = 1000;     // poll interval while waiting for the size to stabilise
const STABLE_HITS = 2;      // consecutive equal-size polls => file finished writing
const POLL_MS = 3000;       // fs.watchFile-style folder poll interval (readdir + stat)

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const o = { dir: DEFAULT_DIR, once: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir' || a === '-d') o.dir = argv[++i];
    else if (a.startsWith('--dir=')) o.dir = a.slice('--dir='.length);
    else if (a === '--once') o.once = true;
    else if (!a.startsWith('-')) o.dir = a; // bare positional dir
  }
  return o;
}

// ---------------------------------------------------------------------------
// Hebrew logging (timestamped success/fail lines)
// ---------------------------------------------------------------------------
function stamp() { return new Date().toLocaleString('he-IL'); }
function log(msg) { console.log('[' + stamp() + '] ' + msg); }

// ---------------------------------------------------------------------------
// State
//   done     : resolved(.sol path) -> "mtimeMs:size" already converted (skip)
//   pending  : resolved(.sol path) -> debounce timer
//   busy     : set of paths currently converting (guard against double-fire)
// ---------------------------------------------------------------------------
const done = new Map();
const pending = new Map();
const busy = new Set();

function isSol(f) { return /\.sol$/i.test(f); }
function sig(st) { return st.mtimeMs + ':' + st.size; }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Wait until the .sol size stops changing (finished syncing/writing). Returns the
// final fs.Stats, or null if the file vanished / never settled.
async function waitStable(solPath) {
  let last = -1, hits = 0;
  for (let i = 0; i < 40; i++) { // ~40s max guard
    let st;
    try { st = fs.statSync(solPath); } catch { return null; }
    if (st.size > 0 && st.size === last) {
      if (++hits >= STABLE_HITS) return st;
    } else { hits = 0; last = st.size; }
    await sleep(SETTLE_MS);
  }
  try { return fs.statSync(solPath); } catch { return null; }
}

// Convert one .sol -> all formats into <folder>/out. Never throws.
async function handleSol(solPath) {
  const key = path.resolve(solPath);
  if (busy.has(key)) return;
  busy.add(key);
  try {
    const st = await waitStable(solPath);
    if (!st) { log('דילוג: הקובץ נעלם או לא התייצב — ' + path.basename(solPath)); return; }
    if (done.get(key) === sig(st)) return; // already converted this exact version

    const outDir = path.join(path.dirname(solPath), 'out');
    const base = path.basename(solPath);
    log('ממיר: ' + base + ' (' + st.size + ' בייט) …');

    let res;
    try {
      res = convert(solPath, outDir);
    } catch (e) {
      log('✗ כשל בהמרת ' + base + ': ' + e.message);
      return;
    }

    // Summarise which of the six outputs landed on disk.
    const labels = { ordx: 'ORDX', pdp: 'PDP', dxf2d: 'DXF-2D', dxf3d: 'DXF-3D', html: 'HTML', pdf: 'PDF' };
    const okList = [], warnList = [];
    for (const k of ['ordx', 'pdp', 'dxf2d', 'dxf3d', 'html', 'pdf']) {
      const fo = res.formats[k] || {};
      if (fo.file) okList.push(labels[k]);
      else if (fo.htmlOnly) warnList.push(labels[k] + ' (HTML בלבד — אין דפדפן ל-PDF)');
      else if (fo.skipped) warnList.push(labels[k] + ' (דילוג: ' + fo.skipped + ')');
      else if (fo.error) warnList.push(labels[k] + ' (שגיאה: ' + fo.error + ')');
    }

    // The four CAD formats are the contract; report is a bonus.
    const cadOk = ['ordx', 'pdp', 'dxf2d', 'dxf3d'].filter((k) => res.formats[k] && res.formats[k].file).length;
    const head = cadOk === 4 ? '✓ הצליח' : (cadOk > 0 ? '⚠ חלקי' : '✗ נכשל');
    log(head + ': ' + base + ' → ' + outDir);
    log('    נוצרו (' + okList.length + '): ' + (okList.join(', ') || 'ללא'));
    if (warnList.length) log('    אזהרות: ' + warnList.join(' · '));

    // Mark done only when we actually produced the CAD set (so a transient
    // failure gets retried on the next event/rescan).
    if (cadOk === 4) done.set(key, sig(st));
  } finally {
    busy.delete(key);
  }
}

// Debounced trigger for a single file name inside the watched dir.
function trigger(dir, filename) {
  if (!filename || !isSol(filename)) return;
  const solPath = path.join(dir, filename);
  const key = path.resolve(solPath);
  if (pending.has(key)) clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => {
    pending.delete(key);
    if (fs.existsSync(solPath)) handleSol(solPath);
  }, DEBOUNCE_MS));
}

// Scan the folder once and trigger any .sol not yet converted at its current sig.
function scan(dir, immediate) {
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return; }
  for (const f of entries) {
    if (!isSol(f)) continue;
    const solPath = path.join(dir, f);
    let st; try { st = fs.statSync(solPath); } catch { continue; }
    if (!st.isFile()) continue;
    if (done.get(path.resolve(solPath)) === sig(st)) continue; // unchanged, already done
    if (immediate) handleSol(solPath); else trigger(dir, f);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const once = parsed.once;
  // Normalise to native separators. fs.watch on Windows asserts inside libuv
  // (fs-event.c) when handed a forward-slash path, so path.resolve() is required
  // for correctness, not just tidiness.
  const dir = path.resolve(parsed.dir);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log('נוצרה תיקיית-קלט: ' + dir);
  }

  if (once) {
    log('סריקה חד-פעמית של: ' + dir);
    scan(dir, true);
    // Give async conversions time to finish before exit.
    const wait = setInterval(() => { if (busy.size === 0) { clearInterval(wait); log('סיום סריקה חד-פעמית.'); } }, 500);
    return;
  }

  log('צופה בתיקייה: ' + dir);
  log('שחרר קובץ .sol לכאן → ייווצרו אוטומטית ORDX + PDP + DXF-2D + DXF-3D + דו״ח HTML/PDF בתת-תיקייה out\\.');
  log('לעצירה: Ctrl+C.  (המחשב חייב להישאר דולק והתוכנה פועלת.)');

  // Convert anything already sitting in the folder on startup, then poll for
  // changes. Polling (fs.watchFile-style) — deliberately NOT fs.watch — see the
  // file header: fs.watch crashes the process on Windows once we write outputs
  // back into the watched folder.
  scan(dir, false);
  setInterval(() => scan(dir, false), POLL_MS);
}

main();
