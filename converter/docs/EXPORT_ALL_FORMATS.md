# ייצוא כל-4-הפורמטים בפקודה אחת — EXPORT_ALL_FORMATS

עודכן: 2026-08-17. פנייה בלשון זכר.

פקודה **אחת** לוקחת קלט **אחד** (ORDX או `.sol`) ומייצרת את **כל 4 הפורמטים** לתיקיית-פלט אחת:

```
node soline_convert.js <input> --out <dir>
```

- `<input>` = קובץ **ORDX** או קונטיינר **`.sol`** (מקור-האמת של Soline).
- `--out <dir>` (או `-o`, או `--out=<dir>`) = תיקיית-הפלט. ברירת-מחדל: `analysis/out/`.
  (נתמך גם ארגומנט-מיקום שני לתאימות-אחורה: `node soline_convert.js <input> <dir>`.)

## הפלט — 4 קבצים

| קובץ | פורמט | מקור |
|---|---|---|
| `<name>.ordx` | ORDX (XML של InnoDraw) — re-export מועשר | `src/export_ordx.js` |
| `<name>.pdp` | PDP native (Raumplan) — הזרקת אביזרים לבסיס golden | `src/assemble.js`+`inject.js` |
| `<name>_2d.dxf` | DXF-2D — תכנית: קירות, סמלים, מקרא עברי | `src/export_dxf_pro.js` |
| `<name>_3d.dxf` | DXF-3D — תיבות W×D×H לכל אלמנט + קירות + תוויות עברית | `src/export_dxf_pro.js` |

> אם `<name>.ordx` יפגע בקובץ-הקלט (אותו נתיב מדויק), הממיר כותב `<name>_out.ordx` במקום — לעולם לא דורס את המקור.

**עמידוּת:** כל פורמט מיוצר ב-`try/catch` נפרד — כשל בפורמט אחד (למשל PDP בלי בסיס-golden) **לא** מפיל את שלושת האחרים. בסוף מודפס סיכום פר-פורמט + אזהרות. חוסמים ידועים מוצפים כאזהרה, לא ככשל.

## קלט `.sol` (קורא חדש — `src/readSol.js`)

`.sol` הוא ZIP (manifest.json + meta.json + measured/room-*.json, ראה `SolWriter.kt`). הקורא מפענח את ה-ZIP עצמאית (zlib מובנה, בלי תלות חיצונית) ובוחר מסלול:

1. **מסלול מועדף — ORDX מוטמע:** אם קיים `measured/source.ordx`, הממיר מריץ עליו את פרסר-ה-ORDX המאומת (נאמנות מלאה). `source = sol:embedded-ordx`.
2. **מסלול נייטיב — room-json:** אחרת, בונה את מודל-האובייקט ישירות מ-`measured/room-*.json`. **גאומטריה best-effort:** לקירות ב-`.sol` יש `length_mm`+`angleToNext_deg` (בלי קואורדינטות מוחלטות), אז הפריסה נעשית ב-turtle (התחלה (0,0), כיוון +X, פנייה לפי הזווית בכל פינה). מיפוי-סוגים: `SOCKET_SINGLE→Socket`, `SOCKET_MULTI→Duplex Socket`, `WATER_PIPE→Water Supply`, `GAS_PIPE→Gas`, `ELECTRICAL_LINE→Power Line`, `WINDOW→Window`, `DOOR→Doorway w/o Frame`, `COLUMN/CEILING_DROP→Beam`. `source = sol:room-json`.

## אמינות כל פורמט (נכון ל-2026-08-17)

| פורמט | מצב | הערה |
|---|---|---|
| **ORDX** | ✅ **מלא** | round-trip מאומת (parse→export→parse זהה בסיכום). |
| **DXF-2D** | ✅ **מלא** | מבנה DXF תקין, ASCII נקי, עברית ב-`\U+`, מקרא. נפתח ב-CAD. |
| **DXF-3D** | ✅ **מלא** | כל אלמנט = תיבת W×D×H (`3DFACE`) על שכבה לפי קטגוריה + תווית עברית. |
| **PDP** | ◐ **חלקי** | הזרקת שקעים/אביזרים צמודי-קיר לבסיס golden — **מבנה נבדק אוטומטית** (count/stride/גודל) אך **טעון בדיקת-טעינה ידנית ב-Raumplan**. מיקום מדויק גאומטרית רק לקובץ 2918 (offX/offY שלו); אחרים = מבנה תקין, מיקום להמחשה. חוסמים פתוחים: סמל-2D מיוצר (168B מוצבע), 3D=QUADER פרמטרי, מחיקת-אלמנט. |

**מגבלות `.sol` ידועות:** קטלוג-הארונות (`design/cabinets.json`) עדיין `present:false` ב-`.sol` v1 — אין ישות ארון להעשיר איתה את ה-ORDX. שכבת `status`/`fit` טרם נצרכות. במסלול room-json הגאומטריה היא best-effort (turtle); המסלול המדויק הוא `.sol` עם `measured/source.ordx` מוטמע.

## דוגמאות

```bash
# ORDX -> 4 פורמטים
node soline_convert.js docs/samples/measure_export_ALL_elements.ordx --out out/

# .sol -> 4 פורמטים (מזהה אוטומטית מסלול embedded/room-json)
node soline_convert.js job-1234/project.sol --out job-1234/out/

# batch על כל הקורפוס + דוח-אימות עצמי
node soline_convert.js --all
```

## אימות שבוצע
- `measure_export_ALL_elements.ordx` → 4 קבצים: ORDX round-trip ✓, PDP מבנה ✓, DXF-2D ✓ (12 INSERT/68 LINE), DXF-3D ✓ (114 3DFACE).
- `.sol` נייטיב (room-json, 4 קירות/5 אביזרים) → 4 קבצים; PDP הזריק 2 שקעים (מיפוי-סוגים עובד).
- `.sol` עם ORDX מוטמע → זהה למסלול ORDX הישיר.
- `node soline_convert.js --all` — כל הקורפוס (6 קבצים) ✓; `src/export_dxf_pro.js` selfTest = PASS.
