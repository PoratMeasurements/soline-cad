// ============================================================================
// Authoritative client revenue — sourced ONLY from the official invoice ledger
// (data/invoices.json, exported from the accounting system: חשבוניות מס / קבלה).
// Amounts are NET of VAT (סה"כ לפני מע"מ). This is the source of truth for every
// client-level view (revenue by client, segmentation, concentration).
// ============================================================================

import invoicesRaw from "@/data/invoices.json";

export type Invoice = {
  client: string;
  net: number; // before VAT
  gross: number; // incl VAT
  date: string; // YYYY-MM-DD
  doc: string;
};

export const invoices = invoicesRaw as Invoice[];

// Distinct invoice months in chronological order (e.g. 2026-03 … 2026-08)
export const invoiceMonths = [...new Set(invoices.map((i) => i.date.slice(0, 7)))].sort();
const lastIdx = invoiceMonths.length - 1;

const HE_MONTH: Record<string, string> = {
  "01": "ינו׳",
  "02": "פבר׳",
  "03": "מרץ",
  "04": "אפר׳",
  "05": "מאי",
  "06": "יוני",
  "07": "יולי",
  "08": "אוג׳",
  "09": "ספט׳",
  "10": "אוק׳",
  "11": "נוב׳",
  "12": "דצמ׳",
};

export function monthLabel(ym: string): string {
  const [, m] = ym.split("-");
  return HE_MONTH[m] ?? ym;
}

export type ClientRevenue = {
  client: string;
  total: number; // net revenue
  gross: number;
  invoices: number;
  months: number; // distinct active months
  firstMonthIndex: number;
  lastMonthIndex: number;
  firstDate: string;
  lastDate: string;
};

export const clientRevenue: ClientRevenue[] = (() => {
  const map = new Map<
    string,
    {
      client: string;
      total: number;
      gross: number;
      invoices: number;
      months: Set<string>;
      dates: string[];
    }
  >();
  for (const inv of invoices) {
    const e =
      map.get(inv.client) ??
      {
        client: inv.client,
        total: 0,
        gross: 0,
        invoices: 0,
        months: new Set<string>(),
        dates: [],
      };
    e.total += inv.net;
    e.gross += inv.gross;
    e.invoices += 1;
    e.months.add(inv.date.slice(0, 7));
    e.dates.push(inv.date);
    map.set(inv.client, e);
  }
  return [...map.values()]
    .map((e) => {
      const sorted = e.dates.sort();
      const first = sorted[0].slice(0, 7);
      const last = sorted[sorted.length - 1].slice(0, 7);
      return {
        client: e.client,
        total: Math.round(e.total * 100) / 100,
        gross: Math.round(e.gross * 100) / 100,
        invoices: e.invoices,
        months: e.months.size,
        firstMonthIndex: invoiceMonths.indexOf(first),
        lastMonthIndex: invoiceMonths.indexOf(last),
        firstDate: sorted[0],
        lastDate: sorted[sorted.length - 1],
      };
    })
    .sort((a, b) => b.total - a.total);
})();

// Monthly invoiced revenue (net) across the ledger period
export const invoicedByMonth = invoiceMonths.map((ym) => ({
  month: ym,
  label: monthLabel(ym),
  value:
    Math.round(
      invoices
        .filter((i) => i.date.slice(0, 7) === ym)
        .reduce((s, i) => s + i.net, 0) * 100
    ) / 100,
}));

export const invoiceSummary = {
  net: Math.round(invoices.reduce((s, i) => s + i.net, 0) * 100) / 100,
  gross: Math.round(invoices.reduce((s, i) => s + i.gross, 0) * 100) / 100,
  count: invoices.length,
  clients: clientRevenue.length,
  periodStart: invoiceMonths[0],
  periodEnd: invoiceMonths[lastIdx],
  periodLabel: `${monthLabel(invoiceMonths[0])}–${monthLabel(invoiceMonths[lastIdx])} ${invoiceMonths[lastIdx].slice(0, 4)}`,
};

export const concentration = (() => {
  const total = invoiceSummary.net;
  const top1 = clientRevenue[0]?.total ?? 0;
  const top5 = clientRevenue.slice(0, 5).reduce((s, c) => s + c.total, 0);
  return {
    total,
    largestClient: clientRevenue[0]?.client ?? "",
    largestClientPct: total ? (top1 / total) * 100 : 0,
    top5Pct: total ? (top5 / total) * 100 : 0,
  };
})();

export const clientSegments = (() => {
  const active = clientRevenue.filter((c) => c.lastMonthIndex >= lastIdx - 2).length;
  const returning = clientRevenue.filter((c) => c.months > 1).length;
  const newClients = clientRevenue.filter((c) => c.firstMonthIndex >= lastIdx - 1).length;
  const lost = clientRevenue.filter((c) => c.lastMonthIndex < lastIdx - 2).length;
  return { active, returning, newClients, lost, total: clientRevenue.length };
})();
