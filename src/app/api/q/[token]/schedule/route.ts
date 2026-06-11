import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { actionEmailHtml, sendEmail } from "@/lib/email";
import {
  formatSlotRange,
  generateSlots,
  jobDurationMinutes,
} from "@/lib/scheduling";

// Customer books a slot for an accepted quote.
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
    .select("id, contractor_id, title, est_total_minutes")
    .eq("share_token", token)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, deposit_amount, deposit_paid_at")
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "No job" }, { status: 404 });
  if (job.status !== "unscheduled" && job.status !== "scheduled") {
    return NextResponse.json(
      { error: "This job can no longer be scheduled." },
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

  // Re-validate the requested slot against current availability.
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
  const valid = generateSlots({ durationMinutes, busy }).some((d) =>
    d.slots.includes(body.start!)
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
    type: "scheduled",
    meta: { start: start.toISOString(), end: end.toISOString() },
  });

  const { data: contractor } = await supabase
    .from("contractors")
    .select("email, business_name")
    .eq("id", quote.contractor_id)
    .single();
  if (contractor?.email) {
    const when = formatSlotRange(start.toISOString(), end.toISOString());
    await sendEmail({
      to: contractor.email,
      subject: `📅 Job booked: ${quote.title} — ${when}`,
      html: actionEmailHtml({
        heading: "Job booked",
        body: `The customer scheduled "<strong>${quote.title}</strong>" for <strong>${when}</strong>.`,
      }),
    });
  }

  return NextResponse.json({
    ok: true,
    start: start.toISOString(),
    end: end.toISOString(),
  });
}
