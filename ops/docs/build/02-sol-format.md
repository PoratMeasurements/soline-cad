# מימוש פורמט ‎.sol‎ — מסמך-תכנון לבנייה

> ציר-תכנון 02 · גרסה 1.0 · 2026-08-16 · עברית, לשון זכר · נכתב עבור Michael, Soline.
>
> **מעמד המסמך:** `SOL_FORMAT.md` הוא מסמך-האב הארכיטקטוני — הוא מגדיר *מה* ‎.sol‎ צריך להיות ו*למה*
> (8 שכבות, קונטיינר ZIP, פורמט סגור-ומוצפן קשור-רישיון). **המסמך הזה הוא תוכנית-הבנייה הקונקרטית:**
> איך בפועל מממשים את ‎.sol‎ *מעל הבסיס הקיים* — סכמה קונקרטית ל-v1, מיגרציה מה-Room-JSON של CVSM,
> ארכיטקטורת-הצפנה עם ניהול-מפתחות מעשי, מתי ואיך נכתב הקובץ ב-native בסיום/סנכרון, ויחס לייצוא ORDX.
>
> **מקורות שעליהם הוא מעוגן:** `SOL_FORMAT.md` (הארכיטקטורה), `MEASURE_APP_ANALYSIS.md` (מודל-הנתונים
> המאומת חי של CVSM — טבלת `projects` יחידה, גאומטריה כ-JSON בעמודת `rooms`), `MEASURE_REBUILD_PLAN.md`
> (ההכרעה: **מתאימים את CVSM ב-Kotlin/Compose/Room — לא משכתבים ל-web**), `ORDX_BRIDGE.md` (ORDX הוא
> lossy → ייצוא-בלבד), ו-`samples/measure_project_sample.json` (דגימת-אמת שממנה נגזרת הסכמה).

---

## 0. תקציר מנהלים

הבסיס הקיים (CVSM) שומר כל פרויקט כשורה יחידה בטבלת `projects` של Room, כשכל הגאומטריה דחוסה כ-**JSON
בעמודת `rooms`**. זה עובד מצוין כ-working store offline, אבל אינו קונטיינר-מחזור-חיים: אין שכבות, אין
גרסאות חתומות, אין הצפנה, אין הפרדת תכנון↔נמדד, והוא נעול לתוך סכמת-ה-Room של bravh.

**עקרון-המימוש המרכזי של המסמך:** *לא* מחליפים את Room. **Room נשאר ה-working store החי; ‎.sol‎ הוא
artifact ממומש (materialized) שנכתב מתוך מודל-ה-Room בנקודות-מפתח** (סיום-מדידה, סנכרון, ייצוא). כך
מקבלים את כל ערכי ‎.sol‎ (שכבות, גרסאות, הצפנה, נשיאות) **בלי לגעת ב-70% הקשה שכבר עובד** — סטאק ה-BLE,
ה-offline-first, ופותר-הצורה. ‎.sol‎ מתווסף כשכבת-פרסיסטנטיות-וחילוף מעל, לא כמנתח-לב.

**מה מספק המסמך:** (1) סכמת-v1 קונקרטית — תת-קבוצה מינימלית-שמישה של 8 השכבות; (2) מיפוי-מיגרציה שדה-בשדה
מ-Room→‎.sol‎, כולל `SolWriter`/`SolReader` ו-backfill; (3) ארכיטקטורת-הצפנה מעשית (envelope + Tink +
Android Keystore + license-lease ל-offline); (4) זרימת-הכתיבה ב-native (triggers + revisions + round-trip);
(5) יחס ORDX (ייצוא-בלבד + הטמעת-מקור); (6) תוכנית מדורגת M0→M4.

**עקרון-הזהב לכל המימוש:** *lossless מ-Room אל ‎.sol‎.* ‎.sol‎ הוא ה-HUB — הוא חייב להכיל **כל** שדה
שה-Room לוכד (כולל `cabinets`, גרף-החיבורים, `HeightBands`, `depth`), אחרת חוזרים לבעיית-ה-lossy של ORDX.

---

## 1. ניתוח נקודת-הפתיחה — מה יש היום, ומה חסר

### 1.1 המצב הקיים (מאומת חי, `MEASURE_APP_ANALYSIS.md`)

- **אחסון:** Room ב-WAL, בנתיב חיצוני `files/CVSM_Projects/room_measure_database`.
- **סכמה:** טבלה אחת — `projects`. מטא + לקוח (סגנון Cabinet Vision) + `documents`, וכל הגאומטריה כ-**JSON
  יחיד בעמודת `rooms`**: `rooms[] → {originPoints[], scanPoints[], walls[]}`, וכל `wall` נושא
  `accessories[]` + `cabinets[]`.
- **המודל עשיר:** הקיר כולל גרף-חיבורים (`startConnectedWallId`/`endConnectedWallId`), `wallTopStyle`
  (כולל `VAULT_RIGHT`), `elevation`, `soffit`; האביזר כולל `depth` (עומק-בליטה — החפיר מס' 1),
  `face`, `slotX/Y/DX/DY` (חריץ-מזגן). כל אלה **נלכדים כבר היום** ונופלים ב-ORDX.
- **הגשר הקיים:** `exportToOrdx`, `DxfExporter`, `PdfExporter`, `exportProjectAsZip` — כבר קיימים
  ב-`ProjectViewModel`.

### 1.2 הפער אל ‎.sol‎

| ממד | היום ב-Room | נדרש ב-‎.sol‎ |
|---|---|---|
| מבנה | JSON שטוח יחיד בעמודה | שכבות (`manifest`/`meta`/`measured`/…) ניתנות-לטעינה-נפרדת |
| הפרדת תכנון↔נמדד | אין (הכל "נמדד") | `design/` מול `measured/` מול `fit/` |
| גרסאות | `modifiedAt` בלבד | `revisions/history.json` (append-only) + snapshots + DR1/DR2 |
| אבטחה | קובץ-DB גלוי במכשיר | הצפנה פר-שכבה + קשירת-רישיון + tamper-evidence |
| נשיאוּת (portability) | קשור למכשיר/למסד | קובץ יחיד נייד עם `manifest` |
| בעלות | משתמע | `meta/project.json.ownership` מפורש |

### 1.3 המסקנה שמכתיבה את הארכיטקטורה

הפער אינו במידע — **המידע כבר קיים ב-Room.** הפער הוא ב**אריזה, בשכבות, בגרסאות ובאבטחה.** לכן ‎.sol‎
אינו סכמת-אחסון חדשה שמחליפה את Room — הוא **פורמט-סריאליזציה-וחילוף** שנכתב *מתוך* Room. זו ההחלטה
היחידה שמונעת שכתוב-סרק של ה-working store הבשל.

---

## 2. עקרון-העל של המימוש — Room כ-working store, ‎.sol‎ כ-artifact

```
   ┌───────────────────────────┐        materialize (SolWriter)
   │   Room DB (working store)  │ ───────────────────────────────▶  project.sol
   │   projects.rooms = JSON    │ ◀───────────────────────────────  (ZIP מוצפן)
   └───────────────────────────┘        hydrate  (SolReader)
        ▲  כל עריכה חיה כאן                     ▲
        │  (offline-first, ללא שינוי)           │  נכתב/נקרא רק ב-4 נקודות:
   מודד עורך בשטח                        finish · sync · export · restore
```

**כללי-הברזל:**
1. **מקור-האמת בזמן-עריכה = Room.** אין שינוי ב-offline-first, ב-autosave או ב-undo-stack הקיימים.
2. **‎.sol‎ נכתב רק בנקודות-מפתח מוגדרות** (§6) — לא בכל keystroke. זה מונע עלות-כתיבה מתמדת של ZIP+הצפנה.
3. **‎.sol‎ הוא מקור-האמת בזמן-חילוף** — מה שעולה לשרת, נשלח, או נפתח במכשיר אחר, הוא תמיד ‎.sol‎, לא ה-Room-DB.
4. **round-trip מובטח:** `Room → SolWriter → .sol → SolReader → Room` חייב להחזיר מודל זהה (בדיקת-CI, §8).

> **למה לא להחליף את Room ב-‎.sol‎ ישירות?** כי ‎.sol‎ הוא ZIP מוצפן — יקר לעדכון-נקודתי בזמן-עריכה, לא
> ניתן-לשאילתה, ומסכן את ה-autosave/undo הבשלים. Room נותן טרנזקציות ועדכון-נקודתי; ‎.sol‎ נותן שכבות,
> גרסאות והצפנה. כל אחד במקום שהוא חזק בו. (זה עולה בקנה-אחד עם §7.6 ב-`SOL_FORMAT.md` — SQLite כאחסון
> פנימי, ZIP+JSON כפורמט-חילוף.)

---

## 3. הסכמה הקונקרטית ל-v1

### 3.1 עקרון-הסקופ: מינימום-שמיש, לא 8 השכבות בבת-אחת

‎.sol‎ המלא הוא 8 שכבות. **v1 לא מממש את כולן** — הוא מממש בדיוק את מה שה-Room כבר לוכד + התשתית לגרסאות.
`design/`, `fit/`, `bom/`, `3d/` נשארים אופציונליים (`manifest.layers[].present:false`) ומתמלאים בשלבים
מאוחרים (המנוע R1–R10, תוכנת-העיצוב). זה אפשרי כי הסכמה **forward-compatible** מלכתחילה (`SOL_FORMAT.md` §4).

**שכבות v1 (ליבה):** `manifest.json` · `meta/` · `measured/` · `annotations/` · `revisions/`.
**שכבות אופציונליות מיום-1 (מבנה מוגדר, `present:false`):** `design/` · `fit/` · `catalog/` · `bom/` · `3d/`.

### 3.2 מבנה הקונטיינר ל-v1

```
project.sol  (ZIP; ב-v1b עטוף במעטפת-הצפנה — §5.4)
├─ manifest.json
├─ meta/
│  ├─ project.json          ← מטא + לקוח + ShipTo + ownership (ממופה מטבלת projects)
│  └─ signature.json        ← v2 (§5.5); ב-v1 רק sha256 פר-שכבה ב-manifest
├─ measured/
│  ├─ rooms.json            ← חדרים: originPoints, scanFloorLevel, defaultHeight
│  ├─ walls.json            ← קירות as-built (כל שדות ה-Room, כולל גרף-החיבורים)
│  ├─ accessories.json      ← אביזרים/תשתית (depth, face, slot*)
│  ├─ cabinets.json         ← ארונות (ריק היום — אך השכבה קיימת, כי ORDX מאבד אותה)
│  └─ source.ordx           ← ORDX שנוצר, משומר as-is (provenance; §7)
├─ annotations/
│  ├─ notes.json            ← הערות-שדה + fieldNotes
│  └─ photos/               ← צילומים (מ-PhotoManager), ממוקמים
└─ revisions/
   └─ history.json          ← יומן append-only (ממופה מ-history[] של DATA_MODEL)
```

**החלטת-Magic:** ב-v1 (לא-מוצפן) — ZIP נקי ש-`manifest.json` הוא הרשומה-הראשונה בו ונושא `"magic":"SOL1"`.
ב-v1b (מוצפן) — המעטפת החיצונית (§5.4) פותחת ב-header-plaintext קטן עם 4 בייטי `S O L 1`, כי ה-ZIP-הפנימי
כבר מוצפן ואינו נראה כ-ZIP. כך זיהוי-הקובץ עובד בשני המצבים.

### 3.3 `manifest.json`

```json
{
  "format": "soline-project",
  "magic": "SOL1",
  "schemaVersion": "1.0.0",
  "minReaderVersion": "1.0.0",
  "projectId": "f104f0a9-6704-48d5-9a51-3c29e68657a2",
  "code": "2026-0142",
  "producer": "Soline Measure 1.0.0 (from CVSM base)",
  "units": "mm",
  "coordinateSystem": { "yAxis": "up", "origin": "world", "handedness": "right" },
  "createdAt": "2026-08-16T09:20:00Z",
  "updatedAt": "2026-08-16T14:05:00Z",
  "currentRevision": "DR1",
  "encryption": { "scheme": "none" },
  "layers": {
    "meta":        { "present": true,  "entry": "meta/",        "sha256": "…" },
    "measured":    { "present": true,  "entry": "measured/",    "sha256": "…" },
    "annotations": { "present": true,  "entry": "annotations/", "sha256": "…" },
    "revisions":   { "present": true,  "entry": "revisions/",   "sha256": "…" },
    "design":      { "present": false, "entry": "design/",      "sha256": null },
    "fit":         { "present": false, "entry": "fit/",         "sha256": null },
    "catalog":     { "present": false, "entry": "catalog/",     "sha256": null },
    "bom":         { "present": false, "entry": "bom/",         "sha256": null },
    "3d":          { "present": false, "entry": "3d/",          "sha256": null }
  },
  "extensions": {}
}
```

- `projectId` = **אותו UUID של `projects.id` בטבלת-Room** (§4.3 — יציבות-מזהים).
- `sha256` פר-שכבה — checksum גם ל-tamper-evidence וגם ל-**סנכרון-דלתאי** (מעלים רק שכבות ש-hash-ן השתנה, §6.4).
- `encryption.scheme` — `"none"` ב-v1a, `"envelope-aesgcm"` ב-v1b (§5.4).

### 3.4 `measured/walls.json` — מיפוי-ישיר מה-Room (lossless)

הקיר ב-‎.sol‎ v1 הוא **העתק-נאמן של ה-`wall` ב-Room** (מה-sample), בלי איבוד שדה. אין נרמול-מוקדם — ‎.sol‎
שומר את מלוא-האמת; נורמליזציה לצורות-תצוגה נעשית בקריאה.

```json
{
  "id": "319306c6-1d82-405c-8040-e465cfa215b1",
  "designRef": null,
  "start": { "x": 1943.023, "y": -2229.604 },
  "end":   { "x": 1939.878, "y": 3477.956 },
  "length_mm": 5707.5605,
  "thickness_mm": 100,
  "height_mm": 2526.7,
  "soffit_mm": 0,
  "elevation_mm": 0,
  "wallType": "STANDARD",
  "wallEndStyle": "NO",
  "wallTopStyle": "STANDARD",
  "vaultHeight_mm": null,
  "isArcWall": false,
  "hatchPattern": "solid",
  "studSpacing_mm": 406.4,
  "connect": {
    "toNext": true, "toPrevious": true,
    "startConnectedWallId": "9f10e2f3-4d2b-4338-be17-043e829fa4ed",
    "endConnectedWallId":   "33f7d5e1-e42a-44f6-9b8e-664d554d966f",
    "maxConnectionDistance_mm": 2000
  },
  "heightManuallyEdited": false,
  "soffitManuallyEdited": false,
  "photos": [],
  "accessoryIds": ["f6f33629-…", "42edca88-…"],
  "cabinetIds": []
}
```

> שים לב ל-`designRef: null` ול-`heightBands` (יתווסף כשה-Room יחשוף `HeightBands`) — שדות שמורים כבר עכשיו
> כדי שהשכבות `design/`+`fit/` העתידיות יתחברו בלי שינוי-שובר. עדיף לשמור-מראש שדה-ריק מאשר MAJOR-migration.

### 3.5 `measured/accessories.json` — האביזר (עם עומק-בליטה)

```json
{
  "id": "f6f33629-2e0e-4a7b-aa1d-3265abf8a38f",
  "wallId": "319306c6-…",
  "name": "Single Socket",
  "type": "SOCKET_SINGLE",
  "face": "FRONT",
  "dimensions_mm": { "W": 85, "H": 77, "depth": 6.8 },
  "placement": { "fromLeft": 4453, "fromRight": 1169.5605, "fromBottom": 1221 },
  "widthInputMode": "WIDTH_POSITION",
  "slot": null,
  "status": "existing",
  "description": ""
}
```

- **`depth`** נשמר תמיד (החפיר מס' 1 — R4). ל-`Ceiling Drop AC` מ-ה-sample נשמר גם `slot:{x,y,dx,dy}`.
- **`status`** — שדה חדש שה-Room עדיין לא מחזיק (`existing/new/cancelled/move/prep/future`). ב-v1 ברירת-מחדל
  `"existing"`; מתמלא אמיתית כשה-Room-model של Soline Measure יוסיף אותו (החוסר-הקריטי מ-`ORDX_BRIDGE.md` §4).

### 3.6 `meta/project.json`

מיפוי-ישיר מעמודות טבלת-`projects` (הלקוח בסגנון Cabinet Vision → כמו-שהוא):

```json
{
  "projectId": "f104f0a9-…",
  "code": "2026-0142",
  "name": "ניסיון",
  "description": "",
  "createdAt": 1786890223281,
  "modifiedAt": 1786892571305,
  "customer": { "name": "…", "address1": "…", "city": "…", "email": "…", "phone": "…", "…": "…" },
  "shipTo":   { "name": "…", "…": "…" },
  "ownership": { "owner": "carpenter:<id>", "tenant": "soline", "license": "<licenseId>" },
  "documents": []
}
```

---

## 4. מיגרציה מה-Room-JSON אל ‎.sol‎

### 4.1 עיקרון: אין מיגרציה הרסנית

ה-Room נשאר. **אין "המרה חד-פעמית שמוחקת את הישן".** במקום זאת:
- **`SolWriter`** — רכיב Kotlin שממיר מודל-Room חי → ‎.sol‎ (materialize).
- **`SolReader`** — הכיוון ההפוך: ‎.sol‎ → מודל-Room (hydrate), לפתיחת קובץ ממכשיר אחר / שחזור.
- **Backfill עצל** — פרויקטים קיימים לא מומרים בבת-אחת; כל פרויקט מקבל ‎.sol‎ בפעם-הראשונה שהוא נשמר-בסיום
  או מסונכרן. אין big-bang, אין סיכון-נתונים.

### 4.2 מיפוי שדה-בשדה (Room → ‎.sol‎)

| מקור ב-Room | → | יעד ב-‎.sol‎ |
|---|---|---|
| `projects.id` | → | `manifest.projectId` + `meta/project.json.projectId` |
| `projects.name/description/createdAt/modifiedAt/documents` | → | `meta/project.json.*` |
| `customer*` (12 שדות) + `shipTo*` (12) | → | `meta/project.json.customer` / `.shipTo` |
| `rooms[]` (JSON) → room{originPoints,scanFloorLevel,defaultHeight,defaultSoffit} | → | `measured/rooms.json` |
| room.walls[] | → | `measured/walls.json` (מבנה §3.4) |
| wall.accessories[] (משוטח לרשימה שטוחה עם `wallId`) | → | `measured/accessories.json` |
| wall.cabinets[] (משוטח) | → | `measured/cabinets.json` |
| wall.photos[] / accessory refs | → | `annotations/photos/` + הפניות |
| — (חדש) | → | `revisions/history.json` (רשומת-genesis בעת ה-materialize הראשון) |

**ההבדל המבני היחיד:** ה-Room מקנן `accessories`/`cabinets` *בתוך* כל `wall`; ‎.sol‎ משטח אותם לרשימות
נפרדות עם `wallId` (כמו טבלאות מנורמלות). זה מקל על טעינה-חלקית ועל השכבה `fit/` העתידית שמצביעה לאובייקטים
בודדים. ה-`SolReader` מבצע re-nest חזרה ל-Room. round-trip נשמר.

### 4.3 יציבות-מזהים — ההחלטה שמונעת כאב עתידי

**מאמצים כבר עכשיו את ה-UUIDs הקיימים** של ה-Room (`wall.id`, `accessory.id`, `project.id`) כ-**מזהי-‎.sol‎
היציבים**, למרות ש-`design/`+`fit/` עדיין לא קיימים. הסיבה: כש-`fit/deltas.json` יופיע, הוא יצביע לאובייקטים
לפי `id` (`subjects:[...#id]`) ו-`designRef` יהיה ה-join-key בין תכנון לנמדד. אם נמציא מזהים חדשים ב-‎.sol‎
בעתיד — נצטרך remap-כואב. עדיף לקבע עכשיו. (עלות אפסית, מונע MAJOR-migration.)

### 4.4 מימוש `SolWriter`/`SolReader` (Kotlin)

- **מיקום:** מודול חדש `sol/` באפליקציית Soline Measure, ליד `export/` הקיים. אינו נוגע ב-`data/AppDatabase`.
- **סריאליזציה:** `kotlinx.serialization` (JSON) → כתיבת entries ל-ZIP דרך `java.util.zip.ZipOutputStream`
  (או `okio`). כל שכבה = תיקייה ב-ZIP; חישוב `sha256` פר-שכבה תוך-כדי-כתיבה למילוי ה-manifest.
- **אימות:** `SolValidator` מריץ JSON-Schema פר-שכבה (schemas מוטמעות במשאבי-האפליקציה) לפני חתימה/העלאה.
- **אריזה לתוך הזרימה הקיימת:** `exportProjectAsZip` הקיים הוא נקודת-ההשקה הטבעית — מוסיפים לצידו
  `exportProjectAsSol(projectId)` ב-`ProjectViewModel`.

---

## 5. הצפנה ואבטחה

הדרישה (`SOL_FORMAT.md` §2.3/§6.3): **קובץ ‎.sol‎ שהועתק מחוץ ל-Soline הוא blob אטום וחסר-ערך.** מפתחות
לעולם לא נשמרים בתוך הקובץ; הפענוח קשור-רישיון. יש ליישב זאת עם **offline-first אמיתי** — המודד עובד בשטח
בלי רשת. הפתרון: **envelope encryption + license-lease**.

### 5.1 ספריית-הקריפטו

**Google Tink** (ולא JCA ידני). סיבות: AEAD מוכן (AES-256-GCM), ניהול-מפתחות בטוח, keyset-handles,
תמיכה מובנית ב-Android Keystore. הימנעות מ-crypto ידני = הימנעות מבאגים-קטלניים (nonce-reuse וכו').

### 5.2 מודל-המפתחות (שלוש-שכבות)

```
Soline Auth/KMS (שרת)
   │  Tenant Master Key (TMK) — לעולם לא עוזב את השרת
   ▼
Project KEK  (per-project key-encryption-key)
   │  נמסר למכשיר עטוף (wrapped) בעת אקטיבציית-רישיון
   ▼
DEK  (per-layer data-encryption-key, AES-256-GCM)
   │  מוגרל מקומית לכל שכבה; עטוף ב-KEK ונשמר ב-manifest המוצפן
   ▼
תוכן-השכבה (ciphertext + nonce + tag)
```

- **פר-שכבה DEK** → מאפשר שיתוף-חלקי: אפשר למסור ‎.sol‎ לספק-CNC כש-`bom/` נגיש אך `meta`/`annotations`
  מוצפנים במפתח שאין לו (`SOL_FORMAT.md` §6.2).
- **ה-KEK אף פעם לא מגיע בטקסט-גלוי למכשיר** — הוא מגיע עטוף ב-**Device Key** שיושב ב-Android Keystore
  (StrongBox אם קיים). כך גם אם מישהו מעתיק את קבצי-האפליקציה, ה-KEK לא ניתן-לחילוץ בלי המכשיר עצמו.

### 5.3 offline — license-lease

הבעיה: המודד בשטח בלי רשת חייב לפתוח/לכתוב ‎.sol‎.
הפתרון:
1. **אקטיבציה מקוונת (חד-פעמית/תקופתית):** בהתחברות, שרת-Soline מוסר **חוזה-רישיון חתום** + ה-KEK-העטוף
   + **TTL (lease)** — למשל 14–30 יום.
2. **עבודה offline בתוך ה-lease:** כל עוד ה-lease בתוקף, המכשיר פותח/כותב ‎.sol‎ מקומית (ה-KEK זמין
   מקומית, עטוף ב-Keystore). זה מכבד את ה-offline-first הבלתי-ניתן-לוויתור.
3. **פקיעת lease:** אחרי ה-TTL, נדרשת re-אקטיבציה מקוונת. קובץ שלא-אומת-מעולם באותו מכשיר לא ייפתח כלל.

> זה מיישב את המתח בין "אין פתיחה offline של קובץ לא-מאומת" (§6.3) לבין offline-first: **מכשיר-מורשה עובד
> offline; קובץ-גנוב על מכשיר-לא-מורשה — אטום.**

### 5.4 המעטפת (v1b)

```
project.sol (מוצפן)
├─ [plaintext header]   magic "SOL1" · formatVersion · encScheme · wrappedKeyMeta (keyId, TTL, tenant)
└─ [ciphertext]         AES-256-GCM( ZIP{ manifest + כל השכבות } )   ← ה-ZIP כולו מוצפן כיחידה
```

חלופה שקולה (ומועדפת לשיתוף-חלקי): לא-מצפינים את ה-ZIP-כולו, אלא **כל entry-שכבה בנפרד**, וה-`manifest.json`
(שמכיל את מפת-ה-DEKs העטופים) הוא ה-entry היחיד שמוצפן ב-KEK. **הכרעה:** v1b מתחיל ב-**הצפנת-ה-ZIP-כולו**
(פשוט, מספיק להגנת-IP), ומעבר ל-הצפנה-פר-entry נדחה ל-v2 כשיתוף-חלקי עם CNC יהפוך רלוונטי.

### 5.5 tamper-evidence וחתימה

- **v1:** `sha256` פר-שכבה ב-`manifest`. שינוי-שכבה משבש hash → מזוהה. זול, מיידי.
- **v2:** `meta/signature.json` — חתימת **Ed25519** על ה-manifest (שכולל את כל ה-hashes). הופך תכנית-מדידה
  למסמך-אחריות משפטי חתום עם timestamp וחותם (`SOL_FORMAT.md` §6.1). חתימת-שלב בכל מעבר `measured→delivered`.

### 5.6 הצפנה-בשלבים (החלטה תפעולית)

**v1a נכתב לא-מוצפן** (ZIP+JSON גלוי) — כדי לאמת מהר מיגרציה, סכמה ו-round-trip בלי מורכבות-קריפטו.
**הצפנה (v1b) חובה לפני שקובץ ‎.sol‎ עוזב את המכשיר** (סנכרון/שיתוף/שרת). קובץ מקומי-בלבד יכול להישאר
לא-מוצפן בשלב-הפיתוח, אך בפרודקשן — גם at-rest מקומי מוצפן (Keystore) כדי לממש "מועתק = חסר-ערך".

---

## 6. כתיבה native — מתי ואיך נכתב ‎.sol‎

### 6.1 ארבע נקודות-הכתיבה (triggers)

| # | trigger | מה נכתב | רוויזיה |
|---|---|---|---|
| 1 | **סיום-מדידה** (`in_field → measured`) | ‎.sol‎ מלא, snapshot-חתום | **DR1** |
| 2 | **סנכרון** (WorkManager, כשיש רשת) | שכבות ש-hash-ן השתנה בלבד (§6.4) | — |
| 3 | **ייצוא/שיתוף מפורש** (המשתמש בוחר "ייצא ‎.sol‎") | ‎.sol‎ מלא | — |
| 4 | **מעבר-שלב מהותי** (`review → delivered`) | snapshot-חתום | **DR2** |

**לא כותבים ‎.sol‎ בכל עריכה** — רק בנקודות אלה. בין לבין, כל העבודה ב-Room (autosave קיים).

### 6.2 זרימת ה-materialize (בסיום/ייצוא)

```
1. ProjectViewModel.finishMeasurement(projectId)
2. → קורא את מודל-ה-Room המלא (projects row + rooms JSON)
3. → SolWriter.build(model):
      - meta/project.json, measured/{rooms,walls,accessories,cabinets}.json, annotations/*
      - append revisions/history.json  (רשומה: {rev:"DR1", at, by, stage})
      - חישוב sha256 פר-שכבה → מילוי manifest.layers
4. → SolValidator.validate()          (JSON-Schema פר-שכבה)
5. → (v1b) SolCrypto.seal(zip, KEK)    (envelope §5.4)
6. → (v2)  SolSigner.sign(manifest)    (Ed25519)
7. → כתיבה אטומית: temp file → fsync → rename ל-files/CVSM_Projects/<projectId>.sol
8. → עדכון projects.solPath + projects.stage; רישום ב-outbox לסנכרון
```

**כתיבה אטומית** (temp→rename) חיונית: אם האפליקציה מתה באמצע-כתיבה בשטח, ה-‎.sol‎ הישן נשאר שלם.

### 6.3 hydrate (פתיחת ‎.sol‎ / שחזור / ממכשיר אחר)

```
SolReader.open(path) → (unseal אם מוצפן) → validate → parse layers →
   re-nest accessories/cabinets לתוך walls → upsert לטבלת projects (לפי projectId)
```

- **מיזוג פר-id** (`SOL_FORMAT.md` §7.3): אם ה-`projectId` כבר קיים מקומית, ממזגים פר-`id` של אובייקט
  לפי `updatedAt` (last-writer-wins), לא דורסים את כל הפרויקט. זה חיוני לסנכרון דו-מכשירי.

### 6.4 סנכרון — יחידת-ההעלאה

- **v1:** העלאת-קובץ-שלם, אך **דילוג-שכבות לפי hash** — משווים `manifest.layers[].sha256` מול השרת, מעלים
  רק שכבות שהשתנו. זול, פשוט, מספיק.
- **v2:** `revisions/history.json` (append-only) הוא ה-oplog → סנכרון-דלתאי אמיתי (מעלים רק רשומות-חדשות).
- מתלבש על `INTERFACE.md`: חבילת `job-<code>/` הופכת ל-‎.sol‎ יחיד; `job.json` → `meta/project.json`;
  `result.json` של הממיר → שכבת `bom/`/תוצרים בתוך אותו ‎.sol‎.

---

## 7. יחס ל-ORDX — ייצוא-בלבד + הטמעת-מקור

**ORDX חדל להיות פורמט-חילוף-מרכזי.** לפי `ORDX_BRIDGE.md`, ORDX הוא lossy (מאבד `cabinets`, גרף-חיבורים,
`status`, קשת, `slot`). לכן:

1. **‎.sol‎ הוא ה-HUB; ORDX הוא יעד-ייצוא בלבד.** אין ייבוא-ORDX כמקור-אמת (רק כ-legacy/תאימות דרך `SolReader`
   שיודע לקרוא ORDX ישן לתוך `measured/`).
2. **הטמעת-מקור:** בכל materialize ששייצר ORDX (למשל בדרך לממיר), ה-ORDX נשמר as-is ב-`measured/source.ordx`
   — provenance, לא מקור-אמת. המקור-האמין הוא שכבות-ה-JSON של ‎.sol‎.
3. **מנוע-הייצוא הקיים נשאר:** `exportToOrdx`/`export_ordx.js` ממשיכים לעבוד — אך ניזונים מ-‎.sol‎, לא מ-ORDX.
4. **בלוק `<Ext xmlns:sol>` בייצוא-ORDX** (`ORDX_BRIDGE.md` §4.1): כשמייצאים ל-ORDX לצריכת-הממיר, מוסיפים
   את השדות ש-InnoDraw לא מכיר (`status`, גרף-חיבורים, `slot`, `wallTopStyle` LEFT/RIGHT) ב-`<Ext>`, כדי
   שהממיר לא יאבד מידע קריטי. זה **הופך את ORDX-הייצוא ל-lossless** לצריכה-פנימית, בלי לשבור את InnoDraw.
5. **lossless-gate ב-CI:** בדיקה אוטומטית `Room → .sol → ORDX(+Ext)` שמכשילה על כל שדה שנשמט בלי מיפוי מפורש.

> **התובנה:** ‎.sol‎ *מכיל* את ORDX (ואת DXF/PDP/glTF), לא מתחרה בו. הממיר הקיים הופך ממתרגם-בין-פורמטים
> ל**מנוע-ייצוא מתוך ‎.sol‎.**

---

## 8. תוכנית מימוש מדורגת

| שלב | תוכן | תוצר-מדיד |
|---|---|---|
| **M0 — סכמה + חוזה** | קיבוע schemaVersion 1.0.0; JSON-Schema לכל שכבת-v1; החלטת יציבות-מזהים (§4.3) | schemas + מסמך-חוזה |
| **M1 — SolWriter (v1a, גלוי)** | materialize מ-Room → ‎.sol‎ לא-מוצפן; `exportProjectAsSol`; כתיבה-אטומית | ‎.sol‎ תקין נכתב מפרויקט-אמת (ה-sample) |
| **M2 — SolReader + round-trip** | hydrate ‎.sol‎ → Room; מיזוג פר-id; **בדיקת round-trip ב-CI** | `Room→.sol→Room` זהה |
| **M3 — הצפנה (v1b)** | Tink AEAD; envelope §5.4; Device-Key ב-Keystore; license-lease + אקטיבציה | ‎.sol‎ מוצפן; קובץ-מועתק אטום |
| **M4 — סנכרון + ORDX-ייצוא** | דילוג-שכבות-לפי-hash; outbox; ייצוא-ORDX-מ-‎.sol‎ עם `<Ext>`; lossless-gate | סנכרון עובד; ORDX lossless לצריכה-פנימית |
| **(עתיד) M5+** | חתימת Ed25519 (מסמך-אחריות); שכבות `design`/`fit` (R1–R10); שיתוף-חלקי (הצפנה-פר-entry); oplog-דלתאי | — |

**סדר-התלות הקריטי:** M0→M1→M2 חייבים לקדום את M3 (אין טעם להצפין לפני שהמיגרציה ו-round-trip מוכחים).
M3 תלוי בשרת-רישוי אמיתי — היום הרישוי הוא קבצים ב-GitHub של bravh (`MEASURE_APP_ANALYSIS.md`), מנגנון-חלש
שממילא מתוכנן להחלפה; **הצפנת-‎.sol‎ ושרת-הרישוי הם אותו פרויקט-תשתית.**

---

## 9. סיכום ההחלטות (לאישור Michael)

1. **Room כ-working store; ‎.sol‎ כ-artifact ממומש** — לא מחליפים את Room. נכתב ב-4 נקודות בלבד.
2. **סכמת-v1 מינימלית** — `manifest`+`meta`+`measured`+`annotations`+`revisions`; השאר `present:false`.
3. **lossless מ-Room** — ‎.sol‎ שומר כל שדה (כולל `cabinets`, גרף-חיבורים, `depth`, `slot`) — לא lossy כמו ORDX.
4. **מיגרציה עצלה, לא הרסנית** — `SolWriter`/`SolReader` + backfill; אין big-bang.
5. **יציבות-מזהים מיום-1** — אימוץ UUIDs קיימים כמזהי-‎.sol‎; מונע MAJOR-migration עתידי.
6. **הצפנה = envelope + Tink + Keystore + license-lease** — offline-first נשמר; קובץ-מועתק אטום.
7. **הצפנה-בשלבים** — v1a גלוי (מוכיח מיגרציה), v1b מוצפן לפני שהקובץ עוזב את המכשיר.
8. **ORDX = ייצוא-בלבד** — ‎.sol‎ הוא ה-HUB; ORDX-ייצוא עם `<Ext>` הופך lossless לצריכה-פנימית; source.ordx כ-provenance.
9. **הצפנת-‎.sol‎ ושרת-הרישוי = פרויקט-תשתית אחד** — מחליף את רישוי-ה-GitHub של bravh.

---

## 10. סיכונים ונקודות-פתוחות

- **תלות בשרת-רישוי:** הצפנה קשורת-רישיון מחייבת שרת-Soline אמין. עד שהוא קיים — נשארים ב-v1a גלוי. **סיכון:
  לוח-זמנים** אם השרת מתעכב.
- **פקיעת-lease בשטח:** אם מודד עובד יותר מ-TTL בלי רשת → נעילה. יש לכייל TTL לתרחיש-השטח האמיתי (14–30 יום),
  ולהתריע מראש על פקיעה-מתקרבת.
- **עלות-כתיבה:** ZIP+הצפנה בכל materialize על טאבלט. מוקל ע"י כתיבה רק ב-4 נקודות (לא בכל edit) — אך למדוד
  על פרויקט גדול (עשרות קירות + צילומים).
- **`HeightBands`/`status` עדיין לא ב-Room:** הסכמה שומרת להם מקום, אך המילוי-האמיתי תלוי בהרחבת-המודל של
  Soline Measure (מחוץ לציר-הזה — תלוי ב-`MEASURE_REBUILD_PLAN`).
- **round-trip עם צירים:** ה-Y ב-Room חיובי-מעלה; חלק מהפורמטים (PDP/DXF) הופכים Y. ‎.sol‎ מתעד
  `coordinateSystem` ב-manifest — יש לוודא שה-hydrate/ייצוא מכבדים אותו כדי למנוע bug-צירים חוזר.
