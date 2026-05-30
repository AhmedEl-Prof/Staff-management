"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { getCvDownloadUrl } from "./actions";

// Opens the caller's stored CV via a short-lived signed URL (the bucket is
// private). Rendered only when the profile already has a CV.
export function CvDownload() {
  const t = useTranslations("profile");
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      const url = await getCvDownloadUrl();
      if (url) window.open(url, "_blank", "noopener");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline disabled:opacity-50"
    >
      <FileText className="size-4" />
      {t("currentCv")}
    </button>
  );
}
