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

Overnight batch (June 11, 2026) — ALL of the former roadmap built & verified:
email OTP code sign-in (login page; this project's OTP is 8 digits — email
templates need `{{ .Token }}` added in the Supabase dashboard); deposit on
acceptance (contractors.deposit_percent, frozen into jobs at accept, demo
PayDeposit gates scheduling — server-enforced, invoice subtracts it);
follow-up nudges (src/lib/nudge.ts, daily Vercel cron /api/cron/nudges with
CRON_SECRET + manual Send-reminder button, max 1 auto-nudge per quote);
pipeline dashboard on /quotes (open/won $, stage chips via ?stage=); CSV
invoice export (/api/export/invoices.csv); .ics calendar files
(/api/q/[token]/calendar.ics, floating wall-clock) + print-hide CSS with
print buttons; per-trade landing pages (/for/[trade], src/components/
Landing.tsx); QR truck card (/settings/qr, qrcode dep); referral tracking
(?ref= → qm_ref cookie in proxy → referred_by via admin client at
onboarding, +10 trial quotes to trial referrers); canned demo (/demo,
zero AI); photo capture + Claude vision (image blocks in messages.parse,
photos NOT persisted); change orders (change_orders table, customer
approve/decline on /q, approved sums roll into invoices); good/better/best
(3 sibling quote rows per tier_group_id, customer tier switcher, accepting
one declines siblings, trial counts 1 per group).

## Data model

contractors, price_book_items (source: seeded|learned|manual), customers,
quotes (status: draft→sent→viewed→accepted|declined, share_token,
tier/tier_group_id for good-better-best groups), quote_line_items
(price_book_item_id nullable = new/unmatched item), quote_events (full audit
trail incl. deposit_paid/nudged/change_order_*), jobs (created on accept;
status: unscheduled→scheduled→done_reported→confirmed→invoiced→paid; deposit
fields), change_orders (pending→approved|declined), invoices (QM-####
numbering, net-7, demo payment_ref SIM-*, deposit_applied +
change_orders_total breakdown).

## Next up

1. **Stripe**: real paid plans behind the trial (trial gate, `plan` column,
   admin controls all ready; trial-ended UI currently shows a mailto).
   Needs Matt's Stripe account + test keys in .env.local.
2. SMS OTP (Twilio) — deferred.

## Known prototype limitations

- Resend: domain verified, can email anyone; deliverability reputation still warming
- Business hours hardcoded Mon–Fri 8–17 in `src/lib/scheduling.ts`
- Demo checkout only (clearly labeled); no real payments
- Single shared DB between dev and prod
- Logo scrape: no DNS re-resolution (SSRF guard is hostname-level only);
  og:image is often a wide banner, not a logo — re-fetch from /settings
- Contractors created before June 2026 have `name=''` (editable in /settings)
- Trial-ended/disabled contact is a hardcoded mailto to Matt
- Supabase auth now uses custom SMTP via Resend (configured June 2026);
  dev workaround for no-email login remains `scripts/login-link.mjs`
- OTP code sign-in works but the code only appears in emails once
  `{{ .Token }}` is added to the Supabase email templates (Matt action)
- Nudge cron needs `CRON_SECRET` set in Vercel project env (it's in
  .env.local; route fails closed without it)
- Quote photos are not persisted — they only inform generation
- /admin quote counts count 3 rows per good/better/best group (known
  inflation; the trial counter does NOT have this problem)
- "PDF" = print stylesheet + browser save-as-PDF, not a generated file
- Referral reward (+10 quotes) only applies to referrers on trial; comp/paid
  referrers just get the counter
