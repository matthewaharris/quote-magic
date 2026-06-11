"use server";

import { revalidatePath } from "next/cache";
import { requireContractor } from "@/lib/contractor";

export interface ReviewedItem {
  name: string;
  description: string;
  category: string;
  unit: string;
  unit_cost: number;
  est_minutes_per_unit: number;
}

export async function saveImportedPriceBook(items: ReviewedItem[]) {
  const { supabase, contractor } = await requireContractor();

  const rows = items
    .filter((i) => i.name.trim().length > 0)
    .map((i) => ({
      contractor_id: contractor.id,
      name: i.name.trim(),
      description: i.description,
      category: i.category || "General",
      unit: i.unit || "each",
      unit_cost: Math.max(0, Number(i.unit_cost) || 0),
      est_minutes_per_unit: Math.max(0, Math.round(Number(i.est_minutes_per_unit) || 0)),
      source: "seeded" as const,
    }));

  if (rows.length === 0) return { ok: false, message: "Nothing to save." };

  const { error } = await supabase.from("price_book_items").insert(rows);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/pricebook");
  return { ok: true };
}
