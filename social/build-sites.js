'use strict';
// Clusters every geotagged photo into physical "sites" (one real-world address / job).
// A site that holds photos from BOTH the before-tree and the after-tree is a
// before/after story waiting to be published.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const DATA = path.join(ROOT, 'data');
const { items } = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8'));

const R = cfg.pairing.gpsRadiusMeters;

function meters(aLat, aLon, bLat, bLon) {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLon = (bLon - aLon) * toRad;
  const m = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(m)));
}

const geo = items.filter((r) => r.lat != null && r.lon != null && !r.dupOf);
geo.sort((a, b) => (a.taken || a.fileTime).localeCompare(b.taken || b.fileTime));

// Grid index so we only compare against nearby clusters.
const CELL = 0.0009; // ~100m
const grid = new Map();
const key = (lat, lon) => Math.round(lat / CELL) + '|' + Math.round(lon / CELL);
const clusters = [];

function neighbors(lat, lon) {
  const out = [];
  const ci = Math.round(lat / CELL), cj = Math.round(lon / CELL);
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) {
      const b = grid.get(ci + i + '|' + (cj + j));
      if (b) out.push(...b);
    }
  return out;
}

for (const r of geo) {
  let best = null, bestD = Infinity;
  for (const idx of neighbors(r.lat, r.lon)) {
    const c = clusters[idx];
    const d = meters(r.lat, r.lon, c.lat, c.lon);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (best && bestD <= R) {
    best.n++;
    best.lat += (r.lat - best.lat) / best.n;
    best.lon += (r.lon - best.lon) / best.n;
    best.photos.push(r);
  } else {
    const c = { id: 'S' + String(clusters.length + 1).padStart(4, '0'), lat: r.lat, lon: r.lon, n: 1, photos: [r] };
    clusters.push(c);
    const k = key(c.lat, c.lon);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(clusters.length - 1);
  }
}

const ORDER_RE = /(\d{3,6})\s*$/;

function label(photos) {
  // Pick the most specific folder names seen at this site.
  const chan = {}, shop = {}, job = {};
  for (const p of photos) {
    if (p.side !== 'before') continue;
    if (p.seg[0]) chan[p.seg[0]] = (chan[p.seg[0]] || 0) + 1;
    if (p.seg[1]) shop[p.seg[1]] = (shop[p.seg[1]] || 0) + 1;
    if (p.seg[2]) job[p.seg[2]] = (job[p.seg[2]] || 0) + 1;
  }
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  // Two-level trees (פורת מדידות/<job>) put the job at seg[1].
  let channel = top(chan), shopName = top(shop), jobName = top(job);
  if (!jobName && shopName && /\d/.test(shopName)) { jobName = shopName; shopName = null; }
  const m = jobName && jobName.match(ORDER_RE);
  return {
    channel,
    shop: shopName,
    job: jobName,
    orderNo: m ? m[1] : null,
    client: jobName ? jobName.replace(/\s*-\s*\d{3,6}\s*$/, '').trim() : null,
  };
}

/** Split a site's photos into shoot sessions (same day = one visit). */
function sessions(photos) {
  const byDay = new Map();
  for (const p of photos) {
    const d = (p.taken || p.fileTime).slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(p);
  }
  return [...byDay.entries()]
    .map(([date, ps]) => ({
      date,
      side: ps.every((p) => p.side === 'after') ? 'after' : ps.every((p) => p.side === 'before') ? 'before' : 'mixed',
      count: ps.length,
      videos: ps.filter((p) => p.kind === 'video').length,
      files: ps.map((p) => p.path),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const sites = clusters.map((c) => {
  const before = c.photos.filter((p) => p.side === 'before');
  const after = c.photos.filter((p) => p.side === 'after');
  const ss = sessions(c.photos);
  return {
    id: c.id,
    lat: Math.round(c.lat * 1e6) / 1e6,
    lon: Math.round(c.lon * 1e6) / 1e6,
    maps: `https://www.google.com/maps?q=${c.lat.toFixed(6)},${c.lon.toFixed(6)}`,
    ...label(c.photos),
    total: c.photos.length,
    beforeCount: before.length,
    afterCount: after.length,
    firstDate: ss[0]?.date || null,
    lastDate: ss[ss.length - 1]?.date || null,
    hasBothSides: before.length > 0 && after.length > 0,
    sessions: ss,
  };
});

sites.sort((a, b) => (b.hasBothSides - a.hasBothSides) || (b.total - a.total));

const stats = {
  generated: new Date().toISOString(),
  geotaggedPhotos: geo.length,
  sites: sites.length,
  sitesWithBothSides: sites.filter((s) => s.hasBothSides).length,
  sitesBeforeOnly: sites.filter((s) => s.beforeCount && !s.afterCount).length,
  sitesAfterOnly: sites.filter((s) => !s.beforeCount && s.afterCount).length,
  multiVisitSites: sites.filter((s) => s.sessions.length > 1).length,
};

fs.writeFileSync(path.join(DATA, 'sites.json'), JSON.stringify({ stats, sites }, null, 0));
console.log(JSON.stringify(stats, null, 2));

console.log('\n--- אתרים עם לפני ואחרי ---');
for (const s of sites.filter((x) => x.hasBothSides).slice(0, 40)) {
  console.log(`${s.id}  ${String(s.beforeCount).padStart(4)} לפני / ${String(s.afterCount).padStart(3)} אחרי  ${s.firstDate}→${s.lastDate}  ${[s.shop, s.job].filter(Boolean).join(' / ') || '(ללא שם)'}`);
}
