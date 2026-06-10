// DEV ONLY: mint a magic-link token for an email and print the local
// sign-in URL (consumed by /api/dev/login).
// Usage: node --env-file=.env.local scripts/login-link.mjs you@example.com
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/login-link.mjs <email>");
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data, error } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
});
if (error) {
  console.error("generateLink failed:", error.message);
  process.exit(1);
}

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
console.log(
  `${base}/api/dev/login?token_hash=${encodeURIComponent(data.properties.hashed_token)}`
);
