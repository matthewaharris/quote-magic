import Link from "next/link";
import { requireContractor } from "@/lib/contractor";
import { createAdminClient } from "@/lib/supabase/server";
import {
  PLANS,
  getStripe,
  getUsageStatus,
  stripeConfigured,
  syncStripeSubscription,
} from "@/lib/billing";
import type { Contractor, PlanTier } from "@/lib/types";
import { openPortal, startCheckout } from "./actions";

export const metadata = { title: "Plan & billing — QuoteMagic" };

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const subscribeButton =
  "block w-full rounded-xl bg-amber-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-amber-700";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { supabase, contractor: initial } = await requireContractor();
  const { session_id } = await searchParams;

  // Sync-on-success: returning from Stripe Checkout, pull live subscription
  // state directly instead of racing the webhook.
  let contractor: Contractor = initial;
  if (session_id && stripeConfigured() && initial.stripe_customer_id) {
    try {
      await syncStripeSubscription(initial.stripe_customer_id);
    } catch (err) {
      console.error("billing: sync-on-success failed", err);
    }
    const { data } = await createAdminClient()
      .from("contractors")
      .select("*")
      .eq("id", initial.id)
      .single();
    if (data) contractor = data as Contractor;
  }

  const usage = await getUsageStatus(supabase, contractor);

  // Renewal/cancellation details come live from Stripe, never the DB.
  let periodEnd: Date | null = null;
  let cancelAtPeriodEnd = false;
  if (contractor.stripe_subscription_id && stripeConfigured()) {
    try {
      const sub = await getStripe().subscriptions.retrieve(
        contractor.stripe_subscription_id
      );
      const item = sub.items.data[0];
      if (item) periodEnd = new Date(item.current_period_end * 1000);
      cancelAtPeriodEnd = sub.cancel_at_period_end;
    } catch (err) {
      console.error("billing: subscription retrieve failed", err);
    }
  }

  const subscribed =
    contractor.plan === "paid" && !!contractor.stripe_subscription_id;
  const tiers = Object.entries(PLANS) as [PlanTier, (typeof PLANS)[PlanTier]][];

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">Plan & billing</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Your subscription and monthly quote allowance.
      </p>

      {session_id && subscribed && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          🎉 You&apos;re subscribed — welcome aboard!
        </div>
      )}

      {/* Current plan card */}
      <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        {usage.kind === "unlimited" && contractor.plan === "comp" && (
          <>
            <p className="font-semibold text-zinc-900">Complimentary account</p>
            <p className="mt-1 text-sm text-zinc-500">
              Unlimited quotes, on the house.
            </p>
          </>
        )}
        {usage.kind === "unlimited" && contractor.plan !== "comp" && (
          <>
            <p className="font-semibold text-zinc-900">Paid account</p>
            <p className="mt-1 text-sm text-zinc-500">Unlimited quotes.</p>
          </>
        )}
        {usage.kind === "trial" && (
          <>
            <p className="font-semibold text-zinc-900">Free trial</p>
            <p className="mt-1 text-sm text-zinc-500">
              {usage.expired ? (
                <>Your trial has ended — subscribe below to keep quoting.</>
              ) : (
                <>
                  {usage.quotesRemaining}{" "}
                  {usage.quotesRemaining === 1 ? "quote" : "quotes"} and{" "}
                  {usage.daysLeft} {usage.daysLeft === 1 ? "day" : "days"}{" "}
                  remaining.
                </>
              )}
            </p>
          </>
        )}
        {usage.kind === "paid" && usage.tier && (
          <>
            <div className="flex items-start justify-between">
              <p className="font-semibold text-zinc-900">
                {PLANS[usage.tier].label} plan
              </p>
              <p className="text-sm font-medium text-zinc-700">
                ${PLANS[usage.tier].priceUsd}/mo
              </p>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {usage.quotesUsed} of {PLANS[usage.tier].monthlyQuotes} quotes
              used this period
              {usage.expired && " — you’ve hit this month’s limit"}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${usage.expired ? "bg-red-500" : "bg-amber-500"}`}
                style={{
                  width: `${Math.min(100, Math.round((usage.quotesUsed / PLANS[usage.tier].monthlyQuotes) * 100))}%`,
                }}
              />
            </div>
            {periodEnd && (
              <p className="mt-2 text-xs text-zinc-500">
                {cancelAtPeriodEnd
                  ? `Cancels on ${fmtDate(periodEnd)} — renew anytime from Manage billing.`
                  : `Renews ${fmtDate(periodEnd)}.`}
              </p>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      {subscribed ? (
        <div className="mt-4 space-y-2">
          {usage.tier === "basic" && (
            <p className="text-center text-xs text-zinc-500">
              Want your own branding and AI import? Switch to Solo in Manage
              billing.
            </p>
          )}
          {usage.tier === "solo" && (
            <p className="text-center text-xs text-zinc-500">
              Need more quotes? Switch to Pro (150/mo) in Manage billing.
            </p>
          )}
          <form action={openPortal}>
            <button className={subscribeButton}>Manage billing</button>
          </form>
          <p className="text-center text-xs text-zinc-400">
            Change plan, update your card, see invoices, or cancel — handled
            securely by Stripe.
          </p>
        </div>
      ) : usage.kind === "trial" || usage.kind === "disabled" ? (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            Choose a plan
          </h2>
          <div className="mt-2 space-y-3">
            {tiers.map(([tier, plan]) => (
              <div
                key={tier}
                className={`rounded-2xl bg-white p-4 ring-1 ${tier === "pro" ? "ring-2 ring-amber-500" : "ring-zinc-200"}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-zinc-900">
                      {plan.label}
                      {tier === "pro" && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          Best value
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {plan.monthlyQuotes} AI quotes every month
                    </p>
                  </div>
                  <p className="text-lg font-bold text-zinc-900">
                    ${plan.priceUsd}
                    <span className="text-xs font-normal text-zinc-500">
                      /mo
                    </span>
                  </p>
                </div>
                {stripeConfigured() ? (
                  <form action={startCheckout.bind(null, tier)} className="mt-3">
                    <button className={subscribeButton}>
                      Subscribe to {plan.label}
                    </button>
                  </form>
                ) : (
                  <p className="mt-3 rounded-xl bg-zinc-100 px-4 py-2.5 text-center text-sm text-zinc-500">
                    Billing isn&apos;t configured in this environment yet.
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-zinc-400">
            Cancel anytime. Powered by Stripe — we never see your card number.
          </p>
        </div>
      ) : null}

      <p className="mt-8 text-center text-xs text-zinc-400">
        <Link href="/settings" className="underline underline-offset-2">
          ← Back to settings
        </Link>
      </p>
    </div>
  );
}
