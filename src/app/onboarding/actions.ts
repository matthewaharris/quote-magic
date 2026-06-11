"use server";

import { cookies } from "next/headers";
import { requireContractor } from "@/lib/contractor";
import { createAdminClient } from "@/lib/supabase/server";
import { scrapeAndStoreLogo } from "@/lib/logo";

// Consume the qm_ref cookie (set by the proxy on ?ref= visits): record who
// referred this contractor and give the referrer +10 trial quotes. All
// writes go through the service-role client — referred_by and
// trial_quote_limit are column-locked against user-scoped updates.
async function attributeReferral(contractorId: string) {
  try {
    const cookieStore = await cookies();
    const ref = cookieStore.get("qm_ref")?.value;
    if (!ref || ref === contractorId) return;

    const admin = createAdminClient();
    const { data: referrer } = await admin
      .from("contractors")
      .select("id, plan, trial_quote_limit")
      .eq("id", ref)
      .maybeSingle();
    if (!referrer) return;

    const { data: me } = await admin
      .from("contractors")
      .select("referred_by")
      .eq("id", contractorId)
      .single();
    if (me?.referred_by) return; // first attribution wins

    await admin
      .from("contractors")
      .update({ referred_by: referrer.id })
      .eq("id", contractorId);
    if (referrer.plan === "trial") {
      await admin
        .from("contractors")
        .update({ trial_quote_limit: referrer.trial_quote_limit + 10 })
        .eq("id", referrer.id);
    }
  } catch {
    // Referral attribution must never block onboarding.
  }
}

export async function completeOnboarding(input: {
  name: string;
  phone: string;
  business_name: string;
  website_url: string;
}) {
  const { supabase, contractor } = await requireContractor();

  const name = input.name.trim();
  if (!name) return { ok: false, message: "Please tell us your name." };
  const websiteUrl = input.website_url.trim();

  // Mark onboarding complete before attempting the logo scrape — a flaky
  // website must never strand the contractor on this screen.
  const { error } = await supabase
    .from("contractors")
    .update({
      name,
      phone: input.phone.trim() || null,
      business_name: input.business_name.trim(),
      website_url: websiteUrl || null,
      onboarded_at: contractor.onboarded_at ?? new Date().toISOString(),
    })
    .eq("id", contractor.id);
  if (error) return { ok: false, message: error.message };

  await attributeReferral(contractor.id);

  if (websiteUrl) {
    try {
      await scrapeAndStoreLogo(websiteUrl, contractor.id);
    } catch {
      // best effort only
    }
  }

  return { ok: true };
}
