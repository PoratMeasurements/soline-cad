# Soline IP-Protection — Integration (spec only)

> **Spec, not a patch.** This document specifies how the standalone post-export
> pass hooks into the converter. It does **not** modify any exporter. The rule is
> firm: `converter/src/export_*.js` stays untouched. Stamping happens *after* an
> exporter has already written its file, as a separate pass over the produced
> paths.

The whole module is a **post-process**: `watermark.stampFile(path, opts)` reads an
already-written `.dxf/.pdf/.html/.sol`, mints an authenticated origin token, and
rewrites the file with all configured channels (metadata + stego + optional visible
notice). Nothing upstream in the exporters needs to know it exists.

---

## 1. Where the converter writes its files

The single reusable entry is `convert(inputPath, outDir)` in
`converter/soline_convert.js` (line ~451). It calls `convertOne` for the CAD
formats, then adds the two report formats. Each produced file lands on
`res.formats.<fmt>.file`:

| Format | Written at | `res.formats` key | Path |
|---|---|---|---|
| ORDX (re-export) | `convertOne`, line ~402 | `ordx` | `<name>.ordx` |
| DXF 2D (Pro) | `convertOne`, line ~414 (`fs.writeFileSync(f, dxf, 'ascii')`) | `dxf2d` | `<name>_2d.dxf` |
| DXF 3D (Pro) | `convertOne`, line ~422 | `dxf3d` | `<name>_3d.dxf` |
| PDP | `convertOne`, line ~431 | `pdp` | `<name>.pdp` |
| HTML report | `convert`, line ~464 | `html` | `<name>_report.html` |
| PDF report | `convert`, line ~473 (`renderPdf`) | `pdf` | `<name>.pdf` |

Every write is already individually guarded (a failure records `{ error }` and the
batch continues). The IP pass mirrors that discipline: it is best-effort per file
and must never abort a conversion.

> `.sol` is Soline's **internal source** format and is an *input* here, not an
> output of `convert()`. It is stamped separately — at the point `.sol` archives
> are minted/stored — not in this pipeline. `PDP` is a proprietary binary; it is
> **out of scope for the four supported channels** (no DXF/PDF/HTML/.sol parser
> applies). Leave it unstamped, or add a dedicated `pdp.js` channel later.

## 2. The hook — one wrapper, zero exporter edits

Add a thin wrapper in `soline_convert.js` (or a new `soline_convert_ip.js` that
`require`s it) that runs **after** `convert()` returns and walks the produced
paths. Pseudocode:

```js
// NEW FILE, e.g. converter/soline_convert_ip.js — does NOT touch export_*.js
const { convert } = require('./soline_convert');
const { stampFile } = require('../ip-protection/watermark');

// Which produced formats the IP pass understands today.
const STAMPABLE = { dxf2d: 'dxf', dxf3d: 'dxf', html: 'html', pdf: 'pdf' };
//   ordx: no channel yet ; pdp: out of scope ; sol: stamped at .sol-mint time

function convertProtected(inputPath, outDir, origin) {
  const res = convert(inputPath, outDir);        // unchanged pipeline
  res.ip = {};
  for (const [key] of Object.entries(STAMPABLE)) {
    const f = res.formats[key] && res.formats[key].file;
    if (!f) continue;                            // format errored/skipped — skip
    try {
      const r = stampFile(f, {                   // rewrites the file in place
        out: f,                                  // overwrite the just-written file
        pid: origin.pid,                         // project id
        cid: origin.cid,                         // customer/licensee id
        tier: origin.tier || 'standard',
        job: origin.job || res.name,             // display-only; keep non-personal
      });
      res.ip[key] = { ok: true, nid: r.payload.nid, channels: r.channels };
    } catch (e) { res.ip[key] = { error: e.message }; }   // never throw
  }
  return res;
}
module.exports = { convertProtected };
```

Properties this preserves:

- **Exporters untouched.** `export_dxf2d.js`, `export_dxf_pro.js`, `export_html.js`,
  `export_pdf.js`, `export_dxf3d.js` are never edited or re-entered. The pass only
  reads/writes the finished files by path.
- **Same guard posture.** Each stamp is `try/catch`ed; a stamping failure degrades to
  `res.ip[key] = { error }` and leaves the original (unstamped but valid) file.
- **DXF stays ASCII.** The 2D DXF is written with `'ascii'` encoding. The token is
  base64url (ASCII) and the Z-stego cloud is numeric — `dxf.js` re-serializes
  ASCII-safe, so the file remains loadable by the same readers.
- **Idempotency.** Re-running the pass on an already-stamped file adds a second
  mark. Stamp **once**, at release time. If a re-stamp is ever needed, strip first
  (`lib/<fmt>.stripMetadata`) or gate on `verify.js` reporting `marked:false`.

## 3. Where `pid` / `cid` / `tier` come from

The token needs an **origin**: project id, customer/licensee id, tier. The
converter today carries only `name` (derived from the input filename, line ~378)
and `title.project = name` (passed to the 2D exporter, line ~411). It has **no
customer/tier concept** — that lives one level up, in whatever issues the job
(the order/quote system, dashboard, or the operator running the batch).

Supply `origin` from that layer, in priority order:

1. **Caller-provided** — the dashboard/order system calls `convertProtected(in, out,
   { pid, cid, tier, job })` with real ids. Preferred.
2. **`.sol` / manifest** — if the input is a `.sol`, read `manifest.json` for a
   project/customer field and map it (the `.sol` reader is `converter/src/readSol.js`).
3. **CLI flags** — for manual/batch runs: `--pid`, `--cid`, `--tier` parsed alongside
   the existing `--out` handling (CLI block near line ~635), passed straight through.
4. **Fallback** — `pid = res.name`, `cid = 'CUST-UNKNOWN'`, `tier = 'standard'`.
   Still traceable to the project via `name`; the `nid` + issue log let Soline
   attach the customer after the fact.

Whatever the source, **do not put personal data** in `pid`/`cid`/`job` — they are
pseudonymous identifiers that resolve to a person only via Soline's own records
(see `LEGAL_DISCLOSURE.md` §2).

## 4. Signing secret & issue log

- The **secret** is read by `watermark.js` via `lib/formats.loadConfig`:
  `SOLINE_IP_SECRET` env first, then `soline-ip.config.json "secret"`. In
  production set the **env var** on the converter host; never commit the real key.
  The `soline-ip.config.json` in this folder ships a **DEV placeholder** only.
- Every stamp appends one line to the **issue log** (`issued.log.jsonl`, path from
  config `issuerLog`): `{ at, out, v, pid, cid, tier, fmt, ts, nid, job? }`. This is
  the `nid → licensee` map a later `verify.js` hit is resolved against. Treat it as
  customer data (access-controlled, retained only as long as needed) per
  `LEGAL_DISCLOSURE.md` §6. If the converter runs as many worker processes, point
  `issuerLog` at a shared/append-safe location or a small DB instead of a flat file.

## 5. Tier policy → channels

`lib/formats.tierPolicy(cfg, tier)` reads `soline-ip.config.json "tiers"` and
decides, per tier, which channels a stamp writes:

| Tier | Metadata (L1) | Stego (L2) | Visible notice (L3) | Beacon (disclosed) |
|---|:--:|:--:|:--:|:--:|
| `standard` | ✔ | ✔ | ✔ | ✖ |
| `pro` | ✔ | ✔ | ✖ | optional, only if licensed & disclosed |
| `enterprise` | ✔ | ✔ | ✖ | optional, only if licensed & disclosed |

Stego is always on (it is the only channel that survives a metadata scrub and it is
invisible/free). The beacon is **off by default** and lawful only when the
customer's license discloses it — `html.stamp` refuses to emit it unless
`opts.disclosed === true` **and** a `beaconUrl` is configured. Never enable a beacon
in a CAD file meant for offline use. See `LEGAL_DISCLOSURE.md` §4.

## 6. Verification side (operations)

No converter change is needed to *verify*. Given any suspect file:

```
SOLINE_IP_SECRET=… node ip-protection/verify.js <file>        # human report
node ip-protection/verify.js <file> --json                    # machine-readable
```

It reports the surviving channels, decodes the origin (`pid`/`cid`/`nid`/…), and —
with the secret — states HMAC authenticity (genuine vs. forged). Resolve `nid` →
licensee via the issue log, then act through lawful channels (§7 of
`LEGAL_DISCLOSURE.md`).

## 7. Rollout checklist

1. Set `SOLINE_IP_SECRET` on the converter host (secret manager / env, not committed).
2. Add `soline_convert_ip.js` (§2). Do **not** edit `soline_convert.js`'s exporters;
   the wrapper only calls the existing `convert()` and then `stampFile` per path.
3. Wire `origin` (`pid`/`cid`/`tier`) from the order/dashboard layer (§3).
4. Point `issuerLog` at durable, access-controlled storage (§4).
5. Confirm the customer license carries the fingerprint-disclosure clauses
   (`LEGAL_DISCLOSURE.md` §3) **before** shipping stamped files — and before any
   beacon is switched on.
6. Smoke-test: run `convertProtected` on a sample, then `verify.js` each produced
   file; confirm `marked:true`, correct origin, and `authentic:true`.
</content>
</invoke>
