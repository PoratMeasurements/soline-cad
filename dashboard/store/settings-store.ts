"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DateRange = "3m" | "6m" | "12m" | "ytd";

export interface CompanySettings {
  companyName: string;
  vatNumber: string;
  fiscalYearStart: string; // month label, e.g. "אוגוסט"
  currency: "ILS" | "USD" | "EUR";
  corporateTaxRate: number; // %
  vatRate: number; // %
}

export interface KpiTargets {
  monthlyRevenue: number;
  operatingMargin: number; // %
  measurementsPerMonth: number;
  maxErrorsPerMonth: number;
}

export interface NotificationThresholds {
  minRunwayMonths: number;
  maxClientConcentration: number; // %
  minCashBalance: number;
}

interface SettingsState {
  company: CompanySettings;
  targets: KpiTargets;
  thresholds: NotificationThresholds;
  dateRange: DateRange;
  setCompany: (c: Partial<CompanySettings>) => void;
  setTargets: (t: Partial<KpiTargets>) => void;
  setThresholds: (t: Partial<NotificationThresholds>) => void;
  setDateRange: (r: DateRange) => void;
  reset: () => void;
}

const defaults = {
  company: {
    companyName: "Soline – מדידות לייזר",
    vatNumber: "516000000",
    fiscalYearStart: "אוגוסט",
    currency: "ILS" as const,
    corporateTaxRate: 23,
    vatRate: 18,
  },
  targets: {
    monthlyRevenue: 45000,
    operatingMargin: 60,
    measurementsPerMonth: 55,
    maxErrorsPerMonth: 3,
  },
  thresholds: {
    minRunwayMonths: 6,
    maxClientConcentration: 20,
    minCashBalance: 25000,
  },
  dateRange: "12m" as DateRange,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setCompany: (c) =>
        set((s) => ({ company: { ...s.company, ...c } })),
      setTargets: (t) => set((s) => ({ targets: { ...s.targets, ...t } })),
      setThresholds: (t) =>
        set((s) => ({ thresholds: { ...s.thresholds, ...t } })),
      setDateRange: (dateRange) => set({ dateRange }),
      reset: () => set({ ...defaults }),
    }),
    { name: "soline-settings" }
  )
);
