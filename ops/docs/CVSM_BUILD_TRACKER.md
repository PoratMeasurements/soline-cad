# CVSM_BUILD_TRACKER — מעקב-בנייה: העברת פיצ'רים מ-CVSM ל-Soline Measure

> **מקור-אמת להתקדמות.** מפעל-הפיצ'רים בונה פיצ'ר-אחד-בכל-ריצה, לאט ולעומק, עד סיום-מלא + BUILD SUCCESSFUL, בלי רגרסיה.
> **סדר-העבודה:** לפי `CVSM_ANALYSIS.md` §5 (Top-20, סדר-בנייה מומלץ) ואז שאר §4. כל פריט נסמך על עוגן-מדריך (`cvsm_reference/CVSM_guide_he.html`).
> **בנייה-מקומית לאימות-קומפילציה:** `C:\android-dev\soline-measure` · `JAVA_HOME=C:\android-dev\jdk-17.0.20+8` · `C:\android-dev\gradle-8.9\bin\gradle assembleDebug`.
> נוצר 2026-08-21.

מקרא: ✅ הושלם · ◐ חלקי/בהמשך-דורש-סיום · ⬜ טרם-התחיל.

**התקדמות: 4 / 24 הושלמו** (אשף-תבניות #1 · קיר-קשת #תשתית · סגנון-ראש-קיר #11 · סמלי-CAD #2).

---

## שלב-הליבה (§5 Top-20 — סדר-בנייה)

- [✅] **1. אשף תבניות-חדר** (מלבן/L/U/T/Z + נגזרים) — `#f-plan-wizard`
  - קבצים: `geometry/RoomTemplates.kt`, `ui/template/` (batch-1).
  - **DEFERRED:** שרטוט-מודרך עם ירי-לייזר-לכל-קיר (`#f-plan-wizard` "בוחר-קיר→יורה") טרם-מחובר לזרימת-הלייזר החיה; סיבוב-90°/שיקוף מלא לאימות.
- [✅] **(תשתית) קיר-קשת (Arc wall)** — `geometry/ArcWall.kt` (batch-1).
  - **DEFERRED:** לכידת-קשת-3-נקודות דרך לייזר-3D (`#f-plan-3dcapture` קשת) טרם-מחוברת.
- [✅] **2. 25 סמלי-CAD + מותאמים** (תוכנית+חזית) — `#f-cad-symbol` / `#f-elev-cadsymbol`
  - קטלוג+ציור: `catalog/CadSymbolCatalog.kt` (25 סמלים, 4 קטגוריות + "הסמלים שלי"), `ui/cad/symbols/SymbolGlyphs.kt` (ציור-וקטורי לכל סמל, תוכנית+חזית נפרדות).
  - חנות-מותאמים (Room): `data/SymbolModel.kt` (`CustomSymbolEntity` + `CustomSymbolStore`), מיגרציה 4→5 (`CREATE TABLE custom_symbols`, אפס-מחיקת-נתונים), `SolineDao`/`Repo` (CRUD).
  - לוח: `ui/cad/symbols/CadSymbolPalette.kt` — בורר דו-שלבי קטגוריה→סמל, מתג תוכנית/חזית, תצוגה-מקדימה חיה, "סמל חדש" (5 צורות-בסיס + תווית + מידות), מחיקת-מותאם. חובר ל-`ui/AppUi.kt` (נתיב `symbols` + כפתור ב-`RoomScreen`).
  - **DEFERRED (Follow-up):** הצבת-סמל בפועל על קנבס-התוכנית/החזית (גרירה/סיבוב/גודל/כיתוב ▲▼◀▶/היפוך, מיקום X/Y מ"מ) + ציור ב-PDF/‏.sol. כרגע הלוח מעיין/יוצר/מנהל + מדגים; בחירת-סמל מאשרת בטוסט. ראה §"רשומת-ריצה".
- [⬜] **3. מדידה-רציפה בחזית** (צד→מרחק→גובה→קו-אנכי) — `#f-elev-cadflow`
  - יעד: `ui/elevation` + `ui/cad`. מאמץ M.
- [⬜] **4. דיאלוג 3-גבהים** (10/90/200ס"מ, 3-קווים) — `#f-meas-triple`
  - יעד: `ui/measure` + חזית + דוח. מאמץ M.
- [⬜] **5. חלונות רוחב-אוטומטי** (שמאל+ימין→רוחב) — `#f-elev-lr`
  - יעד: `ui/fields/ElementMeasureFields`. מאמץ S.
- [⬜] **6. מדידה-מהירה 4-יריות לאביזר** (X6) — `#f-elev-add`
  - יעד: `ui/elevation/add` + `device/LaserBle`. מאמץ M.
- [⬜] **7. ריבוע-מהיר** (2-לחיצות) — `#f-plan-box`
  - יעד: `ui/draw`. מאמץ S.
- [⬜] **8. מרחק-בין-קירות + הזז-A/B** — `#f-wall-dist`
  - יעד: `ui/resize`. מאמץ S.
- [⬜] **9. נראות-לפי-סוג (3-מצבים 👁/📏/🚫)** — `#f-plan-vis` / `#f-elev-vis`
  - יעד: `ui/elevation` + `ui/canvas`. מאמץ M.
- [⬜] **10. מסמכי-פרויקט (📷/🖼️/📄)** — `#f-proj-docs`
  - יעד: `data` + `ui/home`. מאמץ M.
- [✅] **11. סגנון-ראש-קיר מלא (5-סוגים+Peninsula)** — `#f-wall-topstyle`
  - מנוע+תצוגה: `geometry/WallHeadProfile.kt`, `ui/wallhead/WallHeadStyleScreen.kt` (batch-1).
  - **הושלם (ריצה נוכחית):** שמירה-פר-קיר דרך מיגרציית-Room 3→4 (3 עמודות ב-`walls`), עריכה-וטעינה-חוזרת מ-`WallScreen`, תווית-סגנון גלויה בכרטיס-הקיר. ראה §"רשומת-ריצה".
- [⬜] **12. כלי-פינה: פילטה/פינה-מעוגלת** — `#f-wall-corner`
  - יעד: `geometry/WallCloseTools`. מאמץ M. (משולש-הזהב כבר ✅ ב-StationSolver.)
- [⬜] **13. יישור-חדר-לציר** (+סיבוב-CAD-איתו) — `#f-wall-axis`
  - יעד: `geometry` + `ui/canvas`. מאמץ M.
- [⬜] **14. ארכיון-פרויקטים** — `#f-proj-archive`
  - יעד: `data` + `ui/home`. מאמץ S.
- [⬜] **15. תמונות-קיר per-חזית** — `#f-elev-photos`
  - יעד: `ui/elevation` + `data`. מאמץ S.
- [⬜] **16. הגדרות-תצוגה מאוחדות + קווי-מידה-פירמידה** — `#f-set-layout` / `#f-set-dimtiers`
  - יעד: `ui/settings` + ייצוא. מאמץ L.
- [⬜] **17. טבלאות-לוח בדוח-HTML (+חומר+סטטוס)** — `#f-exp-html` (§3)
  - יעד: `export/HtmlExporter`. מאמץ M.
- [⬜] **18. הטמעת viz_engine בדוח-HTML + WebView** — `#f-exp-html` (HANDOFF §5)
  - יעד: `export` + WebView. מאמץ L.
- [⬜] **19. פאנל-מאפייני-קיר מלא (לחיצה-ארוכה)** — `#f-wall-panel`
  - יעד: `ui/resize`/`ui/canvas`. מאמץ M.
- [⬜] **20. הערות-קבועות (רשימה, לחיצה-אחת)** — `#f-set-notepresets`
  - יעד: `ui/settings` (המודל `FieldNote`/`NoteRole` כבר-קיים). מאמץ S.

## שלב-משלים (§4 יתר — לאחר ה-Top-20)

- [⬜] **21. לשוניות-סרגל-צד לרוחב (🧱/📐/👁)** — `#f-plan-railtabs` / `#f-elev-railtabs`. מאמץ L.
- [⬜] **22. תצוגת-רשת-חדרים עם מיני-שרטוט** — `#f-room-grid`. מאמץ S.
- [⬜] **23. מסך "מה-חדש"/אודות** — `#f-gen-welcome` / `#f-gen-about`. מאמץ S.

---

## רשומת-ריצות

### ריצה 2026-08-21 — פיצ'ר #2: 25 סמלי-CAD + מותאמים (תוכנית+חזית)
**מה נעשה:** נבנה מפעל-סמלי-ה-CAD מקצה-לקצה (מנוע-טהור + Room + Compose), אדיטיבי ובלי-רגרסיה:
- `catalog/CadSymbolCatalog.kt` — נתונים-טהורים: 25 סמלים מובנים בדיוק לפי המדריך (מולטימדיה-וחשמל 8 · ריהוט 6 · מוצרי-חשמל-ואינסטלציה 6 · מבניים 5), 5 קטגוריות (כולל "הסמלים שלי"), `CadSymbolShape` (5 צורות-בסיס), `CadSymbolView` (PLAN/ELEVATION), ומיזוג-תצוגה `allWith`/`byCategoryWith`/`ofWith` (תואם-דפוס `ElementCatalog`).
- `ui/cad/symbols/SymbolGlyphs.kt` — ציור-וקטורי (Canvas/DrawScope) לכל 25 הסמלים + 5 צורות-הבסיס, עם **תצוגת-תוכנית ותצוגת-חזית נפרדות** (מדריך #f-elev-cadsymbol: "טלוויזיה מצוירת עם מסך ומעמד, לא הפרוסה השטוחה").
- `data/SymbolModel.kt` — `CustomSymbolEntity` (Room) + `CustomSymbolStore` (Room-backed: Flow<List<CadSymbolDef>>, add/delete, ייצור-מפתח יציב, המרות Entity↔Def).
- `data/SolineDatabase.kt` — גרסה 4→5 + `MIGRATION_4_5` (`CREATE TABLE custom_symbols`, אפס-מחיקת-נתונים; נרשמה ב-`addMigrations`). `data/SolineDao.kt` + `data/Repo.kt` — CRUD לסמלים.
- `ui/cad/symbols/CadSymbolPalette.kt` — לוח: בורר דו-שלבי (צ'יפי-קטגוריה→רשת-סמלים), מתג תוכנית/חזית, תצוגה-מקדימה-חיה לכל אריח, FAB "סמל חדש" (דיאלוג צורה+תווית+רוחב/גובה/עומק עם תצוגה-מקדימה כפולה), מחיקת-מותאם בלחיצה-ארוכה.
- `ui/AppUi.kt` — נתיב `symbols` + `SymbolPaletteHost`; כפתור "🔣 סמלי CAD (25 + מותאמים)" ב-`RoomScreen`.
**עוגן-מדריך:** `#f-cad-symbol` (תוכנית) + `#f-elev-cadsymbol` (חזית).
**מיגרציה:** נשמרת-נתונים (CREATE TABLE בלבד); `fallbackToDestructiveMigration` נשאר כרשת-ביטחון.
**BUILD:** BUILD SUCCESSFUL (assembleDebug · KSP/Room עבר).
**Follow-up:** הצבת-הסמל בפועל על קנבס-התוכנית/החזית (מיקום X/Y מ"מ, גרירה/סיבוב/גודל, כיתוב-אוטומטי + צ'יפי-צד ▲▼◀▶/היפוך, ידיות-גודל) — ישות-הצבה חדשה `PlacedSymbolEntity` פר-חדר/קיר + ציור ב-`RoomPlanCanvas`/`WallElevationUnified` וב-PDF/‏.sol. גם: "ברירות-מחדל לסמלים" (#f-set-symboldefaults) ושכבת-נראות (#9).

### ריצה 2026-08-21 — השלמת פיצ'ר #11: שמירת סגנון-ראש-קיר (persistence)
**מה נעשה:** batch-1 בנה את מנוע-סגנון-הראש (`WallHeadProfile.kt`) ותצוגה-מקדימה (`WallHeadStyleScreen`) אך ללא-שמירה. ריצה זו סגרה את ה-DEFERRED:
- `data/Entities.kt` — נוספו ל-`WallEntity` 3 שדות: `headStyle: String = "STRAIGHT"`, `headRidgeMm: Double = 0.0`, `headPeakMm: Double = 0.0`.
- `data/SolineDatabase.kt` — גרסה 3→4 + `MIGRATION_3_4` (ALTER TABLE walls, 3 עמודות עם ברירות-מחדל; אפס-מחיקת-נתונים). נרשמה ב-`addMigrations`.
- `data/SolineDao.kt` — `setWallHead(wallId, style, ridge, peak)` (מקביל ל-`setWallFramePoints`).
- `data/Repo.kt` — `saveWallHead(...)`.
- `ui/wallhead/WallHeadStyleScreen.kt` — פרמטרי-אתחול (סגנון/אורך/בסיס/רכס/פסגה) + `onSave` אופציונלי + כפתור-שמירה (✓) בכותרת; מצב-הדגמה (בלי wall) נשמר תואם-לאחור.
- `ui/AppUi.kt` — נתיב `wallhead/{wid}` + `WallHeadHost(nav, wallId)` שטוען את הקיר ושומר; כפתור "⌂ סגנון ראש קיר" ב-`WallScreen`; תווית "ראש: …" בכרטיס-הקיר (RoomScreen) לסגנון לא-ישר.
**עוגן-מדריך:** `#f-wall-topstyle` (+ניתן-לעריכה מ-`#f-elev-info`).
**מיגרציה:** נשמרת-נתונים (ALTER TABLE בלבד); `fallbackToDestructiveMigration` נשאר כרשת-ביטחון.
**BUILD:** BUILD SUCCESSFUL (assembleDebug).
**Follow-up:** להזרים את הסגנון-השמור לתצוגת-החזית (`WallElevationUnified`) ולתלת-הממד/PDF כך שהראש יצויר בפועל (כרגע נשמר+נטען+נראה-בתווית; הציור-בחזית עדיין משטח).
