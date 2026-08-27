# סקירת קוד — Soline Measure (Android)

סקירת באגים ושיפורים על `C:\android-dev\soline-measure\app\src\main\kotlin\il\co\soline\measure\`.
נעשתה בקריאה מלאה של כל קבצי-המקור. **הקוד עצמו לא שונה** — האינטגרטור מיישם את התיקונים.

> **הערה חשובה:** הקוד עובר אינטגרציה חיה בזמן הסקירה (קבצים השתנו בין קריאה לקריאה — למשל `Repo.kt`/`SolineDao.kt`/`AppUi.kt` קיבלו את שכבת-הייצוא תוך-כדי). **מספרי-השורות עשויים לזוז מעט**; יש לאמת מול המצב הנוכחי לפני תיקון.

## ספירה לפי חומרה
- **P0 (סיכון-קריסה):** 3
- **P1 (באג אמיתי / נכונות):** 6
- **P2 (שיפור / חוב-טכני / קוד-מת):** 12

**הכי מסוכן קודם:** אין קריסה ודאית שנמצאה, אבל שלוש מוקשי-קריסה סמויים (P0). הבאג הכי משמעותי מבחינת-תוצר הוא חוסר-עקביות בקונבנציית-הזווית שיפגום בייצוא ORDX, ופער-אינטגרציה שבו כמעט כל מסך-ההגדרות אינו משפיע על האפליקציה.

---

## P0 — סיכון-קריסה (סמוי, לתקן לפני שחרור)

### P0-1 · `remember` אחרי `return@Box` מותנה — סיכון לקריסת Compose
`ui/elevation/ElevationScreen.kt:178-188`
בתוך ה-`Box`: `if (wall.height <= 0.0 || wall.length <= 0.0) { Text(...); return@Box }` (178) — היציאה-המוקדמת קודמת לשלוש קריאות `remember { Paint(...) }` (186-188).
- **בעיה:** מספר קריאות-ה-`remember` באותו מיקום משתנה בין המסלולים (0 בענף-הלא-תקין, 3 בענף-התקין). זהו בדיוק הדפוס ש-Compose אוסר; מעבר בין המסלולים בזמן-ריצה עלול לזרוק `IllegalStateException` (slot-table).
- **תרחיש-כשל:** קיר נטען עם `length>0, height>0` (מסלול-תקין), ואז המשתמש עורך את הקיר ל-0 (או להפך) בעוד המסך פתוח → מעבר-מסלול → קריסה. הסבירות נמוכה (צריך לחצות את גבול-האפס בזמן-אמת), אך זו קריסה אמיתית.
- **תיקון:** להעביר את שלושת ה-`remember` **מעל** ה-`if`/`return@Box` (בדיוק כמו ב-`RoomPlanCanvas.kt:123-131`, שם הסדר תקין).

### P0-2 · פירוק ארגומנט-ניווט עם `!!.toLong()` ללא הגנה
`ui/AppUi.kt:61-70` (כל ה-routes: `shape/{wid}`, `rooms/{pid}`, `room/{rid}`, `draw/{rid}`, `measure/{rid}`, `view3d/{rid}`, `cad/{rid}`, `elevation/{wid}`, `wall/{wid}`)
`it.arguments?.getString("wid")!!.toLong()`
- **בעיה:** `!!` על ארגומנט חסר → `NPE`; `toLong()` על ערך לא-מספרי → `NumberFormatException`. כל ניווט-פנימי מעביר מזהים מספריים, לכן בטוח בפועל — אך כל deep-link/restore-state/שגיאת-הקלדה עתידית תפיל את האפליקציה בלי הודעה.
- **תיקון:** `it.arguments?.getString("wid")?.toLongOrNull() ?: return@composable`, או הגדרת `navArgument(type = NavType.LongType)` והחלפה ל-`getLong`.

### P0-3 · Cast קשיח `applicationContext as SolineApp`
`ui/DevicesScreen.kt:43`, `ui/measure/MeasureCaptureScreen.kt:120`, `ui/elevation/ElevationScreen.kt:140`, `ui/shape/WallShapeCapture.kt:119`
- **בעיה:** אם ה-Application-class אינו רשום/יוחלף → `ClassCastException`. כרגע `.data.SolineApp` רשום ב-`AndroidManifest.xml:13`, לכן בטוח — אך זהו נקודת-כשל שברירית לכל שינוי-מניפסט/מנגנון-בדיקה. שקול `context.applicationContext as? SolineApp` + fallback, או גישה דרך `SolineApp.instance`.

---

## P1 — באגים אמיתיים / נכונות

### P1-1 · שתי קונבנציות סותרות ל-`WallEntity.angle` — ייצוא-ORDX/ולידציה שגויים בכל זווית שאינה 90°
מסלול-הלכידה (מקור-האמת) מפרש את `angle` כ**פנייה ישירה** של ה-heading:
- `geometry/WallBuilder.kt:60` — `headingRad += Math.toRadians(w.angle)`
- `ui/measure/MeasureCaptureScreen.kt:161` — `nextHeadingRad = ordered.sumOf { Math.toRadians(it.angle) }`
- וכן `Room3DView`, `CadDimensionEditor`, `LiveCadScreen` (כולם דרך `WallBuilder.layout`).

לעומת-זאת שלושה צרכנים אחרים מפרשים את `angle` כ**זווית-פנימית** ומחשבים פנייה `180 − angle`:
- `export/OrdxExporter.kt:102` — `heading += (180.0 - w.angle)`
- `fit/RoomValidator.kt:142` — `headingDeg += 180.0 - w.angle`
- `ui/canvas/RoomPlanCanvas.kt:236` — `heading += Math.toRadians(180.0 - w.angle)`

- **בעיה:** עבור `angle=90` שתי הנוסחאות נותנות פנייה של +90° (במקרה), ולכן מלבנים נראים תקין בכל-מקום. אך עבור כל זווית אחרת (45°, מותאם) הן מתפצלות: 45° = פנייה של 45° במסלול-הלכידה, אך 135° בייצוא/ולידציה. משמע **הגאומטריה שתיוצא ל-ORDX (Start/End/Angle) שונה מהצורה שהמודד ראה ואישר על המסך**, וכן `RoomValidator.closureGapMm` יחשב פער-סגירה שגוי (עלול לחסום/לאשר חדר בטעות).
- **מצב-נוכחי:** שלושת הצרכנים הבעייתיים אינם מחוברים כרגע ל-UI (`exportOrdx` מוגדר ב-`Repo` אך אין קורא; `RoomValidator` ו-`RoomPlanCanvas` לא ב-nav). לכן **סמוי** — אך זהו מוקש: ברגע שיחברו את `exportOrdx` (וזו כל מטרת-האפליקציה) הייצוא ייצא צורה מעוותת.
- **תיקון:** לאמץ קונבנציה אחת. מכיוון שמסלול-הלכידה + מודל-הנתונים (`Entities.kt:31` "זווית לקיר הבא") + `WallBuilder` KDoc כולם מגדירים `angle` = פנייה-ישירה (CCW חיובי), יש לתקן את `OrdxExporter`, `RoomValidator`, `RoomPlanCanvas` להשתמש ב-`headingRad += toRadians(w.angle)` (כמו `WallBuilder.layout`), ולא ב-`180 − angle`. אידיאלית — לגזור את כולם מ-`WallBuilder.layout` במקום להעתיק את הגאומטריה 5 פעמים.

### P1-2 · מסך-ההגדרות אינו משפיע על האפליקציה — כל ה-Prefs מתעלמים ממנו
`data/Prefs.kt` נכתב ונשמר תקין, אך אף ערך אינו נקרא ע"י שאר-האפליקציה:
- `defaultWallHeightMm` — `RoomScreen` (`AppUi.kt`) מקודד `"2700"` בדיאלוג, ו-`MeasureHost`/`DrawScreenHost` מקודדים `2700.0` (`AppUi.kt:314,325`).
- `soundOnCapture` — `LaserBle.beep()` מצפצף תמיד; המסכים מצפצפים תמיד — לא נבדק ה-pref.
- `autoReconnectLaser` — `LaserBle.startAutoReconnect` רץ תמיד; ה-pref לא נבדק.
- `keepScreenOn` — `MainActivity.kt:13` מדליק `FLAG_KEEP_SCREEN_ON` ללא-תנאי.
- `angleLockDefault` — צ'יפ-הזווית תמיד מתחיל ב-`DEG90` ללא קשר.
- `units` (מ"מ/ס"מ) — כל התצוגה במ"מ תמיד.
- **בעיה:** המשתמש משנה הגדרות ולא קורה כלום — חוויה שבורה ומטעה.
- **תיקון:** לחווט את הקריאות: גובה-ברירת-מחדל בדיאלוגי-קיר, בדיקת-pref ב-`beep()`/reconnect, `keepScreenOn` ב-`MainActivity`, וכו'. אם חלק לא נתמך עדיין — להסתיר את השורה במסך-ההגדרות.

### P1-3 · תצוגות שרטוט/3D לא מתרעננות בעריכת-אביזרים
`ui/AppUi.kt:305-310` (`DrawScreenHost`) ו-`345-352` (`Room3DHost`)
`LaunchedEffect(walls) { for (w in walls) m[w.id] = repo.accessoriesForWall(w.id); accMap = m }`
- **בעיה:** `accMap` מחושב מחדש רק כאשר רשימת-ה**קירות** משתנה, לא כשאביזר נוסף/נערך/נמחק (שאילתת one-shot `accessoriesForWall`, לא Flow). הוספת שקע לא תופיע בשרטוט-החי/3D עד ששינוי-קיר יפעיל את ה-effect.
- **תיקון:** להשתמש ב-Flow תגובתי (למשל `combine` על כל ה-`accessories(wallId)`), או להוסיף מפתח שמתעדכן על שינוי-אביזרים.

### P1-4 · `enableAllNotifyIndicate` מדליק כל characteristic → צפצופים ורשומות-רפאים
`device/LaserBle.kt:273-294` + `handleFrame:306-317`
בחיבור-Leica מדליקים notify/indicate על **כל** ה-characteristics (סוללה, device-info וכו'). ב-`handleFrame` כל UUID שאינו `LEICA_MEAS`/`BOSCH_MEAS` נופל ל-`else -> Reading("נתון", distanceMm=null, ...)`, ואז `beep()` + עדכון `_lastReading`/`_readings`.
- **בעיה:** כל notification מ-characteristic זר גורם לצפצוף-שווא, מזין רשומת-"נתון" לרשימה, ודורס את `_lastReading` בקריאה עם `distanceMm=null` → הבהוב "– – –" במסכים החיים (למשל `ElevationScreen.liveMm`). ה-`lastCounter` (dedup) לא חל על ענף ה-else.
- **תיקון:** ב-`else` להחזיר `null` (לא ליצור Reading), או להדליק notify רק על `LEICA_MEAS`/`LEICA_HANGLE` הידועים במקום על-הכול. שווה גם לכבד את `Prefs.soundOnCapture`.

### P1-5 · ישויות `JobModel` אינן ב-DB; `JobIntakeScreen` אינו מחובר
`data/JobModel.kt` (`Carpenter`, `JobEntity`) לא מופיעות ב-`data/SolineDatabase.kt:9` (`entities = [Project, RoomEntity, WallEntity, AccessoryEntity]`). `ui/intake/JobIntakeScreen.kt` בונה `JobEntity` ומעביר ל-`onSave`, אך המסך אינו רשום ב-NavHost.
- **בעיה:** כרגע סמוי (אף אחד לא מנסה להתמיד `JobEntity` דרך Room). אך ברגע שיחברו את מסך-פתיחת-העבודה ל-Room — קריסת-Room (ישות לא-רשומה) + צורך ב-migration.
- **תיקון:** כשמחברים — להוסיף את הישויות ל-`@Database`, לבצע bump-גרסה + migration (או `fallbackToDestructiveMigration` בזמן-פיתוח). כרגע לפחות לתעד שהמסך לא-פעיל.

### P1-6 · תוצאת `WallShapeCapture` נזרקת
`ui/AppUi.kt:379-389` (`ShapeHost`)
`onDone = { pts -> Toast(...); nav.popBackStack() }` — הנקודות שנלכדו (מתאר-חזית של קיר לא-ישר, שעות-עבודה בשטח) לא נשמרות (יש `// TODO` בקוד).
- **בעיה:** פיצ'ר שנראה עובד אך מאבד את הנתונים בשקט — המודד חושב ששמר.
- **תיקון:** להוסיף שדה-מודל לצורת-קיר ולהתמיד, או לחסום את הכפתור/לסמן "בקרוב" עד להתמדה.

---

## P2 — שיפורים / חוב-טכני / קוד-מת

### P2-1 · שכבת-הפשטה `LaserDevice` כפולה ולא-בשימוש (GATT = TODO)
`device/LaserDevice.kt`, `device/LeicaDistoX6Device.kt`, `device/BoschGlm50Device.kt`, `PointCaptureSound` — חוזה + מימושים עם `TODO(GATT)` שלא מחווטים (ה-connect/discover ריקים). האפליקציה משתמשת בפועל רק ב-`LaserBle.kt`. גרוע מכך, פענוח-Bosch שם (`BoschGlm50Device.decodeFrame`: mode@0, float@4) **סותר** את `LaserBle.parseBosch` (frame-type@3==0x06, counter@5, float@7). קוד-מת מבלבל שמסכן שימוש-שגוי.
- **המלצה:** למחוק את שכבת-ה-`device/Laser*Device.kt` הכפולה, או להשלים ולמזג ל-`LaserBle` כמימוש היחיד.

### P2-2 · קוד-מת נוסף (לא-מקושר ל-nav/לוגיקה)
- `export/ProjectSummary.kt` — אין קורא.
- `fit/RoomValidator.kt`, `fit/RulesExtra.kt` (R1/R2/R3/R5/R9), `FitEngine.demoFit()` — אין קורא (רק `runFit`/`ruleR4` פעילים).
- `ui/canvas/RoomPlanCanvas.kt`, `ui/cad/CadToolbar.kt` (+`EditHistory`/`rememberEditHistory`), `ui/capture/ElementPickerSheet.kt`, `ui/capture/NoteFilterBar.kt` — לא ב-nav ולא נקראים.
- `ui/AppUi.kt:150 ProjectsScreen` — לא-בשימוש: `startDestination="projects"` מפנה ל-`HomeScreen` (`AppUi.kt:58`), לא ל-`ProjectsScreen`.
- **המלצה:** להסיר או לחבר. לכל-הפחות לסמן `// UNUSED` כדי שלא יטעו לתחזק אותו.

### P2-3 · `ElementCatalog` העשיר אינו בשימוש — הדיאלוג משתמש ב-`AccType` הבסיסי
`AddAccessoryDialog` (`AppUi.kt:456-486`) משתמש ב-`AccType.entries` (9 סוגים) ולא ב-`catalog/ElementCatalog` (עשיר, מקובץ, ניתן-לחיפוש, עם `round`/`hasDepth`). ה-`ElementPickerSheet` שנבנה סביבו — לא מחובר.
- **המלצה:** לחבר את `ElementPickerSheet`+`ElementCatalog` לדיאלוג-הוספת-הבליטה.

### P2-4 · op-queue של GATT עלול להיתקע
`device/LaserBle.kt:202-211` + `enableAllNotifyIndicate`/`enableNotify`
אם `writeDescriptor`/`writeCharacteristic` מחזירים `false` (לא-אותחל) — אין callback, ולכן `next()` לא נקרא והתור נתקע לצמיתות.
- **המלצה:** לבדוק את ערך-ההחזר; אם `false` — לקדם את התור ידנית / לרשום שגיאה / retry.

### P2-5 · `disconnect()`/reconnect — גישה ל-`gatt` מ-Main מול callbacks מ-binder-thread
`device/LaserBle.kt` — `scope = Dispatchers.Main` מריץ `doConnect`/`gatt?.close()` בעוד ה-`gattCb` רץ ב-binder-thread ונוגע ב-`gatt` ובתור. `_status`/`_lastReading` (StateFlow.value) אטומיים ובטוחים, אך התור (`ArrayDeque`) וההצמדה ל-`gatt` אינם מסונכרנים.
- **המלצה:** למקד את כל פעולות-ה-GATT ל-thread/handler יחיד (או `synchronized` על התור).

### P2-6 · התראת-"ממתין" תיכשל בשקט ב-Android 13+
`device/LaserBle.kt:186-200` `postWaitingNotification` — `POST_NOTIFICATIONS` מוצהר (`AndroidManifest.xml:9`) אך לעולם לא מתבקש בזמן-ריצה. ב-API 33+ ההתראה פשוט לא תוצג.
- **המלצה:** לבקש `POST_NOTIFICATIONS` (למשל לצד הרשאות-ה-BLE ב-`DevicesScreen`).

### P2-7 · `release()` של הלייזר לעולם לא נקרא
`device/LaserBle.kt:354` — אין lifecycle-owner שקורא ל-`release()`; ה-`scope` (SupervisorJob) וה-`ToneGenerator` לא משוחררים. לפי-עיצוב הסינגלטון שורד — קביל, אך ה-scope נשאר לתמיד.
- **המלצה:** לשחרר בכיבוי-אפליקציה מכוון, או לתעד שהדליפה מכוונת.

### P2-8 · זרימת-המדידה החיה מקבעת גובה-קיר 2700
`ui/AppUi.kt:314,325` (`DrawScreenHost`/`MeasureHost`) — קירות שנוספים במדידה-חיה מקבלים `height=2700.0` קבוע, בלי אפשרות למדוד/להזין גובה, ובלי `Prefs.defaultWallHeightMm`.
- **המלצה:** לקרוא מ-Prefs, ולאפשר עריכת-גובה מאוחרת (יש כבר עריכת-אורך/זווית ב-`CadDimensionEditor`, אך לא גובה).

### P2-9 · חוסר-עקביות `collectAsState` מול `collectAsStateWithLifecycle`
זרמי-BLE חיים נצרכים בשתי הדרכים: `collectAsStateWithLifecycle` (`MeasureCaptureScreen`, `ElevationScreen`, `WallShapeCapture`) לעומת `collectAsState` (`DevicesScreen`, `HomeScreen`, `numField` ב-`AppUi`). ל-StateFlow שתיהן עובדות, אך העדר-אחידות מקשה תחזוקה (ורלוונטי לבאג-הקפיאה שכבר נתקלתם בו).
- **המלצה:** לבחור אחת (מומלץ `collectAsStateWithLifecycle` לזרמים-חיים) ולהאחיד.

### P2-10 · `numField` מזריק מדידה לכל שדה-מספרי בפוקוס
`ui/AppUi.kt:122-145` — כל שדה בפוקוס (כולל "עומק", "רוחב", "מיקום") מקבל את מרחק-הלייזר. בשדה-עומק זה כמעט-תמיד שגוי (מרחק אורך ≠ עומק-בליטה).
- **המלצה:** להזרים אוטומטית רק בשדות-אורך/גובה רלוונטיים, או להוסיף כפתור-לכידה מפורש (כמו ב-`ElevationScreen.AccessoryDialog` — שם זה נעשה נכון).

### P2-11 · שכפול-קוד גאומטרי-מסך ב-5 עותקים
`fit()`/`toScreen`/`segHeading`/`outwardNormal`/`trimAngle`/`drawWorldGrid` משוכפלים כמעט-זהים ב-`MeasureCaptureScreen`, `LiveCadScreen`, `CadDimensionEditor`, `WallShapeCapture`, `RoomPlanCanvas`. תחזוקה שבירה (וכבר גרמה לבאג P1-1 של קונבנציית-הזווית).
- **המלצה:** לחלץ ל-מודול-עזר משותף (`ui/canvas/CanvasMath.kt`).

### P2-12 · `MeasureStatus`/`FieldNote`/`NoteRole` (catalog) — תשתית ללא-שימוש
`catalog/ElementCatalog.kt:99-118` מגדיר סטטוס-מדידה והערות-מתויגות (wishlist §6) שאין להם התמדה במודל ולא UI פעיל (`NoteFilterBar` לא-מחובר). פער בין המפרט למימוש.
- **המלצה:** לתעד כ"מתוכנן" או להסיר עד למימוש.

---

## מה נבדק ונמצא תקין
- **בטיחות-null בזרמי-DB:** כל ה-`repo.*().collectAsStateWithLifecycle(initial)` עם ברירות-מחדל; `wall?.let{}` בכל מקום; `readings.firstOrNull()`. אין `.first()` על רשימה-ריקה מסוכן.
- **Room off-main-thread:** כל ה-DAO suspend/Flow — אין גישת-DB ב-main-thread.
- **פענוח-BLE ב-`LaserBle`:** offsets ה-counter (Leica byte 18, Bosch byte 5) ותקינות-float (`isFinite`) נבדקים; dedup עובד.
- **`SolWriter` (ייצוא .sol הפעיל):** מסדרל רק שדות-גלם (`angleToNext_deg = w.angle`) בלי לפרש גאומטריה — ולכן **אינו** נפגע מבאג-הזווית P1-1. ה-FileProvider (`file_paths.xml` → `exports/`) והנתיב תואמים.
- **RTL/עברית:** `LocalLayoutDirection = Rtl`, `supportsRtl=true`, ציור-טקסט עברי דרך `nativeCanvas`/`Paint` — תקין. יחידות מ"מ עקביות בכל השכבות.
