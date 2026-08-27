# Cabinet Vision Room-Exchange Formats — ORDX & ORD

**A clean-room specification assembled entirely from public web sources**
so Soline can build its own exporter from published facts (no proprietary code or artwork reproduced).

- Author context: research task for Soline Measure. Compiled 2026-08-25.
- Scope: **ORDX** (Cabinet Vision's native XML room format) and its ASCII sibling **ORD** (Order Entry, Version 4).
- Vendor: Cabinet Vision, by Hexagon (formerly PLANIT / 2020 / Vero). Docs live on Hexagon Nexus.
- **Provenance rule:** every field below is transcribed from the public Hexagon "Online Help (HTML)" pages and vendor/reseller pages listed in **Sources**. Where a value is *derived* (inferred from a worked example rather than stated), it is explicitly tagged **[DERIVED]**. Where the public docs simply do not say, it is tagged **[GATED — needs a CV seat]**.

---

## 0. Executive summary — what is public vs. gated

| Format | Public completeness | Notes |
|---|---|---|
| **ORD (v4, ASCII)** | **~Complete.** Every section and every field is published field-by-field with types + enums, plus two full worked examples (standard + extended). | This is the authoritative, buildable spec. An ORD-Extended file already carries Walls, Windows, Doors, Appliances, Fixtures, Floors, Moldings, Lights, Photos, Cabinets. |
| **ORDX (XML)** | **Partial.** Hexagon publishes only the `PartOverrides` / `Shape` / `entity` / parameter-value-type portions and states the format "follows the formatting of Properties throughout a Job." The **Job → Room → Wall → Opening geometry element tree is NOT published** — the help page says *"As the format matures we'll be adding more documentation,"* and points readers to a sample file shipped in the install (`\Support\Sample ORDX\`). | The room-geometry element/attribute names, required-flags, and namespace can only be confirmed by opening that sample file, which requires a licensed CV install. |

**Bottom line for Soline:** Build the exporter against **ORD-Extended v4** — it is fully specified, opens natively in Cabinet Vision 2020→2025, and carries all the room geometry Soline measures (walls, openings, fixtures, floor, photos). Treat ORDX as a later upgrade to be reverse-engineered from a real sample file once a CV seat (or a partner's sample) is available. Third-party measure tools (iMapper, Flexijet, Leica DISTO app) emit ORDX for the "native, no-plugin" open, but functionally the same geometry rides in an ORD-Extended file.

---

## 1. Shared conventions (units, coordinates, angles, signs)

These apply to the ORD-Extended geometry sections. ORDX is stated to follow the same Job-property conventions.

### 1.1 Units
- Controlled by **`[Header] Unit=`**: `0 = Imperial` (inches), `1 = Metric` (millimetres).
- **All** numeric dimensions/coordinates in the file are expressed in that one unit. There is no per-field unit tag in ORD. (ORDX `entity`/`Template` blocks *do* carry a `unit="mm"` attribute — see §3.)
- String values are wrapped in double quotes `"…"`. Numbers are bare. A literal inch mark inside a quoted string appears as `"` and must be escaped/avoided; the docs warn certain characters break Comment fields: `# ? = | ;`.

### 1.2 Coordinate system (plan)
- Plan coordinates are **(X, Z)**: `X` = horizontal, `Z` = depth/plan-vertical. Height is the separate **Y**/elevation axis ("Distance from Floor").
- **Origin:** not fixed by the spec — it is a world origin; walls join wherever endpoints coincide ("If the start or end point of a Wall is the same as an existing Wall, the Walls will be joined at that point"). The published example centres a 100×100 room roughly on the origin. **[DERIVED]** origin is arbitrary; keep it consistent within one file.
- Floor shapes are lists of **(X, Z)** pairs, minimum 3 pairs.

### 1.3 Wall direction & angle sign **[DERIVED from the published Extended example]**
The extended sample defines three connected walls (fields = X, Z, Direction, Length, Height, Thickness):
```
-50, 50,  90, 100, 96, 4.5
-50,-50,   0, 100, 96, 4.5
 50,-50, -90, 100, 96, 4.5
```
Tracing endpoints (each wall's end = next wall's start) yields this rule:

> **end = start + Length · (cos θ, −sin θ)** in (X, Z), with θ = "Wall Direction" in degrees.
> So **0° → +X**, **90° → −Z**, **180° → −X**, **−90°/270° → +Z**.

That is a **clockwise** angle convention in a plan where X points right and Z points "up" the page. This matches Hexagon's instruction to **define/measure walls clockwise** so wall numbers come out in sequence. Radius walls add an explicit rotation flag (0 = CW, 1 = CCW) and an arc angle.

### 1.4 Direction / face sign for openings & attachments
- Any element attached to a wall (Windows, Doors, Appliances, Fixtures, Cabinets, Moldings) references a **Wall Number**. The suffix picks the face:
  - `3` or `3-F` → **front** face of wall 3
  - `3-B` → **back** face of wall 3
- Wall-relative placement uses **"Offset from Wall start"** (along the wall) and **"Distance from Floor"** (elevation), with an optional **"Outset from Wall"** (perpendicular pull-off).
- For "Floor Plan" items (Texts/Photos/Fixtures with Wall Number `0`) the two offsets become absolute plan **X** and **Z**.

---

## 2. ORD (Order Entry) Version 4 — full ASCII spec

**File nature:** ASCII text. Hierarchical: a `[Header]` followed by geometry sections (Extended) and one or more `[Catalog]`/`[Cabinets]` pairs. Order of keys *inside* `[Header]`/`[Catalog]` is not significant; **section order matters** for Extended geometry — the `[Walls]` section must precede anything attached to walls (Moldings, Cabinets).

**Two modes:**
- **Standard** — cabinets go to the Order-Entry list (not drawn in Layout).
- **Extended** (adds `[Walls] [Windows] [Doors] [Appliances] [Fixtures] [Floors] [Moldings] [Lights]`, etc.) — objects appear in Layout (Floor Plan / Elevation / Perspective) exactly as if placed by hand. **If a `[Walls]` section is present, all cabinets attach to walls and become visible.** This is the mode Soline wants.

Top-level skeleton (red = Extended-only in the docs):
```
[Header]  Version=4  …
[Link]    …            (Jobsite Companion only)
[Walls]   …
[Windows] …
[Doors]   …
[Appliances] …
[Fixtures]  …
[Floors]  …
[Moldings] …
[Lights]  …
[Catalog] Name="Catalog 1" …
[Cabinets] 1,… 3,…
[Catalog] Name="Catalog 2" …
[Cabinets] 2,…
```

### 2.1 `[Header]` (mostly optional; `Version` is the one thing that should always be present)

Key=value lines. Selected fields (full list is long; these are the load-bearing ones):

| Key | Type | Meaning |
|---|---|---|
| `Version=` | Integer | ORD version number. **Currently `4`.** Required for forward-compat. |
| `Unit=` | Integer | `0` = Imperial, `1` = Metric. Governs all numeric dimensions. |
| `Name=""` | String | Job name (optional) |
| `Description=""` | String | Job description |
| `PurchaseOrder=""` `Comment=""` | String | Job PO / comment |
| `Customer=""` `Contact=""` `Address1/2=""` `City/State/Zip=""` `Phone/Fax/Mobile/EMail=""` | String | Customer block (all optional) |
| `ShipTo*=""` (same set, prefixed `ShipTo`) | String | Ship-to block |
| `BaseDoors/WallDoors/DrawerFronts=""` `BaseEndPanels/WallEndPanels/TallEndPanels=""` | **Fields** (7-field door-style def, §2.2) | Job-default door/panel styles |
| `ConstructionStyle=""` | String | one of `"Face Frame"`, `"32 mm"`, `"Frameless"`, `"Overlay"` |
| `CabinetConstruction/DrawerBoxConstruction/RollOutConstruction=""` | String | construction-schedule names (must exist in `CVData.mdf`) |
| `*Materials=""` (Base/Wall/BaseExposed/WallExposed/DrawerBox/RollOut/Pull/Hinge/Guide/Molding) | String | material-schedule names |
| `CrownProfile/LightRailProfile/ScribeProfile/BaseBoardProfile/ChairRailProfile/CasingProfile=""` | String | molding-profile names |
| `InteriorFinish/ExteriorFinish=""` `WallTexture/FloorTexture=""` | String | finish/texture names |
| `Perspective=` | **Fields** (5 floats) | initial 3D camera: `HorizDir, VertDir, HorizPan(0-180), VertPan(0-180), ViewDistance` |

**Important for a measure-only exporter:** the door-style, material, finish, texture, profile and construction names must match entries that already exist in the target CV catalog/`CVData.mdf`, otherwise CV can't resolve them. For a pure room/measure export you can **omit them all** and leave cabinets out — walls/openings/fixtures/floor do not depend on any catalog.

### 2.2 Door / Drawer style definition — 7 comma-separated fields
Used by `BaseDoors=`, `WallDoors=`, etc.

| # | Type | Meaning |
|---|---|---|
| 1 | String | Door/Drawer Style Name |
| 2 | String | Door Material Schedule Name |
| 3 | String | Outside Edge Profile Name |
| 4 | String | Inside Edge Profile Name |
| 5 | String | Raised Panel Profile Name |
| 6 | String | Route Pattern Name |
| 7 | String | Door Database Name (e.g. `door.ddb`) |

Empty profile fields still must be present as `""`.

### 2.3 `[Link]` (Jobsite Companion only — ignore for Soline)
`PocketPCPath="" PCPath="" PCDate="" CreateBy=""` (`CreateBy` ∈ `"PC_CW","PC_SOLID",""`).

### 2.4 `[Walls]` — **14 comma-separated fields** (Extended)
Define walls clockwise. Joined automatically at shared endpoints. Only the first 6 fields appear in the published example; the rest are optional/empty for straight non-radius walls.

| # | Type | Meaning |
|---|---|---|
| 1 | Float | Wall **X** position (start) |
| 2 | Float | Wall **Z** position (start) |
| 3 | Float | Wall **Direction** (degrees; see §1.3) |
| 4 | Float | Wall **Length** |
| 5 | Float | Wall **Height** |
| 6 | Float | Wall **Thickness** |
| 7 | Integer | Wall Number (1-based). Empty ⇒ use line count |
| 8 | Integer | **Wall Type** (enum below) |
| 9 | String | **Left Wall Number** attach spec: `#-x` (below). `0`/empty ⇒ no wall attached |
| 10 | Float | Wall **Radius** (radius walls) |
| 11 | Integer | Radius-wall rotation: `0 = CW`, `1 = CCW` |
| 12 | Float | **Arc Angle** for radius wall |
| 13 | Integer | Wall **ID** (host-app identity token) |
| 14 | String | **Modify Code** (enum below) |

**Wall Type enum (field 8):** `1 = Exterior`, `2 = Interior ('T'/extra wall)`, `3 = Peninsula/Island`, `4 = Radius`.

**Left Wall Number format (field 9):** `#-x` where x = empty or `E` ⇒ wall continues from wall # (e.g. `3` or `3-E`); `F` ⇒ attached to **front** of wall # (`3-F`); `B` ⇒ attached to **back** (`3-B`).

**Modify Code enum (field 14, used by many sections):** `S` = Same/no change, `N` = New, `M` = Modify, `D` = Delete, `L` = allow move/delete only, `X` = Lock.

### 2.5 `[Windows]` — **8 fields** (Extended)

| # | Type | Meaning |
|---|---|---|
| 1 | Float | Window Width |
| 2 | Float | Window Height |
| 3 | String | Window Comment |
| 4 | Int | Wall Number (`n` / `n-F` front, `n-B` back) |
| 5 | Float | Offset from Wall start |
| 6 | Float | Distance from Floor (sill height) |
| 7 | String | Window ID (host identity) |
| 8 | String | Modify Code |

> Note: ORD Windows have **no swing/hinge** field. Openings are rectangular by width/height/sill only.

### 2.6 `[Doors]` — **7 fields** (Extended)

| # | Type | Meaning |
|---|---|---|
| 1 | Float | Door Width |
| 2 | Float | Door Height |
| 3 | String | Door Comment |
| 4 | Integer | Wall Number (`n` / `n-F` / `n-B`) |
| 5 | Float | Offset from Wall start |
| 6 | String | Door ID (host identity) |
| 7 | String | Modify Code |

> Note: no sill (doors sit on the floor) and **no swing/hinge** field in ORD.

### 2.7 `[Appliances]` — **13 fields** (Extended)

| # | Type | Meaning |
|---|---|---|
| 1 | Integer | **Appliance Type** (enum below) |
| 2 | Float | Width |
| 3 | Float | Height |
| 4 | Float | Depth |
| 5 | String | Comment |
| 6 | String | Wall Number (`n` / `n-F` / `n-B`) |
| 7 | Float | Offset from Wall start |
| 8 | Float | Distance from Floor |
| 9 | Float | Cabinet Height (**Wall Oven & Refrigerator Box only**) |
| 10 | Float | Appliance above Floor (**Wall Oven only**) |
| 11 | Float | Pull from Wall (outset) |
| 12 | String | Appliance ID (host identity) |
| 13 | String | Modify Code |

**Appliance Type enum (field 1):**
`1 = Refrigerator`, `2 = Hood`, `3 = Microwave`, `4 = Range`, `5 = Dishwasher`, `6 = Compactor`, `7 = Washer`, `8 = Dryer`, `9 = Cook Top`, `10 = Sink`, `11 = Under Counter Oven`, `12 = Under Counter Range`, `13 = Under Counter Refrigerator`, `14 = Refrigerator Box`, `15 = Wall Oven`.

### 2.8 `[Fixtures]` — **8 fields** (Extended)
Electrical/plumbing point features.

| # | Type | Meaning |
|---|---|---|
| 1 | String | Wall Number (`0` if Floor Plan) |
| 2 | Float | Offset from Wall start (X coord if Floor Plan) |
| 3 | Float | Distance from Floor (Z coord if Floor Plan) |
| 4 | Float | Outset from Wall |
| 5 | Float | **Fixture Type** (enum below) |
| 6 | String | Comment |
| 7 | String | Fixture ID (host identity) |
| 8 | String | Modify Code |

**Fixture Type enum (field 5):** `1 = Power Outlet`, `2 = Power Switch`, `3 = Phone Line`, `4 = Pipe Line`.
(These correspond exactly to the point-objects CV's Leica DISTO utility places: Outlet, Switch, Plumbing = Pipe Line.)

### 2.9 `[Floors]` — coordinate-pair list (Extended)
Comma-separated list of **(X, Z)** pairs; **minimum 3 pairs** to define a floor polygon. Multiple floor shapes = multiple lines.
```
[Floors]
X1,Z1,X2,Z2,X3,Z3[,X4,Z4,…]
```

### 2.10 `[Moldings]` — 8 fields + optional extra coordinate pairs (Extended)

| # | Type | Meaning |
|---|---|---|
| 1 | Integer | Wall the molding applies to |
| 2 | String | Molding Type: `"Crown"`,`"LightRail"`,`"Scribe"`,`"BaseBoard"`,`"ChairRail"`,`"Casing"` |
| 3 | String | Molding Axis: `"XZ"` (laid out in Plan) or `"XY"` (applied to wall face) |
| 4 | Float | Elevation (if `XZ`) **or** Outset from wall face (if `XY`) |
| 5 | Float | 1st X |
| 6 | Float | 1st Y/Z |
| 7 | Float | 2nd X |
| 8 | Float | 2nd Y/Z |
| 9+ | Float pairs | additional coordinate pairs (min 2 pairs total) |

### 2.11 `[Lights]` (Extended) — one Ambient + any number of Spot/Directional
`Ambient="Color",Brightness%` (2 fields).
`Spot="Color",Bright%,Softness%,BeamAngle,X,Y,Z,HorizDir(±0-180),VertDir(±0-180)` (9 fields).
`Directional="Color",Bright%,Softness%,HorizDir(±0-180),VertDir(±0-180)` (5 fields).
Colors: `"White","Sky","Sun","Florescent","Incandesent"` (spelled as in the docs).

### 2.12 `[Catalog]` — cabinet catalog + door/option context
Keys: `Name` (catalog db name, `.cvc` auto-appended), `BaseDoorStyle`, `WallDoorStyle`, `Option` (repeatable, 2 fields: `"OptionName","Value"`), plus construction/material/finish/door-style keys mirroring the Header. Cabinets in the following `[Cabinets]` block inherit this context. **Not needed for a measure-only room export.**

### 2.13 `[Parameters]` — per-cabinet Notes/Attributes
Inserted immediately before a `[Cabinets]` line; cleared after that cabinet is consumed.
Format: `Type=Description,Name,ValueType,Value` where `Type` ∈ `Attribute|Note`; `ValueType` ∈ `meas,deg,int,bool,dec,text`.

### 2.14 `[Cabinets]` — 9 fields (Standard) or **18 fields** (Extended, wall-attached)

| # | Type | Meaning |
|---|---|---|
| 1 | Float | Order Entry Number (1-based) |
| 2 | String | Catalog Nomenclature (matches a cabinet in the `[Catalog]`) |
| 3 | Float | Width |
| 4 | Float | Height |
| 5 | Float | Depth |
| 6 | String | Hinging (enum below) |
| 7 | String | End Types (enum below) |
| 8 | Integer | Quantity |
| 9 | String | Comment |
| 10 | String | Wall Number (`n` / `n-F` / `n-B`) — **Extended** |
| 11 | Float | Offset from Wall start |
| 12 | Float | Distance from Floor |
| 13 | Float | Outset from Wall |
| 14 | Integer | Cabinet Type (enum below) |
| 15 | Integer | Fill Mode (enum below) |
| 16 | String | Section Code (e.g. `"3V-D=L-O-D=R"`) |
| 17 | String | Cabinet ID (host identity) |
| 18 | String | Modify Code |

**Hinging (field 6):** `*`=undefined, `P`=pair, `L`=left, `R`=right, `T`=top, `B`=bottom.
**End Types (field 7):** `*`=undefined, `B`=both finished, `L`=left finished, `R`=right finished, `N`=both unfinished.
**Cabinet Type (field 14):** `1`=Upper, `2`=Base, `3`=Diag Corner Upper, `4`=Diag Corner Base, `5`=Lazy-Susan Corner Upper, `6`=Lazy-Susan Corner Base, `7`=Tall, `8`=Diag Corner Tall, `9`=Lazy-Susan Corner Tall, `10`=Closet Panel, `11`=Closet Shelf, `12`=Closet Shelf Diagonal, `13`=Closet Shelf Lazy-Susan, `14`=Closet Door, `15`=Closet Drawer, `16`=Closet Rod, `17`=Closet Unit.
**Fill Mode (field 15):** `0`=Placed, `1`=Fill Top, `2`=Fill Bottom, `4`=Filled left, `8`=Filled right.

### 2.15 Jobsite-Companion-only sections (`[Texts] [Photos] [Voices]`)
Each is a per-item record keyed on Wall Number (`0` = Floor Plan):

`[Photos]` — 6 fields: `WallNumber, Offset(orX), DistFromFloor(orZ), "full\path\file.jpg", PhotoID, ModifyCode`.
`[Texts]` — same shape, field 4 = the text (with embedded `\n`/`\"`).
`[Voices]` — same shape, field 4 = `.wav` path.

> For Soline: `[Photos]` is the documented way to attach jobsite reference photos to a wall or to the plan. Field 4 is a full local path to a `.jpg`.

---

## 3. ORDX (XML) — what is publicly documented

**File nature:** XML. Native Cabinet Vision room/job format. **Multi-room** (unlike ORD's single room) and can express **Face + Interior sectioning per assembly** (which ORD cannot). Opens directly in CV 2020–2025 with no plugin/converter. The help states it *"follows the formatting of Properties throughout a Job."*

### 3.1 The documented pieces

**`<PartOverrides>` / `<PartOverride>`** — overrides on parts identified by their **Object-Tree path** (e.g. `Cab.Case.LF`, `Cab.Interior.AS@2`; `@2` = instance index). The "standard 9 parameters" are always written; extra modified params go in a `<Parameter>` child.
```xml
<PartOverrides>
  <PartOverride>
    <Name>Cab.Case.TO</Name>
    <Y>760</Y><DZ>20</DZ><AX>-65</AX>
    <Parameter><Name>GOAT</Name><Type>M</Type><Value>0.925</Value></Parameter>
  </PartOverride>
</PartOverrides>
```
Named part-transform tags seen: `<X> <Y> <DX> <DY> <DZ> <AX>` (position, size deltas, axis rotation). `<Parameter>` uses `<Type>` codes like `M` (measurement).

**`<Shape>`** (inside `PartOverride`, and inside `AdditionalParts` for manually added parts):
```xml
<Shape>
  <Axis>XY</Axis>            <!-- default XY; also XZ or YZ -->
  <Template firstid="1" unit="mm">
     <entity id="1" type="line2d"><End><x>2</x></End></entity>
     <entity id="2" type="line2d"><Begin><x>2</x></Begin><End><x>1</x><y>1</y></End></entity>
     …
  </Template>
</Shape>
```
- A shape is a series of **entities**: `type="line2d"` (lines) or **arc** entities. Each has `<Begin>`/`<End>` with `<x>`/`<y>`. **Any omitted coordinate defaults to 0** (so a line (0,0)→(2,0) only needs `<End><x>2</x></End>`).
- `Template` carries `firstid` and a `unit` attribute (`mm`).
- Entities may carry `<parameters>` → `<parameter name="…"><value type="N">…</value></parameter>`.

**Parameter value-type codes** (used by `<value type="N">` and `<Parameter><Type>`):

| ID | Name | | ID | Name |
|---|---|---|---|---|
| 1 | Measurement | | 7 | PartID |
| 2 | Degrees | | 8 | Text |
| 3 | Radians | | 9 | Currency |
| 4 | Integer | | 10 | Unsigned |
| 5 | Boolean | | 11 | GUID |
| 6 | Decimal | | 12 | ShapeID |

### 3.2 What ORDX does NOT publish **[GATED — needs a CV seat]**
The entire **room-geometry top of the tree is undocumented on the web**:
- The root element name and any XML namespace/schema/`<?xml?>` header.
- `Job`/`Project` container and its attributes.
- `Room`(s) container(s) and multi-room nesting.
- **Wall** elements (coordinates, length, height, thickness, direction, radius, type, attach) — element/attribute names.
- **Opening** elements (Doors/Windows) — position, width, height, sill, and whether ORDX (unlike ORD) carries **swing/hinge**.
- Fixtures/Appliances element names and whether they reuse the ORD enums.
- Dimensions, Photos, and the Cabinets/Assembly section wrapper element names.
- Which fields are **required vs optional**, and the **global units attribute** at Job level (the `unit="mm"` seen is only on Shape `Template`).

Hexagon's own guidance: inspect the **sample ORDX shipped in the install** at `\Support\Sample ORDX\`, and "output some cabinets/parts with various shapes to get a handle on the output." That sample file is the only public-ish source of the full tree, and it requires a CV install to obtain.

> **Practical inference (not a substitute for the sample):** because ORDX "follows Job Properties" and covers the same domain as ORD-Extended, expect a `Room`→`Walls`/`Wall` with X/Z/Direction/Length/Height/Thickness analogues, `Windows`/`Doors` with width/height/sill/offset, and Fixtures reusing the 1=Outlet/2=Switch/3=Phone/4=Pipe semantics. **Do not hard-code ORDX element names from this inference — confirm against a real sample first.**

---

## 4. How third parties emit these formats

All three below advertise a **native, no-plugin** open in Cabinet Vision, which means they write **ORDX** (or an ORD-Extended file that CV opens natively). Functionally each carries: **walls, doors, windows, dimensions, angles** as native CV objects.

- **iMapper** (imapper.tech): "exports native ORDX files." Draw the room on magnetized snap points → **Export ▸ ORDX** → open `.ordx` directly in CV; "walls, dimensions, and angles load immediately as native Cabinet Vision objects." **±2 mm** stated precision. **Metric and Imperial** supported. Works with **CV 2020–2025**. **Measure-only** — no catalog needed. Gotchas it documents: **one room per ORDX**; open-plan spaces >30 m may need multiple scan positions; split-levels/mezzanines/sloped ceilings not captured in one pass; it produces **2D horizontal sections, not a 3D mesh**; each scan bundles 10 reference photos.
- **Flexijet 3D / FlexiCAD** (flexijet.info): exports rooms "with basic elements as `.ORDX`" to Cabinet Vision; geometry loads as native objects; **one room at a time**, each area exported/opened separately.
- **Leica DISTO / Cabinet Vision's built-in Leica utility** (shop.leica-geosystems.com + CV help): CV connects directly to Leica 3D DISTO, S910, iCS 20/50, X3/X4/X6 and captures the room live. Key documented behaviors that pin down conventions:
  - Enter **Wall Cladding (drywall) thickness first** so it's compensated in the layout.
  - Must capture **Floor + Ceiling + first Wall** before anything else (establishes the plane/height).
  - **Measure walls clockwise** (matches the ORD wall-numbering rule).
  - Window / Door = **two diagonal points** (bottom-left then top-right). Switch / Outlet / Plumbing = **one point** (bottom-left).
  - The placed objects come from **Preferences ▸ Fill Objects** (Window Object, Door Object, Power Switch Object, Power Outlet Object, Pipe Line Object) — i.e. CV maps a measured point to a catalog "fill object," which is why a **measure-only file needs no cabinet catalog** but a fully-fixtured import benefits from those preference objects existing.

The Leica DISTO **Plan app** also exports generic room formats; the "native CV" path specifically is ORDX / ORD-Extended.

---

## 5. Import behavior, edition gating, validation pitfalls

- **Import path in CV:** Room Level ▸ Ribbonbar ▸ **Utilities ▸ Import Order** (ORD) / open `.ordx` directly. Export counterparts: **Utilities ▸ Export ORDX** and **Export Order**.
- **What CV does on import (ORD-Extended):** creates the Walls, Floors, Windows, Doors, Appliances, Fixtures, Moldings, Lights, and (if a `[Walls]` section exists) attaches cabinets to walls so everything is visible in Floor Plan / Elevation / Perspective. Without `[Walls]`, cabinets land in the Order-Entry list only.
- **Edition/level gating [GATED — needs confirmation on a seat]:** Cabinet Vision ships as **Essential / Standard / Advanced** tiers. The public format docs do **not** state a minimum tier for ORD/ORDX room import; vendor pages imply the ORDX native open works across CV 2020–2025 without calling out a tier. Confirm on a seat whether room/layout import is enabled at Essential.
- **Validation pitfalls (documented):**
  - Comment/string fields must avoid `# ? = | ;` (they break parsing).
  - Every referenced **door style / material schedule / construction / profile / finish / texture name must already exist** in the target catalog / `CVData.mdf`; unresolved names fail to bind. (Avoid the problem entirely by exporting **no** cabinets/catalog for a measure-only file.)
  - **Section order:** `[Walls]` must precede `[Moldings]`/`[Cabinets]`; wall-attached items reference walls by number, so walls must be defined first.
  - **Empty-but-required fields** must still be present as `""` (e.g. profile slots in a door-style def).
  - Walls join only when endpoints coincide — floating-point mismatch leaves gaps; snap/round coordinates so shared corners are exactly equal.
  - Numbers must be in the **`Unit=`** system; mixing inches and mm silently mis-scales.

---

## 6. Minimal-viable worked examples

### 6.1 ORD-Extended — smallest file that opens as a real room in CV (measure-only, no cabinets)
Metric, a simple 3000×3000 mm room (3 defined walls + closing), one door, one window, two outlets, a floor polygon, one jobsite photo. Coordinates use the §1.3 rule (clockwise, `end = start + L·(cosθ, −sinθ)`).

```
[Header]
Version=4
Unit=1
Name="Soline Room Export"
Comment="Measure-only export - no catalog"

[Walls]
0,0,0,3000,2600,100
3000,0,-90,3000,2600,100
3000,3000,180,3000,2600,100
0,3000,90,3000,2600,100

[Windows]
1200,1000,"Kitchen window",1,800,900

[Doors]
900,2050,"Entry",2,300

[Fixtures]
1,600,300,0,1,"Outlet L",,N
1,2100,300,0,1,"Outlet R",,N

[Floors]
0,0,3000,0,3000,3000,0,3000

[Photos]
1,1500,1300,"C:\Soline\jobs\1001\wall1.jpg",,N
```
Notes:
- Four walls drawn clockwise from origin close the loop back to (0,0). (Each wall's end equals the next wall's start; wall 4 ends at (0,0).)
- Windows fields = W,H,Comment,Wall,Offset,Sill. Doors = W,H,Comment,Wall,Offset(,ID,Modify optional). Fixtures type 1 = Power Outlet.
- No `[Catalog]`/`[Cabinets]` → nothing depends on a catalog; the room still renders in Layout because `[Walls]` is present.

### 6.2 ORD-Extended — with cabinets attached to walls (from the published extended sample, abbreviated)
```
[Header]
Version=4
Unit=0
Name="Job"
BaseDoors="Default Slab","White Laminate","","","","","door.ddb"
WallDoors="Arched Raised Panel","Birch","","","","","door.ddb"
ConstructionStyle="32 mm"
Perspective=-45.0000,25.0000,0.0000,0.0000,0.0000

[Walls]
-50.0000,50.0000,90.0000,100.00000,96.00000,4.50000
-50.0000,-50.0000,0.0000,100.00000,96.00000,4.50000
50.0000,-50.0000,-90.0000,100.00000,96.00000,4.50000

[Floors]
-20,-20,-20,20,20,20,20,-20

[Catalog]
Name="Generic.cvc"
BaseDoorStyle="SQUARE FLAT PANEL"
WallDoorStyle="SQUARE FLAT PANEL"

[Cabinets]
1,"B21R",21.00000,34.50000,24.00000,"R","L",1,"",2,10.00000,0.00000,0.00000
2,"B21R",21.00000,34.50000,24.00000,"R","R",1,"",3,60.00000,0.00000,0.00000
```
Cabinets carry the extra positional fields (fields 10-13: Wall, Offset, DistFromFloor, Outset), so they place on walls 2 and 3.

### 6.3 ORDX — minimal *documented* fragment
Only the shape/part portion is publicly specified. A full minimal ORDX room cannot be authored from public docs alone (see §3.2). Documented fragment shape:
```xml
<PartOverrides>
  <PartOverride>
    <Name>Cab.Interior.AS@2</Name>
    <Shape>
      <Axis>XY</Axis>
      <Template firstid="1" unit="mm">
        <entity id="1" type="line2d"><End><x>2</x></End></entity>
        <entity id="2" type="line2d"><Begin><x>2</x></Begin><End><x>1</x><y>1</y></End></entity>
        <entity id="3" type="line2d"><Begin><x>1</x><y>1</y></Begin></entity>
      </Template>
    </Shape>
  </PartOverride>
</PartOverrides>
```

---

## 7. How to build a Soline exporter from this spec

**Target: ORD-Extended v4 (fully specified, native open in CV 2020–2025). Add ORDX later once a sample file is in hand.**

**Emit in this order** (order matters):
1. `[Header]` — `Version=4`, `Unit=` (1 for Soline's mm), optional `Name`/`Comment`/customer block. **Omit all door-style / material / finish / texture keys** for a measure-only file (they'd require catalog names that exist in the target `CVData.mdf`).
2. `[Walls]` — one line per wall, **clockwise**, 6 fields minimum (X, Z, Direction°, Length, Height, Thickness). Compute Direction so that `end = start + Length·(cosθ, −sinθ)` and each wall's end equals the next wall's start; ensure the loop closes with **exactly equal** shared endpoints (round to avoid float gaps). Use Type field 8 only if you need Interior/Island/Radius; radius walls fill fields 10-12.
3. `[Windows]` — W, H, Comment, WallNumber(+`-F`/`-B`), Offset-from-start, Sill.
4. `[Doors]` — W, H, Comment, WallNumber, Offset-from-start.
5. `[Appliances]` — only if Soline records them; Type enum §2.7.
6. `[Fixtures]` — outlets/switches/phone/pipe as point features; Type enum 1/2/3/4; Wall`0` = plan coords.
7. `[Floors]` — one line of (X,Z) pairs per floor polygon, ≥3 pairs, in the same coordinate frame as walls.
8. `[Photos]` — optional jobsite photos attached to a wall (or plan with Wall `0`); field 4 = full `.jpg` path.
9. **Skip** `[Catalog]`/`[Cabinets]` for measure-only. (When Soline later exports cabinets, add a `[Catalog]` with a real catalog name and `[Cabinets]` lines with the 18-field extended form.)

**Encoding & formatting rules to enforce:**
- ASCII text, CRLF line endings, one record per line.
- Quote every string field; leave optional trailing fields empty but keep required placeholders as `""`.
- Strip `# ? = | ;` from all comment/string fields.
- All numbers in the `Unit=` system (mm). Keep a fixed decimal precision (the samples use up to 5 decimals).
- Assign stable host **ID** tokens (fields for Wall ID, Window/Door/Fixture ID) if you want round-trip identity; otherwise leave empty and let CV assign.
- Use **Modify Code `N`** (New) on first export.

**ORDX upgrade path (later):**
- Obtain the `\Support\Sample ORDX\` file from a CV install (or a partner's export), diff its Room/Wall/Opening tree, and mirror element/attribute names exactly.
- Reuse the documented `Shape`/`entity`/parameter-value-type conventions verbatim (§3.1) — those are stable and published.
- Advantage of ORDX over ORD: multiple rooms per file, and Face/Interior assembly sectioning. Not needed for a first measure-only exporter.

---

## 8. Open questions that truly need a licensed CV seat (or a real sample file)

1. **ORDX room-geometry element tree** — exact names/nesting for `Job`/`Room`/`Wall`/`Window`/`Door`/`Fixture`/`Floor`/`Photo`/`Cabinets`, the root element, and XML namespace/schema/`<?xml?>` header. (Public docs stop at `PartOverrides`/`Shape`.)
2. **ORDX global units** — is there a Job-level unit attribute, or is `mm` implied except on `Shape/Template@unit`?
3. **ORDX required-vs-optional flags** per element.
4. **Swing/hinge in ORDX openings** — ORD has none; does ORDX carry door swing / window hinge?
5. **CV edition gating** — minimum tier (Essential/Standard/Advanced) for room/ORDX import.
6. **Radius-wall math** — confirm arc-angle sign vs. the CW/CCW flag against a real radius-wall file.
7. **Coordinate origin & handedness** for ORDX specifically (assumed same X/Z-plan, Y-up as ORD).
8. **Photo path handling in ORDX** — local path vs. embedded/relative.

---

## 9. Sources (all public web)

Primary (Hexagon Nexus — Cabinet Vision Online Help, HTML):
- ORD File Format (CV 2025): https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2025_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Import_Order/ORD.File.Format.xhtml
- ORD File Format (CV 2022.1): https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_Help/page/Room_Level/Ribbonbar/Utilities_Tab/Import_Order/ORD.File.Format.xhtml
- ORDX Format (CV 2025): https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2025_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Export_ORDX/ORDX.Format.xhtml
- ORDX Format (CV 2023): https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2023_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Export_ORDX/ORDX.Format.xhtml
- Export ORDX (CV 2025): https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2025_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Export_ORDX/Export.ORDX.xhtml
- Leica Disto utility (CV 2025): https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2025_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Leica.Disto.xhtml
- Leica Disto (CV 2024): https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2024_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Leica.Disto.xhtml
- Custom Order Import (CV 2023): https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2023_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Import_Order/Custom.Order.Import.xhtml
- (Legacy static mirror, referenced but DNS-dead at time of research: content.planit.com/cv/Help/CV_Help/Room_Level/Ribbonbar/Utilities_Tab/Import_Order/ORD_File_Format.htm and …/Export_ORDX/ORDX_Format.htm)

Third-party emitters / integrations:
- iMapper — Cabinet Vision integration: https://www.imapper.tech/integrations/cabinet-vision
- Leica Geosystems — Cabinet Vision App / DISTO integration: https://shop.leica-geosystems.com/measurement-tools/ics/cabinet-vision-app  and  https://shop.leica-geosystems.com/measurement-tools/disto/blog/video/cabinet-visions-leica-disto-integration
- Woodworking Network — Leica → Cabinet Vision writeup: https://www.woodworkingnetwork.com/events-contests/wood-pro-expo-florida/leica-room-measurements-feed-accurate-dimensions-cabinet
- Flexijet 3D / FlexiCAD: https://www.flexijet.info/en/products/flexicad4-measurement-software/flexicad-update-info/  and  https://flexijeteast.com/en/flexicad/
- Craftsman Woodworks Engineering — Importing ORDX files (ClosetPro → CV11+): https://craftsmanengineering.com/taxonomy/term/268
- Cabinet Vision product / CopyRoom: https://www.cabinetvision.com/copyroom
- Cabinet Vision brochure (Hexagon/2020, PDF): https://www.ligna.de/apollo/ligna_2025/obs/Binary/A1423352/EMEA_UK_2020_MPS_CABINET_VISION_Brochure_EN_RLL4_391.pdf

*Facts (structure, field names, enums) transcribed from the above. No proprietary code or artwork reproduced.*
