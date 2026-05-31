"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete } from "@/components/confirm-delete";
import type { DepartmentToolRow } from "@/types/database";
import { addTool, updateTool, deleteTool } from "./actions";

// Masked password cell with a show/hide toggle. Read-only display.
function PasswordCell({ value }: { value: string | null }) {
  const [shown, setShown] = useState(false);
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span dir="ltr" className="font-mono text-xs">
        {shown ? value : "••••••••"}
      </span>
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="hover:bg-muted inline-flex size-6 items-center justify-center rounded"
        aria-label={shown ? "hide" : "show"}
      >
        {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </span>
  );
}

// One read-only tool row (members + the default view for managers).
function ReadRow({ tool }: { tool: DepartmentToolRow }) {
  const t = useTranslations("tools");
  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-medium">{tool.name}</td>
      <td className="px-3 py-2">
        {tool.url ? (
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1 hover:underline"
            dir="ltr"
          >
            <ExternalLink className="size-3.5" />
            {t("open")}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2" dir="ltr">
        {tool.username || <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2">
        <PasswordCell value={tool.password} />
      </td>
    </tr>
  );
}

// Editable tool row (managers): an inline form that spans the row.
function EditRow({
  tool,
  departmentId,
}: {
  tool: DepartmentToolRow;
  departmentId: string;
}) {
  const t = useTranslations("tools");
  const tc = useTranslations("common");
  return (
    <tr className="border-t align-top">
      <td className="p-2" colSpan={5}>
        <form
          action={updateTool}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="id" value={tool.id} />
          <input type="hidden" name="department_id" value={departmentId} />
          <Field label={t("name")} name="name" defaultValue={tool.name} required />
          <Field label={t("url")} name="url" type="url" dir="ltr" defaultValue={tool.url ?? ""} />
          <Field label={t("username")} name="username" dir="ltr" defaultValue={tool.username ?? ""} />
          <Field label={t("password")} name="password" dir="ltr" defaultValue={tool.password ?? ""} />
          <Field label={t("notes")} name="notes" defaultValue={tool.notes ?? ""} />
          <Button type="submit" size="sm" variant="secondary">
            {tc("save")}
          </Button>
          <ConfirmDelete
            action={deleteTool}
            hidden={{ id: tool.id, department_id: departmentId }}
            message={t("deleteConfirm")}
            label={tc("remove")}
          />
        </form>
      </td>
    </tr>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <label className="flex min-w-36 flex-1 flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <Input {...props} />
    </label>
  );
}

export function ToolsTable({
  departmentId,
  tools,
  canManage,
}: {
  departmentId: string;
  tools: DepartmentToolRow[];
  canManage: boolean;
}) {
  const t = useTranslations("tools");

  return (
    <div className="flex flex-col gap-3">
      {tools.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            {!canManage ? (
              <thead>
                <tr className="bg-muted/60">
                  <th className="px-3 py-2.5 text-start font-medium">{t("name")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("url")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("username")}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{t("password")}</th>
                </tr>
              </thead>
            ) : null}
            <tbody>
              {tools.map((tool) =>
                canManage ? (
                  <EditRow key={tool.id} tool={tool} departmentId={departmentId} />
                ) : (
                  <ReadRow key={tool.id} tool={tool} />
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        <form
          action={addTool}
          className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/40 p-4"
        >
          <input type="hidden" name="department_id" value={departmentId} />
          <Field label={t("name")} name="name" required />
          <Field label={t("url")} name="url" type="url" dir="ltr" placeholder="https://…" />
          <Field label={t("username")} name="username" dir="ltr" />
          <Field label={t("password")} name="password" dir="ltr" />
          <Field label={t("notes")} name="notes" />
          <Button type="submit" size="sm" className="gap-2">
            <Plus className="size-4" />
            {t("add")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
