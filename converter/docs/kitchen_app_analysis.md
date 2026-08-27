# kitchen_app (elsop / 3D_OrdX.exe) — ניתוח ארכיטקטורה מלא עבור Soline

> מסמך מחקר, 2026-08-14. מקור: `C:\Cabinet Vision\3D_OrdX.exe` (~80MB) — חבילת
> PyInstaller (Python 3.11 / PySide6), ממותגת **elsop**, בשם פנימי `kitchen_app`.
> חילצתי את ה-PyInstaller archive → PYZ (3856 מודולים, מתוכם **53 מודולי `kitchen_app`**),
> פענחתי את ה-code objects של Python 3.11 (marshal) וקראתי את ה-docstrings + קבועי
> המחרוזות. **קריאה בלבד; לא שונה שום מקור. לא אוחסן PII. הקבצים שחולצו — scratchpad בלבד.**
> **המטרה: ללמוד ארכיטקטורה ושיטות — לא להעתיק קוד קנייני.** התיאורים כאן הם של הגישה, לא lift.
> קרא קודם את `docs/cabinet_vision.md` (רקע ORDX + Cabinet Vision).

---

## 0. תגלית-על: מאיפה בא הקוד

שני docstrings חושפים את השורש הארכיטקטוני:

- `ordx_exporter`: *"Reproduces the exact XML structure emitted by the proven Android
  **RoomMeasure** app (`com.roommeasure.app.export.OrdxExporter`), verified
  byte-for-structure against real exported `.ordx` files."*
- `models`: *"Wall / Room / Project models mirror the proven Android **RoomMeasure**
  app (`com.roommeasure.app.model`) so that geometry and ORDX export behave identically."*

כלומר **ליבת הגאומטריה + ה-ORDX פורטה מאפליקציית אנדרואיד למדידת חדרים** (RoomMeasure),
ועליה נבנתה אפליקציית שולחן-עבודה (PySide6) שמוסיפה: קטלוג ארונות (SQLite), סוכן AI,
ורינדור Blender. זה בדיוק המבנה ש-Soline מכוונת אליו — **הפרדה בין ליבת מדידה/גאומטריה
מוכחת לבין שכבות עיצוב/AI/רינדור מעליה.**

---

## 1. הצינור המלא (End-to-End Pipeline)

```
InnoDraw/RoomMeasure ORDX  ──►  ordx_room_importer  ──►  ProjectScene (models.py)
   (מדידת חדר: קירות,                                        │
    חלונות, דלתות)                                           ▼
                                        ┌────────────────────────────────────┐
                                        │  UI designer (PySide6):            │
                                        │  plan_view / elevation_view /      │
                                        │  viewport_3d (OpenGL live)         │
                                        └───────────────┬────────────────────┘
                                                        │
              ┌─────────────────────────────────────────┼──────────────────────────┐
              ▼                                          ▼                          ▼
   AI Agent (chatgpt_agent)                    catalog_service (SQLite)     rendering
   "מה" לשים  ──► agent_api (tools)            catalog.sqlite:              3 מסלולים:
                    │                          ארונות/אביזרים/חומרים        (א) OpenGL live
                    ▼                                                       (ב) Blender Cycles
             layout_solver                                                 (ג) AI photoreal
             "איפה" בדיוק (wall-local)                                     (gpt-image-1)
                    │
                    ▼
              ProjectScene ──► ordx_exporter ──► ORDX עם <Assemblies>  ──►  Cabinet Vision
              (project_io: save/load JSON)        (ארונות מלאים!)            (Import Order)
```

**מיפוי מודול↔שלב:**

| שלב | מודול(ים) |
|------|-----------|
| ייבוא מדידה | `core.ordx_room_importer` (מחזיר `OrdxProject/OrdxRoom/OrdxWall/OrdxFixture/OrdxAssembly`) |
| מודל נתונים | `core.models` (`ProjectScene`, `Room`, `Wall`, `SceneObject`, `Opening`, `Accessory`, `CatalogItem`) |
| שמירה/טעינה | `core.project_io` (`save_project`/`load_project` → JSON) |
| קטלוג | `core.catalog_service` + `core.database` (SQLite: `catalog_items`, `accessory_items`) |
| עורך גרפי | `ui.designer.plan_view`, `elevation_view`, `viewport_3d` (OpenGL) |
| סוכן AI | `ai.chatgpt_agent` (LLM), `ai.agent_api` (tools/CRUD), `ai.layout_solver` (הצבה דטרמיניסטית), `ai.config` |
| רינדור | `ui.designer.scene_export` (bake), `core.blender_service`/`blender_render` (Cycles), `core.ai_render` (gpt-image-1) |
| ייצוא | `core.ordx_exporter` → ORDX ל-Cabinet Vision |
| טעינת מודלים 3D | `core.dae_loader`, `dxf_loader`, `model_loader` (DAE/Collada + DXF) |
| רישוי | `core.licensing.{check,cpu_id,crypto}` (trial, נעילה ל-CPU) |

---

## 2. מחולל ה-Assembly ל-ORDX  ★ הפער הקריטי אצלנו ★

זהו החלק היקר ביותר — איך kitchen_app כותב **ארונות** (`<Assemblies><Assembly>`)
ש-Cabinet Vision מקבל. המחלקה `OrdxExporter` (ב-`core.ordx_exporter`).

### 2א. השלד והסדר
`export()` בונה: `<?xml?>` → `<!-- CV ORDX Order XML File -->` → `<Job Created="dd/mm/YYYY HH:MM:SS">`
→ `<ProductVersion>2023</ProductVersion>` → `<Unit>mm</Unit>` → `<Properties>` (Job/Customer/ShipTo)
→ `<Rooms><Room>` → `<RoomProperties>` → `<Walls>` → **וכל פריט מקונן בתוך הקיר שלו**.
פורמט צף = **3 ספרות עשרוניות** (`_f` = `.3f`). Angle = `-atan2(endY-startY, endX-startX)`
במעלות (CV הוא Y-up, התוכנית Y-down → היפוך סימן).

### 2ב. **הבחנה קריטית: פריטים מקוננים בתוך `<Wall>`, לא ברמת Room**
בניגוד למה שהנחנו ב-`cabinet_vision.md` (Assemblies כאח של Walls), **המימוש בפועל של
kitchen_app מקנן כל ארון/אביזר בתוך ה-`<Wall>` שאליו הוא מחובר**, בקואורדינטות
wall-relative: `X` = מרחק מתחילת הקיר לקצה השמאלי של הפריט, `Y` = גובה תחתית הפריט מהרצפה,
`Z` = מרחק מפני הקיר (נכתב רק אם הגב לא נוגע בקיר). *(`basic.ordx.xml` מראה `<Assemblies>`
ריק כאח של `<Walls>` — זו התבנית הריקה; המימוש המלא מקנן בתוך הקיר.)*

### 2ג. שלושת מסלולי כתיבת פריט
`_wall()` קורא לפי סוג הפריט:
- **`_fixture` / `_furnishing` / `_opening_furnishing`** — חלונות/דלתות/פתחים/הערות
  (Fixture/Furnishing). דלת/חלון: `Z = -depth_mm` (CV משקע אותם לתוך גוף הקיר).
  `EntryDoor`/`Window`/`Passage` הם `opening_type`. הערת-טקסט → Fixture בשם `הערה`
  עם `<Comment>` (round-trip מיוחד מול ה-importer).
- **`_accessory_assembly`** — אביזר קטלוגי כ-`<Assembly>` פשוט.
- **`_cabinet_assembly`** — ★ הארון עצמו ★. שני תת-מסלולים:

### 2ד. שיטת התבנית (Template) — הליבה
> *"Every cabinet must be attached to a wall."* ארון צף (בלי `wall_id` וגב רחוק מעבר
> ל-`FLOATING_TOLERANCE_MM` מכל קיר) → `OrdxExportError` (לא ייצוא שגוי שקט).

לכל פריט קטלוג יש **בלוק `<Assembly>` שנלכד מ-ייצוא CV אמיתי** של אותו ארון
(`templates_by_item_id: dict[item_id → raw Assembly XML]`). ב-`_assembly_from_template`:
1. הבלוק נכתב **מילה-במילה** (catalog, materials, doors, sections, parameters נשמרים).
2. רק `<Size>` (Width/Height/Depth) ו-`<Position>` מוחלפים.
3. **retune** של הגאומטריה הפנימית למידה החדשה (ראה 2ה).
4. `<WallFace>Back</WallFace>`, `<Toe><ToeHeight>`, ו-`<Attributes><Parameter><Name>COMMENT</Name><Type>T</Type>`
   (upsert/remove לפי `_set_assembly_comment`).

הפריט מפנה לקטלוג CV מקודד-קשיח: קבועים `CABINET_CATALOG`, `ACCESSORY_CATALOG`,
`_CABINET_CLASSES`, `_ORDX_CLASS`. `<Description>Standard <class> Cabinet</Description>`.

### 2ה. מנוע ה-retune (המתמטיקה של Cabinet Vision) ★
זהו הפער הקריטי מס' 1 שלנו. שלוש פונקציות, כולן מאומתות מול ground-truth
(ייצואי CV של אותו ארון 3-דלתות שווה ב-**1570mm מול 960mm**):

- **`_retune_axis`** — *"Cabinet Vision keeps every reveal, gap and partition thickness
  constant and gives each door/drawer column an equal share of the size change. Every
  split position then shifts by (columns fully to its left) × share, and every
  face/opening dimension grows by (columns it spans) × share."* חלוקה שווה של הפרש-המידה
  בין העמודות; שמירת reveals/מרווחים/עובי-מחיצות קבועים.
- **`_retune_sections`** — מיישם את זה על `<Sections>/<Section>` (רוחבי דלתות, מיקומי
  Split, פתחים פנימיים Face1/Face2/Open1/Open2 לפי `_split_faces` regex `(?:Face|Open)(\d+)`).
- **`_retune_cab_params`** — מרענן מחרוזות פרמטר קומפקטיות ב-`<AdditionalParts>`:
  `CABDims` = `'DX1570,DY888,DZ600'`, `CABPos` = `'X...,Y...,Z...'`. רק ערכי THEN
  מצוטטים נכתבים מחדש; `<THEN>0</THEN>` fallback נשאר. פורמט קומפקטי דרך `_fc`
  (`'DX1570'`, `'X304.6'` — rstrip של אפסים).

**בלי retune** — *"a resized cabinet exports with the template's original door widths
and split positions"* (באג הדלת-בגודל-שגוי).

### 2ו. סידור קירות
`reorder_walls_for_cabinet_vision` — מתחיל מהקיר העליון (Y מינימלי) ובוחר חוזרות את
הקיר הבא שנקודת-הקצה הקרובה שלו מתחברת לנקודת-הסיום הנוכחית (perimeter chaining).
בלי זה CV לא משחזר את החדר. תומך גם `<Curve>` (קיר מעוקל: Radius/ArcAngle/Begin/End/Center)
ו-`WallEnd`, `Style` (Standard/Peninsula/Cathedral/VaultLeft/VaultRight).

---

## 3. סוכן ה-AI

ארכיטקטורה בשלוש שכבות (מה-docstring של `layout_solver`):
```
AI Layer (LLM)      → מחליט WHAT ("מלא את הקיר בארונות בסיס")
Solver Layer (Py)   → מחליט WHERE בדיוק (wall-local distance + collision)
Scene Layer         → מאחסן את האובייקטים הסופיים
```

### 3א. `chatgpt_agent.ChatGPTAgent` — שכבת ה-LLM
- **דו-ספק**: OpenAI (ChatGPT/Azure) **וגם** Anthropic (Claude), מתחלפים. סכימת כלים
  אחת (`FUNCTIONS`, בסגנון OpenAI) מתורגמת ל-Anthropic ע"י `_build_anthropic_tools`
  (רק `parameters`↔`input_schema` משתנה).
- **tool-calling loop** (`_run_anthropic_loop` / OpenAI completions): LLM מחזיר קריאות-כלי,
  Python מבצע, מחזיר `tool_result`, חוזר עד תשובה סופית.
- **חוסן** — לקחים חשובים ל-Soline:
  - `_safe_anthropic_trim_index` — חיתוך history בלי לשבור זוג `tool_use`/`tool_result`
    (טעות trim-לפי-אורך-נאיבי שוברת את ה-API).
  - `_is_broken_tool_pairing_error` + self-healing retry — מזהה שגיאת 400 של pairing
    ומריץ מחדש על history נקי (`_send_with_room_context` מופרד בדיוק לשם כך).
  - `_model_not_found_message` — מזהה 404 של מודל שהוסר (snapshot מתוארך) ומחזיר הודעה ברורה.
- **System Prompt** (מתוך הקוד, מקוצר): *"You are an in-app kitchen design Copilot.
  Python tools perform all geometry, snapping, collision checks, and validation. Never
  invent catalog SKUs. Never claim success unless a tool result says success=true."*
  כולל workflow מפורש (get_room_state לפני שינוי; list_available_cabinets לפני הצבה)
  וגלוסר עברי (עליון/תחתון/גבוה, כיור, מדיח, תנור/כיריים, פינתי, מגירות, ויטרינה, מגירת-בקבוקים).

### 3ב. `agent_api.KitchenDesignAgent` — משטח הכלים (v3.0)
CRUD מלא, כל מתודת-שינוי מחזירה `(success, message, data)`. הכלים (חלקי):
`get_room_state, list_available_cabinets, search_cabinets, recommend_cabinet_for_space,
calculate_available_space_on_wall, place_cabinet(_on_wall/_snapped), resize_cabinet,
move_cabinet, remove_cabinet, align_cabinet_next_to, extend_cabinet_to_wall_end,
stack_cabinet_above, apply_wall_layout, fill_wall_with_base/wall_cabinets,
equalize_cabinet_widths, duplicate_cabinets, snap_cabinet_to_neighbor, add_wall/arc_wall,
modify_wall, add_window, add_door, place_accessory, remove_accessory, set_cabinet_finish,
set_cabinet_door_finish, list_available_materials, create_room, validate_scene/collisions/layout`.
`resolved_class` מוחזר תמיד (מעקף לעמודת `cabinet_class` הלא-אמינה ב-DB).

### 3ג. `layout_solver.LayoutSolver` — ההצבה הדטרמיניסטית ★
- **wall-local coordinates**: `WallAxis.point_at_distance(distance_mm, offset)` ממיר
  מרחק-לאורך-הקיר → XY עולמי. הכול נעשה במרחק מתחילת הקיר, לא ב-XY גולמי.
- **interval analysis**: `WallInterval` (blocked/free), `get_blocked_intervals` (סורק
  openings + objects + **accessories**), `get_free_segments`, `find_nearest_free_position`.
- **collision-aware**: `opening_interval_on_wall` — דלת חוסמת תמיד; חלון חוסם Wall/Tall
  תמיד ו-Base רק אם ה-top עובר את ה-sill.
- **`classify_cabinet_class`** — מסווג יחיד ומשותף ל-base/wall/tall/appliance (שם/קטגוריה/
  SKU/DB/גובה), כדי שה-AI תמיד יראה בדיוק את המחלקה שתשמש בהצבה בפועל.
- **`describe_cabinet_role`** — `ROLE_KEYWORDS` (sink/dishwasher/corner/drawers…) למניעת כפילויות.
- **`apply_wall_layout`** — **batch**: מציב קיר שלם בקריאה אחת (מנקה קיים אלא אם
  `keep_cabinet_ids`), best-effort (פריט שלא נכנס מדולג ומדווח). נבנה כי עריכה
  איטרטיבית שורפת את תקציב הקריאות-לתור. **זו שיטה מרכזית לאמץ.**
- `place_accessory_on_wall` — אותה מכונת-גאומטריה לאביזרים (שקע/מים/גז/מיזוג/ניקוז).

> הערה: `design_rules_il.json` מציין ש-`place_accessory` ו-סריקת accessories הם "gap"
> עתידי — אבל **הקוד בפועל כבר מיישם אותם**. קובץ החוקים הקדים את המימוש; ה-app התקדם.

---

## 4. חוקי העיצוב — `design_rules_il.json`  ★ זהב לספריית Soline ★

קובץ נתונים (`kitchen_app/data/`) שמזין את ה-AI. מכוון מפורשות ל-`models.py` +
`agent_api.py`. כל חוק נושא `source_type` (רמת-ביטחון): `sii_standard` (מחייב),
`sii_accessibility` (ת"י 1918), `israeli_trade_practice` (מקובל, לא-מחייב),
`app_existing_logic` (כבר בקוד), `proposed_extension` (עתידי). הכול ב-mm.

**תקנים**: ת"י 1271 ח"11 (ארונות מטבח — חומר/גימור/סימון, לא מידות), ת"י 1918 ח"3.1
(נגישות בסיסית), ת"י 1918 ח"5.2 (דיור נגיש), חוק החשמל (מעגל תנור ייעודי, מינ' 3 שקעים).

**ברירות-מחדל ארונות** (`cabinet_defaults`):
| מחלקה | width | height | depth | elevation | toe |
|-------|-------|--------|-------|-----------|-----|
| Base | 600 | 870 | 600 | 0 | 100 (עומק 75) |
| Wall | 600 | 800 | 600 | 1450 | — |
| Tall | 600 | 1820 | 600 | 0 | — |
| Appliance | 600 | 870 | 600 | 0 | — |

משטח מוגמר = **900mm** (870 ארון + ~30 שיש). מרווח מתחת לארון-קיר מעל השיש = **550mm**
(1450−900). אורך משטח-עבודה מינ' = 1800.

**ארגונומיה**: משולש-עבודה 1200–2700 לצלע; כיור↔כיריים ≥900 (מומלץ 1000);
מדיח↔כיור ≤900 מרכז-למרכז; שבב דלת ≥760; מעבר 1200 רגיל / **1500 נגיש** (כיסא-גלגלים);
אי: מרווח 1100 (1300 עם ישיבה דו-צדדית), בר 1100, ברך 350; כיור תקני 800×425, עומק 190–230.

**פתחים**: חלון default 1200×1200, sill 900 (מיושר לגובה השיש); דלת 900×2100, sill 0.

**אביזרי-קיר** (elevation מומלץ): שקע 1100 (20mm מעל השיש), שקע-מקרר 1600–1800,
מעגל-תנור ייעודי (מחייב), מים 550–600, ניקוז 400–450, ניקוז-רצפה 100–200, גז 500,
מזגן 2200, נפילת-תקרה-AC 2450.

**רמזי-פרשנות עברית** (`customer_request_interpretation_hints`): "מטבח נגיש/לנכה" → מעבר
1500 + ת"י 1918; "אי במטבח" → מרווחי אי; "משולש עבודה"; "קו ישר" (galley); "מטבח פתוח לסלון".

**known_gaps** (הודאות עצמיות שימושיות): עמודת `cabinet_class` ב-DB לא-אמינה (השתמש
ב-`resolved_class`); שני ברירות-מחדל סותרות לגובה-שקע (300 ב-DB seed מול 1100 בקוד).

---

## 5. צינור ה-Blender + הרינדור

שלושה מסלולי רינדור (fallback מדורג — האפליקציה standalone, Blender אופציונלי):

### 5א. `scene_export.SceneExporter` — ה-bake ★
מייצר 3 קבצים בתיקיית-יעד:
- **`scene.obj`** — כל משולש נראה, ב-mm, **Y-up**, מקובץ לפי material, עם normals+UVs.
  נבנה דרך **אותם code paths של ה-viewport החי** (אותו DAE loader, אותו finish-override
  cascade, אותו door-float/depth scaling, אותו box-mapped UV fallback) — כדי שהתוצאה
  הפוטו-ריאליסטית תמיד תואמת למסך.
- **`scene.mtl`** — MTL מינימלי (diffuse/texture) כדי שה-OBJ תקף לבד.
- **`scene.json`** — כל מה שאינו גאומטריה: **camera** (תואם למבט ה-orbit החי), **lighting rig**,
  **background preset**, וטבלת-material לכל חומר (color, texture, glass, roughness) שממנה
  צד-Blender בונה **Principled BSDF**.

תיקון קריטי: `_add_tri` מתקן winding לפי normal הצללה (Cycles משתמש ב-normal גאומטרי →
משולש הפוך = פאה שחורה לא-מוארת — "black walls/floor bug"). `glass:<percent>` → alpha
(`glass:25` → 0.75 אטימות). Gloss slider 0..1 → Principled roughness.

### 5ב. `blender_service` — "warm renderer" ★ שיטה חכמה
Blender headless יחיד רץ ברקע כל חיי-האפליקציה (`blender_script.py --serve`), כי
ה-startup (boot+init+add-ons+GPU kernel compile) עולה 5–20 שנ'. פרוטוקול: השרת מדפיס
`KA_READY`, מקבל job JSON אחד לשורה ב-stdin, עונה `KA_DONE`/`KA_ERROR`, ובאמצע פלט
"Sample x/y" של Cycles מניע progress callback. `warmup()` — רינדור-דמה 8×8px/sample-1
כדי לקמפל kernels ב-idle. jobs מסודרים ב-lock; cancel הורג את התהליך (Cycles לא עוצר
באמצע frame).

### 5ג. `ai_render` — פוטו-ריאליזם דרך AI
`generate_photoreal_image` — לוקח snapshot של ה-OpenGL (מצלמה/פריסה/צבעים/חומרים
מדויקים) ושולח ל-**`gpt-image-1`** (image-edit) כדי לרנדר-מחדש כתצלום-פנים. משתמש
במפתח OpenAI שכבר מוגדר לעוזר (דורש OpenAI — Anthropic לא מציע יצירת-תמונות). blocking →
worker thread.

`blender_render`: `find_blender` (Settings → PATH → מיקומי-התקנה סטנדרטיים, חדש-קודם),
`None` אם לא מותקן → נפילה ל-OpenGL/AI. `run_blender_render` מריץ `blender -b` headless.

---

## 6. מבנה הנתונים הפנימי (`core.models`)

- **`ProjectScene`** — שורש: `rooms`, `active_room`, `units` (mm). `project_io` שומר/טוען JSON.
- **`Room`** — `walls[]`, `objects[]` (ארונות), `openings[]`, `accessories[]`, `text_notes[]`.
- **`Wall`** — `start/end (x,y mm)`, `length`, `angle_deg` (0=+X, CCW חיובי), `height_mm`,
  `thickness_mm`, `soffit`, מעוקל (`curve_radius/arc/begin/end/center`), `is_contour`, `is_end_wall`.
- **`SceneObject`** (ארון מוצב) — `x_mm/y_mm` = **מרכז** (לא קצה-שמאל של ORDX!),
  `wall_id`, `width/height/depth_mm`, `elevation_mm`, `catalog_item_id`, finishes.
- **`Opening`** — `Window`/`EntryDoor`/`Passage`, `distance_mm` (קצה-שמאל), `sill_mm`.
- **`Accessory`** — שקע/צנרת/מיזוג (`type_key` תואם `core.accessories.AccessoryType`).
- **`CabinetClass`** enum: Base/Wall/Tall/Appliance, עם `default_size`/`default_elevation`.
- **`CatalogItem`** — פריט קטלוג; `resize_rules_json` עם locked dims (מימד נעול = ידיות/
  spinbox מושבתים בעורך). `AccessoryCatalogItem` נפרד.
- **`SnapPoint`** — מיקום-snap בשם על מודל קטלוגי (מ"מ מקומי).
- גימור: `glass_alpha_from_finish` (`glass:<percent>`), finish-override cascade.

**המרת importer↔scene**: `resolve_ordx_assembly_placement` — ORDX נותן קצה-שמאל, אבל
כל צרכני ה-scene מניחים **מרכז**; `<WallFace>Back</WallFace>` = מקרה מיוחד (CV מודד
`position_x` מקצה-הקיר ולא מהתחלה, כי מאחור "שמאל" מראה-הפוך) — מאומת מול `corner.ordx` אמיתי.

---

## 7. חיבור לסוכנים האחרים של Soline — מה כל אחד לוקח

### → סוכן ORDX / Cabinet Vision (מחולל ה-Assembly)
1. **אמץ את שיטת-התבנית**: אחסן לכל פריט-קטלוג של Soline בלוק `<Assembly>` שנלכד
   מייצוא CV אמיתי; בהצבה החלף רק `<Size>`+`<Position>` + retune. אל תמציא Assembly מאפס.
2. **מנוע retune** (`_retune_axis`/`_retune_sections`/`_retune_cab_params`) — חלוקה שווה
   של הפרש-מידה בין עמודות, reveals קבועים, עדכון `CABDims`/`CABPos`. ground-truth = ייצוא
   אותו ארון בשתי מידות. אפשר להנדס-לאחור מהמודול שחולץ (scratchpad).
3. **קינון בתוך `<Wall>`** (X מקצה-שמאל, Y=גובה-תחתית, Z=off-face), **לא** ברמת Room.
4. **אכיפה**: כל ארון על קיר (`FLOATING_TOLERANCE_MM`, אחרת חריגה), `reorder_walls`
   לפי perimeter (Y-up), `WallFace=Back`, `Toe/ToeHeight`, COMMENT parameter (Type T).
5. **פורמט**: 3 ספרות, `ProductVersion=2023`, `<!-- CV ORDX Order XML File -->`,
   Angle=`-atan2(dy,dx)`. תבנית-בסיס ריקה: `basic.ordx.xml`.

### → סוכן ההדמיות (Blender pipeline)
1. **פורמט bake תלת-קבצים**: `scene.obj` (mm, Y-up, per-material, normals+UVs) +
   `scene.mtl` + `scene.json` (camera/lights/background/Principled-BSDF props). **בנה
   גאומטריה דרך אותם code paths של ה-viewport** כדי למנוע drift.
2. **warm renderer**: Blender headless מתמשך (`--serve`, פרוטוקול `KA_READY`/job-JSON/
   `KA_DONE`), + `warmup` לקמפול kernels ב-idle. חוסך 5–20 שנ' לרינדור.
3. **תיקון winding לפי normal** (מונע פאות שחורות ב-Cycles). `glass:%`→alpha, gloss→roughness.
4. **fallback מדורג**: OpenGL live → Blender Cycles → AI photoreal (`gpt-image-1`).

### → סוכן הספרייה (design rules)
1. **אמץ את `design_rules_il.json` כמעט as-is** — זה בדיוק מבנה-החוקים ש-Soline צריכה:
   ת"י 1271/1918, חוק החשמל, ברירות-מחדל Base/Wall/Tall, ארגונומיה, אביזרי-קיר, פתחים,
   רמזי-עברית. **קריטי: כל חוק עם `source_type`** (מחייב מול מקובל מול עתידי) + `known_gaps`.
2. הקפד למפות כל חוק ל-`models` + לכלי-AI (כמו שהם עשו) כדי שיהיה actionable, לא רק טקסט.

### → סוכן ה-AI (אם Soline תבנה copilot)
ארכיטקטורת 3-שכבות (LLM=WHAT, solver=WHERE, scene=store); סכימת-כלים דו-ספקית אחת;
`apply_wall_layout` batch; `resolved_class`; חוסן tool-pairing/trim/model-404.

---

## 8. טופ-5 השיטות מ-kitchen_app ש-Soline צריכה לאמץ

| # | שיטה | מה זה | מה חוסך |
|---|------|-------|---------|
| **1** | **תבנית-Assembly + retune** (`_assembly_from_template`, `_retune_*`) | ללכוד בלוק ORDX אמיתי מ-CV לכל ארון, ובהצבה להחליף Size/Position + לחלק את הפרש-המידה בין עמודות בשמירת reveals | **הפער החוסם היחיד** בין "חדר ריק" ל"ארונות ש-CV מקבל". חוסך הנדסה-לאחור של פורמט-CV הפנימי ומונע באג הדלת-בגודל-שגוי. הופך את Soline מ"iMapper ישראלי" למחולל-ארונות מלא (רמה B). |
| **2** | **ליבת-גאומטריה מפורטת + wall-local** (פורט מ-RoomMeasure; `layout_solver`) | הפרדת ליבת מדידה/גאומטריה מוכחת (קירות/זוויות/ORDX) מהשכבות מעליה; כל הצבה במרחק-לאורך-קיר + interval/collision | ליבה אחת מוכחת מזינה ייצוא + עורך + AI בלי drift. מונע את מלכודת ה-"XY גולמי" בהצבה ובזיהוי-התנגשות. |
| **3** | **design_rules_il.json מובנה** | חוקי-מטבח ישראליים כ-data עם `source_type`, ממופה ל-model+tools, עם `known_gaps` מפורשים | חוסך חודשי איסוף-תקנים (ת"י 1271/1918, חוק חשמל, ארגונומיה, אביזרים). מוכן-לצריכה ל-AI ולוולידציה. |
| **4** | **warm Blender renderer + bake תלת-קבצים דרך code-paths של ה-viewport** | Blender headless מתמשך (`--serve`/`warmup`) + scene.obj/mtl/json שנבנים באותם מסלולים של המסך | חוסך 5–20 שנ' לכל רינדור, ומבטיח "מה שרואים = מה שמרונדר" (מונע black-faces/drift). fallback מדורג ל-AI כשאין Blender. |
| **5** | **סוכן AI 3-שכבתי דו-ספק + חוסן** (`chatgpt_agent`/`agent_api`) | LLM=WHAT, Python-solver=WHERE; סכימת-כלים אחת ל-OpenAI+Anthropic; batch `apply_wall_layout`; trim/pairing/404-guards | Python אוכף גאומטריה/התנגשות/ולידציה (LLM לא ממציא SKU/הצלחה). דו-ספק מגן מפני retirement של מודל. batch מונע שריפת-תקציב-כלים. |

---

## נספח: מקורות שחולצו (scratchpad בלבד, לא בריפו)

- `scratchpad/mods/*.marshal` — 53 code objects של `kitchen_app` (PYZ מפוענח).
- `scratchpad/decoded/*.json` — docstrings + string/name consts לכל מודול.
- `scratchpad/pyi_out/kitchen_app_data_design_rules_il.json` — חוקי-העיצוב המלאים.
- `scratchpad/pyi_out/kitchen_app_templates_basic.ordx.xml` — שלד ORDX ריק.
- כלים: `pyz_toc.js` (parser ל-PYZ TOC), `decode_marshal.js` (Python 3.11 marshal reader ב-Node), `dump.js`.
