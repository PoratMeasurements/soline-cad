# Soline Measure — אפליקציית-המדידה (Android/Kotlin/Compose)

> נקודת-הפתיחה של תוכנת-המדידה של Soline. נבנתה מ-0 כ**reimplement** (החלטה #1) — קוד משלנו,
> חבילה משלנו (`il.co.soline.measure`), לא הקוד של הספק. v0.1 — 2026-08-17.

## מה יש כאן (v0.1)
- אפליקציית **Jetpack Compose** single-activity (החלטה #3), נבנית ומותקנת ורצה על הטאבלט האמיתי.
- **מנוע-ההתאמה** (`app/src/main/kotlin/il/co/soline/measure/fit/FitEngine.kt`) — הבידול (#11):
  לוגיקה טהורה שמניחה תכנון-נגר (שכבה A) על מדידה בשטח (שכבה B) ומריצה את חוקי R1–R10.
  **מיושם: R4 (בליטה מול עומק)** — הכאב מס' 1 בנגרות (#13). שאר החוקים — stubs מתועדים.
- מסך-בית (`MainActivity.kt`) שמריץ את R4 על תרחיש ריאליסטי ומציג את הממצאים בעברית RTL.

## איך בונים (למהנדס)
דרוש: **JDK 17** + **Android SDK** (platform android-35, build-tools 35). על מכונת-הפיתוח הנוכחית
הכל מותקן תחת `C:\android-dev\` (JDK, SDK, Gradle 8.9).

```bash
# מגדירים סביבה
export JAVA_HOME=".../jdk-17"
export ANDROID_HOME=".../android-sdk"
# בונים
gradle assembleDebug          # או ./gradlew לאחר יצירת wrapper
# מתקינים על מכשיר מחובר (adb)
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n il.co.soline.measure/.MainActivity
```
> `local.properties` (עם `sdk.dir=...`) הוא מקומי-למכונה ולא נכלל כאן — צור אחד עם נתיב ה-SDK שלך.

## ארכיטקטורה (לפי ההכרעות)
- **Kotlin/Compose/single-activity** (#1, #3) · offline-first · minSdk 26 / target 35.
- **מנוע-ההתאמה כרכיב טהור** (#2, #11) — כרגע בתוך `il.co.soline.measure.fit`; יופרד למודול
  `core:fit-engine` (בלי תלות-אנדרואיד) כדי שישותף עם תוכנת-העיצוב.

## הבא (H1)
מדרגה זו מוכיחה את הצינור end-to-end (build→install→run→לוגיקת-הבידול). הבא: מודל-נתונים מלא
(קיר-כפרופיל + בליטה-כשדה, #12), חיבור מד-הלייזר (BLE — הפרוטוקולים כבר פוענחו ב-`DISTO_PROTOCOL.md`),
Room, ומסכי-המדידה. ראה `soline-ops-app/docs/build/` ו-`ROADMAP_TIMELINE.html`.
