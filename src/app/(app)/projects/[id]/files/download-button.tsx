"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { getDownloadUrl } from "./actions";

// Fetches a fresh signed URL on click, then opens it. We don't pre-render the
// URL because it expires shortly after issue.
export function DownloadButton({
  projectId,
  path,
  name,
}: {
  projectId: string;
  path: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const url = await getDownloadUrl(projectId, path, name);
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        })
      }
      className="inline-flex items-center gap-1 text-sm text-primary hover:underline disabled:opacity-50"
      aria-label={`download ${name}`}
    >
      <Download className="size-4" />
    </button>
  );
}
