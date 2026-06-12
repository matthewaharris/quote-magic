"use server";

// Shared by SettingsForm and QuoteEditor: look up the combined sales tax
// rate for a zip. Auth-gated so the public can't burn the zip.tax quota
// through us; the lookup itself is cached in tax_rates (src/lib/tax.ts).
import { requireContractor } from "@/lib/contractor";
import { lookupTaxRate } from "@/lib/tax";

export async function lookupTax(zip: string) {
  await requireContractor();
  const result = await lookupTaxRate(zip);
  if (!result.ok) return { ok: false as const, message: result.reason };
  return { ok: true as const, rate: result.rate, region: result.region };
}
