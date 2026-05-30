"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiState } from "@/lib/ai";

function GenerateButton({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending} className="gap-2">
      <Sparkles className="size-4" />
      {pending ? busy : label}
    </Button>
  );
}

// Reusable "generate with AI" panel: a button that runs a server action and
// renders the returned text (or a localized error). The action does the data
// gathering + the Claude call; this component is presentation only.
export function AiPanel({
  action,
  title,
  cta,
}: {
  action: (prev: AiState, formData: FormData) => Promise<AiState>;
  title: string;
  cta: string;
}) {
  const t = useTranslations("ai");
  const [state, formAction] = useActionState<AiState, FormData>(action, {});

  const errorText =
    state.error === "no_ai"
      ? t("notConfigured")
      : state.error === "no_data"
        ? t("noData")
        : state.error
          ? t("failed")
          : null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <Sparkles className="text-primary size-4" />
          {title}
        </h3>
        <form action={formAction}>
          <GenerateButton label={cta} busy={t("generating")} />
        </form>
      </div>

      {errorText ? (
        <p className="text-muted-foreground text-sm">{errorText}</p>
      ) : null}

      {state.text ? (
        <div className="bg-muted/40 rounded-md border p-3 text-sm leading-7 whitespace-pre-line">
          {state.text}
        </div>
      ) : null}
    </div>
  );
}
