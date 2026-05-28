"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  uploadAttachment,
  type UploadState,
} from "../attachments-actions";

const initialState: UploadState = { error: null };

export function AttachmentUpload({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const formRef = useRef<HTMLFormElement | null>(null);
  const [submitCount, setSubmitCount] = useState(0);
  const [state, formAction, pending] = useActionState(
    uploadAttachment,
    initialState,
  );

  // Reset the file input after a successful upload (so the next selection
  // works). Runs whenever a settled submit had no error.
  useEffect(() => {
    if (submitCount === 0 || pending) return;
    if (state.error) return;
    formRef.current?.reset();
  }, [submitCount, pending, state.error]);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        setSubmitCount((n) => n + 1);
        return formAction(fd);
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="task_id" value={taskId} />
      <input
        type="file"
        name="file"
        required
        className="block text-sm file:me-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
      />
      <Button type="submit" disabled={pending} className="gap-2">
        <Upload className="size-4" />
        {pending ? tc("saving") : t("upload")}
      </Button>
      {state.error ? (
        <p className="w-full text-xs text-destructive">
          {state.error === "tooLarge" ? t("fileTooLarge") : t("uploadFailed")}
        </p>
      ) : null}
    </form>
  );
}
