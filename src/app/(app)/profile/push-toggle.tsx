"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { savePushSubscription, deletePushSubscription } from "./push-actions";

// Converts a base64url VAPID key to the BufferSource the Push API expects.
// Returns the backing ArrayBuffer so the type is unambiguously ArrayBuffer.
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

type State = "loading" | "unsupported" | "denied" | "off" | "on" | "busy";

// Initial state computed synchronously (no setState-in-effect): unsupported or
// denied are known up front; otherwise start in "loading" and resolve the
// actual subscription status asynchronously in the effect.
function initialState(): State {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return "loading";
}

// Lets the user enable/disable Web Push on this device. Works against the
// already-registered service worker (sw.js). Hidden by the parent when the
// VAPID public key isn't configured.
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const t = useTranslations("push");
  const [state, setState] = useState<State>(initialState);

  useEffect(() => {
    if (state !== "loading") return;
    let active = true;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (active) setState(sub ? "on" : "off");
      })
      .catch(() => {
        if (active) setState("off");
      });
    return () => {
      active = false;
    };
    // Only runs the one-time resolution while in "loading".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enable = async () => {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(vapidPublicKey),
      });
      const json = sub.toJSON();
      await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      setState("on");
    } catch {
      setState("off");
    }
  };

  const disable = async () => {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  };

  if (state === "loading") return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        {state === "on" ? (
          <Bell className="text-primary size-5" />
        ) : (
          <BellOff className="text-muted-foreground size-5" />
        )}
        <div>
          <p className="text-sm font-medium">{t("title")}</p>
          <p className="text-muted-foreground text-xs">
            {state === "unsupported"
              ? t("unsupported")
              : state === "denied"
                ? t("denied")
                : state === "on"
                  ? t("enabledHint")
                  : t("subtitle")}
          </p>
        </div>
      </div>
      {state === "off" || state === "busy" ? (
        <Button type="button" size="sm" onClick={enable} disabled={state === "busy"}>
          {t("enable")}
        </Button>
      ) : state === "on" ? (
        <Button type="button" size="sm" variant="outline" onClick={disable}>
          {t("disable")}
        </Button>
      ) : null}
    </div>
  );
}
