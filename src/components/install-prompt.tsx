"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// The `beforeinstallprompt` event isn't in the standard lib DOM types yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Remember a dismissal so we don't nag on every page load.
const DISMISS_KEY = "pwa-install-dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes standalone on navigator instead of via media query.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

const noopSubscribe = () => () => {};

// Reads a browser-only flag in an SSR-safe way: the server snapshot is always
// false (so the banner never renders during SSR / first hydration), then React
// swaps in the real client value without a hydration mismatch.
function useClientFlag(read: () => boolean) {
  return useSyncExternalStore(noopSubscribe, read, () => false);
}

// Shows a dismissible "install the app" banner.
//
// Modern Chrome/Edge no longer pop up an automatic install banner — they fire
// `beforeinstallprompt`, which we capture here and surface as our own button.
// iOS Safari never fires that event, so for iOS we show manual instructions
// (Share → Add to Home Screen) instead.
export function InstallPrompt() {
  const t = useTranslations("pwa");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [dismissed, setDismissed] = useState(false);

  // Client-only detection — false on the server, real value after hydration.
  const installed = useClientFlag(isStandalone);
  const iosEligible = useClientFlag(
    () =>
      isIos() &&
      !isStandalone() &&
      typeof localStorage !== "undefined" &&
      !localStorage.getItem(DISMISS_KEY),
  );

  useEffect(() => {
    // Only Chromium fires this; iOS handles install via manual instructions.
    const onPrompt = (event: Event) => {
      // Prevent the mini-infobar (where browsers still show one) so we control
      // the UI, then stash the event to trigger from our button.
      event.preventDefault();
      if (localStorage.getItem(DISMISS_KEY)) return;
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDeferred(null);
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // The event can only be used once, whatever the outcome.
    setDeferred(null);
  };

  if (installed || dismissed) return null;
  const showIos = iosEligible && !deferred;
  if (!deferred && !showIos) return null;

  return (
    <div
      role="dialog"
      aria-label={showIos ? t("iosTitle") : t("installTitle")}
      className="fixed inset-x-0 bottom-0 z-[60] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] print:hidden"
    >
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-lg border bg-card p-4 shadow-lg">
        <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-md">
          {showIos ? (
            <Share className="size-5" />
          ) : (
            <Download className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {showIos ? t("iosTitle") : t("installTitle")}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {showIos ? t("iosBody") : t("installBody")}
          </p>
          {!showIos ? (
            <Button
              type="button"
              size="sm"
              onClick={install}
              className="mt-3 gap-2"
            >
              <Download className="size-4" />
              {t("install")}
            </Button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="hover:bg-muted -me-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
