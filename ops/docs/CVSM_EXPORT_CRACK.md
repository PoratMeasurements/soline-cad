# CVSM_EXPORT_CRACK — פיצוח מנוע הייצוא של CVSM + ערכת bravh לדסקטופ

> reverse-engineering של **כל** יכולות הייצוא/המרה של:
> 1. אפליקציית המדידה **CVSM** (`com.roommeasure.app`, v5.3.x/5.4.0) — מ-DEX מפורק.
> 2. **ערכת bravh לדסקטופ** (`3D_OrdX.exe` ומשפחתו ב-`C:\Cabinet Vision\`) — מחרוזות בינאריות + תבניות + קבצי-פלט.
>
> מטרה: לדעת כל פורמט-פלט שהם יודעים לייצר וכיצד, כדי לקפל את הריבוי הזה אל הממיר של Soline (`ordx-pdp-converter`).
> מקורות ראייה: DEX ב-`…\scratchpad\apk540\extracted\classes*.dex`; `C:\Cabinet Vision\` (exe + `data\` + `*.ordx` + `*_report.html`); מסמכי הצד-שלנו `ordx-pdp-converter/docs/STATUS.md`, `soline-ops-app/docs/{ORDX_BRIDGE,MEASURE_APP_ANALYSIS,CONVERTER_BRIDGE}.md`.
> נכתב עבור Michael, לשון זכר. יחידות מ"מ אלא אם צוין. עודכן: 2026-08-17.

---

## 0. תקציר מנהלים — הממצא המרכזי (מתקן הנחה)

**ההנחה ש"האפליקציה חשופה רק ל-ORDX ושאר הפורמטים נעולים" — לא מדויקת.** לפי מדריך-המשתמש המובנֶה ב-APK עצמו (`assets/guide/guide_en.html`, גרסה 5.3.1+) האפליקציה **חושפת בפועל ארבעה ייצואים** בתפריט השיתוף:

- **Export ORDX (Cabinet Vision)**
- **Export 3D DXF**
- **Export PDF**
- **Export Complete Project (ZIP)** — "One package with photos, ORDX and PDF together."

אין בקוד שום פורמט **נוסף** נעול/מוסתר מעבר לארבעה האלה. אין 2D-DXF, אין PDP/`.abv` נייטיבי, אין glb/obj/gltf באפליקציה. הרישוי (`LicenseManager`) הוא **שער לכל-האפליקציה** (מייל+סיסמה+חברה מול repo של bravh ב-GitHub), **לא** שער פר-פורמט — כשמורשה, כל ארבעת הייצואים עובדים (הותקן חי: `is_licensed=true`, `license_company=SOLINE`).

**"הפורמטים הרבים" האמיתיים נמצאים בערכת הדסקטופ של bravh** (`3D_OrdX.exe`) — אפליקציית Python/Qt ארוזת-PyInstaller, שמוסיפה על האפליקציה: **דוח-HTML אינטראקטיבי** (plan+elevation+3D), **רינדור פוטוריאליסטי דרך Blender** (PNG), **רינדור AI** (OpenAI), **ייבוא DXF/DAE**, `scene_export`, פורמט-פרויקט נייטיבי JSON, וקטלוג SQLite/`.kbackup`.

**מה שאין לאף אחד מהם ושהוא היתרון של Soline:** PDP נייטיבי (Raumplan) ו-**DXF-2D** — שני אלה כבר בנויים אצלנו.

---

## 1. טבלת-אב — כל פורמט-פלט (CVSM + ערכת bravh)

מקרא מצב: **חשוף** = זמין בתפריט המשתמש · **בקוד** = מחלקה קיימת ומחווטת · **ייבוא-בלבד** = קורא ולא כותב.

| # | פורמט | סיומת | מקור | תפקיד | ראייה | מצב |
|---|---|---|---|---|---|---|
| 1 | **ORDX** (Cabinet Vision Order-XML) | `.ordx` | CVSM + bravh | הגשר הראשי; נצרך ע"י Raumplan/Cabinet-Vision והממיר שלנו | `com/roommeasure/app/export/OrdxExporter` (מתודות `generateSingleRoom`,`generateWall`,`generateFixture`,`generateCabinetAssembly`,`generateFixtureAssembly`); `<!-- CV ORDX Order XML File - Single Room Export -->`; desktop: `kitchen_app.core.ordx_exporter` + תבנית `templates\basic.ordx.xml` | **חשוף** (2 מצבים) |
| 2 | **3D DXF** (רשת 3DFACE) | `.dxf` | CVSM | ייצוא גאומטריית-חדר 3D ל-CAD | `com/roommeasure/app/utils/DxfExporter`: `appendDxfHeader`,`append3DFace`,`generateDxfContent`,`getFloorVertices`,`ExportResult`,`saveToDownloads`,`shareDxfFile`; מחרוזות `$ACADVER`,`3DFACE`,`.dxf`,`showFloor`,`floorColor` | **חשוף** |
| 3 | **PDF** (דוח תכנית + חזיתות) | `.pdf` | CVSM + bravh | דוח-הדפסה מרובה-עמודים | `com/roommeasure/app/export/PdfExporter` + `PdfExporter$SheetKind` (cover/plan/elevation), `drawCoverSheet`,`drawPlanSheet`,`DimBand`,`loadLogo`; `model/PdfExportSettings`,`PdfExportSettingsManager` | **חשוף** |
| 4 | **ZIP** (חבילת-פרויקט) | `.zip` | CVSM | photos+ORDX+PDF+raw project יחד | `utils/ProjectZipExporter`, `ProjectViewModel.exportProjectAsZip`/`shareProjectZip`, `ProjectFilesShareHelper`; guide: "One package with photos, ORDX and PDF together" | **חשוף** |
| 5 | **דוח-HTML אינטראקטיבי** | `.html` | bravh (דסקטופ) | דוח לקוח: תכנית+חזית+3D, RTL עברית, teal branding | `kitchen_app.ui.designer.interactive_export` + תבניות `templates\interactive_export\{index.html,app.js,styles.css}`; קובץ-פלט אמיתי `C:\Cabinet Vision\*_report.html` (1.7MB, `<html lang="he" dir="rtl">`, `ExportTheme`, כפתורי export/print) | חשוף (בדסקטופ) |
| 6 | **HTML export** (בסיסי) | `.html` | bravh (דסקטופ) | ייצוא-HTML נוסף (ככל הנראה סטטי/מדפסת) | `kitchen_app.ui.designer.html_export` (מודול נפרד מ-`interactive_export`) | בקוד · **צריך אימות** |
| 7 | **Scene export** | ? | bravh (דסקטופ) | סריאליזציה של סצנת-3D (כנראה מזין את ה-HTML האינטראקטיבי, או glb/obj) | `kitchen_app.ui.designer.scene_export` | בקוד · **צריך אימות** (הפורמט לא נחשף במחרוזות) |
| 8 | **רינדור Blender** | `.png` | bravh (דסקטופ) | רינדור פוטוריאליסטי | `kitchen_app.core.blender_render`,`blender_service`; `ui.designer.render_dialog`; קובץ-פלט `C:\…\3D ORDX\kitchen_render.png` (2MB) | בקוד |
| 9 | **רינדור AI** | `.png` | bravh (דסקטופ) | רינדור מבוסס-AI (OpenAI) | `kitchen_app.core.ai_render`,`kitchen_app.ai.{chatgpt_agent,agent_api,layout_solver}`; מחרוזות `openai.resources…` בתוך ה-exe | בקוד |
| 10 | **פרויקט נייטיבי** | `.json` (`kitchen_project.json`) | bravh + CVSM (מבנה שונה) | מקור-אמת פנימי | `kitchen_app.core.project_io`; קבצים `C:\…\kitchen_project*.json` (walls/rooms/customer, mm) | חשוף (Save/Open) |
| 11 | **גיבוי-קטלוג** | `.kbackup` / `catalog.sqlite` | bravh (Admin) | קטלוג-ארונות/אלמנטים | `CatalogAdmin.exe`,`KitchenCatalogAdmin.exe`,`Ordx_Admin.exe`; `kitchen_app.core.{catalog_service,database}`; `data\catalog.sqlite`, `*.kbackup` (14–16MB) | חשוף (כלי-ניהול) |
| — | DXF (ייבוא) | `.dxf` | bravh | קליטת CAD חיצוני | `kitchen_app.core.dxf_loader` (**loader**, לא exporter) | **ייבוא-בלבד** |
| — | DAE/Collada (ייבוא) | `.dae` | bravh | טעינת נכסי-3D של קטלוג | `kitchen_app.core.dae_loader`; מאות `.dae` ב-`data\Restore\assets\` | **ייבוא-בלבד** |

> **לא קיים באף צד** (חשוב לתכנון-היתרון של Soline): **PDP נייטיבי** (Raumplan `ffffff7f`), **DXF-2D** (תכנית שטוחה), ופורמטי-רשת חליפיים (glb/obj/stl/fbx). אלה בדיוק ה-delta שבו הממיר שלנו כבר מוביל.

---

## 2. איך כל ייצוא נבנה (הצינור, מחלקות, תבניות)

### 2.1 ORDX (CVSM) — `com/roommeasure/app/export/OrdxExporter`
- **פלט:** XML היררכי `Job → Rooms → Room → Walls → Wall → {Fixtures|Furnishings}` (זהה לקורפוס שלנו; ראה `ORDX_BRIDGE.md §1`).
- **מתודות שנחשפו ב-DEX:** `generateSingleRoom`, `generateWall`, ובתוך `generateWall` איסוף `fixtures`/`furnishings`/`accessoryAssemblies`, `generateFixture`, `generateFixtureAssembly`, `generateCabinetAssembly`. כלומר CVSM **כן פולט ארונות** (`CabinetAssembly`) — יותר עשיר מהקורפוס ה-ORDX ה"רזה" שראינו (שם אין ישות-ארון).
- **שני מצבים** (`utils/ExportManager$OrdxExportMode`, נשמר ב-DataStore, נבחר ב-Settings ובדיאלוג `OrdxExportModeDialog`):
  - **Single-Room** — קובץ ORDX אחד לכל החדרים/עבודה.
  - **Room-by-Room** — קובץ ORDX נפרד לכל חדר (`exportToOrdxRoomByRoom`, `shareOrdxRoomByRoom` → מרובה-קבצים בתיקיית-פרויקט).
- **חזיתות-שיתוף:** `ProjectViewModel.{exportToOrdx, shareOrdx, emailOrdx, generateOrdxStringForRoom}`. סדר הקירות ב-ORDX נגזר מ-"WALL ORDERING - Following perimeter connections" (מ-`MEASURE_APP_ANALYSIS §אלגוריתם`).
- **סימון:** ההערה בראש הקובץ `<!-- CV ORDX Order XML File - Single Room Export -->` והתווית ב-UI "Export ORDX (**Cabinet Vision**)" מקבעים את ORDX כפורמט-הבינֽה עם Cabinet-Vision/Raumplan — זה מקור תפיסת "נעול ל-ORDX": ORDX הוא ה**יחיד** שנצרך במעלה-הזרם ע"י bravh/Raumplan.

### 2.2 3D DXF (CVSM) — `com/roommeasure/app/utils/DxfExporter`
- **פלט:** DXF ASCII עם header (`$ACADVER`) וישויות **`3DFACE`** בלבד — רשת מצולעים. מקור-הגאומטריה הוא מסך התלת-ממד: `Preview3DScreenKt.buildRoomGeometry` → `floorPoints`/faces → `getFloorVertices` + `append3DFace` פר-פאה (קיר/רצפה). כולל אפשרות `showFloor`/`floorColor`.
- **טיפוסים פנימיים:** `DxfExporter$Point3D`, `DxfExporter$Face3D`, `DxfExporter$ExportResult`.
- **יעד:** `saveToDownloads` (MediaStore → `Downloads/`, וגם `files/DXF_Exports/` בהתקנה החיה) + `shareDxfFile` (Intent-שיתוף). **אין 2D-DXF** — רק תיבת-3D של החדר.
- **מגבלה:** זה ייצוא **גאומטרי-בלבד** (mesh), בלי שכבות/טקסט/מידות של CAD-2D אמיתי.

### 2.3 PDF (CVSM) — `com/roommeasure/app/export/PdfExporter`
- **פלט:** דוח-הדפסה מרובה-עמודים (בהתקנה החיה: 4 עמודים, locale `en_US`, LTR). `PdfExporter$SheetKind` = {cover, plan, elevation}.
- **צינור:** `buildSheets` → `drawCoverSheet` (מסכם `totalWalls`,`totalArea`,`totalCabinets`,`totalAccessories`,כתובת-לקוח,לוגו via `loadLogo`) → `drawPlanSheet` (תכנית עם `DimBand`/פסי-מידה, `planWalls`) → חזיתות פר-קיר. Paints: `textPaint`,`strokePaint`,`fillPaint`,`logoPaint`.
- **הגדרות:** `model/PdfExportSettings` + `PdfExportSettingsManager` (`includeCoverSheet=…`, אילו sheets, אילו פרטים, לוגו מותאם) — נגישות ב-Settings→Export Settings→PDF tab.

### 2.4 ZIP (CVSM) — `utils/ProjectZipExporter`
- **פלט:** ארכיון יחיד = צילומים + ORDX + PDF + raw project. `ProjectViewModel.{exportProjectAsZip, shareProjectZip}` + `ProjectFilesShareHelper`. זהו ה"Export Complete Project".

### 2.5 דוח-HTML אינטראקטיבי (bravh דסקטופ) — `kitchen_app.ui.designer.interactive_export`
- **פלט:** קובץ-HTML עצמאי יחיד (1.7MB בדגימה) — `<html lang="he" dir="rtl">`, מיתוג teal (`--accent:#2e7d6a`), מנוע-שכבות ב-JS (plan/elevation/3D, כפתורי toggle, layers-panel), 34 אזכורי "export" + כפתורי-print.
- **צינור:** תבניות `templates\interactive_export\{index.html, app.js, styles.css}` → `_render_html` מזריק בלוק `:root` עם `ExportTheme` (צבעי `--cab-fill`,`--cab-stroke`, קונפיגורביליים ב-Settings). הגאומטריה מוטמעת (כנראה תוצר `scene_export`).
- **PDF-בדסקטופ:** ככל הנראה דרך print-to-PDF של הדפדפן מתוך ה-HTML הזה (יש `print` + "printed in the PDF") — **צריך אימות** אם יש כותב-PDF ייעודי בדסקטופ (לא נמצאה חתימת reportlab/QPrinter במחרוזות).

### 2.6 רינדורים (bravh דסקטופ)
- **Blender:** `blender_render`+`blender_service`+`render_dialog` → PNG פוטוריאליסטי (`kitchen_render.png`).
- **AI:** `ai_render`+`ai.chatgpt_agent`/`agent_api`/`layout_solver` → תמונת-AI (OpenAI SDK מוטמע ב-exe).

### 2.7 קטלוג/רישוי (bravh)
- קטלוג: `catalog_service`+`database` על `data\catalog.sqlite`; ניהול/גיבוי דרך `CatalogAdmin.exe`/`KitchenCatalogAdmin.exe`/`Ordx_Admin.exe` → `.kbackup`.
- רישוי-דסקטופ: `kitchen_app.core.licensing.{check,cpu_id,crypto}` — כבול ל-CPU-ID (שונה ממנגנון-הענן של האפליקציה).

---

## 3. מה "נעול ל-ORDX" — ולמה (עם ראייה)

1. **אין נעילת-פורמט באפליקציה.** ארבעה ייצואים חשופים במקביל (`guide_en.html`, סעיף "J: EXPORT"): ORDX, 3D DXF, PDF, ZIP. אין flag/gate פר-פורמט. `ExportMode`/`ORDX_EXPORT_MODE_KEY` נוגעים **רק** לבחירת single-room↔room-by-room של ORDX, לא לבחירת-פורמט.
2. **הרישוי הוא כלל-אפליקטיבי.** `LicenseManager` (מייל+סיסמה+חברה+MAC מול `api.github.com/repos/bravh/RoomMeasure-Releases/contents/licenses/`) פותח/נועל את **כל** האפליקציה, לא פורמט מסוים. אין מחרוזות "export disabled/locked/premium/watermark-on-export".
3. **"נעול ל-ORDX" נכון רק במובן ה-interop:** ORDX הוא ה**יחיד** שנצרך במעלה-הזרם (Cabinet Vision / Raumplan / `3D_OrdX.exe`). ה-DXF/PDF/ZIP הם תוצרים ל**לקוח/CAD-חיצוני**, לא לצינור-הנגרות של bravh. לכן בזרימת-העבודה של Michael נראה כאילו "רק ORDX נחשב".
4. **מה שבאמת חסר (לא נעול — פשוט לא קיים):** DXF-2D, PDP נייטיבי, glb/obj. אלה ה-delta של Soline.

---

## 4. תוכנית-אינטגרציה — לקפל ריבוי-פורמטים אל `ordx-pdp-converter`

**עוגן ארכיטקטוני:** הממיר שלנו כבר בנוי כ"מחולל-אובייקטים" — מודל-אובייקט קנוני יחיד (`OBJECT_MODEL.md`) → N מייצאים (`src/export_*.js`). זה **בדיוק** התבנית של ערכת bravh (`kitchen_app.core.models` אחד → `ordx_exporter`/`interactive_export`/`scene_export`/render). כלומר אנחנו לא בונים מחדש — אנחנו **מוסיפים מייצאים** לצינור `.sol → …` הקיים.

### 4.1 מיפוי פורמט-מול-מצב אצלנו (מה יש · מה לבנות)

| פורמט (מקור-ההשראה) | מצב אצל Soline היום | פעולה |
|---|---|---|
| **ORDX** | ✅ round-trip מאומת (`src/export_ordx.js`, 2918 יוצא/נטען זהה) | **יתרון-על:** להוסיף `CabinetAssembly`/`FixtureAssembly` שראינו ב-`OrdxExporter` של CVSM (שאין בקורפוס-הרזה), כדי שגם ארונות יעברו |
| **DXF-2D** | ✅ בנוי (`src/export_dxf2d.js`; 3 מצבים, עברית) — **יתרון על CVSM שאין לו 2D** | לסגור תיקון קידוד-עברית (`\U+` לא נפתח ב-CAD; `DXF_2D_METHOD.md`) |
| **DXF-3D** | ✅ בנוי (`src/export_dxf3d.js`; W×D×H = 6×3DFACE) | ליישר לסגנון CVSM: header `$ACADVER`+`$INSUNITS`, פאות-רצפה/קיר כ-`3DFACE` (כמו `DxfExporter.append3DFace`) — כך הפלט תואם-בית לצרכני-ה-DXF של CVSM |
| **PDP** (Raumplan) | ◐ הזרקה נטענת ב-Raumplan (`src/inject.js`+`assemble.js`); חוסמים: אורך-בלוק-סמל, 3D=QUADER | **יתרון בלעדי** — ל-CVSM/bravh **אין** PDP. להמשיך את מפת-הדרכים ב-`STATUS.md` |
| **PDF** (דוח) | ❌ אין | **לבנות** `src/export_pdf.js` — cover(סיכומים)+plan+elevation, לפי מבנה `PdfExporter$SheetKind` של CVSM. RTL-עברית (יתרון על ה-PDF האנגלי-בלבד של CVSM) |
| **HTML אינטראקטיבי** | ❌ אין | **לבנות** `src/export_html.js` — דוח-לקוח RTL כמו `interactive_export` של bravh (plan/elevation/3D, layers). המודל-אובייקט שלנו כבר נושא את כל הנתונים |
| **ZIP** (חבילה) | ❌ אין | **לבנות** `src/export_zip.js` — צילומים+ORDX+PDF+`.sol` (מקביל ל-`ProjectZipExporter`) |
| **glb/obj/scene** | ❌ אין | אופציונלי/עתידי — מודל-האובייקט + DXF-3D כבר מחזיקים את הגאומטריה; מייצא-glb הוא עטיפה דקה |
| קטלוג SQLite/`.kbackup` | לא-רלוונטי | לא לייבא — יש לנו `elements.json` עצמאי (החלטת אי-תלות ב-InnoDraw) |

### 4.2 החוזה שמאפשר את הכול
כל מייצא חדש (PDF/HTML/ZIP) צורך את **אותו** מודל-אובייקט קנוני (`OBJECT_MODEL.md` / `.sol`) שכבר מזין את ORDX/DXF/PDP. אין המרות-ביניים: `render(objectModel) → bytes`. זה בדיוק מה ש-bravh עושה (`models` → מייצא), ומה שכבר עובד אצלנו ל-4 מייצאים.

### 4.3 סדר-מומלץ ותלויות
- PDF ו-HTML תלויים ב**גאומטריית-חזית** — יש לוודא ש-`.sol`/מודל-האובייקט חושף elevation פר-קיר (ה-`ORDX_BRIDGE.md §3` כבר סימן ש-`elevation`/`wallTopStyle` אובדים ב-ORDX-הרזה; ה-`.sol` חייב להחזיקם).
- ORDX-מורחב (ארונות) תלוי בהוספת ישות-`Cabinet` למודל (היום `cabinets[]` נופל בשקט בגשר — `ORDX_BRIDGE.md §3.1`).

---

## 5. פערי-ראייה / צריך אימות
- **`scene_export` (bravh):** הפורמט המדויק לא נחשף במחרוזות (module-name בלבד). ייתכן glb/obj/gltf או סתם scene-JSON ל-HTML. אין להריץ את ה-exe; אפשר לאמת ע"י פתיחת `interactive_export/app.js` המובנֶה (מוטמע ב-report.html) ולבדוק אם יש שם רשת-3D.
- **`html_export` מול `interactive_export`:** שני מודולים נפרדים; ההבדל (סטטי-מדפסת מול אינטראקטיבי) לא ודאי.
- **PDF בדסקטופ:** לא נמצאה חתימת reportlab/WeasyPrint/QPrinter — ייתכן שה-PDF בדסקטופ הוא רק print-to-PDF של הדפדפן מ-report.html. **צריך אימות**.
- **גרסת-מדריך:** ה-4 ייצואים מתועדים ב-guide v5.3.1; Michael מריץ 5.4.0 — סביר שזהה או עשיר יותר (`MEASURE_APP_UPDATE_5.4.0.md` יאמת).
- לא נגעתי בשום קוד. לא הורץ אף exe. כל ה-exe/DB נקראו קריאה-בלבד (מחרוזות/תבניות/קבצי-פלט).
