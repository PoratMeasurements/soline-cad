# מתמטיקת-הגאומטריה של מנוע-ה-CAD — מפרט ואימות

> מסמך-תכן **מוכן-לביצוע** (RTL · לשון-זכר · פונה-למהנדס). תאריך: 2026-08-29.
> **קריאה-בלבד** — מפרט המתמטיקה למנוע-המדידה-המאוחד. לא שונה קוד.
> **שורש-קנוני:** `D:\Soline\app-measure\app\src\main\kotlin\il\co\soline\measure`. כל file:line יחסי-לשורש-הזה.
> **קבצים שנחקרו:** `geometry/{WallBuilder,StationSolver,WallCloseTools,ArcWall,RoomTemplates,FloorLevelSolver,LevelGrid,Trilateration}.kt`, `data/Entities.kt`, `ui/draw/LiveCadScreen.kt`, `ui/semiauto/SemiAutoOutlineScreen.kt`, `ui/canvas/RoomPlanCanvas.kt`, `ui/p2p/P2PMeasureScreen.kt`.

---

## 0. המוסכמה-הגלובלית (חד-משמעית — כל המנוע חייב לציית לה)

| רכיב | מוסכמה | מקור |
|---|---|---|
| מערכת-צירים | קרטזית ימנית; **x ימינה, y מעלה** (מסגרת-מתמטית). מ"מ. | `WallBuilder.kt:18-24` |
| כיוון-התחלתי | הקיר-הראשון יוצא מ**הראשית (0,0)** בכיוון **+X** (0° = מזרח). | `WallBuilder.kt:52-55` |
| `WallEntity.angle` | **זווית-פנייה (turn / deflection / חיצונית)** אל הקיר-הבא, מעלות, **CCW חיובי** (שמאלה). *לא* זווית-פנימית. ברירת-מחדל 90°. | `Entities.kt:118`, `WallBuilder.kt:20-23,60` |
| צבירת-כיוון | `heading += toRadians(angle)` אחרי כל קיר. | `WallBuilder.kt:60` |
| זווית-פנימית ↔ turn | `interior = 180° − turn` ; `turn = ±(180° − interior)` | `StationSolver.kt:308,318` |
| מלבן-CCW | 4 פניות של +90° → סוגר לראשית. סכום-פניות של מצולע-סגור-פשוט = ±360°. | `WallBuilder.kt:22-23` |
| נרמול-זווית | ל-`(-180°, 180°]` (מיושם 4 פעמים, זהה). | `WallBuilder.kt:297-302` ואחרים |

**⚠ אי-עקביות-תצוגה שחובה לאחד:** הקנבסים חלוקים בסימן-ה-y:
- `RoomPlanCanvas`/`LiveCadScreen`/`MeasureCaptureScreen`: **y-למטה** — `toScreen` = `(p.y − cy)·scale + h/2` (`RoomPlanCanvas.kt:140-143`). לכן CCW-מתמטי מוצג **הפוך (כמו CW)** ויזואלית.
- `P2PMeasureScreen.PlanCanvas`: **y-למעלה** — `sy(y) = (cy − y)·scale + h/2` (`P2PMeasureScreen.kt:574`). מציג CCW-מתמטי כ-CCW.

אותם נתוני-קירות נראים **משוקפים אנכית** בין שני הקנבסים. ל-`SharedPlanCanvas` המאוחד **לבחור y-למעלה** (תואם את המסגרת-המתמטית ואת StationSolver) — אחרת המודד רואה מתאר-מראה בין כלים.

---

## 1. קיר כווקטור: אורך + כיוון → קצה; צבירת-פניות

**נוסחה (מקור-האמת `WallBuilder.layout`, `WallBuilder.kt:49-63`):**
```
x₀,y₀ = 0 ; heading₀ = 0                      (+X)
לכל קיר i:  xᵢ₊₁ = xᵢ + Lᵢ·cos(hᵢ)
            yᵢ₊₁ = yᵢ + Lᵢ·sin(hᵢ)
            hᵢ₊₁ = hᵢ + toRad(angleᵢ)          (CCW חיובי)
N קירות → N+1 קודקודים.
```
**מה נכון:** הפריסה עצמאית ונקייה; מקור-אמת יחיד — כל קנבס נגזר ממנה (`LiveCadScreen.kt:148`, `MeasureCaptureScreen.kt:158`, `RoomPlanCanvas.kt:232`). `angle` = פנייה-חיצונית עקבי בכל הקוד (P2P `cornersToWalls`, RoomTemplates, ArcWall).

**גאפ/שבריריות:**
- `headingRad` נצבר בלי-נרמול (`WallBuilder.kt:60`) — לא-בעיה מספרית ל-`cos/sin`, אך אם ייחשף heading לתצוגה, לנרמל שם.
- **אין נרמול-כפילויות:** `normalizeDeg` משוכפל ב-4 קבצים (`WallBuilder.kt:297`, `StationSolver.kt:431`, `WallCloseTools.kt:308`, `RoomTemplates.kt:164`). להוציא ל-`GeoMath.normalizeDeg` יחיד.

**חתימות למנוע-המאוחד:**
```kotlin
object GeoMath {
    fun normalizeDeg(d: Double): Double            // ל-(-180,180]
    fun turnFromInterior(interiorDeg: Double, ccw: Boolean): Double  // כבר ב-StationSolver:318
    fun endpoint(start: Pt, headingRad: Double, lenMm: Double): Pt
}
```

---

## 2. זווית-פינה מאלכסון (חוק-הקוסינוסים)

**נוסחה:** `interior = acos((a² + b² − c²) / (2ab))`, כאשר a,b = הקירות, c = אלכסון-הקצוות.
תחום-תקף: `|a−b| < c < a+b` (אי-שוויון-המשולש). ואז `turn = ±(180° − interior)` למוסכמת-WallBuilder.

**אימות מול `StationSolver.goldenTriangleAngle` (`StationSolver.kt:285-309`):** ✔ **נכון ומלא.**
- חסימת-`acos` ל-`[-1,1]` (`:298`) — מונע `NaN` מרעש-לייזר.
- בדיקת-משולש עם סבולת-יחסית `tol = 1e-3·(a+b+c)+1.0` (`:301-302`) — שקולה לתחום `|a−b|<c<a+b` עם רזרבה לרעש.
- מחזיר `valid=false` + קירוב-מיטבי כשלא-משולש (`:302-308`).
- `turn = sign(ccw)·(180−interior)` (`:308`) — תואם exactly למוסכמת-הפנייה.
- הפוך: `expectedDiagonal` (`:417-421`) = `√(a²+b²−2ab·cos(interior))` לבדיקת-שפיות.

**גאפ:** ה-`ccw` הוא **דגל-ידני** — אין גזירת-כיווניות אוטומטית (ראה §8). אם ה-flag שגוי, הזווית נכונה בגודלה אך הפינה פונה-לצד-הלא-נכון → מתאר-מראה. מיטיגציה: לאחר בניית-מתאר-סגור, לגזור ccw מסימן-השטח (שוליים §8) ולהתריע אם סותר.

**חתימה (קיימת — רק לחשוף בכלי ∠):** `goldenTriangleAngle(a,b,c,ccw) → CornerAngle{interiorDeg,turnDeg,valid,note}`.

---

## 3. חיבור-קטעים והצמדה (snapping)

**מה קיים:**
- **snap-פנייה ל-90°:** SemiAuto `snapTurn(deg)` — מצמיד ל-`{0,±90,±180}` בסבולת **22°**, אחרת מעגל ל-**5°** (`SemiAutoOutlineScreen.kt:803-808`). LiveCad `snapAngle` — `(a/15)·15` (צעד-15°) כשנעילת-זווית דלוקה (`LiveCadScreen.kt:154`).
- **snap-קצה-לקטע (חיבור-T):** `WallBuilder.snapTJoin` — מטיל את הקצה-הפתוח (קודקוד ראשון/אחרון) על הקטע-הקרוב אם המרחק ≤ **50 מ"מ**, דרך `projectOnSegment` (`WallBuilder.kt:125-146,277-285`).

**גאפים (קריטי למנוע-המאוחד):**
1. **אין snap-נקודה-לנקודה** (endpoint coincidence). דרוש: כשמצייר-באצבע/עורך, קצה קרוב לקודקוד-קיים ≤ tol → הצמדה מדויקת. חסר לגמרי.
2. **אין snap-קולינארי** (יישור-לקו-הקיים).
3. `snapTurn`/`snapAngle` משוכפלים ולא-אחידים (22°/5° מול 15°). לאחד.

**סבולות-מומלצות (מנוע-מאוחד):** snap-נקודה **50 מ"מ**; snap-90° **±10°** (הדוק מ-22° של-SemiAuto — 22° תופס פינות-אלכסון בטעות); snap-קולינארי **±3°**; snap-קצה-לקטע **50 מ"מ**.

**חתימות להוסיף:**
```kotlin
object SnapTools {
    fun snapAngleDeg(raw: Double, tolDeg: Double = 10.0, targets: List<Double> = listOf(0.0,90.0,-90.0,180.0)): Double
    fun snapToVertex(p: Pt, verts: List<Pt>, tolMm: Double = 50.0): Pt?      // חדש
    fun snapToSegment(p: Pt, a: Pt, b: Pt, tolMm: Double = 50.0): Pt?        // עוטף projectOnSegment
    fun snapCollinear(headingRad: Double, prevHeadingRad: Double, tolDeg: Double = 3.0): Double? // חדש
}
```

---

## 4. סגירת-המצולע (closure) ושגיאת-הלולאה

**מה קיים (מלא ונכון):**
- פער-סגירה: `closingGap(pts) = dist(first,last)` (`WallBuilder.kt:73-76`).
- החלטת-סגירה: `isClosed(pts, tol=50mm)` — דורש ≥4 קודקודים ופער ≤ tol (`WallBuilder.kt:86-89`).
- זווית-סגירה: `closingAngleDeg` — הפנייה מהקטע-האחרון אל (אחרון→ראשון) (`WallBuilder.kt:100-107`).
- סגירה-אוטומטית: `WallCloseTools.closeAuto` (`:67-86`) — שני מסלולים: **נאמן** (`tryIntersectionClose`, מעגן-מחדש בנקודת-חיתוך קיר-ראשון×אחרון, `:93-121`) + **גיבוי** (`closeToOrigin`, "הראשון-לא-זז", מכוון+מאריך את האחרון לראשית, `:128-145`).
- סגירה-ידנית: `addClosingWall` — קיר-חדש (אורך=פער, זווית=closingAngleDeg) (`:253-275`).
- דיווח: `closingReport` — ≤200מ"מ "לחץ סגור", אחרת "בדוק מדידות" (`:157-174`).

**מה נכון:** `tryIntersectionClose` בודק s>0 (הארכה-קדמית) ו-t<|p1| (שומר כיוון-הקיר-הראשון), ומאמת פער<1מ"מ אחרי-הבנייה לפני-קבלה (`:118`) — חסין. גיבוי מובטח.

**גאפ:** **אין "פיזור-שגיאה" (loop-closure adjustment)** — הפער נבלע כולו בקיר-האחרון. לחדר-מדוד (P2P/מדידה-חיה) עדיף לפזר את שגיאת-הסגירה על כל-הפינות (least-squares / bowditch). כרגע רק "סגור-לאחרון". להוסיף אופציה:
```kotlin
fun distributeClosureError(walls: List<WallEntity>): List<WallEntity>  // חדש — פיזור-פרופורציוני-לאורך
fun closureError(walls: List<WallEntity>): Double = closingGap(layout(walls))  // חשיפה נוחה
```

---

## 5. חיתוך קו-קו (corner = חיתוך שני קירות)

**מה קיים:** `WallCloseTools.lineIntersect(a1,a2,b1,b2)` — דטרמיננטה, שומר-על-מקבילים עם `|denom| < EPS(1e-6)` → null (`WallCloseTools.kt:296-305`). נכון.

**גאפ:** הפונקציה **private** — לא-נגישה למנוע. דרושה בפומבי ל"פינה = חיתוך שני קווי-קיר" ולעריכה-אינטראקטיבית.

**שבריריות:** `EPS=1e-6` על denom הוא **אבסולוטי** — לקווים כמעט-מקבילים באורכים-גדולים (מ"מ) הוא רגיש-לסקאלה. עדיף מבחן-**זוויתי**: מקביל אם `|sin(Δheading)| < sin(0.5°)`. חתימה:
```kotlin
object LineTools {
    fun intersect(a1:Pt,a2:Pt,b1:Pt,b2:Pt, minAngleDeg: Double = 0.5): Pt?   // null אם ~מקביל (מבחן-זוויתי)
    fun projectOnSegment(p:Pt,a:Pt,b:Pt): Pt   // קיים ב-WallBuilder — להוציא לכאן
}
```

---

## 6. מתמטיקת-P2P (כדורי → תוכנית + גובה) — **הסוגיה הקריטית**

**המימוש (`StationSolver.toPlan`, `StationSolver.kt:167-174`):**
```
r = d · cos(θv)            ← היטל-אופקי (מרחק-בתוכנית)
x = r · cos(φ) ; y = r · sin(φ)    φ = θh (azimuth, CCW חיובי, 0=+X); cwHanded ⇒ φ→−φ
                          (גובה Z = d · sin(θv) — FloorLevelSolver.heightZ:60-63)
```
כלומר הקוד **מניח `θv` = זווית-נטייה-מהאופק (inclination)**, כאשר אופקי = 0°.

**⚠ ההנחה כנראה שגויה עבור ה-X6.** מ-`X6_LEVELLING_P2P.md` §1.3/§8/§9.3:
- לכידה-חיה: `vAngle` גולמי הראה **86.82°** לירייה כמעט-אופקית → מרמז שה-X6 מדווח **זווית-זנית** (zenith, 0=מעלה, 90=אופק).
- אישוש-חיצוני: wolfv/S910 (Leica) מאשר `V=zenith` (`z=d·sin(π/2−V)`).
- **המשמעות:** אם θv זנית ואנחנו מכניסים ל-`cos(θv)`: ירייה-אופקית θv≈90° → `r = d·cos(90°) ≈ 0` → **כל הפינות קורסות לראשית**. הגובה `d·sin(90°)=d` → שגוי-לגמרי.

**החלטה (מה ש-StationSolver מניח, והאם נכון):**
- StationSolver מניח **inclination-מהאופק**. זה **נכון עבור FloorLevelSolver** (סקר-מישוריות: `θ<0` רצפה, `θ>0` תקרה — `FloorLevelSolver.kt:23-28`) — שם המכשיר מדווח נטייה-מהאופק, וזה תואם.
- אבל עבור **P2P עם DST 360-X** ראיות-השטח מצביעות על **זנית**. אם כך, `toPlan` צריך המרה `inclination = 90° − zenith` לפני-החישוב.
- **מיטיגציה שכבר בקוד:** ב-P2P, כש-`vAngleDeg==null` (ה-X6 שולח vAngle רק ב-Measure-3D), `toPlan` נופל ל-`tilt=0 ⇒ r=d` (`StationSolver.kt:169`) — **נכון לפינות-כמעט-אופקיות**. לכן במצב-הנפוץ (פינות-חדר אופקיות, vAngle חסר) הקוד **תקין במקרה**. הסכנה מתממשת רק אם vAngle *כן* יזרום כזנית.

**תיקון מומלץ (מותנה-אימות-חומרה §8 של אותו מסמך):**
```kotlin
enum class VAngleMode { INCLINATION_FROM_HORIZON, ZENITH_FROM_UP }
fun toPlan(d: Double, hAngleDeg: Double?, vAngleDeg: Double?, cwHanded: Boolean,
           vMode: VAngleMode = VAngleMode.INCLINATION_FROM_HORIZON): Pt {
    val inclDeg = when {
        vAngleDeg == null -> 0.0
        vMode == VAngleMode.ZENITH_FROM_UP -> 90.0 - vAngleDeg   // ← המרה
        else -> vAngleDeg
    }
    val r = d * cos(toRad(inclDeg)); ...
}
```
**פעולה:** לאמת מול חומרה (ירֵה יעד-אופקי-ידוע + יעד-45°; בדוק אם `r` יוצא נכון או ~0). עד-אז — **לא-להזרים vAngle ל-P2P** (להשאיר null), וה-toPlan הקיים נכון.

**נכון בהחלט ב-toPlan:** מוסכמת-φ (CCW, 0=+X) עקבית עם WallBuilder; `cwHanded` = היפוך-סימן יחיד (`:172`); `cornersToWalls` (`:219-251`) גוזר turn = `normalizeDeg(nextHeading − heading)` — תואם מוסכמה. `MIN_CORNER_SEP_MM=10` (`:58`) + `dedupeCorners` (`:189-201`) מונע קיר-אפס מירייה-כפולה. ✔

---

## 7. קשתות (arcs)

**מה קיים (`ArcWall.kt`):**
- **מעגל-מ-3-נקודות:** `circleFrom3Points` — דטרמיננטה, `|d|<1e-9` → null (קולינארי) (`:56-65`). נכון.
- **קשת-מ-3-נקודות:** `arcThrough3Points` — בוחר-כיוון כך שהאמצע בתחום (`midInSweep`, `:74-93`). נכון.
- **קשת-מיתר+בליטה (בשימוש-ה-UI):** `arcChain(chord, sagitta, ccw, K)` — `r=(c²/4+h²)/(2h)`, `θ=2·atan2(c/2, r−h)`, K קטעים שווים `s=2r·sin(α/2)` (`:114-133`).
- **רציפות-משיקית:** `incomingTurnDeg = ±α/2` (כניסה-משיקית לקיר-הישר-הקודם), פניות-ביניים `±α`, יציאה `±α/2` (`:125-131`). **נכון** — חצי-זווית-משנה בכל-קצה נותן משיקיות לקו-הישר.

**מה נכון:** `atan2(c/2, r−h)` מטפל גם ב**קשת-על** (h>r, יותר-מחצי-מעגל) — נכון. חסימת-K ל-[2,64].

**גאפ:**
- `arcThrough3Points`/`circleFrom3Points` (3-נק' מוחלטות) **לא-מחוברים ל-UI** — רק `arcChain` (מיתר+בליטה) בשימוש (`LiveCadScreen.kt:410-419`). לזרימת-לייזר-3D עתידית (ירי-3-נקודות-קשת) צריך לחבר את המסלול-המוחלט.
- `arcChain` דורש **קיר-קודם-ישר** למשיקיות; אם הקודם קשת → `incomingTurnDeg` מיושם על קטע-קשת ולא-מובטח משיק. ArcWall כבר-מתעד ש"קשת מסרבת חיבור-T" (`:24-27`) — להרחיב: קשת-אחרי-קשת דורש טיפול-מיוחד.
- שבריריות: `sagitta ≤ EPS` → `radiusOf=∞` (`:136-138`) מטופל; אך `sagitta` זעיר-חיובי → רדיוס-ענק וקטעים-כמעט-ישרים — לא-שגיאה אך מיותר. לסנן `h/c` מתחת-לסף (למשל h<c/1000 → קו-ישר).

---

## 8. שטח וכיווניות (shoelace) — **חסר לגמרי**

**נדרש:** שטח-מסומן (shoelace) `A = ½·Σ(xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)`.
- `A > 0` ⇒ **CCW** ; `A < 0` ⇒ **CW** (במסגרת y-מעלה). שטח-חדר = `|A|`.

**גאפ (קריטי):** **אין shoelace / signed-area בשום-מקום בקוד.** התוצאות:
1. אין גזירת-CW/CCW אוטומטית — P2P/גולדן-טריאנגל נשענים על **דגל-ידני** (`setHanded`, `P2PMeasureScreen.kt:195-199`; `goldenTriangleAngle(...,ccw)`). זה מקור סיכון-מתאר-מראה (§2,§6).
2. אין דיווח-שטח-חדר (פיצ'ר-מודד בסיסי חסר).

**חתימות להוסיף (מנוע-מאוחד):**
```kotlin
object PolygonMath {
    fun signedArea(pts: List<Pt>): Double      // shoelace; חתום
    fun area(pts: List<Pt>): Double = abs(signedArea(pts))
    fun isCCW(pts: List<Pt>): Boolean = signedArea(pts) > 0.0
    fun perimeter(pts: List<Pt>): Double
}
```
שימוש: אחרי `cornersToWalls`/סגירה, `isCCW(layout(walls))` → לקבוע/לאמת את דגל-הכיווניות אוטומטית ולהתריע אם המודד בחר הפוך.

---

## 9. LevelGrid / Trilateration (רקע קצר)

- `LevelGrid` — אינטרפולציית-מישוריות (IDW/משולשים) על נקודות-Z מ-`FloorLevelSolver`; לא-משפיע על מתאר-הקירות. לא-נבדק-לעומק כאן (מחוץ-לליבת-מנוע-מבט-העל).
- `Trilateration.twoCircleIntersection` — קיים כבסיס לרילוקציה-מרובת-עוגנים (עמדה-חדשה), לא-בשימוש-מתאר-נוכחי. חיתוך-שני-מעגלים סטנדרטי — לוודא guard ל-`d>r1+r2` / `d<|r1−r2|` (מעגלים-זרים) בעת-חיבור.

---

## 10. טבלת-גאפים מרוכזת (סדר-עדיפות)

| # | גאף | חומרה | קובץ | תיקון |
|---|---|---|---|---|
| 1 | **P2P zenith-vs-inclination לא-מוכרע** | **גבוה** | `StationSolver.kt:167-174` | `VAngleMode` + `90−θv`; לאמת-חומרה; עד-אז vAngle=null |
| 2 | **אין shoelace / CW-CCW אוטומטי** | **גבוה** | חסר | `PolygonMath.signedArea/isCCW` |
| 3 | **אין snap נקודה-לנקודה/קולינארי** | **גבוה** | חסר (רק snapTJoin) | `SnapTools.snapToVertex/snapCollinear` |
| 4 | `lineIntersect` private + guard-אבסולוטי | בינוני | `WallCloseTools.kt:296` | לחשוף `LineTools.intersect` עם מבחן-זוויתי |
| 5 | אין פיזור-שגיאת-סגירה | בינוני | `WallCloseTools.kt:67` | `distributeClosureError` |
| 6 | snap-זווית משוכפל ולא-אחיד (22°/15°/5°) | בינוני | `SemiAuto:803`, `LiveCad:154` | `SnapTools.snapAngleDeg` יחיד (10°) |
| 7 | `normalizeDeg` משוכפל ×4 | נמוך | 4 קבצים | `GeoMath.normalizeDeg` |
| 8 | אי-עקביות y-flip בין קנבסים | נמוך (ויזואלי) | `RoomPlanCanvas:140` מול `P2P:574` | y-מעלה אחיד ב-SharedPlanCanvas |
| 9 | 3-point-arc לא-מחובר ל-UI | נמוך | `ArcWall.kt:74` | לחבר לזרימת-לייזר-3D |

---

## 11. תמצית (6-10 שורות)

- **מוסכמה מאושרת:** קרטזית ימנית (**x-ימין, y-מעלה**, מ"מ); קיר-ראשון מהראשית בכיוון **+X (0°=מזרח)**; `WallEntity.angle` = **זווית-פנייה-חיצונית אל-הקיר-הבא, CCW חיובי** (`interior = 180−turn`); `heading += angle` צובר. מלבן-CCW = 4×(+90°). מאושר מול `WallBuilder.layout` (`:49-63`) — עקבי בכל הקוד (StationSolver, RoomTemplates, ArcWall, WallCloseTools).
- **חוק-הקוסינוסים** (`goldenTriangleAngle`, `StationSolver.kt:285-309`): **נכון ומלא** — חסימת-acos ל-[-1,1], בדיקת-משולש עם סבולת, `turn=±(180−interior)`.
- **3 הגאפים המובילים:** (1) **P2P zenith/inclination** — לא-מוכרע; (2) **אין shoelace/CW-CCW אוטומטי** — כל הכיווניות ידנית; (3) **אין snap נקודה-לנקודה/קולינארי** — רק חיבור-T-ניצב קיים.
- **הכרעת-ה-zenith:** StationSolver **מניח inclination-מהאופק** (`r=d·cosθv`). זה **נכון ל-FloorLevelSolver**, אך ראיות-השטח (vAngle=86.82° לירייה-אופקית; wolfv/S910) מצביעות שה-X6 מדווח **זנית** — ואז ההנחה **שגויה** ותקרוס פינות לראשית. **מציל אותנו במקרה:** ב-P2P vAngle לרוב `null` ⇒ `tilt=0 ⇒ r=d` (נכון). המסקנה: התיקון (`90−θv`) **מותנה-אימות-חומרה**; עד-אז לא-להזרים vAngle ל-P2P וההתנהגות תקינה.
