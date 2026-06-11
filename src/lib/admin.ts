import { redirect } from "next/navigation";
import { requireContractor } from "@/lib/contractor";
import { createAdminClient } from "@/lib/supabase/server";

// Admin gate. is_admin is trustworthy even though the row is read through the
// user-scoped client: migration 0004 column-locks it against client UPDATE
// (and INSERT), so only service-role/SQL can ever set it.
export async function requireAdmin() {
  const { supabase, user, contractor } = await requireContractor();
  if (!contractor.is_admin) redirect("/quotes");
  return { supabase, user, contractor, admin: createAdminClient() };
}
