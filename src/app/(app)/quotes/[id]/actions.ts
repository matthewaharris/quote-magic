"use server";

import { revalidatePath } from "next/cache";
import { requireContractor } from "@/lib/contractor";
import { actionEmailHtml, sendEmail } from "@/lib/email";
import { issueInvoice } from "@/lib/invoice";
import { sendNudge } from "@/lib/nudge";

// Manual "send reminder" — contractor's call, so the 48h/once-only cron
// guards are skipped. Each send is still logged as a 'nudged' event.
export async function sendReminder(quoteId: string) {
  const { supabase, contractor } = await requireContractor();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id")
    .eq("id", quoteId)
    .eq("contractor_id", contractor.id)
    .maybeSingle();
  if (!quote) return { ok: false, message: "Not found" };
  const result = await sendNudge(supabase, quoteId, { force: true });
  if (!result.ok) {
    return { ok: false, message: `Couldn't send reminder (${result.reason}).` };
  }
  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true };
}

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

// Contractor reports the job done; customer gets asked to confirm.
export async function markJobComplete(jobId: string) {
  const { supabase, contractor } = await requireContractor();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, quote_id, contractor_id, status")
    .eq("id", jobId)
    .eq("contractor_id", contractor.id)
    .maybeSingle();
  if (!job) return { ok: false, message: "Job not found." };
  if (!["unscheduled", "scheduled"].includes(job.status)) {
    return { ok: false, message: "Job is already past this step." };
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      status: "done_reported",
      done_reported_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) return { ok: false, message: error.message };

  await supabase
    .from("quote_events")
    .insert({ quote_id: job.quote_id, type: "done_reported" });

  // Ask the customer to confirm, when we have their email.
  const { data: quote } = await supabase
    .from("quotes")
    .select("title, share_token, customer_id")
    .eq("id", job.quote_id)
    .single();
  let emailed = false;
  if (quote?.customer_id) {
    const { data: customer } = await supabase
      .from("customers")
      .select("email")
      .eq("id", quote.customer_id)
      .maybeSingle();
    if (customer?.email) {
      const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/q/${quote.share_token}`;
      await sendEmail({
        to: customer.email,
        subject: `${contractor.business_name || "Your contractor"} finished the job — please confirm`,
        html: actionEmailHtml({
          heading: "Is the job complete?",
          body: `${contractor.business_name || "Your contractor"} reports "<strong>${quote.title}</strong>" is finished. Take a look and confirm so we can send your invoice.`,
          url,
          cta: "Review & confirm",
          brand: {
            businessName: contractor.business_name,
            logoUrl: contractor.logo_url,
          },
        }),
      });
      emailed = true;
    }
  }

  revalidatePath(`/quotes`);
  return { ok: true, emailed };
}

// Escape hatch: invoice without waiting for customer confirmation.
export async function generateInvoiceNow(jobId: string) {
  const { supabase, contractor } = await requireContractor();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, quote_id, contractor_id, status")
    .eq("id", jobId)
    .eq("contractor_id", contractor.id)
    .maybeSingle();
  if (!job) return { ok: false, message: "Job not found." };
  if (!["done_reported", "confirmed"].includes(job.status)) {
    return { ok: false, message: "Mark the job complete first." };
  }

  const result = await issueInvoice(supabase, job);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath(`/quotes`);
  return { ok: true, number: result.invoice.number as string };
}
