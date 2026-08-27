# B — Full Taxonomy (families / subfamilies)

> The classification tree for every object in the library. Extensible by design: a new subfamily is a
> new row, a new object is a new leaf. Every object's `family` / `subfamily` fields (see
> `C_OBJECT_SCHEMA`) must name a node that exists here. Domains: **room measurement · interior
> kitchens · outdoor kitchens**.

Date: 2026-08-22 · Units: mm. Family codes drive the naming standard (`D_NAMING.md`) and layering (`E_LAYERS.md`).

---

## Top-level families

| Code | Family | Domain | Primary layer |
|---|---|---|---|
| `ROOM` | Room shell & architectural context | measurement | `SOL-KIROT` / `SOL-PTACHIM` (host) |
| `KIT-BASE` | Interior kitchen — base cabinets | interior kitchen | `SOL-RIHUT` |
| `KIT-WALL` | Interior kitchen — wall cabinets | interior kitchen | `SOL-RIHUT` |
| `KIT-TALL` | Interior kitchen — tall/pantry/oven-housing | interior kitchen | `SOL-RIHUT` |
| `KIT-CORN` | Interior kitchen — corner units | interior kitchen | `SOL-RIHUT` |
| `KIT-TOP`  | Worktops, islands, panels, plinth/cornice | interior kitchen | `SOL-RIHUT` |
| `APP` | Appliances (built-in & freestanding) | interior kitchen | `SOL-RIHUT` (+ MEP companion) |
| `SNK` | Sinks, taps, bowls | interior kitchen | `SOL-RIHUT` (+ `SOL-INSTALATSIA`) |
| `OUT` | Outdoor kitchen | outdoor kitchen | `SOL-RIHUT` |
| `FIX` | Fixtures & fittings (non-kitchen room content) | measurement | `SOL-RIHUT` |
| `SYMK` | Kitchen annotation/marks (block-level tags, not MEP) | all | `SOL-TEKST` |

> Note: **MEP service points** (sockets, gas, water, extract) are **not** in this taxonomy — they are
> the domain of `element_symbols_soline.js` (see `A_ARCHITECTURE §4`). The library only references
> them via `metadata.mepCompanions`.

---

## ROOM — room shell & architectural context

| Subfamily | Code | Objects (examples) | Views |
|---|---|---|---|
| Wall segment | `ROOM-WALL` | straight wall run, corner, wall-end cap (parametric length/thickness) | Plan, Section |
| Column / pier | `ROOM-COL` | square column, round column, RC pier | Plan |
| Opening host | `ROOM-OPEN` | *(defers to existing `opening_schema.js` — the library does not duplicate doors/windows; it references them)* | — |
| Floor/level marker | `ROOM-LVL` | step/level change, ramp edge | Plan, Section |
| Ceiling feature | `ROOM-CEIL` | bulkhead/drop-ceiling outline, beam | Plan, Section |
| Room datum | `ROOM-DTM` | room-name tag, area stamp, height stamp | Plan |
| Niche / recess | `ROOM-NICH` | wall niche, ממ"ד marker, shaft/duct riser | Plan |

## KIT-BASE — base cabinets (floor-standing, worktop height)

| Subfamily | Code | Objects | Views |
|---|---|---|---|
| Door base | `KIT-BASE-DR` | 1-door / 2-door base (widths 300–1000) | Plan, Front, Side |
| Drawer base | `KIT-BASE-DW` | 2/3/4-drawer base, pan-drawer base | Plan, Front, Side |
| Sink base | `KIT-BASE-SK` | sink base (open / with false front) | Plan, Front, Side |
| Appliance base | `KIT-BASE-AP` | dishwasher housing, oven-under-counter, hob base, undercounter-fridge housing | Plan, Front, Side |
| Open / shelf base | `KIT-BASE-OP` | open base, wine rack, bottle pull-out | Plan, Front, Side |
| Filler / end panel | `KIT-BASE-FL` | filler strip, base end panel, plinth run | Plan, Front |

## KIT-WALL — wall (upper) cabinets

| Subfamily | Code | Objects | Views |
|---|---|---|---|
| Door wall | `KIT-WALL-DR` | 1/2-door wall unit (heights 360/570/720/900) | Plan, Front, Side |
| Lift/flap wall | `KIT-WALL-LF` | lift-up flap, bi-fold lift (Blum Aventos-class envelope) | Plan, Front, Side |
| Open wall | `KIT-WALL-OP` | open shelf unit, glass display | Plan, Front, Side |
| Extractor housing | `KIT-WALL-EX` | chimney-hood housing, integrated-hood cabinet | Plan, Front, Side |
| Microwave/appliance wall | `KIT-WALL-AP` | microwave wall unit | Plan, Front, Side |
| Wall corner | `KIT-WALL-CN` | *(cross-ref KIT-CORN)* | Plan, Front |

## KIT-TALL — tall / pantry / housing

| Subfamily | Code | Objects | Views |
|---|---|---|---|
| Larder/pantry | `KIT-TALL-LD` | pull-out larder, shelved pantry | Plan, Front, Side |
| Oven tower | `KIT-TALL-OV` | single-oven + microwave tower, double-oven tower | Plan, Front, Side |
| Fridge/freezer housing | `KIT-TALL-FR` | integrated tall fridge, fridge/freezer housing | Plan, Front, Side |
| Broom/utility | `KIT-TALL-UT` | broom cupboard | Plan, Front, Side |

## KIT-CORN — corner units

| Subfamily | Code | Objects | Views |
|---|---|---|---|
| Base corner | `KIT-CORN-BS` | L-corner base, diagonal base, blind corner + carousel/magic-corner envelope | Plan, Front |
| Wall corner | `KIT-CORN-WL` | L-corner wall, diagonal wall | Plan, Front |

## KIT-TOP — worktops, islands, trims

| Subfamily | Code | Objects | Views |
|---|---|---|---|
| Worktop run | `KIT-TOP-WT` | straight worktop, L/U join, waterfall end, upstand | Plan, Section |
| Island / peninsula | `KIT-TOP-IS` | island carcass block, breakfast-bar overhang | Plan, Front, Side |
| Trim | `KIT-TOP-TR` | cornice, pelmet, plinth, end panel, infill | Front, Section |

## APP — appliances (interior kitchen)

| Subfamily | Code | Objects | Views | MEP companion |
|---|---|---|---|---|
| Cooking | `APP-COOK` | hob (gas/induction 600/750/900), oven (600), range cooker (900), microwave | Plan, Front | `outlet_oven`, `outlet_cooktop`, `gas_point` |
| Cold | `APP-COLD` | freestanding fridge/freezer, integrated fridge, wine cooler | Plan, Front, Side | `outlet_fridge`, `water_fridge` |
| Cleaning | `APP-CLEAN` | dishwasher (600/450), washer, dryer | Plan, Front | `outlet_dishwasher`, `water_dishwasher` |
| Extraction | `APP-EXT` | chimney hood, island hood, integrated/telescopic hood | Plan, Front, Side | `range_hood`, `range_hood_duct` |
| Small/built-in | `APP-SML` | built-in coffee, warming drawer, compact oven | Plan, Front | `outlet_microwave` |

## SNK — sinks & taps

| Subfamily | Code | Objects | Views | MEP companion |
|---|---|---|---|---|
| Bowl | `SNK-BWL` | single bowl, 1.5 bowl, double bowl, round bowl, drainer | Plan, Section | `water_cold`, `water_hot`, `sewage_point` |
| Tap | `SNK-TAP` | mono mixer, pull-out spray, boiling-water tap, wall tap | Plan, Front | `water_cold`, `water_hot` |

## OUT — outdoor kitchen

| Subfamily | Code | Objects | Views |
|---|---|---|---|
| Cook | `OUT-COOK` | built-in gas BBQ, kamado/charcoal, side burner, teppanyaki, pizza oven, taboon | Plan, Front, Side |
| Module | `OUT-MOD` | masonry/stone base module, door module, drawer module, corner module | Plan, Front, Side |
| Wet | `OUT-WET` | outdoor sink module, tap, ice bin | Plan, Front |
| Cold | `OUT-COLD` | outdoor fridge, kegerator | Plan, Front, Side |
| Surface | `OUT-SURF` | stone worktop, bar overhang, pergola post footprint | Plan, Section |
| Utility | `OUT-UTL` | gas bottle store (`gas_cylinder` companion), storage, waste module | Plan, Front |

## FIX — fixtures & fittings (room content beyond kitchen)

| Subfamily | Code | Objects | Views |
|---|---|---|---|
| Sanitary | `FIX-SAN` | WC, basin, bath, shower tray *(only if a project needs them; dimension-checked to ת"י/EN)* | Plan, Front |
| Furniture datum | `FIX-FRN` | table, wardrobe footprint, bed footprint (generic context blocks) | Plan |
| Radiator/heat | `FIX-HEAT` | panel radiator footprint *(MEP companion `ufh_manifold`)* | Plan, Front |

## SYMK — kitchen block-level annotation

| Subfamily | Code | Objects | Views |
|---|---|---|---|
| Unit tag | `SYMK-TAG` | cabinet-number tag, width call-out flag, handle-side indicator | Plan |
| Datum | `SYMK-DTM` | worktop-height note, plinth-height note | Front |

---

## Extensibility rules

1. A new **object** = a new `objects/<family>/<key>.object.json` + a QA pass; no taxonomy edit needed
   if its subfamily exists.
2. A new **subfamily** = one new row here (code, layer, view requirement) + `H_VIEW_MATRIX` row.
3. A new **family** = new top-level row + a layer decision in `E_LAYERS` + naming prefix in `D_NAMING`.
4. Codes are **stable**: never renumber an existing family/subfamily code (block names depend on them).
5. The taxonomy is **domain-tagged** (measurement / interior kitchen / outdoor kitchen) so a build can
   generate a domain subset (e.g. "outdoor only") without touching the tree.
