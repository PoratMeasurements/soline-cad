# CVSM_5.9_UPDATE — דלתא 5.6.0 → 5.9.0 (מה חדש, ובמוקד: ספריית-האלמנטים + שכפול/יצירה-מקיים)

> **חבילה:** `com.roommeasure.app` · **versionName 5.9.0** · **versionCode 5900** · minSdk 26 · targetSdk 35.
> נכתב עבור Michael, לשון זכר. תאריך: **2026-08-20**. מקור: פירוק `cvsm-5.9.0.apk` (16 dex) + `assets/guide/guide_he.html`.
> ממשיך את `CVSM_5.6_UPDATE.md` · `CVSM_ELEMENT_SCHEMA.md` · `CVSM_FEATURES.md`.
> **הערה:** באנר-המדריך הפנימי עדיין מתויג **"גרסה 5.7.0 · מבוסס על המסכים הפעילים בפועל"** — טקסט-המדריך מפגר אחרי מספר-הבנייה (ה-APK הוא 5900). זהו הפיצ'ר המבוקש (עדיפות-על של Michael): **עורך-הקטלוג + שכפול-אלמנט**.

---

## 0. תקציר
5.9.0 היא **קפיצת-התאמה-אישית (customization)**: לראשונה המשתמש יכול **לערוך את ברירות-המחדל של אלמנטים מובנים** ו**לשכפל אלמנט קיים כדי ליצור וריאנט אישי חדש** — בדיוק היכולת שאנחנו בונים. הלב הוא שני מנהלי-אחסון חדשים ב-`utils/` + דיאלוג-UI חדש:
- **`CatalogVariantManager`** → **וריאנטים של המשתמש** = שכפול / יצירה-מבוסס-קיים (רשימת-JSON ב-SharedPreferences).
- **`CatalogDefaultsManager`** → **דריסת ברירות-מחדל** לאלמנט-מובנה (רוחב/גובה/עומק + צבע), כמפה.
- **`ui/settings/CatalogEditorDialog`** → מסך "עורך קטלוג" עם שורות, שכפול, ועורך-וריאנט (Sheet).
- מקבילה מלאה לסמלי-CAD: **`CustomSymbolManager`** (+`CustomCadSymbol`,`CustomSymbolShape`) + `ui/plan/CadSymbolLibrary`, ו-**`CadAnnotationDefaultsManager`** להערות/סמלים.

---

## 1. דלתא מחלקות 5.6 → 5.9 (בקצרה)

**חדש ב-5.9 (שכבת ההתאמה-האישית — עיקר העדכון):**
- `utils/CatalogVariantManager` (+`$CatalogVariant`) — **[חדש]** וריאנטים אישיים. §2.
- `utils/CatalogDefaultsManager` (+`$DimensionOverride`) — **[חדש]** דריסת ברירות-מחדל לאלמנט-מובנה. §3.
- `ui/settings/CatalogEditorDialogKt` (`CatalogEditorDialog`,`VariantEditSheet`,`CatalogVariantRow`) — **[חדש]** ה-UI. §4.
- `utils/CustomSymbolManager` (+`CustomCadSymbol`,`CustomSymbolShape`), `ui/plan/CadSymbolLibrary(Kt)` — **[חדש]** עורך-תאום לסמלי-CAD. §5.
- `utils/CadAnnotationDefaultsManager` — **[חדש]** ברירות-מחדל להערות/סמלי-CAD (גובה-טקסט 150מ״מ, צבע "לפי שכבה"/קבוע).

**חדש/מורחב אחר ב-5.9:**
- `model/PdfExportSettings` — **[חדש]** מודל-הגדרות-PDF מפורש (היה מפוזר ב-5.6).
- `export/ElevDimClassifierKt` (+`ElevDimSource`), `export/SheetScaleKt` (+`NominalSheetScale`,`FittedScale`) — **[חדש]** סיווג-מידות-חזית וקנה-מידה-גיליון למנוע-הייצוא.
- `model/CardinalDir`, `model/WallFace` — **[חדש/מפורש]** כיווני-רוחות ופאת-קיר.

**היה כבר ב-5.6 (ללא שינוי מהותי ברשימת-המחלקות):** כל שכבת ה-CAD (`DimTierEngine`, `CadSymbol/Keys`, `CadDimensionGeometry`, `DimChainStyleSettings`), הארונות (`Cabinet`, `CabinetType/Class/Defaults`, `FaceType`, `HingeSide`, `CornerCabinetShape`), הצורות (`ShapeSolver`, `ShapeTemplate*`, `RoomShapeTemplates`, `TemplateWall`), רצועות-הגובה (`HeightBands`), `WallCorner*`, `OriginPoint`, `Survey2D/Measurement2D/ScanPoint3D`, `LayoutSettings*`, `FavoriteDevice`, ושני המייצאים `HtmlExporter`/`PdfExporter`. כלומר 5.9 אינה מוסיפה סוגי-אלמנט חדשים למודל — אלא **את היכולת לגזור אלמנטים אישיים מהקיימים**.

---

## 2. `CatalogVariantManager` — שכפול / יצירה-מבוסס-קיים  ⭐ (הפיצ'ר)

מנהל singleton (object) שמחזיק את **הווריאנטים שהמשתמש יצר**. כל וריאנט הוא "אלמנט אישי" הנגזר מאלמנט-מובנה (`baseType`) עם שם, מידות וצבע משלו.

### 2.1 מודל-הנתונים `CatalogVariant` [dex — מ-getters + toString]
מ-`(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;FFFLjava/lang/Integer;)…$CatalogVariant` + getters `getId/getBaseType/getName/getWidthMm/getHeightMm/getDepthMm/getColorArgb`:

| שדה | טיפוס | תפקיד |
|---|---|---|
| `id` | `String` | מזהה יציב (נוצר אוטומטית ב-`addVariant`) |
| `baseType` | `String` | **ה-`AccessoryType` שממנו נגזר** (מקור-השכפול) |
| `name` | `String` | שם-תצוגה אישי (אם ריק → נופל לשם-הסוג של ה-base) |
| `widthMm` | `Float` | רוחב |
| `heightMm` | `Float` | גובה |
| `depthMm` | `Float` | עומק |
| `colorArgb` | `Integer?` | צבע-תצוגה אישי (nullable = "לפי צבע השכבה") |

### 2.2 API [dex — שמות-מתודות]
- `addVariant(baseType, name, w, h, d, color)` — יוצר וריאנט חדש (מייצר `id`), מוסיף לרשימה, שומר. (יש `addVariant$default` → פרמטרים אופציונליים.)
- `updateVariant(variant)` — מעדכן לפי `indexOfFirst { it.id == ... }`.
- `deleteVariant(id)` — `filterNot { it.id == ... }` ושומר.
- `variantsFor(baseType)` — `filter { it.baseType == ... }` — הווריאנטים של אלמנט-מובנה מסוים.
- `byId(id)` — `firstOrNull`.
- `readFromPrefs()` — קורא רשימה מ-SharedPreferences (Gson `TypeToken<List<CatalogVariant>>`, `readFromPrefs$listType$1`).

### 2.3 אחסון [dex]
- **SharedPreferences**, מפתח `catalog_user_variants` (`KEY_VARIANTS`).
- **רשימת-JSON** (Gson). לוגים: `"CatalogVariantManager: failed to read variants"`, `"…failed to persist variants"`.
- offline-first לחלוטין; אין DB, אין רשת.

---

## 3. `CatalogDefaultsManager` — דריסת ברירות-מחדל לאלמנט-מובנה

בניגוד לווריאנט (אלמנט **חדש**), זהו **override** על אלמנט מובנה קיים — משנה את ברירות-המחדל שלו בלי ליצור פריט נוסף.

### 3.1 `DimensionOverride` [dex]
`(Ljava/lang/Float;Ljava/lang/Float;Ljava/lang/Float;Ljava/lang/Integer;)` → `widthMm:Float?`, `heightMm:Float?`, `depthMm:Float?`, `colorArgb:Integer?` (הכול nullable — דורסים רק מה שהוזן; שאר השדות נשארים מהקטלוג הרשמי).

### 3.2 API + אחסון
- מפה `Map<type, DimensionOverride>` — Gson `TypeToken<Map>` (`readFromPrefs$mapType$1`), מפתח `KEY_OVERRIDES`.
- `resetType(type)` — מוחק דריסה בודדת (חוזר ל-`builtInWidthMm/HeightMm/DepthMm`).
- `hasAnyOverride()` — `any { … }`.
- לוגים: `"CatalogDefaultsManager: failed to read/persist overrides"`.

---

## 4. `CatalogEditorDialog` — מסך "עורך קטלוג" (UI)

`ui/settings/CatalogEditorDialog.kt`. מיקום באפליקציה (מהמדריך): **הגדרות ← הגדרות תצוגה ← עורך קטלוג**.

תיאור-המדריך (guide_he.html): *"לכל אלמנט בקטלוג: מידות ברירת מחדל (רוחב/גובה/עומק) וצבע תצוגה אישי, החורגים מהקטלוג הרשמי המסונכרן."* · שדה-שם: *"אופציונלי — אם משאירים ריק, האלמנט מקבל את שם הסוג שלו כשם ברירת מחדל"*.

**קומפוזבלים וזרימה [dex — שמות-lambda ו-signatures]:**
- `CatalogEditorDialog(...)` — הדיאלוג הראשי: רשימה מקובצת של אלמנטים; state: `showCatalogEditorDialog`, `customDefs`.
- `CatalogVariantRow` — שתי חתימות:
  - `(AccessoryType, CatalogVariant, onClick: Function0)` — שורה בהקשר של אלמנט-בסיס.
  - `(CatalogVariant, onEdit: Function0, onDelete: Function0)` — שורת-וריאנט עם עריכה+מחיקה.
- `VariantEditSheet(...)` — ה-Sheet לעריכת/יצירת וריאנט: שדות **שם / רוחב / גובה / עומק / צבע**. (~17 lambdas — שדות-קלט + בורר-צבע + שמור/בטל.)
- State-flags: `editingVariant` (עריכה), `deletingVariant` (אישור-מחיקה), `duplicating`, `onDuplicate` — **פעולת-השכפול**: `onDuplicate` על שורה יוצרת וריאנט חדש (מ-built-in או מוריאנט קיים) ופותחת את ה-Sheet ממולא-מראש.

**מה המשתמש עורך בעת שכפול:** שם (אופ׳), רוחב, גובה, עומק, צבע-תצוגה. ה-`baseType` יורש מהמקור. שכפול אלמנט-מובנה יוצר **וריאנט אישי חדש** (המובנה נשאר לקריאה-בלבד).

---

## 5. מקבילה: עורך סמלי-CAD (אותו דפוס)

`utils/CustomSymbolManager` (+`CustomCadSymbol`,`CustomSymbolShape`), `ui/plan/CadSymbolLibrary` — מהמדריך: *"עורך תאום לעורך הקטלוג, אך לסמלי ה-CAD: שדה חיפוש, רשימה מקובצת לפי קטגוריה (וקבוצת **הסמלים שלי** בתחתית לסמלים מותאמים אישית), ולכל סמל — עריכת רוחב/גובה/עומק וצבע, עם תצוגה מקדימה חיה."* + "אפס" (סמל בודד) / "אפס הכול" (עם אישור). מפתח `KEY_SYMBOLS`.

**תובנת-מפתח לחיקוי:** הדפוס האחיד של CVSM ל"ספרייה אישית" = **רשימה מקובצת-לפי-קטגוריה + קבוצת-'שלי' בתחתית + שורה עם שכפול/עריכה/מחיקה + Sheet-עריכה + reset**. זה בדיוק המבנה שבנינו ל-`ElementLibraryScreen`.

---

## 6. מה זה אומר ל-Soline (מומש ב-Part 2)
1. **`CatalogVariant` → `ElementDef` שלנו** — מיפוי ישיר: `baseType`→(המקור), `name`→`he`, `widthMm/heightMm→`—, `depthMm`→`defaultDepth`, `colorArgb`→(עתידי). הוספנו `ordxClass/ordxType` (יורשים מה-base) כדי שהווריאנט **ייוצא נכון ל-ORDX** — יתרון על CVSM שלא חושף מיפוי-ORDX למשתמש.
2. **שני-מנגנונים = מיותר לנו כרגע** — אנחנו מאחדים: כל התאמה-אישית = **וריאנט/אלמנט-מותאם** (CustomElementStore). מובנה = קריאה-בלבד + שכפיל.
3. **אחסון:** SharedPreferences + JSON-list — זהה ל-CVSM, מיושר ל-`data/Prefs.kt` שלנו (offline-first).
4. **UX:** אימצנו "רשימה מקובצת + שורת-שכפול 📋 + עורך-Sheet + 'צור על בסיס קיים'" — הדפוס האחיד של CVSM.

> READ-ONLY על ה-APK/dex. לא נגעתי בקוד-מקור של CVSM. קובץ-md זה + קבצי Part 2 בלבד נכתבו.
