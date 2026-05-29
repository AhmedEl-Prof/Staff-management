import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Folder, FileText, FolderPlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getProjectContext } from "@/lib/project-context";
import { listProjectFiles, sanitizePath } from "@/lib/project-files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete } from "@/components/confirm-delete";
import { UploadForm } from "./upload-form";
import { DownloadButton } from "./download-button";
import { newFolder, deleteEntry } from "./actions";

function formatBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function ProjectFilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ path?: string }>;
}) {
  const { id } = await params;
  const { path: rawPath } = await searchParams;
  const { profile } = await requireUser();
  const t = await getTranslations("files");
  const tc = await getTranslations("common");

  const ctx = await getProjectContext(id, profile);
  if (!ctx) notFound();

  const path = sanitizePath(rawPath ?? "");
  const { folders, files } = await listProjectFiles(id, path);

  // Breadcrumb segments.
  const segments = path ? path.split("/") : [];
  const crumbHref = (upto: number) =>
    `/projects/${id}/files?path=${encodeURIComponent(segments.slice(0, upto + 1).join("/"))}`;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowRight className="size-3.5" />
          {t("backToProject")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <Link
          href={`/projects/${id}/files`}
          className={path ? "text-primary hover:underline" : "font-medium"}
        >
          {t("root")}
        </Link>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-muted-foreground">/</span>
            <Link
              href={crumbHref(i)}
              className={
                i === segments.length - 1
                  ? "font-medium"
                  : "text-primary hover:underline"
              }
            >
              {seg}
            </Link>
          </span>
        ))}
      </div>

      {/* Toolbar: upload + new folder */}
      <div className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-4">
        <UploadForm projectId={id} path={path} />
        <form
          action={newFolder}
          className="flex flex-wrap items-center gap-2 border-t pt-3"
        >
          <input type="hidden" name="project_id" value={id} />
          <input type="hidden" name="path" value={path} />
          <Input
            name="folder_name"
            placeholder={t("folderName")}
            required
            className="h-9 w-48"
          />
          <Button type="submit" variant="outline" size="sm" className="gap-2">
            <FolderPlus className="size-4" />
            {t("newFolder")}
          </Button>
        </form>
      </div>

      {/* Listing */}
      {folders.length === 0 && files.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {folders.map((name) => (
            <li
              key={`d-${name}`}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <Link
                href={`/projects/${id}/files?path=${encodeURIComponent(path ? `${path}/${name}` : name)}`}
                className="flex items-center gap-2 font-medium hover:underline"
              >
                <Folder className="size-4 text-yellow-500" />
                {name}
              </Link>
              <ConfirmDelete
                action={deleteEntry}
                hidden={{ project_id: id, path, name, kind: "folder" }}
                message={t("deleteFolderConfirm")}
                label={tc("delete")}
              />
            </li>
          ))}
          {files.map((f) => (
            <li
              key={`f-${f.name}`}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                <span className="font-medium">{f.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(f.size)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <DownloadButton projectId={id} path={path} name={f.name} />
                <ConfirmDelete
                  action={deleteEntry}
                  hidden={{ project_id: id, path, name: f.name, kind: "file" }}
                  message={t("deleteFileConfirm")}
                  label={tc("delete")}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
