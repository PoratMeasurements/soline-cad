# 01 — ארכיטקטורה וסטאק · Soline Measure

> ציר-התכנון: **ארכיטקטורה וסטאק**. גרסה 1.0 · 2026-08-16 · עברית · לשון זכר.
>
> **נשען על ממצאים מאומתים:** `MEASURE_APP_ANALYSIS.md` (ה-RE של ה-APK + המסד החי),
> `MEASURE_REBUILD_PLAN.md` (הכרעת adapt-vs-build ברמת-המוצר), `DESIGN_TOOL_SPEC.md`
> (תוכנת-העיצוב — web/React/three.js, FR-DESIGN), `SOL_FORMAT.md` (פורמט היעד `.sol`),
> `DISTO_PROTOCOL.md` (Leica X6 + Bosch GLM 50C — שניהם פוענחו חי), `INTERFACE.md`
> (החוזה תפעול↔ממיר).
>
> **תחום המסמך:** רק שכבת-הארכיטקטורה — האם להתאים את CVSM או לבנות-מחדש, מבנה-המודולים,
> שאלת ה-KMP מול תוכנת-העיצוב, single-activity/MVVM, ומיקום שכבת-ה-`.sol`. **מה שלא כאן:**
> אפיון-פיצ'רים (ב-`MEASURE_TOOL_SPEC`), חוקי-ה-fit (ב-`kitchen_layout_fitting.md`), ופרטי-הפורמט
> (ב-`SOL_FORMAT.md`). המסמך מפנה אליהם ולא משכפל.

---

## 0. תקציר מנהלים

הבסיס הקיים — `com.roommeasure.app` ("CVSM", v5.2.0) — הוא סטאק אנדרואיד מודרני ובשל:
**Kotlin + Jetpack Compose + single-activity/MVVM + Room + WorkManager + okhttp +
navigation-compose**, minSdk 26 / targetSdk 35. הוא מורשה ל-Soline, רץ חי בשטח (Samsung
SM-X356B, אנדרואיד 16), ושני מדי-הלייזר שלו (Leica DISTO X6 ב-3D, Bosch GLM 50C ב-2D)
**פוענחו מקצה-לקצה** — כך שהחיבור אינו "קופסה-שחורה" אלא נכס מובן וניתן-לתחזוקה.

**ההכרעה הארכיטקטונית המרכזית: להתאים (adapt) את CVSM, לא לבנות-מחדש ולא לשכתב ל-web.**
מה שקשה ומסוכן — סטאק ה-BLE, offline-first על Room, מודל-הקיר העשיר, פותר-הצורה — כבר עובד.
שכתוב היה מקריב את כל אלה עבור יתרון תיאורטי אחד (שיתוף-קוד עם תוכנת-העיצוב), שאותו משיגים
בזול דרך **חוזה-נתונים (`.sol`) + מפרט-כללים (R1–R10)**, לא דרך kernel משותף.

**חמש ההכרעות שהמסמך מקבע:**
1. **Adapt, לא rebuild** — שומרים את הליבה הבשלה; בונים רק את שכבות-הבידול מעליה.
2. **מעבר למבנה רב-מודולי (Gradle multi-module)** — פירוק המונוליט הנוכחי ל-`:core`, `:data`,
   `:hardware`, `:feature-*`, ובראשם **`:core:sol` ו-`:fit-engine`** כמודולים עצמאיים ונקיים.
3. **Room = מנוע-האחסון-החי; `.sol` = פורמט-החילוף** — לא לוחצים אותם לאחד. `.sol` נכתב native
   ל-`measured/` בגמר-מדידה ובסנכרון, לא על כל שמירה-אוטומטית.
4. **שיתוף עם תוכנת-העיצוב דרך חוזה, לא דרך קוד** — תוכנת-העיצוב היא web/React (`DESIGN_TOOL_SPEC §3.1`);
   הגשר הוא סכמת-`.sol` + מפרט-R1–R10 כתקן. KMP נשקל רק אם/כשהצד השני יעבור ל-Kotlin.
5. **single-activity + MVVM נשמרים** — הם הבחירה הנכונה; מחזקים אותם ב-`UDF`/`StateFlow`
   ו-`Repository` מפורש, לא מחליפים.

> **המשפט האחד:** לא נוגעים בליבה הקשה, מפרקים אותה למודולים כדי שהבידול (`.sol`, fit, סנכרון,
> רישוי) ייכנס כשכבות נקיות, ומגשרים לתוכנת-העיצוב דרך פורמט — לא דרך קוד משותף.

---

## 1. ההכרעה: התאמה (adapt) מול בנייה-מחדש

### 1.1 מדוע לא בונים מחדש
הבנייה-מחדש מפתה ("קוד נקי, שלנו, בלי חוב-עבר"), אך היא הרס-ערך על-פי הממצאים:

| נכס קיים (מאומת) | עלות-שחזור אם נבנה-מחדש | מקור |
|---|---|---|
| BLE של Leica X6 (3D, DST 360) + Bosch GLM 50C (2D) | גבוהה — שני פרוטוקולים, handshake, מונה-מדידה, dedup | `DISTO_PROTOCOL.md` |
| offline-first על Room + WAL + שמירה-אוטומטית | גבוהה — התשתית שהאפיון דורש כבר עובדת | `MEASURE_APP_ANALYSIS §61-64` |
| מודל-הקיר (גרף-חיבורים, `HeightBands`, soffit, elevation) | גבוהה מאוד — עומק דומייני שנצבר לאורך v1–v5 | `MEASURE_APP_ANALYSIS §66-77` |
| `ShapeSolver` (פתרון-צורה) + אלגוריתם מדידה→תכנית | גבוהה — גאומטריה + T-join + סדר-קירות-להיקף | `MEASURE_APP_ANALYSIS §98-103` |
| ייצוא ORDX/DXF/PDF (הגשר לממיר קיים) | בינונית-גבוהה | `MEASURE_APP_ANALYSIS §21-23` |
| עברית + RTL + 1,112 מחרוזות | בינונית | `MEASURE_APP_ANALYSIS §112` |

בנייה-מחדש הייתה מחזירה את השעון לאחור על **כל** השורה הזו במקביל — ריסק-מוצר בלתי-מוצדק.

### 1.2 מדוע לא לשכתב ל-web/Capacitor
הפיתוי היחיד ל-web הוא **שיתוף-קוד עם תוכנת-העיצוב** (שהיא web). אבל:
- BLE של מדי-לייזר על web (Web Bluetooth) הוא שביר, חלקי-תמיכה, ומאבד את שני המימושים המוכחים.
- offline-first על web (IndexedDB) פחות בשל מ-Room לעומסי-כתיבה תכופים של מדידה חיה.
- היתרון-התיאורטי (kernel משותף) מושג בזול דרך `.sol` + R1–R10 כחוזה (ראה §5).

**מסקנה:** ה-web מפסיד את הליבה הקשה תמורת יתרון שממילא משיגים אחרת. נדחה.

### 1.3 מה בדיוק "adapt" אומר כאן
Adapt ≠ "לא לגעת". זהו **refactoring מבני מבוקר**: משאירים את הלוגיקה הבשלה כפי-שהיא,
אך **מפרקים את המונוליט למודולים** (§2) כדי שהבידול ייכנס כשכבות נקיות ולא כטלאים על מונוליט.
זו ההשקעה הארכיטקטונית האמיתית של הפרויקט — לא כתיבה-מחדש, אלא **מודולריזציה + הזרקת-שכבות**.

---

## 2. מבנה המודולים (Gradle multi-module)

### 2.1 המצב היום והבעיה
מ-ה-RE: המבנה הנוכחי הוא **מונוליט חבילתי** — `model/`, `ui/`, `viewmodel/`, `data/`,
`export/`, `utils/` כחבילות בתוך מודול-אפליקציה יחיד (`MEASURE_APP_ANALYSIS §25-46`). זה
עבד עד v5, אבל הבידול החדש (`.sol`, fit-engine, סנכרון, רישוי) דורש גבולות-קומפילציה ברורים:
מנוע ה-fit ו-כותב-ה-`.sol` צריכים להיות **טהורים, בלי תלות-אנדרואיד**, כדי שיהיו ניתנים-לבדיקה
ביחידה, ובעתיד ניתנים-לשיתוף (KMP).

### 2.2 המבנה המוצע

```
soline-measure/  (Gradle project)
│
├─ app/                         ← מודול-האפליקציה: MainActivity, Application, ניווט, DI-root
│                                  (single-activity; מרכיב את ה-feature-modules)
│
├─ core/
│  ├─ core:model                ← מודל-הדומיין הטהור (Kotlin בלבד, ללא אנדרואיד):
│  │                              Wall, HeightBands, Accessory, Room, ShapePoint…
│  │                              + השדות-החדשים (measure_status, designRef, מפלס דו-קצה)
│  ├─ core:geometry             ← ShapeSolver, טריאנגולציה, סגירת-פוליגון, מדידה→תכנית
│  │                              (Kotlin טהור — בר-בדיקה ביחידה)
│  ├─ core:sol                  ← ⭐ קורא/כותב .sol (ZIP+manifest+8 שכבות). Kotlin טהור.
│  │                              מיפוי model⇄measured/, ORDX משומר as-is, checksums
│  └─ core:common               ← יחידות, לוגר, תוצאות, תשתית-שגיאות
│
├─ fit-engine/                  ← ⭐ מנוע R1–R10 (Kotlin טהור, ZERO תלות-אנדרואיד).
│                                  יעד-שיתוף עתידי עם המשרד (KMP-ready). ראה §6.
│
├─ data/
│  ├─ data:local                ← Room (AppDatabase, ProjectDao, Converters, WAL)
│  │                              + מיגרציות-סכמה + מיפוי entity⇄core:model
│  ├─ data:repository           ← ProjectRepository, JobRepository, LicenseRepository
│  │                              (המקור-היחיד; חושף StateFlow ל-ViewModels)
│  └─ data:sync                 ← WorkManager + okhttp: סנכרון-עבודות, העלאת .sol, אירועי-מנוע
│
├─ hardware/
│  ├─ hardware:laser            ← הפשטת LaserDevice + מימושי Leica3D / Bosch2D
│  │                              (עוטף LeicaDistoManager + BluetoothLeManager הקיימים)
│  └─ hardware:camera           ← PhotoManager (צילומים ממוקמים)
│
├─ feature/
│  ├─ feature:home              ← בית + "העבודות שלי"
│  ├─ feature:plan              ← מצב-תכנון 2D (הקנבס הראשי, EditMode, P2P)
│  ├─ feature:elevation         ← חזיתות
│  ├─ feature:preview3d         ← תלת-ממד (Camera3D, mesh, OrbitControls)
│  ├─ feature:scan              ← קליטת-שטח (ScanSession, WallBuild)
│  ├─ feature:fit               ← ⭐ שכבת-רקע design/ + overlay-fit + רמזים חיים (חדש)
│  ├─ feature:checklist         ← ⭐ צ'קליסט-שלמות חוסם-יציאה (חדש)
│  └─ feature:license           ← מסך-רישוי + multi-tenant
│
└─ export/                      ← DxfExporter, PdfExporter, ORDX (עוטף ל-.sol via core:sol)
```

### 2.3 כללי-התלות (dependency rule)
- **הליבה לא יודעת על אנדרואיד.** `core:model`, `core:geometry`, `core:sol`, `fit-engine` הם
  מודולי-Kotlin טהורים (`java-library`/`kotlin("jvm")`), לא `android-library`. זה מה שהופך אותם
  לברי-בדיקה-מהירה, ובעתיד לברי-KMP.
- **התלות זורמת פנימה בלבד:** `feature:*` → `data:*` → `core:*`. `feature` לעולם לא ניגש
  ל-Room ישירות — רק דרך `data:repository`.
- **`hardware:laser` חושף `interface LaserDevice`** ו-`feature:plan/scan` תלויים בהפשטה, לא
  במימוש. זה בדיוק מה ש-`DISTO_PROTOCOL §92` ממליץ ("הפשטה משותפת `LaserDevice` עם שני מימושים")
  — וכבר קיים כ-`LaserDeviceType`; אנחנו רק ממסדים אותו כגבול-מודול.
- **DI:** Hilt (או Koin) ב-`app/` כ-root; כל מודול חושף module-ל-DI משלו.

### 2.4 מדוע רב-מודולי ולא להשאיר מונוליט
1. **בידוד-הבידול:** `.sol` ו-fit-engine נבנים ונבדקים בלי להמתין לקומפילציית-אנדרואיד המלאה.
2. **בדיקוּת:** Kotlin טהור = בדיקות-JVM מהירות ל-R1–R10 ולמיפוי-הסכמה — קריטי לנכס-הבידול.
3. **מוכנות-KMP:** אם המשרד יעבור ל-Kotlin, `fit-engine` + `core:model` מוגרים ל-`commonMain`
   כמעט ללא שינוי (§5.3).
4. **בנייה-מקבילית:** Gradle בונה מודולים-בלתי-תלויים במקביל — זמני-build קצרים יותר.

---

## 3. ארכיטקטורת-האפליקציה (single-activity / MVVM / UDF)

### 3.1 שמירה על single-activity + Compose
המצב הקיים (`MEASURE_APP_ANALYSIS §11-12`, §94-96): `MainActivity` יחיד, `navigation-compose`,
גרף `License→Home→RoomList→Plan→{Elevation,3D,Bluetooth}+Settings`, עם undo-stack מלא. **זו
הבחירה הנכונה — נשמרת.** single-activity + Compose היא הארכיטקטורה המומלצת של Google, והיא
כבר מיושמת נכון (כולל undo-stack — נכס לא-טריוויאלי).

### 3.2 חידוד ה-MVVM ל-UDF מפורש
לא מחליפים MVVM — **מהדקים** אותו לזרימה חד-כיוונית (Unidirectional Data Flow):
- כל מסך = `ViewModel` שחושף `StateFlow<UiState>` יחיד (immutable) + מקבל `Event`/`Intent`.
- ה-`ViewModel` תלוי ב-`Repository` (מ-`data:repository`), לעולם לא ב-DAO ישירות.
- ה-`ProjectViewModel` הענק הקיים (CRUD + כל הייצוא — `MEASURE_APP_ANALYSIS §22`) **מפוצל**
  לפי feature: `PlanViewModel`, `ElevationViewModel`, `ExportViewModel`, `FitViewModel`. זו
  עבודת-refactor, לא כתיבה-מחדש — מעבירים מתודות קיימות למקומן הנכון.
- ה-undo-stack הקיים נשמר כ-Command-history במודל (מתיישב עם ה-Command-system של תוכנת-העיצוב,
  `DESIGN_TOOL_SPEC §2.5` — עקביות-רעיונית בין שני-הצדדים).

### 3.3 שכבת-הנתונים — Repository מפורש
היום ה-ViewModel כנראה ניגש ל-`ProjectDao` ישירות. מוסיפים שכבת-`Repository` ביניים כי:
- היא נקודת-החיבור ל-`.sol` (כתיבה בגמר-מדידה) ול-`data:sync` (העלאה/הורדה) בלי לזהם ViewModels.
- היא ממפה `entity`(Room)⇄`core:model`(דומיין) — כך ה-feature עובד על מודל-דומיין נקי.

---

## 4. מיקום שכבת ה-`.sol`

### 4.1 העיקרון — הפרדה בין אחסון-פנימי לפורמט-חילוף
זו ההכרעה העמוקה ביותר בציר-זה, וכבר נקבעה ברמת-העיקרון ב-`MEASURE_REBUILD_PLAN §2.2`:
**Room = מנוע-האחסון-החי; `.sol` = פורמט-החילוף/המסירה.** כאן היישום הארכיטקטוני שלה.

- **פנימית, בשטח, נשאר Room.** כתיבת-ZIP על כל שמירה-אוטומטית = הרג-ביצועים. Room ב-WAL הוא
  הנכון לעריכה-חיה טרנזקציונית offline (`MEASURE_APP_ANALYSIS §63`).
- **`.sol` נכתב native ל-`measured/`** בשלוש נקודות-הדק בלבד: (א) גמר-מדידה (סגירת-עבודה),
  (ב) סנכרון יזום, (ג) שיתוף/ייצוא ידני.

### 4.2 מיקום הקוד — `core:sol` כמודול טהור
`core:sol` (Kotlin טהור) מכיל:
- **`SolWriter`** — ממפה `core:model` → ZIP עם `manifest.json` + `measured/walls.json`
  (כולל `thickness_profile` מ-`HeightBands`, `angleToNext`, מפלסים דו-קצה),
  `measured/fixtures.json` (עם `protrusion_mm`/`status`/`measure_ref`), `obstacles.json`,
  `meta/project.json`, `events.json`, ו-**ORDX משומר as-is** ב-`measured/source.ordx`
  (`SOL_FORMAT §5.1`).
- **`SolReader`** — ייבוא `.sol` (בעיקר `design/`) לשכבת-הרקע של ה-fit (§6).
- **`SolCrypto`** — עטיפת-הצפנה + קשירת-רישיון (`SOL_FORMAT §6.3`) — **בשכבת-הכתיבה בלבד**,
  לא באחסון-הפנימי.

### 4.3 מדוע `core:sol` טהור (בלי אנדרואיד)
- ZIP+JSON הוא Kotlin/JVM טהור — אין סיבה לתלות-אנדרואיד.
- **אותו קוד `SolReader/SolWriter` יכול לרוץ בצד-השרת/הממיר** (Node דרך גשר, או JVM ישיר),
  כך שיש **מימוש-קנוני-אחד** של הפורמט משני-הצדדים — מונע סחף-סכמה בין המדידה למשרד.
- בר-בדיקת-round-trip ("פתח→שמור→פתח = זהה", `SOL_FORMAT §7.4`) ב-JVM מהיר.

### 4.4 פערי-שדות שצריך להוסיף ל-`core:model` (לקראת `.sol`)
מ-`MEASURE_REBUILD_PLAN §2.2` + `SOL_FORMAT §3.3`: `measure_status` פר-מידה, `designRef`
(join-key למנוע-ההתאמה), `floor_level` דו-קצה מפורש, מפלסי-תקרה דו-קצה, וזווית-אמת-לכל-קיר
מפורשת. אלה תוספות-שדה למודל הקיים — **לא שינוי-מבני**, כי המודל כבר עשיר (`HeightBands`,
`Accessory.depth` כבר קיימים).

---

## 5. שיתוף עם תוכנת-העיצוב — חוזה, לא קוד (שאלת ה-KMP)

### 5.1 המתח
היעד האסטרטגי: "מנוע משותף" בין המדידה למשרד. אבל **תוכנת-העיצוב היא web** —
React/RTL + Canvas2D + three.js/WebGL + IndexedDB (`DESIGN_TOOL_SPEC §3.1`, FR-DESIGN-34/40),
בעוד המדידה היא Kotlin/אנדרואיד. פער-טכנולוגי זה שולל kernel-קוד-משותף ישיר.

### 5.2 ההכרעה — שני חוזים, לא קוד
משיגים את "המנוע-המשותף" דרך **שני נכסים-משותפים שאינם קוד-מקושר:**
1. **חוזה-הנתונים = `.sol`** — סכמת ה-8 שכבות (`SOL_FORMAT`) היא ה-API בין הצדדים. הצד שמייצר
   `measured/` (המדידה) והצד שצורך `design/`+`fit/` (המשרד) מדברים דרך הפורמט. זהו בדיוק דגם
   `INTERFACE.md` ("שני המסלולים לא חולקים קוד — הם מדברים דרך הממשק").
2. **מפרט-הכללים = R1–R10** — `kitchen_layout_fitting.md` הוא **המפרט**; כל צד מיישם את
   תת-הקבוצה שלו (הטלפון: R4/R1/R3/R9 חיים; המשרד: הסט-המלא). המפרט הוא מקור-האמת, לא הקוד.

**יתרון:** כל צד רץ בסטאק-הטבעי-שלו (המדידה שומרת offline-first ו-BLE הבשלים; המשרד שומר
three.js/web), והם לעולם לא נשברים זה-על-זה — כל עוד `.sol` ומפרט-R1–R10 יציבים.

### 5.3 מתי KMP כן — התנאי המפעיל
KMP (Kotlin Multiplatform) נשמר כ**אופציה-עתידית מותנית**, לא כהחלטת-עכשיו:
- **אם** תוכנת-העיצוב תיבנה/תיבנה-מחדש ב-Kotlin (למשל Compose Multiplatform לדסקטופ במקום
  Electron/React), **אז** `fit-engine` + `core:model` + `core:sol` — שכבר תוכננו כ-Kotlin
  טהור (§2.3) — מוגרים ל-`commonMain` כמעט-ללא-שינוי, ומקבלים kernel-קוד-משותף אמיתי.
- **כל עוד** תוכנת-העיצוב היא web — KMP-JS הוא סיבוך שאינו מצדיק את עצמו מול חוזה-`.sol` פשוט.
- **המשמעות המעשית עכשיו:** כותבים את `fit-engine`/`core` כ-Kotlin-טהור ובלי תלות-אנדרואיד
  (ממילא נכון), כך שהדלת ל-KMP נשארת פתוחה **בעלות-אפס** — בלי לשלם עליה היום.

> **מדוע לא KMP עכשיו:** הצד השני הוא web (`DESIGN_TOOL_SPEC` חד-משמעי). KMP→JS היה מכפיל
> מורכבות-build ו-tooling עבור שיתוף-קוד עם צד שממילא בשפה אחרת. החוזה (`.sol` + R1–R10) נותן
> 90% מהערך ב-10% מהמורכבות. שומרים את הקוד KMP-ready ומחליטים כשהצד-השני מתבהר.

---

## 6. מנוע ה-fit (`fit-engine`) והחוזה המשותף

### 6.1 מיקום ומעמד
`fit-engine` הוא **מודול Kotlin טהור עצמאי** (לא בתוך `app`, לא בתוך feature), כי הוא:
- נכס-הבידול מס' 1 (`MEASURE_REBUILD_PLAN §2.3`) — ראוי לגבול-מודול נקי ולכיסוי-בדיקות גבוה.
- ה-KMP-candidate המובהק (§5.3) — חייב להיות חף-מאנדרואיד מהיום-הראשון.

### 6.2 הממשק
```
fit-engine (Kotlin טהור)
  קלט:  DesignLayer (מ-core:sol / SolReader) + MeasuredLayer (מ-core:model)
  פלט:  List<FitDelta>  (rule=R1..R10, severity, subjects, gap_mm, resolution?)
  API:  fun evaluate(design, measured): List<FitDelta>   // pure, deterministic
```
- **טהור ודטרמיניסטי** — אותו קלט → אותו פלט, בלי מצב-צד. זה מה שהופך אותו לבר-בדיקה ולבר-שיתוף.
- **תת-קבוצה על הטלפון:** R4 (בליטה-מול-עומק — המודל כבר לוכד `depth`), R1 (שורה), R3 (זווית —
  הדגימה כבר 91.3°), R9 (מפלס). הסט-המלא רץ במשרד — **אותו מפרט, מימוש חופף**.
- `feature:fit` (מודול-אנדרואיד) עוטף אותו: טוען `design/` דרך `SolReader`, קורא ל-`evaluate`,
  ומצייר overlay + רמזים בשפת-הנגר. ה-engine עצמו לא יודע דבר על UI.

### 6.3 הזרימה
`SolReader.readDesign(.sol)` → `DesignLayer` → יחד עם `MeasuredLayer` (חי מ-Room) →
`fitEngine.evaluate()` → `List<FitDelta>` → (א) overlay במסך, (ב) טיוטת `fit/deltas.json`
ב-`.sol` בסנכרון (`MEASURE_REBUILD_PLAN §2.3`).

---

## 7. שכבת-החומרה (BLE) — הפשטה ומיסוד

מ-`DISTO_PROTOCOL.md`: שני המכשירים פוענחו מקצה-לקצה — Leica X6 (3D, מחלקה `LeicaDistoManager`,
שירות `3ab1xxxx-...`) ו-Bosch GLM 50C (2D, מחלקה `BluetoothLeManager`, שירות `02a6c0d0-...`).
המסקנה שם מפורשת: **הפשטה משותפת `LaserDevice` עם שני מימושים** (וכבר קיים `LaserDeviceType`).

**הכרעה ארכיטקטונית:**
- מודול `hardware:laser` חושף `interface LaserDevice` (connect/scan/reconnect, `Flow<Measurement>`).
- שני מימושים: `LeicaDistoDevice` (עוטף `LeicaDistoManager`), `BoschGlmDevice` (עוטף
  `BluetoothLeManager`). **לא כותבים-מחדש — עוטפים** את הקוד המוכח (`MEASURE_REBUILD_PLAN §5.1`:
  "לא לגעת בשכבת-ה-BLE").
- `feature:plan/scan` תלויים ב-`LaserDevice` בלבד → מוסיפים מכשיר-עתידי (או Web-BLE אם-אי-פעם)
  בלי לגעת ב-features.
- **USB Encoder — מחוץ-לתחום** (`MEASURE_APP_ANALYSIS §108-110`, החלטת Michael): מסירים
  `EncoderViewModel`/`usb.host`/`device_filter` מהתכנון.

---

## 8. רישוי / multi-tenant

מהמצב-החי: הרישוי הוא **קבצים ב-GitHub repo** של `bravh` (`api.github.com/repos/bravh/
RoomMeasure-Releases/contents/licenses/`) — מנגנון single-tenant חלש-אבטחתית
(`MEASURE_APP_ANALYSIS §88-91`). זה גם **תלות-ספק** — בדיוק מה שהאסטרטגיה רוצה לחתוך.

**הכרעה:**
- מודול `feature:license` + `data:repository/LicenseRepository` מול **שרת-Soline אמיתי**
  (מחליף את GitHub-file-licensing). זה גם מנתק את התלות ב-`bravh`.
- **multi-tenant פר-מודד/פר-נגר** + בידוד-דייר + תפקיד `surveyor` (`ROLES_PERMISSIONS`).
- **קשירת-רישיון ל-`.sol`** (`SOL_FORMAT §6.3`) חיה ב-`core:sol/SolCrypto`: מפתח נגזר
  מזהות-החשבון, אימות ראשוני מקוון, **cache-רישיון-חתום לזמן-מוגבל** ל-offline.
- **ניתוק-`bravh`:** גם ה-`AppUpdater` (שמצביע ל-repo של bravh) מוסב לשרת-Soline.

---

## 9. מיגרציית-נתונים ו-`applicationId` (סיכון-מוניטין)

מ-`MEASURE_REBUILD_PLAN §5.3`: שינוי `applicationId` (`com.roommeasure.app` →
`co.il.soline.measure`) = **התקנה נפרדת**, והמסד החי יושב בנתיב-חיצוני-מותאם
(`/sdcard/Android/data/com.roommeasure.app/files/CVSM_Projects/room_measure_database`,
`MEASURE_APP_ANALYSIS §62`) — כך שפרויקטים קיימים לא ייראו אוטומטית. אובדן-דאטה-בשטח = סיכון-מוניטין.

**הכרעה (דו-שלבית):**
1. **שלב-מיתוג (עכשיו):** שומרים את `applicationId` הקיים → עדכון-in-place, אפס-מיגרציה,
   אפס-סיכון-דאטה. משנים רק שם-תצוגה/אייקון/צבעים/יעדי-שיתוף.
2. **שינוי-חבילה (מאוחר, כשיש כלי-מיגרציה):** כלי חד-פעמי שקורא את ה-Room הישן מהנתיב-החיצוני
   וכותב למופע-Soline. רק אחרי שהכלי מאומת — מבצעים את החלפת-ה-`applicationId`.

---

## 10. טבלת-החלטות (ציר הארכיטקטורה)

| # | החלטה | הכרעה | עדיפות | מקור |
|---|---|---|---|---|
| A1 | adapt מול rebuild מול web | **adapt** (מודולריזציה + הזרקת-שכבות) | P0 | §1 |
| A2 | מבנה-קוד | **רב-מודולי** (`core`/`data`/`hardware`/`feature`/`fit-engine`) | P0 | §2 |
| A3 | ארכיטקטורת-אפליקציה | **single-activity + MVVM/UDF** (שמירה+חידוד) | P0 | §3 |
| A4 | מיקום `.sol` | Room=אחסון-חי; **`core:sol` טהור** = חילוף | P0 | §4 |
| A5 | שיתוף עם העיצוב | **חוזה (`.sol` + R1–R10)**, לא KMP-עכשיו; KMP-ready | P1 | §5 |
| A6 | `fit-engine` | **מודול Kotlin טהור עצמאי**, טהור-ודטרמיניסטי | P1 | §6 |
| A7 | BLE | **`interface LaserDevice`** עוטף את המימושים המוכחים | P0 | §7 |
| A8 | רישוי | שרת-Soline + multi-tenant; ניתוק-`bravh` | P1 | §8 |
| A9 | `applicationId`/מיגרציה | **דו-שלבי** — in-place קודם, החלפת-חבילה אחרי כלי-מיגרציה | P0 | §9 |

---

## 11. תוכנית-מימוש מדורגת

> העיקרון: מודולריזציה-לפני-פיצ'רים היכן-שהיא-חוסמת, אך **לא big-bang** — מפרקים מודול
> תוך-כדי-תנועה, לפי-הצורך של השכבה-הבאה. סדר-העדיפות: מה שחוסם את הבידול קודם.

### שלב A0 — בסיס-מודולרי + מיתוג (adapt · שבועות)
- מעטפת Gradle multi-module: יצירת `core:model`, `core:common`, `data:local`, `data:repository`
  כמודולים, והזזת-הקוד הקיים אליהם (refactor מכני, בלי שינוי-לוגיקה).
- הזרקת שכבת-`Repository` בין ViewModels ל-DAO.
- מיתוג CVSM→Soline **בלי שינוי `applicationId`** (A9 שלב-1).
- מטרה: בניין-ירוק תחת המבנה-החדש, רץ על טאבלט-מודד, זהות-Soline.

### שלב A1 — הליבה הטהורה + `core:sol` בסיסי (build ממוקד)
- חילוץ `core:geometry` (`ShapeSolver` וכו') ו-`hardware:laser` (`interface LaserDevice`
  עוטף Leica/Bosch) כמודולים.
- הרחבת `core:model` בשדות-החסרים (`measure_status`, `designRef`, מפלס דו-קצה, זווית-מפורשת).
- **`core:sol`**: `SolWriter` בסיסי (ZIP + `measured/` + `meta/` + `events.json`, ORDX as-is),
  ללא הצפנה-מלאה. round-trip test ב-JVM.

### שלב A2 — `fit-engine` + `feature:fit` (build — הלב)
- **`fit-engine`** כמודול Kotlin-טהור: `evaluate(design, measured)` עם R4→R1→R3→R9. כיסוי-בדיקות גבוה.
- `SolReader.readDesign` ב-`core:sol`.
- `feature:fit`: שכבת-רקע `design/` + overlay + רמזים בשפת-הנגר; כתיבת `fit/deltas.json`.

### שלב A3 — סנכרון + רישוי (build)
- `data:sync` (WorkManager+okhttp): "העבודות שלי", משיכת `design/`, החזרת `.sol` מועשר, אירועי-מנוע.
- `feature:license` + `LicenseRepository` מול שרת-Soline; **ניתוק-`bravh`** (רישוי+AppUpdater).
- **`core:sol/SolCrypto`**: הצפנה + קשירת-רישיון + cache-offline (`SOL_FORMAT §6.3`).

### שלב A4 — ליטוש והכרעות-דחויות
- הכרעת `applicationId` (A9 שלב-2) עם כלי-מיגרציה מאומת.
- הערכת-KMP מחדש לפי מצב תוכנת-העיצוב (A5/§5.3) — אם עברה ל-Kotlin, הגירת `fit-engine`/`core`
  ל-`commonMain`.
- פיצול `ProjectViewModel` הענק לשאריות שנותרו; הידוק כיסוי-בדיקות.

> **בשורה:** adapt-עם-מודולריזציה. שומרים את הליבה הקשה (BLE/Room/גאומטריה/מודל-הקיר), מפרקים
> אותה למודולים כדי שהבידול (`core:sol`, `fit-engine`, סנכרון, רישוי) ייכנס כשכבות-נקיות
> Kotlin-טהורות, ומגשרים לתוכנת-העיצוב דרך פורמט (`.sol`) ומפרט (R1–R10) — לא דרך קוד. הדלת
> ל-KMP נשארת פתוחה בעלות-אפס.
