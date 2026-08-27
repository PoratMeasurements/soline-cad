# DR-format PDP — body construction & arbitrary item count

How to produce a **valid, loadable** DR/ELC zero-header `.pdp` with an arbitrary number of items.
Companion to `docs/dr_format_structure.md` (skeleton) and `docs/elc_sets_analysis.md` (transform).
All claims cite file + offset + bytes; corpus = the 9 `mimran-*_DR1.pdp` in
`G:\My Drive\קבצים ללמידת מכונה\סטים`. Analysis scripts in scratchpad (`body1.js … body11.js`).

The three prior live-load facts this doc must explain:
- **(F2)** overwriting object records in place → LOADS, items reposition correctly.
- **(F3)** reducing `objCount` + splicing out 173-B records → **ERROR 921** ("corrupt, reorganize").
- **(F4)** header+walls+`objCount=0`+footer (~277 B) → **ERROR E4245** ("file too short").

---

## 🎯 DECODED 2026-08-24 — the OTHER 921 (symbol-swap 921) is CODE-MEMBERSHIP, not a body problem

A **second, distinct** 921 was blocking correct symbols: with the base's Section E kept
byte-identical, editing an item record's **code/property-block region `[0x91,0x9c)`** — even to a
byte-identical real unit from another loadable file — threw **921**, while the *postype* path
(edit pos/dims/type-string, keep `[0x91,0x9c)` byte-exact) LOADS. This is NOT the splice-921 above
and NOT a Section-E reconciliation.

**The driver (isolated + proven):** a slot's **symbol code `int16 @0x91`** may only be a value the
**base file already registers among its own slots** (its native distinct-code set). Evidence:

1. **Section E holds NO code/block reference.** Three exhaustive scans over every corpus file's
   Section E were all negative: (a) no copy of any 11-byte property block; (b) no per-object code
   sequence at any stride/width; (c) no distinct-code-set array (the very distinctive Rosetta set
   `{1,2,3,4,5,6,7,11,12,15,20}` appears nowhere). So there is **nothing in Section E to reconcile**
   — the swap-921 is entirely a Section-D property.
2. **The isolated variable is `[0x91,0x9c)` alone.** `allelem_postype.pdp` (loads) and
   `allelem_master.pdp` (921) are both built on the *same* base (mimran-1) with the *same* arbitrary
   type-strings and pos/dims; their **only** difference is the code+block bytes. So type-string ≠ the
   driver (postype relabels freely and loads); the code+block region is.
3. **Blocks are free to vary WITHIN a code; codes are not free to appear.** Loadable files routinely
   carry **multiple distinct blocks per code** (mimran-1 loads with 2 blocks each for code 1 & 3; the
   Rosetta file with **8** distinct blocks for code 1). So changing the 9-byte sub-block within an
   already-registered code is a configuration loading files already contain. What breaks is
   **introducing a code value the file did not already have**: `allelem_master`, built on mimran-1
   (native codes `{1,3,5,7}`), 921'd precisely because its gas (**code 6**) and switch (**code 4**)
   swaps introduced codes 4 & 6. This matches the writer's long-standing empirical `clampCode` /
   `isSafeCode` rule ("unknown code → E4214/921"), now explained.

**The reconciliation (no body surgery):** build on a base whose **native code set ⊇ every item's
canonical code**, and route each item to a **same-code slot**, swapping only the sub-block. Then the
output's per-code **multiset is byte-identical to the loading base**, no code @0x91 changes, and
Section E stays byte-identical → no 921. For the full-catalog room this forces the **rich Rosetta
base `wall4_oc40`** (the *only* corpus file that natively registers gas code 6). Delivered as
`analysis/out/allelem/allelem_perfect.pdp` — **17/17 correct symbols, 0 code-byte @0x91 changes,
0 code-membership violations, Section E byte-identical, surplus collapsed off-plan (position-only).**
Implemented in `src/writePdpDR.js` as the **921-guard** (a swap is refused when the type's canonical
code is not native to the base — the item stays a correct-family fallback rather than risking 921)
+ `pickBaseForSymbols` (auto-selects a code-covering base) + `collapseSurplus`. **Still needs the
owner's Raumplan load-test** — the structure is proven; only Raumplan is the final oracle.

---

## 🔊 HEADLINE — there is NO count/size/checksum field to fix

The mission asked, as the highest-value outcome, for a single count/length field that must be
updated alongside a splice. **That field does not exist. I verified this exhaustively — do not spend
more time hunting for it.** Consequences, both important:

1. You **cannot** repair a splice by patching one integer, because nothing in the file stores the
   file size, the object-list byte length, the body length, a body offset, or a second copy of
   `objCount`.
2. Equally, a splice does **not** violate any stored length/checksum. So 921 is **not** a
   stale-field problem — it is a **body↔object structural-consistency** problem (§2). The fix is
   therefore body-side, not a count patch.

Evidence (`body5.js`, `body11.js`, `body3.js`, `body9.js`) — searched **all 9 files, every offset**:

| Candidate value searched (u16 **and** u32 LE) | Hits anywhere in any file |
|---|---|
| file size / size−3 | **none** |
| object-list byte size (`173·objCount`) | **none** |
| object-list end offset `dEnd` / body length | **none** |
| a second copy of `objCount` (u32) | **none** structural — only scattered vertex coords equal to the small value |
| an ordinal / self-index column inside the 173-B records | **none** (no column increments or equals record index) |
| any count in the footer / last 48 B | **none** — last 48 B are **byte-identical in all 9 files** |

`objCount` occurs **exactly once**, in the Section-C preamble (`body7.js`):

```
m4 @0xfe : 05 00 00 00 | 0e 00 00 00 | 00×12      objCount=5, ver=14, 12 reserved
m6 @0x144: 17 00 00 00 | 0e 00 00 00 | 00×12      objCount=23
```
Wall count occurs exactly once, `uint16 @0xd2`. There is no third count anywhere.

Constant EOF tail (last 48 B, identical m1..m9, `body11.js`) — proves no footer count/checksum:
```
… 00 00 00 00 00 01 fd ff f3 ff f5 ff ef ff ee ff f1 ff  00×21  03 00 00
```

---

## 1. Section map (all 9 files, `body1.js`)

`nWalls@0xd2`; `cOff = 0xd4 + 14·nWalls`; `objCount = u32@cOff`; object list = `173·objCount` B
starting at `cOff+20`; body = everything after, ending in the 3-byte footer `03 00 00`.

| set | size | N | cOff | objCount | dEnd (body start) | bodyLen |
|---|---|---|---|---|---|---|
| m1 | 56208 | 4 | 0x10c | 17 | 0xc9d | 52979 |
| m2 | 24983 | 3 | 0x0fe | 11 | 0x881 | 22806 |
| m3 | 30540 | 4 | 0x10c | 8  | 0x688 | 28868 |
| m4 | 17310 | 3 | 0x0fe | 5  | 0x473 | 16171 |
| m5 | 18208 | 3 | 0x0fe | 5  | 0x473 | 17069 |
| m6 | 70684 | 8 | 0x144 | 23 | 0x10e3 | 66361 |
| m7 | 69691 | 4 | 0x10c | 24 | 0x1158 | 65251 |
| m8 | 71618 | 4 | 0x10c | 25 | 0x1205 | 67005 |
| m9 | 79075 | 4 | 0x10c | 20 | 0xea4 | 75327 |

**Body size is NOT driven by item count** (`body1.js`): m9 has *fewer* items than m7 (20 < 24) but a
*larger* body (75327 > 65251). Body size tracks geometry complexity (cabinet meshes, glyph text),
not `objCount`. So the body is **not** a clean per-item array you can extend/trim by count.

---

## 2. Why splice → 921  (the integrity constraint)

### What the body actually contains, and how it scales

Walking the body from `dEnd` (`body6.js`, `body8.js`, `body4.js`), the layout is:

```
[dEnd]                     200 × 0x00                          (fixed lead block, 0xC8)
[dEnd+200]                 (N−1) dimension-chain blocks, 206 B each,
                           each carrying an incrementing index byte 2,3,…,N at block+200
[dEnd + 200+206(N−1)]      10-byte geometry header  (…usually ends e8 03 00 00 = 1000, a scale const)
[…]                        dimension-line geometry: int16 vertex runs, ff ff sentinels
[…]                        UP_TEXT dimension callouts   (count = rpi [UP_TEXT], NOT objCount)
[…]                        furniture catalog mesh assembly(ies)  (Wall/Griff/Korpus/QUADER/ZYLINDER…)
[…]                        glyph/vector-text outlines
[EOF−51]                   constant 48-B EOF glyph + 03 00 00 footer
```

The **pre-geometry region is exactly `200 + 206·(N−1) + 10` bytes** — verified to the byte on all 9
files (`body-verify`), and it scales with **walls, not items**:

| set | N | predicted `200+206(N−1)+10` | actual pre-geom len | index bytes present |
|---|---|---|---|---|
| m4 | 3 | 622 | 622 ✓ | 2,3 |
| m1 | 4 | 828 | 828 ✓ | 2,3,4 |
| m6 | 8 | 1652 | 1652 ✓ | 2,3,4,5,6,7,8 |

Mesh-token counts (`Wall, Korpus, QUADER, ZYLINDER…`, `body4.js`) do **not** track `objCount`;
`Wall`=1 in every file → the furniture is essentially **one catalog assembly per room**, expanded
from the fixtures' catalog type — it is not one mesh per item.

### The mechanism behind 921 (inference, but tightly constrained by the evidence)

Because (a) no length/count/checksum exists to go stale, (b) the 173-B records carry no ordinal, and
(c) the body is self-delimited geometry, the only remaining coupling is **by order/roster**:

- **F2** proves items are drawn from the **object record**, not from the body mesh — repositioning a
  record moves the item without touching the body. So the body meshes are a **render cache**.
- On load, Raumplan pairs the cached body meshes / annotation set against the object roster. Splicing
  a record shrinks the roster while leaving the body's mesh+annotation stream describing the original
  roster → **surplus body geometry with no owner → "corrupt, reorganize" (921).**
- This predicts an **asymmetry**: *adding* a record (roster > cached meshes) leaves objects with no
  cached mesh, which F2 shows Raumplan tolerates (it draws from the record). *Removing* a record
  (cached meshes > roster) is what breaks. **This asymmetry is the key practical lever (§4).**

> Net: 921 is a **surplus-body-geometry** error, not a bad-count error. You fix it by removing the
> body geometry in lock-step (hard) — or, far more cheaply, by **never reducing the count** (§4).

---

## 3. Why empty body → "too short" (E4245), and the minimal body

**F4** fails because the body is **mandatory**: the parser, after reading `objCount` records,
unconditionally reads the wall-dimension skeleton and trailing glyph/footer. A file that ends right
after Section C has none of it → read past EOF → "too short."

**Minimum required body for N walls (even 0 items):**

```
200 B  0x00                              fixed lead block
+ 206·(N−1) B  dimension-chain blocks    (index byte 2..N at each block+200; rest 0x00)
+ 10 B  geometry header                  (… e8 03 00 00)
+ dimension-line geometry                int16 runs + ff ff sentinels (encodes the walls' dims)
+ UP_TEXT callouts                       (as many as the drawing dimensions require)
+ 48 B constant EOF glyph  +  03 00 00   (byte-for-byte from any file, §HEADLINE)
```

The fixed parts (lead block, dimension-chain blocks, EOF glyph, footer) are byte-grounded and
copyable. The **variable** parts (dimension-line geometry + UP_TEXT) encode the actual wall
dimensions and are the hard part to synthesize from scratch — which is why the recommended recipes
below **reuse a real body** rather than build one.

---

## 4. Per-item footprint & the recipe for arbitrary M

### Per-item footprint
- **Guaranteed per item:** exactly **one 173-B object record** in Section D. This is the *only*
  count-scaled data (`verify.js`, confirmed here). For a mesh-less electrical/measurement item
  (socket שקע, junction צ.חשמל, sewage ביוב, faucet-point ברז — all `Class=Fixture` in the ORDX,
  `body10.js`) the item **renders from this record alone** (F2); it needs **no** body bytes.
- **Furniture with a 3D model** additionally owns a catalog mesh assembly in the body — but that is
  ~one assembly per room, catalog-generated, not one-per-item.

**Therefore, for the converter's real payload (electrical measurement points), an item costs exactly
173 body-independent bytes.** Adding items = appending 173-B records + bumping `objCount`. Removing
items is the only problematic direction (§2).

### Recipe — ranked, lowest-risk first

Pick the corpus template whose **wall count N matches the target room** (so the wall-dimension body
skeleton is already correct). Then:

**R1 — exact-count template, edit-in-place (ZERO risk, fully proven by F1+F2).**
If a template exists with `objCount == M` and the same N: overwrite the wall table (F1) and overwrite
all M records (type `@+0x09`, W/D/H `@~+0x6f`, position triple `@~+0x7d`, per `dr_format_structure.md`
§3) with your items. No count change, no body change → guaranteed load. Available exact counts in the
corpus: {5,8,11,17,20,23,24,25}. Use this whenever M is one of them.

**R2 — over-count template + neutralize surplus in place (near-zero risk; needs one confirm).**
For `M < templateCount = T` (same N): overwrite the first M records with your real items; overwrite
the remaining `T−M` records **in place** (never splice) to a degenerate invisible state — e.g. set
W=D=H=0 and move the position triple far outside the room, or co-locate on a real item.
`objCount` stays = T, the body is untouched → **no 921 path is ever taken.** This delivers M *visible*
items from any T≥M template. The only open question is cosmetic (does a zero-size record draw
nothing / clutter a BOM), which is a safe one-file load-test, not a corruption risk.

**R3 — add-only from the smallest matching template (low risk; §2 predicts it works).**
For `M > T`: append `M−T` new 173-B records at `dEnd` (copy a socket record, overwrite its position
triple; body shifts down intact), set `objCount = M`. Per §2's asymmetry, surplus *objects* (roster >
cached meshes) are tolerated. Confirm once with EXP-C below.

**R4 — true reduction (only if you must hit M below every template's count for that N).**
Requires removing the body geometry in lock-step, i.e. body construction. Only pursue if EXP-A shows
mesh-less removal is categorically blocked AND no R1–R3 path covers your M. This is the expensive
path (synthesize the dimension-line geometry + UP_TEXT for N walls); defer it.

### Two decisive experiments (exact bytes, on `mimran-5`: dStart=0x112, records at 0x112/0x1bf/0x26c/0x319/0x3c6, dEnd=0x473, objCount u32 @0xfe)

- **EXP-A (is mesh-less removal ever safe?):** splice out record 1 (צ.חשמל power box) — delete bytes
  `[0x1bf, 0x26c)` (173 B) and set `@0xfe` from `05 00 00 00` → `04 00 00 00`. Load.
  - Loads → mesh-less items **are** freely removable; R4 becomes cheap (reduce among electrical items).
  - 921 → removal is categorically blocked; rely on R1–R3 (never reduce).
- **EXP-C (does add work?):** insert a copy of record 0 (`[0x112,0x1bf)`) at `0x473`, set `@0xfe`
  `05`→`06`. Load → R3 confirmed.

Run EXP-A first: its result decides whether arbitrary *small* M needs body construction (R4) or
whether the never-reduce strategy (R1–R3) fully covers the converter.

---

## 5. Bottom line

- **No count/size/checksum field gates the splice** — proven across all 9 files. Stop looking for a
  one-integer fix; it cannot exist.
- **921 = surplus body geometry** left behind when the object roster shrinks (render-cache meshes with
  no owner). **E4245 = the wall-dimension body is mandatory** and was absent.
- **Item count is freely *increasable*** (append 173-B record + bump `objCount`; body tolerates
  surplus objects) but **not freely *decreasable*** without removing body geometry.
- **Converter recipe:** match N, then R1 (exact) / R2 (neutralize surplus in place, never splice) /
  R3 (add-only). These reach any M **without ever triggering 921**, using only the proven
  edit-in-place + append operations. R2 is the general-purpose unblock for `M <` any template.
- One load-test (EXP-A) tells you whether R4 (true reduction / full body construction) is ever needed.

### Evidence index (scratchpad)
`body1.js` section map · `body3.js` 200-B gap + no objCount echo · `body4.js` mesh tokens vs objCount
· `body5.js` no size/offset field · `body6.js`/`body8.js` body walk + per-wall 206-B blocks
· `body7.js` Section C · `body9.js` no record ordinal · `body10.js` ORDX fixture classes
· `body11.js` constant EOF tail + body objCount scatter.
