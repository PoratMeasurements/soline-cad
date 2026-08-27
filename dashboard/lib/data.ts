// ============================================================================
// Soline data layer
// ----------------------------------------------------------------------------
// Loads the two real source files (data/pnl.json, data/ops.json), normalises
// them, and exposes typed, aggregated series consumed across the dashboard.
// Everything derived directly from the files is REAL. A few strategic/personal
// metrics that the source files do not contain are seeded and clearly marked
// with `SEEDED` so they can later be wired to real inputs.
// ============================================================================

import pnlRaw from "@/data/pnl.json";
import opsRaw from "@/data/ops.json";
// Client-level analytics come exclusively from the official invoice ledger.
import {
  clientRevenue,
  concentration,
  clientSegments,
  invoiceSummary,
  invoicedByMonth,
} from "./clients";

export {
  clientRevenue,
  concentration,
  clientSegments,
  invoiceSummary,
  invoicedByMonth,
};
export type { ClientRevenue } from "./clients";

// ----------------------------------------------------------------------------
// Raw shapes
// ----------------------------------------------------------------------------
type PnlIncome = { client: string; amount: number };
type PnlExpense = { category: string; amount: number; capex: boolean };
type PnlDraw = { name: string; amount: number };
type PnlMonth = {
  month: string;
  income: PnlIncome[];
  expenses: PnlExpense[];
  draws: PnlDraw[];
};
type OpsJob = {
  title: string;
  dealValue: number;
  measureDate: string | null;
  kmTo: number;
  timeTo: number;
  measureTime: number;
  timeBack: number;
  kmBack: number;
  client: string;
};
type OpsMonth = { month: string; jobs: OpsJob[] };

const pnlMonths = (pnlRaw as { months: PnlMonth[] }).months;
const opsMonths = (opsRaw as { opsMonths: OpsMonth[] }).opsMonths;

// ----------------------------------------------------------------------------
// Calendar
// ----------------------------------------------------------------------------
// Timeline reset to start from January 2026 (2025 history is excluded).
export const MONTH_ORDER = [
  "ינואר 2026",
  "פברואר 2026",
  "מרץ 2026",
  "אפריל 2026",
  "מאי 2026",
  "יוני 2026",
  "יולי 2026",
] as const;

const SHORT_LABEL: Record<string, string> = {
  "אוגוסט 2025": "אוג׳",
  "ספטמבר 2025": "ספט׳",
  "אוקטובר 2025": "אוק׳",
  "נובמבר 2025": "נוב׳",
  "דצמבר 2025": "דצמ׳",
  "ינואר 2026": "ינו׳",
  "פברואר 2026": "פבר׳",
  "מרץ 2026": "מרץ",
  "אפריל 2026": "אפר׳",
  "מאי 2026": "מאי",
  "יוני 2026": "יוני",
  "יולי 2026": "יולי",
};

function monthIndex(month: string): number {
  return MONTH_ORDER.indexOf(month as (typeof MONTH_ORDER)[number]);
}

// ----------------------------------------------------------------------------
// Expense classification (keyword -> bucket)
// ----------------------------------------------------------------------------
export type ExpenseBucket =
  | "fuel"
  | "equipment"
  | "software"
  | "marketing"
  | "office"
  | "payroll"
  | "tax";

export const BUCKET_LABEL: Record<ExpenseBucket, string> = {
  fuel: "דלק ונסיעות",
  equipment: "ציוד",
  software: "תוכנה ומערכות",
  marketing: "שיווק",
  office: "משרד וכללי",
  payroll: "שכר וקבלנים",
  tax: "מסים וחובה",
};

function classify(category: string, capex: boolean): ExpenseBucket {
  const c = category;
  const has = (...keys: string[]) => keys.some((k) => c.includes(k));

  if (has("דלק", "דלקן")) return "fuel";
  if (has("מע", "מס הכנסה", "מקדמות מס", "מקדמה", "ביטוח לאומי", "אגרה", "רשם"))
    return "tax";
  if (has("משכורת", "לאה", "אסרף", "שרטוט", "צילומים", "בן עטר")) return "payroll";
  if (has("ביגוד ממותג", "אדריכלי")) return "marketing";
  if (
    has(
      "CRM",
      "גוגל",
      "אוטומצ",
      "אוטמצ",
      "icount",
      "COUNT",
      "פייפדרייב",
      "דומיין",
      "חתימה ירוקה",
      "פיתוח",
      "תחזוקת מערכת",
      "שדרוג"
    )
  )
    return "software";
  if (
    capex ||
    has(
      "ציוד",
      "מכשיר",
      "לייקה",
      "מטרפורט",
      "מטר",
      "טאבלט",
      "מחשב",
      "חצובה",
      "פלס לייזר",
      "טיפול לרכב",
      "צמיגים",
      "פנס",
      "רכב",
      "טסט",
      "בדיקה"
    )
  )
    return "equipment";
  return "office";
}

// ----------------------------------------------------------------------------
// Monthly financial series
// ----------------------------------------------------------------------------
export type MonthFinance = {
  month: string;
  label: string;
  index: number;
  revenue: number;
  opex: number; // all non-capex spend (the company's "expenses" line)
  tax: number; // statutory subset of opex: VAT, tax prepayments, NI
  capex: number;
  operatingProfit: number; // revenue - opex
  operatingCashFlow: number; // revenue - opex (operational cash generation)
  operatingMargin: number; // %
  draws: number;
  buckets: Record<ExpenseBucket, number>;
  netCash: number; // revenue - opex - capex (excludes owner draws)
  cashBalance: number; // running cumulative
};

// Baseline reset: cash accumulation starts from zero at January 2026.
const STARTING_CASH = 0;

export const monthlyFinance: MonthFinance[] = (() => {
  let running = STARTING_CASH;
  return MONTH_ORDER.map((month, index) => {
    const m = pnlMonths.find((p) => p.month === month);
    const income = m?.income ?? [];
    const expenses = m?.expenses ?? [];
    const draws = m?.draws ?? [];

    const revenue = income.reduce((s, i) => s + i.amount, 0);
    const buckets: Record<ExpenseBucket, number> = {
      fuel: 0,
      equipment: 0,
      software: 0,
      marketing: 0,
      office: 0,
      payroll: 0,
      tax: 0,
    };
    let opex = 0; // all non-capex spend (matches the company's "expenses" line)
    let capex = 0;
    for (const e of expenses) {
      if (e.capex) {
        capex += e.amount;
        continue; // capex is tracked separately, not in operating buckets
      }
      opex += e.amount;
      buckets[classify(e.category, false)] += e.amount;
    }
    const tax = buckets.tax; // statutory items, shown separately in the tax view
    const drawsTotal = draws.reduce((s, d) => s + d.amount, 0);
    const operatingProfit = revenue - opex;
    // Bank movement excludes owner draws (a distribution, not a business cost).
    const netCash = revenue - opex - capex;
    running += netCash;

    return {
      month,
      label: SHORT_LABEL[month],
      index,
      revenue,
      opex,
      tax,
      capex,
      operatingProfit,
      operatingCashFlow: revenue - opex,
      operatingMargin: revenue > 0 ? (operatingProfit / revenue) * 100 : 0,
      draws: drawsTotal,
      buckets,
      netCash,
      cashBalance: running,
    };
  });
})();

// (Client revenue, concentration & segments now come from lib/clients.ts —
//  the official invoice ledger — and are re-exported at the top of this file.)

// ----------------------------------------------------------------------------
// Operations series (only months present in ops.json carry data)
// ----------------------------------------------------------------------------
export type MonthOps = {
  month: string;
  label: string;
  index: number;
  jobs: number;
  measured: number; // jobs actually performed (measureTime > 0)
  open: number; // scheduled / not yet measured (measureDate null)
  dealValue: number;
  avgMeasureTime: number; // minutes
  avgTravelTime: number; // minutes (to + back)
  avgKm: number; // km (to + back)
  revenuePerMeasurement: number;
};

export const monthlyOps: MonthOps[] = MONTH_ORDER.map((month, index) => {
  const m = opsMonths.find((o) => o.month === month);
  const jobs = m?.jobs ?? [];
  const measuredJobs = jobs.filter((j) => j.measureTime > 0);
  const travelJobs = jobs.filter((j) => j.timeTo > 0);
  const kmJobs = jobs.filter((j) => j.kmTo > 0);
  const dealValue = jobs.reduce((s, j) => s + j.dealValue, 0);
  const measured = measuredJobs.length;
  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0;

  return {
    month,
    label: SHORT_LABEL[month],
    index,
    jobs: jobs.length,
    measured,
    open: jobs.filter((j) => j.measureDate === null).length,
    dealValue,
    avgMeasureTime: avg(measuredJobs.map((j) => j.measureTime)),
    avgTravelTime: avg(travelJobs.map((j) => j.timeTo + j.timeBack)),
    avgKm: avg(kmJobs.map((j) => j.kmTo + j.kmBack)),
    revenuePerMeasurement: measured ? dealValue / measured : 0,
  };
});

export const opsMonthsWithData = monthlyOps.filter((m) => m.jobs > 0);

// All jobs flattened (for tables / distributions)
export const allJobs = opsMonths.flatMap((m) =>
  m.jobs.map((j) => ({ ...j, month: m.month }))
);

// ----------------------------------------------------------------------------
// Aggregate KPIs
// ----------------------------------------------------------------------------
const monthsWithRevenue = monthlyFinance.filter((m) => m.revenue > 0);
const latest = monthsWithRevenue[monthsWithRevenue.length - 1];
const prev = monthsWithRevenue[monthsWithRevenue.length - 2];

export const totals = {
  revenue: monthlyFinance.reduce((s, m) => s + m.revenue, 0),
  opex: monthlyFinance.reduce((s, m) => s + m.opex, 0),
  capex: monthlyFinance.reduce((s, m) => s + m.capex, 0),
  operatingProfit: monthlyFinance.reduce((s, m) => s + m.operatingProfit, 0),
  draws: monthlyFinance.reduce((s, m) => s + m.draws, 0),
  measurements: monthlyOps.reduce((s, m) => s + m.measured, 0),
  jobs: monthlyOps.reduce((s, m) => s + m.jobs, 0),
};

export const operatingMarginPct =
  totals.revenue > 0 ? (totals.operatingProfit / totals.revenue) * 100 : 0;

const opsWithData = opsMonthsWithData;
const avgAcross = (pick: (m: MonthOps) => number, weightByMeasured = true) => {
  if (weightByMeasured) {
    const totalW = opsWithData.reduce((s, m) => s + m.measured, 0);
    if (!totalW) return 0;
    return opsWithData.reduce((s, m) => s + pick(m) * m.measured, 0) / totalW;
  }
  return opsWithData.length
    ? opsWithData.reduce((s, m) => s + pick(m), 0) / opsWithData.length
    : 0;
};

export const opsAverages = {
  avgMeasureTime: avgAcross((m) => m.avgMeasureTime),
  avgTravelTime: avgAcross((m) => m.avgTravelTime),
  avgKm: avgAcross((m) => m.avgKm),
  revenuePerMeasurement:
    totals.measurements > 0
      ? monthlyOps.reduce((s, m) => s + m.dealValue, 0) / totals.measurements
      : 0,
};

// ----------------------------------------------------------------------------
// Headline KPIs for the executive home
// ----------------------------------------------------------------------------
function pctChange(cur: number, before: number): number {
  if (!before) return 0;
  return ((cur - before) / before) * 100;
}

const latestOps = opsWithData[opsWithData.length - 1];

export const headline = {
  monthlyRevenue: latest.revenue,
  monthlyRevenueChange: pctChange(latest.revenue, prev.revenue),
  operatingProfit: latest.operatingProfit,
  operatingProfitChange: pctChange(latest.operatingProfit, prev.operatingProfit),
  cashFlow: latest.operatingCashFlow,
  cashBalance: latest.cashBalance,
  measurements: latestOps?.measured ?? 0,
  revenuePerMeasurement: opsAverages.revenuePerMeasurement,
  avgMeasureTime: opsAverages.avgMeasureTime,
  errorsThisMonth: 2, // SEEDED — no error log in source data
  backlogDays: 14, // SEEDED — derived planning assumption
  annualProfitForecast: totals.operatingProfit * (12 / monthsWithRevenue.length),
  latestMonthLabel: latest.month,
};

// ----------------------------------------------------------------------------
// Sales funnel & client segmentation (derived where possible, SEEDED ratios)
// ----------------------------------------------------------------------------
const totalOpsJobs = totals.jobs;
const wonJobs = allJobs.filter((j) => j.measureDate !== null).length;

export const salesFunnel = {
  leads: Math.round(totalOpsJobs * 1.9), // SEEDED top-of-funnel factor
  quotes: totalOpsJobs,
  won: wonJobs,
  get conversion() {
    return this.quotes ? (this.won / this.quotes) * 100 : 0;
  },
};

// clientSegments & concentration are imported from lib/clients.ts (invoice ledger).

export const avgMonthlyOpex =
  monthsWithRevenue.reduce((s, m) => s + m.opex, 0) / monthsWithRevenue.length;

export const strategy = {
  runwayMonths: headline.cashBalance / avgMonthlyOpex,
  backlogDays: headline.backlogDays,
  cashReserve: headline.cashBalance,
  revenueVsLastYear: 100, // SEEDED — first full year of operation
  newClientsYtd: clientSegments.newClients,
  newPartners: 3, // SEEDED
  newAreas: 4, // SEEDED
};

// ----------------------------------------------------------------------------
// Owner draws over time (feeds the Personal module)
// ----------------------------------------------------------------------------
export type OwnerDraw = { name: string; total: number };
export const ownerDraws: OwnerDraw[] = (() => {
  const map = new Map<string, number>();
  pnlMonths.forEach((m) =>
    m.draws.forEach((d) => map.set(d.name, (map.get(d.name) ?? 0) + d.amount))
  );
  return [...map.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
})();

export const founderMonthlyDraw = MONTH_ORDER.map((month) => {
  const m = pnlMonths.find((p) => p.month === month);
  const mine = m?.draws
    .filter((d) => d.name === "מיכאל" || d.name === "סוליין")
    .reduce((s, d) => s + d.amount, 0);
  return { month, label: SHORT_LABEL[month], value: mine ?? 0 };
});

// ----------------------------------------------------------------------------
// SEEDED illustrative datasets (no source in the files)
// ----------------------------------------------------------------------------
export const serviceTypeSplit = [
  { name: "מטבחים", value: 46 },
  { name: "שיש ואבן", value: 22 },
  { name: "אדריכלות", value: 14 },
  { name: "בנייה ופרויקטים", value: 12 },
  { name: "זכוכית ואלומיניום", value: 6 },
];

export const personalWellbeing = MONTH_ORDER.slice(-6).map((month, i) => ({
  month,
  label: SHORT_LABEL[month],
  workHours: [210, 224, 236, 218, 240, 231][i],
  drivingHours: [58, 63, 71, 66, 74, 69][i],
  officeHours: [72, 80, 78, 74, 85, 79][i],
  bizDevHours: [18, 22, 26, 20, 28, 24][i],
  workouts: [8, 10, 12, 9, 13, 11][i],
  sleepHours: [6.5, 6.8, 6.2, 7.0, 6.4, 6.9][i],
  stress: [6, 5, 7, 4, 6, 5][i],
  vacationDays: [0, 1, 0, 2, 0, 1][i],
}));

// ----------------------------------------------------------------------------
// Alerts & tasks for the executive home (rule-based on real data)
// ----------------------------------------------------------------------------
export type Alert = {
  id: string;
  severity: "danger" | "warning" | "info" | "success";
  title: string;
  detail: string;
};

export const alerts: Alert[] = (() => {
  const out: Alert[] = [];
  if (concentration.largestClientPct > 15) {
    out.push({
      id: "conc",
      severity: "warning",
      title: "ריכוזיות לקוחות",
      detail: `${concentration.largestClient} מהווה ${concentration.largestClientPct.toFixed(
        1
      )}% מההכנסות. מומלץ לגוון.`,
    });
  }
  if (strategy.runwayMonths < 6) {
    out.push({
      id: "runway",
      severity: "danger",
      title: "מסלול מזומנים קצר",
      detail: `נותרו כ-${strategy.runwayMonths.toFixed(1)} חודשי הוצאה בקופה.`,
    });
  } else {
    out.push({
      id: "runway-ok",
      severity: "success",
      title: "יציבות תזרימית",
      detail: `מסלול מזומנים של ${strategy.runwayMonths.toFixed(1)} חודשים.`,
    });
  }
  if (latest.operatingMargin < prev.operatingMargin) {
    out.push({
      id: "margin",
      severity: "warning",
      title: "שחיקת רווחיות",
      detail: `מרווח תפעולי ירד ל-${latest.operatingMargin.toFixed(1)}% מ-${prev.operatingMargin.toFixed(
        1
      )}%.`,
    });
  }
  out.push({
    id: "capex",
    severity: "info",
    title: "השקעות הון",
    detail: `סה״כ CAPEX השנה: ${Math.round(totals.capex).toLocaleString(
      "he-IL"
    )} ₪ (ציוד לייקה, רכב, מערכות).`,
  });
  return out;
})();

export const todaysTasks = [
  { id: "t1", title: "לאשר הצעת מחיר – פרויקט הר שושנים", done: false },
  { id: "t2", title: "מעקב גבייה – אלקינצ'ו", done: false },
  { id: "t3", title: "תיאום מדידה חוזרת – בנק לאומי", done: true },
  { id: "t4", title: "סקירת דוח דלק חודשי", done: false },
  { id: "t5", title: "עדכון תמחור שירותי שיש", done: false },
];
