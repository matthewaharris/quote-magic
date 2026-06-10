import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateSlots, jobDurationMinutes } from "@/lib/scheduling";

// Available appointment slots for an accepted quote's job.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, contractor_id, est_total_minutes")
    .eq("share_token", token)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "No job" }, { status: 404 });

  // Other booked jobs for this contractor block the calendar.
  const { data: booked } = await supabase
    .from("jobs")
    .select("scheduled_start, scheduled_end")
    .eq("contractor_id", quote.contractor_id)
    .neq("id", job.id)
    .not("scheduled_start", "is", null);

  const busy = (booked ?? []).map((b) => ({
    start: new Date(b.scheduled_start as string),
    end: new Date(b.scheduled_end as string),
  }));

  const durationMinutes = jobDurationMinutes(quote.est_total_minutes);
  const days = generateSlots({ durationMinutes, busy });

  return NextResponse.json({ durationMinutes, days });
}
