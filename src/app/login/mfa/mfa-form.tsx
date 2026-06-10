"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MfaForm() {
  const t = useTranslations("mfa");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    startTransition(async () => {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (!totp) {
        router.push(redirectTo.startsWith("/") ? redirectTo : "/");
        return;
      }
      const { data: challenge, error: chErr } =
        await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (chErr || !challenge) {
        setError(true);
        return;
      }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: totp.id,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) {
        setError(true);
        return;
      }
      router.push(redirectTo.startsWith("/") ? redirectTo : "/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">{t("codeLabel")}</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          placeholder="123456"
          minLength={6}
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          autoFocus
          className="text-center font-mono text-lg tracking-widest"
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive">{t("invalidCode")}</p>
      ) : null}

      <Button type="submit" disabled={pending || code.trim().length !== 6}>
        {pending ? t("verifying") : t("verify")}
      </Button>
    </form>
  );
}
