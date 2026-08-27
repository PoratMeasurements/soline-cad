# ORDX_ELEMENT_SPEC — מפרט האלמנטים המלא + בנייה מדויקת של ORDX לכל אלמנט

> **מטרה:** מפת-האמת המוחלטת של **כל** אלמנט ש-InnoDraw / Cabinet-Vision תומך בו, ו**בדיוק** כיצד הוא מסודר (serialized) ב-ORDX (XML). זהו הבסיס לייצור אלמנטים מ-Soline אל ORDX ואל DXF-3D. מהנדס אמור להיות מסוגל לממש `Soline→ORDX` ו-`Soline→DXF-3D` מהמסמך הזה בלבד.
>
> **שיטה (ניתוח סטטי, קריאה-בלבד):** הצלבת שלושה מקורות — (א) קטלוג-האלמנטים המקורי של InnoDraw בגרסה החדשה `EL_CAD_9505_0050_0005_0005_ktn` (`eLObstaclesIconsCategories*.tx~`, `eLObstaclesIcons*.tx~` — שמות, קודי-ID, סמלי 2D/3D); (ב) **קורפוס ORDX אמיתי** ב-`G:\My Drive\קבצים ללמידת מכונה\ORDX` (9 קבצים, 296 מופעי-אלמנט) — ה-XML האמיתי; (ג) הממיר הקיים `ordx-pdp-converter/src/export_ordx.js` + `elements.json` (170 אלמנטים) — כמקור-ייחוס לקטלוג ולטקסונומיה, לא כמקור-אמת.
>
> גרסה 1.0 · 2026-08-18 · עברית · לשון זכר. שמות תגים/קודים/מאפיינים — **מילולית באנגלית/מקור**. כל אלמנט שקידודו לא ודאי מסומן **[לא ודאי]** עם מה שחסר.

---

## 0. תקציר — איך ORDX בנוי

ORDX הוא XML היררכי אחד לכל עבודה:

```
Job                                 (Created="dd/MM/yyyy HH:mm:ss", אופציונלי)
├─ ProductVersion                   "2025"  (אופציונלי)
├─ Unit                             "mm"    (תמיד מ"מ בקורפוס)
├─ Properties                       (אופציונלי — פרטי-עבודה/לקוח)
│  └─ Job → Information → {Job{Name,Description}, Customer{…}, ShipTo{…}}
└─ Rooms
   └─ Room  (יכולים להיות כמה)
      ├─ RoomProperties → Room → General → {Name, Description, Type}
      └─ Walls
         └─ Wall  (מוסדרים לפי היקף — perimeter connections)
            ├─ Number, Description
            ├─ Position → {StartX, StartY, Angle, EndX?, EndY?, LeftWallNumber?}
            ├─ Type → Style
            ├─ Dimensions → {Length?, Height, Soffit?, Thick, VaultHeight?}
            ├─ Fixtures   → Fixture[]      (אלמנטי-נקודה: חשמל/מים/גז)
            └─ Furnishings → Furnishing[]  (פתחים/דקורטיביים/ארונות)
```

**כל אלמנט מונח (Fixture או Furnishing) נושא אותו מבנה:**

```xml
<Fixture>                         <!-- או <Furnishing> -->
  <Catalog>InnoDraw</Catalog>     <!-- שם הקטלוג; ראה §2.5 -->
  <Properties>
    <General>
      <Name>…</Name>              <!-- שם-הפריט (מזהה בקטלוג היעד) -->
      <Description>…</Description> <!-- אופציונלי: שם דו-לשוני / הערה -->
      <Class>…</Class>            <!-- Fixture | Decorative -->
      <Type>…</Type>             <!-- Miscellaneous | Part | Window | EntryDoor | TWall -->
      … מידות …                   <!-- שתי מוסכמות, ראה §2.3 -->
    </General>
    <Attributes>                  <!-- אופציונלי: פרמטרים נוספים -->
      <Parameter><Name>…</Name><Type>M|S</Type><Value>…</Value></Parameter>
    </Attributes>
  </Properties>
  <Position>
    <X>…</X>  <!-- מרחק לאורך הקיר מתחילתו (מ"מ) -->
    <Y>…</Y>  <!-- גובה על הקיר מהרצפה (מ"מ) -->
    <Z>…</Z>  <!-- היסט מחוץ-למישור (מ"מ); שלילי = שקוע לתוך הקיר; אופציונלי -->
  </Position>
</Fixture>
```

**שלוש עובדות-מפתח שקובעות הכל:**

1. **הזוג `Class`/`Type` הוא המפתח** שבו כלי-היעד (Cabinet Vision / Raumplan) בוחר פריט מהספרייה. `Name`/`Description` הם לזיהוי/תצוגה. הערת-הקורפוס עצמה אומרת: *"Class and Type are optional and must match the item or no item will be selected. It is recommended to omit them"* — כלומר אם משאירים אותם, **חובה** שיהיו נכונים.
2. **מיקום:** `X` = לאורך הקיר מנקודת-ההתחלה שלו, `Y` = גובה על הקיר, `Z` = היסט-עומק (ברירת-מחדל 0). זו מערכת-קואורדינטות **מקומית-לקיר**, לא גלובלית.
3. **יחידות:** מ"מ בכל מקום. קואורדינטות-קיר = float ב-6 ספרות עשרוניות; מידות-פריט לרוב **מספר-שלם** (`<Width>160</Width>`).

---

## 1. הקיר (Wall) — מסגרת-הייחוס לכל אלמנט

לפני האלמנטים — הקיר, כי כל `Position` נמדד יחסית אליו.

| תג | משמעות | יחידה | הערות |
|---|---|---|---|
| `Number` | מספר-קיר סידורי (1..N) | int | מפתח ל-`LeftWallNumber` |
| `Description` | תווית ("Wall 1") | טקסט | |
| `Position/StartX`,`StartY` | נקודת-התחלה בתכנית | mm float(6) | מערכת גלובלית של החדר |
| `Position/Angle` | זווית-הקיר | מעלות float(6) | 0=מזרח, 90=צפון, נגד-כיוון-השעון |
| `Position/EndX`,`EndY` | נקודת-סיום (אופציונלי) | mm float(6) | **אם קיים — דורס את אורך-הקיר** |
| `Position/LeftWallNumber` | חיבור לקיר-שמאלי | int | **אם תקף — דורס StartX/StartY** (משרשר קירות להיקף סגור) |
| `Type/Style` | סגנון-קיר | enum | `Standard \| Peninsula \| Cathedral \| VaultLeft \| VaultRight` |
| `Dimensions/Length` | אורך-קיר | mm float(6) | אופציונלי אם יש EndX/EndY |
| `Dimensions/Height` | גובה-קיר | mm float(6) | גובה-חדר גולמי |
| `Dimensions/Soffit` | הנמכה/סופיט עליון | mm float(6) | אופציונלי |
| `Dimensions/Thick` | עובי-קיר | mm float(6) | טיפוסי 100 |
| `Dimensions/VaultHeight` | גובה-קמרון | mm float(6) | רלוונטי ל-Vault/Cathedral |

**DXF-3D:** כל קיר = מלבן אנכי בין `(StartX,StartY)` ל-`(EndX,EndY)`, גובה `Height`, עובי `Thick` (מוצא לצד-פנים). `Soffit` מוריד את הקצה-העליון. `VaultLeft/Right/Cathedral` משפעים את הקצה-העליון לפי `VaultHeight`.

דוגמה אמיתית (מהקורפוס, `2918_...DR1.ordx`):
```xml
<Wall>
 <Number>2</Number>
 <Description>Wall 2</Description>
 <Position>
  <StartX>3070.000000</StartX><StartY>2540.000000</StartY>
  <Angle>0.000000</Angle>
  <EndX>7555.000000</EndX><EndY>2540.000000</EndY>
 </Position>
 <Type><Style>Standard</Style></Type>
 <Dimensions>
  <Height>2785.000000</Height><Thick>100.000000</Thick><VaultHeight>0.000000</VaultHeight>
 </Dimensions>
 <Furnishings> … אלמנטים … </Furnishings>
</Wall>
```

---

## 2. חוזה-הסריאליזציה של אלמנט (חובה לקרוא לפני הטבלאות)

### 2.1 טקסונומיית Class / Type (מאומתת מול הקורפוס)

זהו **המפתח היחיד** שקובע איזה פריט-ספרייה נבחר ב-Cabinet Vision. חמישה זוגות בלבד מופיעים בקורפוס האמיתי:

| Class | Type | משפחה | אלמנטים שאומתו בקורפוס |
|---|---|---|---|
| `Fixture` | `Miscellaneous` | חשמל/תקשורת/נקודות-על-קיר | Socket, Duplex Socket, SocketEx, Junction Box, Power Line, Wall Electric Line |
| `Fixture` | `Part` | אינסטלציה רטובה + גז + ניקוז | Gas, Faucet, Water Supply, Sewage, Sewer drainage |
| `Decorative` | `Window` | חלונות | Window |
| `Decorative` | `EntryDoor` | דלתות/פתחים/מעברים/קשתות | Door, Passage, Doorway with Frame, Doorway w/o Frame, Hinged Left In Door |
| `Decorative` | `TWall` | קורה קונסטרוקטיבית חוצת-קיר | Beam |
| `Decorative` | `Part` | ארגז-תריס / אדן-חלון | ShutterBox, WindowSill |
| `Decorative` | `Miscellaneous` | תקרה (ספוט/הנמכה/מפזר), לוח-חשמל, עמודים, שונות | Can Light, "הנמכת תקרה עם מזגן", Water Bar (תמי4), Power Box |

> **הערה חשובה על עקביות:** בקובץ-הדמו של Soline, האלמנט "מים/Water" סומן בטעות `Fixture/Miscellaneous`, בעוד נקודת-מים אמיתית בקורפוס היא **`Fixture/Part`** ("Water Supply"). בייצור מ-Soline יש לסמן כל נקודה רטובה (מים/ברז/גז/ביוב/ניקוז) כ-`Fixture/Part`.

### 2.2 מְכל: `<Fixtures>` מול `<Furnishings>` — לא קריטי, אך יש דפוס

- **דפוס מומלץ (קובץ-הדמו של Soline):** `Fixture`-class → תחת `<Fixtures>`; `Decorative`-class → תחת `<Furnishings>`.
- **אך ה-CV האמיתי (קורפוס 2918/2916/2725) שם את *הכל*, כולל שקעים, תחת `<Furnishings>`.** הפרסר (`parseOrdx.js`) קורא את שניהם. לכן: **המְכל אינו קובע את סוג-האלמנט — `Class`/`Type` קובעים.** להתאמה מרבית ל-CV, מותר לשים הכל ב-`<Furnishings>`; לקריאוּת, עדיף לפצל לפי המלצת-הדפוס.

### 2.3 מידות — שתי מוסכמות (שתיהן נקראות ע"י הפרסר)

**מוסכמה A — Windows ו-Doors:** מידות **מקוננות** תחת `<Size>`:
```xml
<Size>
  <Width>1474.000000</Width>
  <Height>1320.000000</Height>
  <Depth>100.000000</Depth>   <!-- עומק = עובי-הפתח בקיר -->
</Size>
```

**מוסכמה B — כל השאר:** מידות כ**ילדים-ישירים** של `<General>`, ואז `<Size>` **ריק** כ-placeholder:
```xml
<Width>160</Width>
<Depth>15</Depth>
<Height>80</Height>
<Size>
</Size>
```

- סדר מוסכמה B: `Width`, `Depth`, `Height`.
- הערת-הקורפוס: *"Size is only required if modified from original size"* — כלומר אם משמיטים מידות, CV לוקח את מידות-ברירת-המחדל של הפריט מהספרייה. בייצוא מ-Soline **מומלץ תמיד לפלוט מידות מפורשות** כדי לא להיות תלוי בספריית-היעד.
- מיפוי-סמנטי: `Width` = רוחב לאורך הקיר · `Depth` = עומק-בליטה מהקיר לתוך החדר · `Height` = גובה-הפנל האנכי. (בחלון/דלת: `Height` = גובה-הפתח, `Depth` = עובי בקיר.)

### 2.4 מיקום (Position) — סמנטיקה מדויקת

| ציר | משמעות | דוגמה מהקורפוס |
|---|---|---|
| `X` | מרחק **לאורך הקיר** מ-`Start` (מ"מ) | Socket X=4025 = 4.025 מ' מתחילת הקיר |
| `Y` | גובה **מרכז-האלמנט** מהרצפה (מ"מ) | Socket Y=1085; דלת Y=0 (על הרצפה) |
| `Z` | היסט-עומק מחוץ-למישור-הקיר (מ"מ) | חלון Z=-100 (שקוע לעובי-הקיר); Can Light Z=1024 (מרחק מהקיר על התקרה); דלת-עם-משקוף Z=-100 |

- אלמנט-קיר רגיל (שקע): רק `X`,`Y` (Z נשמט = 0, על-פני הקיר).
- אלמנט-תקרה (Can Light / ספוט / מפזר): `Y` = לרוב סמוך לראש-הקיר; `Z` = מרחק מהקיר לאורך התקרה.
- פתח (חלון/דלת): `Z=-100` = הפתח יושב בתוך עובי-הקיר (100 מ"מ).

### 2.5 Catalog

מחרוזת-שם-הקטלוג. בקורפוס האמיתי של CV: `InnoDraw`. בקובץ-הדמו של Soline: `אלמנטים למדידה`. הערך אינו נאכף בפרסור; לייצוא מ-Soline השתמש ב-`InnoDraw` לזיהוי מרבי ע"י כלי-היעד, או בשם-קטלוג ייעודי משלך.

### 2.6 Attributes / Parameter — פרמטרים נוספים

`<Attributes>` מכיל `<Parameter>` עם `<Name>`,`<Type>`,`<Value>`. קודי-Type: **`M`** = מידה/מספר, **`S`** = מחרוזת. CV מתעלם מפרמטרים שאינו מכיר — לכן זה הערוץ לשאת מטא-נתוני-Soline (ROTATION, FACE, STATUS, PROTRUSION) בלי לשבור קריאה. השימוש היחיד בקורפוס: פרמטרי-חריץ של הנמכת-תקרה-עם-מזגן (SLOTDX/SLOTDY/SLOTX/SLOTY, ראה §7).

---

## 3. טבלת-על — כל האלמנטים (InnoDraw code · ORDX Class/Type · מפתחות)

מקרא: **קוד** = ID-אייקון של InnoDraw מ-`eLObstaclesIconsCategories`. **קורפוס** = ✔ אם ה-XID אומת בקובץ-ORDX אמיתי. מידות ברירת-מחדל (W×D×H מ"מ) והתקנה (Y) מ-`elements.json`/הקורפוס.

### קטגוריה 2 — Construction (בנייה/מבנה)
| אלמנט | InnoDraw | קוד | ORDX Class/Type | מְכל | W×D×H | Y | קורפוס |
|---|---|---|---|---|---|---|:--:|
| חלון | Window | 0 | Decorative/Window | Furnishings | 1200×100×1200 | מרכז-פתח | ✔ |
| דלת | Door | 22 | Decorative/EntryDoor | Furnishings | 800×0×2100 | 0 | ✔ |
| כניסת ממ"ד | Safety Room Entrance | 14 | Decorative/EntryDoor **[לא ודאי]** | Furnishings | — | 0 | ✗ |
| עמוד מלבני | Rectangular Column | 43 | Decorative/Miscellaneous **[לא ודאי]** | Furnishings | 300×300×גובה-קיר | 0 | ✗ |
| עמוד עגול | Circular Column | 56 | Decorative/Miscellaneous **[לא ודאי]** | Furnishings | Ø200 | 0 | ✗ |
| קורה | Beam | 163 | Decorative/TWall | Furnishings | 200×0×400 | תחת-תקרה | ✔ |
| מדרגות | Stairs | 35 | Decorative/Miscellaneous **[לא ודאי]** | Furnishings | — | 0 | ✗ |

### קטגוריה 3 — Electrical (חשמל)
| אלמנט | InnoDraw | קוד | ORDX Class/Type | W×D×H | Y | קורפוס |
|---|---|---|---|---|---|:--:|
| שקע יחיד | Socket | 1 | Fixture/Miscellaneous | 80×15×80 | 350 | ✔ |
| שקע כפול | Duplex Socket / Duplex Outlets | 45 | Fixture/Miscellaneous | 160×15×80 | 350 | ✔ |
| שקע מוגן-מים | SocketEx | 18 | Fixture/Miscellaneous | 175×70×70 | 350 | ✔ |
| מפסק | Switch | 16 | Fixture/Miscellaneous **[לא ודאי-Type]** | 80×15×80 | 1150 | ✗ |
| מפסק מורחב | SwitchEx | 36 | Fixture/Miscellaneous **[לא ודאי]** | 80×30×80 | 1150 | ✗ |
| קופסת חיבורים | Junction_Box | 120 | Fixture/Miscellaneous | 80×15×80 | משתנה | ✔ |
| קו-מתח / תשתית | Power Line | 11 | Fixture/Miscellaneous | —/20×100×20 | — | ✔ |
| לוח/ק.חשמל | Power Box | 31 | Decorative/Miscellaneous | 400×100×600 | 1700 | ✔(Type) |
| תיבת-בקרה | Control Box | 17 | Fixture/Miscellaneous **[לא ודאי]** | — | — | ✗ |
| ספוט שקוע | Can_Light | 111 | Decorative/Miscellaneous | 100×100×30 | תקרה(Z) | ✔ |
| תאורה | Lighting | 2 | Decorative/Miscellaneous **[לא ודאי]** | — | תקרה | ✗ |
| טלפון | Phone / PhoneEx | 8/26 | Fixture/Miscellaneous **[לא ודאי]** | 80×15×80 | 350 | ✗ |
| TV | TV / DuplexTV | 9/52 | Fixture/Miscellaneous **[לא ודאי]** | 80×15×80 | 350 | ✗ |
| אינטרקום | Intercom | 7 | Fixture/Miscellaneous **[לא ודאי]** | 120×30×180 | 1500 | ✗ |
| פעמון | DoorBell | 49 | Fixture/Miscellaneous **[לא ודאי]** | — | 1300 | ✗ |

> תת-קטלוג-שקעים (מ-`eLObstaclesIconsEn`, רובם `Available=0` — וריאנטים אמריקאיים): Socket(1), Duplex Socket(45), 110V(88), 220V(89), Arc_Fault(90), Ceiling_Outlet(91), Duplex_Outlet_Furnace(92), Duplex_Outlet(93), Exterior_Gfi(94). כולם ממופים ל-`Fixture/Miscellaneous`.

### קטגוריה 4 — Plumbing (אינסטלציה)
| אלמנט | InnoDraw | קוד | ORDX Class/Type | W×D×H | Y | קורפוס |
|---|---|---|---|---|---|:--:|
| ברז | Faucet | 3 | Fixture/Part | 20×20×20 | 550 | ✔ |
| ברז כפול | FaucetX2 | 4 | Fixture/Part **[לא ודאי]** | 40×20×20 | 550 | ✗ |
| מים | Water Pipe / WaterSuply | 12/54 | Fixture/Part ("Water Supply") | 20×20×20 | 550 | ✔ |
| גז | Gas | 5 | Fixture/Part | 20×20×20 | 600 | ✔ |
| ניקוז/ביוב | Sewage | 6 | Fixture/Part | 50×50×50 | 100 | ✔ |
| ניקוז רצפתי | Sewer drainage | 15 | Fixture/Part | 120×0×120 | 0 | ✔ |
| אמבט | Bath | 32 | Fixture/Part **[לא ודאי]** | — | 0 | ✗ |
| בידה | Bidet | 33 | Fixture/Part **[לא ודאי]** | — | 0 | ✗ |
| מקלחת | Shower | 34 | Fixture/Part **[לא ודאי]** | — | 0 | ✗ |
| אסלה | Toilet | 10 | Fixture/Part **[לא ודאי]** | — | 0 | ✗ |
| כיור | Sink | 70 | Fixture/Part **[לא ודאי]** | — | — | ✗ |
| ספרינקלר | Sprinkler | 13 | Fixture/Part **[לא ודאי]** | — | תקרה | ✗ |

### קטגוריה 5 — HVAC (מיזוג/אוורור) — כולם **[לא ודאי]** (אין בקורפוס)
| אלמנט | InnoDraw | קוד | ORDX Class/Type (משוער) | W×D×H |
|---|---|---|---|---|
| מזגן | Air Condition | 27 | Decorative/Miscellaneous | 900×200×300 |
| פתח-אוויר | Air Opening | 25 | Decorative/Miscellaneous | 200×0×200 |
| רדיאטור | Radiator | 28 | Fixture/Miscellaneous | — |
| מפוח | Vent | 37 | Decorative/Miscellaneous | — |
| הנמכת-תקרה עם מזגן | (Soline) | — | Decorative/Miscellaneous **(+SLOT params)** | 800×650×300 | ✔ |

### קטגוריה 6 — Appliances (מוצרי-חשמל) — כולם **[לא ודאי]** (אין בקורפוס)
| אלמנט | InnoDraw | קוד | הערה |
|---|---|---|---|
| מכונת-כביסה | Washer | 140 | סביר Decorative/Miscellaneous או Furnishing/Cabinet |
| מדיח | Dishwasher | 135 | |
| תנור | Oven | 172 | |
| מיקרוגל | Microwave | 152 | |
| כיריים-גז | Gas Range | 151 | |
| כיריים-חשמל | Electric Range | 150 | |
| מקרר | Refrigerator | 136 | |

### קטגוריה 7 — Furniture / Cabinets (ריהוט/ארונות) — **[לא ודאי]** (הקורפוס ה"רזה" אינו מכיל ישות-ארון)
| אלמנט | InnoDraw code | קוד | פענוח-קוד |
|---|---|---|---|
| ארון גנרי | Cabinet | 44 | |
| ארון עליון 1 דלת | Cabinet_CW1D | 173 | **C**abinet **W**all (עליון) **1 D**oor |
| ארון עליון 2 דלת | Cabinet_CW2D | 174 | Cabinet Wall 2 Door |
| ארון גבוה 1 דלת | Cabinet_CT1D | 175 | **C**abinet **T**all **1 D**oor |
| ארון תחתון 1 דלת+מגירה | Cabinet_CB1D-1DR | 176 | **C**abinet **B**ase 1 **D**oor + 1 **DR**awer |
| ארון תחתון 2 דלת+2 מגירה | Cabinet_CB2D-2DR | 177 | Cabinet Base 2 Door + 2 Drawer |
| ארון תחתון 2 דלת | Cabinet_CB2D | 178 | Cabinet Base 2 Door |
| שולחן | Table | 181 | |
| כיסא | Chair | 182 | |

> **סטטוס קידוד-ארונות ב-ORDX:** ה-DEX של CVSM חושף `generateCabinetAssembly` — כלומר CV **כן** פולט ישות-ארון (`CabinetAssembly`) עשירה יותר מהקורפוס שבידינו. **אך אף קובץ בקורפוס שלנו אינו מכיל ארון**, ולכן מבנה-ה-XML המדויק של ארון (תגים, sub-parts, דלתות/מגירות) **לא נקבע** — ראה §11 [לא ודאי].

### קטגוריה 8 — Misc (שונות)
| אלמנט | InnoDraw | קוד | ORDX Class/Type | הערה |
|---|---|---|---|---|
| ארגז-תריס | ShutterBox | 169 | Decorative/Part | ✔ קורפוס |
| אדן-חלון | Window Sill | 168 | Decorative/Part | דפוס כמו ShutterBox |
| בליטה | Bump | 19 | Decorative/Miscellaneous **[לא ודאי]** | סימון-גיאומטריה |
| עומק | Depth | 20 | Decorative/Miscellaneous **[לא ודאי]** | סימון-מדידה |
| מרקר | Marker | 21 | Decorative/Miscellaneous **[לא ודאי]** | קו-סימון/סופיט |
| פאנל-לפאנל | Panel To Panel | 30 | **[לא ודאי]** | מידת-ביניים |
| שמור | Reserved | 38 | — | placeholder |

### קטגוריה 1 — Duplicate (שכפול — פעולות, לא אלמנטים)
Duplicate Offsets (41), Duplicate Heights (42) — פעולות-עריכה, אינן נשמרות כאלמנט ב-ORDX.

---

## 4. חשמל ותקשורת — `Fixture / Miscellaneous`

**חוזה:** `Class=Fixture`, `Type=Miscellaneous`, מידות במוסכמה B (`Width`,`Depth`,`Height` ישירים + `<Size></Size>` ריק). `X`=לאורך-קיר, `Y`=גובה-מרכז, `Z`=נשמט.

**דוגמה אמיתית — שקע כפול (מהקורפוס, `2918`):**
```xml
<Furnishing>
 <Catalog>InnoDraw</Catalog>
 <Properties>
  <General>
   <Name>Duplex Socket</Name>
   <Class>Fixture</Class>
   <Type>Miscellaneous</Type>
   <Width>160</Width>
   <Depth>15</Depth>
   <Height>80</Height>
   <Size>
   </Size>
  </General>
 </Properties>
 <Position>
  <X>4025.000000</X>
  <Y>1085.000000</Y>
 </Position>
</Furnishing>
```

**דוגמה אמיתית — Junction Box (מהקורפוס):** זהה, `Name=Junction Box`, `80×15×80`.
**דוגמה אמיתית — SocketEx (מוגן-מים):** זהה, `Name=SocketEx`, מידות `175×70` (עומק גדול).
**קו-מתח — Power Line:** `Fixture/Miscellaneous`, לרוב ללא מידות מפורשות או `20×100×20` (יציאת-תנור). מייצג תשתית/קו על הקיר.

**שייכים לאותו חוזה (הרחבת-Soline, לא בקורפוס — כולם Fixture/Miscellaneous):** מפסק וכל תת-סוגיו (Single/Double/Triple/Two-Way/Cross/Dimmer/Push Button/Pull-Cord), יציאות-מכשירים (תנור/כיריים/מדיח/מקרר/מיקרו/קולט/מכונת-כביסה/מייבש/דוד/מזגן), תקשורת (RJ45/RJ11/TV-Coax/HDMI/סיב/אינטרקום/ראוטר), בית-חכם ובקרה (בקר/תרמוסטט/גלאי-תנועה/חיישן-פתח/בקר-תריס), בטיחות (גלאי-עשן/גלאי-גז/פעמון), תאורת-קיר (אפליק).

**DXF-3D לכל אלה:** קופסה `Width(לאורך-קיר) × Depth(בליטה-מהקיר) × Height(אנכי)`, מרכזה בנקודה `(X לאורך הקיר, Z_world=Y, offset-מהקיר=Depth/2)`. אלמנטי-תקרה (גלאי/מאוורר) — הנח על מישור-התקרה בגובה `Wall.Height`.

---

## 5. אינסטלציה, גז וניקוז — `Fixture / Part`

**חוזה:** `Class=Fixture`, `Type=Part`, מידות מוסכמה B. נקודות רטובות קטנות (20×20×20) פרט לניקוז (גדול יותר). ניקוז/ביוב נושאים לעיתים `Z` (עומק שקיעה).

**דוגמה אמיתית — Faucet (מהקורפוס, `2918`):**
```xml
<Furnishing>
 <Catalog>InnoDraw</Catalog>
 <Properties>
  <General>
   <Name>Faucet</Name>
   <Class>Fixture</Class>
   <Type>Part</Type>
   <Width>20</Width>
   <Height>20</Height>
   <Size>
   </Size>
  </General>
 </Properties>
 <Position><X>1130.000000</X><Y>519.000000</Y></Position>
</Furnishing>
```

**דוגמה אמיתית — Sewage (עם Z):**
```xml
<General>
 <Name>Sewage</Name><Class>Fixture</Class><Type>Part</Type>
 <Width>50</Width><Depth>50</Depth><Height>50</Height><Size></Size>
</General>
<Position><X>1004.000000</X><Y>-27.000000</Y><Z>66.000000</Z></Position>
```

**דוגמה אמיתית — Gas:** `Name=Gas`, `Type=Part`, `20×20`.
**מהקורפוס גם:** `Water Supply` (Fixture/Part), `Sewer drainage` (Fixture/Part).

**הרחבת-Soline (אותו חוזה Fixture/Part):** מים-קר/חם, מים-למדיח/מכונה/מקרר, ניקוז-מזגן, יציאת-אסלה, מונה-גז, ברז-ניתוק-גז. אמבט/בידה/מקלחת/אסלה/כיור/ספרינקלר — סביר Fixture/Part אך **[לא ודאי]** (לא בקורפוס).

**DXF-3D:** נקודות-נקודתיות = תיבה קטנה על הקיר בגובה `Y`. ניקוז-רצפתי = דיסקה/ריבוע במישור-הרצפה (`Y=0`). `Z` על ניקוז = שקיעה מתחת-לרצפה.

---

## 6. חלונות — `Decorative / Window`

**חוזה:** `Class=Decorative`, `Type=Window`, מידות ב**מוסכמה A** (מקוננות תחת `<Size>` עם `Width`,`Height`,`Depth`). `Depth` = עובי-הפתח בקיר. `Z=-100` = שקוע לעובי-הקיר. `Y` = גובה-אדן/מרכז.

**דוגמה אמיתית (מהקורפוס, `2918`):**
```xml
<Furnishing>
 <Catalog>InnoDraw</Catalog>
 <Properties>
  <General>
   <Name>Window</Name>
   <Class>Decorative</Class>
   <Type>Window</Type>
   <Size>
    <Width>1474.000000</Width>
    <Height>1320.000000</Height>
    <Depth>100.000000</Depth>
   </Size>
  </General>
 </Properties>
 <Position>
  <X>436.000000</X>
  <Y>1070.000000</Y>
  <Z>-100.000000</Z>
 </Position>
</Furnishing>
```

**וריאנטים בקטלוג-InnoDraw:** Window1 (ID 0, ברירת-מחדל), Window2 (170, DoorStyle/RightLeft), Window3 (171, InOut/RightLeft). כולם `Decorative/Window`; ההבדל בסמל-2D/3D בלבד.

**DXF-3D:** חתוך חלל `Width × Height` בעובי-הקיר, בסיסו בגובה `Y`, שקוע `Depth` (או לפי `Z`). אופציונלי: מסגרת/זכוכית כמלבן דק.

---

## 7. דלתות, פתחים ומעברים — `Decorative / EntryDoor`

**חוזה:** `Class=Decorative`, `Type=EntryDoor`. מידות ב**מוסכמה A** (מקוננות; חלק מהמופעים ללא `Depth`). `Y=0` (הפתח יורד לרצפה). `Z=-100` כשיש משקוף שקוע.

**דוגמה אמיתית — מעבר ללא דלת (מהקורפוס-דמו):**
```xml
<Furnishing>
 <Catalog>אלמנטים למדידה</Catalog>
 <Properties>
  <General>
   <Name>מעבר</Name>
   <Description>Passage</Description>
   <Class>Decorative</Class>
   <Type>EntryDoor</Type>
   <Size>
    <Width>900.000000</Width>
    <Height>2100.000000</Height>
   </Size>
  </General>
 </Properties>
 <Position><X>383.703</X><Y>0.000</Y></Position>
</Furnishing>
```

**דוגמה אמיתית — מפתח עם משקוף (Depth + Z):**
```xml
<General>
 <Name>מפתח עם משקוף</Name><Description>Doorway with Frame</Description>
 <Class>Decorative</Class><Type>EntryDoor</Type>
 <Size><Width>800.000000</Width><Height>2050.000000</Height><Depth>100.000000</Depth></Size>
</General>
<Position><X>800.000</X><Y>0.000</Y><Z>-100.000</Z></Position>
```

**וריאנטים שאומתו בקורפוס (כולם Decorative/EntryDoor):** `Door`, `Passage` (מעבר), `Doorway with Frame` (מפתח עם משקוף), `Doorway w/o Frame`, `Hinged Left In Door` (דלת פנימה שמאל). ההבדל = ה-`Name`/`Description` וסמל-הכיווניות (In/Out, Right/Left). **כניסת-ממ"ד (Safety Room Entrance)** — סביר EntryDoor אך **[לא ודאי]**.

**DXF-3D:** חתוך חלל `Width × Height` בקיר, בסיסו ברצפה (`Y=0`). משקוף = מסגרת בעובי `Depth`. דלת = כנף מלבנית עם ציר לפי In/Out + Right/Left.

---

## 8. קורה קונסטרוקטיבית — `Decorative / TWall`

**חוזה:** `Class=Decorative`, `Type=TWall`. קורה החוצה קיר ויורדת מהתקרה. `Height` = עומק-הצניחה מהתקרה; `Width` = רוחב-הקורה לאורך הקיר; `Y` = גובה תחתית-הקורה.

> **דו-משמעות שאותרה בקורפוס:** השם "Beam" מופיע ב-2 קידודים שונים — (א) `Decorative/TWall` (הקורה עצמה), ו-(ב) `Fixture/Miscellaneous` עם תיאור עברי "עמוד" (כלומר סומן כעמוד). **בייצור: קורה אמיתית = `Decorative/TWall`.** מסומן חלקית [לא ודאי] בגלל שני מופעים בלבד.

**דוגמה (מסונתזת לפי הקורפוס — הקידוד TWall אומת, המידות מ-`elements.json`):**
```xml
<Furnishing>
 <Catalog>InnoDraw</Catalog>
 <Properties>
  <General>
   <Name>Beam</Name>
   <Class>Decorative</Class>
   <Type>TWall</Type>
   <Width>200</Width>
   <Depth>0</Depth>
   <Height>400</Height>
   <Size>
   </Size>
  </General>
 </Properties>
 <Position><X>1200.000000</X><Y>2385.000000</Y></Position>
</Furnishing>
```

**DXF-3D:** תיבה `Width(לאורך-קיר) × depth-חוצה-קיר × Height(צניחה)`, תחתיתה בגובה `Y`, ראשה בתקרה.

---

## 9. ארגז-תריס / אדן-חלון — `Decorative / Part`

**חוזה:** `Class=Decorative`, `Type=Part`. מלווים חלון. מידות מוסכמה B.

**דוגמה אמיתית — ShutterBox (מהקורפוס):** `Decorative/Part`, נצפה 2 מופעים.
```xml
<Furnishing>
 <Catalog>InnoDraw</Catalog>
 <Properties>
  <General>
   <Name>ShutterBox</Name>
   <Class>Decorative</Class>
   <Type>Part</Type>
   <Width>2316</Width>
   <Depth>0</Depth>
   <Height>245</Height>
   <Size>
   </Size>
  </General>
 </Properties>
 <Position><X>400.000000</X><Y>2200.000000</Y></Position>
</Furnishing>
```

**Window Sill (אדן-חלון):** אותו חוזה `Decorative/Part`, `Name=WindowSill`, מונח מתחת לחלון (`Y`=גובה-אדן). דפוס אומת דרך export_ordx + ShutterBox.

**DXF-3D:** ArgazTris = תיבה מעל החלון (רוחב-הפתח × עומק-קטן × `Height`). אדן = לוח דק בתחתית-החלון בולט `Depth` לתוך החדר.

---

## 10. תקרה: ספוט / הנמכה-עם-מזגן / מפזר, ולוח-חשמל — `Decorative / Miscellaneous`

**חוזה:** `Class=Decorative`, `Type=Miscellaneous`. אלמנטי-תקרה נושאים `Z` (מרחק מהקיר על-פני התקרה) ו-`Y` גבוה (סמוך לראש-הקיר).

**דוגמה אמיתית — Can Light / ספוט שקוע (מהקורפוס, `2918`):**
```xml
<Furnishing>
 <Catalog>InnoDraw</Catalog>
 <Properties>
  <General>
   <Name>Can Light</Name>
   <Class>Decorative</Class>
   <Type>Miscellaneous</Type>
   <Width>100</Width>
   <Depth>100</Depth>
   <Height>30</Height>
   <Size>
   </Size>
  </General>
 </Properties>
 <Position>
  <X>1514.000000</X>
  <Y>2760.000000</Y>
  <Z>1024.000000</Z>   <!-- מרחק מהקיר על התקרה -->
 </Position>
</Furnishing>
```

**דוגמה אמיתית — הנמכת-תקרה עם מזגן (עם 4 פרמטרי-חריץ, מהקורפוס-דמו):** זה המקום היחיד בקורפוס שמשתמש ב-`<Attributes>`:
```xml
<Furnishing>
 <Catalog>אלמנטים למדידה</Catalog>
 <Properties>
  <General>
   <Name>הנמכת תקרה עם מזגן</Name>
   <Class>Decorative</Class>
   <Type>Miscellaneous</Type>
   <Size><Width>800.000</Width><Height>300.000</Height><Depth>650.000</Depth></Size>
  </General>
  <Attributes>
   <Parameter><Name>SLOTDX</Name><Type>M</Type><Value>700.000</Value></Parameter>  <!-- רוחב חריץ-מזגן -->
   <Parameter><Name>SLOTDY</Name><Type>M</Type><Value>100.000</Value></Parameter>  <!-- עומק חריץ -->
   <Parameter><Name>SLOTX</Name><Type>M</Type><Value>100.000</Value></Parameter>   <!-- היסט X של החריץ -->
   <Parameter><Name>SLOTY</Name><Type>M</Type><Value>100.000</Value></Parameter>   <!-- היסט Y של החריץ -->
  </Attributes>
 </Properties>
 <Position><X>528.094</X><Y>2226.000</Y></Position>
</Furnishing>
```
> שים לב: כאן דווקא נעשה שימוש ב-`<Size>` **מקונן** (מוסכמה A) יחד עם `Decorative/Miscellaneous` — הפרסר סובל את שתי המוסכמות; לעקביות עדיף מוסכמה B, אך זה תקף.

**Water Bar / תמי4 (מהקורפוס-דמו):** `Decorative/Miscellaneous`, `150×40`.
**Power Box / לוח-חשמל (מהקורפוס):** `Class=Decorative`, `Type=Miscellaneous` (או Power Box בשם), `400×100×600`, `Y≈1700`.

**הרחבת-Soline (אותו חוזה):** מפזר-מיזוג (AC Diffuser), מזגן-עילי, רדיאטור, גופי-תאורה תלויים/צמודים, רמקול-תקרה, גלאי-תנועה-בתקרה.

**DXF-3D:** אלמנט-תקרה = לוח/תיבה על מישור-התקרה בגובה `Wall.Height`, במיקום `(X לאורך-קיר, Z מהקיר)`. הנמכה = תיבה `Width×Depth×Height` תלויה מהתקרה, עם חלל-חריץ `SLOTDX×SLOTDY` בהיסט `SLOTX,SLOTY`.

---

## 11. אלמנטים שקידוד-ה-ORDX שלהם לא נקבע — **[לא ודאי]**

| אלמנט | InnoDraw | מה חסר / מה משוער |
|---|---|---|
| **ארונות** (Cabinet, CW1D/CW2D/CT1D/CB1D-1DR/CB2D-2DR/CB2D) | 44,173-178 | הקורפוס ה"רזה" אינו מכיל ישות-ארון. CVSM חושף `generateCabinetAssembly` → קיים מבנה `CabinetAssembly` עשיר (דלתות/מגירות/תת-חלקים) אך **התגים המדויקים לא נצפו**. נדרש: קובץ ORDX אמיתי עם ארונות, או DEX-decompile של `generateCabinetAssembly`. |
| **מוצרי-חשמל** (Oven/Fridge/Microwave/Dishwasher/Washer/Gas Range/Electric Range) | 135,136,140,150-152,172 | לא בקורפוס. משוער `Decorative/Miscellaneous` או ישות-Furnishing/Cabinet. Class/Type לא אומת. |
| **מתקני-אינסטלציה גדולים** (Bath/Bidet/Shower/Toilet/Sink) | 10,32,33,34,70 | לא בקורפוס. משוער `Fixture/Part`, אך ייתכן Decorative עם גיאומטריית-כלי. |
| **HVAC** (Air Condition/Air Opening/Radiator/Vent) | 25,27,28,37 | לא בקורפוס. משוער Decorative/Miscellaneous (או Fixture/Misc לרדיאטור). |
| **עמודים** (Rectangular/Circular Column) | 43,56 | לא בקורפוס. משוער `Decorative/Miscellaneous`; ייתכן מקודדים כ-`TWall` או כמקטע-קיר. |
| **מדרגות** (Stairs) | 35 | לא בקורפוס. `StairsDirection` קיים בתפריט; קידוד-ORDX לא ידוע. |
| **כניסת-ממ"ד** (Safety Room Entrance) | 14 | לא בקורפוס. משוער `Decorative/EntryDoor`. |
| **סימוני-גיאומטריה** (Bump/Depth/Marker/Panel To Panel) | 19,20,21,30 | ייתכן שאינם נשמרים כאלמנט אלא כמטא-מדידה. |
| **בקרים/חיישנים/תקשורת/בטיחות** (הרחבות-Soline מעבר ל-InnoDraw) | — | אין להם קוד-InnoDraw כלל; מסווגים ל-`Fixture/Miscellaneous` לפי החוקן בממיר, אך אינם בקורפוס. |

**כיצד להשלים את החוסרים:** (1) לפתוח ORDX אמיתי שיוצא מ-Cabinet-Vision עם ארונות ומכשירים; (2) לפרק `com/roommeasure/app/export/OrdxExporter.generateCabinetAssembly` מה-DEX; (3) לייצא מ-InnoDraw דמו-חדר עם עמוד/מדרגות/אמבט ולקרוא את ה-XID.

---

## 12. אלגוריתם-בנייה — Soline → ORDX (סיכום מעשי למהנדס)

1. **מסגרת:** פלוט `<?xml…?>` → `<Job>` → `<Unit>mm</Unit>` → אופציונלי `Properties/Job/Information`.
2. **חדרים:** `<Rooms><Room>` לכל חדר; `RoomProperties/Room/General/{Name,Type=Room}`.
3. **קירות:** לכל קיר לפי סדר-היקף — `Number`, `Description`, `Position{StartX,StartY,Angle,EndX,EndY,LeftWallNumber}`, `Type/Style`, `Dimensions{Height,Thick,VaultHeight,…}`. שרשר בעזרת `LeftWallNumber` לסגירת-היקף.
4. **אלמנטים:** לכל אלמנט על הקיר —
   a. קבע `Class`/`Type` מטבלת §3 (Fixture/Part לרטוב+גז, Fixture/Miscellaneous לחשמל/תקשורת, Decorative/Window|EntryDoor|TWall|Part|Miscellaneous לאדריכלי).
   b. בחר מְכל: Decorative→`<Furnishings>`; Fixture→`<Fixtures>` (או הכל ב-Furnishings לתאימות-CV).
   c. פלוט `Catalog`, `Properties/General/{Name,Description,Class,Type}`.
   d. מידות: חלון/דלת → מוסכמה A (`<Size>` מקונן); אחר → מוסכמה B (`Width,Depth,Height` + `<Size></Size>` ריק).
   e. `Position/{X=לאורך-קיר, Y=גובה-מרכז, Z=עומק}`. חלון/דלת שקוע → `Z=-100`. תקרה → `Z`=מרחק-מהקיר, `Y`≈ראש-הקיר.
   f. מטא-Soline (rotation/face/status/protrusion, ופרמטרי-חריץ) → `<Attributes><Parameter Type=M|S>`.
5. **יחידות:** מ"מ. קואורדינטות-קיר float(6); מידות-פריט int (או float(6) אם לא-שלם).

## 13. אלגוריתם-בנייה — Soline → DXF-3D (לכל משפחה)

| משפחה | גיאומטריית-3D |
|---|---|
| Fixture/Miscellaneous (שקע/מפסק/תקשורת) | תיבה `W×D×H` על-פני הקיר, מרכז ב-`Y`, בולטת `D` לחדר |
| Fixture/Part (מים/גז/ניקוז) | תיבה קטנה על הקיר ב-`Y`; ניקוז-רצפתי = דיסקה במישור-רצפה |
| Decorative/Window | חיתוך-חלל `W×H` בעובי-הקיר ב-`Z`, בסיס ב-`Y`; +מסגרת/זכוכית |
| Decorative/EntryDoor | חיתוך-חלל `W×H` מהרצפה (`Y=0`); +משקוף עובי `Depth`; +כנף לפי In/Out·L/R |
| Decorative/TWall (קורה) | תיבה חוצת-קיר, תחתית ב-`Y`, ראש בתקרה |
| Decorative/Part (ארגז-תריס/אדן) | לוח מעל/מתחת לחלון בולט `Depth` |
| Decorative/Miscellaneous (תקרה) | לוח/תיבה על מישור-תקרה (`Z_world=Wall.Height`), במיקום `(X,Z)`; הנמכה = תיבה תלויה + חלל-חריץ SLOT |

---

## נספח — מקורות
- **קטלוג-InnoDraw (גרסה 9505):** `C:\Program Files (x86)\InnoDraw\EL_CAD_9505_0050_0005_0005_ktn\eLObstaclesIconsCategories{En,He}.tx~`, `eLObstaclesIconsEn.tx~`.
- **קורפוס-ORDX אמיתי:** `G:\My Drive\קבצים ללמידת מכונה\ORDX\` — `2918/2916/2854/2726/2725_Ktchn_TRIO_Nir_DR{1,2}.ordx` (יצוא-CV אמיתי), `ORDX SOLINE — חדר דמו (כל האלמנטים)` (דמו-כיסוי-מלא).
- **ממיר-ייחוס (לא מקור-אמת):** `G:\My Drive\claude\ordx-pdp-converter\src\export_ordx.js`, `elements.json` (170 אלמנטים), `parseOrdx.js`.
- **הצלבה:** `ELEMENT_CATALOG_MERGED.md`, `INNODRAW_FEATURES.md`, `CVSM_EXPORT_CRACK.md`, `ORDX_BRIDGE.md`.
- **מנייה:** 5 זוגות Class/Type · **~35** טיפוסי-אלמנט מקוריים ב-InnoDraw · **170** בקטלוג-Soline המורחב · **15** ממופים לקורפוס-ORDX אמיתי (בוודאות מלאה) · יתר האלמנטים מסווגים לפי החוקן, ואלה שאינם ודאיים מסומנים **[לא ודאי]** ב-§11.
</content>
</invoke>
