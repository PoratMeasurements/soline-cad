# HANDOFF — Soline Measure (אפליקציית האנדרואיד)

> נכתב 2026-08-20 לקראת איחוד-הפרויקטים ל-`G:\My Drive\claude\Soline\`.
> **מצב:** יציב — מתקמפל, מותקן, ורץ נקי על הטאבלט (R5GL60ZDP5N). כל המקור מסונכרן ל-Drive.
> שיחה זו **עצרה** לגעת ב-`soline-measure-android` — התיקייה מוכנה להעברה בטוחה.

---

## 1. מה האפליקציה עושה
**Soline Measure** — אפליקציית אנדרואיד **offline-first** (Kotlin · Jetpack Compose/Material3 · Room) למודד-שטח של Soline. מודדת חדרים/מטבחים (כולל **מטבחי-חוץ**) *לפני האבן*, מתחברת למדי-לייזר ב-Bluetooth, ומפיקה קובץ **`.sol`** שהממיר (פרויקט נפרד) הופך ל-**ORDX / PDP / DXF-2D / DXF-3D / PDF-וקטורי / HTML**.

זרימה: **מדידה (אפליקציה) → `.sol` → ממיר → פורמטים → נגר/מפעל.**

---

## 2. מבנה הקוד  (package `il.co.soline.measure`, 59 קבצי .kt)
- **MainActivity.kt** — כניסה · מסך-תמיד-דולק (Prefs.keepScreenOn) · **הסתרת סרגל-ניווט** (immersive, חוזר בהחלקה-מקצה).
- **data/** — מודל-Room וגישה:
  - `Entities.kt` (Project/RoomEntity/WallEntity/AccessoryEntity + AccType), `CabinetModel.kt` (CabinetEntity + **CabinetKind** — כולל 11 ארונות `OK_*` מטבח-חוץ), `JobModel.kt` (Carpenter/JobEntity), `LevelModel.kt` (LevelPointEntity — סקר-מישוריות).
  - `SolineDatabase.kt` — **גרסה 3**, MIGRATION_1_2 (+cabinets/carpenters/jobs/wall.framePointsJson) + MIGRATION_2_3 (+level_points) + `fallbackToDestructiveMigration()` רשת-ביטחון.
  - `SolineDao.kt`, `Repo.kt` (עוטף DAO + מנוע-fit + **exportSol** שאוסף ארונות), `Prefs.kt`, `CustomElementStore.kt` (אלמנטים-אישיים JSON ב-SharedPreferences), `RecentElementsStore.kt` (אחרונים/מועדפים לבורר), `BackupManager.kt` (גיבוי-הכל ל-ZIP→שיתוף), **`SolineApp`** (Application — מחזיק `repo` + `ble`).
- **device/** — `LaserBle.kt` (מנהל-ה-BLE האמיתי — X6/D2/Bosch + **זווית-אופקית מ-DST 360-X**), `LaserDevice`/`LeicaDistoX6Device`/`BoschGlm50Device` (הפשטות).
- **geometry/** — `WallBuilder.kt` (polyline · **מקור-אמת יחיד לגאומטריה**), `WallCloseTools.kt` (חיבור-T/סגירה), `Trilateration.kt`, `LevelGrid.kt`, `FloorLevelSolver.kt` (גובה-מ-Z לרצפה/תקרה), `StationSolver.kt` (P2P + משולש-הזהב).
- **catalog/** — `ElementCatalog.kt` (**63 אלמנטים** — CVSM + מטבח-חוץ · `allWith`/`byGroupWith` למיזוג אישיים), `MaterialLibrary.kt` (**71 חומרים** — דקטון/סנסה/קיסר + קירות/ריצפות/נירוסטה · TextureKind).
- **fit/** — `FitEngine.kt` (R1–R10), `CabinetFit.kt`, `RoomValidator.kt`, `RulesExtra.kt`, `ElevationFit.kt` (**זיהוי-התנגשויות** ארון↔תשתית).
- **export/** — `SolWriter.kt` (כותב `.sol` ZIP+JSON, כולל **cabinets[]**), `OrdxExporter.kt`, `ProjectSummary.kt`.
- **ui/** — `AppUi.kt` (**גרף-הניווט + כל ה-Hosts** + WallScreen/RoomScreen/ProjectRoomsScreen/HomeScreen host), `Theme.kt` (צבעי-מותג + M3 typography/shapes), `DevicesScreen.kt`. תת-חבילות: `home` `settings` `intake` `measure` `draw` `cad` `canvas` `view3d` `elevation` `shape` `cabinet` `resize` `close` `semiauto` `verify` `level` `p2p` `capture`(ElementPickerSheet) `library`(ElementLibraryScreen) `components`(SolineComponents) `fields`(ElementMeasureFields).

**מסכי-מדידה עיקריים** (מ-RoomScreen): שרטוט-חי · מדידה-חיה · שרטוט-חצי-אוטומטי · **P2P** · תלת-מימד · עריכת-מידות · Datum · אימות · **רצפה/תקרה**. מ-WallScreen: **חזית-מאוחדת (שכבת-תכנון+התנגשויות)** · מדידת-חזית X6 · **ארונות**.

---

## 3. בנייה והרצה  (חשוב — הטולצ'יין על C:)
Android **לא בונה מתוך תיקיית-Drive מסונכרנת** → עותק-בנייה על `C:\android-dev\soline-measure`, ומקור-אמת מסונכרן ל-Drive.
```
JAVA_HOME=C:\android-dev\jdk-17.0.20+8
C:\android-dev\gradle-8.9\bin\gradle assembleDebug      # אין gradlew בעותק-הבנייה — Gradle גלובלי
ADB:  C:\android-dev\sdk\platform-tools\adb.exe          # התקנה: adb install -r <apk>
```
פלט: `app/build/outputs/apk/debug/app-debug.apk`. minSdk 26 · targetSdk 35 · KSP(Room).
> **הפרויקט הנייד** (עם Gradle wrapper, לפתיחה ב-Android Studio/VS): `claude/soline-measure-project/` + `claude/SolineMeasure.zip`.

---

## 4. מה שונה היום (2026-08-20) ולמה
גל-ענק מרובה-סוכנים, הכל אינטגרלי+בנוי+מותקן:
- **קטלוג-אלמנטים** — חולץ מ-`Measuring Elements.pkg` של CVSM (~40) + **מטבח-חוץ** (22 מוצרים + 11 ארונות, מ-13 PDF שגב-כרמל/אלקינצו). *למה:* Michael רצה את אלמנטי-CVSM הנתמכים-ORDX + עולם-מטבחי-החוץ.
- **ספריית-אלמנטים: שכפול/יצירה-מאלמנט-קיים** (`ui/library` + `CustomElementStore`) — מחקה את `CatalogVariantManager` של CVSM 5.9. מגיעים דרך הבורר → "📋 ניהול ספרייה". *(ראה §5 — Michael רצה שזה יהיה חילוץ **נאמן** של כל 79 ה-.bcd; זה חצי-גמור.)*
- **2 שיטות-מדידה** (מרכז / היסטים-מפינות) — `ui/fields/ElementMeasureFields.kt`, מחובר ב-AddAccessoryDialog.
- **שכבת-תכנון בחזית + זיהוי-התנגשויות** — `WallElevationUnified` + `ElevationFit` (ארון חורג / צינור-בגוף-ארון = אדום). מתג "שכבת תכנון".
- **אלגוריתם רצפה/תקרה מבוסס-Z** — `FloorLevelSolver` (Z=d·sinθ), נקודת-0, `LevelSurveyScreen` נכתב-מחדש.
- **חומרים** (71), **UI** (Theme), **UX** (SolineComponents+HomeScreen), **בורר-מהיר** (אחרונים/מועדפים).
- **P2P** — `P2PMeasureScreen`+`StationSolver` (כיול-עמדה, 2-נקודות-לקיר, משולש-הזהב לזווית, חיבור-T).
- **קוהרנטיות .sol** — `SolWriter` כותב cabinets ל-.sol → הממיר מייצא אותם לכל הפורמטים.
- **DST 360-X — פוצחה הזווית-האופקית** (היום, live): char `3ab1010f`, **float32 LE ברדיאנים בבייטים 0-3** = azimuth. מוטמע ב-`LaserBle` → `Reading.hAngleDeg`.
- **מסך-מכשירים** — סינון להצגת מדי-לייזר בלבד + חיזוק-חיבור (TRANSPORT_LE, סגירת-GATT).

---

## 5. מצב נוכחי — עובד / חצי-גמור / שבור
### ✅ עובד (בנוי · מותקן · עולה נקי)
כל §2/§4 מתקמפל ורץ. מדידה, קטלוג, בורר, ספרייה, חזית+התנגשויות, רצפה/תקרה, מסך-P2P, ייצוא-.sol, גיבוי, immersive — כולם live על הטאבלט.

### ◐ חצי-גמור
- **ספריית-CVSM הנאמנה** — סוכן-החילוץ **נעצר באמצע** (עצרתי אותו לפני ההעברה כדי לא להשאיר חצי-קובץ; `ElementCatalog.kt` תקין עם 63 אלמנטים — הסט האוצר-ידנית שלי, **לא** החילוץ המלא של 79 ה-.bcd). המקור והשיטה מתועדים (scratchpad `elements/pkg` — 79 `.bcd`=CVTemplate3d, 27.cat; טכניקת-UTF-16 לחילוץ שמות). **צריך להשלים.**
- **DST 360-X → XYZ מלא** — הזווית-האופקית **קיימת ב-`Reading.hAngleDeg`**, אבל האלגוריתמים (`FloorLevelSolver`/`StationSolver`/`LevelSurveyScreen`/P2P) עדיין משתמשים במרחק+זווית-אנכית בלבד. **הצעד הבא:** לחווט hAngle→XYZ (X=r·cosφ, Y=r·sinφ, Z=d·sinθ_v, r=d·cosθ_v).
- **בורר-חומרים** — הנתונים (71) מוכנים, אין UI-בחירה + לא נשמר per-ארון + לא ב-.sol.
- **מנוע-הדמייה (G)** — קיים בממיר (`ordx-pdp-converter/src/viz_engine.js` + `viz/kitchen_viz.html`, offline WebGL, צוקל, טקסטורות, שכבת-תכנון, התנגשויות, הצללה, הסתרת-קירות) אבל **לא מוטמע באפליקציה** (WebView) ולא בדו"ח-ה-HTML.

### ⚠️ שבור / לא-מאומת
- **דיוק רצפה/תקרה** — אלגוריתם-J נכון תיאורטית, **לא אומת חי** מול משטח-ידוע. (Michael התלונן קודם "לא תואם ללייקה"; עכשיו Z=d·sinθ — צריך מדידת-בדיקה.)
- **חיבור X6** — היה מקרטע (`status=147` ב-log; חשד: **CVSM אוחז בחיבור-ה-BLE**, מכשיר-BLE = חיבור-יחיד). *עקיפה:* לסגור לגמרי את CVSM + כבה/הדלק Bluetooth. חיזוק-הקוד (TRANSPORT_LE/סינון) **מותקן אבל לא אומת חי** מול הבעיה.
- **DXF עם כל האלמנטים** — סוכן קודם נקטע; הממיר מייצא ארונות, אבל "כל אביזר-מדידה ב-DXF בפריטי-ORDX" לא אומת-מחדש.

---

## 6. משימות פתוחות / הצעד-הבא שתוכנן  (לפי עדיפות)
1. **XYZ מלא** — לחווט `Reading.hAngleDeg` ל-`FloorLevelSolver` + `StationSolver` + מסכי רצפה/תקרה+P2P (הנתון מוכן; רק המתמטיקה הכדורית + fallback ל-X6-לבד).
2. **השלמת ספריית-CVSM הנאמנה** — חילוץ מלא של 79 ה-.bcd (מידות אמיתיות + ORDX-מהקורפוס) → `ElementCatalog`. (Michael הדגיש: "תעתיק את התוכנה נאמנה".)
3. **בורר-חומרים** + שדה-material ב-CabinetEntity (מיגרציה 4) + כתיבה ל-.sol → הממיר/הדמייה צובעים.
4. **אימות-שטח חי:** רצפה/תקרה מול משטח-ידוע · P2P מול ריבוע-ידוע · DST360X-XYZ · חיבור-X6.
5. **הטמעת מנוע-ההדמייה** באפליקציה (WebView שטוען `kitchen_viz.html` עם JSON-החדר) ובדו"ח-ה-HTML.
6. **PDP** — תקינות Raumplan (Michael השהה: "תעזוב את סעיף 1").
7. תיקוני `APP_REVIEW.md` שנותרו · InnoDraw עדיפות-2/3.

---

## 7. החלטות-עיצוב וגוצ'ות (לא ברור מהקוד)
- **X6 ב-BLE = מרחק + זווית-אנכית (inclination) בלבד.** זווית-אופקית/XYZ-מלא דורש **DST 360-X** (יש ל-Soline!). char `3ab1010f`: **float32 LE ברדיאנים בבייטים 0-3** = azimuth (פוצח היום). לכן: משולש-הזהב לזוויות-קירות, Z=d·sinθ למישוריות — עובד גם בלי המתאם; המתאם פותח XYZ-מלא.
- **`WallEntity.angle` = זווית-הפנייה לקיר-הבא** (CCW חיובי). **`WallBuilder.layout` = מקור-האמת היחיד** לגאומטריה (באג-הזווית 180−angle תוקן — כל הצרכנים עברו ל-WallBuilder).
- **`.sol`:** `SolWriter` כותב room-json נייטיב עם `cabinets[]` (kind=base|wall|tall · wallId=**idx** לא DB-id) · **הוסרה הטמעת source.ordx** (הממיר מרנדר ארונות מהנתיב-הנייטיב). סכמת-הארונות תואמת ל-`readSol.js` בממיר.
- **Room DB:** מיגרציות אמיתיות 1→2→3 + `fallbackToDestructiveMigration` רשת-ביטחון (לא יקרוס בהפעלה; עלול לאפס נתוני-בדיקה אם יש אי-התאמה).
- **`LaserBle` סינגלטון** (`SolineApp.instance.ble`) — חיבור שורד-ניווט + reconnect-אוטומטי (עד 3 דק'). **דליפת-GATT-clients** בכשלי-חיבור-חוזרים (חוזק חלקית עם TRANSPORT_LE + סגירה). הזרקת-מדידה-לשדה = one-shot-לפוקוס (`lastReading.ts > armed`).
- **בורר-אלמנטים:** חתימה יציבה `ElementPickerSheet(onPick, onDismiss, onManageLibrary=null)`. Prefs/CustomElementStore/RecentElementsStore כולם lazy-init דרך `SolineApp.instance` (אין init מפורש).
- **צבעי-מותג** ב-`ui/Theme.kt`: Orange #F49A1A · Teal #1596A8 · Cream #FBF4E6 · Ink #2B2B2B · OkGreen · WarnAmber · BlockRed. RTL עברית, לשון-זכר. **הלוגו:** קובץ מדויק `brand/soline-logo.png` — אין לשנות/לעצב-מחדש.

---

## 8. מסמכים נלווים (ידע-רקע)
תחת `soline-ops-app/docs/`: CVSM_FEATURES · CVSM_5.6/5.9_UPDATE · CVSM_ELEMENT_SCHEMA · ORDX_ELEMENT_SPEC · ORDX_SPEC_VALIDATION · CVSM_SCHEMA_VALIDATION · INNODRAW_FEATURES/NEW_VERSION · **X6_CAPABILITIES** · MATERIALS_LIBRARY · OUTDOOR_KITCHEN_LIBRARY · UI_AUDIT · UX_AUDIT · **VIZ_ENGINE** · FAST_FLOW · APP_REVIEW · DISTO_PROTOCOL · outdoor_kitchen_elements.kt.txt.
זיכרון-משותף: `.claude/.../memory/soline-measure-android.md` (+ MEMORY.md index).
ה-`.pkg` המחולץ + CVSM APKs (5.6/5.9) ב-scratchpad-הסשן (ארעי — לא ב-Drive).

---

## 9. להמשיך בלעדיי — checklist
1. העתק `soline-measure-android/` ליעד + הצב עותק-בנייה על **דיסק מקומי** (לא Drive).
2. `JAVA_HOME`+`gradle assembleDebug` → APK → `adb install -r` (נדרש JDK17 + Android SDK platform-35/build-tools-35).
3. הבנייה ירוקה **עכשיו** — נקודת-פתיחה יציבה. המשך מ-§6 (הבא: XYZ מלא + ספריית-CVSM נאמנה).
4. לכל מסך/פיצ'ר — הקבצים ב-§2; לכל החלטה — §7; לכל רקע — §8.
