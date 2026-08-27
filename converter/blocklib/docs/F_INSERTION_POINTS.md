# F — Insertion-Points Standard

> Where a block's base point sits, per family and per view, so that placing a block by its insertion
> point does the right thing on a measured plan (tiles along a wall, aligns to a worktop line, snaps to
> a corner). The insertion point is authored in `insertion.basePoint` (see `C_OBJECT_SCHEMA`).

Date: 2026-08-22 · Units: mm · Coordinate frame per object: +X right, +Y away-from-wall (into room) in plan, +Z up. Front/side views: +X right, +Y up.

---

## 1. Guiding principle

The insertion point is the point the measurer/exporter will place the block *at*. It must be the point
whose position is actually **known from the measurement**. For a wall-hung run, that is the **rear
face against the wall**; for an island, the **footprint corner or centre**. Choose the anchor that
makes placement a single translate (and, for wall-aligned objects, a single rotate) with no fiddling.

## 2. Standard anchors (per family)

| Family / subfamily | Plan anchor | Why |
|---|---|---|
| `KIT-BASE-*`, `KIT-WALL-*`, `KIT-TALL-*` (against wall) | **back-left corner** (0,0 at rear-left) | a run tiles by advancing X by each width; rear face = wall line |
| `KIT-CORN-*` (corner units) | **inner corner** = the re-entrant corner point (0,0) | snaps to the room's inside corner; both wall runs grow from it |
| `KIT-TOP-IS` island / peninsula | **footprint centre** (or a named corner) | islands are placed by centre / a chosen datum corner, free rotation |
| `APP-*` built-in appliances | **back-left corner**, coincident with the housing cabinet's anchor | appliance drops into its housing with the same datum |
| `APP-*` freestanding (fridge/range) | **back-left corner** | sits against wall like a cabinet |
| `SNK-*` sink | **bowl centre** in plan (tap = its own datum on the back line) | sink is dimensioned from bowl centre to walls; drops into `KIT-BASE-SK` |
| `OUT-*` outdoor modules | **back-left corner** (island variants: centre) | same as interior base; masonry runs tile along a line |
| `ROOM-WALL` | **start end, wall centreline** (0,0), +X along the wall | a wall run is placed start→end along its measured axis |
| `ROOM-COL` column | **centre** | columns are located by centre coordinate |
| `FIX-*` | **footprint centre** (sanitary: back-centre against wall) | context blocks placed by centre; WC/basin by wall-back |

## 3. Per-view base point

Each view declares its own base point in the view's own coordinate frame, but they must be
**mutually consistent** — the same physical point of the object:

| View | Base point convention |
|---|---|
| **Plan** | the family anchor above (e.g. back-left = (0,0), footprint drawn into +X,+Y) |
| **Front** | directly below the plan anchor: **X = same as plan X-origin**, **Y = 0 at finished floor** (so front and plan share the X datum and the floor line is Y=0) |
| **Side** | **X = 0 at the wall/back face** (depth grows +X into room), **Y = 0 at floor** |
| **Section** | same datum as the view it sections (plan-cut section shares plan X; vertical section shares front Y=floor) |

**Consistency rule (QA-checked):** for a given object the plan base-point X, the front base-point X and
the side back-face all correspond to the same real edge. QA (`insertion-consistency`) verifies the
three anchors are coincident within 0.1 mm of the declared physical point.

## 4. Rotation rule

`insertion.rotationRule`:
- `wall-aligned` — the block is inserted with rotation = the host wall's angle; anchor on the wall face
  keeps it flush. (base/wall/tall cabinets, freestanding appliances against wall, ROOM-WALL, sanitary)
- `free` — placed at any rotation (islands, peninsulas, freestanding context furniture).
- `fixed` — never rotated (plan annotation blocks, tags).

`insertion.wallSide` (`against-wall` / `island` / `either`) tells the placement resolver whether the
back face must touch a wall.

## 5. Grid & rounding

- All insertion points are on a **1 mm** grid (values are integers or .5 at most). No sub-mm datums.
- The anchor is drawn at exactly (0,0) in its view frame so a preview's crosshair marks it and QA can
  assert `min(bbox) == anchor` for corner-anchored families.

## 6. Example (base cabinet)

`KIT-BASE-DR2-0600`: `anchor: back-left`, plan (0,0) = rear-left, footprint drawn to (600,560);
front (0,0) = floor at left edge, carcass 100→820 in Y; side (0,0) = wall face at floor. Placing five
of them along a wall = insert at wall points advancing X by 600 each — no other transform. This is why
`back-left` is the base-cabinet standard.
