"use client";

import * as React from "react";
import { Download, FileText, Sheet, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Export menu. CSV export is functional for any array-of-objects passed in;
 * PDF is a placeholder hook (wire to a print/export service later).
 */
export function ExportMenu({
  data,
  filename = "soline-export",
}: {
  data?: Record<string, unknown>[];
  filename?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const exportCsv = () => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers
        .map((h) => {
          const v = row[h];
          const s = v === null || v === undefined ? "" : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csv = "﻿" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
        <Download className="size-4" />
        ייצוא
        <ChevronDown className="size-3" />
      </Button>
      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
          )}
        >
          <button
            onClick={exportCsv}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent"
          >
            <Sheet className="size-4" />
            ייצוא ל-CSV
          </button>
          <button
            onClick={() => {
              window.print();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent"
          >
            <FileText className="size-4" />
            ייצוא ל-PDF
          </button>
        </div>
      )}
    </div>
  );
}
