# 16 · חוזה תוסף ההתקנים והדרייברים — מפרט-קוד (Session 3)

> **סטטוס:** מפרט לבנייה — *Session 3*.
> **כלל-על:** אין מימוש לוגיקה עסקית. חוזי פורט, סכמות payload, ומפרטי דרייבר ל-v1.
> **מדוע עכשיו:** הדרייברים הם מקור ה-`Reading`ים שמזינים את הכל. הם רצים **על-גבי-ההתקן**
> (offline-first, ADR-002) ומייצרים את שרשרת המקור (provenance) שליבת האימות ([13](13-Validation-Core-Spec.md))
> נשענת עליה. מעמיק את [מסמך 03](03-Device-Plugin-Architecture.md).
> **תלות פתוחה:** פרטי ה-SDK/BLE המדויקים לכל התקן הם Q4 (מסלול Gemini). החוזה כאן רחב במכוון
> כדי לספוג את תוצאת המחקר; שדות תלויי-SDK מסומנים `// SDK-TBD`.

---

## 1. הפורט (גבול hexagonal)

הדומיין מדבר רק עם הפורטים הללו; לעולם אינו מייבא SDK של יצרן.

```ts
interface MeasurementDriver {
  descriptor(): DeviceDescriptor;
  supports(cap: Capability): boolean;
  connect(): Promise<DriverSession>;         // מצמיד (BLE/USB) או פותח קלט ידני
}
interface DriverSession {
  capture(req: CaptureRequest): Promise<Reading>;         // ירייה אחת
  stream?(req: CaptureRequest): AsyncIterable<Reading>;    // רציף (X6)
  importFile?(ref: BlobRef): Promise<Reading[]>;           // ייבוא קובץ (עתידי, iCS50)
  health(): Promise<DeviceHealth>;
  close(): Promise<void>;
}
interface CaptureRequest {
  capability: Capability;
  quantity: QuantityKind;
  frameRef: FrameRef;                        // מערכת הצירים של האתר (ADR-007)
  critical: boolean;
  operatorId: Uuid;
}
```

---

## 2. מודל היכולות (Capability)

```ts
type Capability =
  | 'manual.entry' | 'distance.point-to-point'
  | 'point.3d' | 'angle' | 'area.derived' | 'scan.pointcloud';

interface DeviceDescriptor {
  id: Uuid; vendor: string; model: string;
  transport: 'ble' | 'usb' | 'wifi' | 'file-import' | 'manual';
  capabilities: CapabilityProfile[];
  calibration: CalibrationState;
  firmware?: string;
}
interface CapabilityProfile {
  capability: Capability;
  accuracy: { absoluteMm: number; relativePct?: number };
  range?: { minMm: number; maxMm: number };
  acquisition: 'one-shot' | 'stream' | 'batch-file';
  trustClass: 1|2|3|4|5;                     // מזין את שקלול האימות (מסמך 13)
  outputSchema: JsonSchemaRef;               // סכמת ה-payload ליכולת זו
}
```

---

## 3. חוזה ה-Reading (הפלט של כל דרייבר)

```ts
interface Reading {                          // בלתי-משתנה, append-only (I-M2)
  id: Uuid;                                  // נוצר-בלקוח
  deviceId: Uuid; capability: Capability;
  capturedAtTs: string; operatorId: Uuid;
  raw: DevicePayload;                        // מאומת מול outputSchema
  calibrationId: Uuid;                       // איזה כיול היה בתוקף (I-M4)
  frameRef: FrameRef;
  supersededBy?: Uuid;                       // תיקון = reading חדש (מסמך 14 §6)
}
```
כל דרייבר **חייב** למלא `calibrationId`, `frameRef`, `operatorId` ו-`capturedAtTs` — זו שרשרת
המקור שהופכת מדידה למגנת-בפני-תביעה (Q13).

---

## 4. רישום דרייברים וניתוב

```ts
interface DriverRegistry {
  register(driver: MeasurementDriver): void;      // מ-manifest, ללא קומפילציה מחדש של הליבה
  route(req: CaptureRequest, policy: RoutingPolicy): MeasurementDriver;
  routeCrossValidation(req: CaptureRequest): [MeasurementDriver, MeasurementDriver];
}
interface RoutingPolicy {
  minTrustClass?: number;             // אבן דורשת ≥4 על קריטי
  preferAcquisition?: 'one-shot' | 'stream';
  requireCalibrationValid: boolean;
}
```
- ניתוב לפי **יכולת נדרשת** → אחר כך `trustClass`, זמינות, ותוקף כיול.
- ל**אימות צולב**: `routeCrossValidation` בוחר במכוון **שני מקורות בלתי-תלויים** (למשל X6 + D2)
  ומתייג את שתי הקריאות ל-`CrossValidationSet`.

---

## 5. מפרטי הדרייברים ל-v1

### 5.1 Manual (קלט אנושי — גם הוא דרייבר)
```ts
descriptor: { transport:'manual',
  capabilities:[
    { capability:'manual.entry', accuracy:{absoluteMm:3}, acquisition:'one-shot', trustClass:2 },
    { capability:'distance.point-to-point', accuracy:{absoluteMm:2}, acquisition:'one-shot', trustClass:3 } // לייזר ידני
  ] }
payload: { valueMm:number, method:'tape'|'handheld-laser', enteredBy:Uuid }
```
- **תמיד זמין offline** — זו הזנה אנושית, ללא BLE.
- אין טלמטריית כיול; `calibrationState` = מוצהר-מפעיל (או N/A לסרט).
- שימושי כמקור-גיבוי וכצלע שנייה באימות צולב כשאין מכשיר שני.

### 5.2 Leica D2
```ts
descriptor: { vendor:'Leica', model:'D2', transport:'ble',
  capabilities:[{ capability:'distance.point-to-point',
    accuracy:{absoluteMm:1.5}, range:{minMm:50,maxMm:100000}, acquisition:'one-shot', trustClass:4 }] }
payload: { distanceMm:number, signalQuality?:number /* SDK-TBD */ }
```
- **BLE one-shot:** לחיצה על ההתקן → קריאה נשלחת ל-session בטאבלט → נשמרת מקומית מיד.
- **בריאות:** סוללה, עוצמת BLE. **שגיאות:** `out-of-range`, `weak-target`, `timeout`.
- **כיול:** נעקב; `EXPIRED` → הקריאה `uncalibrated`, נדחית לקריטי (מסמך 13 §4.2).

### 5.3 Leica X6
```ts
descriptor: { vendor:'Leica', model:'X6', transport:'ble',
  capabilities:[
    { capability:'distance.point-to-point', accuracy:{absoluteMm:1}, acquisition:'one-shot', trustClass:4 },
    { capability:'point.3d',   accuracy:{absoluteMm:2}, acquisition:'stream',   trustClass:4 },
    { capability:'angle',      accuracy:{absoluteMm:0 /*deg SDK-TBD*/}, acquisition:'one-shot', trustClass:3 },
    { capability:'area.derived', accuracy:{absoluteMm:0, relativePct:0.2}, acquisition:'one-shot', trustClass:3 }
  ] }
payload (point.3d): { x:number, y:number, z:number, frameRef:FrameRef }   // מ״מ, במסגרת האתר
payload (distance): { distanceMm:number }
```
- **תהליך A של המרווח האנכי** (מסמך 02 §5): X6 דוגם רצפה+תקרה → clearance נגזר-גאומטריה.
- `point.3d` יכול להיות `stream` (דגימה רציפה) — נשמר מקומית בקטעים.
- כיול/בריאות כמו D2.

> **מדידת המרווח האנכי** משלבת X6 (תהליך A) + D2 (תהליך B, ישיר כל 60/80/100 ס״מ) → שניהם
> ל-`CrossValidationSet` אחד. אף אחד אינו מחליף את השני (מסמך 02, מסמך 13).

---

## 6. כיול ובריאות

```ts
interface CalibrationState { calibratedAt:string; validUntil:string; certificateRef?:string;
  status:'VALID'|'EXPIRING'|'EXPIRED'; }
interface DeviceHealth { battery?:number; bleSignal?:number; temperatureC?:number; ready:boolean; lastError?:string; }
```
- `EXPIRED` → קריאות מסומנות `uncalibrated`; נדחות לקריטי אלא אם דריסה בת-ייחוס.
- הבריאות מוצגת ל-UI כדי שמפעיל לא ייתקע באמצע session ללא סוללה/קליטה.

---

## 7. אילוצי הרצה על-גבי-ההתקן (offline-first)

- **צימוד BLE ולכידה בטאבלט** — לא מהשרת. הדרייבר רץ בסביבת הלקוח.
- **עמידות > קישוריות:** כל `Reading` נכתב לאחסון המקומי (מסמך 14) לפני כל דבר אחר.
- **חיבור מחדש:** ניתוק BLE באמצע session אינו מאבד קריאות שכבר נלכדו; ה-session מתחבר מחדש.
- **קוד דרייבר משותף:** נכתב מול הפורט, מקומפל לסביבת הלקוח — אותה הפשטה מאפשרת גם דרייבר-בדיקה.

---

## 8. תפר ההרחבה (צד-שלישי — מתוכנן, לא נבנה ב-v1)

- הפורט `MeasurementDriver` + סכמת `CapabilityProfile` מפורסמים כ**חוזה מגורסא** (חבילה).
- יצרן עתידי מממש את אותו פורט → ההתקן "פשוט עובד". מתגלה דרך manifest רישום.
- **בונים את התפר עכשיו, לא SDK/מרקטפלייס ציבורי** (Q1, מסמך 12).

---

## 9. תרחישי קבלה

| # | תרחיש | פלט צפוי |
|---|-------|----------|
| DV-1 | לכידת D2 one-shot | `Reading` עם `calibrationId`, `frameRef`, `capturedAtTs` מלאים |
| DV-2 | קלט ידני offline | מתקבל תמיד; `method` נרשם |
| DV-3 | בקשת קריטי, `minTrustClass:4`, זמין רק Manual(2) | ניתוב נכשל בבירור → נדרש מכשיר trustClass≥4 |
| DV-4 | `routeCrossValidation` למרווח | שני דרייברים בלתי-תלויים (X6+D2), תיוג ל-`CrossValidationSet` |
| DV-5 | D2 עם כיול EXPIRED על קריטי | קריאה `uncalibrated` → נדחית באימות (מסמך 13 AT-5) |
| DV-6 | ניתוק BLE באמצע session | קריאות שנלכדו נשמרות; חיבור מחדש; ללא אובדן |
| DV-7 | payload לא תואם `outputSchema` | הקריאה נדחית בקצה הקליטה (לא נכנסת לאחסון) |

---

## 10. Definition of Done

1. `MeasurementDriver`/`DriverSession` כפורטים; הדומיין אינו מייבא SDK.
2. דרייברים ל-Manual/D2/X6 מיישמים את הפורט; Manual עובד offline לחלוטין.
3. כל `Reading` נושא שרשרת מקור מלאה; payload מאומת מול `outputSchema`.
4. ניתוב לפי יכולת+trustClass+כיול; `routeCrossValidation` בוחר שני מקורות בלתי-תלויים.
5. כיול EXPIRED ובריאות מטופלים ומוצגים.
6. כל 7 תרחישי הקבלה (§9) עוברים.

> **עדיין ללא לוגיקה עסקית מיושמת** — זהו המפרט. שדות `SDK-TBD` יינעלו עם מחקר ה-SDK (Q4).
