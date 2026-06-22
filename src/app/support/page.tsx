import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support — QuoteMagic",
};

const SUPPORT_EMAIL = "support@stait.ai";

const FAQ = [
  {
    q: "How do I change a price?",
    a: "Open Price Book, tap any item to edit its price, unit, or time estimate. The AI uses your prices on every new quote — internet averages never override them.",
  },
  {
    q: "How do payments work?",
    a: "Customers see the payment instructions you set in Settings (Zelle, check, etc.) on deposit and invoice pages, and you mark a deposit or invoice as received once the money lands. There's no in-app card processing yet.",
  },
  {
    q: "How do I change plans or cancel?",
    a: "Go to Settings → Plan & billing. From there you can subscribe, switch between Solo and Pro, update your card, or cancel — all through the secure Stripe portal.",
  },
  {
    q: "I can't log in.",
    a: "QuoteMagic signs you in with a one-time link or code emailed to you — there's no password. Request a fresh one from the login page; codes expire after a short while.",
  },
  {
    q: "How do I update my business name, logo, or tax rate?",
    a: "Everything customers see lives in Settings — your name, logo, default markup and tax, deposit percentage, and how customers pay you.",
  },
];

export default function SupportPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-zinc-50 px-6 pb-16 pt-12">
      <h1 className="text-2xl font-bold text-zinc-900">Support</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
        Stuck, confused, or have an idea? We&apos;re a small team and we read
        every message.
      </p>

      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=QuoteMagic%20support`}
        className="mt-5 block rounded-xl bg-amber-600 px-5 py-3.5 text-center text-base font-semibold text-white shadow-sm hover:bg-amber-700"
      >
        Email {SUPPORT_EMAIL}
      </a>
      <p className="mt-2 text-center text-xs text-zinc-400">
        We usually reply within one business day.
      </p>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Common questions
      </h2>
      <div className="mt-3 space-y-3">
        {FAQ.map((item) => (
          <section
            key={item.q}
            className="rounded-2xl border border-zinc-200 bg-white p-4"
          >
            <p className="font-semibold text-zinc-900">{item.q}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">
              {item.a}
            </p>
          </section>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-zinc-400">
        <Link href="/" className="underline underline-offset-2">
          ← quotemagic.app
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>
      </p>
    </main>
  );
}
