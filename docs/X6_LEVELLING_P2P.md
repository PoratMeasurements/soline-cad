# פילוס (Levelling) ו-P2P של Leica DISTO X6 + DST 360-X — מחקר ותכן-בנייה טבעי ל-Soline

> מסמך **מחקר + תכן** (RTL, לשון-זכר, פונה-למהנדס). תאריך: 2026-08-26.
> נכתב עבור אפליקציית-המדידה של Soline (Android · Kotlin · `il.co.soline.measure`).
> **קריאה בלבד — לא שונה שום source של אפליקציה/converter.** כל שינוי-קוד המתואר כאן הוא
> **הצעת-תכן** למימוש עתידי, לא מימוש.
>
> **הדרישה של הבעלים (בתמצית):** ה-X6 על מתאם ה-DST 360-X עובד ב**מצב-פילוס**. זהו המצב
> הנכון ל-P2P. בתחילת-החיבור האפליקציה חייבת **לחייב את המודד לפלס את המכשיר במסך-המכשיר
> עצמו** (בועת-הפילוס המובנית של ה-DISTO), **לחסום את ירי-ה-P2P עד שהמכשיר מפולס**, ורק
> אז לקבל קואורדינטות-P2P לתוכנה. המסמך לומד איך זה עובד באמת (Leica, Cabinet Vision,
> elcad/eluCAD ואחרים) ומתכנן זרימה טבעית ל-Soline.

---

## 0. תקציר-מנהלים (TL;DR)

1. **הפילוס אינו קפריזה — הוא תנאי-הכרחי לנכונות ה-P2P.** מתמטיקת ה-P2P מניחה ש**ציר-הסיבוב
   האופקי (azimuth) של ה-DST 360-X ניצב לכיוון-הכובד**. אם המכשיר לא מפולס, מישור-ה-azimuth
   נטוי, וכל היטל-אופקי (r = d·cos θ_v) וכל זווית-אופקית (φ) יוצאים מעוותים — הפינות נופלות
   למקום-שגוי בתוכנית. לכן Leica **מחייבת פילוס לפני Measure 3D**, ורק "P2P מפולס" נותן
   את הפרש-הגובה + המרחק-האופקי + הנטייה בין שתי-נקודות. ([Leica P2P Technology](https://shop.leica-geosystems.com/measurement-tools/disto/disto-p2p-technology), [X6 FAQ](https://shop.leica-geosystems.com/measurement-tools/disto/blog/x6-faqs))

2. **הפילוס נעשה על מסך-המכשיר, לא בתוכנה.** נוהל-Leica: מרימים על החצובה, מסובבים את
   המכשיר **90° עם-כיוון-השעון** ועוקבים אחרי ההוראות בצג; **בועה-ירוקה = מפולס**; טווח-
   הפילוס הוא **±5°** (מעבר לכך אי-אפשר לפלס). זהו בדיוק הדפוס ש-DISTO Plan וגם Cabinet
   Vision מבקשים מהמשתמש: "פלס את המכשיר ועקוב אחרי ההוראות במסך" בעת החיבור ל-DST 360-X.
   ([Leica P2P Technology](https://shop.leica-geosystems.com/measurement-tools/disto/disto-p2p-technology))

3. **האם אפשר לקרוא את מצב-הפילוס דרך BLE? — לא ודאי, וזו שאלת-חומרה פתוחה.** ה-driver שלנו
   (`LaserBle.kt`) כבר קורא מ-`3ab1010f` (12 בייט) את הזווית-האופקית (4 בייט ראשונים = float LE
   רדיאנים), אבל **8 הבייטים הנותרים לא פוענחו** — הם המועמד-הטבעי ל**נטיית-ה-DST 360-X /
   דגל-מפולס**. בנוסף פריים-המדידה `3ab1010d` (20 בייט) מכיל **"ערך-משני" (בייטים 8–11)** ו-**דגלי-
   סטטוס (12–15)** שלא פוענחו. עד שנפענח אותם מול חומרה, **הגישה הבטוחה: לחייב אישור-ידני
   מפורש ("המכשיר מפולס") + בדיקת-שפיות readable אופציונלית**, לא להסתמך על דגל-BLE שלא אומת.

4. **מה שהמתחרים עושים (הדפוס לחיקוי):** Cabinet Vision פותח דיאלוג ש**מוביל את המשתמש נקודה-
   אחר-נקודה** — "כוון את הלייזר → לחץ כפתור בתוכנה → הנקודה נלכדת", אחרי שהמכשיר פולס. Leica
   DISTO Plan (Measure 3D) **חוסם את המדידה עד פילוס** ומצייר את הרצפה אוטומטית כשמודדים
   בכיוון-אחיד (CW/CCW). זה בדיוק המודל שכבר מימשנו חלקית ב-`P2PMeasureScreen.kt` (ירי-פינות
   מעמדה-אחת) — **חסר רק שער-הפילוס בהתחלה.** ([CABINET VISION App](https://shop.leica-geosystems.com/measurement-tools/ics/cabinet-vision-app), [Nexus — Leica Disto in CV](https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2024_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Leica.Disto.xhtml))

5. **SDK רשמי? יש — אבל Windows/.NET (C#), לא Android.** ראה **§7**. ההמלצה: **להמשיך עם
   raw-BLE GATT** (`LaserBle.kt`) — ה-SDK הרשמי לא רץ נייטיבית באנדרואיד ולא מוסיף לנו יכולת
   שאין ב-GATT.

6. **התכן ל-Soline (§6):** להוסיף **שלב-פילוס** (Phase.LEVEL) לפני שלב-העמדה ב-P2P — מסך-הדרכה
   עברי RTL "**פלס את המכשיר במסך-המכשיר**" עם צ'ק-ליסט/אנימציה, כפתור-הירי **חסום** עד לאישור
   "**המכשיר מפולס ✓**"; ב-`LaserBle.kt` להוסיף `levelled: StateFlow<Boolean?>` + `LevelState`
   (מפוענח מ-`3ab1010f`/`3ab1010d` אם האימות-החי יצליח, אחרת null=לא-ידוע), ובדיקת-שפיות
   readable. **הכול additive; שום שבירה של הקיים.**

---

## 1. איך ה-X6 + DST 360-X מבצעים P2P (פילוס → עמדה → יריות → XYZ)

### 1.1 החומרה והשרשרת-הפיזיקלית

- **X6 לבדו** = מד-לייזר-יד: מרחק (0.05–250 מ', ±1.0 מ"מ) + **חיישן-נטייה 360°** (הזווית-האנכית
  של קרן-הלייזר עצמה, ±0.2°). זה מספיק ל"גובה עקיף" אבל **לא** למקם נקודה במרחב.
- **DST 360-X** = מתאם-חצובה מתפלס עם **חיישני זווית-אופקית (azimuth encoder) + נטייה רגישים**.
  ה-X6 מתחבר אליהם ומשלב מרחק + נטיית-לייזר + azimuth → **פותר טריגונומטריה ל-P2P**. ([X6 FAQ](https://shop.leica-geosystems.com/measurement-tools/disto/blog/x6-faqs))
- **P2P = Point-to-Point:** מרחק/הפרש בין **שתי נקודות שרירותיות** מבלי לגעת בהן, מעמדה-אחת.
  דיוק P2P: **±5 מ"מ ל-5 מ', ±10 מ"מ ל-10 מ'** (נגזר-טריגונומטרית — פחות מדויק ממדידת-לייזר
  ישירה של ±1 מ"מ; רלוונטי ל-trustClass). ([Contractors-Tools X6 FAQ](https://www.contractors-tools.com/leica-disto-resources/leica-disto-x6-faq/))

### 1.2 הזרימה המלאה

```
1. הצבה:    X6 על DST 360-X על חצובה TRI 120. יציב, לא-זז עד סוף-הסקר.
2. פילוס:   על מסך-ה-X6 — סובב 90° CW, עקוב אחרי ההוראות, בועה-ירוקה = מפולס. (±5°)
3. עמדה:    העמדה = ראשית-החדר (0,0). azimuth-ייחוס נקבע (או שרירותי, הגאומטריה יחסית).
4. יריות:   כוון לכל פינה/נקודה ולחץ מדידה. כל ירייה = (d, θ_h azimuth, θ_v inclination).
5. פתרון:   d + θ_h + θ_v  →  נקודת-XYZ יחסית-לעמדה  →  הטלה לתוכנית (plan) + גובה.
6. מתאר:    יריות סדורות (CW/CCW) בונות מתאר-קירות סגור, כמו תחנה-טוטאלית.
```

**קריטי — למה "פילוס" בשלב 2:** שלב 5 מניח שציר-ה-azimuth של ה-DST **אנכי** (מקביל לכובד). רק
אז θ_v היא "נטייה-מהאופק" אמיתית ו-θ_h סובב במישור-אופקי אמיתי. פילוס = ליישר את הציר-הזה
לאנך. בלי זה — כל היריות נמדדות במסגרת-ייחוס נטויה, והמתאר יוצא מעוות/מוטה. Leica: "**אם המכשיר
מפולס**, ניתן לחשב את הפרש-הגובה, המרחק-האופקי והנטייה בין הנקודות" — כלומר הפילוס הוא-הוא
התנאי לפלט-ה-P2P התקין. ([Leica P2P Technology](https://shop.leica-geosystems.com/measurement-tools/disto/disto-p2p-technology))

### 1.3 מתמטיקת-הקואורדינטות ומוסכמות-הסימן

**המרה כדורית → קרטזית** (שלישייה מהעמדה כראשית):

```
θ_h = זווית-אופקית (azimuth) — מ-DST 360-X            [3ab1010f, float LE רדיאנים]
θ_v = זווית-אנכית (inclination) — מחיישן-הנטייה של X6  [3ab1010d bytes 4–7, float LE רדיאנים]
d   = מרחק-אלכסוני (slant)                             [3ab1010d bytes 0–3, float LE מטרים]

r = d · cos(θ_v)          ← היטל-אופקי אמיתי (מרחק-בתוכנית)
x = r · cos(θ_h)          ← ציר-X (מזרח), θ_h=0 ⇒ +X
y = r · sin(θ_h)          ← ציר-Y (צפון)
z = d · sin(θ_v)          ← גובה מעל/מתחת מישור-העמדה
```

**מוסכמות-הסימן ב-Soline** (כפי שמקודדות ב-[`geometry/StationSolver.kt`](../app-measure/app/src/main/kotlin/il/co/soline/measure/geometry/StationSolver.kt) `toPlan`):
- **azimuth φ = CCW-חיובי, 0 = +X מזרחה.** זו ברירת-המחדל (`cwHanded=false`) שמשחזרת מלבן-ידוע
  נכון. אם ה-DST מדווח CW → המתאר יוצא **מראה-הפוך**, ואז `cwHanded=true` הופך `φ → −φ`.
- **inclination θ_v = נטייה-מהאופק** (0 = אופקי). `r = d·cos θ_v`, `גובה = d·sin θ_v`.
- **העמדה = ראשית (0,0)**; כל הפינות יחסיות-לעמדה; היחידות מ"מ.

> **⚠️ נקודת-כיול קריטית (open question §8):** בלכידה-החיה שלנו (`ops/docs/DISTO_PROTOCOL.md`)
> ה-`vAngle` הגולמי מ-`3ab1010d` הראה **86.82°** לירייה קצרה — מה שמרמז שהמכשיר עשוי לדווח
> **זווית-זנית (0=מעלה, 90=אופק)** ולא נטייה-מהאופק. אם כך, הנוסחה `r = d·cos(θ_v)` שב-`toPlan`
> **הפוכה** ותיתן r≈0 לירייה-אופקית. חובה לאמת מול חומרה: אם θ_v זנית → יש להמיר
> `inclination = 90° − zenith` לפני `toPlan` (בדיוק כמו המרת-ה-GeoCOM ב-[`ICS50_INTEGRATION.md`](ICS50_INTEGRATION.md) §4.2).
> **הפילוס לא מציל מזה** — זו מוסכמת-פרוטוקול נפרדת, אבל היא משפיעה ישירות על נכונות-ה-P2P.

---

## 2. פילוס — האם יש אות-BLE, ואיך לחסום עליו

### 2.1 נוהל-הפילוס על מסך-המכשיר (המקור-האמין)

מהתיעוד הרשמי של Leica (P2P Technology / X6 UM / DISTO Plan Measure 3D):

- **"לפני תחילת המדידה עם פונקציית Measure 3D של DISTO Plan, יש לפלס את המכשיר ולעקוב אחרי
  ההוראות במסך בעת החיבור ל-DST 360-X."**
- **"בועה-ירוקה מציינת פילוס-נכון כשמסובבים את המכשיר 90° עם-כיוון-השעון ועוקבים אחרי
  ההוראות בצג. טווח-הפילוס הוא ±5°."**
- **"אם המכשיר מפולס — ניתן לחשב ולהציג את הפרש-הגובה, המרחק-האופקי והנטייה בין שתי הנקודות."**
- כיול (חד-פעמי, לא בכל-מדידה) בתפריט המכשיר: תת-תפריט **Calibration** עם **Tilt Sensor
  Calibration** + **Adapter Calibration** (מדידה ל-5 מ', היפוך 180°, מדידה-חוזרת).

מקורות: [Leica P2P Technology](https://shop.leica-geosystems.com/measurement-tools/disto/disto-p2p-technology) · [X6 FAQs](https://shop.leica-geosystems.com/measurement-tools/disto/blog/x6-faqs) · [X6 User Manual (ManualsLib)](https://www.manualslib.com/manual/3445489/Leica-Geosystems-Disto-X6.html) · [DISTO Plan – 3D Measure (PDF)](https://shop.leica-geosystems.com/sites/default/files/2024-04/10_DISTO%20Plan%20App%20-%203D%20Measure_EN.pdf).

**מסקנה תכנונית:** מקור-האמת לפילוס הוא **מסך-ה-X6 עצמו** (הבועה-הירוקה, ±5°). האפליקציה
**לא צריכה לשכפל את הבועה** — היא צריכה לוודא שהמודד עשה את הצעד הזה **לפני** שהיא מקבלת יריות.

### 2.2 מה אנחנו יכולים לקרוא מ-BLE (מצב-נוכחי + פוטנציאל)

| מקור | מה כבר מפוענח | מה אולי מכיל מצב-פילוס | מצב |
|------|----------------|------------------------|------|
| `3ab1010d` (20B, notify) | bytes 0–3 מרחק · 4–7 vAngle · 18 counter · 19=`C0` | **bytes 8–11 "ערך-משני"** (0 בדגימות) · **bytes 12–15 flags** (`00 00 01 00`) | פוענח-חלקית |
| `3ab1010f` (12B, poll ~200ms) | bytes 0–3 hAngle (float LE rad) | **bytes 4–11** — מועמד ל**נטיית-DST 360-X (pitch/roll)** / דגל-מפולס | **לא-פוענח** |
| `3ab1010d` vAngle | נטיית-קרן-הלייזר | **לא** מצב-בסיס — זו נטיית-הקרן, לא נטיית-המתאם | לא-רלוונטי לפילוס-בסיס |

> **חשוב:** נטיית-**קרן-הלייזר** (`vAngle`) אינה מעידה על פילוס-הבסיס — אפשר לפלס בסיס מושלם
> ולכוון את הקרן מעלה/מטה. מצב-הפילוס האמיתי הוא נטיית-**מישור-ה-DST**, וזו כנראה בבייטים-
> הלא-מפוענחים של `3ab1010f`. **זו ההשערה המרכזית לבדיקת-חומרה (§8).**

**גישת-הבדיקה המומלצת (nRF Connect / logcat על הטאבלט):** להשוות snapshot של `3ab1010f`
כש**המכשיר-מפולס** מול כש**מוטה בכוונה 3–4°**. אם bytes 4–11 משתנים באופן-עקבי (שני floats
של pitch/roll ברדיאנים, או float+דגל) — **פענחנו את הפילוס** ואפשר לחשב `|tilt| ≤ tol` readable.

### 2.3 עקרון-החסימה (gate)

**כלל-הזהב:** אף ירייה לא-מתקבלת ל-P2P עד ש**שני** התנאים מתקיימים:
1. **אישור-ידני מפורש** של המודד: לחצן/צ'ק "**המכשיר מפולס (בועה-ירוקה במסך-המכשיר) ✓**".
   (תמיד נדרש — זו האמת-הסופית לפי Leica.)
2. **בדיקת-שפיות readable** (כשתפוענח): `levelled == true` או לפחות `|tilt| ≤ 0.5°` — ואם ה-BLE
   מדווח **אי-פילוס**, מבטלים את האישור-הידני ומחזירים לשער (מונע "אישרתי ואז נגעתי בחצובה").

בלי (2) מפוענח — עובדים עם (1) בלבד + רמז-UX ברור. עם (2) — השער הופך **חצי-אוטומטי ואמין**.

---

## 3. מה עושים CVSM / Cabinet Vision / elcad ואחרים

### 3.1 Cabinet Vision (+ Leica DISTO utility)

- **הזרימה:** "Cabinet Vision יחד עם DISTO תומך-P2P הופך מדידת-חדר למהירה. ה-utility של Leica
  ב-Cabinet Vision הוא **דיאלוג שמוביל אותך צעד-אחר-צעד** בכל נקודה בחדר: כוון את הלייזר
  למיקום → לחץ על הכפתור ב-Cabinet Vision כדי ללכוד → הכלי מעביר אותך לנקודה הבאה." תוך-כדי,
  **Cabinet Vision מצייר את הקירות אוטומטית ומציב דלתות/חלונות/שקעים/מפסקים/סימוני-אינסטלציה.**
  ([CABINET VISION App](https://shop.leica-geosystems.com/measurement-tools/ics/cabinet-vision-app), [Nexus — Leica Disto](https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2024_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Leica.Disto.xhtml))
- **הפילוס:** מתבצע **לפני** — על מסך-המכשיר (אותו נוהל Leica); ה-utility מניח מכשיר-מפולס.
- **מה לחקות:** (א) **דיאלוג מדריך צעד-אחר-צעד** במקום מסך-חופשי; (ב) **ציור-חי** של המתאר תוך-
  כדי; (ג) **הטריגר בתוכנה** (כפתור במסך) בנוסף ללחצן-המכשיר. **מה לשפר:** להוסיף **שער-פילוס
  מפורש** בהתחלה (Cabinet Vision סומך על המשתמש) + **הודעות עבריות RTL** + חיווי-חי של מצב-הפילוס.

> **הבהרת-מונח:** "CVSM" בתיעוד-Soline הוא כינוי-פנימי לאפליקציית-מדידה `com.roommeasure.app`
> שנחקרה — **לא** מוצר של Hexagon. ה"CV" בכותרות-הקבצים שלה כן מתייחס ל-Cabinet Vision (מנוע-
> התוכן). ראה [`CABINET_VISION_INTEROP.md`](CABINET_VISION_INTEROP.md) §7. לענייננו: דפוס-הזרימה
> (level → guided-capture → auto-draw) זהה.

### 3.2 Leica DISTO Plan — Measure 3D (המקור-הישיר)

- **חוסם עד פילוס:** "יש לפלס את המכשיר ולעקוב אחרי ההוראות במסך" לפני Measure 3D.
- **ציור-רצפה אוטומטי:** "חיישן-מיוחד ב-X6 מאפשר יצירת תוכניות-רצפה מדויקות רק ע"י מדידת-חדר;
  לאחר שכל המדידות נלקחו **עם-כיוון-השעון או נגד** — האפליקציה מייצרת את תוכנית-הרצפה
  אוטומטית." ([DISTO X6 P2P / floor-plan](https://shop.leica-geosystems.com/measurement-tools/disto/leica-disto-x6-p2p-package/buy))
- **מה לחקות:** בחירת-כיווניות (CW/CCW) — **כבר מימשנו** ב-`P2PMeasureScreen` (מתג-כיווניות).

### 3.3 elcad / eluCAD, Flexijet, Compusoft/2020, MeasureSquare

- **elcad/eluCAD (elusoft)** — תוכנת עיבוד-פרופילים/CNC; **אינה** כלי-סקר-חדר עם P2P. אין עדות
  ציבורית לזרימת level-then-P2P משלה; לא מקור-לימוד רלוונטי לפילוס. ([elusoft eluCad](https://www.elusoft.de/en/products/elucad/))
- **Flexijet 3D** — מייצא ORDX ל-Cabinet Vision (כמונו); כלי-מדידה 3D על חצובה עם נוהל-פילוס-
  משלו. דפוס דומה: **מפלסים ואז מודדים נקודות**. ([Flexijet 3D](https://www.flexijet.info/en/blog/flexijet-3d-update-4-0/))
- **Compusoft/2020 "Room Survey"** — אפליקציית-מדידה עם DISTO; guided-capture. ([Compusoft Room Survey](https://www.cyncly.com/products/room-survey))
- **MeasureSquare / iMapper / OrthoGraph** — כולם ברשימת ה-**20+ אפליקציות-מוסמכות** של Leica
  שמתחברות ל-X6; כולם נשענים על **אותו נוהל-פילוס במכשיר** לפני P2P. ([DISTO X6 P2P package](https://shop.leica-geosystems.com/measurement-tools/disto/leica-disto-x6-p2p-package/buy))

**המכנה-המשותף לכל המתחרים:** אף אחד לא "ממציא" פילוס בתוכנה — כולם **מסתמכים על בועת-הפילוס
של המכשיר** ומניחים מכשיר-מפולס. **היתרון-התחרותי שלנו:** לעשות את השער-הזה **מפורש, מודרך,
ועברי** — כך שהמודד לא ישכח לפלס (טעות-שטח נפוצה שמפילה סקר-שלם).

---

## 4. מיפוי לקוד הקיים שלנו

### 4.1 `LaserBle.kt` — מה כבר קורה

- `LEICA_MEAS = 3ab1010d` (indicate) → `parseLeica()`: bytes 0–3 מרחק(m), 4–7 vAngle(rad),
  byte 18 counter (dedup), byte 19 = `C0`. פולט `Reading(distanceMm, vAngleDeg, hAngleDeg=lastHAngle)`.
- `LEICA_HANGLE = 3ab1010f` (read/poll ~200ms) → `updateHAngle()`: **רק** bytes 0–3 (float LE
  rad → `lastHAngle`). **bytes 4–11 נזרקים.**
- `Diag` — צילום-מצב חי מלא (frames, hAnglePollCount, recentFrames...). מצוין לבדיקת-החומרה של §8.
- **אין** כיום מושג "פילוס": אין `levelled`, אין `LevelState`, אין פענוח נטיית-בסיס.

### 4.2 `P2PMeasureScreen.kt` — מה כבר קורה

- `Phase.STATION` → `Phase.BUILD`. הירי חסום על `captureMm != null && !hAngleMissing`
  (כלומר: יש מרחק **ו**-יש זווית-אופקית מ-DST 360-X).
- `hAngleMissing = connected && last != null && liveHAngle == null` — מזהיר "אין DST 360-X".
- **אין** שער-פילוס: מסך-העמדה מדבר על "אל תזיז את החצובה" אבל **לא דורש פילוס** ולא חוסם עליו.

---

## 5. פער → מה חסר

1. **שער-פילוס בהתחלה** — אין. צריך `Phase.LEVEL` לפני `Phase.STATION`, עם הדרכה + אישור-מפורש.
2. **מודל-פילוס ב-driver** — אין `levelled`/`inclination` StateFlow. צריך (לפחות) לשאת אישור-
   ידני ב-UI, ובאופן-אידאלי לפענח נטיית-בסיס readable מ-`3ab1010f`.
3. **בדיקת-שפיות** — אין. גם בלי פענוח-בסיס, אפשר לפחות **לאזהר** אם `vAngle` של יריות רצופות
   קופץ בטווח בלתי-סביר (עדות-לחצובה-זזה), ולבטל את אישור-הפילוס אם ה-BLE התנתק.
4. **מוסכמת-zenith/inclination** (§1.3 ⚠️) — טעונה-אימות; משפיעה על נכונות ה-P2P.

---

## 6. תכן טבעי ל-Soline (additive, עברי-RTL, לשון-זכר)

### 6.1 חוויית-המשתמש — שלב-פילוס חדש

**מסך חדש `Phase.LEVEL`** (לפני `Phase.STATION`), מוצג **רק** כשמחובר X6 **עם** DST 360-X
(`connected != null && liveHAngle != null` — כלומר מתאם-P2P נוכח). זרימה:

```
כותרת:  "שלב 0 · פילוס המכשיר"
גוף:    "לפני שמתחילים למדוד P2P צריך לפלס את המכשיר על מסך-המכשיר עצמו."
צ'ק-ליסט (עברי, זכר):
  ☐ הצב את ה-X6 על מתאם ה-DST 360-X על חצובה יציבה
  ☐ במסך-המכשיר: סובב את המכשיר 90° עם-כיוון-השעון ועקוב אחרי ההוראות
  ☐ ודא שהבועה במסך-המכשיר ירוקה (מפולס · טווח ±5°)
  ☐ אל תיגע בחצובה אחרי הפילוס עד סוף-הסקר
[אנימציה/איור: חצובה + בועה שמתמרכזת לירוק]
חיווי-חי (אם פוענח): "מצב-פילוס מהמכשיר: ● מפולס / ● לא-מפולס / ○ לא-ידוע"
כפתור:  [ המכשיר מפולס — המשך ]   ← ENABLED רק כשכל הצ'קים מסומנים
                                      (ואם readable: גם levelled != false)
```

לאחר האישור → `Phase.STATION` כרגיל. **כפתור-הירי ב-`Phase.BUILD` מקבל תנאי-נוסף:**
`levelConfirmed == true`. אם ה-BLE מדווח אי-פילוס אחרי-אישור (חצובה זזה) → מבטלים
`levelConfirmed`, מחזירים ל-`Phase.LEVEL`, ומזהירים "**המכשיר אינו מפולס יותר — פלס מחדש**".

### 6.2 שינויים ב-`LaserBle.kt` (הצעה — לא-מיושם)

**(א) מודל-פילוס:**
```kotlin
/** מצב-פילוס ה-DST 360-X. null = לא-ידוע (טרם פוענח/אין מתאם). */
data class LevelState(
    val levelled: Boolean?,        // true/false/null
    val tiltDeg: Double? = null,   // נטיית-הבסיס (אם פוענחה), מעלות
    val source: String = "unknown" // "ble-3ab1010f" | "manual" | "unknown"
)
private val _level = MutableStateFlow(LevelState(levelled = null))
val level: StateFlow<LevelState> = _level
```

**(ב) פענוח-נטייה מ-`3ab1010f`** (רק אחרי אישור-חומרה §8 — כרגע השדות הלא-ידועים):
```kotlin
private fun updateHAngle(b: ByteArray) {
    if (b.size < 4) return
    val bb = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN)
    val az = bb.getFloat(0)
    if (az.isFinite()) { lastHAngle = Math.toDegrees(az.toDouble()); /* diag... */ }
    // ↓ השערת-פילוס — לאמת מול חומרה לפני-הפעלה:
    if (b.size >= 12) {
        val pitch = Math.toDegrees(bb.getFloat(4).toDouble())   // [טעון-אימות]
        val roll  = Math.toDegrees(bb.getFloat(8).toDouble())   // [טעון-אימות]
        if (pitch.isFinite() && roll.isFinite()) {
            val tilt = kotlin.math.hypot(pitch, roll)
            _level.value = LevelState(levelled = tilt <= LEVEL_TOL_DEG, tiltDeg = tilt, source = "ble-3ab1010f")
        }
    }
}
private const val LEVEL_TOL_DEG = 0.5   // סבולת-שפיות (המכשיר עצמו אוכף ±5° לפילוס)
```
> אם האימות-החי יראה שהשדות **אינם** pitch/roll — משאירים `levelled=null` וה-UI נשען על
> אישור-ידני בלבד. **לא מפעילים ניחוש לא-מאומת בשטח.**

**(ג) אישור-ידני + reset בניתוק:**
```kotlin
fun confirmLevelledManually() { _level.value = _level.value.copy(levelled = true, source = "manual") }
// ב-onConnectionStateChange → DISCONNECTED וב-disconnect(): _level.value = LevelState(levelled = null)
```

**(ד) לא-נדרש characteristic חדש** — `3ab1010f` כבר נסקר; רק מרחיבים את הפענוח. אם יתגלה
שהפילוס דווקא בדגלי `3ab1010d` (bytes 12–15) — מוסיפים שם ענף מקביל ב-`parseLeica`.

### 6.3 שינויים ב-`P2PMeasureScreen.kt` (הצעה — לא-מיושם)

```kotlin
private enum class Phase { LEVEL, STATION, BUILD }   // ← LEVEL חדש בראש

// state
val levelState by ble.level.collectAsStateWithLifecycle(LaserBle.LevelState(null))
var levelConfirmed by rememberSaveable { mutableStateOf(false) }
val needsLevel = connected != null && liveHAngle != null   // יש מתאם-P2P

// ביטול-אישור אם ה-BLE מדווח אי-פילוס אחרי-אישור:
LaunchedEffect(levelState.levelled) {
    if (levelConfirmed && levelState.levelled == false) {
        levelConfirmed = false; phase = Phase.LEVEL
    }
}

// שער-הפילוס:
when (phase) {
    Phase.LEVEL -> LevelGateCard(
        levelState = levelState,
        onConfirm = { ble.confirmLevelledManually(); levelConfirmed = true; phase = Phase.STATION },
        // enabled: כל הצ'קים מסומנים && levelState.levelled != false
    )
    Phase.STATION -> { /* קיים */ }
    Phase.BUILD   -> { /* קיים */ }
}

// כפתור-הירי — תנאי-נוסף:
enabled = captureMm != null && !hAngleMissing && (!needsLevel || levelConfirmed)
```

- אם **אין מתאם-P2P** (`hAngleMissing`) — שער-הפילוס **מדולג** (X6-לבד/הזנה-ידנית, אין azimuth
  לפלס עליו ממילא). כך משתמשי-הזנה-ידנית לא נחסמים.
- הכול **`rememberSaveable`** (שורד-סיבוב) ו-**RTL/זכר** בהתאם למסך הקיים.

### 6.4 סיכום-מיפוי (מה → איפה)

| שינוי | קובץ | סוג |
|-------|------|-----|
| `LevelState` + `level: StateFlow` | `LaserBle.kt` | additive |
| פענוח נטיית-בסיס מ-`3ab1010f` bytes 4–11 | `LaserBle.kt` `updateHAngle` | additive (טעון-אימות) |
| `confirmLevelledManually()` + reset-בניתוק | `LaserBle.kt` | additive |
| `Phase.LEVEL` + `LevelGateCard` עברי | `P2PMeasureScreen.kt` | additive |
| תנאי-פילוס על כפתור-הירי | `P2PMeasureScreen.kt` | הידוק-תנאי קיים |
| המרת zenith→inclination (אם §8 יאשר) | `LaserBle.parseLeica` / `StationSolver` | תיקון-מוסכמה |

---

## 7. SDK רשמי של ה-X6

**שאלה:** האם יש SDK רשמי של Leica שעדיף על ה-raw-BLE שלנו (`LaserBle.kt`)?

### 7.1 מה קיים

| # | שם | מפרסם | פלטפורמה | רישוי/עלות | חושף פילוס/P2P? | איך משיגים |
|---|----|-------|----------|-------------|------------------|-------------|
| 1 | **DISTO API / SDK (ממשק-C#)** דרך **Leica Geosystems Partner Network (GPN)** | Leica Geosystems (Hexagon) | **Windows/.NET (C#)** — לא Android | לא-פומבי; דרך **פנייה + הסמכה** ל-GPN | לא מתועד פומבית; ה-API מתואר כ"trigger + stream distance" | [GPN / Development Partner](https://leica-geosystems.com/about-us/partners/development-partner) — "CONTACT US" |
| 2 | **`Leica.Sdk.dll` / `eLMsrDevLeicaBtSDK.dll`** (ה-SDK בפועל, ב-InnoDraw) | Leica (עטוף ע"י InnoDraw) | **.NET מנוהל (Windows)** | מוטמע במוצר-מסחרי; לא מופץ בנפרד | מזהה דגם (`DS_MODEL_NAME`), `DistanceAndInclinationBluetoothResponse` — כלומר **נטייה כן**; P2P לא-מאושר | ניתוח-סטטי מקומי — ראה [`DISTO_PROTOCOL.md`](../ops/docs/DISTO_PROTOCOL.md) §D2 |
| 3 | **`Leica.DistoSdk.*`** (Core/Communication/**Networking**/LiveStream/VideoStreaming/Sftp) | Leica | **.NET (Windows)** | מוטמע בגשר-מתחרה (SPEEDtemplate) | תעבורת-רשת + וידאו (ל-iCS), לא BLE-P2P נייד | ראה [`ICS50_INTEGRATION.md`](ICS50_INTEGRATION.md) §6 |
| 4 | **DISTO transfer BT LE** (אפליקציה, לא SDK) | Leica | Android/Windows | חינם, **סגור** | לא — "הקשת-מקלדת"/clipboard בלבד | [Google Play](https://play.google.com/store/apps/details?id=leica.disto.transferBLE) |
| 5 | **DISTO Plan** (אפליקציית-צרכן, לא SDK) | Leica | Android/iOS | חינם, **סגור** | כן (Measure 3D) אבל לא-ניתן-להטמעה | [Google Play](https://play.google.com/store/apps/details?id=com.leica.distoplan) |
| 6 | **d2relay / Disto-for-Mac / disto-leica-bluetooth** | קהילה (open-source) | חוצה-פלטפורמות | חופשי | D2 בלבד; **אין X6/DST/פילוס** | [seichter/d2relay](https://github.com/seichter/d2relay) · [JEK58/Disto-for-Mac](https://github.com/JEK58/Disto-for-Mac) · [normanargiolas](https://github.com/normanargiolas/disto-leica-bluetooth) |

### 7.2 ממצאים

- **קיים SDK רשמי — אבל הוא Windows/.NET (C#)**, לא Android. ה-GPN מתאר במפורש "**stream
  precise distance data into your app through a simple C# interface**". אין **AAR/Maven/Android
  SDK** פומבי, ואין תיעוד ל-P2P-coordinates/levelling ב-SDK-הפומבי.
- **ניתוח-סטטי מקומי מאשש:** InnoDraw עוטף `Leica.Sdk.dll` (.NET), וגשר-ה-iCS של SPEEDtemplate
  משתמש ב-`Leica.DistoSdk.*` (.NET). **המסלול-הרשמי-המוכר הוא דסקטופ (Windows/.NET), לא נייד.**
- **הפרוטוקול פוענח מקצה-לקצה** אצלנו כבר (`DISTO_PROTOCOL.md`): `3ab1010d` (מרחק+vAngle) +
  `3ab1010f` (hAngle) → זה **בדיוק** מה ש-SDK-C# היה נותן, בלי תלות-ספק ובלי Windows.

### 7.3 המלצה

> **להישאר עם raw-BLE GATT (`LaserBle.kt`). לא לאמץ את ה-SDK הרשמי.** נימוקים:
> 1. **פלטפורמה:** ה-SDK הרשמי הוא .NET/Windows — **לא רץ נייטיבית באנדרואיד**. אימוצו יחייב
>    companion-Windows או Xamarin/MAUI-wrapper — סותר את ה-offline-first-הנייד של Soline.
> 2. **אין יתרון-יכולת:** ה-GATT כבר נותן מרחק + vAngle + hAngle. הפילוס (אם readable) יבוא
>    מאותם characteristics — ה-SDK לא חושף ערוץ-פילוס-קסם שאין ב-GATT.
> 3. **אין vendor-lock:** GATT-ישיר = בלי רישוי, בלי הסמכה, בלי תלות-ספק. תואם את החלטת-הבסיס
>    ב-[`disto_integration.md`](disto_integration.md) §6.
> 4. **מתי כן לשקול GPN:** רק אם נזדקק ל**חוזה-רשמי/הסמכה** (למשל תג "Leica-certified"
>    שיווקית) או אם יתגלה שנתוני-הפילוס/P2P **אינם** נגישים ב-GATT הפומבי — אז פנייה ל-GPN
>    ("CONTACT US") לברר גישה. **לא חוסם היום.**

---

## 8. שאלות-פתוחות ובדיקות-חומרה (חובה לפני-הפעלה)

| # | שאלה | איך בודקים | קריטיות |
|---|------|-----------|---------|
| 1 | **האם `3ab1010f` bytes 4–11 = נטיית-DST 360-X (pitch/roll)?** זה המפתח ל-`levelled` readable. | logcat/nRF Connect: השווה snapshot מפולס מול מוטה-3°. חפש 2 floats שמשתנים עם ההטיה. | **גבוהה** |
| 2 | **האם `3ab1010d` bytes 8–11 / flags 12–15 נושאים דגל-מפולס/סטטוס-P2P?** | לכידה בזמן פילוס/אי-פילוס; חפש שינוי-דגל. | בינונית |
| 3 | **מוסכמת-`vAngle`: נטייה-מהאופק או זווית-זנית?** (§1.3 ⚠️) משפיע ישירות על `toPlan`. | ירֵה יעד-אופקי-ידוע + יעד ב-45°; בדוק אם `cos(vAngle)` נותן r נכון או הפוך. | **גבוהה** |
| 4 | **האם P2P דורש פקודת-start** (write ל-`3ab10109`/config) או שדי ב-notify של `3ab1010d`? | נסה notify-בלבד; אם אין זרם — נסה כתיבת-טריגר. | בינונית |
| 5 | **האם ה-azimuth (`3ab1010f`) יציב רק כשמפולס?** ייתכן שהמכשיר מחזיר NaN/קפוא עד-פילוס — זו-עצמה בדיקת-שפיות. | קרא hAngle לפני/אחרי פילוס. | בינונית |
| 6 | **סבולת-הפילוס בפועל** — ±5° הוא הטווח-שאפשר-לפלס; מהי הסבולת ל"ירוק"? | תיעוד/תצפית על הבועה. | נמוכה |

**מסלול-בטוח מיידי (בלי לחכות לחומרה):** לממש את **שער-הפילוס עם אישור-ידני בלבד**
(`Phase.LEVEL` + `confirmLevelledManually`) — זה **כבר עונה על דרישת-הבעלים** (מחייב פילוס-במכשיר
+ חוסם P2P עד-אישור), ואינו תלוי בפענוח-החומרה. ה-readable-check (§6.2ב) מתווסף **אחרי** שבדיקה
#1 תצליח, כשדרוג-אמינות — לא כתנאי-להשקה.

---

## 9. סקריפטים מ-GitHub — חיבור וקריאת-מאפייני X6

> **מטרת-החיפוש:** למצוא קוד-אמיתי שקורא מאפייני-DISTO דרך BLE — ובמיוחד **מי מפענח את
> הבייטים-הלא-מפוענחים** אצלנו (`3ab1010f` bytes 4–11 = מועמד לנטיית-DST 360-X = אות-הפילוס;
> `3ab1010d` bytes 8–15). חיפוש-קוד: grep.app (חסום Vercel), Sourcegraph, GitHub-API, WebFetch.

### 9.1 מסקנת-על (חשובה)

> **אף פרויקט-קוד ציבורי לא מפענח את בייטי-הפילוס.** כל המפענחים הקהילתיים עוצרים אחרי
> **4 הבייטים הראשונים (מרחק)**. ה-`LaserBle.kt` שלנו — שכבר מפענח `vAngle` מ-`3ab1010d[4:7]`
> ו-`hAngle` מ-`3ab1010f[0:3]` — **מקדים את כל הקוד-הפומבי הקיים.** נתוני-הפילוס של ה-DST
> 360-X **אינם מתועדים בשום repo** — זהו gap-אמיתי שנפתר רק בבדיקת-חומרה (§8).

### 9.2 טבלת-הממצאים

| repo / מקור | שפה · חיות | שירות/מאפיינים | פענוח-בייטים | פקודת-start | פילוס/נטייה |
|-------------|------------|-----------------|---------------|--------------|-------------|
| [**seichter/d2relay**](https://github.com/seichter/d2relay) ([notes](https://github.com/seichter/d2relay/blob/master/doc/notes.md)) | Python/C++ · ~40★, הבסיס-הקהילתי | `3ab10100` svc; `3ab10101` מרחק, `3ab10102` יחידות, `3ab1010a` unknown(4B), `3ab1010c` דגם, **`3ab10109` write-without-response (פקודה)** | מרחק = 4B **IEEE754 float** בלבד; **שום בייט נוסף** | לא-מתועד (ה-`3ab10109` קיים אך תוכנו לא-ידוע) | **אין** (D2 = 2D) |
| [**B4X forum — BLE2 Leica+Bosch**](https://www.b4x.com/android/forum/threads/ble2-leica-disto-and-bosch-laser-rangefinder.160390/) | B4A (Basic4Android) · פעיל | `3ab10100` svc; **`3ab1010d` "BASIC_MEASUREMENT"** (X3) | 4 בייטים ראשונים = float LE מטרים; **לא מעבר לכך** | **אין** — לחיצת-כפתור פיזי; **חובה subscribe לכל ה-characteristics** כדי ש-notify יזרום (כמו `enableAllNotifyIndicate` שלנו) | **אין** (רק מרחק) |
| [**drizdar/Disto_Control**](https://github.com/drizdar/Disto_Control) (`laser3.6.py`) | Python · gatttool · E7100i (BLE+נטייה) | enable-indications על 3 handles (`0x000b/0x000f/0x0012`), מרחק מ-`0x000e`, יחידות מ-`0x0011`, **פקודה ל-`0x0014`** | מרחק = float LE (reorder→`!f`) | **`char-write-cmd 0x0014 67`** — כותב בייט **`0x67`** (='g') לטריגר-מדידה מרחוק! (handle ≈ `3ab10109`) | **אין** — למרות שהדגם תומך-נטייה, הקוד לא מפענח זווית |
| [**malc0/distox**](https://github.com/malc0/distox) + [**TopoDroid**](https://github.com/marcocorvi/topodroid) + [**lz1asl/CaveSurvey**](https://github.com/lz1asl/CaveSurvey) | Python/Java · קהילת-מיפוי-מערות פעילה | **DistoX2 — פרוטוקול אחר** (BT-Classic SPP, פריים 8B, לא GATT) | פריים-8B לפי-טיפוס(`d[0]&0x3f`): **LEG** dist=`d[1:3]`/1000, heading=`d[3:5]`/65536·360, clino=`d[5:7]` signed, roll=`d[7]`; **ACC(G)** Gx/Gy/Gz=`d[1:3],d[3:5],d[5:7]` int16; **MAG(M)** Mx/My/Mz זהה | מצבי-כיול (enter/exit calib, download coeffs) | **כן — עקיף:** נטייה+מצפן נגזרים מ-**accelerometer+magnetometer גולמיים**. זה בדיוק מה שה-DST 360-X עושה פנימית לפילוס |
| [**wolfv gist — S910**](https://gist.github.com/wolfv/f5ac7dd7d5de8ffc75bd20ba1db0ef6f) | Python · TCP/WiFi (לא-BLE) | פקודות-ASCII (`get8`, `mi`, `mp`) על TCP:22222 | HZ/V/dist/INC ברדיאנים | `get8\r` | **כן — INC**; ומאשר ש-**V = זווית-זנית**: `d_hat=dist·cos(π/2−V)`, `z_hat=dist·sin(π/2−V)` |
| [**AppWerft gist**](https://gist.github.com/AppWerft/17e9b47da8bf6254aa07c16f4ae18e4b) · [**d7knight/Disto-App**](https://github.com/d7knight/Disto-App) · [**JEK58/Disto-for-Mac**](https://github.com/JEK58/Disto-for-Mac) · [**normanargiolas**](https://github.com/normanargiolas/disto-leica-bluetooth) | Java/Swift/log | מאשרים `3ab10100` svc + שמות-DISTO (DISTO X3…) | לוגים/שלד — בלי פענוח-עומק פומבי | — | **אין** |

### 9.3 מה למדנו (ורלוונטי ל-Soline)

1. **הפילוס לא מפוענח בשום מקום — אנחנו בחזית.** אף repo לא נוגע ב-`3ab1010f[4:11]` או
   `3ab1010d[8:15]`. אין "קיצור-דרך" מ-GitHub; פענוח-הפילוס = בדיקת-חומרה שלנו (§8 #1–#2).
2. **פקודת-טריגר קונקרטית: `0x67`** (מ-drizdar, על handle ≈ `3ab10109`). אם ב-X6 ה-notify
   של `3ab1010d` **לא זורם** בלי טריגר — **זה הבייט לנסות** (write ל-`3ab10109`). כרגע
   `LaserBle` לא כותב טריגר; הוא מסתמך על לחיצת-כפתור פיזי (כמו B4X/d2relay) — הגישה-הבטוחה.
3. **"subscribe לכל ה-characteristics"** (B4X) — **כבר עושים** ב-`enableAllNotifyIndicate`. אישוש
   שהגישה-שלנו נכונה.
4. **V = זווית-זנית** (wolfv S910: `cos(π/2−V)`) — **אישוש-שני** ל-open-question §1.3/§8 #3:
   סביר שגם ב-X6 ה-`vAngle` הוא זנית, ואז `toPlan` צריך `inclination = 90° − vAngle`.
   (מדידת-S910 היא ממכשיר-Leica אחר אך אותה מוסכמת-זנית מקובלת אצל Leica.)
5. **דפוס ה-accel/mag של DistoX2** — מלמד ש**נטיית-בסיס נגזרת מ-3 רכיבי-תאוצה** (Gx,Gy,Gz).
   אם `3ab1010f` של ה-DST 360-X חושף רכיבי-נטייה, סביר שהם **2–3 floats** (pitch/roll או
   accel-מנורמל) — בדיוק המבנה שנחפש (§9.4).

### 9.4 מה לנסות להעתיק ל-`LaserBle.kt` (offsets לניסוי מול חומרה)

`3ab1010f` הוא **12 בייט = 3× float32 LE**. בייט 0–3 = azimuth (מפוענח). ההשערה החזקה:

```kotlin
// 3ab1010f (12B) — הרחבת updateHAngle. לאמת מול חומרה (§8 #1) לפני-הפעלה.
val bb = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN)
val azimuthRad = bb.getFloat(0)   // ✓ מפוענח (hAngle)
val f4  = bb.getFloat(4)          // ← מועמד #1: pitch (נטיית-DST, rad)
val f8  = bb.getFloat(8)          // ← מועמד #2: roll  (נטיית-DST, rad)
// אם f4/f8 = נטיות: tilt = hypot(toDeg(f4), toDeg(f8)); levelled = tilt <= LEVEL_TOL_DEG
// חלופה: אם ערכיהם ~±1 ולא-רדיאנים → הם רכיבי-accel מנורמלים (כמו DistoX Gx/Gy),
//        ואז tiltFromLevel = toDeg(acos(gz_component)) או atan2 של הרכיבים.
```

`3ab1010d` (20B) — הבייטים-הלא-מפוענחים:

```kotlin
val f8_11   = bb.getFloat(8)      // "ערך-משני" (0 בדגימות) — אולי azimuth-משני/height-מפולס
val flags   = bb.getInt(12)       // 00 00 01 00 — נסה bit-fields: מפולס? valid? out-of-range?
// byte 18 = counter (מפוענח), byte 19 = C0 (מפוענח)
```

**נוהל-הניסוי (§8 #1):** לכידת snapshot של `3ab1010f` **מפולס** מול **מוטה-בכוונה 3–4°**;
אם `f4`/`f8` משתנים עקבית עם ההטיה — **פענחנו את הפילוס**. אז מפעילים את `LevelState.levelled`
readable (§6.2ב) כשדרוג-אמינות מעל האישור-הידני. **עד-אז — אישור-ידני בלבד** (לא מפעילים ניחוש
לא-מאומת בשטח).

**פקודת-start אופציונלית (רק אם notify לא-זורם):**
```kotlin
// ניסוי אחרון-ברירה (מ-drizdar): טריגר-מדידה מרחוק
val cmd = findChar(g, leica("0109")); cmd?.let { it.value = byteArrayOf(0x67); g.writeCharacteristic(it) }
```

---

## 10. מקורות

**Leica רשמי:**
- [Leica Point to Point (P2P) Technology](https://shop.leica-geosystems.com/measurement-tools/disto/disto-p2p-technology) — בועה-ירוקה, סיבוב-90°-CW, ±5°, "P2P מפולס".
- [Leica Point to Point Technology (overview)](https://shop.leica-geosystems.com/measurement-tools/disto/leica-point-point-technology)
- [Leica DISTO X6 FAQs](https://shop.leica-geosystems.com/measurement-tools/disto/blog/x6-faqs) — פילוס, Tilt/Adapter Calibration, ±5°.
- [Leica DISTO X6 P2P Package (floor-plan, CW/CCW)](https://shop.leica-geosystems.com/measurement-tools/disto/leica-disto-x6-p2p-package/buy)
- [Leica DISTO X6 User Manual (ManualsLib)](https://www.manualslib.com/manual/3445489/Leica-Geosystems-Disto-X6.html) · [X6 UM PDF v1.2](https://shop.leica-geosystems.com/sites/default/files/2025-03/979590_Leica_DISTO_X6_UM_1-2-0_en_small.pdf)
- [DISTO Plan App — 3D Measure (PDF)](https://shop.leica-geosystems.com/sites/default/files/2024-04/10_DISTO%20Plan%20App%20-%203D%20Measure_EN.pdf)
- [Leica DISTO Bluetooth compatibility](https://shop.leica-geosystems.com/measurement-tools/disto/blog/bluetoothr-disto-os-compatibility)

**Cabinet Vision / מתחרים:**
- [Leica CABINET VISION App](https://shop.leica-geosystems.com/measurement-tools/ics/cabinet-vision-app) — guided step-by-step P2P.
- [Nexus — Leica Disto in Cabinet Vision 2024](https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2024_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Leica.Disto.xhtml)
- [Flexijet 3D (ORDX export)](https://www.flexijet.info/en/blog/flexijet-3d-update-4-0/) · [Compusoft/Cyncly Room Survey](https://www.cyncly.com/products/room-survey) · [eluCad (elusoft)](https://www.elusoft.de/en/products/elucad/)
- [Contractors-Tools X6 FAQ](https://www.contractors-tools.com/leica-disto-resources/leica-disto-x6-faq/) — דיוק-P2P ±5מ"מ@5מ'.

**SDK / פרוטוקול:**
- [Leica Geosystems Partner Network (GPN) — Development Partner](https://leica-geosystems.com/about-us/partners/development-partner) — DISTO API כ-"simple C# interface".
- [Leica Software Partners](https://shop.leica-geosystems.com/measurement-tools/disto/blog/software-partners) · [DISTO Apps](https://shop.leica-geosystems.com/learn/leica-disto/leica-disto-apps)
- [DISTO transfer BT LE (Google Play)](https://play.google.com/store/apps/details?id=leica.disto.transferBLE) · [DISTO Plan (Google Play)](https://play.google.com/store/apps/details?id=com.leica.distoplan)
- [seichter/d2relay](https://github.com/seichter/d2relay) · [JEK58/Disto-for-Mac](https://github.com/JEK58/Disto-for-Mac) · [normanargiolas/disto-leica-bluetooth](https://github.com/normanargiolas/disto-leica-bluetooth)

**Soline פנימי (קריאה בלבד):**
- [`ops/docs/DISTO_PROTOCOL.md`](../ops/docs/DISTO_PROTOCOL.md) — פרוטוקול X6 פוענח-חי (`3ab1010d`/`3ab1010f`).
- [`docs/disto_integration.md`](disto_integration.md) — החלטת raw-BLE, מפת-דגמים.
- [`docs/ICS50_INTEGRATION.md`](ICS50_INTEGRATION.md) — `Leica.DistoSdk.*` (.NET), המרות-מוסכמה.
- [`docs/CABINET_VISION_INTEROP.md`](CABINET_VISION_INTEROP.md) — CVSM, ORDX, guided-capture.
- [`app-measure/.../device/LaserBle.kt`](../app-measure/app/src/main/kotlin/il/co/soline/measure/device/LaserBle.kt) · [`ui/p2p/P2PMeasureScreen.kt`](../app-measure/app/src/main/kotlin/il/co/soline/measure/ui/p2p/P2PMeasureScreen.kt) · [`geometry/StationSolver.kt`](../app-measure/app/src/main/kotlin/il/co/soline/measure/geometry/StationSolver.kt)

**לא היה נגיש:** קובצי-PDF רשמיים (403/בינארי) — התוכן לוקט ממראות-HTML ומחיפוש; פענוח-מלא של
`3ab1010f` bytes 4–11 ו-`3ab1010d` flags — **טעון בדיקת-חומרה** (§8).

---

## 11. הזרמת שאר-הפונקציות (לא רק DIST) — לפי elcad

> **עובדת-שדה מהבעלים:** ה-X6 שלנו **כבר משדר מרחק** (DIST עובד — ה-notify של ה-BLE תקין).
> חסר: **זווית-אנכית, זווית-אופקית (DST 360-X), נטייה/פילוס, וקואורדינטות-P2P**. הבעלים ביקש
> "**ללמוד מ-elcad איך עושים את זה**".

### 11.1 מה זה "elcad" — ומה הוא מלמד

"elcad" בהקשר-Soline הוא **InnoDraw El_Cad** — תוכנת-המדידה שכבר מזינה Leica DISTO ל-ORDX
([`cabinet_vision.md`](../converter/docs/cabinet_vision.md), [`disto_integration.md`](disto_integration.md) §5).
**כבר ניתחנו אותו סטטית** ([`ops/docs/DISTO_PROTOCOL.md`](../ops/docs/DISTO_PROTOCOL.md) §D2):

- El_Cad **לא מדבר GATT גולמי** — הוא עוטף את ה-**SDK הרשמי של Leica** (`Leica.Sdk.dll`) דרך
  ה-wrapper `eLMsrDevLeicaBtSDK.dll`.
- ה-SDK מבחין בין **שני טיפוסי-תשובה**: `DistanceBluetoothResponse` (D2 — **מרחק בלבד**) לעומת
  **`DistanceAndInclinationBluetoothResponse`** (דגמי-X — **מרחק + נטייה יחד**).
- **המשמעות הקריטית:** ה-SDK **לא "מדליק מצב" מרחוק** — הוא **קורא את מה שהמכשיר שולח**
  ומפרסר אותו לטיפוס-התשובה המתאים. הזווית מגיעה **באותו זרם-BLE** כמו המרחק. אם המכשיר
  שולח מרחק-בלבד → תגיע `DistanceBluetoothResponse`; אם שולח מרחק+נטייה → `DistanceAndInclination…`.

> **לקח-elcad:** אין "פקודת-קסם" שגורמת ל-X6 להתחיל לשדר זווית. מה שקובע איזה טיפוס-תשובה
> יוצא זה **הפונקציה/מצב שנבחרו על המכשיר עצמו** בזמן-המדידה. elcad פשוט **מפרסר את שני
> הטיפוסים** ולא-מפיל תשובה כי "חסרה זווית".

### 11.2 הסיבה-האמיתית שאנחנו מקבלים DIST ולא זווית (הוכחה מהלכידה שלנו)

**הראיה הישירה נמצאת בלכידה-החיה שלנו** ([`DISTO_PROTOCOL.md`](../ops/docs/DISTO_PROTOCOL.md)):
באותו-מפגש, אותו characteristic `3ab1010d` שלח **גם** פריימים עם זווית-אמיתית **וגם** בלי:

```
#46 dist=1.617m vAngle=87.19°     ← נמדד עם זווית (פונקציית-נטייה/P2P פעילה)
#48 dist=1.153m vAngle=Inf        ← נמדד כמרחק-בלבד (פונקציית DIST)
#52 dist=1.768m vAngle=8.13°      ← שוב עם זווית
#53 dist=2.702m vAngle=Inf        ← שוב מרחק-בלבד
```

וב-`DISTO_PROTOCOL.md` מפורש: *"אם בייטים 4–7 = `00 00 80 7F` → float = +Infinity → **אין נתון
זווית (מדידת-מרחק בלבד, ה-DST 360 לא סובב)**"*.

> **המסקנה (ודאות-גבוהה):** **הזווית-האנכית כבר נמצאת באותו `3ab1010d`** — פשוט מגיעה כ-`+Inf`
> כשהמכשיר במצב-DIST. **הסיבה שאנחנו רואים רק מרחק: ה-X6 מופעל בפונקציית DIST (מרחק-רגיל),
> לא בפונקציית-הנטייה/P2P/Smart-Room.** ברגע שבוחרים על המכשיר את הפונקציה-הנכונה (עם
> DST 360-X מחובר ומפולס) — אותו characteristic יתחיל למלא את bytes 4–7 בזווית-אמיתית,
> וה-`3ab1010f` ימלא azimuth אמיתי. **זו בעיית-מצב-הפעלה, לא בעיית-קוד-BLE.**

זה עקבי עם התיעוד: Smart Room "משתמש בחיישנים המשולבים של ה-DISTO כדי **ללכוד את הזוויות
בין המדידות**" ([messfreunde DISTO Plan Wiki](https://messfreunde.de/messfreunde-wiki-leica-disto-plan-app)) —
כלומר הזווית מיוצרת ע"י **הפונקציה** שנבחרה, לא ע"י פקודת-BLE. וה-P2P נוצר רק כשה-X6 על
DST 360-X **מפולס** ובמצב-P2P/Measure-3D ([Leica P2P](https://shop.leica-geosystems.com/measurement-tools/disto/disto-p2p-technology), [X6 FAQ](https://shop.leica-geosystems.com/measurement-tools/disto/blog/x6-faqs)).

### 11.3 מפת מצב/פקודה — מה מפעיל כל פונקציה

| פונקציה שאנחנו רוצים | מה מפעיל אותה | ערוץ-BLE / UUID | קוד/מצב |
|----------------------|----------------|------------------|----------|
| **מרחק (DIST)** ✅ עובד | פונקציית-מרחק רגילה + לחיצת-כפתור | `3ab1010d` bytes 0–3 (float LE מ') | notify — **כבר עובד** |
| **זווית-אנכית (vAngle)** | **בחירת פונקציית-נטייה/P2P/Smart-Room על המכשיר**; אז המדידה נלקחת "עם-זווית" | `3ab1010d` bytes 4–7 (float LE rad) — `+Inf` במצב-DIST | **בחירת-פונקציה על המכשיר**, לא פקודת-BLE. הקוד כבר מפרסר את bytes 4–7 |
| **זווית-אופקית (azimuth)** | **DST 360-X מחובר + פעיל** (מצב-P2P/Measure-3D + מפולס); סיבוב-המתאם מעדכן encoder | `3ab1010f` bytes 0–3 (float LE rad) — read/**poll** | ה-poll **כבר קיים** (`startHAnglePoll`); מתעדכן רק כשה-DST פעיל |
| **נטייה/פילוס (level)** | DST 360-X מפולס; ראה §2/§9.4 | מועמד: `3ab1010f` bytes 4–11 (**לא-מפוענח**) | **טעון בדיקת-חומרה** (§8 #1) |
| **P2P (XYZ מוכן)** | מצב-P2P/Measure-3D **מפולס** על DST 360-X; המכשיר פותר טריגונומטריה | ייתכן ב-`3ab1010d` bytes 8–11 (**"ערך-משני"**, 0 במצב-DIST) **[טעון-אימות]**, או שאנחנו פותרים לבד ב-`StationSolver` | אנחנו **לא צריכים** את ה-XYZ-המוכן — יש לנו dist+hAngle+vAngle → `toPlan` |
| **פקודת-start (רשות)** | רק אם notify לא-זורם בלי טריגר | write ל-`3ab10109` (בייט `0x67` מ-drizdar §9.2) | **לא-נדרש** (ה-notify של ה-DIST כבר עובד) |

> **הבחנה מרכזית:** אין **פקודת-BLE ידועה** ש"מדליקה מצב-זווית". השליטה במצב היא **על-המכשיר**
> (כפתור FUNC → בחירת-פונקציה). הגדרות-Bluetooth של המכשיר (Autosend/Navigation וכו') הן
> device-side ([Graebert — DISTO X3 BT settings](https://help.graebert.com/en/articles/3020534-11-the-leica-disto-x3-bluetooth-settings)),
> לא נשלטות מהאפליקציה. **elcad עצמו לא מחליף מצב מרחוק — הוא מסתמך על בחירת-הפונקציה של המפעיל.**

### 11.4 מה לשנות ב-`LaserBle.kt` / `P2PMeasureScreen.kt` כדי לקבל זווית+פילוס+P2P

**המסקנה החשובה: רוב-התיקון הוא תפעולי (מצב-מכשיר), לא קוד.** אבל צריך שהאפליקציה **תכוון
את המפעיל** ותחשוף בבירור למה חסרה זווית. שינויים additive:

**(א) `LaserBle.kt` — לחשוף את "מצב-המדידה" (יש/אין זווית):**
```kotlin
// parseLeica כבר מזהה vAngle=Inf (bytes 4–7) → vDeg=null. נחשוף את זה כמצב:
data class MeasMode(val hasVAngle: Boolean, val hasAzimuth: Boolean)
private val _measMode = MutableStateFlow(MeasMode(false, false))
val measMode: StateFlow<MeasMode> = _measMode
// ב-parseLeica: hasVAngle = vAngleRad.isFinite()  (false כשמגיע 00 00 80 7F)
// ב-updateHAngle: hasAzimuth = az.isFinite() && az != 0f (DST 360-X פעיל)
```
- **לא צריך** פקודת-mode ל-`3ab10109`. ה-notify של `3ab1010d` כבר זורם (DIST עובד); כשהמפעיל
  יבחר פונקציית-נטייה/P2P, אותו notify ימלא את bytes 4–7 אוטומטית — הקוד כבר מוכן.
- **לשמר subscribe-לכל-ה-characteristics** (`enableAllNotifyIndicate`) — מאשש ע"י B4X (§9.2)
  שזה נדרש כדי שה-notify של ערוצי-הזווית יזרום. **כבר עושים.**
- **poll ל-`3ab1010f`** — **כבר קיים**; רק לוודא שהוא סובל `NaN`/`0` (DST לא-פעיל) בלי-לקרוס.

**(ב) `P2PMeasureScreen.kt` — הכוונת-המפעיל למצב-הנכון:**
```kotlin
val mode by ble.measMode.collectAsStateWithLifecycle(...)
// אחרי שער-הפילוס, לפני הירי:
if (connected != null && !mode.hasVAngle)
    InfoHint("המכשיר במצב מרחק (DIST). בחר על מסך-המכשיר את פונקציית Measure 3D / P2P / " +
             "נטייה — כדי שכל ירייה תכלול זווית. (במצב-DIST הזווית לא נשלחת.)")
if (connected != null && mode.hasVAngle && !mode.hasAzimuth)
    InfoHint("יש זווית-אנכית אך אין azimuth — ודא ש-DST 360-X מחובר, מפולס, ובמצב-P2P.")
```
- זה **משלים** את ה-`hAngleMissing` הקיים: מבדיל בין "אין מתאם" (`hAngleMissing`) לבין "יש
  מתאם אבל המכשיר ב-DIST" (`!hasVAngle`) — שני מצבים שונים עם תיקון שונה.
- הירי כבר חסום על `!hAngleMissing`; אפשר להוסיף `&& mode.hasVAngle` כדי לא-לקלוט ירייה
  חסרת-זווית (מונע פינה-על-קו כשהמכשיר בטעות ב-DIST).

**(ג) בדיקת-שדה מיידית (בלי קוד):** אחרי פילוס — **בחר על ה-X6 את פונקציית P2P/Measure-3D**
(לא DIST) וירֵה. צפה ב-`Diag` (פאנל-האבחון): `3ab1010d` bytes 4–7 צריכים לצאת מ-`00 00 80 7F`
לערך-אמיתי, ו-`3ab1010f` azimuth צריך להשתנות עם-סיבוב. **זה מאשש שהכול תלוי-מצב-מכשיר.**

### 11.5 מקורות §11

- [messfreunde — Leica DISTO Plan App Wiki](https://messfreunde.de/messfreunde-wiki-leica-disto-plan-app) — Smart Room לוכד זוויות-בין-מדידות ע"י חיישני-המכשיר.
- [Leica P2P Technology](https://shop.leica-geosystems.com/measurement-tools/disto/disto-p2p-technology) · [X6 FAQs](https://shop.leica-geosystems.com/measurement-tools/disto/blog/x6-faqs) — P2P נוצר רק במצב-P2P מפולס על DST 360-X.
- [Leica DISTO X6 — measure 3D from multiple locations (YouTube)](https://www.youtube.com/watch?v=fNz-gsa3Sds) · [How to measure 3D and relocate (YouTube)](https://www.youtube.com/watch?v=eUrv1bf02FU) — Measure 3D + relocation.
- [Graebert — Leica DISTO X3 Bluetooth Settings](https://help.graebert.com/en/articles/3020534-11-the-leica-disto-x3-bluetooth-settings) — הגדרות-BT device-side (FUNC, Autosend, Navigation).
- [OrthoGraph + DISTO X6](https://www.contractors-tools.com/leica-disto-apps/orthograph/) — one-tap 3D placement + relocation P2P.
- [eluCad Tutorial 4.0 3D Post-Processing (Vimeo)](https://vimeo.com/258809781) · [elusoft eluCad](https://www.elusoft.de/en/products/elucad/) — eluCad 3D-Import (elcad-family).
- Soline פנימי: [`ops/docs/DISTO_PROTOCOL.md`](../ops/docs/DISTO_PROTOCOL.md) (לכידה-חיה: vAngle=Inf במצב-DIST; `DistanceAndInclinationBluetoothResponse`), [`disto_integration.md`](disto_integration.md), [`cabinet_vision.md`](../converter/docs/cabinet_vision.md) (InnoDraw El_Cad).

---
*מסמך מחקר+תכן בלבד. לא שונה source. כל שינוי-קוד כאן הוא הצעה למימוש-עתידי, טעון אימות מול
X6+DST 360-X פיזיים.*
