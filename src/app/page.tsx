import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/quotes");

  return <Landing />;
}

const STEPS = [
  {
    title: "🎙️ Dictate the job",
    body: "Talk through the work on your phone, right from the driveway.",
  },
  {
    title: "✨ AI drafts the quote",
    body: "Claude builds line items from your own price book — your prices, not internet averages. Edit anything before it goes out.",
  },
  {
    title: "📲 Customer closes online",
    body: "They accept, pick a time, and pay from one link. You get notified at every step.",
  },
];

const LIFECYCLE = ["quote", "accepted", "scheduled", "done", "invoiced", "paid"];

function Cta() {
  return (
    <Link
      href="/login"
      className="mt-8 block w-full rounded-xl bg-amber-600 px-5 py-3.5 text-center text-base font-semibold text-white shadow-sm hover:bg-amber-700"
    >
      Start quoting free
    </Link>
  );
}

function Landing() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-zinc-50 px-6 pb-10 pt-12">
      <section className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/quotemagic-logo.jpg"
          alt="QuoteMagic"
          className="mx-auto w-44 rounded-3xl"
        />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900">
          Dictate the job. Send the quote.{" "}
          <span className="text-amber-600">Same day.</span>
        </h1>
        <p className="mt-3 text-base text-zinc-600">
          AI quoting for solo trade contractors — your prices, your price
          book, a customer link that closes the job.
        </p>
        <Cta />
        <p className="mt-3 text-xs text-zinc-500">
          Free for 14 days · 25 quotes · no card
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          How it works
        </h2>
        <ul className="mt-4 space-y-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-zinc-900">{step.title}</p>
                <p className="mt-0.5 text-sm text-zinc-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-2xl bg-zinc-900 p-5 text-center">
        <p className="text-sm font-semibold text-white">
          One link runs the whole job
        </p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs font-medium text-zinc-300">
          {LIFECYCLE.map((stage, i) => (
            <span key={stage} className="flex items-center gap-x-1.5">
              {i > 0 && <span className="text-zinc-600">→</span>}
              <span className="rounded-full bg-zinc-800 px-2.5 py-1">
                {stage}
              </span>
            </span>
          ))}
        </p>
        <p className="mt-3 text-xs text-zinc-400">
          No app for your customer to install. No invoice to retype.
        </p>
      </section>

      <section className="mt-12 text-center">
        <p className="text-lg font-bold text-zinc-900">
          Send your first quote tonight.
        </p>
        <Cta />
      </section>

      <footer className="mt-14 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-400">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/quotemagic-icon.png"
          alt=""
          className="mx-auto h-6 w-6 rounded-md"
        />
        <p className="mt-2">
          © 2026 QuoteMagic ·{" "}
          <Link href="/login" className="underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </footer>
    </main>
  );
}
