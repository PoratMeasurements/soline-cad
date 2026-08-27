# Soline IP-Protection

Defensive fingerprinting of the files **Soline itself exports** (`.sol` / DXF-2D /
DXF-3D / PDF / HTML) so a copied or leaked file traces back to its **project +
customer**, and misuse can be flagged and proven. It mirrors what commercial
CAD-template vendors do to their own releases. It is **not** covert surveillance of
third parties — the protection must be disclosed in the customer license (see
`LEGAL_DISCLOSURE.md`).

Node + Bash, zero dependencies. **Standalone post-export pass** — it never edits the
converter's exporters (`converter/src/export_*.js`).

## Quickstart

```bash
# 1. Set the signing secret (dev placeholder is in soline-ip.config.json)
export SOLINE_IP_SECRET='your-signing-key'

# 2. Stamp a finished export in place / to a copy
node watermark.js samples/plan_room_4x4.dxf --pid PRJ-2026-0412 --cid CUST-00817 --tier pro

# 3. Verify + decode origin (add the secret to also prove authenticity)
node verify.js samples/plan_room_4x4.stamped.dxf

# 4. Full round-trip proof across all four formats
node demo.js
```

## What each layer does

1. **Metadata fingerprint** (openly readable) — DXF `999`/XDATA, PDF DocInfo+XMP,
   HTML comment+meta, `.sol` fingerprint entry. Removed by a metadata scrub.
2. **Invisible / steganographic watermark** (survives a scrub) — DXF hidden OFF
   layer `SOL-REG` with a Z-encoded POINT cloud; HTML zero-width-character run; PDF
   Tr-3 invisible text (spec). Never touches measured X/Y coordinates.
3. **Visible notice** (tiered) — a discreet `© Soline · protected & traceable` line
   for the entry tier; paying tiers stay clean but remain traceable via layer 2.
4. **Verify + detect** — `verify.js` reports channels, decodes origin, and (with the
   secret) proves authenticity via HMAC. Powers submit-to-verify and monitoring.

## The origin token

`SLN1.<base64url(payload)>.<base64url(HMAC-16)>` — reversible origin (`pid`, `cid`,
`tier`, `fmt`, `ts`, `nid`) readable without the secret; authenticity provable only
**with** Soline's secret. The secret never ships inside a file. Per-export `nid`
makes every file unique; the issue log (`issued.log.jsonl`) maps `nid → licensee`.

## Round-trip result

`node demo.js` proves, for **DXF and HTML**: stamp → strip metadata → **origin still
recovers from the surviving stego channel**. PDF metadata (DocInfo/XMP) is stamped
and verifiable (robust Tr-3 stego is spec-only); `.sol` is stamped and still opens
as a valid `.sol`. Forgery: any edit to a signed field, or a wrong key, fails HMAC.

## Files

| File | Purpose |
|---|---|
| `DESIGN.md` | Architecture, the four layers, per-tier defaults |
| `THREAT_MODEL.md` | Copy vectors × which layer defeats each; honest failures |
| `LEGAL_DISCLOSURE.md` | Mandatory license clauses + the privacy boundary |
| `INTEGRATION.md` | How the post-export pass hooks into the converter (spec) |
| `watermark.js` | CLI/lib — stamp a file |
| `verify.js` | CLI/lib — detect + decode + authenticate |
| `demo.js` | End-to-end round-trip proof (all four formats) |
| `soline-ip.config.json` | Signing secret (use env in prod) + tier policy |
| `lib/` | `fingerprint` · `dxf` · `pdf` · `html` · `sol` · `formats` |
| `samples/` | Real exporter DXF/HTML + synthetic PDF/.sol + outputs |

## Legal boundary (read before shipping)

Fingerprinting is lawful self-protection **only when disclosed**. Before shipping
stamped files: the customer license must state that deliverables carry a unique,
possibly invisible identifier tying the file to their project/account. The optional
open-beacon is **off by default** and must be separately disclosed before use. Never
embed personal data in the token. See `LEGAL_DISCLOSURE.md`.
</content>
