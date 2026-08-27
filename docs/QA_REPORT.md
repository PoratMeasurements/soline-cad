# QA_REPORT — Soline whole-project QA pass

- **Date:** 2026-08-24
- **Reviewer:** QA agent (Claude), read-only analysis (no code edited; only the converter pipeline + selfTests were run).
- **Scope:** `converter/` (pipeline, exporters, selfTests, recent R12-DXF / Hebrew-layers / symbols / openings / CTB changes), `app-measure/` (Kotlin static scan, Room migrations, recent features), docs/state consistency, cross-format coverage.
- **Note:** A separate, older converter-only report lives at `converter/docs/QA_REPORT.md` (2026-08-14). This file is the current whole-project pass.

---

## Executive summary

**What actually runs is healthy.** The unified converter runs clean, all six formats produce for valid input, and every exporter selfTest passes.

- `node soline_convert.js <input>` (single-file path) produced **all 6 formats** — ORDX, PDP, DXF-2D, DXF-3D, HTML, and a fully-rendered PDF (1.8 MB via headless Edge). Verified on `2918_Ktchn_TRIO_Nir_DR1.ordx`.
- **All 7 exporter selfTests PASS:** `export_dxf3d`, `export_dxf2d`, `export_ordx`, `export_dxf_pro`, `writePdpDR`, `injectSupp`, `injectNativeItem`.
- **CTB build** (`templates/ctb/build_soline_ctb.js`) validates: 255 styles, ALL PASS.
- **Kotlin app:** no P0/P1 found statically. Room DB is at v9 with a complete, wired migration chain 1→9 (7→8 and 8→9 both present). All five recent features (openings field-measure, entrance, heightSweep, futureChanges, consent-location) are defined AND used.

**Counts by severity:** P0 = 0 (confirmed-broken) · P1 = 3 · P2 = 8 · P3 = 10.

**Broken vs. merely unfinished:**
- **Nothing reproducibly broken** in this environment. The pipeline never aborts; each format is independently try/caught.
- **The real risk lives in two things this environment cannot verify:** (1) PDP loading in Raumplan (session log records a persistent, un-located **921** error on `allelem_master.pdp`), and (2) DXF opening in AutoCAD (v8 rejected; v9/v10 "awaiting AutoCAD check"). The converter's auto-verification only checks file *structure*, so it greenlights (✓) files that the real target applications may still reject. Treat every PDP/DXF ✓ as "structurally valid, load-check pending."
- **One genuine data-loss bug** is reproducible here: PDP silently **drops items** when no base template with enough slots exists for the room's wall count (the `בדיקה` corpus file: 2 of 3 items dropped → PDP ✗).
- Everything else is **unfinished/gap** work (stubbed BLE hardware, un-integrated openings module, coverage backlogs) or **cleanup** (hardcoded paths, dead code, stale doc counts).

---

## P0 — Broken (0 confirmed)

No pipeline crash or hard failure was reproducible. Two items are **potential P0 but unverifiable in this environment** — flagged here so they are not lost:

- **PDP Raumplan load (921).** `converter/SESSION_STATE.md:36-37` records `allelem_master.pdp` returning **921** in Raumplan with the cause "טרם אותר" (not yet located) and the crack agent stopped. `converter/VERIFICATION_REPORT.md:96` (today) claims the real-base method yields "no 921." These flatly contradict. Cannot run Raumplan here — **needs Michael's manual load-check** before any PDP is called done.
- **DXF AutoCAD load.** `SESSION_STATE.md:14,38` shows v8 rejected and v9/v10 awaiting AutoCAD. The queued `ascii→latin1` fix referenced there is **already applied** (`soline_convert.js:427,436` both write `'latin1'`), so that specific blocker is resolved in code — but an actual AutoCAD open is still unconfirmed.

---

## P1 — Bugs

### P1-1 · PDP silently drops items when no base has enough slots
- **File:** `converter/src/writePdpDR.js:242-246` (`loadBase`), drop logic at `:713-716`.
- **What's wrong:** `loadBase` picks a base by exact wall-count first. If the same-wall base has too few item slots, it does **not** fall back to a bigger-wall base with more slots — it keeps the too-small base and drops the overflow items. The bigger-wall fallback (`:248-252`) only fires when *zero* same-wall bases exist. Reproduced: `בדיקה.ordx` (2 walls, 3 items) → only `wall2_oc1.pdp` (1 slot) exists → **2 of 3 items DROPPED**, `countsConsistent:false`, PDP marked ✗. This is the single ✗ in `VERIFICATION_REPORT.md`.
- **Impact:** Silent geometry loss for any room whose wall-count base is under-provisioned. Corpus kitchens (4-9 walls) happen to have well-sized bases, so it's masked there; it bites small/synthetic rooms.
- **Suggested fix:** When the best same-wall base still can't fit the items, compare against the bigger-wall candidates and pick whichever base maximizes slot coverage (fewest dropped items), not the exact wall match. Or add a `wall2_ocN` base with enough slots. At minimum, escalate a dropped-item warning to a hard error so `--all` surfaces it loudly.

### P1-2 · PDP injector can throw `RangeError` on out-of-int16 coordinates/dims
- **File:** `converter/src/inject.js` (`writeInt16LE` in `buildMep`/`writeDims`). Carried over from `converter/docs/QA_REPORT.md` bug #4, still "reported, not fixed."
- **What's wrong:** Huge coordinates/dimensions overflow int16 and throw. It's caught by the per-format try/catch in `convertOne`, so it degrades to `pdp=ERR` (other 5 formats survive) — but the PDP is lost with a raw exception message rather than a clean skip.
- **Suggested fix:** Range-check against int16 bounds before writing and skip-with-clear-message (or clamp) instead of throwing.

### P1-3 · Auto-verification reports ✓ on structure only — overstates PDP/DXF readiness
- **File:** `converter/soline_convert.js` `verifyOne` (`:510-558`) and the report writer (`:565-621`).
- **What's wrong:** PDP ✓ is derived from structural self-consistency (`footerOk && tailOk && bodyLoadable && countsConsistent && segCountOk`, `:549`); DXF ✓ from group-code pairing/sections/EOF. Neither can detect the real 921 (Raumplan) or AutoCAD-load failures. The report's own footnote says PDP ✓ = "structure valid, NEEDS RAUMPLAN LOAD-CHECK", but the top summary table shows a bare ✓, which reads as "passed." Combined with `VERIFICATION_REPORT.md:96`'s "no 921" claim contradicting `SESSION_STATE.md:36-37`, a reader is misled about actual load-readiness.
- **Suggested fix:** Render PDP/DXF marks as a distinct "◐ structure-ok / load-check pending" glyph (not ✓) until a real load is confirmed, and reconcile the "no 921" wording in `VERIFICATION_REPORT.md` with the open session-log status.

---

## P2 — Gaps (declared/expected but not done)

### P2-1 · `blocklib/openings` module is NOT integrated into the converter
- **File:** `converter/blocklib/openings/build_preview.js:117` states explicitly: integration to the converter (`export_dxf2d` / `export_dxf_pro`) via `opening_schema.js` — **"לא בוצע"** (not done).
- **Note:** There are two openings systems. `converter/src/opening_schema.js` **is** wired into both DXF exporters (`export_dxf2d.js:85,1156-1181`, `export_dxf_pro.js:74,920`) — that path works. The separate `blocklib/openings/openings_module.js` (Soline-original door/window/HVAC symbols + preview) is standalone and unused by the pipeline. Gap: its original symbols never reach exported drawings.

### P2-2 · BLE laser connect path is stubbed for both devices
- **Files:** `app-measure/.../device/BoschGlm50Device.kt:58,89,98,107` and `device/LeicaDistoX6Device.kt:59,93,102` — `TODO(GATT)` for `connectGatt`, `discoverServices`, CCCD write, enable command.
- **Impact:** Live measurement from the Bosch GLM50 / Leica DISTO X6 is declared but the real GATT handshake is not implemented. `SESSION_STATE`/`HANDOFF` note X6 connection "מקרטע … לא אומת חי" (flaky, not verified live).

### P2-3 · No committed Gradle wrapper
- **File:** `app-measure/` — no `gradlew`, `gradlew.bat`, or `gradle/wrapper/`. Build relies on a system Gradle 8.9 (`BUILD_SETUP.md:11,21`). Hurts reproducibility. Note: the app **cannot** be built from the Google Drive path (`BUILD_SETUP.md:3-5`); it is copied to `C:\android-dev\soline-measure` first, so it was not buildable/testable in this environment.

### P2-4 · `fallbackToDestructiveMigration()` is a silent data-loss net
- **File:** `app-measure/.../data/SolineDatabase.kt:220`. On any unhandled schema mismatch it wipes user data — at odds with the stated priority of never losing Michael's measurements. Intentional per code comment, but worth replacing with `fallbackToDestructiveMigrationOnDowngrade()` once the 1→9 chain is trusted.

### P2-5 · Element coverage still open (from `converter/docs/ELEMENT_COVERAGE_MATRIX.md`)
Header claims 97 types / 0 DXF-2D symbol gaps; real gaps in the other formats:
- **PDP:** 22 types have **no bin** (marked ✗) — the whole HVAC/ventilation family (`AC_INDOOR/CASSETTE/CONCEALED/CONDENSER`, `MAMAD_AIR_VALVE`, `VENT_GRILLE`, `EXHAUST_FAN`, `RANGE_HOOD_DUCT`, `BOILER_FLUE`, etc.) plus `DOOR_ENTRANCE`, `DOOR_DOUBLE` (matrix `:192-216`).
- **DXF-3D:** 31 types want a real mesh body (currently a box); 11 lack W/H for even a box (`CEILING_DROP`, `COLUMN`, `NOTE`, `STICHMASS`, `FUTURE_CEILING`, …) (matrix `:187-190`).
- **ORDX:** 54 types share non-unique `<Name>` (e.g. `DishWasher` ×19, `Window` ×10, `Air Condition` ×5) — re-import cannot distinguish them (matrix `:168-185`). Fix owed is app-lane (unique ordxName per type).

### P2-6 · `--all` self-check verifies only 4 of the 6 formats
- **File:** `converter/soline_convert.js` — `runAll` (`:626-643`) calls `convertOne` (4 CAD formats). HTML/PDF are only produced/reported by the single-file `convert()` (`:464-493`). So the morning `VERIFICATION_REPORT.md` never exercises HTML or PDF across the corpus. Product docs advertise "6 formats" while the batch verification and `EXPORT_ALL_FORMATS.md` describe 4 — see P3 doc-consistency.

---

## P3 — Cleanup

### P3-1 · Hardcoded absolute paths
- `converter/soline_convert.js:50` `ORDX_DIR = 'G:/My Drive/קבצים ללמידת מכונה/ORDX/'` — the `--all` corpus run only works on Michael's machine.
- `converter/soline_convert.js:51` `PDP_DIR = '…/PDP/'` — **dead code** (defined, never referenced; confirmed single occurrence).
- Dev/selftest paths: `injectSupp.js:30` (`PAIR_DIR`), `export_ordx.js:595`, `writePdpDR.js:874-875,921-922` — hardcoded corpus/GT paths in selfTest/CLI blocks. Acceptable for local selftests but brittle; consider env var or arg.

### P3-2 · Dead code
- `PDP_DIR` (above).
- `converter/src/inject.js:27-30` — `BUMPS` constant defined and unused (carried from prior QA #7).

### P3-3 · Silent catch blocks without logging (app)
- `app-measure/.../data/CustomElementStore.kt:129-131` — parse failure returns `emptyList()` silently (hides corrupt custom-element JSON); add a `Log.w`.
- `app-measure/.../ui/AppUi.kt:769` — swallows exception, returns `emptyList()`, no log.
- (Converter: empty catches in `export_pdf.js:1686,1694,1740` are benign best-effort cleanup — acceptable.)

### P3-4 · Stale doc counts / done-vs-open contradictions
- `elements.json` actually has **170** elements (verified) and `symbols.json` **170** keys; `converter/docs/STATUS.md` still says 83/131 (prior QA bug #8, "reported" not fixed).
- `ElementCatalog.kt`: 63 (`HANDOFF-measure.md:24,65`) vs 97 (`ELEMENT_COVERAGE_MATRIX.md:3,7`).
- Room DB version: docs say v3 (`HANDOFF-measure.md:20`, `PROJECT_MASTER.md:47`) vs actual **v9**.
- `.kt` file count: 59 (`README`/`WORK_PLAN`/`HANDOFF`) vs 45 (`PROJECT_MASTER.md:55`).
- "6 formats" (product docs) vs "4-format pipeline" (`STATUS.md:29-31`, `EXPORT_ALL_FORMATS.md:15-22`, `VERIFICATION_REPORT.md`). State plainly: `soline_convert.js` single-file emits 6; the batch/verification path covers 4.
- HTML report logo is still a CSS placeholder (`app-measure/SELF_INITIATED_DECISIONS.md:6`) despite "PDF+HTML הושלם ונמסר" phrasing (`SESSION_STATE.md:90`).

### P3-5 · Encoding / robustness (converter, prior QA #6)
- `\U+` escape for code points > U+FFFF (emoji) emits 5 hex digits / half-surrogates AutoCAD doesn't expect: `soline_convert.js` `heU` (~L132), `export_dxf3d.js` `heToDxfUnicode` (~L26). Hebrew (BMP) unaffected; only exotic chars in names. Structurally harmless.

### P3-6 · Fragile (but currently guarded) `!!` in app
- `app-measure/.../ui/measure/MeasureCaptureScreen.kt:260` — `pendingLenMm!!` re-reads the live `mutableStateOf` inside a Canvas draw lambda after a snapshot; theoretical null race if cleared mid-recompose. Capture into a local before the draw block. Other 7 `!!` sites are all guarded (low risk).

### P3-7 · Frozen/paused open items (tracked, not bugs)
- Cabinets/block-library mzcycle-1 frozen by owner request (`WORK_PLAN.md:54`, `blocklib/docs/00_INDEX.md`: "STAGE 1 — DOCUMENTS ONLY").
- Toilet (`אסלה`) PDP symbol not yet decoded; ambiguous PDP anchors (gas/lighting/water/sewage/toilet/combined-water) awaiting calibration from a Michael sample (`SESSION_STATE.md:36,41`).

---

## Verification evidence (this run)

- **6-format single-file run** (`2918_Ktchn_TRIO_Nir_DR1.ordx`): ORDX ✓, PDP ✓ (structural), DXF-2D ✓, DXF-3D ✓, `_report.html` written, `.pdf` rendered (1.83 MB, Edge headless). All files present on disk with non-trivial sizes.
- **Corpus `--all`:** 6/7 files fully ✓; `בדיקה` PDP ✗ (P1-1 item-drop). Others: 2D/3D/ORDX/PDP all ✓.
- **selfTests:** all 7 PASS (see summary).
- **CTB:** `SOLINE-Color.ctb` / `SOLINE.ctb` validate, ALL PASS.
- **_LATEST/ currency:** present and populated (DXF v6–v11, latest v11 dated 2026-08-24; PDPs, PDF, HTML, both CTBs, install guide). `_LATEST/README.md` still points Michael at older probe/v6 files with ⏳ load-check statuses — slightly behind the v11 outputs now in the folder (P3 doc-currency).
