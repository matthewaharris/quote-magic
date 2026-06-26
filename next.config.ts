import type { NextConfig } from "next";

// Content-Security-Policy. Allowlist reflects exactly what the app loads:
// - scripts: our own bundle + the Reddit pixel (redditstatic) + Vercel
//   Analytics (va.vercel-scripts.com). 'unsafe-inline' is required because
//   the Reddit pixel and Next's bootstrap inject inline <script>; nonce-based
//   CSP would need proxy-injected nonces (a future hardening).
// - img: self + Supabase storage (logos live in the public `logos` bucket).
// - frame-src: Cloudflare Turnstile (CAPTCHA), so it works once enabled.
// Enforced in production only — `next dev` HMR needs eval/websocket leeway.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.redditstatic.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.reddit.com https://va.vercel-scripts.com",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Sent on every response. CSP is the one omitted in dev (see above).
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), payment=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: csp }]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
