# Soline IP-Protection — Design

> תקציר: מערכת הגנת-קניין-רוחני של סולין על הקבצים **שסולין עצמה מייצאת** (.sol / DXF-2D / DXF-3D / PDF / HTML). כל קובץ מקבל "טביעת-אצבע" ייחודית וחתומה שממנה אפשר להתחקות חזרה לפרויקט+לקוח, גם אם הקובץ הועתק או דלף. זהו מהלך **הגנתי** על הקבצים של סולין — המראה של מה שספקי-תבניות CAD מסחריים עושים. אין כאן מעקב סמוי אחרי צד-שלישי; ההגנה חייבת להיות מגולה בתנאי-הרישיון (ראה `LEGAL_DISCLOSURE.md`).

This module is a **standalone post-export pass**. It never edits the converter's
exporters (`converter/src/export_*.js`); it reads an already-generated file and
writes a marked copy. See `INTEGRATION.md` for how it hooks into the pipeline.

---

## 1. Goal

If a Soline output file is copied or leaked, we want to be able to:

- **(a) Trace** it back to the originating **project + customer** (+ tier, format,
  issue time, and a per-export nonce), and
- **(b) Alert / act** — prove the file is Soline's, identify the licensee it was
  issued to, and (where lawfully disclosed) be notified.

This is the mirror image of what commercial CAD-template and content vendors do to
their own released files. It is **defensive**: it protects Soline's own IP.

## 2. The origin token (the one unit of truth)

Everything hangs off a single **authenticated origin token** (`lib/fingerprint.js`):

```
SLN1.<base64url(payloadJSON)>.<base64url(HMAC-SHA256[secret] , 16 bytes)>
```

The payload is plaintext JSON:

```json
{ "v":1, "pid":"PRJ-2026-0412", "cid":"CUST-00817", "tier":"pro",
  "fmt":"dxf2d", "ts":1787327088, "nid":"d45a6e93d67bb5ff", "job":"מטבח דירת ממרן" }
```

Two properties, deliberately split:

| Property | Needs the secret? | Why |
|---|---|---|
| **Reversible** — decode `pid`, `cid`, `tier`, `fmt`, `ts`, `nid` | **No** | A customer or auditor can *read* who a file belongs to. |
| **Authenticated** — prove the token is genuine / unaltered | **Yes** | Only Soline can *mint* tokens or *prove* one is real. The 16-byte HMAC covers `v\|pid\|cid\|tier\|fmt\|ts\|nid`; any edit to a signed field, or a wrong key, fails verification. |

The **signing secret never ships inside an exported file**. It lives only on the
signing side (`SOLINE_IP_SECRET` env, or `soline-ip.config.json`). This is what
makes a mark **unforgeable**: an adversary who reads a token cannot manufacture a
new valid one for a different customer.

`nid` (per-export random nonce) makes every stamped file unique — two leaks are
distinguishable, and a single stamp can be revoked/looked-up via the issue log
(`issued.log.jsonl`, written by `watermark.js`).

A **compact binary form** (`packCompact`) carries just `pid|cid|nid|sig` for
low-capacity stego channels.

## 3. The four protection layers

### Layer 1 — Metadata fingerprint (openly readable)
Embed the token in each format's native metadata channel:

| Format | Metadata channel |
|---|---|
| DXF | Top-of-file `999` comment lines + a registered `SOLINE` **APPID** with the token as **XDATA (1001/1000)** on a marker POINT. |
| PDF | **DocInfo** `/SolineFP` + `/Producer`, and an **XMP** `/Metadata` object, appended as a valid **incremental update** (pure append — no corruption). |
| HTML | `<!-- SOLINE-FP: … -->` comment + `<meta name="soline:fingerprint">`. |
| .sol | A `soline_fingerprint.json` ZIP entry + a `solineFingerprint` field in `manifest.json` + the ZIP archive comment. |

Readable by any standard tool (AutoCAD properties, `exiftool`, view-source, unzip).
**Defeated by** a deliberate metadata scrub — which is why Layer 2 exists.

### Layer 2 — Invisible / steganographic watermark (survives metadata stripping)
A robust mark that stays after the obvious metadata is gone:

| Format | Stego channel | Invisible because | Capacity |
|---|---|---|---|
| **DXF** | Hidden **OFF** layer `SOL-REG` holding a **POINT cloud whose Z-coordinate encodes each byte** of the compact fingerprint. | A 2D top view ignores Z; the layer is off; X/Y sit on `$INSBASE` so **measured coordinates are never touched** and drawing extents don't change. | ~1 byte/point; ~57 points for a full compact record. Trivial vs. a real plan's thousands of entities. |
| **HTML** | A **zero-width character run** (U+200B/U+200C bits, framed by U+2060) inside a benign footer node. | Renders and prints as nothing; copy-pastes with the text. | 1 bit/char. |
| **PDF** | *(spec)* an invisible **text render-mode 3 (Tr 3)** watermark drawn on each page's content stream. | Tr 3 paints no pixels but stays in the text layer. | High. Not byte-prototyped (needs a full PDF library — see §6). |

The DXF and HTML stego channels are **fully prototyped and pass the round-trip**
(`demo.js`): stamp → strip metadata → the origin still decodes from stego.

Design principles for the stego channel: **survivability first** (survive the
common copy + scrub), **never break the drawing** (no sub-precision jitter on
measured geometry — we use an unused dimension, Z, not LSBs of X/Y), and **honest
about limits** (a targeted adversary who deletes non-standard layers or retypes
text defeats it — see `THREAT_MODEL.md`).

> Alternative stego vectors considered and **rejected** for the measurement use-case:
> **coordinate-LSB jitter** on X/Y (risks corrupting the very measurements the
> deliverable exists to convey) and **entity-ordering codes** (fragile — any
> re-save reorders). Z-channel on an off layer is both invisible and lossless to
> the measurements.

### Layer 3 — Visible notice (tiered)
An optional discreet ownership line for lower tiers — a DXF `TEXT` on a
`SOL-NOTICE` layer, or an HTML footer `<div>`: `© Soline · protected & traceable ·
<pid>/<cid>`. Added by `watermark.js --visible` or by tier policy. Higher tiers get
only the invisible marks so the deliverable stays clean.

### Layer 4 — Verification + detection/alert
`verify.js` reads a suspect file, reports which channels are present, decodes the
origin, and (with the secret) states authenticity. Detection/alerting mechanisms
and their honest limits are in §5 and `THREAT_MODEL.md`.

## 4. Recommended default protection per tier

| Tier | Metadata | Stego | Visible notice | Telemetry beacon (disclosed) |
|---|---|---|---|---|
| **standard** | ✔ | ✔ | ✔ (discreet line) | ✖ |
| **pro** | ✔ | ✔ | ✖ | optional, only if licensed & disclosed |
| **enterprise** | ✔ | ✔ | ✖ | optional, only if licensed & disclosed |

Rationale: **stego is always on** (it's the only channel that survives a scrub and
it's free/invisible). The visible notice is the cheap deterrent for the entry tier;
paying tiers get a clean drawing but remain fully traceable through the invisible
marks. Telemetry is never a default — see §5 and Legal.

## 5. Detection / alert — what's feasible, honestly

| Mechanism | Feasible? | Notes |
|---|---|---|
| **Submit-to-verify service** | ✔ Yes | The core, always-lawful path. Someone submits a suspect file to `verify.js` (or a hosted portal); it returns origin + authenticity. Powers takedowns and "this is our file, issued to X". |
| **Disclosed telemetry beacon** (HTML/PDF) | ⚠ Only if disclosed | A 1×1 `<img>` in an HTML deliverable can fire on open and report the `nid`. Lawful **only** when the customer's signed license discloses it (`LEGAL_DISCLOSURE.md`). Off by default; gated behind `opts.disclosed === true` in `html.stamp`. |
| **Marketplace / web monitoring** | ✔ Yes | Periodically search CAD marketplaces / the web for files, run them through `verify.js`. The fingerprint turns a "looks similar" hunch into proof. |
| **Covert phone-home from offline CAD (DXF/PDP)** | ✖ **NOT feasible / not acceptable** | A DXF/PDP opened in offline AutoCAD cannot and must not silently call home. We do not attempt it. Any DXF/PDP "alerting" is via the submit-to-verify or monitoring paths, not a covert beacon. |
| **Covert surveillance of third parties** | ✖ **Prohibited** | We only fingerprint Soline's own files and identify the licensee they were issued to. We do not track third parties who receive a leaked file beyond a lawfully-disclosed beacon. |

## 6. Prototype status & limits

- **DXF (2D/3D), HTML** — metadata **and** stego fully prototyped; round-trip
  (stamp → strip → detect-via-stego) passes in `demo.js`.
- **PDF** — metadata (DocInfo + XMP incremental update) fully prototyped and
  verifiable; **robust stego (Tr-3 invisible text) is specified but not
  byte-prototyped** here, because it requires rewriting page content streams + the
  xref, i.e. a full PDF library (`pdf-lib`/`hummus`). In production the HTML→PDF
  print path already carries the HTML zero-width stego into the PDF text layer,
  which covers the common case.
- **.sol** — fingerprint entry + manifest field; still opens as a valid `.sol`
  via the converter's `readSol.js` (verified in `demo.js`). `.sol` is Soline's
  internal source format (least likely to leak externally), so it gets a
  lightweight fully-readable mark rather than stego.

## 7. Files

```
ip-protection/
├── DESIGN.md              ← this file
├── THREAT_MODEL.md        ← copy vectors × which layer defeats each
├── LEGAL_DISCLOSURE.md    ← what must be in Soline's license + privacy limits
├── INTEGRATION.md         ← how this hooks into the converter (spec only)
├── README.md              ← quickstart
├── soline-ip.config.json  ← signing secret (use env in prod) + tier policy
├── watermark.js           ← CLI/lib: stamp a file
├── verify.js              ← CLI/lib: detect + decode + authenticate
├── demo.js                ← end-to-end round-trip proof (all four formats)
├── lib/
│   ├── fingerprint.js     ← token build/parse/verify + compact form + HMAC
│   ├── dxf.js             ← DXF stamp/detect/strip (metadata + Z-stego)
│   ├── pdf.js             ← PDF stamp/detect (DocInfo + XMP incremental update)
│   ├── html.js            ← HTML stamp/detect (comment/meta + zero-width stego)
│   ├── sol.js             ← .sol stamp/detect (ZIP; minimal reader+writer)
│   └── formats.js         ← extension dispatch + config/secret + visible notice
└── samples/               ← real exporter DXF/HTML + synthetic PDF/.sol + outputs
```
