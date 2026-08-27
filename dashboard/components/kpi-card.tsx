import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TrendBadge } from "@/components/trend-badge";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  icon?: LucideIcon;
  change?: number;
  invertTrend?: boolean;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "destructive";
  className?: string;
}

const accentRing: Record<NonNullable<KPICardProps["accent"]>, string> = {
  primary: "from-primary/15",
  success: "from-success/15",
  warning: "from-warning/20",
  destructive: "from-destructive/15",
};

const accentIcon: Record<NonNullable<KPICardProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
  destructive: "bg-destructive/15 text-destructive",
};

export function KPICard({
  title,
  value,
  icon: Icon,
  change,
  invertTrend,
  hint,
  accent = "primary",
  className,
}: KPICardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-5",
        "bg-gradient-to-bl to-transparent",
        accentRing[accent],
        "hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums lg:text-3xl">
            {value}
          </p>
        </div>
        {Icon && (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              accentIcon[accent]
            )}
          >
            <Icon className="size-5" />
          </div>
        )}
      </div>
      {(change !== undefined || hint) && (
        <div className="mt-3 flex items-center gap-2">
          {change !== undefined && (
            <TrendBadge value={change} invert={invertTrend} />
          )}
          {hint && (
            <span className="truncate text-xs text-muted-foreground">
              {hint}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
