'use strict';
/*
 * fingerprint.js — Soline IP fingerprint token: build / parse / verify.
 * =============================================================================
 * The ORIGIN TOKEN is the single unit of truth that every layer (metadata,
 * steganographic, visible) carries. It is:
 *   (a) REVERSIBLE  — decodes back to project + customer + tier + format + time,
 *       so a leaked file traces to its origin;
 *   (b) AUTHENTICATED — carries a truncated HMAC-SHA256 over a canonical string,
 *       keyed by a SECRET Soline holds. Nobody without the secret can forge a
 *       token that verifies, and any edit to the origin fields breaks the HMAC.
 *
 * The secret NEVER ships inside an exported file. It lives only on Soline's
 * signing side (config `secret`, or env SOLINE_IP_SECRET). Decoding a token to
 * read its origin fields needs NO secret (it is plaintext base64url); only the
 * `verified:true` guarantee needs the secret. That split is deliberate: a
 * customer or auditor can *read* who a file belongs to, but only Soline can
 * *prove* a token is genuine (and mint new ones).
 *
 * Wire format (ASCII, self-delimiting, safe in DXF/PDF/HTML/JSON channels):
 *   SLN1.<b64url(payloadJSON)>.<b64url(hmac16)>
 * `SLN1.` is the sentinel every detector scans for.
 */

const crypto = require('crypto');

const MAGIC = 'SLN1';
const PREFIX = MAGIC + '.';
// A globally-scannable regex for the token in ANY text channel.
const TOKEN_RE = /SLN1\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g;

// ---- base64url (no padding) ----------------------------------------------
function b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

// ---- canonical HMAC input -------------------------------------------------
// Only the ORIGIN-BEARING, immutable fields are signed. Order is fixed so the
// signature is stable across encoders. Adding a field here is a version bump.
function canonical(p) {
  return [p.v, p.pid, p.cid, p.tier, p.fmt, p.ts, p.nid].join('|');
}
function sign(p, secret) {
  return crypto.createHmac('sha256', String(secret)).update(canonical(p)).digest().subarray(0, 16);
}

// ---- build ----------------------------------------------------------------
// origin = { pid, cid, tier, fmt, job?, meta? } ; secret = Soline signing key.
// Returns { token, payload }. `nid` (per-export nonce) makes every stamped file
// unique even for the same project+customer+format, so two leaks are
// distinguishable and a stamp can be revoked individually.
function build(origin, secret, opts) {
  opts = opts || {};
  if (!secret) throw new Error('fingerprint.build: missing signing secret');
  const payload = {
    v: 1,
    pid: String(origin.pid || 'UNKNOWN'),
    cid: String(origin.cid || 'UNKNOWN'),
    tier: String(origin.tier || 'standard'),
    fmt: String(origin.fmt || 'unknown'),
    ts: opts.ts != null ? opts.ts | 0 : Math.floor(Date.now() / 1000),
    nid: opts.nid || crypto.randomBytes(8).toString('hex'),
  };
  if (origin.job) payload.job = String(origin.job);      // display only (unsigned)
  if (origin.meta) payload.meta = origin.meta;           // display only (unsigned)
  const sig = sign(payload, secret);
  const token = PREFIX + b64u(Buffer.from(JSON.stringify(payload), 'utf8')) + '.' + b64u(sig);
  return { token, payload };
}

// ---- parse (no secret needed) --------------------------------------------
// Decodes the origin fields. `verified` is null here (unknown without secret).
function parse(token) {
  if (typeof token !== 'string' || !token.startsWith(PREFIX)) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let payload;
  try { payload = JSON.parse(unb64u(parts[1]).toString('utf8')); }
  catch { return null; }
  let sig = null;
  try { sig = unb64u(parts[2]); } catch { /* ignore */ }
  return { token, payload, sig };
}

// ---- verify (needs secret) ------------------------------------------------
// Returns { ok, verified, payload, reason }. `verified:true` only when the HMAC
// recomputes to the embedded signature under `secret`.
function verify(token, secret) {
  const p = parse(token);
  if (!p) return { ok: false, verified: false, payload: null, reason: 'not a Soline token' };
  if (!secret) return { ok: true, verified: null, payload: p.payload, reason: 'origin readable; secret not supplied so authenticity unverified' };
  const expect = sign(p.payload, secret);
  const good = p.sig && expect.length === p.sig.length && crypto.timingSafeEqual(expect, p.sig);
  return {
    ok: true,
    verified: !!good,
    payload: p.payload,
    reason: good ? 'HMAC valid — authentic Soline mark' : 'HMAC mismatch — forged, corrupted, or wrong signing key',
  };
}

// ---- scan a text blob for any embedded tokens (dedup, order-preserved) ----
function scanText(text) {
  const seen = new Set(), out = [];
  const m = String(text).match(TOKEN_RE) || [];
  for (const t of m) if (!seen.has(t)) { seen.add(t); out.push(t); }
  return out;
}

// ---- compact binary form for low-capacity stego channels ------------------
// Some stego channels (DXF Z-point cloud, ZWSP runs) pay per byte, so carrying
// the full ~180-char token is wasteful. The compact form keeps exactly what a
// trace needs: pid, cid, nid, and the 16-byte sig (which itself binds tier/fmt/
// ts through the HMAC, recoverable by cross-referencing Soline's issue log).
//   [ 'S','L', ver ][ pidLen ][ pid ][ cidLen ][ cid ][ nid16hex? -> 8 bytes ][ sig16 ]
// Returns a Buffer. `packCompact`/`unpackCompact` are symmetric.
function packCompact(payloadOrToken, sig) {
  let payload = payloadOrToken;
  if (typeof payloadOrToken === 'string') { const p = parse(payloadOrToken); payload = p.payload; sig = p.sig; }
  const pid = Buffer.from(payload.pid, 'utf8'), cid = Buffer.from(payload.cid, 'utf8');
  const nid = Buffer.from(payload.nid, 'hex');
  const s = sig ? Buffer.from(sig).subarray(0, 16) : Buffer.alloc(16);
  const head = Buffer.from([0x53, 0x4c, payload.v & 0xff, pid.length & 0xff, cid.length & 0xff, nid.length & 0xff]);
  return Buffer.concat([head, pid, cid, nid, s]);
}
function unpackCompact(buf) {
  buf = Buffer.from(buf);
  if (buf.length < 6 || buf[0] !== 0x53 || buf[1] !== 0x4c) return null;
  const v = buf[2], pl = buf[3], cl = buf[4], nl = buf[5];
  let o = 6;
  const pid = buf.subarray(o, o += pl).toString('utf8');
  const cid = buf.subarray(o, o += cl).toString('utf8');
  const nid = buf.subarray(o, o += nl).toString('hex');
  const sig = buf.subarray(o, o + 16);
  return { v, pid, cid, nid, sig: sig.length === 16 ? sig : null };
}

module.exports = {
  MAGIC, PREFIX, TOKEN_RE,
  b64u, unb64u, canonical, sign,
  build, parse, verify, scanText,
  packCompact, unpackCompact,
};
