"use client";

import { useState } from "react";
import Link from "next/link";

// Canned interactive demo — sample data only, no auth, no DB, no AI calls.
// Shows the dictate → quote → accept → schedule arc in ~30 seconds. The trial
// length is passed in from the server page so the footer matches the
// admin-set global (src/lib/settings.ts).

const TRANSCRIPT =
  "Customer wants a sauna hooked up. Need a 50 amp breaker in the main panel, have to move a couple breakers to make room, run about 20 feet of 6/2 out to the sauna, 240 volt disconnect, add a GFCI outlet next to it, then hardwire the control box and the 9 kW heater.";

const LINES = [
  { name: "50A double-pole breaker", desc: "Install a new 50-amp double-pole breaker in the main panel for the sauna.", qty: "1 each × $185.00", total: "$185.00" },
  { name: "Panel rework to make space", desc: "Rearrange existing breakers and label the panel.", qty: "1 hour × $150.00", total: "$150.00" },
  { name: "6/2 cable run to sauna", desc: "Run heavy-gauge cable from the panel to the sauna location.", qty: "25 foot × $12.00", total: "$300.00" },
  { name: "240V disconnect box", desc: "Install a 240-volt disconnect box next to the sauna.", qty: "1 each × $260.00", total: "$260.00" },
  { name: "GFCI outlet", desc: "Add a GFCI-protected outlet next to the sauna disconnect.", qty: "1 each × $145.00", total: "$145.00" },
  { name: "Sauna control box hookup", desc: "Hardwire the connection into the sauna control box.", qty: "1 each × $180.00", total: "$180.00" },
  { name: "9kW heater connection", desc: "Terminate the conductors at the sauna heater per manufacturer specs.", qty: "1 each × $200.00", total: "$200.00" },
  { name: "Drywall patch", desc: "Patch one small drywall hole after the wiring work.", qty: "1 hour × $100.00", total: "$100.00" },
];

type Step = "dictate" | "generating" | "quote" | "scheduled";

export default function DemoClient({ trialDays }: { trialDays: number }) {
  const [step, setStep] = useState<Step>("dictate");

  function generate() {
    setStep("generating");
    setTimeout(() => setStep("quote"), 2500);
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-zinc-50 px-6 pb-10 pt-10">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-medium text-amber-800">
        Demo with sample data — your quotes use <strong>your</strong> prices.
      </div>

      <h1 className="mt-6 text-center text-2xl font-bold text-zinc-900">
        Try QuoteMagic in 30 seconds
      </h1>

      {step === "dictate" && (
        <>
          <p className="mt-2 text-center text-sm text-zinc-500">
            An electrician just dictated this from the driveway:
          </p>
          <div className="mt-4 rounded-xl border border-zinc-300 bg-white p-4 text-sm leading-relaxed text-zinc-700">
            🎙️ “{TRANSCRIPT}”
          </div>
          <button
            onClick={generate}
            className="mt-4 w-full rounded-xl bg-amber-600 px-4 py-4 text-base font-semibold text-white shadow"
          >
            ✨ Generate quote
          </button>
        </>
      )}

      {step === "generating" && (
        <div className="mt-10 text-center">
          <p className="animate-pulse text-4xl">✨</p>
          <p className="mt-3 text-sm text-zinc-500">
            Matching the price book, computing labor…
          </p>
        </div>
      )}

      {(step === "quote" || step === "scheduled") && (
        <>
          <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <h2 className="text-lg font-semibold text-zinc-900">
              Sauna 240V circuit and hookup
            </h2>
            <ul className="mt-3 divide-y divide-zinc-100">
              {LINES.map((line) => (
                <li key={line.name} className="py-2.5">
                  <div className="flex justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-800">
                      {line.name}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-zinc-800">
                      {line.total}
                    </span>
                  </div>
                  <div className="mt-0.5 flex justify-between gap-3 text-xs text-zinc-500">
                    <span>{line.desc}</span>
                    <span className="shrink-0">{line.qty}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex justify-between border-t border-zinc-200 pt-3 text-xl font-bold text-zinc-900">
              <span>Total</span>
              <span>$1,520.00</span>
            </div>
            <p className="mt-1 text-right text-xs text-zinc-400">
              Estimated time on site: 7 hr 30 min
            </p>
          </section>

          {step === "quote" && (
            <>
              <p className="mt-4 text-center text-xs text-zinc-500">
                Your customer gets this as a link — here&apos;s their side:
              </p>
              <button
                onClick={() => setStep("scheduled")}
                className="mt-2 w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white shadow"
              >
                Accept quote
              </button>
            </>
          )}

          {step === "scheduled" && (
            <div className="mt-4 rounded-2xl bg-sky-50 p-5 text-center ring-1 ring-sky-200">
              <p className="text-sm font-medium text-sky-700">
                📅 Accepted &amp; scheduled
              </p>
              <p className="mt-1 font-bold text-sky-900">
                Fri, 8:00 AM – 4:00 PM
              </p>
              <p className="mt-2 text-xs text-sky-700">
                From here: job done → customer confirms → invoice issues
                itself → customer pays online. One link, the whole job.
              </p>
            </div>
          )}
        </>
      )}

      <div className="mt-8 text-center">
        <Link
          href="/login"
          className="block w-full rounded-xl bg-zinc-900 px-5 py-3.5 text-base font-semibold text-white"
        >
          Start free — quote your own jobs
        </Link>
        <p className="mt-2 text-xs text-zinc-500">
          {trialDays} days · 25 quotes · no card
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-xs text-zinc-400 underline underline-offset-2"
        >
          ← Back to quotemagic.app
        </Link>
      </div>
    </main>
  );
}
