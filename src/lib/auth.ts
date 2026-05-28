import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/database";

export interface SessionUser {
  id: string;
  email: string | null;
  profile: ProfileRow;
}

// Returns the authenticated user together with their profile, or null. Use in
// Server Components / Server Actions. Pages are already gated by the proxy
// (middleware), but call this to read role + profile details.
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { id: user.id, email: user.email ?? null, profile };
}

// Like getSessionUser but redirects to /login when there is no session.
export async function requireUser(): Promise<SessionUser> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");
  return sessionUser;
}

// Requires the caller to hold one of the given roles, otherwise redirects home.
export async function requireRole(
  roles: ProfileRow["role"][],
): Promise<SessionUser> {
  const sessionUser = await requireUser();
  if (!roles.includes(sessionUser.profile.role)) redirect("/");
  return sessionUser;
}
