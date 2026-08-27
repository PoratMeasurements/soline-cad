# שחזור סביבת-הבנייה (אם C: קורס / מכונה חדשה)

> **כל קוד-המקור נמצא כאן ב-Drive.** ה-toolchain הוא תוכנה חינמית שמורידים מחדש. אין תלות אמיתית ב-C: —
> הוא רק דיסק-בנייה מקומי זמני (כי אי-אפשר לבנות אנדרואיד מתוך Google Drive — הסנכרון נשבר).
> מתוך המקור כאן + המדריך הזה, משחזרים הכל תוך ~15 דקות.

## מה צריך (הכל חינמי, הורדה מחדש)
1. **JDK 17** (Temurin): הורד `https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse` → חלץ ל-`<DEV>/jdk-17`.
2. **Android cmdline-tools**: `https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip` → חלץ ל-`<DEV>/sdk/cmdline-tools/latest`.
3. **חבילות SDK**: `sdkmanager --sdk_root=<DEV>/sdk "platform-tools" "platforms;android-35" "build-tools;35.0.0"` (+ `--licenses`).
4. **Gradle 8.9**: `https://services.gradle.org/distributions/gradle-8.9-bin.zip` → חלץ ל-`<DEV>/gradle-8.9`.
   `<DEV>` = תיקיית-בנייה מקומית כלשהי (למשל `C:\android-dev`) — **לא ב-Drive**.

## בנייה
```bash
export JAVA_HOME="<DEV>/jdk-17"; export ANDROID_HOME="<DEV>/sdk"
# העתק את המקור מ-Drive לתיקיית-בנייה מקומית (build/.gradle לא ב-Drive)
cp -r "G:/My Drive/claude/Soline/app-measure/"* "<DEV>/soline-measure/"  # (או robocopy — ראה למטה)
cd "<DEV>/soline-measure"
printf 'sdk.dir=<DEV>/sdk\n' > local.properties
"<DEV>/gradle-8.9/bin/gradle.bat" assembleDebug --no-daemon
# התקנה על הטאבלט
"<DEV>/sdk/platform-tools/adb.exe" install -r app/build/outputs/apk/debug/app-debug.apk
```

## סנכרון-מקור לתיקיית-הבנייה (⚠️ שמור על local.properties)
`local.properties` חי **רק** בעותק-הבנייה המקומי (`<DEV>/soline-measure`), לא ב-Drive.
לכן `robocopy /MIR` פשוט **מוחק** אותו (mirror-delete על קובץ שאין-לו-מקור). תמיד סנכרן עם
`/XF` שמחריג אותו + את `desktop.ini` (קובץ-Drive שאסור לזלוג פנימה):
```powershell
robocopy "G:\My Drive\claude\Soline\app-measure" "<DEV>\soline-measure" `
  /MIR /XF local.properties desktop.ini /XD build .gradle .idea
```
אם נמחק בכל-זאת — שחזר: `printf 'sdk.dir=<DEV>/sdk\n' > local.properties` (נתיב-SDK בפועל: `C:/android-dev/sdk`).

## אייקון (מהלוגו)
הלוגו: `G:/My Drive/claude/brand/soline-logo.png`. ליצירת מיפמאפים: `tools_Resize.java` (בתיקייה זו) — `javac`, ואז `java Resize <logo.png> app/src/main/res`.

## גרסאות שעובדות
AGP 8.6.0 · Kotlin 2.0.21 (+ compose-plugin 2.0.21) · Compose BOM 2024.09.03 · KSP 2.0.21-1.0.28 · Room 2.6.1 · compileSdk/target 35 · minSdk 26 · JVM 17.

## עיקרון-הגיבוי
- **מקור-אמת = Drive** (התיקייה הזו). כל שינוי ממורא לכאן.
- **C: = דיסק-בנייה זמני** (toolchain + build/‏.gradle) — ניתן-לשחזור, אף פעם לא מקור-אמת.
- אם C: קורס: הורד toolchain (למעלה) → העתק מקור מ-Drive → בנה. שום עבודה לא אובדת.
