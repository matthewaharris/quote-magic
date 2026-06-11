import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  generateSlots,
  jobDurationMinutes,
  parseAvailability,
} from "@/lib/scheduling";
import { fetchBusyIntervals } from "@/lib/busy";

// Available appointment slots for an accepted quote's job.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, contractor_id, est_total_minutes, duration_override_minutes")
    .eq("share_token", token)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "No job" }, { status: 404 });

  const { data: contractor } = await supabase
    .from("contractors")
    .select("availability")
    .eq("id", quote.contractor_id)
    .single();
  const availability = parseAvailability(contractor?.availability);

  // Other booked jobs and busy blocks block the calendar. This job's own
  // current slot is excluded so rescheduling can move around it.
  const busy = await fetchBusyIntervals(supabase, quote.contractor_id, job.id);

  const durationMinutes =
    quote.duration_override_minutes ??
    jobDurationMinutes(quote.est_total_minutes, availability);
  const days = generateSlots({ durationMinutes, busy, availability });

  return NextResponse.json({ durationMinutes, days });
}
