"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Settings,
  Building2,
  Target,
  BellRing,
  Save,
  RotateCcw,
  Check,
} from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/store/settings-store";

const companySchema = z.object({
  companyName: z.string().min(2, "שם קצר מדי"),
  vatNumber: z.string().min(8, "מספר עוסק לא תקין"),
  fiscalYearStart: z.string().min(1),
  currency: z.enum(["ILS", "USD", "EUR"]),
  corporateTaxRate: z.coerce.number().min(0).max(50),
  vatRate: z.coerce.number().min(0).max(30),
});

const targetsSchema = z.object({
  monthlyRevenue: z.coerce.number().min(0),
  operatingMargin: z.coerce.number().min(0).max(100),
  measurementsPerMonth: z.coerce.number().min(0),
  maxErrorsPerMonth: z.coerce.number().min(0),
});

const thresholdsSchema = z.object({
  minRunwayMonths: z.coerce.number().min(0),
  maxClientConcentration: z.coerce.number().min(0).max(100),
  minCashBalance: z.coerce.number().min(0),
});

function useSavedFlag() {
  const [saved, setSaved] = React.useState(false);
  const flag = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return [saved, flag] as const;
}

const MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export default function SettingsPage() {
  const { company, targets, thresholds, setCompany, setTargets, setThresholds, reset } =
    useSettings();

  return (
    <div className="space-y-8">
      <SectionHeader
        title="הגדרות"
        description="פרטי חברה, יעדי KPI וספי התראה"
        icon={Settings}
        action={
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="size-4" />
            איפוס לברירת מחדל
          </Button>
        }
      />

      <CompanyForm company={company} onSave={setCompany} months={MONTHS} />
      <TargetsForm targets={targets} onSave={setTargets} />
      <ThresholdsForm thresholds={thresholds} onSave={setThresholds} />
    </div>
  );
}

function SaveButton({ saved }: { saved: boolean }) {
  return (
    <Button type="submit" size="sm">
      {saved ? <Check className="size-4" /> : <Save className="size-4" />}
      {saved ? "נשמר" : "שמירה"}
    </Button>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function CompanyForm({
  company,
  onSave,
  months,
}: {
  company: ReturnType<typeof useSettings.getState>["company"];
  onSave: (c: Partial<typeof company>) => void;
  months: string[];
}) {
  const [saved, flag] = useSavedFlag();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: company });

  const onSubmit = handleSubmit((data) => {
    const parsed = companySchema.safeParse(data);
    if (!parsed.success) return;
    onSave(parsed.data);
    flag();
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          <div>
            <CardTitle className="text-base">פרטי חברה</CardTitle>
            <CardDescription>מידע כללי, מע״מ ומיסוי</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="שם החברה" error={errors.companyName?.message}>
              <Input {...register("companyName")} />
            </Field>
            <Field label="מספר עוסק / ח״פ" error={errors.vatNumber?.message}>
              <Input {...register("vatNumber")} />
            </Field>
            <Field label="תחילת שנת כספים">
              <Select {...register("fiscalYearStart")}>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="מטבע">
              <Select {...register("currency")}>
                <option value="ILS">₪ שקל</option>
                <option value="USD">$ דולר</option>
                <option value="EUR">€ אירו</option>
              </Select>
            </Field>
            <Field label="שיעור מס חברות (%)" error={errors.corporateTaxRate?.message}>
              <Input type="number" step="0.1" {...register("corporateTaxRate")} />
            </Field>
            <Field label="שיעור מע״מ (%)" error={errors.vatRate?.message}>
              <Input type="number" step="0.1" {...register("vatRate")} />
            </Field>
          </div>
          <SaveButton saved={saved} />
        </form>
      </CardContent>
    </Card>
  );
}

function TargetsForm({
  targets,
  onSave,
}: {
  targets: ReturnType<typeof useSettings.getState>["targets"];
  onSave: (t: Partial<typeof targets>) => void;
}) {
  const [saved, flag] = useSavedFlag();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: targets });

  const onSubmit = handleSubmit((data) => {
    const parsed = targetsSchema.safeParse(data);
    if (!parsed.success) return;
    onSave(parsed.data);
    flag();
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Target className="size-5 text-primary" />
        <div>
          <CardTitle className="text-base">יעדי KPI</CardTitle>
          <CardDescription>יעדים חודשיים למעקב ביצועים</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field label="יעד מחזור חודשי (₪)" error={errors.monthlyRevenue?.message}>
              <Input type="number" {...register("monthlyRevenue")} />
            </Field>
            <Field label="יעד מרווח תפעולי (%)" error={errors.operatingMargin?.message}>
              <Input type="number" step="0.1" {...register("operatingMargin")} />
            </Field>
            <Field label="יעד מדידות בחודש" error={errors.measurementsPerMonth?.message}>
              <Input type="number" {...register("measurementsPerMonth")} />
            </Field>
            <Field label="מקס׳ טעויות בחודש" error={errors.maxErrorsPerMonth?.message}>
              <Input type="number" {...register("maxErrorsPerMonth")} />
            </Field>
          </div>
          <SaveButton saved={saved} />
        </form>
      </CardContent>
    </Card>
  );
}

function ThresholdsForm({
  thresholds,
  onSave,
}: {
  thresholds: ReturnType<typeof useSettings.getState>["thresholds"];
  onSave: (t: Partial<typeof thresholds>) => void;
}) {
  const [saved, flag] = useSavedFlag();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: thresholds });

  const onSubmit = handleSubmit((data) => {
    const parsed = thresholdsSchema.safeParse(data);
    if (!parsed.success) return;
    onSave(parsed.data);
    flag();
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <BellRing className="size-5 text-primary" />
        <div>
          <CardTitle className="text-base">ספי התראה</CardTitle>
          <CardDescription>מתי המערכת תתריע על סיכון</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="מסלול מזומנים מינימלי (חודשים)" error={errors.minRunwayMonths?.message}>
              <Input type="number" step="0.5" {...register("minRunwayMonths")} />
            </Field>
            <Field label="מקס׳ ריכוזיות לקוח (%)" error={errors.maxClientConcentration?.message}>
              <Input type="number" {...register("maxClientConcentration")} />
            </Field>
            <Field label="יתרת מזומנים מינימלית (₪)" error={errors.minCashBalance?.message}>
              <Input type="number" {...register("minCashBalance")} />
            </Field>
          </div>
          <SaveButton saved={saved} />
        </form>
      </CardContent>
    </Card>
  );
}
