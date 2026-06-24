"use server";

import { requireContractor } from "@/lib/contractor";

// Stamp "the contractor has now seen the What's new panel" — clears the unseen
// dot. changelog_seen_at is granted to the user client in migration 0014.
export async function markChangelogSeen(): Promise<void> {
  const { supabase, contractor } = await requireContractor();
  await supabase
    .from("contractors")
    .update({ changelog_seen_at: new Date().toISOString() })
    .eq("id", contractor.id);
}
