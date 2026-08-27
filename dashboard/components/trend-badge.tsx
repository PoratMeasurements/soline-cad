import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

interface TrendBadgeProps {
  value: number; // percentage change
  // if true, a negative change is "good" (e.g. errors, expenses)
  invert?: boolean;
  className?: string;
  suffix?: string;
}

export function TrendBadge({
  value,
  invert = false,
  className,
  suffix = "",
}: TrendBadgeProps) {
  const neutral = Math.abs(value) < 0.05;
  const positive = invert ? value < 0 : value > 0;
  const Icon = neutral ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
        neutral
          ? "bg-muted text-muted-foreground"
          : positive
            ? "bg-success/15 text-success"
            : "bg-destructive/15 text-destructive",
        className
      )}
      aria-label={`שינוי ${formatPercent(value)}`}
    >
      <Icon className="size-3" />
      {neutral ? "0%" : formatPercent(Math.abs(value))}
      {suffix}
    </span>
  );
}
