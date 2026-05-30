"use client";

import { useTranslations } from "next-intl";
import { Plus, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDelete } from "@/components/confirm-delete";
import type { ProjectChecklistItemRow } from "@/types/database";
import {
  addChecklistItem,
  updateChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  applyTemplate,
} from "./checklist-actions";

// Per-project checklist. Every project member sees the list and can tick an
// item done (a tiny auto-submitting form per checkbox). Managers additionally
// get inline edit fields + an "add row" form, mirroring the bonus table.
export function ProjectChecklist({
  projectId,
  items,
  employees,
  canManage,
}: {
  projectId: string;
  items: ProjectChecklistItemRow[];
  employees: { id: string; label: string }[];
  canManage: boolean;
}) {
  const t = useTranslations("checklist");
  const tc = useTranslations("common");
  const nameById = new Map(employees.map((e) => [e.id, e.label]));
  const doneCount = items.filter((i) => i.done).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <div className="flex items-center gap-3">
          {items.length > 0 ? (
            <span className="text-muted-foreground text-sm">
              {doneCount}/{items.length} {t("done")}
            </span>
          ) : null}
          {canManage ? (
            <form action={applyTemplate}>
              <input type="hidden" name="project_id" value={projectId} />
              <Button type="submit" size="sm" variant="outline" className="gap-2">
                <ListPlus className="size-4" />
                {t("applyTemplate")}
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-md border p-3"
            >
              {/* Done toggle — any member can submit this */}
              <form action={toggleChecklistItem} className="pt-0.5">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="project_id" value={projectId} />
                <input type="hidden" name="done" value={(!item.done).toString()} />
                <button
                  type="submit"
                  aria-label={t("toggle")}
                  className={[
                    "flex size-5 items-center justify-center rounded border",
                    item.done
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-input",
                  ].join(" ")}
                >
                  {item.done ? "✓" : ""}
                </button>
              </form>

              {canManage ? (
                // Manager: inline-editable row
                <form
                  action={updateChecklistItem}
                  className="flex flex-1 flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="project_id" value={projectId} />
                  <Input
                    name="label"
                    defaultValue={item.label}
                    required
                    className="min-w-40 flex-1"
                    aria-label={t("item")}
                  />
                  <Select
                    name="assigned_to"
                    defaultValue={item.assigned_to ?? ""}
                    className="w-44"
                    aria-label={t("assignee")}
                  >
                    <option value="">{t("unassigned")}</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    name="notes"
                    defaultValue={item.notes ?? ""}
                    placeholder={t("notes")}
                    className="min-w-32 flex-1"
                    aria-label={t("notes")}
                  />
                  <Button type="submit" size="sm" variant="secondary">
                    {tc("save")}
                  </Button>
                </form>
              ) : (
                // Member: read-only view
                <div className="flex flex-1 flex-col">
                  <span
                    className={
                      item.done ? "text-muted-foreground line-through" : "font-medium"
                    }
                  >
                    {item.label}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {item.assigned_to
                      ? nameById.get(item.assigned_to) ?? ""
                      : t("unassigned")}
                    {item.notes ? ` — ${item.notes}` : ""}
                  </span>
                </div>
              )}

              {canManage ? (
                <ConfirmDelete
                  action={deleteChecklistItem}
                  hidden={{ id: item.id, project_id: projectId }}
                  message={t("deleteConfirm")}
                  label={tc("remove")}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {canManage ? (
        <form
          action={addChecklistItem}
          className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/40 p-4"
        >
          <input type="hidden" name="project_id" value={projectId} />
          <Input
            name="label"
            required
            placeholder={t("item")}
            className="min-w-40 flex-1"
            aria-label={t("item")}
          />
          <Select name="assigned_to" defaultValue="" className="w-44" aria-label={t("assignee")}>
            <option value="">{t("unassigned")}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </Select>
          <Input
            name="notes"
            placeholder={t("notes")}
            className="min-w-32 flex-1"
            aria-label={t("notes")}
          />
          <Button type="submit" size="sm" className="gap-2">
            <Plus className="size-4" />
            {t("add")}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
