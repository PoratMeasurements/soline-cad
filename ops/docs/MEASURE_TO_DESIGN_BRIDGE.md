# הגשר מדידה → עיצוב: CVSM → ORDX → 3D OrdX → Cabinet Vision

> תיעוד אינטגרציה של הצינור בפועל בין **תוכנת המדידה** (CVSM / `com.roommeasure.app`, מייצאת ORDX) לבין **סביבת העיצוב** דרך **כלי ה-3D OrdX**.
> מבוסס על חקירת read-only של התוכנות המותקנות במחשב של Michael (16/08/2026), הקורפוס ב-`docs/`, והדגימות האמיתיות.
> יחידות מ"מ. לשון זכר. נכתב עבור Soline.

---

## 0. תקציר מנהלים

הצינור בפועל הוא **שלוש חוליות**:

```
[טאבלט] CVSM / RoomMeasure  ──exportToOrdx──▶  קובץ .ordx  ──יבוא──▶  3D_OrdX.exe  ──▶  { .abv (עיצוב מלא) · _report.html · .pdf · .ordx מועשר }  ──▶  Cabinet Vision (ייצור/ניסור)
        (מדידת שטח)            "CV ORDX Order XML"        (עיצוב 3D + קטלוג)                                                        (CAD מקצועי, צד ג')
```

**שלוש מסקנות מרכזיות שצריך להפנים:**

1. **"Cabinet Vision" במחשב הזה אינו Cabinet Vision.** התיקייה `C:\Cabinet Vision` **אינה** התקנה של תוכנת ה-CAD המקצועית של Hexagon/Planit — היא פשוט העתק של ערכת הכלים של **3D OrdX** (אותם 5 קבצי exe + `data\catalog.sqlite`). **אין במחשב שום התקנה אמיתית של Cabinet Vision.** ה-ORDX נושא הערה `<!-- CV ORDX Order XML File -->` ו-`<ProductVersion>2025</ProductVersion>` — זהו פורמט היבוא ש-Cabinet Vision *יודע* לצרוך, אבל בפועל מי שצורך אותו כאן הוא כלי ה-3D OrdX.

2. **כלי ה-3D OrdX הוא היכן שקורה העיצוב.** `3D_OrdX.exe` הוא **אפליקציית Python ארוזה ב-PyInstaller** (לא Electron, לא C++), עם ממשק PyQt/PySide, מיתוג טורקיז (`#2e7d6a`), עברית RTL. היא מייבאת את ה-ORDX מהמדידה, טוענת עליו **קטלוג ארונות/אביזרים/גימורים תלת-ממדי** (`catalog.sqlite` + מודלי `.dae`), מאפשרת לעצב, ומוציאה: פורמט-נייטיב `.abv`, דו"ח HTML אינטראקטיבי, PDF, ו-ORDX מועשר.

3. **הצינור הזה נשלט-בר-החלפה עבור Soline.** הכלי בנוי ב-Python והדו"ח שהוא מפיק מכיל הערות-מקור המפנות ל-`ui/shared/splash_screen.py`, `interactive_export.py`, ואף ל-`.claude/skills/interactive-html-export/SKILL.md` — כלומר הוא פותח באמצעות Claude Code על-ידי גורם פיתוח (ככל הנראה "bravh" — אותו repo של אפליקציית המדידה). Soline הוא ה-**licensee** (`license_company=SOLINE`), לא הבעלים. כבר קיים ב-`soline-cad-engine` אב-טיפוס עצמאי של Soline שמייצר DXF+דו"ח מאותו מודל — כלומר החלופה כבר החלה.

---

## 1. הפייפליין המלא בפועל

### חוליה 1 — CVSM (המדידה) → קובץ .ordx
- אפליקציית אנדרואיד `com.roommeasure.app` ("CVSM", v5.2.0), offline-first (Room DB).
- הפעולה `ProjectViewModel.exportToOrdx` / `exportToOrdxRoomByRoom` יוצרת קובץ `.ordx` (XML), ומשתפת אותו דרך `shareOrdx`/`emailOrdx`/`exportProjectAsZip` (יעדי שיתוף כוללים Odoo ואיש-קשר "פורת מידות").
- תוכן ה-ORDX: `Job → Rooms → Room → Walls → Wall → {Fixtures|Furnishings}` + בלוק לקוח/ShipTo. פירוט מלא ב-`ORDX_BRIDGE.md`. דגימה: `docs/samples/measure_export_sample.ordx`.
- **מה נכנס לקובץ:** גאומטריית קירות (Start/End/Angle/Length/Height/Thick/VaultHeight), אביזרים ממוקמים על הקיר (שקע/חלון/הנמכת-תקרה-עם-מזגן, כולל פרמטרי חריץ `SLOTX/Y/DX/DY`). **מה לא נכנס:** ארונות (`<Cabinet>` נשאר ריק), גרף-חיבוריות, קירות מעוקלים, סטטוס-נקודה — ראה §5.

### חוליה 2 — 3D_OrdX.exe: יבוא ORDX, עיצוב, ייצוא
זהו לב הגשר. הכלי:
1. **מייבא** את קובץ ה-`.ordx` ובונה ממנו סצנת חדר תלת-ממדית (הקירות/אביזרים מה-XML).
2. **טוען קטלוג** מ-`data\catalog.sqlite` — ארונות (`catalog_items`) ואביזרים (`accessory_items`), כל פריט עם מודל `.dae` (COLLADA, ב-`data\Restore\assets\*.dae`), תמונת preview, מחלקה (`cabinet_class` Base/…), וגימורים (`materials`: Charcoal/Cream/Navy/Sage Green/Warm Oak/…).
3. **מאפשר עיצוב** — הצבת ארונות ואביזרים על הקירות, בחירת גימורים, סיבוב/מיקום (‎`CABDims`/`CABRot` בקובץ הנייטיב).
4. **מייצר פלטים** (ראו את הדגימות בתיקיות):
   - **`.abv`** — פורמט-נייטיב של הכלי (OLE Compound Document). נושא את **העיצוב המלא**: streams `Root Entry / Contents / Version / Header`, ובתוכם `CABDims DX…,DY…,DZ…`, `CABRot AX…,AY…,AZ…`, `BackFace`, וכן `Cache.xml` דחוס (סצנת-מטמון). **זה הפורמט היחיד שמחזיק את הארונות** — ORDX לא.
   - **`_report.html`** — דו"ח "Kitchen Design Report" אינטראקטיבי, RTL עברית, print-ready ל-PDF. נוצר ע"י מודול `interactive_export.py` (מחלקת `ExportTheme`, פונקציה `_render_html`). מזכיר "Cabinet Vision" 13 פעם.
   - **`.pdf`** — גרסת PDF של אותו דו"ח.
   - **`.ordx` מועשר** — ORDX חוזר (בדגימה: `C:\Cabinet Vision\פרוייקט לדוגמה.ordx`). **הערה קריטית:** בבלוק `<RoomProperties>` יש כעת `<Cabinet></Cabinet><Closets></Closets>` אבל **הם ריקים** — כלומר גם ה-ORDX שיוצא מ-3D OrdX **אינו** נושא את הארונות שעוצבו. הארונות נשארים כלואים ב-`.abv`.
   - פורמט-JSON נלווה (`kitchen_project.json`) — פרויקט הכלי כ-JSON: `name/units/customer/rooms[].walls[]` + `metadata/finish_overrides/finish_rotation_overrides/finish_scale_overrides` (מיפוי גימורים).

### חוליה 3 — Cabinet Vision (צד ג', לא מותקן כאן)
- Cabinet Vision הוא ה-CAD המקצועי לתכנון+ייצור נגרות (Hexagon / Planit Solutions). פורמט היבוא שלו הוא **בדיוק** ה-ORDX ("CV ORDX Order XML File", ProductVersion 2025) — משם שם הפורמט ("CV").
- **כיצד הוא צורך ORDX:** יבוא של קובץ Order XML דרך מודול ה-OrdX/InnoDraw שלו (יבוא-קובץ, לא hot-folder ולא plugin רץ). הוא קורא את הקירות והאביזרים ומייצר מהם חדר לתכנון ארונות → ניסור/CNC.
- **במחשב הזה אין Cabinet Vision** (לא ב-`Program Files`, לא ב-`Program Files (x86)`; רק `cabinet.dll` של Windows, לא קשור). לכן החוליה השלישית היא **תיאורטית/עתידית** בהתקנה הנוכחית — הזרימה נעצרת בפועל ב-3D OrdX + הדו"ח.

---

## 2. מה זה כלי 3D OrdX / OrdX — תפקיד, רישוי, תלות

**ערכת הכלים (5 קבצי exe, זהים בשתי התיקיות `C:\Cabinet Vision` ו-`Desktop\3D ORDX` / `Desktop\OrdX_TrialLicense`):**

| קובץ | גודל | תפקיד |
|---|---|---|
| `3D_OrdX.exe` | ~80MB | האפליקציה הראשית — יבוא ORDX, עיצוב 3D, ייצוא report/pdf/abv/ordx |
| `CatalogAdmin.exe` | ~79MB | ניהול קטלוג הארונות (`catalog_items`) |
| `KitchenCatalogAdmin.exe` | ~79MB | ניהול קטלוג-מטבח (וריאנט) |
| `Ordx_Admin.exe` | ~61MB | ניהול/עריכת ORDX ותבניות (`ordx_templates`) |
| `OrdX_TrialLicense.exe` | ~50MB | כלי רישוי-ניסיון (trial) |

- **טכנולוגיה:** כולם **Python ארוז ב-PyInstaller** (זוהו סמני `PyInstaller`/`_MEIPASS`/`pyi-` בכותרת ה-exe; מטא-נתוני גרסה/חברה **מוסרים** — אין ProductName/Company, טיפוסי לבנייה פנימית).
- **מסד הקטלוג** `data\catalog.sqlite` (SQLite 3, ~48KB) — 6 טבלאות:
  - `catalog_items` (ארונות): `sku, name, category, width/height/depth_mm, dae_path, cabinet_class, ordx_template, ordx_name, door_thickness_mm, toe_height_mm, has_legs, resize_rules_json, material_zones_json, snap_points_json, folder_id`.
  - `accessory_items` (אביזרים): `sku, name, element_class (Fixture/Decorative), element_type (Miscellaneous/Window/EntryDoor/Part), W/H/D, dae_path, ordx_name, light_json`. פריטי-ברירת-מחדל: Single/Multi Socket, Window, Entry Door, Toilet, Bath, Floor Drain, Gas/Water Pipe, Air Condition, Ceiling Drop, Wall Electric Line.
  - `ordx_templates`: `name, template_xml, variable_map_json` — **מנגנון המרת פריט-קטלוג ל-XML של ORDX** (תבנית + מיפוי משתנים).
  - `materials` (גימורים/צבעים), `catalog_folders` (עץ תיקיות), `categories`.
- **נכסי 3D:** `data\Restore\assets\*.dae` (COLLADA) + `.jpg` preview — הגאומטריה התלת-ממדית של הפריטים.
- **רישוי (trial):** קיים `OrdX_TrialLicense.exe` וגיבוי `.kbackup` של הקטלוג. הרישוי הוא **מנגנון trial נפרד** של ספק-הכלי (bravh), **שונה** ממנגנון הרישוי של אפליקציית המדידה (שם הרישיונות הם קבצים ב-repo `bravh/RoomMeasure-Releases/licenses/`). המשמעות: השימוש ב-3D OrdX תלוי ברישיון-ניסיון שיפוג — **תלות-רישוי חיצונית**.
- **תלות:** (א) פורמט ORDX כקלט; (ב) `catalog.sqlite` + נכסי `.dae` כתוכן; (ג) רישיון trial; (ד) Cabinet Vision במורד-הזרם (אם רוצים להגיע לייצור מקצועי).

---

## 3. Cabinet Vision — מה הוא ואיך צורך ORDX

- **מהו:** תוכנת CAD/CAM מובילה לתכנון וייצור נגרות (ארונות, מטבחים) של Hexagon/Planit Solutions. מייצרת רשימות-חיתוך, ניסור, ותוכניות ייצור.
- **גרסה רלוונטית:** ה-ORDX מסומן `ProductVersion 2025` → תואם למחזור Cabinet Vision 2025.
- **כיצד הוא צורך ORDX:** דרך יבוא-קובץ Order XML (מודול OrdX/InnoDraw) — הזרמת חדר-נמדד פנימה. **לא** hot-folder ו**לא** plugin רץ ברקע; זו פעולת יבוא ידנית של הקובץ.
- **מגבלה:** ORDX-הליבה נושא קירות+אביזרים בלבד. הארונות שמעוצבים ב-3D OrdX **אינם** עוברים ב-ORDX (הם ב-`.abv`), כך שהמעבר ל-Cabinet Vision מוסר את שכבת-העיצוב — Cabinet Vision מקבל את החדר הריק ומצפה שהמעצב ישרטט בו ארונות מחדש.

---

## 4. המשמעות ל-Soline — שליטה והחלפה של הגשר

**התמונה האסטרטגית: Soline כבר מחזיק את כל החוליות מלבד Cabinet Vision עצמו, וגם את אלה הוא יכול לעקוף.**

1. **החוליה החלשה = 3D OrdX, והיא בת-החלפה.** זו אפליקציית Python של ספק חיצוני (bravh) על רישיון-ניסיון, שמאבדת מידע (הארונות לא נכתבים ל-ORDX). Soline לא צריך להיות תלוי בה. `soline-cad-engine` (Node טהור, ללא תלויות) כבר מייצר **DXF 2D+3D + דו"ח HTML/PDF** מאותו מודל גאומטרי מאומת — כלומר Soline יכול להחליף את 3D OrdX ב**מנוע משלו** שמייצר את אותם פלטים (עיצוב, דו"ח, CAD) בלי רישיון-צד-ג'.

2. **הנתיב הישיר: מדידה → `.sol` → פלטים.** במקום `CVSM → ORDX → 3D OrdX`, Soline יכול:
   - לקבל את מודל-המדידה הקנוני (JSON של אפליקציית המדידה / `.sol`),
   - להזין אותו ל-`soline-cad-engine` (DXF+דו"ח) ול**ממיר של Soline** (`ordx-pdp-converter`) ל-DXF/PDP/`.sol`,
   - ולייצא ORDX תקני **רק** כאשר צריך להזין Cabinet Vision של צד-ג'. כך ORDX הופך ל**פורמט-החלפה יוצא** ולא לחוליה-פנימית-הכרחית.

3. **קטלוג = נכס להשתלטות.** מבנה `catalog.sqlite` (ארונות עם `dae_path`+`ordx_template`+`resize_rules`+`snap_points`, אביזרים עם `element_class/type`, גימורים) הוא **בדיוק** קטלוג-האלמנטים שחזון `.sol` צריך. Soline יכול לאמץ/לשכפל את הסכימה הזו כקטלוג `.sol` — כולל מנגנון `ordx_templates` (תבנית XML + מיפוי-משתנים) כדי לייצר ORDX פר-פריט בבקרה מלאה.

4. **חיבור לחזון `.sol` ולממיר:** `.abv` מוכיח שקיים כבר פורמט-נייטיב שמחזיק עיצוב-ארונות מלא (CABDims/CABRot/BackFace/Cache.xml) — בדיוק מה ש-`.sol` שואף להיות, אבל בפורמט OLE סגור של צד-ג'. `.sol` יחליף אותו כמקור-אמת פתוח של Soline, וה-`ordx-pdp-converter` יגשר ממנו החוצה ל-ORDX (ל-Cabinet Vision) ול-PDP (ל-CAD הפנימי). כלומר: **`.sol` = מה ש-`.abv` הוא, פתוח ובשליטת Soline.**

5. **מהלך מיידי מומלץ:** לפצח את `ordx_templates.template_xml` + `variable_map_json` (כרגע ריקים/מינימליים בקטלוג הזה) — הם המפתח לכתיבת ארונות **חזרה** ל-ORDX, מה ש-3D OrdX עצמו לא עושה. אם Soline יודע למלא את `<Cabinet>` ב-ORDX, הוא מייתר את 3D OrdX לחלוטין בזרימה ל-Cabinet Vision.

---

## 5. פערים וסיכונים

| # | פער / סיכון | חומרה | פירוט |
|---|---|---|---|
| 1 | **ארונות לא עוברים ב-ORDX** | קריטית | גם ה-ORDX מהמדידה וגם המועשר מ-3D OrdX משאירים `<Cabinet></Cabinet>` ריק. שכבת-העיצוב חיה רק ב-`.abv` הסגור. מעבר ל-Cabinet Vision מאבד את הארונות. |
| 2 | **תלות ברישיון trial של 3D OrdX** | גבוהה | `OrdX_TrialLicense.exe` — רישיון-ניסיון של ספק חיצוני שיפוג. שונה ממנגנון הרישוי של אפליקציית המדידה. סיכון-המשכיות. |
| 3 | **`.abv` פורמט סגור (OLE Compound)** | גבוהה | פורמט-הנייטיב היחיד שמחזיק עיצוב מלא הוא בינארי-קנייני של צד-ג'. אין round-trip פתוח. `.sol` צריך להחליפו. |
| 4 | **אין Cabinet Vision מותקן** | בינונית | החוליה השלישית אינה קיימת בפועל במחשב — הזרימה נעצרת ב-3D OrdX+דו"ח. תלות עתידית ברישיון Cabinet Vision יקר של Hexagon. |
| 5 | **אובדן-מידע ב-ORDX-הליבה** | בינונית-גבוהה | קירות מעוקלים, גרף-חיבוריות, wallTopStyle (LEFT/RIGHT), face, elevation, סטטוס-נקודה — כולם נושרים (ראה `ORDX_BRIDGE.md` §3). |
| 6 | **כלי חיצוני של "bravh"** | בינונית | גם אפליקציית המדידה וגם 3D OrdX מגיעים מאותו ספק/repo (`bravh`). Soline הוא licensee בלבד — תלות ספק יחיד לכל הצינור. |
| 7 | **`ordx_templates` לא מפוענח** | בינונית | מנגנון פריט-קטלוג→ORDX (`template_xml`+`variable_map_json`) הוא המפתח לכתיבת ארונות ל-ORDX; טרם פוענח (ריק/מינימלי בקטלוג הנוכחי). |

---

## נספח — מה נמצא בכל נתיב ומה לא היה נגיש

**`C:\Cabinet Vision`** — **אינו** Cabinet Vision אמיתי; העתק של ערכת 3D OrdX: 5 exe (3D_OrdX, CatalogAdmin, KitchenCatalogAdmin, Ordx_Admin, OrdX_TrialLicense), `data\catalog.sqlite` (נקראה הסכימה המלאה), `data\Restore\assets\*.dae`+`.jpg` (מודלי 3D), 2× `.kbackup` (גיבויי קטלוג), `kitchen_project.json`+`kitchen_project1.json` (פרויקטים כ-JSON, נקראו), `פרוייקט לדוגמה.ordx` (ORDX מועשר — נבדק, ארונות ריקים), `פרוייקט_לדוגמה_report.html` (דו"ח, נקראו הכותרת+הערות-המקור).

**`C:\Users\michael sibony\Desktop\3D ORDX`** — קבצי דגימה: `bavli-5_Ktchn_ADORE-CONCEPT_Hen_DR1.ordx`, `kitchen_project.json`, `kitchen_render.png`, תיקיית `מדידה מטבח קיים בדיקה\` (מטבח קיים.ordx+.pdf), ותיקיית פרויקט מלאה `פרוייקט לדוגמה_20260407_222642\` הכוללת `.abv` (נותח — OLE עם CABDims/CABRot/Cache.xml), `.ordx`, `.pdf`, `photos\`, `documents\`. **אין** README/config/log נפרד — הקונפיג הוא ה-`catalog.sqlite`.

**`C:\Users\michael sibony\Desktop\OrdX_TrialLicense`** + **`.zip`** — 3 exe (3D_OrdX, OrdX_TrialLicense, Ordx_Admin) + `.kbackup`. ה-zip (~204MB) זהה בתוכן לתיקייה (ארכיב הפצה). אין קובץ-רישיון גלוי (`.lic`/`.key`) בדיסק — הרישוי מנוהל בתוך `OrdX_TrialLicense.exe`.

**מה לא היה נגיש / לא בוצע (מדיניות read-only):** לא הורץ אף exe. קוד-המקור של Python של 3D OrdX **ארוז ב-PyInstaller** ולא חולץ (זוהתה רק הטכנולוגיה + מודולים מוזכרים בהערות הדו"ח: `ui/shared/splash_screen.py`, `interactive_export.py`, `_render_html`, `ExportTheme`). תוכן `ordx_templates.template_xml` לא נקרא (דורש שאילתת SQLite; `sqlite3`/Python לא מותקנים — נקראה סכימת הטבלאות בלבד). מטא-נתוני גרסה/חברה של ה-exe מוסרים. אין Cabinet Vision מותקן לבדיקה ישירה.
