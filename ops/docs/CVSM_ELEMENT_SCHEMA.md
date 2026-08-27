# CVSM_ELEMENT_SCHEMA — סכימת האלמנטים המלאה + סריאליזציית ORDX המדויקת

> **מקור־אמת** להנדסת־לאחור של אפליקציית המדידה **CVSM** (`com.roommeasure.app`, versionName **5.6.0**, versionCode 5600, minSdk 26, targetSdk 35).
> מטרה: הבסיס ל־**Soline→ORDX** ו־**Soline→DXF-3D** — לכל אלמנט: שדות, יחידות, ברירות־מחדל, וה־XML המדויק שמנוע `export/OrdxExporter` פולט.
> נכתב עבור Michael, לשון זכר. יחידות מ״מ. תאריך: **2026-08-18**.
>
> **שיטה ומגבלה:** חולצו מחרוזות מ־`classes*.dex` (אין jadx/baksmali/python בסביבה — לכן טבלאות ה־switch של `getOrdxClass/getOrdxType` ומקדמי־ה־double של ברירות־המחדל לא ניתנים לדיסאסמבלי מלא). כל ערך מסומן: **[corpus]** = אומת מול קובץ ORDX אמיתי · **[dex]** = מחרוזת/מבנה שחולץ מהקוד · **[recon]** = שוחזר מהמבנה · **[לא ודאי]** = חסר, לא לנחש בשקט.

---

## 0. מפתח־על — כל אלמנט → ORDX

מקרא Class/Type: הערך שנכתב תחת `<Properties><General><Class>`/`<Type>`. **Fixture** = ישות `<Fixture>` (נקודת חשמל/אינסטלציה). **Decorative** = ישות `<Furnishing>` (פתח/מכשיר/מבני). **Cabinet class** = ישות `<Assembly>`.

| אלמנט (CVSM enum) | קטגוריה/Class ב־CVSM | ישות ORDX | `<Class>` | `<Type>` | שדות־מפתח |
|---|---|---|---|---|---|
| `SOCKET_SINGLE` | Electrical | `<Fixture>` | Fixture | Miscellaneous | W,H,posX,posY |
| `SOCKET_MULTI` | Electrical | `<Fixture>` | Fixture | Miscellaneous | W,H |
| `ELECTRICAL_LINE` | Electrical | `<Fixture>` | Fixture | Miscellaneous | W,H |
| `NETWORK_POINT` | Electrical | `<Fixture>` | Fixture | Miscellaneous | W,H |
| `SMOKE_DETECTOR` | Electrical | `<Fixture>` | Fixture | Miscellaneous | W,H |
| `CEILING_LIGHT` | Electrical | `<Furnishing>` | Decorative | Miscellaneous | W,H (תקרה) [corpus: "Can Light"→Decorative/Misc] |
| `SPEAKER` | Electrical | `<Fixture>` | Fixture | Miscellaneous | W,H [recon] |
| `AIR_CONDITION` | Electrical/Appliance | `<Furnishing>` | Decorative | Miscellaneous | W,H,D + SLOT params (הנמכת תקרה) |
| `WATER_PIPE` | Plumbing | `<Fixture>` | Fixture | **Part** | W,H |
| `GAS_PIPE` | Plumbing | `<Fixture>` | Fixture | **Part** | W,H |
| `WATER_HEATER` | Plumbing | `<Furnishing>`/`<Fixture>` | Fixture | Part [לא ודאי] | W,H |
| `WATER_BAR` (תמי4) | Plumbing | `<Furnishing>` | Decorative | Miscellaneous | W,H [corpus] |
| `FLOOR_DRAIN` | Plumbing | `<Fixture>` | Fixture | Part [recon] | W,H |
| `WINDOW` | Openings | `<Furnishing>` | Decorative | **Window** | W,H,posX,posY [corpus] |
| `ENTRY_DOOR` (מעבר) | Openings | `<Furnishing>` | Decorative | **EntryDoor** | W,H [corpus] |
| `DOORWAY_WITH_FRAME` | Openings | `<Furnishing>` | Decorative | **EntryDoor** | W,H,D,Z [corpus] |
| `DOOR_HINGED_LEFT_IN` | Openings | `<Furnishing>` | Decorative | EntryDoor | W,H + swing [corpus] |
| `DOOR_HINGED_LEFT_OUT` | Openings | `<Furnishing>` | Decorative | EntryDoor | W,H + swing |
| `DOOR_HINGED_RIGHT_IN` | Openings | `<Furnishing>` | Decorative | EntryDoor | W,H + swing |
| `DOOR_HINGED_RIGHT_OUT` | Openings | `<Furnishing>` | Decorative | EntryDoor | W,H + swing |
| `REFRIGERATOR` | Appliances | `<Furnishing>` | Decorative | Miscellaneous [recon] | W,H,D |
| `OVEN` | Appliances | `<Furnishing>` | Decorative | Miscellaneous [recon] | W,H,D |
| `MICROWAVE` | Appliances | `<Furnishing>` | Decorative | Miscellaneous [recon] | W,H,D |
| `DISHWASHER` | Appliances | `<Furnishing>` | Decorative | Miscellaneous [recon] | W,H,D |
| `DISHWASHER_45` | Appliances | `<Furnishing>` | Decorative | Miscellaneous [recon] | W,H,D |
| `WASHING_MACHINE` | Appliances | `<Furnishing>` | Decorative | Miscellaneous [recon] | W,H,D |
| `SINK` | Appliances/Plumbing | `<Furnishing>` | Decorative | Miscellaneous [לא ודאי] | W,H,D |
| `BUILT_IN` | Appliances | `<Furnishing>` | Decorative | Miscellaneous [recon] | W,H,D |
| `WALL_SHAPE` | Structure | `<Assembly>`(Shape=WallShape) | — | — | MASHL/MASHR/MASHT params |
| `FALSE_FRONT` | Structure | `<Furnishing>` | Decorative | Miscellaneous [recon] | W,H |
| `SIDE_RAIL` | Structure | `<Furnishing>` | Decorative | Miscellaneous [recon] | W,H |
| **CabinetType** (כל 19, §5) | Base/Wall/Tall/Island | `<Assembly>` | לפי catalog | לפי catalog | Size W×H×D + Sections/Faces |

> **הכלל הגדול (אומת [corpus]+[dex]):**
> • נקודות חשמל/רשת/גלאי/שקע → **`<Fixture>` · Class=Fixture · Type=Miscellaneous**.
> • נקודות אינסטלציה/גז (מים, גז, ברז, ביוב, ניקוז) → **`<Fixture>` · Class=Fixture · Type=Part**.
> • פתחים (חלון/דלת/מעבר), מכשירי־חשמל, גופי־תאורה תקרתיים, אלמנטים מבניים → **`<Furnishing>` · Class=Decorative · Type∈{Window, EntryDoor, Miscellaneous}**.
> • ארונות → **`<Assembly>`** עם מבנה Sections/Faces מלא.
> **הערה קריטית:** ב־CVSM 5.6 ה־`<Catalog>` הוא **`WEB-App`** [dex]. (בקורפוס InnoDraw זה `InnoDraw`; בדוגמת־Soline זה `אלמנטים למדידה`.) ראה §6.

---

## 1. שלד ה־ORDX המלא (מ־`OrdxExporter`) — [dex, אומת מול corpus]

היררכיה: `Job → Properties(Job/Room) → Rooms → Room → Walls → Wall → {Fixtures, Furnishings, Assemblies}`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!-- CV ORDX Order XML File - Single Room Export -->   <!-- או ללא הסיפא במצב per-room -->
<Job Created="dd/MM/yyyy HH:mm:ss">
  <ProductVersion>2025</ProductVersion>
  <Unit>mm</Unit>
  <Properties>
    <Job><Information>
      <Job><Name>…</Name><Description>…</Description></Job>
      <Customer><Name/><Address1/><Address2/><City/><State/><Zip/>
        <Email/><Phone/><Mobile/><Fax/><Contact/><Comment/></Customer>
      <ShipTo> … אותם 12 שדות … </ShipTo>
    </Information>
    <Attributes><Parameter></Parameter></Attributes></Job>
    <Room><Attributes></Attributes></Room>
  </Properties>
  <Rooms>
    <Room>
      <Perspective></Perspective>
      <RoomProperties>
        <Room>
          <General><Name>…</Name><Description>…</Description><Type>Room</Type></General>
          <Parameters></Parameters>
        </Room>
        <Cabinet></Cabinet>
        <Closets></Closets>
      </RoomProperties>
      <Walls>
        <Wall> … §2 … </Wall>
      </Walls>
    </Room>
  </Rooms>
</Job>
```

מחרוזות־מפתח שחולצו: `<!-- CV ORDX Order XML File - Single Room Export -->`, `<Job Created="`, `<ProductVersion>2025`, `<Unit>mm`, `<Type>Room</Type>`, `<Perspective>`, `<Cabinet></Cabinet>`, `<Closets></Closets>`.
פורמט תאריך: `SimpleDateFormat` **`dd/MM/yyyy HH:mm:ss`** [dex] (אומת: `Created="16/08/2026 23:09:35"` [corpus]).
**סדר הקירות** נקבע ב־`reorderWallsForCabinetVision` (מיון היקפי `sortedByY`+`minByOrNull nextWall`) — ראה §2.4.

---

## 2. Wall — הקיר [corpus + dex]

```xml
<Wall>
  <Number>1</Number>
  <Description>Wall 1</Description>
  <Position>
    <StartX>1943.023</StartX>
    <StartY>-2229.604</StartY>
    <Angle>-90.032</Angle><!--EndX, EndY are optional, if present they will override wall length-->
    <EndX>1939.878</EndX>
    <EndY>3477.956</EndY>
    <LeftWallNumber>5</LeftWallNumber><!--If a valid wall number, this will override any StartX, StartY-->
  </Position>
  <Type>
    <Style>Standard</Style><!--Standard|Peninsula|Cathedral|VaultLeft|VaultRight-->
  </Type>
  <Dimensions>
    <Length>5707.561</Length>
    <Height>2526.700</Height>
    <Soffit>20.000</Soffit>
    <Thick>100.000</Thick>
    <VaultHeight>1219.200</VaultHeight>
    <VaultPosition>…</VaultPosition>   <!-- [dex], נכתב לקירות Vault/Cathedral -->
  </Dimensions>
  <Curve>…</Curve>                       <!-- [dex]: BeginAngle/EndAngle/Radius/ArcAngle — קיר־קשת -->
  <Fixtures> … §3 … </Fixtures>
  <Furnishings> … §4 … </Furnishings>
  <Assemblies> … §5 … </Assemblies>
</Wall>
```

### 2.1 שדות Position
| תג | יחידה | הערה |
|---|---|---|
| `StartX`,`StartY` | mm | קואורדינטת־חדר גלובלית, `%.3f` |
| `Angle` | מעלות | `%.3f` (למשל `-90.032`) |
| `EndX`,`EndY` | mm | **אופציונלי**; אם קיים — דורס את Length |
| `LeftWallNumber` | int | אם תקין — דורס StartX/StartY (משרשר לקצה הקיר הקודם) |

### 2.2 שדות Dimensions (ברירות־מחדל [corpus])
| תג | ברירת־מחדל | הערה |
|---|---|---|
| `Length` | — | mm, `%.3f` |
| `Height` | — | גובה־קיר mm |
| `Soffit` | **20.000** | סגירה עליונה |
| `Thick` | **100.000** | עובי קיר |
| `VaultHeight` | **1219.200** | 48″; רלוונטי ל־Vault/Cathedral |
| `VaultPosition` | — | מיקום שיא הקמרון לאורך הקיר [dex] |

### 2.3 WallTopStyle → `<Style>` [dex, אומת]
enum `WallTopStyle` = `STANDARD | PENINSULA | CATHEDRAL | VAULT_LEFT | VAULT_RIGHT` → נכתב כ־`Standard | Peninsula | Cathedral | VaultLeft | VaultRight`.
בקורפוס: קיר 5 עם `<Style>VaultRight</Style>` + `<VaultHeight>1.000`.
- **Standard** — ראש ישר.
- **Peninsula** — קיר־אי (בתוכנית קו דק, `stroke-width:60`; ב־3D שקוף alpha 0.35, עובי body 30) [app.js].
- **Cathedral** — גמלון (שיא במרכז).
- **VaultLeft/Right** — משופע (שיא בצד).

### 2.4 סדר קירות (`reorderWallsForCabinetVision`) [dex]
מיון היקפי: `sortedByY` → בחירת `nextWall` ע״י `minByOrNull` (המשך חיבורי־היקף). לוג פנימי: `Final wall DB_IDs order (numbered 1,2,3...)`, `Clockwise perimeter`, `Exporting REVERSED (before offset)`. יש לשמר סדר זה בגנרטור של Soline.

### 2.5 הערת DXF-3D לקיר
Footprint = קטע `Start→End` מוצא (extrude) לעובי `Thick` אל צד ה־back (הנורמל הקדמי `n=(-dy,dx)/len`, הגוף מוסט `-n·thick`). גובה = פרופיל `outline`: Standard=מלבן `H`; Vault/Cathedral=פוליגון עם שיא `H+VaultHeight` ב־`VaultPosition`. Peninsula=לוח דק (30) שקוף. (מנגנון זהה ל־`app.js roomFaces`.)

---

## 3. Fixture — נקודת חשמל/אינסטלציה [corpus + dex]

```xml
<Fixtures>
  <Fixture>
    <Catalog>WEB-App</Catalog>
    <Properties>
      <General>
        <Name>שקע בודד</Name>
        <Description>Single Socket</Description><!--Class and Type are optional and must match the item or no item will be selected. It is recommended to omit them-->
        <Class>Fixture</Class>
        <Type>Miscellaneous</Type>
        <Size><!--Note: Size is only required if modified from original size-->
          <Width>85.000</Width>
          <Height>77.000</Height>
        </Size>
      </General>
    </Properties>
    <Position>
      <X>200.000</X>
      <Y>300.000</Y>
    </Position>
  </Fixture>
</Fixtures>
```

- **מקור:** `generateFixture` [dex]. הישות `<Fixture>` נשלפת מ־`generateWall$fixtures` (סינון accessories שהם Fixture-class).
- `Type`: **Miscellaneous** לחשמל/רשת/גלאי/שקע; **Part** לאינסטלציה/גז [corpus: Gas→Part, Faucet→Part, Sewage→Part].
- `Position.X` = מרחק לאורך הקיר מנקודת ההתחלה; `Position.Y` = גובה מהרצפה. (בדוגמה 200/300 mm.)
- `<Size>` אופציונלי — נכתב רק אם המידות שונו מברירת־המחדל של פריט הקטלוג.
- **DXF-3D:** נקודה קטנה על מישור הקיר במיקום (X along, Y height), עומק־בליטה `depth` מהשדה של האביזר (ברירת־מחדל קטנה, לחשמל ~6–20mm). תיבה W×depth×H.

---

## 4. Furnishing — פתח / מכשיר / אלמנט מבני [corpus + dex]

### 4.1 פתח פשוט (חלון/מעבר)
```xml
<Furnishing>
  <Catalog>WEB-App</Catalog>
  <Properties><General>
    <Name>חלון</Name>
    <Description>Window</Description><!--Class and Type are optional…-->
    <Class>Decorative</Class>
    <Type>Window</Type>          <!-- או EntryDoor לדלת/מעבר -->
    <Size><Width>900.000</Width><Height>1200.000</Height></Size>
  </General></Properties>
  <Position><X>428.094</X><Y>900.000</Y></Position>
</Furnishing>
```

### 4.2 פתח עם עומק ו־Z (מפתח עם משקוף) [corpus]
```xml
<Furnishing>… <Type>EntryDoor</Type>
  <Size><Width>800.000</Width><Height>2050.000</Height><Depth>100.000</Depth></Size></General>
  <Position><X>800.000</X><Y>0.000</Y><Z>-100.000</Z></Position>
</Furnishing>
```
`Z` = היסט־עומק אל מחוץ/פנים לקיר (שלילי = לתוך עובי הקיר). `Depth` = עומק הבליטה.

### 4.3 הנמכת־תקרה עם מזגן — עם Attributes/Parameters [corpus]
```xml
<Furnishing>… <Type>Miscellaneous</Type>
  <Size><Width>800.000</Width><Height>300.000</Height><Depth>650.000</Depth></Size></General>
  <Attributes>
    <Parameter><Name>SLOTDX</Name><Type>M</Type><Value>700.000</Value></Parameter>
    <Parameter><Name>SLOTDY</Name><Type>M</Type><Value>100.000</Value></Parameter>
    <Parameter><Name>SLOTX</Name><Type>M</Type><Value>100.000</Value></Parameter>
    <Parameter><Name>SLOTY</Name><Type>M</Type><Value>100.000</Value></Parameter>
  </Attributes></Properties>
  <Position><X>528.094</X><Y>2226.000</Y></Position>
</Furnishing>
```
פרמטרי־Slot (`Type>M` = metric/mm): `SLOTX/SLOTY` = פינת החריץ (מזגן) בתוך המסגרת; `SLOTDX/SLOTDY` = מידות החריץ. משמשים אלמנטים בעלי חלל־פנימי (הנמכת־תקרה, נישה).

### 4.4 שדות Furnishing
| תג | יחידה | חובה? | הערה |
|---|---|---|---|
| `Catalog` | — | כן | `WEB-App` [dex] |
| `Name` | טקסט | כן | שם־תצוגה (מ־resources, מקומי) |
| `Description` | טקסט | כן | שם־ORDX אנגלי מ־`getOrdxName` |
| `Class` | — | אופ׳ | `Decorative` |
| `Type` | — | אופ׳ | `Window`\|`EntryDoor`\|`Miscellaneous` |
| `Size/Width`,`Height` | mm | אופ׳ | רק אם שונה מברירת־מחדל |
| `Size/Depth` | mm | אופ׳ | עומק בליטה |
| `Position/X` | mm | כן | לאורך הקיר |
| `Position/Y` | mm | כן | גובה מהרצפה |
| `Position/Z` | mm | אופ׳ | היסט־עומק |
| `Attributes/Parameter` | — | אופ׳ | SLOT*/MASH* |

- **מקור:** `generateFurnishing` [dex] (10 ענפי־`let` פנימיים → שדות אופציונליים לפי מה שהוגדר).
- **DXF-3D:** footprint = תיבה W(along)×Depth אל תוך/מחוץ לקיר לפי Z; extrude מ־Z=`Position.Y` (bottom) עד `Y+Height`. פתחים (Window/EntryDoor) = חיתוך בגוף הקיר במלבן W×H בגובה Y.

### 4.5 כיוון פתיחת דלת (DoorSwing) [dex + app.js]
enum `DoorSwingSide`={IN,OUT}, `DoorHingeSide`={LEFT,RIGHT} → 4 צירופים כ־AccessoryType:
`DOOR_HINGED_LEFT_IN` / `LEFT_OUT` / `RIGHT_IN` / `RIGHT_OUT`, Description: `Hinged Left In Door` / `Hinged Left Out Door` / `Hinged Right In Door` / `Hinged Right Out Door` [dex].
ב־app.js הדלת נושאת `door{hx,hy (ציר), px,py (וקטור־פתיחה), fx,fy (משקוף חופשי), assumed}` → קשת־רבע ב־plan. **[לא ודאי]:** האם כיוון־הפתיחה מקודד ב־ORDX מעבר ל־Description (לא נמצא תג ייעודי ל־swing ב־Furnishing).

---

## 5. Cabinet — Assembly (ארון) [dex; אין בקורפוס־המדידה, שוחזר מ־OrdxExporter]

> **חשוב:** קבצי הקורפוס (InnoDraw/Soline) הם ייצוא־מדידה **ללא ארונות**. מבנה ה־Assembly להלן שוחזר **כולו** ממחרוזות `generateCabinetAssembly / generateCabinetSections / generateDrawerSplits / generateCabinetFromModel` ב־`classes10.dex`. הסדר המדויק של הצמתים הוא **[recon]**; אוסף התגים **[dex]**.

```xml
<Assemblies>
  <Assembly>
    <Catalog>WEB-App</Catalog>
    <Shape>
      <Name>…</Name>          <!-- שם צורת־הארון בקטלוג -->
      <Sections>…</Sections>
    </Shape>
    <Position>
      <X>…</X><Y>…</Y><Z>…</Z>
      <Axis>XY</Axis>
    </Position>
    <Properties>
      <General>
        <Name>…</Name>
        <Description>…</Description>
        <Class>…</Class>          <!-- ראה §5.1; catalog-class -->
        <Type>…</Type>
        <Comment>…</Comment>
        <Size><!--Size is only required if modified-->
          <Width>…</Width><Height>…</Height><Depth>…</Depth>
        </Size>
        <Cabinet>32mm</Cabinet>            <!-- מערכת בנייה -->
        <Bottom>No Bottom</Bottom>
        <Top>No Top</Top>
        <ToeHeight>100.000</ToeHeight>     <!-- גובה סוקל; 0.000 לארון עליון -->
        <FrontRecess>0.000</FrontRecess>
        <LeftRecess>0.000</LeftRecess>
        <RightRecess>0.000</RightRecess>
      </General>
      <Construction>…</Construction>
      <Case>…</Case>
      <Hardware>…</Hardware>
      <Toe>…</Toe>
      <Sections>
        <Section Side="1" Type="e">        <!-- Side=int, Type="e"=חיצוני -->
          <Face>
            <Type>Door</Type>              <!-- Door|Drawer|Panel|Pair -->
            <Dimensions><Width>…</Width><Height>…</Height></Dimensions>
            <Position>…</Position>
            <Hinge>…</Hinge>              <!-- L/R -->
            <Split Direction="h">          <!-- חלוקת־חזית; h=אופקי -->
              <Face1>…</Face1>
              <Face2>…</Face2>
            </Split>
            <Door>…</Door>
          </Face>
        </Section>
      </Sections>
    </Properties>
  </Assembly>
</Assemblies>
```

תגים שאומתו כמחרוזות ב־dex: `<Assembly>`,`<Assemblies>`,`<Shape>`,`<Sections>`,`<Section Side="1" Type="e">`,`<Face>`,`<Face1>`,`<Face2>`,`<Split Direction="h">`,`<Type>Door</Type>`,`<Type>Drawer</Type>`,`<Type>Panel</Type>`,`<Type>Pair</Type>`,`<Door>`,`<Hinge>`,`<Dimensions>`,`<Position>`,`<Axis>XY</Axis>`,`<Cabinet>32mm</Cabinet>`,`<Bottom>No Bottom</Bottom>`,`<Top>No Top</Top>`,`<ToeHeight>100.000/0.000</ToeHeight>`,`<FrontRecess>0.000</FrontRecess>`,`<LeftRecess>`,`<RightRecess>`,`<Comment>`,`<Construction>`,`<Case>`,`<Hardware>`,`<Toe>`.

### 5.1 CabinetClass (5) [dex]
`BASE` · `WALL` · `TALL` · `ISLAND` · `OTHER`.

### 5.2 CabinetType (19) → קבוצות לפי Class [dex + display-strings]
| enum | Class | שם־תצוגה | חזית טיפוסית |
|---|---|---|---|
| `BASE_CABINET` | BASE | Base Cabinet | Door |
| `BASE_DOOR_LEFT` | BASE | Base Left Door | Door, ציר שמאל |
| `BASE_DOOR_RIGHT` | BASE | Base Right Door | Door, ציר ימין |
| `BASE_DOUBLE_DOOR` | BASE | Base Double Door | Pair |
| `BASE_THREE_DRAWERS` | BASE | Base Three Drawers | 3×Drawer (Split h) |
| `BASE_CORNER` | BASE | Base Corner | CornerCabinetShape |
| `BASE_SINK` | BASE | Sink Cabinet | Pair/Door |
| `BASE_OVEN` | BASE | Single Oven | Panel/Open |
| `WALL_DOOR_LEFT` | WALL | Wall Left Door | Door, ציר שמאל |
| `WALL_DOOR_RIGHT` | WALL | Wall Right Door | Door, ציר ימין |
| `WALL_DOUBLE_DOOR` | WALL | Wall Double Door | Pair |
| `TALL_DOUBLE_DOOR` | TALL | Tall Double Door | Pair |
| `TALL_PANTRY_LEFT` | TALL | Pantry (L) | Door |
| `TALL_PANTRY_RIGHT` | TALL | Pantry (R) | Door |
| `TALL_REFRIGERATOR` | TALL | Refrigerator | Panel/Open |
| `ISLAND` | ISLAND | Island | Door/Drawer |
| `BLANK_PANEL` | OTHER | Blank Panel | Panel |
| *(Cooktop Cabinet)* | BASE | Cooktop Cabinet | [לא ודאי — display קיים, member לא זוהה] |
| *(עוד?)* | — | — | [לא ודאי] |

### 5.3 FaceType (6) → `<Face><Type>` [dex, אומת]
`Door` · `Drawer` · `Panel` · `Pair` · `FalseFront` · `Open`.

### 5.4 HingeSide (3) [dex]
`LEFT` · `RIGHT` · `NONE` → `<Hinge>`.

### 5.5 CornerCabinetShape [dex — class קיים]
member-names **[לא ודאי]** (לא חולצו מהמחרוזות; סביר `L_SHAPED`/`DIAGONAL` אך לא אושר). מיושם ב־`BASE_CORNER`.

### 5.6 Cabinet — שדות המודל [dex, מ־constructor]
חתימת ה־constructor: `(String id, int number, String name, String desc, String catalogRef, CabinetClass, FaceType, HingeSide, int, boolean, boolean, boolean, Float width, Float height, Float depth)`.
שלוש ה־`Float` בסוף = **width/height/depth** (nullable → override של ברירות־מחדל מ־`CabinetTypeDefaults`).

### 5.7 CabinetDefaults / CabinetTypeDefaults — מידות ברירת־מחדל
מקדמי־ה־double מקודדים בינארית ב־`classes4.dex` ולא נקראו (אין דיסאסמבלר) → **[לא ודאי]**. ערכי־תעשייה סבירים (למימוש זמני, לא מ־dex): Base H≈870, D≈580, ToeHeight=100; Wall H≈720, D≈320, ToeHeight=0; Tall H≈2100, D≈580. **חובה לאמת מול הקוד לפני שימוש בייצור.**

### 5.8 DXF-3D לארון
footprint = מלבן `Width×Depth` על מישור הקיר במיקום `Position.X` לאורך; קורנר = פוליגון `CornerCabinetShape`. extrude מ־`Position.Z`(=רום/ToeHeight) עד `Z+Height`. חזיתות (Faces) הן משטחים על הפאה הקדמית — לרינדור מלא צריך את ה־Sections.

---

## 6. Catalog + מיפוי getOrdxName/Class/Type — הפער שנותר

- ב־CVSM 5.6 כל ישות נושאת `<Catalog>WEB-App</Catalog>` [dex]. שני מצבי־ייצוא (`OrdxExportMode`): Single-Room (`<!-- … Single Room Export -->`) ו־Room-by-Room.
- המיפוי המדויק **enum→Class/Type** מיושם ב־`AccessoryType.getOrdxClass()/getOrdxType()/getOrdxName()/getOrdxCode()` ו־`CabinetType`. אלה טבלאות־`switch` על ordinal — **לא ניתנות לדיסאסמבלי** בסביבה זו. הכללים ב־§0 שוחזרו מהצלבת [corpus]+[dex] וברמת־ביטחון גבוהה לקטגוריות (Fixture/Miscellaneous, Fixture/Part, Decorative/Window|EntryDoor|Miscellaneous), אך ההתאמה הפרטנית לכל member שאינו בקורפוס היא **[recon]**.
- **AccessoryType.getOrdxCode** — קיים code נוסף (`getOrdxCode`) שלא ראינו נכתב ב־ORDX (ייתכן ל־DB_ID/מיפוי־קטלוג). **[לא ודאי]**.

---

## 7. סיכום פערים לא־ודאיים (לא לנחש בשקט)
1. **מקדמי ברירות־המחדל** של `CabinetDefaults`/`CabinetTypeDefaults`/`AccessoryType` (width/height/depth) — מקודדים בינארית; דורש baksmali/androguard.
2. **טבלאות ה־switch** `getOrdxClass/Type/Name/Code` per-member — אותו חסם. הכללים הכלליים אומתו; ההתאמה הפרטנית ל־members שמחוץ לקורפוס = [recon].
3. **סדר הצמתים** בתוך `<Assembly>` (Construction/Case/Hardware/Toe/Sections) — אוסף התגים ודאי, הסדר [recon].
4. **CornerCabinetShape members** — לא חולצו.
5. **קידוד swing של דלת ב־ORDX** מעבר ל־Description — לא נמצא תג ייעודי.
6. **Cooktop Cabinet** — display קיים, member של CabinetType לא זוהה בוודאות.

> להשלמת 1–2 (הקריטיים ל־DXF-3D): להריץ `baksmali`/`androguard` על `classes4.dex` (model) ו־`classes10.dex` (OrdxExporter) בסביבה עם python אמיתי, ולשלוף את גופי ה־`<clinit>` וה־`getOrdx*`.
