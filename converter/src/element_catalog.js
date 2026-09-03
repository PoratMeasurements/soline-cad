'use strict';
/*
 * element_catalog.js — מקור-האמת היחיד לכל אלמנט של Soline.
 * =============================================================================
 * טבלה משותפת אחת שממנה שולפים שלושת המייצאים (ORDX, DXF-2D, DXF-3D), כדי שסיווג,
 * מידות וסמלים יישארו עקביים בין הפורמטים. שמות-השדה וה-Class/Type הם המזהים
 * שכלי-היעד דורש כדי לקרוא את הקובץ (אינטראופרביליות); אומתו מול קובצי-הייחוס
 * שלנו — 15 האלמנטים המאומתים מקבלים Class/Type, שם-קטלוג ומידות ודאיים; כל
 * היתר מסווגים לפי החוקן (קטגוריה/שם) באופן שמרני ומסומן.
 *
 * חוזה קואורדינטות (ORDX, מקומי-לקיר):  X = לאורך הקיר · Y = גובה על הקיר ·
 *   Z = היסט-עומק מחוץ-למישור-הקיר. מידות: Width = לאורך הקיר, Depth = בליטה
 *   מהקיר לתוך החדר, Height = גובה אנכי. חלון/דלת: Height = גובה-הפתח, Depth =
 *   עובי-הפתח בקיר.
 *
 * API עיקרי:
 *   classify(nameOrItem) -> רשומה מלאה (ORDX Class/Type + measure + מידות +
 *                           discipline + סמל-2D + block-3D + שכבת-3D).
 *   resolve(name)        -> alias של classify (למי שמעביר שם בלבד).
 *   DISCIPLINES / list   -> קבועים לשיתוף.
 *
 * כל שם-תג/מחלקה/סוג נשמר מילולית באנגלית (כפי שהקורפוס דורש).
 */

const fs = require('fs');
const path = require('path');

// טעינת הקטלוג העברי המורחב (170 אלמנטים) — קריאה-בלבד, לשמות/מידות-ברירת-מחדל.
let ELEMENTS = [];
try {
  ELEMENTS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'elements.json'), 'utf8'));
} catch (_) { ELEMENTS = []; }

const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();

const BY_EN = new Map();
const BY_HE = new Map();
for (const e of ELEMENTS) {
  if (e.en) BY_EN.set(norm(e.en), e);
  if (e.he) BY_HE.set(norm(e.he), e);
}

// ---------------------------------------------------------------------------
// דיסציפלינות — קבוצת-הצבע/השכבה/הסמל שכל אלמנט משתייך אליה בשרטוט.
// לכל דיסציפלינה: סמל-2D ברירת-מחדל (מפתח ל-GLYPHS ב-export_dxf2d), block-3D
// ברירת-מחדל (מפתח ל-BLOCKS ב-export_dxf_pro) ושכבת-גוף-3D (Elem_*).
// ---------------------------------------------------------------------------
const DISC_DEFAULTS = {
  electrical: { sym2d: 'SOCKET', block3d: 'SOCKET', elem3d: 'Elem_Electrical' },
  plumbing:   { sym2d: 'WATER',  block3d: 'FAUCET', elem3d: 'Elem_Plumbing' },
  gas:        { sym2d: 'GAS',    block3d: 'GAS',    elem3d: 'Elem_Gas' },
  hvac:       { sym2d: 'HVAC',   block3d: 'CONTROLBOX', elem3d: 'Elem_HVAC' },
  lighting:   { sym2d: 'LIGHT',  block3d: 'LIGHTING',   elem3d: 'Elem_Lighting' },
  structural: { sym2d: 'COLUMN', block3d: 'CONTROLBOX', elem3d: 'Elem_Struct' },
  window:     { sym2d: null,     block3d: 'WINDOW1',    elem3d: 'Elem_Opening' },
  door:       { sym2d: null,     block3d: 'DOOR1',      elem3d: 'Elem_Opening' },
  misc:       { sym2d: 'GENERIC', block3d: 'CONTROLBOX', elem3d: 'Elem_Misc' },
};
const DISCIPLINES = Object.keys(DISC_DEFAULTS);

// ---------------------------------------------------------------------------
// טבלת המזהים המאומתת. כל שורה אומתה מול קובצי-הייחוס שלנו (Name→Class/Type +
// מוסכמת-קינון בפועל). מפתח = שם-האלמנט ב-ORDX, lowercased. שדות: cls/type
// (הזוג הקובע), name (שם-הקטלוג לפליטה),
// measure ('nested'|'direct' — כפי שהפורמט דורש, לא לפי-כלל), w/d/h,
// mount (Y), z (היסט-עומק: חלון/דלת שקועים = -100), disc, override לסמלים.
// corpus=true => ודאי מלא. ⚠ מוסכמת-הקינון אינה "רק חלון/דלת" — ראה ORDX_SPEC_
// VALIDATION.md: Beam/Power Box/ShutterBox/SocketEx/WindowSill/Air Opening/
// Safety Room/Toilet/Shower/Cabinet/Radiator/Pole מקננים גם הם.
// ---------------------------------------------------------------------------
const CONFIRMED = {
  // --- חלונות: Decorative/Window, מקונן, שקוע לעובי-הקיר ---
  'window': { cls: 'Decorative', type: 'Window', name: 'Window', measure: 'nested',
    w: 1200, d: 100, h: 1200, mount: 1070, z: -100, disc: 'window', corpus: true },

  // --- דלתות/פתחים/מעברים: Decorative/EntryDoor, מקונן, על הרצפה ---
  // בקורפוס האמיתי השמות הם Doorway w/o Frame / Doorway with Frame / Hinged
  // {Left,Right} {In,Out}. "Door"/"Passage" אינם מופיעים כ-Name → משמשים ככינוי.
  'door': { cls: 'Decorative', type: 'EntryDoor', name: 'Doorway w/o Frame', measure: 'nested',
    w: 800, d: 0, h: 2050, mount: 0, z: 0, disc: 'door', corpus: true },
  'doorway w/o frame': { cls: 'Decorative', type: 'EntryDoor', name: 'Doorway w/o Frame', measure: 'nested',
    w: 800, d: 0, h: 2050, mount: 0, z: 0, disc: 'door', corpus: true },
  'doorway with frame': { cls: 'Decorative', type: 'EntryDoor', name: 'Doorway with Frame', measure: 'nested',
    w: 800, d: 100, h: 2050, mount: 0, z: -100, disc: 'door', corpus: true },
  'passage': { cls: 'Decorative', type: 'EntryDoor', name: 'Doorway w/o Frame', measure: 'nested',
    w: 900, d: 0, h: 2100, mount: 0, z: 0, disc: 'door', corpus: true },
  'hinged left in': { cls: 'Decorative', type: 'EntryDoor', name: 'Hinged Left In', measure: 'nested',
    w: 800, d: 100, h: 2050, mount: 0, z: -100, disc: 'door', corpus: true },
  'hinged right in': { cls: 'Decorative', type: 'EntryDoor', name: 'Hinged Right In', measure: 'nested',
    w: 800, d: 100, h: 2050, mount: 0, z: -100, disc: 'door', corpus: true },
  'hinged left out': { cls: 'Decorative', type: 'EntryDoor', name: 'Hinged Left Out', measure: 'nested',
    w: 800, d: 100, h: 2050, mount: 0, z: -100, disc: 'door', corpus: true },
  'hinged right out': { cls: 'Decorative', type: 'EntryDoor', name: 'Hinged Right Out', measure: 'nested',
    w: 800, d: 100, h: 2050, mount: 0, z: -100, disc: 'door', corpus: true },
  // כניסת-ממ"ד: בקורפוס = Decorative/Miscellaneous (לא EntryDoor!), מקונן.
  'safety room entrance': { cls: 'Decorative', type: 'Miscellaneous', name: 'Safety Room Entrance', measure: 'nested',
    w: 800, d: 100, h: 2050, mount: 0, z: -100, disc: 'door', corpus: true },

  // --- קורות ועמודים: Decorative/TWall, מקונן ---
  'beam': { cls: 'Decorative', type: 'TWall', name: 'Beam', measure: 'nested',
    w: 200, d: 0, h: 400, mount: 2385, z: null, disc: 'structural', corpus: true },
  'pole': { cls: 'Decorative', type: 'TWall', name: 'Pole', measure: 'nested',
    w: 300, d: 300, h: 2700, mount: 0, z: null, disc: 'structural', corpus: true },
  'rpole': { cls: 'Decorative', type: 'TWall', name: 'RPole', measure: 'nested',
    w: 300, d: 300, h: 2700, mount: 0, z: null, disc: 'structural', corpus: true },

  // --- חשמל / נקודות-על-קיר: Fixture/Miscellaneous (רובן direct) ---
  'socket': { cls: 'Fixture', type: 'Miscellaneous', name: 'Socket', measure: 'direct',
    w: 80, d: 15, h: 80, mount: 350, z: null, disc: 'electrical', corpus: true },
  'duplex socket': { cls: 'Fixture', type: 'Miscellaneous', name: 'Duplex Socket', measure: 'direct',
    w: 160, d: 15, h: 80, mount: 350, z: null, disc: 'electrical', block3d: 'DUPLEXSWITCH', corpus: true },
  // SocketEx (מוגן-מים) — בקורפוס מקונן.
  'socketex': { cls: 'Fixture', type: 'Miscellaneous', name: 'SocketEx', measure: 'nested',
    w: 175, d: 70, h: 70, mount: 350, z: null, disc: 'electrical', corpus: true },
  'switch': { cls: 'Fixture', type: 'Miscellaneous', name: 'Switch', measure: 'direct',
    w: 80, d: 15, h: 80, mount: 1150, z: null, disc: 'electrical', sym2d: 'SWITCH', block3d: 'SWITCH', corpus: true },
  'duplex switch': { cls: 'Fixture', type: 'Miscellaneous', name: 'Duplex Switch', measure: 'direct',
    w: 160, d: 15, h: 80, mount: 1150, z: null, disc: 'electrical', sym2d: 'SWITCH', block3d: 'DUPLEXSWITCH', corpus: true },
  'switchex': { cls: 'Fixture', type: 'Miscellaneous', name: 'SwitchEx', measure: 'direct',
    w: 80, d: 30, h: 80, mount: 1150, z: null, disc: 'electrical', sym2d: 'SWITCH', block3d: 'SWITCH', corpus: true },
  'junction box': { cls: 'Fixture', type: 'Miscellaneous', name: 'Junction Box', measure: 'direct',
    w: 80, d: 15, h: 80, mount: 1500, z: null, disc: 'electrical', block3d: 'CONTROLBOX', sym2d: 'PANEL', corpus: true },
  'power line': { cls: 'Fixture', type: 'Miscellaneous', name: 'Power Line', measure: 'direct',
    w: 20, d: 100, h: 20, mount: 300, z: null, disc: 'electrical', sym2d: 'PANEL', block3d: 'CONTROLBOX', corpus: true },
  'phone': { cls: 'Fixture', type: 'Miscellaneous', name: 'Phone', measure: 'direct',
    w: 80, d: 15, h: 80, mount: 350, z: null, disc: 'electrical', sym2d: 'DATA', block3d: 'CONTROLBOX', corpus: true },
  'tv': { cls: 'Fixture', type: 'Miscellaneous', name: 'TV', measure: 'direct',
    w: 80, d: 15, h: 80, mount: 350, z: null, disc: 'electrical', sym2d: 'DATA', block3d: 'CONTROLBOX', corpus: true },
  'door bell': { cls: 'Fixture', type: 'Miscellaneous', name: 'Door Bell', measure: 'direct',
    w: 80, d: 15, h: 80, mount: 1300, z: null, disc: 'electrical', sym2d: 'SENSOR', block3d: 'CONTROLBOX', corpus: true },
  // Intercom — בקורפוס = Decorative/Miscellaneous (לא Fixture!).
  'intercom': { cls: 'Decorative', type: 'Miscellaneous', name: 'Intercom', measure: 'direct',
    w: 120, d: 30, h: 180, mount: 1500, z: null, disc: 'electrical', sym2d: 'DATA', block3d: 'CONTROLBOX', corpus: true },
  // לוח-חשמל דירתי: Decorative/Miscellaneous, מקונן.
  'power box': { cls: 'Decorative', type: 'Miscellaneous', name: 'Power Box', measure: 'nested',
    w: 400, d: 100, h: 600, mount: 1700, z: null, disc: 'electrical', sym2d: 'PANEL', block3d: 'CONTROLBOX', corpus: true },
  // גופי-תאורה על קיר: Decorative/Miscellaneous, direct.
  'lighting': { cls: 'Decorative', type: 'Miscellaneous', name: 'Lighting', measure: 'direct',
    w: 100, d: 100, h: 100, mount: 2000, z: null, disc: 'lighting', block3d: 'LIGHTING', corpus: true },

  // --- אינסטלציה רטובה + גז + ניקוז: Fixture/Part ---
  'faucet': { cls: 'Fixture', type: 'Part', name: 'Faucet', measure: 'direct',
    w: 20, d: 20, h: 20, mount: 550, z: null, disc: 'plumbing', block3d: 'FAUCET', corpus: true },
  'water supply': { cls: 'Fixture', type: 'Part', name: 'Water Supply', measure: 'direct',
    w: 20, d: 20, h: 20, mount: 550, z: null, disc: 'plumbing', block3d: 'FAUCET', corpus: true },
  'gas': { cls: 'Fixture', type: 'Part', name: 'Gas', measure: 'direct',
    w: 20, d: 20, h: 20, mount: 600, z: null, disc: 'gas', block3d: 'GAS', sym2d: 'GAS', corpus: true },
  'sewage': { cls: 'Fixture', type: 'Part', name: 'Sewage', measure: 'direct',
    w: 50, d: 50, h: 50, mount: 100, z: null, disc: 'plumbing', sym2d: 'DRAIN', block3d: 'SEWAGE', corpus: true },
  'sewer drainage': { cls: 'Fixture', type: 'Part', name: 'Sewer drainage', measure: 'direct',
    w: 120, d: 0, h: 120, mount: 0, z: null, disc: 'plumbing', sym2d: 'DRAIN', block3d: 'SEWAGE', corpus: true },
  'sprinkler': { cls: 'Fixture', type: 'Part', name: 'Sprinkler', measure: 'direct',
    w: 60, d: 60, h: 30, mount: 2760, z: null, disc: 'plumbing', block3d: 'SEWAGE', corpus: true },
  // אסלה / מקלחת — בקורפוס = Fixture/Part, מקונן.
  'toilet': { cls: 'Fixture', type: 'Part', name: 'Toilet', measure: 'nested',
    w: 380, d: 600, h: 400, mount: 0, z: null, disc: 'plumbing', block3d: 'SEWAGE', corpus: true },
  'shower': { cls: 'Fixture', type: 'Part', name: 'Shower', measure: 'nested',
    w: 900, d: 900, h: 100, mount: 0, z: null, disc: 'plumbing', block3d: 'SEWAGE', corpus: true },

  // --- תקרה: Decorative/Miscellaneous (ספוט שקוע) ---
  'can light': { cls: 'Decorative', type: 'Miscellaneous', name: 'Can Light', measure: 'direct',
    w: 100, d: 100, h: 30, mount: 2760, z: 1024, disc: 'lighting', block3d: 'LIGHTING', corpus: true },
  // פתח-אוויר בתקרה: Decorative/Miscellaneous, מקונן.
  'air opening ceiling': { cls: 'Decorative', type: 'Miscellaneous', name: 'Air Opening Ceiling', measure: 'nested',
    w: 200, d: 200, h: 100, mount: 2700, z: null, disc: 'hvac', corpus: true },

  // --- מיזוג ואוורור: מחלקות מיוחדות ---
  // מזגן: בקורפוס = Accessory/Miscellaneous (Class חדש), מקונן.
  'air condition': { cls: 'Accessory', type: 'Miscellaneous', name: 'Air Condition', measure: 'nested',
    w: 900, d: 200, h: 300, mount: 2200, z: null, disc: 'hvac', corpus: true },
  // רדיאטור: בקורפוס = Appliance/DishWasher (!), מקונן.
  'radiator': { cls: 'Appliance', type: 'DishWasher', name: 'Radiator', measure: 'nested',
    w: 600, d: 100, h: 600, mount: 300, z: null, disc: 'hvac', corpus: true },

  // --- ארונות: Base/Standard (Class חדש), מקונן ---
  'cabinet': { cls: 'Base', type: 'Standard', name: 'Cabinet', measure: 'nested',
    w: 600, d: 600, h: 900, mount: 0, z: null, disc: 'misc', block3d: 'CONTROLBOX', corpus: true },
  // מדיח: Appliance/DishWasher.
  'dishwasher': { cls: 'Appliance', type: 'DishWasher', name: 'DishWasher', measure: 'nested',
    w: 600, d: 600, h: 850, mount: 0, z: null, disc: 'misc', block3d: 'CONTROLBOX', corpus: true },

  // --- ארגז-תריס / אדן-חלון: Decorative/Part, מקונן ---
  'shutterbox': { cls: 'Decorative', type: 'Part', name: 'ShutterBox', measure: 'nested',
    w: 2316, d: 0, h: 245, mount: 2200, z: null, disc: 'structural', sym2d: 'GENERIC', corpus: true },
  'windowsill': { cls: 'Decorative', type: 'Part', name: 'WindowSill', measure: 'nested',
    w: 1200, d: 60, h: 40, mount: 900, z: null, disc: 'structural', sym2d: 'GENERIC', corpus: true },
};

// ---------------------------------------------------------------------------
// מפת-כינויים: איות של Soline / עברית / וריאנט -> מפתח CONFIRMED (או שם catalog en).
// ---------------------------------------------------------------------------
const ALIAS = {
  'single socket': 'socket',
  'multi socket': 'duplex socket',
  'waterproof socket ip44': 'socketex',
  'electrical junction / cable node': 'power line',
  'distribution board': 'power box',
  'cold water point': 'water supply',
  'hot water point': 'water supply',
  'water': 'water supply',
  'water pipe': 'water supply',
  'faucet / tap point': 'faucet',
  'gas point': 'gas',
  'sewage / waste point': 'sewage',
  'floor drain': 'sewer drainage',
  'recessed downlight (can light)': 'can light',
  'shutter box': 'shutterbox',
  'window sill': 'windowsill',
  'water bar': 'water supply',
  'תמי4': 'water supply',
  'מעבר': 'passage',
  'מפתח עם משקוף': 'doorway with frame',
  // עמוד/column -> Pole (Decorative/TWall), כפי שהקורפוס מקודד עמודים.
  'עמוד': 'pole',
  'column': 'pole',
  'rectangular column': 'pole',
  'circular column': 'rpole',
  'עמוד עגול': 'rpole',
  'קורה': 'beam',
  // מיזוג / מכשירים / ארונות — מחלקות מיוחדות שאומתו בקורפוס.
  'מזגן': 'air condition',
  'air conditioner': 'air condition',
  'ac': 'air condition',
  'רדיאטור': 'radiator',
  'ארון': 'cabinet',
  'closet': 'cabinet',
  'מדיח': 'dishwasher',
  'dish washer': 'dishwasher',
  'אינטרקום': 'intercom',
  'כניסת ממ"ד': 'safety room entrance',
  'כניסת ממד': 'safety room entrance',
  'ממ"ד': 'safety room entrance',
  'מפסק': 'switch',
  'מפסק כפול': 'duplex switch',
  'טלפון': 'phone',
  'טלוויזיה': 'tv',
  'פעמון': 'door bell',
  'doorbell': 'door bell',
  'ספרינקלר': 'sprinkler',
  'אסלה': 'toilet',
  'מקלחת': 'shower',
  'אדן חלון': 'windowsill',
  'ארגז תריס': 'shutterbox',
  'פתח אוויר': 'air opening ceiling',
  'לוח חשמל דירתי': 'power box',
};

// ---------------------------------------------------------------------------
// חוקן-סיווג לאלמנטים שאינם בטבלת-הקורפוס — לפי קטגוריה (מ-elements.json) ואז שם.
// מחזיר { cls, type, disc }. מסומן conservative=true בקורא כדי לדעת שזה best-effort.
// ---------------------------------------------------------------------------
function fallbackClassify(row, rawName, itemCls, itemType) {
  const cat = row && row.category ? row.category : '';
  const en = norm((row && row.en) || rawName);
  const he = norm((row && row.he) || '');
  const ref = row && row.measure_ref ? row.measure_ref : null;
  const has = (s, ...ws) => ws.some((w) => s.indexOf(w) !== -1);

  // אדריכלי / קונסטרוקטיבי -> Decorative
  const isWindowCat = has(cat, 'חלונות') || has(en, 'window', 'glazing', 'porthole', 'vitrine', 'storefront') || has(he, 'חלון', 'ויטרינה', 'אשנב', 'צוהר', 'ראווה');
  const isDoorCat = has(cat, 'דלת') || has(cat, 'מעבר') ||
    has(en, 'door', 'doorway', 'passage', 'arch', 'gate', 'opening', 'hatch') ||
    has(he, 'דלת', 'פתח', 'מעבר', 'קשת', 'משקוף');
  const isColumn = has(en, 'column', 'pillar') || has(he, 'עמוד');
  const isBeam = has(en, 'beam') || has(he, 'קורה');
  const isWallSeg = has(cat, 'מקטעי קיר') || has(cat, 'אלמנטים עגולים');
  const isArch = has(cat, 'אדריכל');
  const isCeiling = ref === 'ceiling' || has(en, 'spot', 'downlight', 'can light', 'diffuser', 'sprinkler') || has(he, 'ספוט', 'שקוע', 'מפזר', 'ספרינקלר');
  const isPanel = has(en, 'distribution board', 'power box', 'panel', 'board') || has(he, 'לוח חשמל', 'לוח דירתי');

  if (isArch || isWallSeg || isCeiling || isPanel || isColumn || isBeam) {
    let type = 'Miscellaneous';
    let disc = 'misc';
    if (isBeam) { type = 'TWall'; disc = 'structural'; }
    else if (isColumn) { type = 'Miscellaneous'; disc = 'structural'; }
    else if (has(en, 'shutter box', 'shutterbox') || has(he, 'ארגז תריס')) { type = 'Part'; disc = 'structural'; }
    else if (has(en, 'window sill', 'windowsill') || has(he, 'אדן חלון')) { type = 'Part'; disc = 'structural'; }
    else if (isWindowCat) { type = 'Window'; disc = 'window'; }
    else if (isDoorCat) { type = 'EntryDoor'; disc = 'door'; }
    else if (isCeiling) { type = 'Miscellaneous'; disc = 'lighting'; }
    else if (isPanel) { type = 'Miscellaneous'; disc = 'electrical'; }
    else if (isWallSeg) { type = 'Miscellaneous'; disc = 'structural'; }
    return { cls: 'Decorative', type, disc };
  }

  // אינסטלציה רטובה / גז / ניקוז -> Fixture/Part
  const isGasCat = cat === 'גז' || cat.indexOf('גז') === 0;
  const isWaterCat = has(cat, 'אינסטלציה — מים') || has(cat, 'אינסטלציה — ניקוז') || (has(cat, 'ניקוז') && !has(cat, 'חשמל'));
  // גז אמיתי (נקודת-גז) — לא "גלאי גז" (בטיחות/חשמל). מזהים לפי שם ללא "גלאי".
  const nameIsGas = (en === 'gas' || has(en, 'gas point', 'gas pipe') ||
    ((he === 'גז' || has(he, 'נקודת גז', 'צינור גז', 'ברז גז')) && !has(he, 'גלאי')));
  const nameIsWet = en === 'water' || en === 'faucet' || en === 'water supply' ||
    has(en, 'water point', 'water supply', 'faucet', 'sewage', 'sewer', 'drain', 'waste', 'toilet', 'shower', 'sink', 'sprinkler') ||
    has(he, 'מים', 'ברז', 'ניקוז', 'ביוב', 'אסלה', 'מקלחת', 'כיור', 'ספרינקלר');
  if (isGasCat || nameIsGas) return { cls: 'Fixture', type: 'Part', disc: 'gas' };
  if (isWaterCat || nameIsWet) {
    const drain = has(en, 'sewage', 'sewer', 'drain', 'waste') || has(he, 'ניקוז', 'ביוב');
    return { cls: 'Fixture', type: 'Part', disc: 'plumbing', drain };
  }

  // מיזוג/אוורור על קיר -> Fixture/Miscellaneous, disc hvac
  const isHvac = has(cat, 'מיזוג') || has(en, 'air condition', 'hvac', 'vent', 'diffuser', 'fan', 'radiator') || has(he, 'מזגן', 'מיזוג', 'אוורור', 'מפוח', 'מאוורר', 'מפזר', 'רדיאטור', 'הנמכת תקרה');
  if (isHvac) return { cls: 'Decorative', type: 'Miscellaneous', disc: 'hvac' };

  // תאורה על קיר (אפליק) -> disc lighting
  const isLight = has(cat, 'תאורה') || has(en, 'light', 'lamp', 'luminaire', 'sconce', 'pendant') || has(he, 'תאורה', 'מנורה', 'גוף תאורה', 'אפליק');
  if (isLight) return { cls: 'Fixture', type: 'Miscellaneous', disc: 'lighting' };

  // ברירת-מחדל: חשמל/תקשורת/בקרה/בטיחות -> Fixture/Miscellaneous, disc electrical
  return { cls: 'Fixture', type: 'Miscellaneous', disc: 'electrical' };
}

// עידון סמל-2D / block-3D לפי זהות ספציפית בתוך דיסציפלינת-חשמל וכד'.
function refineSymbols(en, he, disc) {
  const has = (s, ...ws) => ws.some((w) => s.indexOf(w) !== -1);
  const out = { sym2d: DISC_DEFAULTS[disc].sym2d, block3d: DISC_DEFAULTS[disc].block3d, elem3d: DISC_DEFAULTS[disc].elem3d };
  if (disc === 'electrical') {
    if (has(en, 'switch', 'dimmer') || has(he, 'מפסק')) { out.sym2d = 'SWITCH'; out.block3d = 'SWITCH'; }
    else if (has(en, 'duplex', 'double') || has(he, 'כפול')) { out.sym2d = 'SOCKET'; out.block3d = 'DUPLEXSWITCH'; }
    else if (has(en, 'panel', 'board', 'distribution', 'infrastructure', 'power line', 'junction') || has(he, 'לוח', 'תשתית', 'צומת', 'חיבור')) { out.sym2d = 'PANEL'; out.block3d = 'CONTROLBOX'; }
    else if (has(en, 'data', 'network', 'phone', 'tv', 'hdmi', 'intercom', 'router') || has(he, 'תקשורת', 'רשת', 'טלפון', 'טלוויז', 'אינטרקום', 'ראוטר')) { out.sym2d = 'DATA'; out.block3d = 'CONTROLBOX'; }
    else if (has(en, 'sensor', 'detector', 'thermostat') || has(he, 'גלאי', 'חיישן', 'תרמוסטט')) { out.sym2d = 'SENSOR'; out.block3d = 'CONTROLBOX'; }
    else { out.sym2d = 'SOCKET'; out.block3d = 'SOCKET'; }
  } else if (disc === 'plumbing') {
    if (has(en, 'sewage', 'sewer', 'drain', 'waste') || has(he, 'ניקוז', 'ביוב')) { out.sym2d = 'DRAIN'; out.block3d = 'SEWAGE'; }
    else { out.sym2d = 'WATER'; out.block3d = 'FAUCET'; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// classify — הפונקציה הראשית. מקבל שם (string) או פריט-מודל (object) ומחזיר
// רשומה מלאה שכל מייצא צורך.
//   פריט-מודל: { name, description, heName, class, type, size, position, category }
// ---------------------------------------------------------------------------
function classify(nameOrItem) {
  const item = (nameOrItem && typeof nameOrItem === 'object') ? nameOrItem : null;
  const rawName = item
    ? (item.ordx_name || item.name || item.en || item.he || item.description || '')
    : String(nameOrItem || '');

  // שורת-catalog (elements.json) לפי en / he / alias / השם-העברי של הפריט.
  let row =
    BY_EN.get(norm(rawName)) ||
    BY_HE.get(norm(rawName)) ||
    (item && (BY_EN.get(norm(item.en)) || BY_HE.get(norm(item.he)) || BY_HE.get(norm(item.heName)) || BY_HE.get(norm(item.description)))) ||
    null;

  // מפתח-קורפוס: שם ישיר -> alias -> en/he של השורה.
  let confKey =
    (CONFIRMED[norm(rawName)] && norm(rawName)) ||
    ALIAS[norm(rawName)] ||
    (item && (ALIAS[norm(item.he)] || ALIAS[norm(item.heName)] || ALIAS[norm(item.description)])) ||
    (row && (ALIAS[norm(row.en)] || (CONFIRMED[norm(row.en)] && norm(row.en)))) ||
    null;
  const conf = confKey ? CONFIRMED[confKey] : null;

  const itemCls = item && item.class ? item.class : null;
  const itemType = item && item.type ? item.type : null;

  // סיווג ORDX Class/Type + discipline.
  let cls, type, disc, conservative = false;
  if (conf) {
    cls = conf.cls; type = conf.type; disc = conf.disc;
  } else {
    const fb = fallbackClassify(row, rawName, itemCls, itemType);
    cls = fb.cls; type = fb.type; disc = fb.disc; conservative = true;
    // אם הפריט כבר נושא Class/Type אמיתי (למשל מקורפוס-CV), נכבד אותו על-פני החוקן.
    if (itemCls && itemType) { cls = itemCls; type = itemType; }
  }

  // מוסכמת-מידות (מעוגן בקורפוס — לא "רק חלון/דלת"): מקוננת לחלון/דלת/קורה,
  // ל-Decorative/Part (ארגז-תריס/אדן), ולמחלקות המיוחדות (Base/Appliance/
  // Accessory). ישירה לנקודות (Fixture/Miscellaneous, Fixture/Part, ולרוב
  // Decorative/Miscellaneous). חריגי-הקינון הספציפיים (Power Box, Air Opening,
  // Safety Room, SocketEx, Toilet, Shower) יושבים ב-CONFIRMED ולכן מכוסים.
  const nestByRule =
    type === 'Window' || type === 'EntryDoor' || type === 'TWall' ||
    (cls === 'Decorative' && type === 'Part') ||
    cls === 'Base' || cls === 'Appliance' || cls === 'Accessory';
  const measure = (conf && conf.measure) || (nestByRule ? 'nested' : 'direct');

  // מידות: size של הפריט -> elements.json -> ברירת-מחדל של הקורפוס.
  const sz = (item && item.size) || {};
  const w = num(sz.width) != null ? num(sz.width) : (row && row.width_mm != null ? row.width_mm : (conf ? conf.w : null));
  const d = num(sz.depth) != null ? num(sz.depth) : (row && row.depth_mm != null ? row.depth_mm : (conf ? conf.d : null));
  const h = num(sz.height) != null ? num(sz.height) : (row && row.height_mm != null ? row.height_mm : (conf ? conf.h : null));

  // גובה-התקנה (Y): position.y מפורש -> catalog mount -> ברירת-מחדל קורפוס.
  const mount = (item && item.position && num(item.position.y) != null) ? num(item.position.y)
    : (row && row.mount_height_mm != null ? row.mount_height_mm
      : (conf && conf.mount != null ? conf.mount : 0));

  // Z (היסט-עומק ברירת-מחדל): חלון/דלת שקועים = -100; תקרה = מרחק; אחר = null.
  const z = (item && item.position && num(item.position.z) != null) ? num(item.position.z)
    : (conf && conf.z != null ? conf.z : null);

  // שם-הקטלוג לפליטה ל-ORDX + שם עברי לתצוגה/Description.
  const ordxName = (item && item.ordx_name) || (conf && conf.name) || (row && row.en) || rawName;
  const he = (item && (item.heName || item.he)) || (row && row.he) || null;

  // סמלים: override של אלמנט מאומת -> עידון-לפי-שם בתוך הדיסציפלינה.
  const en = norm(ordxName);
  const heN = norm(he);
  const refined = refineSymbols(en, heN, disc);
  const sym2d = (conf && conf.sym2d) || refined.sym2d;
  const block3d = (conf && conf.block3d) || refined.block3d;
  const elem3d = (conf && conf.elem3d) || refined.elem3d;

  return {
    key: confKey || (row ? norm(row.en) : null),
    ordxName,
    he,
    ordxClass: cls,
    ordxType: type,
    measure,           // 'nested' | 'direct'
    w, d, h, mount, z,
    disc,              // אחת מ-DISCIPLINES
    sym2d,             // מפתח GLYPHS (export_dxf2d)
    block3d,           // מפתח BLOCKS (export_dxf_pro)
    elem3d,            // שכבת גוף-3D (Elem_*)
    corpus: !!(conf && conf.corpus),
    conservative,      // true => סיווג-חוקן (לא ודאי)
  };
}

function resolve(name) { return classify(name); }

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

module.exports = {
  classify,
  resolve,
  DISCIPLINES,
  DISC_DEFAULTS,
  CONFIRMED,
  ELEMENTS,
};
