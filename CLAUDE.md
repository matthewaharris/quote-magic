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
change_orders_total breakdown), busy_blocks (contractor-entered calendar
blocks; quote_events also has 'rescheduled' with previous_start meta).
contractors.payment_instructions = freeform "how to pay me" text (0010).

Markup & tax (June 11, 2026): contractors set `default_markup_percent`
(baked into line unit prices at generation — customers never see a markup
row) and `default_tax_rate` (seeds each quote's tax field) in /settings;
the quote editor has a one-shot "Markup all prices %" control and the
existing per-quote Tax % field.

AI transparency (June 11, 2026): /settings/ai shows the quoting system
prompt's rules in plain English and saves `contractors.quoting_instructions`
— freeform standing rules injected into every generation (price book still
wins). Prompt also gained universal estimating defaults (single-person crew,
setup/cleanup time, consumables in unit prices). Legal: /terms + /privacy
name Stait AI LLC (attorney-review templates); footers updated.

Stripe billing (June 11, 2026) — BUILT, awaiting Matt's keys: two tiers
(Solo $29/mo 30 quotes, Pro $59/mo 150 quotes — decided this session; no
seat tiers, multi-user doesn't exist). `src/lib/billing.ts` = PLANS config,
`getUsageStatus()` (supersedes getTrialStatus at call sites; paid = per-
billing-period count, same tier-group rule), `syncStripeSubscription()` —
the ONLY writer of subscription state: every webhook event AND the checkout
success page re-fetch the live sub from Stripe and write derived state
(idempotent, race-proof; never overwrites plan for comp/disabled). NOTE:
on current Stripe API, `current_period_start/end` live on subscription
ITEMS, not the subscription. Hosted Checkout + Customer Portal only (no
client-side Stripe.js); portal handles tier switches/cancel/card. Migration
0008 (columns locked per 0004 pattern, security-check extended). Routes:
/api/stripe/webhook (constructEventAsync on raw request.text()),
/settings/billing (sync-on-success via ?session_id), /pricing (public).
Trial-ended mailto → /settings/billing links everywhere; QUOTA_LIMIT code
alongside TRIAL_LIMIT. Admin upgrades shipped too: tier-group count fix
(src/app/(app)/admin/quoteGroups.ts), ?q= search, accept-rate + 7d chips,
/admin/[id] drilldown (quotes, events, Stripe link, accept rate), sign-in
link generator (production-safe /api/admin/login, verifyOtp; dev twin
still 404s in prod).

Availability scheduling (June 11, 2026) — BUILT & VERIFIED (migration 0009):
contractor working hours drive the customer booking calendar. `contractors.
availability` jsonb (per-day {start,end} keyed "0"–"6", missing = closed,
default Mon–Fri 8–17; column granted per 0004 pattern), `busy_blocks` table
(pre-existing appointments, RLS "own"), `quotes.duration_override_minutes`
(slot length override; null = labor hours rounded up, capped at longest
open day). `src/lib/scheduling.ts` rewritten: generateSlots honors per-day
windows, hourly starts from open; days shorter than the job offer nothing.
`src/lib/busy.ts` merges booked jobs + busy blocks for both /api/q routes.
/schedule page (bottom nav + settings link): weekly-hours editor, busy-block
add/remove, merged upcoming agenda; onboarding now lands on
/schedule?welcome=1. Quote editor "Time on calendar" field = the override.
Customers reschedule self-serve from /q (collapsed link under the scheduled
card, only before the appointment starts) — direct rebooking since every
offered slot is genuinely open; logs 'rescheduled' event with previous_start
and emails the contractor.

Manual payments bridge (June 12, 2026) — BUILT & VERIFIED (migration 0010):
real-money launch without Stripe Connect. `src/lib/payments.ts` is the mode
switch: `manual` (default) shows `contractors.payment_instructions` (new
/settings textarea) on customer deposit + invoice views (HowToPay card)
instead of the demo card form; the contractor records money landing via
JobPanel "Mark deposit received" (unlocks scheduling, emails customer) and
"Mark invoice paid" (job→paid, REC-* refs vs demo SIM-*, receipt email,
recorded_by:'contractor' in event meta). `PAYMENTS_MODE=demo` env restores
the simulated checkout; the demo /api/q/[token]/pay* routes 403 in manual
mode (otherwise anyone could mark a real invoice paid). Stripe Connect is
the future third mode — branch points are documented in payments.ts.

## Next up

1. **Stripe prod go-live (Matt)**: test mode VERIFIED this session (active
   Solo sub, sync-on-success works; keys/prices/portal already in
   .env.local). Remaining: live keys + the same 5 env vars in Vercel,
   `scripts/stripe-setup.mjs --prod` creates the live webhook endpoint;
   Stripe dashboard: enable "cancel subscription after retries fail".
2. **Zip-code sales tax lookup** (backlogged June 11 by Matt): auto-fill
   `default_tax_rate` (and/or per-quote rate) from the job's zip code —
   needs a tax-rate API choice (API Ninjas free tier vs static dataset vs
   Zip-Tax were the candidates).
3. SMS OTP (Twilio) — deferred.

## Known prototype limitations

- Resend: domain verified, can email anyone; deliverability reputation still warming
- Availability: busy blocks are single-day, non-recurring; slot starts are
  hourly from each day's open time; customer can reschedule self-serve any
  number of times up until the appointment starts (no notice window)
- No in-app money movement: manual mode relies on the contractor honestly
  recording payments (REC-* refs); demo checkout only behind
  PAYMENTS_MODE=demo; Stripe Connect deferred until volume justifies it
- Single shared DB between dev and prod
- Logo scrape: no DNS re-resolution (SSRF guard is hostname-level only);
  og:image is often a wide banner, not a logo — re-fetch from /settings
- Contractors created before June 2026 have `name=''` (editable in /settings)
- Disabled-account contact is a hardcoded mailto to Matt (trial-ended now
  links to /settings/billing)
- Stripe: test keys configured & verified locally (June 11); production
  still needs live keys in Vercel. Paid quota resets rely on webhooks
  updating billing_period_start (invoice.paid); if webhooks lapse, the
  period start goes stale (sync-on-success covers checkout but not
  renewals). Local webhook secret is from `stripe listen` (per-session)
- /admin Stripe customer links point at live-mode dashboard URLs (test-mode
  customers need /test/ inserted manually)
- Supabase auth now uses custom SMTP via Resend (configured June 2026);
  dev workaround for no-email login remains `scripts/login-link.mjs`
- OTP code sign-in works but the code only appears in emails once
  `{{ .Token }}` is added to the Supabase email templates (Matt action)
- Nudge cron needs `CRON_SECRET` set in Vercel project env (it's in
  .env.local; route fails closed without it)
- Quote photos are not persisted — they only inform generation
- "PDF" = print stylesheet + browser save-as-PDF, not a generated file
- Referral reward (+10 quotes) only applies to referrers on trial; comp/paid
  referrers just get the counter
