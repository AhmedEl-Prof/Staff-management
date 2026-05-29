import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Diagnostic endpoint. Tells us whether the environment variables are wired
// correctly and whether the Supabase project is reachable. Safe to expose:
// returns only presence flags + the *host* of the URL (not the keys).
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const result: Record<string, unknown> = {
    env: {
      NEXT_PUBLIC_SUPABASE_URL_set: !!url,
      NEXT_PUBLIC_SUPABASE_URL_raw: url,
      NEXT_PUBLIC_SUPABASE_URL_length: url.length,
      NEXT_PUBLIC_SUPABASE_URL_ends_with_slash: url.endsWith("/"),
      NEXT_PUBLIC_SUPABASE_URL_host: (() => {
        try {
          return new URL(url).host;
        } catch {
          return null;
        }
      })(),
      NEXT_PUBLIC_SUPABASE_URL_pathname: (() => {
        try {
          return new URL(url).pathname;
        } catch {
          return null;
        }
      })(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY_set: !!anon,
      NEXT_PUBLIC_SUPABASE_ANON_KEY_prefix: anon ? anon.slice(0, 12) : null,
      NEXT_PUBLIC_SUPABASE_ANON_KEY_length: anon.length,
      SUPABASE_SERVICE_ROLE_KEY_set: !!service,
      SUPABASE_SERVICE_ROLE_KEY_prefix: service ? service.slice(0, 12) : null,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
    },
  };

  // Probe Supabase REST: no-op count on the seeded departments table.
  if (url && anon) {
    try {
      const client = createSupabaseClient(url, anon);
      const { count, error } = await client
        .from("departments")
        .select("id", { count: "exact", head: true });
      result.supabase_rest = error
        ? { ok: false, error: error.message }
        : { ok: true, departments_count: count };
    } catch (err) {
      result.supabase_rest = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    result.supabase_rest = { ok: false, error: "url or anon key missing" };
  }

  // Probe Supabase Auth specifically: try to sign in with bogus credentials.
  // A reachable auth endpoint returns 'invalid_credentials'; anything else
  // (network error, "Invalid path", etc.) points to a URL/config issue.
  if (url && anon) {
    try {
      const client = createSupabaseClient(url, anon);
      const { error } = await client.auth.signInWithPassword({
        email: "no-such-user@diagnostic.local",
        password: "wrong-password-on-purpose",
      });
      result.supabase_auth = error
        ? { reachable: true, code: error.code ?? null, message: error.message }
        : { reachable: true, note: "no error returned (unexpected)" };
    } catch (err) {
      result.supabase_auth = {
        reachable: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    result.supabase_auth = { reachable: false, error: "url or anon key missing" };
  }

  return NextResponse.json(result);
}
