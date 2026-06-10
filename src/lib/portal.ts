import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PriorityLevel,
  ProjectStatus,
  TaskStatus,
} from "@/types/database";

// Data exposed on the public client portal page. Deliberately client-safe:
// no assignee names, no internal comments, no hours — only the project's
// outward-facing progress.
export interface PortalData {
  projectName: string;
  clientName: string | null;
  clientLabel: string | null;
  description: string | null;
  status: ProjectStatus;
  priority: PriorityLevel;
  startDate: string | null;
  endDate: string | null;
  taskCounts: Record<"total" | "done" | "in_progress" | "review", number>;
  progressPct: number;
  milestones: { label: string; done: boolean }[];
  recentDeliverables: { title: string; completedAt: string | null }[];
}

// Resolves a portal token to client-safe project data, or null when the token
// is unknown or revoked. Uses the admin client: the page is public (no
// session), and the token — generated with 192 bits of entropy — is the
// credential. is_active is the kill switch a manager flips to revoke access.
export async function getPortalData(token: string): Promise<PortalData | null> {
  // Cheap rejection of garbage before touching the database.
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("project_portal_links")
    .select("project_id, client_label, is_active")
    .eq("token", token)
    .maybeSingle();
  if (!link || !link.is_active) return null;

  const { data: project } = await admin
    .from("projects")
    .select("*")
    .eq("id", link.project_id)
    .single();
  if (!project) return null;

  const [{ data: tasks }, { data: checklist }] = await Promise.all([
    admin
      .from("tasks")
      .select("title, status, completed_at")
      .eq("project_id", link.project_id),
    admin
      .from("project_checklist_items")
      .select("label, done")
      .eq("project_id", link.project_id)
      .order("sort_order")
      .order("created_at"),
  ]);

  // Cancelled tasks don't count toward (or against) client-facing progress.
  const counted = (tasks ?? []).filter((t) => t.status !== "cancelled");
  const count = (s: TaskStatus) =>
    counted.filter((t) => t.status === s).length;
  const done = count("done");
  const taskCounts = {
    total: counted.length,
    done,
    in_progress: count("in_progress"),
    review: count("review"),
  };
  const progressPct = counted.length
    ? Math.round((done / counted.length) * 100)
    : 0;

  const recentDeliverables = counted
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .slice(0, 5)
    .map((t) => ({ title: t.title, completedAt: t.completed_at }));

  return {
    projectName: project.name_ar || project.name,
    clientName: project.client_name,
    clientLabel: link.client_label,
    description: project.description,
    status: project.status,
    priority: project.priority,
    startDate: project.start_date,
    endDate: project.end_date,
    taskCounts,
    progressPct,
    milestones: (checklist ?? []).map((c) => ({
      label: c.label,
      done: c.done,
    })),
    recentDeliverables,
  };
}
