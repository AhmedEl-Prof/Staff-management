import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/token-crypto";

// Single Drive scope we need: read/write files this app creates and is
// explicitly granted access to. This avoids prompting for the wider
// `drive` scope unless we genuinely need it.
export const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"];

function getEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ?? `${appUrl}/api/drive/callback`;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set for Drive integration",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

// OAuth client wired with the app's credentials. Use this for the consent
// redirect and code exchange — no user context yet.
export function createOAuthClient(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = getEnv();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Loads a user's stored Drive credentials and returns a Drive client bound to
// them. Persists refreshed access tokens back into the database. Returns null
// if the user has not connected Drive.
export async function getDriveClientForUser(userId: string) {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("drive_connections")
    .select("id, access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (!row) return null;

  const oauth = createOAuthClient();
  oauth.setCredentials({
    access_token: decryptToken(row.access_token),
    refresh_token: decryptToken(row.refresh_token),
    expiry_date: row.expires_at ? new Date(row.expires_at).getTime() : null,
  });

  // Persist the rotated access token whenever the SDK refreshes it.
  oauth.on("tokens", async (tokens) => {
    const updates: Partial<{
      access_token: string;
      refresh_token: string;
      expires_at: string;
    }> = {};
    if (tokens.access_token) {
      updates.access_token = encryptToken(tokens.access_token);
    }
    if (tokens.refresh_token) {
      updates.refresh_token = encryptToken(tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      updates.expires_at = new Date(tokens.expiry_date).toISOString();
    }
    if (Object.keys(updates).length === 0) return;
    await admin.from("drive_connections").update(updates).eq("id", row.id);
  });

  return google.drive({ version: "v3", auth: oauth });
}

export type DriveClient = NonNullable<
  Awaited<ReturnType<typeof getDriveClientForUser>>
>;

// ----------------------------------------------------------------------------
// Operations
// ----------------------------------------------------------------------------

export async function createProjectFolder(
  drive: DriveClient,
  projectName: string,
): Promise<{ id: string; url: string }> {
  const res = await drive.files.create({
    requestBody: {
      name: projectName,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id, webViewLink",
  });
  const id = res.data.id;
  const url = res.data.webViewLink ?? "";
  if (!id) throw new Error("Drive did not return a folder id");
  return { id, url };
}

export async function shareFolderWithUser(
  drive: DriveClient,
  folderId: string,
  email: string,
  role: "reader" | "writer" = "writer",
): Promise<void> {
  await drive.permissions.create({
    fileId: folderId,
    sendNotificationEmail: false,
    requestBody: { type: "user", role, emailAddress: email },
  });
}

export async function revokeFolderShare(
  drive: DriveClient,
  folderId: string,
  email: string,
): Promise<void> {
  // The Drive API only exposes permissions by id, not by email, so we list
  // and filter.
  const res = await drive.permissions.list({
    fileId: folderId,
    fields: "permissions(id, emailAddress)",
  });
  const target = res.data.permissions?.find(
    (p) => p.emailAddress?.toLowerCase() === email.toLowerCase(),
  );
  if (!target?.id) return;
  await drive.permissions.delete({ fileId: folderId, permissionId: target.id });
}

// Uploads a buffer into the given folder. Used for "save file to Drive".
export async function uploadFileToFolder(
  drive: DriveClient,
  folderId: string,
  fileName: string,
  data: Buffer,
  mimeType: string,
): Promise<{ id: string; url: string }> {
  const { Readable } = await import("node:stream");
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType,
    },
    media: {
      mimeType,
      body: Readable.from(data),
    },
    fields: "id, webViewLink",
  });
  return { id: res.data.id ?? "", url: res.data.webViewLink ?? "" };
}
