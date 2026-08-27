# Source License Register — BINDING provenance rules

> This register operationalises binding principles **1–3**. Every research source the library draws
> on is listed here with (a) its license, (b) what we are permitted to take from it, and (c) an
> explicit **red line**. No geometry, file, block, or name may enter the library unless its
> provenance is one of the GREEN rows below. Each generated object records its dimension sources in
> `metadata.sources[]` (see `C_OBJECT_SCHEMA`), and the per-cycle QA report (`I_QA_STANDARD`)
> fails any object whose sources are not all registered here.

Date: 2026-08-22 · Owner sign-off required before first generation.

---

## The one rule, stated plainly

We take **facts** (dimensions, clearances, standard cabinet widths, appliance cut-out sizes,
mechanism envelopes) and **standards** (ISO, ת"י, EN). We draw **original geometry** from those
facts. We never take **expression** (someone else's DWG/DXF block, its linework, its layer names,
its file). Dimensions are facts and are not copyrightable; a drawing of them is expression and is.

---

## GREEN — may study and use, per license

| Source | License | May take | Red line |
|---|---|---|---|
| **GSStnb/dxfBlocks** (github.com/GSStnb/dxfBlocks) | **CC0-1.0** (public domain dedication) | Anything, including geometry — CC0 waives rights. We still **re-draw parametrically from scratch** (principle 4) and use it only to sanity-check proportions, never to copy-paste linework, so the library stays uniformly ours in style and layering. | Confirm the repo's LICENSE file still reads CC0 at fetch time; record commit hash in `sources[]`. |
| **Manufacturer public spec sheets** — Blum (configurator + CAD/CAM dataservice), Bosch spec library, GE Appliances install specs | Proprietary **documents**; we use only the **factual dimensions/clearances** printed in them | Numeric dimensions, cut-out sizes, hinge/runner/lift mechanism envelopes, minimum clearances, standard widths. These are facts. | **Do NOT redistribute or embed the manufacturer's own CAD files, DWG/DXF blocks, drawings, or images.** Their files are for dimension-checking/fit only (principle 3). We generate our own blocks from the numbers. |
| **Published standards** — ISO 128 / ISO 5455, AIA/NCS layer guidelines, Israeli ת"י (e.g. ת"י 4910 ממ"ד), EN 13384 (flues), building-code cut-outs | Standards texts (referenced, not reproduced) | The normative numbers and conventions they define. | Do not reproduce standard text verbatim beyond short cited clauses; cite by number. |

## AMBER — must check & document license **before any use**

| Source | Why AMBER | Required action before use |
|---|---|---|
| **QCAD add-ons** (qcad.org/en/qcad-add-ons) — part libraries | Mixed licensing; some libraries are GPL, some proprietary, some redistributable, some not. QCAD itself is dual-licensed (GPLv3 / commercial). | For **each** library used: locate its explicit license, record it in this table, and confirm it permits (i) study and (ii) redistribution inside a software product. If unclear → treat as RED. Never assume "QCAD = free to embed". |
| **ARCAT** residential-kitchen-appliance CAD (arcat.com) | Free-to-download **≠** free-to-redistribute. ARCAT content is typically licensed for the end-user's own project use, and files are manufacturer-supplied (proprietary expression). | Read ARCAT's terms of use + the specific manufacturer's terms. Use for **dimension-checking only** unless terms explicitly permit inclusion in a redistributed software product. Default assumption: **dimension-check only**, like any manufacturer file. |

## RED — never enter the library

- Any commercial block library's `.dwg`/`.dxf`/`.rfa` files, their geometry, or their block/layer names (e.g. paid CAD block packs, 2020/Cabinet Vision/other kitchen-CAD stock content).
- Any manufacturer's own CAD asset embedded as-is.
- Any AMBER source not yet cleared through the table above.
- Any name copied from a commercial library (principle 1 covers **names**, not just geometry).

---

## Provenance workflow (enforced by QA)

1. Before drawing an object, its dimensions are gathered into `metadata.sources[]`, each entry being
   `{ kind: "cc0|manufacturer-spec|standard|measured|derived", ref, note, retrieved }`.
2. `kind:"manufacturer-spec"` entries may contribute **numbers only**; the QA report flags the object
   for a human confirmation that no manufacturer geometry/file was used.
3. Every object carries `metadata.originalGeometry: true` — an explicit attestation that the linework
   was authored parametrically here, from scratch.
4. The QA gate (`I_QA_STANDARD` §Provenance) **fails** any object whose sources reference an AMBER row
   that has not been promoted to GREEN in this file, or a RED source of any kind.

## Source-citation format (also used in `metadata.sources[]`)

```json
{ "kind": "manufacturer-spec", "ref": "Blum LEGRABOX pull-out — inner drawer height/depth chart",
  "note": "cabinet-internal drawer envelope only; geometry drawn from scratch", "retrieved": "2026-08-22" }
```
