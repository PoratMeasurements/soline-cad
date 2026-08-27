# ORDX_SPEC_VALIDATION — הצלבה תוכניתית של ORDX_ELEMENT_SPEC מול הקורפוס האמיתי

> **מטרה:** אימות אדוורסרי, תוכניתי (parse בפועל, לא "בעין") של **כל** טענה קונקרטית ב-`ORDX_ELEMENT_SPEC.md` מול קורפוס ה-ORDX האמיתי שנמצא ב-Google Drive. התפקיד הוא **לתפוס** טענות מנוחשות/שגויות/בלתי-נתמכות — לא לאשר אוטומטית.
>
> **תאריך:** 2026-08-18 · עברית · לשון זכר · שמות תגים/קודים — מילולית.
> **שיטה:** סקריפט Node חד-פעמי (`scratchpad/validate_ordx.js`) שהשתמש ב-XML-parser חסר-התלויות של הממיר (`ordx-pdp-converter/src/xml.js`), הלך על כל `**/*.ordx` תחת `G:\My Drive`, זיהה קידוד (UTF-8/UTF-16), ואסף: קבוצת כל התגים, מאפיינים-לכל-תג, זוגות `Class`/`Type` נבדלים, מפת-קינון (parent→child), שמות-פריטים, ערכי-Catalog/Style/Unit, ומוסכמות-מידה (direct מול nested `<Size>`) — עם ספירות. **קריאה-בלבד** על כל הקבצים ועל המפרט.

---

## 0. קבצים שנותחו

נמצאו ונותחו **274 קבצי `.ordx`** (0 שגיאות-parse; כולם UTF-8 בפועל). פילוח:

| קבוצה | קבצים | הערה |
|---|---|:--|
| `real` (יצוא CV/InnoDraw אמיתי, כולל לקוחות) | **251** | קורפוס-אמת בלתי-תלוי — כולל את קורפוס-הלימוד וכ-240 קבצי-לקוחות אמיתיים |
| `converter_generated` (round-trip מהממיר) | 23 | תחת `ordx-pdp-converter/**/out` — **לא** נספר כראיה בלתי-תלויה |

### הקורפוס שהמפרט מצטט במפורש (`G:\My Drive\קבצים ללמידת מכונה\`)

| קובץ | קידוד | תגי-XML |
|---|---|--:|
| `ORDX\2918_Ktchn_TRIO_Nir_DR1.ordx` | utf8 | 435 |
| `ORDX\2916_Ktchn_TRIO_Nir_DR1.ordx` | utf8 | 549 |
| `ORDX\2854_Ktchn_TRIO_Nir_DR1.ordx` | utf8 | 381 |
| `ORDX\2726_Ktchn_TRIO_Nir_DR1.ordx` | utf8 | 481 |
| `ORDX\2725_Ktchn_TRIO_Nir_DR1.ordx` | utf8 | 516 |
| `ORDX\2918_Ktchn_TRIO_Nir_DR2.ordx` | utf8 | 421 |
| `ORDX\בדיקה.ordx` | utf8 | 86 |
| `סטים\mimran-1..9_..._DR1.ordx` (9 קבצים) | utf8 | 120–463 |

> **אי-דיוק מדידה במפרט:** המפרט (§0, נספח) אומר *"`…\ORDX` (9 קבצים, 296 מופעי-אלמנט)"*. בפועל תיקיית `ORDX` מכילה **7** קבצים (6 TRIO + `בדיקה.ordx`), לא 9; ובנוסף קיימת תיקיית `סטים` (9 קבצי mimran) שהמפרט אינו מזכיר. **הקורפוס האמיתי גדול פי כמה** מ-9 הקבצים — כ-251 קבצי-אמת. חלק ניכר מהערות ה-**[לא ודאי]** במפרט נובע מכך שהמחבר דגם רק 7–9 קבצים בעוד שהתשובה שכבה כל הזמן בקבצי-הלקוחות שב-Drive.

---

## 1. אינוונטר-הקורפוס (מה **באמת** יש)

### 1.1 כל התגים (71 נבדלים) — עם ספירת-מופעים
```
Type:3965  Position:3962  Height:3961  Name:2775  General:2739  Properties:2738
X:2725  Y:2725  Catalog:2724  Width:2724  Size:2724  Class:2722  Furnishing:2656
Depth:2262  Description:1467  Wall:1237  Number:1237  StartX:1237  StartY:1237
Angle:1237  Dimensions:1237  Thick:1237  Style:1215  EndX:1183  EndY:1183
VaultHeight:1161  Z:1020  Furnishings:652  Room:361  Walls:342  Job:302  Unit:274
Rooms:274  Length:106  x:104  y:104  Soffit:84  Fixture:68  LeftWallNumber:64
entity:53  end:52  begin:52  Fixtures:41  Parameter:20  Value:16  RoomProperties:15
ProductVersion:14  Information:14  Attributes:13  Comment:9  Address1..Contact:8
Customer:5  ShipTo:4  Perspective:4  Parameters:4  Cabinet:4  Closets:4
Floors:1  Floor:1  Shape:1  template:1  geometry:1
```

### 1.2 מפת-קינון (parent → children)
```
Job          -> Attributes, Description, Information, Name, ProductVersion, Properties, Rooms, Unit
Rooms        -> Room
Room         -> Attributes, Floors, General, Parameters, Perspective, RoomProperties, Walls
Walls        -> Wall
Wall         -> Description, Dimensions, Fixtures, Furnishings, Number, Position, Type
Position     -> Angle, EndX, EndY, LeftWallNumber, StartX, StartY, X, Y, Z
Type         -> Style
Dimensions   -> Height, Length, Soffit, Thick, VaultHeight
Furnishings  -> Furnishing        Fixtures -> Fixture
Furnishing   -> Catalog, Position, Properties   (Fixture: זהה)
Properties   -> Attributes, General, Job, Room
General      -> Class, Depth, Description, Height, Name, Size, Type, Width
Size         -> Depth, Height, Width
Information  -> Customer, Job, ShipTo
Customer/ShipTo -> Address1, Address2, City, Comment, Contact, Email, Fax, Mobile, Name, Phone, State, Zip
RoomProperties -> Cabinet, Closets, Room          ← לא במפרט
Floors -> Floor -> Position, Shape -> template -> geometry -> entity -> begin/end -> x, y   ← לא במפרט
Attributes -> Parameter -> Name, Type, Value
```

### 1.3 מאפיינים-לכל-תג (attributes)
רק שלושה תגים נושאים מאפיינים בכל הקורפוס: `Job[Created]`, `template[firstid,unit]`, `entity[id,type]`. **כל שאר הנתונים הם אלמנטים-ילדים, לא attributes** — כולל `Position` ו-`Parameter` (מאשר את §2.6 של המפרט).

### 1.4 זוגות Class/Type נבדלים (על פריטים מונחים)
| Class \| Type | מופעים | במפרט? |
|---|--:|:--|
| `Fixture` \| `Miscellaneous` | 1304 | ✔ |
| `Fixture` \| `Part` | 423 | ✔ |
| `Decorative` \| `Miscellaneous` | 363 | ✔ |
| `Decorative` \| `TWall` | 207 | ✔ |
| `Decorative` \| `Window` | 176 | ✔ |
| `Decorative` \| `EntryDoor` | 156 | ✔ |
| `Decorative` \| `Part` | 81 | ✔ |
| **`Accessory` \| `Miscellaneous`** | 5 | ✗ (Class חדש) |
| **`Base` \| `Standard`** | 3 | ✗ (ארון!) |
| **`Appliance` \| `DishWasher`** | 2 | ✗ (מוצר-חשמל!) |
| **`Decorative` \| `Door`** | 2 | ✗ (Type חדש) |
| `∅` \| `Room` / `∅` \| `Kitchen` | 8/4 | ברמת-חדר |

ערכי-`Class`: `Fixture`(1727), `Decorative`(985), **`Accessory`(5), `Base`(3), `Appliance`(2)**.
ערכי-`Type` (פריטים): `Miscellaneous`(1672), `Part`(504), `TWall`(207), `Window`(176), `EntryDoor`(156), **`Standard`(3), `DishWasher`(2), `Door`(2)**.

### 1.5 ערכים נוספים
- **Wall `Style`:** `Standard`(1171), `VaultRight`(22), `VaultLeft`(22) — **בלבד**.
- **Catalog:** `InnoDraw`(2640), `אלמנטים למדידה`(50), **`Soline`(9)**, `Furnishing`(23, converter).
- **Parameter Name:** `SLOTDX`/`SLOTDY`/`SLOTX`/`SLOTY` (4 כ"א). **Parameter Type:** `M` בלבד (16 מופעים).
- **Position axes (non-empty):** `X`:2725, `Y`:2725, `Z`:1020. Window `Z`∈{`-100`,`0`}; EntryDoor `Z`=`-100`.
- **Unit:** `mm` (274/274). **Room Type:** `Room`(8), `Kitchen`(4). **ProductVersion:** `2025`(6), `CV 2023`(4), `Soline Measure 1.0.0`(3), `2023`(1).
- **קונטיינר → Class:** `Furnishings`{Fixture:1660, Decorative:984, Accessory:5, Base:3, Appliance:2} · `Fixtures`{Fixture:67, Decorative:1}. **14 קבצי-אמת** משתמשים ב-`<Fixtures>`.

---

## 2. טבלת-פסק לכל טענה

מקרא: **CONFIRMED** נמצא בקורפוס · **UNSUPPORTED** נטען אך אינו מופיע בשום מקום · **CONTRADICTED** הקורפוס מראה אחרת · **NOT-TESTABLE** אין קובץ שמפעיל את זה.

| # | טענה במפרט | §  | פסק | ראיה מהקורפוס |
|--:|---|---|---|---|
| 1 | היררכיה Job→Rooms→Room→Walls→Wall→{Fixtures/Furnishings}→{Fixture/Furnishing}→Properties/General | 0 | **CONFIRMED** | מפת-הקינון §1.2 בדיוק כזו; 251 קבצי-אמת |
| 2 | `Job` נושא attr `Created` | 0 | **CONFIRMED** | `attrPerTag: Job[Created]` |
| 3 | `ProductVersion="2025"` | 0 | **CONFIRMED (חלקי)** | מופיע 6×, אך גם `CV 2023`,`2023`,`Soline Measure 1.0.0` — לא ערך יחיד |
| 4 | `Unit="mm"` תמיד | 0 | **CONFIRMED** | 274/274 = `mm` |
| 5 | `Properties/Job/Information/{Job,Customer,ShipTo}` | 0 | **CONFIRMED** | קינון §1.2; Customer/ShipTo עם כל שדות-הקשר |
| 6 | `RoomProperties/Room/General/{Name,Description,Type}` | 0 | **CONFIRMED** | קינון §1.2 |
| 7 | Wall: `Number,Description,Position{StartX,StartY,Angle,EndX,EndY,LeftWallNumber},Type/Style,Dimensions{Length,Height,Soffit,Thick,VaultHeight}` | 1 | **CONFIRMED** | כל התגים קיימים; `LeftWallNumber`:64, `Soffit`:84, `VaultHeight`:1161 |
| 8 | Wall `Style ∈ {Standard, Peninsula, Cathedral, VaultLeft, VaultRight}` | 1 | **CONTRADICTED** | קיימים רק `Standard`,`VaultLeft`,`VaultRight`. **`Peninsula` ו-`Cathedral` — 0 מופעים** |
| 9 | קואורדינטות-קיר float(6) | 1 | **CONFIRMED** | `StartX=3070.000000` וכו' |
| 10 | "**חמישה** זוגות Class/Type בלבד בקורפוס" | 2.1 | **CONTRADICTED** | ≥7 זוגות פעילים + `Accessory/Miscellaneous`,`Base/Standard`,`Appliance/DishWasher`,`Decorative/Door` — ומעל 11 בסה"כ. גם פנימית: הטבלה שמתחת למשפט מונה 7 שורות |
| 11 | Fixture/Miscellaneous = Socket, Duplex Socket, SocketEx, Junction Box, Power Line | 2.1/4 | **CONFIRMED** | Socket:532, Duplex Socket:160, SocketEx:32, Junction Box:151, Power Line:189 — כולם `Fixture\|Miscellaneous` |
| 12 | Fixture/Part = Gas, Faucet, Water Supply, Sewage, Sewer drainage | 2.1/5 | **CONFIRMED** | Faucet:190, Sewage:107, Sewer drainage:45, Gas:37, Water Supply:23 — כולם `Fixture\|Part` |
| 13 | Decorative/Window = Window | 2.1/6 | **CONFIRMED** | Window:166 `Decorative\|Window` |
| 14 | Decorative/EntryDoor = Door, Passage, Doorway with/without Frame, Hinged Left In | 2.1/7 | **CONFIRMED (עם הסתייגות-שמות)** | Doorway w/o Frame:74, with Frame:16, Hinged Left In:16, Hinged Right In:18 — `Decorative\|EntryDoor`. **אך השמות `Door` ו-`Passage` אינם מופיעים כ-Name** (במקום: `מעבר`, `Doorway…`); ויש 2 מופעי `Decorative\|Door` (Type אחר) |
| 15 | Decorative/TWall = Beam | 2.1/8 | **CONFIRMED** | Beam:205 `Decorative\|TWall` |
| 16 | Decorative/Part = ShutterBox, WindowSill | 2.1/9 | **CONFIRMED** | ShutterBox:57, WindowSill:24 — `Decorative\|Part` |
| 17 | Decorative/Miscellaneous = Can Light, הנמכת-תקרה, Water Bar/תמי4, Power Box | 2.1/10 | **CONFIRMED** | Can Light:164, Power Box:116, תמי4:4, הנמכת תקרה עם מזגן:6 |
| 18 | הערה: בדמו "מים" תויג בטעות `Fixture/Miscellaneous` (אמיתי = Fixture/Part) | 2.1 | **CONFIRMED** | `מים` בדמו = `Fixture\|Miscellaneous`(4); `Water Supply` האמיתי = `Fixture\|Part` |
| 19 | "ה-CV האמיתי שם את **הכל** תחת `<Furnishings>`" | 2.2 | **CONTRADICTED** | 14 קבצי-אמת משתמשים ב-`<Fixtures>` (67 פריטי-Fixture בתוכו). הקונטיינר אכן אינו קובע Class/Type — זה כן CONFIRMED |
| 20 | מוסכמה A (Size מקונן) ל-Windows/Doors | 2.3 | **CONFIRMED** | Window 166/166 nested; Doorway/Hinged nested |
| 21 | מוסכמה B (Width/Depth/Height ישירים + `<Size>` ריק) ל**כל השאר** | 2.3 | **CONTRADICTED (חלקי אך מהותי)** | נכון לשקעים/אינסטלציה/Can Light (100% direct). **אך Beam 202 nested מול 5 direct, ShutterBox 53 nested מול 4, Power Box 116 nested/0, וכן Cabinet/Air Condition/Radiator/Safety Room Entrance — כולם nested.** הכלל "רק חלון/דלת מקננים" שגוי |
| 22 | סדר מוסכמה B: Width, Depth, Height | 2.3 | **CONFIRMED** | `General → …, Width, …, Height, …` בקבצים; `<Size>` ריק נוכח (`sizeEmptyPresent`) |
| 23 | Position: X=לאורך-קיר, Y=גובה, Z=עומק | 2.4 | **CONFIRMED (מבנית)** | X/Y תמיד; Z ב-1020 מופעים; ערכים עקביים עם הסמנטיקה |
| 24 | חלון/דלת שקוע → `Z=-100` | 2.4/6/7 | **CONFIRMED** | Window Z∈{-100,0}; EntryDoor Z=-100 |
| 25 | Can Light נושא `Z` גדול (מרחק-מהקיר על התקרה) | 2.4/10 | **CONFIRMED** | Can Light נושא Z (למשל 1024) |
| 26 | Catalog = `InnoDraw` (CV) / `אלמנטים למדידה` (דמו) | 2.5 | **CONFIRMED (חלקי)** | שניהם קיימים; **גם `Soline`(9) — לא מוזכר** |
| 27 | Attributes/Parameter עם Name,Type,Value; Type ∈ {`M`,`S`} | 2.6 | **CONTRADICTED (חלקי)** | מבנה CONFIRMED; `M` קיים (16). **`S` — 0 מופעים בכל הקורפוס** |
| 28 | פרמטרי-חריץ SLOTDX/SLOTDY/SLOTX/SLOTY | 2.6/10 | **CONFIRMED** | 4 מופעים כ"א, Type=`M` |
| 29 | Switch/Duplex Switch/SwitchEx = Fixture/Miscellaneous **[✗/לא ודאי]** | 3 | **CONFIRMED** (הפוך מהתיוג ✗) | Switch:106, Duplex Switch:55, SwitchEx:4 — כולם `Fixture\|Miscellaneous`. **מופיעים בקורפוס בשפע** |
| 30 | Phone/PhoneEx/TV/DuplexTV = Fixture/Miscellaneous **[✗]** | 3 | **CONFIRMED** (הפוך מ-✗) | Phone:12, PhoneEx:2, TV:10, Duplex TV:1 — `Fixture\|Miscellaneous` |
| 31 | Intercom = Fixture/Miscellaneous **[✗]** | 3 | **CONTRADICTED** | Intercom קיים(3) אך = **`Decorative\|Miscellaneous`**, לא Fixture |
| 32 | DoorBell = Fixture/Miscellaneous **[✗]** | 3 | **CONFIRMED (שם שונה)** | קיים כ-`Door Bell` (רווח):6, `Fixture\|Miscellaneous`. השם במפרט `DoorBell` שגוי |
| 33 | Lighting = Decorative/Miscellaneous **[✗/לא ודאי]** | 3 | **CONFIRMED** | Lighting:24 `Decorative\|Miscellaneous` |
| 34 | Sprinkler = Fixture/Part **[✗]** | 4 | **CONFIRMED** | Sprinkler:6 `Fixture\|Part` |
| 35 | Toilet = Fixture/Part **[לא ודאי]** | 4 | **CONFIRMED** | Toilet:5 `Fixture\|Part` |
| 36 | Shower = Fixture/Part **[לא ודאי]** | 4 | **CONFIRMED** | Shower:6 `Fixture\|Part` |
| 37 | Sink/Bath/Bidet = Fixture/Part **[לא ודאי]** | 4/11 | **NOT-TESTABLE** | Sink/Bath/Bidet — 0 מופעים בכל 274 הקבצים |
| 38 | HVAC "אין בקורפוס"; מזגן = Decorative/Miscellaneous | 5/11 | **CONTRADICTED** | `Air Condition` קיים(5) = **`Accessory\|Miscellaneous`** (Class שאינו בטקסונומיה) |
| 39 | פתח-אוויר (Air Opening) = Decorative/Miscellaneous **[לא ודאי]** | 5 | **CONFIRMED** | `Air Opening Ceiling`:22 `Decorative\|Miscellaneous` |
| 40 | Radiator = Fixture/Miscellaneous **[לא ודאי]** | 5/11 | **CONTRADICTED** | Radiator קיים(2) = **`Appliance\|DishWasher`** (!) — לא Fixture, ולא Class/Type שהמפרט צפה |
| 41 | הנמכת-תקרה עם מזגן = Decorative/Miscellaneous + SLOT | 5/10 | **CONFIRMED** | 6 מופעים, `Decorative\|Miscellaneous`, 4 פרמטרי-SLOT |
| 42 | מוצרי-חשמל (Dishwasher/Washer/Oven…) "אין בקורפוס", Class/Type לא אומת | 6/11 | **CONTRADICTED (חלקי)** | `Appliance\|DishWasher` קיים(2); Class=`Appliance` הוא מציאותי. שאר-המכשירים עדיין absent |
| 43 | ארונות — "**אף קובץ בקורפוס אינו מכיל ארון**; מבנה לא נקבע" | 7/11 | **CONTRADICTED** | `Cabinet` קיים(3) = **`Base\|Standard`**; גם תגי `RoomProperties/Cabinet` ו-`RoomProperties/Closets` קיימים |
| 44 | עמודים (Rectangular/Circular Column) = Decorative/Miscellaneous, "ייתכן TWall" **[לא ודאי]** | 3/11 | **CONTRADICTED/CONFIRMED-חלקי** | `Pole`,`RPole` קיימים = **`Decorative\|TWall`** — מאשר את השערת-ה-TWall, מפריך את הניחוש הראשי (Decorative/Miscellaneous) |
| 45 | כניסת-ממ"ד (Safety Room Entrance) = Decorative/EntryDoor **[לא ודאי]** | 3/11 | **CONTRADICTED** | Safety Room Entrance קיים(16) = **`Decorative\|Miscellaneous`**, לא EntryDoor |
| 46 | Beam דו-משמעי: גם TWall וגם Fixture/Miscellaneous עם תיאור "עמוד" | 8 | **CONFIRMED** | ב-`בדיקה.ordx`: Beam / `Fixture` / `Miscellaneous` / Description=`עמוד`; לצד 205 מופעי `Decorative\|TWall` |
| 47 | דוגמת §8: Beam במוסכמה B (מידות ישירות) | 8 | **CONTRADICTED** | Beam בקורפוס: 202 nested מול 5 direct — למעשה מוסכמה A |
| 48 | דוגמת §9: ShutterBox במוסכמה B (מידות ישירות) | 9 | **CONTRADICTED** | ShutterBox בקורפוס: 53 nested מול 4 direct — למעשה מוסכמה A |
| 49 | Stairs / מדרגות | 3/11 | **NOT-TESTABLE** | 0 מופעים |
| 50 | Bump/Depth/Marker/Panel To Panel | 8/11 | **NOT-TESTABLE** | 0 מופעים (ייתכן שאינם נשמרים כאלמנט) |
| 51 | הרחבות-Soline (בקרים/חיישנים/תקשורת מורחבת/יציאות-מכשירים) → Fixture/Miscellaneous | 4/11 | **NOT-TESTABLE** | אינם בקורפוס (למעט Phone/TV/Intercom שכן — ראו 30–31) |

---

## 3. ⚠️ FLAGGED — טענות שהקורפוס אינו תומך בהן

**אלה הדברים במפרט שיש לחשוד בהם. כל שורה = UNSUPPORTED או CONTRADICTED.**

### UNSUPPORTED (נטען, אך 0 מופעים בכל 274 הקבצים)
1. **Wall `Style = Peninsula`** (§1) — לא קיים בקורפוס.
2. **Wall `Style = Cathedral`** (§1) — לא קיים בקורפוס.
3. **`Parameter/Type = S`** (§2.6) — רק `M` מופיע אי-פעם. ערוץ ה-metadata-כמחרוזת של Soline לא אומת.
4. שמות-פריט `Door` ו-`Passage` כ-`<Name>` (§2.1/§7) — לא קיימים כ-Name (קיימים `Doorway w/o Frame` ו-`מעבר`).

### CONTRADICTED (הקורפוס מראה ערך אחר מהנטען)
5. **"חמישה זוגות Class/Type בלבד"** (§2.1) — בפועל ≥11, כולל שלושה Class-ים שהטקסונומיה כלל לא מכירה: `Accessory`, `Base`, `Appliance`.
6. **מוסכמת-המידה "רק חלון/דלת מקננים תחת `<Size>`; כל השאר ישירים"** (§2.3) — שגוי: **Beam, ShutterBox, Power Box, Cabinet, Air Condition, Radiator, Safety Room Entrance מקננים גם הם**. הדוגמאות של §8 (Beam) ו-§9 (ShutterBox) עם מידות-ישירות אינן תואמות את הקורפוס.
7. **"ה-CV האמיתי שם הכל תחת `<Furnishings>`"** (§2.2) — 14 קבצי-אמת משתמשים ב-`<Fixtures>`.
8. **`Radiator = Fixture/Miscellaneous`** (§5) — בפועל `Appliance\|DishWasher`.
9. **מזגן/`Air Condition = Decorative/Miscellaneous`** (§5) — בפועל `Accessory\|Miscellaneous`.
10. **`Safety Room Entrance = Decorative/EntryDoor`** (§3/§11) — בפועל `Decorative\|Miscellaneous`.
11. **`Intercom = Fixture/Miscellaneous`** (§3) — בפועל `Decorative\|Miscellaneous`.
12. **"אף קובץ בקורפוס אינו מכיל ארון"** (§7/§11) — שגוי: `Cabinet = Base\|Standard` קיים, וכן תגי `RoomProperties/Cabinet` ו-`Closets`.
13. **"מוצרי-חשמל אינם בקורפוס"** (§6/§11) — `Appliance\|DishWasher` קיים.
14. **עמודים "משוער Decorative/Miscellaneous"** (§3/§11) — בפועל `Decorative\|TWall` (`Pole`/`RPole`).
15. **שם `DoorBell`** (§3) — בקורפוס `Door Bell` (עם רווח).
16. **תיוגי `✗ קורפוס` / `[לא ודאי]` על Switch, Duplex Switch, SwitchEx, Phone, PhoneEx, TV, DuplexTV, Lighting, Sprinkler, Toilet, Shower, Air Opening** — כולם **כן** בקורפוס (סעיפים 29–39 בטבלה). התיוג "לא בקורפוס" שגוי עבורם.

---

## 4. פערי-כיסוי

### א. קיים בקורפוס — **לא** במפרט (המפרט מחמיץ)
- **גיאומטריית-רצפה שלמה:** `Room/Floors/Floor/{Position,Shape}` → `Shape/template[firstid,unit]/geometry/entity[id,type]/{begin,end}/{x,y}`. זהו ייצוג-polyline של מיתאר-הרצפה (104 מופעי `x`/`y`, 53 `entity`). **המפרט אינו מזכיר זאת כלל** — פער-כיסוי מהותי לכל מי שירצה לשחזר תכנית-רצפה.
- **תגי-ארון ברמת-חדר:** `RoomProperties/Cabinet`, `RoomProperties/Closets`.
- **`Perspective`** (4), **`Room/Parameters`** (4, שונה מ-`Attributes`), **`Job/Name`**, **`Job/Description`**, **`Job/Attributes`**.
- **Catalog `Soline`** (9) — ערך-קטלוג שלישי (נוסף על InnoDraw ו-אלמנטים למדידה).
- **Class-ים `Accessory`/`Base`/`Appliance`; Type-ים `Standard`/`DishWasher`/`Door`**.
- **Room `Type = Kitchen`** (בנוסף ל-`Room`).
- **ProductVersion** מרובה-ערכים (`CV 2023`, `2023`, `Soline Measure 1.0.0`).

### ב. במפרט — אף קובץ אינו מפעיל (NOT-TESTABLE, פערי-אמת אמיתיים)
`Sink`, `Bath`, `Bidet`, `Toilet`✓(נמצא), `Stairs`, `Rectangular/Circular Column` (בשמות אלה — אך `Pole`/`RPole` כן), `Washer`/`Oven`/`Microwave`/`Gas Range`/`Electric Range`/`Refrigerator` (בשמות אלה), `FaucetX2`, `Bump`/`Depth`/`Marker`/`Panel To Panel`, ורוב הרחבות-Soline לבית-חכם/חיישנים. עבור אלה המפרט **צודק** שאין ראיה — אך יש לסמנם NOT-TESTABLE, לא לנחש Class/Type בביטחון.

---

## 5. שורה-תחתונה — כמה אפשר לסמוך על `ORDX_ELEMENT_SPEC.md`

**השלד נכון; הפרטים מסוכנים.** מבנה-ה-ORDX הבסיסי (ההיררכיה Job→Rooms→Room→Walls→Wall→{Fixtures/Furnishings}, שדות-הקיר, `Position/{X,Y,Z}`, `Z=-100` לשקיעה, יחידות `mm`, Attributes/Parameter, ופענוח שבע משפחות ה-Class/Type המרכזיות) — **מאומת ומדויק מול 251 קבצי-אמת.** אבל המפרט **דגם קורפוס קטן מדי (7–9 קבצים במקום 251)** ולכן: (א) פסל כ"לא ודאי/לא בקורפוס" שורה של אלמנטים שהתשובה עליהם קיימת בפועל בקבצי-הלקוחות (Switch, Phone, TV, Lighting, Sprinkler, Toilet, Shower, Cabinet, Air Condition, Radiator, Safety Room Entrance); (ב) ניסח כלל-מידה שגוי ("רק חלון/דלת מקננים"); (ג) קבע "חמישה זוגות בלבד" בעוד שיש ≥11, כולל שלושה Class-ים שלמים שלא נצפו (`Accessory`/`Base`/`Appliance`); (ד) פספס לגמרי את שכבת-גיאומטריית-הרצפה. **בשימוש מעשי: אפשר לבנות מהמפרט ORDX תקין למשפחות-הליבה, אבל אין לסמוך על אף שורה מסומנת [לא ודאי] או ✗ בלי הצלבה — חלקן הפוכות מהמציאות, והדבר החמור ביותר הוא שהמפרט אומר "אין ארונות/מכשירים בקורפוס" בעוד שהם קיימים תחת Class-ים (`Base`,`Appliance`,`Accessory`) שהטקסונומיה של §2.1 כלל אינה מכילה.**
