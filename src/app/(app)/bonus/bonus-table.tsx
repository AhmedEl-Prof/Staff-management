"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDelete } from "@/components/confirm-delete";
import type { BonusItemRow } from "@/types/database";
import { addBonusItem, updateBonusItem, deleteBonusItem } from "./actions";

// Shared column widths so the header and every editable row line up. Order
// follows the document (RTL): item · weight · max · method · actions.
const MANAGE_COLS =
  "minmax(140px,1.2fr) 96px 120px minmax(200px,1.8fr) auto auto";

function formatWeight(value: number | null, suffix: string) {
  return value == null ? "—" : `${value}${suffix}`;
}

function formatAmount(value: number | null, suffix: string) {
  return value == null ? "—" : `${value} ${suffix}`;
}

export function BonusTable({
  departmentId,
  items,
  canManage,
}: {
  departmentId: string;
  items: BonusItemRow[];
  canManage: boolean;
}) {
  const t = useTranslations("bonus");
  const tc = useTranslations("common");

  // -- Read-only view (department members) -----------------------------------
  if (!canManage) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">{t("readonlyNote")}</p>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary hover:bg-primary">
                  <TableHead className="text-primary-foreground">
                    {t("item")}
                  </TableHead>
                  <TableHead className="text-primary-foreground">
                    {t("weight")}
                  </TableHead>
                  <TableHead className="text-primary-foreground">
                    {t("max")}
                  </TableHead>
                  <TableHead className="text-primary-foreground">
                    {t("method")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.item}</TableCell>
                    <TableCell>
                      {formatWeight(it.weight_percent, "%")}
                    </TableCell>
                    <TableCell>
                      {formatAmount(it.max_amount, t("egp"))}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-pre-line">
                      {it.method}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  // -- Editable view (department manager / super admin) ----------------------
  // Each row is a `form` with `display: contents` so its inputs become grid
  // cells aligned with the header; the delete control is a sibling grid cell.
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <div className="min-w-[760px]">
          {/* Header */}
          <div
            className="bg-primary text-primary-foreground grid items-center text-sm font-medium"
            style={{ gridTemplateColumns: MANAGE_COLS }}
          >
            <div className="px-3 py-2.5">{t("item")}</div>
            <div className="px-3 py-2.5">{t("weight")}</div>
            <div className="px-3 py-2.5">{t("max")}</div>
            <div className="px-3 py-2.5">{t("method")}</div>
            <div className="col-span-2 px-3 py-2.5">{t("actions")}</div>
          </div>

          {/* Existing rows */}
          {items.map((it) => (
            <div
              key={it.id}
              className="grid items-start border-t"
              style={{ gridTemplateColumns: MANAGE_COLS }}
            >
              <form
                action={updateBonusItem}
                className="contents"
                id={`bonus-${it.id}`}
              >
                <input type="hidden" name="id" value={it.id} />
                <input type="hidden" name="department_id" value={departmentId} />
                <div className="p-2">
                  <Input
                    name="item"
                    defaultValue={it.item}
                    required
                    aria-label={t("item")}
                  />
                </div>
                <div className="p-2">
                  <Input
                    name="weight_percent"
                    type="number"
                    step="any"
                    min="0"
                    dir="ltr"
                    defaultValue={it.weight_percent ?? ""}
                    aria-label={t("weight")}
                  />
                </div>
                <div className="p-2">
                  <Input
                    name="max_amount"
                    type="number"
                    step="any"
                    min="0"
                    dir="ltr"
                    defaultValue={it.max_amount ?? ""}
                    aria-label={t("max")}
                  />
                </div>
                <div className="p-2">
                  <Textarea
                    name="method"
                    rows={2}
                    defaultValue={it.method ?? ""}
                    aria-label={t("method")}
                  />
                </div>
                <div className="p-2">
                  <Button type="submit" size="sm" variant="secondary">
                    {tc("save")}
                  </Button>
                </div>
              </form>
              <div className="p-2">
                <ConfirmDelete
                  action={deleteBonusItem}
                  hidden={{ id: it.id, department_id: departmentId }}
                  message={t("deleteConfirm")}
                  label={tc("delete")}
                />
              </div>
            </div>
          ))}

          {items.length === 0 ? (
            <p className="text-muted-foreground border-t p-4 text-sm">
              {t("empty")}
            </p>
          ) : null}

          {/* Add row */}
          <form
            action={addBonusItem}
            className="grid items-start border-t bg-muted/40"
            style={{ gridTemplateColumns: MANAGE_COLS }}
          >
            <input type="hidden" name="department_id" value={departmentId} />
            <div className="p-2">
              <Input name="item" required placeholder={t("item")} aria-label={t("item")} />
            </div>
            <div className="p-2">
              <Input
                name="weight_percent"
                type="number"
                step="any"
                min="0"
                dir="ltr"
                placeholder="%"
                aria-label={t("weight")}
              />
            </div>
            <div className="p-2">
              <Input
                name="max_amount"
                type="number"
                step="any"
                min="0"
                dir="ltr"
                placeholder={t("egp")}
                aria-label={t("max")}
              />
            </div>
            <div className="p-2">
              <Textarea
                name="method"
                rows={2}
                placeholder={t("method")}
                aria-label={t("method")}
              />
            </div>
            <div className="col-span-2 p-2">
              <Button type="submit" size="sm" className="gap-2">
                <Plus className="size-4" />
                {t("add")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
