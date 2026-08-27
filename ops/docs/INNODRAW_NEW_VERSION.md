# INNODRAW_NEW_VERSION — מה חדש בגרסת-InnoDraw שהותקנה עכשיו

> **מטרה:** דיף בין ההתקנה הנוכחית של InnoDraw / eLCad לבין מה שכבר תיעדנו (`INNODRAW_FEATURES.md`, `CVSM_FEATURES.md`, `CVSM_EXPORT_CRACK.md`, `ELEMENT_CATALOG_MERGED.md`). כל פריט מסומן **[חדש]** עם שורת "למה זה חשוב ל-Soline".
>
> **שיטה:** ניתוח סטטי קריאה-בלבד — לא הופעל/שונה שום קובץ של InnoDraw. השוואת עצי-התקנה, גרסאות-בינארי, קבצי-פרופיל, וקטלוגי-מחרוזות בין תיקיות-הגרסה.
>
> תאריך: **2026-08-18** · עברית · לשון זכר.

---

## 0. זיהוי-גרסה ונתיב-התקנה

- **נתיב:** `C:\Program Files (x86)\InnoDraw`
- **תיקיות-גרסה מותקנות:**
  | תיקייה | eLCad.exe | תאריך-בנייה | הערה |
  |---|---|---|---|
  | `El_Cad--1` | 14,297,088 B | 2025-07-16 | בנייה **ישנה** (זו שנותחה ברובה ב-`INNODRAW_FEATURES.md`) |
  | `EL_CAD_9504_0050_0005_0005_ktn` | 9,740,800 B | **2026-06-30** | בנייה חדשה |
  | `EL_CAD_9505_0050_0005_0005_ktn` | 9,740,800 B | **2026-06-30** | בנייה חדשה — **התיקייה עודכנה היום (2026-08-18)** |
- **מספר-גרסה:** אין `version.txt` נפרד; הגרסה מקודדת בשם-התיקייה — **`9505`** (הקודמת `9504`). `ProductVersion` בקבצי-ORDX = **`2025`**. הבינארי עצמו נושא `FileVersion 1,0,0,1` (לא אינפורמטיבי).
- **ממצא-מפתח:** eLCad.exe של `9504` ו-`9505` **זהים בית-בבית** (שניהם 9,740,800 B, 2026-06-30, בהפרש 14 שניות). כלומר מ-9504 ל-9505 **אין שינוי-מנוע** — ההבדל הוא ב**קונפיגורציית-הפרופילים** בלבד (ראה §5). מנוע-הבסיס הוא בנייה חדשה של **2026-06-30**, חדשה יותר מבסיס-הניתוח הקודם (`El_Cad--1`, 2025-07).

> **שקיפות:** התיעוד הקודם (`INNODRAW_FEATURES.md`, 2026-08-17) כבר הזכיר קיום תיקיות 9504/9505. לכן חלק מהפריטים למטה הם **פירוט/דיוק שלא היה מתועד** (קודי-אלמנט, פענוח-ארונות) ולא "פיצ'ר חדש במנוע"; פריטים שהם **חדשים ממש** (פרופיל-הנגרות שעודכן היום, מוצר Measure Manager) מסומנים בבירור.

---

## 1. קטלוג-אלמנטים — קודי-ID מדויקים (לא היו מתועדים)

התיעוד הקודם (§8) נתן **סיכום** של 8 קטגוריות/~80 אייקונים בלי קודים. הגרסה הזו חושפת ב-`eLObstaclesIconsCategories*.tx~` את **קוד-ה-ID המדויק לכל אלמנט** — קריטי כי הקוד הזה הוא המפתח לספריית-הפריטים.

**[חדש] מיפוי-הקודים המלא של InnoDraw** (מתוך גרסת 9505):

- **Construction:** Rectangular Column=43, Circular Column=56, Beam=163, Door=22, Safety Room Entrance=14, Stairs=35, Window=0
- **Electrical:** Junction_Box=120, Control Box=17, Intercom=7, DoorBell=49, Lighting=2, Can_Light=111, Phone=8, DuplexPhone=50, PhoneEx=26, Power Line=11, Power Box=31, Socket=1, Duplex Outlets=45, SocketEx=18, Switch=16, DuplexSwitch=51, SwitchEx=36, TV=9, DuplexTV=52
- **Plumbing:** Bath=32, Bidet=33, Faucet=3, WaterSuply=54, FaucetX2=4, Gas=5, Sewage=6, Sewer drainage=15, Shower=34, Sink=70, Sprinkler=13, Toilet=10, Water Pipe=12
- **HVAC:** Air Condition=27, Air Opening=25, Radiator=28, Vent=37
- **Appliances:** Washer=140, Dishwasher=135, Oven=172, Microwave=152, Gas Range=151, Electric Range=150, Refrigerator=136
- **Furniture:** Cabinet=44, Cabinet_CW1D=173, Cabinet_CW2D=174, Cabinet_CT1D=175, Cabinet_CB1D-1DR=176, Cabinet_CB2D-2DR=177, Cabinet_CB2D=178, Table=181, Chair=182
- **Misc:** Bump=19, Depth=20, Marker=21, ShutterBox=169, Window Sill=168, Panel To Panel=30, Reserved=38
- **Duplicate (פעולות):** Duplicate Offsets=41, Duplicate Heights=42

> **למה זה חשוב ל-Soline:** הקוד הזה הוא המזהה שבו נבחר סמל-הפריט. שמירת ה-ID הנכון על כל אלמנט-Soline = תאימות-סמל מלאה ב-InnoDraw/Cabinet-Vision, בלי "פריט לא נבחר". תועד במלואו ב-`ORDX_ELEMENT_SPEC.md §3`.

---

## 2. פענוח קודי-הארונות (CW/CB/CT · 1D/2D · DR)

התיעוד הקודם רשם "7 טיפוסי-ארון CW1D/CW2D/CT1D/CB1D/CB2D" בלי לפענח את הקוד. הגרסה הזו נותנת את השמות-המלאים בקטלוג.

**[חדש] מפתח-קוד הארונות:**
- **C** = Cabinet · האות-השנייה = מיקום: **W**=Wall (עליון), **B**=Base (תחתון), **T**=Tall (גבוה/עמודה)
- **nD** = מספר-דלתות (1D/2D) · **nDR** = מספר-מגירות
- לכן: `CW1D`=עליון-דלת-אחת, `CW2D`=עליון-2-דלתות, `CT1D`=גבוה-דלת-אחת, `CB1D-1DR`=תחתון-דלת+מגירה, `CB2D-2DR`=תחתון-2-דלתות+2-מגירות, `CB2D`=תחתון-2-דלתות.

> **למה זה חשוב ל-Soline:** זו טקסונומיית-הארונות של Cabinet Vision. כשנוסיף שכבת-ארונות (`DESIGN_TOOL_SPEC`), הקודים האלה הם מילון-היעד הישיר ל-ORDX ול-`.sol`. **הערה:** קידוד-ה-ORDX המדויק של ישות-ארון עדיין לא נקבע (הקורפוס הרזה חסר ארונות) — ראה `ORDX_ELEMENT_SPEC.md §11`.

---

## 3. תת-קטלוגים שלא היו מתועדים

**[חדש] תת-קטלוג-שקעים מורחב** (מ-`eLObstaclesIconsEn.tx~`, רובם וריאנטים אמריקאיים `Available=0`): Socket(1), Duplex Socket(45), 110V(88), 220V(89), Arc_Fault(90), Ceiling_Outlet(91), Duplex_Outlet_Furnace(92), Duplex_Outlet(93), Exterior_Gfi(94).
> **חשוב ל-Soline:** מראה שהמנוע תומך בשקע-תקרה (Ceiling_Outlet), שקע-חוץ-מוגן (Exterior_Gfi), ומתג-קשת (Arc_Fault) — הרחבות שיש להן מקבילה בקטלוג-Soline (`elements.json`).

**[חדש] וריאנטי-חלון עם כיווניות:** Window1 (ID 0), Window2 (170, `DoorStyle`+`RightLeft=Right`), Window3 (171, `DoorStyle`+`InOut=In`+`RightLeft`).
> **חשוב ל-Soline:** החלון נושא מטא-כיווניות (In/Out, Right/Left) בדיוק כמו דלת — שימושי לחזית ולפתיחה נכונה ב-DXF-3D.

**[חדש] אלמנטי-חשמל שלא היו ברשימת §8 הקודמת:** Control Box (17), DoorBell (49), Can_Light (111), DuplexPhone (50), DuplexSwitch (51), DuplexTV (52), Duplex Outlets (45), WaterSuply (54), Circular Column (56).
> **חשוב ל-Soline:** משלימים את קטלוג-החשמל/תקשורת (פעמון, תיבת-בקרה, וריאנטים-כפולים) ומאשרים **עמוד-עגול** כאלמנט-מנוע נפרד (Circular Column) — היה חסר בתיעוד הקודם.

---

## 4. הבהרות על קידוד-ORDX (הצלבה מול קורפוס אמיתי)

לא "פיצ'ר חדש בתוכנה" אלא **ידע חדש שחולץ** מהצלבת הקטלוג עם קורפוס-ה-ORDX, שלא היה מתועד ברמת-הדיוק הזו:

**[חדש] טקסונומיית Class/Type מלאה** (5 זוגות בלבד): Fixture/Miscellaneous (חשמל/תקשורת), Fixture/Part (מים/גז/ניקוז), Decorative/Window, Decorative/EntryDoor (כל הדלתות/מעברים), Decorative/TWall (קורה), Decorative/Part (ארגז-תריס/אדן), Decorative/Miscellaneous (תקרה/לוח-חשמל/עמוד).

**[חדש] פרמטרי-חריץ להנמכת-תקרה-עם-מזגן:** `SLOTDX/SLOTDY/SLOTX/SLOTY` (Type `M`) תחת `<Attributes><Parameter>` — המקום היחיד בקורפוס שמשתמש בערוץ-הפרמטרים.

> **חשוב ל-Soline:** אלה הוזרמו במלואם ל-`ORDX_ELEMENT_SPEC.md` (הדליברבל השני) — הבסיס לייצור `Soline→ORDX` ו-`Soline→DXF-3D`.

---

## 5. שינויי-פרופילים בגרסת 9505 (עודכן היום)

דיף-פרופילים בין `9504` ל-`9505`:

**[חדש] פרופיל שנוסף ב-9505:** `Profiles\Cabinetry_Default_CadNet_Heb_4` — פרופיל-**נגרות בעברית** (קבצי `Layers.cfg` 7,865B, `AuditSheet.cfg`, `Edges.cfg`, `SysLabels.cfg`, מתוארכים 2025-03-04). זהו פרופיל-שרטוט ייעודי-לארונות (CadNet) בעברית.
> **חשוב ל-Soline:** InnoDraw מזיז את ה-workflow לכיוון **נגרות/ארונות בעברית** — בדיוק תחום-היעד של Soline. שכבות-ה-DXF שבפרופיל הן תבנית-ייחוס לייצוא-DXF נקי משלנו.

**[חדש] פרופיל שנוסף ב-9505:** `Profiles\Rooms_Default _Port` — פרופיל-חדרים **בפורטוגזית**.
> **חשוב ל-Soline:** מאשר דחיפה רב-לשונית (שוק ברזיל/פורטוגל) — לא רלוונטי ישירות, אך מלמד שהמנוע מתוחזק פעיל.

**הוסר ב-9505 (היה ב-9504):** `Profiles\SOLINE` ו-`Profiles\Rooms_IFC_DIM_Soline` (פרופילי-Soline הישנים). נשאר `Profiles\1_SOLINE`.
> **חשוב ל-Soline:** לוודא שפרופיל-ה-Soline הפעיל (`1_SOLINE`) מכיל את השכבות/הגדרות הנכונות; הפרופילים הישנים סולקו.

---

## 6. [חדש] מוצר-נלווה חדש: **Measure Manager (ETMM)** — לא היה מתועד כלל

בנתיב **`C:\Program Files (x86)\Measure Manager`** מותקן מוצר-מדידה נפרד לחלוטין שלא הוזכר באף מסמך קודם:

- **מהו:** **ETMM** (Template/Enterprise Measure Manager) — חבילת-CAD מבוססת **Kubotek KeyCreator / CADKEY** (`ETemplateMeasureMgr.exe` 2024-09-08, `ETMM.exe` 2024-09-18, `KCore.dll` 12MB, `SpaACIS.dll`+`PSKERNEL.dll` — גרעין-ACIS/Parasolid). מיועד למדידת-שדה ותבניות לייצור-אבן/קאונטרטופ (מקביל-ומתחרה ל-InnoDraw CT).
- **גשר-חומרה:** `ETMM_Toolbar\LeicaBridge` — **גשר-Leica** (אותו לייזר-DISTO של InnoDraw).
- **[חדש] אינטגרציית-CRM/ייצור:** בסרגל-הכלים לקוחות-אינטגרציה: `MorawareClient.exe` (Moraware — CRM/JobTracker לתעשיית-האבן), `JobTrackerAPI4.dll`, `ExcelClient.exe`, `BizopsClient.exe`.
- **[חדש] ריבוי פורמטי-ייצוא CAD** (תיקיות-מנוע): DXF, DWG (`DwgDxfTrans.dll`), IGES (`KeyIGES.dll`), STEP (`KeySTEP.dll`), STL (`KeySTL.dll`), OBJ, U3D, VRML, CATIA, ProE, UG, INV (Inventor), KXL — וגם **פלט-CNC/NC** (`NCOut`, `Post\` עם עשרות פוסט-פרוססורים למכונות: Fanuc, Haas, Siemens, Heidenhain, WEDM…).

> **למה זה חשוב ל-Soline (משמעותי):**
> 1. **גשר-Leica כפול** — גם InnoDraw וגם ETMM מתחברים לאותו DISTO; מאשר שה-BLE שלנו במקום הנכון.
> 2. **Moraware/JobTracker** — זהו ה-CRM/מעקב-עבודות של תעשיית-האבן העולמית; אם לקוחות-יעד עובדים מולו, זה יעד-אינטגרציה או תחרות ישירה ל-`ADMIN_DASHBOARD`/`.sol`.
> 3. **ריבוי-פורמטים (IGES/STEP/CATIA/CNC)** — ETMM מוכיח שהשוק המקצועי מצפה לייצוא-ייצור אמיתי (STEP/DXF→CNC). ה-delta של Soline (PDP נייטיבי + DXF-2D) עדיין ייחודי, אך כדאי לתעד את IGES/STEP כיעד-עתידי אפשרי.

---

## 7. פערים שלא השתנו (לשקיפות)

- **ELC_SND (שולח-לענן):** תיקיית `ELC_SND_3` קיימת כמתועד; ללא שינוי מהותי.
- **חומרה:** אותו Leica SDK, OpenCV, USD_USB, 3D-Bridge כמתועד.
- **מדריכים/תפריטים:** אותם `eLMenu*`, `eLToolTips*`, קטלוג-כיורים (60+ יצרנים) — ללא שינוי.

---

## 8. סיכום — פריטי-[חדש] שתועדו

1. מיפוי קודי-ID מלא לכל אלמנט (§1)
2. פענוח קודי-הארונות CW/CB/CT·1D/2D·DR (§2)
3. תת-קטלוג-שקעים מורחב (110V/220V/GFI/Ceiling/Arc-Fault) (§3)
4. וריאנטי-חלון עם כיווניות In/Out·R/L (§3)
5. אלמנטי-חשמל חסרים (Control Box/DoorBell/Can_Light/Duplex×3/Circular Column) (§3)
6. טקסונומיית Class/Type מלאה (5 זוגות) (§4)
7. פרמטרי-חריץ SLOTDX/DY/X/Y (§4)
8. פרופיל-נגרות-עברית חדש `Cabinetry_Default_CadNet_Heb_4` (עודכן היום) (§5)
9. פרופיל-חדרים פורטוגזית חדש (§5)
10. מוצר Measure Manager / ETMM שלם — גשר-Leica + Moraware/JobTracker + ריבוי-CAD/CNC (§6)

**סה"כ: 10 קטגוריות-ממצא חדשות** מעבר לתיעוד הקיים. הפירוט האלמנטי המלא הוזרם ל-`ORDX_ELEMENT_SPEC.md`.

---

## נספח — מקורות-ראיה
- `C:\Program Files (x86)\InnoDraw\EL_CAD_9505_0050_0005_0005_ktn\` (eLCad.exe 2026-06-30; `eLObstaclesIconsCategories*.tx~`; `eLObstaclesIconsEn.tx~`; `Profiles\Cabinetry_Default_CadNet_Heb_4`, `Profiles\Rooms_Default _Port`).
- `C:\Program Files (x86)\InnoDraw\EL_CAD_9504_...` ו-`El_Cad--1` (השוואת-בסיס).
- `C:\Program Files (x86)\Measure Manager\ETMM\` (ETMM.exe, ETemplateMeasureMgr.exe, ETMM_Toolbar\LeicaBridge, MorawareClient.exe).
- הצלבה מול: `INNODRAW_FEATURES.md`, `CVSM_FEATURES.md`, `CVSM_EXPORT_CRACK.md`, `ELEMENT_CATALOG_MERGED.md`.
</content>
