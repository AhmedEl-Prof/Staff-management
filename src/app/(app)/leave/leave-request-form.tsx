"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { countLeaveDays, LEAVE_TYPES } from "@/lib/leave";
import { createLeaveRequest } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {label}
    </Button>
  );
}

export function LeaveRequestForm() {
  const t = useTranslations("leave");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const days = countLeaveDays(start, end);

  return (
    <form
      action={createLeaveRequest}
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">{t("type")}</Label>
          <Select id="type" name="type" defaultValue="annual">
            {LEAVE_TYPES.map((lt) => (
              <option key={lt} value={lt}>
                {t(`type_${lt}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="start_date">{t("from")}</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            dir="ltr"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="end_date">{t("to")}</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            dir="ltr"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reason">{t("reason")}</Label>
        <Textarea id="reason" name="reason" rows={2} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {t("workingDays")}: <span className="text-foreground font-semibold">{days}</span>
        </p>
        <SubmitButton label={t("submitRequest")} />
      </div>
    </form>
  );
}
