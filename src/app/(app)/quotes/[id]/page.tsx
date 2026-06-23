import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContractor } from "@/lib/contractor";
import { capabilitiesFor } from "@/lib/plan";
import {
  formatMoney,
  type ChangeOrder,
  type Invoice,
  type Job,
  type Quote,
  type QuoteLineItem,
  type QuoteTier,
} from "@/lib/types";
import QuoteEditor from "./QuoteEditor";

const TIER_ORDER: QuoteTier[] = ["good", "better", "best"];

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
  let changeOrders: ChangeOrder[] = [];
  if (job) {
    const [{ data: invData }, { data: coData }] = await Promise.all([
      supabase.from("invoices").select("*").eq("job_id", job.id).maybeSingle(),
      supabase
        .from("change_orders")
        .select("*")
        .eq("quote_id", id)
        .order("created_at"),
    ]);
    invoice = (invData as Invoice) ?? null;
    changeOrders = (coData ?? []) as ChangeOrder[];
  }

  const quote = quoteData as Quote;

  // Good/better/best siblings: tier tabs + the share link always points at
  // the 'better' row (the customer-side tier switcher entry point).
  let siblings: Pick<Quote, "id" | "tier" | "total" | "share_token">[] = [];
  if (quote.tier_group_id) {
    const { data: sibData } = await supabase
      .from("quotes")
      .select("id, tier, total, share_token")
      .eq("tier_group_id", quote.tier_group_id);
    siblings = (sibData ?? []) as typeof siblings;
    siblings.sort(
      (a, b) =>
        TIER_ORDER.indexOf(a.tier as QuoteTier) -
        TIER_ORDER.indexOf(b.tier as QuoteTier)
    );
  }
  const betterToken =
    siblings.find((s) => s.tier === "better")?.share_token ??
    quote.share_token;

  return (
    <>
      {siblings.length > 1 && (
        <div className="mb-3 grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
          {siblings.map((s) => (
            <Link
              key={s.id}
              href={`/quotes/${s.id}`}
              className={`rounded-xl px-2 py-2 capitalize ${
                s.id === quote.id
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200"
              }`}
            >
              {s.tier}
              <span className="block text-[11px] font-normal opacity-75">
                {formatMoney(Number(s.total))}
              </span>
            </Link>
          ))}
        </div>
      )}
      <QuoteEditor
        quote={quote}
        initialLines={(lineData ?? []) as QuoteLineItem[]}
        job={job}
        invoice={invoice}
        changeOrders={changeOrders}
        sendShareToken={betterToken}
        canDraftMessage={capabilitiesFor(contractor).aiCustomerMessage}
      />
    </>
  );
}
