# Soline — מצב הפרויקט (2026-08-14)

מסמך-מצב מרוכז ומעודכן. מקור-האמת המהיר. (הפירוט הטכני העמוק ב-`STATUS.md`.)

## מה זה Soline
תוכנה עצמאית שמקבלת קובץ מדידה **ORDX** (מ-InnoDraw) ומייצרת אוטומטית את **כל הפורמטים** — DXF 2D, DXF 3D, ORDX, PDP — עם **ספריית אלמנטים וסמלים משלנו** (לא InnoDraw, לא ELC_SND). חזון: אפליקציית-טאבלט — מעלים ORDX, מקבלים הכל.

## סטטוס פורמטים
| פורמט | מצב | הערה |
|---|---|---|
| **DXF 2D** | ✅ **רמת-ייחוС** | מנוע-מימוד (5 ישויות/מידה), קירות-poché, בלוקים, מקרא עברי, שכבות סמנטיות. מחווט ל-`soline_convert.js`, מאומת על 6/6 קבצים |
| **DXF 3D** | ✅ **רמת-ייחוС** | שכבות Const_Walls/_Ext/Windows/Electrical/Plumbing, BLOCK/INSERT, 3DFACE (~186; ייחוС 319 — משתפרים) |
| **ORDX** | ✅ round-trip מאומת | קריאה→כתיבה זהה |
| **PDP** | ◐ חלקי, **מוקפא** | שקעים נטענים ב-Raumplan; מוגבל 14-קווים/סמל; שאר הסוגים חסומים (921). ממתין לבדיקות-טעינה של Michael |

## ליבה
- **`soline_convert.js`** — ממיר מאוחד: `node soline_convert.js <in.ordx>` → 4 פורמטים. `--all` → כל הקורפוС + `VERIFICATION_REPORT.md`.
- **`src/export_dxf_pro.js`** — מייצא DXF 2D+3D ברמת-ייחוС (משתפר עכשiv).
- **`src/`** — parseOrdx, placement, export_ordx, inject, symbol, assemble.
- **`app/soline_app.html`** — אפליקציית-web (מעלה ORDX→תצוגה+הורדת DXF). *כרגע DXF בסיסי — פורט של המייצא ה-Pro לדפדפן = צעד הבא.*
- **ספרייה**: `elements.json` (170 אלמנטים, כולל אלמנטי-קיר), `symbols.json` (170 סמלים, תקן IEC, מנורמלים [1000,1000]).

## מסמכי-ידע (מחקר סוכנים)
| מסמך | תוכן |
|---|---|
| `VERIFICATION_REPORT.md` | אימות הממיר על כל הקורפוС |
| `DXF_REFERENCE_STUDY.md` | פורמט DXF 3D מקצועי (מטריו) |
| `DXF_2D_METHOD.md` | שיטת DXF 2D + מנוע-מימוד + קורלציה ORDX↔DXF |
| `field_reconciliation.md` | תהליך התאמת מודד לשטח (DR1→DR2→חתום) |
| `kitchen_layout_fitting.md` | העמדת מטבח + 11 בעיות-התאמת-נגרות + 10 חוקי-בדיקה |
| `library_requirements.md` + `pdf_notes_corpus.md` | ידע מ-1,882 PDF של לקוחות |
| `SECURITY_REVIEW.md` | סקירת אבטחה+פרטיות |
| `QA_REPORT.md` | QA + תיקוני-באגים |
| `COLLABORATION.md` | חיבור צוות/CEO |

## הצעדים הבאים
1. סגירת פערי DXF (עדינות 3DFACE, מידות-מיקום-אביזר, בלוקי-2D) — **בעבודה**.
2. פורט מייצא ה-Pro לאפליקציה (טאבלט → DXF מקצועי).
3. PDP — RE עמוק + בדיקות-טעינה עם Michael (מוקפא עד שפנוי).
4. מנוע חוקי-בדיקה להתאמת-נגרות (`kitchen_layout_fitting.md` R1–R10) — שלב עתידי.
