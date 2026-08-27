# Export regression harness

`test/regression.js` round-trips **one fixture** through **every export format** and
asserts each output is still valid. Its job is to make sure a future change can't
**silently break an exporter**. It is **test-only**: it never edits or monkey-patches
exporter source — it only calls the public exported API (`exportX` / `selfTest`)
exactly as `soline_convert.js` and the per-file CLIs do.

## How to run

```bash
# from the converter/ directory
node test/regression.js            # run all formats, print a PASS/FAIL summary
node test/regression.js --verbose  # also print every individual check line
npm test                           # same as `node test/regression.js`
```

Exit code is **0** when every format PASSes (or is cleanly SKIPPED), **non-zero**
when any format FAILs — so it can gate CI directly.

## Fixture

Primary: `_LATEST/allelem_showcase.sol` (loaded via `src/readSol.js` → embedded
ORDX → `src/parseOrdx.js`, the same path the real exporters consume). It packs one
room, 4 walls, and every element type, so all exporters get exercised. Falls back
to `analysis/out/allelem/allelem.ordx` if the `.sol` is missing.

It is **deterministic**: no network, no random, no reliance on `Date.now` (any
date-bearing title is omitted or pinned), so re-runs give identical results.

## What is covered per format

| Format | Module / entry | Key assertions |
| --- | --- | --- |
| **DXF-2D** | `export_dxf2d.js` `exportDXF2D` + `selfTest` | `selfTest.ok`; R12 `AC1009`; `$DWGCODEPAGE ansi_1255`; `$DIMLFAC` present; **no DIMSTYLE table**; no R13-only `$DIM*` vars; cp1255-encodable; unique handles; symbols as BLOCK + INSERT |
| **DXF-3D** | `export_dxf_pro.js` `exportDXF3DPro` + `selfTest(mode:'3d')` | `selfTest.ok`; EOF terminator; 4 balanced SECTIONs; balanced BLOCK/ENDBLK; R12 (AC1009, no OBJECTS). Also runs `exportDXF2DPro` + `selfTest(mode:'2d')` |
| **PDP** | `writePdpDR.js` `selfTest()` + byte-tests | `selfTest().ok`; runs `analysis/pdp_inject_bytetest.js` and `analysis/pdp_plus_bytetest.js` as subprocesses and asserts exit 0 (positive world coords, property unit `[0x91,0x9c)` untouched, size rule, ➕ socket-plus emit) |
| **HTML** | `export_html.js` `renderHtml` | Renders for a **media-less** `.sol` and a **media-ful** model: valid `<html>`, RTL (`dir="rtl"`), **no external asset URLs** (CSP-safe), media embedded as `data:` URI |
| **ORDX** | `export_ordx.js` `exportORDX` | Non-empty, valid XML prolog, re-parses, round-trip preserves rooms/walls and the full summary |
| **ORD** | `export_ord.js` `exportOrd` | Uses the module `selfTest` if present; otherwise asserts the ORD-Extended v4 structural contract: `[Header]` Version=4 / Unit=1, required sections, ASCII-only, CRLF, one `[Walls]` row per wall. **SKIPs cleanly** (never FAILs) if the file is absent |

## Notes / limits

- The PDP byte-tests depend on the DR base corpus under `templates/dr/base/`. If that
  corpus is absent (base-only shipped seat), those two sub-checks are skipped with a note.
- `export_ordx.js`'s own `selfTest()` is **not** used: it isn't exported and it hard-codes
  an external dev-corpus path. Instead the harness does a self-contained
  `exportORDX → parseOrdxString` round-trip on the fixture.
- The harness never writes into the user's project tree except the byte-tests' own
  outputs under `analysis/out/` (produced by the existing scripts, unchanged).
