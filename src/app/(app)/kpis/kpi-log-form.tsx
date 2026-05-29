"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { logKpiValue, type LogKpiState } from "./actions";

const initial: LogKpiState = { error: null, saved: false };

export interface Option {
  id: string;
  label: string;
}

export function KpiLogForm({
  employees,
  kpis,
  defaultStart,
  defaultEnd,
}: {
  employees: Option[];
  kpis: Option[];
  defaultStart: string;
  defaultEnd: string;
}) {
  const t = useTranslations("kpis");
  const [state, formAction, pending] = useActionState(logKpiValue, initial);

  if (kpis.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noKpis")}</p>;
  }

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/40 p-4 md:grid-cols-2"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="user_id">{t("selectEmployee")}</Label>
        <Select id="user_id" name="user_id" required defaultValue="">
          <option value="" disabled>
            {t("selectEmployee")}
          </option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="kpi_id">{t("selectKpi")}</Label>
        <Select id="kpi_id" name="kpi_id" required defaultValue="">
          <option value="" disabled>
            {t("selectKpi")}
          </option>
          {kpis.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="value">{t("value")}</Label>
        <Input id="value" name="value" type="number" step="0.01" dir="ltr" required />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="period_start">{t("periodStart")}</Label>
          <Input
            id="period_start"
            name="period_start"
            type="date"
            dir="ltr"
            defaultValue={defaultStart}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="period_end">{t("periodEnd")}</Label>
          <Input
            id="period_end"
            name="period_end"
            type="date"
            dir="ltr"
            defaultValue={defaultEnd}
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {state.saved ? (
          <span className="text-sm text-green-600">{t("saved")}</span>
        ) : null}
      </div>
    </form>
  );
}
