# QuoteMagic — Native iOS App Handoff

Read this first, then `CLAUDE.md` (architecture + data model) and `AGENTS.md`.
This document is the starting brief for building a **native iOS app** for
QuoteMagic. It is written so Claude Code on a Mac can pick the work up cold.

> **You are on a Mac now.** Native iOS dev needs Xcode (macOS only). This repo
> is the **shared backend + web app**; the iOS app is a new client that talks to
> the same Supabase project and the same Next.js `/api/*` routes. Nothing was
> "moved" — you cloned/pulled this repo so you have full backend context.

---

## 1. What we're building (and not)

**Build:** the **contractor-facing** app — the person who dictates jobs, edits
quotes, sends them, manages their price book, schedules, and runs the job
lifecycle. This is the daily-driver, and the part that benefits most from native
(voice dictation, camera, push).

**Do NOT rebuild:** the **customer-facing** side. Customers receive a link
(`https://quotemagic.app/q/[token]`) and accept / schedule / pay in their phone
browser. That web flow already works, needs no install, and should stay web.
The iOS app only needs to *generate and send* those links.

MVP target: a contractor can sign in, dictate a job, get an AI quote from their
price book, tweak it, and text the customer a link — entirely from the phone.

---

## 2. Recommended architecture

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│  iOS app (SwiftUI)       │        │  Supabase (SAME project)     │
│                          │  auth  │  - Auth (email OTP)          │
│  supabase-swift SDK ─────┼───────▶│  - Postgres (RLS-scoped)     │
│   • Auth (Keychain)      │  data  │  - Storage (logos bucket)    │
│   • DB reads/writes      │◀──────▶│                              │
│   • Storage              │        └──────────────────────────────┘
│                          │
│  URLSession ─────────────┼──────▶ Next.js /api/* on quotemagic.app
│   (Bearer access token)  │  AI    │  - /api/ai/generate-quote    │
│                          │  send  │  - /api/quotes/[id]/send …   │
└─────────────────────────┘        │  (Claude key, Stripe, email  │
                                    │   secrets stay SERVER-side)  │
                                    └──────────────────────────────┘
```

Two channels, on purpose:

1. **supabase-swift SDK** for **auth + plain data** (reading quotes, price book
   items, jobs; simple writes). RLS already scopes every row to the signed-in
   contractor, so direct table access is safe — see the 0004 column-lockdown in
   `CLAUDE.md` / `scripts/security-check.mjs`.
2. **Next.js `/api/*`** for anything that needs a **server secret or trusted
   recomputation**: AI quote generation (Claude key), sending email (Resend),
   Stripe, zip-tax lookup. The app must never hold those secrets.

**Secrets the app embeds:** ONLY `NEXT_PUBLIC_SUPABASE_URL` + the **anon key**
(both already public, RLS-protected). Never the service-role key, Claude key,
Stripe secret, or Resend key.

---

## 3. Backend prerequisite — token auth on `/api/*`  ✅ DONE

**Implemented (June 2026).** `getContractor()` now authenticates by EITHER the
session cookie (web, unchanged) OR an `Authorization: Bearer <Supabase access
token>` header (native / API clients). So **every existing `/api/*` route that
calls `getContractor()` already accepts a mobile caller** — no further backend
work needed to start the app.

How it works (`src/lib/contractor.ts` + `src/lib/supabase/server.ts`):
- A bearer header → `createTokenClient(token)` builds a supabase-js client with
  `Authorization: Bearer <token>` on every request, so **RLS applies as that
  user** (the service-role key is never involved). The token is validated with
  `auth.getUser(token)`; invalid/expired → `401`.
- No bearer header → the original cookie flow (web is byte-for-byte unchanged).

From iOS: get the token from `supabase.auth.session.accessToken` and send it as
`Authorization: Bearer <token>` on each `/api/*` call. On `401`, refresh the
session (the SDK does this automatically) and retry.

Verified by `scripts/mobile-auth-check.mjs` (run the dev server, then
`node --env-file=.env.local scripts/mobile-auth-check.mjs`): no token → 401,
valid token → authenticated, garbage token → 401. Note: on the security-check
test account a valid token returns **403 "trial ended"**, not 400 — that still
proves auth passed (it reached the trial/quota check after loading the
contractor); run against a comped/active account for a clean 400.

(CORS is **not** a concern — native apps aren't browsers and ignore it.)

---

## 4. Auth on iOS

Use **email OTP (8-digit code)** — cleanest mobile UX, no deep-link plumbing:

```swift
try await supabase.auth.signInWithOTP(email: email)      // sends the code
try await supabase.auth.verifyOTP(email: email,
                                  token: code, type: .email)  // signs in
```

- This project's OTP is **8 digits**; the Supabase email template already
  includes `{{ .Token }}` (done in the dashboard — see CLAUDE.md).
- The SDK persists the session in the Keychain and auto-refreshes.
- Get the bearer token for API calls via `supabase.auth.session.accessToken`.
- Magic-link / universal-link sign-in is possible later (needs an
  `apple-app-site-association` file under the web app's
  `public/.well-known/` + Associated Domains), but OTP is enough for MVP.

There is **no separate signup** — first OTP verify creates the `contractors`
row (mirrors `getContractor`'s upsert). Onboarding (name/phone/business +
optional logo scrape) maps to `completeOnboarding` in
`src/app/onboarding/actions.ts` — rebuild that as the first-run screen, OR call
the existing flow. New signups should still avoid disposable emails (see
`src/lib/abuse.ts`).

---

## 5. Data model

Mirror these as `Codable` Swift structs. **Source of truth:**
`src/lib/types.ts` and the "Data model" section of `CLAUDE.md`. Core tables the
app touches:

| Table | Use in app |
| --- | --- |
| `contractors` | profile, plan/trial, settings, availability, payment_instructions |
| `price_book_items` | the price book (source: seeded\|learned\|manual) |
| `quotes` | drafts + sent; status, share_token, tier/tier_group_id |
| `quote_line_items` | editable lines; `price_book_item_id` null = new/unmatched |
| `customers` | name/phone/email per quote |
| `quote_events` | audit trail (created/sent/viewed/accepted/…) |
| `jobs` | created on accept; lifecycle status + deposit fields |
| `change_orders` | added on a job; customer approves on web |
| `invoices` | QM-#### , totals breakdown |
| `busy_blocks` | calendar blocks for scheduling |

RLS scopes all of these to the signed-in contractor automatically. Money/time
are **recomputed server-side** — the app shows them but the server route is
authoritative (never trust client arithmetic, same rule as the web).

---

## 6. API surface to consume (Next.js routes)

All under `https://quotemagic.app/api/…`. After the Phase-0 token change, send
`Authorization: Bearer <accessToken>`. Full list lives in `src/app/api/`.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/ai/generate-quote` | POST | `{ transcript, tiered?, images? }` → creates quote(s), returns `{ id }`. The core flow. Gated by plan/quota + abuse checks. |
| `/api/ai/extract-pricebook` | POST | bulk price-book import from past-job transcripts (Solo+). |
| `/api/quotes/[id]/send` | POST | send the quote (email + mark sent). |
| `/api/export/invoices.csv` | GET | invoice export. |
| `/api/q/[token]/*` | — | customer-side (web). The app doesn't call these; it just shares the `/q/[token]` URL. |

For quote **editing**, price-book **CRUD**, scheduling, and job-lifecycle
actions, the web app uses **server actions** (not REST) — e.g.
`src/app/(app)/quotes/[id]/actions.ts`, `pricebook/actions.ts`. Server actions
aren't callable from iOS. Two options:
- **(a)** write directly via supabase-swift (RLS-safe for plain row writes), or
- **(b)** add thin REST routes that wrap the existing action logic.
Use (a) where it's a straight row write; use (b) where the action does
server-trusted recomputation (e.g. issuing an invoice, applying markup/tax).
Decide per feature; note it in the iOS code.

---

## 7. Native wins to lean into

- **Voice dictation** — the hero feature. The web sends a **text transcript** to
  `generate-quote`; on iOS use `SFSpeechRecognizer` (on-device, live) to produce
  that transcript, then POST it. Much better than mobile-web mic.
- **Camera / photos** — PhotoKit; `generate-quote` already accepts `images`
  (base64, ≤4, ≤~1MB each) for photo-measure (Pro). Photos are NOT persisted.
- **Push notifications** — replace some email nudges (quote viewed/accepted,
  deposit paid, job confirmed). Needs APNs + a `device_tokens` table + send
  logic in the backend (new work; Phase 5).
- **Share sheet** — sending the `/q/[token]` link via Messages/email natively.

---

## 8. ⚠️ App Store monetization — decide before submitting

QuoteMagic sells subscriptions (Basic $9 / Solo $29 / Pro $59) via **Stripe**.
Apple generally requires **In-App Purchase** for digital subscriptions unlocked
in-app, and will reject "sign up on our website" prompts inside the app.

**Recommended MVP path: companion-to-web.** The iOS app is **free to download
and only authenticates** an existing account. Users **subscribe on the web**
(quotemagic.app), and the app simply works for whoever has an active plan. Don't
sell or mention pricing in-app for v1. This is a common, compliant pattern and
avoids Apple's 15-30% cut and IAP plumbing for launch.

Later, if you want in-app conversion, evaluate: StoreKit 2 IAP, or the newer
external-purchase-link entitlements. This is a **product/legal decision** — flag
it to Matt, don't assume.

---

## 9. Where the code lives

Recommended: **monorepo** — the Xcode project under **`ios/`** in this repo.
Pros: one clone, backend + app co-evolve, Claude Code has full context both
sides. A starter `ios/README.md` and `ios/.gitignore` (Xcode/Swift) are already
committed. Scaffold the app there (SwiftUI, SPM, iOS 17+); suggested name
`QuoteMagic`, bundle id `ai.stait.quotemagic` (confirm with Matt).

Tradeoff: Xcode adds binary churn — the `.gitignore` already excludes
`DerivedData`, `*.xcuserstate`, build products. If Matt prefers a clean split,
a separate `quote-magic-ios` repo also works; then this doc + `CLAUDE.md` should
be copied/referenced there.

---

## 10. First session on the Mac — checklist

1. **Xcode** from the App Store (+ `xcode-select --install` for CLI tools).
2. **Claude Code** installed; open it inside this repo.
3. Confirm you can read `CLAUDE.md`, `AGENTS.md`, and this file.
4. **Decisions to confirm with Matt** (see §11) — at minimum monetization path,
   bundle id, and monorepo-vs-split.
5. **Phase 0** (prove the stack):
   - API token auth is **already done** (§3) — optionally re-verify with
     `node --env-file=.env.local scripts/mobile-auth-check.mjs` (dev server up).
   - Scaffold the SwiftUI app in `ios/`; add `supabase-swift` (SPM).
   - Configure Supabase URL + anon key (ask Matt or read the web env notes).
   - Build: **OTP sign-in → fetch and list the contractor's quotes**. That one
     screen exercises auth + token + RLS data end-to-end.
6. Then proceed through the phases in §12.

You do **not** need any server secret on the Mac. The Supabase URL + anon key
are the only config the app needs; everything secret stays behind `/api/*`.

---

## 11. Open decisions (get Matt's call)

1. **Monetization:** companion-to-web (recommended) vs in-app IAP.
2. **Repo:** monorepo `ios/` (recommended) vs separate repo.
3. **Min iOS version:** 17+ recommended (modern SwiftUI).
4. **Auth UX:** OTP code (recommended) vs magic-link universal links.
5. **MVP scope:** contractor-only, customer stays web — confirm.
6. **Apple Developer Program** ($99/yr) — needed for device testing + App Store;
   who owns the account (Stait AI LLC)?
7. **Bundle id / app name / icon** — reuse the QuoteMagic brand assets in
   `public/` (logo/icon) as a starting point.

---

## 12. Suggested phase plan

- **Phase 0 — Stack proof:** OTP sign-in + quotes list. (API token auth is
  already shipped — §3.)
- **Phase 1 — New quote:** native dictation → `generate-quote` → render result.
- **Phase 2 — Edit & send:** line-item editing (totals server-authoritative) +
  send the `/q` link via share sheet / `send` route.
- **Phase 3 — Price book:** list/add/edit items; the "save to price book" loop.
- **Phase 4 — Lifecycle:** quotes pipeline, jobs, scheduling, invoices (read +
  the actions that need REST wrappers).
- **Phase 5 — Native polish:** push notifications, photo capture/measure,
  offline drafts, App Store prep.

Keep each phase shippable to TestFlight. Mirror the web's discipline: server
recomputes money/time, RLS scopes data, no secrets in the client.
