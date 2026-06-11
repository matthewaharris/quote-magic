import type { SupabaseClient } from "@supabase/supabase-js";

// Issues the invoice for a job from the quote's totals and advances the job
// to 'invoiced'. Idempotent: returns the existing invoice if one exists.
// Works with either the RLS client (contractor action) or the admin client
// (customer confirm route).
export async function issueInvoice(
  supabase: SupabaseClient,
  job: { id: string; quote_id: string; contractor_id: string }
) {
  const { data: existing } = await supabase
    .from("invoices")
    .select("*")
    .eq("job_id", job.id)
    .maybeSingle();
  if (existing) return { ok: true as const, invoice: existing };

  const { data: quote } = await supabase
    .from("quotes")
    .select("subtotal, tax_rate, total")
    .eq("id", job.quote_id)
    .single();
  if (!quote) return { ok: false as const, message: "Quote not found" };

  // Deposit already collected comes off the invoice; approved change orders
  // are added (flat, tax-inclusive amounts).
  const { data: jobRow } = await supabase
    .from("jobs")
    .select("deposit_amount, deposit_paid_at")
    .eq("id", job.id)
    .single();
  const depositApplied = jobRow?.deposit_paid_at
    ? Number(jobRow.deposit_amount)
    : 0;

  const { data: approvedCOs } = await supabase
    .from("change_orders")
    .select("amount")
    .eq("quote_id", job.quote_id)
    .eq("status", "approved");
  const changeOrdersTotal =
    Math.round(
      (approvedCOs ?? []).reduce((s, co) => s + Number(co.amount), 0) * 100
    ) / 100;

  const invoiceSubtotal =
    Math.round((Number(quote.subtotal) + changeOrdersTotal) * 100) / 100;
  const invoiceTotal = Math.max(
    0,
    Math.round(
      (Number(quote.total) + changeOrdersTotal - depositApplied) * 100
    ) / 100
  );

  // Simple sequential-ish numbering per contractor; fine for a prototype.
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("quote_id", job.quote_id);
  const { count: contractorCount } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("contractor_id", job.contractor_id);
  void count;
  const number = `QM-${1000 + (contractorCount ?? 0)}`;

  const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      job_id: job.id,
      quote_id: job.quote_id,
      number,
      subtotal: invoiceSubtotal,
      tax_rate: quote.tax_rate,
      total: invoiceTotal,
      deposit_applied: depositApplied,
      change_orders_total: changeOrdersTotal,
      due_at: dueAt,
    })
    .select("*")
    .single();
  if (error || !invoice) {
    return { ok: false as const, message: error?.message ?? "Insert failed" };
  }

  await supabase.from("jobs").update({ status: "invoiced" }).eq("id", job.id);
  await supabase
    .from("quote_events")
    .insert({ quote_id: job.quote_id, type: "invoiced", meta: { number } });

  return { ok: true as const, invoice };
}
