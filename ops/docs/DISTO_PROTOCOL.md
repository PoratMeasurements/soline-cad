# פרוטוקול Leica DISTO X6 (BLE) — פוענח חי

> פוענח מלכידת logcat חיה על הטאבלט (2026-08-16) בזמן מדידה אמיתית. המחלקה באפליקציה: `LeicaDistoManager`.
> זהו המידע הדרוש כדי לממש/לשמר את החיבור למכשיר ב-Soline Measure.

## שירות ה-BLE
- **בסיס UUID (Leica DISTO):** `3ab1XXXX-f831-4395-b29d-570977d5bf94`.
- המכשיר: **Leica DISTO X6** + מתאם **DST 360** (נותן זווית אופקית/היקפית → מדידת 3D).

## Characteristics שנצפו
| UUID (XXXX) | תפקיד | דגם גישה |
|---|---|---|
| `3ab1010d` | **מדידה** (מרחק + זווית אנכית) — 20 בייט | notify, `isNew=true` בכל מדידה חדשה |
| `3ab1010f` | **זווית אופקית מ-DST 360** — 12 בייט | read, נסקר (polled) כל ~150ms רציף |
| `3ab10100` | שירות/מצב (הופיע 10×) | read |
| `3ab1010c` | מצב/פקודה (4×) | — |
| `3ab10110/0111/0112` | config/state (5× כ״א) | — |
| `3ab10120/0121/0122` | config/commands (4-6× כ״א) | — |

## מבנה פריים המדידה (`3ab1010d`, 20 בייט)
דוגמה חיה: `06 F0 CE 3F  AA F2 C1 3F  00 00 00 00  00 00 01 00  00 00 03 C0` → Distance=1.617m, V.Angle=86.82°.

| בייטים | סוג | משמעות |
|---|---|---|
| 0–3 | float32 LE | **מרחק במטרים** (0x3FCEF006 ≈ 1.6167) |
| 4–7 | float32 LE | **זווית אנכית ברדיאנים** (0x3FC1F2AA ≈ 1.5152 rad = 86.82°) |
| 8–11 | float32 LE | ערך נוסף (0 בדגימות; ככל הנראה זווית/קואורדינטה משנית) |
| 12–15 | flags | סטטוס (`00 00 01 00`) |
| 16–19 | counter+marker | **מונה מדידה עולה** (03,04,05…0D) + סמן קבוע `C0` |

**מקרה מיוחד:** אם בייטים 4–7 = `00 00 80 7F` → float32 = **+Infinity** → אין נתון זווית (מדידת-מרחק בלבד, ה-DST 360 לא סובב). האפליקציה מציגה "V.Angle: Infinity°".

## מדידות חיות שנלכדו (הוכחה)
```
#46 dist=1.617m vAngle=87.19°
#47 dist=1.617m vAngle=86.85°
#48 dist=1.153m vAngle=Inf (מרחק בלבד)
#49 dist=1.362m vAngle=Inf
#51 dist=1.716m vAngle=Inf
#52 dist=1.768m vAngle=8.13°
#53 dist=2.702m vAngle=Inf
#54 dist=2.758m vAngle=Inf
```

## מ-BLE ל-נקודת חדר (עיבוד האפליקציה)
מרחק + זווית-אנכית (מ-`3ab1010d`) + זווית-אופקית (מ-`3ab1010f`, DST 360) → נקודה תלת-ממדית **X/Y/Z** (מהלוג: `3D: X=1252, Y=1063, Z=-2528`), ואז הטלה ל-plan (X, Z) + גובה (Y). ב-P2P המערכת קולטת אוטומטית (`🎯 LEICA AUTO-CAPTURE`) ובונה קיר (`✓ P2P wall created`).

## מסקנות לבנייה (Leica)
- **לא צריך להמציא** — הפרוטוקול פוענח מקצה-לקצה. אפשר לשמר את `LeicaDistoManager` (Kotlin) כמות שהוא, או לממש מחדש לפי המפרט כאן.
- ה-DST 360 הוא המפתח למדידת 3D (זווית אופקית) — בלעדיו זו מדידת-מרחק דו-ממדית בלבד.
- מונה המדידה + `isNew` מונעים כפילויות — לשמר את הלוגיקה הזו.

---

# פרוטוקול Bosch GLM 50 C (BLE) — פוענח חי

> פוענח מלכידת logcat חיה (2026-08-16) בזמן מדידה אמיתית. המחלקה באפליקציה: `BluetoothLeManager` (נפרד מ-Leica).
> מכשיר: **"GLM 50-27 CG"** (Bosch GLM 50 C), deviceType `BOSCH_GLM50C`. **מדידה 2D בלבד** (מרחק, ללא זווית).

## שירותים ו-Characteristics
- **שירות מדידה:** `02a6c0d0-0451-4000-b000-fb3210111989` (+ שירות נוסף `02a6c0f0-...`).
- **Characteristic מדידה:** `02a6c0d1-0451-4000-b000-fb3210111989` — indicate/notify, פריימים של 20 בייט (heartbeat = 4 בייט).
- שירותים סטנדרטיים נוספים: 1800, 1801, 180a.

## handshake החיבור (חשוב לשחזור)
1. התחברות GATT → גילוי שירותים (5 שירותים).
2. כתיבת **ENABLE_INDICATION** (`02 00`) ל-CCCD descriptor של characteristic המדידה.
3. אחרי הצלחת כתיבת ה-descriptor → שליחת **פקודת הפעלה**: `C0 55 02 01 00 1A` (write ל-characteristic פקודה).
4. קבלת מדידות דרך `onCharacteristicChanged`.

## מבנה פריים המדידה (20 בייט)
כל פריים מפוענח ל-**Mode + Value(מ״מ)**:
| Mode | משמעות |
|---|---|
| `BACK` | **מדידה אמיתית** (מרחק במ״מ, למשל 2245.9 / 1616.1 / 1902.4) — התייחסות מגב המכשיר |
| `MIN_MAX_START` | מרקר תחילת מעקב מין/מקס (value 0.0) |
| `LOCKED` | מדידה נעולה |
| `UNKNOWN` | פריים 4-בייט = heartbeat/סטטוס (value null) |

הערכים במ״מ (float). המכשיר 2D — מרחק בלבד, בלי זווית.

## הבדל מ-Leica (לארכיטקטורת המנוע)
| | Leica DISTO X6 | Bosch GLM 50 C |
|---|---|---|
| מחלקה | `LeicaDistoManager` | `BluetoothLeManager` |
| ממד | 3D (מרחק+זווית, עם DST 360) | 2D (מרחק בלבד) |
| שירות | `3ab1xxxx-f831-4395-b29d-570977d5bf94` | `02a6c0d0-...-fb3210111989` |
| פריים | dist(float m)+vAngle(float rad)+counter | mode + value(mm) |
| handshake | read/poll + notify | CCCD indicate (02 00) + enable cmd `C0 55 02 01 00 1A` |

## מסקנה
שני המכשירים פוענחו מקצה-לקצה. ארכיטקטורת המנוע ב-Soline Measure צריכה **הפשטה משותפת** (interface `LaserDevice`) עם שני מימושים (Leica 3D / Bosch 2D) — כפי שכבר קיים באפליקציה (`LaserDeviceType`). אין צורך ב-SDK חיצוני; הכול ב-BLE סטנדרטי.

---

# פרוטוקול Leica DISTO D2 (BLE) — חולץ מ-InnoDraw (ניתוח סטטי)

> חולץ בניתוח סטטי (2026-08-17) מקבצי ה-DLL של תוכנת InnoDraw (`C:\Program Files (x86)\InnoDraw`), בלי להריץ אף exe. המפרט המלא של ה-GATT נמצא כ-JSON קונפיגורציה **בתוך ה-SDK הרשמי של Leica** (`Leica.Sdk.dll`) שאיתו InnoDraw עובד, דרך ה-wrapper שלה `eLMsrDevLeicaBtSDK.dll`.
> ה-D2 הוא מכשיר **דו-ממדי (מרחק בלבד, ללא זווית)** — פרופיל ה-BLE הקלאסי של Leica DISTO.

## הממצא המרכזי
InnoDraw **לא** מדבר GATT גולמי בעצמו — הוא עוטף את ה-SDK המנוהל (.NET) של Leica:
- `Leica.Sdk.dll` (3.6MB) — ה-SDK הרשמי, מכיל את כל טבלת ה-GATT כ-JSON.
- `eLMsrDevLeicaBtSDK.dll` — ה-wrapper של InnoDraw (מחלקות `eLMsrDevLeicaBtSDKNs`, סמלים כמו `m_strDistCmdD2`, `EL_INIT_COMMAND`, `DistanceBluetoothResponse`).
- ה-SDK מזהה את סוג המכשיר בקריאת ה-characteristic של שם הדגם (`DS_MODEL_NAME` = `3ab1010c`) והתאמה מול regex (`.*X4.*`, `.*X6.*`, `...D2...`) — `DetermineDeviceType` / `GetModelNameCharacteristic`.
- סוג התשובה למכשיר מרחק-בלבד (D2): **`DistanceBluetoothResponse`**; לעומת מכשיר עם נטייה: `DistanceAndInclinationBluetoothResponse`. זה מאשר שה-D2 שולח **מרחק בלבד**.

## שירות ה-BLE (זהה בסיס ל-X6!)
- **בסיס UUID:** `3ab1XXXX-f831-4395-b29d-570977d5bf94` — **אותו בסיס** כמו ה-X6.
- **שירות המדידה (`DISTO_SERVICE`):** `3ab10100-f831-4395-b29d-570977d5bf94`.

## Characteristics (טבלה מלאה מתוך ה-SDK של Leica)
| שם ב-SDK | UUID (בסיס `-f831-4395-b29d-570977d5bf94`) | תפקיד |
|---|---|---|
| `DISTO_SERVICE` | `3ab10100` | שירות ה-DISTO הראשי |
| **`DS_DISTANCE`** | **`3ab10101`** | **המדידה של ה-D2 — מרחק, float32 LE במטרים, notify** |
| `DS_DISTANCE_UNIT` | `3ab10102` | יחידת תצוגת מרחק (לתצוגה בלבד) |
| `DS_INCLINATION` | `3ab10103` | נטייה (ה-D2 לא חושף/לא מעדכן) |
| `DS_INCLINATION_UNIT` | `3ab10104` | יחידת נטייה |
| `DS_DIRECTION` | `3ab10105` | כיוון (מכשירים גבוהים) |
| `DS_DIRECTION_UNIT` | `3ab10106` | יחידת כיוון |
| `DS_HORIZONTAL_INCLINE` | `3ab10107` | נטייה אופקית |
| `DS_VERTICAL_INCLINE` | `3ab10108` | נטייה אנכית |
| **`DS_COMMAND`** | **`3ab10109`** | **כתיבת פקודות למכשיר (write)** |
| `DS_RESPONSE` | `3ab1010A` | תשובות המכשיר |
| `DS_MODEL_NAME` | `3ab1010c` | שם דגם (משמש לזיהוי סוג המכשיר) |

שירותים סטנדרטיים נוספים שה-SDK קורא: `Battery Service` (`180F` → level `2A19`), `Device Information` (`180A` → `2A24` model, `2A25` serial, `2A26` firmware, `2A29` manufacturer).

> הערה: ה-`3ab1010d` שראינו חי ב-X6 (פריים משולב 20 בייט מרחק+זווית) הוא של דור ה-X. ה-**D2 משתמש ב-`3ab10101` הקלאסי** — מרחק בלבד.

## חיבור + הפעלה (handshake)
1. התחברות GATT ל-DISTO וגילוי שירותים.
2. (אופציונלי, לזיהוי) קריאת `DS_MODEL_NAME` (`3ab1010c`) → מחרוזת דגם (למשל "DISTO D2 …"); התאמה מזהה שזה D2.
3. **הפעלת notifications** על `DS_DISTANCE` (`3ab10101`): כתיבת `01 00` ל-CCCD descriptor (`0x2902`) של ה-characteristic.
4. קבלת מדידות דרך `onCharacteristicChanged` על `3ab10101` בכל פעם שהמשתמש לוחץ על כפתור המדידה במכשיר.
5. **טריגר מרחוק (רשות):** אפשר לכתוב פקודת מדידה ל-`DS_COMMAND` (`3ab10109`) — ב-InnoDraw זה `m_strDistCmdD2`. לא חובה; ה-D2 שולח מרחק אוטומטית בלחיצת כפתור פיזי. ברירת המחדל הבטוחה: להסתמך על notify של `3ab10101`.

## מבנה פריים המדידה (`DS_DISTANCE` = `3ab10101`)
| בייטים | סוג | משמעות |
|---|---|---|
| 0–3 | **float32 LE** | **מרחק במטרים** (למשל `9A 99 99 3F` = 1.2m). להכפיל ב-1000 למ״מ. |

- הערך **תמיד במטרים** בפריים הגולמי, ללא תלות ב-`DS_DISTANCE_UNIT` (שהוא רק לתצוגה).
- אין מונה/זווית/flags בפריים ה-D2 (בניגוד ל-20 בייט של ה-X6). זהו float32 בודד = 4 בייט.

## איך לממש ב-`LaserBle.kt` (מקביל ל-Leica/Bosch הקיים)
- **זיהוי:** אותו בסיס שירות כמו X6 (`3ab10100-f831-4395-b29d-570977d5bf94`). אפשר להוסיף ענף `LEICA_DISTO_D2` שנבדל מה-X6 לפי ה-characteristic שקיים/מזוהה: אם קיים `3ab1010d` → X6; אם המדידה מגיעה על `3ab10101` (ואין `3ab1010d`/DST 360) → D2. אפשר גם לקרוא `DS_MODEL_NAME` (`3ab1010c`) ולבדוק אם המחרוזת מכילה "D2".
- **Subscribe:** enable notify על `3ab10101-f831-4395-b29d-570977d5bf94` (כתיבת `01 00` ל-CCCD `00002902`).
- **Parse:** בתוך ה-callback על `3ab10101`, קרא `distanceM = ByteBuffer.wrap(value).order(LITTLE_ENDIAN).float`, ואז `distanceMm = distanceM * 1000f`. פלוט את זה כמדידת מרחק דו-ממדית (כמו נתיב ה-Bosch), בלי זווית.
- **מבנה:** מדובר במימוש Leica 2D — הכי קרוב לנתיב ה-Bosch (מרחק בלבד) אבל עם UUIDs של Leica. מתאים להפשטת `LaserDevice` הקיימת: `deviceType = LEICA_DISTO_D2`, `is3D = false`.

## מה מאושר מול מה שדורש אימות חי
- **מאושר (ודאות גבוהה):** בסיס השירות, UUID השירות `3ab10100`, ה-characteristic למדידה `DS_DISTANCE = 3ab10101`, מיפוי ה-characteristics המלא, ה-CCCD/notify, וש-D2 = מרחק בלבד. הכול חולץ ישירות מקונפיג ה-SDK של Leica.
- **ודאות גבוהה (פרופיל תקני ומתועד):** float32 LE במטרים על `3ab10101`.
- **דורש אישור בלכידה חיה (ודאות בינונית):** האם צריך בכלל לכתוב פקודת טריגר ל-`3ab10109` (`m_strDistCmdD2`), או שדי ב-notify. מומלץ להתחיל עם notify בלבד ולהוסיף טריגר רק אם המכשיר לא דוחף נתונים. כדאי logcat קצר בזמן מדידת D2 ראשונה לאישור מבנה 4-הבייט.
