# 13 · מפרט ליבת האימות (Session 3)

> **סטטוס:** מפרט לבנייה — *Session 3*.
> **כלל-על:** אין כאן מימוש לוגיקה עסקית. זהו **החוזה המדויק** שמפתח יבנה מולו: טיפוסים,
> סכמות, טבלאות-החלטה ותרחישי-קבלה. המספרים (טולרנסים) זמניים עד אשרור מומחה-תחום, אך
> **המנגנון סופי**.
> **מדוע ליבת האימות ראשונה:** offline-first ([ADR-002](09-ADRs.md)) הופך אותה לרכיב הקריטי
> ביותר — היא חייבת לרוץ על-גבי-ההתקן, בלי רשת, ולהכריע GO/NO-GO.

---

## 1. עקרונות החוזה

1. **פונקציה טהורה ודטרמיניסטית** — אותו קלט → אותו פלט, תמיד. אין קריאות רשת, אין שעון, אין
   אקראיות בתוך המעריך. (זמן/מזהים מוזרקים כקלט.)
2. **ניידת** — נארזת כחבילת TypeScript אחת שרצה זהה **על-גבי-ההתקן** וב-**backend**.
3. **בת-הסבר** — כל תוצאה נושאת את החוקים והקלטים המדויקים שהובילו אליה. אין קופסה שחורה.
4. **חוקים-כנתונים** — המעריך גנרי; ההתנהגות מגיעה מ-`RuleSet` מגורסא לכל ורטיקל.
5. **fail-closed** — בספק, התוצאה עבור מדידה קריטית היא `FAIL`/`PENDING`, לעולם לא `PASS` שקט.

---

## 2. חוזה הליבה (חתימות)

```ts
// הפונקציה היחידה שהעולם קורא לה. טהורה.
function evaluate(input: EvaluationInput): ValidationResult;

interface EvaluationInput {
  subject: Subject;              // מה מאמתים
  ruleSet: RuleSet;              // מערכת החוקים (מגורסאת, לפי ורטיקל)
  context: EvalContext;          // now(ts), evaluatedBy, deviceHealth, calibrations
}

type Subject =
  | { kind: 'measurement';       data: Measurement; readings: Reading[] }
  | { kind: 'crossValidation';   data: CrossValidationSet; members: Measurement[] }
  | { kind: 'readiness';         data: ReadinessCheck }
  | { kind: 'geometry';          data: GeometryModel; dimensions: Dimension[] };

interface EvalContext {
  nowTs: string;                 // מוזרק — אין שעון פנימי
  evaluatedBy: 'on-device' | 'backend';
  calibrations: Record<DeviceId, CalibrationState>;
}
```

> `evaluate` אף פעם לא כותבת, לא שולחת, ולא קוראת I/O. שכבת האפליקציה מתמידה את התוצאה.

---

## 3. סכמת החוקים (Rule / RuleSet)

```ts
type RuleClass =
  | 'presence' | 'redundancy' | 'tolerance'
  | 'plausibility' | 'calibration' | 'completeness';

type Severity = 'BLOCKER' | 'WARNING' | 'INFO';

interface Rule {
  id: string;                    // יציב, מצוטט בתוצאה
  class: RuleClass;
  appliesTo: {
    subjectKind: Subject['kind'];
    quantity?: QuantityKind;     // LENGTH | HEIGHT | CLEARANCE | ANGLE | AREA
    critical?: boolean;          // חל רק על מדידות קריטיות?
  };
  params: Record<string, unknown>;   // ראו §4 לכל מחלקה
  severity: Severity;
  message: string;               // תבנית בעברית, עם placeholders {observed}/{limit}
}

interface RuleSet {
  vertical: Vertical;            // kitchen | stone (v1)
  version: string;               // סמנטי, נרשם בכל תוצאה
  tolerances: ToleranceTable;    // §4.3
  reconciliation: ReconciliationPolicy;  // §5
  rules: Rule[];
}
```

---

## 4. תוכן ה-RuleSet ל-v1 (מטבחים + שיש)

> החוקים כ**נתונים**. המספרים מהצעת-הבסיס ([מסמך 11](11-Validation-Ruleset-Strawman.md)) —
> זמניים, לאשרור. הוספת ורטיקל = הוספת `RuleSet`, ללא נגיעה במעריך.

### 4.1 נוכחות ויתירות (presence, redundancy)
```ts
// כל מדידה קריטית חייבת ≥2 מקורות בלתי-תלויים; בשיש לפחות אחד ב-trustClass ≥ 4.
{ id: 'RED-CRIT-2SRC', class: 'redundancy', severity: 'BLOCKER',
  appliesTo: { subjectKind: 'crossValidation', critical: true },
  params: { minIndependentSources: 2, minTrustClassAtLeastOne: 4 },
  message: 'מדידה קריטית דורשת שני מקורות בלתי-תלויים לפחות (נמצאו {observed}).' }

// שלמות הלכידה מול רשימת התיוג של הוורטיקל.
{ id: 'PRES-READINESS', class: 'presence', severity: 'BLOCKER',
  appliesTo: { subjectKind: 'readiness' },
  params: { requireAllRequiredItems: true } }
```

### 4.2 כיול (calibration)
```ts
{ id: 'CAL-NOT-EXPIRED', class: 'calibration', severity: 'BLOCKER',
  appliesTo: { subjectKind: 'measurement', critical: true },
  params: { rejectStatuses: ['EXPIRED'], flagStatuses: ['EXPIRING'] },
  message: 'קריאה ממכשיר שכיולו פג אינה קבילה למדידה קריטית ({deviceId}).' }
```

### 4.3 טולרנס (tolerance) — טבלה נפתרת
```ts
// resolve(vertical, quantity, critical) -> Tolerance
type Tolerance = { absoluteMm: number; relativePct?: number; combine: 'max' };

ToleranceTable (stone) = {
  CLEARANCE:{critical:{abs:1.5}, general:{abs:3}}, LENGTH:{critical:{abs:1.5}, general:{abs:3}},
  ANGLE:{critical:{absDeg:0.3}}
}
ToleranceTable (kitchen) = {
  CLEARANCE:{critical:{abs:3}, general:{abs:5}}, LENGTH:{critical:{abs:3}, general:{abs:5}},
  ANGLE:{critical:{absDeg:0.5}}
}
// מבחן ההסכמה:  delta = |a-b| ;  limit = max(abs, relativePct% * nominal) ;  ok = delta <= limit
```

### 4.4 סבירוּת (plausibility) — לוכד שגיאות שיטתיות שהטולרנס לא תופס
```ts
{ id:'PL-OPP-WALLS', class:'plausibility', severity:'WARNING',
  params:{ check:'oppositeWallsEqual', limitFactor: 2 } }      // ≤ 2× טולרנס כללי
{ id:'PL-DIAGONAL',  class:'plausibility', severity:'BLOCKER',
  params:{ check:'diagonalConsistency', limitFactor: 3 } }     // ≤ 3× טולרנס קריטי
{ id:'PL-SUM-PARTS', class:'plausibility', severity:'BLOCKER',
  params:{ check:'sumOfParts', limitFactor: 1 } }              // Σ חלקים = שלם ± קריטי
{ id:'PL-RANGE',     class:'plausibility', severity:'BLOCKER',
  params:{ check:'physicalRange', minMm: 1, maxMm: 30000 } }   // 0 < אורך < 30מ׳
```

### 4.5 שלמות שער (completeness) — מזין את GO/NO-GO
```ts
{ id:'COMP-GATE', class:'completeness', severity:'BLOCKER',
  appliesTo:{ subjectKind:'readiness' },
  params:{ allBlockersResolvedOrOverridden: true } }
```

---

## 5. אלגוריתם האימות הצולב + מדיניות היישוב

```ts
interface ReconciliationPolicy {
  onDisagree: 'REQUIRE_REMEASURE' | 'BLOCK_GO' | 'ACCEPT_WITH_FLAG';
  maxRemeasures: number;
  overrideAllowedBy: Role[];
  requireReasonOnOverride: true;
}
// stone:  { onDisagree:'REQUIRE_REMEASURE', maxRemeasures:2, then BLOCK_GO, override:['LEAD'] }
// kitchen:{ onDisagree:'REQUIRE_REMEASURE', maxRemeasures:1, then ACCEPT_WITH_FLAG, override:['LEAD'] }
```

**טבלת החלטה (דטרמיניסטית):**

| מצב | תנאי | פלט |
|---|---|---|
| הסכמה | `delta ≤ limit` | `PASS` |
| אי-הסכמה, יש עוד ניסיונות | `delta > limit` וגם `remeasureCount < maxRemeasures` | `PENDING_REMEASURE` (בקש מדידה חוזרת) |
| אי-הסכמה, נגמרו הניסיונות, מדיניות BLOCK_GO | מוצה `maxRemeasures` | `FAIL` + אירוע `CrossValidationFailed` → הפרויקט עשוי ל-`Blocked` |
| אי-הסכמה, נגמרו, מדיניות ACCEPT_WITH_FLAG | מוצה, בוצעה דריסה מוגנת-תפקיד + סיבה | `PASS_WITH_FLAG` |
| אי-הסכמה, נגמרו, אין דריסה תקפה | — | `FAIL` |

> המעריך **מדווח** על `PENDING_REMEASURE`/`FAIL`; הוא אינו מבצע את המדידה החוזרת ואינו משנה מצב
> פרויקט — זו אחריות שכבת האפליקציה (שמירת ה-`remeasureCount`, פליטת אירועים).

---

## 6. חוזה ההרצה הכפולה (on-device ↔ backend)

- אותה חבילת `RuleSet` (עם `version`) נשלחת לשני הצדדים. כל תוצאה רושמת `ruleSetVersion` ו-
  `evaluatedBy`.
- **`inputsHash`** = גיבוב דטרמיניסטי מעל הקלט הקנוני (מדידות, קריאות, גרסת חוקים). מאפשר לזהות
  אם ה-backend העריך *בדיוק אותו* קלט כמו ההתקן.
- **יישוב הפרשים:** ה-backend הוא הסמכות. אם תוצאת ה-backend חמורה יותר מזו של ההתקן (למשל
  `PASS` על-גבי-ההתקן → `FAIL` ב-backend, כי נחשפו נתונים חוצי-sessions), התוצאה הסמכותית גוברת
  **ונרשם אירוע `ValidationDivergence`** — לעולם לא מוסתר.
- אין "חוקים על-גבי-ההתקן בלבד": כל חוק חייב לרוץ בשני הצדדים כדי לשמור על שקילות.

---

## 7. סכמת הפלט (ValidationResult)

```ts
interface ValidationResult {
  id: string;
  subjectRef: string;
  subjectKind: Subject['kind'];
  outcome: 'PASS' | 'PASS_WITH_FLAG' | 'PENDING_REMEASURE' | 'FAIL' | 'PENDING';
  ruleSetVersion: string;
  evaluations: RuleEvaluation[];       // שקיפות מלאה — כל חוק שרץ
  overrides?: Override[];
  evaluatedBy: 'on-device' | 'backend';
  evaluatedAtTs: string;               // מתוך context.nowTs
  inputsHash: string;
}
interface RuleEvaluation {
  ruleId: string; class: RuleClass; severity: Severity;
  passed: boolean; observed: unknown; threshold: unknown; note?: string;
}
```
**כלל צבירה:** `outcome` הכולל = החמור ביותר מבין ה-`BLOCKER`ים שנכשלו; `WARNING`/`INFO` אינם
מורידים ל-`FAIL` אך נרשמים ומוצגים.

---

## 8. תרחישי קבלה (המימוש חייב לעבור אותם)

> אלו הבדיקות שמגדירות "בוצע". קלט → פלט צפוי, דטרמיניסטי.

| # | תרחיש | קלט | פלט צפוי |
|---|-------|-----|----------|
| AT-1 | הסכמה, מטבח | CLEARANCE קריטי, X6=2739, D2=2742, Δ=3, tol=3 | `PASS` |
| AT-2 | אי-הסכמה, מטבח, ניסיון ראשון | X6=2743, D2=2739, Δ=4, tol=3, remeasure=0/1 | `PENDING_REMEASURE` |
| AT-3 | מטבח, מוצו ניסיונות, ללא דריסה | Δ=4>3, remeasure=1/1 | `PASS_WITH_FLAG` רק אם דריסת LEAD+סיבה; אחרת `FAIL` |
| AT-4 | שיש, אותו Δ=4 | tol=1.5, remeasure=2/2 | `FAIL` + `CrossValidationFailed` |
| AT-5 | מכשיר לא-מכויל על קריטי | D2.calibration=EXPIRED | `FAIL` (RED/CAL-NOT-EXPIRED) |
| AT-6 | חסר מקור שני על קריטי | member יחיד | `FAIL` (RED-CRIT-2SRC) |
| AT-7 | אלכסון לא-עקבי | diagonal סוטה > 3× קריטי | `FAIL` (PL-DIAGONAL) |
| AT-8 | ערך לא-פיזי | LENGTH=41000 מ״מ | `FAIL` (PL-RANGE) |
| AT-9 | שקילות on-device/backend | אותו קלט, שני הצדדים | אותו `outcome`, אותו `inputsHash` |
| AT-10 | דטרמיניזם | הרצה כפולה של אותו קלט | פלט זהה בית-בבית |

---

## 9. מקרי קצה ושגיאות

- **RuleSet חסר/גרסה לא ידועה** → שגיאת תצורה מפורשת; **לא** ברירת-מחדל שקטה.
- **יחידות/מסגרת לא תואמות** בין מקורות → `FAIL` (לא ממירים בתוך המעריך; ההמרה בקצה הקליטה, ADR-007).
- **מדידה לא-קריטית שנכשלת בטולרנס** → `WARNING`, לא `FAIL`.
- **דריסה ללא סיבה** → נדחית; `requireReasonOnOverride` הוא BLOCKER.
- **קלט ריק** (אין מדידות) → `PENDING`, לא `PASS`.

---

## 10. Definition of Done לליבת האימות

1. חבילת TS אחת, ללא תלות ב-I/O, מייצאת `evaluate()` טהורה.
2. רצה זהה ב-Node (backend) ובסביבת הלקוח (on-device).
3. `RuleSet` למטבחים ולשיש נטענים כנתונים; החלפת מספר טולרנס אינה משנה קוד.
4. כל 10 תרחישי הקבלה (§8) עוברים, כולל שקילות on-device/backend ודטרמיניזם.
5. כל תוצאה נושאת `ruleSetVersion`, `evaluations[]` ו-`inputsHash`.

> **עדיין ללא לוגיקה עסקית מיושמת** — זהו המפרט. הבנייה מתחילה עם אישור המפרט ואשרור מספרי
> הטולרנס (מסמך 12 §7).
