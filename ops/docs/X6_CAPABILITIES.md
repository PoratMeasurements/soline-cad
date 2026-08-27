# Leica DISTO™ X6 — Capability Catalog for Soline Measure

מחקר יכולות מלא של ה-**Leica DISTO X6**, כדי שמיכאל יחליט אילו פונקציות לממש באפליקציית Soline Measure.
שמות מוצרים ופונקציות נשמרו verbatim באנגלית. תאריך מחקר: 2026-08-20.

> **הכרעה מהירה (gate לאלגוריתם רצפה/תקרה):** המכשיר לבדו נותן **מרחק + זווית אנכית (tilt/inclination)** בלבד. **זווית אופקית (azimuth) וקואורדינטות XYZ מלאות מתקבלות רק עם מתאם DST 360-X** (מצב P2P / 3D). מעל Bluetooth המכשיר משדר lengths, areas, volumes, **slopes (tilt)** ו-**point data (spatial coordinates)** — כאשר ה-coordinates קיימות רק כשעובדים ב-P2P עם המתאם. ראו סעיף ייעודי בהמשך.

---

## 1. Core specs (מתוך datasheet רשמי / דפי מפיצים)

| מאפיין | ערך | מקור |
|---|---|---|
| Range (favorable) | 0.05 – 250 m (0.07–820 ft) | globaltestsupply / datasheet |
| Range (unfavorable) | 0.05 – 150 m | globaltestsupply |
| Accuracy (typical) | **± 1.0 mm** | globaltestsupply / datasheet |
| Accuracy (unfavorable) | ± 2.0 mm | globaltestsupply |
| **X-Range Power Technology** | כן — טכנולוגיית מדידה מוגברת לטווח/מדידה על משטחים קשים | datasheet |
| **Point Finder** | מצלמת viewfinder דיגיטלית עם **4× zoom** (pinch-to-zoom על ה-touchscreen) | globaltestsupply / Leica |
| Display | Touchscreen גדול, עמיד לשריטות; שליטה במחוות (gesture control) | Leica shop |
| **Tilt sensor (inclinometer)** | טווח **360°**, סבילות **± 0.2°** | globaltestsupply / itm |
| Protection | **IP65** (dust-tight + jet-water) | globaltestsupply |
| Drop | **Drop-tested 2 m** | globaltestsupply |
| Bluetooth | **v5.0** | globaltestsupply |
| Interfaces | Bluetooth + **USB-C** (העברת קבצי DXF/CSV/JPG) | datasheet / search |
| משקל | 230 g | globaltestsupply |
| סוללה | Li-Ion נטענת, טעינה ~3h @ 5V/1A | search |

---

## 2. קטלוג פונקציות מדידה (on-device)

עמודת **Angle/XYZ?** = האם הפונקציה מפיקה זווית או קואורדינטות.
עמודת **BT?** = האם התוצאה משודרת מעל Bluetooth (המכשיר משדר lengths/areas/volumes/slopes/point-data).
עמודת **רלוונטיות ל-Soline**: floor/ceiling flatness · wall P2P · room scan · לא רלוונטי.

| Function | מה עושה | Inputs → Outputs (זווית/XYZ?) | BT? | רלוונטיות ל-Soline |
|---|---|---|---|---|
| **Distance** | מדידת מרחק ישיר לנקודה | מרחק בלבד (± tilt נמדד תמיד ברקע) | כן (distance) | בסיס לכל דבר |
| **Permanent / Tracking (min/max)** | מדידה רציפה; מוצא מרחק מינימלי/מקסימלי (למשל אלכסון/ניצב לקיר) | מרחקי min/max | כן | מדידת ניצב אמיתי לקיר; אורך אלכסון חדר |
| **Add / Subtract** | חיבור וחיסור מרחקים | מרחקים | כן | חישובי קיר מהירים |
| **Area** | שטח מ-2 מדידות (אורך×רוחב) | שטח | כן (area) | שטח רצפה/קיר גס |
| **Triangle / trapezoid area** | שטח משולש/טרפז מצלעות | שטח | כן | קירות/גגות משופעים |
| **Volume** | נפח מ-3 מדידות | נפח | כן (volume) | נפח חדר |
| **Painter function** | שטח מצטבר עם גובה קבוע + מדידות חלקיות (לצביעה) | שטח מצטבר | כן | לא ליבה |
| **Pythagoras — indirect height** | גובה/מרחק עקיף מ-2 או 3 מדידות (indirect 2-point / 3-point) | מרחק מחושב (משתמש ב-tilt) | כן | גובה תקרה כשאין גישה ישירה |
| **Smart Horizontal Mode** | מודד מרחק **אופקי אמיתי** מעל מכשולים — משלב distance + tilt ומחשב את המרכיב האופקי | מרחק אופקי (נגזר מ-tilt) | כן | מרחקי קיר אופקיים מעל רהיטים/מכשולים |
| **Height Tracking / height profile** | עוקב ומחשב גבהים של נקודות שלא ניתן למדוד ישירות; בונה פרופיל גובה | סדרת גבהים/פרופיל | כן | פרופיל גובה של קיר; **בדיקת שיפוע/פרופיל תקרה** |
| **Sloped objects / profile & angle** | לוכד פרופילים מורכבים וזוויות של אובייקטים משופעים | פרופיל + **זווית** | חלקי | **שיפוע רצפה/תקרה, ישרות** |
| **Stake-out (2 values)** | סימון מרחקים קבועים חוזרים על הקיר/רצפה | מרחקי סימון | כן | סימון נקודות התקנה |
| **Leveling** | פישור/מדידת זווית שיפוע לפי ה-tilt sensor | **זווית אנכית** | חלקי (slope) | בדיקת אופקיות/אנכיות |
| **Point-to-Line** | מרחק ניצב מנקודה לקו ייחוס | מרחק נגזר | כן | יישור קיר |
| **Area from photo ("measure in a picture")** | מודד רוחב/גובה/שטח/קוטר של אובייקט בתוך תמונה שצולמה | מידות מהתמונה | תמונה **לא** משודרת | תיעוד; לא מדידה מדויקת |
| **Point-to-Point (P2P)** | מרחק/זווית/**3D XYZ** בין שתי נקודות כלשהן, גם בלתי-נגישות | **צריך DST 360-X** → distance + tilt + horizontal angle → **XYZ** | כן (point data / coordinates) | **הליבה ל-room scan ולאלגוריתם XYZ** |
| **Reports / memory** | שמירת מדידות, דוחות, ייצוא | נתונים גולמיים | USB/BT | לוג מדידות |

> הערה: המכשיר **תמיד** מודד את ה-tilt (זווית אנכית) יחד עם המרחק — לכן כל מדידה נושאת מרחק + inclination. מה שחסר לבד הוא הזווית **האופקית**.

---

## 3. ⭐ "האם ה-X6 נותן XYZ לכל נקודה?" — התשובה הכנה

**קצר:** לא לבד. המכשיר לבדו נותן **מרחק + זווית אנכית (tilt)**. כדי לקבל **XYZ מלא** צריך את מתאם **DST 360-X** (מצב P2P).

**המנגנון (מדויק):**
- ל-X6 יש **חיישן tilt פנימי** (360°, ±0.2°) → זווית **אנכית/inclination** בלבד. אין לו חיישן לזווית **אופקית (azimuth/rotation)**.
- כשמרכיבים אותו על **DST 360-X** (מתאם חצובה מתהדר): המתאם מוסיף את **horizontal rotation angle** ומחזק את נתוני ה-tilt. אז ה-X6 "records the distance along with the exact tilt and horizontal rotation angle from the DST 360-X — establishing the 3D position of Point A in space" (contractors-tools / Leica P2P).
- רק אז המערכת פותרת את הטריגונומטריה ומייצרת **3D coordinates** לכל נקודה, ומחשבת מרחקי P2P בין נקודות בלתי-נגישות (עד 250 m, ללא רפלקטור).

**מה עובר ב-Bluetooth (קריטי ל-gate):**
- לפי ה-FAQ הרשמי של Leica: המכשיר משדר **"lengths, areas, volumes, slopes and point data (e.g. spatial coordinates)"**; **תמונות לא** משודרות.
- מכאן: **לבד** — מעל BT מקבלים distance + **slope (זווית אנכית)** לכל ירייה, אך **לא** זווית אופקית ולכן **לא XYZ מלא**.
- **עם DST 360-X** (P2P) — מקבלים גם **point data / spatial coordinates**, כלומר **XYZ אמיתי** לכל נקודה, וייצוא DXF 2D/3D דרך אפליקציית **DISTO Plan**.

**משמעות לאלגוריתם רצפה/תקרה של Soline:**
- אם רוצים אלגוריתם מבוסס-**XYZ אמיתי** לישרות רצפה/תקרה → **חובה DST 360-X** (זווית אופקית + XYZ).
- ללא המתאם, אפשר עדיין לבנות אלגוריתם מבוסס **מרחק + זווית אנכית** בלבד: למשל סריקת פרופיל אנכי/שיפוע ממיקום קבוע (Height Tracking / Smart Horizontal / min-max), אבל אין azimuth → אי אפשר לשחזר גריד XYZ מלא של הרצפה מירייה בודדת בלי גיאומטריה ידועה/הנחות.
- חלופה זולה: להצמיד את ה-azimuth בעצמנו (למשל מדידה לאורך קווי ייחוס ידועים/רשת), או להסתמך על P2P למקרים שדורשים XYZ.

---

## 4. Connectivity, apps & export

- **Bluetooth v5.0** → **DISTO Plan app** (iOS/Android). האפליקציה: sketch/floor-plan על המסך, מדידות חיות, ו-**DXF export (2D & 3D)**.
- **P2P workflow:** נקודות נשמרות כ-**2D DXF** (floor plan / wall layout) או **3D DXF** על ה-X6, וניתן להוריד דרך **USB** לתוכנת CAD.
- **On-device capture:** DXF / CSV / JPG.
- **DISTO transfer v6** (למחשב/CAD): העברת מדידות ישירה ל-BricsCAD/AutoCAD.
- מה **לא** עובר ב-BT: תמונות (Point Finder / area-from-photo).

---

## 5. רלוונטיות למדידת רצפה/תקרה, גיאומטריית חדר ובניית קיר

| צורך של Soline | פונקציה מתאימה ב-X6 | הערה |
|---|---|---|
| **ישרות/שיפוע רצפה ותקרה** | Height Tracking / profile, Leveling (tilt ±0.2°), Sloped-object profile | לבד: פרופיל+שיפוע; ל-XYZ מלא צריך DST 360-X |
| **סריקת חדר (room scan) → מודל** | **P2P + DST 360-X** → 3D DXF | הליבה; דורש מתאם |
| **קיר: P2P בין נקודות בלתי-נגישות** | Point-to-Point | דורש מתאם |
| **מרחק אופקי אמיתי מעל מכשולים** | Smart Horizontal Mode | עובד לבד |
| **ניצב אמיתי לקיר / אלכסון** | min/max (Permanent) | עובד לבד |
| **שטח/נפח מהיר** | Area / Volume | עובד לבד |

---

## 6. Shortlist מומלץ למימוש ב-Soline (מדורג לפי ערך)

1. **קליטת מרחק + זווית אנכית (tilt) מעל Bluetooth** — הבסיס לכל אינטגרציה; זמין מהמכשיר לבד. (gate: זה כל מה שיש בלי מתאם.)
2. **P2P / XYZ עם DST 360-X → ייבוא 3D DXF/coordinates** — הדרך הישירה ל-XYZ אמיתי לאלגוריתם רצפה/תקרה ולסריקת חדר. השקעה בחומרה (מתאם) אבל פותחת את כל ה-3D.
3. **Height Tracking / profile + Smart Horizontal Mode** — פרופיל שיפוע רצפה/תקרה ומרחקים אופקיים אמינים גם בלי מתאם.
4. **min/max (ניצב/אלכסון)** ו-**Area/Volume** — מדידות חדר מהירות, ערך גבוה/מאמץ נמוך.
5. **ייצוא/ייבוא DXF (DISTO Plan / DISTO transfer)** — גשר ל-CAD/לפורמט .sol; לבדוק אם עדיף להתחבר ל-BT הגולמי או לצרוך DXF.
6. Painter / area-from-photo / stake-out — נחמדים, ערך נמוך ל-core של Soline.

---

## Sources (URLs)

- Leica DISTO X6 datasheet (רשמי): https://shop.leica-geosystems.com/sites/default/files/2025-10/Leica%20DISTO%20X6%20data-sheet_2405_V1.12_EN.pdf
- Leica DISTO X6 FAQs (Bluetooth transmits "lengths, areas, volumes, slopes and point data (e.g. spatial coordinates)"; P2P needs DST 360-X): https://shop.leica-geosystems.com/measurement-tools/disto/blog/x6-faqs
- Leica Point-to-Point Technology: https://shop.leica-geosystems.com/measurement-tools/disto/leica-point-point-technology
- Contractors-tools — P2P breakdown (DST 360-X adds tilt+rotation → 3D position): https://www.contractors-tools.com/leica-disto-technology/p2p/
- Global Test Supply — full specs (range/accuracy/tilt 360° ±0.2°/IP65/2m/BT5.0/230g/4× Pointfinder): https://www.globaltestsupply.com/product/leica-disto-x6-laser-distance-measurer-250m
- ITM — functions + "measure in a picture" + tilt spec: https://www.itm.com/product/leica-disto-x6-laser-distance-measurer-250m
- Leica DISTO X6 User Manual v1.2 (PDF): https://shop.leica-geosystems.com/sites/default/files/2025-03/979590_Leica_DISTO_X6_UM_1-2-0_en_small.pdf
- Leica DISTO X6-P2P package (DST 360-X, 2D/3D DXF, USB): https://shop.leica-geosystems.com/global/measurement-tools/disto/leica-disto-x6-p2p-package/buy
