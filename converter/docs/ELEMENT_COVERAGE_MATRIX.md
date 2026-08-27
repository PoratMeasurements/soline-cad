# ELEMENT COVERAGE MATRIX — כיסוי 4-פורמטים לכל טיפוס-אלמנט

> **מקור-אמת:** `app-measure/…/catalog/ElementCatalog.kt` (97 טיפוסים, read-only) · `converter/src/element_symbols_soline.js` (סמלים+NAME_MAP, בבעלותי) · `docs/ordx_item_dictionary.json` (מיפוי-PDP, read-only) · `docs/DXF3D_ELEMENTS.md` (גופי-3D).
> נוצר אוטומטית מ-`resolveKey()` על כל 97 הטיפוסים. לשון זכר · 2026-08-22.

## תקציר
- **טיפוסי-אלמנט:** 97 · **נפתרים לסמל-DXF-2D:** 97 (0 פערי-סמל) ✅
- **פורמטים לכל אלמנט:** DXF-2D (סמל) · ORDX (class/type/name) · DXF-3D (גוף) · PDP (item+bin).
- **מקרא:** ✓=שלם · ⚠=קיים-אך-חלש (קירוב/התנגשות/גנרי) · ✗=חסר (פער-בקלוג).

### חשמל

| element key | he | DXF-2D symbol | ORDX class/type/name | DXF-3D | PDP item | פערים |
|---|---|---|---|---|---|---|
| `SOCKET_SINGLE` | שקע בודד | ✓ `socket_single` | ⚠ Fixture/Miscellaneous/Socket | ✓ תיבה W×D×H | ✓ שקע | ORDX-name משותף ל-2 (`Socket`) |
| `SOCKET_MULTI` | שקע מרובע | ✓ `socket_duplex` | ⚠ Fixture/Miscellaneous/Duplex Socket | ✓ תיבה W×D×H | ✓ שקע | ORDX type גנרי (Miscellaneous) |
| `SWITCH` | מתג | ✓ `switch_single` | ⚠ Fixture/Miscellaneous/Switch | ✓ תיבה W×D×H | ✓ מפסק | ORDX type גנרי (Miscellaneous) |
| `ELECTRICAL_WALL` | תשתית חשמל -קיר | ✓ `junction_cable` | ⚠ Fixture/Miscellaneous/Power Line | ✓ תיבה W×D×H | ✓ צ.חשמל | ORDX-name משותף ל-2 (`Power Line`) |
| `ELECTRICAL_LINE` | תשתית חשמל | ✓ `junction_cable` | ⚠ Fixture/Miscellaneous/Power Line | ✓ תיבה W×D×H | ✓ צ.חשמל | ORDX-name משותף ל-2 (`Power Line`) |
| `ELECTRIC_APPLIANCE` | נקודת מוצר חשמל | ✓ `junction_cable` | ⚠ Fixture/Miscellaneous/Socket | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-2 (`Socket`) |
| `CEILING_LIGHT` | מנורת תקרה | ✓ `light_downlight` | ⚠ Decorative/Miscellaneous/Can Light | ✓ תיבה W×D×H | ✓ תאורה | ORDX type גנרי (Miscellaneous) |

### אינסטלציה

| element key | he | DXF-2D symbol | ORDX class/type/name | DXF-3D | PDP item | פערים |
|---|---|---|---|---|---|---|
| `WATER_PIPE` | מים | ✓ `water_point` | ⚠ Fixture/Part/Water Supply | ⚠ תיבה (רצוי mesh) | ✓ צ.מים | ORDX-name משותף ל-3 (`Water Supply`) · 3D: רצוי mesh-גוף |
| `GAS_PIPE` | גז | ✓ `gas_point` | ⚠ Fixture/Part/Gas | ✓ תיבה W×D×H | ✓ גז | ORDX-name משותף ל-2 (`Gas`) |
| `WATER_PIPE_ROUND` | צינור מים עגול | ✓ `water_point` | ⚠ Fixture/Part/Water Supply | ⚠ תיבה (רצוי mesh) | ✓ צ.מים | ORDX-name משותף ל-3 (`Water Supply`) · 3D: רצוי mesh-גוף |
| `FLOOR_DRAIN` | ניקוז רצפתי | ✓ `floor_drain` | ✓ Fixture/Part/Sewer drainage | ✓ תיבה W×D×H | ✓ פ.ביוב | — |

### מוצרי חשמל

| element key | he | DXF-2D symbol | ORDX class/type/name | DXF-3D | PDP item | פערים |
|---|---|---|---|---|---|---|
| `AC_UNIT` | מזגן | ✓ `ac_indoor` | ⚠ Accessory/Miscellaneous/Air Condition | ⚠ תיבה (רצוי mesh) | ✓ ק.חשמל | ORDX-name משותף ל-5 (`Air Condition`) · 3D: רצוי mesh-גוף |
| `REFRIGERATOR` | מקרר | ✓ `outlet_fridge` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `OVEN` | תנור | ✓ `outlet_oven` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `MICROWAVE` | מיקרוגל | ✓ `outlet_microwave` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `DISHWASHER` | מדיח | ✓ `outlet_dishwasher` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `WATER_BAR` | תמי4 | ✓ `water_bar` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ צ.מים | ORDX-name משותף ל-19 (`DishWasher`) |

### סניטרי

| element key | he | DXF-2D symbol | ORDX class/type/name | DXF-3D | PDP item | פערים |
|---|---|---|---|---|---|---|
| `BATH` | אמבטיה | ✓ `water_point` | ✓ Fixture/Part/אמבטיה | ⚠ תיבה (רצוי mesh) | ✓ מים משולב | 3D: רצוי mesh-גוף |
| `TOILET` | אסלה | ✓ `toilet_waste` | ✓ Fixture/Part/Toilet | ⚠ תיבה (רצוי mesh) | ✓ אסלה | 3D: רצוי mesh-גוף |
| `SINK` | כיור | ✓ `water_point` | ✓ Fixture/Part/כיור | ⚠ תיבה (רצוי mesh) | ✓ מים משולב | 3D: רצוי mesh-גוף |
| `SHOWER` | מקלחת | ✓ `water_point` | ✓ Fixture/Part/Shower | ⚠ תיבה (רצוי mesh) | ✓ מים משולב | 3D: רצוי mesh-גוף |

### דלתות

| element key | he | DXF-2D symbol | ORDX class/type/name | DXF-3D | PDP item | פערים |
|---|---|---|---|---|---|---|
| `DOOR_IN_LEFT` | דלת פנימה שמאל | ✓ `door_hinged_l` | ⚠ Decorative/EntryDoor/Hinged Left In | ⚠ תיבה (רצוי mesh) | ✓ דלת | ORDX-name משותף ל-2 (`Hinged Left In`) · 3D: רצוי mesh-גוף |
| `DOOR_IN_RIGHT` | דלת פנימה ימין | ✓ `door_hinged_r` | ⚠ Decorative/EntryDoor/Hinged Right In | ⚠ תיבה (רצוי mesh) | ✓ דלת | ORDX-name משותף ל-2 (`Hinged Right In`) · 3D: רצוי mesh-גוף |
| `DOOR_OUT_LEFT` | דלת החוצה שמאל | ✓ `door_hinged_l` | ✓ Decorative/EntryDoor/Hinged Left Out | ⚠ תיבה (רצוי mesh) | ✓ דלת | 3D: רצוי mesh-גוף |
| `DOOR_OUT_RIGHT` | דלת החוצה ימין | ✓ `door_hinged_r` | ✓ Decorative/EntryDoor/Hinged Right Out | ⚠ תיבה (רצוי mesh) | ✓ דלת | 3D: רצוי mesh-גוף |
| `DOOR_ENTRANCE` | דלת כניסה / פלדלת | ✓ `door_entrance` | ⚠ Decorative/EntryDoor/Hinged Right In | ⚠ תיבה (רצוי mesh) | ✗ אין | ORDX-name משותף ל-2 (`Hinged Right In`) · 3D: רצוי mesh-גוף · PDP: אין bin |
| `DOOR_MAMAD` | דלת ממ"ד (הדף) | ✓ `door_mamad` | ✓ Decorative/EntryDoor/Safety Room Entrance | ⚠ תיבה (רצוי mesh) | ✓ חור.פ.ממד | 3D: רצוי mesh-גוף |
| `DOOR_POCKET` | דלת כיס | ✓ `door_pocket` | ⚠ Decorative/EntryDoor/Doorway w/o Frame | ⚠ תיבה (רצוי mesh) | ✓ דלת | ORDX-name משותף ל-5 (`Doorway w/o Frame`) · 3D: רצוי mesh-גוף |
| `DOOR_SLIDING` | דלת הזזה | ✓ `door_sliding` | ⚠ Decorative/EntryDoor/Doorway w/o Frame | ⚠ תיבה (רצוי mesh) | ✓ דלת | ORDX-name משותף ל-5 (`Doorway w/o Frame`) · 3D: רצוי mesh-גוף |
| `DOOR_PATIO` | דלת מרפסת (הזזה) | ✓ `door_sliding` | ⚠ Decorative/EntryDoor/Doorway w/o Frame | ⚠ תיבה (רצוי mesh) | ✓ דלת | ORDX-name משותף ל-5 (`Doorway w/o Frame`) · 3D: רצוי mesh-גוף |
| `DOOR_DOUBLE` | דלת דו-כנפית | ✓ `door_double` | ⚠ Decorative/EntryDoor/Hinged Left In | ⚠ תיבה (רצוי mesh) | ✗ אין | ORDX-name משותף ל-2 (`Hinged Left In`) · 3D: רצוי mesh-גוף · PDP: אין bin |
| `OPENING_FRAME` | מפתח עם משקוף | ✓ `door_frame` | ✓ Decorative/EntryDoor/Doorway with Frame | ✓ תיבה W×D×H | ✓ דלת | — |
| `PASSAGE` | מעבר | ✓ `passage` | ⚠ Decorative/EntryDoor/Doorway w/o Frame | ✓ תיבה W×D×H | ✓ דלת | ORDX-name משותף ל-5 (`Doorway w/o Frame`) |
| `OPENING_TO_FLOOR` | פתח עד הרצפה | ✓ `passage` | ⚠ Decorative/EntryDoor/Doorway w/o Frame | ✓ תיבה W×D×H | ✓ דלת | ORDX-name משותף ל-5 (`Doorway w/o Frame`) |

### חלונות

| element key | he | DXF-2D symbol | ORDX class/type/name | DXF-3D | PDP item | פערים |
|---|---|---|---|---|---|---|
| `WINDOW` | חלון | ✓ `window` | ⚠ Decorative/Window/Window | ⚠ תיבה (רצוי mesh) | ✓ חלון | ORDX-name משותף ל-10 (`Window`) · 3D: רצוי mesh-גוף |
| `WINDOW_CASEMENT` | חלון ציר | ✓ `window_casement` | ⚠ Decorative/Window/Window | ⚠ תיבה (רצוי mesh) | ✓ חלון | ORDX-name משותף ל-10 (`Window`) · 3D: רצוי mesh-גוף |
| `WINDOW_KIP` | חלון קיפ (דריי-קיפ) | ✓ `window_kip` | ⚠ Decorative/Window/Window | ⚠ תיבה (רצוי mesh) | ✓ חלון | ORDX-name משותף ל-10 (`Window`) · 3D: רצוי mesh-גוף |
| `WINDOW_SLIDING` | חלון הזזה | ✓ `window_sliding` | ⚠ Decorative/Window/Window | ⚠ תיבה (רצוי mesh) | ✓ חלון | ORDX-name משותף ל-10 (`Window`) · 3D: רצוי mesh-גוף |
| `WINDOW_HUNG` | חלון גיליון | ✓ `window_hung` | ⚠ Decorative/Window/Window | ⚠ תיבה (רצוי mesh) | ✓ חלון | ORDX-name משותף ל-10 (`Window`) · 3D: רצוי mesh-גוף |
| `WINDOW_MAMAD` | חלון ממ"ד (הדף) | ✓ `window_mamad` | ⚠ Decorative/Window/Window | ⚠ תיבה (רצוי mesh) | ✓ חלון | ORDX-name משותף ל-10 (`Window`) · 3D: רצוי mesh-גוף |
| `WINDOW_KITCHEN` | חלון מטבח | ✓ `window_sliding` | ⚠ Decorative/Window/Window | ⚠ תיבה (רצוי mesh) | ✓ חלון | ORDX-name משותף ל-10 (`Window`) · 3D: רצוי mesh-גוף |
| `WINDOW_BATH` | חלונית רחצה | ✓ `window_small` | ⚠ Decorative/Window/Window | ⚠ תיבה (רצוי mesh) | ✓ חלון | ORDX-name משותף ל-10 (`Window`) · 3D: רצוי mesh-גוף |
| `WINDOW_TILT` | חלון מדף (אוונינג) | ✓ `window_tilt` | ⚠ Decorative/Window/Window | ⚠ תיבה (רצוי mesh) | ✓ חלון | ORDX-name משותף ל-10 (`Window`) · 3D: רצוי mesh-גוף |
| `VITRINE` | ויטרינה | ✓ `window_storefront` | ⚠ Decorative/Window/Window | ⚠ תיבה (רצוי mesh) | ✓ חלון | ORDX-name משותף ל-10 (`Window`) · 3D: רצוי mesh-גוף |

### מיזוג ואיוורור

| element key | he | DXF-2D symbol | ORDX class/type/name | DXF-3D | PDP item | פערים |
|---|---|---|---|---|---|---|
| `AC_INDOOR` | מזגן עילי (יחידה פנימית) | ✓ `ac_indoor` | ⚠ Decorative/Miscellaneous/Air Condition | ⚠ תיבה (רצוי mesh) | ✗ אין | ORDX-name משותף ל-5 (`Air Condition`) · 3D: רצוי mesh-גוף · PDP: אין bin |
| `AC_CASSETTE` | מזגן קסטה תקרתי | ✓ `ac_cassette` | ⚠ Decorative/Miscellaneous/Air Condition | ⚠ תיבה (רצוי mesh) | ✗ אין | ORDX-name משותף ל-5 (`Air Condition`) · 3D: רצוי mesh-גוף · PDP: אין bin |
| `AC_CONCEALED` | מזגן מיני-מרכזי נסתר | ✓ `ac_concealed` | ⚠ Decorative/Miscellaneous/Air Condition | ✓ תיבה W×D×H | ✗ אין | ORDX-name משותף ל-5 (`Air Condition`) · PDP: אין bin |
| `AC_CONDENSER` | מעבה (יחידה חיצונית) | ✓ `ac_condenser` | ⚠ Decorative/Miscellaneous/Air Condition | ⚠ תיבה (רצוי mesh) | ✗ אין | ORDX-name משותף ל-5 (`Air Condition`) · 3D: רצוי mesh-גוף · PDP: אין bin |
| `AC_BRACKET` | קונזול-קיר למזגן | ✓ `ac_bracket` | ⚠ Decorative/Miscellaneous/קונזול-קיר למזגן | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `AC_SLEEVE` | שרוול מעבר-צנרת מזגן | ✓ `ac_sleeve` | ⚠ Decorative/Miscellaneous/שרוול מעבר-צנרת מזגן | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `AC_WALL_BOX` | נישת-קיר למזגן | ✓ `ac_wall_box` | ⚠ Decorative/Miscellaneous/נישת-קיר למזגן | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `CONDENSATE_DRAIN` | נקודת ניקוז מזגן | ✓ `condensate_drain` | ⚠ Decorative/Miscellaneous/נקודת ניקוז מזגן | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `AC_DIFFUSER` | מפזר-תקרה (דיפיוזר) | ✓ `ac_diffuser` | ⚠ Decorative/Miscellaneous/מפזר-תקרה (דיפיוזר) | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `MAMAD_AIR_VALVE` | פתח-אוויר ממ"ד + שסתום-הדף | ✓ `mamad_air_valve` | ⚠ Decorative/Miscellaneous/פתח-אוויר ממ"ד + שסתום-הדף | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `VENT_GRILLE` | שבכת איוורור | ✓ `vent_grille` | ⚠ Decorative/Miscellaneous/שבכת איוורור | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `WALL_LOUVER` | תריס-איוורור חיצוני (ז'לוזי) | ✓ `wall_louver` | ⚠ Decorative/Miscellaneous/תריס-איוורור חיצוני (ז'לוזי) | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `EXHAUST_FAN` | מאוורר-יניקה (ונטה) | ✓ `exhaust_fan` | ⚠ Decorative/Miscellaneous/מאוורר-יניקה (ונטה) | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `FRESH_AIR_INTAKE` | פתח אוויר-צח / מסנן | ✓ `fresh_air_intake` | ⚠ Decorative/Miscellaneous/פתח אוויר-צח / מסנן | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `RANGE_HOOD_DUCT` | תעלת-מנדף (קולט-אדים) | ✓ `range_hood_duct` | ⚠ Decorative/Miscellaneous/תעלת-מנדף (קולט-אדים) | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `DRYER_VENT` | פתח מייבש-כביסה | ✓ `dryer_vent` | ⚠ Decorative/Miscellaneous/פתח מייבש-כביסה | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `BOILER_FLUE` | ארובת-דוד גז | ✓ `boiler_flue` | ⚠ Decorative/Miscellaneous/ארובת-דוד גז | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `CHIMNEY_FLUE` | ארובת-עשן (קמין) | ✓ `chimney_flue` | ⚠ Decorative/Miscellaneous/ארובת-עשן (קמין) | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `SERVICE_HATCH` | פתח-שירות / תקרה-פריקה | ✓ `service_hatch` | ⚠ Decorative/Miscellaneous/פתח-שירות / תקרה-פריקה | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |
| `HRV` | אוורור מבוקר (HRV/ERV) | ✓ `hrv` | ⚠ Decorative/Miscellaneous/אוורור מבוקר (HRV/ERV) | ✓ תיבה W×D×H | ✗ אין | ORDX type גנרי (Miscellaneous) · PDP: אין bin |

### מבנה ותקרה

| element key | he | DXF-2D symbol | ORDX class/type/name | DXF-3D | PDP item | פערים |
|---|---|---|---|---|---|---|
| `CEILING_DROP` | הנמכת תקרה | ✓ `dropped_ceiling` | ⚠ Decorative/Miscellaneous/הנמכת תקרה | ⚠ תיבה (חסר W/H) | ✓ תעלה | ORDX type גנרי (Miscellaneous) · 3D: חסר W/H לתיבה |
| `CEILING_DROP_AC` | הנמכת תקרה עם מזגן | ✓ `dropped_ceiling` | ⚠ Decorative/Miscellaneous/הנמכת תקרה עם מזגן | ⚠ תיבה (חסר W/H) | ✓ תעלה | ORDX type גנרי (Miscellaneous) · 3D: חסר W/H לתיבה |
| `COLUMN` | עמוד | ✓ `column_rect` | ⚠ Decorative/TWall/Pole | ⚠ תיבה (חסר W/H) | ✓ תעלה | ORDX-name משותף ל-2 (`Pole`) · 3D: חסר W/H לתיבה |
| `COLUMN_ROUND` | עמוד עגול | ✓ `column_round` | ✓ Decorative/TWall/RPole | ⚠ תיבה (חסר W/H) | ✓ תעלה | 3D: חסר W/H לתיבה |
| `PANEL` | פאנל | ✓ `concealment_panel` | ⚠ Fixture/Miscellaneous/פאנל | ✓ תיבה W×D×H | ✓ תעלה | ORDX type גנרי (Miscellaneous) |
| `ROUND_OBJECT` | אובייקט עגול | ✓ `column_round` | ⚠ Fixture/Miscellaneous/אובייקט עגול | ⚠ תיבה (חסר W/H) | ✓ תעלה | ORDX type גנרי (Miscellaneous) · 3D: חסר W/H לתיבה |

### הערות

| element key | he | DXF-2D symbol | ORDX class/type/name | DXF-3D | PDP item | פערים |
|---|---|---|---|---|---|---|
| `NOTE` | הערה | ✓ `note` | ⚠ Fixture/Miscellaneous/הערה | ⚠ תיבה (חסר W/H) | ✓ [UP_TEXT] | ORDX type גנרי (Miscellaneous) · 3D: חסר W/H לתיבה |
| `NOTE_FACTORY` | הערה למפעל | ✓ `note_factory` | ⚠ Fixture/Miscellaneous/הערה למפעל | ⚠ תיבה (חסר W/H) | ✓ [UP_TEXT] | ORDX type גנרי (Miscellaneous) · 3D: חסר W/H לתיבה |

### מטבח חוץ

| element key | he | DXF-2D symbol | ORDX class/type/name | DXF-3D | PDP item | פערים |
|---|---|---|---|---|---|---|
| `OK_GRILL_BUILTIN` | גריל בנוי | ✓ `junction_cable` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_GRILL_CART` | גריל חופשי / עגלה | ✓ `junction_cable` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_KAMADO` | קמאדו / ביצה | ✓ `junction_cable` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_PIZZA_OVEN` | טאבון / תנור פיצה | ✓ `gas_taboon` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_SMOKER` | מעשנת | ✓ `junction_cable` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_GAS_COOKTOP` | כירת גז חוץ | ✓ `gas_point` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ גז | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_SIDE_BURNER` | מבער צד | ✓ `gas_point` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ גז | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_WARMING_DRAWER` | מגירת חימום | ✓ `junction_cable` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_RANGE_HOOD` | קולט אדים חוץ | ✓ `range_hood` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_FRIDGE` | מקרר חוץ | ✓ `outlet_fridge` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_FREEZER` | מקפיא | ✓ `outlet_fridge` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_ICE_MAKER` | מכונת קרח / אייס מייקר | ✓ `outlet_icemaker` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_KEGERATOR` | קגרייטור | ✓ `junction_cable` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_WINE_COOLER` | מצנן יין | ✓ `junction_cable` | ⚠ Appliance/DishWasher/DishWasher | ✓ תיבה W×D×H | ✓ ק.חשמל | ORDX-name משותף ל-19 (`DishWasher`) |
| `OK_SINK` | כיור חוץ | ✓ `water_point` | ⚠ Fixture/Part/Water Supply | ⚠ תיבה (רצוי mesh) | ✓ מים משולב | ORDX-name משותף ל-3 (`Water Supply`) · 3D: רצוי mesh-גוף |
| `OK_FAUCET` | ברז / ברז נשלף | ✓ `water_faucet` | ✓ Fixture/Part/Faucet | ✓ תיבה W×D×H | ✓ ברז | — |
| `OK_GAS_TAP` | ברז גז חיצוני | ✓ `gas_valve` | ⚠ Fixture/Part/Gas | ✓ תיבה W×D×H | ✓ גז | ORDX-name משותף ל-2 (`Gas`) |
| `OK_TRASH_DRAWER` | מגירת אשפה | ✓ `generic` | ⚠ Fixture/Miscellaneous/מגירת אשפה | ✓ תיבה W×D×H | ✓ תעלה | ORDX type גנרי (Miscellaneous) |
| `OK_STORAGE_DRAWERS` | מגירות אחסון | ✓ `generic` | ⚠ Fixture/Miscellaneous/מגירות אחסון | ✓ תיבה W×D×H | ✓ תעלה | ORDX type גנרי (Miscellaneous) |
| `OK_PLANTER` | עציץ מובנה | ✓ `generic` | ⚠ Decorative/Miscellaneous/עציץ מובנה | ✓ תיבה W×D×H | ✓ תעלה | ORDX type גנרי (Miscellaneous) |
| `OK_UMBRELLA_ANCHOR` | עמוד סוכך / עוגן פרגולה | ✓ `column_rect` | ⚠ Decorative/TWall/Pole | ⚠ תיבה (חסר W/H) | ✓ תעלה | ORDX-name משותף ל-2 (`Pole`) · 3D: חסר W/H לתיבה |
| `OK_LIGHTING_BRIDGE` | גשר תאורה | ✓ `light_downlight` | ⚠ Decorative/Miscellaneous/Lighting | ✓ תיבה W×D×H | ✓ תאורה | ORDX type גנרי (Miscellaneous) |

### סימון

| element key | he | DXF-2D symbol | ORDX class/type/name | DXF-3D | PDP item | פערים |
|---|---|---|---|---|---|---|
| `STICHMASS` | שטיכמוס (סימן ייחוס) | ✓ `datum_mark` | ⚠ Fixture/Miscellaneous/שטיכמוס (סימן ייחוס) | ⚠ תיבה (חסר W/H) | ✓ [UP_TEXT] | ORDX type גנרי (Miscellaneous) · 3D: חסר W/H לתיבה |
| `FUTURE_CEILING_LINE` | קו-תקרה עתידי | ✓ `future_ceiling_line` | ⚠ Fixture/Miscellaneous/קו-תקרה עתידי | ⚠ תיבה (חסר W/H) | ✓ [UP_TEXT] | ORDX type גנרי (Miscellaneous) · 3D: חסר W/H לתיבה |
| `FUTURE_CEILING` | תקרה עתידית | ✓ `future_ceiling` | ⚠ Fixture/Miscellaneous/תקרה עתידית | ⚠ תיבה (חסר W/H) | ✓ [UP_TEXT] | ORDX type גנרי (Miscellaneous) · 3D: חסר W/H לתיבה |

## בקלוג פערים לפי-פורמט (routing)

### DXF-2D — 0 פערים ✅
כל 97 הטיפוסים נפתרים לסמל ייעודי (אחרי תיקוני-NAME_MAP + הסרת 4 שכפולים).

### ORDX — 54 טיפוסים עם זהות-שם מתנגשת (app-lane) ⚠
ה-`<Name>` הנפלט אינו ייחודי — כמה טיפוסים חולקים זהות אחת, כך שהממיר אינו יכול להבחין ביניהם מ-ORDX בלבד:

| ORDX name | # טיפוסים | טיפוסים |
|---|---|---|
| `Socket` | 2 | SOCKET_SINGLE, ELECTRIC_APPLIANCE |
| `Power Line` | 2 | ELECTRICAL_WALL, ELECTRICAL_LINE |
| `Water Supply` | 3 | WATER_PIPE, WATER_PIPE_ROUND, OK_SINK |
| `Gas` | 2 | GAS_PIPE, OK_GAS_TAP |
| `Air Condition` | 5 | AC_UNIT, AC_INDOOR, AC_CASSETTE, AC_CONCEALED, AC_CONDENSER |
| `DishWasher` | 19 | REFRIGERATOR, OVEN, MICROWAVE, DISHWASHER, WATER_BAR, OK_GRILL_BUILTIN, OK_GRILL_CART, OK_KAMADO, OK_PIZZA_OVEN, OK_SMOKER, OK_GAS_COOKTOP, OK_SIDE_BURNER, OK_WARMING_DRAWER, OK_RANGE_HOOD, OK_FRIDGE, OK_FREEZER, OK_ICE_MAKER, OK_KEGERATOR, OK_WINE_COOLER |
| `Hinged Left In` | 2 | DOOR_IN_LEFT, DOOR_DOUBLE |
| `Hinged Right In` | 2 | DOOR_IN_RIGHT, DOOR_ENTRANCE |
| `Doorway w/o Frame` | 5 | DOOR_POCKET, DOOR_SLIDING, DOOR_PATIO, PASSAGE, OPENING_TO_FLOOR |
| `Window` | 10 | WINDOW, WINDOW_CASEMENT, WINDOW_KIP, WINDOW_SLIDING, WINDOW_HUNG, WINDOW_MAMAD, WINDOW_KITCHEN, WINDOW_BATH, WINDOW_TILT, VITRINE |
| `Pole` | 2 | COLUMN, OK_UMBRELLA_ANCHOR |

**נדרש (app-lane):** ordxName ייחודי לכל טיפוס (למשל `Air Condition`→`AC Indoor`/`AC Condenser`; `DishWasher`→שם-מכשיר אמיתי; `Doorway w/o Frame`→וריאנט לכל פתח).

### DXF-3D — כל 97 מקבלים גוף-תיבה בגודל-אמת ✅; שדרוגים ⚠
- **רצוי mesh-גוף אמיתי (31):** WATER_PIPE, WATER_PIPE_ROUND, AC_UNIT, BATH, TOILET, SINK, SHOWER, DOOR_IN_LEFT, DOOR_IN_RIGHT, DOOR_OUT_LEFT, DOOR_OUT_RIGHT, DOOR_ENTRANCE, DOOR_MAMAD, DOOR_POCKET, DOOR_SLIDING, DOOR_PATIO, DOOR_DOUBLE, WINDOW, WINDOW_CASEMENT, WINDOW_KIP, WINDOW_SLIDING, WINDOW_HUNG, WINDOW_MAMAD, WINDOW_KITCHEN, WINDOW_BATH, WINDOW_TILT, VITRINE, AC_INDOOR, AC_CASSETTE, AC_CONDENSER, OK_SINK — כרגע תיבה; לגוף-אמת דרוש mesh (ראה `dr_item_record.md §6b`).
- **חסר W/H לתיבה (11):** CEILING_DROP, CEILING_DROP_AC, COLUMN, COLUMN_ROUND, ROUND_OBJECT, NOTE, NOTE_FACTORY, OK_UMBRELLA_ANCHOR, STICHMASS, FUTURE_CEILING_LINE, FUTURE_CEILING — סמל-מישור (D=0/רדיוס); דרוש מינ׳-מידה או mesh.
- נדרש (DXF-3D exporter): גובה-התקנה (install-Z) לכל התקן-קיר; mesh לפתחים/כלים-סניטריים.

### PDP — 22 טיפוסים ללא bin ✗ (routing ל-PDP agent)
| element | he | סיבה | תיקון-מוצע |
|---|---|---|---|
| `DOOR_ENTRANCE` | דלת כניסה / פלדלת | אין ערך ב-`ordx_item_dictionary.json` | הוסף he ל-`dict.elements`→`דלת` |
| `DOOR_DOUBLE` | דלת דו-כנפית | אין ערך ב-`ordx_item_dictionary.json` | הוסף he ל-`dict.elements`→`דלת` |
| `AC_INDOOR` | מזגן עילי (יחידה פנימית) | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `AC_CASSETTE` | מזגן קסטה תקרתי | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `AC_CONCEALED` | מזגן מיני-מרכזי נסתר | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `AC_CONDENSER` | מעבה (יחידה חיצונית) | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `AC_BRACKET` | קונזול-קיר למזגן | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `AC_SLEEVE` | שרוול מעבר-צנרת מזגן | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `AC_WALL_BOX` | נישת-קיר למזגן | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `CONDENSATE_DRAIN` | נקודת ניקוז מזגן | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `AC_DIFFUSER` | מפזר-תקרה (דיפיוזר) | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `MAMAD_AIR_VALVE` | פתח-אוויר ממ"ד + שסתום-הדף | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `VENT_GRILLE` | שבכת איוורור | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `WALL_LOUVER` | תריס-איוורור חיצוני (ז'לוזי) | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `EXHAUST_FAN` | מאוורר-יניקה (ונטה) | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `FRESH_AIR_INTAKE` | פתח אוויר-צח / מסנן | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `RANGE_HOOD_DUCT` | תעלת-מנדף (קולט-אדים) | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `DRYER_VENT` | פתח מייבש-כביסה | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `BOILER_FLUE` | ארובת-דוד גז | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `CHIMNEY_FLUE` | ארובת-עשן (קמין) | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `SERVICE_HATCH` | פתח-שירות / תקרה-פריקה | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |
| `HRV` | אוורור מבוקר (HRV/ERV) | אין ערך ב-`ordx_item_dictionary.json` | מיזוג/איוורור: אין bin ייעודי → מפה ל-`תעלה`/`חלון` או ייצר bin ב-InnoDraw |

> PDP-bins קיימים (21): שקע·מפסק·ברז·מים משולב·ביוב קיר·פ.ביוב·צ.חשמל·ק.חשמל·ק.בקורת·תעלה·תאורה·דלת·חלון·אדן חלון·ארגז תריס·חור.פ.ממד·גז·צ.מים·אסלה·ביוב·+שקע.
