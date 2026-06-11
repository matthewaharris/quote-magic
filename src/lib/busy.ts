import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusyInterval } from "@/lib/scheduling";

// Everything that blocks a contractor's calendar: other booked jobs plus
// manually entered busy blocks (pre-existing appointments, personal time).
export async function fetchBusyIntervals(
  supabase: SupabaseClient,
  contractorId: string,
  excludeJobId?: string
): Promise<BusyInterval[]> {
  let jobsQuery = supabase
    .from("jobs")
    .select("scheduled_start, scheduled_end")
    .eq("contractor_id", contractorId)
    .not("scheduled_start", "is", null);
  if (excludeJobId) jobsQuery = jobsQuery.neq("id", excludeJobId);

  const [{ data: booked }, { data: blocks }] = await Promise.all([
    jobsQuery,
    supabase
      .from("busy_blocks")
      .select("start_at, end_at")
      .eq("contractor_id", contractorId),
  ]);

  return [
    ...(booked ?? []).map((b) => ({
      start: new Date(b.scheduled_start as string),
      end: new Date(b.scheduled_end as string),
    })),
    ...(blocks ?? []).map((b) => ({
      start: new Date(b.start_at as string),
      end: new Date(b.end_at as string),
    })),
  ];
}
