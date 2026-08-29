# ROTATION_AUDIT — אובדן-נתונים ואיפוס-מסכים בסיבוב-המכשיר

**סטטוס:** ביקורת בלבד (READ-ONLY). לא נערך אף קובץ-מקור. המסמך מפרט את הגורם-השורשי ואת התיקון המדויק.
**שורש-הפרויקט הקנוני:** `D:\Soline\app-measure`
**תלונת-הבעלים:** "כשאני מסובב את המסך פתאום נתונים נמחקים והמסכים מתאפסים."

---

## 1. פסק-דין: הגורם-השורשי

**כן — `android:configChanges` חסר על ה-Activity.** זה הגורם-השורשי הישיר.

בקובץ `D:\Soline\app-measure\app\src\main\AndroidManifest.xml`, שורות 49-56, הכרזת ה-Activity היא:

```xml
<activity
    android:name=".MainActivity"
    android:exported="true">
    <intent-filter> ... </intent-filter>
</activity>
```

אין שם `android:configChanges` כלל (אומת גם ב-grep — 0 תוצאות בקובץ כולו).

**המשמעות:** כל סיבוב-מסך = שינוי-קונפיגורציה (`orientation`+`screenSize`+`screenLayout`). כשה-Activity לא מכריזה שהיא מטפלת בשינויים האלה בעצמה, מערכת-אנדרואיד **הורסת ובונה-מחדש את ה-Activity** (`onDestroy`→`onCreate`). `MainActivity` (extends `ComponentActivity`, קובץ `MainActivity.kt`) בונה-מחדש את כל עץ-ה-Compose דרך `setContent { SolineRoot() }`. כל state שמוחזק ב-`remember { }` פשוט (לא `rememberSaveable`) **אובד** ומאותחל לערך-ההתחלתי → זה ה"נתונים נמחקים". כל מסך שה-state שלו ב-`remember` פשוט **מתאפס** → זה ה"מסכים מתאפסים".

### הבהרה על ה"איפוס-מסכים"
הניווט בנוי על Navigation-Compose (`rememberNavController` + `NavHost`, `AppUi.kt` שורות 122-134). ה-back-stack של ה-NavController נשמר פנימית דרך `rememberSaveable`, ולכן **היעד-הנוכחי (route) כן שורד** את הבנייה-מחדש. מה שמתאפס בפועל הוא ה-state הפנימי של המסך-הפעיל: כל ה-`remember { mutableStateOf(...) }` חוזר לברירת-המחדל, וכל דיאלוג-פתוח נסגר (כי דגל-הפתיחה שלו ב-`remember` פשוט). למשתמש-בשטח זה נראה כאיפוס-מסך מלא.

### הבחנה קריטית: מה שורד ומה אובד
- **שורד** — כל מה שכבר נכתב ל-Room DB. הנתונים חוזרים דרך ה-repo/Flow (`collectAsState`) אחרי הבנייה-מחדש. קירות שכבר נשמרו, חדרים, פרויקטים — לא אובדים.
- **אובד** — רק **עבודה-בתהליך שעדיין-לא-הותמדה**: לכידה שבאמצע, נקודות-מסגרת לפני-"סיום", טקסט שהוקלד בדיאלוג פתוח, מחסנית-Redo. **זהו הבאג.**

---

## 2. שתי אסטרטגיות-תיקון + המלצה

### אסטרטגיה A (מומלצת — התיקון-המיידי): הוספת `android:configChanges` ל-Activity
שינוי של **שורה אחת** ב-Manifest. עוצר לחלוטין את הבנייה-מחדש בסיבוב — ה-Activity נשארת חיה, עץ-ה-Compose לא נבנה-מחדש, ו**כל** state (כולל `remember` פשוט) שורד אוטומטית. זה הפתרון הבטוח-ביותר לאפליקציית-מדידה-בשטח שאסור-לה-לעולם לאבד עבודה-בתהליך בגלל סיבוב אקראי של הטאבלט.

התיקון המדויק — הוסף את השורה להכרזת ה-Activity ב-`AndroidManifest.xml` (בין שורה 50 ל-51):

```xml
<activity
    android:name=".MainActivity"
    android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden"
    android:exported="true">
```

(המשימה ביקשה `orientation|screenSize|screenLayout|keyboardHidden`; הוספתי גם `smallestScreenSize` שמומלץ לכיסוי מסכים-מתקפלים/מרובי-חלונות. אפשר להוסיף גם `uiMode` אם רוצים למנוע בנייה-מחדש גם במעבר מצב-כהה/בהיר.)

### אסטרטגיה B (נכונה יותר, גרנולרית, אך הרבה עריכות): המרת `remember` ל-`rememberSaveable`
לעבור מסך-מסך ולהמיר את ה-state-הטרנזיינטי מ-`remember` ל-`rememberSaveable`. `rememberSaveable` נשמר ב-`savedInstanceState` וכן שורד בנייה-מחדש. חלק מהמסכים כבר עברו את ההקשחה הזו (ראה טבלה למטה). החיסרון: לטיפוסים מורכבים (רשימות של data-classes כמו `WallBuilder.Pt`, `FramePt`) צריך `Saver` מותאם לכל אחד — זה עשרות עריכות עדינות ומועדות-לשגיאות, ולא מכסה state שנשכח.

### המלצה
**לבצע את A מיד** — שורה-אחת שמרפאת את כל הבאג בבת-אחת, כולל מסכים שעדיין לא הוקשחו. **בנוסף**, מומלץ להקשיח את המוקדים-המסוכנים-ביותר שעדיין ב-`remember` פשוט (בראש-הרשימה `SemiAutoOutlineScreen` ו-`RoomTemplateWizard`) כרשת-ביטחון שנייה — כך אם אי-פעם תוסר הכרזת-ה-configChanges או תיווסף Activity חדשה, הנתונים עדיין ישרדו. A מנצח כתיקון-מיידי; B הוא הקשחה-בעומק שנעשית בהדרגה.

---

## 3. טבלת-סיכון מדורגת (מסכים/דיאלוגים)

הדירוג לפי חומרת-הנזק בסיבוב (בהנחה שלא הוחל A). "Room-backed" = הנתונים העיקריים כבר-מותמדים ולכן שורדים; הסיכון הוא רק ל-state-הטרנזיינטי המצוין.

| # | מסך / קובץ:שורה | מה אובד בסיבוב | מצב-נוכחי | תיקון |
|---|---|---|---|---|
| 1 🔴 | **SemiAutoOutlineScreen** `ui/semiauto/SemiAutoOutlineScreen.kt:146-167` | **הכל.** `corners`, `walls`, `measured`, `committed`, `stations`, `phase`, `heightMm`, `pendingMm` — סקר-אוטומטי שלם המוחזק **כולו בזיכרון** עד ה-commit. אין גיבוי-Room עד הסיום → אובדן-מלא. | `remember` פשוט על **כל** ה-state. לא-מוקשח. | A מרפא מיד. הקשחה: `rememberSaveable` + Saver ל-`corners`/`walls`/`committed`. **המסוכן ביותר.** |
| 2 🔴 | **RoomTemplateWizard** `ui/template/RoomTemplateWizard.kt:125-130` | בחירת-תבנית + **כל המידות שהוקלדו** למפת `values` (mutableStateMapOf). מתאפס ל-RECTANGLE ריק. | `remember` פשוט. לא-מוקשח. | A מרפא מיד. הקשחה: `rememberSaveable` (map→CSV Saver). |
| 3 🟠 | **דיאלוגי AppUi** `ui/AppUi.kt` — הוסף-פרויקט (305, שם/לקוח 325-326), הוסף-חדר (343, שם 464), הוסף-קיר (479, אורך/גובה 598-599) | דגל-הפתיחה (`showAdd`) ב-`remember` → הדיאלוג **נסגר** בסיבוב, וכל הטקסט שהוקלד בשדות אובד. | `remember` פשוט. חלק מהדיאלוגים כבר-מוקשחים (למשל 774-777, 894-989 עם Saver). | A מרפא מיד. סיכון-נמוך-להקלדה-חוזרת אך מעצבן. |
| 4 🟠 | **LiveCadScreen** `ui/draw/LiveCadScreen.kt:132-145` | מחסנית-Redo (`redoStack`), דיאלוג-פעיל (`dialog` — קלט באמצע-עריכת-מידה/קשת אובד), toggles של תצוגה, pan/zoom. | הקירות עצמם **Room-backed** (param `walls`, מותמד דרך `onAddWall`) → שורדים. רק טרנזיינט אובד. | A מרפא מיד. הנתונים-העיקריים ממילא בטוחים. |
| 5 🟡 | **P2PMeasureScreen** `ui/p2p/P2PMeasureScreen.kt` | קלט-ידני `manDist`/`manAz` (128-129) ודיאלוגי-אישור (137-143) ב-`remember`. | **מוקשח בעיקר** — `phase`, `corners` (Saver), `heightText` ב-`rememberSaveable` (113-125). הליבה שורדת. | A מרפא-שאר. סיכון-שיורי-נמוך. |
| 6 🟡 | **WallElevationUnified** `ui/elevation/WallElevationUnified.kt:300-341` | `stepMm`, ערכי-pending, מצבי-דיאלוג `editing`/`adding`/`markerDialog`. | **מוקשח בעיקר** — `frame` (Saver, מפתוח לפי wall.id), `zeroH/V`, `dir`, `selected`, `horizMm` ב-`rememberSaveable` (266-299). המסגרת שורדת. | A מרפא-שאר. סיכון-שיורי-נמוך. |
| 7 🟢 | **MeasureCaptureScreen** `ui/measure/MeasureCaptureScreen.kt:131-147` | — | **מוקשח** — pan/zoom, מצב-זווית, `pendingLenMm`, `lastTs` ב-`rememberSaveable`. | A למניעת בנייה-מחדש מיותרת. אין אובדן-נתונים ידוע. |
| 8 🟢 | **WallShapeCapture** `ui/shape/WallShapeCapture.kt:134-157` | — | **מוקשח** — `points` (stateSaver), `mode`, `flip`, `bearingDeg`, `selectedIdx` ב-`rememberSaveable`. | A למניעת בנייה-מחדש. אין אובדן ידוע. |
| 9 🟢 | **LevelSurveyScreen** `ui/level/LevelSurveyScreen.kt:78-83` | רק `flash`, `armMode`, `armedFrom` (טרנזיינט-רגעי). | קריאות-המפלס Room-backed (`collectAsState`). ה-state ב-`remember` הוא רגעי-בלבד. | סיכון-נמוך. A מספיק. |
| 10 🟢 | **RoomPlanCanvas** `ui/canvas/RoomPlanCanvas.kt:77-80` | רק toggles של תצוגה (`showDims`/`showAngles`/...). | נתוני-התוכנית מגיעים מ-params (Room-backed). | סיכון-מזערי — רק איפוס-תצוגה. |

**מקרא:** 🔴 אובדן-נתונים-מלא · 🟠 אובדן-קלט-בתהליך · 🟡 מוקשח-חלקית, סיכון-שיורי · 🟢 בטוח/מזערי.

---

## 4. האם ל-`android:configChanges` יש חיסרון עבור האפליקציה הזו?

**לא, אין חיסרון מעשי.** האפליקציה היא Compose-only (אין `res/layout` XML שצריך טעינה-מחדש בסיבוב). ב-Compose, `LocalConfiguration` מתעדכן בשינוי-קונפיגורציה גם ללא בנייה-מחדש, וכל layout שמסתמך על גודל/כיוון פשוט מבצע recomposition רספונסיבי. לא נדרשת טעינה-מחדש של resource-qualifiers.

נקודות שנבדקו ואין בהן בעיה:
- `keepScreenOn` ו-`hideNavBar()` נקבעים ב-`onCreate` (`MainActivity.kt:18-21`). ללא בנייה-מחדש הם נשארים פעילים ממילא — אין רגרסיה. (`onWindowFocusChanged` ממשיך לתחזק את הסתרת-סרגל-הניווט.)
- ה-BLE, שירות-המיקום וה-repo אינם קשורים לסיבוב.
- החיסרון היחיד-התאורטי של `configChanges` — שקוד שמסתמך על בנייה-מחדש כדי לטעון-מחדש resources לא ירוץ — **אינו רלוונטי** כאן, כי אין XML-resources תלויי-כיוון, וכי לוקאל/מצב-כהה הם דגלי-קונפיגורציה נפרדים שלא כללנו.

**מסקנה:** אסטרטגיה A היא רשת-ביטחון נטו — כל היתרונות, אפס-חסרונות ידועים לאפליקציה הזו.
