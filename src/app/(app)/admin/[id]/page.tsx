import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { PLANS } from "@/lib/billing";
import {
  formatMoney,
  type Contractor,
  type ContractorPlan,
  type Quote,
} from "@/lib/types";
import {
  compContractor,
  disableContractor,
  extendTrial,
  reenableContractor,
} from "../actions";
import { groupQuotes, type QuoteRow } from "../quoteGroups";
import LoginLinkButton from "./LoginLinkButton";

const planBadge: Record<ContractorPlan, string> = {
  trial: "bg-amber-100 text-amber-700",
  comp: "bg-sky-100 text-sky-700",
  paid: "bg-emerald-100 text-emerald-700",
  disabled: "bg-red-100 text-red-700",
};

const statusBadge: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  sent: "bg-sky-100 text-sky-700",
  viewed: "bg-indigo-100 text-indigo-700",
  accepted: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-700",
};

const actionButton =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminContractorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { contractor: me, admin } = await requireAdmin();
  const { id } = await params;

  const { data: contractorData } = await admin
    .from("contractors")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!contractorData) notFound();
  const c = contractorData as Contractor;

  const { data: quotesData } = await admin
    .from("quotes")
    .select("*")
    .eq("contractor_id", id)
    .order("created_at", { ascending: false });
  const quotes = (quotesData ?? []) as Quote[];

  const { data: eventsData } = await admin
    .from("quote_events")
    .select("type, created_at, quote_id")
    .in(
      "quote_id",
      quotes.map((q) => q.id)
    )
    .order("created_at", { ascending: false })
    .limit(20);
  const groups = groupQuotes(quotes as unknown as QuoteRow[]);
  const sent = groups.filter((g) => g.sent).length;
  const accepted = groups.filter((g) => g.accepted).length;
  const events = (eventsData ?? []) as {
    type: string;
    created_at: string;
    quote_id: string;
  }[];

  // Collapse tier groups in the list: show the accepted tier, else 'better'.
  const visibleQuotes = quotes.filter(
    (q) =>
      !q.tier_group_id ||
      q.status === "accepted" ||
      (q.tier === "better" &&
        !quotes.some(
          (s) => s.tier_group_id === q.tier_group_id && s.status === "accepted"
        ))
  );

  return (
    <div>
      <p className="text-xs">
        <Link href="/admin" className="text-zinc-500 underline-offset-2 hover:underline">
          ← All contractors
        </Link>
      </p>
      <div className="mt-2 flex items-start justify-between gap-2">
        <h1 className="text-xl font-bold text-zinc-900">
          {c.name || c.business_name || c.email || "—"}
          {c.id === me.id && (
            <span className="font-normal text-zinc-400"> (you)</span>
          )}
        </h1>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${planBadge[c.plan]}`}
        >
          {c.plan}
          {c.plan === "paid" && c.plan_tier ? ` · ${c.plan_tier}` : ""}
        </span>
      </div>
      <p className="text-sm text-zinc-500">
        {c.business_name && c.name ? `${c.business_name} · ` : ""}
        {c.trade || "no trade set"} · {c.email}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "quotes", value: groups.length },
          {
            label: "accept rate",
            value: sent > 0 ? `${Math.round((accepted / sent) * 100)}%` : "—",
          },
          {
            label: "won",
            value: accepted,
          },
        ].map((chip) => (
          <div
            key={chip.label}
            className="rounded-xl bg-white p-3 text-center ring-1 ring-zinc-200"
          >
            <p className="text-lg font-bold text-zinc-900">{chip.value}</p>
            <p className="text-[11px] text-zinc-500">{chip.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 text-xs text-zinc-600 ring-1 ring-zinc-200">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <span>Signed up {fmt(c.created_at)}</span>
          <span>{c.onboarded_at ? "Onboarded ✓" : "Not onboarded"}</span>
          <span>Phone {c.phone || "—"}</span>
          <span>Rate ${Number(c.hourly_rate)}/hr</span>
          {c.plan === "trial" && (
            <span>
              Trial ends {fmt(c.trial_ends_at)} · limit {c.trial_quote_limit}
            </span>
          )}
          {c.plan === "paid" && c.plan_tier && (
            <span>
              {PLANS[c.plan_tier].label} ${PLANS[c.plan_tier].priceUsd}/mo ·{" "}
              {PLANS[c.plan_tier].monthlyQuotes} q/mo
            </span>
          )}
          {c.billing_period_start && (
            <span>Period started {fmt(c.billing_period_start)}</span>
          )}
        </div>
        {c.stripe_customer_id && (
          <p className="mt-2 border-t border-zinc-100 pt-2">
            Stripe:{" "}
            <a
              href={`https://dashboard.stripe.com/customers/${c.stripe_customer_id}`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {c.stripe_customer_id}
            </a>
            {c.stripe_subscription_id && <> · sub {c.stripe_subscription_id}</>}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {c.plan !== "comp" && (
          <form action={compContractor.bind(null, c.id)}>
            <button className={actionButton}>Comp</button>
          </form>
        )}
        {c.plan === "trial" && (
          <form action={extendTrial.bind(null, c.id)}>
            <button className={actionButton}>Extend +14d/+25</button>
          </form>
        )}
        {c.plan !== "disabled" && c.id !== me.id && (
          <form action={disableContractor.bind(null, c.id)}>
            <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
              Disable
            </button>
          </form>
        )}
        {c.plan === "disabled" && (
          <form action={reenableContractor.bind(null, c.id)}>
            <button className={actionButton}>Re-enable</button>
          </form>
        )}
      </div>

      <LoginLinkButton contractorId={c.id} />

      <h2 className="mt-6 text-sm font-semibold text-zinc-900">
        Quotes ({groups.length})
      </h2>
      {visibleQuotes.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No quotes yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {visibleQuotes.map((q) => (
            <li
              key={q.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-zinc-200"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {q.title || "Untitled quote"}
                  {q.tier_group_id && (
                    <span className="ml-1 text-xs font-normal text-zinc-400">
                      (3 options)
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  {fmt(q.created_at)} · {formatMoney(Number(q.total))}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge[q.status] ?? "bg-zinc-100 text-zinc-600"}`}
              >
                {q.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-sm font-semibold text-zinc-900">
        Recent activity
      </h2>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No events yet.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs text-zinc-600">
          {events.map((e, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>{e.type.replaceAll("_", " ")}</span>
              <span className="text-zinc-400">{fmt(e.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
