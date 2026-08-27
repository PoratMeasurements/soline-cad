# CVSM_SCHEMA_VALIDATION — הצלבה תוכניתית של CVSM_ELEMENT_SCHEMA מול הקורפוס האמיתי

> **מטרה:** מעבר־אימות **שני** (אדוורסרי, תוכניתי) על `CVSM_ELEMENT_SCHEMA.md` — המפרט שנגזר מדִה־קומפילציה של אפליקציית **CVSM 5.6.0** (`OrdxExporter` + מחלקות־המודל). כל טענת־ORDX קונקרטית מוצלבת מול קורפוס ORDX אמיתי; מטרתי **לתפוס** טענות מנוחשות/שגויות, לא לאשר אוטומטית.
>
> **תאריך:** 2026-08-18 · עברית · לשון זכר · שמות תגים/enum — מילולית.
> **שיטה:** אותו hARNESS חסר־תלויות מהמעבר הראשון (`scratchpad/validate_ordx.js` + `inventory.json`, XML-parser של הממיר), הורחב ב־probes ממוקדים ל־CVSM (`<Assembly>`, `WEB-App`, CabinetClass, appliance-encoding). **קריאה־בלבד** על כל הקבצים ועל שני המפרטים.
> **קורפוס שנותח:** **274 קבצי `.ordx`** (251 real + 23 converter-generated) תחת `G:\My Drive` — כולל `קבצים ללמידת מכונה` ו־`ordx-pdp-converter`. 0 שגיאות־parse.

---

## ⚠️ 0. TL;DR — הטענה החשובה ביותר שהקורפוס אינו תומך בה

> ### 🔴 ארונות **אינם** מסודרים כ־`<Assembly>`. בקורפוס ארון = `<Furnishing>` · `Class=Base` · `Type=Standard`.
>
> ה־CVSM_ELEMENT_SCHEMA (§5, §0) קובע שארונות נכתבים כישות `<Assembly>` עם מבנה `Shape/Sections/Section/Face/Split/Door/Hinge/Construction/Case/Hardware/Toe`. **בכל 274 הקבצים יש 0 מופעים של `<Assembly>`, `<Assemblies>`, `<Sections>`, `<Section …>`, `<Face>`, `<Split>`, `<ToeHeight>`.** לעומת זאת, ארון אמיתי בקורפוס מקודד כ־Furnishing רגיל (ראה §3). זו הסתירה החמורה ביותר — כל §5 של המפרט (Assembly/CabinetType/CabinetClass) הוא **[recon] לא־נתמך** מול הקורפוס.

---

## 1. הבהרת־תחום קריטית: הקורפוס אינו פלט של CVSM 5.6

לפני הפסקים — חובה להבחין בין שני סוגי־טענות ב־CVSM_ELEMENT_SCHEMA:

1. **טענות־ORDX (vocabulary + מבנה):** אילו ערכי `Class`/`Type`, אילו תגים, איזה קינון. אלה **נבדקים** מול הקורפוס, כי CVSM אמור לכתוב לאותה סכימת־ORDX שהקורפוס מדגים.
2. **טענות־[dex] פנימיות ל־CVSM:** שמות ה־enum (`AccessoryType`/`CabinetType`), `<Catalog>WEB-App`, טבלאות `getOrdxClass/Type/Name`, מקדמי־ברירת־מחדל. אלה **NOT-TESTABLE במהותן** — הקורפוס מורכב מפלט **InnoDraw** (2640 מופעי־Catalog), **אלמנטים למדידה** (50), **Soline** (9) — **ולא מ־CVSM**. אף קובץ בקורפוס אינו נושא `<Catalog>WEB-App`.

> **מסקנה מתודית:** אין בכוח הקורפוס לאשר ש"CVSM כותב X"; יש בכוחו (א) לאשר שהאוצר־מילים של X חוקי ב־ORDX ומופיע בפועל, או (ב) לסתור את X כשהקורפוס מדגים מוסכמה אחרת לאותו אלמנט. הפסקים למטה מנוסחים בהתאם.

---

## 2. טבלת־פסק לכל טענה קונקרטית

מקרא: **CONFIRMED** — הקורפוס מדגים בדיוק זאת (עם ספירה) · **CONTRADICTED** — הקורפוס מדגים ערך אחר (נותן בפועל מול נטען) · **UNSUPPORTED** — נטען, 0 מופעים בכל הקורפוס · **NOT-TESTABLE** — אין קובץ שמפעיל זאת (או טענה פנימית ל־CVSM שהקורפוס לא נוגע בה).

### 2.1 שלד ומבנה (§1–§2)

| # | טענת CVSM_ELEMENT_SCHEMA | § | פסק | ראיה |
|--:|---|---|---|---|
| 1 | היררכיה `Job→Rooms→Room→Walls→Wall→{Fixtures,Furnishings}` | 1 | **CONFIRMED** | מפת־קינון מדויקת ב־251 קבצי־אמת |
| 2 | ענף `<Assemblies>` תחת `<Wall>` | 1 | **UNSUPPORTED** | 0 מופעים של `Assemblies`/`Assembly` בכל 274 |
| 3 | `Job Created="dd/MM/yyyy HH:mm:ss"` | 1 | **CONFIRMED** | `attr Job[Created]`; פורמט תואם |
| 4 | `<ProductVersion>2025</ProductVersion>` | 1 | **CONFIRMED (חלקי)** | `2025`×6, אך גם `CV 2023`,`2023`,`Soline Measure 1.0.0` — לא ערך יחיד |
| 5 | `<Unit>mm</Unit>` תמיד | 1 | **CONFIRMED** | 274/274 |
| 6 | Wall: `Number,Description,Position{StartX,StartY,Angle,EndX,EndY,LeftWallNumber},Type/Style,Dimensions{Length,Height,Soffit,Thick,VaultHeight}` | 2 | **CONFIRMED** | כל התגים קיימים (LeftWallNumber:64, Soffit:84, VaultHeight:1161) |
| 7 | `Dimensions/VaultPosition` | 2.2 | **UNSUPPORTED** | 0 מופעים של `VaultPosition` |
| 8 | `<Curve>` (BeginAngle/EndAngle/Radius/ArcAngle) — קיר־קשת | 2 | **UNSUPPORTED** | 0 מופעים של `Curve` |
| 9 | `WallTopStyle → Style ∈ {Standard, Peninsula, Cathedral, VaultLeft, VaultRight}` | 2.3 | **CONTRADICTED** | בפועל רק `Standard`(1171),`VaultRight`(22),`VaultLeft`(22). **`Peninsula`=0, `Cathedral`=0** (מופיעים רק בתוך הערת־`<!-- -->`) |
| 10 | `Soffit` ברירת־מחדל `20.000`, `Thick` `100.000` | 2.2 | **NOT-TESTABLE** | ערכי־ברירת־מחדל של CVSM; הקורפוס מכיל ערכים אמיתיים משתנים, לא מדגים את ה־default של CVSM |
| 11 | `<Catalog>WEB-App</Catalog>` בכל ישות [dex] | 0,3,6 | **UNSUPPORTED** | 0 מופעים של `WEB-App`. הקורפוס: `InnoDraw`,`אלמנטים למדידה`,`Soline`,`Furnishing`. (טענה פנימית ל־CVSM — הקורפוס לא סותר שזה מה ש־CVSM כותב, אך גם אינו מאשר.) |

### 2.2 Fixture — נקודת חשמל/אינסטלציה (§3, §0)

| # | טענת CVSM | פסק | ראיה |
|--:|---|---|---|
| 12 | חשמל/רשת/גלאי/שקע → `Fixture · Class=Fixture · Type=Miscellaneous` | **CONFIRMED** | `Fixture\|Miscellaneous`:1304. Socket:532, Duplex Socket:160, Power Line:189, Switch:106, Junction Box:151, TV:10, Phone:12 |
| 13 | אינסטלציה/גז (מים/גז/ברז/ביוב/ניקוז) → `Fixture · Class=Fixture · Type=Part` | **CONFIRMED** | `Fixture\|Part`:423. Faucet:190, Sewage:107, Sewer drainage:45, Gas:37, Water Supply:23, Toilet:5, Shower:6, Sprinkler:6 |
| 14 | `Position.X`=מרחק־לאורך, `Position.Y`=גובה | **CONFIRMED (מבנית)** | X:2725, Y:2725 non-empty; ערכים עקביים |
| 15 | `<Size>` אופציונלי (רק אם שונה) | **CONFIRMED** | שקעים/אינסטלציה 100% direct-dims; `Size` ריק נוכח |
| 16 | `SOCKET_SINGLE`(שקע בודד/Socket) → Fixture/Misc | **CONFIRMED** | Socket:532 + שקע בודד:6, שניהם Fixture/Misc |
| 17 | `WATER_PIPE`(Water Supply/מים) → Fixture/Part | **CONFIRMED** | Water Supply:23 Fixture/Part (הערה: דמו־`מים`:4 תויג בטעות Fixture/Misc) |
| 18 | `GAS_PIPE`(Gas/גז) → Fixture/Part | **CONFIRMED** | Gas:37, גז:4 — Fixture/Part |
| 19 | `SPEAKER` → Fixture/Misc [recon] | **NOT-TESTABLE** | אין `Speaker`/רמקול בקורפוס |
| 20 | `NETWORK_POINT` → Fixture/Misc | **NOT-TESTABLE** | אין `Network`/נק׳־רשת בשם זה (Phone/TV קיימים כ־Fixture/Misc) |
| 21 | `SMOKE_DETECTOR` → Fixture/Misc | **NOT-TESTABLE** | אין גלאי־עשן בקורפוס |
| 22 | `WATER_HEATER` → Fixture/Part [לא ודאי] | **NOT-TESTABLE** | אין דוד־מים בקורפוס |
| 23 | `FLOOR_DRAIN` → Fixture/Part [recon] | **CONFIRMED (כלל) / NOT-TESTABLE (שם)** | אין `Floor Drain` בשם זה, אך Sewer drainage/Sewage = Fixture/Part מאשרים את הכלל |

### 2.3 Furnishing — פתח/מכשיר/מבני (§4, §0)

| # | טענת CVSM | פסק | ראיה |
|--:|---|---|---|
| 24 | פתחים → `Furnishing · Class=Decorative · Type∈{Window,EntryDoor,Miscellaneous}` | **CONFIRMED** | Decorative/Window:176, Decorative/EntryDoor:156, Decorative/Miscellaneous:363 |
| 25 | `WINDOW` → Decorative/Window | **CONFIRMED** | Window:166, חלון:6, WS2S22:4 — Decorative/Window |
| 26 | `ENTRY_DOOR`(מעבר) → Decorative/EntryDoor | **CONFIRMED** | מעבר:4, Doorway w/o Frame:74 — Decorative/EntryDoor |
| 27 | `DOORWAY_WITH_FRAME`(מפתח עם משקוף) → Decorative/EntryDoor + Depth + `Z=-100` | **CONFIRMED** | Doorway with Frame:16, מפתח עם משקוף:4 — Decorative/EntryDoor; EntryDoor `Z=-100` מאומת |
| 28 | 4 צירופי `DOOR_HINGED_{LEFT/RIGHT}_{IN/OUT}` → Decorative/EntryDoor | **CONFIRMED** | Hinged Left In:16, Right In:18, Left Out:10, Right Out:10 — כל 4 קיימים, Decorative/EntryDoor |
| 29 | `CEILING_LIGHT`(Can Light) → Decorative/Miscellaneous | **CONFIRMED** | Can Light:164 Decorative/Misc |
| 30 | `WATER_BAR`(תמי4) → Decorative/Miscellaneous | **CONFIRMED** | תמי4:4 Decorative/Misc |
| 31 | הנמכת־תקרה עם מזגן → Decorative/Miscellaneous + `SLOTDX/DY/X/Y` (Type=M) | **CONFIRMED** | הנמכת תקרה עם מזגן:6 Decorative/Misc; 4 פרמטרי־SLOT, Type=`M` |
| 32 | `AIR_CONDITION` (מזגן עצמאי) → **Decorative**/Miscellaneous | **CONTRADICTED** | `Air Condition`:5 = **`Accessory\|Miscellaneous`** — Class=`Accessory`, לא `Decorative` (ראה §4) |
| 33 | מכשירי־חשמל `REFRIGERATOR/OVEN/MICROWAVE/DISHWASHER/DISHWASHER_45/WASHING_MACHINE/BUILT_IN` → **Decorative**/Miscellaneous [recon] | **CONTRADICTED (כלל) / NOT-TESTABLE (שמות)** | השמות עצמם — 0 מופעים. אך המכשיר האמיתי היחיד (`Radiator`) = **`Appliance\|DishWasher`** → הכלל "מכשיר=Decorative" מופרך; קיים Class=`Appliance` שהמפרט אינו מכיר (ראה §4) |
| 34 | `SINK` → Decorative/Miscellaneous [לא ודאי] | **NOT-TESTABLE** | Sink — 0 מופעים |
| 35 | `FALSE_FRONT` / `SIDE_RAIL` → Decorative/Misc [recon] | **NOT-TESTABLE** | 0 מופעים |
| 36 | `WALL_SHAPE` → `<Assembly>`(Shape=WallShape) | **UNSUPPORTED** | 0 מופעי Assembly |
| 37 | swing מקודד רק ב־Description (אין תג ייעודי) [לא ודאי] | **CONFIRMED (שלילית)** | אין תג swing ב־Furnishing בקורפוס — תואם את הודאת המפרט |

### 2.4 Cabinet / Assembly (§5) — כל הסעיף

| # | טענת CVSM | פסק | ראיה |
|--:|---|---|---|
| 38 | ארון → ישות `<Assembly>` (Class=Assembly) | **CONTRADICTED** | ארון בקורפוס = `<Furnishing>` · `Class=Base` · `Type=Standard`. 0 מופעי `<Assembly>` |
| 39 | מבנה `<Shape>/<Sections>/<Section Side Type>/<Face>/<Split>/<Door>/<Hinge>` | **UNSUPPORTED** | 0 מופעים לכל תג מהרשימה |
| 40 | `<Construction>/<Case>/<Hardware>/<Toe>/<ToeHeight>/<FrontRecess>/…` | **UNSUPPORTED** | 0 מופעים |
| 41 | `<Cabinet>32mm</Cabinet>`, `<Bottom>/<Top>` בתוך General של ארון | **UNSUPPORTED** | `<Cabinet>` קיים (4×) אך **ברמת־חדר** (`RoomProperties/Cabinet`, ריק) — לא תג־בנייה בארון |
| 42 | `CabinetClass ∈ {BASE, WALL, TALL, ISLAND, OTHER}` | **CONTRADICTED/UNSUPPORTED** | כ־ערך־`Class`: רק `Base`(3). `Wall`/`Tall`/`Island`/`Other` = 0. (וגם `Base` פה הוא Class של Furnishing, לא קיבוץ־Assembly) |
| 43 | `CabinetType` — 19 members עם Class/Type לפי catalog | **UNSUPPORTED** | הקורפוס: שם יחיד `Cabinet`, זוג יחיד `Base/Standard`. אף אחד מ־19 השמות (Base Cabinet, Wall Left Door, Tall Pantry…) לא מופיע |
| 44 | `<Catalog>WEB-App` על Assembly | **UNSUPPORTED** | ראה #11; ובנוסף הארון האמיתי נושא `<Catalog>InnoDraw` |
| 45 | `FaceType ∈ {Door,Drawer,Panel,Pair,FalseFront,Open}` | **NOT-TESTABLE** | אין `<Face>` בקורפוס; enum פנימי ל־CVSM |
| 46 | `HingeSide`, `CornerCabinetShape`, `CabinetTypeDefaults` (מידות) | **NOT-TESTABLE** | פנימי ל־CVSM; המפרט עצמו מסמן [לא ודאי] |

---

## 3. 🔍 יישוב הסתירה: Assembly מול Base/Standard — עם XML אמיתי

**שני המפרטים חלוקים:** CVSM_ELEMENT_SCHEMA אומר ארון = `<Assembly>`; ORDX_SPEC_VALIDATION (המעבר הראשון) מצא ארון = `Base/Standard`. **הקורפוס מכריע חד־משמעית לטובת `Base/Standard`.**

**ספירות מהקורפוס (274 קבצים):**
- `<Assembly>` / `<Assemblies>` / `<Section …>` / `<Face>` / `<Sections>` / `<ToeHeight>` → **0 מופעים כל אחד.**
- `Class=Base` + `Type=Standard` (שם `Cabinet`) → **3 מופעים**, כולם תחת `<Furnishings><Furnishing>`.

**ה־XML האמיתי** (`G:\My Drive\לקוחות\פרטיים\test-7\test-7_Bath_TEST_1_DR1.ordx`, שורה 31):

```xml
<Furnishings>
 <Furnishing>
  <Catalog>InnoDraw</Catalog>
  <Properties>
   <General>
    <Name>Cabinet</Name>
    <Class>Base</Class>
    <Type>Standard</Type>
    <Size>
     <Width>5030.000000</Width>
     <Height>600.000000</Height>
     <Depth>600.000000</Depth>
    </Size>
   </General>
  </Properties>
  <Position><X>0.000000</X><Y>1600.000000</Y><Z>0.000000</Z></Position>
 </Furnishing>
</Furnishings>
```

> **הכרעה:** בקורפוס ארון הוא **Furnishing פשוט** — `Class=Base`, `Type=Standard`, `Catalog=InnoDraw`, מידות nested ב־`<Size>`, `Position/X,Y,Z`. **אין Sections, אין Faces, אין Assembly.** מבנה ה־Assembly של CVSM §5 **אינו מיוצג בשום קובץ**.
>
> **סייג הוגן ל־CVSM:** המפרט **מודה במפורש** (§5, §7) שהקורפוס נטול־ארונות ושכל §5 שוחזר ממחרוזות ה־dex ([recon]). לכן זו אינה "טענה מנוחשת בשקט". אבל למטרת בניית **Soline→ORDX** — הפורמט הבטוח והמאומת הוא `Furnishing/Base/Standard`, **לא** `<Assembly>`. ייתכן ש־CVSM 5.6 אכן פולט `<Assembly>` (יכולת חדשה שלא בקורפוס ההיסטורי), אך **אין לכך ראיה**, ומייבא־ORDX שמצפה ל־Base/Standard לא יזהה Assembly.

---

## 4. 🔍 יישוב סתירת המכשירים: Decorative מול Appliance/Accessory — עם XML אמיתי

CVSM_ELEMENT_SCHEMA (§0) ממפה מכשירי־חשמל ומזגן ל־**`Decorative/Miscellaneous`**. הקורפוס מדגים **שני Class-ים שהמפרט כלל אינו מכיר**:

**מזגן — `Air Condition`** (`dafna-tevet_Kitchen…ordx`, שורה 507): `Class=Accessory` / `Type=Miscellaneous` — לא Decorative.
```xml
<Furnishing><Catalog>InnoDraw</Catalog><Properties><General>
 <Name>Air Condition</Name>
 <Class>Accessory</Class><Type>Miscellaneous</Type>
 <Size><Width>1043.67</Width><Height>262.72</Height><Depth>173.94</Depth></Size>
</General></Properties><Position><X>-205</X><Y>2291.08</Y><Z>392.00</Z></Position></Furnishing>
```

**מכשיר — `Radiator`** (`noga-n3_Room1…ordx`, שורה 51): `Class=Appliance` / `Type=DishWasher` — לא Decorative, וזוג Class/Type שהטקסונומיה של המפרט חסרה לגמרי.
```xml
<Furnishing><Catalog>InnoDraw</Catalog><Properties><General>
 <Name>Radiator</Name>
 <Class>Appliance</Class><Type>DishWasher</Type>
 <Size><Width>860</Width><Height>775</Height><Depth>250</Depth></Size>
</General></Properties><Position><X>1824</X><Y>723</Y><Z>0</Z></Position></Furnishing>
```

> **הכרעה:** מכשירי־חשמל ומזגן **אינם** בהכרח `Decorative`. הקורפוס מדגים `Accessory\|Miscellaneous` (מזגן, 5×) ו־`Appliance\|DishWasher` (Radiator, 2×). **מיפוי CVSM "מכשיר→Decorative/Misc" הוא CONTRADICTED.** נקודת־דיוק: ה**וריאנט של הנמכת־תקרה עם מזגן** (עם SLOT-params) כן = `Decorative/Miscellaneous` (6×, מאומת) — כך שהמפרט צודק לגבי אלמנט־ההנמכה, ושוגה לגבי המזגן העצמאי.

---

## 5. ⚠️ FLAGGED — לא נתמך ע״י הקורפוס

**כל שורה כאן = UNSUPPORTED או CONTRADICTED. אין לבנות עליה Soline→ORDX בלי אימות נוסף מול קוד ה־dex.**

### UNSUPPORTED (נטען, 0 מופעים בכל 274 הקבצים)
1. **כל מבנה ה־`<Assembly>` (§5):** `Assemblies, Assembly, Shape, Sections, Section, Face, Face1/2, Split, Door, Hinge, Construction, Case, Hardware, Toe, ToeHeight, FrontRecess/LeftRecess/RightRecess, Cabinet(32mm)/Bottom/Top` — **0 מופעים לכל אחד.**
2. **`CabinetType` (19 members)** ו־**`CabinetClass` WALL/TALL/ISLAND/OTHER** — לא מיוצגים; קיים רק `Base`.
3. **`<Catalog>WEB-App`** — 0 מופעים (הקורפוס: InnoDraw/אלמנטים למדידה/Soline).
4. **`Wall/Dimensions/VaultPosition`** — 0 מופעים.
5. **`<Curve>`** (קיר־קשת) — 0 מופעים.
6. **`WallTopStyle = Peninsula`** ו־**`Cathedral`** — 0 מופעים (רק בהערת־`<!-- -->`).

### CONTRADICTED (הקורפוס מדגים ערך אחר)
7. **ארון = `<Assembly>`** → בפועל `Furnishing/Base/Standard` (§3).
8. **מזגן `AIR_CONDITION` = Decorative/Misc** → בפועל `Accessory/Miscellaneous` (§4).
9. **מכשירי־חשמל = Decorative/Misc** → הראיה היחידה (`Radiator`) = `Appliance/DishWasher`; קיים Class=`Appliance` שהמפרט חסר (§4).
10. **`WallTopStyle` בן 5 ערכים** → בפועל 3 בלבד (Standard/VaultLeft/VaultRight).
11. **`ProductVersion` = 2025 (יחיד)** → מרובה־ערכים בקורפוס.
12. **הטקסונומיה של §0 (Fixture/Decorative בלבד)** → הקורפוס מוסיף 3 Class-ים: **`Accessory`, `Base`, `Appliance`** — שאף לא אחד מהם מופיע במפת־העל של CVSM_ELEMENT_SCHEMA §0.

### NOT-TESTABLE (אין קובץ שמפעיל; אל תנחש Class/Type בביטחון)
`SPEAKER, NETWORK_POINT, SMOKE_DETECTOR, WATER_HEATER, SINK, FALSE_FRONT, SIDE_RAIL`, שמות המכשירים (`Refrigerator/Oven/Microwave/Dishwasher/Washing Machine/Built-in`), כל enum פנימי (`FaceType, HingeSide, CornerCabinetShape`), וכל מקדמי־ברירת־המחדל (`CabinetDefaults/CabinetTypeDefaults` + ברירות־Soffit/Thick). המפרט צודק שאין ראיה — אך יש לסמנם NOT-TESTABLE ולא לקבע Class/Type.

---

## 6. רקונסיליאציה: CVSM_ELEMENT_SCHEMA מול ORDX_ELEMENT_SPEC — מי צודק?

| נושא | CVSM_ELEMENT_SCHEMA | ORDX_ELEMENT_SPEC (מעבר 1) | הקורפוס תומך ב־ |
|---|---|---|---|
| **ארון** | `<Assembly>` + Sections/Faces | `Base/Standard` (Furnishing) | **ORDX_ELEMENT_SPEC** ✅ (Base/Standard, 3×; Assembly 0×) |
| **מזגן** | Decorative/Misc | Accessory/Misc | **ORDX_ELEMENT_SPEC** ✅ (Accessory, 5×) |
| **מכשיר** | Decorative/Misc | Appliance/DishWasher | **ORDX_ELEMENT_SPEC** ✅ (Appliance, 2×) |
| **Class חשמל** | Fixture/Miscellaneous | Fixture/Miscellaneous | **שניהם** ✅ (1304×) |
| **Class אינסטלציה** | Fixture/Part | Fixture/Part | **שניהם** ✅ (423×) |
| **חלון/דלת** | Decorative/Window · EntryDoor | Decorative/Window · EntryDoor | **שניהם** ✅ |
| **Peninsula/Cathedral** | קיימים (WallTopStyle) | סומן CONTRADICTED | **אף אחד** (0×) — CVSM שוגה, המעבר הראשון צדק |
| **Catalog** | `WEB-App` | InnoDraw/אלמנטים למדידה | **ORDX_ELEMENT_SPEC** (WEB-App 0×) |
| **SLOT-params למזגן־תקרה** | Decorative/Misc + SLOT | (זהה) | **שניהם** ✅ (6×) |

> **דפוס:** בכל מקום שבו שני המפרטים חלוקים על **קידוד־ORDX** — הקורפוס תומך ב־**ORDX_ELEMENT_SPEC** (מעבר 1), לא ב־CVSM_ELEMENT_SCHEMA. הסיבה מבנית: ORDX_ELEMENT_SPEC נגזר מהצלבת־קורפוס; CVSM_ELEMENT_SCHEMA נגזר מ־dex ומכיל שכבת־[recon] שלמה (§5) + הכללות ([Decorative למכשירים]) שהקורפוס סותר. **מנגד**, CVSM_ELEMENT_SCHEMA עשיר יותר ומדויק במקומות שהקורפוס אינו מגיע אליהם: פורמט־תאריך, מבנה־Job מלא, ה־enum הפנימי, ולוגיקת סדר־הקירות — אלה [dex] תקפים שאין לקורפוס מה לומר עליהם.

---

## 7. שורה־תחתונה — כמה אפשר לסמוך על `CVSM_ELEMENT_SCHEMA.md`

**השלד־ORDX מצוין; שכבת־ה־[recon]/[dex] של הישויות המורכבות מסוכנת לשימוש ישיר.**

✅ **אמין ומאומת מול 251 קבצי־אמת:** ההיררכיה, שדות־הקיר, `Fixture/Miscellaneous` לחשמל, `Fixture/Part` לאינסטלציה+גז, `Decorative/Window`+`EntryDoor` לפתחים (כולל 4 צירופי־swing ו־`Z=-100`), `Can Light`+`תמי4`+`הנמכת־תקרה` כ־Decorative/Misc, ופרמטרי־SLOT (Type=M). לאלה — בנֵה מהמפרט בביטחון.

🔴 **אל תבנה מהמפרט בלי אימות־dex נוסף:**
1. **§5 כולו (Assembly/CabinetType/CabinetClass)** — הקורפוס מדגים `Furnishing/Base/Standard`, לא Assembly. השתמש ב־Base/Standard לפלט Soline→ORDX עד שיוכח אחרת.
2. **מיפוי "מכשיר→Decorative"** — שגוי; המציאות `Appliance/*` ו־`Accessory/*` (Class-ים שהמפרט חסר).
3. **`WEB-App`, `Peninsula`, `Cathedral`, `VaultPosition`, `Curve`** — לא נצפו; אל תפלוט אותם בלי צורך.

**רמת־ביטחון כוללת:** למשפחות־הליבה (חשמל/אינסטלציה/פתחים) — **גבוהה**. לארונות ולמכשירים — **נמוכה**; המפרט עצמו מסמן זאת [recon]/[לא ודאי], והקורפוס מאשר שהחשד מוצדק. **הטענה היחידה שהכי חשוב לתקן: ארונות אינם `<Assembly>` — הם `Furnishing/Base/Standard`.**

---

### נספח — קבצי־מפתח בקורפוס
- ארון (`Base/Standard`): `G:\My Drive\לקוחות\פרטיים\test-7\test-7_Bath_TEST_1_DR1.ordx`
- מזגן (`Accessory/Miscellaneous`): `G:\My Drive\לקוחות\תקיות צד לקוח\טבת הנגרייה\דפנה ורוזה\dafna-tevet_Kitchen_Teveth_Roni_D.ordx`
- Radiator (`Appliance/DishWasher`): `G:\My Drive\לקוחות\תקיות צד לקוח\אדור קונספט\פרוייקט נוף הגליל - בראל\נ3\noga-n3_Room1_ADORE-CONCEPT_Hen_DR1.ordx`
- harness + inventory: `scratchpad\validate_ordx.js`, `scratchpad\inventory.json`

**ספירת־פסקים:** CONFIRMED ≈ 20 · CONTRADICTED = 6 · UNSUPPORTED = 11 · NOT-TESTABLE ≈ 15.
