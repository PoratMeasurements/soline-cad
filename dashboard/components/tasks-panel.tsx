"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  done: boolean;
}

export function TasksPanel({ initial }: { initial: Task[] }) {
  const [tasks, setTasks] = React.useState(initial);
  const toggle = (id: string) =>
    setTasks((t) =>
      t.map((x) => (x.id === id ? { ...x, done: !x.done } : x))
    );

  return (
    <ul className="space-y-1">
      {tasks.map((t) => (
        <li key={t.id}>
          <button
            onClick={() => toggle(t.id)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-right transition-colors hover:bg-accent"
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                t.done
                  ? "border-success bg-success text-success-foreground"
                  : "border-input"
              )}
            >
              {t.done && <Check className="size-3.5" />}
            </span>
            <span
              className={cn(
                "text-sm",
                t.done && "text-muted-foreground line-through"
              )}
            >
              {t.title}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
