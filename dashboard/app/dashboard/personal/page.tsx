"use client";

import {
  User,
  Clock,
  Car,
  Building2,
  Lightbulb,
  Wallet,
  Coins,
  PiggyBank,
  TrendingUp,
  Palmtree,
  Dumbbell,
  Moon,
  Gauge,
} from "lucide-react";
import { KPICard } from "@/components/kpi-card";
import { MetricGrid, SectionHeader } from "@/components/section-header";
import { DashboardChart } from "@/components/dashboard-chart";
import { StatList } from "@/components/stat-list";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CurrencyValue } from "@/components/value-display";
import {
  personalWellbeing,
  ownerDraws,
  founderMonthlyDraw,
} from "@/lib/data";
import { formatCurrency, formatNumber } from "@/lib/format";

export default function PersonalPage() {
  const w = personalWellbeing;
  const totalWork = w.reduce((s, m) => s + m.workHours, 0);
  const totalDriving = w.reduce((s, m) => s + m.drivingHours, 0);
  const totalOffice = w.reduce((s, m) => s + m.officeHours, 0);
  const totalBizDev = w.reduce((s, m) => s + m.bizDevHours, 0);

  const founderTotal = ownerDraws
    .filter((d) => d.name === "מיכאל" || d.name === "סוליין")
    .reduce((s, d) => s + d.total, 0);

  const wellbeingSeries = w.map((m) => ({
    label: m.label,
    work: m.workHours,
    driving: m.drivingHours,
    bizdev: m.bizDevHours,
    sleep: m.sleepHours,
    stress: m.stress,
  }));

  const avgSleep = w.reduce((s, m) => s + m.sleepHours, 0) / w.length;
  const avgStress = w.reduce((s, m) => s + m.stress, 0) / w.length;
  const totalWorkouts = w.reduce((s, m) => s + m.workouts, 0);
  const totalVacation = w.reduce((s, m) => s + m.vacationDays, 0);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="ביצועים אישיים"
        description="זמן, כסף ורווחה של המנכ״ל"
        icon={User}
      />

      {/* Time */}
      <section className="space-y-4">
        <SectionHeader title="זמן" icon={Clock} />
        <MetricGrid cols={4}>
          <KPICard title="שעות עבודה" value={`${formatNumber(totalWork)} ש׳`} icon={Clock} accent="primary" hint="6 חודשים" />
          <KPICard title="שעות נהיגה" value={`${formatNumber(totalDriving)} ש׳`} icon={Car} accent="warning" />
          <KPICard title="שעות משרד" value={`${formatNumber(totalOffice)} ש׳`} icon={Building2} accent="primary" />
          <KPICard title="פיתוח עסקי" value={`${formatNumber(totalBizDev)} ש׳`} icon={Lightbulb} accent="success" />
        </MetricGrid>
        <DashboardChart
          title="חלוקת זמן חודשית"
          description="שעות לפי קטגוריה"
          kind="bar"
          data={wellbeingSeries}
          stacked
          series={[
            { key: "work", name: "עבודה", color: "hsl(221 83% 60%)" },
            { key: "driving", name: "נהיגה", color: "hsl(38 92% 55%)" },
            { key: "bizdev", name: "פיתוח עסקי", color: "hsl(142 71% 45%)" },
          ]}
          valueFormatter={(v) => `${v} ש׳`}
        />
      </section>

      {/* Money */}
      <section className="space-y-4">
        <SectionHeader title="כסף" icon={Wallet} />
        <MetricGrid cols={4}>
          <KPICard title="משיכות בעלים (מיכאל)" value={formatCurrency(founderTotal, { compact: true })} icon={Wallet} accent="success" />
          <KPICard title="דיבידנד" value={formatCurrency(0)} icon={Coins} accent="primary" hint="טרם חולק" />
          <KPICard title="השקעות" value={formatCurrency(0)} icon={TrendingUp} accent="primary" hint="לעדכון" />
          <KPICard title="חיסכון אישי" value={formatCurrency(0)} icon={PiggyBank} accent="primary" hint="לעדכון" />
        </MetricGrid>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">משיכות בעלים לפי אדם</CardTitle>
          </CardHeader>
          <CardContent>
            <StatList
              rows={ownerDraws.map((d) => ({
                label: d.name,
                value: <CurrencyValue value={d.total} />,
              }))}
            />
          </CardContent>
        </Card>
        <DashboardChart
          title="משיכות מיכאל / סוליין לפי חודש"
          kind="area"
          data={founderMonthlyDraw}
          series={[{ key: "value", name: "משיכה" }]}
          valueFormatter={(v) => formatCurrency(v, { compact: true })}
        />
      </section>

      {/* Wellbeing */}
      <section className="space-y-4">
        <SectionHeader title="רווחה" icon={Gauge} />
        <MetricGrid cols={4}>
          <KPICard title="ימי חופשה" value={formatNumber(totalVacation)} icon={Palmtree} accent="warning" hint="6 חודשים" />
          <KPICard title="אימונים" value={formatNumber(totalWorkouts)} icon={Dumbbell} accent="success" />
          <KPICard title="שעות שינה (ממוצע)" value={avgSleep.toFixed(1)} icon={Moon} accent="primary" />
          <KPICard title="רמת לחץ (1-10)" value={avgStress.toFixed(1)} icon={Gauge} accent={avgStress > 6 ? "destructive" : "success"} />
        </MetricGrid>
        <DashboardChart
          title="מגמת רווחה אישית"
          description="שינה מול לחץ"
          kind="line"
          data={wellbeingSeries}
          series={[
            { key: "sleep", name: "שעות שינה", color: "hsl(221 83% 60%)" },
            { key: "stress", name: "רמת לחץ", color: "hsl(0 72% 58%)" },
          ]}
        />
      </section>
    </div>
  );
}
