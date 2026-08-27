# Soline Measure — UI Audit & Theme Upgrade

**Date:** 2026-08-20
**Scope of this pass:** `ui/Theme.kt` only (design-token level). All screens, `AppUi.kt`, and components are owned by other agents and were **not** edited. This document lists the screen-level upgrades the integrator should apply so the new tokens actually propagate.

---

## 1. What changed in Theme.kt (token-level, safe)

### Token VALUES changed
**None.** Every original brand/state hex was kept byte-for-byte to preserve the brand and avoid surprising existing screens:

| Token | Value (unchanged) |
|---|---|
| `Orange` | `#F49A1A` |
| `Teal` | `#1596A8` |
| `Cream` | `#FBF4E6` |
| `Ink` | `#2B2B2B` |
| `Muted` | `#6B7280` |
| `BlockRed` / `BlockRedBg` | `#E5484D` / `#FDECEC` |
| `WarnAmber` / `WarnAmberBg` | `#C47A04` / `#FDF3E0` |
| `OkGreen` | `#12805C` |

All 10 original token names are still present. Verified against the compile-critical list.

### Tokens ADDED (new `val`s — nothing removed)
- Orange family: `OrangeDark #C9780A`, `OrangeLight #F7B24E`, `OrangeBg #FDEFD8`, `OnOrangeBg #7A4A00`
- Teal family: `TealDark #0E6E7C`, `TealLight #4FB5C4`, `TealBg #E1F1F3`, `OnTealBg #07434B`
- State/info: `OkGreenBg #E3F3EC` (completes the `*Bg` pattern), `Info #2563A8`, `InfoBg #E8F0FA`
- Surfaces/borders: `Surface #FFFFFF`, `SurfaceVariant #F4EEDF`, `SurfaceSunken #F1E9D6`, `Border #E7DFCC`, `BorderStrong #D8CEB6`, `Divider #EDE6D5`, `Scrim 0x99000000`
- Text: `InkSoft #4A4A4A`, `OnDark #FFFFFF`

### Material3 theme strengthened
- **`colorScheme`**: full mapping — `primary=Orange`, `primaryContainer=OrangeBg`, `secondary=Teal`, `secondaryContainer=TealBg`, `tertiary=OkGreen`, `surfaceVariant`, `outline`, `error/errorContainer`, `scrim`, and accessible `on*` pairs.
- **`Typography` (`SolineTypography`)**: full Material3 role scale (display/headline/title/body/label), system font family (renders Hebrew, RTL-safe), `letterSpacing = 0` on headings so Hebrew isn't stretched, sensible `lineHeight` throughout.
- **`Shapes` (`SolineShapes`)**: `extraSmall 6 / small 10 / medium 14 / large 20 / extraLarge 28`dp — consolidates the ad-hoc 4/10/12/14/16 radii found across screens.

### Safety note (why nothing breaks)
New tokens include common names (`Surface`, `Divider`, `Info`). This is safe because **every screen imports tokens explicitly by name** (`import il.co.soline.measure.ui.Orange`, etc.) — there are no wildcard imports of the `ui` package — and the two files sharing Theme.kt's exact package (`AppUi.kt`, `DevicesScreen.kt`) do not reference any of the new identifiers. Confirmed by grep.

---

## 2. Palette accessibility — before/after rationale

- **White-on-Orange fails WCAG.** `Orange #F49A1A` fill with white text is ~2.3:1 (below the 3:1 large-text floor). Kept for brand CTAs, but **for orange *text/icons on light backgrounds* use the new `OrangeDark #C9780A`**, and for tinted panels use `OrangeBg` + `OnOrangeBg` (~7:1).
- **Teal text on white** (`#1596A8`) is ~3.4:1 — OK for large, fails normal body. Use new **`TealDark #0E6E7C`** for small teal text/labels.
- **Layering:** screens currently paint white cards directly on `Cream`. `SurfaceVariant`/`SurfaceSunken`/`Border` give a real three-level hierarchy (cream bg → surface card → sunken field) instead of flat white-on-cream.

---

## 3. Top 5 screen-level UI upgrades (integrator to apply)

1. **Adopt the type scale instead of hardcoded `fontSize`.** ~200 `fontSize = N.sp` literals across `VerificationScreen`, `CadDimensionEditor`, `HomeScreen`, `AppUi`, etc. Replace with `style = MaterialTheme.typography.*` (e.g. screen title → `headlineSmall`, card title → `titleMedium`, body → `bodyMedium`, captions → `labelSmall`). This is the single biggest cohesion win — sizes currently drift 10/11/12/13/14/15/16/17/18/20/22/26/30/40sp with no system.

2. **Consolidate corner radii via `MaterialTheme.shapes`.** Cards/sheets mix 4/10/12/14/16dp. Standardize: fields & chips → `shapes.small` (10), cards & buttons → `shapes.medium` (14), bottom sheets & dialogs → `shapes.large` (20). Pill buttons keep `RoundedCornerShape(50)`.

3. **Fix white-on-orange contrast + unify button styling.** In `HomeScreen.QuickActions` and everywhere a filled `Orange` button uses `Color.White` text, the ratio fails AA. Either keep white but reserve orange fills for large/bold labels only, or drive buttons from `colorScheme.primary`/`onPrimary`. Outlined "secondary" actions (project, devices) should use `secondary`/`OutlinedButton` with `TealDark` content, not raw `Teal`, for legible labels.

4. **Give list/summary cards a consistent 1dp border + surface.** Cards across `DevicesScreen`, `CabinetScreen`, `VerificationScreen`, `HomeScreen` are white-on-cream with no delineation. Apply `Surface` fill + `1.dp` `Border` + `shapes.medium` so cards read as discrete objects and gain quiet elevation without heavy shadows.

5. **Adopt the `*Bg`/`On*Bg` state pairs for status UI.** Status chips and result banners hand-roll tints (e.g. `OkGreen.copy(alpha=0.10f)` in `HomeScreen.DeviceStatusChip`, ad-hoc `Color(0xFFF0F0F0)`). Swap to the token pairs — `OkGreenBg`, `WarnAmberBg`, `BlockRedBg`, `InfoBg` — with matching `OkGreen`/`WarnAmber`/`BlockRed`/`Info` text, so success/warning/error/info states are visually consistent app-wide.

### Secondary follow-ups (lower priority)
- Replace ad-hoc greys (`Color(0xFFF0F0F0)`) with `SurfaceVariant`/`Border`.
- Use `Scrim` behind modal sheets/dialogs for a consistent dim.
- `Divider` token for section separators instead of per-screen line colors.
- Consider a shared `SolineCard`/`SolineButton` in `components/SolineComponents.kt` that bakes in surface+border+shape so screens stop re-declaring them.
