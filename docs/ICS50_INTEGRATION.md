# אינטגרציית Leica iCON iCS50 ל-Soline — מסמך תכן חיבור

> מסמך **מחקר + תכן** בלבד. איך מחברים את **Leica iCON iCS50** (משפחת iCON iCS)
> לאפליקציית המדידה של Soline באנדרואיד, ואיך המדידות שלו נכנסות לצינור הקיים
> (`Reading` → `StationSolver`). **לא נכתב קוד לאפליקציה** — זהו תכן + שלד.
> תאריך: 2026-08-25. מקורות ציבוריים (ראה §10). מה שלא אומת מסומן במפורש.
>
> **הסתייגות-על:** אין ברשותנו iCS50 פיזי לבדיקה, ואין SDK רשמי של Leica לנייד.
> חלקים מהתכן מבוססים על תיעוד יצרן ציבורי + התנהגות מוכרת של פרוטוקול Leica
> GeoCOM. כל טענה שדורשת אימות מול חומרה אמיתית מסומנת **[טעון-אימות]**.

---

## 0. תקציר מנהלים (TL;DR)

- **ה-iCS50 הוא מכשיר מסוג אחר לגמרי מ-DISTO.** הוא **תחנה טוטאלית רובוטית / חיישן
  בנייה** (robotic total station / construction sensor) — מכשיר על חצובה עם מנוע,
  מצלמות, ומעקב-מטרה ויזואלי — לא מד-לייזר יד. הוא מודד **זווית-אופקית (Hz) +
  זווית-אנכית (V) + מרחק-אלכסוני** לכל נקודה, ומחשב **קואורדינטת XYZ** מלאה.
- **החיבוריות שלו היא WiFi/WLAN (TCP/IP), לא BLE.** ה-iCS50 נשלט מטאבלט דרך רשת
  אלחוטית מקומית, כולל **סטרימינג-וידאו חי** מהמצלמה. זהו הבדל מהותי מ-DISTO
  (שהוא BLE-GATT). ([leica-geosystems.com iCS50](https://leica-geosystems.com/en-us/products/construction-tps-and-gnss/leica-icon-construction-tools/leica-icon-ics50))
- **הפרוטוקול הטבעי לצד-שלישי הוא Leica GeoCOM** — פרוטוקול RPC טקסטואלי (ASCII)
  של Leica ל-total-stations, הנפתח דרך **"Extended GeoCOM"** (אופציית-רישוי במכשיר).
  הוא זמין מעל **serial / Bluetooth / TCP-IP**. שותפי צד-שלישי (Carlson SurvCE וכו')
  מתחברים כך. ([carlsonsw SurvCE — Leica Robotic TS](http://update.carlsonsw.com/manuals/SurvCE/online/source/SettingsLeicaRoboticTS.html))
- **מה שונה מ-DISTO:** ה-iCS50 מחזיר בדרך-כלל **XYZ מוכן** (המכשיר כבר פתר את
  הטריגונומטריה מהעמדה) — כך ש-**`StationSolver.toPlan` עוקף/מיותר** למסלול זה;
  אם קוראים במצב-פולרי גולמי (Hz/V/dist) — המיפוי ל-`Shot`→`toPlan` **ישיר**.
- **הבלוקר האמיתי:** אין SDK-נייד רשמי, וגם GeoCOM דורש אישור אופציה במכשיר +
  אימות מול חומרה. גשר ה-iCS של המתחרה (SPEEDtemplate) הוא **Windows/.NET מעל WiFi
  networking** — כלומר מסלול-דסקטוף, לא אנדרואיד. ראה §7, §9.
- **המלצה:** לתעד iCS50 כדרייבר `transport:'wifi'` בארכיטקטורה, אך **לדחות מימוש**
  עד שיש (א) מכשיר פיזי, (ב) הכרעה בין GeoCOM-ישיר-מאנדרואיד לבין מסלול-companion.
  ה-D2/X6 (BLE) נשארים יעד v1; ה-iCS50 הוא יעד **גרסה-מתקדמת** (ראה §8).

---

## 1. מה זה iCS50 — סיווג המכשיר

### 1.1 אזהרת-שם: שני "iCS50" קיימים

חשוב להבחין — השם "iCS50" מופיע בשני הקשרים בקטלוג Leica iCON:

1. **iCON iCS50 (הדור החדש, 2024) — "Robotic Construction Sensor / Tool"**, המשווק
   במפורש ל**גימור-פנים ולתבנית-דיגיטלית (digital templating)**. זה **הדגם הרלוונטי
   ל-Soline** — זה בדיוק תחום הקאונטרטופ/אבן שבו SPEEDtemplate מתחרה. כולל:
   מערכת **דו-מצלמתית**, **WLAN + סטרימינג-וידאו חי** לטאבלט, ומעקב-מטרה ויזואלי אל
   **Leica vPole** (מוט-מדידה עם פיצוי-הטיה וזיהוי-גובה אוטומטי) ו-**Leica vPen**
   (עט-מדידה קצר-טווח לגימור מדויק, ±1 מ"מ ל-10 מ'). רץ מעל **Leica iCON trades
   software**. ([leica iCS50](https://leica-geosystems.com/en-us/products/construction-tps-and-gnss/leica-icon-construction-tools/leica-icon-ics50), [Hexagon 2024 press](https://hexagon.com/company/newsroom/press-releases/2024/new-software-based-and-ai-enabled-solutions))
2. **iCON iCS50 / iCON robot 50 (משפחת ה-total-station הקלאסית)** — תחנה טוטאלית
   רובוטית להצבת-נקודות (layout) באתר-בנייה, מבית משפחת ה-TPS. אותה משפחת-פרוטוקול
   (GeoCOM). ([leica iCON robot 50](https://leica-geosystems.com/en-us/products/construction-tps-and-gnss/robotic-total-stations/leica-icon-robot-50))

בשני המקרים מדובר ב**חיישן-זוויות-ומרחק ממונע על חצובה** ולא במד-יד. התכן להלן
מתמקד ב**דגם התבנית-הדיגיטלית (1)**, אך מפרוטוקולית שניהם ממשפחת iCON/TPS.

### 1.2 מה המכשיר עושה (ולמה זה שונה מ-DISTO)

| מאפיין | DISTO D2/X6 (הקיים ב-Soline) | **iCON iCS50** |
|--------|------------------------------|----------------|
| סוג | מד-לייזר יד | תחנה טוטאלית רובוטית ממונעת על חצובה |
| מה מודד | מרחק (+ זווית-נטייה ב-X) | **Hz + V + מרחק** → **XYZ מלא** לכל נקודה |
| מעקב-מטרה | — | מעקב ויזואלי אחר vPole/vPen (המכשיר "נועל" על המטרה) |
| מצלמה | Pointfinder (X6) | **דו-מצלמה + סטרימינג-וידאו חי** לטאבלט |
| שליטה | לחיצת-כפתור על המכשיר | **טאבלט שולט במכשיר** (robotic) דרך רשת |
| חיבוריות | **BLE (GATT)** | **WiFi/WLAN (TCP/IP)** + USB/כבל |
| פלט-נקודה | סקלר מרחק / (מרחק+זווית) | **קואורדינטת XYZ מוכנה** + point-id (+ תמונה) |
| מסגרת-ייחוס | מישור-הלייזר / DST 360 | עמדה מכוילת (station setup) — XYZ במרחב האתר |

**המסקנה הארכיטקטונית:** ה-iCS50 הוא בדיוק המקרה שמסמך
[`03-Device-Plugin-Architecture.md`](../_archive/soline-measurement-engine/docs/03-Device-Plugin-Architecture.md) §1
צפה מראש — *"סורק מרחבי (iCS50) ... אינו חולק פרימיטיב משותף"* עם ה-DISTO. לכן
ממדלים **יכולות** (`point.3d`, `scan.pointcloud`), לא מכשיר. ה-iCS50 מפרסם יכולת
`point.3d` (ואולי `scan.pointcloud`) על `transport:'wifi'`.

---

## 2. חיבוריות ופרוטוקול — מה ה-iCS50 באמת חושף

### 2.1 שכבת-התעבורה (Transport)

מתיעוד היצרן: ה-iCS50 נשלט מטאבלט דרך **WLAN אלחוטי**, עם **camera live stream**
("רואים בטאבלט מה שה-iCS50 רואה"). ([leica iCS50](https://leica-geosystems.com/en-us/products/construction-tps-and-gnss/leica-icon-construction-tools/leica-icon-ics50))
כלומר התעבורה היא **IP-מבוססת (TCP/UDP מעל WiFi)**, לא BLE. בנוסף קיים **USB/כבל**
לחיבור-קווי (data/הזנה). ([leica iCS50 — WiFi + USB](https://leica-geosystems.com/en-us/products/construction-tps-and-gnss/leica-icon-construction-tools/leica-icon-ics50))

למשפחת ה-total-station של Leica באופן כללי, GeoCOM נחשף גם מעל **RS232 serial,
Bluetooth, ו-TCP/IP**. ([carlsonsw — Leica Robotic TS](http://update.carlsonsw.com/manuals/SurvCE/online/source/SettingsLeicaRoboticTS.html))
עבור אנדרואיד, המסלול המעשי הוא **TCP/IP מעל אותה רשת WiFi** שהמכשיר מקים/מצטרף
אליה — הטאבלט פותח socket אל ה-IP:port של המכשיר.

### 2.2 פרוטוקול-הנתונים (Protocol)

**Leica GeoCOM** הוא הפרוטוקול הפומבי-לשותפים של Leica ל-total-stations. מאפיינים:

- **RPC טקסטואלי (ASCII request/response).** בקשה בפורמט `%R1Q,<rpc>:<args>` ותשובה
  `%R1P,0,0:<return-code>,<values>`. לדוגמה, `TMC_GetSimpleMea` מחזיר
  **Hz (רדיאנים), V (זווית-זנית ברדיאנים), ומרחק-אלכסוני (מטרים)**.
- **דורש "Extended GeoCOM"** — אופציית-רישוי שיש להפעיל במכשיר לפני שתוכנת-צד-שלישי
  יכולה לדבר איתו. ([carlsonsw — Extended GeoCOM לצד-שלישי](http://update.carlsonsw.com/manuals/SurvCE/online/source/SettingsLeicaRoboticTS.html))
- הגדרות-serial טיפוסיות: **19200 baud, 8N1, parity none** (רלוונטי רק למסלול קווי).
  ([carlsonsw — RS232 GeoCOM settings](http://update.carlsonsw.com/manuals/SurvCE/online/source/SettingsLeicaRoboticTS.html))
- למכשירים רובוטיים GeoCOM כולל גם פקודות-**מנוע** (`AUT_*` — סיבוב, נעילת-מטרה,
  חיפוש) ו-**מדידה** (`TMC_*`, `BAP_*`).

**מה עם ה-iCS50 הספציפי (דגם התבנית 2024)?** הדגם הזה רץ מעל **Leica iCON trades
software** על טאבלט Leica ייעודי, ומשתמש ב**מעקב-מטרה ויזואלי** — כלומר יש שכבת-
אפליקציה גבוהה יותר מעל הפרוטוקול-הבסיס. **[טעון-אימות]** האם iCON חושף GeoCOM
ישירות לצד-שלישי, או ממשק-רשת פנימי אחר (למשל פרוטוקול iCON/CTS ייעודי). ראה §9
(פער-ידע קריטי).

### 2.3 מה המכשיר מוציא (Data output)

| מצב | מה מתקבל | הערה |
|-----|----------|------|
| **פולרי גולמי** (GeoCOM `TMC_GetSimpleMea`) | Hz [rad], V-זנית [rad], slope-dist [m] | ניתן להמרה ל-`Shot` של Soline (§4.2) |
| **קרטזי מוכן** (GeoCOM `TMC_GetCoordinate` / iCON point) | X, Y, Z [m] במסגרת-העמדה + point-id | **XYZ מוכן** → `StationSolver` עוקף (§4.3) |
| **תמונה** | frame מהמצלמה החיה (סטרימינג) | תיעוד/כיוון; מעבר לצורך-הגאומטרי המיידי |

**החשוב:** ל-iCS50, בניגוד ל-X6, **המכשיר עצמו פותר את מיקום-הנקודה במרחב** (יש לו
Hz+V+dist ממנוע ומעקב-מטרה). לכן הפלט הטבעי הוא **XYZ**, וה-`point-id` מזהה כל נקודה.

---

## 3. האם אנדרואיד יכול להתחבר ישירות — והכרעת-התעבורה

### 3.1 חיבור-ישיר מאנדרואיד — היתכנות

- **BLE?** לא. ה-iCS50 אינו מכשיר-BLE כמו DISTO; אין service `3ab10100`. מנגנון
  ה-`LaserBle` הקיים **לא רלוונטי** ל-iCS50. (הוא כן נשאר למסלול DISTO.)
- **WiFi/TCP?** כן — טכנית אנדרואיד יכול לפתוח **TCP socket** אל ה-IP:port של המכשיר
  על אותה רשת WLAN, ולדבר GeoCOM (ASCII) — **בתנאי** ש(א) המכשיר במצב GeoCOM-Online
  ו-Extended-GeoCOM מופעל, (ב) הרשת נגישה (המכשיר כ-AP או שניהם על אותו נתב), (ג)
  ה-iCON software לא "תופס" את המכשיר בבלעדיות. **[טעון-אימות]** — סעיפים (א)+(ג)
  הם אי-הוודאות המרכזית לדגם-התבנית 2024.
- **Offline?** WiFi-ישיר עובד **offline לחלוטין** — זו רשת-מקומית בין הטאבלט למכשיר,
  בלי אינטרנט. תואם את דרישת ה-offline-first של Soline
  ([16 §7](../_archive/soline-measurement-engine/docs/16-Device-Driver-Contract-Spec.md)).

### 3.2 הכרעת-התעבורה ל-Soline

> **התעבורה הנבחרת ל-iCS50: WiFi TCP/IP (socket), מדבר Leica GeoCOM (ASCII RPC),
> offline על רשת-מקומית מכשיר↔טאבלט.** לא BLE.

זה מיושר עם מודל-היכולות הקיים: `DeviceDescriptor.transport = 'wifi'` כבר קיים
כאופציה חוקית ב-[מסמך 03 §2](../_archive/soline-measurement-engine/docs/03-Device-Plugin-Architecture.md)
וב-[מסמך 16 §2](../_archive/soline-measurement-engine/docs/16-Device-Driver-Contract-Spec.md).
כלומר החוזה כבר צפה iCS50 על `wifi` — אין צורך לשנות את הליבה, רק להוסיף adapter.

**חלופה למסלול-קובץ (`file-import`):** אם חיבור-חי לא מתאפשר (Extended-GeoCOM חסום/
בלעדיות iCON), אפשר לייבא **קובץ-נקודות** שה-iCON software ייצא (למשל LandXML/CSV/
נקודות). זה תואם את `importFile?()` שכבר קיים בחוזה
([16 §1](../_archive/soline-measurement-engine/docs/16-Device-Driver-Contract-Spec.md) —
*"ייבוא קובץ (עתידי, iCS50)"*). מסלול-גיבוי חשוב, פחות-חי.

---

## 4. מיפוי הנתונים → `Reading` / `StationSolver`

הליבה של Soline מקבלת מדידה כ-`Reading` (ראה
[`device/LaserBle.kt`](../app-measure/app/src/main/kotlin/il/co/soline/measure/device/LaserBle.kt))
ומעבדת ירייה-כדורית ל-2D דרך
[`geometry/StationSolver.kt`](../app-measure/app/src/main/kotlin/il/co/soline/measure/geometry/StationSolver.kt).
ל-iCS50 יש **שני מסלולי-מיפוי** תלויי-מצב-הפלט:

### 4.1 תזכורת — מבני-הנתונים הקיימים

```kotlin
// LaserBle.Reading — הפורמט שה-UI/מנוע צורכים היום
data class Reading(
    val label: String,
    val distanceMm: Double?,     // מרחק-אלכסוני
    val vAngleDeg: Double?,      // זווית-אנכית (inclination מהאופק)
    val hex: String,
    val ts: Long,
    val hAngleDeg: Double? = null, // זווית-אופקית (azimuth) → XYZ מלא
)

// StationSolver.Shot — ירייה-כדורית → toPlan()
data class Shot(val distanceMm: Double, val hAngleDeg: Double?, val vAngleDeg: Double?)
fun toPlan(distanceMm: Double, hAngleDeg: Double?, vAngleDeg: Double?): Pt // → נקודת-תוכנית 2D
```

`toPlan` מחשב: `r = d·cos(tilt)`, `x = r·cos(φ)`, `y = r·sin(φ)` כאשר `φ`=hAngle
(azimuth, CCW-חיובי, 0=+X), `tilt`=vAngle (inclination מהאופק).

### 4.2 מסלול A — פולרי גולמי (GeoCOM `TMC_GetSimpleMea`) → `Shot` → `toPlan`

אם קוראים מה-iCS50 **פולרי גולמי**, המיפוי ישיר — אבל **צריך שתי המרות-מוסכמה
קריטיות**, כי GeoCOM ו-Soline לא חולקים אמנת-זווית:

| GeoCOM | יחידה | Soline `Shot` | המרה נדרשת |
|--------|-------|----------------|-------------|
| slope-distance | **מטרים** | `distanceMm` | `× 1000` |
| V (זווית-**זנית**) | **רדיאנים**, 0=מעלה (zenith) | `vAngleDeg` (inclination מהאופק) | `vAngleDeg = 90 − toDegrees(V_zenith)` |
| Hz | **רדיאנים**, CW מכיוון-ייחוס | `hAngleDeg` (azimuth CCW, 0=+X) | `hAngleDeg = −toDegrees(Hz)` (הפוך-סימן; קליברציית-מוצא נדרשת) |

> **שתי מלכודות-המוסכמה [טעון-אימות מול מכשיר]:**
> 1. **זנית↔אינקלינציה:** GeoCOM V הוא **זווית-זנית** (0=ישר-למעלה, 90°=אופק). Soline
>    מצפה ל-inclination מהאופק. לכן `inclination = 90° − zenith`. אם לא ממירים —
>    הגובה וההיטל-האופקי יתהפכו (sin↔cos).
> 2. **כיוון-אזימוט:** `StationSolver.toPlan` מתעד (בהערת-הקוד עצמה) ש**מוסכמת-
>    האזימוט CCW-חיובי** ושאם המכשיר מדווח CW יש להפוך `φ → −φ`. GeoCOM Hz הוא
>    **CW** → סביר שנדרש היפוך-סימן. זו "נקודת-הכיול היחידה" שהקוד כבר צופה.

לאחר ההמרה — הזרימה זהה ל-X6: בונים `Shot`, קוראים `StationSolver.toPlan(shot)`,
צוברים פינות, ו-`cornersToWalls`/`buildWalls` מרכיבים את המתאר. **שום שינוי ב-
StationSolver לא נדרש** — הוא כבר מקבל ירייה-כדורית כללית.

### 4.3 מסלול B — XYZ מוכן (GeoCOM `TMC_GetCoordinate` / נקודת-iCON) → עוקף StationSolver

זהו המסלול ה**טבעי** ל-iCS50: המכשיר כבר פתר את הנקודה במרחב. מקבלים `(X, Y, Z)` [m]
+ point-id. כאן:

- **`StationSolver.toPlan` מיותר/עוקף** — אין צורך לפתור פולר→קרטזי, המכשיר עשה זאת.
- ממירים ישירות לנקודת-תוכנית: `Pt(X·1000, Y·1000)` (מ"מ), ו-`Z·1000` = גובה.
- מזינים ישירות ל-`StationSolver.cornersToWalls(corners, heightMm, ...)` — הפונקציה
  שכבר מקבלת **רשימת-פינות-תוכנית** (פלט toPlan) ומרכיבה `List<WallEntity>`. כלומר
  **נכנסים לצינור צעד אחד מאוחר יותר** מ-X6, בדיוק בנקודה ש-`cornersToWalls` נועדה
  לה.
- **מסגרת-ייחוס:** יש ליישר את מערכת-הצירים של העמדה (station setup של iCS50) עם
  ראשית-החדר של Soline. הפשוט: לקבוע את העמדה כראשית (0,0) — כפי ש-`Station`
  ב-StationSolver כבר עושה — או להזין את ה-XYZ יחסית-לעמדה.

**payload מוצע (תואם [16 §5.3 point.3d](../_archive/soline-measurement-engine/docs/16-Device-Driver-Contract-Spec.md)):**
`{ x:number, y:number, z:number, pointId:string, frameRef:FrameRef }` — במ"מ.

### 4.4 טבלת-הכרעה: איזה מסלול

| אם ה-iCS50 מספק... | Soline משתמש ב... | StationSolver |
|--------------------|-------------------|----------------|
| XYZ מוכן + point-id | `cornersToWalls(corners=XY, height=Z)` | **עוקף** toPlan; משתמש ב-cornersToWalls |
| Hz/V/dist פולרי בלבד | `Shot` → `toPlan` → `cornersToWalls` | **מלא** (כמו X6) + המרות-מוסכמה §4.2 |
| רק קובץ-ייצוא (iCON export) | `importFile?()` → נקודות | מחוץ-לזמן-אמת; אותו מיפוי XYZ |

---

## 5. תכן הדרייבר — `MeasurementDriver` ל-iCS-series

הדרייבר מממש את אותו **פורט** של D2/X6 ([16 §1](../_archive/soline-measurement-engine/docs/16-Device-Driver-Contract-Spec.md),
[03 §4](../_archive/soline-measurement-engine/docs/03-Device-Plugin-Architecture.md)) —
**בלי לשנות את הליבה**. ההבדל היחיד מ-X6: תעבורת-**Socket** במקום GATT, ופרסינג
**ASCII GeoCOM** במקום פריימי-BLE-בינאריים.

### 5.1 מבנה — מקביל ל-`LeicaDistoX6Device`

בעוד `LeicaDistoX6Device` מחזיק `BluetoothGatt` + callbacks, ה-iCS driver מחזיק
**socket + read-loop** על coroutine. אותה חתימת-`LaserDevice`
([`device/LaserDevice.kt`](../app-measure/app/src/main/kotlin/il/co/soline/measure/device/LaserDevice.kt)):
`state: StateFlow`, `measurements: Flow<RawMeasurement>`, `connect/disconnect/
setCaptureActive/undoLastPoint`.

### 5.2 שלד Kotlin (בתכן בלבד — **לא מיושם ל-source**)

```kotlin
package il.co.soline.measure.device

import kotlinx.coroutines.*
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.*
import java.io.BufferedReader
import java.net.InetSocketAddress
import java.net.Socket

/**
 * מימוש LaserDevice ל-Leica iCON iCS-series (iCS50) — תחנה טוטאלית רובוטית.
 * תעבורה: WiFi TCP socket (לא BLE). פרוטוקול: Leica GeoCOM (ASCII RPC).
 * מקביל ל-LeicaDistoX6Device אך socket-read-loop במקום GATT-callbacks.
 *
 * דורש: המכשיר במצב GeoCOM-Online + Extended-GeoCOM מופעל, ורשת WLAN משותפת.
 * [טעון-אימות מול iCS50 פיזי] — פורמט-התשובה המדויק, פורט, ומוסכמות-הזווית.
 */
class LeicaIcsDevice(
    private val host: String,          // IP של המכשיר על ה-WLAN (למשל 192.168.x.x)
    private val port: Int = 1212,      // [טעון-אימות] פורט GeoCOM/TCP של המכשיר
    private val mode: ReadMode = ReadMode.COORDINATE,   // XYZ מוכן (§4.3) או POLAR (§4.2)
    private val captureSound: PointCaptureSound = PointCaptureSound.Silent,
) : LaserDevice {

    enum class ReadMode { COORDINATE, POLAR }

    // iCS50 מספק XYZ מוכן → 3D אמיתי, זווית מלאה
    override val capabilities = DeviceCapabilities(is3D = true, hasAngle = true)

    private val _state = MutableStateFlow<DeviceConnectionState>(DeviceConnectionState.Disconnected)
    override val state: StateFlow<DeviceConnectionState> = _state.asStateFlow()

    private val _measurements = MutableSharedFlow<RawMeasurement>(
        replay = 0, extraBufferCapacity = 16, onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    override val measurements: Flow<RawMeasurement> = _measurements.asSharedFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var socket: Socket? = null
    private var readJob: Job? = null
    @Volatile private var captureActive = true
    @Volatile private var lastPointId = -1
    private val emittedHistory = ArrayDeque<RawMeasurement>()

    // ── חיבור ────────────────────────────────────────────────────────────────
    override fun connect() {
        _state.value = DeviceConnectionState.Connecting
        readJob = scope.launch {
            try {
                val s = Socket().apply { connect(InetSocketAddress(host, port), 5_000) }
                socket = s
                // handshake: לוודא GeoCOM חי (למשל COM_NullProc) + נעילת-מטרה אם רובוטי
                geoCom(s, "%R1Q,0:")                       // COM_NullProc — ping
                _state.value = DeviceConnectionState.Connected()
                readLoop(s)                                 // לולאת-הקריאה החוסמת
            } catch (e: Exception) {
                _state.value = DeviceConnectionState.Error("חיבור ל-iCS50 נכשל: ${e.message}", e)
            }
        }
    }

    /** לולאת-הקריאה: מבקש מדידה, מפרסר תשובת-GeoCOM, פולט RawMeasurement. */
    private suspend fun readLoop(s: Socket) {
        val reader = s.getInputStream().bufferedReader()
        val writer = s.getOutputStream().bufferedWriter()
        while (currentCoroutineContext().isActive && !s.isClosed) {
            if (!captureActive) { delay(150); continue }
            // בקשת-מדידה — פולרי או קרטזי, לפי mode
            val rpc = when (mode) {
                ReadMode.POLAR      -> "%R1Q,2108:1,1"   // TMC_GetSimpleMea (Hz,V,dist)
                ReadMode.COORDINATE -> "%R1Q,2082:1,1"   // TMC_GetCoordinate (X,Y,Z)
            }
            writer.write(rpc + "\r\n"); writer.flush()
            val line = reader.readLine() ?: break         // ניתוק → יציאה מהלולאה
            parseGeoCom(line)?.let { emitIfNew(it) }
            delay(150)                                     // קצב-דגימה (או trigger-driven)
        }
    }

    private fun geoCom(s: Socket, rpc: String): String? {
        s.getOutputStream().apply { write((rpc + "\r\n").toByteArray()); flush() }
        return s.getInputStream().bufferedReader().readLine()
    }

    // ── פרסינג GeoCOM (ASCII) → RawMeasurement ───────────────────────────────
    /**
     * תשובת-GeoCOM: "%R1P,0,0:<rc>,<v1>,<v2>,<v3>". [טעון-אימות] סדר-השדות המדויק.
     *  POLAR:      v1=Hz[rad], v2=V-zenith[rad], v3=slopeDist[m]
     *  COORDINATE: v1=X[m], v2=Y[m], v3=Z[m]
     */
    internal fun parseGeoCom(line: String): RawMeasurement? {
        val body = line.substringAfter(':', "").trim()
        val parts = body.split(',').mapNotNull { it.trim().toDoubleOrNull() }
        if (parts.size < 4) return null
        val rc = parts[0].toInt()
        if (rc != 0) return null                           // return-code ≠ 0 → שגיאת-מכשיר
        val pointId = (lastPointId + 1)                    // או point-id אמיתי מהמכשיר
        return when (mode) {
            ReadMode.POLAR -> {
                val hzRad = parts[1]; val vZenithRad = parts[2]; val distM = parts[3]
                // המרות-מוסכמה §4.2: זנית→אינקלינציה, Hz CW→CCW (הפוך-סימן)
                val inclDeg = 90.0 - Math.toDegrees(vZenithRad)
                val azDeg   = -Math.toDegrees(hzRad)       // [כיול] אולי בלי היפוך
                RawMeasurement(
                    distanceMm = distM * 1000.0,
                    vAngleRad  = Math.toRadians(inclDeg),
                    hAngleRad  = Math.toRadians(azDeg),
                    counter    = pointId,
                )
            }
            ReadMode.COORDINATE -> {
                // XYZ מוכן → StationSolver עוקף. כאן נשמר כ-RawMeasurement "מנוון",
                // אבל מומלץ מסלול-פלט ייעודי שמעביר XYZ ל-cornersToWalls ישירות (§4.3).
                // לצורך התאמה לפורט הקיים אפשר להמיר XYZ↔פולר, אך עדיף Reading.point3d.
                val xM = parts[1]; val yM = parts[2]; val zM = parts[3]
                RawMeasurement(
                    distanceMm = Math.hypot(xM, yM) * 1000.0,     // r בתוכנית
                    vAngleRad  = Math.atan2(zM, Math.hypot(xM, yM)),
                    hAngleRad  = Math.atan2(yM, xM),
                    counter    = pointId,
                )
            }
        }
    }

    private fun emitIfNew(m: RawMeasurement) {
        if (!captureActive) return
        if (m.counter == lastPointId) return
        lastPointId = m.counter
        emittedHistory.addLast(m)
        captureSound.onPointCaptured()
        _measurements.tryEmit(m)
    }

    override fun setCaptureActive(active: Boolean) { captureActive = active }
    override fun undoLastPoint() { emittedHistory.removeLastOrNull() }

    override fun disconnect() {
        try { readJob?.cancel(); socket?.close() } catch (_: Exception) {}
        socket = null; lastPointId = -1; emittedHistory.clear()
        _state.value = DeviceConnectionState.Disconnected
    }
}
```

> **הערה על מסלול-COORDINATE:** השלד ממיר XYZ→פולר כדי להיכנס ל-`RawMeasurement`
> הקיים, אבל זה **לא אופטימלי** — הוא ממציא-מחדש טריגונומטריה שהמכשיר כבר פתר.
> **מומלץ**: להרחיב את הפורט ב-`RawPoint3D(xMm, yMm, zMm, pointId)` ולהזין ישירות
> ל-`StationSolver.cornersToWalls` (§4.3) — כפי שמסמך 16 §5.3 כבר מגדיר
> `payload(point.3d): {x,y,z}`. זה שינוי-חוזה קטן, לא שינוי-ליבה.

### 5.3 גילוי + צימוד (discovery/pairing)

בניגוד ל-DISTO (BLE scan), ה-iCS50 מתגלה כ**מכשיר-רשת**:
1. **חיבור-רשת:** הטאבלט מצטרף ל-WLAN של המכשיר (המכשיר כ-AP), או שניהם על נתב.
2. **גילוי-IP:** IP קבוע/ידני, או mDNS/broadcast-discovery **[טעון-אימות]** אם
   ה-iCON חושף. בהיעדר — הזנת-IP ידנית ב-UI (כמו הזנת-כתובת-מדפסת-רשת).
3. **אין OS-bonding** כמו BLE; אבטחת-הרשת (סיסמת-WLAN) היא שכבת-הצימוד.
4. **הפעלת-מצב במכשיר:** GeoCOM-Online + Extended-GeoCOM — **פעולה חד-פעמית על
   המכשיר עצמו** (לא מהאפליקציה). לתעד ב-onboarding.

### 5.4 לולאת-הקריאה, שגיאות וניתוק

- **read-loop** רץ על `Dispatchers.IO` (חוסם על socket) — לא על ה-main-thread כמו
  ה-GATT-callbacks. פולט ל-`SharedFlow` זהה.
- **trigger vs polling:** אפשר polling (בקשת-מדידה כל ~150ms) או trigger-driven
  (המכשיר/vPen מודיע על מדידה חדשה). **[טעון-אימות]** אם iCON דוחף-notification.
- **טיפול-שגיאות:** GeoCOM return-code ≠ 0 → מיפוי ל-`DeviceConnectionState.Error`
  / `DeviceHealth.lastError` (out-of-range, no-target-lock, motor-busy).
- **ניתוק/חיבור-מחדש:** `readLine()==null` או `SocketException` → מצב Disconnected
  + reconnect-loop (מקביל ל-`startAutoReconnect` ב-`LaserBle`). קריאות שכבר נלכדו
  לא אובדות ([16 DV-6](../_archive/soline-measurement-engine/docs/16-Device-Driver-Contract-Spec.md)).
- **הרשאות אנדרואיד:** אין BLUETOOTH — צריך `INTERNET` + (Android 13+) הרשאות-WiFi/
  `ACCESS_WIFI_STATE`/`CHANGE_WIFI_STATE` לניהול-חיבור לרשת-המכשיר, ואולי
  `NEARBY_WIFI_DEVICES`. שונה לגמרי מהרשאות-ה-BLE של DISTO.

### 5.5 מיפוי ל-`DeviceDescriptor` (חוזה 16 §5)

```
descriptor: { vendor:'Leica', model:'iCS50', transport:'wifi',
  capabilities:[
    { capability:'point.3d',    accuracy:{absoluteMm:2 /*[טעון-אימות]*/},
      acquisition:'stream', trustClass:5 },
    { capability:'distance.point-to-point', accuracy:{absoluteMm:1},
      acquisition:'one-shot', trustClass:5 },
    { capability:'angle', acquisition:'one-shot', trustClass:4 }
  ] }
payload(point.3d): { x, y, z, pointId, frameRef }   // מ"מ, מסגרת-העמדה
```
trustClass 5 (הגבוה) הולם — תחנה-רובוטית מדויקת יותר מ-P2P נגזר-X6 (שם trustClass 4).

---

## 6. מה גשר-ה-iCS של SPEEDtemplate לימד (גישה בלבד — IP-safe)

**מקור:** המניפסט הסטטי ב-[`SPEED_TEMPLATE_STUDY.md`](../SPEED_TEMPLATE_STUDY.md) §2.
**לא הורץ דבר, לא פוענח קוד, לא נחלץ בינארי** — גוף ה-`LeicaBridgeICSSeries.exe`
נשאר דחוס בתוך cabinet ה-InstallShield ולכן **בלתי-נגיש לבדיקת-מחרוזות** מעבר
לשמות-המניפסט (נבדק: תיקיית ה-scratchpad מכילה רק `versioninfo.txt`, ללא גוף-ה-exe).
מה שאפשר להסיק מ**שמות-הקבצים והמבנה בלבד**:

| עדות (שם-קובץ במניפסט) | מה זה מלמד על ה**גישה** (לא על האלגוריתם) |
|-------------------------|--------------------------------------------|
| `LeicaBridgeICSSeries.exe` + `.config` | גשר-**נפרד** למשפחת iCS (מודל bridge-per-device); `.config` = הגדרות-חיבור חיצוניות |
| `Leica.DistoSdk.*` (Core/Communication/**Networking**/**LiveStream**/**VideoStreaming**/**Sftp**) | ה-SDK הוא **Leica DISTO SDK** (Windows/.NET). קיום `Networking`+`VideoStreaming`+`LiveStream`+`Sftp` → התעבורה היא **רשת (TCP/IP) עם וידאו-חי + העברת-קבצים (SFTP)** — עקבי עם WLAN+camera-stream של ה-iCS50 |
| `Leica.Disto.Networking`, `Leica.Sdk` | שכבת-רשת ייעודית מעל ה-SDK — לא BLE-GATT, אלא **networking** |
| GStreamer stack (~220 dll) | סטרימינג-הווידאו של ה-iCS מטופל ב-GStreamer (כבד; Soline יכול native/קל יותר) |

**המסקנה (גישה בלבד):** גשר ה-iCS של המתחרה הוא **מסלול Windows/.NET, מעל
Leica-SDK, בתעבורת-רשת (WiFi/TCP) עם וידאו-חי ו-SFTP** — **לא** BLE, **לא** נייד.
זה **מאשש** את הכרעת-התעבורה שלנו (§3.2: WiFi/TCP), אך גם מדגיש שה**מסלול-הרשמי-
המוכר הוא דסקטופ**. Soline חייבת מסלול-אנדרואיד עצמאי (GeoCOM-ישיר או companion),
כי ה-SDK הזה הוא Windows-only — בדיוק כפי ש-[`SPEED_TEMPLATE_STUDY.md`](../SPEED_TEMPLATE_STUDY.md) §3.2
כבר קבע לגבי ה-DISTO SDK. **לא אימצנו קוד; רק הגישה: SDK-מעל-רשת, גשר-לכל-משפחה.**

---

## 7. היתכנות, סיכונים, ובלוקרים

### 7.1 מה חוסם ללא גישה/חומרה

| בלוקר | חומרה | מה נדרש כדי לפתוח |
|-------|-------|-------------------|
| **Extended-GeoCOM** — אופציית-רישוי במכשיר | ✔ צריך iCS50 | לוודא שהלקוח רכש/יכול להפעיל את האופציה; בלעדיה אין צד-שלישי |
| **iCON-בלעדיות** — האם ה-iCON software תופס את המכשיר | ✔ | לבדוק אם GeoCOM-Online זמין במקביל, או שצריך לצאת מ-iCON |
| **פורט/פורמט-תשובה מדויקים** של iCS50 | ✔ | sniff/תיעוד — הפורט (1212? אחר), סדר-שדות, trigger-vs-poll |
| **מוסכמות-זווית** (זנית, CW/CCW, מוצא-Hz) | ✔ | כיול מול מדידת-אמת ידועה (§4.2) |
| **SDK-נייד רשמי** | — | **לא קיים פומבי** (כמו DISTO). פנייה ל-Leica/Hexagon לשותפות = לא-מתועד |
| **מסגרת-ייחוס/station-setup** | ✔ | ליישר XYZ-של-iCS50 עם ראשית-החדר של Soline |

### 7.2 סיכונים

- **סיכון-גבוה:** ייתכן שדגם-התבנית 2024 **אינו** חושף GeoCOM-גולמי לצד-שלישי, אלא
  רק ממשק-iCON פנימי → אז חיבור-חי-מאנדרואיד חסום, ונשאר רק **מסלול-קובץ** (§3.2).
- **סיכון-בינוני:** ניהול-רשת ב-אנדרואיד (הצטרפות ל-WLAN-של-מכשיר תוך שמירת-
  אינטרנט/GPS) מורכב יותר מ-BLE; UX-onboarding כבד יותר.
- **סיכון-נמוך:** מוסכמות-הזווית (§4.2) — פתירות בכיול חד-פעמי מול מדידה ידועה.
- **רישוי:** אין תלות-קוד ב-Leica אם הולכים GeoCOM-ASCII-ישיר (פרוטוקול, לא SDK) —
  זה **מיטיב**, כמו החלטת-ה-BLE-הישיר ב-DISTO. אין לייבא/להפיץ קוד-Leica/מתחרה.

### 7.3 תוכנית מדורגת (discover → connect → read → map → test)

| שלב | פעולה | תלוי-חומרה? |
|-----|-------|-------------|
| **0. בירור** | לברר מול Leica/הלקוח: האם iCS50-templating חושף Extended-GeoCOM לצד-שלישי, ומעל WiFi | לא (בירור) |
| **1. Discover** | להשיג iCS50 (או גישה זמנית); לחבר טאבלט ל-WLAN שלו; לגלות IP+פורט; להפעיל GeoCOM-Online | **כן** |
| **2. Connect** | PoC-socket: לפתוח TCP, לשלוח `COM_NullProc`, לקבל תשובת-GeoCOM חיה (לא Soline — כלי-בדיקה) | **כן** |
| **3. Read** | לקרוא `TMC_GetSimpleMea` (פולר) **ו-**`TMC_GetCoordinate` (XYZ); לתעד פורמט-תשובה מדויק + trigger-vs-poll | **כן** |
| **4. Map** | לכייל מוסכמות-הזווית (§4.2) מול מדידת-אמת; לבחור מסלול A/B (§4.4); לבנות `LeicaIcsDevice` מול הפורט | **כן** (כיול) |
| **5. Test** | תרחישי-קבלה כמו [16 §9](../_archive/soline-measurement-engine/docs/16-Device-Driver-Contract-Spec.md): לכידת-נקודה→Reading עם provenance; ניתוק-אמצע→reconnect; XYZ→cornersToWalls→מתאר נכון | **כן** |

**מסלול-מקביל בטוח (ללא-חומרה, מיד):** לבנות `LeicaIcsDevice` מול הפורט עם
**mock-socket/replay** (הזנת תשובות-GeoCOM מוקלטות), כך שכל הצינור (parse→map→
cornersToWalls→מתאר) נבדק **בלי מכשיר** — ורק שלבים 1–3 ממתינים לחומרה.

---

## 8. מפת-דרכים — היכן iCS50 יושב מול DISTO

| גרסה | מכשיר | תעבורה | יכולת | סטטוס |
|------|-------|--------|-------|--------|
| v1 | **D2** | BLE | distance | מאומת (disto_integration §7) |
| v1.5 | X3/X4/X6 | BLE | + angle / point.3d (P2P) | חלקית-מאומת |
| **v2+ (מתקדם)** | **iCS50** | **WiFi/GeoCOM** | **XYZ מוכן — חדר-מנקודה-אחת רובוטי** | **תכן זה; טעון-חומרה** |

ה-iCS50 הוא **השדרוג-האיכותי** מעבר ל-X6: במקום P2P-נגזר-טריגונומטרית (trustClass 4,
±5–10 מ"מ), תחנה-רובוטית שנותנת **XYZ מדויק ישירות** (trustClass 5). הוא הופך את
חזון "המודד עומד, החדר נבנה אוטומטית" למדויק ואמין — אבל **רק אחרי v1-DISTO יציב**
ורק כשיש חומרה + הכרעת-מסלול (GeoCOM-ישיר מול companion).

---

## 9. פערים כנים ואי-ודאות

- **[פער-קריטי]** **האם דגם-התבנית iCS50 (2024) חושף GeoCOM לצד-שלישי מעל WiFi?**
  זה ה**ציר** של כל התכן. משפחת-ה-TPS/robot חושפת (Extended-GeoCOM, מתועד היטב עם
  Carlson/SurvCE). לדגם-ה-iCON-trades הספציפי **לא מצאנו אישוש ציבורי** שהוא זהה —
  ייתכן ממשק-iCON פנימי. **חייב אימות מול מכשיר/Leica.**
- **[פער]** פורט-TCP מדויק, סדר-שדות בתשובת-GeoCOM, ו-trigger-vs-poll — **לא אומתו**;
  השלד משתמש בערכי-סבירות (`2108`=TMC_GetSimpleMea, `2082`=TMC_GetCoordinate, port
  1212) שיש לאמת מול תיעוד-GeoCOM רשמי + מכשיר.
- **[פער]** מוסכמות-הזווית (זנית↔אינקלינציה, CW↔CCW, מוצא-Hz) — כיוון-ההמרה ב-§4.2
  **סביר אך טעון-כיול** מול מדידת-אמת.
- **[פער]** מסלול-החיבור-לרשת ב-אנדרואיד (המכשיר-כ-AP מול נתב-משותף) וההרשאות
  המדויקות (NEARBY_WIFI_DEVICES וכו') תלויי-גרסת-Android — טעון PoC.
- **[חסום-בבירור]** **אין SDK-נייד רשמי** של Leica לצד-שלישי (כמו DISTO). המסלול-
  הרשמי-המוכר (וגם של המתחרה SPEEDtemplate) הוא **Windows/.NET-מעל-רשת** — דסקטוף.
  **האפשרויות הריאליות ל-Soline-אנדרואיד:**
  1. **GeoCOM-ASCII ישיר מעל TCP/WiFi** — אם הדגם חושף Extended-GeoCOM (המסלול
     המועדף; פרוטוקול פתוח-לשותפים, בלי תלות-SDK). **טעון אישור לדגם-התבנית.**
  2. **מסלול-קובץ (`file-import`)** — ייבוא נקודות שה-iCON software ייצא. פחות-חי,
     אבל עוקף את כל אי-ודאות-ה-live. גיבוי בטוח.
  3. **companion קטן ב-Windows** (רק אם 1+2 נכשלים) — מכונת-ביניים שמריצה את
     ה-Leica-SDK ומזרימה ל-Soline. סותר את ה-offline-first-נייד; מוצא-אחרון בלבד.

**שורה-תחתונה כנה:** ה-iCS50 **מתאים אדריכלית** (transport:'wifi' כבר בחוזה; XYZ
נכנס ל-`cornersToWalls` בנקיות), וה**גישה** ברורה (WiFi/TCP + GeoCOM). אבל **מימוש-
אמת חסום** עד: (א) אישור ש-Extended-GeoCOM זמין לדגם-התבנית, (ב) iCS50 פיזי לכיול
פורט/פורמט/זווית. עד אז — תכן + שלד + mock-בדיקה בלבד.

---

## 10. מקורות

**נגיש (מקורות ציבוריים):**
- [Leica iCON iCS50 — עמוד-מוצר](https://leica-geosystems.com/en-us/products/construction-tps-and-gnss/leica-icon-construction-tools/leica-icon-ics50) — WLAN, camera live stream, vPole/vPen, iCON trades software.
- [Hexagon 2024 — iCON trades solutions לגימור-פנים ותבנית-דיגיטלית](https://hexagon.com/company/newsroom/press-releases/2024/new-software-based-and-ai-enabled-solutions) — הקשר דגם-התבנית 2024.
- [Leica iCON robot 50 — robotic total station](https://leica-geosystems.com/en-us/products/construction-tps-and-gnss/robotic-total-stations/leica-icon-robot-50) — משפחת ה-robotic TPS.
- [Carlson SurvCE — Settings (Leica Robotic TS)](http://update.carlsonsw.com/manuals/SurvCE/online/source/SettingsLeicaRoboticTS.html) — GeoCOM-Online, **Extended-GeoCOM לצד-שלישי**, RS232 19200-8N1.
- [Leica iCS20/iCS50 User Manual (device.report)](https://device.report/manuals/leica-ics20-ics50-user-manual) — הקשר-מכשיר.
- מסמכי Soline פנימיים: [`03-Device-Plugin-Architecture.md`](../_archive/soline-measurement-engine/docs/03-Device-Plugin-Architecture.md) (transport:'wifi', iCS50, importFile), [`16-Device-Driver-Contract-Spec.md`](../_archive/soline-measurement-engine/docs/16-Device-Driver-Contract-Spec.md) (חוזה MeasurementDriver, point.3d payload), [`disto_integration.md`](disto_integration.md) (מסלול-BLE להשוואה), [`SPEED_TEMPLATE_STUDY.md`](../SPEED_TEMPLATE_STUDY.md) (מניפסט גשר-ה-iCS).
- קוד-מקור Soline (קריאה בלבד): [`device/LaserBle.kt`](../app-measure/app/src/main/kotlin/il/co/soline/measure/device/LaserBle.kt), [`device/LaserDevice.kt`](../app-measure/app/src/main/kotlin/il/co/soline/measure/device/LaserDevice.kt), [`device/LeicaDistoX6Device.kt`](../app-measure/app/src/main/kotlin/il/co/soline/measure/device/LeicaDistoX6Device.kt), [`geometry/StationSolver.kt`](../app-measure/app/src/main/kotlin/il/co/soline/measure/geometry/StationSolver.kt).

**לא היה נגיש / לא אומת:**
- **תיעוד-GeoCOM רשמי מלא** (מספרי-RPC, פורמט-תשובה, פורט-TCP) — טעון גישה לתיעוד-
  שותפים של Leica; ערכי-השלד הם סבירות-מחקר בלבד.
- **אישור ש-iCS50-templating (2024) חושף Extended-GeoCOM לצד-שלישי מעל WiFi** — לא
  נמצא אישוש ציבורי; §9 פער-קריטי.
- **מוסכמות-זווית + station-setup המדויקים של iCS50** — טעוני-כיול מול מכשיר.
- **גוף `LeicaBridgeICSSeries.exe`** — נשאר דחוס ב-cabinet; **לא נחלץ ולא נבדק** מעבר
  לשמות-המניפסט (IP-safe; §6).
- **SDK-נייד רשמי של Leica לצד-שלישי** — כמיטב-הידיעה **לא קיים פומבי**.

---
*מסמך תכן בלבד. לא הורץ מתקין/בינארי כלשהו, לא עוקפה הגנת-DRM, ולא הועתק קוד של
Leica או של המתחרה. נלמדו **גישה ופרוטוקול** בלבד; המימוש של Soline יהיה עצמאי.*
