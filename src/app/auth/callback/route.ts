import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles links from invitation and password-recovery emails. Supabase appends
// a `code` which we exchange for a session, then forward the user to `next`
// (e.g. /reset-password to set their password).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
