# Using Your Own InnoDraw Base for PDP Export (one-time setup)

Soline can export your room as a `.pdp` file that opens in InnoDraw / Raumplan. To do that,
Soline builds the export **on top of one of your own InnoDraw base files** — a file you own
under your own InnoDraw license.

**Soline ships none of InnoDraw's files.** We do not include any InnoDraw base, symbol, or
element file in our product. The base always comes from *your* licensed installation. This keeps
everything you export clearly yours, and it means the vendor's artwork and file structure are
never redistributed by us. (Writing a file InnoDraw can open — the format itself — is normal,
lawful interoperability; that part is Soline's own code.)

This is a **one-time setup**. After you point Soline at your base once, every PDP export just works.

---

## What you need

A folder containing **one or more of your own InnoDraw `.pdp` base files**. Either works:

- **The simplest option:** open InnoDraw, draw one empty room (any size), and save it as a `.pdp`.
  Put that file in a folder. That single file is enough — Soline reads its wall and element-slot
  counts from the file and adapts automatically.
- **Or:** point Soline at your existing InnoDraw element/base library folder (for example, a folder
  inside your `El_Cad` install that already contains `.pdp` files you use).

You can drop in several base files (e.g. rooms with different wall counts); Soline picks the best
fit for each export. A single file is perfectly fine.

---

## How to point Soline at it

Choose **one** of these (checked in this order — the first one set wins):

### Option A — environment variable (quickest)
Set `SOLINE_DR_BASE_DIR` to your base folder:

```bash
# Windows (PowerShell)
$env:SOLINE_DR_BASE_DIR = "C:\Program Files (x86)\InnoDraw\El_Cad--1\bases"

# macOS / Linux / Git Bash
export SOLINE_DR_BASE_DIR="/path/to/your/innodraw/bases"
```

### Option B — config file (permanent)
Copy `soline.config.example.json` to `soline.config.json` (next to the converter, or point
`SOLINE_CONFIG` at it) and set `drBaseDir`:

```json
{
  "drBaseDir": "C:/Program Files (x86)/InnoDraw/El_Cad--1/bases"
}
```

A relative path is resolved against the config file's location. That's it — PDP export now uses
your base.

---

## What happens if it isn't set

If Soline can't find your base, **PDP export stops with a clear message** instead of guessing:

> PDP export needs your InnoDraw base — set SOLINE_DR_BASE_DIR / soline.config.json to your
> El_Cad base …

Your other exports are unaffected — **ORDX, DXF (2D/3D), the HTML/PDF reports, and the CTB plot
style all still work without any base.** Only the `.pdp` export needs your InnoDraw base.

---

## Frequently asked

**Why do I have to supply the base — why not bundle one?**
Because a base file carries InnoDraw's own symbol artwork and file structure. Bundling and handing
those back inside our product would be redistributing the vendor's content. Using *your* licensed
file keeps your exports yours and keeps Soline clean.

**Does my base need special elements in it?**
No. An empty room is enough for walls and placement. If your base already contains the element
symbols you use, Soline maps your items onto those matching slots so they render with the correct
symbol; anything else falls back to the closest symbol your base provides.

**Will my export change if I use a different base?**
The walls, item positions, and dimensions come from your Soline measurement either way. The base
mainly determines which native symbol artwork is available. Use a base that contains the symbols
you care about for the best-looking result.

**Where do I get a base if I don't have one?**
Any `.pdp` you can save from your own InnoDraw seat works — including a blank room. If you don't
have an InnoDraw license, the PDP export isn't available to you (by design); your ORDX/DXF/report
exports still are.
