"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Cell = string | number | null | undefined;

// Escapes one CSV field per RFC 4180: wrap in quotes and double any quotes.
function escapeCell(value: Cell): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// "Download CSV" button. Takes a fully-serializable header row + data matrix
// (so it can be rendered directly from a server component) and builds the file
// in the browser. A UTF-8 BOM is prepended so Excel opens Arabic correctly.
export function CsvExportButton({
  headers,
  rows,
  filename,
}: {
  headers: string[];
  rows: Cell[][];
  filename: string;
}) {
  const t = useTranslations("common");

  const download = () => {
    const lines = [
      headers.map(escapeCell).join(","),
      ...rows.map((row) => row.map(escapeCell).join(",")),
    ];
    const blob = new Blob(["﻿" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={download}
      disabled={rows.length === 0}
      className="gap-2 print:hidden"
    >
      <Download className="size-4" />
      {t("exportCsv")}
    </Button>
  );
}
