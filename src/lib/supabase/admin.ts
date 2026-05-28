import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-role Supabase client. Bypasses RLS, so it must ONLY be used in
// server-side code (Server Actions / Route Handlers) AFTER the caller's
// permissions have been verified explicitly. Never import this into a Client
// Component or expose the service-role key to the browser.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
