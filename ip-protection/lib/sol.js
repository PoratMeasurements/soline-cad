'use strict';
/*
 * sol.js — Soline IP stamp / detect for the `.sol` container (a ZIP).
 * =============================================================================
 * `.sol` is Soline's INTERNAL source-of-truth (see readSol.js). It is the least
 * likely artefact to leak to a third party (customers receive DXF/PDF/HTML, not
 * `.sol`), so it gets a lightweight, fully-readable mark rather than stego:
 *
 *   1. A stored ZIP entry `soline_fingerprint.json` — the token + origin, plain.
 *   2. A `solineFingerprint` field added to `manifest.json`.
 *   3. The token set as the ZIP archive COMMENT (EOCD) — a grep-friendly backup.
 *
 * We read the archive with the same minimal unzip the converter uses, then
 * rewrite a fresh STORED zip containing every original entry plus the mark, so
 * the result is still a valid `.sol` that readSol.js opens unchanged.
 *
 * Public: stamp(buf, token, opts) · detect(buf)
 */

const zlib = require('zlib');
const FP = require('./fingerprint');

// ---- CRC32 ----------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---- minimal reader (central-directory based; store + deflate) ------------
function unzip(buf) {
  const EOCD = 0x06054b50, CD = 0x02014b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a .sol/ZIP (no EOCD)');
  const cdCount = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const names = [], entries = {};
  for (let n = 0; n < cdCount; n++) {
    if (buf.readUInt32LE(p) !== CD) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(localOff + 26), lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    entries[name] = method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw);
    names.push(name);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { names, entries };
}

// ---- minimal writer (STORE only) ------------------------------------------
function zip(files, comment) {
  const locals = [], central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + data.length;
  }
  const localBuf = Buffer.concat(locals);
  const centralBuf = Buffer.concat(central);
  const commentBuf = Buffer.from(comment || '', 'utf8');
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12); eocd.writeUInt32LE(localBuf.length, 16);
  eocd.writeUInt16LE(commentBuf.length, 20);
  return Buffer.concat([localBuf, centralBuf, eocd, commentBuf]);
}

function stamp(sol, token, opts) {
  opts = opts || {};
  const buf = Buffer.isBuffer(sol) ? sol : Buffer.from(sol);
  const { names, entries } = unzip(buf);

  // add manifest field
  if (entries['manifest.json']) {
    try {
      const m = JSON.parse(entries['manifest.json'].toString('utf8'));
      m.solineFingerprint = token;
      entries['manifest.json'] = Buffer.from(JSON.stringify(m, null, 2), 'utf8');
    } catch { /* leave manifest as-is if unparseable */ }
  }
  // add the dedicated fingerprint entry
  const fp = { magic: 'SOLINE-IP', token, project: opts.pid || null, customer: opts.cid || null, tier: opts.tier || null, stampedAt: new Date().toISOString() };
  const fpName = 'soline_fingerprint.json';
  entries[fpName] = Buffer.from(JSON.stringify(fp, null, 2), 'utf8');
  if (!names.includes(fpName)) names.push(fpName);

  const files = names.map((name) => ({ name, data: entries[name] }));
  return zip(files, 'SOLINE-FP: ' + token);
}

function detect(sol) {
  const buf = Buffer.isBuffer(sol) ? sol : Buffer.from(sol);
  const out = { tokens: [], channels: { fpFile: false, manifest: false, comment: false } };
  const add = (t) => { const found = FP.scanText(t); for (const x of found) if (!out.tokens.includes(x)) out.tokens.push(x); };
  try {
    const { entries } = unzip(buf);
    if (entries['soline_fingerprint.json']) { out.channels.fpFile = true; add(entries['soline_fingerprint.json'].toString('utf8')); }
    if (entries['manifest.json']) { const s = entries['manifest.json'].toString('utf8'); if (/solineFingerprint/.test(s)) out.channels.manifest = true; add(s); }
  } catch { /* fall through to raw scan */ }
  // raw scan also catches the EOCD comment
  const raw = buf.toString('latin1');
  if (/SOLINE-FP:/.test(raw)) out.channels.comment = true;
  add(raw);
  return out;
}

module.exports = { stamp, detect, unzip, zip };
