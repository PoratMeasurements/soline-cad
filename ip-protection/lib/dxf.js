'use strict';
/*
 * dxf.js — Soline IP stamp / detect / strip for R12+AC1015 ASCII DXF.
 * =============================================================================
 * DXF is line-pair encoded: (groupCode, value) pairs, two text lines each. We
 * parse the file into that pair list, edit it structurally, and re-serialize —
 * far safer than string surgery, and it round-trips the existing Soline exporter
 * output (export_dxf2d.js / export_dxf_pro.js) byte-for-byte except our additions.
 *
 * THREE independent marks are written (defence in depth — see THREAT_MODEL.md):
 *   1. METADATA  — 999 comment lines at the top of the file (human + token) and
 *      an APPID `SOLINE` + a marker POINT carrying the token as XDATA. This is
 *      the openly-readable channel; a metadata scrubber removes it.
 *   2. STEGO     — a hidden, OFF layer `SOL-REG` holding a POINT cloud whose Z
 *      values encode the COMPACT fingerprint (pid|cid|nid|sig). Z is ignored by
 *      a 2D top view and the layer is off, so it is invisible and does not touch
 *      any measured X/Y. It survives comment/XDATA stripping. A determined
 *      adversary who deletes non-standard layers defeats it (documented).
 *   3. (visible notice is added by watermark.js as a TEXT stamp for low tiers.)
 *
 * Public: stamp(dxf, token, opts) · detect(dxf) · stripMetadata(dxf)
 */

const FP = require('./fingerprint');

const STEGO_LAYER = 'SOL-REG';
const MARK_LAYER = 'SOL-IPMARK';
const APPID = 'SOLINE';
const STEGO_ANCHOR = [0, 0];          // points sit at INSBASE → inside extents, invisible
const STEGO_HDR = [0xa5, 0x5a];       // sentinel prefix before the length + payload

// ---- line-pair parse / serialize -----------------------------------------
function parsePairs(dxf) {
  const lines = String(dxf).split(/\r\n|\r|\n/);
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) { i -= 1; continue; }   // tolerate a stray blank line
    pairs.push([code, lines[i + 1]]);
  }
  return pairs;
}
function g(code, val) { return String(code).padStart(3) + '\n' + val + '\n'; }
function serialize(pairs) { return pairs.map(([c, v]) => g(c, v)).join(''); }

// ---- section / table locators (index into the pair array) ----------------
function findSection(pairs, name) {
  for (let i = 0; i < pairs.length - 1; i++) {
    if (pairs[i][0] === 0 && pairs[i][1] === 'SECTION' && pairs[i + 1][0] === 2 && pairs[i + 1][1] === name) {
      // end = matching ENDSEC after i
      for (let j = i + 2; j < pairs.length; j++) if (pairs[j][0] === 0 && pairs[j][1] === 'ENDSEC') return { start: i, endsec: j };
      return { start: i, endsec: pairs.length };
    }
  }
  return null;
}
// Locate a named TABLE within the TABLES section: returns {head, count70, endtab}.
function findTable(pairs, name) {
  for (let i = 0; i < pairs.length - 1; i++) {
    if (pairs[i][0] === 0 && pairs[i][1] === 'TABLE' && pairs[i + 1][0] === 2 && pairs[i + 1][1] === name) {
      let count70 = -1, endtab = -1;
      for (let j = i + 2; j < pairs.length; j++) {
        if (count70 < 0 && pairs[j][0] === 70) count70 = j;
        if (pairs[j][0] === 0 && pairs[j][1] === 'ENDTAB') { endtab = j; break; }
      }
      return { head: i, count70, endtab };
    }
  }
  return null;
}

// ---- encoders -------------------------------------------------------------
// A POINT entity (10/20/30). Z carries a stego byte; X/Y stay at the anchor.
function pointPairs(layer, x, y, z) {
  return [[0, 'POINT'], [8, layer], [10, fmt(x)], [20, fmt(y)], [30, fmt(z)]];
}
function fmt(n) { const v = Math.round((Number(n) || 0) * 1e4) / 1e4; return (Object.is(v, -0) ? 0 : v).toFixed(4); }

// ---- stamp ----------------------------------------------------------------
function stamp(dxf, token, opts) {
  opts = opts || {};
  const pairs = parsePairs(dxf);

  // (1a) top-of-file 999 comment metadata channel.
  const comments = [
    [999, 'SOLINE-IP MARK — protected measurement drawing. (c) Soline.'],
    [999, 'This file is fingerprinted and traceable to its originating project + customer.'],
    [999, 'SOLINE-FP: ' + token],
  ];
  // Insert comments right after $ACADVER if present, else at the very top.
  let insAt = 0;
  const hdr = findSection(pairs, 'HEADER');
  if (hdr) {
    for (let j = hdr.start; j < hdr.endsec; j++) if (pairs[j][0] === 9 && pairs[j][1] === '$ACADVER') { insAt = j + 2; break; }
  }
  pairs.splice(insAt, 0, ...comments);

  // (1b) register APPID SOLINE (bump count + insert record before ENDTAB).
  const appidT = findTable(pairs, 'APPID');
  if (appidT && appidT.endtab >= 0) {
    const rec = [[0, 'APPID'], [5, 'AFP1'], [100, 'AcDbSymbolTableRecord'], [100, 'AcDbRegAppTableRecord'], [2, APPID], [70, '0']];
    if (appidT.count70 >= 0) pairs[appidT.count70][1] = String((parseInt(pairs[appidT.count70][1], 10) || 1) + 1);
    pairs.splice(appidT.endtab, 0, ...rec);
  }

  // (1c) register the two extra layers (SOL-REG off, SOL-IPMARK) in the LAYER table.
  const layerT = findTable(pairs, 'LAYER');
  if (layerT && layerT.endtab >= 0) {
    const th = tableOwner(pairs, layerT);
    const mk = (name, color) => [[0, 'LAYER'], [5, nextHandle()], [330, th], [100, 'AcDbSymbolTableRecord'], [100, 'AcDbLayerTableRecord'], [2, name], [70, '0'], [62, String(color)], [6, 'CONTINUOUS'], [370, '-3']];
    const recs = [...mk(STEGO_LAYER, -8), ...mk(MARK_LAYER, -8)];   // negative color = layer OFF
    if (layerT.count70 >= 0) pairs[layerT.count70][1] = String((parseInt(pairs[layerT.count70][1], 10) || 1) + 2);
    // re-locate endtab (indices shifted by the APPID edit above)
    const lt2 = findTable(pairs, 'LAYER');
    pairs.splice(lt2.endtab, 0, ...recs);
  }

  // (2) build the ENTITIES additions: XDATA marker POINT + stego Z-cloud.
  const ent = findSection(pairs, 'ENTITIES');
  if (!ent) throw new Error('dxf.stamp: no ENTITIES section');

  const additions = [];
  // XDATA marker point (metadata channel, robust to APPID-aware readers).
  additions.push(
    [0, 'POINT'], [5, nextHandle()], [8, MARK_LAYER],
    [10, fmt(STEGO_ANCHOR[0])], [20, fmt(STEGO_ANCHOR[1])], [30, fmt(0)],
    [1001, APPID], [1000, 'SOLINE-IP'], [1000, token],
  );
  // Stego Z-cloud: sentinel + length + compact fingerprint bytes → one POINT / byte.
  const compact = FP.packCompact(token);
  const bytes = Buffer.concat([Buffer.from(STEGO_HDR), Buffer.from([compact.length & 0xff, (compact.length >> 8) & 0xff]), compact]);
  for (const b of bytes) additions.push(...pointPairs(STEGO_LAYER, STEGO_ANCHOR[0], STEGO_ANCHOR[1], b));

  // re-locate ENTITIES endsec (indices shifted) and insert before it.
  const ent2 = findSection(pairs, 'ENTITIES');
  pairs.splice(ent2.endsec, 0, ...additions);

  return serialize(pairs);
}

// Owner handle (330) of a table = its head record's group-5 handle.
function tableOwner(pairs, t) {
  for (let j = t.head; j < t.endtab; j++) if (pairs[j][0] === 5) return pairs[j][1];
  return '0';
}
// Monotonic hex handles well above the exporter's range (seed 0xA0000).
let _h = 0xa0000;
function nextHandle() { return (_h++).toString(16).toUpperCase(); }

// ---- detect ---------------------------------------------------------------
// Returns { tokens:[…], channels:{ comment, xdata, stego }, stego:{ ok, compact } }.
function detect(dxf) {
  const pairs = parsePairs(dxf);
  const out = { tokens: [], channels: { comment: false, xdata: false, stego: false }, stego: null };
  const add = (t, ch) => { if (t && !out.tokens.includes(t)) out.tokens.push(t); if (ch) out.channels[ch] = true; };

  // comment (999) + XDATA (1000) tokens: extract any embedded Soline token
  // (the 999 line prefixes it with "SOLINE-FP: ", so match rather than ===).
  for (let i = 0; i < pairs.length; i++) {
    const [code, val] = pairs[i];
    if ((code === 999 || code === 1000) && typeof val === 'string') {
      for (const t of FP.scanText(val)) add(t, code === 999 ? 'comment' : 'xdata');
    }
  }

  // stego: gather Z of every POINT on STEGO_LAYER, in file order.
  const zs = [];
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i][0] === 0 && pairs[i][1] === 'POINT') {
      let layer = null, z = null;
      for (let j = i + 1; j < pairs.length && !(pairs[j][0] === 0); j++) {
        if (pairs[j][0] === 8) layer = pairs[j][1];
        if (pairs[j][0] === 30) z = Math.round(parseFloat(pairs[j][1]));
      }
      if (layer === STEGO_LAYER && z != null) zs.push(z & 0xff);
    }
  }
  const dec = decodeStego(zs);
  if (dec) { out.stego = dec; out.channels.stego = true; }

  return out;
}
// Find the sentinel run in a Z-byte stream and unpack the compact fingerprint.
function decodeStego(zs) {
  for (let i = 0; i + 4 <= zs.length; i++) {
    if (zs[i] === STEGO_HDR[0] && zs[i + 1] === STEGO_HDR[1]) {
      const len = zs[i + 2] | (zs[i + 3] << 8);
      const body = zs.slice(i + 4, i + 4 + len);
      if (body.length === len) {
        const c = FP.unpackCompact(Buffer.from(body));
        if (c) return { ok: true, compact: c };
      }
    }
  }
  return null;
}

// ---- stripMetadata (adversary simulation for the round-trip demo) ---------
// Removes the OPENLY-READABLE marks (999 comments, the XDATA marker POINT, the
// SOLINE APPID) — what a "scrub the metadata" tool or a DXF→DXF re-export via a
// naive library would drop. Deliberately leaves ordinary geometry (incl. the
// SOL-REG stego layer) intact, so the round-trip proves stego survivability.
function stripMetadata(dxf) {
  const pairs = parsePairs(dxf);
  const out = [];
  for (let i = 0; i < pairs.length;) {
    const [code, val] = pairs[i];
    // drop 999 comments
    if (code === 999) { i++; continue; }
    // drop the whole XDATA marker POINT entity (POINT on MARK_LAYER)
    if (code === 0 && val === 'POINT') {
      let end = i + 1, layer = null;
      for (; end < pairs.length && !(pairs[end][0] === 0); end++) if (pairs[end][0] === 8) layer = pairs[end][1];
      if (layer === MARK_LAYER) { i = end; continue; }
    }
    out.push(pairs[i]); i++;
  }
  return serialize(out);
}

module.exports = { stamp, detect, stripMetadata, STEGO_LAYER, MARK_LAYER, APPID, parsePairs, serialize };
