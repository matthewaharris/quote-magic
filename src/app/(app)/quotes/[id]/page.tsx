import { notFound } from "next/navigation";
import { requireContractor } from "@/lib/contractor";
import type { Quote, QuoteLineItem } from "@/lib/types";
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

  const { data: lineData } = await supabase
    .from("quote_line_items")
    .select("*")
    .eq("quote_id", id)
    .order("sort_order");

  return (
    <QuoteEditor
      quote={quoteData as Quote}
      initialLines={(lineData ?? []) as QuoteLineItem[]}
    />
  );
}
