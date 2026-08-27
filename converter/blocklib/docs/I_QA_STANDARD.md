# I — Automated QA Standard + per-cycle gate

> Every generated block passes an automated QA suite before it counts as "done". This file defines the
> checks, the per-cycle QA-report format, and the **hard gate**: ≤10 blocks per cycle + a contact
> sheet + owner approval before the next family (principles 7–9).

Date: 2026-08-22 · Units: mm.

---

## 1. The per-cycle gate (principles 7–9)

A **work cycle** produces **at most 10 blocks**. The build (`cli.js`) **refuses** to emit an 11th block
in a cycle — a hard stop, not a warning. On completion of a cycle it produces:

1. `docs/qa/CYCLE_<n>_QA.md` — the QA report (format §4).
2. `docs/qa/CYCLE_<n>_CONTACT.html` — a contact sheet: every preview (all views of all blocks in the
   cycle) on one page, each captioned with key + view + pass/fail chips.

Then it **STOPS** and waits for **explicit owner approval** before the next family/cycle. No auto-
continuation. This mirrors the converter's existing contact/QA discipline (`converter/_contact*.html`,
`docs/QA_REPORT.md`).

## 2. Check catalogue

Each check has an id, a severity (`error` fails the block; `warn` is advisory), and a scope.

### Geometry
| id | Sev | Checks |
|---|---|---|
| `closure` | error | every outline that should be closed (carcass footprint, panel, bowl) is a closed loop within 0.1 mm; no open polylines masquerading as solids |
| `self-intersect` | error | outline polygons are simple (non-self-intersecting) |
| `bbox-matches-dims` | error | each view's bounding box equals declared `dims` (± tolerance): plan ≈ W×D, front ≈ W×H, side ≈ D×H |
| `no-degenerate` | error | no zero-length lines, zero-radius arcs, duplicate coincident points |
| `arc-sanity` | warn | door-swing arc radius == leaf width; sweep 90° for single leaf |
| `on-grid` | warn | coordinates on a 1 mm grid (0.5 allowed); no sub-mm drift |

### Scale / units
| id | Sev | Checks |
|---|---|---|
| `units-mm` | error | all coordinates in mm, real-world size (a 600 cabinet is 600 units, not 0.6 or 60) |
| `plausible-size` | error | dims within family sanity band (e.g. base width 200–1200, height 700–760) |
| `text-height-scale` | warn | visible ATTRIB heights follow `paperMM × scale` (2.5 mm paper class) |

### Layer
| id | Sev | Checks |
|---|---|---|
| `layer-registry` | error | every layer used is registered in `E_LAYERS` (§1/§2 tables); no ad-hoc layers |
| `role-layer` | error | geometry is on the semantically-correct layer (carcass→`SOL-RIHUT`, swing→`SOL-RIHUT-DOOR`, hardware→`SOL-RIHUT-HW`, tags→`SOL-TEKST`) — no annotation on a geometry layer or vice-versa |
| `lineweight` | warn | layer lineweights match the ISO-128 map (`E_LAYERS §3`) |

### Naming / identity
| id | Sev | Checks |
|---|---|---|
| `key-pattern` | error | `key` matches the naming regex; block name = `SL_<key>` |
| `key-unique` | error | no duplicate key/block name across the library |
| `handle-unique` | error | DXF handles unique + within seed (reuses the converter's handle-audit) |
| `block-parses` | error | emitted DXF parses (via `dxf-parser`, the tool already used in `DXF_PRO_STANDARDS §9a`) as AC1015 |

### Views / completeness
| id | Sev | Checks |
|---|---|---|
| `views-required` | error | all ● views for the family (`H_VIEW_MATRIX`) are present |
| `view-nonempty` | error | each provided view renders real geometry (not empty/placeholder) |
| `insertion-consistency` | error | plan/front/side base points correspond to the same physical point (± 0.1 mm) |
| `preview-matches-block` | error | the SVG preview is rendered from the **same** geometry model as the DXF (hash match), so the contact sheet cannot lie |

### Provenance (LICENSES.md)
| id | Sev | Checks |
|---|---|---|
| `sources-present` | error | `metadata.sources[]` non-empty; every entry's `kind`/`ref` valid |
| `sources-registered` | error | no source references an AMBER row unpromoted to GREEN, or any RED source |
| `original-attest` | error | `metadata.originalGeometry === true` |
| `mep-companion-valid` | warn | any `mepCompanions` key exists in `element_symbols_soline.js` |

### Schema
| id | Sev | Checks |
|---|---|---|
| `schema-valid` | error | instance validates against `C_OBJECT_SCHEMA.json` (ajv) — this is the entry gate, run first |

## 3. Severity policy

- Any `error` → the block is **FAIL**; it does not ship in the cycle and blocks the gate until fixed.
- `warn` → ships but is listed; a cycle with warnings still needs owner approval and the warnings are
  shown on the contact sheet.
- A cycle passes only when **every** block is `schema-valid` + all `error` checks green.

## 4. QA report format (`CYCLE_<n>_QA.md`)

```
# Block Library — QA Report — Cycle <n>
Date · Family: <family> · Blocks this cycle: <k> / 10

## Summary
| Key | Block | Views | schema | geometry | scale | layer | naming | views | provenance | Result |
|-----|-------|-------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| KIT-BASE-DR2-0600 | SL_KIT_BASE_DR2_0600 | P/F/S | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| …

## Failures (if any)
- <KEY> · <check-id> · <severity> · <message> · <file:coord>

## Warnings
- <KEY> · <check-id> · <message>

## Metrics
- total primitives, per-layer counts, per-view bbox vs dims deltas, handle range
- provenance: sources by kind; any manufacturer-spec entries flagged for human confirm

## Gate
- Blocks in cycle: <k> ≤ 10  ✓
- Contact sheet: docs/qa/CYCLE_<n>_CONTACT.html  ✓
- Awaiting owner approval to proceed to <next family>:  ☐
```

## 5. Contact sheet (`CYCLE_<n>_CONTACT.html`)

- A responsive grid, one card per block, each card showing **all its views** (SVG) side-by-side, at a
  common scale bar, captioned `KEY · view` with a green/red pass chip and any warning count.
- A cycle header: family, block count (`k/10`), overall PASS/FAIL, date.
- Self-contained (inline SVG + CSS), theme-aware — same conventions as the converter's existing
  `_contact*.html` / `symbols_preview.html`.
- Its purpose is the **human eyeball gate**: the owner scans one page and approves or rejects before
  the next cycle.

## 6. Determinism check (regression)

Because the resolver is pure (`A_ARCHITECTURE §7`), QA also diffs a re-run of each block against the
committed artefact; a non-deterministic change is a `warn` (`determinism-drift`) so accidental
non-reproducibility surfaces early.
