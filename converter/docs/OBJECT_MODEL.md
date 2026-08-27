# מודל האובייקט של Soline — חוזה משותף למייצאים

Soline הוא **מחולל אובייקטים אוניברסלי**: מגדירים אובייקט פעם אחת, ומייצאים לכל פורמט (PDP / DXF 2D / DXF 3D / ORDX). מסמך זה הוא **החוזה** שכל מייצא בונה מולו. אל תסטה ממנו.

## האובייקט הקנוני
```
Object = {
  en, he, category,                    // זהות (מ-elements.json)
  dimensions_mm: { W, D, H },          // הגודל האמיתי — המשתמש יכול לשנות! לא קבוע.
  mount_height_mm,                     // גובה התקנה מהרצפה
  symbol2d: { frame:[1000,1000], polylines:[[[x,y],...],...] },  // מ-symbols.json
  metadata: { status_default, measure_ref, connection_spec, timing, ... }
}
```
- **מקורות**: `elements.json` (זהות/מידות/מטא) + `symbols.json` (הסמל). מפתח-חיבור = `en`.

## ⚠️ חוזה הסקאלה (הכי חשוב)
**הסמל מנורמל ובלתי-תלוי-גודל.** `symbol2d.frame` תמיד `[1000,1000]` וכל הקואורדינטות בטווח 0..1000.
כדי לרנדר/לייצא אובייקט בגודל בפועל `(W,H)` מ"מ:
```
scaledX = symbolX * (W / 1000)
scaledY = symbolY * (H / 1000)
```
כך הסמל **והאובייקט מקבלים כל גודל וגדלים יחד**, ונראים נכון בכל תוכנה. אף מייצא לא מניח גודל קבוע — תמיד קורא את `dimensions_mm` ומקנה-מידה את הסמל המנורמל.

## גאומטריית 3D
נגזרת מ-`dimensions_mm`: תיבה `W×D×H` כברירת מחדל (מרכז על נקודת ההצבה, הבליטה `D` יוצאת מהקיר). בעתיד פרימיטיבים per-type; לעת עתה — תיבה.

## הצבה (placement) — פרמטרים אחידים לכל מייצא
```
Placement = { x, y, z, rotation_deg, wall_id? }
```
- `x,y` = נקודת מרכז ההצבה בתכנית (מ"מ). `rotation_deg` = סיבוב הסמל/האובייקט (זווית הקיר).
- `z` = `mount_height_mm`.

## המייצאים (קובץ נפרד לכל אחד ב-`src/`)
| מייצא | קלט | פלט | הערה |
|---|---|---|---|
| PDP | object+placement | 7 בלוקים בינאריים | הכי קשה (RE); בבעלות ה-main |
| DXF 2D | object+placement | ישויות LINE/LWPOLYLINE | פתוח/קל |
| DXF 3D | object+placement | 3DFACE/mesh מהתיבה | פתוח |
| ORDX | object | XML `<Furnishing>` | הפוך את הפרסר הקיים |

כל מייצא: מודול עצמאי + פונקציה `export(object, placement)` + CLI קטן + בדיקת עצמית. אל תיגע בקבצים של מייצא אחר או ב-`symbols.json`/`elements.json` (קרא בלבד).
