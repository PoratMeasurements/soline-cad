# VERIFICATION_REPORT — Soline unified ORDX converter

הממיר המאוחד: `node soline_convert.js <in.ordx>` → DXF 2D + DXF 3D + ORDX + PDP.
דוח אימות עצמי על כל קובצי הקורפוס. נוצר: 2026-08-13.

## סיכום — קובץ × פורמט

| קובץ | קירות | פריטים | DXF 2D | DXF 3D | ORDX | PDP |
|---|---|---|:---:|:---:|:---:|:---:|
| 2725_Ktchn_TRIO_Nir_DR1 | 9 | 26 | ✓ | ✓ | ✓ | ✓ |
| 2726_Ktchn_TRIO_Nir_DR1 | 5 | 28 | ✓ | ✓ | ✓ | ✓ |
| 2854_Ktchn_TRIO_Nir_DR1 | 4 | 22 | ✓ | ✓ | ✓ | ✓ |
| 2916_Ktchn_TRIO_Nir_DR1 | 6 | 32 | ✓ | ✓ | ✓ | ✓ |
| 2918_Ktchn_TRIO_Nir_DR1 | 5 | 25 | ✓ | ✓ | ✓ | ✓ |
| 2918_Ktchn_TRIO_Nir_DR2 | 5 | 24 | ✓ | ✓ | ✓ | ✓ |

מקרא: ✓ עבר · ✗ נכשל · — לא רלוונטי/דילוג. PDP מסומן ✓ = **מבנה תקין**, אך **טעון בדיקת טעינה ידנית ב-Raumplan** (לא ניתן לאמת אוטומטית).

## פירוט לכל קובץ

### 2725_Ktchn_TRIO_Nir_DR1
- **חדרים/קירות/אביזרים**: 1 / 9 / 26
- **DXF 2D** ✓ — walls 9/9 items 26/26 legend 11 miss 0 | LINE 724 TEXT 12 | pairs y ascii y sec 2=2 eof y
- **DXF 3D** ✓ — boxes 35 (walls 9+items 26) 3DFACE 210/210 | pairs y ascii y sec 3=3 eof y
- **ORDX** ✓ — round-trip identical (walls 9, fixtures 0, furnishings 26)
- **PDP** ✓ — injected 9 socket-class | MEP 33/33 stride 173 count@0x11a 33/33 +17064B (expect 17064) — NEEDS RAUMPLAN LOAD-CHECK

### 2726_Ktchn_TRIO_Nir_DR1
- **חדרים/קירות/אביזרים**: 1 / 5 / 28
- **DXF 2D** ✓ — walls 5/5 items 28/28 legend 10 miss 0 | LINE 729 TEXT 11 | pairs y ascii y sec 2=2 eof y
- **DXF 3D** ✓ — boxes 33 (walls 5+items 28) 3DFACE 198/198 | pairs y ascii y sec 3=3 eof y
- **ORDX** ✓ — round-trip identical (walls 5, fixtures 0, furnishings 28)
- **PDP** ✓ — injected 13 socket-class | MEP 37/37 stride 173 count@0x11a 37/37 +24648B (expect 24648) — NEEDS RAUMPLAN LOAD-CHECK

### 2854_Ktchn_TRIO_Nir_DR1
- **חדרים/קירות/אביזרים**: 1 / 4 / 22
- **DXF 2D** ✓ — walls 4/4 items 22/22 legend 10 miss 0 | LINE 646 TEXT 11 | pairs y ascii y sec 2=2 eof y
- **DXF 3D** ✓ — boxes 26 (walls 4+items 22) 3DFACE 156/156 | pairs y ascii y sec 3=3 eof y
- **ORDX** ✓ — round-trip identical (walls 4, fixtures 0, furnishings 22)
- **PDP** ✓ — injected 11 socket-class | MEP 35/35 stride 173 count@0x11a 35/35 +20856B (expect 20856) — NEEDS RAUMPLAN LOAD-CHECK

### 2916_Ktchn_TRIO_Nir_DR1
- **חדרים/קירות/אביזרים**: 1 / 6 / 32
- **DXF 2D** ✓ — walls 6/6 items 32/32 legend 9 miss 0 | LINE 819 TEXT 10 | pairs y ascii y sec 2=2 eof y
- **DXF 3D** ✓ — boxes 38 (walls 6+items 32) 3DFACE 228/228 | pairs y ascii y sec 3=3 eof y
- **ORDX** ✓ — round-trip identical (walls 6, fixtures 0, furnishings 32)
- **PDP** ✓ — injected 15 socket-class | MEP 39/39 stride 173 count@0x11a 39/39 +28440B (expect 28440) — NEEDS RAUMPLAN LOAD-CHECK

### 2918_Ktchn_TRIO_Nir_DR1
- **חדרים/קירות/אביזרים**: 1 / 5 / 25
- **DXF 2D** ✓ — walls 5/5 items 25/25 legend 8 miss 0 | LINE 628 TEXT 9 | pairs y ascii y sec 2=2 eof y
- **DXF 3D** ✓ — boxes 30 (walls 5+items 25) 3DFACE 180/180 | pairs y ascii y sec 3=3 eof y
- **ORDX** ✓ — round-trip identical (walls 5, fixtures 0, furnishings 25)
- **PDP** ✓ — injected 12 socket-class | MEP 36/36 stride 173 count@0x11a 36/36 +22752B (expect 22752) — NEEDS RAUMPLAN LOAD-CHECK

### 2918_Ktchn_TRIO_Nir_DR2
- **חדרים/קירות/אביזרים**: 1 / 5 / 24
- **DXF 2D** ✓ — walls 5/5 items 24/24 legend 8 miss 0 | LINE 599 TEXT 9 | pairs y ascii y sec 2=2 eof y
- **DXF 3D** ✓ — boxes 29 (walls 5+items 24) 3DFACE 174/174 | pairs y ascii y sec 3=3 eof y
- **ORDX** ✓ — round-trip identical (walls 5, fixtures 0, furnishings 24)
- **PDP** ✓ — injected 11 socket-class | MEP 35/35 stride 173 count@0x11a 35/35 +20856B (expect 20856) — NEEDS RAUMPLAN LOAD-CHECK

## כיסוי אלמנטים (מיפוי שם ORDX → קטלוג עברי)

| שם ORDX | מפתח קטלוג | שם עברי | מופעים |
|---|---|---|---|
| Beam | Beam | קורה (בטון/גבס) | 1 |
| Can Light | Recessed Downlight (Can Light) | ספוט שקוע (גוף תאורה שקוע) | 16 |
| Doorway w/o Frame | Doorway w/o Frame | פתח דלת (ללא משקוף) | 2 |
| Duplex Socket | Duplex Socket | שקע כפול | 15 |
| Faucet | Faucet / Tap Point | ברז / נקודת ברז | 16 |
| Gas | Gas Point | נקודת גז (כיריים) | 5 |
| Junction Box | Junction Box | קופסת חיבורים (ג׳אנקשן) | 12 |
| Power Line | Electrical Junction / Cable Node | צומת / צמת חשמל (ריכוז כבלים) | 5 |
| Sewage | Sewage / Waste Point | נקודת ניקוז / ביוב | 5 |
| Sewer drainage | Floor Drain | ניקוז רצפה (מחסום רצפה) | 2 |
| ShutterBox | Shutter Box | ארגז תריס | 2 |
| Socket | Single Socket | שקע יחיד | 56 |
| SocketEx | Waterproof Socket IP44 | שקע מוגן מים IP44 | 4 |
| Water Supply | Cold Water Point | נקודת מים קרים | 1 |
| Window | Window | חלון | 15 |

✓ כל שמות ה-ORDX בקורפוס ממופים לסמל ולשם עברי.

## הערות
- **DXF 2D / 3D**: מבנה DXF תקין (זוגות group-code, SECTION/ENDSEC מאוזנים, EOF), ASCII נקי, עברית ב-`\U+`, סגנון `HEB`→Arial. כל קיר צויר; כל אביזר עם סמל; מקרא עברי בצד בתכנית 2D.
- **ORDX**: round-trip מלא (parse→export→parse) — זהה בכל הקירות/הפריטים/המידות/המיקומים.
- **PDP**: הזרקת אביזרי חשמל צמודי-קיר (Socket/Duplex) לבסיס golden (2918 DR2, donor DR1) — הפייפליין המאומת שנטען ב-Raumplan. **המבנה נבדק אוטומטית** (count/stride/גודל) אך **הטעינה בפועל דורשת בדיקת Michael ב-Raumplan**. מיקום מדויק גאומטרית רק לקובץ 2918 (offX/offY שלו); שאר הקבצים — מבנה תקין, מיקום להמחשה.
