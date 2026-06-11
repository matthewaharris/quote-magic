import Link from "next/link";
import { PLANS } from "@/lib/billing";
import type { PlanTier } from "@/lib/types";

export const metadata = {
  title: "Pricing — QuoteMagic",
  description:
    "Simple pricing for solo trade contractors. Start free, then $29/mo.",
};

const FEATURES = [
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
          <span className="text-amber-600">Quotes that win jobs.</span>
        </h1>
        <p className="mt-3 text-base text-zinc-600">
          Try everything free for 14 days — 25 quotes, no card. Then pick the
          plan that fits how much you quote.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        {tiers.map(([tier, plan]) => (
          <div
            key={tier}
            className={`rounded-2xl bg-white p-5 ${
              tier === "pro" ? "ring-2 ring-amber-500" : "ring-1 ring-zinc-200"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-bold text-zinc-900">
                  {plan.label}
                  {tier === "pro" && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      Best value
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {tier === "solo"
                    ? "About a quote a day — perfect for most solo shops."
                    : "For busy contractors who quote everything."}
                </p>
              </div>
              <p className="text-2xl font-bold text-zinc-900">
                ${plan.priceUsd}
                <span className="text-sm font-normal text-zinc-500">/mo</span>
              </p>
            </div>
            <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700">
              {plan.monthlyQuotes} AI quotes every month
            </p>
            <Link
              href="/login"
              className="mt-4 block w-full rounded-xl bg-amber-600 px-5 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-amber-700"
            >
              Start free, then {plan.label}
            </Link>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
        <p className="text-sm font-semibold text-zinc-900">
          Every plan includes
        </p>
        <ul className="mt-3 space-y-2 text-sm text-zinc-600">
          {FEATURES.map((f) => (
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
