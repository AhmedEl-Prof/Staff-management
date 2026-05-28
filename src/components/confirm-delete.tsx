"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Submits a delete server action after a native confirm() prompt. `hidden`
// supplies the form fields the action expects (e.g. { id }).
export function ConfirmDelete({
  action,
  hidden,
  message,
  label,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  message: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <DeleteButton label={label} />
    </form>
  );
}

function DeleteButton({ label }: { label?: string }) {
  const tc = useTranslations("common");
  return (
    <Button type="submit" variant="outline" size="sm" className="gap-2 text-destructive">
      <Trash2 className="size-4" />
      {label ?? tc("delete")}
    </Button>
  );
}
