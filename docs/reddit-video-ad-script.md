# QuoteMagic — video ad script & shotlist

For the 30-second demo video (Reddit video ad + landing-hero loop). Pairs with
the static creatives in `reddit-ad-creatives.md` and the targeting in
`reddit-ads-targeting.md`. The video sells what text can't: the *speed* of voice
→ priced quote.

## Format specs (Reddit)

- **Aspect:** 9:16 vertical (feed) — also export 1:1 square as a fallback.
- **Length:** 15–30s. Reddit autoplays **muted**, so burn in **captions** and
  make the first **2 seconds** carry the hook with on-screen text.
- **Look:** real screen capture of the actual app, not stock/graphics. Reddit
  punishes anything that reads like a polished ad — keep it raw and POV.
- **End card:** 2s with the logo + "Free for 14 days · no card" + the CTA.

## The hero shot to capture

Film the **real mobile flow** (most authentic) on a phone screen recording, or
screen-capture the live **/demo** page (instant, no login, deterministic — the
easiest source). The arc, in order:

1. Contractor's POV in a truck / on a driveway (or just the phone screen).
2. Thumb taps the mic, a voice describes a job out loud.
3. Words transcribe on screen.
4. A structured, **priced** quote appears (line items at *their* prices).
5. Tap **Send** → the customer's link view (Accept → pick a time).
6. End card.

## 30-second script (Angle B — "quote first wins"; strongest opener)

| Time | On-screen (caption, burned in) | What's shown | VO (optional) |
| --- | --- | --- | --- |
| 0–2s | **"The contractor who quotes first usually wins."** | Phone in hand, truck/driveway | "Whoever sends a number first gets the job." |
| 2–6s | "So stop quoting at 9pm." | Thumb taps mic; waveform | "I used to write quotes at night." |
| 6–12s | *(show the words appearing)* | Voice → live transcript of a real job ("50-amp breaker, 20 ft of 6/2 to the hot tub, GFCI disconnect…") | "Now I just talk through the job." |
| 12–18s | **"Your prices. Not internet averages."** | Structured quote builds, line by line, with a total | "It drafts it from my own price book." |
| 18–24s | "Text the customer one link." | Tap Send → customer's Accept / pick-a-time view | "They accept and book a time themselves." |
| 24–28s | "Booked. Before you leave the driveway." | "Accepted & scheduled" confirmation | "Done before I pull out." |
| 28–30s | **Logo · "Free 14 days · no card" · Start free** | End card | — |

## 15-second cutdown

Hook (0–2s) → voice→transcript (2–6s) → priced quote appears (6–10s) → Send +
"Booked." (10–13s) → end card (13–15s). Same captions, fewer beats.

## Three angle variants (swap the hook line + VO; reuse the footage)

- **B — speed:** "The contractor who quotes first usually wins." *(lead with
  this if you only make one.)*
- **A — after-hours pain:** "Still writing quotes at 9pm after a full day?"
- **C — your prices:** "A quote tool that uses *your* prices, not a national
  average."

## Production notes

- **Capture:** phone's built-in screen recorder (captures the mic for the
  dictation beat) for the mobile flow; **Cap** (cap.so, free, Win/Mac) or
  **Tella** for any desktop screens. The live **/demo** page is the fastest
  capture source if you don't want to log in.
- **Edit + captions:** **CapCut** (free) or **Descript** (auto-captions, trims
  "ums", text-based editing). Big, high-contrast captions; keep them in the
  middle-third (Reddit UI covers the bottom).
- **Voiceover:** your own voice is more native than an AI voice; if you'd rather
  not, **ElevenLabs**. Skip generative AI video (Sora/Runway) — it can't show
  real UI and erodes trust.
- **Don't** over-produce. A slightly raw POV clip outperforms a glossy one here.
- Reuse the exported MP4 as a silent looping landing-hero video (replace
  `public/demo-hero.gif` — a real screen recording beats the 4-frame
  placeholder currently there).
