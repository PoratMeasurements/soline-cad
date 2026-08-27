# DR (zero-header, int16) PDP — internal structure map

Reverse-engineering of the **DR/ELC zero-header** `.pdp` format used by the InnoDrawNet workflow
(the 9 `mimran-*_DR1.pdp` files in `G:\My Drive\קבצים ללמידת מכונה\סטים`). Goal: know the file's
internal lists well enough to (a) emit a **clean walls-only room** and (b) later **inject items**.
All analysis read-only; every claim cites file + offset + bytes. Companion doc:
`docs/elc_sets_analysis.md` (the 9 matched sets, transform derivation, `.rpi` mirror).

> Format sanity: all 9 files start `00 00 00 00 00 00 00 00` (zero header), **not** `ff ff ff 7f`.
> This is the int16 DR family, distinct from the native `ffffff7f` serialization
> (`PDP_NATIVE_FORMAT.md`). The 42-byte body / ±200-normal / SUPP_FR model does **not** apply here.

---

## 0. Top-level file skeleton

The file is a **positionally-chained** sequence of sections. There is **no offset/index table** — each
section begins exactly where the previous one ends, so the byte-length of every variable section
(especially the wall table) shifts everything downstream. Layout (offsets shown for `mimran-4`,
17310 B, 3 walls / 5 objects / 5 texts):

| # | Section | Start (m4) | Size rule | Count field |
|---|---|---|---|---|
| A | **Header / client block** | `0x000` | fixed **212 B** (ends at `0xd2`) | — |
| B | **Wall list** | `0xd4` | `14 × nWalls` | `uint16 @0xd2` |
| C | **Object-list preamble** | `0xd4+14·nWalls` (`0xfe`) | fixed **20 B** | `uint32 objCount` + `uint32 ver=14` + 12 B reserved |
| D | **Object (item) metadata list** | preamble+20 (`0x112`) | `173 × objCount` | (count = C) |
| E | **Body**: geometry meshes + UP_TEXT + glyph/vector text | after D | variable, interleaved | no single global count found |
| F | **Footer sentinel** | EOF−3 | fixed `03 00 00` | — |

Section start of C is **always** `0xd4 + 14·nWalls` and section start of D is **always** C+20.
Verified on all 9 files (§2, §3). The whole "List count out of bounds" problem is a property of this
positional chaining (§5).

---

## 1. Section A — Header / client block  (`0x000 … 0xd4`, fixed 212 B)

Fixed-size preamble. Byte-for-byte constant layout across all 9 files; only the string contents and
the wall count change. `mimran-4` dump:

```
0x000  00×21                                  zero header + pad
0x015  "mimran-4\0"          room / job name (C-string field)
0x034  "קיר טלוויזיה סלון קומתי"  ClientData.Address  (cp1255 Hebrew)
0x053  "קומה א"              ClientData.ZipCode
0x05a  "לבון"                ClientData.City
0x079  "9  03-9180333"       ClientData.Telephone
0x0b6  "michael\0"           ClientData.Designer
0x0cc  80 c1 80 c1           two float/int16 constants (= 0xc180,0xc180) — CONSTANT all 9
0x0d0  08 bc                 uint16 = 48136 (0xbc08) — CONSTANT all 9 (format/version magic)
0x0d2  nn 00                 uint16 = nWalls   ← the wall count
```

- `@0xcc` = `80 c1 80 c1` and `@0xd0` = `0xbc08` are **identical in all 9 files** (`hdrconst.js`), so
  they are format constants, not scene data. Copy them verbatim.
- `@0xd2` (uint16) is the **only** place the wall count appears in the header region: scanning the
  first `0x190` bytes of `mimran-6` for `uint16 == 8`, the sole hit is `0xd2` (`hdrconst.js`). There
  is **no second copy** of the wall count in the header.

The strings sit at fixed slots inside the block (they do not shift the 212-byte size). All 5 client
fields map 1:1 to the `.rpi` `[ClientData]` section.

---

## 2. Section B — Wall list  (`0x0d4 …`, `14 × nWalls`)

Confirmed in `elc_sets_analysis.md` and re-verified here. `uint16 count @0xd2`; records start at
`0xd4`; **stride 14 B**, all `int16 LE`:

```
[ x1 ][ y1 ][ x2 ][ y2 ][ thick ][ height ][ flag ]   (7 × int16 = 14 B)
```

- Matches the `.rpi` `[Walls]` rows exactly (`x1,y1,x2,y2,thick,height,flag`), in the **PDP-local
  frame** (`pdp_int16 = rpi − 20000` on x/y; thick/height stored as-is).
- Written in **reverse order** vs ORDX (opposite winding); coordinates are the **centerline** (no
  perpendicular offset).
- Walls are **fully self-contained** in this 14-byte record. There is no separate per-wall list
  anywhere else (the body's `"Wall"` token is a German cabinet-panel name, not a room wall — it
  appears once per cabinet, not `nWalls` times; `mimran-6` with 8 walls has no wall-scaled body list).

Cross-file check (`counts.js`), `objCount @ 0xd4+14·nWalls` equals `.rpi` `[Objects] Count` for all 9:

| set | nWalls@0xd2 | objCount offset | objCount | ver next | rpi W/O/T |
|---|---|---|---|---|---|
| m1 | 4 | 0x10c | 17 | 14 | 4/17/10 |
| m2 | 3 | 0x0fe | 11 | 14 | 3/11/7 |
| m3 | 4 | 0x10c | 8  | 14 | 4/8/7 |
| m4 | 3 | 0x0fe | 5  | 14 | 3/5/5 |
| m5 | 3 | 0x0fe | 5  | 14 | 3/5/5 |
| m6 | 8 | 0x144 | 23 | 14 | 8/23/11 |
| m7 | 4 | 0x10c | 24 | 14 | 4/24/10 |
| m8 | 4 | 0x10c | 25 | 14 | 4/25/13 |
| m9 | 4 | 0x10c | 20 | 14 | 4/20/10 |

---

## 3. Section C+D — Object (item) metadata list

### Preamble (Section C, 20 B) — at `0xd4 + 14·nWalls`

```
+0x00  uint32  objCount     (= number of items = .rpi [Objects] Count)
+0x04  uint32  0x0000000e   version = 14  (matches .rpi WriteVersion=14) — CONSTANT
+0x08  12 × 00              reserved
```
Then the object records begin at preamble+20. Verified: firstVendor − objCountOffset = 20 in every
file (m4 `0xfe→0x112`, m6 `0x144→0x158`, m7 `0x10c→0x120`) — `verify.js`.

### Object record (Section D) — fixed **173 B** (`0xAD`) stride

`vendorCount == objCount` and the vendor string `"אינודרו"` recurs at a **constant 173-byte stride**
in every file tested (m2=11, m4=5, m5=5, m6=23, m7=24 objects; single stride value `173`) —
`verify.js`. So the object list is a clean contiguous array `objCount × 173 B`; it ends at
`firstVendor + 173·objCount` (m4: `0x112 + 5·173 = 0x473`; m6: `0x158 + 23·173 = 0x10e3`).

Record fields (offsets relative to record start = the `"אינודרו"` vendor string; from `mimran-4`
record 0 @`0x112` and `mimran-5` socket records, `dumprange.js`/`diff.js`):

```
+0x00  "אינודרו\0"          Vendor  (InnoDraw)             [cp1255, fixed slot]
+0x09  type string          e.g. "שקע"/"צ.חשמל"/"ברז"      [cp1255, fixed slot]
+0x1e  byte 0x23 (=35)      a type/class code
+0x33  description string   e.g. "שקע בודד" (single socket)
 ~+0x6f W,D,H (int16 ×3) written TWICE, e.g. 96 00 0a 00 78 00 = 150,10,120
 ~+0x7d position X,Y,Z (int16 ×3), each = value − 20000
        e.g. m5 socket rec3: 10 b6 69 b5 73 b3 = -18928,-19095,-19597 = (1072,905,403)
 ~+0x8b flags incl. 0x0e0f = 3599  (matches the ".rpi" trailing "…,3599,…" field)
```

Field order in the binary is **X, Y, Z** (X=along-frame, Y=wall-line, Z=height); the `.rpi` prints
them as **X, Z, Y**. All three are `int16 = mm − 20000`. `W,D,H` are stored raw (not biased).

> The exact sub-offsets of the string/dimension fields drift by a few bytes between records because
> the description strings occupy fixed but differently-filled slots (see `diff.js`: rec0 vs rec3
> differ only in the string bytes and the position triple). The **record size is fixed at 173 B**;
> the internal layout is fixed-slot, not length-prefixed, so a record is copyable and repositionable
> by overwriting the position triple + dims.

Every object — simple (socket/junction) **and** complex (cabinet/faucet) — has exactly **one** 173-B
record here. Complex fixtures additionally carry mesh geometry in the body (§4); simple electrical
items apparently do **not** (no per-socket QUADER pair; the body meshes form one cabinet assembly).

---

## 4. Section E — Body (geometry meshes + UP_TEXT + glyph text)

After the object list comes a **variable, interleaved** stream. It is **not** a clean count-prefixed
tail; I could not locate a single global count that sizes it. Contents identified (m4/m5 via
`strings.js`, `skel.js`, `dumprange.js`):

1. **Dimension leader/line geometry** — `int16` vertex runs separated by `ff ff` sentinels
   (e.g. m4 `0x6d7+`: `… ff ff 00 00 96 00 32 00 96 00 37 …`).
2. **UP_TEXT dimension callouts** — embedded records, each: `ff ff` sentinel, `float32 1.0`,
   `int16 x, y` (each `= mm − 20000`), rotation/flags, then the cp1255 text.
   m4 text 1 @`0x0da3`: bytes `28 b6 fe b3` = `-18904,-19458` = `(1096,542)` = `.rpi` UP_TEXT 1
   `1096,542,180,0,0,H 319.6` ✓. The 5 m4 texts appear in order at `0xda3, 0xe85, 0xf5b, 0x1031,
   0x1107`, matching `.rpi [UP_TEXT]` exactly.
3. **3D furniture meshes** (complex fixtures only) — length-prefixed tokens: `Wall, Griff, Front,
   Korpus, Lichtblende, Kranz, Normal, CQUADER, QUADER, HALBKREI, HOHLZYLI, ZYLINDER, KP60`. Strings
   are Pascal-style: `05 "Wall\0"` (m4 `0x11e1`: `… 05 57 61 6c 6c 00`). This is the primitive-solid
   mesh model (`QUADER`≈box, `ZYLINDER`≈cylinder, `HALBKREI`≈half-round).
4. **Bulk mesh table** — a long fixed-stride ~**36-byte** record array dominates large files
   (m4 `0x2721 … 0x4061`, ~180 records = the bulk of the 17 KB; `skel.js`). Vertex/point data for the
   cabinet.
5. **Glyph/vector-text outlines** — near EOF (m4 `0x4300…`), one Hebrew letter per record with int16
   coordinate deltas (the rendered dimension text outlines).

The body's size is what makes even "small" scenes ≥17 KB: every item is drawn as real geometry.

---

## 5. Footer + the "List count out of bounds" dependency

**Footer (Section F):** every one of the 9 files ends with the 3 bytes `03 00 00` (`foot.js`),
regardless of wall/item count. Treat as a fixed EOF sentinel.

**The `15581 - List count out of bounds` mechanism.** There is **no** list whose *value* scales with
the wall count other than `@0xd2` itself. The error comes from the **positional chaining**: the
object-count field lives at `0xd4 + 14·nWalls`. If you bump `count@0xd2` from 3→4 **without inserting
a real 14-byte wall record**, the reader consumes `4·14 = 56` bytes as walls (eating the objCount and
version fields), then reads `objCount` from `0x10c` instead of `0xfe`. At `0x10c` sits object-record
bytes → a huge number → Raumplan tries to allocate/iterate that many objects → *list count out of
bounds*. Confirmed by the offset table in §2: objCount is found exactly at `0xd4+14·nWalls` for every
file.

**Rule for arbitrary wall counts:** `count@0xd2` must equal the number of 14-B records physically
present, and Section C (objCount + version + 12 B) must be written **immediately after** the last
wall record. Do that and the wall count is free. No other count "scales with #walls." Counts that
scale with **#items**: only `objCount` (Section C) and the number of 173-B records (Section D), plus
whatever body meshes those items own.

---

## 6. Clean walls-only room — recipe

Goal: a valid `.pdp` with **N walls, 0 items, 0 dimension texts**. None of the 9 samples is empty, so
the minimal body cannot be observed directly — but the structure above pins the layout down to one
open question (does Raumplan accept an empty body?). Two options, most-confident first.

### Recipe A — construct minimal (recommended; needs one load-test)

Emit exactly:

```
[0x000 .. 0x0d2)   212-B header block, copied verbatim from a template (e.g. mimran-4),
                    optionally patching the name/client strings. Keep 0xcc/0xd0 constants.
[0x0d2]            uint16  nWalls = N
[0x0d4 ..]         N × 14-B wall records  (int16 x1,y1,x2,y2,thick,height,flag)
[after walls]      uint32  objCount = 0
                   uint32  version  = 0x0000000e (14)
                   12 × 0x00        (reserved)
[then]             03 00 00         (footer sentinel)
```

Total size `= 0xd4 + 14·N + 20 + 3`. This drops Sections D and E entirely (0 items ⇒ no 173-B
records, no body meshes, no UP_TEXT). The **single** thing to validate on a live Raumplan/InnoDraw
load is whether it accepts the file ending right after the object preamble (i.e. an empty body before
the footer). Everything else (header constants, wall table, objCount position, version, footer) is
byte-for-byte grounded in the 9 files.

### Recipe B — strip a template in place (fallback, exact byte edits on mimran-4)

Lower-risk if Recipe A's empty body is rejected, because it keeps the header and wall table untouched:

1. `@0x0fe` (objCount): write `00 00 00 00` (was `05 00 00 00`). — sets 0 items.
2. Keep `@0x102` version `0e 00 00 00` and the 12 reserved bytes.
3. **Truncate** the file at `0x112` (end of the 20-B preamble: objCount `0xfe`+4, version `0x102`+4,
   12 reserved `0x106..0x112`) and append the 3-byte footer `03 00 00`. Resulting file = `0x115` bytes.

This removes the object list + body + glyph text in one cut. It is structurally identical to
Recipe A's output for N=3, so it shares the same single validation. If the empty body is rejected,
the next fallback is to keep a **known-good minimal body** captured from a future truly-empty export.

> Do **not** simply zero `objCount` while leaving Sections D/E in place: Raumplan would then find
> orphaned mesh/text data after a 0-count list. Truncate, don't just zero.

### What must change together (summary)

- `count@0xd2` ⇔ number of 14-B wall records (hard requirement; the "out of bounds" trigger).
- Section C must sit immediately after the wall table.
- `objCount` ⇔ number of 173-B object records ⇔ their body meshes/texts.
- Header constants `@0xcc,@0xd0`, version `= 14`, and footer `03 00 00` are fixed — always present.

---

## 7. Item injection notes (socket case study)

For later work. A **socket (שקע)** is the simplest item and the natural first injection target.

- In `mimran-5` the two sockets are object records 0 (`0x112`) and 3 (`0x322`), both
  `W,D,H = 150,10,120`. `diff.js` shows the two 173-B records are identical **except** their string
  bytes and the **position triple** — i.e. a socket record is a **copyable, repositionable block**:
  duplicate the 173 B, overwrite the `int16 X,Y,Z` (`= mm − 20000`) at ~`+0x7d`, done.
- Sockets/junctions appear to carry **no body mesh** (the m5 body — `Wall/Kranz/Lichtblende/CQUADER/
  QUADER×8/ZYLINDER×2/HALBKREI×2` — is one plumbing-cabinet assembly, the `ברז`/`ארון שואב שוטף`
  fixture, not five separate item boxes). Working hypothesis: **injecting a simple electrical item =
  append one 173-B record after the last object record + increment `objCount@ SectionC`**; no body
  geometry needed. Needs a load-test to confirm Raumplan renders a metadata-only item.
- Complex fixtures (faucet, cabinet) additionally require body meshes (Section E) — defer those;
  drive their placement from the `.rpi`/`.xml` instead (per `elc_sets_analysis.md`).

---

## 8. Coordinate transform — confirmation + how InnoDraw picks Cx, Cy

Re-verified against ORDX for `mimran-4` (`mimran-4…ordx` walls; `.rpi` `[Walls]`):

- ORDX W1 `(1093.85, 5743.77)→(1093.85, 5433.77)` th=245  ↔  `.rpi` wall **3** `290,1566→290,1876`
  th=245 (list order reversed, direction preserved).
- Solving `x_local = x_ordx + Cx`, `y_local = −y_ordx + Cy`:
  `Cx = 290 − 1093.85 = −803.85`, `Cy = 1566 + 5743.77 = 7309.77`.
- `y` check: `−5433.77 + 7309.77 = 1876` ✓; `x` preserved, `y` flipped — matches the universal rule.

**How Cx, Cy are chosen (new finding):** the `.rpi` header carries
`;Bounds (804.000000,-3770.000000) - (3146.000000,-7310.000000)`. Then
`Cx = −boundsMinX = −804 ≈ −803.85` and `Cy = −boundsMinY = −(−7310) = 7310 ≈ 7309.77`. So InnoDraw
places the **local origin at the room's bounding-box min corner** (in the Y-negated world frame),
landing the scene in a positive-ish local box, then the wall table stores `local − 20000`.

**For the converter:** `Cx, Cy` remain **free / translation-invariant** — Raumplan does not validate
absolute placement (same freedom class as the per-save GUID). InnoDraw's own convention is
"bounding-box-corner origin," which you may reproduce for fidelity, but any self-consistent `Cx, Cy`
loads. The load-bearing invariants are unchanged: **X preserved, Y flipped (`−y`), walls in reverse
order, centerlines, `−20000` bias into the int16 table.**

---

## 9. Evidence index (scripts in scratchpad)

- `lib.js` — file loader for the 9 sets.
- `hdr.js` / `hdrconst.js` — 212-B header map; `@0xcc/@0xd0` constants; wall count only at `0xd2`.
- `counts.js` — objCount at `0xd4+14·nWalls`, `=` rpi Objects, all 9.
- `verify.js` — object list = contiguous `objCount × 173 B`; 20-B preamble; vendorCount==objCount.
- `strings.js` / `strings5.js` — cp1255 string/section markers (objects, UP_TEXT, mesh tokens).
- `skel.js` — non-zero run skeleton (section boundaries, the 36-B bulk mesh table).
- `dumprange.js` — annotated hex dumps.
- `diff.js` — two-socket record diff (copyable/repositionable proof).
- `foot.js` — `03 00 00` footer, all 9.
- ORDX ground truth: `…ordx` (`<Walls>` StartX/Y, EndX/Y, Thick, Height) for the transform.
