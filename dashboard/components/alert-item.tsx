import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Alert } from "@/lib/data";

const CONFIG = {
  danger: {
    icon: ShieldAlert,
    wrap: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  warning: {
    icon: AlertTriangle,
    wrap: "bg-warning/15 text-warning",
    dot: "bg-warning",
  },
  info: { icon: Info, wrap: "bg-primary/10 text-primary", dot: "bg-primary" },
  success: {
    icon: CheckCircle2,
    wrap: "bg-success/15 text-success",
    dot: "bg-success",
  },
} as const;

export function AlertItem({ alert }: { alert: Alert }) {
  const c = CONFIG[alert.severity];
  const Icon = c.icon;
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          c.wrap
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{alert.title}</p>
        <p className="text-xs text-muted-foreground">{alert.detail}</p>
      </div>
    </div>
  );
}
