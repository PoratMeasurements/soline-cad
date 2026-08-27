# קטלוג טיפוסי דלתות וחלונות — אלמנטים ל-Soline

> רשימה מלאה ומובנית של **טיפוסי-פתחים** (דלתות + חלונות) להוספה כאלמנטים באפליקציית
> Soline, מכוונת לשוק-הישראלי. כל שורה בנויה כך שתהיה **ישירות-מיושמת** בשלושה מקומות:
> (1) `ElementCatalog.kt` (`ElementDef`), (2) `element_catalog.js` (מיפוי-ORDX),
> (3) `element_symbols_soline.js` (סמל-2D `key`).
>
> חוזה-קואורדינטות: X=לאורך-הקיר · Depth=בליטה-מהקיר · Height=גובה-הפתח (לפתחים).
> פתחים: `hasDepth=false`, `defaultDepth=0` באפליקציה (העומק=עובי-הקיר, נגזר בייצוא).
> יחידות מ״מ, לשון זכר. תאריך: 2026-08-21.
>
> **אוצר-המילים הקנוני של ORDX/InnoDraw** (מאומת-קורפוס, `element_catalog.js`):
> דלתות = `Decorative/EntryDoor` עם `Name ∈ {Doorway w/o Frame, Doorway with Frame,
> Hinged Left In, Hinged Right In, Hinged Left Out, Hinged Right Out}` ·
> חלונות = `Decorative/Window` (Name=`Window`) · אדן = `Decorative/Part` (`WindowSill`) ·
> ממ״ד = `Decorative/Miscellaneous` (Safety Room). **כל טיפוס חדש חייב למפות לאחד מאלה**,
> אחרת אינו נטען באינודרו. פירוט וריאנטים שאין להם Name ייחודי ב-ORDX = נשמרים כמטא-דאטה
> באפליקציה וממופים לאב-הטיפוס הקרוב + תווית.

---

## 0. סכמת-שדות לכל שורה

| שדה | משמעות |
|-----|--------|
| `key` | מזהה-יציב (נשמר כ-`AccessoryEntity.type`) — UPPER_SNAKE |
| שם עברי | תצוגה בבורר-האלמנטים |
| קבוצה | תמיד `OPENINGS` ("פתחים") |
| מידות-ברירת-מחדל | W×H (מ״מ); רוחב-פתח × גובה-פתח |
| פרמטר כיוון-פתיחה | ה-enum/דגלים שקובעים ציר+בליטה (ראו §3) |
| ORDX class/type/name | הזוג-הקובע + שם-InnoDraw למיפוי |
| symbol key | מפתח ב-`element_symbols_soline.js` |

**פרמטר כיוון-פתיחה** (מודל-נתונים מוצע, חל על דלת-ציר וחלון-מדף):
```
hinge  : LEFT | RIGHT          // צד-הציר, במבט מהחדר אל הקיר
swing  : IN | OUT              // לאן נפתחת הכנף ביחס לחדר
mode   : SWING | SLIDE | FOLD | TILT | TILT_TURN | FIXED  // אופן-הפעולה
```
מ-`hinge`+`swing` נגזר ישירות שם-ה-ORDX: `Hinged {Left|Right} {In|Out}`.

---

## 1. דלתות — קטלוג מלא

| # | key | עברית | W×H (מ״מ) | כיוון-פתיחה | ORDX (class/type/name) | symbol |
|---|-----|-------|-----------|--------------|-------------------------|--------|
| 1 | `DOOR_IN_LEFT` | דלת פנימה שמאל | 800×2050 | hinge=LEFT swing=IN | Decorative/EntryDoor/**Hinged Left In** | `door_hinged_l` |
| 2 | `DOOR_IN_RIGHT` | דלת פנימה ימין | 800×2050 | hinge=RIGHT swing=IN | Decorative/EntryDoor/**Hinged Right In** | `door_hinged_r` |
| 3 | `DOOR_OUT_LEFT` | דלת החוצה שמאל | 800×2050 | hinge=LEFT swing=OUT | Decorative/EntryDoor/**Hinged Left Out** | `door_hinged_l` (בליטה מעבר-לקיר) |
| 4 | `DOOR_OUT_RIGHT` | דלת החוצה ימין | 800×2050 | hinge=RIGHT swing=OUT | Decorative/EntryDoor/**Hinged Right Out** | `door_hinged_r` (בליטה מעבר-לקיר) |
| 5 | `DOOR_INTERIOR` | דלת פנים (רגילה) | 900×2050 | mode=SWING (+hinge/swing) | Decorative/EntryDoor/Hinged Left In* | `door_interior_90` |
| 6 | `DOOR_ENTRANCE` | דלת כניסה | 950×2100 | mode=SWING swing=IN | Decorative/EntryDoor/Hinged Left In | `door_entrance` |
| 7 | `DOOR_STEEL_SECURITY` | דלת פלדלת (ביטחונית) | 950×2100 | mode=SWING swing=IN | Decorative/EntryDoor/Hinged Left In | `door_entrance` (+תווית "פלדלת") |
| 8 | `DOOR_MAMAD` | דלת ממ״ד (הדף) | 900×2000 | mode=SWING swing=IN | Decorative/**Miscellaneous**/Safety Room | `door_mamad` |
| 9 | `DOOR_DOUBLE` | דלת דו-כנפית | 1600×2100 | mode=SWING (two-leaf) | Decorative/EntryDoor/Hinged Left In ×2 | `door_double` |
| 10 | `DOOR_FRENCH` | דלת צרפתית (זכוכית דו-כנפית) | 1500×2100 | mode=SWING swing=OUT | Decorative/EntryDoor/Hinged Left Out ×2 | `door_double` |
| 11 | `DOOR_SLIDING` | דלת הזזה | 900×2100 | mode=SLIDE | Decorative/EntryDoor/Doorway w/o Frame | `door_sliding` |
| 12 | `DOOR_SLIDING_PATIO` | דלת הזזה (יציאה למרפסת) | 1800×2100 | mode=SLIDE | Decorative/EntryDoor/Doorway w/o Frame | `door_sliding` (רחב) |
| 13 | `DOOR_POCKET` | דלת כיס | 900×2100 | mode=SLIDE (into wall) | Decorative/EntryDoor/Doorway w/o Frame | `door_pocket`** |
| 14 | `DOOR_FOLDING` | דלת מתקפלת (אקורדיון) | 900×2050 | mode=FOLD | Decorative/EntryDoor/Doorway w/o Frame | `door_folding` |
| 15 | `DOOR_BIFOLD` | דלת דו-מתקפלת (Bi-fold) | 1200×2050 | mode=FOLD | Decorative/EntryDoor/Doorway w/o Frame | `door_folding` |
| 16 | `DOOR_CONCEALED` | דלת נסתרת | 800×2100 | mode=SWING (dashed) | Decorative/EntryDoor/Doorway with Frame | `door_concealed` |
| 17 | `DOOR_BARN` | דלת אסם (הזזה חיצונית) | 1000×2100 | mode=SLIDE (surface) | Decorative/EntryDoor/Doorway w/o Frame | `door_sliding` |
| 18 | `OPENING_FRAME` | מפתח עם משקוף | 800×2050 | mode=FIXED (no leaf) | Decorative/EntryDoor/**Doorway with Frame** | `doorway_frame` |
| 19 | `PASSAGE` | מעבר (בלי משקוף) | 900×2100 | mode=FIXED (no leaf) | Decorative/EntryDoor/**Doorway w/o Frame** | `passage` |
| 20 | `OPENING_TO_FLOOR` | פתח עד הרצפה | 900×2400 | mode=FIXED | Decorative/EntryDoor/Doorway w/o Frame | `passage` (גבוה) |
| 21 | `OPENING_ARCH` | פתח מקושת | 1000×2200 | mode=FIXED | Decorative/EntryDoor/Doorway w/o Frame | `arch` |

\* דלת-פנים "רגילה" נשמרת עם ברירת-מחדל LEFT/IN אך המשתמש בוחר `hinge`+`swing`
בעת ההוספה → הערך נגזר לאחד מ-4 שמות-ה-Hinged בייצוא.
\*\* `door_pocket` — סמל חדש להוספה ל-`element_symbols_soline.js` (מלבן-כיס בתוך הקיר
+ פאנל חלקי; ראו DISPLAY §1.4). כרגע חסר בספרייה.

### הערות-יישום לדלתות
- **4 שמות-ה-Hinged הם היחידים שאינודרו טוענת עם קשת-סיבוב אמיתית.** כל דלת שאינה
  ציר-פשוט (הזזה/כיס/מתקפלת/אסם) ממופה ל-`Doorway w/o Frame` + נשמר `mode` כמטא-דאטה
  לתצוגה מקומית ולסמל-ה-2D הנכון.
- **ממ״ד = `Miscellaneous`**, לא `EntryDoor` (מאומת-קורפוס — `element_catalog.js`
  שורת `door mamad`/Safety Room). קריטי: מיפוי שגוי ל-EntryDoor שובר את הייצוא.
- דלת-פלדלת אין לה Name נפרד ב-ORDX → `Hinged … In` + תווית-תצוגה "פלדלת".

---

## 2. חלונות — קטלוג מלא

| # | key | עברית | W×H (מ״מ) | כיוון/אופן-פתיחה | ORDX (class/type/name) | symbol |
|---|-----|-------|-----------|-------------------|-------------------------|--------|
| 1 | `WINDOW` | חלון (כללי) | 1200×1200 | mode=FIXED | Decorative/Window/**Window** | `window` |
| 2 | `WINDOW_FIXED` | חלון קבוע | 1000×1000 | mode=FIXED | Decorative/Window/Window | `window` |
| 3 | `WINDOW_CASEMENT` | חלון ציר (מדף) | 900×1200 | mode=TILT/SWING, hinge=L/R, swing=IN/OUT | Decorative/Window/Window | `window_casement` |
| 4 | `WINDOW_SLIDING` | חלון הזזה | 1500×1200 | mode=SLIDE | Decorative/Window/Window | `window_sliding` |
| 5 | `WINDOW_TILT_TURN` | חלון קיפ (Tilt-Turn) | 900×1400 | mode=TILT_TURN, hinge=L/R | Decorative/Window/Window | `window_kip`* |
| 6 | `WINDOW_AWNING` | חלון מדף-עליון (Awning) | 1000×600 | mode=TILT (hinge=TOP, out) | Decorative/Window/Window | `window_tilt` |
| 7 | `WINDOW_HOPPER` | חלון מדף-תחתון (Hopper) | 1000×600 | mode=TILT (hinge=BOTTOM, in) | Decorative/Window/Window | `window_tilt` (הפוך) |
| 8 | `WINDOW_DOUBLE_HUNG` | חלון גיליון (Double-hung) | 900×1400 | mode=SLIDE (vertical) | Decorative/Window/Window | `window_hung`* |
| 9 | `WINDOW_SHUTTER` | חלון עם תריס משולב | 1500×1400 | mode=SLIDE/ROLL + תריס | Decorative/Window/Window (+ShutterBox) | `window_sliding` (+`shutter_box`) |
| 10 | `WINDOW_CORNER` | חלון פינתי | 1500×1200 | mode=FIXED/CASEMENT | Decorative/Window/Window ×2 | `window_corner` |
| 11 | `WINDOW_STOREFRONT` | ויטרינה/ראווה | 2000×2400 | mode=FIXED | Decorative/Window/Window | `window_storefront` |
| 12 | `WINDOW_PORTHOLE` | צוהר (עגול) | 500×500 | mode=FIXED | Decorative/Window/Window | `window_porthole` |
| 13 | `WINDOW_GLASSBLOCK` | חלון לבני-זכוכית | 1000×1000 | mode=FIXED | Decorative/Window/Window | `window_glassblock` |
| 14 | `WINDOW_SMALL` | חלונית | 500×500 | mode=CASEMENT/FIXED | Decorative/Window/Window | `window_small` |
| 15 | `WINDOW_SKYLIGHT` | חלון-גג (סקיילייט) | 800×1200 | mode=TILT (roof) | Decorative/Window/Window | `window` (תקרה) |
| 16 | `WINDOW_INTERIOR` | חלון פנימי (בין-חדרים) | 800×600 | mode=FIXED | Decorative/Window/Window | `interior_window` |
| 17 | `WINDOW_SILL` | אדן-חלון | 1200×250(D) | — (אלמנט-משנה) | Decorative/**Part**/**WindowSill** | `window_sill` |
| 18 | `SHUTTER_BOX` | ארגז-תריס | 2316×245 | — (אלמנט-משנה) | Decorative/**Part**/**ShutterBox** | `shutter_box` |
| 19 | `AIR_OPENING` | פתח-אוויר (תקרה) | 200×200 | mode=FIXED (grille) | Decorative/Miscellaneous/**Air Opening Ceiling** | `vent_grille` |

\* `window_kip`, `window_hung` — סמלי-2D חדשים להוספה ל-`element_symbols_soline.js`
(קיפ = משולש-נטייה + קשת-סיבוב על אותה שמשה; גיליון = מלבן + חץ אנכי). כרגע חסרים.

### הערות-יישום לחלונות
- **ל-ORDX יש טיפוס-חלון יחיד (`Window`).** כל 19 הווריאנטים נשמרים באותו זוג
  `Decorative/Window`; ההבחנה נשמרת ב-`key`+`mode` באפליקציה, ובסמל-ה-2D הנכון
  לתצוגה/DXF. כלומר: העושר הוא בשכבת-האפליקציה+הסמל, לא בשם-ה-ORDX.
- **קיפ (Tilt-Turn)** הוא הנפוץ בשוק-הישראלי החדש — ראוי לסמל ייעודי המראה את
  **שני** מצבי-הפתיחה (הטיה + סיבוב), ראו DISPLAY §4.
- **תריס** ב-Soline הוא שילוב: פתח-חלון (`Window`) + `ShutterBox` (`Part`) + מנוע-תריס
  (`shutter_motor` בדיסציפלינת-smart). לשמור כשני אלמנטים מקושרים או כאלמנט-מורכב.
- **אדן/ארגז-תריס = `Part`**, מקוננים בתוך פתח-החלון (מאומת-קורפוס).

---

## 3. מודל כיוון-הפתיחה — פירוט ליישום

### 3.1 גזירת שם-ORDX מהפרמטרים
```
if (mode == SWING && type == door):
    ordxName = "Hinged " + (hinge==LEFT? "Left":"Right") + " " + (swing==IN? "In":"Out")
elif (mode == FIXED && frame):        ordxName = "Doorway with Frame"
elif (mode == FIXED && !frame):       ordxName = "Doorway w/o Frame"
elif (mode in {SLIDE,FOLD}):          ordxName = "Doorway w/o Frame"   // + mode במטא-דאטה
window (any mode):                    ordxName = "Window"
```

### 3.2 UI מוצע בבורר-האלמנטים (אפליקציה)
בעת בחירת דלת-ציר או חלון-מדף — להציג **בורר-כיוון גרפי בן-4 אריחים** (או 2 לחלון):
פנימה-שמאל / פנימה-ימין / החוצה-שמאל / החוצה-ימין, כל אריח מצייר את הסמל בזעיר.
זה תואם ל-`DOOR_IN_LEFT…DOOR_OUT_RIGHT` הקיימים ומייתר טעויות-הזנה. לדלת-הזזה/מתקפלת
מספיק בורר `mode` + כיוון-החלקה (ימין/שמאל).

### 3.3 ברירות-מחדל (defaultDepth/hasDepth ב-ElementCatalog.kt)
כל הפתחים: `hasDepth=false`, `defaultDepth=0.0`, `group=ElementGroup.OPENINGS`.
העומק-בפועל (עובי-הפתח בקיר) נגזר בזמן-ייצוא מ-`z=-100` שבקטלוג-ה-JS (שקוע-לקיר).

---

## 4. פערים מול המצב-הקיים (למימוש עתידי — לא לביצוע כאן)

**קיים כבר** (`ElementCatalog.kt`): `WINDOW, OPENING_FRAME, PASSAGE, DOOR_IN_LEFT,
DOOR_IN_RIGHT, DOOR_OUT_LEFT, DOOR_OUT_RIGHT, OPENING_TO_FLOOR` — 8 פתחים.

**להוסיף לאפליקציה** (מהקטלוג לעיל): `DOOR_INTERIOR, DOOR_ENTRANCE,
DOOR_STEEL_SECURITY, DOOR_MAMAD, DOOR_DOUBLE, DOOR_FRENCH, DOOR_SLIDING,
DOOR_SLIDING_PATIO, DOOR_POCKET, DOOR_FOLDING, DOOR_BIFOLD, DOOR_CONCEALED,
DOOR_BARN, OPENING_ARCH` + `WINDOW_FIXED, WINDOW_CASEMENT, WINDOW_SLIDING,
WINDOW_TILT_TURN, WINDOW_AWNING, WINDOW_HOPPER, WINDOW_DOUBLE_HUNG, WINDOW_SHUTTER,
WINDOW_CORNER, WINDOW_STOREFRONT, WINDOW_PORTHOLE, WINDOW_GLASSBLOCK, WINDOW_SMALL,
WINDOW_SKYLIGHT, WINDOW_INTERIOR, WINDOW_SILL, SHUTTER_BOX, AIR_OPENING`.

**סמלי-2D חסרים** להוספה ל-`element_symbols_soline.js`: `door_pocket`, `window_kip`,
`window_hung`. (השאר כבר קיימים — ראו רשימת-הסמלים בקובץ.)

**מיפויי-ORDX חסרים** ב-`element_catalog.js` (aliases): להוסיף כינויים עבריים
לכל ה-keys החדשים המצביעים על אחד מ-6 שמות-ה-ORDX המאומתים (דלתות) או `Window`.

---

## 5. תמצית-הטבלה למימוש מהיר (key → ORDX name → symbol)

**דלתות:** `DOOR_IN_LEFT`→Hinged Left In→`door_hinged_l` · `DOOR_IN_RIGHT`→Hinged Right In→`door_hinged_r`
· `DOOR_OUT_LEFT`→Hinged Left Out→`door_hinged_l` · `DOOR_OUT_RIGHT`→Hinged Right Out→`door_hinged_r`
· `DOOR_INTERIOR`→Hinged*→`door_interior_90` · `DOOR_ENTRANCE`→Hinged Left In→`door_entrance`
· `DOOR_STEEL_SECURITY`→Hinged Left In→`door_entrance` · `DOOR_MAMAD`→Safety Room(Misc)→`door_mamad`
· `DOOR_DOUBLE`→Hinged×2→`door_double` · `DOOR_FRENCH`→Hinged Out×2→`door_double`
· `DOOR_SLIDING`/`_PATIO`/`_BARN`→Doorway w/o Frame→`door_sliding` · `DOOR_POCKET`→Doorway w/o Frame→`door_pocket`
· `DOOR_FOLDING`/`_BIFOLD`→Doorway w/o Frame→`door_folding` · `DOOR_CONCEALED`→Doorway with Frame→`door_concealed`
· `OPENING_FRAME`→Doorway with Frame→`doorway_frame` · `PASSAGE`/`OPENING_TO_FLOOR`→Doorway w/o Frame→`passage`
· `OPENING_ARCH`→Doorway w/o Frame→`arch`

**חלונות:** `WINDOW`/`WINDOW_FIXED`→Window→`window` · `WINDOW_CASEMENT`→Window→`window_casement`
· `WINDOW_SLIDING`→Window→`window_sliding` · `WINDOW_TILT_TURN`→Window→`window_kip`
· `WINDOW_AWNING`/`_HOPPER`→Window→`window_tilt` · `WINDOW_DOUBLE_HUNG`→Window→`window_hung`
· `WINDOW_SHUTTER`→Window+ShutterBox→`window_sliding`+`shutter_box` · `WINDOW_CORNER`→Window→`window_corner`
· `WINDOW_STOREFRONT`→Window→`window_storefront` · `WINDOW_PORTHOLE`→Window→`window_porthole`
· `WINDOW_GLASSBLOCK`→Window→`window_glassblock` · `WINDOW_SMALL`→Window→`window_small`
· `WINDOW_INTERIOR`→Window→`interior_window` · `WINDOW_SILL`→WindowSill(Part)→`window_sill`
· `SHUTTER_BOX`→ShutterBox(Part)→`shutter_box` · `AIR_OPENING`→Air Opening Ceiling(Misc)→`vent_grille`

---

## מקורות
- קוד פנימי: `src/element_catalog.js` (מיפוי-ORDX מאומת-קורפוס), `src/element_symbols_soline.js`
  (סמלי-2D), `app-measure/app/src/main/kotlin/il/co/soline/measure/catalog/ElementCatalog.kt`
  (קטלוג-אפליקציה + `ElementDef`), `ops/docs/CVSM_ELEMENT_SCHEMA.md`, `docs/ORDX_ELEMENT_SPEC.md`.
- מוסכמות-תצוגה + טיפוסי-פתחים: ראו `docs/DOORS_WINDOWS_DISPLAY.md` והמקורות שם.
