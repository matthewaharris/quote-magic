"use server";

import { redirect } from "next/navigation";
import { requireContractor } from "@/lib/contractor";
import { createAdminClient } from "@/lib/supabase/server";
import { getStripe, planPriceId } from "@/lib/billing";
import type { PlanTier } from "@/lib/types";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

// Stripe writes (stripe_customer_id) go through the admin client — the
// column is locked against user-scoped writes like all billing columns.
async function findOrCreateCustomer(): Promise<string> {
  const { contractor } = await requireContractor();
  if (contractor.stripe_customer_id) return contractor.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: contractor.email ?? undefined,
    name: contractor.business_name || contractor.name || undefined,
    metadata: { contractor_id: contractor.id },
  });

  // Conditional write guards a double-submit race: only claim the slot if
  // still empty, otherwise use whoever won (the loser is an orphaned Stripe
  // customer with no subscription — harmless).
  const admin = createAdminClient();
  await admin
    .from("contractors")
    .update({ stripe_customer_id: customer.id })
    .eq("id", contractor.id)
    .is("stripe_customer_id", null);
  const { data } = await admin
    .from("contractors")
    .select("stripe_customer_id")
    .eq("id", contractor.id)
    .single();
  return data?.stripe_customer_id ?? customer.id;
}

export async function startCheckout(tier: PlanTier): Promise<void> {
  const { contractor } = await requireContractor();
  // Already subscribed → plan changes happen in the Stripe portal instead.
  if (contractor.plan === "paid" && contractor.stripe_subscription_id) {
    redirect("/settings/billing");
  }

  const customerId = await findOrCreateCustomer();
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: planPriceId(tier), quantity: 1 }],
    subscription_data: { metadata: { contractor_id: contractor.id } },
    client_reference_id: contractor.id,
    allow_promotion_codes: true,
    success_url: `${appUrl()}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/settings/billing`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  redirect(session.url); // NEXT_REDIRECT throw — must not be inside try/catch
}

export async function openPortal(): Promise<void> {
  const { contractor } = await requireContractor();
  if (!contractor.stripe_customer_id) redirect("/settings/billing");

  const configId = process.env.STRIPE_PORTAL_CONFIG_ID;
  const session = await getStripe().billingPortal.sessions.create({
    customer: contractor.stripe_customer_id!,
    return_url: `${appUrl()}/settings/billing`,
    ...(configId && !configId.includes("REPLACE")
      ? { configuration: configId }
      : {}),
  });
  redirect(session.url);
}
