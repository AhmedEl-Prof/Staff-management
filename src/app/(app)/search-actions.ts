"use server";

import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManagePeople, getManageableEmployees } from "@/lib/permissions";

export interface SearchHit {
  id: string;
  label: string;
  sub: string | null;
  href: string;
}

export interface SearchResults {
  projects: SearchHit[];
  tasks: SearchHit[];
  employees: SearchHit[];
}

const EMPTY: SearchResults = { projects: [], tasks: [], employees: [] };

// PostgREST `or=` filters are comma/paren-delimited, and `%`/`_` are LIKE
// wildcards — strip the delimiters and escape the wildcards so user input
// can't break out of the pattern.
function likePattern(q: string): string {
  const cleaned = q.replace(/[,()]/g, " ").replace(/[%_]/g, "\\$&").trim();
  return `%${cleaned}%`;
}

// Global search across projects, tasks and (for managers) employees. Reads go
// through the caller's RLS-scoped client, so every role only ever sees what
// the rest of the app already shows them.
export async function globalSearch(q: string): Promise<SearchResults> {
  const session = await getSessionUser();
  if (!session) return EMPTY;

  const query = q.trim();
  if (query.length < 2) return EMPTY;
  const like = likePattern(query);

  const supabase = await createClient();
  const lower = query.toLowerCase();

  const [projectsRes, tasksRes, employees] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, name_ar, client_name")
      .or(`name.ilike.${like},name_ar.ilike.${like},client_name.ilike.${like}`)
      .limit(6),
    supabase
      .from("tasks")
      .select("id, title, project_id")
      .ilike("title", like)
      .limit(8),
    canManagePeople(session.profile.role)
      ? getManageableEmployees(session.profile)
      : Promise.resolve([]),
  ]);

  return {
    projects: (projectsRes.data ?? []).map((p) => ({
      id: p.id,
      label: p.name_ar || p.name,
      sub: p.client_name,
      href: `/projects/${p.id}`,
    })),
    tasks: (tasksRes.data ?? []).map((t) => ({
      id: t.id,
      label: t.title,
      sub: null,
      href: `/projects/${t.project_id}/tasks/${t.id}`,
    })),
    employees: employees
      .filter((e) => e.label.toLowerCase().includes(lower))
      .slice(0, 6)
      .map((e) => ({
        id: e.id,
        label: e.label,
        sub: null,
        href: "/employees",
      })),
  };
}
