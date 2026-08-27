import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/format";

export function CurrencyValue({
  value,
  compact = false,
  decimals = 0,
  className,
}: {
  value: number;
  compact?: boolean;
  decimals?: number;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      {formatCurrency(value, { compact, decimals })}
    </span>
  );
}

export function PercentValue({
  value,
  decimals = 1,
  colorize = false,
  className,
}: {
  value: number;
  decimals?: number;
  colorize?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        colorize && (value >= 0 ? "text-success" : "text-destructive"),
        className
      )}
    >
      {formatPercent(value, decimals)}
    </span>
  );
}
