"use client";

import {
  Banknote,
  Wallet,
  ArrowLeftRight,
  Landmark,
  Ruler,
  Coins,
  Timer,
  AlertOctagon,
  CalendarClock,
  LineChart as LineChartIcon,
  Bell,
  ListChecks,
} from "lucide-react";
import { KPICard } from "@/components/kpi-card";
import { MetricGrid, SectionHeader } from "@/components/section-header";
import { DashboardChart } from "@/components/dashboard-chart";
import { AlertItem } from "@/components/alert-item";
import { TasksPanel } from "@/components/tasks-panel";
import { DateRangePicker } from "@/components/date-range-picker";
import { ExportMenu } from "@/components/export-menu";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  headline,
  monthlyFinance,
  monthlyOps,
  alerts,
  todaysTasks,
} from "@/lib/data";
import { formatCurrency, formatDuration, formatNumber } from "@/lib/format";

export default function DashboardHome() {
  const revenueSeries = monthlyFinance.map((m) => ({
    label: m.label,
    revenue: Math.round(m.revenue),
    profit: Math.round(m.operatingProfit),
    cash: Math.round(m.cashBalance),
  }));
  const opsSeries = monthlyOps
    .filter((m) => m.jobs > 0)
    .map((m) => ({ label: m.label, measured: m.measured }));

  return (
    <div className="space-y-6">
      <SectionHeader
        title="סקירת מנכ״ל"
        description="תמונת מצב חיה — פיננסים, תפעול וביצועים"
        icon={LineChartIcon}
        action={
          <>
            <DateRangePicker />
            <ExportMenu data={revenueSeries} filename="soline-overview" />
          </>
        }
      />

      {/* KPI grid */}
      <MetricGrid cols={4} className="lg:grid-cols-5">
        <KPICard
          title="מחזור חודשי"
          value={formatCurrency(headline.monthlyRevenue, { compact: true })}
          change={headline.monthlyRevenueChange}
          icon={Banknote}
          accent="primary"
        />
        <KPICard
          title="רווח תפעולי"
          value={formatCurrency(headline.operatingProfit, { compact: true })}
          change={headline.operatingProfitChange}
          icon={Wallet}
          accent="success"
        />
        <KPICard
          title="תזרים מזומנים"
          value={formatCurrency(headline.cashFlow, { compact: true })}
          icon={ArrowLeftRight}
          accent={headline.cashFlow >= 0 ? "success" : "destructive"}
          hint="נטו החודש"
        />
        <KPICard
          title="יתרת בנק"
          value={formatCurrency(headline.cashBalance, { compact: true })}
          icon={Landmark}
          accent="primary"
          hint="מצטבר"
        />
        <KPICard
          title="מדידות החודש"
          value={formatNumber(headline.measurements)}
          icon={Ruler}
          accent="primary"
        />
        <KPICard
          title="הכנסה ממוצעת למדידה"
          value={formatCurrency(headline.revenuePerMeasurement)}
          icon={Coins}
          accent="success"
        />
        <KPICard
          title="זמן ממוצע למדידה"
          value={formatDuration(headline.avgMeasureTime)}
          icon={Timer}
          accent="warning"
        />
        <KPICard
          title="טעויות החודש"
          value={formatNumber(headline.errorsThisMonth)}
          icon={AlertOctagon}
          accent={headline.errorsThisMonth > 3 ? "destructive" : "success"}
          hint="הערכה"
        />
        <KPICard
          title="צבר עבודה קדימה"
          value={`${headline.backlogDays} ימים`}
          icon={CalendarClock}
          accent="primary"
        />
        <KPICard
          title="תחזית רווח שנתי"
          value={formatCurrency(headline.annualProfitForecast, { compact: true })}
          icon={LineChartIcon}
          accent="success"
          hint="אנואליזציה"
        />
      </MetricGrid>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardChart
          title="מגמת מחזור"
          description="ינואר–יולי 2026"
          kind="area"
          data={revenueSeries}
          series={[{ key: "revenue", name: "מחזור" }]}
          valueFormatter={(v) => formatCurrency(v, { compact: true })}
        />
        <DashboardChart
          title="מגמת רווח תפעולי"
          description="ינואר–יולי 2026"
          kind="line"
          data={revenueSeries}
          series={[{ key: "profit", name: "רווח תפעולי", color: "hsl(142 71% 45%)" }]}
          valueFormatter={(v) => formatCurrency(v, { compact: true })}
        />
        <DashboardChart
          title="מדידות לפי חודש"
          description="חודשים עם נתוני תפעול"
          kind="bar"
          data={opsSeries}
          series={[{ key: "measured", name: "מדידות" }]}
        />
        <DashboardChart
          title="יתרת מזומנים"
          description="מצטבר לאורך השנה"
          kind="area"
          data={revenueSeries}
          series={[{ key: "cash", name: "יתרה", color: "hsl(280 65% 60%)" }]}
          valueFormatter={(v) => formatCurrency(v, { compact: true })}
        />
      </div>

      {/* Alerts + tasks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Bell className="size-5 text-primary" />
            <CardTitle className="text-base">התראות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a) => (
              <AlertItem key={a.id} alert={a} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <ListChecks className="size-5 text-primary" />
            <CardTitle className="text-base">משימות להיום</CardTitle>
          </CardHeader>
          <CardContent>
            <TasksPanel initial={todaysTasks} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
