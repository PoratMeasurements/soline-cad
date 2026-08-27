"use client";

import {
  Activity,
  Ruler,
  Timer,
  Car,
  PenTool,
  RefreshCw,
  Phone,
  Route,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  MapPin,
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
import { Progress } from "@/components/ui/progress";
import {
  monthlyOps,
  opsMonthsWithData,
  opsAverages,
  totals,
} from "@/lib/data";
import { formatDuration, formatKm, formatNumber } from "@/lib/format";
import { firstPassRate } from "@/lib/calculations";

export default function OperationsPage() {
  const opsSeries = opsMonthsWithData.map((m) => ({
    label: m.label,
    measured: m.measured,
    avgMeasure: Math.round(m.avgMeasureTime),
    avgTravel: Math.round(m.avgTravelTime),
    avgKm: Math.round(m.avgKm),
  }));

  // Quality — SEEDED (no error log in source data)
  const errors = 2;
  const revisits = 3;
  const revisions = 7;
  const errorCost = 1850;
  const fpr = firstPassRate(totals.measurements - errors, totals.measurements);

  const heatmapMonths = opsMonthsWithData;

  return (
    <div className="space-y-8">
      <SectionHeader
        title="תפעול"
        description="מדידות, זמנים, יעילות ואיכות בשטח"
        icon={Activity}
        action={<ExportMenu data={opsSeries} filename="soline-operations" />}
      />

      {/* Measurements */}
      <section className="space-y-4">
        <SectionHeader title="מדידות" icon={Ruler} />
        <MetricGrid cols={4}>
          <KPICard title="סה״כ מדידות" value={formatNumber(totals.measurements)} icon={Ruler} accent="primary" />
          <KPICard title="ממוצע חודשי" value={formatNumber(totals.measurements / opsMonthsWithData.length)} icon={Ruler} accent="primary" />
          <KPICard
            title="מדידות בשבוע"
            value={formatNumber(totals.measurements / (opsMonthsWithData.length * 4.3))}
            icon={Ruler}
            accent="primary"
          />
          <KPICard title="סה״כ עבודות" value={formatNumber(totals.jobs)} icon={Activity} accent="success" />
        </MetricGrid>
        <DashboardChart
          title="מדידות לפי חודש"
          kind="bar"
          data={opsSeries}
          series={[{ key: "measured", name: "מדידות" }]}
        />
      </section>

      {/* Time */}
      <section className="space-y-4">
        <SectionHeader title="זמנים" icon={Timer} />
        <MetricGrid cols={4}>
          <KPICard title="זמן מדידה ממוצע" value={formatDuration(opsAverages.avgMeasureTime)} icon={Timer} accent="warning" />
          <KPICard title="זמן נסיעה ממוצע" value={formatDuration(opsAverages.avgTravelTime)} icon={Car} accent="warning" />
          <KPICard title="זמן שרטוט ממוצע" value={formatDuration(75)} icon={PenTool} accent="warning" hint="הערכה" />
          <KPICard title="זמן טיפול בלקוח" value={formatDuration(28)} icon={Phone} accent="warning" hint="הערכה" />
        </MetricGrid>
        <DashboardChart
          title="זמן מדידה מול זמן נסיעה"
          description="דקות בממוצע לחודש"
          kind="line"
          data={opsSeries}
          series={[
            { key: "avgMeasure", name: "מדידה", color: "hsl(221 83% 60%)" },
            { key: "avgTravel", name: "נסיעה", color: "hsl(38 92% 55%)" },
          ]}
          valueFormatter={(v) => `${v} ד׳`}
        />
      </section>

      {/* Efficiency */}
      <section className="space-y-4">
        <SectionHeader title="יעילות" icon={Gauge} />
        <MetricGrid cols={4}>
          <KPICard title="ק״מ למדידה" value={formatKm(opsAverages.avgKm)} icon={Route} accent="primary" />
          <KPICard
            title="שעות למדידה"
            value={`${((opsAverages.avgMeasureTime + opsAverages.avgTravelTime) / 60).toFixed(1)} ש׳`}
            icon={Gauge}
            accent="primary"
            hint="כולל נסיעה"
          />
          <KPICard title="ליד עד מדידה" value={`${4} ימים`} icon={Timer} accent="success" hint="הערכה" />
          <KPICard title="מדידה עד מסירה" value={`${3} ימים`} icon={Timer} accent="success" hint="הערכה" />
        </MetricGrid>
        <DashboardChart
          title="ק״מ ממוצע למדידה לפי חודש"
          kind="area"
          data={opsSeries}
          series={[{ key: "avgKm", name: "ק״מ", color: "hsl(190 80% 45%)" }]}
          valueFormatter={(v) => `${v} ק״מ`}
        />
      </section>

      {/* Quality */}
      <section className="space-y-4">
        <SectionHeader title="איכות" icon={CheckCircle2} />
        <MetricGrid cols={4}>
          <KPICard title="טעויות מדידה" value={formatNumber(errors)} icon={AlertTriangle} accent={errors > 3 ? "destructive" : "success"} hint="הערכה" />
          <KPICard title="חזרות לאתר" value={formatNumber(revisits)} icon={MapPin} accent="warning" hint="הערכה" />
          <KPICard title="תיקוני שרטוט" value={formatNumber(revisions)} icon={RefreshCw} accent="warning" hint="הערכה" />
          <KPICard title="עלות טעויות" value={`${formatNumber(errorCost)} ₪`} icon={AlertTriangle} accent="destructive" hint="הערכה" />
        </MetricGrid>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">שיעור הצלחה מהמדידה הראשונה</CardTitle>
              <CardDescription>First-Pass Success Rate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-4xl font-bold text-success">
                {fpr.toFixed(1)}%
              </p>
              <Progress value={fpr} indicatorClassName="bg-success" />
              <p className="text-xs text-muted-foreground">
                יעד: 97% · מבוסס על {formatNumber(totals.measurements)} מדידות
              </p>
            </CardContent>
          </Card>

          {/* Quality heatmap placeholder — activity intensity by month */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">מפת עומס תפעולי</CardTitle>
              <CardDescription>עצימות פעילות לפי חודש (placeholder)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {heatmapMonths.map((m) => {
                  const max = Math.max(...heatmapMonths.map((x) => x.measured));
                  const intensity = max ? m.measured / max : 0;
                  return (
                    <div
                      key={m.month}
                      className="flex flex-col items-center gap-1"
                    >
                      <div
                        className="flex size-16 items-center justify-center rounded-xl text-sm font-bold"
                        style={{
                          backgroundColor: `hsl(221 83% 55% / ${0.15 + intensity * 0.7})`,
                          color: intensity > 0.5 ? "white" : undefined,
                        }}
                        title={`${m.measured} מדידות`}
                      >
                        {m.measured}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {m.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">סיכום תפעולי חודשי</CardTitle>
          </CardHeader>
          <CardContent>
            <StatList
              rows={opsMonthsWithData.map((m) => ({
                label: m.month,
                hint: `${m.measured} מדידות · ${formatKm(m.avgKm)} ממוצע`,
                value: formatDuration(m.avgMeasureTime),
              }))}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
