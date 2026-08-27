# Soline Ops — מצב הפרויקט (מקור־אמת)

> **➡️ חוזרים לעבודה? קרא קודם `NEXT.md` — נקודת-ההמשך המדויקת (עצירה 2026-08-16).**
> קרא אותי קודם. זה מקור־האמת של **מסלול התפעול** (App לניהול מערך המדידות).
> המסלול השני — הממיר — חי ב־`../ordx-pdp-converter` עם ה־STATUS משלו. **שני מסלולים, ממשק אחד.**
> עודכן: 2026-08-16

## 🎯 מיצוב מתוקן (2026-08-16) — קרא ראשון
**Soline היא חברת-בת של פורת מדידות בע"מ.**
- **פורת (האם)** מודדת **שיש** — קהל: **מפעלי שיש**.
- **Soline (הבת)** מודדת **ארונות — לפני השיש** — קהל: **נגרים**.
- שרשרת מטבח: מדידת חלל/ארונות (Soline·לנגר) ← בניית ארונות ← מדידת שיש (פורת·למפעל) ← ייצור השיש.
- השתיים **משלימות, לא מתחרות** — יחד מחזיקות את שני שלבי-המדידה של כל מטבח.
- **המסגור התחרותי במחקר-הרשת (מילימטר/ACRE/CabiAI וכו') לא רלוונטי ליעד** — מסומן כטעון-תיקון ב-`MARKET_SYNTHESIS.md`. האמת תיקבע ב**סקר-שטח** (`FIELD_SURVEY_KIT.md`).

## 🔬 יום 2026-08-16 — הנדסה-הפוכה של אפליקציית המדידה + תכנון בנייה
**הבסיס לתוכנת המדידה של Soline הוא האפליקציה הקיימת `app-debug.apk` (CVSM · com.roommeasure.app v5.2.0).** נותחה מקצה-לקצה — סטטי (APK/DEX/Room) וגם **חי דרך טאבלט מחובר ב-ADB**.
- **פרוטוקולי לייזר פוענחו חי** (מדידה אמיתית): Leica DISTO X6 + DST 360 (3D) ו-Bosch GLM 50C (2D) → `docs/DISTO_PROTOCOL.md`. אין צורך ב-SDK — הכול BLE סטנדרטי.
- **ניתוח מלא של האפליקציה:** `MEASURE_APP_ANALYSIS.md` (סטאק Kotlin/Compose/Room, מודל-נתונים, מסכים), `MEASURE_SCREENS.md`, `MEASURE_APP_ISSUES.md` (13 באגים, 2 קריטיים), `MEASURE_FIELD_WORKFLOW.md` (מסע-המודד, 17 אילתורים), `MEASURE_REBUILD_PLAN.md` (adapt לא rebuild), `MEASURE_TO_DESIGN_BRIDGE.md`, `ORDX_BRIDGE.md`.
- **תלות אסטרטגית שהתגלתה:** ספק חיצוני (bravh) מספק גם את אפליקציית-המדידה וגם את כלי-העיצוב (3D OrdX) — Soline רק licensee. ניתוק התלות = ציר-על בתכנון.
- **חדר-דמו נבנה בהזרקת-נתונים** (project id=2, 5 קירות + כל 12 סוגי האלמנטים) → יוצא ORDX מקיף `docs/samples/measure_export_ALL_elements.ordx`.
- **תכנון בנייה — 10 סוכנים מקבילים** → `docs/build/` (10 מסמכים + `00-BUILD_INDEX.md`) עם **99 החלטות מובנות** (`_decisions.json`): P0=46 · P1=37 · P2=16.

**🧭 דאשבורד ההכרעה:** `docs/build/DECISION_DASHBOARD.html` (99 החלטות, סינון/סימון/ייצוא, שדה-שם).

**✅ כל 99 ההכרעות הוכרעו (2026-08-17, Michael):** 98 מאושרות, 1 נדחתה (#42 בירור-רישוי bravh — אין יחסי-רישוי). נשמר ב-`docs/build/decisions/soline_hachraot_Michael.json` (46 P0 + 37 P1 + 16 P2). הכרעות-מפתח: #1 התאמה=**reimplement** (לכתוב את שלנו לפי השרטוט שלהם, לא לשלוח הקוד שלהם); #11 מנוע-התאמה כרכיב-משותף (הבידול); #41 ניתוק דו-שלבי מ-bravh (קודם מדידה); #33 Supabase self-host; #38 היברידי (Drive→שרת); #31 מחליף Cabinet Vision מתויג v3 (+ PP13: CV נשאר יעד-ייצוא אופציונלי); #46 גבייה ב-H1; PP14 escrow של ה-IP לפני שיחת-משקיע.
**👷 תוכנית-צוות:** `docs/TEAM_PLAN.md` — צוות רזה מואץ-AI: מהנדס-אנדרואיד מוביל **עכשיו** (קריטי), Backend תוך רבעון; קלוד כותב את חלק-הארי.
**🚀 ציר-זמן:** `docs/build/ROADMAP_TIMELINE.html` — v1 (הכלי שלנו) 3–6 ח' · v2 (בידול) 9–12 ח' · v3 (אקוסיסטם) 18+ ח'.
**🔬 עדכון 5.3.0:** `docs/MEASURE_APP_UPDATE_5.3.0.md` — bravh הוסיפו T-Join (מאמת #18/#25), מדידת-חזית, מידה-חופשית, ונעילת-רישיון-חד-מכשיר (מחזק את #41/#35).
**🔬 עדכון 5.4.0:** הטאבלט עודכן ל-5.4.0 (2026-08-17); עדכון קטן (3 מחלקות: טופס פרטי-פרויקט + דיאלוג-מדריך). ניתוח: `docs/MEASURE_APP_UPDATE_5.4.0.md`.
**⏳ הבא:** (1) יותם נותן ערך משלו (`docs/PROMPT_FOR_YOTAM_DASHBOARD.md` → `docs/build/decisions/soline_hachraot_יותם.json`); (2) **גיוס מהנדס-אנדרואיד מוביל → תחילת H1** (המהלך המעשי); (3) לאחד Michael+יותם לתוכנית-ביצוע H1 מפורטת.

## 📁 אינדקס תוצרים (כל מה שנעשה)
**מדידה (RE):** `MEASURE_APP_ANALYSIS.md` · `DISTO_PROTOCOL.md` · `MEASURE_SCREENS.md` · `MEASURE_APP_ISSUES.md` · `MEASURE_FIELD_WORKFLOW.md` · `MEASURE_REBUILD_PLAN.md` · `MEASURE_TO_DESIGN_BRIDGE.md` · `ORDX_BRIDGE.md` · `MEASURE_TOOL_SPEC.md`(v1.1)
**תכנון בנייה:** `docs/build/00-BUILD_INDEX.md` + 10 מסמכי-צירים + `_decisions.json` (99 החלטות)
**אסטרטגיה/חזון:** `PLATFORM_VISION.md` · `STRATEGY.md` · `OWNER_ANALYSIS.md` · `STAKEHOLDERS.md` · `MARKET_SYNTHESIS.md`(טעון-תיקון) · `MARKET_ISRAEL.md` · `CARPENTER_PAINS.md`
**אפיון מוצר:** `MASTER_SPEC.md` · `SPEC.md` · `WORKFLOW.md` · `ROLES_PERMISSIONS.md` · `PRICING_CATALOG.md` · `METRICS_ENGINE.md` · `ADMIN_DASHBOARD.md`
**אקוסיסטם:** `SOL_FORMAT.md` · `DESIGN_TOOL_SPEC.md`(v1.1) · `MEASURE_TOOL_SPEC.md`(v1.1) · `CARPENTER_TOOLS.md`
**סקר שטח:** `FIELD_SURVEY_KIT.md` (הפק"ל לאימות בשטח)
**תצוגות (artifacts):** `workflow.html` (תרשים תהליך) · `master_spec.html` (אפיון-אב) · `ceo_brief.html` (מצגת מנכ"ל) · **`soline_for_yotam.html` (המסמך המאוחד ליותם — מקור artifact)**
**קובץ עריכה ליותם:** **`Soline_Yotam.html`** — קובץ HTML עצמאי, **ניתן-לעריכה בדפדפן** (contenteditable + כפתור "שמור כקובץ חדש"). זרימה: יותם פותח במחשב → עורך במסך → שומר כ-`Soline_Yotam_edited.html` → מעלה לקלוד להמשך אפיון מצד המנכ"ל.
**Word:** `Soline_Master_Spec.docx`

## מה זה
**פלטפורמת שירות רב־נגרים** (web + אנדרואיד/Capacitor, offline-first) לניהול כל לולאת התפעול:
**הנגר מזמין → משרד מקבל ומברר → שיבוץ → מדידה בשטח → עיבוד (הממיר) → בדיקה → מסירה לנגר.**

הנגר הוא הלקוח: פותח הזמנה, עוקב אחרי הסטטוס, ומקבל קבצים. Soline מבצעת ומחזירה.
היא לא ממירה קבצים — זה תפקיד הממיר. היא **מנהלת את העבודה** מסביב לממיר (ממשק ב-`docs/INTERFACE.md`).

**התהליך המלא, התפקידים וההרשאות — מוגדרים ב-`docs/WORKFLOW.md` + `docs/ROLES_PERMISSIONS.md` (מקור־אמת).**

## ארבעה תפקידים
- **נגר** (חיצוני, web) — רק ההזמנות שלו: יצירה, מעקב, הורדת קבצים.
- **מודד** (סמארטפון, offline) — רק עבודות שהוקצו לו: קליטת מדידה.
- **מתאם** (מחשב) — כל העבודות: קליטה, בירור, שיבוץ, בדיקה, מסירה.
- **מנהל** (מחשב) — הכול + ניהול משתמשים והרשאות.

## החלטות אדריכליות (נעולות)
- **בלי שלב־build.** HTML/CSS/JS טהור + IndexedDB + Service Worker. הסיבה: `node_modules` בתוך Google Drive = סיוט סנכרון, והמודל שלנו מבוסס־Drive. התיקייה נשארת נקייה וניתנת לשיתוף כמו הממיר.
- **offline-first הוא חובה.** כל פעולה עובדת בלי רשת. הנתונים ב־IndexedDB במכשיר. סנכרון = שלב עתידי (`outbox`).
- **Capacitor עוטף את `www/` ל־APK.** בניית ה־APK נעשית על מכונה עם Android Studio (לא כאן — אין Java/Gradle בסביבה הזו).
- **עברית, RTL, לשון זכר.** שפת־עיצוב מ־`../soline-ops/ops.html`.

## סטטוס בנייה
**התהליך והתפקידים תוכננו במלואם (2026-08-14).** התרשים אושר ויזואלית ב-`docs/workflow.html`.
השלד הראשוני (v0) נבנה עם pipeline של 7 שלבים ותפקיד יחיד — **צריך רה-ארכיטקטורה** ל-11 השלבים, 4 התפקידים וההרשאות.

| מודול | מצב | הערה |
|---|---|---|
| תרשים תהליך + תפקידים + הרשאות | ✅ הושלם | `WORKFLOW.md`, `ROLES_PERMISSIONS.md`, `workflow.html` |
| שלד app v0 (7 שלבים, תפקיד יחיד) | ✅ עובד | לוח, לו״ז, פרטי עבודה, קליטה, מסירה — נטען מ-IndexedDB |
| רה-ארכיטקטורה: 4 תפקידים + הרשאות | ⬜ הבא | בורר תפקיד, סינון לפי tenant, מסך בית לכל תפקיד |
| pipeline מורחב (11 שלבים) | ⬜ הבא | +submitted/accepted/assessment/approved/closed |
| פורטל נגר (הזמנה + מעקב + הורדה) | ⬜ הבא | טופס הזמנה מפורט, סטטוס מפושט |
| שלב בירור ואימות שטח + הערכת זמן | ⬜ הבא | לפני שיבוץ; `assessment{...}` על העבודה |
| תמחור + קטלוג מק״טים | ⬜ הבא | `catalog`, `carpenterRates`, `order.items`, `pricing`; מחיר גלוי, רווחיות לאדמין |
| מנוע מדדים נסתר | ⬜ הבא | זמן משרד/נסיעה/מדידה + ק״מ (GPS); **אדמין בלבד** |
| דאשבורד ניהולי + KPI | ⬜ הבא | מסך בית לאדמין; תפעול+כספים+שטח+דיוק הערכה; **אדמין בלבד** |

מסמכי־אמת של התכנון: **`MASTER_SPEC.md` (אפיון-אב — כניסה למתכנתים)** + הפלטים `master_spec.html` (Artifact) ו-`Soline_Master_Spec.docx` (Word). מחקר שוק וסינתזה: **`MARKET_SYNTHESIS.md`** (חיבור הכול), `MARKET_ISRAEL.md`, `CARPENTER_PAINS.md`, `ceo_brief.html` (מצגת מנכ"ל). מסמכי-בן: `SPEC.md`, `STRATEGY.md`, `OWNER_ANALYSIS.md`, `STAKEHOLDERS.md`, `PLATFORM_VISION.md`, `SOL_FORMAT.md`, `CARPENTER_TOOLS.md`, `DESIGN_TOOL_SPEC.md`, `WORKFLOW.md`, `ROLES_PERMISSIONS.md`, `PRICING_CATALOG.md`, `METRICS_ENGINE.md`, `ADMIN_DASHBOARD.md`, `workflow.html`.
**סדר בנייה שנקבע:** מתחילים מ**פורטל הנגר**.

## 🚀 הרחבת חזון: אקוסיסטם + פורמט .sol (2026-08-15)
Soline מתרחבת ממערכת תפעול ל**אקוסיסטם עיצוב+מדידה+ייצור**, סביב פורמט קנייני **`.sol`** (סימן מסחרי).
לולאה סגורה: הנגר מעצב בתוכנת Soline → אנחנו מודדים → מעמידים ומתאימים מול המציאות → מחזירים `.sol` להמשך עבודה → ייצור. הנחת יסוד: שליטה בשוק הישראלי, רמת חברה נסחרת ב-NASDAQ.
מסמכי עומק (בכתיבה/הושלמו): `PLATFORM_VISION.md`, `SOL_FORMAT.md`, `CARPENTER_TOOLS.md`, `DESIGN_TOOL_SPEC.md`.

## ⚠️ מצב הקוד (הבנייה עצורה לבקשת Michael, 2026-08-15)
- `www/db.js` — **נכתב מחדש** למודל המלא (8 stores, 11 שלבים, קטלוג/תמחור, seed). מוכן.
- `www/app.js`, `index.html`, `styles.css` — **עדיין במודל הישן (v0)**. לכן **האפליקציה כרגע לא רצה** עד שנעדכן את app.js.
- כדי להחזיר לריצה: או להשלים את app.js למודל החדש, או להחזיר את db.js ל-v0. **לא לגעת עד הנחיה.**

## מבנה
```
soline-ops-app/
├─ STATUS.md            ← אתה כאן
├─ www/                 ← האפליקציה (זה מה ש-Capacitor עוטף)
│  ├─ index.html
│  ├─ app.js            ← ראוטר + מסכים
│  ├─ db.js             ← IndexedDB (סכמה + seed)
│  ├─ styles.css
│  ├─ sw.js             ← Service Worker (offline)
│  └─ manifest.webmanifest
├─ docs/
│  ├─ DATA_MODEL.md     ← ישויות + סטטוסים
│  └─ INTERFACE.md      ← החוזה בין התפעול לממיר
├─ inbox/               ← תרומות ידע/קבצים (כמו בממיר)
├─ tools/serve.js       ← שרת סטטי לפיתוח (node, בלי תלויות)
├─ package.json         ← ל-Capacitor בלבד (לא נדרש להרצה)
└─ capacitor.config.json
```

## איך מריצים (פיתוח, בדפדפן)
```
node tools/serve.js
# פותח את www/ על http://localhost:5173
```

## איך בונים APK (אצל Michael, מכונה עם Android Studio)
```
npm install
npx cap add android
npx cap sync
npx cap open android   # בונים/מריצים מ-Android Studio
```

## הצעד הבא
1. **מודל תפקידים + הרשאות** — בורר תפקיד (dev), סינון נתונים לפי tenant/הקצאה ב-`db.js`.
2. **pipeline 11 שלבים** + מסך בית לכל תפקיד (נגר/מודד/מתאם/מנהל).
3. **פורטל נגר** — טופס הזמנה מפורט + מעקב סטטוס מפושט + הורדת קבצים.
4. **שלב בירור ואימות שטח** + הערכת זמן לפני שיבוץ.
5. חיבור אמיתי לממיר דרך `docs/INTERFACE.md` (שלב מתקדם).

## כללי תיאום (כמו בממיר)
- **STATUS.md הוא מקור־האמת** — עדכן אחרי כל שינוי מהותי.
- **לא עורכים את אותו קובץ קוד בשני סשנים.** חלוקה: ידע → `inbox/`; קוד → מתואם דרך Michael.
- פונים בלשון זכר.
