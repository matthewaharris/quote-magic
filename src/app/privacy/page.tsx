import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — QuoteMagic",
};

// Plain-English template — have an attorney review before relying on it.
export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-zinc-50 px-6 pb-16 pt-12">
      <h1 className="text-2xl font-bold text-zinc-900">Privacy Policy</h1>
      <p className="mt-1 text-xs text-zinc-400">Last updated: June 11, 2026</p>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-zinc-700">
        <p>
          QuoteMagic is operated by <strong>Stait AI LLC</strong>. This page
          describes what we collect and how it&apos;s used.
        </p>

        <section>
          <h2 className="font-semibold text-zinc-900">What we collect</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <strong>Contractor accounts:</strong> name, email, phone,
              business details, price book, and the quotes, jobs, and
              invoices you create.
            </li>
            <li>
              <strong>Customer details</strong> a contractor enters (name,
              email, phone) to send a quote — used only to deliver that
              contractor&apos;s quotes and job updates.
            </li>
            <li>
              <strong>Dictations and photos:</strong> job descriptions you
              dictate are stored with the quote. Job-site photos are sent to
              our AI provider to improve the draft and are{" "}
              <strong>not stored</strong>.
            </li>
            <li>
              <strong>Cookies:</strong> sign-in session cookies, and a
              30-day referral cookie when you arrive via a referral link.
              No third-party advertising trackers.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900">How it&apos;s used</h2>
          <p className="mt-1">
            Only to run the service: generating quotes (processed by
            Anthropic&apos;s Claude API), sending emails (Resend), storing
            data (Supabase), and hosting (Vercel). Demo payment forms accept
            no real card data and charge nothing. We don&apos;t sell your
            data or use it for advertising.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-900">Deletion & questions</h2>
          <p className="mt-1">
            Email{" "}
            <a href="mailto:mharris26@gmail.com" className="underline">
              mharris26@gmail.com
            </a>{" "}
            to request account deletion or ask anything about your data.
          </p>
        </section>
      </div>

      <p className="mt-10 text-center text-xs text-zinc-400">
        <Link href="/" className="underline underline-offset-2">
          ← quotemagic.app
        </Link>{" "}
        · <Link href="/terms" className="underline underline-offset-2">Terms of Service</Link>
      </p>
    </main>
  );
}
