"use server";

import { revalidatePath } from "next/cache";
import { requireContractor } from "@/lib/contractor";
import { draftStarterPriceBook } from "@/lib/ai/quote";

// Generate a starter price book tailored to the contractor's trade (and an
// optional free-text business description) with AI, so a brand-new account
// can start quoting immediately. Items land as 'seeded' and are fully
// editable — believable starting prices the contractor adjusts to their own.
export async function generateStarterPriceBook(description?: string) {
  const { supabase, contractor } = await requireContractor();

  const { count } = await supabase
    .from("price_book_items")
    .select("id", { count: "exact", head: true })
    .eq("contractor_id", contractor.id);

  if ((count ?? 0) > 0) {
    return { ok: false, message: "Price book already has items." };
  }

  let items;
  try {
    const drafted = await draftStarterPriceBook({
      trade: contractor.trade,
      description: description?.trim() || null,
      hourlyRate: Number(contractor.hourly_rate),
    });
    items = drafted.items;
  } catch {
    return {
      ok: false,
      message: "Couldn't generate a starter price book. Please try again.",
    };
  }

  if (!items.length) {
    return { ok: false, message: "No items were generated. Try again." };
  }

  const { error } = await supabase.from("price_book_items").insert(
    items.map((item) => ({
      contractor_id: contractor.id,
      name: item.name,
      description: item.description || null,
      category: item.category?.trim() || null,
      unit: item.unit?.trim() || "each",
      unit_cost: Math.max(0, Number(item.unit_cost_estimate) || 0),
      est_minutes_per_unit: Math.max(
        0,
        Math.round(Number(item.est_minutes_per_unit) || 0)
      ),
      source: "seeded" as const,
    }))
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/pricebook");
  return { ok: true, message: `Added ${items.length} starter items.` };
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
    // Blank category = Uncategorized bucket on the price book page (no
    // value stored). Categories are implicit: the distinct set of values
    // across a contractor's items, populated as they add them.
    category: input.category?.trim() || null,
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
