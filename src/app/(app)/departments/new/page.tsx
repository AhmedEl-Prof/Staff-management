import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getEmployeeOptions } from "@/lib/employee-options";
import { DepartmentForm } from "../department-form";
import { createDepartment } from "../actions";

export default async function NewDepartmentPage() {
  await requireRole(["super_admin"]);
  const t = await getTranslations("departments");
  const employees = await getEmployeeOptions();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("createTitle")}</h1>
      <DepartmentForm action={createDepartment} employees={employees} />
    </div>
  );
}
