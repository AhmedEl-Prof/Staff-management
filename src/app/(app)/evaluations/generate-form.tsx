"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { generateEvaluation } from "./actions";

export interface Option {
  id: string;
  label: string;
}

export function GenerateForm({ employees }: { employees: Option[] }) {
  const t = useTranslations("evaluations");

  return (
    <form
      action={generateEvaluation}
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
        <Label htmlFor="period_type">{t("periodType")}</Label>
        <Select id="period_type" name="period_type" defaultValue="monthly">
          <option value="monthly">{t("monthly")}</option>
          <option value="weekly">{t("weekly")}</option>
        </Select>
      </div>

      <div className="flex flex-col gap-2 md:col-span-2">
        <Label htmlFor="notes">{t("notes")}</Label>
        <Textarea id="notes" name="notes" placeholder={t("notesPlaceholder")} rows={2} />
      </div>

      <div className="md:col-span-2">
        <Button type="submit">{t("generate")}</Button>
      </div>
    </form>
  );
}
