# Elevation & Plan Undulation — Point-Based Measurement Design

> Design document (research + design). **Read-only — no code changes made.** Written 2026-08-24.
> Owner requirement (Michael): **ONE** elevation-measurement method, folded into the elevation
> function. Remove the datum-based approach for elevation. Two new point-based methods:
> **A — Elevation (front view)** with real geometry + wall-face undulations (הגליות), and
> **B — Plan-view wall undulation** (belly / בטן, AutoCAD-style).

---

## 0. Executive summary (recommended approach)

- **One elevation screen.** Keep `WallElevationUnified` as the single elevation surface. Retire the
  legacy `ElevationScreen` (rectangle-only, no real geometry) and fold the standalone
  `WallShapeCapture` frame-capture flow *into* the elevation screen's existing **FRAME** mode. The
  screen already stores a captured outline as `WallEntity.framePointsJson`; we upgrade the capture
  math, not the storage container.

- **Method A** turns each laser shot `(d, φ, θ)` — slant distance, horizontal azimuth from the
  DST 360-X, vertical inclination from the X6 — into a true 2D point in the **wall-face plane**:
  a horizontal position `u` along the face and a height `v`. The sequence of `(u, v)` is the **true
  elevation outline** (real slopes, drops, steps — not an assumed rectangle). The perpendicular
  deviation of each point from the mean wall-plane is the **surface undulation** `e` (mm), shown as
  a magnitude/colour overlay on the front view. The user first pins a **zero-corner**
  (RIGHT/LEFT × TOP/BOTTOM) and a **direction** (CW / CCW · עם/נגד כיוון השעון) that fix the origin
  and winding of the outline.

- **Method B** is the same point cloud read in plan. Endpoints A (first) and B (last) form a chord;
  each point's **signed perpendicular offset** from that chord is the belly: **+ = bulge into the
  room**, **− = away**. Rendered on the top (plan) view as the true polyline against its chord, with
  an exaggeration slider so millimetre bellies are legible.

- **The under-used `Reading.hAngleDeg` (DST 360-X azimuth φ) is the key that unlocks both.**
  `StationSolver.toPlan(d, φ, θ)` already converts a spherical shot to a plan point; today only
  `P2PMeasureScreen` uses it. Method A and Method B both stand on it. Without φ (bare X6) both
  degrade gracefully to the current manual-stepper / manual-tap behaviour.

- **Scope confirmation on "datum removal":** the phrase "datum" covers **two unrelated
  subsystems**. Only one is an elevation duplicate; the floor/ceiling planarity survey is a
  **separate horizontal use-case and must be preserved** (see §6). Removing the elevation datum
  path does **not** delete the floor/ceiling survey.

---

## 1. Current-state audit (what exists today)

### 1.1 The measurement primitive — `Reading`

`device/LaserBle.kt`:

```kotlin
data class Reading(
    val label: String,
    val distanceMm: Double?,   // d — slant distance
    val vAngleDeg: Double?,    // θ — inclination from horizontal (0 = level, + up)
    val hex: String,
    val ts: Long,
    val hAngleDeg: Double? = null,  // φ — azimuth from DST 360-X (standing, under-used)
)
```

`hAngleDeg` is populated only when a DST 360-X adapter is present. Usage today: **only**
`StationSolver.toPlan(...)` and `P2PMeasureScreen`. Everywhere else it is ignored.

### 1.2 The spherical→plan helper already exists

`geometry/StationSolver.kt`:

```kotlin
fun toPlan(distanceMm: Double, hAngleDeg: Double?, vAngleDeg: Double?): Pt {
    val d = abs(distanceMm)
    val tilt = if (vAngleDeg != null && vAngleDeg.isFinite()) toRadians(vAngleDeg) else 0.0
    val r = d * cos(tilt)                         // horizontal range
    val phi = if (hAngleDeg != null && hAngleDeg.isFinite()) toRadians(hAngleDeg) else 0.0
    return Pt(r * cos(phi), r * sin(phi))         // plan (X, Y), station at origin
}
```

This gives plan `(X, Y)`. The missing vertical is simply `Z = d·sin(θ)` (already coded as
`FloorLevelSolver.heightZ`). Method A/B need `(X, Y, Z)` — both halves already exist; nothing new in
the device layer.

### 1.3 The elevation screens (the "two methods" to collapse to one)

| Screen | File | Role | Fate |
|---|---|---|---|
| `WallElevationUnified` | `ui/elevation/WallElevationUnified.kt` | Unified front view: **FRAME** mode (capture outline) + **ELEMENTS** mode (place sockets/pipes/soffit) + planning-layer (cabinets) + clash detection. Persists outline to `framePointsJson`. | **Keep — the single elevation method.** Upgrade FRAME math (Method A). |
| `ElevationScreen` | `ui/elevation/ElevationScreen.kt` | Legacy front view: draws the wall as a plain **rectangle** (`length × height`), places accessories, no outline capture. | **Remove.** Fully superseded by `WallElevationUnified`. Not referenced by the nav graph (`elevation/{wid}` → `ElevationHost` → `WallElevationUnified`). |
| `WallShapeCapture` | `ui/shape/WallShapeCapture.kt` | Standalone polar/tap point capture. Route `shape/{wid}` → `ShapeHost`, writes the same `framePointsJson`. Uses **only vAngle-free polar** (manual bearing stepper) — plan capture, not elevation. | **Repurpose / fold in** (see §6). |

Today `WallElevationUnified` **FRAME** mode captures points as
`(horizMm, laserHeightMm)` where `horizMm` is a **manual horizontal stepper** and
`laserHeightMm = d·sin(θ)`. It ignores `φ` — so the horizontal axis is hand-cranked, not measured.
Method A replaces the manual `horizMm` with a **measured** `u` from `φ`.

### 1.4 What "datum" means today (two subsystems)

1. **`DatumMeasureScreen`** — `ui/resize/DatumMeasureScreen.kt`, route `datum/{rid}`, button
   "📍 מדידת Datum". A **plan-view trilateration/resize helper** (angle-by-distances,
   corner-by-distance, line-by-reference) built on `geometry/Trilateration`. It is **non-persistent**
   — `onResult` only shows a Toast. This is the "datum-based approach" that overlaps the new
   point-based plan capture (Method B does its job directly from measured points).

2. **Floor/Ceiling level survey** — `ui/level/LevelSurveyScreen.kt` (routes `floor/{rid}`,
   `ceiling/{rid}`), `geometry/FloorLevelSolver.kt`, `data/LevelModel.kt`
   (`LevelPointEntity`), `geometry/LevelGrid.kt`. Uses a **"00" datum reference point**: measure a
   zero, then every point reports `deviation = Z − zeroZ` (± mm). This is **horizontal-surface
   planarity**, not wall elevation. `docs/FLOOR_CEILING_X6_SURVEY.md` proposes upgrading it to a
   best-fit datum **plane** (`DatumPlaneSolver`, not yet built).

**There is no dedicated wall-elevation datum solver.** The only elevation duplication is the legacy
`ElevationScreen` vs `WallElevationUnified` (and the split between in-screen FRAME and the standalone
`WallShapeCapture`). See §6 for the exact removal/repurpose plan and the scope confirmation.

---

## 2. Method A — Elevation (front view) with real geometry + undulations

### 2.1 Setup (what the surveyor fixes before shooting)

1. **Zero-corner** — a 2×2 choice: horizontal end `{LEFT | RIGHT}` × vertical end `{BOTTOM | TOP}`.
   This is the corner of the wall face that becomes the origin `(u=0, v=0)` of the elevation drawing.
2. **Direction** — `{CW | CCW}` (עם / נגד כיוון השעון). Sets the sign of the `u` axis so the outline
   winds consistently regardless of which way the surveyor sweeps.
3. **Station** — tripod fixed; X6 + DST 360-X. The station is the origin `O` of the measurement
   frame; it does not move during capture (same assumption as the level survey and P2P).

### 2.2 The geometry — one shot → one wall-face point

Each shot is a spherical triple `(d, φ, θ)`. Convert to station-frame Cartesian (identical to the
FLOOR_CEILING doc §1.2 and `StationSolver.toPlan` + `heightZ`):

```
X = d · cos(θ) · cos(φ)      ← plan east/west
Y = d · cos(θ) · sin(φ)      ← plan north/south
Z = d · sin(θ)               ← signed height vs. station centre (+up, −down)
```

The wall face is a **vertical plane**. To draw an *elevation* (front view) we need 2D coordinates in
that plane: a horizontal position `u` along the face and a height `v`. Height is direct:

```
v_i = Z_i = d_i · sin(θ_i)         (later re-referenced to the floor / zero-corner, §2.4)
```

The horizontal axis `u` is the position **along the wall's own baseline**, obtained by projecting
each point's plan position onto the wall line:

1. Compute plan points `Pᵢ = (Xᵢ, Yᵢ)` for every shot (`toPlan`).
2. Fit the **wall baseline** — the best-fit line through `{Pᵢ}` in plan (total-least-squares / PCA
   of the plan cloud; for a first cut, the chord from the first to the last point is enough). Let
   `A` be the baseline anchor (foot of the first point) and `t̂` the unit direction along the wall,
   `n̂` the in-plan unit normal (rotate `t̂` by +90°).
3. Decompose each plan point:

```
u_i =  (Pᵢ − A) · t̂          ← position along the wall face (horizontal axis of the elevation)
e_i =  (Pᵢ − A) · n̂          ← perpendicular offset from the wall plane = SURFACE UNDULATION
```

So a single shot yields three numbers:

| Quantity | Formula | Meaning in the front view |
|---|---|---|
| `u_i` | `(Pᵢ − A)·t̂` | horizontal position along the wall |
| `v_i` | `d·sin(θ)` | height |
| `e_i` | `(Pᵢ − A)·n̂` | **undulation** — how far the surface bulges out of / into its own plane |

`(u_i, v_i)` is the **elevation outline**; `e_i` is the **surface waviness** (the bulge/dip that is
perpendicular to the front view and therefore cannot be drawn as an outline — it is shown as
magnitude, §2.6).

### 2.3 True outline vs. assumed rectangle

Plotting `(u_i, v_i)` in order gives the **real** wall-face profile:

- A sloping ceiling / roof line appears as the top run rising or falling — the real elevation angle,
  `slopeᵢ = atan2(Δv, Δu)` between consecutive outline points, is shown per segment.
- Step-downs (הנמכות), soffits, sloped sills, kinks all appear at their measured heights, instead of
  a flat `height` constant.
- The polygon that fills the face (`WallElevationUnified` already builds this: floor → outline →
  floor, closed) is now the *measured* silhouette, not `length × height`.

### 2.4 Pinning the zero-corner and direction

After all points are captured, apply a rigid re-frame so the chosen corner is the origin:

- **Horizontal (`LEFT`/`RIGHT`)** — let `u_min = min(u_i)`, `u_max = max(u_i)`.
  - `LEFT`  → `u' = u − u_min` (origin at the left end).
  - `RIGHT` → `u' = u_max − u` (origin at the right end; also flips handedness).
- **Direction (`CW`/`CCW`)** — multiply `u'` by `dir = (CCW ? +1 : −1)` so the polygon winds the way
  the converter/report expects. (For a plain left-to-right elevation, `LEFT + CCW` is the identity.)
- **Vertical (`BOTTOM`/`TOP`)** — `v` is height-from-floor. `BOTTOM` keeps `v' = v − v_floor`;
  `TOP` reports the drop from the ceiling `v' = v_ceil − v` (useful when the surveyor references
  everything from a hung ceiling). `v_floor` is either an explicit floor shot, the lowest captured
  `v`, or the current floor datum.

The stored outline is `(u', v')` in millimetres — the same `[[x, y], …]` shape already written to
`framePointsJson`, so **persistence does not change form**, only becomes *measured* rather than
hand-stepped. `e_i` is new and is stored alongside (§7).

### 2.5 Fallback without φ (bare X6)

If `hAngleDeg == null`, there is no measured horizontal axis. Method A degrades to **exactly today's
behaviour**: `u` comes from the manual horizontal stepper and `v = d·sin(θ)`; `e ≡ 0` (no undulation
available) and the screen shows a small "ללא זווית אופקית — מיקום אופקי ידני" note. This keeps the
one-method promise intact on both hardware tiers.

### 2.6 On-site UX flow (folded into `WallElevationUnified` FRAME mode)

1. Enter the wall → **חזית** → **▦ מסגרת** (FRAME) mode (already the tab).
2. New **setup strip** at the top of the FRAME panel:
   - Zero-corner selector — a 2×2 pad: ▛ ▜ / ▙ ▟ (LEFT-TOP … RIGHT-BOTTOM), default ▙ (LEFT-BOTTOM).
   - Direction toggle — `↻ עם השעון` / `↺ נגד השעון`, default CCW.
3. Aim, press the device → the shot `(d, φ, θ)` is captured (the existing `pendingDist/ts` dedup
   already latches one frame per trigger). A **live ghost** shows where `(u, v)` will land and the
   running `e` (undulation) value.
4. **➕ קלוט נקודה** commits the point. When φ is present the horizontal position is *measured*; the
   manual stepper stays as an override for tap-only points.
5. Repeat around the face (top run, drops, sills). **↩︎ בטל נקודה** / **נקה** unchanged.
6. Live readouts: point count, outline length, **max |e| undulation (mm)**, and top-run slope angle.
7. **✓ סיום מסגרת** re-frames to the pinned zero-corner + direction and returns `(u', v', e)` to the
   host to persist (§7).

### 2.7 Rendering the undulation on the front view

The outline is drawn as today. The undulation `e` (perpendicular to the view) is shown as:

- a **colour band** along the outline (blue = into room / +, red = away / −, green ≈ 0), and
- **spot labels** `e=+7` at local extrema, and a header pill `בליטה מירבית 12 מ"מ`.

This mirrors the level-survey deviation colours (`OkGreen ≤3`, `WarnAmber ≤10`, `BlockRed >10`) so
the surveyor reads waviness the same way on floor, ceiling and wall.

---

## 3. Method B — Plan-view wall undulation (belly / בטן)

### 3.1 Input

The same captured points, read in **plan**: `Pᵢ = (Xᵢ, Yᵢ)` from `toPlan(dᵢ, φᵢ, θᵢ)`. (If the wall
was instead captured with the tap/polar `WallShapeCapture`, its `(x, y)` points feed in directly.)

### 3.2 Signed offset from the endpoint chord

Endpoints are the first and last measured points: `A = P₀`, `B = P_{n−1}`.

```
t̂ = (B − A) / |B − A|                 chord unit direction
n̂ = rot₊₉₀(t̂) = (−t̂_y, t̂_x)          in-plan normal, oriented "into the room"
for each i:
    s_i = (Pᵢ − A) · t̂                position along the chord (0…|B−A|)
    e_i = (Pᵢ − A) · n̂                SIGNED belly offset  (+ into room, − away)
```

- `e_i > 0` → the wall bulges **into the room** at that station (convex belly, בטן חיובית).
- `e_i < 0` → it bows **away** (concave, בטן שלילית).
- `max e / min e` give the positive/negative belly extremes; `Σ` and RMS give an overall flatness
  grade. Chord length `|B − A|` is the wall's straight span; the true developed length is the
  polyline sum (already computed as `polylineLength`).

**Orienting `n̂` into the room:** if the room outline is known (walls laid out CCW → positive signed
area), pick the sign of `n̂` that points toward the room interior (the same inward test `LevelGrid`
uses via `signedArea`). If the wall is captured standalone, default `n̂` to the left of the sweep
direction and expose a **הפוך צד** (flip) toggle — one tap, exactly like the CW/CCW convention note
in `StationSolver.toPlan`.

### 3.3 Rendering in the plan (top) view

- Draw the **chord** `A→B` (thin, grey) and the **true polyline** `P₀…P_{n−1}` (bold).
- At each `Pᵢ` drop a tick to the chord annotated with `e_i` (± mm).
- **Exaggeration slider** (×1 … ×20): multiply only the normal component for display
  (`P̃ᵢ = A + s_i·t̂ + k·e_i·n̂`) while keeping `s_i` true — the AutoCAD "deviation plot" look, so a
  6 mm belly on a 4 m wall is visible. The exaggeration factor is a view property, never stored.
- A filled sliver between chord and polyline, tinted by sign (into-room vs away), makes the belly
  direction obvious at a glance.

### 3.4 On-site UX flow

Method B needs no separate capture pass — it is a **view toggle** on the same points:

- In `WallShapeCapture` (repurposed as the plan-capture entry), add a **בטן / undulation** overlay
  toggle that draws the chord + signed offsets + exaggeration slider over the existing polyline.
- On the room plan canvas (`ui/canvas/RoomPlanCanvas.kt`), a per-wall "show belly" affordance can
  render the same overlay from the wall's stored points, so the belly is visible in context.

---

## 4. Reusing the DST hAngle (`Reading.hAngleDeg`)

Both methods are **built on `φ = hAngleDeg`**, the standing-but-under-used azimuth from the
DST 360-X:

- **Single source of truth:** route every capture through `StationSolver.toPlan(d, φ, θ)` for plan
  `(X, Y)` and `FloorLevelSolver.heightZ(d, θ)` for `Z`. No new spherical math — reuse what P2P and
  the level survey already ship.
- **Method A** uses `φ` to *measure* the horizontal axis `u` (replacing the manual stepper) and to
  derive `e` (the in-plane offset). **Method B** uses `φ` for the plan positions that define the
  chord and the belly.
- **Graceful degradation:** `φ == null` (X6 without the adapter) → Method A falls back to the manual
  horizontal stepper (`e ≡ 0`); Method B is available only for tap-captured points. The screen shows
  the same "requires DST 360-X for horizontal angle" note P2P already uses — no hard failure.
- **One calibration knob:** `toPlan` documents that if the field outline comes out mirrored, flip
  `φ → −φ`. Method A/B inherit that single sign convention; expose it as the CW/CCW + flip toggles
  rather than a hidden constant.

---

## 5. Data model + `.sol` export changes

### 5.1 Persistence (Room)

`WallEntity.framePointsJson` already stores the elevation outline as `[[x, y], …]` (mm). Extend the
per-point record to optionally carry the undulation, keeping full backward compatibility:

- **Option 1 (minimal, recommended):** widen each tuple to `[u, v, e]` where `e` is the signed
  undulation (mm); a 2-element `[u, v]` remains valid (legacy → `e = 0`). `parseFramePoints` /
  `framePointsToJson` in `AppUi.kt` gain a third slot.
- **Option 2 (explicit):** add a sibling column `wallProfileJson` holding
  `{ zeroCorner, direction, baseline:{ax,ay,tx,ty}, points:[{u,v,e}], plan:[{x,y}] }`. Cleaner for
  the converter but needs a Room migration (bump `SolineDatabase`, add `ALTER TABLE walls ADD
  COLUMN wallProfileJson TEXT NOT NULL DEFAULT ''`, mirror the migration test pattern already in the
  DB file). Prefer this if the converter wants plan + elevation without recomputation.

Store the setup choices (`zeroCorner`, `direction`, `flip`) so a re-open reproduces the drawing
exactly (same spirit as `rememberSaveable` already guarding in-progress points).

### 5.2 `.sol` export (`export/SolWriter.kt`)

The writer already emits `"framePoints": <framePointsJson>` per wall (line ~237). Add a parallel,
richer block so the converter gets geometry it can render without re-fitting:

```jsonc
"elevation": {
  "zeroCorner": "LEFT_BOTTOM",        // LEFT|RIGHT × BOTTOM|TOP
  "direction":  "CCW",                // CW|CCW
  "outline":  [ [u,v], ... ],         // true front-view profile (mm), already re-framed
  "undulation": [ e0, e1, ... ],      // signed surface offset per outline point (mm)
  "maxBulgeMm": 12.0, "maxDipMm": -7.0
},
"planBelly": {
  "chord": [ [Ax,Ay], [Bx,By] ],      // endpoints in plan (mm)
  "points":  [ [x,y], ... ],          // true plan polyline (mm)
  "offsets": [ e0, e1, ... ],         // signed belly per point (+ into room)
  "spanMm": 4000.0, "developedMm": 4021.0,
  "maxPosMm": 9.0, "maxNegMm": -4.0
}
```

- Keep the existing `"framePoints"` key for backward compatibility (converter fallback); the new
  `"elevation"`/`"planBelly"` blocks are additive, matching how `levelPoints`/`cabinets` were added
  as optional room blocks. All numbers go through the existing `jnum` (round-trippable, non-finite →
  null). Units stay mm; the manifest's `coordinateSystem` (`yAxis: up`) already fits.

### 5.3 Converter rendering (SolReader / downstream)

- **Elevation (front view / DXF-2D front, PDP):** draw `elevation.outline` as the wall silhouette
  (real slopes, drops), then overlay `elevation.undulation` as a colour band / dimension callouts so
  the joiner sees where the face bulges. Replaces the current assumed `length × height` rectangle.
- **Plan (DXF-2D plan):** draw `planBelly.points` as the true wall run against `planBelly.chord`,
  annotate `maxPosMm` / `maxNegMm`. The converter already consumes per-wall data to build ORDX; the
  belly is one more per-wall attribute.
- Because both blocks are pre-computed and re-framed on the device, the converter does **no
  geometry fitting** — it renders arrays. This keeps the converter dependency-light, matching
  `SolWriter`'s hand-rolled-JSON philosophy.

---

## 6. Datum-removal plan (files / screens) + scope confirmation

### 6.1 Scope confirmation (important)

"Datum" spans two **unrelated** subsystems. Only one is an elevation duplicate:

| Subsystem | Files | Is it wall elevation? | Decision |
|---|---|---|---|
| **Datum resize helper** | `ui/resize/DatumMeasureScreen.kt` + `datum/{rid}` route + "📍 מדידת Datum" button (`AppUi.kt` ~L457, ~L940 `DatumHost`) | No — plan-view trilateration (`Trilateration`), non-persistent (Toast only) | **Remove or repurpose** — its job (deriving plan geometry from measured distances) is now done directly by Method B on captured points. |
| **Floor/Ceiling level survey** | `ui/level/LevelSurveyScreen.kt`, `geometry/FloorLevelSolver.kt`, `data/LevelModel.kt`, `geometry/LevelGrid.kt`, routes `floor/{rid}` `ceiling/{rid}`, `SolWriter.levelPointsBlock` | **No — horizontal surfaces.** Uses a "00" datum-*point* for floor/ceiling planarity, a different use-case. | **Preserve.** Not part of the elevation consolidation. (Its own upgrade to a best-fit datum *plane* lives in `docs/FLOOR_CEILING_X6_SURVEY.md`.) |

**Confirmation for the owner:** removing the elevation datum path does **not** touch the
floor/ceiling planarity survey. The wall-face undulation (Method A `e`) and the floor/ceiling
deviation are *different measurements on different surfaces*; keeping both is not a "duplicate
elevation method". If the owner truly means "one deviation concept everywhere", that is a larger,
separate change (fold wall-face `e` and floor/ceiling deviation into a shared solver) and should be
scoped on its own — flagging, not assuming.

### 6.2 The actual elevation duplication to collapse

1. **Remove `ui/elevation/ElevationScreen.kt`.** It is the legacy rectangle-only front view, fully
   superseded by `WallElevationUnified`, and is **not wired** into the nav graph (`elevation/{wid}`
   already routes to `WallElevationUnified` via `ElevationHost`). Deleting it removes the second
   elevation code path with zero UX change. (Its `AccessoryDialog`/`BigButton` are file-private
   duplicates of `WallElevationUnified`'s `AccessoryEditor`/`FieldButton`; nothing external depends
   on them — verify with a usage grep before deletion.)

2. **Fold `WallShapeCapture` into the elevation FRAME flow.** Two capture UIs writing the same
   `framePointsJson` is the other duplication:
   - Keep `WallShapeCapture` as the **plan** capture (Method B lives here naturally — it captures
     `(x, y)`), and make FRAME mode inside `WallElevationUnified` the **elevation** capture (Method
     A). One button each, clearly labelled, no overlapping math.
   - Or, if the owner wants literally one screen: embed the polar/tap capture as a third sub-mode of
     `WallElevationUnified` and retire the standalone `shape/{wid}` route + `ShapeHost`.

3. **Datum resize helper:** remove the `datum/{rid}` route, `DatumHost`, `DatumMeasureScreen.kt`, and
   the "📍 מדידת Datum" button, **or** repurpose the screen as a numeric fallback that writes into
   the same point model. `Trilateration` stays (used elsewhere); only the screen goes. Because it
   never persisted, there is no data migration.

### 6.3 Net result

- **One elevation method:** `WallElevationUnified`, FRAME mode = Method A (real geometry +
  undulation).
- **One plan-undulation method:** Method B, surfaced from the plan capture + room plan overlay.
- Floor/ceiling planarity survey untouched.
- Legacy `ElevationScreen` and the non-persistent datum resize screen gone.

---

## 7. Step-by-step implementation plan

**Phase 1 — geometry core (pure Kotlin, JVM-testable, no Compose)**
1. Add `geometry/WallProfileSolver.kt`:
   - `shotToStation(d, φ, θ) → (X, Y, Z)` (thin wrapper over `StationSolver.toPlan` + `heightZ`).
   - `fitBaseline(points: List<PlanPt>) → Baseline(anchor, tHat, nHat)` (PCA / chord fallback).
   - `toElevation(points, baseline, zeroCorner, direction) → List<Triple(u, v, e)>` (§2.2–2.4).
   - `planBelly(points) → Belly(chord, offsets, span, developed, maxPos, maxNeg)` (§3.2).
2. Unit tests: a known rectangle → flat outline, `e ≈ 0`; a synthetic bulge → correct signed `e`;
   CW/CCW and LEFT/RIGHT/TOP/BOTTOM re-framing round-trips; φ-null fallback.

**Phase 2 — elevation screen (Method A)**
3. In `WallElevationUnified` FRAME mode: add the zero-corner 2×2 pad + CW/CCW toggle; on capture,
   store the full shot `(d, φ, θ)` (not just `height`); compute live `(u, v, e)` via the solver;
   show undulation colour band + max-bulge pill; `סיום` re-frames and returns `(u, v, e)`.
4. Keep the manual-stepper path as the φ-null fallback.

**Phase 3 — plan undulation (Method B)**
5. In `WallShapeCapture`: add the **בטן** overlay (chord + signed offsets + exaggeration slider +
   flip-side toggle) computed from the captured plan points.
6. Optional: per-wall belly overlay on `RoomPlanCanvas`.

**Phase 4 — persistence + export**
7. Extend `parseFramePoints`/`framePointsToJson` for the third `e` slot (Option 1), or add
   `wallProfileJson` + Room migration (Option 2). Persist `zeroCorner`/`direction`/`flip`.
8. In `SolWriter.buildRoom`, emit the additive `"elevation"` and `"planBelly"` blocks (§5.2)
   alongside the existing `"framePoints"`.

**Phase 5 — remove the second elevation method + datum resize**
9. Delete `ElevationScreen.kt` (after a usage grep confirms no external references).
10. Remove the `datum/{rid}` route, `DatumHost`, `DatumMeasureScreen.kt`, and the "📍 מדידת Datum"
    button — or repurpose per §6.2.3. Leave the floor/ceiling survey and `Trilateration` intact.

**Phase 6 — converter**
11. Update the SolReader/converter to render `elevation.outline` + `undulation` (front) and
    `planBelly` (plan); keep the `framePoints` fallback for old files.

---

## 8. Key formulas (quick reference)

```
Shot (d, φ, θ) → station Cartesian:
    X = d·cos(θ)·cos(φ)     Y = d·cos(θ)·sin(φ)     Z = d·sin(θ)

Wall baseline (plan): anchor A, unit direction t̂, unit normal n̂ = rot₊₉₀(t̂)

Elevation point:
    u = (P − A)·t̂           v = Z = d·sin(θ)        e = (P − A)·n̂   (undulation)
    segment slope = atan2(Δv, Δu)

Zero-corner re-frame:
    LEFT:  u' = u − u_min      RIGHT: u' = u_max − u
    dir:   u'' = (CCW ? +1 : −1) · u'
    BOTTOM: v' = v − v_floor   TOP:  v' = v_ceil − v

Plan belly (Method B):
    t̂ = (B−A)/|B−A|          n̂ = (−t̂_y, t̂_x)  (oriented into room)
    s_i = (Pᵢ−A)·t̂           e_i = (Pᵢ−A)·n̂    (+ into room, − away)
    display: P̃ᵢ = A + s_i·t̂ + k·e_i·n̂   (k = exaggeration, view-only)
```
