# CVSM_5.6_UPDATE — דלתא 5.4.0 → 5.6.0 (מה חדש, ולמה זה חשוב ל־Soline)

> **חבילה:** `com.roommeasure.app` · **versionName 5.6.0** · **versionCode 5600** · lastUpdate 2026-08-18 · minSdk 26 · targetSdk 35.
> נכתב עבור Michael, לשון זכר. תאריך: **2026-08-18**. מקור: פירוק `cvsm-5.6.0.apk` (16 dex) + `assets/guide/guide_he.html` + `assets/html_export/app.js`.
> משלים את `CVSM_ELEMENT_SCHEMA.md` (סכימת האלמנטים + ORDX). הבסיס הקודם: `CVSM_FEATURES.md`, `CVSM_EXPORT_CRACK.md` (גרסה 5.4.0).

---

## 0. תקציר
5.6.0 היא קפיצת־בשלות של שכבת ה־**CAD וה־ייצוא**: מנוע **מידות מדורגות** (`DimTierEngine`), **ספריית סמלי־CAD** מסודרת (`CadSymbol`/`CadSymbolKeys`), **פתרון־מידות מקבילות** (`CadDimensionGeometry`), ו**שני מייצאים חדשים בתוך האפליקציה** — `HtmlExporter` (דוח־HTML אינטראקטיבי) ו־`PdfExporter` מדור־חדש עם `PdfSymbolRenderer`. בנוסף המודל התרחב עם **ארונות מלאים** (Assembly), **צורות־קיר מסריקה** (`ShapeSolver`), ו**תבניות־חדר**. המדריך הפנימי (`guide_he.html`) מתויג במפורש **"גרסה 5.6.0 · מבוסס על המסכים הפעילים בפועל"**.

---

## 1. מחלקות־מודל חדשות/מורחבות [חדש]

### CAD ומידות
- **`export/DimTierEngine`** (+`DimTier`,`DimSide`,`TierDim`,`PlacedTierDim`,`TierLayoutResult`) [חדש] — מנוע פריסת **מידות מדורגות (tiers)**: `detail` (פרטני) → `spans` (טווחים) → `total` (כולל), עם `dedup` (הסרת כפילויות) ו־`allocateTier`. *למה חשוב:* זהו הלב של פריסת קווי־המידה ב־ORDX/PDF/HTML — כדי ש־Soline יפיק שרטוטים בדרג־מקצועי צריך לשכפל את הלוגיקה הזו.
- **`model/CadDimensionGeometry`** (+`CadDimensionLine/Solved/Outcome/Error`,`DimensionReference`) [חדש] — **פותר** מידות־CAD מקבילות לקיר (`solveAll`), כולל טיפול בקווים "לא־פתירים". *למה:* מאפשר מידות מדויקות בכל זווית; קלט ישיר לגנרטור ה־DXF-2D שלנו.
- **`model/CadSymbol` + `CadSymbolKeys`** (+`CadTextNote`,`CadElevationLine`,`CadPlanFreeLine`) [חדש] — **ספריית סמלים** מסודרת: כל סמל = אוסף פרימיטיבים מסוריאליזים (line/rect/ellipse/arc/poly/label) בקופסת־יחידה, מרונדר ב־plan ובחזית (ראה `app.js renderSymbol`). *למה:* סטנדרט־Soline לסמלי־מטבח (שקע/ברז/מזגן) — פורמט מוכן להעתקה.
- **`model/DimChainStyleSettings` + `DimTierStyle`** [חדש] — צבע/עובי/הפעלה per-tier (detail/spans/total), נאפים לתוך הייצוא. *למה:* מיתוג ויזואלי אחיד לשרטוטי־לקוח.
- **`model/CadViewType`** [חדש] — plan מול elevation לאלמנטי־CAD.

### פריסה ושכבות
- **`model/LayoutSettings`** (+`LayoutLayer`,`LayoutPreset`,`LayoutView`,`ViewLayoutSettings`,`LayerSettings`) [חדש] — **פריסטים ושכבות** (הצג/הסתר ארונות/פתחים/הערות/סמלים, סינון לפי־שם). *למה:* מסך "הגדרות פריסה" שסימנו כ"חסר לנו" — כאן המודל המדויק.

### מדידה תלת־ממדית וצורות
- **`model/ShapeSolver`** (+`ShapeTemplate`,`ShapeSegment`,`ShapePoint`,`ShapeAxis`,`ShapeTemplateType`,`TemplateWall`,`RoomShapeTemplates`) [חדש] — **לכידת־צורה** מסריקת Leica ותבניות־חדר (מלבן/L/U/T/Z). *למה:* אשף־תבניות + סריקת־חדר שאין לנו.
- **`model/Survey2D` / `Measurement2D` / `ScanPoint3D`** [חדש] — מבני־מדידה גולמיים (עוגנים, נקודות־סריקה). *למה:* בסיס לטרילטרציה/יישור.
- **`model/HeightBands` + `HeightBandReading`** [חדש] — **מדידת קיר ב־3 גבהים** (רצועות־גובה); מרונדר בחזית כקווים מקווקווים (`app.js wall.bands`). *למה:* קירות לא־ישרים/מעוותים.
- **`model/WallCorner` / `WallCornerAngles`** [חדש] — זוויות־פינה מחושבות (callouts "corner-angle"). *למה:* דיוק זוויות ב־ORDX ובשרטוט.
- **`model/OriginPoint`** [חדש] — **נקודות־מוצא מרובות** למדידה. *למה:* מיפוי מדידות ממספר עמדות.

### ארונות (Assembly) — מלא
- **`model/Cabinet`,`CabinetType`(19),`CabinetClass`(5),`CabinetDefaults`,`CabinetTypeDefaults`,`CornerCabinetShape`,`FaceType`(6),`DoorSwing`,`DoorHingeSide`,`DoorSwingSide`,`HingeSide`(3)** [חדש] — מודל־ארונות מלא + פליטת `<Assembly>` ל־ORDX (ראה `CVSM_ELEMENT_SCHEMA.md §5`). *למה:* Cabinet Vision מבוסס־ארונות; זה מה שהופך אותנו מ"קירות בלבד" לפתרון־מטבח.

### קיר ופתחים
- **`model/WallTopStyle`** = STANDARD/PENINSULA/CATHEDRAL/VAULT_LEFT/VAULT_RIGHT [חדש בסכימה] — כתוב ל־ORDX כ־`<Style>` + `VaultHeight`/`VaultPosition`. *למה:* גמלונים/משופעים בייצוא.
- **`model/WidthInputMode`** = LEFT_RIGHT / WIDTH_POSITION; **`AccessoryType`** מורחב עם `DISHWASHER_45`, `AIR_CONDITION`(+SLOT params), `WATER_BAR`, `DOORWAY_WITH_FRAME`, 4×`DOOR_HINGED_*`. *למה:* אלמנטים ריאליים למטבח ישראלי.
- **`model/FavoriteDevice`** [חדש] — מכשירי־BLE שמורים ("תן שם/נקה"). *למה:* UX חיבור־חומרה.

---

## 2. יכולות־ייצוא חדשות [חדש]

| מייצא | מחלקה | חדש ב־5.6 | למה חשוב ל־Soline |
|---|---|---|---|
| **HTML אינטראקטיבי (בתוך האפליקציה)** | `export/HtmlExporter` + `assets/html_export/app.js` (64KB) | [חדש] — קודם רק בדסקטופ bravh | דוח־לקוח RTL עם plan/elevation/**3D אמיתי** (renderer קנבס), טבלאות, שכבות. תבנית מלאה לחיקוי ב־`src/export_html.js` |
| **PDF מדור־חדש** | `export/PdfExporter` + `PdfSymbolRenderer` + `DimTierEngine` | [חדש] — מידות מדורגות, סמלי־CAD, cover/plan/elevation | דוח־הדפסה מקצועי; `SheetKind`, `TierInks`, `PlanWall` — מבנה לחיקוי |
| **ORDX — Assembly של ארונות** | `OrdxExporter.generateCabinetAssembly` | [חדש] — פליטת `<Assembly>` (Sections/Faces/Door/Drawer/Split) | ORDX שלנו מפיל היום `cabinets[]`; כאן המבנה המלא לפליטה |
| **ORDX — WallShape מסריקה** | `generateWallShapeAssembly` (params `MASHL/MASHR/MASHT`) | [חדש] | צורות־קיר מותאמות מ־Leica → ORDX |

**Catalog:** ב־5.6 כל ישות ORDX נושאת `<Catalog>WEB-App</Catalog>` [dex] (היה שונה בגרסאות/כלים קודמים). שני מצבי־ייצוא נשמרים (Single-Room / Room-by-Room).

---

## 3. חדש ב־guide_he.html (מדריך פנימי) [חדש]
המדריך המובנה מתויג **"גרסה 5.6.0 · מבוסס על המסכים הפעילים בפועל"** ומוסיף מקטעים שלא היו במיפוי 5.4.0:
- **CAD — מצב תוכנית:** מידת־CAD מקבילה לקיר · נקודה־לנקודה · עריכת־מידה · **הערות טקסט CAD** · **סמלי CAD** · **נראות לפי סוג**. *למה:* מנוע ה־CAD המלא (DimTier+CadSymbol) חשוף למשתמש.
- **מצב חזית:** **מתג המידות האוטומטיות וסגנונן** (=`DimChainStyleSettings`/tiers) · **תצוגת שכבות** · מדידה רציפה · **לכידת צורת קיר** · כרטיס־מידע־קיר.
- **הגדרות:** **עורך קטלוג** · **ברירות מחדל לסמלים** · **הערות וסמלי CAD — ברירות מחדל** · **קווי מידה** · **שיטת חיבור T**.
- **קירות:** **יישור אופקי/אנכי** · **חיבור T ושיטתו** · **יישור חדר לציר** · **העתק+הזז קיר** · **סגנון ראש קיר** · **אשף תבניות חדר** · **נעילת 90°** · **יצירת קירות בלייזר תלת־ממד**.
- **שיטות מדידה:** **מדידה משולשת ×3 ומדידת 3 גבהים** (=HeightBands) · P2P (Leica X6).
- מורשת: "גרסה 5.3.1: הטקסט ב־PDF תמיד תואם לשפת האפליקציה".

---

## 4. מה זה אומר לתוכנית של Soline (עדיפויות שהתעדכנו)
1. **DimTierEngine הוא הפריט הקריטי החדש** — בלי פריסת־מידות מדורגת אין שרטוט מקצועי; לשכפל את `detail→spans→total`+`dedup` (יש לנו את הלוגיקה המלאה ב־`app.js`).
2. **CadSymbol/CadSymbolKeys** — לאמץ את פורמט־הפרימיטיבים המסוריאליזי (unit-box) כסטנדרט־הסמלים של `.sol`.
3. **Cabinet Assembly ב־ORDX** — להוסיף פליטת `<Assembly>` (המבנה ב־`CVSM_ELEMENT_SCHEMA.md §5`) כדי שארונות יעברו ל־Raumplan.
4. **HtmlExporter** — `assets/html_export/app.js` הוא רפרנס־זהב לדוח־לקוח שלנו (RTL, 3D, שכבות) — מבוסס על אותה ארכיטקטורת־נתונים־יחידה שכבר יש לנו.
5. **פערי־דיסאסמבלי:** מקדמי ברירות־המחדל (CabinetDefaults) וטבלאות `getOrdx*` דורשים baksmali/androguard בסביבה עם python אמיתי — ראה `CVSM_ELEMENT_SCHEMA.md §7`.

> READ-ONLY על ה־APK/dex/corpus. לא נגעתי בקוד־מקור. שני קבצי־md אלה בלבד נכתבו.
