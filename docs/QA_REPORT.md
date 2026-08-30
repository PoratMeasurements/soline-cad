# QA Report — Soline Measurement App (code-level review)

Scope: recently-rebuilt files — `UnifiedMeasureScreen`, `JobIntakeScreen`, `MyBugsScreen`,
`RetestSync`, `BackupSync`, `ClientsStore`, `AppUi` — plus their collaborators
(`WallBuilder`, `RoomPlanCanvas`, `Repo.addWall`, `MeasureCaptureScreen`, `LaserBle`, `Prefs`).
Review only — no code changed. "Line" = file line at review time.

## Severity summary
- Critical: 1
- High: 1
- Medium: 3
- Low: 5

---

## Ranked findings

| # | Sev | File:line | Issue | Concrete failure scenario | Fix direction |
|---|-----|-----------|-------|---------------------------|---------------|
| 1 | **Critical** | `ui/unified/UnifiedMeasureScreen.kt:92` (+ AngleChips 134/152/223) | Wall-add angle convention is broken/off-by-one. `addWall` forces `if (walls.isEmpty()) 0.0 else angle` and stores the picked turn on the **new** wall, but `WallBuilder.layout` applies `wall[i].angle` as the turn **after** wall i (corner between wall i and i+1). So wall 1 & wall 2 are always drawn collinear, the corner between the first two walls can never be set, and every chosen angle lands on the wrong corner (one wall late). The working screens (`MeasureCaptureScreen`→`MeasureHost` `repo.addWall(...,ang)`) do NOT force first=0 — Unified regressed this. | Measure a rectangle (a,b,a,b) with three 90° picks: outline never closes (P_last ≈ (a,a), gap = a·√2). Any L-shape/room with ≥2 walls draws wrong geometry silently, and the bad outline flows into export/report/.sol. | When adding wall N≥2, write the picked turn to the **previous** wall (`repo.updateWall(prev.copy(angle=picked))`) and give the new wall a neutral default; or drop the `first→0` forcing and let wall 1 carry a turn like the capture screen does. |
| 2 | **High** | `ui/unified/UnifiedMeasureScreen.kt:229-230` | Angle chip labels invert the geometric turn. "↱ ימינה 90°" = `+90`, "↰ שמאלה 90°" = `-90`, but `WallBuilder` treats **positive = CCW (left)**. So "right" turns left and vice-versa in the plan. Compounds #1. | Surveyor picks "ימינה" expecting a clockwise corner; the top-view bends the opposite way. | Swap the values (ימינה = -90, שמאלה = +90), or relabel to match the CCW-positive convention; verify against `RoomPlanCanvas` orientation. |
| 3 | Medium | `ui/unified/UnifiedMeasureScreen.kt:294,309-312` | Movable tool-rail drag `onDragY = { railY += it }` has no bounds/clamp. Dragging the expanded rail far past the top/bottom moves it off-screen; the collapse handle shares the same `offsetY`, so the rail (and all mode switching) becomes unreachable until the screen is left (railY is `remember`, not saved, so exit resets it). | User flings the rail off-screen mid-measurement → cannot change mode / collapse until navigating away and back. | Clamp `railY` to the canvas height (e.g. `coerceIn(-h/2, h/2)` in px), or reset on double-tap. |
| 4 | Medium | `ui/unified/UnifiedMeasureScreen.kt:339,216-217` vs `data/Prefs.kt:235` | Laser readout & add-button always format cm (`cm()` hardcodes `%.1f` mm/10 and the tag hardcodes `ס"מ`), ignoring the MM/CM unit setting, while the TAPE field and `Prefs.parseToMm` are unit-aware. | With units=MM: tape input is parsed as mm, but the live readout and "הוסף קיר · N ס\"מ" show cm — mismatched units confuse the surveyor. | Route the laser readout/add label through `Prefs.formatLen`/`lenValue` instead of the local `cm()`. |
| 5 | Medium | `ui/intake/JobIntakeScreen.kt:216-218` | Hebrew label typo: `"מודד גובה… (מדוד עכשiv)"` — `עכשiv` contains Latin letters (should be `עכשיו`). Appears in all three auto-capture states. | Visible garbled text on the elevator auto-measure button during capture. | Replace `עכשiv` → `עכשיו` (3 occurrences). |
| 6 | Low | `ui/intake/JobIntakeScreen.kt:225-227` | Manual `📡` buttons in `LaserDimRow` set `elevH/W/D = laserCm()` but do NOT update `elevLastReading`. If auto-capture is armed (`elevActiveDim ≥ 0`), the same reading can then also be auto-consumed into the next field. | Edge double-entry when mixing manual 📡 taps with the auto-capture flow. | Have the manual tap also set `elevLastReading = reading` (and/or not fire while auto is armed). |
| 7 | Low | `ui/bug/MyBugsScreen.kt:81` | Global-serial fallback `if (gSerial>0) gSerial else n-i` can collide: a bug with published serial `k` and another with fallback `n-i == k` show the same `#000k`. | Two cards display identical `#0003` (display only — `key = it.id` is unique, so no crash). | Use a fallback that can't overlap the global range (e.g. negative/offset), or hide `#` when no global serial. |
| 8 | Low | `data/BackupSync.kt:34-45` | Two different projects with the **same name** under the same client folder resolve to the same `[client]/[projName]/` dir and same `solName`; `deleteChildByName` then overwrites the other project's `.sol`. | Client "מטבחי X" with two projects both named "לקוח כהן" → second backup overwrites the first. | Disambiguate the folder/file (append project id or created-date) when names collide. |
| 9 | Low | `ui/unified/UnifiedMeasureScreen.kt:126` | `RoomPlanCanvas(accessoriesByWall = emptyMap())` — the unified canvas never shows accessories/openings even after they exist, unlike `Room3DHost`/`WallScreen` which build the reactive map. | Surveyor adds a socket/window (element mode) but the single-canvas plan never renders it. | Feed `rememberAccessoriesByWall(walls)` into the canvas (already exists in `AppUi`). |
| 10 | Low | `data/RetestSync.kt` / `data/BackupSync.kt` (JSON/`%.1f`) | `RetestSync` write uses `Locale.US` for dates (good), but `Prefs.lenValue`/local `cm()` use default-locale `String.format` — safe on he_IL (period), but a comma-decimal locale would emit "1,5". These strings feed `accessNotes` (display-only, not re-parsed), so impact is cosmetic. | On a comma-decimal locale, elevator dims render "ג1,5×…". | Use `Locale.US`/`ROOT` in the numeric `String.format` calls for consistency. |

---

## Looks-correct / verified-safe

- **Backup folder resolution (project.client = factory).** `JobIntakeScreen` packs `clientCompany = factory`; `IntakeHost` calls `repo.addProject(clientName, clientCompany)` so `project.client` = factory; `BackupSync.backupProject` looks up `ClientsStore.get(context, project.client)` and falls back to `Prefs.backupTreeUri` then `Result.NoFolder`. Chain is consistent; blank factory correctly falls through to the general backup folder.
- **RetestSync SAF/cursor handling.** All `query`/`openInputStream`/`openOutputStream` use `?.use{}`, null-guard the doc lookup, and wrap in `try/catch → empty`. Revoked SAF permission or missing file degrades to empty rather than crashing. `respondedSet` filtering (`id|version` key) correctly hides answered items yet lets a re-issued retest (new version) reappear; `markResponded` is only called after a successful write.
- **Elevator laser auto-capture reference-equality.** `Reading` carries a monotonic `ts`, so each scan is a distinct object even at the same distance → `StateFlow` re-emits → `reading !== elevLastReading` advances exactly once per shot. Baseline is seeded on button press (`elevLastReading = reading`), preventing immediate consumption of the stale reading; advances height→width→depth→off correctly.
- **`HeightSweepDialog` / `numField` laser capture.** Use `ts > armedFrom` gating (not reference equality) — correct re-armable one-shot; `LaunchedEffect(connected)` disarms on disconnect.
- **`MyBugsScreen` recomposition.** IO load off the main thread via `withContext(Dispatchers.IO)`; `null`/empty/list states handled; `LazyColumn` with stable `key = it.id`; archive persisted in SharedPreferences and merged into the active/archived split.
- **`RoomScreen` scroll fix.** Root is `Column(...verticalScroll(...))` with walls rendered via `Column{ forEach }` (no `LazyColumn` nested in a scrolling `Column`) — the earlier non-scroll/nested-scroll bug is not present here. `ProjectRoomsScreen` uses a top-level `LazyColumn` (also safe). `MeasureStartHost` is `verticalScroll` + card (safe).
- **Mode switching preserves the outline.** All four modes read the same `repo.walls(roomId)` flow; switching modes only swaps the bottom panel, never the canvas — matches the stated single-outline design goal.
- **`ClientsStore` upsert/get.** Case-insensitive de-dupe on upsert, alphabetical sort on read, malformed-JSON guarded to empty.
- **Export gate + IO.** `runExport` builds the `.sol` and runs `BackupSync` on `Dispatchers.IO`, keeps share intent on Main, and backup failure does not block submission.

---

## Notes / non-blocking
- Findings #1–#2 are the same subsystem (the new add-wall geometry) and should be fixed and tested together against `RoomPlanCanvas` output for a known rectangle and an L-shape.
- Many now-removed features (edit-dimensions, wall-head, symbols, fit-check, template) still have live routes/imports in `AppUi.kt` (e.g. `symbols`, `wallhead`, `template`, `CadDimensionEditor`). Not bugs, but dead-route cleanup would reduce surface area — verify none are still reachable from the surveyor flow before removing.
