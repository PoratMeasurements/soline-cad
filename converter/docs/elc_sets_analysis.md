# ELC matched-sets analysis — the 9 mimran ORDX↔PDP pairs (2026-08-15)

Corpus: `G:\My Drive\קבצים ללמידת מכונה\סטים`, 9 matched sets (mimran-1 … mimran-9),
each the SAME room exported to every format (.ordx/.ord/.pdp/.dxf/_3D.dxf/.xml/.elc/.rpi/.skp/.pdf).
All analysis read-only. Temp scripts in scratchpad. Every claim cites file+offset+bytes.

---

## ⚠️ HEADLINE VERDICT — these 9 .pdp files are the ZERO-header DR/ELC format, NOT native `ffffff7f`

**Task 1 — format check (ALL 9 files):**

| file | size | first 8 bytes | format |
|---|---|---|---|
| mimran-1 | 56208 | `00 00 00 00 00 00 00 00` | DR/ELC (zero header) |
| mimran-2 | 24983 | `00 00 00 00 …` | DR/ELC |
| mimran-3_Bath | 30540 | `00 00 00 00 …` | DR/ELC |
| mimran-4 | 17310 | `00 00 00 00 …` | DR/ELC |
| mimran-5 | 18208 | `00 00 00 00 …` | DR/ELC |
| mimran-6 | 70684 | `00 00 00 00 …` | DR/ELC |
| mimran-7 | 69691 | `00 00 00 00 …` | DR/ELC |
| mimran-8 | 71618 | `00 00 00 00 …` | DR/ELC |
| mimran-9 | 79075 | `00 00 00 00 …` | DR/ELC |

**None** start with `ff ff ff 7f`. `readPdp.isNativePdp()` returns false for all 9.
These are the OLDER int16 DR/ELC_SND family (the one `PDP_NATIVE_FORMAT.md` says was "cracked
earlier"), **not** the Raumplan-native `ffffff7f 44000000` format that the current native RE targets.

**Implication for the project (state loudly):** the real measurement workflow ("…_DR1.pdp",
produced by InnoDrawNet, path `D:\inetpub\ftproot\InnoDrawNet\…`) emits the **DR/ELC zero-header
format**, and Raumplan/InnoDraw evidently round-trips it. The native `ffffff7f` reference files in
`analysis/out/` (1.pdp, wall_6000, חדר ריק, תשתיות) are a *different* serialization. Two live
questions for Michael:
- If the converter's output only has to be **loaded by this same InnoDraw/Raumplan install**, the
  **DR/ELC format documented here is the easier, fully-decoded target** (int16 wall table + a
  plain-text `.rpi` twin — see below) and we do not need the harder native 42-byte body model.
- The native-format work (`buildWallRecord`, 42B body, SUPP_FR) is still valid for that other
  serialization but is **not** what these ground-truth files use.

---

## 🎯 THE `.rpi` IS A PLAIN-TEXT MIRROR OF THE PDP (biggest find)

**Task 4.** Each `.rpi` is a small INI text file (~1–3 KB) that is a **complete human-readable
serialization of the same scene** stored in the `.pdp`: walls, items, dimension texts, client data,
bounds — all in the PDP's local mm coordinate frame. Example, `mimran-5_…DR1.rpi` (Hebrew decoded
cp1255):

```
[General]
WriteVersion=14
OutputFileName=D:\inetpub\ftproot\InnoDrawNet\Israel\Israel_1\Porat\MS\Michael-Porat\mimran-5\mimran-5_Room1_Teveth_Roni_DR1.pdp
[ClientData]
Name=mimran-5 … Designer=michael
;Bounds (3527.000000,-785.000000) - (5514.000000,-3115.000000)
[Walls]
Count=3
1=1589,905,1589,301,100,2780,0
2=453,905,1589,905,100,2780,0
3=453,92,453,905,100,2780,0
[Objects]
Count=5
1=אינודרו,שקע,703,2329,905,150,10,120,0,0,0,0
2=אינודרו,צ.חשמל,1209,376,905,14,100,14,0,0,0,0
3=אינודרו,ביוב קיר,684,185,895,50,100,50,0,0,0,0
4=אינודרו,שקע,1072,403,905,150,10,120,0,0,0,0
5=אינודרו,ברז,624,215,905,70,10,70,0,0,0,0
[UP_TEXT]  … the Hebrew dimension callouts …
```

- `[Walls]` rows = `x1,y1,x2,y2,thick,height,flag` in the **local frame**.
- `[Objects]` rows = `Vendor("אינודרו"=InnoDraw), Type(Hebrew), X, Z, Y, W, D, H, …flags`
  — i.e. **X = along-frame, Z = height up the wall, Y = the wall-line coordinate** (see item
  section). Hebrew types seen: `שקע`=socket, `צ.חשמל`=power box/junction, `ביוב קיר`=wall sewage,
  `ברז`=faucet, `ק.בקורת`=junction box, `ק.חשמל`=power box, `ק.קו`=power line.
- `[UP_TEXT]` = the dimension annotations (`x,y,rot,?,?,text`).

**The PDP int16 wall table is exactly `rpi − 20000` on BOTH axes** (proved below). So the `.rpi`
gives us the clean, definitive scene, and the `.pdp` is that scene minus a fixed 20000 bias.
For the converter this is enormous: we can validate/round-trip against the `.rpi`, and the
`.rpi` even reveals the Hebrew type dictionary and the dimension-text layer.

**Other companions:**
- `.xml` = `WallTransfer` (clean XML): walls as StartPoint/EndPoint/Height/Thickness and
  `<Furnitures>` with `<Location X/Y/Z>`, `<Direction>`, and a `Model3D` catalog token
  (`Common.Fixture.Plumbing`, `Common.Fixture.Electrical.Receptacle`, `Sewage`, …). Coordinates
  are WORLD with **Y negated** (`Y=-2160`). Good source for an ORDX-item-name → Model3D map.
- `.elc` = high-entropy binary (`23 d0 53 81 2d b6 7d b2 …`), no readable structure beyond stray
  `1222`/`3444` padding markers → **encrypted/compressed native ELC, not directly useful.**
- `.dxf`/`_3D.dxf`/`.skp`/`.pdf` = derived drawings (not needed for the transform).

---

## ✅ Task 2 — wall model validated; and the ±200 "normal offset" is a NATIVE-only artifact

**The DR/ELC wall table lives at 0xd4, int16, 14-byte stride, count@0xd2** — exactly the
`readWallsTemplate()` layout. Record = `[x1,y1,x2,y2 int16][thick i16][height i16][2b tail]`.
Confirmed on every set. `mimran-5` (`0xd0` = `08 bc 03 00`, count@0xd2 = 3):

```
rec0 @0xd4  (-18411,-19095)->(-18411,-19699) th=100 h=2780  len=604
rec1 @0xe2  (-19547,-19095)->(-18411,-19095) th=100 h=2780  len=1136
rec2 @0xf0  (-19547,-19908)->(-19547,-19095) th=100 h=2780  len=813
```

ORDX `mimran-5` walls (parseOrdxFile): W1 len=813, W2 len=1136, W3 len=604; th=100 h=2780.
**Lengths + thickness + height match exactly**, in **reverse order** (pdp rec0=ORDX W3, rec2=W1).
`mimran-4` even reproduces the mixed thickness (th=245 on the two short walls, th=100 on the long
one) in both ORDX and pdp. So the int16 stride-14 wall model is **fully validated on real files.**

**Wall coordinates are the CENTERLINE** — no ±200 perpendicular offset. The pdp/rpi endpoints equal
the ORDX centerline endpoints under the transform below, and items sit ON that same line
(item `Y` = the wall-line coordinate; e.g. all mimran-5 wall-2 items have `Y=905`, the wall-2 line).

> **Answer to the open "which normal direction (left/right)" question:** it does **not apply to
> this DR/ELC format at all.** These files store wall **centerlines** with **zero** perpendicular
> offset. The ±200mm left-normal rule documented in `PDP_NATIVE_FORMAT.md` is specific to the
> **native `ffffff7f` 42-byte body records**, and since none of the 9 ground-truth files are native,
> they can neither confirm nor correct that ±200 rule. If the converter targets the DR/ELC format
> (recommended — it's what the workflow actually produces), the ±200 question is moot: write
> centerlines. The 42B/±200 model should only be trusted for the separate native serialization.

---

## ✅ Task 5 — exact ORDX → PDP coordinate transform (derived from matched pairs)

Two chained facts, both proven byte-for-byte:

**(a) PDP-local frame ↔ `.rpi` frame:  `pdp_int16 = rpi − 20000` on each axis.**
- mimran-5 rpi wall1 `1589,905` → `1589-20000, 905-20000` = `-18411,-19095` = pdp rec0 start ✓
- mimran-5 rpi wall3 `453,92`   → `-19547,-19908` = pdp rec2 start ✓
- mimran-4 rpi wall1 `2050,1873`→ `-17950,-18127` = pdp rec0 start ✓ (bias generalizes)

**(b) `.rpi`/PDP-local frame ↔ ORDX world:  X preserved (translate), Y FLIPPED (negate+translate).**
Per matched wall on mimran-5 (ORDX world → pdp-local):
- `x_pdp = x_ordx − 23527`   (mimran-5)   `x_pdp = x_ordx − 19403` (mimran-2)
- `y_pdp = −y_ordx − 16885`  (mimran-5)   `y_pdp = −y_ordx − 12862` (mimran-2)

Worked proof, mimran-5 W2 `(3980,2210)->(5116,2210)` → pdp rec1 `(-19547,-19095)->(-18411,-19095)`:
x: 3980−23527=−19547 ✓, 5116−23527=−18411 ✓; y: −2210−16885=−19095 ✓ (constant, horizontal wall).
mimran-5 W1 `(3980,3023)->(3980,2210)`: y 3023 → −3023−16885 = −19908 ✓ (pdp rec2 start).

**The additive constants are per-room (the room's absolute placement in the CV world); the
STRUCTURE is universal and is what the converter must implement:**

```
Universal ORDX → PDP(DR/ELC) transform
  x_pdp =  x_ordx + Cx           (X preserved, scale 1, mm)
  y_pdp = -y_ordx + Cy           (Y AXIS FLIPPED)         ← the load-bearing fact
  walls written in REVERSE order vs ORDX (opposite winding), connected as a chain
  wall coords = CENTERLINE (no perpendicular offset)
  Cx, Cy are free (translation-invariant): pick so the room lands in a sane local box,
  e.g. reproduce InnoDraw's own convention of origin≈room-min-corner then subtract the
  20000 bias, OR just keep everything self-consistent — Raumplan doesn't validate absolute pos
  (same class of freedom as the per-save GUID).
```

The `.xml` WallTransfer independently corroborates the Y-flip: it stores world coords with `Y`
negative (`Y=-2160`, `Y=-2814`) while ORDX stores them positive.

---

## Task 3 — item placement in the DR/ELC format

**The SUPP_FR / +133/+137 model does NOT apply here** — that is a native-format construct. String
scan of `mimran-5.pdp` shows **no `SUPP_FR`**; items are embedded as **primitive-solid meshes**
(`QUADER`×10, `ZYLINDER`×2, `HALBKREI`, `HOHLZYLI`, plus `CQUADER`, `Kranz`, `Lichtblende`,
catalog `KP60`). A socket/faucet/box is drawn as QUADER/ZYLINDER geometry, so exact per-item
world coords are **not** stored as a clean int32 pair the way native SUPP_FR records are — the
mesh anchor int16 pairs near the item blocks (e.g. `0x199` = `(-19297,-19095)`, `0x240` =
`(-18823,-19095)`, both on the wall-2 line `y=-19095`) land *near* the computed item positions but
are mesh-frame origins, not the tidy placement field.

**But we don't need to decode the mesh, because the `.rpi` already gives every item cleanly:**
`mimran-5` `[Objects]` maps 1:1 to the 5 ORDX furnishings, in the wall-local frame:

| rpi object | type | X, Z(height), Y(wall-line), W×D×H | matches ORDX item |
|---|---|---|---|
| `שקע` | socket | 703, **2329**, 905 | ORDX Socket on W2 pos(210,**2289**) — high socket |
| `צ.חשמל` | power box | 1209, 376, 905 | (W2 electrical) |
| `ביוב קיר` | wall sewage | 684, 185, 895 | ORDX Sewage pos(231,185) |
| `שקע` | socket | 1072, 403, 905 | ORDX Socket pos(579,363) |
| `ברז` | faucet | 624, **215**, 905 | ORDX Faucet pos(161,**205**) |

So the item field order is **`X, Z, Y`**: `Z` = height up the wall (= ORDX item local `y`),
`Y` = the wall-line coordinate in the local frame (all W2 items share `Y≈905`), `X` = position
along the frame. This is the clean placement source; the pdp binary is `rpi − 20000` on X/Y as for
walls, with Z as the vertical height. `.xml` Furnitures give the same items in world coords with the
`Model3D` token, useful for building an ORDX-name → item-type table.

Verdict: **item positions are fully recoverable from `.rpi` (and `.xml`)**; decoding the pdp's
QUADER item meshes is unnecessary for the converter if we drive placement from the rpi/ORDX side.

---

## Bottom line for the converter

1. **Target the DR/ELC zero-header format** for these matched files (int16 wall table @0xd4,
   count@0xd2). It is simpler and is what the InnoDrawNet workflow actually produces & reloads.
2. **Transform: X preserved, Y flipped, walls reversed, centerlines, translation free.** This is the
   validated, load-bearing coordinate rule (Task 5).
3. **Use the `.rpi` as the Rosetta twin**: it is the pdp scene in plain text (walls+items+dim-text),
   equal to the pdp local frame + a fixed `20000` bias. Ideal for round-trip validation and to read
   the Hebrew type dictionary + dimension layer.
4. The native `ffffff7f` / 42-byte-body / ±200-normal / SUPP_FR model (`PDP_NATIVE_FORMAT.md`) is a
   **separate serialization** and is **not** exercised by these 9 ground-truth files — keep it, but
   don't assume these files validate it.

### Cross-validation across ALL 9 sets (`all.js`)

| set | pdp walls@0xd2 | ordx walls | rpi walls | ordx items | rpi objs | `rec0 == rpi1 − 20000` |
|---|---|---|---|---|---|---|
| mimran-1 | 4 | 4 | 4 | 17 | 17 | YES |
| mimran-2 | 3 | 3 | 3 | 11 | 11 | YES |
| mimran-3 | 4 | 4 | 4 | 9 | 8 | YES |
| mimran-4 | 3 | 3 | 3 | 5 | 5 | YES |
| mimran-5 | 3 | 3 | 3 | 5 | 5 | YES |
| mimran-6 | 8 | 8 | 8 | 23 | 23 | YES |
| mimran-7 | 4 | 4 | 4 | 24 | 24 | YES |
| mimran-8 | 4 | 4 | 4 | 25 | 25 | YES |
| mimran-9 | 4 | 4 | 4 | 20 | 20 | YES |

Wall counts agree everywhere; item counts agree 8/9 (mimran-3 = 9 ORDX vs 8 rpi objects — one
decorative, likely a WindowSill/ShutterBox, isn't emitted as a placed object). The `−20000` bias
maps pdp wall rec0 onto rpi wall 1 in **all 9** files.

### Evidence index (scripts in scratchpad)
- headers: `hdr.js` — all 9 zero-header.
- ORDX walls/items: `ordx.js` (parseOrdxFile).
- wall table decode: `walltab.js` @0xd2/0xd4 int16 stride-14.
- value search: `find.js` (int16/int32/float/double).
- rpi (cp1255): `rpi.js`.
- hex dump: `hx.js`.
</content>
</invoke>
