// Wipe the price book for the per-SKU test accounts so you can re-test the
// empty-state starter-book flow. Targets ONLY the +basic/+solo/+pro plus-
// addressed accounts created by comp-test-accounts.mjs — never touches any
// real contractor.
//
//   node --env-file=.env.local scripts/clear-test-pricebooks.mjs [base-email]
//
// base-email defaults to mharris26@gmail.com → +basic/+solo/+pro variants.
import { createClient } from "@supabase/supabase-js";

const baseEmail = process.argv[2] ?? "mharris26@gmail.com";
const [local, domain] = baseEmail.split("@");
if (!domain) {
  console.error("Usage: node ... clear-test-pricebooks.mjs you@gmail.com");
  process.exit(1);
}

const TIERS = ["basic", "solo", "pro"];
const emails = TIERS.map((t) => `${local}+${t}@${domain}`);

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

for (const email of emails) {
  const { data: contractor, error: findErr } = await admin
    .from("contractors")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (findErr) {
    console.error(`lookup ${email} failed:`, findErr.message);
    continue;
  }
  if (!contractor) {
    console.log(`SKIP ${email} — no contractor (run comp-test-accounts first)`);
    continue;
  }

  const { count, error: delErr } = await admin
    .from("price_book_items")
    .delete({ count: "exact" })
    .eq("contractor_id", contractor.id);

  if (delErr) {
    console.error(`delete ${email} failed:`, delErr.message);
    continue;
  }
  console.log(`CLEARED ${email} — removed ${count ?? 0} item(s)`);
}

console.log(
  "\nDone. Open each account's Price Book page to see the empty-state" +
    " starter-book generator."
);
