# 🎛️ Soline — מגדל-הבקרה הראשי (Master Control)

> מקור-האמת של כל הפרויקט. קרא אותי קודם. עודכן: 2026-08-18 (עצירת-יום).
> סביבת-בנייה: `C:\android-dev` (מקומי, ניתן-לשחזור — ראה `BUILD_SETUP.md`) · טאבלט R5GL60ZDP5N (ADB) · **מקור-אמת ב-Drive**.

## לאן מכוונים
אקוסיסטם Soline סביב פורמט `.sol`: **מדידה (Soline Measure, אנדרואיד) → .sol → הממיר → ORDX+PDP+DXF2D+DXF3D+PDF+HTML → נגר/מפעל.** המשרד מזריק עבודות למודד. הבידול: מנוע-ההתאמה R1–R10 + שרשרת מקצה-לקצה בבעלותנו + המרה **מקומית** (בלי שרת-InnoDraw).

## ✅ מה עובד ומאומת (מקצה-לקצה)
- **אפליקציית soline** על הטאבלט: מותג, RTL, מסך-תמיד-דולק, מסך-בית מקצועי + הגדרות.
- **בלוטות':** Leica X6 (3D) · Bosch (2D) · **Leica D2 (קוד מוכן)** — חיבור-מתמשך, reconnect אוטומטי, הזרקת-מדידה-לשדה (קליטה-אחת-לפוקוס).
- **פרויקטים→חדרים→קירות→בליטות** (Room, offline). מסכי מדידה-חיה · 3D · עריכת-מידות · מצב-חזית · שרטוט-חי · בדיקת-התאמה (R4).
- **ייצוא לממיר** מהאפליקציה (.sol עם ORDX מוטמע) → **הומר בהצלחה ל-4 פורמטים** (`בדיקה.sol` נבדק).
- **פקודת-הממיר:** `node soline_convert.js <input> --out <dir>` → 4 פורמטים בפעם אחת.

## 📊 איכות-הפורמטים (משוב Michael + שיפורי-סוכנים)
| פורמט | לפני | אחרי-שיפור |
|---|---|---|
| ORDX | סביר | ✅ שוכלל — Class/Type מלא, אטריביוטים, Z |
| DXF-2D | נמוך מאוד | ✅ נכתב מחדש — תכנית-מדידה מקצועית (poché, מידות, סמלים, מקרא, title-block) |
| DXF-3D | לא בר-הגשה | ✅ שודרג — רצפה, חיבורי-פינות, אלמנטים על-הקיר, תוויות תוקנו |
| PDP | לא נכון | ◐ **פתוח** — צריך לולאת-אימות ב-Raumplan (הפעימה הבאה) |
| PDF+HTML | — | נבנו (PDF דרך Edge · HTML: סינון-קטגוריות+3D+כפתור-PDF) |

## 🔌 נבנה אך טרם מחובר לאפליקציה (Backlog — הפעימה הבאה)
כל הקבצים קיימים ועוברים קומפילציה, אך עדיין **בלי routes/כפתורים/DB**:
- ארונות (`data/CabinetModel.kt`, `ui/cabinet/CabinetScreen.kt`, `fit/CabinetFit.kt`) — צריך DB-migration + route
- טרילטרציה מ-Datum (`geometry/Trilateration.kt`, `ui/resize/DatumMeasureScreen.kt`)
- חיבור-קירות/סגירת-היקף (`geometry/WallCloseTools.kt`, `ui/close/CloseToolsBar.kt`)
- חזית-מאוחדת (`ui/elevation/WallElevationUnified.kt`) — מחליף את 2 מסכי-החזית הקיימים
- אימות-מדידה (`ui/verify/VerificationScreen.kt`) — שער-הגשה לפני ייצוא
- שרטוט-חצי-אוטומטי (`ui/semiauto/SemiAutoOutlineScreen.kt`)
- סרגל-כלים+undo/redo (`ui/cad/CadToolbar.kt`)
- פלואו נגר→פרויקט→גישה (`data/JobModel.kt`, `ui/intake/JobIntakeScreen.kt`) — צריך DB-migration
- הגדרות (`ui/settings/SettingsScreen.kt`, `data/Prefs.kt`) — מחובר חלקית (סאונד+גובה-ברירת-מחדל)

## 🧾 מסמכי-אפיון (Drive: soline-ops-app/docs/)
`INNODRAW_FEATURES.md` (ELC — רשימת-פונקציות מדורגת) · `CVSM_FEATURES.md` · `CVSM_EXPORT_CRACK.md` · `CONVERTER_BRIDGE.md` · `ELEMENT_CATALOG_MERGED.md` · `NEW_PROJECT_FLOW.md` · `PDF_REPORT_SPEC.md` · `APP_REVIEW.md` (P0=3/P1=6/P2=12) · `DISTO_PROTOCOL.md` (X6+Bosch+D2) · `MICHAEL_WISHLIST.md` · `ROADMAP_TIMELINE.html` · `build/` (99 החלטות).

## ⏭️ להמשיך מחר (2026-08-19) — לפי סדר
1. **אימות רצפה/תקרה:** Michael צריך לאשר שהמספר במסך = מסך-הלייקה (המסך פושט — מציג את ערך-הלייקה כמו-שהוא, בלי חישוב שלנו). אם לא תואם — לקבל זוג-מספרים ולתקן איזה שדה בפריים קוראים.
2. **גל-CVSM (Michael בחר את כל ה-4 — לשגר):** (א) ליבת-CAD 5.6 = DimTierEngine + CadSymbol · (ב) קירות-אמיתיים = HeightBands + סוגי-ראש-קיר + אשף-תבניות L/U/T/Z · (ג) חזית-מלאה · (ד) סריקה/מדידה-מתקדמת Leica. מקור: `CVSM_FEATURES.md §18`.
3. **לבדוק תוצאות 2 סוכני-הממיר** שרצו בלילה (נשמרו ל-Drive): DXF-כל-האלמנטים + HTML-תצוגה-חיה.
4. עדיין מושהה לבקשת Michael: **PDP** (סעיף-1) · תבניות-פרויקט · שרשראות-מידה נוספות.

## מה נעשה בסשן 2026-08-18/19 (הושלם)
- כל הפיצ'רים חוברו (ארונות/פתיחת-עבודה/semiauto/Datum/אימות/חזית-מאוחדת/CAD-toolbar+undo/סגירת-היקף) · **מדידת רצפה/תקרה** · **מצב-immersive** (הסתרת סרגל-ניווט) · **גיבוי-ל-Drive** · DB v3 · תיקוני APP_REVIEW P0/P1 · באג-הזווית.
- ממיר: `element_catalog.js` מאומת-קורפוס (247/247) · DXF-3D רצפה-אמיתית · CLI ל-6 פורמטים · watch-folder · לוגו-מדויק ב-HTML.
- מחקר: CVSM 5.6 + InnoDraw פוענחו + 2 אימותי-קורפוס (ארונות=Base/Standard, לא Assembly).

## מגבלת-אוטונומיה
בניית-APK ובדיקה-על-הטאבלט דורשות את מחשב Michael דלוק. כשכבוי — עוצר; הכל מתועד וממשיך מיד.

## שמירה
מקור מלא ב-`soline-measure-android/` (45 קבצי-קוד). בנייה מקומית `C:\android-dev\soline-measure`. `BUILD_SETUP.md` = שחזור-toolchain. פלטי-בדיקה ליד `G:\My Drive\בדיקה.sol`.
