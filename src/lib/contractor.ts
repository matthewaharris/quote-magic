import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Contractor } from "@/lib/types";

// Loads the signed-in contractor, creating the row on first login.
// Redirects to /login when there is no session.
export async function requireContractor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("contractors")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existing) {
    return { supabase, user, contractor: existing as Contractor };
  }

  const { data: created, error } = await supabase
    .from("contractors")
    .insert({ auth_user_id: user.id, email: user.email })
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create contractor profile: ${error?.message}`);
  }

  return { supabase, user, contractor: created as Contractor };
}
