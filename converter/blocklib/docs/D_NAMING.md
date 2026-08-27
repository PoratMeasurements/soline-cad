# D — Naming Standard

> One deterministic naming scheme for object keys, DXF block names, files, previews, and handles.
> Names are **original to Soline** (principle 1 forbids copying names from commercial libraries) and
> **stable** (block names are referenced by the converter and the app — never rename in place).

Date: 2026-08-22.

---

## 1. Object key (the master identifier)

```
<FAMILY>-<SUBTYPE><N?>-<SIZE?>[-<HAND?>]
```

- `FAMILY` — top-level family code from `B_TAXONOMY` (`KIT-BASE`, `APP`, `SNK`, `OUT`, `ROOM`…).
- `SUBTYPE` — 2–3 letter subfamily discriminator (`DR`=door, `DW`=drawer, `SK`=sink, `LD`=larder…),
  aligned to the subfamily codes in `B_TAXONOMY`.
- `N` — optional count qualifier (door/drawer count): `DR2` = 2-door, `DW3` = 3-drawer.
- `SIZE` — nominal width in mm, **4 digits zero-padded**: `0600`, `0900`, `1000`. For height-driven
  families (wall units) use the height; for appliances use the standard nominal (e.g. `0600`).
- `HAND` — optional handedness: `L`, `R` (omitted for symmetric objects; `split` for a 2-door pair is
  implied by `DR2` and needs no HAND).

**Examples**
| Key | Meaning |
|---|---|
| `KIT-BASE-DR2-0600` | base, 2-door, 600 |
| `KIT-BASE-DR1-0300-L` | base, 1-door, 300, left hinge |
| `KIT-BASE-DW3-0600` | base, 3-drawer, 600 |
| `KIT-WALL-DR2-0800` | wall, 2-door, 800 |
| `KIT-CORN-BS-0900` | base corner, 900 |
| `APP-COOK-HOB-0600` | hob, 600 |
| `SNK-BWL-1-0600` | single-bowl sink, 600 |
| `OUT-COOK-BBQ-0900` | built-in gas BBQ, 900 |

Regex (enforced by schema): `^[A-Z]{3,4}(-[A-Z0-9]{2,4})+$`.

## 2. DXF block name

The block name **equals the object key**, prefixed with the library namespace to avoid collision with
converter blocks and any imported content:

```
SL_<KEY-with-underscores>
e.g.  SL_KIT_BASE_DR2_0600
```

- Prefix `SL_` = Soline Library. `-` → `_` (DXF block names avoid `-` for tool-compat).
- Uppercase, ASCII only. No spaces. ≤ 31 chars where practical (older-tool safe; longer allowed on
  AC1015). The prefix guarantees no clash with the converter's `*Model_Space`/anonymous blocks or the
  MEP glyphs.
- **Handles** are derived deterministically from the key hash (see `A_ARCHITECTURE §7`), so a
  regenerated block keeps stable handles in version control.

## 3. File names

| Artefact | Pattern | Example |
|---|---|---|
| Object instance | `objects/<family-dir>/<key-lower>.object.json` | `objects/kitchen-base/kit-base-dr2-0600.object.json` |
| Single-block DXF | `blocks/<KEY>.dxf` | `blocks/KIT-BASE-DR2-0600.dxf` |
| Merged library | `blocks/library.dxf` | one file, all blocks as definitions |
| Preview SVG | `previews/<KEY>.<view>.svg` | `previews/KIT-BASE-DR2-0600.plan.svg` |
| QA report | `docs/qa/CYCLE_<n>_QA.md` | `docs/qa/CYCLE_01_QA.md` |
| Contact sheet | `docs/qa/CYCLE_<n>_CONTACT.html` | `docs/qa/CYCLE_01_CONTACT.html` |

`<family-dir>` is the lowercased family code with `-` kept (`kitchen-base` = friendly alias for
`KIT-BASE`; alias table lives in `library.index.json`).

## 4. Attribute tags

Uppercase, `^[A-Z][A-Z0-9_]*$`: `UNIT`, `WIDTH`, `HEIGHT`, `DEPTH`, `TYPE`, `HINGE`, `MFR`, `MODEL`,
`NOTE`. Reserved tags are listed in `G_ATTRIBUTES §Reserved`.

## 5. Layer names

Layers are **not** invented here — they are the registered SOL-* names from `E_LAYERS` (which extends
`DXF_PRO_STANDARDS §1`). New object sub-layers follow `SOL-RIHUT-<ROLE>` (`-DOOR`, `-HW`, `-HID`).

## 6. Versioning of a name

- A geometry fix that keeps the same object identity → **same key**, bump `metadata` note; blocks
  regenerate under the same name.
- A change that alters what the object *is* (different subtype/size) → **new key**; the old key is
  retired in `library.index.json` (`status: "retired"`), never silently repurposed.
- `schemaVersion` on the object is independent of the key (it tracks the schema, not the object).
