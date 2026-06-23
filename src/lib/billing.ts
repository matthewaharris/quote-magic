import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { getTrialStatus } from "@/lib/trial";
import type { Contractor, PlanTier } from "@/lib/types";

export const PLANS: Record<
  PlanTier,
  { label: string; priceUsd: number; monthlyQuotes: number; priceIdEnv: string }
> = {
  basic: {
    label: "Basic",
    priceUsd: 9,
    monthlyQuotes: 10,
    priceIdEnv: "STRIPE_PRICE_BASIC",
  },
  solo: {
    label: "Solo",
    priceUsd: 29,
    monthlyQuotes: 30,
    priceIdEnv: "STRIPE_PRICE_SOLO",
  },
  pro: {
    label: "Pro",
    priceUsd: 59,
    monthlyQuotes: 150,
    priceIdEnv: "STRIPE_PRICE_PRO",
  },
};

export function planPriceId(tier: PlanTier): string {
  const id = process.env[PLANS[tier].priceIdEnv];
  if (!id || id.includes("REPLACE")) {
    throw new Error(
      `${PLANS[tier].priceIdEnv} is not set — run scripts/stripe-setup.mjs`
    );
  }
  return id;
}

// No apiVersion arg: the SDK pins its bundled version and the TS types match it.
let stripeSingleton: Stripe | null = null;
export function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.includes("REPLACE")) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

export function stripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return !!key && !key.includes("REPLACE");
}

export interface UsageStatus {
  kind: "trial" | "paid" | "unlimited" | "disabled";
  expired: boolean;
  quotesUsed: number;
  quotesRemaining: number;
  daysLeft: number;
  tier: PlanTier | null;
}

// Superset of getTrialStatus: trials keep their existing day+count limits,
// paid plans get a per-billing-period quote quota, comp is unlimited.
// plan='paid' with missing Stripe fields (admin-set by hand) means unlimited —
// never block a contractor because of our own bookkeeping.
export async function getUsageStatus(
  supabase: SupabaseClient,
  contractor: Contractor
): Promise<UsageStatus> {
  if (contractor.plan === "disabled") {
    return {
      kind: "disabled",
      expired: true,
      quotesUsed: 0,
      quotesRemaining: 0,
      daysLeft: 0,
      tier: null,
    };
  }
  if (contractor.plan === "trial") {
    const t = await getTrialStatus(supabase, contractor);
    return {
      kind: "trial",
      expired: t.expired,
      quotesUsed: t.quotesUsed,
      quotesRemaining: t.quotesRemaining,
      daysLeft: t.daysLeft,
      tier: null,
    };
  }
  if (
    contractor.plan === "paid" &&
    contractor.plan_tier &&
    contractor.billing_period_start
  ) {
    const limit = PLANS[contractor.plan_tier].monthlyQuotes;
    // Same counting rule as the trial: a good/better/best generation creates
    // 3 rows but counts as ONE quote (every tier group has one 'better' row).
    const { count } = await supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("contractor_id", contractor.id)
      .gte("created_at", contractor.billing_period_start)
      .or("tier_group_id.is.null,tier.eq.better");
    const quotesUsed = count ?? 0;
    return {
      kind: "paid",
      expired: quotesUsed >= limit,
      quotesUsed,
      quotesRemaining: Math.max(0, limit - quotesUsed),
      daysLeft: Infinity,
      tier: contractor.plan_tier,
    };
  }
  // comp, or paid without Stripe bookkeeping
  return {
    kind: "unlimited",
    expired: false,
    quotesUsed: 0,
    quotesRemaining: Infinity,
    daysLeft: Infinity,
    tier: contractor.plan_tier,
  };
}

const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

// Single source of truth for subscription state. Every webhook event and the
// checkout success page funnel through here: re-fetch the live subscription
// from Stripe and write derived state, so duplicate or out-of-order webhook
// deliveries can't corrupt anything. `plan` is never touched for comp/disabled
// contractors — admin decisions win over billing events.
export async function syncStripeSubscription(
  stripeCustomerId: string
): Promise<void> {
  const admin = createAdminClient();
  const { data: contractor } = await admin
    .from("contractors")
    .select("id, plan")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  if (!contractor) return; // unknown customer — nothing to sync

  const stripe = getStripe();
  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 10,
  });
  const sub = subs.data.find((s) => PAID_STATUSES.has(s.status)) ?? null;
  const adminOwned =
    contractor.plan === "comp" || contractor.plan === "disabled";

  if (sub) {
    // Periods live on subscription ITEMS under current Stripe API versions.
    const item = sub.items.data[0];
    const lookup = item?.price.lookup_key;
    const tier: PlanTier | null =
      lookup === "basic" || lookup === "solo" || lookup === "pro"
        ? lookup
        : null;
    await admin
      .from("contractors")
      .update({
        plan_tier: tier,
        stripe_subscription_id: sub.id,
        billing_period_start: item
          ? new Date(item.current_period_start * 1000).toISOString()
          : null,
        ...(adminOwned ? {} : { plan: "paid" }),
      })
      .eq("id", contractor.id);
  } else {
    // No live subscription: back to trial. trial_ends_at is almost certainly
    // in the past, so the gates close naturally; stripe_customer_id stays so
    // they can re-subscribe.
    await admin
      .from("contractors")
      .update({
        plan_tier: null,
        stripe_subscription_id: null,
        billing_period_start: null,
        ...(adminOwned ? {} : { plan: "trial" }),
      })
      .eq("id", contractor.id);
  }
}
