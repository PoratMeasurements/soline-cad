# Soline IP-Protection — Threat Model

Scope: **defensive** protection of files **Soline exports** (.sol / DXF-2D /
DXF-3D / PDF / HTML / PDP). Goal per copy/leak: (a) trace to project+customer,
(b) enable a lawful alert/takedown. This document lists the realistic **copy
vectors**, which **protection layer defeats each**, and — honestly — where the
scheme **fails**.

Layers (from `DESIGN.md`):
- **L1 Metadata** — DXF 999/XDATA, PDF DocInfo/XMP, HTML comment/meta, .sol entry.
- **L2 Stego** — DXF hidden `SOL-REG` Z-cloud, HTML zero-width run, (PDF Tr-3 spec).
- **L3 Visible notice** — discreet ownership line (tiered).
- **L4 Verify/monitor** — `verify.js`, submit-to-verify, web/marketplace monitoring.

---

## Attacker model

- **A0 Casual recipient** — got the file, forwards/reposts it as-is.
- **A1 Rebrander** — opens it, deletes obvious ownership text, resaves, redistributes.
- **A2 Metadata scrubber** — runs `exiftool -all=`, a "clean metadata" tool, or a
  DXF→DXF re-export through a naive library that drops comments/XDATA.
- **A3 Format converter** — DXF→PDF, DXF→DWG→DXF, HTML→PDF, screenshot/print.
- **A4 Targeted adversary** — knows a Soline mark exists and actively hunts it:
  deletes unknown layers, purges the drawing, retypes text, redraws geometry.

We can strongly deter A0–A2, partially survive A3, and we are honest that A4 with
enough effort can strip any in-file mark (the residual defense there is L4 +
similarity/monitoring, not the in-file token).

## Copy vector × defeating layer

| # | Copy vector | L1 | L2 | L3 | L4 | Outcome |
|---|---|:--:|:--:|:--:|:--:|---|
| V1 | **Verbatim copy** (email, USB, re-upload) | ✔ | ✔ | ✔ | ✔ | Fully traceable — every channel intact. |
| V2 | **Delete visible notice text**, resave (A1) | ✔ | ✔ | ✖ | ✔ | Traceable via L1+L2. |
| V3 | **Strip metadata** — exiftool / clean-tool / naive re-export (A2) | ✖ | ✔ | dep. | ✔ | **Traceable via L2 stego.** ← the round-trip proven in `demo.js`. |
| V4 | **DXF → PDF / print** of the plan | partial | ✖(geometry lost) | ✔ if visible | ✔ | Z-cloud lost in raster/print; a visible notice or the reprinted dimensions survive; monitoring/verify on the PDF's own mark if re-stamped. |
| V5 | **HTML → PDF (browser print)** | ✖ meta may drop | ✔ zero-width text prints into PDF text layer | ✔ if visible | ✔ | Zero-width run travels into the PDF text layer → still decodable. |
| V6 | **DXF → DWG → DXF** round-trip through AutoCAD | ✖ 999 dropped; XDATA may survive | ✔ POINT geometry survives a normal save | ✔ | ✔ | XDATA (APPID `SOLINE`) often survives; the SOL-REG points always survive a normal save. |
| V7 | **Screenshot / photo of the plan** | ✖ | ✖ | ✔ if visible | ✔ (visual similarity) | Only the visible notice + human/similarity recognition remain. |
| V8 | **`AUDIT`/`PURGE`/erase unused layers** in AutoCAD (A4) | ✖ | ⚠ POINTs are *used* entities so PURGE keeps them, but explicit "delete SOL-REG layer" removes them | ✔ if visible | ✔ | PURGE alone does **not** remove the stego (points are real entities, not an empty layer). A deliberate layer delete does. |
| V9 | **Targeted mark removal** — find & delete SOL-REG + XDATA + notice + zero-width (A4) | ✖ | ✖ | ✖ | ⚠ | In-file trace defeated. Residual: L4 monitoring, visual/geometry similarity, and the fact that the plan's *content* (exact measurements, layout, Hebrew labels) is itself circumstantial provenance. |
| V10 | **Retype / rebuild the drawing from scratch** using the numbers | ✖ | ✖ | ✖ | ✖ | No in-file mark can survive a full human re-creation. Out of scope for any fingerprint; a legal/contractual matter. |
| V11 | **Forge a mark** — edit pid/cid to blame another customer (A4) | — | — | — | ✔ | **HMAC defeats this**: any edit to a signed field fails `verify.js` (proven in `demo.js`). Attacker cannot mint a valid token without the secret. |
| V12 | **.sol leak** (internal source) | ✔ | n/a | n/a | ✔ | Fingerprint entry + manifest field trace it; still a valid `.sol`. |

## Where the scheme fails (be explicit)

1. **Full human re-creation (V10)** and **raster-only copies (V7)** carry no
   decodable token. Nothing embeddable survives them. Mitigation is non-technical
   (contract, watermark-as-deterrent, the distinctiveness of the content itself).
2. **A determined, informed adversary (V9)** can remove every in-file mark. The
   scheme raises cost and enables proof against A0–A3 — it is a deterrent and a
   forensic aid, **not** DRM and not unbreakable.
3. **PDF stego is spec-only here (V4 for a natively-generated PDF).** Until the
   Tr-3 watermark is implemented, a natively-produced Soline PDF that is metadata-
   scrubbed loses its mark. The HTML→PDF path (V5) is covered today via zero-width.
4. **Offline covert phone-home is impossible and not attempted.** DXF/PDP opened in
   offline CAD cannot alert. Alerting relies on L4 (submit-to-verify, monitoring)
   and, only where disclosed, an HTML/PDF beacon.

## Defense-in-depth summary

- **Every tier always gets L1 + L2.** L2 is the workhorse against the common,
  realistic attacker (A2 / V3) and costs nothing visually.
- **L3** deters the casual and lower-tier case.
- **L4 + HMAC** turn a recovered mark into *proof* (authenticity, non-forgeability)
  and extend reach beyond the file (monitoring, verify-portal, issue-log lookup by
  `nid`).
- **Legal disclosure** (`LEGAL_DISCLOSURE.md`) is a prerequisite for any active
  detection (beacons) and frames the whole system as lawful, disclosed
  self-protection — not covert surveillance.
