# Cabinet Vision + פורמט ORDX — מחקר עבור Soline

> מסמך מחקר. נכתב ב-2026-08-14. מקורות: (1) ההתקנה המקומית `C:\Cabinet Vision\`,
> (2) קורפוס ה-ORDX האמיתי ב-`G:\My Drive\קבצים ללמידת מכונה\ORDX\` + הפרסר/מייצא שלנו,
> (3) חיפוש רשת (Hexagon Nexus, iMapper, Allmoxy, Craftsman).
> קריאה בלבד — לא בוצע שינוי בשום מקור. לא אוחסן PII (שדות הלקוח בדוגמאות ריקים ממילא).

---

## 1. מה זה Cabinet Vision

**Cabinet Vision** היא תוכנת CAD/CAM מובילה לתעשיית הנגרות (ארונות מטבח, ארונות קיר,
closets, casegoods), של **Hexagon** (לשעבר Vero Software / Planit). היא מכסה את כל
השרשרת "מהמסך למכונה":

- **עיצוב** חדר וארונות פרמטריים (Room Level → Wall → Cabinet/Assembly).
- **רינדור** פוטו-ריאליסטי, הצעות מחיר, כתבי כמויות (BOM), אופטימיזציית חומר.
- **SCREEN-TO-MACHINE™ (S2M) / xMachining** — יצירה אוטומטית של G-Code ל-CNC
  (routers, point-to-point, ניסור, קידוח-ופין, edgebanders), בחירת כלי ומהירויות
  לפי גאומטריית החלק.

**מקומה בעולם של Michael:** Cabinet Vision היא ה"מנוע הייצור" בקצה. **InnoDraw / Raumplan**
הם כלי המדידה בקצה הקדמי (מודדים חדר קיים ומייצאים גאומטריה). **ORDX הוא פורמט החיבור
ביניהם.** Soline יושבת בדיוק במרחב הזה: מקבלת מדידת ORDX (InnoDraw) ומייצרת פלט לייצור.
לכן ORDX הוא יעד-פלט טבעי ל-Soline — אם מייצרים ORDX שכולל **ארונות** ולא רק את מעטפת החדר.

### ORDX = "Cabinet Vision Order XML"

- ORDX הוא **פורמט החדר הנייטיבי של Cabinet Vision**. קובץ ORDX נטען ישירות ל-CV —
  קירות, מידות וזוויות הופכים לאובייקטים נייטיביים של CV **בלי פלאגין וללא המרה**.
- ל-Hexagon יש תיעוד רשמי: "ORDX Format — CABINET VISION 2023" (Nexus), ופקודת
  ריבון **Utilities → Export ORDX / Import Order**. `ProductVersion` בקבצים = `2023`.
- קיים אח ותיק בשם **ORD** (ASCII, לא-XML) להעברת נתוני ארונות "version/config independent".
  ORDX הוא הגרסה המודרנית מבוססת-XML.
- אינטגרטורים צד-ג' שכבר מייצאים ORDX ל-CV: **iMapper** (סורק חדר), **Allmoxy**, וכן
  הכלי המקומי שמתואר בסעיף 2.

---

## 2. מה באמת יושב ב-`C:\Cabinet Vision\` (ממצא חשוב)

**התיקייה איננה תוכנת Hexagon Cabinet Vision.** זו אפליקציית **גשר/תרגום ישראלית** צד-ג'.

הקבצים:

| קובץ | מה זה |
|------|--------|
| `3D_OrdX.exe` (80MB) | אפליקציית שולחן-עבודה מלאה בשם **`kitchen_app`** |
| `CatalogAdmin.exe`, `KitchenCatalogAdmin.exe` | ניהול קטלוג הארונות |
| `OrdX_TrialLicense.exe` | מנהל רישוי (trial) |
| `data\catalog.sqlite`, `*.kbackup` | קטלוג הארונות/פריטים |
| `kitchen_project.json`, `kitchen_project1.json` | פורמט **הפרויקט הפנימי** של האפליקציה (עברית, פורמט Soline-דומה) |

`3D_OrdX.exe` הוא חבילת **PyInstaller** (Python 3.11) עם **PySide/Qt**, ממותגת "elsop"
(`elsop_logo.png`, `design_rules_il.json` = חוקי עיצוב מטבח ישראליים). חילצתי את
טבלת הקבצים המוטמעת — המודולים המרכזיים:

```
kitchen_app.core.ordx_room_importer   ← קורא ORDX (כולל את מדידות InnoDraw)
kitchen_app.core.ordx_exporter        ← כותב ORDX ש-Cabinet Vision מייבא
kitchen_app.core.blender_render / blender_service / blender_script.py  ← רינדור 3D דרך Blender
kitchen_app.core.catalog_service / database  ← catalog.db
kitchen_app.core.dae_loader / dxf_loader / model_loader
kitchen_app.core.design_rules (design_rules_il.json)
kitchen_app.ai.chatgpt_agent / agent_api / layout_solver  ← סוכן AI לפריסת מטבח
kitchen_app.ui.designer.{plan_view, elevation_view, viewport_3d, render_dialog, ...}
kitchen_app.templates.basic.ordx.xml  ← שלד ORDX בסיס
```

כלומר: זהו כלי שמקבל מדידת חדר (ORDX של InnoDraw), נותן לך לעצב מטבח (ידנית או ע"י AI),
מרנדר ב-Blender, ו**מייצא ORDX חדש עם ארונות ש-Cabinet Vision האמיתית מייבאת**.
**זהו בדיוק סוג המוצר ש-Soline בונה** — כלי מקביל/מתחרה, ולכן מקור-לימוד מצוין.

> ה-docstring של המודול אומר במפורש: `"ORDX (Cabinet Vision Order XML) exporter."`

---

## 3. סכימת ORDX המלאה

חשוב להבחין בין **שתי שכבות** של ORDX:

### 3א. מה שהקורפוס האמיתי שלנו מכיל (מדידת InnoDraw)

ששת הקבצים ב-`קבצים ללמידת מכונה\ORDX\` הם **מדידת מעטפת חדר** בלבד. ספירת תגים בפועל:
`Job/Unit/Rooms/Room/Walls/Wall` ואז לכל קיר `Number, Description, Position(StartX,
StartY, Angle, EndX, EndY), Type/Style, Dimensions(Height, Thick, VaultHeight)`, ותחת
`Furnishings/Furnishing` פריטים עם `Catalog(=InnoDraw), Properties/General(Name, Class,
Type, Width/Depth/Height, Size), Position(X, Y, Z)`.

עובדות מהקורפוס:
- **157 `<Furnishing>` — אפס `<Fixture>`.** InnoDraw כותב הכול כ-Furnishing. הענף
  `Fixtures/Fixture` בפרסר שלנו הוא ספקולטיבי (לא מופיע בדוגמאות).
- **אין** `ProductVersion`, `RoomProperties`, `Customer/ShipTo`, `Assemblies` בקורפוס.
- `Z` מופיע ב-47 פריטים בלבד (גובה על הקיר / offset מהמישור). הפרסר שלנו **מתעלם מ-Z**.
- קואורדינטות ב-**6 ספרות עשרוניות** (`2770.000000`).
- מידות Furnishing = מספרים שלמים ישירות תחת `<General>` (`<Width>80</Width>`), עם
  `<Size></Size>` ריק; חלונות/דלתות מקננים תחת `<Size>`.

### 3ב. הסכימה המלאה של Cabinet Vision (מה שהיצואן של kitchen_app כותב)

חילוץ קבועי-המחרוזות מ-`ordx_exporter`/`ordx_room_importer` (מתוך `3D_OrdX.exe`) חשף את
**אוצר התגים המלא** של ORDX — הרבה מעבר לקורפוס. השלד:

```
<Job Created="...">
  <ProductVersion>2023</ProductVersion>
  <Unit>mm</Unit>
  <Properties><Job><Information>
    <Job><Name/><Description/></Job>
    <Customer>  <Name/><Address1/><Address2/><City/><State/><Zip/>
                <Email/><Phone/><Mobile/><Fax/><Contact/><Comment/> </Customer>
    <ShipTo> …אותם שדות… </ShipTo>
  </Information></Job></Properties>
  <Rooms><Room>
    <RoomProperties><Room><General><Name>…</Name></General></Room></RoomProperties>
    <Walls><Wall>
      <Number/><Description/>
      <Position><StartX/><StartY/><Angle/><EndX/><EndY/></Position>
      <Curve><Radius/><ArcAngle/><BeginAngle/><EndAngle/><CenterX/><CenterY/></Curve>   ← קיר מעוקל
      <Type><Style>Standard</Style></Type>
      <Dimensions><Length/><Height/><Soffit/><Thick/><VaultHeight/></Dimensions>
      <Fixtures><Fixture>…</Fixture></Fixtures>        ← אביזרים (שקעים, ברז…)
      <Furnishings><Furnishing>                         ← חלונות/דלתות/אביזרים
        <Catalog/>
        <Properties><General><Name/><Class/><Type/><Size><Width/><Height/><Depth/></Size></General></Properties>
        <Position><X/><Y/><Z/></Position>
      </Furnishing></Furnishings>
    </Wall></Walls>
    <Assemblies><Assembly>                              ← ★ הארונות עצמם (חסר לגמרי בקורפוס) ★
      <Catalog/>
      <Properties><General>…</General><Attributes><Comment/>…</Attributes></Properties>
      <Position>…</Position>
      <WallFace/><WallEnd/><FaceN/><OpenN/><Perspective/>
      <Toe><ToeHeight/></Toe>
      <Parameters><Parameter><Name/><Value/></Parameter></Parameters>
      <Sections><Section>…<Split/>…<AdditionalParts/>…</Section></Sections>
      <Cabinet/> / <Closets/>
    </Assembly></Assemblies>
  </Room></Rooms>
</Job>
```

תגים חדשים שהפרסר שלנו לא מכיר: `ProductVersion`, `Curve/Radius/ArcAngle/BeginAngle/
EndAngle/CenterX/CenterY` (קירות מעוקלים), וכל בלוק **`Assemblies/Assembly`** על תת-העץ שלו
(`Sections/Section`, `Parameters/Parameter`, `Attributes`, `Toe`, `Split`, `WallFace`,
`WallEnd`, `AdditionalParts`, `Perspective`, `Cabinet`, `Closets`). הפרסר שלנו כן מכסה כבר
`Customer/ShipTo` ו-`RoomProperties/Room/General` (ספקולטיבית — עכשיו מאושר שהם חוקיים).

---

## 4. איך כותבים ORDX ש-Cabinet Vision מקבל

זה החלק היקר. ה-docstrings של `ordx_exporter` (חולצו מהבינארי) מנסחים את הכללים כמעט מילה-במילה:

1. **מבנה חובה + סדר.** שלד: `Job → ProductVersion → Unit → [Properties] → Rooms → Room →
   [RoomProperties] → Walls → Assemblies`. `<Assemblies>` הוא **אח של `<Walls>`** ברמת ה-Room
   (ראה `basic.ordx.xml`). גם `<Walls></Walls>` ריק ו-`<Assemblies></Assemblies>` ריק חוקיים.

2. **קידוד ומספרים.** `encoding="UTF-8"`, `<Unit>mm</Unit>`.
   - kitchen_app מפרמט צפים ב-**3 ספרות עשרוניות** ("Format a float the way Cabinet Vision
     expects (3 decimals)"). InnoDraw משתמש ב-6 — **שתי הצורות מתקבלות** ב-import.
   - פרמטרים של ארונות מקודדים כמחרוזות קומפקטיות: `DX1570`, `X304.6`.

3. **קירות.** `<Angle>` = "Cabinet Vision wall angle in degrees (Y-up convention)".
   הקירות **מסודרים לפי היקף החדר** (start-to-end, מהקיר העליון/Y-הקטן) — אחרת CV לא
   משחזר את החדר נכון: "Walls are re-ordered to follow the room perimeter … Cabinet Vision
   reconstructs the room correctly." `EndX/EndY` **אופציונליים** — אם קיימים הם דורסים את
   אורך הקיר.

4. **ארונות (Assemblies) — הליבה.** אי אפשר "להמציא" ארון מאפס. השיטה של kitchen_app:
   - כל פריט קטלוג נושא **בלוק ORDX-תבנית שנלכד מ-ייצוא CV אמיתי** של אותו ארון:
     "The template is the exact block Cabinet Vision exported for the item… XML imported
     from Cabinet Vision for that item."
   - בשינוי-מידה, **מכווננים מחדש** את `<Sections>` ואת `<Parameters>` (retune) כדי לשמר
     reveals/מרווחים/עובי מחיצות: "Cabinet Vision keeps every reveal, gap and partition
     thickness"; "Distribute a cabinet size change across one axis of the sections."
     בלי זה — "a resized cabinet exports with the template's original [dimensions]".
   - **כל ארון חייב להיות מחובר לקיר** (הגב נוגע בפני הקיר): "Every cabinet must be
     attached to a wall / must sit on a wall." ארון צף → שגיאת ייצוא.
   - כל פריט מפנה ל**קטלוג CV מקודד-קשיח** לפי שם/class/type שנלכדו בזמן ההצבה.
   - הערות: פרמטר `COMMENT` תחת `Properties/Attributes`.

5. **ה-Importer.** `3D_OrdX.exe` הוא ה-importer/exporter של הגשר הזה (Python). ל-Cabinet
   Vision עצמה: `Utilities → Import Order` / `Export ORDX` בריבון. אין צורך בפלאגין — ORDX
   נטען נייטיבית. אין CLI ידוע ל-CV; ה-import הוא דרך ה-GUI.

---

## 5. פערים ב-`src/export_ordx.js` שלנו

המייצא הנוכחי עושה round-trip מושלם מול הפרסר שלנו, אבל מייצר **מעטפת חדר בלבד** (walls +
furnishings), בדיוק כמו מדידת InnoDraw. כדי ש-Cabinet Vision יקבל פלט **עם ארונות** חסר:

| # | פער | חומרה |
|---|------|--------|
| 1 | **אין `<Assemblies>` כלל.** זה הפער הקריטי — בלי Assembly אין ארונות, רק חדר ריק. נדרש בלוק-תבנית לכל פריט קטלוג + retune של Sections/Parameters. | חוסם |
| 2 | **`<ProductVersion>`** לא נכתב. CV מצפה לו (`2023`). ה-`basic.ordx.xml` פותח בו. | בינוני |
| 3 | **`Z` לא עובר round-trip בפרסר** (`parseOrdx.js` קורא רק X,Y ב-`parsePlacedItem`). המייצא כן כותב Z אם קיים במודל, אבל הפרסר מאבד אותו — מידע גובה של אביזרים אובד. | בינוני |
| 4 | **קירות מעוקלים** (`<Curve>`) לא נתמכים בפרסר ולא במייצא. | נמוך (הקורפוס ישר) |
| 5 | **סדר קירות לפי היקף** לא נאכף — אנחנו משמרים סדר קלט. לייצוא-CV נדרש re-order. | בינוני |
| 6 | פורמט צפים: אנו כותבים 6 ספרות (כמו InnoDraw). CV מקבל, אך kitchen_app מנרמל ל-3. לא חוסם. | נמוך |
| 7 | הבחנת `Fixture` מול `Furnishing`: הקורפוס כולו Furnishing; ודא שהמיפוי של Soline לא מייצר Fixtures שאין להם מקבילה. | נמוך |

הערה: הפרסר/מייצא שלנו **כבר** תומכים ב-`Customer/ShipTo`, `RoomProperties`, `Dimensions`
מלא — אלה מאושרים עכשיו כתגים חוקיים בסכימת CV.

---

## 6. המלצה: האם ORDX→Cabinet Vision הוא יעד-פלט מעשי ל-Soline?

**כן, בתנאי — ומדורג.** יש להפריד שתי רמות שאפתנות:

- **רמה A — מעטפת חדר (מיידי, קל).** לייצא ORDX עם `Walls + Fixtures/Furnishings` (חלונות,
  דלתות, שקעים, פתחים). זה כמעט מוכן היום ב-`export_ordx.js`; CV יטען את החדר נייטיבית.
  ערך: Soline הופכת ל"iMapper ישראלי" — מזינה חדר מדוד ישר ל-CV.
- **רמה B — ארונות מלאים (הערך האמיתי, קשה).** דורש בלוקי-תבנית `Assembly` שנלכדו מ-ייצוא
  CV אמיתי לכל פריט קטלוג, + מנוע retune ל-Sections/Parameters. זו בדיוק הארכיטקטורה של
  kitchen_app, וניתנת לחיקוי — אבל תלויה בגישה לקטלוג CV ולדגימות ייצוא אמיתיות.

**שלושת הצעדים להשלמת המייצא:**

1. **לסגור את מעטפת-החדר (רמה A) ולהוסיף `ProductVersion` + תיקון round-trip של `Z`.**
   שינוי קטן ב-`parseOrdx.js` (לקרוא `Z`) וב-`export_ordx.js` (לפלוט `<ProductVersion>2023</ProductVersion>`).
   מייד נותן ORDX שנטען ב-CV כחדר תקין.
2. **לבנות מנגנון תבניות-Assembly:** ללכוד ייצוא ORDX אמיתי מ-Cabinet Vision לכל ארון-בסיס
   בקטלוג של Soline, לאחסן כ"template block", ולממש retune של `<Sections>`/`<Parameters>`
   לפי מידה — כמו `_retune_sections`/`_retune_cab_params` ב-kitchen_app. (אפשר להנדס-לאחור
   את המודולים האלה מ-`3D_OrdX.exe` שכבר בידינו כמקור-לימוד.)
3. **לאכוף את חוקי ה-import של CV:** מיון קירות לפי היקף (Y-up), חיבור כל Assembly לקיר
   (`WallFace`/`WallEnd`/`Position`), ואימות "אין ארון צף" לפני כתיבה — ואז לאמת בפועל
   ב-Import Order של Cabinet Vision 2023.

---

## נספח: מקורות בינאריים שחולצו (scratchpad, לא בריפו)

- `basic.ordx.xml` (394B) — שלד ה-ORDX של kitchen_app (מקור לסעיף 3ב/4).
- `design_rules_il.json` (17.9KB) — חוקי עיצוב מטבח ישראליים (SII, נגישות 1918, מרווחים).
- `pyzmod_4467585.marshal` — קוד `ordx_exporter`/`ordx_room_importer` (מקור אוצר-התגים וה-docstrings).

## מקורות רשת

- [ORDX Format — CABINET VISION 2023 (Hexagon Nexus)](https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2023_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Export_ORDX/ORDX.Format.xhtml)
- [CABINET VISION — Hexagon](https://hexagon.com/products/product-groups/computer-aided-manufacturing-cad-cam-software/cabinet-vision)
- [CABINET VISION xMachining (Screen-to-Machine)](https://hexagon.com/products/cabinet-vision-xmachining)
- [ORD File Format — Planit/CV Help](http://content.planit.com/cv/Help/CV_Help/Room_Level/Ribbonbar/Utilities_Tab/Import_Order/ORD_File_Format.htm)
- [iMapper → Cabinet Vision (native ORDX)](https://www.imapper.tech/integrations/cabinet-vision)
- [Allmoxy → Cabinet Vision (.ord/.ordx)](https://articles.allmoxy.com/connecting-allmoxy-to-industry-partner-software)
