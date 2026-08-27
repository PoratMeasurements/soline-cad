# INNODRAW_FEATURES — קטלוג פונקציות מלא של תוכנת InnoDraw / eLCad ("ELC")

> **מטרה:** הנדסה-לאחור סטטית של תוכנת השולחן-עבודה **InnoDraw** (הקובץ `eLCad.exe`, מותג "ElCad"/"ELC") — הבסיס שמאחורי פורמט המדידה **ORDX** ואב-הטיפוס של אפליקציית CVSM שכבר פענחנו. המסמך מרכז **כל פונקציה/כלי/פיצ'ר** של התוכנה, מקבץ לפי תחום, ולכל פונקציה נותן: מה עושה · סטטוס אצלנו · המלצת-אימוץ ל-Soline Measure.
>
> **שיטה (ניתוח סטטי בלבד — לא הופעל אף .exe):** ספירת עץ-ההתקנה המלא · חילוץ טקסט משני מדריכי-ה-PDF הרשמיים (`InnoDraw User Manual for KB&B` ו-`Countertops`) · קריאת קבצי-התפריט (`eLMenuEn/He`), קבצי-ה-tooltips (`eLToolTipsLbls`, 96 פקודות), קטלוג-האלמנטים (`eLObstaclesIconsCategories`), Layers/LineTypes/Options · סריקת-בייטים של `eLCad.exe` (15,758 מחרוזות ASCII) לשמות-מחלקות ופורמטים.
>
> גרסה 1.0 · 2026-08-17 · עברית · לשון זכר. סומן **"צריך אימות"** היכן שהראיה דקה.

---

## 0. מה זה InnoDraw בעצם (תמונת-על)

InnoDraw / ElCad היא **מערכת CAD מקצועית למדידה, שרטוט ותבניות (templating)** לשוק המטבחים, האמבטיות ובעיקר **ייצור משטחי-אבן/קוורץ (Countertops)**. היא ותיקה (גרסאות Elcad 5712–6120, מדריכים מ-2015), רצה על Windows, ומונעת על-ידי **מד-לייזר Leica DISTO ("DSTO"/"Elco")** בבלוטות'.

- **שלושה גרסאות-בינארי מותקנות:** `eLCad_ktn.exe` (מטבחים KTN), `eLCad_ct.exe`/`elcad.exe` (קאונטרטופ CT), ו-`eLCad.exe` (הליבה, בשתי תיקיות-גרסה 9504/9505). כלומר לאותו מנוע יש **פרופיל-מטבחים** ו**פרופיל-קאונטרטופ** — בדיוק הפיצול שאנחנו רואים ב-ORDX.
- **פורמט-מקור native = `.elc`** (שם-קובץ: `[Job]_[Area]_[Company]_[Branch]_DR1.elc`). זהו האב של ORDX/PDP.
- **ייצוא לא-מקומי:** התוכנה עצמה **לא** מייצאת DXF/PDF ישירות — היא שולחת את קבצי ה-`.elc` דרך כלי-נלווה **`ELC_SND.exe`** לשרת-ענן של InnoDraw שמחזיר DXF + PDF (וגם ORDX). יש גם מנוע-DXF פנימי (`eLCadDxfUI`, `eLDxfLayers2Read`, `eLFigureCutoutDxf`) ו-**BOM** (`eLBomView`).
- **חומרה:** Leica DISTO (SDK מלא `Leica.Sdk.dll`, `Leica.Disto.Api.dll`), מקודד-USB (`USD_USB*.dll`), גשר-3D (`eLMsrDev3DBridge.dll`), ו-**OpenCV** (`opencv_*`) לכיול-מצלמה/עיבוד-תמונה (`calibration -w=10 -h=7 ... camera.yml`).
- **רישוי:** נעילת-דונגל USB + רישום-מקוון (`ELC_SND` → מסד InnoDraw), עדכון-רישיון per-exe.
- **רב-לשוני:** 11 שפות (En/EnUS/He/Fr/Gr/It/Jp/Po/Sp/Tr/Ch) בכל מאגרי-המחרוזות; עברית מלאה.

**מסקנה אסטרטגית:** InnoDraw הוא **הרבה יותר מאפליקציית-מדידה** — הוא כלי-CAD לייצור-אבן עם עשרות כלי-קצוות/תפרים/מיטרים שאין להם מקבילה אצלנו וגם **אין להם צורך** אצלנו (אנחנו מודדים, לא חורצים אבן). הערך-לנו מרוכז ב: מנוע-הגאומטריה של השרטוט, כלי-האימות-והמידות, קטלוג-האלמנטים, ומודל ה-Job/Area/Profile.

---

## 1. ניהול Job / Area / פרופילים (מבנה-הפרויקט)

| פונקציה | מה עושה | סטטוס אצלנו | שווה לאמץ? |
|---|---|---|---|
| **New (Job / Area)** | דיאלוג יצירה: Job חדש או Area בתוך Job קיים | יש (פרויקט/חדר) | כבר יש — שמור |
| **Job Information** | טופס-עבודה: Profile · Job Name · Job Area · Company · Branch · Drawn By · Measured By (חובה לפני שרטוט) | חלקי | **כן** — שדות Drawn/Measured By + Branch חסרים לנו; חשובים ל-CRM |
| **Job Area (drop-down)** | סוג-אזור: Kitchen / Bath / … קובע תבנית וברירות-מחדל | חלקי | כן — "סוג חדר" מקצועי |
| **Profile** | פרופיל-לקוח/מפעל שקובע קטלוג, יחידות, שכבות (`Profiles\1_SOLINE`, `Rooms_IFC_DIM_Soline`) | חלקי | **כן** — פרופילים פר-לקוח |
| **Company Info / Setup** | פרטי-חברה על השרטוט וב-PDF | חלקי (PDF spec) | כן |
| **Import / Import Area** | ייבוא אזור/שרטוט קיים לתוך העבודה | חסר | צריך אימות; בינוני |
| **Recent File / Save Inc / Save Piece** | שמירה-מצטברת (גרסאות), שמירת-חלק בודד | חלקי | Save-Inc (גרסאות אוטומטיות) — **כן** |
| **Save Config / Save Config As** | שמירת קונפיגורציית-שרטוט כתבנית | חסר | בינוני |

---

## 2. מצבי-שרטוט וכלי-קו (Drawing / Line)

| פונקציה | מה עושה | סטטוס אצלנו | שווה לאמץ? |
|---|---|---|---|
| **Sketch / Sketch Vertical** | מצב-שרטוט חופשי (אופקי/אנכי) | יש (`RoomPlanCanvas`) | יש |
| **Diagonal** (מצב אלכסוני) | קו בכל זווית; פינות קיימות יכולות לשנות זווית | יש | יש |
| **Orthogonal** (מצב 90°) | קווים רק אופקי/אנכי; פינות-90° נשמרות בכל שינוי | חלקי | **כן** — נעילת-90° אמיתית (חסר לנו, §CVSM 4.6) |
| **Arc** (קו-קשת) | קצה-מעוקל: נמדד ע"פ מיתר + חץ-מקסימלי / רדיוס | חסר | כן — קירות/משטחים מעוקלים |
| **Multi Line** | פוליליין למדידת קו-לא-ישר (עבודה עם לייזר Elco) | חסר | כן — קיר לא-ישר בשטח |
| **Best Fit Line** | חישוב קו-מיטבי מתוך multi-line | חסר | כן — משלים ל-Multi Line |
| **Doorway** | הוספת פתח-דלת בקו | חלקי (אלמנט) | יש/חלקי |
| **Arrow / Frame** | חץ-ציון, מסגרת | חסר | נמוך |
| **Close: Auto / Manual / Open area** | סגירת-היקף: אוטומטי (הארכת קצוות ראשון+אחרון עד חיתוך), ידני, או אזור-פתוח | חלקי | **כן** — Close-Auto חסר לנו וקריטי ל-ORDX תקין |
| **Close And Offset** | סוגר ומייצר קו-מקביל בהיסט | חסר | כן |
| **Intersection** | סגירה בנקודת-חיתוך | חסר | בינוני |

---

## 3. מדידה, לייזר וזרימת-שדה (Measure Device / DSTO)

| פונקציה | מה עושה | סטטוס אצלנו | שווה לאמץ? |
|---|---|---|---|
| **Measure device toggle** | הדלקה/כיבוי מד-לייזר, מעבר למצב-Laser | יש (BLE) | יש |
| **Leica DISTO / DSTO (A6/Plus)** | לייזר בלוטות' עם SDK מלא; העברת-מדידה לקו/לשדה-נבחר | יש/חלקי | יש |
| **Reconnect / Reset / Shut Down** | ניהול-חיבור למכשיר | חלקי | כן — reconnect אוטומטי |
| **New Origin (Relocate)** | העתקת נקודת-הייחוס של הלייזר לעמדה חדשה באמצע-מדידה | חסר | **כן** — מדידת-חדר-גדול מכמה עמדות (§CVSM 7.6) |
| **Combine** | מיזוג שתי-מדידות/צורות למדידה אחת (multi-origin) | חסר | כן |
| **Semi-Automatic Outline** | משרטטים היקף בלי מידות → הלייזר ממלא כל קו אוטומטית לפי בחירת-הקו-הבא (CCW/CW) | חלקי | **כן** — זרימת-שדה מהירה מאוד |
| **DSTO button-map** | כפתורי-מכשיר: אפס-קדמי/אחורי, Diagonal/Orthogonal, Undo/Redo, Next-Line CCW/CW, Apply/Transfer | חלקי | כן — מיפוי-כפתורים על ה-BLE |
| **Zero reference front/back** | מוצא-מדידה מקדמת/אחורית של המכשיר | חסר | כן — דיוק |
| **USB encoder / H.W. options** | מדידת-2D עם מקודד; הגדרות-חומרה, Com Port | מחוץ-לתחום (הוסר) | **לא** — הוחלט להסיר |
| **3D Bridge / OpenCV camera calib** | גשר-מדידה-3D + כיול-מצלמה (`camera.yml`) | חסר | צריך אימות; פוטנציאל photo-measure |

---

## 4. שינוי-מידות מתקדם — "Resize / Measures" (לב-הגאומטריה)

> זהו **הגרעין המקצועי** של InnoDraw: קובעים גאומטריה מדויקת ע"י מדידות-משנה מקווי-ייחוס/Datum במקום גרירה. שווה-זהב לדיוק-שטח.

| פונקציה | מה עושה | סטטוס אצלנו | שווה לאמץ? |
|---|---|---|---|
| **Measures mode** | חלון-הזנת-מידות שמפעיל את סרגל-העריכה העליון | חלקי | כן |
| **Verification Measures Mode** | הזנת מידות-אימות מול Dimensions; המידה משמשת ל-resize נוסף | חסר | **כן** — אימות-מדידה מובנה (§CVSM 6.11) |
| **Line Orientation by Reference** | קובע כיוון-קו ע"י מדידת מרחקים משתי-נקודות על קו-ייחוס | חסר | **כן** — יישור-קיר מדויק |
| **Set Line by Reference** | קובע קו ע"י מדידת מרחקי-הקצוות שלו לקו-ייחוס | חסר | כן |
| **Corner by Distance** | קובע מיקום-קצה בלי לשנות כיוון-קו, ע"י מרחק מפינת-ייחוס | חסר | **כן** — טרילטרציה מעשית |
| **Angle by Distances** | קובע זווית בין שני-קווים ע"י מדידת מרחק בין נקודות-ביניים (טרילטרציה) | חסר | **כן** — "משולש-הזהב" של InnoDraw (§CVSM 6.4) |
| **Datum Lines / Position by Datum / Set Corner from Datum / Datum Corner** | קווי-אפס (X,Y) שכל המידות נמדדות מהם | חסר | **כן** — מערכת-קואורדינטות-שטח מקצועית |
| **Scale** | קנה-מידה של כל האזור לפי אורך-קו-נבחר | חלקי | כן |
| **Line to Multi Line** | המרת קו לפוליליין (למדידת קו-עקום) | חסר | בינוני |
| **Best Fit Line** | קו-מיטבי מ-multiline | חסר | כן |
| **Rotate / Level Horizontally / Level Vertically** | סיבוב כל-האזור סביב-ציר, או יישור קו-נבחר לאופקי/אנכי | חלקי | **כן** — יישור-חדר-לציר (§CVSM 4.13) |

---

## 5. פינות, קצוות ותפרים — עיבוד-צורה (Corner / Break / Miter)

> רובם **ספציפיים לייצור-אבן/קאונטרטופ** (תפר-הדבקה, מיטר, חריץ-ניקוז). רלוונטיים לנו רק חלקית.

| פונקציה | מה עושה | סטטוס אצלנו | שווה לאמץ? |
|---|---|---|---|
| **Round Corner** | עיגול-פינה אוטומטי לפי רדיוס | חסר | כן — גם קירות מעוגלים |
| **Chamfer** | קיטום-פינה | חסר | בינוני |
| **Radius / Diameter / Arc Approximation** | הזנת רדיוס/קוטר, קירוב-קשת | חסר | בינוני |
| **Break (Seam)** | חיתוך-הצורה בתפר בין שתי-נקודות-נגדיות (מיקום-תפר-הדבקה) | חסר (ייצור) | לא — ספציפי-אבן |
| **Orthogonal Break** | חיתוך-תפר אורתוגונלי לקו-ייחוס | חסר (ייצור) | לא |
| **Miter / Parallel / Perpendicular / Corner / Rounded Miter** | מיטרים אירופיים/ניצבים/פינתיים (חיבור-שפות-אבן ב-45°) | חסר (ייצור) | לא — ספציפי-אבן |
| **Slope Cut / Break on Slope** | חיתוך-משופע | חסר (ייצור) | לא |
| **Break Line** | פיצול קו-אחד לשניים | חלקי | כן — עריכת-קיר |
| **Break by Seam / Attach** | חיבור-פריטים-נפרדים בלי מיזוג | חסר | בינוני |
| **Attach / Attach External Walls / Attach Doors** | הצמדת-קירות, קירות-חוץ, דלתות (סגירת-גרף-חיבורים) | חלקי | **כן** — T-Join/סגירת-היקף (§CVSM 5.5) |
| **Duplicate Offset / Duplicate Lines / Embedded Duplicate** | שכפול-קו/צורה בהיסט | חסר | כן — העתק-קיר-בהיסט |
| **Position / Position from Datum** | מיקום-והצמדה של כיור/חיתוך לפי offset+setback (או מ-Datum) | חלקי | כן |
| **Overhang / Bump out** | הרחבת-שפה במידה נתונה (כמו Offset ב-AutoCAD); גם לסימון-סובלנות (ערך שלילי בין שני-קירות) | חסר | **כן** — "בליטה" + סובלנות בין-קירות |
| **Capture original cabinet/carcass** | נעילת מידות-ארון-מקורי לפני overhang | חסר (ייצור) | לא |

---

## 6. מידות ואימות (Dimensions & Verification)

| פונקציה | מה עושה | סטטוס אצלנו | שווה לאמץ? |
|---|---|---|---|
| **Point to Point** | מרחק נקודה↔נקודה (למשל שתי-פינות) | חלקי | **כן** |
| **Point to Line** | המרחק-הקצר מנקודה לקו (ניצב ליעד) | חסר | כן |
| **Point to Line Projection** | מרחק מקצה-קו להיטלו על קו-אחר | חסר | כן |
| **Perpendicular from a Line** | מרחק מנקודה לקו (ניצב למקור) | חסר | כן |
| **Maintain Dimension** | הפיכת מידה-רגעית לקבועה בשרטוט | חלקי | **כן** — קווי-מידה קבועים ל-PDF |
| **Line Dimension** | אורך-קו-נבחר קבוע | חלקי | כן |
| **Radius / Diameter Dimension** | מידת-רדיוס/קוטר | חסר | בינוני |
| **Angular Dimension** | זווית בין שני-קווים | חסר | **כן** — זוויות-פינה ב-PDF |
| **Align (dimensions)** | יישור קווי-מידה נבחרים | חסר | כן — PDF נקי |
| **Datum Corner / Diameter Notation** | סימון-קואורדינטות מ-Datum, סימון-קוטר | חסר | בינוני |
| **Select Dim Label** | בחירת-תווית-מידה להזזה על קו-המידה | חסר | כן — PDF |
| **Final Verification / Calc (Calculate current plan)** | אימות-סופי וחישוב-תוכנית | חסר | **כן** — בדיקת-שלמות לפני ייצוא |

---

## 7. חדר, קירות וחזית (Room / Wall / Level)

| פונקציה | מה עושה | סטטוס אצלנו | שווה לאמץ? |
|---|---|---|---|
| **Wall Height** | גובה-קיר | חלקי | יש/חלקי |
| **Room Height** | גובה-חדר | חלקי | כן |
| **Wall Width** | עובי-קיר | חלקי | כן |
| **Wall Front View** | יצירת **מבט-חזית** לקיר-נבחר (Elevation) | חסר | **כן — קריטי** (הלב של מדידת-מטבח; §CVSM §10) |
| **Level: Horizontal / Vertical / Wall / Walls** | יישור-מפלס אופקי/אנכי/לקיר | חלקי | כן |
| **Exterior Walls / Draw Exterior Walls** | קירות-חוץ (עובי נפרד) | חסר | כן |
| **Move Floor** | הזזת-מפלס-רצפה (Z) | חסר | כן — הגבהה/elevation |
| **Pole Height / Pole / Pole Auto Detect** | עמוד/קולטר: גובה, סימון-קצה-כעמוד, זיהוי-אוטומטי | חסר | **כן** — עמודים נפוצים במטבחים (§CVSM Column) |
| **Stairs Direction** | כיוון-מדרגות | חסר | נמוך |
| **Cabinet stops** | סימון עצירות-ארון על קיר | חסר | כן — מיקום-ארונות |
| **Marker Line / Marker Line Height** | קו-סימון (למשל **סוֹפִיט/הנמכת-תקרה**) + גובהו | חסר | **כן** — soffit/סגירה-עליונה |
| **Move (Up/Down/Left/Right)** | הזזה-מדויקת בכיוונים | חלקי | כן |

---

## 8. קטלוג-אלמנטים / מכשולים (Obstacles List)

> קטלוג עשיר של **8 קטגוריות, ~80 אייקונים** (`eLObstaclesIconsCategories`). זהו קטלוג-האב של האלמנטים שלנו.

| קטגוריה | אלמנטים (דגימה) | סטטוס אצלנו | שווה לאמץ? |
|---|---|---|---|
| **Construction** (בנייה) | חלון, דלת, עמוד-מלבני, קורה (Beam), מדרגות, **כניסת-ממ"ד (Safety Room)** | חלקי | **כן** — קורה/ממ"ד/מדרגות חסרים |
| **Electrical** (חשמל) | שקע, שקע-מורחב, מתג, מתג-מורחב, נק'-חשמל (Junction Box), קו-מתח, ארון-חשמל, טלפון, אינטרקום, TV, תאורה | חלקי | כן — שדרוג-קטלוג |
| **Plumbing** (אינסטלציה) | כיור, ברז, ברז-כפול, אמבט, בידה, מקלחת, אסלה, ניקוז-ביוב, ביוב, גז, צינור-מים, ספרינקלר | חלקי | כן |
| **HVAC** (מיזוג/אוורור) | מזגן, פתח-אוויר, רדיאטור, מפוח (Vent) | חלקי | כן |
| **Appliances** (מוצרי-חשמל) | מקרר, תנור, מיקרוגל, כיריים-גז, כיריים-חשמל, מדיח, מכונת-כביסה | חלקי | כן |
| **Furniture** (ריהוט) | ארון (7 טיפוסי-ארון: CW1D/CW2D/CT1D/CB1D/CB2D…), שולחן, כיסא | חסר | **כן — קריטי** (ארונות; §CVSM §9) |
| **Misc** (שונות) | Bump, Depth (עומק), Marker, ארגז-תריס (ShutterBox), אדן-חלון (Window Sill), Panel-to-Panel, Reserved | חלקי | כן — אדן-חלון/ארגז-תריס |
| **Duplicate** | Duplicate Offsets / Duplicate Heights | — | בינוני |

**קטלוג-כיורים ייעודי:** תיקיית `Sink` עם **60+ יצרנים** (Blanco, Franke, Kohler, Elkay, Teka, Pyramis, Villeroy-Boch…) בגרסאות Imperial + Metric — ספריית-כיורים אמיתית להטמעה. **קטלוג-חיתוכים (Cutouts):** שקעים לפי רדיוס (R6/R7/R10/R13, R0.5''), Slots.

---

## 9. תבניות, מילוי ותוויות (Templates / Fill / Labels)

| פונקציה | מה עושה | סטטוס אצלנו | שווה לאמץ? |
|---|---|---|---|
| **Template-Based Drawing** | שרטוט מתבנית-מוכנה (מלבן/צורות) עם מידות-ברירת-מחדל | חלקי | **כן** — אשף-תבניות (מלבן/L/U; §CVSM 2.4) |
| **Kitchen (cabinets templates)** | תבניות-ארונות מוכנות | חסר | כן |
| **Fill (Material Labels)** | מילוי-חומר/גוון לצורה (רשימת-חומרים) | חסר | בינוני — הדמיה |
| **Standard Cutouts / Notches (library)** | חיתוכים/מגרעות מהספרייה | חלקי | כן |
| **Label / MultiLine Label / Template Label** | תוויות-טקסט: בודדת, רב-שורה, תבנית-מוגדרת | חלקי | כן — הערות על-שרטוט |
| **Job Info / Print Info / Template / Door / Window Label** | תוויות-מטא לשרטוט ולהדפסה | חלקי | כן — ל-PDF |
| **Block** | קיבוץ-פריטים לבלוק | חסר | בינוני |
| **Datum Lines label / Coordinates Label / 3D Coordinates** | תוויות-קואורדינטות (כולל 3D) | חסר | בינוני |

---

## 10. תצוגה, שכבות וניווט (View / Layers)

| פונקציה | מה עושה | סטטוס אצלנו | שווה לאמץ? |
|---|---|---|---|
| **Zoom In/Out/Window/Reset/Image Zoom** | סט-זום מלא + זום-לתמונת-רקע | חלקי | כן — זום-לצביטה |
| **Pan / Full Screen / Status Bar** | ניווט ותצוגה | חלקי | יש/חלקי |
| **Layers (View Layers)** | שכבות + עריכת **טיפוסי-קו וצבעי-DXF** (`Layers.cfg`, `eLLineTypes.lin`) | חסר | **כן** — שכבות לייצוא-DXF נקי |
| **Line Layer / Line Types** | הקצאת-שכבה/סוג-קו לקו | חסר | כן |
| **Show/Hide Piece / Item Properties** | הצג/הסתר חלקים; מאפייני-פריט | חלקי | כן |
| **Parts (fast display)** | תצוגה-מהירה של חלקי-השרטוט | חסר | בינוני |
| **Lists: Cut Out / Notch / Fill / Markers / Windows / Drainer Grooves / Labels / Drawn Items / Kitchen Labels** | רשימות-ניהול לכל סוג-פריט | חסר | כן — טבלת-פריטים |
| **BOM (Bill of Materials)** | כתב-כמויות (`eLBomView`) | חלקי (converter) | **כן** — BOM/כתב-כמויות |
| **Audit Sheet / Options / Inspection Summary** | גיליון-ביקורת + סיכום-בדיקה (`AuditSheet.cfg`) | חסר | **כן** — QA/בקרת-מדידה |
| **Scale Ruler / Datum Lines / Edges (display)** | סרגל-קנה-מידה, קווי-אפס, קצוות | חלקי | כן |
| **First / Next / Previous (Lines)** | ניווט בין-קווים לדימוש | חלקי | כן |

---

## 11. הגדרות (Tools / Options)

מבנה דיאלוג-ההגדרות (מדריך-CT §8.2): **Edges · Fonts · Colors · Overhang · Resize · Text · Measure Device · H.W. · Embedded · Measures**.

| קבוצת-הגדרה | מה קובעת | סטטוס אצלנו | שווה לאמץ? |
|---|---|---|---|
| **Edges** | פרופילי-קצה ברירת-מחדל | חסר (ייצור) | חלקי |
| **Overhang** | ערך-בליטה + מיקום-תווית (פנים/חוץ) | חסר | כן |
| **Resize / Measures** | התנהגות שינוי-מידות ומדידה | חלקי | כן |
| **Colors / Fonts / Text** | צבעים, גופנים, טקסט | חלקי | כן — מיתוג-PDF |
| **Measure Device / H.W. / Com Port** | הגדרות-לייזר וחומרה | חלקי | חלקי (BLE במקום Com) |
| **Embedded** | פריטים-מוטבעים | חסר | בינוני |
| **Format / Units** | יחידות (metric/imperial — `eLCad_Metric.bat`/`_Imperial.bat`) + דיוק | חלקי | כן |
| **Language (11 שפות)** | שפת-ממשק (En/He/Fr/It/Po/Tr/Sp/Gr/Jp/Ch/EnUS) | חלקי (he/en/ru/ar) | חלקי |
| **Panning on/off** | `EnablePanning.reg`/`DissablePanning.reg` | — | נמוך |

---

## 12. ייצוא, פורמטים ואינטגרציה

| פונקציה | מה עושה | סטטוס אצלנו | שווה לאמץ? |
|---|---|---|---|
| **`.elc` (native)** | פורמט-מקור בינארי (`[Job]_[Area]_[Company]_[Branch]_DR1.elc`) — האב של ORDX/PDP | יש (ORDX/PDP במַמיר) | יש — אנחנו כבר על הצומת הזה |
| **ELC_SND → DXF** | שליחת `.elc` לשרת-InnoDraw → החזרת **DXF** (עם שכבות/צבעים) | חלקי (converter → DXF) | **כן** — כבר עושים DXF; לשפר שכבות |
| **ELC_SND → PDF** | החזרת **PDF** מהשרת | חסר (יש spec) | **כן** — PDF מקצועי (§CVSM 13.3, `PDF_REPORT_SPEC.md`) |
| **"Other Supported Formats"** | פורמטים-נוספים בהמרת-ענן (כולל ORDX) | חלקי | צריך אימות — לברר את מלוא-הרשימה |
| **Pictures & Documents (בהעלאה)** | צירוף תמונות+מסמכים לשליחה | חלקי | כן |
| **BOM export** | כתב-כמויות | חלקי | כן |
| **Print / Print Preview / Page Setup** | הדפסה-ישירה של שרטוט | חסר | בינוני (יש PDF) |
| **Pictures repository** | מאגר-תמונות-דיגיטליות לשיוך-לשרטוט | חלקי | כן |

> **הערה על הארכיטקטורה:** InnoDraw = **קליינט-שמן offline** לשרטוט/מדידה + **המרת-ענן** לפורמטי-פלט. זה בדיוק המודל שאנחנו בונים (offline-first + מַמיר). הבידול שלנו: המרה **מקומית** (בלי תלות בשרת-InnoDraw) והוצאה ל-**PDP/DXF/PDF** ישירות.

---

## 13. רישוי, עדכונים ותחזוקה

| פונקציה | מה עושה | סטטוס אצלנו | שווה לאמץ? |
|---|---|---|---|
| **דונגל-USB (USD_USB)** | נעילת-חומרה פר-מכונה (`USD_USB*.dll`, `eLUsdUsbComServer.exe`) | **שונה אצלנו** | **לא** — נטל; רישוי-ענן שלנו |
| **רישום-מקוון (ELC_SND)** | Group/Store/Computer/Registration Code + User Id | שונה אצלנו | לא — רישוי-Soline |
| **License Update (per-exe)** | עדכון-רישיון לכל exe (ktn/ct) בנפרד | שונה אצלנו | לא |
| **RunAsAdmin / ElcAssoc / RestorePrevious (.bat)** | סקריפטי-תחזוקה, שיוך-סיומת, שחזור-גרסה | — | נמוך |
| **Logging (log4net, elco_log, logs-YYYY)** | יומני-ריצה מפורטים | חלקי | כן — טלמטריה/דיבאג |
| **Backup (אוטומטי, `.bak` מרובים)** | גיבוי-גרסאות אוטומטי לכל שרטוט | חלקי | **כן** — גיבוי-מקומי אוטומטי |

---

## 14. סיכום-עדיפויות — מה InnoDraw נותן שחסר לנו

מדורג לפי **ערך-לנגר × פער-מולנו**, בהצלבה עם `CVSM_FEATURES.md` ו-`PDF_REPORT_SPEC.md`.

### עדיפות 1 — קריטי (בלי זה איננו שווי-ערך)
1. **Wall Front View — מצב-חזית (Elevation)** — הלב של מדידת-מטבח. InnoDraw בונה חזית מכל קיר; אין לנו כלום. (§7)
2. **Attach / Close-Auto — סגירת-היקף וחיבור-קירות (T-Join)** — בלי זה התוכנית לא "נסגרת" נכון ל-ORDX/PDP. (§5, §2)
3. **ארונות (Furniture: Cabinet ×7 טיפוסים) + Cabinet stops** — Cabinet Vision מבוסס-ארונות; אנחנו רק "קירות". (§8)
4. **מנוע Resize/Measures מ-Datum: Line Orientation by Reference, Corner by Distance, Angle by Distances** — דיוק-שטח מקצועי ע"י טרילטרציה במקום גרירה. זה ה-DNA של InnoDraw. (§4)

### עדיפות 2 — משדרג דרמטית דיוק, מהירות-שטח ותוצר
5. **Verification / Final Verification / Calc** — אימות-מדידה ובדיקת-שלמות מובנים לפני ייצוא. (§6)
6. **Semi-Automatic Outline + New Origin (Relocate) + Combine** — משרטטים היקף והלייזר ממלא; מדידת-חדר-גדול מכמה עמדות. (§3)
7. **PDF מקצועי + BOM + Audit Sheet** דרך הצינור שלנו (מקומי, לא שרת-InnoDraw). (§12, §10)
8. **קווי-מידה קבועים + Angular + Align + Maintain** — פלט-PDF קריא לנגר/מפעל. (§6)
9. **Arc / Multi Line / Best Fit / Round Corner / Overhang** — קירות ומשטחים לא-ישרים + בליטה + סובלנות בין-קירות. (§2, §5)

### עדיפות 3 — נוחות, מיתוג ואמון
10. **מודל Job/Area/Profile מלא** (Drawn/Measured By, Branch, פרופיל-פר-לקוח) — מיפוי ל-CRM/`.sol`. (§1)
11. **שכבות + טיפוסי-קו + צבעים** לייצוא-DXF נקי מקצועית. (§10, §11)
12. **קטלוג-אלמנטים מורחב** (קורה, ממ"ד, אדן-חלון, ארגז-תריס, עמוד/Pole) + **ספריית-כיורים 60+ יצרנים** + חיתוכים-לפי-רדיוס. (§8)
13. **תבניות-חדר/ארון + נעילת-90° אמיתית** — מאיץ-שרטוט. (§9, §2)
14. **גיבוי-מקומי אוטומטי + יומני-ריצה** — עמידות-נתונים. (§13)

### להימנע בכוונה (Skip)
- **כל מנגנון ייצור-האבן:** Miter (על סוגיו), Seam/Break, Slope Cut, Edges-profiles, Capture-carcass, Drainer Grooves — ספציפי-ל-fabrication-אבן; אנחנו מודדים, לא חורצים. (§5, §11)
- **דונגל-USB + רישום-per-exe + שרת-המרה של InnoDraw** — להחליף ברישוי-ותשתית-ענן של Soline. (§13, §12)
- **מקודד-USB / Com-Port** — כבר הוחלט להסיר; ה-BLE מחליף. (§3)
- **Stairs Direction, Panning-reg, Fill-materials** — נמוך-ערך לזרימת-שלנו.

---

## נספח א — עץ-ההתקנה (מקורות-הראיה)

- **בינארים:** `eLCad.exe` (ליבה), `eLCad_ktn.exe` (מטבחים), `eLCad_ct.exe`/`elcad.exe` (קאונטרטופ), `ELC_SND.exe` (שולח-לענן/רישום), `CompBranch.exe`, `eLRestart.exe`, `eLUsdUsbComServer.exe`.
- **חומרה:** `Leica.Sdk.dll`, `Leica.Disto.Api.dll`, `Leica.Disto.Networking.dll`, `eLMsrDev3DBridge.dll`, `eLMsrDev3D.dll`, `eLMsrDevLeicaBtSDK.dll`, `USD_USB*.dll`, `opencv_*2412/243.dll` (core/imgproc/highgui/calib3d/features2d/flann).
- **מדריכים:** `Manuals\InnoDraw User Manual for KBB.pdf` (Rev 3.05, Elcad 6120), `Manuals\CTuguide_rev3.04(A4)_ver_5712.pdf` (Countertops).
- **תפריט/מחרוזות:** `DB\eLMenu{En,He,…}.tx~`, `eLToolTipsLbls*.tx~` (96 פקודות), `eLObstaclesIcons*`, `eLObstaclesIconsCategories*`, `eLObstaclesDlgLbls*`.
- **קונפיג:** `Layers.cfg`, `eLLineTypes.lin`, `AuditSheet.cfg`, `Edges.cfg`, `SysLabels.cfg`, `Areas.txt`, `CompBranch.txt`, `JobInfo.txt`, `Labels*.txt`.
- **קטלוגים:** `Sink\` (60+ יצרנים, Imperial+Metric), `Cutouts\` (Sockets R6/R7/R10/R13, Slots), `Profiles\1_SOLINE`, `Rooms_IFC_DIM_Soline`, `Worktops_Default_*`.
- **סריקת-exe:** מחלקות `eLBomView`, `eLCadDxfUI`, `eLDxfLayers2Read`, `eLFigureCutoutDxf`, `eLLayerSaveAsDlg`, `eLSysLabelsKtn`, `eLFigureLineCoordsLabel`, פקודת-כיול `calibration … camera.yml`.

## נספח ב — הצלבה למסמכים קיימים
`CVSM_FEATURES.md` (הצאצא-המובייל) · `ORDX_BRIDGE.md` · `MEASURE_APP_ANALYSIS.md` · `CVSM_EXPORT_CRACK.md` · `PDF_REPORT_SPEC.md` · `ELEMENT_CATALOG_MERGED.md` · ממיר `ordx-pdp-converter\` (ORDX/PDP/DXF).

> **סטטוסים שסומנו "צריך אימות":** מלוא-רשימת "Other Supported Formats" מהשרת · יכולת-3D-Bridge/OpenCV (photo-measure) · Import/Import-Area · Save-Config-as-template. לאימות: פתיחת `.elc` לדוגמה במַמיר או צפייה בסרטוני-YouTube הרשמיים המקושרים ב-`Manuals\*.url`.
</content>
</invoke>
