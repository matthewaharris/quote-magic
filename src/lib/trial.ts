import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contractor } from "@/lib/types";

export const TRIAL_QUOTE_LIMIT = 25;
export const TRIAL_DAYS = 14;

export interface TrialStatus {
  onTrial: boolean;
  expired: boolean;
  quotesUsed: number;
  quotesRemaining: number;
  daysLeft: number;
}

// Every quote row counts toward the limit (drafts included) — each one is an
// AI generation. Non-trial plans skip the count query entirely.
export async function getTrialStatus(
  supabase: SupabaseClient,
  contractor: Contractor
): Promise<TrialStatus> {
  if (contractor.plan !== "trial") {
    return {
      onTrial: false,
      expired: false,
      quotesUsed: 0,
      quotesRemaining: Infinity,
      daysLeft: Infinity,
    };
  }

  const { count } = await supabase
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("contractor_id", contractor.id);
  const quotesUsed = count ?? 0;

  const msLeft = new Date(contractor.trial_ends_at).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));

  return {
    onTrial: true,
    expired: msLeft <= 0 || quotesUsed >= TRIAL_QUOTE_LIMIT,
    quotesUsed,
    quotesRemaining: Math.max(0, TRIAL_QUOTE_LIMIT - quotesUsed),
    daysLeft,
  };
}
