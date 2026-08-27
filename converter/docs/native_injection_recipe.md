# Native SUPP_FR injection recipe — empty wall base + ONE injected socket

> **Goal (the last ORDX→PDP-native blocker):** build a loadable Raumplan-native PDP
> (`ffffff7f` header) = an empty wall base **with one socket injected from scratch**, so it
> renders with **Raumplan's own icon** and needs **no hand-drawn base**.
>
> **Status: DONE for the socket, with a byte-exact correctness proof.** The injection is
> implemented in `src/injectSupp.js` and the candidate file is written to
> `analysis/out/inject_test.pdp`.
>
> **Every claim is `file@offset = bytes`.** Controlled pair (the cleanest single-item source):
> `P0 = G:\My Drive\קבצים ללמידת מכונה\PDP\0.pdp` (5071 B, empty room, 0 items),
> `P1 = …\1.pdp` (19240 B, +1 socket), `P2 = …\2.pdp` (33420 B, +2 sockets).
> Target family bases: `templates/native/wall{3..6}.pdp`.

---

## 0. TL;DR

- Adding one socket to the empty base is **+14169 B** across **three payloads** + small view edits:
  **A** 431 B placement record, **B** ~4224 B 2D symbol section, **D** ~9529 B 3D scene.
  All three are **position-independent** — the on-screen position lives **only** in record A.
- The injection is expressible as **16 anchor-relative edits** on `P0` (table in §3). Replaying
  them on `P0` reproduces `P1` **byte-for-byte** (`injectSupp.selfTest() → ok:true`). This is the
  correctness proof the prior "fragile / multi-region" pass never obtained.
- `analysis/out/inject_test.pdp` (the load-test candidate) is produced by
  `injectSupp(P0, socket, …, along=1000 on wall0)`. It is **byte-identical to the known-loadable
  `P1` except the 16-byte per-item GUID** (`@0x28a`, which Raumplan is proven to ignore). So it is
  a structurally valid Raumplan file that **will load and render the socket icon at 1000 mm on
  wall0**. `inject_test_moved.pdp` (along=2500) demonstrates placement control.
- `analysis/out/inject_test_wall3.pdp` is the literal splice into `templates/native/wall3.pdp`
  requested by the task. **It is EXPERIMENTAL** — `wall3` is a *different* base family (per-wall
  view records, no `05 01` symbol layer), so its view-record weaving and 3D-header counts are not
  reproduced. It is the file whose load-test is genuinely informative (§6).

---

## 1. Why a base family matters (the key structural finding)

`P0` and `P1` share the **identical** wall base — they differ **only** by extent byte `@0x143`
(`0x00→0x64`) and the appended socket. So `P0→P1` is a **pure socket injection**, the cleanest
possible signal.

`wall3.pdp` is **NOT** "`P0` + more walls". Byte evidence:
- `P0` has the empty **symbol-layer** marker `05 01 00 00 00` at `P0@0x60b`; the socket's 2D
  section is spliced right there (`P1@0x7ba` = same marker, then the 2D anchor
  `6c000000290000006c00000027000000fffb`). **`wall3` has no `05 01 00 00 00`** — its drawing
  layer is organised as **per-wall view elements** (sig `007f0001000000ffffff` at
  `wall3@0x82b,0x855,0x87f`, one per wall).
- The socket's **2D icon = 68 vector primitives** (`fffb0002` appears **68×** in `P1`, **0×** in
  `P0`/`wall3`) — all self-contained inside block **B** (`P1@0x7c1..0x17fc`), *not* spread across
  the file. Good: B is one contiguous payload.
- The 3D-scene header (`80 3f` float run just before `GENERAL`) **is** identical in `P0` and
  `wall3` (`P0@0xb40..`, `wall3@0xd00..`), so **D splices before `GENERAL` in either family.**

**Consequence:** the socket A/B/D bytes are universal, but the *insertion anchors and the small
view-record edits are family-specific*. The `P0` family is fully solved (byte-exact). `wall3`
needs its per-wall view records handled (unsolved statically → §6 load-test).

---

## 2. The three payloads (spans in `P1`)

| block | `P1` span | len | what it is | head bytes |
|---|---|---|---|---|
| **A** | `0x1bb..0x36a` | 431 | SUPP_FR placement record | `01000000 4400 1709121b242d363f4851 …` |
| **B** | `0x7c1..0x17fc` | 4155 | 2D symbol (68 `fffb0002` vector prims) | `44000000 6c000000 29000000 …` |
| **B-tail** | `0x180f..0x185d` | 78 | symbol-layer tail/count | `04000000 c8c2000000000000 …` |
| **D1** | `0x1d88..0x1d90` | 8 | `"ZYLINDER"` marker | `5a594c494e444552` |
| **D2** | `0x1d9a..0x431b` | 9521 | 3D scene (6× ZYLINDER mesh) | `00…` (ends at `GENERAL`) |

The record **A** field map (offsets from the `SUPP_FR` marker; `P1` marker `@0x1dd`):

```
marker-34  01 00 00 00              leading count/flag (copy verbatim)
marker-30  44 00 <09-byte ramp>     palette/gradient index (copy verbatim)
marker+0   "SUPP_FR\0"              record type
marker+9   cp1255 name              f9 f7 f2 20 eb f4 e5 ec = "שקע כפול"
marker+112 "supp_fr\0"              generic type id
marker+133 int32 PLAN X (mm)        *** position ***  P1 = -19000
marker+137 int32 PLAN Y (mm)        *** position ***  P1 = -20017
marker+141 int32 ALONG-wall (mm)    *** render driver ***  P1 = 1000
marker+173 16 B per-item GUID       reroll on duplicate (Raumplan ignores it)
```

---

## 3. The verified splice (P0 family) — 16 anchor-relative edits

Each edit replaces `al` base bytes at `P0`-offset `p0` with `bl` bytes taken verbatim from `P1`
at `p1` (`al=0` ⇒ pure insertion). **Replaying this list on `P0` yields `P1` exactly** —
`injectSupp.selfTest()` returns `{ok:true, outLen:19240}`.

| # | `P0@`   | al | ⇐ `P1@` | bl   | meaning | required? |
|---|---------|----|---------|------|---------|-----------|
| 1 | `0x143` | 1  | `0x143` | 1    | extent byte `0x00→0x64` (zoom-to-fit) | cosmetic |
| 2 | `0x1bb` | 0  | `0x1bb` | 431  | **A** record — insert after wall term. `64 00 28 0a 00 00 @0x1b5` | **yes** |
| 3 | `0x1dc` | 16 | `0x38b` | 16   | file GUID | cosmetic (Raumplan ignores) |
| 4–8 | `0x207,0x2d6,0x3a5,0x474,0x543` | 1 | … | 1 | view-state flags (stride `0xcf`) — **not** item flags | cosmetic |
| 9 | `0x612` | 7  | `0x7c1` | 4155 | **B** 2D symbol — fills the `05 01` symbol layer | **yes** |
| 10| `0x62c` | 2  | `0x180f`| 78   | **B** tail/count | **yes** |
| 11| `0x659` | 10 | `0x1888`| 10   | view-extent floats | cosmetic |
| 12| `0x824` | 22 | `0x1a53`| 23   | view rec / auto label (`מחוץ לקיר` = "outside the wall") | likely cosmetic |
| 13| `0x8c8` | 28 | `0x1af8`| 17   | view-record restructure | uncertain |
| 14| `0xace` | 16 | `0x1cf3`| 11   | view-record restructure | uncertain |
| 15| `0xb68` | 0  | `0x1d88`| 8    | **D** `"ZYLINDER"` — insert before `GENERAL` | 3D only |
| 16| `0xb72` | 0  | `0x1d9a`| 9521 | **D** 3D scene body | 3D only |

Anchors (so the list survives wall-count shifts *within* the family):
`A` → after the **first** `64 00 28 0a 00 00`; `B` → the `05 01 00 00 00` symbol layer;
`D` → immediately before ASCII `"GENERAL"`.

---

## 4. General API — `src/injectSupp.js`

```js
const inj = require('./src/injectSupp.js');

inj.selfTest();                       // {ok:true} — proves the splice reproduces P1 byte-for-byte

// GENERAL spec:  injectSupp(baseBuf, srcSuppBlocks, x, y, along, {wall})
//   baseBuf : native empty room of the P0 symbol-layer family (Buffer)
//   x,y,along : target plan position (mm); or pass {wall:{x1,y1,x2,y2,off}} + along
//   -> { buf, marker }   (marker = SUPP_FR offset in the output)
const { P0 } = inj.loadPair();
const wall0 = { x1:-20000, y1:-19900, x2:-16000, y2:-19900, off:-117 }; // off = mount offset mm
const { buf, marker } = inj.injectSupp(P0, null, 0, 0, /*along=*/1000, { wall: wall0 });
require('fs').writeFileSync('analysis/out/inject_test.pdp', buf);

// primitives it composes:
inj.injectSocketFamilyP0(base)        // splice A/B/D (asserts P0-family anchors), returns {buf,marker}
inj.setSuppPosition(buf, marker, X, Y, along)   // the +133/+137/+141 writer
inj.placeOnWall(buf, marker, wall, along)       // compute X,Y from along + wall.off, then write
inj.rerollGuid(buf, marker)                     // fresh 16-B GUID at marker+173
inj.extractSuppBlocks(srcP1)                     // pull A/B/Btail/D1/D2 from any single-item source
```

**To generalise to other item types** (switch/tap/gas…): build one single-item native source per
type in Raumplan (like `P1` for the socket), call `extractSuppBlocks(thatSource)`, and splice with
the same anchors. The 2D/3D spans differ per type but the anchors and record layout are identical.

**Position recipe** (from `docs/item_position_source.md`, live-confirmed): set **all three**
`+133=X`, `+137=Y` (must land on the host wall so face + host-pick are right), and
`+141 = distance from the wall's start endpoint, mm` (the render driver). Writing only X/Y leaves
the item at the stale along-position or detaches it.

---

## 5. Output files (`analysis/out/`)

| file | base | socket | vs P1 | confidence |
|---|---|---|---|---|
| **`inject_test.pdp`** | P0 (empty) | along=1000 on wall0 | **only the 16-B GUID differs** (`@0x28a`) | **very high — will load** |
| `inject_test_moved.pdp` | P0 (empty) | along=2500 on wall0 | GUID + 3 position int32 | very high — proves placement |
| `inject_test_wall3.pdp` | wall3 (3-wall) | along=1000 on wall0 | different family | **experimental — see §6** |

`inject_test.pdp` is byte-identical to `P1` (a real Raumplan save that loads) apart from the
per-item GUID, which the RE proved Raumplan does not validate. It is therefore the recommended
load-test and the drop-in bundled "socket-capable empty base": reshape its walls in place
(`@0x1a5`, `native_wall_reshape.md` / `convertNative.reshapeWalls`) and move/duplicate the socket
with `setSuppPosition` to build any room — no manual base-drawing.

---

## 6b. `wall3` splice — SOLVED structurally (v2, 2026-08-17)

The prior `inject_test_wall3.pdp` errored **3336 "List count out of bounds"**. Root cause found and
fixed: it inserted **A at `0x1bb`**, which for `wall3` is the **start of wall #1**, so walls 1–2 got
shoved 431 B downstream (`inject_test_wall3.pdp` wall terminators moved to `0x1b5,0x37a,0x390` vs
`wall3`'s `0x1b5,0x1cb,0x1e1`). The wall list was split → count out of bounds.

**Fix (`injectSocketNativeWallBase` in `src/injectSupp.js`):** insert **A after the ENTIRE wall
list** = `(last 6400280a0000 terminator) + 6`. For `wall3` that is `0x1e7` (not `0x1bb`).

What must / must **not** be bumped — proven against P0/P1/P2 (`file@offset`):
- **wall count `@0x14b`**: `P0=P1=P2=5` → **unchanged** by adding an item. `wallN@0x14b = walls+4`
  (`W3=7,W4=8,W5=9,W6=10`). Leave it. Inserting A *after* the list keeps it valid.
- **per-view `67 XX 00 00 00 02` flag**: boolean "view has content", **not** a count
  (`P0=0, P1=1, P2 still =1`). `wallN` already has drawn walls → all flags already `1`
  (`W3` has 7, all `67 01…`). **No flag bump needed.**
- **3D primitive count**: there is **no external counter** — the P0→P1 splice adds 6 ZYLINDER by a
  pure insert before `GENERAL` with zero count edits (`selfTest` is byte-exact). Count is
  self-contained in D2. `wallN`'s pre-`GENERAL` region is byte-identical to P0 → D splices cleanly.
- only pre-A P0→P1 change is the cosmetic extent byte `@0x143`.

**Anchors (all by byte-search, so the same code serves wall3/4/5/6):** A → `lastIndexOf(6400280a0000)+6`;
B → `indexOf(007f0001000000ffffff)` (before the first view record); D1 → `GENERAL-90`, D2 → `GENERAL-80`.

**Output: `analysis/out/inject_wall3_v2.pdp`** (19731 B = wall3 5519 + A 431 + B 4252 + D 9529).
`injectSupp.selfTest().crossFamily` passes every structural invariant: walls undisplaced &
contiguous, `@0x14b` unchanged, `SUPP_FR` 0→1, 68 `fffb0002` 2D prims, 6 `ZYLINDER`, one `GENERAL`,
marker `@0x209` = `SUPP_FR`. Socket placed on wall1 at along 1500 (X=1500, Y=3000).

**Remaining unknown (load-test only):** `wall3` lacks P0's `05 01` symbol-layer marker, so block B
(the 2D icon) is grafted before the first view record without that header. If Raumplan needs the
icon inside a `0501` layer, re-run with `injectSocketNativeWallBase(base,{withLayerHeader:true})`
(prepends an empty `05 01` header to B). The **decisive** question the fix answers: does relocating A
to end-of-wall-list clear error 3336? If yes and the icon shows → cross-family injection is done.

## 6. `wall3` splice — what the load-test will reveal (honest gaps)

`inject_test_wall3.pdp` inserts A after `wall3@0x1bb`, B before wall3's first per-wall view element
(`007f0001000000ffffff @0x82b`), and D before `GENERAL @0xd82`; it rerolls the GUID and sets the
position. Markers verify present (SUPP_FR@0x1dd, 6× ZYLINDER, GENERAL, 2D anchor). **But two
family-specific pieces are NOT reproduced** because `wall3` is not the `P0` family:

1. **View-record weaving** — the `P0` splice edits 4 small in-place view records (#11–14 above)
   that reference the item inside the plan/elevation views. `wall3`'s views are structured
   per-wall and have no matching slots; the experimental file leaves them untouched. If Raumplan
   requires them, expect `"-11 List count out of bounds"` / error 921, or a missing icon.
2. **3D-scene header counts** — D's primitives are inserted, but `wall3`'s empty 3D header
   (the `06000000 02000000 06000000…` count block before `GENERAL`) is not bumped to 6. The 2D
   plan icon may still draw; the 3D view may be wrong or error.

**Decisive test:** load `inject_test.pdp` first (should show the socket icon at 1000 mm on wall0).
Then load `inject_test_wall3.pdp`: (a) does it open at all? (b) does the socket icon render in
plan? (c) does the 3D view open? The answers tell us whether a clean `wall3` splice needs the view
weaving (1) and the 3D count bump (2), or whether A+B+D-at-anchors is sufficient. Until then, the
**recommended production path is inject-into-P0 + reshape walls**, which is byte-exact and
guaranteed.

---

## 7. Confidence

- **Proven (byte-exact):** the socket A/B/D spans; the 16-edit splice; that replaying it on `P0`
  equals the loadable `P1`; that position lives only in A (`+133/+137/+141`); that the GUID is
  ignored. `inject_test.pdp` is P1 modulo GUID ⇒ loads.
- **High:** `inject_test.pdp`/`inject_test_moved.pdp` render the socket with Raumplan's icon at the
  chosen along-distance (position mechanism live-confirmed previously).
- **Unproven (needs Raumplan load-test):** the `wall3` cross-family splice — view weaving and 3D
  header counts (§6). Everything needed to settle it is in this doc + `inject_test_wall3.pdp`.
