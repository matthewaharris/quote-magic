// One-time Stripe bootstrap (idempotent — safe to re-run).
// Creates the Solo/Pro products + monthly prices (lookup_keys solo/pro),
// a Billing Portal configuration that allows switching between the two,
// and (with --prod) the production webhook endpoint.
//
//   node --env-file=.env.local scripts/stripe-setup.mjs
//   node --env-file=.env.local scripts/stripe-setup.mjs --prod
//
// Prints the env values to paste into .env.local / Vercel.

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key || key.includes("REPLACE")) {
  console.error(
    "STRIPE_SECRET_KEY is not set in .env.local.\n" +
      "Dashboard → Developers → API keys → copy the Secret key (sk_test_...)."
  );
  process.exit(1);
}
const stripe = new Stripe(key);
const prod = process.argv.includes("--prod");

const TIERS = [
  { lookupKey: "solo", name: "QuoteMagic Solo", amountCents: 2900, quotes: 30 },
  { lookupKey: "pro", name: "QuoteMagic Pro", amountCents: 5900, quotes: 150 },
];

const out = {};

// --- Products + prices (lookup_key is the idempotency handle) ---------------
const existing = await stripe.prices.list({
  lookup_keys: TIERS.map((t) => t.lookupKey),
  expand: ["data.product"],
});

for (const tier of TIERS) {
  let price = existing.data.find((p) => p.lookup_key === tier.lookupKey);
  if (price) {
    console.log(`✓ price '${tier.lookupKey}' exists: ${price.id}`);
  } else {
    const product = await stripe.products.create({
      name: tier.name,
      metadata: { quotemagic_tier: tier.lookupKey },
      description: `${tier.quotes} AI quotes per month`,
    });
    price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: tier.amountCents,
      recurring: { interval: "month" },
      lookup_key: tier.lookupKey,
      metadata: { quotemagic_tier: tier.lookupKey },
    });
    console.log(`+ created product+price '${tier.lookupKey}': ${price.id}`);
  }
  out[`STRIPE_PRICE_${tier.lookupKey.toUpperCase()}`] = price.id;
}

// --- Billing Portal configuration (find by metadata marker) -----------------
const configs = await stripe.billingPortal.configurations.list({ limit: 100 });
let portal = configs.data.find((c) => c.metadata?.quotemagic === "1");
if (portal) {
  console.log(`✓ portal configuration exists: ${portal.id}`);
} else {
  const priceIds = Object.fromEntries(
    await Promise.all(
      TIERS.map(async (t) => {
        const p = await stripe.prices.list({ lookup_keys: [t.lookupKey] });
        return [t.lookupKey, p.data[0]];
      })
    )
  );
  portal = await stripe.billingPortal.configurations.create({
    business_profile: {
      privacy_policy_url: "https://quotemagic.app/privacy",
      terms_of_service_url: "https://quotemagic.app/terms",
    },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "address"] },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: Object.values(priceIds).map((price) => ({
          product:
            typeof price.product === "string" ? price.product : price.product.id,
          prices: [price.id],
        })),
      },
    },
    metadata: { quotemagic: "1" },
  });
  console.log(`+ created portal configuration: ${portal.id}`);
}
out.STRIPE_PORTAL_CONFIG_ID = portal.id;

// --- Production webhook endpoint (only with --prod) --------------------------
if (prod) {
  const url = "https://quotemagic.app/api/stripe/webhook";
  const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
  let hook = hooks.data.find((h) => h.url === url);
  if (hook) {
    console.log(`✓ webhook endpoint exists: ${hook.id} (secret only shown at creation —`);
    console.log(`  find it in Dashboard → Webhooks if you need it again)`);
  } else {
    hook = await stripe.webhookEndpoints.create({
      url,
      enabled_events: [
        "checkout.session.completed",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.paid",
      ],
    });
    console.log(`+ created webhook endpoint: ${hook.id}`);
    out.STRIPE_WEBHOOK_SECRET = hook.secret;
  }
}

console.log("\nPaste into .env.local" + (prod ? " / Vercel env" : "") + ":\n");
for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
if (!prod) {
  console.log(
    "\nFor local webhook testing, STRIPE_WEBHOOK_SECRET comes from:\n" +
      "  stripe listen --forward-to localhost:3000/api/stripe/webhook"
  );
}
