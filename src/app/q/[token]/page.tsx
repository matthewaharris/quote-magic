import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import {
  formatDuration,
  formatMoney,
  type ChangeOrder,
  type Contractor,
  type Invoice,
  type Job,
  type Quote,
  type QuoteLineItem,
} from "@/lib/types";
import { formatSlotRange } from "@/lib/scheduling";
import { paymentsMode } from "@/lib/payments";
import PrintButton from "@/components/PrintButton";
import HowToPay from "./HowToPay";
import ChangeOrderRespond from "./ChangeOrderRespond";
import RespondButtons from "./RespondButtons";
import ScheduleCalendar from "./ScheduleCalendar";
import RescheduleSection from "./RescheduleSection";
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

  // Good/better/best: fetch siblings for the tier switcher. If a different
  // tier was accepted, the lifecycle continues there — stale links self-heal.
  let tierSiblings: Pick<Quote, "id" | "tier" | "total" | "share_token" | "status">[] = [];
  if (quote.tier_group_id) {
    const { data: sibData } = await supabase
      .from("quotes")
      .select("id, tier, total, share_token, status")
      .eq("tier_group_id", quote.tier_group_id);
    tierSiblings = (sibData ?? []) as typeof tierSiblings;
    const acceptedSibling = tierSiblings.find(
      (s) => s.status === "accepted" && s.id !== quote.id
    );
    if (acceptedSibling) redirect(`/q/${acceptedSibling.share_token}`);
    const order = { good: 0, better: 1, best: 2 } as const;
    tierSiblings.sort(
      (a, b) => order[a.tier ?? "better"] - order[b.tier ?? "better"]
    );
  }
  const showTierSwitcher =
    tierSiblings.length > 1 && quote.status !== "accepted" && quote.status !== "declined";

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

  let changeOrders: ChangeOrder[] = [];
  if (job) {
    const { data: coData } = await supabase
      .from("change_orders")
      .select("*")
      .eq("quote_id", quote.id)
      .order("created_at");
    changeOrders = (coData ?? []) as ChangeOrder[];
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
  const payMode = paymentsMode();

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

      {showTierSwitcher && (
        <div className="print-hide mt-6 grid grid-cols-3 gap-1.5 text-center text-xs font-medium">
          {tierSiblings.map((s) =>
            s.id === quote.id ? (
              <span
                key={s.id}
                className="rounded-xl bg-amber-600 px-2 py-2 capitalize text-white"
              >
                {s.tier}
                <span className="block text-[11px] font-normal opacity-90">
                  {formatMoney(Number(s.total))}
                </span>
              </span>
            ) : (
              <a
                key={s.id}
                href={`/q/${s.share_token}`}
                className="rounded-xl bg-white px-2 py-2 capitalize text-zinc-600 ring-1 ring-zinc-200"
              >
                {s.tier}
                <span className="block text-[11px] font-normal opacity-75">
                  {formatMoney(Number(s.total))}
                </span>
              </a>
            )
          )}
        </div>
      )}

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

      <div className="print-hide mt-4">
        <PrintButton />
      </div>

      {changeOrders.length > 0 && (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Changes to this job
          </h2>
          <ul className="mt-2 space-y-3">
            {changeOrders.map((co) => (
              <li key={co.id} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                <div className="flex justify-between gap-3">
                  <span
                    className={`font-medium ${co.status === "declined" ? "text-zinc-400 line-through" : "text-zinc-800"}`}
                  >
                    {co.title}
                  </span>
                  <span className="shrink-0 font-medium text-zinc-800">
                    {formatMoney(Number(co.amount))}
                  </span>
                </div>
                {co.description && (
                  <p className="mt-0.5 text-xs text-zinc-500">{co.description}</p>
                )}
                {co.status === "pending" ? (
                  !invoice && (
                    <div className="print-hide">
                      <ChangeOrderRespond token={token} changeOrderId={co.id} />
                    </div>
                  )
                ) : (
                  <p
                    className={`mt-1 text-xs font-medium ${co.status === "approved" ? "text-emerald-700" : "text-zinc-400"}`}
                  >
                    {co.status === "approved" ? "Approved ✓" : "Declined"}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 space-y-4">
        {quote.status === "declined" && (
          <div className="rounded-2xl bg-red-50 p-5 text-center font-semibold text-red-800 ring-1 ring-red-200">
            You declined this quote.
          </div>
        )}

        {quote.status !== "declined" && quote.status !== "accepted" && (
          <div className="print-hide">
            <RespondButtons token={token} />
          </div>
        )}

        {job?.status === "unscheduled" &&
          (Number(job.deposit_amount) > 0 && !job.deposit_paid_at ? (
            <>
              <div className="rounded-2xl bg-amber-50 p-4 text-center text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
                ✓ Quote accepted — a{" "}
                {formatMoney(Number(job.deposit_amount))} deposit books your
                spot.
              </div>
              <div className="print-hide">
                {payMode === "demo" ? (
                  <PayDeposit
                    token={token}
                    amount={formatMoney(Number(job.deposit_amount))}
                  />
                ) : (
                  <HowToPay
                    heading="How to pay your deposit"
                    amount={formatMoney(Number(job.deposit_amount))}
                    instructions={contractor.payment_instructions}
                    businessName={businessName}
                    phone={contractor.phone}
                    note={`Once ${businessName} confirms your deposit, you'll pick your appointment time right here.`}
                  />
                )}
              </div>
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
              <div className="print-hide">
                <ScheduleCalendar token={token} />
              </div>
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
            <a
              href={`/api/q/${token}/calendar.ics`}
              className="print-hide mt-3 inline-block rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-800"
            >
              📅 Add to calendar
            </a>
            {new Date(job.scheduled_start) > new Date() && (
              <div className="print-hide">
                <RescheduleSection token={token} />
              </div>
            )}
          </div>
        )}

        {job?.status === "done_reported" && (
          <div className="print-hide">
            <ConfirmComplete token={token} businessName={businessName} />
          </div>
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
          <div className="print-hide">
            {payMode === "demo" ? (
              <PayInvoice
                token={token}
                total={formatMoney(Number(invoice.total))}
              />
            ) : (
              <HowToPay
                heading="How to pay"
                amount={formatMoney(Number(invoice.total))}
                instructions={contractor.payment_instructions}
                businessName={businessName}
                phone={contractor.phone}
                note={`${businessName} will mark invoice ${invoice.number} paid once your payment arrives.`}
              />
            )}
          </div>
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

      <p className="print-hide mt-8 text-center text-xs text-zinc-400">
        <a
          href="/?utm_source=quote_footer"
          className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-600"
        >
          ⚡ Powered by QuoteMagic — send quotes like this in minutes
        </a>
      </p>
      <p className="print-hide mt-2 text-center text-[11px] text-zinc-400">
        © 2026 Stait AI LLC ·{" "}
        <a href="/terms" className="underline underline-offset-2">
          Terms
        </a>{" "}
        ·{" "}
        <a href="/privacy" className="underline underline-offset-2">
          Privacy
        </a>
      </p>
    </main>
  );
}
