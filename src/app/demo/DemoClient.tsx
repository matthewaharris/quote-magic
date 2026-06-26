"use client";

import { useState } from "react";
import Link from "next/link";

// Canned, interactive product tour — sample data only, no auth, no DB, no AI
// calls. Walks the full lifecycle a contractor and their customer actually
// experience, including the part that sets QuoteMagic apart: editing an AI
// suggestion, saving it to the price book, and watching the NEXT quote use that
// saved price instead of guessing. trialDays comes from the server page so the
// footer matches the admin-set global (src/lib/settings.ts).

type Src = "ai" | "edited" | "book";

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Line {
  name: string;
  qty: string;
  total: number;
  src: Src;
}

// First job. The breaker is the line the contractor will correct + save.
const sauna = (breaker: number, breakerSrc: Src): Line[] => [
  { name: "50A double-pole breaker", qty: "1 each", total: breaker, src: breakerSrc },
  { name: "Panel rework to make space", qty: "1 hour", total: 150, src: "ai" },
  { name: "6/2 cable run to sauna", qty: "25 ft", total: 300, src: "ai" },
  { name: "240V disconnect box", qty: "1 each", total: 260, src: "ai" },
  { name: "GFCI outlet", qty: "1 each", total: 145, src: "ai" },
  { name: "Sauna control box hookup", qty: "1 each", total: 180, src: "ai" },
  { name: "9kW heater connection", qty: "1 each", total: 200, src: "ai" },
  { name: "Drywall patch", qty: "1 hour", total: 100, src: "ai" },
];

// Second job — note the breaker now comes from the price book, not the AI.
const HOTTUB: Line[] = [
  { name: "50A double-pole breaker", qty: "1 each", total: 165, src: "book" },
  { name: "6/3 cable run to hot tub", qty: "30 ft", total: 420, src: "ai" },
  { name: "240V disconnect box", qty: "1 each", total: 260, src: "ai" },
  { name: "GFCI protection", qty: "1 each", total: 145, src: "ai" },
  { name: "Hot tub final hookup", qty: "1 each", total: 150, src: "ai" },
];

const sum = (ls: Line[]) => ls.reduce((s, l) => s + l.total, 0);
const HOTTUB_TOTAL = sum(HOTTUB); // 1140

const SCENES = [
  { id: "dictate", label: "Dictate the job" },
  { id: "suggested", label: "AI drafts the quote" },
  { id: "editing", label: "Make it yours" },
  { id: "saved", label: "It learns your price" },
  { id: "dictate2", label: "The next job" },
  { id: "quote2", label: "Now it uses your price" },
  { id: "email", label: "Your customer gets a link" },
  { id: "accept", label: "They accept — their view" },
  { id: "schedule", label: "They pick a time" },
  { id: "confirm", label: "Job done — they confirm" },
  { id: "invoice", label: "The invoice issues itself" },
  { id: "paid", label: "Paid — the whole job" },
] as const;

type SceneId = (typeof SCENES)[number]["id"];

const SRC_PILL: Record<Src, [string, string]> = {
  ai: ["✨ AI suggested", "bg-amber-100 text-amber-700"],
  edited: ["✏️ Your price", "bg-emerald-100 text-emerald-700"],
  book: ["📕 From your price book", "bg-indigo-100 text-indigo-700"],
};

function Pill({ src }: { src: Src }) {
  const [text, cls] = SRC_PILL[src];
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {text}
    </span>
  );
}

function Guide({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-medium text-amber-800">
      {children}
    </div>
  );
}

function QuoteCard({
  title,
  lines,
  highlightBook,
}: {
  title: string;
  lines: Line[];
  highlightBook?: boolean;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <h2 className="font-semibold text-zinc-900">{title}</h2>
      <ul className="mt-2 divide-y divide-zinc-100">
        {lines.map((l, idx) => (
          <li
            key={idx}
            className={`py-2 ${
              highlightBook && l.src === "book"
                ? "-mx-2 rounded-lg bg-indigo-50 px-2 ring-1 ring-indigo-200"
                : ""
            }`}
          >
            <div className="flex justify-between gap-2">
              <span className="text-sm font-medium text-zinc-800">{l.name}</span>
              <span className="shrink-0 text-sm font-medium text-zinc-800">
                {money(l.total)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <Pill src={l.src} />
              <span className="text-[11px] text-zinc-400">{l.qty}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 text-lg font-bold text-zinc-900">
        <span>Total</span>
        <span>{money(sum(lines))}</span>
      </div>
    </section>
  );
}

// Small brand header used on the customer-facing screens.
function CustomerBrand() {
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/quotemagic-icon.png" alt="" className="h-7 w-7 rounded-md" />
      <span className="text-sm font-bold text-zinc-900">Demo Electric Co.</span>
    </div>
  );
}

export default function DemoClient({ trialDays }: { trialDays: number }) {
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const scene = SCENES[i].id;

  function generate(target: number) {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setI(target);
    }, 1600);
  }

  // Footer advance button per scene. The interactive scenes (accept, schedule,
  // confirm) advance from buttons inside their own content instead.
  const advance: Partial<Record<SceneId, { label: string; fn: () => void }>> = {
    dictate: { label: "✨ Generate quote", fn: () => generate(1) },
    suggested: { label: "Edit the AI’s breaker price →", fn: () => setI(2) },
    editing: { label: "💾 Save to quote + price book", fn: () => setI(3) },
    saved: { label: "Quote the next job →", fn: () => setI(4) },
    dictate2: { label: "✨ Generate quote", fn: () => generate(5) },
    quote2: { label: "📲 Send to customer →", fn: () => setI(6) },
    email: { label: "👀 Open as the customer →", fn: () => setI(7) },
    invoice: { label: "💳 Pay online (demo)", fn: () => setI(11) },
  };
  const footer = advance[scene];

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-zinc-50 px-6 pb-10 pt-8">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-medium text-amber-800">
        Interactive demo — sample data. Your quotes use <strong>your</strong> prices.
      </div>

      {/* Progress */}
      <div className="mt-5 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {i + 1} / {SCENES.length} · {SCENES[i].label}
        </span>
        {i > 0 && (
          <button
            onClick={() => {
              setPicked(null);
              setI(0);
            }}
            className="underline underline-offset-2 hover:text-zinc-700"
          >
            Restart
          </button>
        )}
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-zinc-200">
        <div
          className="h-1 rounded-full bg-amber-500 transition-all"
          style={{ width: `${((i + 1) / SCENES.length) * 100}%` }}
        />
      </div>

      <div className="mt-5">
        {busy ? (
          <div className="py-16 text-center">
            <p className="animate-pulse text-4xl">✨</p>
            <p className="mt-3 text-sm text-zinc-500">
              Matching your price book, computing labor…
            </p>
          </div>
        ) : (
          <>
            {scene === "dictate" && (
              <>
                <Guide>
                  Talk through the work on your phone — no typing, no forms.
                </Guide>
                <div className="mt-4 rounded-xl border border-zinc-300 bg-white p-4 text-sm leading-relaxed text-zinc-700">
                  🎙️ “Customer wants a sauna hooked up. 50 amp breaker in the
                  main panel, move a couple breakers to make room, run about 20
                  feet of 6/2 out to the sauna, 240 volt disconnect, a GFCI
                  outlet, then hardwire the control box and the 9 kW heater.”
                </div>
              </>
            )}

            {scene === "suggested" && (
              <>
                <Guide>
                  Claude drafts the whole quote from the job. Everything is
                  marked <strong>✨ AI suggested</strong> — these are first
                  guesses you can change.
                </Guide>
                <div className="mt-4">
                  <QuoteCard
                    title="Sauna 240V circuit and hookup"
                    lines={sauna(185, "ai")}
                  />
                </div>
              </>
            )}

            {scene === "editing" && (
              <>
                <Guide>
                  AI guessed <strong>$185</strong> for the breaker. Set it to
                  what you actually charge — and save it so you never re-enter
                  it.
                </Guide>
                <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                  <p className="text-sm font-medium text-zinc-800">
                    50A double-pole breaker
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <span className="text-zinc-400 line-through">$185.00</span>
                    <span className="text-zinc-400">→</span>
                    <span className="rounded-lg border-2 border-amber-500 px-3 py-1.5 font-semibold text-zinc-900">
                      $165.00
                    </span>
                    <span className="text-xs text-zinc-500">your price</span>
                  </div>
                  <label className="mt-4 flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked
                      readOnly
                      className="h-4 w-4 accent-emerald-600"
                    />
                    Add this to my price book
                  </label>
                </div>
              </>
            )}

            {scene === "saved" && (
              <>
                <Guide>
                  Saved. The breaker is now <strong>$165</strong> on this quote —
                  and in your price book.
                </Guide>
                <div className="mt-4">
                  <QuoteCard
                    title="Sauna 240V circuit and hookup"
                    lines={sauna(165, "edited")}
                  />
                </div>
                <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    📕 Your price book
                  </p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-800">
                      50A double-pole breaker
                    </span>
                    <span className="font-semibold text-zinc-800">$165.00</span>
                  </div>
                  <span className="mt-1 inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    Learned
                  </span>
                </div>
              </>
            )}

            {scene === "dictate2" && (
              <>
                <Guide>
                  A week later, a different customer. Watch what happens to the
                  breaker this time.
                </Guide>
                <div className="mt-4 rounded-xl border border-zinc-300 bg-white p-4 text-sm leading-relaxed text-zinc-700">
                  🎙️ “Hot tub out back. Another 50 amp breaker, run about 30 feet
                  of 6/3 out to the pad, 240 disconnect, GFCI protection, then
                  the final hookup to the tub.”
                </div>
              </>
            )}

            {scene === "quote2" && (
              <>
                <Guide>
                  See the highlighted line? The <strong>50A breaker</strong> came
                  straight from your price book at <strong>$165</strong> — no
                  guessing. Only the genuinely new work is AI-suggested.
                </Guide>
                <div className="mt-4">
                  <QuoteCard title="Hot tub 240V circuit" lines={HOTTUB} highlightBook />
                </div>
              </>
            )}

            {scene === "email" && (
              <>
                <Guide>
                  One tap sends it. Here is the email — or text — your customer
                  gets. No app for them to install.
                </Guide>
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/quotemagic-icon.png"
                    alt=""
                    className="h-9 w-9 rounded-md"
                  />
                  <p className="mt-3 font-bold text-zinc-900">Demo Electric Co.</p>
                  <p className="text-sm text-zinc-500">sent you a quote</p>
                  <div className="mt-3 rounded-xl border border-zinc-200 p-3">
                    <p className="font-medium text-zinc-800">Hot tub 240V circuit</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-900">
                      {money(HOTTUB_TOTAL)}
                    </p>
                  </div>
                  <div className="mt-3 rounded-xl bg-zinc-900 py-3 text-center text-sm font-semibold text-white">
                    View &amp; respond to quote
                  </div>
                </div>
              </>
            )}

            {scene === "accept" && (
              <>
                <Guide>
                  The customer&apos;s side — your logo, your business, mobile.
                  They see clean line items (no AI tags) and tap one button.
                </Guide>
                <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
                  <CustomerBrand />
                  <h2 className="mt-3 font-semibold text-zinc-900">
                    Hot tub 240V circuit
                  </h2>
                  <ul className="mt-2 divide-y divide-zinc-100">
                    {HOTTUB.map((l) => (
                      <li
                        key={l.name}
                        className="flex justify-between gap-2 py-1.5 text-sm"
                      >
                        <span className="text-zinc-700">{l.name}</span>
                        <span className="shrink-0 font-medium text-zinc-800">
                          {money(l.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1 flex justify-between border-t border-zinc-200 pt-2 text-lg font-bold text-zinc-900">
                    <span>Total</span>
                    <span>{money(HOTTUB_TOTAL)}</span>
                  </div>
                  <button
                    onClick={() => setI(8)}
                    className="mt-4 w-full rounded-2xl bg-emerald-600 py-3.5 text-base font-bold text-white shadow"
                  >
                    Accept quote
                  </button>
                  <p className="mt-2 text-center text-xs text-zinc-400">
                    Ask a question · Decline
                  </p>
                </div>
                <p className="mt-2 text-center text-[11px] text-zinc-400">
                  Powered by QuoteMagic
                </p>
              </>
            )}

            {scene === "schedule" && (
              <>
                <Guide>
                  They pick from times you are actually open — no phone tag. You
                  get notified the moment they book.
                </Guide>
                {!picked ? (
                  <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
                    <CustomerBrand />
                    <p className="mt-3 font-semibold text-zinc-900">
                      Pick a time
                    </p>
                    <div className="mt-3 grid gap-2">
                      {[
                        "Thu · 8:00 AM – 4:00 PM",
                        "Fri · 8:00 AM – 4:00 PM",
                        "Mon · 8:00 AM – 4:00 PM",
                      ].map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setPicked(slot)}
                          className="rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 hover:border-amber-500 hover:bg-amber-50"
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl bg-sky-50 p-5 text-center ring-1 ring-sky-200">
                    <p className="text-sm font-medium text-sky-700">
                      📅 Booked &amp; on the calendar
                    </p>
                    <p className="mt-1 font-bold text-sky-900">{picked}</p>
                    <p className="mt-2 text-xs text-sky-700">
                      A calendar invite went to you both. Need to change it? They
                      reschedule themselves — no back-and-forth.
                    </p>
                    <button
                      onClick={() => setI(9)}
                      className="mt-4 w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white"
                    >
                      What happens after the job →
                    </button>
                  </div>
                )}
              </>
            )}

            {scene === "confirm" && (
              <>
                <Guide>
                  You finish the work and mark it done. The customer gets a
                  one-tap “all good?” — and confirming is what fires the invoice.
                </Guide>
                <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
                  <CustomerBrand />
                  <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
                    ✅ Demo Electric Co. marked this job complete.
                  </div>
                  <h2 className="mt-3 font-semibold text-zinc-900">
                    Hot tub 240V circuit
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Everything look good on your end?
                  </p>
                  <button
                    onClick={() => setI(10)}
                    className="mt-4 w-full rounded-2xl bg-emerald-600 py-3.5 text-base font-bold text-white shadow"
                  >
                    Yes — confirm it&apos;s done
                  </button>
                  <p className="mt-2 text-center text-xs text-zinc-400">
                    Something off? Let them know
                  </p>
                </div>
              </>
            )}

            {scene === "invoice" && (
              <>
                <Guide>
                  The moment they confirm, the invoice issues itself — numbered,
                  net-7, nothing to retype. They pay from the same link.
                </Guide>
                <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-400">
                        Invoice
                      </p>
                      <p className="font-bold text-zinc-900">QM-1042</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase text-amber-800">
                      due
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-sm text-zinc-500">
                    <div className="flex justify-between">
                      <span>Hot tub 240V circuit</span>
                      <span>{money(HOTTUB_TOTAL)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Net 7 · due in 7 days</span>
                      <span>—</span>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-zinc-100 pt-2 text-lg font-bold text-zinc-900">
                    <span>Amount due</span>
                    <span>{money(HOTTUB_TOTAL)}</span>
                  </div>
                </div>
              </>
            )}

            {scene === "paid" && (
              <>
                <div className="mt-2 rounded-2xl bg-emerald-50 p-6 text-center ring-1 ring-emerald-200">
                  <p className="text-3xl">✅</p>
                  <p className="mt-2 text-lg font-bold text-emerald-900">
                    Paid — {money(HOTTUB_TOTAL)}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Receipt emailed · Ref SIM-7F3A2
                  </p>
                  <p className="mt-3 text-sm text-emerald-800">
                    Dictated → quoted → edited → sent → accepted → scheduled →
                    confirmed → invoiced → paid. One link ran the whole job.
                  </p>
                </div>
                <div className="mt-3">
                  <Guide>
                    And every price you tweaked is in your price book — so the
                    next quote is even faster and already yours.
                  </Guide>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Per-scene advance button */}
      {!busy && footer && (
        <button
          onClick={footer.fn}
          className="mt-5 w-full rounded-xl bg-amber-600 px-4 py-4 text-base font-semibold text-white shadow"
        >
          {footer.label}
        </button>
      )}

      {/* Back + persistent conversion path */}
      <div className="mt-6 text-center">
        {i > 0 && !busy && (
          <button
            onClick={() => setI(i - 1)}
            className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600"
          >
            ← Back
          </button>
        )}
        <Link
          href="/login"
          className={`mt-3 block w-full rounded-xl px-5 py-3.5 text-base font-semibold text-white ${
            scene === "paid" ? "bg-brand-gradient shadow-lg" : "bg-zinc-900"
          }`}
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
