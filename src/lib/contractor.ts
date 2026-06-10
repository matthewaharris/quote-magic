import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  return { supabase, user, contractor: created as Contractor };
}

// Page-component variant: redirects to /login when signed out.
export async function requireContractor() {
  const result = await getContractor();
  if (!result) redirect("/login");
  return result;
}
