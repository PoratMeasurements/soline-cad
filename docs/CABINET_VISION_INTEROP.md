# Cabinet Vision Interoperability — how Soline can write files that OPEN in Cabinet Vision

**Date:** 2026-08-25 · **Author:** research for Michael · **Mode:** public-web research + design. No Soline
source changed. Units mm unless noted.

> **Scope.** How Soline's measured room + elements can reach **Cabinet Vision** (Hexagon's cabinet
> CAD/CAM). What Cabinet Vision imports, the structure of each format, whether an external tool can *write*
> it, the fidelity/difficulty, plus Cabinet Vision's data model ("language"). Ends with a ranked
> recommendation and a first concrete target.
>
> **IP note.** File-format interoperability (writing a file another program can open) is lawful — this doc
> records *structure/spec*, never vendor artwork or code. Formats below are documented in Hexagon's own
> public Help. Nothing here requires bundling a vendor file. See `docs/INTEROP_COMPLIANCE.md` for the
> separate (and important) question of redistributing vendor *content*.

---

## 0. Bottom line (read this first)

1. **Cabinet Vision has two documented, plain-text room/order import formats that any external tool can
   write: `ORDX` (XML, modern, native room format) and `ORD` (ASCII, older, fully specced).** These are
   the realistic ways to get a Soline room + its elements to *open natively* in Cabinet Vision — walls,
   windows, doors, appliances and fixtures land as real CV objects, not a traced underlay.
2. **Soline already has an ORDX exporter** (`converter/src/export_ordx.js` — see
   `docs/INTEROP_COMPLIANCE.md`). ORDX *is* Cabinet Vision's native room-exchange XML. So the single most
   valuable path is **already partly built**; the work is to align it to the published ORDX spec and map
   Soline's element catalog into it.
3. **The best *first* target is actually `ORD` (the ASCII Extended format)** as a fast, low-risk proof —
   then graduate to ORDX for full fidelity. Rationale in §5.
4. **"CVSM" is not a Cabinet Vision product.** It is Soline's internal nickname for the room-measure app
   `com.roommeasure.app` (a competitor/reference app Soline studied). The "CV" in its package headers
   ("CV Setup Unicode Package", `CVTemplate3d`) *does* mean **Cabinet Vision** — the app hosts Cabinet
   Vision's content engine — but CVSM itself is a measuring app, not Hexagon software. Details in §7.

---

## 1. Company / product landscape

| Layer | What it is |
|---|---|
| **Hexagon AB** | Parent. Cabinet Vision sits in **Hexagon Manufacturing Intelligence → CAD/CAM (CAM/Production Software)**. Product hub: `hexagon.com/products/…/cabinet-vision`, `cabinetvision.com`. |
| **Vero Software** | The brand that owned Cabinet Vision before Hexagon. Vero was founded 1988 (N. Italy), acquired by Hexagon in 2014; Cabinet Vision is one of its woodworking brands (alongside Alphacam, Edgecam). Legacy docs live under `content.planit.com` / `cabinetvision.com`. |
| **Planit** | The developer/reseller lineage (Planit Solutions built Cabinet Vision; regional Planit sites — planit.com / planitcanada.ca / planitaustralia.com.au — still sell and document it). |
| **Cabinet Vision editions (levels)** | Tiered: **Solid Drafter → Solid Essential → Solid Standard → Solid Advanced → Solid Ultimate.** UCS automation and 3D-DXF/SketchUp import require **Advanced/Ultimate**. |
| **S2M Center (Screen-To-Machine)** | The CAM/nesting companion — turns CV assemblies into machine output (MPR, DXF, G-code, nested patterns). Sold as **S2M Essential / Advanced**. |

Cabinet Vision is a **design-for-manufacturing** package: you design rooms and cabinets on screen, and it
drives cut lists, labels and CNC. That framing matters — CV's richest data is *manufacturing* data
(parts, materials, joinery, routes), and its import formats are richer at the **room + cabinet-order**
level than at the raw-geometry level.

---

## 2. Import-format matrix (ranked for Soline's purpose)

"Can Soline write it?" = can an external converter emit it from Soline's measured model without owning
Cabinet Vision. Fidelity = how much of a real room/element survives. Difficulty = engineering effort.

| Rank | Format | Kind | What it carries | Structure | Soline can write? | Fidelity into CV | Difficulty |
|---|---|---|---|---|---|---|---|
| **1** | **ORDX** | XML (`.ordx`) | **Native CV room**: multiple rooms, walls, dimensions, angles, windows, doors, openings; **cabinets/assemblies**; **PartOverrides** (per-part dims + custom parameters); per-part **Shape** (line/arc entities); Face & Interior sectioning | Property-tree XML; `<PartOverrides>`, `<Shape><template>` entities, typed `<parameter>` | **Yes** — pure XML; Soline already has an ORDX exporter | **Highest** — arrives as native CV geometry, no tracing | Med–High (spec is "maturing"; validate against sample) |
| **2** | **ORD** (Extended) | ASCII text (`.ord`) | Room: **Walls, Windows, Doors, Appliances, Floors, Moldings, Lights, Fixtures**; **Cabinets** pulled from a catalog by nomenclature, with door styles/options/materials; per-cabinet Note/Attribute **Parameters** | `[Header]` + `[Catalog]`/`[Cabinets]` section pairs + extended room sections; comma-separated fields | **Yes** — trivial to emit (it's INI-like ASCII, fully documented) | **High** for room + placed elements; cabinets require CV catalog names to exist | **Low** — easiest to prototype |
| 3 | **3D DXF (object import)** | DXF R12/R13 polygon mesh | A **visual solid** attached to a CV Part Type | Polyface Mesh or 3D Face; materials **BY LAYER**; no arcs/text/blocks | Yes (write R12/13 mesh) | **Low** — "**not machinable, visual only**" per CV Help | Low–Med, but low payoff |
| 4 | **Room-level / Leica DXF (walls)** | 2D DXF | Wall lines → CV room outline | Layered DXF; CV also has a dedicated **Leica DXF Import** for DISTO plans | Yes | Med — walls only; elements not native | Low–Med |
| 5 | **SketchUp model import** | `.skp` | 3D visual geometry | SketchUp file | Only if Soline emits `.skp` (extra dependency) | Low (visual) | Med |
| 6 | **UCS (User Created Standards)** | CV-internal script (`UCS:M` macro or `UCS:JS` JavaScript) | *Automation logic*, not geometry ingest | Runs against CV's **Object Tree** (GetParameterValue/SetParameter) | N/A — runs *inside* CV; not an external write target | — (shop-side) | High to author, wrong tool for ingest |
| 7 | **S2M output (DXF+data / MPR / G-code)** | CAM output | Nested parts, toolpaths | Layered DXF + "Cncrun" data file; MPR/WoodWOP | This is CV **output**, not ingest — not a Soline path | — | — |

**Read:** rows 1–2 are the real answer. Row 3–5 are "visual underlay" fallbacks. Rows 6–7 are *not*
external ingest paths (UCS is in-app automation; S2M is CV→machine output) and are included so they're not
mistaken for one.

---

## 3. The two winning formats — structure detail

### 3.1 ORD (ASCII) — the fast, fully-documented target

Order-Entry format, **Version 4**, ASCII, "version and configuration independent." Hierarchy:

```
[Header]           ← job defaults (unit, customer, default door styles, material schedules…)
Version=4
Unit=1             ← 0 = Imperial, 1 = Metric
...
[Link] [Walls] [Windows] [Doors] [Appliances] [Floors] [Moldings] [Lights]   ← Extended (room) sections
[Catalog]          ← which CV catalog + door styles/options/materials the next cabinets use
Name="Generic.cvc"
[Cabinets]         ← cabinets pulled from that catalog by nomenclature
1,"B21R",21.0,34.5,24.0,"R","L",1,"",2,10.0,0.0,0.0
[Catalog] … [Cabinets] …   ← repeat pairs for other catalogs/styles
```

Key sections for **Soline's measured room + elements** (this is the mapping that matters):

- **`[Walls]`** — 14 comma-sep fields per wall: `X, Z, Direction, Length, Height, Thickness, WallNumber,
  WallType(1 Exterior/2 Interior/3 Peninsula/4 Radius), LeftWallNumber, Radius, RadiusRotation, ArcAngle,
  WallID, ModifyCode`. Define **clockwise** for stable numbering; shared endpoints auto-join. Radius walls
  supported (fields 10–12).
- **`[Windows]`** — `Width, Height, Comment, WallNumber, OffsetFromWallStart, DistanceFromFloor, ID,
  ModifyCode`. Wall face selectable via `3-F` (front) / `3-B` (back).
- **`[Doors]`** — `Width, Height, Comment, WallNumber, OffsetFromWallStart, ID, ModifyCode`.
- **`[Appliances]`** — `Type, W, H, D, Comment, WallNumber, Offset, DistanceFromFloor, …`. **Type enum:**
  1 Refrigerator, 2 Hood, 3 Microwave, 4 Range, 5 Dishwasher, 6 Compactor, 7 Washer, 8 Dryer, 9 Cook Top,
  **10 Sink**, 11 Under-Counter Oven, 12 UC Range, 13 UC Refrigerator, 14 Refrigerator Box, 15 Wall Oven.
- **`[Fixtures]`** (Extended) — `WallNumber, Offset, DistanceFromFloor, Outset, FixtureType, Comment, ID,
  ModifyCode`. **FixtureType enum:** **1 Power Outlet, 2 Power Switch, 3 Phone Line, 4 Pipe Line.** ← This
  is where Soline's electrical/plumbing **elements** map directly.
- **`[Floors]`** — polygon of X,Z pairs (≥3). **`[Moldings]`** — Crown/LightRail/Scribe/BaseBoard/ChairRail/
  Casing on a wall, XZ (plan) or XY (elevation). **`[Lights]`** — one Ambient + Spot/Directional.
- **`[Cabinets]`** — 9 base fields (`OrderNo, Nomenclature, W, H, D, Hinging, EndTypes, Qty, Comment`) +9
  positional fields in Extended mode (`WallNumber, Offset, DistanceFromFloor, Outset, Type, FillMode,
  SectionCode, ID, ModifyCode`). `Type` enum covers Upper/Base/corner/Tall/Closet families.
- **`[Parameters]`** — precede a cabinet to stamp Note/Attribute params:
  `Attribute="My Dimension","MYDIM","meas",26.75` (types: `meas/deg/int/bool/dec/text`).
- Jobsite-Companion extras: **`[Texts] [Photos] [Photos→.jpg] [Voices→.wav]`** anchored to a wall +
  offset + height — a natural home for Soline's per-element **photos** and notes.

**Why it's the easy first target:** it is line-oriented ASCII with an explicit field table and a worked
sample in Hexagon's Help; **Extended ORD** makes walls + placed elements *visible in Layout*. The only
external dependency is that any `[Cabinets]` you reference must match nomenclature/door-style/material
names that exist in the target seat's catalog (`CVData.mdf`) — but **walls, windows, doors, appliances,
fixtures, floors and photos need no catalog** and carry Soline's core deliverable on their own.

### 3.2 ORDX (XML) — the high-fidelity target (and what Soline already emits)

"Follows the formatting of Properties throughout a Job." Unlike ORD it supports **multiple Rooms** and
**Face + Interior Sectioning per Assembly**. Hexagon ships a **sample** at `\Support\Sample ORDX\`.

Core mechanisms:

- **Object-Tree part paths** identify everything, e.g. `Cab.Case.LF`, `Cab.Case.TO`, `Cab.Interior.AS@2`
  (cabinet → case → part; `@n` = instance). This *is* CV's data-model addressing exposed as text.
- **`<PartOverrides>`** — per-part overrides of the standard 9 parameters (`X, Y, Z, DX, DY, DZ, AX, AY,
  AZ`-style) plus arbitrary custom `<Parameter><Name><Type><Value>`:
  ```xml
  <PartOverride>
     <Name>Cab.Case.TO</Name>
     <Y>760</Y> <DZ>20</DZ> <AX>-65</AX>
     <Parameter><Name>GOAT</Name><Type>M</Type><Value>0.925</Value></Parameter>
  </PartOverride>
  ```
- **`<Shape>`** — free-form part outline as a `<template>` of `<entity type="line2d">`/arc entities with
  `<Begin>/<End>` X/Y (omitted coords default to 0); entities can carry typed `<parameter>`s. Also allowed
  in an `AdditionalParts` section for manually added parts.
- **Parameter value types** (the `<value type="…">` / `<Type>` enum): `1 Measurement, 2 Degrees, 3 Radians,
  4 Integer, 5 Boolean, 6 Decimal, 7 PartID, 8 Text, 9 Currency, 10 Unsigned, 11 GUID, 12 ShapeID`.

Third-party writers prove ORDX is the standard ingest: **iMapper**, **Flexijet 3D**, the **Leica Cabinet
Vision App (DISTO)** all export `.ordx` that "opens directly in Cabinet Vision… walls, dimensions and
angles in place as native CV objects," metric or imperial, CV **2020–2025**. That is exactly Soline's use
case.

---

## 4. Cabinet Vision's data model / "language" (summary)

- **Hierarchy (Object Tree):** `Job → Room(s) → Wall/Layout → Assembly (cabinet) → Part → (Route / Shape /
  Material / Hardware)`. Everything is addressable by a dotted path (`Cab.Case.LF`) with `@n` instances —
  this is the same addressing ORDX uses.
- **Parts** carry the **standard 9 parameters** (position X/Y/Z, size DX/DY/DZ, rotation AX/AY/AZ) plus any
  number of custom parameters (typed: Measurement/Degrees/Integer/Boolean/…). Part outlines are **Shapes**
  = ordered line2d/arc entities in a chosen axis plane (XY/XZ/YZ).
- **Materials / hardware / door styles** live in catalogs and schedules referenced **by name** (from
  `CVData.mdf` / `.cvc` catalogs): Material Schedules, Door Styles (7-field: name, material, outside/inside/
  raised-panel profile, route pattern, door DB), Construction methods (Face Frame / 32 mm / Frameless /
  Overlay), edge/route **profiles**.
- **Joinery / construction** is expressed as **construction methods + routes/profiles** on parts, not as
  explicit joints — you pick a construction schedule; CV generates the joinery and machining.
- **UCS (User Created Standards)** is CV's **parametric automation language**, in two dialects: classic
  **UCS:M macros** and modern **UCS:JS JavaScript** (with shared **Libraries** = JS classes of static
  methods, referenced as `_libraryname.method()`). A UCS runs against the Object Tree
  (`_this.GetParameterValue('DX')`, `_this.SetParameter(...)`), gated by **Apply Conditions**/`For Each`.
  UCS is how shops *automate* dimensioning, add hardware, enforce standards — it is **not** a geometry
  import channel and runs only inside a licensed CV seat (Advanced/Ultimate).
- **Screen-To-Machine (S2M):** the manufacturing tail. CV/S2M nests parts and outputs **MPR (WoodWOP),
  DXF, G-code, or nested patterns**. When CV exports **layered DXF for CAM** it pairs it with a **"Cncrun"
  data file** carrying parts/materials/quantities/labels, and uses standardized layers — `PANEL*` (part
  outline), `DRILL` (vertical holes), `BOARD*` (board id), `ROUTE 250/375/500/625/750` (dado/rabbet widths
  in thousandths of an inch), with a `…F…`/`…B…` naming convention for two-sided parts. **This is CV→machine
  output, the opposite direction from Soline's ingest**, but it explains what CV ultimately produces from an
  imported room.

---

## 5. Recommended path(s) for Soline

**Goal restated:** emit a file that, double-clicked in a customer's Cabinet Vision, reproduces Soline's
measured **room shape + placed elements** (electrical, plumbing, HVAC, windows, doors, appliances) as native
CV objects — so the cabinet designer starts from a real, dimensioned room instead of tracing.

### Ranked

1. **ORDX exporter aligned to the published spec — the strategic target.** Soline already emits ORDX
   (`export_ordx.js`). Finish it against the Hexagon ORDX spec + the `\Support\Sample ORDX\` reference:
   emit `Room` walls/dimensions/angles, window/door openings, and (where Soline has cabinetry) assemblies
   with `PartOverrides`/`Shape`. This is the **highest-fidelity, plugin-free, CV-2020-through-2025** route,
   and it matches exactly what iMapper/Flexijet/Leica do. Feasibility: **high** (it's XML; partly built).
   Risk: the spec is explicitly still "maturing," so validate empirically against a licensed seat.

2. **ORD (Extended ASCII) exporter — the fast first proof, RECOMMENDED as first target.** In days, emit a
   `[Header]`(metric) + `[Walls]` + `[Windows]`/`[Doors]`/`[Appliances]`/`[Fixtures]` + `[Floors]` +
   `[Photos]` file from Soline's measured model. No catalog dependency for the room+elements; opens in CV
   and drops the room into Layout with the elements placed. It's the cheapest way to *prove the pipeline
   and validate coordinate/units conventions* before investing in ORDX polish, and it's a useful shipping
   format on its own for shops on older CV.

3. **DXF underlay (room-level 2D walls, or 3D visual objects) — fallback only.** If a customer's workflow
   or CV level blocks ORD/ORDX, emit a layered wall DXF (traceable) or R12/13 mesh objects. Low fidelity
   ("not machinable, visual only" for 3D objects); use only as a compatibility shim.

### Best first target: **ORD (Extended)** — why

- **Fully published field-by-field** with a worked sample (no reverse-engineering, no gated spec).
- **Plain ASCII** — trivial to generate and diff; easy for Michael to eyeball.
- **Its enums line up with Soline's element catalog almost 1:1:** `[Fixtures]` (Power Outlet / Power Switch
  / Phone / Pipe), `[Appliances]` (Sink/Range/Hood/Dishwasher/…), `[Windows]`, `[Doors]` — i.e. Soline's
  measured electrical/plumbing/appliance elements have a native home *today*.
- **Room + elements need no CV catalog** to import, so a Soline-only file opens cleanly on any seat.
- It de-risks the coordinate model (X/Z plan, wall-relative offset + height, clockwise walls) that ORDX
  also uses — so ORD work is not throwaway; it directly informs the ORDX exporter.

Then **promote to ORDX** for multi-room, part-level shapes, and richer parameters.

### Implementation sketch — what Soline's converter would emit (ORD first)

```
[Header]
Version=4
Unit=1                       ; metric, mm
Name="<job>"  Customer="<client>"
[Walls]                      ; clockwise; X,Z,Direction,Length,Height,Thickness,WallNo,Type=1,,,,,,N
0,0,90,4000,2700,100,1,1,,,,,,N
...
[Windows]  W,H,Comment,WallNo,OffsetFromStart,HeightFromFloor,ID,N
[Doors]    W,H,Comment,WallNo,OffsetFromStart,ID,N
[Appliances] Type,W,H,D,Comment,WallNo,Offset,FloorZ,...   ; e.g. 10=Sink,5=Dishwasher
[Fixtures] WallNo,Offset,FloorZ,Outset,Type,Comment,ID,N   ; 1=Outlet 2=Switch 3=Phone 4=Pipe
[Floors]   x1,z1,x2,z2,x3,z3,...
[Photos]   WallNo,Offset,FloorZ,"<path>.jpg",ID,N          ; Soline per-element photos
```
Mapping layer in Soline: `element.discipline/category → ORD section + type enum`; `element.width_mm/
height_mm/depth_mm → dims`; `element.wall + offset_mm + mount_height_mm → placement`. Soline's existing
`elements.json` (mm dims, mount heights, discipline) already holds every field this needs. Cabinets, if any,
go in `[Catalog]`/`[Cabinets]` with nomenclature the customer's catalog defines (leave empty for
measure-only jobs).

For ORDX, the same model serializes to `Room` walls + `PartOverrides`/`Shape` XML with typed parameters.

---

## 6. Open questions / what needs a licensed Cabinet Vision to confirm

- **ORDX exact schema & required elements.** Hexagon's page says the spec is still maturing and points to
  the in-install `\Support\Sample ORDX\` sample as the real reference. **Need a licensed seat** to obtain
  that sample and to round-trip (export a known room → read the XML → reproduce it).
- **Coordinate/units conventions in practice** — ORD/ORDX wall origin, direction sign, plan axis (X/Z),
  radius-wall angle sign, and whether metric `Unit=1` values are mm or cm. Confirm empirically.
- **Which element types survive as *native* vs. get dropped.** ORD covers outlets/switches/phone/pipe/
  appliances/windows/doors — but Soline's catalog is broader (HVAC, gas, data, safety, drainage). Those
  without a native enum will need to ride as **Fixtures+Comment**, **Photos/Texts annotations**, or (ORDX)
  custom parameters — verify how CV renders them.
- **CV level gating.** Does plain ORD/ORDX import work on **Solid Essential/Standard**, or only Advanced/
  Ultimate? (3D-DXF-object and SketchUp import are Advanced/Ultimate features.)
- **Catalog-name coupling for cabinets.** Any `[Cabinets]`/assemblies reference names in the customer's
  `CVData.mdf`/`.cvc`; a Soline file can't assume those exist. Confirm the measure-only (no-cabinet) path is
  the safe default.
- **ORDX vs ORD version drift** across CV 2020→2025 — validate the same file on multiple versions.

**None of the above blocks starting.** ORD can be prototyped and visually checked from the public spec; a
licensed seat is needed only to *certify* fidelity and to unlock the ORDX sample.

---

## 7. CVSM — what it turned out to be

Soline's internal docs use **"CVSM"** for the app **`com.roommeasure.app` (v5.9)** — a **room-measure
application** Soline reverse-studied, not a Hexagon product. Findings:

- **It is a measuring app, not "Cabinet Vision Solid Model."** No Hexagon/Cabinet Vision product is named
  "CVSM." The label is Soline-internal shorthand.
- **But the "CV" in its file headers genuinely means Cabinet Vision.** Its content package is a
  `CV Setup Unicode Package V4.0` (`.pkg` ZIP) whose element definitions are `.bcd` files signed
  `NewCXSchema` containing **`CVTemplate3d` / `CVVertexNode` / `CVFaceData`**, with `.cat` **Assembly
  Catalog Unicode Import/Export File** and `.ucs` **User Created Standards** — these are **authentic
  Cabinet Vision constructs**. So the app **hosts / targets Cabinet Vision's content engine**: it measures
  a room and produces Cabinet-Vision-flavored element/catalog data (`.bcd`/`.cat`/`.ucs`) — the same family
  of objects described in §4.
- **This is the InnoDraw/Flexijet/iMapper pattern.** Public sources show a whole class of measuring tools
  (InnoDraw, Flexijet 3D, iMapper, Leica DISTO app) that measure on site and convert to design-program
  formats — **Cabinet Vision, Raumplan, 2020, AutoCAD, SketchUp, Promob**. `com.roommeasure.app` behaves
  like one of these. Its multi-target nature also explains why Soline's *other* interop doc
  (`docs/INTEROP_COMPLIANCE.md`) discusses **ORDX (Cabinet Vision native) and PDP (Raumplan/InnoDraw)** —
  two different downstream targets of the same measured room.
- **Consequence for this task:** the Cabinet-Vision side of CVSM's output *is* the interop surface this doc
  covers. Soline does not need to replicate CVSM's `.pkg`/`.bcd` solid engine to get elements into Cabinet
  Vision — it should write **ORDX/ORD** (§5), which is Hexagon's own documented, lawful ingest path, rather
  than reproducing a third-party app's Cabinet-Vision content package.

*Uncertainty:* `com.roommeasure.app` was not resolvable on public app stores at research time (Google Play
returned 404 for that package id), so its vendor identity couldn't be independently confirmed from the
store — the identification rests on Soline's own binary analysis (`converter/docs/CVSM_ELEMENTS_LANGUAGE.md`)
plus the corroborating InnoDraw/measuring-app landscape. Treat the vendor name as **unconfirmed**; the
*format facts* (CV package constructs; ORDX/ORD as the real ingest) are well-supported.

---

## 8. Sources

Cabinet Vision / Hexagon official (Nexus Help & product):
- CABINET VISION product — https://hexagon.com/products/product-groups/computer-aided-manufacturing-cad-cam-software/cabinet-vision
- CABINET VISION products/editions — https://www.cabinetvision.com/products
- System requirements — https://www.cabinetvision.com/systemrequirements
- **ORDX Format** (spec) — https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2023_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Export_ORDX/ORDX.Format.xhtml
- Export ORDX — https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2025_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Export_ORDX/Export.ORDX.xhtml
- **ORD File Format** (spec + sample) — https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_Help/page/Room_Level/Ribbonbar/Utilities_Tab/Import_Order/ORD.File.Format.xhtml
- Import DXF (3D objects, rules) — https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2024_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/RL.Import.DXF.xhtml
- Import 3D DXF Objects (FAQ) — https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2025_HELP/page/Tips_Tricks_FAQs/FAQs/HDI-Advanced_Features/Import.3D.DXF.Objects.xhtml
- User Created Standards — https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2024_HELP/page/System_Level/Ribbonbar/Utilities_Tab/Tools_Group/User_Created_Standards/UCS.UCS.xhtml
- Export/Import DXF (Utilities) — https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2025_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/RL.Export.DXF.xhtml
- S2M Center (Essential) — https://www.cabinetvision.com/s2messential ; datasheet host — https://in.cabinetvision.com (S2M Center Datasheet)

Company / lineage:
- Vero Software — https://en.wikipedia.org/wiki/Vero_Software
- Cabinet Vision, Hexagon (Woodworking Network) — https://www.woodworkingnetwork.com/company/cabinet-vision-hexagon
- Planit Canada (Cabinet Vision) — https://planitcanada.ca/solutions/cabinet-vision/ ; Add-ons — https://www.au.planit.com/products/cabinetvision/addons

Third-party writers / integrators (prove ORD/ORDX ingest):
- iMapper → Cabinet Vision (ORDX) — https://www.imapper.tech/integrations/cabinet-vision
- Flexijet 3D (ORDX export) — https://www.flexijet.info/en/blog/flexijet-3d-update-4-0/
- Leica CABINET VISION App (DISTO) — https://shop.leica-geosystems.com/measurement-tools/ics/cabinet-vision-app
- Allmoxy → Cabinet Vision (ORD) — https://articles.allmoxy.com/cabinet-vision-export ; https://articles.allmoxy.com/allmoxy-to-cabinet-vision
- Tractivity ↔ Cabinet Vision (ORD) — https://tractivity.com/cvsoftwareintegration/
- RouterCIM ← Cabinet Vision (S2M layered DXF + Cncrun; layer names) — https://www.cimtechsoftware.com/RouterCIM_Online_Help/cabinetvision.htm
- Craftsman Woodworks — Importing ORDX files — https://craftsmanengineering.com/taxonomy/term/268 ; S2M DXF into S2M Center — https://craftsmanengineering.com/video/cabinet-vision-tutorial-expert-12-importing-dxf-drawings-s2m-center

UCS community references:
- Wikibooks — Cabinet Vision: The Last Mile / User Created Standards — https://en.wikibooks.org/wiki/Cabinet_Vision:_The_Last_Mile/User_Created_Standards
- Wikibooks — UCS Techniques — https://en.wikibooks.org/wiki/Cabinet_Vision:_The_Last_Mile/User-Controlled_Standards_Techniques
- UCS library (JavaScript UCS examples) — https://github.com/patrick-tewell/Cabinet-Vision-UCS-Library

Measuring-app landscape (CVSM context):
- InnoDraw (multi-target: Cabinet Vision, Raumplan, 2020, AutoCAD, SketchUp, Promob) — https://novedge.com/blogs/news/3d-laser-based-measuring-and-drawing-with-innodraw ; https://www.spacemeasurepro.com/
- Soline internal: `converter/docs/CVSM_ELEMENTS_LANGUAGE.md`, `docs/INTEROP_COMPLIANCE.md`
