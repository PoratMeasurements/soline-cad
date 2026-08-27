# C — Object JSON Schema (authoritative) + worked example

> The authoritative machine-readable schema is **`C_OBJECT_SCHEMA.json`** (JSON Schema draft 2020-12).
> A copy is installed at `blocklib/schema/object.schema.json` and loaded by the validator (step 1 of
> the pipeline). This doc explains the schema and walks a concrete instance. **Principle 5: nothing is
> generated to DXF until its JSON validates here.**

Date: 2026-08-22 · Units: mm.

---

## 1. Why schema-first

The converter already proved this pattern with openings: `docs/OPENING_ELEMENT_SCHEMA.md` +
`src/opening_schema.js` define a door/window as a parametric object (geom/config/pos) that every
exporter renders consistently. The block library generalises the same idea to **all furniture,
appliances, sinks and outdoor-kitchen objects**: one JSON contract, many renderers (DXF, SVG preview,
index/BOM). The JSON is the single source of truth; blocks are derived and disposable.

## 2. Top-level fields (summary)

| Field | Purpose |
|---|---|
| `schemaVersion` | pinned `"1.0.0"`; bump only on a breaking schema change |
| `key` | globally-unique object key, uppercase (`D_NAMING`), e.g. `KIT-BASE-DR2-0600` |
| `family` / `subfamily` / `domain` | taxonomy node (`B_TAXONOMY`) + build-subset tag |
| `hebrewName` / `englishName` | human-facing labels (legend, BOM, app picker) |
| `params` | **the parametric inputs** — typed, ranged, enumerated; the resolver reads only these + `dims` |
| `dims` | real bounding envelope W×D×H (mm) + toe-kick / worktop / clearances |
| `variants` | discrete pre-approved instances (e.g. the width family); **N variants = N blocks** (feeds the ≤10 gate) |
| `views` | which of plan/front/side/section are provided, and how each is built |
| `insertion` | base-point + rotation rule per view (`F_INSERTION_POINTS`) |
| `layers` | geometry-role → SOL-* layer routing (`E_LAYERS`) |
| `attributes` | block ATTRIB/ATTDEF definitions (`G_ATTRIBUTES`) |
| `metadata` | provenance (`sources[]`), originality attestation, MEP companions, dates |

## 3. `params` — the parametric core

Each param is `{ type, value, unit?, min?, max?, step?, options?, description? }`. The resolver treats
params as the **only** knobs; there are no magic numbers in the generator. Examples from the base
cabinet: `doorCount` (integer 1–2), `handleType` (enum bar/knob/grip-rail/handleless), `carcassThk`
(number 16–19 mm). Validation enforces ranges/enums **before** anything is drawn, so an impossible
cabinet (e.g. 3 doors on 300 mm) is rejected at the gate, not discovered in the DXF.

## 4. `dims` and `variants` — how a width family works

A base cabinet is authored **once**; the five prototype widths are `variants` with a single
`overrides.dims.w`. The resolver expands each variant into its own block
(`KIT-BASE-DR2-0300`, `…-0450`, `…-0600`, `…-0800`, `…-0900`). This is why the prototype cycle is
**exactly 5 blocks** — well inside the ≤10 gate — from **one** object file. Handedness (L/R) is also a
variant (`suffix: "L"/"R"`), never a duplicated file.

## 5. `views` — declarative build → primitives

A view carries a **`build`** recipe (family-specific, resolver-interpreted) and/or an explicit
**`primitives`** array in mm. Authoring typically writes the `build` intent; the resolver expands it
to `primitives`, which is what the DXF and SVG backends consume and what QA checks (closure, layer,
bbox). The primitive vocabulary — `line, rect, circle, ellipse, arc, poly, label, hatch` — is the
**real-mm superset** of the symbol module's primitives, so the two libraries share one drawing
language (`A_ARCHITECTURE §4`). Every primitive may name its own `layer`; otherwise it inherits the
role default from `layers`.

## 6. Worked example — `examples/base_cabinet_600.object.json`

The example is a **2-door 600 mm base cabinet** with the 300/450/600/800/900 width family as variants.
Highlights:

- **Plan view** = carcass footprint `600×560` on `SOL-RIHUT`, a dashed worktop overhang on
  `SOL-RIHUT-HID`, and two door-swing quarter-arcs on `SOL-RIHUT-DOOR` (arc radius = leaf width, the
  same convention the converter uses for door leaves in `element_symbols_soline.js`).
- **Front view** = carcass over a dashed toe-kick, two door panels with a reveal gap, bar handles on
  `SOL-RIHUT-HW`.
- **Side view** = depth×height carcass + worktop cap + toe-kick recess.
- **insertion.basePoint.anchor = `back-left`** — the cabinet inserts by its rear-left corner, so a run
  of cabinets tiles along a wall by advancing X by each width (`F_INSERTION_POINTS`).
- **attributes** = a visible `UNIT` tag (drawn on plan, 125 mm text = 2.5 mm paper at 1:50) plus
  hidden `WIDTH`/`TYPE`/`HINGE` schedule fields (`G_ATTRIBUTES`).
- **metadata.sources** = standard module dimensions (fact), Blum envelope charts (numbers only, drawn
  from scratch), and a CC0 proportion sanity-check — all GREEN per `LICENSES.md`;
  `originalGeometry: true` attests the linework is ours.

> The `primitives` shown in the example are **illustrative** — they demonstrate the shape of resolver
> output so the schema reads concretely. In Stage 2 the resolver *generates* them from `build` +
> `params`, and QA verifies they match. No block has been generated from this file (Stage 1 gate).

## 7. Validation rules the schema enforces (fail-closed)

- `key` matches the naming pattern; `additionalProperties:false` everywhere (no stray fields).
- `dims.w/d/h > 0`; params respect `min/max/enum`.
- `metadata.originalGeometry` **must** be `true`; `sources[]` present (QA cross-checks each against
  `LICENSES.md` and fails on unregistered/AMBER-unpromoted/RED).
- at least one view; layer values validated against the SOL-* registry (`E_LAYERS`) at emit time.
