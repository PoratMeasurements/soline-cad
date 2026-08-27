# Where a Raumplan-native item's on-screen position really lives

> **Question this settles:** the ORDX→PDP converter must place SUPP_FR items (sockets,
> switches, taps…) where we want them in the plan. Prior doc (`native_item_add.md`) said
> "write the record int32 at marker+133/+137." Live Raumplan tests disproved that: editing
> +133/+137 did **not** move the socket (stayed put), and pushing +137 far made it vanish.
>
> **Method used here:** the controlled pair in `G:\My Drive\קבצים ללמידת מכונה\PDP\` —
> `1.pdp` (one socket) and `2.pdp` (the *same* socket + a second copy shifted 1000 mm along
> the wall). Wall0 (both files) `@0x14d` = `(-20000,-19900)→(-16000,-19900)`. I aligned the
> two socket instances inside `2.pdp` byte-for-byte and found *every* span that differs
> between them. **Every claim is `file@offset = bytes`.** Analysis scripts in scratchpad:
> `find.js, rec.js, recval.js, scan.js, i16.js, align.js, anchor.js, diff2d.js, hexcyl.js,
> zyl.js, blocks.js, blk4.js, recfull.js, flags.js`.

---

## 0. TL;DR — the answer

**The on-screen position is stored ONLY in the 431-byte SUPP_FR record, in *three* int32
fields — and the field that actually drives the plan render is the wall-relative one, not the
absolute XY.** The 2D symbol and the 3D mesh carry **zero** position — they are byte-for-byte
identical between two sockets that render 1000 mm apart.

| record field (rel. to `SUPP_FR` marker) | socket1 | socket2 | Δ | role |
|---|---|---|---|---|
| **+133** int32 | `-19000` | `-18000` | **+1000** | absolute plan **X** (mm) — *host-wall picker* |
| **+137** int32 | `-20017` | `-20017` | 0 | absolute plan **Y** (mm) — *host-wall picker / which face* |
| **+141** int32 | `1000` | `2000` | **+1000** | **distance ALONG the host wall from its start endpoint (mm) — THIS drives the render** |

**Why +133/+137 alone don't move it, and +141 does** (a wall-hosted-object model that
reconciles both live tests):
- Render along-wall position = **+141** (a parametric distance), *not* recomputed from X/Y.
- The host wall is picked by **proximity of (X,Y) at +133/+137** to a wall in the table.
- So editing +133/+137 *along* the wall while leaving +141 stale → host still wall0, along
  position still +141 → **symbol stays put** (exactly the observed "did not move").
- Pushing +137 far off every wall → no host wall found → **item detaches/vanishes** (exactly
  the observed "disappeared").

**Recipe (to move an item):** set **all three consistently** — `+133=X`, `+137=Y` (must lie on
the target wall so host-picking + face are right) **and `+141 = distance from that wall's start
endpoint to the item, in mm`**. The 2D icon and 3D mesh follow automatically; **no stroke/mesh
bytes change.** The earlier attempts failed because they wrote +133/+137 but left **+141**
pointing at the old wall position.

---

## 1. Absolute plan coords exist ONLY in the record — proven exhaustively

Full-file scan of `2.pdp` for the socket coordinates as **int32 AND int16** (`scan.js`,
`i16.js`) returns them at exactly four offsets — the two records — and **nowhere else**:

```
2.pdp@0x262 int32 = -19000   (socket1 marker0x1dd +133, X)
2.pdp@0x266 int32 = -20017   (socket1 +137, Y)
2.pdp@0x411 int32 = -18000   (socket2 marker0x38c +133, X)
2.pdp@0x415 int32 = -20017   (socket2 +137, Y)
```

The int16 hits for `-20000/-19900` are all in `@0x14d..0x1b1` — that is the wall table and
bounding box, **not** the item. => The item's symbol geometry does **not** contain its plan
position in any obvious int encoding.

Record values read directly (`recval.js`, `recfull.js`):
```
socket1 (marker 0x1dd): +133 X=-19000  +137 Y=-20017  +141=1000
socket2 (marker 0x38c): +133 X=-18000  +137 Y=-20017  +141=2000
Δ+133 = +1000   Δ+137 = 0   Δ+141 = +1000
```
`1.pdp`'s single socket is identical to `2.pdp`'s socket1 (`-19000,-20017,+141=1000`),
confirming `2.pdp` = `1.pdp` + one shifted copy.

### +141 is the along-wall distance (not Z/height)
- Wall0 start endpoint x1 = `-20000` (`2.pdp@0x14d int32 = -20000`, `recfull.js`).
- socket1: `+141 = 1000 = (-19000) − (-20000)` = distance from wall start to the item.
- socket2: `+141 = 2000 = (-18000) − (-20000)`.
- The two sockets are the **same part on the same wall**; a Z/mount-height would be **equal**.
  It differs by exactly the 1000 mm move → **+141 cannot be Z; it is the along-wall param.**
- Origin = the wall's **first** endpoint (`x1,y1` at `0x14d+0`), because measuring from the
  second endpoint (`-16000`) would give 3000/2000, not 1000/2000.
- Units: plain **int32 millimetres**, no scaling (1000 mm → `1000`).

---

## 2. The 2D symbol carries NO position — byte-identical between the two instances

Two 2D symbol sections exist (anchor `6c000000 29000000 6c000000 27000000 fffb`, `anchor.js`):
```
2.pdp@0x970   socket1 2D symbol
2.pdp@0x19a4  socket2 2D symbol      (0x19a4 − 0x970 = 0x1034 = 4148 bytes each)
```
Direct diff of the two 4148-byte blocks (`diff2d.js`):
```
2D block len=4148; differing bytes = 0
```
**Zero differing bytes** across the entire 2D symbol, for two sockets that render 1000 mm
apart. The 2D symbol is authored in a **local frame centred on the item origin**; it contains
no absolute coordinates and no per-instance translation. Raumplan translates it at draw time
from the record. Editing 2D strokes to move an item is therefore neither necessary nor
possible-by-delta — there is no coordinate in there to shift.

---

## 3. The 3D mesh carries NO position either

`2.pdp` has 12 `ZYLINDER` primitives = 6 per socket (`find.js`):
```
socket1 3D: 0x2fb3 0x3085 0x3157 0x3229 0x32fb 0x33cd   (stride 0xd2 = 210)
socket2 3D: 0x3571 0x3643 0x3715 0x37e7 0x38b9 0x398b
```
Each `ZYLINDER` record is almost entirely zero; comparing socket1[k] vs socket2[k]
(`hexcyl.js`, `zyl.js`) the **only** difference is a 16-byte GUID at `label+0x90`
(e.g. `2.pdp@0x3043` vs `2.pdp@0x3601`). No coordinate, radius, or transform differs.
=> the 3D mesh is also a **position-independent local primitive set**; instances differ only
by a per-primitive GUID.

---

## 4. Everything else the 2nd socket added is a copy or an index list — no hidden transform

Structural alignment of `1.pdp`→`2.pdp` (`align.js`, +14180 B total) yields these
socket2-only inserts; each was checked against socket1's data (`blocks.js`, `blk4.js`):

| insert `@2.pdp` | len | what it is | position? |
|---|---|---|---|
| `0x39b` | 427 | the 2nd **SUPP_FR record** | **yes — see §1** |
| `0x1b98` | 3948 | 2nd 2D symbol tail | no — identical copy (§2) |
| `0x2b62` | 276 | copy of `@0x2b1d` | no |
| `0x3571` | 1470 | 2nd 3D `ZYLINDER` group | no — identical mod GUID (§3) |
| `0x4677` | 2880 | copy of `@0x3b37` | no |
| `0x584e` | 1687 | copy of `@0x51b7` | no |
| `0x6c84` | 3492 | scene-graph **index/ID list** (sequential handles 21…36) | no — IDs, not coords |

The `0x6c84` block is a per-element handle table: the values that change are monotonically
increasing element IDs (`21,22,23,…,36`), higher for the 2nd instance. No 1000-mm coordinate
delta appears anywhere in it. (`blk4.js` — the apparent "≈1000" deltas there are artifacts of
comparing two misaligned incrementing-index records, e.g. `1024` vs a small ordinal.)

**Conclusion:** across the whole file the *only* per-instance data that encodes the move are
the three int32s in §1. Nothing in 2D/3D/index needs to change to reposition an item.

---

## 5. Confirming the record-field roles

- **+133 / +137 = absolute plan X/Y (mm), used to pick the host wall and the mounting face —
  NOT the along-wall draw position.** They are the reason the live edit "stayed put" (host
  unchanged, +141 stale) and the reason a far +137 "vanished" (no host wall in range). They
  are *export/index/hit-test-relevant* but do **not** by themselves place the symbol.
- **+141 = along-wall distance from the host wall's start endpoint (mm) = the render driver.**
- **+145..+172 = all zero** in both records (`recfull.js`): there is **no** explicit numeric
  wall-index and **no** explicit perpendicular-offset field. Host wall and face are therefore
  inferred from (X,Y); the perpendicular mount (here Y is 117 mm off the wall centreline at
  `-19900`) is implicit in (X,Y) too.
- **+173..+188 = 16-byte per-item GUID** (differs; reroll on duplicate).
- **+325.. = a variable-length ASCII flags string** (`"N,N,Y"` on socket1 vs `"N"` on socket2,
  `flags.js`) plus colour/state bytes — **not** geometry. NB this string's variable length
  means record byte-offsets *after* +325 are not stable; all position fields sit safely
  before it.

---

## 6. Concrete recipe for the converter

To place an existing SUPP_FR item of the right type (from a library base such as
`תשתיות.pdp`) at plan `(X,Y)` on a known wall:

```js
// marker = byte offset of this item's "SUPP_FR" string in the base
// wall = the host wall {x1,y1,x2,y2} (int32 mm) as written in the wall table @0x1a5/@0x14d
// (X,Y) = desired plan position of the item, in the SAME mm frame as the wall table,
//         and it MUST lie on (or within snapping distance of) that wall.

const along = Math.round(Math.hypot(X - wall.x1, Y - wall.y1)); // distance from wall START, mm
buf.writeInt32LE(Math.round(X), marker + 133);   // absolute X (host-wall + face picker)
buf.writeInt32LE(Math.round(Y), marker + 137);   // absolute Y
buf.writeInt32LE(along,          marker + 141);   // *** along-wall distance — the render driver ***
// leave 2D symbol, 3D mesh, index list, flags, GUID untouched.
```
Notes / rules:
- **Consistency is mandatory.** Set X/Y so they land on the target wall (so host + face are
  correct) *and* set +141 to the matching along-wall distance. Writing only X/Y (the previous
  bug) leaves the item at the old along-position or detaches it.
- `along` is measured from the wall's **first** endpoint (`x1,y1`). If the ORDX item is given
  as a distance along the wall, use that directly; if given as a plan point, project it onto
  the wall and take the arc-length from `x1,y1`.
- **No size change** — all three writes are in-place int32 patches on the existing record, so
  no count/length field moves (no "error 921", satisfies the add-only rule). This is the same
  low-risk in-place strategy already proven for walls (`src/convertNative.js`, `@0x1a5`).
- To **park** an unused library item off-plan, set +133/+137 far away — but note that per the
  live test this *detaches* it (Y far from any wall), which is the desired "hide" effect; do
  **not** rely on it still projecting onto a wall.

---

## 7. What must still be live-tested (cannot be settled from static files)

1. **PRIMARY — confirm +141 is the render driver.** Take `1.pdp`, change **only**
   `marker+141` (0x1dd+141) from `1000`→`3000`, leave +133/+137, load in Raumplan. Expected:
   the socket slides 2000 mm along the wall. This is the one field the earlier tests never
   edited in isolation, and it is the crux of this whole finding.
2. **Confirm the consistency recipe (§6).** On a real wall base, set +133/+137/+141 together
   to a new point on the same wall; load. Expected: socket moves there, icon intact.
3. **Host-wall picking tolerance & face.** How far can (X,Y) be from the wall centreline before
   the item detaches, and does the sign of the perpendicular offset flip the mounting face?
   (Needed to place items reliably on the correct side of the wall.)
4. **Re-hosting onto a different / non-axis-aligned wall.** All test data here is one wall
   along +X, so "+141 = along-wall arc-length" vs "+141 = X in a shifted frame" are
   numerically identical. A test with the socket on a wall at an angle (or a second wall) is
   required before trusting the `Math.hypot` arc-length form for arbitrary wall orientations.

---

## 8. Confidence

- **Proven (byte-cited):** absolute plan coords live *only* in the record at +133/+137; the
  2D symbol is byte-identical between two 1000-mm-apart instances (0 diffs); the 3D mesh is
  identical mod GUID; every other per-instance span is a copy or an index list; +141 = along-
  wall distance from the wall start, int32 mm, and it changed by exactly the move amount while
  +137 did not. The record is the sole position carrier.
- **Strongly inferred (reconciles both live tests, pending test #1):** +141 is the field the
  plan view actually draws from; +133/+137 pick the host wall/face. The previous "write
  +133/+137" recipe failed precisely because +141 was left stale.
- **Open (needs Raumplan):** items #1–4 in §7 — above all, editing +141 alone to prove it
  moves the render, and behaviour on angled/other walls.
