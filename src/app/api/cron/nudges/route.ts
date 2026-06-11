import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendNudge } from "@/lib/nudge";

const MAX_SENDS_PER_RUN = 25;

// Vercel cron (vercel.json) hits this daily with
// Authorization: Bearer <CRON_SECRET>. Fails closed when the secret is unset.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const since = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Viewed-but-silent quotes; for 3-tier groups only the 'better' row is
  // nudged (its link is the tier-switcher entry point).
  const { data: candidates } = await supabase
    .from("quotes")
    .select("id")
    .eq("status", "viewed")
    .is("responded_at", null)
    .not("customer_id", "is", null)
    .gte("sent_at", since)
    .or("tier_group_id.is.null,tier.eq.better")
    .limit(200);

  let nudged = 0;
  const skipped: Record<string, number> = {};
  for (const candidate of candidates ?? []) {
    if (nudged >= MAX_SENDS_PER_RUN) break;
    const result = await sendNudge(supabase, candidate.id);
    if (result.ok) nudged++;
    else skipped[result.reason ?? "unknown"] = (skipped[result.reason ?? "unknown"] ?? 0) + 1;
  }

  return NextResponse.json({
    checked: candidates?.length ?? 0,
    nudged,
    skipped,
  });
}
