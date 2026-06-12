// DEV ONLY: verifies the 0004 column-privilege lockdown — a signed-in
// contractor must NOT be able to change plan / trial_ends_at / is_admin /
// trial_quote_limit on their own row, but normal profile columns must work.
// Usage: node --env-file=.env.local scripts/security-check.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TEST_EMAIL = process.argv[2] ?? "security-check@quotemagic.test";

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Ensure the dedicated test user + contractor row exist.
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: TEST_EMAIL,
  email_confirm: true,
});
let userId = created?.user?.id;
if (createErr) {
  if (!/already.*(registered|exists)/i.test(createErr.message)) {
    console.error("createUser failed:", createErr.message);
    process.exit(1);
  }
  const { data: byEmail } = await admin
    .from("contractors")
    .select("auth_user_id")
    .eq("email", TEST_EMAIL)
    .maybeSingle();
  userId = byEmail?.auth_user_id;
  if (!userId) {
    // user exists in auth but has no contractor row; find via admin API
    const { data: list } = await admin.auth.admin.listUsers();
    userId = list?.users?.find((u) => u.email === TEST_EMAIL)?.id;
  }
}
if (!userId) {
  console.error("Could not resolve test user id");
  process.exit(1);
}
await admin
  .from("contractors")
  .upsert({ auth_user_id: userId, email: TEST_EMAIL }, { onConflict: "auth_user_id" });

// Sign in as the test user on a plain anon-key client.
const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: TEST_EMAIL,
});
if (linkErr) {
  console.error("generateLink failed:", linkErr.message);
  process.exit(1);
}
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { error: otpErr } = await anon.auth.verifyOtp({
  type: "email",
  token_hash: link.properties.hashed_token,
});
if (otpErr) {
  console.error("verifyOtp failed:", otpErr.message);
  process.exit(1);
}

let failed = false;
function report(name, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed = true;
}

// Locked columns: every update must be rejected.
const locked = [
  ["plan", { plan: "comp" }],
  ["trial_ends_at", { trial_ends_at: "2099-01-01T00:00:00Z" }],
  ["is_admin", { is_admin: true }],
  ["trial_quote_limit", { trial_quote_limit: 9999 }],
  ["plan_tier", { plan_tier: "pro" }],
  ["stripe_customer_id", { stripe_customer_id: "cus_fake" }],
  ["stripe_subscription_id", { stripe_subscription_id: "sub_fake" }],
  ["billing_period_start", { billing_period_start: "2099-01-01T00:00:00Z" }],
];
for (const [name, patch] of locked) {
  const { error } = await anon
    .from("contractors")
    .update(patch)
    .eq("auth_user_id", userId)
    .select();
  const denied =
    !!error && (error.code === "42501" || /permission denied/i.test(error.message));
  report(`self-update of ${name} is blocked`, denied);
  if (error && !denied) console.log(`        unexpected error: ${error.message}`);
}

// Allowed column: must succeed and return the row.
const { data: phoneData, error: phoneErr } = await anon
  .from("contractors")
  .update({ phone: "555-0100" })
  .eq("auth_user_id", userId)
  .select("phone");
report(
  "self-update of phone is allowed",
  !phoneErr && phoneData?.length === 1 && phoneData[0].phone === "555-0100"
);
if (phoneErr) console.log(`        error: ${phoneErr.message}`);

// Allowed column from 0011: business_zip must be writable.
const { data: zipData, error: zipErr } = await anon
  .from("contractors")
  .update({ business_zip: "73101" })
  .eq("auth_user_id", userId)
  .select("business_zip");
report(
  "self-update of business_zip is allowed",
  !zipErr && zipData?.length === 1 && zipData[0].business_zip === "73101"
);
if (zipErr) console.log(`        error: ${zipErr.message}`);

// tax_rates (0011) is service-role only: user-scoped writes must be rejected.
const { error: taxErr } = await anon
  .from("tax_rates")
  .insert({ zip: "00000", rate: 0 });
report("user-scoped insert into tax_rates is blocked", !!taxErr);

// Confirm locked values are untouched.
const { data: row } = await admin
  .from("contractors")
  .select("plan, is_admin, trial_quote_limit")
  .eq("auth_user_id", userId)
  .single();
report(
  "locked values unchanged in DB",
  row?.plan === "trial" && row?.is_admin === false && row?.trial_quote_limit === 25
);

process.exit(failed ? 1 : 0);
