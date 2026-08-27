"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type ChartKind = "area" | "line" | "bar" | "pie";

export interface Series {
  key: string;
  name: string;
  color?: string; // css var token name from CHART_COLORS or raw hsl
}

const CHART_COLORS = [
  "hsl(221 83% 60%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 55%)",
  "hsl(280 65% 60%)",
  "hsl(0 72% 58%)",
  "hsl(190 80% 45%)",
];

function formatAxis(v: number) {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return `${v}`;
}

interface DashboardChartProps {
  title?: string;
  description?: string;
  kind: ChartKind;
  data: Record<string, unknown>[];
  xKey?: string;
  series: Series[];
  height?: number;
  action?: React.ReactNode;
  stacked?: boolean;
  valueFormatter?: (v: number) => string;
  className?: string;
}

export function DashboardChart({
  title,
  description,
  kind,
  data,
  xKey = "label",
  series,
  height = 280,
  action,
  stacked = false,
  valueFormatter,
  className,
}: DashboardChartProps) {
  const gridColor = "hsl(var(--border))";
  const axisColor = "hsl(var(--muted-foreground))";

  const tooltipStyle = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.75rem",
    color: "hsl(var(--popover-foreground))",
    fontSize: 12,
  } as React.CSSProperties;

  const color = (s: Series, i: number) => s.color ?? CHART_COLORS[i % CHART_COLORS.length];

  const body = (
    <ResponsiveContainer width="100%" height={height}>
      {kind === "area" ? (
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient
                key={s.key}
                id={`grad-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color(s, i)} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color(s, i)} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey={xKey} stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} reversed />
          <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatAxis} orientation="right" width={44} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => (valueFormatter ? valueFormatter(v) : v)} />
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={color(s, i)}
              strokeWidth={2.5}
              fill={`url(#grad-${s.key})`}
              stackId={stacked ? "1" : undefined}
            />
          ))}
        </AreaChart>
      ) : kind === "line" ? (
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey={xKey} stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} reversed />
          <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatAxis} orientation="right" width={44} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => (valueFormatter ? valueFormatter(v) : v)} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={color(s, i)}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      ) : kind === "bar" ? (
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey={xKey} stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} reversed />
          <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatAxis} orientation="right" width={44} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} formatter={(v: number) => (valueFormatter ? valueFormatter(v) : v)} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={color(s, i)}
              radius={[6, 6, 0, 0]}
              stackId={stacked ? "1" : undefined}
            />
          ))}
        </BarChart>
      ) : (
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => (valueFormatter ? valueFormatter(v) : v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Pie
            data={data}
            dataKey={series[0].key}
            nameKey={xKey}
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      )}
    </ResponsiveContainer>
  );

  if (!title) return <div dir="rtl" className={className}>{body}</div>;

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="pt-2">{body}</CardContent>
    </Card>
  );
}
