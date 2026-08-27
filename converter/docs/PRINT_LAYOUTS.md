# Soline DXF-2D — Print Layouts (A0–A4, landscape + portrait)

How the 2D measurement drawing is turned into **print-ready sheets**, one clean
file per sheet, each scaled to fill its paper. Generator: **`src/layout_sheets.js`**
(consumes content from `src/export_dxf2d.js`). Every sheet keeps the R12 / AC1009 +
`ansi_1255` Hebrew + space-free layer-name + `SOLINE.ctb` contract, so it opens in
the owner's AutoCAD 2021 exactly like the main drawing.

---

## 1. Why one file per sheet (not named layouts)

DXF **R12 (AC1009)** — the only version that reliably opens in the owner's AutoCAD —
has exactly **one paper space** and **no LAYOUT dictionary**. Multiple named print
layouts inside one file are therefore *not* R12-safe. So instead:

> **Each sheet is its own clean R12 DXF** (e.g. `allelem_W1_A3_landscape.dxf`) that
> opens on its own and **plots 1:1** to the physical paper size.

The decluttered model-space master (`_LATEST/allelem_v14_2d.dxf`) stays the working
drawing; the sheets in `_LATEST/sheets/` are the deliverables the client prints.

---

## 2. Paper sizes (ISO 216, millimetres)

| Size | Portrait (w × h) | Landscape (w × h) |
|------|------------------|-------------------|
| A0   | 841 × 1189       | 1189 × 841        |
| A1   | 594 × 841        | 841 × 594         |
| A2   | 420 × 594        | 594 × 420         |
| A3   | 297 × 420        | 420 × 297         |
| A4   | 210 × 297        | 297 × 210         |

A sheet file is authored **in paper millimetres**: the outer border *is* the real
paper rectangle. Plot the file **1:1** (1 DXF unit = 1 mm on paper) and you get the
true A-size. Margins, title strip and base text height scale per size
(`sheetMetrics()`), so the frame is legible at A0 yet not oversized at A4.

---

## 3. Scale-fitting math

The drawing content is authored in real-world **mm**. On paper at scale `1:D`, one
paper-mm shows `D` drawing-mm, so the content of width/height `contentW × contentH`
fits the **drawable area** (paper minus margins minus the title strip) when

```
D  ≥  contentW / drawableW      and      D  ≥  contentH / drawableH
D_req = max( contentW / drawableW ,  contentH / drawableH )
```

`D_req` is then **snapped UP** to the nearest standard architectural scale so the
printed ratio is a round number the client recognises and the content still fits:

```
NICE_SCALES = 1, 2, 5, 10, 15, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500, …
scaleDenom  = smallest NICE_SCALE ≥ D_req
```

The content is placed with factor `f = 1/scaleDenom`, centred in the drawable area.
The chosen ratio is printed on the title block (e.g. **1:20 / 1:50 / 1:100**). The
scale is computed **per (content × paper × orientation)** — a plan on A2 lands at a
coarser ratio than the same plan on A4.

Example (allelem room, plan content ≈ 6.1 × 5.1 m):

| Sheet | Drawable (mm) | D_req | Printed scale |
|-------|---------------|-------|---------------|
| Plan A2 landscape | 562 × 358 | 14.1 | **1:15** |
| Plan A3 landscape | 400 × 245 | 20.7 | **1:25** |
| W1 elevation A4 landscape | 281 × 156 | 25.6 | **1:50** |

(Exact ratios shift as content changes; the generator prints the actual value.)

---

## 4. Sheet furniture

Every sheet carries:

- **Outer border** = the paper edge (`SOL-SHEET-BORDER` / `גבול-גיליון`).
- **Inner frame** = the drawable margin (`SOL-SHEET-FRAME` / `מסגרת`).
- **Title block** — a strip along the bottom: SOLINE wordmark + the drawing name
  (PLAN / W1 …) on the left; a 2×3 field grid on the right — **PROJECT · SCALE ·
  PAPER · DATE · DRAWING No · SHEET**. The **SCALE** cell shows the true printed
  ratio (e.g. `1:25`), the **PAPER** cell the size + orientation.
- The **content**, scaled by `f` and centred.

---

## 5. Naming convention

```
<name>_<content>_<size>_<orientation>.dxf
```

- `<name>`        — the room/job (`allelem`).
- `<content>`     — `PLAN`, or `W1`…`Wn` (one per wall elevation).
- `<size>`        — `A0 A1 A2 A3 A4`.
- `<orientation>` — `landscape` | `portrait`.

e.g. `allelem_W1_A3_landscape.dxf`, `allelem_PLAN_A2_portrait.dxf`.

---

## 6. Generating sheets

```bash
# default: the allelem room -> _LATEST/  (main master) + _LATEST/sheets/ (example set)
node src/layout_sheets.js

# any drawing, custom output dir
node src/layout_sheets.js path/to/room.ordx  /path/to/out

# FULL matrix: plan + every elevation × every size × both orientations
SOLINE_SHEETS_FULL=1 node src/layout_sheets.js
```

The default run emits the **representative example set** (the task deliverable):

- Plan @ **A2** and **A3**, both landscape and portrait
- W1 elevation @ **A3** and **A4**, both landscape and portrait

The full generator (`SOLINE_SHEETS_FULL=1`) emits **every** `(plan | W1…Wn) × (A0…A4)
× (landscape | portrait)` combination — for the 4-wall allelem room that is
`5 contents × 5 sizes × 2 = 50` clean sheets, all self-tested.

Any single sheet can also be produced programmatically:

```js
const EX  = require('./src/export_dxf2d');
const LAY = require('./src/layout_sheets');
const content = EX.buildContent(scene, { title }, { kind: 'elevation', index: 0 });   // W1
const { dxf } = LAY.buildSheet(content, { size: 'A1', orientation: 'landscape', title });
// scaleDenom auto-fits; pass { scaleDenom: 50 } to force a specific ratio.
```

---

## 7. How the client chooses which sheets to print

1. Decide **what** to print — the plan, or a specific elevation (`W1`…).
2. Decide the **paper** available on the plotter (A0…A4) and **orientation**.
3. Open the matching file `…_<content>_<size>_<orientation>.dxf`.
4. **Plot 1:1** (1 unit = 1 mm) — the sheet is already at true paper size.
5. Select the **`SOLINE.ctb`** plot-style table (already installed under Plot Styles)
   so ACI colours map to Soline pen widths.
6. The **actual drawing scale** for that sheet is printed on the title block
   (SCALE cell) — no guessing.

To print a whole set, hand the client the folder `_LATEST/sheets/`; each filename
states content, size and orientation, and each title block states the scale.

---

## 8. Module API (`src/layout_sheets.js`)

| Export | Purpose |
|--------|---------|
| `transformEntities(s, sx, sy, dx, dy)` | Exact DXF-entity scale+translate (used to compose the main regions and to scale content onto paper). |
| `translateEntities(s, dx, dy)` | Translate only. |
| `bboxOf(s)` | Bounding box of a run of entities. |
| `PAPER`, `paperDims(size, orient)` | ISO paper table + oriented dimensions. |
| `fitScale(content, drawable)` | `{ scaleDenom, f, reqDenom }`. |
| `buildSheet(content, opts)` | Compose one print sheet → `{ dxf, scaleDenom, sheet }`. |
| `buildSetupScr(lang)` | Emit the AutoCAD `SOLINE_setup.scr` (see `docs/AUTOCAD_SETUP.md`). |

Content comes from `export_dxf2d.buildContent(scene, opts, what)` where `what` is
`{kind:'plan'}` | `{kind:'elevation', index:i}` | `{kind:'main'}`; the sheet wrapper
is closed by `export_dxf2d.assembleDXF({ ents, symBlocks, extraLayers, ext, h })`,
the shared R12 assembler used by both the master and every sheet.

---

## 9. Verification

Every emitted file (master + all sheets) is run through
`export_dxf2d.selfTest()`, which enforces the full R12 contract: `AC1009`, four
balanced sections, `ansi_1255`, no group-390/370, no OBJECTS/plot-style dictionary,
no `$HANDSEED`, no duplicate handles, every `INSERT`→defined `BLOCK`, and **no space
or R12-illegal character in any emitted LAYER name**. The default run reports
`selfTest PASS` for the master and `ok` for every sheet. Final confirmation is the
owner opening the files in AutoCAD 2021.
