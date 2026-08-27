# PDP Per-Type Anchor Table — the Soline ↔ Raumplan library anchor contract

**Status:** corpus-derived (mimran-1..9), byte-exact where proven. **Needs an owner Raumplan
load-test** to confirm the regenerated `allelem_rich.pdp` renders correctly, and a small
**calibration `.pdp`** for the handful of ambiguous/uncorpused types listed at the end.

Owner: converter agent. Consumed by `src/writePdpDR.js` (`collectItems` / `itemAnchor`) and
the PDP section of `soline_convert.js`.

---

## The rule

When the Soline app's `OrdxExporter` places an item on a wall it exports the item's **lower-left
CORNER along/up the wall**: `Position.X = fromLeft`, `Position.Y = fromBottom`. Raumplan (InnoDraw)
then stores, in the 173-byte object record at `@0x85` (X) / `@0x87` (Y) / `@0x89` (Z, up-the-wall,
−20000 bias), **one of two points depending on the element TYPE — not a single global rule**:

- **CENTER-anchored** — the small MEP **point symbols** that carry a **dashed center-dimension
  line** in Raumplan. Their record stores the item's **CENTER**: `along = corner + W/2`,
  `up = corner + H/2`.
- **OFFSET-anchored** — openings, fixtures and line/infra symbols dimensioned to their **edge**
  (no dashed center-dim). Their record stores the **raw CORNER**: `along = corner`, `up = corner`
  (no half-dimension added).

The anchor is keyed on the element **TYPE**, not the symbol code: e.g. `ק.חשמל` (power box, code 3)
is OFFSET but shares code 3 with `שקע` (socket, CENTER); `חלון` (window, code 5) is OFFSET but
shares code 5 with `ברז` (faucet, CENTER). So a per-code rule would be wrong — it must be per type.

### Why the previous blanket "always center" was wrong
Adding `W/2, H/2` to *every* item put the OFFSET types ~`W/2` off their measured point — invisible
for an 80 mm socket (40 mm) but a **gross ≈450–500 mm error** on a 900 mm door / 1000 mm window /
1000 mm channel. Per-type anchoring reproduces those corpus records **to the byte**.

### Corpus proof (own-base position rewrite, all 9 mimran files)
| anchor side | before (blanket center) | after (per-type) |
|---|---|---|
| CENTER types byte-exact incl. position | 66 / 73 | **66 / 73** (no regression) |
| OFFSET types byte-exact incl. position | **0 / 64** | **21 / 64** |

The 21 offset byte-exacts are every large opening (door/window/shutter box/channel/power box) where
the anchor is the only variable. The remaining offset non-exacts are (a) tiny MEP points whose only
residual is a few-mm **into-wall depth** on the perpendicular Y axis — orthogonal to the along/up
anchor and not modelled here — and (b) greedy item→slot mis-pairing among identical repeated items.
The 7 center non-exacts are pure greedy mis-pairing (identical sockets), not an anchor error.

`selfTest()` guards both sides:
- **CENTER guard** — mimran-5 (2 `שקע` + `ברז`) stays ≥3 records byte-exact incl. position.
- **OFFSET guard** — mimran-1 door **and** window reproduce byte-exact via the raw-corner anchor
  (a check the blanket-center code could never pass: it scored 0 there).

---

## The table

`W`,`H` = ORDX footprint (along-wall width, up-wall height). "dashed center-dim" = the item carries
Raumplan's dashed center dimension line (the owner's diagnostic for CENTER anchoring).

### CENTER-anchored (record stores `corner + W/2, H/2`) — corpus-PROVEN

| Type (he) | meaning | code | dashed center-dim | corpus evidence |
|---|---|---|---|---|
| `שקע`     | socket / outlet      | 3 | yes | n=59 across mimran-1..9; dAlong = W/2, dUp = H/2; mimran-5 both sockets Δ=0 (byte-exact) |
| `מפסק`    | switch               | 4 | yes | n=4 (mimran-6..9); dAlong=40=W/2, dUp=40=H/2 |
| `ק.בקורת` | junction / inspection box | 2 | yes | n=6 (mimran-4,6,8); dAlong=40, dUp=40, residual 0 |
| `ברז`     | faucet               | 5 | yes | n=4 (mimran-5,6); dAlong=10=W/2, dUp=10=H/2; mimran-5 faucet Δ=0 |

### OFFSET-anchored (record stores the raw CORNER) — corpus-PROVEN

| Type (he) | meaning | code | dashed center-dim | corpus evidence |
|---|---|---|---|---|
| `דלת`      | door / passage        | 1 | no | n=8 (mimran-1,2,3,6,7,8,9); dAlong=0, dUp=0, **byte-exact**; mimran-1 door Δ=0 |
| `חלון`     | window                | 5 | no | n=6 (mimran-1,3,7,8,9); dAlong=0, dUp=0, **byte-exact**; mimran-1 window Δ=0 |
| `ק.חשמל`   | power / product box   | 3 | no | n=7 (mimran-1,2,4,7,8,9); dAlong=0, dUp=0, residual ≤2 |
| `ארגז תריס`| shutter box           | 1 | no | n=5 (mimran-3,7,8,9); dAlong=0, dUp=0, **byte-exact** |
| `תעלה`     | channel / beam / structure | 1 | no | n=2 (mimran-6); dAlong=0, dUp=0, **byte-exact** |
| `חור.פ.ממד`| safety-room opening   | 1 | no | n=1 (mimran-1); dAlong=0, dUp=0, residual 2 |
| `אדן חלון` | window sill           | 1 | no | n=4 (mimran-3,7,8); along+up = corner (dAlong=0, dUp=0); residual is perpendicular depth |
| `ביוב קיר` | wall sewage           | 1 | no | n=6 (mimran-3,5,6,7); along(X)+up(Z) = corner exactly; only ~10 mm into-wall depth on Y |
| `פ.ביוב`   | floor drain           | 1 | no | n=3 (mimran-3,6); dAlong≈0, dUp≈0 |
| `צ.חשמל`   | power line / conduit  | 1 | no | n=8 (mimran-2,3,4,5); dAlong≈3, dUp≈3 (≈corner; 14 mm element, offset negligible) |

---

## Ambiguous / uncorpused types — **MOSTLY RESOLVED 2026-08-23** from the Rosetta file

**UPDATE (2026-08-23):** the owner supplied a real multi-format calibration export
(`elemets_Bar_Terra-Nova_Yosi_DR1.*` — 40 objects, 32 types). Decoding it and reading each type's
anchor on the **Z (up-the-wall) axis** (frame-invariant, so byte-clean) resolved most of this list.
Full decode + the master library table in **`docs/ELEMENT_LIBRARY_MASTER.md`**.

| Type (he) | meaning | code | prior guess | **RESOLVED** | evidence (Rosetta Z-axis) |
|---|---|---|---|---|---|
| `גז`       | gas point         | 6 | maybe CENTER | **CENTER** ✅ | Z cen-residual **0** (exact); 100×100 point, `ק.בקורת` family. **Added to `ANCHOR_CENTER`.** |
| `אנטנה`    | TV / antenna      | 3 | (new type) | **CENTER** ✅ | Z cen-residual 0 (exact); small MEP point. **Added to `ANCHOR_CENTER`.** |
| `טלפון`    | phone             | 4 | (new type) | **CENTER** ✅ | Z cen-residual 0 (exact); small MEP point. **Added to `ANCHOR_CENTER`.** |
| `תאורה`    | ceiling light     | 7 | OFFSET (uncertain) | **OFFSET** ✅ | Z off-residual ≈0 (one instance exact). Stays OFFSET. |
| `צ.מים`    | water line / pipe | 1 | OFFSET | **OFFSET** (immaterial) | block identical to `צ.חשמל`; 20 mm point, anchor within symbol width. |
| `ביוב`     | sewage (generic)  | 1 | OFFSET | **OFFSET** (immaterial) | 50 mm point; Z leans center ~25 mm but within symbol width. |
| `מים משולב`| combined water    | 15 | OFFSET | **OFFSET**, code 15 confirmed | large wet fixture. |
| `אסלה`     | toilet            | 7 | OFFSET | **still unresolved** | NOT in the Rosetta file (has `אמבט`+`בידה`, no toilet). `.bin` code 7 unverified — still needs its own sample. |

Only `אסלה` remains genuinely uncalibrated. To pin it, the owner draws one toilet in Raumplan at a
known corner offset and saves a `.pdp`; decode `@0x85/@0x89` vs the known corner — if CENTER, add it
to `ANCHOR_CENTER` in `src/writePdpDR.js`.

---

## Perpendicular — the 3rd position axis (into-room stand-off), decoded 2026-08-24

The anchor rule above fixes the ALONG and UP axes. There is a **third** axis the converter previously
**dropped entirely**: the item's **perpendicular distance off the wall face, into the room**.

**Where it comes from.** The app's `OrdxExporter` writes each placed item's `<Position>` as **three**
numbers, not two:

| ORDX `<Position>` | meaning | PDP field |
|---|---|---|
| `X` | along-wall distance from the wall **START** corner (mm) | drives stored `X/Y @0x85/0x87` via the along transform |
| `Y` | height **up** the wall (mm) | stored `Z @0x89` (`−20000` bias) |
| **`Z`** | **perpendicular distance the item stands off the wall face, INTO the room (mm)** | shifts stored `X/Y` along the wall's inward normal |

The old `parseOrdx` read only `X`,`Y`; every item was glued to the **wall centreline** (perp 0). Correct
for flush wall points (sockets/switches/faucets — `Z` absent) and for in-plane openings, but WRONG for
set-back fixtures: a ceiling light **447–1521 mm** into the room, a power box **200 mm** proud, a power
line **800 mm** in, a floor drain **~2 m** in, the safety-room opening **300 mm** proud — all landed on
the wall instead of where they were measured.

**The formula.** For a wall with start `S`, unit direction `û` (S→E) and **inward** unit normal `n̂`
(oriented toward the room centroid, so `+Z` = into the room), in the ORDX plan frame:

```
plan = S + along·û + perp·n̂        along = X (+ W/2 for CENTER types)   perp = Z (0 if absent / in-plane opening)
X_pdp = round(plan.x + Cx)          up   = Y (+ H/2 for CENTER types)   →   Z_pdp = round(up − 20000)
Y_pdp = round(−plan.y + Cy)         (Cx,Cy = the wall-table centroid transform; world = stored + 20000)
```

**Perp applies to every type EXCEPT the in-plane openings** whose `Z` is a frame-protrusion, not a plan
inset — forced to 0 for: `חלון` (window, `Z=−100`), `דלת` (door, `Z=−100`), `ארגז תריס` (shutter box),
`אדן חלון` (window sill). CENTER wall points carry no `Z` (perp 0 automatically).

**Corpus proof (own-base rebuild, stored X/Y matched to the byte).**
| type | ORDX `Z` | GT perp offset from wall line | verdict |
|---|---|---|---|
| `ק.חשמל` (power box, Rosetta) | 200 | 200 | **byte-exact** |
| `חור.פ.ממד` (safety-room, Rosetta) | 300 | 300 | **byte-exact** |
| `צ.חשמל` (power line, Rosetta) | 800 | 800 | matches (±3 mm along-anchor) |
| `פ.ביוב` (drain, Rosetta) | 1980 | ~2100 | matches within its 120 mm footprint |
| `תאורה` (ceiling light ×2, mimran-1) | 447 / 1521 | 447 / 1521 (+~200 mm fixed light stand-off) | on-wall → into-room (~450–1500 mm correction) |

Rosetta own-base byte-exact **X/Y** rose **25/40 → 28/40** with the perpendicular applied (Power Box +
Safety Room + one more now exact); mimran-5 CENTER guard and mimran-1 door/window OFFSET guard are
**unchanged** (their guarded items have `Z` absent or are in-plane openings). `selfTest()` gained a
**PERPENDICULAR guard**: rebuilding the Rosetta room on its own base must reproduce `ק.חשמל` and
`חור.פ.ממד` stored X/Y to the byte.

**Code:** `src/parseOrdx.js` now reads `position.z`; `src/writePdpDR.js` `collectItems` computes the
inward normal (`wallsCentroid`) and applies `perp` (guarded by `PERP_INPLANE` / `itemUsesPerp`). The
production PDP path inherits it automatically (same `collectItems`). Only the item's **X/Y** move —
still world-positive, zero `[0x91,0x9c)` / Section-E edits — so the load-safe postype class is preserved.

> **NOTE on `allelem_clean.pdp`:** the all-elements calibration room's only `Z`-bearing items are a
> window and two doors (in-plane openings, perp forced to 0), so its regenerated output is **byte-
> identical** — its 17 items were already on the correct wall at the correct along-offset. The
> perpendicular fix is validated where it matters (rooms with set-back fixtures) and is now in the
> production path. **Still NEEDS the owner's Raumplan load-test.**

---

## InnoDraw install library (ground-truth read — 2026-08-22)

The install `C:\Program Files (x86)\InnoDraw\El_Cad--1` **is readable**. Its internal element library
is the obstacle-icon catalog `eLObstaclesIconsEn.tx~` (+ `He`/other-language variants), **153 icons**,
each `<Name> <ID> <TwoD> <ThreeD> <Image>` (e.g. `Socket → Socket_Heb`, `Door`, `Window → Window1`,
`Faucet`), grouped by `eLObstaclesIconsCategories.txt` (Construction / Electrical / Water / …). Each
icon maps a Name+ID to a named **2D/3D symbol glyph** — but carries **no explicit anchor / insertion
-point / offset field**. The anchor is therefore a Raumplan **drawing convention baked into each named
symbol**, not a stored property; it cannot be read out of the install and **must be derived from real
saved records** — which is exactly what the corpus table above does. The 21 `.bin` element definitions
under `templates/dr/items/*.bin` are single 173-byte object records (type `@0x09`, code `@0x91`, dims
`@0x79`, position `@0x85`) — the same record shape as a PDP slot; their embedded position is where the
element sat when captured, not an anchor declaration.

---

## Regenerated outputs

- `analysis/out/allelem/allelem_rich.pdp` — regenerated with per-type anchors (base `wall8_oc23`,
  rich symbols; body byte-identical to base, `assemblies=1`, deterministic). Copied to `_LATEST/`.
- `analysis/out/allelem/allelem_postype.pdp` — **kept as fallback** (unchanged).

Both still need a manual Raumplan load-check (we cannot run Raumplan here).
