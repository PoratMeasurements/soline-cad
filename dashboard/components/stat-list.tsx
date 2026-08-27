import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatRow {
  label: string;
  value: React.ReactNode;
  hint?: string;
  emphasis?: boolean;
}

export function StatList({
  rows,
  className,
}: {
  rows: StatRow[];
  className?: string;
}) {
  return (
    <div className={cn("divide-y", className)}>
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 py-2.5"
        >
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-sm",
                r.emphasis ? "font-semibold" : "text-muted-foreground"
              )}
            >
              {r.label}
            </p>
            {r.hint && (
              <p className="text-xs text-muted-foreground/70">{r.hint}</p>
            )}
          </div>
          <div
            className={cn(
              "shrink-0 tabular-nums",
              r.emphasis ? "text-base font-bold" : "text-sm font-medium"
            )}
          >
            {r.value}
          </div>
        </div>
      ))}
    </div>
  );
}
