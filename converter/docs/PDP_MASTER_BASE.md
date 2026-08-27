# The MASTER BASE — build one InnoDraw file, get perfect PDP exports forever

**Who this is for:** Michael (the owner), one-time setup in your own InnoDraw / Raumplan.
**What it gives you:** every element Soline exports lands on a **real native slot** in your own
file, so it renders the **correct Raumplan symbol** — no wrong glyphs, no fallback symbols, the
file **loads clean**, and Soline makes **zero risky edits** to the vendor structure. Because the
base is a file **you drew and own** under your own InnoDraw license, it is fully legal.

> ## תקציר בעברית
> צייר **חדר-אב אחד** בראומפלן שמכיל **מלאי נדיב מכל סוג אביזר** (הטבלה למטה), שמור אותו כ-`.pdp`,
> והפנה אליו את Soline דרך `SOLINE_DR_BASE_DIR`. מאותו רגע כל ייצוא-PDP ממפה **כל אביזר לחריץ-אב
> מקורי** → **סמל נכון לכל פריט**, קובץ **שנטען נקי**, ו**אפס עריכות מסוכנות** (בלי לגעת בקוד/בלוק
> הסמל). זה הקובץ **שלך**, שציירת בראומפלן ברישיון שלך — חוקי לגמרי. עודפי-חריצים מקופלים אוטומטית
> הרחק מחוץ-לתוכנית, כך שאין "רוחות" צפות על השרטוט.

---

## Why this is the real fix

Soline's PDP export never invents a Raumplan symbol. It takes **your** loadable `.pdp`, keeps its
whole body byte-for-byte, and only:

- rewrites the **wall table** to your room's walls,
- moves each reused item slot's **position / dimensions / type-label** (the fields InnoDraw proved
  safe to edit),
- and **collapses any leftover slots far off the plan** so they never show.

It **never** touches the symbol's code+property block (`bytes 0x91–0x9b`). The owner load-test was
decisive here: editing that block — *even swapping one sub-block within the same symbol code* —
makes Raumplan reject the file (error **921**). So the only way to get the **correct symbol** for an
item, safely, is for the base to **already contain a slot whose native symbol is that item's
symbol**. Route the item onto it, and the right glyph renders with nothing risky changed.

A small base runs out of the right slots (our 17-item calibration room gets **15/17** correct on the
richest bundled base, because it has only one door slot and only three code-1 line slots, but the
room needs two doors and four line points). **A master base with a generous slot per type removes
that ceiling — every item finds its exact native slot → correct symbol for ALL items.**

---

## What to draw (once), and how many of each

In InnoDraw / Raumplan, draw **one room** (any shape — Soline rewrites the walls) and place items
from Raumplan's **own** element library, using the counts below. These counts are deliberately
**generous** — comfortably above what any single residential room places — so no item ever falls
back. Surplus you don't use in a given export is auto-hidden off-plan, so **over-providing is free**;
under-providing is the only thing that costs a correct symbol.

Counts are derived from the 32 native types in `docs/ELEMENT_LIBRARY_MASTER.md` (+ the three
reference types InnoDraw also supports). Place items whose **name contains the type word** — Soline
matches on that (`docs/ordx_item_dictionary.json`); a single vs. double socket both count as "שקע".

### Electrical & low-voltage points
| # | Type (place items named…) | Meaning | Suggested count |
|---|---|---|---|
| 1 | `שקע` (socket / Duplex Socket) | wall outlet | **20** |
| 2 | `+שקע` (SocketEx) | outlet variant | **4** |
| 3 | `מפסק` (switch / Duplex Switch) | light switch | **12** |
| 4 | `+מפסק` (SwitchEx) | switch variant | **4** |
| 5 | `טלפון` (phone / Duplex Phone) | phone point | **4** |
| 6 | `+טלפון` (PhoneEx) | phone variant | **2** |
| 7 | `אנטנה` (TV / Duplex TV) | TV / antenna | **4** |
| 8 | `אינטרקום` (intercom / door bell) | intercom | **2** |
| 9 | `ק.בקורת` (junction / inspection box) | junction box | **8** |
| 10 | `תאורה` (lighting / can light) | ceiling light | **16** |
| 11 | `ק.חשמל` (power box) | power / product box | **4** |
| 12 | `צ.חשמל` (power line) | electrical conduit point | **10** |

### Water, plumbing & gas
| # | Type | Meaning | Suggested count |
|---|---|---|---|
| 13 | `צ.מים` (water supply) | water line point | **10** |
| 14 | `ברז` (faucet) | tap | **8** |
| 15 | `מים משולב` (combined water) | combined water fixture | **4** |
| 16 | `גז` (gas) | gas point | **4** |
| 17 | `פ.ביוב` (floor drain) | floor drain | **6** |
| 18 | `ביוב` (sewage) | sewage point | **6** |
| 19 | `ביוב קיר` (wall sewage) | wall sewage | **6** |
| 20 | `מקלחת` (shower) | shower | **2** |
| 21 | `אמבט` (bath) | bathtub | **2** |
| 22 | `בידה` (bidet) | bidet | **2** |
| 23 | `אסלה` (toilet) | toilet | **3** |

### Openings & structure
| # | Type | Meaning | Suggested count |
|---|---|---|---|
| 24 | `דלת` (door / passage) | door | **8** |
| 25 | `חלון` (window) | window | **8** |
| 26 | `אדן חלון` (window sill) | sill | **8** |
| 27 | `ארגז תריס` (shutter box) | shutter box | **8** |
| 28 | `חור.פ.ממד` (safety-room opening) | safe-room opening | **2** |
| 29 | `פתח איוורור תקרה` (ceiling vent) | ceiling air opening | **4** |
| 30 | `חור איורור` (vent hole) | vent hole | **6** |
| 31 | `עמוד` (column) | square column | **4** |
| 32 | `עמוד עגול` (round column) | round column | **2** |
| 33 | `תעלה` (channel / beam) | structure / channel | **10** |

### HVAC
| # | Type | Meaning | Suggested count |
|---|---|---|---|
| 34 | `רדיאטור` (radiator) | radiator | **4** |
| 35 | `מזגן` (air conditioner) | AC unit | **4** |

**Total ≈ 211 slots.** That is a big but perfectly ordinary Raumplan file — InnoDraw handles it,
and any slots a given room doesn't use are auto-collapsed far off-plan (they never show).

> **Shortcut (fewer to draw).** Some types share the **same Raumplan glyph**, so the converter can
> satisfy any of them from a shared pool — you don't strictly need separate counts:
> - `צ.מים` = `צ.חשמל` = `ביוב קיר` = `חור.פ.ממד` — one code-1 "line/point" glyph. A pool of **~24**
>   of any of these covers all four.
> - `תעלה` = `עמוד` = `אדן חלון` = `ארגז תריס` = `פתח איוורור תקרה` — one code-1 "structure box"
>   glyph. A pool of **~24** covers all five.
>
> Placing each type by its own name is still the cleanest option, because then Soline also fixes the
> **text label** to the exact type — but if you want less to draw, lean on these pools.

---

## Save it, and point Soline at it

1. **Save** the room from InnoDraw as a `.pdp` file. Name it clearly, e.g. `master4.pdp`.
   - The `4` is a reminder of its **wall count**. Soline reads the real wall + slot counts from the
     file, so the name is only for you.
   - For the file to be picked for a room, it must have **at least as many walls** as the room and
     **at least as many slots** as the room has items. To keep walls clean (no degenerate "ghost"
     walls), draw **one master per common wall count** you use — e.g. `master3.pdp`, `master4.pdp`,
     `master5.pdp`, `master6.pdp` — each with the same generous element mix above. Soline picks the
     best fit automatically and collapses the rest.
2. Put the file(s) in a folder, and point Soline at that folder (checked in this order — first wins):

   **Option A — environment variable (quickest):**
   ```powershell
   # Windows PowerShell
   $env:SOLINE_DR_BASE_DIR = "C:\Users\you\InnoDraw\soline-master-bases"
   ```
   ```bash
   # macOS / Linux / Git Bash
   export SOLINE_DR_BASE_DIR="/path/to/soline-master-bases"
   ```

   **Option B — config file (permanent):** copy `soline.config.example.json` to
   `soline.config.json` and set:
   ```json
   { "drBaseDir": "C:\\Users\\you\\InnoDraw\\soline-master-bases" }
   ```

That's it. From then on every PDP export builds on your master base. (See
`docs/PDP_CUSTOMER_BASE.md` for the same base-folder mechanism in more detail.)

---

## What you get, guaranteed

With a master base in place, every export runs the **native-symbol (postype-clean) path**:

- **Correct symbol for every item** — each element maps to a slot whose native Raumplan glyph is
  already that element's symbol (block-exact). With generous counts, that's **17/17** (or however
  many items the room has), not 15/17.
- **Loads clean** — Soline changes only the wall table, and each used slot's position / dimensions /
  type-label. It **never** edits the symbol code or property block (the 921 trigger) and keeps your
  file's whole Section-E body **byte-for-byte**.
- **No floating ghosts** — every slot you didn't use is repositioned to a single point **~8 m beyond
  the room's far corner, on the positive-world side** (world = stored + 20000, kept **positive** — a
  load-test proved world-negative surplus makes Raumplan reject the file, world-positive loads), well
  outside the plan, so the drawing shows only the real items.
- **Legally yours** — the base is a file you drew and saved under your own InnoDraw license; Soline
  ships none of InnoDraw's files and redistributes nothing.

> Still worth one **Raumplan load-test** the first time, to confirm your particular InnoDraw build
> is happy — but structurally this is the safest possible export: your own loadable file, with only
> geometry and labels moved.

---

## What your `תשתיות.pdp` already gives you (decoded 2026-08-24)

The `תשתיות.pdp` you drew is decoded as a genuine InnoDraw **element library** (`SUPP_FR` =
supply/infrastructure) — **22 symbol definitions**, not a room drawing. Its dims match the Soline GT
library exactly, so it is your authoritative **infrastructure** symbol set. It already covers, of the
table above, the **MEP subset**: `שקע` (socket, +double/triple), `מפסק` (switch, +double/combined),
`מים משולב` (combined water), `מים קרים/חמים` (water/faucet points → `צ.מים`/`ברז`), `גז` (gas),
`נקודת אנטנה` (`אנטנה`), `נקודת טלפון` (`טלפון`), `ביוב` (sewage), `פתח יציאת אויר` (vents →
`חור איורור`/`פתח איוורור תקרה`).

**To turn it into a full master base, add (in Raumplan) the non-infra types it lacks:** openings
`דלת חלון אדן חלון ארגז תריס`, HVAC `רדיאטור מזגן`, wet fixtures `מקלחת אמבט בידה אסלה`, `תאורה`
(light), `ק.חשמל צ.חשמל ק.בקורת` (power box/line/junction), `אינטרקום`, `פ.ביוב ביוב קיר` (drains),
structure `עמוד עמוד עגול תעלה`, `חור.פ.ממד`. Draw them as **placed items in a room** (with walls) —
not as a preferences/library file — using the generous counts above, and save that room as your
`master4.pdp` (etc.). Full decode in `docs/ELEMENT_LIBRARY_MASTER.md §11`.
