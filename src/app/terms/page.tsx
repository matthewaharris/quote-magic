import type { Metadata } from "next";
import Link from "next/link";
import { getTrialDays } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Terms of Service — QuoteMagic",
};

// Plain-English template — have an attorney review before relying on it.
export default async function TermsPage() {
  const trialDays = await getTrialDays();
  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-zinc-50 px-6 pb-16 pt-12">
      <h1 className="text-2xl font-bold text-zinc-900">Terms of Service</h1>
      <p className="mt-1 text-xs text-zinc-400">Last updated: June 11, 2026</p>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-zinc-700">
        <p>
          QuoteMagic is a product of <strong>Stait AI LLC</strong> (“Stait
          AI”, “we”, “us”). By creating an account or using quotemagic.app,
          you agree to these terms.
        </p>

        <section>
          <h2 className="font-semibold text-zinc-900">The service</h2>
          <p className="mt-1">
            QuoteMagic helps trade contractors create quotes from spoken job
            descriptions using artificial intelligence, send them to
            customers, and manage scheduling, change orders, and invoicing.
            AI-generated quotes are <strong>drafts</strong>: you are
            responsible for reviewing prices, quantities, and scope before
            sending anything to a customer.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900">Payments are simulated</h2>
          <p className="mt-1">
            Payment features (deposits and invoice checkout) are currently a
            clearly-labeled <strong>demonstration</strong>. No real money
            moves through QuoteMagic today. Invoices and payment records the
            app produces are for workflow purposes only; collecting actual
            payment from your customers is between you and them.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900">Free trial</h2>
          <p className="mt-1">
            New accounts include a free trial (currently {trialDays} days or 25
            quotes, whichever comes first). We may change trial terms,
            introduce paid plans, or discontinue features; we&apos;ll
            communicate material changes to active users.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900">Your content</h2>
          <p className="mt-1">
            Your price book, quotes, customer records, and dictations remain
            yours. You grant us the right to process them to operate the
            service (including sending them to our AI and email providers on
            your behalf). Don&apos;t use QuoteMagic for anything unlawful or
            to send spam.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900">Disclaimer</h2>
          <p className="mt-1">
            QuoteMagic is provided “as is”, without warranties of any kind.
            To the maximum extent permitted by law, Stait AI LLC is not
            liable for lost profits, lost data, or indirect damages arising
            from use of the service, and our total liability is limited to
            the amount you paid us in the twelve months before the claim.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900">Contact</h2>
          <p className="mt-1">
            Stait AI LLC ·{" "}
            <a href="mailto:support@stait.ai" className="underline">
              support@stait.ai
            </a>
          </p>
        </section>
      </div>

      <p className="mt-10 text-center text-xs text-zinc-400">
        <Link href="/" className="underline underline-offset-2">
          ← quotemagic.app
        </Link>{" "}
        · <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
      </p>
    </main>
  );
}
