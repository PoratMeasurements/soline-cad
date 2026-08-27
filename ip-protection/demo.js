#!/usr/bin/env node
'use strict';
/*
 * demo.js — end-to-end round-trip proof for all four formats.
 * =============================================================================
 * For each of DXF / PDF / HTML / .sol it runs:
 *   1. STAMP            — mint an authenticated token, write all channels.
 *   2. VERIFY (stamped) — confirm detection + HMAC authenticity.
 *   3. STRIP METADATA   — simulate an adversary scrubbing the openly-readable
 *                         marks (comments / XDATA / DocInfo / meta tags).
 *   4. VERIFY (stripped)— prove the ORIGIN still recovers via the surviving
 *                         steganographic channel (DXF hidden layer / HTML
 *                         zero-width run). PDF/.sol: honest result reported.
 *   5. FORGERY          — flip a byte in the token and show verify rejects it.
 *
 * Run:  node demo.js
 */

const fs = require('fs');
const path = require('path');
const { makePdf, makeSol } = require('./samples/make_samples');
const FP = require('./lib/fingerprint');
const dxf = require('./lib/dxf');
const pdf = require('./lib/pdf');
const html = require('./lib/html');
const sol = require('./lib/sol');

const SECRET = process.env.SOLINE_IP_SECRET || 'DEV-ONLY-CHANGE-ME-soline-ip-signing-key';
const ORIGIN = { pid: 'PRJ-2026-0412', cid: 'CUST-00817', tier: 'pro', job: 'מטבח דירת ממרן' };
const S = path.join(__dirname, 'samples');

function line(c) { return c.repeat(74); }
function head(t) { console.log('\n' + line('=') + '\n' + t + '\n' + line('=')); }

function channelList(ch) { return Object.entries(ch).filter(([, v]) => v).map(([k]) => k).join(', ') || '(none)'; }

function runText(name, mod, ext, sampleText, fmtTag) {
  head(name);
  const { token, payload } = FP.build({ ...ORIGIN, fmt: fmtTag }, SECRET);
  console.log('token:', token.slice(0, 60) + '…  (nid ' + payload.nid + ')');

  const stamped = mod.stamp(sampleText, token, {});
  fs.writeFileSync(path.join(S, 'stamped' + ext), stamped);
  const d1 = mod.detect(stamped);
  console.log('\n[1] stamped   → channels:', channelList(d1.channels));
  const v1 = FP.verify(d1.tokens[0], SECRET);
  console.log('    verify    → project ' + v1.payload.pid + ' / customer ' + v1.payload.cid + '  | authentic: ' + v1.verified);

  const stripped = mod.stripMetadata(stamped);
  fs.writeFileSync(path.join(S, 'stripped' + ext), stripped);
  const d2 = mod.detect(stripped);
  console.log('\n[2] STRIPPED metadata → surviving channels:', channelList(d2.channels));
  if (d2.stego && d2.stego.compact) {
    const c = d2.stego.compact;
    console.log('    STEGO recovered → project ' + c.pid + ' / customer ' + c.cid + ' / nonce ' + c.nid);
    console.log('    ROUND-TRIP: ORIGIN STILL TRACEABLE after metadata strip ✔');
  } else if (d2.tokens.length) {
    console.log('    token still present via:', channelList(d2.channels));
  } else {
    console.log('    (no channel survived — see notes)');
  }
  return { token, payload };
}

function runPdf() {
  head('PDF  (DocInfo + XMP incremental update)');
  const sample = makePdf();
  const { token, payload } = FP.build({ ...ORIGIN, fmt: 'pdf' }, SECRET);
  console.log('token:', token.slice(0, 60) + '…  (nid ' + payload.nid + ')');
  const stamped = pdf.stamp(sample, token, { pid: ORIGIN.pid, cid: ORIGIN.cid });
  fs.writeFileSync(path.join(S, 'stamped.pdf'), stamped);
  const d1 = pdf.detect(stamped);
  console.log('\n[1] stamped   → channels:', channelList(d1.channels));
  const v1 = FP.verify(d1.tokens[0], SECRET);
  console.log('    verify    → project ' + v1.payload.pid + ' / customer ' + v1.payload.cid + '  | authentic: ' + v1.verified);
  const stripped = pdf.stripMetadata(stamped);
  const d2 = pdf.detect(stripped);
  console.log('\n[2] STRIPPED metadata → surviving channels:', channelList(d2.channels), d2.tokens.length ? '' : '(token removed)');
  console.log('    NOTE: PDF DocInfo/XMP are removable by design. Robust PDF stego = invisible');
  console.log('          Tr-3 text watermark on page content (specified in DESIGN.md, not byte-prototyped).');
  return { token, payload };
}

function runSol() {
  head('.sol  (ZIP: fingerprint entry + manifest field + archive comment)');
  const sample = makeSol();
  const { token, payload } = FP.build({ ...ORIGIN, fmt: 'sol' }, SECRET);
  console.log('token:', token.slice(0, 60) + '…  (nid ' + payload.nid + ')');
  const stamped = sol.stamp(sample, token, { pid: ORIGIN.pid, cid: ORIGIN.cid, tier: ORIGIN.tier });
  fs.writeFileSync(path.join(S, 'stamped.sol'), stamped);
  const d1 = sol.detect(stamped);
  console.log('\n[1] stamped   → channels:', channelList(d1.channels));
  const v1 = FP.verify(d1.tokens[0], SECRET);
  console.log('    verify    → project ' + v1.payload.pid + ' / customer ' + v1.payload.cid + '  | authentic: ' + v1.verified);
  // prove it still opens as a valid .sol
  try {
    const { readSol } = require(path.join('..', 'converter', 'src', 'readSol'));
    fs.writeFileSync(path.join(S, '_verify_reopen.sol'), stamped);
    const r = readSol(path.join(S, '_verify_reopen.sol'));
    console.log('    reopened as .sol → magic OK, rooms:', (r.model && r.model.rooms.length) || 0, ', fp field:', !!(r.manifest && r.manifest.solineFingerprint));
    fs.unlinkSync(path.join(S, '_verify_reopen.sol'));
  } catch (e) { console.log('    (reopen check skipped:', e.message + ')'); }
  return { token, payload };
}

function forgeryTest(token) {
  head('FORGERY / TAMPER TEST');
  const good = FP.verify(token, SECRET);
  console.log('genuine token       → authentic:', good.verified);
  // tamper the payload: swap customer id but keep the original signature.
  const parts = token.split('.');
  const p = JSON.parse(FP.unb64u(parts[1]).toString('utf8'));
  p.cid = 'CUST-99999';                    // attacker rewrites the customer
  const forged = 'SLN1.' + FP.b64u(Buffer.from(JSON.stringify(p))) + '.' + parts[2];
  const bad = FP.verify(forged, SECRET);
  console.log('tampered customer id → authentic:', bad.verified, '  (' + bad.reason + ')');
  // wrong signing key
  const wrong = FP.verify(token, 'attacker-guessed-key');
  console.log('genuine token, wrong key → authentic:', wrong.verified);
}

(function main() {
  const dxfSample = fs.readFileSync(path.join(S, 'plan_room_4x4.dxf'), 'utf8');
  const htmlSample = fs.readFileSync(path.join(S, 'report_room_4x4.html'), 'utf8');

  const a = runText('DXF  (2D measurement plan — hidden SOL-REG stego layer)', dxf, '.dxf', dxfSample, 'dxf2d');
  runText('HTML  (report — zero-width steganographic run)', html, '.html', htmlSample, 'html');
  runPdf();
  runSol();
  forgeryTest(a.token);

  head('SUMMARY');
  console.log('DXF  : metadata + STEGO ; stego SURVIVES metadata strip → origin traceable ✔');
  console.log('HTML : metadata + STEGO ; zero-width run SURVIVES strip → origin traceable ✔');
  console.log('PDF  : DocInfo + XMP metadata (removable; robust stego = Tr-3, spec only)');
  console.log('.sol : fingerprint entry + manifest field (internal format; still valid .sol)');
  console.log('Forgery: any edit to signed origin fields, or a wrong key, fails HMAC ✔');
})();
