'use strict';
// Materialises the before/after library inside the marketing folder:
//
//   soline\שיווק\לפני ואחרי\<תיקיית פרויקט>\לפני\  +  \אחרי\
//
// Copies are metadata-stripped (see lib/strip.js): same pixels, same resolution,
// no re-encode — but without the GPS coordinates of a client's home baked into
// the file. The untouched originals stay where they are in לקוחות.
//
//   node build-library.js            # verified pairs only
//   node build-library.js --all      # every candidate; unverified go under _לבדיקה
//   node build-library.js --dry      # report only, writes nothing

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { stripBuffer } = require('./lib/strip');
const { readExifBuffer } = require('./lib/exif');

const DATA = path.join(__dirname, 'data');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const OUT = cfg.libraryPath;
const PER = cfg.assetsPerSide || { before: 6, after: 8 };

const { stories } = JSON.parse(fs.readFileSync(path.join(DATA, 'stories.json'), 'utf8'));
let verdicts = {};
const vPath = path.join(DATA, 'verdicts.json');
if (fs.existsSync(vPath)) verdicts = JSON.parse(fs.readFileSync(vPath, 'utf8'));

const ALL = process.argv.includes('--all');
const DRY = process.argv.includes('--dry');
const VIDEO = /\.(mp4|mov|m4v|avi)$/i;
const CONCURRENCY = 12;

const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();

// Only actual businesses may appear in a folder name. The clustering sometimes
// promotes a private client's folder into the "shop" slot, and a person's name
// must not end up on disk in the marketing tree.
const SHOPS = new Set();
{
  const { items: all } = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8'));
  for (const r of all) {
    if (r.side !== 'before') continue;
    if (r.seg[0] === 'תקיות צד לקוח' && r.seg[1]) SHOPS.add(r.seg[1]);
    if (r.seg[0] === 'תיקיות עריכה' && r.seg[1]) SHOPS.add(r.seg[1].replace(/\s*-\s*עריכה\s*$/, '').trim());
  }
}

function folderName(s, v) {
  const shop = s.shop && SHOPS.has(s.shop.replace(/\s*-\s*עריכה\s*$/, '').trim())
    ? s.shop.replace(/\s*-\s*עריכה\s*$/, '').trim()
    : null;
  const who = shop ? safe(shop) : 'ללא שיוך';
  const what = (v?.label || s.label) ? ' - ' + safe(v?.label || s.label) : '';
  return `${s.siteId} - ${who} - ${s.beforeDate.slice(0, 7)}${what}`;
}

const stats = { projects: 0, copied: 0, stripped: 0, videos: 0, leaks: 0, failed: 0, bytesIn: 0, bytesOut: 0 };
const log = [];

async function place(src, destDir, prefix, i) {
  const ext = path.extname(src);
  const base = `${prefix}_${String(i + 1).padStart(2, '0')}`;
  try {
    if (VIDEO.test(ext)) {
      if (!DRY) await fsp.copyFile(src, path.join(destDir, base + ext));
      stats.videos++; stats.copied++;
      return;
    }
    const buf = await fsp.readFile(src);
    stats.bytesIn += buf.length;
    const r = stripBuffer(buf);
    const dest = path.join(destDir, base + '.jpg');
    if (!r.ok) {
      if (!DRY) await fsp.writeFile(dest, buf);
      log.push(`    ⚠ ${base}.jpg — ${r.reason}, הועתק כמו שהוא`);
      stats.copied++; stats.bytesOut += buf.length;
      return;
    }
    if (!DRY) await fsp.writeFile(dest, r.out);
    const check = readExifBuffer(r.out.subarray(0, Math.min(r.out.length, 192 * 1024)));
    if (check.ok && (check.lat != null || check.taken)) {
      stats.leaks++;
      log.push(`    ⛔ ${base}.jpg — מטא-דאטה עדיין בקובץ!`);
    }
    stats.copied++; stats.stripped++; stats.bytesOut += r.out.length;
  } catch (e) {
    stats.failed++;
    log.push(`    ✗ ${base} — ${e.code || e.message}`);
  }
}

(async () => {
  const chosen = [];
  for (const s of stories) {
    const v = verdicts[s.siteId];
    const verdict = v?.verdict || s.verdict;
    if (verdict === 'no') continue;
    if (verdict !== 'ok' && !ALL) continue;
    chosen.push({ s, v, verified: verdict === 'ok' });
  }

  const tasks = [];
  for (const { s, v, verified } of chosen) {
    const dir = path.join(OUT, verified ? '' : '_לבדיקה', folderName(s, v));
    const bDir = path.join(dir, 'לפני');
    const aDir = path.join(dir, 'אחרי');
    if (!DRY) { await fsp.mkdir(bDir, { recursive: true }); await fsp.mkdir(aDir, { recursive: true }); }
    stats.projects++;

    const b = s.before.slice(0, PER.before);
    const a = s.after.slice(0, PER.after);
    log.push(`📁 ${path.relative(OUT, dir)}   (${b.length} לפני / ${a.length} אחרי)`);
    b.forEach((f, i) => tasks.push(() => place(f, bDir, 'לפני', i)));
    a.forEach((f, i) => tasks.push(() => place(f, aDir, 'אחרי', i)));

    if (!DRY) {
      await fsp.writeFile(path.join(dir, 'פרטים.md'), [
        `# ${folderName(s, v)}`,
        '',
        '> מסמך פנימי — לא לפרסום.',
        '',
        `- מזהה: ${s.siteId}`,
        `- סוג התאמה: ${{ cross: 'חוצה תיקיות (לקוחות ↔ שיווק)', revisit: 'ביקור חוזר באותו אתר', manual: 'קישור ידני לפי שם' }[s.type]}`,
        `- נגרייה: ${s.shop || '—'}`,
        `- לקוח: ${s.client || '—'}`,
        `- תאריך לפני: ${s.beforeDate}`,
        `- תאריך אחרי: ${s.afterDate}   (פער ${s.gapDays} ימים)`,
        `- מלאי מלא במקור: ${s.beforeTotal} לפני / ${s.afterTotal} אחרי`,
        `- ציון: ${s.score}`,
        v?.note || s.note ? `- הערה: ${v?.note || s.note}` : '',
        '',
        verified
          ? '**אומת ויזואלית.**'
          : '**טרם אומת ויזואלית.** ההתאמה נעשתה לפי GPS + תאריך — כלומר זה אותו אתר, אבל לא בהכרח אותה זווית, ולא בהכרח ש"אחרי" באמת מאוחר יותר מבחינת התקדמות העבודה.',
        '',
        '**התמונות כאן נוקו ממטא-דאטה** (GPS, תאריך, דגם מצלמה) ומוכנות לפרסום.',
        'קבצי וידאו לא נוקו — לנקות ידנית לפני העלאה.',
        '',
        'המקורות המלאים נשארו במקומם תחת `לקוחות`.',
      ].filter(Boolean).join('\n'));
    }
  }

  console.log(`${chosen.length} פרויקטים, ${tasks.length} קבצים להעתקה...`);
  let done = 0, next = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const i = next++;
      if (i >= tasks.length) return;
      await tasks[i]();
      if (++done % 100 === 0) {
        const rate = done / ((Date.now() - t0) / 1000);
        process.stdout.write(`\r  ${done}/${tasks.length}  ${rate.toFixed(1)}/s  ETA ${Math.round((tasks.length - done) / rate)}s   `);
      }
    }
  }));
  process.stdout.write('\r' + ' '.repeat(60) + '\r');

  if (!DRY && stats.projects) {
    await fsp.writeFile(path.join(OUT, 'קרא אותי.md'), [
      '# לפני ואחרי',
      '',
      `נבנה אוטומטית ${new Date().toISOString().slice(0, 10)}.`,
      '',
      'כל תיקייה כאן היא פרויקט אחד, עם `לפני/` ו-`אחרי/`.',
      '',
      '- **התמונות נוקו ממטא-דאטה** — אין בהן GPS, תאריך או דגם מצלמה. מוכנות לפרסום.',
      '- **קבצי וידאו לא נוקו.** לנקות ידנית לפני העלאה.',
      '- `_לבדיקה/` — התאמות שזוהו לפי GPS אך טרם נבדקו בעין. אותו אתר, לא בהכרח אותה זווית.',
      '- הקבצים כאן עותקים. המקורות במקומם תחת `לקוחות`.',
      '',
      '**גם כשהקובץ נקי — אין לציין בפוסט שם לקוח, שם נגרייה, עיר או כתובת.**',
      '',
      'לבנייה מחדש: `node build-library.js --all` בתיקיית `claude/soline-social`.',
    ].join('\n'));
  }

  // iPhone stores most frames sideways with an EXIF Orientation flag. Instagram
  // honours that flag; plenty of preview panes and upload tools do not, so the
  // library looks like a pile of sideways photos. Rotate the pixels for real.
  if (!DRY && !process.argv.includes('--no-rotate')) {
    console.log('\nמיישר סיבוב פיזי של התמונות...');
    const { spawnSync } = require('child_process');
    const r = spawnSync('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(__dirname, 'fix-rotation.ps1'),
      '-Path', OUT,
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const out = (r.stdout || '').trim().split('\n').slice(-3).join('\n');
    console.log(out || r.stderr || '(אין פלט)');
  }

  console.log(log.slice(0, 60).join('\n'));
  if (log.length > 60) console.log(`... ועוד ${log.length - 60} שורות`);
  console.log(`\n${DRY ? '[יבש] ' : ''}${stats.projects} פרויקטים · ${stats.copied} קבצים · ${stats.stripped} נוקו · ${stats.videos} וידאו · ${stats.failed} כשלו`);
  console.log(`נפח: ${(stats.bytesIn / 1073741824).toFixed(2)} GB → ${(stats.bytesOut / 1073741824).toFixed(2)} GB`);
  if (stats.leaks) console.log(`⛔ ${stats.leaks} קבצים עדיין נושאים מטא-דאטה.`);
  else if (!DRY) console.log('✓ כל התמונות נקיות ממטא-דאטה.');
  console.log(`→ ${OUT}`);
})();
