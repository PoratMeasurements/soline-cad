# BLOCK_FINDINGS — What high-quality reference blocks teach us for Cycle 1

> Reference gathering only. Findings distilled from the **GREEN / CC0** GSStnb/dxfBlocks set (studied
> directly, ASCII DXF) and from AMBER/manufacturer sources (studied on-page for conventions/dimensions).
> Mapped section-by-section to `docs/CABINET_BLOCK_CONTENTS.md` (referenced below as **CBC §n**).
> **No Soline block or geometry is produced here** — this only informs our own from-scratch design.

Date: 2026-08-22 · Primary reference: GSStnb/dxfBlocks @ master (CC0-1.0), imperial/full-scale DXF.

---

## 1. Headline observations from the CC0 library

1. **Full-scale, real-unit, 2D plan symbols.** Every block is drawn 1:1 in real units (`$INSUNITS=1`,
   inches) — no pre-scaling. A "24" lower cabinet is literally a 24×24 unit rectangle. → Confirms our
   **author-in-mm, full-scale** model; scale is a *view/plot* concern, never baked into geometry.
2. **Detail level tracks visual complexity, not object importance.** The same library draws a base
   cabinet as **4 lines**, a sink as **8 lines + 8 arcs + 1 circle**, and a gas range as **117 lines +
   200 arcs + 6 circles** (burner grates). → Validates CBC §3.5's **1:50 vs 1:20 tiering**: draw only
   what reads at the plan's scale; richness belongs to the object that needs it (hob grates, sink bowl),
   not lavished on a plain carcass.
3. **They put everything on layer 0 and lean on *linetype* for meaning** (front/hidden edges = `DASHED2`,
   color/weight all `ByLayer`). This is the library's **biggest weakness for us** and the clearest place
   Soline improves on it: we carry **semantic layers** (`SOL-RIHUT`, `-DOOR`, `-HW`, `-HID`, `SOL-TEKST`)
   so a block **explodes onto meaningful layers** (CBC §4, §7.3). → Take their *geometry conventions*,
   reject their *layer-0 flattening*.
4. **Width families as separate files sharing one design** — Lower/Upper each ship the same block at
   9/12/15/18/21/24/27/30/33/36″. → Exactly our **single-object-file → width variants** model
   (CBC §2.1 `variants`, `J_FIRST20` Cycle-1 = 300/450/600/800/900). Their 3″ step ≈ our 150 mm-ish
   metric bands; our IL bands (300/450/600/800/900) are the right metric analogue.

---

## 2. Mapping to CABINET_BLOCK_CONTENTS.md

### CBC §1 — Components (drawn vs referenced)
- **Carcass footprint (CBC §1.1):** CC0 lower cabinet = a single `W×D` rectangle with the **front edge
  drawn `DASHED`** and the three other edges solid. → Endorses CBC §1.1 "one rectangle per view at 1:50"
  and CBC §3.1 front-edge treatment. Our refinement: we split solid carcass (`SOL-RIHUT`) from the
  **dashed worktop overhang** (`SOL-RIHUT-HID`) rather than dashing the carcass edge itself — cleaner and
  more informative than the CC0 single-dashed-line shortcut.
- **Doors / swing (CBC §1.3):** the CC0 **refrigerator** blocks draw door-swing as **ARCs** (French =
  4 arcs), and corner cabinets add a diagonal face — but the **base cabinets themselves carry no swing
  arc** (they're bare rectangles). → Confirms our decision to make the **swing arc our value-add** on the
  plan (CBC §1.3, radius = leaf width, 90°/leaf) — most free base-cabinet blocks omit it; drawing it well
  differentiates the Soline plan.
- **Sink bowl (CBC §1.10 / sink base):** Sink-Single = radiused-corner bowl (arcs) + **drain as a
  `CIRCLE`**, overall ≈ 33″×20.5″ (standard sink-with-drainboard footprint). Double = two bowls + two
  drains. → Our sink-base **Section/Plan** should show bowl outline + drain circle; plumbing itself stays
  on `SOL-INSTALATSIA` via the symbol module, not the block (CBC §4, §6.2 MEP companions).
- **Hood (CBC §1.11-adjacent):** Range Hood = **12 plain lines** (nested rectangles). → A wall/hood
  symbol needs only outline + inner duct rectangle; extract indication routes to `SOL-MIZUG` in our
  scheme (CBC §4).
- **Referenced-not-drawn** (hinges, legs, drawer boxes): the CC0 set draws **none** of these in plan —
  consistent with CBC §1.6–1.8 keeping them as BOM/metadata.

### CBC §2 — Parametric fields
- The CC0 width families are **discrete files**, not parametric. Soline's advantage is a **single
  parametric object** (CBC §2.1–2.2) resolving to any width. Reference confirms the **width set worth
  shipping**: their densest coverage is 12–36″ (≈ 300–900 mm), matching our Cycle-1 300/450/600/800/900.
- **Depths observed:** Lower (base) = **24″ ≈ 610 mm**; Upper (wall) = **12″ ≈ 305 mm**. → Sanity-checks
  our CBC §2.1 defaults (base carcass 560 mm + worktop to ~600 mm; wall 300 mm). Our metric defaults are
  in the right band; the US base is slightly deeper (610 vs 560) — an IL-vs-US convention difference to
  keep (we follow IL/manufacturer numbers, not the US 24″).

### CBC §3 — Views
- CC0 blocks are **plan-only** (single view per file). Soline requires **Plan + Front + Side** (CBC §3,
  `H_VIEW_MATRIX`). → We are **more complete** than the reference; the reference informs the **plan** view
  primarily. For Front/Side conventions, lean on **manufacturer spec sheets** (Bosch/GE elevations,
  Blum carcass sections), not the CC0 set.
- **Legibility tiering** (CBC §3.5) is empirically confirmed by the reference (see §1.2 above).

### CBC §4 — Layers
- **Key divergence, in our favour.** CC0 = layer-0 + linetype only. Soline = **role→layer routing**
  with fail-closed QA (CBC §4, §7.3, `I_QA_STANDARD` role-layer). → Do **not** inherit their flat
  layering; it's the one thing to consciously *not* copy. Their linetype vocabulary (`DASHED2` for
  hidden/front edges) maps cleanly onto our `SOL-RIHUT-HID` HIDDEN linetype.

### CBC §5 — Insertion point & orientation
- CC0 lower cabinet anchors at a **rear corner (0,0)** with the footprint extending to (24,−24) — i.e.
  **back-edge on the axis, depth into −Y**. → Same family as our **back-left corner = (0,0)** anchor
  (CBC §5.1). Minor sign/handedness difference (they run depth into −Y) is irrelevant since we define our
  own datum; the **principle — anchor on the real back edge so a run tiles by advancing width** — is
  shared and validated. Corner blocks (`LowerCorner`, `Alt1`) confirm the **inner-corner anchor** case
  (CBC §5.1 KIT-CORN).

### CBC §6 — Attributes / BOM
- CC0 blocks carry **no ATTRIBs / no schedule data** — pure geometry. → Soline's ATTRIB/BOM channel
  (CBC §6, `UNIT` visible + hidden W/H/D/TYPE/HINGE…) is a **genuine differentiator**; nothing in the free
  reference set schedules. The **numbers** to fill those attributes come from manufacturer specs
  (Blum/Bosch/GE), recorded as `manufacturer-spec` in `metadata.sources[]`.

### CBC §7 — DXF block structure
- CC0 files are **flat entity dumps in model space** (a couple use `BLOCK`/`ENDBLK`, most don't) — not
  reusable named blocks with ATTDEFs. → Soline's `SL_<KEY>` named-block + ATTDEF + INSERT structure
  (CBC §7) is **strictly more capable**. Reference informs geometry inside the block, not its packaging.

---

## 3. Dimensional facts harvested (facts only — for `metadata.sources[]`)

| Fact | Value (ref) | Metric | Source kind | Use |
|---|---|---|---|---|
| Base cabinet depth (US std) | 24″ | 610 mm | cc0 (GSStnb) | sanity-check vs our IL 560/600 |
| Wall cabinet depth (US std) | 12″ | 305 mm | cc0 (GSStnb) | confirms our wall ≈ 300 mm |
| Cabinet width family | 9–36″ @ 3″ | ≈229–914 mm | cc0 | confirms 300/450/600/800/900 Cycle-1 band |
| Standard sink footprint | ~33″×20.5″ | ~838×520 mm | cc0 | sink-base plan/section extents |
| Bosch built-in DW recess height | 81.5–87.5 / 86.5–92.5 cm | — | manufacturer-spec | tall/appliance-housing clearances |
| Range/hob detail level | grates as arcs | — | cc0 | hob symbol detail budget at 1:20 |

> All manufacturer numbers (Blum/Bosch/GE) enter as `kind:"manufacturer-spec"` and contribute **numbers
> only**; every Soline object still attests `originalGeometry:true` (`docs/LICENSES.md` workflow).

---

## 4. Net recommendations for our OWN Cycle-1 cabinets

1. **Keep the plan as the hero, drawn lean** — carcass rectangle + swing arc + unit tag; the CC0 set
   proves a base cabinet needs almost nothing else at 1:50 (CBC §3.5).
2. **Our two deliberate improvements over the free reference:** (a) **semantic layers** instead of
   layer-0 + linetype; (b) **the plan door-swing arc**, which the free base-cabinet blocks omit — draw it
   to our fixed convention (radius = leaf width, 90°/leaf).
3. **Ship width variants from one parametric object**, covering the 300/450/600/800/900 band the
   reference's density corroborates — but as **one object + `variants`**, not 5 hand-drawn files.
4. **Depths follow IL/manufacturer numbers** (base ~560–600, wall ~300), not the US 24″/12″ — the CC0
   set is a proportion sanity-check, not a dimension source.
5. **Detail budget by object:** carcass = outline only; sink base = bowl + drain circle; hob = grate
   detail acceptable at 1:20; hood = outline + duct rect. Never richer than the object earns at the plot
   scale.
6. **Front/Side + ATTRIB/BOM are Soline-native** — the free set gives no help there; use manufacturer
   spec sheets for elevation dimensions and cut-outs, and our own schema for the schedule.
