"use server";

import { revalidatePath } from "next/cache";
import { requireContractor } from "@/lib/contractor";
import { scrapeAndStoreLogo } from "@/lib/logo";

export async function updateProfile(input: {
  name: string;
  business_name: string;
  phone: string;
  trade: string;
  hourly_rate: number;
  deposit_percent: number;
  website_url: string;
}) {
  const { supabase, contractor } = await requireContractor();
  const { error } = await supabase
    .from("contractors")
    .update({
      name: input.name.trim(),
      business_name: input.business_name.trim(),
      phone: input.phone.trim() || null,
      trade: input.trade.trim(),
      hourly_rate: Math.max(0, Number(input.hourly_rate) || 0),
      deposit_percent: Math.min(
        100,
        Math.max(0, Math.round(Number(input.deposit_percent) || 0))
      ),
      website_url: input.website_url.trim() || null,
    })
    .eq("id", contractor.id);
  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/settings");
  return { ok: true as const };
}

// Re-scrape the logo from the given website (saving the URL first so the
// next attempt starts from what the contractor last typed).
export async function refreshLogo(websiteUrl: string) {
  const { supabase, contractor } = await requireContractor();
  const trimmed = websiteUrl.trim();
  if (!trimmed) {
    return { ok: false as const, message: "Enter your website address first." };
  }

  await supabase
    .from("contractors")
    .update({ website_url: trimmed })
    .eq("id", contractor.id);

  const result = await scrapeAndStoreLogo(trimmed, contractor.id);
  revalidatePath("/settings");
  if (!result.ok) return { ok: false as const, message: result.reason };
  return { ok: true as const, logoUrl: result.logoUrl };
}
