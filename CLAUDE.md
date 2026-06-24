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
- BRAND COLOR (June 22): the app accent is the logo's cyan-blue, NOT orange.
  Implemented in `globals.css` by remapping the whole `amber-*` palette to
  brand cyan in `@theme` — so every existing `amber-*` class renders cyan
  (the class name says amber but paints cyan; don't be fooled). Signature
  surfaces use the full logo gradient via the `.bg-brand-gradient` /
  `.text-brand-gradient` utilities (`--qm-gradient`): landing hero CTA,
  "Same day." accent, lifecycle band, and the in-app "Magic" wordmark.
  Dark mode is a planned follow-up (Midnight palette + toggle; mockup proved
  it at /design-explorer.html, an uncommitted throwaway in public/).
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

Zip-code tax lookup (June 12, 2026) — BUILT & VERIFIED (migration 0011):
`src/lib/tax.ts` looks up a zip's combined sales tax via the zip.tax API
(free tier 100 calls/mo) behind the shared `tax_rates` cache table (90-day
TTL, service-role only; cache hits don't touch the quota; stale cache beats
a failed call). `ZIPTAX_API_KEY` is now configured locally and verified live
against the v60 endpoint (June 23, 2026 — Beverly Hills 90210 → 9.75%); still
needs to be added to Vercel for production. Without the key it stubs 8.25%
"Stubville, OK" in dev and fails politely in prod. NOTE: the live
`/request/v60?postalcode=` endpoint returns the legacy `results[]`/`taxSales`
shape `tax.ts` already parses — the OpenAPI docs describe a different
(address-lookup) schema; don't "fix" the parser to match the docs.
`contractors.business_zip` + /settings
"Find my tax rate" fills the default rate; `quotes.job_zip` + quote editor
"Use local tax rate" fills the per-quote rate; generation extracts job_zip
from the dictation (schema field, never inferred from city names) and
auto-applies that zip's rate over the contractor default. Lookups go
through the auth-gated server action `src/app/(app)/taxActions.ts`.
security-check covers the new grants.

Stripe statement descriptors (June 18, 2026): customers' card statements
show per-PRODUCT descriptors (QUOTEMAGICSOLO / QUOTEMAGICPRO), not the
account default "STAIT AI LLC". Set on each tier in `stripe-setup.mjs`
(`statementDescriptor`), which now self-heals: a re-run patches the live
product if its descriptor drifts. This is the multi-brand pattern — a
future second app under this same account sets its own product descriptors.
Note: per-charge `statement_descriptor_suffix` is card-one-time only and
does NOT apply to subscriptions; product-level is the only lever here.

## Plans & feature gating

Three tiers (June 22, 2026): **Basic $9 / 10 quotes**, Solo $29 / 30, Pro
$59 / 150. `src/lib/billing.ts` PLANS + Stripe lookup_keys basic/solo/pro.
Feature gating lives in `src/lib/plan.ts` — `capabilitiesFor(contractor)`
returns a capability map; levels basic<solo<pro, with trial+comp = pro
(full taste) and paid-without-tier = pro. Basic is differentiated by:
quote volume (10), a "Powered by QuoteMagic" badge instead of white-label
(customer page shows the badge + hides the contractor logo when
`!whiteLabel`), and no AI bulk import (the /pricebook/import page shows an
upgrade card; the extract route + saveImportedPriceBook action also 403/
reject — defense in depth). Basic still builds a price book by hand +
learn-as-you-go. Migration 0012 widened the plan_tier check to include
basic. Pricing page lists only SHIPPED features per tier — add the AI
perks below as they land so we never advertise unbuilt features.

Per-tier AI features (June 22) — most now SHIPPED, all via Haiku
(FAST_MODEL in src/lib/ai/quote.ts), each gated by its plan.ts flag:
- Solo: AI customer message (draftCustomerMessage, SendPanel "Draft a
  message", aiCustomerMessage) ✅; AI-personalized follow-up nudge copy
  (draftFollowupMessage wired into src/lib/nudge.ts, aiFollowup) ✅.
- Pro: AI win-back on declined quotes (draftWinBackMessage, SendPanel shows
  it when status='declined', aiWinBack) ✅; one-tap job templates
  (suggestJobTemplates → quotes/new getJobTemplates action → chips that fill
  the dictation, jobTemplates) ✅; insights page (/insights, src/lib/
  insights.ts computeInsights + narrateInsights, aiInsights) ✅; photo-measure
  (generate-quote route passes measure=photoMeasure && photos>0 into
  generateQuote/Tiered → buildQuoteContent appends MEASURE_INSTRUCTION;
  measurements surface in the quote's assumptions as "From your photo: …",
  photoMeasure) ✅.
ALL SIX SHIPPED. photoMeasure's wiring is build-verified; its measurement
quality is best confirmed with a real job photo (deck/room/roof) — a logo or
stock image isn't a fair test. Each perk is listed on the pricing page.

PROD TODO for Basic: run `stripe-setup.mjs --prod` (now includes basic,
descriptor QUOTEMAGICBASIC) to create the live $9 product/price, add
`STRIPE_PRICE_BASIC` to Vercel. Customer Portal config predates basic, so
downgrade-to-basic via the portal won't appear until the portal product
list is updated (basic→solo/pro upgrades and new basic checkouts work).
Teams/multi-user (Pro 5 seats) deferred — a separate large build (org model,
RLS rework), likely its own higher-priced tier, not free seats in Pro.

## Next up

1. **Stripe prod: LIVE (June 12)** — live products/prices/portal/webhook
   created via `stripe-setup.mjs --prod`; Matt pasted the 5 env vars into
   Vercel; verified in production with a throwaway trial account: upgrade
   button → real cs_live_* Stripe Checkout (test account + live Stripe
   customer deleted after). .env.local stays on TEST keys (local shares
   the prod DB). Remaining: (a) Matt: Billing → Revenue recovery → Retries
   (dashboard.stripe.com/revenue_recovery/retries, live mode) → if all
   retries fail → "Cancel the subscription"; (b) webhook signing secret
   unproven until the first real subscription event lands — check Stripe
   Dashboard → Webhooks for delivery failures after the first paid signup
   (sync-on-success covers checkout regardless).
2. **ZIPTAX_API_KEY**: configured in .env.local and verified live (June 23,
   2026). REMAINING — Matt: add `ZIPTAX_API_KEY` to Vercel and redeploy;
   until then prod tax lookup says "isn't set up yet" (dev works).
3. SMS OTP (Twilio) — deferred.
4. **AI-suggested categories (deferred, Matt's idea June 22)**: when
   generation creates an item that isn't in the price book, have it propose
   a category instead of leaving it Uncategorized. Hook point: the
   extract/generate schemas already carry `category`; the price book page
   groups by it (see below).

## Price book categories

Price book items group by category on /pricebook (June 22, 2026): the
`category` column was always there but weak (free-text, blank auto-set to
"General"). Now categories are IMPLICIT — the distinct set of values across
a contractor's items, derived client-side in `PriceBookManager.tsx` (no
categories table). Blank/null = "Uncategorized" bucket (pinned last);
"General" auto-default removed from both write paths (pricebook/actions.ts
+ pricebook/import/actions.ts now store null). The add/edit form's Category
field is a dropdown of existing values + "Uncategorized" + "+ New
category…", clearly optional; new names are case-insensitively deduped
against existing ones (normalizeCategory). The page is an accordion:
per-category sections with item-count badges, collapse/expand-all, collapse
state persisted to localStorage (COLLAPSE_KEY); a search box filters across
name/description/category and, while active, flattens to matching groups
auto-expanded (collapse state ignored). Quote-editor "save to price book"
still tags items "Learned" (its own category, untouched).

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
- Tax lookup: zips don't align perfectly with tax districts — the looked-up
  rate seeds an always-editable field, it isn't authoritative. ZIPTAX_API_KEY
  configured & verified locally (June 23); pending in Vercel (prod still says
  "isn't set up yet" until the key is added there)
- Support: public /support page (email + FAQ, June 22) links from the
  marketing footer and Settings ("Help & support"); contact address is
  support@stait.ai everywhere (terms, privacy, disabled-account screen).
  Matt must create/forward the support@stait.ai mailbox for it to receive
  mail. No contact form/helpdesk yet — mailto only. Trial-ended links to
  /settings/billing.
- Stripe: test keys configured & verified locally (June 11); production
  still needs live keys in Vercel. Paid quota resets rely on webhooks
  updating billing_period_start (invoice.paid); if webhooks lapse, the
  period start goes stale (sync-on-success covers checkout but not
  renewals). Local webhook secret is from `stripe listen` (per-session)
- /admin Stripe customer links point at live-mode dashboard URLs (test-mode
  customers need /test/ inserted manually)
- Supabase auth now uses custom SMTP via Resend (configured June 2026);
  dev workaround for no-email login remains `scripts/login-link.mjs`
- OTP code sign-in fully working — Matt added `{{ .Token }}` to the
  Supabase email templates (June 12, 2026)
- Nudge cron live: Matt set `CRON_SECRET` in Vercel (June 12, 2026)
- Quote photos are not persisted — they only inform generation
- "PDF" = print stylesheet + browser save-as-PDF, not a generated file
- Referral reward (+10 quotes) only applies to referrers on trial; comp/paid
  referrers just get the counter
