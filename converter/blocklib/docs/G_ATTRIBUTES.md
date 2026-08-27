# G — Attributes Standard (block ATTRIBs / metadata)

> Every library block carries structured data as DXF **ATTDEF/ATTRIB** entities (schedulable in CAD)
> plus non-graphic **XDATA/metadata** (traceability). Attributes are authored in the object's
> `attributes[]` (see `C_OBJECT_SCHEMA`) and become both an ATTDEF in the block and a column in the
> generated BOM/schedule.

Date: 2026-08-22.

---

## 1. Two channels of data on a block

| Channel | DXF vehicle | Visible on plot? | Purpose |
|---|---|---|---|
| **Attributes** | `ATTDEF` (in block) → `ATTRIB` (on insert) | optional per-attribute (`visible`) | user-facing, schedulable fields: unit number, width, type, hinge side, manufacturer |
| **Metadata** | XDATA on the block (app id `SOLINE`) + a leading comment in the DXF | no | traceability: object key, schema version, source hash, `originalGeometry` attestation |

## 2. Reserved attribute tags (standard set)

Every object uses tags from this set where relevant; families add their own but must not redefine a
reserved tag's meaning.

| Tag | Meaning | Type | Typically visible | Default source |
|---|---|---|---|---|
| `UNIT` | unit / item number on the plan (B1, W3…) | string | **yes** (plan) | assigned at placement |
| `WIDTH` | nominal width mm | number | no | `dims.w` |
| `HEIGHT` | nominal height mm | number | no | `dims.h` |
| `DEPTH` | nominal depth mm | number | no | `dims.d` |
| `TYPE` | Hebrew type name | string | no | `hebrewName` |
| `FAMILY` | family code | string | no | `family` |
| `HINGE` | hinge/handle side (L/R/split) | enum | no | param `hingeSide` |
| `HANDLE` | handle style | enum | no | param `handleType` |
| `MFR` | manufacturer (if the measurer records one) | string | no | blank |
| `MODEL` | model / series | string | no | blank |
| `FINISH` | finish / colour note | string | no | blank |
| `NOTE` | free measurer note | string | no | blank |
| `KEY` | object key (audit) | string | no | `key` |

## 3. Attribute definition rules

- **Tag**: uppercase `^[A-Z][A-Z0-9_]*$` (`D_NAMING §4`).
- **Prompt**: Hebrew, human-facing.
- **Default**: sensible default drawn from the schema (`WIDTH` ← `dims.w`, etc.); `UNIT` default `"B?"`
  is a placeholder the placement step overwrites.
- **Visibility**: only `UNIT` is visible by default (it's the on-plan tag). All others are invisible
  schedule fields — this keeps the drawing clean (`DXF_PRO_STANDARDS §4`: never clutter the plan).
- **Placement (`at` + `view` + `height`)**: a visible attribute names the view it shows in and its
  position in that view's mm frame. Text `height` follows the converter's scale rule
  (`modelHeight = paperMM × scaleDenominator`; 2.5 mm paper → 125 mm at 1:50).
- **Layer**: visible attribute text is on `SOL-TEKST` (0.18 mm), never on a geometry layer.

## 4. Metadata / XDATA (non-graphic)

Emitted once per block, app id `SOLINE`:

```
KEY           = KIT-BASE-DR2-0600
SCHEMA        = 1.0.0
FAMILY/SUB    = KIT-BASE / KIT-BASE-DR
DIMS          = 600x560x720
ORIGINAL_GEOM = true
SOURCE_HASH   = <sha of metadata.sources[]>
CREATED       = 2026-08-22
```

This makes any `.dxf` found in the wild traceable back to its JSON instance and its provenance
(`LICENSES.md`). The QA report reads it back to confirm block↔object identity.

## 5. How attributes feed the schedule / BOM

The converter already builds a counted BOM/legend (`מקרא וספירת אלמנטים`, `DXF_PRO_STANDARDS §9a`).
Library blocks slot straight in: on placement the exporter reads each insert's `ATTRIB`s and groups by
`FAMILY` + `TYPE` + `WIDTH`, producing a kitchen schedule (unit no. / type / W×H×D / hinge / count).
Because `UNIT` is the visible tag and the rest are hidden schedule fields, the plan shows tidy unit
numbers while the schedule carries the full spec — the standard cabinet-schedule pattern.

## 6. Consistency with the opening schema

Doors/windows already carry mark + schedule data via `opening_schema.js` (`assignMarks` → D1/W1 rows).
Library attributes use the **same idea** (a visible mark + a hidden spec row) so the kitchen schedule
and the opening schedule read as one family of tables in the deliverable.
