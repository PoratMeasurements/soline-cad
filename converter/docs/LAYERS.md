# Soline DXF Layer System — `SOL-*` taxonomy (v7)

**Authoritative contract** for the Soline layer scheme. This is the source other
features build on: the HTML superposition viewer (layer checkboxes), the A0–A4
layout sheets, and the smart layout-splitter all consume the **layer names** and
**toggle-groups** defined here. It is generated from and kept in lock-step with
`src/dxf_soline.js` (the single source of truth); both DXF exporters
(`src/export_dxf2d.js`, `src/export_dxf_pro.js`) assign every entity to one of
these layers.

> One-line summary: every layer has a **stable internal key** `SOL-<DISCIPLINE>-<KIND>`
> (used throughout the code and the `TOGGLE_GROUPS` globs) and an **emitted Hebrew
> name** written into the DXF (e.g. `SOL-CHASHMAL-DIM` → `חשמל-מידות`). Toggle
> `SOL-CHASHMAL-*` to isolate electrical; toggle every `*-DIM` to drop all
> dimensions; toggle `SOL-CHASHMAL-DIM` alone to hide just the electrical
> measurements while its symbols stay.

> **What AutoCAD shows (v11+):** the layer PANEL now displays **real Hebrew** layer
> names (the owner's request), matching how Israeli architects name layers (a flat-Hebrew,
> hyphen-grouped convention). The `SOL-*` token is kept only as the
> **internal key** the exporters and toggle-groups route on — it is translated to its
> Hebrew name at the single emission boundary (`layerOut()` in `src/dxf_soline.js`), so
> the LAYER table (group 2) and every entity (group 8) stay in lock-step automatically.
> Hebrew is emitted as **CP1255 bytes** (`heToCp1255`) under `$DWGCODEPAGE ansi_1255`;
> the file is written **`latin1`** (never `ascii`).
>
> **v13 — NO SPACES in a layer name (R12 fix):** DXF R12 (AC1009) does **not** allow a
> SPACE (nor `< > / \ " : ; ? * | , = \``) in a LAYER-table symbol name — AutoCAD
> silently discards a drawing whose LAYER table breaks this. The v11/v12 Hebrew names
> used a `" - "` (spaced) separator and so failed to open. v13 replaces every separator
> with a bare **hyphen** (`חשמל-מידות`, `מידות-פנים`, `גבול-גיליון`, `רשת-צירים`) and
> `sanitizeLayerName()` enforces the whole R12-illegal set + a 31-char cap on every
> emitted name. Both exporters' `selfTest` now fail if any LAYER name carries a space.
>
> **English fallback (`setLayerLang('en')`).** The known-good reference DXF proves the
> R12 format with **English underscore** layer names, not Hebrew — it does not prove
> Hebrew CP1255 bytes are valid inside an R12 symbol name. So a proven-safe English
> deliverable is available: `setLayerLang('en')` makes `layerOut()` emit `EN_LAYER`
> (`Walls`, `Electrical`, `Electrical_Dim`, `Walls_Fill`, `Dim_Inner` …) — pure 7-bit
> ASCII, guaranteed valid. Test the **Hebrew** v13 first; if AutoCAD still refuses it,
> ship the English `v13en` build. `getLayerLang()`/`setLayerLang()` default to `'he'`.

---

## 1. Naming convention

```
internal key:  SOL - <DISCIPLINE> - <KIND>
                     │               └─ content-kind (SYM/DIM/TXT/HAT/CEN/HID)
                     └───────────────── romanized-Hebrew discipline token (KIROT, CHASHMAL, …)

emitted name:  <discipline-Hebrew>[-<kind-Hebrew>]      (SYM = bare discipline name; NO spaces)
               e.g.  SOL-CHASHMAL-SYM → חשמל · SOL-CHASHMAL-DIM → חשמל-מידות
english alt:   <Discipline>[_<Kind>]  (setLayerLang('en'))  e.g. Electrical · Electrical_Dim
```

* **Internal key = ASCII `SOL-*` (stable).** The `SOL-<DISC>-<KIND>` token is the
  canonical key the exporters, `LAYER_SET`, `kindLayer()`, routing helpers, and the
  `TOGGLE_GROUPS` globs all use. It never appears in the DXF any more — it is the
  in-code handle only.
* **Emitted name = real Hebrew (v11+).** At the emission boundary `layerOut(key)` maps
  the key to a clean Hebrew name and encodes it as CP1255. The **SYM** (primary) layer
  of each discipline gets the **bare** discipline name (`קירות`, `חשמל`, `מים` …); the
  other kinds append `"-<kind>"` (a HYPHEN, **no space** — R12 rule) (`מידות`/`טקסט`/
  `מילוי`/`ציר`/`נסתר`) so all 71 layers stay **unique** and read as a Hebrew group per
  discipline.
* **Discipline Hebrew names** keep the long-standing Soline convention the owner asked
  for (KIROT=קירות, CHASHMAL=חשמל, …) — *not* the rejected ELCAD-derived names.
* Two **cross-discipline dimension layers** (`SOL-MIDOT-PNIM` → `מידות-פנים`,
  `SOL-MIDOT-CHUTS` → `מידות-חוץ`); **sheet furniture** uses `SOL-SHEET-*` keys.

### Kind → Hebrew suffix
| Kind | Hebrew suffix | Emitted example (electrical) |
|------|---------------|------------------------------|
| `SYM` | *(none — bare discipline name)* | `חשמל` |
| `DIM` | `מידות` | `חשמל-מידות` |
| `TXT` | `טקסט` | `חשמל-טקסט` |
| `HAT` | `מילוי` | `קירות-מילוי` |
| `CEN` | `ציר` | `מים-ציר` |
| `HID` | `נסתר` | `חשמל-נסתר` |

### Content-kind codes (`<KIND>`)

| Code  | Meaning | Linetype | Weight | Isolates… |
|-------|---------|----------|--------|-----------|
| `SYM` | Element / symbol / body geometry | CONTINUOUS | discipline weight | the drawn objects |
| `DIM` | Dimension chains (ext + dim lines, arrows, value TEXT) | CONTINUOUS | 0.13 | the measurements |
| `TXT` | Annotation / labels / marks (D#, W#, tags, notes) | CONTINUOUS | 0.18 | the text |
| `HAT` | Hatch / poché fill (SOLID) | CONTINUOUS | 0.13 | the fills |
| `CEN` | Centrelines | CENTER | 0.13 | the centrelines |
| `HID` | Hidden / behind-cut edges (concealed door, pocket, track) | HIDDEN | 0.18 | the hidden lines |

A discipline only declares the kinds it can carry (electrical has no centreline;
a floor slab is just body + tiling). Routing a kind a discipline does not declare
falls back to that discipline's `-SYM` layer.

---

## 2. Disciplines

| Token | Hebrew | ACI color | SYM weight | Split from v6 |
|-------|--------|:---------:|:----------:|---------------|
| `KIROT`    | קירות (walls)          | 7 white/blk | 0.50 | — |
| `MIVNE`    | מבנה (structure)       | 9 grey      | 0.35 | — |
| `CHASHMAL` | חשמל (electrical+data) | 6 magenta   | 0.25 | — |
| `TEURA`    | תאורה (lighting)       | 30 orange   | 0.25 | — |
| `MAYIM`    | מים (water supply)     | 4 cyan      | 0.25 | ← plumbing |
| `NIKUZ`    | ניקוז (drainage/waste) | 140 blue    | 0.25 | ← plumbing |
| `GAZ`      | גז (gas)               | 2 yellow    | 0.25 | — |
| `MIZUG`    | מיזוג (HVAC / AC)      | 141 blue-grey | 0.25 | ← hvac |
| `IVRUR`    | אוורור (ventilation)   | 131 lt-blue-grey | 0.25 | ← hvac |
| `DELET`    | דלתות (doors)          | 5 blue      | 0.25 | ← openings |
| `CHALON`   | חלונות (windows)       | 151 lt-blue | 0.25 | ← openings |
| `RIHUT`    | ריהוט (furniture)      | 42 tan      | 0.25 | — |
| `MITBACH`  | מטבח (kitchen cabinetry) | 52 olive  | 0.25 | ← furniture |
| `RITZPA`   | רצפה (floor slab)      | 251 grey    | 0.13 | — |

**Colour policy.** Every KIND of a discipline shares the **one discipline ACI
colour** — the KIND is expressed by the layer *name* and its embedded group-370
*lineweight*, never by colour. This keeps the CTB agent's `color → pen` table
(`templates/ctb/`) consistent: a colour still maps 1:1 to a pen. See §5.

---

## 3. Full layer table (71 layers)

`weight` = embedded DXF group-370 value (mm). `pen` = the plotted weight the
current Soline CTB assigns to that colour (`obj` = colour not pinned in the CTB, so
it falls through to *use object lineweight* = the embedded group-370 weight, which
is correct).

### 3.0 Internal key ↔ emitted Hebrew name (the full 71)

This is the authoritative mapping (generated by `layerOut()` from `HE_LAYER` in
`src/dxf_soline.js`). The **key** is what the code/toggle-groups use; the **Hebrew
name** is what AutoCAD shows.

| Internal key | Hebrew (emitted) | Internal key | Hebrew (emitted) |
|--------------|------------------|--------------|------------------|
| `0` | `0` | `SOL-GAZ-SYM` | `גז` |
| `SOL-KIROT-SYM` | `קירות` | `SOL-GAZ-DIM` | `גז-מידות` |
| `SOL-KIROT-HAT` | `קירות-מילוי` | `SOL-GAZ-TXT` | `גז-טקסט` |
| `SOL-KIROT-DIM` | `קירות-מידות` | `SOL-GAZ-HID` | `גז-נסתר` |
| `SOL-KIROT-TXT` | `קירות-טקסט` | `SOL-GAZ-CEN` | `גז-ציר` |
| `SOL-KIROT-HID` | `קירות-נסתר` | `SOL-MIZUG-SYM` | `מיזוג` |
| `SOL-KIROT-CEN` | `קירות-ציר` | `SOL-MIZUG-DIM` | `מיזוג-מידות` |
| `SOL-MIVNE-SYM` | `מבנה` | `SOL-MIZUG-TXT` | `מיזוג-טקסט` |
| `SOL-MIVNE-HAT` | `מבנה-מילוי` | `SOL-MIZUG-HID` | `מיזוג-נסתר` |
| `SOL-MIVNE-DIM` | `מבנה-מידות` | `SOL-IVRUR-SYM` | `אוורור` |
| `SOL-MIVNE-TXT` | `מבנה-טקסט` | `SOL-IVRUR-DIM` | `אוורור-מידות` |
| `SOL-MIVNE-HID` | `מבנה-נסתר` | `SOL-IVRUR-TXT` | `אוורור-טקסט` |
| `SOL-MIVNE-CEN` | `מבנה-ציר` | `SOL-IVRUR-HID` | `אוורור-נסתר` |
| `SOL-CHASHMAL-SYM` | `חשמל` | `SOL-DELET-SYM` | `דלתות` |
| `SOL-CHASHMAL-DIM` | `חשמל-מידות` | `SOL-DELET-DIM` | `דלתות-מידות` |
| `SOL-CHASHMAL-TXT` | `חשמל-טקסט` | `SOL-DELET-TXT` | `דלתות-טקסט` |
| `SOL-CHASHMAL-HID` | `חשמל-נסתר` | `SOL-DELET-HID` | `דלתות-נסתר` |
| `SOL-TEURA-SYM` | `תאורה` | `SOL-DELET-HAT` | `דלתות-מילוי` |
| `SOL-TEURA-DIM` | `תאורה-מידות` | `SOL-CHALON-SYM` | `חלונות` |
| `SOL-TEURA-TXT` | `תאורה-טקסט` | `SOL-CHALON-DIM` | `חלונות-מידות` |
| `SOL-TEURA-HID` | `תאורה-נסתר` | `SOL-CHALON-TXT` | `חלונות-טקסט` |
| `SOL-MAYIM-SYM` | `מים` | `SOL-CHALON-HID` | `חלונות-נסתר` |
| `SOL-MAYIM-DIM` | `מים-מידות` | `SOL-RIHUT-SYM` | `ריהוט` |
| `SOL-MAYIM-TXT` | `מים-טקסט` | `SOL-RIHUT-DIM` | `ריהוט-מידות` |
| `SOL-MAYIM-HID` | `מים-נסתר` | `SOL-RIHUT-TXT` | `ריהוט-טקסט` |
| `SOL-MAYIM-CEN` | `מים-ציר` | `SOL-RIHUT-HID` | `ריהוט-נסתר` |
| `SOL-NIKUZ-SYM` | `ניקוז` | `SOL-MITBACH-SYM` | `מטבח` |
| `SOL-NIKUZ-DIM` | `ניקוז-מידות` | `SOL-MITBACH-DIM` | `מטבח-מידות` |
| `SOL-NIKUZ-TXT` | `ניקוז-טקסט` | `SOL-MITBACH-TXT` | `מטבח-טקסט` |
| `SOL-NIKUZ-HID` | `ניקוז-נסתר` | `SOL-MITBACH-HID` | `מטבח-נסתר` |
| `SOL-NIKUZ-CEN` | `ניקוז-ציר` | `SOL-RITZPA-SYM` | `ריצוף` |
| | | `SOL-RITZPA-HAT` | `ריצוף-מילוי` |

**Cross-discipline dims + sheet furniture**

| Internal key | Hebrew (emitted) |
|--------------|------------------|
| `SOL-MIDOT-PNIM` | `מידות-פנים` |
| `SOL-MIDOT-CHUTS` | `מידות-חוץ` |
| `SOL-SHEET-FRAME` | `מסגרת` |
| `SOL-SHEET-BORDER` | `גבול-גיליון` |
| `SOL-SHEET-LEGEND` | `מקרא` |
| `SOL-SHEET-GRID` | `רשת-צירים` |
| `SOL-SHEET-NOTES` | `הערות` |
| `SOL-SHEET-REV` | `מהדורות` |

### Walls — `SOL-KIROT-*`
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-KIROT-SYM` | 7 | CONTINUOUS | 0.50 | 0.50 |
| `SOL-KIROT-HAT` | 8 | CONTINUOUS | 0.13 | 0.13 |
| `SOL-KIROT-DIM` | 7 | CONTINUOUS | 0.13 | 0.50 |
| `SOL-KIROT-TXT` | 7 | CONTINUOUS | 0.18 | 0.50 |
| `SOL-KIROT-HID` | 7 | HIDDEN | 0.18 | 0.50 |
| `SOL-KIROT-CEN` | 7 | CENTER | 0.13 | 0.50 |

### Structure — `SOL-MIVNE-*`
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-MIVNE-SYM` | 9 | CONTINUOUS | 0.35 | 0.35 |
| `SOL-MIVNE-HAT` | 9 | CONTINUOUS | 0.13 | 0.35 |
| `SOL-MIVNE-DIM` | 9 | CONTINUOUS | 0.13 | 0.35 |
| `SOL-MIVNE-TXT` | 9 | CONTINUOUS | 0.18 | 0.35 |
| `SOL-MIVNE-HID` | 9 | HIDDEN | 0.18 | 0.35 |
| `SOL-MIVNE-CEN` | 9 | CENTER | 0.13 | 0.35 |

### Electrical — `SOL-CHASHMAL-*` (includes data/comms/smart/safety)
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-CHASHMAL-SYM` | 6 | CONTINUOUS | 0.25 | 0.25 |
| `SOL-CHASHMAL-DIM` | 6 | CONTINUOUS | 0.13 | 0.25 |
| `SOL-CHASHMAL-TXT` | 6 | CONTINUOUS | 0.18 | 0.25 |
| `SOL-CHASHMAL-HID` | 6 | HIDDEN | 0.18 | 0.25 |

### Lighting — `SOL-TEURA-*`
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-TEURA-SYM` | 30 | CONTINUOUS | 0.25 | 0.25 |
| `SOL-TEURA-DIM` | 30 | CONTINUOUS | 0.13 | 0.25 |
| `SOL-TEURA-TXT` | 30 | CONTINUOUS | 0.18 | 0.25 |
| `SOL-TEURA-HID` | 30 | HIDDEN | 0.18 | 0.25 |

### Water supply — `SOL-MAYIM-*`
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-MAYIM-SYM` | 4 | CONTINUOUS | 0.25 | 0.25 |
| `SOL-MAYIM-DIM` | 4 | CONTINUOUS | 0.13 | 0.25 |
| `SOL-MAYIM-TXT` | 4 | CONTINUOUS | 0.18 | 0.25 |
| `SOL-MAYIM-HID` | 4 | HIDDEN | 0.18 | 0.25 |
| `SOL-MAYIM-CEN` | 4 | CENTER | 0.13 | 0.25 |

### Drainage / waste — `SOL-NIKUZ-*`
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-NIKUZ-SYM` | 140 | CONTINUOUS | 0.25 | obj |
| `SOL-NIKUZ-DIM` | 140 | CONTINUOUS | 0.13 | obj |
| `SOL-NIKUZ-TXT` | 140 | CONTINUOUS | 0.18 | obj |
| `SOL-NIKUZ-HID` | 140 | HIDDEN | 0.18 | obj |
| `SOL-NIKUZ-CEN` | 140 | CENTER | 0.13 | obj |

### Gas — `SOL-GAZ-*`
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-GAZ-SYM` | 2 | CONTINUOUS | 0.25 | 0.25 |
| `SOL-GAZ-DIM` | 2 | CONTINUOUS | 0.13 | 0.25 |
| `SOL-GAZ-TXT` | 2 | CONTINUOUS | 0.18 | 0.25 |
| `SOL-GAZ-HID` | 2 | HIDDEN | 0.18 | 0.25 |
| `SOL-GAZ-CEN` | 2 | CENTER | 0.13 | 0.25 |

### HVAC / air-conditioning — `SOL-MIZUG-*`
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-MIZUG-SYM` | 141 | CONTINUOUS | 0.25 | 0.25 |
| `SOL-MIZUG-DIM` | 141 | CONTINUOUS | 0.13 | 0.25 |
| `SOL-MIZUG-TXT` | 141 | CONTINUOUS | 0.18 | 0.25 |
| `SOL-MIZUG-HID` | 141 | HIDDEN | 0.18 | 0.25 |

### Ventilation / exhaust — `SOL-IVRUR-*`
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-IVRUR-SYM` | 131 | CONTINUOUS | 0.25 | obj |
| `SOL-IVRUR-DIM` | 131 | CONTINUOUS | 0.13 | obj |
| `SOL-IVRUR-TXT` | 131 | CONTINUOUS | 0.18 | obj |
| `SOL-IVRUR-HID` | 131 | HIDDEN | 0.18 | obj |

### Doors — `SOL-DELET-*`
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-DELET-SYM` | 5 | CONTINUOUS | 0.25 | 0.25 |
| `SOL-DELET-DIM` | 5 | CONTINUOUS | 0.13 | 0.25 |
| `SOL-DELET-TXT` | 5 | CONTINUOUS | 0.18 | 0.25 |
| `SOL-DELET-HID` | 5 | HIDDEN | 0.18 | 0.25 |
| `SOL-DELET-HAT` | 5 | CONTINUOUS | 0.13 | 0.25 |

### Windows — `SOL-CHALON-*`
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-CHALON-SYM` | 151 | CONTINUOUS | 0.25 | obj |
| `SOL-CHALON-DIM` | 151 | CONTINUOUS | 0.13 | obj |
| `SOL-CHALON-TXT` | 151 | CONTINUOUS | 0.18 | obj |
| `SOL-CHALON-HID` | 151 | HIDDEN | 0.18 | obj |

### Furniture — `SOL-RIHUT-*`
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-RIHUT-SYM` | 42 | CONTINUOUS | 0.25 | 0.25 |
| `SOL-RIHUT-DIM` | 42 | CONTINUOUS | 0.13 | 0.25 |
| `SOL-RIHUT-TXT` | 42 | CONTINUOUS | 0.18 | 0.25 |
| `SOL-RIHUT-HID` | 42 | HIDDEN | 0.18 | 0.25 |

### Kitchen cabinetry — `SOL-MITBACH-*`
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-MITBACH-SYM` | 52 | CONTINUOUS | 0.25 | obj |
| `SOL-MITBACH-DIM` | 52 | CONTINUOUS | 0.13 | obj |
| `SOL-MITBACH-TXT` | 52 | CONTINUOUS | 0.18 | obj |
| `SOL-MITBACH-HID` | 52 | HIDDEN | 0.18 | obj |

### Floor slab — `SOL-RITZPA-*`
| Layer | Color | Linetype | Weight | CTB pen |
|-------|:-----:|----------|:------:|:-------:|
| `SOL-RITZPA-SYM` | 251 | CONTINUOUS | 0.13 | 0.13 |
| `SOL-RITZPA-HAT` | 8 | CONTINUOUS | 0.13 | 0.13 |

### Cross-discipline dimensions + sheet furniture
| Layer | Color | Linetype | Weight | CTB pen | Purpose |
|-------|:-----:|----------|:------:|:-------:|---------|
| `SOL-MIDOT-PNIM`   | 3   | CONTINUOUS | 0.13 | 0.13 | inner / clear architectural dims + element positions |
| `SOL-MIDOT-CHUTS`  | 1   | CONTINUOUS | 0.13 | 0.13 | outer / overall (incl. wall thickness) dims |
| `SOL-SHEET-FRAME`  | 250 | CONTINUOUS | 0.18 | 0.18 | title block, north arrow, scale bar, fine rules |
| `SOL-SHEET-BORDER` | 255 | CONTINUOUS | 0.50 | 0.70 | heavy outer sheet border / section-cut |
| `SOL-SHEET-LEGEND` | 150 | CONTINUOUS | 0.18 | 0.18 | legend + BOM + opening-spec tables |
| `SOL-SHEET-GRID`   | 8   | CENTER     | 0.13 | 0.13 | column / axis grid (layout agent) |
| `SOL-SHEET-NOTES`  | 150 | CONTINUOUS | 0.18 | 0.18 | general notes |
| `SOL-SHEET-REV`    | 1   | CONTINUOUS | 0.18 | 0.13 | revision markers / clouds |

Plus DXF layer `0` (reserved; block geometry lives here so the INSERT layer drives
colour).

---

## 4. Toggle-groups — the display-reduction contract

This is what the **superposition-HTML checkboxes** and the **layout-splitter**
consume. Each group is a set of layer-name **globs** (`*` = any run of chars) that
toggle together. Exposed programmatically as `require('src/dxf_soline').TOGGLE_GROUPS`.

Matching semantics: a `*` matches any characters; an entry without `*` is an exact
layer name. A layer is "in the group" if it matches any glob in the list.

### By discipline (one trade, all its kinds)
| Group | Globs |
|-------|-------|
| `walls`       | `SOL-KIROT-*` |
| `structure`   | `SOL-MIVNE-*` |
| `electrical`  | `SOL-CHASHMAL-*` |
| `lighting`    | `SOL-TEURA-*` |
| `water`       | `SOL-MAYIM-*` |
| `drainage`    | `SOL-NIKUZ-*` |
| `gas`         | `SOL-GAZ-*` |
| `hvac`        | `SOL-MIZUG-*` |
| `ventilation` | `SOL-IVRUR-*` |
| `doors`       | `SOL-DELET-*` |
| `windows`     | `SOL-CHALON-*` |
| `furniture`   | `SOL-RIHUT-*` |
| `kitchen`     | `SOL-MITBACH-*` |
| `floor`       | `SOL-RITZPA-*` |

### Super-groups
| Group | Globs |
|-------|-------|
| `mep`      | `SOL-CHASHMAL-*`, `SOL-TEURA-*`, `SOL-MAYIM-*`, `SOL-NIKUZ-*`, `SOL-GAZ-*`, `SOL-MIZUG-*`, `SOL-IVRUR-*` |
| `openings` | `SOL-DELET-*`, `SOL-CHALON-*` |

### By content-kind (across every discipline)
| Group | Globs |
|-------|-------|
| `allDimensions` | `*-DIM`, `SOL-MIDOT-PNIM`, `SOL-MIDOT-CHUTS` |
| `allText`       | `*-TXT`, `SOL-SHEET-LEGEND`, `SOL-SHEET-NOTES` |
| `allHatch`      | `*-HAT` |
| `allHidden`     | `*-HID` |
| `allCentre`     | `*-CEN`, `SOL-SHEET-GRID` |

### Sheet furniture
| Group | Globs |
|-------|-------|
| `sheet`      | `SOL-SHEET-FRAME`, `SOL-SHEET-BORDER`, `SOL-SHEET-GRID`, `SOL-SHEET-REV` |
| `annotation` | `SOL-SHEET-LEGEND`, `SOL-SHEET-NOTES`, `*-TXT`, `*-DIM`, `SOL-MIDOT-PNIM`, `SOL-MIDOT-CHUTS` |

**Recommended default checkbox tree** (for the HTML viewer):

```
▸ Disciplines   walls · structure · electrical · lighting · water · drainage ·
                gas · hvac · ventilation · doors · windows · furniture · kitchen · floor
▸ Content       allDimensions · allText · allHatch · allHidden · allCentre
▸ Sheet         sheet · annotation
▸ Quick views   MEP-only (mep)  ·  Openings-only (openings)  ·
                Bare plan (walls + openings, everything else off)
```

---

## 5. CTB (colour → pen) alignment

The CTB agent (`templates/ctb/`) maps **ACI colour → plotted pen**. This taxonomy
uses only colours that keep that mapping consistent:

* **Pinned colours** (`1,2,3,4,5,6,7,8,9,30,42,141,150,250,251,255`) plot at the
  CTB pen for that colour. Because every KIND of a discipline shares the discipline
  colour, all of a discipline's content plots at one pen — predictable and flat-free
  across the sheet.
* **Un-pinned colours** used by the four new split disciplines (`NIKUZ` 140,
  `IVRUR` 131, `CHALON` 151, `MITBACH` 52) fall through to CTB index 0 = *use object
  lineweight*. That is correct: every layer here embeds a real group-370 weight, so
  those disciplines still plot at their intended 0.25 mm.
* Do **not** edit CTB files to accommodate new colours — the fall-through path
  already handles them. If the CTB agent later wants to pin 140/131/151/52, the
  colours above are the ones to add.

---

## 6. How the exporters assign entities (routing rules)

Both exporters route through helpers in `src/dxf_soline.js` so a symbol and its
3D body always land on the same discipline:

* `symbolLayer(disc)` → the discipline `-SYM` layer for a symbol-library discipline.
* `refineDisciplineLayer(symLayer, item)` → splits the two merged disciplines the
  symbol library can't always separate, using the element's own text:
  water → **drainage** for `ביוב/ניקוז/drain/waste`; HVAC → **ventilation** for
  `אוורור/ונטה/מפוח/fan/diffuser`.
* `kindLayer(name, KIND)` → same discipline, other kind (`SOL-CHASHMAL-SYM` →
  `SOL-CHASHMAL-DIM`); falls back to `-SYM` when the discipline lacks that kind.

Concrete assignments:

| Content | Layer |
|---------|-------|
| Wall cut faces (2D/3D) | `SOL-KIROT-SYM` |
| Wall poché SOLID fill | `SOL-KIROT-HAT` |
| Wall length dims / element position dims | `SOL-MIDOT-PNIM` (inner), `SOL-MIDOT-CHUTS` (overall) |
| Element symbol / 3D body | its discipline `-SYM` (refined) |
| Element position/height dims | its discipline `-DIM` |
| Door geometry / window geometry | `SOL-DELET-SYM` / `SOL-CHALON-SYM` |
| Concealed/pocket/sliding dashed runs | opening's `-HID` |
| Opening width/offset dims | opening's `-DIM` |
| Opening mark (D#/W#), element notes | discipline `-TXT` |
| Wall elevation tags (W1…) | `SOL-KIROT-TXT` |
| Kitchen cabinet run / carcass / countertop | `SOL-MITBACH-SYM` |
| Floor slab / tiling (3D) | `SOL-RITZPA-SYM` / `-HAT` |
| Title block, north, scale bar | `SOL-SHEET-FRAME` |
| Sheet border | `SOL-SHEET-BORDER` |
| Legend / BOM / opening spec tables | `SOL-SHEET-LEGEND` |

Layers with no content in a given drawing (e.g. `-CEN`, `-HID` when there are no
centrelines/concealed openings) are still declared in the LAYER table, so a viewer
checkbox exists for them and they populate automatically when such geometry appears.

---

## 7. Migration from v6

| v6 layer | v7 layer(s) |
|----------|-------------|
| `SOL-KIROT` | `SOL-KIROT-SYM` (colour 9 → **7**, so walls now plot heavy) |
| `SOL-KIROT-MILUY` | `SOL-KIROT-HAT` |
| `SOL-MIDOT-PNIM` / `SOL-MIDOT-CHUTS` | unchanged |
| `SOL-PTACHIM` (doors + windows) | `SOL-DELET-*` (doors) + `SOL-CHALON-*` (windows) |
| `SOL-CHASHMAL` | `SOL-CHASHMAL-SYM` (+ `-DIM/-TXT/-HID`) |
| `SOL-INSTALATSIA` (water + drain) | `SOL-MAYIM-*` (water) + `SOL-NIKUZ-*` (drainage) |
| `SOL-MIZUG` (HVAC + vent) | `SOL-MIZUG-*` (AC) + `SOL-IVRUR-*` (ventilation) |
| `SOL-TEURA` / `SOL-GAZ` / `SOL-MIVNE` | `…-SYM` (+ kinds) |
| `SOL-RIHUT` (furniture + kitchen) | `SOL-RIHUT-*` + `SOL-MITBACH-*` (kitchen) |
| `SOL-DIM-<DISC>-<n>` (per-element, numbered) | consolidated into discipline `-DIM` |
| `SOL-TEKST` (colour 7) | `SOL-SHEET-LEGEND` (colour 150) / `SOL-SHEET-NOTES` |
| `SOL-MISGERET` | `SOL-SHEET-FRAME` + `SOL-SHEET-BORDER` (heavy border) |
| `SOL-RITZPA` (colour 8) | `SOL-RITZPA-SYM` (colour 251) + `-HAT` |
| — (new) | `SOL-SHEET-GRID`, `SOL-SHEET-REV` |

The old per-element `SOL-DIM-<DISC>-<n>` explosion (one numbered layer per placed
element) is **gone**: element dims now live on their fixed discipline `-DIM` layer,
so the layer list is stable regardless of element count — exactly what the checkbox
UI and the layout-splitter need.

---

## 8. Invariants (kept green by both exporters' `selfTest`)

* **R12 (AC1009)** — matches the DR/Raumplan reference DXF that opens cleanly in the
  owner's AutoCAD 2021. **No** group-370 lineweights, **no** OBJECTS section, **no**
  group-390 plot-style pointers, **no** `$HANDSEED`, **no** AC1015-only tables
  (lineweight is delivered at plot time by `SOLINE.ctb` mapping ACI colour → pen).
* Exactly **4 sections** (HEADER / TABLES / BLOCKS / ENTITIES); SECTION/ENDSEC and
  BLOCK/ENDBLK balanced.
* 70 semantic layers + layer `0` (71 LAYER records); **0 duplicate handles**; every
  INSERT resolves to a defined BLOCK.
* Linetypes: `CONTINUOUS`, `HIDDEN`, `CENTER`.
* **Layer names are real Hebrew** (v11+), emitted as CP1255 bytes via `layerOut()`;
  the internal `SOL-*` key never reaches the file. Hebrew TEXT values are likewise
  CP1255 (`heToCp1255`). `$DWGCODEPAGE ansi_1255`; STYLE `SOLINE` → `arial.ttf`.
* **No LAYER name contains a SPACE or any R12-illegal char** (`< > / \ " : ; ? * | , = \``)
  and none exceeds 31 chars — enforced by `sanitizeLayerName()` at build and re-checked
  by both exporters' `selfTest` (`invalidLayerNames()` + a scan of the emitted LAYER
  table). This is the v13 fix for the "won't open in AutoCAD" regression.
* An **English underscore fallback** exists in parallel (`EN_LAYER`, selected by
  `setLayerLang('en')`): `Walls`, `Electrical`, `Electrical_Dim`, `Dim_Inner` … — pure
  ASCII, matching the proven reference style, for the `v13en` build.
* Every byte is CP1255-encodable (char code ≤ 255) — the file is written **`latin1`**,
  never `ascii` (which would corrupt the Hebrew bytes).
* ACI colours are intact (one colour per discipline) so `SOLINE.ctb` still maps by
  colour; the 71-layer discipline×kind taxonomy is unchanged — only the emitted
  name string became Hebrew.

---
*Generated from `src/dxf_soline.js`. To change the taxonomy, edit `DISCIPLINES_DEF`
/ `AUX_LAYERS` / `TOGGLE_GROUPS` there and regenerate — this doc is the contract, that
file is the implementation.*
