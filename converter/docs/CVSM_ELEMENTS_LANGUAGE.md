# CVSM_ELEMENTS_LANGUAGE — שפת-האלמנטים של CVSM והרפליקציה של Soline

> **מטרה:** ללמוד כיצד CVSM (`com.roommeasure.app`, v5.9) **מגדיר ומקודד את האלמנטים** שלו — הן את
> ה־3D CAD template (חבילת Cabinet Vision) והן את **סמל־ה־2D** שהוא מצייר בדו״ח — ולבנות מזה מערכת
> סמלים איכותית ל־Soline. הבעיה שהוזמנה: "האלמנטים המיוצאים לא נראים טוב". השורש: ה־DXF/PDF החזיקו
> ~8 גליפים גסים בלבד, וכל השאר נפלו לתיבה/CONTROLBOX. הפתרון: `src/element_symbols_soline.js` —
> 172 סמלים איכותיים בשפת־הסמל של CVSM, המכסים את כל 170 האלמנטים בקטלוג + כל 84 שמות אפליקציית־המדידה.
>
> נכתב עבור Michael, לשון זכר, יחידות מ״מ. תאריך 2026-08-21. כל הראיות הבינאריות מתוך
> `קבצים ללמידת מכונה/Measuring Elements/Measuring Elements.pkg`.

---

## 0. תקציר מנהלים — מהי "שפת האלמנטים" של CVSM

CVSM אינו ממציא פורמט; הוא **מארח את מנוע־התוכן של Cabinet Vision (Hexagon/Planit)**. אלמנט =
שני דברים נפרדים:

1. **הגדרת־עצם 3D** — נשמרת בחבילת `CV Setup Unicode Package V4.0` (הקובץ `.pkg`, שהוא ZIP).
   כל אלמנט הוא **solid template** מסוג `CVTemplate3d`, המקודד כרשת (mesh) של קודקודים (`CVVertexNode`)
   ופאות (`CVFaceData`) בקבצי `.bcd` בינאריים (schema פנימי `NewCXSchema`), ממופה דרך מניפסט־`.lst`
   (UTF-16), קטלוגי־`.cat` (UTF-16), ותקני־`.ucs`. זו "השפה" ברמת ההנדסה/הייצור.

2. **סמל־2D לתוכנית** — CVSM **לא** מפיק את הסמל מ־3D. הוא מצייר גליף וקטורי נקי מ**סכימת־פרימיטיבים
   מנורמלת** ברנדרר הדו״ח (`renderSymbol` / `symbol_defs`). זו "השפה" ברמת השרטוט — וזו שקובעת אם
   השרטוט "נראה טוב". **זו השפה ש־Soline מרפלק.**

המסקנה המעשית: אין צורך (ואי־אפשר בזמן סביר) לשחזר את מנוע־ה־solid של Cabinet Vision כדי ששרטוט־
המדידה ייראה מקצועי. צריך לרפלק את **סכימת־הסמל־2D** — וזה מה שהמודול החדש עושה, עם גאומטריה בתקן
IEC (חשמל) ותקני־שרטוט (אינסטלציה/גז/מיזוג/אדריכלות).

---

## 1. מבנה החבילה — `CV Setup Unicode Package V4.0`

ה־`.pkg` הוא ZIP. פירוק נותן **108 קבצים**:

| סיומת | #  | תפקיד |
|-------|----|-------|
| `.bcd` | 79 | **הגדרות־אלמנט** — `NewCXSchema`/`CVTemplate3d` (mesh 3D) |
| `.cat` | 2  | קטלוגים (UTF-16): `WEB-App` (26.cat), `אלמנטים למדידה` (27.cat) |
| `.ucs` | 4  | User Created Standards: `Measuring ELEMENTS 1-4 … 4-4` — מקבצים את ה־.bcd |
| `.prt` | 6  | Parts — צירים/ידיות (`HNG`, `PULL`, `PULLD`, `S_FPRAIL`…) |
| `.mat` | 3  | Materials · `.tex`×3 Textures · `.fin`×2 Finishes · `.fit`×1 Finish-Type |
| `.msh`/`.msa` | 1+1 | Material Schedule (`No Pulls/Knobs`) |
| `.lst` | 1  | **מניפסט** (`Package.lst`, UTF-16) — עץ הרשומות |
| `.bcs`/`.bmp`/`.jpeg`/`.lic` | — | thumbnails/רישוי |

### 1.1 המניפסט `Package.lst` — אבן־הרוזטה (UTF-16LE)

טקסט UTF-16LE, שורה־לשדה. כותרת:
```
CV Setup Unicode Package - V4.0
(PSNC:2026.208)(PSNCLIB:2026)(CVDATA:2026.208)(REPORT:2025.001)
```
לאחריה **רשומות בגודל 8 שדות** (עץ הורה/צאצא). מבנה־רשומה (מאומת מול הקובץ):
```
<index> <parentIndex> <ext> <description> <code/name> <flagA> <fileId> <flagB>
```
דוגמאות ממשיות מפוענחות:
```
2  1  cat  "Catalog: WEB-App"                 WEB-App     0  26   0   → 26.cat
3  2  prt  "Part: System::Hinge - ציר"        HNG         0  59   1   → 59.prt
9  2  mat  "Material: Panel Stock - דיקט 17"  דיקט 17 1610 0 1054  0   → 1054.mat
15 1  cat  "Catalog: אלמנטים למדידה"          אלמנטים למדידה 0 27  0   → 27.cat
24 1  ucs  "User Created Standard: Measuring ELEMENTS 1-4"  …  0 10623 0 → 10623.ucs
27 1  ucs  "User Created Standard: Measuring Elements 4-4"   …  0 10684 0 → 10684.ucs
```
**מפתח:** `fileId` (שדה 7) = שם־הקובץ בפועל (`<fileId>.<ext>`). כך המניפסט ממפה כל בּלוב לתפקידו,
לשמו (עברית/אנגלית) ולקוד־הקטלוג. ה־4 רשומות `.ucs` הן "האלמנטים למדידה" — הן מקבצות את ה־79 `.bcd`.
המניפסט עצמו מחזיק **27 רשומות** בלבד; שאר הקבצים (ה־.bcd) מוצבעים מתוך ה־.ucs.

### 1.2 הקטלוג `.cat` (UTF-16) — `Assembly Catalog … Version 3`

`26.cat` נפתח (אחרי BOM `ff fe`) ב־`Assembly Catalog Unicode Import/Export File - Version 3`.
מחרוזות־מפתח שחולצו (טקסט UTF-16, לא בינארי):
```
WEB-App                                  ← שם הקטלוג
{2748D2E6-4BEB-44A8-90E7-1DCB98BE3F1C}   ← rGUID של הקטלוג
AssemblyCatalog / ContributorID / Ordinal / ModularIncrement / LastUpdate
AssemblyCatalogExtraModularInfo:
  BaseHeight BaseDepth UpperHeight UpperDepth TallHeight TallDepth TwoPullWidth
  AllowMixedDoorStyles DoorCatalogID
AssemblyCatalogLinePricing / …Parameter / …PriceVariable / …DoorStyle / …DoorMap…
AssemblyShape:
  CoordinateCount  FaceCount  Width  Height  Depth  Flags  ReferenceCount  LastUpdate
```
כלומר הקטלוג מגדיר, לכל אלמנט/ארון: **מידות ברירת־מחדל** (Base/Upper/Tall Height+Depth),
`AssemblyShape` עם `CoordinateCount`/`FaceCount`/`Width×Height×Depth`/`Flags`, ומערכת־תמחור/דלתות.
זהו המקבילה של Cabinet Vision ל"קטלוג האלמנטים" — עברית (`אלמנטים למדידה`) ואנגלית (`WEB-App`) חיים זה לצד זה.

---

## 2. הגדרת־אלמנט `.bcd` — הנדסת־לאחור בינארית

כל `.bcd` נפתח בחתימה **`NewCXSchema`** (11 בתים ASCII) ומכיל שלושה טיפוסי־עצם עם **שמות־class
באורך־קידומת** (`<uint16 len><ASCII>`). הראיה (מ־`7328.bcd`, 380 בתים — האלמנט הפשוט ביותר):

```
offset  bytes                                    meaning
0x0000  4e 65 77 43 58 53 63 68 65 6d 61 00      "NewCXSchema\0"      ← magic
0x000c  01 d0 ff ff                              schema-object id/marker
0x0010  dc 07 0c 00 43 56 54 65 6d 70 6c 61…     0c00=len 12 → "CVTemplate3d"  ← סוג-העצם
0x0020  01 d0 a0 1c 00 00 …                       a01c → object id 0x1ca0
        …
0x0040  08 00 00 00 fd ff ff ff  98 ab f4 3f …    doubles: transform/geometry
        98 ab f4 3f = 1.2905  ·  b5 8c f5 3f = 1.3617  ·  00…00 f0 3f = 1.0
```
שלושת ה־class הפנימיים (מאומת ב־7328/7322/7320.bcd):
```
@0x12   [12] "CVTemplate3d"   ← עוטף האלמנט (התבנית הפרמטרית)
@0x7e   [12] "CVVertexNode"   ← מערך קודקודי-הרשת (x,y,z כ-IEEE-754 double)
@…      [10] "CVFaceData"     ← טופולוגיית הפאות (אינדקסים לקודקודים)
```
**קידוד־הגאומטריה:** doubles ליטל־אנדיאן. ספירת doubles־בטווח סבירה עם גודל־הקובץ:
`7328.bcd` (380B)→12 · `7322.bcd` (6.2KB)→353 · `7320.bcd` (36.8KB)→1996 — קונסיסטנטי עם
**רשת 3D של קודקודים+פאות** (לא סמל־2D). ה־`CVTemplate3d` נושא בראשו מטריצת־טרנספורם/רבעון
(רואים `…f0 3f`=1.0 כאיבר־יחידה טיפוסי) ואחריו בלוקי `CVVertexNode`/`CVFaceData`.

**מסקנה:** ב־CVSM כל אלמנט מוגדר כ**מוצק־3D מלא** (mesh) — לא כאוסף קווי־סמל. הסמל בתוכנית מיוצר
בנפרד, ברנדרר. לכן ניסיון לגזור סמל־2D יפה מתוך ה־.bcd הוא הדרך הארוכה; הדרך הנכונה היא §3.

> **מה כן שימושי מה־.bcd/.cat ל־Soline כרגע:** ה־`AssemblyShape.Width/Height/Depth` (מידות)
> ושמות־האלמנטים (עברית/אנגלית) מהמניפסט — אלה הוזנו כבר לטבלת המידות/השמות של `elements.json`.
> פענוח־מלא של הרשת (לרינדור 3D זהה־CVSM) הוא שדרוג עתידי, לא נדרש ל"שיפור מראה הסמלים".

---

## 3. שפת־הסמל־2D של CVSM — הסכימה שאנו מרפלקים

מנוע־הדו״ח של CVSM (ראה `ops/docs/cvsm_reference/cvsm_html_export/app.js`, פונקציות
`symbolShapes` + `renderSymbol`) מצייר כל אלמנט מ**רשומת־פרימיטיבים סריאלית** בתוך **תיבת־יחידה
מנורמלת**. זו סכימה נקייה, בלתי־תלויה־ברזולוציה, וקלה־לרפלוק:

```js
// app.js — renderSymbol (מקור-CVSM):
function ux(u){ return (u-0.5)*w; }   // u∈[0..1] → [-w/2 .. +w/2]
function uy(v){ return (v-0.5)*h; }   // v∈[0..1] → [-h/2 .. +h/2],  y כלפי-מטה
// def = DATA.symbol_defs[key]; shapes = view==="plan" ? def.plan : def.elev;
```
**מערכת־קואורדינטות:** תיבת־יחידה `[0..1]×[0..1]`, מרכז `(0.5,0.5)`, **y כלפי־מטה**. הרנדרר מכפיל
ל־mm לפי `sym.w/sym.h` בזמן־ציור. עובי־קו נגזר אוטומטית: `sw = max(3, min(w,h)*0.025)`.

**הפרימיטיבים (שדה `t`):**

| `t` | שדות | ציור |
|-----|------|------|
| `line` | `x1,y1,x2,y2` | קו |
| `rect` | `x0,y0,x1,y1`,`rad?`,`fill?` | מלבן (פינות `rad*min(w,h)`) |
| `ellipse` | `cx,cy,r`,`fill?` | `rx=r*w, ry=r*h` (עיגול כשהתיבה ריבועית) |
| `arc` | `x0,y0,x1,y1`,`a0,sweep`,`center?`,`fill?` | קשת מ־bbox של אליפסה; זוויות במעלות; מדוגמת ל־polyline (24 צעדים) |
| `poly` | `pts:[x,y,…]`,`closed?`,`fill?` | פוליגון/פוליליין |
| `label` | `cx,cy,text`,`hf`,`bold?` | טקסט (`font-size = hf*h`) |

מאפיינים משותפים: **`wt`** (מכפיל־עובי־קו) · **`dash`** (מקווקו: `stroke-dasharray sw*3,sw*2`).
מפתח לא־מוכר → CVSM מצייר **placeholder** (מלבן + תווית־המפתח) — "חוזה־ההשפלה" שהזכיר גם ה־PDF exporter.

**זו בדיוק הסכימה שאימץ `element_symbols_soline.js`** — כדי שה־`plan[]` שלנו יוזרק ישירות ל־
`DATA.symbol_defs` של הרנדרר, או ל־viz/PDF, ללא תרגום.

---

## 4. הפער "לפני" — למה האלמנטים לא נראו טוב

| | לפני (export_dxf_pro `BLOCKS_2D` / export_dxf2d `GLYPHS`) | אחרי (`element_symbols_soline.js`) |
|---|---|---|
| מס׳ סמלים | **~8** (SOCKET, DUPLEX, SWITCH, GAS, FAUCET, SEWAGE, LIGHTING, CONTROLBOX) | **172** |
| כיסוי 170 האלמנטים | חלקי; רובם → `CONTROLBOX`/תיבה+תווית | **100%** (name-hit על כל 170) |
| כיסוי 84 שמות־האפליקציה | חלקי | **100%** |
| קואורדינטות | mm־מקומי ידני, קבוע (`R=90`), לא־מנורמל | תיבת־יחידה מנורמלת (זהה־CVSM) |
| פורמט | ייחודי לכל exporter | סכימת־CVSM אחת + אדפטרים לשני הפורמטים |
| איכות | שקע=טבעת+פס; רוב האלמנטים=תיבה גנרית | תקן IEC/אינסטלציה/אדריכלות לכל טיפוס |

השורש: `blockFromCategory`/`resolveBlock` נופלים ל־`CONTROLBOX` לכל שם עברי לא־מוכר, ו־`elemLayer`
מציב את הרוב על `Elem_Misc`. כלומר, מבחינת השרטוט, 62 טיפוסי־האלמנט (וה־170 בקטלוג) קיבלו בפועל
2–8 צורות. זה מה ש"לא נראה טוב".

---

## 5. `element_symbols_soline.js` — המבנה והחוזה

- **172 סמלים** בסכימת־CVSM, מפולחים לפי דיסציפלינה:
  electrical 38 · lighting 11 · comms 10 · smart 7 · safety 10 · plumbing 12 · drainage 5 ·
  gas 8 · hvac 9 · thermal 3 · renewable 5 · door 12 · opening 6 · window 12 · structure 23 · misc 1.
- כל סמל: `{ key, category, discipline, mount, dims:{w,h,d}, plan:[…], elev? }`.
  - `dims` = מידות־ברירת־מחדל אמיתיות (מ״מ), מעוגנות ב־`elements.json`/`AssemblyShape`.
  - `mount` = `wall|ceiling|floor|freestanding` (לניתוב־שכבה/מבט).
- **בונים פרמטריים** (משפחות): `socketGang(n)` (שקע IEC n־מקומי), `switchGang(n)`, `marker(text,shape)`
  (הבסיס ה"נקי" שמחליף את התיבה־הגסה), `earth`/`waves`/`arrowHead`/`dome`/`stem`.
- **API:**
  - `symbolFor(typeOrItem)` → הגדרת־הסמל (מקבל key / שם / `item{en,he,name,type,category,width_mm…}`;
    אם ה־item נושא מידות אמיתיות הן דורסות את ברירת־המחדל).
  - `resolveKey` · `listSymbols` · `SYMBOLS[key]`.
  - **אדפטר לדו״ח:** `toReportDef(sym)` → `{plan,elev}` — הזרקה ישירה ל־`DATA.symbol_defs` / viz / PDF.
  - **אדפטר ל־DXF:** `toDxf2dGlyph(sym,{w,h})` → פורמט `GLYPHS`/`BLOCKS_2D` (mm־מקומי, קיר ב־Y=0,
    +Y אל החדר). המרה: `Xmm=(x-0.5)·W`, `Ymm=(1-y)·H` (היפוך y־למטה → y־מהקיר). קשתות/אליפסות
    מדוגמות ל־polylines (עמיד להיפוך); עיגול־אמיתי נשמר כ־`{circle:[cx,cy,r]}`; תוויות נחשפות כ־`{label:…}`.

### 5.1 חוזה־האינטגרציה (הסוכנים הבאים מבצעים — מודול זה לא נוגע ב־export_*)

1. **`export_dxf2d` / `export_dxf_pro`:** במקום `GLYPHS[classify(item).sym2d]` (שנפל ל־GENERIC),
   קרא `toDxf2dGlyph(symbolFor(item), {w,h})`. הפורמט המוחזר (polyline / `{circle}` / `{label}`)
   כבר תואם ל־`linesFromPolyline`/`arc2D`/`circle2D` הקיימים.
2. **`export_pdf` / viz / html:** קרא `symbolFor(item).plan` (או `toReportDef`) והזרק ל־`symbol_defs`
   של הרנדרר; `renderSymbol` הקיים כבר יודע לצייר `line/rect/ellipse/arc/poly/label`.
3. **ניתוב־שכבה/צבע:** השתמש ב־`discipline`/`category` שמחזיר הסמל (ממופה ל־`Elem_*`/צבעי־ה־DXF).
4. **מידות:** העבר את מידות־ה־item האמיתיות (`width_mm/height_mm/depth_mm`) — הסמל מנורמל ולכן
   נמתח נכון לכל מידה בלי לעוות קשתות (הן מדוגמות אחרי המתיחה).

### 5.2 כיסוי — אימות

```
elements.json (170):  name-hit 170 · category-fallback 0 · disc-fallback 0 · UNRESOLVED 0
ordx_item_dictionary (84 שמות־אפליקציה):  UNRESOLVED 0
כל יעדי NAME_MAP/CATEGORY_DEFAULT קיימים כהגדרה · אין NaN בשני האדפטרים על פני 172 הסמלים
כל הסמלים בגבולות תיבת־היחידה (מלבד קשת־פינה/קיר־מעוקל/דלתות — קשתות שחורגות במכוון)
```
אומת ויזואלית (סריקת גיליון 172 הסמלים בדפדפן): גליפים נקיים בתקן — שקעי IEC (כיפה על גזע),
מפסקים (עיגול+מוט), הארקה, ספוט/פנדנט, RJ45 (משולש), תרמוסטט, גלאים, נקודות־מים (צלב), ניקוז,
גז (משושה), מיזוג (שבכה/מאוורר), דלתות (כנף+קשת־סיבוב רבע־עיגול), חלונות (זיגוג).

---

## 6. פערים ומדרגות־שדרוג עתידיות

1. **רינדור־3D זהה־CVSM** — דורש פענוח־מלא של `CVVertexNode`/`CVFaceData` ב־`.bcd` (רשת + טרנספורם).
   לא נדרש לשיפור מראה הסמלים; שדרוג נפרד אם נרצה תצוגת־מוצק זהה.
2. **מידות פרמטריות מהקטלוג** — `AssemblyCatalogExtraModularInfo` (Base/Upper/Tall H+D) יכול להזין
   ברירות־מחדל מדויקות יותר לארונות; כרגע מספיק `elements.json`.
3. **`elev` ייעודי** — רוב הסמלים מספקים `plan` בלבד; `toReportDef` נופל ל־`plan` גם למבט־חזית.
   ניתן להוסיף `elev` לאלמנטים שנראים שונה מהותית בחזית (שקע/דלת/חלון) בהמשך.
4. **תוויות עבריות ב־DXF** — `toDxf2dGlyph` חושף `label` בנפרד; ה־exporter מחליט אם לכתוב אותן
   בערוץ־הטקסט (מומלץ) או להשמיטן (הסמל לבדו ברור).
```
```
