# SOLINE.ctb — Authoritative Specification

**Color-Dependent Plot Style Table for Soline architectural / kitchen drawings**
Convention: Israeli architect practice ("draw by color, plot by pen") + ISO 128-23 (construction) line-width series.
Status: **real, validated binary `.ctb`** generated in pure Node (built-in `zlib`).
Coverage: **full ACI 1–255** (every color pinned or defaulted — no fall-through), with **screened poché + grey-ramp reference band**.
Market verdict: see `docs/CTB_MARKET_ASSESSMENT.md` (post-upgrade: professional office grade).

- Generator + self-validator: `converter/templates/ctb/build_soline_ctb.js`
- Work set (default): `converter/templates/ctb/SOLINE.ctb` — every color plots **black**
- Presentation variant: `converter/templates/ctb/SOLINE-Color.ctb` — object colors kept, same pens
- Machine-readable table: `converter/templates/ctb/SOLINE_ctb_table.csv`
- Install guide (carpenter/architect): `docs/CTB_INSTALL_GUIDE.md`

---

## 1. The pen table (authoritative)

The **discipline pins** below are authoritative (SOL-* layer → ACI → ISO weight, per
`docs/DXF_PRO_STANDARDS.md`). **Every other ACI resolves to the 0.25 mm default**, so the
table gives **full 1–255 coverage** — no color falls back to "use object lineweight." This
is the professional-office behaviour: any drawing, including consultant XREFs, imported
blocks, or legacy DXFs with no embedded group-370 width, plots at a predictable weight. (For
Soline's own DXF — which uses only the pinned colors — the 0.25 default only ever affects
foreign content.)

| ACI | Color | Soline layer | Role | Pen (mm) | Screen | Tier |
|----:|-------|--------------|------|:--------:|:------:|------|
| **255** | white/black | (section / border) | Section-cut lines, sheet border | **0.70** | 100% | Heaviest |
| **7** | white/black | `SOL-KIROT` | Walls — cut outline | **0.50** | 100% | Heavy |
| **9** | grey | `SOL-MIVNE` | Structure / columns | **0.35** | 100% | Medium-heavy |
| **5** | blue | `SOL-PTACHIM` | Openings — doors & windows | 0.25 | 100% | Medium |
| **6** | magenta | `SOL-CHASHMAL` | Electrical | 0.25 | 100% | Medium |
| **4** | cyan | `SOL-INSTALATSIA` | Plumbing / water | 0.25 | 100% | Medium |
| **2** | yellow | `SOL-GAZ` | Gas | 0.25 | 100% | Medium |
| **141** | blue-grey | `SOL-MIZUG` | HVAC / ventilation | 0.25 | 100% | Medium |
| **30** | orange | `SOL-TEURA` | Lighting | 0.25 | 100% | Medium |
| **42** | tan | `SOL-RIHUT` | Furniture / cabinetry | 0.25 | 100% | Medium |
| **150** | turquoise | `SOL-TEKST` | Text / notes / labels | 0.18 | 100% | Light |
| **250** | grey | `SOL-MISGERET` | Title-block fine rules | 0.18 | 100% | Light |
| **1** | red | `SOL-MIDOT-CHUTS` | Outer / overall dimensions | 0.13 | 100% | Thin |
| **3** | green | `SOL-MIDOT-PNIM` | Inner / clear dimensions | 0.13 | 100% | Thin |
| **251** | grey | `SOL-RITZPA` | Floor slab / tiling | 0.13 | 100% | Thin |
| **8** | dark grey | `SOL-KIROT-MILUY` | Wall poché / hatch fill | 0.13 | **50%** | Screened tone |
| **252** | grey ramp | (reference) | Light construction / setting-out | 0.13 | **50%** | Screened |
| **253** | grey ramp | (reference) | Screened background / underlay | 0.13 | **40%** | Screened |
| **254** | grey ramp | (reference) | Faint XREF / trace underlay | 0.13 | **25%** | Screened |
| all others (236 colors) | — | — | **Default medium pen** | **0.25** | 100% | Default |

Emitted width histogram (both variants, verified by re-parse):
`0.13 ×7 · 0.18 ×2 · 0.25 ×243 · 0.35 ×1 · 0.50 ×1 · 0.70 ×1` = **255 pens, 0 at object-lineweight**.
The full ISO-128 width ladder is present; all six professional widths used:
**0.13 · 0.18 · 0.25 · 0.35 · 0.50 · 0.70 mm** (0.80–1.40 also available in the table for
heavier A0 borders if ever needed).

### Screening (poché & reference band)

Screening is independent of plot color: `screen=50` with a black plot color yields a **50%
grey halftone** on paper. Poché (cut-fill) must read as *tone*, never as solid-black
linework, so it is screened; and the light end of the ACI grey ramp (252–254) is reserved as
the office "screened reference" band (light construction lines, background, XREF underlay).
Screening is applied **identically in both variants** — a screened poché reads correctly on
a black shop print and on a color presentation alike. (Sources: Land F/X poché 40%; BIMuk
grey pens 250–255 @ 50%; Ching, *Architectural Graphics* — poché as grey tone.)

### Tier rationale (from `docs/ctb-explained.html`, owner-approved Option A)

- **Walls 0.50** — the wall cut is the heaviest object on a plan; it makes the drawing "read".
- **Structure 0.35** — columns/beams sit just under walls.
- **Services / openings 0.25** — doors, windows, MEP symbols, furniture: the medium "object" tier.
- **Text / frames 0.18** — annotation weight; legible but never competing with geometry.
- **Dims / hatch / poché / tiling 0.13** — the thinnest tier; supporting information.
- **Section-cut / sheet border 0.70** — reserved heaviest, for section cut-lines and the outer sheet frame.

This is the same hierarchy embedded per-entity in the DXF (§2 of `docs/DXF_PRO_STANDARDS.md`);
the CTB reproduces it by color, for carpenters/print-shops who plot the classic CTB way.

---

## 2. Two variants

| File | `color=` | Result on paper | When to use |
|------|----------|-----------------|-------------|
| **`SOLINE.ctb`** (default) | RGB black `0,0,0` | **All lines black**, widths by the table above | Working drawings, cut-lists, the carpenter's shop print |
| **`SOLINE-Color.ctb`** | object color (`-1`) | Each line in its **screen color**, same widths | Client presentation, color review |

Both have **dithering OFF** (`color_policy=0`) so black lines stay crisp and colors stay true;
**screening 100%** everywhere **except** the poché + grey-ramp reference band (ACI 8, 252,
253, 254), which is screened to 50/50/40/25% so cut-fill and reference geometry read as tone.
Screening is the same in both variants.

---

## 3. Binary format (why this is a *real* .ctb, not a CSV)

A `.ctb` is a zlib-compressed text table wrapped in a fixed AutoCAD envelope. The layout,
verified against ezdxf's reference reader/writer (`ezdxf/addons/acadctb.py`), is:

```
offset  bytes  content
0       48     ASCII  "PIAFILEVERSION_2.0,CTBVER1,compress\r\npmzlibcodec"
48      4      uint32 LE  adler32(compressedBody)
52      4      uint32 LE  length of uncompressed body (incl. trailing NUL)
56      4      uint32 LE  length of compressedBody
60      ...    compressedBody  =  zlib.deflate( bodyText + "\x00" )
```

The load-bearing invariant is that ezdxf's reader does literally
`zlib.decompress(content[60:])` — i.e. it skips exactly the 48-byte header + 12-byte
meta and inflates the rest. Our writer reproduces that byte-for-byte.

**Body text** (LF line endings), block order fixed by ezdxf `write_content()`:

```
description="…            ← header
aci_table_available=TRUE
scale_factor=1.0
apply_factor=FALSE
custom_lineweight_display_units=0
aci_table{ 0="Color_1 … 254="Color_255 }
plot_style{ <255 style blocks> }
custom_lineweight_table{ 0=0.00 … 26=2.11 }
\x00
```

Format quirk: string values are written `key="value\n` — the opening `"` is a **type
marker**, there is **no closing quote**; the value ends at the newline.

Each of the 255 plot-style blocks (index `i` = ACI `i+1`):

```
 6{
  name="Color_7
  localized_name="Color_7
  description="
  color=-1040187392        ← RGB black; object color would be -1
  mode_color=-1040187392   ← only present when color != object color
  color_policy=0           ← dithering off, grayscale off
  physical_pen_number=0
  virtual_pen_number=0
  screen=100               ← 100% except poché/reference band (ACI 8=50, 252=50, 253=40, 254=25)
  linepattern_size=0.5
  linetype=31              ← object linetype
  adaptive_linetype=TRUE
  lineweight=13            ← INDEX into custom_lineweight_table (13 = 0.50 mm)
  fill_style=73            ← object fill
  end_style=4              ← object end
  join_style=5             ← object join
 }
```

Key encodings:
- **Color** is packed by ezdxf's `mode_color2int(r,g,b,type)`: `-(-((type<<24)|(r<<16)|(g<<8)|b) & 0xFFFFFFFF)`.
  Black with true-color type `0xC2` → **`-1040187392`**. Object color → **`-1`**.
- **`lineweight` is an index**, not a millimeter value: it points into `custom_lineweight_table`.
  Index 0 = 0.00 mm = "use object lineweight". We reuse AutoCAD's standard 27-entry
  fixed list, so 0.13→4, 0.18→6, 0.25→8, 0.35→10, 0.50→13, 0.70→17.

---

## 4. Self-validation (how we know it is valid)

`build_soline_ctb.js` re-opens each file it writes and, without trusting its own
in-memory state:

1. checks the 48-byte magic header and the three little-endian uint32 meta fields;
2. recomputes `adler32(compressedBody)` and compares to the stored checksum;
3. **decompresses `content[60:]` exactly as ezdxf's reader does** and checks the length + trailing NUL;
4. re-parses all 255 plot-style blocks and the lineweight table, asserting: every
   pinned ACI carries the expected pen index; every **unpinned** ACI carries the 0.25 mm
   default (full 1–255 coverage — **no block is left at index 0/object-lineweight**); every
   ACI carries the expected **screen %**; and the expected color (`black` for the work set,
   `-1` for the color variant, `mode_color` present only when black).

Result: **both files PASS all checks** — 19 pinned pens, 236 default-pen colors, 4 screened,
0 at object-lineweight. `SOLINE.ctb` ≈ 4.5 KB, `SOLINE-Color.ctb` ≈ 4.3 KB; compressed body
begins `0x78 0x9C` (standard zlib). Re-run any time:

```
node converter/templates/ctb/build_soline_ctb.js
```

---

## 5. Sources

**Israeli architect convention — "draw by color, plot by pen" (CTB, color→pen-width):**
- Standards Institution of Israel — SI 932 (ת"י 932) technical drawing, SI 162 (presentation), SI 189 (dimensioning), SI 130 (sheet sizes), SI 1226 (building drawings). https://www.sii.org.il/en/israelistandards
- Israel national CAD/BIM standard context (מכון התקנים / משהב"ש). https://www.calcalist.co.il/real_estate/articles/0,7340,L-3769597,00.html
- The purchased Israeli architect kitchen template this project mirrors is CTB-based for exactly this reason (see `docs/ctb-explained.html`).

**Full 1–255 coverage + screening (what makes a pro office table):**
- BIMuk office plot-style standard — colours 1–9 ISO pens, 10–255 matrix, greys 250–255 screened 50%. https://bimuk.co.uk/best-practise/plot-styles/
- Land F/X standard CTB — full 1–255, screened poché fills (e.g. 231 = 0.40 mm @ 40%). https://www.landfx.com/docs/cad-basics/plotting/2482-ctb.html
- AutoCAD ACI palette structure — 0–9 named / 10–249 systematic cube / 250–255 grey ramp. https://help.autodesk.com/view/ACDLT/2024/ENU/?guid=GUID-C163F875-E449-48B7-8CF4-F90DF935118C
- Plan graphics / poché as tone (Ching, *Architectural Graphics*, via CCC Architecture). http://www.cccarchitecture.org/pres

**ISO-128 line-width series (0.13/0.18/0.25/0.35/0.50/0.70/1.0/1.4 mm):**
- **ISO 128-23** — construction-drawing line types (the architecturally-correct part). https://cdn.standards.iteh.ai/samples/22292/a9f6396b7eb94397aa5e41513ebf09b1/ISO-128-23-1999.pdf
- ISO 128-24 / EN ISO 128-2 — the width ladder (ratio 1:√2; extra-wide:wide:narrow = 4:2:1). https://standards.iteh.ai/catalog/standards/cen/5bacf6e2-8f82-404b-bec1-56f741367e08/en-iso-128-2-2022

**.ctb binary format (reference implementation used to verify byte layout):**
- ezdxf — `src/ezdxf/addons/acadctb.py` (Manfred Moitzi): https://github.com/mozman/ezdxf/blob/master/src/ezdxf/addons/acadctb.py

**Soline-internal alignment:**
- `docs/DXF_PRO_STANDARDS.md` §1–§2 — SOL-layer → ACI → ISO-128 weight map (source of the discipline colors).
- `docs/ctb-explained.html` — owner-facing explanation and the Option-A decision.
