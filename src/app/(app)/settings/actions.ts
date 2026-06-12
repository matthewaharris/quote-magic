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
  default_markup_percent: number;
  default_tax_rate: number;
  business_zip: string;
  payment_instructions: string;
  website_url: string;
}) {
  const zip = input.business_zip.trim();
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
      default_markup_percent: Math.min(
        100,
        Math.max(0, Number(input.default_markup_percent) || 0)
      ),
      default_tax_rate: Math.min(
        25,
        Math.max(0, Number(input.default_tax_rate) || 0)
      ),
      business_zip: /^[0-9]{5}$/.test(zip) ? zip : null,
      payment_instructions:
        input.payment_instructions.trim().slice(0, 1000) || null,
      website_url: input.website_url.trim() || null,
    })
    .eq("id", contractor.id);
  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/settings");
  return { ok: true as const };
}

export async function saveQuotingInstructions(instructions: string) {
  const { supabase, contractor } = await requireContractor();
  const { error } = await supabase
    .from("contractors")
    .update({ quoting_instructions: instructions.trim().slice(0, 2000) || null })
    .eq("id", contractor.id);
  if (error) return { ok: false as const, message: error.message };
  revalidatePath("/settings/ai");
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
