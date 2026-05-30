"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeAmount } from "@/lib/bonus-awards";
import { saveBonusAwards } from "./award-actions";
import type { BonusItemRow } from "@/types/database";

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="mt-2">
      {label}
    </Button>
  );
}

// Editable bonus sheet for one employee + month. The manager types an
// achievement % per item; earned amounts and the total update live, then a
// single submit saves the whole sheet.
export function AwardEditor({
  departmentId,
  userId,
  month,
  items,
  initial,
}: {
  departmentId: string;
  userId: string;
  month: string;
  items: BonusItemRow[];
  initial: Record<string, number>;
}) {
  const t = useTranslations("bonus");
  const tc = useTranslations("common");
  const [values, setValues] = useState<Record<string, number>>(initial);

  const total = items.reduce(
    (sum, it) => sum + computeAmount(values[it.id] ?? 0, it.max_amount),
    0,
  );

  return (
    <form action={saveBonusAwards} className="flex flex-col gap-3">
      <input type="hidden" name="department_id" value={departmentId} />
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="month" value={month} />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-start">
              <th className="px-3 py-2.5 text-start font-medium">{t("item")}</th>
              <th className="px-3 py-2.5 text-start font-medium">{t("max")}</th>
              <th className="px-3 py-2.5 text-start font-medium">
                {t("achievement")}
              </th>
              <th className="px-3 py-2.5 text-start font-medium">
                {t("earned")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const pct = values[it.id] ?? 0;
              const amount = computeAmount(pct, it.max_amount);
              return (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{it.item}</td>
                  <td className="text-muted-foreground px-3 py-2">
                    {it.max_amount == null ? "—" : `${it.max_amount} ${t("egp")}`}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Input
                        name={`ach_${it.id}`}
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        dir="ltr"
                        className="w-24"
                        value={Number.isFinite(pct) ? pct : 0}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            [it.id]: Number(e.target.value),
                          }))
                        }
                        aria-label={t("achievement")}
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-semibold">
                    {amount} {t("egp")}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 border-t">
              <td className="px-3 py-2.5 font-bold" colSpan={3}>
                {t("total")}
              </td>
              <td className="px-3 py-2.5 font-bold">
                {total} {t("egp")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div>
        <SaveButton label={tc("save")} />
      </div>
    </form>
  );
}
