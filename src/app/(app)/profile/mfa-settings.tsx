"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EnrollData {
  factorId: string;
  qrSvg: string;
  secret: string;
}

// Two-factor authentication (TOTP) enrollment. Uses the browser client: MFA
// enroll/verify are user-session operations by design.
export function MfaSettings() {
  const t = useTranslations("mfa");
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setEnabled(
        (data?.totp ?? []).some((f) => f.status === "verified"),
      );
    });
  }, []);

  function startEnroll() {
    setError(false);
    startTransition(async () => {
      const supabase = createClient();
      // Clear any unverified leftovers from an abandoned attempt.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) {
        if (f.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error: err } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (err || !data) {
        setError(true);
        return;
      }
      setEnroll({
        factorId: data.id,
        qrSvg: data.totp.qr_code,
        secret: data.totp.secret,
      });
    });
  }

  function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    setError(false);
    startTransition(async () => {
      const supabase = createClient();
      const { data: challenge, error: chErr } =
        await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
      if (chErr || !challenge) {
        setError(true);
        return;
      }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) {
        setError(true);
        return;
      }
      setEnroll(null);
      setCode("");
      setEnabled(true);
      router.refresh();
    });
  }

  function disable() {
    startTransition(async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      for (const f of data?.totp ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      setEnabled(false);
      router.refresh();
    });
  }

  if (enabled === null) return null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5" />
          {t("settingsTitle")}
        </h2>
        {enabled ? (
          <span className="text-sm font-medium text-green-600">
            {t("enabled")}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t("settingsSubtitle")}</p>

      {!enabled && !enroll ? (
        <div>
          <Button type="button" onClick={startEnroll} disabled={pending}>
            {t("enable")}
          </Button>
        </div>
      ) : null}

      {enroll ? (
        <form onSubmit={confirmEnroll} className="flex max-w-md flex-col gap-4">
          <p className="text-sm">{t("scanQr")}</p>
          <div className="self-center rounded-lg border bg-white p-3">
            {/* The QR SVG comes from Supabase Auth itself, as a data image —
                next/image can't optimize inline SVGs, so a plain img is right. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(enroll.qrSvg)}`}
              alt="QR"
              width={176}
              height={176}
            />
          </div>
          <p className="text-muted-foreground break-all text-center text-xs" dir="ltr">
            {enroll.secret}
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mfa_code">{t("codeLabel")}</Label>
            <Input
              id="mfa_code"
              inputMode="numeric"
              dir="ltr"
              placeholder="123456"
              minLength={6}
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="text-center font-mono tracking-widest"
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive">{t("invalidCode")}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={pending || code.trim().length !== 6}
            >
              {pending ? t("verifying") : t("confirm")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEnroll(null)}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : null}

      {enabled ? (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={disable}
            disabled={pending}
            className="gap-2"
          >
            <ShieldOff className="size-4" />
            {t("disable")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
