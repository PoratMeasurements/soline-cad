'use strict';
// Packages one story into a ready-to-publish folder: metadata-stripped images
// under neutral filenames, plus a caption stub. Nothing that leaves this folder
// carries a client name, an address, or GPS.
//
//   node export-post.js <siteId> [--label "מטבח לבן"]

const fs = require('fs');
const path = require('path');
const { stripJpeg } = require('./lib/strip');
const { readExif } = require('./lib/exif');

const DATA = path.join(__dirname, 'data');
const PUB = path.join(DATA, 'publish');

const siteId = process.argv[2];
if (!siteId) {
  console.log('usage: node export-post.js <siteId> [--label "..."]');
  process.exit(1);
}
const li = process.argv.indexOf('--label');
const label = li > 0 ? process.argv[li + 1] : null;

const { stories } = JSON.parse(fs.readFileSync(path.join(DATA, 'stories.json'), 'utf8'));
const story = stories.find((s) => s.siteId === siteId);
if (!story) { console.error('לא נמצא סיפור עם המזהה ' + siteId); process.exit(1); }

const dir = path.join(PUB, siteId);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const report = [];
let leaks = 0;

function take(src, dest) {
  const ext = path.extname(src).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') {
    const r = stripJpeg(src, dest);
    if (!r.ok) { report.push(`  ✗ ${path.basename(src)} — ${r.reason}`); return; }
    // Verify the scrub actually worked before this file is allowed out.
    const check = readExif(dest);
    const clean = !check.ok || (check.lat == null && !check.taken);
    if (!clean) { leaks++; report.push(`  ⚠ ${path.basename(dest)} — עדיין יש מטא-דאטה!`); }
    else report.push(`  ✓ ${path.basename(dest)}  (-${(r.bytesRemoved / 1024).toFixed(1)}KB)`);
  } else {
    fs.copyFileSync(src, dest);
    report.push(`  • ${path.basename(dest)} — הועתק כמו שהוא (${ext}), נקה מטא-דאטה ידנית`);
  }
}

story.before.forEach((f, i) => take(f, path.join(dir, `before_${String(i + 1).padStart(2, '0')}.jpg`)));
story.after.forEach((f, i) => {
  const ext = path.extname(f).toLowerCase();
  const isVid = ['.mp4', '.mov', '.m4v', '.avi'].includes(ext);
  take(f, path.join(dir, `after_${String(i + 1).padStart(2, '0')}${isVid ? ext : '.jpg'}`));
});

// Caption stub — deliberately free of client name and location.
const caption = `# ${label || 'פוסט לפני/אחרי'}  (${siteId})

> נכסים בתיקייה זו נוקו ממטא-דאטה. **אין לציין שם לקוח, שם נגרייה, עיר או כתובת בפוסט.**

## קופי (למילוי)
כותרת:
גוף:
קריאה לפעולה:
האשטגים:

## מידע פנימי (לא לפרסום)
- מזהה אתר: ${siteId}
- פער לפני→אחרי: ${story.gapDays} ימים
- מלאי: ${story.beforeTotal} לפני / ${story.afterTotal} אחרי${story.afterVideos ? ` (${story.afterVideos} וידאו)` : ''}
`;
fs.writeFileSync(path.join(dir, 'POST.md'), caption);

console.log(`→ ${dir}`);
console.log(report.join('\n'));
console.log(leaks ? `\n⚠ ${leaks} קבצים עדיין נושאים מטא-דאטה — אל תפרסם לפני בדיקה.` : '\n✓ כל הקבצים נקיים ממטא-דאטה מזהה.');
