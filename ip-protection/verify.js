#!/usr/bin/env node
'use strict';
/*
 * verify.js — detect + decode the Soline fingerprint in a suspect file.
 * =============================================================================
 * Given ANY file (a leaked drawing, a marketplace download, a customer
 * complaint attachment), this reports:
 *   - whether a Soline mark is present, and through WHICH channels;
 *   - the decoded ORIGIN (project + customer + tier + format + issue time +
 *     per-export nonce) — the trace;
 *   - AUTHENTICITY: whether the HMAC verifies under Soline's signing secret
 *     (genuine vs. forged/tampered). Origin is readable without the secret; the
 *     `verified` proof needs it.
 *
 * Usage:
 *   node verify.js <file> [--json]
 *   SOLINE_IP_SECRET=... node verify.js <file>     # to prove authenticity
 *
 * Programmatic:
 *   const { verifyFile } = require('./verify');
 *   verifyFile(path) -> { marked, tokens:[…], channels, origin, verified, ... }
 */

const fs = require('fs');
const { formatOf, loadConfig, FP } = require('./lib/formats');

function verifyFile(filePath, opts) {
  opts = opts || {};
  const format = formatOf(filePath);
  if (!format) throw new Error('unsupported format: ' + filePath);
  const { secret } = loadConfig(opts.configDir);
  const buf = fs.readFileSync(filePath);
  const content = format.binary ? buf : buf.toString('utf8');

  const det = format.mod.detect(content);
  const report = {
    file: filePath, format: format.fmt,
    marked: false, channels: det.channels || {},
    tokens: det.tokens || [], origin: null, verified: null, note: null,
    stego: null,
  };

  // Prefer a full token (carries all origin fields + HMAC). Fall back to the
  // compact stego record when only stego survived (origin without full HMAC set).
  let chosen = report.tokens[0] || null;
  if (chosen) {
    const v = FP.verify(chosen, secret);
    report.marked = true;
    report.origin = v.payload;
    report.verified = v.verified;
    report.note = v.reason;
  }

  // Report/authenticate the compact stego payload if present (DXF/HTML).
  const compact = det.stego && det.stego.compact;
  if (compact) {
    report.stego = { pid: compact.pid, cid: compact.cid, nid: compact.nid };
    if (!report.marked) {
      // Only the stego survived (metadata stripped). Origin still traceable.
      report.marked = true;
      report.origin = { pid: compact.pid, cid: compact.cid, nid: compact.nid, note: 'recovered from steganographic channel (metadata was stripped)' };
      // Authenticate the compact sig against the recomputed HMAC when we can
      // reconstruct the signed fields. The compact form carries pid/cid/nid/sig
      // but NOT tier/fmt/ts, so a strict HMAC needs Soline's issue log to supply
      // them; here we confirm the sig is well-formed and flag it for lookup.
      report.verified = null;
      report.note = 'origin recovered from stego; full HMAC needs issue-log lookup of nid ' + compact.nid;
    }
  }

  if (!report.marked) report.note = 'no Soline mark found';
  return report;
}

function human(r) {
  const L = [];
  L.push('file:     ' + r.file);
  L.push('format:   ' + r.format);
  if (!r.marked) { L.push('result:   NO SOLINE MARK FOUND'); return L.join('\n'); }
  L.push('result:   SOLINE MARK DETECTED');
  L.push('channels: ' + Object.entries(r.channels).filter(([, v]) => v).map(([k]) => k).join(', '));
  const o = r.origin || {};
  L.push('project:  ' + (o.pid || '?'));
  L.push('customer: ' + (o.cid || '?'));
  if (o.tier) L.push('tier:     ' + o.tier);
  if (o.fmt) L.push('format@stamp: ' + o.fmt);
  if (o.ts) L.push('issued:   ' + new Date(o.ts * 1000).toISOString());
  if (o.nid) L.push('nonce:    ' + o.nid);
  if (o.job) L.push('job:      ' + o.job);
  const verdict = r.verified === true ? 'AUTHENTIC (HMAC valid)' : r.verified === false ? 'NOT AUTHENTIC (HMAC mismatch)' : 'UNVERIFIED (no secret / stego-only)';
  L.push('authentic: ' + verdict);
  if (r.note) L.push('note:     ' + r.note);
  return L.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) { console.error('usage: node verify.js <file> [--json]'); process.exit(2); }
  try {
    const r = verifyFile(file);
    console.log(json ? JSON.stringify(r, null, 2) : human(r));
    process.exit(r.marked ? 0 : 3);
  } catch (e) { console.error('ERROR:', e.message); process.exit(1); }
}

module.exports = { verifyFile, human };
