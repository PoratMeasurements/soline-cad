"use client";

import {
  Wallet,
  TrendingUp,
  Receipt,
  Landmark,
  Percent,
  Fuel,
  Wrench,
  MonitorSmartphone,
  Megaphone,
  Building2,
  Users,
  Scale,
} from "lucide-react";
import { KPICard } from "@/components/kpi-card";
import { MetricGrid, SectionHeader } from "@/components/section-header";
import { DashboardChart } from "@/components/dashboard-chart";
import { DateRangePicker } from "@/components/date-range-picker";
import { ExportMenu } from "@/components/export-menu";
import { StatList } from "@/components/stat-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CurrencyValue, PercentValue } from "@/components/value-display";
import {
  monthlyFinance,
  totals,
  operatingMarginPct,
  clientRevenue,
  invoiceSummary,
  serviceTypeSplit,
  BUCKET_LABEL,
  type ExpenseBucket,
} from "@/lib/data";
import { useSettings } from "@/store/settings-store";
import { formatCurrency } from "@/lib/format";

export default function FinancePage() {
  const { company } = useSettings();
  const monthsActive = monthlyFinance.filter((m) => m.revenue > 0).length;

  // Bucket totals across the year
  const buckets = monthlyFinance.reduce(
    (acc, m) => {
      (Object.keys(m.buckets) as ExpenseBucket[]).forEach(
        (k) => (acc[k] += m.buckets[k])
      );
      return acc;
    },
    {
      fuel: 0,
      equipment: 0,
      software: 0,
      marketing: 0,
      office: 0,
      payroll: 0,
      tax: 0,
    } as Record<ExpenseBucket, number>
  );

  const fixedExpenses =
    buckets.software +
    buckets.office +
    buckets.payroll +
    buckets.marketing +
    buckets.tax;
  const variableExpenses = buckets.fuel + buckets.equipment;

  // Profitability (gross ≈ revenue minus direct field costs)
  const directCosts = buckets.fuel + buckets.payroll;
  const grossProfit = totals.revenue - directCosts;
  const netProfit =
    totals.operatingProfit - totals.operatingProfit * (company.corporateTaxRate / 100);

  // Cash flow — AR/AP are seeded proxies (no ledger in source data)
  const latest = monthlyFinance.filter((m) => m.revenue > 0).at(-1)!;
  const avgMonthlyRevenue = totals.revenue / monthsActive;
  const accountsReceivable = avgMonthlyRevenue * 1.2; // SEEDED
  const accountsPayable = (totals.opex / monthsActive) * 0.6; // SEEDED
  const dso = 36; // SEEDED
  const dpo = 22; // SEEDED

  // Taxes
  const corporateTax = totals.operatingProfit * (company.corporateTaxRate / 100);
  const vatPayable = totals.revenue * (company.vatRate / 100) * 0.35; // net position, SEEDED ratio
  const nationalInsurance = buckets.tax * 0.25; // SEEDED split
  const pension = avgMonthlyRevenue * 0.06 * monthsActive; // SEEDED
  const taxReserve = corporateTax + vatPayable;

  const financeSeries = monthlyFinance.map((m) => ({
    label: m.label,
    revenue: Math.round(m.revenue),
    opex: Math.round(m.opex),
    profit: Math.round(m.operatingProfit),
    cash: Math.round(m.cashBalance),
  }));

  const expenseBreakdown = (Object.keys(buckets) as ExpenseBucket[])
    .map((k) => ({ name: BUCKET_LABEL[k], value: Math.round(buckets[k]) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="פיננסים"
        description="הכנסות, רווחיות, הוצאות, תזרים ומסים"
        icon={Wallet}
        action={
          <>
            <DateRangePicker />
            <ExportMenu data={financeSeries} filename="soline-finance" />
          </>
        }
      />

      {/* Revenue */}
      <section className="space-y-4">
        <SectionHeader title="הכנסות" icon={TrendingUp} />
        <MetricGrid cols={4}>
          <KPICard
            title="מחזור שנתי"
            value={formatCurrency(totals.revenue, { compact: true })}
            icon={TrendingUp}
            accent="primary"
            hint={`${monthsActive} חודשי פעילות`}
          />
          <KPICard
            title="מחזור חודשי ממוצע"
            value={formatCurrency(avgMonthlyRevenue, { compact: true })}
            icon={TrendingUp}
            accent="primary"
          />
          <KPICard
            title="הכנסה ליום עבודה"
            value={formatCurrency(totals.revenue / (monthsActive * 21))}
            icon={TrendingUp}
            accent="success"
            hint="~21 ימים בחודש"
          />
          <KPICard
            title="הכנסה למדידה"
            value={formatCurrency(
              totals.measurements ? totals.revenue / totals.measurements : 0
            )}
            icon={TrendingUp}
            accent="success"
          />
        </MetricGrid>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <DashboardChart
            title="מחזור לפי חודש"
            kind="area"
            data={financeSeries}
            series={[{ key: "revenue", name: "מחזור" }]}
            valueFormatter={(v) => formatCurrency(v, { compact: true })}
            className="lg:col-span-2"
          />
          <DashboardChart
            title="פילוח לפי סוג שירות"
            description="חלוקה משוערת"
            kind="pie"
            data={serviceTypeSplit}
            xKey="name"
            series={[{ key: "value", name: "אחוז" }]}
            valueFormatter={(v) => `${v}%`}
          />
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">הכנסה לפי לקוח</CardTitle>
            <CardDescription>
              מתוך חשבוניות רשמיות · {formatCurrency(invoiceSummary.net, { compact: true })} נטו ({invoiceSummary.count} חשבוניות, {invoiceSummary.periodLabel})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatList
              rows={clientRevenue.map((c) => ({
                label: c.client,
                hint: `${c.invoices} חשבוניות · ${c.months} חודשים`,
                value: <CurrencyValue value={c.total} />,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      {/* Profitability */}
      <section className="space-y-4">
        <SectionHeader title="רווחיות" icon={Percent} />
        <MetricGrid cols={3}>
          <KPICard
            title="רווח גולמי"
            value={formatCurrency(grossProfit, { compact: true })}
            icon={Scale}
            accent="success"
            hint={`שיעור ${((grossProfit / totals.revenue) * 100).toFixed(1)}%`}
          />
          <KPICard
            title="רווח תפעולי"
            value={formatCurrency(totals.operatingProfit, { compact: true })}
            icon={Wallet}
            accent="success"
            hint={`מרווח ${operatingMarginPct.toFixed(1)}%`}
          />
          <KPICard
            title="רווח נקי (מוערך)"
            value={formatCurrency(netProfit, { compact: true })}
            icon={Percent}
            accent="success"
            hint={`אחרי מס ${company.corporateTaxRate}%`}
          />
        </MetricGrid>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <MarginTile label="מרווח גולמי" value={(grossProfit / totals.revenue) * 100} />
              <MarginTile label="מרווח תפעולי" value={operatingMarginPct} />
              <MarginTile label="מרווח נקי" value={(netProfit / totals.revenue) * 100} />
            </div>
          </CardContent>
        </Card>
        <DashboardChart
          title="מחזור מול רווח תפעולי"
          kind="bar"
          data={financeSeries}
          series={[
            { key: "revenue", name: "מחזור" },
            { key: "profit", name: "רווח תפעולי", color: "hsl(142 71% 45%)" },
          ]}
          valueFormatter={(v) => formatCurrency(v, { compact: true })}
        />
      </section>

      {/* Expenses */}
      <section className="space-y-4">
        <SectionHeader title="הוצאות" icon={Receipt} />
        <MetricGrid cols={4}>
          <KPICard title="הוצאות קבועות" value={formatCurrency(fixedExpenses, { compact: true })} icon={Building2} accent="warning" />
          <KPICard title="הוצאות משתנות" value={formatCurrency(variableExpenses, { compact: true })} icon={Fuel} accent="warning" />
          <KPICard title="דלק ונסיעות" value={formatCurrency(buckets.fuel, { compact: true })} icon={Fuel} accent="warning" />
          <KPICard title="ציוד" value={formatCurrency(buckets.equipment, { compact: true })} icon={Wrench} accent="warning" />
          <KPICard title="תוכנה ומערכות" value={formatCurrency(buckets.software, { compact: true })} icon={MonitorSmartphone} accent="warning" />
          <KPICard title="שיווק" value={formatCurrency(buckets.marketing, { compact: true })} icon={Megaphone} accent="warning" />
          <KPICard title="משרד וכללי" value={formatCurrency(buckets.office, { compact: true })} icon={Building2} accent="warning" />
          <KPICard title="שכר וקבלנים" value={formatCurrency(buckets.payroll, { compact: true })} icon={Users} accent="warning" />
          <KPICard title="השקעות הון (CAPEX)" value={formatCurrency(totals.capex, { compact: true })} icon={Wrench} accent="primary" hint="ציוד לייקה, רכב, מערכות" />
        </MetricGrid>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DashboardChart
            title="הוצאות תפעוליות לפי חודש"
            kind="bar"
            data={financeSeries}
            series={[{ key: "opex", name: "הוצאות", color: "hsl(0 72% 58%)" }]}
            valueFormatter={(v) => formatCurrency(v, { compact: true })}
          />
          <DashboardChart
            title="התפלגות הוצאות"
            kind="pie"
            data={expenseBreakdown}
            xKey="name"
            series={[{ key: "value", name: "סכום" }]}
            valueFormatter={(v) => formatCurrency(v, { compact: true })}
          />
        </div>
      </section>

      {/* Cash flow */}
      <section className="space-y-4">
        <SectionHeader title="תזרים מזומנים" icon={Landmark} />
        <MetricGrid cols={4}>
          <KPICard title="יתרת בנק" value={formatCurrency(latest.cashBalance, { compact: true })} icon={Landmark} accent="primary" />
          <KPICard title="לקוחות (חייבים)" value={formatCurrency(accountsReceivable, { compact: true })} icon={Receipt} accent="primary" hint="הערכה" />
          <KPICard title="ספקים (זכאים)" value={formatCurrency(accountsPayable, { compact: true })} icon={Receipt} accent="warning" hint="הערכה" />
          <KPICard title="תזרים נטו חודשי" value={formatCurrency(latest.netCash, { compact: true })} icon={Landmark} accent={latest.netCash >= 0 ? "success" : "destructive"} />
        </MetricGrid>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <DashboardChart
            title="יתרת מזומנים מצטברת"
            kind="area"
            data={financeSeries}
            series={[{ key: "cash", name: "יתרה", color: "hsl(280 65% 60%)" }]}
            valueFormatter={(v) => formatCurrency(v, { compact: true })}
            className="lg:col-span-2"
          />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">מחזוריות</CardTitle>
            </CardHeader>
            <CardContent>
              <StatList
                rows={[
                  { label: "ימי גבייה (DSO)", value: `${dso} ימים` },
                  { label: "ימי תשלום (DPO)", value: `${dpo} ימים` },
                  { label: "פער תזרימי", value: `${dso - dpo} ימים`, emphasis: true },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Taxes */}
      <section className="space-y-4">
        <SectionHeader title="מסים והפרשות" icon={Scale} />
        <MetricGrid cols={4}>
          <KPICard title="מס חברות מוערך" value={formatCurrency(corporateTax, { compact: true })} icon={Scale} accent="destructive" hint={`${company.corporateTaxRate}%`} />
          <KPICard title="מע״מ לתשלום" value={formatCurrency(vatPayable, { compact: true })} icon={Receipt} accent="destructive" hint={`${company.vatRate}%`} />
          <KPICard title="ביטוח לאומי" value={formatCurrency(nationalInsurance, { compact: true })} icon={Users} accent="warning" />
          <KPICard title="הפרשות פנסיה" value={formatCurrency(pension, { compact: true })} icon={Landmark} accent="primary" />
        </MetricGrid>
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-col items-start justify-between gap-3 pt-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-muted-foreground">רזרבת מס מומלצת</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                <CurrencyValue value={taxReserve} />
              </p>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              סכום מומלץ לשמור בצד לכיסוי מס חברות ומע״מ. ניתן לכוונן את שיעורי
              המס בהגדרות.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MarginTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">
        <PercentValue value={value} colorize />
      </p>
    </div>
  );
}
