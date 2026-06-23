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

// statementDescriptor is what shows on the customer's card statement (5-22
// chars, must contain a letter, no < > \ ' " *). Per-product so each app
// under this Stait AI LLC account bills under its own brand instead of the
// account default ("STAIT AI LLC").
const TIERS = [
  { lookupKey: "basic", name: "QuoteMagic Basic", amountCents: 900, quotes: 10, statementDescriptor: "QUOTEMAGICBASIC" },
  { lookupKey: "solo", name: "QuoteMagic Solo", amountCents: 2900, quotes: 30, statementDescriptor: "QUOTEMAGICSOLO" },
  { lookupKey: "pro", name: "QuoteMagic Pro", amountCents: 5900, quotes: 150, statementDescriptor: "QUOTEMAGICPRO" },
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
    // Self-heal: bring the live product's statement descriptor back in line
    // with the code if it drifted (or was never set on an older product).
    const product = price.product;
    if (product.statement_descriptor !== tier.statementDescriptor) {
      await stripe.products.update(product.id, {
        statement_descriptor: tier.statementDescriptor,
      });
      console.log(
        `  ↻ set statement descriptor '${tier.statementDescriptor}' on ${product.id}` +
          ` (was ${product.statement_descriptor ?? "account default"})`
      );
    }
  } else {
    const product = await stripe.products.create({
      name: tier.name,
      metadata: { quotemagic_tier: tier.lookupKey },
      description: `${tier.quotes} AI quotes per month`,
      statement_descriptor: tier.statementDescriptor,
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
// Build the switchable-products list from the current TIERS every run, so the
// portal self-heals when a tier is added (e.g. Basic) — same pattern as the
// statement descriptors above. Stripe's update replaces the product list, so
// passing the full set keeps every tier switchable in both directions.
const portalPrices = await Promise.all(
  TIERS.map(async (t) => {
    const p = await stripe.prices.list({
      lookup_keys: [t.lookupKey],
      expand: ["data.product"],
    });
    return p.data[0];
  })
);
const portalFeatures = {
  payment_method_update: { enabled: true },
  invoice_history: { enabled: true },
  customer_update: { enabled: true, allowed_updates: ["email", "address"] },
  subscription_cancel: { enabled: true, mode: "at_period_end" },
  subscription_update: {
    enabled: true,
    default_allowed_updates: ["price"],
    proration_behavior: "create_prorations",
    products: portalPrices.map((price) => ({
      product:
        typeof price.product === "string" ? price.product : price.product.id,
      prices: [price.id],
    })),
  },
};

const configs = await stripe.billingPortal.configurations.list({ limit: 100 });
let portal = configs.data.find((c) => c.metadata?.quotemagic === "1");
if (portal) {
  portal = await stripe.billingPortal.configurations.update(portal.id, {
    features: portalFeatures,
  });
  console.log(
    `↻ portal configuration synced: ${portal.id} (${TIERS.length} tiers switchable)`
  );
} else {
  portal = await stripe.billingPortal.configurations.create({
    business_profile: {
      privacy_policy_url: "https://quotemagic.app/privacy",
      terms_of_service_url: "https://quotemagic.app/terms",
    },
    features: portalFeatures,
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
