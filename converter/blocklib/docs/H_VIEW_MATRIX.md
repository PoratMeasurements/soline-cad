# H — Plan / Front / Side / Section Matrix

> Which views each family is **required** to provide. Principle 6: each object gets Plan / Front / Side
> as relevant, with Section where the family needs a cut to be legible. A view marked ● is required;
> ○ is optional/as-needed; — is not applicable.

Date: 2026-08-22 · Units: mm.

---

## 1. Matrix

| Family / subfamily | Plan | Front | Side | Section | Notes |
|---|:--:|:--:|:--:|:--:|---|
| `ROOM-WALL` | ● | — | — | ● | plan run + wall section (thickness/poché) |
| `ROOM-COL` | ● | — | — | ○ | plan footprint; section if profiled |
| `ROOM-LVL` / `ROOM-CEIL` | ● | — | — | ● | level/bulkhead needs a section |
| `ROOM-NICH` | ● | ○ | — | ○ | niche footprint; front if a feature |
| `ROOM-DTM` | ● | — | — | — | tag/stamp only |
| `KIT-BASE-*` | ● | ● | ● | ○ | full 3-view; section for a sink/appliance cut |
| `KIT-WALL-*` | ● | ● | ● | — | wall units: 3-view (plan = mounting footprint) |
| `KIT-TALL-*` | ● | ● | ● | — | full-height 3-view |
| `KIT-CORN-*` | ● | ● | ○ | — | corner plan is the point; front for door face |
| `KIT-TOP-WT` worktop | ● | — | — | ● | plan run + upstand/edge section |
| `KIT-TOP-IS` island | ● | ● | ● | — | island as an object: 3-view |
| `KIT-TOP-TR` trim | — | ● | — | ● | cornice/plinth = profile (front + section) |
| `APP-COOK` (hob/oven) | ● | ● | ○ | — | plan cut-out + front controls |
| `APP-COLD` (fridge) | ● | ● | ● | — | freestanding: full 3-view |
| `APP-CLEAN` (dishwasher/washer) | ● | ● | ○ | — | plan footprint + front |
| `APP-EXT` (hood) | ● | ● | ● | — | canopy needs all three |
| `APP-SML` | ● | ● | — | — | built-in small: plan + front |
| `SNK-BWL` sink bowl | ● | — | — | ● | plan bowl(s) + section (depth/waste) |
| `SNK-TAP` tap | ● | ● | — | — | plan footprint + front height |
| `OUT-COOK` (BBQ/burner) | ● | ● | ● | — | outdoor cooking: full 3-view |
| `OUT-MOD` module | ● | ● | ● | — | masonry module 3-view |
| `OUT-WET` / `OUT-COLD` | ● | ● | ○ | — | plan + front, side if deep |
| `OUT-SURF` surface | ● | — | — | ● | plan + edge section |
| `OUT-UTL` | ● | ● | ○ | — | |
| `FIX-SAN` sanitary | ● | ● | ○ | — | WC/basin/bath: plan + front |
| `FIX-FRN` furniture datum | ● | ○ | — | — | context footprint; front optional |
| `FIX-HEAT` radiator | ● | ● | — | — | |
| `SYMK-*` tags | ● | ○ | — | — | annotation blocks |

## 2. What each view means (conventions)

- **Plan** — top-down footprint at worktop/mounting level. For base cabinets this is the carcass
  footprint + door-swing arcs (`SOL-RIHUT-DOOR`) + dashed worktop overhang (`SOL-RIHUT-HID`). This is
  the view the measurement plan actually places (the hero view).
- **Front** — elevation looking at the face; finished floor at Y=0. Shows door/drawer division,
  handles, appliance controls, plinth/toe-kick. Drives the kitchen elevation drawings.
- **Side** — depth elevation, Y=0 floor, X=0 wall face. Shows depth, worktop cap, toe-kick recess,
  wall-unit projection.
- **Section** — a cut where a footprint/elevation cannot convey the object: worktop edge/upstand,
  sink bowl depth + waste, wall thickness/poché, trim profiles, level changes.

## 3. Rules

1. A view listed ● is **mandatory** — QA (`views-required`, `I_QA_STANDARD`) fails an object missing a
   required view.
2. All views of one object share consistent datums (`F_INSERTION_POINTS §3`); QA checks coincidence.
3. Optional views (○) are generated when the object's geometry warrants it; the object declares which
   views it `provided` in `views{}`.
4. A view is only "provided" if it renders **real geometry** — an empty or placeholder view fails QA
   (`view-nonempty`).
5. Adding a Section to a family that was Plan-only is a taxonomy edit (add the ● here) + regenerate.
