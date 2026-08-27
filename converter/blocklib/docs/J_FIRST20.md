# J — Prioritized First 20 Blocks

> The first 20 blocks to build, ordered by value to Soline's core deliverable (a professional kitchen
> measurement plan) and by build-risk (prove the base-cabinet pipeline first). Grouped into cycles of
> ≤10 (principle 7). **Cycle 1 is the 5-cabinet prototype the owner will approve to start:
> 300/450/600/800/900.**

Date: 2026-08-22 · Units: mm. Every block below is generic and drawn from scratch (principles 1–4).

---

## Priority rationale

1. **Base cabinets first** — they are the backbone of every kitchen plan, the highest-frequency object,
   and the best test of the parametric width-family mechanism (one object → 5 variant blocks).
2. **Then the objects that sit in/on the base run** — sink, hob, oven, dishwasher — so a real kitchen
   line can be drawn end-to-end.
3. **Then wall + tall + corner** — completing the cabinet vocabulary.
4. Outdoor-kitchen and fixtures follow in later cycles (not in the first 20).

---

## Cycle 1 — Base-cabinet prototype (5 blocks) ← the approval milestone

One object file (`KIT-BASE-DR` family) → five width variants. Proves schema → validate → resolve →
DXF → preview → QA → contact-sheet end-to-end on the simplest real object.

| # | Key | Object | Views |
|---|---|---|---|
| 1 | `KIT-BASE-DR1-0300` | base, 1-door, 300 | P/F/S |
| 2 | `KIT-BASE-DR1-0450` | base, 1-door, 450 | P/F/S |
| 3 | `KIT-BASE-DR2-0600` | base, 2-door, 600 | P/F/S |
| 4 | `KIT-BASE-DR2-0800` | base, 2-door, 800 | P/F/S |
| 5 | `KIT-BASE-DR2-0900` | base, 2-door, 900 | P/F/S |

**Gate:** contact sheet + QA report → owner approval before Cycle 2.

## Cycle 2 — Base variants + the wet/cook core (10 blocks)

Completes a drawable kitchen line: drawers, sink base + sink + tap, hob, oven, dishwasher.

| # | Key | Object | Views |
|---|---|---|---|
| 6 | `KIT-BASE-DW3-0600` | base, 3-drawer, 600 | P/F/S |
| 7 | `KIT-BASE-DW2-0800` | base, 2-drawer (pan), 800 | P/F/S |
| 8 | `KIT-BASE-SK-0800` | sink base, 800 | P/F/S |
| 9 | `SNK-BWL-1-0600` | single-bowl sink | P/Sec |
| 10 | `SNK-BWL-2-0800` | double-bowl sink | P/Sec |
| 11 | `SNK-TAP-MONO` | mono mixer tap | P/F |
| 12 | `APP-COOK-HOB-0600` | hob, 600 (gas/induction) | P/F |
| 13 | `APP-COOK-OVN-0600` | built-in oven, 600 | P/F |
| 14 | `KIT-BASE-AP-DW-0600` | dishwasher housing, 600 | P/F/S |
| 15 | `APP-CLEAN-DW-0600` | dishwasher appliance, 600 | P/F |

**Gate:** contact sheet + QA report → owner approval before Cycle 3.

## Cycle 3 — Wall + tall + corner + hood (5 blocks, completing the first 20)

Gives vertical + corner coverage so a full kitchen elevation is possible.

| # | Key | Object | Views |
|---|---|---|---|
| 16 | `KIT-WALL-DR2-0600` | wall, 2-door, 600 (H720) | P/F/S |
| 17 | `KIT-WALL-DR2-0800` | wall, 2-door, 800 | P/F/S |
| 18 | `KIT-TALL-OV-0600` | oven tower, 600 | P/F/S |
| 19 | `KIT-CORN-BS-0900` | base corner, 900 | P/F |
| 20 | `APP-EXT-HOOD-0900` | chimney hood, 900 | P/F/S |

**Gate:** contact sheet + QA report → owner approval before any outdoor-kitchen / fixtures cycle.

---

## Notes

- **Handedness**: 1-door bases (#1, #2) ship an `L` default; the `R` mirror is a variant added on
  demand (a variant, not a new object — `D_NAMING §1`).
- **Appliance vs housing**: an appliance (`APP-*`) and its housing cabinet (`KIT-BASE-AP-*`) are
  separate blocks sharing the same insertion anchor (`F_INSERTION_POINTS §2`) so the appliance drops
  into the housing cleanly.
- **MEP companions** are *referenced*, not drawn (`metadata.mepCompanions`) — e.g. `SNK-BWL-1-0600`
  references `water_cold`/`water_hot`/`sewage_point`; the hob references `outlet_cooktop`/`gas_point`.
- Nothing beyond Cycle 1 is built until Cycle 1 is approved; each subsequent cycle is likewise gated.
