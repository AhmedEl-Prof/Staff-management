"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/select";
import { setEmployeeSeniority } from "./actions";
import type { SeniorityLevel } from "@/types/database";

const LEVELS: SeniorityLevel[] = ["senior", "junior", "trainee"];

// Inline seniority picker on an employee row. Saves on change (no submit
// button) and shows a pending state while in flight.
export function SenioritySelect({
  userId,
  value,
}: {
  userId: string;
  value: SeniorityLevel | null;
}) {
  const t = useTranslations("seniority");
  const tc = useTranslations("common");
  const [pending, startTransition] = useTransition();

  return (
    <Select
      defaultValue={value ?? ""}
      disabled={pending}
      className="h-8 w-32 text-xs"
      onChange={(e) => {
        const v = e.target.value;
        startTransition(() => {
          const fd = new FormData();
          fd.set("user_id", userId);
          fd.set("seniority", v);
          void setEmployeeSeniority(fd);
        });
      }}
    >
      <option value="">{tc("none")}</option>
      {LEVELS.map((s) => (
        <option key={s} value={s}>
          {t(s)}
        </option>
      ))}
    </Select>
  );
}
