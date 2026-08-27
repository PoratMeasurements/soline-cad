# E — Layers Standard

> Aligned to the existing SOL-* taxonomy. **Dependency note:** there is **no `docs/LAYERS.md`** in the
> repo (searched 2026-08-22; absent). The authoritative SOL-* layer table lives in
> **`converter/docs/DXF_PRO_STANDARDS.md §1`** (13 layers, each anchored to AIA/NCS, with ISO-128
> lineweight and ACI colour). This standard **treats that table as the source of truth** and adds a
> small set of object sub-layers for cabinet internals — a pure extension, not a redesign. If a
> canonical `LAYERS.md` is later created, this file becomes a rename table against it.

Date: 2026-08-22 · Units: mm · ISO-128 lineweights.

---

## 1. Existing SOL-* layers the library uses AS-IS

From `DXF_PRO_STANDARDS.md §1` (unchanged):

| SOL layer | Role in the block library | AIA anchor | ISO-128 wt | ACI |
|---|---|---|---|---|
| `SOL-RIHUT` | **primary** cabinet/appliance/furniture footprint & carcass outline | `A-FURN` | 0.25 mm | 42 |
| `SOL-INSTALATSIA` | sink bowl waste/overflow, tap body when drawn as plumbing | `P-SANR` | 0.25 mm | 4 (cyan) |
| `SOL-GAZ` | outdoor-BBQ / hob gas connection indication | `M-GAS` | 0.25 mm | 2 (yellow) |
| `SOL-MIZUG` | hood/extract duct indication on a block | `M-HVAC` | 0.25 mm | 141 |
| `SOL-TEKST` | block-internal tags, unit numbers, notes (ATTRIB text) | `A-ANNO-TEXT` | 0.18 mm | 7 |
| `SOL-KIROT` / `SOL-KIROT-MILUY` | (host only — the library never draws walls; ROOM wall blocks reference these) | `A-WALL` | 0.50 / 0.13 | 7 / 8 |

**Rule:** MEP *symbols* stay on their discipline layers via `element_symbols_soline.js`; the library
only draws the *object*. A base cabinet's carcass is `SOL-RIHUT`; the socket above it is
`SOL-CHASHMAL` and comes from the symbol module, not from the block.

## 2. NEW object sub-layers (provisional extension of `SOL-RIHUT`)

A professional furniture block separates carcass from door-swing from hardware so a reader (and a plot
style) can weight them correctly. We add three sub-layers, all anchored to the same AIA `A-FURN` group
and the existing lineweight tiers, so they inherit the converter's plot behaviour:

| New layer | Role | AIA anchor | ISO-128 wt | ACI | Rationale |
|---|---|---|---|---|---|
| `SOL-RIHUT-DOOR` | door/drawer face lines + door-swing arcs | `A-FURN-DOOR` | 0.25 mm | 42 | separable so swings can be hidden for a clean footprint plan |
| `SOL-RIHUT-HW` | handles, hinges, mechanism envelope (Blum-class) | `A-FURN-PATT` | 0.18 mm | 8 (grey) | lightest — hardware is detail, never competes with carcass |
| `SOL-RIHUT-HID` | hidden/dashed edges (worktop overhang, toe-kick, concealed carcass) | `A-FURN` (hidden) | 0.13 mm | 8 (grey) | dashed linetype `HIDDEN`; thin |

**Why sub-layers of `SOL-RIHUT` and not new top-level layers:** the whole furniture set stays
freezable/recolourable in one action (`SOL-RIHUT*`), matching the converter's "hide all annotation in
one action" principle (`DXF_PRO_STANDARDS §1`). It is additive: existing SOL-* consumers ignore the
new sub-layers; the library's DXF writer registers them in the same `layerTable()`.

## 3. Lineweight & colour discipline (inherited, not reinvented)

The library obeys the converter's ISO-128 hierarchy exactly (`DXF_PRO_STANDARDS §2`):

```
0.25 mm  SOL-RIHUT, SOL-RIHUT-DOOR      (object / face — the cabinet reads as an object, medium)
0.18 mm  SOL-RIHUT-HW, SOL-TEKST         (hardware detail, tags)
0.13 mm  SOL-RIHUT-HID                    (hidden edges, dashed)
```

Walls, when a ROOM block references them, stay heaviest (`SOL-KIROT` 0.50) so a placed cabinet never
out-weights the wall it sits against. Colour encodes pen per the converter's CTB convention; the
library adopts the same ACI→pen map so a block plots identically inside a converter sheet.

## 4. Linetypes

- `CONTINUOUS` — all solid outlines.
- `HIDDEN` — dashed edges on `SOL-RIHUT-HID` (worktop overhang, toe-kick, hidden carcass). The library
  ships the same `HIDDEN` linetype definition the converter template uses (no new LTYPE dialect).

## 5. Layer routing in the schema

Each object's `layers{}` maps geometry roles → these layer names, and any primitive may override with
its own `layer`. The emitter validates every layer string against **this registry** (the §1 + §2
tables) and **fails closed** on an unregistered layer (QA check `layer-registry`, `I_QA_STANDARD`).

## 6. Dependency / follow-up

- If the owner establishes a canonical `docs/LAYERS.md`, reconcile: the §1 rows map 1:1; the §2 rows
  are the only additions and should be adopted there (or mapped to whatever `A-FURN` sub-naming that
  file prefers). This file then reduces to a rename table.
- The three new sub-layers are marked **provisional** until that reconciliation or owner sign-off.
