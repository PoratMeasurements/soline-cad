> ⚠️ **עודכן 2026-08-22 — הוחלף חלקית.** בעל-המוצר העלה את הרף: **כל** סמל חייב להתחבר לטיפוס-אלמנט
> הניתן-לייצוא בכל 4 הפורמטים (אין "forward-coverage" יתום). המסמכים הסמכותיים כעת:
> **`ELEMENT_COVERAGE_MATRIX.md`** (כיסוי-4-פורמטים + בקלוג-פערים) · **`ELEMENT_BLOCK_SPEC.md`** (מפרט-בלוק
> רב-פורמטי + שדות-מודד) · **`CATALOG_ADDITIONS.md`** (122 סמלים לקידום לטיפוסי-אפליקציה).
> **שינויי-ספרייה:** הוסרו 4 שכפולים (`socket_floor`,`door_interior_90`,`doorway_frame`,`doorway_noframe`);
> מיפויים תוקנו (`מפתח עם משקוף`→`door_frame`, `מעבר`→`passage`, `מעבה`→`ac_condenser`, מכשירי-מטבח ללא-^).
> סה״כ סמלים 193→189 · מקושרים-לטיפוס-קיים 67 · מוצעים-לקידום 122. §"forward-coverage" למטה **בטל**.

# SYMBOL ↔ ELEMENT LINKAGE — סמל-DXF2D ↔ טיפוס-אלמנט-מדידה

> **מקור-אמת לטיפוסי-האלמנט:** `app-measure/…/catalog/ElementCatalog.kt` (read-only).
> **מקור-אמת לסמלים:** `converter/src/element_symbols_soline.js` (KEY + NAME_MAP).
> נוצר אוטומטית מ-`resolveKey()` על כל 97 טיפוסי-הקטלוג. לשון זכר · 2026-08-22.

## תוצאה
- **טיפוסי-אלמנט בקטלוג:** 97 · **פערים (gap — טיפוס ללא סמל): 0** ✅ — כל טיפוס נפתר לסמל.
- **סמלים ייחודיים בשימוש ע״י הקטלוג:** 67 מתוך 193.
- **סמלי forward-coverage (orphan מול הקטלוג-הזה): 126** — **אינם "מתים"**: הם משרתים את קטלוג-CVSM
  המלא (~170 אלמנטים) שאפליקציית-המדידה של Soline מכסה רק חלק ממנו. ראה §"סמלי forward-coverage".

## איך הקישור עובד
האפליקציה שולחת פריט עם `type=<KEY>` ו-`name=<he>`. `resolveKey()` בונה מחרוזת מ-
`[en, he, name, heName, description, type, class]` ומריץ עליה את `NAME_MAP` (regex, ראשון-שמתאים-מנצח),
ואז נפילה-לפי-קטגוריה/דיסציפלינה. כל 97 הטיפוסים מתאימים בשלב-ה-NAME_MAP (לא נדרשת נפילה).

## טבלת-הקישור (element key → symbol key)

### חשמל

| element key | שם (he) | → symbol key | discipline |
|---|---|---|---|
| `SOCKET_SINGLE` | שקע בודד | `socket_single` | electrical |
| `SOCKET_MULTI` | שקע מרובע | `socket_duplex` | electrical |
| `SWITCH` | מתג | `switch_single` | electrical |
| `ELECTRICAL_WALL` | תשתית חשמל -קיר | `junction_cable` | electrical |
| `ELECTRICAL_LINE` | תשתית חשמל | `junction_cable` | electrical |
| `ELECTRIC_APPLIANCE` | נקודת מוצר חשמל | `junction_cable` | electrical |
| `CEILING_LIGHT` | מנורת תקרה | `light_downlight` | lighting |

### אינסטלציה

| element key | שם (he) | → symbol key | discipline |
|---|---|---|---|
| `WATER_PIPE` | מים | `water_point` | plumbing |
| `GAS_PIPE` | גז | `gas_point` | gas |
| `WATER_PIPE_ROUND` | צינור מים עגול | `water_point` | plumbing |
| `FLOOR_DRAIN` | ניקוז רצפתי | `sewage_point` | drainage |

### מוצרי חשמל

| element key | שם (he) | → symbol key | discipline |
|---|---|---|---|
| `AC_UNIT` | מזגן | `ac_indoor` | hvac |
| `REFRIGERATOR` | מקרר | `outlet_fridge` | electrical |
| `OVEN` | תנור | `outlet_oven` | electrical |
| `MICROWAVE` | מיקרוגל | `outlet_microwave` | electrical |
| `DISHWASHER` | מדיח | `outlet_dishwasher` | electrical |
| `WATER_BAR` | תמי4 | `water_bar` | plumbing |

### סניטרי

| element key | שם (he) | → symbol key | discipline |
|---|---|---|---|
| `BATH` | אמבטיה | `water_point` | plumbing |
| `TOILET` | אסלה | `toilet_waste` | drainage |
| `SINK` | כיור | `water_point` | plumbing |
| `SHOWER` | מקלחת | `water_point` | plumbing |

### דלתות

| element key | שם (he) | → symbol key | discipline |
|---|---|---|---|
| `DOOR_IN_LEFT` | דלת פנימה שמאל | `door_hinged_l` | door |
| `DOOR_IN_RIGHT` | דלת פנימה ימין | `door_hinged_r` | door |
| `DOOR_OUT_LEFT` | דלת החוצה שמאל | `door_hinged_l` | door |
| `DOOR_OUT_RIGHT` | דלת החוצה ימין | `door_hinged_r` | door |
| `DOOR_ENTRANCE` | דלת כניסה / פלדלת | `door_entrance` | door |
| `DOOR_MAMAD` | דלת ממ"ד (הדף) | `door_mamad` | door |
| `DOOR_POCKET` | דלת כיס | `door_pocket` | door |
| `DOOR_SLIDING` | דלת הזזה | `door_sliding` | door |
| `DOOR_PATIO` | דלת מרפסת (הזזה) | `door_sliding` | door |
| `DOOR_DOUBLE` | דלת דו-כנפית | `door_double` | door |
| `OPENING_FRAME` | מפתח עם משקוף | `doorway_frame` | door |
| `PASSAGE` | מעבר | `passage` | opening |
| `OPENING_TO_FLOOR` | פתח עד הרצפה | `passage` | opening |

### חלונות

| element key | שם (he) | → symbol key | discipline |
|---|---|---|---|
| `WINDOW` | חלון | `window` | window |
| `WINDOW_CASEMENT` | חלון ציר | `window_casement` | window |
| `WINDOW_KIP` | חלון קיפ (דריי-קיפ) | `window_kip` | window |
| `WINDOW_SLIDING` | חלון הזזה | `window_sliding` | window |
| `WINDOW_HUNG` | חלון גיליון | `window_hung` | window |
| `WINDOW_MAMAD` | חלון ממ"ד (הדף) | `window_mamad` | window |
| `WINDOW_KITCHEN` | חלון מטבח | `window_sliding` | window |
| `WINDOW_BATH` | חלונית רחצה | `window_small` | window |
| `WINDOW_TILT` | חלון מדף (אוונינג) | `window_tilt` | window |
| `VITRINE` | ויטרינה | `window_storefront` | window |

### מיזוג ואיוורור

| element key | שם (he) | → symbol key | discipline |
|---|---|---|---|
| `AC_INDOOR` | מזגן עילי (יחידה פנימית) | `ac_indoor` | hvac |
| `AC_CASSETTE` | מזגן קסטה תקרתי | `ac_cassette` | hvac |
| `AC_CONCEALED` | מזגן מיני-מרכזי נסתר | `ac_concealed` | hvac |
| `AC_CONDENSER` | מעבה (יחידה חיצונית) | `ac_condenser` | hvac |
| `AC_BRACKET` | קונזול-קיר למזגן | `ac_bracket` | hvac |
| `AC_SLEEVE` | שרוול מעבר-צנרת מזגן | `ac_sleeve` | hvac |
| `AC_WALL_BOX` | נישת-קיר למזגן | `ac_wall_box` | hvac |
| `CONDENSATE_DRAIN` | נקודת ניקוז מזגן | `condensate_drain` | drainage |
| `AC_DIFFUSER` | מפזר-תקרה (דיפיוזר) | `ac_diffuser` | hvac |
| `MAMAD_AIR_VALVE` | פתח-אוויר ממ"ד + שסתום-הדף | `mamad_air_valve` | hvac |
| `VENT_GRILLE` | שבכת איוורור | `vent_grille` | hvac |
| `WALL_LOUVER` | תריס-איוורור חיצוני (ז'לוזי) | `wall_louver` | hvac |
| `EXHAUST_FAN` | מאוורר-יניקה (ונטה) | `exhaust_fan` | hvac |
| `FRESH_AIR_INTAKE` | פתח אוויר-צח / מסנן | `fresh_air_intake` | hvac |
| `RANGE_HOOD_DUCT` | תעלת-מנדף (קולט-אדים) | `range_hood_duct` | hvac |
| `DRYER_VENT` | פתח מייבש-כביסה | `dryer_vent` | hvac |
| `BOILER_FLUE` | ארובת-דוד גז | `boiler_flue` | hvac |
| `CHIMNEY_FLUE` | ארובת-עשן (קמין) | `chimney_flue` | hvac |
| `SERVICE_HATCH` | פתח-שירות / תקרה-פריקה | `service_hatch` | hvac |
| `HRV` | אוורור מבוקר (HRV/ERV) | `hrv` | hvac |

### מבנה ותקרה

| element key | שם (he) | → symbol key | discipline |
|---|---|---|---|
| `CEILING_DROP` | הנמכת תקרה | `dropped_ceiling` | structure |
| `CEILING_DROP_AC` | הנמכת תקרה עם מזגן | `dropped_ceiling` | structure |
| `COLUMN` | עמוד | `column_rect` | structure |
| `COLUMN_ROUND` | עמוד עגול | `column_round` | structure |
| `PANEL` | פאנל | `concealment_panel` | structure |
| `ROUND_OBJECT` | אובייקט עגול | `column_round` | structure |

### הערות

| element key | שם (he) | → symbol key | discipline |
|---|---|---|---|
| `NOTE` | הערה | `note` | annotation |
| `NOTE_FACTORY` | הערה למפעל | `note_factory` | annotation |

### מטבח חוץ

| element key | שם (he) | → symbol key | discipline |
|---|---|---|---|
| `OK_GRILL_BUILTIN` | גריל בנוי | `junction_cable` | electrical |
| `OK_GRILL_CART` | גריל חופשי / עגלה | `junction_cable` | electrical |
| `OK_KAMADO` | קמאדו / ביצה | `junction_cable` | electrical |
| `OK_PIZZA_OVEN` | טאבון / תנור פיצה | `gas_taboon` | gas |
| `OK_SMOKER` | מעשנת | `junction_cable` | electrical |
| `OK_GAS_COOKTOP` | כירת גז חוץ | `gas_point` | gas |
| `OK_SIDE_BURNER` | מבער צד | `gas_point` | gas |
| `OK_WARMING_DRAWER` | מגירת חימום | `junction_cable` | electrical |
| `OK_RANGE_HOOD` | קולט אדים חוץ | `range_hood` | hvac |
| `OK_FRIDGE` | מקרר חוץ | `outlet_fridge` | electrical |
| `OK_FREEZER` | מקפיא | `outlet_fridge` | electrical |
| `OK_ICE_MAKER` | מכונת קרח / אייס מייקר | `outlet_icemaker` | electrical |
| `OK_KEGERATOR` | קגרייטור | `junction_cable` | electrical |
| `OK_WINE_COOLER` | מצנן יין | `junction_cable` | electrical |
| `OK_SINK` | כיור חוץ | `water_point` | plumbing |
| `OK_FAUCET` | ברז / ברז נשלף | `water_faucet` | plumbing |
| `OK_GAS_TAP` | ברז גז חיצוני | `gas_valve` | gas |
| `OK_TRASH_DRAWER` | מגירת אשפה | `generic` | misc |
| `OK_STORAGE_DRAWERS` | מגירות אחסון | `generic` | misc |
| `OK_PLANTER` | עציץ מובנה | `generic` | misc |
| `OK_UMBRELLA_ANCHOR` | עמוד סוכך / עוגן פרגולה | `column_rect` | structure |
| `OK_LIGHTING_BRIDGE` | גשר תאורה | `light_downlight` | lighting |

### סימון

| element key | שם (he) | → symbol key | discipline |
|---|---|---|---|
| `STICHMASS` | שטיכמוס (סימן ייחוס) | `datum_mark` | annotation |
| `FUTURE_CEILING_LINE` | קו-תקרה עתידי | `future_ceiling_line` | annotation |
| `FUTURE_CEILING` | תקרה עתידית | `future_ceiling` | annotation |

## סמלי forward-coverage (126) — לא-פערים
סמלים אלה קיימים בספרייה אך אינם ממופים ע״י אף אחד מ-97 טיפוסי-`ElementCatalog.kt` — כי הם מכסים
אלמנטים בקטלוג-CVSM המלא (170) שטרם נכללו בבורר-המדידה של Soline. הם נשמרים בכוונה (יציבות-KEY +
כיסוי-קדימה לשילובי-CVSM ולווריאנטים-אישיים `CustomElementStore`). דוגמאות: כל וריאנטי-השקע/מפסק
(`socket_triple/duplex/…`, `switch_double/dimmer/…`), חבילת בטיחות מלאה (`smoke_detector`, `camera`,
`sprinkler`), תקשורת (`data_rj45/tv/…`), אנרגיה (`pv_panel`, `battery_storage`), וריאנטי-קיר/פתח
(`niche`, `arch`, `stair`, `column_round`). **אין להסירם.**

## פריטים למעקב (queued — app-lane; לא-נגעתי בקבצי-האפליקציה)
מיפויים תקינים-אך-כלליים שאפשר לשדרג **בצד-האפליקציה** (הוספת טיפוסים/סמלים ייעודיים):
1. **מטבח-חוץ (OK_*)** — מכשירי-חשמל בנויים (`OK_KEGERATOR`, `OK_SMOKER`, `OK_WARMING_DRAWER`, `OK_WINE_COOLER`)
   נופלים ל-`junction_cable` (נקודת-כוח) — נכון פונקציונלית, אך אפשר לצייר אייקוני-מוצר ייעודיים.
   `OK_TRASH_DRAWER`/`OK_STORAGE_DRAWERS`/`OK_PLANTER` → `generic` (מעוין-נקי) — קבלה.
2. **`AC_UNIT` ("מזגן" כללי)** ממופה ל-`ac_indoor` (split-קיר, האייקוני ביותר). אם ברצונכם ברירת-מחדל
   ניטרלית → הוסיפו טיפוס מפורש בבורר.
3. אין פעולה-נדרשת לדלתות/חלונות/מיזוג — כולם ממופים לסמל ייעודי מדויק.

*הערה: כל תיקוני-ה-NAME_MAP בוצעו בקובץ שבבעלותי (`element_symbols_soline.js`) — לא נגעתי בקבצי-האפליקציה.*
