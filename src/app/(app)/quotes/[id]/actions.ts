"use server";

import { revalidatePath } from "next/cache";
import { requireContractor } from "@/lib/contractor";

export interface EditableLine {
  id?: string;
  price_book_item_id: string | null;
  name: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  est_minutes: number;
  ai_confidence: number | null;
  is_new_item: boolean;
}

// Replaces the quote's line items and recomputes totals server-side.
export async function saveQuote(
  quoteId: string,
  input: { title: string; tax_rate: number; lines: EditableLine[] }
) {
  const { supabase, contractor } = await requireContractor();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("id", quoteId)
    .eq("contractor_id", contractor.id)
    .maybeSingle();
  if (!quote) return { ok: false, message: "Quote not found." };

  const lines = input.lines
    .filter((l) => l.name.trim().length > 0)
    .map((l, idx) => {
      const qty = Math.max(0, Number(l.qty) || 0);
      const unitPrice = Math.max(0, Number(l.unit_price) || 0);
      return {
        quote_id: quoteId,
        price_book_item_id: l.price_book_item_id,
        name: l.name.trim(),
        description: l.description,
        qty,
        unit: l.unit || "each",
        unit_price: unitPrice,
        line_total: Math.round(qty * unitPrice * 100) / 100,
        est_minutes: Math.max(0, Math.round(Number(l.est_minutes) || 0)),
        ai_confidence: l.ai_confidence,
        is_new_item: l.is_new_item,
        sort_order: idx,
      };
    });

  const subtotal =
    Math.round(lines.reduce((s, l) => s + l.line_total, 0) * 100) / 100;
  const taxRate = Math.min(25, Math.max(0, Number(input.tax_rate) || 0));
  const total = Math.round(subtotal * (1 + taxRate / 100) * 100) / 100;
  const estTotalMinutes = lines.reduce((s, l) => s + l.est_minutes, 0);

  const { error: delError } = await supabase
    .from("quote_line_items")
    .delete()
    .eq("quote_id", quoteId);
  if (delError) return { ok: false, message: delError.message };

  const { error: insError } = await supabase
    .from("quote_line_items")
    .insert(lines);
  if (insError) return { ok: false, message: insError.message };

  const { error: updError } = await supabase
    .from("quotes")
    .update({
      title: input.title.trim() || "Untitled quote",
      tax_rate: taxRate,
      subtotal,
      total,
      est_total_minutes: estTotalMinutes,
    })
    .eq("id", quoteId);
  if (updError) return { ok: false, message: updError.message };

  await supabase
    .from("quote_events")
    .insert({ quote_id: quoteId, type: "edited" });

  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true };
}

// "Teach the AI": store a priced new item back into the price book so future
// quotes match it automatically.
export async function addLineToPriceBook(line: {
  name: string;
  description: string | null;
  unit: string;
  unit_price: number;
  est_minutes: number;
  qty: number;
}) {
  const { supabase, contractor } = await requireContractor();

  const perUnitMinutes =
    line.qty > 0 ? Math.round(line.est_minutes / line.qty) : line.est_minutes;

  const { data, error } = await supabase
    .from("price_book_items")
    .insert({
      contractor_id: contractor.id,
      name: line.name,
      description: line.description,
      category: "Learned",
      unit: line.unit,
      unit_cost: Math.max(0, line.unit_price),
      est_minutes_per_unit: Math.max(0, perUnitMinutes),
      source: "learned",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false as const, message: error?.message };
  revalidatePath("/pricebook");
  return { ok: true as const, priceBookItemId: data.id };
}
