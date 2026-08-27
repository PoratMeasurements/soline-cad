/*
 * @soline/fit-engine — מנוע ההתאמה של Soline (הבידול)
 * ---------------------------------------------------------------------------
 * לוגיקה טהורה, ללא תלות: מניח את תכנון-הנגר (שכבה A) על המדידה בשטח (שכבה B)
 * ומריץ את חוקי R1–R10 (kitchen_layout_fitting §4) → מפיק רשימת FitDelta.
 *
 * רץ ב-Node (require) וגם בדפדפן (window.SolineFit) — בלי שלב-build.
 * זהו קוד-הייחוס שהמהנדס מתרגם ל-Kotlin (מודול core:fit-engine, החלטה #2/#11).
 *
 * גרסה 0.1 — מיושם: R4 (בליטה-מול-עומק). שאר החוקים ב-RULES כ-stubs מתועדים.
 * כל המידות במילימטרים (מ"מ), כמו במודל-הנתונים של אפליקציית-המדידה.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SolineFit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── מודל-נתונים (JSDoc — portable ל-data class ב-Kotlin) ──────────────────
  /**
   * @typedef {Object} Protrusion  בליטה על קיר (שכבה B — נמדד): שקע/גז/מים/עמוד/ארגז-תריס
   * @property {string} id
   * @property {string} type        SOCKET_SINGLE | WATER_PIPE | GAS_PIPE | COLUMN | ...
   * @property {string} name
   * @property {number} depth       D — עומק-הבליטה מהקיר (מ"מ)   ← "האויב מס' 1"
   * @property {number} fromLeft    מיקום אופקי משמאל-הקיר (מ"מ)
   * @property {number} width       רוחב האלמנט (מ"מ)
   * @property {number} fromBottom  גובה תחתית מהרצפה (מ"מ)
   * @property {number} height      גובה האלמנט (מ"מ)
   */
  /**
   * @typedef {Object} Cabinet  ארון (שכבה A — תכנון-הנגר)
   * @property {string} id
   * @property {string} kind         base | upper | tall
   * @property {string} [name]
   * @property {number} fromLeft     מיקום אופקי משמאל-הקיר (מ"מ)
   * @property {number} width        רוחב הארון (מ"מ)
   * @property {number} depth        עומק גוף-הארון (מ"מ)
   * @property {number} heightFrom   תחתית גב-הארון מהרצפה (מ"מ)
   * @property {number} heightTo     ראש גב-הארון מהרצפה (מ"מ)
   * @property {number} [backClearance] מרווח-גב מתוכנן (מ"מ) — פינוי-גב/סוקל-נסוג. ברירת-מחדל 0
   */
  /**
   * @typedef {Object} FitDelta  ממצא של מנוע-ההתאמה
   * @property {string} rule       R4 | R1 | ...
   * @property {'block'|'warn'|'info'} severity
   * @property {string} cabinetId
   * @property {string} [protrusionId]
   * @property {number} delta      גודל-החריגה במ"מ (חיובי = בעיה)
   * @property {string} message    טקסט לעברית למודד
   * @property {string} suggestion הצעת-פתרון (המנוע מציע, אדם מאשר — החלטה #P11)
   */

  var DEFAULT_CONFIG = {
    // R4 — בליטה מול עומק
    minProtrusionDepth: 3,   // מ"מ — מתחת לזה מתעלמים (רעש-מדידה)
    backCollisionBlock: 15,  // מ"מ — חריגה מעל זה = חסימה; מתחת = אזהרה
    profile: 'field',        // field (תת-קבוצה חיה) | office (מלא) — החלטה #P8
  };

  function overlap1D(aStart, aEnd, bStart, bEnd) {
    return Math.min(aEnd, bEnd) - Math.max(aStart, bStart); // >0 = חופפים
  }

  // ── R4 — התנגשות-בליטה (מיושם) ────────────────────────────────────────────
  // טריגר: D_בליטה > מרווח-גב-הארון, בטווח-הגובה ובחפיפה-אופקית של הארון.
  function ruleR4(cabinet, protrusions, cfg) {
    var out = [];
    var back = cabinet.backClearance || 0;
    var cabL = cabinet.fromLeft, cabR = cabinet.fromLeft + cabinet.width;
    var cabB = cabinet.heightFrom, cabT = cabinet.heightTo;
    for (var i = 0; i < protrusions.length; i++) {
      var p = protrusions[i];
      if (!(p.depth > cfg.minProtrusionDepth)) continue;
      var hOv = overlap1D(cabL, cabR, p.fromLeft, p.fromLeft + p.width);
      var vOv = overlap1D(cabB, cabT, p.fromBottom, p.fromBottom + p.height);
      if (hOv <= 0 || vOv <= 0) continue;          // הבליטה לא מאחורי הארון
      var delta = p.depth - back;
      if (delta <= 0) continue;                     // המרווח-המתוכנן סופג אותה
      var block = delta >= cfg.backCollisionBlock;
      out.push({
        rule: 'R4',
        severity: block ? 'block' : 'warn',
        cabinetId: cabinet.id,
        protrusionId: p.id,
        delta: Math.round(delta * 10) / 10,
        message: 'התנגשות: ' + (p.name || p.type) + ' בולט ' + p.depth +
                 ' מ"מ אל גב הארון' + (cabinet.name ? ' "' + cabinet.name + '"' : '') +
                 ' (מרווח-גב ' + back + ' מ"מ) — חורג ' + (Math.round(delta * 10) / 10) + ' מ"מ',
        suggestion: block
          ? 'פינוי-גב סביב הבליטה / הזזת-התשתית / ביטול — טעון אישור'
          : 'לשקול פינוי-גב קל או מרווח-גב מתוכנן',
      });
    }
    return out;
  }

  // מרשם-החוקים. R4 מיושם; השאר stubs מתועדים לפי kitchen_layout_fitting §4.
  var RULES = {
    R1: { title: 'שורה לא נכנסת', impl: null,  note: 'Σ ארונות+מרווחים ≠ אורך-קיר' },
    R2: { title: 'קיר לא-אנך',    impl: null,  note: 'רוחב@גובה-עליון − תחתון > tol' },
    R3: { title: 'זווית-פינה סוטה', impl: null, note: 'Angle ≠ 90°±tol בפינה' },
    R4: { title: 'התנגשות-בליטה', impl: ruleR4, note: 'D > מרווח-גב-ארון' },
    R5: { title: 'חריגת-הנמכה',   impl: null,  note: 'גובה-ארון > גובה-הנמכה' },
    R9: { title: 'מפלס-רצפה',     impl: null,  note: 'הפרש-מפלס בין קצוות > tol' },
  };

  /**
   * evaluate — הליבה. מקבל תכנון (A) + מדידה (B) → FitDelta[].
   * @param {{cabinets:Cabinet[]}} design   שכבה A
   * @param {{walls:{id:string,protrusions:Protrusion[]}[]}} measured  שכבה B
   * @param {object} [config]
   */
  function evaluate(design, measured, config) {
    var cfg = Object.assign({}, DEFAULT_CONFIG, config || {});
    var byWall = {};
    (measured.walls || []).forEach(function (w) { byWall[w.id] = w.protrusions || []; });
    var deltas = [];
    (design.cabinets || []).forEach(function (cab) {
      var prot = byWall[cab.wallId] || [];
      Object.keys(RULES).forEach(function (rk) {
        var r = RULES[rk];
        if (r.impl) deltas.push.apply(deltas, r.impl(cab, prot, cfg));
      });
    });
    // מיון: חסימות קודם, ואז לפי גודל-חריגה
    deltas.sort(function (a, b) {
      if (a.severity !== b.severity) return a.severity === 'block' ? -1 : 1;
      return b.delta - a.delta;
    });
    return deltas;
  }

  return { evaluate: evaluate, ruleR4: ruleR4, RULES: RULES, DEFAULT_CONFIG: DEFAULT_CONFIG };
});
