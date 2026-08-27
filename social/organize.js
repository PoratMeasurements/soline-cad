'use strict';
// Turns the flat catalog into an ordered picture of the archive: one record per
// project, plus a report of everything that is messy — duplicates, junk folders,
// photos sitting outside any project, projects with no usable date.
//
//   node organize.js   →  data/projects.json, data/ORGANIZE.md, data/duplicates.md

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const { items, stats: catStats } = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8'));

// How many folder levels identify a project, per top-level channel.
const DEPTH = {
  'תקיות צד לקוח': 3,   // <ערוץ>/<נגרייה>/<לקוח - מספר הזמנה>
  'תיקיות עריכה': 2,
  'פורת מדידות': 2,
  'פרטיים': 2,
  'תרגולים': 2,
  'תוכן לאתר': 2,
};

const JUNK_RE = /^(test[-_ ]?\d*|\d{1,3}|new folder.*|תיקייה חדשה.*|copy.*|העתק.*)$/i;

function projectKey(r) {
  if (!r.seg.length) return { key: '(שורש)', level: 0, orphan: true };
  const d = DEPTH[r.seg[0]] ?? 2;
  const seg = r.seg.slice(0, Math.min(d, r.seg.length));
  return { key: seg.join(' / '), seg, orphan: r.seg.length < Math.min(d, 2) };
}

const projects = new Map();
for (const r of items) {
  const { key, seg = [], orphan } = projectKey(r);
  let p = projects.get(key);
  if (!p) {
    p = {
      key, side: r.side, seg, orphan: !!orphan,
      channel: seg[0] || null,
      group: seg.length > 2 ? seg[1] : null,          // נגרייה / חברה
      name: seg[seg.length - 1] || null,
      total: 0, images: 0, videos: 0, dup: 0, bytes: 0, dupBytes: 0,
      withGps: 0, withDate: 0, dates: new Set(), subdirs: new Set(), cams: new Set(),
      lat: null, lon: null,
    };
    projects.set(key, p);
  }
  p.total++;
  p.bytes += r.size;
  if (r.kind === 'video') p.videos++; else p.images++;
  if (r.dupOf) { p.dup++; p.dupBytes += r.size; }
  if (r.lat != null) { p.withGps++; if (p.lat === null) { p.lat = r.lat; p.lon = r.lon; } }
  if (r.taken) { p.withDate++; p.dates.add(r.taken.slice(0, 10)); }
  if (r.cam) p.cams.add(r.cam);
  const sub = r.seg.slice(seg.length).join('/');
  if (sub) p.subdirs.add(sub);
}

const list = [...projects.values()].map((p) => {
  const dates = [...p.dates].sort();
  const m = p.name && p.name.match(/(\d{3,6})\s*$/);
  return {
    ...p,
    dates: undefined,
    subdirs: [...p.subdirs],
    cams: [...p.cams],
    sessions: dates.length,
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
    orderNo: m ? m[1] : null,
    client: p.name ? p.name.replace(/\s*-\s*\d{3,6}\s*$/, '').trim() : null,
    junk: p.name ? JUNK_RE.test(p.name.trim()) : false,
    mb: Math.round(p.bytes / 1048576),
    dupMb: Math.round(p.dupBytes / 1048576),
  };
});

list.sort((a, b) => b.total - a.total);
fs.writeFileSync(path.join(DATA, 'projects.json'), JSON.stringify({ generated: new Date().toISOString(), count: list.length, projects: list }, null, 0));

// ---------- empty folders ----------
// These never reach the catalog (no media to index), so they need their own walk.
const MEDIA = new Set([...cfg.imageExt, ...cfg.videoExt]);
const SKIP = new Set(cfg.skipDirNames);
const emptyDirs = [];

function scanDirs(dir, depth) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  let media = 0, files = 0;
  for (const e of ents) {
    if (e.isDirectory()) {
      if (SKIP.has(e.name)) continue;
      media += scanDirs(path.join(dir, e.name), depth + 1);
    } else {
      files++;
      if (MEDIA.has(path.extname(e.name).toLowerCase())) media++;
    }
  }
  if (media === 0 && depth > 0) emptyDirs.push({ dir, files });
  return media;
}
for (const r of cfg.roots) if (fs.existsSync(r.path)) scanDirs(r.path, 0);
// Keep only the top of each empty branch — listing every leaf is noise.
emptyDirs.sort((a, b) => a.dir.length - b.dir.length);
const emptyTop = emptyDirs.filter((e, i) => !emptyDirs.slice(0, i).some((o) => e.dir.startsWith(o.dir + path.sep)));

// ---------- findings ----------
const empties = emptyTop.filter((e) => e.files === 0);
const noMedia = emptyTop.filter((e) => e.files > 0);
const junk = list.filter((p) => p.junk && p.total > 0)
  .concat(emptyTop.filter((e) => JUNK_RE.test(path.basename(e.dir))).map((e) => ({ key: path.relative(path.dirname(e.dir), e.dir), total: 0, mb: 0, _path: e.dir })));
const noDate = list.filter((p) => p.total > 0 && p.withDate === 0);
const noGps = list.filter((p) => p.total > 0 && p.withGps === 0);
const heavyDup = list.filter((p) => p.dup > 0).sort((a, b) => b.dupBytes - a.dupBytes);
const orphans = list.filter((p) => p.orphan && p.total > 0);

const totalBytes = items.reduce((s, r) => s + r.size, 0);
const dupBytes = items.filter((r) => r.dupOf).reduce((s, r) => s + r.size, 0);
const gb = (b) => (b / 1073741824).toFixed(2);

const byChannel = {};
for (const p of list) {
  const c = (p.side === 'after' ? 'שיווק / ' : '') + (p.channel || '(שורש)');
  const e = (byChannel[c] ||= { projects: 0, media: 0, dup: 0, bytes: 0, gps: 0 });
  e.projects++; e.media += p.total; e.dup += p.dup; e.bytes += p.bytes; e.gps += p.withGps;
}

const L = [];
L.push('# סדר בארכיון — מפת המצב');
L.push('');
L.push('> מסמך פנימי. מכיל שמות לקוחות ונגריות — **לא לפרסום**.');
L.push('');
L.push(`נוצר: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
L.push('');
L.push('## תמונת מצב');
L.push('');
L.push(`- קבצי מדיה: **${catStats.total.toLocaleString()}**  (${gb(totalBytes)} GB)`);
L.push(`- פרויקטים/תיקיות שזוהו: **${list.length}**`);
L.push(`- כפילויות מדויקות: **${catStats.duplicates.toLocaleString()}** קבצים — ${gb(dupBytes)} GB מבוזבזים`);
L.push(`- צילומים עם מיקום GPS: **${items.filter((r) => r.lat != null).length.toLocaleString()}**`);
L.push(`- צילומים עם תאריך צילום: **${items.filter((r) => r.taken).length.toLocaleString()}**`);
L.push('');
L.push('## פילוח לפי ערוץ');
L.push('');
L.push('| ערוץ | פרויקטים | מדיה | עם GPS | כפילויות | נפח |');
L.push('|---|---|---|---|---|---|');
for (const [c, e] of Object.entries(byChannel).sort((a, b) => b[1].media - a[1].media)) {
  L.push(`| ${c} | ${e.projects} | ${e.media.toLocaleString()} | ${e.gps.toLocaleString()} | ${e.dup.toLocaleString()} | ${gb(e.bytes)} GB |`);
}
L.push('');
L.push('## מה צריך תיקון');
L.push('');
L.push(`### 1. תיקיות ריקות לגמרי — ${empties.length}`);
L.push('אין בהן שום קובץ. מועמדות למחיקה.');
if (empties.length) { L.push(''); for (const e of empties.slice(0, 60)) L.push(`- \`${path.relative('G:\\My Drive', e.dir)}\``); }
L.push('');
L.push(`### 1ב. תיקיות עם קבצים אך בלי מדיה — ${noMedia.length}`);
L.push('בדרך כלל שרטוטים/PDF בלבד. לא בעיה, אבל כדאי לדעת.');
if (noMedia.length) { L.push(''); for (const e of noMedia.slice(0, 30)) L.push(`- \`${path.relative('G:\\My Drive', e.dir)}\` — ${e.files} קבצים`); }
L.push('');
L.push(`### 2. תיקיות זבל/בדיקה — ${junk.length}`);
L.push('שמות כמו `test2`, `123`, `5` — נוצרו בבדיקות ונשארו.');
if (junk.length) { L.push(''); for (const p of junk) L.push(`- \`${p._path ? path.relative('G:\\My Drive', p._path) : p.key}\`${p.total ? ` — ${p.total} קבצים, ${p.mb} MB` : ' — ריקה'}`); }
L.push('');
L.push(`### 3. כפילויות — ${heavyDup.length} פרויקטים מושפעים`);
L.push(`סה"כ ${gb(dupBytes)} GB שאפשר לשחרר. הפירוט המלא ב-\`duplicates.md\`.`);
L.push('');
L.push('| פרויקט | כפולים | נפח מבוזבז |');
L.push('|---|---|---|');
for (const p of heavyDup.slice(0, 25)) L.push(`| ${p.key} | ${p.dup} | ${p.dupMb} MB |`);
L.push('');
L.push(`### 4. צילומים ללא תאריך — ${noDate.length} פרויקטים`);
L.push('בלי EXIF אי אפשר לשייך לזמן ולכן אי אפשר לשרשר לסיפור לפני/אחרי.');
if (noDate.length) { L.push(''); for (const p of noDate.slice(0, 25)) L.push(`- \`${p.key}\` — ${p.total} קבצים`); }
L.push('');
L.push(`### 5. צילומים ללא מיקום — ${noGps.length} פרויקטים`);
L.push('בלי GPS ההצלבה האוטומטית בין לפני לאחרי לא עובדת, וצריך זיהוי ידני.');
L.push('');
L.push(`### 6. קבצים מחוץ לכל פרויקט — ${orphans.length}`);
if (orphans.length) { L.push(''); for (const p of orphans) L.push(`- \`${p.key}\` — ${p.total} קבצים`); }
L.push('');
L.push('## הפרויקטים הגדולים ביותר');
L.push('');
L.push('| פרויקט | מדיה | וידאו | ימי צילום | ראשון | אחרון | נפח |');
L.push('|---|---|---|---|---|---|---|');
for (const p of list.slice(0, 40)) {
  L.push(`| ${p.key} | ${p.total} | ${p.videos} | ${p.sessions} | ${p.firstDate || '—'} | ${p.lastDate || '—'} | ${p.mb} MB |`);
}
fs.writeFileSync(path.join(DATA, 'ORGANIZE.md'), L.join('\n'));

// ---------- duplicates detail ----------
const D = ['# כפילויות מדויקות', '', '> מסמך פנימי.', '',
  `${catStats.duplicates.toLocaleString()} קבצים כפולים, ${gb(dupBytes)} GB.`,
  '', 'הקובץ הראשון בכל קבוצה הוא זה שנשמר; השאר עותקים זהים בייט-לבייט.', ''];
const groups = new Map();
for (const r of items) {
  if (!r.fp) continue;
  if (!groups.has(r.fp)) groups.set(r.fp, []);
  groups.get(r.fp).push(r);
}
const multi = [...groups.values()].filter((g) => g.length > 1).sort((a, b) => (b.length - 1) * b[0].size - (a.length - 1) * a[0].size);
for (const g of multi.slice(0, 300)) {
  D.push(`### ${g[0].name} — ${g.length} עותקים, ${Math.round(g[0].size / 1048576 * 10) / 10} MB כל אחד`);
  for (const r of g) D.push(`- \`${r.side}: ${r.rel}\``);
  D.push('');
}
if (multi.length > 300) D.push(`_...ועוד ${multi.length - 300} קבוצות._`);
fs.writeFileSync(path.join(DATA, 'duplicates.md'), D.join('\n'));

console.log(JSON.stringify({
  projects: list.length, emptyDirs: empties.length, dirsWithoutMedia: noMedia.length, junk: junk.length,
  dupGroups: multi.length, dupFiles: catStats.duplicates, dupGB: gb(dupBytes),
  noDate: noDate.length, noGps: noGps.length, orphanFolders: orphans.length,
}, null, 2));
console.log('\n→ data/projects.json, data/ORGANIZE.md, data/duplicates.md');
