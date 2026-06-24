// Client-side Reddit pixel helpers. Every call is a no-op when the pixel
// script isn't loaded (no NEXT_PUBLIC_REDDIT_PIXEL_ID), so callers don't need
// to guard. The base pixel + PageVisit live in src/components/RedditPixel.tsx.

declare global {
  interface Window {
    rdt?: (...args: unknown[]) => void;
  }
}

// Fire the SignUp conversion — call once when a contractor finishes
// onboarding, so Reddit can optimize the campaign toward signups (not clicks).
export function trackRedditSignUp() {
  if (typeof window !== "undefined") window.rdt?.("track", "SignUp");
}
