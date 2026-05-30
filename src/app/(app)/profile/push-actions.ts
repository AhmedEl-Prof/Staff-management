"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Persists a browser push subscription for the current user. Upserts on the
// endpoint so re-subscribing the same device doesn't create duplicates.
export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<{ ok: boolean }> {
  const caller = await requireUser();
  if (!input.endpoint || !input.p256dh || !input.auth) return { ok: false };

  const admin = createAdminClient();
  await admin.from("push_subscriptions").upsert(
    {
      user_id: caller.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );
  return { ok: true };
}

// Removes a subscription (this device) for the current user.
export async function deletePushSubscription(
  endpoint: string,
): Promise<{ ok: boolean }> {
  const caller = await requireUser();
  if (!endpoint) return { ok: false };

  const admin = createAdminClient();
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", caller.id)
    .eq("endpoint", endpoint);
  return { ok: true };
}
