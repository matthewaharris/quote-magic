"use server";

import { requireContractor } from "@/lib/contractor";
import { scrapeAndStoreLogo } from "@/lib/logo";

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

  if (websiteUrl) {
    try {
      await scrapeAndStoreLogo(websiteUrl, contractor.id);
    } catch {
      // best effort only
    }
  }

  return { ok: true };
}
