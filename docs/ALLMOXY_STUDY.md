# מחקר Allmoxy — והשלכות על איכות יצוא ה‑ORDX של Soline

**מסמך הנדסי/מוצרי. נכתב 2026‑08‑30. מבוסס כולו על מקורות פומביים (knowledge‑base ואתר Allmoxy).**
כל טענה נושאת URL מקור בסוף השורה/הפסקה. מה שלא פורסם מסומן במפורש **[לא‑מתועד]** או **[מסקנה]**.

> הערת‑הקשר ל‑Soline: היצואן ה‑ORDX הקיים שלנו (`converter/src/export_ordx.js`) מכוון ל‑ORDX בטעם **InnoDraw/Raumplan** (Job→Rooms→Walls→Fixtures/Furnishings). מסמך זה עוסק ב‑Allmoxy כדי ללמוד אילו **שדות ייצור ברמת‑החלק** הסביבה שמעבר‑לזרם (downstream) מצפה להם. אין לערבב את זה עם מסלול‑הסמלים DXF‑2D (Sivan) — כאן מדובר על נתוני‑ייצור, לא סמלים.

---

## 1. מה זה Allmoxy

Allmoxy הוא **SaaS ענן לניהול עסקי‑ייצור (MRP) עבור תעשיית הארונות/הנגרות/רכיבי‑העץ** — לא כלי CAD ולא כלי מדידה. הוא הופך את חנות‑הנגרות ל"חנות‑הזמנות מקוונת + מנוע‑תמחור + מנהל‑ייצור". התפקיד שלו בזרימת‑העבודה: **קטלוג/הצעת‑מחיר → הזמנה → מסמכי‑פלט אוטומטיים (חשבונית, תעודת‑אריזה, רשימת‑חיתוך "All Parts") → ייצור (תוויות, קבצי‑מכונה) → יצוא ל‑CNC/nesting/הנהח"ש**. ([allmoxy.com](https://www.allmoxy.com/), [product‑overview](https://www.allmoxy.com/product-overview), [production‑acceleration](https://www.allmoxy.com/production-acceleration))

עיקר‑העניין למי‑שמוכר‑ורוצה‑להרוויח: "sell more online, automate their office, accelerate production" — מוכרים מקטלוג מקוון עם מחירון/אפשרויות/כללי‑ולידציה, ההזמנה זורמת ישירות לייצור עם רשימות‑חיתוך ודרישות‑חומר אוטומטיות. ([cabinet‑manufacturers](https://www.allmoxy.com/cabinet-manufacturers), [component‑manufacturers](https://www.allmoxy.com/component-manufacturers))

**מיקום בשרשרת:** Allmoxy יושב **אחרי** התכן/ההנדסה. הוא **צורך הזמנות** שמגיעות מכלי‑תכן (Cabinet Vision, ClosetPro, 2020 Design Live, Excel) ומוציא אותן לייצור. הוא אינו מודד חדרים ואינו מצייר ארונות. ([connecting‑allmoxy‑to‑industry‑partner‑software](https://articles.allmoxy.com/connecting-allmoxy-to-industry-partner-software))

---

## 2. פורמטים ואינטגרציות

### 2.1 מה Allmoxy מייצא ומייבא
- **יצוא:** "Allmoxy can export almost any piece of data related to an order through multiple file formats; including but not limited to, **.csv, .ord, .ordx, .xml**" (וגם Plain Text). היצוא נבנה ב‑Settings ▸ Exporters, ואז **פר‑מוצר** מגדירים איזה מידע נשלח, באמצעות **נוסחת‑יצוא** שנבנית ממשתנים ("blue links") בסרגל‑הצד. ([connecting‑…‑partner‑software](https://articles.allmoxy.com/connecting-allmoxy-to-industry-partner-software), [how‑do‑you‑set‑up‑excel‑columns](https://articles.allmoxy.com/how-do-you-set-up-excel-columns-for-exporting-files), [cabinet‑vision‑export](https://articles.allmoxy.com/cabinet-vision-export))
- **ייבוא:** בעיקר **CSV** (חברות/אנשי‑קשר/חשבוניות/אספקה/תכונות‑drop‑down), עם אפשרות "Allow me to match the fields" למיפוי שמות‑שדות. הזמנות מיובאות מ‑CSV שנוצר ב‑Cabinet Vision/Excel/מקורות‑אחרים. ([import‑data‑into‑allmoxy](https://articles.allmoxy.com/import-data-into-allmoxy), [can‑i‑import‑orders](https://articles.allmoxy.com/knowledge/can-i-import-orders-right-into-allmoxy))

### 2.2 מפת‑האינטגרציות (שותפי‑תעשייה) — עם הפורמט
| קטגוריה | תוכנה | פורמט |
|---|---|---|
| CAD/Machining | **Cabinet Vision** | **.ord או .ordx** — *".ord is the preferred file type for Cabinet Vision import"* |
| CAD/Design | **2020 Design Live** | API (design‑to‑order ישיר) |
| Design (ארונות/קלוזט) | **ClosetPro** | יצוא‑תכן → ייבוא ל‑Allmoxy |
| Nesting/CNC | **CutRite** | קובץ‑הזמנה מיוצא לאופטימיזציה/מיכון |
| CNC | **Microvellum** | **.XML** |
| CAD/CNC | **Mozaik** | **.csv** ("some manual adjustments required") |
| חיתוך‑אורך | **TigerStop / RazorGauge** | מידע‑פר‑מוצר למיכון‑מדויק |
| ERP/הנהח"ש | **NetSuite / QuickBooks / Sage / Xero** | ייצוא‑הזמנה/חשבונית, CSV/מיפוי/Zapier |

מקורות: ([connecting‑…‑partner‑software](https://articles.allmoxy.com/connecting-allmoxy-to-industry-partner-software), [cabinet‑vision‑export](https://articles.allmoxy.com/cabinet-vision-export)).

### 2.3 הכיוון מול Cabinet Vision (חשוב ל‑Soline)
Allmoxy מדבר עם CV **בשני הכיוונים**:
1. **CV → Allmoxy:** מייבאים תכן מ‑CV לתבנית‑Allmoxy (מסופק אפילו קובץ‑חבילה `PKG` לגרסת CV 2021, ו/או יצוא‑CSV מ‑CV). ([cabinet‑vision‑to‑allmoxy](https://articles.allmoxy.com/cabinet-vision-to-allmoxy), [import‑an‑order‑from‑cabinet‑vision](https://articles.allmoxy.com/en/knowledge/import-an-order-from-cabinet-vision-into-allmoxy))
2. **Allmoxy → CV:** שולחים הזמנת‑Allmoxy ל‑CV למיכון, ב‑**.ord** (מועדף) או **.ordx**. ([cabinet‑vision‑export](https://articles.allmoxy.com/cabinet-vision-export))

> **ממצא‑מפתח #1:** אינטגרטור כבד של CV מעדיף **.ord** על‑פני .ordx לייבוא ל‑CV. זה מאשש את המלצת `ORDX_SPEC_FROM_WEB.md` — **ORD‑Extended v4 הוא היעד העיקרי הנכון**, ו‑ORDX הוא שדרוג מאוחר.

---

## 3. מודל‑הנתונים של מוצר/חלק ב‑Allmoxy

**מבנה‑העל:** `Product` → מכיל **Attributes** (Item/Group, visible/non‑visible), **Pricing** (נוסחאות‑תמחור), **Parts** (החלקים הפיזיים), **Validations**, ו‑**Exporters**. ([product‑configuration](https://articles.allmoxy.com/product-configuration))

**רמת‑החלק (Part):** לכל חלק יש **נוסחת‑יצוא** שנבנית ממשתנים; מכאן שהחלק נושא לפחות: מידות, חומר, הקצה‑banding, כמות, שם/סוג‑חלק, ותוויות. ([how‑do‑you‑set‑up‑excel‑columns](https://articles.allmoxy.com/how-do-you-set-up-excel-columns-for-exporting-files))

**אוצר‑המילים של הייצור** (מ‑Design & Ordering Guide + עמודי‑הידע — זו השפה שהיצוא צריך לדבר):
- **חומר:** צבע/גימור + **עובי**, וגובה‑לוח מקסימלי (רוב החומרים עד 96"; White גבוה יותר). ([Design & Ordering Guide PDF](https://canary.allmoxy.com/data/partlists/Design%20and%20Ordering%20Guide%20Revised%201-20-25.pdf))
- **הקצה‑banding (edgebanding):** ברירת‑מחדל — banding **בכל הצדדים**; אפשר לבחור **רק את הקצוות הנדרשים** או להסיר banding מתפרים (seams). כלומר ה‑banding מוגדר **פר‑קצה**. ([product‑configuration + KB](https://articles.allmoxy.com/product-configuration))
- **כיוון‑סיב (grain):** משמעותי — לדוגמה cleats מיוצרים עם סיב **לאורך** ה‑length. הכיוון נשמר ומיוצא. ([Design & Ordering Guide PDF](https://canary.allmoxy.com/data/partlists/Design%20and%20Ordering%20Guide%20Revised%201-20-25.pdf))
- **קידוח/מיכון (drilling / line‑boring):** לוחות אנכיים נקדחים **מלא מלמעלה‑למטה**, או **קידוח‑חלקי** לפי דרישה; קידוחי‑צירים (hinge), חורי‑מנעול, חורי‑cam לגב‑פנלים. ([Design & Ordering Guide PDF](https://canary.allmoxy.com/data/partlists/Design%20and%20Ordering%20Guide%20Revised%201-20-25.pdf))
- **חומרה (hardware):** מסילות‑מגירה (side‑mount/undermount/concealed soft‑close), צירים (hinging: single/pair/top/bottom + כמות‑לפי‑גובה), מנעולים, סלסלות/baskets, מוטות. נוסף/מוסר מרשימת‑ה‑hardware. ([Design & Ordering Guide PDF](https://canary.allmoxy.com/data/partlists/Design%20and%20Ordering%20Guide%20Revised%201-20-25.pdf))
- **סוגי‑חלק/הרכבה:** vertical panels, fixed shelves, backs, drawer faces, drawer boxes (Zargen/dovetail/melamine), doors (פרופילים: Flat, Shaker, Traditional #4300/#4307, Oxford…), toe‑kick, fillers, crown‑molding‑nailer. ([Design & Ordering Guide PDF](https://canary.allmoxy.com/data/partlists/Design%20and%20Ordering%20Guide%20Revised%201-20-25.pdf))
- **תמחור:** נוסחאות פר‑חומר/מידה/אפשרות; פלטים אוטומטיים: invoice, packing slip, **All Parts cutlist**. ([pricing‑overview‑custom‑cabinets](https://articles.allmoxy.com/knowledge/pricing-overview-custom-cabinets), [automation‑in‑allmoxy](https://articles.allmoxy.com/automation-in-allmoxy))

> **התובנה המרכזית:** בסביבת‑ההזמנה/הייצור, **החלק (part) הוא יחידת‑המידע**, לא ה"ארון" כקופסה. לכל חלק: חומר+עובי, banding‑פר‑קצה, סיב, סוג‑חלק, קידוח, חומרה, כמות, תווית. זהו בדיוק המידע שקובץ‑יצוא צריך לשאת כדי "להיפתח נקי ולהיות שימושי מיד" ב‑CV/Allmoxy/nesting.

---

## 4. מה לאמץ — פערים קונקרטיים מול היצוא הנוכחי שלנו

### 4.1 מצב‑קיים (מ‑`converter/src/export_ordx.js`)
היצוא שלנו הוא **גאומטריית‑חדר + אלמנטים‑מונחים**: `Job → Rooms → Walls(position/dimensions/style) → Fixtures(שקעים/MEP) + Furnishings(חלונות/דלתות/ארונות)`. **ארון** נפלט כ‑`<Furnishing Class="Base" Type="Standard">` עם **Name + Size(W/H/D) + Position בלבד** — קופסה אטומה. **אין** חומר, אין banding, אין סיב, אין קידוח, אין חומרה, אין פירוק‑לחלקים, אין assembly/parts tree. זה מצוין למדידה‑וריהוט‑חדר, אך **לא מספיק** להזמנת‑ייצור downstream.

### 4.2 שדות/תכונות להוספה (רשימת‑עבודה, לפי עדיפות)
כדי להעלות איכות, יש להעשיר את רשומת‑הארון/החלק. מסודר מהמנוף‑הגדול לקטן:

**A. פירוק‑לחלקים ברמת‑הארון (המנוף הגדול ביותר).** להוסיף תחת כל `Furnishing`/ארון בלוק‑חלקים (`Parts`/`Assembly`) שבו כל חלק נושא את השדות הבאים:
1. **PartName / PartType** — סוג‑חלק קנוני (Side/Vertical Panel, Top, Bottom, Fixed Shelf, Adjustable Shelf, Back, Door, Drawer Face, Drawer Box, Toe‑Kick, Filler). ממופה לאוצר‑המילים בסעיף 3.
2. **Length / Width / Thickness** — מידות‑חלק (בנוסף למידות‑הארון החיצוניות).
3. **Material** — שם‑חומר + **Thickness** + (אופציונלי) צבע/גימור. שם‑החומר חייב להתאים לקטלוג‑היעד.
4. **Grain** — כיוון‑סיב (Length/Width/None).
5. **Edgebanding פר‑קצה** — 4 שדות (L1/L2/W1/W2 או Front/Back/Left/Right), כל אחד עם חומר‑ה‑banding או "none". זו קונבנציית‑Allmoxy (banding‑פר‑קצה) וגם קונבנציית‑nesting סטנדרטית.
6. **Quantity**.
7. **Machining/Drilling** — דגל קידוח מלא/חלקי, קידוחי‑צירים, line‑boring (אם ידוע).
8. **Comment / Label** — טקסט‑תווית לזיהוי בייצור.

**B. תכונות‑הרכבה ברמת‑הארון:**
9. **ConstructionStyle** — Frameless/Face‑Frame/32mm/Overlay (קיים כשדה ב‑ORD‑Extended header; להוסיף ל‑ORDX).
10. **Hinging** — pair/left/right/top/bottom.
11. **HardwareList** — מסילות/צירים/מנעולים/סלסלות עם כמות ותיאור.
12. **DoorProfile / DrawerFaceProfile** — שם‑פרופיל.

**C. עקביות‑פורמט (זול, משפר קבילות):**
13. שמות‑חומר/פרופיל/סגנון **חייבים להתקיים בקטלוג‑היעד** (CVData.mdf/קטלוג‑Allmoxy) אחרת לא ייקשרו — או להשמיט לגמרי בייצוא מדידה‑בלבד.
14. לנקות תווים ש"שוברים" פרסינג בשדות‑טקסט (`# ? = | ;`).
15. יחידה אחידה (mm) בכל המספרים.

> **ממצא‑מפתח #2 (המנוף הבודד הגדול ביותר לאיכות ה‑ORDX):** לעבור מ‑**"ארון = קופסה"** ל‑**"ארון = רשימת‑חלקים עם חומר + banding‑פר‑קצה + סיב + סוג‑חלק + חומרה"**. זה הופך את הקובץ מ"גאומטריה נחמדה" ל"הזמנת‑ייצור שנפתחת נקי". אם צריך לבחור **צעד אחד** — הוסיפו **material + edgebanding‑פר‑קצה + grain** לכל חלק; אלו שלושת השדות שכל כלי‑nesting/CV/Allmoxy מצפה להם ראשונים.

---

## 5. התאמה אסטרטגית — האם Allmoxy יעד‑אינטגרציה?

- **לא מתחרה** ל‑Soline: Allmoxy אינו מודד ואינו מצייר. Soline (מדידה→CAD) יושב **לפני** CV; Allmoxy יושב **אחרי**. אין חפיפה תחרותית.
- **לא כלי‑CAD** — לכן לא תחליף ל‑CV כיעד‑יצוא.
- **כן: מקור‑ייחוס למודל‑נתונים** — אוצר‑המילים של Allmoxy (part → material/banding/grain/hardware) הוא בדיוק מה שהיצוא שלנו צריך לדבר. זו התרומה המיידית.
- **יעד‑אינטגרציה עתידי — סביר אך לא‑מיידי:** המסלול הריאלי הוא **Soline → CV (ORD/ORDX) → Allmoxy**, לא Soline→Allmoxy ישיר. אם בכל‑זאת נרצה חיבור‑ישיר, הנתיב הזול הוא **ייבוא‑CSV** של Allmoxy (הזמנה/cutlist עם מיפוי‑שדות) או ה‑**API** (דורש sandbox בתשלום). Allmoxy עצמו מדגיש שאינו נוגע בהגדרות‑הצד‑השלישי — האחריות על הקובץ עלינו. ([can‑i‑import‑orders](https://articles.allmoxy.com/knowledge/can-i-import-orders-right-into-allmoxy), [allmoxy‑integrations](https://articles.allmoxy.com/allmoxy-integrations))
- **תמחור/שוק:** אין מחירון‑ציבורי. מודל‑תמחור **מותאם‑אישית** — Allmoxy יוצר‑קשר בחודש‑הראשון, בונה תוכנית וקובע דמי‑חודש מוסכמים; גישת‑API דורשת מנוי‑sandbox חודשי קטן. ([pricing](https://www.allmoxy.com/pricing) — 403 לבוט; פרטים מ‑snippet חיפוש + [community: subscription‑products](https://community.allmoxy.com/topic/228-subscription-products/))

---

## 6. מקורות
- אתר: https://www.allmoxy.com/ · https://www.allmoxy.com/product-overview · https://www.allmoxy.com/cabinet-manufacturers · https://www.allmoxy.com/component-manufacturers · https://www.allmoxy.com/production-acceleration · https://www.allmoxy.com/pricing
- Knowledge‑base: https://articles.allmoxy.com/connecting-allmoxy-to-industry-partner-software · https://articles.allmoxy.com/cabinet-vision-export · https://articles.allmoxy.com/cabinet-vision-to-allmoxy · https://articles.allmoxy.com/en/knowledge/import-an-order-from-cabinet-vision-into-allmoxy · https://articles.allmoxy.com/import-data-into-allmoxy · https://articles.allmoxy.com/how-do-you-set-up-excel-columns-for-exporting-files · https://articles.allmoxy.com/configuring-export-files-for-nesting-software · https://articles.allmoxy.com/product-configuration · https://articles.allmoxy.com/allmoxy-integrations · https://articles.allmoxy.com/automation-in-allmoxy · https://articles.allmoxy.com/knowledge/pricing-overview-custom-cabinets · https://articles.allmoxy.com/knowledge/can-i-import-orders-right-into-allmoxy
- Design & Ordering Guide (PDF): https://canary.allmoxy.com/data/partlists/Design%20and%20Ordering%20Guide%20Revised%201-20-25.pdf
- קהילה: https://community.allmoxy.com/topic/228-subscription-products/
- הקשר‑פנימי: `D:\Soline\docs\ORDX_SPEC_FROM_WEB.md` · `converter/src/export_ordx.js` · `converter/src/export_ord.js`

*עובדות (פורמטים, שמות‑שדות, אינטגרציות) תומללו מהמקורות לעיל. לא שוכפל קוד או חומר מוגן.*
