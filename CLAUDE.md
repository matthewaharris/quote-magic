@AGENTS.md

# QuoteMagic — Project State

AI quoting engine for solo trade contractors: dictate a job → Claude drafts a
structured quote from the contractor's own price book → edit → send link →
customer accepts → schedules a slot → contractor marks complete → customer
confirms → invoice auto-issued → demo payment. **All of this is built,
verified end-to-end, and live at https://quotemagic.app** (Vercel, auto-deploy
on push to `main` of github.com/matthewaharris/quote-magic).

Also built & verified (June 2026): minimal onboarding (name/phone/optional
company + website-logo scrape) at `/onboarding`, redirect for un-onboarded
users in `(app)/layout.tsx`; `/settings` (profile, trade, rate, logo
re-fetch); `/pricebook/import` (the old dictate-past-jobs wizard, now
optional); 14-day / 25-quote trial (`src/lib/trial.ts`, gate in
generate-quote route, banner in app layout, `plan` column:
trial|comp|paid|disabled); contractor logo + business name on `/q/[token]`
and customer-facing emails; public landing page at `/` (logged-out only;
"Powered by QuoteMagic" footer on customer pages links there); `/admin`
dashboard (stats + comp / extend-trial / disable / re-enable, gated by
`contractors.is_admin` — both owner accounts flagged).

## Stack & conventions

- Next.js 16 App Router + TS + Tailwind v4, mobile-first, max-w-lg layouts
- Supabase: Postgres + magic-link auth (`@supabase/ssr`); session refresh in
  `src/proxy.ts` (Next 16 proxy convention, not middleware)
- Claude API: `claude-opus-4-8`, `thinking: {type:"adaptive"}`, structured
  outputs via `client.messages.parse` + `zodOutputFormat` — see `src/lib/ai/`
- Contractor pages: RLS-scoped via `requireContractor()` (`src/lib/contractor.ts`)
- Customer pages: `/q/[shareToken]` via `createAdminClient()` (service role,
  token-keyed) — never expose service key client-side
- All money/time math recomputed server-side; the model only proposes
- Emails: `src/lib/email.ts` (Resend, verified domain `quotes@quotemagic.app`;
  console stub without key)
- Migrations: SQL files in `supabase/migrations/`, applied with
  `node --env-file=.env.local scripts/db.mjs --file <path>` (no supabase CLI)
- Dev login without email: `node --env-file=.env.local scripts/login-link.mjs
  <email>` → open printed URL (route 404s in production)
- Timezone simplification: appointment times stored as UTC wall-clock and
  always formatted with `timeZone:"UTC"` (see `src/lib/scheduling.ts` header)
- Local + production share ONE Supabase project/database
- Logos: scraped server-side (`src/lib/logo.ts`, og:image → apple-touch-icon
  → favicon, SSRF/size/type guards, never throws) into the public `logos`
  storage bucket; rendered with plain `<img>` (works in emails too)
- Trial logic lives in `src/lib/trial.ts` (`getTrialStatus`); every quote row
  counts toward `contractors.trial_quote_limit` (default 25, admin-extendable);
  `plan='comp'` bypasses (both of Matt's accounts are comp + is_admin)
- SECURITY: `plan`, `trial_ends_at`, `is_admin`, `trial_quote_limit` are
  column-locked against user-scoped writes (0004: revoke + column-scoped
  grants — RLS limits rows, grants limit columns). All plan changes go
  through `/admin` server actions (service role). When adding contractor
  columns the app writes via the user client, GRANT them explicitly.
  `scripts/security-check.mjs` verifies the lockdown end-to-end.

## Data model

contractors, price_book_items (source: seeded|learned|manual), customers,
quotes (status: draft→sent→viewed→accepted|declined, share_token),
quote_line_items (price_book_item_id nullable = new/unmatched item),
quote_events (full audit trail), jobs (created on accept; status:
unscheduled→scheduled→done_reported→confirmed→invoiced→paid), invoices
(QM-#### numbering, net-7, demo payment_ref SIM-*).

## Next up (user's stated priorities, not yet built)

1. **Mobile-code login**: email magic link stays default; consider Supabase
   email OTP (6-digit code) as a second factor of convenience; SMS OTP needs
   Twilio — defer.
2. **Stripe**: real paid plans behind the trial (trial gate + `plan` column
   already in place; trial-ended UI currently shows a mailto).
3. **GTM backlog**: referral credits; try-it-now sandbox (demo price book,
   no signup); per-trade landing pages/templates; QR card for the truck;
   founding-contractor pricing.
4. **Product backlog** (in priority order, from the approved plan): deposit
   on acceptance; smart follow-up nudges (viewed-but-silent, Vercel cron);
   photo capture + Claude vision line-item suggestions; change orders;
   QuickBooks CSV export; pipeline dashboard; PDF/.ics; good/better/best.

## Known prototype limitations

- Resend: domain verified, can email anyone; deliverability reputation still warming
- Business hours hardcoded Mon–Fri 8–17 in `src/lib/scheduling.ts`
- Demo checkout only (clearly labeled); no real payments
- Single shared DB between dev and prod
- Logo scrape: no DNS re-resolution (SSRF guard is hostname-level only);
  og:image is often a wide banner, not a logo — re-fetch from /settings
- Contractors created before June 2026 have `name=''` (editable in /settings)
- Trial-ended/disabled contact is a hardcoded mailto to Matt
- Supabase auth emails use the built-in mailer (~2-4/hr rate limit) — magic
  links will throttle under real signup volume until custom SMTP (Resend)
  is configured in the Supabase dashboard (Auth → SMTP). Dev workaround:
  `scripts/login-link.mjs` mints sign-in URLs without sending email.
