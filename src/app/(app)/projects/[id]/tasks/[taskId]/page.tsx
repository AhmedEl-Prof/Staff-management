import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Pencil, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProjectContext } from "@/lib/project-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CommentForm, type Mentionable } from "./comment-form";
import { DependencyPicker, type TaskOption } from "./dependency-picker";
import { AttachmentUpload } from "./attachment-upload";
import { AttachmentDownload } from "./attachment-download";
import { TaskRealtime } from "./realtime";
import { createSubtask, deleteComment, removeDependency } from "../relations-actions";
import { deleteAttachment } from "../attachments-actions";
import { updateTaskStatus } from "../actions";
import type {
  TaskRow,
  TaskCommentRow,
  TaskAttachmentRow,
  TaskStatus,
} from "@/types/database";

const STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
  "cancelled",
];

// Derives a stable @-handle from a person's name. Latin letters/digits are
// kept; everything else (including Arabic) is replaced with a short id-prefix
// so mentions still work but the typed token is reliable.
function handleFor(profile: { id: string; arabic_name: string | null; full_name: string | null }) {
  const base = (profile.full_name || profile.arabic_name || "").trim();
  const latin = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  return latin || `user${profile.id.slice(0, 8)}`;
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  const { profile } = await requireUser();
  const t = await getTranslations("tasks");
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("taskStatus");
  const tPriority = await getTranslations("priority");

  const ctx = await getProjectContext(id, profile);
  if (!ctx) notFound();

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("project_id", id)
    .single();
  if (!task) notFound();

  // Subtasks
  const { data: subtaskRows } = await supabase
    .from("tasks")
    .select("*")
    .eq("parent_task_id", taskId)
    .order("created_at", { ascending: true });
  const subtasks = (subtaskRows ?? []) as TaskRow[];

  // Dependencies (this task depends on these tasks)
  const { data: depRows } = await supabase
    .from("task_dependencies")
    .select("id, depends_on_task_id")
    .eq("task_id", taskId);
  const deps = depRows ?? [];

  // Sibling tasks usable as dependencies: same project, exclude self + already
  // linked + tasks that already depend on this one (avoids the simple cycle).
  const { data: siblings } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("project_id", id)
    .neq("id", taskId)
    .is("parent_task_id", null);

  const { data: backRefs } = await supabase
    .from("task_dependencies")
    .select("task_id")
    .eq("depends_on_task_id", taskId);
  const wouldCycle = new Set((backRefs ?? []).map((r) => r.task_id));
  const linked = new Set(deps.map((d) => d.depends_on_task_id));
  const depOptions: TaskOption[] = (siblings ?? [])
    .filter((s) => !linked.has(s.id) && !wouldCycle.has(s.id))
    .map((s) => ({ id: s.id, title: s.title }));

  const depTitleById = new Map(
    (siblings ?? []).map((s) => [s.id, s.title] as const),
  );

  // Comments
  const { data: commentRows } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  const comments = (commentRows ?? []) as TaskCommentRow[];

  // Attachments
  const { data: attachmentRows } = await supabase
    .from("task_attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  const attachments = (attachmentRows ?? []) as TaskAttachmentRow[];

  // Profiles for assignee + commenters + mentionables
  const admin = createAdminClient();
  const peopleIds = new Set<string>();
  if (task.assigned_to) peopleIds.add(task.assigned_to);
  comments.forEach((c) => c.user_id && peopleIds.add(c.user_id));
  attachments.forEach((a) => a.uploaded_by && peopleIds.add(a.uploaded_by));
  ctx.assignees.forEach((a) => peopleIds.add(a.id));

  let people: Array<{ id: string; arabic_name: string | null; full_name: string | null }> = [];
  if (peopleIds.size) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, arabic_name, full_name")
      .in("id", [...peopleIds]);
    people = profiles ?? [];
  }
  const nameById = new Map(
    people.map((p) => [p.id, p.arabic_name || p.full_name || p.id] as const),
  );

  // Mentionables = project members (assignees we loaded in ctx)
  const mentionables: Mentionable[] = ctx.assignees
    .map((a) => {
      const person = people.find((p) => p.id === a.id);
      if (!person) return null;
      return {
        id: a.id,
        handle: handleFor(person),
        label: a.label,
      } satisfies Mentionable;
    })
    .filter((m): m is Mentionable => m !== null);

  const canEdit = ctx.canManage || task.assigned_to === profile.id;
  const canDelete = ctx.canManage;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Link
            href={`/projects/${id}/tasks`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
          >
            <ArrowRight className="size-3.5" />
            {t("backToTasks")}
          </Link>
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{tStatus(task.status)}</Badge>
            <Badge variant="outline">{tPriority(task.priority)}</Badge>
            {task.due_date ? (
              <span className="text-xs text-muted-foreground" dir="ltr">
                {t("dueOn")}: {task.due_date}
              </span>
            ) : null}
            {task.assigned_to ? (
              <span className="text-xs text-muted-foreground">
                {nameById.get(task.assigned_to) ?? ""}
              </span>
            ) : null}
          </div>
        </div>

        {canEdit ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${id}/tasks/${taskId}/edit`}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "gap-2",
              })}
            >
              <Pencil className="size-4" />
              {tc("edit")}
            </Link>
            {canDelete ? (
              <form action={updateTaskStatus} className="contents">
                {/* Inline quick-action lives in the edit form; kept simple here. */}
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {task.description ? (
        <p className="whitespace-pre-wrap rounded-lg border bg-card p-4 text-sm">
          {task.description}
        </p>
      ) : null}

      {/* Subtasks */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("subtasks")}</h2>

        {subtasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noTasks")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {subtasks.map((st) => (
              <li
                key={st.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <SubtaskStatusToggle
                    projectId={id}
                    taskId={st.id}
                    status={st.status}
                    canEdit={canEdit}
                  />
                  <Link
                    href={`/projects/${id}/tasks/${st.id}`}
                    className="font-medium hover:underline"
                  >
                    {st.title}
                  </Link>
                </div>
                <Badge variant="muted">{tStatus(st.status)}</Badge>
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <form
            action={createSubtask}
            className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/40 p-4"
          >
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="parent_task_id" value={taskId} />
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <Label htmlFor="title">{t("subtaskTitle")}</Label>
              <Input id="title" name="title" required />
            </div>
            <Button type="submit" className="gap-2">
              <Plus className="size-4" />
              {t("addSubtask")}
            </Button>
          </form>
        ) : null}
      </section>

      {/* Dependencies */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("dependencies")}</h2>
        <p className="text-xs text-muted-foreground">{t("dependenciesHint")}</p>

        {deps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noDependencies")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {deps.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <Link
                  href={`/projects/${id}/tasks/${d.depends_on_task_id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {depTitleById.get(d.depends_on_task_id) ?? d.depends_on_task_id}
                </Link>
                {canEdit ? (
                  <ConfirmDelete
                    action={removeDependency}
                    hidden={{ id: d.id, project_id: id, task_id: taskId }}
                    message={tc("delete")}
                    label={tc("remove")}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <DependencyPicker
            projectId={id}
            taskId={taskId}
            options={depOptions}
          />
        ) : null}
      </section>

      {/* Attachments */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("attachments")}</h2>

        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noAttachments")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {attachments.map((a) => {
              const isOwn = a.uploaded_by === profile.id;
              const uploader = a.uploaded_by
                ? nameById.get(a.uploaded_by)
                : null;
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <AttachmentDownload
                      attachmentId={a.id}
                      fileName={a.file_name}
                    />
                    <span className="text-xs text-muted-foreground">
                      {uploader ?? ""}
                      {a.file_size
                        ? ` · ${formatBytes(a.file_size)}`
                        : ""}
                    </span>
                  </div>
                  {isOwn || ctx.canManage ? (
                    <ConfirmDelete
                      action={deleteAttachment}
                      hidden={{
                        id: a.id,
                        project_id: id,
                        task_id: taskId,
                      }}
                      message={t("deleteAttachment")}
                      label={tc("remove")}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <AttachmentUpload projectId={id} taskId={taskId} />
      </section>

      {/* Comments */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("comments")}</h2>

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noComments")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((c) => {
              const author = c.user_id ? nameById.get(c.user_id) : null;
              const isOwn = c.user_id === profile.id;
              return (
                <li key={c.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {isOwn ? t("you") : (author ?? "—")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                      {isOwn || ctx.canManage ? (
                        <ConfirmDelete
                          action={deleteComment}
                          hidden={{
                            id: c.id,
                            project_id: id,
                            task_id: taskId,
                          }}
                          message={t("deleteComment")}
                          label={tc("remove")}
                        />
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{c.content}</p>
                </li>
              );
            })}
          </ul>
        )}

        <CommentForm
          projectId={id}
          taskId={taskId}
          mentionables={mentionables}
        />
      </section>

      <TaskRealtime taskId={taskId} />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// -----------------------------------------------------------------------------

function SubtaskStatusToggle({
  projectId,
  taskId,
  status,
  canEdit,
}: {
  projectId: string;
  taskId: string;
  status: TaskStatus;
  canEdit: boolean;
}) {
  const next: TaskStatus = status === "done" ? "todo" : "done";
  if (!canEdit) {
    return (
      <input
        type="checkbox"
        readOnly
        checked={status === "done"}
        className="size-4 accent-primary"
      />
    );
  }
  return (
    <form action={updateTaskStatus}>
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="id" value={taskId} />
      <input type="hidden" name="status" value={next} />
      <button
        type="submit"
        className="flex size-4 items-center justify-center rounded border bg-background hover:bg-muted"
        aria-label={STATUSES.includes(next) ? next : "toggle"}
      >
        {status === "done" ? "✓" : ""}
      </button>
    </form>
  );
}
