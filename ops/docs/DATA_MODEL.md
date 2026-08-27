# מודל הנתונים (offline-first, IndexedDB)

מסד נתונים מקומי במכשיר. אין שרת חובה. סנכרון עתידי דרך `outbox`.

## ישויות (object stores)
### clients
```
id, name, phone, address, notes, createdAt
```
### surveyors  (מודדים)
```
id, name, phone, color, active
```
### jobs  (הישות המרכזית)
```
id, code, clientId, address, type,
stage,            ← ראה pipeline למטה
surveyorId,       ← מי משובץ (null עד שיבוץ)
scheduledAt,      ← מתי (null עד שיבוץ)
createdAt, updatedAt,
notes,
history[]         ← [{ stage, at, by }]  יומן מעברים
```
### measurements  (קליטת שטח)
```
id, jobId, capturedAt, surveyorId,
rooms, fieldNotes,
files[],          ← [{ name, kind:'ordx'|'photo', size }]
disto[]           ← [{ label, value_mm }]  (עתידי)
```
### deliverables  (תוצרים ללקוח)
```
id, jobId, kind:'dxf2d'|'dxf3d'|'pdp'|'pdf',
fileName, status:'pending'|'approved'|'sent', at
```

## Pipeline של job.stage
| # | stage | תווית | מודול |
|---|---|---|---|
| 1 | `new` | פתוחה | עבודות |
| 2 | `scheduled` | משובצת | שיבוץ |
| 3 | `in_field` | במדידה | שיבוץ→שטח |
| 4 | `measured` | נמדדה (DR1) | קליטה |
| 5 | `processing` | בעיבוד | ממיר |
| 6 | `review` | בבדיקה (DR2) | מסירה |
| 7 | `delivered` | נמסרה | מסירה |

זרימת DR1→DR2→חתום מ-`../ordx-pdp-converter/docs/field_reconciliation.md` ממופה ל-`measured → review → delivered`.

## עקרונות
- כל כתיבה מעדכנת `updatedAt` ומוסיפה רשומת `history`.
- מזהים: `crypto.randomUUID()`; `code` קריא לאדם (`2026-0142`).
- מחיקה = רכה (`archived:true`), לא הרס נתונים.
