import { requireAdmin } from "@/lib/admin";
import type { Contractor, ContractorPlan } from "@/lib/types";
import {
  compContractor,
  disableContractor,
  extendTrial,
  reenableContractor,
} from "./actions";

const planBadge: Record<ContractorPlan, { label: string; className: string }> =
  {
    trial: { label: "trial", className: "bg-amber-100 text-amber-700" },
    comp: { label: "comp", className: "bg-sky-100 text-sky-700" },
    paid: { label: "paid", className: "bg-emerald-100 text-emerald-700" },
    disabled: { label: "disabled", className: "bg-red-100 text-red-700" },
  };

const actionButton =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminPage() {
  const { contractor: me, admin } = await requireAdmin();

  const [{ data: contractorsData }, { data: quotesData }] = await Promise.all([
    admin
      .from("contractors")
      .select("*")
      .order("created_at", { ascending: true }),
    admin.from("quotes").select("contractor_id, created_at"),
  ]);
  const contractors = (contractorsData ?? []) as Contractor[];
  const quotes = (quotesData ?? []) as {
    contractor_id: string;
    created_at: string;
  }[];

  const usage = new Map<string, { count: number; lastAt: string | null }>();
  for (const q of quotes) {
    const u = usage.get(q.contractor_id) ?? { count: 0, lastAt: null };
    u.count += 1;
    if (!u.lastAt || q.created_at > u.lastAt) u.lastAt = q.created_at;
    usage.set(q.contractor_id, u);
  }

  const planCounts = contractors.reduce<Record<string, number>>((acc, c) => {
    acc[c.plan] = (acc[c.plan] ?? 0) + 1;
    return acc;
  }, {});

  const chips: { label: string; value: number }[] = [
    { label: "contractors", value: contractors.length },
    { label: "quotes all-time", value: quotes.length },
    ...(["trial", "comp", "paid", "disabled"] as ContractorPlan[])
      .filter((p) => (planCounts[p] ?? 0) > 0)
      .map((p) => ({ label: p, value: planCounts[p] })),
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">Admin</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Every contractor on QuoteMagic.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {chips.map((chip) => (
          <div
            key={chip.label}
            className="rounded-xl bg-white p-3 text-center ring-1 ring-zinc-200"
          >
            <p className="text-lg font-bold text-zinc-900">{chip.value}</p>
            <p className="text-[11px] text-zinc-500">{chip.label}</p>
          </div>
        ))}
      </div>

      <ul className="mt-6 space-y-3">
        {contractors.map((c) => {
          const u = usage.get(c.id) ?? { count: 0, lastAt: null };
          const badge = planBadge[c.plan];
          const daysLeft = Math.max(
            0,
            Math.ceil(
              (new Date(c.trial_ends_at).getTime() - Date.now()) /
                (24 * 60 * 60 * 1000)
            )
          );
          return (
            <li
              key={c.id}
              className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-zinc-900">
                  {c.name || c.business_name || "—"}
                  {c.name && c.business_name && (
                    <span className="font-normal text-zinc-500">
                      {" "}
                      · {c.business_name}
                    </span>
                  )}
                  {c.id === me.id && (
                    <span className="font-normal text-zinc-400"> (you)</span>
                  )}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              <p className="text-xs text-zinc-500">{c.email}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-600">
                <span>Signed up {fmtDate(c.created_at)}</span>
                <span>
                  Quotes {u.count}/
                  {c.plan === "trial" ? c.trial_quote_limit : "∞"}
                </span>
                {c.plan === "trial" && (
                  <span>
                    Trial ends {fmtDate(c.trial_ends_at)} ({daysLeft}d left)
                  </span>
                )}
                <span>Last active {fmtDate(u.lastAt)}</span>
                <span>{c.onboarded_at ? "Onboarded ✓" : "Not onboarded"}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.plan !== "comp" && (
                  <form action={compContractor.bind(null, c.id)}>
                    <button className={actionButton}>Comp</button>
                  </form>
                )}
                {c.plan === "trial" && (
                  <form action={extendTrial.bind(null, c.id)}>
                    <button className={actionButton}>Extend +14d/+25</button>
                  </form>
                )}
                {c.plan !== "disabled" && c.id !== me.id && (
                  <form action={disableContractor.bind(null, c.id)}>
                    <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                      Disable
                    </button>
                  </form>
                )}
                {c.plan === "disabled" && (
                  <form action={reenableContractor.bind(null, c.id)}>
                    <button className={actionButton}>Re-enable</button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
