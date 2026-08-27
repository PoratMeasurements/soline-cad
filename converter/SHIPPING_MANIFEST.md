# Soline Converter — Shipping Manifest

**Purpose:** define exactly what is included in a **published/shippable** build of the Soline
converter and what is **DEV-ONLY** (present on a licensed developer seat but excluded from any
distributed build). This enforces the interop-compliance mandate in
[`docs/INTEROP_COMPLIANCE.md`](docs/INTEROP_COMPLIANCE.md): **Soline never redistributes
InnoDraw / Raumplan vendor files.**

> The exclusion list below is mirrored, machine-enforceable, in **`.npmignore`** (used by
> `npm pack` / `npm publish`) and should be applied by any other packaging step (zip, installer,
> `git archive`). Nothing here is deleted from the working tree — the dev files stay locally so
> the pipeline keeps working on the licensed dev seat; they are only **excluded from the package**.

---

## 1. What SHIPS (Soline's own code + lawfully-derived data)

| Path | What it is |
|---|---|
| `soline_convert.js`, `cli.js`, `convert.js`, `soline.js`, `watch_convert.js` | Soline's own converter entrypoints |
| `src/**` (except none — all Soline code) | ORDX / DXF / PDP / report generators. `src/writePdpDR.js` builds the PDP on the **customer's own** base at runtime (ships no base) |
| `blocklib/**`, `viz/**` | Soline's own block library + visualization engine |
| `elements.json`, `symbols.json`, `elements_raumplan.json`, `symbols_raumplan.json` | Soline-authored catalogs (names, mm dims, mount heights, symbol *descriptions*) — facts/prose, no vendor bytes |
| `templates/ctb/**` (`SOLINE.ctb`) | Soline's own plot-style tables |
| `templates/dr/safe_symbol_codes.json`, `templates/dr/safe_substitutions.json` | Soline-authored numeric interface fact tables (small type→code maps) |
| `docs/**` (documentation `.md`/`.html`) | Soline docs, incl. `PDP_CUSTOMER_BASE.md`, `INTEROP_COMPLIANCE.md` |
| `soline.config.example.json` | Config template the customer copies to `soline.config.json` |
| `SHIPPING_MANIFEST.md` (this file) | The manifest |

The ORDX exporter, the DXF path, and the re-drawn IEC/plumbing symbol set are original or
lawfully-derived and ship as-is (already audited clean; see `docs/IP_COMPLIANCE_REPORT.md`).

---

## 2. What is DEV-ONLY (EXCLUDED from every published build)

These are **vendor-origin files** or a **dev corpus**. They must not be redistributed. They remain
in the working tree for the licensed dev seat only.

### Vendor-origin PDP bases and element records — the primary exposure
| Path | Why excluded |
|---|---|
| `templates/dr/base/**` | Real Raumplan/InnoDraw `.pdp` base files (embed vendor 2D symbol artwork + 3D meshes + file structure). The **customer supplies their own** base at convert time — see `docs/PDP_CUSTOMER_BASE.md`. |
| `templates/dr/items/**` | Per-type `{code+property-block}` `.bin` units **extracted from the InnoDraw `El_Cad--1` install**. Not shipped; the units are harvested from the customer's own base at runtime. |
| `templates/dr/native/**` | Older/native vendor `.pdp` bases (native-injection R&D). |
| `templates/dr/wall*.pdp` | Legacy bundled vendor bases (the legacy loader that used them has been removed). |

### Dev corpus + generated outputs (owner's real vendor exports + our test outputs)
| Path | Why excluded |
|---|---|
| `analysis/out/**` | Dev corpus: owner's real `mimran-*` / `*_DR1` InnoDraw exports used as decode ground-truth, plus generated outputs. |
| `out/**`, `out_test/**`, `out_health/**` | Generated test/health outputs (contain rebuilt `.pdp`). |
| `inbox/**`, `research/**`, `_LATEST/**`, `_baseline_preview.html` | Working scratch / research artifacts. |
| `node_modules/**`, `desktop.ini`, `.claude/**` | Standard non-ship. |

### Runtime note
The default PDP path (`convertRoomDRv2(room, {})`) needs **only a base** — never the `.bin`
records. The `.bin` corpus is used solely by the opt-in `editSymbol` varied-symbol export, which
in a shipped build harvests its symbol units from the customer's own base slots instead.

---

## 3. Compliance invariant (enforced in code)

`src/writePdpDR.js` resolves the base dir at convert time in this order:

1. `SOLINE_DR_BASE_DIR` (env)
2. `soline.config.json` → `drBaseDir`
3. **DEV-ONLY** local `templates/dr/base` (excluded from the package by this manifest / `.npmignore`)

If none resolves, PDP export **fails cleanly** with a setup message and **never** falls back to a
bundled vendor file. In a correctly-packaged build (dirs at #3 excluded), a customer with no
configured base gets the clear setup error — exactly the intended behavior.
