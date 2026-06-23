"use server";

import { requireContractor } from "@/lib/contractor";
import { suggestJobTemplates } from "@/lib/ai/quote";
import { capabilitiesFor } from "@/lib/plan";

// Pro: one-tap quote starters distilled from the contractor's recent jobs.
// Returns upsell=true (not an error) for tiers without the capability so the
// client can show a gentle nudge instead of a failure.
export async function getJobTemplates() {
  const { supabase, contractor } = await requireContractor();
  if (!capabilitiesFor(contractor).jobTemplates) {
    return { ok: false as const, upsell: true as const };
  }

  const { data: recent } = await supabase
    .from("quotes")
    .select("title, job_summary")
    .eq("contractor_id", contractor.id)
    .or("tier_group_id.is.null,tier.eq.better")
    .order("created_at", { ascending: false })
    .limit(40);

  try {
    const result = await suggestJobTemplates({
      trade: contractor.trade,
      recentJobs: (recent ?? []).map((q) => ({
        title: q.title,
        summary: q.job_summary,
      })),
    });
    return { ok: true as const, templates: result.templates };
  } catch (err) {
    console.error("getJobTemplates failed:", err);
    return { ok: false as const, message: "Couldn't load templates. Try again." };
  }
}
