import { cache } from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

// Server-side Supabase client for use in Server Components, Route Handlers, and
// Server Actions. Reads and writes the auth session via Next.js cookies.
//
// Memoized per request with React `cache()` so every caller within a single
// request shares ONE client instance. This is essential for Server Actions: the
// auth guard (requireRole → getUser) loads the session onto the client, and the
// subsequent write must reuse that same client. With separate instances the
// write goes out without the user's JWT, so Postgres RLS rejects it as an
// anonymous request (e.g. project inserts failing the manages_department check).
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component. This can
            // be safely ignored when middleware is refreshing the session.
          }
        },
      },
    },
  );
});
