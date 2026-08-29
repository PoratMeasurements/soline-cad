# תוכנית-בנייה: מסך-המדידה-המאוחד (מנוע מבט-על) — מוכן-לביצוע

> מסמך-תכן **מוכן-לביצוע** (RTL · לשון-זכר · פונה-למהנדס). תאריך: 2026-08-29.
> **מפרט-של-record:** [`PLANVIEW_ENGINE.md`](PLANVIEW_ENGINE.md). משלים: [`X6_LEVELLING_P2P.md`](X6_LEVELLING_P2P.md) · [`../ops/docs/CVSM_ANALYSIS.md`](../ops/docs/CVSM_ANALYSIS.md).
> **שורש-קנוני:** `D:\Soline\app-measure`. כל ה-file:line מתייחסים לשורש-הזה.
> **מטרה:** לאחד את 6+ מסלולי-מתאר-החדר למסך-אחד `UnifiedMeasureScreen(nav, roomId)` = קנבס-משותף + סרגל-צד שמחליף כלי-קלט פעיל. המסמך מספק ארכיטקטורה, לוגיקה-להרמה (file:line), אסטרטגיית-מיגרציה מדורגת, ורשימת-קבצים ליצירה/עריכה בכל פאזה.

---

## 0. הממצא-המרכזי (למה זה קל יותר ממה שנראה)

**כל מסכי-הלכידה כבר בנויים כ-composables חסרי-state ("controlled") שמקבלים `walls: List<WallEntity>` + callbacks ומציירים ממנו — ה-state האמיתי חי ב-repo.** ה-*hosts* ב-`AppUi.kt` הם שקושרים כל מסך ל-repo. לכן איחוד = **host אחד** שמחזיק את אותו `walls` Flow + `mode` state, ומחליף בין גופי-הכלים כשכולם חולקים את אותם callbacks.

דוגמאות למבנה-הזה כבר בקוד:
- `LiveCadScreen(walls, accessoriesByWall, onAddWall, onRemoveLastWall, onUpdateWall, onBack, onAddArc)` — `LiveCadScreen.kt:122-130`.
- `MeasureCaptureScreen(walls, onAddWall, onUndo, onBack)` — `MeasureCaptureScreen.kt:112-118`.
- `CadDimensionEditor(walls, onEditWall, onBack, onEditHeight)` — `CadDimensionEditor.kt:129-135`.
- `SemiAutoOutlineScreen(roomId, onDone, onBack)` — `SemiAutoOutlineScreen.kt:126-130`.
- `P2PMeasureScreen(roomId, defaultHeightMm, onDone, onBack)` — `P2PMeasureScreen.kt:102-108`.
- `RoomTemplateWizard(defaultHeightMm, onCreate, onBack)` — `RoomTemplateWizard.kt:120-124`.
- `WallShapeCapture(onDone, onBack, initialPoints, initialFlip)` — `WallShapeCapture.kt:116-122`.

**חלוקה קריטית לשני סוגי-כלים** (משפיע על כל הארכיטקטורה):

| סוג | כלים | דפוס | callback |
|---|---|---|---|
| **אינקרמנטלי** (כותב חי לכל פעולה) | צייר-באצבע · מדידה-חיה · הזרקת-לייזר · CAD/קשת | `onAddWall(len,ang)` / `onUpdateWall(w)` / `onRemoveLastWall()` — כותב ל-repo מיד | חי |
| **Batch-commit** (בונה מקומית, שומר בסוף) | מתאר-אוטומטי · P2P · תבניות · אלכסון→זווית | צובר state מקומי, ובסוף `onDone(List<WallEntity>)` | חד-פעמי |

הכלים ה-batch מייצרים `List<WallEntity>` שלם ומחליפים/מוסיפים דרך `addWizardWalls(roomId, newWalls, replace)` (`AppUi.kt:1301-1304`). זה מה שיוצר את סיכון-הליבה של האיחוד (ראה §5): כלי-batch לא כותב חי, ולכן מעבר-כלי באמצע-קלט עלול לאבד עבודה.

---

## 1. המודל-המשותף (מקור-אמת יחיד)

### 1.1 המודל
כל הכלים כותבים ל**מודל-אחד:** `WallEntity` דרך `repo` בתור **Flow DB-backed** (Room) — שורד-סיבוב וניווט אוטומטית. אין state-קירות ב-Composable; ה-host אוסף `repo.walls(roomId)` ומזרים חזרה לקנבס.

**מוסכמת-הגאומטריה (מחייבת — לא לשבור):**
- `WallEntity.length` = אורך במ"מ; `WallEntity.angle` = **זווית-הפנייה אחרי הקיר אל הקיר-הבא**, מעלות, **CCW חיובי** — `WallBuilder.kt:18-24`.
- הפריסה היחידה: `WallBuilder.layout(walls)` → `List<Pt>` (N+1 קודקודים, מתחיל בראשית 0,0 בכיוון +X) — `WallBuilder.kt:49-63`. **כל קנבס בקוד נגזר מזה** — אין מקור-גאומטריה שני.

### 1.2 נתיב-הכתיבה היחיד (repo API שכל הכלים משתמשים בו)
- `repo.walls(roomId): Flow<List<WallEntity>>` — קריאה (hosts: `AppUi.kt:1063,1085,1097`).
- `repo.addWall(roomId, len, height, angle)` — הוספה אינקרמנטלית (`AppUi.kt:1068,1088`).
- `repo.removeLastWall(roomId)` — בטל-נקודה (`AppUi.kt:1069,1089`).
- `repo.updateWall(w)` — עריכת-מידה/זווית (`AppUi.kt:1070,1101`).
- `repo.clearRoomWalls(roomId)` + לולאת-`addWall` — החלפת-מתאר batch (`addWizardWalls`, `AppUi.kt:1301-1304`).
- בליטות (רק-לתצוגה בקנבס): `rememberAccessoriesByWall(walls)` — `AppUi.kt:110-119`.

### 1.3 מה כל כלי קורא/כותב
| כלי | קורא | כותב |
|---|---|---|
| צייר-באצבע | — | `onAddWall` (len מהסקיצה, ang מוצמד-90°) |
| מדידה-חיה | `ble.lastReading.distanceMm` | `onAddWall(len=dist, ang=נבחר)` |
| הזרקת-לייזר | `ble.lastReading.distanceMm` פר-שדה | `onUpdateWall` (אורך-קיר קיים) |
| P2P | `ble.lastReading.{distanceMm,hAngleDeg,vAngleDeg}` | `onDone(cornersToWalls)` |
| אלכסון→זווית | `ble.lastReading.distanceMm` (a,b,c) | `onUpdateWall`/`onAddWall` (זווית מ-`goldenTriangleAngle`) |
| CAD/קשת | — | `onAddArc` → שרשרת-קטעים |
| מתאר-אוטומטי (תבניות) | — | `onDone(RoomTemplates)` |

---

## 2. הארכיטקטורה: מסך-אחד + סרגל-צד

### 2.1 השלד
```
UnifiedMeasureScreen(nav, roomId)                    // host חדש ב-AppUi (או קובץ ui/unified/)
├── walls  = repo.walls(roomId).collectAsStateWithLifecycle()   // מקור-אמת יחיד
├── accMap = rememberAccessoriesByWall(walls)                    // AppUi.kt:110
├── mode   = rememberSaveable { Mode.LASER_INJECT }             // הכלי-הפעיל
├── Row(RTL) {
│     SharedPlanCanvas(walls, accMap, camera, ghost…)  ← קנבס-אחד משותף (מיצוי — §2.2)
│     ToolRail(mode, onMode)                           ← סרגל-צד: 7 כלים (48dp+)
│  }
└── ToolPanel(mode) { … }                              ← גוף-הכלי-הפעיל (תחתון/צדדי)
```
- `mode: enum Mode { AUTO_TEMPLATE, FINGER_DRAW, LASER_INJECT, LIVE_MEASURE, P2P, DIAG_ANGLE, CAD_ARC }`.
- כל ה-state ב-`rememberSaveable` (שורד-סיבוב) — כמו ב-P2P כבר היום (`P2PMeasureScreen.kt:113-134`).
- RTL + לשון-זכר: `CompositionLocalProvider(LocalLayoutDirection provides Rtl)` — כמו `P2PMeasureScreen.kt:211`.

### 2.2 הקנבס-המשותף — הצעד ההנדסי הגדול ביותר
**בעיה נוכחית:** לוגיקת-הקנבס **משוכפלת 4 פעמים** — `RoomPlanCanvas.kt`, `LiveCadScreen.kt`, `MeasureCaptureScreen.kt`, `SemiAutoOutlineScreen.kt` — כל אחד עם `fit()` / `toScreen()` / `drawWorldGrid()` / `segHeading()` / `outwardNormal()` / `trimAngle()` משלו:
- `LiveCadScreen.kt:256-349` (render) + `708-755` (עזרים).
- `MeasureCaptureScreen.kt:214-300` (render) + `512-557` (עזרים).
- `RoomPlanCanvas.kt:136-219` (render, **תצוגה-בלבד — אין gestures**) + `232-282`.

**הפעולה:** לחלץ `SharedPlanCanvas` אחד ל-`ui/canvas/` שמקבל:
```kotlin
@Composable fun SharedPlanCanvas(
    walls: List<WallEntity>,
    accessoriesByWall: Map<Long, List<AccessoryEntity>>,
    camera: CameraState,                       // userScale/panX/panY משותף — hoisted החוצה
    ghost: GhostSegment? = null,               // תצוגה-מקדימה (MeasureCaptureScreen.kt:165-265)
    overlay: (DrawScope.(Projector) -> Unit)? = null,  // שכבת-כלי (קווי-ראייה P2P וכו')
    onTap: ((WallBuilder.Pt) -> Unit)? = null, // צייר-באצבע/בחירת-קיר (world-coords)
    layers: LayerToggles,                      // מידות/זוויות/אובייקטים/רשת
)
```
- מקור ההרמה של הליבה: `LiveCadScreen.kt:256-349` (הכי-שלם — כולל בליטות עם צבע-התנגשות `325-348`, קשתות דרך אותו layout, pan+zoom `260-264`).
- `Projector` = `toScreen(Pt)` שנחשף ל-overlay כדי שכלים יציירו במרחב-העולם (קווי-ראייה של P2P: `P2PMeasureScreen.kt:576-601`).
- `onTap` בקואורדינטות-עולם: לוקחים את `detectTapGestures` מ-SemiAuto (ראה §2.3) והופכים מסך→עולם דרך היפוך ה-`toScreen`.
- `camera` **hoisted** ל-host כך שהמצלמה נשמרת בין-כלים (מעבר-כלי לא מאפס זום/pan — סיכון §5).

**מדיניות-מדורגת:** בפאזה-1 מותר לכל כלי לצייר את הקנבס-שלו inline (מהיר להעלות מסך-עובד); את החילוץ ל-`SharedPlanCanvas` עושים בתחילת-פאזה-2 (ראה §3). זה מוריד סיכון: לא תלוי-חילוץ כדי לבדוק X6.

### 2.3 מיפוי כל כלי → מה-להרים, ומה בטוח לשתף

| כלי-סרגל | reuse | מה-להרים (file:line) | הערות |
|---|---|---|---|
| ▭ **מתאר-אוטומטי** | inline את `RoomTemplateWizard` כפאנל-כלי | כל הקובץ; `onCreate→onDone` (`RoomTemplateWizard.kt:120-124`), נתונים ב-`RoomTemplates.kt` | Batch. כבר עצמאי-לגמרי. |
| ✏️ **צייר-באצבע** | הרם את שלב-ה-SKETCH מ-SemiAuto | `SemiAutoOutlineScreen.kt:81-104` (תיאור), `Phase.SKETCH` (`:113`), `detectTapGestures` להנחת-פינות (`:9`) + הצמדת-90° | **הכלי היחיד שבאמת מצייר-באצבע.** `LiveCadScreen` הוא **מספרי בלבד** (BuildBar `:498`), לא אצבע — ראה §5. |
| 📡 **הזרקת-לייזר** | הרם את `numField` הדָּרוּך | `AppUi.kt:247-298` (re-arm רציף, `armed`/`armedFrom`, `LaunchedEffect(last,armed)` `:255-261`) | הליבה של המפרט (§"מנגנון re-arm"). כותב `onUpdateWall` פר-קיר-נבחר. |
| 📐 **מדידה-חיה** | הרם את גוף `MeasureCaptureScreen` | לכידת-`pendingLenMm` מ-`ble.lastReading` (`MeasureCaptureScreen.kt:148-155`), ghost-preview (`:165-168,251-265`), `CaptureBar` (`:336`), `nextHeadingRad` (`:162`) | המפרט מאחד "מדידה-חיה"="שרטוט-חי"; זהו גוף-הכלי המרכזי. |
| 🎯 **P2P** | הרם את גוף `Phase.BUILD` מ-P2P | arm+`toPlan` (`P2PMeasureScreen.kt:144-156`), `setP2pActive` (`:169-172`), `hAngleMissing`/`distModeHint` (`:177-180`), `PlanCanvas`→overlay (`:563-603`), corners-saver (`:119-125`), `setHanded` mirror (`:195-199`), `cornersToWalls` (`:207-209`) | Batch. **חובה `setP2pActive` תלוי-mode** (§4). |
| ∠ **אלכסון→זווית** | כלי-חדש דק מעל גאומטריה קיימת | `StationSolver.goldenTriangleAngle(a,b,c,ccw)` (`StationSolver.kt:285-309`), `turnFromInterior` (`:318`), `expectedDiagonal` (`:417`) | **הלוגיקה כבר קיימת — חסר רק UI.** 3 שדות-`numField` (a,b,c) → `onUpdateWall(prev.copy(angle=turn))`. |
| 🖉 **CAD/קשת** | הרם את `ArcDialog` + עריכת-מידה/זווית | `LiveCadScreen.kt:410-419` (`ArcWall.arcChain`→`onAddArc`), `CadToolbar` בטל/בצע-שוב (`:208-222`), `EditDim`/`EditAngle` (`:396-409`) | `onAddArc` כבר קיים ב-host (`AppUi.kt:1072-1078`). |

**בטוח-לשיתוף בין כל הכלים (טהור, בלי-Compose):**
- `WallBuilder.layout / isClosed / closingGap / closingAngleDeg` — `WallBuilder.kt`.
- `StationSolver.*` (toPlan, cornersToWalls, goldenTriangleAngle, buildWalls) — `StationSolver.kt`.
- `WallCloseTools.{closeAuto, addClosingWall, attachTJoin, closingReport}` — `WallCloseTools.kt:67,253,201,157`.
- `ArcWall.arcChain / radiusOf` — `geometry/ArcWall.kt`.
- ה-callbacks של repo (§1.2). כל אלה כבר משותפים היום — אין סיכון-שיתוף.

---

## 3. אסטרטגיית-מיגרציה מדורגת

**עיקרון:** אדיטיבי. **המסכים הישנים נשארים חיים** (ה-routes ב-`AppUi.kt:161-173` וכפתורי-`RoomScreen` `:501-561`) עד parity מלא. המסך-החדש נוסף כ-route מקביל `unified/{rid}` וכפתור-כניסה חדש ב-`RoomScreen`. מוחקים ישן רק אחרי אימות-שדה.

### פאזה 1 — שלד + 3 כלי-ליבה (כדי ש-X6 ייבדק שם מיד)
כלים: **צייר-באצבע · הזרקת-לייזר · P2P** (הזרקה+P2P מכסים את כל צריכת-ה-X6; צייר-באצבע נותן מתאר-בסיס לבדוק עליו הזרקה).

**ליצור:**
- `ui/unified/UnifiedMeasureScreen.kt` — השלד (`Row(rail, canvas)` + `ToolPanel(mode)`), state ב-`rememberSaveable`.
- `ui/unified/ToolRail.kt` — סרגל-צד 7-כלים (מטרות ≥48dp), אך רק 3 פעילים בפאזה-1.
- `ui/unified/tools/LaserInjectTool.kt` — עוטף את `numField` הדָּרוּך (מ-`AppUi.kt:247`) פר-קיר-נבחר.
- `ui/unified/tools/P2PTool.kt` — גוף `Phase.BUILD` מ-`P2PMeasureScreen` (בלי כפילות-מסך: מוציאים את הגוף מ-`P2PMeasureScreen.kt:258-457` לפונקציה משותפת).
- `ui/unified/tools/FingerDrawTool.kt` — שלב-SKETCH מ-SemiAuto.

**לערוך:**
- `AppUi.kt` — route חדש `composable("unified/{rid}")` ליד `:173`; כפתור-כניסה ב-`RoomScreen` (`:501-561`); host שקושר `repo.walls` + callbacks (תבנית `MeasureHost` `:1083-1092`).
- `ui/canvas/RoomPlanCanvas.kt` — להוסיף פרמטרי-camera/overlay/onTap אופציונליים (תאימות-לאחור: ברירות-מחדל null) — בסיס ל-`SharedPlanCanvas`.

**קריטריון-סיום פאזה-1:** X6 מזריק אורך לקיר שצויר-באצבע, ו-P2P יורה-פינות באותו מסך; `setP2pActive` מתחלף נכון בין הכלים (§4).

### פאזה 2 — שאר-הכלים + חילוץ-קנבס
כלים: **מתאר-אוטומטי (תבניות) · מדידה-חיה · אלכסון→זווית · CAD/קשת**.

**ליצור:**
- `ui/canvas/SharedPlanCanvas.kt` — חילוץ הליבה מ-`LiveCadScreen.kt:256-349` (+ ghost מ-Measure, overlay מ-P2P). כל הכלים עוברים אליו.
- `ui/unified/tools/AutoTemplateTool.kt` — inline של `RoomTemplateWizard`.
- `ui/unified/tools/LiveMeasureTool.kt` — גוף `MeasureCaptureScreen` (`CaptureBar` + ghost).
- `ui/unified/tools/DiagonalAngleTool.kt` — 3 שדות → `goldenTriangleAngle` (§2.3).
- `ui/unified/tools/CadArcTool.kt` — `ArcDialog` + `CadToolbar`.

**לערוך:**
- `LiveCadScreen.kt` / `MeasureCaptureScreen.kt` / `SemiAutoOutlineScreen.kt` — להחליף את הקנבס-הפנימי בקריאה ל-`SharedPlanCanvas` (מסירים את `fit/toScreen/drawWorldGrid` הכפולים). **המסכים נשארים** (route ישן) אך מצייתים לקנבס-אחד.
- `AppUi.kt` — הפעלת 4 הכלים הנוספים ב-`ToolRail`.

### פאזה 3 — נטישה (רק אחרי אימות-שדה)
- להפוך את כפתורי-`RoomScreen` (`:501-561`) לכניסה-יחידה ל-`unified/{rid}` (או להשאיר "מתקדם" לישנים).
- למחוק routes/hosts ישנים כשאין רגרסיה. **לא בפאזה זו:** `WallShapeCapture`/`WallElevationUnified`/`CadDimensionEditor` — הם מצב-חזית/פרופיל, מחוץ-לתחום מנוע-מבט-העל.

---

## 4. מיקום ה-X6 במסך-המאוחד

### 4.1 מקור-הנתונים (זהה לכל הכלים)
`SolineApp.instance.ble.lastReading: StateFlow<Reading?>` — `LaserBle.kt:95`. שדות: `distanceMm`, `vAngleDeg`, `hAngleDeg`, `ts` — `LaserBle.kt:47-53`. גם `ble.connected` (`:92`) ו-`ble.status` (`:86`).

### 4.2 הזרקת-לייזר (X6/D2/בוש) — כלי 📡
כל קיר-נבחר מקבל שדה-אורך דָּרוּך: `LaunchedEffect(last, armed)` דורס-וממשיך-דרוך על כל `ts>armedFrom` (`AppUi.kt:255-261`). זה עובד עם **כל** מכשיר כי הוא צורך רק `distanceMm`. כותב `onUpdateWall(wall.copy(length=…))`.

### 4.3 P2P (X6 + DST 360-X) — כלי 🎯
- צריכה: `distanceMm` + `hAngleDeg` (azimuth מ-DST) + `vAngleDeg` → `StationSolver.toPlan(d, hAngle, vAngle, cwHanded)` (`P2PMeasureScreen.kt:149`, `StationSolver.kt:167-174`).
- **חובה `setP2pActive` תלוי-mode:** ה-poll של האזימוט (`3ab1010f`) רץ **רק** כש-P2P פעיל, אחרת הוא מציף ומחניק את notify-המרחק (`LaserBle.kt:359-361, 477-482`). לכן ב-`UnifiedMeasureScreen`:
  ```kotlin
  LaunchedEffect(mode) { ble.setP2pActive(mode == Mode.P2P) }   // לא DisposableEffect על כל-המסך!
  ```
  זה שינוי-מהותי מ-P2PScreen שמדליק על כל-המסך (`P2PMeasureScreen.kt:169-172`) — במאוחד ההדלקה מותנית-בכלי.
- **הפעלת-DST כבר קיימת:** `raiseEvent 100\r\n` ל-`3ab10120` נכתב אוטומטית בחיבור (`LaserBle.kt:132-134, 348-358`) — הממצא מ-`CVSM_ANALYSIS.md` כבר מיושם. אין פעולה נדרשת.
- רמזי-מצב לשמר: `hAngleMissing` ("אין DST 360-X") ו-`distModeHint` ("המכשיר במצב-מרחק — בחר Measure-3D/פַלֵּס") — `P2PMeasureScreen.kt:177-180`, מוצגים ב-`:243-248, 274-278, 319-325`.
- כיווניות CW/CCW: `setHanded` משקף פינות-קיימות (`:195-199`).

### 4.4 שער-פילוס (Phase.LEVEL) — hook עתידי
`X6_LEVELLING_P2P.md` §6 מציע `Phase.LEVEL` + `ble.confirmLevelledManually()` לפני ירי-P2P. **טרם-קיים** ב-`LaserBle` (אין `levelled` StateFlow). במאוחד: כשכלי-P2P נבחר וזוהה DST (`connected!=null && hAngleDeg!=null`), להציג כרטיס-פילוס לפני שחרור כפתור-הירי. אדיטיבי; לא-חוסם את פאזה-1 (אישור-ידני בלבד, כמנחה ב-§8 של אותו מסמך).

### 4.5 אלכסון→זווית (D2/בוש בלי חיישן-זווית) — כלי ∠
משפט-הקוסינוסים כבר מיושם: `goldenTriangleAngle(a,b,c)` → `interiorDeg`+`turnDeg` עם חסימת-`[-1,1]` ובדיקת-אי-שוויון-המשולש (`StationSolver.kt:285-309`). ה-UI: 3 שדות-`numField` דרוכים (a=קיר-נכנס, b=קיר-יוצא, c=אלכסון-קצוות) → `onUpdateWall(prevWall.copy(angle=turn))` דרך `solveCornerOnto` (`StationSolver.kt:383-391`). זה שובר את מגבלת-ה-D2/בוש בדיוק כפי שהמפרט דורש.

---

## 5. סיכונים ומאמץ

| # | סיכון | חומרה | מיטיגציה |
|---|---|---|---|
| R1 | **"צייר-באצבע" לא-קיים באמת** — `LiveCadScreen` מספרי-בלבד (`BuildBar` `:498`); רק SemiAuto-SKETCH מצייר-באצבע (`SemiAutoOutlineScreen.kt:113`) | **גבוה** | להרים את ה-SKETCH מ-SemiAuto ל-`FingerDrawTool`, לא מ-LiveCad. אחרת המפרט לא-מתממש. |
| R2 | **התנגשות-מחוות:** צייר-באצבע (`detectTapGestures`) מול pan/zoom של הקנבס (`detectTransformGestures`) | **גבוה** | מחווה תלוית-mode: `onTap` פעיל רק כש-`FINGER_DRAW`; שאר-הכלים = transform-only. `pointerInput(mode)` כמפתח-restart. tap-ל-drag threshold כמו ב-SemiAuto. |
| R3 | **`setP2pActive` על כל-המסך יחניק את notify-המרחק** לכלים לא-P2P | **גבוה** | `LaunchedEffect(mode){ setP2pActive(mode==P2P) }` (§4.3) — לא DisposableEffect-על-המסך. |
| R4 | **מעבר-כלי מאבד קלט-בתהליך** — כלי-batch (P2P/תבניות/אלכסון) צוברים state מקומי; מעבר לפני `onDone` מוחק | בינוני | state-batch ב-`rememberSaveable` **מורם ל-host** (חי מעבר לכלי); אזהרה "יש פינות שלא-נשמרו" בהחלפת-כלי (תבנית קיימת: `P2PMeasureScreen.kt:475-487`). |
| R5 | **camera מתאפס במעבר-כלי** (זום/pan) | נמוך | `CameraState` hoisted ל-host, לא ב-Composable-הכלי (§2.2). |
| R6 | **כפילות-קנבס נשארת** אם דוחים חילוץ | נמוך | חילוץ `SharedPlanCanvas` הוא יעד-פאזה-2 מפורש; פאזה-1 מותר inline. |
| R7 | **הזרקת-לייזר לשדה-לא-מרחק** (מעלות) | נמוך | דגל `laser=false` ב-`numField` כבר-מטפל (`AppUi.kt:245-246,248`). |

**מאמץ מוערך:**
- פאזה-1 (שלד + 3 כלים + X6 עובד): **~4-6 ימי-פיתוח.** רוב-העבודה = חילוץ-גוף-P2P מהמסך והפרדת-מחוות (R2/R3).
- פאזה-2 (4 כלים + `SharedPlanCanvas`): **~4-5 ימים.** החילוץ עצמו ~1.5 יום; אלכסון→זווית ~0.5 יום (הגאומטריה קיימת).
- פאזה-3 (נטישה): **~1-2 ימים** אחרי אימות-שדה.

---

## 6. תמצית-ביצוע (checklist למימוש מהיר)
1. `Mode` enum + `UnifiedMeasureScreen` שלד (`walls` Flow משותף, `mode` saveable, `LaunchedEffect(mode){setP2pActive(mode==P2P)}`).
2. `ToolRail` 48dp+ · RTL.
3. הרם 3 כלי-ליבה: FingerDraw (SemiAuto-SKETCH) · LaserInject (`numField` דָּרוּך) · P2P (גוף `Phase.BUILD`).
4. route `unified/{rid}` + host (תבנית `MeasureHost`) + כפתור-כניסה ב-`RoomScreen`.
5. פאזה-2: `SharedPlanCanvas` (חילוץ מ-LiveCad) → 4 הכלים הנותרים; אלכסון→זווית = `goldenTriangleAngle`.
6. שמר את הישן חי עד parity.
