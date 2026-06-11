import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contractor } from "@/lib/types";

export const TRIAL_DAYS = 14;

export interface TrialStatus {
  onTrial: boolean;
  expired: boolean;
  quotesUsed: number;
  quotesRemaining: number;
  daysLeft: number;
}

// Every quote row counts toward the limit (drafts included) — each one is an
// AI generation. The limit is per-contractor (contractors.trial_quote_limit)
// so admins can extend it. Non-trial plans skip the count query entirely.
export async function getTrialStatus(
  supabase: SupabaseClient,
  contractor: Contractor
): Promise<TrialStatus> {
  if (contractor.plan === "disabled") {
    return {
      onTrial: false,
      expired: true,
      quotesUsed: 0,
      quotesRemaining: 0,
      daysLeft: 0,
    };
  }
  if (contractor.plan !== "trial") {
    return {
      onTrial: false,
      expired: false,
      quotesUsed: 0,
      quotesRemaining: Infinity,
      daysLeft: Infinity,
    };
  }

  // A good/better/best generation creates 3 rows but counts as ONE quote —
  // every tier group has exactly one 'better' row.
  const { count } = await supabase
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("contractor_id", contractor.id)
    .or("tier_group_id.is.null,tier.eq.better");
  const quotesUsed = count ?? 0;
  const limit = contractor.trial_quote_limit;

  const msLeft = new Date(contractor.trial_ends_at).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));

  return {
    onTrial: true,
    expired: msLeft <= 0 || quotesUsed >= limit,
    quotesUsed,
    quotesRemaining: Math.max(0, limit - quotesUsed),
    daysLeft,
  };
}
