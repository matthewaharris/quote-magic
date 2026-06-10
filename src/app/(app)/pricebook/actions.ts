"use server";

import { revalidatePath } from "next/cache";
import { requireContractor } from "@/lib/contractor";

// Demo price book for an electrician — lets the sauna-job demo work before
// the dictation-based onboarding (Phase 4) exists. unit_cost is the price
// charged to the customer (labor + typical materials) per unit.
const DEMO_ITEMS = [
  { name: "50A 2-pole breaker install", category: "Panel", unit: "each", unit_cost: 185, est_minutes_per_unit: 45, description: "Install 50 amp double-pole breaker in main panel" },
  { name: "20A single-pole breaker install", category: "Panel", unit: "each", unit_cost: 95, est_minutes_per_unit: 30, description: "Install 20 amp single-pole breaker" },
  { name: "Panel rework / make space", category: "Panel", unit: "hour", unit_cost: 150, est_minutes_per_unit: 60, description: "Rearrange existing breakers, add tandems, label panel" },
  { name: "6/2 NM-B cable run", category: "Wiring", unit: "foot", unit_cost: 12, est_minutes_per_unit: 2, description: "Run 6/2 with ground for 50A 240V circuit, interior" },
  { name: "12/2 NM-B cable run", category: "Wiring", unit: "foot", unit_cost: 6, est_minutes_per_unit: 2, description: "Run 12/2 with ground for 20A 120V circuit, interior" },
  { name: "240V 60A disconnect / spa panel", category: "Devices", unit: "each", unit_cost: 260, est_minutes_per_unit: 75, description: "Install outdoor-rated 60A disconnect with GFCI breaker" },
  { name: "120V GFCI outlet install", category: "Devices", unit: "each", unit_cost: 145, est_minutes_per_unit: 40, description: "New GFCI-protected receptacle including box and cover" },
  { name: "Standard 120V outlet install", category: "Devices", unit: "each", unit_cost: 110, est_minutes_per_unit: 30, description: "New 15/20A receptacle on existing circuit" },
  { name: "Single-pole switch install", category: "Devices", unit: "each", unit_cost: 95, est_minutes_per_unit: 25, description: "New single-pole switch including box" },
  { name: "Hardwire appliance connection", category: "Hookup", unit: "each", unit_cost: 180, est_minutes_per_unit: 60, description: "Direct-wire connection of fixed appliance with whip/strain relief" },
  { name: "Equipment terminal hookup", category: "Hookup", unit: "each", unit_cost: 200, est_minutes_per_unit: 60, description: "Terminate conductors at equipment control box per manufacturer spec" },
  { name: "Trenching for underground run", category: "Site work", unit: "foot", unit_cost: 9, est_minutes_per_unit: 5, description: "Hand-dig 18-24 in trench for conduit" },
  { name: "EMT conduit run", category: "Wiring", unit: "foot", unit_cost: 11, est_minutes_per_unit: 4, description: "Surface-mount EMT conduit with conductors" },
  { name: "Service call / diagnostics", category: "Service", unit: "each", unit_cost: 120, est_minutes_per_unit: 45, description: "On-site troubleshooting, first 45 minutes" },
  { name: "Permit & inspection coordination", category: "Service", unit: "each", unit_cost: 250, est_minutes_per_unit: 30, description: "Pull electrical permit and schedule inspection" },
];

export async function seedDemoPriceBook() {
  const { supabase, contractor } = await requireContractor();

  const { count } = await supabase
    .from("price_book_items")
    .select("id", { count: "exact", head: true })
    .eq("contractor_id", contractor.id);

  if ((count ?? 0) > 0) {
    return { ok: false, message: "Price book already has items." };
  }

  const { error } = await supabase.from("price_book_items").insert(
    DEMO_ITEMS.map((item) => ({
      ...item,
      contractor_id: contractor.id,
      source: "seeded" as const,
    }))
  );

  if (error) return { ok: false, message: error.message };

  // Give the demo contractor a sensible profile if still blank.
  if (!contractor.business_name) {
    await supabase
      .from("contractors")
      .update({ business_name: "Demo Electric Co.", trade: "electrician" })
      .eq("id", contractor.id);
  }

  revalidatePath("/pricebook");
  return { ok: true, message: `Added ${DEMO_ITEMS.length} demo items.` };
}

export interface PriceBookInput {
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  unit_cost: number;
  est_minutes_per_unit: number;
}

function cleanItem(input: PriceBookInput) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    category: input.category?.trim() || "General",
    unit: input.unit.trim() || "each",
    unit_cost: Math.max(0, Number(input.unit_cost) || 0),
    est_minutes_per_unit: Math.max(
      0,
      Math.round(Number(input.est_minutes_per_unit) || 0)
    ),
  };
}

export async function addPriceBookItem(input: PriceBookInput) {
  const { supabase, contractor } = await requireContractor();
  if (!input.name.trim()) return { ok: false, message: "Name is required." };

  const { error } = await supabase.from("price_book_items").insert({
    ...cleanItem(input),
    contractor_id: contractor.id,
    source: "manual",
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/pricebook");
  return { ok: true };
}

export async function updatePriceBookItem(id: string, input: PriceBookInput) {
  const { supabase, contractor } = await requireContractor();
  const { error } = await supabase
    .from("price_book_items")
    .update(cleanItem(input))
    .eq("id", id)
    .eq("contractor_id", contractor.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/pricebook");
  return { ok: true };
}

export async function deletePriceBookItem(id: string) {
  const { supabase, contractor } = await requireContractor();
  const { error } = await supabase
    .from("price_book_items")
    .delete()
    .eq("id", id)
    .eq("contractor_id", contractor.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/pricebook");
  return { ok: true };
}
