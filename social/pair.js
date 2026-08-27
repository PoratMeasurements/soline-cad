'use strict';
// Turns geo-clustered sites into candidate before/after stories.
//
// Two ways a pair shows up:
//   cross   — the site has photos in both trees (לקוחות = before, שיווק = after)
//   revisit — the same site was shot twice with a real time gap between visits,
//             even if both shoots live in the same tree. A site measured in
//             March and shot again in September is a before/after by definition.
//
// GPS proves it is the same address. It does not prove the two frames show the
// same view, so everything here is a *candidate* until it has been looked at.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const DATA = path.join(ROOT, 'data');
const { sites } = JSON.parse(fs.readFileSync(path.join(DATA, 'sites.json'), 'utf8'));
const { items } = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8'));

const byPath = new Map(items.map((r) => [r.path, r]));
const { minDaysAfter, maxDaysAfter } = cfg.pairing;
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const TODAY = new Date().toISOString().slice(0, 10);

function pick(files, limit) {
  // Spread picks across the session instead of grabbing a burst of near-identical frames.
  const recs = files.map((f) => byPath.get(f)).filter(Boolean).filter((r) => !r.dupOf);
  recs.sort((a, b) => (a.taken || a.fileTime).localeCompare(b.taken || b.fileTime));
  if (recs.length <= limit) return recs;
  const step = recs.length / limit;
  return Array.from({ length: limit }, (_, i) => recs[Math.floor(i * step)]);
}

const stories = [];

for (const s of sites) {
  const ss = s.sessions;
  if (ss.length < 2) continue;

  // Prefer a cross-tree split; otherwise take the widest time gap between visits.
  let beforeSessions, afterSessions, type;
  const afterTree = ss.filter((x) => x.side === 'after');
  const beforeTree = ss.filter((x) => x.side !== 'after');

  if (afterTree.length && beforeTree.length &&
      days(beforeTree[0].date, afterTree[afterTree.length - 1].date) >= minDaysAfter) {
    beforeSessions = beforeTree;
    afterSessions = afterTree;
    type = 'cross';
  } else {
    const gap = days(ss[0].date, ss[ss.length - 1].date);
    if (gap < minDaysAfter) continue;
    // Split at the largest jump between consecutive visits.
    let cut = 1, best = -1;
    for (let i = 1; i < ss.length; i++) {
      const d = days(ss[i - 1].date, ss[i].date);
      if (d > best) { best = d; cut = i; }
    }
    beforeSessions = ss.slice(0, cut);
    afterSessions = ss.slice(cut);
    type = 'revisit';
  }

  const beforeDate = beforeSessions[0].date;
  const afterDate = afterSessions[afterSessions.length - 1].date;
  const gap = days(beforeDate, afterDate);
  if (gap < minDaysAfter || gap > maxDaysAfter) continue;

  const beforeAssets = pick(beforeSessions.flatMap((x) => x.files), 10);
  const afterAssets = pick(afterSessions.flatMap((x) => x.files), 12);
  if (!beforeAssets.length || !afterAssets.length) continue;

  const afterVideos = afterAssets.filter((r) => r.kind === 'video').length;
  const ageDays = days(afterDate, TODAY);

  let score = 0;
  const why = [];
  if (type === 'cross') { score += 3; why.push('צולם גם בתיקיית השיווק'); }
  if (afterAssets.length >= 5) { score += 2; why.push('מלאי אחרי עשיר'); }
  else if (afterAssets.length >= 2) score += 1;
  if (afterVideos) { score += 2; why.push('יש וידאו'); }
  if (beforeAssets.length >= 4) { score += 1; why.push('כיסוי לפני טוב'); }
  if (gap >= 30) { score += 2; why.push('פער זמן משמעותי'); }
  else why.push('פער זמן קצר');
  if (ageDays <= 365) { score += 2; why.push('טרי'); }
  else if (ageDays <= 730) score += 1;
  if (s.client) { score += 1; why.push('לקוח מזוהה'); }
  if (s.shop) score += 1;

  stories.push({
    siteId: s.id, type, score, why,
    client: s.client, shop: s.shop, channel: s.channel, orderNo: s.orderNo,
    maps: s.maps, lat: s.lat, lon: s.lon,
    beforeDate, afterDate, gapDays: gap, ageDays,
    visits: ss.length,
    beforeTotal: beforeSessions.reduce((n, x) => n + x.count, 0),
    afterTotal: afterSessions.reduce((n, x) => n + x.count, 0),
    afterVideos,
    before: beforeAssets.map((r) => r.path),
    after: afterAssets.map((r) => r.path),
    verdict: null,   // filled in by the visual review pass
  });
}

// Manually declared links. GPS clustering can only see photos that still carry
// coordinates; professionally edited "after" shots have had their EXIF wiped,
// so those pairs have to be stated explicitly.
for (const m of cfg.manualPairs || []) {
  const under = (dir) => items.filter((r) => !r.dupOf && r.path.startsWith(dir + path.sep));
  const b = under(m.beforeDir), a = under(m.afterDir);
  if (!b.length || !a.length) {
    console.warn(`! קישור ידני ${m.id}: לא נמצאו קבצים (${b.length} לפני / ${a.length} אחרי)`);
    continue;
  }
  const date = (r) => (r.taken || r.fileTime).slice(0, 10);
  const bd = b.map(date).sort(), ad = a.map(date).sort();
  stories.push({
    siteId: m.id, type: 'manual', score: 99,
    why: ['קישור ידני', m.label].filter(Boolean),
    client: null, shop: m.shop || null, channel: null, orderNo: null,
    maps: null, lat: null, lon: null,
    beforeDate: bd[0], afterDate: ad[ad.length - 1],
    gapDays: days(bd[0], ad[ad.length - 1]), ageDays: days(ad[ad.length - 1], TODAY),
    visits: 2,
    beforeTotal: b.length, afterTotal: a.length,
    afterVideos: a.filter((r) => r.kind === 'video').length,
    before: pick(b.map((r) => r.path), 12).map((r) => r.path),
    after: pick(a.map((r) => r.path), 16).map((r) => r.path),
    label: m.label, note: m.note, verdict: 'ok',
  });
}

stories.sort((a, b) => b.score - a.score || b.afterTotal - a.afterTotal);

// After-tree photos with no GPS can't be clustered at all — they need a human/vision pass.
const orphanAfter = items.filter((r) => r.side === 'after' && !r.dupOf && r.lat == null && r.kind === 'image');
const orphanByDir = {};
for (const r of orphanAfter) orphanByDir[r.dir] = (orphanByDir[r.dir] || 0) + 1;

const stats = {
  generated: new Date().toISOString(),
  stories: stories.length,
  cross: stories.filter((s) => s.type === 'cross').length,
  revisit: stories.filter((s) => s.type === 'revisit').length,
  strong: stories.filter((s) => s.score >= 8).length,
  usable: stories.filter((s) => s.score >= 5).length,
  orphanAfterPhotos: orphanAfter.length,
  orphanAfterByFolder: orphanByDir,
};

fs.writeFileSync(path.join(DATA, 'stories.json'), JSON.stringify({ stats, stories }, null, 0));

const L = [];
L.push('# מלאי סיפורי לפני/אחרי — סולין');
L.push('');
L.push('> מסמך פנימי. מכיל שמות לקוחות ומיקומים — **לא לפרסום**.');
L.push('');
L.push(`נוצר: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
L.push('');
L.push(`- מועמדים שזוהו: **${stats.stories}**`);
L.push(`- מתוכם חוצי-תיקייה (לקוחות ↔ שיווק): **${stats.cross}**`);
L.push(`- ביקור חוזר באותו אתר: **${stats.revisit}**`);
L.push(`- ציון 8+: **${stats.strong}**   |   ציון 5+: **${stats.usable}**`);
L.push(`- צילומי שיווק ללא GPS שממתינים לזיהוי ידני: **${stats.orphanAfterPhotos}**`);
L.push('');
L.push('כל שורה היא **מועמד** — GPS מוכיח שזה אותו אתר, לא שזו אותה זווית.');
L.push('לבדיקה: `node thumbs.js story <מזהה>`');
L.push('');
L.push('| # | מזהה | ציון | סוג | לקוח | נגרייה | לפני | אחרי | פער | נכסים | למה |');
L.push('|---|------|------|-----|------|--------|------|------|-----|-------|-----|');
stories.forEach((s, i) => {
  L.push(`| ${i + 1} | ${s.siteId} | ${s.score} | ${s.type === 'cross' ? 'חוצה' : 'חוזר'} | ${s.client || '—'} | ${s.shop || '—'} | ${s.beforeDate} | ${s.afterDate} | ${s.gapDays}י | ${s.beforeTotal}/${s.afterTotal}${s.afterVideos ? ' 🎬' : ''} | ${s.why.join(', ')} |`);
});
L.push('');
L.push('## צילומי שיווק ללא מטא-דאטה (דורשים זיהוי ויזואלי)');
L.push('');
for (const [dir, n] of Object.entries(orphanByDir).sort((a, b) => b[1] - a[1])) {
  L.push(`- \`${dir}\` — ${n} תמונות`);
}
fs.writeFileSync(path.join(DATA, 'stories.md'), L.join('\n'));

console.log(JSON.stringify(stats, null, 2));
console.log('\n→ data/stories.json + data/stories.md');
