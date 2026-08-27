# ORDX → PDP Converter

כלי להמרת קבצי מדידה **ORDX** (CV ORDX Order XML) לפורמט **PDP** של תוכנת התכנון.
הפרויקט נבנה בשלבים — כרגע מוכן **שלב 1: פרסר ORDX מלא**.

## מצב נוכחי

| שלב | תיאור | מצב |
|---|---|---|
| 1 | פרסר ORDX → מודל מסודר (JSON) | ✅ מוכן |
| 2 | פענוח קידוד PDP הבינארי | ✅ קירות + מידות פוענחו |
| 3 | Writer: ORDX → PDP (חדר בלי אביזרים) | ✅ עובד ואומת ב-Raumplan |
| 4 | תמיכה באביזרים (שקעים/חלונות/דלתות) | ⏳ דורש קורפוס (בעיית 921) |

התוכנה היעד: **Raumplan for Windows IV**. היא משחזרת את ה-mesh התלת-ממדי מהנתונים
הפרמטריים בטעינה — לכן מספיק לכתוב נכון את הקירות, ו-Raumplan בונה את התלת-ממד.

## שימוש

**המרה ORDX → PDP** (חדר בלי אביזרים), עם תבנית חדר ריק שנשמרה מ-Raumplan:
```bash
node convert.js <in.ordx> <empty-template.pdp> [out.pdp]
```
התבנית חייבת להיות **חדר ריק (0 אביזרים)** עם לפחות כמספר הקירות שב-ORDX.
הממיר מזהה אוטומטית את טבלת הקירות (int16/int32) ובוחר את קבוצת הקירות התואמת.

**ניתוח ORDX בלבד:**
```bash
node cli.js <file.ordx>                 # סיכום קריא
node cli.js <file.ordx> --json          # + ייצוא JSON
```

ללא תלויות npm — Node.js בלבד.

## מבנה הקוד

- `src/xml.js` — פרסר XML מינימלי ללא תלויות.
- `src/parseOrdx.js` — ORDX → מודל דומיין נקי.
- `src/walls.js` — זיהוי אוטומטי של טבלת קירות (int16/int32) + כתיבה.
- `src/convertGeneral.js` — המרה: כתיבת קירות לתבנית ריקה (שינוי ערכים בלבד).
- `convert.js` — CLI להמרה.  ·  `cli.js` — CLI לניתוח ORDX.

## מודל הנתונים (פלט הפרסר)

```
{
  format, created, productVersion, unit,
  job: { name, description },
  customer, shipTo,               // פרטי קשר (או null)
  rooms: [
    {
      name, description, type,
      walls: [
        {
          number, description,
          position: { startX, startY, angle, endX, endY },
          style,                                        // Standard | Peninsula | ...
          dimensions: { length, height, soffit, thick, vaultHeight },
          fixtures:    [ placedItem ],                  // שקעים, תשתית חשמל
          furnishings: [ placedItem ]                   // חלונות, מעברים, הנמכות
        }
      ]
    }
  ],
  summary: { rooms, walls, fixtures, furnishings, itemCounts }
}

placedItem = {
  kind,            // 'fixture' | 'furnishing'
  catalog, name, description, class, type,
  size:     { width, height, depth },
  position: { x, y }        // X = לאורך הקיר, Y = גובה
}
```

## מיפוי סמנטי ORDX → PDP (ידוע)

| ORDX | PDP |
|---|---|
| `Wall` (Start/End X,Y, Height, Thick, Soffit) | גאומטריית קירות + טבלת טופולוגיה |
| `Fixture` `שקע בודד` | רשומת MEP `שקע בודד` (SOCKET) |
| `Fixture` `תשתית חשמל` | רשומת חשמל (Electrical) |
| `Furnishing` `חלון` (Window) | `חלון` / FENSTER |
| `Furnishing` `מעבר` (EntryDoor) | `דלת` / DOORWAY_WITH_FRAME |
| `Furnishing` `הנמכת תקרה` | הנמכה / Soffit |

## פענוח הפורמט הבינארי PDP (ממצאים)

מבוסס על זוג תואם `twister-n6+7_Room1` (ORDX + PDP). כל הנתונים הפרמטריים
נשמרים כ-**`int16` little-endian במילימטרים**.

### Header
| offset | תוכן |
|---|---|
| `0x00` | `FF FF FF 7F 44 00 00 00` — magic/גרסה קבוע |
| `0x2e` | שם העבודה (ASCII), למשל `twister-n6+7` |
| `0x94` | שם לקוח (Windows-1255) |
| `0xc4` | טלפון |
| `0x115` | שם משתמש |

### טבלת קירות (מתחילה ~`0xd2`)
רשומות ברוחב **14 בייט**, אחת לכל קיר, בלולאה מחוברת (קירות חולקים קודקודים):
```
int16  flag/id
int16  x1, y1, x2, y2      // מ"מ, בפריים פנימי = ORDX - offset קבוע (טרנסלציה בלבד, בלי סיבוב)
int16  thick               // עובי (100)
int16  height              // גובה (2845)
```
אימות: dx של רשומה = אורך הקיר ב-ORDX (2773 מ"מ ✓).

### רשומות פריטים (Section A, מ-~`0x120`)
כל אביזר/פתח = רשומה עם ספק `אינודרו` (=InnoDraw), סוג בעברית
(`דלת`/`חלון`/`שקע`/`מפסק`/`תאורה`...), ומידות כ-**שלושה int16**: `Width, Depth, Height`.
דוגמה — דלת ב-`0x19f`: 909, 100, 2051 (= `Hinged Left In` 909×100×2051 ✓).

### בלוק גאומטריה 3D
~84% מהקובץ = mesh בינארי (פרימיטיבים גרמניים: QUADER/ZYLINDER/FENSTER/HALBKREIS...).
**שאלת ההכרעה:** האם התוכנה משחזרת אותו מהנתונים הפרמטריים בטעינה, או דורשת אותו קיים?
נבדק ע"י patch של ערך פרמטרי (גובה קיר 2845→2400) וטעינה בתוכנה.

## מה חסר לשלב 2/3

1. תוצאת ניסוי ה-patch (האם template-patch ריאלי).
2. פענוח פריים הקואורדינטות (בחירת origin לכתיבה).
3. אם צריך mesh — פענוח קידוד הגאומטריה התלת-ממדית.
