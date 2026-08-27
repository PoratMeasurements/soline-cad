# REPORT_EXPORTS — מייצאי-הדו״ח של Soline (HTML אינטראקטיבי + PDF עברי)

שני מייצאים בצינור-הממיר, שניהם צורכים את מודל-האובייקט הקנוני (תוצר `src/parseOrdx.js` / `src/readSol.js`)
ומרנדרים את מבנה `soline-ops-app/docs/PDF_REPORT_SPEC.md`. **אפס תלויות npm כבדות** (Node core + `elements.json` בלבד).

- `src/export_html.js` → `renderHtml(model, opts) : string` — דו״ח HTML אינטראקטיבי עצמאי (CSS+JS מוטמעים).
- `src/export_pdf.js`  → `renderPdf(model, outPath, opts) : result` — PDF עברי RTL מ-HTML-להדפסה A4, מרונדר בדפדפן-headless שכבר על המכונה.

## renderHtml(model, opts)
מסמך HTML שלם, עצמאי, RTL, צבעי-מותג (כתום #F49A1A, טורקיז #1596A8, שמנת #FBF4E6):
שער · תוכנית-SVG פר-חדר · חזית-SVG פר-קיר · טבלת-מידות · טבלת-אלמנטים · ממצאי R1–R10 · הערות מסוננות-תפקיד + בלוק-מפעל.
אינטראקטיבי: מתגי-שכבות, סעיפים מתקפלים, סינון-הערות.
- `opts.mode` = `'interactive'` (מסך) | `'print'` (A4 page-breaks, מקור-ה-PDF)
- `opts.includeSignatures` = עמוד-אישור
- CLI: `node src/export_html.js <in.sol|in.ordx> [out.html]`

## renderPdf(model, outPath, opts)
בונה HTML-להדפסה דרך `renderHtml(mode:'print')`, כותב `<name>.print.html`, ומרנדר ל-`.pdf` עם Chromium-family
שכבר מותקן (Win10: `msedge.exe` עם ה-OS). עברית shaping+bidi+פונט ע״י הדפדפן. אין דפדפן → נכתב ה-HTML +
`result.command` לרינדור-ידני; לעולם לא זורק.
- `result` = `{ pdfPath, htmlPath, rendered, browser, command, bytes, vector, error? }` (`vector`=מקור-HTML וקטורי)
- CLI: `node src/export_pdf.js <in.sol|in.ordx> [out.pdf] [--sign]`
- פקודת-רינדור ידנית: `"<browser>" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="out.pdf" "file:///…/name.print.html"`

## המודל (parseOrdx-shaped)
`position.x`=fromLeft לאורך-הקיר · `position.y`=fromBottom · `size.depth`=עומק-בליטה.
שדות אופציונליים (`jobNumber/surveyor/measuredAt/status/findings/notes/carpenter/accessNotes`) — `normalizeModel`
קורא שמות-חלופיים; חסר → "—". סטטוס נגזר: BLOCK→דורש-בדיקה, אין קיר-תקין→חסר-פרטים, נקי→הושלם.

## אינטגרציה ל-soline_convert.js (לחווט)
```js
const { renderHtml } = require('./src/export_html');
const { renderPdf }  = require('./src/export_pdf');
fs.writeFileSync(path.join(outDir, name+'_report.html'), renderHtml(model,{mode:'interactive'}));
renderPdf(model, path.join(outDir, name+'.pdf'));
```
כך הפקודה `node soline_convert.js <input> --out <dir>` תפיק **6 פורמטים**: ORDX+PDP+DXF2D+DXF3D+**PDF+HTML**.

## PDF וקטורי אמיתי (PDF→DXF-2D קל)
כל השרטוטים ב-HTML-להדפסה הם **SVG inline** — תוכנית-הרצפה והחזיתות הן `<svg>` עם `<line>`/`<polyline>`/
`<rect>` ו-`<text>` אמיתי (`planSvg`/`elevationSvg` ב-export_html.js). **אין raster**: צופה-התלת-ממד
מבוסס-canvas נפלט ב-`mode:'interactive'` בלבד וחסר לגמרי מ-`mode:'print'`. כשדפדפן Chromium מדפיס SVG ל-PDF
הגאומטריה נכתבת כאופרטורים-וקטוריים של PDF (לא תמונה), כך שה-PDF נפתח עם קווים נקיים/נבחרים והמרה
PDF→DXF-2D הופכת טריוויאלית.
- `export_pdf.js` **מוסיף בראש כל חדר** דף "תכנית וקטורית (לייצוא CAD/DXF)": קירות כ-polyline וקטורי + מהלך-
  הארונות (planning) כמלבנים מתויגים + אורכי-קיר כ-`<text>` — בלי רשת/מקרא/נקודות של הדוח, שכבת-המקור
  האידיאלית ל-trace ל-DXF-2D. נבנה ב-export_pdf.js ומוזרק ל-HTML כ-SVG inline.
- `result.vector===true` מאשר שה-HTML נושא גאומטריית-`<svg>` ואין raster (canvas/img) לשרטוט.

## PLANNING — סכמת ארונות ב-.sol (על האפליקציה לכתוב בדיוק כך)
האפליקציה כותבת את תכנון-הנגרות (מהלך-הארונות) ל-`.sol`; הממיר נושא אותו לכל הפורמטים. מקור-האמת המלא
מתועד ב-`src/readSol.js`. שני מקומות (שניהם אופציונליים; `.sol` של קירות-בלבד — ללא שניהם):
1. **פר-חדר** — מערך `cabinets: [ … ]` בתוך `measured/room-<id>.json` (ליד `walls`).
2. **גלובלי** — `planning/cabinets.json` (או `planning.json`/`cabinets.json`): מערך `[ … ]` או
   `{ cabinets:[ … ], materials:{ … } }`; כל ארון נושא `roomId` התואם ל-`id` של החדר.

רשומת CABINET (כל האורכים במ"מ):
```
{ roomId, wallId, kind, name, fromLeft, width, depth, heightFrom, heightTo, doorType, material? }
```
- `wallId` = אינדקס-הקיר 0-based בחדר (== `wall.idx` == `wall.number` במודל); השמט/-1 לארון חופשי → קיר ראשון.
- `kind` = `"base"` (תחתון) | `"wall"` (עליון) | `"tall"` (עמודה/גובה-מלא).
- `fromLeft` = מרחק לאורך-הקיר מקודקוד-ההתחלה לקצה-השמאלי; `width` לאורך-הקיר; `depth` בליטה לתוך-החדר.
- `heightFrom`/`heightTo` = תחתית/ראש-הקרביץ מעל-הרצפה (base: 0/900; wall: 1450/2150; tall: 0/2100).
- `doorType` = `"hinged"|"drawers"|"sliding"|"none"` (תווית בלבד). `material` = מפתח אופציונלי לתוך `materials`.
- `materials` אופציונלי (גימור פר-משטח) עובר כמות-שהוא ל-`model.materials`.

מיפוי לפורמטים: **ORDX** — כל ארון = `<Furnishing>` עם `Class=Base, Type=Standard, Catalog=InnoDraw` ו-`<Size>`
מקונן (בלי `<Assembly>`). **DXF-2D** — מלבן+תווית בשכבת `Cabinets`. **DXF-3D** — תיבת-קרביץ בשכבת `Cabinets`
עם **צוקל שקוע** (~120מ"מ, נסיגה ~50מ"מ; base+tall) ו**משטח-עבודה** ~920מ"מ (base). **PDF** — דף-תכנית וקטורי.
הערה: ארונות זורמים כשה-`.sol` משתמש בשכבת-החדרים הילידית (room-json). ב-`.sol` עם `measured/source.ordx`
מוטמע, נתיב ה-ORDX המוטמע נטען ישירות ולא דרך שכבת-התכנון (מגבלה מתועדת).
