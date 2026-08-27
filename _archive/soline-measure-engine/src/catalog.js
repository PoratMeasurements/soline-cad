// ============================================================================
// Soline Measurement Engine · Element Catalog (DXF Master Database — v0)
// ----------------------------------------------------------------------------
// The library the surveyor picks from in the field: WHAT to measure, and HOW to
// position it — by CENTER + OFFSET (מרכז + היסט) + height, per element.
// Derived from the Soline spec "מסד נתונים למדידת אלמנטים בשלד ובגמר".
//
// Positioning method (locateBy) — the heart of "centers/offsets":
//   point    → מרכז: היסט לאורך המאחז + גובה              (שקע, ספוט, ניקוז, קופסה)
//   array    → מערך: מרכז ראשון + כמות + מרווח מרכזים       (שורת קופסאות/ספוטים)
//   span     → מתיחה: נקודת התחלה→סוף (היסטים)             (צנרת, פרופיל לד, תעלה)
//   opening  → פתח: היסט מפינה + רוחב (+גובה, סף)          (דלת, חלון, נישה)
//   area     → שטח: מרכז + רוחב×עומק (+גובה)               (קופסת רצפה, קסטת מיזוג)
// host: wall | floor | ceiling | freestanding   ·  phase: shell(שלד) | finish(גמר) | both
// ============================================================================

"use strict";

const LOCATE = {
  point:   "מרכז — היסט לאורך המאחז + גובה",
  array:   "מערך — מרכז ראשון + כמות + מרווח מרכזים",
  span:    "מתיחה — נקודת התחלה וסוף (היסטים)",
  opening: "פתח — היסט מפינה + רוחב (+גובה, סף)",
  area:    "שטח — מרכז + רוחב×עומק (+גובה)",
};

const PHASE = { shell: "שלד", finish: "גמר", both: "שלד+גמר" };

// Taxonomy — 4 parts, matching the spec.
const PARTS = [
  { id: 1, icon: "🔌", name: "חשמל, תאורה, תקשורת ובקרה" },
  { id: 2, icon: "💧", name: "אינסטלציה, ניקוז, ביוב, גז וריצוף" },
  { id: 3, icon: "🚪", name: "דלתות, חלונות, אלומיניום ומיגון" },
  { id: 4, icon: "🏗️", name: "בנייה, תקרות, מדרגות ומיזוג אוויר" },
];

// --- Element definitions ----------------------------------------------------
// e(id, part, section, group, nameHe, {phase, host, locateBy, captures, sizes, dims, symbol, layer, notes})
function e(id, part, section, group, nameHe, o) {
  return {
    id, part, section, group, nameHe,
    phase: o.phase || "both",
    host: o.host || "wall",
    locateBy: o.locateBy || "point",
    captures: o.captures || ["offset", "height"],
    sizes: o.sizes || null,
    dims: o.dims || null,           // numeric: {diaMm, spacingMm, wMm, hMm ...}
    symbol: o.symbol || "dot",
    layer: o.layer || "GEN",
    notes: o.notes || null,
  };
}

const ELEMENTS = [
  // ===== PART 1 · חשמל =====
  e("elec.conduit.rigid", 1, "1.1", "מובלים בשלד", "צינור מריכף קשיח", {
    phase: "shell", host: "wall", locateBy: "span", captures: ["startOffset", "endOffset", "height"],
    sizes: ['16', '20', '25', '32', '40', '50'], dims: { diaMm: 20 }, symbol: "conduit", layer: "ELEC-CONDUIT" }),
  e("elec.conduit.flex", 1, "1.1", "מובלים בשלד", "צינור גלי/שרשורי", {
    phase: "shell", locateBy: "span", captures: ["startOffset", "endOffset", "height"],
    sizes: ['16', '20', '25', '29', '32', '40', '50'], symbol: "conduit", layer: "ELEC-CONDUIT" }),
  e("elec.tray", 1, "1.1", "מובלים בשלד", "סולם/מגש כבלים", {
    phase: "shell", locateBy: "span", captures: ["startOffset", "endOffset", "height"],
    sizes: ['100', '200', '300', '400', '500', '600'], dims: { blockMm: 55 }, symbol: "tray", layer: "ELEC-TRAY", notes: "רוחב במ״מ; גובה חסימה 50–60" }),
  e("elec.underfloor", 1, "1.1", "מובלים בשלד", "מובל פח שקוע רצפה", {
    phase: "shell", host: "floor", locateBy: "span", captures: ["startXY", "endXY"],
    sizes: ['150×25', '250×30'], symbol: "tray", layer: "ELEC-FLOORDUCT" }),
  e("elec.box.gvis", 1, "1.2", "קופסאות ומארזים", "קופסת גֶוִיס מודולרית", {
    phase: "shell", host: "wall", locateBy: "point", captures: ["offset", "height"],
    sizes: ['3M', '4M', '6M', '7M', '3+3', '4+4'], symbol: "box", layer: "ELEC-BOX" }),
  e("elec.box.gvis.row", 1, "1.2", "קופסאות ומארזים", "רצף קופסאות משורשרות", {
    phase: "shell", host: "wall", locateBy: "array", captures: ["firstCenter", "count", "spacing", "height"],
    dims: { spacingMm: 71 }, symbol: "box", layer: "ELEC-BOX", notes: "מרווח מרכזים 71 מ״מ" }),
  e("elec.box.round55", 1, "1.2", "קופסאות ומארזים", "קופסה עגולה 55", {
    phase: "shell", host: "wall", locateBy: "point", captures: ["offset", "height"],
    sizes: ['סטנדרט', 'עמוקה'], dims: { diaMm: 55 }, symbol: "circle", layer: "ELEC-BOX" }),
  e("elec.box.7x7", 1, "1.2", "קופסאות ומארזים", "קופסת חיבורים 7×7", {
    phase: "shell", locateBy: "point", dims: { wMm: 70, hMm: 70 }, symbol: "box", layer: "ELEC-BOX" }),
  e("elec.box.10x10", 1, "1.2", "קופסאות ומארזים", "קופסת חיבורים 10×10", {
    phase: "shell", locateBy: "point", dims: { wMm: 100, hMm: 100 }, symbol: "box", layer: "ELEC-BOX" }),
  e("elec.box.10x20", 1, "1.2", "קופסאות ומארזים", "קופסת חלוקה 10×20", {
    phase: "shell", locateBy: "point", dims: { wMm: 100, hMm: 200 }, symbol: "box", layer: "ELEC-BOX" }),
  e("elec.box.ac", 1, "1.2", "קופסאות ומארזים", "מולטיבוקס למזגן", {
    phase: "shell", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "box", layer: "ELEC-BOX" }),
  e("elec.floorbox", 1, "1.2", "קופסאות ומארזים", "קופסת רצפה שקועה (Pop-Up)", {
    host: "floor", locateBy: "area", captures: ["centerXY", "size"],
    sizes: ['200×200', '300×300', '2 מודול', '4 מודול'], symbol: "floorbox", layer: "ELEC-FLOORBOX" }),
  e("elec.outlet.power", 1, "1.3", "אביזרי קצה", "שקע כוח", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"],
    sizes: ['ישראלי 16A', 'שוקו', 'מוגן מים IP55', 'כפול קומפקטי', 'USB A/C'], symbol: "outlet", layer: "ELEC-FIN" }),
  e("elec.outlet.3ph", 1, "1.3", "אביזרי קצה", "שקע תלת-פאזי סיקון", {
    phase: "finish", host: "wall", locateBy: "point", sizes: ['16A', '32A'], symbol: "outlet", layer: "ELEC-FIN" }),
  e("elec.outlet.cooktop", 1, "1.3", "אביזרי קצה", "שקע כיריים שטוח", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "outlet", layer: "ELEC-FIN", notes: "קריטי למטבח" }),
  e("elec.switch", 1, "1.3", "אביזרי קצה", "מפסק", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"],
    sizes: ['בודד', 'כפול', 'משולש', 'מחלף/צלב', 'דימר', 'מגע זכוכית', 'תריס'], symbol: "switch", layer: "ELEC-FIN" }),
  e("elec.data", 1, "1.3", "תקשורת ומדיה", "שקע תקשורת", {
    phase: "finish", host: "wall", locateBy: "point", sizes: ['רשת Cat6', 'Cat7', 'טלפון RJ11', 'TV/RF', 'HDMI', 'USB-Data', 'רמקול'], symbol: "data", layer: "ELEC-DATA" }),
  e("light.spot.box", 1, "1.4", "תאורה", "קופסת ביטון לספוט", {
    phase: "shell", host: "ceiling", locateBy: "point", captures: ["centerXY"],
    sizes: ['עגולה', 'מרובעת', 'Trimless'], symbol: "spot", layer: "LIGHT-SHELL" }),
  e("light.spot.row", 1, "1.4", "תאורה", "שורת ספוטים", {
    phase: "shell", host: "ceiling", locateBy: "array", captures: ["firstCenterXY", "count", "spacing", "direction"], symbol: "spot", layer: "LIGHT-SHELL", notes: "מרווח מרכזים" }),
  e("light.led.profile", 1, "1.4", "תאורה", "פרופיל לד/קרניז", {
    host: "ceiling", locateBy: "span", captures: ["startXY", "endXY"],
    sizes: ['שקוע גבס', 'תלוי', 'פינתי 45°', 'Wall Washer', 'Neon Flex'], symbol: "led", layer: "LIGHT-LED" }),
  e("light.panel", 1, "1.4", "תאורה", "פאנל לד", {
    phase: "finish", host: "ceiling", locateBy: "area", captures: ["centerXY"], sizes: ['60×60', '30×120'], symbol: "panel", layer: "LIGHT-FIN" }),
  e("light.track", 1, "1.4", "תאורה", "פס צבירה", {
    host: "ceiling", locateBy: "span", captures: ["startXY", "endXY"], sizes: ['חד-פאזי', 'תלת-פאזי', 'מגנטי', 'שקוע'], symbol: "track", layer: "LIGHT-TRACK" }),
  e("elec.panel", 1, "1.5", "ארונות ובקרה", "לוח חשמל", {
    phase: "finish", host: "wall", locateBy: "area", captures: ["centerXY", "size", "height"], sizes: ['12M', '24M', '36M', '48M', 'שקוע', 'צמוד'], symbol: "cabinet", layer: "ELEC-PANEL" }),
  e("elec.rack", 1, "1.5", "ארונות ובקרה", "ארון תקשורת (Rack 19\")", {
    host: "wall", locateBy: "area", sizes: ['6U', '12U', '18U', '24U'], symbol: "cabinet", layer: "ELEC-RACK" }),
  e("sensor.motion", 1, "1.5", "חיישנים", "חיישן תנועה/נוכחות", {
    phase: "finish", host: "ceiling", locateBy: "point", captures: ["centerXY"], sizes: ['360° תקרה', 'קיר'], symbol: "sensor", layer: "ELEC-SENSOR" }),

  // ===== PART 2 · אינסטלציה =====
  e("plumb.supply", 2, "2.1", "צנרת בשלד", "הזנת מים", {
    phase: "shell", locateBy: "span", captures: ["startOffset", "endOffset", "height"],
    sizes: ['פקסגול 25/32/40', 'רב-שכבתי 16–32', 'PPR 20–63', 'פלדה 1/2–2'], symbol: "pipe", layer: "PLUMB-SUPPLY" }),
  e("plumb.drain", 2, "2.1", "צנרת בשלד", "ביוב/דלוחין", {
    phase: "shell", locateBy: "span", captures: ["startOffset", "endOffset", "height"],
    sizes: ['32', '40', '50', '75', '90', '110', '125', '160'], symbol: "pipe", layer: "PLUMB-DRAIN", notes: "קוטר במ״מ" }),
  e("plumb.niple", 2, "2.2", "קופסאות ומערכות סמויות", "ניפל מים 1/2\"", {
    phase: "shell", host: "wall", locateBy: "point", captures: ["offset", "height"],
    sizes: ['בודד', 'כפול'], dims: { spacingMm: 150 }, symbol: "niple", layer: "PLUMB-POINT", notes: "מרכז בין זוג 150 מ״מ" }),
  e("plumb.ibox", 2, "2.2", "קופסאות ומערכות סמויות", "אינטרפוץ נסתר (iBox)", {
    phase: "shell", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['3 דרך', '4 דרך'], symbol: "box", layer: "PLUMB-POINT" }),
  e("plumb.niagara", 2, "2.2", "קופסאות ומערכות סמויות", "מיכל הדחה סמוי (ניאגרה)", {
    phase: "shell", host: "wall", locateBy: "area", captures: ["centerX", "height"],
    sizes: ['סטנדרט', 'צרה 80', 'מונמכת 820', 'מונמכת 980', 'פינתית'], symbol: "cistern", layer: "PLUMB-CISTERN" }),
  e("plumb.floordrain", 2, "2.2", "ניקוז", "מחסום/ניקוז רצפה", {
    host: "floor", locateBy: "point", captures: ["centerXY"], sizes: ['עגול', 'מרובע'], symbol: "drain", layer: "PLUMB-DRAIN" }),
  e("plumb.linchannel", 2, "2.5", "ניקוז", "תעלת ניקוז ליניארית", {
    host: "floor", locateBy: "span", captures: ["startXY", "endXY"], sizes: ['גלויה', 'Tile Insert', 'זכוכית'], symbol: "channel", layer: "PLUMB-CHANNEL" }),
  e("plumb.sink", 2, "2.3", "כלים סניטריים", "כיור", {
    phase: "finish", host: "wall", locateBy: "area", captures: ["centerX", "height"],
    sizes: ['קו אפס', 'תחתונה', 'עליונה', 'אינטגרלי', 'Apron'], symbol: "sink", layer: "SANITARY" }),
  e("plumb.toilet", 2, "2.3", "כלים סניטריים", "אסלה", {
    phase: "finish", host: "wall", locateBy: "area", captures: ["centerX"],
    sizes: ['מונובלוק', 'תלויה קצרה', 'תלויה סטנדרט', 'תלויה מוארכת', 'חכמה'], symbol: "toilet", layer: "SANITARY" }),
  e("plumb.faucet.wall", 2, "2.3", "ברזים", "ברז קיר", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "faucet", layer: "SANITARY" }),
  e("plumb.bath", 2, "2.3", "אמבטיות ומקלחונים", "אמבטיה/אגן מקלחון", {
    phase: "finish", host: "floor", locateBy: "area", captures: ["centerXY", "size"], sizes: ['מובנית', 'Free Standing', 'ג׳קוזי', 'אגן מקלחון'], symbol: "bath", layer: "SANITARY" }),
  e("gas.pipe", 2, "2.4", "גז", "צינור גז נחושת", {
    phase: "shell", locateBy: "span", captures: ["startOffset", "endOffset", "height"], sizes: ['20', '25'], symbol: "pipe", layer: "GAS" }),
  e("gas.valve", 2, "2.4", "גז", "ברז גז קיר", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['גלוי', 'שקוע'], symbol: "valve", layer: "GAS" }),
  e("floor.servicebox", 2, "2.5", "ריצוף", "קופסת שירות בריצוף", {
    host: "floor", locateBy: "area", captures: ["centerXY", "size"], sizes: ['פופ-אפ בודדת', 'כפולה', 'Tile Insert'], symbol: "floorbox", layer: "FLOOR-BOX" }),

  // ===== PART 3 · דלתות וחלונות =====
  e("door.hinged", 3, "3.1", "דלתות", "דלת ציר", {
    phase: "finish", host: "wall", locateBy: "opening", captures: ["offset", "width", "height", "swing"],
    sizes: ['בודדת', 'כפולה'], symbol: "door", layer: "DOOR", notes: "כיוון פתיחה: RI/LI/RO/LO" }),
  e("door.sliding", 3, "3.1", "דלתות", "דלת הזזה", {
    phase: "finish", host: "wall", locateBy: "opening", captures: ["offset", "width", "height"], sizes: ['אסם/Magic', 'כיס/סקריניו'], symbol: "door", layer: "DOOR" }),
  e("door.pivot", 3, "3.1", "דלתות", "דלת פיווט", {
    phase: "finish", host: "wall", locateBy: "opening", captures: ["offset", "width", "height"], symbol: "door", layer: "DOOR" }),
  e("door.mamad", 3, "3.1", "דלתות", "דלת ממ\"ד (פלדה)", {
    phase: "shell", host: "wall", locateBy: "opening", captures: ["offset", "width", "height"], symbol: "door", layer: "MAMAD" }),
  e("door.frame", 3, "3.1", "משקופים", "משקוף", {
    host: "wall", locateBy: "opening", captures: ["offset", "width", "height"], sizes: ['עץ חובק', 'אלומיניום', 'פלדה', 'נסתר סמוי'], symbol: "frame", layer: "DOOR-FRAME" }),
  e("win.hinged", 3, "3.2", "חלונות", "חלון (לפי פתיחה)", {
    phase: "finish", host: "wall", locateBy: "opening", captures: ["offset", "width", "height", "sill"],
    sizes: ['ציר', 'דריי-קיפ', 'קיפ', 'קבוע Fix', 'רפפה', 'הזזה', 'גג/סקיילייט'], symbol: "window", layer: "WINDOW" }),
  e("win.vitrine", 3, "3.2", "ויטרינות", "ויטרינה/הרם-הזז", {
    phase: "finish", host: "wall", locateBy: "opening", captures: ["offset", "width", "height", "sill"],
    sizes: ['כנף על כנף', 'Lift & Slide', 'אקורדיון', 'קיר מסך'], symbol: "window", layer: "WINDOW" }),
  e("win.shutterbox", 3, "3.2", "ארגזי תריס", "ארגז תריס", {
    phase: "shell", host: "wall", locateBy: "opening", captures: ["offset", "width", "boxHeight"], sizes: ['מונובלוק בולט', 'נסתר קו-אפס'], symbol: "shutter", layer: "SHUTTER" }),
  e("win.sill", 3, "3.2", "אדנים", "אדן חלון", {
    phase: "finish", host: "wall", locateBy: "span", captures: ["startOffset", "endOffset", "protrusion"], sizes: ['שיש/אבן', 'אלומיניום'], symbol: "sill", layer: "SILL", notes: "מדידת בליטה ו״אוזניים״" }),

  // ===== PART 4 · בנייה, תקרות, מדרגות, מיזוג =====
  e("build.wall.shell", 4, "4.3", "קירות בשלד", "קיר בלוק/בטון", {
    phase: "shell", locateBy: "span", captures: ["length", "thickness", "height"],
    sizes: ['בטון מזוין', 'בלוק 7', 'בלוק 10', 'בלוק 22', 'פומיס', 'איטונג'], symbol: "wall", layer: "WALL-SHELL", notes: "עובי בס״מ" }),
  e("build.partition", 4, "4.3", "מחיצות גמר", "מחיצת גבס", {
    phase: "finish", locateBy: "span", captures: ["length", "thickness", "height"],
    sizes: ['לבן רגיל', 'ירוק עמיד מים', 'ורוד חסין אש', 'כחול אקוסטי', 'זכוכית'], symbol: "wall", layer: "WALL-PART" }),
  e("build.column", 4, "4.3", "עמודים וקורות", "עמוד", {
    locateBy: "area", captures: ["centerXY", "size"], sizes: ['בטון מרובע', 'בטון עגול', 'פלדה HEB', 'פלדה IPE'], symbol: "column", layer: "COLUMN" }),
  e("build.niche", 4, "4.2", "נישות", "נישה בקיר", {
    host: "wall", locateBy: "opening", captures: ["offset", "width", "height", "depth", "sill"],
    sizes: ['גבס דקורטיבית', 'חצובה בבטון', 'רטובה במקלחון', 'קמין/טלוויזיה'], symbol: "niche", layer: "NICHE" }),
  e("build.levelchange", 4, "4.2", "שינויי מפלס", "מדרגת מפלס/רמפה", {
    host: "floor", locateBy: "span", captures: ["startXY", "endXY", "riseHeight"], sizes: ['מדרגה', 'רמפה', 'במה מוגבהת'], symbol: "step", layer: "LEVEL" }),
  e("build.stairs", 4, "4.3", "מדרגות", "מהלך מדרגות", {
    locateBy: "area", captures: ["footprint", "steps", "riser", "tread"],
    sizes: ['ישר', 'ר׳', 'ח׳', 'לוליינית/רדיוס', 'צפות'], symbol: "stairs", layer: "STAIRS", notes: "מדידת שלח, רום, פודסטים" }),
  e("ceil.drop", 4, "4.1", "הנמכות תקרה", "הנמכת גבס", {
    host: "ceiling", locateBy: "area", captures: ["footprint", "dropHeight"], sizes: ['חלקה מלאה', 'קרניז נסתר', 'Shadow Line', 'מדורגת'], symbol: "ceil", layer: "CEIL-DROP" }),
  e("ceil.acoustic", 4, "4.1", "תקרות פריקות", "תקרה אקוסטית", {
    host: "ceiling", locateBy: "area", captures: ["footprint"], sizes: ['60×60', 'מגשי אלומיניום', 'Baffle', 'מתוחה'], symbol: "ceil", layer: "CEIL-ACOUSTIC" }),
  e("hvac.evap", 4, "4.4", "מיזוג אוויר", "יחידת מאייד בשלד", {
    phase: "shell", host: "ceiling", locateBy: "area", captures: ["centerXY", "size", "blockHeight"],
    sizes: ['מיני-מרכזי (חסימה 320–400)', 'קנאל דקה Slim 200–240', 'קסטה 60×60', 'קסטה 90×90'], symbol: "hvac", layer: "HVAC" }),
  e("hvac.grille", 4, "4.4", "מיזוג אוויר", "גריל/מפזר בגמר", {
    phase: "finish", host: "ceiling", locateBy: "span", captures: ["startXY", "endXY"],
    sizes: ['סטריפ ליניארי', 'סלוט קו-אפס 1–4', 'Egg-Crate', 'אנמוסטט עגול'], symbol: "grille", layer: "HVAC-GRILLE" }),
  e("hvac.duct", 4, "4.4", "מיזוג אוויר", "תעלת פח/שרשור", {
    phase: "shell", host: "ceiling", locateBy: "span", captures: ["startXY", "endXY", "height"], sizes: ['6"', '8"', '10"', '12"', '14"'], symbol: "duct", layer: "HVAC-DUCT" }),
  e("hvac.hood", 4, "4.4", "מיזוג אוויר", "קולט אדים", {
    phase: "finish", host: "ceiling", locateBy: "area", captures: ["centerXY", "size"], sizes: ['עצמאי', 'אינטגרלי', 'שקוע תקרה'], symbol: "hood", layer: "HVAC" }),

  // ===== PART 1 · חשמל — הרחבה =====
  e("elec.conduit.fire", 1, "1.1", "מובלים בשלד", "צינור חסין אש (כתום/אדום)", {
    phase: "shell", host: "wall", locateBy: "span", captures: ["startOffset", "endOffset", "height"],
    sizes: ['20', '25', '32', '40'], dims: { diaMm: 25 }, symbol: "conduit", layer: "ELEC-CONDUIT", notes: "מעגלי חירום/כיבוי" }),
  e("elec.conduit.steel", 1, "1.1", "מובלים בשלד", "צינור פלדה מגולוון (סקדיול 40)", {
    phase: "shell", host: "wall", locateBy: "span", captures: ["startOffset", "endOffset", "height"],
    sizes: ['1/2"', '3/4"', '1"', '1.5"', '2"'], symbol: "conduit", layer: "ELEC-CONDUIT" }),
  e("elec.cable.xlpe", 1, "1.1", "מובלים בשלד", "כבל ישיר XLPE", {
    phase: "shell", locateBy: "span", captures: ["startOffset", "endOffset", "height"],
    sizes: ['3×1.5', '3×2.5', '5×2.5', '5×4', '5×6', '5×10', '5×16'], symbol: "conduit", layer: "ELEC-CABLE" }),
  e("elec.box.sikon", 1, "1.2", "קופסאות ומארזים", "קופסת שקע סיקון תלת-פאזי", {
    phase: "shell", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "box", layer: "ELEC-BOX" }),
  e("elec.box.pashta", 1, "1.2", "קופסאות ומארזים", "קופסת פשט\"ה", {
    phase: "shell", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "box", layer: "ELEC-BOX" }),
  e("elec.box.acoustic", 1, "1.2", "קופסאות ומארזים", "קופסה אקוסטית/חסינת אש (Putty Pad)", {
    phase: "shell", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "box", layer: "ELEC-BOX" }),
  e("elec.box.flush", 1, "1.2", "קופסאות ומארזים", "קופסת ביטון קו-אפס (Sora/Ekinex)", {
    phase: "shell", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "box", layer: "ELEC-BOX" }),
  e("elec.box.speaker", 1, "1.2", "קופסאות ומארזים", "קופסת גב לרמקול (Back Box)", {
    phase: "shell", host: "ceiling", locateBy: "point", captures: ["centerXY"], symbol: "box", layer: "ELEC-BOX" }),
  e("elec.floorbox.tile", 1, "1.2", "קופסאות ומארזים", "קופסת רצפה שקועה למילוי אריח/פרקט", {
    host: "floor", locateBy: "area", captures: ["centerXY", "size"], sizes: ['200×200', '300×300'], symbol: "floorbox", layer: "ELEC-FLOORBOX" }),
  e("elec.frame.cover", 1, "1.3", "מסגרות גמר", "מסגרת הלבשה", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"],
    sizes: ['מלבנית 3M', '4M', '6M', '7M', 'ריבועית בודדת', 'עד חמישייה', 'קו-אפס Flush'], symbol: "frame", layer: "ELEC-FIN" }),
  e("elec.outlet.waterproof", 1, "1.3", "אביזרי קצה", "שקע מוגן מים IP55/IP66", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "outlet", layer: "ELEC-FIN" }),
  e("elec.outlet.usbwireless", 1, "1.3", "אביזרי קצה", "שקע USB/טעינה אלחוטית קיר", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['USB-A/C', 'טעינה אלחוטית', 'מדיה משולב'], symbol: "outlet", layer: "ELEC-FIN" }),
  e("elec.switch.button", 1, "1.3", "אביזרי קצה", "לחצן קפיצי מואר", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "switch", layer: "ELEC-FIN" }),
  e("elec.switch.boiler", 1, "1.3", "אביזרי קצה", "מפסק דו-קטבי לדוד", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "switch", layer: "ELEC-FIN" }),
  e("elec.switch.acpaket", 1, "1.3", "אביזרי קצה", "מפסק פקט למזגן", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['16A', '32A', '40A'], symbol: "switch", layer: "ELEC-FIN" }),
  e("elec.switch.card", 1, "1.3", "אביזרי קצה", "מפסק כרטיס למלונות", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "switch", layer: "ELEC-FIN" }),
  e("elec.switch.emergency", 1, "1.3", "אביזרי קצה", "מפסק חירום פטריה", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "switch", layer: "ELEC-FIN" }),
  e("elec.switch.dimmer", 1, "1.3", "אביזרי קצה", "עמעם (דימר)", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['מכני', 'אלקטרוני', 'מגע'], symbol: "switch", layer: "ELEC-FIN" }),
  e("elec.data.media", 1, "1.3", "תקשורת ומדיה", "שקע מדיה משולב", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['HDMI כפול', 'RCA/Toslink', 'מברשת/מעבר כבלים'], symbol: "data", layer: "ELEC-DATA" }),
  e("light.wire.tail", 1, "1.4", "תאורה", "נקודת חוט חשוף (זנב)", {
    phase: "shell", host: "ceiling", locateBy: "point", captures: ["centerXY"], sizes: ['זנב תקרה', 'זנב קיר'], symbol: "dot", layer: "LIGHT-SHELL" }),
  e("light.transformer.box", 1, "1.4", "תאורה", "קופסת שנאים מרכזית", {
    phase: "shell", host: "ceiling", locateBy: "point", captures: ["centerXY"], symbol: "box", layer: "LIGHT-SHELL" }),
  e("light.cylinder", 1, "1.4", "תאורה", "צילינדר צמוד", {
    phase: "finish", host: "ceiling", locateBy: "point", captures: ["centerXY"], sizes: ['עגול', 'קוביה'], symbol: "spot", layer: "LIGHT-FIN" }),
  e("light.updown", 1, "1.4", "תאורה", "גוף אפ-דאון", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "spot", layer: "LIGHT-FIN" }),
  e("light.stair", 1, "1.4", "תאורה", "תאורת מדרגות שקועה", {
    host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "led", layer: "LIGHT-FIN" }),
  e("light.emergency", 1, "1.4", "תאורה", "תאורת חירום/שלט יציאה", {
    phase: "finish", host: "ceiling", locateBy: "point", captures: ["centerXY", "height"], sizes: ['חירום', 'שלט יציאה'], symbol: "panel", layer: "LIGHT-FIN" }),
  e("elec.cabinet.meter", 1, "1.5", "ארונות ובקרה", "ארון מוני חשמל", {
    host: "wall", locateBy: "area", captures: ["centerXY", "size", "height"], symbol: "cabinet", layer: "ELEC-METER" }),
  e("elec.screen.intercom", 1, "1.5", "מסכים ובקרה", "מסך אינטרקום/טאבלט בית חכם", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['7"', '10"'], symbol: "panel", layer: "ELEC-CTRL" }),
  e("elec.thermostat", 1, "1.5", "מסכים ובקרה", "תרמוסטט מיזוג/תת-רצפתי", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "sensor", layer: "ELEC-CTRL" }),
  e("sensor.smoke", 1, "1.5", "חיישנים", "גלאי עשן", {
    phase: "finish", host: "ceiling", locateBy: "point", captures: ["centerXY"], symbol: "sensor", layer: "ELEC-SENSOR" }),
  e("sensor.alarm", 1, "1.5", "חיישנים", "גלאי נפח/צופר אזעקה", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['נפח פנימי', 'נפח חיצוני', 'צופר', 'קודן'], symbol: "sensor", layer: "ELEC-SENSOR" }),
  e("sensor.gasflood", 1, "1.5", "חיישנים", "גלאי גז/הצפה", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "sensor", layer: "ELEC-SENSOR" }),
  e("elec.ups", 1, "1.5", "ציוד כבד", "מערכת אל-פסק (UPS)", {
    host: "floor", locateBy: "area", captures: ["centerXY", "size"], symbol: "cabinet", layer: "ELEC-HEAVY" }),
  e("elec.ev", 1, "1.5", "ציוד כבד", "עמדת טעינה לרכב חשמלי (EV)", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "cabinet", layer: "ELEC-HEAVY" }),

  // ===== PART 2 · אינסטלציה — הרחבה =====
  e("plumb.supply.ppr", 2, "2.1", "צנרת בשלד", "צנרת PPR/פלדה מרותכת", {
    phase: "shell", locateBy: "span", captures: ["startOffset", "endOffset", "height"],
    sizes: ['PPR 20', '32', '40', '63', 'פלדה 1/2"–2"'], symbol: "pipe", layer: "PLUMB-SUPPLY" }),
  e("plumb.fitting", 2, "2.1", "מחברים בשלד", "זוויתן/הסתעפות/רדוקציה", {
    phase: "shell", locateBy: "point", captures: ["offset", "height"], sizes: ['45°', '90°', 'T', 'Y', 'רדוקציה', 'מושוף'], symbol: "pipe", layer: "PLUMB-FITTING" }),
  e("plumb.wallseat", 2, "2.2", "קופסאות ומערכות סמויות", "תושבת ברז קיר לכיור", {
    phase: "shell", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "niple", layer: "PLUMB-POINT" }),
  e("plumb.niagara.gypsum", 2, "2.2", "קופסאות ומערכות סמויות", "ניאגרה קיר גבס (Self-Supporting)", {
    phase: "shell", host: "wall", locateBy: "area", captures: ["centerX", "height"], sizes: ['סטנדרט', 'Freestanding'], symbol: "cistern", layer: "PLUMB-CISTERN" }),
  e("plumb.drainbox.wall", 2, "2.2", "ניקוז", "קופסת ניקוז שקועה קיר", {
    phase: "shell", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['מכונת כביסה', 'מזגן'], symbol: "drain", layer: "PLUMB-DRAIN" }),
  e("plumb.faucet.nil", 2, "2.3", "ברזים", "ברז ניל", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['בודד', 'כפול'], symbol: "faucet", layer: "SANITARY" }),
  e("plumb.faucet.flower", 2, "2.3", "ברזים", "ברז פרח", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"],
    sizes: ['נשלף', 'קפיץ תעשייתי', 'פיה קבועה', 'פיה גמישה', '3 נתיבים', 'מים רותחים', 'אלקטרוני'], symbol: "faucet", layer: "SANITARY" }),
  e("plumb.faucet.floor", 2, "2.3", "ברזים", "ברז פיוט מהרצפה (Free Standing)", {
    phase: "finish", host: "floor", locateBy: "point", captures: ["centerXY"], symbol: "faucet", layer: "SANITARY" }),
  e("plumb.faucet.ext", 2, "2.3", "ברזים", "סוללה חיצונית/מוט פינוק", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "faucet", layer: "SANITARY" }),
  e("plumb.siphon", 2, "2.3", "סיפונים", "סיפון", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['כוס פלסטיק', 'כרום', 'Space Saver', 'שוכב'], symbol: "drain", layer: "SANITARY" }),
  e("plumb.urinal", 2, "2.3", "כלים סניטריים", "משתנה קיר", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "toilet", layer: "SANITARY" }),
  e("plumb.disposer", 2, "2.3", "כלים סניטריים", "טוחן אשפה", {
    phase: "finish", host: "floor", locateBy: "point", captures: ["centerXY"], symbol: "drain", layer: "SANITARY" }),
  e("plumb.flushbtn", 2, "2.3", "כלים סניטריים", "לחצן ניאגרה סמויה", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['מכני', 'פנאומטי', 'אלקטרוני'], symbol: "switch", layer: "SANITARY" }),
  e("plumb.showerchannel", 2, "2.3", "אמבטיות ומקלחונים", "תעלת ניקוז מקלחון ליניארית", {
    host: "floor", locateBy: "span", captures: ["startXY", "endXY"], sizes: ['גלויה', 'Tile Insert', 'זכוכית'], symbol: "channel", layer: "PLUMB-CHANNEL" }),
  e("gas.meter", 2, "2.4", "גז", "מונה גז דירתי", {
    host: "wall", locateBy: "area", captures: ["centerXY", "size", "height"], symbol: "cabinet", layer: "GAS" }),
  e("gas.detector", 2, "2.4", "גז", "גלאי דליפת גז עם סולנואיד", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "sensor", layer: "GAS" }),
  e("gas.quickconn", 2, "2.4", "גז", "שקע חיבור מהיר לגריל/טאבון", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], symbol: "valve", layer: "GAS" }),
  e("floor.draingrille", 2, "2.5", "ריצוף", "רשת ניקוז בריצוף", {
    host: "floor", locateBy: "point", captures: ["centerXY"], sizes: ['נירוסטה עגולה', 'מרובעת', 'Tile Insert', 'נקז מרפסת', 'קולטן גשם'], symbol: "drain", layer: "FLOOR-DRAIN" }),
  e("floor.accesscover", 2, "2.5", "ריצוף", "מכסה ביקורת", {
    host: "floor", locateBy: "area", captures: ["centerXY", "size"], sizes: ['גלוי אטום ריח', 'Tile Infill', 'פלאג Cleanout'], symbol: "drain", layer: "FLOOR-ACCESS" }),
  e("floor.profile", 2, "2.5", "ריצוף", "פרופיל בריצוף", {
    host: "floor", locateBy: "span", captures: ["startXY", "endXY"], sizes: ['מעבר T-Profile', 'שיפוע מקלחון', 'שטיח כניסה שקוע'], symbol: "channel", layer: "FLOOR-PROFILE" }),
  e("floor.stairnose", 2, "2.5", "ריצוף", "פרופיל אף מדרגה", {
    locateBy: "span", captures: ["startXY", "endXY"], symbol: "step", layer: "FLOOR-PROFILE" }),
  e("floor.doorstop", 2, "2.5", "ריצוף", "מעצור דלת", {
    host: "floor", locateBy: "point", captures: ["centerXY"], symbol: "dot", layer: "FLOOR-ACCESS" }),

  // ===== PART 3 · דלתות, חלונות ומיגון — הרחבה =====
  e("door.folding", 3, "3.1", "דלתות", "דלת מתקפלת (הרמוניקה/Bi-Fold)", {
    phase: "finish", host: "wall", locateBy: "opening", captures: ["offset", "width", "height"], symbol: "door", layer: "DOOR" }),
  e("door.fire", 3, "3.1", "דלתות", "דלת אש", {
    phase: "finish", host: "wall", locateBy: "opening", captures: ["offset", "width", "height"], symbol: "door", layer: "DOOR" }),
  e("door.glass", 3, "3.1", "דלתות", "דלת זכוכית Frameless", {
    phase: "finish", host: "wall", locateBy: "opening", captures: ["offset", "width", "height"], symbol: "door", layer: "DOOR" }),
  e("door.flush", 3, "3.1", "דלתות", "דלת קו-אפס/פרופיל בלגי", {
    phase: "finish", host: "wall", locateBy: "opening", captures: ["offset", "width", "height", "swing"], sizes: ['פתיחה פנימה', 'פתיחה החוצה', 'פרופיל בלגי'], symbol: "door", layer: "DOOR" }),
  e("door.mamad.slide", 3, "3.1", "דלתות", "דלת ממ\"ד הזזה", {
    phase: "shell", host: "wall", locateBy: "opening", captures: ["offset", "width", "height"], symbol: "door", layer: "MAMAD" }),
  e("door.hardware", 3, "3.1", "פרזול", "פרזול דלת", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"],
    sizes: ['ידית לחיצה', 'מנעול חכם', 'מחזיר עליון', 'מחזיר רצפתי', 'סף אקוסטי מתרומם', 'ציר נסתר'], symbol: "dot", layer: "DOOR-HW" }),
  e("win.guillotine", 3, "3.2", "חלונות", "חלון גיליוטינה/פיבוט", {
    phase: "finish", host: "wall", locateBy: "opening", captures: ["offset", "width", "height", "sill"], sizes: ['גיליוטינה', 'פיבוט מרכזי', 'קיפ הפוך', 'טלסקופי'], symbol: "window", layer: "WINDOW" }),
  e("win.bay", 3, "3.2", "חלונות", "חלון מפרץ (Bay) / סקיילייט", {
    phase: "finish", host: "wall", locateBy: "opening", captures: ["offset", "width", "height", "sill"], sizes: ['מפרץ Bay', 'סקיילייט גג'], symbol: "window", layer: "WINDOW" }),
  e("win.blind", 3, "3.2", "הצללה", "צלון/סוכך/רשת", {
    phase: "finish", host: "wall", locateBy: "opening", captures: ["offset", "width", "boxHeight"],
    sizes: ['ונציאני פנימי Z90', 'ונציאני חיצוני S90', 'סוכך Zip', 'רשת הזזה', 'רשת גלילה', 'פליסה'], symbol: "shutter", layer: "SHUTTER" }),
  e("win.rollershutter", 3, "3.2", "ארגזי תריס", "תריס גלילה חשמלי", {
    phase: "finish", host: "wall", locateBy: "opening", captures: ["offset", "width", "boxHeight"], symbol: "shutter", layer: "SHUTTER" }),
  e("win.sill.threshold", 3, "3.2", "אדנים וספים", "סף ויטרינה", {
    phase: "finish", host: "wall", locateBy: "span", captures: ["startOffset", "endOffset", "protrusion"], sizes: ['מוגבה', 'שטוח Flush Threshold'], symbol: "sill", layer: "SILL" }),
  e("win.motor", 3, "3.2", "פרזול אלומיניום", "מנוע/זרוע פתיחת חלון", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['מנוע חשמלי', 'זרוע הגבלה', 'ידית חפן שקועה'], symbol: "dot", layer: "WINDOW-HW" }),
  e("mamad.frame", 3, "3.3", "מיגון ממ\"ד", "משקוף עיוור פלדה בשלד", {
    phase: "shell", host: "wall", locateBy: "opening", captures: ["offset", "width", "height"], symbol: "frame", layer: "MAMAD" }),
  e("mamad.window", 3, "3.3", "מיגון ממ\"ד", "חלון הדף/אלומיניום אטום גזים", {
    phase: "shell", host: "wall", locateBy: "opening", captures: ["offset", "width", "height", "sill"], sizes: ['הדף חיצוני', 'דריי-קיפ פנימי אטום'], symbol: "window", layer: "MAMAD" }),
  e("mamad.ventpipe", 3, "3.3", "מיגון ממ\"ד", "צינור אוורור/הדף", {
    phase: "shell", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['4"', '8"'], symbol: "pipe", layer: "MAMAD", notes: "מבוטן בקיר; שסתום מופעל הדף" }),
  e("mamad.filter", 3, "3.3", "מיגון ממ\"ד", "מארז מערכת סינון אוויר", {
    phase: "finish", host: "wall", locateBy: "area", captures: ["centerXY", "size", "height"], symbol: "cabinet", layer: "MAMAD" }),

  // ===== PART 4 · בנייה, גיאומטריה ומיזוג — הרחבה =====
  e("ceil.stretch", 4, "4.1", "תקרות פריקות", "תקרה מתוחה (בריסול)", {
    host: "ceiling", locateBy: "area", captures: ["footprint"], symbol: "ceil", layer: "CEIL-STRETCH" }),
  e("ceil.baffle", 4, "4.1", "תקרות פריקות", "סרגלי עץ/פולימר (Baffle)", {
    host: "ceiling", locateBy: "area", captures: ["footprint", "direction"], symbol: "ceil", layer: "CEIL-BAFFLE" }),
  e("ceil.cornice", 4, "4.1", "הנמכות תקרה", "סינר/קרניז תאורה נסתרת", {
    host: "ceiling", locateBy: "span", captures: ["startXY", "endXY", "dropHeight"], sizes: ['סינר גבס', 'קרניז נסתר (תקרה צפה)', 'ניתוק אלומיניום Z'], symbol: "ceil", layer: "CEIL-DROP" }),
  e("build.corner", 4, "4.2", "קירות וזוויות", "פינה קטומה/קיר מעוקל", {
    phase: "shell", locateBy: "span", captures: ["startXY", "endXY", "angle"], sizes: ['קטומה 45°', 'קטומה 135°', 'אלכסוני', 'מעוקל רדיוס'], symbol: "wall", layer: "WALL-GEOM" }),
  e("build.column.cut", 4, "4.2", "קירות וזוויות", "עמוד קטום", {
    locateBy: "area", captures: ["centerXY", "size"], symbol: "column", layer: "COLUMN" }),
  e("build.beam", 4, "4.3", "עמודים וקורות", "קורת בטון בולטת/סמויה", {
    host: "ceiling", locateBy: "span", captures: ["startXY", "endXY", "depth", "width"], sizes: ['בולטת', 'סמויה'], symbol: "column", layer: "BEAM" }),
  e("build.railing", 4, "4.3", "מדרגות", "מעקה", {
    locateBy: "span", captures: ["startXY", "endXY", "height"], symbol: "stairs", layer: "RAILING" }),
  e("build.podest", 4, "4.3", "מדרגות", "פודסט/משטח ביניים", {
    locateBy: "area", captures: ["footprint", "height"], symbol: "step", layer: "STAIRS" }),
  e("hvac.cassette.slot", 4, "4.4", "מיזוג אוויר", "קסטה נתיב בודד/יחידה אנכית", {
    phase: "shell", host: "ceiling", locateBy: "area", captures: ["centerXY", "size", "blockHeight"], sizes: ['נתיב בודד', 'אנכית', 'לחץ סטטי גבוה'], symbol: "hvac", layer: "HVAC" }),
  e("hvac.plenum", 4, "4.4", "מיזוג אוויר", "פלנום/משתיק קול", {
    phase: "shell", host: "ceiling", locateBy: "area", captures: ["centerXY", "size"], sizes: ['אספקה', 'חוזר', 'גריל ליניארי', 'משתיק קול קווי'], symbol: "duct", layer: "HVAC-DUCT" }),
  e("hvac.vent", 4, "4.4", "אוורור ויניקה", "ונטה/מפוח קו", {
    host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['ונטת קיר', 'ונטת תקרה', 'מפוח קו נסתר'], symbol: "grille", layer: "HVAC-VENT" }),
  e("hvac.damper", 4, "4.4", "אוורור ופינוי עשן", "דמפר אש/פינוי עשן", {
    phase: "shell", host: "ceiling", locateBy: "point", captures: ["centerXY"], sizes: ['אש', 'פינוי עשן', 'ממונע טופ-זון', 'רפרפה אל-חוזר'], symbol: "duct", layer: "HVAC-DAMPER" }),
  e("hvac.accesspanel", 4, "4.4", "פתחי שירות", "פתח שירות מיזוג", {
    phase: "finish", host: "ceiling", locateBy: "area", captures: ["centerXY", "size"], sizes: ['אלומיניום בולט', 'נסתר קו-אפס Push'], symbol: "grille", layer: "HVAC-ACCESS" }),
  e("hvac.ctrl", 4, "4.4", "בקרה וניקוז", "בקרת מיזוג/משאבת ניקוז", {
    phase: "finish", host: "wall", locateBy: "point", captures: ["offset", "height"], sizes: ['תרמוסטט/שלט קיר', 'עינית IR', 'משאבת ניקוז'], symbol: "sensor", layer: "HVAC-CTRL" }),
];

// --- Query helpers ----------------------------------------------------------
function byPart(part) { return ELEMENTS.filter((x) => x.part === part); }
function byGroup(part) {
  const g = {};
  for (const el of byPart(part)) (g[el.group] = g[el.group] || []).push(el);
  return g;
}
function find(id) { return ELEMENTS.find((x) => x.id === id) || null; }
const stats = () => ({ parts: PARTS.length, elements: ELEMENTS.length, groups: new Set(ELEMENTS.map((e) => e.part + "/" + e.group)).size });

module.exports = { LOCATE, PHASE, PARTS, ELEMENTS, byPart, byGroup, find, stats };
