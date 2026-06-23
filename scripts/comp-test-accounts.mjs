// Create (or update) one test account per paid SKU and "comp" it at that tier:
// plan='paid' + plan_tier=<tier>, no Stripe sub and no billing period, so each
// account gets exactly that tier's FEATURE GATES with unlimited quotes (no
// charge, no quota friction). plan='comp' would NOT work here — the capability
// system treats comp as full Pro, so it can't show the Basic/Solo experience.
//
// Uses Gmail plus-addressing so all three land in one inbox. Prints a
// production-safe one-click sign-in link for each (no email needed).
//
//   node --env-file=.env.local scripts/comp-test-accounts.mjs [base-email]
//
// base-email defaults to mharris26@gmail.com → +basic/+solo/+pro variants.
import { createClient } from "@supabase/supabase-js";

const baseEmail = process.argv[2] ?? "mharris26@gmail.com";
const [local, domain] = baseEmail.split("@");
if (!domain) {
  console.error("Usage: node ... comp-test-accounts.mjs you@gmail.com");
  process.exit(1);
}

const TIERS = [
  { tier: "basic", name: "Test Basic", business: "Basic Test Co." },
  { tier: "solo", name: "Test Solo", business: "Solo Test Co." },
  { tier: "pro", name: "Test Pro", business: "Pro Test Co." },
];

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://quotemagic.app";

for (const t of TIERS) {
  const email = `${local}+${t.tier}@${domain}`;

  // Ensure the auth user exists (ignore "already registered").
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createErr && !/already/i.test(createErr.message)) {
    console.error(`createUser ${email} failed:`, createErr.message);
    continue;
  }

  // generateLink returns the user (id) and a single-use token in one call.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !link?.user) {
    console.error(`generateLink ${email} failed:`, linkErr?.message);
    continue;
  }

  // Comp at the SKU: paid + tier, onboarded, no stripe sub / billing period.
  const { error: upErr } = await admin.from("contractors").upsert(
    {
      auth_user_id: link.user.id,
      email,
      name: t.name,
      business_name: t.business,
      trade: "handyman",
      onboarded_at: new Date().toISOString(),
      plan: "paid",
      plan_tier: t.tier,
      stripe_subscription_id: null,
      billing_period_start: null,
    },
    { onConflict: "auth_user_id" }
  );
  if (upErr) {
    console.error(`contractor upsert ${email} failed:`, upErr.message);
    continue;
  }

  const url = `${base}/api/admin/login?token_hash=${encodeURIComponent(
    link.properties.hashed_token
  )}`;
  console.log(`\n${t.tier.toUpperCase()}  ${email}`);
  console.log(`  ${url}`);
}

console.log(
  "\nOpen each link in a separate browser profile (or incognito window) to" +
    " stay signed into all three at once. Load the demo price book from each" +
    " account's Price Book page to start quoting."
);
