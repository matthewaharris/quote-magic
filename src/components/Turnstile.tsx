"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

// Cloudflare Turnstile widget. DORMANT until NEXT_PUBLIC_TURNSTILE_SITE_KEY is
// set — renders nothing without it, so forms behave exactly as before. When
// configured, it renders the challenge and reports the solved token via
// onToken (empty string on error/expiry).

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    }
  ) => string;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export default function Turnstile({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    if (!siteKey) return;
    // The Cloudflare script may load after this mounts — poll briefly until
    // window.turnstile is ready, then render exactly once.
    const tick = window.setInterval(() => {
      if (rendered.current || !window.turnstile || !ref.current) return;
      rendered.current = true;
      window.clearInterval(tick);
      window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
      });
    }, 200);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div ref={ref} className="mt-3" />
    </>
  );
}
