"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete } from "@/components/confirm-delete";
import type { ChecklistTemplateRow } from "@/types/database";
import {
  addTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
} from "./actions";

// Editable list of template items for one department. Managers edit inline;
// members see read-only rows. New projects in the department inherit these.
export function TemplateTable({
  departmentId,
  items,
  canManage,
}: {
  departmentId: string;
  items: ChecklistTemplateRow[];
  canManage: boolean;
}) {
  const t = useTranslations("checklistTemplates");
  const tc = useTranslations("common");

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              <span className="text-muted-foreground w-6 text-sm">{i + 1}.</span>
              {canManage ? (
                <form
                  action={updateTemplateItem}
                  className="flex flex-1 items-center gap-2"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="department_id" value={departmentId} />
                  <Input
                    name="label"
                    defaultValue={item.label}
                    required
                    className="flex-1"
                    aria-label={t("item")}
                  />
                  <Button type="submit" size="sm" variant="secondary">
                    {tc("save")}
                  </Button>
                </form>
              ) : (
                <span className="flex-1 font-medium">{item.label}</span>
              )}
              {canManage ? (
                <ConfirmDelete
                  action={deleteTemplateItem}
                  hidden={{ id: item.id, department_id: departmentId }}
                  message={t("deleteConfirm")}
                  label={tc("remove")}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form
          action={addTemplateItem}
          className="flex items-end gap-2 rounded-md border bg-muted/40 p-4"
        >
          <input type="hidden" name="department_id" value={departmentId} />
          <Input
            name="label"
            required
            placeholder={t("item")}
            className="flex-1"
            aria-label={t("item")}
          />
          <Button type="submit" size="sm" className="gap-2">
            <Plus className="size-4" />
            {t("add")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
