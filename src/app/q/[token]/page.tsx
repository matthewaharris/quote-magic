import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import {
  formatDuration,
  formatMoney,
  type Contractor,
  type Invoice,
  type Job,
  type Quote,
  type QuoteLineItem,
} from "@/lib/types";
import { formatSlotRange } from "@/lib/scheduling";
import RespondButtons from "./RespondButtons";
import ScheduleCalendar from "./ScheduleCalendar";
import ConfirmComplete from "./ConfirmComplete";
import PayInvoice from "./PayInvoice";
import PayDeposit from "./PayDeposit";

// Public customer-facing page for the full job lifecycle, keyed by
// unguessable share token. Uses the service-role client — RLS does not
// apply here by design.
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

  // Load the job; quotes accepted before the jobs table existed get one
  // backfilled here.
  let job: Job | null = null;
  if (quote.status === "accepted") {
    const { data: jobData } = await supabase
      .from("jobs")
      .select("*")
      .eq("quote_id", quote.id)
      .maybeSingle();
    job = (jobData as Job) ?? null;
    if (!job) {
      const { data: created } = await supabase
        .from("jobs")
        .upsert(
          { quote_id: quote.id, contractor_id: quote.contractor_id },
          { onConflict: "quote_id", ignoreDuplicates: false }
        )
        .select("*")
        .single();
      job = (created as Job) ?? null;
    }
  }

  let invoice: Invoice | null = null;
  if (job && ["invoiced", "paid", "confirmed"].includes(job.status)) {
    const { data: invData } = await supabase
      .from("invoices")
      .select("*")
      .eq("job_id", job.id)
      .maybeSingle();
    invoice = (invData as Invoice) ?? null;
  }

  const businessName = contractor.business_name || "Your contractor";

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-zinc-50 px-4 py-8">
      <header className="text-center">
        {contractor.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contractor.logo_url}
            alt={businessName}
            className="mx-auto mb-3 h-12 max-w-40 object-contain"
          />
        )}
        <p className="text-xs uppercase tracking-widest text-zinc-400">
          {invoice ? "Invoice from" : "Quote from"}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">
          {businessName}
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

        {quote.assumptions.length > 0 && !invoice && (
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

      <section className="mt-6 space-y-4">
        {quote.status === "declined" && (
          <div className="rounded-2xl bg-red-50 p-5 text-center font-semibold text-red-800 ring-1 ring-red-200">
            You declined this quote.
          </div>
        )}

        {quote.status !== "declined" && quote.status !== "accepted" && (
          <RespondButtons token={token} />
        )}

        {job?.status === "unscheduled" &&
          (Number(job.deposit_amount) > 0 && !job.deposit_paid_at ? (
            <>
              <div className="rounded-2xl bg-amber-50 p-4 text-center text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
                ✓ Quote accepted — a{" "}
                {formatMoney(Number(job.deposit_amount))} deposit books your
                spot.
              </div>
              <PayDeposit
                token={token}
                amount={formatMoney(Number(job.deposit_amount))}
              />
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
                ✓ Quote accepted — now pick a time that works for you.
              </div>
              {job.deposit_paid_at && (
                <p className="text-center text-xs text-zinc-500">
                  Deposit paid ✓ {formatMoney(Number(job.deposit_amount))} ·
                  Ref {job.deposit_ref}
                </p>
              )}
              <ScheduleCalendar token={token} />
            </>
          ))}

        {job?.status === "scheduled" && job.scheduled_start && (
          <div className="rounded-2xl bg-sky-50 p-5 text-center ring-1 ring-sky-200">
            <p className="text-sm font-medium text-sky-700">
              📅 Work scheduled
            </p>
            <p className="mt-1 text-lg font-bold text-sky-900">
              {formatSlotRange(job.scheduled_start, job.scheduled_end!)}
            </p>
            <p className="mt-1 text-xs text-sky-700">
              {businessName} will see you then.
            </p>
          </div>
        )}

        {job?.status === "done_reported" && (
          <ConfirmComplete token={token} businessName={businessName} />
        )}

        {invoice && (
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">
                  Invoice
                </p>
                <p className="font-bold text-zinc-900">{invoice.number}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                  invoice.status === "paid"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {invoice.status}
              </span>
            </div>
            <div className="mt-3 flex justify-between text-sm text-zinc-500">
              <span>Issued {new Date(invoice.issued_at).toLocaleDateString()}</span>
              <span>Due {new Date(invoice.due_at).toLocaleDateString()}</span>
            </div>
            {(Number(invoice.deposit_applied) > 0 ||
              Number(invoice.change_orders_total) > 0) && (
              <div className="mt-2 space-y-0.5 border-t border-zinc-100 pt-2 text-sm text-zinc-500">
                <div className="flex justify-between">
                  <span>Quote total</span>
                  <span>{formatMoney(Number(quote.total))}</span>
                </div>
                {Number(invoice.change_orders_total) > 0 && (
                  <div className="flex justify-between">
                    <span>+ Approved changes</span>
                    <span>
                      {formatMoney(Number(invoice.change_orders_total))}
                    </span>
                  </div>
                )}
                {Number(invoice.deposit_applied) > 0 && (
                  <div className="flex justify-between">
                    <span>− Deposit paid</span>
                    <span>
                      −{formatMoney(Number(invoice.deposit_applied))}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-zinc-100 pt-2 text-lg font-bold text-zinc-900">
              <span>Amount due</span>
              <span>
                {invoice.status === "paid" ? "$0.00" : formatMoney(Number(invoice.total))}
              </span>
            </div>
            {invoice.status === "paid" && (
              <p className="mt-1 text-xs text-zinc-400">
                Paid {invoice.paid_at ? new Date(invoice.paid_at).toLocaleString() : ""} · Ref{" "}
                {invoice.payment_ref}
              </p>
            )}
          </div>
        )}

        {job?.status === "invoiced" && invoice && (
          <PayInvoice token={token} total={formatMoney(Number(invoice.total))} />
        )}

        {job?.status === "paid" && (
          <div className="rounded-2xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-200">
            <p className="text-2xl">🎉</p>
            <p className="mt-1 font-bold text-emerald-900">
              Payment received — thank you!
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              {businessName} appreciates your business.
            </p>
          </div>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-zinc-400">
        <a
          href="/?utm_source=quote_footer"
          className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-600"
        >
          ⚡ Powered by QuoteMagic — send quotes like this in minutes
        </a>
      </p>
    </main>
  );
}
