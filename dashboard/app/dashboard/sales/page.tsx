"use client";

import {
  TrendingUp,
  Filter,
  UserPlus,
  Repeat,
  Users,
  UserMinus,
  Handshake,
  Gem,
  Wallet,
} from "lucide-react";
import { KPICard } from "@/components/kpi-card";
import { MetricGrid, SectionHeader } from "@/components/section-header";
import { DashboardChart } from "@/components/dashboard-chart";
import { ExportMenu } from "@/components/export-menu";
import { StatList } from "@/components/stat-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CurrencyValue } from "@/components/value-display";
import {
  salesFunnel,
  clientSegments,
  clientRevenue,
  allJobs,
  totals,
  concentration,
} from "@/lib/data";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { avgDealSize } from "@/lib/calculations";
import { cn } from "@/lib/utils";

export default function SalesPage() {
  const wonJobs = allJobs.filter((j) => j.measureDate !== null);
  const totalDealValue = allJobs.reduce((s, j) => s + j.dealValue, 0);
  const deal = avgDealSize(totalDealValue, wonJobs.length || 1);
  const avgClientValue =
    clientRevenue.length ? concentration.total / clientRevenue.length : 0;
  // recurring B2B clients ~ those active in 3+ months
  const recurring = clientRevenue.filter((c) => c.months >= 3);
  const mrr =
    recurring.reduce((s, c) => s + c.total, 0) / 12; // avg monthly from recurring

  const funnelStages = [
    { label: "לידים", value: salesFunnel.leads, color: "hsl(221 83% 60%)" },
    { label: "הצעות שנשלחו", value: salesFunnel.quotes, color: "hsl(190 80% 45%)" },
    { label: "עסקאות שנסגרו", value: salesFunnel.won, color: "hsl(142 71% 45%)" },
  ];
  const maxFunnel = funnelStages[0].value;

  const segmentData = [
    { name: "פעילים", value: clientSegments.active },
    { name: "חוזרים", value: clientSegments.returning },
    { name: "חדשים", value: clientSegments.newClients },
    { name: "לא פעילים", value: clientSegments.lost },
  ];

  return (
    <div className="space-y-8">
      <SectionHeader
        title="מכירות"
        description="משפך, לקוחות וערך עסקה"
        icon={TrendingUp}
        action={<ExportMenu data={clientRevenue} filename="soline-sales" />}
      />

      {/* Funnel */}
      <section className="space-y-4">
        <SectionHeader title="משפך מכירות" icon={Filter} />
        <MetricGrid cols={4}>
          <KPICard title="לידים" value={formatNumber(salesFunnel.leads)} icon={Filter} accent="primary" hint="הערכה" />
          <KPICard title="הצעות שנשלחו" value={formatNumber(salesFunnel.quotes)} icon={Filter} accent="primary" />
          <KPICard title="עסקאות שנסגרו" value={formatNumber(salesFunnel.won)} icon={Handshake} accent="success" />
          <KPICard title="שיעור המרה" value={formatPercent(salesFunnel.conversion)} icon={TrendingUp} accent="success" />
        </MetricGrid>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ויזואליזציית משפך</CardTitle>
            <CardDescription>מליד ועד עסקה סגורה</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnelStages.map((s, i) => {
              const pct = (s.value / maxFunnel) * 100;
              const conv =
                i === 0 ? 100 : (s.value / funnelStages[i - 1].value) * 100;
              return (
                <div key={s.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatNumber(s.value)} · {conv.toFixed(0)}%
                    </span>
                  </div>
                  <div
                    className="mx-auto h-11 rounded-xl transition-all"
                    style={{
                      width: `${Math.max(pct, 12)}%`,
                      backgroundColor: s.color,
                    }}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* Clients */}
      <section className="space-y-4">
        <SectionHeader title="לקוחות" icon={Users} />
        <MetricGrid cols={4}>
          <KPICard title="לקוחות חדשים" value={formatNumber(clientSegments.newClients)} icon={UserPlus} accent="success" />
          <KPICard title="לקוחות חוזרים" value={formatNumber(clientSegments.returning)} icon={Repeat} accent="primary" />
          <KPICard title="לקוחות פעילים" value={formatNumber(clientSegments.active)} icon={Users} accent="primary" />
          <KPICard title="לקוחות שנטשו" value={formatNumber(clientSegments.lost)} icon={UserMinus} accent="warning" />
        </MetricGrid>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DashboardChart
            title="פילוח לקוחות"
            kind="pie"
            data={segmentData}
            xKey="name"
            series={[{ key: "value", name: "לקוחות" }]}
          />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">לקוחות מובילים לפי ערך</CardTitle>
            </CardHeader>
            <CardContent>
              <StatList
                rows={clientRevenue.slice(0, 8).map((c, i) => ({
                  label: `${i + 1}. ${c.client}`,
                  value: <CurrencyValue value={c.total} />,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Value */}
      <section className="space-y-4">
        <SectionHeader title="ערך עסקה ולקוח" icon={Gem} />
        <MetricGrid cols={3}>
          <KPICard title="גודל עסקה ממוצע" value={formatCurrency(deal)} icon={Gem} accent="success" />
          <KPICard title="ערך לקוח ממוצע" value={formatCurrency(avgClientValue, { compact: true })} icon={Wallet} accent="primary" />
          <KPICard title="הכנסה חוזרת חודשית" value={formatCurrency(mrr, { compact: true })} icon={Repeat} accent="success" hint="מלקוחות קבועים" />
        </MetricGrid>
        <Card className={cn("border-primary/30 bg-primary/5")}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {recurring.length} לקוחות קבועים (3+ חודשים) מייצרים את עיקר
              ההכנסה החוזרת. שימור לקוחות אלו הוא מנוע הצמיחה המרכזי של Soline.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
