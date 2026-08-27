# Soline Measure — Surveyor Workflow & Methodology Audit

> Read-only audit of the end-to-end surveyor journey (start project → entrance/height → measure walls → place elements → measure openings → future-changes → closure/validation → export `.sol`/ORDX). Findings are code-grounded; each cites the file/screen, the trigger scenario, the consequence, and a recommended fix. **Analysis only — no app files were edited.**
> Audited: 2026-08-24. Scope: `app-measure/app/src/main/kotlin/il/co/soline/measure`.

---

## Executive summary

The happy path is coherent: `Projects → Rooms → Room → (template / live-measure / semi-auto / P2P draw walls) → Wall → elements/openings → Verify → Export`. Ordering is mostly protected — you cannot place an element before a wall exists, because element screens are only reachable from an existing wall. A blocking quality gate (`VerificationScreen` + `RoomValidator`) exists and correctly refuses export on missing length, unmeasured element width, too-few-walls, and an unclosed contour.

However, the audit found **systemic gaps that let an "incomplete" or "wrong" survey pass as finished**, plus **silent loss of measured data on export**. The most serious:

- **P0 — Measured field data is silently dropped at export.** `SolWriter` never writes per-wall `headStyle`/`headRidge`/`headPeak` (gable/sloped wall heads), never writes `framePointsJson` (X6 elevation-frame points), and the **entire floor/ceiling planarity survey (`level_points`) is never gathered or exported at all.** The surveyor measures these on-site; the carpenter never receives them; the app reports export success.
- **P1 — Wall heights are never actually measured, yet always pass validation.** Every wall-creating path stamps `Prefs.defaultWallHeightMm` (2700). Verification only checks `height > 0`, which the default always satisfies. "Every wall has a height ✓" is an illusion.
- **P1 — Openings measured "from the right corner" are stored and drawn as if measured from the left.** The in-app plan/3D views mirror-place them.
- **P1 — Completeness gate ignores entrance direction and ceiling height,** the two "priority" room-level fields, so a survey exports without them.
- **P2 — No validation that an opening fits its wall** (width ≤ wall length, in-bounds), no overlap detection, and **openings pre-filled with manufacturer defaults pass the gate with zero real field input.**

Detailed findings below, grouped by severity.

---

## P0 — Data-loss / corruption

### P0-1 · Measured survey data is silently discarded at `.sol` export
- **Where:** `export/SolWriter.kt` (`buildRoom`, walls block, lines ~218-256); `data/Repo.kt` `gather()` (lines 146-156); `export/OrdxExporter.kt`.
- **Scenario:** Surveyor measures (a) wall-head style — straight/sloped/**gable** — per wall (`WallHeadWallHost`, persisted to `headStyle/headRidgeMm/headPeakMm`); (b) the X6 elevation frame outline (`ShapeHost` → `framePointsJson`); (c) a full floor and ceiling planarity survey (`LevelSurveyScreen` → `level_points`, with real ± deviations from the Leica). Then exports the project.
- **Consequence:** `SolWriter.buildRoom` writes only `id, roomId, idx, length_mm, height_mm, angleToNext_deg, accessories` for each wall. It **omits** `headStyle`, `headRidgeMm`, `headPeakMm`, and `framePointsJson`. `Repo.gather()` never queries `level_points`, so the floor/ceiling deviation survey is **completely absent** from the `.sol`. Verified: `grep framePoints|headStyle|level export/SolWriter.kt export/OrdxExporter.kt` → no matches. The export "succeeds" with a green toast; hours of on-site measuring silently never reach the converter/carpenter. This is the worst class of bug for a surveyor: effort spent, no error, no output.
- **Fix:** Add `headStyle/headRidge/headPeak` and `framePoints` to the wall JSON in `buildRoom`; add a `measured/levels-<roomId>.json` layer (gather `dao.levelPoints`) and reference it in the manifest. Until then, at minimum surface a warning in `VerificationScreen` ("floor/ceiling survey / wall-head style will not be included in the export").

### P0-2 · Multi-field opening/measurement input lost on accidental dismiss or rotation
- **Where:** `ui/AppUi.kt` `AddAccessoryDialog` (opening form, ~15 fields) and `FormDialog` (uses `AlertDialog`); `ui/fields/ElementMeasureFields.kt` (`remember`, not `rememberSaveable`); `MeasurementStartCard` → `HeightSweepDialog` / `FutureChangesDialog` (local `mutableStateListOf`, saved only on confirm).
- **Scenario:** Surveyor fills in a door/window (offset, width, height, sill, wall thickness, frame thickness, reveal, leaf, mode, hinge, swing, glazing…) then taps outside the dialog, presses Back, or the tablet rotates.
- **Consequence:** `AlertDialog` dismisses on scrim-tap/back and all field state (plain `remember`) is discarded — the whole opening must be re-measured. The height-sweep and future-changes dialogs build a local list and persist only in `onConfirm`; a scrim-tap loses every entered ceiling height.
- **Fix:** Use `rememberSaveable` for in-progress field state; set `AlertDialog` `properties = DialogProperties(dismissOnClickOutside = false)` for data-entry dialogs; or persist drafts incrementally.

---

## P1 — Logic bugs

### P1-1 · Wall height is never measured but always validated as present
- **Where:** all wall-creating paths pass `Prefs.defaultWallHeightMm` (2700): `MeasureHost`/`DrawScreenHost`/`SemiAutoHost`/`TemplateHost`/`P2PHost` in `ui/AppUi.kt` (e.g. `repo.addWall(roomId, w.length, if (w.height > 0) w.height else Prefs.defaultWallHeightMm, w.angle)`); `Prefs.kt` default 2700. Validation: `fit/RoomValidator.kt` `MISSING_HEIGHT` fires only on `height <= 0.0`; `VerificationScreen` "each wall has height" checks `height <= 0.0`.
- **Scenario:** Surveyor draws a room via live-measure/template/semi-auto/P2P (the normal flows) and never opens the per-wall height editor. There is in fact **no height-edit path** outside the manual "+ new wall" dialog — `CadDimensionEditor` edits only length/angle; `WallHeadWallHost` saves head-style only.
- **Consequence:** Every wall silently carries 2700 mm. Because the default is `> 0`, `MISSING_HEIGHT` never fires and the checklist shows "all walls have height ✓". The measured ceiling **height-sweep** (`RoomSurvey.bindingHeight` = min) is stored at room level and exported, but **never applied to `wall.height` and never reconciled** — the `.sol` ships wall `height_mm: 2700` even when the sweep measured 2650. The completeness signal is an illusion and the exported heights can be wrong.
- **Fix:** Distinguish "unmeasured" from "defaulted" (e.g. `heightMeasured: Boolean` or sentinel), and either apply the room binding-height to walls or require an explicit per-wall height confirmation before the gate passes.

### P1-2 · Openings measured "from the right corner" are stored/rendered as left-based
- **Where:** `ui/fields/ElementMeasureFields.kt` `OpeningMeasureFields`: `fromLeft = offset.value.toMm()` is written **regardless of** the `fromCorner` toggle (start/end). `ui/canvas/RoomPlanCanvas.kt` draws each accessory at `acc.fromLeft.coerceIn(0f, wall.length)` measured from the wall's **start** vertex. `export/SolWriter.kt` `openingBlock` does carry `fromCorner` + `offset` for the converter.
- **Scenario:** Surveyor selects "from the right corner (מהפינה הימנית)" and enters e.g. 300 mm.
- **Consequence:** The stored `fromLeft` is 300 (a right-offset) but the in-app plan and 3D views place the opening 300 mm from the **left** vertex — mirror-wrong. The app's own geometry and any `fromLeft`-based logic are inconsistent with the surveyor's intent; only the converter (which reads `fromCorner`) is correct, so the on-screen preview disagrees with the converted drawing. Note the non-opening `ElementMeasureFields` handles corners correctly (offset-left / offset-right / center); only the parametric opening form has this defect.
- **Fix:** Normalize at entry: when `fromCorner == "end"`, store `fromLeft = wallLength - offset - width` (mirroring the non-opening path), or make all consumers `fromCorner`-aware.

### P1-3 · Completeness gate ignores entrance direction and ceiling height
- **Where:** `ui/verify/VerificationScreen.kt` (`buildChecklist` / `RoomValidator.validate` check only walls/closure/element width/depth). Entrance prompt in `ui/AppUi.kt` `MeasurementStartCard`: `val prompt = !entranceSet && wallCount == 0`.
- **Scenario:** Surveyor sets no entrance direction and measures no ceiling height, then proceeds to Verify → Export.
- **Consequence:** The gate reports "Ready to submit ✓". Entrance bearing is described in the data model as a required priority field ("the report draws an entrance arrow from it"), yet it is only *nudged* (amber card) while `wallCount == 0`; once any wall exists the nudge disappears and nothing ever re-checks it. Ceiling height (height-sweep) is likewise never gated. Surveys ship without either.
- **Fix:** Add non-blocking WARN (or blocking, per policy) checks to `RoomValidator`/checklist for "entrance direction set" and "at least one ceiling height measured".

---

## P2 — Missing validations

### P2-1 · No "opening fits the wall" check (width/position bounds)
- **Where:** `fit/RoomValidator.kt` (no width-vs-length rule); `ui/canvas/RoomPlanCanvas.kt` silently clamps `fromLeft.coerceIn(0f, wall.length)`.
- **Scenario:** A 1200 mm window entered on an 900 mm wall, or `fromLeft + width` past the wall end.
- **Consequence:** Accepted and exported; the canvas clamps the marker so it *looks* plausible, hiding the error. No warning to the surveyor. (Explicitly called out in the audit brief.)
- **Fix:** Add validator checks: `width <= wallLength` and `fromLeft + width <= wallLength` (accounting for `fromCorner`), as WARN or BLOCK.

### P2-2 · No overlap detection between elements/openings on a wall
- **Where:** `fit/RoomValidator.kt` — no adjacency/overlap rule. The duplicate-element button (`WallScreen`, `a.copy(id=0, fromLeft = a.fromLeft + a.width + 50)`) can also push copies out of bounds.
- **Consequence:** Two openings/sockets can occupy the same span with no flag; carpenter discovers the conflict downstream.
- **Fix:** Detect overlapping `[fromLeft, fromLeft+width]` intervals per wall and warn.

### P2-3 · Openings pass the gate with zero real field input (manufacturer defaults)
- **Where:** `ui/fields/ElementMeasureFields.kt` `OpeningMeasureFields` pre-fills `width`/`height`/`frameThickness`/… from `spec` (manufacturer catalog defaults, non-zero); `offset` defaults to empty → `fromLeft = 0`. Validation keys off `width > 0` only.
- **Scenario:** Surveyor adds a door and taps "Save" without measuring anything.
- **Consequence:** The element is created at position 0 with full manufacturer dimensions and **passes** the `MISSING_STATUS`/width gate — a completely un-measured opening reads as "measured". The gate is defeated by the defaults it was meant to catch.
- **Fix:** Track a "field-measured" flag distinct from the pre-filled default (e.g. require the surveyor to confirm/touch the offset and at least width/height), and require it before the gate passes.

### P2-4 · Impossible / unbounded dimensions accepted
- **Where:** `ElementMeasureFields` center-mode `fromLeft = center - w/2` (can be negative if center small/zero); regular elements accept `fromBottom/height/depth == 0`; only wall length > 30 m warns (`RoomValidator` `SUSPECT_LENGTH`).
- **Consequence:** Negative positions, zero heights, and out-of-range opening dimensions are stored without sanity checks.
- **Fix:** Clamp/validate non-negative positions and add upper/lower sanity bounds for opening width/height/sill.

### P2-5 · Manual "+ new wall" always assumes a 90° turn
- **Where:** `ui/AppUi.kt` `RoomScreen` FAB → `repo.addWall(roomId, l, h)` (2-arg) → `WallEntity.angle` default 90.0.
- **Scenario:** Surveyor builds a non-rectangular room by manually adding walls.
- **Consequence:** Every manually-added wall turns 90°, so any non-orthogonal room cannot be represented this way and its closure-gap check is computed against a false geometry. (The live-measure/CAD/P2P paths do let you set the angle; the manual add does not.)
- **Fix:** Add an angle field to the manual add dialog, or route manual adds through the same angle-aware capture.

---

## P2/P3 — Data integrity & friction

### P2-6 · No cascade delete — orphaned rows accumulate
- **Where:** `data/Entities.kt` (no `@ForeignKey`), `data/SolineDao.kt` (`deleteProject`/`deleteAccessory` are plain `@Delete`; `deleteLastWall` deletes only the wall row). Verified: `grep ForeignKey|CASCADE data/` → no matches.
- **Scenario:** Delete a project, or undo a wall that already has accessories.
- **Consequence:** Rooms/walls/accessories/cabinets/level-points belonging to a deleted project (and accessories of an undone wall) remain in the DB forever as orphans. Harmless to active queries (scoped by id) but a growing leak, and undo-then-orphan is a correctness smell.
- **Fix:** Add `@ForeignKey(onDelete = CASCADE)` relations or explicit cascading deletes in `Repo`.

### P3-1 · Pending laser reading & view state lost on rotation
- **Where:** `ui/measure/MeasureCaptureScreen.kt` — `pendingLenMm`, `customTxt`, `userScale`, `panX/panY` are `remember` (not `rememberSaveable`).
- **Consequence:** A rotation/config-change drops the just-shot pending wall length and resets the view. Committed walls are safe (persisted on add); only in-flight state is lost. Low frequency on a mounted tablet, but painful on-site.
- **Fix:** `rememberSaveable` for pending capture state.

### P3-2 · No middle-wall delete or reorder — only "undo last"
- **Where:** `MeasureCaptureScreen` `onUndo` → `deleteLastWall` (highest idx). No per-wall delete on `WallScreen`.
- **Consequence:** To fix a wrong wall placed mid-run, the surveyor must undo everything after it and re-measure. Also, `addWall` uses `idx = wallCount`; this stays consistent only because deletes are last-only — a latent idx-collision risk if middle-delete is ever added.
- **Fix:** Allow per-wall edit/delete with idx re-normalization.

### P3-3 · Level-survey "no-angle" marker is in-memory only
- **Where:** `ui/level/LevelSurveyScreen.kt` `noAngleIdx = remember { mutableStateListOf() }`.
- **Consequence:** The "measured without vertical angle (≈ fallback)" flag on a floor/ceiling point is lost on navigation away, so the reliability caveat disappears from the record (compounding P0-1, where the survey isn't exported at all).
- **Fix:** Persist the no-angle flag on `LevelPointEntity`.

### P3-4 · First wall orientation is decoupled from the entrance bearing
- **Where:** `geometry/WallBuilder.layout` always starts heading `+X`; entrance bearing is stored but never orients the drawing.
- **Consequence:** The plan's absolute orientation is arbitrary vs. the recorded entrance direction; the entrance arrow (drawn downstream from `entranceBearingDeg`) may not align with how the surveyor perceived the room.
- **Fix:** Optionally rotate the layout so wall 0 / entrance matches the bearing, or clearly document that bearing is metadata only.

---

## What is correct (so it isn't "fixed" by mistake)

- **Order safety:** elements/openings are reachable only from an existing wall (`WallScreen` via `wall/{wid}`), so "element before any wall" is structurally prevented.
- **Blocking gate exists and works** for: missing wall length, unmeasured element width (`MISSING_STATUS`), fewer than 3 walls, and unclosed contour beyond T-join tolerance (`RoomValidator` + `VerificationScreen`; export button disabled until clean).
- **Laser one-shot capture** (`numField`/`LaserNumField`, `armedFrom`) correctly prevents a continuous-stream device from flooding a focused field.
- **Closure geometry** (`WallBuilder.layout` + `closingGap`) is a single source of truth shared by capture, validator, and verification — consistent CCW `heading += angle` convention.
- **Units are consistent** (mm end-to-end; angles in degrees; `units:"mm"` in the manifest); the CM setting is display-only and does not touch storage.
- **Floor/ceiling Z math** (`FloorLevelSolver`, `Z = d·sinθ`, deviation vs. a fixed-station zero) is sound and sign-consistent — the weakness is that its output never reaches the export (P0-1).

---

## Recommended priority order for the app-lane fix pass

1. **P0-1** — stop silently dropping measured data at export (wall-head, frame points, floor/ceiling survey). Biggest surveyor-trust issue.
2. **P1-1** — make wall height a real measured value, not a default that fakes completeness.
3. **P1-2** — fix right-corner opening placement.
4. **P1-3 / P2-3** — close the completeness-gate holes (entrance, ceiling height, un-measured openings).
5. **P2-1 / P2-2** — opening-fits-wall and overlap validations.
6. **P0-2 / P2-6 / P3-*** — input-loss hardening, cascade deletes, undo/rotation robustness.
