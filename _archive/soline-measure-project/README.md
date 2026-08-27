# Soline Measure — פרויקט אנדרואיד

אפליקציית מדידה offline-first (Kotlin + Jetpack Compose + Room) שמתחברת למדי-לייזר בבלוטות'
(Leica DISTO X6 / D2, Bosch GLM) ומפיקה קובץ `.sol` לממיר של Soline.

- **Package:** `il.co.soline.measure`
- **minSdk 26 · targetSdk 35 · Kotlin + Compose (Material3) · Room · KSP**
- **49 קבצי Kotlin · ~13,700 שורות**

## איך לפתוח

### Android Studio (מומלץ — זה ה-IDE הנכון לאנדרואיד)
1. `File → Open` ובחר את תיקיית-הפרויקט הזו (זו שמכילה את `settings.gradle.kts`).
2. Android Studio יזהה את ה-Gradle wrapper (8.9) וירכיב את הפרויקט. אם יבקש נתיב-SDK — הוא יזוהה אוטומטית (או הצבע על ה-Android SDK במחשב).
3. הרץ על אמולטור או מכשיר מחובר (▶).

### VS Code
מתאים לצפייה ועריכה של הקוד (התקן את התוסף **Kotlin**). לבנייה בפועל צריך Android SDK + JDK 17 —
נוח יותר לבנות מהטרמינל: `./gradlew assembleDebug` (או `gradlew.bat` ב-Windows).

## בנייה מהטרמינל
```
./gradlew assembleDebug          # מפיק app/build/outputs/apk/debug/app-debug.apk
```
דורש **JDK 17** ו-**Android SDK (platform-35, build-tools 35)**. ה-wrapper מוריד את Gradle 8.9 לבד.

> הערה: לא נכלל `local.properties` (הוא מכיל נתיב-SDK מקומי). ה-IDE ייצר אותו אוטומטית,
> או צור ידנית: `sdk.dir=C:\\Path\\To\\Android\\Sdk`.

## מבנה
```
app/src/main/
  kotlin/il/co/soline/measure/   ← כל הקוד (data, device, geometry, ui, export, fit)
  res/                           ← אייקונים (הלוגו של Soline), ערכי-נושא
  AndroidManifest.xml
```
המדריך המלא למבנה-הקוד נמצא בדף-הקוד שנבנה בנפרד, ובמסמכי-הפרויקט תחת `claude/soline-measure-android/`.
