# Soline — IP / Copyright Compliance Audit

**Date:** 2026-08-24 · **Scope:** entire `G:\My Drive\claude\Soline\` tree · **Mode:** read-only audit
**Auditor mandate:** confirm the product embeds only what is legally permitted; be honest about residual exposure.

> ⚖️ This is an engineering/business compliance review, **not legal advice**. Items marked
> **[LAWYER]** should be confirmed with an IP/privacy attorney before the associated feature ships.

---

## Bottom line

**The owner is, on the evidence in this repo, clean.** Every external source is handled under a
documented "facts-and-method, not expression" discipline, and the **shipping product embeds no
third party's geometry, code, blocks, layer names, fonts, or catalog files.** A grep of the actual
exported DXFs found **zero** vendor identifiers.

Residual items are **not current infringements** but deserve attention:
1. **[LAWYER]** Location-consent wording and the (disabled) IP telemetry beacon — privacy-law sign-off.
2. **[LAWYER]** Reverse-engineering of CVSM/RoomMeasure (`com.roommeasure.app`, Elsop) for study — feature
   cloning is lawful, but confirm CVSM's EULA reverse-engineering clause. No CVSM code/assets are embedded.
3. **Housekeeping:** third-party reference files sit on disk (Klil zip/PDF, Tadiran PDF, CVSM guide/report,
   GSStnb DXFs). Only the CC0 set is redistributable — exclude the rest from any public repo or shipped build.

---

## Per-source verdicts

### 1. Sivan Yitzhak template — **CLEAN**
- Study doc `converter/docs/SIVAN_TEMPLATE_STUDY.md` is **method/decisions only**: it explicitly records
  the permission scope ("view/study … language and method … not the full template"), and its closing
  line attests *"No layouts, geometry, block artwork, fonts, or sheet designs were reproduced or
  redistributed."* It contains taxonomy names, an adopt/skip matrix and workflow prose — **no geometry,
  no CTB, no layouts, no fonts embedded.**
- `converter/blocklib/openings/` — identifiers are **100% original**: keys `SOL-DOOR-*`, block names
  `SL_OPN_*`, layers `SOL-PTACHIM*` (verified in `openings_manifest.json`). Manifest/module `source`
  fields say *"Original geometry — no Klil linework/blocks/names/layers embedded."* Zero vendor names
  as identifiers.
- **Only two prose comments** in `converter/src/dxf_soline.js` say a Hebrew-block-naming idea is
  "Sivan-template style/convention" — that is method attribution, not embedded content. **OK.**
- Her `*_sy.shx` fonts are explicitly **SKIP**; none present in the tree.

### 2. Klil (openings) — **CLEAN** (owner has USE permission; we still built original geometry)
- `converter/blocklib/openings/KLIL_OPENINGS_STUDY.md` documents the permission and the naming policy:
  *every* identifier is Soline-original; manufacturer names appear **only as factual-provenance prose**
  (e.g. "dimensions consistent with Klil standard"). Auto-verified "0 vendor identifiers across 28 types."
- All `KLIL` / `ART 401` / `PLUS 701` grep hits across the repo are **(a) factual-provenance prose** in
  study docs / `source:` attributes, or **(b)** the download-command history in `.claude/settings.local.json`
  (curl of Klil's own publicly-offered architect template from `klil.co.il/media/.../belgiplus.zip`).
  **None** are identifiers or embedded linework.
- The downloaded template `converter/research/manufacturer-blocks/windows/Klil-BelgianArt-template.zip`
  (binary DWG) was **not parsed / not embedded** — only its extracted eTransmit `.txt` report is on disk;
  conventions/dimensions were learned from Klil's public spec sheets. Verdict per `SOURCES.md`: AMBER,
  reference-only.

### 3. SAF (saf.co.il) — **CLEAN**
- `converter/research/manufacturer-blocks/SOURCES.md` classifies SAF as AMBER, used as a **style
  "yardstick" only**: *"no geometry embedded; no account created; direct search blocked-403, browsing
  only."* Nothing from SAF is in the product.

### 4. GSStnb / dxfBlocks (CC0) — **CLEAN** (embeddable)
- License claim verified in-repo: `BLOCK_SOURCES.md` records *"LICENSE re-verified at fetch = CC0 1.0
  Universal (the GitHub UI badge mislabels it; the raw `LICENSE` text is the authority)."* CC0 waives
  rights, so even the 41 downloaded DXFs under `converter/blocklib/research/downloads/{cabinets,appliances,sinks,products}/`
  are **redistributable**.
- Discipline note confirms `research/downloads/` is **CC0-only** — AMBER/manufacturer binaries were
  deliberately *not* pulled into the repo. Even so, `LICENSES.md` mandates re-drawing parametrically
  from scratch, so the shipped symbols remain uniformly Soline's.
- *Minor:* the live CC0 status is asserted by the doc; re-confirm the repo's raw `LICENSE` and record the
  commit hash in `metadata.sources[]` as the doc itself requires.

### 5. CVSM / InnoDraw / Raumplan — **CLEAN, with a [LAWYER] note on reverse-engineering**
- Soline **reimplements functionality**, which is lawful (features/methods are not copyrightable).
  `ops/docs/CVSM_ANALYSIS.md` sources everything to CVSM's **official user guide** and restates it in
  Soline's own words with citations — no verbatim manual reproduced in the product.
- **The FULL ELC decode used the owner's OWN exported files** — confirmed: `converter/docs/elc_sets_analysis.md`
  uses the 9 "mimran" matched sets from the owner's own `InnoDrawNet` server (paths under
  `…\InnoDrawNet\Israel\…\Michael-Porat\mimran-*`). No third-party proprietary file was decoded.
- **No CVSM code/assets are embedded.** `converter/src/element_symbols_soline.js` re-draws all 172
  symbols to **IEC / plumbing / gas / HVAC standards**; it borrows CVSM's *coordinate schema* (a
  functional convention, not protectable), not its data.
- **Folder-name caveat (not infringement):** `ops/docs/cvsm_reference/cvsm_html_export/` is *named* as if
  it were CVSM's report, but its files' own headers show it is **Soline's own report template, adapted
  from the owner's desktop kitchen app** (`kitchen_app/templates/interactive_export/`). Recommend
  renaming the folder to avoid the misleading appearance.
- **[LAWYER]** The CVSM guide and symbol language were learned by extracting from `com.roommeasure.app`
  (Elsop). Reverse-engineering a competitor's app for study can conflict with its EULA depending on terms.
  Cloning the *features* is fine; recommend (a) a lawyer glance at CVSM's reverse-engineering clause and
  (b) keeping "CVSM"/"RoomMeasure" out of any **user-facing** product string (currently they appear only
  in source comments and internal docs — acceptable, but keep it that way).

### 6. Manufacturer data (Klil / Rav-Bariach / Tadiran / Pandoor / Blum / Bosch / GE) — **CLEAN**
- `SOURCES.md` + `LICENSES.md` treat all of these as **facts-only** (dimensions, cut-outs, clearances —
  not copyrightable). Red lines are explicit: *"Do NOT redistribute or embed the manufacturer's own CAD
  files, DWG/DXF blocks, drawings, or images."* Two manufacturer PDFs are on disk as reference
  (`Tadiran-Swift-ServiceManual.pdf`, `Klil-7000-Magic.pdf`) — **not embedded**. Every generated object
  carries `metadata.originalGeometry: true` with a QA gate that fails un-provenanced sources.

### 7. Fonts — **CLEAN**
- Embedded fonts are **only Heebo + Poppins**, fetched from Google Fonts (SIL Open Font License, free for
  commercial embedding) — see `converter/src/assets/build_fonts.js` and `fonts_embedded.css`.
- DXF text uses standard `arial.ttf` **by name reference only** (a font-name reference is not
  infringement). **No `*_sy.shx`** anywhere in the tree.

### 8. IP-protection module (`ip-protection/`) — **CLEAN** (defensive + disclosed)
- `LEGAL_DISCLOSURE.md` establishes it as **self-protection** (watermark/license-key category): Soline
  fingerprints **its own** exported files with **pseudonymous** identifiers; explicit absolute
  prohibitions on **covert third-party surveillance**, hidden collection, personal data in tokens, and
  CAPTCHA/credential capture.
- `fingerprint.js` contains **no network/http/fetch/beacon code** — the mark is passive/offline by
  default. The telemetry beacon is a **separate, OFF-by-default, disclosure-gated** feature: config
  ships `beacon.url:""`, `disclosedInLicense:false`, and `standard` tier has `telemetryAllowed:false`.
- **[LAWYER]** Before enabling the beacon or finalizing license clauses, confirm wording under Israeli
  Privacy Protection Law (Amendment 13) and GDPR if any EU data. The module already flags this.

### 9. Location feature — **CLEAN** (consent-based / transparent, not the old hidden GPS)
- `AndroidManifest.xml` documents it as **opt-in only** ("נאסף אך-ורק לאחר OPT-IN מפורש"), gated behind
  `LocationConsentScreen`. Permission is requested **in-context** (only after "I agree"), not at launch.
- Code confirms transparency: `OpsMetricsService.kt` — *"אין איסוף-נסתר"* (no hidden collection); a
  persistent off-switch in Settings and a "My Activity" screen; framework `LocationManager` only (no
  Google Play Services / no third-party SDK). This is the **new consent-by-design** design.
- **[LAWYER]** The consent copy is self-described as a **draft** ("טיוטה-ראשונית … מחייב בדיקת עו"ד").
  The wording needs attorney sign-off before release — flagged in the code itself.

---

## Overall assessment — "Is the owner exposed anywhere?"

**No embedded-IP exposure in the shipping product.** The strongest evidence: the exported DXFs carry
**zero** vendor identifiers, all shipped symbol/report geometry is original or CC0, fonts are OFL, and
every source is governed by a written provenance discipline with a QA gate.

Residual, manageable risk lives in three places, none of which is current infringement:

| Area | Nature of risk | Action |
|---|---|---|
| Location consent wording | Privacy-law compliance (IL Amendment 13 / GDPR) | **[LAWYER]** sign-off before release (already flagged in code) |
| IP telemetry beacon | Privacy-law if ever enabled | Keep OFF until disclosed + **[LAWYER]** clauses (already gated) |
| CVSM reverse-engineering | Possible EULA conflict from studying `com.roommeasure.app` | **[LAWYER]** glance at EULA; keep CVSM/RoomMeasure out of user-facing strings; feature-cloning itself is lawful |
| Reference files on disk | Redistribution if repo/build is published | Exclude `research/**` (non-CC0), `ops/docs/cvsm_reference/**` and manufacturer PDFs from any public repo/shipped artifact; only the GSStnb CC0 set may be shipped |
| Folder naming | Cosmetic/appearance | Rename `cvsm_reference/cvsm_html_export/` (it actually holds Soline's own template) |

## Recommended remediation (all low-effort)
1. **[LAWYER]** Location consent text + IP telemetry/license clauses (IL privacy + GDPR); confirm CVSM EULA.
2. Add a publish/build exclusion for non-CC0 reference material (`converter/research/manufacturer-blocks/**`
   binaries, `ops/docs/cvsm_reference/**`, manufacturer PDFs) so it can never leave the private workspace.
3. Re-confirm the live GSStnb `LICENSE` = CC0 and record the commit hash in `metadata.sources[]` (the
   discipline docs already require this).
4. Rename the misleading `cvsm_reference/cvsm_html_export/` folder; keep vendor names in **comments/docs
   only**, never in exported/user-facing strings.

*Audit performed read-only. No files were modified except the creation of this report.*
