# CVSM_DEEP_STUDY — מחקר-עומק של CVSM / InnoDraw ומפת-דרכים ל-Soline

> **מטרה:** ללמוד לעומק את תוכנת **CVSM / InnoDraw (ElCad)** המותקנת במכונה + שני המדריכים הרשמיים (KB&B ו-CounterTops), ולהפיק **רשימת-פיצ'רים מדורגת** למימוש ב-Soline. Michael רוצה לממש **~90%** מהיכולות של CVSM.
> **שיטה (READ-ONLY):** קריאה עמוד-אחר-עמוד של שני המדריכים (חילוץ-טקסט מלא של 50+94 עמ' עם מספרי-עמוד), קריאת קבצי-התפריט (`KTN/eLMenuEn.tx~` = KB&B, `eLMenuEn.tx~` שורש = CounterTops), ה-tooltips (`eLToolTipsLblsEn.tx~`, 96 פקודות), קטלוג-האלמנטים (`eLObstaclesIconsCategoriesEn.tx~` — 8 קטגוריות/~80 אייקונים), ספריית-הסמלים (`Icons\` — 251 DXF), ספריות-הכיורים/החיתוכים (`Sink\` 50+ יצרנים, `Cutouts-Metric\` R6/R7/R10/R13/Slots), וה-cfg (Layers/Edges/Areas/CompBranch).
> **בונה על (לא חוזר על):** `CVSM_FEATURES.md` (קטלוג אפליקציית-המובייל + סטטוס), `INNODRAW_FEATURES.md` (קטלוג הדסקטופ), `CVSM_5.6_UPDATE.md` / `CVSM_5.9_UPDATE.md` (דלתות: DimTier, Cabinets, ShapeSolver, Catalog-Editor), `CVSM_ELEMENT_SCHEMA.md` / `ORDX_ELEMENT_SPEC.md` (סכימת-ORDX), `PDF_REPORT_SPEC.md`, `X6_CAPABILITIES.md`.
> **מצב-Soline נמדד מול:** `HANDOFF-measure.md` + `app-measure/.../catalog/ElementCatalog.kt` (63 אלמנטים) + `MaterialLibrary.kt` (71 חומרים).
> גרסה 1.0 · 2026-08-21 · עברית · לשון זכר.

---

## 0. תמונת-על — מה CVSM באמת ומה כדאי לגנוב

CVSM/InnoDraw הוא **מנוע-CAD למדידה, שרטוט ותבניות (templating)** לשוק המטבחים/אמבטיות ובעיקר **ייצור משטחי-אבן**. שני בינאריים על אותו מנוע: **KB&B** (`eLCad_ktn.exe` — מטבחים/אמבטיות/חדרים) ו-**CounterTops** (`eLCad_ct.exe` — משטחים). זהו האב של פורמט-המדידה ORDX ושל אפליקציית-המובייל CVSM שכבר פענחנו.

**עקרון-העל של CVSM (ה-DNA שלו):** משרטטים צורה **גסה** (פרופורציות בלבד), ואז **קובעים גאומטריה מדויקת ע"י מדידות-משנה** — לא ע"י גרירה. קו **אדום** = אורך לא-נקבע, **צהוב** = נקבע. כל מדידה מוזנת ל"קצה-נבחר" (swipe → red-arrow) והצד השני נשאר קבוע. זה מה שהופך מדידת-שטח לא-מדויקת לשרטוט-הנדסי מדויק (KB&B p5, p9; CT p10, p16).

**מה שווה לגנוב (הליבה למדידה):** מנוע ה-Datum/Resize (Line Orientation by Reference, Corner by Distance, Angle by Distances), מצב-חזית (Wall Front View), קטלוג-האלמנטים העשיר עם שדות-תלויים אוטו-מחושבים, ה-DSTO auto-transfer, סגירת-היקף (Close-Auto/Attach), אימות (Final Verification), וקווי-מידה מקצועיים.
**מה שווה לגנוב חלקית:** ספריית-כיורים 60+ יצרנים, פרופילי-קצה (Edge), overhang כ"סובלנות", ארונות (Cabinet templates).
**מה לדלג במפורש:** מנגנון-ייצור-האבן (Miter על סוגיו, Seam/Break, Slope-Cut, Drainer-Groove), דונגל-USB + שרת-המרה של InnoDraw, מקודד-USB/Com-Port (הוחלף ב-BLE). *אלה כ-10% שלא מיישמים.*

---

## §1 — מפת-הפיצ'רים של CVSM (מקובצת לפי תחום)

לכל פיצ'ר: מה עושה · איך CVSM עושה (ציטוט עמוד-מדריך / תפריט / קובץ).
מדריכים: **KBB p** = InnoDraw KB&B Rev 3.05 · **CT p** = CounterTops Rev 3.04.

### 1.1 מבנה-פרויקט: Job / Area / Profile
| פיצ'ר | מה עושה / איך | מקור |
|---|---|---|
| **New → Job / Area** | דיאלוג-יצירה: Job חדש, או Area בתוך Job קיים (Job חייב להיפתח כדי להוסיף Area) | KBB p2–3; CT p7–8; `File/New` |
| **Job Information (7 שדות-חובה)** | Profile · Job Name · Job Area · Job Company · Branch · **Drawn By** · **Measured By** — **שרטוט לא-מאופשר עד שכולם מוזנים** | KBB p2; CT p7 |
| **Job Area drop-down** | סוג-אזור (Kitchen/Bath/Island/Shower…) קובע תבנית וברירות-מחדל | KBB p3; `Areas.txt` (Kitchen/Island/Bath/Shower…) |
| **Profile** | פרופיל-לקוח/מפעל שקובע קטלוג, יחידות, שכבות, edges | KBB p2; `Profiles\` (Rooms_IFC / Worktops_Default_L) |
| **שם-קובץ אוטומטי** | `[Job]_[Area]_[Company]_[Branch]_DR1.elc` | KBB p3; CT p8 |
| **קבצי-טקסט להתאמה** | JobInfo.txt · CompBranch.txt · Areas.txt · Labels.txt (עורכים ברירות-מחדל של הדיאלוגים) | KBB p3 |
| **Units & Precision** | Format/Units → Imperial/Metric (+דיוק-שברים ל-Imperial). **לא ניתן לשנות אחרי שהתחיל שרטוט**; נשמר per-drawing | KBB p4; CT p9 |
| **Company Info / Setup** | פרטי-חברה על השרטוט וב-PDF | KBB p41; `Setup/Company Info` |
| **Save Inc / Save Config / Save Piece / Import Area** | שמירה-מצטברת (גרסאות), שמירת-קונפיג-כתבנית, שמירת-חלק, ייבוא-אזור | menu `File` (KTN) |

### 1.2 מצבי-מדידה (Capture)
| פיצ'ר | מה עושה / איך | מקור |
|---|---|---|
| **Manual** | שרטוט-יד + מדידת-סרט + הזנה ידנית (זיהוי-כתב/מקלדת); מוצמד לקצה ב-Apply | KBB p8; CT p12 |
| **Semi-Automatic (Laser/DSTO)** | שרטוט-יד, DSTO ממלא מידות אוטומטית (Tools/Options/Measure Device→Laser) | KBB p8; CT p13 |
| **Automatic (Elco)** | שרטוט **וגם** נתונים אוטומטיים (מערכת Elco+DSTO על חצובה) | KBB p8; CT p26–33 |
| **Measure-Device Toggle** | מעבר Elco↔Laser כשהמכשיר כבר מחובר | KBB p8; CT p13 |

### 1.3 כלי-שרטוט (Sketch / Line / Close)
| פיצ'ר | מה עושה / איך | מקור |
|---|---|---|
| **Sketch / Select modes** | Sketch=ציור-קצוות; Select=בחירה+הזנת-מידה. כל-אחד מבטל את השני; Select אוטומטי אחרי Close | KBB p5; CT p10 |
| **Swipe-select + endpoint** | swipe על קו בוחר קו (מקווקו) + **קצה** (חץ-אדום = הקצה שיזוז). box-select = לחצן-ימני | KBB p5; CT p10 |
| **Bidirectional resize** | צ'קבוקס — שני הקצוות זזים; עם Relative חצי-חצי | KBB p6; CT p10 |
| **Orthogonal mode** | הקו-הבא ב-90°; פינות-90° נשמרות בכל שינוי | KBB p9,42; CT p10,78; `Draw/Line/Orthogonal` |
| **Diagonal mode** | קו בזווית-חופשית; משחרר את מגבלת-90° | KBB p12,42; CT p16 |
| **Close: Auto / Manual / Open area** | Auto=מאריך קצה-ראשון+אחרון עד חיתוך; Manual=משלים צלע-אחרונה; Open=אזור-פתוח | KBB p9,42; CT p77; `Draw/Close` |
| **Close And Offset** | סוגר ומייצר צורה-מקבילה בהיסט (equal-depth) | menu `Draw/Close`; CT p77 |
| **Arc (קו-קשת)** | צלע כקשת: base-length + **depth (Sagitta)**; In/Out 0=קעור 1=קמור | CT p47; menu `Draw/Line/Arc` |
| **Multi-Line** | פוליליין למדידת קו/קיר לא-ישר (נקודות ניצבות מבסיס) | CT p34,59; menu `Multi Line` |
| **Best Fit Line** | קו-מיטבי מ-multiline (≥3 נק', אלגוריתם + חלון-סבילות) | CT p31,77; KBB p42 |
| **Doorway / Passage** | הופך צלע-קיר לפתח (וחזרה); לפני-tap או swipe קיים | KBB p10; `Draw/Line/Doorway` |
| **Data-Entry window** | שדות ±value, Length, בורר-שיטה **Angle/Length** (Length=אלכסון לקצה-שכן), Relative, Bidirectional, Apply | KBB p6; CT p11 |
| **קלט Pen/Tablet** | מצב-מקלדת (הקשה) / מצב-tablet (כתב-יד) | KBB p7; CT p12 |
| **צבע-דטרמיניזם** | אדום=לא-נקבע · צהוב=נקבע · מקווקו=נבחר · חץ-אדום=קצה-נבחר | KBB p5,9; CT p13 |

### 1.4 מנוע Datum / Resize מתקדם ⭐ (ה-DNA של InnoDraw)
> קובעים גאומטריה מדויקת ע"י מדידות-משנה מקווי-ייחוס/Datum במקום גרירה. שווה-זהב לדיוק-שטח.

| פיצ'ר | מה עושה / איך | מקור |
|---|---|---|
| **Scale** | קנה-מידה של כל האזור לפי אורך-קו-נבחר (פעם-אחת לצורה) | CT p14,16; `Measures/Scale` |
| **Line Orientation by Reference** | קובע **כיוון-צלע** מול קו-קבוע ע"י 2 מדידות-ניצבות H1,H2 מ-P1,P2 | CT p54–55; `35007` |
| **Set Line by Reference** | קובע צורה **טרפזית שלמה** בפקודה-אחת (L1,H1,L2,H2) | CT p56; `35008` |
| **Set Corner by Distance** | קובע **נקודת-פינה** במרחק D מנקודת-ייחוס בלי לשנות כיוון-הקו (פותר את שתי-האפשרויות) | CT p56–58; `35010` |
| **Angle by Distances** | קובע **זווית** בין 2 קווים ע"י אלכסון D בין נק'-ביניים (טרילטרציה; היסטים-ארוכים=דיוק-גבוה) | CT p62; `35011` |
| **Datum Lines / Line Orientation from Datum / Set Corner from Datum / Datum Corner / Position by Datum** | קווי-אפס (X,Y) שכל המידות נמדדות מהם — מערכת-קואורדינטות-שטח | menu KTN `Dimensions/Datum Corner`; CT p79–82; `35063–35067` |
| **Lock Line** | נועל אורך-קו כדי שresize-שכן לא ישנה אותו | CT p61; `35107` |
| **Line to Multi-Line** | ממיר קו לפוליליין (מדידה מבסיס לקיר לא-אחיד) | CT p59; `35075` |
| **Level Horizontal / Vertical** | מסובב את כל האזור כך שקו-נבחר אופקי/אנכי (=יישור-חדר-לציר) | KBB p40; CT p75; `35025/35026` |
| **Rotate** | סיבוב סביב-ציר בזווית נתונה | KBB p41; CT p75 |
| **Relative Resize / Overhang / Bump-out** | הרחבת-שפה במידה (כמו Offset ב-AutoCAD); ערך-שלילי = סובלנות בין-קירות | CT p50–52,79; `35013/35038` |

### 1.5 חדר / קירות / גבהים
| פיצ'ר | מה עושה / איך | מקור |
|---|---|---|
| **Room Height + Floor Level** | גובה-חדר כללי (ערך-מינימלי לתקרה-לא-אופקית) + **הפרש-Z לרצפת-אפס** (חיבור חדרים ברמות שונות, מדרגה למוסך) | KBB p9–10; `35030` |
| **Wall Height (Left/Right)** | גבהים שונים בשני קצוות — **קיר-נמוך / תקרה-משופעת**; בחירת החלק-הנמוך ע"י swipe 2 קווים+Finish | KBB p13–14; `35028` |
| **Wall Width** | עובי-קיר | `35031`; menu `Room/Wall Width` |
| **Marker Line + Height** | אובייקט-מלבני-צמוד-קיר לכל-האורך: **סוֹפִיט**, קורה, תעלת-מזגן, מדף, **נישה** (Setback/Bottom-to-Floor/Height/Top-to-Ceiling) | KBB p25–26; `35033/35036` |
| **Column (Rect/Circular)** | עמוד: Width, offset, Back/Front-to-Wall, Bottom/Top | KBB p29–31; obstacles `Rectangular Column`/`43` |
| **Pole / Pole Auto Detect / Pole Height** | סימון-קצה-כעמוד, זיהוי-אוטומטי, גובה | menu `Room`; `35071/35072/35110` |
| **Stairs / Staircase** | מדרגות: Depth/Total, Height/Total, Amount, Initial-Height, In/Out, Up/Down | KBB p32–33; obstacles `Stairs/35` |
| **Exterior Walls** | ציור קירות-חוץ (עובי נפרד) | menu `Room/Exterior Walls`; `35082` |
| **Move Floor** | הזזת-מפלס-רצפה (Z) | menu `Room/Move Floor` |
| **Cabinet stops** | סימון עצירות-ארון על קיר | `35061`; menu `Cabinet stops` |
| **Safety Room Entrance / Beam** | כניסת-ממ"ד, קורה | obstacles `14`/`163` |

### 1.6 מצב-חזית (Wall Front View / Elevation) ⭐
| פיצ'ר | מה עושה / איך | מקור |
|---|---|---|
| **Wall Front View** | יוצר **מבט-חזית** לקיר-נבחר (swipe → Wall Front View → Parts → P/W). **דורש שגובה-חדר וכל-הגבהים מוגדרים**. חזיות **לא** מתעדכנות אוטומטית — יש למחוק וליצור-מחדש | KBB p26,29,40; `35029` |
| **Parts** | תצוגה-מהירה של חלקי-שרטוט; פותח את מבטי-החזית | KBB p41; CT p76 |
| **מידות-חזית** | אביזרים/שקעים עם Bottom-to-Floor/Height/Top-to-Ceiling מרונדרים בחזית | KBB p26 |

### 1.7 קטלוג-אלמנטים / מכשולים (Obstacles) ⭐
> **8 קטגוריות, ~80 אייקונים** (`eLObstaclesIconsCategoriesEn.tx~`). כל אלמנט נוסף באותו-אופן: Select → swipe קיר-ייחוס (ליד הקצה-הנמדד) → **Obstacles** → הרחב קטגוריה `+` → בחר → מלא property-dialog → Apply/Ok. **שדות ריקים מחושבים אוטומטית** מאורך/גובה-הקיר + שאר-הערכים.

| קטגוריה | אלמנטים (מהקובץ) | מקור |
|---|---|---|
| **Construction** | Window · Door · Rectangular Column · Beam · Stairs · **Safety Room Entrance** | cat 2; KBB p16–33 |
| **Electrical** | Socket · SocketEx(+) · Switch · SwitchEx · Junction_Box · Power Line · Power Box · Phone · PhoneEx · Intercom · TV · Lighting | cat 3; KBB p22 |
| **Plumbing** | Sink · Faucet · FaucetX2 · Bath · Bidet · Shower · Toilet · Sewage · Sewer-drainage · Gas · Water Pipe · Sprinkler | cat 4; KBB p27 |
| **HVAC** | Air Condition · Air Opening · Radiator · Vent | cat 5 |
| **Appliances** | Refrigerator · Oven · Microwave · Gas Range · Electric Range · Dishwasher · Washer | cat 6 |
| **Furniture** | **Cabinet** (7 טיפוסי-סמל: CW1D/CW2D/CT1D/CB1D/CB2D/CB2D-2DR/CB1D-1DR) | cat 7; `Icons\Cabinet_*` |
| **Misc** | Bump · Depth · Marker · **ShutterBox (ארגז-תריס)** · **Window Sill (אדן)** · Panel-to-Panel · Reserved | cat 8 |
| **Duplicate** | Duplicate Offsets · Duplicate Heights | cat 1 |

**Property-dialogs מפורטים (עם auto-calc):**
- **Window** (KBB p16–18): Offset selected/opposite corner, Width(±trim), Bottom-to-Floor, Height, Top-to-Ceiling + **קבוצת ShutterBox** (offset/width/setback/heights) + **קבוצת Sill** (offset/width/setback/heights) + Notes.
- **Door** (KBB p19–21): + **Door Style** (Opening/Hinged Single), **In/Out**, **Left/Right** (צד-ציר) + ShutterBox.
- **Socket / Socket+** (KBB p22–24): שתי-שיטות — **Socket=לפי-מרכז** (Offset/Setback/Height), **Socket+=לפי-קצוות** (close/far edge + bottom/top). סוג נבחר מ-drop-down.
- **Bath / Column / Stairs**: Back-to-Wall / Front-to-Wall + הפרמטרים לעיל.

**ספריות ייעודיות:** `Sink\` — **50+ יצרנים** (Blanco/Franke/Kohler/Elkay/Duravit/Toto/Kraus…) ב-Imperial+Metric. `Cutouts-Metric\` — Sockets **R6/R7/R10/R13** + **Slots** (חיתוכים לפי-רדיוס). `Icons\` — **251 DXF** (דלתות: Hinged/Bifold/Pocket/Sliding × Left/Right/Double × In/Out; חשמל/אינסטלציה/מוצרים).

### 1.8 ארונות / Carcass
| פיצ'ר | מה עושה / איך | מקור |
|---|---|---|
| **Kitchen (cabinet templates)** | תבניות-ארונות מוכנות | KBB p43; menu `Lists/Kitchen`; obstacles `Cabinet/44` |
| **Capture original cabinet/carcass** | נועל מידות-ארון-מקורי ושומר קווים כצורה-דהויה מתחת; ללא-בחירה = כל-הארונות; **יוצר קובץ .DR2**. לפני overhang | CT p25; menu `Original cabinet`; `35108/35109` |
| **מודל-ארונות מלא (מובייל 5.6+)** | Cabinet · CabinetType(19) · CabinetClass(5) · FaceType(6) · HingeSide(3) · DoorSwing · CornerCabinetShape · `<Assembly>` ל-ORDX | `CVSM_5.6_UPDATE.md §1`; `CVSM_ELEMENT_SCHEMA §5` |

### 1.9 משטחים (CounterTops — ייצור-אבן) 🔶 *(רובו מחוץ-לתחום-Soline)*
| פיצ'ר | מה עושה / איך | מקור | לנו? |
|---|---|---|---|
| **Template-Based Drawing** | Kitchen → תבנית (Countertop 2…) → Scale → offsets | CT p13–15 | ✔ אשף-תבניות |
| **Overhang + Edge-Return** | הרחבת-משטח מעבר-לארון; ערך-שלילי=סובלנות | CT p50–53 | ✔ בליטה/סובלנות |
| **Edge Function** | פרופיל-קצה מדרופ-דאון + עובי; קו-ירוק + `+5" B 10` | CT p53; menu `Tools/Edges` | 🔶 חלקי |
| **Add Cutout (Rect/Circle)** | חיתוך: Length/Radius + Offset/Setback + **Insertion Point** (L/M/R) | CT p64–66 | ✔ חיתוכים |
| **Add Notch / Add Sink** | מגרעת / כיור מהספרייה (+בדיקת-מרחק-מגב) | CT p67–69 | ✔ כיור |
| **Backsplash** | יוצר גב-משטח (גובה+שוליים מ-Options/Edges) | CT p75; menu `Back Splash` | 🔶 |
| **Arc / Chamfer / Round Corner** | עיבוד-פינה (רדיוס/קיטום/עיגול) | CT p47–49 | ✔ פינות-קיר |
| **Seam/Break/Miter/Slope-Cut/Drainer-Groove** | תפרי-הדבקה, מיטרים אירופיים, חיתוך-משופע, חריץ-ניקוז | CT p69–74,81 | ❌ ספציפי-אבן — **דלג** |

### 1.10 מידות ואימות (Dimensions & Verification)
| פיצ'ר | מה עושה / איך | מקור |
|---|---|---|
| **Point-to-Point** | מרחק נק'↔נק' (שתי-פינות) | KBB p43; CT p81; `35100` |
| **Point-to-Line** | המרחק-הקצר (ניצב) מנק' לקו | `35101` |
| **Point-to-Line Projection** | מקצה-קו להיטלו על קו-אחר | `35102` |
| **Perpendicular from a Line** | מנק' לקו, ניצב-למקור | `35103` |
| **Maintain Dimension** | הפיכת מידה-רגעית לקבועה-בשרטוט | KBB p44; `35104` |
| **Line / Angular / Radius / Diameter Dimension** | אורך-קו / זווית-בין-קווים / רדיוס / קוטר | KBB p43–44; `35040/35105–06/35068` |
| **Datum Corner** | סימון-קואורדינטות מ-Datum | CT p82; `35067` |
| **Align dimensions** | יישור קווי-מידה-נבחרים (PDF נקי) | `35060` |
| **Select Dimension Label** | הזזת-תווית-מידה על קו-המידה | KBB p41 |
| **Final Verification / Calc** | **אימות-סופי + חישוב-תוכנית** לפני ייצוא | menu KTN `Dimensions/Final Verification`; `35042/35073` |
| **Verification Measures Mode** | מזין מידה-מתוקנת (מוצגת בסוגריים מתחת למקור) → resize | CT p24,79 |

### 1.11 לייזר DSTO / Elco
| פיצ'ר | מה עושה / איך | מקור |
|---|---|---|
| **Semi-Automatic Outline** | משרטטים היקף בלי-מידות → swipe-קו → ירי-DSTO → **Bluetooth** מעביר (בלי Apply) → **Next Line CCW/CW** | KBB p34–36; CT p37–38 |
| **DSTO button-map** | Zero front/back · Diagonal/Orthogonal · Undo/Redo · Next-Line CCW/CW · Properties Up/Down · **Transfer** | KBB p34–35; CT p37 |
| **New Origin (Relocate)** | העברת-הלייזר לעמדה-חדשה באמצע-מדידה (3 מדידות על 2 קצוות לא-מקבילים) | CT p35–36; `35041` |
| **Combine** | מיזוג 2 מדידות/צורות (multi-origin) | menu KTN `Measure device/Combine`; `35044` |
| **Best Fit / T-Targets / L-Targets** | ≥3 נק' לקצה + מטרות-הרחבה + חלון-סבילות | CT p30–33 |
| **Reset / Reconnect / Shut Down** | ניהול-חיבור | KBB p34; CT p76 |

### 1.12 ייצוא / פלט / דיווח
| פיצ'ר | מה עושה / איך | מקור |
|---|---|---|
| **`.elc` native** | פורמט-מקור בינארי (אב-ORDX/PDP) | KBB p3; CT p8 |
| **ELC_SND → DXF/PDF/ORDX** | שליחת `.elc` **לשרת-ענן** של InnoDraw → החזרת DXF+PDF (+Pictures&Documents) | KBB p37–39; CT p44–45 |
| **BOM (Bill of Materials)** | כתב-כמויות (`eLBomView`) | menu `View/Bom` |
| **Audit Sheet / Inspection Summary** | גיליון-ביקורת + סיכום-בדיקה | menu `View/Audit Sheet`; `AuditSheet.cfg` |
| **Lists** | Cut-Out/Notch/Fill/Markers/Windows/Drainer-Grooves/Labels/Drawn-Items/Kitchen-Labels — טבלאות-ניהול | menu `View/Lists` |
| **View Layers** | עריכת **טיפוסי-קו + צבעי-DXF** (הזנה ל-DXF) | KBB p40; `Layers.cfg`, `eLLineTypes.lin` |
| **Print / Print Preview / Page Setup** | הדפסה-ישירה | menu `File` |
| **מובייל 5.6+: HtmlExporter / PdfExporter / DimTierEngine** | דוח-HTML אינטראקטיבי (RTL+3D) + PDF מדור-חדש עם **מידות-מדורגות** (detail→spans→total) + `PdfSymbolRenderer` | `CVSM_5.6_UPDATE.md §2`; `PDF_REPORT_SPEC.md` |

### 1.13 ניהול-קטלוג וספריות
| פיצ'ר | מה עושה / איך | מקור |
|---|---|---|
| **Obstacles list** | ספרייה מקובצת (8 קטגוריות, `+`-expand) | KBB p16; `eLObstaclesIconsCategoriesEn.tx~` |
| **Standard Cutouts / Notches / Sinks** | ספריות-חיתוך/מגרעת/כיור | CT p64–69,81 |
| **Fill (Material Labels)** | מילוי-חומר/גוון לצורה | CT p81; menu `Fill` |
| **Digital Pictures repository** | שיוך-תמונות-לשרטוט | KBB p41; menu `Pictures` |
| **Catalog Editor (מובייל 5.9)** ⭐ | עריכת ברירות-מחדל של אלמנט-מובנה + **שכפול-אלמנט → וריאנט אישי** (`CatalogVariantManager`/`CatalogDefaultsManager`); דפוס: רשימה-מקובצת + 'שלי'-בתחתית + Sheet-עריכה + reset | `CVSM_5.9_UPDATE.md` |
| **Custom CAD Symbols (מובייל 5.9)** | עורך-תאום לסמלי-CAD (`CustomSymbolManager`) | `CVSM_5.9_UPDATE.md §5` |

### 1.14 הגדרות (Tools/Options)
מבנה: **Edges · Fonts · Colors · Overhang · Resize · Text · Measure Device · H.W. · Embedded · Measures/View** (CT p83–90).
- **Edges** (p83): Label-Position In/Out, Bold-Edge, Backsplash Height/Margins.
- **Resize** (p85): Measuring-Mode (Engineering/Mono-polar/Bipolar), Lines-by Corner/Points, **Angle-Range** (אזהרת-שינוי-חריג).
- **Text** (p86): שפה **English/Hebrew** + Print-Footer.
- **Measure Device** (p87): Com-port, timeouts, **Laser-direction** (Above/Below), **Calibration-factor**.
- **Embedded** (p88): Default-Position לחיתוכים (L/M/R), Lock-Toolbars.
- **Measures/View** (p90): Measure-Min-Length (הסתרת-מידות-קטנות), הצג-מידות-ל Sinks/Cutouts/Notch/Diagonal/Source-Lines.

### 1.15 UI / ניווט / תצוגה
Zoom In/Out/Window/Reset/Image · Pan · Full-Screen · Undo/Redo (עד-20 במובייל) · First/Next/Previous (ניווט-קווים) · Show/Hide Piece · Select-All (עותק בין-קבצים) · Scale-Ruler · Block (קיבוץ) · Layers · Refresh (KBB p40–41; CT p75–79; menu `View`).

---

## §2 — ניתוח-פערים מול Soline (✅ יש · ◐ חלקי · ⬜ חסר)

> נמדד מול `HANDOFF-measure.md` + `ElementCatalog.kt` (63) + `MaterialLibrary.kt` (71) + מנוע-הצפייה בממיר.

### 2A מבנה-פרויקט ומדידה
| פיצ'ר CVSM | Soline | הערה |
|---|---|---|
| Project/Room · New · Delete | ✅ | Project/RoomEntity |
| Job Information מלא (Drawn/Measured By, Company, Branch, Profile) | ⬜ | אין שדות-CRM; קריטי ל-.sol/דוח |
| Job Area (סוג-חדר) + ברירות-מחדל | ◐ | חדר קיים, אין "סוג" מובנה |
| Units/Precision (מ"מ/ס"מ/אינץ') | ◐ | מ"מ; אין בורר-דיוק |
| Manual / Semi-Auto / P2P capture | ✅ | שרטוט-חי, חצי-אוטומטי, P2P (StationSolver) |
| DSTO/Elco auto-transfer ל-BLE | ✅ | LaserBle (X6/D2/Bosch) + injection-לשדה |
| New Origin (Relocate) / Combine | ◐ | P2P כיול-עמדה קיים; אין relocate-רשמי |
| Save Inc (גרסאות) / Import Area | ⬜ | יש BackupManager ZIP בלבד |

### 2B שרטוט וגאומטריה
| פיצ'ר CVSM | Soline | הערה |
|---|---|---|
| Sketch/Select · swipe-select+endpoint | ✅ | RoomPlanCanvas |
| Orthogonal/Diagonal · **נעילת-90° אמיתית** | ◐ | שרשרת קיימת; אין ⊾-lock |
| Close Auto/Manual/Open · **Attach/T-Join** | ◐ | WallCloseTools (חיבור-T/סגירה) — לא-מלא כ-Close-Auto |
| Data-Entry Angle/Length + Relative + Bidirectional | ◐ | עריכת-מידות קיימת; אין בורר-Angle/Length מלא |
| **Arc wall / Round Corner / Chamfer** | ⬜ | קירות-ישרים בלבד |
| **Multi-Line / Best-Fit / Line-to-Multiline** | ⬜ | אין קיר-לא-ישר |
| דטרמיניזם אדום/צהוב | ◐ | WallBuilder אורך-אמת; אין feedback-צבעי מפורש |

### 2C מנוע Datum/Resize ⭐
| פיצ'ר CVSM | Soline | הערה |
|---|---|---|
| Scale (קנה-מידה לפי-קו) | ◐ | |
| **Line Orientation by Reference** | ⬜ | דיוק-יישור-קיר חסר |
| **Set Line by Reference** (טרפז) | ⬜ | |
| **Corner by Distance** (טרילטרציה) | ◐ | Trilateration.kt קיים כמנוע; אין כלי-UI |
| **Angle by Distances (משולש-הזהב)** | ✅ | StationSolver "משולש-הזהב" |
| **Datum Lines / from-Datum / Datum-Corner** | ⬜ | אין מערכת-קואורדינטות-Datum |
| Lock Line / Level Horizontal-Vertical / Rotate | ⬜ | אין יישור-חדר-לציר |
| Overhang/Bump-out (בליטה/סובלנות) | ⬜ | |

### 2D קירות / גבהים / חדר
| פיצ'ר CVSM | Soline | הערה |
|---|---|---|
| Room Height + Floor Level (Z) | ✅ | FloorLevelSolver (Z=d·sinθ) |
| **Wall Height L/R (קיר-נמוך/משופע)** | ⬜ | גובה-אחיד בלבד |
| **Marker Line (סופיט/קורה/נישה)** | ◐ | אלמנטי CEILING_DROP/PANEL; אין marker-line-לאורך-קיר |
| Column (Rect/Circular) / Pole | ✅ | COLUMN/COLUMN_ROUND בקטלוג |
| Stairs / Beam / Safety-Room | ⬜ | חסרים בקטלוג |
| Exterior Walls / Wall Width | ◐ | thickness ברירת-מחדל |
| Cabinet stops | ⬜ | |

### 2E מצב-חזית (Elevation) ⭐
| פיצ'ר CVSM | Soline | הערה |
|---|---|---|
| **Wall Front View** | ✅ | WallElevationUnified (חזית-מאוחדת) |
| שכבת-תכנון + **זיהוי-התנגשויות** | ✅ | **יתרון-על-CVSM** — ElevationFit (ארון↔תשתית אדום) |
| מדידת-חזית X6 | ✅ | |
| מידות-חזית מדורגות (DimTier) | ⬜ | אין detail→spans→total |
| שורות-3-גבהים (HeightBands) | ⬜ | |

### 2F אלמנטים / קטלוג
| פיצ'ר CVSM | Soline | הערה |
|---|---|---|
| קטלוג-אלמנטים מקובץ | ✅ | ElementCatalog 63 (9 קבוצות) + **מטבח-חוץ (22)** יתרון |
| Socket center/edge (2 שיטות) | ✅ | ElementMeasureFields (מרכז/היסטים) |
| Window/Door property-dialogs (ShutterBox/Sill/Hinge/In-Out) | ◐ | פתחים בסיסיים; אין ShutterBox/Sill/Hinge-side |
| ספריית-כיורים 50+ יצרנים | ⬜ | כיור-גנרי בלבד |
| Cutouts R6/R7/R10/R13 + Slots | ⬜ | |
| **Catalog Editor + שכפול-וריאנט (5.9)** | ✅ | CustomElementStore + ElementLibraryScreen (מחקה 5.9) |
| CAD-Symbols library | ◐ | סמלי-ויז בממיר; אין עורך-סמלים |
| Beam/Safety-Room/Window-Sill/ShutterBox | ⬜ | |

### 2G ארונות
| פיצ'ר CVSM | Soline | הערה |
|---|---|---|
| Cabinet Base/Wall/Tall + מיקום | ✅ | CabinetEntity + CabinetKind (11 OK_* מטבח-חוץ) |
| FaceType/DoorSwing/HingeSide | ⬜ | אין חזית/כיוון-פתיחה |
| Cabinet `<Assembly>` ל-ORDX | ◐ | cabinets[] ב-.sol; אין Assembly מלא |
| Capture original cabinet | ⬜ | |

### 2H מידות ואימות
| פיצ'ר CVSM | Soline | הערה |
|---|---|---|
| P2P / P2L / projection / perpendicular | ◐ | P2P קיים; שאר-הטיפוסים חסרים |
| Maintain / Line / Angular / Radius / Diameter | ◐ | LiveCadScreen חלקי |
| Align / Datum-Corner / Select-Dim-Label | ⬜ | |
| **Final Verification / Calc** | ◐ | RoomValidator; אין "אימות-סופי לפני-ייצוא" מפורש |

### 2I ייצוא / דיווח
| פיצ'ר CVSM | Soline | הערה |
|---|---|---|
| ORDX | ✅ | OrdxExporter (מאומת-קורפוס) |
| DXF-2D/3D | ✅ | בממיר |
| **PDP** (Raumplan) | ◐ | הושהה ("תעזוב סעיף-1") |
| **PDF מקצועי** | ⬜ | PDF_REPORT_SPEC מוכן; לא-מומש |
| HTML אינטראקטיבי (RTL+3D) | ◐ | viz_engine בממיר; **לא-מוטמע באפליקציה** |
| BOM / Audit-Sheet / Lists | ⬜ | |
| Layers + Line-Types ל-DXF | ⬜ | |

### 2J הגדרות / חומרה / UI
| פיצ'ר CVSM | Soline | הערה |
|---|---|---|
| Options (Edges/Fonts/Colors/Resize/Measures) | ◐ | Prefs חלקי |
| בורר-חומרים per-ארון + ל-.sol | ◐ | 71 חומרים מוכנים; **אין UI-בחירה** |
| Calibration-factor / Laser-direction | ◐ | |
| Backup אוטומטי | ✅ | BackupManager ZIP |
| דונגל-USB / שרת-המרה / Com-Port | ⬜ | **מוחלף בכוונה** (BLE + המרה-מקומית) |

---

## §3 — המלצות מדורגות (ה-90% לממש)

מדורג לפי **ערך-לנגר × פער-מולנו**. לכל שורה: מה · למה · מקור-CVSM · מודול-Soline · מאמץ (S/M/L).

### עדיפות 1 — קריטי (בלי זה איננו שווי-ערך)

1. **מנוע Datum/Resize: Line Orientation by Reference + Set Corner by Distance + Set Line by Reference** — *מה:* קביעת כיוון/פינה/צורה ע"י מדידות-ניצבות מקו-קבוע במקום גרירה. *למה:* ה-DNA של InnoDraw — הופך מדידת-שטח למדויקת-הנדסית; משלים את משולש-הזהב שכבר יש. *מקור:* CT p54–58. *מודול:* `geometry/` (הרחבת Trilateration+StationSolver) + כלי-UI ב-`ui/resize`. *מאמץ:* **L**.

2. **מידות-חזית מדורגות (DimTierEngine) + מדידה-רציפה בחזית** — *מה:* פריסת detail→spans→total עם dedup, + מדידה-רציפה שיוצרת קווים עד-סגירה. *למה:* בלי זה החזית לא-קריאה לנגר/PDF; זה הפלט-המרכזי של מדידת-מטבח. *מקור:* `CVSM_5.6_UPDATE §1`; KBB p26. *מודול:* `export/` (חדש DimTier) + `ui/elevation`. *מאמץ:* **L**.

3. **Close-Auto + Attach (סגירת-היקף וחיבור-T מלא)** — *מה:* Auto מאריך קצה-ראשון+אחרון עד-חיתוך; Attach מחבר קירות/קירות-חוץ/דלתות. *למה:* בלי סגירה-תקינה התוכנית לא "נסגרת" ל-ORDX/PDP. *מקור:* KBB p9,42; CT p77; `35034/35039`. *מודול:* `geometry/WallCloseTools` (הרחבה). *מאמץ:* **M**.

4. **Wall Height L/R + סוגי-ראש-קיר (קיר-נמוך/תקרה-משופעת/גמלון/Vault)** — *מה:* גבהים-שונים בקצוות + WallTopStyle (STANDARD/PENINSULA/CATHEDRAL/VAULT). *למה:* חדרים אמיתיים עם תקרות-משופעות/קולטרים; כתוב ל-ORDX כ-`<Style>`. *מקור:* KBB p13–14; `CVSM_5.6 §1`. *מודול:* `data/WallEntity` (מיגרציה) + `ui/measure`. *מאמץ:* **M**.

5. **PDF מקצועי + BOM** (דרך הצינור-המקומי שלנו) — *מה:* דוח דף-שער+חדר+תוכנית+חזית עם מידות-מדורגות + כתב-כמויות. *למה:* הלקוח/מפעל מקבל תוצר; היום רק ORDX. *מקור:* CT p44; `PDF_REPORT_SPEC.md`; `CVSM_5.6 §2`. *מודול:* `export/PdfExporter` (חדש). *מאמץ:* **L**.

### עדיפות 2 — משדרג דרמטית דיוק/מהירות/תוצר

6. **Final Verification / Calc — בדיקת-שלמות לפני-ייצוא** — *מה:* חישוב-תוכנית + דגלי-שגיאה (קווים-פתוחים, זוויות-חריגות). *למה:* מונע ORDX-שבור בשטח. *מקור:* KBB `Final Verification`; CT p24,79. *מודול:* `fit/RoomValidator` (הרחבה). *מאמץ:* **M**.

7. **New Origin (Relocate) + Combine** — *מה:* העברת-הלייזר לעמדה-חדשה (3 מדידות על 2-קצוות) ומיזוג-צורות. *למה:* חדר-גדול מכמה-עמדות; חוסך שעות. *מקור:* CT p35–36; `35041/35044`. *מודול:* `geometry/StationSolver`. *מאמץ:* **M**.

8. **קווי-מידה קבועים: Maintain + Angular + Radius + Align + Datum-Corner** — *מה:* מגוון-מידות + יישור + זווית-פינה + קואורדינטת-Datum. *למה:* PDF/DXF קריא-לנגר. *מקור:* KBB p43–44; CT p81–82. *מודול:* `ui/cad` (LiveCadScreen). *מאמץ:* **M**.

9. **קירות לא-ישרים: Arc + Multi-Line + Best-Fit + Round-Corner/Chamfer** — *מה:* קשת (Sagitta), פוליליין-לקיר-עקום, פינה-מעוגלת/מקוטמת. *למה:* קירות/משטחים-מעוקלים נפוצים במטבחים. *מקור:* CT p34,47–49,59. *מודול:* `geometry/WallBuilder`. *מאמץ:* **L**.

10. **שורות-3-גבהים (HeightBands)** — *מה:* מדידת-קיר ב-3 גבהים (10/90/200 ס"מ) → קווים-מקווקווים בחזית. *למה:* קירות-מעוותים; דיוק-משטח. *מקור:* `CVSM_5.6 §1`. *מודול:* `data/` + `ui/elevation`. *מאמץ:* **M**.

11. **Overhang / Bump-out (בליטה + סובלנות בין-קירות)** — *מה:* הרחבת-שפה במידה; ערך-שלילי=סובלנות. *למה:* התאמת-משטח בין-קירות-נגדיים. *מקור:* CT p50–52,79. *מודול:* `geometry/`. *מאמץ:* **S**.

12. **הטמעת מנוע-הצפייה (viz) באפליקציה + בדוח-HTML** — *מה:* WebView שטוען `kitchen_viz.html` עם JSON-החדר (צוקל/טקסטורות/שכבת-תכנון/התנגשויות). *למה:* קיים-ומוכן בממיר, לא-מוטמע — מרשים-ללקוח + בדיקה-בשטח. *מקור:* `HANDOFF §5`; `CVSM_5.6 §2` (HtmlExporter). *מודול:* `ui/view3d` (WebView). *מאמץ:* **M**.

### עדיפות 3 — נוחות, מיתוג, אמון

13. **Job Information מלא (Drawn/Measured By, Company, Branch, Profile, Job-Area)** — *מה:* טופס-CRM לפני-שרטוט. *למה:* מיפוי ל-.sol/CRM; פרופיל-פר-לקוח. *מקור:* KBB p2; CT p7. *מודול:* `ui/intake`. *מאמץ:* **S**.

14. **בורר-חומרים per-ארון + כתיבה ל-.sol** — *מה:* בחירת-חומר (71 מוכנים) לכל-ארון → הממיר/הצפייה צובעים. *למה:* הנתונים מוכנים, חסר רק UI+שדה. *מקור:* CVSM Fill/Material-Labels (CT p81). *מודול:* `catalog/MaterialLibrary` + `data/CabinetEntity` (מיגרציה 4) + `SolWriter`. *מאמץ:* **S**.

15. **ספריית-כיורים + חיתוכים-לפי-רדיוס (R6/R7/R10/R13)** — *מה:* קטלוג-כיורים לפי-יצרן + חיתוכים-סטנדרטיים. *למה:* מדידה-מדויקת + התאמה-למפעל. *מקור:* `Sink\` (50+); `Cutouts-Metric\`. *מודול:* `catalog/`. *מאמץ:* **M**.

16. **אשף-תבניות-חדר (מלבן/L/U/T/Z) + נעילת-90°** — *מה:* תבנית-מוכנה + מדידה-מודרכת; ⊾-lock אמיתי. *למה:* מאיץ-שרטוט. *מקור:* CT p13–15; KBB p9; `CVSM_5.6` (RoomShapeTemplates). *מודול:* `geometry/` + `ui/draw`. *מאמץ:* **M**.

17. **קטלוג-אלמנטים מורחב** — Beam · Safety-Room-Entrance · Window-Sill · ShutterBox · Stairs · Radiator · Vent · Junction-Box. *למה:* השלמת-הכיסוי מול 8-הקטגוריות. *מקור:* `eLObstaclesIconsCategoriesEn.tx~`. *מודול:* `catalog/ElementCatalog`. *מאמץ:* **S**.

18. **פתחים מלאים: ShutterBox + Sill + Hinge-Side + In/Out + Door-Style** — *מה:* קבוצות-ארגז-תריס/אדן + צד-ציר + כיוון-פתיחה. *למה:* פתחים ישראליים אמיתיים (ארגז-תריס!). *מקור:* KBB p16–24. *מודול:* `ui/fields` + `data/AccessoryEntity`. *מאמץ:* **M**.

19. **Layers + Line-Types + Colors ל-DXF נקי** — *מה:* שכבות/צבעים/טיפוסי-קו לייצוא. *למה:* DXF מקצועי למפעל. *מקור:* KBB p40; `Layers.cfg`, `eLLineTypes.lin`. *מודול:* ממיר-DXF. *מאמץ:* **M**.

20. **Save Inc (גרסאות אוטומטיות) + Lists (טבלאות-פריטים)** — *מה:* שמירה-מצטברת + טבלאות-ניהול (Cutouts/Windows/Labels/Drawn-Items). *למה:* עמידות-נתונים + סקירה. *מקור:* menu `File/Save Inc`, `View/Lists`. *מודול:* `data/BackupManager` + `ui/`. *מאמץ:* **S**.

### להימנע בכוונה (ה-10% שלא מיישמים)
- **מנגנון-ייצור-האבן:** Miter (כל-סוגיו), Seam/Break, Slope-Cut, Break-by-Seam, Edge-profiles-fabrication, Drainer-Groove, Capture-carcass-ל-DR2 — ספציפי-חריצת-אבן; **אנחנו מודדים, לא חורצים** (CT p69–74).
- **דונגל-USB + רישום-per-exe + שרת-ההמרה של InnoDraw** — מוחלף ברישוי+המרה-מקומית של Soline (KBB p45–47).
- **מקודד-USB / Com-Port / Elco-tripod** — מוחלף ב-BLE (X6/DST360X).
- **Pen/Tablet handwriting** — לא-רלוונטי לטאבלט-אנדרואיד מודרני.

---

## §4 — Top 15 "must-steal" (לבנות ראשון)

מדורג לפי impact × פער. אלה הפיצ'רים שהופכים את Soline לשווה-ערך ל-CVSM ומעבר:

1. **מנוע Datum/Resize** — Line Orientation by Reference + Set Corner by Distance + Set Line by Reference (CT p54–58). *ה-DNA של דיוק-InnoDraw.* [L]
2. **מידות-חזית מדורגות (DimTierEngine)** — detail→spans→total+dedup (CVSM_5.6). *הפלט-המרכזי של מדידת-מטבח.* [L]
3. **PDF מקצועי + BOM** — דוח-לקוח/מפעל דרך הצינור-המקומי (PDF_REPORT_SPEC; CT p44). [L]
4. **Close-Auto + Attach (T-Join מלא)** — סגירת-היקף תקינה ל-ORDX/PDP (KBB p9,42). [M]
5. **Wall Height L/R + סוגי-ראש-קיר** — תקרות-משופעות/גמלון/Vault → `<Style>` (KBB p13; CVSM_5.6). [M]
6. **Final Verification / Calc** — בדיקת-שלמות לפני-ייצוא (KBB; CT p24). [M]
7. **New Origin (Relocate) + Combine** — חדר-גדול מכמה-עמדות (CT p35). [M]
8. **קווי-מידה קבועים: Maintain/Angular/Radius/Align/Datum-Corner** — PDF/DXF קריא (KBB p43–44). [M]
9. **HeightBands (מדידת-3-גבהים)** — קירות-מעוותים (CVSM_5.6). [M]
10. **הטמעת מנוע-הצפייה + דוח-HTML** — קיים-בממיר, לא-מוטמע (HANDOFF §5). [M]
11. **בורר-חומרים per-ארון + ל-.sol** — 71 חומרים מוכנים, חסר UI (CT p81 Fill). [S]
12. **Arc + Multi-Line + Round-Corner** — קירות-לא-ישרים (CT p47,59). [L]
13. **Job Information מלא (CRM)** — Drawn/Measured By, Company, Branch, Profile (KBB p2). [S]
14. **פתחים מלאים: ShutterBox + Sill + Hinge/In-Out** — ארגז-תריס/אדן ישראליים (KBB p16–24). [M]
15. **ספריית-כיורים 50+ יצרנים + חיתוכים R6/R7/R10/R13** — התאמה-למפעל (`Sink\`, `Cutouts-Metric\`). [M]

---

## נספח — מקורות-ראיה (READ-ONLY)
- **מדריכים:** `Manuals\InnoDraw User Manual for KBB.pdf` (Rev 3.05, ElCad 6120, 50 עמ') · `Manuals\CTuguide_rev3.04(A4)_ver_5712.pdf` (Rev 3.04, ElCad 5712, 94 עמ').
- **תפריטים:** `KTN\eLMenuEn.tx~` (KB&B) · `eLMenuEn.tx~` שורש (CounterTops) · `eLToolTipsLblsEn.tx~` (96 פקודות, קודי 35xxx).
- **קטלוגים:** `eLObstaclesIconsCategoriesEn.tx~` (8 קטגוריות) · `Icons\` (251 DXF-סמלים) · `Sink\` (50+ יצרנים) · `Cutouts-Metric\` (R6/R7/R10/R13+Slots) · `Profiles\` · `Areas.txt`.
- **מסמכים-קודמים (נבנה-עליהם):** CVSM_FEATURES · INNODRAW_FEATURES · CVSM_5.6/5.9_UPDATE · CVSM_ELEMENT_SCHEMA · ORDX_ELEMENT_SPEC · PDF_REPORT_SPEC · X6_CAPABILITIES · MATERIALS_LIBRARY.
- **Soline נמדד מול:** `HANDOFF-measure.md` · `app-measure\...\catalog\ElementCatalog.kt` (63) · `MaterialLibrary.kt` (71).
