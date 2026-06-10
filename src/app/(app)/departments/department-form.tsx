"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DepartmentRow } from "@/types/database";

export interface EmployeeOption {
  id: string;
  label: string;
}

export function DepartmentForm({
  action,
  department,
  employees,
}: {
  action: (formData: FormData) => void | Promise<void>;
  department?: DepartmentRow;
  employees: EmployeeOption[];
}) {
  const t = useTranslations("departments");
  const tc = useTranslations("common");

  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      {department ? (
        <input type="hidden" name="id" value={department.id} />
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name_ar">{t("nameAr")}</Label>
        <Input id="name_ar" name="name_ar" defaultValue={department?.name_ar ?? ""} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" dir="ltr" defaultValue={department?.name ?? ""} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={department?.description ?? ""}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="color">{t("color")}</Label>
          <Input
            id="color"
            name="color"
            dir="ltr"
            placeholder="#3b82f6"
            defaultValue={department?.color ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="icon">{t("icon")}</Label>
          <Input
            id="icon"
            name="icon"
            dir="ltr"
            placeholder="search"
            defaultValue={department?.icon ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="manager_id">{t("manager")}</Label>
        <Select
          id="manager_id"
          name="manager_id"
          defaultValue={department?.manager_id ?? ""}
        >
          <option value="">{t("noManager")}</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit">{tc("save")}</Button>
        <Link
          href="/departments"
          className={buttonVariants({ variant: "ghost" })}
        >
          {tc("cancel")}
        </Link>
      </div>
    </form>
  );
}
