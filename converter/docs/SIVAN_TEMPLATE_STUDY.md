# Sivan Yitzhak Template — Study & Decision-Support Status Picture

**Purpose.** Study Sivan Yitzhak's purchased AutoCAD template ("הקובץ הסודי" /
"מוצרים לשרטוט יעיל") to learn its *language and method*, and decide what Soline
should build **as its own original implementation**. This is a study + adopt/skip
decision matrix — **not** a copy of her template.

**Permission scope (respected throughout).** Owner obtained Sivan's in-principle
permission to *view/study* the template to learn language and method, with limits:
take only what is needed to produce a carpentry drawing for the designer, **not**
the full template. Accordingly this document records **conventions, taxonomy names,
method, and an adopt/skip decision** — it reproduces **no layouts, no geometry, no
sheet designs, no block artwork**. All development stays Soline's own.

**Sources actually read** (readable only — geometry never reconstructed):
- **9 guide PDFs** (method, wall-fill, demolition/build, external-file fit, auto-QTO,
  "secret commands", CTB/font install, Klil openings bonus).
- **`SY-PRO-CTB.ctb` + `SY-PRO-CTB-1-100.ctb`** — decoded and parsed (full ACI table).
- **DXF export of the template** (`הקובץ הסודי - לרוחב - A0.dxf`, 287 MB) — streamed;
  extracted **HEADER vars, LAYER table (70), STYLE table (19), DIMSTYLE table (11),
  LTYPE table (13), BLOCK_RECORD names (464 named blocks)**. Entities/geometry not parsed.
- Font filenames (`*_sy.shx`) — categories only.

**Template facts (from DXF header):** AutoCAD **2018** format (`AC1032`),
codepage **ANSI_1255** (Hebrew), units **centimeters** (`$INSUNITS=5`), decimal
(`$LUNITS=2`). Her own tour PDF states: **600+ dynamic blocks, 70 layers, 31 layer
states, 70 layouts (2 floors), auto quantity takeoff**, superposition workflow.

---

## 0. Decision matrix at a glance

| # | Area | Verdict | One-line reason |
|---|------|---------|-----------------|
| 1 | Layer **taxonomy structure** (SOL-DISC-KIND) | **ALREADY-HAVE / exceed** | Our programmatic ASCII+glob scheme is more machine-usable than her flat Hebrew list |
| 1b | **Construction-phase layers** (existing / demolition / build) | **ADOPT** | She has הריסה/בניה/מצב קיים; we have none — this is the Israeli permit-drawing backbone |
| 1c | **Elevation-view layers** (מבט 1-4: far/mid/near/section) | **ADOPT** | Organizes interior elevations by depth; we have no elevation-layer concept |
| 1d | **"Changes/relocation" layers** (להזזה - שינויים) | **ADAPT** | Client-revision tracking layer per trade; fold into a single SOL-*-REV pattern |
| 1e | Granular lighting-point layers (wall/ceiling/lowered) | **ADAPT** | Optional sub-split of SOL-TEURA for placement clarity |
| 2 | **Block library** (600+ dynamic, disciplined naming) | **ADOPT (our own build)** | Biggest gap — build a Soline dynamic-block library with our own naming |
| 2b | **Block naming language** (`SY -` / `SY Dynamic -` / `STUDIO SY -`) | **ADAPT** | Mirror as `SOL -` / `SOL Dyn -`; brand + variant + view suffix |
| 3 | Title-block / sheet method (auto-date field, logo block, 60-70 layouts, VP-per-cube) | **ADOPT (method only)** | Reproduce the *method* — single editable project-strip block with FIELD date; not her artwork |
| 4 | **Dimension styles** (one DIMSTYLE per plot scale: 1-1…1-100) | **ADAPT** | We embed weights but have no scale-named dimstyle family; add one |
| 5 | Lineweight / CTB standard | **ALREADY-HAVE / exceed** | Ours is ISO-128, full-255, self-validating; hers is lighter & partial. Take 2 ideas only |
| 5b | **Poché via 60 % object transparency** (not CTB screening) | **ADOPT (as an option)** | Her method is more flexible per-plan than global CTB screening |
| 6 | **Superposition workflow + Layer States Manager** | **ADOPT (concept)** | Our HTML toggle-groups already encode this; add named "states" export for AutoCAD users |
| 6b | External-file adaptation SOP (PURGE/OVERKILL/AUDIT → MERGE) | **ADOPT (as guidance)** | Document it for the designer; low cost, high value |
| 6c | Auto quantity takeoff (native COUNT/data-extraction, 2023+) | **ADAPT** | We already generate BOM from the model; align block attributes so AutoCAD COUNT works too |
| 7 | Fonts | **SKIP (her SHX) / ALREADY-HAVE (our arial+Unicode)** | Her `*_sy.shx` are her private assets; our Unicode-escape approach avoids font-install support burden |

---

## 1. Layer system — her taxonomy vs our `SOL-*` (71)

### 1.1 What she has — 70 flat, Hebrew-named layers
Naming language: **`<discipline>`** optionally **`<discipline> - <sub-purpose>`**
(Hebrew, space-hyphen-space separator). Colour carries discipline; a **separate
"טקסט ומידות" (text & dims) layer per trade**, all pinned to **ACI 255** (prints
black). Linetype mostly `Continuous`; `HIDDENX2` for hidden/building-line/overhead.

Representative taxonomy (translated), grouped by what it reveals about her method:

| Group | Her layers (Hebrew → meaning) | ACI |
|-------|-------------------------------|-----|
| **Existing / phase** | קירות קיימים (existing walls) | 6 |
| **Demolition** | הריסה (demolition) · הריסה - מתאר קירות · הריסה - טקסט ומידות | 2 / 6 / 255 |
| **Construction (by material!)** | בניה - בטון (concrete) · בניה - בלוקים (block) · בניה - גבס-קלה (gypsum/light) · בניה - זכוכית (glass) · בניה - אבן (stone) · בניה - מתאר קירות · בניה - פתחים חדשים · בניה - הערות ומידות | 6 / 133 / 255 |
| **Elevation views** | מבט 1 - רחוק (far) · מבט 2 - אמצע (mid) · מבט 3 - קרוב (near) · מבט 4 - חתך (section) | 247/35/251/9 |
| **Electrical (very granular)** | חשמל - נק' חשמל · חשמל - מתגים · חשמל - גופי תאורה · חשמל - נק' תאורה קיר/תקרה/הנמכה · חשמל - מכשירי חשמל · חשמל - תקשורת-בית חכם-מתח נמוך · חשמל - נק' חשמל/תאורה **להזזה - שינויים** | 104/1/253/160/220 |
| **Plumbing** | אינסטלציה - נקודות · אינסטלציה - כלים סניטרים (+ חדשים) · שיש (counter) | 1 / 4 |
| **Trades** | ריהוט (furniture) · נגרות (carpentry) · נגרות קבועה · מיזוג (HVAC) · ריצוף (flooring) · הנמכות (ceiling drops) · תקרה (ceiling) · קונסטרוקציה (structure) · פתחים (openings) · מסגרות (frames) | 253/42/31/6… |
| **Site / permit** | קו מגרש (plot line) · קו בנין (building line, HIDDENX2) · חוץ-גינה-חצר (outside) · גגות (roofs) · מדרגות (stairs) · קרקע-פיתוח (site dev) | 170/240/64… |
| **Sale/marketing** | תכנית מכר - אלמנטים צבעוניים (sale-plan coloured) | 253 |
| **Aluminium spec** | סימול מפרט אלומיניום (Klil aluminium tag) | 133 |
| **Non-plotting helpers** | Defpoints · 0-CountArea · שטחים - שכבת עזר לחישוב (area calc) | plot=0 |
| **Per-trade text+dims** | X - טקסט ומידות for בניה/הריסה/ריהוט/הנמכות/מיזוג/חשמל/אינסטלציה/פתחים/ריצוף/תקרה | all 255 |

### 1.2 Our system (recap)
`SOL-<DISCIPLINE>-<KIND>` — 14 disciplines × up to 6 KINDs (SYM/DIM/TXT/HAT/CEN/HID)
= **71 layers**, pure 7-bit ASCII, Hebrew carried as description + `\U+XXXX`,
programmatic `TOGGLE_GROUPS` globs, one ACI per discipline, embedded group-370 weights.

### 1.3 Comparison & what's better in hers
| Dimension | Sivan | Soline | Winner |
|-----------|-------|--------|--------|
| Machine-parseable / glob toggles | ✗ (flat Hebrew) | ✓ `SOL-DISC-KIND` + globs | **Soline** |
| ASCII-safe / opens anywhere | ✗ (Hebrew names) | ✓ | **Soline** |
| DIM vs TXT separation | Merged ("טקסט ומידות") | Separate `-DIM` / `-TXT` | **Soline** (finer) |
| **Construction-phase split** (existing/demo/build) | ✓ rich | ✗ absent | **Sivan** |
| **Build-material split** (concrete/block/gypsum/glass/stone) | ✓ | ✗ | **Sivan** |
| **Elevation-view layers** (far/mid/near/section) | ✓ | ✗ | **Sivan** |
| **Client-change / relocation layer** | ✓ (להזזה-שינויים) | partial (`SOL-SHEET-REV`) | **Sivan** |
| Lighting-point granularity (wall/ceiling/lowered) | ✓ | folded in `SOL-TEURA` | **Sivan** |
| Site/permit layers (plot line, building line) | ✓ | ✗ | **Sivan** |
| Non-plot calc-helper layers | ✓ | ✗ | **Sivan** |

**Decisions:**
- **ALREADY-HAVE / exceed** — keep our `SOL-DISC-KIND` ASCII+glob structure. It is
  the better *engineering* substrate.
- **ADOPT (build our own)** — add a **phase axis** to our taxonomy: existing /
  demolition / new-build, e.g. `SOL-KIROT-DEMO`, `SOL-KIROT-NEW` (or a `PHASE`
  attribute the exporter routes on). This is the missing Israeli-permit backbone and
  the single biggest layer-system gap.
- **ADOPT** — **elevation-view layers** (far/mid/near/section depth banding) for
  interior elevations, since carpentry drawings live in elevations.
- **ADAPT** — one consolidated **`SOL-*-REV` "changes" pattern** instead of her
  per-trade duplicates; add optional **plot/building-line + non-plot area-calc**
  helper layers.
- **SKIP** — copying her Hebrew layer *names* verbatim (violates our ASCII rule and
  the permission scope). We build equivalents in our own naming.

---

## 2. Block / symbol inventory & naming language

### 2.1 Scale & naming convention (the "language")
**464 named blocks** in the plan DXF (she advertises 600+ across the kitchen file
too; ~1,300 further entries are anonymous `*U/*D/*X` dimension/hatch blocks).

Her naming grammar:
```
<BRAND> [Dynamic] - <object> [- <view>] [- <variant>]
```
- **Brand prefixes:** `SY -`, `SY Dynamic -`, `STUDIO SY -`, `Studio SY -`, plus a
  Hebrew brand **suffix `ס.ש`** (her initials) on Hebrew-named blocks.
- **`Dynamic`** token flags parametric blocks (grips + visibility/lookup states):
  "change size and type at the click of a button."
- **View suffix:** `- Top / - Front / - Side / - Elevation / - Section / - Plan`
  (a single object ships as several view blocks — e.g. `SY Dynamic - Coffee machine -
  Elevation / - Side / - top`).
- **Variant/number suffix:** `01/02…`, `2 wings`, `4 Types`, `5 Flames`.

### 2.2 Category inventory (what she covers)
| Category | Examples (naming shown to convey the language, not the artwork) |
|----------|----------------------------------------------------------------|
| Kitchen appliances | refrigerators 2/3/4/5-door, stoves gas/electric 3/5/6-flame, ovens, microwave, dishwasher, hoods (קולט אדים) top/side/round, washer/dryer, blender, toaster, coffee machine, kettle, food-processor, water cooler |
| Sanitary / wet | toilets (monobloc/wall-hung/short/hanging), sinks (many), double sinks, basins with surface, bathtubs (freestanding/front+section), showers + drains, bidet (בידה), mirrors, towel warmer, jets |
| Taps / plumbing | wall taps, rain-heads (ראש גשם), pot-filler, mixers, **plumbing manifold** (מפ' - top/side), water points, drain points, kobra pipe |
| Electrical | sockets (power/USB/water-proof/high-for-TV), switches (single/double/cross/changeover/illuminated/dimmer/roller-shutter), panel, communication closet |
| Lighting | ceiling/wall/spot/recessed/track/floor-recessed fixtures, waterproof variants, ceiling fans (3/4-wing), LED-strip feed |
| Low-voltage / smart | detectors, bell/intercom (+screen/outdoor), speakers (+outdoor/ceiling/sub), TV/network/phone points, optical fiber, smart-home |
| HVAC | AC indoor/outdoor units, ducts (base/angle), vents, air-direction arrows, steam collector, in-wall vent opening |
| Doors / windows | dynamic doors (4-types/stacking/round-top/double/security/accessible/with-top-section), windows (elevation/2-wing/security/ממ"ד safe-room/kip/fixed-section), rolling shutters + shutter motor, **Klil `LCSETR21_FRAWN`** blocks |
| Furniture | sofas (many dynamic + L/round), chairs (bar/office/dining/computer/vintage/garden), tables, beds (single/baby/crib), dressers, closets (+hanging), shelves, side chests, piano |
| Annotation / symbols | north arrow, section marks & lines, level marks (מפלס / קפיצה), revision mark & cloud, **space schedule (רשימת חללים)**, **project-detail vertical strip (סטריפ פרטי פרוייקט)**, **dynamic title frame (מסגרת דינאמית)**, **change-tracking table (טבלת מעקב שינויים)**, elevation-chair marks, aluminium/door/glass/carpentry/frame/general **detail tags (סימול פרט …)** |
| Scale figures / entourage | man/woman/kid/teen/sitting person, **wheelchair + accessible-person** (accessibility), plants & trees (plan + front), cars, pergola, grill, umbrella, iRobot |

### 2.3 Decision
- **ADOPT (build our own)** — the *single most valuable* thing she has is a **deep,
  disciplined, dynamic block library**. Soline should build its own library (we
  already have `blocklib/`, `research/manufacturer-blocks/`, ELEMENT_BLOCK_SPEC).
  Priorities that a carpentry drawing needs first: **detail tags (סימול פרט),
  level/section marks, dynamic doors/windows, kitchen appliances, sanitary, taps,
  scale figures incl. accessibility.**
- **ADAPT the naming grammar** to ours: `SOL - <object> [- <view>] [- NN]` with a
  `SOL Dyn -` prefix for parametric blocks and explicit view suffixes
  (`- TOP/- FRONT/- SIDE/- ELEV/- SECTION`). This gives one predictable token per
  block that our exporter and BOM can match on.
- **SKIP** — importing/redistributing any of her actual block geometry (permission +
  IP). We reproduce *coverage and naming discipline*, not her artwork.

---

## 3. Title-block / sheet method (method only — no layout reproduced)

Her sheet system, described as **method** (no layout copied):
- **Model-space "cubes" (קוביות):** named zones in model space, one per plan/phase —
  *existing / option 1 / option 2 / demolition / ground-floor / first-floor*, plus
  kitchen file: *kitchen option 1 / carpentry details / wet rooms*. Each layout's
  **viewport (VP) points at one cube** and shows only that plan's layers.
- **One base drawing, many sheets (superposition):** all plans drawn on the same
  base; layouts differ only by which layers are on. **~60-70 layouts** pre-built for
  two floors, each with **scale + plot settings already set**.
- **Project-detail strip block** on every layout: a single editable block holding
  project fields + **logo** (user edits the block *once*, updates everywhere) and an
  **auto-updating DATE field** (a DXF `FIELD` that refreshes on save).
- **Legend/key block (מקרא):** pre-made per-trade notes sitting on the correct layer —
  designer drags & drops; a layer-key placed in the ground-floor cube shows which
  layers each layout lights.
- **Defpoints** used for non-printing construction marks.

### Decision
- **ADOPT (method, our own build):** we already generate A0-A4 sheets. Add: (a) a
  **single Soline project-strip block** with a **FIELD-driven auto date**, (b) an
  editable **logo sub-block**, (c) the **VP-per-cube** discipline so each exported
  sheet reads one model zone with a fixed layer set, (d) a **legend block** drawn
  from our BOM. Build our own frame artwork — **do not reproduce her title block.**
- **SKIP:** her actual layouts, frame graphics, and the 60-70 pre-built sheets.

---

## 4. Dimension style

Her **DIMSTYLE table (11 styles)** is organized **one style per plot scale**:

| Style | Decimals | Note |
|-------|:--------:|------|
| `1-1` | 1 | full-scale details |
| `1-5` | 0 | (has dimscale 0.1) |
| `1-10`, `1-20`, `1-50`, `1-75`, `1-100` | 0 | plan scales |
| `1-20 מפרטי נגרות` | 1 | **carpentry-detail** dims at 1:20 |
| `My annotative dim style`, `Annotative text 2.5` | — | annotative alternative |
| `Standard`, `not-in-use` | — | base / retired |

Takeaways: **non-annotative, scale-named family** (the classic reliable approach —
pick the dimstyle that matches the sheet scale); a **dedicated carpentry-detail
dimstyle at 1:20 with 1 decimal**; a parallel annotative option. Text style for dims
= her `dim_sy.shx`-based styles. `$DIMSCALE=1.0`, units cm, 0-1 decimals.

### Decision
- **ADAPT:** we currently embed group-370 weights but ship **no dimstyle family**.
  Add a Soline **scale-named DIMSTYLE set** (`SOL-DIM-1-1 … SOL-DIM-1-100`) plus a
  **`SOL-DIM-CARP-1-20` carpentry-detail** style (1 decimal, cm). Keep it
  non-annotative for predictability; an annotative variant optional.
- **ALREADY-HAVE:** cm units, decimal, our `-DIM` layers at 0.13 mm.

---

## 5. Lineweight / CTB standard

### 5.1 Her CTB decoded (`SY-PRO-CTB.ctb`, + near-identical `-1-100` variant)
- Standard 27-entry AutoCAD lineweight ladder; `scale_factor=1.0`; **`custom_lineweight_display_units=0` (mm).**
- **Pens are pinned on only ~49 of 255 colours; the other ~206 = lineweight 0 (=use
  object lineweight).** Not full-coverage.
- Pen ladder actually used (mm): **0.09, 0.10, 0.15, 0.18, 0.20, 0.25, 0.30, 0.45, 0.53.**
  Distribution — **0.18 is her dominant pen (≈19-20 colours)**, then 0.20 (7), 0.30 (7),
  0.15 (5-6), 0.25 (4), 0.10 (3); heaviest pinned pen **0.53** (ACI 9). Overall a
  **lighter, finer** set than ISO-128 heavy lines.
- **NO screening at all — every colour `screen=100`.**
- **Colour output, not all-black:** 33 colours use `color_policy=5` (explicit RGB
  plot colour via `mode_color`), 222 use `color_policy=1`. Decoded plot colours
  include deliberate **greys (rgb 84,84,84 / 128,128,128 / 148-152 / 115-118)** at
  fine pens (0.10-0.18) — she gets "screened poché / faint underlay" looks by
  assigning **real grey RGB plot colours**, not by CTB screening.
- Ships **two CTBs** (general + a `1-100` fine-tuned variant) — scale-specific pen tuning.

### 5.2 Ours (recap)
`SOLINE.ctb` (+ `SOLINE-Color.ctb`): **full 1-255 coverage**, ISO-128-23 pens
(walls .50, structure .35, services .25, text/dims .18/.13, section/border .70,
default .25), **poché + grey-ramp screened** (25-50 %), all-black work set, pure-Node
generator that **self-validates** (adler32, re-parse, coverage assertions).

### 5.3 Comparison
| Aspect | Sivan | Soline | Note |
|--------|-------|--------|------|
| Coverage | ~49 pinned, rest object | **full 1-255** | Ours safer for foreign xrefs |
| Standard basis | lighter, ad-hoc ladder | **ISO-128-23** | Ours is a documented standard |
| Screening | none | poché/grey ramp 25-50 % | different philosophies (see below) |
| Poché tone method | **60 % object transparency** | CTB screening | hers per-plan flexible |
| Output | colour (with grey remaps) | all-black + colour variant | ours cleaner for issue set |
| Validation | none observed | self-validating generator | **Soline** |
| Scale variants | 2 CTBs | 1 (+ colour) | minor |

### 5.4 Decision
- **ALREADY-HAVE / exceed:** keep our ISO-128 full-coverage self-validating CTB.
- **ADOPT (as an option):** her **60 %-transparency poché method** (from the wall
  guide) — *"don't screen magenta in the CTB; give the fill 60 % transparency."* This
  keeps the wall **outline solid black** while the **fill reads soft grey in normal
  plans and colour in the build plan**, adjustable per plan without touching the CTB.
  Add a Soline option: emit wall poché SOLID with `transparency ≈ 60 %` on
  `SOL-KIROT-HAT` as an alternative to CTB screening. (Note: DXF transparency = group
  440; supported AutoCAD 2011+.)
- **ADOPT (small):** consider **0.18 mm as the default text pen** and offering a
  **scale-tuned CTB variant** (as she ships `-1-100`) if plots at 1:100 look heavy.
- **SKIP:** her colour-remap greys and partial coverage — our screened-grey ramp +
  full coverage already solves the same problem more predictably.

---

## 6. Workflow / method (how a drawing is produced)

From the guides, her production method:

1. **One-time setup:** install `*_sy.shx` + TTF fonts; install CTB via
   `STYLESMANAGER`; edit the project-strip **logo block once**; save as your own
   template copy.
2. **Superposition (סופרפוזיציה):** draw **all** plans on **one** base, never
   duplicated; discipline visibility handled by **layers + Layer States Manager**
   (31 pre-defined states — click "חשמל" → only electrical-relevant layers on). Each
   layout is pre-wired to a state.
3. **External-file adaptation SOP:** run **`PURGE` → `OVERKILL` → `AUDIT`** on the
   received file; copy template layers in; **`MERGE`** the foreign layers into the
   template layers (e.g. `25KIR`→walls, `_ELC`→electrical points); copy foreign
   content through layer **`0`** to avoid dragging stray layers; park unused originals
   on **"מצב קיים" (existing)**.
4. **Plan sequence:** existing → design options 1/2 → **demolition** (select →
   **MOVE** to demolition layer, turns red, shows only in demolition layout; dims &
   notes also on demolition layer) → **build** (walls on material-specific build
   layer, coloured only in build layout, black elsewhere; build dims/notes on
   "בניה - הערות ומידות") → full working set on the ground-floor cube.
5. **Wall drawing rule (gold):** never use the generic `hatch` layer; outline+fill of
   existing walls share the existing-walls layer; for new walls either whole-wall on
   the build layer, or **outline on "בניה - מתאר קירות" (black) + fill on build layer**;
   for soft poché give the **fill 60 % transparency** (not CTB edits).
6. **Auto quantity takeoff:** native AutoCAD **COUNT / data-extraction** (2023+) over
   the blocks — zero manual counting.
7. **Batch plot:** **`PUB`/`PUBLISH`** the whole layout set to multi-page or single
   PDFs.
8. **Productivity commands** she teaches: `CLOSEALL/SAVEALL`, `PURGE/OVERKILL/AUDIT`,
   `BURST` (explode keeping props), `OOPS`, `QSELECT`, `VPMAX/VPMIN`,
   `Ctrl+Shift+C/V` (copy-with-base → fast block), `COMPARE`, `TORIENT`, `TCIRCLE`,
   `QDIM`, `SELECT SIMILAR`, `BREAKLINE`, `REVCLOUD`, `LTSCALE`, clip-viewport.

### Decision
- **ADOPT (concept):** our HTML **`TOGGLE_GROUPS`** already *are* superposition
  states. Add an **AutoCAD "Layer States" export** so designers opening our DXF get
  the same one-click discipline toggling she offers. Add the **phase sequence**
  (existing/demo/build) as first-class layers (see §1).
- **ADOPT (as guidance doc):** ship a short **external-file adaptation SOP**
  (PURGE/OVERKILL/AUDIT → MERGE → copy-through-layer-0) and the **wall-fill rule** for
  designers who hand-edit our output.
- **ADAPT:** ensure our blocks carry the **attributes AutoCAD COUNT/data-extraction**
  needs, so users get her auto-QTO *and* our model-driven BOM from the same blocks.
- **SKIP:** nothing here is proprietary — it's method/best-practice we can restate in
  our own words.

---

## 7. Fonts

Her set (categories only — the `*_sy.shx` files are **her private, tuned SHX assets**;
we do not redistribute them):

| Her SHX / TTF | Style names using it | Category |
|---------------|----------------------|----------|
| `dim_sy.shx` | Standard, Dim, Annotative 2.5 | **Dimension** text |
| `avg-bo_sy.shx` | Title, English Title | **Title / heading (bold)** |
| `mgil_sy.shx` | כותרת | **Heading / display** |
| `romans_sy.shx` | ROMANS, text, ROM, Text shx, Notes-thin | **Body / notes (Roman)** |
| `techno_sy.shx` | SIVAN, techno, heb-en-new | **Body (techno)** |
| `sivan_sy.shx` | SIVAN_M | **Signature** font |
| `txt_sy.shx` | (Dim) | thin text |
| `miry_sy.shx` / `miryl_sy.shx` | STYLE2 | **Hebrew serif (Miriam-like)** |
| `mriam.ttf` | Hebrew-English text | Unicode Hebrew (TTF) |
| `arial.ttf` | Text - Arial | Unicode fallback |

19 text styles across ~10 fonts — a rich but **install-dependent** system (her guides
spend two PDFs on font-install troubleshooting; missing fonts = gibberish).

### Decision
- **SKIP** her `*_sy.shx` fonts (private assets + support burden).
- **ALREADY-HAVE / better for us:** our rule is **STYLE `SOLINE` → `arial.ttf`, Hebrew
  via `\U+XXXX` escapes, no Hebrew on the drawing body** — zero font-install support,
  opens identically everywhere. Keep it.
- **ADAPT (optional):** if we want a typographic hierarchy, define **2-3 Soline
  styles over widely-available TTFs** (e.g. a title weight + a notes weight) rather
  than shipping custom SHX. Keep the dimension text on one predictable style.

---

## 8. Decision summary

### Worth adopting (build as our own original)
1. **Construction-phase layer axis** — existing / demolition / new-build, with the
   *move-to-demolition-layer* workflow. The missing Israeli-permit backbone. **(1b, 6)**
2. **Elevation-view layers** (far/mid/near/section) — carpentry drawings are
   elevations. **(1c)**
3. **A Soline dynamic-block library** with disciplined naming (`SOL - object - view`,
   `SOL Dyn -`) — priority: detail tags, level/section marks, doors/windows,
   kitchen appliances, sanitary, taps, accessibility figures. **(2)**
4. **Project-strip block with FIELD auto-date + one-edit logo**, VP-per-cube sheet
   method, legend-from-BOM — our own artwork. **(3)**
5. **Scale-named DIMSTYLE family** incl. a **carpentry-detail 1:20** style. **(4)**
6. **60 %-transparency poché option** (outline stays black, fill soft/coloured
   per-plan) alongside our CTB screening. **(5b)**
7. **AutoCAD Layer-States export** of our toggle-groups + a short **external-file
   adaptation / wall-fill SOP** for designers. **(6)**

### Skip
- Her Hebrew layer *names*, her actual **block geometry/artwork**, her **layouts &
  title-block design**, her **`*_sy.shx` fonts**, her **colour-remap partial CTB**.
  (Permission scope + our engineering choices already differ.)

### Already match or exceed
- Layer **structure** (ASCII `SOL-DISC-KIND` + programmatic globs) — better substrate.
- **CTB** — ISO-128, full 1-255 coverage, self-validating generator.
- **Fonts** — Unicode-escape + single TTF style (no install burden).
- **BOM / element model** — we already generate quantities from the model (align block
  attributes so native COUNT also works).
- **Superposition** — our toggle-groups already encode it; only the AutoCAD-side
  export is missing.

---

## 9. סיכום החלטות בעברית (לבעלים)

**מה למדנו מהטמפלייט של סיון (במסגרת ההרשאה — לימוד שפה ושיטה בלבד, בלי להעתיק
פריסות/גיאומטריה):** קובץ אוטוקאד 2018, 70 שכבות בעברית, 31 מצבי שכבות, 70 לייאאוטים,
600+ בלוקים דינאמיים, כתב כמויות אוטומטי, ושיטת עבודה בסופרפוזיציה.

**מה כדאי לאמץ (ולבנות בעצמנו, מקורי):**
1. **שכבות לפי שלב בנייה** — קיים / הריסה / בנייה, כולל שיטת "העברה לשכבת הריסה". זה
   הבסיס לתוכניות היתר בישראל, ואצלנו חסר לגמרי.
2. **שכבות מבטים** (רחוק/אמצע/קרוב/חתך) — קריטי לתוכניות נגרות שהן בעצם חזיתות.
3. **ספריית בלוקים דינאמיים משלנו** עם שמות מסודרים (`SOL - object - view`) — קודם כל
   סימוני פרט, סימוני מפלס/חתך, דלתות/חלונות, מכשירי מטבח, סניטריה, ברזים, דמויות קנה־מידה
   כולל נגישות.
4. **בלוק "פרטי פרוייקט" עם תאריך אוטומטי (FIELD)** ולוגו שנערך פעם אחת, ושיטת
   viewport-per-zone — עם עיצוב מסגרת משלנו (לא שלה).
5. **סט סגנונות מידות לפי קנ"מ** כולל סגנון **פרטי נגרות 1:20**.
6. **פוֹשֶׁה בשקיפות 60%** — מתאר הקיר נשאר שחור, המילוי אפור עדין/צבעוני לפי התוכנית,
   בלי לגעת ב-CTB. שיטה גמישה יותר מהסקרינינג הגלובלי שלנו (נוסיף כאופציה).
7. **ייצוא Layer States לאוטוקאד** + נוהל קצר להתאמת קבצים חיצוניים ולמילוי קירות נכון.

**מה לדלג עליו:** השמות בעברית שלה, הבלוקים/הגיאומטריה/הלייאאוטים/המסגרת שלה, הפונטים
הפרטיים `*_sy.shx`, וטבלת ה-CTB החלקית שלה. (גם מטעמי הרשאה וגם כי הבחירות ההנדסיות
שלנו שונות וטובות יותר.)

**מה כבר יש לנו — ואף טוב יותר:** מבנה השכבות (ASCII + globs), ה-CTB (ISO-128, כיסוי
מלא 1-255, מאמת את עצמו), הפונטים (Unicode בלי התקנות), כתב הכמויות מהמודל, והסופרפוזיציה
(מקודדת כבר ב-toggle-groups). נשאר רק להשלים את שכבות השלב/המבטים, ספריית הבלוקים, ובלוק
המסגרת — הכל בפיתוח מקורי שלנו.

---
*Study only. No layouts, geometry, block artwork, fonts, or sheet designs were
reproduced or redistributed. All recommended development is Soline's own original build.*
</content>
</invoke>
