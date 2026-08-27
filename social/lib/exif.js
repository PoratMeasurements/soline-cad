'use strict';
// Zero-dependency EXIF reader for JPEG/HEIC-lite.
// Reads only the header window of each file, so scanning thousands of photos
// off Google Drive stays cheap. Returns capture time, GPS, camera and the
// embedded thumbnail bytes (useful for cheap visual review later).

const fs = require('fs');

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

function readValue(buf, entryOff, tiffOff, le) {
  const type = le ? buf.readUInt16LE(entryOff + 2) : buf.readUInt16BE(entryOff + 2);
  const count = le ? buf.readUInt32LE(entryOff + 4) : buf.readUInt32BE(entryOff + 4);
  const size = TYPE_SIZE[type];
  if (!size) return null;
  const total = size * count;
  let off = entryOff + 8;
  if (total > 4) {
    const ptr = le ? buf.readUInt32LE(entryOff + 8) : buf.readUInt32BE(entryOff + 8);
    off = tiffOff + ptr;
  }
  if (off < 0 || off + total > buf.length) return null;

  const rd = {
    1: (o) => buf.readUInt8(o),
    2: (o) => buf.readUInt8(o),
    3: (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o)),
    4: (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o)),
    6: (o) => buf.readInt8(o),
    7: (o) => buf.readUInt8(o),
    8: (o) => (le ? buf.readInt16LE(o) : buf.readInt16BE(o)),
    9: (o) => (le ? buf.readInt32LE(o) : buf.readInt32BE(o)),
    5: (o) => {
      const n = le ? buf.readUInt32LE(o) : buf.readUInt32BE(o);
      const d = le ? buf.readUInt32LE(o + 4) : buf.readUInt32BE(o + 4);
      return d === 0 ? 0 : n / d;
    },
    10: (o) => {
      const n = le ? buf.readInt32LE(o) : buf.readInt32BE(o);
      const d = le ? buf.readInt32LE(o + 4) : buf.readInt32BE(o + 4);
      return d === 0 ? 0 : n / d;
    },
    11: (o) => (le ? buf.readFloatLE(o) : buf.readFloatBE(o)),
    12: (o) => (le ? buf.readDoubleLE(o) : buf.readDoubleBE(o)),
  };

  if (type === 2) {
    return buf.slice(off, off + total).toString('latin1').replace(/\0.*$/, '').trim();
  }
  const out = [];
  for (let i = 0; i < count; i++) out.push(rd[type](off + i * size));
  return count === 1 ? out[0] : out;
}

function parseIFD(buf, ifdOff, tiffOff, le, wanted, out) {
  if (ifdOff + 2 > buf.length) return null;
  const n = le ? buf.readUInt16LE(ifdOff) : buf.readUInt16BE(ifdOff);
  if (n > 512) return null; // corrupt guard
  for (let i = 0; i < n; i++) {
    const e = ifdOff + 2 + i * 12;
    if (e + 12 > buf.length) break;
    const tag = le ? buf.readUInt16LE(e) : buf.readUInt16BE(e);
    if (wanted && !wanted.has(tag)) continue;
    const v = readValue(buf, e, tiffOff, le);
    if (v !== null) out[tag] = v;
  }
  const nextOff = ifdOff + 2 + n * 12;
  if (nextOff + 4 > buf.length) return null;
  return le ? buf.readUInt32LE(nextOff) : buf.readUInt32BE(nextOff);
}

const IFD0 = new Set([0x010f, 0x0110, 0x0112, 0x0132, 0x8769, 0x8825, 0x9c9b, 0x9c9e]);
const EXIF_IFD = new Set([0x9003, 0x9004, 0x9011, 0x9010, 0xa002, 0xa003, 0x829a, 0x829d, 0x8827]);
const GPS_IFD = new Set([0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x001d]);
const IFD1 = new Set([0x0201, 0x0202]);

function dms(v, ref) {
  if (!Array.isArray(v) || v.length < 3) return null;
  let d = v[0] + v[1] / 60 + v[2] / 3600;
  if (ref === 'S' || ref === 'W') d = -d;
  return Math.round(d * 1e6) / 1e6;
}

function exifDate(s) {
  if (typeof s !== 'string') return null;
  const m = s.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, Y, M, D, h, mi, se] = m;
  if (+Y < 1990 || +Y > 2100) return null;
  return `${Y}-${M}-${D}T${h}:${mi}:${se}`;
}

/** Locate the TIFF block inside a JPEG (APP1/Exif) buffer. */
function findTiff(buf) {
  if (buf.length < 4) return -1;
  // Plain JPEG marker walk
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let p = 2;
    while (p + 4 < buf.length) {
      if (buf[p] !== 0xff) { p++; continue; }
      const marker = buf[p + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { p += 2; continue; }
      if (marker === 0xda || marker === 0xd9) break; // start of scan
      const len = buf.readUInt16BE(p + 2);
      if (marker === 0xe1 && buf.slice(p + 4, p + 10).toString('latin1') === 'Exif\0\0') return p + 10;
      p += 2 + len;
    }
  }
  // HEIC / other containers: fall back to a bounded search for the Exif magic
  const idx = buf.indexOf(Buffer.from('Exif\0\0', 'latin1'));
  if (idx >= 0) return idx + 6;
  return -1;
}

/**
 * Parse EXIF out of an already-read header buffer.
 * Google Drive charges a network round trip per read, so callers that already
 * hold the file head should use this instead of re-opening the file.
 * @param {Buffer} buf
 * @param {{thumb?:boolean}} [opts]
 */
function readExifBuffer(buf, opts = {}) {
  try {
    const tiffOff = findTiff(buf);
    if (tiffOff < 0 || tiffOff + 8 > buf.length) return { ok: false, reason: 'no-exif' };

    const bom = buf.slice(tiffOff, tiffOff + 2).toString('latin1');
    const le = bom === 'II';
    if (!le && bom !== 'MM') return { ok: false, reason: 'bad-tiff' };
    const first = le ? buf.readUInt32LE(tiffOff + 4) : buf.readUInt32BE(tiffOff + 4);

    const t0 = {};
    const nextIfd = parseIFD(buf, tiffOff + first, tiffOff, le, IFD0, t0);

    const te = {};
    if (t0[0x8769]) parseIFD(buf, tiffOff + t0[0x8769], tiffOff, le, EXIF_IFD, te);
    const tg = {};
    if (t0[0x8825]) parseIFD(buf, tiffOff + t0[0x8825], tiffOff, le, GPS_IFD, tg);

    let thumb = null;
    if (opts.thumb && nextIfd) {
      const t1 = {};
      parseIFD(buf, tiffOff + nextIfd, tiffOff, le, IFD1, t1);
      if (t1[0x0201] && t1[0x0202]) {
        const s = tiffOff + t1[0x0201];
        const e = s + t1[0x0202];
        if (e <= buf.length) thumb = buf.slice(s, e);
      }
    }

    const lat = dms(tg[0x0002], tg[0x0001]);
    const lon = dms(tg[0x0004], tg[0x0003]);

    return {
      ok: true,
      taken: exifDate(te[0x9003]) || exifDate(te[0x9004]) || exifDate(t0[0x0132]),
      tzOffset: typeof te[0x9011] === 'string' ? te[0x9011] : null,
      make: t0[0x010f] || null,
      model: t0[0x0110] || null,
      orientation: t0[0x0112] || null,
      width: te[0xa002] || null,
      height: te[0xa003] || null,
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
      alt: typeof tg[0x0006] === 'number' ? Math.round(tg[0x0006] * 10) / 10 : null,
      thumb,
    };
  } catch (e) {
    return { ok: false, reason: e.code || String(e.message || e) };
  }
}

/** Convenience wrapper that opens the file itself. */
function readExif(file, opts = {}) {
  const window = opts.window || 256 * 1024;
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const stat = fs.fstatSync(fd);
    const len = Math.min(window, stat.size);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    return readExifBuffer(buf, opts);
  } catch (e) {
    return { ok: false, reason: e.code || String(e.message || e) };
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
  }
}

module.exports = { readExif, readExifBuffer };
