# ELEMENT LIBRARY MASTER — the Soline ↔ Raumplan/DR library contract

**The authoritative per-element table**, ground-truthed from a REAL multi-format export the owner
supplied as our calibration file:

```
G:\My Drive\קבצים ללמידת מכונה\FULL ELC\elemets_Bar_Terra-Nova_Yosi_DR1.*
```

This is the **"Rosetta Stone"**: the SAME room (4 walls, 40 placed objects, 32 distinct element
types) exported by Raumplan/InnoDraw into **every format at once** —

| ext | size | what it is |
|---|---|---|
| `.pdp` | 154 KB | Raumplan native DR/zero-header format — all element types, the 173-byte item records |
| `.ordx` (+`.ord`) | 22 KB | CV/InnoDraw order XML — element **identity** (Name / Class / Type / Catalog) |
| `.dxf` (+`_3D.dxf`) | 238 / 249 KB | 2D plan + 3D model geometry |
| `.xml` | 13 KB | `WallTransfer` hand-off to the 3D pipeline — canonical **`Model3D`** library names |
| `.rpi` | 2.7 KB | text roster — confirms wall table, object order, `X,Z,Y` field order, plan bounds |
| `.elc` | 757 KB | the ELCAD/DR library container — **opaque** (compressed/encrypted; see §5) |
| `.skp` | 317 KB | SketchUp model (3D pipeline output) |

It is **not** Sivan's copyrighted template — it is a Raumplan element export the owner made as our
calibration ground-truth, so it is used **in full**.

Owner: converter agent (`src/writePdpDR.js` + PDP section of `soline_convert.js`). This file is the
contract that `writePdpDR.GT_CODES` mirrors in code and `selfTest()` hard-guards.

---

## 0. How the file was decoded (method, reproducible)

Scripts (scratchpad): `decode_pdp.js`, `decode_ordx.js`, `correlate3.js`, `correlate4.js`,
`verify_bins.js`, `consolidate.js`.

- **PDP record layout** (173 B, offsets from record start = the `אינודרו` vendor string): type
  string `@0x09` (cp1255), class byte `0x23` `@0x1e`, description `@0x33`, catalog dims `W/D/H`
  `@0x79` (+repeat `@0x7f`), **position `X@0x85 / Y@0x87 / Z@0x89`** (`int16 = mm − 20000`), the
  **symbol code** `int16 @0x91`, the **9-byte property block** `@0x92–0x9b`, the list marker
  `@0x9d` (`0x0e` non-last / `0x00` last). Full field map in `docs/dr_item_record.md`.
- **The symbol is the coupled unit `[0x91,0x9c)` = code(2) + property block(9)** — TYPE-CANONICAL
  (identical across every instance and every corpus file). That 11-byte unit is what selects the
  rendered symbol; the type string alone does not.
- **Transform (PDP world ↔ ORDX plan), solved from the walls & confirmed by the `.rpi` bounds:**
  `worldX = −planX + 9274 ; worldY = −planY + 6004` (a 180° rotation; the `.rpi` prints
  `Bounds …(9274,−6004)` — exactly `Cx,Cy`). `world = stored + 20000`.
- **Anchor read on the Z axis (up-the-wall).** The along-wall axis carries a rotation/flip
  ambiguity in a hand-authored file, but **Z has none** — it is the height up the wall, frame-
  invariant. So `Z_stored` vs `fromBottom` (raw corner) vs `fromBottom + H/2` (center) gives a
  byte-clean anchor verdict per type. It **confirmed every mimran-corpus verdict** and resolved
  the previously-ambiguous types (§3).

---

## 1. THE MASTER TABLE (32 native types, ground-truthed)

`code` = `int16 @0x91`. `property block` = the 11-byte swap unit `[0x91,0x9c)` (includes the code).
`dims` = catalog `W/D/H` `@0x79` (mm; Raumplan-assigned, NOT the ORDX-measured size). `anchor(Z)` =
where the record stores the point up the wall (CENTER = `corner + H/2`; OFFSET = raw corner).

| # | PDP type | code | property block `[0x91,0x9c)` | dims W/D/H | anchor | ORDX Name(s) | ORDX Class | XML `Model3D` |
|---|---|---|---|---|---|---|---|---|
| 1 | `דלת` (door) | 1 | `01 00 0a 04 00 00 00 04 00 00 00` | 1000/100/2000 | OFFSET | Hinged Right Out | Decorative | `Common.Door.Interior.Standard.Single` |
| 2 | `חלון` (window) | 5 | `05 00 0b 10 00 00 01 1d 00 00 00` | 940/100/1260 | OFFSET | Window | Decorative | `Common.Window` |
| 3 | `אדן חלון` (window sill) | 1 | `01 00 00 04 00 00 00 04 00 00 00` | 500/100/100 | OFFSET | WindowSill | Decorative | — |
| 4 | `ארגז תריס` (shutter box) | 1 | `01 00 00 04 00 00 00 04 00 00 00` | 300/100/200 | OFFSET | ShutterBox | Decorative | — |
| 5 | `פתח איוורור תקרה` (ceiling vent) | 1 | `01 00 00 04 00 00 00 04 00 00 00` | 1000/1000/20 | OFFSET | Air Opening Ceiling | Decorative | `Vent` |
| 6 | `רדיאטור` (radiator) | 11 | `0b 00 10 16 00 00 00 2c 00 00 00` | 1000/150/880 | OFFSET | Radiator | Appliance | `Common.Appliance.Radiator` |
| 7 | `חור איורור` (vent hole) | 12 | `0c 00 00 00 00 00 00 1d 00 00 00` | 500/10/500 | OFFSET | Air Opening | Decorative | `Air Opening` |
| 8 | `מזגן` (air conditioner) | 20 | `14 00 02 2b 00 00 01 33 00 00 00` | 1000/250/300 | OFFSET | Air Condition | Accessory | `Common.Appliance.AirConditioner` |
| 9 | `צ.מים` (water line) | 1 | `01 00 00 06 00 00 00 1e 00 00 00` | 20/50/20 | OFFSET\* | Water Supply | Fixture | — |
| 10 | `מקלחת` (shower) | 20 | `14 00 00 31 00 00 00 2d 00 00 00` | 1000/1100/2000 | OFFSET | Shower | Fixture | `Bathroom.Shower.Enclosed` |
| 11 | `פ.ביוב` (floor drain) | 1 | `01 00 00 10 00 00 00 04 00 00 00` | 120/120/10 | OFFSET | Sewer drainage | Fixture | `Wall Drain` |
| 12 | `ביוב` (sewage) | 1 | `01 00 00 1e 00 00 00 04 00 00 00` | 50/50/100 | OFFSET\* | Sewage | Fixture | `Sewage` |
| 13 | `גז` (gas) | **6** | `06 00 12 00 00 00 00 1a 00 00 00` | 100/10/100 | **CENTER** | Gas | Fixture | `Gas` |
| 14 | `מים משולב` (combined water) | **15** | `0f 00 12 00 00 00 00 3c 00 01 00` | 200/10/205 | OFFSET | (Faucet/Water family) | Fixture | `Common.Fixture.Plumbing` |
| 15 | `ברז` (faucet) | 5 | `05 00 12 00 00 00 00 13 00 00 00` | 70/10/70 | CENTER | Faucet | Fixture | `Common.Fixture.Plumbing` |
| 16 | `בידה` (bidet) | 1 | `01 00 00 56 00 00 00 12 00 00 00` | 360/590/367 | OFFSET | Bidet | Fixture | `Bathroom.Bidet` |
| 17 | `אמבט` (bathtub) | 1 | `01 00 01 34 00 00 00 11 00 00 00` | 1700/750/600 | OFFSET | Bath | Fixture | `Bathroom.Bath` |
| 18 | `חור.פ.ממד` (safety-room opening) | 1 | `01 00 00 06 00 00 00 1e 00 00 00` | 1000/200/1000 | OFFSET | Safety Room Entrance | Decorative | `Safety Room Entrance` |
| 19 | `אנטנה` (TV/antenna) | 3 | `03 00 12 00 00 00 00 0d 00 00 00` | 80/10/80 | **CENTER** | TV, Duplex TV | Fixture | `TV`, `Duplex TV` |
| 20 | `+מפסק` (switch variant) | 4 | `04 00 12 00 00 00 00 12 00 00 00` | 150/10/120 | CENTER | SwitchEx | Fixture | — |
| 21 | `מפסק` (switch) | 4 | `04 00 12 00 00 00 00 12 00 00 00` | 150/10/120 | CENTER | Switch, Duplex Switch | Fixture | `…Electrical.Switch`, `…DuplexSwitch` |
| 22 | `+שקע` (socket variant) | 3 | `03 00 12 00 00 00 00 0e 00 00 00` | 150/10/120 | CENTER | SocketEx | Fixture | — |
| 23 | `שקע` (socket) | 3 | `03 00 12 00 00 00 00 0e 00 00 00` | 150/10/120 | CENTER | Socket, Duplex Socket | Fixture | `…Electrical.Receptacle`, `…DuplexReceptacle` |
| 24 | `ק.חשמל` (power box) | 3 | `03 00 00 04 00 01 00 08 00 01 00` | 500/220/540 | OFFSET | Power Box | Decorative | `Power Box` |
| 25 | `צ.חשמל` (power line) | 1 | `01 00 00 06 00 00 00 1e 00 00 00` | 14/100/14 | OFFSET | Power Line | Fixture | `Power Line` |
| 26 | `+טלפון` (phone variant) | 4 | `04 00 12 00 00 00 00 10 00 00 00` | 60/10/80 | CENTER | PhoneEx | Fixture | `PhoneEx` |
| 27 | `טלפון` (phone) | 4 | `04 00 12 00 00 00 00 10 00 00 00` | 60/10/80 | **CENTER** | Phone, Duplex Phone | Fixture | `Phone`, `Duplex Phone` |
| 28 | `תאורה` (ceiling light) | 7 | `07 00 00 2b 00 01 00 22 00 01 00` | 850/285/220 | OFFSET | Lighting, Can Light | Decorative | `Common.Light.Ceiling`, `…Ceiling.Can` |
| 29 | `אינטרקום` (intercom/bell) | 4 | `04 00 00 01 00 00 00 0e 00 00 00` | 60/50/190 | OFFSET | Intercom, Door Bell | Decorative/Fixture | `Common.Auxiliary.Intercom`, `…Bell` |
| 30 | `ק.בקורת` (junction box) | 2 | `02 00 12 00 00 00 00 0c 00 00 00` | 100/10/100 | CENTER | Junction Box, Blank | Fixture | `…Electrical.JunctionBox`, `…Blank` |
| 31 | `עמוד` (column) | 1 | `01 00 00 04 00 00 00 04 00 00 00` | 1000/1000/2600 | OFFSET | Pole | Decorative | — |
| 32 | `עמוד עגול` (round column) | 1 | `01 00 02 10 00 00 00 09 00 00 00` | 200/200/2600 | OFFSET | RPole | Decorative | `Round Column` |

\* `צ.מים` / `ביוב` lean CENTER by ≤10 mm on their 20–50 mm footprint — **within a symbol width,
immaterial**; kept OFFSET to match their corpus-proven code-1 sibling `צ.חשמל`. See §3.

### Types with a `.bin` but NOT in this file (from earlier corpus / InnoDraw samples)

| PDP type | code | property block `[0x91,0x9c)` | note |
|---|---|---|---|
| `ביוב קיר` (wall sewage) | 1 | `01 00 00 06 00 00 00 1e 00 00 00` | code-1 infra point; same block as `צ.חשמל`/`צ.מים` |
| `תעלה` (channel/beam/structure) | 1 | `01 00 00 04 00 00 00 04 00 00 00` | generic code-1 block; the structure-box fallback family |
| `אסלה` (toilet) | 7 | `07 00 00 21 00 00 00 28 00 00 00` | **absent from the Rosetta file** — unverified; needs its own sample |

---

## 2. Symbol codes — the class families

The `code @0x91` groups symbols into rendered families (many types share a code but differ by the
9-byte block, which selects the specific glyph within the family):

| code | family | types |
|---|---|---|
| **1** | generic infrastructure / line / structure point | `צ.חשמל` `צ.מים` `ביוב` `ביוב קיר` `פ.ביוב` `חור.פ.ממד` `אדן חלון` `ארגז תריס` `פתח איוורור תקרה` `עמוד` `עמוד עגול` `בידה` `אמבט` `תעלה` |
| **2** | junction / inspection box | `ק.בקורת` |
| **3** | socket / receptacle point | `שקע` `+שקע` `ק.חשמל` `אנטנה` |
| **4** | switch / low-voltage point | `מפסק` `+מפסק` `טלפון` `+טלפון` `אינטרקום` |
| **5** | window / faucet | `חלון` `ברז` |
| **6** | gas | `גז` |
| **7** | ceiling light / toilet | `תאורה` `אסלה` |
| **11** | radiator | `רדיאטור` |
| **12** | vent hole | `חור איורור` |
| **15** | combined-water fixture | `מים משולב` |
| **20** | large appliance / enclosed fixture | `מזגן` `מקלחת` |

The code alone is NOT the symbol — e.g. `שקע`, `ק.חשמל`, and `אנטנה` are all code 3 but carry
different blocks (`…0e`, `…08 00 01`, `…0d`) and render as different glyphs. **Always copy the whole
11-byte unit**, never the bare code (a bare code desyncs the property list → Raumplan `E4048`).

---

## 3. Ambiguous anchors/codes — RESOLVED from this real data

The prior `docs/PDP_ANCHOR_TABLE.md` flagged six types as ambiguous. Resolutions from the Z-axis
read (frame-invariant, byte-clean):

| type | prior status | RESOLVED | evidence |
|---|---|---|---|
| **`גז`** (gas) | "maybe CENTER" (top calibration candidate) | **CENTER, code 6** | Z cen-residual **0** (exact); a 100×100 point symbol, same family as `ק.בקורת` (CENTER). Now added to `ANCHOR_CENTER`. |
| **`תאורה`** (light) | "OFFSET (uncertain), no clean corpus fit" | **OFFSET, code 7** | Z off-residual ≈0 (one instance exact); stays OFFSET. dims 850/285/220, block `07 00 00 2b…`. |
| **`צ.מים`** (water line) | OFFSET (guess) | **code 1**; anchor immaterial | block `01 00 00 06 00 00 00 1e 00 00 00` — **identical to `צ.חשמל`**. dims 20/50/20. Z leans CENTER by 10 mm (within symbol width) → keep OFFSET to match `צ.חשמל`. |
| **`ביוב`** (sewage) | OFFSET (guess) | **code 1**; anchor immaterial | block `01 00 00 1e 00 00 00 04 00 00 00`, dims 50/50/100. Distinct from `ביוב קיר`/`פ.ביוב`. Z leans CENTER by ~25 mm → keep OFFSET (immaterial). |
| **`מים משולב`** (combined water) | OFFSET (guess), code unknown | **code 15 confirmed**, OFFSET | block `0f 00 12 00 00 00 00 3c 00 01 00`, dims 200/10/205. Large wet fixture → OFFSET. |
| **`אסלה`** (toilet) | OFFSET (guess) | **unresolved** | NOT present in the Rosetta file (it has `אמבט`+`בידה`, no toilet). `.bin` code 7 unverified; still needs its own sample. |

**Anchor rule re-confirmed byte-exact against this file:** CENTER = the small MEP **point** symbols
(`שקע` `מפסק` `ק.בקורת` `ברז` **`גז` `אנטנה` `טלפון`** + the `+` variants) store `corner + H/2`;
everything else (openings, appliances, wet/large fixtures, line/infra) stores the raw corner.

---

## 4. Cross-format identity (the full Rosetta linkage)

Each element is the same object seen four ways. Use this to route an app element to its correct PDP
symbol:

- **ORDX `<Name>`** is the identity the app writes (`OrdxExporter`). Multiple names collapse to one
  PDP type (e.g. `Socket`, `Duplex Socket`, `SocketEx` → `שקע`/`+שקע`).
- **ORDX `<Class>`** (Fixture / Decorative / Appliance / Accessory) is a coarse grouping only.
- **XML `Model3D`** is the canonical InnoDraw 3D-library id (e.g.
  `Common.Fixture.Electrical.Receptacle`, `Common.Light.Ceiling`, `Bathroom.Bath`). Useful when the
  ORDX name is generic.
- **PDP type string** (`@0x09`, cp1255) is the Hebrew label that pairs with the code+block.

`docs/ordx_item_dictionary.json` maps app/ORDX names → PDP type; every mapped type now has a
ground-truth-verified `templates/dr/items/<type>.bin` (§6).

---

## 5. The `.elc` container — opaque

The 757 KB `.elc` is the ELCAD/DR element-library container. Header `23 d0 53 81 …` is **not** gzip
(`1f 8b`), zip (`50 4b`), or zlib (`78 …`); an entropy/string scan finds **no** readable vendor
string, Hebrew type names, or German mesh tokens (`Wall`/`Griff`/`Korpus`…) — i.e. it is
**compressed or encrypted**, not a plain record enumeration. The element library was therefore
mapped from the readable channels instead: the `.pdp` native slots (§1) + the `.xml` `Model3D` names
(§4) + the InnoDraw install's icon catalog `eLObstaclesIconsEn.tx~` (153 icons, per
`docs/PDP_ANCHOR_TABLE.md §InnoDraw install library`). No anchor/insertion field exists in any of
those — the anchor is a drawing convention baked into each symbol, derived here from real records.

---

## 6. What changed in code (this deliverable)

- **`src/writePdpDR.js`**
  - `GT_CODES` — the ground-truth `{code, block, dims}` table above, mirrored in code as the library
    contract. Exported.
  - `ANCHOR_CENTER` extended: **`+ גז, אנטנה, טלפון`** (were OFFSET/ambiguous; now proven CENTER).
  - `selfTest()` step (0): **library-contract guard** — every `.bin` with a `GT_CODES` entry must
    carry EXACTLY the ground-truth code+block, or the test fails (catches a drifted/wrong `.bin`).
  - Rich-base note wired at the base-selection section (see below).
- **`templates/dr/items/*.bin`** — **14 new** ground-truth records extracted from the Rosetta file
  (`מזגן` `מקלחת` `רדיאטור` `חור איורור` `אנטנה` `טלפון` `אינטרקום` `עמוד` `עמוד עגול` `בידה`
  `אמבט` `+מפסק` `+טלפון` `פתח איוורור תקרה`). Every pre-existing overlapping `.bin` was verified
  **byte-identical** to the ground truth (0 drift) — so the swap mechanism was already correct; the
  new bins extend native coverage from 21 → 35 types.
- **`templates/dr/base/wall4_oc40.pdp`** — the Rosetta `.pdp` itself, wired as the **RICH BASE**
  (4 clean walls, 40 native slots, 32 types). See §7.
- **`docs/ordx_item_dictionary.json`** — added `"Water Supply": "צ.מים"` (was dropping in `allelem`).

---

## 7. The RICH BASE — `wall4_oc40.pdp` — evaluation

The Rosetta `.pdp` is an excellent rich base: its 40 slots already carry the **correct** code+block
for 32 types, so mapping a room's items onto its exact-type slots yields the right symbol with **zero
paired-swaps**, and its **4 walls are all clean** (thick 100, height 2600 — **no ghost/degenerate
walls**, unlike `wall8_oc23` which the owner flagged). It is the natural base for a **large/diverse**
room (>25 items on 4 walls) or one that needs native 3D furniture meshes.

**Trade-off (the surplus-slot situation the owner flagged):** for a SMALL room the rich base leaves
many surplus native slots rendering as ghost items (a 17-item room on 40 slots ⇒ 23 surplus). The
current policy leaves surplus slots AS-IS (neutralising them previously caused error 921). So:

- **Small/medium room →** an **exact-count base + `editSymbol` paired-swap** gives correct symbols
  for ALL items with **zero surplus and zero ghost walls**. This is what `allelem_master.pdp` uses
  (`wall4_oc17`, 17 slots for 17 items).
- **Large/diverse room, or needs native 3D meshes →** the rich `wall4_oc40` base. The tightest-fit
  selection rule keeps it out of small-room selection automatically.

---

## 8. Regenerated output — `allelem_master.pdp`

`analysis/out/allelem/allelem_master.pdp` (+ copy in `_LATEST/`). Built on `wall4_oc17` with
`editSymbol` paired-swap:

- **17/17 items placed**, **0 dropped, 0 surplus slots, 0 ghost walls**.
- **Correct symbol for every item**: 6 native-exact (no bytes changed) + 11 paired-swaps to the
  ground-truth code+block. Output slot codes `1,5,7,3,3,1,1,1,1,1,1,6,1,1,1,3,4` —
  `שקע`=3, `מפסק`=4, `גז`=6, `תאורה`=7, `חלון`=5, `ק.חשמל`=3, `צ.מים`/`צ.חשמל`/`פ.ביוב`/`תעלה`/`דלת`=1.
- **Byte-verified**: header/wall-count, Section-E body/assembly/tail all **byte-identical** to the
  base; `objCount` unchanged.
- `allelem_postype.pdp` is **kept as the safe fallback** (native code-family symbols, no swaps).

Both are strictly cleaner than the old `allelem_rich.pdp` (base `wall8_oc23`: ghost walls + surplus).

> **NEEDS OWNER RAUMPLAN LOAD-TEST.** The converter proves structure (base body preserved byte-for-
> byte, every code+block a real InnoDraw unit) but only the owner's Raumplan build is the final
> oracle for a clean load.

---

## 9. `allelem_perfect.pdp` — correct symbol for ALL 17 items, 921 cracked (2026-08-24)

`allelem_master.pdp` (§8) gave correct symbols but **loaded with 921**. Root cause decoded (full
write-up in `docs/dr_body_construction.md` §🎯): the swap-921 driver is **code-membership** — an item
slot's `code @0x91` may only be a value the base file **natively registers**. `allelem_master` was
built on `wall4_oc17` (mimran-1, native codes `{1,3,5,7}`); its gas (**code 6**) and switch
(**code 4**) swaps introduced non-native codes → 921. Section E holds **no** code/block reference
(three negative scans), and loadable files carry **many blocks per code** — so the block is free to
vary within a registered code; only a **new code value** breaks.

**Fix — the rich Rosetta base.** `wall4_oc40` is the ONLY corpus file that natively registers gas
code 6 (and every other target code). Building `allelem` on it, routing each item to a **same-code**
slot and swapping only the sub-block, yields:

- **17/17 items carry their exact ground-truth `{code, block}`** (correct symbol for every item,
  incl. gas code 6 & switch code 4).
- **0 code-byte `@0x91` changes** across all 40 slots — every slot keeps the base's native code; only
  **3 slots** get a block-only `[0x93,0x9c)` sub-swap within their native code (the block-variety
  loadable files already exhibit).
- **Output per-code multiset is byte-identical to the loading base**; **Section E byte-identical**;
  `objCount` unchanged.
- The **23 surplus slots collapsed off-plan** (position-only move — the safest edit class; code +
  block + dims kept native), so the plan shows only the 17 real items.

Every change class in the file (wall table, item pos/dims/type-string, sub-block within a registered
code, surplus reposition) is individually a proven-loadable operation. Output:
`analysis/out/allelem/allelem_perfect.pdp` (+ `_LATEST/`). `allelem_postype.pdp` stays as the safe
fallback (native code-family symbols, zero `[0x91,0x9c)` edits). Reproducible recipe:
`convertRoomDRv2(room, { editSymbol:true, editType:true, editDims:true, collapseSurplus:{…} })` —
auto-selects the code-covering base via `pickBaseForSymbols` and enforces the **921-guard** (refuses
any swap that would introduce a non-native code, keeping that item a correct-family fallback).

> **NEEDS OWNER RAUMPLAN LOAD-TEST.** Structure is proven byte-for-byte; only Raumplan is the final
> load oracle. If it still 921s, the residual novelty is the 3 sub-block swaps within registered
> codes — fall back to `allelem_postype.pdp`, or to the same rich-base build with those 3 items left
> as native code-1 family (15/17 exact, 2/17 family, **zero** `[0x91,0x9c)` edits = strictly postype-
> class).

---

## 10. DECISIVE UPDATE (2026-08-24) — block edits are NOT safe; the NATIVE-SYMBOL clean path

The owner's load-test refined §9's conclusion. Three files, same rich base `wall4_oc40`, isolate it:

- `allelem_perfect.pdp` (3 **block-only** sub-swaps within a code the base already registers) → **921**.
- `allelem_perfect_safe.pdp` (rich base, **zero** block edits, items on native slots) → **LOADS**, but
  3 items showed a fallback glyph and a surplus slot floated outside the room (top-right).

**Conclusion (overrides the earlier "block varies freely within a registered code" claim):** editing
the property block `[0x93,0x9c)` triggers 921 **even within the same code**. So the ONLY load-safe
edit class is **postype** — position `@0x85/0x87/0x89`, dims `@0x79/0x7f`, type-string `@0x09` — with
the whole 11-byte symbol unit `[0x91,0x9c)` left **byte-for-byte** from the base. The correct symbol
for an item is therefore reachable ONLY by **routing it to a base slot whose native unit already IS
that symbol** (block-exact), never by editing bytes into a slot.

### The NATIVE-SYMBOL (postype-clean) export — `allelem_clean.pdp`

`convertRoomDRv2(room, { nativeSymbols:true, editType:true, editDims:true, collapseSurplus:{gap} })`:

- **Base pick** (`pickBaseForNativeSymbols`) maximises how many items land on a slot whose **native
  11-byte unit** equals the item's ground-truth unit (block-exact → correct glyph, zero code/block
  edit). For the 17-item calibration room, the best bundled base is the rich **`wall4_oc40`** (4 clean
  walls) at **15/17 correct symbols** — the theoretical max on the bundled set (the base holds only 1
  door-glyph slot for 2 doors, and 3 code-1 line slots for the room's 4 line points; those 2 items get
  their correct code-**family** glyph instead). This beats the earlier 14/17.
- **Block-exact relabel** (assignSlots pass 1b): types that share a glyph are routed onto a same-unit
  slot even when the type string differs — e.g. `צ.מים`→a `צ.חשמל`/`חור.פ.ממד` slot, `תעלה`→a
  `עמוד`/`אדן חלון`/`ארגז תריס`/`פתח איוורור תקרה` slot (all the code-1 `…04 04` structure unit). Only
  the safe type-string label is fixed; the glyph was already right.
- **Zero risky edits:** `codeEdits=0`, and the slot unit `[0x91,0x9c)` and the entire Section-E body /
  assembly / tail are **byte-identical** to the base (verified). Only pos/dims/type-string move.
- **No floating ghosts:** the 23 surplus slots are collapsed to a single point derived from the room's
  own wall extent — **~12 m below-left, well outside every room extent** (position-only; the safest
  edit class). Verified: 0 surplus inside/near the room, all 17 real items inside.

Output: `analysis/out/allelem/allelem_clean.pdp` (+ `_LATEST/`), rebuildable via
`analysis/build_allelem_clean.js`. `allelem_postype.pdp` stays as the conservative fallback. The
production PDP path (`soline_convert.convertPDP`) now uses this same native-symbol clean route, and a
`selfTest()` guard enforces its invariants (0 code/block edits, block-relabel fires, body byte-
identical, surplus off-plan).

### The real 17/17 fix — the MASTER BASE

15/17 is a **base-inventory** ceiling, not a method limit: the bundled bases simply lack a second door
glyph and a fourth line-point glyph. Give the base a **generous slot per supported type** and every
item finds its exact native slot → **correct symbol for ALL items**, still zero risky edits. That base
is the owner's own file, drawn once in his Raumplan — full guide + exact per-type slot counts in
**`docs/PDP_MASTER_BASE.md`**, pointed to via `SOLINE_DR_BASE_DIR`.

> **NEEDS OWNER RAUMPLAN LOAD-TEST.** `allelem_clean.pdp` is structurally the safest export we can
> make on the bundled bases (own loadable file; only geometry + labels moved; zero `[0x91,0x9c)` or
> Section-E edits; ghosts removed). Only the owner's Raumplan build is the final load oracle.

---

## 11. SURPLUS-COLLAPSE FIX + `תשתיות.pdp` decode (2026-08-24)

### 11a. Why the previous `allelem_clean.pdp` did NOT load — and the fix

Root cause (decoded from the two files byte-for-byte): the stored object X/Y `@0x85/0x87` is an
int16 in a **−20000-biased WORLD frame** (`world = stored + 20000`). The old surplus-collapse
computed `min(wallX) − GAP` = `−19296 − 12000 = −31296` → **world −11296 (NEGATIVE)**, which
Raumplan rejects. The loadable `allelem_perfect_safe.pdp` left its surplus at stored `−12796` →
**world +7204 (POSITIVE)** and loaded. The whole owner-drawn base drawing lives in world `[202, 6224]`
— world −11296 is off the valid coordinate space entirely.

**Fix (`src/writePdpDR.js`, `convertRoomDRv2` collapse block):** collapse toward the
**positive-world** corner (`max(wallX) + GAP`, `max(wallY) + GAP`) and hard-clamp the WORLD
coordinate into `[1000, 50000]` (`clampWorld`) — never negative, never near the int16 rail. The
regenerated `allelem_clean.pdp` now has surplus at **world (12704, 12724)** — same positive
direction as the proven `safe`, ~8 m beyond a 4 m room. Verified: world-min **704 (>0)**, code
multiset + block set + Section-E body **byte-identical to base**, **0 code/block edits**. `selfTest()`
gained a regression guard (`collapse WORLD coord must be positive`); the production PDP path
(`soline_convert.convertPDP`) uses the same corrected gap collapse. Default GAP is now **8000**.

### 11b. `analysis/out/תשתיות.pdp` is an ELEMENT LIBRARY, not a room base

Decoded properly (detected from the file, no wall4 assumption): **171789 B**, header carries **no
wall count at 0xd2** (all-zero `0x08..0xe8`), **no wall table**, **no `אינודרו` vendor string**, **no
DR `03 00 00` footer**. It is a flat catalog of **22 symbol DEFINITIONS at a strict 431-byte stride**,
family tag **`SUPP_FR`** (supply/infrastructure), each: family tag · Hebrew name ×2 · class byte
`0x23` · **W/D/H dims** · 2D symbol geometry · preference flags — followed by a large float-geometry
body. This is the DR **object-record** shape's cousin but **not** a DR ROOM drawing: it has no placed
173-B slots and no Section-E dimension body, so it **cannot be a drop-in room base** for
`convertRoomDRv2` (which overwrites a wall table + 173-B slots that this file does not have).

**Its native infra inventory (22 entries, owner's real drawn symbols) and dims — which match the GT
library exactly:**

| תשתיות name | maps to GT type | dims (W/D/H) | GT dims |
|---|---|---|---|
| `שקע בודד/כפול/משולש` (+`-סימון`) | `שקע`/`+שקע` (socket) | 150/10/120, 80/17/80… | 150/10/120 ✓ |
| `מפסק בודד/כפול/משולב` (+`-סימון`) | `מפסק`/`+מפסק` (switch) | 150/10/120, 144/15/80… | 150/10/120 ✓ |
| `מים משולב` (×2) | `מים משולב` (combined water) | 200/10/205 | 200/10/205 ✓ |
| `מים קרים` / `מים חמים` | `צ.מים`/`ברז` (water/faucet point) | 70/10/70 | ברז 70/10/70 ✓ |
| `נקודת גז` | `גז` (gas) | 100/10/100 | 100/10/100 ✓ |
| `נקודת אנטנה` | `אנטנה` (TV/antenna) | 80/10/80 | 80/10/80 ✓ |
| `נקודת טלפון` | `טלפון` (phone) | 60/10/80 | 60/10/80 ✓ |
| `ביוב` | `ביוב` (sewage) | 60/60/300 | 50/50/100 (owner's own) |
| `פתח יציאת אויר 10/12.5/15` | `חור איורור`/`פתח איוורור תקרה` (vent) | 100/10/100 … 150/10/150 | family ✓ |

**Coverage verdict:** `תשתיות.pdp` covers the **infrastructure/MEP subset** (socket, switch,
combined/cold/hot water, gas, antenna, phone, sewage, air-vent) — exactly "תשתיות". It is the owner's
authoritative infra symbol set and confirms those GT dims. **Still MISSING for a complete master
base** (the owner must add these to reach 17/17-class coverage on any room): openings `דלת חלון אדן
חלון ארגז תריס`, HVAC `רדיאטור מזגן`, wet fixtures `מקלחת אמבט בידה אסלה`, `תאורה` (light),
`ק.חשמל צ.חשמל ק.בקורת` (power box/line/junction), `אינטרקום`, `פ.ביוב ביוב קיר` (drains),
`עמוד עמוד עגול תעלה` (structure), `חור.פ.ממד`. Full generous per-type counts are in
`docs/PDP_MASTER_BASE.md`.

### 11c. `allelem_infra.pdp` — Job-2 deliverable

Because `תשתיות.pdp` is a catalog (11b), the loadable base used is **`wall4_oc40.pdp` = the owner's
OTHER real Raumplan export** (the Rosetta room). Same native-symbol/postype clean path + corrected
positive-world collapse. Result: **17/17 placed, 15/17 correct native symbol** (11 exact-type + 4
block-relabel; the 2 fallbacks are a 2nd `דלת` and a 2nd `צ.חשמל` — the base holds only one door glyph
and its code-1 line slots run out, the documented 15/17 bundled-base ceiling), **0 code/block edits**,
Section-E body byte-identical, surplus world-positive off-plan. It is **byte-identical to
`allelem_clean.pdp`** (both are the best postype build on the owner's real room). Output:
`analysis/out/allelem/allelem_infra.pdp` (+ `_LATEST/`); build `analysis/build_allelem_infra.js`.
`allelem_postype.pdp` stays as the conservative fallback.

> **BOTH `allelem_clean.pdp` AND `allelem_infra.pdp` NEED THE OWNER'S RAUMPLAN LOAD-TEST.** Structure
> is proven byte-for-byte (world-positive coords, zero `[0x91,0x9c)`/Section-E edits); only Raumplan
> is the final load oracle. If either still fails, fall back to `allelem_postype.pdp`.
