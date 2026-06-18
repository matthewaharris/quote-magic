import Link from "next/link";

export interface TradeCopy {
  /* e.g. "electrician" */
  name: string;
  /* e.g. "electricians" */
  plural: string;
  emoji: string;
  /* trade-flavored dictation example for step 1 */
  example: string;
}

export const TRADE_COPY: Record<string, TradeCopy> = {
  electrician: {
    name: "electrician",
    plural: "electricians",
    emoji: "⚡",
    example:
      "“Need a 50 amp breaker, 20 feet of 6/2 out to the hot tub, and a GFCI disconnect…”",
  },
  plumber: {
    name: "plumber",
    plural: "plumbers",
    emoji: "🔧",
    example:
      "“50 gallon gas water heater swap, haul away the old one, new shutoff valve…”",
  },
  handyman: {
    name: "handyman",
    plural: "handymen",
    emoji: "🛠️",
    example:
      "“Patch two drywall holes, rehang the closet door, swap five outlet covers…”",
  },
  landscaper: {
    name: "landscaper",
    plural: "landscapers",
    emoji: "🌿",
    example:
      "“Mulch the front beds, trim three hedges, and edge about 80 feet of walkway…”",
  },
  hauling: {
    name: "hauling pro",
    plural: "hauling pros",
    emoji: "🚛",
    example:
      "“Garage cleanout, about two truckloads, one couch, no hazardous stuff…”",
  },
  hvac: {
    name: "HVAC tech",
    plural: "HVAC techs",
    emoji: "❄️",
    example:
      "“Replace a 3-ton condenser and coil, new pad, reconnect the lineset…”",
  },
  painter: {
    name: "painter",
    plural: "painters",
    emoji: "🎨",
    example:
      "“Two bedrooms and a hallway, walls and trim, patch nail holes, two coats…”",
  },
  "general-contractor": {
    name: "general contractor",
    plural: "general contractors",
    emoji: "🏗️",
    example:
      "“Frame and drywall a basement office, one door, four outlets, drop ceiling…”",
  },
};

function Cta() {
  return (
    <Link
      href="/login"
      className="mt-8 block w-full rounded-xl bg-amber-600 px-5 py-3.5 text-center text-base font-semibold text-white shadow-sm hover:bg-amber-700 md:mx-auto md:max-w-xs"
    >
      Start quoting free
    </Link>
  );
}

const LIFECYCLE = ["quote", "accepted", "scheduled", "done", "invoiced", "paid"];

export default function Landing({ trade }: { trade?: TradeCopy }) {
  const steps = [
    {
      title: "🎙️ Dictate the job",
      body: trade
        ? `${trade.example} Talk it through on your phone, right from the driveway.`
        : "Talk through the work on your phone, right from the driveway.",
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

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-zinc-50 px-6 pb-10 pt-12 md:max-w-5xl md:px-10 md:pb-16 md:pt-20">
      <section className="mx-auto max-w-2xl text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/quotemagic-logo.jpg"
          alt="QuoteMagic"
          className="mx-auto w-44 rounded-3xl md:w-52"
        />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900 md:text-5xl md:leading-tight">
          {trade ? (
            <>
              {trade.emoji} Quoting for {trade.plural}.{" "}
              <span className="text-amber-600">Same day.</span>
            </>
          ) : (
            <>
              Dictate the job. Send the quote.{" "}
              <span className="text-amber-600">Same day.</span>
            </>
          )}
        </h1>
        <p className="mt-3 text-base text-zinc-600 md:text-lg">
          {trade
            ? `AI quoting built for solo ${trade.plural} — your prices, your price book, a customer link that closes the job.`
            : "AI quoting for solo trade contractors — your prices, your price book, a customer link that closes the job."}
        </p>
        <Cta />
        <Link
          href="/demo"
          className="mt-3 block text-center text-sm font-medium text-amber-700 underline underline-offset-2"
        >
          Try it now — no signup
        </Link>
        <p className="mt-3 text-xs text-zinc-500">
          Free for 14 days · 25 quotes · no card ·{" "}
          <Link href="/pricing" className="underline underline-offset-2">
            plans from $29/mo
          </Link>
        </p>
      </section>

      <section className="mx-auto mt-12 max-w-5xl md:mt-20">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 md:text-center">
          How it works
        </h2>
        <ul className="mt-4 grid gap-3 md:mt-6 md:grid-cols-3 md:gap-5">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 md:flex-col md:p-6"
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

      <section className="mx-auto mt-12 max-w-2xl rounded-2xl bg-zinc-900 p-5 text-center md:mt-20 md:p-8">
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

      <section className="mx-auto mt-12 max-w-2xl text-center md:mt-20">
        <p className="text-lg font-bold text-zinc-900 md:text-2xl">
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
          © 2026 Stait AI LLC — QuoteMagic is a product of Stait AI ·{" "}
          <Link href="/login" className="underline underline-offset-2">
            Sign in
          </Link>
        </p>
        <p className="mt-1">
          <Link href="/pricing" className="underline underline-offset-2">
            Pricing
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
        <p className="mx-auto mt-3 flex max-w-md flex-wrap justify-center gap-x-2 gap-y-1">
          {Object.entries(TRADE_COPY).map(([slug, t]) => (
            <Link
              key={slug}
              href={`/for/${slug}`}
              className="underline-offset-2 hover:underline"
            >
              For {t.plural}
            </Link>
          ))}
        </p>
      </footer>
    </main>
  );
}
