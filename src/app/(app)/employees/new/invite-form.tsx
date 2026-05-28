"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { inviteEmployee, type InviteState } from "../actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AppRole, EmploymentType } from "@/types/database";

const initialState: InviteState = { error: null, success: false };

const EMPLOYMENT_TYPES: EmploymentType[] = [
  "full_time",
  "part_time",
  "freelance",
];

export interface DepartmentOption {
  id: string;
  label: string;
}

export function InviteForm({
  roleOptions,
  departments,
}: {
  roleOptions: AppRole[];
  departments: DepartmentOption[];
}) {
  const t = useTranslations("employees");
  const tc = useTranslations("common");
  const tRoles = useTranslations("roles");
  const tEmp = useTranslations("employment");
  const tp = useTranslations("profile");
  const tAuth = useTranslations("auth");
  const [state, formAction, pending] = useActionState(
    inviteEmployee,
    initialState,
  );

  if (state.success) {
    return (
      <div className="flex max-w-lg flex-col gap-4 rounded-lg border bg-card p-6">
        <p className="text-green-600">{t("inviteSent")}</p>
        <Link
          href="/employees"
          className={buttonVariants({
            variant: "outline",
            className: "self-start",
          })}
        >
          {tc("back")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="arabic_name">{t("nameAr")}</Label>
        <Input id="arabic_name" name="arabic_name" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">{t("nameEn")}</Label>
        <Input id="full_name" name="full_name" dir="ltr" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{tAuth("email")}</Label>
        <Input id="email" name="email" type="email" dir="ltr" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="role">{t("role")}</Label>
          <Select
            id="role"
            name="role"
            defaultValue={roleOptions[roleOptions.length - 1]}
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {tRoles(r)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="employment_type">{tp("employmentType")}</Label>
          <Select
            id="employment_type"
            name="employment_type"
            defaultValue="full_time"
          >
            {EMPLOYMENT_TYPES.map((e) => (
              <option key={e} value={e}>
                {tEmp(e)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="department_id">{t("department")}</Label>
          <Select id="department_id" name="department_id" defaultValue="">
            <option value="">{t("noDepartment")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="weekly_hours">{tp("weeklyHours")}</Label>
          <Input
            id="weekly_hours"
            name="weekly_hours"
            type="number"
            min={0}
            max={168}
            defaultValue={40}
            dir="ltr"
          />
        </div>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">
          {state.error === "emailExists"
            ? t("emailExists")
            : state.error === "notAllowed"
              ? t("notAllowed")
              : t("inviteSubtitle")}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tc("saving") : t("sendInvite")}
        </Button>
        <Link
          href="/employees"
          className={buttonVariants({ variant: "ghost" })}
        >
          {tc("cancel")}
        </Link>
      </div>
    </form>
  );
}
