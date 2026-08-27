# Soline — מערכת אחת, מקום אחד

> אוחד ב-2026-08-20 מ-9 תיקיות מפוזרות למבנה אחד נקי. **כל הידע והקוד כאן.**

**Soline** = מערכת מדידה→ייצור למטבחים/חדרים. מודד מודד בשטח *לפני האבן* → קובץ `.sol` → הממיר מפיק את כל הפורמטים לנגר/מפעל.

```
מדידה (app-measure)  →  .sol  →  converter  →  ORDX · PDP · DXF-2D · DXF-3D · PDF · HTML
```

## מבנה
| תיקייה | מה זה | טכנולוגיה |
|---|---|---|
| **`app-measure/`** | אפליקציית המדידה (הקנונית, פעילה) — לייזרים BLE, CAD, חזית, תלת-מימד, כותבת `.sol` | Android · Kotlin · Compose · Room |
| **`converter/`** | הממיר — `.sol`/ORDX → PDP · DXF · PDF · HTML. כל פיצוחי-הפורמט כאן | Node.js |
| **`dashboard/`** | מרכז-שליטה ניהולי | Web |
| **`ops/`** | תפעול (Capacitor) + **החוזה** `docs/INTERFACE.md` + מסמכי-רקע CVSM/X6/ORDX | Capacitor |
| **`social/`** | סוכן-שיווק + צנרת-תמונות | — |
| **`brand/`** | שפת-העיצוב — לוגו, אייקונים, **הרף ל-UX/UI** | — |
| **`docs/`** | מסמכי-על חוצי-רכיבים | — |
| **`_archive/`** | גרסאות ישנות/ריקות (לא למחוק) | — |

## הגשר: `.sol`
האפליקציה כותבת `.sol` (ZIP+JSON נייטיב, כולל `cabinets[]`) → הממיר קורא אותו (`converter/src/readSol.js`) → מפיק הכל. **שינוי-חוזה = לעדכן את שני הצדדים.**

## איפה הידע
- **פיצוחי-פורמט PDP** (native + DR): `converter/docs/` — `dr_item_record.md`, `pdp-native-format` וכו'.
- **אינטגרציית-אלמנטים** (app ↔ converter ↔ אינודרו): `converter/docs/element_integration_gap.md`.
- **רקע CVSM / X6 / ORDX / חומרים / מטבח-חוץ**: `ops/docs/`.
- **מסירת-האפליקציה** (מצב, החלטות, gotchas): `HANDOFF-measure.md`.
- **זיכרון מתמשך**: `~/.claude/.../memory/` (משותף לכל השיחות).

## בנייה — שים לב (app-measure)
אנדרואיד **לא בונה מתיקיית-Drive מסונכרנת**. עותק-בנייה על דיסק מקומי:
```
JAVA_HOME=C:\android-dev\jdk-17.0.20+8
C:\android-dev\gradle-8.9\bin\gradle assembleDebug   # ב-C:\android-dev\soline-measure
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
מקור-האמת כאן ב-Drive; העותק המקומי לבנייה בלבד.

## עבודה
שיחה אחת מובילה את הפרויקט המאוחד. הידע עובר דרך **קבצים** (קוד · docs · זיכרון · מסמכי-מסירה) — לא דרך צ'אט.
