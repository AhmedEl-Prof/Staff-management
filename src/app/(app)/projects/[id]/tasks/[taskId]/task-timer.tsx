"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startTimer, stopTimer } from "@/app/(app)/timesheet/timer-actions";

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Start/Stop timer for a task. `startedAt` is set when the caller's running
// timer belongs to THIS task; `otherRunning` when it belongs to another task
// (starting here stops & logs that one first — the server enforces it).
export function TaskTimer({
  taskId,
  startedAt,
  otherRunning,
}: {
  taskId: string;
  startedAt: string | null;
  otherRunning: boolean;
}) {
  const t = useTranslations("timesheet");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  const running = Boolean(startedAt);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  function onStart() {
    const fd = new FormData();
    fd.set("task_id", taskId);
    startTransition(async () => {
      await startTimer(fd);
      router.refresh();
    });
  }

  function onStop() {
    startTransition(async () => {
      await stopTimer();
      router.refresh();
    });
  }

  if (running && startedAt) {
    return (
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={onStop}
        className="gap-2"
      >
        <Square className="size-4" />
        {t("timerStop")}
        <span dir="ltr" className="font-mono text-xs tabular-nums">
          {formatElapsed(now - new Date(startedAt).getTime())}
        </span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={onStart}
      title={otherRunning ? t("timerOtherRunning") : undefined}
      className="gap-2"
    >
      <Play className="size-4" />
      {t("timerStart")}
    </Button>
  );
}
