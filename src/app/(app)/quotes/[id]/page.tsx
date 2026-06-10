import { notFound } from "next/navigation";
import { requireContractor } from "@/lib/contractor";
import type { Invoice, Job, Quote, QuoteLineItem } from "@/lib/types";
import QuoteEditor from "./QuoteEditor";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, contractor } = await requireContractor();

  const { data: quoteData } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .eq("contractor_id", contractor.id)
    .maybeSingle();
  if (!quoteData) notFound();

  const [{ data: lineData }, { data: jobData }] = await Promise.all([
    supabase
      .from("quote_line_items")
      .select("*")
      .eq("quote_id", id)
      .order("sort_order"),
    supabase.from("jobs").select("*").eq("quote_id", id).maybeSingle(),
  ]);

  const job = (jobData as Job) ?? null;
  let invoice: Invoice | null = null;
  if (job) {
    const { data: invData } = await supabase
      .from("invoices")
      .select("*")
      .eq("job_id", job.id)
      .maybeSingle();
    invoice = (invData as Invoice) ?? null;
  }

  return (
    <QuoteEditor
      quote={quoteData as Quote}
      initialLines={(lineData ?? []) as QuoteLineItem[]}
      job={job}
      invoice={invoice}
    />
  );
}
