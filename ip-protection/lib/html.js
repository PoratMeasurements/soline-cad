'use strict';
/*
 * html.js — Soline IP stamp / detect / strip for the HTML report (export_html.js).
 * =============================================================================
 * The Soline "PDF" deliverable is produced by printing this HTML (buildHtml in
 * export_pdf.js), so the HTML channel is the practically important one for the
 * report family.
 *
 * Marks:
 *   1. METADATA  — an HTML comment `<!-- SOLINE-FP: token -->` and a
 *      `<meta name="soline:fingerprint">` in <head>. Openly readable; a
 *      "view source and delete the meta" scrub removes it.
 *   2. STEGO     — a zero-width-character run (U+200B/U+200C bits, framed by
 *      U+2060) appended inside a benign footer text node. Invisible on screen
 *      and in print, survives comment/meta removal, and copy-pastes with the
 *      text. Encodes the COMPACT fingerprint. Defeated only by retyping the text
 *      or a zero-width stripper (documented).
 *   3. TELEMETRY — OPTIONAL, DISCLOSED beacon <img>. Off by default. Emitted only
 *      when opts.beaconUrl is given AND the caller has set the disclosure flag,
 *      because a phone-home on open MUST be in the customer's license terms
 *      (see LEGAL_DISCLOSURE.md).
 *
 * Public: stamp(html, token, opts) · detect(html) · stripMetadata(html)
 */

const FP = require('./fingerprint');

// Zero-width alphabet.
const ZERO = '​';   // U+200B ZERO WIDTH SPACE      -> bit 0
const ONE = '‌';    // U+200C ZERO WIDTH NON-JOINER -> bit 1
const FRAME = '⁠';  // U+2060 WORD JOINER           -> run delimiter
const ZW_RE = new RegExp(FRAME + '[' + ZERO + ONE + ']+' + FRAME);

function bytesToZW(buf) {
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  return FRAME + bits.replace(/0/g, ZERO).replace(/1/g, ONE) + FRAME;
}
function zwToBytes(zwRun) {
  const bits = zwRun.replace(new RegExp(FRAME, 'g'), '').split('').map((c) => (c === ONE ? '1' : '0')).join('');
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

function stamp(html, token, opts) {
  opts = opts || {};
  let s = String(html);
  const compact = FP.packCompact(token);
  const zw = bytesToZW(compact);

  // (1) metadata: comment + <meta>
  const comment = `\n<!-- SOLINE-IP: protected, fingerprinted deliverable. (c) Soline. -->\n<!-- SOLINE-FP: ${token} -->\n`;
  const meta = `<meta name="soline:fingerprint" content="${token}">\n`;
  if (/<head[^>]*>/i.test(s)) s = s.replace(/(<head[^>]*>)/i, `$1${comment}${meta}`);
  else s = comment + meta + s;

  // (3) OPTIONAL disclosed telemetry beacon.
  let beacon = '';
  if (opts.beaconUrl && opts.disclosed === true) {
    const u = opts.beaconUrl + (opts.beaconUrl.includes('?') ? '&' : '?') + 'fp=' + encodeURIComponent(token);
    beacon = `\n<img src="${u}" alt="" width="1" height="1" style="position:absolute;left:-9999px" aria-hidden="true">\n`;
  }

  // (2) stego ZW run inside a benign, invisible footer span (also carries a
  // data attribute copy as a convenience backup channel).
  const footer = `\n<span data-sol-fp="${token}" style="font-size:0;line-height:0;color:transparent">​${zw}​</span>${beacon}\n`;
  if (/<\/body>/i.test(s)) s = s.replace(/<\/body>/i, footer + '</body>');
  else s = s + footer;

  return s;
}

function detect(html) {
  const s = String(html);
  const out = { tokens: FP.scanText(s), channels: { comment: false, meta: false, dataAttr: false, stego: false }, stego: null };
  if (/<!--\s*SOLINE-FP:/i.test(s)) out.channels.comment = true;
  if (/name=["']soline:fingerprint["']/i.test(s)) out.channels.meta = true;
  if (/data-sol-fp=/i.test(s)) out.channels.dataAttr = true;
  const m = s.match(new RegExp(FRAME + '[' + ZERO + ONE + ']+' + FRAME));
  if (m) { const c = FP.unpackCompact(zwToBytes(m[0])); if (c) { out.stego = { ok: true, compact: c }; out.channels.stego = true; } }
  return out;
}

// Remove the openly-readable marks (comment + meta + data attribute), keep the
// invisible ZW stego so the round-trip proves survivability.
function stripMetadata(html) {
  let s = String(html);
  s = s.replace(/\n?<!--\s*SOLINE-IP:[\s\S]*?-->/gi, '');
  s = s.replace(/\n?<!--\s*SOLINE-FP:[\s\S]*?-->/gi, '');
  s = s.replace(/<meta\s+name=["']soline:fingerprint["'][^>]*>\s*/gi, '');
  s = s.replace(/\sdata-sol-fp=["'][^"']*["']/gi, '');
  return s;
}

module.exports = { stamp, detect, stripMetadata, bytesToZW, zwToBytes };
