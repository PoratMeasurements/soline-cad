# CTB Market Assessment — is SOLINE.ctb a professional-grade plot style table?

**Question the owner asked:** would a senior Israeli architect (אדריכל בכיר) or interior
designer (מעצב/ת פנים) look at Soline's `SOLINE.ctb` and accept it as *high-level office
work*, or would they see an amateur/project-specific hack?

This document is an honest verdict against what Israeli and international offices actually
use, the concrete gaps that were found in the **pre-upgrade** table, the correct value for
each gap with its source, and confirmation that the **post-upgrade** table now meets or
exceeds that bar.

---

## 1. What the Israeli / professional standard actually is

### 1.1 "Draw by colour, plot by pen" is correct — and universal
The Israeli office convention Soline follows ("שרטוט לפי צבע, הדפסה לפי עט" — a
Color-Dependent plot style table where each ACI colour maps to a pen width) is the correct,
mainstream workflow. It is what the Israeli national drawing standards assume and what
print-shops (בתי דפוS / הדפסות) expect. Sources:
- Standards Institution of Israel — **SI 932 (ת"י 932)** *technical drawing*, **SI 162**
  (general principles of presentation), **SI 189** (dimensioning), **SI 130** (sheet sizes),
  **SI 1226** (building drawings). These define the line/width/annotation grammar a CTB
  implements on paper. https://www.sii.org.il/en/israelistandards
- Israel national CAD/BIM drawing standard context (מכון התקנים / משהב"ש BIM standard). https://www.calcalist.co.il/real_estate/articles/0,7340,L-3769597,00.html
- CTB = per-ACI plot appearance is the documented AutoCAD mechanism. https://ezdxf.readthedocs.io/en/stable/addons/acadctb.html

### 1.2 The width ladder is ISO, and for architecture it is ISO 128-**23**
The pen widths themselves come from the ISO line-width series (ratio 1 : √2), i.e.
**0.13 · 0.18 · 0.25 · 0.35 · 0.50 · 0.70 · 1.00 · 1.40 mm**. The part that governs
**architectural / construction** drawings is **ISO 128-23** (construction documentation),
*not* ISO 128-24 (which is the mechanical-engineering part). The pre-upgrade spec cited
128-20/24; that is a real, defensible citation for the ladder but the architecturally-correct
reference is 128-23.
- ISO 128-23:1999 — construction drawings line types. https://cdn.standards.iteh.ai/samples/22292/a9f6396b7eb94397aa5e41513ebf09b1/ISO-128-23-1999.pdf
- ISO 128-24 (mechanical, for the width ladder). https://archive.org/download/bzbzbzTechDraw/Technical%20Drawing/Standards/ISO%20Standards/ISO%20128-24.pdf
- EN ISO 128-2:2022 — extra-wide : wide : narrow widths in ratio 4 : 2 : 1. https://standards.iteh.ai/catalog/standards/cen/5bacf6e2-8f82-404b-bec1-56f741367e08/en-iso-128-2-2022

### 1.3 A professional office table defines **all 255 colours**, not just the ones used
This is the single biggest tell of a professional table. Real office CTBs (the ones passed
between Israeli/UK/US practices) map **every** ACI 1–255 to a pen, so that any drawing —
including consultant XREFs, imported blocks, and legacy DXFs with no embedded width — plots
predictably. The classic pattern: colours **1–9 = the ISO draughting pen colours**, colours
**10–249 = a matrix / gradient**, and the **250–255 grey ramp reserved for screened**
background/reference/poché.
- BIMuk office standard CTB: "The first 9 colours are based upon the ISO draughting Pen
  colours and the other 247 colours used a matrix… Screening for Pens 1–249 is at 100% and
  Pens 250–255 is set to 50%." https://bimuk.co.uk/best-practise/plot-styles/
- Land F/X standard CTB — full 1–255 with screened poché (e.g. colour 231 = 0.40 mm at 40%
  screen for background poché fills). https://www.landfx.com/docs/cad-basics/plotting/2482-ctb.html
- ACI palette structure is fixed: 0–9 named, 10–249 systematic cube, **250–255 grayscale
  ramp** — which is exactly why offices reserve 250–255 for screening.
  https://help.autodesk.com/view/ACDLT/2024/ENU/?guid=GUID-C163F875-E449-48B7-8CF4-F90DF935118C

### 1.4 Poché / hatch shading must **screen**, not print solid
Cut-fill (poché, פושה) reads as a *tone*, not as linework. Professionals screen it to
~25–50 % (or a light hatch) so the fill never competes with the wall outline. A CTB whose
poché colour prints at 100 % solid black is an amateur signature.
- Land F/X: "Setting screening to anything other than 100 gives a half-tone (faded) line…
  poché with shading level 40." https://www.landfx.com/docs/cad-basics/plotting/2482-ctb.html
- F.D.K. Ching, *Architectural Graphics* — poché as black / grey tone to articulate cut
  vs. habitable space (cited via CCC Architecture, plan-graphics). http://www.cccarchitecture.org/pres

### 1.5 Pen weights are absolute (mm on paper) → scale-independent A0–A4
A correctly-built CTB assigns **paper** widths, so the same table gives the right hierarchy
at any plot scale (1:50 detail through 1:200 plan) and any sheet A0–A4. Soline's table is
already correct on this point; no per-scale variants are needed.

---

## 2. Verdict on the PRE-UPGRADE table

**Verdict: competent core, but *not yet* what a senior office would call high-level.** The
line-weight hierarchy and the binary were genuinely correct and validated — better than most
DIY tables. But three professional gaps would have been spotted immediately:

| # | Gap (pre-upgrade) | Why it reads as amateur | Correct value | Source |
|---|---|---|---|---|
| **G1** | **Only ~16 colours pinned; 239 fell through to "use object lineweight" (0.00).** | A pro office table defines a pen for *all* 255 so foreign/XREF/legacy content plots predictably. A 16-colour table is a project hack. | Map **every 1–255**; unpinned → a deterministic medium default (0.25 mm). | BIMuk full-255 matrix; Land F/X; ACI palette structure (§1.3). |
| **G2** | **No screening anywhere — everything 100 %, including poché (ACI 8) at solid black 0.13.** | Poché must read as grey *tone*; solid-black poché competes with linework. No use of the 250–255 screen band. | Screen poché **~40–50 %**; reserve grey ramp **252–254** as screened reference (50/40/25 %). | Land F/X (poché 40 %); BIMuk (250–255 @ 50 %); Ching (§1.4). |
| **G3** | **Architectural width ladder cited as ISO 128-20/24 (mechanical).** | The architecturally-correct part is 128-**23** (construction). Minor, but a senior reviewer notices the wrong citation. | Cite **ISO 128-23** for construction lines (128-24 only for the width series). | ISO 128-23 (§1.2). |

Non-gaps (things that were already right, and were kept): the 0.13–0.70 ISO ladder; walls
0.50 / structure 0.35 / services 0.25 / text 0.18 / dims 0.13 / section-border 0.70
hierarchy; dithering OFF for crisp black; the two-variant work-set / presentation split; and
a genuinely valid, self-validating binary.

---

## 3. Post-upgrade — what changed, and the verdict now

The upgrade (in `build_soline_ctb.js`, same validated binary + self-validation) closes all
three gaps:

- **G1 → fixed. Full 1–255 coverage.** Every colour now carries a real pen. Width histogram
  of the emitted table: `0.13 mm ×7 · 0.18 ×2 · 0.25 ×243 · 0.35 ×1 · 0.50 ×1 · 0.70 ×1`
  = 255 pens, **zero** colours left at 0.00/object-lineweight. Unpinned colours resolve to
  the ISO medium **0.25 mm** default — the professional, predictable behaviour for any
  foreign colour. Soline's own discipline pins are untouched and remain authoritative.
- **G2 → fixed. Screening deployed.** Poché **ACI 8** now prints as a **50 % grey tone**
  (0.13 mm). The grey ramp is now the reserved screened-reference band: **252 = 50 %,
  253 = 40 %, 254 = 25 %** (all 0.13 mm), matching BIMuk/Land F/X practice. Screening is
  applied identically in both variants (a screened poché reads correctly on a black shop
  print and on a colour presentation alike).
- **G3 → fixed.** Spec now cites **ISO 128-23** for construction lines (128-24 retained only
  for the width series).

**Post-upgrade verdict: yes — this now reads as high-level, professional office work.** It
has the two hallmarks a senior Israeli architect looks for: (a) a *complete* pen table
(all 255 defined, sane default for the unknown) and (b) *screened* poché / reference tone.
Combined with the already-correct ISO ladder, the discipline colour map, and a real,
self-validating `.ctb` binary, it meets — and on the full-coverage + self-validation points
exceeds — the typical shared office CTB.

**Residual, deliberately-not-done (documented, low value for Soline):**
- A per-hue gradient across the 10–249 cube (assigning lighter tints thinner pens). Soline's
  drawings never use those colours, so a single clean 0.25 mm default is more honest and
  auditable than a decorative gradient. Can be added later if Soline starts receiving
  consultant sets that lean on the colour cube.
- Heaviest border at 1.00–1.40 mm for very large A0 sheets. The owner-approved hierarchy caps
  at 0.70 mm; the 1.00/1.40 pens exist in the ladder and can be assigned to ACI 255 later if
  an A0 border needs more presence.

---

## 4. Sources (consolidated)

- Standards Institution of Israel — Israeli standards portal (SI 932/162/189/130/1226). https://www.sii.org.il/en/israelistandards
- Israel national BIM/CAD standard context. https://www.calcalist.co.il/real_estate/articles/0,7340,L-3769597,00.html
- BIMuk office plot-style standard — 1–9 ISO pens, 10–255 matrix, 250–255 screened 50 %. https://bimuk.co.uk/best-practise/plot-styles/
- Land F/X standard CTB — full 1–255, screened poché fills. https://www.landfx.com/docs/cad-basics/plotting/2482-ctb.html
- AutoCAD ACI palette structure (0–9 / 10–249 / 250–255 grey ramp). https://help.autodesk.com/view/ACDLT/2024/ENU/?guid=GUID-C163F875-E449-48B7-8CF4-F90DF935118C
- ISO 128-23:1999 construction drawing lines. https://cdn.standards.iteh.ai/samples/22292/a9f6396b7eb94397aa5e41513ebf09b1/ISO-128-23-1999.pdf
- ISO 128-24 width series. https://archive.org/download/bzbzbzTechDraw/Technical%20Drawing/Standards/ISO%20Standards/ISO%20128-24.pdf
- EN ISO 128-2:2022 line-width ratio 4:2:1. https://standards.iteh.ai/catalog/standards/cen/5bacf6e2-8f82-404b-bec1-56f741367e08/en-iso-128-2-2022
- Plan graphics / poché (Ching, via CCC Architecture). http://www.cccarchitecture.org/pres
- ezdxf `acadctb.py` — CTB binary reference. https://ezdxf.readthedocs.io/en/stable/addons/acadctb.html
- Soline-internal: `docs/DXF_PRO_STANDARDS.md` §1–2 (SOL-layer → ACI → ISO weight map).
</content>
</invoke>
