# Soline — Interoperability Compliance & Remediation Plan (ORDX / PDP export)

**Date:** 2026-08-24 · **Scope:** what the Soline converter product **bundles and redistributes** to
export ORDX and PDP files that the customer's own licensed CVSM / InnoDraw / Raumplan can open.
**Mode:** read-only analysis — no code changed. This is a plan.

> ⚖️ **Not legal advice.** Items tagged **[LAWYER]** need an IP attorney before commercial shipping.
> The goal here is engineering + business clarity so the lawyer question is small and precise.

---

## 0. Bottom line (read this first)

**Format interoperability is lawful and is not the problem.** Writing files that InnoDraw/Raumplan can
open — the ORDX XML and the PDP byte layout — is Soline's own code and stays.

**The real exposure is one thing: the PDP pipeline ships InnoDraw/Raumplan's *own files* inside a
commercial product and hands them back, nearly byte-for-byte, as the export.** Specifically:

- `converter/templates/dr/base/*.pdp` (13 real Raumplan/InnoDraw `.pdp` base files) are **bundled** in
  the product and kept **byte-for-byte intact** in the output — header, 3D furniture meshes, 2D symbol
  vector artwork, assembly, glyph tail (see `src/writePdpDR.js` lines 5–60). The exported PDP *is* the
  vendor's file with the walls and a few item fields edited in place.
- `converter/templates/dr/items/*.bin` (35 records) are **element-definition bytes extracted from the
  InnoDraw install** (`El_Cad--1`) and the owner's InnoDraw exports; they ship and are read at runtime
  (`src/writePdpDR.js:354`) to stamp Raumplan's symbol-selection `{code+property-block}` units.

Everything else Soline ships (ORDX exporter, `elements.json`/`symbols.json`, the DXF path, the re-drawn
symbol set) is **original or lawfully-derived facts** and is fine.

**What must change before commercial shipping:** stop bundling and redistributing the vendor `.pdp`
bases and the extracted `.bin` records. Move to a **customer-supplied-base** model — at convert time the
PDP is built against *the customer's own licensed InnoDraw base* (which they provide or point to), so
Soline never redistributes InnoDraw's files. The existing minimal-in-place-edit engine already harvests
symbol codes from whatever base it loads, so this is a **packaging/wiring change, not a rewrite**.

The prior `docs/IP_COMPLIANCE_REPORT.md` verdict ("product embeds no third-party geometry") is correct
**for the DXF path** — it checked exported DXFs. It does **not** cover the DR-PDP path, where the vendor
file is the deliverable. This document is the missing piece.

---

## 1. Origin inventory — what ships, and whose is it

| # | Asset (path) | Count / size | Origin | Ships in product? | Kept in output? | Risk |
|---|---|---|---|---|---|---|
| 1 | `converter/templates/dr/base/*.pdp` | 13 files, 3 KB–155 KB | **Vendor format, mixed content.** Real Raumplan/InnoDraw `.pdp` files: owner-drawn walls/layout in his *own* licensed Raumplan, but embedding **Raumplan's element symbol artwork** (2D vector paths + 3D `ZYLINDER`/`QUADER` meshes, re-emitted per instance — `docs/native_item_add.md`) and the vendor's file/assembly structure. `wall4_oc40.pdp` = the owner's calibration export `elemets_Bar_Terra-Nova_Yosi_DR1.pdp`. | **YES** (`BASE_DIR`, `src/writePdpDR.js:231`) | **YES — byte-for-byte** except wall table + a few item fields | **HIGH — primary exposure** |
| 2 | `converter/templates/dr/items/*.bin` | 35 files, ~173 B each | **Vendor data.** Per-type `{symbol-code + 9-byte property block}` units **extracted from the InnoDraw install `C:\Program Files (x86)\InnoDraw\El_Cad--1`** and the owner's DR export "Rosetta" file (`docs/ELEMENT_LIBRARY_MASTER.md:194`, `docs/PDP_ANCHOR_TABLE.md:111`). | **YES** (read at runtime, `src/writePdpDR.js:354`, `pairedSwap`) | Copied into output records | **MEDIUM–HIGH** |
| 3 | `converter/templates/dr/wall*.pdp`, `converter/templates/native/*.pdp` | ~7 files | Same as #1 — older/native vendor `.pdp` bases (legacy fallback `src/writePdpDR.js:246`; native-injection family). | **YES** | YES (native path) | **HIGH** (same class as #1) |
| 4 | `converter/elements.json`, `symbols.json` | 128 KB / 167 KB | **Ours (derived facts).** Soline's own catalog: Hebrew/English names, mm dimensions, mount heights, prose 2D-symbol *descriptions*, IEC/plumbing notes. `in_ordx_corpus` flags which types were *seen* in the ORDX corpus (a fact), but the fields are Soline-authored. No vendor geometry/bytes. | YES | n/a (own data) | **LOW / none** |
| 5 | ORDX format + exporter (`src/export_ordx.js`, `parseOrdx.js`) | code | **Ours.** ORDX is order **XML**; Soline **generates** well-formed ORDX from its own object model (round-trip proven). Schema *knowledge* was learned by studying the owner's **own** multi-format exports (`…\קבצים ללמידת מכונה\…`, DR1 sets), not vendor docs. **No vendor ORDX template is bundled** — output is synthesized. | YES (code) | Generated, not copied | **LOW** (schema-knowledge only → [LAWYER] on RE clause) |
| 6 | `elements_raumplan.json`, `symbols_raumplan.json` | 161 KB / 50 KB | Ours — Soline catalog keyed to Raumplan library *names* (names/identifiers are facts, not artwork). | YES | n/a | **LOW** |
| 7 | Analysis/corpus artifacts: `converter/analysis/out/**`, `converter/out/**` (~190 `.pdp`, many `.ordx`/`.ord` incl. `mimran-*`, `*_DR1`) | large | **Vendor-origin corpus + our outputs**, mixed. The owner's real InnoDraw exports used as decode ground-truth. **Not part of the shipped app**, but present in the tree. | Not shipped (dev artifacts) | — | **MEDIUM if repo/build is published** |
| 8 | `ops/docs/cvsm_reference/**` (CVSM guide HTML, `app.js`) | ~180 KB | Reference material learned from CVSM; folder is *named* like CVSM's report but headers show it's Soline's own template (per `IP_COMPLIANCE_REPORT.md`). | Not shipped | — | **LOW–MEDIUM** (housekeeping + naming) |
| 9 | `converter/templates/ctb/*` (SOLINE.ctb) | small | **Ours** — Soline's own plot-style tables. | YES | n/a | **LOW / none** |

**Not found in the repo** (good): no committed `.elc`/`.bcd`/`CVTemplate` **install** container as a
*shipped* asset (the `.elc` is referenced as opaque ground-truth only), no bundled vendor ORDX template,
no `cvsm_*` install extract wired into the shipped product.

---

## 2. Per-asset remediation

For each flagged asset, the three options from the mandate:
**(a)** don't ship it — build against the **customer's own** licensed InnoDraw base;
**(b)** build an **original** base/element set from scratch;
**(c)** ship only our **own derived** data.

### Asset #1 — `templates/dr/base/*.pdp` (PRIMARY exposure)

The output PDP currently *is* a bundled vendor file. Whole-record synthesis fails to load (error
`E4214`); only a **known-loadable real base kept byte-for-byte** works (`src/writePdpDR.js:5–50`). So the
pipeline's correctness today *depends on* redistributing a real base. Options:

- **(a) Customer-supplied base — RECOMMENDED.** Do not bundle any `.pdp`. At convert time the customer
  provides (or points the converter at) a base from **their own** licensed InnoDraw/Raumplan — either an
  empty room they draw once, or a file exported from their `El_Cad--1` install. The engine keeps that
  base byte-for-byte and does the same in-place edits. **Pipeline impact: minimal.** `loadBase()` already
  reads whatever `.pdp` is in `BASE_DIR` and *harvests the symbol codes present in that base at load
  time* (lines 29–32, 250+). Point `BASE_DIR` at a customer path (config/env/first-run import) instead of
  the bundled folder. Cost: base-selection logic (wall-count / slot-count fit) must degrade gracefully to
  a single customer base (pad walls / log overflow — already supported). **Removes the redistribution
  entirely** because each customer's export is built from *their own* licensed file.
- **(b) Original base from scratch — R&D track, do not gate shipping on it.** `src/injectSupp.js` already
  proves a **byte-exact** from-scratch injection of **one socket** into an empty native base
  (`P0→P1` reproduced byte-for-byte; `docs/native_injection_recipe.md`). But generalizing to all ~32
  element types + arbitrary walls + the assembly/glyph structures Raumplan validates is **unsolved and
  high-effort** (each item = ~14 KB of 2D+3D geometry Raumplan re-emits per instance). Feasible long-term;
  not a near-term shipping gate. This is the only path that would eventually let Soline ship a
  self-contained generator with **zero** InnoDraw dependency.
- **(c) N/A for a `.pdp` base** — a base is inherently vendor-structured; "our own derived data" cannot
  replace it without solving (b).

**Recommendation: (a) now, (b) as R&D.** Ship no bundled `.pdp`; generate against the customer's own base.

### Asset #2 — `templates/dr/items/*.bin` (extracted El_Cad records)

- **(a) Harvest from the customer's base at runtime — RECOMMENDED.** The `{code+property-block}` units are
  **type-canonical and identical across all files** (`src/writePdpDR.js:80–86`). So instead of shipping
  `.bin` files extracted from InnoDraw, **read those units out of the customer's own loaded base** (the
  code already harvests in-base codes; extend it to capture the full 11-byte unit per type present in the
  base). No extracted vendor file ships. Types absent from the customer's base fall back to the base's own
  proven codes (the existing clamp behavior).
- **(b) Original `.bin` set** — not meaningful; these are vendor selectors, not artwork you can redraw.
- **(c) Ship only the `GT_CODES` *table*?** The hardcoded `GT_CODES` map in `writePdpDR.js` (lines
  110+) is the same extracted vendor data expressed as source. Whether a short **interface fact table**
  (type → small numeric code) is protectable is a **[LAWYER]** question, but it is far lower-risk than
  shipping the extracted `.bin` binaries. Prefer runtime-harvest (a); keep `GT_CODES` only as a
  validation/self-test aid, not as the shipped source of bytes.

**Recommendation: (a).** Stop shipping `.bin`; harvest the units from the customer's own base.

### Asset #3 — `templates/dr/wall*.pdp`, `templates/native/*.pdp`

Same class as #1. **Remediation (a): remove from the bundle**; the native-injection path (#1b) is the
long-term replacement. Delete the legacy fallback that loads bundled `templates/dr/wall<N>.pdp`.

### Asset #4/#6 — `elements.json` / `symbols.json` (+ `_raumplan`)

**Keep as-is (option c already satisfied).** These are Soline-authored facts and prose. One hygiene note:
keep any `raumplan`-keyed library *names* as factual identifiers only (they are), never paste vendor
symbol artwork or byte blocks into these JSONs.

### Asset #5 — ORDX exporter

**Keep as-is.** Output is synthesized XML from Soline's object model; no vendor template ships. The only
residual is that the *schema* was learned by studying InnoDraw's format → **[LAWYER]** EULA reverse-
engineering clause (see §4). Keep "CVSM"/"InnoDraw"/"Raumplan" out of user-facing product strings.

### Asset #7/#8 — dev corpus + cvsm_reference

Not shipped, but **exclude from any public repo or distributed build**: `converter/analysis/out/**`,
`converter/out/**` (owner's real `mimran-*`/`*_DR1` vendor exports), `ops/docs/cvsm_reference/**`, and
the external `…\קבצים ללמידת מכונה\…` corpus. Add a build/publish exclusion. Rename the misleading
`cvsm_reference/cvsm_html_export/` folder (it holds Soline's own template).

---

## 3. What must change before commercial shipping — vs. what's fine as-is

### MUST change before shipping commercially
1. **Remove all bundled vendor `.pdp` bases** from the product: `templates/dr/base/*.pdp`,
   `templates/dr/wall*.pdp`, `templates/native/*.pdp`. Re-wire `BASE_DIR` to a **customer-supplied** base
   (config / first-run import / point at their `El_Cad--1` install).
2. **Remove the extracted `templates/dr/items/*.bin`**; harvest the type-canonical `{code+block}` units
   from the customer's own loaded base at runtime.
3. **Exclude vendor-origin corpus and reference material from any published repo / shipped build**
   (Asset #7/#8 list).
4. **[LAWYER]** Confirm the InnoDraw/CVSM/Raumplan **EULA reverse-engineering** position (see §4) and that
   the customer-supplied-base model cures the redistribution question.

### Fine as-is (no change needed to ship)
- **ORDX generation** — Soline's own code, synthesized output, no bundled vendor template.
- **PDP *format* knowledge and the in-place-edit engine** — writing a compatible byte layout is lawful
  interoperability; the engine itself is Soline's code.
- **`elements.json` / `symbols.json` / `_raumplan` catalogs** — Soline-authored facts and prose.
- **The DXF path and the re-drawn IEC/plumbing symbol set** — original geometry (already audited clean in
  `docs/IP_COMPLIANCE_REPORT.md`).
- **`SOLINE.ctb`** and other Soline-original assets.

---

## 4. Legal framing (for the lawyer)

Three distinct legal buckets — keep them separate:

1. **Interoperability / compatible file formats — LAWFUL, not a concern.** Producing a file that another
   vendor's program can read (ORDX XML, the PDP byte layout) is classic interoperability. File *formats*
   and functional *methods* are not copyrightable; Soline's exporter is its own expression.

2. **Redistributing the vendor's *own files/content* inside a commercial product — THE WATCH ITEM.** The
   PDP pipeline bundles real Raumplan/InnoDraw `.pdp` files and hands them back nearly byte-for-byte,
   including **Raumplan's embedded symbol artwork** (2D vector + 3D meshes) and file/assembly structure,
   plus **element-definition bytes extracted from the InnoDraw install** (`El_Cad--1`). Even though the
   *walls* were drawn by the owner in his own licensed seat, the file also carries vendor-authored
   expression. Shipping that inside a *different* commercial product sold to third parties is redistribution
   — a separate question from interoperability. **[LAWYER]:** (a) does the owner's InnoDraw/Raumplan EULA
   permit redistributing files generated by the software when they embed the vendor's symbol artwork and
   template structure? (b) Does moving to a **customer-supplied base** (each customer uses their *own*
   licensed file) cure it? (The plan assumes yes — confirm.)

3. **Reverse-engineering under EULA — the other watch item.** The format was decoded by studying the
   owner's own InnoDraw exports and reading the `El_Cad--1` install; CVSM/RoomMeasure features were
   studied from `com.roommeasure.app`. Feature-cloning and studying your own files is generally lawful,
   but **many EULAs contractually prohibit reverse-engineering**. **[LAWYER]:** review the
   InnoDraw/CVSM/Raumplan EULA reverse-engineering clause. Independent of the outcome, keep vendor names
   ("CVSM", "InnoDraw", "Raumplan", "RoomMeasure") **out of user-facing product strings** (they currently
   appear only in source comments / internal docs — keep it that way).

Already-flagged, unchanged from `IP_COMPLIANCE_REPORT.md`: location-consent wording and the OFF-by-default
IP telemetry beacon (privacy-law **[LAWYER]**) — not part of this interop analysis but still open.

---

## 5. Recommendation summary

| Asset | Verdict | Action | Pipeline impact |
|---|---|---|---|
| `dr/base/*.pdp` | **Must not ship** | (a) customer-supplied base; (b) from-scratch generator as R&D | Low — `loadBase`/harvest already base-agnostic |
| `dr/items/*.bin` | **Must not ship** | (a) harvest `{code+block}` from customer base at runtime | Low — codes already harvested at load |
| `dr/wall*.pdp`, `native/*.pdp` | **Must not ship** | Remove; native-injection R&D replaces later | Low (legacy/experimental) |
| `elements.json` / `symbols.json` (+`_raumplan`) | **Fine** | Keep; no vendor bytes | None |
| ORDX exporter / format | **Fine** | Keep; interoperability is lawful | None |
| `SOLINE.ctb`, DXF path, symbol redraw | **Fine** | Keep (already audited clean) | None |
| corpus + `cvsm_reference` | **Don't publish** | Exclude from repo/build; rename misleading folder | None (dev-only) |
| EULA reverse-engineering | **[LAWYER]** | Confirm RE clause; keep vendor names out of UI | None |

**The single decisive change:** convert the PDP path from *bundled vendor bases* to a *customer-supplied
base* model. It removes the redistribution exposure, keeps the working pipeline (the engine is already
base-agnostic and harvests codes from whatever base it loads), and leaves the lawful interoperability
(ORDX/PDP format generation) exactly as it is. The from-scratch native generator (`injectSupp.js`, proven
byte-exact for one socket) is the eventual way to drop the InnoDraw dependency entirely — pursue it as R&D,
but do not gate commercial shipping on it.
