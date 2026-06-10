# QuoteMagic

AI-native quoting for solo trade contractors. Dictate the job on your phone →
Claude drafts a structured quote from **your** price book → edit → send the
customer a link the same day → they accept online.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres + magic-link auth) ·
Claude API (`claude-opus-4-8`, structured outputs) · Resend · Vercel.

## One-time setup

1. **Supabase** — create a project at [supabase.com](https://supabase.com), then:
   - SQL Editor → paste & run `supabase/migrations/0001_init.sql`
   - Authentication → URL Configuration → set **Site URL** to
     `http://localhost:3000` and add `http://localhost:3000/auth/callback`
     to **Redirect URLs** (add your Vercel URL + `/auth/callback` later too)
   - Project Settings → API → copy the URL, `anon` key, and `service_role` key
2. **Anthropic** — get an API key at
   [platform.claude.com](https://platform.claude.com)
3. Copy `.env.example` → `.env.local` and fill in the values.
   `RESEND_API_KEY` is optional — without it, emails are logged to the
   server console.

## Run

```bash
npm install
npm run dev
```

Sign in at `http://localhost:3000` with a magic link. On the Price Book tab,
either run the **onboarding wizard** (dictate past jobs, AI extracts your
price book) or load the **demo electrician price book** to demo immediately.

## The demo script (sauna job)

1. **New Quote** → dictate or paste:
   > Customer wants a sauna hooked up. Need a 50 amp breaker in the main
   > panel, have to move a couple breakers to make room, run about 20 feet
   > of 6/2 out to the sauna, 240 volt disconnect next to it, add a GFCI
   > outlet, then hardwire the control box and the 9 kW heater.
2. Review the draft — matched items use your prices; anything new is
   flagged amber with an AI-estimated price you can correct and save back
   to the price book.
3. Send via email / text / link → open the link on another device →
   **Accept** → status flips and you get notified.

## Architecture notes

- All money/time math is recomputed server-side; the model only proposes.
- Customer quote pages are keyed by unguessable `share_token` and served
  through the service-role client — contractor tables are RLS-locked to
  their owner.
- Dictation uses the browser Web Speech API with an editable textarea
  fallback (the Claude API does not accept audio).
