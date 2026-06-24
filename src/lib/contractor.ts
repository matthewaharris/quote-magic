import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getTrialDays } from "@/lib/settings";
import type { Contractor } from "@/lib/types";

// Loads the signed-in contractor, creating the row on first login.
// Returns null when there is no session (use in route handlers).
export async function getContractor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("contractors")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existing) {
    return { supabase, user, contractor: existing as Contractor };
  }

  // Upsert: layout and page render in parallel on first login, so two
  // creates can race — onConflict makes this idempotent.
  const { data: created, error } = await supabase
    .from("contractors")
    .upsert(
      { auth_user_id: user.id, email: user.email },
      { onConflict: "auth_user_id" }
    )
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create contractor profile: ${error?.message}`);
  }

  // New signups get the current global trial length (admin-adjustable in
  // /admin). The user client is column-locked out of trial_ends_at, so the
  // DB default (14 days) applies on insert; override it here via the
  // service-role client. Existing contractors are never touched — only this
  // first-login creation path runs. Falls back to the DB default if the
  // settings read or admin write fails.
  let contractor = created as Contractor;
  try {
    const trialDays = await getTrialDays();
    const trialEndsAt = new Date(
      Date.now() + trialDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data: updated } = await createAdminClient()
      .from("contractors")
      .update({ trial_ends_at: trialEndsAt })
      .eq("id", contractor.id)
      .select("*")
      .single();
    if (updated) contractor = updated as Contractor;
  } catch {
    // Keep the DB-default trial if anything above fails.
  }

  return { supabase, user, contractor };
}

// Page-component variant: redirects to /login when signed out.
export async function requireContractor() {
  const result = await getContractor();
  if (!result) redirect("/login");
  return result;
}
