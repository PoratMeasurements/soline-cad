# A — Library Architecture & Pipeline

> How the parametric block library is built, validated, rendered, QA'd, and how it plugs into the
> existing Soline converter — coexisting with the MEP symbol set (`src/element_symbols_soline.js`)
> and the SOL-* layer system.

Date: 2026-08-22 · Units: mm · Backend: Node (see §6).

---

## 1. The pipeline (schema-first, principle 5)

```
                       blocklib/
  ┌──────────────┐     objects/*.object.json        ┌───────────────────┐
  │  FAMILY SPEC │───▶ (authored, one file/object)──▶│  1. VALIDATE       │
  │ (params +    │                                   │  ajv vs C_SCHEMA   │
  │  sources)    │                                   │  + provenance vs   │
  └──────────────┘                                   │    LICENSES.md     │
                                                     └─────────┬─────────┘
                                                               │ valid instance
                                                               ▼
                                            ┌─────────────────────────────────┐
                                            │ 2. RESOLVE (parametric build)   │
                                            │  params → derived geometry model │
                                            │  (pure data: views→primitives)  │
                                            └──────────────┬──────────────────┘
                                                           │ geometry model (backend-agnostic)
                              ┌────────────────────────────┼────────────────────────────┐
                              ▼                            ▼                             ▼
                 ┌───────────────────────┐   ┌───────────────────────┐    ┌───────────────────────┐
                 │ 3a. DXF EMIT (Node)   │   │ 3b. PREVIEW EMIT (SVG) │    │ 3c. INDEX EMIT (JSON) │
                 │  BLOCK/INSERT via     │   │  one SVG per view,     │    │  library manifest +   │
                 │  dxf_soline writer    │   │  same geometry model   │    │  BOM/attribute map    │
                 └───────────┬───────────┘   └───────────┬───────────┘    └───────────────────────┘
                             │ blocks/*.dxf              │ previews/*.svg
                             ▼                           ▼
                 ┌─────────────────────────────────────────────────────────┐
                 │ 4. QA  (geometry/scale/layer/naming/closure/provenance)  │
                 │    → docs QA report (per cycle)                          │
                 └──────────────────────────┬──────────────────────────────┘
                                            ▼
                 ┌─────────────────────────────────────────────────────────┐
                 │ 5. CONTACT SHEET (all previews in this cycle, 1 HTML)    │  ── GATE ──▶ owner approval
                 └─────────────────────────────────────────────────────────┘
```

**Key property:** step 2 produces a **backend-agnostic geometry model** (an array of typed
primitives per view, in mm). Steps 3a/3b/3c are pure consumers. The DXF emitter and the SVG preview
emitter therefore render **the same geometry** — the preview cannot lie about the block (this is the
same discipline the converter already uses: legend swatches drawn from the exact `GLYPHS` used on the
plan; see `docs/DXF_PRO_STANDARDS.md §6`).

### Stages, as separable programs (all Stage-2+, not built yet)
| Stage | Input | Output | Fails closed on |
|---|---|---|---|
| validate | `*.object.json` | ok / error list | schema violation, unregistered source |
| resolve | valid instance | `{ views: { plan:[prim…], front:[…], side:[…], section?:[…] }, bbox, ins }` | param out of range, non-closed outline |
| dxf-emit | geometry model | `blocks/<name>.dxf` | layer not in registry, handle collision |
| preview-emit | geometry model | `previews/<name>.<view>.svg` | — |
| qa | blocks + previews + models | `docs/qa/CYCLE_<n>_QA.md` | any check in `I_QA_STANDARD` |
| contact | previews | `docs/qa/CYCLE_<n>_CONTACT.html` | >10 blocks in cycle |

---

## 2. Directory layout (created in Stage 2, listed here for the contract)

```
converter/blocklib/
├── docs/                     ← Stage 1 (this): all standards A–J + LICENSES
├── schema/
│   └── object.schema.json    ← copy of C (the authoritative schema the validator loads)
├── objects/                  ← authored JSON instances, one per object  (source of truth)
│   ├── kitchen-base/base_cab_600.object.json
│   └── …
├── lib/                      ← Stage-2 generator code (Node; NOT written yet)
│   ├── validate.js  resolve.js  emit_dxf.js  emit_svg.js  qa.js  contact.js  cli.js
│   └── primitives.js         ← the geometry-model vocabulary (shared with preview)
├── blocks/                   ← generated .dxf  (one file per block; also a merged library.dxf)
├── previews/                 ← generated .svg  (one per view)
└── docs/qa/                  ← generated QA reports + contact sheets, per cycle
```

The **object JSON is the source of truth**; `blocks/` and `previews/` are build artefacts and are
reproducible from `objects/` at any time. This mirrors how the converter treats `elements.json` →
DXF: data in, drawing out.

---

## 3. How it plugs into the Soline converter

The converter today turns a measured `.sol`/ORDX project into 6 output formats
(`src/export_*.js`). The block library adds a **content library** those exporters can *place*:

1. **Placement contract.** When a measured project contains a kitchen/furniture item (an ORDX item,
   or a future app-lane `furniture{}` object), the exporter resolves it to a **library object key**
   (e.g. `KIT-BASE-DR3-0600`) and emits a single `INSERT` of that block at the item's position,
   rotation, and — for parametric widths — the nearest catalog width or a stretched instance.
   This is the exact pattern `opening_schema.js` already established for doors/windows: the app
   measures, a resolver maps to a catalog key + real dimensions, the exporter places geometry.
2. **Two integration points, cleanly separated:**
   - `export_dxf2d.js` / `export_dxf_pro.js` — insert the **2D plan** block on `SOL-RIHUT` (+ the
     block's own sub-layers). The library's DXF files are authored with the converter's own
     `dxf_soline.js` writer, so blocks drop into the converter output with identical layer/lineweight
     tables — **zero impedance mismatch**.
   - `export_dxf3d.js` — future: the same object's `front`/`side`/`section` feed a 3D extrusion.
3. **No fork of the writer.** The generator `require()`s the existing `src/dxf_soline.js` primitives
   (layer table, `blockBegin`/`blockEnd`, handle seed, `g()` group-code helper). One DXF dialect in
   the whole project.
4. **Catalog manifest.** `blocklib` emits a `library.index.json` (object key → block name → views →
   attributes → default dims). The app's item-picker and the converter's placement resolver both read
   this one manifest — single source of truth for "what blocks exist".

---

## 4. Coexistence with the MEP symbol set (`element_symbols_soline.js`)

These are **two complementary layers of a drawing**, and the boundary is deliberate:

| | `element_symbols_soline.js` (exists) | `blocklib` (this project) |
|---|---|---|
| Represents | **Point devices / services** — a socket, a gas point, a light, an AC sleeve | **Real-dimensioned objects** — a cabinet, a sink, an oven, a BBQ |
| Geometry | Schematic **glyph** in a normalized unit box `[0..1]²`, scaled to a small symbol size | **True-scale** linework in mm, at the object's real footprint |
| Role on sheet | Annotation-tier symbol (medium/thin weight), lives at a coordinate | Object-tier furniture (medium weight), occupies real area |
| Layer | discipline layers: `SOL-CHASHMAL`, `SOL-GAZ`, `SOL-TEURA`, `SOL-MIZUG`, `SOL-INSTALATSIA` | `SOL-RIHUT` (+ new object sub-layers, see E) |
| Output | inline primitives via `toDxf2dGlyph()` | standalone **BLOCK** definitions + `INSERT` |
| Source of truth | one JS module | many JSON instances |

**They meet, they don't overlap.** A kitchen plan shows a **base cabinet block** (blocklib, on
`SOL-RIHUT`) with a **socket symbol** (element_symbols, on `SOL-CHASHMAL`) on the wall above it.

**Shared design language (adopted deliberately so the two read as one library):**
- The blocklib geometry-model **primitive vocabulary is a superset of** the symbol module's
  primitives (`line/rect/ellipse/arc/poly/label` — see `primitives.js` in §2). Anyone who has read
  `element_symbols_soline.js` already knows the blocklib primitive set.
- **Difference:** symbol primitives are in normalized `[0..1]` unit-box coordinates; blocklib
  primitives are in **real mm**, origin at the object insertion point (see `F_INSERTION_POINTS.md`).
  The resolver never normalizes — cabinets are drawn at true size.
- Some blocklib appliances have a **matching MEP outlet symbol** already in the symbol module
  (`outlet_oven`, `outlet_fridge`, `water_dishwasher`…). The library object references its companion
  symbol key in `metadata.mepCompanions[]` so a placed appliance can auto-suggest its service point.

---

## 5. How it aligns with the SOL-* layer system

There is **no `docs/LAYERS.md`** in the repo (searched; absent). The **authoritative SOL-* taxonomy
lives in `docs/DXF_PRO_STANDARDS.md §1`** (13 layers, each with role, AIA/NCS anchor, ISO-128
lineweight, ACI colour). `E_LAYERS.md` treats that table as the source of truth, reuses `SOL-RIHUT`
for cabinetry/furniture, and defines a small set of **provisional object sub-layers** for cabinet
internals (carcass vs door-swing vs hardware vs fill) — all anchored to the same AIA `A-FURN` group
and the same lineweight tiers, so they are a pure extension, not a redesign. See `E_LAYERS.md` for
the dependency note and the exact additions.

---

## 6. Backend decision & language-agnostic design

- **Primary backend: Node**, reusing `src/dxf_soline.js` (AC1015, embedded lineweights, BLOCK/INSERT,
  handle seed — all already working and validated with `dxf-parser` per `DXF_PRO_STANDARDS.md §9a`).
  No external DXF dependency; ezdxf/Python is **not present** on this machine (verified 2026-08-22).
- **Language-agnostic contract:** the object JSON + JSON Schema + the geometry-model primitive
  vocabulary are the *only* cross-cutting contract. The emitter is a thin backend. If Python/ezdxf
  becomes available, an `emit_dxf_ezdxf.py` backend can consume the **same** geometry model (it is
  plain JSON) and produce identical blocks — no object file changes. Preview (SVG) and index (JSON)
  backends are already language-neutral.
- **Why not require ezdxf now:** it would add an unavailable dependency and a second, divergent DXF
  dialect. The proven in-repo writer already emits professional AC1015 with the exact SOL-* tables the
  converter uses — reusing it keeps one dialect across the whole product.

---

## 7. Determinism & reproducibility (feeds QA)

- The resolver is a **pure function** `object → geometry model` (no randomness, no time, no floating
  drift beyond a fixed rounding to 0.1 mm). Same input → byte-identical output. QA can therefore
  diff-check regressions.
- Handles/block names are derived deterministically from the object key (see `D_NAMING.md`), so a
  regenerated library is stable in version control.
- Every generated block embeds `metadata` (schema version, object key, source hash) as block XDATA /
  a leading comment, so any `.dxf` in the wild is traceable back to its JSON instance.
