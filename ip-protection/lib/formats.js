'use strict';
/*
 * formats.js — dispatch by file extension + config/secret loading + visible notice.
 * =============================================================================
 * One place that: (a) maps a file path to its format module, (b) resolves the
 * signing secret and tier policy from soline-ip.config.json / env, and (c) adds
 * the optional VISIBLE license notice for lower tiers.
 */

const fs = require('fs');
const path = require('path');
const FP = require('./fingerprint');
const dxf = require('./dxf');
const pdf = require('./pdf');
const html = require('./html');
const sol = require('./sol');

const MODULES = { dxf, pdf, html, sol };

// Map an extension to a format module + a canonical fmt tag for the token.
function formatOf(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.dxf') return { mod: dxf, fmt: 'dxf', binary: false };
  if (ext === '.pdf') return { mod: pdf, fmt: 'pdf', binary: true };
  if (ext === '.html' || ext === '.htm') return { mod: html, fmt: 'html', binary: false };
  if (ext === '.sol') return { mod: sol, fmt: 'sol', binary: true };
  return null;
}

function loadConfig(dir) {
  const cfgPath = path.join(dir || path.join(__dirname, '..'), 'soline-ip.config.json');
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch { /* defaults */ }
  const secret = process.env[cfg.secretEnv || 'SOLINE_IP_SECRET'] || cfg.secret || null;
  return { cfg, cfgPath, secret };
}

// Tier policy with safe defaults.
function tierPolicy(cfg, tier) {
  const t = (cfg.tiers && cfg.tiers[tier]) || {};
  return {
    metadata: t.metadata !== false,
    stego: t.stego !== false,
    visibleNotice: !!t.visibleNotice,
    telemetryAllowed: !!t.telemetryAllowed,
  };
}

// ---- visible notice (lower tiers) ----------------------------------------
// A discreet, human-readable ownership line. Kept short so it never obscures the
// drawing; placed away from the plan body.
function addVisibleNotice(fmt, content, token, origin) {
  const line = `© Soline · protected & traceable · ${origin.pid || ''}/${origin.cid || ''}`;
  if (fmt === 'dxf') {
    // A TEXT entity on a dedicated SOL-NOTICE layer, near the drawing origin,
    // small height. Inserted before the ENTITIES ENDSEC.
    const pairs = dxf.parsePairs(content);
    const ins = [];
    for (let i = 0; i < pairs.length; i++) if (pairs[i][0] === 0 && pairs[i][1] === 'ENDSEC') {
      // find the ENTITIES endsec specifically: check a preceding SECTION/ENTITIES
    }
    // simplest: append a TEXT just before the last ENDSEC that closes ENTITIES.
    const text = [[0, 'TEXT'], [8, 'SOL-NOTICE'], [10, '0.0'], [20, '-250.0'], [30, '0.0'], [40, '90.0'], [1, line], [7, 'STANDARD']];
    // locate ENTITIES endsec
    let target = -1, inEnt = false;
    for (let i = 0; i < pairs.length - 1; i++) {
      if (pairs[i][0] === 0 && pairs[i][1] === 'SECTION' && pairs[i + 1][0] === 2 && pairs[i + 1][1] === 'ENTITIES') inEnt = true;
      if (inEnt && pairs[i][0] === 0 && pairs[i][1] === 'ENDSEC') { target = i; break; }
    }
    if (target >= 0) { pairs.splice(target, 0, ...text); return dxf.serialize(pairs); }
    return content;
  }
  if (fmt === 'html') {
    const div = `\n<div class="soline-ip-notice" style="text-align:center;font-size:11px;color:#8a8a8a;padding:6px 0;border-top:1px solid #e5e5e5;margin-top:12px">${line}</div>\n`;
    if (/<\/body>/i.test(content)) return content.replace(/<\/body>/i, div + '</body>');
    return content + div;
  }
  // pdf/sol: visible notice not added at this layer (belongs in the report body).
  return content;
}

module.exports = { MODULES, formatOf, loadConfig, tierPolicy, addVisibleNotice, FP };
