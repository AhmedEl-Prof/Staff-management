"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { getAttachmentDownloadUrl } from "../attachments-actions";

// Click handler that asks the server for a fresh signed URL and then opens it.
// We don't render the URL into the DOM ahead of time because it would expire
// silently while the page is open.
export function AttachmentDownload({
  attachmentId,
  fileName,
}: {
  attachmentId: string;
  fileName: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const url = await getAttachmentDownloadUrl(attachmentId);
          if (!url) return;
          window.open(url, "_blank", "noopener,noreferrer");
        })
      }
      className="inline-flex items-center gap-2 text-sm font-medium hover:underline disabled:opacity-50"
      aria-label={`download ${fileName}`}
    >
      <Download className="size-4" />
      {fileName}
    </button>
  );
}
