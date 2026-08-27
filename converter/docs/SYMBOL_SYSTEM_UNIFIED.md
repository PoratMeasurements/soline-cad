# SYMBOL_SYSTEM_UNIFIED — מקור-אמת יחיד לסמל/אלמנט/בלוק

> מסמך-אב-ממשל. ממפה את **כל** מערכות-הסמלים בפרויקט, מזהה את הכפילויות, וקובע **מקור-אמת
> יחיד** לכל אלמנט המזין DXF-2D + דו״ח (+ מיידע בלוקים). כל עבודת-סמל/בלוק עתידית מתאמת דרך כאן.
> מחבר: Soline symbol-authority · תאריך: 2026-08-24.

---

## 1. תקציר-מנהלים

נמצאו **11 מערכות** המחזיקות/צורכות גאומטריית-סמל, מתוכן **4 חנויות-גאומטריה מתחרות לאותם
מכשירים** ו**3 משטחי-הגדרה לדלת/חלון**. התוצאה: שקע/מפסק/מים מצוירים ב-3 דרכים שונות בשלושה
מייצאים, וערוץ-הדו״ח המפורסם (`toReportDef`) כלל אינו בשימוש.

**ההכרעה:** `converter/src/element_symbols_soline.js` הוא **מקור-האמת היחיד** לגאומטריית-הסמל
של כל אלמנט-נקודתי (MEP + דלת/חלון סכמטי). כל שאר החנויות (`GLYPHS`, `BLOCKS_2D`,
`symbols.json`, `symbols_raumplan.json`) **מיושנות** ויוחלפו בקריאה ל-`toDxf2dGlyph`/`toReportDef`.
בלוקי-הרהיטים ב-`blocklib/` משלימים (מ״מ-אמת) ואינם מתחרים — פרט למודול-הפתחים שיפנה לכאן.

---

## 2. מפת-המערכות (מצב קיים)

| # | מערכת | קובץ (מוחלט) | פורמט | מחווט? | יחס למקור-האמת |
|---|---|---|---|---|---|
| 1 | **סמלי-אלמנט Soline** | `converter/src/element_symbols_soline.js` | תיבת-יחידה `[0..1]`, פרימיטיבים | כן | **מקור-האמת** |
| 2 | `GLYPHS` | `converter/src/export_dxf2d.js` (~190) | מ״מ, ~8 גליפים גסים | שריד (classify בלבד) | כפילות → למחוק |
| 3 | `BLOCKS_2D` | `converter/src/export_dxf_pro.js` (~329) | מ״מ, ~10 גליפים | **כן — נתיב-ציור פעיל** | **כפילות פעילה** → להחליף |
| 4 | `symbols.json` | `converter/symbols.json` | frame 0..1000, polylines | כן (כותב-2D פנימי ב-`soline_convert.js`) | כפילות → להחליף |
| 5 | `symbols_raumplan.json` | `converter/symbols_raumplan.json` | frame 0..1000, polylines | **אין צרכן** | יתום → למחוק |
| 6 | בלוקי-פתחים | `converter/blocklib/openings/openings_module.js` | מ״מ-אמת, LAYERS+CATALOG משלו | לא (preview) | כפילות דלת/חלון → לפנות לכאן |
| 7 | `opening_schema` | `converter/src/opening_schema.js` | פרמטרים (ללא גאומטריה) | כן (dxf2d+pro) | חולק keys עם §1 — **להשאיר** (שכבת-פרמטר) |
| 8 | בלוקי-רהיטים | `converter/blocklib/docs/*.object.json` + schema | מ״מ-אמת `*.object.json` | לא (schema-stage) | **משלים** (לא כפילות) |
| 9 | PDP native | `writePdpDR.js`, `convertNative.js`, `injectSupp.js`, `injectNativeItem.js`, `writePdpNative.js` | קודים בינאריים `{code+block}` | כן | **עצמאי** (סמל Raumplan-authored, ללא גאומטריה מצוירת) |
| 10 | מרקרי-PDF/viz | `converter/src/export_pdf.js`, `viz_engine.js` | דיסק/מלבן גנרי | כן | **מתעלם מ-§1** → לאמץ `toReportDef` |
| 11 | מטא-דאטה | `elements.json`, `elements_raumplan.json` | JSON תכונות + `symbol_2d` טקסטואלי | נרחב | **מטא בלבד** (לא גאומטריה) — מרחב-שמות `en` לגישור |

מקור-אמת-ה"פורמט-דו״ח": `ops/docs/cvsm_reference/cvsm_html_export/app.js::renderSymbol` (סכימת `symbol_defs`).

---

## 3. נקודות-החום של הכפילות

**(א) ארבע חנויות-גאומטריה לאותם מכשירים.** שקע/מפסק/מים/גז/מאור מוגדרים 4 פעמים:
`element_symbols_soline` (§1) ≠ `GLYPHS` (§2) ≠ `BLOCKS_2D` (§3) ≠ `symbols.json` (§4).
- `export_dxf2d` מצייר מ-§1 (`toDxf2dGlyph`) — ✅ תקין.
- `export_dxf_pro` **מצייר מ-§3 (`BLOCKS_2D`)** למרות שהכותרת טוענת ל-§1 — ❌ מקור-אמת מפוצל.
- `soline_convert` מצייר מ-§4 (`symbols.json`) בכותב-2D פנימי — ❌ נתיב שלישי.

**(ב) שלושה משטחי דלת/חלון.** `element_symbols_soline` (סמלי door/window) + `opening_schema`
(פרמטרים) + `blocklib/openings/openings_module` (גאומטריית-מ״מ עצמאית, טוענת "מקור-אמת יחיד").

**(ג) ערוץ-דו״ח מת.** `toReportDef`→`symbol_defs` **אינו נצרך** באף מייצא; `export_pdf` המציא
מרקרים-גנריים (דיסקים ממוספרים) ו-`viz_engine` אינו מכיר את §1 כלל.

**(ד) יתום.** `symbols_raumplan.json` — ללא צרכן.

---

## 4. ההכרעה — מקור-אמת יחיד ומשטרו

### 4.1 העיקרון
> **אלמנט אחד ⇒ הגדרת-סמל אחת ב-`element_symbols_soline.js` ⇒ מוזרמת לכל הצרכנים דרך אדפטר.**

```
                         ┌──────────────────────────────────────────┐
   item (ORDX/PDP/…) ───▶│  element_symbols_soline.js  (מקור-האמת)   │
                         │  SYMBOLS[key] = { plan[], elev, dims, … } │
                         └──────────────┬───────────────────────────┘
             resolveKey/symbolFor       │ toDxf2dGlyph        │ toReportDef
                          ┌─────────────┼─────────────────────┼──────────────┐
                          ▼             ▼                     ▼              ▼
                  export_dxf2d   export_dxf_pro          export_pdf /     blocklib/openings
                  (DXF-2D) ✅     (BLOCKS_2D→toDxf2d)     viz (symbol_defs) (mepCompanions→symKey)
```

### 4.2 חוזה-האדפטרים (יציב, לא-משתנה)
- `symbolFor(item) → { key, category, discipline, mount, dims, plan[], elev }` — פתרון + מידות-אמת.
- `toDxf2dGlyph(sym,{w,h,view}) → [polyline | {circle} | {arc} | {label}]` — mm, קיר ב-Y=0, +Y לחדר. **הצרכן היחיד לגאומטריית-DXF-2D.**
- `toReportDef(sym) → { plan, elev }` — פורמט `symbol_defs` של CVSM. **הצרכן היחיד לגאומטריית-דו״ח/PDF/viz.**
- מפתחות (`SYMBOLS` keys), `NAME_MAP`, `CATEGORY_DEFAULT` — **ABI יציב.** שינוי-גאומטריה מותר; שינוי-מפתח/שם אסור ללא עדכון-צרכנים.

### 4.3 תכנית-המיגרציה (בעלות מחוץ למודול זה — מתואמת דרך מסמך זה)
> קבצי-המייצא בבעלות סוכן-הפריסה (layout agent). מסמך זה הוא ההוראה הסמכותית; הביצוע שם.

| # | פעולה | קובץ | סטטוס-יעד |
|---|---|---|---|
| M1 | להחליף ציור מ-`BLOCKS_2D` ל-`SYM.toDxf2dGlyph(SYM.symbolFor(it),{w,h})` | `export_dxf_pro.js` | **קריטי** — מבטל מקור-אמת מפוצל |
| M2 | למחוק `GLYPHS`; להשאיר classify-flag בלבד אם נדרש, ממקור §1 | `export_dxf2d.js` | ניקוי |
| M3 | להחליף כותב-2D הפנימי ל-`toDxf2dGlyph`; לבטל תלות ב-`symbols.json` | `soline_convert.js` | ניקוי |
| M4 | לאמץ `toReportDef` למרקרים בדו״ח (במקום דיסקים-גנריים) | `export_pdf.js` | שדרוג-איכות |
| M5 | להזרים `symbol_defs` מ-`toReportDef` ל-viewer | `viz_engine.js` / export_html | שדרוג |
| M6 | מודול-הפתחים יפנה ל-`SYM` (symKey→typeDef) במקום CATALOG-גאומטריה כפול | `blocklib/openings/openings_module.js` | איחוד דלת/חלון |
| M7 | למחוק יתום | `symbols_raumplan.json` | ניקוי |
| M8 | `symbols.json` → נגזר-בנייה מ-§1 (אם עדיין נחוץ ל-frame 0..1000) או למחוק | `converter/symbols.json` | ניקוי |

**מותר-לי-לבצע כעת (בעלות מודול-הסמל):** M-doc זה + ריבנוד-הסמלים (§Part 3) + הזרמת-`toReportDef`
תקינה. **אסור-לי:** לגעת ב-`export_dxf2d.js`/`export_dxf_pro.js`/`dxf_soline.js`/`writePdpDR.js`.
לכן M1–M8 מתועדים כהוראות-יעד לסוכן-הפריסה, לא מבוצעים כאן.

### 4.4 דלת/חלון — ריבוד-אחריות (ללא כפילות)
- **גאומטריית-הסמל** (רבע-קשת, כנף, זיגוג) — רק ב-`element_symbols_soline` (`planDoor`/`planWindow`).
- **הפרמטרים** (hinge, kind, dims-config) — ב-`opening_schema` (משטח-אחד, קורא `SYM.resolveKey`). נשמר.
- **בלוק-מ״מ-אמת עשיר** (elev מלא, שכבות, ATTRIB) — `blocklib/openings` — יאותחל מ-symKey של §1
  ולא יגדיר קשת-דלת משלו. עד לאיחוד, `blocklib/openings` הוא **preview-ניסיוני בלבד, לא-מקור-אמת**.

### 4.5 רהיטים/ארונות — משלים (לא כפילות)
`blocklib` (ארונות/כיורים/מכשירים במ״מ-אמת) נשאר עצמאי ומשלים. הגשר: `metadata.mepCompanions[]`
→ מפתחות `element_symbols_soline` (למשל `["socket_counter","outlet_dishwasher"]`). אין חפיפת-גאומטריה.

### 4.6 PDP native — עצמאי-במהותו (ללא איחוד)
נתיב-ה-PDP מפנה לספריית-Raumplan בקוד-בינארי (`{code+block}`); אין גאומטריה מצוירת. הגשר
הקונספטואלי הוא `elements_raumplan.json` (Soline element → `raumplan_kdt`). **נשאר נפרד — לא כפילות-גאומטריה.**

---

## 5. מרחבי-שמות ואיחודם
שלושה מרחבי-מפתח קיימים: (א) מפתחות-`element_symbols_soline` (`socket_single`), (ב) שמות-`en`
ב-`elements*.json` (`"Single Socket"`), (ג) `SL_OPN_*`/`KIT-*` ב-blocklib. **הגישור המחייב:**
`resolveKey` ב-§1 כבר סופג את (ב) דרך `NAME_MAP`. blocklib (ג) יגשר דרך `mepCompanions`/`symKey`.
אין צורך במרחב-מפתח רביעי.

---

## 6. הגדרת מקור-האמת קדימה (הכלל)
1. **כל** גאומטריית-סמל-נקודתי חדשה/מתוקנת — נכנסת ל-`element_symbols_soline.js` בלבד.
2. צרכן חדש קורא רק דרך `symbolFor`+`toDxf2dGlyph`/`toReportDef`. אין הגדרת-גליף מקומית.
3. מפתח/שם — ABI יציב; שינוי דורש עדכון-צרכנים מתואם.
4. בלוקי-מ״מ-אמת (blocklib) — ל-רהיטים/עשירים; מפנים ל-§1 ל-MEP, לא משכפלים.
5. מסמך זה + `INFRA_SYMBOLS_STANDARD.md` = הסמכות. עבודת-סמל/בלוק עתידית מתאמת דרכם.
