# ספריית-חומרים — עולם-המטבח (Materials Library)

מסמך-מלווה ל-`MaterialLibrary.kt` (package `il.co.soline.measure.catalog`).
ספרייה של **צבעים + טקסטורות** לחומרי-מטבח עדכניים (2024–2025), המזינה שני צרכנים:

1. **בחירת-גימור בשטח** — בורר-חומרים למודד (חזיתות / שיש / קירות / רצפות / מתכת).
2. **מנוע-ההדמיה offline** — כל חומר נושא **תיאור-טקסטורה פרוצדורלי** כדי שהרנדרר
   יצייר אותו בלי תמונות (procedural, no photos).

הקובץ עצמאי מ-`ElementCatalog.kt` — שמות ציבוריים ייחודיים
(`MaterialCatalog` / `Material` / `TextureKind` / `MaterialCategory`), ללא התנגשות.

**מוסכמות ערכים:** `colorHex`/`accentHex` = `0xFFRRGGBB`. `scaleMm` = גודל-התבנית במ"מ
(גרעין-עץ / רוחב-וריד / מודול-אריח / צפיפות-ניקוד); 0 = לא-רלוונטי. `glossy` = מבריק מול מט.

**סיכום כמותי:** 71 חומרים —
חזיתות 20 · שיש 22 (Dekton 8 · Sensa 6 · Caesarstone 8) · קירות 13 · רצפות 10 · מתכת 6.

---

## טבלה מלאה

### חזיתות (`FRONTS`) — 20

| key | he | קו/מוצר | hex | texture | הערות |
|---|---|---|---|---|---|
| FRONT_WHITE_GLOSS | לבן מבריק | לכה | `F7F6F2` | SOLID | glossy |
| FRONT_WHITE_MATTE | לבן מט | — | `F1EFEA` | SOLID | |
| FRONT_CREAM | שמנת (אוף-וויט) | — | `EDE7D9` | SOLID | |
| FRONT_LIGHT_GREY | אפור בהיר | — | `C9C7C1` | SOLID | |
| FRONT_MID_GREY | אפור אמצע | — | `8E8C87` | SOLID | |
| FRONT_ANTHRACITE | אנתרציט | — | `3C3D3F` | SOLID | |
| FRONT_BLACK_MATTE | שחור מט | — | `1E1E1E` | SOLID | טרנד-2025 |
| FRONT_SAGE | סייג' ירוק | — | `9CA588` | SOLID | טרנד-2025 |
| FRONT_NAVY | כחול נייבי | — | `2B3A55` | SOLID | טרנד-2025 |
| FRONT_TAUPE | טאופ / חול | — | `C3B39B` | SOLID | טרנד-2025 |
| FRONT_OLIVE | ירוק זית | — | `6B6B47` | SOLID | טרנד-2025 |
| FRONT_BURGUNDY | בורדו | — | `6E2B34` | SOLID | טרנד-2025 |
| FRONT_DUSTY_BLUE | כחול-אבק | — | `8394A0` | SOLID | |
| FRONT_TERRACOTTA | טרקוטה | — | `B56A4A` | SOLID | |
| FRONT_LINEN | פשתן (חזית-בד) | — | `D9D0BE` | LINEN | scale 2 |
| FRONT_OAK_NATURAL | אלון טבעי | דמוי-עץ | `C9A876` | WOOD | grain 28 |
| FRONT_OAK_WHITE | אלון מולבן | דמוי-עץ | `DCCFB8` | WOOD | grain 28 |
| FRONT_WALNUT | אגוז | דמוי-עץ | `6E4A2E` | WOOD | grain 24 |
| FRONT_GREY_WOOD | אפור-עץ | דמוי-עץ | `9A928A` | WOOD | grain 26 |
| FRONT_OAK_GLOSS | אלון טבעי מבריק | דמוי-עץ | `CBA97A` | WOOD | glossy, grain 28 |

### שיש ומשטחי-עבודה (`COUNTERTOP`) — 22

| key | he | קו/מוצר | hex | texture | הערות |
|---|---|---|---|---|---|
| DEKTON_KELYA | דקטון Kelya | Dekton | `2E2A28` | MARBLE_VEIN | כהה עם ורידי-נחושת `B08D57` |
| DEKTON_SIRIUS | דקטון Sirius | Dekton | `1C1C1E` | CONCRETE | אנתרציט-שחור אחיד |
| DEKTON_AURA15 | דקטון Aura 15 | Dekton | `F2EFE9` | MARBLE_VEIN | לבן-חם דמוי-Calacatta, ורידים אפורים |
| DEKTON_LAURENT | דקטון Laurent | Dekton | `231F1D` | MARBLE_VEIN | שחור דמוי-Marquina, ורידי-זהב `C9A24B` |
| DEKTON_BERGEN | דקטון Bergen | Dekton | `9D9A94` | CONCRETE | אפור-בטון |
| DEKTON_KRETA | דקטון Kreta | Dekton | `8C8A85` | CONCRETE | אפור-מלט |
| DEKTON_TRILIUM | דקטון Trilium | Dekton | `3A3B3D` | GRANITE_SPECKLE | תעשייתי-ממוחזר, ניקוד עדין |
| DEKTON_DOMOOS | דקטון Domoos | Dekton | `A8A6A0` | CONCRETE | אפור-מלט רך |
| SENSA_TAJ_MAHAL | סנסה Taj Mahal | Sensa | `E8DFCF` | MARBLE_VEIN | קווארציט קרם-חם |
| SENSA_COLONIAL_WHITE | סנסה Colonial White | Sensa | `DDD9D0` | GRANITE_SPECKLE | גרניט בהיר, ניקוד בורדו `8B6F6A` |
| SENSA_BLACK_BEAUTY | סנסה Black Beauty | Sensa | `201F1D` | GRANITE_SPECKLE | גרניט-שחור מנוקד, glossy |
| SENSA_WHITE_SILK | סנסה White Silk | Sensa | `EDE7DA` | MARBLE_VEIN | לבן-שמנת עם ורידים רכים |
| SENSA_ARIEL | סנסה Ariel | Sensa | `6E6C68` | GRANITE_SPECKLE | גרניט אפור-כהה |
| SENSA_INDIAN_BLACK | סנסה Indian Black | Sensa | `2A2926` | GRANITE_SPECKLE | שחור-גרניט, glossy |
| CAESAR_CALACATTA_NUVO | קיסר Calacatta Nuvo 5131 | Caesarstone | `F3EFE8` | MARBLE_VEIN | לבן-חם, ורידים אפורים רחבים |
| CAESAR_VANILLA_NOIR | קיסר Vanilla Noir 5100 | Caesarstone | `201E1B` | MARBLE_VEIN | שחור עם ורידים לבנים `E8E4DA` |
| CAESAR_LONDON_GREY | קיסר London Grey 5000 | Caesarstone | `CFCBC2` | MARBLE_VEIN | אפור-בהיר עם ורידים רכים |
| CAESAR_FROSTY_CARRINA | קיסר Frosty Carrina 5141 | Caesarstone | `EFEDE6` | MARBLE_VEIN | דמוי-קררה לבן |
| CAESAR_CLOUDBURST_CONCRETE | קיסר Cloudburst Concrete 4011 | Caesarstone | `8E8B85` | CONCRETE | אפור-בטון אמצע |
| CAESAR_FRESH_CONCRETE | קיסר Fresh Concrete 4001 | Caesarstone | `B9B5AD` | CONCRETE | בטון בהיר |
| CAESAR_PURE_WHITE | קיסר Pure White 1141 | Caesarstone | `F6F5F1` | SOLID | לבן-נקי, glossy |
| CAESAR_RAVEN | קיסר Raven 4120 | Caesarstone | `35342F` | CONCRETE | פחם-כהה עם תנועה עדינה |

### קירות (`WALLS`) — 13

| key | he | קו/מוצר | hex | texture | הערות |
|---|---|---|---|---|---|
| WALL_WHITE | לבן קיר | צבע | `F3F1EC` | SOLID | |
| WALL_GREIGE | אפור-בז' חם (Greige) | צבע | `D8CFC2` | SOLID | |
| WALL_SAGE | מרווה קיר | צבע | `A7AE97` | SOLID | |
| WALL_TERRACOTTA | טרקוטה קיר | צבע | `B56A4A` | SOLID | |
| WALL_POWDER_BLUE | כחול-אבקה | צבע | `B7C4CC` | SOLID | |
| WALL_CHARCOAL | פחם (קיר-דגש) | צבע | `3A3B3D` | SOLID | |
| WALL_MICROCEMENT | מיקרו-בטון | ציפוי | `B9B4AC` | CONCRETE | scale 400 |
| WALL_STONE_JERUSALEM | חיפוי אבן-ירושלים | אבן | `D8C9AC` | GRANITE_SPECKLE | ניקוד גס |
| WALL_SUBWAY_WHITE | אריח מטרו לבן | קרמיקה | `F2F0EA` | TILE_GRID | 75מ"מ, glossy |
| WALL_HEX_SAGE | קרמיקה משושה מרווה | קרמיקה | `A9B199` | TILE_GRID | משושה 100מ"מ |
| WALL_MARBLE_SLAB | חיפוי דמוי-שיש | קרמיקה | `ECE8DF` | MARBLE_VEIN | לוח-גדול, glossy |
| WALL_BRICK_RED | לבנים חשופות | לבנים | `A5563F` | TILE_GRID | לבנה 210מ"מ |
| WALL_BRICK_WHITE | לבנים לבנות | לבנים | `DAD3C8` | TILE_GRID | לבנה 210מ"מ |

### רצפות (`FLOORS`) — 10

| key | he | קו/מוצר | hex | texture | הערות |
|---|---|---|---|---|---|
| FLOOR_WOOD_PORCELAIN | פורצלן דמוי-עץ | פורצלן | `B9946A` | WOOD | plank 200 |
| FLOOR_OAK_PARQUET | פרקט אלון | עץ | `B07E4E` | WOOD | glossy, plank 190 |
| FLOOR_STONE_LOOK | פורצלן דמוי-אבן | פורצלן | `C7C1B4` | MARBLE_VEIN | |
| FLOOR_MARBLE_LOOK | פורצלן דמוי-שיש | פורצלן | `ECE8DF` | MARBLE_VEIN | glossy |
| FLOOR_CONCRETE_LOOK | פורצלן דמוי-בטון | פורצלן | `9C9992` | CONCRETE | |
| FLOOR_TERRAZZO_LIGHT | טרצו בהיר | טרצו | `E3DED2` | TERRAZZO | chips 14 |
| FLOOR_TERRAZZO_DARK | טרצו כהה | טרצו | `4B4A46` | TERRAZZO | chips 14 |
| FLOOR_GRANITO | גרניט-פורצלן (Granito) | פורצלן | `8E8A82` | GRANITE_SPECKLE | glossy |
| FLOOR_TRAVERTINE | טרוורטין | אבן-טבעית | `D9C9AE` | MARBLE_VEIN | |
| FLOOR_GREY_WOOD | פורצלן דמוי-עץ אפור | פורצלן | `A69E93` | WOOD | plank 200 |

### מתכת ונירוסטה (`METAL`) — 6

| key | he | קו/מוצר | hex | texture | הערות |
|---|---|---|---|---|---|
| METAL_STEEL_BRUSHED | נירוסטה מוברשת | נירוסטה | `B8B8BA` | METAL_BRUSH | מטבח-חוץ |
| METAL_STEEL_POLISHED | נירוסטה מבריקה | נירוסטה | `CED0D2` | METAL_BRUSH | glossy |
| METAL_BLACK_ALU | אלומיניום שחור | אלומיניום | `3A3A3C` | METAL_BRUSH | |
| METAL_BRASS_BRUSHED | פליז מוברש | פליז | `B59A5E` | METAL_BRUSH | דגש-עיצוב |
| METAL_COPPER | נחושת | נחושת | `A86B4B` | METAL_BRUSH | glossy |
| METAL_GUNMETAL | גונמטאל (אפור-פחם) | מתכת | `54565A` | METAL_BRUSH | |

---

## איך הרנדרר מצייר כל `TextureKind` (offline, פרוצדורלי)

הרעיון: אין תמונות. הרנדרר מקבל `colorHex`, `accentHex`, `scaleMm`, `glossy` ומרכיב את
המרקם על-גבי המשטח (`scaleMm` ממופה מ-מ"מ-עולם ל-פיקסלים לפי קנה-המידה הנוכחי).

| TextureKind | אלגוריתם-ציור מוצע |
|---|---|
| **SOLID** | מילוי-אחיד ב-`colorHex`. אם `glossy` — הוסף גראדינט-הבהרה עדין (spec highlight) בפינה עליונה. |
| **WOOD** | פסי-גרעין מכוונים לאורך המודול: מודולציית-`accentHex` בגלי-Perlin 1D בתדר `scaleMm` (רוחב-פס ≈ scale), + סיבים-דקים אקראיים. glossy = ורניש מבריק. |
| **MARBLE_VEIN** | רקע `colorHex`; ורידים = עקומות-Perlin/turbulence ב-`accentHex` בעובי משתנה, מרווח אופייני `scaleMm`. glossy = השתקפות-ליטוש. |
| **GRANITE_SPECKLE** | רקע `colorHex` + פיזור-נקודות צפוף (stochastic dots) בגוונים סביב `accentHex`, קוטר-נקודה ≈ `scaleMm`. |
| **TERRAZZO** | רקע-מלט `colorHex` + שברי-אבן פוליגונליים בגדלים משתנים (~`scaleMm`) בכמה גוונים נגזרים מ-`accentHex`. |
| **TILE_GRID** | חלוקה לרשת-אריחים במודול `scaleMm` (מלבן/משושה — ראה הערות), אריח ב-`colorHex`, פוגות ב-`accentHex`. glossy = ברק-קרמיקה. |
| **CONCRETE** | רקע `colorHex` + כתמי-ענן רכים (low-freq Perlin) ב-`accentHex`, ללא כיווניות, קנה-מידה גס `scaleMm`. |
| **LINEN** | שתי-וערב עדין: אריגה מוצלבת ב-`accentHex` בתדר `scaleMm` (בד/פשתן). מט תמיד. |
| **METAL_BRUSH** | פסי-הברשה אנכיים דקים (anisotropic) סביב `colorHex`↔`accentHex`, תדר `scaleMm`; glossy = highlight חד ונע. |

**כללי-glossy כלליים:** כאשר `glossy=true` הרנדרר מוסיף שכבת-spec (Blinn-Phong פשוט /
gradient-highlight) מעל המרקם; אחרת המשטח מט (diffuse-only). ה-`scaleMm` תמיד ב-מ"מ-עולם
כדי שהתבנית תישאר בקנה-מידה נכון בזום/הדמיה.

---

## חיווט-בורר (לאינטגרטור)

הקובץ הוא **DATA בלבד** — לא נגע ב-UI. כדי לחשוף בחירת-גימור נדרש (בקובץ אחר, לא כאן):

- **מקור-הבורר:** `MaterialCatalog.byCategory` → רשימת-`Pair<קטגוריה, List<Material>>`
  בסדר `MaterialCategory.order`. לכל צ'יפ: רקע `Color(colorHex)`, תווית `he`.
- **שמירה:** לאחסן את `Material.key` על האלמנט/המשטח הנבחר (מחרוזת יציבה). שחזור עם
  `MaterialCatalog.of(key)`.
- **הדמיה:** מנוע-ה-3D/הדמיה קורא `texture`/`accentHex`/`scaleMm`/`glossy` לציור פרוצדורלי.
- **הצעת-שיוך:** חזיתות→חזיתות-ארונות · COUNTERTOP→משטח-עבודה · WALLS→קירות-חדר ·
  FLOORS→רצפת-חדר · METAL→גופי-מטבח-חוץ.

מומלץ Composable ייעודי (למשל `MaterialPickerSheet`) במקביל ל-`ElementPickerSheet` הקיים.
