import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, syncStripeSubscription } from "@/lib/billing";

// Every event is just a signal to re-sync the customer's live subscription
// state from Stripe (see syncStripeSubscription) — duplicates and
// out-of-order deliveries are harmless by construction.
const HANDLED = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
]);

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || secret.includes("REPLACE") || !signature) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 });
  }

  // request.text() preserves the exact raw payload for signature verification.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      body,
      signature,
      secret
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (HANDLED.has(event.type)) {
    // All four handled events carry `customer` on the payload object.
    const obj = event.data.object as {
      customer?: string | { id: string } | null;
    };
    const customerId =
      typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
    if (customerId) {
      try {
        await syncStripeSubscription(customerId);
      } catch (err) {
        console.error("stripe webhook sync failed", event.type, err);
        // 500 → Stripe retries with backoff
        return NextResponse.json({ error: "Sync failed" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
