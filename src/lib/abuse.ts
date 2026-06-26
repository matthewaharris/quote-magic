// Cheap abuse guards for the expensive (AI) and account-creation paths.
//
// These are defense-in-depth, not a wall: the disposable-email list is a
// denylist (inherently incomplete) and the rate limiter is per-instance
// in-memory (a serverless box only sees its own traffic). They blunt casual
// trial-farming and runaway loops at zero cost/zero dependencies. The durable
// fixes are CAPTCHA on signup (see src/lib/turnstile.ts) and a shared-store
// limiter (Upstash) — wire those when ad traffic justifies it.

// Well-known throwaway / temporary-inbox providers. Two of these (sharklasers,
// on3al) already showed up in our own signups, so the vector is real.
const DISPOSABLE_DOMAINS = new Set([
  "sharklasers.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamailblock.com",
  "grr.la",
  "on3al.com",
  "mailinator.com",
  "10minutemail.com",
  "yopmail.com",
  "temp-mail.org",
  "tempmail.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "mohmal.com",
  "fakeinbox.com",
  "throwawaymail.com",
  "mailnesia.com",
  "tmpmail.org",
  "moakt.com",
  "emailondeck.com",
]);

export function isDisposableEmail(email: string | null | undefined): boolean {
  const domain = (email ?? "").split("@")[1]?.trim().toLowerCase();
  return !!domain && DISPOSABLE_DOMAINS.has(domain);
}

// Best-effort fixed-window limiter, keyed by anything (contractor id, ip).
// In-memory and per-instance — see the module note above.
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  // Opportunistic prune so the map can't grow unbounded on a long-lived box.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
  }
  const entry = hits.get(key);
  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { ok: true, retryAfter: 0 };
}
