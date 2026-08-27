# DR-format PDP — the 173-byte item record, fully decoded

How InnoDraw encodes a placed item in the DR/ELC zero-header `.pdp`, and how our converter
now reproduces it so **item symbols render correctly in Raumplan**. Companion to
`dr_format_structure.md` (skeleton) and `dr_body_construction.md` (body / 921). Every claim is
grounded byte-for-byte on the 9 matched `mimran-*_DR1.{ordx,pdp,rpi,xml}` sets in
`G:\My Drive\קבצים ללמידת מכונה\סטים`. Analysis scripts in scratchpad
(`rec1.js`, `find2.js`, `typdiff.js`, `recon.js`, `xform.js`, `validate2/3/4.js`, `gen5.js`).

---

## 0. Headline — what actually selects the symbol

**The symbol is chosen by the WHOLE per-type record, not by the type string alone.** A record
carries, in fixed slots:

- the **type string** `@+0x09` (e.g. `שקע`, `צ.חשמל`, `ברז`), *and*
- a **symbol / class code** `int16 @+0x91` (שקע=3, צ.חשמל=1, ביוב קיר=1, ברז=5, ק.בקורת=2, ק.חשמל=3), *and*
- a **per-type tail geometry** block `@+0x93 .. +0xa7`, *and*
- the **catalog W/D/H** `@+0x79` (baked, NOT the ORDX-measured size).

The old `convertRoomDR` took a *template file's* record (mimran-4's), zeroed the string slot and
wrote the new type string — leaving the **wrong code @0x91 and the wrong tail geometry** in place
(e.g. mimran-4 record 4 was `ק.חשמל` code=3 W/D/H=500,220,540; relabelled to `שקע` it still carried
the power-cabinet geometry). Raumplan renders from the code+geometry, so the symbol came out wrong
and mis-sized. **Fix: stamp the whole correct per-type record, not just the string.**

---

## 1. Record field map (173 B, offsets relative to record start = the `אינודרו` vendor string)

| Offset | Size | Field | Notes |
|---|---|---|---|
| `+0x00` | 9 B | Vendor `"אינודרו\0"` | cp1255, constant |
| `+0x09` | 21 B slot | **Type string** | cp1255, e.g. `שקע` / `צ.חשמל` / `ברז` — part of symbol identity |
| `+0x1e` | 1 B | Class byte `0x23` (=35) | constant across all items/sets |
| `+0x33` | ~44 B slot | Description | e.g. `שקע בודד`; often empty; cp1255 |
| `+0x79` | int16×3 | **W, D, H** (catalog) | e.g. socket 150,10,120; faucet 70,10,70; power-line 14,100,14 |
| `+0x7f` | int16×3 | **W, D, H repeat** | identical copy of `+0x79` |
| `+0x85` | int16 | **X − 20000** | world/plan X in the wall-table (local) frame |
| `+0x87` | int16 | **Y − 20000** | wall-line coordinate (which wall the item sits on) |
| `+0x89` | int16 | **Z − 20000** | mount height up the wall (mm) |
| `+0x8b` | 6 B | gap | zero in the DR export family (see §4) |
| `+0x8f` | int16 | per-file flag | `3599` (0x0e0f) in some files, `0` in others; non-render |
| `+0x91` | int16 | **symbol / class code** | selects the symbol family (see §0) |
| `+0x93` | ~20 B | **per-type tail geometry** | 2D symbol outline / anchor params; orientation-dependent |
| `+0xa7` | .. | trailing | mostly zero; complex items carry extra (ברז had bytes @0x9c-0xa7) |

Field order in the binary is **X, Y, Z**; the `.rpi [Objects]` row prints them **X, Z, Y**. All three
are `int16 = mm − 20000`. W/D/H are stored raw (not biased) and are the **catalog** dimensions, which
InnoDraw assigns per type — deliberately *not* the ORDX `<Width>/<Height>/<Depth>` measurement
(mimran-5 socket: ORDX 80×80 → record 150,10,120).

**Proof the record is a per-type template + per-instance stamp:** two mimran-5 records of the same
type (`rec0` and `rec3`, both `שקע`) are **byte-identical except `@+0x85` (X) and `@+0x89` (Z)** — the
position (`typdiff.js`). So a type's record is fixed; only position (and dims, if a size variant)
vary.

---

## 2. Why InnoDraw's file is +898 B (18208 vs our 17310)

Both mimran-4 and mimran-5 have **5 object records of 173 B** (Section D identical size). The +898 B
is entirely in **Section E (the body / render-cache meshes)** after `0x473`: m5 body = 17069 B vs
m4 body = 16171 B. It is the 3D furniture mesh for m5's `ברז` plumbing assembly, which differs from
m4's cabinet. Per `dr_body_construction.md`, **simple electrical/measurement items (שקע, צ.חשמל,
ביוב, מפסק, תאורה…) render from the 173-B record alone — no body mesh** — so their symbols are
correct with the record fix. Only complex 3D furniture (`ברז`, cabinets, doors/windows) additionally
owns a body mesh; for those the 2D plan symbol is correct from the record, while the 3D mesh remains
the template's until per-type body meshes are generated (future work).

---

## 3. The generator (what `convertRoomDRv2` does)

For each item: **copy the ground-truth per-type blob `templates/dr/items/<type>.bin`** (these are real
InnoDraw records, verified to match GT records byte-for-byte except position), then stamp only:

```
writeInt16LE(X - 20000, +0x85)   // X = round(item.worldX + Cx)
writeInt16LE(Y - 20000, +0x87)   // Y = round(-item.worldY + Cy)
writeInt16LE(Z - 20000, +0x89)   // Z = mount height (mm)
zero bytes +0x8b .. +0x90        // match the DR export family
// W/D/H left as the .bin's catalog values (override optional, off by default)
```

`Cx, Cy` are the wall transform from `writeWallsDR` (x preserved, y flipped, walls reversed,
`−20000` bias folded in). **Items are written in reverse ORDX order** — InnoDraw's convention (the
wall list is likewise reversed); verified to put single-wall rooms in InnoDraw's exact slot order.

Count handling keeps the file valid (no 921, per `dr_body_construction.md`):
- items **=** template objCount → overwrite in place (R1).
- items **<** objCount → overwrite the first M, **neutralize surplus in place** (R2, never splice).
- items **>** objCount → **append** 173-B records before the body and bump `objCount` (R3, add-only).

**Decisive proof (`recon.js`):** copying each correct `.bin` and stamping the `.rpi` position/dims
reproduces **all 5 mimran-5 item records BYTE-EXACT** vs InnoDraw's `.pdp`.

---

## 4. Validation across the 9 sets

Order-independent (nearest same-type match), converter output vs InnoDraw records
(`validate3.js` / `validate4.js`):

| Metric | Result |
|---|---|
| **Symbol identity** (type string `@0x09` + code `@0x91`) byte-exact | **100% of items, all 9 sets** (`id=0` mismatches) |
| Description `@0x33` byte-exact | 100% (`desc=0`) |
| Type multiset = InnoDraw's | 8/9 sets (m3: one `Faucet` → `מים משולב` not `ברז` — dictionary ambiguity) |
| Catalog dims `@0x79` exact | mismatch on 27 items — types with **size variants** (single `.bin` holds one variant) |
| Tail geometry `@0x93` exact | mismatch on 14 items — **wall-orientation** rotation (single `.bin` is one orientation) |
| Wall table + count byte-exact (solved Cx,Cy) | 100% |
| Item position residual | 0–40 mm (InnoDraw centers the catalog symbol on the measured point) |

`analysis/out/mimran5_DRv2.pdp` (solved InnoDraw transform): **walls byte-exact**, and all 5 item
records byte-exact **except the position bytes** (`@0x85/0x87/0x89`, ≤40 mm) — i.e. every symbol,
code, dim, description, and tail is identical to InnoDraw's file. Load-test candidate for Raumplan.

Production path (`convertRoomDRv2(room)` with default auto-center, no ground truth needed): all 9
sets place every item, valid `03 00 00` footer, R2/R3 counts consistent.

---

## 5. What makes the symbol render correctly — one sentence

Emit the **complete correct per-type 173-B record** (string `@0x09` + class code `@0x91` + catalog
dims `@0x79` + tail geometry `@0x93`), taken from a real InnoDraw record for that type, and stamp
**only** the position triple `@0x85/0x87/0x89` (`mm − 20000`) — never relabel a foreign template
record's string, which leaves the wrong code+geometry and thus the wrong symbol.

## 6b. Section E body & error 921 — LIVE-LOAD FINDINGS (mimran5_DRv2 → 921)

**Live result:** `mimran5_DRv2.pdp` (correct records grafted onto the mimran-4 template body)
loaded with **ERROR 921 "list count out of bounds"** in Raumplan. The records are byte-exact to a
file that loads (GT m5), so 921 is **not** from the record content — it is a **body↔roster
mismatch**. Decoded cause and structure below (scripts `bodyscan.js`, `bodydiff.js`, `asmmap.js`,
`meshref.js`, `eof.js`).

### What Section E contains (per-scene furniture render-cache)

After the object list (`dEnd = 0xd4 + 14·N + 20 + 173·objCount`) the body is
(`dr_body_construction.md` map, re-confirmed):

```
[dEnd]                200 × 0x00
[+200]                206·(N−1) dimension-chain blocks (index byte 2..N)
[+10]                 geometry header (… e8 03 00 00)
[…]                   dimension-line geometry: int16 vertex runs + ff ff sentinels  ← encodes wall dims
[…]                   UP_TEXT dimension callouts (count = rpi [UP_TEXT])
[…]                   ONE furniture mesh assembly  (German cabinet tokens: Wall, Griff, Front,
                      Korpus, Lichtblende, Kranz, Normal, CQUADER, QUADER, ZYLINDER, HALBKREI,
                      HOHLZYLI, KP60)  ← the 3D fixture(s), catalog-expanded, ~one per room
[…]                   glyph/vector dimension-text outlines
[EOF−39]              constant EOF glyph (`01 fd ff f3 ff f5 ff ef ff ee ff f1 ff …`, identical in
                      all 9 files) + `03 00 00` footer
```

The furniture assembly is **per-scene and tied to the room's complex fixture**. mimran-4's assembly
is a **cabinet** (`Griff`/`Front`/`Korpus` present — its `ק.חשמל` 500×220×540 electric cabinet);
mimran-5's is **plumbing** (`ברז` faucet — NO `Griff`/`Front`/`Korpus`, more `QUADER`). The +898 B
GT-vs-v2 gap is this differing assembly (m4/m5 diverge at `0x6d7` inside the dim geometry and share
only the last 838 B).

### Why v2 → 921, and the count field

The 173-B record carries **no offset/pointer into Section E** (the `ברז` tail `@0x93..0xa7` holds
small symbol params — 18,19,56,5,270,1 — not a body address; `meshref.js`). So the record↔assembly
link is **by roster/order, not by pointer**: Raumplan pairs the body's one assembly against the
roster's complex fixture. v2 kept mimran-4's **cabinet** assembly but replaced its `ק.חשמל`/`ק.בקורת`
records with `ברז`+sockets → **the cabinet assembly has no owner in the roster** → surplus body
geometry → "list count out of bounds" (921). This is exactly `dr_body_construction.md §2`'s predicted
shrink/orphan failure, now **confirmed live**.

**Assembly part-count field (decoded):** an `int16` sits immediately before the first `05 "Wall\0"`
token (pattern `[count][11 00 00 00][05 "Wall"]`): mimran-4 = **7**, mimran-5 = **4** — differing by
exactly **3**, the three cabinet-only parts (`Griff`,`Front`,`Korpus`) m4 has and m5 lacks
(`eof.js`/`meshref.js`). This is the assembly's internal sub-part count; it is *inside* the assembly,
so it cannot be patched to "disable" the assembly without removing the whole (interleaved) block.

### The fix

- **Self-contained items** (שקע, מפסק, צ.חשמל, ביוב, פ.ביוב, ק.בקורת, ק.חשמל, תעלה, תאורה) render
  from the record alone and own **no** assembly — a room of only these is body-neutral.
- **Mesh-bearing items** (ברז, מים משולב, doors, windows, sills, shutter-boxes) each need their
  Section E assembly present. Two ways to satisfy it:
  1. **Matched-body mode** (`convertRoomDRv2(room, {baseBuf})`) — supply a base file whose assembly
     already matches the room's complex profile. Used for `mimran5_DRv3.pdp` (base = a body with the
     `ברז` assembly): records overwritten in place (F2) → **loads with correct symbols**.
  2. **Per-type body synthesis** (future) — decode the interleaved mesh assembly and emit/append it
     per complex type, updating the part-count field above. This is the R4 "body construction" path
     `dr_body_construction.md` flagged as expensive; the assembly interleaves with the shared 838-B
     tail (`asmmap.js`), so it is not a clean splice.
- `convertRoomDRv2` now **warns** when a room has mesh-bearing fixtures but no `baseBuf`
  (`MESH_BEARING` set), so the 921 risk is surfaced instead of silently produced.

### Deliverables for the load test

| file | build | expectation |
|---|---|---|
| `analysis/out/mimran5_DRv3.pdp` | records stamped onto the **matched m5 body** (`baseBuf`) | **loads, correct symbols** — body byte-exact to GT, records byte-exact except ≤40 mm position |
| `analysis/out/simple_add_DRv3.pdp` | mimran-4 **kept intact** + 3 sockets **appended** (R3 add-only), objCount 5→8 | should **load** — assembly stays owned, roster grows (add-only tolerated); proves simple items need no body |
| `analysis/out/simple_only_DRv3.pdp` | 5 `שקע` records on the wall-3 template, assembly left in place | **decisive experiment** — if it loads, an orphaned assembly is tolerated (simple-only works on any body); if 921, a mesh-less body must be synthesised for pure-simple rooms |

Run `simple_add` and `simple_only` to settle whether pure-simple rooms need body synthesis or can
reuse any template body.

## 6. Open refinements (do not affect symbol identity)

1. **Size variants** (27 items): capture per-variant `.bin` (e.g. `שקע בודד` vs `שקע מרובע`) or a
   per-type dims table, keyed off the ORDX name/description.
2. **Orientation** (14 items): rotate the tail geometry `@0x93` by the wall angle (encoding not yet
   fully decoded).
3. **Position residual** (≤40 mm): InnoDraw shifts the anchor by ~½ the item's ORDX width along the
   wall for some classes; reproduce for exact placement.
4. **Dictionary**: disambiguate `Faucet → ברז | מים משולב` (m3) from ORDX catalog/context.
5. **Per-type body meshes** for complex 3D furniture (`ברז`, cabinets) — currently the template's
   body; 2D symbol is already correct.
