import Link from "next/link";
import { requireContractor } from "@/lib/contractor";
import {
  formatMoney,
  stageBadge,
  type JobStatus,
  type Quote,
} from "@/lib/types";

type QuoteRow = Quote & {
  jobs: { status: JobStatus }[] | { status: JobStatus } | null;
  customers: { name: string }[] | { name: string } | null;
};

// PostgREST returns embedded to-one relations as an object and to-many as an
// array; jobs.quote_id is unique so the shape depends on schema detection.
function first<T>(rel: T[] | T | null): T | null {
  if (rel === null) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

// Pipeline buckets derived from quote + job status.
type Stage =
  | "draft"
  | "awaiting"
  | "booked"
  | "in_progress"
  | "invoiced"
  | "paid"
  | "declined";

const STAGE_LABELS: Record<Stage, string> = {
  draft: "Draft",
  awaiting: "Awaiting reply",
  booked: "Booked",
  in_progress: "In progress",
  invoiced: "Invoiced",
  paid: "Paid",
  declined: "Declined",
};

function stageOf(q: QuoteRow): Stage {
  const job = first(q.jobs)?.status ?? null;
  if (job === "paid") return "paid";
  if (job === "invoiced") return "invoiced";
  if (job === "done_reported" || job === "confirmed") return "in_progress";
  if (job) return "booked"; // unscheduled | scheduled
  if (q.status === "draft") return "draft";
  if (q.status === "declined") return "declined";
  return "awaiting"; // sent | viewed (accepted without job shouldn't occur)
}

// Open pipeline = money still in motion (excludes drafts, declined, paid).
const OPEN_STAGES: Stage[] = ["awaiting", "booked", "in_progress", "invoiced"];

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { supabase, contractor } = await requireContractor();
  const { stage: stageFilter } = await searchParams;

  const { data } = await supabase
    .from("quotes")
    .select("*, jobs(status), customers(name)")
    .eq("contractor_id", contractor.id)
    .order("created_at", { ascending: false });

  const quotes = (data ?? []) as QuoteRow[];

  const counts = new Map<Stage, number>();
  let openTotal = 0;
  let wonTotal = 0;
  for (const q of quotes) {
    const stage = stageOf(q);
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
    if (OPEN_STAGES.includes(stage)) openTotal += Number(q.total);
    if (stage === "paid") wonTotal += Number(q.total);
  }

  const filtered =
    stageFilter && STAGE_LABELS[stageFilter as Stage]
      ? quotes.filter((q) => stageOf(q) === stageFilter)
      : quotes;

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">Quotes</h1>

      {quotes.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-zinc-500">No quotes yet.</p>
          <Link
            href="/quotes/new"
            className="mt-4 inline-block rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-white"
          >
            🎙️ Dictate your first quote
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
              <p className="text-lg font-bold text-zinc-900">
                {formatMoney(openTotal)}
              </p>
              <p className="text-[11px] text-zinc-500">open pipeline</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
              <p className="text-lg font-bold text-emerald-800">
                {formatMoney(wonTotal)}
              </p>
              <p className="text-[11px] text-emerald-700">won</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium">
            <Link
              href="/quotes"
              className={`rounded-full px-2.5 py-1 ${
                !stageFilter
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200"
              }`}
            >
              All {quotes.length}
            </Link>
            {(Object.keys(STAGE_LABELS) as Stage[])
              .filter((s) => (counts.get(s) ?? 0) > 0)
              .map((s) => (
                <Link
                  key={s}
                  href={`/quotes?stage=${s}`}
                  className={`rounded-full px-2.5 py-1 ${
                    stageFilter === s
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-600 ring-1 ring-zinc-200"
                  }`}
                >
                  {STAGE_LABELS[s]} {counts.get(s)}
                </Link>
              ))}
          </div>

          <ul className="mt-4 space-y-2">
            {filtered.map((q) => {
              const badge = stageBadge(q.status, first(q.jobs)?.status ?? null);
              const customerName = first(q.customers)?.name;
              return (
                <li key={q.id}>
                  <Link
                    href={`/quotes/${q.id}`}
                    className="block rounded-xl border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-zinc-900">
                        {q.title}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-sm text-zinc-500">
                      <span>
                        {customerName ? `${customerName} · ` : ""}
                        {new Date(q.created_at).toLocaleDateString()}
                      </span>
                      <span className="font-medium text-zinc-700">
                        {formatMoney(Number(q.total))}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
