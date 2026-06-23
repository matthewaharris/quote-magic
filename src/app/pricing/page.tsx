import Link from "next/link";
import { PLANS } from "@/lib/billing";
import type { PlanTier } from "@/lib/types";

export const metadata = {
  title: "Pricing — QuoteMagic",
  description:
    "Simple pricing for solo trade contractors. Start free, then from $9/mo.",
};

// Only list features that actually ship today. Per-tier AI perks get added
// here as they roll out so the live page never advertises something that
// isn't built yet.
const TIER_META: Record<
  PlanTier,
  { tagline: string; highlight: boolean; badge?: string; perks: string[] }
> = {
  basic: {
    tagline: "Dip a toe in — for the occasional job.",
    highlight: false,
    perks: [
      "10 AI quotes a month",
      "Quotes show a “Powered by QuoteMagic” badge",
      "Build your price book by hand",
    ],
  },
  solo: {
    tagline: "About a quote a day — where most solo shops live.",
    highlight: true,
    badge: "Most popular",
    perks: [
      "30 AI quotes a month",
      "Your logo on quotes — no QuoteMagic badge",
      "AI import: build your price book from past jobs",
      "AI-drafted customer messages & smart follow-ups",
    ],
  },
  pro: {
    tagline: "For busy contractors who quote everything.",
    highlight: false,
    perks: [
      "150 AI quotes a month",
      "Everything in Solo, plus:",
      "AI win-back when a customer declines",
      "One-tap starts from your recurring jobs",
      "Win-rate & job-value insights",
    ],
  },
};

const SHARED = [
  "AI quotes from your own price book",
  "Good / better / best quote options",
  "Customer link: accept → schedule → invoice → pay",
  "Automatic follow-up nudges",
  "Deposits & change orders",
  "QR truck card & referral link",
];

export default function PricingPage() {
  const tiers = Object.entries(PLANS) as [PlanTier, (typeof PLANS)[PlanTier]][];

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-zinc-50 px-6 pb-10 pt-12">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Simple pricing.{" "}
          <span className="text-brand-gradient">Quotes that win jobs.</span>
        </h1>
        <p className="mt-3 text-base text-zinc-600">
          Try everything free for 14 days — 25 quotes, no card. Then pick the
          plan that fits how much you quote.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        {tiers.map(([tier, plan]) => {
          const meta = TIER_META[tier];
          return (
            <div
              key={tier}
              className={`rounded-2xl bg-white p-5 ${
                meta.highlight
                  ? "ring-2 ring-amber-500"
                  : "ring-1 ring-zinc-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-zinc-900">
                    {plan.label}
                    {meta.badge && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        {meta.badge}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-500">{meta.tagline}</p>
                </div>
                <p className="text-2xl font-bold text-zinc-900">
                  ${plan.priceUsd}
                  <span className="text-sm font-normal text-zinc-500">/mo</span>
                </p>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-zinc-700">
                {meta.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <span className="text-amber-600">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="mt-4 block w-full rounded-xl bg-brand-gradient px-5 py-3 text-center text-base font-semibold text-white shadow-sm transition hover:brightness-105"
              >
                Start free, then {plan.label}
              </Link>
            </div>
          );
        })}
      </section>

      <section className="mt-8 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
        <p className="text-sm font-semibold text-zinc-900">
          Every plan includes
        </p>
        <ul className="mt-3 space-y-2 text-sm text-zinc-600">
          {SHARED.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="text-amber-600">✓</span>
              {f}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-zinc-400">
          Cancel anytime from your billing page. Payments handled by Stripe —
          we never see your card number. A good / better / best quote counts as
          one quote.
        </p>
      </section>

      <footer className="mt-12 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-400">
        <p>
          <Link href="/" className="underline underline-offset-2">
            ← QuoteMagic home
          </Link>{" "}
          ·{" "}
          <Link href="/login" className="underline underline-offset-2">
            Sign in
          </Link>
        </p>
        <p className="mt-1">
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy
          </Link>
        </p>
      </footer>
    </main>
  );
}
