import Link from "next/link";
import { requireContractor } from "@/lib/contractor";
import { parseAvailability, formatSlotRange } from "@/lib/scheduling";
import type { BusyBlock } from "@/lib/types";
import AvailabilityForm from "./AvailabilityForm";
import BusyBlocksPanel from "./BusyBlocksPanel";

// The contractor's calendar: weekly working hours that drive customer
// self-scheduling, plus busy blocks and the upcoming agenda.
export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { supabase, contractor } = await requireContractor();
  const { welcome } = await searchParams;
  const nowIso = new Date().toISOString();

  const [{ data: blockData }, { data: jobData }] = await Promise.all([
    supabase
      .from("busy_blocks")
      .select("*")
      .eq("contractor_id", contractor.id)
      .gte("end_at", nowIso)
      .order("start_at"),
    supabase
      .from("jobs")
      .select("id, quote_id, status, scheduled_start, scheduled_end, quotes(title)")
      .eq("contractor_id", contractor.id)
      .eq("status", "scheduled")
      .gte("scheduled_end", nowIso)
      .order("scheduled_start"),
  ]);
  const blocks = (blockData ?? []) as BusyBlock[];
  const jobs = (jobData ?? []) as unknown as {
    id: string;
    quote_id: string;
    scheduled_start: string;
    scheduled_end: string;
    quotes: { title: string } | null;
  }[];

  const agenda = [
    ...jobs.map((j) => ({
      key: `job-${j.id}`,
      start: j.scheduled_start,
      end: j.scheduled_end,
      title: j.quotes?.title ?? "Booked job",
      href: `/quotes/${j.quote_id}` as string | null,
    })),
    ...blocks.map((b) => ({
      key: `block-${b.id}`,
      start: b.start_at,
      end: b.end_at,
      title: b.title,
      href: null as string | null,
    })),
  ].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-zinc-900">Schedule</h1>
        <p className="text-sm text-zinc-500">
          Your hours and commitments decide what customers can book.
        </p>
      </header>

      {welcome && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">👋 One more thing — your calendar</p>
          <p className="mt-1">
            Set the hours you work and block off jobs you&apos;ve already
            committed to. When a customer accepts a quote they&apos;ll only
            see times you&apos;re actually free.
          </p>
          <Link
            href="/quotes/new"
            className="mt-2 inline-block font-semibold underline underline-offset-2"
          >
            Done? Create your first quote →
          </Link>
        </div>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
        <h2 className="font-semibold text-zinc-900">Coming up</h2>
        {agenda.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">
            Nothing on the calendar yet. Booked jobs and blocked time show up
            here.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100">
            {agenda.map((item) => (
              <li key={item.key} className="py-2.5">
                {item.href ? (
                  <Link href={item.href} className="block">
                    <p className="text-sm font-medium text-zinc-800">
                      🛠 {item.title}
                    </p>
                    <p className="text-xs text-sky-700">
                      {formatSlotRange(item.start, item.end)} · booked job →
                    </p>
                  </Link>
                ) : (
                  <>
                    <p className="text-sm font-medium text-zinc-800">
                      ⛔ {item.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatSlotRange(item.start, item.end)} · blocked
                    </p>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AvailabilityForm initial={parseAvailability(contractor.availability)} />
      <BusyBlocksPanel blocks={blocks} />
    </div>
  );
}
