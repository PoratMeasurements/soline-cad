"use client";

import {
  Target,
  TrendingUp,
  Rocket,
  Handshake,
  MapPin,
  AlertTriangle,
  ShieldCheck,
  Timer,
  Landmark,
  PiggyBank,
} from "lucide-react";
import { KPICard } from "@/components/kpi-card";
import { MetricGrid, SectionHeader } from "@/components/section-header";
import { DashboardChart } from "@/components/dashboard-chart";
import { StatList } from "@/components/stat-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PercentValue } from "@/components/value-display";
import {
  concentration,
  strategy,
  clientRevenue,
  monthlyFinance,
} from "@/lib/data";
import { useSettings } from "@/store/settings-store";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function StrategyPage() {
  const { thresholds } = useSettings();

  const concentrationRisk =
    concentration.largestClientPct > thresholds.maxClientConcentration;
  const runwayRisk = strategy.runwayMonths < thresholds.minRunwayMonths;

  const topClientsShare = clientRevenue.slice(0, 5).map((c) => ({
    name: c.client,
    value: Math.round((c.total / concentration.total) * 100),
  }));

  const profitTrend = monthlyFinance
    .filter((m) => m.revenue > 0)
    .map((m) => ({
      label: m.label,
      margin: Math.round(m.operatingMargin),
    }));

  return (
    <div className="space-y-8">
      <SectionHeader
        title="אסטרטגיה"
        description="צמיחה, ריכוזיות סיכון וחוסן עסקי"
        icon={Target}
      />

      {/* Growth */}
      <section className="space-y-4">
        <SectionHeader title="צמיחה" icon={Rocket} />
        <MetricGrid cols={4}>
          <KPICard title="מחזור מול אשתקד" value="שנה ראשונה" icon={TrendingUp} accent="primary" hint="בסיס להשוואה עתידית" />
          <KPICard title="לקוחות חדשים (שנה)" value={formatNumber(strategy.newClientsYtd)} icon={Rocket} accent="success" />
          <KPICard title="שותפים חדשים" value={formatNumber(strategy.newPartners)} icon={Handshake} accent="success" hint="הערכה" />
          <KPICard title="אזורים גאוגרפיים חדשים" value={formatNumber(strategy.newAreas)} icon={MapPin} accent="primary" hint="הערכה" />
        </MetricGrid>
        <DashboardChart
          title="מגמת מרווח תפעולי"
          description="אחוז לאורך זמן"
          kind="line"
          data={profitTrend}
          series={[{ key: "margin", name: "מרווח תפעולי", color: "hsl(142 71% 45%)" }]}
          valueFormatter={(v) => `${v}%`}
        />
      </section>

      {/* Concentration risk */}
      <section className="space-y-4">
        <SectionHeader title="ריכוזיות וסיכון" icon={AlertTriangle} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className={cn(concentrationRisk && "border-warning/50 bg-warning/5")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">ריכוזיות לקוחות</CardTitle>
              <CardDescription>
                חשיפה ללקוח הגדול ביותר: {concentration.largestClient}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>לקוח מוביל</span>
                  <PercentValue value={concentration.largestClientPct} />
                </div>
                <Progress
                  value={concentration.largestClientPct}
                  indicatorClassName={concentrationRisk ? "bg-warning" : "bg-primary"}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>5 לקוחות מובילים</span>
                  <PercentValue value={concentration.top5Pct} />
                </div>
                <Progress value={concentration.top5Pct} indicatorClassName="bg-primary" />
              </div>
              <p className="text-xs text-muted-foreground">
                סף התראה: {thresholds.maxClientConcentration}% · {concentrationRisk ? "חריגה — מומלץ לגוון לקוחות" : "בטווח הבטוח"}
              </p>
            </CardContent>
          </Card>

          <DashboardChart
            title="נתח 5 הלקוחות המובילים"
            kind="pie"
            data={topClientsShare}
            xKey="name"
            series={[{ key: "value", name: "אחוז" }]}
            valueFormatter={(v) => `${v}%`}
          />
        </div>
      </section>

      {/* Resilience */}
      <section className="space-y-4">
        <SectionHeader title="חוסן עסקי" icon={ShieldCheck} />
        <MetricGrid cols={3}>
          <KPICard
            title="מסלול מזומנים"
            value={`${strategy.runwayMonths.toFixed(1)} חודשים`}
            icon={Timer}
            accent={runwayRisk ? "destructive" : "success"}
            hint={`סף: ${thresholds.minRunwayMonths} חודשים`}
          />
          <KPICard title="צבר עבודה" value={`${strategy.backlogDays} ימים`} icon={Landmark} accent="primary" />
          <KPICard title="רזרבת מזומנים" value={formatCurrency(strategy.cashReserve, { compact: true })} icon={PiggyBank} accent="primary" />
        </MetricGrid>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">כרטיס ניקוד אסטרטגי</CardTitle>
          </CardHeader>
          <CardContent>
            <StatList
              rows={[
                {
                  label: "גיוון לקוחות",
                  value: concentrationRisk ? "לשיפור" : "טוב",
                  hint: `לקוח מוביל ${formatPercent(concentration.largestClientPct)}`,
                },
                {
                  label: "יציבות תזרימית",
                  value: runwayRisk ? "סיכון" : "יציב",
                  hint: `${strategy.runwayMonths.toFixed(1)} חודשי הוצאה בקופה`,
                },
                {
                  label: "בסיס לקוחות",
                  value: `${clientRevenue.length} לקוחות`,
                  hint: "מקורות הכנסה פעילים",
                  emphasis: true,
                },
              ]}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
