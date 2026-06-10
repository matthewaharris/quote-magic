import Link from "next/link";
import { requireContractor } from "@/lib/contractor";
import {
  formatMoney,
  stageBadge,
  type JobStatus,
  type Quote,
} from "@/lib/types";

type QuoteRow = Quote & { jobs: { status: JobStatus }[] | null };

export default async function QuotesPage() {
  const { supabase, contractor } = await requireContractor();

  const { data } = await supabase
    .from("quotes")
    .select("*, jobs(status)")
    .eq("contractor_id", contractor.id)
    .order("created_at", { ascending: false });

  const quotes = (data ?? []) as QuoteRow[];

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
        <ul className="mt-4 space-y-2">
          {quotes.map((q) => {
            const badge = stageBadge(q.status, q.jobs?.[0]?.status ?? null);
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
                    <span>{new Date(q.created_at).toLocaleDateString()}</span>
                    <span className="font-medium text-zinc-700">
                      {formatMoney(Number(q.total))}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
