"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// Triggers the browser print dialog. Combined with a print-optimized layout +
// @media print CSS, "Save as PDF" produces a correct Arabic RTL PDF (the
// browser handles letter-shaping that @react-pdf cannot).
export function PrintButton() {
  const t = useTranslations("report");
  return (
    <Button
      type="button"
      onClick={() => window.print()}
      className="gap-2 print:hidden"
    >
      <Printer className="size-4" />
      {t("print")}
    </Button>
  );
}
