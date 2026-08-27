# ניתוח אפליקציית המדידה הקיימת (הבסיס ל-Soline Measure)

> ניתוח reverse-engineering של `app-debug.apk` — הבסיס לתוכנת המדידה. גרסה 1.0 · 2026-08-16.
> מבוסס על חילוץ מבנה ה-APK + מחרוזות ה-DEX. **תיעוד חי (סכמת DB, מסכים, פרוטוקול) יתווסף מהחיבור לטאבלט.**

## זיהוי
- **חבילה:** `com.roommeasure.app` · **גרסה:** 5.2.0 (5200) · **שם תצוגה:** "CVSM".
- **מוצר בוגר** (v5) — אפליקציית מדידת-חדרים לנגרות/מטבחים.

## מחסנית טכנולוגית
- **Kotlin** נייטיבי · **Jetpack Compose** (UI) · ארכיטקטורת **single-activity + MVVM**.
- **Room** (מסד נתונים מקומי — offline-first) · **WorkManager** (סנכרון/רקע) · **okhttp** (רשת) · **navigation-compose** (ניווט).
- minSdk 26 · targetSdk 35 · debuggable.

## חומרה והרשאות
- **BLE** (`bluetooth_le`) — מד-לייזר אלחוטי: **Leica DISTO** (יש `bluetooth/Leica3DMeasurement`, `LaserDeviceType`).
- **USB host** (`usb.host` + `res/xml/device_filter.xml`) — התקן מדידה ב-USB: **Encoder** (`viewmodel/EncoderViewModel`) — ככל הנראה מקודד/גלגל-מדידה.
- **מצלמה** + autofocus (צילומים — `utils/PhotoManager`).
- מיקום (נדרש ל-BLE), אינטרנט, self-update (`utils/AppUpdater`), foreground-service, notifications.

## ⭐ הגשר לפייפליין של Soline
`viewmodel/ProjectViewModel` כולל: **`exportToOrdx`**, `exportToOrdxRoomByRoom`, `shareOrdx`, `emailOrdx`, `exportToPdf`, `exportProjectAsZip`, `addDocumentToProject`.
> **האפליקציה כבר מייצאת ORDX** — בדיוק הפורמט שהממיר של Soline צורך. זו חזית-המדידה של הפייפליין: מדידה → ORDX → ממיר → DXF/PDP/.sol. גם ייצוא DXF (`utils/DxfExporter`) ו-PDF (`export/PdfExporter`).

## מבנה הקוד (מיפוי מלא)
**ליבה:** `MainActivity`, `RoomMeasureApplication`, `Screen` (routes: Home, Plan...).

**מודל הנתונים (`model/`):**
- פרויקט/חלל: `Project`, `Room`, `Survey2D`, `OriginPoint`, `CardinalDir`, `UnitSystem`, `Converters`.
- קירות: `Wall`, `WallCorner`, `WallFace`, `WallType`, `WallEndStyle`, `WallTopStyle`, **`HeightBands`** (קיר עם רצועות-גובה = "קיר כפרופיל"!), `TemplateWall`, `WidthInputMode`, `DimensionReference`.
- ארונות: `Cabinet`, `CabinetClass`, `CabinetType`, `CabinetDefaults`, `FaceType`, `DoorSwing`, `HingeSide`.
- אביזרים/תשתית: `Accessory`, `AccessoryCategory`, `AccessoryType`.
- גאומטריה/פתרון: `ScanPoint3D`, `ShapePoint`, `ShapeSegment`, `ShapeAxis`, `ShapeSolver`, `ShapeTemplate`.
- CAD/פריסה: `CadDimensionLine`, `CadViewType`, `LayoutLayer/Preset/Settings/View`, `ViewLayoutSettings`, `PdfExportSettings`, `AppSettings`.

**קליטת שטח (`ui/scan/`):** `ScanSession`, `Scan2Stage`, `Scan2State`, `ScanEvent`, `ScanPhase`, `ScanPoint`/`ScanPoint2`, `WallBuild`, `WallConnectionSettings`, `Plane3D`, `WorldPt`, `PlanBounds`.

**תכנון (`ui/plan/`):** `EditMode`, `P2pUiState` (Point-to-Point), `HeightBandsUiState`, `ShapeWizardUiState`, `WallDistUiState`.

**חזיתות (`ui/elevation/`):** `ElevFaceTransform`, `ElevationDimLabels`, `ResizeHandle`.

**תלת-ממד (`ui/preview3d/`):** `Camera3D`, `Point3D`/`Edge3D`/`Face3D`, `RoomBounds`, `Render3DSettings`, `RotationPlane`.

**ViewModels:** `BluetoothViewModel` (חיבור/סריקה/reconnect ל-DISTO), `EncoderViewModel` (USB), `ProjectViewModel` (CRUD + ייצוא), `MeasurementTarget`, `MeasurementType`, `ViewMode`.

**נתונים/ייצוא/כלים:** `data/AppDatabase` + `data/ProjectDao` (Room) · `export/PdfExporter` · `utils/DxfExporter`, `PhotoManager`, `UnitManager`, `ThemeManager`, `AppUpdater`, `GridUtils`, `AppLogger`.

## מסקנה אסטרטגית
זו **בדיוק Soline Measure** בפוטנציה — ומאמתת את האפיון שכתבנו:
- קיר-כפרופיל (`HeightBands`), פתרון-צורה (`ShapeSolver`), P2P (Leica DISTO), 2D+חזיתות+3D, ייצוא ORDX/DXF/PDF, offline (Room).
- **הגשר לממיר כבר קיים** (ORDX). זה מקצר דרמטית את הדרך: לא בונים מאפס — לוקחים בסיס בוגר ומתאימים ל-Soline (מיתוג, `.sol`, מנוע-ההתאמה R1–R10, אינטגרציה לפלטפורמה).

## ממצאים מהחיבור החי (ADB, 2026-08-16)
נחקר חי על טאבלט **Samsung SM-X356B (Galaxy Tab A9+), אנדרואיד 16**. debuggable ✓.

### רישוי והגדרות (מאשר שזו האפליקציה של Soline)
- `license_company=SOLINE`, `license_email=Michael@SOLINE.co.il`, `is_licensed=true`, בתוקף עד 2027-08-16.
- הגדרות: `app_language=he`, `app_theme=super_dark`, `app_design_style=elsop`, `elevation_dimensions_enabled=true`.
- מכשיר אחרון שחובר (BLE): `D7:C6:19:89:88:87` (ה-DISTO).

### אחסון הנתונים (חשוב!)
מסד ה-Room **אינו** ב-`databases/` אלא בנתיב חיצוני מותאם:
`/sdcard/Android/data/com.roommeasure.app/files/CVSM_Projects/room_measure_database` (WAL mode).
בנוסף: `files/DXF_Exports/`, `files/logs/`, `datastore/app_settings_datastore`.

### מודל הנתונים המאומת (מהמסד החי)
**טבלה אחת: `projects`.** כל הגאומטריה נשמרת כ-**JSON בעמודה `rooms`**. שדות הטבלה:
- מטא: `id, name, description, createdAt, modifiedAt, isArchived, documents`.
- **לקוח** (סגנון Cabinet Vision): `customerName/Address1/Address2/City/State/Zip/Email/Phone/Mobile/Fax/Contact/Comment`.
- **ShipTo**: `shipToName/Address1/…/Comment` (אותם שדות).

**`rooms` JSON → חדר:** `{id, name, description, defaultHeight (2526.7), defaultSoffit, activeOriginId, originPoints[], scanFloorLevel, scanPoints[], walls[], createdAt, modifiedAt}`.
- **originPoint:** `{id, label ("מיקום 1"), x, y, rotationOffset, createdAt}` — נקודות-ייחוס.
- **wall (מאומת, כל השדות):** `id, startX, startY, endX, endY, length, thickness (100), height (2526.7), soffit, elevation, wallType (STANDARD), wallEndStyle (NO), wallTopStyle (STANDARD), hatchPattern (solid), isArcWall, studSpacing (406.4), maxConnectionDistance, connectToNext/Previous, startConnectedWallId, endConnectedWallId (גרף חיבורי-קירות!), heightManuallyEdited, soffitManuallyEdited, photos[], accessories[], cabinets[]`.
- **accessory (על קיר):** `{id, name ("Single Socket"/"Window"), type (SOCKET_SINGLE/WINDOW), face (FRONT), depth (עומק-בליטה: 6.8 שקע / 114.3 חלון), width, height, fromBottom, fromLeft, fromRight, widthInputMode (WIDTH_POSITION), description}`.
- **cabinet (על קיר):** מערך (ריק בדגימה — נמדד מטבח ריק).
> דגימת פרויקט אמיתית מלאה: `docs/samples/measure_project_sample.json`. דגימת ייצוא: `docs/samples/measure_export_sample.dxf`.

### מפת מסכים (מהתצוגה החיה)
- **תצוגה תלת-מימדית** — 3D של החדר (חלון/דלת/רצפה); סרגל עליון: הגדרות ⚙, שיתוף/ייצוא, refresh.
- **מצב תכנון (2D)** — תוכנית קונים עם **מידות אמיתיות** (4152/3489/5708… מ״מ) ו**זווית 91.3°** (לא 90). מצבים: **מצב חזית · ערוך · הוסף**; תצוגות: **ארונות · מידת CAD · 3D**; סטטוס DISTO (מנותק/נסה שוב), "walls 5", לוגו "elsop".
- **שיתוף/ייצוא** — יצר `ניסיון_3D_....dxf`; יעדי שיתוף כוללים **Odoo** (ERP) ואיש-קשר **"פורת מידות"**.

### ייצוא ואינטגרציות
- **DXF** (3D, מאומת חי), **ORDX** (`exportToOrdx` — הגשר לממיר), **PDF**, **ZIP**.
- **Odoo** כיעד שיתוף — רמז ל-ERP בשימוש.

### Backend (מפתיע — אין שרת מותאם!)
הכול על **GitHub**, repo `bravh/RoomMeasure-Releases`:
- **עדכונים:** `api.github.com/repos/bravh/RoomMeasure-Releases/releases/latest` (AppUpdater).
- **רישוי:** `api.github.com/repos/bravh/RoomMeasure-Releases/contents/licenses/` — הרישיונות הם **קבצים ב-repo**. (מנגנון חלש אבטחתית — נקודת-שיפור לבנייה: להעביר לרישוי-שרת אמיתי.)
- אין endpoint של Soline/Porat. פרוטוקולי המכשירים: `DISTO_PROTOCOL.md`.

### מפת מסכים מלאה (מהלוגים — Navigation)
`LicenseScreen → HomeScreen → RoomListScreen → PlanModeScreen → {ElevationModeScreen(per-wall) | Preview3DScreen | BluetoothScreen} + SettingsScreen`.
גרף: Home↔RoomList↔Plan↔{Elevation,3D}; Home→Bluetooth; Plan→Bluetooth; Settings. עם undo-stack מלא (snapshots).

### אלגוריתם המדידה→תכנית (מהלוגים)
- מכשיר → Distance+V.Angle+H.Angle → נקודת 3D → **"Plan (after rotation)"** לפי `originPoint.rotationOffset` → X/Y + גובה.
- **חיבור קירות:** T-join ("wall2 endpoint moved X mm"), "Face toward origin".
- **סדר קירות ל-ORDX:** "WALL ORDERING - Following perimeter connections" — מתחיל מהקיר העליון, עוקב אחר ההיקף, ממספר 1..N. תמיכה ב-Vault (soffit) עם rise/peakPos.
- **יעדי מדידה:** `ACCESSORY_FROM_LEFT/RIGHT` (מיקום אביזר מקצה הקיר → `fromLeft/fromRight`), P2P לקירות.
- **PDF:** 4 עמודים, locale en_US (rtl=false — ה-PDF באנגלית/LTR).

### דגימות אמיתיות שנשלפו (`docs/samples/`)
`measure_project_sample.json` (פרויקט מלא) · `measure_export_sample.ordx` (ORDX אמיתי — CV format) · `measure_export_sample.dxf`.

### ה-USB Encoder — ❌ מחוץ לתחום (הוחלט 2026-08-16)
**החלטת Michael: מתעלמים מה-USB Encoder לחלוטין — הוא לא חלק מ-Soline.** ל-Soline יש רק לייזרי BLE (Leica DISTO X6 + Bosch GLM 50C). מסירים את `EncoderViewModel`/`usb.host`/`device_filter` מהתכנון והבנייה מחדש.
*(לתיעוד בלבד — מה שהיה: ה-USB היה מכשיר מדידה על USB-serial לפי device_filter — CP210x/CH340/FTDI/Arduino — כנראה אנקודר/גלגל-מדידה DIY. לא רלוונטי יותר.)*

### אוצר-המילים המלא של ה-UI (1,112 מחרוזות עברית)
נשמר ב-`docs/samples/ui_strings_he.txt`. חושף את מלוא הפיצ'רים: מצבי-מדידה (נקודה↔נקודה, משטח↔משטח, מרחק-בין-קירות, מידות-ריבוע/אלכסון, כלי-פינה), פעולות-קיר (סובב A/B, העתק-עם-היסט, "פרופיל הגבהה מותאם", סגירה-עליונה), ניהול מצב-3D של הלייזר, "סריקת חדר 3D", ייצוא-ORDX (כולל חדר-לכל-קובץ), רישוי (דוא״ל+סיסמה+חברה+MAC), ומיתוג ("לוגו CVSM", "לוגו אלסופ").
