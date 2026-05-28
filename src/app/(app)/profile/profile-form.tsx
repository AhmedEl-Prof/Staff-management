"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateProfile, type ProfileState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfileRow } from "@/types/database";

const initialState: ProfileState = { error: null, success: false };

export function ProfileForm({ profile }: { profile: ProfileRow }) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const tEmp = useTranslations("employment");
  const tRoles = useTranslations("roles");
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState,
  );

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="arabic_name">{t("arabicName")}</Label>
        <Input
          id="arabic_name"
          name="arabic_name"
          defaultValue={profile.arabic_name ?? ""}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">{t("fullName")}</Label>
        <Input
          id="full_name"
          name="full_name"
          dir="ltr"
          defaultValue={profile.full_name ?? ""}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">{t("phone")}</Label>
        <Input
          id="phone"
          name="phone"
          dir="ltr"
          defaultValue={profile.phone ?? ""}
        />
      </div>

      {/* Read-only fields managed by an administrator */}
      <div className="grid grid-cols-2 gap-4 rounded-md border bg-muted/40 p-4 text-sm">
        <div>
          <p className="text-muted-foreground">{t("role")}</p>
          <p className="font-medium">{tRoles(profile.role)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("employmentType")}</p>
          <p className="font-medium">{tEmp(profile.employment_type)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("weeklyHours")}</p>
          <p className="font-medium">{profile.weekly_hours}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("hireDate")}</p>
          <p className="font-medium">{profile.hire_date ?? "—"}</p>
        </div>
      </div>

      {state.success ? (
        <p className="text-sm text-green-600">{t("saved")}</p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? tc("saving") : tc("save")}
      </Button>
    </form>
  );
}
