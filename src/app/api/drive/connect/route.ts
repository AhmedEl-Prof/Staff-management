import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOAuthClient, DRIVE_SCOPES } from "@/lib/google-drive";

// Kicks off the Google Drive OAuth consent flow. We pass the user id as the
// `state` parameter so the callback can verify the caller. `prompt=consent`
// and `access_type=offline` together force Google to return a refresh token.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    );
  }

  let oauth;
  try {
    oauth = createOAuthClient();
  } catch {
    return NextResponse.redirect(
      new URL("/profile?drive_error=config", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    );
  }

  const url = oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: DRIVE_SCOPES,
    state: user.id,
  });

  return NextResponse.redirect(url);
}
