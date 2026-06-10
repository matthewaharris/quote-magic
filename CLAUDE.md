@AGENTS.md

# QuoteMagic — Project State

AI quoting engine for solo trade contractors: dictate a job → Claude drafts a
structured quote from the contractor's own price book → edit → send link →
customer accepts → schedules a slot → contractor marks complete → customer
confirms → invoice auto-issued → demo payment. **All of this is built,
verified end-to-end, and live at https://quotemagic.app** (Vercel, auto-deploy
on push to `main` of github.com/matthewaharris/quote-magic).

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

## Data model

contractors, price_book_items (source: seeded|learned|manual), customers,
quotes (status: draft→sent→viewed→accepted|declined, share_token),
quote_line_items (price_book_item_id nullable = new/unmatched item),
quote_events (full audit trail), jobs (created on accept; status:
unscheduled→scheduled→done_reported→confirmed→invoiced→paid), invoices
(QM-#### numbering, net-7, demo payment_ref SIM-*).

## Next up (user's stated priorities, not yet built)

1. **Frictionless onboarding rework**: only email, phone, name, optional
   company name + logo. Logo: ask for their website URL and scrape the logo
   (og:image / apple-touch-icon / favicon fallback) — simple fetch+parse,
   no agent needed. Logo + business name must render on quotes & invoices.
2. **Mobile-code login**: email magic link stays default; consider Supabase
   email OTP (6-digit code) as a second factor of convenience; SMS OTP needs
   Twilio — defer.
3. **Trial/monetization**: 14-day free trial with 25 quotes for new users —
   trial fields on contractors, gate quote generation, show remaining-quote
   counter. Stripe later.
4. **GTM backlog**: "Powered by QuoteMagic" footer on customer pages should
   link to a signup landing page (every quote sent is a viral impression to
   a homeowner AND every tradesperson knows other tradespeople); referral
   credits; try-it-now sandbox (demo price book, no signup); per-trade
   landing pages/templates; QR card for the truck; founding-contractor pricing.
5. **Product backlog** (in priority order, from the approved plan): deposit
   on acceptance; smart follow-up nudges (viewed-but-silent, Vercel cron);
   photo capture + Claude vision line-item suggestions; change orders;
   QuickBooks CSV export; pipeline dashboard; PDF/.ics; good/better/best.

## Known prototype limitations

- Resend: domain verified, can email anyone; deliverability reputation still warming
- Business hours hardcoded Mon–Fri 8–17 in `src/lib/scheduling.ts`
- Demo checkout only (clearly labeled); no real payments
- Single shared DB between dev and prod
