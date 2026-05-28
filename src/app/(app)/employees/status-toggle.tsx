"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { setEmployeeActive } from "./actions";

// Activate / deactivate toggle for an employee row. Submits the server action
// and shows a pending state while the request is in flight.
export function EmployeeStatusToggle({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const t = useTranslations("employees");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={isActive ? "outline" : "secondary"}
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          const fd = new FormData();
          fd.set("user_id", userId);
          fd.set("is_active", String(!isActive));
          void setEmployeeActive(fd);
        })
      }
    >
      {isActive ? t("deactivate") : t("activate")}
    </Button>
  );
}
