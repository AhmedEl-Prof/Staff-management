"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { submitStandup, type StandupState } from "./actions";
import type { StandupMood, StandupResponseRow } from "@/types/database";

const MOODS: StandupMood[] = ["great", "good", "okay", "stressed", "blocked"];

const initial: StandupState = { submitted: false };

export function StandupForm({ existing }: { existing: StandupResponseRow | null }) {
  const t = useTranslations("standup");
  const [state, formAction, pending] = useActionState(submitStandup, initial);

  const justSubmitted = state.submitted;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="yesterday_work">{t("yesterday")}</Label>
        <Textarea
          id="yesterday_work"
          name="yesterday_work"
          placeholder={t("yesterdayPlaceholder")}
          defaultValue={existing?.yesterday_work ?? ""}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="today_plan">{t("today")}</Label>
        <Textarea
          id="today_plan"
          name="today_plan"
          placeholder={t("todayPlaceholder")}
          defaultValue={existing?.today_plan ?? ""}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="blockers">{t("blockers")}</Label>
        <Textarea
          id="blockers"
          name="blockers"
          placeholder={t("blockersPlaceholder")}
          defaultValue={existing?.blockers ?? ""}
          rows={2}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="mood">{t("mood")}</Label>
        <Select
          id="mood"
          name="mood"
          defaultValue={existing?.mood ?? "good"}
          className="max-w-48"
        >
          {MOODS.map((m) => (
            <option key={m} value={m}>
              {t(`mood${m.charAt(0).toUpperCase()}${m.slice(1)}`)}
            </option>
          ))}
        </Select>
      </div>

      {justSubmitted ? (
        <p className="text-sm text-green-600">{t("submitted")}</p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {existing ? t("edit") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
