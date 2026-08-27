# קטלוג-אלמנטים מאוחד — Soline (מדידה + ממיר)

> מקור-אמת יחיד לאלמנטי-Soline. מאחד את קטלוג הממיר (`ordx-pdp-converter/elements.json`, 83 אלמנטים, 13 קטגוריות) עם קטלוג המדידה (`measure/catalog/ElementCatalog.kt`, 24 הגדרות + `data/Entities.kt AccType`). היעד: **אותו `key` עובר `.sol` → ORDX + PDP + DXF-2D + DXF-3D בלי תרגום**.
>
> עודכן: 2026-08-17. יחידות מ"מ. פנייה בלשון זכר. פרטי-הגשר ב-`CONVERTER_BRIDGE.md`.

## מקרא-עמודות
- **key** — מזהה יציב ISO-safe (נשמר כ-`AccessoryEntity.type` במדידה וכ-`id`-סוג ב-`.sol`).
- **עברית / English** — שמות-תצוגה.
- **W×D×H** — רוחב × עומק-בליטה × גובה-פנל (מ"מ). `—` = נגזר מהמדידה.
- **התקנה** — גובה ברירת-מחדל ממרכז האביזר מעל הרצפה הגמורה.
- **round** — נמדד כרדיוס/קוטר (מטא-מדידה מהמדידה).
- **depth?** — האם יש עומק-בליטה (פתחים/סימונים = ✗).
- **ORDX** — ✔ אם קיים בקורפוס ה-ORDX האמיתי (Class/Type ORDX).
- **PDP** — סוג ה-Raumplan העברי שאליו מוזרק (`ordx_item_dictionary.json`).
- **מקור** — `שניהם` / `ממיר` (חסר במדידה — לאמץ) / `מדידה` (חסר בממיר — לאמץ).

---

## חשמל — שקעים
| key | עברית | English | W×D×H | התקנה | ORDX | PDP | מקור |
|---|---|---|---|---|:--:|---|---|
| SOCKET_SINGLE | שקע יחיד | Single Socket | 80×15×80 | 350 | ✔ Fixture | שקע | שניהם |
| SOCKET_MULTI / SOCKET_DUPLEX | שקע כפול | Duplex Socket | 160×15×80 | 350 | ✔ Fixture | שקע | שניהם |
| SOCKET_TRIPLE | שקע משולש | Triple Socket | 240×15×80 | 350 | | שקע | ממיר |
| SOCKET_COUNTERTOP | שקע מעל שיש | Countertop Socket | 160×15×80 | 1150 | | שקע | ממיר |
| SOCKET_IP44 | שקע מוגן מים IP44 | Waterproof Socket | 175×70×70 | 350 | ✔ (SocketEx) | שקע | ממיר |
| SOCKET_3PHASE | שקע תלת-פאזי | Three-Phase Socket | 100×60×100 | 900 | | שקע | ממיר |
| SOCKET_FLOOR | שקע רצפה | Floor Socket Box | 120×0×120 | 0 | | שקע | ממיר |

## חשמל — מפסקים
| key | עברית | English | W×D×H | התקנה | ORDX | PDP | מקור |
|---|---|---|---|---|:--:|---|---|
| SWITCH | מפסק חד-קוטבי | Single Switch | 80×15×80 | 1150 | | מפסק | שניהם* |
| SWITCH_DOUBLE | מפסק כפול | Double Switch | 80×15×80 | 1150 | | מפסק | ממיר |
| SWITCH_TRIPLE | מפסק תלת-קוטבי | Triple Switch | 80×15×80 | 1150 | | מפסק | ממיר |
| SWITCH_TWOWAY | מפסק מחליף | Two-Way Switch | 80×15×80 | 1150 | | מפסק | ממיר |
| SWITCH_CROSS | מפסק צלב | Cross Switch | 80×15×80 | 1150 | | מפסק | ממיר |
| DIMMER | דימר | Dimmer | 80×15×80 | 1150 | | מפסק | ממיר |
| PUSH_BUTTON | לחצן | Push Button | 80×15×80 | 1150 | | מפסק | ממיר |
| SWITCH_PULLCORD | מפסק חבל משיכה | Pull-Cord Switch | 80×30×80 | 2200 | | מפסק | ממיר |

\* המדידה מחזיקה `SWITCH` גנרי; מומלץ לפרק לתת-הסוגים בבורר.

## חשמל — יציאות מכשירים
| key | עברית | English | W×D×H | התקנה | ORDX | PDP | מקור |
|---|---|---|---|---|:--:|---|---|
| ELECTRIC_APPLIANCE | נקודת מוצר חשמל (גנרי) | Appliance Outlet | 100×60×100 | 300 | | צ.חשמל | מדידה |
| OUTLET_OVEN | יציאה לתנור אפייה | Oven Outlet | 100×60×100 | 300 | ✔ (Power Line) | צ.חשמל | ממיר |
| OUTLET_COOKTOP | יציאה לכיריים | Cooktop Outlet | 100×60×100 | 300 | | צ.חשמל | ממיר |
| OUTLET_DISHWASHER | יציאה למדיח | Dishwasher Outlet | 80×15×80 | 300 | | צ.חשמל | ממיר |
| OUTLET_FRIDGE | יציאה למקרר | Refrigerator Outlet | 80×15×80 | 1500 | | צ.חשמל | ממיר |
| OUTLET_MICROWAVE | יציאה למיקרוגל | Microwave Outlet | 80×15×80 | 1500 | | צ.חשמל | ממיר |
| OUTLET_HOOD | יציאה לקולט אדים | Range Hood Outlet | 80×15×80 | 2100 | | צ.חשמל | ממיר |
| OUTLET_WASHER | יציאה למכונת כביסה | Washing Machine Outlet | 80×60×80 | 1100 | | צ.חשמל | ממיר |
| OUTLET_DRYER | יציאה למייבש | Dryer Outlet | 80×60×80 | 1100 | | צ.חשמל | ממיר |
| OUTLET_BOILER | יציאה לדוד חשמל | Water Heater Outlet | 100×60×100 | 1800 | | צ.חשמל | ממיר |
| OUTLET_AC_INDOOR | יציאה למזגן פנימי | AC Indoor Outlet | 80×15×80 | 2300 | | צ.חשמל | ממיר |
| OUTLET_AC_CONDENSER | כוח למעבה מזגן | AC Condenser Power | 100×60×100 | 1500 | | צ.חשמל | ממיר |
| POINT_CEILING_FAN | נקודת מאוורר תקרה | Ceiling Fan Point | 100×30×100 | תקרה | | צ.חשמל | ממיר |

## חשמל — תשתית ולוחות
| key | עברית | English | W×D×H | התקנה | ORDX | PDP | מקור |
|---|---|---|---|---|:--:|---|---|
| ELECTRICAL_LINE | תשתית חשמל | Power Line | —×—×— | — | ✔ (Power Line) | צ.חשמל | שניהם |
| ELECTRICAL_WALL | תשתית חשמל - קיר | Wall Electric Line | —×—×— | — | ✔ | צ.חשמל | שניהם |
| JUNCTION_BOX | קופסת חיבורים | Junction Box | 80×15×80 | משתנה | ✔ | ק.בקורת | ממיר |
| POWER_BOX | ק.חשמל | Power Box | — | — | ✔ | ק.חשמל | ממיר |
| DISTRIBUTION_BOARD | לוח חשמל דירתי | Distribution Board | 400×100×600 | 1700 | | ק.חשמל | ממיר |
| RCD | מפסק פחת | RCD / Ground-Fault | 70×60×120 | 1700 | | ק.חשמל | ממיר |
| EQUIPOTENTIAL_BAR | פס השוואת פוטנציאלים | Equipotential Bar | 120×40×60 | 300 | | — | ממיר |
| GROUNDING_POINT | נקודת הארקה | Grounding Point | 40×20×40 | 300 | | — | ממיר |

## תאורה
| key | עברית | English | W×D×H | התקנה | ORDX | PDP | מקור |
|---|---|---|---|---|:--:|---|---|
| CEILING_LIGHT | מנורת תקרה (גנרי) | Ceiling Light | — | תקרה | | תאורה | מדידה |
| DOWNLIGHT | ספוט שקוע | Recessed Downlight (Can Light) | 100×100×30 | תקרה | ✔ | תאורה | שניהם |
| CEILING_LUMINAIRE | גוף תאורה צמוד תקרה | Ceiling Luminaire | 300×120×300 | תקרה | | תאורה | ממיר |
| PENDANT | מנורה תלויה | Pendant Light | 250×250×300 | תלוי | | תאורה | ממיר |
| SPOTLIGHT | זרקור/ספוט צמוד | Surface Spotlight | 80×120×80 | משתנה | | תאורה | ממיר |
| WALL_LIGHT | תאורת קיר (אפליק) | Wall Light (Sconce) | 120×120×200 | 1900 | | תאורה | ממיר |
| LED_STRIP | פס תאורה LED | LED Strip | —×15×10 | משתנה | | תאורה | ממיר |
| UNDERCAB_LIGHT | תאורת ארון עליון | Under-Cabinet Light | —×15×15 | 1500 | | תאורה | ממיר |
| PLINTH_LIGHT | תאורת קורניץ/בסיס | Toe-Kick / Plinth Light | —×10×10 | 100 | | תאורה | ממיר |
| EXTERIOR_LIGHT | פנס/תאורת חוץ | Exterior Light | 150×150×200 | 2200 | | תאורה | ממיר |
| EMERGENCY_LIGHT | גוף תאורת חירום | Emergency Light | 250×80×120 | 2200 | | תאורה | ממיר |

## תקשורת ומולטימדיה (קטגוריה שלמה — לאמץ במדידה)
| key | עברית | English | W×D×H | התקנה | ORDX | PDP | מקור |
|---|---|---|---|---|:--:|---|---|
| DATA_RJ45 | שקע רשת RJ45 | Data / Network | 80×15×80 | 350 | | שקע | ממיר |
| PHONE_RJ11 | שקע טלפון RJ11 | Telephone | 80×15×80 | 350 | | שקע | ממיר |
| TV_COAX | שקע טלוויזיה/כבלים | TV / Coax | 80×15×80 | 350 | | שקע | ממיר |
| HDMI | שקע HDMI/מולטימדיה | HDMI / Multimedia | 80×15×80 | 1400 | | שקע | ממיר |
| SPEAKER | נקודת רמקול שקוע | In-Ceiling Speaker | 180×120×180 | תקרה | | — | ממיר |
| INTERCOM | נקודת אינטרקום | Intercom Point | 120×30×180 | 1500 | | — | ממיר |
| ROUTER_HUB | נקודת ראוטר/תקשורת | Router / Comms Hub | 160×60×120 | 1500 | | — | ממיר |

## בית חכם ובקרה (לאמץ במדידה)
| key | עברית | English | W×D×H | התקנה | מקור |
|---|---|---|---|---|---|
| SMART_CONTROLLER | בקר בית חכם | Smart Home Controller | 120×30×120 | 1400 | ממיר |
| THERMOSTAT | תרמוסטט | Thermostat | 90×25×90 | 1500 | ממיר |
| MOTION_SENSOR | גלאי נוכחות/תנועה | Motion / Presence Sensor | 80×40×80 | תקרה | ממיר |
| CONTACT_SENSOR | חיישן חלון/דלת | Door/Window Contact | 60×15×20 | על פתח | ממיר |

## בטיחות (לאמץ במדידה)
| key | עברית | English | W×D×H | התקנה | מקור |
|---|---|---|---|---|---|
| SMOKE_DETECTOR | גלאי עשן | Smoke Detector | 120×50×120 | תקרה | ממיר |
| GAS_DETECTOR | גלאי גז | Gas Detector | 100×40×100 | 300 | ממיר |
| DOORBELL | פעמון דלת | Doorbell Button | 60×20×60 | 1300 | ממיר |
| CHIME | גונג/זמזם | Chime / Buzzer | 120×40×80 | 2000 | ממיר |

## אינסטלציה — מים
| key | עברית | English | W×D×H | התקנה | round | ORDX | PDP | מקור |
|---|---|---|---|---|:--:|:--:|---|---|
| WATER_PIPE | מים (גנרי) | Water Point | 20×20×20 | 550 | | ✔ (Water Supply) | מים | שניהם |
| WATER_PIPE_ROUND | צינור מים עגול | Water Pipe (round) | 30 קוטר | — | ✔ | | מים | מדידה |
| WATER_COLD | נקודת מים קרים | Cold Water Point | 20×20×20 | 550 | | ✔ | מים | ממיר |
| WATER_HOT | נקודת מים חמים | Hot Water Point | 20×20×20 | 550 | | | מים | ממיר |
| FAUCET | ברז/נקודת ברז | Faucet Point | 20×20×20 | 550 | | ✔ (Faucet) | ברז | ממיר |
| WATER_DISHWASHER | מים למדיח | Dishwasher Water | 20×20×20 | 300 | | | מים | ממיר |
| WATER_WASHER | מים למכונת כביסה | Washing Machine Water | 20×20×20 | 1000 | | | מים | ממיר |
| WATER_FRIDGE | מים למקרר | Refrigerator Water | 20×20×20 | 300 | | | מים | ממיר |
| BOILER | דוד מים | Water Heater / Boiler | 600×600×1200 | 1800 | | | מים | ממיר |
| SOLAR_COLLECTOR | קולטן שמש | Solar Collector | 20×20×20 | גג | | | מים | ממיר |

## אינסטלציה — ניקוז
| key | עברית | English | W×D×H | התקנה | round | ORDX | PDP | מקור |
|---|---|---|---|---|:--:|:--:|---|---|
| FLOOR_DRAIN | ניקוז רצפתי | Floor Drain | 120×0×120 | 0 | ✔ | ✔ (Sewer drainage) | פ.ביוב | שניהם |
| SEWAGE | נקודת ניקוז/ביוב | Sewage / Waste Point | 50×50×50 | 100 | | ✔ (Sewage) | ביוב קיר | ממיר |
| TOILET_OUTLET | יציאת אסלה | Toilet Waste Outlet | 110×0×110 | 0 | ✔ | | ביוב קיר | ממיר |
| AC_CONDENSATE | ניקוז מזגן | AC Condensate Drain | 20×20×20 | 2300 | | | ביוב קיר | ממיר |

## גז
| key | עברית | English | W×D×H | התקנה | ORDX | PDP | מקור |
|---|---|---|---|---|:--:|---|---|
| GAS_PIPE | גז (גנרי/כיריים) | Gas Point | 20×20×20 | 600 | ✔ (Gas) | גז | שניהם |
| GAS_METER | מונה גז | Gas Meter | 250×150×300 | 1400 | | גז | ממיר |
| GAS_SHUTOFF | ברז ניתוק גז | Gas Shut-off Valve | 40×40×40 | 1200 | | גז | ממיר |

## מיזוג ואוורור
| key | עברית | English | W×D×H | התקנה | ORDX | PDP | מקור |
|---|---|---|---|---|:--:|---|---|
| CEILING_DROP_AC | הנמכת תקרה עם מזגן | Ceiling Drop w/ AC | 200×650×— | תקרה | | תעלה | מדידה |
| AC_INDOOR | מזגן עילי — יחידה פנימית | AC Indoor Unit | 900×200×300 | 2300 | | — | ממיר |
| AC_CONDENSER | מעבה — יחידה חיצונית | AC Condenser | 800×300×550 | חוץ | | — | ממיר |
| AC_DIFFUSER | מפזר מיני-מרכזי | Ducted AC Diffuser | 600×0×600 | תקרה | | — | ממיר |
| VENT_GRILLE | פתח אוורור/שבכה | Ventilation Grille | 200×0×200 | משתנה | | — | ממיר |
| EXHAUST_FAN | מאוורר יניקה | Exhaust Fan | 250×150×250 | משתנה | | — | ממיר |
| HOOD_DUCT | יציאת קולט אדים לחוץ | Range Hood Duct | 150×0×150 | 2100 | | — | ממיר |

## אדריכלי — פתחים ומבנה
| key | עברית | English | W×D×H | depth? | ORDX | PDP | מקור |
|---|---|---|---|:--:|:--:|---|---|
| WINDOW | חלון | Window | 1200×100×1200 | ✗ | ✔ Decorative | חלון | שניהם |
| WINDOW_SILL | אדן חלון | Window Sill | — | ✗ | ✔ | אדן חלון | ממיר |
| SHUTTER_BOX | ארגז תריס | Shutter Box | 2316×0×245 | ✗ | ✔ (Decorative/Part) | ארגז תריס | ממיר |
| DOOR | דלת | Doorway | 800×0×2100 | ✗ | ✔ Decorative | דלת | שניהם |
| OPENING_FRAME | מפתח עם משקוף | Doorway with Frame | — | ✗ | ✔ | דלת | שניהם |
| OPENING_TO_FLOOR | פתח עד הרצפה | Opening to Floor | — | ✗ | | דלת | מדידה |
| SAFETY_ROOM_ENTRANCE | כניסת ממ"ד | Safety Room Entrance | — | ✗ | ✔ | חור.פ.ממד | ממיר |
| BEAM | קורה | Beam | 200×0×400 | ✗ | ✔ (Decorative/Part) | תעלה | ממיר |
| COLUMN | עמוד קונסטרוקטיבי | Structural Column | 300×300×— | ✔ | | — | שניהם |
| COLUMN_ROUND | עמוד עגול | Round Column | 200 קוטר | ✔ | | — | מדידה |
| CEILING_DROP | הנמכת תקרה | Ceiling Drop / Soffit | 200×650×— | ✔ | | תעלה | מדידה |

## מבנה כללי — פאנלים ואובייקטים (מהמדידה)
| key | עברית | English | W×D×H | round | depth? | מקור |
|---|---|---|---|:--:|:--:|---|
| PANEL | פאנל | Panel | —×16×— | | ✔ | מדידה |
| ROUND_OBJECT | אובייקט עגול | Round Object | 100 קוטר | ✔ | ✔ | מדידה |

## סימון — קטגוריה מהמדידה (אין בממיר — לאמץ)
| key | עברית | English | depth? | מקור |
|---|---|---|:--:|---|
| STICHMASS | שטיכמוס (סימן ייחוס) | Reference Mark (Stichmaß) | ✗ | מדידה |
| FUTURE_CEILING_LINE | קו-תקרה עתידי | Future Ceiling Line | ✗ | מדידה |
| FUTURE_CEILING | תקרה עתידית | Future Ceiling | ✗ | מדידה |

---

## מטא-שדות שכל אלמנט נושא ב-`.sol` (מעבר לגיאומטריה)
מ-`SOL_FORMAT.md` + `elements_schema.md` של הממיר — אלה אינם פר-סוג אלא פר-מופע:
- **`status`**: `existing | new | cancelled | prep | future | hidden` — סטטוס-בנייה של הנקודה (לב עבודת-ההתאמה).
- **`measure_ref`**: `center | offset` — נמדד למרכז-הנקודה (ברירת-מחדל ישראלית) או בהיסט מקיר/רצפה.
- **`protrusion_mm`**: עומק-בליטה בפועל — קריטי לנגרות (התנגשות עם גב-ארון).
- **`measure_status`** (מהמדידה): `סופי | אחרי-ריצוף | אחרי-גבס | אחרי-חיפוי`.
- **`round` / `hasDepth`** (מהמדידה): שיטת-המדידה (רדיוס/קוטר; האם יש עומק כלל).
- **`connection_spec`**, **`symbolRef`**, **`timing`** — מפרט-חיבור, סמל מנורמל, תזמון-ביצוע.

## סטטוס-מנייה
- **83** אלמנטים בקטלוג הממיר · **24** הגדרות בבורר-המדידה + **9** ב-`AccType`.
- באיחוד: **~90 סוגים ייחודיים** — 83 מהממיר + 7 ייחודיים-למדידה (סימון×3, פתח-עד-הרצפה, פאנל, אובייקט-עגול, הנמכה-עם-מזגן).
- **15** ממופים לקורפוס ORDX אמיתי; השאר הרחבה עצמאית מעבר ל-InnoDraw/Raumplan.

**קבצים קשורים:** `CONVERTER_BRIDGE.md` (הגשר המלא + רשימת-הפערים), `../../ordx-pdp-converter/docs/{elements_catalog,elements_schema}.md`, `SOL_FORMAT.md`.
