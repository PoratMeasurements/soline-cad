# Adding a Raumplan-native item (SUPP_FR) to a native PDP wall base

> Goal: make ORDX fixtures render with **Raumplan's own icons** (SUPP_FR) by adding item
> records to a Raumplan-native PDP (`ffffff7f` header). This is the format whose items use
> Raumplan symbols, unlike the DR path (InnoDraw icons, rejected).
>
> **Every claim below is cited file@offset = bytes.** Files:
> `P0/1/2` = `G:\My Drive\קבצים ללמידת מכונה\PDP\{0,1,2}.pdp` (empty / +1 socket / +2 sockets),
> `T` = `analysis/out/תשתיות.pdp` (11 walls + 22 items), `W3..W6` = `templates/native/wall{3..6}.pdp`.
> Analysis scripts: `scratchpad/s1..s19.js`.

---

## 0. TL;DR — the answers

1. **The 431-byte SUPP_FR record is NOT self-sufficient.** It is a *placement/index* record only.
   The icon is drawn from geometry stored elsewhere in the file: a **2D symbol section** (~4.2 KB
   of vector paths) and a **3D scene section** (~9.5 KB of `ZYLINDER`/`QUADER` primitives). Adding
   one socket to the empty base costs **14 169 B** = 431 B record + ~4.2 KB 2D + ~9.5 KB 3D.
   Proven: `P0`→`P1` = +14169 B, and even an *identical* 2nd socket (`P1`→`P2`) adds another
   ~14.2 KB **including 6 more `ZYLINDER`** — Raumplan re-emits full geometry per instance, so it
   is not regenerated from a catalog at load. (`s5.js`, `s8.js`.)

2. **`תשתיות` does NOT avoid per-item geometry** — it *co-locates* it. Its 22 items are 22×431 B
   records (`T@0x261` stride 431) **plus** one shared 2D drawing section and one shared 3D scene
   holding **35 `ZYLINDER` + 60 `QUADER`** (`s3.js`, `s6.js`). Geometry scales with item
   *complexity* (a switch = 1–2 primitives; a socket = 6 zylinders), which is why 22 varied items
   fit in 171 KB while 22 sockets in the heavy layout would be ~310 KB. **There is no external
   symbol library the record points to** — the record's type tag is the generic ASCII `supp_fr`,
   and its GUID links to the *embedded* geometry, not a catalog part.

3. **The geometry is position-independent.** The socket's plan position (`-19000,-20017`) appears
   **only inside the 431 B record** (`P1@0x262/0x266`) and **nowhere** in the 2D or 3D blocks
   (`s10.js`). => An item is *moved* by editing its record's position field alone; the symbol
   follows. This is the key that makes the robust path below work.

4. **Recommended path (robust, low-risk): reshape-a-base-that-already-has-items + retarget**,
   not hand-injection into a clean base. Editing only positions changes 0 bytes of size => no
   count/length fields move => no "error 921". Hand-injection into `W3..W6` is *possible* but is
   multi-region surgery that **requires a live Raumplan load-test** (§5).

---

## 1. Minimal per-item footprint — byte evidence

`P0` (0 items, 5071 B) → `P1` (1 socket, 19240 B). Clean edit script (`s15.js`), net +14169:

| # | `P1` offset | len | what it is | evidence |
|---|-------------|-----|-----------|----------|
| A | **0x1bb** | **431** | **SUPP_FR placement record** | starts `01000000 4400 1709121b242d363f4851 …`; `SUPP_FR\0` @0x1dd |
| B | **0x7de** | **~4224** | **2D symbol section** (plan icon vector paths) | anchor `6c000000290000006c00000027000000fffb` @`P1@0x7c5` (`s19.js`) |
| C | 0x1a69 | 1 | list terminator byte | — |
| D | **0x1e0a** | **~9529** | **3D scene** (6× `ZYLINDER` mesh) | `ZYLINDER` @0x1d88,1e5a,1f2c,1ffe,20d0,21a2 (`s19.js`) |

Plus small **in-place substitutions** in the base region (`s15.js`) — all **view/cosmetic, NOT
required** for the item to exist:

- `@0x143` int32 `00`→`64` = view extent-Y max (zoom-to-fit only; matches `native_wall_reshape.md` §4).
- `@0x1dc` 16 B GUID rerolled = per-save random GUID, Raumplan does not validate it (prior finding).
- 5× `00`→`01` at stride 0xcf (0x207,0x2d6,0x3a5,0x474,0x543) = **view-state flags, NOT item flags.**
  **Corrected/important:** these are *not* "contains-item" flags. Counter-proof (`s18.js`):
  `W3` has **0 items but flags = 1**, `T` has **22 items but flags = 0**. The 0→1 flips in
  `P0`→`P1` were incidental view/zoom state. **Do not touch them when adding an item.**
- `@0x659` 10 B float = view-extent floats (cosmetic).
- `@0xb68` `00…`→`ZYLINDER`, `@0xba4` `06000000 02000000 06000000 6c000000…` = the 3D-scene
  header being *populated* (counts: 6 primitives). This is part of block D, i.e. **required for 3D**.

**Conclusion:** minimal footprint = record (A) + 2D symbol (B) + 3D scene (D) ≈ 14.2 KB. The 431 B
record alone will not render a symbol — the vector paths of the icon physically live in section B.
Whether Raumplan could *regenerate* B/D from the record alone (making a compact record-only file
loadable) is the one thing **no static file proves** — every Raumplan-saved file embeds the
geometry — so a record-only file is **unproven and presumed insufficient**; see the live-test in §5.

### The 431 B SUPP_FR record — field map (offsets relative to the `SUPP_FR` marker)
From `P1` (marker @0x1dd) and cross-checked on `T`'s 22 records (`s7.js`, `s13.js`, `s19.js`).
In `P1` the record starts 34 B *before* the marker (@0x1bb); in `T` the 431-stride is measured
**from the marker** (@0x261). **Anchor on the `SUPP_FR` marker**, not the record start.

```
marker-34  int32   01 00 00 00           (leading count/flag; copy verbatim)
marker-30  17..51  44 00 <ramp 09-byte>  (palette/gradient index; copy verbatim)
marker+0   8 B     "SUPP_FR\0"           record type marker
marker+9   cp1255  item name             e.g. f9 f7 f2 20 eb f4 e5 ec = "שקע כפול"
marker+51  cp1255  item name (repeat)
marker+112 ascii   "supp_fr\0"           generic lowercase type id (NOT a catalog key)
marker+133 int32   PLAN X  (mm)          *** retarget here ***   P1 = -19000
marker+137 int32   PLAN Y  (mm)          *** retarget here ***   P1 = -20017
marker+141 int32   1000 in P1, 0 in T    UNCERTAIN (Z / mount-height / rotation) — live-test
marker+173 16 B    per-item GUID         links record→embedded geometry; reroll on duplicate
marker+206 cp1255  "בלי העדפות"          "no preferences" (e1 ec e9 20 e4 f2 e3 f4 e5 fa)
marker+326 ascii   "N,N,Y"               boolean flags string
```

---

## 2. The wall bases `W3..W6` are "clean" — no item infrastructure

`s11.js`: `W3..W6` (and `P0`) have **0** `SUPP_FR`, **0** `ZYLINDER`/`QUADER`, **0** 2D-sig; only
the `GENERAL` catalog + the wall table. `cnt@0x14b = 4+N` (W3=7, W4=8, W5=9, W6=10). They **do**
carry the same skeletons an item populates: the stride-0xcf view table (`W3` @0x23b, `s17.js`) and
an empty 3D-scene header before `GENERAL` (`W3` @0xd82). So `W3..W6` are the **same file family**
as `P0`; the `P0`→`P1` edit transfers *structurally* (but not at fixed offsets — everything after
the wall table shifts by `22*(N-1)` because the wall table is `N` records of 22 B).

**Key consequence:** there is **no single item-count int** in the header. `@0x143` did *not* go
0→1→2 across `P0/P1/P2` (it went 0→100→100, `s9.js`) — it is an extent, not a count. Item count is
implicit in the number of `SUPP_FR` records + the 2D/3D section headers. This is exactly why
hand-injection is fragile and the retarget path (which changes **no** counts) is preferred.

---

## 3. RECOMMENDED path — reshape base + retarget items (no injection, no count risk)

Because geometry is position-independent (§0.3) and walls are already reshapeable in place
(`@0x1a5`, `native_wall_reshape.md`), the safe converter recipe is:

1. **Pick a base that already contains the needed item types**, drawn+saved in Raumplan.
   `T` (`תשתיות`) is the ready-made library — it holds all 15 distinct types, each as a real
   Raumplan item with correct icon + geometry (`s13.js`):

   | name (cp1255) | marker offset in `T` | plan pos in `T` |
   |---|---|---|
   | מים משולב | 0x261 | (1400,-1930) |
   | מפסק כפול | 0x410 | (1200,-1925) |
   | מפסק בודד-סימון | 0x5bf | (1056,-1930) |
   | מפסק כפול-סימון | 0x76e | (906,-1930) |
   | מים קרים | 0x91d | (756,-1930) |
   | מים משולב | 0xacc | (686,-1930) |
   | מים חמים | 0xc7b | (486,-1930) |
   | ביוב | 0xe2a | (416,-1880) |
   | מפסק בודד | 0xfd9 | (356,-1925) |
   | מפסק משולב | 0x1188 | (276,-1924) |
   | נקודת אנטנה | 0x1337 | (66,-1930) |
   | נקודת גז | 0x14e6 | (-14,-1930) |
   | נקודת טלפון | 0x1695 | (-114,-1930) |
   | שקע בודד | 0x1844 | (-174,-1923) |
   | פתח יציאת אויר 15 | 0x19f3 | (-254,-1930) |
   | פתח יציאת אויר 12.5 | 0x1ba2 | (-404,-1930) |
   | פתח יציאת אויר 10 | 0x1d51 | (-529,-1930) |
   | שקע בודד-סימון | 0x1f00 | (-629,-1930) |
   | שקע כפול | 0x20af | (-779,-1923) |
   | שקע כפול-סימון | 0x225e | (-923,-1930) |
   | שקע משולש | 0x240d | (-1173,-1924) |
   | שקע משולש-סימון | 0x25bc | (-1383,-1930) |

2. **Reshape the walls** to the ORDX room (write `@0x1a5`, per `convertNative.js` / `native_wall_reshape.md`).
3. **Retarget each item you need**: for the record at `marker`, write the new plan position
   ```js
   buf.writeInt32LE(planX, marker + 133);   // mm
   buf.writeInt32LE(planY, marker + 137);   // mm
   ```
   The 2D icon and 3D mesh move with it (position lives only here — `s10.js`).
4. **Surplus items** (types you don't need): collapse them out of view — move far off-plan
   (e.g. `planX = -10_000_000`) so they don't clutter the drawing. This changes **0 bytes of size**
   => no count/length field moves => **no error 921** (the task's add-only / no-reduce rule is
   satisfied because you never remove a record).

**Why this is the primary recommendation:** it reuses geometry Raumplan itself authored (guaranteed
to render), needs no section-header count math, and is a pure in-place int32 patch. The only cost is
that the base's *set* of item types is fixed; curate one or a few library bases to cover the ORDX
fixture vocabulary.

---

## 4. Per-type placement (retarget) vs. true injection

**Retarget (preferred):** to place a מפסק / ברז(מים) / גז / socket, do **not** copy bytes — just
retarget the record of that type already in the base (table in §3). A מפסק = record @`T`+marker
0xfd9 (`מפסק בודד`) or 0x410 (`מפסק כפול`); מים = 0x91d/0xc7b/0xacc (קרים/חמים/משולב); גז =
0x14e6 (`נקודת גז`); socket = 0x1844/0x20af/0x240d (בודד/כפול/משולש). Move it to the target mm.

**True injection (only if you must add a type absent from the base, or grow the count):**
one item = **three** spans to splice + header math:
- copy the type's **431 B record** into the record region,
- copy the type's **2D symbol paths** into the 2D drawing section (anchor
  `6c000000290000006c00000027000000fffb`),
- copy the type's **3D primitives** into the 3D scene and **bump the 3D-scene header counts**
  (the `06000000 02000000 06000000…` block that sits just before `GENERAL`, `P1@0xba4`),
- reroll the per-item GUID (marker+173), set position (marker+133/137).

Isolating "one item's" 2D+3D spans out of `T`'s **consolidated** sections is error-prone (the 22
items' primitives are interleaved in one scene). The clean way to get a per-type payload is the
heavy single-item files: `P1`/`B.pdp` already contain exactly one socket's three spans. **Best
practice: build one single-item native source per type in Raumplan** (like `P1` for socket), then
inject/duplicate from those, mirroring how Raumplan grows `P1`→`P2` (a byte-copy of the item's
block + retarget + new GUID, proven in `s8.js`). Any injection **must be live-tested** (§5).

---

## 5. Concrete add-item recipe

**Input:** a wall base `W{N}.pdp` (or a library base with items), and a room = walls + items
`{type, planX, planY, height}` (mm).

### 5a. Preferred (library base + retarget) — fully specifiable, low risk
```
base   = a Raumplan save containing ≥ the needed item types (e.g. תשתיות.pdp)
walls: write @0x1a5 (N×22B x1,y1,x2,y2 int32) per native_wall_reshape.md
items: for each needed {type, planX, planY}:
         m = marker offset of a record of `type` in base   (table §3)
         writeInt32LE(planX, m+133); writeInt32LE(planY, m+137)
       for each unused record: writeInt32LE(-10_000_000, m+133)   // park off-plan
DO NOT change @0x14b, the SUPP_FR count, any 3D-scene header, or the GUID.
```
`height` (marker+141) is **not reliably decoded** (1000 in `P1`, 0 in `T`) — leave the base's value
and **live-test** whether items need a Z/mount-height. Plan X/Y are solid.

### 5b. Injection into a clean `W{N}` base — structure known, offsets must be computed live
Because everything past the wall table shifts by `22*(N-1)`, compute anchors at runtime, don't
hardcode `P1` offsets:
```
recIns = end of last real-wall record region (before the view table)   // splice 431B record
2dIns  = search base for the 2D-section anchor 6c000000290000006c00000027000000fffb   // splice ~4.2KB
3dIns  = search base for the 3D-scene header just before "GENERAL"      // splice ~9.5KB + bump counts
```
Then patch marker+133/137 (position) and marker+173 (fresh 16-byte GUID). Leave view-state flags,
`@0x143`, `@0x14b`, and the file GUID untouched.

### What needs a live Raumplan load-test (cannot be settled from static files)
1. **Can section B (2D symbol) be omitted** and Raumplan regenerate the icon from the record? If
   yes, a compact record-only file becomes viable (huge simplification). Current evidence says
   **no** (every save embeds it), but only a load-test is decisive. **Test:** take `P1`, delete the
   2D span, load — does the socket icon still draw?
2. **Injection correctness:** apply 5b to a copy of `W3`, load — does exactly one socket appear at
   the target, with walls intact and no "-11 List count out of bounds" / error 921?
3. **`height`/Z field** (marker+141): does changing it move the item vertically / change mount
   height, or is it inert?
4. **Off-plan parking** (5a surplus items at `-10_000_000`): confirm parked items don't render a
   stray symbol or break zoom-to-fit.

---

## 6. Confidence

- **High:** 431 B record is placement-only; icon geometry is a separate 2D section + 3D scene;
  geometry is position-independent; retarget = in-place int32 at marker+133/137; view-state flags
  are NOT item flags; wall bases carry no item infrastructure. (All byte-cited above.)
- **Medium:** exact 2D/3D span boundaries (diff-algorithm-dependent, ~4.2 KB / ~9.5 KB) and the
  3D-scene header count fields — good enough to locate by anchor, not to hardcode.
- **Unproven (needs Michael + Raumplan):** whether the 2D symbol can be omitted; whether hand-
  injection loads clean; the `height`/Z field; parked-item behavior. Prefer §5a until §5 tests pass.
