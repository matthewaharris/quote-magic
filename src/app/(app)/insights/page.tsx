import Link from "next/link";
import { requireContractor } from "@/lib/contractor";
import { capabilitiesFor } from "@/lib/plan";
import { computeInsights } from "@/lib/insights";
import { narrateInsights } from "@/lib/ai/quote";
import { formatMoney } from "@/lib/types";

export const metadata = { title: "Insights — QuoteMagic" };

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

export default async function InsightsPage() {
  const { supabase, contractor } = await requireContractor();

  if (!capabilitiesFor(contractor).aiInsights) {
    return (
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Insights</h1>
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 text-center">
          <p className="text-2xl">📊</p>
          <p className="mt-2 font-semibold text-zinc-900">
            Insights is a Pro feature
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            See your win rate, average job value, and a plain-English read on
            how your quoting is going — with one tip to win more work.
          </p>
          <Link
            href="/settings/billing"
            className="mt-4 inline-block rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Upgrade to Pro
          </Link>
        </div>
      </div>
    );
  }

  const insights = await computeInsights(supabase, contractor.id);

  if (insights.sent === 0) {
    return (
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Insights</h1>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Send a few quotes and your insights will appear here.
        </p>
      </div>
    );
  }

  let narration = "";
  try {
    narration = await narrateInsights({
      metrics: {
        sent: insights.sent,
        accepted: insights.accepted,
        declined: insights.declined,
        pending: insights.pending,
        winRate: insights.winRate,
        acceptRateOfSent: insights.acceptRateOfSent,
        wonTotal: insights.wonTotal,
        avgWonValue: insights.avgWonValue,
        pipelineValue: insights.pipelineValue,
        avgResponseHours: insights.avgResponseHours,
      },
    });
  } catch {
    // Narration is a bonus — the numbers stand on their own if it fails.
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">Insights</h1>
      <p className="mt-1 text-sm text-zinc-500">
        How your quoting is going.
      </p>

      {narration && (
        <div className="mt-4 rounded-2xl bg-brand-gradient p-4 text-sm font-medium text-white shadow-sm">
          {narration}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Win rate (of answered quotes)" value={pct(insights.winRate)} />
        <Stat
          label="Avg won job"
          value={insights.avgWonValue === null ? "—" : formatMoney(insights.avgWonValue)}
        />
        <Stat label="Won total" value={formatMoney(insights.wonTotal)} />
        <Stat label="Open pipeline" value={formatMoney(insights.pipelineValue)} />
        <Stat label="Quotes sent" value={String(insights.sent)} />
        <Stat
          label="Avg time to reply"
          value={
            insights.avgResponseHours === null
              ? "—"
              : insights.avgResponseHours < 48
                ? `${Math.round(insights.avgResponseHours)}h`
                : `${Math.round(insights.avgResponseHours / 24)}d`
          }
        />
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
        <span className="font-semibold text-zinc-900">{insights.accepted}</span>{" "}
        accepted ·{" "}
        <span className="font-semibold text-zinc-900">{insights.declined}</span>{" "}
        declined ·{" "}
        <span className="font-semibold text-zinc-900">{insights.pending}</span>{" "}
        still open
      </div>

      <p className="mt-8 text-center text-xs text-zinc-400">
        <Link href="/settings" className="underline underline-offset-2">
          ← Back to settings
        </Link>
      </p>
    </div>
  );
}
