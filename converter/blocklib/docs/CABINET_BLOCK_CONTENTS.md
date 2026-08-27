# CABINET_BLOCK_CONTENTS — Anatomy of a Cabinet Block (SPEC, review-only)

> **What a cabinet block must contain** so that **one** cabinet definition serves BOTH as a live
> object inside the Soline software AND exports to DXF as a proper, reusable **BLOCK**. This is a
> reviewable specification — the anatomy list the owner reads and approves. **No geometry, DXF, blocks
> or previews are generated at this stage.**
>
> Grounded in the existing standards: `A_ARCHITECTURE.md`, `B_TAXONOMY.md`, `C_OBJECT_SCHEMA.json/.md`,
> `D_NAMING.md`, `E_LAYERS.md`, `F_INSERTION_POINTS.md`, `G_ATTRIBUTES.md`, `H_VIEW_MATRIX.md`,
> `I_QA_STANDARD.md`, `J_FIRST20.md`, and `examples/base_cabinet_600.object.json`.

Date: 2026-08-22 · Units: mm · Scope: kitchen cabinets — `KIT-BASE-*`, `KIT-WALL-*`, `KIT-TALL-*`,
`KIT-CORN-*` (base cabinet is the reference case). Backend: Node, reusing `src/dxf_soline.js` (ezdxf
absent — verified per `A_ARCHITECTURE §6`).

---

## 0. The single-source principle (why "one definition, two lives")

A cabinet is authored **once** as a validated `*.object.json` instance (`C_OBJECT_SCHEMA`). That one
file is:

- **Inside Soline** — a selectable object: the app's item-picker reads `library.index.json`, the user
  drops a cabinet onto the measured plan, edits its `params`/`attributes`, and it behaves as one unit.
- **In DXF** — a named `BLOCK` definition (`SL_<KEY>`) plus an `INSERT` at the placed position, with
  `ATTDEF`/`ATTRIB` for its schedule fields. One selectable object in CAD, one clean reusable block,
  and it **explodes** back to its component primitives on the correct layers if needed.

The object JSON is the source of truth; the DXF block and the SVG preview are **derived, disposable
consumers of the same geometry model** (`A_ARCHITECTURE §1`). Everything below defines the *contents*
of that one definition. The sections map 1:1 onto the schema fields so the owner can see exactly where
each item lives.

---

## 1. Components / parts — what a cabinet block is made of

A cabinet block is an assembly of named parts. Each part is either **drawn** (it contributes geometry
primitives to one or more views) or **referenced** (it is metadata / a companion block, not linework
inside this block). "Drawn in" lists which views actually show the part.

### 1.1 Carcass (the box) — always DRAWN
| Part | Drawn in | Notes |
|---|---|---|
| Left side panel | Plan (edge), Front (implied by outline), Side (full) | thickness = `carcassThk` (16–19 mm) |
| Right side panel | Plan, Side | mirror of left |
| Bottom panel | Side, Section | at top of toe-kick zone |
| Top / top rails | Side, Section | base units use two front/back **rails**, not a full top (worktop sits above); tall/wall units use a full top |
| Back panel | Side (thin line), Section | set in by `backSetin`; drawn as a thin/hidden edge, not a heavy outline |
| Carcass footprint | **Plan** (hero) | the `W×D` rectangle on `SOL-RIHUT` — the single most important line |

> At 1:50 the carcass reads as **one rectangle per view**; individual panel thicknesses are implied,
> not separately drawn, except in **Section** (see §3).

### 1.2 Shelves
| Part | Drawn / referenced | Notes |
|---|---|---|
| Fixed shelf | Section only (dashed in Front optional) | count from param `fixedShelves` |
| Adjustable shelf | Referenced (count in attributes/BOM) + optional dashed Section line | **default 1** adjustable shelf for a door base (open question §Q3) |

Shelves are **not** drawn in Plan or Front on a standard closed cabinet (doors hide them). They appear
in **Section** and feed the BOM count.

### 1.3 Doors — DRAWN (the defining feature of a door cabinet)
| Aspect | Where | Driven by |
|---|---|---|
| Door leaf face | Front (panel rectangles with reveal gap), Plan (front edge line) | `doorCount` (1–2) |
| Door-swing arc | **Plan** (quarter-arc, radius = leaf width) | `showSwing`, `hingeSide` |
| Hinge side | determines arc origin + handle position | `hingeSide` = L / R / split |
| Overlay vs inset | changes reveal geometry (overlay: door covers carcass edge; inset: door sits flush within) | param `doorMount` — **default overlay** (open question §Q1) |

The **door-swing arc convention** is fixed: arc radius **= leaf width**, sweep **90°** per leaf,
origin at the hinge knuckle — the same convention the converter uses for door leaves in
`element_symbols_soline.js`, and QA-checked by `arc-sanity` (`I_QA_STANDARD`).

### 1.4 Drawers — DRAWN (for `KIT-BASE-DW-*`)
| Aspect | Where | Driven by |
|---|---|---|
| Drawer front(s) | Front (stacked rectangles with reveal gaps), Plan (front edge) | `drawerCount` + `drawerHeights[]` |
| Drawer front heights | Front division | `drawerHeights[]` (e.g. pan drawers = 2 tall; 3-drawer = graduated) |
| Drawer box | Referenced / Section (dashed) | not drawn in Plan/Front (behind the front) |
| Open indication | Plan (optional dashed extension) | usually **omitted** on a plan for cleanliness |

A cabinet may mix doors + drawers (e.g. drawer-over-door) — the front is a stack of face panels; the
schema expresses this through the same `doorCount`/`drawerCount`/`drawerHeights` params.

### 1.5 Toe-kick / plinth — DRAWN (base + tall only)
| Aspect | Where | Driven by |
|---|---|---|
| Toe-kick recess | Front (dashed rectangle below carcass), Side (dashed setback line) | `dims.toeKickH` (100), `dims.toeKickSetback` (50) |
| Plinth face | Front | same zone; the recessed panel |

Toe-kick draws on `SOL-RIHUT-HID` (dashed) because it is a set-back / lower plane, not the front face.
Wall units have **no** toe-kick.

### 1.6 Handles / pulls — DRAWN (light detail)
| Aspect | Where | Driven by |
|---|---|---|
| Handle tick | Plan (short tick on front edge), Front (bar/knob glyph) | `handleType` = bar / knob / grip-rail / handleless |
| Position | keyed to `hingeSide` (opposite the hinge) | derived |

Handles draw on `SOL-RIHUT-HW` (lightest weight) — detail, never competing with the carcass. For
`handleless`, no handle glyph is drawn (a J-pull/gola reveal may be shown as a thin Front line).

### 1.7 Hinges — mostly REFERENCED
Hinges are **not** drawn as mechanism in Plan/Front at 1:20–1:50 (too fine). They are: (a) a **BOM
line** (count = 2 per door, derived), and (b) optionally a small envelope rectangle in **Section** for
a detail view. `hingeSide` drives door + handle geometry but the hinge itself is metadata.

### 1.8 Legs / levellers — REFERENCED
Adjustable legs behind the plinth: **BOM only** (count 4–6, derived from width). Not drawn.

### 1.9 Fillers & end panels — DRAWN, own subfamily
`KIT-BASE-FL` (filler strip, base end panel, plinth run). A filler is its **own thin block** (e.g.
50 mm wide), not a part of a cabinet. Referenced here because a cabinet run needs them; they are
separate objects in the taxonomy (`B_TAXONOMY` KIT-BASE-FL).

### 1.10 Countertop interface — REFERENCED (base units)
The worktop is a **separate object** (`KIT-TOP-WT`). A base cabinet only draws:
- Plan: a **dashed worktop overhang** line on `SOL-RIHUT-HID` (front + sides, per `clearance`).
- Side: a **worktop cap** rectangle above the carcass (thin) so the elevation reads to worktop height.
The worktop-to-cabinet datum is `dims.worktopH` (900). The full worktop run is placed as its own block.

### 1.11 Valance / light rail — REFERENCED / DRAWN (wall units)
Wall units (`KIT-WALL-*`) may carry a bottom valance/light rail — a thin Front strip below the doors
and a `SOL-RIHUT` line in Side. Base units: n/a.

### 1.12 Summary — drawn vs referenced
- **Drawn:** carcass outline (all views), doors/drawers (Plan+Front), door-swing (Plan), toe-kick
  (Front+Side, dashed), handles (Plan+Front, light), worktop overhang (Plan, dashed) + cap (Side),
  shelves (Section only), valance (wall Front).
- **Referenced (BOM / metadata / companion block):** hinges, legs/levellers, drawer boxes, back panel
  detail, fillers/end panels (own blocks), worktop run (own block), adjustable-shelf count, MEP
  service points (`metadata.mepCompanions`).

---

## 2. Parametric fields — the knobs that drive geometry

Per `C_OBJECT_SCHEMA.params` and `dims`. **Inputs** are authored/edited (by the author or the app
user); **derived** values are computed by the resolver from inputs — never authored, never a magic
number in the generator (`C_OBJECT_SCHEMA §3`).

### 2.1 Inputs (params + dims)
| Field | Where | Type / range | Default | Notes |
|---|---|---|---|---|
| `dims.w` width | dims | number, family band 200–1200 | per variant | drives the width family via `variants` |
| `dims.h` height | dims | number, base 700–760 | 720 | carcass height (not worktop height) |
| `dims.d` depth | dims | number | 560 | base standard |
| `carcassThk` | params | number 16–19 mm | 18 | panel thickness |
| `doorCount` | params | integer 0–2 | 2 | 0 = drawer-only front |
| `drawerCount` | params | integer 0–4 | 0 | for DW families |
| `drawerHeights[]` | params | number[] (mm) | derived if absent | explicit front heights; else equal split |
| `hingeSide` | params | enum L / R / split | split | split = 2-door pair |
| `doorMount` (overlay/inset) | params | enum overlay / inset | **overlay** (Q1) | changes reveal geometry |
| `handleType` | params | enum bar / knob / grip-rail / handleless | bar (Q2) | front pull style |
| `reveal` / gap | params | number mm | 3 | gap between/around faces |
| `showSwing` | params | boolean | true | draw plan door-swing |
| `dims.toeKickH` | dims | number ≥ 0 | 100 | 0 for wall units |
| `dims.toeKickSetback` | dims | number ≥ 0 | 50 | |
| `backSetin` | params | number mm | 40 | carcass back set-in from worktop rear |
| `dims.worktopH` | dims | number | 900 | finished worktop height for the run |
| `material` / finish | attribute (not geometry) | string | blank | see §6 — feeds BOM, not linework |
| `fixedShelves` / `adjShelves` | params | integer | 0 / 1 (Q3) | count → Section + BOM |

### 2.2 Derived (resolver-computed, not authored)
| Derived value | From |
|---|---|
| Leaf width (swing radius) | `(w − 2·carcassThk − reveals) / doorCount` |
| Door/drawer face rectangles + reveal gaps | `w`, `h`, counts, `reveal`, `doorMount` |
| Swing-arc origin + sweep | `hingeSide`, leaf width |
| Handle position | `hingeSide` (opposite hinge), `handleType` |
| Carcass inner box (Section) | `w`/`d`/`h` − `carcassThk` |
| Worktop overhang rectangle | `dims.clearance.worktopOverhangFront/Depth` |
| Toe-kick rectangle | `toeKickH`, `toeKickSetback` |
| bbox per view | the primitive extents (QA `bbox-matches-dims`) |

**Rule (from `C §3`):** validation rejects impossible combinations **before** any geometry (e.g. 2
doors on 300 mm, 3 drawers that overflow height) — caught at the schema/param gate, not in the DXF.

---

## 3. Views & what each shows (aligned to `H_VIEW_MATRIX`)

Cabinets are **●●● Plan / Front / Side required**, Section optional (○) — for a sink/appliance cut
(`H_VIEW_MATRIX §1`, `KIT-BASE-*` row). Datums per `F_INSERTION_POINTS §3`.

### 3.1 Plan (the hero view — the one the measurement plan places)
Top-down at worktop level. Shows:
- Carcass **footprint** `W×D` rectangle — `SOL-RIHUT`.
- **Door-swing arcs** (quarter-arc per leaf, radius = leaf width) — `SOL-RIHUT-DOOR`; front-edge door
  division line.
- Drawer front edge line (no swing) — `SOL-RIHUT-DOOR`.
- **Worktop overhang** dashed line (front + sides) — `SOL-RIHUT-HID`.
- **Wall side** = the rear face at Y=0 (the anchor edge); front faces +Y into the room.
- Handle tick on front edge — `SOL-RIHUT-HW`.
- Visible `UNIT` tag (e.g. "B3") — `SOL-TEKST`.

### 3.2 Front (elevation — drives kitchen elevation drawings)
Looking at the face, finished floor at Y=0. Shows:
- Carcass outline over the toe-kick — `SOL-RIHUT`.
- **Door / drawer divisions** (face rectangles with reveal gaps) — `SOL-RIHUT-DOOR`.
- **Handles** (bar/knob glyph) — `SOL-RIHUT-HW`.
- **Toe-kick / plinth** dashed recess — `SOL-RIHUT-HID`.
- Gaps/reveals between faces.

### 3.3 Side (depth profile)
X=0 wall face, Y=0 floor. Shows:
- Depth × height carcass — `SOL-RIHUT`.
- **Worktop cap** above carcass (base) — thin `SOL-RIHUT`.
- **Toe recess** setback dashed line — `SOL-RIHUT-HID`.
- Wall-unit projection / valance (wall families).

### 3.4 Section (optional — when a cut is needed)
Only where a footprint/elevation can't convey it: sink-base bowl cut, appliance housing, shelf
positions. Shows carcass panel **thicknesses** (the only view where panels are drawn individually),
shelves, back panel, toe-kick construction. Poché/hatch on `layers.fill` if used.

### 3.5 Line-detail legibility — 1:20 vs 1:50 (what to draw / omit)
| At scale | Include | Omit |
|---|---|---|
| **1:20** (elevation detail) | reveal gaps, handle glyph shape, drawer graduations, toe-kick line, individual panel edges in Section | hinge cups, screw detail |
| **1:50** (kitchen plan — the deliverable) | carcass rectangle, swing arc, worktop overhang, unit tag, single handle tick | reveal gaps (imply as single line), separate panel thicknesses, hinge/leg/box detail, shelf lines |

**Guiding rule:** the Plan at 1:50 must read as a clean footprint + swing + tag. Everything finer
(reveals, hardware shape, panel thickness) belongs to Front/Section at 1:20. This matches the
converter's "never clutter the plan" discipline (`DXF_PRO_STANDARDS §4`, cited in `G_ATTRIBUTES §3`).

---

## 4. Layers — where each part draws (per `E_LAYERS`)

All cabinet geometry lives under the freezable `SOL-RIHUT*` group (`E_LAYERS §2`). There is **no
`docs/LAYERS.md`** in the repo (confirmed 2026-08-22); `E_LAYERS` is the source of truth, extending
`DXF_PRO_STANDARDS §1`.

| Part / role | Layer | ISO-128 wt | ACI | Linetype |
|---|---|---|---|---|
| Carcass footprint & outline, worktop cap | `SOL-RIHUT` | 0.25 mm | 42 | CONTINUOUS |
| Door/drawer faces + **swing arcs** | `SOL-RIHUT-DOOR` | 0.25 mm | 42 | CONTINUOUS |
| Handles, hinges, mechanism envelope | `SOL-RIHUT-HW` | 0.18 mm | 8 grey | CONTINUOUS |
| Hidden/dashed edges: worktop overhang, toe-kick, concealed carcass, drawer box, shelves | `SOL-RIHUT-HID` | 0.13 mm | 8 grey | HIDDEN (dashed) |
| Hatch / poché (Section fill, if any) | `layers.fill` (e.g. `SOL-RIHUT` pattern) | per pattern | — | pattern |
| Sink bowl waste / tap plumbing (sink bases) | `SOL-INSTALATSIA` | 0.25 mm | 4 cyan | CONTINUOUS |
| Gas connection (outdoor/hob indication) | `SOL-GAZ` | 0.25 mm | 2 yellow | CONTINUOUS |
| Hood/extract duct indication | `SOL-MIZUG` | 0.25 mm | 141 | CONTINUOUS |
| Block-internal tags / ATTRIB text (`UNIT`…) | `SOL-TEKST` | 0.18 mm | 7 | CONTINUOUS |

**Discipline (`E_LAYERS §3`):** carcass/door = medium (0.25) so the cabinet reads as an object;
hardware/tags = 0.18; hidden = 0.13 dashed. A placed cabinet never out-weights the wall it sits
against (`SOL-KIROT` 0.50). **MEP symbols stay on their discipline layers via
`element_symbols_soline.js` — the block draws only the object** (`E_LAYERS §1`). Each object routes
roles → layers in `layers{}`; any primitive may override with its own `layer`; the emitter
**fails closed** on an unregistered layer (QA `layer-registry` / `role-layer`, `I_QA_STANDARD`).

---

## 5. Insertion point & orientation (per `F_INSERTION_POINTS`)

### 5.1 The anchor
Base / wall / tall cabinets against a wall: **`back-left` corner** = (0,0). A run **tiles by advancing
X by each width** — placement is a single translate (+ single rotate for wall angle). Corner units
(`KIT-CORN`) anchor at the **inner re-entrant corner**; islands at footprint **centre**
(`F_INSERTION_POINTS §2`).

### 5.2 Consistency across views (so the block drops in and mirrors cleanly)
| View | Base point | Rule |
|---|---|---|
| Plan | rear-left = (0,0), footprint into +X,+Y | family anchor |
| Front | X = same as plan X-origin, Y=0 at finished floor | shares plan X datum + floor line |
| Side | X=0 at wall/back face, Y=0 floor | depth grows +X into room |
| Section | same datum as the view it cuts | |

**Consistency rule (QA `insertion-consistency`):** the plan base-point X, the front base-point X and
the side back-face all correspond to the **same real edge**, coincident within 0.1 mm. This is what
lets one block **mirror** (L↔R handedness) cleanly: mirroring about the anchor keeps every view's datum
valid, so the `R` variant is a mirror transform, never a redrawn file (`D_NAMING §1`).

### 5.3 Orientation
`rotationRule: wall-aligned` (rotate to host wall angle), `wallSide: against-wall`. Islands use `free`.
Anchor drawn at exactly (0,0) so the preview crosshair marks it and QA asserts `min(bbox) == anchor`
for corner-anchored families (`F_INSERTION_POINTS §5`).

---

## 6. Attributes / metadata — what feeds the schedule / BOM (per `G_ATTRIBUTES`)

Two channels on the block (`G_ATTRIBUTES §1`): **ATTRIBs** (schedulable, some visible) and
**metadata/XDATA** (traceability, never plotted).

### 6.1 Block ATTRIBs (become ATTDEF in the block, a column in the schedule)
| Tag | Meaning | Visible | Default source |
|---|---|---|---|
| `UNIT` | unit number on plan (B1, W3…) | **yes** (plan, `SOL-TEKST`, 125 mm = 2.5 mm @ 1:50) | assigned at placement (`"B?"`) |
| `WIDTH` / `HEIGHT` / `DEPTH` | nominal mm | no | `dims.w/h/d` |
| `TYPE` | Hebrew type name | no | `hebrewName` |
| `FAMILY` | family code | no | `family` |
| `HINGE` | hinge/handle side | no | param `hingeSide` |
| `HANDLE` | handle style | no | param `handleType` |
| `MFR` / `MODEL` / `FINISH` | manufacturer / series / finish | no | blank (measurer fills) |
| `NOTE` | free note (price/notes hook) | no | blank |
| `KEY` | object key (audit) | no | `key` |

Only `UNIT` is visible — clean plan, full spec hidden in the schedule (`G_ATTRIBUTES §3`). Families
may add tags but must not redefine a reserved tag.

### 6.2 Metadata / XDATA (app id `SOLINE`, per `G_ATTRIBUTES §4`)
`KEY`, `SCHEMA` (1.0.0), `FAMILY/SUB`, `DIMS` (W×D×H), `ORIGINAL_GEOM=true`, `SOURCE_HASH`, `CREATED`
— makes any `.dxf` traceable to its JSON + provenance (`LICENSES.md`). Plus in the object's `metadata`:
`sources[]` (provenance of every dimension — QA fails on unregistered/RED), `mepCompanions[]` (MEP
service points this cabinet needs — sink base → `water_cold`/`water_hot`/`sewage_point`; appliance
housing → `outlet_*`/`gas_point`; **referenced, not drawn** — `A_ARCHITECTURE §4`), `tags`, author.

### 6.3 What feeds the schedule / BOM
On placement the exporter reads each insert's ATTRIBs and groups by `FAMILY`+`TYPE`+`WIDTH` → a kitchen
schedule (unit no. / type / W×H×D / hinge / count), the same pattern as the opening schedule
(`opening_schema.js` marks D1/W1). The **hardware/parts BOM** (hinges ×2/door, legs, shelves, handles)
is derived from params at resolve time and carried in `library.index.json` per object.

**MEP companions** feed a second table: a placed sink base can auto-suggest its water/drain points, an
appliance housing its outlet/gas — from `metadata.mepCompanions[]`, drawn by the symbol module, not the
block (`A_ARCHITECTURE §4`).

---

## 7. DXF block structure — how it becomes a real BLOCK (+ INSERT + ATTDEFs)

Node backend, reusing `src/dxf_soline.js` (AC1015; ezdxf absent). The writer **already provides** the
block-definition machinery — Stage 2 adds two thin emitters on top of it, no fork
(`A_ARCHITECTURE §3.3`).

### 7.1 Available today in `src/dxf_soline.js` (verified)
- `blockBegin(h, ctx, name)` / `blockEnd(h, ctx, name)` — AC1015 `BLOCK`/`ENDBLK` wrappers for a named
  user block, owner = its `BLOCK_RECORD`.
- `tablesSection(ext, extraLayers, blockNames, h, ctx)` — registers a `BLOCK_RECORD` per block name and
  the extra `SOL-RIHUT-*` sub-layers in the `LAYER` table.
- `makeHandleGen(start)` — the single monotonic handle seed threaded through entities → tables →
  blocks → objects (deterministic; `A_ARCHITECTURE §7`).
- `g(code, val)` group-code helper, `num`, `heToDxfUnicode` (Hebrew ATTRIB/text), `L`/`colorOf`/`lwOf`
  (layer table, ACI, lineweight).

### 7.2 What Stage 2 must ADD (thin, on the same writer — NOT built now)
- **`ATTDEF` emitter** — one attribute definition entity per `attributes[]` item, placed **inside** the
  block definition (between `blockBegin`/`blockEnd`), with tag/prompt/default/flags/`SOL-TEKST` layer,
  Hebrew via `heToDxfUnicode`.
- **`INSERT` emitter** — places the block at a position/rotation/scale, followed by one **`ATTRIB`** per
  visible/filled attribute (matching the ATTDEFs), the standard AC1015 attributes-follow flag.
- **primitive → entity** map — `line/rect/circle/ellipse/arc/poly/label/hatch` → `LINE`/`LWPOLYLINE`/
  `CIRCLE`/`ELLIPSE`/`ARC`/`LWPOLYLINE`/`MTEXT`/`HATCH`, each on the primitive's resolved layer.

### 7.3 The three requirements this structure satisfies
1. **One selectable object in Soline** — the block is a single `BLOCK` definition; the app treats an
   `INSERT` of `SL_<KEY>` as one item (select/move/edit params/read ATTRIBs).
2. **Clean reusable DXF block** — a named, layer-correct, ATTDEF-carrying `BLOCK` definition emitted
   once, `INSERT`ed many times; the block name `SL_<KEY>` (`D_NAMING §2`) guarantees no collision with
   converter `*Model_Space`/anonymous blocks or MEP glyphs. Every carcass/door/hardware primitive is on
   its correct `SOL-RIHUT*` layer, so blocks drop into converter output with identical layer/lineweight
   tables — zero impedance mismatch (`A_ARCHITECTURE §3`).
3. **Explodes correctly** — because each part is drawn on its **own semantic layer** inside the block
   (carcass → `SOL-RIHUT`, swing → `SOL-RIHUT-DOOR`, hardware → `SOL-RIHUT-HW`, hidden → `SOL-RIHUT-HID`,
   tags → `SOL-TEKST`), an explode drops the primitives onto those layers unchanged — nothing collapses
   to layer 0. This is the `role-layer` QA guarantee (`I_QA_STANDARD`).

### 7.4 Deterministic identity
Block name = `SL_<KEY>` (uppercase, `-`→`_`, ≤31 chars where practical). Handles derived from the key
so a regenerated library is stable in version control (`D_NAMING §2`, `A_ARCHITECTURE §7`). QA
`block-parses` re-parses the emitted DXF with `dxf-parser` to confirm valid AC1015.

### 7.5 Pipeline placement (context, not this stage)
`object.json` → **validate** (ajv vs `C_OBJECT_SCHEMA`) → **resolve** (params → geometry model) →
**emit_dxf** (this structure) + **emit_svg** (same model → preview) + **index** → **QA** → **contact
sheet** → owner gate (`A_ARCHITECTURE §1`, `I_QA_STANDARD §1`). **We are at Stage 1 (spec) — nothing
past resolve exists yet.**

---

## 8. תקציר לאישור הבעלים (Hebrew summary)

בלוק ארון מטבח מוגדר **פעם אחת** כקובץ `object.json` מאומת, ומשמש גם כאובייקט חי בתוך תוכנת סולין וגם
מיוצא ל-DXF כבלוק אמיתי בשם `SL_<KEY>`. הבלוק מכיל: **גוף הארון** (2 צדדים, תחתית, פסי חיזוק/גב) שמצויר
בכל המבטים; **דלתות ומגירות** עם פתיחת דלת בתוכנית (קשת ברדיוס = רוחב עלה); **סוקל/רגלית** מקווקו;
**ידיות** בקו דק; **משטח עבודה** כקו חופף מקווקו בתוכנית. פריטים כמו צירים, רגליות, מדפים ותושבות MEP
**נרשמים לרשימת הכמויות בלבד** ואינם מצוירים. שלושה מבטים חובה — **תוכנית, חזית, צד** — ומבט **חתך**
לפי צורך. השכבות: גוף על `SOL-RIHUT`, פתיחות על `SOL-RIHUT-DOOR`, ידיות על `SOL-RIHUT-HW`, קווים
נסתרים על `SOL-RIHUT-HID`, טקסט על `SOL-TEKST`. **נקודת השתלה** = פינה אחורית-שמאלית, כך שרצף ארונות
נבנה בהזזה של הרוחב בלבד, והבלוק משתקף נכון לגרסת שמאל/ימין. כל בלוק נושא **מאפייני ATTRIB** (מספר יחידה
גלוי + רוחב/גובה/עומק/סוג/צד ציר נסתרים) שמזינים את טבלת הכמויות במטבח. המבנה מבוסס על הכותב הקיים
`src/dxf_soline.js` (ezdxf לא זמין), כך שהבלוק (א) הוא אובייקט אחד בסולין, (ב) מיוצא כבלוק DXF נקי לשימוש
חוזר, (ג) מתפרק חזרה לרכיבים על השכבות הנכונות. **בשלב זה זו מפרט בלבד — לא נוצר שום בלוק.** נא לאשר את
האנטומיה כדי שנוכל לייצר את חמשת ארונות הבסיס הראשונים (300/450/600/800/900).

---

## 9. Open questions for the owner (decide before the first block)

1. **Overlay vs inset default** — most modern Israeli kitchens are **overlay** (door covers the carcass
   edge). Confirm overlay as the library default `doorMount`, with inset as an opt-in param? *(affects
   reveal geometry in Front.)*
2. **Handle style default** — default `handleType`? Proposed **bar** pull. Should `handleless` (gola /
   J-pull) be a first-class variant given its prevalence in current designs?
3. **Adjustable-shelf count** — default number of adjustable shelves in a door base (proposed **1**)?
   Drawn only in Section + counted in BOM.
4. **Drawer graduation** — for a 3-drawer base, equal-height fronts or **graduated** (smaller top,
   larger bottom)? And pan-drawer (2-drawer) proportions.
5. **Toe-kick height / worktop height** — confirm **100 mm** toe-kick and **900 mm** finished worktop
   as the Israeli-standard defaults (720 carcass + 100 plinth + ~40 worktop ≈ 860–900)?
6. **Carcass thickness** — default **18 mm** (16–19 range) for the whole library?
7. **Depth** — base **560 mm** carcass / **600 mm** worktop as standard? Wall-unit depth (proposed 300)?
8. **Section on base cabinets** — generate Section only for sink/appliance bases (per `H_VIEW_MATRIX`),
   or for every base cabinet? *(Affects block count per cycle.)*
9. **Handedness policy** — ship 1-door bases as **L** default with **R** as an on-demand mirror variant
   (per `J_FIRST20`), rather than both up front?

---

## STOP — awaiting owner approval

This document is a **specification only**. No geometry model, DXF block, preview, or contact sheet has
been generated. Per the pipeline gate (`I_QA_STANDARD §1`, `J_FIRST20`), **the first cabinet block will
not be produced until the owner approves this anatomy** (and answers §9). On approval, Cycle 1 is the
five base-cabinet width variants (300/450/600/800/900) from the single `KIT-BASE-DR` object file.
