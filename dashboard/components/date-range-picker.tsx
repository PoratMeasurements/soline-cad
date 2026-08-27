"use client";

import { Calendar } from "lucide-react";
import { useSettings, type DateRange } from "@/store/settings-store";
import { Select } from "@/components/ui/select";

const OPTIONS: { value: DateRange; label: string }[] = [
  { value: "3m", label: "3 חודשים אחרונים" },
  { value: "6m", label: "6 חודשים אחרונים" },
  { value: "12m", label: "12 חודשים אחרונים" },
  { value: "ytd", label: "מתחילת השנה" },
];

export function DateRangePicker() {
  const { dateRange, setDateRange } = useSettings();
  return (
    <div className="flex items-center gap-2">
      <Calendar className="size-4 text-muted-foreground" />
      <Select
        aria-label="בחירת טווח תאריכים"
        value={dateRange}
        onChange={(e) => setDateRange(e.target.value as DateRange)}
        className="w-48"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
