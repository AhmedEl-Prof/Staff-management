"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, FolderPlus, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  createDriveFolderForProject,
  syncDriveFolderMembers,
  type DriveActionResult,
} from "./drive-actions";

const ERR_KEYS: Record<NonNullable<DriveActionResult["error"]>, string> = {
  notConnected: "errNotConnected",
  notAllowed: "errNotConnected",
  alreadyExists: "errAlreadyExists",
  driveFailed: "errDriveFailed",
};

export function ProjectDriveSection({
  projectId,
  folderId,
  folderUrl,
  canManage,
}: {
  projectId: string;
  folderId: string | null;
  folderUrl: string | null;
  canManage: boolean;
}) {
  const t = useTranslations("drive");
  const [pending, startTransition] = useTransition();

  function run(
    action: (fd: FormData) => Promise<DriveActionResult>,
    onError: (key: string) => void,
    onSuccess: () => void,
  ) {
    const fd = new FormData();
    fd.set("project_id", projectId);
    startTransition(async () => {
      const result = await action(fd);
      if (!result.ok && result.error) {
        onError(ERR_KEYS[result.error]);
      } else if (result.ok) {
        onSuccess();
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("projectFolder")}</h2>

        <div className="flex items-center gap-2">
          {folderId && folderUrl ? (
            <a
              href={folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "gap-2",
              })}
            >
              <ExternalLink className="size-4" />
              {t("openFolder")}
            </a>
          ) : null}

          {canManage && !folderId ? (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  createDriveFolderForProject,
                  (k) => alert(t(k)),
                  () => alert(t("folderCreated")),
                )
              }
              className="gap-2"
            >
              <FolderPlus className="size-4" />
              {t("createFolder")}
            </Button>
          ) : null}

          {canManage && folderId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  syncDriveFolderMembers,
                  (k) => alert(t(k)),
                  () => alert(t("membersSynced")),
                )
              }
              className="gap-2"
            >
              <RefreshCw className="size-4" />
              {t("syncMembers")}
            </Button>
          ) : null}
        </div>
      </div>

      {!folderId ? (
        <p className="text-sm text-muted-foreground">
          {canManage ? t("subtitle") : t("notConnected")}
        </p>
      ) : null}
    </section>
  );
}
