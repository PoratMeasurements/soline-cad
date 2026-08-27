# 07 — גשר ORDX והחלפת bravh / 3D OrdX · Soline

> ציר-התכנון: **הגשר מדידה→עיצוב→ייצור, ובעלות מלאה עליו סביב `.sol`**. גרסה 1.0 · 2026-08-16 · עברית · לשון זכר.
>
> **נשען על ממצאים מאומתים:** `MEASURE_TO_DESIGN_BRIDGE.md` (הצינור בפועל CVSM→ORDX→3D OrdX→CV, חקירת read-only 16/08),
> `ORDX_BRIDGE.md` (RE של פורמט ORDX + המיפוי מדידה→ORDX + הפערים), `SOL_FORMAT.md` (פורמט-האב `.sol`, 8 שכבות),
> `../../ordx-pdp-converter/docs/OBJECT_MODEL.md` (מודל-האובייקט הקנוני), הקוד החי של הממיר
> (`parseOrdx.js`, `export_ordx.js`, `convertNative.js`), `native_item_add.md` (נתיב PDP-native retarget),
> `ordx_item_dictionary.json` (מיפוי-שמות ORDX→PDP), ו-`rich_base_spec.md`.
>
> **תחום המסמך:** רק שכבת-הגשר — כתיבת ארונות ל-ORDX (פיצוח `ordx_templates`), חיבור לממיר ול-`soline-cad-engine`,
> `.sol` כמרכז, והחלפת התלות ב-3D OrdX / bravh. **מה שלא כאן:** אפיון תוכנת-העיצוב (ב-`DESIGN_TOOL_SPEC.md`),
> פורמט `.sol` המלא (ב-`SOL_FORMAT.md`), מנוע-ההתאמה R1–R10 (ב-`kitchen_layout_fitting.md` וב-`03-fit-engine.md`),
> וארכיטקטורת אפליקציית-המדידה (ב-`01-architecture.md`). המסמך מפנה אליהם ולא משכפל.

---

## 0. תקציר מנהלים

הצינור בפועל הוא שלוש חוליות — **CVSM (מדידה) → קובץ `.ordx` → `3D_OrdX.exe` (bravh) → `.abv`/דו"ח/PDF/ORDX-מועשר → Cabinet Vision (לא מותקן)**.
שתי עובדות קובעות את כל התכנון: (א) **הארונות אינם עוברים ב-ORDX** — גם ה-ORDX מהמדידה וגם המועשר מ-3D OrdX משאירים
`<Cabinet></Cabinet>` ריק, כך ששכבת-העיצוב חיה רק בפורמט הסגור `.abv` של הספק; (ב) **3D OrdX הוא אפליקציית Python של bravh
על רישיון-ניסיון** — אותו ספק של אפליקציית המדידה — ו-Soline הוא licensee בלבד. אלו בדיוק שתי נקודות-התלות שיש לנתק.

הנכסים של Soline כבר מכסים כמעט את כל הצינור: מודל-האובייקט הקנוני (`OBJECT_MODEL.md`), `parseOrdx.js` עם round-trip **מאומת**,
`export_ordx.js` שכבר יודע להוציא `<Furnishing>` תקין, נתיב PDP-native (retarget) שמצייר אביזרים באייקוני-ראומפלן,
ו-`soline-cad-engine` שכבר מפיק DXF 2D/3D + דו"ח מאותו מודל. **מה שחסר הוא ערוץ-הארונות** — הדבר היחיד ש-3D OrdX עושה
ו-Soline עדיין לא: להעמיד ארונות על מודל-המדידה ולשאת אותם הלאה לייצור.

**המהלך:** לקבע את `.sol` כמקור-האמת ואת ORDX כ**פורמט-חילוף יוצא בלבד** (ל-Cabinet Vision של צד-ג', כשצריך); לפצח את
`ordx_templates` כדי למלא את `<Cabinet>` ב-ORDX — מה ש-3D OrdX עצמו לא עושה, וזה לבדו מייתר אותו בזרימה ל-CV; להוסיף בלוק
הרחבה `<Ext sol>` שסוגר את אובדן-המידע של ORDX-הליבה; ולבסס את נתיב-הייצור האמיתי של Soline (BOM/CNC ישיר מ-`.sol` דרך
`soline-cad-engine`) כך ש-Cabinet Vision עצמו הופך לאופציונלי ולא לחוליה-הכרחית. בסוף הדרך: מדידה→`.sol`→ייצור, ללא שום רכיב של bravh.

---

## 1. הצינור היום — ניתוח נקודות-התלות

### 1.1 שלוש החוליות ומה עובר בכל גשר

```
CVSM / RoomMeasure ─exportToOrdx─▶ .ordx ─יבוא─▶ 3D_OrdX.exe ─▶ {.abv · report.html · .pdf · ORDX-מועשר} ─▶ Cabinet Vision
     (מדידת שטח)        קירות+אביזרים      (bravh, Python, trial)      הארונות רק ב-.abv הסגור          (צד-ג', לא מותקן)
```

| גשר | מה עובר | מה נופל | מקור |
|---|---|---|---|
| CVSM → ORDX | קירות (Start/End/Angle/Height/Thick/Vault), אביזרים ממוקמים על הקיר (W/D/H, fromLeft, fromBottom) | **ארונות**, גרף-חיבוריות, קיר-מעוקל, wallTopStyle L/R, elevation, face, slot מזגן, **סטטוס-נקודה**, צילומים | `ORDX_BRIDGE.md §3` |
| ORDX → 3D OrdX | הקירות+האביזרים לסצנת-3D; טעינת קטלוג (`catalog.sqlite`+`.dae`) | — (זו נקודת-ההעשרה) | `MEASURE_TO_DESIGN_BRIDGE.md §1` |
| 3D OrdX → פלטים | `.abv` נושא עיצוב מלא (CABDims/CABRot/BackFace/Cache.xml) | **ORDX-המועשר עדיין `<Cabinet></Cabinet>` ריק** — הארונות כלואים ב-`.abv` | `MEASURE_TO_DESIGN_BRIDGE.md §1,§5` |
| 3D OrdX → Cabinet Vision | ORDX (קירות+אביזרים בלבד) | הארונות — CV מקבל חדר ריק ומצפה שהמעצב ישרטט מחדש | `MEASURE_TO_DESIGN_BRIDGE.md §3` |

### 1.2 שתי נקודות-התלות שיש לנתק

1. **תלות-רישוי ב-bravh (3D OrdX).** `OrdX_TrialLicense.exe` — רישיון-ניסיון של ספק חיצוני שיפוג, מנגנון **נפרד** מהרישוי של
   אפליקציית-המדידה. כל שרשרת-העיצוב תלויה בו. סיכון-המשכיות ישיר (`MEASURE_TO_DESIGN_BRIDGE.md §5, סיכון 2,6`).
2. **תלות-פורמט ב-`.abv` הסגור.** הפורמט היחיד שמחזיק עיצוב-ארונות מלא הוא OLE Compound בינארי-קנייני של צד-ג', ללא round-trip
   פתוח. שכבת-העיצוב של Soline כלואה בו (`MEASURE_TO_DESIGN_BRIDGE.md §5, סיכון 1,3`).

### 1.3 מה כבר בידי Soline (הבסיס להחלפה)

| נכס קיים ומאומת | תפקיד בגשר החדש | מקור |
|---|---|---|
| מודל-האובייקט הקנוני (`dimensions_mm`+placement+חוזה-סקאלה) | הליבה שכל מייצא בונה מולה — כולל ORDX | `OBJECT_MODEL.md` |
| `parseOrdx.js` — round-trip **מאומת** על הקורפוס (2918 יוצא/נטען זהה) | מנוע-הייבוא ORDX → `measured/` | `parseOrdx.js`, `STATUS.md` |
| `export_ordx.js` — `objectToFixture` + `exportORDX`, שתי קונבנציות-מידה | מנוע-הייצוא Soline → ORDX (בסיס להוספת `<Cabinet>`) | `export_ordx.js` |
| נתיב PDP-native (retarget) — אביזרים באייקוני-ראומפלן | ערוץ-ארונות/אביזרים אלטרנטיבי ל-CV | `native_item_add.md`, `convertNative.js` |
| `soline-cad-engine` — DXF 2D/3D + דו"ח מאותו מודל | מחליף את פונקציית-הפלט של 3D OrdX | `MEASURE_TO_DESIGN_BRIDGE.md §4.1` |
| `ordx_item_dictionary.json` — מיפוי שם-ORDX → סוג | הזרקת-אלמנטים דו-כיוונית | `ordx_item_dictionary.json` |
| סכמת `catalog.sqlite` (נקראה במלואה) | תבנית לקטלוג-`.sol` (כולל `ordx_templates`) | `MEASURE_TO_DESIGN_BRIDGE.md §2` |

**המסקנה:** הפער היחיד בין Soline לבין עצמאות מלאה מ-bravh הוא **ערוץ-הארונות** — היכולת להעמיד ארונות על המודל ולשאת
אותם לייצור. כל השאר כבר קיים ומאומת.

---

## 2. עקרון-העל: `.sol` כמרכז, ORDX כפורמט-חילוף יוצא

היום ORDX הוא **חוליה-פנימית-הכרחית** (מדידה עוברת דרכו כדי להגיע לעיצוב). זו טעות ארכיטקטונית: פורמט דל-שדות של צד-ג'
(`ORDX_BRIDGE.md §0` — "מיפוי מאבד-מידע") אינו צריך להיות במרכז. לפי `SOL_FORMAT.md §5,§8`, `.sol` הוא ה-hub, והממיר הוא
מנוע-הייבוא/ייצוא סביבו.

```
מדידה (CVSM/native) ──parseOrdx / native──▶ measured/ ┐
תכנון (PDP-מעצב)     ──readPdp──────────────▶ design/  ┘──▶ .sol ──מנוע-התאמה R1–R10──▶ fit/
                                                             │
                          ┌──────────────────┬──────────────┼───────────────┬──────────────┐
                          ▼                  ▼               ▼               ▼              ▼
                     export_dxf2d       export_dxf3d      PDP-native      export_ordx    BOM/CNC
                     (תכנית-מדידה)       (3D)          (Raumplan viewer) (→Cabinet Vision) (ייצור ישיר)
```

**המשמעות:** ORDX יורד ממעמד "חוליה שאסור לאבד בה" למעמד "**פורמט-חילוף יוצא, נוצר רק כשצריך להזין Cabinet Vision של צד-ג'**".
כל אובדן-המידע של ORDX (`ORDX_BRIDGE.md §3`) הופך לבלתי-רלוונטי לזרימה-הפנימית, כי המקור-העשיר תמיד ב-`.sol`. זה גם מה שמאפשר
להחליף את 3D OrdX: אם `.sol` מחזיק את הארונות, וממנו אפשר לייצר גם ORDX-עם-ארונות (§4) וגם ייצור-ישיר (§5), 3D OrdX מפסיק
להיות נחוץ.

---

## 3. הפער הקריטי — ארונות אינם עוברים ב-ORDX

זהו לב הציר. שני המודלים לא נושאים ארונות: המדידה שולחת `<Cabinet></Cabinet>` ריק, ו-3D OrdX מחזיר אותו עדיין ריק
(`MEASURE_TO_DESIGN_BRIDGE.md §5, סיכון 1`). המשמעות: **כל מעבר ל-Cabinet Vision מוחק את שכבת-העיצוב** — ה-CAD מקבל חדר-ריק
ומצפה למעצב שישרטט ארונות מאפס. זה בדיוק מה ש-3D OrdX "מסתיר" — הוא מחזיק את הארונות ב-`.abv` הפרטי שלו ולא נותן להם לצאת.

### 3.1 המפתח: `ordx_templates`

בקטלוג של 3D OrdX קיימת טבלה `ordx_templates` עם `name, template_xml, variable_map_json` — **מנגנון המרת פריט-קטלוג ל-XML
של ORDX** (תבנית + מיפוי-משתנים). זהו בדיוק המנגנון שממלא את `<Cabinet>` — כשעובד. בקטלוג שנחקר הוא **ריק/מינימלי** ולא פוענח
(`MEASURE_TO_DESIGN_BRIDGE.md §2,§5 סיכון 7`; נחקרה הסכמה בלבד, `sqlite3` לא היה מותקן).

**אם Soline יודע למלא את `<Cabinet>` ב-ORDX — הוא מייתר את 3D OrdX לחלוטין בזרימה ל-Cabinet Vision** (`MEASURE_TO_DESIGN_BRIDGE.md §4.5`).
זה מהלך P0.

### 3.2 מה נדרש כדי לפצח

1. **קריאת הטבלה בפועל.** להריץ שאילתת SQLite על `data\catalog.sqlite` (או להשתמש ב-`Ordx_Admin.exe`/`CatalogAdmin.exe`
   על מחשב Michael) ולחלץ `template_xml`+`variable_map_json` של פריט-ארון אמיתי. **תלוי-Michael** — פעולה על המחשב שלו,
   read-only.
2. **קורפוס-זהב של `<Cabinet>` מלא.** לעצב מטבח פשוט ב-3D OrdX ולייצא ORDX — אם 3D OrdX **כן** כותב `<Cabinet>` בתצורה
   מסוימת (בניגוד לדגימה שנבדקה), זה נותן דגימת-יעד. אם הוא **לעולם** לא כותב אותה, נשענים על `template_xml` בלבד + אפיון
   סכמת-`<Cabinet>` של InnoDraw/Cabinet Vision.
3. **סכמת `<Cabinet>` של Cabinet Vision.** ORDX הוא "CV ORDX Order XML" — הסכמה שבה CV **קורא** ארונות מוגדרת על-ידי CV,
   לא על-ידי 3D OrdX. יש לאמת מול תיעוד-היבוא של CV / דגימת-ORDX שנוצרה ב-CV, לא רק מול bravh.

### 3.3 שלוש דרכים לשאת ארונות לייצור (ההחלטה האסטרטגית)

| ערוץ | מה נדרש | יתרון | חיסרון |
|---|---|---|---|
| **א. `<Cabinet>` ב-ORDX** | פיצוח `ordx_templates` + סכמת-CV | interop סטנדרטי, מייתר את 3D OrdX בזרימה ל-CV | תלוי סכמת-CV חיצונית; ORDX דל |
| **ב. PDP-native (הזרקת ארונות)** | הרחבת נתיב ה-retarget מאביזרים לארונות | אייקונים מקוריים, viewer עובד offline, בשליטת Soline | RE נוסף על PDP; ארונות מורכבים מאביזרים |
| **ג. BOM/CNC ישיר מ-`.sol`** | `soline-cad-engine` + `resolveCatalog` (קיים) | עצמאות מלאה, אין צד-ג', הנתיב האסטרטגי | דורש בניית מנוע-הייצור עד CNC |

**ההכרעה (ראה §7, D2):** לבנות את **ג** כיעד-האסטרטגי (עצמאות מ-bravh **ומ-CV**), ולספק את **א** כגשר-interop (בשביל
לקוחות/ספקים שכן עובדים ב-Cabinet Vision). **ב** נשמר כאופציה ל-viewer הפנימי (Raumplan), לא כערוץ-ייצור ראשי.

---

## 4. גשר-ה-interop: כתיבת ארונות ל-ORDX

מתוך `.sol` (שכבת `design/`+`fit/` שנושאת ארונות) מייצרים ORDX-עם-ארונות דרך הרחבת `export_ordx.js`. הבסיס כבר קיים:
`serializeItem`/`serializeSize` כותבים `<Furnishing>`/`<Fixture>` בשתי קונבנציות-המידה, ו-`objectToFixture` ממפה
אובייקט-קנוני → פריט (`export_ordx.js`). נוסיף:

1. **`objectToCabinet(cabinet, placement)`** — ממיר ארון קנוני (`code`, `dimensions_mm`, series, doors) לתיאורן-ארון של ORDX,
   לפי `template_xml`+`variable_map_json` שפוענחו (§3.2). מקביל ל-`objectToFixture`.
2. **`serializeCabinet` + `serializeCabinetGroup`** ב-`export_ordx.js` — כותבים `<Cabinet>...</Cabinet>` (ו-`<Closets>`
   אם רלוונטי) בתוך `<RoomProperties>` או `<Wall>`, לפי מיקום-הסכמה שיתגלה בפיצוח.
3. **הרחבת `parseOrdx.js` לקרוא `<Cabinet>`** — כדי לשמור round-trip: `parse → export → parse` חייב לשחזר גם ארונות
   (כיום הפרסר לא קורא `<Cabinet>` כלל). מקביל ל-`parseWall`.
4. **הרחבת ה-round-trip test** (`export_ordx.js --selftest` + `diffModels`) לכלול ארונות בהשוואה.

### 4.1 בלוק ההרחבה `<Ext sol>` — סגירת אובדן-המידע

ORDX-הליבה דל מדי (`ORDX_BRIDGE.md §4.1`). מה ש-InnoDraw לא מכיר יישא ב-`<Ext xmlns:sol="soline">` פר-`Wall`/`Furnishing`/`Cabinet`:
`elevation`, `wallEndStyle`, `wallTopStyle` (כולל LEFT/RIGHT), `isArcWall`+פרמטרי-קשת, גרף-החיבוריות, `face`, `slot*` (מזגן),
ו**סטטוס-נקודה** (קיים/חדש/להזיז/מבוטל/הכנה — החוסר הקריטי ביותר, `ORDX_BRIDGE.md §4.2`). Cabinet Vision יתעלם מ-`<Ext>`;
Soline יקרא אותו ב-round-trip. זה מה שהופך את ORDX מ"ייצוא-הרסני" ל"ייצוא-נאמן". **הערה:** קירות-מעוקלים ייוצאו גם כמקטעי-קו
(approximation ל-CV) וגם כפרמטרי-קשת ב-`<Ext>` (לשחזור מלא).

### 4.2 תיקוני-הפרסר הידועים (חוב-קטן, ROI גבוה)

- **`Position/Z` נזרק** בעת הפרסור למרות ש-`export_ordx` כותב אותו ו-5 ערכים קיימים בקורפוס (`ORDX_BRIDGE.md §1.3,§4.5`).
  תיקון שורה אחת ב-`parsePlacedItem`.
- **`Depth` לחלונות/דלתות** — לוודא שנכתב תמיד (קריטי-נגרות, קל להשמיט בסכמת-`Size` המקוננת, `ORDX_BRIDGE.md §4.7`).
- **שער אי-אובדן (lossless gate)** — להרחיב את `--selftest` להשוואת **כל** שדה של מודל-המדידה מול ORDX, ולהכשיל CI על כל
  שדה שנשמט בלי מיפוי-מפורש או `<Ext>` או ויתור-מודע (`ORDX_BRIDGE.md §4.6`). כך "אובדן שקט" הופך לכישלון גלוי.

---

## 5. נתיב-הייצור העצמאי — החלפת 3D OrdX

3D OrdX עושה שני דברים: (א) **עיצוב** (הצבת ארונות על מודל-המדידה) ו-(ב) **פלטים** (report/pdf/abv/ORDX). את שניהם Soline
יכול לספק בעצמו:

| מה 3D OrdX עושה | מחליף אצל Soline | מצב |
|---|---|---|
| עיצוב ארונות על מודל-המדידה | תוכנת-העיצוב של Soline (`DESIGN_TOOL_SPEC.md`, web/three.js) → שכבת `design/` ב-`.sol` | באפיון |
| דו"ח HTML/PDF | `soline-cad-engine` (כבר מפיק דו"ח) | קיים אב-טיפוס |
| DXF 2D/3D | `export_dxf2d.js`/`export_dxf3d.js` | קיים ומאומת |
| `.abv` (נייטיב סגור) | `.sol` (נייטיב פתוח בשליטת Soline) | `SOL_FORMAT.md` |
| ORDX (ל-CV) | `export_ordx.js` + `<Cabinet>` (§4) | חלקי → §4 |
| קטלוג-ארונות/אביזרים/גימורים | קטלוג-`.sol` מסכמת `catalog.sqlite` (§6) | לאימוץ |
| viewer 3D | viewer three.js offline (`rendering_design.md`) | קיים |
| ייצור (CNC/BOM) | `bom/cutlist.json` + `resolveCatalog` (אלקינצ'ו) | חלקי |

**המסקנה:** אין ב-3D OrdX תפקיד שאין לו מחליף בצד Soline — חלקם קיימים ומאומתים, חלקם באפיון. ההחלפה היא **הרכבה של רכיבים
קיימים** סביב `.sol`, לא בנייה מאפס. זו עבודה XL אך נמוכת-סיכון-טכני (הרכיבים כבר עובדים בנפרד).

---

## 6. השתלטות על הקטלוג

מבנה `catalog.sqlite` הוא בדיוק קטלוג-האלמנטים ש-`.sol` צריך (`MEASURE_TO_DESIGN_BRIDGE.md §4.3`): `catalog_items` (ארונות עם
`dae_path`+`ordx_template`+`resize_rules`+`snap_points`+`material_zones`), `accessory_items` (אביזרים עם `element_class/type`),
`ordx_templates`, `materials`, `catalog_folders`. Soline יאמץ/ישכפל את הסכמה כקטלוג-`.sol` (`catalog/elements.json`+`symbols.json`+
`materials.json`, `SOL_FORMAT.md §3.1`), כולל **מנגנון `ordx_templates`** כדי לייצר ORDX פר-פריט בבקרה מלאה. זה הנכס שהופך את
פיצוח §3 לניתן-לתחזוקה: כל ארון בקטלוג נושא את התבנית שלו לכתיבת-ORDX.

**הצטלבות עם הקיים:** הממיר כבר מחזיק `elements.json` (170 אלמנטים) + `symbols.json` + `elkincho_catalog.json` (ארונות) +
`resolveCatalog` (`rendering_design.md §8.1.1`). האיחוד: קטלוג-האביזרים כבר קיים אצל Soline; מה שמתווסף מ-`catalog.sqlite` הוא
**קטלוג-הארונות התלת-ממדי** (`.dae`+resize/snap rules) ו-`ordx_templates`.

---

## 7. ההחלטות

> כל החלטה: שאלה, אפשרויות, המלצה+נימוק, effort/impact/risk/priority, ותלות. הפירוט המלא בפלט-המובנה הנלווה.

- **D1 — מעמד ORDX בצינור.** `.sol` כמקור-אמת, ORDX כפורמט-חילוף **יוצא בלבד** (ל-CV כשצריך), לא חוליה-פנימית. **P0.**
  יסוד לכל השאר: מנטרל את אובדן-המידע של ORDX מהזרימה-הפנימית.
- **D2 — ערוץ-אספקת-הארונות לייצור.** לבנות **BOM/CNC ישיר מ-`.sol`** כיעד-אסטרטגי (עצמאות מ-bravh ומ-CV), ובמקביל
  **`<Cabinet>` ב-ORDX** כגשר-interop ל-CV. PDP-native נשמר ל-viewer. **P0.** ההכרעה שמנתקת את התלות בליבתה.
- **D3 — פיצוח `ordx_templates` + מילוי `<Cabinet>`.** לפצח את `template_xml`+`variable_map_json` ולכתוב ארונות ל-ORDX.
  **P0**, dependsOn D2. זה מה שמייתר את 3D OrdX בזרימה ל-CV.
- **D4 — בלוק הרחבה `<Ext sol>`.** להוסיף לכל `Wall`/`Furnishing`/`Cabinet` בלוק-הרחבה שנושא את מה ש-ORDX-הליבה לא מחזיק
  (סטטוס-נקודה, קשת, חיבוריות, wallTopStyle L/R...). **P1**, dependsOn D1.
- **D5 — תיקון-פרסר + שער אי-אובדן.** לקרוא `Z`, לוודא `Depth` לחלונות, ולהרחיב `--selftest` לשער-CI. **P1**, effort S.
- **D6 — אימוץ סכמת `catalog.sqlite` כקטלוג-`.sol`.** לאמץ `catalog_items`/`accessory_items`/`ordx_templates`/`materials`.
  **P1**, dependsOn D2.
- **D7 — מקור ייצוא-ה-ORDX.** לייצא ORDX ממנוע-Soline (`export_ordx.js`) מ-`.sol`, לא להסתמך על `exportToOrdx` של CVSM.
  **P1**, dependsOn D1.
- **D8 — החלפת 3D OrdX ב-`soline-cad-engine` + תוכנת-העיצוב.** להרכיב עיצוב+דו"ח+CAD+viewer סביב `.sol`. **P2**, XL,
  dependsOn D2,D6.
- **D9 — יעד Cabinet Vision.** לשמור את CV כיעד-interop אופציונלי (דרך D3), לא כחוליה-הכרחית; אין לרכוש רישיון-CV לצורך
  הצינור-הפנימי. **P2**, dependsOn D2.

---

## 8. תוכנית-מימוש מדורגת

### שלב 0 — יסודות (מיידי, ללא RE חדש)
- **D1**: לקבע ב-`.sol` את ORDX כ-export-only; להזרים `measured/` דרך `parseOrdx` (round-trip כבר מאומת). מתלבש על
  `SOL_FORMAT.md §8` — חבילת `job-<code>` הופכת ל-`.sol` יחיד.
- **D5**: תיקון-הפרסר (Z, Depth) + שער-אי-אובדן ב-`--selftest`. עבודה קטנה, ROI גבוה, מייצבת את הבסיס לכל השאר.

### שלב 1 — ערוץ-הארונות (הליבה)
- **D3 (חקירה)**: על מחשב Michael — לחלץ `ordx_templates.template_xml`+`variable_map_json` (SQLite/`Ordx_Admin`),
  ולעצב מטבח-דוגמה ב-3D OrdX + לייצא ORDX כדי לבדוק אם `<Cabinet>` נכתב אי-פעם. **תלוי-Michael, read-only.**
- **D3 (מימוש)**: `objectToCabinet` + `serializeCabinet` ב-`export_ordx.js`; `parseOrdx` קורא `<Cabinet>`; round-trip test.
- **D4**: `<Ext sol>` פר-ישות, כולל סטטוס-נקודה כאזרח-מדרג-ראשון (`ORDX_BRIDGE.md §4.2`).
- **D7**: ייצוא-ORDX מ-`.sol` דרך מנוע-Soline; אימות מול דגימת-CV אמיתית (לא רק מול bravh).

### שלב 2 — הקטלוג והעצמאות
- **D6**: אימוץ סכמת-הקטלוג ל-`catalog/` של `.sol`; איחוד עם `elements.json`/`elkincho_catalog.json` הקיימים; חיווט
  `ordx_templates` פר-ארון.
- **D2 (נתיב-ג)**: `bom/cutlist.json` מלא מ-`.sol` דרך `resolveCatalog`; ייצוא CSV/CNC.

### שלב 3 — החלפת 3D OrdX
- **D8**: חיווט תוכנת-העיצוב (`DESIGN_TOOL_SPEC.md`) → `design/` ב-`.sol`; `soline-cad-engine` כמנוע-הדו"ח; viewer three.js;
  הוצאת 3D OrdX מהלולאה.
- **D9**: CV כיעד-interop אופציונלי דרך D3; אין רכש-רישיון-CV לצינור-הפנימי.

### תלויות (סדר-כפייה)
```
D1 ──▶ D4, D7
D2 ──▶ D3 ──▶ (interop ל-CV, D9)
D2 ──▶ D6 ──▶ D8
D5 (עצמאי, מקדים — מייצב את הבסיס)
```

---

## 9. סיכונים ופתיחים

| # | סיכון | חומרה | מיטיגציה |
|---|---|---|---|
| 1 | `ordx_templates` ריק/מינימלי — אין מה לפצח בקטלוג שנחקר | גבוהה | חקירה על מחשב Michael + אפיון סכמת-`<Cabinet>` של CV ישירות (לא רק דרך bravh) |
| 2 | סכמת-`<Cabinet>` של Cabinet Vision אינה מתועדת פומבית | גבוהה | לייצר דגימת-ORDX מתוך CV אמיתי (לקוח/שותף) כקורפוס-זהב לפני מימוש D3 |
| 3 | 3D OrdX **לעולם** לא כותב `<Cabinet>` → אין דגימת-יעד מ-bravh | בינונית | להישען על סכמת-CV + `template_xml`, לא על פלט-bravh |
| 4 | round-trip של `<Cabinet>` שובר את המאומת-כיום (2918) | בינונית | תוספת-בלבד לפרסר/מייצא; שער-אי-אובדן (D5) תופס רגרסיה |
| 5 | תלות-Michael לחקירת ה-SQLite חוסמת את שלב-1 | בינונית | שלב-0 ו-D5 אינם תלויים בזה; אפשר להתקדם במקביל |
| 6 | פיצול-קשת (approximation) ל-CV מאבד דיוק | נמוכה | פרמטרי-קשת המקוריים נשמרים ב-`<Ext>` לשחזור מלא |

---

## 10. המשפט האחד

הפער היחיד בין Soline לבין ניתוק מלא מ-bravh הוא **ערוץ-הארונות**; פותחים אותו בשתי חזיתות במקביל — פיצוח `ordx_templates`
לכתיבת `<Cabinet>` ב-ORDX (גשר-interop שמייתר את 3D OrdX מול Cabinet Vision) ובניית BOM/CNC ישיר מ-`.sol` (הנתיב-האסטרטגי
שמייתר גם את Cabinet Vision) — כאשר `.sol` הוא המרכז, ORDX פורמט-יוצא-בלבד, וכל שאר החוליות כבר בידי Soline ומאומתות.
