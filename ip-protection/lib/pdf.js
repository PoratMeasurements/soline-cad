'use strict';
/*
 * pdf.js — Soline IP stamp / detect for PDF (DocInfo + XMP, via incremental update).
 * =============================================================================
 * Soline's PDF is produced by printing the HTML report, so in production the HTML
 * channel already travels into the PDF's text layer. This module fingerprints a
 * *finished* PDF at the file level, the way commercial CAD/template vendors mark
 * released PDFs:
 *
 *   1. METADATA — a proper PDF INCREMENTAL UPDATE appended at EOF: a new DocInfo
 *      dictionary carrying /Producer, /SolineFP (the token) and /SolineIP, plus a
 *      standalone XMP `/Metadata` object with the same token. Incremental update =
 *      pure append (existing bytes and xref offsets are untouched), so it never
 *      corrupts the file and any PDF tool reads /SolineFP from Document
 *      Properties.
 *   2. A trailing `%SOLINE-FP:` comment (ignored by viewers) as a grep-friendly
 *      backup.
 *
 * HONEST LIMIT (see DESIGN.md): DocInfo/XMP are removable with one exiftool call.
 * A metadata-strip-SURVIVING PDF mark needs an INVISIBLE text watermark drawn in
 * render mode 3 (Tr 3) on each page's content stream — recommended for production
 * and specified in DESIGN.md, but not byte-prototyped here (it requires rewriting
 * page content + xref, i.e. a full PDF library). The DXF prototype carries the
 * survive-the-strip round-trip.
 *
 * Public: stamp(buf, token, opts) · detect(buf) · stripMetadata(buf)
 */

const FP = require('./fingerprint');

function stamp(pdf, token, opts) {
  opts = opts || {};
  let buf = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
  const txt = buf.toString('latin1');

  // Discover the current cross-reference start, object count, and catalog root.
  const prevXref = lastInt(txt, /startxref\s+(\d+)/g);
  let size = lastInt(txt, /\/Size\s+(\d+)/g);
  const rootNum = lastInt(txt, /\/Root\s+(\d+)\s+\d+\s+R/g);
  if (prevXref == null || size == null || rootNum == null) {
    // Fallback: not a parseable xref PDF — append marks as comments only.
    const tail = `\n%SOLINE-FP: ${token}\n%SOLINE-IP protected deliverable (c) Soline\n`;
    return Buffer.concat([buf, Buffer.from(tail, 'latin1')]);
  }

  const infoNum = size, xmpNum = size + 1, newSize = size + 2;
  const xmp = buildXmp(token, opts);

  // Assemble the appended body, tracking each new object's byte offset.
  let body = `\n%SOLINE-FP: ${token}\n`;
  const baseLen = buf.length;
  const offInfo = baseLen + Buffer.byteLength(body, 'latin1');
  body += `${infoNum} 0 obj\n<< /Producer (Soline IP-Protection) /Creator (Soline) `
        + `/SolineFP (${token}) /SolineIP (protected-traceable) >>\nendobj\n`;
  const offXmp = baseLen + Buffer.byteLength(body, 'latin1');
  body += `${xmpNum} 0 obj\n<< /Type /Metadata /Subtype /XML /Length ${Buffer.byteLength(xmp, 'utf8')} >>\nstream\n${xmp}\nendstream\nendobj\n`;

  const xrefStart = baseLen + Buffer.byteLength(body, 'latin1');
  const e = (n) => String(n).padStart(10, '0') + ' 00000 n \n';
  const xref = `xref\n${infoNum} 2\n${e(offInfo)}${e(offXmp)}`;
  const trailer = `trailer\n<< /Size ${newSize} /Root ${rootNum} 0 R /Info ${infoNum} 0 R /Prev ${prevXref} >>\n`
                + `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.concat([buf, Buffer.from(body + xref + trailer, 'latin1')]);
}

function buildXmp(token, opts) {
  const pid = opts.pid || '', cid = opts.cid || '';
  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description xmlns:soline="https://soline.co.il/ns/ip/1.0/"
     soline:fingerprint="${token}" soline:project="${pid}" soline:customer="${cid}"
     soline:notice="Protected, traceable Soline deliverable."/>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function lastInt(txt, re) {
  let m, v = null;
  while ((m = re.exec(txt)) !== null) v = parseInt(m[1], 10);
  return Number.isFinite(v) ? v : null;
}

function detect(pdf) {
  const txt = (Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf)).toString('latin1');
  const out = { tokens: FP.scanText(txt), channels: { docinfo: false, xmp: false, comment: false } };
  if (/\/SolineFP\s*\(/.test(txt)) out.channels.docinfo = true;
  if (/soline:fingerprint=/.test(txt)) out.channels.xmp = true;
  if (/%SOLINE-FP:/.test(txt)) out.channels.comment = true;
  return out;
}

// Simulate a metadata scrub: blank the DocInfo/XMP token values and drop the
// trailing comment. (An exiftool `-all=` is the real-world equivalent.)
function stripMetadata(pdf) {
  let txt = (Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf)).toString('latin1');
  txt = txt.replace(/\/SolineFP\s*\([^)]*\)/g, '/SolineFP ()');
  txt = txt.replace(/soline:fingerprint="[^"]*"/g, 'soline:fingerprint=""');
  txt = txt.replace(/\n?%SOLINE-FP:[^\n]*\n?/g, '\n');
  txt = txt.replace(/\n?%SOLINE-IP[^\n]*\n?/g, '\n');
  return Buffer.from(txt, 'latin1');
}

module.exports = { stamp, detect, stripMetadata, buildXmp };
