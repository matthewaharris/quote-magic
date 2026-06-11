import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Appointment times are stored as UTC wall-clock (see src/lib/scheduling.ts),
// so the ICS uses FLOATING local times — format the UTC components without
// a Z suffix and calendar apps show the same wall-clock time everywhere.
function icsFloating(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, title, contractor_id, share_token")
    .eq("share_token", token)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: job } = await supabase
    .from("jobs")
    .select("id, scheduled_start, scheduled_end")
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (!job?.scheduled_start || !job.scheduled_end) {
    return NextResponse.json({ error: "Not scheduled" }, { status: 404 });
  }

  const { data: contractor } = await supabase
    .from("contractors")
    .select("business_name, phone")
    .eq("id", quote.contractor_id)
    .single();
  const businessName = contractor?.business_name || "Your contractor";
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/q/${quote.share_token}`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//QuoteMagic//EN",
    "BEGIN:VEVENT",
    `UID:${job.id}@quotemagic.app`,
    `DTSTAMP:${icsFloating(new Date().toISOString())}`,
    `DTSTART:${icsFloating(job.scheduled_start)}`,
    `DTEND:${icsFloating(job.scheduled_end)}`,
    `SUMMARY:${icsEscape(`${businessName} — ${quote.title}`)}`,
    `DESCRIPTION:${icsEscape(`Job details: ${url}${contractor?.phone ? ` · ${businessName}: ${contractor.phone}` : ""}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="quotemagic-job.ics"',
    },
  });
}
