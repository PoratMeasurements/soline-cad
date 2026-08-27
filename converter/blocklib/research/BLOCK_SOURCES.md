# BLOCK_SOURCES — License-catalogued reference sources for the Soline block library

> Reference gathering **only**. Per `docs/LICENSES.md`, we take **facts** (dimensions, clearances,
> standard widths, cut-out sizes) and draw **original geometry**. We never copy another party's
> DWG/DXF linework, layer names, or file. Every source below carries a GREEN / AMBER / RED verdict.
> **Downloaded files under `research/downloads/<category>/` are GREEN (CC0) only** — see the note at
> the end for why AMBER portals were catalogued but not pulled into the repo.

Date: 2026-08-22 · Retrieved by: research pass · Units note: CC0 set is imperial (inches); we work in mm.

Verdict key (from `docs/LICENSES.md`):
- **GREEN** — CC0 / free → may study **and adapt geometry** (we still re-draw parametrically from scratch).
- **AMBER** — free-for-plans, but product-inclusion / redistribution unclear → take **dimensions & conventions only**, never the file/linework.
- **RED** — restricted → do **not** use in any form.

---

## Category: CABINETS (base / wall / tall / corner, worktops)

Best-rated first.

| Rank | Source | URL | Covers | Verdict | Notes |
|---|---|---|---|---|---|
| 1 | **GSStnb/dxfBlocks** (Cabinets) | https://github.com/GSStnb/dxfBlocks/tree/master/Architecture/Cabinets | Lower (24″-deep = base) and Upper (12″-deep = wall) cabinet **width families** 9/12/15/18/21/24/27/30/33/36″ + `-X` (custom) + `Corner`/`CornerAlt1` variants | **GREEN** | LICENSE file re-verified at fetch = **CC0 1.0 Universal** (the GitHub UI badge mislabels it; the raw `LICENSE` text is the authority). **Downloaded** — 26 files. Full-scale, real units. Directly parallels our own width-family + corner approach. |
| 2 | **Blum** — Cabinet Configurator + CAD/CAM Data Service | https://www.blum.com/eu/en/services/planning-construction-product-selection/cabinet-configurator/ · https://www.blum.com/eu/en/services/industrial-production/cad-cam-dataservice/ | Carcass construction, drawer/pull-out internal envelopes, hinge cup positions, min. cabinet-internal clearances | **GREEN (facts only)** | Proprietary **documents** → take **numeric dimensions/mechanism envelopes only**. Do **NOT** embed Blum's DWG/DXF/BXF files. Facts feed `metadata.sources[]` as `manufacturer-spec`. |
| 3 | Free CAD portals — kitchen-cabinet elevations/plans | https://www.cadblocksfree.com/en/3d-cad-models/furniture/kitchen.html · https://dwgfree.com/category/kitchen-cad-blocks-drawings/ · https://www.freecads.com/en/kitchen · https://dwgmodels.com/156-furniture-17-kitchen.html | Base/wall cabinet plan+elevation blocks, worktops | **AMBER** | Free-to-download ≠ free-to-redistribute; terms silent/unclear on product inclusion. **Dimensions & drawing conventions only**; never take the file. |
| 4 | Israeli portals — SAF, cad-blocks.online (HE), Pratim, Sivan Yitzhak kitchen file | https://www.saf.co.il/sal/detmain.php?title=4 · https://cad-blocks.online/he/downloads/ · https://www.pratim.co.il/www/mag_main.asp?id=59 · https://www.sivanyitzhak.com/kitchen | Israeli-market kitchen furniture blocks, plan-view planning symbols | **AMBER** | Useful for **local convention** (Hebrew labelling, mm sizing, IL layouts). Study conventions only; licenses not stated. |

## Category: APPLIANCES (oven, hob/range, dishwasher, fridge, hood, microwave)

| Rank | Source | URL | Covers | Verdict | Notes |
|---|---|---|---|---|---|
| 1 | **GSStnb/dxfBlocks** (Appliances/Kitchen) | https://github.com/GSStnb/dxfBlocks/tree/master/Architecture/Appliances/Kitchen | Dishwasher, MicrowaveOven, Range Hood, Range (Elec/Gas × Back/Front control), Refrigerator (French / Side-by-Side / Single-door) | **GREEN** | CC0. **Downloaded** — 10 files. Gas-range block carries detailed burner-grate geometry (200 arcs) — a good detail-level reference. |
| 2 | **Bosch** — installation & specification guides | https://media3.bosch-home.com/Documents/ (per-model spec PDFs) | Built-in oven / dishwasher / hob **cut-out dimensions**, recess heights, min. clearances | **GREEN (facts only)** | Take cut-out numbers only. IL market carries Bosch heavily → primary appliance-dimension source. |
| 3 | **GE Appliances** — CAD & dimension docs | https://products.geappliances.com/appliance/gea-support-search-content?contentId=17025 | Per-model 2D/3D CAD + printer-friendly dimension/installation sheets | **GREEN (facts only)** | Use the **dimension sheets**; do NOT embed GE's DWG files. |
| 4 | **ARCAT** — residential kitchen appliances | https://www.arcat.com/content-type/cad/11/residential-kitchen-appliances-113113 · terms: https://www.arcat.com/terms | Manufacturer-supplied appliance CAD (incl. GE via ARCAT) | **AMBER (→ dimension-check only)** | ARCAT terms: download permitted for the end-user's **own project**, "not a sale", ARCAT/manufacturer retain all IP. Files are proprietary manufacturer expression → **dimension-check only; never redistribute/embed**. |
| 5 | Free portals — appliance bundles | https://dwgmodels.com/197-kitchen-appliances.html · https://cad-block.com/183-kitchen-equipment.html · https://www.cadblocksdwg.com/kitchen.html · https://linecad.com/kitchen-technics-cad-blocks-free-dwg-for-appliance-layouts/ | Oven/hob/hood/fridge/DW plan+elevation blocks | **AMBER** | Conventions & sizing only. |

## Category: SINKS + TAPS

| Rank | Source | URL | Covers | Verdict | Notes |
|---|---|---|---|---|---|
| 1 | **GSStnb/dxfBlocks** (Fixtures/Kitchen) | https://github.com/GSStnb/dxfBlocks/tree/master/Architecture/Fixtures/Kitchen | Sink-Single, Sink-Double (bowl outline w/ radiused corners + drain circle) | **GREEN** | CC0. **Downloaded** — 2 files. Clean reference for the sink-bowl + drain plan convention. |
| 2 | Free tap/faucet portals | https://cad-block.com/162-kitchen-faucets.html · https://freecadfloorplans.com/kitchen-faucets/ · https://dwgmodels.com/559-grohe-kitchen-faucets.html · https://www.freecads.com/cad/free-kitchen-sinks-bundle-cad-blocks-dwg-dxf-pdf-format/ | Single/pullout/two-handle taps, sink bundles (plan+elevation) | **AMBER** | Tap plan/elevation conventions & sizing only. Grohe file = manufacturer expression → facts only. |
| 3 | Grohe / tap-maker spec pages | (manufacturer product pages) | Spout reach, base-hole Ø, tap footprint | **GREEN (facts only)** | Numbers only for the tap symbol; sink plumbing sits on `SOL-INSTALATSIA` via the symbol module, not the block. |

## Category: KITCHEN PRODUCTS (tables, chairs, misc furniture)

| Rank | Source | URL | Covers | Verdict | Notes |
|---|---|---|---|---|---|
| 1 | **GSStnb/dxfBlocks** (Furniture/Kitchen) | https://github.com/GSStnb/dxfBlocks/tree/master/Architecture/Furniture/Kitchen | Chair, TableRect-60×38, TableRnd-48 | **GREEN** | CC0. **Downloaded** — 3 files. Reference for free-standing (island/dining) footprint symbols. |
| 2 | **QCAD** Architecture add-on part library | https://www.qcad.org/en/qcad-add-ons | ~600 architectural components (doors, symbols, people, plants) | **AMBER** | Software is GPLv3-with-exceptions, but the **library-content license is unspecified** (QCAD license page is silent on part-content redistribution). Treat as AMBER — **conventions only** until content license is clarified; do not embed. |

## Category: OUTDOOR-KITCHEN UNITS (grill / BBQ)

| Rank | Source | URL | Covers | Verdict | Notes |
|---|---|---|---|---|---|
| 1 | Free BBQ/grill portals | https://cadblockdwg.com/guides/free-bbq-grill-cad-blocks-dwg · https://www.cadblocksfree.com/en/free-2d-cad-models/bbq-grill-plan-view-cad-block-free-dwg-autocad-imperial-drawing-available-to-download.html · https://cad-block.com/185-barbecue.html · https://linecad.com/gas-grill-cad-blocks-dwg-outdoor-kitchen-appliance/ | Built-in / freestanding gas grills, BBQ areas (plan + elevation) | **AMBER** | cadblockdwg states "free for personal and commercial, no signup/watermark" but redistribution-in-a-product is still not asserted → conventions/sizing only. |
| 2 | Grill-maker spec sheets (Weber, etc.) | (manufacturer product pages) | Grill cut-out width/depth for built-in island units | **GREEN (facts only)** | Numbers only. |

---

## RED — excluded (do not use in any form)

- Any paid/commercial block-pack `.dwg`/`.dxf` (e.g. stock kitchen-CAD packs), and any **2020 / Cabinet Vision / other kitchen-CAD** stock content — geometry, block names, or layer names.
- Any manufacturer's own CAD file (Blum BXF/DWG, Bosch/GE/Grohe DWG, ARCAT-hosted manufacturer files) **embedded as-is** — these are dimension-check references only, never redistributed.
- Any AMBER source above **before** its content license is cleared and promoted to GREEN in `docs/LICENSES.md`.

## Why downloads are CC0-only (license discipline note)

The task permits downloading GREEN **and** AMBER references. In practice only the **GREEN CC0 set
(GSStnb/dxfBlocks)** was pulled into `research/downloads/`, because:
1. It already covers **every category** (base + wall + corner cabinets, all major appliances, sinks,
   furniture) as clean, **ASCII-DXF, machine-parseable** files we can study freely.
2. AMBER portal files are mostly **binary DWG** of **unclear redistribution status** — storing them in
   the repo adds licence risk with no reference gain over what the CC0 set and the manufacturer
   dimension sheets already give us. AMBER/manufacturer sources are therefore catalogued here for
   **on-page dimension/convention study**, not committed as files.

This keeps `research/downloads/` uniformly CC0 and the provenance chain clean for the QA gate.

## Downloaded inventory (all GREEN / CC0-1.0, source: GSStnb/dxfBlocks @ master)

- `downloads/cabinets/` — 26 files: `GSStnb_Upper-{9,12,15,18,21,24,27,30,33,36,X}.dxf`,
  `GSStnb_UpperCorner.dxf`, `GSStnb_UpperCornerAlt1.dxf`, and the matching `GSStnb_Lower-*` set.
- `downloads/appliances/` — 10 files: Dishwasher, MicrowaveOven, Range_Hood,
  Range-{Elec,Gas}×{Back,Front}Ctrl, Refrigerator-{French,SbS,SglDoor}.
- `downloads/sinks/` — 2 files: Sink-Single, Sink-Double.
- `downloads/products/` — 3 files: Chair, TableRect-60X38, TableRnd-48.
