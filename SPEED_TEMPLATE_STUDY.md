# SPEEDtemplate / ETMM Installer — Static Study & Decision-Support Status Picture

**Purpose.** Statically analyse the owner-provided Windows installer
`SPEEDtemplateUpdate_latest.exe` (~174 MB) to learn what is valuable for Soline.
This is a **study + adopt/skip decision matrix** — the same spirit and format as
`converter/docs/SIVAN_TEMPLATE_STUDY.md`. It records **facts, structure, counts,
architecture, and a decision** — it reproduces **no proprietary code, geometry,
template content, or artwork**.

> **Nothing was executed.** The installer and every bundled `.exe`/`.dll`/`.sys`
> was treated as **data only**. No running, installing, or launching. The file was
> parsed statically: PE header/sections/overlay, the Authenticode certificate, and
> the InstallShield cabinet **file-directory** (which is stored uncompressed and
> therefore readable without unpacking any payload). No DRM/licensing material was
> circumvented. The original file was not modified.

**Headline correction to the working hypothesis.** The brief guessed "an AutoCAD
template/block asset pack." **It is not.** It is the **installer for a commercial
countertop/stone digital-templating desktop application** — internal name **ETMM**,
product **"SPEEDtemplate"**, by **Fifth Gear Technologies LLC**. The ~173 MB is
mostly the bundled **.NET 6 runtime, a GStreamer video stack, the Leica DISTO SDK,
and the application binaries** — **not** a CAD content library. There is **no DWG /
DXF / DWT / LISP / block library** inside. The real "gold" is therefore not
drawing conventions but the **measurement → template → CAD → fabrication workflow
architecture and the device-integration taxonomy**, which map directly onto
Soline's `soline-measure` app and its Leica DISTO integration work
(`docs/disto_integration.md`).

---

## 0. Decision matrix at a glance

| # | What we learned (from ETMM/SPEEDtemplate) | Verdict for Soline | One-line reason |
|---|---|---|---|
| 1 | **Bridge-per-device integration model** (separate `LeicaBridge*` exe per instrument family: 3D Disto / iCS-series / S910 / X-series) | **ADOPT (concept)** | Validates Soline's "one `MeasurementDriver` adapter per model" architecture — a proven shipping pattern |
| 2 | **Leica DISTO SDK is real and licensable** (`Leica.DistoSdk.*`, `Leica.Disto.Api`, `Leica.Sdk`) — desktop, not mobile | **ADAPT / note** | Confirms an official desktop SDK exists; Soline's BLE-direct-on-Android decision still stands (SDK is Windows-only) |
| 3 | **Live video streaming stack** (full GStreamer) bundled for camera/Pointfinder instruments | **ADAPT (later)** | The iCS/camera-aiming devices stream video; Soline's X6 Pointfinder path will need an equivalent |
| 4 | **Unit-specific default templates** — `ETMM-IN.ckt` (inch) + `ETMM-MM.ckt` (mm) + `Default.ckt` | **ADOPT** | Ship unit-locked default project templates; matches Soline's cm/mm units discipline |
| 5 | **Workspace tiering** — `EssentialsWorkspace.wsp` vs `Advanced.wsp` (+ `default.wsp`) | **ADAPT** | Product/UX tiering (simple vs power user) as a first-class, swappable workspace file |
| 6 | **Moraware JobTracker integration** (`MorawareClient.exe`, `JobTrackerAPI4.dll`) | **ADAPT / evaluate** | Countertop-industry job/shop-management standard; a candidate integration or design reference for Soline's order flow |
| 7 | **Tech-stack choices** (.NET 6/WPF, `UnitsNet`, `PdfSharp`+`PDFMerge`, `NPOI` for Excel) | **ADAPT (reference)** | Concrete, sane library picks for units, PDF output/merge, and Excel export |
| 8 | **Hardware-dongle + license-wizard DRM** (Sentinel `ssi*ddp` drivers, `LicenseWizard.exe`) | **SKIP** | Proprietary licensing/DRM — noted only; **not circumvented**, not a model Soline wants |
| 9 | Their **application binaries, Leica/Moraware SDKs, .ckt/.wsp/.pal content** | **SKIP (do not redistribute)** | Proprietary + third-party licensed; record structure only |

---

## 1. Installer identity & structure (facts)

**Format.** InstallShield **2018** (engine major version **22**), **InstallScript**
project, **Unicode** setup launcher — a single-EXE self-extracting installer.
Confirmed from `ISInternalVersion 22.0.401`, `SOFTWARE\InstallShield\22.0\Professional`,
and the InstallShield cabinet magic `ISc(` with version word `0x04000898`
(decodes to major = 0x0898/100 = **22**).

**PE facts.** PE32 (i386, GUI), 4 sections (`.text .rdata .data .rsrc`). The PE
image is only ~1.2 MB; the remaining **~173 MB is an overlay** holding the
InstallShield media (engine files + `data1.hdr` directory + `data1.cab` payload).

**Version resource (product identity):**

| Field | Value |
|---|---|
| ProductName | **SPEEDtemplate** |
| ProductVersion / FileVersion | **25.11.0001** (Internal Build 176888) |
| CompanyName | **Fifth Gear** (signed as **Fifth Gear Technologies LLC**) |
| FileDescription | InstallScript Setup Launcher Unicode |
| OriginalFilename | InstallShield Setup.exe |
| LegalCopyright | Copyright (c) 2015 Flexera Software LLC *(engine boilerplate, not the product)* |

**Digital signature.** Authenticode-signed, **Extended Validation code signing**,
subject **Fifth Gear Technologies LLC**, issued via **Entrust EVCS2**, timestamped by
**Sectigo**. (Cert table: 12,304 bytes at end of file. Signature integrity was not
verified — only the subject/issuer strings were read.)

**Install target & feature structure** (from the InstallScript component table,
stored uncompressed in `data1.hdr`):
- Installs to `<TARGETDIR>\ETMM\SPEEDtemplate.exe` — an **ETMM** program folder.
- Component GUID `995BC246-F8C2-4F88-9893-CDB26C157378:ETMM`.
- Data features: `<Data>\Toolbar`, `<Data>\Training`, **`<Data>\CountertopVersion`**
  (the product is explicitly a **countertop** edition).
- Support script parts: `Main Installation\{Script,Setup,StrTbl,RunTime,Resource}`.
- Prerequisites bundled: **.NET 6.0.33 x64** (`dotnet-runtime-6.0.33-win-x64.exe`),
  **VC++ redistributable** (`VC_redist.x64.exe`), `dotnetinstaller.exe`.

**Cabinet manifest counts** (from the `data1.hdr` CabDescriptor, read statically):
- **directory_count = 15**, **file_count = 480**, file-table size ≈ 60 KB.

---

## 2. Bundled-asset inventory (types → count → what it is)

The 480-file manifest was recovered from the **uncompressed** InstallShield file
directory (names only; file bodies stay compressed and were not extracted). Grouped
by role:

| Group | Approx. count | Representative names | What it is |
|---|---:|---|---|
| **Application core** | ~10 | `SPEEDtemplate.exe`, `ETMM.exe`, `ETMM.HLP`, `ETMM.cde`, `etmm.GID`, `Rev*.dll` (RevHost/RevFeat/RevFilt/RevSComm/RevMisc/RevCmmio) | The ETMM/SPEEDtemplate app + help + a "Rev*" host/plugin framework |
| **Templates (`.ckt`)** | 4 | `ETMM-IN.ckt`, `ETMM-MM.ckt`, `Default.ckt`, `Default.ckt` | **Unit-specific default project templates** (IN = inch, MM = millimeter) |
| **Workspaces (`.wsp`)** | 3 | `EssentialsWorkspace.wsp`, `Advanced.wsp`, `default.wsp` | UI/workspace layouts — **Essentials vs Advanced tiering** |
| **Palette / config** | ~5 | `default.pal`, `FontData.ini`, `corecomp.ini`, `DIFxData.ini`, `empty.txt` | Colour palette + app/font/config |
| **Leica DISTO integration** | ~20 | `Leica.DistoSdk.*` (Core/Common/Communication/Clm/LiveStream/VideoStreaming/Sftp/Sample), `Leica.Disto.Api`, `Leica.Disto.Networking`, `Leica.Sdk`, `LeicaBridge.exe`, `LeicaBridge3DDisto.exe`, `LeicaBridgeICSSeries.exe`, `LeicaBridgeS910.exe` (+ `.config`) | **One bridge exe per instrument family** talking to the Leica DISTO SDK |
| **GStreamer video stack** | ~220 | `gst*.dll` (playback, rtsp, mediafoundation, nvcodec, d3d11, camerabin, jpeg/png, x264, opus…) | **Live camera/video streaming** — for camera-aiming (Pointfinder/iCS) instruments |
| **CAD / drawing engine** | ~3 | `TGCADA32.dll`, `TGCADB32.dll`, `TGCADC32.dll` | Embedded CAD/drawing kernel ("TG CAD") |
| **PDF output** | ~9 | `PDFMerge.exe`+`.dll`, `PdfSharp.*` (Charting/Quality/Snippets/WPFonts) | PDF generation + **merge** (PdfSharp based) |
| **Excel / office export** | ~6 | `ExcelClient.exe`, `NPOI*.dll` (OOXML/OpenXml4Net/OpenXmlFormats) | XLSX read/write export |
| **Moraware / business** | ~3 | `MorawareClient.exe`, `JobTrackerAPI4.dll`, `BizopsClient.exe` | **Moraware JobTracker** shop-management integration |
| **Units / utility libs** | ~5 | `UnitsNet.dll`, `Newtonsoft.Json.dll`, `log4net.dll`, `NLog.dll`, `Serilog.*`, `ICSharpCode.SharpZipLib.dll`, `Castle.*`, `CommunityToolkit.Mvvm.dll`, `WPFCustomMessageBox.dll` | .NET **WPF/MVVM** app plumbing; `UnitsNet` for unit conversion |
| **.NET BCL shims** | ~150 | `System.*.dll`, `Microsoft.Extensions.*` | Framework-dependent shims shipped with the app |
| **Licensing / DRM** | ~12 | `LicenseWizard.exe`, `SimAccessKC.dll`, `KCOT1104asu.dll`, `KCSFL504asu.dll`, `aegisapi.dll`, `ssidddp.sys`, `ssipddp.sys`, `ssivddp.dll`, `checklpt/checkpdd/checkvdd.exe`, `ddinst32.exe` | **Hardware-dongle / Sentinel-style licensing** (see §5) |
| **Instrument config** | ~3 | `ETMM-IN.ckt`, `ETMM-MM.ckt`, `Default.ckt`, `Default.ckt`, `*.ckt` | (counted above under templates) |
| **Installer engine** | ~25 | `setup.inx`, `isrt.dll`, `ISSetup.dll`, `ISBEW64.exe`, `data1.hdr`, `data1.cab`, `_isres/_isuser_0x0409.dll`, `license.rtf`, `RevUtil.dll`, `SurfaceChecker.exe`, `ShortcutRunAsAdmin.exe` | InstallShield runtime + first-run helpers |
| **Docs / training** | ~3 | `release notes.pdf`, `Training` dir, `Training Materials` dir | Bundled documentation |

> **No CAD content library present.** Zero `.dwg .dxf .dwt .lsp .vlx .fas .arx .cui
> .cuix .pat .lin .shx .ctb .stb .scr` files in the manifest (one stray `gf.MNL`
> string only, inside compressed data). The bulk size is runtime + video stack +
> SDKs, not drawings.

---

## 3. The "gold" — what Soline can actually learn (architecture, not artwork)

Because this is a shipping product in **Soline's exact problem domain** (field
laser-measurement → digital template → CAD → fabrication/order), the learnings are
architectural. Mapped to Soline's pipeline:

### 3.1 Bridge-per-device integration (ADOPT — concept)
ETMM ships a **separate bridge executable per Leica instrument family** —
`LeicaBridge3DDisto.exe`, `LeicaBridgeICSSeries.exe`, `LeicaBridgeS910.exe`, plus a
generic `LeicaBridge.exe` — all fronting one `Leica.DistoSdk.*`. This is exactly the
shape of Soline's planned **`MeasurementDriver` adapter-per-model** design
(`docs/16-Device-Driver-Contract-Spec.md`, `docs/03-Device-Plugin-Architecture.md`):
a stable core with a thin, swappable driver per device. **Takeaway:** the "one
adapter per instrument, common SDK/port behind it" pattern is validated by a
shipping competitor. Soline should keep it, and note the device families worth
supporting (3D Disto, iCS series, S910, X-series).

### 3.2 Desktop Leica SDK exists — but Soline's BLE-direct call still holds (ADAPT/note)
The presence of `Leica.DistoSdk.*` proves an **official Leica SDK** exists and is
licensable — but it is a **Windows/.NET desktop** SDK (WPF app, `.dll`s). This is
consistent with Soline's `disto_integration.md` finding that **no official mobile
SDK exists** and that **BLE-direct on Android** is the right path. ETMM is the
*desktop* answer; Soline's *mobile/offline-first* answer is different by necessity.
**Takeaway:** no change to Soline's BLE-direct decision; but if a Windows companion
ever appears, the Leica desktop SDK is the sanctioned route.

### 3.3 Live video streaming for camera-aiming devices (ADAPT — later)
~220 GStreamer plugins (incl. `Leica.DistoSdk.VideoStreaming`, `LiveStream`,
`gstrtsp`, `gstmediafoundation`, `gstnvcodec`) show that **camera/Pointfinder-class
instruments stream live video** into the templating UI (aiming, photo overlay). This
is precisely the **X6 Pointfinder / iCS camera** capability Soline flagged for its
advanced "measure a whole room from one point" version. **Takeaway:** when Soline
reaches camera-aided capture, budget for a live-video path; GStreamer is the
heavyweight route ETMM chose (Soline can likely use a lighter Android-native path).

### 3.4 Unit-locked default templates (ADOPT)
`ETMM-IN.ckt` and `ETMM-MM.ckt` are **separate default templates per unit system**
(inch vs millimeter), with a neutral `Default.ckt`. This mirrors Soline's units
discipline (cm/mm) and is a clean pattern: **ship a unit-locked starting template so
the operator never mixes systems**. **Takeaway:** Soline's project/template seed
should be unit-explicit from creation, not converted after the fact.

### 3.5 Workspace tiering: Essentials vs Advanced (ADAPT)
`EssentialsWorkspace.wsp` vs `Advanced.wsp` are **swappable UI workspaces** — a
simple entry-level layout and a power-user layout over the same engine.
**Takeaway:** a good UX model for Soline's field app — a stripped "measure only"
workspace vs a full "measure + edit + export" one, selected by role, without forking
the app.

### 3.6 Moraware JobTracker integration (ADAPT / evaluate)
`MorawareClient.exe` + `JobTrackerAPI4.dll` integrate **Moraware JobTracker**, the
de-facto **countertop-industry job/shop-management system** (quotes → jobs →
scheduling → fabrication). ETMM pushes templates/measurements straight into the job
record. **Takeaway:** this is the industry hand-off Soline's order flow competes
with or connects to; worth studying Moraware's job model as a reference for Soline's
order/measurement linkage, and as a possible integration target for shops that
already run it.

### 3.7 Concrete tech-stack picks (ADAPT — reference)
- **`UnitsNet`** for unit conversion — a mature .NET library; validates Soline's
  choice to treat units as first-class typed quantities.
- **`PdfSharp` + a dedicated `PDFMerge.exe`** for PDF output and **merging**
  multi-page issue sets — relevant to Soline's sheet/PDF export.
- **`NPOI`** for `.xlsx` import/export (cut-lists, quantities).
- **.NET 6 / WPF / MVVM (`CommunityToolkit.Mvvm`)** desktop stack.
**Takeaway:** these are sane, low-risk building blocks if Soline ever builds a
Windows-side companion; and confirm PDF-merge + Excel export as expected outputs.

### 3.8 Embedded CAD kernel "TG CAD" (note)
`TGCAD{A,B,C}32.dll` is an embedded 2D CAD/drawing kernel — the product renders and
edits the template drawing **without AutoCAD**, then exports. **Takeaway:** confirms
the winning shape is *own lightweight CAD + export*, not a plugin into AutoCAD — the
same architectural bet as Soline's own DXF/2D pipeline.

---

## 4. Relevance to Soline — adopt / adapt / skip (prioritised)

**Worth adopting (as our own):**
1. **Bridge/adapter-per-instrument** device model (§3.1) — already Soline's plan;
   this is external validation. Keep it; enumerate device families to target.
2. **Unit-locked default templates** (§3.4) — make Soline's project seed unit-explicit.
3. **Essentials vs Advanced workspace tiering** (§3.5) — role-based UI over one engine.

**Worth adapting / evaluating:**
4. **Moraware JobTracker** as a reference (and possible integration) for the
   measurement→job→fabrication hand-off (§3.6).
5. **Live-video capture path** for camera-aided X6/iCS measurement, when Soline
   reaches that version (§3.3) — lighter than ETMM's full GStreamer.
6. **Tech-stack references** — `UnitsNet`, `PdfSharp`+PDF-merge, `NPOI` (§3.7) — for
   any Windows companion / export work.

**Skip:**
7. **Their binaries, Leica/Moraware SDKs, `.ckt`/`.wsp`/`.pal` content, `TGCAD`
   kernel** — proprietary + third-party licensed; **do not extract or redistribute**.
8. **Hardware-dongle DRM** (§5) — noted, not adopted, not circumvented.

**Already-have / unaffected:**
9. Soline's **BLE-direct-on-Android, offline-first** DISTO decision stands — ETMM is
   the *desktop* answer and does not change it (§3.2).
10. Soline's **own DXF/2D + PDP + dimstyle** pipeline is the right architectural bet
   (ETMM independently chose own-CAD-plus-export, §3.8).

---

## 5. IP / licensing flags

- **Commercial, EV-code-signed proprietary software** by **Fifth Gear Technologies
  LLC** (product SPEEDtemplate / ETMM, v25.11.0001). Not open, not redistributable.
- **Hardware-dongle / license-manager DRM present**: `LicenseWizard.exe`,
  `SimAccessKC.dll`, `KCOT1104asu.dll`, `KCSFL504asu.dll`, `aegisapi.dll`, and
  **Sentinel-style kernel drivers** `ssidddp.sys` / `ssipddp.sys` / `ssivddp.dll`
  (+ `checklpt/checkpdd/checkvdd.exe`, `ddinst32.exe`). **This was only catalogued —
  no attempt was made to bypass, patch, emulate, or otherwise circumvent it.**
- **Bundled third-party components, each under its own licence** — not Soline's to
  ship: **Leica DISTO SDK** (proprietary Leica), **Moraware JobTracker client/API**
  (proprietary), **GStreamer** (LGPL/GPL mix), **.NET 6 runtime**, **VC++ redist**,
  `Newtonsoft.Json`, `NPOI`, `PdfSharp`, `log4net`, `NLog`, `Serilog`, `Castle`,
  `ICSharpCode.SharpZipLib`, `UnitsNet`, `CommunityToolkit.Mvvm`.
- **Do not redistribute or import** any of the above into the Soline repo. This
  document records **names, counts, and architecture only** — no code, no template
  content, no geometry, no artwork was extracted or reproduced.

---

## 6. Method note (how this was done, safely)

1. Read PE header → 4 sections + a **173 MB overlay**; the launcher is only 1.2 MB.
2. Signature scan → **InstallShield** (not NSIS/Inno/7z/MSI); cabinet magic `ISc(`,
   engine **v22 = InstallShield 2018**, thousands of zlib streams (per-file compression).
3. Read the **VS_VERSION_INFO** and the **Authenticode cert** → product/publisher.
4. Parsed the InstallShield **`data1.hdr` CabDescriptor** (uncompressed) → directory
   and file **counts**, then read the **file-name directory** (UTF-16, uncompressed)
   → the 480-file manifest. **Payload file bodies were never decompressed or run.**
5. Cross-checked keywords; confirmed **no CAD content library** and confirmed the
   Leica/Moraware/GStreamer/.NET stack. (Raw `CNC/DXF/DWG/Saw/CAM` byte hits all fell
   inside high-entropy compressed streams and are coincidental, not real strings.)

Scratchpad working dir:
`…/scratchpad/speed_extract/` (analysis scripts + `versioninfo.txt` only; no payload
files were written or extracted).

---

## 7. סיכום לבעלים (עברית)

**מה זה בעצב:** הקובץ **אינו** חבילת בלוקים/טמפלייטים ל-AutoCAD כפי ששיערנו. זהו
**מתקין של תוכנת שולחן מסחרית לשרטוט/תבנית של משטחי מטבח (קאונטרטופ)** — שם פנימי
**ETMM**, מוצר **"SPEEDtemplate"**, מבית **Fifth Gear Technologies LLC**, גרסה
25.11.0001, חתום דיגיטלית (EV). מותקן ב-InstallShield 2018. ה-173MB הם בעיקר
**סביבת ריצה של .NET 6, מנוע וידאו GStreamer, ה-SDK של Leica DISTO, ובינאריות
האפליקציה** — **אין בפנים ספריית DWG/DXF/בלוקים**.

**למה זה זהב בכל זאת — וזה בדיוק התחום של Soline:** התוכנה עושה בדיוק את מה ש-Soline
בונה — **מדידת לייזר בשטח (Leica DISTO) → תבנית דיגיטלית → CAD → ייצור/הזמנה**. מה
שכדאי ללמוד:
1. **גשר-לכל-מכשיר** — יש exe נפרד לכל דגם Leica (3D Disto / iCS / S910 / X-series)
   מעל SDK משותף. זה **בדיוק** ארכיטקטורת ה-`MeasurementDriver` שתכננו — אישור חיצוני.
2. **טמפלייט לפי יחידות** — קובץ ברירת-מחדל נפרד לאינץ' ולמ"מ. לאמץ: זרע-פרויקט נעול-יחידות.
3. **סביבות עבודה מדורגות** — Essentials מול Advanced (אותו מנוע, UI מתחלף). מודל UX טוב לשטח.
4. **אינטגרציית Moraware JobTracker** — מערכת ניהול-עבודות התקן בענף הקאונטרטופ; שווה
   ללמוד כמודל לחיבור מדידה↔הזמנה, ואולי כיעד אינטגרציה.
5. **בחירות סטאק** — `UnitsNet` ליחידות, `PdfSharp`+PDFMerge ל-PDF, `NPOI` ל-Excel.
6. **וידאו חי** (GStreamer) למכשירי מצלמה/Pointfinder — רלוונטי לחזון X6 "מדידת חדר מנקודה אחת".

**מה לדלג:** הבינאריות שלהם, ה-SDK של Leica/Moraware, קבצי ה-`.ckt`/`.wsp`, ומנגנון
הרישוי בדונגל-חומרה (Sentinel). **לא ניסינו לעקוף שום הגנה.** ההחלטה של Soline
(BLE ישיר באנדרואיד, offline-first, צינור DXF/2D משלנו) — נשארת נכונה; זו התשובה
הניידת מול התשובה השולחנית שלהם.

---

## 8. מצב מדידות-חדרים (Room Measurement) — focused deep-dive

**Question asked.** Does SPEEDtemplate have a real **room / space measurement** mode
(מדידות חדרים) distinct from countertop/stone templating (מדידות שיש), and if so, how
does it work — and what can Soline adopt? This section is **web-sourced** (the static
installer yielded nothing here — see §8.5) and every claim is cited.

### 8.1 Does it exist? — **YES, confidently.** Two independent lines of evidence

1. **SPEEDtemplate's own capability list has a dedicated room/space track.** The public
   [capabilities page](https://speedtemplate.com/capabilities/) organises features into
   separate blocks: **"General 2D Measuring"**, **"General 3D Measuring"**,
   **"Countertop Measure"** *(= מדידות שיש)*, and a distinct **"Cabinet Layout Measure"**
   *(= the room/space mode)*. Room measurement is therefore a **first-class, separately
   documented mode**, not a by-product of countertop templating.
2. **The internal product name proves the lineage.** The installer folder/binary is
   **ETMM** (§1) — **ETMM = ETemplate Measure Manager**, a full **2D & 3D laser CAD
   measuring system** whose entire purpose is capturing *spaces* (walls, floor plans,
   cladding, stairs, millwork, commercial rooms), not only slabs. Confirmed on the
   originating vendor's pages: [Measure Manager 3D](https://etemplatesystem.com/measure-manager-3d/),
   [Measure Manager 2D](https://etemplatesystem.com/measure-manager-2/),
   [Pro 2D](https://etemplatesystem.com/pro-2d/). SPEEDtemplate (Fifth Gear) is the
   rebranded, subscription successor of this ETemplate engine. Countertop templating is
   *one module* on top of a general room/plane measuring core.

### 8.2 Capture workflow (room/space mode)

The room-measurement workflow is **plane-based**, and runs on the same laser session as
countertop mode — the operator switches which "measure" module is active. Steps
(from the capabilities list and Measure Manager pages):

1. **Set up & orient the laser.** A self-leveling / motorised Leica head is placed so it
   can see the space; the operator **"orients the laser to 3D space."**
2. **Establish a reference plane.** Set the **XY plane to laser-level OR to a jobsite
   surface** (floor). From it the software lets you **"establish an infinite number of 2D
   planes"** and **"a plane parallel to an existing plane."** *Each wall / floor / ceiling
   becomes its own 2D plane.*
3. **Measure walls → floor plan.** Capture points/lines around the room; the software
   **"establishes a floor plan from measured geometry to designate walls"** and **"draws a
   digital template as the space is being measured."** Walls can be measured with the
   minimum points or with **many points → best-fit** line/plane (for wavy/scribed walls).
4. **True-size offset for studs.** **"Use offset function to define true room size when
   measuring studs"** — measure the stud face, offset by drywall thickness to get the
   finished interior dimension.
5. **Add features onto a wall.** **"Select wall to activate"**, then **"measure doors,
   windows, outlets, switches, plumbing as features of layout."** Data model: *room = set
   of wall-planes, each carrying typed openings/features.*
6. **Capture install-critical field data (the "hidden" value).** **"Measure level of
   horizontal plane"**, **"measure plumb of vertical plane"**, **"measure level, plumb and
   flatness of any plane."** Marketing summarises this as capturing **"wall scribes, floor
   and ceiling level, wall plumb and more"**
   ([speedtemplate.com](https://speedtemplate.com/)). Walls can be flagged **straight or
   scribed**.
7. **Robust corner/edge capture.** **"Points can be measured as an individual 3D point or
   as intersection of 3 planes"**; **"lines … with 3D endpoints or as intersection of 2
   planes."** → you can derive a corner you cannot physically hit by intersecting the
   wall/floor planes.
8. **Edit live, then export.** Best-fit geometry, dynamic editing, undo/redo, then export.

### 8.3 Instruments & outputs

**Instruments (room mode).**
- **Leica DISTO X6** (+ **DST 360** adapter for angle-encoded 3D), **Leica iCS20**,
  **Leica iCS50** — the current SPEEDtemplate-supported set
  ([speedtemplate.com](https://speedtemplate.com/)).
- Lineage devices in ETMM: **3D Disto**, **S910**, **X4** (Measure Manager 3D/2D pages).
- **Leica vPen** (laser-guided wireless pen): **"measure points, lines and surfaces with
  just a touch,"** real-time capture/edit
  ([Stone Update](https://stonemag.com/technology-templating-software-adds-laser-guided-pen/)).
- **Camera cross-hair targeting** + **panoramic room photo** are advertised
  ([speedtemplate.com](https://speedtemplate.com/)) but **not documented in detail** — treat
  as thin evidence (see confidence, §8.6).

**Outputs.** Clean **DXF / DWG / IGES**; intelligent **layered + colour-coded** drawing
(walls on layers, features on layers); **linear & square footage** auto-calculated;
dimensioned drawings; **3D CAD/BIM** models; and — the room-mode headline — **"export
intelligent drawing layout data of walls and features to cabinet-design software"**
(Cabinet Vision, Mozaik, 2020 Design, KCD, ProKitchen, CabMaster, AutoKitchen)
([capabilities](https://speedtemplate.com/capabilities/)).

### 8.4 How room mode differs from countertop mode

| Aspect | **Countertop Measure** (מדידות שיש) | **Cabinet Layout / Room Measure** (מדידות חדרים) |
|---|---|---|
| Subject | the stone surface itself | the *enclosure* around the cabinets/space |
| Auto-design | overhang, inside/outside corner radii, splash height/oversize, build-up strips, seams, sink/cooktop DXF drop-in | **none** — it records reality, not a designed part |
| Plane use | mainly one work plane | **many planes** (each wall/floor/ceiling), + level/plumb/flatness of each |
| Captured entities | edges (straight/scribed), splashes, cutouts | **walls, studs+offset, doors, windows, outlets, switches, plumbing** |
| Field data | edge profile, scribe | **floor/ceiling level, wall plumb, flatness, wall scribe** |
| Primary hand-off | fabrication template → **CNC** | floor-plan layout → **cabinet-design software** |

So it is genuinely two modes over **one plane-measuring core** + **one CAD engine**:
countertop mode auto-*designs a part*; room mode *documents a space and its features*.

### 8.5 Static extraction — what was tried, what came back (honest)

Per the constraint (no execution, no DRM circumvention), a **read-only string scan** of
`SPEEDtemplateUpdate_latest.exe` was run for room-mode vocabulary
(`room, wall, plane, scribe, plumb, ceiling, floor plan, offset, stud, cabinet, measure,
door, window, outlet, splash, overhang, best-fit`).
- **Result: zero readable hits** for every feature/menu term. The only matches were
  **structural** strings that live *uncompressed* in the InstallShield directory
  (`<TARGETDIR>\ETMM\SPEEDtemplate.exe`, `<Data>\CountertopVersion`) plus Win32 API noise
  (`GetActiveWindow`, `stud`→`gstudp.dll`, `splash`→`SplashTime`).
- **Why:** exactly as §6 found — InstallShield 2018 compresses each payload file in its own
  zlib stream, so `ETMM.HLP`, `release notes.pdf`, and the `Training` / `Training Materials`
  folders are **unreadable without decompression**. No InstallShield unpacker was available
  in the environment (**no `7z` / `7za` / `unshield`**; `pefile` not installed), and the
  brief forbids running the bundled `ISBEW64`/installer. The vendor manual
  ([Xpress-Manual PDF](https://etemplatesystem.com/wp-content/uploads/2023/05/Xpress-Manual-12-19-1.pdf))
  is an **image-only scan** with no text layer, so no workflow text could be pulled from it
  either.
- **Conclusion:** the static installer contributed **nothing** to the room-measurement
  picture beyond confirming the **ETMM** identity. **All §8 workflow evidence is public web.**

### 8.6 Top adoptable ideas for Soline's room-measurement app

Mapped to `soline-measure` (concrete, our-own implementation — no code/geometry copied):

1. **🟢 Plane-first room model.** Represent a room as *an unlimited set of 2D planes*
   (each wall/floor/ceiling = a plane) anchored to one XY reference set to laser-level or to
   the floor. Measure 2D geometry *onto the active plane*. This is the cleanest data model
   for DISTO-based room capture and should be Soline's core room abstraction.
2. **🟢 Corner-by-plane-intersection.** Let a corner = **intersection of the two/three
   adjacent planes**, so unreachable/occluded corners are computed, not hit directly.
   Big accuracy + reachability win in real Israeli apartments (columns, niches, ledges).
3. **🟢 Best-fit walls from many points.** Allow over-sampling a wall and fitting a
   straight line/plane (vs trusting 2 points) — captures wavy/plastered/scribed walls
   honestly. Flag each wall **straight vs scribed**.
4. **🟢 Level / plumb / flatness as first-class recorded field data.** Record how far
   out-of-level the floor is, out-of-plumb each wall is, out-of-flat each surface is — and
   surface these as **annotations on the drawing**, because they drive fabrication and
   install (this is SPEEDtemplate's real differentiator over a plain floor-plan app).
5. **🟢 Stud/finish offset for "true room size."** One offset operation to convert a
   measured rough surface (studs / unplastered wall) into the finished interior dimension.
   Directly relevant when Soline measures **before finishes**.
6. **🟢 Features-on-walls schema.** *Room = wall-planes; each wall carries typed features*
   (door, window, outlet, switch, plumbing) placed on that wall. A clean, exportable field
   schema for Soline — richer than a bare polygon.
7. **🟡 Live "template drawn as you measure" + on-site edit.** Immediate visual feedback and
   edit-before-you-leave (the vPen UX). Reduces return trips — a strong field-app value.
8. **🟢 Intelligent layered/colour-coded DXF export** with **walls and openings on separate
   layers** — a convention Soline's converter already supports; adopt the *"walls vs
   openings vs features as distinct intelligent layers"* mapping so downstream design/CNC
   consumes it cleanly.
9. **🟡 Two measure modes over one core** (as SPEEDtemplate does): a **surface/part mode**
   (Soline's existing countertop-style measure) and a **room/space mode** sharing the same
   plane engine, CAD canvas, and DXF exporter — do **not** fork the app; switch the module.

### 8.7 Confidence

- **Room-measurement mode is real: HIGH.** Two independent, citable sources — a dedicated
  "Cabinet Layout Measure" capability block, and the ETMM = ETemplate Measure Manager 2D/3D
  space-measuring lineage.
- **Plane / wall / offset / features / level-plumb-flatness workflow: HIGH.** Enumerated
  verbatim on the capabilities and Measure Manager pages, consistent across sources.
- **Panoramic room photo & camera cross-hair room capture: LOW–MEDIUM.** Advertised as
  bullets only; no manual/demo detail obtained (marketing-level evidence).
- **Exact on-screen UI / button-level workflow: MEDIUM.** Inferred from feature text and
  the ETMM manual's structure; the installer's `ETMM.HLP` and training folders could not be
  decompressed to confirm labels.

**Sources (§8):**
[speedtemplate.com](https://speedtemplate.com/) ·
[capabilities](https://speedtemplate.com/capabilities/) ·
[DISTO X6 page](https://speedtemplate.com/distox6/) ·
[metal fabrication](https://speedtemplate.com/speedtemplate-for-metal-fabrication/) ·
[ETMM Measure Manager 3D](https://etemplatesystem.com/measure-manager-3d/) ·
[Measure Manager 2D](https://etemplatesystem.com/measure-manager-2/) ·
[Pro 2D](https://etemplatesystem.com/pro-2d/) ·
[Stone Update — vPen](https://stonemag.com/technology-templating-software-adds-laser-guided-pen/) ·
[Stone Update — product suite](https://stonemag.com/software-suite-of-products-for-the-countertop-industry/) ·
[Stone World — subscription](https://www.stoneworld.com/articles/93703-speedtemplate-available-through-subscription).

---
*Static study only. The installer and its bundled executables were never run. No
proprietary code, geometry, template content, SDKs, or artwork were extracted or
reproduced — only names, counts, and architecture were recorded. No DRM/licensing
protection was circumvented. §8 room-measurement findings are from public web sources
(cited); the static installer contributed only the ETMM identity.*
