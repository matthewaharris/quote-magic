import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { actionEmailHtml, escapeHtml, sendEmail } from "@/lib/email";
import {
  formatSlotRange,
  generateSlots,
  jobDurationMinutes,
  parseAvailability,
} from "@/lib/scheduling";
import { fetchBusyIntervals } from "@/lib/busy";

// Customer books a slot for an accepted quote — or moves an existing
// booking to a new slot (every offered slot is open on the contractor's
// calendar, so a reschedule books directly and notifies them).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = (await request.json().catch(() => null)) as {
    start?: string;
  } | null;
  if (!body?.start) {
    return NextResponse.json({ error: "start required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, contractor_id, title, est_total_minutes, duration_override_minutes"
    )
    .eq("share_token", token)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, status, scheduled_start, scheduled_end, deposit_amount, deposit_paid_at"
    )
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "No job" }, { status: 404 });
  if (job.status !== "unscheduled" && job.status !== "scheduled") {
    return NextResponse.json(
      { error: "This job can no longer be scheduled." },
      { status: 409 }
    );
  }
  const isReschedule = job.status === "scheduled" && !!job.scheduled_start;
  // Once the appointment has started, moving it is a conversation with the
  // contractor, not a self-serve rebooking.
  if (isReschedule && new Date(job.scheduled_start!) <= new Date()) {
    return NextResponse.json(
      { error: "This appointment has already started — contact your contractor to make changes." },
      { status: 409 }
    );
  }
  // The deposit gate on the customer page is UI only — enforce it here.
  if (Number(job.deposit_amount) > 0 && !job.deposit_paid_at) {
    return NextResponse.json(
      { error: "Deposit required before scheduling." },
      { status: 409 }
    );
  }

  const { data: contractorData } = await supabase
    .from("contractors")
    .select("email, business_name, availability")
    .eq("id", quote.contractor_id)
    .single();
  const availability = parseAvailability(contractorData?.availability);

  // Re-validate the requested slot against current availability.
  const busy = await fetchBusyIntervals(supabase, quote.contractor_id, job.id);

  const durationMinutes =
    quote.duration_override_minutes ??
    jobDurationMinutes(quote.est_total_minutes, availability);
  const valid = generateSlots({ durationMinutes, busy, availability }).some(
    (d) => d.slots.includes(body.start!)
  );
  if (!valid) {
    return NextResponse.json(
      { error: "That time is no longer available — pick another slot." },
      { status: 409 }
    );
  }

  const start = new Date(body.start);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  await supabase
    .from("jobs")
    .update({
      status: "scheduled",
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
    })
    .eq("id", job.id);
  await supabase.from("quote_events").insert({
    quote_id: quote.id,
    type: isReschedule ? "rescheduled" : "scheduled",
    meta: {
      start: start.toISOString(),
      end: end.toISOString(),
      ...(isReschedule ? { previous_start: job.scheduled_start } : {}),
    },
  });

  if (contractorData?.email) {
    const when = formatSlotRange(start.toISOString(), end.toISOString());
    if (isReschedule) {
      const wasWhen = formatSlotRange(
        job.scheduled_start!,
        job.scheduled_end ?? job.scheduled_start!
      );
      await sendEmail({
        to: contractorData.email,
        subject: `🔁 Job rescheduled: ${quote.title} — now ${when}`,
        html: actionEmailHtml({
          heading: "Job rescheduled",
          body: `The customer moved "<strong>${escapeHtml(quote.title)}</strong>" from <strong>${wasWhen}</strong> to <strong>${when}</strong>.`,
        }),
      });
    } else {
      await sendEmail({
        to: contractorData.email,
        subject: `📅 Job booked: ${quote.title} — ${when}`,
        html: actionEmailHtml({
          heading: "Job booked",
          body: `The customer scheduled "<strong>${escapeHtml(quote.title)}</strong>" for <strong>${when}</strong>.`,
        }),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    start: start.toISOString(),
    end: end.toISOString(),
  });
}
