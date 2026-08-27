#!/usr/bin/env node
'use strict';
/*
 * watermark.js — stamp a Soline export file with its IP fingerprint.
 * =============================================================================
 * Standalone POST-EXPORT pass. Reads an already-generated .dxf/.pdf/.html/.sol,
 * mints an authenticated origin token (project + customer + tier + format + time
 * + nonce), and writes the marked file. Does NOT touch the converter's exporters.
 *
 * Usage:
 *   node watermark.js <in> [--out <file>] --pid <projectId> --cid <customerId>
 *                     [--tier standard|pro|enterprise] [--job "<name>"]
 *                     [--visible] [--beacon <url> --disclosed]
 *
 * Programmatic:
 *   const { stampFile } = require('./watermark');
 *   stampFile(inPath, { pid, cid, tier, job, out, visible })  -> { token, payload, out, channels }
 */

const fs = require('fs');
const path = require('path');
const { formatOf, loadConfig, tierPolicy, addVisibleNotice, FP } = require('./lib/formats');

function stampBuffer(buf, format, token, origin, policy, opts) {
  opts = opts || {};
  const { mod, fmt, binary } = format;
  let content = binary ? buf : buf.toString('utf8');
  let result;

  if (fmt === 'pdf') {
    result = mod.stamp(buf, token, { pid: origin.pid, cid: origin.cid, tier: origin.tier });
  } else if (fmt === 'sol') {
    result = mod.stamp(buf, token, { pid: origin.pid, cid: origin.cid, tier: origin.tier });
  } else {
    // dxf / html — text channels (metadata + stego both live in stamp()).
    result = mod.stamp(content, token, {
      beaconUrl: opts.beacon && policy.telemetryAllowed ? opts.beacon : null,
      disclosed: !!opts.disclosed,
    });
    if ((policy.visibleNotice || opts.visible) && !opts.noVisible) {
      result = addVisibleNotice(fmt, result, token, origin);
    }
  }
  return Buffer.isBuffer(result) ? result : Buffer.from(result, 'utf8');
}

function stampFile(inPath, opts) {
  opts = opts || {};
  const format = formatOf(inPath);
  if (!format) throw new Error('unsupported format: ' + inPath + ' (expected .dxf/.pdf/.html/.sol)');
  const { cfg, secret } = loadConfig(opts.configDir);
  if (!secret) throw new Error('no signing secret (set SOLINE_IP_SECRET or soline-ip.config.json "secret")');

  const origin = {
    pid: opts.pid || 'PRJ-UNKNOWN',
    cid: opts.cid || 'CUST-UNKNOWN',
    tier: opts.tier || 'standard',
    fmt: format.fmt,
    job: opts.job || null,
  };
  const policy = tierPolicy(cfg, origin.tier);
  const { token, payload } = FP.build(origin, secret);

  const buf = fs.readFileSync(inPath);
  const stamped = stampBuffer(buf, format, token, origin, policy, {
    visible: opts.visible, noVisible: opts.noVisible,
    beacon: opts.beacon || (cfg.beacon && cfg.beacon.url),
    disclosed: opts.disclosed || (cfg.beacon && cfg.beacon.disclosedInLicense),
  });

  const out = opts.out || defaultOut(inPath);
  fs.writeFileSync(out, stamped);

  // Append to the issue log (so Soline can later map a leaked nonce → who/when).
  try {
    const logPath = path.join(opts.configDir || path.join(__dirname), cfg.issuerLog || 'issued.log.jsonl');
    fs.appendFileSync(logPath, JSON.stringify({ at: new Date().toISOString(), out: path.basename(out), ...payload }) + '\n');
  } catch { /* logging is best-effort */ }

  const channels = format.mod.detect(stamped).channels;
  return { token, payload, out, channels };
}

function defaultOut(inPath) {
  const ext = path.extname(inPath);
  return inPath.replace(new RegExp(ext.replace('.', '\\.') + '$'), '') + '.stamped' + ext;
}

// ---- CLI ------------------------------------------------------------------
function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--visible') a.visible = true;
    else if (t === '--disclosed') a.disclosed = true;
    else if (t.startsWith('--')) a[t.slice(2)] = argv[++i];
    else a._.push(t);
  }
  return a;
}
if (require.main === module) {
  const a = parseArgs(process.argv.slice(2));
  if (!a._[0]) { console.error('usage: node watermark.js <in.dxf|pdf|html|sol> --pid <id> --cid <id> [--tier T] [--job N] [--out F] [--visible]'); process.exit(2); }
  try {
    const r = stampFile(a._[0], a);
    console.log(JSON.stringify({ ok: true, out: r.out, token: r.token, origin: { pid: r.payload.pid, cid: r.payload.cid, tier: r.payload.tier, fmt: r.payload.fmt, nid: r.payload.nid }, channels: r.channels }, null, 2));
  } catch (e) { console.error('ERROR:', e.message); process.exit(1); }
}

module.exports = { stampFile, stampBuffer };
