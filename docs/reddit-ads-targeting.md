# QuoteMagic — Reddit Ads targeting & setup

Reference for running Reddit ad campaigns. Reddit hierarchy is
**Campaign → Ad Group → Ad**. Keep **2–4 ad groups, one targeting type each**
(subreddit / interest / keyword), 3–5 native creatives per group.

## Targeting table — match each subreddit ad group to its trade landing page

QuoteMagic has per-trade landing pages at `/for/[trade]`. Send each
community-targeted ad group to the matching page so the click feels
continuous.

| Ad group (community targeting) | Land them on |
| --- | --- |
| r/electricians | `/for/electrician` |
| r/Plumbing | `/for/plumber` |
| r/HVAC | `/for/hvac` |
| r/Painting | `/for/painter` |
| r/landscaping | `/for/landscaper` |
| r/Construction, r/Roofing, r/Flooring, r/Carpentry, r/Concrete | the closest `/for/[trade]`, else `/` |
| r/Handyman | `/for/handyman` |
| **Owner-intent group:** r/smallbusiness, r/Entrepreneur, r/selfemployed, r/Contractor | main landing `/` |

Built `/for/[trade]` pages today: electrician, plumber, handyman, landscaper,
hauling, hvac, painter, general contractor. Subreddits without a matching
trade page → send to `/`.

### Why two kinds of ad groups

- **Trade subs** (r/electricians, r/Plumbing, …) are tightly relevant but skew
  toward **employees / journeymen**, not owners.
- **Owner-intent subs** (r/smallbusiness, r/Entrepreneur, r/selfemployed,
  r/Contractor) + the **"Business & Entrepreneurship"** interest segment reach
  the people who actually **buy**. Run both; compare conversion, shift budget
  to whatever converts.

Start with **5–10 highly relevant subreddits**, not hundreds. One targeting
type per ad group (don't mix subreddit + interest + keyword in one group).

## Conversion tracking

- **Reddit Pixel** is installed in the app (`src/components/RedditPixel.tsx`),
  gated on the `NEXT_PUBLIC_REDDIT_PIXEL_ID` env var. Set it in Vercel
  (and `.env.local`) and redeploy.
- Base **PageVisit** fires on every page; **SignUp** fires on onboarding
  completion (`src/lib/reddit.ts` → `trackRedditSignUp()` in `OnboardingForm`).
- With the pixel live you can: optimize toward **SignUp** (not clicks),
  **retarget** site visitors who didn't sign up, and build **lookalike**
  audiences later.

## Objective & bidding

- **Objective:** Conversions optimizing for **SignUp** once the pixel has data;
  Traffic to launch before then, switch later.
- **Bidding:** start **Lowest Cost (automatic)** for 7–14 days before any
  manual bids.
- **Budget:** $50/day is fine for testing; don't spread it across too many
  groups at once.

## Creative — Reddit punishes anything that looks like an ad

First-person, like a contractor sharing a tool that saved them time. Headline
as a question / problem statement. 50–150 words, conversational, specific
numbers. Use a real product screenshot, not stock photography. The existing
tagline — *"Dictate the job. Send the quote. Same day."* — already fits.

Example body:

> I was writing quotes at 9pm after every job and losing the ones I sent slow.
> Started dictating the job into my phone on the drive home — it drafts the
> quote from my own prices, I tweak it, text the customer a link before I'm
> home. Closed two I'd have lost.

## "Not delivering · No active ad groups" — fix checklist

This message means the campaign has no ad group in an eligible state. Check at
the **Ad Group** level:

1. Ad group **toggled on** (not paused/draft) — Ad Groups tab → enable toggle.
2. The ad group **contains an approved ad** — Ads tab; not Draft / Under review
   / Rejected (new accounts can sit in review hours–1 day).
3. **Schedule** — start date not in the future; no past end date (remove the
   end date to run continuously).
4. **Budget set at the ad-group level**, not only the campaign.
5. **Billing / payment** fully verified on the account.
6. Targeting not too restrictive (shows as under-delivery, not this error).

Source: Reddit Ads Help — Troubleshoot your campaign performance.
