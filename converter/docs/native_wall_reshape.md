# Native PDP wall reshape — the display source of record (ffffff7f)

> תקציר (עברית): הגאומטריה שראומפלן **מצייר** ממנה נמצאת ב**טבלת-הקירות @0x1a5** —
> מערך של N רשומות ברוחב 22 בתים, כל אחת `x1,y1,x2,y2` (int32, מ"מ) + עובי(100) + גובה(2600).
> זו הסיבה שעריכת גוף-הקובץ (@0x800, float) + תיבת-התוחם (@0x14d) **לא שינתה** את התצוגה:
> הן מקורות משניים. כדי לשנות צורה — **חובה** לכתוב את הקואורדינטות ב-@0x1a5. מתכון בייט-בבייט בהמשך.

All claims below were derived by cross-comparing the four exact-count base files
`G:\My Drive\לקוחות\3.pdp` (3 walls·3000), `4.pdp` (4·4000), `5.pdp` (5·2000), `6.pdp` (6·1000).
Every wall in every base decodes to *exactly* its stated length, walls connect end-to-end, and
wall 0 always starts at (0,0) — proving the decode is correct, not coincidental.

---

## 0. TL;DR — the answer

There are **two** places (and only two) that store real per-wall coordinates, plus one derived
bounding box. Verified by scanning `6.pdp` for its distinctive coords (−1000, 2000, and their
±200 float shadows): every hit falls in exactly these regions, nowhere else.

| # | Section | Offset | Encoding | Role | Must edit to reshape? |
|---|---------|--------|----------|------|-----------------------|
| 1 | **Wall table** | **@0x1a5** | N × 22B, `x1,y1,x2,y2` **int32 mm** | **DISPLAY SOURCE OF RECORD** | **YES — this is the one** |
| 2 | Body render/dim records | @~0x80c+ | N × 42B, `x1,y1,x2,y2` **float32**, +200 face offset, +ASCII label | 2D fill + 3D + dimension text | Optional (labels/3D only) |
| 3 | Bounding box table | @0x14d | 4 × 22B (same 22B format, thick=250) | zoom-to-fit extent | Optional (view only) |
| 4 | Count | @0x14b | int16 = `4 + N` | record count | Keep (same N) |
| 5 | Extent max | @0x13f,@0x143 | int32 | derived max-corner | Optional (view only) |

The earlier live test edited **#2 and #3** and saw no change — exactly as expected, because the
geometry Raumplan draws from is **#1 @0x1a5**, which was not touched.

---

## 1. The stride-22 record architecture (the key discovery)

Two back-to-back tables share **one** record format. A 22-byte (0x16) record:

```
+0   int32 LE   x1   (mm)
+4   int32 LE   y1   (mm)
+8   int32 LE   x2   (mm)
+12  int32 LE   y2   (mm)
+16  int16 LE   thickness      ← ALSO the record's magic marker
+18  int32 LE   height
```

The `thickness` at +16 is a reliable anchor because it is constant per table:

| Table | Starts | Rows | thick @+16 | height @+18 | Marker bytes @+16 |
|-------|--------|------|-----------|-------------|-------------------|
| **Bounding box** | **0x14d** | always **4** | 250 (`fa 00`) | 2500 | `fa 00 c4 09` |
| **Real walls** | **0x1a5** | **N** | 100 (`64 00`) | 2600 | `64 00 28 0a 00 00` |

They sit immediately adjacent: `0x14d + 4·22 = 0x1a5`. Verified for all four files
(`verify.js`): bounding rows = 4, wall rows = N, and **count @0x14b = 4 + N** exactly
(3.pdp=7, 4.pdp=8, 5.pdp=9, 6.pdp=10).

To tell the tables apart programmatically: **thick=250 → bounding, thick=100 → real wall.**

---

## 2. The wall table @0x1a5 — full decode (the display source)

Record *i* begins at `0x1a5 + 22*i`. Coordinate field offsets:

```
wall i:  x1 @ 0x1a5+22*i        y1 @ 0x1a5+22*i+4
         x2 @ 0x1a5+22*i+8      y2 @ 0x1a5+22*i+12
         thick(=100) @ +16      height(=2600) @ +18
```

Decoded (`parse2.js`) — note every length is exact and every wall's end = next wall's start:

**3.pdp** (U-shape, all 3000), records @0x1a5, 0x1bb, 0x1d1:
```
w0 (0,0)→(0,3000)      w1 (0,3000)→(3000,3000)     w2 (3000,3000)→(3000,0)
```
Bytes @0x1a5: `00 00 00 00 | 00 00 00 00 | 00 00 00 00 | b8 0b 00 00 | 64 00 | 28 0a 00 00`
= x1=0, y1=0, x2=0, y2=0x0bb8=3000, thick=100, height=2600.

**4.pdp** (all 4000, an ascending staircase — *not* a square; label was approximate):
```
w0 (0,0)→(0,4000)  w1 (0,4000)→(4000,4000)  w2 (4000,4000)→(4000,8000)  w3 (4000,8000)→(8000,8000)
```

**5.pdp** (all 2000), records @0x1a5,0x1bb,0x1d1,0x1e7,0x1fd:
```
(0,0)→(0,2000)→(2000,2000)→(2000,0)→(4000,0)→(4000,2000)
```

**6.pdp** (all 1000), records @0x1a5,0x1bb,0x1d1,0x1e7,0x1fd,0x213:
```
(0,0)→(0,1000)→(1000,1000)→(1000,0)→(2000,0)→(2000,-1000)→(1000,-1000)
```

**Conventions to preserve** (these are correct Raumplan output):
- **Origin:** wall 0 always starts at **(0,0)**.
- **Connectivity:** each wall's end point equals the next wall's start point (a polyline).
- **Winding:** first wall leaves (0,0) in **+Y**; the chain turns so the interior stays on one
  side (matches the prior finding that CW winding gives 90° joins / interior faces).
- **No face offset here** — @0x1a5 stores the *centerline* coordinates in plain mm. (The ±200
  offset lives only in the body float records, section 3.)
- thick=100, height=2600 are constants; leave them.

---

## 3. Body float records @~0x80c+ (secondary — labels + 3D)

`N` records of stride **42** (0x2a). Walls 1..N−1 carry the prefix `49 00 7f 00 01 00 00 00
ff ff ff ff …`; wall 0 uses a different prefix; a trailing all-zero record terminates.
Field layout within a record (offset from the `49 00 7f 00` prefix):

```
+0..15  prefix/flags
+16     float32 x1     +20 float32 y1     +24 float32 x2     +28 float32 y2
+32     00
+33..   ASCII length label ("1000", "3000", …), left-aligned
```

Decoded for 6.pdp (`bodyrec.js`), prefixes @0xafa,0xb24,0xb4e,0xb78,0xba2 (+terminator @0xbcc):
```
(0,1200)-(1000,1200)  (1200,1000)-(1200,0)  (1000,200)-(2000,200)  (2200,0)-(2200,-1000)  (1000,-1200)-(2000,-1200)
```
These are the same walls as @0x1a5 **shifted 200 mm along the wall's outward normal** — e.g.
real w1 (0,1000)-(1000,1000) → (0,1200)-(1000,1200) (top wall pushed +Y). This is the drawn
**face line**, not the centerline. The prior doc (`PDP_NATIVE_FORMAT.md`) already cracked the
±200 left/right-normal rule; reuse it verbatim when regenerating this section.

Editing these floats alone does **not** move the plan geometry (proven by the live test) — they
drive the dimension text and the 3D mesh, which read the wall table for the actual outline.

---

## 4. Bounding box @0x14d + extents @0x13f (derived, view-only)

Four stride-22 rows (thick=250, height=2500) describing the room's min/max extent — this is the
"4-wall bounding box" the user identified, not the real walls. Plus two int32 max-corner values:

- `@0x13f` int32 = max extent + face offset (3.pdp=3200, 4.pdp=8100, 5.pdp=4100, 6.pdp=2200).
- `@0x143` int32 = second max extent.

If left stale after a reshape, Raumplan's zoom-to-fit may frame the room wrong, but the walls
themselves still draw correctly (they come from @0x1a5). Recompute as
`min/max over all wall endpoints (± ~100/200 for wall thickness)` if you want a clean view.

---

## 5. Reshape recipe — byte level

**Input:** a base file with the matching wall count **N** (use 3/4/5/6.pdp), and a target set of
N wall segments `(x1,y1,x2,y2)` in mm forming a connected chain starting at (0,0).

### Step A — REQUIRED: overwrite the wall table @0x1a5

For `i = 0 .. N-1`, let `base = 0x1a5 + 22*i`, write **int32 LE**:
```
buf.writeInt32LE(x1_i, base + 0)
buf.writeInt32LE(y1_i, base + 4)
buf.writeInt32LE(x2_i, base + 8)
buf.writeInt32LE(y2_i, base + 12)
// leave base+16 (thick=100) and base+18 (height=2600) untouched
```
Preserve the chain (`end_i == start_{i+1}`), start at (0,0), keep the base's winding sense.
Do **not** move the thick/height markers — they must stay at `base+16` so the record count and
the `4+N` invariant hold.

This alone changes what Raumplan draws.

### Step B — RECOMMENDED: sync the body float records (correct labels + 3D)

For each wall, write the four **float32 LE** endpoints at the record's +16..+31, applying the
±200 outward-normal face offset (per the prior doc's rule), and overwrite the ASCII length label
at +33 with the new length string (left-aligned, up to the base's field width). Keep wall 0's
special-prefix record and the trailing terminator record intact. Skip this only if you don't care
about on-screen dimension numbers or the 3D view.

### Step C — OPTIONAL: refresh the bounding box (clean zoom)

Recompute min/max over the new endpoints and write the four bounding rows @0x14d (thick=250 rows)
and the extents @0x13f/@0x143. Skip if zoom-to-fit framing doesn't matter.

### Do NOT touch
- `@0x14b` count — keep `4+N` (same N as the base).
- The random GUID @0x1dc and other GUID blocks — Raumplan does not validate them (prior finding).
- The tail catalog (GENERAL/DKP60/… + item geometry) — irrelevant to walls.

### Worked example — reshape 4.pdp (staircase) into a real 4000×3000 rectangle
Target walls (CW, start (0,0), interior on the right): 
`(0,0)-(0,3000)`, `(0,3000)-(4000,3000)`, `(4000,3000)-(4000,0)`, `(4000,0)-(0,0)`.
Write to records @0x1a5, 0x1bb, 0x1d1, 0x1e7:
```
@0x1a5:  x1=0     y1=0     x2=0     y2=3000
@0x1bb:  x1=0     y1=3000  x2=4000  y2=3000
@0x1d1:  x1=4000  y1=3000  x2=4000  y2=0
@0x1e7:  x1=4000  y1=0     x2=0     y2=0
```
(thick/height markers at each +16/+18 stay as-is). Then Step B: body floats with +200 offset,
labels "3000"/"4000"/"3000"/"4000". Then Step C: bounding = x∈[0,4000], y∈[0,3000].

---

## 6. Confidence & verification

- **High confidence** that @0x1a5 is the display source: it is the *only* clean int32 per-wall
  coordinate store, it scales exactly with N, it reconstructs each base's shape perfectly, and it
  is precisely the structure the earlier live test did **not** edit (the negative result on
  @0x800+@0x14d rules those out).
- **Cannot self-verify in Raumplan** (needs Michael + the app). Recommended check: apply Step A
  only to a copy of 4.pdp (rectangle above), load in Raumplan. Expected: a real 4000×3000
  rectangle. If the dimension labels still read the old values, add Step B. If zoom is off, add
  Step C.

## 7. Offset quick-reference (all bases identical up to @0x1a5)
```
0x13f  int32   extent max (+offset)          [view]
0x143  int32   extent max 2                  [view]
0x14b  int16   record count = 4 + N          [keep]
0x14d  4×22B   bounding box rows (thick=250)  [view]
0x1a5  N×22B   REAL WALL TABLE (thick=100)    [*** edit here ***]
        rec i @ 0x1a5+22*i : x1(+0) y1(+4) x2(+8) y2(+12) thick(+16) height(+18), int32/int16 LE
~0x80c  N×42B  body float records (±200 face offset) + ASCII labels   [labels/3D]
0x1dc  16B     random GUID — do not touch
```
