'use strict';
// Removes identifying metadata from a JPEG without re-encoding it.
//
// Soline's rule is "photos only — no names, no location". An untouched iPhone
// JPEG carries the exact GPS coordinates of a client's home inside the file, so
// posting the original would leak the address even though the caption doesn't.
// This drops every APPn/COM segment that can carry identity (Exif, XMP, IPTC),
// keeps the ICC colour profile, and re-injects a 26-byte Exif block holding
// nothing but the Orientation flag — otherwise portrait shots come out rotated.

const fs = require('fs');

/** Minimal little-endian Exif APP1 carrying only tag 0x0112 (Orientation). */
function orientationOnlyApp1(orientation) {
  const tiff = Buffer.alloc(26);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);        // one entry
  tiff.writeUInt16LE(0x0112, 10);  // Orientation
  tiff.writeUInt16LE(3, 12);       // SHORT
  tiff.writeUInt32LE(1, 14);       // count
  tiff.writeUInt16LE(orientation, 18);
  tiff.writeUInt32LE(0, 22);       // no IFD1
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const head = Buffer.alloc(4);
  head.writeUInt16BE(0xffe1, 0);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}

const DROP = new Set([
  0xe1, // APP1  — Exif (GPS, camera, timestamps) and XMP
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec,
  0xed, // APP13 — Photoshop/IPTC (author, location, captions)
  0xee, 0xef,
  0xfe, // COM   — free-text comments
]);

/**
 * Scrub an in-memory JPEG. Kept separate from file IO so callers can run many
 * of these concurrently — Drive is slow enough that serial copying is painful.
 * @returns {{ok:boolean, reason?:string, out?:Buffer, bytesRemoved?:number, orientation?:number}}
 */
function stripBuffer(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return { ok: false, reason: 'not-jpeg' };

  // Recover Orientation before we throw the Exif away.
  let orientation = 1;
  try {
    const { readExifBuffer } = require('./exif');
    const x = readExifBuffer(buf.subarray(0, Math.min(buf.length, 192 * 1024)));
    if (x.ok && x.orientation >= 1 && x.orientation <= 8) orientation = x.orientation;
  } catch {}

  const out = [Buffer.from([0xff, 0xd8])];
  let p = 2;
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xff) { p++; continue; }
    const marker = buf[p + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(buf.subarray(p, p + 2));
      p += 2;
      continue;
    }
    if (marker === 0xda) {           // start of scan — image data runs to EOF
      out.push(buf.subarray(p));
      p = buf.length;
      break;
    }
    if (marker === 0xd9) { out.push(buf.subarray(p, p + 2)); p += 2; break; }

    const len = buf.readUInt16BE(p + 2);
    if (len < 2 || p + 2 + len > buf.length) return { ok: false, reason: 'malformed-segment' };
    if (!DROP.has(marker)) out.push(buf.subarray(p, p + 2 + len));
    p += 2 + len;
  }

  if (orientation !== 1) out.splice(1, 0, orientationOnlyApp1(orientation));

  const result = Buffer.concat(out);
  return { ok: true, out: result, bytesRemoved: buf.length - result.length, orientation };
}

function stripJpeg(srcPath, destPath) {
  const r = stripBuffer(fs.readFileSync(srcPath));
  if (r.ok) fs.writeFileSync(destPath, r.out);
  return r;
}

module.exports = { stripJpeg, stripBuffer };
