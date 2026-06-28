import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  createClient,
  createAdminClient,
  createTokenClient,
} from "@/lib/supabase/server";
import { getTrialDays } from "@/lib/settings";
import type { Contractor } from "@/lib/types";

// Load (or create on first login) the contractor row for an authenticated
// user. `supabase` must be a client scoped to THAT user — cookie- or
// token-bound — so RLS applies. Throws if the row cannot be created.
async function loadOrCreateContractor(
  supabase: SupabaseClient,
  user: User
): Promise<Contractor> {
  const { data: existing } = await supabase
    .from("contractors")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (existing) return existing as Contractor;

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
  return contractor;
}

// Loads the signed-in contractor, creating the row on first login.
// Authenticates by EITHER the session cookie (web) OR an `Authorization:
// Bearer <Supabase access token>` header (native / non-browser API clients —
// see docs/ios-app-handoff.md). Returns null when there is no valid session.
export async function getContractor() {
  // Native/API callers send a bearer token instead of the cookie. Try that
  // first; the token client validates the JWT and is RLS-scoped to that user.
  const authHeader = (await headers()).get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    const supabase = createTokenClient(token);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    const contractor = await loadOrCreateContractor(supabase, user);
    return { supabase, user, contractor };
  }

  // Browser session (cookies).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const contractor = await loadOrCreateContractor(supabase, user);
  return { supabase, user, contractor };
}

// Page-component variant: redirects to /login when signed out.
export async function requireContractor() {
  const result = await getContractor();
  if (!result) redirect("/login");
  return result;
}
