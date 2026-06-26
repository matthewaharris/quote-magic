// Server-side verification of a Cloudflare Turnstile token, for forms we own
// (e.g. onboarding). DORMANT until TURNSTILE_SECRET_KEY is set: with no key
// configured it returns ok (skip), so local dev and un-configured deploys
// behave exactly as before. Once the key is set, a missing/invalid token is
// rejected. (Supabase Auth verifies its OWN captchaToken on the login path —
// enable Turnstile in the Supabase dashboard for that; this helper is for our
// server actions.)
export async function verifyTurnstile(
  token: string | null | undefined
): Promise<{ ok: boolean }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true }; // not configured → no-op
  if (!token) return { ok: false };
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
      }
    );
    const data = (await res.json()) as { success?: boolean };
    return { ok: !!data.success };
  } catch {
    return { ok: false };
  }
}
