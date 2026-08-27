# ELEMENT_SYMBOL_SPEC_V2 — Soline DXF-2D symbol standard

Scope: **DXF-2D only** (`element_symbols_soline.js` = single source of truth; consumers
`export_dxf2d.js`, `export_dxf_pro.js`, `dxf_soline.js`, `export_pdf`/report).
**Out of scope:** PDP / Raumplan / DR native symbols (`writePdpDR.js`, `readPdp.js`,
`injectNativeItem.js`, `convertNative.js`, `*.pdp`). Not touched by this work.

Date: 2026-08-25 · Author: DXF-2D symbol quality agent · Grammatical gender: masculine (Hebrew).

---

## 0. Primitive language (unchanged — do not alter the public API)

Unit box `[0..1]²`, y **down**, centre `(0.5,0.5)`. Wall on the bottom edge `y=1.0`;
element reaches **into the room** upward (`y↓0`). Renderer maps `u→(u-0.5)*W`,
`v→(v-0.5)*H`. Primitives: `line rect ellipse arc poly label`. Shared props `wt`
(line-weight multiplier), `dash`, `fill`. Helpers: `stem dome bowtie earth waves
arrowHead linearLight socketGang switchGang marker`.

`toDxf2dGlyph(sym,{w,h})` bakes the unit box to local **mm** (wall at `Y=0`, `+Y`
into room): `Xmm=(x-0.5)*W`, `Ymm=(1-y)*H`. Arcs/ellipses are sampled to polylines;
true circles stay `{circle:[cx,cy,r]}`; labels become `{label:[x,y,text,hmm]}`.
`toReportDef(sym)` returns `{plan,elev}` verbatim for the CVSM/report renderer.

---

## 1. Professional convention per discipline (the LINE-WORK rule)

Grounded in IEC 60617 / BS EN 60617 (electrical) and standard architectural /
MEP blueprint conventions. Israeli-standard defaults chosen where a convention is
ambiguous (noted inline).

### Electrical (IEC 60617 §6–7) — layer `SOL-CHASHMAL-SYM`
- **Socket / outlet:** feed stem from the wall to a **semicircle (dome)** whose flat
  side faces the wall. Single = one dome; multi-gang = *n* domes sharing one diameter
  line + one stem. (IEC: "one semicircle for a single, two for a double.") Appliance
  outlets = the single dome + a short Hebrew appliance label inside the box.
- **Switch:** full pivot dot on the wall + **angled lever line(s)** fanning into the
  room. 1/2/3-gang = 1/2/3 levers. Two-way = extra alternate contact; intermediate
  (cross) = crossed contacts (X).
- **Luminaire point:** **crossed circle** (⊗). Downlight = circle+X; ceiling rose =
  circle+X+plus. Linear LED = thin channel split into diode ticks (line-of-light).
- **Panel / distribution board:** heavy enclosure + chamfered title bar + breaker
  ticks. RCD/SPD = labelled control box (ΔI). Earth/bonding = IEC earth (stem + 3
  shortening bars).
- **Data / comms:** RJ45 = socket circle + **filled contact triangle** facing the room.
  TV/phone = same base + `TV`/`T` tag. Device-specific data (Cat/fiber/HDMI) = the
  same circle+triangle base + a short tag (upgraded from bare box — see §3).

### Plumbing / water — layer `SOL-MAYIM-SYM`
- **Supply point:** feed stem + bold circle, tagged `C` (cold) / `H` (hot). Israeli
  default: Latin C/H tags (matches trade drawings).
- **Faucet / valve / shut-off:** **ISO butterfly (bow-tie)** on the pipe + handle core
  — the real valve glyph, never a plain circle.
- **Appliance water point:** supply circle + short appliance label.
- **Hose bibb / garden tap:** valve bow-tie + outlet nozzle.
- **Water heater / boiler / solar collector:** tank circle/box + label.

### Drainage / waste — layer `SOL-NIKUZ-SYM`
- **Drain point:** circle + inner marker. **Floor drain:** square grate box + inner
  circle + cross-slots. Toilet waste = double circle. Concealed cistern = box.

### Gas (Israeli gas trade) — layer `SOL-GAZ-SYM`
- **Gas point / prep:** feed stem + **filled equilateral triangle** (gas tap glyph) +
  tag. **Valve** = bow-tie + tag. **Meter** = box "G". **Regulator** = box + bubble.
  Ambiguity note: Israel has no single legislated domestic gas plan glyph; the filled
  triangle tap + Hebrew tag is the common trade convention and is kept.

### HVAC / ventilation — layers `SOL-MIZUG-SYM` / `SOL-IVRUR-SYM`
- **AC indoor unit:** long rounded box + louver blades. **Condenser:** box + fan circles.
- **Diffuser / grille:** box + directional blade lines. **Exhaust fan:** **Y inside a
  circle** (standard). Ducts/sleeves = circle + flow arrow.
- **Thermostat:** **circle containing T** (standard). UFH manifold = box + loop arcs.

### Architectural / structure / openings — layers `SOL-MIVNE/DELET/CHALON-SYM`
- **Door:** hinge jamb + leaf + **quarter-circle swing arc** (L/R handed). Sliding =
  leaf panels + track. Double = mirrored swings. Pocket = leaf into wall cavity.
- **Window:** frame rect + glazing bar(s); casement/tilt/kip add the opening triangle;
  sliding = offset sashes. Openings in `export_dxf_pro` 2D are parametric stretch-unit
  blocks (`WINDOW1`/`DOOR1`) scaled by width/thickness — kept as-is (not device glyphs).
- **Column:** rect (with diagonals) or circle. Beam/dropped-ceiling = rect (dashed for
  hidden). Niche/step/chamfer/curved-wall = the literal wall line-work.

---

## 2. Audit of the 189 current symbols vs the standard

Method: read every definition; classify each as **GOOD** (already the standard glyph)
or **UPGRADE** (bare box+label where a recognised glyph is standard, or a glyph that
mis-conveys the device). Result: the library is **already at professional standard** —
the socket dome-gang, switch lever-fan, crossed-circle luminaires, ISO bow-tie valves,
IEC earth, filled-triangle data/gas, Y-in-circle fan, circle-T thermostat, and door
swing arcs are all correct. The historical "symbols not professional" complaint is **not**
a library defect — it is the export bug (§ Part B): `export_dxf_pro.js` never called the
library and drew ~8 crude local `BLOCKS_2D` glyphs (everything unknown → a plain box).

### GOOD (keep as-is) — the large majority
All socket/switch/appliance-outlet families; all luminaires; RJ45/TV/phone; smart
sensors (motion waves, contact, shutter/curtain M); safety (smoke S, doorbell, chime,
camera, alarm panel/siren, sprinkler); all water supply/valve/appliance/heater; all
drainage (incl. floor-drain grate); gas point/prep/valve/manifold/cylinder/taboon;
all HVAC (AC indoor/condenser/diffuser/grille, exhaust-fan Y-in-circle, cassette,
concealed, sleeves, flues, louvers); thermal (heat-pump, UFH manifold loops); renewable
(PV panel grid, net-meter); all doors (swing arcs) and windows; all structure line-work.

### UPGRADE (bare marker where a recognised glyph is standard)
| key | discipline | current | target line-work |
|---|---|---|---|
| `data_cat`   | comms | box + "Cat"  | RJ45 base (socket circle + filled contact triangle) + small `Cat` tag |
| `data_fiber` | comms | box + "סיב"  | RJ45 base + small `סיב` tag |
| `data_hdmi`  | comms | box + "HDMI" | RJ45 base + small `HDMI` tag |

Rationale: these are wall data outlets in the same family as `data_rj45`/`data_tv`;
giving them the shared socket-circle + contact-triangle base makes the comms family read
as one system instead of three anonymous boxes. All other `marker()`-based symbols
(equipment: router/intercom/inverter/driver/regulator/irrigation controller, protective
devices RCD/SPD, appliance-labelled outlets) are **legitimately** a labelled control box
and stay — that IS the professional convention for a boxed device identified by text.

Per-symbol geometry for the three upgrades (unit box `[0..1]`, y down):
```
data_cat / data_fiber / data_hdmi :=
  stem(0.72)
  circle(0.5, 0.46, 0.26, {wt:1.3})                 // socket ring
  poly([0.37,0.58, 0.5,0.34, 0.63,0.58], {fill:true}) // contact triangle into room
  label(0.5, 0.80, <tag>, labelHf(<tag>))            // short tag below the ring
```

---

## 3. Invariants (must hold after any edit)

- Public API of `element_symbols_soline.js` unchanged: `symbolFor resolve resolveKey
  listSymbols SYMBOLS toReportDef toDxf2dGlyph` + exported helpers — exact signatures.
- 189 keys resolve and render (`symbolFor`, `toDxf2dGlyph`, `toReportDef` non-null).
- Hebrew comments/labels kept; masculine gender.
- R12 DXF contract, layer names, `$DWGCODEPAGE ansi_1255`, and export plumbing unchanged
  — **symbols only**.
- PDP / Raumplan path untouched.

## Sources
- IEC 60617 / BS EN 60617 electrical graphical symbols (socket semicircles, switch angled
  line, distribution boards): totalskills.co.uk, elec-mate.com IEC 60617 references.
- Architectural / MEP blueprint symbol guides (thermostat circle-T, exhaust-fan Y-in-circle,
  floor drain, valves): smartdraw.com, mtcopeland.com, civiljungle.org.
