# 06 — שכבת מכשירי המדידה (Device Layer)

> ציר-תכנון לבנייה-מחדש של Soline Measure: **הפשטת `LaserDevice`** עם שני מימושים —
> **Leica DISTO X6** (BLE, מדידת 3D) ו-**Bosch GLM 50C** (BLE, מדידת 2D).
> גרסה 1.0 · 2026-08-16 · עברית · לשון זכר.
>
> **נשען על:** `DISTO_PROTOCOL.md` (שני הפרוטוקולים פוענחו חי מ-logcat),
> `MEASURE_APP_ANALYSIS.md` (הארכיטקטורה הקיימת: `BluetoothViewModel`, `LeicaDistoManager`,
> `BluetoothLeManager`, `LaserDeviceType`), `MEASURE_APP_ISSUES.md` (B2 snap-דורס, B13 פולינג-סוללה),
> `MEASURE_REBUILD_PLAN.md` (crown-jewel = ה-BLE; USB Encoder הוצא מהתחום).

---

## 0. תקציר

שכבת-המכשירים היא ה-**crown jewel** של האפליקציה: אינטגרציית-ה-BLE ללייזרים היא הנכס היקר-ביותר
לשחזור, והיא **כבר עובדת ומאומתת בשטח** (`MEASURE_REBUILD_PLAN §1.2, §5.1`). שני הפרוטוקולים פוענחו
מקצה-לקצה (`DISTO_PROTOCOL.md`) — **אין צורך ב-SDK חיצוני של Leica או Bosch; הכול BLE סטנדרטי.**

היום הקוד מחזיק **שני managers נפרדים ולא-מאוחדים**: `LeicaDistoManager` (3D) ו-`BluetoothLeManager`
(Bosch, 2D), עם `LaserDeviceType` כ-enum-סוג ו-`BluetoothViewModel` שמנהל סריקה/חיבור/reconnect.
ההפשטה קיימת רק כ-enum, לא כחוזה-קוד אחד. **המטרה של הציר הזה: לחלץ ממשק `LaserDevice` יחיד ששני
המימושים ממלאים, כך שכל שאר האפליקציה (קליטת-שטח, ViewModels, מנוע-ההתאמה) מדברת אל מכשיר-לייזר
מופשט אחד — בלי לדעת אם מאחוריו Leica או Bosch, 2D או 3D.**

**עיקרון-על:** לא משכתבים את הלוגיקה הבדוקה של ה-BLE — **עוטפים** אותה בחוזה אחיד. כל שינוי בשכבת-ה-BLE
עצמה הוא הרס-ערך (`MEASURE_REBUILD_PLAN §5.1`). העבודה כאן היא **חילוץ-ממשק + איחוד מודל-נתונים**,
לא כתיבה-מחדש של הטרנספורט.

**מחוץ לתחום:** ה-USB Encoder (`EncoderViewModel`, `usb.host`, `device_filter.xml`) — **הוסר לחלוטין**
(`MEASURE_APP_ANALYSIS §108`, החלטת Michael). שכבת-המכשירים של Soline מכירה **רק לייזרי-BLE**.

---

## 1. מצב קיים (מה שיש, מאומת)

### 1.1 מבנה הקוד היום
| רכיב | תפקיד | מקור |
|---|---|---|
| `LeicaDistoManager` | חיבור + פענוח פריימים של DISTO X6 (3D, עם DST 360) | `DISTO_PROTOCOL §3` |
| `BluetoothLeManager` | חיבור + פענוח של Bosch GLM 50C (2D) — **מחלקה נפרדת** | `DISTO_PROTOCOL §Bosch` |
| `BluetoothViewModel` | סריקה, חיבור, reconnect, חשיפת state ל-UI | `MEASURE_APP_ANALYSIS §44` |
| `LaserDeviceType` | enum: סוג המכשיר (`BOSCH_GLM50C`, DISTO וכו') | `MEASURE_APP_ANALYSIS §16` |
| `Leica3DMeasurement` | מודל מדידת-3D של Leica | `MEASURE_APP_ANALYSIS §16` |
| `BluetoothScreen` | מסך סריקה/חיבור ב-Compose | `MEASURE_APP_ANALYSIS §95` |

**המסקנה הארכיטקטונית:** יש שני נתיבי-קוד מקבילים כמעט-זהים במבנה (connect → discover → subscribe →
decode → emit). ההבדל האמיתי בין המכשירים מצומצם ל: (א) UUIDs, (ב) handshake, (ג) מבנה-פריים,
(ד) ממדיות (3D מול 2D). כל השאר משותף. **זה בדיוק המקרה הקלאסי להפשטה מאחורי interface אחד.**

### 1.2 הפרוטוקולים (מתומצת מ-`DISTO_PROTOCOL.md`)

**Leica DISTO X6 — 3D:**
- שירות בסיס: `3ab1XXXX-f831-4395-b29d-570977d5bf94`. מכשיר: DISTO X6 + מתאם **DST 360** (זווית אופקית).
- `3ab1010d` (**notify**, 20B) — פריים-מדידה: `float32 LE מרחק[m]` + `float32 LE זווית-אנכית[rad]` +
  float32 נוסף + flags + **מונה-מדידה עולה** (בייטים 16–19, סמן קבוע `C0`).
- `3ab1010f` (**read/poll ~150ms**, 12B) — זווית-אופקית מ-DST 360.
- **מקרה מיוחד:** זווית-אנכית `00 00 80 7F` = `+Infinity` → מדידת-מרחק בלבד (DST 360 לא סובב).
- dedup: **מונה-המדידה + `isNew`** מונעים כפילויות — לוגיקה שחובה לשמר.
- 3D = מרחק + זווית-אנכית + זווית-אופקית → נקודת X/Y/Z.

**Bosch GLM 50C — 2D:**
- שירות: `02a6c0d0-0451-4000-b000-fb3210111989`. characteristic-מדידה: `02a6c0d1-...` (indicate/notify, 20B; heartbeat=4B).
- **handshake (חובה לשחזר בדיוק):** (1) GATT connect → discover; (2) כתיבת `02 00` (ENABLE_INDICATION)
  ל-CCCD descriptor; (3) שליחת פקודת-הפעלה `C0 55 02 01 00 1A`; (4) קבלה דרך `onCharacteristicChanged`.
- פריים: `Mode + Value[mm]`. מצבים: `BACK` (מדידה אמיתית), `MIN_MAX_START`, `LOCKED`, `UNKNOWN` (heartbeat).
- 2D = מרחק בלבד, ללא זווית.

### 1.3 בעיות-שטח רלוונטיות לשכבה זו
- **B13** (`MEASURE_APP_ISSUES`): פולינג רציף של זווית-DST360 כל ~150ms → צריכת-סוללה מתמדת. "לפי תכנון",
  אבל שווה לעצור פולינג כשלא במצב-לכידה.
- **B2** (`MEASURE_APP_ISSUES`): snap של T-join דורס מידה שנמדדה בעד 660 מ"מ. **הערה:** זו בעיית-גאומטריה,
  **לא** בעיית-שכבת-מכשיר — אך היא ממחישה למה שכבת-המכשיר חייבת לפלוט **מדידה גולמית נאמנה** (מרחק+זוויות
  כפי-שנמדד) בלי לגעת בה; כל תיקון/snap שייך לשכבת-הגאומטריה מעליה.
- מכשיר-אחרון-שחובר נשמר (`D7:C6:19:89:88:87`, ה-DISTO — `MEASURE_APP_ANALYSIS §59`) → בסיס ל-reconnect אוטומטי.

---

## 2. ארכיטקטורת-היעד: ההפשטה

### 2.1 עקרון-הגבול
שכבת-המכשירים **אחראית רק על**: גילוי → חיבור → handshake → מנוי → פענוח-פריים → פליטת **מדידה גולמית**
+ ניהול מחזור-החיים והסטטוס. היא **לא** אחראית על: היטל-לנקודת-חדר, סיבוב לפי `originPoint`, בניית-קיר,
snap, או כל גאומטריה. הגבול הזה מפריד את ה-crown-jewel (BLE) מהלוגיקה-שמעליו, ומאפשר לשמר את ה-BLE כמות-שהוא.

```
UI / ScanSession / fit-engine
        ▲   ▲
        │   │  Flow<RawMeasurement>  +  StateFlow<DeviceConnectionState>
        │   │
   ┌────┴───┴─────────────────┐
   │      LaserDevice          │  ← interface אחד (החוזה)
   └───────────┬──────────────┘
       ┌───────┴────────┐
       ▼                ▼
 LeicaDistoX6Device   BoschGlm50cDevice     (+ FakeLaserDevice לבדיקות)
       │                │
       └──── BLE (Android GATT — הקוד הבדוק הקיים) ────┘
```

### 2.2 החוזה `LaserDevice` (סקיצה קונספטואלית)
```kotlin
interface LaserDevice {
    val deviceType: LaserDeviceType
    val capabilities: DeviceCapabilities         // מה המכשיר יודע (ראה §2.3)

    val connectionState: StateFlow<DeviceConnectionState>
    val measurements: Flow<RawMeasurement>       // רק מדידות חדשות (אחרי dedup)
    val battery: StateFlow<Int?>                  // אם נחשף; אחרת null

    suspend fun connect(address: String): Result<Unit>
    suspend fun disconnect()

    // מצב-לכידה: שולט על פולינג יקר-סוללה (DST360). ברירת-מחדל false.
    fun setCaptureActive(active: Boolean)
}

// גילוי/סריקה — נפרד מהמכשיר (רץ לפני שיש מכשיר):
interface LaserScanner {
    fun scan(): Flow<DiscoveredDevice>           // DiscoveredDevice{ address, name, guessedType }
    fun stop()
}
```

### 2.3 מודל-היכולות (Capabilities) — כך מבדילים 2D מ-3D בלי `if (isLeica)`
```kotlin
data class DeviceCapabilities(
    val hasVerticalAngle: Boolean,      // DISTO: true · Bosch: false
    val hasHorizontalAngle: Boolean,    // DISTO+DST360: true · Bosch: false  → זה מה שמאפשר 3D
    val reportsBattery: Boolean,
    val supportsModes: Boolean,         // Bosch: BACK/MIN_MAX/LOCKED · DISTO: false
)
```
כל צרכן (UI, ScanSession) שואל את ה-capabilities במקום לבדוק סוג-מכשיר. "3D זמין" = `hasHorizontalAngle`.

### 2.4 מודל-המדידה הגולמי האחיד
```kotlin
data class RawMeasurement(
    val distanceMm: Double,             // תמיד קיים (המרה מ-m→mm ל-Leica; Bosch כבר ב-mm)
    val verticalAngleRad: Double?,      // Leica: ערך או null אם Infinity · Bosch: null
    val horizontalAngleRad: Double?,    // Leica+DST360: ערך · Bosch: null
    val mode: MeasurementMode?,         // Bosch: BACK/MIN_MAX_START/LOCKED · Leica: null
    val sequence: Long,                 // מונה-מדידה (Leica native · Bosch: מונה-פנימי)
    val timestampMs: Long,
    val rawFrame: ByteArray,            // הפריים הגולמי — לדיאגנוסטיקה/לוג (B-חיובי)
)
```
**החלטת-מפתח:** המדידה נשמרת **גולמית ונאמנה** — ללא נרמול-זווית, ללא היטל, ללא snap. יחידות מנורמלות
בלבד (מ"מ + רדיאנים) כדי שהצרכן לא יצטרך לדעת שה-Leica שולח מטרים וה-Bosch מ"מ. `verticalAngleRad=null`
מקודד במפורש את מקרה-ה-`Infinity` של DISTO (מדידת-מרחק-בלבד) — הצרכן מבדיל 3D מ-2D לפי נוכחות-הזוויות.

### 2.5 מחזור-חיים וסטטוס אחיד
```kotlin
sealed interface DeviceConnectionState {
    data object Disconnected : ...
    data object Scanning : ...
    data class Connecting(val address: String) : ...
    data class HandshakeInProgress(val step: String) : ...   // רלוונטי בעיקר ל-Bosch
    data class Connected(val device: DiscoveredDevice) : ...
    data class Reconnecting(val attempt: Int) : ...
    data class Error(val reason: DeviceError) : ...
}
```
`BluetoothViewModel` הופך **device-agnostic**: הוא מחזיק `LaserDevice` (דרך factory), צורך את שני
ה-Flows, ולא יודע איזה מכשיר מאחור. reconnect-אוטומטי מבוסס מכשיר-אחרון-שנשמר (§1.3).

### 2.6 Factory
```kotlin
object LaserDeviceFactory {
    fun create(type: LaserDeviceType, ctx: Context): LaserDevice = when (type) {
        LaserDeviceType.LEICA_DISTO_X6 -> LeicaDistoX6Device(ctx)
        LaserDeviceType.BOSCH_GLM50C   -> BoschGlm50cDevice(ctx)
        LaserDeviceType.FAKE           -> FakeLaserDevice()
    }
    // זיהוי-אוטומטי בסריקה: מיפוי שם/UUID → LaserDeviceType (DiscoveredDevice.guessedType)
}
```

---

## 3. מיפוי פרוטוקול → מימוש (מה כל מחלקה עושה)

### 3.1 `LeicaDistoX6Device`
- connect GATT → discover → **subscribe notify** ל-`3ab1010d`.
- **פולינג `3ab1010f`** (זווית-אופקית) — **רק כאשר `setCaptureActive(true)`** (מפחית B13).
- decode `3ab1010d`: bytes 0–3 float32 m→mm, bytes 4–7 float32 rad (בדיקת `00 00 80 7F`→`null`),
  bytes 16–19 מונה+`C0`. dedup לפי המונה + `isNew` (`DISTO_PROTOCOL §51`) → פליטת `RawMeasurement`
  רק על מדידה חדשה.
- מיזוג: הזווית-האופקית האחרונה שנקראה מ-`3ab1010f` מצורפת ל-`RawMeasurement` הבא (כפי שהאפליקציה עושה היום).
- capabilities: `hasVerticalAngle=true, hasHorizontalAngle=true` (בהנחת DST360 מחובר), `supportsModes=false`.

### 3.2 `BoschGlm50cDevice`
- connect GATT → discover → **handshake בדיוק כמפרט:** כתיבת `02 00` ל-CCCD של `02a6c0d1` →
  כתיבת פקודת-הפעלה `C0 55 02 01 00 1A` → קבלה דרך `onCharacteristicChanged` (`DISTO_PROTOCOL §Bosch`).
- decode: פריים-20B → `mode + value[mm]`; פריים-4B = heartbeat → מתעלמים (לא פולטים מדידה).
  פליטת `RawMeasurement` רק על `mode=BACK` (מדידה אמיתית); `LOCKED` נפלט עם דגל-mode.
- dedup: אין מונה native → מונה-פנימי + סינון-כפילויות לפי ערך+חלון-זמן.
- capabilities: `hasVerticalAngle=false, hasHorizontalAngle=false, supportsModes=true`.

### 3.3 `FakeLaserDevice`
- מזרים `RawMeasurement`-ים סינתטיים (רצף מוגדר-מראש) ללא BLE. מאפשר פיתוח/בדיקות של ScanSession
  ומנוע-ההתאמה **offline לגמרי, בלי חומרה** — קריטי לפיתוח מקבילי ולבדיקות-אוטומציה.

---

## 4. החלטות תכנון (עם נימוקים)

### D1 — הפשטת `LaserDevice` אחת מול שני managers נפרדים (P0)
**המלצה:** לחלץ interface `LaserDevice` יחיד; `LeicaDistoManager`/`BluetoothLeManager` הופכים ל-`LeicaDistoX6Device`
/`BoschGlm50cDevice` שמממשים אותו. **נימוק:** שני נתיבי-קוד כמעט-זהים במבנה; ההבדל מצטמצם ל-4 צירים
(UUID/handshake/frame/ממדיות). איחוד = הוספת מכשיר-שלישי בעתיד היא מחלקה אחת, וכל הצרכנים (ScanSession,
ViewModel, fit-engine) מדברים לחוזה אחד. **הסיכון המרכזי:** לא לגעת בלוגיקת-ה-BLE הבדוקה תוך כדי החילוץ.

### D2 — מודל-יכולות (capabilities) מול בדיקות-סוג (`if isLeica`) (P0)
**המלצה:** `DeviceCapabilities` מפורש; הצרכנים בודקים יכולת (`hasHorizontalAngle`), לא סוג. **נימוק:**
"3D" אינו תכונה-של-Leica אלא תכונה-של-DST360-מחובר; מכשיר עתידי עשוי לתמוך ב-3D אחרת. בדיקות-סוג
מתפזרות בקוד והופכות שביר. capabilities ממרכז את ההבדל בנקודה אחת.

### D3 — מדידה גולמית נאמנה; ההיטל ל-3D מחוץ לשכבה (P0)
**המלצה:** שכבת-המכשיר פולטת `RawMeasurement` (מרחק+זוויות גולמיות, יחידות מנורמלות בלבד); ההיטל
לנקודת-X/Y/Z והסיבוב לפי `originPoint` נשארים בשכבת-הקליטה/גאומטריה. **נימוק:** מפריד את ה-crown-jewel
מהגאומטריה; מאפשר לשמר את ה-BLE כקופסה; ומבטיח שמדידה נכנסת ללוג/ל-`.sol` **כפי-שנמדדה** — תנאי
לאבחון B2 (snap-דורס) ולנאמנות-מדידה. `rawFrame` נשמר לדיאגנוסטיקה.

### D4 — API מבוסס Kotlin Flow / StateFlow (P1)
**המלצה:** `measurements: Flow<RawMeasurement>` + `connectionState/battery: StateFlow`. **נימוק:**
מתלבש טבעית על Compose+MVVM הקיים; backpressure וניהול-מחזור-חיים מובנים; מחליף callbacks של GATT
בזרם נקי לצרכן. עלות-המרה מ-callback-ל-Flow נמוכה (callbackFlow סטנדרטי).

### D5 — DST360 polling: כימוס פנימי + gate צריכת-סוללה (P1)
**המלצה:** הפולינג של `3ab1010f` מכומס בתוך `LeicaDistoX6Device`, ופעיל **רק** ב-`setCaptureActive(true)`.
**נימוק:** מטפל ב-B13 (סוללה) בלי לחשוף פרט-מכשירי לצרכן; ScanSession מדליק capture כשנכנסים למצב-לכידה
ומכבה כשיוצאים. Bosch מתעלם מ-`setCaptureActive` (no-op).

### D6 — dedup (מונה/isNew) בתוך המימוש (P1)
**המלצה:** סינון-כפילויות מתבצע בכל מימוש לפני הפליטה; ה-Flow פולט רק מדידה **חדשה**. **נימוק:** Leica
מספק מונה native + `isNew` (לשמר!); Bosch דורש מונה-פנימי. הצרכן לא צריך להתמודד עם כפילויות. `sequence`
נחשף ב-`RawMeasurement` לצורך מעקב/לוג.

### D7 — מחזור-חיים + reconnect אוטומטי אחיד (P1)
**המלצה:** `DeviceConnectionState` sealed אחד לשני המכשירים; reconnect-אוטומטי לפי מכשיר-אחרון-שנשמר
(datastore). **נימוק:** UX-שטח דורש חיבור-מחדש שקוף אחרי נפילת-BLE; המידע כבר נשמר היום
(`D7:C6:19:89:88:87`). איחוד-הסטטוס מפשט את `BluetoothScreen`/ViewModel.

### D8 — `FakeLaserDevice` לפיתוח/בדיקות ללא חומרה (P2)
**המלצה:** מימוש-מדומה שלישי מאחורי אותו interface. **נימוק:** מאפשר פיתוח מקבילי של ScanSession/fit-engine
בלי טאבלט+לייזר, ובדיקות-אוטומציה דטרמיניסטיות. עלות-נמוכה, תשואה-גבוהה לקצב-הפיתוח. תלוי ב-D1.

### D9 — הפשטת-transport (BLE) נפרדת: לדחות (P2)
**המלצה:** **לא** להוסיף כרגע שכבת-transport מופשטת (לקראת Web Bluetooth עתידי); לשמור את Android-GATT
בתוך המימושים. **נימוק:** אין דרישה קונקרטית ל-web כרגע (`MEASURE_REBUILD_PLAN` נעל Kotlin-native);
הפשטה מוקדמת = over-engineering. ה-interface `LaserDevice` ממילא מספק את תפר-ההחלפה אם יידרש בעתיד.

### D10 — הסרת ה-USB Encoder משכבת-המכשירים (P0)
**המלצה:** למחוק `EncoderViewModel`, הרשאת `usb.host`, ו-`res/xml/device_filter.xml`; שכבת-המכשירים
מכירה רק BLE. **נימוק:** החלטת Michael (`MEASURE_APP_ANALYSIS §108`) — ה-Encoder לא חלק מ-Soline.
הסרתו מפשטת הרשאות, מודל-מכשירים, ותלות-אנדרואיד (USB host).

---

## 5. תוכנית מימוש מדורגת

**עיקרון:** חילוץ-ממשק **בלי לגעת בלוגיקת-ה-BLE** תחילה; איחוד-מודל אחר-כך; ליטוש-סוללה/reconnect בסוף.

### שלב 0 — ניקוי והכנה (adapt · קטן)
- הסרת ה-USB Encoder לחלוטין (D10): `EncoderViewModel`, `usb.host`, `device_filter.xml`.
- תיעוד נקודות-הכניסה הקיימות של `LeicaDistoManager`/`BluetoothLeManager` לפני נגיעה.
- **מטרה:** בסיס נקי, רק-BLE, בלי שינוי-התנהגות.

### שלב 1 — חילוץ החוזה (build ממוקד · הליבה)
- הגדרת `LaserDevice`, `LaserScanner`, `DeviceCapabilities`, `RawMeasurement`, `DeviceConnectionState`,
  `LaserDeviceFactory` (D1–D3).
- עטיפת שני ה-managers הקיימים כ-`LeicaDistoX6Device`/`BoschGlm50cDevice` **מעל הקוד הבדוק** — ה-decode
  וה-handshake נשארים כמות-שהם, רק נעטפים לפליטת `RawMeasurement` + `StateFlow`.
- המרת callbacks→Flow (D4).
- **מטרה:** שני המכשירים עובדים דרך חוזה אחד; ScanSession/ViewModel עדיין עובדים.

### שלב 2 — איחוד הצרכן (build)
- הפיכת `BluetoothViewModel` ל-device-agnostic (מחזיק `LaserDevice`, לא מכיר סוג).
- העברת כל בדיקות-הסוג בקוד ל-capabilities (D2).
- איחוד `DeviceConnectionState` ב-`BluetoothScreen`.
- **מטרה:** אין יותר שני נתיבי-קוד ב-UI/ViewModel.

### שלב 3 — ליטוש: סוללה, reconnect, dedup (adapt+build)
- gate של פולינג-DST360 לפי `setCaptureActive` (D5, מטפל ב-B13); חיווט מ-ScanSession.
- reconnect אוטומטי לפי מכשיר-אחרון (D7).
- ריכוז לוגיקת-dedup בכל מימוש (D6), עם שמירת `isNew`/מונה של Leica.
- **מטרה:** התנהגות-שטח חסכונית-סוללה ועמידה לנפילות-BLE.

### שלב 4 — `FakeLaserDevice` ובדיקות (build · אופציונלי-מקדים)
- מימוש-מדומה (D8) + בדיקות-אינטגרציה של ScanSession מול מדידות-סינתטיות.
- **מטרה:** פיתוח מקבילי ללא-חומרה + רגרסיה דטרמיניסטית.

> **build-vs-adapt בשורה:** ה-decode/handshake/GATT = **adapt** (לשמר, לעטוף). ה-interface + מודל-נתונים
> אחיד + capabilities + Fake = **build** (שכבת-האיחוד החדשה). ה-USB = **delete**.

---

## 6. פתוח / דורש-החלטת-Michael
- **DST360 חובה ל-3D:** בלי המתאם, ה-DISTO הוא 2D בלבד (`DISTO_PROTOCOL §50`). האם ה-UI צריך לזהות
  ולהתריע "DST360 לא מחובר → מדידת-מרחק-בלבד"? (מומלץ: כן, דרך capabilities דינמי.)
- **battery:** האם אחד המכשירים חושף מצב-סוללה ב-characteristic ידוע? לא תועד ב-`DISTO_PROTOCOL`; לבדוק
  חי לפני שמסמנים `reportsBattery`.
- **מכשירים עתידיים:** האם צפוי דגם-לייזר שלישי (למשל DISTO אחר)? משפיע על כמה להשקיע ב-factory/זיהוי-אוטומטי.
