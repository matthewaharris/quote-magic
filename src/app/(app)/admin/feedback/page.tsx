import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import type { Contractor, Feedback, FeedbackStatus } from "@/lib/types";
import { updateFeedback } from "../actions";

const STATUSES: FeedbackStatus[] = [
  "open",
  "planned",
  "in_progress",
  "done",
  "declined",
];

const statusBadge: Record<FeedbackStatus, string> = {
  open: "bg-amber-100 text-amber-700",
  planned: "bg-sky-100 text-sky-700",
  in_progress: "bg-violet-100 text-violet-700",
  done: "bg-emerald-100 text-emerald-700",
  declined: "bg-zinc-200 text-zinc-600",
};

const typeIcon: Record<string, string> = {
  bug: "🐞",
  feature: "💡",
  other: "💬",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { admin } = await requireAdmin();
  const { status } = await searchParams;

  const [{ data: feedbackData }, { data: contractorsData }] = await Promise.all([
    admin
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false }),
    admin.from("contractors").select("id, name, business_name, email"),
  ]);
  const feedback = (feedbackData ?? []) as Feedback[];
  const byId = new Map(
    ((contractorsData ?? []) as Pick<
      Contractor,
      "id" | "name" | "business_name" | "email"
    >[]).map((c) => [c.id, c])
  );

  const counts = feedback.reduce<Record<string, number>>((acc, f) => {
    acc[f.status] = (acc[f.status] ?? 0) + 1;
    return acc;
  }, {});

  const active = STATUSES.includes(status as FeedbackStatus)
    ? (status as FeedbackStatus)
    : null;
  const visible = active ? feedback.filter((f) => f.status === active) : feedback;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Feedback</h1>
        <Link
          href="/admin"
          className="text-xs text-zinc-500 underline-offset-2 hover:underline"
        >
          ← Admin
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Bug reports and ideas from contractors.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/admin/feedback"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !active ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200"
          }`}
        >
          all ({feedback.length})
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/feedback?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              active === s
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-600 ring-1 ring-zinc-200"
            }`}
          >
            {s.replace("_", " ")} ({counts[s] ?? 0})
          </Link>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="mt-6 text-center text-sm text-zinc-500">
          No feedback {active ? `with status “${active}”` : "yet"}.
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {visible.map((f) => {
          const who = byId.get(f.contractor_id);
          const whoLabel =
            who?.business_name || who?.name || who?.email || "Unknown";
          return (
            <li
              key={f.id}
              className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-900">
                  {typeIcon[f.type] ?? "💬"} {f.type}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge[f.status]}`}
                >
                  {f.status.replace("_", " ")}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">
                {f.message}
              </p>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                <Link
                  href={`/admin/${f.contractor_id}`}
                  className="underline-offset-2 hover:underline"
                >
                  {whoLabel}
                </Link>
                <span>{fmt(f.created_at)}</span>
                {f.page_url && <span className="text-zinc-400">{f.page_url}</span>}
              </div>

              <form
                action={updateFeedback}
                className="mt-3 border-t border-zinc-100 pt-3"
              >
                <input type="hidden" name="id" value={f.id} />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    name="status"
                    defaultValue={f.status}
                    className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                  <input
                    name="admin_notes"
                    defaultValue={f.admin_notes ?? ""}
                    placeholder="Private notes…"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                  />
                  <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                    Save
                  </button>
                </div>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
