import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import {
  formatDuration,
  formatMoney,
  type Contractor,
  type Quote,
  type QuoteLineItem,
} from "@/lib/types";
import RespondButtons from "./RespondButtons";

// Public customer-facing quote page, keyed by unguessable share token.
// Uses the service-role client — RLS does not apply here by design.
export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: quoteData } = await supabase
    .from("quotes")
    .select("*")
    .eq("share_token", token)
    .maybeSingle();
  if (!quoteData) notFound();
  const quote = quoteData as Quote;

  const [{ data: contractorData }, { data: lineData }] = await Promise.all([
    supabase
      .from("contractors")
      .select("*")
      .eq("id", quote.contractor_id)
      .single(),
    supabase
      .from("quote_line_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("sort_order"),
  ]);
  const contractor = contractorData as Contractor;
  const lines = (lineData ?? []) as QuoteLineItem[];

  // First customer view of a sent quote: record it.
  if (quote.status === "sent") {
    await supabase
      .from("quotes")
      .update({ status: "viewed" })
      .eq("id", quote.id);
    await supabase
      .from("quote_events")
      .insert({ quote_id: quote.id, type: "viewed" });
    quote.status = "viewed";
  }

  const responded = quote.status === "accepted" || quote.status === "declined";

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-zinc-50 px-4 py-8">
      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-400">
          Quote from
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">
          {contractor.business_name || "Your contractor"}
        </h1>
        {contractor.phone && (
          <p className="mt-1 text-sm text-zinc-500">{contractor.phone}</p>
        )}
      </header>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
        <h2 className="text-lg font-semibold text-zinc-900">{quote.title}</h2>
        {quote.job_summary && (
          <p className="mt-2 text-sm text-zinc-600">{quote.job_summary}</p>
        )}

        <ul className="mt-4 divide-y divide-zinc-100">
          {lines.map((line) => (
            <li key={line.id} className="py-3">
              <div className="flex justify-between gap-3">
                <span className="font-medium text-zinc-800">{line.name}</span>
                <span className="shrink-0 font-medium text-zinc-800">
                  {formatMoney(Number(line.line_total))}
                </span>
              </div>
              <div className="mt-0.5 flex justify-between gap-3 text-xs text-zinc-500">
                <span>{line.description}</span>
                <span className="shrink-0">
                  {Number(line.qty)} {line.unit} ×{" "}
                  {formatMoney(Number(line.unit_price))}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-2 border-t border-zinc-200 pt-3">
          {Number(quote.tax_rate) > 0 && (
            <>
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Subtotal</span>
                <span>{formatMoney(Number(quote.subtotal))}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Tax ({Number(quote.tax_rate)}%)</span>
                <span>
                  {formatMoney(Number(quote.total) - Number(quote.subtotal))}
                </span>
              </div>
            </>
          )}
          <div className="mt-1 flex justify-between text-xl font-bold text-zinc-900">
            <span>Total</span>
            <span>{formatMoney(Number(quote.total))}</span>
          </div>
          <p className="mt-1 text-right text-xs text-zinc-400">
            Estimated time on site: {formatDuration(quote.est_total_minutes)}
          </p>
        </div>

        {quote.assumptions.length > 0 && (
          <div className="mt-4 rounded-xl bg-zinc-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Assumptions
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-zinc-500">
              {quote.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-6">
        {responded ? (
          <div
            className={`rounded-2xl p-5 text-center font-semibold ${
              quote.status === "accepted"
                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                : "bg-red-50 text-red-800 ring-1 ring-red-200"
            }`}
          >
            {quote.status === "accepted"
              ? `✓ You accepted this quote. ${contractor.business_name || "Your contractor"} will reach out to schedule the work.`
              : "You declined this quote."}
          </div>
        ) : (
          <RespondButtons token={token} />
        )}
      </section>

      <p className="mt-8 text-center text-xs text-zinc-400">
        Powered by QuoteMagic
      </p>
    </main>
  );
}
