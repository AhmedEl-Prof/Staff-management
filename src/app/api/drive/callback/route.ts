import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOAuthClient } from "@/lib/google-drive";
import { encryptToken } from "@/lib/token-crypto";

// Handles the redirect back from Google OAuth. Validates `state` against the
// signed-in user, exchanges the code for tokens, encrypts them, and upserts
// the drive_connections row.
export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(new URL("/profile?drive_error=denied", appUrl));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/profile?drive_error=invalid", appUrl));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== state) {
    return NextResponse.redirect(new URL("/profile?drive_error=auth", appUrl));
  }

  let oauth;
  try {
    oauth = createOAuthClient();
  } catch {
    return NextResponse.redirect(new URL("/profile?drive_error=config", appUrl));
  }

  let tokens;
  try {
    const result = await oauth.getToken(code);
    tokens = result.tokens;
  } catch {
    return NextResponse.redirect(new URL("/profile?drive_error=exchange", appUrl));
  }

  if (!tokens.access_token || !tokens.refresh_token) {
    // Google only returns a refresh token on the very first consent — surface
    // a clearer error so the user knows to re-consent.
    return NextResponse.redirect(new URL("/profile?drive_error=refresh", appUrl));
  }

  const admin = createAdminClient();
  await admin.from("drive_connections").upsert(
    {
      user_id: user.id,
      access_token: encryptToken(tokens.access_token),
      refresh_token: encryptToken(tokens.refresh_token),
      expires_at: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
    },
    { onConflict: "user_id" },
  );

  return NextResponse.redirect(new URL("/profile?drive=connected", appUrl));
}
