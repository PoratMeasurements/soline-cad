# גשר ORDX — מאפליקציית המדידה אל הממיר של Soline

> ניתוח reverse-engineering של פורמט **ORDX** (InnoDraw Order XML) כגשר בין אפליקציית המדידה (`com.roommeasure.app` / "CVSM") לבין הממיר של Soline (ORDX → DXF/PDP/.sol).
> מקורות: הפרסר `ordx-pdp-converter/src/parseOrdx.js`, המייצא `src/export_ordx.js`, `src/xml.js`; החוזה `docs/OBJECT_MODEL.md`; מודל המדידה ב-`MEASURE_APP_ANALYSIS.md` + הדגימה `samples/measure_project_sample.json`; **קורפוס ORDX אמיתי** ב-`G:\My Drive\קבצים ללמידת מכונה\ORDX\` (2725/2726/2854/2916/2918, זוג-זהב 2918 DR1↔DR2).
> נכתב עבור Michael, Soline. יחידות מ"מ אלא אם צוין. עודכן: 2026-08-16.

---

## 0. תקציר מנהלים

ORDX הוא **XML היררכי ופשוט** של InnoDraw: `Job → Rooms → Room → Walls → Wall → {Fixtures|Furnishings}`. הוא נושא **גאומטריית קיר אמיתית** (Start/End/Angle) ו**נקודות-תשתית ואביזרים ממוקמים על הקיר** (מיקום לאורך הקיר + גובה + מידות W/D/H). זהו פורמט **דל-שדות** יחסית למודל של אפליקציית המדידה: הוא לוכד את מה שנחוץ לשרטוט CAD בסיסי, אבל **מאבד** שכבות שלמות שהמדידה כן לוכדת — ארונות, גרף-חיבורי-קירות, סגנונות-קצה/ראש-קיר, קירות מעוקלים, גיאומטריית-חריץ של מזגן, וכל ממד ה"סטטוס" (קיים/חדש/מבוטל) שהוא לב עבודת ההתאמה בנגרות.

**המסקנה המעשית:** הגשר `מדידה → ORDX` הוא **מיפוי מאבד-מידע** (lossy). ל-DXF/PDP בסיסי זה מספיק; אבל אם Soline רוצה שהצינור יזין נגרות/`.sol` בלי לאבד מידע קריטי, חובה **הרחבת-סכימה עם namespace של Soline** (בלוק `<Ext>` פר-ישות) שנושא את מה ש-ORDX-הליבה לא יכול להחזיק.

---

## 1. מבנה ORDX (XML)

### 1.1 העץ המלא

```
<?xml version="1.0" encoding="UTF-8"?>
<Job Created="...">                     ← attr Created אופציונלי
  <ProductVersion>...</ProductVersion>   ← אופציונלי
  <Unit>mm</Unit>                        ← תמיד "mm" בקורפוס
  <Properties><Job><Information>          ← אופציונלי (מטא-פרויקט)
     <Job><Name/><Description/></Job>
     <Customer>…12 שדות…</Customer>
     <ShipTo>…12 שדות…</ShipTo>
  </Information></Job></Properties>
  <Rooms>
    <Room>
      <RoomProperties><Room><General>     ← אופציונלי
         <Name/><Description/><Type/>
      </General></Room></RoomProperties>
      <Walls>
        <Wall> … </Wall>  × N
      </Walls>
    </Room>
  </Rooms>
</Job>
```

### 1.2 ישות `Wall`

| שדה | דוגמה | משמעות |
|---|---|---|
| `Number` | `1` | מספר-קיר סידורי (1-based) |
| `Description` | `Wall 1` | תיאור טקסטואלי (ברירת-מחדל "Wall N") |
| `Position/StartX,StartY` | `3070.0, 3319.0` | נקודת התחלה בתכנית (מ"מ, 6 ספרות עשרוניות) |
| `Position/EndX,EndY` | `3070.0, 2540.0` | נקודת סיום בתכנית |
| `Position/Angle` | `90.0` | זווית הקיר במעלות (נגזרת מ-Start→End) |
| `Type/Style` | `Standard` | סגנון קיר |
| `Dimensions/Length` | *(מושמט בקורפוס)* | אורך (נגזר מהגאומטריה כשחסר) |
| `Dimensions/Height` | `2785.0` | גובה הקיר |
| `Dimensions/Soffit` | *(מושמט בקורפוס)* | סוֹפִיט (הפרסר קורא, הקורפוס לא פולט) |
| `Dimensions/Thick` | `100.0` | עובי הקיר |
| `Dimensions/VaultHeight` | `0.0` | גובה קמרון/כיפה (0 = קיר ישר) |
| `Fixtures/Fixture[]` | — | פריטים (אותה מעטפת כמו Furnishing) |
| `Furnishings/Furnishing[]` | — | פריטים ממוקמים (הקורפוס משתמש כמעט תמיד ב-Furnishing) |

> בקורפוס האמיתי (2918) ה-`Dimensions` כולל **רק** Height/Thick/VaultHeight; Length ו-Soffit מושמטים ונגזרים בממיר. `Fixtures` ו-`Furnishings` הן **שתי מעטפות זהות במבנה** — parseOrdx קורא את שתיהן ל-`w.fixtures`/`w.furnishings`.

### 1.3 ישות פריט (`Fixture` / `Furnishing`)

```
<Furnishing>
  <Catalog>InnoDraw</Catalog>
  <Properties><General>
     <Name>Duplex Socket</Name>
     <Class>Fixture</Class>          ← Fixture | Decorative
     <Type>Miscellaneous</Type>      ← Miscellaneous | Part | Window | Door | TWall …
     <Width>160</Width>              ← *fixtures*: W/D/H ישירים תחת General + <Size/> ריק
     <Depth>15</Depth>
     <Height>80</Height>
     <Size></Size>
  </General></Properties>
  <Position><X>2635.0</X><Y>1108.0</Y></Position>
</Furnishing>
```

**שתי קונבנציות-מידה** (parseOrdx מטפל בשתיהן, `parseSize`):
- **Fixture/רוב הפריטים** — `Width/Depth/Height` הם **ילדים ישירים** של `<General>`, ו-`<Size>` ריק. מידות כ**מספרים שלמים** (`160`).
- **Decorative — Window/Door** — המידות **מקוננות** תחת `<General><Size>`, כ-float 6 ספרות (`1268.000000`). את זה `isNestedSizeType` במייצא משחזר.

**סמנטיקת `Position` של פריט** (מפוענח ב-`STATUS.md`/`src/placement.js`):
- `X` = **מרחק לאורך הקיר** מנקודת ההתחלה (לא קואורדינטה מוחלטת!).
- `Y` = **גובה ההתקנה על הקיר** (Z אמיתי מהרצפה) — לא רלוונטי לתכנית-על.
- `Z` = **היסט מחוץ-למישור** (אופציונלי; מופיע 5× בקורפוס 2918, לפריטים צפים/תקרתיים).
- עוגן לפי `Class`: **`Fixture`** → `X` = הקצה השמאלי (מרכז = `X + Width/2`); **`Decorative`** (חלון/דלת) → `X` = המרכז כבר.

⚠️ **פער בפרסר:** `parseOrdx.js` קורא ב-`Position` רק את `X` ו-`Y` — **`Z` נזרק בעת הפרסור** למרות ש-`export_ordx.js` יודע לכתוב אותו וש-5 ערכי Z קיימים בקורפוס. round-trip דרך הממיר מאבד את ה-Z.

---

## 2. מיפוי: מודל אפליקציית המדידה → ORDX

מודל המדידה: `Project` (טבלת `projects`) → `rooms` JSON → `walls[]` (קואורדינטות **מוחלטות** בתכנית) → `accessories[]` + `cabinets[]`. להלן המיפוי לשדות ORDX.

### 2.1 רמת פרויקט / חדר

| מדידה (JSON) | → | ORDX | הערה |
|---|---|---|---|
| `Project.name` | → | `Properties/Job/Information/Job/Name` | |
| `Project.description` | → | `…/Job/Description` | |
| `customerName/Address1/…/Comment` (12) | → | `Information/Customer/*` | התאמת-שם ישירה |
| `shipToName/…` (12) | → | `Information/ShipTo/*` | |
| `room.name / description` | → | `RoomProperties/Room/General/Name,Description` | |
| — | → | `Unit` = `mm` | קבוע |
| `room.defaultHeight` (2526.7) | → | *(אין; יורד ל-`Wall/Dimensions/Height` פר-קיר)* | |

### 2.2 קיר: `wall` → `Wall`

| מדידה (`wall`) | → | ORDX (`Wall`) | הערה |
|---|---|---|---|
| index+1 | → | `Number` | סידורי |
| — | → | `Description` = `"Wall N"` | נגזר |
| `startX, startY` | → | `Position/StartX, StartY` | קואורדינטה מוחלטת → נשמרת כמות-שהיא |
| `endX, endY` | → | `Position/EndX, EndY` | |
| `atan2(endY−startY, endX−startX)`→deg | → | `Position/Angle` | **נגזר** מהגאומטריה |
| `wallType` (STANDARD) | → | `Type/Style` = `Standard` | מיפוי enum |
| `length` (5707.56) | → | `Dimensions/Length` | או השמטה + גזירה |
| `height` (2526.7) | → | `Dimensions/Height` | |
| `soffit` (0) | → | `Dimensions/Soffit` | |
| `thickness` (100) | → | `Dimensions/Thick` | |
| `vaultHeight` (על VAULT) | → | `Dimensions/VaultHeight` | ראה §3 — LEFT/RIGHT אובד |

### 2.3 אביזר: `accessory` → `Furnishing`

| מדידה (`accessory`) | → | ORDX | הערה |
|---|---|---|---|
| `name` ("Single Socket"/"Window") | → | `General/Name` | |
| `type` (SOCKET_SINGLE/WINDOW) | → | `General/Class`+`Type` | דורש טבלת-מיפוי type→(Class,Type) |
| `width` | → | `General/Width` (או `Size/Width` לחלון/דלת) | int לפיקסצ'ר, float לחלון |
| `depth` (עומק-בליטה: 6.8/114.3) | → | `General/Depth` | **קריטי לנגרות — כן ממופה** |
| `height` | → | `General/Height` (או `Size/Height`) | |
| `fromLeft` | → | `Position/X` | מרחק לאורך הקיר; Fixture=קצה שמאל, חלון=מרכז |
| `fromBottom` | → | `Position/Y` | גובה על הקיר |
| `description` | → | `General/Description` | |
| — | → | `Catalog` = `InnoDraw` (או `Soline`) | קבוע |

> **חוזה ה-OBJECT_MODEL** (`objectToFixture`): המייצא מקבל אובייקט קנוני של Soline (`dimensions_mm{W,D,H}` + placement `{x,y,z}`) ומוציא בדיוק את מעטפת ה-Furnishing הזו. placement.x = לאורך הקיר, placement.y = גובה, placement.z = היסט-מישור. זו נקודת-החיבור המדויקת של מודל-האובייקט של Soline אל ORDX.

---

## 3. פערים — מה נלכד ואיבד בכל כיוון

### 3.1 מה אפליקציית המדידה לוכדת ש-ORDX **לא** מייצג (אובדן בגשר מדידה→ORDX)

| שדה במדידה | קריטיות לנגרות | סטטוס ב-ORDX |
|---|---|---|
| **`cabinets[]`** (ארונות על הקיר) | גבוהה מאוד | ❌ **אין ישות ארון ב-ORDX כלל** — רק Fixture/Furnishing |
| **`depth` כעומק-בליטה** | גבוהה | ✅ ממופה ל-`Depth` (לוודא שנכתב תמיד, גם לחלונות) |
| **`wallTopStyle`** (STANDARD / VAULT_LEFT / VAULT_RIGHT) | בינונית | ◐ רק `VaultHeight` סקלרי — **צד הקמרון (שמאל/ימין) אובד** |
| **`wallEndStyle`** (NO/…) | בינונית | ❌ אין |
| **`elevation`** (מפלס קיר) | בינונית | ❌ אין (יש רק Height/Soffit) |
| **`isArcWall`** + גאומטריית קשת | גבוהה | ❌ ORDX מייצג רק קו ישר Start→End — **קיר מעוקל אובד** |
| **גרף-חיבורי-קירות** (`connectToNext/Previous`, `startConnectedWallId`, `endConnectedWallId`, `maxConnectionDistance`) | גבוהה | ❌ אין — חיבוריות משתמעת רק מקואורדינטות משותפות |
| **`face`** (FRONT/…) של אביזר | בינונית | ❌ אין — ORDX מניח חזית-קיר |
| **גיאומטריית-חריץ מזגן** (`slotX/slotY/slotDX/slotDY`) | בינונית | ❌ אין |
| **`widthInputMode`, `fromRight`** | נמוכה | ❌ אין (fromRight ממילא עודף) |
| **`photos[]`** (תיעוד ויזואלי פר-קיר) | גבוהה (ראיה) | ❌ אין הפניית-תמונה |
| דגלי-עריכה (`heightManuallyEdited`, `soffitManuallyEdited`) | נמוכה | ❌ אין |
| `studSpacing`, `hatchPattern` | נמוכה | ❌ אין |
| **סטטוס-נקודה** (קיים/חדש/מבוטל/להזיז/הכנה) | **קריטית** | ❌ **גם המדידה וגם ORDX לא מחזיקים** — ראה §4 |

### 3.2 מה ORDX מייצג שהמדידה לא מדגישה

| ORDX | הערה |
|---|---|
| `Angle` פר-קיר | במדידה נגזר מ-Start/End (יתירות שימושית לאימות) |
| `Number`, `Room/Type` | מטא סידורי/סוג-חדר |
| טקסונומיית `Catalog`/`Class`/`Type` | ORDX ממפה כל פריט לקטלוג InnoDraw; המדידה משתמשת ב-`type` enum משלה |
| `Position/Z` (היסט-מישור) | קיים בסכימת ORDX, אך **הפרסר של הממיר זורק אותו** (§1.3) |

---

## 4. המלצה — לוודא שהגשר מדידה→ORDX→ממיר לא מאבד מידע קריטי

1. **בלוק הרחבה עם namespace של Soline.** ORDX-הליבה דל מדי. יש להוסיף לכל `Wall`/`Furnishing` בלוק `<Ext xmlns:sol="soline">` שנושא את השדות ש-InnoDraw לא מכיר: `elevation`, `wallEndStyle`, `wallTopStyle` (כולל LEFT/RIGHT), `isArcWall`+פרמטרי-קשת, גרף-החיבוריות, `face`, `slot*`, וכל שדה **סטטוס-נקודה**. הממיר יתעלם ממה שלא צריך; שום דבר לא ייעלם בשקט. זו הדרך היחידה לשמור round-trip **מלא** דרך פורמט צד-שלישי.

2. **סטטוס-נקודה = אזרח מדרג-ראשון (החוסר הקריטי ביותר).** לפי `field_reconciliation.md`, לב עבודת הנגר הוא ההתאמה `קיים | חדש/לביצוע | להזיז | מבוטל | הכנה | עתידי | המלצה`. **אף אחד משני המודלים לא מחזיק אותו כיום.** יש להוסיפו קודם ב-`accessory` של המדידה, ואז לגשר דרך `<Ext>` (או, כפתרון-ביניים בלבד, לקודד ב-`Description`).

3. **ארונות (`cabinets[]`) — אין להם מסלול ב-ORDX.** אם הצינור צריך לשאת פריסת-מטבח (ולא רק תשתית), חובה ערוץ נפרד או ישות `<Cabinet>` מורחבת. כרגע כל ה-`cabinets` **נופלים בשקט** בגשר.

4. **קירות מעוקלים.** `isArcWall` אין לו ביטוי ב-ORDX (קו ישר בלבד). יש לפצל קשת למקטעי-קו קצרים בעת הייצוא (approximation) **וגם** לשמר את פרמטרי-הקשת המקוריים ב-`<Ext>` כדי שהצד הנגרותי יוכל לשחזר.

5. **תיקון הפרסר: לקרוא `Z`.** `parseOrdx.js` יקרא `Position/Z` (כיום נזרק) — אחרת פריטים צפים/תקרתיים מאבדים את ההיסט. תיקון של שורה אחת ב-`parseWall`/`parsePlacedItem`, ובדיקת ה-round-trip צריכה לכלול Z, Depth ו-Soffit.

6. **בדיקת אי-אובדן אוטומטית (lossless gate).** להרחיב את `--selftest` של `export_ordx.js` לזוג `measure JSON → ORDX → parse`: להשוות **כל** שדה של המדידה מול היעד, ולהכשיל את ה-CI על כל שדה שנשמט בלי מיפוי מפורש (או `<Ext>` או ויתור מודע). כך "אובדן שקט" הופך לכישלון גלוי.

7. **וידוא `Depth` לחלונות/דלתות.** בסכימת ה-`Size` המקוננת, לוודא ש-`Depth` (עובי הפתח/בליטה) תמיד נכתב — זהו נתון קריטי לנגרות שקל להשמיטו כי הוא אופציונלי בסכימה.
