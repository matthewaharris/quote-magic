import type { SupabaseClient } from "@supabase/supabase-js";

// Pro insights: headline funnel + value metrics for a contractor's quotes.
// Same counting rule as billing/usage — a good/better/best group is one quote
// (its 'better' row), so the math matches what the contractor sees elsewhere.
export interface Insights {
  sent: number; // quotes that left draft
  accepted: number;
  declined: number;
  pending: number; // sent or viewed, no response yet
  winRate: number | null; // accepted / (accepted + declined), 0..1
  acceptRateOfSent: number | null; // accepted / sent, 0..1
  wonTotal: number;
  avgWonValue: number | null;
  pipelineValue: number; // total of still-open quotes
  avgResponseHours: number | null; // avg sent → responded, for responded quotes
}

type Row = {
  status: string;
  total: number | string;
  sent_at: string | null;
  responded_at: string | null;
};

export async function computeInsights(
  supabase: SupabaseClient,
  contractorId: string
): Promise<Insights> {
  const { data } = await supabase
    .from("quotes")
    .select("status, total, sent_at, responded_at, tier_group_id, tier")
    .eq("contractor_id", contractorId)
    .or("tier_group_id.is.null,tier.eq.better");

  const rows = ((data ?? []) as (Row & { tier_group_id: string | null })[]).filter(
    (r) => r.status !== "draft"
  );

  const accepted = rows.filter((r) => r.status === "accepted");
  const declined = rows.filter((r) => r.status === "declined");
  const pending = rows.filter(
    (r) => r.status === "sent" || r.status === "viewed"
  );
  const responded = [...accepted, ...declined].filter(
    (r) => r.sent_at && r.responded_at
  );

  const sum = (rs: Row[]) => rs.reduce((acc, r) => acc + Number(r.total), 0);
  const responseHours = responded.map(
    (r) =>
      (new Date(r.responded_at!).getTime() - new Date(r.sent_at!).getTime()) /
      3_600_000
  );

  const decided = accepted.length + declined.length;

  return {
    sent: rows.length,
    accepted: accepted.length,
    declined: declined.length,
    pending: pending.length,
    winRate: decided > 0 ? accepted.length / decided : null,
    acceptRateOfSent: rows.length > 0 ? accepted.length / rows.length : null,
    wonTotal: sum(accepted),
    avgWonValue: accepted.length > 0 ? sum(accepted) / accepted.length : null,
    pipelineValue: sum(pending),
    avgResponseHours:
      responseHours.length > 0
        ? responseHours.reduce((a, b) => a + b, 0) / responseHours.length
        : null,
  };
}
