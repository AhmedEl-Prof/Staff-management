"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Removes the current user's Drive connection. Best-effort: we just drop the
// row (and therefore the stored tokens). The Google-side authorization can be
// revoked from the user's Google Account settings if they want to be thorough.
export async function disconnectDrive() {
  const caller = await requireUser();
  const supabase = await createClient();
  await supabase.from("drive_connections").delete().eq("user_id", caller.id);

  revalidatePath("/profile");
}
