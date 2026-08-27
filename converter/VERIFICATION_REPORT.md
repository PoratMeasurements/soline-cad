# VERIFICATION_REPORT — Soline unified ORDX converter

הממיר המאוחד: `node soline_convert.js <in.ordx>` → DXF 2D + DXF 3D + ORDX + PDP.
דוח אימות עצמי על כל קובצי הקורפוס. נוצר: 2026-08-24.

## סיכום — קובץ × פורמט

| קובץ | קירות | פריטים | DXF 2D | DXF 3D | ORDX | PDP |
|---|---|---|:---:|:---:|:---:|:---:|
| 2725_Ktchn_TRIO_Nir_DR1 | 9 | 26 | ✓ | ✓ | ✓ | ✓ |
| 2726_Ktchn_TRIO_Nir_DR1 | 5 | 28 | ✓ | ✓ | ✓ | ✓ |
| 2854_Ktchn_TRIO_Nir_DR1 | 4 | 22 | ✓ | ✓ | ✓ | ✓ |
| 2916_Ktchn_TRIO_Nir_DR1 | 6 | 32 | ✓ | ✓ | ✓ | ✓ |
| 2918_Ktchn_TRIO_Nir_DR1 | 5 | 25 | ✓ | ✓ | ✓ | ✓ |
| 2918_Ktchn_TRIO_Nir_DR2 | 5 | 24 | ✓ | ✓ | ✓ | ✓ |
| בדיקה | 2 | 3 | ✓ | ✓ | ✓ | ✓ |

מקרא: ✓ עבר · ✗ נכשל · — לא רלוונטי/דילוג. PDP מסומן ✓ = **מבנה תקין**, אך **טעון בדיקת טעינה ידנית ב-Raumplan** (לא ניתן לאמת אוטומטית).

## פירוט לכל קובץ

### 2725_Ktchn_TRIO_Nir_DR1
- **חדרים/קירות/אביזרים**: 1 / 9 / 26
- **DXF 2D** ✓ — INSERT 22 LINE 1336 SOLID 226 TEXT 205 | pairs y ascii y sec 4=4 eof y
- **DXF 3D** ✓ — 3DFACE 596 BLOCK 7 | pairs y ascii y sec 4=4 eof y
- **ORDX** ✓ — round-trip identical (walls 9, fixtures 0, furnishings 26)
- **PDP** ✓ — DR in-place path: base wall9_oc26.pdp (1 assembly kept) | 26 item(s) → 26 slots, 9 walls | in-place edits: type 1 · code 0 · dims 26, 0 slot(s) left as-is, 0 dropped | body-loadable true · counts true · seg true · footer ok | 98402B — NEEDS RAUMPLAN LOAD-CHECK

### 2726_Ktchn_TRIO_Nir_DR1
- **חדרים/קירות/אביזרים**: 1 / 5 / 28
- **DXF 2D** ✓ — INSERT 24 LINE 1447 SOLID 205 TEXT 185 | pairs y ascii y sec 4=4 eof y
- **DXF 3D** ✓ — 3DFACE 566 BLOCK 6 | pairs y ascii y sec 4=4 eof y
- **ORDX** ✓ — round-trip identical (walls 5, fixtures 0, furnishings 28)
- **PDP** ✓ — DR in-place path: base wall5_oc28.pdp (1 assembly kept) | 27 item(s) → 28 slots, 5 walls | in-place edits: type 1 · code 0 · dims 27, 1 slot(s) left as-is, 0 dropped | body-loadable true · counts true · seg true · footer ok | 96289B — NEEDS RAUMPLAN LOAD-CHECK

### 2854_Ktchn_TRIO_Nir_DR1
- **חדרים/קירות/אביזרים**: 1 / 4 / 22
- **DXF 2D** ✓ — INSERT 19 LINE 1217 SOLID 152 TEXT 159 | pairs y ascii y sec 4=4 eof y
- **DXF 3D** ✓ — 3DFACE 506 BLOCK 7 | pairs y ascii y sec 4=4 eof y
- **ORDX** ✓ — round-trip identical (walls 4, fixtures 0, furnishings 22)
- **PDP** ✓ — DR in-place path: base wall4_oc25.pdp (1 assembly kept) | 22 item(s) → 25 slots, 4 walls | in-place edits: type 5 · code 0 · dims 22, 3 slot(s) left as-is, 0 dropped | body-loadable true · counts true · seg true · footer ok | 71618B — NEEDS RAUMPLAN LOAD-CHECK

### 2916_Ktchn_TRIO_Nir_DR1
- **חדרים/קירות/אביזרים**: 1 / 6 / 32
- **DXF 2D** ✓ — INSERT 30 LINE 1728 SOLID 222 TEXT 184 | pairs y ascii y sec 4=4 eof y
- **DXF 3D** ✓ — 3DFACE 560 BLOCK 7 | pairs y ascii y sec 4=4 eof y
- **ORDX** ✓ — round-trip identical (walls 6, fixtures 0, furnishings 32)
- **PDP** ✓ — DR in-place path: base wall6_oc32.pdp (1 assembly kept) | 29 item(s) → 32 slots, 6 walls | in-place edits: type 0 · code 0 · dims 29, 3 slot(s) left as-is, 0 dropped | body-loadable true · counts true · seg true · footer ok | 103360B — NEEDS RAUMPLAN LOAD-CHECK

### 2918_Ktchn_TRIO_Nir_DR1
- **חדרים/קירות/אביזרים**: 1 / 5 / 25
- **DXF 2D** ✓ — INSERT 23 LINE 1251 SOLID 167 TEXT 156 | pairs y ascii y sec 4=4 eof y
- **DXF 3D** ✓ — 3DFACE 506 BLOCK 7 | pairs y ascii y sec 4=4 eof y
- **ORDX** ✓ — round-trip identical (walls 5, fixtures 0, furnishings 25)
- **PDP** ✓ — DR in-place path: base wall5_oc25.pdp (1 assembly kept) | 25 item(s) → 25 slots, 5 walls | in-place edits: type 1 · code 0 · dims 25, 0 slot(s) left as-is, 0 dropped | body-loadable true · counts true · seg true · footer ok | 78788B — NEEDS RAUMPLAN LOAD-CHECK

### 2918_Ktchn_TRIO_Nir_DR2
- **חדרים/קירות/אביזרים**: 1 / 5 / 24
- **DXF 2D** ✓ — INSERT 22 LINE 1182 SOLID 163 TEXT 154 | pairs y ascii y sec 4=4 eof y
- **DXF 3D** ✓ — 3DFACE 500 BLOCK 7 | pairs y ascii y sec 4=4 eof y
- **ORDX** ✓ — round-trip identical (walls 5, fixtures 0, furnishings 24)
- **PDP** ✓ — DR in-place path: base wall5_oc25.pdp (1 assembly kept) | 24 item(s) → 25 slots, 5 walls | in-place edits: type 1 · code 0 · dims 24, 1 slot(s) left as-is, 0 dropped | body-loadable true · counts true · seg true · footer ok | 78788B — NEEDS RAUMPLAN LOAD-CHECK

### בדיקה
- **חדרים/קירות/אביזרים**: 1 / 2 / 3
- **DXF 2D** ✓ — INSERT 3 LINE 280 SOLID 35 TEXT 54 | pairs y ascii y sec 4=4 eof y
- **DXF 3D** ✓ — 3DFACE 80 BLOCK 2 | pairs y ascii y sec 4=4 eof y
- **ORDX** ✓ — round-trip identical (walls 2, fixtures 3, furnishings 0)
- **PDP** ✓ — DR in-place path: base wall3_oc5.pdp (1 assembly kept) | 3 item(s) → 5 slots, 3 walls | in-place edits: type 1 · code 0 · dims 3, 2 slot(s) left as-is, 0 dropped | body-loadable true · counts true · seg true · footer ok | 18208B — NEEDS RAUMPLAN LOAD-CHECK

## כיסוי אלמנטים (מיפוי שם ORDX → קטלוג עברי)

| שם ORDX | מפתח קטלוג | שם עברי | מופעים |
|---|---|---|---|
| Beam | Beam | קורה (בטון/גבס) | 2 |
| Can Light | Recessed Downlight (Can Light) | ספוט שקוע (גוף תאורה שקוע) | 16 |
| Doorway w/o Frame | Doorway w/o Frame | פתח דלת (ללא משקוף) | 2 |
| Duplex Socket | Duplex Socket | שקע כפול | 15 |
| Faucet | Faucet / Tap Point | ברז / נקודת ברז | 16 |
| Gas | Gas Point | נקודת גז (כיריים) | 5 |
| Junction Box | Junction Box | קופסת חיבורים (ג׳אנקשן) | 12 |
| Power Line | Electrical Junction / Cable Node | צומת / צמת חשמל (ריכוז כבלים) | 6 |
| Sewage | Sewage / Waste Point | נקודת ניקוז / ביוב | 5 |
| Sewer drainage | Floor Drain | ניקוז רצפה (מחסום רצפה) | 2 |
| ShutterBox | Shutter Box | ארגז תריס | 2 |
| Socket | Single Socket | שקע יחיד | 57 |
| SocketEx | Waterproof Socket IP44 | שקע מוגן מים IP44 | 4 |
| Water Supply | Cold Water Point | נקודת מים קרים | 1 |
| Window | Window | חלון | 15 |

✓ כל שמות ה-ORDX בקורפוס ממופים לסמל ולשם עברי.

## הערות
- **DXF 2D / 3D**: מבנה DXF תקין (זוגות group-code, SECTION/ENDSEC מאוזנים, EOF), ASCII נקי, עברית ב-`\U+`, סגנון `HEB`→Arial. כל קיר צויר; כל אביזר עם סמל; מקרא עברי בצד בתכנית 2D.
- **ORDX**: round-trip מלא (parse→export→parse) — זהה בכל הקירות/הפריטים/המידות/המיקומים.
- **PDP**: ייצוא DR אמיתי (`src/writePdpDR.js`) בשיטת **בסיס-אמיתי** — נבנה על גבי קובץ `.pdp` אמיתי של InnoDraw (`templates/dr/base/`), נבחר לפי מספר-קירות והתאמת-חריצים. **משוכתבים רק** טבלת-הקירות @0xd4 (byte-exact) ורשומות-הפריטים (כל רשומה = העתק מדויק של רשומה מקובץ אמיתי-נטען; קוד-הסמל @+0x91 מאומת מול רשימת-היתר מהקורפוס → אין E4214). **גוף Section E + מבנה-הרהיט + זנב-838 נשמרים byte-for-byte** (מסלול postype — מיקום/מידות/מחרוזת-סוג בלבד, בלוק-הסמל @0x91–0x9b נשמר byte-for-byte — נטען; **אך כל שינוי ב-0x91–0x9b → 921, ולכן פיצוח "הסמל-הנכון" מושהה**). **המבנה נבדק אוטומטית** אך **הטעינה בפועל דורשת בדיקת Michael ב-Raumplan**.
