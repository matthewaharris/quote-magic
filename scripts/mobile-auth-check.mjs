// DEV ONLY: verifies the API accepts Supabase bearer-token auth (for the native
// iOS app) in addition to the web session cookie. Signs in the security-check
// test user to obtain a real access token, then hits /api/ai/generate-quote:
//   - no token            → 401
//   - valid bearer token  → 400 (auth PASSED; reached transcript validation,
//                                 which means getContractor loaded the row via
//                                 the RLS-scoped token client)
//   - garbage token       → 401
// Requires the dev server running (npm run dev). Usage:
//   node --env-file=.env.local scripts/mobile-auth-check.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = "security-check@quotemagic.test";
const ENDPOINT = `${BASE}/api/ai/generate-quote`;

const admin = createClient(url, service, { auth: { persistSession: false } });
await admin.auth.admin
  .createUser({ email: EMAIL, email_confirm: true })
  .catch(() => {});

const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: EMAIL,
});
if (linkErr) {
  console.error("generateLink failed:", linkErr.message);
  process.exit(1);
}

const anonClient = createClient(url, anon, { auth: { persistSession: false } });
const { data: sess, error: otpErr } = await anonClient.auth.verifyOtp({
  type: "email",
  token_hash: link.properties.hashed_token,
});
if (otpErr || !sess?.session) {
  console.error("verifyOtp failed:", otpErr?.message);
  process.exit(1);
}
const token = sess.session.access_token;

let failed = false;
function report(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  — ${extra}` : ""}`);
  if (!ok) failed = true;
}

async function post(headers, body) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const r1 = await post({}, "{}");
report("no token is rejected (401)", r1.status === 401, `got ${r1.status}`);

const r2 = await post(
  { authorization: `Bearer ${token}` },
  JSON.stringify({ transcript: "" })
);
// Auth succeeded iff we got PAST the 401 layer into business logic — i.e. the
// token loaded the contractor via the RLS-scoped client. Depending on the test
// account's trial state that's a 400 (transcript validation) or a 403
// (trial/quota); either proves authentication. Only 401 would mean failure.
report(
  "bearer token authenticates (reaches business logic, not 401)",
  r2.status !== 401 && (r2.status === 400 || r2.status === 403),
  `got ${r2.status} ${r2.json.error ?? ""}`
);

const r3 = await post({ authorization: "Bearer not-a-real-token" }, "{}");
report("invalid token is rejected (401)", r3.status === 401, `got ${r3.status}`);

process.exit(failed ? 1 : 0);
