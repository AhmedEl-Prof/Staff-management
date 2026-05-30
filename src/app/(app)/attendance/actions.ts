"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Records the caller's check-in for today (no-op if already checked in).
export async function checkIn() {
  const caller = await requireUser();
  const date = today();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("attendance")
    .select("id, check_in")
    .eq("user_id", caller.id)
    .eq("date", date)
    .maybeSingle();

  const now = new Date().toISOString();
  if (!row) {
    await admin
      .from("attendance")
      .insert({ user_id: caller.id, date, check_in: now });
  } else if (!row.check_in) {
    await admin.from("attendance").update({ check_in: now }).eq("id", row.id);
  }

  revalidatePath("/attendance");
}

// Records the caller's check-out for today (requires an existing check-in).
export async function checkOut() {
  const caller = await requireUser();
  const date = today();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("attendance")
    .select("id, check_in")
    .eq("user_id", caller.id)
    .eq("date", date)
    .maybeSingle();
  if (!row?.check_in) return;

  await admin
    .from("attendance")
    .update({ check_out: new Date().toISOString() })
    .eq("id", row.id);

  revalidatePath("/attendance");
}
