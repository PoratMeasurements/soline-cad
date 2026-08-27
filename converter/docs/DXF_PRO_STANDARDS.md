# DXF 2D — Professional Standards Spec

**Purpose:** a concrete, buildable standard for the Soline DXF-2D exporter
(`src/export_dxf2d.js` + `src/dxf_soline.js`) so its output reads like a drawing
from a professional architect / interior-design studio rather than a "decent
CAD dump". Every rule below is mapped to our existing `SOL-*` layer scheme and to
the actual functions in the code, and each is traced to the industry standard it
comes from (AIA / US National CAD Standard, ISO 128, ISO 5455, ASME/ANSI Y14.1).

This doc is the **target**. The prioritized upgrade checklist at the end (§9) is the
implementable diff from where we are today.

> Reference reading in this repo: `DXF_2D_METHOD.md` (the reverse-engineered method
> from the El-Kincho / Adore corpus), `DXF_2D_UPGRADE.md` (the last rewrite). This
> doc supersedes their "how professionals do it" sections with sourced numbers.

---

## 0. The core idea a professional plan gets right

A pro floor plan is a **hierarchy of legibility**, produced by three orthogonal systems
working together:

1. **Layer system** — every mark is on a named, discipline-classified layer (so it can be
   turned on/off, recoloured, and re-plotted). Source: AIA CAD Layer Guidelines / NCS.
2. **Lineweight hierarchy** — the *cut* (walls) is heaviest, objects medium, annotation
   (dims/text/hatch) lightest. The eye reads structure first, notes last. Source: ISO 128.
3. **Annotation discipline** — dimension *strings* (not scattered dims), consistent text
   heights tied to scale, a titled sheet with north + scale bar. Source: NCS, ISO 5455.

We already have (1) partially and (3) mostly. Our biggest gap is (2): an R12 file carries
**no embedded lineweights at all** — see §2/§9. Fixing lineweight is the single largest
lever from "decent" to "designer-grade".

---

## 1. Layer system — SOL-* mapped to AIA / NCS

Professionals name layers by the **AIA CAD Layer Guidelines** (the layer module of the US
National CAD Standard): `Discipline-MajorGroup-MinorGroup-Status`, e.g. `A-WALL-FULL-N`
(Architectural / Wall / Full-height / New). The discipline letter + 4-char major group is
the readable core: `A-WALL`, `A-DOOR`, `A-GLAZ`, `A-DIMS`, `A-ANNO`, `A-FURN`.

We keep our Hebrew-token `SOL-*` names (the owner rejected the ELCAD names, and `SOL-*` is
the house convention), but we **anchor each SOL layer to its AIA equivalent** so the scheme
is defensible and a future NCS export is a rename table, not a redesign.

| SOL layer (`L.*`) | Role | AIA / NCS equivalent | ISO 128 weight | Suggested ACI | Notes |
|---|---|---|---|---|---|
| `SOL-KIROT` | wall faces (cut outline) | `A-WALL` | **0.50 mm** | 7 (white/black) | the heavy cut line |
| `SOL-KIROT-MILUY` | wall poché fill | `A-WALL-PATT` | 0.13 mm | 8 / 250 (grey) | solid or hatch, §5 |
| `SOL-PTACHIM` | doors + windows | `A-DOOR` / `A-GLAZ` | **0.25 mm** | 5 (blue) | split if possible, §9 |
| `SOL-RIHUT` | cabinets / furniture | `A-FURN` | 0.25 mm | 42 | object, medium |
| `SOL-CHASHMAL` | electrical | `E-POWR` | 0.25 mm | 6 (magenta) | symbols, medium |
| `SOL-INSTALATSIA` | plumbing | `P-SANR` | 0.25 mm | 4 (cyan) | |
| `SOL-GAZ` | gas | `M-GAS` | 0.25 mm | 2 (yellow) | |
| `SOL-MIZUG` | HVAC / ventilation | `M-HVAC` | 0.25 mm | 141 | |
| `SOL-TEURA` | lighting | `E-LITE` | 0.25 mm | 30 | |
| `SOL-MIVNE` | structure + misc | `S-COLS` | 0.35 mm | 9 | columns heavier |
| `SOL-MIDOT-PNIM` | inner (clear) dims | `A-DIMS` | **0.13 mm** | 3 (green) | thin, §4 |
| `SOL-MIDOT-CHUTS` | outer (overall) dims | `A-DIMS` | 0.13 mm | 1 (red) | thin, §4 |
| `SOL-TEKST` | notes / labels / legend | `A-ANNO-TEXT` | 0.18 mm | 7 | text weight |
| `SOL-MISGERET` | title block / north / scale | `G-ANNO-TTLB` | 0.18–0.50 mm | 250 / 7 | frame heavy, §6 |
| `SOL-RITZPA` | floor slab (3D only) | `A-FLOR` | 0.13 mm | 8 | |

**Rules that make a layer scheme "pro" (adopt all):**
- One mark → one semantically-correct layer. Never draw an annotation on a geometry layer
  or vice-versa. (We already do this; keep the classifier in `classify()` honest.)
- Colour is **not** decoration — under the traditional CAD workflow colour *encodes*
  lineweight via a plot-style/CTB table. So the ACI colour of each layer must be chosen to
  land on the right pen (§2), not for prettiness.
- Keep a stable Hebrew display name per layer (`LAYERS[i][3]`) for the human-facing legend.
- Freeze-worthy grouping: all dims on `A-DIMS`-class layers, all text on `A-ANNO`-class —
  so a measurer can hide *all* annotation in one action.

*Sources:* [AIA CAD Layer Guidelines / NCS (Duke facilities copy)](https://facilities.duke.edu/sites/default/files/AIA%20CAD%20Layer%20Guidelines.pdf) ·
[US National CAD Standard V3 (close-range.com)](http://www.close-range.com/docs/US_National_CAD_Standard_V3.pdf) ·
[MorphoCAD — AutoCAD layer naming conventions](https://morphocad.com/blog/autocad-layer-naming-conventions) ·
[CAD/CAM Services — AIA layering standards](https://www.cadcam.org/blog/what-are-the-aia-layering-standards-for-cad-drawings)

---

## 2. Lineweight hierarchy — the make-or-break upgrade

Professionals draw to the **ISO 128 line-width series**: `0.13, 0.18, 0.25, 0.35, 0.50,
0.70, 1.0 mm`. A floor plan uses three tiers:

| Tier | Weight (mm) | Applies to |
|---|---|---|
| **Heavy (cut)** | 0.50–0.70 | walls cut in section, section-cut lines, sheet border, title-block outer frame |
| **Medium (object)** | 0.25–0.35 | doors, windows, stairs, furniture, cabinetry, symbols, columns |
| **Light (annotation)** | 0.13–0.18 | dimensions, extension/leader lines, hatching/poché, centrelines, text, room tags |

Target Soline mapping (from the §1 table, in one place):

```
0.50 mm  SOL-KIROT               (wall cut — heaviest object on the sheet)
0.35 mm  SOL-MIVNE               (columns / structure)
0.25 mm  SOL-PTACHIM, SOL-RIHUT, SOL-CHASHMAL, SOL-INSTALATSIA,
         SOL-GAZ, SOL-MIZUG, SOL-TEURA   (openings, furniture, all MEP symbols)
0.18 mm  SOL-TEKST, SOL-MISGERET(text/frame lines)
0.13 mm  SOL-MIDOT-PNIM, SOL-MIDOT-CHUTS, SOL-KIROT-MILUY  (dims + poché fill)
```

### The problem in our current output
Our file is **DXF R12 (`$ACADVER = AC1009`)**. R12 has **no per-layer or per-entity
lineweight**. So today *every line plots at the same weight* — the hierarchy above does not
exist in the file at all. This is the #1 reason the plan looks flat/"low level".

### Two ways to deliver the hierarchy (pick A; B is the fallback)

**A. Upgrade the template to AC1015 (AutoCAD 2000) and embed true lineweights — RECOMMENDED.**
DXF lineweight is an integer in **1/100 mm**, chosen from the fixed enum
`{0,5,9,13,15,18,20,25,30,35,40,50,53,60,70,80,90,100,...}`.
- In `headerSection()` set `$ACADVER = AC1015` and add `$LWDISPLAY = 1` (group 290, so
  weights show on screen), keep `$INSUNITS = 4`.
- In `layerTable()` add group **370** to each `LAYER` record with the value from the map
  above (e.g. `0.50 mm → 370\n50`, `0.25 mm → 370\n25`, `0.13 mm → 370\n13`).
- AC1015 also needs the extra mandatory tables/objects R12 omits (APPID `ACAD`, an empty
  `BLOCK_RECORD` table, a minimal `OBJECTS` section with a named-object dictionary). This is
  a real but bounded change — see §9 item #1 for the checklist.
- Entities then inherit layer lineweight automatically; override per-entity with group 370
  only where needed (rare).

**B. Stay R12, but ship a colour→pen convention + a `.ctb` — the classic workflow.**
Under color-dependent plotting, *colour is the lineweight*. Choose ACI colours per §1 and
document the pen table so the measurer's plot matches intent:

| ACI colour | Pen (mm) | Used by |
|---|---|---|
| 7 white/black | 0.50 | `SOL-KIROT` (walls) |
| 9 grey | 0.35 | `SOL-MIVNE` |
| 5 blue | 0.25 | `SOL-PTACHIM` |
| 6 / 4 / 2 / 141 / 30 / 42 | 0.25 | MEP + furniture symbol layers |
| 3 green / 1 red | 0.13 | `SOL-MIDOT-*` (dims) |
| 8 / 250 grey | 0.13 | `SOL-KIROT-MILUY` (poché) |

The weakness of B: the weights live in an external `.ctb`, not the DXF, so a recipient who
opens the file without our plot style sees a flat drawing. **A is what makes the file itself
professional.** Do A.

*Sources:* [ISO 128 line weights & annotation (caddrafter.us)](https://caddrafter.us/line-weights-and-annotation-standards/) ·
[Studio Matrx — lineweights, the grammar of hierarchy](https://www.studiomatrx.org/students/drawing-fundamentals/architectural-lineweights-explained) ·
[Coohom — AutoCAD floor-plan lineweight standards](https://www.coohom.com/article/autocad-drawing-standards-for-architectural-floor-plans) ·
[CADBlockDWG — lineweights in AutoCAD](https://cadblockdwg.com/guides/lineweights-in-autocad-explained)

---

## 3. Dimensioning — the professional chain system

Professionals never scatter individual dims; they build **parallel dimension strings**,
grouped by what they measure, nested outward from the object. The canonical arrangement on
each side of the plan, from the wall outward, is **three chains**:

1. **Detail / opening chain (innermost)** — centre-line (or jamb) of every door, window and
   opening, plus the exact position of each element along the wall. Closest to the wall.
2. **Segment / intermediate chain (middle)** — wall-segment lengths: face-to-face between
   structural breaks (each individual wall run).
3. **Overall chain (outermost)** — the single total width and total height of the plan.

Chains stack, they never overlap, and a chain reads continuously (each dim's end is the next
one's start — a "running string"), so the segments in one chain **sum to the chain above it**.
This summing is the built-in error check a measurer relies on.

### Our mapping (already close — tighten the numbers)
- Chain 1 (detail) → `drawElementDims()` (element stations) + opening widths in
  `drawOpening()`, on `SOL-MIDOT-PNIM`.
- Chain 2 (segment) → `drawWallDims()` (per-wall length), on `SOL-MIDOT-PNIM`.
- Chain 3 (overall) → `drawOverallDims()`: inner-clear envelope on `SOL-MIDOT-PNIM`,
  outer envelope (incl. wall thickness) on `SOL-MIDOT-CHUTS`.

### Concrete geometry rules (adopt these numbers)
All values are **paper-mm → multiply by scale denominator for model units** (§4). At 1:50 the
multiplier is 50 (paper 1 mm = 50 model-mm); at 1:100 it is 100.

| Parameter | Paper value | At 1:50 (model mm) | Rule / source |
|---|---|---|---|
| Gap: object → start of extension line | 1.5–2 mm | 75–100 | small visible gap, never touching the object |
| Extension line overshoot past dim line | 1.5–2 mm | 75–100 | extension continues just past the terminator |
| Spacing between parallel chains | 6–8 mm (≈¼″) | 300–400 | equal, consistent offset per chain level |
| First chain offset from wall face | 8–10 mm | 400–500 | clears the poché + wall-face line |
| Text height (the dim number) | 2.5 mm | 125 | see §4 |
| Text gap above dim line | ≈ 0.5–1 mm | 40–60 | number sits **above** and centred, upright |

Our `dimension()` engine already emits `2 extension LINE + 1 dim LINE + 2 terminators +
1 TEXT`, keeps the number upright, and lifts it above the line — that architecture is correct.
Fix the offsets to the table above and make the three chain offsets *equal-stepped*
(e.g. `off₁ = wallFace + 400`, `off₂ = off₁ + 350`, `off₃ = off₂ + 350` in model-mm at 1:50).

### Terminators — ticks, not arrows
Mechanical drawings use filled arrowheads; **architectural convention uses the oblique
tick** (a short 45° "architectural tick"/slash, ~2–3 mm, drawn where the extension line
crosses the dim line). It reads cleaner in a dense plan. Our `arrow()` currently emits a
filled `SOLID` arrowhead. Add a `tick` terminator mode (a single 45° `LINE` ~2.5 mm paper,
centred on the intersection) and make it the default for `SOL-MIDOT-*`; keep the arrow
available for leaders. This is a small change with a big "designer-grade" payoff.

> Note on real `DIMENSION` entities: the studied corpus (El-Kincho / Teveth) carries **no**
> `DIMENSION` entities — pros there exploded dims to lines/text for portability, exactly as
> we do. Keep the manual engine; do **not** switch to `DIMSTYLE`/`DIMENSION` just for
> "correctness" — it would regress compatibility with the reference deliverables.

### Reference-point consistency
Pick one and hold it for the whole sheet: our measured wall line = the **inner clear face**
(room side), so Chain 1/2 read clear-room numbers and the overall inner chain reads e.g.
4000×3000, while `SOL-MIDOT-CHUTS` reads clear + 2·thickness. Keep that invariant (it is
already the closure rule in `buildWallPoly()`), and *label the two envelopes* so nobody
confuses clear vs. structural.

*Sources:* [MODE architecture — dimensioning standards](https://modearchitecture.com/dimensioning-standards/) ·
[bd-MAP — dimensions ground rules](http://map.bdarchitects.com/2011/02/10/dimensions-ground-rules/) ·
[EVstudio — dimensioning 101](https://evstudio.com/dimensioning-101/) ·
[Graduate School — dimension chains explained](https://www.graduateschool.edu/learn/blueprint-reading/understanding-dimension-chains-in-architectural-drawings-a-detailed-analysis) ·
[Uperplans — floor-plan dimension rules](https://uperplans.com/floor-plan-dimension-rules/)

---

## 4. Text heights & annotation scale

Text is sized so it plots at a fixed **paper height** regardless of drawing scale. The
industry minimum plotted height is **2.5 mm**; a small hierarchy of sizes gives the sheet
structure.

| Role | Paper height | At 1:50 (model mm) | At 1:100 (model mm) |
|---|---|---|---|
| Dimensions, element labels, `H` mount notes | 2.5 mm | 125 | 250 |
| Room names, general notes | 3.5 mm | 175 | 350 |
| Sheet title / drawing number | 5.0 mm | 250 | 500 |
| Legend heading | 3.5 mm | 175 | 350 |

**Formula (put this in the exporter):** `modelTextHeight = paperHeight_mm × scaleDenominator`.
Drive it from an explicit `opts.scale` (e.g. `50`) instead of the current heuristic
`dimTextH = clamp(diag/70, 60..200)`, which only *approximates* a paper height and drifts with
room size. Keeping the heuristic as a fallback is fine, but a supplied scale must win — that is
what makes text plot at a *known* height, the definition of annotative-correct text.

Other text rules pros follow:
- **Font:** a single simple sans (we use `arial.ttf` via the `SOLINE` style — correct; it is
  Hebrew-capable and universal). Don't mix fonts.
- **Never smaller than 2.5 mm** on the final plot; if a label collides, move it on a leader,
  don't shrink it.
- Text is **horizontal or reads left-to-right / bottom-to-top** only (upright rule) — our dim
  engine already flips numbers to stay upright; apply the same to labels.

*Sources:* [draftsperson.net — text heights & scale chart](https://blog.draftsperson.net/text-heights-in-drawings/) ·
[SourceCAD — standard text sizes](https://sourcecad.com/blog/standard-text-sizes-in-technical-drawing) ·
[caddrafter.us — annotation standards](https://caddrafter.us/line-weights-and-annotation-standards/)

---

## 5. Wall representation — poché

"Poché" = the solid-filled cut of walls/columns that makes the plan read instantly. Two
accepted treatments:

- **Solid poché (fill)** — a uniform mid/dark-grey `SOLID` between the two wall faces. This is
  the cleanest, most modern interior-plan look and is what a measurement/setting-out plan
  wants. **This is our default** (`SOL-KIROT-MILUY`, ACI 8/250, thin). Keep it.
- **Hatch poché (material)** — a pattern instead of solid, when the plan must convey material:
  `ANSI31` (45° diagonal lines) for brick/general masonry, a concrete pattern (aggregate dots
  + short strokes, or cross-hatch) for RC, etc. Use only if a project explicitly needs
  material read; otherwise solid poché is more legible.

Poché rules pros hold:
- The **wall face lines are heavy** (`SOL-KIROT`, 0.50 mm); the **fill is light**
  (`SOL-KIROT-MILUY`, 0.13 mm) so the fill never competes with the outline.
- Corners are **mitred** so the band is continuous and gap-free; free ends get a flush cap.
  (Already correct in `buildWallPoly()` — this is a genuinely pro-grade piece of our code.)
- Openings **break the poché**: at a door/window the fill and the inner/outer face lines stop
  at the jambs, and the opening is drawn with its own geometry (leaf+swing arc / frame+glazing).
  *Verify our poché is actually clipped at openings* — if the `SOLID` band runs straight
  through the door, that is an immediate "not pro" tell (§9 item #4).

If we add hatch poché later: emit a `HATCH` entity (AC1015+) or, for R12, a bounded set of
`LINE`s clipped to the wall polygon on `SOL-KIROT-MILUY`. Prefer real `HATCH` once on AC1015.

*Sources:* [architectwisdom — poché vs hatch](https://architectwisdom.com/poche/) ·
[Coohom — hatching industry standards](https://www.coohom.com/article/industry-standards-for-hatching-in-architectural-and-engineering-drawings) ·
[draftsperson.net — CS hatch library / ANSI patterns](https://blog.draftsperson.net/cs-hatch-library-collection/)

---

## 6. Sheet composition — title block, north, scale bar, layout

### Title block
Standard placement is the **lower-right corner** of the sheet (ASME/ANSI Y14.1), so it stays
visible when sheets are folded/bound. It is a framed panel; the **outer frame is a heavy line**
(0.50 mm), internal rules lighter (0.18 mm).

Required fields (adopt this set; we currently have the first block — add the rest):

```
Project name            (פרויקט)          ← have
Client                  (לקוח)            ← have
Site address            (כתובת)           ← have
Drawing title           (שם התכנית: "תכנית מדידה")   ← have (as header)
Scale                   (קנ"מ 1:50) + units (מ"מ)    ← have
Date / last revision    (תאריך)           ← have
Measured / drawn by     (מדד/שרטט)        ← have (מודד)
--- ADD: ---
Checked / approved by   (בדק/אישר)
Drawing number          (מס' תכנית, e.g. M-01)
Sheet number            (גיליון n מתוך m)
Revision number + rev history (מהדורה) — small stacked table
Company block / logo    (Soline) — we have soline_logo_data.js; place the logo here
```

### North arrow
Always present. A simple, unambiguous arrow with **N (or "צ")**; the standard convention is to
orient the plan so north is up when practical. Keep it near the plan or in the title block
(both are accepted). We have `drawNorthAndScale()` — keep, and make sure the arrow is a clean
filled triangle + stem, not a decorative compass.

### Graphic scale bar
A drawn bar (e.g. 0–1–2–3–4 m with ticks) so the plan stays measurable even when printed at
the wrong size — this is *why* pros include it in addition to the ratio. We have it; make the
segments **round metric units** (1 m) and label `0` and the end value with the unit (`מ׳`).
Include the ratio text too: `קנ"מ 1:50`.

### Layout / composition
- **Plan is the hero**, centred with generous margin; annotation column (title block, legend,
  north, scale) sits to one side / lower-right — our current right-column layout is fine.
- Leave a clear **border/margin** and, ideally, a sheet border rectangle on `SOL-MISGERET`
  (heavy) framing the whole drawing — a bordered sheet reads as a *document*, an unbordered
  one reads as a *dump*. (§9 item #6.)
- If elevations are added later, arrange them in a consistent grid below/beside the plan, each
  with its own titled sub-block (`title + scale`), aligned to a common baseline.

### Element legend (מקרא)
Every symbol used must appear once in a boxed legend: `symbol swatch → Hebrew category name`.
We generate this automatically in `drawLegend()` — keep it, and ensure the swatch is drawn from
the exact same `GLYPHS[...]` used on the plan (it is), so the legend is always truthful.

*Sources:* [archisoup — architectural title blocks](https://www.archisoup.com/architectural-title-blocks) ·
[Life of an Architect — title blocks](https://www.lifeofanarchitect.com/architectural-graphics-101-title-blocks/) ·
[ArhFoundation — title block guide](https://www.arhfoundation.org/drawing-title-block-guide) ·
[Jeffco — general AutoCAD standards / sheet layout (PDF)](https://www.jeffcoes.org/Sites/Jefferson_County_Environmental_Services/Documents/Steve/Appendix%203%20CAD-Standards.pdf) ·
[ISO 5455 scale / scale-bar convention — via draftsperson text-height chart](https://blog.draftsperson.net/text-heights-in-drawings/)

---

## 7. Symbols — MEP, furniture, openings

Pros use a **consistent, legend-defined symbol set**, sized in real paper terms and always
accompanied by a mount-height note where relevant.

- **Electrical (`E-POWR`/`E-LITE`):** duplex outlet = circle on the wall line with two short
  parallel bars; switch = `S` (or a ringed lever); light = crossed circle; panel = rectangle
  with a diagonal. Recessed/special types get a subscript/letter *and* a legend entry. Our
  `GLYPHS` set matches these conventions — good. Keep each on its discipline layer with its
  `H nn` note (we do).
- **Mount heights:** annotate every wall device with `H <cm>` (we do, on the discipline layer).
  Standard socket height is ~30 cm, switch ~110–130 cm — keep these as sensible defaults when
  the model lacks a height.
- **Furniture / cabinets (`A-FURN`):** simple outline rectangles at true size on `SOL-RIHUT`,
  medium weight, with a centred Hebrew name. Don't over-detail furniture — it's context, drawn
  in the thin/medium tier so it never competes with structure.
- **Openings (`A-DOOR`/`A-GLAZ`):** doors = leaf line + true swing arc (radius = leaf width);
  windows = frame across the wall thickness + glazing centre line; **both sized to the real
  measured width**, never a scaled unit block. We do this correctly in `drawOpening()`.

*Sources:* [Cedreo — electrical symbols on floor plans](https://cedreo.com/blog/electrical-symbols/) ·
[igotoele — reading outlet symbols](https://igotoele.com/blog/wall-socket/electrical-outlet-symbol/) ·
[PlanSnapper — electrical floor-plan symbols](https://plansnapper.com/symbols/electrical)

---

## 8. RTL / Hebrew considerations

Hebrew is our deliverable language; a few specifics keep it correct in DXF:

- **Storage:** keep emitting Hebrew as `\U+XXXX` escapes (pure 7-bit ASCII on disk) with
  `$DWGCODEPAGE = ansi_1255` and a TTF-backed style (`SOLINE → arial.ttf`). This is what we do
  and it renders reliably across AutoCAD / DWG TrueView / most DXF viewers. **Do not** switch
  to a legacy Hebrew SHX font with "display characters backward" — that is the old hack for
  mirrored SHX glyphs and is unnecessary with a Unicode TTF style.
- **Bidi / mixed strings:** a label mixing Hebrew + Latin/numbers (e.g. `שקע 220V`) can reorder.
  Where a value is a bare number with a unit (dims, `H 30`), keep the numeric part LTR and the
  Hebrew word separate, or place the unit as ASCII (`H 30`) — we already do the dim numbers in
  cm as ASCII, which sidesteps bidi entirely.
- **Mirrored text from a flipped frame:** our world frame flips Y (`worldY = -ordxY`). Flipping
  a coordinate frame is fine for *geometry*, but ensure `TEXT` is **never** emitted with a
  negative X-scale / mirrored (group 41 or a mirror transform) — mirrored text renders
  backwards. Emit text upright in world coordinates with rotation only (we do; keep it).
- **Reading order of the sheet:** an Israeli reader scans right-to-left, so the title
  block/legend sitting on the **right** is natural here (unlike the US lower-right-only rule).
  Our right-column layout is actually well-suited to a Hebrew deliverable — keep it, but still
  draw the sheet border/frame so it reads as a document.

*Sources:* [Autodesk — backward/mirrored text in RTL scripts](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Text-types-in-backwards-and-mirrored-in-AutoCAD.html) ·
[CAD Forum — Hebrew text in AutoCAD](https://www.cadforum.cz/cadforum_en/qaID.asp?tip=4290) ·
[DTP Labs — RTL typography guide](https://www.dtplabs.com/blog/rtl-typography-complete-guide-arabic-hebrew-farsi)

---

## 9. Prioritized upgrade checklist — "decent → designer-grade"

Ranked by impact-per-effort. Each item names the file/function to touch.

### P0 — highest impact
1. **Embed a real lineweight hierarchy.** Bump the template to `AC1015` and add group `370`
   per layer (`0.50 / 0.35 / 0.25 / 0.18 / 0.13 mm` per §2), set `$LWDISPLAY = 1`. This alone
   moves the plan from "flat" to "reads like architecture". Touches `dxf_soline.js`
   (`headerSection`, `layerTable`, and add the AC1015-required `APPID`/`BLOCK_RECORD` tables +
   minimal `OBJECTS` section). If AC1015 is too big a lift right now, ship the §2-B colour→pen
   `.ctb` as an interim and re-colour layers to the pen table — but schedule the AC1015 move.
2. **Architectural tick terminators** for dimensions. Add a `tick` mode to `arrow()`/
   `dimension()` (single 45° `LINE`, ~2.5 mm paper) and default `SOL-MIDOT-*` to ticks.
   Touches `export_dxf2d.js` (`arrow`, `dimension`).
3. **Scale-driven text height.** Add `opts.scale` (default 50); compute
   `textH = paperMM × scale` per §4; let it override the `diag/70` heuristic. Apply the size
   hierarchy (dims 2.5 / rooms 3.5 / title 5.0 mm). Touches `export_dxf2d.js` (`exportDXF2D`,
   all `text(...)` height args).

### P1 — clear quality lift
4. **Clip poché + wall faces at openings.** Confirm/implement that `SOL-KIROT-MILUY` and the
   `SOL-KIROT` face lines are broken at every door/window jamb (no fill running through an
   opening). Touches `drawWalls` / `buildWallPoly` (subtract opening spans) + `drawOpening`.
5. **Equal-stepped, correctly-offset dimension chains** per §3: gap 1.5–2 mm, overshoot
   1.5–2 mm, first offset 8–10 mm off the wall face, equal 6–8 mm steps between chains (all
   ×scale). Touches `drawWallDims`, `drawElementDims`, `drawOverallDims`, `dimension`.
6. **Sheet border + finished title block.** Draw a heavy border rectangle on `SOL-MISGERET`
   framing the whole sheet; expand the title block (§6) with drawing number, sheet number,
   checked-by, revision table, and drop the `soline_logo_data.js` logo into it. Touches
   `drawTitleBlock`, `exportDXF2D` (extents/frame).

### P2 — polish / correctness
7. **Split openings into `A-DOOR` vs `A-GLAZ` semantics.** Give doors and windows distinct
   layers (or at least distinct colours/weights) instead of one shared `SOL-PTACHIM`. Optional
   but standard-aligned; touches `dxf_soline.js` (add `SOL-PTACHIM-DOOR`/`-GLAZ`) + `drawOpening`.
8. **Heavier structure.** Put columns/beams on `SOL-MIVNE` at 0.35 mm and ensure they read
   above furniture in the hierarchy.
9. **Label the two overall envelopes** (clear vs structural) with a one-word tag so the reader
   never confuses inner-clear (e.g. 4000) with outer (4200). Touches `drawOverallDims`.
10. **Optional material hatch poché** (`ANSI31` / concrete) as a per-project switch, once on
    AC1015 so a real `HATCH` entity can be used. Touches `drawWalls`.

### Non-goals (explicitly keep as-is)
- Keep the **manual dimension engine** (no `DIMENSION`/`DIMSTYLE`) — matches the corpus and
  maximizes portability.
- Keep **solid poché** as the default (material hatch is opt-in only).
- Keep **Hebrew as `\U+XXXX` + TTF style** — do not adopt legacy SHX/backward-display hacks.
- Keep the **right-side annotation column** — it suits a Hebrew (RTL-reading) deliverable.

---

## 9a. Implementation status — v5 (2026-08-21)

Shipped in `src/dxf_soline.js` + `src/export_dxf2d.js` (regenerated to
`analysis/out/allelem/allelem_v5_2d.dxf` + canonical `allelem_2d.dxf`; the 3D twin
rides the same template into `allelem_v5_3d.dxf`):

- **AC1015 template with embedded lineweights (P0 #1).** `$ACADVER = AC1015`,
  `$LWDISPLAY = 1`, `$HANDSEED` = max-handle+1. Every LAYER record carries group `370`
  on the ISO-128 hierarchy: `SOL-KIROT 0.50 · SOL-MIVNE 0.35 · openings/objects/MEP
  0.25 · SOL-TEKST/SOL-MISGERET 0.18 · SOL-MIDOT-*/SOL-KIROT-MILUY/SOL-RITZPA 0.13`.
  The AC1015 scaffolding R12 omits is present: handles + `AcDb*` subclass markers on
  every symbol-table record, the `APPID` (ACAD) + `BLOCK_RECORD` (`*Model_Space`,
  `*Paper_Space`, one per block) tables, the two mandatory space blocks, and an
  `OBJECTS` section with the root named-object dictionary + `ACAD_GROUP`. Validated
  with `dxf-parser` (parses as AC1015) + a handle-uniqueness/seed audit.
- **Sheet border + title block (P1 #6).** Heavy (`0.50 mm` per-entity) sheet border
  framing the whole sheet; a framed title strip with a Soline logo placeholder box +
  wordmark + a reference note to the real brand PNG (`brand/soline-logo.png` — see
  DWG note below re embedding the raster), and the full field set: project, client,
  address, drawing title, scale + units, date, surveyor, checked/approved, drawing
  number, sheet number, revision.
- **Window & door specification table (new).** `טבלת מפרט פתחים`: mark (D#/W#),
  Hebrew type (from `DOORS_WINDOWS_CATALOG.md` vocabulary), width×height, opening
  direction, count — identical openings merge to one counted row.
- **BOM counted schedule (new).** The legend is now `מקרא וספירת אלמנטים`: symbol +
  Hebrew name + count, **grouped by discipline** with a per-discipline subtotal.
- **Scale-driven text height (P0 #3).** `modelHeight = paperMM × scaleDenom` from an
  explicit `opts.scale` (default 1:50); hierarchy dims 2.5 / room+legend 3.5 / title
  5.0 mm. Replaces the `diag/70` heuristic.
- **Kept intact (no regression):** SOL-* Hebrew layers, per-element symbols, per-element
  dimension sub-layers coloured by discipline, dedicated Hebrew-only legend (no Hebrew
  on the drawing area), ACI 9 visible walls, mitred solid poché, explicit no-math
  dimensions, elevations, pure-ASCII `\U+XXXX` Hebrew.

### DWG-only features — documented, NOT faked in DXF
These need the owner's **real template DXF** for exact matching, or a future **DWG
export path** (via a DWG-capable library / ODA), and are deliberately not half-built
into ASCII DXF:

- **Dynamic blocks with visibility states** (one door/window block that flips leaf
  side / swing / type via a visibility parameter). DXF stores a dynamic block only as
  its `*U###` anonymous representation — the parametric definition lives in the DWG
  `EvalGraph`/`BlockVisibilityParameter` objects, which ASCII DXF cannot author. v5
  draws each opening as real explicit geometry instead (leaf + true swing arc / frame
  + glazing), which is correct but static.
- **31 layer states** (`ACAD_LAYERSTATES` saved layer on/off/freeze/colour sets). A
  DXF/DWG feature that only round-trips reliably through the native template.
- **70 paperspace layouts** (named plotted sheets with their own viewports/title
  blocks). v5 emits model space only (the classic exploded-plan convention the corpus
  uses); real multi-layout sheets want the DWG template.

When the owner supplies the actual Sivan-Yitzhak-style template DXF, the SOL-* ↔
template layer/lineweight mapping becomes a rename table (§1), and the title block /
spec-table / BOM blocks can be re-anchored to the template's own block geometry.

---

## 10. Sources

**Layer standards (AIA / NCS / ISO 13567)**
- AIA CAD Layer Guidelines (Duke copy): https://facilities.duke.edu/sites/default/files/AIA%20CAD%20Layer%20Guidelines.pdf
- US National CAD Standard V3: http://www.close-range.com/docs/US_National_CAD_Standard_V3.pdf
- AIA layer standards (OpenLab / City Tech): https://openlab.citytech.cuny.edu/arch-1230/files/2014/08/AIA-Layer-Standards.pdf
- MorphoCAD — layer naming conventions (AIA/NCS/ISO 13567 compared): https://morphocad.com/blog/autocad-layer-naming-conventions
- CAD/CAM Services — AIA layering standards: https://www.cadcam.org/blog/what-are-the-aia-layering-standards-for-cad-drawings

**Lineweights (ISO 128) & hierarchy**
- caddrafter.us — line weights & annotation (ISO 128): https://caddrafter.us/line-weights-and-annotation-standards/
- Studio Matrx — lineweights, the grammar of hierarchy: https://www.studiomatrx.org/students/drawing-fundamentals/architectural-lineweights-explained
- Coohom — AutoCAD floor-plan standards: https://www.coohom.com/article/autocad-drawing-standards-for-architectural-floor-plans
- CADBlockDWG — lineweights in AutoCAD: https://cadblockdwg.com/guides/lineweights-in-autocad-explained

**Dimensioning**
- MODE architecture — dimensioning standards: https://modearchitecture.com/dimensioning-standards/
- bd-MAP — dimensions ground rules: http://map.bdarchitects.com/2011/02/10/dimensions-ground-rules/
- EVstudio — dimensioning 101: https://evstudio.com/dimensioning-101/
- Graduate School — dimension chains explained: https://www.graduateschool.edu/learn/blueprint-reading/understanding-dimension-chains-in-architectural-drawings-a-detailed-analysis
- Uperplans — floor-plan dimension rules: https://uperplans.com/floor-plan-dimension-rules/

**Text height / scale**
- draftsperson.net — text heights & scale chart: https://blog.draftsperson.net/text-heights-in-drawings/
- SourceCAD — standard text sizes: https://sourcecad.com/blog/standard-text-sizes-in-technical-drawing

**Poché / hatch**
- architectwisdom — poché vs hatch: https://architectwisdom.com/poche/
- Coohom — hatching industry standards: https://www.coohom.com/article/industry-standards-for-hatching-in-architectural-and-engineering-drawings
- draftsperson.net — CS hatch library (ANSI patterns): https://blog.draftsperson.net/cs-hatch-library-collection/

**Title block / sheet composition**
- archisoup — architectural title blocks: https://www.archisoup.com/architectural-title-blocks
- Life of an Architect — title blocks: https://www.lifeofanarchitect.com/architectural-graphics-101-title-blocks/
- ArhFoundation — title block guide: https://www.arhfoundation.org/drawing-title-block-guide
- Jeffco — general AutoCAD standards / sheet layout: https://www.jeffcoes.org/Sites/Jefferson_County_Environmental_Services/Documents/Steve/Appendix%203%20CAD-Standards.pdf

**Symbols**
- Cedreo — electrical symbols on floor plans: https://cedreo.com/blog/electrical-symbols/
- igotoele — reading outlet symbols: https://igotoele.com/blog/wall-socket/electrical-outlet-symbol/
- PlanSnapper — electrical floor-plan symbols: https://plansnapper.com/symbols/electrical

**RTL / Hebrew**
- Autodesk — backward/mirrored text in RTL scripts: https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Text-types-in-backwards-and-mirrored-in-AutoCAD.html
- CAD Forum — Hebrew text in AutoCAD: https://www.cadforum.cz/cadforum_en/qaID.asp?tip=4290
- DTP Labs — RTL typography guide: https://www.dtplabs.com/blog/rtl-typography-complete-guide-arabic-hebrew-farsi
